#!/usr/bin/env python3
"""Zoekt brieven die een openstaande toezegging lijken na te komen; print kandidaten om te lezen, wijzigt niets.

Een kandidaat is een brief van na de toezegging die het woord toezegging/toegezegd gebruikt, en die het TZ-nummer
of de datum van het debat noemt. Claude leest de kandidaten en zet zekere koppelingen in data/toezeggingen.json.
  python3 pipeline/toezeggingbrieven.py [vanaf JJJJ-MM-DD]
"""
import io
import json
import re
import sys
import zipfile
from concurrent.futures import ThreadPoolExecutor

import fetch_tk
import teksten

MAAND = "januari februari maart april mei juni juli augustus september oktober november december".split()
BELOOFD = re.compile(r"toezeg|toegezegd|zegde\b[^.]{0,200}\btoe\b", re.I)


def tekst(stuk):
    try:
        data = teksten._get(teksten.RESOURCE.format(stuk["docId"]))
        if data[:2] == b"PK":
            xml = zipfile.ZipFile(io.BytesIO(data)).read("word/document.xml").decode("utf-8")
            t = re.sub(r"<[^>]+>", "", xml.replace("</w:p>", "\n"))
        else:
            import pypdf
            t = "\n".join(p.extract_text() or "" for p in pypdf.PdfReader(io.BytesIO(data)).pages)
        return re.sub(r"\s+", " ", t.replace("–", "-"))  # TZ202604–084 komt ook voor
    except Exception as e:
        fetch_tk.log(f"  {stuk['id']}: niet gelezen ({e})")
        return ""


def main():
    vanaf = sys.argv[1] if len(sys.argv) > 1 else "0000"
    lees = lambda p: json.loads((fetch_tk.OUT / p).read_text(encoding="utf-8"))
    dag = {a["Nummer"]: (a.get("Datum") or "")[:10] for a in lees("activiteiten.json")}
    bekend = json.loads((fetch_tk.OUT.parent / "toezeggingen.json").read_text(encoding="utf-8"))["brieven"]
    open_tz = [t for t in lees("toezeggingen.json") if t["status"] == "Openstaand" and t["nummer"] not in bekend]
    brieven = [s for s in lees("stukken.json") if s["soort"].startswith("Brief") and s.get("docId") and s["datum"] >= vanaf]
    with ThreadPoolExecutor(8) as pool:
        for s, t in zip(brieven, pool.map(tekst, brieven)):
            if not BELOOFD.search(t):
                continue
            for tz in open_tz:
                d = dag.get(tz["activiteit"]) or tz["datum"]
                if s["datum"] < d:
                    continue
                j, m, dd = d.split("-")
                patroon = rf"\b{int(dd)} {MAAND[int(m) - 1]}\b(?! (?!{j})\d{{4}})|{re.escape(tz['nummer'])}"
                citaten = []
                for x in re.finditer(patroon, t, re.I):
                    stuk = t[max(0, x.start() - 300):x.end() + 300]
                    if BELOOFD.search(stuk):
                        citaten.append(stuk)
                if citaten:
                    print(json.dumps({"tz": tz["nummer"], "tekst": tz["tekst"], "debat": d, "brief": s["id"], "datum": s["datum"],
                                      "onderwerp": s["onderwerp"], "citaten": citaten[:3]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
