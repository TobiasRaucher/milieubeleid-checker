#!/usr/bin/env node
/* MilieuRadar: zet achter elk script en stijlbestand in index.html een versie op basis van de inhoud (assets/app.js?v=3f9c1a2b).
   Een gewijzigd bestand krijgt zo een nieuw adres en de browser haalt het meteen op; GitHub Pages laat browsers
   anders tot tien minuten (of langer) de oude versie gebruiken. Draait in de Action; los: node pipeline/versie.js
   Draai het voor elke commit die iets in assets/ wijzigt. Twee keer draaien verandert niets. */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const INDEX = path.join(ROOT, "index.html");
const html = fs.readFileSync(INDEX, "utf8");
const gezien = [];
const nieuw = html.replace(/(\s(?:src|href)=")(assets\/[^"?#]+)(?:\?v=[0-9a-f]*)?(")/g, (heel, voor, bestand, na) => {
  const pad = path.join(ROOT, bestand);
  if (!fs.existsSync(pad)) { console.warn(`Niet gevonden: ${bestand}`); return heel; }
  const v = crypto.createHash("sha1").update(fs.readFileSync(pad)).digest("hex").slice(0, 8);
  gezien.push(`${bestand}?v=${v}`);
  return `${voor}${bestand}?v=${v}${na}`;
});
if (nieuw !== html) { fs.writeFileSync(INDEX, nieuw); console.log("index.html bijgewerkt:\n  " + gezien.join("\n  ")); }
else console.log(`Geen wijzigingen (${gezien.length} bestanden).`);
