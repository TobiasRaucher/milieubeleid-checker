// Controleert assets/style.css en de templates op de vaste maten uit DESIGN.md ("Standard sizes").
// Draaien: node tests/ontwerptest.js
const fs = require("fs"), path = require("path");
const lees = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

const RUIMTE = new Set([0, 1, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64]); // 4px-raster; 1 en 2 alleen als bijstelling
// Bestaande uitzonderingen: plaats voor een icoon of uitlijning op een andere rand. Nieuwe alleen na overleg met Tobias.
const UITZONDERING = [/^form\.zoek input$/, /^\.filters select$/, /^\.kopf \.facet > summary$/, /^\.motietabel thead \.schakelaar$/,
  /^ol\.agendapunten$/];
const KLEUR_OK = /^#fff$/; // papier in de documentviewer, tekst op de skiplink

function controleer(css) {
  const fouten = [], groot = new Map(), spatie = new Set();
  css = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
  for (const m of css.matchAll(/([^{};]+)\{([^{}]*)\}/g)) {
    const keuze = m[1].trim();
    if (/^:root/.test(keuze)) continue; // hier staan de tokens zelf
    const regel = css.slice(0, m.index + m[1].length).split("\n").length;
    for (const d of m[2].matchAll(/([\w-]+)\s*:\s*([^;]+)/g)) {
      const [, e, w] = d, meld = (waarom) => fouten.push(`regel ${regel}: ${keuze} { ${e}: ${w.trim()} } ${waarom}`);
      if (/^font(-size)?$/.test(e) && /\d(px|rem|em)\b/.test(w)) meld("gebruik --t-*");
      const t = e === "font-size" && w.match(/--t-(\d+)/);
      if (t && t[1] >= 18) groot.set(keuze, regel);
      if (e === "letter-spacing" && /--sp-/.test(w)) spatie.add(keuze);
      if (e === "letter-spacing" && /--sp-/.test(w) && !new RegExp("--t-" + w.match(/--sp-(\d+)/)[1] + "\\b").test(m[2])) meld("--sp-* hoort bij dezelfde --t-*");
      if (e === "font-weight" && /\b([7-9]00|bold)\b/.test(w)) meld("nooit zwaarder dan 600");
      for (const k of w.replace(/url\([^)]*\)/g, "").match(/#[0-9a-f]{3,8}\b/gi) || []) if (!KLEUR_OK.test(k)) meld("gebruik een kleurtoken");
      if (/radius/.test(e) && (w.match(/[\d.]+px/g) || []).some((p) => parseFloat(p) > 4)) meld("gebruik --r-*");
      if (/^(padding|margin|gap|row-gap|column-gap)/.test(e) && !UITZONDERING.some((r) => r.test(keuze)))
        for (const p of w.match(/[\d.]+px/g) || []) if (!RUIMTE.has(parseFloat(p))) meld("niet op het raster");
    }
  }
  // 18 en groter heeft altijd zijn letterafstand (eenmaal per selector; een kleinere stand in @media hoeft niet opnieuw)
  for (const [keuze, regel] of groot) if (!spatie.has(keuze)) fouten.push(`regel ${regel}: ${keuze} mist letter-spacing: var(--sp-*)`);
  return fouten;
}

// zelftest: elke soort fout wordt gevonden, en goede regels niet
for (const r of ["font-size: 17px", "font-weight: 700", "color: #123456", "border-radius: 9px", "padding: 10px", "font-size: var(--t-18)", "font-size: var(--t-15); letter-spacing: var(--sp-18)"])
  if (controleer(`a { ${r} }`).length !== 1) throw new Error("zelftest mist: " + r);
if (controleer("a { padding: 8px 12px; font-size: var(--t-15); border-radius: 4px }").length) throw new Error("zelftest: valse melding");

const fouten = controleer(lees("assets/style.css"));
for (const f of ["assets/app.js", "assets/milieu.js", "assets/zoek.js", "assets/themas.js", "index.html"])
  for (const m of lees(f).matchAll(/style="(?!--)[^"]*"/g)) fouten.push(`${f}: ${m[0]} (geen inline style)`);
fouten.forEach((f) => console.log("FOUT", f));
console.log(fouten.length ? `${fouten.length} afwijking(en) van DESIGN.md` : "ontwerp: alles volgens DESIGN.md");
process.exit(fouten.length ? 1 : 0);
