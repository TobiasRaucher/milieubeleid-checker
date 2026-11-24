# DESIGN.md: milieuradar

The design rules for this site. Every change to the look of milieuradar starts here. The values live as tokens at the top of `assets/style.css`; this file says what they are for and what is not allowed. If a rule here and the code disagree, the code is wrong. Start with "Standard sizes".

Desktop only (Tobias, 14 Nov 2026): the phone rules below describe what the code already does; new parts are not designed or checked at phone width.

Set in the unslop pass of 13 Nov 2026 (method: unslop by Damir Sokolovsky, [@heydamir](https://x.com/heydamir), CC BY 4.0).

## Direction

- **Product.** A Dutch monitor of environmental and climate policy in the Tweede Kamer (laws, moties, debates, ministry letters, agenda), shown next to the measurements that policy answers to, for people who read policy for a living.
- **Character.** Exact, sober, alert.
- **World.** The measurement desk: monitoring stations, instrument readouts, CBS, PBL and RIVM tables and typeset Kamerstukken.
- **Moments.** The emissions chart "Wat Nederland uitstoot" (heading "Hoe staan we er voor?" since 17 Nov 2026), the largest drawn thing on Overzicht and since 23 Nov 2026 under the two lists (Tobias), in a card: the measured line is the only red, and the targets from the Klimaatwet and the stikstofwet sit next to it as quiet reference lines. Below the forest header the chrome stays quiet around it.
- **Signature.** The peildatum stamp: every figure carries its source and date in one mono caption, in one format (`Tweede Kamer open data · stand 11 nov 2026`). Red only ever means past the limit, happening now, or a verworpen outcome in the traffic light.

## Tokens

### Colour: white, forest, black (since 24 Nov 2026, Tobias)

White carries the page, black is text and lines, forest is heads, action and "here", red is attention. Pale green (`--surface`, `--raised`, `--op-accent`, 23 Nov 2026) is gone everywhere; do not bring it back. Light only. Every new part follows this table; a part that does not fit asks Tobias first.

| Colour | Means | Used for |
| --- | --- | --- |
| White | content | page, rows, cards, menus, chart, footer, fields, week and month headings; text on forest |
| Black (ink) | text and lines | text, hairlines and borders (ink at 18%, only as a line), the line under a month heading |
| Forest `--accent` | head, action, or you are here | header bar, table head, the heading bars on Overzicht and theme pages, the 2px line under week headings, main buttons, links, filters, toggles, the chosen option, focus, the 4px strip of a hovered or open row |
| Red `--alarm` | attention | see "Attention and meaning" |

| Role | Token | Value |
| --- | --- | --- |
| Page | `--page` | `#ffffff` |
| Card, menu, chart; text on forest | `--card` | `#ffffff` with a `--line` border |
| Border and hairline | `--line` | ink at 18% |
| Border on hover | `--line-sterk` | ink at 50% |
| Edge of search fields (at least 3:1) | `--knop-rand` | `#717b75` |
| Primary text | `--ink` | `#0e1411` (18.6:1 on white) |
| Secondary text | `--ink-2` | `#46514b` (8.3:1 on white) |
| Muted text, meta only | `--muted` | `#5f6a64` (5.6:1 on white) |

- Greens are only these: forest and its hover `#002e1c`. No pale green and no grey fills.
- States without a fill: hover on a menu option, card, chip or outlined button is a forest edge; a hovered or open row gets a 4px forest strip on its left; a search match is bold with a forest underline; a switcher track, tag, note or chance block has a `--line` edge.
- `--accent` `#00452a` (11.1:1 on white). Headings, plain column names and resting row titles stay ink; titles turn forest on hover. The one exception to "green is action" is the dot of aangenomen.
- The header bar, the table head and the heading bars of Net binnen, Komt eraan and Hoe staan we er voor? (since 24 Nov 2026) are the only large forest areas. Elsewhere forest is limited to main buttons, filters in use, the chosen switcher or chart option, and text or borders of second-level buttons. The footer stays white.
- A focused field gets a 2px forest edge (border plus 1px ring); on the header bar the focus ring is white.
- The document type in Net binnen and badges are ink.

### Attention and meaning

- `--alarm` `#e5320f` red (lines, marks, borders; 4.4:1 on white, never as text) and `--alarm-tekst` `#c42300` (text, 5.9:1 on white). No red fill anywhere (`--alarm-soft` was removed on 19 Nov 2026).
- Red is used for: the tall bar of the logo, today and the next item on Agenda, the measured series in the emissions chart, the "Nieuw sinds" line, deadlines today and the red of the traffic light. Never for selection, buttons, decoration, hover, body text or row backgrounds.
- Status dots, a traffic light (Tobias, 17 Nov 2026): aangenomen/afgedaan/beantwoord `--good` `#00452a`, in behandeling/aangehouden/openstaand `--warning` `#f2b705` (yellow, 1.8:1 on white; Tobias, 24 Nov 2026, replaces ochre; only ever a dot next to its word), verworpen `--bad` `#e5320f`, ingetrokken/vervallen `--neutraal-stip` `#a5ada7`. The dot carries the color, the word carries the meaning; the word stays ink.
- Themes have no color (since 13 Nov 2026). See "Themes".

### Type

- Families: **DM Sans** (400, 500, 600) for everything; **DM Mono** (400, 500) only for source stamps, the header stamp, chart axes, end labels and reference labels, and Kamerstuk, zaak and document numbers. Dates and times are DM Sans with `tabular-nums`.
- Type scale (Tobias, 18 Nov 2026; one scale for the whole site, `--t-*`):
  - Text: **18** controls (tabs, menus, filter buttons, search fields); **15** the title of a row in every list *and* table, except on Agenda (18/500) (500, ink; also the body size, and since 19 Nov 2026 the opened detail of a table row and the text of a motie, 15/24); **14** meta, line 1 of a row and the other table cells (ink-2), chips and small buttons; **13** tails, help text, footer; **12** stamps, tags, badges, counts and chart labels.
  - Headlines: **45** the Overzicht headline; **30** page titles and key figures; **24** section headings (`h2`), the day number on Agenda. The wordmark (45) is a logo, not text.
  - Known exceptions: the Agenda toolbar (15, smaller on request) and the small switcher (15).
- Since 17 Nov 2026 (Tobias) the header and page controls are 50% larger than the old 36px/14px. Tables went back from 18 to the row sizes (15 title, 14 cells) on 18 Nov 2026 so they read like Net binnen.
- Weights: 400 body, 500 headings and figures, 600 for rare emphasis (`<b>`, group heads). Never 700.
- Tracking (tokens `--sp-*`, since 19 Nov 2026): 0 at 15 and below (also when such text sits inside larger text); `--sp-18` −0.005em at 18 to 20; `--sp-24` −0.01em at 24; `--sp-30` −0.02em at 30 (titles, key figures); `--sp-45` −0.025em at 45 (headline, wordmark). The larger the type, the tighter.

### Spacing

4px grid: **4, 8, 12, 16, 20, 24, 32, 40, 48, 64**. 1px and 2px only as nudges inside small controls.

- Inside controls 4 to 12; list rows 12 apart; groups 12 to 24; above a section head 40; page bottom 64; a paragraph without its own margin 12 above and below.
- Page side margin `--marge`: 32 at 1280 and 1440, 40 from about 1500.
- Card padding 20 (16 on phones), indicator cards 24, stat cells 16/20, table cells 16.
- Table head 56 tall; `--h-klein` 48: main tabs, header search, active-filter chips, menu rows. Page controls on every page (Tobias, 18 Nov 2026, Agenda as the reference): every switcher (`.schakelaar`; the chosen option solid forest) 40 tall at 18/500, filter buttons 40 tall at 15, the page search field 40 tall at 15. Search page chips stay 36.
- Header (since 17 Nov 2026; a solid forest bar across the full window, 64 tall and sticky, since 23 Nov 2026; tabs and stamp white on forest, 11.1:1, since 24 Nov 2026): logo (48, a white tile with forest bars and the red bar; the favicon keeps the forest tile) and wordmark (45, white; hidden below 1280px); logo, tab bar (48, tabs also 48 at 18; Tobias, 24 Nov 2026) and search (48) share one center line, the tabs Overzicht, Thema's, Agenda and Documenten, an always-visible search field (48 tall, up to 360 wide, white, magnifier inside, `/` keycap) that searches the whole site, and the "Bijgewerkt" stamp at the far right of the same row (two lines below 1280px). Documenten is a tab button with a chevron that opens a menu card (`.tab-lijst`: `--card`, `--line`, radius 8, exactly as wide as the tab bar and aligned with both its edges; since 18 Nov 2026) on hover, click or arrow down, in two labelled columns: *Uit de Tweede Kamer* (Wetgeving, Moties, Amendementen, Kamervragen, Kamerbrieven) and *Kabinet, adviseurs en rechter* (Kabinetsplannen, Begrotingen, Rapporten, Rechtspraak; names say what is there, since 19 Nov 2026; Rapporten replaced Ramingen and Adviezen on 20 Nov 2026). Group labels are 13/500 muted, not uppercase, with their text starting at the cards' left border (no left padding); each page is its own small card (`--page` fill, `--line` border, radius 8, 48 tall, 8 apart) with only the page name at 18/500, no explanation line; hover a forest edge, the current page a forest edge and 600; the tabs stand on the bar in white, the active one is a white block with forest text. The sliding indicator sits under the button on every document page. "Over" lives in the footer: one line of sources (Tweede Kamer open data, gehoord.de, OpenTK, CBS, PBL en RIVM), the AI disclaimer and "Over milieuradar", always at the bottom of the window (body is a flex column with `min-height: 100vh`).

### Standard sizes (since 24 Nov 2026, Tobias)

Every new part is built from this table without asking; do not pick sizes by eye. A part that is not in the table takes the row it looks most like; only when none fits, ask Tobias and add a row here. `node tests/ontwerptest.js` checks grid, type, weight, colour and radius in `assets/style.css` and must pass before every commit that touches `assets/`.

| Part | Class to reuse | Type (size/weight, colour) | Height | Padding and margin |
| --- | --- | --- | --- | --- |
| Page title | `h1` | 30/500 ink | | 32 above, 8 below |
| Section above a card | `h2` + `.card`, as in `.ov-onder` or `.mi-kop` | 24/500 white on forest | 58 | padding 12 20; 40 above the bar; card attached below without a gap |
| Switcher in a card or heading bar | `.schakelaar.mi-wetten` (in a bar on a white ground, `.mi-jaren`) | 18/500; chosen white on forest | 32 per option, 40 in all | 8 to every edge it touches |
| Card | `.card` | | | padding 20, radius 12, 1px `--line`; 24 between cards side by side |
| Card footer with links | `.card > .kaartvoet` with `.knop.licht` | 14/500 forest | 40 buttons | 16 above; 1px `--line` across the full card; 8 around and between buttons |
| List row | `.list li` | meta 14/400 ink-2, title 15/500 ink, tail 13 ink-2 | | 12 above and below, 1px `--line` between rows; 4 between meta and title; 12 between meta parts |
| Table head | `thead` via `tabelPagina()` | 15/600 white on forest | 56 | |
| Table cell | `.motietabel td` | title 15/500 ink, other cells 14 ink-2, line height 22 | | 16 12 |
| Emphasis block (the one thing to read) | `.mt-plek`, `.wp-stap`, `.mi-kans` | text 15/24; decisive line 600 | | 2px `--accent` border; `.mt-plek` and `.wp-stap` 16 20, radius 12; `.mi-kans` 16, radius 8 (it lies inside a card) |
| Main button | `.knop` | 14/500 white on forest | 40 | 0 16, radius 8; with a leading icon 12 on that side |
| Second button | `.knop.licht` | 14/500 forest, 1px forest edge | 40 | 0 16, radius 8 |
| Button in a row of text | `.knop.klein` | 13/500 | 28 | 0 12 |
| Chip (choice, filter value) | `.chip` | 14/400 ink; chosen white on forest | 36 | 4 12 |
| Switcher of a page | `.schakelaar` | 18/500; chosen white on forest | 40 per option | 4 around and between, options 0 16; radius 8 outside, 4 inside |
| Filter button, page search field | `.facet`, `.werkbalk input` | 15 | 40 | search 0 16 |
| Theme tag | `.tchip` | 12 ink-2 | 22 | 0 8, radius 6 |
| Status | `.status` (dot plus word) | 14/400 ink in a table, 13/500 elsewhere | dot 8 | |
| Label next to a title or meta line (`Eerstvolgend`, `Kort`) | `.badge` | 12/500 | | |
| Label in front of a link (`Rapport:`) | `.badge.rapport` | size of the link, 15/500 | | |
| Header bar | `header.top` | tabs 18; wordmark 45/600 | 64; logo, current tab and search all 48 | 8 above and below, 20 between |
| Source line | `.peil`, `.small.muted` | 12 DM Mono, or 13 muted in a chart block | | 8 above |

Three rules behind the table:
1. Things next to each other in one bar have the same height and share one center line.
2. A control against the edge of a bar or card is 8 from every side it touches (plus the 1px border), also when it is in a corner (year and law switcher, chips under it, footer links). Text in the card stays at 20.
3. Content and links of one card are separated by a `--line` hairline; blocks by white space, never by a fill.

### Radii

| Element | Token | Radius |
| --- | --- | --- |
| Tag, label, keycap (keycap 4) | `--r-tag` | 6 |
| Button, field, select, chip, menu row | `--r-control` | 8 |
| Card, tile, menu | `--r-card` | 12 |
| Panel | `--r-panel` | 16 |
| Main tab bar, switchers (`.schakelaar`) | `--r-control` | 8 outside, 4 per segment (since 17 Nov 2026: every choice menu has the radius of the header search) |
| Menus around cards or rows (since 19 Nov 2026, Tobias: corners must run parallel) | | Documenten `--r-panel` 16 (cards 8 + padding 8); filter menus and search suggestions `--r-card` 12 (rows 8 + padding 4) |

Nested: inner = outer minus padding, never below 4. Equivalently, an outer container gets the inner radius plus its padding; equal radii inside and outside make the corner gaps look wider than the sides.

### Icons

lucide, inline SVG through `ico()` in `assets/app.js` (class `.ico`): **16px, stroke 1.5, `currentColor`**. Back-to-top is 18px. The select/disclosure chevron is one data-URI (`--chevron`, 16px, stroke 1.5). External links get a 12px arrow-up-right as a CSS mask, nothing else. No Unicode glyphs as icons (no ✓ ✕ ▶ ↑ → ↗).

### Motion

- One curve: `--ease` = `cubic-bezier(0.22, 1, 0.36, 1)`.
- Durations: `--d-kort` 150ms (hover, press, toggles), `--d-menu` 200ms (menus, tooltips), `--d-lang` 320ms (page entrance, expand, tab indicator).
- Press: `scale(0.98)`, also on the Documenten menu cards. Menus rise 4px and fade. Page entrance: 8px rise and fade, only when the tab changes.
- Leave the way you came (since 19 Nov 2026): an expanded table row, a filter menu and the document viewer fade out (`--d-kort`/`--d-menu`) instead of vanishing. The document viewer grows from the button that opened it (`scale(0.96)`, `--dv-oorsprong`) and shrinks back there. Exit fades use `@starting-style`/`allow-discrete`; browsers without them close instantly.
- The Documenten menu opens on hover after 100ms (passing over it does not flash it open); a click, Enter or arrow down opens it at once. Any route change closes it.
- Transition only color, background, border, opacity and transform, each named.
- Two documented exceptions that animate size: the tab indicator (`.tab-glij`, absolutely positioned so it lays out nothing else) and the summary accordion (`grid-template-rows`, interruptible). Nothing else may animate width, height, top, left, margins or blur.
- Wordmark (`.wm-radar`, since 23 Nov 2026, on request): the one long animation (about 1.7s), once per page load, and once more on the first visit to Overzicht after landing on another page. "milieu" and the logo stand still. Three thin white arcs (`--card`) leave the "u" and run right, behind the tabs; each letter of "radar" lights up (`scale(1.14)` to rest) when the first arc reaches it. Only opacity and transform. None with reduced motion.
- No number animates on load.
- `prefers-reduced-motion` turns movement into short fades.

## Rules (do and don't)

**Do**
1. Put every spacing value on the 4px scale; give equal things equal sizes; keep space inside a group smaller than space between groups.
2. Keep icons, labels and numbers in one aligned column; in tables everything aligns left, numbers and dates too (Tobias, 23 Nov 2026).
3. Use the tokens of the colour table for every surface, border and text; three text roles only (ink, ink-2, muted).
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
2. No coloured text in lists and no coloured section labels, except links: links are forest with a hairline underline (2px and solid on hover); row titles and document types are ink.
3. No red for anything except over the limit, today, eerstvolgend, the measured chart series, the logo bar and the red of the traffic light. Not for selection or hover, not for body text, not for row backgrounds other than today.
4. No hue outside white, ink, the greens of the colour table, red and the yellow of the traffic light: no blue, no other greens. No color or icon per theme, sector or category.
5. No uppercase tracked labels, no weight 700, no italic for emphasis, no negative tracking below 18px.
6. No emoji or Unicode glyphs as icons; no arrows appended to link text.
7. No filled badges; no pill shapes.
8. No stripes on the left of cards, no double rings, no three signals for one fact.
9. No inline `style=""` for spacing or type in templates; add a class.
10. No equal tiles in a row as a layout default; stats sit in one strip with hairline dividers.
11. No `transition: all`, no looping or bouncy motion, no hover scale on cards.
12. No greeting copy, exclamation marks, hype words or unverifiable claims.

## Charts

- One main chart per screen: the measured series is the only red (2px line, no fill under it since 23 Nov 2026, open end point when the last figure is voorlopig).
- Reference lines stay neutral and never take red: a baseline is a muted hairline with a ring at its start; a target is a solid ink dot at the target year (an open ink ring for a target that is not Dutch law, such as the EU 2040 target), joined by an ink-2 hairline to its label in the right margin when the axis runs past it; a projection is an ink-2 dashed line (4 4) to an open ring. Dashes mean "projection" and nothing else.
- Reference values are labeled once, in DM Mono 12 in the right margin (`1990 226,6`, `doel 2030 102,0`, `EU 2040 22,7`, `2050 neutraal`, `raming 101`, `KEV 46–53%`); on phones only the word. Labels never touch: each sits at least 14px below the one above it. A gap is labeled in words next to a thin bracket (`−36% nodig t.o.v. raming`). Labels get a white halo so they stay legible over lines.
- The uncertainty of a projection is a neutral band (`.mi-band`: ink at 7%, no edges) that opens from the last measured point through the source's published ranges (KEV: 2030, 2035, 2040); the dashed projection line runs through the source's own middle values, with a small open ring at each of those years. In-between years are not drawn. Never red. Bands for Totaal, CO₂ and CH₄ (KEV has no separate N₂O projection).
- Every chart has two minimal axis titles in DM Sans 12, muted: the unit above the y-axis labels (`CO₂-eq (miljard kg)`, `kiloton`) and `Jaar` centered under the years. No rotated text.
- Targets per year (Tobias, 18 Nov 2026; simplified the same day): two switchers in the same shape (`.mi-wetten`, 18/500): the law (Klimaatwet, Stikstofwet) on top of the left column, and the target year, year only (Klimaatwet 2030, 2040, 2050; Stikstofwet 2030, 2035), right in the heading row (`.mi-kop`; both with 32 tall options and 8 to every edge; since 24 Nov 2026, Tobias, to make the card shorter). The year sets the end of the x-axis. No peildatum stamp under the row: the source line under the chart is enough. Keep extra text and sources out of this block unless they are needed.
- Kans (bottom left, under the latest figure, Tobias 18 Nov 2026): first the target for the chosen year as one 14px line above a hairline (`.mi-doel`), then the chance block (`.mi-kans`: 2px `--accent` edge since 24 Nov 2026, 13px label "Kans dat het doel van 2030 wordt gehaald"). Only a published percentage gets the traffic-light dot (`--bad` under 50%, `--warning` 50 to 75%, `--good` above 75%) with the figure in ink and the source's verdict; a verdict without a percentage is quoted with "volgens PBL" and no dot; with nothing published there is no chance block. Never invent a chance.
- Under the top row: the substance chips (no group label), the latest figure, the target and the chance on the left, the chart on the right.

## Overzicht lists

- Order and widths: Net binnen left (3fr), Komt eraan right (2fr) from 1000px; stacked in that order below. Both sections have their heading in white on a forest bar (the year switcher in it on a white ground), on top of the card (since 24 Nov 2026; 24/500 on Overzicht, like "Hoe staan we er voor?" below them (lists above the chart since 23 Nov 2026, Tobias) (a card since 16 Nov 2026; the switcher has no top margin inside it). Above everything sits `.ov-intro`: one `h1` (`.ov-lead`, 45/500, ink, max 36ch; the page's `h1`) and one paragraph (`.ov-uitleg`, 18/400, ink-2, max `--leesbreedte`; since 18 Nov 2026, with links to Thema's, Agenda, Wetgeving, Moties, Amendementen, Kamervragen and Kamerbrieven), 32 above, 8 between, no accent or frame. The first row of Komt eraan is the next plenary vote when one is planned (`komendeStemming()`): `Stemmingen` (link to `#moties`), the `dagKort` date and "Plenaire vergadering", then "n moties en n amendementen" as the title, linking to that day on Agenda (opened), with "Stemming morgen" on line 1; no red and no Eerstvolgend badge. Komt eraan is filled up to 15 rows and then trimmed after drawing (`passKomtEraan()`) until it is no longer than Net binnen, so both columns end about level. The two cards stretch to one bottom edge: the list grows, the kaartvoet (under a hairline; see Standard sizes) stays at the bottom.
- A Net binnen row follows the row rule (Do 6): `Kamerbrief  18 nov 2026  Klimaat en Groene Groei` on line 1, the title on line 2, then a tail: indiener as surname plus fractie with c.s. (same `indienerKort` as the Moties table) and `· Voor X / Tegen Y`, the Kamerstuk number and title for a stuk, or the Kamerstuk number for a wetsvoorstel. Komt eraan uses the same rows: type, date and time, commissie; the vote row reads `Stemmingen  di 24 nov  Plenaire vergadering`. Names in titles lose their initials after "het lid" or "de leden".

## Themes

Ten fixed themes, defined once in `THEMAS` in `assets/themas.js` (slug, label, order, description). Every page that shows themes (Thema's, the filter on Agenda, chips on rows) reads that constant; nothing else defines a theme name or order.

- **No color, no icon per theme.** A theme is a word. Theme chips (`.tchip`) are neutral outline chips: 12px ink-2 text, `--line` border, radius 6. Clickable chips get `--line-sterk` and ink on hover; a 4px invisible extension keeps the hit area at least 24px tall. The selected state (a theme chosen as filter on Agenda, where a chip click toggles that filter) is the one forest fill, as for every chip.
- **Overview (`#themas`).** Page title, then the ten themes in fixed order as a 5 × 2 grid of name-only cards (`.themagrid`, `repeat(5, 1fr)`, gap 16; Tobias, 14 Nov 2026). This is a list of destinations, not a row of stat tiles, so Don't 10 does not apply. Each card is one `<a>` (`.themakaart`, min-height 96) holding only the title (18/500). No intro line, counts, "Nieuw" marker (tried and removed 23 Nov 2026, Tobias) or next moment: everything else lives on the theme page. Hover: border to `--line-sterk` and an underline on the title (like `.ltitel`); focus: the 2px forest ring. No fill and no red on the cards.
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

- **Head.** The switcher "Komend | Geweest" (since 19 Nov 2026; 40 tall, 18/500; the reference size for all page controls) sits left in the toolbar row and stands in for the page title (the `h1` is for screen readers), like Wetgeving. Both are links that keep the filters; the URL keeps `terugblik=1` for Geweest. No intro line, no counts, no subscribe menu. The switcher, the filters and the search field share one row; there is no "Eerdere vergaderingen" button (removed 23 Nov 2026, Tobias). At the bottom of Geweest "Naar komende vergaderingen" goes back.
- **Toolbar.** The shared toolbar (see Tables): "Zoek in de agenda" (title, commissie and type), then Type, Ministerie and Thema (no Commissie filter since 18 Nov 2026); on Agenda the filter buttons and search field are 40 tall at 15px, smaller than on the document pages; themes in the fixed `THEMAS` order, the rest by count. No filter on summaries. Everything is in the URL (`q`, the filters, `terugblik=1`).
- **Timeline.** Weeks (`h3.tl-weekkop`, sticky under the site header while you scroll), days with a date column, rows (`.tl-item`, since 19 Nov 2026) in three columns: the time (96 wide, 18/500 ink, with the end time under it as "tot 13:00" at 14 ink-2 when the Kamer gives one on the same day; the red `Eerstvolgend` label under it for the next meeting or plenary vote, by real start time; "tot 14:00" for an Inbreng deadline), the content (first the title at 18/500, ink; in a row that opens it is text and opens the row, and "Bekijk op tweedekamer.nl" sits at the bottom of the opened body, left of "… inklappen" (`.uitvoet`; 24 Nov 2026), otherwise it links to the Kamer page with the external arrow (Tobias, 23 Nov 2026); then the meta line: type `.tag`, commissie, zaal, `Besloten`/`Kort` badges, then the theme chips, clickable to toggle that filter) and on the right the one toggle with "Live op Debat Direct" under it. Whatever a toggle opens spans the full width under the row. A hovered or open expandable row gets the 4px forest strip. Meetings on the same day have a `--line` rule between them as wide as the day and week rules (all from the date column to the right edge), and every rule sits 16px from the text above and below it (Tobias, 23 Nov 2026). Within a day: by start time, an Inbreng deadline ("tot 10:00") before a meeting starting at that time. The toggle sits vertically centred on the right of its row, every toggle 228 wide (fits "Toon agenda (xxx punten)") with chevron and text on the left (Tobias, 24 Nov 2026); "Live op Debat Direct" at 14, at the bottom right. Today has a red "Vandaag" and day number and a 2px `--alarm` rule on its left edge; no fill and no bordered card. Past rows have ink-2 titles.
- **Komend** starts at the top of the page with today and shows only what is coming. Opening the tab or switching views always starts at the top. **Geweest** shows only what has been, newest week and day first (rows within a day stay in time order).
- **Plenary votes.** Komend has one row per upcoming voting date (`stemmingenPerDag()`, shared with Komt eraan): type `Stemmingen`, "Plenaire vergadering", title "n moties en n amendementen", with a forest toggle that lists them per Kamerstukdossier with indiener and appreciatie (`stemBlok()`; `#agenda/s-<datum>` opens it); the start time the Kamer gives (since 24 Nov 2026; without one the row comes last that day). `Stemmingen` is a Type value; with a theme filter the counts only include that theme; a Ministerie filter hides it. Not in Geweest.
- **Summary.** A summarized meeting gets the "Toon samenvatting" toggle (a `.knop`, 40px at 14, chevron rotating 180°) on the right; a click anywhere on the row (not on a link, a button or the opened body) does the same; the body expands with the accordion (`grid-template-rows`, the one allowed size animation) and keeps the two-column layout from 1100px: content left (Debat Direct and Transcript, Aanzet, Kern, Standpunten fracties, Toezeggingen, Moties, Vervolg), agendapunten and deelnemers right, the peil stamp and "Samenvatting inklappen" at the bottom. Open summaries stay open when the list is redrawn. A second activity that shares a summary shows one small link to it instead of a second copy.
- **Agenda and moties of a meeting** (since 16 Nov 2026; one toggle since 19 Nov 2026). A meeting without a summary gets the same toggle when it has agendapunten and/or moties: "Toon agenda (n punten)", "Toon 18 moties (0 aangenomen)" or "Toon agenda en 18 moties", with the same accordion: agendapunten (numbered; per point "Te behandelen:" and its stukken sorted by Kamerstuknummer, each linked as "Brief regering (33450-142)" or just its kind without a number (24 Nov 2026), the stuk's subject left out when it repeats the point; moties and amendementen carry their `.status`: the uitslag, or "Stemming di 17 nov") and a Moties section left, deelnemers right behind a 1px `--line` rule, "… inklappen" at the bottom. Behind a stuk a link "Alle moties" (`#moties?q=32813`), once per Kamerstukdossier within a point and only when there are moties (Tobias, 24 Nov 2026). No agenda when the only point repeats the title without stukken. `#agenda/a-<nummer>` opens it.
- **Motie links.** A motie or amendement on Agenda (in the Moties section or under "Te behandelen:") links to its row on our own page, opened and scrolled into view (`#moties?open=<zaak>`, `#amendementen?open=<zaak>`); tweedekamer.nl stays one click further, in the row. Stukken that are not on our pages still go to tweedekamer.nl.
- **Deadlines** (`termijn()`). Only in the next-step block of a bill: "Sluit over n dagen" for an Inbreng, else "Over n dagen" (up to 14 days), 600 ink, red only on the day itself. Removed from Agenda and Komt eraan on 24 Nov 2026 (Tobias), like "Gesloten".
- **Meta extras.** Room (`zaal`: Locatie, reserved room, or "Plenaire zaal" for plenary debates; the Kamer data often leaves it empty, then nothing shows) and a quiet `Besloten` badge.

## Kerndocumenten

The fixed documents of policy research, one page per group since 17 Nov 2026 (`#kerndocumenten/<groep>`; `#documenten/…` redirects): Kabinetsplannen, Begrotingen, Rapporten, Rechtspraak, reached from the Documenten menu. Rapporten has no Soort or Kenmerk column (columns Rapport, Uitgever, Thema, Datum; the Uitgever filter counts each publisher of a joint report ("RIVM en WUR") on its own, with no combined option; the Kamerbrief it came with is in the opened row). Each page is the table pattern (see Tables) with the group's full label as page title ("Begroting en financiën") and the shared toolbar. There is no intro text, no note under the table and no counts.
- **Row.** Each row is the `.themaregel` pattern: a meta line (`.tag` for the kind of document, the `11 nov 2026` date, the publisher, the official identifier in DM Mono: Kamerstuk, D-number, ECLI, BWBR, CELEX), the title as an external link with the arrow, theme chips, optional secondary links (13px, ink-2) and "Eerdere edities (n)" as `details.meer`. Only the newest edition per series shows.
- **Order.** Begroting en financiën starts with the budget cycle (Miljoenennota, Belastingplan, Voorjaarsnota, Najaarsnota, Financieel Jaarverslag), then the file order. Other groups follow the file order, which is curated, not by date.
- **Chapters table.** Budgets and annual reports per chapter form one table in the Begroting group: chapter letter (DM Mono 13, ink-2), name with theme chips, one column per budget year and the latest annual report. Cells are the document number (DM Mono 13, links to the PDF) with a small second link (Rijksfinanciën for the newest budget, Rekenkamer for the annual report). A `.peil` stamp names the Kamerstuk. There are no status dots and no accent.

## Tables

The Moties table is the reference for every data table. Every document type has its own page since 17 Nov 2026 (Moties, Amendementen, Kamervragen, Kamerbrieven and the Kerndocumenten groups); only Wetgeving keeps a switcher. All are built from the same code (`tabelPagina()`/`bindTabel()` with a definition per page in app.js): same title, toolbar, date sort, row disclosure and phone layout. Filters, search and date order live in the URL (`#vragen?status=Open&thema=…&q=…&volgorde=oud`).

- New since the previous working day (since 20 Nov 2026, Tobias): in Net binnen and in every table sorted newest first, a 2px `--alarm` line sits above the first item from before the previous working day (Monday: Friday). It spans the full card or table width and carries two 12px `--alarm-tekst` labels: "↑ Nieuw sinds donderdag 19 nov 2026" above the line on the left, "Eerder ↓" below it on the right (label added 20 Nov 2026, Tobias). It replaces the grey divider between those two rows. It is the only red in a list or table. No line when nothing is new.
- Month headings (since 23 Nov 2026, Tobias): tables with at least 100 rows and on average 5 per month (Moties, Amendementen, Kamervragen, Kamerbrieven, Rapporten; not Wetgeving) get a `tr.maand` row per month: "November 2026" 15/600 on white with a 1px ink line under it, sticky under the table head. No counts.
- Every page has exactly one `h1` (since 17 Nov 2026, audit): the visible page title at 30px, or a screen-reader-only `h1` where a switcher stands in for the title (Wetgeving, Agenda, Zoeken). Section heads are `h2`.
- Above the table (every Documenten page): the page title (`h1`, 30px) left and the search field right on one row (`.kopbalk`, `paginaKop()`). No subtitle (removed 23 Nov 2026, Tobias) and no count line.
- Filters in the header row (since 23 Nov 2026, Tobias): every column with a filter has a `details.facet` button as its header (`th.kopf`; 40 tall, the label, the number of chosen values, the chevron); the menu is the same checkbox menu as before. The header row is one forest bar at 15/600 white (11.1:1; Tobias, 24 Nov 2026), sticky as a whole (`thead`): no borders around filters, `--accent-hover` on hover, a filter in use a white block with forest text, the chosen Wetgeving option a white block, white focus rings. A 2px white line on top separates it from the header bar while scrolling. The table has no outer frame, side lines or rounded corners, so head and rows are equally wide. Active filters stay as chips with "Alles wissen" between the title row and the table. On desktop `.tablewrap` is `overflow: visible` so a menu may hang below a short table. Cells have 12px side padding so all columns fit at 1280.
- Toolbar (`.werkbalk`, on every page with a list, also Agenda and the theme pages; on table pages only the search field, and on theme pages the switcher, since the filters sit in the header row): on table pages it shares one row with the title (`.kopbalk`: title block left, toolbar right, bottom-aligned; Tobias, 19 Nov 2026, to save height); when it does not fit next to the title (a switcher, as on Wetgeving and the theme pages) the whole toolbar drops to the next row; a switcher, when the page has one, left-aligned; the filters and the search field right-aligned, the search field furthest right (40px, 15px text, up to 440 wide, a placeholder that says what it searches: "Zoek op onderwerp, Kamerlid of Kamerstuknummer"); one `details.facet` button per filter (40px, 15px, 16px chevron). `werkbalk(hint, q, links)` takes the switcher as `links`. Each opens a checkbox menu (rows 48px at 18): several values per filter ("or"), filters combine ("and"); each option shows how many rows it would give under the other filters, options at zero stay in muted text; a filter in use shows its count next to the label. One menu is open at a time; Escape or a click outside closes it. Active filters sit under the toolbar as removable chips (48px) with "Alles wissen". Code: `werkbalk()`, `tekenWerkbalk()`, `bindWerkbalk()`, `pastFilters()`. After each search or filter change a hidden `role="status"` line (`#wstatus`, `meldAantal()`, 400 ms after the last change) says "n resultaten" or "Geen resultaten met deze filters"; the first render says nothing.
- Search results (`#zoeken`, Tobias 18 Nov 2026): one filter row with two cards (`.filterkaart`: `--card`, `--line`, radius 12, padding 4, borderless chips 8px apart in padding), the result kinds left and the period (Alle jaren, Deze Kamerperiode, Afgelopen maand) against the right edge, so the two filter types read as separate. Always newest first: no sort choice.
- Column order: title first (header "Motie over..." or "Amendement over..."; titles start lowercase so they read on from the header, acronyms stay as they are), then the status and people columns (Uitslag, Appreciatie kabinet, Indiener), then Thema (theme chips at 12, stacked, 200px; "Geen thema" in its filter; since 23 Nov 2026 at most two plus "+n" (`themaCel()`), all of them in a small card over the cell on hover or when the row's toggle has keyboard focus), then Kamerstuk and Datum. The title takes 38% and wraps; Indiener, Appreciatie and ministries may wrap; status, Kamerstuk and dates stay on one line. The date is always the last column. Column headers are plain labels (15px); only Datum is a button.
- All columns align left, also dates and Kamerstuk numbers (`tabular-nums`; Kamerstuk numbers in DM Mono 15; Tobias, 23 Nov 2026); only Rapport? on Kamerbrieven (a check or a muted –) is centred, header and cells. Header text sits on exactly the same line as the cell text below it: header cells have the same horizontal padding as body cells, and a header button has no padding of its own.
- One line height for every body cell (22px), so first lines share a baseline. A status (dot plus word) is `display: flex` inside a cell; an inline-flex status takes its baseline from the empty dot and drops 1px.
- Sorting: only dates sort (a button inside the `th`, `aria-sort` on it). One click reverses the order; the arrow sits right of the label. Empty dates sort last.
- Empty result: "Geen moties met deze filters" with a "Filters wissen" link button.
- Row: always white; hover or open shows a 4px forest strip on the left (also along the detail row), hover underlines the title (a bill title only turns forest, since 24 Nov 2026: underlining the whole title is too busy). A click on the row opens or closes its detail row (not while selecting text). The title is plain text: a click on it opens the row too, and the source (tweedekamer.nl, wetten.overheid.nl) is a button or link in the detail row (Tobias, 23 Nov 2026). Only a Wetsvoorstel title is a link, to our own page. Other buttons in the row do not trigger the row.
- Disclosure: a 32px button with the 16px chevron, always visible at the right edge of the title cell, all in one line (since 23 Nov 2026; `aria-expanded`, label "Details: <title>"). It turns forest only on its own hover. The detail row is white, indented to the title's text edge.
- Detail row: data only, no title repeat, no history, no bars. Three groups 20 apart at 15/24: the identifiers line (`Zaak … · document … · ingediend …, door …`, numbers in DM Mono), the vote (`Voor 111 / Tegen 36`, then the fracties voor and tegen as two columns, stacked on phones, alphabetical, ink-2), and the links below a hairline.
- Wetgeving (since 17 Nov 2026): switcher "Wetsvoorstellen | Geldende wetten" (`#wetgeving`, `#wetgeving/wetten`); since 23 Nov 2026 it is the header of the title column (36 tall) and the visible `h1` "Wetgeving" sits left of the search field. In a bill title every law is bold (since 24 Nov 2026): Dutch laws link to their row on Geldende wetten, EU law to EUR-Lex in a new tab with the arrow; repealed laws are bold only. The green around the chosen part of the switcher is 9px on all sides. Without an amended law the citeertitel in brackets at the end is bold (`wetTitel()`, `wetDelen()`); the rest of the title is 400 and links to the bill. Geldende wetten: Wet (opens wetten.overheid.nl), Thema, Kenmerk (BWBR).
- Kerndocumenten: one page per group (`#kerndocumenten/<groep>`). Columns: Document, Soort, Hoofdstuk (Begroting only; "Rijksbreed" when empty), Uitgever (wraps like a ministry), Thema, Kenmerk (Kamerstuk as `37020-XII`, ECLI or D-nummer, DM Mono), Datum. One row per series (newest edition). Detail row: identifiers, "Eerdere edities (n)" as a list with date, kenmerk and "Lees", then the links ("Bekijk het origineel", the source page, Kamerstukdossier, Rijksfinanciën, Rekenkamer). A row never links to a download: Kamer documents open their page on tweedekamer.nl.
- Wetsvoorstellen: Columns: Wetsvoorstel, Status, Ingediend door (Regering or the initiatiefnemers), Thema, Kamerstuk, Ingediend. Filters: Thema, Status, Ingediend door. Status is the phase as on tweedekamer.nl (Voorbereiding, Debat, Stemming with the `--warning` dot; when done the result). Detail row: identifiers, the phase bar and the next step, links ("Alles over dit wetsvoorstel", tweedekamer.nl, OpenTK). The title opens our own page for the bill (`#wetgeving/<Kamerstuk>`, Tobias 19 Nov 2026), so it has no external arrow.
- Bill page (`#wetgeving/<Kamerstuk>`, since 19 Nov 2026): "Alle wetsvoorstellen" back link, the title as `h1` (30px, max `--leesbreedte`), one meta line (14, ink-2: Kamerstuk in DM Mono, date, submitter, theme chips), the phase bar (`.wfasen`: five equal steps (Eerste Kamer since 23 Nov 2026) with a 2px rule on top, ink up to the current phase, `--line` after it; labels 15 on this page (13 in a table detail row), the current one ink 500, later ones muted) with the next step under it as its own block (`.wp-stap`, since 23 Nov 2026, 2px `--accent` border since 24 Nov 2026: name 18/500, then date and time, commissie and the deadline label), then the links below a hairline. `h2` "Wetgevingsproces": one timeline (`.wtl`) per year under a sticky year heading (`h3.tl-weekkop`, as on Agenda) with "Kamerstuk 35756 · Stemming" muted on its right, so a long history keeps its place and its bill; a hairline between days, the date (120 wide, ink, tabular) left and that day's lines right (15, ink-2; links ink). Kamerstukken show their number in muted DM Mono and "Lees". Motions and amendments of one vote day form one block ("Gestemd over 1 amendement en 18 moties"): rows at 14 with a 144px status column, the forest strip on hover and when open; open shows the same content as the Moties row. Planned items end with a muted "(gepland)". An optional `h2` "Mogelijk gerelateerd" lists Kamervragen that name the Kamerstuk.
- Kamervragen (`#vragen`) and Kamerbrieven (`#brieven`) are two pages since 17 Nov 2026. Kamervragen: one row per zaak, the question with its answer(s). Columns: "Vragen over...", Status (Beantwoord `--good`; Open and Termijn verstreken `--warning`, the word tells them apart; the term is 21 days), Gesteld door (surname plus fractie, c.s.), Gericht aan (ministry, wraps), Thema, Gesteld. Detail row: identifiers, the answer(s) with date, signatory and number of days, or "Nog niet beantwoord, n dagen na het stellen", links to question and answer. Kamerbrieven: "Kamerbrief over...", Ministerie (wraps), Kamer (Tweede/Eerste Kamer), "Rapport?" (a check icon, 20px ink-2, empty when there is none, with screen-reader text; since 23 Nov 2026 these two columns replace the "Eerste Kamer" and "Met rapport" badges after the title), Thema, Kamerstuk, Datum; detail row with signatory and Kamerstuk titles. Attachments (since 17 Nov 2026): a "Bijlagen (n)" group in the detail row of a letter and of an answer, one link per attachment (title as in the Kamerdata, file type in muted DM Mono, a report preceded by "Rapport:" at 15/500, beslisnota last), between the data groups and the links. Ministry cells wrap at 360px.
- Text of a motie or amendement (since 17 Nov 2026): right under the identifiers line, without a label (since 19 Nov 2026), in its own card (`.mt-plek`: `--page` fill, 2px `--accent` border since 24 Nov 2026, radius 12, padding 16/20; Tobias, 18 Nov 2026) at 15/24 like the detail text around it (since 19 Nov 2026). Overwegingen and the opening in ink-2, the decisive part ("verzoekt de regering", "spreekt uit") in ink at 600, "en gaat over tot de orde van de dag" in ink at 400; no italics, no accent. An amendement shows its Toelichting first (the kop "Toelichting" at 15/500 ink) and the change itself behind `details.meer` "Toon de wijziging zelf"; more than ten paragraphs fold after eight ("Toon de rest (n alinea's)"). Under the official text one 12px muted source line: "Officiële tekst · Kamerstuk 36947, nr. 43" (link). A provisional text (from the pdf or docx) gets no source line (Tobias, 18 Nov 2026).
- Buttons (three levels, since 23 Nov 2026, Tobias: no ghost buttons for important clicks): **forest** `.knop` for the one main action (`mlinks()` puts exactly one in an opened row: "Lees het antwoord", "Lees de brief", "Bekijk het origineel", "Alles over dit wetsvoorstel", else the first link; "Lees het wetsvoorstel" on a bill page; "Toon samenvatting" and "Toon n moties" on Agenda; "Naar komende vergaderingen"); **outlined** `.knop.licht` (white, forest text and 1px forest border, a 2px forest edge on hover; since 23 Nov 2026, never for the main action) for secondary actions ("Lees de vragen", "Toon agenda", the buttons under Net binnen and Komt eraan; 40 tall, `.klein` 28 for "Lees" after a document); **underlined text** for sources outside the site. Filter buttons are white with forest text and border, page search fields white with a `--knop-rand` border; a filter in use is forest with white text. No arrow on a button.
- Document viewer (`dialog.docview`, since 17 Nov 2026): a modal of 960px wide and the window height minus 48, white, `--line` border, radius 12, one soft neutral shadow; backdrop ink at 32%. Head: meta in DM Mono 12 muted (`PDF · 2026D58358 · 3 pagina's`), the title at 18/500, then "Download" and "Op tweedekamer.nl" (13px links) and a 32px close button. Body white with 24 padding: pdf pages as white sheets with a hairline, 16 apart, at most 860 wide, drawn when they come near the viewport, with a selectable text layer; Word files as white sheets as wide as Word's own text line plus 48 on both sides. Word view since 24 Nov 2026 (Tobias, as in Word): font, size, bold, italic, underline, alignment, tables and lists come from the document (Verdana when a font is missing), no letterhead or footer, links forest; the site's table styles stay out. Kamervragen without numbering in the file numbered "1.", "2."; a footnote number (forest) opens its note in a small card (14/20, `--card`, `--line`, radius 12, soft shadow, 420 wide) right under it on click or hover, the list at the bottom stays; from 3 subheadings (Word headings or paragraphs that are only bold text, not in a table) a 200px "Inhoud" column on the left, sticky, 14/20 ink-2 links, the heading in view in 500 with a hairline. Loading and errors are one sentence at 14px with the download link. Escape, the close button or a click on the backdrop close it; the page behind does not scroll.
- Phones (≤640px, not maintained): each row becomes a block with the title on top, status and date beneath; secondary columns are hidden.

## Template check

Swap "milieuradar" for another environmental site (a city air-quality monitor, a national climate dashboard) and ask what would still fit. These parts survived the swap, so each one gets a rule:

| Survives the swap | Rule |
| --- | --- |
| Green accent | Forest is the accent, but not the identity on its own. The identity is white paper with near-black ink, the solid forest header, the three-bar mark (one red bar), the lowercase wordmark, and red meaning "now or over the limit". |
| An emissions line chart | Every measurement is shown against the target of the Dutch law that governs it, and only that target: the Klimaatwet line (−55% vs 1990) only on the total of all greenhouse gases; the stikstofwet target only as a reduction against the PBL projection for 2030, never as an invented line back to 1990. The target is stated in one sentence next to the chart. A new indicator without a legal target and that sentence does not ship. |
| A mono source caption | Stamps name the official identifier, not just the organization: `tabel 85668NED`, `Kamerstuk 36169`, zaak and activity numbers, the station. "Bron: CBS" alone is not enough. |
| A stat strip with counts | Stat labels name the parliamentary unit and its period (moties, Kamerbrieven, toezeggingen; "sinds het begin van de Kamerperiode"). Never generic units like items, updates or records. |
| Neutral dashboard chrome | Overzicht always puts measurement and parliament on one screen: the parliament lists first, then the emissions chart (Tobias, 23 Nov 2026). A page with only one of the two is a different product. |

What did not survive the swap, and must stay: the Kamer-native material itself (moties with the vote per fractie, Kamerstuknummers, commissies, toezeggingen, the agenda of the Kamer), equal weight for all fracties, and Dutch throughout.

## Where things live

- Tokens: top of `assets/style.css` ("ontwerpknoppen").
- Icons: `ICO` and `ico()` near the top of `assets/app.js`.
- Emissions chart with its targets: `assets/milieu.js`.
- Themes: `THEMAS`, the rules engine and the shared item list in `assets/themas.js`; keyword rules in `data/themas.json`; approved per-item themes in `data/themas-mapping.json`; review CSV and import in `pipeline/themas_review.js`; noscript list in `pipeline/themas_noscript.js`.

### Known duplication (to dedupe later)

- Four list-item renderers each build their own meta row: `stukLi`, `agendaLi`, `themaRegel`, the zoek item. They share the `.regelmeta`/`.zmeta` style, but the markup is still written five times. `feedLi` (Net binnen) is deliberately different: one flowing line (`.feed`).
