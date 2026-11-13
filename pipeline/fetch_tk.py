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
    of bij een gevolgd wetsvoorstel
  * daarna gaan items die bij de themareview bewust geen thema kregen eruit (data/themas-mapping.json)
  * activiteiten (debatten, rondetafelgesprekken, briefings) van de opgegeven commissies
    (bij sectoren met activiteitTrefwoorden alleen activiteiten waarvan het onderwerp een
    trefwoord bevat)
  * stukken van ministeries (Kamerbrieven, antwoorden op Kamervragen) die volgens
    stukDossiers/trefwoorden bij een sector horen; zie "stukken" in config.json
  * toezeggingen uit het toezeggingenregister van de Kamer die bij een gevolgde activiteit horen
    (plus alle toezeggingen van de ministeries in toezeggingen.altijdMinisteries)

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
    "Document($filter=Verwijderd eq false;$select=DocumentNummer,Soort,Datum),"
    "ZaakActor($filter=Verwijderd eq false),"
    "Kamerstukdossier($select=Nummer,Toevoeging,Titel),"
    "Besluit($filter=Verwijderd eq false;$expand=Stemming($filter=Verwijderd eq false),"
    "Agendapunt($select=Id;$expand=Activiteit($select=Datum,Soort,Onderwerp)))"
)
EXPAND_SIMPEL = (
    "Document($filter=Verwijderd eq false;$select=DocumentNummer,Soort,Datum),"
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


STUK_EXPAND = ("DocumentActor($select=ActorNaam,ActorFractie,Functie,Relatie),"
               "Kamerstukdossier($select=Nummer,Toevoeging,Titel),"
               "Zaak($select=Nummer,Soort;$expand=ZaakActor($select=ActorNaam,Functie,Relatie))")


def ministerie_uit_functie(functie):
    m = re.sub(r"^(minister-president|minister|staatssecretaris)\b( voor| van)?\s*", "", functie or "", flags=re.I)
    return m or None


def stukken(start):
    cfg = CONFIG.get("stukken") or {}
    soort = " or ".join(f"Soort eq '{s}'" for s in cfg.get("soorten", ["Brief regering"]))
    params = {"$filter": f"Verwijderd eq false and ({soort}) and Datum ge {start}T00:00:00Z",
              "$select": "Id,Soort,DocumentNummer,Titel,Onderwerp,Datum,Volgnummer",
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
            sectoren = sectoren_op_trefwoord(f"{z.get('Titel') or ''} {z.get('Citeertitel') or ''}", regels)
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


def breed_zoeken(alle_zaken, regels, wet_dossiers, start):
    """Alle moties en amendementen vanaf de startdatum: binnen als het onderwerp een trefwoord van een sector heeft,
    of als ze bij een gevolgd wetsvoorstel horen (amendementen en moties bij de behandeling)."""
    uit = {str(x) for x in (CONFIG.get("wetgeving") or {}).get("uitsluiten", [])}
    ruw = odata("Zaak", {
        "$filter": f"Verwijderd eq false and (Soort eq 'Motie' or Soort eq 'Amendement') and GestartOp ge {start}T00:00:00Z",
        "$select": LICHT_SELECT, "$expand": "Kamerstukdossier($select=Nummer,Toevoeging)",
    }, max_pages=200)
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
        if sectoren:
            gekozen[z["Id"]] = sectoren
    for z in zaken_op_id(list(gekozen)):
        nz = normaliseer_zaak(z, gekozen[z["Id"]][0])
        nz["sectoren"] = sorted(gekozen[z["Id"]])
        alle_zaken[nz["id"]] = nz
    log(f"== moties en amendementen: {len(ruw)} bekeken, {len(gekozen)} erbij")


def relevantiepoort(alle_zaken, stuk_lijst):
    """Items die bij de themareview bewust geen thema kregen (data/themas-mapping.json, themas leeg) zijn niet
    relevant voor milieubeleid en gaan eruit. Een Kamervraag en haar antwoord gaan samen."""
    try:
        mapping = json.loads((ROOT / "data" / "themas-mapping.json").read_text(encoding="utf-8"))
    except Exception:
        return alle_zaken, stuk_lijst, {}
    leeg = {k for k, v in mapping.items() if isinstance(v, dict) and not v.get("themas")}
    zaken_uit = {i: z for i, z in alle_zaken.items() if f"zaak:{z['nummer']}" not in leeg}
    weg_zaken = {s["zaak"] for s in stuk_lijst if f"stuk:{s['id']}" in leeg and s.get("zaak")
                 and (s["soort"] == "Schriftelijke vragen" or s["soort"].startswith("Antwoord"))}
    stukken_uit = [s for s in stuk_lijst if f"stuk:{s['id']}" not in leeg and s.get("zaak") not in weg_zaken]
    telling = {"zaken": len(alle_zaken) - len(zaken_uit), "stukken": len(stuk_lijst) - len(stukken_uit)}
    log(f"== niet relevant (review zonder thema): {telling}")
    return zaken_uit, stukken_uit, telling


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
        breed_zoeken(alle_zaken, regels, wet_dossiers, start)
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

    # 6. toezeggingen bij de gevolgde activiteiten
    tz_lijst = []
    try:
        tz_lijst = toezeggingen(start, {a.get("Nummer") for a in alle_act.values()})
        log(f"== {len(tz_lijst)} toezeggingen")
    except Exception as e:
        FOUTEN.append(f"toezeggingen: {e}")
        log(f"    FOUT toezeggingen: {e}")

    # 7. wat bij de review "zonder thema" kreeg, is niet relevant en gaat eruit
    alle_zaken, stuk_lijst, uitgesloten = relevantiepoort(alle_zaken, stuk_lijst)

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
    if stuk_lijst:
        (OUT / "stukken.json").write_text(json.dumps(stuk_lijst, ensure_ascii=False, indent=1), encoding="utf-8")
    if tz_lijst:
        (OUT / "toezeggingen.json").write_text(json.dumps(tz_lijst, ensure_ascii=False, indent=1), encoding="utf-8")
    (OUT / "meta.json").write_text(json.dumps({
        "bijgewerkt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "status": "ok" if not FOUTEN else "gedeeltelijk",
        "aantalZaken": len(zaken_lijst),
        "aantalActiviteiten": len(act_lijst),
        "aantalStukken": len(stuk_lijst),
        "aantalToezeggingen": len(tz_lijst),
        "uitgesloten": uitgesloten,
        "fouten": FOUTEN,
        "bron": "Tweede Kamer open data (gegevensmagazijn.tweedekamer.nl)",
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
    else:
        main()
