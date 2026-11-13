/* Testset voor de zoekfunctie: draai met `node tests/zoektest.js`.
   Elke regel: zoekvraag, en een stukje titel dat in de top-N moet staan. Voeg een regel toe zodra een zoekopdracht
   een verkeerd resultaat gaf; zo merken we het als een latere wijziging iets breekt. */
const fs = require("fs"), path = require("path");
const Z = require("../assets/zoek.js");
const T = require("../assets/themas.js");
const lees = (p) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", p), "utf8"));
const D = {
  debatten: lees("data/debatten.json").debatten, zaken: lees("data/tk/zaken.json"),
  stukken: lees("data/tk/stukken.json"), activiteiten: lees("data/tk/activiteiten.json"), agenda: lees("data/agenda.json").items, toezeggingen: lees("data/tk/toezeggingen.json"),
  T: T.maak(lees("data/themas.json")),
};
const z = Z.maak(D, lees("data/zoeksynoniemen.json"));

const TESTS = [
  // [zoekvraag, verwachte titel (deel, kleine letters), top-N]
  ["bonaire", "klimaatzaak bonaire", 2],
  ["klimaatwet bonaire", "bonaire", 2],
  ["krw", "kaderrichtlijn water", 5],
  ["kaderrichtlijn water", "kaderrichtlijn water", 3],
  ["netcongestie", "netcongestie", 2],
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
  // samengestelde woorden
  ["depositie", "stikstofdepositie", 5],
  ["wet klimaat", "klimaatwet", 3],
  // partijnamen
  ["partij voor de dieren natuur", "natuur", 5],
  // thema's
  ["adaptatie", "water", 10],
];
// soortwoorden: alle resultaten moeten van die soort zijn
const SOORT_TESTS = [
  ["motie stikstof", (d) => d.soort === "Motie"],
  ["kamerbrief netcongestie", (d) => d.soort === "Kamerbrief"],
  ["commissiedebat water", (d) => /^Commissiedebat/.test(d.soort)],
  ["toezegging drinkwater", (d) => d.soort === "Toezegging"],
  ["kamervragen wolf", (d) => d.soort === "Kamervragen" || d.soort === "Antwoord Kamervragen"],
];
let fout = 0;
for (const [q, verwacht, n] of TESTS) {
  const top = z.zoek(q).resultaten.slice(0, n).map((r) => (r.doc.titel || "").toLowerCase());
  const ok = top.some((t) => t.includes(verwacht));
  if (!ok) fout++;
  console.log(`${ok ? "ok  " : "FOUT"} ${q.padEnd(28)} verwacht "${verwacht}" in top ${n}${ok ? "" : "\n       kreeg: " + top.join(" | ")}`);
}
for (const [q, test] of SOORT_TESTS) {
  const res = z.zoek(q).resultaten;
  const ok = res.length > 0 && res.every((r) => test(r.doc));
  if (!ok) fout++;
  console.log(`${ok ? "ok  " : "FOUT"} ${q.padEnd(28)} alleen de juiste soort (${res.length} resultaten)`);
}
// partij-alias: "groenlinks" moet ook PRO vinden
{
  const res = z.zoek("groenlinks").resultaten;
  const ok = res.some((r) => /\bPRO\b/.test(r.doc.personen || ""));
  if (!ok) fout++;
  console.log(`${ok ? "ok  " : "FOUT"} ${"groenlinks".padEnd(28)} vindt ook PRO`);
}
const totaal = TESTS.length + SOORT_TESTS.length + 1;
console.log(`\n${totaal - fout}/${totaal} geslaagd (${z.aantal} documenten in de index)`);
process.exit(fout ? 1 : 0);
