/* MilieuRadar: zoekfunctie.
   Bouwt een zoekindex (MiniSearch) over debatten, dossiers, moties en amendementen, stukken van ministeries en
   Kameractiviteiten. Werkt in de browser (window.MRZoek) en in Node (tests/zoektest.js).

   Wat de zoekfunctie nauwkeurig maakt:
   - normalisatie: kleine letters, geen accenten (energieën = energieen), "co₂" = "co2", "36 169" = "36169", "I&W" = "ienw";
   - Nederlandse stamvorming (Snowball): debatten = debat, maatregelen = maatregel;
   - stopwoorden (de, het, van, ...) tellen niet mee;
   - synoniemen en afkortingen uit data/zoeksynoniemen.json (KRW = Kaderrichtlijn Water);
   - voorvoegsels (stik → stikstof) en kleine tikfouten (stiksof → stikstof);
   - weging: een treffer in de titel telt zwaarder dan in de tekst;
   - "tussen aanhalingstekens" zoekt een exacte woordgroep;
   - samengestelde woorden worden in de index ook gesplitst (klimaatwet → klimaat + wet), zodat "wet" ook "Klimaatwet" vindt;
   - soortwoorden werken als filter: "motie stikstof" toont alleen moties;
   - thema's (data/themas.json) tellen mee, zodat "adaptatie" ook vergaderingen over dat thema vindt;
   - alle woorden moeten voorkomen; levert dat niets op, dan volstaat een deel van de woorden.
*/
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./vendor/minisearch.min.js"));
  else root.MRZoek = factory(root.MiniSearch);
})(typeof self !== "undefined" ? self : this, function (MiniSearch) {
  "use strict";

  /* ---------- normalisatie ---------- */
  function norm(s) {
    return String(s ?? "")
      .normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/i\s*&\s*w/g, "ienw")
      .replace(/\b(\d{2}) (\d{3})\b/g, "$1$2")
      .replace(/[’']/g, "");
  }
  const WOORD = /[a-z0-9]+/g;
  const tokens = (s) => norm(s).match(WOORD) || [];

  const STOP = new Set(("de het een en van in op te voor met over aan bij door dat die dit deze is zijn was wordt worden om of als uit naar tot ook er " +
    "niet geen wel nog maar dan zo al om hun haar hij zij ze we wij u je jij men iets meer hoe wat wie waar wanneer welke heeft hebben had kan kunnen " +
    "moet moeten zal zullen zou zouden nu toe tegen onder per").split(" "));

  /* ---------- Nederlandse stamvorming (Snowball Dutch, met kleine aanvullingen voor -ies/-ieen) ---------- */
  const isV = (c) => "aeiouyè".includes(c);
  function stam(w) {
    if (w.length < 3 || /\d/.test(w)) return w;
    w = w.replace(/ieen$/, "ie").replace(/ies$/, "ie");
    const a = w.split("");
    if (a[0] === "y") a[0] = "Y";
    for (let i = 1; i < a.length; i++) {
      if (a[i] === "y" && isV(a[i - 1])) a[i] = "Y";
      else if (a[i] === "i" && isV(a[i - 1]) && i + 1 < a.length && isV(a[i + 1])) a[i] = "I";
    }
    w = a.join("");
    const regio = (s, van) => { for (let i = van + 1; i < s.length; i++) if (isV(s[i - 1]) && !isV(s[i])) return i + 1; return s.length; };
    const p1 = regio(w, 0);
    const r1 = Math.max(p1, 3), r2 = regio(w, p1);
    const eind = (s) => w.endsWith(s);
    const geldigEn = (p) => p > 0 && !isV(w[p - 1]) && w.slice(p - 3, p) !== "gem";
    const geldigS = (p) => p > 0 && !isV(w[p - 1]) && w[p - 1] !== "j";
    const ontdubbel = () => { if (/(kk|dd|tt)$/.test(w)) w = w.slice(0, -1); };
    let eGevonden = false;
    // stap 1
    if (eind("heden")) { if (w.length - 5 >= r1) w = w.slice(0, -5) + "heid"; }
    else if (eind("ene") || eind("en")) { const p = w.length - (eind("ene") ? 3 : 2); if (p >= r1 && geldigEn(p)) { w = w.slice(0, p); ontdubbel(); } }
    else if (eind("se") || eind("s")) { const p = w.length - (eind("se") ? 2 : 1); if (p >= r1 && geldigS(p)) w = w.slice(0, p); }
    // stap 2
    const stap2 = () => { if (eind("e")) { const p = w.length - 1; if (p >= r1 && !isV(w[p - 1])) { w = w.slice(0, p); eGevonden = true; ontdubbel(); } } };
    stap2();
    // stap 3a
    if (eind("heid")) {
      const p = w.length - 4;
      if (p >= r2 && w[p - 1] !== "c") {
        w = w.slice(0, p);
        if (eind("en")) { const q = w.length - 2; if (q >= r1 && geldigEn(q)) { w = w.slice(0, q); ontdubbel(); } }
      }
    }
    // stap 3b
    if (eind("end") || eind("ing")) {
      const p = w.length - 3;
      if (p >= r2) {
        w = w.slice(0, p);
        if (eind("ig") && w.length - 2 >= r2 && w[w.length - 3] !== "e") w = w.slice(0, -2); else ontdubbel();
      }
    } else if (eind("ig")) { const p = w.length - 2; if (p >= r2 && w[p - 1] !== "e") w = w.slice(0, p); }
    else if (eind("lijk")) { const p = w.length - 4; if (p >= r2) { w = w.slice(0, p); stap2(); } }
    else if (eind("baar")) { const p = w.length - 4; if (p >= r2) w = w.slice(0, p); }
    else if (eind("bar")) { const p = w.length - 3; if (p >= r2 && eGevonden) w = w.slice(0, p); }
    // stap 4: maan -> man
    const n = w.length;
    if (n >= 4) {
      const c = w[n - 4], v1 = w[n - 3], v2 = w[n - 2], d = w[n - 1];
      if (!isV(c) && v1 === v2 && "aeou".includes(v1) && !isV(d) && d !== "I") w = w.slice(0, n - 2) + d;
    }
    return w.replace(/Y/g, "y").replace(/I/g, "i");
  }
  const term = (t) => (STOP.has(t) ? null : stam(t));

  /* ---------- documenten ---------- */
  const SOORT_KORT = { "Brief regering": "Kamerbrief", "Antwoord schriftelijke vragen": "Antwoord Kamervragen", "Antwoord schriftelijke vragen (nader)": "Antwoord Kamervragen" };
  const korteTitel = (z) => { const t = z.onderwerp || z.titel || ""; return /^(nader )?(gewijzigde )?(motie|amendement)\b/i.test(t) ? t.replace(/^.*? over /i, "") : t; };
  const j = (arr) => arr.filter(Boolean).join(" · ");
  const dag = (iso) => (iso ? String(iso).slice(0, 10) : "");

  function bouwDocumenten(D) {
    const docs = [];
    const T = D.T;
    const add = (d) => {
      const doc = { titel: "", kern: "", tekst: "", personen: "", sectoren: [], ...d };
      if (T && !doc.themas) doc.themas = T.voor(doc.titel, doc.themaTekst || [], doc.sectoren);
      if (T) doc.themanamen = (doc.themas || []).map((id) => T.naam(id)).join(" ");
      delete doc.themaTekst;
      docs.push(doc);
    };
    const actPerNr = new Map((D.activiteiten || []).map((a) => [a.Nummer, a]));
    const samengevat = new Set();

    for (const d of D.debatten || []) {
      const s = d.samenvatting || {};
      const a = actPerNr.get(d.activiteit) || {};
      [d.activiteit, ...(d.extraActiviteiten || [])].filter(Boolean).forEach((n) => samengevat.add(n));
      add({
        id: "debat:" + d.id, cat: "debatten", soort: d.type || "Debat", datum: d.datum, sectoren: d.sector ? [d.sector] : [],
        titel: d.titel, kern: j([d.gist, d.aanzet]),
        tekst: j([...(s.partijen || []).map((p) => p.positie), ...(s.kabinet || []), ...(s.toezeggingen || []), ...(s.kern || []), s.moties,
          ...(s.vervolg || []), ...(a.agendapunten || []).map((ap) => ap.onderwerp), d.commissie, a.Voortouwnaam]),
        personen: j([...(s.partijen || []).map((p) => `${p.fractie} ${p.spreker}`), d.bewindspersoon, ...(d.deskundigen || []).map((x) => `${x.naam} ${x.organisatie || ""}`),
          ...(a.bewindspersonen || []).map((b) => b.naam)]),
        link: "#vergaderingen/d-" + d.id, niveau: d.niveau,
        themas: d.themas && d.themas.length ? d.themas : undefined, themaTekst: (a.agendapunten || []).map((ap) => ap.onderwerp),
      });
    }
    const DS = D.dossiers || {};
    for (const d of DS.dossiers || []) {
      add({
        id: "dossier:" + d.id, cat: "dossiers", soort: "Wetsvoorstel", datum: d.laatsteStap?.datum, sectoren: d.sectoren || (d.sector ? [d.sector] : []),
        titel: j([d.titel, d.kortTitel !== d.titel ? d.kortTitel : ""]), kern: d.samenvatting,
        tekst: j([d.thema, d.kamerstuk && "Kamerstuk " + d.kamerstuk, d.laatsteStap?.tekst, d.volgendeStap?.tekst, d.deadline?.tekst, ...(d.kanttekeningen || []), ...(d.zoektermen || [])]),
        link: "#wetgeving/w-" + d.id, prioriteit: d.prioriteit,
      });
    }
    for (const d of DS.beleidsdossiers || []) {
      add({
        id: "thema:" + d.id, cat: "dossiers", soort: "Beleidsdossier", sectoren: d.sectoren || [],
        titel: d.titel, kern: d.omschrijving || "", tekst: j([...(d.zoektermen || []), ...(d.kamerstukken || []).map((k) => "Kamerstuk " + k)]),
        link: "#vergaderingen?dossier=" + encodeURIComponent(d.id),
      });
    }
    const eigenKamerstukken = new Set((DS.dossiers || []).flatMap((d) => [d.kamerstuk, ...(d.kamerstukken || [])]).filter(Boolean).map(String));
    for (const z of D.zaken || []) {
      const isWet = z.soort === "Wetgeving" || z.soort === "Initiatiefwetgeving";
      // wetsvoorstel dat al als eigen dossier wordt gevolgd: niet dubbel tonen
      if (isWet && (z.dossiers || []).some((x) => eigenKamerstukken.has(String(x.nummer)))) continue;
      add({
        id: "zaak:" + z.nummer, cat: isWet ? "dossiers" : "moties", soort: isWet ? "Wetsvoorstel (Kamerdata)" : z.soort, datum: z.stemtelling?.datum || z.gestartOp,
        sectoren: z.sectoren || [], titel: isWet ? (z.titel || z.onderwerp) : korteTitel(z),
        tekst: j([z.onderwerp, z.titel, z.nummer, ...(z.dossiers || []).map((x) => `${x.nummer} ${x.titel || ""}`), z.kabinetsappreciatie]),
        personen: j((z.indieners || []).map((i) => `${i.naam} ${i.fractie || ""}`)),
        link: z.link, extern: true, uitslag: z.uitslag,
      });
    }
    for (const x of D.stukken || []) {
      add({
        id: "stuk:" + x.id, cat: "stukken", soort: SOORT_KORT[x.soort] || x.soort, datum: x.datum, sectoren: x.sectoren || [],
        titel: x.onderwerp || x.titel, tekst: j([x.titel, x.kamerstuk, x.id, ...(x.dossiers || []).map((d) => `${d.nummer} ${d.titel || ""}`), x.ministerie && "ministerie van " + x.ministerie]),
        personen: j([x.ondertekenaar, x.functie]), link: x.link, extern: true, ministerie: x.ministerie,
      });
    }
    for (const a of D.activiteiten || []) {
      if (samengevat.has(a.Nummer) || !["Gepland", "Uitgevoerd"].includes(a.Status)) continue;
      const gepland = a.Status === "Gepland";
      add({
        id: "act:" + a.Nummer, cat: gepland ? "agenda" : "debatten", soort: (a.SoortWeergave || a.Soort) + (gepland ? "" : " (niet samengevat)"),
        datum: dag(a.Datum), sectoren: a.sectoren || [], titel: a.Onderwerp,
        tekst: j([...(a.agendapunten || []).flatMap((ap) => [ap.onderwerp, ...(ap.stukken || []).map((st) => st.onderwerp)]), a.Voortouwnaam, a.Nummer]),
        personen: j((a.bewindspersonen || []).map((b) => b.naam)),
        link: a.tkLink || `https://berthub.eu/tkconv/activiteit.html?nummer=${a.Nummer}`, extern: true,
        themaTekst: (a.agendapunten || []).map((ap) => ap.onderwerp),
      });
    }
    const actSleutels = new Set((D.activiteiten || []).filter((a) => a.Datum).map((a) => dag(a.Datum) + "|" + norm(a.Onderwerp).slice(0, 20)));
    for (const i of D.agenda || []) {
      if (actSleutels.has((i.datum || "") + "|" + norm(i.titel).slice(0, 20))) continue;
      add({
        id: "agenda:" + (i.datum || "") + ":" + (i.titel || "").slice(0, 40), cat: "agenda", soort: i.type || "Agenda", datum: i.datum,
        sectoren: i.sectoren || (i.sector ? [i.sector] : []), titel: i.titel, tekst: i.toelichting || "", link: i.url, extern: !!i.url,
      });
    }
    // dubbele id's (zelfde agendaregel) overslaan
    const gezien = new Set();
    return docs.filter((d) => (gezien.has(d.id) ? false : (gezien.add(d.id), true)));
  }

  const KORT = new Set(["wet", "gas", "net", "zee", "bos", "co2", "ets", "mest", "afval"]);
  const GEEN_STAART = new Set(["heid", "lijk", "baar", "isch", "ende", "atie", "ing", "teit", "ering", "ingen", "elijk"]);
  // soortwoorden in de zoekvraag worden een filter (alleen als er nog andere zoekwoorden over zijn)
  const SOORTWOORDEN = [
    [["motie", "moties"], "moties", (d) => d.soort === "Motie"],
    [["amendement", "amendementen"], "amendementen", (d) => d.soort === "Amendement"],
    [["kamerbrief", "kamerbrieven", "brief", "brieven"], "Kamerbrieven", (d) => d.soort === "Kamerbrief"],
    [["kamervragen", "kamervraag"], "antwoorden op Kamervragen", (d) => d.soort === "Antwoord Kamervragen"],
    [["commissiedebat", "commissiedebatten"], "commissiedebatten", (d) => /^Commissiedebat/.test(d.soort)],
    [["tweeminutendebat", "tweeminutendebatten"], "tweeminutendebatten", (d) => /Tweeminutendebat/.test(d.soort)],
    [["briefing", "briefings"], "technische briefings", (d) => /briefing/i.test(d.soort)],
    [["rondetafelgesprek", "rondetafelgesprekken", "rondetafel"], "rondetafelgesprekken", (d) => /Rondetafel/.test(d.soort)],
    [["debat", "debatten", "vergadering", "vergaderingen"], "vergaderingen", (d) => d.cat === "debatten"],
    [["wetsvoorstel", "wetsvoorstellen"], "wetsvoorstellen", (d) => /^Wetsvoorstel/.test(d.soort)],
    [["agenda"], "agenda", (d) => d.cat === "agenda"],
  ];
  const CAT_GEWICHT = { debatten: 1.25, dossiers: 1.4, moties: 1, stukken: 1, agenda: 1.05 };

  function maak(D, synoniemen) {
    const docs = bouwDocumenten(D);
    const perId = new Map(docs.map((d) => [d.id, d]));
    // woordenschat voor het splitsen van samenstellingen
    const freq = new Map();
    for (const d of docs) for (const t of tokens([d.titel, d.kern, d.tekst].join(" "))) freq.set(t, (freq.get(t) || 0) + 1);
    const _split = new Map();
    function splits(tok) {
      if (tok.length < 6 || /\d/.test(tok)) return [];
      if (_split.has(tok)) return _split.get(tok);
      let uit = [];
      const kopVorm = (kop) => [kop, kop.replace(/s$/, ""), kop.replace(/en$/, ""), kop.replace(/e$/, "")].find((k) => k.length >= 3 && !STOP.has(k) && (freq.get(k) || 0) >= 2);
      // eerst: kop en staart komen allebei als los woord voor (langste staart eerst)
      for (let i = 3; i <= tok.length - 3 && !uit.length; i++) {
        const kop = tok.slice(0, i), staart = tok.slice(i);
        if (!((freq.get(staart) || 0) >= (staart.length >= 6 ? 1 : 2) && (staart.length >= 4 || KORT.has(staart)) && !GEEN_STAART.has(staart))) continue;
        const k = kopVorm(kop);
        if (k) uit = [k, staart];
      }
      // dan: een veelvoorkomende kop met een lange staart die zelf niet los voorkomt (stikstof + depositie)
      for (let i = tok.length - 6; i >= 4 && !uit.length; i--) {
        const kop = tok.slice(0, i), staart = tok.slice(i);
        const k = kopVorm(kop);
        if (k && (freq.get(k) || 0) >= 5 && !GEEN_STAART.has(staart) && !/^s/.test(staart)) uit = [k, staart];
      }
      _split.set(tok, uit);
      return uit;
    }
    const indexTokens = (s) => { const t = tokens(s); return t.concat(t.flatMap(splits)); };
    const ms = new MiniSearch({
      fields: ["titel", "kern", "tekst", "personen", "themanamen"],
      tokenize: (s) => indexTokens(s),
      processTerm: (t) => term(t),
      searchOptions: {
        tokenize: (s) => tokens(s),
        boost: { titel: 4, personen: 2, kern: 1.5, tekst: 1, themanamen: 0.7 },
        prefix: (t) => t.length >= 4,
        fuzzy: (t) => (t.length >= 5 ? 0.2 : false),
        boostDocument: (id) => CAT_GEWICHT[perId.get(id)?.cat] || 1,
      },
    });
    ms.addAll(docs);

    // synoniemgroepen als lijsten van tokenreeksen
    const groepen = ((synoniemen && synoniemen.groepen) || []).map((g) => g.map((v) => tokens(v)).filter((t) => t.length));

    function vindGroep(tk, i) {
      // langste variant die op positie i begint
      let best = null;
      for (const g of groepen) for (const v of g) {
        if (v.length && v.every((t, k) => tk[i + k] === t) && (!best || v.length > best.len)) best = { g, len: v.length };
      }
      return best;
    }

    function zoek(q, opts = {}) {
      const sector = opts.sector || "alle";
      const frasen = [...String(q).matchAll(/"([^"]+)"/g)].map((m) => tokens(m[1]).join(" ")).filter(Boolean);
      let tk = tokens(String(q).replace(/"/g, " "));
      let typeFilter = null, typeTest = null;
      const zonderStop = tk.filter((t) => !STOP.has(t));
      for (const [woorden, label, test] of SOORTWOORDEN) {
        if (zonderStop.some((t) => woorden.includes(t)) && zonderStop.some((t) => !woorden.includes(t))) {
          typeFilter = label; typeTest = test; tk = tk.filter((t) => !woorden.includes(t)); break;
        }
      }
      const delen = [];
      for (let i = 0; i < tk.length;) {
        const gr = vindGroep(tk, i);
        if (gr) {
          delen.push({ combineWith: "OR", queries: gr.g.map((v) => (v.length > 1 ? { combineWith: "AND", queries: v.filter((t) => !STOP.has(t)) } : v[0])) });
          i += gr.len;
        } else {
          if (!STOP.has(tk[i])) delen.push(tk[i]);
          i++;
        }
      }
      if (!delen.length) return { resultaten: [], modus: "AND", frasen, typeFilter, leeg: true };
      const filter = (r) => {
        const d = perId.get(r.id);
        if (sector !== "alle" && !(d.sectoren || []).includes(sector)) return false;
        if (typeTest && !typeTest(d)) return false;
        if (frasen.length) {
          const t = " " + tokens([d.titel, d.kern, d.tekst, d.personen].join(" ")).join(" ") + " ";
          if (!frasen.every((f) => t.includes(" " + f + " "))) return false;
        }
        return true;
      };
      let modus = "AND";
      let res = ms.search({ combineWith: "AND", queries: delen }, { filter });
      if (!res.length && delen.length > 1) { modus = "OR"; res = ms.search({ combineWith: "OR", queries: delen }, { filter }); }
      return {
        modus, frasen, typeFilter,
        resultaten: res.map((r) => ({ doc: perId.get(r.id), score: r.score, termen: new Set(r.terms) })),
      };
    }

    // markeer woorden waarvan de stam een gevonden term is
    function markeer(tekst, termen, esc) {
      const t = String(tekst ?? "");
      let uit = "", last = 0;
      for (const m of t.matchAll(/[\p{L}\p{N}]+/gu)) {
        const w = term(norm(m[0]).replace(/[^a-z0-9]/g, ""));
        uit += esc(t.slice(last, m.index));
        uit += w && termen.has(w) ? `<mark>${esc(m[0])}</mark>` : esc(m[0]);
        last = m.index + m[0].length;
      }
      return uit + esc(t.slice(last));
    }
    // tekstfragment rond de eerste treffer (uit kern, tekst of personen)
    function fragment(doc, termen, esc, lengte = 220) {
      for (const veld of ["kern", "tekst", "personen"]) {
        const t = String(doc[veld] || "");
        for (const m of t.matchAll(/[\p{L}\p{N}]+/gu)) {
          const w = term(norm(m[0]).replace(/[^a-z0-9]/g, ""));
          if (w && termen.has(w)) {
            let a = Math.max(0, m.index - 70), b = Math.min(t.length, a + lengte);
            if (a > 0) a = t.indexOf(" ", a) + 1 || a;
            if (b < t.length) b = t.lastIndexOf(" ", b) > a ? t.lastIndexOf(" ", b) : b;
            return (a > 0 ? "… " : "") + markeer(t.slice(a, b), termen, esc) + (b < t.length ? " …" : "");
          }
        }
      }
      const k = String(doc.kern || "");
      return k ? esc(k.length > lengte ? k.slice(0, lengte).replace(/\s+\S*$/, "") + " …" : k) : "";
    }

    return { zoek, markeer, fragment, aantal: docs.length };
  }

  return { maak, stam, tokens, norm };
});
