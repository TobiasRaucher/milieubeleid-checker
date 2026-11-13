/* MilieuRadar: milieu-indicatoren op de Overzicht-pagina.
   - CO2-band: data/milieu/co2.json (dagelijks door pipeline/fetch_milieu.py van NOAA gehaald)
   - Uitstoot in Nederland: rechtstreeks uit de CBS OData API (tabel 85668NED)
   - Planetaire grenzen: data/milieu/planetaire-grenzen.csv (Datahub) + data/planetaire-grenzen.json
   Geen grafiekbibliotheek: lijnen zijn gewone SVG. Teksten uit bronnen gaan via textContent. */
(function () {
  "use strict";
  const NL = (n, max = 1, min = 0) => new Intl.NumberFormat("nl-NL", { maximumFractionDigits: max, minimumFractionDigits: min }).format(n);
  const MAANDEN = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
  const datumNL = (iso) => { const [j, m, d] = iso.split("-").map(Number); return `${d} ${MAANDEN[m - 1]} ${j}`; };
  const MAANDEN_KORT = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  const datumKort = (iso) => { const [j, m, d] = iso.split("-").map(Number); return `${d} ${MAANDEN_KORT[m - 1]} ${j}`; };
  const maandKort = (iso) => MAANDEN_KORT[+iso.slice(5, 7) - 1];
  const SVGNS = "http://www.w3.org/2000/svg";
  const minderBeweging = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- CBS: stoffen in tabel 85668NED ---------- */
  const CBS = "https://opendata.cbs.nl/ODataApi/OData/85668NED";
  const TOTAAL = "T001176"; // Totaal stationaire en mobiele bronnen (sleutel is in de API met spaties opgevuld; daarom startswith)
  const STOFFEN = [
    { code: "A044109", kort: "CO₂", naam: "kooldioxide", deel: 1000, eenheid: "megaton", uitleg: "Het belangrijkste broeikasgas; komt vooral vrij bij het verbranden van fossiele brandstoffen." },
    { code: "A044107", kort: "CH₄", naam: "methaan", deel: 1, eenheid: "kiloton", uitleg: "Een sterk broeikasgas; komt vooral uit de veehouderij, afval en de aardgasketen." },
    { code: "A044111", kort: "NH₃", naam: "ammoniak", deel: 1, eenheid: "kiloton", uitleg: "Komt vooral uit de landbouw (mest) en is de grootste bron van stikstofneerslag op de natuur." },
    { code: "A044112", kort: "NOₓ", naam: "stikstofoxiden", deel: 1, eenheid: "kiloton", uitleg: "Komen vooral uit verkeer, industrie en energieopwekking; dragen bij aan stikstofneerslag en smog." },
    { code: "A051771", kort: "PM₂.₅", naam: "fijnstof", deel: 1, eenheid: "kiloton", uitleg: "Kleine deeltjes die schadelijk zijn voor de gezondheid; onder meer uit verbranding, houtstook en verkeer." },
  ];
  const cbsUrl = () => `${CBS}/TypedDataSet?$filter=${encodeURIComponent(`startswith(Emissiebronnen,'${TOTAAL}') and (${STOFFEN.map((s) => `EmissiesNaarLucht eq '${s.code}'`).join(" or ")})`)}&$select=EmissiesNaarLucht,Perioden,EmissiesNaarLucht_1`;

  /* ---------- laden (één keer per paginabezoek, met opnieuw proberen) ---------- */
  const cache = {};
  async function json(url, opts) {
    const r = await fetch(url, opts);
    if (!r.ok) throw new Error(`${r.status} bij ${url}`);
    return r.json();
  }
  async function tekst(url) {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error(`${r.status} bij ${url}`);
    return r.text();
  }
  const bronnen = {
    co2: () => json("data/milieu/co2.json", { cache: "no-cache" }),
    uitstoot: async () => {
      const [d, perioden] = await Promise.all([json(cbsUrl()), json(`${CBS}/Perioden`)]);
      const status = Object.fromEntries(perioden.value.map((p) => [p.Key, p.Status]));
      const reeks = Object.fromEntries(STOFFEN.map((s) => [s.code, []]));
      for (const r of d.value) {
        if (r.EmissiesNaarLucht_1 == null || !reeks[r.EmissiesNaarLucht]) continue;
        reeks[r.EmissiesNaarLucht].push({ jaar: +r.Perioden.slice(0, 4), waarde: r.EmissiesNaarLucht_1, voorlopig: /voorlopig/i.test(status[r.Perioden] || "") });
      }
      for (const k in reeks) reeks[k].sort((a, b) => a.jaar - b.jaar);
      if (!reeks[STOFFEN[0].code].length) throw new Error("CBS gaf geen cijfers terug");
      return reeks;
    },
    grenzen: async () => {
      const [csv, def] = await Promise.all([tekst("data/milieu/planetaire-grenzen.csv"), json("data/planetaire-grenzen.json", { cache: "no-cache" })]);
      return { rijen: leesCsv(csv), def };
    },
  };
  function haal(naam) {
    if (!cache[naam]) cache[naam] = bronnen[naam]().catch((e) => { delete cache[naam]; throw e; });
    return cache[naam];
  }
  function leesCsv(t) {
    const regels = [];
    let rij = [], veld = "", aanh = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (aanh) { if (c === '"' && t[i + 1] === '"') { veld += '"'; i++; } else if (c === '"') aanh = false; else veld += c; }
      else if (c === '"') aanh = true;
      else if (c === ",") { rij.push(veld); veld = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; rij.push(veld); veld = ""; if (rij.some((x) => x !== "")) regels.push(rij); rij = []; }
      else veld += c;
    }
    if (veld || rij.length) { rij.push(veld); regels.push(rij); }
    const [kop, ...rest] = regels;
    return rest.map((r) => Object.fromEntries(kop.map((k, i) => [k.trim(), (r[i] ?? "").trim()])));
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
  // replaceChildren zet null om in de tekst "null"; dit filtert lege kinderen eruit
  const vervang = (node, ...kids) => node.replaceChildren(...kids.flat().filter((k) => k != null && k !== false));
  function fout(doos, wat, opnieuw) {
    vervang(doos, el("div", { class: "mi-fout" },
      el("p", { text: `${wat} kon niet worden geladen.` }),
      el("button", { type: "button", class: "chip", onclick: opnieuw, text: "Opnieuw proberen" })));
    doos.classList.remove("mi-laadt");
  }

  /* ---------- lijngrafiek met kruisdraad en tooltip ---------- */
  // punten: [{x, y, label, waarde, extra}], x en y numeriek. opts: { hoogte, compact, yNul, xTicks, yFmt }
  function lijnGrafiek(houder, punten, opts) {
    const B = Math.max(260, houder.clientWidth || 600);
    const H = opts.hoogte;
    const m = opts.compact ? { t: 8, r: 8, b: 20, l: 8 } : { t: 14, r: 64, b: 28, l: 46 };
    const xs = punten.map((p) => p.x), ys = punten.map((p) => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    let y0 = opts.yNul ? 0 : Math.min(...ys), y1 = Math.max(...ys);
    const yTicks = opts.compact ? [] : mooieTicks(y0, y1, 4);
    if (!opts.compact) { y0 = Math.min(y0, yTicks[0]); y1 = Math.max(y1, yTicks[yTicks.length - 1]); }
    else { const pad = (y1 - y0) * 0.12 || 1; y0 -= pad; y1 += pad; }
    const X = (v) => m.l + ((v - x0) / (x1 - x0 || 1)) * (B - m.l - m.r);
    const Y = (v) => H - m.b - ((v - y0) / (y1 - y0 || 1)) * (H - m.t - m.b);

    const svg = el("svg:svg", { viewBox: `0 0 ${B} ${H}`, width: B, height: H, class: "mi-svg", role: "img", "aria-label": opts.aria });
    // rasterlijnen en y-as
    for (const t of yTicks) {
      svg.append(el("svg:line", { x1: m.l, x2: B - m.r, y1: Y(t), y2: Y(t), class: "mi-raster" }));
      svg.append(el("svg:text", { x: m.l - 8, y: Y(t), class: "mi-as", "text-anchor": "end", "dominant-baseline": "middle", text: opts.yFmt(t) }));
    }
    if (!opts.compact) svg.append(el("svg:line", { x1: m.l, x2: B - m.r, y1: H - m.b, y2: H - m.b, class: "mi-basis" }));
    // x-labels: een label dat te dicht bij het volgende staat vervalt (het laatste label blijft altijd staan)
    const xt = (opts.xTicks || []).filter((t, i, a) => i === a.length - 1 || X(a[a.length - 1].x) - X(t.x) >= 44);
    for (const t of xt) svg.append(el("svg:text", { x: X(t.x), y: H - 6, class: "mi-as", "text-anchor": t.anker || "middle", text: t.label }));
    // vlak en lijn
    const d = punten.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join("");
    if (!opts.compact) svg.append(el("svg:path", { d: `${d}L${X(x1)},${Y(y0)}L${X(x0)},${Y(y0)}Z`, class: "mi-vlak" }));
    svg.append(el("svg:path", { d, class: "mi-lijn" }));
    // eindpunt met label
    const laatst = punten[punten.length - 1];
    svg.append(el("svg:circle", { cx: X(laatst.x), cy: Y(laatst.y), r: 4.5, class: laatst.voorlopig ? "mi-punt open" : "mi-punt" }));
    if (!opts.compact) svg.append(el("svg:text", { x: X(laatst.x) + 10, y: Y(laatst.y), class: "mi-eind", "dominant-baseline": "middle", text: opts.yFmt(laatst.y) }));
    // kruisdraad
    const draad = el("svg:line", { y1: m.t, y2: H - m.b, class: "mi-draad" });
    const stip = el("svg:circle", { r: 4.5, class: "mi-punt" });
    const laag = el("svg:g", { class: "mi-hover" }, draad, stip);
    svg.append(laag);
    const tip = el("div", { class: "mi-tip", role: "status", "aria-live": "polite" });
    const doos = el("div", { class: "mi-grafiek", tabindex: "0", "aria-label": `${opts.aria}. Gebruik de pijltjestoetsen om de waarden te lezen.` }, svg, tip);

    let actief = -1;
    function toon(i) {
      actief = Math.max(0, Math.min(punten.length - 1, i));
      const p = punten[actief];
      draad.setAttribute("x1", X(p.x)); draad.setAttribute("x2", X(p.x));
      stip.setAttribute("cx", X(p.x)); stip.setAttribute("cy", Y(p.y));
      laag.classList.add("aan");
      vervang(tip, ...[el("b", { text: p.waarde }), el("span", { text: p.label }), p.extra && el("span", { class: "mi-tip-extra", text: p.extra })].filter(Boolean));
      tip.classList.add("aan");
      const px = (X(p.x) / B) * doos.clientWidth;
      const bt = tip.offsetWidth;
      tip.style.left = Math.max(0, Math.min(doos.clientWidth - bt, px - bt / 2)) + "px";
      tip.style.top = Math.max(0, (Y(p.y) / H) * svg.clientHeight - tip.offsetHeight - 12) + "px";
    }
    function verberg() { laag.classList.remove("aan"); tip.classList.remove("aan"); actief = -1; }
    function dichtsbij(ev) {
      const r = svg.getBoundingClientRect();
      const vx = ((ev.clientX - r.left) / r.width) * B;
      let best = 0, bd = Infinity;
      punten.forEach((p, i) => { const dd = Math.abs(X(p.x) - vx); if (dd < bd) { bd = dd; best = i; } });
      return best;
    }
    svg.addEventListener("pointermove", (ev) => toon(dichtsbij(ev)));
    svg.addEventListener("pointerdown", (ev) => toon(dichtsbij(ev)));
    svg.addEventListener("pointerleave", (ev) => { if (ev.pointerType === "mouse") verberg(); }); // bij aanraken blijft de waarde staan
    doos.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") { ev.preventDefault(); toon((actief < 0 ? punten.length : actief) + (ev.key === "ArrowRight" ? 1 : -1)); }
      else if (ev.key === "Home") { ev.preventDefault(); toon(0); }
      else if (ev.key === "End") { ev.preventDefault(); toon(punten.length - 1); }
      else if (ev.key === "Escape") verberg();
    });
    doos.addEventListener("blur", verberg);
    houder.replaceChildren(doos);
  }
  function mooieTicks(a, b, n) {
    const span = b - a || 1;
    const stap0 = span / n, mag = 10 ** Math.floor(Math.log10(stap0));
    const stap = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => span / s <= n) || 10 * mag;
    const t = [];
    for (let v = Math.floor(a / stap) * stap; v <= b + stap * 0.999; v += stap) t.push(+v.toFixed(10));
    return t;
  }

  /* ---------- CO2-band ---------- */
  let _opgeteld = false;
  function vulCo2(doos) {
    haal("co2").then((c) => {
      const l = c.laatste, j = c.jaarGeleden;
      const verschil = j ? l.ppm - j.ppm : null;
      const getal = el("span", { class: "co2-getal", text: NL(l.ppm, 2, 2) });
      vervang(doos, 
        el("div", { class: "co2-tekst" },
          el("div", { class: "co2-label", text: "CO₂ in de atmosfeer" }),
          el("div", { class: "co2-held" }, getal, el("span", { class: "co2-eenheid", text: "ppm" })),
          el("div", { class: "co2-meta" },
            verschil != null ? el("span", { class: "co2-delta", text: `${verschil >= 0 ? "+" : "−"}${NL(Math.abs(verschil), 2, 2)} ppm vergeleken met een jaar eerder` }) : null),
          el("div", { class: "co2-ref small muted" },
            "Voor de industriële revolutie ongeveer 280 ppm; de ", el("a", { href: "#overzicht/planetaire-grenzen", text: "planetaire grens" }), " ligt op 350 ppm.")),
        el("div", { class: "co2-trend" }, el("div", { class: "co2-trend-kop small muted", text: "Afgelopen jaar" }), el("div", { class: "co2-spark" })),
        el("div", { class: "co2-bron" },
          el("span", { class: "small muted" }, "Bron: ", el("a", { href: c.bronUrl, target: "_blank", rel: "noopener", text: "NOAA Global Monitoring Laboratory" }), ". Daggemiddelden verschijnen met een of twee dagen vertraging; recente waarden zijn voorlopig."),
          el("span", { class: "peil", text: `NOAA · Mauna Loa, Hawaii · daggemiddelde ${datumKort(l.datum)}` })));
      doos.classList.remove("mi-laadt");
      const jaarTerug = new Date(Date.parse(l.datum) - 365 * 864e5).toISOString().slice(0, 10);
      const reeks = c.reeks.filter(([d]) => d >= jaarTerug);
      const spark = doos.querySelector(".co2-spark");
      const teken = () => lijnGrafiek(spark, reeks.map(([d, p]) => ({ x: Date.parse(d), y: p, waarde: `${NL(p, 2, 2)} ppm`, label: datumNL(d) })), {
        hoogte: 96, compact: true, aria: `CO₂-concentratie per dag, ${datumNL(reeks[0][0])} tot ${datumNL(l.datum)}`, yFmt: (v) => NL(v, 0),
        xTicks: [{ x: Date.parse(reeks[0][0]), label: maandKort(reeks[0][0]), anker: "start" }, { x: Date.parse(l.datum), label: maandKort(l.datum), anker: "end" }],
      });
      teken(); doos._herteken = teken;
      // getal telt eenmalig op vanaf de waarde van een jaar eerder
      if (!_opgeteld && j && !minderBeweging()) {
        _opgeteld = true;
        const t0 = performance.now(), duur = 900;
        getal.classList.add("telt"); // vaste cijferbreedte tijdens het tellen, zodat het getal niet verspringt
        const stap = (t) => { const f = Math.min(1, (t - t0) / duur), e = 1 - (1 - f) ** 3; getal.textContent = NL(j.ppm + (l.ppm - j.ppm) * e, 2, 2); if (f < 1) requestAnimationFrame(stap); else getal.classList.remove("telt"); };
        requestAnimationFrame(stap);
      }
    }).catch((e) => { console.warn(e); fout(doos, "De CO₂-meting", () => { doos.classList.add("mi-laadt"); vulCo2(doos); }); });
  }

  /* ---------- Uitstoot in Nederland ---------- */
  let _stof = STOFFEN[0].code;
  function vulUitstoot(doos) {
    haal("uitstoot").then((reeks) => {
      const knoppen = el("div", { class: "mi-schakel", role: "group", "aria-label": "Kies een stof" },
        STOFFEN.map((s) => el("button", { type: "button", class: "chip", "aria-pressed": String(s.code === _stof), "data-stof": s.code, title: s.naam,
          onclick: () => { _stof = s.code; teken(); } }, s.kort)));
      const kop = el("div", { class: "mi-stat" });
      const peil = el("span", { class: "peil" });
      const grafiek = el("div", { class: "mi-plek" });
      const uitleg = el("p", { class: "small mi-uitleg" });
      const tabel = el("details", { class: "mi-tabel" });
      vervang(doos,
        el("div", { class: "mi-uitstoot-raster" },
          el("div", { class: "mi-links" }, knoppen, kop, peil, uitleg),
          el("div", { class: "mi-rechts" }, grafiek, tabel)),
        el("p", { class: "small muted mi-bron" }, "Bron: ", el("a", { href: "https://opendata.cbs.nl/statline/#/CBS/nl/dataset/85668NED/table", target: "_blank", rel: "noopener", text: "CBS StatLine, tabel 85668NED" }),
          " (totaal van stationaire en mobiele bronnen). Dit is de feitelijke uitstoot op Nederlands grondgebied. Het doel van de Klimaatwet wordt gemeten met de broeikasgascijfers volgens de IPCC-richtlijnen (alle broeikasgassen samen), die het CBS in een aparte tabel publiceert."));
      doos.classList.remove("mi-laadt");
      function teken() {
        const s = STOFFEN.find((x) => x.code === _stof), r = reeks[s.code];
        knoppen.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.stof === s.code)));
        const fmt = (v) => NL(v / s.deel, v / s.deel < 10 ? 1 : 0);
        const eerste = r[0], laatst = r[r.length - 1];
        const pct = Math.round((100 * (laatst.waarde - eerste.waarde)) / eerste.waarde);
        kop.replaceChildren(
          el("div", { class: "mi-stat-waarde" }, el("b", { text: NL(laatst.waarde / s.deel, laatst.waarde / s.deel < 100 ? 1 : 0) }), ` ${s.eenheid} ${s.kort}`),
          el("div", { class: "small mi-stat-sub" }, `${s.naam} in ${laatst.jaar}${laatst.voorlopig ? " (voorlopig)" : ""} · ${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct)}% ten opzichte van ${eerste.jaar}`));
        peil.textContent = `CBS · tabel 85668NED · ${laatst.jaar}${laatst.voorlopig ? " voorlopig" : ""}`;
        uitleg.textContent = s.uitleg;
        const xt = [1990, 2000, 2010, 2020].filter((j) => j >= eerste.jaar && j < laatst.jaar - 2).map((j) => ({ x: j, label: String(j) }));
        xt.push({ x: laatst.jaar, label: String(laatst.jaar) });
        lijnGrafiek(grafiek, r.map((p) => ({ x: p.jaar, y: p.waarde, voorlopig: p.voorlopig, waarde: `${NL(p.waarde / s.deel, p.waarde / s.deel < 100 ? 1 : 0)} ${s.eenheid}`, label: `${s.kort} in ${p.jaar}`, extra: p.voorlopig ? "voorlopig cijfer" : null })),
          { hoogte: grafiek.clientWidth > 640 ? 320 : 240, yNul: true, aria: `Uitstoot van ${s.naam} (${s.kort}) in Nederland per jaar, ${eerste.jaar} tot ${laatst.jaar}, in ${s.eenheid}`, yFmt: fmt, xTicks: xt });
        tabel.replaceChildren(el("summary", { text: `Toon de cijfers als tabel (${s.kort})` }),
          el("div", { class: "tablewrap" }, el("table", {},
            el("thead", {}, el("tr", {}, el("th", { text: "Jaar" }), el("th", { class: "n", text: `${s.kort} (${s.eenheid})` }))),
            el("tbody", {}, r.slice().reverse().map((p) => el("tr", {}, el("td", { text: p.jaar + (p.voorlopig ? " (voorlopig)" : "") }), el("td", { class: "n", text: NL(p.waarde / s.deel, 1, 1) })))))));
      }
      teken(); doos._herteken = teken;
    }).catch((e) => { console.warn(e); fout(doos, "De uitstoot van het CBS", () => { doos.classList.add("mi-laadt"); vulUitstoot(doos); }); });
  }

  /* ---------- Planetaire grenzen ---------- */
  function vulGrenzen(doos) {
    haal("grenzen").then(({ rijen, def }) => {
      const perId = Object.fromEntries(rijen.map((r) => [r.id, r]));
      const toegepast = [];
      for (const c of def.correcties || []) {
        const r = perId[c.id];
        if (r && c.boundary_value != null && +r.boundary_value !== c.boundary_value) { r.boundary_value = String(c.boundary_value); toegepast.push(c); }
      }
      const over = (r) => (r.boundary_direction === "negative" ? +r.current_value < +r.boundary_value : +r.current_value > +r.boundary_value);
      const groepen = def.grenzen.map((g) => {
        const ind = g.indicatoren.map((i) => ({ ...i, r: perId[i.id] })).filter((i) => i.r);
        return { ...g, ind, over: ind.some((i) => over(i.r)) };
      }).filter((g) => g.ind.length);
      const n = groepen.filter((g) => g.over).length;
      const jaar = Math.max(...rijen.map((r) => +r.current_year || 0));
      const waarde = (v, e) => `${NL(+v, 3)}${!e ? "" : e.startsWith("%") ? e : " " + e}`; // "59%", "30% HANPP", "428,24 ppm"
      // schaal van 0 tot iets voorbij de grootste van stand en grens; de grens is een streep, het gebied voorbij de grens is rood
      const schaal = (r) => {
        const cur = +r.current_value, bnd = +r.boundary_value, neg = r.boundary_direction === "negative";
        const max = Math.max(cur, bnd) * 1.25 || 1;
        const pos = (v) => Math.max(0, Math.min(100, (v / max) * 100));
        const zone = neg ? { left: "0%", width: pos(bnd) + "%" } : { left: pos(bnd) + "%", width: 100 - pos(bnd) + "%" };
        return el("div", { class: "pg-schaal", "aria-hidden": "true" },
          el("span", { class: "spoor" }),
          el("span", { class: "zone", style: `left:${zone.left};width:${zone.width}` }),
          el("span", { class: "grens", style: `left:${pos(bnd)}%` }),
          el("span", { class: "stand", style: `left:${pos(cur)}%` }));
      };
      vervang(doos,
        el("div", { class: "mi-stat" }, el("div", { class: "mi-stat-waarde" }, el("b", { text: `${n} van de ${groepen.length}` }), " grenzen overschreden"),
          el("div", { class: "small mi-stat-sub", text: "Volgens de onderzoekers blijft het aardsysteem binnen deze grenzen stabiel; daarbuiten neemt het risico op grote, onomkeerbare veranderingen toe." })),
        el("span", { class: "peil", text: `Datahub · Planetary Boundaries · stand ${jaar}` }),
        el("ul", { class: "pg-raster" }, groepen.map((g) => el("li", { class: `pg-tegel ${g.over ? "over" : "binnen"}` },
          el("div", { class: "pg-kop" },
            el("div", { class: "pg-naam", text: g.naam }),
            el("span", { class: "pg-status", text: g.over ? "Overschreden" : "Binnen de grens" })),
          el("ul", { class: "pg-ind" }, g.ind.map((i) => el("li", { class: over(i.r) ? "over" : "" },
            el("span", { class: "pg-ind-naam", text: i.naam }),
            el("span", { class: "pg-ind-waarde", "aria-label": `${waarde(i.r.current_value, i.eenheid)}, grens ${i.r.boundary_direction === "negative" ? "minimaal" : "maximaal"} ${waarde(i.r.boundary_value, i.eenheid)}` },
              el("b", { text: waarde(i.r.current_value, i.eenheid) }),
              el("span", { text: `grens ${i.r.boundary_direction === "negative" ? "min." : "max."} ${waarde(i.r.boundary_value, i.eenheid)}` })),
            schaal(i.r))))))),
        toegepast.length ? el("p", { class: "small mi-correctie" }, ...toegepast.flatMap((c) => [el("b", { text: "Correctie: " }), c.toelichting + " Bron: ", el("a", { href: c.url, target: "_blank", rel: "noopener", text: c.bron }), ". "])) : null,
        el("p", { class: "small muted mi-bron" }, "Bron: ", el("a", { href: def.bronUrl, target: "_blank", rel: "noopener", text: "Datahub, Planetary Boundaries" }),
          " (Steffen e.a. 2015, Richardson e.a. 2023). Elke grens heeft een of twee meetwaarden; een grens telt als overschreden als een van die waarden over de grens is."));
      doos.classList.remove("mi-laadt");
      // link "#overzicht/planetaire-grenzen": opnieuw in beeld brengen nu de inhoud erboven is geladen
      if (location.hash === "#overzicht/planetaire-grenzen") requestAnimationFrame(() => doos.parentElement.scrollIntoView({ block: "start" }));
    }).catch((e) => { console.warn(e); fout(doos, "De planetaire grenzen", () => { doos.classList.add("mi-laadt"); vulGrenzen(doos); }); });
  }

  /* ---------- koppeling met app.js ---------- */
  window.MRMilieu = {
    co2Html: () => `<section class="co2-band mi-laadt" id="mi-co2" aria-label="CO₂ in de atmosfeer"><div class="sk co2-sk"></div></section>`,
    sectieHtml: () => `<div class="mi-sectie">
        <section class="card mi-kaart mi-laadt" id="mi-uitstoot" aria-labelledby="mi-uitstoot-kop"><h2 id="mi-uitstoot-kop">Uitstoot naar de lucht in Nederland</h2><div class="mi-inhoud"><div class="sk sk-kaart"></div></div></section>
        <section class="card mi-kaart mi-laadt" id="planetaire-grenzen" aria-labelledby="mi-grenzen-kop"><h2 id="mi-grenzen-kop">Planetaire grenzen</h2><div class="mi-inhoud"><div class="sk sk-kaart"></div></div></section>
      </div>`,
    vul() {
      const c = document.getElementById("mi-co2"); if (c) vulCo2(c);
      const u = document.querySelector("#mi-uitstoot .mi-inhoud"); if (u) { u.parentElement.classList.remove("mi-laadt"); vulUitstoot(u); }
      const g = document.querySelector("#planetaire-grenzen .mi-inhoud"); if (g) { g.parentElement.classList.remove("mi-laadt"); vulGrenzen(g); }
    },
    herteken() {
      for (const d of [document.getElementById("mi-co2"), document.querySelector("#mi-uitstoot .mi-inhoud")]) if (d && d._herteken) d._herteken();
    },
  };
})();
