#!/usr/bin/env python3
"""Controleert de stand van MilieuRadar zonder AI: alarm, openstaand werk, agenda en links. Wijzigt niets in data/.

  python3 pipeline/controle.py <uitvoer.md>    schrijft de tekst van het GitHub-issue; eindigt met 1 bij een alarm
  python3 pipeline/controle.py --test          zelftest
"""
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
NL = ZoneInfo("Europe/Amsterdam")
MAX_UREN = 24          # langer geen nieuwe data: alarm
MAX_DALING = 0.10      # grotere daling van een aantal in meta.json in een dag: alarm
TERUG_DAGEN = 30       # zo ver kijken we terug voor debatten zonder samenvatting of koppeling
TESTS = [["node", "tests/zoektest.js"], ["node", "tests/ontwerptest.js"], [sys.executable, "tests/verzoektest.py"]]


def lees(pad):
    return json.loads((ROOT / pad).read_text(encoding="utf-8"))


def netjes(t):
    """Titel uit de data als platte tekst: geen opmaak, html of @vermelding in het issue."""
    return re.sub(r"([\\`*_\[\]<>#|])", r"\\\1", re.sub(r"\s+", " ", t or "")).replace("@", "@​").strip()


def te_oud(bijgewerkt, nu):
    """Geen run in het weekend: op zaterdag, zondag en maandagochtend (Nederlandse tijd) tellen die dagen niet mee."""
    uren = (nu - datetime.fromisoformat(bijgewerkt)).total_seconds() / 3600
    lokaal = nu.astimezone(NL)
    weekend = lokaal.weekday() >= 5 or (lokaal.weekday() == 0 and lokaal.hour < 12)
    return uren > MAX_UREN + (48 if weekend else 0)


def gedaald(oud, nieuw):
    return [f"`{k}` daalde in een dag van {oud[k]} naar {nieuw.get(k, 0)}" for k in oud
            if k.startswith("aantal") and oud[k] and nieuw.get(k, 0) < oud[k] * (1 - MAX_DALING)]


def verlopen(datum, vandaag):
    """datum: JJJJ-MM-DD, JJJJ-MM, JJJJ-Qn, JJJJ-voorjaar of leeg (nog niet bekend)."""
    d = datum or ""
    if re.fullmatch(r"\d{4}-\d\d(-\d\d)?", d):
        return d < vandaag[:len(d)]
    m = re.fullmatch(r"(\d{4})-(Q[1-4]|voorjaar)", d)
    if not m:
        return False
    eind = "06" if m[2] == "voorjaar" else f"{int(m[2][1]) * 3:02d}"
    return f"{m[1]}-{eind}" < vandaag[:7]


def meta_van_gisteren(nu):
    """meta.json zoals die een dag geleden in git stond; None als de geschiedenis of het bestand er niet is."""
    git = lambda *a: subprocess.run(["git", *a], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    commit = git("rev-list", "-1", f"--before={(nu - timedelta(days=1)).isoformat()}", "HEAD")
    inhoud = commit and git("show", f"{commit}:data/tk/meta.json")
    return json.loads(inhoud) if inhoud else None


def link_fout(url):
    """(url, 'dood' of 'onbekend', reden), of None als de link werkt. Een site die ons weigert is niet dood."""
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (linkcontrole)"}), timeout=30):
            return None
    except urllib.error.HTTPError as e:
        return url, "dood" if e.code in (404, 410) else "onbekend", str(e.code)
    except Exception as e:
        return url, "onbekend", type(e).__name__


def blok(kop, regels, leeg="Niets."):
    return f"## {kop}\n\n" + ("\n".join(f"- {r}" for r in regels) or leeg) + "\n"


def main(uitvoer):
    nu = datetime.now(timezone.utc)
    vandaag = nu.astimezone(NL).date().isoformat()

    alarm = []
    meta = lees("data/tk/meta.json")
    if not meta.get("bijgewerkt"):
        alarm.append("De laatste keer ophalen is mislukt")
    elif te_oud(meta["bijgewerkt"], nu):
        alarm.append(f"Geen nieuwe data sinds {meta['bijgewerkt']}: kijk bij cron-job.org en in het tabblad Actions")
    alarm += [f"Fout bij het ophalen: {netjes(str(f))}" for f in meta.get("fouten", [])]
    oud = meta_van_gisteren(nu)
    alarm += gedaald(oud, meta) if oud else ["Geen meta.json van een dag geleden gevonden: daling niet gecontroleerd"]
    for t in TESTS:
        r = subprocess.run(t, cwd=ROOT, capture_output=True, text=True)
        if r.returncode:
            alarm.append(f"`{t[1]}` faalt: {netjes(((r.stdout + r.stderr).strip().splitlines() or ['geen uitvoer'])[-1])}")

    activiteiten = lees("data/tk/activiteiten.json")
    debatten = lees("data/debatten.json")["debatten"]
    gekoppeld = lees("data/gehoord.json")["debatten"]
    samengevat = {n for d in debatten for n in [d.get("activiteit"), *(d.get("extraActiviteiten") or [])]}
    vanaf = (nu - timedelta(days=TERUG_DAGEN)).date().isoformat()
    zonder = [a for a in activiteiten if a["Status"] == "Uitgevoerd" and not a["Soort"].startswith("Inbreng")
              and (a.get("Datum") or "")[:10] >= vanaf and a["Nummer"] not in samengevat]
    regel = lambda a: f"{a['Datum'][:10]} {netjes(a['Soort'])}: {netjes(a['Onderwerp'])} (`{a['Nummer']}`)"
    niets = [regel(a) for a in zonder if a["Nummer"] not in gekoppeld]
    alleen_link = [regel(a) for a in zonder if a["Nummer"] in gekoppeld]

    beoordeeld = lees("data/rapporten.json")["beoordeeld"]
    rapporten = {b["id"]: f"{s['datum']} {netjes(b['titel'])} (`{b['id']}`)" for s in lees("data/tk/stukken.json")
                 for b in s.get("bijlagen", []) if b.get("rapport") and b["id"] not in beoordeeld}
    themas = subprocess.run(["node", "pipeline/themas_review.js", "--nieuw"], cwd=ROOT, capture_output=True, text=True, check=True)

    items = lees("data/agenda.json")["items"]
    oud_item = [f"{i['datum']} {netjes(i['titel'])}" for i in items if verlopen(i.get("datum"), vandaag)]
    in_kamer = {((a.get("Datum") or "")[:10], a["Onderwerp"].strip().casefold()) for a in activiteiten}
    dubbel = [f"{i['datum']} {netjes(i['titel'])}" for i in items
              if i.get("datum") and (i["datum"], i["titel"].strip().casefold()) in in_kamer]

    urls = sorted({u for f in ("agenda", "kerndocumenten")
                   for u in re.findall(r'"(https?://[^"\s]+)"', (ROOT / f"data/{f}.json").read_text(encoding="utf-8"))})
    with ThreadPoolExecutor(4) as pool:
        fouten = [x for x in pool.map(link_fout, urls) if x]
    links = lambda soort: [f"{u} ({reden})" for u, s, reden in fouten if s == soort]

    tekst = "\n".join([
        f"Stand van {nu.astimezone(NL):%d-%m-%Y %H:%M} (Nederlandse tijd). Dit issue wordt elke werkdag vanzelf bijgewerkt door `pipeline/controle.py`.\n",
        blok("Alarm", alarm, "Alles in orde."),
        blok(f"Vergaderingen zonder samenvatting en zonder koppeling met gehoord.de (laatste {TERUG_DAGEN} dagen)", niets),
        blok(f"Wel gekoppeld, niet samengevat (laatste {TERUG_DAGEN} dagen)", alleen_link),
        blok("Rapporten te beoordelen", rapporten.values()),
        blok("Themareview", [netjes(themas.stdout.split(" -> ")[0])]),
        blok("Agenda: verlopen", oud_item),
        blok("Agenda: staat ook in de Kamerdata", dubbel),
        blok(f"Dode links ({len(urls)} gecontroleerd)", links("dood")),
        blok("Links die niet te controleren waren", links("onbekend")),
    ])
    Path(uitvoer).write_text(tekst[:60000], encoding="utf-8")  # GitHub staat 65536 tekens toe
    print(tekst)
    return 1 if alarm else 0


def test():
    t = lambda s: datetime.fromisoformat(s)
    assert not te_oud("2026-11-25T13:00:00+00:00", t("2026-11-25T15:00:00+00:00"))
    assert te_oud("2026-11-24T13:00:00+00:00", t("2026-11-25T15:00:00+00:00"))
    assert not te_oud("2026-11-27T18:00:00+00:00", t("2026-11-30T07:00:00+00:00"))  # vrijdagavond tot maandagochtend
    assert te_oud("2026-11-27T18:00:00+00:00", t("2026-11-30T15:00:00+00:00"))
    assert gedaald({"aantalZaken": 100, "status": "ok"}, {"aantalZaken": 89}) and not gedaald({"aantalZaken": 100}, {"aantalZaken": 91})
    assert gedaald({"aantalZaken": 100}, {})
    for d, uit in {"2026-11-24": True, "2026-11-25": False, "2026-10": True, "2026-11": False, "2026-Q3": True, "2026-Q4": False,
                   "2026-voorjaar": True, "2027-voorjaar": False, None: False}.items():
        assert verlopen(d, "2026-11-25") is uit, d
    assert netjes("a@b [x](y)\n<i>") == "a@​b \\[x\\](y) \\<i\\>"
    print("controle: goed")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.exit(test() if sys.argv[1] == "--test" else main(sys.argv[1]))
