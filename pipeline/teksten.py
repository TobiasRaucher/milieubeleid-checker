#!/usr/bin/env python3
"""
De tekst van moties en amendementen, voor de uitgeklapte rij op de site (data/tk/teksten.json).

Bron, in deze volgorde:
  1. officielebekendmakingen.nl (XML van het Kamerstuk kst-<dossier>[-<toevoeging>]-<volgnummer>):
     de officiële, gestructureerde tekst. Verschijnt een paar dagen na het indienen.
  2. Zolang die er niet is: de tekst uit het pdf- of Word-bestand in de open data van de Tweede Kamer
     (gegevensmagazijn, Document/<Id>/resource; pdf met pypdf). Op de site "voorlopige tekst";
     in de data heet die bron "pdf" (ook bij een Word-bestand).

Incrementeel: een tekst uit bron 1 blijft staan; een tekst uit bron 2 wordt bij elke run opnieuw
geprobeerd bij bron 1. Wordt gedraaid door fetch_tk.py; los:  python3 pipeline/teksten.py

Formaat: {zaaknummer: {"bron": "ob"|"pdf", "document": D-nummer, "blokken": [[soort, tekst], ...]}}
met soort "p" (alinea), "kop" (tussenkop, bv. Toelichting) of "wijz" (een wijziging in een amendement).
"""
import io
import json
import re
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "tk" / "teksten.json"
RESOURCE = "https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0/Document/{}/resource"
OB_XML = "https://zoek.officielebekendmakingen.nl/{}.xml"
UA = {"User-Agent": "milieubeleid-checker"}


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def _get(url, timeout=40):
    for poging in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (403, 404, 410):
                return None
            time.sleep(2 * (poging + 1))
        except Exception:
            time.sleep(2 * (poging + 1))
    return None


def _schoon(t):
    return re.sub(r"\s+", " ", t or "").strip()


def ob_id(z):
    """Kamerstuknummer op officielebekendmakingen.nl, bv. kst-36947-43 of kst-37020-XIV-23."""
    ds = z.get("dossiers") or []
    if not ds or not z.get("volgnummer"):
        return None
    d = ds[0]
    return f"kst-{d['nummer']}{'-' + d['toevoeging'] if d.get('toevoeging') else ''}-{z['volgnummer']}"


def _tekst(el):
    return _schoon("".join(el.itertext()))


def uit_xml(data):
    """Alinea's van de motie of het amendement, zonder kop, ondertekening en namen."""
    try:
        root = ET.fromstring(data)
    except ET.ParseError:
        return None
    stuk = root.find(".//stuk")
    if stuk is None:
        return None
    blokken = []

    def loop(el):
        for kind in el:
            tag = kind.tag
            if tag in ("stuknr", "titel", "datumtekst", "tekst-sluiting", "ondertekening", "noot"):
                continue
            if tag == "al-groep":
                # onder een motie: de namen van de indieners (korte regels zonder punt); anders gewone alinea's
                regels = [_tekst(a) for a in kind.iter("al")]
                if all(len(x.split()) <= 4 and not x.endswith((".", ";", ":")) for x in regels):
                    continue
            if tag == "kop":
                t = _tekst(kind)
                if t:
                    blokken.append(["kop", t])
            elif tag == "al":
                t = _tekst(kind)
                if t:
                    blokken.append(["p", t])
            elif tag == "wat":
                t = _tekst(kind)
                if t:
                    blokken.append(["wijz", t])
            elif tag == "lidnr":
                continue
            elif tag in ("li",):
                t = _tekst(kind)
                if t:
                    blokken.append(["p", t])
            else:
                loop(kind)

    loop(stuk)
    return _zonder_namen(blokken) or None


def _zonder_namen(blokken):
    """Na "en gaat over tot de orde van de dag" staan alleen de namen van de indieners."""
    eind = next((i for i, (_, x) in enumerate(blokken) if x.lower().startswith("en gaat over tot de orde")), None)
    return blokken[:eind + 1] if eind is not None else blokken


START = re.compile(r"(De Kamer,|De ondergetekende|Ondergetekenden?\b)", re.I)
NIEUW = re.compile(r"^(gehoord|overwegende|constaterende|van mening|verzoekt|spreekt|roept|draagt|wijst|besluit|"
                   r"en gaat over|voorts|tevens)\b", re.I)
KOP = re.compile(r"^(Toelichting|[IVXL]+|ARTIKEL [IVXL0-9]+[a-z]*)$")


def _blokken(alineas):
    """Van alinea's (uit pdf of docx) naar blokken: vanaf "De Kamer," of "De ondergetekende", zonder de namen aan het eind."""
    alineas = [_schoon(a) for a in alineas]
    alineas = [a for a in alineas if a]
    begin = next((i for i, x in enumerate(alineas) if START.search(x)), None)
    if begin is None:
        return None
    alineas[begin] = alineas[begin][START.search(alineas[begin]).start():]
    alineas = alineas[begin:]
    # na "en gaat over tot de orde van de dag" komen alleen de namen van de indieners
    eind = next((i for i, x in enumerate(alineas) if x.lower().startswith("en gaat over tot de orde")), None)
    if eind is not None:
        alineas = alineas[:eind + 1]
    else:  # amendement: korte regels zonder punt aan het eind zijn de ondertekenaars
        while alineas and len(alineas[-1].split()) <= 4 and not alineas[-1].endswith((".", ";", ":")):
            alineas.pop()
    blokken = []
    for a in alineas:
        if KOP.match(a):
            blokken.append(["kop", a])
        elif NIEUW.match(a):
            # pdf's en docx'en van moties schrijven Overwegende, Verzoekt enz. met een hoofdletter
            blokken.append(["p", a[0].lower() + a[1:]])
        else:
            blokken.append(["p", a])
    return blokken if goed_genoeg(blokken) else None


DICTUM = re.compile(r"^(verzoekt|spreekt|roept|draagt|wijst|besluit)", re.I)


def goed_genoeg(blokken):
    """Tekst uit een pdf of docx alleen gebruiken als de vaste opbouw herkenbaar is; anders (bv. een scan) liever niets."""
    if not blokken:
        return False
    teksten = [x for _, x in blokken]
    if teksten[0].startswith("De Kamer"):  # motie
        return any(DICTUM.match(x) for x in teksten) and teksten[-1].lower().startswith("en gaat over tot de orde")
    return any(s == "kop" and x == "Toelichting" for s, x in blokken)  # amendement


def uit_pdf(data):
    """Tekst uit het pdf-bestand van de Kamer; alinea's zo goed als het gaat terug in elkaar gezet."""
    try:
        import pypdf
    except ImportError:
        return None
    try:
        r = pypdf.PdfReader(io.BytesIO(data))
        regels = [x.strip() for p in r.pages for x in (p.extract_text() or "").splitlines()]
    except Exception:
        return None
    alineas = []
    for x in (x for x in regels if x):
        vorige = alineas[-1] if alineas else ""
        if (not alineas or KOP.match(x) or KOP.match(vorige) or START.search(x)
                or (vorige.endswith((";", ",", ":", ".")) and (NIEUW.match(x) or x[:1].isupper()))):
            alineas.append(x)
        else:
            alineas[-1] = f"{vorige} {x}"
    return _blokken(alineas)


def uit_docx(data):
    """Alinea's uit een Word-bestand (zonder extra bibliotheek: word/document.xml)."""
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            root = ET.fromstring(zf.read("word/document.xml"))
    except Exception:
        return None
    w = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    alineas = ["".join(t.text or "" for t in p.iter(w + "t")) for p in root.iter(w + "p")]
    return _blokken(alineas)


def ophalen(z, oud):
    obid = ob_id(z)
    if obid:
        data = _get(OB_XML.format(obid))
        if data:
            bl = uit_xml(data)
            if bl:
                return {"bron": "ob", "document": z.get("document"), "kamerstuk": obid[4:], "blokken": bl}
    if oud and oud.get("bron") == "pdf" and oud.get("document") == z.get("document"):
        return oud  # pdf niet opnieuw downloaden
    lees = {"PDF": uit_pdf, "DOCX": uit_docx}.get(z.get("bestand"))
    if z.get("docId") and lees:
        data = _get(RESOURCE.format(z["docId"]), timeout=60)
        if data:
            bl = lees(data)
            if bl:
                return {"bron": "pdf", "document": z.get("document"), "blokken": bl}
    return oud


def bijwerken(zaken_lijst, max_nieuw=None):
    try:
        bestaand = json.loads(OUT.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        bestaand = {}
    doel = [z for z in zaken_lijst if z.get("soort") in ("Motie", "Amendement")]
    uit, werk = {}, []
    for z in doel:
        oud = bestaand.get(z["nummer"])
        if oud and oud.get("bron") == "ob" and oud.get("document") == z.get("document"):
            uit[z["nummer"]] = oud
        else:
            werk.append((z, oud))
    if max_nieuw is not None:
        werk = werk[:max_nieuw]
    log(f"== teksten: {len(uit)} bekend, {len(werk)} ophalen")
    with ThreadPoolExecutor(max_workers=6) as pool:
        for z, res in zip([w[0] for w in werk], pool.map(lambda w: ophalen(*w), werk)):
            if res:
                uit[z["nummer"]] = res
    tellen = {"ob": 0, "pdf": 0}
    for v in uit.values():
        tellen[v["bron"]] = tellen.get(v["bron"], 0) + 1
    log(f"   {tellen['ob']} officieel, {tellen['pdf']} uit pdf, {len(doel) - len(uit)} zonder tekst")
    OUT.write_text(json.dumps(dict(sorted(uit.items())), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return tellen


if __name__ == "__main__":
    zaken = json.loads((ROOT / "data" / "tk" / "zaken.json").read_text(encoding="utf-8"))
    bijwerken(zaken)
