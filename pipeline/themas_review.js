#!/usr/bin/env node
/* MilieuRadar: review van de thema-indeling.
   node pipeline/themas_review.js                 alle items als CSV (themas-review.csv): voorstel van de regels plus "Te beoordelen"
   node pipeline/themas_review.js --nieuw         alleen items die nog niet in data/themas-mapping.json staan (de wekelijkse review-diff)
   node pipeline/themas_review.js --import F.csv  zet een nagekeken CSV om in data/themas-mapping.json (bestaande regels blijven staan)

   CSV: puntkomma als scheidingsteken en UTF-8 met BOM, zodat Excel (NL) en Google Sheets hem direct goed openen.
   Kolom "themas" is wat in de mapping komt (slugs, gescheiden door komma's); pas die aan bij de review.
   Een item bewust zonder thema: laat "themas" leeg en zet status op "zonder thema". Leeg met een andere status wordt niet
   geïmporteerd (het komt terug in de volgende review). Rijen met status "overslaan" worden ook niet geïmporteerd. */
"use strict";
const fs = require("fs");
const path = require("path");
const M = require("../assets/themas.js");

const ROOT = path.join(__dirname, "..");
const lees = (p, fb) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8")); } catch (e) { return fb; } };
const MAP_PAD = "data/themas-mapping.json";

function laad() {
  const data = {
    zaken: lees("data/tk/zaken.json", []), stukken: lees("data/tk/stukken.json", []), activiteiten: lees("data/tk/activiteiten.json", []),
    debatten: lees("data/debatten.json", { debatten: [] }).debatten, agenda: lees("data/agenda.json", { items: [] }).items,
  };
  const mapping = lees(MAP_PAD, {});
  return { data, mapping, T: M.maak(lees("data/themas.json", {}), mapping) };
}

const LINK = (x) => {
  const r = x.ref || {};
  if (x.sleutel.startsWith("zaak:")) return r.tkLink || r.link || "";
  if (x.sleutel.startsWith("stuk:")) return r.link || "";
  if (x.sleutel.startsWith("debat:")) return r.tkLink || r.video || r.bron || "";
  return r.url || "";
};
const cel = (v) => { const s = String(v ?? ""); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const SOORT_NAAM = Object.fromEntries(M.SOORTEN.map((s) => [s.code, s.groep]));

function exporteer(alleenNieuw) {
  const { data, mapping, T } = laad();
  const items = M.bronItems(data).filter((x) => !alleenNieuw || !mapping[x.sleutel]);
  // dubbele sleutels (een geplande vergadering die ook als uitgevoerd voorkomt) maar één keer
  const gezien = new Set();
  const rijen = [];
  for (const x of items) {
    if (gezien.has(x.sleutel)) continue;
    gezien.add(x.sleutel);
    const v = T.voorstel(x.titel, x.overig, x.dossiers);
    const teBeoordelen = !v.themas.length;
    rijen.push({
      status: teBeoordelen ? "te beoordelen" : "voorstel",
      sleutel: x.sleutel, soort: SOORT_NAAM[x.soort] || x.soort, datum: x.datum || "", titel: x.titel,
      themas: v.themas.join(", "),
      zekerheid: v.zekerheid,
      grond: Object.entries(v.grond).map(([s, g]) => `${s}: ${g.join(" / ")}`).join(" | "),
      suggestie: v.suggestie.join(", "),
      link: LINK(x),
      opmerking: "",
    });
  }
  // te beoordelen bovenaan, dan per soort in de volgorde van de site, dan nieuwste eerst
  const orde = new Map(M.SOORTEN.map((s, i) => [s.groep, i]));
  rijen.sort((a, b) => (a.status === b.status ? 0 : a.status === "te beoordelen" ? -1 : 1) || orde.get(a.soort) - orde.get(b.soort) || b.datum.localeCompare(a.datum));
  const kop = ["status", "sleutel", "soort", "datum", "titel", "themas", "zekerheid", "grond", "suggestie", "link", "opmerking"];
  const csv = "﻿" + [kop.join(";"), ...rijen.map((r) => kop.map((k) => cel(r[k])).join(";"))].join("\r\n") + "\r\n";
  const uit = path.join(ROOT, alleenNieuw ? "themas-review-nieuw.csv" : "themas-review.csv");
  fs.writeFileSync(uit, csv);
  const tb = rijen.filter((r) => r.status === "te beoordelen").length;
  console.log(`${rijen.length} items, waarvan ${tb} te beoordelen -> ${path.relative(ROOT, uit)}`);
  return rijen;
}

// eenvoudige CSV-lezer voor puntkomma-bestanden met aanhalingstekens
function leesCsv(tekst) {
  tekst = tekst.replace(/^﻿/, "");
  const sep = tekst.split(/\r?\n/)[0].includes(";") ? ";" : ",";
  const rijen = []; let rij = [], veld = "", q = false;
  for (let i = 0; i < tekst.length; i++) {
    const c = tekst[i];
    if (q) { if (c === '"') { if (tekst[i + 1] === '"') { veld += '"'; i++; } else q = false; } else veld += c; }
    else if (c === '"') q = true;
    else if (c === sep) { rij.push(veld); veld = ""; }
    else if (c === "\n") { rij.push(veld.replace(/\r$/, "")); rijen.push(rij); rij = []; veld = ""; }
    else veld += c;
  }
  if (veld || rij.length) { rij.push(veld); rijen.push(rij); }
  const [kop, ...rest] = rijen;
  return rest.filter((r) => r.length > 1).map((r) => Object.fromEntries(kop.map((k, i) => [k.trim(), (r[i] || "").trim()])));
}

function importeer(bestand) {
  const { data, mapping, T } = laad();
  const perSleutel = new Map(M.bronItems(data).map((x) => [x.sleutel, x]));
  const rijen = leesCsv(fs.readFileSync(bestand, "utf8"));
  let n = 0; const fout = [];
  for (const r of rijen) {
    if (!r.sleutel || /overslaan/i.test(r.status)) continue;
    const slugs = (r.themas || "").split(/[,|]/).map((s) => s.trim()).filter(Boolean);
    // leeg en nog "te beoordelen": niet importeren, zodat het item in de volgende review terugkomt
    if (!slugs.length && !/zonder thema/i.test(r.status)) continue;
    const onbekend = slugs.filter((s) => !T.bestaat(s));
    if (onbekend.length) { fout.push(`${r.sleutel}: onbekend thema ${onbekend.join(", ")}`); continue; }
    const x = perSleutel.get(r.sleutel);
    const regel = x ? T.voorstel(x.titel, x.overig, x.dossiers).themas.join(",") : null;
    const handmatig = /zonder thema|beoordeeld/i.test(r.status) || regel !== slugs.join(",");
    mapping[r.sleutel] = { themas: slugs, bron: handmatig ? "review" : "regels" };
    n++;
  }
  if (fout.length) { console.error("Niet geïmporteerd:\n" + fout.join("\n")); process.exitCode = 1; }
  mapping._uitleg = "Goedgekeurde thema's per item; gaat voor de regels in data/themas.json. Sleutels: zaak:<zaaknummer>, stuk:<documentnummer>, debat:<activiteitnummer of samenvatting-id>, agenda:<datum>-<titel>. bron: regels (voorstel ongewijzigd goedgekeurd) of review (aangepast bij de review). themas: [] betekent bewust zonder thema.";
  mapping.bijgewerkt = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  // één item per regel: compact (de site laadt dit bestand) en goed te volgen in git-diffs
  const items = Object.entries(mapping).filter(([k]) => !k.startsWith("_") && k !== "bijgewerkt").sort(([a], [b]) => a.localeCompare(b));
  const regels = [`"_uitleg": ${JSON.stringify(mapping._uitleg)}`, `"bijgewerkt": ${JSON.stringify(mapping.bijgewerkt)}`,
    ...items.map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify({ themas: v.themas, bron: v.bron })}`)];
  fs.writeFileSync(path.join(ROOT, MAP_PAD), "{\n" + regels.map((r) => " " + r).join(",\n") + "\n}\n");
  console.log(`${n} items in ${MAP_PAD}`);
}

if (require.main === module) {
  const a = process.argv.slice(2);
  if (a[0] === "--import") importeer(a[1]);
  else exporteer(a.includes("--nieuw"));
}
module.exports = { exporteer, importeer, leesCsv };
