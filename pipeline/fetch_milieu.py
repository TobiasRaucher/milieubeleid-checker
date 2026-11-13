#!/usr/bin/env python3
"""
Haalt de milieu-indicatoren voor de Overzicht-pagina op en schrijft ze naar data/milieu/.

- Geen AI nodig, geen API-sleutel nodig.
- Wordt gedraaid door de GitHub Action (.github/workflows/update.yml),
  of lokaal:  python3 pipeline/fetch_milieu.py

Wat er wordt opgehaald:
  * CO2-concentratie op Mauna Loa (NOAA Global Monitoring Laboratory), daggemiddelden.
    Het bronbestand is groot (ruim 400 kB, alles sinds 1974); de site krijgt alleen
    het laatste jaar plus de waarde van een jaar eerder (data/milieu/co2.json).
  * Planetaire grenzen (Datahub, dataset climate-and-environment/planetary-boundaries).
    Het CSV-bestand wordt ongewijzigd opgeslagen (data/milieu/planetaire-grenzen.csv).
    Waarom niet rechtstreeks in de browser: de vaste Datahub-link stuurt door zonder
    CORS-kop, en browsers weigeren dat. Nederlandse namen en correcties staan in
    data/planetaire-grenzen.json (handmatig bijgehouden).

De emissiecijfers van het CBS (tabel 85668NED) haalt de browser zelf op; die API staat
verzoeken van andere sites toe.

Mislukt een bron, dan blijft het vorige bestand staan en komt er een melding in
data/milieu/meta.json. Het script stopt dan niet met een fout, zodat de rest van de
Action doorloopt.
"""
import csv
import io
import json
import sys
import time
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "milieu"

NOAA_DAG = "https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_daily_mlo.csv"
NOAA_PAGINA = "https://gml.noaa.gov/ccgg/trends/"
GRENZEN_CSV = "https://datahub.io/climate-and-environment/planetary-boundaries/_r/-/data/boundaries.csv"
GRENZEN_PAGINA = "https://datahub.io/climate-and-environment/planetary-boundaries"
GRENZEN_KOLOMMEN = {"id", "name", "unit", "boundary_value", "boundary_direction", "current_value", "current_year", "boundary_exceeded"}


def haal(url, pogingen=3):
    laatste = None
    for i in range(pogingen):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "milieuradar (github.com/TobiasRaucher/milieubeleid-checker)"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8")
        except Exception as e:  # netwerkfout of serverfout: even wachten en opnieuw
            laatste = e
            time.sleep(3 * (i + 1))
    raise RuntimeError(f"{url}: {laatste}")


def co2():
    tekst = haal(NOAA_DAG)
    reeks = []
    for regel in tekst.splitlines():
        if not regel.strip() or regel.startswith("#"):
            continue
        delen = [d.strip() for d in regel.split(",")]
        if len(delen) < 5:
            continue
        try:
            j, m, d, ppm = int(delen[0]), int(delen[1]), int(delen[2]), float(delen[4])
        except ValueError:
            continue  # kopregel of onleesbare regel
        if ppm <= 0:
            continue  # ontbrekende meting
        reeks.append((date(j, m, d), ppm))
    if len(reeks) < 365:
        raise RuntimeError(f"NOAA: te weinig metingen ({len(reeks)})")
    reeks.sort()
    laatste_dag, laatste_ppm = reeks[-1]
    # waarde van een jaar eerder: de meting die het dichtst bij dezelfde dag ligt (max. 7 dagen ernaast)
    doel = laatste_dag - timedelta(days=365)
    kandidaten = [(abs((d - doel).days), d, p) for d, p in reeks if abs((d - doel).days) <= 7]
    jaar = min(kandidaten) if kandidaten else None
    begin = laatste_dag - timedelta(days=400)
    return {
        "bron": "NOAA Global Monitoring Laboratory, Mauna Loa (Hawaii)",
        "bronUrl": NOAA_PAGINA,
        "dataUrl": NOAA_DAG,
        "eenheid": "ppm",
        "toelichting": "Daggemiddelden; de laatste maanden zijn voorlopig.",
        "laatste": {"datum": laatste_dag.isoformat(), "ppm": laatste_ppm},
        "jaarGeleden": {"datum": jaar[1].isoformat(), "ppm": jaar[2]} if jaar else None,
        "reeks": [[d.isoformat(), p] for d, p in reeks if d >= begin],
    }


def grenzen():
    tekst = haal(GRENZEN_CSV)
    rijen = list(csv.DictReader(io.StringIO(tekst)))
    if not rijen or not GRENZEN_KOLOMMEN.issubset(rijen[0].keys()):
        raise RuntimeError("Datahub: onverwachte kolommen in boundaries.csv")
    if len(rijen) < 9:
        raise RuntimeError(f"Datahub: te weinig rijen ({len(rijen)})")
    return tekst


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    nu = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    meta_pad = OUT / "meta.json"
    meta = json.loads(meta_pad.read_text(encoding="utf-8")) if meta_pad.exists() else {}
    meta["fouten"] = []

    try:
        c = co2()
        c["bijgewerkt"] = nu
        (OUT / "co2.json").write_text(json.dumps(c, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        meta["co2"] = {"bijgewerkt": nu, "laatsteMeting": c["laatste"]["datum"]}
        print(f"CO2: {c['laatste']['ppm']} ppm op {c['laatste']['datum']}")
    except Exception as e:
        meta["fouten"].append(f"CO2 (NOAA): {e}")
        print("FOUT CO2:", e, file=sys.stderr)

    try:
        t = grenzen()
        (OUT / "planetaire-grenzen.csv").write_text(t, encoding="utf-8")
        meta["grenzen"] = {"bijgewerkt": nu, "bron": GRENZEN_PAGINA, "dataUrl": GRENZEN_CSV}
        print("Planetaire grenzen: opgeslagen")
    except Exception as e:
        meta["fouten"].append(f"Planetaire grenzen (Datahub): {e}")
        print("FOUT grenzen:", e, file=sys.stderr)

    meta["bijgewerkt"] = nu
    meta_pad.write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
