# Pipeline: welke data erin komt

Geldt naast de root `CLAUDE.md`. Selectie aanpassen gebeurt in `config.json`, nooit in `data/tk/`.

## Sectoren (`config.json`, `sectoren`)

- Vijf sectoren: `klimaat-energie`, `water-adaptatie`, `natuur-stikstof-landbouw`, `circulair-vervuiling`, `ruimte-mobiliteit`.
  Sectoren bepalen wat de pipeline ophaalt; de site gebruikt thema's (zie `assets/CLAUDE.md`).
- Per sector:

| Sleutel | Waarvoor |
|---|---|
| `commissies` | Activiteiten |
| `activiteitTrefwoorden` | Alleen activiteiten met zo'n woord in het onderwerp (nodig voor brede commissies als I&W en LVVN) |
| `kamerstukdossiers`, `zoektermen` | Moties en wetgeving |
| `stukDossiers`, `trefwoorden` | Stukken van ministeries |

- Soorten activiteiten: `ACTIVITEIT_SOORTEN` in `fetch_tk.py`, inclusief inbrengtermijnen
  (Inbreng schriftelijk overleg, Inbreng verslag, Inbreng feitelijke vragen).

## Wetsvoorstellen, moties en amendementen (sinds 13 nov 2026)

- **Wetsvoorstellen** vanaf 2019 (`wetgeving.startdatum`; de Klimaatwet uit 2016 via zijn dossier) komen erin als:
  het Kamerstuk in een sector of in `wetgeving.insluiten` staat, K&GG voortouw heeft (`altijdVoortouw`),
  of een sector-trefwoord in de (citeer)titel staat.
- `wetgeving.uitsluiten` houdt Kamerstukken (met hun moties en amendementen) eruit die wel een trefwoord hebben
  maar geen milieubeleid zijn (vuurwerk, energietoeslag, volkshuisvesting).
- **Moties en amendementen** alleen uit de huidige Kamerperiode (`startdatum`), als ze:
  - uit een vast dossier komen; of
  - een sector-trefwoord in het onderwerp hebben (namen van indieners tellen niet; `schone_tekst()`); of
  - bij een gevolgd wetsvoorstel horen; of
  - (sinds 17 nov 2026) zijn ingediend tijdens een gevolgde vergadering (commissiedebat, wetgevingsoverleg, notaoverleg
    of tweeminutendebat; `motiesViaVergadering` in `config.json`), ook zonder trefwoord (bv. "1 mol per hectare" bij het
    wetgevingsoverleg Fonds voor stikstof, landbouw en natuur). Brede plenaire debatten, begrotingen en dierenwelzijn
    tellen hiervoor niet. Toegevoegd na vergelijking met de Greenpeace-nieuwsbrief "In de wandelgangen".
- Zoektermen kijken alleen naar het onderwerp: de Titel van een motie is de titel van het dossier.
- Brede dossiers (`"breed": true` bij een kamerstukdossier, `stukken.bredeDossiers`; nu 21501-33, Raad VTE met ook telecom)
  tellen alleen samen met een trefwoord.
- Een wetsvoorstel zonder trefwoord volgen: Kamerstuknummer in `wetgeving.insluiten`; onterecht: in `wetgeving.uitsluiten`.

## Relevantiepoort

Wat bij de themareview bewust geen thema kreeg (`themas: []` in `data/themas-mapping.json`) is geen milieubeleid.
`fetch_tk.py` haalt het uit `zaken.json` en `stukken.json` (een vraag en haar antwoord samen); het aantal staat in
`meta.json` onder `uitgesloten`. "Zonder thema" bij de review betekent dus: weg van de site.

## Stukken (`data/tk/stukken.json`)

- Kamerbrieven, Kamervragen (soort `Schriftelijke vragen`, met `indieners` en de ministeries waaraan ze gericht zijn) en
  antwoorden die bij een sector horen (KGG altijd).
- Elk stuk heeft een `zaak`; een vraag en haar antwoord delen die en komen er altijd samen in.
- Te ruim of te krap: `stukDossiers`/`trefwoorden` of `stukken.uitsluiten` in `config.json`.
- Bijlagen (sinds 17 nov 2026): uit `BijlageDocument` (beslisnota, rapporten, juridische analyses) in `bijlagen`
  (`id`, `titel`, `bestand` PDF/DOCX, `link` naar tweedekamer.nl/downloads).
- Rapporten (sinds 20 nov 2026): een bijlage waarvan de titel past bij `rapporten.titel` in `config.json` en niet bij
  `rapporten.uitsluiten` krijgt `rapport: true` en staat vooraan in `bijlagen`. Claude beoordeelt die kandidaten in
  `data/rapporten.json` (`agent_docs/rapporten.md`). Te ruim of te krap: de patronen in `config.json`.
- Voor de documentweergave zet `fetch_tk.py` `docId` en `bestand` (PDF, DOCX) bij moties, amendementen, stukken en
  bijlagen, en `volgnummer` bij moties en amendementen.

## Teksten (`data/tk/teksten.json`, `teksten.py`)

- Bron: de XML van officielebekendmakingen.nl (`kst-<dossier>[-<toevoeging>]-<volgnummer>`; "Officiële tekst").
  Zolang die er niet is: het pdf- of Word-bestand van de Kamer (`bron: "pdf"`; op de site zonder bronregel), alleen als de opbouw
  herkenbaar is, anders geen tekst.
- Incrementeel: officiële teksten blijven staan, voorlopige worden elke run opnieuw geprobeerd.

## Stemmingen (`data/tk/stemmingen.json`, sinds 17 nov 2026)

- Uit de plenaire `Stemmingen`-activiteiten: `{zaaknummer: {datum, tijd, activiteit}}` (tijd: Nederlandse begintijd, als de Kamer die geeft); de eerstvolgende geplande stemming gaat voor.
- `app.js` leest ook nog het oude formaat `{zaak: datum}`.

## Toezeggingen (`data/tk/toezeggingen.json`)

Het toezeggingenregister van de Kamer, alleen bij gevolgde activiteiten plus de ministeries in
`toezeggingen.altijdMinisteries`. De pagina is weg; de site toont ze in de samenvatting van de vergadering.

## Debatten en vervangen amendementen (`zaken.json`, sinds 19 nov 2026)

- `debatten` bij elk wetsvoorstel (`wet_debatten()`): plenaire debatten, wetgevings- en notaoverleggen met die zaak op de
  agenda, alle datums en commissies (`Nummer`, `Soort`, `Datum`, `Status`, `tkLink`). Voor de fase op Wetgeving; `activiteiten.json`
  heeft alleen de huidige Kamerperiode en de gevolgde commissies.
- Uitslag `vervangen` (`markeer_vervangen()`): een amendement zonder uitslag waarvoor een later amendement "ter vervanging van
  nr. X" in hetzelfde Kamerstuk is ingediend. Daar wordt niet meer over gestemd.

## Kamerstukken per wetsvoorstel (`data/tk/wetstukken.json`, sinds 19 nov 2026)

`{Kamerstuknummer: [stukken op volgnummer]}` voor elk gevolgd wetsvoorstel (`wetstukken()`, tien Kamerstukken per query):
koninklijke boodschap, voorstel van wet, memorie van toelichting, advies Raad van State, verslag, nota's, brieven. Met
`docId`/`bestand` voor de documentweergave en `link` naar tweedekamer.nl. Moties en amendementen niet (die staan in `zaken.json`).

## Eerste Kamer (sinds 23 nov 2026, `eerste_kamer()`)

De Eerste Kamer heeft geen OData zoals de Tweede Kamer; haar Kamerstukken komen uit de SRU-zoekdienst van
officielebekendmakingen.nl (`repository.overheid.nl/sru`, `sru()`). Alleen Kamerstukken (`kst-`, geen bijlagen), één per
Kamerstuk en ondernummer (`ek_uniek()`).
- Per door de Tweede Kamer aangenomen wetsvoorstel: de Eerste Kamer-stukken (A, B, C, ...; geen moties) en de
  Staatsblad-publicatie (`w.behandeldDossier`), achteraan in `wetstukken.json` met `kamer: "Eerste Kamer"` of `"Staatsblad"`.
  Twee zoekvragen per wet.
- Brieven en verslagen (schriftelijk overleg) vanaf de startdatum, niet bij een wetsvoorstel: in `stukken.json` als soort
  `Brief regering` met `kamer: "Eerste Kamer"`, `ekSoort` (Brief, Verslag, Overig) en `link` naar officielebekendmakingen.nl.
  Binnen als het Kamerstukdossier gevolgd wordt of de titel een trefwoord van een sector heeft. Het ministerie komt uit de
  titel ("van KGG", `EK_MINISTERIES`); anders leeg.
- Moties, stemmingen en vergaderingen van de Eerste Kamer niet (staan alleen als webpagina op eerstekamer.nl).

## Begrotingen (`data/tk/begrotingen.json`)

Miljoenennota, de begrotingen van de twee nieuwste jaren en het laatste jaarverslag per hoofdstuk in
`kerndocumenten.hoofdstukken` (nu XXIII KGG, M KEF, XIII EZK, XIV LVVN, XII IenW, A Mobiliteitsfonds, J Deltafonds,
XXII VRO, VII BZK), plus Belastingplan, Voorjaars- en Najaarsnota en het Financieel Jaarverslag van het Rijk.
Elk met het hoofddocument (memorie van toelichting of jaarverslag) met `zaak`, `docId` en `bestand`.

## Overige scripts

- `maak_ics.py`: `data/agenda.ics` met geplande en recente activiteiten plus mijlpalen met vaste datum; inbrengtermijnen
  als hele dag. De abonneerknop is weg, de feed blijft voor bestaande abonnementen.
- `themas_noscript.js`: thema's met tellingen in het `<noscript>`-blok van `index.html`.
- `themas_review.js`: wekelijkse review (zie `assets/CLAUDE.md`, Thema's).
- `versie.js`: zet `?v=<hash van de inhoud>` bij elk bestand uit `assets/` in `index.html`.
