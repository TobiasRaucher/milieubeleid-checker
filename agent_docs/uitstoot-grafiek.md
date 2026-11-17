# "Wat Nederland uitstoot" (`assets/milieu.js`, sinds 13 nov 2026)

Vanilla JS en SVG, geen bibliotheek. Het blok gaat alleen over uitstoot die Nederland zelf in de hand heeft, en elke
weergave toont het doel van de wet die erover gaat. Zes weergaven in twee groepen.

## Klimaatwet

- Totaal broeikasgassen, CO2, CH4, N2O uit CBS-tabel 85669NED (IPCC-richtlijnen, miljard kg CO2-equivalent).
  - Sector `T001616` (Totaal klimaatsectoren: inclusief landgebruik, zonder bunkers).
  - Stoffen `T001372` (totaal), `A044109`, `A044107`, `A044110` (CBS noemt die laatste "Distikstofoxide (N20)" met een nul;
    op de site N₂O). F-gassen tellen mee in het totaal maar hebben geen eigen weergave.
- Doellijn (−55% in 2030 t.o.v. 1990) alleen bij het totaal; het doel geldt voor alle broeikasgassen samen. Bij CO2, CH4
  en N2O alleen de 1990-lijn en de zin "Klimaatwet: −55% voor alle broeikasgassen samen in 2030."
- KEV-raming bij het totaal (constante `KEV`; nu KEV 2026 basispad van 14 september 2026: 46 tot 53% reductie in 2030,
  doel halen "heel erg onwaarschijnlijk (minder dan 5 procent)"):
  - neutrale onzekerheidsband vanaf het laatst gemeten jaar naar de bandbreedte in 2030, gestreepte lijn naar het midden;
  - onder de doelzin een kanstegel met stoplichtstip (rood onder 50%, geel 50 tot 75%, groen boven 75%), het oordeel van
    PBL en de peildatum, zonder uitlegzin.
  - De KEV staat niet in de CBS-data: werk `KEV` bij bij een nieuwe KEV (jaarlijks in september).

## Stikstofwet

- NH3 (`A044111`) en NOx (`A044112`) uit CBS-tabel 85668NED (bron `T001176`, eenheid mln kg = kiloton).
- Gestreepte lijn naar de raming voor 2030 uit PBL ERL 2025 (vastgesteld en voorgenomen beleid: NH3 101, NOx 227 kiloton),
  een vaste stip bij het doel en de kloof "−36% nodig t.o.v. raming".
- De 36% komt uit RIVM KN-2025-0026 (nodig voor het Wsn-doel: de helft van de stikstofgevoelige natuur onder de KDW in
  2030). De 38% in dezelfde notitie hoort bij het Greenpeace-vonnis en wordt bewust niet getoond.
- Geen 1990-doel tekenen: het stikstofdoel is relatief aan de raming.
- Voetnoot onder de stikstofgrafieken over het wetsvoorstel van 3 november 2026 (sectordoelen 2035). Wordt dat wet, of
  verschijnt een nieuwe ERL (tweejaarlijks): werk `WEERGAVEN[].raming`, `WSN` en de voetnoot bij.

## Weergave

- Astitels bij elke weergave: `CO₂-eq (miljard kg)` of `kiloton` boven de y-as, `Jaar` onder de x-as.
- Eén bronregel met links onder de grafiek.
- Bewust weggelaten (Tobias, 13 nov 2026): de peilregel, de uitleg per stof, de tabelweergave en de toelichting over
  stationaire en mobiele bronnen.

## Valkuil

Sleutels in beide CBS-tabellen kunnen met spaties zijn opgevuld: filter met `startswith(...)`, niet met `eq`.
