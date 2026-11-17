# Debatten samenvatten (`data/debatten.json`)

Stap 3 van "werk de checker bij". Een transcript van een commissiedebat kost ongeveer 30k tot 60k tokens: vat alleen
nieuwe, relevante debatten samen en meld aan Tobias hoeveel er openstaan als het er veel zijn. Debatten van vóór
april 2026 staan niet op gehoord.de.

## Werkwijze (POLITIEK-connector, gehoord.de)

1. `search_debates` (op titel/datum) → `get_debate` → `get_transcript` (pagina's via offset).
2. Bespaar tokens: sla grote transcripten op in een bestand en lees per spreker de inbreng in eerste termijn, de
   antwoorden van de bewindspersoon en het slot (de voorzitter leest de toezeggingen voor).
3. Schrijf toe aan de spreker ("volgens PRO") wat geen geverifieerd feit is. Neutraal, geen eigen oordeel.

## Velden (zie bestaande items in `data/debatten.json`)

| Veld | Inhoud |
|---|---|
| `activiteit` | TK-activiteitnummer (bv. `2026A00908`). De site haalt daarmee commissie, link, agendapunten met stukken en deelnemers uit `data/tk/activiteiten.json`. Niet zelf overtypen. |
| `extraActiviteiten` | Extra activiteitnummers als de samenvatting bij meer dan één activiteit hoort (briefing plus rondetafelgesprek, debat met voortzetting). Die tellen dan als samengevat. |
| `video` | Debat Direct-link (bij `get_debate` als "Bron"). |
| `sector` | `klimaat-energie`, `water-adaptatie`, `natuur-stikstof-landbouw`, `circulair-vervuiling` of `ruimte-mobiliteit`. |
| `aanzet` | 1 tot 3 zinnen over waarom het debat werd gehouden (uit de agendapunten en de context). |
| `gist` | 3 tot 5 zinnen; op de site "Kern". |
| `samenvatting.partijen` | Elke fractie die sprak, met spreker en segment-link. |
| `samenvatting.kabinet`, `toezeggingen` (zoals voorgelezen), `doorgeleid`, `moties`, `vervolg` | |
| `samenvatting.kern` | Lijst, alleen voor extra punten die niet in de gist staan, vooral bij briefings. |
| `deskundigen` | Bij technische briefings en rondetafelgesprekken: naam + organisatie (staan niet in de TK-data). |
| `niveau` | `"kort"` voor minder centrale debatten (zie hieronder). |
| `themas` | Optioneel; gaat voor de trefwoordregels (zie `assets/CLAUDE.md`, Thema's). |

Geen `dossiers`-veld meer invullen.

## Niveaus

- Centrale debatten: volledige samenvatting (partijen, kabinet, toezeggingen, moties).
- Minder centrale debatten, briefings en tweeminutendebatten mogen kort: `"niveau": "kort"`, met `aanzet` en een
  uitgebreidere `gist` (met de belangrijkste uitkomsten), `partijen` leeg. De site toont dan het label "kort".
- Technische briefings en rondetafelgesprekken: deskundigen in `kern`, vragen van Kamerleden in `partijen`.

Zet `bijgewerkt` bovenin `data/debatten.json` op het huidige tijdstip (ISO, UTC).
