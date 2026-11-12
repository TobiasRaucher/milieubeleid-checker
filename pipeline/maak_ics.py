#!/usr/bin/env python3
"""
Maakt data/agenda.ics: een agendafeed (iCalendar) met geplande Kameractiviteiten en mijlpalen.
Abonneer in Google Agenda, Apple Agenda of Outlook op:
  https://tobiasraucher.github.io/milieubeleid-checker/data/agenda.ics
Wordt gedraaid door de GitHub Action na fetch_tk.py, of lokaal:  python3 pipeline/maak_ics.py
"""
import json
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://tobiasraucher.github.io/milieubeleid-checker/"
TYPE_NORM = {"Plenair debat (tweeminutendebat)": "Tweeminutendebat", "Plenair debat (debat)": "Plenair debat",
             "Plenair debat (dertigledendebat)": "Dertigledendebat", "Plenair debat (initiatiefwetgeving)": "Plenair debat (wetgeving)"}


def esc(t):
    return str(t or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\r", "").replace("\n", "\\n")


def vouw(regel):
    """Regels langer dan 75 bytes vouwen (RFC 5545)."""
    b = regel.encode("utf-8")
    if len(b) <= 75:
        return regel
    delen, huidig = [], b""
    for ch in regel:
        c = ch.encode("utf-8")
        if len(huidig) + len(c) > (75 if not delen else 74):
            delen.append(huidig.decode("utf-8"))
            huidig = b""
        huidig += c
    delen.append(huidig.decode("utf-8"))
    return "\r\n ".join(delen)


def utc(iso):
    return datetime.fromisoformat(iso).astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def commissie(a):
    if a.get("Voortouwafkorting") == "TK" or not a.get("Voortouwnaam"):
        return "Plenaire vergadering"
    return re.sub(r"^(vaste |algemene )?commissie voor ", "", a["Voortouwnaam"], flags=re.I)


def main():
    acts = json.loads((ROOT / "data" / "tk" / "activiteiten.json").read_text(encoding="utf-8"))
    agenda = json.loads((ROOT / "data" / "agenda.json").read_text(encoding="utf-8")).get("items", [])
    debatten = json.loads((ROOT / "data" / "debatten.json").read_text(encoding="utf-8")).get("debatten", [])
    samengevat = {}
    for d in debatten:
        for n in [d.get("activiteit"), *(d.get("extraActiviteiten") or [])]:
            if n:
                samengevat[n] = d["id"]
    nu = datetime.now(timezone.utc)
    vanaf = (nu - timedelta(days=60)).isoformat()
    stempel = nu.strftime("%Y%m%dT%H%M%SZ")
    r = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//milieuradar//Agenda//NL", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
         "X-WR-CALNAME:milieuradar", "X-WR-CALDESC:Kameractiviteiten over milieu\\, klimaat\\, energie\\, water en natuur (milieuradar)",
         "X-WR-TIMEZONE:Europe/Amsterdam", "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H"]
    sleutels = set()
    for a in acts:
        if a.get("Status") not in ("Gepland", "Uitgevoerd") or not a.get("Datum"):
            continue
        if datetime.fromisoformat(a["Datum"]).astimezone(timezone.utc).isoformat() < vanaf:
            continue
        begin = a.get("Aanvangstijd") or a["Datum"]
        eind = a.get("Eindtijd") or (datetime.fromisoformat(begin) + timedelta(hours=2)).isoformat()
        soort = TYPE_NORM.get(a.get("Soort"), a.get("Soort") or "Activiteit")
        sleutels.add((begin[:10], (a.get("Onderwerp") or "").lower()[:20]))
        tekst = [commissie(a)]
        if a.get("Nummer") in samengevat:
            tekst.append(f"Samenvatting: {SITE}#vergaderingen/d-{samengevat[a['Nummer']]}")
        if a.get("tkLink"):
            tekst.append(f"Tweede Kamer: {a['tkLink']}")
        punten = [ap.get("onderwerp") for ap in a.get("agendapunten") or [] if ap.get("onderwerp")]
        if punten:
            tekst.append("Agendapunten:\n- " + "\n- ".join(punten[:15]))
        allday = begin[11:16] == "00:00"
        r += ["BEGIN:VEVENT", f"UID:{a['Nummer']}@milieuradar", f"DTSTAMP:{stempel}"]
        if allday:
            r += [f"DTSTART;VALUE=DATE:{begin[:10].replace('-', '')}"]
        else:
            r += [f"DTSTART:{utc(begin)}", f"DTEND:{utc(eind)}"]
        r += [vouw(f"SUMMARY:{esc(soort + ': ' + (a.get('Onderwerp') or ''))}"), vouw(f"DESCRIPTION:{esc(chr(10).join(tekst))}")]
        if a.get("Locatie"):
            r.append(vouw(f"LOCATION:{esc(a['Locatie'])}"))
        if a.get("tkLink"):
            r.append(vouw(f"URL:{a['tkLink']}"))
        r += ["STATUS:CONFIRMED", "END:VEVENT"]
    # mijlpalen met een vaste datum (bv. deadlines)
    for i in agenda:
        d = i.get("datum") or ""
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", d) or d < vanaf[:10]:
            continue
        if (d, (i.get("titel") or "").lower()[:20]) in sleutels:
            continue
        dag = date.fromisoformat(d)
        uid = re.sub(r"[^a-z0-9]+", "-", f"{d}-{i.get('titel', '')}".lower())[:60]
        r += ["BEGIN:VEVENT", f"UID:{uid}@milieuradar", f"DTSTAMP:{stempel}",
              f"DTSTART;VALUE=DATE:{dag.strftime('%Y%m%d')}", f"DTEND;VALUE=DATE:{(dag + timedelta(days=1)).strftime('%Y%m%d')}",
              vouw(f"SUMMARY:{esc((i.get('type') or 'Mijlpaal') + ': ' + (i.get('titel') or ''))}")]
        if i.get("url"):
            r += [vouw(f"URL:{i['url']}"), vouw(f"DESCRIPTION:{esc(i['url'])}")]
        r += ["TRANSP:TRANSPARENT", "END:VEVENT"]
    r.append("END:VCALENDAR")
    (ROOT / "data" / "agenda.ics").write_text("\r\n".join(r) + "\r\n", encoding="utf-8")
    print(f"agenda.ics: {sum(1 for x in r if x == 'BEGIN:VEVENT')} items")


if __name__ == "__main__":
    main()
