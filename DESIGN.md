# DESIGN.md: milieuradar

The design rules for this site. Every change to the look of milieuradar starts here. The values live as tokens at the top of `assets/style.css`; this file says what they are for and what is not allowed. If a rule here and the code disagree, the code is wrong.

Desktop only (Tobias, 14 Nov 2026): the phone rules below describe what the code already does; new parts are not designed or checked at phone width.

Set in the unslop pass of 13 Nov 2026 (method: unslop by Damir Sokolovsky, [@heydamir](https://x.com/heydamir), CC BY 4.0).

## Direction

- **Product.** A Dutch monitor of environmental and climate policy in the Tweede Kamer (laws, moties, debates, ministry letters, agenda), shown next to the measurements that policy answers to, for people who read policy for a living.
- **Character.** Exact, sober, alert.
- **World.** The measurement desk: monitoring stations, instrument readouts, CBS, PBL and RIVM tables and typeset Kamerstukken.
- **Moments.** The emissions chart "Wat Nederland uitstoot" (heading "Hoe staan we er voor?" since 17 Nov 2026), the largest drawn thing on Overzicht and the first block under the short intro, in a card: the measured line is the only red, and the targets from the Klimaatwet and the stikstofwet sit next to it as quiet reference lines. The chrome stays quiet around it.
- **Signature.** The peildatum stamp: every figure carries its source and date in one mono caption, in one format (`Tweede Kamer open data · stand 11 nov 2026`). Red only ever means past the limit, happening now, or a verworpen outcome in the traffic light.

## Tokens

### Palette "Rapport" (since 17 Nov 2026, Tobias)

White paper with near-black ink, deep forest as the one accent, red as the one colour for attention. Chosen over linen and cream, which felt dated and flat. Light only. The page is white; cards, tables, the chart and the header are lightly tinted (`--card`) with a hairline, so content stands apart from the page (Tobias, 18 Nov 2026). The header has its hairline at all times, not only after scrolling.

| Role | Token | Value |
| --- | --- | --- |
| Page (white) | `--page` | `#ffffff` |
| Card, header, chart, boxes, menus (tinted, with a hairline) | `--card` | `#f5f6f4` |
| Surface (panels, tiles, table head, tab bar) | `--surface` | `#eaedea` (cool light grey; one step darker than the card) |
| Raised (pressed, active row, search highlight) | `--raised` | `#dfe3e0` |
| Hairline | `--line` | ink at 14% |
| Hairline on hover | `--line-sterk` | ink at 28% |
| Primary text (near black) | `--ink` | `#0e1411` (18.6:1 on white) |
| Secondary text | `--ink-2` | `#46514b` (8.3:1 on white) |
| Muted text, meta only | `--muted` | `#5f6a64` (5.6:1 on white, 5.0:1 on surface) |

### Accent

- `--accent` `#00452a` deep forest (11.1:1 on white; white text on it 11.1:1), hover `#002e1c`. Used for: the selected state (chips, a theme chip in use as a filter), the primary button, focus rings, checkboxes and the logo square. Text on it is white (`--card`).
- `--accent-soft` `#e2ece5` only for a checked filter row and the current row in a menu. A focused field gets a 2px forest edge (border plus a 1px ring).
- The document type in Net binnen, badges, filter counts and link hover are ink, not accent.

### Attention and meaning

- `--alarm` `#e5320f` red (lines, marks, borders; 4.4:1 on white, never as text) and `--alarm-tekst` `#c42300` (text, 5.9:1 on white). No red fill anywhere (`--alarm-soft` was removed on 19 Nov 2026).
- Red is used for: the tall bar of the logo, today and the next item on Agenda, the measured series in the emissions chart, and the red of the traffic light. Never for selection, hover, body text or row backgrounds.
- Status dots, a traffic light (Tobias, 17 Nov 2026): aangenomen/afgedaan/beantwoord `--good` `#00452a`, in behandeling/aangehouden/openstaand `--warning` `#a87e00` (ochre, 3.7:1 on white; a bright yellow disappears as a dot), verworpen `--bad` `#e5320f`, ingetrokken/vervallen `--neutraal-stip` `#a5ada7`. The dot carries the color, the word carries the meaning; the word stays ink.
- Themes have no color (since 13 Nov 2026). See "Themes".

### Type

- Families: **DM Sans** (400, 500, 600) for everything; **DM Mono** (400, 500) only for source stamps, the header stamp, chart axes, end labels and reference labels, and Kamerstuk, zaak and document numbers. Dates and times are DM Sans with `tabular-nums`.
- Type scale (Tobias, 18 Nov 2026; one scale for the whole site, `--t-*`):
  - Text: **18** controls (tabs, menus, filter buttons, search fields); **15** the title of a row in every list *and* table (500, ink; also the body size, and since 19 Nov 2026 the opened detail of a table row and the text of a motie, 15/24); **14** meta, line 1 of a row and the other table cells (ink-2), chips and small buttons; **13** tails, help text, footer, table headers; **12** stamps, tags, badges, counts and chart labels.
  - Headlines: **45** the Overzicht headline; **30** page titles and key figures; **24** section headings (`h2`), the day number on Agenda. The wordmark (36) is a logo, not text.
  - Known exceptions: the Agenda toolbar (15, smaller on request) and the small switcher (15).
- Since 17 Nov 2026 (Tobias) the header and page controls are 50% larger than the old 36px/14px. Tables went back from 18 to the row sizes (15 title, 14 cells) on 18 Nov 2026 so they read like Net binnen.
- Weights: 400 body, 500 headings and figures, 600 for rare emphasis (`<b>`, group heads). Never 700.
- Tracking: 0 below 20px; −0.005em at 18 to 20; −0.015em at 24 (wordmark); −0.02em at 30.

### Spacing

4px grid: **4, 8, 12, 16, 20, 24, 32, 40, 48, 64**. 1px and 2px only as nudges inside small controls.

- Inside controls 4 to 12; list rows 12 apart; groups 12 to 24; above a section head 40; page bottom 64.
- Card padding 20 (16 on phones), indicator cards 24, stat cells 16/20, table cells 16.
- Controls `--h-control` 56 tall (main tabs, header search, table head), compact `--h-klein` 48 (active-filter chips, menu rows). Page controls on every page (Tobias, 18 Nov 2026, Agenda as the reference): every switcher (`.schakelaar`) 40 tall at 18/500, filter buttons 40 tall at 15, the page search field 40 tall at 15. Search page chips stay 36.
- Header (since 17 Nov 2026): logo (48) and wordmark (36, "milieu" in `--accent`; hidden below 1280px); logo, tab bar (48 with 40px tabs at 18) and search (48) share one center line, the tabs Overzicht, Thema's, Agenda and Documenten, an always-visible search field (48 tall, up to 360 wide, `--surface`, magnifier inside, `/` keycap) that searches the whole site, and the "Bijgewerkt" stamp at the far right of the same row (two lines below 1280px). Documenten is a tab button with a chevron that opens a menu card (`.tab-lijst`: `--card`, `--line`, radius 8, exactly as wide as the tab bar and aligned with both its edges; since 18 Nov 2026) on hover, click or arrow down, in two labelled columns: *Kamerstukken* (Wetgeving, Moties, Amendementen, Kamervragen, Kamerbrieven) and *Kerndocumenten* (Kabinet, Begroting, Ramingen, Advies, Rechtspraak). Group labels are 13/500 muted, not uppercase; each page is its own small card (`--page` fill, `--line` border, radius 8, 48 tall, 8 apart) with only the page name at 18/500, no explanation line; hover `--surface`, the current page on `--accent-soft` with a forest edge. The sliding indicator sits under the button on every document page. "Over" lives in the footer: one line of sources (Tweede Kamer open data, gehoord.de, OpenTK, CBS, PBL en RIVM), the AI disclaimer and "Over milieuradar", always at the bottom of the window (body is a flex column with `min-height: 100vh`).

### Radii

| Element | Token | Radius |
| --- | --- | --- |
| Tag, label, keycap (keycap 4) | `--r-tag` | 6 |
| Button, field, select, chip, menu row | `--r-control` | 8 |
| Card, tile, menu | `--r-card` | 12 |
| Panel | `--r-panel` | 16 |
| Main tab bar, switchers (`.schakelaar`) | `--r-control` | 8 outside, 4 per segment (since 17 Nov 2026: every choice menu has the radius of the header search) |
| Menus (Documenten, filter menus, search suggestions) | `--r-control` | 8 |

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
4. Use red once or twice per screen as the attention colour: the chart line, today, the next item. Forest is the selection and the primary action.
5. Show status as a dot plus a word in sentence case (`Aangenomen`, `In behandeling`, `Openstaand`).
6. Build every list row the same way (Tobias, 18 Nov 2026): line 1 is the kind (ink, 14/500, no fill; a link to its list page or to Agenda filtered on that type when one exists), the date (tabular) and the context (ministry, commissie or status), all ink-2 at 14 and 12 apart; line 2 is the title (15/500 ink, the link); an optional line 3 is the tail (indieners, vote, Kamerstuk) at 13 ink-2. Muted only for what is truly secondary. The grey `.tag` pill remains only in the search suggestions. Use one label style for words next to a title (`.badge`: text, no fill), one selected style (forest fill).
7. Format dates as `11 nov 2026` in meta, tables and stamps (months `jan feb mrt apr mei jun jul aug sep okt nov dec`, from `MAANDEN_KORT`); the long form `11 november 2026` only inside a sentence. Numbers in Dutch notation (`1.092`, `428,38`) with `tabular-nums`.
8. Give every figure a peildatum stamp (`.peil`): source · place or table · date.
9. Keep one main chart per screen, the largest drawn thing; anything else that shows data is smaller and different in kind (scales, a list with bars, a table).
10. Give hover and focus a visible state inside the palette; keep a 2px forest focus ring.
11. Keep headlines, labels and buttons without a trailing period; full sentences keep theirs.

**Don't**
1. No hue gradients, gradient text, glows, colored shadows, color washes or blurred glass (`backdrop-filter`).
2. No coloured text in lists, coloured section labels or coloured links. Links are ink with a hairline underline; on hover the underline becomes 2px and solid, the colour stays ink.
3. No red for anything except over the limit, today, eerstvolgend, the measured chart series, the logo bar and the red of the traffic light. Not for selection or hover, not for body text, not for row backgrounds other than today.
4. No hue outside the neutral greys, forest, red and the ochre of the traffic light: no blue, no other greens. No color or icon per theme, sector or category.
5. No uppercase tracked labels, no weight 700, no italic for emphasis, no negative tracking below 18px.
6. No emoji or Unicode glyphs as icons; no arrows appended to link text.
7. No filled badges; no pill shapes.
8. No stripes on the left of cards, no double rings, no three signals for one fact.
9. No inline `style=""` for spacing or type in templates; add a class.
10. No equal tiles in a row as a layout default; stats sit in one strip with hairline dividers.
11. No `transition: all`, no looping or bouncy motion, no hover scale on cards.
12. No greeting copy, exclamation marks, hype words or unverifiable claims.

## Charts

- One main chart per screen: the measured series is the only red (2px line, 8% fill, open end point when the last figure is voorlopig).
- Reference lines stay neutral and never take red: a baseline is a muted hairline with a ring at its start; a target is a solid ink dot at the target year (an open ink ring for a target that is not Dutch law, such as the EU 2040 target), joined by an ink-2 hairline to its label in the right margin when the axis runs past it; a projection is an ink-2 dashed line (4 4) to an open ring. Dashes mean "projection" and nothing else.
- Reference values are labeled once, in DM Mono 12 in the right margin (`1990 226,6`, `doel 2030 102,0`, `EU 2040 22,7`, `2050 neutraal`, `raming 101`, `KEV 46–53%`); on phones only the word. Labels never touch: each sits at least 14px below the one above it. A gap is labeled in words next to a thin bracket (`−36% nodig t.o.v. raming`). Labels get a white halo so they stay legible over lines.
- The uncertainty of a projection is a neutral band (`.mi-band`: ink at 7%, no edges) that opens from the last measured point through the source's published ranges (KEV: 2030, 2035, 2040); the dashed projection line runs through the source's own middle values, with a small open ring at each of those years. In-between years are not drawn. Never red. Bands for Totaal, CO₂ and CH₄ (KEV has no separate N₂O projection).
- Every chart has two minimal axis titles in DM Sans 12, muted: the unit above the y-axis labels (`CO₂-eq (miljard kg)`, `kiloton`) and `Jaar` centered under the years. No rotated text.
- Targets per year (Tobias, 18 Nov 2026; simplified the same day): one top row (`.mi-kiezers`, gap 12) with two switchers in the same shape (`.mi-wetten`: 18/500, 40 tall): the law (Klimaatwet, Stikstofwet) and the target year, year only (Klimaatwet 2030, 2040, 2050; Stikstofwet 2030, 2035). The year sets the end of the x-axis. No peildatum stamp under the row: the source line under the chart is enough. Keep extra text and sources out of this block unless they are needed.
- Kans (bottom left, under the latest figure, Tobias 18 Nov 2026): first the target for the chosen year as one 14px line above a hairline (`.mi-doel`), then the chance block (`.mi-kans`: `--surface`, 13px label "Kans dat het doel van 2030 wordt gehaald"). Only a published percentage gets the traffic-light dot (`--bad` under 50%, `--warning` 50 to 75%, `--good` above 75%) with the figure in ink and the source's verdict; a verdict without a percentage is quoted with "volgens PBL" and no dot; with nothing published there is no chance block. Never invent a chance.
- Under the top row: the substance chips (no group label), the latest figure, the target and the chance on the left, the chart on the right.

## Overzicht lists

- Order and widths: Net binnen left (3fr), Komt eraan right (2fr) from 1000px; stacked in that order below. Both sections are unboxed headings (24/500 on Overzicht, like "Hoe staan we er voor?") with a card under them, like "Wat Nederland uitstoot" above them (a card since 16 Nov 2026; the switcher has no top margin inside it). Above everything sits `.ov-intro`: one `h1` (`.ov-lead`, 45/500, ink, max 36ch; the page's `h1`) and one paragraph (`.ov-uitleg`, 18/400, ink-2, max `--leesbreedte`; since 18 Nov 2026, with links to Thema's, Agenda, Wetgeving, Moties, Amendementen, Kamervragen and Kamerbrieven), 32 above, 8 between, no accent or frame. The first row of Komt eraan is the next plenary vote when one is planned (`komendeStemming()`): `Stemmingen` (link to `#moties`), the `dagKort` date and "Plenaire vergadering", then "n moties en n amendementen" as the title, linking to `#moties`; no red and no Eerstvolgend badge. Komt eraan is filled up to 15 rows and then trimmed after drawing (`passKomtEraan()`) until it is no longer than Net binnen, so both columns end about level. The two cards stretch to one bottom edge: the list grows, the kaartvoet stays at the bottom.
- A Net binnen row follows the row rule (Do 6): `Kamerbrief  18 nov 2026  Klimaat en Groene Groei` on line 1, the title on line 2, then a tail: indiener as surname plus fractie with c.s. (same `indienerKort` as the Moties table) and `· Voor X / Tegen Y`, the Kamerstuk number and title for a stuk, or the Kamerstuk number for a wetsvoorstel. Komt eraan uses the same rows: type, date and time, commissie; the vote row reads `Stemmingen  di 24 nov  Plenaire vergadering`. Names in titles lose their initials after "het lid" or "de leden".

## Themes

Ten fixed themes, defined once in `THEMAS` in `assets/themas.js` (slug, label, order, description). Every page that shows themes (Thema's, the filter on Agenda, chips on rows) reads that constant; nothing else defines a theme name or order.

- **No color, no icon per theme.** A theme is a word. Theme chips (`.tchip`) are neutral outline chips: 12px ink-2 text, `--line` border, radius 6. Clickable chips get `--line-sterk` and ink on hover; a 4px invisible extension keeps the hit area at least 24px tall. The selected state (a theme chosen as filter on Agenda, where a chip click toggles that filter) is the one forest fill, as for every chip.
- **Overview (`#themas`).** Page title, then the ten themes in fixed order as a 5 × 2 grid of name-only cards (`.themagrid`, `repeat(5, 1fr)`, gap 16; Tobias, 14 Nov 2026). This is a list of destinations, not a row of stat tiles, so Don't 10 does not apply. Each card is one `<a>` (`.themakaart`, min-height 96) holding only the title (18/500). No intro line, counts or next moment: everything else lives on the theme page. Hover: border to `--line-sterk` and an underline on the title (like `.ltitel`); focus: the 2px forest ring. No fill and no red on the cards.
- **"items".** Counts on the theme page say "items" because they count across document types (Tobias's request of 13 Nov 2026). This is the one exception to the template-check rule against generic units; everywhere else, name the parliamentary unit.
- **Empty theme.** The card stays (just the name); the taxonomy is fixed, so a theme is never hidden. The theme page says "Nog geen items".
- **Unknown slug.** Page title "Thema niet gevonden" and one sentence with a link back to `#themas`, no card.
- **Detail (`#themas/<slug>`).** A small "Alle thema's" link above the page title, the description at body size under it, then the toolbar row (`.werkbalk`, see Tables) with the theme switcher on the left (`.schakelaar.klein`: same size as every switcher, names only (counts dropped on 18 Nov 2026 to save space); it wraps when it does not fit, and the filters and search field then drop to the next line, right-aligned). Options: Overzicht, **Agenda →** (a link to `#agenda?thema=<slug>`, the main Agenda with the theme filter; the arrow says it leaves the theme page; since 19 Nov 2026), Wetten, Amendementen, Moties, Kamerbrieven, Kamervragen, Kerndocumenten; types without items are left out. The old Vergaderingen and Agenda lists are gone: `?type=agenda` and `?type=vergaderingen` redirect to the Agenda (Geweest for Vergaderingen). Kamervragen are one row per question with the answer, as on `#vragen` (`?type=antwoorden` opens Kamervragen). Since 14 Nov 2026 (`themaDetail()` in app.js):
  - **Overzicht** (default): Net binnen and Komt eraan as on the home page (`.ov-onder`), limited to the theme; the card footers link to the theme's tabs and to `#agenda?thema=<slug>`.
  - **Wetten, Amendementen, Moties, Kamerbrieven, Kamervragen, Kerndocumenten**: the same table as the main page (`themaDef()` wraps `WET_DEF`, `motieDef()`, `BRIEF_DEF`, `VRAAG_DEF`): rows limited to the theme, no Thema column or filter, the other column filters, search and date sort as usual. One muted line under it links to the full table filtered on the theme.
- **Routes.** `#themas`, `#themas/<slug>` (Overzicht) and `#themas/<slug>?type=<param>` plus the table's own filters, `q` and `volgorde` (`param` from `SOORTEN`; tables write that address through `def.adres` and `def.vast` in `bindTabel()`).
- **Without JavaScript.** `pipeline/themas_noscript.js` writes the ten themes with their counts and descriptions into the `<noscript>` block of `index.html` (between the `themas:begin`/`themas:end` markers; the Action runs it daily). Hash routes need JavaScript; that is a known limit.

## Agenda

One page for what is coming and what has been: planned and held Kamer meetings, summarized meetings and milestones, on one timeline by week and day. It replaced the Vergaderingen tab (with its Toezeggingen and Per fractie subtabs) on 13 Nov 2026.

- **Head.** The switcher "Komend | Geweest" (since 19 Nov 2026; 40 tall, 18/500; the reference size for all page controls) sits left in the toolbar row and stands in for the page title (the `h1` is for screen readers), like Wetgeving. Both are links that keep the filters; the URL keeps `terugblik=1` for Geweest. No intro line, no counts, no subscribe menu. Above the first week of Komend a light button "↑ Eerdere vergaderingen" opens Geweest; at the bottom of Geweest "Naar komende vergaderingen" goes back (like the Upcoming | Past pattern of event sites).
- **Toolbar.** The shared toolbar (see Tables): "Zoek in de agenda" (title, commissie and type), then Type, Ministerie and Thema (no Commissie filter since 18 Nov 2026); on Agenda the filter buttons and search field are 40 tall at 15px, smaller than on the document pages; themes in the fixed `THEMAS` order, the rest by count. No filter on summaries. Everything is in the URL (`q`, the filters, `terugblik=1`).
- **Timeline.** Weeks (`h3.tl-weekkop`, sticky under the site header while you scroll), days with a date column, rows (`.tl-item`, since 19 Nov 2026) in three columns: the time (96 wide; the red `Eerstvolgend` label under the time of the next meeting; "tot 14:00" for an Inbreng deadline), the content (meta line: type `.tag`, commissie, zaal, `Besloten`/`Kort` badges, then the theme chips, clickable to toggle that filter; then the title, ink, linking to the Kamer page with the external arrow) and on the right the one toggle with "Live op Debat Direct" under it. Whatever a toggle opens spans the full width under the row. Expandable rows get a `--surface` fill on hover. Today has a red "Vandaag" and day number and a 2px `--alarm` rule on its left edge; no fill and no bordered card. Past rows have ink-2 titles.
- **Komend** starts at the top of the page with today and shows only what is coming. Opening the tab or switching views always starts at the top. **Geweest** shows only what has been, newest week and day first (rows within a day stay in time order).
- **Plenary votes.** Komend has one row per upcoming voting date (`stemmingenPerDag()`, shared with Komt eraan): type `Stemmingen`, "Plenaire vergadering", title "n moties en n amendementen" linking to `#moties`; no time, label or toggle. `Stemmingen` is a Type value; with a theme filter the counts only include that theme; a Ministerie filter hides it. Not in Geweest.
- **Summary.** A summarized meeting gets the "Toon samenvatting" toggle (36px at 14, chevron rotating 180°) on the right; a click anywhere on the row (not on a link, a button or the opened body) does the same; the body expands with the accordion (`grid-template-rows`, the one allowed size animation) and keeps the two-column layout from 1100px: content left (links, Aanzet, Kern, Standpunten fracties, Toezeggingen, Moties, Vervolg), agendapunten and deelnemers right, the peil stamp and "Samenvatting inklappen" at the bottom. Open summaries stay open when the list is redrawn. A second activity that shares a summary shows one small link to it instead of a second copy.
- **Agenda and moties of a meeting** (since 16 Nov 2026; one toggle since 19 Nov 2026). A meeting without a summary gets the same toggle when it has agendapunten and/or moties: "Toon agenda (n punten)", "Toon 18 moties (0 aangenomen)" or "Toon agenda en 18 moties", with the same accordion: agendapunten (numbered; per point "Te behandelen:" and its stukken sorted by Kamerstuknummer, the stuk's subject left out when it repeats the point; moties and amendementen carry their `.status`: the uitslag, or "Stemming di 17 nov") and a Moties section left, deelnemers right, "… inklappen" at the bottom. Under the points one quiet link per Kamerstukdossier, "Alle moties bij Kamerstuk 32813" (`#moties?q=32813`). No agenda when the only point repeats the title without stukken. `#agenda/a-<nummer>` opens it.
- **Motie links.** A motie or amendement on Agenda (in the Moties section or under "Te behandelen:") links to its row on our own page, opened and scrolled into view (`#moties?open=<zaak>`, `#amendementen?open=<zaak>`); tweedekamer.nl stays one click further, in the row. Stukken that are not on our pages still go to tweedekamer.nl.
- **Meta extras.** Room (`zaal`: Locatie, reserved room, or "Plenaire zaal" for plenary debates; the Kamer data often leaves it empty, then nothing shows) and a quiet `Besloten` badge.

## Kerndocumenten

The fixed documents of policy research, one page per group since 17 Nov 2026 (`#kerndocumenten/<groep>`; `#documenten/…` redirects): Kabinet, Begroting, Ramingen, Advies, Rechtspraak, reached from the Documenten menu. Each page is the table pattern (see Tables) with the group's full label as page title ("Begroting en financiën") and the shared toolbar. There is no intro text, no note under the table and no counts.
- **Row.** Each row is the `.themaregel` pattern: a meta line (`.tag` for the kind of document, the `11 nov 2026` date, the publisher, the official identifier in DM Mono: Kamerstuk, D-number, ECLI, BWBR, CELEX), the title as an external link with the arrow, theme chips, optional secondary links (13px, ink-2) and "Eerdere edities (n)" as `details.meer`. Only the newest edition per series shows.
- **Order.** Begroting en financiën starts with the budget cycle (Miljoenennota, Belastingplan, Voorjaarsnota, Najaarsnota, Financieel Jaarverslag), then the file order. Other groups follow the file order, which is curated, not by date.
- **Chapters table.** Budgets and annual reports per chapter form one table in the Begroting group: chapter letter (DM Mono 13, ink-2), name with theme chips, one column per budget year and the latest annual report. Cells are the document number (DM Mono 13, links to the PDF) with a small second link (Rijksfinanciën for the newest budget, Rekenkamer for the annual report). A `.peil` stamp names the Kamerstuk. There are no status dots and no accent.

## Tables

The Moties table is the reference for every data table. Every document type has its own page since 17 Nov 2026 (Moties, Amendementen, Kamervragen, Kamerbrieven and the five Kerndocumenten groups); only Wetgeving keeps a switcher. All are built from the same code (`tabelPagina()`/`bindTabel()` with a definition per page in app.js): same title, toolbar, date sort, row disclosure and phone layout. Filters, search and date order live in the URL (`#vragen?status=Open&thema=…&q=…&volgorde=oud`).

- Every page has exactly one `h1` (since 17 Nov 2026, audit): the visible page title at 30px, or a screen-reader-only `h1` where a switcher stands in for the title (Wetgeving, Agenda, Zoeken). Section heads are `h2`.
- Above the table (every Documenten page, Tobias 18 Nov 2026): the page title (`h1`, 30px) and one subtitle line (18, ink-2), e.g. "Moties" / "Verzoeken van Kamerleden, met de stemming"; the subtitles are the former menu explanations (`paginaKop()`, `KD_SUB`). On Wetgeving the switcher Wetsvoorstellen | Geldende wetten sits in the toolbar. No count line above the table.
- Toolbar (`.werkbalk`, on every page with a list, also Agenda and the theme pages): one row under the title; a switcher, when the page has one, left-aligned; the filters and the search field right-aligned, the search field furthest right (40px, 15px text, up to 400 wide, a placeholder that says what it searches: "Zoek op onderwerp, Kamerlid of Kamerstuknummer"); one `details.facet` button per filter (40px, 15px, 16px chevron). `werkbalk(hint, q, links)` takes the switcher as `links`. Each opens a checkbox menu (rows 48px at 18): several values per filter ("or"), filters combine ("and"); each option shows how many rows it would give under the other filters, options at zero stay in muted text; a filter in use shows its count next to the label. One menu is open at a time; Escape or a click outside closes it. Active filters sit under the toolbar as removable chips (48px) with "Alles wissen". Code: `werkbalk()`, `tekenWerkbalk()`, `bindWerkbalk()`, `pastFilters()`. After each search or filter change a hidden `role="status"` line (`#wstatus`, `meldAantal()`, 400 ms after the last change) says "n resultaten" or "Geen resultaten met deze filters"; the first render says nothing.
- Search results (`#zoeken`, Tobias 18 Nov 2026): one filter row with two cards (`.filterkaart`: `--card`, `--line`, radius 12, padding 4, borderless chips 8px apart in padding), the result kinds left and the period (Alle jaren, Deze Kamerperiode, Afgelopen maand) against the right edge, so the two filter types read as separate. Always newest first: no sort choice.
- Column order: title first (header "Motie over..." or "Amendement over..."; titles start lowercase so they read on from the header, acronyms stay as they are), then the status and people columns (Uitslag, Appreciatie kabinet, Indiener), then Thema (theme chips at 15, stacked, 200px; "Geen thema" in its filter), then Kamerstuk and Datum. The title takes 38% and wraps; Indiener, Appreciatie and ministries may wrap; status, Kamerstuk and dates stay on one line. The date is always the last column. Column headers are plain labels (15px); only Datum is a button.
- Text columns align left; dates and Kamerstuk numbers align right (`tabular-nums`; Kamerstuk numbers in DM Mono 15). Header text sits on exactly the same line as the cell text below it: header cells have the same horizontal padding as body cells, and a header button has no padding of its own.
- One line height for every body cell (28px at 18px), so first lines share a baseline. A status (dot plus word) is `display: flex` inside a cell; an inline-flex status takes its baseline from the empty dot and drops 1px.
- Sorting: only dates sort (a button inside the `th`, `aria-sort` on it). One click reverses the order; the arrow sits right of the label. Empty dates sort last.
- Empty result: "Geen moties met deze filters" with a "Filters wissen" link button.
- Row: hover is `--surface`, pressed `--raised`, an open row stays `--surface`. A click on the row opens or closes its detail row (not while selecting text). The title stays the real `<a>` to the source (tweedekamer.nl, wetten.overheid.nl) with the external arrow, so a click on the title opens the document; other buttons in the row do not trigger the row.
- Disclosure for the keyboard: a 32px ghost button with the 16px chevron after the title, visually hidden until it has keyboard focus (`aria-expanded`, label per page). There is no chevron column. The detail row is `--surface`, indented to the title's text edge.
- Detail row: data only, no title repeat, no history, no bars. Three groups 20 apart at 18/28: the identifiers line (`Zaak … · document … · ingediend …, door …`, numbers in DM Mono), the vote (`Voor 111 / Tegen 36`, then the fracties voor and tegen as two columns, stacked on phones, alphabetical, ink-2), and the links below a hairline.
- External arrow in a wrapping title: put it inside a no-wrap span with the last word, so it never sits alone on a line.
- Wetgeving (since 17 Nov 2026): switcher "Wetsvoorstellen | Geldende wetten" (`#wetgeving`, `#wetgeving/wetten`); the `h1` is for screen readers. Geldende wetten: Wet (opens wetten.overheid.nl), Thema, Kenmerk (BWBR).
- Kerndocumenten: one page per group (`#kerndocumenten/<groep>`). Columns: Document, Soort, Hoofdstuk (Begroting only; "Rijksbreed" when empty), Uitgever (wraps like a ministry), Thema, Kenmerk (Kamerstuk as `37020-XII`, ECLI or D-nummer, DM Mono), Datum. One row per series (newest edition). Detail row: identifiers, "Eerdere edities (n)" as a list with date, kenmerk and "Lees", then the links ("Bekijk het origineel", the source page, Kamerstukdossier, Rijksfinanciën, Rekenkamer). A row never links to a download: Kamer documents open their page on tweedekamer.nl.
- Wetsvoorstellen: Columns: Wetsvoorstel, Status, Ingediend door (Regering or the initiatiefnemers), Thema, Kamerstuk, Ingediend. Filters: Thema, Status, Ingediend door. Status is the phase as on tweedekamer.nl (Voorbereiding, Debat, Stemming with the `--warning` dot; when done the result). Detail row: identifiers, the phase bar and the next step, links ("Alles over dit wetsvoorstel", tweedekamer.nl, OpenTK). The title opens our own page for the bill (`#wetgeving/<Kamerstuk>`, Tobias 19 Nov 2026), so it has no external arrow.
- Bill page (`#wetgeving/<Kamerstuk>`, since 19 Nov 2026): "Alle wetsvoorstellen" back link, the title as `h1` (30px, max `--leesbreedte`), one meta line (14, ink-2: Kamerstuk in DM Mono, date, submitter, theme chips), the phase bar (`.wfasen`: four equal steps with a 2px rule on top, ink up to the current phase, `--line` after it; labels 13, the current one ink 500, later ones muted) with the next step under it, then the links below a hairline. `h2` "Wetgevingsproces": one timeline (`.wtl`), a hairline between days, the date (120 wide, ink, tabular) left and that day's lines right (15, ink-2; links ink). Kamerstukken show their number in muted DM Mono and "Lees". Motions and amendments of one vote day form one block ("Gestemd over 1 amendement en 18 moties"): rows at 14 with a 144px status column, `--surface` on hover and when open; open shows the same content as the Moties row. Planned items end with a muted "(gepland)". An optional `h2` "Mogelijk gerelateerd" lists Kamervragen that name the Kamerstuk.
- Kamervragen (`#vragen`) and Kamerbrieven (`#brieven`) are two pages since 17 Nov 2026. Kamervragen: one row per zaak, the question with its answer(s). Columns: "Vragen over...", Status (Beantwoord `--good`; Open and Termijn verstreken `--warning`, the word tells them apart; the term is 21 days), Gesteld door (surname plus fractie, c.s.), Gericht aan (ministry, wraps), Thema, Gesteld. Detail row: identifiers, the answer(s) with date, signatory and number of days, or "Nog niet beantwoord, n dagen na het stellen", links to question and answer. Kamerbrieven: "Kamerbrief over...", Ministerie (wraps), Thema, Kamerstuk, Datum; detail row with signatory and Kamerstuk titles. Attachments (since 17 Nov 2026): a "Bijlagen (n)" group in the detail row of a letter and of an answer, one link per attachment (title as in the Kamerdata, file type in muted DM Mono, beslisnota last), between the data groups and the links. Ministry cells wrap at 360px.
- Text of a motie or amendement (since 17 Nov 2026): right under the identifiers line, without a label (since 19 Nov 2026), in its own card (`.mt-plek`: `--page` fill on the tinted row, `--line` border, radius 12, padding 16/20; Tobias, 18 Nov 2026) at 15/24 like the detail text around it (since 19 Nov 2026). Overwegingen and the opening in ink-2, the decisive part ("verzoekt de regering", "spreekt uit", and "en gaat over tot de orde van de dag") in ink; no italics, no accent. An amendement shows its Toelichting first (the kop "Toelichting" at 15/500 ink) and the change itself behind `details.meer` "Toon de wijziging zelf"; more than ten paragraphs fold after eight ("Toon de rest (n alinea's)"). Under the official text one 12px muted source line: "Officiële tekst · Kamerstuk 36947, nr. 43" (link). A provisional text (from the pdf or docx) gets no source line (Tobias, 18 Nov 2026).
- Document buttons: in the links row, before the external links, a text button in ink at 500 with the hairline underline ("Bekijk het origineel", "Lees de brief", "Lees de vragen", "Lees het antwoord"; "Lees" after an attachment). No arrow: it stays on the site.
- Document viewer (`dialog.docview`, since 17 Nov 2026): a modal of 960px wide and the window height minus 48, white, `--line` border, radius 12, one soft neutral shadow; backdrop ink at 32%. Head: meta in DM Mono 12 muted (`PDF · 2026D58358 · 3 pagina's`), the title at 18/500, then "Download" and "Op tweedekamer.nl" (13px links) and a 32px close button. Body on `--surface` with 24 padding: pdf pages as white sheets with a hairline, 16 apart, at most 860 wide, drawn when they come near the viewport, with a selectable text layer; Word files as one white sheet (max 760, 40/48 padding, 15/24 text). Loading and errors are one sentence at 14px with the download link. Escape, the close button or a click on the backdrop close it; the page behind does not scroll.
- Phones (≤640px, not maintained): each row becomes a block with the title on top, status and date beneath; secondary columns are hidden.

## Template check

Swap "milieuradar" for another environmental site (a city air-quality monitor, a national climate dashboard) and ask what would still fit. These parts survived the swap, so each one gets a rule:

| Survives the swap | Rule |
| --- | --- |
| Green accent | Forest is the accent, but not the identity on its own. The identity is white paper with near-black ink, the three-bar mark (forest square, white bars, one red bar), the lowercase wordmark, and red meaning "now or over the limit". |
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
