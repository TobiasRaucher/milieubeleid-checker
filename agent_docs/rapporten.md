# Rapporten beoordelen

Pagina `#kerndocumenten/rapporten` en het label "Met rapport" op Kamerbrieven. Criteria van Claude; Tobias stelt ze bij
in de chat. Pas na een wijziging hier de beoordelingen aan die erdoor veranderen.

## Hoe het werkt

1. `fetch_tk.py` zet `rapport: true` bij bijlagen van Kamerbrieven waarvan de titel past bij `rapporten.titel` in
   `pipeline/config.json` en niet bij `rapporten.uitsluiten`. Die kandidaten krijgen meteen het label op Kamerbrieven.
2. Claude beoordeelt nieuwe kandidaten bij "werk de checker bij" in `data/rapporten.json` (sleutel: D-nummer van de bijlage):
   - `{"oordeel": "ja", "uitgever": "PBL", "themas": [...]}`: op de pagina Rapporten. `uitgever` is `null` als de titel en
     de brief het niet zeggen; `themas` zijn die van de brief (mapping, anders de regels).
   - `{"oordeel": "nee", "reden": "..."}`: geen label en niet op de pagina.
   Nieuwe kandidaten vinden: bijlagen met `rapport: true` waarvan het D-nummer niet in `beoordeeld` staat.
3. Rapporten die niet via een Kamerbrief komen (PBL, CBS, WKR die zelf publiceren) staan met de hand in
   `data/kerndocumenten.json`, groep `rapporten`. Staat het D-nummer daar als `document`, dan telt de handmatige regel.

Beoordeel op de titel van de bijlage plus het onderwerp van de brief; open het document alleen bij twijfel.

## Wel

- Eindrapporten van onderzoek, evaluaties (ook tussentijdse beleidsevaluaties) en IBO's.
- Adviezen van adviesraden, planbureaus en kennisinstellingen (Rli, WKR, WRR, SER, Raad van State, PBL, RIVM, TNO, ACVG, SodM).
- Jaarlijkse monitors en balansen over landelijk beleid (Monitor RES, Monitor Energiebesparing, Staat van ons Klimaat).
- Juridische adviezen over landelijk beleid (Landsadvocaat).
- Schiphol en Groningen tellen als landelijk beleid.

## Niet

- Tussen-, kwartaal- en voortgangsrapportages (wel: een tussentijdse evaluatie).
- Stukken bij een hoofdrapport: fichebundels, doorrekeningen, achtergrondrapporten, factsheets, reviews, samenvattingen.
- Onderzoek over één locatie, gebied, bedrijf of project (Werkplaats Fellenoord, Tata Steel, Chemelot, LHB Rotterdam).
- MER en passende beoordelingen; routinetoetsen en technische adviezen (ATR, CDM, NEN).
- Ambtelijke nota's en adviezen bij de voorbereiding van een besluit.
- Peilingen en enquêtes zonder beleidsadvies; kabinetsreacties en brieven.
- Wat geen milieubeleid is (dierenwelzijn, vuurwerk, ICT-toetsen).
- Hetzelfde rapport twee keer (pdf en docx, of opnieuw meegestuurd): alleen de eerste.

## Twijfelgevallen

| Kandidaat | Oordeel | Waarom |
|---|---|---|
| Feitenbasis evaluatie NNHS Schiphol | ja | Schiphol is landelijk beleid |
| Expertgroep Gezondheid IJmond (Tata Steel) | nee | één bedrijf |
| Eindrapport Tussentijdse evaluatie NWN | ja | evaluatie, geen voortgang |
| Monitoring BA-maatregelen; Meetmoment 2 | nee | tussentijdse meting |
| Advies RvS Ontwerpbesluit LVB Schiphol | ja | advies van een adviesraad over landelijk besluit |
| ATR-adviezen bij een AMvB | nee | routinetoets regeldruk |
