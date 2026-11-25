# MilieuRadar (repo milieubeleid-checker)

Eigenaar: Tobias. Een neutraal, actueel overzicht van Nederlands milieubeleid in de Tweede Kamer.
Statische site zonder build-stap (`index.html`, `assets/`), gevoed door een Python-pipeline
over de open data van de Tweede Kamer. GitHub Pages publiceert `main`.

<kritiek>
- Alle inhoud op de site is Nederlands. Alle fracties krijgen gelijk gewicht; neutraal, geen eigen oordeel.
- Geen gedachtestreepjes (em dashes) in teksten; gebruik haakjes of puntkomma's.
- Alleen desktop: ontwerp en controleer niets voor telefoonbreedte.
- Alleen Chrome: test en controleer alleen in Chrome (Tobias, 19 nov 2026); niet in Safari of Firefox.
- Elke wijziging aan het uiterlijk volgt `DESIGN.md`; dat gaat voor alles, ook voor skills.
- Nieuwe onderdelen bouw je direct met de maten, lettertypes en klassen uit DESIGN.md, "Standard sizes" (Tobias, 24 nov 2026);
  kies niets op het oog. Staat het er niet in: neem de rij die er het meest op lijkt, of vraag het en leg het antwoord daar vast.
  Vraagt Tobias een andere maat, pas dan de rij in die tabel aan en voer hem door op alle plekken met hetzelfde onderdeel.
- Kleur is wit, donkergroen, zwart (Tobias, 24 nov 2026; DESIGN.md, "Colour"): wit is inhoud, zwart is tekst en lijn,
  bosgroen (`--accent`) is kop, actie of "hier ben je", rood (`--alarm`) is alleen aandacht. Geen lichtgroen, geen grijze vlakken, geen nieuwe kleuren of tokens zonder te vragen.
- Zet niets terug wat Tobias heeft laten weghalen (zie "Bewust weg" onder Grenzen) zonder te vragen.
- Selectie te ruim of te krap: pas `pipeline/config.json` aan, nooit de data in `data/tk/`.
- Prioriteit: de wijziging van de Klimaatwet na de Klimaatzaak Bonaire. Zolang het wetsvoorstel
  geen Kamerstuknummer heeft, staan de mijlpalen alleen in `data/agenda.json`.
</kritiek>

Meer detail, automatisch geladen in de submap:
- `pipeline/CLAUDE.md`: welke data de pipeline ophaalt en waarom (sectoren, moties, stukken, teksten).
- `assets/CLAUDE.md`: pagina's, routes, tabellen en hun functies in `app.js`.

Naslag (lees bij de taak):
- `agent_docs/samenvatten.md`: debatten samenvatten met gehoord.de en het formaat van `data/debatten.json`.
- `agent_docs/uitstoot-grafiek.md`: het blok "Wat Nederland uitstoot" (`assets/milieu.js`).
- `agent_docs/zoekfunctie.md`: zoekindex en resultatenpagina (`assets/zoek.js`).
- `agent_docs/elk-uur.md`: hoe cron-job.org de Action elk uur start.
- `agent_docs/rapporten.md`: criteria en werkwijze voor de pagina Rapporten en de kolom "Rapport?" op Kamerbrieven.

## Commando's

| Doel | Commando |
|---|---|
| Kamerdata ophalen (geen AI) | `python3 pipeline/fetch_tk.py` |
| Alleen teksten van moties en amendementen | `python3 pipeline/fetch_tk.py --teksten` |
| Alleen rapporten herkennen aan de inhoud van bijlagen | `python3 pipeline/fetch_tk.py --rapporten` |
| Alleen toezeggingen | `python3 pipeline/fetch_tk.py --toezeggingen` |
| Kandidaten: brieven bij openstaande toezeggingen | `python3 pipeline/toezeggingbrieven.py <vanaf JJJJ-MM-DD>` |
| Alleen begrotingen (Kerndocumenten) | `python3 pipeline/fetch_tk.py --begrotingen` |
| Agendafeed `data/agenda.ics` | `python3 pipeline/maak_ics.py` |
| Thema's in het `<noscript>`-blok van `index.html` | `node pipeline/themas_noscript.js` |
| Versies `?v=<hash>` in `index.html` (na elke wijziging in `assets/`) | `node pipeline/versie.js` |
| Zoektest | `node tests/zoektest.js` |
| Ontwerptest (maten, letters, kleuren volgens DESIGN.md) | `node tests/ontwerptest.js` |
| Test selectie commissieverzoeken en rapporten | `python3 tests/verzoektest.py` |
| Themareview: CSV met nieuwe items | `node pipeline/themas_review.js --nieuw` |
| Themareview: nagekeken CSV in de mapping | `node pipeline/themas_review.js --import <csv>` |
| Site lokaal (poort 8765) | `preview_start` met naam `site` (`.claude/launch.json`) |

De Action `.github/workflows/update.yml` draait op werkdagen elk uur van 8 tot 19 (gestart door cron-job.org, zie `agent_docs/elk-uur.md`; GitHub-schema 05:17 en 17:17 UTC als vangnet) `fetch_tk.py`,
`maak_ics.py`, `themas_noscript.js` en `versie.js`, en commit `data/tk`, `data/agenda.ics` en `index.html`.
`fetch_tk.py` heeft `pypdf` nodig (voorlopige teksten uit pdf).

## Architectuur

| Pad | Wat | Wie schrijft |
|---|---|---|
| `pipeline/fetch_tk.py` | Haalt activiteiten, zaken, stukken, stemmingen, toezeggingen, begrotingen op; Eerste Kamer-stukken en Staatsblad via officielebekendmakingen.nl (SRU) | script |
| `pipeline/teksten.py` | Teksten van moties en amendementen (draait in `fetch_tk.py`) | script |
| `pipeline/config.json` | Sectoren, trefwoorden, dossiers, in- en uitsluitingen | Claude/Tobias |
| `data/tk/*.json` | `activiteiten`, `zaken`, `stukken`, `stemmingen`, `teksten`, `toezeggingen`, `begrotingen`, `wetstukken`, `verzoeken`, `rapportcheck`, `meta` | alleen script |
| `data/debatten.json` | Samenvattingen van debatten | Claude |
| `data/agenda.json` | Mijlpalen, consultaties, deadlines (met bron-URL) | Claude |
| `data/kerndocumenten.json` | Handmatige kerndocumenten (reeksen met edities) | Claude |
| `data/rapporten.json` | Beoordeling van rapportkandidaten (bijlagen bij Kamerbrieven): ja met uitgever, of nee met reden | Claude |
| `data/gehoord.json` | Debat op gehoord.de per activiteitnummer (link in de uitgeklapte agenda) | Claude |
| `data/toezeggingen.json` | Brief bij een toezegging die in het register nog openstaat | Claude |
| `data/themas.json` | Trefwoordregels voor thema's | Claude/Tobias |
| `data/themas-mapping.json` | Goedgekeurde thema per item (uit de review) | review-script |
| `data/zoeksynoniemen.json` | Synoniemen en afkortingen voor zoeken | Claude |
| `assets/app.js` | Router en alle pagina's | |
| `assets/themas.js` | `THEMAS`, thematoekenning, `MRThemas.bronItems`, `tkUrl`, `kerndocumenten()` | |
| `assets/zoek.js` | Zoekindex (MiniSearch) | |
| `assets/milieu.js` | Grafiek "Wat Nederland uitstoot" | |
| `assets/style.css` | Ontwerpknoppen (tokens) bovenaan | |
| `assets/vendor/` | MiniSearch, pdf.js, docx-preview, JSZip (niet wijzigen) | |
| `data/dossiers.json` | Wordt niet meer gelezen (zie Grenzen) | |

## Werk de checker bij

Bij "werk de checker bij" (of "werk MilieuRadar bij"):

1. `git pull`, dan `python3 pipeline/fetch_tk.py` en `python3 pipeline/maak_ics.py`. Controleer `data/tk/meta.json` op fouten.
2. Zoek nieuwe debatten: activiteiten met Status `Uitgevoerd` (relevante soorten) in `data/tk/activiteiten.json`
   die nog niet in `data/debatten.json` staan (koppeling op datum + soort). Sla procedurevergaderingen over.
3. Vat elk nieuw relevant debat samen volgens `agent_docs/samenvatten.md`. Staan er veel open, meld dan aan Tobias hoeveel.
   Zet elk nieuw debat (ook van vandaag) dat niet wordt samengevat met zijn nummer op gehoord.de in `data/gehoord.json`: `search_debates` op datum, koppel op titel,
   zaal en tijd; bij twijfel of minder dan 5 fragmenten niet.
   Beoordeel nieuwe rapportkandidaten (bijlagen met `rapport: true` die nog niet in `data/rapporten.json` staan) volgens `agent_docs/rapporten.md`.
   Draai `python3 pipeline/toezeggingbrieven.py <datum van bijgewerkt in data/toezeggingen.json>`, lees de kandidaten en zet alleen
   zekere koppelingen (de brief noemt de toezegging of het debat en levert precies wat is toegezegd) in `data/toezeggingen.json`;
   een aankondiging of gedeeltelijk antwoord telt niet.
4. Werk `data/agenda.json` bij bij nieuwe mijlpalen, consultaties of deadlines (met bron-URL; zoek bij twijfel
   op eerstekamer.nl, internetconsultatie.nl, officielebekendmakingen.nl).
   - Zet bij elke wijziging `bijgewerkt` bovenin het gewijzigde bestand (ISO, UTC, bv. `2026-11-12T15:49:00Z`).
     De kop van de site toont het nieuwste tijdstip van alle bestanden in Nederlandse tijd.
   - Nieuwe editie van een kerndocument (Prinsjesdag: Troonrede, KEN, KEV, MEV, Deltaprogramma; Voorjaarsnota;
     Verantwoordingsdag: Monitor Brede Welvaart): item toevoegen aan `data/kerndocumenten.json` met dezelfde `reeks`.
     Begrotingsstukken niet: die haalt `fetch_tk.py` zelf op.
   - Nieuwe KEV (september) of nieuwe ERL: werk `assets/milieu.js` bij (zie `agent_docs/uitstoot-grafiek.md`).
5. Controleer: JSON-validiteit, `node tests/zoektest.js`, de site lokaal met een screenshot;
   `node pipeline/versie.js` als er iets in `assets/` is gewijzigd.
6. Commit en push naar `main`.

## Codestijl

- Vanilla JS zonder build-stap of framework; SVG zonder grafiekbibliotheek. Python 3.12 met de standaardbibliotheek (plus `pypdf`).
- Elk JS-bestand zit in een wrapper met lokale helpers (`const esc = (s) => …`). Hergebruik die; app.js heeft een eigen `esc`.
- Lijstpagina's volgen één tabelpatroon (`tabelPagina()`/`bindTabel()` met een definitie per pagina); filters, zoekterm
  en volgorde staan in de URL. Zie `assets/CLAUDE.md` en DESIGN.md, "Tables".
- Ontwerpwaarden alleen als tokens uit `assets/style.css`; geen inline `style=""`.
- Links naar documenten gaan naar tweedekamer.nl (`MRThemas.tkUrl`), nooit naar `downloads/document` (dat slaat het bestand op).
- Teksten op de site: datums als `11 nov 2026`, cijfers in Nederlandse notatie (DESIGN.md, regel 7).

## Grenzen

**Altijd**
- Schrijf toe aan de spreker ("volgens PRO") wat geen geverifieerd feit is.
- Controleer elke URL voordat je hem toevoegt aan `data/agenda.json` of `data/kerndocumenten.json`.
- Draai `node pipeline/versie.js` en `node tests/ontwerptest.js` voor elke commit die iets in `assets/` wijzigt.
- Commit en push naar `main` na elke afgeronde, gecontroleerde wijziging, zonder te vragen, tenzij Tobias anders zegt.
  Neem `.Rhistory` en `.claude/` niet mee.
- Vindt Tobias iets niet dat er wel is: voeg een synoniem toe in `data/zoeksynoniemen.json` en/of een regel in `tests/zoektest.js`.

**Eerst vragen**
- Iets uit "Bewust weg" terugzetten.
- De tekst van `OV_INTRO` in `assets/app.js` herschrijven (tekst van Tobias).
- Een nieuwe dependency, ook in `assets/vendor/`.
- Een transcript samenvatten van een minder relevant debat (kost 30k tot 60k tokens).

**Bewust weg** (op verzoek van Tobias; data blijft soms bestaan)
- Dossiers (sinds 13 nov 2026): geen dossierfilters, -labels of -kaarten, ook niet op Wetgeving. Geen `dossiers`-veld
  in samenvattingen. "Kamerstuk" (bv. `36169`) is geen dossier in deze zin en blijft overal staan; de pagina per
  wetsvoorstel (`#wetgeving/<Kamerstuk>`, sinds 19 nov 2026, op verzoek) is dus geen dossierpagina.
- Pagina's Toezeggingen en Per fractie, de abonneerknop van de agendafeed, de algemene sectorfilter.
- Op Overzicht: CO2-band, kerncijfers, Aandachtsdossier, Laatste samenvattingen, planetaire grenzen, Recente stemmingen
  en Nieuwste stukken als losse blokken (met `fetch_milieu.py`). Zie `agent_docs/uitstoot-grafiek.md` voor wat de grafiek bewust weglaat.
- Introteksten en ondertitels boven tabellen en op Agenda (ondertitels weer weg sinds 23 nov 2026); tellingen en introtekst op `#themas`.
- Lichtgroen, overal (sinds 24 nov 2026).
- Grijze vlakken en het roze vlak onder de uitstootlijn (sinds 23 nov 2026).
- Het label "Nieuw" op `#themas` (sinds 23 nov 2026).
- De knop "Eerdere vergaderingen" op Agenda (sinds 23 nov 2026).
- De labels "Sluit over n dagen", "Stemming vandaag" en "Gesloten" op Agenda en in Komt eraan (sinds 24 nov 2026).
- Kerndocumenten in de groep "Europese Unie" (`"verborgen": true`) en EU-documenten in het algemeen: komt later.

**Vermijden**
- Handmatig bewerken van `data/tk/` (wordt elke run overschreven).
- Kleur of icoon per thema, sector of categorie (DESIGN.md).
- `graphify section` (crasht op deze graaf met een KeyError).

## Valkuilen

- Debatten van vóór april 2026 staan niet op gehoord.de en kunnen niet worden samengevat.
- Sleutels in de CBS-tabellen zijn soms met spaties opgevuld: filter met `startswith(...)`, niet met `eq`.
- De Titel van een motie in de TK-data is de titel van het dossier; zoektermen kijken daarom alleen naar het onderwerp.
- graphify kent alleen `function`-declaraties: helpers als `const esc = …` (138 in app.js, ook in zoek.js, themas.js,
  milieu.js) staan niet in de graaf. Zoek die met grep. Verbanden van app.js naar `esc()` in `themas_noscript.js`
  of `maak_ics.py` zijn daardoor fout.
- Zie je een wijziging niet op de site: eerst hard herladen (Cmd+Shift+R); controleer of `versie.js` is gedraaid.
- `themas-review*.csv` en `graphify-out/` staan niet in git.

## Skills to use

Use these installed skills whenever the situation fits. You don't need to be asked.

### ponytail: default for all coding work
- Use ponytail (full level) for every coding task: writing, fixing, refactoring and choosing dependencies.
- Make the smallest change that fully solves the task. Reuse what's already in the codebase, then the standard library, then dependencies already installed, before writing anything new.
- Mark any deliberate shortcut with a `shortcut:` comment that says when to come back to it.
- Before you say a change is done, run `/ponytail-review` on the diff.
- When asked to review the whole repo or find bloat, use `/ponytail-audit`.
- When asked what was put off for later, use `/ponytail-debt`.

### graphify: understand the codebase before searching it
- If `graphify-out/` exists, answer questions about architecture, how files relate, or "where is X" from the graph first (`graphify query`, `graphify path A B`, `graphify explain X`), before you grep or read many files.
- If `graphify-out/` doesn't exist and the task needs a wide understanding of the codebase, offer to run `/graphify .` first.
- After big structural changes (new modules, moved files), offer to rebuild the graph.
- In deze repo (`graphify-out/graph.json`; code in assets/*.js, pipeline/, tests/, de Action, plus CLAUDE.md, DESIGN.md,
  README.md en index.html; niet `data/tk/`, `assets/vendor/`, `data/debatten.json`, `data/themas-mapping.json`, `data/dossiers.json`):
  - Code: eerst `graphify query "<vraag>"`, dan alleen de aangewezen regels lezen. Verband: `graphify path "A" "B"`;
    één begrip: `graphify explain "motieKoppeling"`.
  - Regels uit CLAUDE.md of DESIGN.md: `graphify query` geeft bestand en regel; lees dan alleen dat stuk met Read en offset.
  - Inhoud van de data (welke moties, welke debatten): niet de graaf, maar de JSON (`python3 -c` of `jq`).
  - `graphify-out/GRAPH_REPORT.md` alleen voor een breed overzicht.
  - Bijwerken: de git-hooks werken de code in de graaf na elke commit, merge en checkout bij (gratis). Binnen een sessie
    na codewijzigingen: `graphify update .`. Na wijzigingen in CLAUDE.md, DESIGN.md, README.md of index.html:
    `/graphify --update` (kost tokens). Een volledige herbouw is daarom zelden nodig.

### taste-skill: any frontend or web design work
- Use `taste-skill:design-taste-frontend` whenever you build, redesign, restyle or polish a page or UI, or when a page looks generic or "AI-made".
- Follow its checker and finish gate before handing over UI work.
- In deze repo gaat `DESIGN.md` voor: gebruik de skill als controle, niet voor zijn esthetiek (geen foto's, hero-animaties,
  shader-effecten of marketingopbouw). Spreken ze elkaar tegen, volg dan DESIGN.md.

### find-skills: when a task needs abilities I don't have
- If a task needs specialized knowledge that none of the skills above cover, use find-skills to look for an existing skill. Suggest it to me with its install count and source, and don't install anything without my OK.

## Over-engineering voorkomen

- Geen build-stap, bundler, framework, TypeScript of testframework toevoegen; `tests/zoektest.js` draait met kale `node`.
- Een nieuwe pagina met een lijst is een nieuwe definitie voor `tabelPagina()`, geen eigen tabelcode.
- Nieuwe selectieregels horen in `pipeline/config.json` als data, niet als uitzondering in de code.
- Geen configuratie-opties of abstracties "voor later"; DESIGN.md, "Known duplication" noemt wat ooit samengevoegd mag worden.
