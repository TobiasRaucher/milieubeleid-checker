# DESIGN.md: milieuradar

The design rules for this site. Every change to the look of milieuradar starts here. The values live as tokens at the top of `assets/style.css`; this file says what they are for and what is not allowed. If a rule here and the code disagree, the code is wrong.

Desktop only (Tobias, 14 Nov 2026): the phone rules below describe what the code already does; new parts are not designed or checked at phone width.

Set in the unslop pass of 13 Nov 2026 (method: unslop by Damir Sokolovsky, [@heydamir](https://x.com/heydamir), CC BY 4.0).

## Direction

- **Product.** A Dutch monitor of environmental and climate policy in the Tweede Kamer (laws, moties, debates, ministry letters, agenda), shown next to the measurements that policy answers to, for people who read policy for a living.
- **Character.** Exact, sober, alert.
- **World.** The measurement desk: monitoring stations, instrument readouts, CBS, PBL and RIVM tables and typeset Kamerstukken.
- **Moments.** The emissions chart "Wat Nederland uitstoot", the largest drawn thing on Overzicht and the first block under the short intro, in a card: the measured line is the only vermilion, and the targets from the Klimaatwet and the stikstofwet sit next to it as quiet reference lines. The chrome stays quiet around it.
- **Signature.** The peildatum stamp: every figure carries its source and date in one mono caption, in one format (`Tweede Kamer open data · stand 11 nov 2026`). Vermilion only ever means past the limit or happening now (since 17 Nov 2026; vote outcomes are shapes in ink).

## Tokens

### Palette (since 17 Nov 2026): two main colours and one signal

Warm paper and petrol ink carry the whole site; vermilion is the one deliberately "off" colour and means only "now, or past the limit". Light only.

| Role | Token | Value |
| --- | --- | --- |
| Page (warm paper) | `--page` | `#f3f0e8` |
| Card (a step lighter than the paper) | `--card` | `#fbfaf6` |
| Surface (panels, tiles, table head) | `--surface` | `#e9e5da` |
| Raised (pressed, active row, search highlight) | `--raised` | `#dfdacd` |
| Hairline | `--line` | ink at 12% |
| Hairline on hover | `--line-sterk` | ink at 24% |
| Primary text (petrol) | `--ink` | `#0f2e33` (12.6:1 on paper, 13.8:1 on card) |
| Secondary text | `--ink-2` | `#3d5559` (7.0:1 on paper) |
| Muted text, meta only | `--muted` | `#56696c` (5.1:1 on paper, 4.6:1 on surface) |

### Selection

- `--accent` is petrol (`#0f2e33`, the ink), hover `#1d4349`; text on it is `--card`. It is not a colour accent: it is the selected state (chips, the Agenda view switch, a theme chip in use as a filter), the primary button, focus rings and checkboxes.
- `--accent-soft` `#e4e9e6` only for a checked filter row and the current row in a menu. A focused field gets a 2px petrol edge (border plus a 1px ring).
- Text that used to be green is ink: the document type that opens each row of Net binnen (ink at 500; supersedes Tobias's choice of 13 Nov 2026, by his choice of 17 Nov 2026), badges, filter counts, link hover.

### Signal and meaning

- `--alarm` `#e8461e` vermilion (lines, marks, borders, fills; 3.5:1 on paper, never as text) and `--alarm-tekst` `#a82f0c` (text, 6.0:1 on paper). `--alarm-soft` `#fbe7df` is only for today's row on Agenda.
- Vermilion is used for: the tall bar of the logo, today and the next item on Agenda, the measured series in the emissions chart, and a chance below 50% on the chance tile. Nothing else; it never marks a selection, a hover or a vote outcome.
- Status dots are a shape in ink, not a colour, so no outcome looks good or bad: aangenomen/afgedaan a filled dot, in behandeling/aangehouden/openstaand a half-filled dot, verworpen a ring, ingetrokken/vervallen a filled `--neutraal-stip` `#a3adab`. The word carries the meaning and stays ink.
- Themes have no color (since 13 Nov 2026). See "Themes".

### Type

- Families: **DM Sans** (400, 500, 600) for everything; **DM Mono** (400, 500) only for source stamps, the header stamp, chart axes, end labels and reference labels, and Kamerstuk, zaak and document numbers. Dates and times are DM Sans with `tabular-nums`.
- Sizes (`--t-*`): 12 meta and stamps, 13 captions, 14 controls and tables, 15 body, 18 card titles, 20 section heads (and the wordmark on phones), 24 the wordmark, 30 page titles and key figures. Mobile only: 24 for stat figures.
- Weights: 400 body, 500 headings and figures, 600 for rare emphasis (`<b>`, group heads). Never 700.
- Tracking: 0 below 20px; −0.005em at 18 to 20; −0.015em at 24 (wordmark); −0.02em at 30.

### Spacing

4px grid: **4, 8, 12, 16, 20, 24, 32, 40, 48, 64**. 1px and 2px only as nudges inside small controls.

- Inside controls 4 to 12; list rows 12 apart; groups 12 to 24; above a section head 40; page bottom 64.
- Card padding 20 (16 on phones), indicator cards 24, filter bar 16, stat cells 16/20.
- Controls 36 tall (32 for compact chips), main tabs 36.
- Header (since 17 Nov 2026): at most seven items. Kamerstukken is a tab button with a chevron that opens a menu card (`.tab-lijst`: `--card`, `--line`, radius 12, rows radius 8, current row on `--accent-soft`) from the button, on hover, click or arrow down; the sliding indicator sits under the button. Search is a 36px square button (`--surface`, radius 8) with the magnifying glass right after the tab bar; it widens into the search field (280px). "Over" lives in the footer.

### Radii

| Element | Token | Radius |
| --- | --- | --- |
| Tag, label, keycap (keycap 4) | `--r-tag` | 6 |
| Button, field, select, chip, menu row | `--r-control` | 8 |
| Card, tile, menu | `--r-card` | 12 |
| Panel (filter bar) | `--r-panel` | 16 |
| Main tab bar and its tabs (also the Kamerstukken menu button) | | pill (the only pill on the site) |
| Large switcher (Moties/Amendementen) | `--r-card` / `--r-control` | 12 outside, 8 per segment |

Nested: inner = outer minus padding, never below 4.

### Icons

lucide, inline SVG through `ico()` in `assets/app.js` (class `.ico`): **16px, stroke 1.5, `currentColor`**. Back-to-top is 18px. The select/disclosure chevron is one data-URI (`--chevron`, 16px, stroke 1.5). External links get a 12px arrow-up-right as a CSS mask, nothing else. No Unicode glyphs as icons (no ✓ ✕ ▶ ↑ → ↗).

### Motion

- One curve: `--ease` = `cubic-bezier(0.22, 1, 0.36, 1)`.
- Durations: `--d-kort` 150ms (hover, press, toggles), `--d-menu` 200ms (menus, tooltips), `--d-lang` 320ms (page entrance, expand, tab indicator).
- Press: `scale(0.98)`. Menus rise 4px and fade. Page entrance: 8px rise and fade, only when the tab changes.
- Transition only color, background, border, opacity and transform, each named.
- Two documented exceptions that animate size: the tab indicator (`.tab-glij`, absolutely positioned so it lays out nothing else) and the summary accordion (`grid-template-rows`, interruptible). Nothing else may animate width, height, top, left, margins or blur.
- No number animates on load.
- `prefers-reduced-motion` turns movement into short fades.

## Rules (do and don't)

**Do**
1. Put every spacing value on the 4px scale; give equal things equal sizes; keep space inside a group smaller than space between groups.
2. Keep icons, labels and numbers in one aligned column; right-align numbers in tables.
3. Use the neutral ramp for every surface, border and text; three text roles only (ink, ink-2, muted).
4. Use vermilion once or twice per screen, and only as the signal: the chart line, today, a chance below 50%. Selection and the primary action are petrol.
5. Show status as a dot plus a word in sentence case (`Aangenomen`, `In behandeling`, `Openstaand`).
6. Use one tag style for document and meeting types (`.tag`), one label style for words next to a title (`.badge`: text, no fill), one selected style (petrol fill).
7. Format dates as `11 nov 2026` in meta, tables and stamps (months `jan feb mrt apr mei jun jul aug sep okt nov dec`, from `MAANDEN_KORT`); the long form `11 november 2026` only inside a sentence. Numbers in Dutch notation (`1.092`, `428,38`) with `tabular-nums`.
8. Give every figure a peildatum stamp (`.peil`): source · place or table · date.
9. Keep one main chart per screen, the largest drawn thing; anything else that shows data is smaller and different in kind (scales, a list with bars, a table).
10. Give hover and focus a visible state inside the palette; keep a 2px petrol focus ring.
11. Keep headlines, labels and buttons without a trailing period; full sentences keep theirs.

**Don't**
1. No hue gradients, gradient text, glows, colored shadows, color washes or blurred glass (`backdrop-filter`).
2. No coloured text in lists, coloured section labels or coloured links. Links are ink with a hairline underline; on hover the underline becomes 2px and solid, the colour stays ink.
3. No vermilion for anything except over the limit, today, eerstvolgend, the measured chart series, a chance below 50% and the logo bar. Not for vote outcomes, selection or hover, not for body text, not for row backgrounds other than today.
4. No hue outside paper, petrol and vermilion: no green, blue or traffic-light colours. No color or icon per theme, sector or category.
5. No uppercase tracked labels, no weight 700, no italic for emphasis, no negative tracking below 18px.
6. No emoji or Unicode glyphs as icons; no arrows appended to link text.
7. No filled badges; no pill shapes outside the main tab bar.
8. No stripes on the left of cards, no double rings, no three signals for one fact.
9. No inline `style=""` for spacing or type in templates; add a class.
10. No equal tiles in a row as a layout default; stats sit in one strip with hairline dividers.
11. No `transition: all`, no looping or bouncy motion, no hover scale on cards.
12. No greeting copy, exclamation marks, hype words or unverifiable claims.

## Charts

- One main chart per screen: the measured series is the only vermilion (2px line, 8% fill, open end point when the last figure is voorlopig).
- Reference lines stay neutral and never take vermilion: a baseline is a muted hairline with a ring at its start; a target line is an ink-2 hairline with a solid ink dot at the target year; a projection is an ink-2 dashed line (4 4) to an open ring. Dashes mean "projection" and nothing else.
- Reference values are labeled once, in DM Mono 12 in the right margin (`1990 226,6`, `doel 102,0`, `raming 101`, `KEV 46–53%`); on phones only the word. Labels never touch: each sits at least 14px below the one above it. A gap is labeled in words next to a thin bracket (`−36% nodig t.o.v. raming`). Labels get a white halo so they stay legible over lines.
- The uncertainty of a projection is a neutral band (`.mi-band`: ink at 7%, no edges) that opens from the last measured point to the projected range; the dashed projection line runs through its middle. Never vermilion. The KEV band sits on Totaal broeikasgassen only.
- Every chart has two minimal axis titles in DM Sans 12, muted: the unit above the y-axis labels (`CO₂-eq (miljard kg)`, `kiloton`) and `Jaar` centered under the years. No rotated text.
- The chance of reaching a target is a quiet tile under the target sentence (`.mi-kans`: `--surface`, radius 8, padding 16): a 12px-style lead line, the figure at 30/500 in ink, a status dot plus the source's own verdict, and the peildatum stamp. No explanatory sentence (removed 13 Nov 2026; the band on the chart already shows the range). The dot is the only signal: a vermilion `--alarm` dot under 50%, a half-filled ink dot 50 to 75%, a filled ink dot above 75%. No vermilion text, no colored border or stripe.
- Group a chart switcher by what decides the target (here: Klimaatwet, Stikstofwet), with the group name as a muted 12px label.

## Overzicht lists

- Order and widths: Net binnen left (3fr), Komt eraan right (2fr) from 1000px; stacked in that order below. Both sections are unboxed headings with a card under them, like "Wat Nederland uitstoot" above them (a card since 16 Nov 2026; the switcher has no top margin inside it). Above everything sits `.ov-intro`: one `h1` (`.ov-lead`, 30/500, ink, max 36ch; the only h1 on the site) and one paragraph (`.ov-uitleg`, 15/400, ink-2, max `--leesbreedte`), 32 above, 8 between, no accent or frame. The first row of Komt eraan is the next plenary vote when one is planned (`komendeStemming()`): `dagKort` date, a `Stemmingen` tag, "n moties en n amendementen" linking to `#moties`, muted "Plenaire stemmingen"; no vermilion and no Eerstvolgend badge. The list stays at six rows. The two cards stretch to one bottom edge: the list grows, the kaartvoet stays at the bottom.
- A Net binnen row is one flowing line, 14/22, pieces 8 apart: the document type in ink at 500 (`Antwoord Kamervragen`, `Kamerbrief`, `Motie`, `Amendement`, `Wetsvoorstel`), the date (muted, tabular), the status (dot plus word) or the ministry or Kamerstuk number (ink-2), the title (ink, 15/500, the link), then a muted 13px tail: indiener as surname plus fractie with c.s. (same `indienerKort` as the Moties table) and `· Voor X / Tegen Y`, the Kamerstuk number and title for a stuk, or the Kamerstuk number for a wetsvoorstel. Names in titles lose their initials after "het lid" or "de leden". Type label, date, indiener and vote never break inside themselves.

## Themes

Ten fixed themes, defined once in `THEMAS` in `assets/themas.js` (slug, label, order, description). Every page that shows themes (Thema's, the filter on Agenda, chips on rows) reads that constant; nothing else defines a theme name or order.

- **No color, no icon per theme.** A theme is a word. Theme chips (`.tchip`) are neutral outline chips: 12px ink-2 text, `--line` border, radius 6. Clickable chips get `--line-sterk` and ink on hover; a 4px invisible extension keeps the hit area at least 24px tall. The selected state (a theme chosen as filter on Agenda, where a chip click toggles that filter) is the one petrol fill, as for every chip.
- **Overview (`#themas`).** Page title, then the ten themes in fixed order as a 5 × 2 grid of name-only cards (`.themagrid`, `repeat(5, 1fr)`, gap 16; Tobias, 14 Nov 2026). This is a list of destinations, not a row of stat tiles, so Don't 10 does not apply. Each card is one `<a>` (`.themakaart`, min-height 96) holding only the title (18/500). No intro line, counts or next moment: everything else lives on the theme page. Hover: border to `--line-sterk` and an underline on the title (like `.ltitel`); focus: the 2px petrol ring. No fill and no vermilion on the cards.
- **"items".** Counts on the theme page say "items" because they count across document types (Tobias's request of 13 Nov 2026). This is the one exception to the template-check rule against generic units; everywhere else, name the parliamentary unit.
- **Empty theme.** The card stays (just the name); the taxonomy is fixed, so a theme is never hidden. The theme page says "Nog geen items".
- **Unknown slug.** Page title "Thema niet gevonden" and one sentence with a link back to `#themas`, no card.
- **Detail (`#themas/<slug>`).** A small "Alle thema's" link above the page title, the description at body size under it, then one `.motiekop` row: a small switcher (`.schakelaar.klein`: the `.schakelaar` shape at 15px, 36px tall, each option with its count in 13 muted tabular figures) and, on every tab but Overzicht, the search field on the right. Options: Overzicht, Wetten, Amendementen, Moties, Kamerbrieven, Kamervragen, Vergaderingen, Agenda, Kerndocumenten; types without items are left out. Kamervragen are one row per question with the answer, as on `#vragen` (`?type=antwoorden` opens Kamervragen). Since 14 Nov 2026 (`themaDetail()` in app.js):
  - **Overzicht** (default): Net binnen and Komt eraan as on the home page (`.ov-onder`), limited to the theme; the card footers link to the theme's tabs and to `#agenda?thema=<slug>`.
  - **Wetten, Amendementen, Moties, Kamerbrieven, Kamervragen**: the same table as the main page (`themaDef()` wraps `WET_DEF`, `motieDef()`, `BRIEF_DEF`, `VRAAG_DEF`): rows limited to the theme, no Thema column or filter, the other column filters, search and date sort as usual. One muted line under it links to the full table filtered on the theme.
  - **Vergaderingen, Agenda, Kerndocumenten**: the `.themaregel` list (newest first; Agenda soonest first), 20 rows plus a light "Toon alle" button. The search field filters the rows on text. A row: meta line (date, type and commissie), the title (internal link to its meeting on the Agenda), the item's other themes as `a.tchip`, and "Meer details".
- **Routes.** `#themas`, `#themas/<slug>` (Overzicht) and `#themas/<slug>?type=<param>` plus the table's own filters, `q` and `volgorde` (`param` from `SOORTEN`; tables write that address through `def.adres` and `def.vast` in `bindTabel()`).
- **Without JavaScript.** `pipeline/themas_noscript.js` writes the ten themes with their counts and descriptions into the `<noscript>` block of `index.html` (between the `themas:begin`/`themas:end` markers; the Action runs it daily). Hash routes need JavaScript; that is a known limit.

## Agenda

One page for what is coming and what has been: planned and held Kamer meetings, summarized meetings and milestones, on one timeline by week and day. It replaced the Vergaderingen tab (with its Toezeggingen and Per fractie subtabs) on 13 Nov 2026.

- **Head.** Page title "Agenda" with only the view switch on the right (two `.chip`s, "Vanaf vandaag" and "Terugblik", the selected one in petrol fill). The head is identical in both views, so nothing shifts when switching. No intro line, no counts, no subscribe menu.
- **Filter bar.** The `.filterbalk` panel: Type, Commissie, Ministerie and Thema as `details.facet` checkbox menus (several values, "or"; facets combine, "and"), each option with its count under the other filters and options at zero in muted text; themes in the fixed `THEMAS` order, the rest by count. No filter on summaries. Active filters show as removable chips with "Alles wissen". Everything is in the URL.
- **Timeline.** Weeks (`h3.tl-weekkop`), days with a date column, rows (`.tl-item`): time, meta line (type `.tag`, `Eerstvolgend` badge, commissie, `Kort` badge for a short summary), the title (ink; links to the Kamer page and gets the external arrow), theme chips (clickable: toggle that filter). Today is the only `--alarm-soft` day; the next meeting is the only row with a vermilion border. Past rows have ink-2 titles.
- **Vanaf vandaag** starts at the top of the page with today and shows only what is coming. Opening the tab or switching views always starts at the top. **Terugblik** shows only what has been, newest week and day first (rows within a day stay in time order).
- **Summary.** A summarized meeting gets the "Toon samenvatting" toggle (36px, chevron rotating 180°) under its chips; the body expands with the accordion (`grid-template-rows`, the one allowed size animation) and keeps the two-column layout from 1100px: content left (links, Aanzet, Kern, Standpunten fracties, Toezeggingen, Moties, Vervolg), agendapunten and deelnemers right, the peil stamp and "Samenvatting inklappen" at the bottom. Open summaries stay open when the list is redrawn. A second activity that shares a summary shows one small link to it instead of a second copy. A held meeting without a summary may show a `details.motiedetails` line with its moties.
- **Agenda of a meeting** (since 16 Nov 2026). A meeting without a summary but with agendapunten gets the same toggle, labelled "Toon agenda (n punten)" / "Verberg agenda", with the same accordion: agendapunten left (numbered; per point "Te behandelen:" and its stukken sorted by Kamerstuknummer, the stuk's subject left out when it repeats the point; moties and amendementen carry their `.status`: the uitslag, or "Stemming di 17 nov" from the plenary Stemmingen agenda), deelnemers right, "Agenda inklappen" at the bottom. Under the points one quiet link per Kamerstukdossier, "Alle moties bij Kamerstuk 32813" (`#moties?q=32813`). No toggle when the only point repeats the title without stukken. Summaries show the same agendapunten block. `#agenda/a-<nummer>` opens it.
- **Meta extras.** Room (`zaal`: Locatie, reserved room, or "Plenaire zaal" for plenary debates; the Kamer data often leaves it empty, then nothing shows) and a quiet `Besloten` badge. A public meeting of today that has not ended gets one small external link "Live op Debat Direct" under the title.
- **Inbreng deadlines.** Inbreng schriftelijk overleg, Inbreng verslag and Inbreng feitelijke vragen are rows on their day without a time; the meta line says "Inbreng tot 14:00". They never get the Eerstvolgend border.

## Kerndocumenten

A reference page (`#documenten`, since 17 Nov 2026) for the fixed documents of policy research. It has a head row like Wetgeving (`.motiekop`: page title "Kerndocumenten" at 30px, a Thema `details.facet` next to it, the search field on the right), then active filters as removable chips with "Alles wissen". There is no intro text and no counts.

- **Groups.** Each group is a section heading (20/500, like Net binnen) with a card under it, in the fixed order from `data/kerndocumenten.json`. Groups without a match disappear while filtering; nothing matching shows one empty card with "Filters wissen".
- **Row.** Each row is the `.themaregel` pattern: a meta line (`.tag` for the kind of document, the `11 nov 2026` date, the publisher, the official identifier in DM Mono: Kamerstuk, D-number, ECLI, BWBR, CELEX), the title as an external link with the arrow, theme chips, optional secondary links (13px, ink-2) and "Eerdere edities (n)" as `details.meer`. Only the newest edition per series shows.
- **Order.** Begroting en financiën starts with the budget cycle (Miljoenennota, Belastingplan, Voorjaarsnota, Najaarsnota, Financieel Jaarverslag), then the file order. Other groups follow the file order, which is curated, not by date.
- **Chapters table.** Budgets and annual reports per chapter form one table in the Begroting group: chapter letter (DM Mono 13, ink-2), name with theme chips, one column per budget year and the latest annual report. Cells are the document number (DM Mono 13, links to the PDF) with a small second link (Rijksfinanciën for the newest budget, Rekenkamer for the annual report). A `.peil` stamp names the Kamerstuk. There are no status dots and no accent.

## Tables

The Moties/Amendementen table is the reference for every data table. Wetgeving and Vragen & Brieven (since 13 Nov 2026) are siblings built from the same code (`tabelPagina()`/`bindTabel()` with a definition per page in app.js): same header row, column filters, date sort, disclosure and phone layout. Filters, search and date order live in the URL (`#vragen?status=Open&thema=…&q=…&volgorde=oud`); the switcher carries the filters both halves share.

- Above the table: the large switcher (`.schakelaar`) left, one search field right-aligned on the same row (`.motiekop`, 44px high; stacked on phones). The tab is called "Moties & Amendementen". The switcher stands in for the page title (the `h2` stays for screen readers only) and has the shape of the main tab bar: a raised white segment on `--surface`, 44px segments at 20px/500 (18px on phones), outer radius 12 and inner 8. No count line and no dropdowns above the table.
- Column order: Thema (theme chips, stacked, 132px; a filter like Uitslag, with "Geen thema" for rows without one), title (header "Motie over..." or "Amendement over..."; titles start lowercase so they read on from the header, acronyms stay as they are), a 44px cell for the row's disclosure button right next to it, Uitslag, Appreciatie kabinet, Indiener, Kamerstuk, Datum. The title takes 38% and wraps; every other column stays on one line. The date is always the last column.
- Text columns align left; dates and Kamerstuk numbers align right (`tabular-nums`; Kamerstuk numbers in DM Mono 13). Header text sits on exactly the same line as the cell text below it: header cells have the same horizontal padding as body cells, and a header button has no padding of its own.
- One line height for every body cell (22px at 14px), so first lines share a baseline. A status (dot plus word) is `display: flex` inside a cell; an inline-flex status takes its baseline from the empty dot and drops 1px.
- Filtering: a categorical column header is a button (`.kopfilter`) with a chevron that opens a checkbox menu (`.kopmenu`, a popover in the top layer so the table edge never clips it). Several values per column ("or"), columns combine ("and"). Each option shows how many rows it would give under the other filters; options at zero stay in the list in muted text. A column in use shows its count at 500 next to the label; the menu has "Wissen" at the bottom once something is checked. The checkboxes line up under the header text. Escape, a click outside or tabbing out closes it. The chevron means "menu"; only the arrow means "sort".
- Sorting: only dates sort (a button inside the `th`, `aria-sort` on it). One click reverses the order; the arrow sits right of the label. Empty dates sort last.
- Empty result: "Geen moties met deze filters" with a "Filters wissen" link button.
- Row: hover is `--surface`, pressed `--raised`, an open row stays `--surface`. When the whole row opens a link, the title is the real `<a>` (keyboard and middle click), the row click repeats it, and a hover underlines the title in `--line-sterk`. Other actions in the row are buttons that do not trigger the row.
- Disclosure: a 32px ghost button with the 16px chevron, rotating 180° when open; the detail row is `--surface`, indented to the title's text edge.
- Detail row: data only, no title repeat, no history, no bars. Three groups 16 apart at 13px: the identifiers line (`Zaak … · document … · ingediend …, door …`, numbers in DM Mono), the vote (`Voor 111 / Tegen 36`, then the fracties voor and tegen as two columns, stacked on phones, alphabetical, ink-2), and the links below a hairline.
- External arrow in a wrapping title: put it inside a no-wrap span with the last word, so it never sits alone on a line.
- Wetgeving (since 17 Nov 2026): switcher "Wetsvoorstellen | Geldende wetten" (`#wetgeving`, `#wetgeving/wetten`); the `h2` is for screen readers. Geldende wetten: Thema, Wet (opens wetten.overheid.nl), disclosure, Kenmerk (BWBR).
- Kerndocumenten (since 17 Nov 2026): the same pattern, switcher "Kabinet | Begroting | Ramingen | Advies | Rechtspraak" (`#documenten/<groep>`). Columns: Thema, Document, disclosure, Soort, Hoofdstuk (Begroting only; "Rijksbreed" when empty), Uitgever (wraps like a ministry), Kenmerk (Kamerstuk as `37020-XII`, ECLI or D-nummer, DM Mono), Datum. One row per series (newest edition). Detail row: identifiers, "Eerdere edities (n)" as a list with date, kenmerk and "Lees", then the links ("Bekijk het origineel", the source page, Kamerstukdossier, Rijksfinanciën, Rekenkamer). A row never links to a download: Kamer documents open their page on tweedekamer.nl.
- Wetsvoorstellen: Columns: Thema, Wetsvoorstel, disclosure, Status, Ingediend door (Regering or the initiatiefnemers), Kamerstuk, Ingediend. Filters: Thema, Status, Ingediend door. Detail row: identifiers, the last four steps (besluiten with date), links to tweedekamer.nl and OpenTK. Rows open the bill on tweedekamer.nl (`MRThemas.tkUrl`, by Kamerstuknummer; since 14 Nov 2026).
- Vragen & Brieven: switcher "(Antwoord) Kamervragen | Brieven" ("Kamervragen" on phones); the `h2` "(Antwoord) Kamervragen & Brieven" is for screen readers. Kamervragen: one row per zaak, the question with its answer(s). Columns: Thema, "Vragen over...", disclosure, Status (Beantwoord a filled dot; Open and Termijn verstreken a half-filled dot, the word tells them apart; the term is 21 days), Gesteld door (surname plus fractie, c.s.), Gericht aan (ministry, wraps), Gesteld. Detail row: identifiers, the answer(s) with date, signatory and number of days, or "Nog niet beantwoord, n dagen na het stellen", links to question and answer. Brieven: Thema, "Kamerbrief over...", disclosure, Ministerie (wraps), Kamerstuk, Datum; detail row with signatory and Kamerstuk titles. Attachments (since 17 Nov 2026): a "Bijlagen (n)" group in the detail row of a letter and of an answer, one link per attachment (title as in the Kamerdata, file type in muted DM Mono, beslisnota last), between the data groups and the links. Ministry cells are the one exception to "one line": they wrap at 280px.
- Text of a motie or amendement (since 17 Nov 2026): a "Tekst" group right under the identifiers line, at 14/22 (body text, unlike the 13px data around it), max `--leesbreedte`. Overwegingen and the opening in ink-2, the decisive part ("verzoekt de regering", "spreekt uit", and "en gaat over tot de orde van de dag") in ink; no italics, no accent. An amendement shows its Toelichting first (the kop "Toelichting" at 13/500 ink) and the change itself behind `details.meer` "Toon de wijziging zelf"; more than ten paragraphs fold after eight ("Toon de rest (n alinea's)"). Under the text one 12px muted source line: "Officiële tekst · Kamerstuk 36947, nr. 43" (link) or "Voorlopige tekst uit het pdf-bestand; …".
- Document buttons: in the links row, before the external links, a text button in ink at 500 with the hairline underline ("Bekijk het origineel", "Lees de brief", "Lees de vragen", "Lees het antwoord"; "Lees" after an attachment). No arrow: it stays on the site.
- Document viewer (`dialog.docview`, since 17 Nov 2026): a modal of 960px wide and the window height minus 48, white, `--line` border, radius 12, one soft neutral shadow; backdrop ink at 32%. Head: meta in DM Mono 12 muted (`PDF · 2026D58358 · 3 pagina's`), the title at 18/500, then "Download" and "Op tweedekamer.nl" (13px links) and a 32px close button. Body on `--surface` with 24 padding: pdf pages as white sheets with a hairline, 16 apart, at most 860 wide, drawn when they come near the viewport, with a selectable text layer; Word files as one white sheet (max 760, 40/48 padding, 15/24 text). Loading and errors are one sentence at 14px with the download link. Escape, the close button or a click on the backdrop close it; the page behind does not scroll.
- Phones (≤640px): the header row becomes a row of 32px buttons (the filters and the date order) on `--surface`; each row becomes a block with the title on top, status and date beneath, the button at the right; secondary columns are hidden.

## Template check

Swap "milieuradar" for another environmental site (a city air-quality monitor, a national climate dashboard) and ask what would still fit. These parts survived the swap, so each one gets a rule:

| Survives the swap | Rule |
| --- | --- |
| Green accent on white | Gone since 17 Nov 2026. The identity is warm paper with petrol ink, the three-bar mark (petrol square, paper bars, one vermilion bar), the lowercase wordmark, and vermilion meaning "now or over the limit" and nothing else. |
| An emissions line chart | Every measurement is shown against the target of the Dutch law that governs it, and only that target: the Klimaatwet line (−55% vs 1990) only on the total of all greenhouse gases; the stikstofwet target only as a reduction against the PBL projection for 2030, never as an invented line back to 1990. The target is stated in one sentence next to the chart. A new indicator without a legal target and that sentence does not ship. |
| A mono source caption | Stamps name the official identifier, not just the organization: `tabel 85668NED`, `Kamerstuk 36169`, zaak and activity numbers, the station. "Bron: CBS" alone is not enough. |
| A stat strip with counts | Stat labels name the parliamentary unit and its period (moties, Kamerbrieven, toezeggingen; "sinds het begin van de Kamerperiode"). Never generic units like items, updates or records. |
| Neutral dashboard chrome | Overzicht always puts measurement and parliament on one screen: the emissions chart first, then the parliament lists. A page with only one of the two is a different product. |

What did not survive the swap, and must stay: the Kamer-native material itself (moties with the vote per fractie, Kamerstuknummers, commissies, toezeggingen, the agenda of the Kamer), equal weight for all fracties, and Dutch throughout.

## Where things live

- Tokens: top of `assets/style.css` ("ontwerpknoppen").
- Icons: `ICO` and `ico()` near the top of `assets/app.js`.
- Emissions chart with its targets: `assets/milieu.js`.
- Themes: `THEMAS`, the rules engine and the shared item list in `assets/themas.js`; keyword rules in `data/themas.json`; approved per-item themes in `data/themas-mapping.json`; review CSV and import in `pipeline/themas_review.js`; noscript list in `pipeline/themas_noscript.js`.

### Known duplication (to dedupe later)

- Four list-item renderers each build their own meta row: `stukLi`, `agendaLi`, `themaRegel`, the zoek item. They share the `.regelmeta`/`.zmeta` style, but the markup is still written five times. `feedLi` (Net binnen) is deliberately different: one flowing line (`.feed`).
