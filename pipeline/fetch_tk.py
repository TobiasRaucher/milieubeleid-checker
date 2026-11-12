#!/usr/bin/env python3
"""
Haalt gestructureerde data op uit de open data van de Tweede Kamer (OData API)
en schrijft compacte JSON-bestanden naar data/tk/.

- Geen AI nodig, geen API-sleutel nodig.
- Wordt gedraaid door de GitHub Action (.github/workflows/update.yml),
  of lokaal:  python3 pipeline/fetch_tk.py

Wat er wordt opgehaald (per actieve sector in pipeline/config.json):
  * zaken (wetsvoorstellen, moties, amendementen) uit de opgegeven kamerstukdossiers
  * zaken waarvan titel/onderwerp een zoekterm bevat
  * activiteiten (debatten, rondetafelgesprekken, briefings) van de opgegeven commissies

Documentatie API: https://opendata.tweedekamer.nl
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
from datetime import date, datetime, timezone
from pathlib import Path

BASE = "https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0/"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "tk"
CONFIG = json.loads((ROOT / "pipeline" / "config.json").read_text(encoding="utf-8"))

ZAAK_SOORTEN = ["Wetgeving", "Initiatiefwetgeving", "Motie", "Amendement"]
ACTIVITEIT_SOORTEN = [
    "Commissiedebat", "Plenair debat", "Tweeminutendebat", "Wetgevingsoverleg",
    "Notaoverleg", "Rondetafelgesprek", "Technische briefing", "Hoorzitting",
    "Notaoverleg (wetgeving)", "Debat", "Dertigledendebat", "Interpellatie",
]
FOUTEN = []


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def odata(entity, params, max_pages=40):
    """GET met paginering via @odata.nextLink. Geeft lijst van records terug."""
    url = BASE + entity + "?" + urllib.parse.urlencode(params, safe="$,()'/:", quote_via=urllib.parse.quote)
    out = []
    for _ in range(max_pages):
        for poging in range(4):
            try:
                req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "milieubeleid-checker"})
                with urllib.request.urlopen(req, timeout=60) as r:
                    data = json.load(r)
                break
            except urllib.error.HTTPError as e:
                if e.code in (400, 404):
                    raise
                log(f"  HTTP {e.code}, opnieuw proberen ({poging + 1})")
                time.sleep(3 * (poging + 1))
            except Exception as e:  # netwerkfout
                log(f"  netwerkfout {e}, opnieuw proberen ({poging + 1})")
                time.sleep(3 * (poging + 1))
        else:
            raise RuntimeError(f"Mislukt na 4 pogingen: {url}")
        out.extend(data.get("value", []))
        url = data.get("@odata.nextLink")
        if not url:
            break
    return out


EXPAND_VOL = (
    "ZaakActor($filter=Verwijderd eq false),"
    "Kamerstukdossier($select=Nummer,Toevoeging,Titel),"
    "Besluit($filter=Verwijderd eq false;$expand=Stemming($filter=Verwijderd eq false),"
    "Agendapunt($select=Id;$expand=Activiteit($select=Datum,Soort,Onderwerp)))"
)
EXPAND_SIMPEL = (
    "ZaakActor($filter=Verwijderd eq false),"
    "Kamerstukdossier($select=Nummer,Toevoeging,Titel),"
    "Besluit($filter=Verwijderd eq false;$expand=Stemming($filter=Verwijderd eq false))"
)


def zaken(filter_expr):
    soort = " or ".join(f"Soort eq '{s}'" for s in ZAAK_SOORTEN)
    params = {"$filter": f"Verwijderd eq false and ({soort}) and ({filter_expr})", "$expand": EXPAND_VOL}
    try:
        return odata("Zaak", params)
    except urllib.error.HTTPError as e:
        log(f"  volledige expand gaf HTTP {e.code}; terugvallen op eenvoudige expand")
        params["$expand"] = EXPAND_SIMPEL
        return odata("Zaak", params)


def uitslag(besluiten):
    """Leidt de uitkomst af uit de besluitteksten (laatste relevante besluit telt)."""
    volgorde = []
    for b in besluiten:
        t = (b.get("BesluitTekst") or "").lower()
        for woord, label in [("aangenomen", "aangenomen"), ("verworpen", "verworpen"),
                             ("aangehouden", "aangehouden"), ("ingetrokken", "ingetrokken"),
                             ("vervallen", "vervallen")]:
            if t.startswith(woord) or f" {woord}" in t[:40]:
                volgorde.append((b.get("_datum") or "", label))
                break
    if not volgorde:
        return "in behandeling"
    return sorted(volgorde)[-1][1]


def normaliseer_zaak(z, sector):
    besluiten = []
    for b in z.get("Besluit", []) or []:
        datum = None
        ap = b.get("Agendapunt") or {}
        act = ap.get("Activiteit") if isinstance(ap, dict) else None
        if isinstance(act, dict):
            datum = (act.get("Datum") or "")[:10] or None
        stemmen = []
        for s in b.get("Stemming", []) or []:
            if s.get("Vergissing"):
                continue
            stemmen.append({
                "fractie": s.get("ActorFractie") or s.get("ActorNaam"),
                "naam": s.get("ActorNaam"),
                "soort": s.get("Soort"),
                "zetels": s.get("FractieGrootte"),
            })
        b["_datum"] = datum
        besluiten.append({
            "soort": b.get("BesluitSoort"),
            "tekst": b.get("BesluitTekst"),
            "stemmingssoort": b.get("StemmingsSoort"),
            "datum": datum,
            "stemmen": stemmen,
        })
    stem_besluit = next((b for b in reversed(besluiten) if b["stemmen"]), None)
    telling = None
    if stem_besluit:
        # bij hoofdelijke stemmingen staat er één regel per Kamerlid: tel dan regels i.p.v. fractiegrootte
        hoofdelijk = "hoofdelijk" in (stem_besluit.get("stemmingssoort") or "").lower()
        w = (lambda s: 1) if hoofdelijk else (lambda s: s["zetels"] or 0)
        voor = sum(w(s) for s in stem_besluit["stemmen"] if s["soort"] == "Voor")
        tegen = sum(w(s) for s in stem_besluit["stemmen"] if s["soort"] == "Tegen")
        telling = {"voor": voor, "tegen": tegen, "datum": stem_besluit["datum"]}
    return {
        "id": z.get("Id"),
        "nummer": z.get("Nummer"),
        "soort": z.get("Soort"),
        "titel": z.get("Titel"),
        "onderwerp": z.get("Onderwerp"),
        "citeertitel": z.get("Citeertitel"),
        "gestartOp": (z.get("GestartOp") or "")[:10],
        "vergaderjaar": z.get("Vergaderjaar"),
        "afgedaan": z.get("Afgedaan"),
        "kabinetsappreciatie": z.get("Kabinetsappreciatie"),
        "behandelstatus": z.get("HuidigeBehandelstatus"),
        "dossiers": [
            {"nummer": k.get("Nummer"), "toevoeging": k.get("Toevoeging"), "titel": k.get("Titel")}
            for k in (z.get("Kamerstukdossier") or [])
        ],
        "indieners": [
            {"naam": a.get("ActorNaam"), "fractie": a.get("ActorFractie"), "relatie": a.get("Relatie")}
            for a in (z.get("ZaakActor") or [])
            if (a.get("Relatie") or "").lower() in ("indiener", "medeindiener", "eerste ondertekenaar", "mede ondertekenaar")
        ],
        "besluiten": [{k: v for k, v in b.items()} for b in besluiten],
        "uitslag": uitslag(z.get("Besluit", []) or []),
        "stemtelling": telling,
        "sectoren": [sector],
        "link": f"https://berthub.eu/tkconv/zaak.html?nummer={z.get('Nummer')}",
    }


ACT_SELECT = "Id,Nummer,Soort,Onderwerp,Datum,Aanvangstijd,Eindtijd,Locatie,Status,Voortouwnaam,Voortouwafkorting,Besloten,Noot,Kamer"
# agendapunten met de te behandelen stukken, en deelnemers (voorzitter, Kamerleden, bewindspersonen)
ACT_EXPAND = (
    "Agendapunt($filter=Verwijderd eq false;$select=Volgorde,Onderwerp;"
    "$expand=Zaak($select=Nummer,Soort,Onderwerp;"
    "$expand=Document($filter=Verwijderd eq false;$select=DocumentNummer,Soort,Datum,Onderwerp,Volgnummer;"
    "$expand=Kamerstukdossier($select=Nummer,Toevoeging),DocumentActor($select=ActorNaam,Functie,Relatie)))),"
    "ActiviteitActor($filter=Verwijderd eq false;$select=ActorNaam,ActorFractie,Functie,Relatie,Volgorde)"
)
PLENAIRE_SOORTEN = ["Plenair debat", "Tweeminutendebat", "Dertigledendebat", "Debat", "Interpellatie"]


def _act_query(filter_expr, max_pages=40):
    params = {"$filter": filter_expr, "$select": ACT_SELECT, "$expand": ACT_EXPAND, "$orderby": "Datum desc"}
    try:
        return odata("Activiteit", params, max_pages=max_pages)
    except urllib.error.HTTPError as e:
        log(f"  activiteiten met expand gaf HTTP {e.code}; terugvallen zonder agendapunten/deelnemers")
        params.pop("$expand")
        return odata("Activiteit", params, max_pages=max_pages)


def activiteiten(commissies, start, plenaire_termen):
    soort = " or ".join(f"Soort eq '{s}'" for s in ACTIVITEIT_SOORTEN)
    voortouw = " or ".join(f"Voortouwafkorting eq '{c}'" for c in commissies)
    datum = f"(Datum ge {start}T00:00:00Z or (Status eq 'Gepland' and Datum eq null))"
    uit = _act_query(f"Verwijderd eq false and ({soort}) and ({voortouw}) and {datum}")
    # plenaire debatten hebben geen commissie als voortouw: zoek op termen in het onderwerp
    if plenaire_termen:
        psoort = "startswith(Soort,'Plenair debat')"
        termen = " or ".join(f"contains(Onderwerp,'{t}')" for t in plenaire_termen)
        uit += _act_query(f"Verwijderd eq false and ({psoort}) and ({termen}) and {datum}")
    return [normaliseer_activiteit(a) for a in uit]


def _stuk(doc, zaak):
    ks = (doc.get("Kamerstukdossier") or [None])[0]
    kamerstuk = None
    if ks and doc.get("Volgnummer") not in (None, -1):
        kamerstuk = f"{ks['Nummer']}{'-' + ks['Toevoeging'] if ks.get('Toevoeging') else ''}-{doc['Volgnummer']}"
    ondert = next((a for a in doc.get("DocumentActor") or [] if (a.get("Relatie") or "").lower().startswith("eerste")), None)
    return {
        "kamerstuk": kamerstuk,
        "soort": doc.get("Soort"),
        "datum": (doc.get("Datum") or "")[:10] or None,
        "onderwerp": doc.get("Onderwerp"),
        "ondertekenaar": ondert.get("ActorNaam") if ondert else None,
        "functie": ondert.get("Functie") if ondert else None,
        "link": f"https://www.tweedekamer.nl/kamerstukken/detail?id={zaak.get('Nummer')}&did={doc.get('DocumentNummer')}",
    }


def normaliseer_activiteit(a):
    agendapunten = []
    for ap in sorted(a.get("Agendapunt") or [], key=lambda x: x.get("Volgorde") or 0):
        stukken = []
        for z in ap.get("Zaak") or []:
            alle = z.get("Document") or []
            # voorkeur: de brief zelf (zoals op tweedekamer.nl); anders het nieuwste stuk dat geen bijlage is
            brieven = [d for d in alle if (d.get("Soort") or "").lower().startswith("brief")]
            if brieven:
                docs = brieven[:1]
            else:
                rest = sorted([d for d in alle if d.get("Soort") != "Bijlage"] or alle, key=lambda d: d.get("Datum") or "", reverse=True)
                docs = rest[:1]
            stukken += [_stuk(d, z) for d in docs]
        agendapunten.append({"volgorde": ap.get("Volgorde"), "onderwerp": ap.get("Onderwerp"), "stukken": stukken})
    actoren = sorted(a.get("ActiviteitActor") or [], key=lambda x: x.get("Volgorde") or 0)
    bewinds = [{"naam": x["ActorNaam"], "functie": x.get("Functie")} for x in actoren if "bewindspersoon" in (x.get("Relatie") or "").lower()]
    # organisaties (bv. een volgcommissie) zijn geen personen
    actoren = [x for x in actoren if x.get("ActorFractie") or x.get("Functie") or "bewindspersoon" in (x.get("Relatie") or "").lower()]
    # de feitelijke voorzitter staat soms als "Naam voorzitter" in de lijst; anders de commissievoorzitter
    vz = next((x for x in actoren if (x.get("ActorNaam") or "").lower().endswith(" voorzitter")), None) \
        or next((x for x in actoren if "voorzitter" in (x.get("Functie") or "").lower()), None)
    voorzitter = {"naam": re.sub(r"\s+voorzitter$", "", vz["ActorNaam"], flags=re.I), "fractie": vz.get("ActorFractie")} if vz else None
    deelnemers = [{"naam": x["ActorNaam"], "fractie": x.get("ActorFractie"), "functie": x.get("Functie")}
                  for x in actoren if "bewindspersoon" not in (x.get("Relatie") or "").lower() and x is not vz]
    plenair = (a.get("Soort") or "").startswith("Plenair") or "plenaire zaal" in (a.get("Locatie") or "").lower()
    out = {k: a.get(k) for k in ["Id", "Nummer", "Soort", "Onderwerp", "Datum", "Aanvangstijd", "Eindtijd", "Locatie", "Status", "Voortouwnaam", "Voortouwafkorting", "Besloten", "Noot"]}
    m = re.match(r"Plenair debat \((.+)\)", a.get("Soort") or "")
    weergave = a.get("Soort")
    if m:
        sub = m.group(1).lower()
        weergave = "Plenair debat" if sub == "debat" else (sub.capitalize() if sub.endswith("debat") or sub == "interpellatie" else f"Plenair debat ({sub})")
    out.update({
        "SoortWeergave": weergave,
        "agendapunten": agendapunten,
        "bewindspersonen": bewinds,
        "voorzitter": voorzitter,
        "deelnemers": deelnemers,
        "tkLink": (f"https://www.tweedekamer.nl/debat_en_vergadering/plenaire_vergaderingen/details/activiteit?id={a.get('Nummer')}"
                   if plenair else f"https://www.tweedekamer.nl/debat_en_vergadering/commissievergaderingen/details?id={a.get('Nummer')}"),
    })
    return out


def main():
    start = CONFIG["startdatum"]
    alle_zaken = {}
    alle_act = {}
    for code, s in CONFIG["sectoren"].items():
        if not s.get("actief"):
            continue
        log(f"== Sector {s['naam']}")
        # 1. zaken per kamerstukdossier
        for d in s["kamerstukdossiers"]:
            n = d["nummer"]
            log(f"  dossier {n}{('-' + d['toevoeging']) if d.get('toevoeging') else ''} ({d['label']})")
            try:
                # wetsvoorstellen altijd; moties/amendementen vanaf startdatum
                tv = d.get("toevoeging")
                kfilter = f"k/Nummer eq {n}" + (f" and k/Toevoeging eq '{tv}'" if tv else "")
                rec = zaken(f"Kamerstukdossier/any(k: {kfilter}) and "
                            f"((Soort eq 'Wetgeving' or Soort eq 'Initiatiefwetgeving') or GestartOp ge {start}T00:00:00Z)")
                for z in rec:
                    nz = normaliseer_zaak(z, code)
                    bestaand = alle_zaken.get(nz["id"])
                    if bestaand:
                        bestaand["sectoren"] = sorted(set(bestaand["sectoren"]) | {code})
                    else:
                        alle_zaken[nz["id"]] = nz
                log(f"    {len(rec)} zaken")
            except Exception as e:
                FOUTEN.append(f"dossier {n}: {e}")
                log(f"    FOUT: {e}")
        # 2. zaken op zoekterm
        for term in s["zoektermen"]:
            log(f"  zoekterm '{term}'")
            t = term.replace("'", "''")
            try:
                rec = zaken(f"GestartOp ge {start}T00:00:00Z and (contains(Titel,'{t}') or contains(Onderwerp,'{t}'))")
                for z in rec:
                    nz = normaliseer_zaak(z, code)
                    nz["zoekterm"] = term
                    alle_zaken.setdefault(nz["id"], nz)
                log(f"    {len(rec)} zaken")
            except Exception as e:
                FOUTEN.append(f"zoekterm {term}: {e}")
                log(f"    FOUT: {e}")
        # 3. activiteiten
        try:
            rec = activiteiten(s["commissies"], start, s.get("plenaireZoektermen", []))
            for a in rec:
                a["sectoren"] = [code]
                alle_act.setdefault(a.get("Id"), a)
            log(f"  {len(rec)} activiteiten")
        except Exception as e:
            FOUTEN.append(f"activiteiten {code}: {e}")
            log(f"    FOUT: {e}")

    OUT.mkdir(parents=True, exist_ok=True)
    zaken_lijst = sorted(alle_zaken.values(), key=lambda z: z["gestartOp"] or "", reverse=True)
    act_lijst = sorted(alle_act.values(), key=lambda a: a.get("Datum") or "", reverse=True)
    if not zaken_lijst and not act_lijst and FOUTEN:
        log("Niets opgehaald en wel fouten: bestaande data blijft staan.")
        (OUT / "meta.json").write_text(json.dumps({
            "laatstePoging": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "status": "mislukt", "fouten": FOUTEN}, ensure_ascii=False, indent=1), encoding="utf-8")
        sys.exit(1)
    (OUT / "zaken.json").write_text(json.dumps(zaken_lijst, ensure_ascii=False, indent=1), encoding="utf-8")
    (OUT / "activiteiten.json").write_text(json.dumps(act_lijst, ensure_ascii=False, indent=1), encoding="utf-8")
    (OUT / "meta.json").write_text(json.dumps({
        "bijgewerkt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "status": "ok" if not FOUTEN else "gedeeltelijk",
        "aantalZaken": len(zaken_lijst),
        "aantalActiviteiten": len(act_lijst),
        "fouten": FOUTEN,
        "bron": "Tweede Kamer open data (gegevensmagazijn.tweedekamer.nl)",
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    log(f"Klaar: {len(zaken_lijst)} zaken, {len(act_lijst)} activiteiten, {len(FOUTEN)} fouten")


if __name__ == "__main__":
    main()
