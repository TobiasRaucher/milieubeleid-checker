# DESIGN.md: milieuradar

The design rules for this site. Every change to the look of milieuradar starts here. The values live as tokens at the top of `assets/style.css`; this file says what they are for and what is not allowed. If a rule here and the code disagree, the code is wrong.

Set in the unslop pass of 13 Nov 2026 (method: unslop by Damir Sokolovsky, [@heydamir](https://x.com/heydamir), CC BY 4.0).

## Direction

- **Product.** A Dutch monitor of environmental and climate policy in the Tweede Kamer (laws, moties, debates, ministry letters, agenda), shown next to the measurements that policy answers to, for people who read policy for a living.
- **Character.** Exact, sober, alert.
- **World.** The measurement desk: monitoring stations, instrument readouts, CBS, PBL and RIVM tables and typeset Kamerstukken.
- **Moments.** The emissions chart "Wat Nederland uitstoot", the largest drawn thing on Overzicht and the first block on the page: the measured line is the only accent, and the targets from the Klimaatwet and the stikstofwet sit next to it as quiet reference lines. The chrome stays quiet around it.
- **Signature.** The peildatum stamp: every figure carries its source and date in one mono caption, in one format (`Tweede Kamer open data · stand 11 nov 2026`). Red only ever means past the limit, happening now, or a verworpen vote outcome (a traffic light, by Tobias's choice of 13 Nov 2026).

## Tokens

### Neutral ramp (light only)

| Role | Token | Value |
| --- | --- | --- |
| Page | `--page` | `#ffffff` |
| Surface (panels, tiles, table head) | `--surface` | `#f5f6f5` |
| Raised (pressed, active row) | `--raised` | `#eceeed` |
| Card | `--card` | `#ffffff` |
| Hairline | `--line` | ink at 10% |
| Hairline on hover | `--line-sterk` | ink at 20% |
| Primary text | `--ink` | `#16201a` (16.7:1 on white) |
| Secondary text | `--ink-2` | `#4b5751` (7.6:1) |
| Muted text, meta only | `--muted` | `#66706a` (5.1:1 on white, 4.7:1 on surface) |

### Accent

- `--accent` `#1a7f4b`: 5.02:1 on white, white text on it 5.02:1, 4.64:1 on surface. Hover `#156a3e`.
- Used for: the selected state (chips, the Agenda view switch, a theme chip in use as a filter), the primary button, chart lines and fills, completed phases on the stepper, the "radar" half of the wordmark, focus rings, and the document type that opens each row of Net binnen on Overzicht (text at 500, by Tobias's choice of 13 Nov 2026; the only accent text in a list).
- `--accent-soft` `#e6f2ea` only as the focus halo and a checked filter row.

### Alarm and meaning

- `--alarm` `#d6343a` (marks, borders, zones) and `--alarm-tekst` `#b4262c` (text, 6.45:1 on white). `--alarm-soft` `#fdf1f1` is only for today's row on Agenda.
- `--bad` `#d6343a` (same red) is only the status dot for verworpen.
- Status dots, a traffic light: aangenomen/afgedaan `--good` `#1a7f4b`, in behandeling/aangehouden/openstaand `--warning` `#d59a0a`, verworpen `--bad` `#d6343a`, ingetrokken/vervallen `--neutraal-stip` `#a3aba6`. The dot carries the color, the word carries the meaning; the word stays ink.
- Votes: voor `--voor` = ink, tegen `--tegen` `#cdd3cf`. Empty bars and phases not yet reached: `--spoor` `#e4e7e5`.
- Themes have no color (since 13 Nov 2026; the nine colored dots are gone). See "Themes".

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

### Radii

| Element | Token | Radius |
| --- | --- | --- |
| Tag, label, keycap (keycap 4) | `--r-tag` | 6 |
| Button, field, select, chip, menu row | `--r-control` | 8 |
| Card, tile, menu | `--r-card` | 12 |
| Panel (filter bar) | `--r-panel` | 16 |
| Main tab bar and its tabs | | pill (the only pill on the site) |
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
4. Use the accent once or twice per screen: the selection, the primary action, the chart line, one key figure.
5. Show status as a dot plus a word in sentence case (`Aangenomen`, `In behandeling`, `Openstaand`).
6. Use one tag style for document and meeting types (`.tag`), one label style for words next to a title (`.badge`: text, no fill), one selected style (accent fill).
7. Format dates as `11 nov 2026` in meta, tables and stamps (months `jan feb mrt apr mei jun jul aug sep okt nov dec`, from `MAANDEN_KORT`); the long form `11 november 2026` only inside a sentence. Numbers in Dutch notation (`1.092`, `428,38`) with `tabular-nums`.
8. Give every figure a peildatum stamp (`.peil`): source · place or table · date.
9. Keep one main chart per screen, the largest drawn thing; anything else that shows data is smaller and different in kind (scales, a list with bars, a table).
10. Give hover and focus a visible state inside the palette; keep a 2px accent focus ring.
11. Keep headlines, labels and buttons without a trailing period; full sentences keep theirs.

**Don't**
1. No hue gradients, gradient text, glows, colored shadows, color washes or blurred glass (`backdrop-filter`).
2. No green surfaces, green borders as decoration, green section labels or green links (the one exception is the per-row type in Net binnen, see Accent). Links are ink with a hairline underline and turn green on hover.
3. No red for anything except over the limit, today, eerstvolgend and the verworpen status dot. Not for votes against, not for text, not for row backgrounds.
4. No blue or other hue outside the ramp, accent, alarm and the status dots. No color or icon per theme, sector or category.
5. No uppercase tracked labels, no weight 700, no italic for emphasis, no negative tracking below 18px.
6. No emoji or Unicode glyphs as icons; no arrows appended to link text.
7. No filled badges; no pill shapes outside the main tab bar.
8. No stripes on the left of cards, no double rings, no three signals for one fact.
9. No inline `style=""` for spacing or type in templates; add a class.
10. No equal tiles in a row as a layout default; stats sit in one strip with hairline dividers.
11. No `transition: all`, no looping or bouncy motion, no hover scale on cards.
12. No greeting copy, exclamation marks, hype words or unverifiable claims.

## Charts

- One main chart per screen: the measured series is the only accent (2px line, 8% fill, open end point when the last figure is voorlopig).
- Reference lines stay neutral and never take the accent: a baseline is a muted hairline with a ring at its start; a target line is an ink-2 hairline with a solid ink dot at the target year; a projection is an ink-2 dashed line (4 4) to an open ring. Dashes mean "projection" and nothing else.
- Reference values are labeled once, in DM Mono 12 in the right margin (`1990 226,6`, `doel 102,0`, `raming 101`, `KEV 46–53%`); on phones only the word. Labels never touch: each sits at least 14px below the one above it. A gap is labeled in words next to a thin bracket (`−36% nodig t.o.v. raming`). Labels get a white halo so they stay legible over lines.
- The uncertainty of a projection is a neutral band (`.mi-band`: ink at 7%, no edges) that opens from the last measured point to the projected range; the dashed projection line runs through its middle. Never the accent, never red. The KEV band sits on Totaal broeikasgassen only.
- Every chart has two minimal axis titles in DM Sans 12, muted: the unit above the y-axis labels (`CO₂-eq (miljard kg)`, `kiloton`) and `Jaar` centered under the years. No rotated text.
- The chance of reaching a target is a quiet tile under the target sentence (`.mi-kans`: `--surface`, radius 8, padding 16): a 12px-style lead line, the figure at 30/500 in ink, a status dot plus the source's own verdict, and the peildatum stamp. No explanatory sentence (removed 13 Nov 2026; the band on the chart already shows the range). The dot is the only color, as a traffic light: `--bad` under 50%, `--warning` 50 to 75%, `--good` above 75%. No red text, no colored border or stripe.
- Group a chart switcher by what decides the target (here: Klimaatwet, Stikstofwet), with the group name as a muted 12px label.

## Overzicht lists

- Order and widths: Net binnen left (3fr), Komt eraan right (2fr) from 1000px; stacked in that order below. Both sections are unboxed headings with a card under them, like "Wat Nederland uitstoot", which has no card at all. The two cards stretch to one bottom edge: the list grows, the kaartvoet stays at the bottom.
- A Net binnen row is one flowing line, 14/22, pieces 8 apart: the document type in accent at 500 (`Antwoord Kamervragen`, `Kamerbrief`, `Motie`, `Amendement`, `Wetsvoorstel`), the date (muted, tabular), the status (dot plus word) or the ministry or Kamerstuk number (ink-2), the title (ink, 15/500, the link), then a muted 13px tail: indiener as surname plus fractie with c.s. (same `indienerKort` as the Moties table) and `· Voor X / Tegen Y`, the Kamerstuk number and title for a stuk, or the Kamerstuk number for a wetsvoorstel. Names in titles lose their initials after "het lid" or "de leden". Type label, date, indiener and vote never break inside themselves.

## Themes

Ten fixed themes, defined once in `THEMAS` in `assets/themas.js` (slug, label, order, description). Every page that shows themes (Thema's, the filter on Agenda, chips on rows) reads that constant; nothing else defines a theme name or order.

- **No color, no icon per theme.** A theme is a word. Theme chips (`.tchip`) are neutral outline chips: 12px ink-2 text, `--line` border, radius 6. Clickable chips get `--line-sterk` and ink on hover; a 4px invisible extension keeps the hit area at least 24px tall. The selected state (a theme chosen as filter on Agenda, where a chip click toggles that filter) is the one accent fill, as for every chip.
- **Overview (`#themas`).** Page title, one muted intro line that also says how many items are not yet classified, then the ten themes in fixed order as a grid of cards (`.themagrid`, `minmax(300px, 1fr)`, gap 16). This is a list of destinations, not a row of stat tiles, so Don't 10 does not apply. Each card is one `<a>` (`.themakaart`): title 18/500, the total in 14 ink, the count per document type in 13 ink-2 (`3 wetten · 5 moties · 2 brieven`, singular when 1, types in the order of the detail page), and at the bottom the eerstvolgend moment: the type as a `.tag`, the date, and the title on one muted line with an ellipsis. Hover: border to `--line-sterk` and an underline on the title (like `.ltitel`); focus: the 2px accent ring. No accent fill and no red on the cards; the date turns `--alarm-tekst` only when the moment is today.
- **"items".** The total and the unclassified count say "items" because they count across document types (Tobias's request of 13 Nov 2026). This is the one exception to the template-check rule against generic units; everywhere else, name the parliamentary unit.
- **Empty theme.** The card stays, with "Nog geen items" in muted 14. The taxonomy is fixed, so a theme is never hidden.
- **Unknown slug.** Page title "Thema niet gevonden" and one sentence with a link back to `#themas`, no card.
- **Detail (`#themas/<slug>`).** A small "Alle thema's" link above the page title, the description at body size under it, then the counts. Groups follow `SOORTEN` (Wetten, Amendementen, Moties, Kamerbrieven, Antwoorden op Kamervragen, Vergaderingen, Agenda), each a `h3.groepkop` with its count and a card with a `.list`; empty groups are left out. Newest first; Agenda soonest first. A row (`.themaregel`): meta line (date, status as dot plus word, indiener, type and commissie for a meeting, Kamerstuk in DM Mono), the title (15, ink, the link; external links get the arrow), the item's other themes as neutral `a.tchip` links to their theme page, and a `details.meer` disclosure ("Meer details", 13 ink-2, chevron, at least 24px tall) with a `dl.facts` of the full text, indieners, votes, Kamerstuk, agendapunten and links. Meetings link to their row on Agenda. Groups show 20 rows; a light button (`.knop.licht`) shows the rest and moves focus to the first new row. Hierarchy: page title (30) > group head (15/600 with hairline) > row title (15/400) > meta (13, muted).
- **Routes.** `#themas` and `#themas/<slug>`; `#themas/<slug>?type=<param>` is reserved for filters (`param` in `SOORTEN`: wetten, amendementen, moties, kamerbrieven, antwoorden, vergaderingen, agenda).
- **Without JavaScript.** `pipeline/themas_noscript.js` writes the ten themes with their counts and descriptions into the `<noscript>` block of `index.html` (between the `themas:begin`/`themas:end` markers; the Action runs it daily). Hash routes need JavaScript; that is a known limit.

## Agenda

One page for what is coming and what has been: planned and held Kamer meetings, summarized meetings and milestones, on one timeline by week and day. It replaced the Vergaderingen tab (with its Toezeggingen and Per fractie subtabs) on 13 Nov 2026.

- **Head.** Page title "Agenda" with the controls on the right: the view switch (two `.chip`s, "Vanaf vandaag" and "Terugblik", the selected one in accent fill), the count of the coming 7 and 30 days, "Naar vandaag", and the subscribe menu. One muted intro line under the title says summaries come from the automatic transcript and are not an official source.
- **Filter bar.** The `.filterbalk` panel: Type, Commissie, Ministerie and Thema as `details.facet` checkbox menus (several values, "or"; facets combine, "and"), each option with its count under the other filters and options at zero in muted text; themes in the fixed `THEMAS` order, the rest by count. Then a "Samenvatting" select (Alle, Met samenvatting, Nog niet samengevat; the last only counts meetings that were held). Active filters show as removable chips with "Alles wissen". Everything is in the URL.
- **Timeline.** Weeks (`h3.tl-weekkop`), days with a date column, rows (`.tl-item`): time, meta line (type `.tag`, `Eerstvolgend` badge, commissie, `Kort` badge for a short summary), the title (ink; links to the Kamer page and gets the external arrow), theme chips (clickable: toggle that filter). Today is the only `--alarm-soft` day; the next meeting is the only row with a red border. Past rows have ink-2 titles.
- **Vanaf vandaag** opens at today and grows backwards with "Eerder laden" (4 weeks per click). **Terugblik** shows only what has been, newest week and day first (rows within a day stay in time order).
- **Summary.** A summarized meeting gets the "Toon samenvatting" toggle (36px, chevron rotating 180°) under its chips; the body expands with the accordion (`grid-template-rows`, the one allowed size animation) and keeps the two-column layout from 1100px: content left (links, Aanzet, Kern, Standpunten fracties, Toezeggingen, Moties, Vervolg), agendapunten and deelnemers right, the peil stamp and "Samenvatting inklappen" at the bottom. Open summaries stay open when the list is redrawn. A second activity that shares a summary shows one small link to it instead of a second copy. A held meeting without a summary may show a `details.motiedetails` line with its moties.

## Tables

The Moties/Amendementen table is the reference for every data table.

- Above the table: the large switcher (`.schakelaar`), then one search field. The switcher stands in for the page title (the `h2` stays for screen readers only) and has the shape of the main tab bar: a raised white segment on `--surface`, 44px segments at 20px/500 (18px on phones), outer radius 12 and inner 8. No count line and no dropdowns above the table.
- Column order: title (header names the kind, "Motie" or "Amendement"), a 44px cell for the row's disclosure button right next to it, Uitslag, Appreciatie kabinet, Indiener, Kamerstuk, Datum. The title takes 44% and wraps; every other column stays on one line. The date is always the last column.
- Text columns align left; dates and Kamerstuk numbers align right (`tabular-nums`; Kamerstuk numbers in DM Mono 13). Header text sits on exactly the same line as the cell text below it: header cells have the same horizontal padding as body cells, and a header button has no padding of its own.
- One line height for every body cell (22px at 14px), so first lines share a baseline. A status (dot plus word) is `display: flex` inside a cell; an inline-flex status takes its baseline from the empty dot and drops 1px.
- Filtering: a categorical column header is a button (`.kopfilter`) with a chevron that opens a checkbox menu (`.kopmenu`, a popover in the top layer so the table edge never clips it). Several values per column ("or"), columns combine ("and"). Each option shows how many rows it would give under the other filters; options at zero stay in the list in muted text. A column in use shows its count in accent next to the label; the menu has "Wissen" at the bottom once something is checked. The checkboxes line up under the header text. Escape, a click outside or tabbing out closes it. The chevron means "menu"; only the arrow means "sort".
- Sorting: only dates sort (a button inside the `th`, `aria-sort` on it). One click reverses the order; the arrow sits left of the label because the column is right-aligned. Empty dates sort last.
- Empty result: "Geen moties met deze filters" with a "Filters wissen" link button.
- Row: hover is `--surface`, pressed `--raised`, an open row stays `--surface`. When the whole row opens a link, the title is the real `<a>` (keyboard and middle click), the row click repeats it, and a hover underlines the title in `--line-sterk`. Other actions in the row are buttons that do not trigger the row.
- Disclosure: a 32px ghost button with the 16px chevron, rotating 180° when open; the detail row is `--surface`, indented to the title's text edge.
- Detail row: data only, no title repeat, no history, no bars. Three groups 16 apart at 13px: the identifiers line (`Zaak … · document … · ingediend …, door …`, numbers in DM Mono), the vote (`Voor 111 / Tegen 36`, then the fracties voor and tegen as two columns, stacked on phones, alphabetical, ink-2), and the links below a hairline.
- External arrow in a wrapping title: put it inside a no-wrap span with the last word, so it never sits alone on a line.
- The Wetgeving table follows the same rules with four columns: Wetsvoorstel (60%, wraps, theme chips under the title), Status (dot plus word), Kamerstuk (right, DM Mono, hidden on phones), Ingediend (right, last). No filters and no disclosure; the title links to OpenTK.
- Phones (≤640px): the header row becomes a row of 32px buttons (the filters and the date order) on `--surface`; each row becomes a block with the title on top, status and date beneath, the button at the right; secondary columns are hidden.

## Template check

Swap "milieuradar" for another environmental site (a city air-quality monitor, a national climate dashboard) and ask what would still fit. These parts survived the swap, so each one gets a rule:

| Survives the swap | Rule |
| --- | --- |
| Green accent on white | Green is not the identity. It means selection, the primary action, a chart line or a completed phase, and nothing else. The identity comes from the three-bar mark with its red bar, the lowercase wordmark, and red meaning "now or over the limit". |
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
