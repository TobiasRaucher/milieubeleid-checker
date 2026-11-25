# MilieuRadar

Een overzicht van Nederlands milieu- en klimaatbeleid in de Tweede Kamer: de fase van wetsvoorstellen, moties en amendementen met de stemming per fractie, samenvattingen van debatten en de agenda.

**Website:** https://tobiasraucher.github.io/milieubeleid-checker/

Gestart met **Klimaat & energie** (focus: de Klimaatwet). Water & adaptatie, natuur/stikstof/landbouw en circulaire economie volgen.

## Hoe het werkt

| Onderdeel | Wie/wat | Bestanden |
|---|---|---|
| Wetsvoorstellen, moties, amendementen, stemmingen, activiteiten, Kamerbrieven en Kamervragen | Script, automatisch, zonder AI (Tweede Kamer open data) | `pipeline/fetch_tk.py` → `data/tk/` |
| Debatsamenvattingen (kort + gestructureerd) | Claude, op basis van transcripten van gehoord.de | `data/debatten.json` |
| Mijlpalen en deadlines | Claude | `data/agenda.json` |
| Website | Statische pagina, geen build-stap | `index.html`, `assets/` |

## Schema

Groen met een doorgetrokken lijn gaat automatisch; wit met een stippellijn gebeurt pas na een opdracht van Tobias.

```mermaid
flowchart TD
  subgraph AUTO["Automatisch, zonder AI"]
    CRON["cron-job.org: elk uur<br/>vangnet: GitHub-schema"] --> ACT["GitHub Action update.yml"]
    TK["Open data Tweede Kamer"] --> FETCH["fetch_tk.py"]
    OB["officielebekendmakingen.nl<br/>Eerste Kamer, Staatsblad"] --> FETCH
    ACT --> FETCH
    FETCH --> TKDATA["data/tk/*.json"]
    TKDATA --> ICS["maak_ics.py: data/agenda.ics"]
    TKDATA --> NOS["themas_noscript.js en versie.js:<br/>index.html"]
  end
  subgraph HAND["Na opdracht"]
    TOB["Tobias: werk de checker bij"] --> CL["Claude: leest en beoordeelt"]
    GEH["gehoord.de"] --> CL
    CL --> DEB["debatten.json, gehoord.json"]
    CL --> RAP["rapporten.json, toezeggingen.json"]
    CL --> AG["agenda.json, kerndocumenten.json"]
    CL --> REV["themas_review.js: CSV"]
    REV --> NAK["Tobias kijkt de CSV na"]
    NAK --> MAP["themas-mapping.json"]
    CFG["config.json: wat telt als milieubeleid"]
  end
  TKDATA -. "nieuwe debatten, brieven, bijlagen" .-> CL
  CFG -. "selectie" .-> FETCH
  MAP -. "zonder thema: weg van de site" .-> FETCH
  MAIN["main: GitHub Pages"]
  TKDATA --> MAIN
  ICS --> MAIN
  NOS --> MAIN
  DEB --> MAIN
  RAP --> MAIN
  AG --> MAIN
  MAP --> MAIN
  MAIN --> SITE["MilieuRadar in de browser"]
  CBS["CBS open data: uitstoot"] --> SITE
  classDef auto fill:#1f4d3a,stroke:#000,color:#fff
  classDef hand fill:#fff,stroke:#000,color:#000,stroke-dasharray:5 4
  class CRON,ACT,TK,OB,FETCH,TKDATA,ICS,NOS,MAIN,SITE,CBS auto
  class TOB,CL,GEH,DEB,RAP,AG,REV,NAK,MAP,CFG hand
```

## Bijwerken

- **Kamerdata (gratis, geen AI):** GitHub → tabblad *Actions* → *Data bijwerken (Tweede Kamer open data)* → *Run workflow*. De Action draait op werkdagen elk uur van 8 tot 19 (cron-job.org), met als vangnet het GitHub-schema van 05:17 en 17:17 UTC (`schedule` in `.github/workflows/update.yml`).
- **Samenvattingen en mijlpalen:** vraag Claude in het project "Checker Dutch Government Environmental Policy": *"Werk de checker bij"*. Claude haalt de nieuwste data op, vat nieuwe debatten samen en pusht naar deze repo. De werkwijze staat in `CLAUDE.md`.

## Uitbreiden naar een nieuwe sector

Zet in `pipeline/config.json` de sector op `"actief": true` en vul `commissies`, `kamerstukdossiers` en `zoektermen` in.

## Kanttekeningen

- Transcripten van gehoord.de zijn automatisch en niet door mensen gecorrigeerd. Samenvattingen zijn een hulpmiddel, geen officiële bron: citeer de Handelingen.
- Uitslagen en stemmen komen rechtstreeks uit de open data van de Tweede Kamer.
- De Eerste Kamer heeft geen vergelijkbare open data; EK-stappen worden handmatig bijgehouden als mijlpalen in `data/agenda.json`.
