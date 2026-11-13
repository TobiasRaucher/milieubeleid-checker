#!/usr/bin/env node
/* MilieuRadar: schrijft de lijst van thema's met tellingen in het <noscript>-blok van index.html,
   zodat de indeling ook zonder JavaScript leesbaar is. Draait in de Action na fetch_tk.py; los: node pipeline/themas_noscript.js
   Tellingen komen uit dezelfde bron als de pagina Thema's (MRThemas.bronItems + mapping + regels).
   Bekende beperking: zonder JavaScript werken de hash-links (#themas/<slug>) niet, dus de lijst heeft geen links. */
"use strict";
const fs = require("fs");
const path = require("path");
const M = require("../assets/themas.js");

const ROOT = path.join(__dirname, "..");
const lees = (p, fb) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8")); } catch (e) { return fb; } };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const nl = (n) => n.toLocaleString("nl-NL");

const data = {
  zaken: lees("data/tk/zaken.json", []), stukken: lees("data/tk/stukken.json", []), activiteiten: lees("data/tk/activiteiten.json", []),
  debatten: lees("data/debatten.json", { debatten: [] }).debatten, dossiers: lees("data/dossiers.json", { dossiers: [] }), agenda: lees("data/agenda.json", { items: [] }).items,
};
const T = M.maak(lees("data/themas.json", {}), lees("data/themas-mapping.json", {}));
const per = new Map(M.THEMAS.map((t) => [t.slug, []]));
const gezien = new Set();
let zonder = 0;
for (const x of M.bronItems(data)) {
  if (gezien.has(x.sleutel)) continue;
  gezien.add(x.sleutel);
  const th = M.themasVanItem(T, x);
  if (!th.length) zonder++;
  for (const s of th) per.get(s).push(x);
}
const telRegel = (l) => M.SOORTEN.map((s) => { const n = l.filter((x) => x.soort === s.code).length; return n ? `${nl(n)} ${n === 1 ? s.een : s.veel}` : ""; }).filter(Boolean).join(" · ");

const IN = "        ";
const blok = [
  `${IN}<p class="note">milieuradar heeft JavaScript nodig om alle gegevens te tonen. Hieronder de thema's met het aantal items per thema.</p>`,
  `${IN}<h2>Thema's</h2>`,
  `${IN}<ul class="noscript-themas">`,
  ...M.THEMAS.map((t) => { const l = per.get(t.slug); return `${IN}  <li><b>${esc(t.label)}</b>: ${l.length ? `${nl(l.length)} ${l.length === 1 ? "item" : "items"} (${esc(telRegel(l))})` : "nog geen items"}. ${esc(t.description)}</li>`; }),
  `${IN}</ul>`,
  ...(zonder ? [`${IN}<p class="small">${nl(zonder)} ${zonder === 1 ? "item" : "items"} nog niet geclassificeerd.</p>`] : []),
].join("\n");

const pad = path.join(ROOT, "index.html");
const html = fs.readFileSync(pad, "utf8");
const re = /(<!-- themas:begin[^>]*-->)[\s\S]*?(\n[ \t]*<!-- themas:end -->)/;
if (!re.test(html)) { console.error("Markers <!-- themas:begin --> en <!-- themas:end --> niet gevonden in index.html"); process.exit(1); }
const nieuw = html.replace(re, (_, a, b) => `${a}\n${blok}${b}`);
if (nieuw !== html) { fs.writeFileSync(pad, nieuw); console.log("noscript-lijst bijgewerkt"); } else console.log("noscript-lijst ongewijzigd");
