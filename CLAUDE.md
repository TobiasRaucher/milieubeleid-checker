# Werkwijze voor Claude: MilieuRadar (repo milieubeleid-checker)

Eigenaar: Tobias. Doel: een neutraal, actueel overzicht van Nederlands milieubeleid in het parlement. Alle inhoud op de site is **Nederlands**; alle fracties krijgen gelijk gewicht. Geen gedachtestreepjes (em dashes) in teksten; gebruik haakjes of puntkomma's.

## Bij "werk de checker bij" (of "werk MilieuRadar bij")

1. `git pull`, dan `python3 pipeline/fetch_tk.py` (Tweede Kamer open data; geen AI). Controleer `data/tk/meta.json` op fouten.
2. Zoek nieuwe debatten: vergelijk `data/tk/activiteiten.json` (Status `Uitgevoerd`, relevante soorten) met `data/debatten.json` (koppeling op datum + soort). Sla procedurevergaderingen over.
3. Vat elk nieuw relevant debat samen met de POLITIEK-connector (gehoord.de):
   - `search_debates` (op titel/datum) → `get_debate` → `get_transcript` (pagina's via offset).
   - Bespaar tokens: sla grote transcripten op in een bestand en lees per spreker de inbreng in eerste termijn, de antwoorden van de bewindspersoon en het slot (voorzitter leest toezeggingen voor).
   - Format: zie bestaande items in `data/debatten.json`:
     - `activiteit`: het TK-activiteitnummer (bv. `2026A00908`). Daarmee haalt de site automatisch de commissie, de link naar tweedekamer.nl, de agendapunten met stukken en de deelnemers uit `data/tk/activiteiten.json`. Niet zelf overtypen.
     - `video`: de Debat Direct-link (staat bij `get_debate` als "Bron").
     - `aanzet`: 1 tot 3 zinnen over waarom het debat werd gehouden (afleiden uit de agendapunten en de context).
     - `gist`: 3 tot 5 zinnen; wordt op de site getoond als "Kern".
     - `samenvatting`: `partijen` (elke fractie die sprak, met spreker en segment-link), `kabinet`, `toezeggingen` (zoals voorgelezen), `doorgeleid`, `moties`, `vervolg`. `kern` (lijst) alleen voor extra punten die niet in de gist staan, vooral bij briefings.
     - Bij technische briefings en rondetafelgesprekken: `deskundigen` (naam + organisatie), want die staan niet in de TK-data.
   - Schrijf toe aan de spreker ("volgens PRO") wat niet geverifieerd feit is. Neutraal, geen eigen oordeel.
   - Technische briefings en rondetafelgesprekken: deskundigen in `kern`, vragen van Kamerleden in `partijen`.
   - `dossiers`: lijst van dossier-id's waar het debat over gaat. De site koppelt debatten en agenda-items ook automatisch aan dossiers (via Kamerstukdossiers van de agendapunten en zoektermen; zie `beleidsdossiers` en `kamerstukken`/`zoektermen` in `data/dossiers.json`). Vul `dossiers` alleen aan als de automatische koppeling iets mist, bv. een wetsdossier dat in het debat ter sprake kwam.
4. Werk `data/dossiers.json` en `data/agenda.json` bij als er nieuwe stappen, consultaties of deadlines zijn (met bron-URL). Zoek bij twijfel op internet (eerstekamer.nl, internetconsultatie.nl, officielebekendmakingen.nl).
   - Zet bij elke wijziging het veld `bijgewerkt` bovenin het gewijzigde bestand op het huidige tijdstip (ISO, UTC, bv. `2026-11-12T15:49:00Z`). De kop van de site toont het meest recente tijdstip van alle bestanden als "Bijgewerkt hh:mm, dd/mm/yyyy" (Nederlandse tijd).
5. Render de site lokaal (`python3 -m http.server`) en bekijk een screenshot; controleer JSON-validiteit en draai `node tests/zoektest.js`.
6. Commit en push naar `main` (GitHub Pages publiceert automatisch).

## Samenvattingen: niveaus en meerdere sessies

- Centrale debatten krijgen een volledige samenvatting (partijen, kabinet, toezeggingen, moties). Minder centrale debatten, briefings en tweeminutendebatten mogen kort: zet `"niveau": "kort"`, schrijf `aanzet` en een uitgebreidere `gist` (met de belangrijkste uitkomsten) en laat `partijen` leeg. De site toont dan het label "kort".
- Hoort een samenvatting bij meer dan één TK-activiteit (bv. technische briefing plus rondetafelgesprek, of een debat met voortzetting), zet de extra activiteitnummers in `extraActiviteiten`. Die activiteiten tellen dan als samengevat.
- Zet `sector` op de sector van het debat (`klimaat-energie`, `water-adaptatie`, `natuur-stikstof-landbouw`, `circulair-vervuiling`, `ruimte-mobiliteit`). Sectoren bepalen welke data de pipeline ophaalt; op de site worden thema's gebruikt (zie hieronder).
- Debatten van vóór april 2026 staan niet op gehoord.de en kunnen niet worden samengevat.

## Sectoren en stukken van ministeries

- Sectoren staan in `pipeline/config.json`. Per sector: `commissies` (activiteiten), `activiteitTrefwoorden` (alleen activiteiten met zo'n woord in het onderwerp; nodig voor brede commissies als I&W en LVVN), `kamerstukdossiers` en `zoektermen` (moties en wetgeving), `stukDossiers` en `trefwoorden` (stukken van ministeries).
- `data/tk/stukken.json` bevat Kamerbrieven en antwoorden op Kamervragen van alle ministeries die bij een sector horen (KGG altijd). Te ruime of te krappe selectie? Pas `stukDossiers`/`trefwoorden` of `stukken.uitsluiten` aan in de config, niet de data.

## Dossiers

- `dossiers` in `data/dossiers.json` zijn wetsvoorstellen (met fase-stepper op de Wetgeving-pagina). `kortTitel` is het label in filters.
- `beleidsdossiers` zijn thema's (bv. Elektriciteitsnet & netcongestie). Ze hebben geen fase; ze dienen om debatten en agenda te filteren en te groeperen.
- Nieuw wetsvoorstel volgen: voeg het Kamerstuknummer toe aan `pipeline/config.json` (voor moties en amendementen) en een dossier aan `data/dossiers.json` (fase, laatste/volgende stap, bronnen). Controleer de status op eerstekamer.nl.

## Prioriteit

Dossier `klimaatwet-bonaire` (wijziging Klimaatwet na Klimaatzaak Bonaire) is het aandachtsdossier.

## Kosten

Een transcript van een commissiedebat kost ongeveer 30k tot 60k tokens. Vat alleen nieuwe, relevante debatten samen; meld aan Tobias hoeveel er openstaan als het er veel zijn.

## Thema's en pagina's

- Thema's staan in `data/themas.json` (id, naam, kleur, trefwoorden als reguliere expressies, en `terugval` per sector). `assets/themas.js` kent ze toe: titel telt altijd, agendapunten pas bij twee treffers. Thema's mogen meervoudig zijn.
- Tabs: Overzicht, Agenda, Wetgeving, Moties, Vergaderingen, Stukken, Over. `#debatten` blijft werken als alias voor `#vergaderingen`.
- Vergaderingen: filters (type, commissie, ministerie, thema, dossier; meerdere waarden per filter), samenvatting ja/nee, groeperen en ordenen. De filters staan in de URL (bv. `#vergaderingen?thema=adaptatie&groep=commissie`), dus deelbaar.
- Agenda: tijdlijn per week en dag, opent bij vandaag; "Eerder laden" gaat per 4 weken terug tot de start van de Kamerperiode. `#agenda?dossier=<id>` filtert op dossier.
- Toezeggingen (`#toezeggingen`, subtab van Vergaderingen): uit het toezeggingenregister van de Kamer (`data/tk/toezeggingen.json`, door de pipeline opgehaald; alleen bij gevolgde activiteiten plus ministeries in `toezeggingen.altijdMinisteries`). Voor samengevatte vergaderingen zonder registratie toont de site de toezeggingen uit de samenvatting. Los bijwerken: `python3 pipeline/fetch_tk.py --toezeggingen`.
- To-do (Tobias, nov 2026): eigen themafilter op Wetgeving, Moties, Stukken en Agenda; de algemene sectorfilter is verwijderd.

## Ontwerp

- Huisstijl (nov 2026): "milieuradar" in kleine letters, DM Sans, groene merkkleur, rood als alarmkleur (vandaag, eerstvolgend), alleen licht thema. Alle kleuren en vormen staan als ontwerpknoppen bovenaan `assets/style.css`; sectorkleuren als `--s-<sectorcode>` (gelijke helderheid en verzadiging).
- Het vooruitzicht-blok op Overzicht is een placeholder; Tobias beslist later of het een echte functie wordt.

## Zoekfunctie

- `assets/zoek.js` bouwt in de browser een index (MiniSearch, `assets/vendor/`) over debatten, dossiers, moties en amendementen, stukken en Kameractiviteiten. Nederlandse stamvorming, synoniemen, tikfoutcorrectie en titelweging staan daar beschreven.
- Synoniemen en afkortingen: `data/zoeksynoniemen.json`. Vindt Tobias iets niet terwijl het er wel is, voeg dan een synoniem toe en/of een regel aan `tests/zoektest.js`, en draai de test.

