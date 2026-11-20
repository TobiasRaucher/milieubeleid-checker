# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Tobias (owner), first.** Follows Dutch environmental and climate policy for his work and uses MilieuRadar daily as his own overview of what happens in the Tweede Kamer.
- **Policy professionals, second.** People who follow milieu and klimaat in the Tweede Kamer for a living (beleidsmedewerkers, NGO and sector staff, Kamer staff). They read on a desktop during working hours.

## Product Purpose

One place to follow the debate around Dutch environmental policy: wetsvoorstellen, moties and amendementen with their votes, Kamervragen with the answers, Kamerbrieven, the Kamer agenda, summaries of debates and the fixed reference documents (Kerndocumenten). Today this means visiting several websites and ending up with a folder full of downloaded PDFs; MilieuRadar removes that.

Success, in order: Tobias can follow everything without going to tweedekamer.nl and other sites; then, the site is reliable enough that other professionals can use it and link to it.

## Positioning

- **Only milieu, curated.** A selection of the Kamer's work limited to environment and climate, sorted into ten fixed themes.
- **Debates summarised.** Debates are summarised from gehoord.de transcripts, with positions per fractie and toezeggingen, so a debate can be followed without watching it.
- **One place, neutral.** Moties with the vote per fractie, Kamervragen with their answers, the agenda and the documents together, readable in the site itself (documents open in an in-site viewer, not as downloads). Every fractie gets equal weight; the site gives no opinion.

The emissions chart ("Wat Nederland uitstoot", CBS and PBL figures against the legal targets) is a feature, not the core of the positioning (Tobias, 17 Nov 2026).

## Operating Context

- Desktop only; nothing is designed or checked at phone width.
- All content is in Dutch.
- A GitHub Action (05:17 and 17:17 UTC, working days) fetches the Kamer open data; Tobias asks Claude to "werk de checker bij" for summaries, mijlpalen and kerndocumenten.
- Users cite the official source: links go to the document pages on tweedekamer.nl, and the Handelingen remain the official record.

## Capabilities and Constraints

- Static site without a build step (`index.html`, `assets/`), published from `main` by GitHub Pages; data from a Python pipeline over the Tweede Kamer open data (`pipeline/`, `data/tk/`).
- Pages: Overzicht, Thema's, Agenda, and under Documenten: Wetgeving, Moties, Amendementen, Kamervragen, Kamerbrieven and five Kerndocumenten groups; site-wide search.
- Priority subject: the change of the Klimaatwet after the Klimaatzaak Bonaire.
- Removed on purpose and not to be brought back without asking: see "Bewust weg" in `CLAUDE.md` (dossiers, Toezeggingen and Per fractie pages, kerncijfers on Overzicht, intro texts above tables, EU documents for now).
- Undecided: a signature visual for the site (the Meetlint idea was dropped on 17 Nov 2026); the rework of the themes.

## Brand Commitments

- Name: milieuradar (lowercase wordmark), with the three-bar mark (one red bar).
- Voice: Dutch, neutral and factual; statements that are not verified facts are attributed to the speaker ("volgens PRO"). No hype, no exclamation marks, no em dashes.
- Every figure carries its source and date.

## Evidence on Hand

- Data: Tweede Kamer open data (`data/tk/`), debate summaries (`data/debatten.json`), mijlpalen (`data/agenda.json`), kerndocumenten (`data/kerndocumenten.json`), CBS and PBL emissions figures (`assets/milieu.js`).
- Summaries are AI-generated from automatic transcripts and are not an official source; the site says so.
- No users, testimonials, usage figures or press exist; none may be invented.

## Product Principles

1. Follow, don't hunt: everything about a subject is reachable from one place, without downloading files or switching sites.
2. Neutral by construction: equal weight for every fractie, no own judgement, claims attributed to who made them.
3. Source on every fact: link to the official document and state where and when a figure comes from.
4. Tobias's working day first; built so that other professionals can rely on it too.

## Accessibility & Inclusion

Working target from DESIGN.md: text contrast of at least 4.5:1, a visible focus ring, full keyboard use of menus, filters and row details. No further product-specific requirement has been set.
