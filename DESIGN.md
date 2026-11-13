# DESIGN.md: milieuradar

The design rules for this site. Every change to the look of milieuradar starts here. The values live as tokens at the top of `assets/style.css`; this file says what they are for and what is not allowed. If a rule here and the code disagree, the code is wrong.

Set in the unslop pass of 13 Nov 2026 (method: unslop by Damir Sokolovsky, [@heydamir](https://x.com/heydamir), CC BY 4.0).

## Direction

- **Product.** A Dutch monitor of environmental and climate policy in the Tweede Kamer (laws, moties, debates, ministry letters, agenda), shown next to the measurements that policy answers to, for people who read policy for a living.
- **Character.** Exact, sober, alert.
- **World.** The measurement desk: monitoring stations, instrument readouts, CBS/RIVM/NOAA tables and typeset Kamerstukken.
- **Moments.** The CO₂ readout, the emissions chart (the largest drawn thing on Overzicht) and the planetary boundaries grid, where each indicator sits on a scale against its limit. The chrome stays quiet around all three.
- **Signature.** The peildatum stamp: every figure carries its source and date in one mono caption, in one format (`NOAA · Mauna Loa, Hawaii · daggemiddelde 11 nov 2026`). Red only ever means past the limit, happening now, or a verworpen vote outcome (a traffic light, by Tobias's choice of 13 Nov 2026).

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
- Used for: the selected state (chips, subnav, pressed dossier chip), the primary button, chart lines and fills, completed phases on the stepper, the "radar" half of the wordmark, focus rings.
- `--accent-soft` `#e6f2ea` only as the focus halo and a checked filter row.

### Alarm and meaning

- `--alarm` `#d6343a` (marks, borders, zones) and `--alarm-tekst` `#b4262c` (text, 6.45:1 on white). `--alarm-soft` `#fdf1f1` is only for today's row on Agenda.
- `--bad` `#d6343a` (same red) is only the status dot for verworpen.
- Status dots, a traffic light: aangenomen/afgedaan `--good` `#1a7f4b`, in behandeling/aangehouden/openstaand `--warning` `#d59a0a`, verworpen `--bad` `#d6343a`, ingetrokken/vervallen `--neutraal-stip` `#a3aba6`. The dot carries the color, the word carries the meaning; the word stays ink.
- Votes: voor `--voor` = ink, tegen `--tegen` `#cdd3cf`. Empty bars and phases not yet reached: `--spoor` `#e4e7e5`.
- Theme colors (9, in `data/themas.json`) appear only as an 8px dot.

### Type

- Families: **DM Sans** (400, 500, 600) for everything; **DM Mono** (400, 500) only for source stamps, the header stamp, chart axes and end labels, Kamerstuk, zaak and document numbers, and the measured values in the boundaries grid. Dates and times are DM Sans with `tabular-nums`.
- Sizes (`--t-*`): 12 meta and stamps, 13 captions, 14 controls and tables, 15 body, 18 card titles, 20 section heads and wordmark, 30 page titles and key figures, 64 the CO₂ figure. Mobile only: 24 for stat figures, 52 for the CO₂ figure.
- Weights: 400 body, 500 headings and figures, 600 for rare emphasis (`<b>`, group heads). Never 700.
- Tracking: 0 below 20px; −0.005em at 18 to 20; −0.02em at 30; −0.03em at 64.

### Spacing

4px grid: **4, 8, 12, 16, 20, 24, 32, 40, 48, 64**. 1px and 2px only as nudges inside small controls.

- Inside controls 4 to 12; list rows 12 apart; groups 12 to 24; above a section head 40; page bottom 64.
- Card padding 20 (16 on phones), indicator cards 24, filter bar 16, stat cells 16/20.
- Controls 36 tall (32 for compact chips and subnav), main tabs 36.

### Radii

| Element | Token | Radius |
| --- | --- | --- |
| Tag, label, keycap (keycap 4) | `--r-tag` | 6 |
| Button, field, select, chip, menu row | `--r-control` | 8 |
| Card, tile, menu | `--r-card` | 12 |
| Panel (CO₂ band, filter bar) | `--r-panel` | 16 |
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
- The CO₂ figure counts up once per visit from last year's value; that shows the change. No other number animates on load.
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
2. No green surfaces, green borders as decoration, green section labels or green links. Links are ink with a hairline underline and turn green on hover.
3. No red for anything except over the limit, today, eerstvolgend and the verworpen status dot. Not for votes against, not for text, not for row backgrounds.
4. No blue or other hue outside the ramp, accent, alarm and the status/theme dots.
5. No uppercase tracked labels, no weight 700, no italic for emphasis, no negative tracking below 18px.
6. No emoji or Unicode glyphs as icons; no arrows appended to link text.
7. No filled badges; no pill shapes outside the main tab bar.
8. No stripes on the left of cards, no double rings, no three signals for one fact.
9. No inline `style=""` for spacing or type in templates; add a class.
10. No equal tiles in a row as a layout default; stats sit in one strip with hairline dividers.
11. No `transition: all`, no looping or bouncy motion, no hover scale on cards.
12. No greeting copy, exclamation marks, hype words or unverifiable claims.

## Tables

The Moties/Amendementen table is the reference for every data table.

- Above the table: the large switcher (`.schakelaar`), then one search field. The switcher stands in for the page title (the `h2` stays for screen readers only) and has the shape of the main tab bar: a raised white segment on `--surface`, 44px segments at 20px/500 (18px on phones), outer radius 12 and inner 8. No count line and no dropdowns above the table.
- Column order: title (header names the kind, "Motie" or "Amendement"), a 44px cell for the row's disclosure button right next to it, Uitslag, Appreciatie kabinet, Indiener, Dossier, Datum. The title takes 44% and wraps; every other column stays on one line. The date is always the last column.
- Text columns align left; dates and Kamerstuk numbers align right (`tabular-nums`; Kamerstuk numbers in DM Mono 13). Header text sits on exactly the same line as the cell text below it: header cells have the same horizontal padding as body cells, and a header button has no padding of its own.
- One line height for every body cell (22px at 14px), so first lines share a baseline. A status (dot plus word) is `display: flex` inside a cell; an inline-flex status takes its baseline from the empty dot and drops 1px.
- Filtering: a categorical column header is a button (`.kopfilter`) with a chevron that opens a checkbox menu (`.kopmenu`, a popover in the top layer so the table edge never clips it). Several values per column ("or"), columns combine ("and"). Each option shows how many rows it would give under the other filters; options at zero stay in the list in muted text. A column in use shows its count in accent next to the label; the menu has "Wissen" at the bottom once something is checked. The checkboxes line up under the header text. Escape, a click outside or tabbing out closes it. The chevron means "menu"; only the arrow means "sort".
- Sorting: only dates sort (a button inside the `th`, `aria-sort` on it). One click reverses the order; the arrow sits left of the label because the column is right-aligned. Empty dates sort last.
- Empty result: "Geen moties met deze filters" with a "Filters wissen" link button.
- Row: hover is `--surface`, pressed `--raised`, an open row stays `--surface`. When the whole row opens a link, the title is the real `<a>` (keyboard and middle click), the row click repeats it, and a hover underlines the title in `--line-sterk`. Other actions in the row are buttons that do not trigger the row.
- Disclosure: a 32px ghost button with the 16px chevron, rotating 180° when open; the detail row is `--surface`, indented to the title's text edge.
- Detail row: data only, no title repeat, no history, no bars. Three groups 16 apart at 13px: the identifiers line (`Zaak … · document … · ingediend …, door …`, numbers in DM Mono), the vote (`Voor 111 / Tegen 36`, then the fracties voor and tegen as two columns, stacked on phones, alphabetical, ink-2), and the links below a hairline.
- External arrow in a wrapping title: put it inside a no-wrap span with the last word, so it never sits alone on a line.
- Phones (≤640px): the header row becomes a row of 32px buttons (the filters and the date order) on `--surface`; each row becomes a block with the title on top, status and date beneath, the button at the right; secondary columns are hidden.

## Template check

Swap "milieuradar" for another environmental site (a city air-quality monitor, a national climate dashboard) and ask what would still fit. These parts survived the swap, so each one gets a rule:

| Survives the swap | Rule |
| --- | --- |
| Green accent on white | Green is not the identity. It means selection, the primary action, a chart line or a completed phase, and nothing else. The identity comes from the three-bar mark with its red bar, the lowercase wordmark, and red meaning "now or over the limit". |
| A CO₂ ppm readout with a year line | Every measurement block states in one sentence how it relates to Dutch policy or to a limit (CO₂ against 280 ppm and the 350 ppm boundary; CBS territory emissions are not the IPCC basis of the Klimaatwet). A new indicator without that sentence does not ship. |
| A planetary boundaries grid | Boundaries are always shown as a value against its limit on a scale, with corrections and their sources visible. No status-only tiles. |
| A mono source caption | Stamps name the official identifier, not just the organization: `tabel 85668NED`, `Kamerstuk 36169`, zaak and activity numbers, the station. "Bron: CBS" alone is not enough. |
| A stat strip with counts | Stat labels name the parliamentary unit and its period (moties, Kamerbrieven, toezeggingen; "sinds het begin van de Kamerperiode"). Never generic units like items, updates or records. |
| Neutral dashboard chrome | Overzicht always puts measurement and parliament on one screen: indicators first, then the Aandachtsdossier and the parliament lists. A page with only one of the two is a different product. |

What did not survive the swap, and must stay: the Kamer-native material itself (moties with the vote per fractie, Kamerstuknummers, commissies, toezeggingen, the agenda of the Kamer), equal weight for all fracties, and Dutch throughout.

## Where things live

- Tokens: top of `assets/style.css` ("ontwerpknoppen").
- Icons: `ICO` and `ico()` near the top of `assets/app.js`.
- Indicators (CO₂ readout, emissions chart, boundary scales): `assets/milieu.js`.

### Known duplication (to dedupe later)

- Six list-item renderers each build their own meta row: `stukLi`, `agendaLi`, the Recente stemmingen row in `overzicht()`, the toezegging item, fractie inbreng, the zoek item. They now share the `.regelmeta`/`.zmeta` style, but the markup is still written six times.
- `debatCard` and `vergaderCompact` repeat the same header markup.
- Stat strips are built in `overzicht()` (`stat()`) and inline in `fracties()`.
