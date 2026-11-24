/* Testset voor de zoekfunctie: draai met `node tests/zoektest.js`.
   Elke regel: zoekvraag, en een stukje titel dat in de top-N moet staan. Voeg een regel toe zodra een zoekopdracht
   een verkeerd resultaat gaf; zo merken we het als een latere wijziging iets breekt. */
const fs = require("fs"), path = require("path");
const Z = require("../assets/zoek.js");
const T = require("../assets/themas.js");
const lees = (p) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", p), "utf8"));
const D = {
  debatten: lees("data/debatten.json").debatten, zaken: lees("data/tk/zaken.json"),
  stukken: lees("data/tk/stukken.json"), verzoeken: lees("data/tk/verzoeken.json"), activiteiten: lees("data/tk/activiteiten.json"), agenda: lees("data/agenda.json").items, toezeggingen: lees("data/tk/toezeggingen.json"),
  kerndocumenten: lees("data/kerndocumenten.json"), begrotingen: lees("data/tk/begrotingen.json"), rapporten: lees("data/rapporten.json"), teksten: lees("data/tk/teksten.json"),
  T: T.maak(lees("data/themas.json")),
};
const z = Z.maak(D, lees("data/zoeksynoniemen.json"));

const TESTS = [
  // [zoekvraag, verwachte titel (deel, kleine letters), top-N]
  ["bonaire", "klimaatzaak bonaire", 2],
  // kerndocumenten
  ["kev", "klimaat- en energieverkenning", 3],
  // rapporten (bijlagen bij Kamerbrieven, data/rapporten.json)
  ["ibo woningvoorraad", "eindrapport ibo energietransitie", 3],
  ["rli zorg voor water", "zorg voor water", 3],
  ["rapport milieudelicten", "strafrechtelijke sancties", 3],
  ["miljoenennota", "miljoenennota", 2],
  ["coalitieakkoord", "coalitieakkoord", 3],
  ["begroting landbouw", "begroting landbouw", 3],
  ["klimaat- en energiefonds", "klimaat- en energiefonds", 3],
  ["belastingplan 2027", "belastingplan 2027", 2],
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
  // de technische briefing "Natura 2000-gebied Hollandse kust" is op 17 nov 2026 geannuleerd (en dus niet meer in de index)
  ["vogelrichtlijn hollandse kust", "hollandse kust", 3],
  // alleen in de tekst van de motie: "Natura 2000" staat niet in het onderwerp
  ["natura 2000 hollandse kust", "hollandse kust", 3],
  ["\"groen gas\"", "groen gas", 3],
  ["van oosterhout", "van oosterhout", 5],
  // samengestelde woorden
  ["depositie", "stikstofdepositie", 5],
  ["wet klimaat", "klimaatwet", 3],
  // partijnamen
  ["partij voor de dieren natuur", "natuur", 5],
  // commissieverzoeken (in de tabel Kamervragen)
  ["pan nederland natuurherstelverordening", "pan nederland", 3],
  ["greenpeace vonnis klimaatzaak bonaire", "vonnis klimaatzaak bonaire", 3],
  // Financiën (sector financien, 24 nov 2026)
  ["ekv", "exportkrediet", 3],
  ["csrd", "duurzaamheidsrapportering", 5],
  // thema's
  ["adaptatie", "water", 12], // 12 sinds de commissieverzoeken (24 nov 2026): twee verzoeken over adaptatie staan terecht hoger
];
// soortwoorden: alle resultaten moeten van die soort zijn
const SOORT_TESTS = [
  ["motie stikstof", (d) => d.soort === "Motie"],
  ["commissieverzoek schiphol", (d) => d.soort === "Commissieverzoek"],
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
// tikfoutcorrectie alleen als er niets anders is: "kernenergie" mag geen kolencentrales opleveren
{
  const res = z.zoek("kernenergie").resultaten;
  const ok = res.length > 0 && res.every((r) => !r.zwak) && !res.some((r) => [...r.termen].every((t) => t.startsWith("kolencentral")));
  if (!ok) fout++;
  console.log(`${ok ? "ok  " : "FOUT"} ${"kernenergie".padEnd(28)} geen treffers alleen via tikfoutcorrectie`);
}
// namen en fracties in de zoekvraag worden een keuze "Alleen ..."; GroenLinks telt als PRO
const extra = [
  ["pvv stikstof herkent PVV", () => z.zoek("pvv stikstof").wieOpties[0]?.k === "f:pvv"],
  ["groenlinks herkent PRO", () => z.zoek("groenlinks wind").wieOpties.some((w) => w.k === "f:pro")],
  ["van oosterhout herkend", () => z.zoek("van oosterhout kernenergie").wieOpties.some((w) => w.k === "p:van oosterhout")],
  ["oosterhout zonder tussenvoegsel", () => z.zoek("oosterhout").wieOpties.some((w) => w.k === "p:van oosterhout")],
  ["Alleen PVV filtert", () => { const r = z.zoek("pvv stikstof", { wie: "f:pvv" }).resultaten; return r.length > 0 && r.every((x) => x.doc.wie.includes("f:pvv")); }],
  ["alleen een naam: alles van die fractie", () => z.zoek("pvv", { wie: "f:pvv" }).resultaten.length > 20],
  // "Bedoelde je ...?"
  ["kernenrgie -> kernenergie", () => z.suggesties("kernenrgie zeehondjes").some((x) => x.soort === "spelling" && x.q.startsWith("kernenergie"))],
  ["woorden los als niets samen", () => z.suggesties("stikstof xqzwv").length === 0 || z.suggesties("stikstof xqzwv").some((x) => x.q === "stikstof")],
  ["energieverkenning geen energierekening", () => { const r = z.zoek("klimaat- en energieverkenning").resultaten; return r.length > 0 && !r.some((x) => /energierekening/i.test(x.doc.titel)); }],
  ["tikfout in één woord blijft werken", () => z.zoek("stiksof water").resultaten.length > 0],
  // synoniemen tellen één keer: een stuk met kernenergie in de titel staat in de top 10
  ["kernenergie: titeltreffers bovenaan", () => z.zoek("kernenergie").resultaten.slice(0, 10).filter((r) => r.inTitel).length >= 8],
];
for (const [naam, f] of extra) {
  const ok = !!f();
  if (!ok) fout++;
  console.log(`${ok ? "ok  " : "FOUT"} ${naam}`);
}
const totaal = TESTS.length + SOORT_TESTS.length + 2 + extra.length;
console.log(`\n${totaal - fout}/${totaal} geslaagd (${z.aantal} documenten in de index)`);
process.exit(fout ? 1 : 0);
