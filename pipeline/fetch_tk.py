#!/usr/bin/env python3
"""
Haalt gestructureerde data op uit de open data van de Tweede Kamer (OData API)
en schrijft compacte JSON-bestanden naar data/tk/.

- Geen AI nodig, geen API-sleutel nodig.
- Wordt gedraaid door de GitHub Action (.github/workflows/update.yml),
  of lokaal:  python3 pipeline/fetch_tk.py

Wat er wordt opgehaald (per actieve sector in pipeline/config.json):
  * zaken (wetsvoorstellen, moties, amendementen) uit de opgegeven kamerstukdossiers
    (brede dossiers met "breed": true alleen moties en amendementen met een trefwoord)
  * zaken waarvan het onderwerp een zoekterm bevat
  * wetsvoorstellen vanaf wetgeving.startdatum (2019) die over milieubeleid gaan (zie "wetgeving" in config.json)
  * alle moties en amendementen vanaf de startdatum met een trefwoord van een sector in het onderwerp,
    of bij een gevolgd wetsvoorstel, of ingediend tijdens een gevolgde vergadering
  * daarna gaan items die bij de themareview bewust geen thema kregen eruit (data/themas-mapping.json)
  * activiteiten (debatten, rondetafelgesprekken, briefings) van de opgegeven commissies
    (bij sectoren met activiteitTrefwoorden alleen activiteiten waarvan het onderwerp een
    trefwoord bevat)
  * stukken van ministeries (Kamerbrieven, antwoorden op Kamervragen) die volgens
    stukDossiers/trefwoorden bij een sector horen; zie "stukken" in config.json
  * uitstelberichten bij Kamervragen (veld "uitstel" bij de vraag) en commissieverzoeken (zie "verzoeken" in config.json)
  * toezeggingen uit het toezeggingenregister van de Kamer die bij een gevolgde activiteit horen
    (plus alle toezeggingen van de ministeries in toezeggingen.altijdMinisteries)

  * begrotingsstukken voor de tab Kerndocumenten (data/tk/begrotingen.json; zie "kerndocumenten" in config.json)

Alleen de begrotingsstukken bijwerken:
  python3 pipeline/fetch_tk.py --begrotingen

Alleen de tekst van moties en amendementen bijwerken (data/tk/teksten.json, op basis van zaken.json):
  python3 pipeline/fetch_tk.py --teksten

Alleen de toezeggingen bijwerken (op basis van de bestaande activiteiten.json):
  python3 pipeline/fetch_tk.py --toezeggingen

Documentatie API: https://opendata.tweedekamer.nl
"""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
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
# termijnen voor schriftelijke inbreng (Inbreng schriftelijk overleg, verslag, feitelijke vragen; de tijd is het einde
# van de termijn). Een eigen query met startswith: nog drie soorten in de of-lijst overschrijdt de limiet van 100 knopen.
INBRENG_FILTER = "startswith(Soort,'Inbreng')"
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
    "Document($filter=Verwijderd eq false;$select=Id,DocumentNummer,Soort,Datum,Volgnummer,ContentType),"
    "ZaakActor($filter=Verwijderd eq false),"
    "Kamerstukdossier($select=Nummer,Toevoeging,Titel),"
    "Besluit($filter=Verwijderd eq false;$expand=Stemming($filter=Verwijderd eq false),"
    "Agendapunt($select=Id;$expand=Activiteit($select=Datum,Soort,Onderwerp)))"
)
EXPAND_SIMPEL = (
    "Document($filter=Verwijderd eq false;$select=Id,DocumentNummer,Soort,Datum,Volgnummer,ContentType),"
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


def zaken_op_id(ids, batch=15):  # meer geeft "node count limit" (HTTP 400)
    """Volledige zaken (met besluiten en stemmingen) voor een lijst Id's, in kleine porties."""
    ids = list(dict.fromkeys(ids))
    uit = []
    for i in range(0, len(ids), batch):
        deel = " or ".join(f"Id eq {x}" for x in ids[i:i + batch])
        params = {"$filter": f"Verwijderd eq false and ({deel})", "$expand": EXPAND_VOL}
        try:
            uit += odata("Zaak", params)
        except urllib.error.HTTPError as e:
            log(f"  volledige expand gaf HTTP {e.code}; terugvallen op eenvoudige expand")
            params["$expand"] = EXPAND_SIMPEL
            uit += odata("Zaak", params)
    return uit


def _regex(lijst):
    return re.compile("|".join(f"(?:{t})" for t in lijst), re.I) if lijst else None


# "Motie van het lid X over ...", "Gewijzigd amendement van de leden X en Y ter vervanging van nr. 9 over ...",
# "vragen van het lid X over ...": namen van Kamerleden tellen niet als trefwoord
_INDIENER = re.compile(r"\b(motie|amendement|vragen) van (het lid|de leden) .+? (over|inzake|naar aanleiding van) ", re.I)


def schone_tekst(tekst):
    tekst = _INDIENER.sub("", tekst or "")
    for n in (CONFIG.get("stukken") or {}).get("negeerInTekst", []):
        tekst = tekst.replace(n, "")
    return tekst


def dossier_sleutels(dossiers):
    """Kamerstukdossiers als sleutels: '21501' en '21501-33'."""
    uit = set()
    for k in dossiers or []:
        n, t = k.get("Nummer", k.get("nummer")), k.get("Toevoeging", k.get("toevoeging"))
        uit.add(str(n))
        if t:
            uit.add(f"{n}-{t}")
    return uit


def sector_regels():
    """Per actieve sector: (dossiersleutels, brede dossiers, trefwoord-regex)."""
    regels = {}
    for code, s in CONFIG["sectoren"].items():
        if not s.get("actief"):
            continue
        sleutels = {str(d["nummer"]) + (f"-{d['toevoeging']}" if d.get("toevoeging") else "") for d in s.get("kamerstukdossiers", [])}
        breed = {str(d["nummer"]) + (f"-{d['toevoeging']}" if d.get("toevoeging") else "") for d in s.get("kamerstukdossiers", []) if d.get("breed")}
        regels[code] = (sleutels, breed, _regex(s.get("trefwoorden", [])))
    return regels


def sectoren_op_trefwoord(tekst, regels):
    return [c for c, (_, _, rx) in regels.items() if rx and rx.search(tekst)]


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
    # het document van de motie of het amendement zelf (D-nummer) voor de link naar tweedekamer.nl;
    # bij gewijzigde versies telt het nieuwste document
    soort = z.get("Soort") or ""
    docs = sorted((d for d in (z.get("Document") or []) if (d.get("Soort") or "").startswith(soort)),
                  key=lambda d: d.get("Datum") or "")
    dnr = docs[-1].get("DocumentNummer") if docs else None
    hoofd = docs[-1] if docs else {}
    pad = {"Motie": "moties", "Amendement": "amendementen"}.get(soort)
    tk_link = (f"https://www.tweedekamer.nl/kamerstukken/{pad}/detail?id={z.get('Nummer')}&did={dnr}"
               if pad and dnr else None)
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
        "document": dnr,
        # voor de tekst en de documentweergave op de site (gegevensmagazijn: Document/<docId>/resource)
        "docId": hoofd.get("Id"),
        "bestand": bestandssoort(hoofd.get("ContentType")),
        "volgnummer": hoofd.get("Volgnummer") if hoofd.get("Volgnummer") not in (None, -1) else None,
        "tkLink": tk_link,
        "link": f"https://berthub.eu/tkconv/zaak.html?nummer={z.get('Nummer')}",
    }


ACT_SELECT = "Id,Nummer,Soort,Onderwerp,Datum,Aanvangstijd,Eindtijd,Locatie,Status,Voortouwnaam,Voortouwafkorting,Besloten,Noot,Kamer"
# agendapunten met de te behandelen stukken, en deelnemers (voorzitter, Kamerleden, bewindspersonen)
ACT_EXPAND = (
    "Agendapunt($filter=Verwijderd eq false;$select=Volgorde,Onderwerp;"
    "$expand=Zaak($select=Nummer,Soort,Onderwerp;"
    "$expand=Document($filter=Verwijderd eq false;$select=DocumentNummer,Soort,Datum,Onderwerp,Volgnummer;"
    "$expand=Kamerstukdossier($select=Nummer,Toevoeging),DocumentActor($select=ActorNaam,Functie,Relatie)))),"
    "ActiviteitActor($filter=Verwijderd eq false;$select=ActorNaam,ActorFractie,Functie,Relatie,Volgorde),"
    "Reservering($expand=Zaal($select=Naam))"
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
    uit += _act_query(f"Verwijderd eq false and {INBRENG_FILTER} and ({voortouw}) and {datum}")
    # plenaire debatten hebben geen commissie als voortouw: zoek op termen in het onderwerp
    if plenaire_termen:
        psoort = "startswith(Soort,'Plenair debat')"
        termen = " or ".join(f"contains(Onderwerp,'{t}')" for t in plenaire_termen)
        uit += _act_query(f"Verwijderd eq false and ({psoort}) and ({termen}) and {datum}")
    return [normaliseer_activiteit(a) for a in uit]


def stemmingen(start):
    """{zaaknummer: {"datum", "tijd" (als bekend), "activiteit"}} uit de agendapunten van plenaire Stemmingen. Per zaak de eerstvolgende
    geplande stemming, en anders de laatst gehouden (een motie kan worden uitgesteld en opnieuw geagendeerd).
    "activiteit" is het nummer van die Stemmingen-activiteit (voor de link naar tweedekamer.nl)."""
    rec = odata("Activiteit", {
        "$filter": f"Verwijderd eq false and Soort eq 'Stemmingen' and Datum ge {start}T00:00:00Z and (Status eq 'Gepland' or Status eq 'Uitgevoerd')",
        "$select": "Nummer,Datum,Status",
        "$expand": "Agendapunt($filter=Verwijderd eq false;$select=Onderwerp;$expand=Zaak($select=Nummer))",
        "$orderby": "Datum desc",
    })
    vandaag = datetime.now(timezone.utc).date().isoformat()
    uit = {}
    for a in rec:
        dag = (a.get("Datum") or "")[:10]
        if not dag:
            continue
        tijd = a["Datum"][11:16]  # de Kamer geeft Nederlandse tijd; 00:00 is geen tijd
        for ap in a.get("Agendapunt") or []:
            for z in ap.get("Zaak") or []:
                n = z.get("Nummer")
                if not n:
                    continue
                oud = (uit.get(n) or {}).get("datum")
                nieuw = {"datum": dag, "activiteit": a.get("Nummer")}
                if tijd and tijd != "00:00":
                    nieuw["tijd"] = tijd
                if oud is None:
                    uit[n] = nieuw
                elif dag >= vandaag and (oud < vandaag or dag < oud):
                    uit[n] = nieuw  # eerstvolgende geplande gaat voor
                elif dag < vandaag and oud < vandaag and dag > oud:
                    uit[n] = nieuw
    return uit


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
    # zaal: Locatie, anders de gereserveerde zaal, anders de plenaire zaal bij plenaire debatten (de TK-data laat het vaak leeg)
    reserveringen = a.get("Reservering") or []
    reserveringen = reserveringen if isinstance(reserveringen, list) else [reserveringen]
    zalen = []
    for r in reserveringen:
        z = r.get("Zaal") if isinstance(r, dict) else None
        for x in (z if isinstance(z, list) else [z]):
            if isinstance(x, dict) and x.get("Naam"):
                zalen.append(x["Naam"])
    zaal = a.get("Locatie") or next((z for z in zalen if z), None) or ("Plenaire zaal" if (a.get("Soort") or "").startswith("Plenair") else None)
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
        "zaal": zaal,
        "tkLink": (f"https://www.tweedekamer.nl/debat_en_vergadering/plenaire_vergaderingen/details/activiteit?id={a.get('Nummer')}"
                   if plenair else f"https://www.tweedekamer.nl/debat_en_vergadering/commissievergaderingen/details?id={a.get('Nummer')}"),
    })
    return out


STUK_EXPAND = ("DocumentActor($select=ActorNaam,ActorFractie,Functie,Relatie),"
               "Kamerstukdossier($select=Nummer,Toevoeging,Titel),"
               "Zaak($select=Nummer,Soort;$expand=ZaakActor($select=ActorNaam,Functie,Relatie)),"
               "BijlageDocument($select=Id,DocumentNummer,Onderwerp,Titel,ContentType,Verwijderd)")

BESTANDSSOORT = {"application/pdf": "PDF", "application/msword": "DOC",
                 "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
                 "application/vnd.ms-excel": "XLS",
                 "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX"}


def bestandssoort(content_type):
    return BESTANDSSOORT.get((content_type or "").split(";")[0].strip())


RAPPORT = CONFIG.get("rapporten") or {}
RAPPORT_RE = re.compile(RAPPORT.get("titel") or r"(?!)", re.I)
RAPPORT_NIET = [re.compile(p, re.I) for p in RAPPORT.get("uitsluiten") or []]


def is_rapport(titel):
    """Kandidaat voor de pagina Rapporten (config.json, rapporten); Claude beoordeelt ze in data/rapporten.json."""
    return bool(RAPPORT_RE.search(titel)) and not any(p.search(titel) for p in RAPPORT_NIET)


def bijlagen(d):
    """Bijlagen bij een Kamerbrief of antwoord (beslisnota, rapporten, analyses), met een downloadlink."""
    uit = []
    for b in d.get("BijlageDocument") or []:
        if b.get("Verwijderd") or not b.get("DocumentNummer"):
            continue
        uit.append({"id": b["DocumentNummer"],
                    "titel": re.sub(r"\s+", " ", (b.get("Onderwerp") or b.get("Titel") or "Bijlage")).strip(),
                    "bestand": bestandssoort(b.get("ContentType")),
                    "docId": b.get("Id"),
                    "link": f"https://www.tweedekamer.nl/downloads/document?id={b['DocumentNummer']}"})
        if is_rapport(uit[-1]["titel"]):
            uit[-1]["rapport"] = True
    # rapporten eerst, beslisnota's achteraan
    return sorted(uit, key=lambda x: (x["titel"].lower().startswith("beslisnota"), not x.get("rapport"), x["titel"].lower()))


def ministerie_uit_functie(functie):
    m = re.sub(r"^(minister-president|minister|staatssecretaris)\b( voor| van)?\s*", "", functie or "", flags=re.I)
    return m or None


def stukken(start):
    cfg = CONFIG.get("stukken") or {}
    soort = " or ".join(f"Soort eq '{s}'" for s in cfg.get("soorten", ["Brief regering"]))
    params = {"$filter": f"Verwijderd eq false and ({soort}) and Datum ge {start}T00:00:00Z",
              "$select": "Id,Soort,DocumentNummer,Titel,Onderwerp,Datum,Volgnummer,ContentType",
              "$expand": STUK_EXPAND, "$orderby": "Datum desc"}
    ruw = odata("Document", params, max_pages=200)
    regels = {}
    for code, s in CONFIG["sectoren"].items():
        if s.get("actief"):
            regels[code] = ({str(x) for x in s.get("stukDossiers", [])} |
                            {str(d["nummer"]) + (f"-{d['toevoeging']}" if d.get("toevoeging") else "") for d in s.get("kamerstukdossiers", [])},
                            _regex(s.get("trefwoorden", [])))
    uit = _regex(cfg.get("uitsluiten", []))
    altijd = cfg.get("altijdMinisteries", {})
    # brede dossiers (bv. 21501-33, Raad VTE: ook telecom) tellen alleen samen met een trefwoord
    breed = {str(x) for x in cfg.get("bredeDossiers", [])}
    out, kandidaten = [], []
    for d in ruw:
        onderwerp = d.get("Onderwerp") or ""
        if uit and uit.search(onderwerp):
            continue
        soort = d.get("Soort")
        vraag = soort == "Schriftelijke vragen"
        actoren = d.get("DocumentActor") or []
        eerste = next((a for a in actoren if (a.get("Relatie") or "").lower().startswith("eerste")), None)
        zaak_obj = next(iter(d.get("Zaak") or []), {}) or {}
        zaak = zaak_obj.get("Nummer")
        indieners, ministeries = [], []
        if vraag:
            # Kamervragen: gesteld door Kamerleden, gericht aan bewindspersonen (uit de zaak)
            for a in sorted(actoren, key=lambda a: 0 if (a.get("Relatie") or "").lower().startswith("eerste") else 1):
                if a.get("ActorNaam"):
                    indieners.append({"naam": a.get("ActorNaam"), "fractie": a.get("ActorFractie"), "relatie": a.get("Relatie")})
            gericht = [a for a in zaak_obj.get("ZaakActor") or [] if (a.get("Relatie") or "") == "Gericht aan"]
            ministeries = [m for m in dict.fromkeys(ministerie_uit_functie(a.get("Functie")) for a in gericht) if m]
            ministerie = ministeries[0] if ministeries else None
            functie = (gericht[0].get("Functie") if gericht else None) or ""
            ondertekenaar = gericht[0].get("ActorNaam") if gericht else None
        else:
            functie = (eerste or {}).get("Functie") or ""
            if not re.match(r"(minister|staatssecretaris)", functie, re.I):
                continue  # bv. een commissievoorzitter
            ministerie = ministerie_uit_functie(functie)
            ondertekenaar = (eerste or {}).get("ActorNaam")
        dossiers = [{"nummer": k.get("Nummer"), "toevoeging": k.get("Toevoeging"), "titel": k.get("Titel")} for k in d.get("Kamerstukdossier") or []]
        sleutels = set()
        for k in dossiers:
            sleutels.add(str(k["nummer"]))
            if k["toevoeging"]:
                sleutels.add(f"{k['nummer']}-{k['toevoeging']}")
        tekst = schone_tekst(f"{d.get('Titel') or ''} {onderwerp}")
        sectoren = [c for c, (ds, rx) in regels.items() if ((sleutels & ds) - breed) or (rx and rx.search(tekst))]
        for m, c in altijd.items():
            if any(m in (x or "") for x in (ministeries or [ministerie])) and c in regels and c not in sectoren:
                sectoren.append(c)
        ks = dossiers[0] if dossiers else None
        kamerstuk = None
        if ks and d.get("Volgnummer") not in (None, -1):
            kamerstuk = f"{ks['nummer']}{'-' + ks['toevoeging'] if ks.get('toevoeging') else ''}-{d['Volgnummer']}"
        pad = "brieven_regering" if soort == "Brief regering" else "kamervragen"
        item = {
            "id": d.get("DocumentNummer"),
            "docId": d.get("Id"),
            "bestand": bestandssoort(d.get("ContentType")),
            "soort": soort,
            "datum": (d.get("Datum") or "")[:10] or None,
            "titel": d.get("Titel"),
            "onderwerp": onderwerp,
            "zaak": zaak,
            "ministerie": ministerie,
            "ondertekenaar": ondertekenaar,
            "functie": functie or None,
            "kamerstuk": kamerstuk,
            "dossiers": dossiers,
            "sectoren": sectoren,
            "link": (f"https://www.tweedekamer.nl/kamerstukken/{pad}/detail?id={zaak}&did={d.get('DocumentNummer')}" if zaak
                     else f"https://www.tweedekamer.nl/kamerstukken/detail?did={d.get('DocumentNummer')}"),
        }
        if vraag:
            item["ministeries"] = ministeries
            item["indieners"] = indieners
        bl = bijlagen(d)
        if bl:
            item["bijlagen"] = bl
        kandidaten.append(item)
    # vraag en antwoord horen bij dezelfde zaak: valt een van beide in een sector, dan komt het paar er samen in
    per_zaak = {}
    for x in kandidaten:
        if x["zaak"] and (x["soort"] == "Schriftelijke vragen" or x["soort"].startswith("Antwoord")):
            per_zaak.setdefault(x["zaak"], []).append(x)
    for groep in per_zaak.values():
        samen = list(dict.fromkeys(c for x in groep for c in x["sectoren"]))
        for x in groep:
            x["sectoren"] = samen
    out = [x for x in kandidaten if x["sectoren"]]
    return out


def oude_uitstellen():
    """Uitstelberichten uit de vorige run: {zaak: [bericht]}."""
    try:
        oud = json.loads((OUT / "stukken.json").read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    return {x["zaak"]: x["uitstel"] for x in oud if x.get("uitstel")}


def uitstellen(start):
    """Mededelingen over uitstel van het antwoord op Kamervragen: {zaak: [bericht]}, oudste eerst."""
    rec = odata("Document", {"$filter": f"Verwijderd eq false and Soort eq 'Mededeling (uitstel antwoord)' and Datum ge {start}T00:00:00Z",
                             "$select": "Id,DocumentNummer,Datum,ContentType", "$expand": "Zaak($select=Nummer)", "$orderby": "Datum"}, max_pages=200)
    uit = {}
    for d in rec:
        for z in d.get("Zaak") or []:
            uit.setdefault(z["Nummer"], []).append({
                "id": d["DocumentNummer"], "docId": d["Id"], "bestand": bestandssoort(d.get("ContentType")), "datum": (d.get("Datum") or "")[:10],
                "link": f"https://www.tweedekamer.nl/kamerstukken/kamervragen/detail?id={z['Nummer']}&did={d['DocumentNummer']}"})
    return uit


def is_verzoek(onderwerp):
    """Inhoudelijk verzoek van een commissie, geen procedurele brief (config.json, verzoeken)."""
    cfg = CONFIG["verzoeken"]
    uit = _regex(cfg["uitsluiten"])
    return bool(_regex(cfg["insluiten"]).search(onderwerp)) and not (uit and uit.search(onderwerp))


def verzoek_antwoorden(zaken_, datum):
    """Kamerbrieven die de Kamer aan het verzoek koppelt: zelfde dag of later, geen uitstelbericht."""
    per = {}
    for z in zaken_:
        for g in (z.get("GerelateerdNaar") or []) + (z.get("GerelateerdVanuit") or []):
            gd = (g.get("GestartOp") or "")[:10]
            if not g.get("Verwijderd") and g.get("Soort") == "Brief regering" and gd >= datum and not re.match(r"uitstel\b", g.get("Onderwerp") or "", re.I):
                # zonder documentnummer geeft de Kamer "Pagina niet gevonden"
                did = next((x["DocumentNummer"] for x in g.get("Document") or [] if x.get("Soort") == "Brief regering"), None)
                per[g["Nummer"]] = {"zaak": g["Nummer"], "datum": gd, "onderwerp": g.get("Onderwerp"),
                                    "link": (f"https://www.tweedekamer.nl/kamerstukken/brieven_regering/detail?id={g['Nummer']}&did={did}" if did
                                             else f"https://www.tweedekamer.nl/zoeken?q={g['Nummer']}")}
    return sorted(per.values(), key=lambda x: x["datum"])


def commissieverzoeken(start, regels):
    """Brieven waarin een Kamercommissie een bewindspersoon om een reactie of informatie vraagt."""
    soort = " or ".join(f"Soort eq '{x}'" for x in CONFIG["verzoeken"]["soorten"])
    rel = "$select=Nummer,Soort,Onderwerp,GestartOp,Verwijderd;$expand=Document($filter=Verwijderd eq false;$select=DocumentNummer,Soort)"
    rec = odata("Document", {"$filter": f"Verwijderd eq false and ({soort}) and Datum ge {start}T00:00:00Z",
                             "$select": "Id,DocumentNummer,Onderwerp,Datum,ContentType", "$orderby": "Datum",
                             "$expand": f"Zaak($select=Nummer,Soort;$expand=ZaakActor($select=ActorNaam,Functie,Relatie),GerelateerdNaar({rel}),GerelateerdVanuit({rel}))"},
                max_pages=200)
    altijd = (CONFIG.get("stukken") or {}).get("altijdMinisteries", {})
    uit, gezien = [], set()
    for d in rec:
        onderwerp = re.sub(r"\s+", " ", d.get("Onderwerp") or "").strip()
        eigen = [z for z in d.get("Zaak") or [] if z.get("Soort") == "Brief commissie"]
        if not eigen or not is_verzoek(onderwerp):
            continue
        actoren = [a for z in eigen for a in z.get("ZaakActor") or []]
        gericht = [a for a in actoren if a.get("Relatie") == "Gericht aan"]
        ministeries = [m for m in dict.fromkeys(ministerie_uit_functie(a.get("Functie")) for a in gericht) if m]
        sectoren = sectoren_op_trefwoord(schone_tekst(onderwerp), regels)
        for m, c in altijd.items():
            if any(m in x for x in ministeries) and c in regels and c not in sectoren:
                sectoren.append(c)
        # een tweede brief bij dezelfde zaak is dezelfde rij
        zaak = eigen[0]["Nummer"]
        if not gericht or not sectoren or zaak in gezien:
            continue
        gezien.add(zaak)
        datum = (d.get("Datum") or "")[:10]
        uit.append({
            "id": d["DocumentNummer"], "docId": d["Id"], "bestand": bestandssoort(d.get("ContentType")), "datum": datum,
            "onderwerp": onderwerp, "zaak": zaak,
            "commissie": next((a["ActorNaam"] for a in actoren if a.get("Relatie") == "Voortouwcommissie"), None),
            "gerichtAan": list(dict.fromkeys(a["ActorNaam"] for a in gericht if a.get("ActorNaam"))), "ministeries": ministeries, "sectoren": sectoren,
            "link": f"https://www.tweedekamer.nl/kamerstukken/detail?id={zaak}&did={d['DocumentNummer']}",
            "antwoorden": verzoek_antwoorden(eigen, datum),
        })
    return uit[::-1]


def toezeggingen(start, act_nummers):
    """Officiële toezeggingen (toezeggingenregister Tweede Kamer) bij gevolgde activiteiten."""
    cfg = CONFIG.get("toezeggingen", {})
    altijd = set(cfg.get("altijdMinisteries", ["Klimaat en Groene Groei"]))
    rec = odata("Toezegging", {"$filter": f"Verwijderd eq false and Aanmaakdatum ge {start}T00:00:00Z",
                               "$orderby": "Aanmaakdatum desc"}, max_pages=100)
    uit = []
    for t in rec:
        if t.get("ActiviteitNummer") not in act_nummers and t.get("Ministerie") not in altijd:
            continue
        naam = " ".join(x for x in [t.get("Initialen"), t.get("Tussenvoegsel"), t.get("Achternaam")] if x)
        naam = re.sub(r",?\s*\b(LLM|LL\.M\.|MSc|MA|MBA|BSc|BA|PhD|MPA|MPhil|MBA)\b\.?,?", "", naam).strip(" ,")
        nak = t.get("DatumNakoming") or ""
        uit.append({
            "nummer": t.get("Nummer"), "tekst": (t.get("Tekst") or "").strip(), "status": t.get("Status"),
            "ministerie": t.get("Ministerie"), "bewindspersoon": naam, "functie": t.get("Functie"),
            "activiteit": t.get("ActiviteitNummer"), "datum": (t.get("Aanmaakdatum") or "")[:10],
            "nakoming": None if nak.startswith("0001") else nak[:10], "gewijzigd": (t.get("GewijzigdOp") or "")[:10],
        })
    return uit


def _act_past(a, rx):
    # alleen het onderwerp: agendapunten van brede debatten maken de selectie te ruim
    return bool(rx.search(a.get("Onderwerp") or ""))


LICHT_SELECT = "Id,Nummer,Soort,Titel,Citeertitel,Onderwerp,GestartOp"


def wetsvoorstellen(alle_zaken, regels):
    """Wetsvoorstellen vanaf wetgeving.startdatum (config) die over milieubeleid gaan:
    Kamerstuk in de config of in wetgeving.insluiten, voortouw bij een commissie uit wetgeving.altijdVoortouw,
    of een trefwoord van een sector in de (citeer)titel; nooit de Kamerstukken in wetgeving.uitsluiten.
    Geeft de Kamerstuknummers van alle gevolgde wetsvoorstellen terug."""
    cfg = CONFIG.get("wetgeving") or {}
    start = cfg.get("startdatum", CONFIG["startdatum"])
    uit = {str(x) for x in cfg.get("uitsluiten", [])}
    insluiten = {str(x["nummer"]): x.get("sector") for x in cfg.get("insluiten", [])}
    altijd = cfg.get("altijdVoortouw", {})
    # woorden die bij wetsvoorstellen niet als trefwoord tellen (bv. Bonaire: anders elke BES-wet)
    niet = _regex(cfg.get("nietAlsTrefwoord", []))
    ruw = odata("Zaak", {
        "$filter": f"Verwijderd eq false and (Soort eq 'Wetgeving' or Soort eq 'Initiatiefwetgeving') and GestartOp ge {start}T00:00:00Z",
        "$select": LICHT_SELECT,
        "$expand": "Kamerstukdossier($select=Nummer,Toevoeging),ZaakActor($filter=Relatie eq 'Voortouwcommissie';$select=ActorAfkorting)",
    }, max_pages=100)
    gekozen = {}
    for z in ruw:
        nrs = {str(k.get("Nummer")) for k in z.get("Kamerstukdossier") or []}
        if nrs & uit:
            continue
        voortouw = {a.get("ActorAfkorting") for a in z.get("ZaakActor") or []}
        sectoren = [c for c, (ds, breed, _) in regels.items() if nrs & (ds - breed)]
        sectoren += [insluiten[n] for n in nrs if insluiten.get(n)]
        sectoren += [altijd[v] for v in voortouw if v in altijd]
        if not sectoren:
            titel = f"{z.get('Titel') or ''} {z.get('Citeertitel') or ''}"
            sectoren = sectoren_op_trefwoord(niet.sub("", titel) if niet else titel, regels)
        if sectoren:
            gekozen[z["Id"]] = list(dict.fromkeys(sectoren))
    # uitgesloten Kamerstukken ook weghalen als ze via een vast dossier of zoekterm binnenkwamen
    for nz in list(alle_zaken.values()):
        if "wetgeving" in (nz["soort"] or "").lower() and {str(d["nummer"]) for d in nz["dossiers"]} & uit:
            del alle_zaken[nz["id"]]
    nieuw = [i for i in gekozen if i not in alle_zaken]
    for z in zaken_op_id(nieuw):
        nz = normaliseer_zaak(z, gekozen[z["Id"]][0])
        nz["sectoren"] = sorted(gekozen[z["Id"]])
        alle_zaken[nz["id"]] = nz
    wet_dossiers = {str(d["nummer"]) for nz in alle_zaken.values() if "wetgeving" in (nz["soort"] or "").lower() for d in nz["dossiers"]}
    log(f"== wetsvoorstellen: {len(gekozen)} vanaf {start} ({len(nieuw)} nieuw), {len(wet_dossiers)} Kamerstukken")
    return wet_dossiers


def breed_zoeken(alle_zaken, regels, wet_dossiers, start, act_sectoren=None):
    """Alle moties en amendementen vanaf de startdatum: binnen als het onderwerp een trefwoord van een sector heeft,
    als ze bij een gevolgd wetsvoorstel horen (amendementen en moties bij de behandeling), of als ze zijn ingediend
    tijdens een gevolgde activiteit (act_sectoren: activiteit-Id -> sectoren), bv. moties bij een wetgevingsoverleg
    over stikstof waarvan het onderwerp zelf geen trefwoord heeft."""
    act_sectoren = act_sectoren or {}
    uit = {str(x) for x in (CONFIG.get("wetgeving") or {}).get("uitsluiten", [])}
    ruw = odata("Zaak", {
        "$filter": f"Verwijderd eq false and (Soort eq 'Motie' or Soort eq 'Amendement') and GestartOp ge {start}T00:00:00Z",
        "$select": LICHT_SELECT,
        "$expand": "Kamerstukdossier($select=Nummer,Toevoeging),"
                   "Agendapunt($filter=Verwijderd eq false;$select=Id;$expand=Activiteit($select=Id))",
    }, max_pages=200)
    via_act = 0
    bekend = set(alle_zaken)
    gekozen = {}
    for z in ruw:
        if z["Id"] in bekend:
            continue
        nrs = {str(k.get("Nummer")) for k in z.get("Kamerstukdossier") or []}
        if nrs & uit:
            continue
        sectoren = sectoren_op_trefwoord(schone_tekst(z.get("Onderwerp")), regels)
        if not sectoren and nrs & wet_dossiers:
            # sector van het wetsvoorstel
            wet = next((nz for nz in alle_zaken.values() if "wetgeving" in (nz["soort"] or "").lower()
                        and {str(d["nummer"]) for d in nz["dossiers"]} & nrs), None)
            sectoren = list(wet["sectoren"]) if wet else []
        if not sectoren:
            # ingediend tijdens een gevolgde vergadering
            for ap in z.get("Agendapunt") or []:
                sectoren += [c for c in act_sectoren.get((ap.get("Activiteit") or {}).get("Id"), []) if c not in sectoren]
            via_act += bool(sectoren)
        if sectoren:
            gekozen[z["Id"]] = sectoren
    for z in zaken_op_id(list(gekozen)):
        nz = normaliseer_zaak(z, gekozen[z["Id"]][0])
        nz["sectoren"] = sorted(gekozen[z["Id"]])
        alle_zaken[nz["id"]] = nz
    log(f"== moties en amendementen: {len(ruw)} bekeken, {len(gekozen)} erbij ({via_act} via een gevolgde vergadering)")


def relevantiepoort(alle_zaken, stuk_lijst, verzoek_lijst):
    """Items die bij de themareview bewust geen thema kregen (data/themas-mapping.json, themas leeg) zijn niet
    relevant voor milieubeleid en gaan eruit. Een Kamervraag en haar antwoord gaan samen."""
    try:
        mapping = json.loads((ROOT / "data" / "themas-mapping.json").read_text(encoding="utf-8"))
    except Exception:
        return alle_zaken, stuk_lijst, verzoek_lijst, {}
    leeg = {k for k, v in mapping.items() if isinstance(v, dict) and not v.get("themas")}
    zaken_uit = {i: z for i, z in alle_zaken.items() if f"zaak:{z['nummer']}" not in leeg}
    weg_zaken = {s["zaak"] for s in stuk_lijst if f"stuk:{s['id']}" in leeg and s.get("zaak")
                 and (s["soort"] == "Schriftelijke vragen" or s["soort"].startswith("Antwoord"))}
    stukken_uit = [s for s in stuk_lijst if f"stuk:{s['id']}" not in leeg and s.get("zaak") not in weg_zaken]
    verzoeken_uit = [v for v in verzoek_lijst if f"verzoek:{v['id']}" not in leeg]
    telling = {"zaken": len(alle_zaken) - len(zaken_uit), "stukken": len(stuk_lijst) - len(stukken_uit), "verzoeken": len(verzoek_lijst) - len(verzoeken_uit)}
    log(f"== niet relevant (review zonder thema): {telling}")
    return zaken_uit, stukken_uit, verzoeken_uit, telling


def _dossiers(filter_expr, top=60):
    return odata("Kamerstukdossier", {
        "$filter": f"Verwijderd eq false and {filter_expr}", "$select": "Nummer,Toevoeging,Titel",
        "$orderby": "Nummer desc", "$top": str(top)}, max_pages=1)


def _hoofdnaam(titel):
    """'Vaststelling van de begrotingsstaten van het Ministerie van Klimaat en Groene Groei (XXIII) voor het jaar 2027'
    -> 'Klimaat en Groene Groei'; ook fondsen ('het Klimaat- en Energiefonds')."""
    m = re.search(r"(?:begrotingsstaa?t(?:en)?|slotwet(?: van)?) (?:van )?(?:het |de )?(?:Ministerie van )?(.+?)(?: en het [A-Z][\w-]*fonds)?(?: \(| voor het jaar| \d{4}|$)", titel or "")
    naam = (m.group(1) if m else titel or "").strip()
    return naam[:1].upper() + naam[1:]


def begrotingsstukken():
    """Miljoenennota, begrotingen per hoofdstuk (twee jaren), Belastingplan, Voorjaars- en Najaarsnota en de jaarverslagen,
    met per Kamerstukdossier het hoofddocument (memorie van toelichting, nota of jaarverslag)."""
    hoofdstukken = CONFIG.get("kerndocumenten", {}).get("hoofdstukken", [])
    jaar = date.today().year
    gekozen = []  # (soort, jaar, dossier)
    # begrotingen: de twee nieuwste begrotingsjaren die er al zijn
    jaren = [j for j in (jaar + 1, jaar, jaar - 1) if _dossiers(f"startswith(Titel,'Vaststelling van de begrotingssta') and contains(Titel,'voor het jaar {j}')", 1)][:2]
    for j in jaren:
        rec = _dossiers(f"startswith(Titel,'Vaststelling van de begrotingssta') and contains(Titel,'voor het jaar {j}')")
        for d in rec:
            if d.get("Toevoeging") in hoofdstukken:
                gekozen.append(("begroting", j, d))
        if rec:  # Miljoenennota: zelfde nummer, zonder toevoeging
            gekozen += [("miljoenennota", j, d) for d in _dossiers(f"Nummer eq {rec[0]['Nummer']} and Toevoeging eq null", 1)]
    for soort, prefix in (("belastingplan", "contains(Titel,'(Belastingplan 20')"), ("voorjaarsnota", "startswith(Titel,'Voorjaarsnota')"),
                          ("najaarsnota", "startswith(Titel,'Najaarsnota')")):
        for d in _dossiers(prefix, 2):
            m = re.search(r"(20\d\d)", d.get("Titel") or "")
            gekozen.append((soort, int(m.group(1)) if m else None, d))
    for d in _dossiers("startswith(Titel,'Financieel Jaarverslag van het Rijk') or startswith(Titel,'Financieel jaarverslag van het Rijk')", 1):
        m = re.search(r"(20\d\d)", d.get("Titel") or "")
        j = int(m.group(1)) if m else None
        gekozen.append(("jaarverslag-rijk", j, d))
        for h in _dossiers(f"Nummer eq {d['Nummer']} and Toevoeging ne null"):
            if h.get("Toevoeging") in hoofdstukken:
                gekozen.append(("jaarverslag", j, h))

    # hoofddocumenten: één query per Kamerstuknummer (alle toevoegingen samen)
    docs = {}
    for n in sorted({d["Nummer"] for _, _, d in gekozen}):
        for doc in odata("Document", {
                "$filter": f"Verwijderd eq false and Kamerstukdossier/any(k: k/Nummer eq {n}) and Volgnummer le 3",
                "$select": "Id,DocumentNummer,Soort,Onderwerp,Datum,Volgnummer,ContentType",
                "$expand": "Kamerstukdossier($select=Nummer,Toevoeging),Zaak($select=Nummer)"}, max_pages=3):
            for k in doc.get("Kamerstukdossier") or []:
                docs.setdefault((k.get("Nummer"), k.get("Toevoeging")), []).append(doc)

    def hoofddoc(lijst):
        for s in ("Memorie van toelichting", "Jaarverslag"):
            for d in sorted(lijst, key=lambda x: x.get("Volgnummer") or 9):
                if d.get("Soort") == s and not re.match(r"Bijlage", d.get("Onderwerp") or ""):
                    return d
        return next((d for d in sorted(lijst, key=lambda x: x.get("Volgnummer") or 9) if d.get("Soort") not in ("Koninklijke boodschap", "Voorstel van wet")), None)

    uit = []
    for soort, j, d in gekozen:
        lijst = docs.get((d["Nummer"], d.get("Toevoeging")), [])
        hd = hoofddoc(lijst)
        if not hd:
            continue  # dossier bestaat, maar het stuk is nog niet verschenen
        rk = next((x for x in lijst if x.get("Soort") == "Brief Algemene Rekenkamer"), None)
        uit.append({
            "soort": soort, "jaar": j, "hoofdstuk": d.get("Toevoeging"),
            "naam": _hoofdnaam(d.get("Titel")) if soort in ("begroting", "jaarverslag") else None,
            "nummer": d["Nummer"], "titel": (d.get("Titel") or "").strip(),
            "document": hd["DocumentNummer"], "documentSoort": hd.get("Soort"), "datum": (hd.get("Datum") or "")[:10] or None,
            # zaak, docId en bestand: voor de pagina op tweedekamer.nl (kamerstukken/detail?id=<zaak>&did=<D>) en de documentweergave
            "zaak": next((z.get("Nummer") for z in hd.get("Zaak") or [] if z.get("Nummer")), None),
            "docId": hd.get("Id"), "bestand": bestandssoort(hd.get("ContentType")),
            "rekenkamer": rk["DocumentNummer"] if rk else None,
        })
    return uit


_VERVANGT = re.compile(r"ter vervanging van (?:\w+ )?nr\.? ?(\d+)", re.I)


def markeer_vervangen(zaken_lijst):
    """Een amendement 'ter vervanging van nr. 13' maakt nr. 13 in hetzelfde Kamerstuk overbodig: daar komt geen stemming
    meer over, dus uitslag 'vervangen' in plaats van 'in behandeling'. Geeft het aantal terug."""
    per_nr = {(d["nummer"], z.get("volgnummer")): z for z in zaken_lijst if z["soort"] == "Amendement" for d in z["dossiers"]}
    n = 0
    for z in zaken_lijst:
        m = z["soort"] == "Amendement" and _VERVANGT.search(z.get("onderwerp") or "")
        for d in z["dossiers"] if m else []:
            oud = per_nr.get((d["nummer"], int(m.group(1))))
            if oud and oud is not z and oud["uitslag"] == "in behandeling":
                oud["uitslag"] = "vervangen"
                n += 1
    return n


def wet_debatten(zaken_lijst, batch=5):
    """Plenaire debatten, wetgevings- en notaoverleggen per wetsvoorstel (alle datums en commissies) in z['debatten'],
    voor de fase op Wetgeving: activiteiten.json heeft alleen de huidige Kamerperiode en de gevolgde commissies."""
    wetten = [z for z in zaken_lijst if "wetgeving" in (z["soort"] or "").lower()]
    for i in range(0, len(wetten), batch):
        deel = wetten[i:i + batch]
        ids = " or ".join(f"z/Id eq {z['id']}" for z in deel)
        rec = odata("Activiteit", {
            "$filter": f"Verwijderd eq false and Agendapunt/any(a: a/Zaak/any(z: {ids}))",
            "$select": "Nummer,Soort,Datum,Status",
            "$expand": f"Agendapunt($select=Id;$expand=Zaak($select=Id;$filter={ids.replace('z/', '')}))"}, max_pages=5)
        for z in deel:
            z["debatten"] = sorted(({
                "Nummer": a["Nummer"], "Soort": a["Soort"], "Datum": a["Datum"], "Status": a["Status"],
                "tkLink": f"https://www.tweedekamer.nl/debat_en_vergadering/{'plenaire_vergaderingen/details/activiteit' if a['Soort'].startswith('Plenair') else 'commissievergaderingen/details'}?id={a['Nummer']}",
            } for a in rec if a.get("Datum") and a.get("Status") not in ("Geannuleerd", "Verplaatst")
                and re.match(r"Plenair debat|Wetgevingsoverleg|Notaoverleg", a.get("Soort") or "")
                and any(zz.get("Id") == z["id"] for ap in a.get("Agendapunt") or [] for zz in ap.get("Zaak") or [])),
                key=lambda a: a["Datum"])


def wetstukken(nummers, batch=10):
    """Kamerstukken per wetsvoorstel ({Kamerstuknummer: [stukken op volgnummer]}): wetsvoorstel, memorie van toelichting,
    advies Raad van State, verslag, nota's, brieven. Moties en amendementen niet: die staan als zaak in zaken.json."""
    nummers = sorted(nummers)
    uit = {}
    for i in range(0, len(nummers), batch):
        deel = " or ".join(f"Kamerstukdossier/any(k: k/Nummer eq {n})" for n in nummers[i:i + batch])
        for d in odata("Document", {
                "$filter": f"Verwijderd eq false and ({deel})",
                "$select": "Id,DocumentNummer,Soort,Onderwerp,Datum,Volgnummer,ContentType",
                "$expand": "Kamerstukdossier($select=Nummer),Zaak($select=Nummer,Soort)"}, max_pages=20):
            if re.match(r"Motie|Amendement", d.get("Soort") or "") or d.get("Volgnummer") in (None, -1):
                continue
            zaken_ = d.get("Zaak") or []
            zaak = next((z for z in zaken_ if "wetgeving" in (z.get("Soort") or "").lower()), zaken_[0] if zaken_ else {})
            for k in d.get("Kamerstukdossier") or []:
                if str(k.get("Nummer")) not in nummers:
                    continue
                uit.setdefault(str(k["Nummer"]), []).append({
                    "volgnummer": d["Volgnummer"], "soort": d.get("Soort"),
                    "titel": re.sub(r"\s+", " ", d.get("Onderwerp") or d.get("Soort") or "").strip(),
                    "datum": (d.get("Datum") or "")[:10] or None, "document": d.get("DocumentNummer"),
                    "docId": d.get("Id"), "bestand": bestandssoort(d.get("ContentType")),
                    "link": f"https://www.tweedekamer.nl/kamerstukken/detail?id={zaak.get('Nummer', '')}&did={d.get('DocumentNummer')}",
                })
    return {n: sorted(v, key=lambda x: x["volgnummer"]) for n, v in sorted(uit.items())}


# ---------- Eerste Kamer (officielebekendmakingen.nl, SRU) ----------
SRU = "https://repository.overheid.nl/sru"
SRU_NS = {"sru": "http://docs.oasis-open.org/ns/search-ws/sruResponse", "dcterms": "http://purl.org/dc/terms/",
          "ow": "http://standaarden.overheid.nl/wetgeving/", "gzd": "http://standaarden.overheid.nl/sru"}
EK = 'dt.creator="Eerste Kamer der Staten-Generaal"'
# ministerie uit de titel van een Eerste Kamer-stuk ("... met de minister van KGG ..."); de SRU-gegevens noemen het niet
EK_MINISTERIES = {"KGG": "Klimaat en Groene Groei", "IenW": "Infrastructuur en Waterstaat", "LVVN": "Landbouw, Visserij, Voedselzekerheid en Natuur",
                  "VRO": "Volkshuisvesting en Ruimtelijke Ordening", "BZK": "Binnenlandse Zaken en Koninkrijksrelaties", "EZ": "Economische Zaken",
                  "I&W": "Infrastructuur en Waterstaat", "Financiën": "Financiën", "JenV": "Justitie en Veiligheid",
                  "VWS": "Volksgezondheid, Welzijn en Sport", "BZ": "Buitenlandse Zaken"}


def sru(query):
    """Alle records van een zoekvraag op repository.overheid.nl (1000 per pagina), als platte dicts."""
    uit, start = [], 1
    while True:
        url = SRU + "?" + urllib.parse.urlencode({"operation": "searchRetrieve", "version": "2.0", "maximumRecords": 1000,
                                                  "startRecord": start, "query": "c.product-area==officielepublicaties AND " + query})
        for poging in range(4):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "milieubeleid-checker"}), timeout=60) as r:
                    root = ET.fromstring(r.read())
                break
            except Exception as e:
                log(f"  SRU-fout {e}, opnieuw proberen ({poging + 1})")
                time.sleep(3 * (poging + 1))
        else:
            raise RuntimeError(f"SRU mislukt na 4 pogingen: {query}")
        for rec in root.iterfind(".//sru:record", SRU_NS):
            g = lambda pad: re.sub(r"\s+", " ", rec.findtext(pad, "", SRU_NS)).strip()
            uit.append({"id": g(".//dcterms:identifier"), "titel": g(".//dcterms:title"), "datum": g(".//dcterms:date")[:10] or None,
                        "documenttitel": g(".//ow:documenttitel"), "dossiertitel": g(".//ow:dossiertitel"),
                        "dossier": g(".//ow:dossiernummer"), "behandeld": g(".//ow:behandeldDossier"), "ondernummer": g(".//ow:ondernummer"),
                        "soort": g(".//ow:subrubriek"), "url": g(".//gzd:preferredUrl")})
        volgende = root.findtext("sru:nextRecordPosition", "", SRU_NS)
        if not volgende:
            return uit
        start = int(volgende)


def ek_uniek(records):
    """Alleen Kamerstukken (geen bijlagen), één per Kamerstuk en ondernummer (de nieuwste versie)."""
    per = {}
    for r in sorted(records, key=lambda r: r["datum"] or ""):
        if r["id"].startswith("kst-") and r["dossier"]:
            per[(r["dossier"], r["ondernummer"] or r["id"])] = r
    return list(per.values())


def eerste_kamer(start, wet_nrs, aangenomen, regels):
    """Stukken van de Eerste Kamer. Geeft (stukken, perWet) terug:
    - stukken: brieven en verslagen (bv. schriftelijk overleg) vanaf de startdatum in een gevolgd Kamerstukdossier of met een
      trefwoord in de titel, niet bij een wetsvoorstel; in de vorm van stukken.json (soort Brief regering, kamer Eerste Kamer);
    - perWet: per door de Tweede Kamer aangenomen wetsvoorstel de Eerste Kamer-stukken (A, B, C, ...) en de Staatsblad-publicatie."""
    ds = {str(x) for s in CONFIG["sectoren"].values() if s.get("actief") for x in s.get("stukDossiers", [])}
    ds |= {k for ks, breed, _ in regels.values() for k in ks - breed}
    uit = _regex(CONFIG["stukken"].get("uitsluiten", []))
    stukken = []
    for r in ek_uniek(sru(f'w.publicatienaam==Kamerstuk AND {EK} AND dt.date>={start}')):
        if r["dossier"] in wet_nrs or r["soort"] in ("Motie", "Voorstel van wet") or (uit and uit.search(r["documenttitel"])):
            continue
        sectoren = [c for c, (ks, breed, _) in regels.items() if r["dossier"] in ks - breed] or sectoren_op_trefwoord(schone_tekst(r["titel"]), regels)
        if r["dossier"] in ds and not sectoren:
            sectoren = [c for c, s in CONFIG["sectoren"].items() if r["dossier"] in {str(x) for x in s.get("stukDossiers", [])}]
        if not sectoren:
            continue
        m = re.search(r"\bvan (" + "|".join(map(re.escape, EK_MINISTERIES)) + r")\b", r["documenttitel"])
        stukken.append({"id": r["id"], "kamer": "Eerste Kamer", "soort": "Brief regering", "ekSoort": r["soort"] or None, "datum": r["datum"],
                        "titel": None, "onderwerp": r["documenttitel"] or r["titel"], "zaak": None,
                        "ministerie": EK_MINISTERIES[m[1]] if m else None, "ondertekenaar": None, "functie": None,
                        "kamerstuk": f'{r["dossier"]}-{r["ondernummer"]}' if r["ondernummer"] else r["dossier"],
                        "dossiers": [{"nummer": r["dossier"], "toevoeging": None, "titel": r["dossiertitel"] or None}],
                        "sectoren": sectoren, "link": r["url"]})
    # shortcut: twee zoekvragen per aangenomen wetsvoorstel (nu ~90); bij veel meer: alleen die zonder Staatsblad opnieuw vragen
    per_wet = {}
    for nr in sorted(aangenomen):
        lijst = [{"volgnummer": r["ondernummer"], "soort": r["soort"] or None, "titel": r["documenttitel"] or r["soort"] or "Kamerstuk",
                  "datum": r["datum"], "link": r["url"], "kamer": "Eerste Kamer"}
                 for r in ek_uniek(sru(f"w.dossiernummer=={nr} AND {EK}")) if r["soort"] != "Motie"]
        stb = [r for r in sru(f"w.publicatienaam==Staatsblad AND w.behandeldDossier=={nr}") if r["url"]]
        lijst += [{"volgnummer": None, "soort": "Staatsblad", "titel": r["titel"], "datum": r["datum"], "link": r["url"], "kamer": "Staatsblad"}
                  for r in sorted(stb, key=lambda r: r["datum"] or "")[:1]]
        if lijst:
            per_wet[nr] = sorted(lijst, key=lambda x: x["datum"] or "")
    return stukken, per_wet


def alleen_begrotingen():
    lijst = begrotingsstukken()
    (OUT / "begrotingen.json").write_text(json.dumps(lijst, ensure_ascii=False, indent=1), encoding="utf-8")
    log(f"Klaar: {len(lijst)} begrotingsstukken")


def main():
    start = CONFIG["startdatum"]
    alle_zaken = {}
    alle_act = {}
    regels = sector_regels()
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
                rx_sector = regels[code][2]
                for z in rec:
                    # brede dossiers (Raad VTE: ook telecom; begrotingen): moties en amendementen alleen met een trefwoord
                    if d.get("breed") and z.get("Soort") in ("Motie", "Amendement") and not (rx_sector and rx_sector.search(schone_tekst(z.get("Onderwerp")))):
                        continue
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
                rec = zaken(f"GestartOp ge {start}T00:00:00Z and (contains(Onderwerp,'{t}'))")
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
            rx = _regex(s.get("activiteitTrefwoorden", []))
            if rx:
                rec = [a for a in rec if _act_past(a, rx)]
            for a in rec:
                bestaand = alle_act.get(a.get("Id"))
                if bestaand:
                    bestaand["sectoren"] = sorted(set(bestaand["sectoren"]) | {code})
                else:
                    a["sectoren"] = [code]
                    alle_act[a.get("Id")] = a
            log(f"  {len(rec)} activiteiten")
        except Exception as e:
            FOUTEN.append(f"activiteiten {code}: {e}")
            log(f"    FOUT: {e}")

    # 4. wetsvoorstellen vanaf wetgeving.startdatum, en moties/amendementen buiten de vaste dossiers
    try:
        wet_dossiers = wetsvoorstellen(alle_zaken, regels)
        via = CONFIG.get("motiesViaVergadering") or {}
        rx_niet = _regex(via.get("uitsluiten", []))
        act_sectoren = {a.get("Id"): a.get("sectoren", []) for a in alle_act.values()
                        if a.get("Soort") in via.get("soorten", [])
                        and not (rx_niet and rx_niet.search(a.get("Onderwerp") or ""))}
        breed_zoeken(alle_zaken, regels, wet_dossiers, start, act_sectoren)
    except Exception as e:
        FOUTEN.append(f"wetgeving/brede zoektocht: {e}")
        log(f"    FOUT: {e}")

    # 5. stukken van ministeries
    stuk_lijst = []
    try:
        stuk_lijst = stukken(start)
        log(f"== {len(stuk_lijst)} stukken (brieven, vragen, antwoorden)")
    except Exception as e:
        FOUTEN.append(f"stukken: {e}")
        log(f"    FOUT stukken: {e}")

    # 5a. uitstelberichten bij Kamervragen; mislukt het ophalen, dan blijven die van de vorige run staan
    try:
        uitstel = uitstellen(start)
    except Exception as e:
        FOUTEN.append(f"uitstel Kamervragen: {e}")
        log(f"    FOUT uitstel Kamervragen: {e}")
        uitstel = oude_uitstellen()
    for x in stuk_lijst:
        if x["soort"] == "Schriftelijke vragen" and uitstel.get(x["zaak"]):
            x["uitstel"] = uitstel[x["zaak"]]

    # 5b. commissieverzoeken (in de tabel Kamervragen)
    verzoek_lijst = []
    try:
        verzoek_lijst = commissieverzoeken(start, regels)
        log(f"== {len(verzoek_lijst)} commissieverzoeken")
    except Exception as e:
        FOUTEN.append(f"commissieverzoeken: {e}")
        log(f"    FOUT commissieverzoeken: {e}")

    # 6. toezeggingen bij de gevolgde activiteiten
    tz_lijst = []
    try:
        tz_lijst = toezeggingen(start, {a.get("Nummer") for a in alle_act.values()})
        log(f"== {len(tz_lijst)} toezeggingen")
    except Exception as e:
        FOUTEN.append(f"toezeggingen: {e}")
        log(f"    FOUT toezeggingen: {e}")

    # 6b. stemmingsdatum per motie en amendement (uit de agenda van de plenaire Stemmingen)
    stem_data = None
    try:
        stem_data = stemmingen(start)
        log(f"== stemmingsdatum voor {len(stem_data)} zaken")
    except Exception as e:
        FOUTEN.append(f"stemmingen: {e}")
        log(f"    FOUT stemmingen: {e}")

    # 6c. begrotingsstukken voor de tab Kerndocumenten
    begr = []
    try:
        begr = begrotingsstukken()
        log(f"== {len(begr)} begrotingsstukken")
    except Exception as e:
        FOUTEN.append(f"begrotingen: {e}")
        log(f"    FOUT begrotingen: {e}")

    # 7. wat bij de review "zonder thema" kreeg, is niet relevant en gaat eruit
    alle_zaken, stuk_lijst, verzoek_lijst, uitgesloten = relevantiepoort(alle_zaken, stuk_lijst, verzoek_lijst)
    if stem_data:
        # alleen de moties en amendementen die de checker volgt
        gevolgd = {z["nummer"] for z in alle_zaken.values()}
        stem_data = {n: d for n, d in stem_data.items() if n in gevolgd}

    OUT.mkdir(parents=True, exist_ok=True)
    zaken_lijst = sorted(alle_zaken.values(), key=lambda z: z["gestartOp"] or "", reverse=True)
    log(f"== {markeer_vervangen(zaken_lijst)} amendementen vervangen door een gewijzigde versie")
    try:
        wet_debatten(zaken_lijst)
    except Exception as e:
        FOUTEN.append(f"debatten bij wetsvoorstellen: {e}")
        log(f"    FOUT debatten bij wetsvoorstellen: {e}")
    act_lijst = sorted(alle_act.values(), key=lambda a: a.get("Datum") or "", reverse=True)
    if not zaken_lijst and not act_lijst and FOUTEN:
        log("Niets opgehaald en wel fouten: bestaande data blijft staan.")
        (OUT / "meta.json").write_text(json.dumps({
            "laatstePoging": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "status": "mislukt", "fouten": FOUTEN}, ensure_ascii=False, indent=1), encoding="utf-8")
        sys.exit(1)
    (OUT / "zaken.json").write_text(json.dumps(zaken_lijst, ensure_ascii=False, indent=1), encoding="utf-8")
    if act_lijst:
        (OUT / "activiteiten.json").write_text(json.dumps(act_lijst, ensure_ascii=False, indent=1), encoding="utf-8")
    else:
        log("Geen activiteiten opgehaald: bestaande activiteiten.json blijft staan.")
    # 7a. Eerste Kamer: brieven en verslagen bij de stukken, Eerste Kamer-fase bij de wetsvoorstellen
    wet_nrs = {str(d["nummer"]) for z in zaken_lijst if "wetgeving" in (z["soort"] or "").lower() for d in z["dossiers"]}
    ek_wet = {}
    try:
        aangenomen = {str(d["nummer"]) for z in zaken_lijst if "wetgeving" in (z["soort"] or "").lower() and z.get("uitslag") == "aangenomen" for d in z["dossiers"]}
        ek_stukken, ek_wet = eerste_kamer(start, wet_nrs, aangenomen, regels)
        if stuk_lijst:
            stuk_lijst = sorted(stuk_lijst + ek_stukken, key=lambda x: x["datum"] or "", reverse=True)
        log(f"== Eerste Kamer: {len(ek_stukken)} stukken, {len(ek_wet)} wetsvoorstellen met Eerste Kamer-stukken")
    except Exception as e:
        FOUTEN.append(f"Eerste Kamer: {e}")
        log(f"    FOUT Eerste Kamer: {e}")
    if stuk_lijst:
        (OUT / "stukken.json").write_text(json.dumps(stuk_lijst, ensure_ascii=False, indent=1), encoding="utf-8")
    if verzoek_lijst:
        (OUT / "verzoeken.json").write_text(json.dumps(verzoek_lijst, ensure_ascii=False, indent=1), encoding="utf-8")
    if stem_data:
        (OUT / "stemmingen.json").write_text(json.dumps(stem_data, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")
    if begr:
        (OUT / "begrotingen.json").write_text(json.dumps(begr, ensure_ascii=False, indent=1), encoding="utf-8")
    # 7b. Kamerstukken per gevolgd wetsvoorstel (Wetgeving, uitgeklapte rij)
    try:
        ws = wetstukken(wet_nrs)
        for nr, lijst in ek_wet.items():
            ws.setdefault(nr, []).extend(lijst)
        if ws:
            (OUT / "wetstukken.json").write_text(json.dumps(ws, ensure_ascii=False, indent=1), encoding="utf-8")
        log(f"== Kamerstukken voor {len(ws)} wetsvoorstellen")
    except Exception as e:
        FOUTEN.append(f"wetstukken: {e}")
        log(f"    FOUT wetstukken: {e}")
    # 8. de tekst van moties en amendementen (data/tk/teksten.json; zie pipeline/teksten.py)
    teksten_telling = None
    try:
        import teksten
        teksten_telling = teksten.bijwerken(zaken_lijst)
    except Exception as e:
        FOUTEN.append(f"teksten: {e}")
        log(f"    FOUT teksten: {e}")
    if tz_lijst:
        (OUT / "toezeggingen.json").write_text(json.dumps(tz_lijst, ensure_ascii=False, indent=1), encoding="utf-8")
    (OUT / "meta.json").write_text(json.dumps({
        "bijgewerkt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "status": "ok" if not FOUTEN else "gedeeltelijk",
        "aantalZaken": len(zaken_lijst),
        "aantalActiviteiten": len(act_lijst),
        "aantalStukken": len(stuk_lijst),
        "aantalVerzoeken": len(verzoek_lijst),
        "aantalToezeggingen": len(tz_lijst),
        "uitgesloten": uitgesloten,
        "teksten": teksten_telling,
        "fouten": FOUTEN,
        "bron": "Tweede Kamer open data (gegevensmagazijn.tweedekamer.nl); Eerste Kamer en Staatsblad via officielebekendmakingen.nl",
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    log(f"Klaar: {len(zaken_lijst)} zaken, {len(act_lijst)} activiteiten, {len(FOUTEN)} fouten")


def alleen_toezeggingen():
    acts = json.loads((OUT / "activiteiten.json").read_text(encoding="utf-8"))
    tz = toezeggingen(CONFIG["startdatum"], {a.get("Nummer") for a in acts})
    (OUT / "toezeggingen.json").write_text(json.dumps(tz, ensure_ascii=False, indent=1), encoding="utf-8")
    meta = json.loads((OUT / "meta.json").read_text(encoding="utf-8"))
    meta["aantalToezeggingen"] = len(tz)
    (OUT / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    log(f"Klaar: {len(tz)} toezeggingen")


if __name__ == "__main__":
    if "--toezeggingen" in sys.argv:
        alleen_toezeggingen()
    elif "--begrotingen" in sys.argv:
        alleen_begrotingen()
    elif "--teksten" in sys.argv:
        import teksten
        teksten.bijwerken(json.loads((OUT / "zaken.json").read_text(encoding="utf-8")))
    else:
        main()
