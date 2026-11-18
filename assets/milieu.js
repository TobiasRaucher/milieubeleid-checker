/* MilieuRadar: "Wat Nederland uitstoot" op de Overzicht-pagina.
   Zes weergaven, gegroepeerd naar de wet waarvan het doel getoond wordt:
   - Klimaatwet: totaal broeikasgassen, CO2, CH4, N2O uit CBS-tabel 85669NED (IPCC-richtlijnen, miljard kg CO2-equivalent).
     Doelen (2030 -55%, 2040 EU -90%, 2050 klimaatneutraal) gelden voor alle broeikasgassen samen: stippen alleen bij het totaal.
   Bovenaan de keuze van wet en doeljaar; het jaar bepaalt tot waar de x-as loopt. Links onder: doel en kans voor dat jaar.
   - Stikstofwet: NH3 en NOx uit CBS-tabel 85668NED (Nederlands grondgebied, mln kg = kiloton).
     Het doel is relatief aan de raming voor 2030 (PBL, ERL 2025), niet aan 1990.
   De browser haalt beide tabellen rechtstreeks op (OData, CORS toegestaan). Geen grafiekbibliotheek: gewone SVG. */
(function () {
  "use strict";
  const NL = (n, max = 1, min = 0) => new Intl.NumberFormat("nl-NL", { maximumFractionDigits: max, minimumFractionDigits: min }).format(n);
  const SVGNS = "http://www.w3.org/2000/svg";
  const ODATA = "https://opendata.cbs.nl/ODataApi/OData/";

  /* ---------- bronnen en doelen ---------- */
  // Sleutels zijn in de API met spaties opgevuld; daarom startswith(...) in plaats van eq.
  const TABELLEN = {
    klimaat: { tabel: "85669NED", dim: "Klimaatsectoren", totaal: "T001616", veld: "EmissieBroeikasgassen_1", eenheid: "miljard kg CO₂-eq", asTitel: "CO₂-eq (miljard kg)" }, // Totaal klimaatsectoren: incl. landgebruik, excl. bunkers
    stikstof: { tabel: "85668NED", dim: "Emissiebronnen", totaal: "T001176", veld: "EmissiesNaarLucht_1", eenheid: "kiloton", asTitel: "kiloton" }, // Totaal stationaire en mobiele bronnen
  };
  // PBL, Klimaat- en Energieverkenning 2026 (14 september 2026), tabellenbijlage tabel 8b, 12b en 14b: basispad (vastgesteld
  // en voorgenomen beleid), megaton CO2-eq per zichtjaar: [midden, laag, hoog]. PBL legt de nadruk op 2030, 2035 en 2040;
  // de tussenjaren in de bijlage tekenen we bewust niet. Geen aparte raming voor N2O.
  // Nieuwe KEV (jaarlijks, september)? Werk KEV en KEV_RAMING bij.
  const KEV = { editie: "KEV 2026", datum: "14 sep 2026", url: "https://www.pbl.nl/publicaties/klimaat-en-energieverkenning-2026" };
  const KEV_RAMING = {
    T001372: { 2030: [115, 106, 122], 2035: [101, 87.7, 109], 2040: [88.8, 71.4, 96.9] },
    A044109: { 2030: [92, 83.2, 99], 2035: [79.1, 65.9, 87.3], 2040: [67.3, 50.2, 75.5] },
    A044107: { 2030: [16.8, 15.8, 17.1], 2035: [16.1, 15.1, 16.4], 2040: [15.7, 14.7, 16] },
  };
  // PBL, Emissieramingen luchtverontreinigende stoffen 2025 (vastgesteld en voorgenomen beleid), kiloton in 2030 (WEERGAVEN[].raming).
  // RIVM, Gevolgen uitspraak Greenpeace voor doelbereik (KN-2025-0026): voor het Wsn-doel 2030 is 36% minder dan die raming nodig.
  const WSN = { reductie: 0.36 };
  // Doeljaren per wet: een knop per jaar zet de x-as tot dat jaar; links onder de grafiek het doel en de kans voor dat jaar.
  // Kans: alleen een percentage krijgt de stoplichtstip; een oordeel zonder percentage staat met "volgens PBL". Niets bekend: geen kansblok.
  const JAREN = {
    klimaat: [
      { jaar: 2030, doel: "Klimaatwet: −55% in 2030 t.o.v. 1990", reductie: 0.55, kans: { p: 0.05, tekst: "<5%", oordeel: "Heel erg onwaarschijnlijk" } },
      { jaar: 2040, doel: "EU-doel: −90% in 2040 t.o.v. 1990, voor de EU als geheel", reductie: 0.9, eu: true },
      { jaar: 2050, doel: "Klimaatwet: klimaatneutraal in 2050", reductie: 1, oordeel: "niet op koers" },
    ],
    stikstof: [
      { jaar: 2030, doel: "Stikstofwet: in 2030 de helft van de stikstofgevoelige natuur onder de kritische depositiewaarde", oordeel: "ver buiten bereik" },
      { jaar: 2035, doel: "Stikstofwet: in 2035 74% van de stikstofgevoelige natuur onder de kritische depositiewaarde" },
    ],
  };
  // Kleur van de kans (stoplicht): rood onder 50%, oker 50 tot 75%, bosgroen boven 75%.
  const kansKlasse = (p) => (p < 0.5 ? "laag" : p <= 0.75 ? "midden" : "hoog");
  const BRON = {
    "85669NED": "https://opendata.cbs.nl/statline/#/CBS/nl/dataset/85669NED/table",
    "85668NED": "https://opendata.cbs.nl/statline/#/CBS/nl/dataset/85668NED/table",
    erl: "https://www.pbl.nl/publicaties/emissieramingen-luchtverontreinigende-stoffen-2025",
    rivm: "https://www.rivm.nl/publicaties/gevolgen-uitspraak-greenpeace-voor-doelbereik",
  };
  const WEERGAVEN = [
    { id: "totaal", wet: "klimaat", code: "T001372", kort: "Totaal", naam: "Totaal broeikasgassen" },
    { id: "co2", wet: "klimaat", code: "A044109", kort: "CO₂", naam: "Kooldioxide" },
    { id: "ch4", wet: "klimaat", code: "A044107", kort: "CH₄", naam: "Methaan" },
    // CBS noemt dit "Distikstofoxide (N20)" (met een nul); in de site heet het N₂O
    { id: "n2o", wet: "klimaat", code: "A044110", cbsNaam: "Distikstofoxide (N20)", kort: "N₂O", naam: "Lachgas" },
    { id: "nh3", wet: "stikstof", code: "A044111", kort: "NH₃", naam: "Ammoniak", raming: 101 },
    { id: "nox", wet: "stikstof", code: "A044112", kort: "NOₓ", naam: "Stikstofoxiden", raming: 227 },
  ];
  const WETTEN = [{ id: "klimaat", naam: "Klimaatwet" }, { id: "stikstof", naam: "Stikstofwet" }];

  /* ---------- laden (één keer per paginabezoek, met opnieuw proberen) ---------- */
  async function json(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status} bij ${url}`);
    return r.json();
  }
  async function laadTabel(wet) {
    const t = TABELLEN[wet];
    const codes = WEERGAVEN.filter((v) => v.wet === wet).map((v) => v.code);
    const filter = `startswith(${t.dim},'${t.totaal}') and (${codes.map((c) => `startswith(EmissiesNaarLucht,'${c}')`).join(" or ")})`;
    const url = `${ODATA}${t.tabel}/TypedDataSet?$filter=${encodeURIComponent(filter)}&$select=EmissiesNaarLucht,Perioden,${t.veld}`;
    const [d, perioden] = await Promise.all([json(url), json(`${ODATA}${t.tabel}/Perioden`)]);
    const status = Object.fromEntries(perioden.value.map((p) => [p.Key, p.Status]));
    const reeks = Object.fromEntries(codes.map((c) => [c, []]));
    for (const r of d.value) {
      const c = r.EmissiesNaarLucht.trim();
      if (r[t.veld] == null || !reeks[c]) continue;
      reeks[c].push({ jaar: +r.Perioden.slice(0, 4), waarde: r[t.veld], voorlopig: /voorlopig/i.test(status[r.Perioden] || "") });
    }
    for (const c of codes) {
      reeks[c].sort((a, b) => a.jaar - b.jaar);
      if (!reeks[c].length) throw new Error(`CBS ${t.tabel} gaf geen cijfers voor ${c}`);
    }
    return reeks;
  }
  let _data = null;
  function haal() {
    if (!_data) _data = Promise.all([laadTabel("klimaat"), laadTabel("stikstof")]).then(([a, b]) => ({ ...a, ...b })).catch((e) => { _data = null; throw e; });
    return _data;
  }

  /* ---------- kleine DOM-helpers ---------- */
  function el(tag, attrs, ...kids) {
    const e = tag.startsWith("svg:") ? document.createElementNS(SVGNS, tag.slice(4)) : document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.setAttribute("class", v);
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
    return e;
  }
  const vervang = (node, ...kids) => node.replaceChildren(...kids.flat().filter((k) => k != null && k !== false));
  const link = (href, text) => el("a", { href, target: "_blank", rel: "noopener", text });
  function fout(doos, wat, opnieuw) {
    vervang(doos, el("div", { class: "mi-fout" },
      el("p", { text: `${wat} kon niet worden geladen.` }),
      el("button", { type: "button", class: "chip", onclick: opnieuw, text: "Opnieuw proberen" })));
  }
  function mooieTicks(a, b, n) {
    const span = b - a || 1;
    const stap0 = span / n, mag = 10 ** Math.floor(Math.log10(stap0));
    const stap = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => span / s <= n) || 10 * mag;
    const t = [];
    for (let v = Math.floor(a / stap) * stap; v <= b + stap * 0.999; v += stap) t.push(+v.toFixed(10));
    return t;
  }
  const pct = (nu, toen) => Math.round((100 * (nu - toen)) / toen);
  const teken = (p) => `${p > 0 ? "+" : p < 0 ? "−" : ""}${Math.abs(p)}%`;

  /* ---------- wat een weergave aan doelen, ramingen en referenties heeft, tot het gekozen jaar ---------- */
  function kader(v, r, tot) {
    const basis = r[0], laatst = r[r.length - 1];
    if (v.wet === "klimaat") {
      const b = basis.waarde, kev = KEV_RAMING[v.code];
      // ramingspunten tot het gekozen jaar (bij 2050: tot en met 2040, verder raamt het PBL niet)
      const raming = kev ? Object.entries(kev).map(([j, [m, l, h]]) => ({ jaar: +j, midden: m, laag: l, hoog: h })).filter((p) => p.jaar <= tot) : [];
      // doelen gelden alleen voor alle broeikasgassen samen
      const doelen = v.id === "totaal" ? JAREN.klimaat.filter((d) => d.jaar <= tot).map((d) => ({ ...d, waarde: b * (1 - d.reductie) })) : [];
      return { basis, laatst, raming, doelen };
    }
    return { basis, laatst, raming2030: v.raming, doel2030: v.raming * (1 - WSN.reductie) };
  }
  // "46 tot 53% minder" t.o.v. het 1990-cijfer van de grafiek (zoals de doellijn)
  const bandTekst = (b, p) => `${Math.round(100 * (1 - p.hoog / b))} tot ${Math.round(100 * (1 - p.laag / b))}% minder`;

  /* ---------- de grafiek: gemeten lijn (accent) met stille referentielijnen ---------- */
  function grafiek(houder, v, r, eenheid, asTitel, tot) {
    const k = kader(v, r, tot);
    const fmt = (x) => NL(x, 1, 1);
    const B = Math.max(280, houder.clientWidth || 600);
    const smal = B < 560;
    const H = B > 640 ? 384 : 304;
    const m = { t: 32, r: smal ? 64 : 112, b: 48, l: 44 }; // boven: ruimte voor de astitel; onder: jaartallen plus "Jaar"
    const x0 = k.basis.jaar, x1 = tot;
    const ymax = Math.max(...r.map((p) => p.waarde), k.raming2030 || 0, ...(k.raming || []).map((p) => p.hoog));
    const yTicks = mooieTicks(0, ymax, 4);
    const y1 = yTicks[yTicks.length - 1];
    const X = (j) => m.l + ((j - x0) / (x1 - x0)) * (B - m.l - m.r);
    const Y = (w) => H - m.b - (w / y1) * (H - m.t - m.b);
    const rechts = X(x1);

    const laatsteRaming = k.raming && k.raming[k.raming.length - 1];
    const aria = `${v.naam} in Nederland per jaar, ${k.basis.jaar} tot ${k.laatst.jaar}, in ${eenheid}.` +
      (k.raming2030 ? ` Raming voor 2030: ${NL(k.raming2030, 0)}; doel: ${NL(k.doel2030, 0)}.` : "") +
      (k.doelen || []).map((d) => ` ${d.eu ? "EU-doel" : "Doel"} voor ${d.jaar}: ${fmt(d.waarde)}.`).join("") +
      (laatsteRaming ? ` Raming ${KEV.editie} voor ${laatsteRaming.jaar}: ${fmt(laatsteRaming.laag)} tot ${fmt(laatsteRaming.hoog)}.` : "");
    const svg = el("svg:svg", { viewBox: `0 0 ${B} ${H}`, width: B, height: H, class: "mi-svg", role: "img", "aria-label": aria });

    // raster en assen
    for (const t of yTicks) {
      svg.append(el("svg:line", { x1: m.l, x2: rechts, y1: Y(t), y2: Y(t), class: t === 0 ? "mi-basis" : "mi-raster" }));
      svg.append(el("svg:text", { x: m.l - 8, y: Y(t), class: "mi-as", "text-anchor": "end", "dominant-baseline": "middle", text: NL(t, 0) }));
    }
    const stap = smal || x1 - x0 > 50 ? 20 : 10;
    const xt = [];
    for (let j = x0; j < x1 - stap / 3; j += stap) xt.push(j);
    xt.push(x1);
    for (const j of xt) svg.append(el("svg:text", { x: X(j), y: H - m.b + 20, class: "mi-as", "text-anchor": j === x0 ? "start" : j === x1 ? "end" : "middle", text: String(j) }));

    // astitels: eenheid boven de y-as, "Jaar" onder de jaartallen
    svg.append(el("svg:text", { x: 0, y: m.t - 16, class: "mi-astitel", text: asTitel }));
    svg.append(el("svg:text", { x: (m.l + rechts) / 2, y: H - 4, class: "mi-astitel", "text-anchor": "middle", text: "Jaar" }));

    // referentielabels rechts van de grafiek; verzameld en pas aan het eind geplaatst, met minstens 14px tussen twee labels
    const labels = [];
    const label = (y, tekst, cls) => labels.push({ y, tekst, cls });

    // gemeten reeks
    const d = r.map((p, i) => `${i ? "L" : "M"}${X(p.jaar).toFixed(1)},${Y(p.waarde).toFixed(1)}`).join("");
    svg.append(el("svg:path", { d: `${d}L${X(k.laatst.jaar)},${Y(0)}L${X(x0)},${Y(0)}Z`, class: "mi-vlak" }));
    if (v.wet === "klimaat") {
      // basisjaar 1990: haarlijn over de hele breedte
      svg.append(el("svg:line", { x1: m.l, x2: rechts, y1: Y(k.basis.waarde), y2: Y(k.basis.waarde), class: "mi-ref" }));
      svg.append(el("svg:circle", { cx: X(k.basis.jaar), cy: Y(k.basis.waarde), r: 3.5, class: "mi-basis-punt" }));
      label(Y(k.basis.waarde), smal ? "1990" : `1990 ${fmt(k.basis.waarde)}`);
      if (k.raming.length) {
        // KEV-raming: neutrale band door de bandbreedtes van de zichtjaren, gestreepte lijn door het midden
        const lx = X(k.laatst.jaar), ly = Y(k.laatst.waarde);
        const boven = k.raming.map((p) => `L${X(p.jaar).toFixed(1)},${Y(p.hoog).toFixed(1)}`).join("");
        const onder = [...k.raming].reverse().map((p) => `L${X(p.jaar).toFixed(1)},${Y(p.laag).toFixed(1)}`).join("");
        svg.append(el("svg:path", { d: `M${lx},${ly}${boven}${onder}Z`, class: "mi-band" }));
        svg.append(el("svg:path", { d: `M${lx},${ly}${k.raming.map((p) => `L${X(p.jaar).toFixed(1)},${Y(p.midden).toFixed(1)}`).join("")}`, class: "mi-raming" }));
        for (const p of k.raming) svg.append(el("svg:circle", { cx: X(p.jaar), cy: Y(p.midden), r: 3.5, class: "mi-raming-punt" }));
        const lr = k.raming[k.raming.length - 1];
        if (lr.jaar < x1) svg.append(el("svg:line", { x1: X(lr.jaar) + 6, x2: rechts, y1: Y(lr.midden), y2: Y(lr.midden), class: "mi-ref" }));
        label(Y(lr.midden), smal ? "KEV" : `KEV ${bandTekst(k.basis.waarde, lr).replace(" tot ", "–").replace(" minder", "")}`);
      }
      // doelen: een stip op het doeljaar; het EU-doel open (geen Nederlands doel)
      for (const dl of k.doelen) {
        // doel voor het eind van de as: haarlijn naar het label in de marge
        if (dl.jaar < x1) svg.append(el("svg:line", { x1: X(dl.jaar) + 6, x2: rechts, y1: Y(dl.waarde), y2: Y(dl.waarde), class: "mi-ref doel" }));
        svg.append(el("svg:circle", { cx: X(dl.jaar), cy: Y(dl.waarde), r: 4.5, class: dl.eu ? "mi-doel-punt eu" : "mi-doel-punt" }));
        label(Y(dl.waarde), smal ? String(dl.jaar) : dl.reductie === 1 ? `${dl.jaar} neutraal` : `${dl.eu ? "EU " : "doel "}${dl.jaar} ${fmt(dl.waarde)}`, "doel");
      }
    }

    svg.append(el("svg:path", { d, class: "mi-lijn" }));

    if (v.wet === "stikstof") {
      // raming 2030 (gestreept vanaf het laatste gemeten jaar), het doel als vaste stip, en de kloof ertussen
      const x30 = X(2030), yr = Y(k.raming2030), yd = Y(k.doel2030);
      svg.append(el("svg:path", { d: `M${X(k.laatst.jaar)},${Y(k.laatst.waarde)}L${x30},${yr}`, class: "mi-raming" }));
      svg.append(el("svg:line", { x1: x30, x2: x30, y1: yr + 8, y2: yd - 8, class: "mi-kloof" }));
      if (x30 < rechts) { // as loopt verder dan 2030: haarlijnen naar de labels in de marge
        svg.append(el("svg:line", { x1: x30 + 6, x2: rechts, y1: yr, y2: yr, class: "mi-ref" }));
        svg.append(el("svg:line", { x1: x30 + 6, x2: rechts, y1: yd, y2: yd, class: "mi-ref doel" }));
      }
      svg.append(el("svg:circle", { cx: x30, cy: yr, r: 4.5, class: "mi-raming-punt" }));
      svg.append(el("svg:circle", { cx: x30, cy: yd, r: 4.5, class: "mi-doel-punt" }));
      svg.append(el("svg:text", { x: x30 - 12, y: (yr + yd) / 2, class: "mi-kloof-label", "text-anchor": "end", "dominant-baseline": "middle",
        text: smal ? `−${Math.round(WSN.reductie * 100)}% nodig` : `−${Math.round(WSN.reductie * 100)}% nodig t.o.v. raming` }));
      label(yr, smal ? "raming" : `raming ${NL(k.raming2030, 0)}`);
      label(yd, smal ? "doel" : `doel 2030 ${NL(k.doel2030, 0)}`, "doel");
    }

    // labels rechts plaatsen: van boven naar beneden, elk minstens 14px onder het vorige
    labels.sort((a, b) => a.y - b.y);
    labels.forEach((l, i) => { if (i && l.y < labels[i - 1].y + 14) l.y = labels[i - 1].y + 14; });
    for (const l of labels) svg.append(el("svg:text", { x: rechts + 8, y: l.y, class: `mi-reflabel ${l.cls || ""}`, "dominant-baseline": "middle", text: l.tekst }));

    // eindpunt: open als het cijfer voorlopig is
    svg.append(el("svg:circle", { cx: X(k.laatst.jaar), cy: Y(k.laatst.waarde), r: 4.5, class: k.laatst.voorlopig ? "mi-punt open" : "mi-punt" }));
    svg.append(el("svg:text", { x: X(k.laatst.jaar) + 8, y: Y(k.laatst.waarde) - 12, class: "mi-eind", text: fmt(k.laatst.waarde) }));

    // kruisdraad en tooltip (alleen over gemeten jaren)
    const draad = el("svg:line", { y1: m.t, y2: H - m.b, class: "mi-draad" });
    const stip = el("svg:circle", { r: 4.5, class: "mi-punt" });
    const laag = el("svg:g", { class: "mi-hover" }, draad, stip);
    svg.append(laag);
    const tip = el("div", { class: "mi-tip", role: "status", "aria-live": "polite" });
    const doos = el("div", { class: "mi-grafiek", tabindex: "0", "aria-label": `${aria} Gebruik de pijltjestoetsen om de waarden te lezen.` }, svg, tip);

    let actief = -1;
    function toon(i) {
      actief = Math.max(0, Math.min(r.length - 1, i));
      const p = r[actief];
      draad.setAttribute("x1", X(p.jaar)); draad.setAttribute("x2", X(p.jaar));
      stip.setAttribute("cx", X(p.jaar)); stip.setAttribute("cy", Y(p.waarde));
      laag.classList.add("aan");
      vervang(tip, el("b", { text: `${fmt(p.waarde)} ${eenheid}` }), el("span", { text: `${v.kort} in ${p.jaar}` }), p.voorlopig && el("span", { class: "mi-tip-extra", text: "voorlopig cijfer" }));
      tip.classList.add("aan");
      const px = (X(p.jaar) / B) * doos.clientWidth;
      const bt = tip.offsetWidth;
      tip.style.left = Math.max(0, Math.min(doos.clientWidth - bt, px - bt / 2)) + "px";
      tip.style.top = Math.max(0, (Y(p.waarde) / H) * svg.clientHeight - tip.offsetHeight - 12) + "px";
    }
    function verberg() { laag.classList.remove("aan"); tip.classList.remove("aan"); actief = -1; }
    function dichtsbij(ev) {
      const b = svg.getBoundingClientRect();
      const vx = ((ev.clientX - b.left) / b.width) * B;
      let best = 0, bd = Infinity;
      r.forEach((p, i) => { const dd = Math.abs(X(p.jaar) - vx); if (dd < bd) { bd = dd; best = i; } });
      return best;
    }
    svg.addEventListener("pointermove", (ev) => toon(dichtsbij(ev)));
    svg.addEventListener("pointerdown", (ev) => toon(dichtsbij(ev)));
    svg.addEventListener("pointerleave", (ev) => { if (ev.pointerType === "mouse") verberg(); }); // bij aanraken blijft de waarde staan
    doos.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") { ev.preventDefault(); toon((actief < 0 ? r.length : actief) + (ev.key === "ArrowRight" ? 1 : -1)); }
      else if (ev.key === "Home") { ev.preventDefault(); toon(0); }
      else if (ev.key === "End") { ev.preventDefault(); toon(r.length - 1); }
      else if (ev.key === "Escape") verberg();
    });
    doos.addEventListener("blur", verberg);
    houder.replaceChildren(doos);
  }

  /* ---------- links onder: doel en kans voor het gekozen jaar ---------- */
  function doelKans(j, v) {
    let doel = `${j.doel}${v.wet === "klimaat" && v.id !== "totaal" ? ", voor alle broeikasgassen samen" : ""}.`;
    if (v.wet === "stikstof" && j.jaar === 2030) doel += ` Volgens het RIVM is daarvoor ${NL(v.raming * (1 - WSN.reductie), 0)} in plaats van de geraamde ${NL(v.raming, 0)} kiloton ${v.kort} nodig.`;
    const kans = (j.kans || j.oordeel) && el("div", { class: `mi-kans ${j.kans ? kansKlasse(j.kans.p) : ""}` },
      el("p", { class: "mi-kans-kop", text: `Kans dat het doel van ${j.jaar} wordt gehaald` }),
      j.kans
        ? el("p", { class: "mi-kans-regel" }, el("b", { class: "mi-kans-waarde", text: j.kans.tekst }),
          el("span", { class: "mi-kans-oordeel" }, el("span", { class: "dot", "aria-hidden": "true" }), `${j.kans.oordeel}, volgens PBL`))
        : el("p", { class: "mi-kans-oordeel", text: `“${j.oordeel[0].toUpperCase()}${j.oordeel.slice(1)}”, volgens PBL` }));
    return [el("p", { class: "mi-doel", text: doel }), kans];
  }

  /* ---------- het blok ---------- */
  let _weergave = WEERGAVEN[0].id;
  const _jaar = { klimaat: 2030, stikstof: 2030 };
  function vulUitstoot(doos) {
    haal().then((reeks) => {
      const wetten = el("div", { class: "schakelaar mi-wetten", role: "group", "aria-label": "Wet" });
      const jaren = el("div", { class: "schakelaar mi-wetten", role: "group", "aria-label": "Doeljaar" });
      const knoppen = el("div", { class: "mi-groep-knoppen", role: "group", "aria-label": "Stof" });
      const stat = el("div", { class: "mi-stat" });
      const doelTekst = el("div", { class: "mi-doelen" });
      const plek = el("div", { class: "mi-plek" });
      const voet = el("div", { class: "mi-onder" });
      vervang(doos, el("div", { class: "mi-kiezers" }, wetten, jaren), el("div", { class: "mi-uitstoot-raster" },
        el("div", { class: "mi-links" }, knoppen, stat, doelTekst),
        el("div", { class: "mi-rechts" }, plek, voet)));

      function tekenAlles() {
        const v = WEERGAVEN.find((x) => x.id === _weergave);
        const t = TABELLEN[v.wet], r = reeks[v.code], tot = _jaar[v.wet];
        vervang(wetten, WETTEN.map((w) => el("button", { type: "button", "aria-pressed": String(w.id === v.wet), text: w.naam,
          onclick: () => { if (w.id !== v.wet) { _weergave = WEERGAVEN.find((x) => x.wet === w.id).id; tekenAlles(); } } })));
        vervang(jaren, JAREN[v.wet].map((j) => el("button", { type: "button", "aria-pressed": String(j.jaar === tot), text: String(j.jaar),
          "aria-label": `Toon de grafiek tot ${j.jaar}`, onclick: () => { _jaar[v.wet] = j.jaar; tekenAlles(); } })));
        vervang(knoppen, WEERGAVEN.filter((x) => x.wet === v.wet).map((x) => el("button", { type: "button", class: "chip", "aria-pressed": String(x.id === v.id), title: x.naam,
          onclick: () => { _weergave = x.id; tekenAlles(); } }, x.kort)));
        const k = kader(v, r, tot);
        const fmt = (x) => NL(x, 1, 1);
        vervang(stat,
          el("div", { class: "mi-stat-waarde" }, el("b", { text: fmt(k.laatst.waarde) }), t.eenheid),
          el("div", { class: "small mi-stat-sub" },
            `${v.naam} in ${k.laatst.jaar}${k.laatst.voorlopig ? " (voorlopig)" : ""}`,
            v.wet === "klimaat" && el("span", { class: "nw", text: ` · ${teken(pct(k.laatst.waarde, k.basis.waarde))} t.o.v. ${k.basis.jaar}` })));
        vervang(doelTekst, ...doelKans(JAREN[v.wet].find((j) => j.jaar === tot), v));
        grafiek(plek, v, r, t.eenheid, t.asTitel, tot);
        vervang(voet, v.wet === "klimaat"
          ? el("p", { class: "small muted mi-bron" }, "Bron: ", link(BRON[t.tabel], `CBS StatLine, tabel ${t.tabel}`), KEV_RAMING[v.code] && "; raming en kans: ", KEV_RAMING[v.code] && link(KEV.url, `PBL, ${KEV.editie}`))
          : el("p", { class: "small muted mi-bron" }, "Bron: ", link(BRON[t.tabel], `CBS StatLine, tabel ${t.tabel}`), "; raming: ", link(BRON.erl, "PBL, ERL 2025"), "; benodigde reductie: ", link(BRON.rivm, "RIVM, 2025")));
      }
      tekenAlles(); doos._herteken = tekenAlles;
    }).catch((e) => { console.warn(e); fout(doos, "De uitstoot van het CBS", () => vulUitstoot(doos)); });
  }

  /* ---------- koppeling met app.js ---------- */
  window.MRMilieu = {
    // een kop met een kaart eronder, zoals Net binnen en Komt eraan (sinds 16 nov 2026)
    sectieHtml: () => `<section class="mi-sectie" id="mi-uitstoot" aria-labelledby="mi-uitstoot-kop"><h2 id="mi-uitstoot-kop">Hoe staan we er voor?</h2><div class="card mi-inhoud"><div class="sk sk-kaart"></div></div></section>`,
    vul() {
      const u = document.querySelector("#mi-uitstoot .mi-inhoud"); if (u) vulUitstoot(u);
    },
    herteken() {
      const u = document.querySelector("#mi-uitstoot .mi-inhoud"); if (u && u._herteken) u._herteken();
    },
  };
})();
