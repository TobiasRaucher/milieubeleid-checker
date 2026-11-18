# Zoekfunctie (`assets/zoek.js`, resultaten in `assets/app.js`)

## Index

- `zoek.js` bouwt in de browser een index (MiniSearch, `assets/vendor/`) over samenvattingen, wetsvoorstellen, moties en
  amendementen, stukken (ook titels van bijlagen), Kameractiviteiten, toezeggingen, de agenda en kerndocumenten
  (zonder verborgen groepen). Vergaderingen en toezeggingen linken naar de Agenda.
- Nederlandse stamvorming, synoniemen, tikfoutcorrectie en titelweging staan in `zoek.js` beschreven.
- Score: binnen een synoniemgroep telt de beste variant, niet de som; afgeleide woorden (voorvoegsel, tikfout) wegen minder;
  de titel van het Kamerstukdossier staat in een eigen veld met laag gewicht (`dossier`); dubbele agendapunten tellen één
  keer. Treffers die alleen via tikfoutcorrectie passen, vallen weg zolang er andere zijn.
- Synoniemen en afkortingen: `data/zoeksynoniemen.json`. Vindt Tobias iets niet terwijl het er wel is: synoniem toevoegen
  en/of een regel in `tests/zoektest.js`, en `node tests/zoektest.js` draaien.

## Resultatenpagina (`renderZoekResultaten()`, sinds 17 nov 2026)

Alle keuzes staan in de URL: `#zoeken?q=…&cat=moties&volgorde=relevantie&periode=maand&wie=f:pvv`.

- Soorten (`ZOEK_CATS`, sinds 17 nov 2026 gelijk aan het menu Documenten): Alles, Agenda, Wetgeving, Moties, Amendementen,
  Kamervragen, Kamerbrieven, Kerndocumenten. `zoekCat()` zet de `cat` uit `zoek.js` om: vergaderingen en toezeggingen
  vallen onder Agenda, moties en amendementen worden gesplitst op soort, stukken in Kamervragen (met antwoorden) en Kamerbrieven.

- Volgorde: standaard "Nieuwste eerst": bovenaan "Komt eraan" (geplande vergaderingen, agenda en geplande stemmingen over
  moties en amendementen zonder uitslag, eerstvolgende eerst, vijf zichtbaar; agenda zonder datum achteraan), daaronder
  "Eerder", per maand. "Beste treffer" sorteert op score.
- Periode: Alle jaren, Deze Kamerperiode (`config.startdatum`), Afgelopen maand; geldt alleen voor wat is geweest.
- Namen: fracties en Kamerleden of bewindspersonen in de zoekvraag geven een knop "Alleen …" (indiener, vragensteller of
  spreker; GroenLinks-PvdA telt als PRO). Alleen een naam met die knop toont alles van die persoon of fractie.
- Moties en amendementen met dezelfde titel (gewijzigd, ter vervanging, opnieuw ingediend) zijn één rij met "Ook: …" (`voegSamen()`).
- Geen resultaten: welk filter het veroorzaakt, "Bedoelde je …?" (dichtstbijzijnde bekende woorden), welke losse woorden wel
  iets opleveren, en de thema's. "Bedoelde je" staat ook in de telregel bij alleen gedeeltelijke of tikfouttreffers.
- Een toezegging leidt naar haar vergadering op de Agenda.

## Zoekveld in de kop

Altijd zichtbaar (sinds 17 nov 2026). Buiten de zoekpagina een lijst met zes suggesties en "Toon alle n resultaten" (combobox, pijltjes en Enter); op de
zoekpagina werkt de pagina direct bij.
