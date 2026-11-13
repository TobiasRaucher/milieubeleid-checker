/* MilieuRadar: "Wat Nederland uitstoot" op de Overzicht-pagina.
   Zes weergaven, gegroepeerd naar de wet waarvan het doel getoond wordt:
   - Klimaatwet: totaal broeikasgassen, CO2, CH4, N2O uit CBS-tabel 85669NED (IPCC-richtlijnen, miljard kg CO2-equivalent).
     Het doel (-55% in 2030 t.o.v. 1990) geldt voor alle broeikasgassen samen; daarom staat de doellijn alleen bij het totaal.
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
  const KLIMAATWET = { jaar: 1990, reductie: 0.55 }; // Klimaatwet art. 2: 55% minder in 2030 dan in 1990
  // PBL, Klimaat- en Energieverkenning 2026 (14 september 2026; basispad: vastgesteld en voorgenomen beleid):
  // 46 tot 53% minder broeikasgassen in 2030 dan in 1990; het doel halen is "heel erg onwaarschijnlijk (minder dan 5 procent)".
  // PBL geeft geen jaarcijfers tot 2030 en geen middenwaarde: de band opent vanaf het laatst gemeten jaar naar de bandbreedte
  // in 2030, de gestreepte lijn loopt naar het midden ervan. Percentages gelden t.o.v. het 1990-cijfer van de grafiek (zoals de doellijn).
  // Nieuwe KEV (jaarlijks, september)? Werk dit blok bij.
  const KEV = { editie: "KEV 2026", min: 0.46, max: 0.53, kans: 0.05, kansTekst: "<5%", oordeel: "Heel erg onwaarschijnlijk", datum: "14 sep 2026",
    url: "https://www.pbl.nl/publicaties/klimaat-en-energieverkenning-2026" };
  // Kleur van de kans (stoplicht): rood onder 50%, geel 50 tot 75%, groen boven 75%.
  const kansKlasse = (p) => (p < 0.5 ? "laag" : p <= 0.75 ? "midden" : "hoog");
  // PBL, Emissieramingen luchtverontreinigende stoffen 2025 (vastgesteld en voorgenomen beleid), kiloton in 2030.
  // RIVM, Gevolgen uitspraak Greenpeace voor doelbereik (KN-2025-0026): voor het Wsn-doel 2030 is 36% minder dan die raming nodig.
  const WSN = { reductie: 0.36 };
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
  const STIKSTOF_VOET = "Het kabinet heeft op 3 november 2026 een wetsvoorstel naar de Tweede Kamer gestuurd dat de nationale stikstofdoelen vervangt door sectordoelen voor 2035 (landbouw, industrie, mobiliteit).";

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

  /* ---------- wat een weergave aan doelen en referenties heeft ---------- */
  function kader(v, r) {
    const basis = r[0], laatst = r[r.length - 1];
    if (v.wet === "klimaat") {
      if (v.id !== "totaal") return { basis, laatst, doel: null };
      const b = basis.waarde;
      return { basis, laatst, doel: b * (1 - KLIMAATWET.reductie),
        kev: { laag: b * (1 - KEV.max), hoog: b * (1 - KEV.min), midden: b * (1 - (KEV.min + KEV.max) / 2) } };
    }
    return { basis, laatst, raming: v.raming, doel: v.raming * (1 - WSN.reductie) };
  }

  /* ---------- de grafiek: gemeten lijn (accent) met stille referentielijnen ---------- */
  function grafiek(houder, v, r, eenheid, asTitel) {
    const k = kader(v, r);
    const fmt = (x) => NL(x, 1, 1);
    const B = Math.max(280, houder.clientWidth || 600);
    const smal = B < 560;
    const H = B > 640 ? 384 : 304;
    const m = { t: 32, r: smal ? 64 : 96, b: 48, l: 44 }; // boven: ruimte voor de astitel; onder: jaartallen plus "Jaar"
    const x0 = k.basis.jaar, x1 = 2030;
    const ymax = Math.max(...r.map((p) => p.waarde), k.raming || 0, k.doel || 0);
    const yTicks = mooieTicks(0, ymax, 4);
    const y1 = yTicks[yTicks.length - 1];
    const X = (j) => m.l + ((j - x0) / (x1 - x0)) * (B - m.l - m.r);
    const Y = (w) => H - m.b - (w / y1) * (H - m.t - m.b);
    const rechts = X(x1);

    const aria = `${v.naam} in Nederland per jaar, ${k.basis.jaar} tot ${k.laatst.jaar}, in ${eenheid}.` +
      (k.raming ? ` Raming voor 2030: ${NL(k.raming, 0)}; doel: ${NL(k.doel, 0)}.` : k.doel ? ` Doel voor 2030: ${fmt(k.doel)}.` : "") +
      (k.kev ? ` Raming ${KEV.editie} voor 2030: ${fmt(k.kev.laag)} tot ${fmt(k.kev.hoog)}.` : "");
    const svg = el("svg:svg", { viewBox: `0 0 ${B} ${H}`, width: B, height: H, class: "mi-svg", role: "img", "aria-label": aria });

    // raster en assen
    for (const t of yTicks) {
      svg.append(el("svg:line", { x1: m.l, x2: rechts, y1: Y(t), y2: Y(t), class: t === 0 ? "mi-basis" : "mi-raster" }));
      svg.append(el("svg:text", { x: m.l - 8, y: Y(t), class: "mi-as", "text-anchor": "end", "dominant-baseline": "middle", text: NL(t, 0) }));
    }
    const xt = (smal ? [1990, 2010, 2030] : [1990, 2000, 2010, 2020, 2030]).filter((j) => j >= x0);
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
      if (k.doel != null) {
        svg.append(el("svg:line", { x1: m.l, x2: rechts, y1: Y(k.doel), y2: Y(k.doel), class: "mi-ref doel" }));
        label(Y(k.doel), smal ? "doel" : `doel ${fmt(k.doel)}`, "doel");
      }
      if (k.kev) {
        // KEV-raming: neutrale onzekerheidsband vanaf het laatst gemeten jaar, gestreepte lijn naar het midden
        const lx = X(k.laatst.jaar), ly = Y(k.laatst.waarde);
        svg.append(el("svg:path", { d: `M${lx},${ly}L${rechts},${Y(k.kev.hoog)}L${rechts},${Y(k.kev.laag)}Z`, class: "mi-band" }));
        svg.append(el("svg:path", { d: `M${lx},${ly}L${rechts},${Y(k.kev.midden)}`, class: "mi-raming" }));
        svg.append(el("svg:circle", { cx: rechts, cy: Y(k.kev.midden), r: 4.5, class: "mi-raming-punt" }));
        label(Y(k.kev.midden), smal ? "KEV" : `KEV ${Math.round(KEV.min * 100)}–${Math.round(KEV.max * 100)}%`);
      }
    }

    svg.append(el("svg:path", { d, class: "mi-lijn" }));

    if (v.wet === "stikstof") {
      // raming 2030 (gestreept vanaf het laatste gemeten jaar), het doel als vaste stip, en de kloof ertussen
      const yr = Y(k.raming), yd = Y(k.doel);
      svg.append(el("svg:path", { d: `M${X(k.laatst.jaar)},${Y(k.laatst.waarde)}L${rechts},${yr}`, class: "mi-raming" }));
      svg.append(el("svg:line", { x1: rechts, x2: rechts, y1: yr + 8, y2: yd - 8, class: "mi-kloof" }));
      svg.append(el("svg:circle", { cx: rechts, cy: yr, r: 4.5, class: "mi-raming-punt" }));
      svg.append(el("svg:circle", { cx: rechts, cy: yd, r: 4.5, class: "mi-doel-punt" }));
      svg.append(el("svg:text", { x: rechts - 12, y: (yr + yd) / 2, class: "mi-kloof-label", "text-anchor": "end", "dominant-baseline": "middle",
        text: smal ? `−${Math.round(WSN.reductie * 100)}% nodig` : `−${Math.round(WSN.reductie * 100)}% nodig t.o.v. raming` }));
      label(yr, smal ? "raming" : `raming ${NL(k.raming, 0)}`);
      label(yd, smal ? "doel" : `doel ${NL(k.doel, 0)}`, "doel");
    } else if (k.doel != null) {
      svg.append(el("svg:circle", { cx: rechts, cy: Y(k.doel), r: 4.5, class: "mi-doel-punt" }));
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

  /* ---------- kans op het Klimaatwet-doel (alleen bij het totaal) ---------- */
  // Stoplicht in de stip (kansKlasse); het cijfer en het woord blijven inkt.
  function kansBlok() {
    return el("div", { class: `mi-kans ${kansKlasse(KEV.kans)}` },
      el("p", { class: "mi-kans-kop", text: "Kans dat het doel van 2030 wordt gehaald" }),
      el("p", { class: "mi-kans-regel" },
        el("b", { class: "mi-kans-waarde", text: KEV.kansTekst }),
        el("span", { class: "mi-kans-oordeel" }, el("span", { class: "dot", "aria-hidden": "true" }), KEV.oordeel)),
      el("span", { class: "peil" }, "PBL · ", link(KEV.url, KEV.editie), ` · basispad · ${KEV.datum}`));
  }

  /* ---------- het blok ---------- */
  let _weergave = WEERGAVEN[0].id;
  function vulUitstoot(doos) {
    haal().then((reeks) => {
      const knoppen = el("div", { class: "mi-schakel" },
        WETTEN.map((w) => el("div", { class: "mi-groep", role: "group", "aria-labelledby": `mi-wet-${w.id}` },
          el("span", { class: "mi-groep-kop", id: `mi-wet-${w.id}`, text: w.naam }),
          el("div", { class: "mi-groep-knoppen" },
            WEERGAVEN.filter((v) => v.wet === w.id).map((v) => el("button", { type: "button", class: "chip", "aria-pressed": String(v.id === _weergave), "data-weergave": v.id, title: v.naam,
              onclick: () => { _weergave = v.id; tekenAlles(); } }, v.kort))))));
      const stat = el("div", { class: "mi-stat" });
      const doelTekst = el("div", { class: "mi-doelen" });
      const plek = el("div", { class: "mi-plek" });
      const voet = el("div", { class: "mi-onder" });
      vervang(doos, el("div", { class: "mi-uitstoot-raster" },
        el("div", { class: "mi-links" }, knoppen, stat, doelTekst),
        el("div", { class: "mi-rechts" }, plek, voet)));

      function tekenAlles() {
        const v = WEERGAVEN.find((x) => x.id === _weergave);
        const t = TABELLEN[v.wet], r = reeks[v.code], k = kader(v, r);
        knoppen.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.weergave === v.id)));
        const fmt = (x) => NL(x, 1, 1);
        vervang(stat,
          el("div", { class: "mi-stat-waarde" }, el("b", { text: fmt(k.laatst.waarde) }), t.eenheid),
          el("div", { class: "small mi-stat-sub" },
            `${v.naam} in ${k.laatst.jaar}${k.laatst.voorlopig ? " (voorlopig)" : ""}`,
            v.wet === "klimaat" && el("span", { class: "nw", text: ` · ${teken(pct(k.laatst.waarde, k.basis.waarde))} t.o.v. ${k.basis.jaar}` })));
        if (v.wet === "klimaat") {
          vervang(doelTekst,
            el("p", { class: "mi-doel", text: v.id === "totaal"
              ? "Klimaatwet: −55% in 2030 ten opzichte van 1990."
              : "Klimaatwet: −55% voor alle broeikasgassen samen in 2030." }),
            k.kev && kansBlok());
        } else {
          vervang(doelTekst, el("p", { class: "mi-doel", text:
            `Stikstofwet: in 2030 moet de helft van de stikstofgevoelige natuur onder de kritische depositiewaarde liggen. Volgens het RIVM is daarvoor 36% minder uitstoot nodig dan het PBL voor 2030 raamt: ${NL(k.doel, 0)} in plaats van ${NL(k.raming, 0)} kiloton.` }));
        }
        grafiek(plek, v, r, t.eenheid, t.asTitel);
        vervang(voet,
          v.wet === "stikstof" && el("p", { class: "small mi-voet", text: STIKSTOF_VOET }),
          v.wet === "klimaat"
            ? el("p", { class: "small muted mi-bron" }, "Bron: ", link(BRON[t.tabel], `CBS StatLine, tabel ${t.tabel}`),
              k.kev && "; raming: ", k.kev && link(KEV.url, `PBL, ${KEV.editie}`))
            : el("p", { class: "small muted mi-bron" }, "Bron: ", link(BRON[t.tabel], `CBS StatLine, tabel ${t.tabel}`), "; raming: ", link(BRON.erl, "PBL, ERL 2025"), "; benodigde reductie: ", link(BRON.rivm, "RIVM, 2025")));
      }
      tekenAlles(); doos._herteken = tekenAlles;
    }).catch((e) => { console.warn(e); fout(doos, "De uitstoot van het CBS", () => vulUitstoot(doos)); });
  }

  /* ---------- koppeling met app.js ---------- */
  window.MRMilieu = {
    // een sectie op de pagina zelf, zonder kaart eromheen (zoals Net binnen en Komt eraan)
    sectieHtml: () => `<section class="mi-sectie" id="mi-uitstoot" aria-labelledby="mi-uitstoot-kop"><h2 id="mi-uitstoot-kop">Wat Nederland uitstoot</h2><div class="mi-inhoud"><div class="sk sk-kaart"></div></div></section>`,
    vul() {
      const u = document.querySelector("#mi-uitstoot .mi-inhoud"); if (u) vulUitstoot(u);
    },
    herteken() {
      const u = document.querySelector("#mi-uitstoot .mi-inhoud"); if (u && u._herteken) u._herteken();
    },
  };
})();
