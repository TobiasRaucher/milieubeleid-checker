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
   - Geen `dossiers`-veld meer invullen: de site gebruikt geen dossiers (zie "Dossiers").
4. Werk `data/agenda.json` bij als er nieuwe mijlpalen, consultaties of deadlines zijn (met bron-URL). Zoek bij twijfel op internet (eerstekamer.nl, internetconsultatie.nl, officielebekendmakingen.nl).
   - Zet bij elke wijziging het veld `bijgewerkt` bovenin het gewijzigde bestand op het huidige tijdstip (ISO, UTC, bv. `2026-11-12T15:49:00Z`). De kop van de site toont het meest recente tijdstip van alle bestanden als "Bijgewerkt 12 nov 2026 21:59" (Nederlandse tijd).
   - Kerndocumenten: is er een nieuwe editie verschenen (Prinsjesdag: Troonrede, KEN, KEV, MEV, Deltaprogramma; Voorjaarsnota; Verantwoordingsdag: Monitor Brede Welvaart), voeg dan een item toe aan `data/kerndocumenten.json` met dezelfde `reeks`. Begrotingsstukken niet: die haalt `fetch_tk.py` zelf op.
5. Render de site lokaal (`python3 -m http.server`) en bekijk een screenshot; controleer JSON-validiteit en draai `node tests/zoektest.js`. Draai `node pipeline/versie.js` als er iets in `assets/` is gewijzigd (zie "Ontwerp").
6. Commit en push naar `main` (GitHub Pages publiceert automatisch).

## Samenvattingen: niveaus en meerdere sessies

- Centrale debatten krijgen een volledige samenvatting (partijen, kabinet, toezeggingen, moties). Minder centrale debatten, briefings en tweeminutendebatten mogen kort: zet `"niveau": "kort"`, schrijf `aanzet` en een uitgebreidere `gist` (met de belangrijkste uitkomsten) en laat `partijen` leeg. De site toont dan het label "kort".
- Hoort een samenvatting bij meer dan één TK-activiteit (bv. technische briefing plus rondetafelgesprek, of een debat met voortzetting), zet de extra activiteitnummers in `extraActiviteiten`. Die activiteiten tellen dan als samengevat.
- Zet `sector` op de sector van het debat (`klimaat-energie`, `water-adaptatie`, `natuur-stikstof-landbouw`, `circulair-vervuiling`, `ruimte-mobiliteit`). Sectoren bepalen welke data de pipeline ophaalt; op de site worden thema's gebruikt (zie hieronder).
- Debatten van vóór april 2026 staan niet op gehoord.de en kunnen niet worden samengevat.

## Sectoren en stukken van ministeries

- Sectoren staan in `pipeline/config.json`. Per sector: `commissies` (activiteiten), `activiteitTrefwoorden` (alleen activiteiten met zo'n woord in het onderwerp; nodig voor brede commissies als I&W en LVVN), `kamerstukdossiers` en `zoektermen` (moties en wetgeving), `stukDossiers` en `trefwoorden` (stukken van ministeries).
- Welke wetsvoorstellen, moties en amendementen erin komen (sinds 13 nov 2026):
  - Wetsvoorstellen vanaf 2019 (`wetgeving.startdatum`; de Klimaatwet uit 2016 via zijn dossier): Kamerstuk in een sector of in `wetgeving.insluiten`, voortouw K&GG (`altijdVoortouw`), of een sector-trefwoord in de (citeer)titel. `wetgeving.uitsluiten` houdt Kamerstukken (en hun moties en amendementen) eruit die wel een trefwoord hebben maar geen milieubeleid zijn (vuurwerk, energietoeslag, volkshuisvesting).
  - Moties en amendementen alleen uit de huidige Kamerperiode (`startdatum`): uit de vaste dossiers, of met een sector-trefwoord in het onderwerp (namen van indieners tellen niet; `schone_tekst()`), of bij een gevolgd wetsvoorstel. Zoektermen kijken alleen naar het onderwerp (de Titel van een motie is de titel van het dossier).
  - Brede dossiers (`"breed": true` bij een kamerstukdossier, `stukken.bredeDossiers`; nu 21501-33, Raad VTE met ook telecom) tellen alleen samen met een trefwoord.
  - Relevantiepoort: wat bij de themareview bewust geen thema kreeg (`themas: []` in `data/themas-mapping.json`) is geen milieubeleid en haalt `fetch_tk.py` uit zaken.json en stukken.json (een vraag en haar antwoord samen); het aantal staat in `meta.json` onder `uitgesloten`. "Zonder thema" bij de review betekent dus: weg van de site.
- `data/tk/stukken.json` bevat Kamerbrieven, Kamervragen (soort `Schriftelijke vragen`, met `indieners` en de ministeries waaraan ze gericht zijn) en antwoorden op Kamervragen die bij een sector horen (KGG altijd). Elk stuk heeft een `zaak`; een vraag en haar antwoord delen die en komen er altijd samen in. Te ruime of te krappe selectie? Pas `stukDossiers`/`trefwoorden` of `stukken.uitsluiten` aan in de config, niet de data.

## Dossiers

- Sinds 13 nov 2026 gebruikt de site geen dossiers meer (op verzoek van Tobias); alleen thema's. Geen dossierfilters, dossierlabels of dossierkaarten, ook niet op Wetgeving. Niet terugzetten zonder te vragen.
- `data/dossiers.json` staat nog in git maar wordt door de site, de zoekfunctie en de themascripts niet gelezen.
- Wetgeving toont de wetsvoorstellen uit de Kamerdata (`zaken.json`, soort Wetgeving of Initiatiefwetgeving) als tabel: Wetsvoorstel, Status, Kamerstuk, Ingediend. Een wetsvoorstel zonder trefwoord in de titel volgen: voeg het Kamerstuknummer toe aan `wetgeving.insluiten` in `pipeline/config.json`; een onterecht wetsvoorstel aan `wetgeving.uitsluiten`.
- "Kamerstuk" (het Kamerstukdossier uit de TK-data, bv. `36169`) is geen dossier in deze zin en blijft overal staan (kolom in de motietabel, zoeken op Kamerstuknummer, Kamerstuk bij stukken).

## Prioriteit

De wijziging van de Klimaatwet na de Klimaatzaak Bonaire is het aandachtsonderwerp. Zolang het wetsvoorstel geen Kamerstuknummer heeft, staat het niet op Wetgeving; de mijlpalen staan in `data/agenda.json`.

## Kosten

Een transcript van een commissiedebat kost ongeveer 30k tot 60k tokens. Vat alleen nieuwe, relevante debatten samen; meld aan Tobias hoeveel er openstaan als het er veel zijn.

## Thema's en pagina's

- Thema's (sinds 13 nov 2026 tien vaste): de indeling zelf (slug, label, volgorde, beschrijving) staat in `THEMAS` in `assets/themas.js`; alle pagina's lezen die. Geen kleur of icoon per thema (DESIGN.md, "Themes").
  - Toekenning: eerst de goedgekeurde mapping `data/themas-mapping.json` (platte sleutels `zaak:<nummer>`, `stuk:<D-nummer>`, `debat:<activiteitnummer of samenvatting-id>`, `agenda:<datum>-<titel>`; velden `themas` en `bron`), dan het veld `themas` in een samenvatting, dan de trefwoordregels in `data/themas.json`. Regels: titel telt altijd, agendapunten pas bij twee treffers, de titel van het Kamerstukdossier alleen als de titel niets oplevert (begrotingen alleen als suggestie). Geen terugval op sector: zonder treffer blijft een item zonder thema ("te beoordelen"). Sectoroverstijgend is een inhoudelijk thema, geen restbak.
  - Wekelijkse review: `node pipeline/themas_review.js --nieuw` maakt `themas-review-nieuw.csv` met alleen items die nog niet in de mapping staan; Tobias kijkt die na; `node pipeline/themas_review.js --import <csv>` zet de nagekeken rijen in de mapping. `themas-review*.csv` staat niet in git.
  - Alle items die een thema kunnen krijgen komen uit `MRThemas.bronItems` (wetten = TK-wetsvoorstellen; moties; amendementen; Kamerbrieven; Kamervragen; antwoorden op Kamervragen; vergaderingen; agenda; kerndocumenten, nieuwste editie per reeks). Pagina, CSV en noscript-lijst tellen dus hetzelfde.
  - `pipeline/themas_noscript.js` schrijft de thema's met tellingen in het `<noscript>`-blok van `index.html` (de Action draait het dagelijks).
- `#themas` toont sinds 14 nov 2026 alleen de tien namen als 5 x 2 tegels (geen introtekst, tellingen of eerstvolgend moment); alles verder staat op de themapagina.
- Themapagina `#themas/<slug>` (sinds 14 nov 2026): een kleine schakelaar met Overzicht (Net binnen en Komt eraan voor dit thema; standaard), Wetten, Amendementen, Moties, Kamerbrieven, Kamervragen (met antwoorden), Vergaderingen, Agenda en Kerndocumenten, met aantallen. De vijf documentsoorten zijn dezelfde tabellen als op hun eigen pagina, beperkt tot het thema en zonder Themakolom (`themaDef()` in app.js); Vergaderingen en Agenda zijn een lijst met zoekveld. Adres: `#themas/<slug>?type=<param>` plus filters.
- Links naar documenten gaan naar tweedekamer.nl, niet naar OpenTK (`MRThemas.tkUrl` in themas.js: motie en amendement via het D-nummer, wetsvoorstel via het Kamerstuknummer); OpenTK staat alleen nog als tweede link in de details. Ook in de zoekfunctie en op Wetgeving.
- Tabs: Overzicht, Thema's, Agenda, Wetgeving, Moties & Amendementen, Vragen & Brieven, Kerndocumenten, Over. `#themas` is het overzicht, `#themas/<slug>` een thema (`?type=` is gereserveerd voor filters).
- Wetgeving, Moties & Amendementen en Vragen & Brieven zijn sinds 13 nov 2026 één tabelpatroon (`tabelPagina()`/`bindTabel()` in app.js, een definitie per pagina: `WET_DEF`, `motieDef()`, `VRAAG_DEF`, `BRIEF_DEF`). Filters, zoekterm en volgorde staan in de URL. Zie DESIGN.md, "Tables".
- Vragen & Brieven (tab sinds 13 nov 2026, vroeger Stukken): `#vragen` (Kamervragen, één rij per zaak met het antwoord erbij; Status Beantwoord, Open of Termijn verstreken na 21 dagen) en `#brieven` (Kamerbrieven). `#stukken` wordt omgezet naar `#vragen`. Geen introtekst boven de tabel (Tobias, 13 nov 2026).
- Agenda (sinds 13 nov 2026 ook de plek van de vroegere tab Vergaderingen): één tijdlijn per week en dag met geplande en gehouden Kameractiviteiten, samengevatte vergaderingen en eigen mijlpalen (`tijdlijnItems()`/`renderAgenda()` in app.js).
  - "Vanaf vandaag" (standaard) begint bovenaan bij vandaag en toont alleen wat komt. "Terugblik" toont alleen wat is geweest, nieuwste eerst. Naast de titel staat in beide weergaven alleen deze schakelaar (geen introtekst, tellingen of abonneerknop; Tobias, 13 nov 2026).
  - Filters: type, commissie, ministerie en thema (meerdere waarden per filter; geen filter op samenvatting). Ze staan in de URL (bv. `#agenda?thema=adaptatie&type=Commissiedebat&terugblik=1`). Een klik op een themalabel zet dat thema aan of uit.
  - Agendapunten (sinds 16 nov 2026): elke vergadering zonder samenvatting met agendapunten klapt uit met "Toon agenda (n punten)" (`agendaBlok()`/`agendapuntenBlok()`/`deelnemersBlok()` in app.js; samenvattingen gebruiken dezelfde blokken). Stukken staan op Kamerstuknummer; moties en amendementen tonen de uitslag of de stemmingsdatum (`data/tk/stemmingen.json`); per Kamerstukdossier een link naar `#moties?q=<nummer>`.
  - Zaal (`zaal` in activiteiten.json; vaak leeg in de TK-data, plenair = "Plenaire zaal"), label Besloten, en bij openbare vergaderingen van vandaag een link "Live op Debat Direct".
  - Inbrengtermijnen (Inbreng schriftelijk overleg, Inbreng verslag, Inbreng feitelijke vragen; in `ACTIVITEIT_SOORTEN` sinds 16 nov 2026) staan zonder tijd op hun dag met "Inbreng tot hh:mm"; in de agendafeed als hele dag.
  - Samenvattingen klappen uit in de tijdlijn ("Toon samenvatting"). Hoort een samenvatting bij meer activiteiten, dan staat ze bij de hoofdactiviteit en verwijzen de andere ernaar. `#agenda/d-<samenvatting-id>` en `#agenda/a-<activiteitnummer>` openen die vergadering (in Terugblik als ze is geweest).
  - Oude adressen worden omgezet: `#vergaderingen…` en `#debatten…` naar `#agenda…` (filters blijven, zonder subpad met Terugblik), `#toezeggingen` en `#fracties` naar `#agenda?terugblik=1`, `#wetgeving/w-<id>` naar `#wetgeving`.
- Kerndocumenten (tab sinds 17 nov 2026, `#documenten`; `kerndocumentenPagina()`/`bindKerndocumenten()` in app.js): vaste documenten voor beleidsonderzoek per groep (Kabinet en coalitie, Begroting en financiën, Ramingen en monitoring, Advies, Wettelijk kader, Rechtspraak, Europese Unie).
  - Handmatig: `data/kerndocumenten.json` (titel, soort, uitgever, datum, url, officieel `kenmerk`: Kamerstuk, D-nummer, ECLI, BWBR of CELEX; `reeks` bundelt edities: de site toont de nieuwste en klapt de rest in; `themas`). Controleer elke URL voor je hem toevoegt.
  - Automatisch: `fetch_tk.py` (ook los: `--begrotingen`) schrijft `data/tk/begrotingen.json`: Miljoenennota, de begrotingen van de twee nieuwste jaren en het laatste jaarverslag per hoofdstuk in `kerndocumenten.hoofdstukken` in `pipeline/config.json` (nu XXIII KGG, M Klimaat- en Energiefonds (KEF), XIII EZK, XIV LVVN, XII IenW, A Mobiliteitsfonds, J Deltafonds, XXII VRO, VII BZK), Belastingplan, Voorjaars- en Najaarsnota en het Financieel Jaarverslag van het Rijk, elk met het hoofddocument (memorie van toelichting of jaarverslag). Thema per hoofdstuk: `HOOFDSTUK_THEMA` in themas.js.
  - `MRThemas.kerndocumenten()` maakt van beide één lijst; themapagina's (type Kerndocumenten), zoekfunctie en review-CSV (sleutel `kerndoc:<id>`) gebruiken die.
- Agendafeed: `pipeline/maak_ics.py` schrijft `data/agenda.ics` (geplande en recente activiteiten plus mijlpalen met vaste datum); de Action draait hem na de data-update. De abonneerknop is weg (13 nov 2026); de feed wordt nog gemaakt, zodat bestaande abonnementen blijven werken.
- Toezeggingen: de pagina is weg (13 nov 2026), de data niet. De pipeline haalt het toezeggingenregister van de Kamer nog op (`data/tk/toezeggingen.json`; alleen bij gevolgde activiteiten plus ministeries in `toezeggingen.altijdMinisteries`). De site toont de toezeggingen in de samenvatting van de vergadering; zonder registratie die uit de samenvatting. In de zoekfunctie leidt een toezegging naar haar vergadering op de Agenda. Los bijwerken: `python3 pipeline/fetch_tk.py --toezeggingen`.
- Per fractie: de pagina is weg (13 nov 2026). GroenLinks-PvdA telt nog steeds mee bij PRO in het Indiener-filter van de motietabel (alias in `FRACTIE_ALIAS` in app.js).
- Moties & Amendementen (`#moties` en `#amendementen`; tabnaam sinds 13 nov 2026): een grote schakelaar bovenaan met het zoekveld ernaast, en één gedeelde tabel (`moties()`/`bindMoties()` in app.js). Kolommen: Thema, "Motie over..."/"Amendement over..." (titel met kleine beginletter, behalve afkortingen), uitklapknop, Uitslag, Appreciatie kabinet, Indiener, Kamerstuk, Datum. Thema, Uitslag, Appreciatie kabinet en Indiener zijn filters met meerdere keuzes (kolomkop opent een menu met vinkjes; definities in `MOTIE_FILTERS`; Thema volgt de thematoekenning, zonder thema als "Geen thema"; Indiener telt alle indieners, GroenLinks-PvdA als PRO). Alleen Datum sorteert (pijltje rechts van het woord). Een klik op een rij opent het document op tweedekamer.nl (`tkLink`, uit het D-nummer dat `fetch_tk.py` per motie en amendement ophaalt; zonder D-nummer een zoeklink op het zaaknummer). De uitklapknop naast de titel toont alleen: zaak, document, indiendatum en indieners; Voor/Tegen in zetels; de fracties voor en tegen (uit `besluiten[].stemmen`, per fractie ontdubbeld); "Ingediend bij" met een link naar de vergadering op de Agenda (`#agenda/a-<nummer>`; bij een tweeminutendebat ook het commissiedebat) en "Gestemd"/"Stemming gepland" met een link naar de plenaire Stemmingen op tweedekamer.nl (`vergaderRegels()` in app.js); de links naar tweedekamer.nl en OpenTK. Het zoekveld zoekt ook op Kamerstuknummer. Regels voor tabellen staan in DESIGN.md onder "Tables".
- Stemmingsdatum: `fetch_tk.py` haalt de plenaire `Stemmingen`-activiteiten op en schrijft `data/tk/stemmingen.json` (`{zaaknummer: {datum, activiteit}}`, sinds 17 nov 2026; de eerstvolgende geplande stemming gaat voor). app.js zet dat bij het laden om in `S.data.stemmingen` (`{zaak: datum}`) en `S.data.stemActiviteit`, en leest ook nog het oude formaat `{zaak: datum}`. De site toont die bij moties zonder uitslag ("Stemming di 17 nov").
- Moties bij vergaderingen: gekoppeld op datum (dag zelf of dag ervoor) plus Kamerstukdossier op de agenda; tweeminutendebat "X (CD d/m)" aan commissiedebat X. Amendementen (alleen voor "Ingediend bij", niet in de motielijst van een vergadering): de eerste plenaire vergadering, wetgevings- of notaoverleg vanaf de dag voor indienen tot en met de stemming met het Kamerstukdossier op de agenda, alleen als er op die dag precies één is (`actVanZaak` in `motieKoppeling()`).
- Alle pagina's met lijsten hebben sinds 13 nov 2026 een themafilter (Agenda, Wetgeving, Moties & Amendementen, Vragen & Brieven); de algemene sectorfilter is verwijderd.

## Ontwerp

**Alleen desktop** (Tobias, 14 nov 2026): de site hoeft niet op de telefoon te werken; ontwerp en controleer nieuwe onderdelen niet meer voor telefoonbreedte.

- Versies van scripts en stijl (sinds 17 nov 2026): `index.html` laadt elk bestand uit `assets/` met `?v=<hash van de inhoud>`, zodat bezoekers na een wijziging meteen de nieuwe versie krijgen (GitHub Pages laat browsers anders tot tien minuten of langer de oude gebruiken). `node pipeline/versie.js` zet die versies; draai het voor elke commit die iets in `assets/` wijzigt. De Action draait het ook dagelijks. Zie je een wijziging niet op de site: eerst hard herladen (Cmd+Shift+R).

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
  - lopende tekst nooit breder dan `--leesbreedte`; brede schermen worden benut met twee kolommen (samenvatting: inhoud links, agendapunten en deelnemers rechts);
  - tabelkop blijft staan onder de vaste paginakop (`--kop-h` wordt door app.js gezet); op de telefoon is de motietabel een lijst van blokjes;
  - een klik op een tab begint bovenaan, terug/vooruit in de browser herstelt de scrollpositie;
  - sneltoets `/` voor zoeken, knop "terug naar boven", laadskelet in `index.html` en een foutmelding als de data niet laadt;
  - lijsttitels (`.ltitel`) in inktkleur met onderstreping bij aanwijzen; externe links krijgen een pijltje.

  Houd nieuwe onderdelen in die lijn.

## Overzicht: "Wat Nederland uitstoot" (sinds 13 nov 2026)

- Overzicht begint (sinds 16 nov 2026) met een korte uitleg (`OV_INTRO` in app.js: de enige `h1` van de site, 30/500, en één alinea 15/400 in ink-2 met een link naar `#themas`; tekst van Tobias, niet herschrijven zonder te vragen), dan het blok "Wat Nederland uitstoot" (de hoofdgrafiek), daarna twee kolommen: Net binnen (breed, links) en Komt eraan (smal, rechts), met dezelfde onderrand. "Wat Nederland uitstoot" staat sinds 16 nov 2026 als kop met een kaart eronder, net als Net binnen en Komt eraan. Bovenaan Komt eraan staat de eerstvolgende plenaire stemming (`komendeStemming()` in app.js): het aantal moties en amendementen zonder uitslag met een stemmingsdatum vanaf vandaag (uit `stemmingen.json`), als link naar `#moties`; dan 5 in plaats van 6 agendaregels. Op de themapagina alleen die van het thema; geen stemming gepland, dan geen regel. Net binnen (`netBinnen()` in app.js) is één chronologische lijst van de 10 nieuwste items: stukken (`datum`), stemmingen over moties en amendementen (`stemtelling.datum`) en wetgeving (`gestartOp` van de wetsvoorstellen). Elk item is één doorlopende regel: documentsoort in accentkleur (Kamervragen, Antwoord Kamervragen, Kamerbrief, Motie, Amendement, Wetsvoorstel; bij Kamervragen "aan <ministerie>" en als staart de vragensteller), datum, status of ministerie, titel, en een stille staart (indiener zonder voorletters zoals in de motietabel, Voor/Tegen; Kamerstuk). Voorletters van Kamerleden in titels worden weggelaten (`zonderVoorletters`). Zie DESIGN.md, "Overzicht lists". Alleen ISO-datums op de dag nauwkeurig en niet in de toekomst tellen mee; binnen één dag gaat Wetgeving voor Stemming voor Stuk. Recente stemmingen en Nieuwste stukken als losse blokken zijn op verzoek van Tobias opgeheven (13 nov 2026). De CO2-band, de kerncijfers, het Aandachtsdossier, Laatste samenvattingen en de planetaire grenzen zijn op verzoek van Tobias verwijderd (met hun data en de pipelinestap `fetch_milieu.py`); niet terugzetten zonder te vragen. Code: `assets/milieu.js` (vanilla JS, SVG, geen bibliotheek).
- Het blok gaat alleen over uitstoot die Nederland zelf in de hand heeft, en elke weergave toont het doel van de wet die erover gaat. Zes weergaven, in twee groepen:
  - **Klimaatwet**: Totaal broeikasgassen, CO2, CH4, N2O uit CBS-tabel 85669NED (IPCC-richtlijnen, miljard kg CO2-equivalent). Sector `T001616` (Totaal klimaatsectoren: inclusief landgebruik, zonder bunkers); stoffen `T001372` (totaal), `A044109`, `A044107`, `A044110` (CBS noemt dat "Distikstofoxide (N20)" met een nul; op de site N₂O). F-gassen tellen mee in het totaal maar hebben geen eigen weergave.
  - Doellijn (−55% in 2030 t.o.v. 1990) **alleen bij het totaal**; het doel geldt voor alle broeikasgassen samen. Bij CO2, CH4 en N2O alleen de 1990-lijn en de zin "Klimaatwet: −55% voor alle broeikasgassen samen in 2030."
  - Bij het totaal ook de KEV-raming (constante `KEV` in `milieu.js`, nu KEV 2026 basispad van 14 september 2026: 46 tot 53% reductie in 2030, doel halen "heel erg onwaarschijnlijk (minder dan 5 procent)"): een neutrale onzekerheidsband vanaf het laatst gemeten jaar naar de bandbreedte in 2030, een gestreepte lijn naar het midden, en onder de doelzin een kanstegel met een stoplichtstip (rood onder 50%, geel 50 tot 75%, groen boven 75%), het oordeel van PBL en de peildatum, zonder uitlegzin. De KEV staat niet in de CBS-data; werk `KEV` bij als er een nieuwe KEV verschijnt (jaarlijks in september).
  - Astitels bij elke weergave: `CO₂-eq (miljard kg)` of `kiloton` boven de y-as, `Jaar` onder de x-as.
  - **Stikstofwet**: NH3 (`A044111`) en NOx (`A044112`) uit CBS-tabel 85668NED (bron `T001176`, eenheid mln kg = kiloton). Gestreepte lijn naar de raming voor 2030 uit PBL ERL 2025 (vastgesteld en voorgenomen beleid: NH3 101, NOx 227 kiloton), een vaste stip bij het doel en de kloof "−36% nodig t.o.v. raming". De 36% komt uit RIVM KN-2025-0026 (wat nodig is voor het Wsn-doel: de helft van de stikstofgevoelige natuur onder de KDW in 2030). De 38% in diezelfde notitie hoort bij het Greenpeace-vonnis en wordt bewust niet getoond. Geen 1990-doel tekenen: het stikstofdoel is relatief aan de raming.
  - Onder de stikstofgrafieken staat de voetnoot over het wetsvoorstel van 3 november 2026 (sectordoelen 2035). Wordt dat wet, of verschijnt een nieuwe ERL (tweejaarlijks), werk dan `WEERGAVEN[].raming`, `WSN` en de voetnoot in `milieu.js` bij.
- Sleutels in beide CBS-tabellen kunnen met spaties zijn opgevuld: filter met `startswith(...)`, niet met `eq`.
- Bewust weggelaten (Tobias, 13 nov 2026): de peilregel, de uitleg per stof, de tabelweergave en de toelichting over stationaire en mobiele bronnen. Wel blijft één bronregel met links onder de grafiek.

## Zoekfunctie

- `assets/zoek.js` bouwt in de browser een index (MiniSearch, `assets/vendor/`) over samenvattingen, wetsvoorstellen, moties en amendementen, stukken, Kameractiviteiten, toezeggingen en de agenda. Vergaderingen en toezeggingen linken naar de Agenda. Nederlandse stamvorming, synoniemen, tikfoutcorrectie en titelweging staan daar beschreven.
- Resultatenpagina (sinds 17 nov 2026; `renderZoekResultaten()` in app.js). Alle keuzes staan in de URL: `#zoeken?q=…&cat=moties&volgorde=relevantie&periode=maand&wie=f:pvv`.
  - Volgorde: standaard "Nieuwste eerst": bovenaan "Komt eraan" (geplande vergaderingen, agenda en geplande stemmingen over moties en amendementen zonder uitslag, eerstvolgende eerst, vijf zichtbaar; agenda zonder datum achteraan), daaronder "Eerder", per maand. "Beste treffer" sorteert op score.
  - Periode: Alle jaren, Deze Kamerperiode (`config.startdatum`), Afgelopen maand; geldt alleen voor wat is geweest.
  - "In het kort" (`zoekKort()`, alleen bij Alles en minstens 8 resultaten): tellingen per soort (moties met aangenomen/verworpen, Kamervragen zonder antwoord) als links naar die soort, en het meest passende wetsvoorstel, de nieuwste Kamerbrief en de laatste stemming met de zoekterm in de titel; plus een link naar een thema als de zoekterm in een themanaam staat.
  - Namen: fracties en Kamerleden of bewindspersonen in de zoekvraag geven een knop "Alleen …" (indiener, vragensteller of spreker; GroenLinks-PvdA telt als PRO). Alleen een naam met die knop toont alles van die persoon of fractie.
  - Moties en amendementen met dezelfde titel (gewijzigd, ter vervanging, opnieuw ingediend) zijn één rij met "Ook: …" (`voegSamen()`).
  - Geen resultaten: welk filter het veroorzaakt, "Bedoelde je …?" (dichtstbijzijnde bekende woorden), welke losse woorden wel iets opleveren, en de thema's. "Bedoelde je" staat ook in de telregel als er alleen gedeeltelijke of tikfouttreffers zijn.
- Zoekveld in de kop: buiten de zoekpagina een lijst met zes suggesties en "Toon alle n resultaten" (combobox, pijltjes en Enter); op de zoekpagina werkt de pagina direct bij.
- Score (`zoek.js`): binnen een synoniemgroep telt de beste variant, niet de som; afgeleide woorden (voorvoegsel, tikfout) wegen minder; de titel van het Kamerstukdossier staat in een eigen veld met laag gewicht (`dossier`); dubbele agendapunten tellen één keer. Treffers die alleen via tikfoutcorrectie passen, vallen weg zolang er andere zijn.
- Synoniemen en afkortingen: `data/zoeksynoniemen.json`. Vindt Tobias iets niet terwijl het er wel is, voeg dan een synoniem toe en/of een regel aan `tests/zoektest.js`, en draai de test.

