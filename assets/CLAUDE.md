# Site: pagina's en routes

Geldt naast de root `CLAUDE.md` en `DESIGN.md` (lees die eerst bij elke wijziging aan het uiterlijk).
Alleen desktop. Functies staan in `app.js` tenzij anders vermeld.

## Kop en navigatie (sinds 17 nov 2026)

- Tabs: Overzicht, Thema's, Agenda en Documenten (menu in twee kolommen: Kamerstukken met Wetgeving, Moties,
  Amendementen, Kamervragen, Kamerbrieven; Kerndocumenten met de vijf groepen; opent bij hover, klik of pijl omlaag), dan
  een zoekveld dat altijd zichtbaar is (`/` zet de cursor erin) en de stempel "Bijgewerkt". "Over" staat in de footer.
- Op alle documentpagina's is Documenten actief en heeft de menuregel `aria-current` (`route()`, `kdGroep()`).
- Kop en bediening zijn sinds 17 nov 2026 50% groter (`--h-control` 56, `--h-klein` 48); tabeltekst 18 (zie DESIGN.md).
- Tab-aanduiding glijdt mee (`.tab-glij`, `zetGlij()`). `--kop-h` wordt door app.js gezet (tabelkop blijft onder de kop staan).
- Een klik op een tab begint bovenaan; terug/vooruit herstelt de scrollpositie. Knop "terug naar boven", laadskelet in
  `index.html`, foutmelding als de data niet laadt. Lijsttitels (`.ltitel`) in inkt met onderstreping bij aanwijzen.

### Oude adressen (worden omgezet)

| Oud | Nieuw |
|---|---|
| `#vergaderingen…`, `#debatten…` | `#agenda…` (filters blijven, zonder subpad met Terugblik) |
| `#toezeggingen`, `#fracties` | `#agenda?terugblik=1` |
| `#wetgeving/w-<id>` | `#wetgeving` |
| `#stukken` | `#vragen` |
| `#documenten/<groep>…` | `#kerndocumenten/<groep>…` |

## Thema's

- Tien vaste thema's (sinds 13 nov 2026): slug, label, volgorde en beschrijving in `THEMAS` in `themas.js`; alle pagina's
  lezen die. Geen kleur of icoon per thema. Sectoroverstijgend is een inhoudelijk thema, geen restbak.
- Toekenning, in deze volgorde:
  1. `data/themas-mapping.json` (sleutels `zaak:<nummer>`, `stuk:<D-nummer>`, `debat:<activiteitnummer of samenvatting-id>`,
     `agenda:<datum>-<titel>`, `kerndoc:<id>`; velden `themas` en `bron`);
  2. het veld `themas` in een samenvatting;
  3. de trefwoordregels in `data/themas.json`: titel telt altijd, agendapunten pas bij twee treffers, de titel van het
     Kamerstukdossier alleen als de titel niets oplevert (begrotingen alleen als suggestie).
  Geen terugval op sector: zonder treffer blijft een item "te beoordelen".
- Wekelijkse review: `node pipeline/themas_review.js --nieuw` maakt `themas-review-nieuw.csv` (alleen items die nog niet in
  de mapping staan); Tobias kijkt die na; `--import <csv>` zet de rijen in de mapping.
- Alle items die een thema kunnen krijgen komen uit `MRThemas.bronItems` (wetten, moties, amendementen, Kamerbrieven,
  Kamervragen, antwoorden, vergaderingen, agenda, kerndocumenten met de nieuwste editie per reeks). Pagina, CSV en
  noscript-lijst tellen dus hetzelfde.
- `#themas` (sinds 14 nov 2026): alleen de tien namen als 5 x 2 tegels.
- `#themas/<slug>`: schakelaar met Overzicht (Net binnen en Komt eraan voor dit thema; standaard), Wetten, Amendementen,
  Moties, Kamerbrieven, Kamervragen (met antwoorden), Vergaderingen, Agenda en Kerndocumenten, met aantallen. De
  documentsoorten zijn dezelfde tabellen als op hun eigen pagina, zonder Themakolom (`themaDef()`); Vergaderingen en
  Agenda zijn een lijst met zoekveld. Adres: `#themas/<slug>?type=<param>` plus filters.
- Elke lijstpagina heeft een themafilter in de werkbalk (Agenda, Wetgeving, Moties, Amendementen, Kamervragen, Kamerbrieven,
  Kerndocumenten).

## Tabelpatroon

Wetgeving, Moties, Amendementen, Kamervragen, Kamerbrieven en Kerndocumenten gebruiken `tabelPagina()`/`bindTabel()` met
een definitie per pagina: `WET_DEF`, `wettenDef()`, `motieDef()`, `VRAAG_DEF`, `BRIEF_DEF`, `kerndocDef()`, `themaDef()`.
Filters, zoekterm en volgorde staan in de URL. Regels: DESIGN.md, "Tables".
- Werkbalk (sinds 17 nov 2026, ook op Agenda): zoekveld plus een `details.facet` per filter, actieve filters als chips
  (`werkbalk()`, `tekenWerkbalk()`, `bindWerkbalk()`; filteren met `pastFilters()`). Kolomkoppen zijn gewone labels; alleen
  Datum sorteert.
- Na zoeken of filteren meldt een verborgen statusregel het aantal resultaten aan schermlezers (`meldAantal()`, ook op Agenda).
- Elke pagina heeft precies een `h1` (de paginatitel; bij een schakelaar alleen voor schermlezers).
- Kolommen: titel eerst, Thema vlak voor Kamerstuk/Datum. Een klik op de rij klapt de details uit; de titel is de link naar
  de bron. De uitklapknop (`button.uitklap` in de titelcel, `c.titel`) is alleen zichtbaar bij toetsenbordfocus.

## Moties en Amendementen (`#moties`, `#amendementen`)

- Twee pagina's (sinds 17 nov 2026) met dezelfde tabel (`moties()`, `motieDef()`).
- Kolommen: "Motie over..."/"Amendement over..." (titel met kleine beginletter, behalve afkortingen), Uitslag, Appreciatie
  kabinet, Indiener, Thema, Kamerstuk, Datum.
- Filters in de werkbalk: Thema, Uitslag, Appreciatie kabinet en Indiener (meerdere keuzes). Thema zonder thema heet
  "Geen thema". Indiener telt alle indieners; GroenLinks-PvdA telt als PRO (`FRACTIE_ALIAS`).
- Alleen Datum sorteert (pijltje rechts van het woord). Het zoekveld zoekt ook op Kamerstuknummer.
- De titel opent het document op tweedekamer.nl (`tkUrl`, via het D-nummer; zonder D-nummer een zoeklink op het zaaknummer).
- Uitgeklapte rij: zaak, document, indiendatum en indieners; Voor/Tegen in zetels; fracties voor en tegen (uit
  `besluiten[].stemmen`, per fractie ontdubbeld); "Ingediend bij" met link naar `#agenda/a-<nummer>` (bij een
  tweeminutendebat ook het commissiedebat); "Gestemd"/"Stemming gepland" met link naar de plenaire Stemmingen
  (`vergaderRegels()`); links naar tweedekamer.nl en OpenTK.
- Tekst (`tekstBlok()`/`tekstHtml()`): overwegingen in ink-2, het besluitende deel in inkt; bij een amendement eerst de
  Toelichting, de wijziging ingeklapt. `data/tk/teksten.json` wordt pas geladen als iemand een rij openklapt.
- Moties zonder uitslag tonen de stemmingsdatum ("Stemming di 17 nov") uit `S.data.stemmingen` (`{zaak: datum}`) en
  `S.data.stemActiviteit`.
- Koppeling aan vergaderingen (`motieKoppeling()`):
  - Moties: op datum (dag zelf of dag ervoor) plus Kamerstukdossier op de agenda; tweeminutendebat "X (CD d/m)" aan commissiedebat X.
  - Amendementen (alleen voor "Ingediend bij", niet in de motielijst van een vergadering): de eerste plenaire vergadering,
    wetgevings- of notaoverleg vanaf de dag voor indienen tot en met de stemming met het Kamerstukdossier op de agenda,
    alleen als er op die dag precies één is (`actVanZaak`).

## Kamervragen en Kamerbrieven (`#vragen`, `#brieven`; twee pagina's sinds 17 nov 2026)

- `#vragen`: Kamervragen, één rij per zaak met het antwoord erbij; Status Beantwoord, Open of Termijn verstreken (na 21 dagen).
- `#brieven`: Kamerbrieven. Geen introtekst boven de tabel.
- Bijlagen in de uitgeklapte rij van een Kamerbrief en van een antwoord (`bijlagenBlok()`); de zoekfunctie zoekt ook op de titels.

## Documentweergave

Knoppen "Bekijk het origineel", "Lees de brief", "Lees de vragen", "Lees het antwoord" en "Lees" bij bijlagen (`docKnop()`)
openen een venster (`toonDocument()`): pdf met pdf.js, Word met mammoth (beide in `vendor/`, pas geladen bij openen),
rechtstreeks uit het gegevensmagazijn (`Document/<docId>/resource`; CORS staat open, een iframe niet).

## Wetgeving (`#wetgeving`, `#wetgeving/wetten`)

- Schakelaar (sinds 17 nov 2026): Wetsvoorstellen en Geldende wetten. De enige documentpagina met een schakelaar.
- Wetsvoorstellen: uit `zaken.json` (soort Wetgeving of Initiatiefwetgeving) als tabel: Wetsvoorstel, Status, Ingediend door,
  Thema, Kamerstuk, Ingediend.
- Geldende wetten: de kerndocumentgroep met `"pagina": "wetgeving"` (Wettelijk kader), via `wettenDef()`.
- Links via het Kamerstuknummer (`MRThemas.tkUrl`); OpenTK alleen als tweede link in de details.

## Agenda (`#agenda`)

- Eén tijdlijn per week en dag met geplande en gehouden Kameractiviteiten, samengevatte vergaderingen en eigen mijlpalen
  (`tijdlijnItems()`/`renderAgenda()`).
- Grote schakelaar in plaats van de titel: "Vanaf vandaag" (standaard) toont wat komt; "Terugblik" wat is geweest, nieuwste
  eerst. De filters gaan mee.
- Werkbalk: zoekveld (titel, commissie, type) en filters type, commissie, ministerie en thema (`AGENDA_FILTERS`; meerdere
  waarden; geen filter op samenvatting), in de URL (bv. `#agenda?thema=adaptatie&type=Commissiedebat&q=water&terugblik=1`).
  Een klik op een themalabel zet dat thema aan of uit.
- Vergaderingen zonder samenvatting met agendapunten klappen uit met "Toon agenda (n punten)"
  (`agendaBlok()`/`agendapuntenBlok()`/`deelnemersBlok()`; samenvattingen gebruiken dezelfde blokken). Stukken op
  Kamerstuknummer; moties en amendementen met uitslag of stemmingsdatum; per Kamerstukdossier een link naar `#moties?q=<nummer>`.
- Zaal (`zaal`, vaak leeg; plenair = "Plenaire zaal"), label Besloten, en bij openbare vergaderingen van vandaag "Live op Debat Direct".
- Inbrengtermijnen staan zonder tijd op hun dag met "Inbreng tot hh:mm".
- Samenvattingen klappen uit ("Toon samenvatting", of een klik op de regel); bij meer activiteiten staat ze bij de hoofdactiviteit en verwijzen de
  andere ernaar. Samenvatting in twee kolommen: inhoud links, agendapunten en deelnemers rechts.
  Toezeggingen uit het register, anders uit de samenvatting.
- `#agenda/d-<samenvatting-id>` en `#agenda/a-<activiteitnummer>` openen die vergadering (in Terugblik als ze is geweest).

## Kerndocumenten (`#kerndocumenten/<groep>`)

- Tabelpatroon (`kerndocDef()`/`kerndocumentenPagina()`), een pagina per groep (sinds 17 nov 2026): Kabinet, Begroting,
  Ramingen, Advies, Rechtspraak, met het `label` van de groep als titel. Onbekende of lege groep: de eerste (`kdGroep()`).
  De menuregels in `index.html` staan vast: een nieuwe groep in `data/kerndocumenten.json` moet daar ook bij.
- Kolommen: Document, Soort, (op Begroting) Hoofdstuk, Uitgever, Thema, Kenmerk, Datum. Per reeks één rij
  (nieuwste editie); eerdere edities, links en "Bekijk het origineel" in de uitgeklapte rij (`kdDetail()`). Begrotingen en
  jaarverslagen: een rij per hoofdstuk. Thema per hoofdstuk: `HOOFDSTUK_THEMA` in `themas.js`.
- Groepen met `"verborgen": true` (Europese Unie) staan nergens, ook niet op themapagina's of in zoeken
  (`MRThemas.kerndocumenten()` laat ze weg).
- Links openen de pagina op tweedekamer.nl, nooit `downloads/document`:
  - Kamerstukken: `kamerstukken/detail?id=<zaak>&did=<D-nummer>` (zonder `id` geeft de Kamer "Pagina niet gevonden");
  - bij een bijlage (KEN, adviezen): de brief waar ze bij hoort;
  - begroting en Belastingplan: de wetsvoorstelpagina.
  Zet `document`, `docId` en `bestand` erbij voor de documentweergave.
- `data/kerndocumenten.json` (handmatig): titel, soort, uitgever, datum, url, officieel `kenmerk` (Kamerstuk, D-nummer,
  ECLI, BWBR of CELEX), `reeks` (bundelt edities), `themas`. `MRThemas.kerndocumenten()` voegt het samen met
  `data/tk/begrotingen.json`.

## Overzicht (`#overzicht`)

- Volgorde: korte uitleg (`OV_INTRO`: de `h1` van de pagina, 45/500, en één alinea 18/400 in ink-2 met links naar thema's,
  Agenda en de documentpagina's; tekst van Tobias, niet herschrijven zonder te vragen), dan "Hoe staan we er voor?" als kop met kaart
  (`milieu.js`, zie `agent_docs/uitstoot-grafiek.md`), dan Net binnen (breed, links) en Komt eraan (smal, rechts) met dezelfde onderrand.
- Komt eraan: bovenaan de eerstvolgende plenaire stemming (`komendeStemming()`): aantal moties en amendementen zonder uitslag
  met een stemmingsdatum vanaf vandaag, als link naar `#moties`; dan 5 agendaregels. Op een themapagina alleen die van het
  thema; geen stemming gepland, dan geen regel.
- Net binnen (`netBinnen()`): de 10 nieuwste items in één chronologische lijst: stukken (`datum`), stemmingen over moties en
  amendementen (`stemtelling.datum`) en wetgeving (`gestartOp`). Alleen ISO-datums op de dag nauwkeurig en niet in de
  toekomst; binnen één dag gaat Wetgeving voor Stemming voor Stuk.
- Elk item volgt de regelopbouw (DESIGN.md, Do 6): soort (link naar de lijstpagina; `soortTag()`), datum en context; de
  titel op een eigen regel; een staart met indiener zonder voorletters, Voor/Tegen of Kamerstuk. Voorletters in titels weg (`zonderVoorletters`).

## Zoeken

Zie `agent_docs/zoekfunctie.md`.
