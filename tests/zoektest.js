/* Testset voor de zoekfunctie: draai met `node tests/zoektest.js`.
   Elke regel: zoekvraag, en een stukje titel dat in de top-N moet staan. Voeg een regel toe zodra een zoekopdracht
   een verkeerd resultaat gaf; zo merken we het als een latere wijziging iets breekt. */
const fs = require("fs"), path = require("path");
const Z = require("../assets/zoek.js");
const lees = (p) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", p), "utf8"));
const D = {
  dossiers: lees("data/dossiers.json"), debatten: lees("data/debatten.json").debatten, zaken: lees("data/tk/zaken.json"),
  stukken: lees("data/tk/stukken.json"), activiteiten: lees("data/tk/activiteiten.json"), agenda: lees("data/agenda.json").items,
};
const z = Z.maak(D, lees("data/zoeksynoniemen.json"));

const TESTS = [
  // [zoekvraag, verwachte titel (deel, kleine letters), top-N]
  ["bonaire", "klimaatzaak bonaire", 2],
  ["klimaatwet bonaire", "klimaatzaak bonaire", 1],
  ["krw", "kaderrichtlijn water", 5],
  ["kaderrichtlijn water", "kaderrichtlijn water", 3],
  ["netcongestie", "elektriciteitsnet & netcongestie", 2],
  ["kernenergie", "kernenergie", 3],
  ["kerncentrale borssele", "borssele", 3],
  ["groen gas", "bijmengverplichting groen gas", 3],
  ["bijmengverplichting", "bijmengverplichting groen gas", 3],
  ["stikstof", "stikstof", 3],
  ["stiksof", "stikstof", 3],
  ["debatten water", "water", 5],
  ["drinkwater pfas", "water", 2],
  ["voortgang klimaatbeleid", "voortgang klimaatbeleid", 2],
  ["energieën", "energie", 10],
  ["co₂-opslag", "co2-opslag", 3],
  ["36169", "klimaatwet", 2],
  ["natura 2000 hollandse kust", "hollandse kust", 3],
  ["\"groen gas\"", "groen gas", 3],
  ["van oosterhout", "van oosterhout", 5],
];
let fout = 0;
for (const [q, verwacht, n] of TESTS) {
  const top = z.zoek(q).resultaten.slice(0, n).map((r) => (r.doc.titel || "").toLowerCase());
  const ok = top.some((t) => t.includes(verwacht));
  if (!ok) fout++;
  console.log(`${ok ? "ok  " : "FOUT"} ${q.padEnd(28)} verwacht "${verwacht}" in top ${n}${ok ? "" : "\n       kreeg: " + top.join(" | ")}`);
}
console.log(`\n${TESTS.length - fout}/${TESTS.length} geslaagd (${z.aantal} documenten in de index)`);
process.exit(fout ? 1 : 0);
