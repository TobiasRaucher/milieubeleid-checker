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
   - Zet bij elke wijziging het veld `bijgewerkt` bovenin het gewijzigde bestand op het huidige tijdstip (ISO, UTC, bv. `2026-11-12T15:49:00Z`). De kop van de site toont het meest recente tijdstip van alle bestanden als "Bijgewerkt 12 nov 2026 21:59" (Nederlandse tijd).
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
- Moties (`#moties`) en Amendementen (`#amendementen`): een grote schakelaar bovenaan en één gedeelde tabel (`moties()`/`bindMoties()` in app.js). Kolommen: Motie/Amendement, uitklapknop, Uitslag, Appreciatie kabinet, Indiener, Dossier, Datum. Uitslag, Appreciatie kabinet en Indiener zijn filters met meerdere keuzes (kolomkop opent een menu met vinkjes; definities in `MOTIE_FILTERS`; Indiener telt alle indieners, GroenLinks-PvdA als PRO). Alleen Datum sorteert. Een klik op een rij opent het document op tweedekamer.nl (`tkLink`, uit het D-nummer dat `fetch_tk.py` per motie en amendement ophaalt; zonder D-nummer een zoeklink op het zaaknummer). De uitklapknop naast de titel toont alleen: zaak, document, indiendatum en indieners; Voor/Tegen in zetels; de fracties voor en tegen (uit `besluiten[].stemmen`, per fractie ontdubbeld); de links naar tweedekamer.nl en OpenTK. Het zoekveld zoekt ook op Kamerstuknummer; de link "Moties en amendementen bij dit dossier" vult dat in. Regels voor tabellen staan in DESIGN.md onder "Tables".
- Moties bij vergaderingen: gekoppeld op datum (dag zelf of dag ervoor) plus Kamerstukdossier op de agenda; tweeminutendebat "X (CD d/m)" aan commissiedebat X.
- To-do (Tobias, nov 2026): eigen themafilter op Wetgeving, Moties, Stukken en Agenda; de algemene sectorfilter is verwijderd.

## Ontwerp

**Lees eerst `DESIGN.md` (bovenin de repo).** Daar staan de richting, alle ontwerpwaarden en de regels (doen en niet doen); die gaan voor alles hieronder. Elke wijziging aan het uiterlijk volgt DESIGN.md.

- Huisstijl (nov 2026): "milieuradar" in kleine letters (woordmerk 24px met een logo van 36px; op de telefoon 20 en 32), DM Sans, groene merkkleur, rood als alarmkleur (vandaag, eerstvolgend), alleen licht thema. Alle kleuren en vormen staan als ontwerpknoppen bovenaan `assets/style.css`; sectorkleuren als `--s-<sectorcode>` (gelijke helderheid en verzadiging).
- Verfijning volgens Apple-ontwerpprincipes (nov 2026):
  - directe feedback bij indrukken (`--duur-druk`);
  - kritisch gedempte "veer" voor beweging (`--veer`, `--duur-veer`), zonder doorschieten;
  - kop met een rand die pas verschijnt als er inhoud onder schuift (sinds 13 nov 2026 een vaste witte kop, geen doorschijnend glas);
  - popovers die vanuit hun knop verschijnen;
  - vloeiend uitklappen van samenvattingen;
  - tracking en regelafstand per tekstgrootte;
  - ondersteuning voor minder beweging en meer contrast.

- Tweede verfijningsronde (nov 2026):
  - tab-aanduiding die van tab naar tab glijdt (`.tab-glij`, gezet in `zetGlij()` in app.js);
  - paginatitel (eerste `h2` van een pagina) duidelijk groter dan sectiekoppen;
  - lopende tekst nooit breder dan `--leesbreedte`; brede schermen worden benut met twee kolommen (dossierkaart: tekst links, stand van zaken rechts; samenvatting: inhoud links, agendapunten en deelnemers rechts);
  - tabelkop blijft staan onder de vaste paginakop (`--kop-h` wordt door app.js gezet); op de telefoon is de motietabel een lijst van blokjes;
  - een klik op een tab begint bovenaan, terug/vooruit in de browser herstelt de scrollpositie;
  - sneltoets `/` voor zoeken, knop "terug naar boven", laadskelet in `index.html` en een foutmelding als de data niet laadt;
  - lijsttitels (`.ltitel`) in inktkleur met onderstreping bij aanwijzen; externe links krijgen een pijltje.

  Houd nieuwe onderdelen in die lijn.

## Overzicht: "Wat Nederland uitstoot" (sinds 13 nov 2026)

- Overzicht begint met het blok "Wat Nederland uitstoot" (de hoofdgrafiek), daarna Recente stemmingen, Komt eraan en Nieuwste stukken. De CO2-band, de kerncijfers, het Aandachtsdossier, Laatste samenvattingen en de planetaire grenzen zijn op verzoek van Tobias verwijderd (met hun data en de pipelinestap `fetch_milieu.py`); niet terugzetten zonder te vragen. Code: `assets/milieu.js` (vanilla JS, SVG, geen bibliotheek).
- Het blok gaat alleen over uitstoot die Nederland zelf in de hand heeft, en elke weergave toont het doel van de wet die erover gaat. Zes weergaven, in twee groepen:
  - **Klimaatwet**: Totaal broeikasgassen, CO2, CH4, N2O uit CBS-tabel 85669NED (IPCC-richtlijnen, miljard kg CO2-equivalent). Sector `T001616` (Totaal klimaatsectoren: inclusief landgebruik, zonder bunkers); stoffen `T001372` (totaal), `A044109`, `A044107`, `A044110` (CBS noemt dat "Distikstofoxide (N20)" met een nul; op de site N₂O). F-gassen tellen mee in het totaal maar hebben geen eigen weergave.
  - Doellijn (−55% in 2030 t.o.v. 1990) **alleen bij het totaal**; het doel geldt voor alle broeikasgassen samen. Bij CO2, CH4 en N2O alleen de 1990-lijn en de zin "Klimaatwet: −55% voor alle broeikasgassen samen in 2030."
  - **Stikstofwet**: NH3 (`A044111`) en NOx (`A044112`) uit CBS-tabel 85668NED (bron `T001176`, eenheid mln kg = kiloton). Gestreepte lijn naar de raming voor 2030 uit PBL ERL 2025 (vastgesteld en voorgenomen beleid: NH3 101, NOx 227 kiloton), een vaste stip bij het doel en de kloof "−36% nodig t.o.v. raming". De 36% komt uit RIVM KN-2025-0026 (wat nodig is voor het Wsn-doel: de helft van de stikstofgevoelige natuur onder de KDW in 2030). De 38% in diezelfde notitie hoort bij het Greenpeace-vonnis en wordt bewust niet getoond. Geen 1990-doel tekenen: het stikstofdoel is relatief aan de raming.
  - Onder de stikstofgrafieken staat de voetnoot over het wetsvoorstel van 3 november 2026 (sectordoelen 2035). Wordt dat wet, of verschijnt een nieuwe ERL (tweejaarlijks), werk dan `WEERGAVEN[].raming`, `WSN` en de voetnoot in `milieu.js` bij.
- Sleutels in beide CBS-tabellen kunnen met spaties zijn opgevuld: filter met `startswith(...)`, niet met `eq`.
- Bewust weggelaten (Tobias, 13 nov 2026): de peilregel, de uitleg per stof, de tabelweergave en de toelichting over stationaire en mobiele bronnen. Wel blijft één bronregel met links onder de grafiek.

## Zoekfunctie

- `assets/zoek.js` bouwt in de browser een index (MiniSearch, `assets/vendor/`) over debatten, dossiers, moties en amendementen, stukken en Kameractiviteiten. Nederlandse stamvorming, synoniemen, tikfoutcorrectie en titelweging staan daar beschreven.
- Synoniemen en afkortingen: `data/zoeksynoniemen.json`. Vindt Tobias iets niet terwijl het er wel is, voeg dan een synoniem toe en/of een regel aan `tests/zoektest.js`, en draai de test.

