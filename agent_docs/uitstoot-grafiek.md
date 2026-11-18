# "Wat Nederland uitstoot" (`assets/milieu.js`, sinds 13 nov 2026)

Vanilla JS en SVG, geen bibliotheek. Het blok gaat alleen over uitstoot die Nederland zelf in de hand heeft, en elke
weergave toont het doel van de wet die erover gaat. Zes weergaven in twee groepen.

## Opbouw (sinds 18 nov 2026)

- Bovenaan één rij: de keuze van de wet en van het doeljaar (alleen het jaar, `JAREN`), even groot. Het jaar bepaalt tot
  waar de x-as loopt (standaard 2030; de keuze geldt alleen tijdens het bezoek). Geen peilregel of extra bronnen (Tobias).
- Links: de knoppen per stof, het laatste cijfer, het doel voor het gekozen jaar (`doelKans()`) en daaronder het kansblok.
- Kans: alleen een gepubliceerd percentage krijgt de stoplichtstip; een oordeel zonder percentage staat als citaat met
  "volgens PBL"; niets gepubliceerd, dan geen kansblok. Nooit zelf een kans afleiden.

## Klimaatwet

- Totaal broeikasgassen, CO2, CH4, N2O uit CBS-tabel 85669NED (IPCC-richtlijnen, miljard kg CO2-equivalent).
  - Sector `T001616` (Totaal klimaatsectoren: inclusief landgebruik, zonder bunkers).
  - Stoffen `T001372` (totaal), `A044109`, `A044107`, `A044110` (CBS noemt die laatste "Distikstofoxide (N20)" met een nul;
    op de site N₂O). F-gassen tellen mee in het totaal maar hebben geen eigen weergave.
- Doelen (alleen bij het totaal, ze gelden voor alle broeikasgassen samen): 2030 −55% (Klimaatwet), 2040 −90% (EU-doel,
  Europese Klimaatwet; geldt voor de EU als geheel, daarom een open stip), 2050 klimaatneutraal (Klimaatwet, stip op 0).
  Geen Nederlands doel voor 2035 of 2040: komt er een na de Klimaatzaak Bonaire (wijziging Klimaatwet), voeg dan een
  jaar toe in `JAREN.klimaat`. Geen methaandoel (bewust: het blok gaat over de twee wetten).
- Raming: `KEV_RAMING`, uit de tabellenbijlage van de KEV (tabel 8b totaal, 12b CO2, 14b CH4; basispad), per zichtjaar
  2030, 2035 en 2040 het midden en de bandbreedte in megaton. De tussenjaren in de bijlage tekenen we niet (PBL geeft ze
  minder prioriteit). Geen aparte raming voor N2O. Het percentage bij de KEV-band is t.o.v. het CBS-cijfer voor 1990 (zoals de doelen).
- Kans: 2030 "minder dan 5 procent" (KEV tabel 0); 2040 geen kansschatting; 2050 "niet op koers" (PBL, KEV 2026).
- Bij een nieuwe KEV (september): download de tabellenbijlage (ODS) van de KEV-pagina op pbl.nl en werk `KEV`,
  `KEV_RAMING` en de kans in `JAREN.klimaat` bij.

## Stikstofwet

- NH3 (`A044111`) en NOx (`A044112`) uit CBS-tabel 85668NED (bron `T001176`, eenheid mln kg = kiloton).
- Jaren 2030 en 2035, opgebouwd als bij de Klimaatwet:
  - 2030: Wsn-doel (50% van de stikstofgevoelige natuur onder de KDW), met wat nodig is t.o.v. de raming per stof uit
    PBL ERL 2025 (NH3 101, NOx 227 kiloton; −36%, RIVM KN-2025-0026); kans: "ver buiten bereik" (PBL, 6 maart 2025).
    De 38% in dezelfde RIVM-notitie hoort bij het Greenpeace-vonnis en wordt bewust niet getoond.
  - 2035: Wsn-doel 74%; geen kansblok. Het wetsvoorstel van 3 nov 2026 (sectordoelen 2035) en "raming volgt in de ERL
    van begin 2027" staan er bewust niet bij (Tobias, 18 nov 2026: geen extra tekst).
- Grafiek: gestreepte lijn naar de raming voor 2030, een vaste stip bij het doel en de kloof "−36% nodig t.o.v. raming".
  Geen 1990-doel: het stikstofdoel is relatief aan de raming.
- Werk bij als het wetsvoorstel wet wordt of de ERL 2027 verschijnt: `WEERGAVEN[].raming`, `WSN` en `JAREN.stikstof`.

## Weergave

- Astitels bij elke weergave: `CO₂-eq (miljard kg)` of `kiloton` boven de y-as, `Jaar` onder de x-as.
- Eén bronregel met links onder de grafiek.
- Bewust weggelaten (Tobias, 13 nov 2026): de voetnoot onder de stikstofgrafiek, de peilregel (ook boven de grafiek), de uitleg per stof, de tabelweergave en de toelichting over
  stationaire en mobiele bronnen.

## Valkuil

Sleutels in beide CBS-tabellen kunnen met spaties zijn opgevuld: filter met `startswith(...)`, niet met `eq`.
