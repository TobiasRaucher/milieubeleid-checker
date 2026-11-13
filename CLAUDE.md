# Werkwijze voor Claude: MilieuRadar (repo milieubeleid-checker)

Eigenaar: Tobias. Doel: een neutraal, actueel overzicht van Nederlands milieubeleid in het parlement. Alle inhoud op de site is **Nederlands**; alle fracties krijgen gelijk gewicht. Geen gedachtestreepjes (em dashes) in teksten; gebruik haakjes of puntkomma's.

## Bij "werk de checker bij" (of "werk MilieuRadar bij")

1. `git pull`, dan `python3 pipeline/fetch_tk.py` (Tweede Kamer open data; geen AI) en `python3 pipeline/maak_ics.py` (agendafeed `data/agenda.ics`). Controleer `data/tk/meta.json` op fouten.
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
- Agendafeed: `pipeline/maak_ics.py` schrijft `data/agenda.ics` (geplande en recente activiteiten plus mijlpalen met vaste datum); de Action draait hem na de data-update. Abonneerknop op de Agenda-pagina.
- Toezeggingen (`#toezeggingen`, subtab van Vergaderingen): uit het toezeggingenregister van de Kamer (`data/tk/toezeggingen.json`, door de pipeline opgehaald; alleen bij gevolgde activiteiten plus ministeries in `toezeggingen.altijdMinisteries`). Voor samengevatte vergaderingen zonder registratie toont de site de toezeggingen uit de samenvatting. Los bijwerken: `python3 pipeline/fetch_tk.py --toezeggingen`.
- Per fractie (`#fracties`, subtab van Vergaderingen): inbreng uit samenvattingen, ingediende moties en amendementen (eerste indiener) en stemgedrag, alfabetisch en voor alle fracties gelijk opgebouwd. GroenLinks-PvdA telt mee bij PRO (alias in `FRACTIE_ALIAS` in app.js).
- Moties bij vergaderingen: gekoppeld op datum (dag zelf of dag ervoor) plus Kamerstukdossier op de agenda; tweeminutendebat "X (CD d/m)" aan commissiedebat X.
- To-do (Tobias, nov 2026): eigen themafilter op Wetgeving, Moties, Stukken en Agenda; de algemene sectorfilter is verwijderd.

## Ontwerp

- Huisstijl (nov 2026): "milieuradar" in kleine letters, DM Sans, groene merkkleur, rood als alarmkleur (vandaag, eerstvolgend), alleen licht thema. Alle kleuren en vormen staan als ontwerpknoppen bovenaan `assets/style.css`; sectorkleuren als `--s-<sectorcode>` (gelijke helderheid en verzadiging).
- Verfijning volgens Apple-ontwerpprincipes (nov 2026):
  - directe feedback bij indrukken (`--duur-druk`);
  - kritisch gedempte "veer" voor beweging (`--veer`, `--duur-veer`), zonder doorschieten;
  - doorschijnende kop met een rand die pas verschijnt als er inhoud onder schuift;
  - popovers die vanuit hun knop verschijnen;
  - vloeiend uitklappen van samenvattingen;
  - tracking en regelafstand per tekstgrootte;
  - ondersteuning voor minder beweging, minder transparantie en meer contrast.

- Tweede verfijningsronde (nov 2026):
  - tab-aanduiding die van tab naar tab glijdt (`.tab-glij`, gezet in `zetGlij()` in app.js);
  - paginatitel (eerste `h2` van een pagina) duidelijk groter dan sectiekoppen;
  - lopende tekst nooit breder dan `--leesbreedte`; brede schermen worden benut met twee kolommen (dossierkaart: tekst links, stand van zaken rechts; samenvatting: inhoud links, agendapunten en deelnemers rechts);
  - tabelkop blijft staan onder de vaste paginakop (`--kop-h` wordt door app.js gezet); motierijen tonen een pijltje en klappen uit; op de telefoon is de motietabel een lijst van blokjes;
  - een klik op een tab begint bovenaan, terug/vooruit in de browser herstelt de scrollpositie;
  - sneltoets `/` voor zoeken, knop "terug naar boven", laadskelet in `index.html` en een foutmelding als de data niet laadt;
  - lijsttitels (`.ltitel`) in inktkleur met onderstreping bij aanwijzen; externe links krijgen een pijltje.

  Houd nieuwe onderdelen in die lijn.

## Milieu-indicatoren op Overzicht (nov 2026)

- Bovenaan Overzicht staat de CO2-band; onder de kerncijfers staan "Uitstoot naar de lucht in Nederland" en "Planetaire grenzen". Code: `assets/milieu.js` (vanilla JS, lijngrafieken als SVG, geen bibliotheek).
- CO2: `pipeline/fetch_milieu.py` haalt de daggemiddelden van Mauna Loa (NOAA GML, `co2_daily_mlo.csv`) op en schrijft het laatste jaar naar `data/milieu/co2.json`. Draait in de dagelijkse Action. Het is een daggemiddelde met een of twee dagen vertraging, geen live meting.
- Uitstoot: de browser haalt CBS-tabel 85668NED rechtstreeks op (OData, CORS toegestaan). Stoffen: CO2 `A044109`, CH4 `A044107`, NH3 `A044111`, NOx `A044112`, PM2.5 `A051771`; totaal van alle bronnen `T001176`. Die sleutel is in de API met spaties opgevuld, dus filter met `startswith(...)`, niet met `eq`. Dit zijn feitelijke emissies op Nederlands grondgebied, niet de IPCC-cijfers waarmee het Klimaatwet-doel wordt gemeten; die toelichting staat op de site en moet blijven staan.
- Planetaire grenzen: `fetch_milieu.py` kopieert het Datahub-CSV ongewijzigd naar `data/milieu/planetaire-grenzen.csv` (de vaste Datahub-link stuurt door zonder CORS-kop, dus de browser kan hem niet zelf ophalen). Nederlandse namen en correcties staan in `data/planetaire-grenzen.json`. De site bepaalt "overschreden" zelf uit `boundary_direction`; de kolommen `boundary_zone_lower/upper` worden niet gebruikt, want die kloppen niet met de wetenschappelijke onzekerheidszones.
- Correctie oceaanverzuring: Datahub gebruikt nog 2,75 (Richardson e.a. 2023); de Planetary Health Check 2025 hanteert 2,86 (overschreden, 7 van 9); de editie 2026 (september 2026) bevestigt 7 van 9. De correctie wordt alleen toegepast zolang Datahub een andere waarde heeft. Controleer bij elke nieuwe Planetary Health Check (jaarlijks rond september) of de correcties nog kloppen.
- Mislukt een bron in de pipeline, dan blijft het oude bestand staan en staat de melding in `data/milieu/meta.json`.

## Zoekfunctie

- `assets/zoek.js` bouwt in de browser een index (MiniSearch, `assets/vendor/`) over debatten, dossiers, moties en amendementen, stukken en Kameractiviteiten. Nederlandse stamvorming, synoniemen, tikfoutcorrectie en titelweging staan daar beschreven.
- Synoniemen en afkortingen: `data/zoeksynoniemen.json`. Vindt Tobias iets niet terwijl het er wel is, voeg dan een synoniem toe en/of een regel aan `tests/zoektest.js`, en draai de test.

