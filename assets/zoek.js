/* MilieuRadar: zoekfunctie.
   Bouwt een zoekindex (MiniSearch) over samenvattingen, wetsvoorstellen, moties en amendementen, stukken van ministeries en
   Kameractiviteiten, toezeggingen, de agenda en de kerndocumenten. Werkt in de browser (window.MRZoek) en in Node (tests/zoektest.js).

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
  if (typeof module === "object" && module.exports) module.exports = factory(require("./vendor/minisearch.min.js"), require("./themas.js"));
  else root.MRZoek = factory(root.MiniSearch, root.MRThemas);
})(typeof self !== "undefined" ? self : this, function (MiniSearch, MRThemas) {
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
  const SOORT_KORT = { "Brief regering": "Kamerbrief", "Schriftelijke vragen": "Kamervragen", "Antwoord schriftelijke vragen": "Antwoord Kamervragen", "Antwoord schriftelijke vragen (nader)": "Antwoord Kamervragen" };
  const korteTitel = (z) => { const t = z.onderwerp || z.titel || ""; return /^(nader )?(gewijzigde? )?(motie|amendement)\b/i.test(t) ? t.replace(/^.*? over /i, "").replace(/^over /i, "").trim() : t; };
  // ontdubbeld samenvoegen: agendapunten en hun stukken hebben vaak dezelfde tekst; dubbel indexeren telde dubbel mee
  const j = (arr) => [...new Set(arr.filter(Boolean).map((x) => String(x).trim()))].join(" · ");
  const zonderVoorletters = (naam) => String(naam || "").replace(/^(?:(?:[A-Z][a-z]{0,2}|IJ)\.\s*)+/, "").trim();
  const hoofdletter = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  const dossierTekst = (ds) => j((ds || []).map((x) => `${x.nummer} ${x.titel || ""}`));
  const dossierLabel = (ds) => (ds || []).map((x) => `${x.nummer}${x.toevoeging ? "-" + x.toevoeging : ""}`).join(", ");
  // wie: personen (achternaam met tussenvoegsel) en fracties die bij een item horen, als sleutels "p:<naam>" en "f:<fractie>"
  const pSleutel = (naam) => "p:" + tokens(zonderVoorletters(naam)).join(" ");
  // GroenLinks-PvdA (en de oude losse namen) telt als PRO, net als in het Indiener-filter van de motietabel
  const FRACTIE_ALIAS = { "groenlinks-pvda": "PRO", groenlinks: "PRO", pvda: "PRO", "gl-pvda": "PRO" };
  const fractie = (fr) => FRACTIE_ALIAS[norm(fr).trim()] || fr;
  const fSleutel = (fr) => "f:" + norm(fractie(fr)).trim();
  // namen voor de chip "Alleen ...": sleutel -> {label, fractie, n}; wordt per index opnieuw gevuld
  let WIE = new Map();
  function wieVan(personen, fracties) {
    const uit = new Set();
    personen.forEach((n, i) => {
      if (!n || !tokens(zonderVoorletters(n)).length) return;
      const k = pSleutel(n), oud = WIE.get(k), achter = zonderVoorletters(n);
      WIE.set(k, { label: (achter.charAt(0).toUpperCase() + achter.slice(1)).replace(/[()]/g, ""), fractie: fracties[i] ? fractie(fracties[i]) : oud?.fractie || "", n: (oud?.n || 0) + 1 });
      uit.add(k);
    });
    for (const f of fracties) if (f) { const k = fSleutel(f), oud = WIE.get(k); WIE.set(k, { label: fractie(f), fractie: "", n: (oud?.n || 0) + 1 }); uit.add(k); }
    return [...uit];
  }
  const dag = (iso) => (iso ? String(iso).slice(0, 10) : "");

  function bouwDocumenten(D) {
    WIE = new Map();
    const docs = [];
    const T = D.T;
    const add = (d) => {
      const doc = { titel: "", kern: "", tekst: "", dossier: "", personen: "", sectoren: [], wie: [], ...d };
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
        wie: wieVan([...(s.partijen || []).map((p) => p.spreker), d.bewindspersoon, ...(a.bewindspersonen || []).map((b) => b.naam)], (s.partijen || []).map((p) => p.fractie)),
        link: "#agenda/d-" + d.id, niveau: d.niveau,
        themas: d.themas && d.themas.length ? d.themas : undefined, themaTekst: (a.agendapunten || []).map((ap) => ap.onderwerp),
      });
    }
    for (const z of D.zaken || []) {
      const isWet = z.soort === "Wetgeving" || z.soort === "Initiatiefwetgeving";
      add({
        id: "zaak:" + z.nummer, cat: isWet ? "wetgeving" : "moties", soort: isWet ? "Wetsvoorstel" : z.soort, datum: z.stemtelling?.datum || z.gestartOp,
        sectoren: z.sectoren || [], titel: isWet ? (z.titel || z.onderwerp) : korteTitel(z),
        // de titel van het Kamerstukdossier in een eigen, licht wegend veld: een motie bij de begroting gaat niet over alles in de begroting
        tekst: j([z.onderwerp, z.nummer, z.kabinetsappreciatie, isWet ? z.citeertitel : ""]),
        dossier: dossierTekst(z.dossiers) + (z.titel && !(z.dossiers || []).some((x) => x.titel === z.titel) && !isWet ? " · " + z.titel : ""),
        personen: j((z.indieners || []).map((i) => `${i.naam} ${i.fractie || ""}`)),
        wie: wieVan((z.indieners || []).map((i) => i.naam), (z.indieners || []).map((i) => i.fractie)),
        indiener: (() => { const i = (z.indieners || []).find((x) => /^indiener|eerste/i.test(x.relatie || "")) || (z.indieners || [])[0]; return i ? `${hoofdletter(zonderVoorletters(i.naam))}${i.fractie ? ` (${i.fractie})` : ""}${z.indieners.length > 1 ? " c.s." : ""}` : ""; })(),
        kamerstuk: dossierLabel(z.dossiers), nummer: z.nummer,
        link: MRThemas.tkUrl(z), extern: true, uitslag: z.uitslag,
      });
    }
    for (const x of D.stukken || []) {
      add({
        id: "stuk:" + x.id, cat: "stukken", soort: SOORT_KORT[x.soort] || x.soort, datum: x.datum, sectoren: x.sectoren || [],
        titel: x.onderwerp || x.titel, tekst: j([x.titel !== (x.onderwerp || x.titel) ? x.titel : "", x.kamerstuk, x.id, x.ministerie && "ministerie van " + x.ministerie]),
        dossier: dossierTekst(x.dossiers),
        personen: j([x.ondertekenaar, x.functie, ...(x.indieners || []).map((i) => `${i.naam} ${i.fractie || ""}`)]), link: x.link, extern: true, ministerie: x.ministerie,
        wie: wieVan([...(x.indieners || []).map((i) => i.naam), x.ondertekenaar], (x.indieners || []).map((i) => i.fractie)), zaak: x.zaak,
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
        wie: wieVan((a.bewindspersonen || []).map((b) => b.naam), []),
        link: "#agenda/a-" + a.Nummer,
        themaTekst: (a.agendapunten || []).map((ap) => ap.onderwerp),
      });
    }
    for (const t of D.toezeggingen || []) {
      add({
        id: "tz:" + t.nummer, cat: "toezeggingen", soort: "Toezegging", datum: t.datum, titel: t.tekst,
        tekst: j([t.ministerie && "ministerie van " + t.ministerie, t.status]), personen: j([t.bewindspersoon, t.functie]), wie: wieVan([t.bewindspersoon], []),
        link: t.activiteit ? "#agenda/a-" + t.activiteit : "#agenda?terugblik=1", status: t.status, themaTekst: [],
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
    // kerndocumenten (alle edities; begrotingsstukken uit de Kamerdata inbegrepen)
    {
      for (const k of MRThemas.kerndocumenten(D.kerndocumenten, D.begrotingen)) {
        add({
          id: "kerndoc:" + k.id, cat: "kerndocumenten", soort: k.soort || "Kerndocument", datum: k.datum, titel: k.titel,
          tekst: j([k.afkorting, k.kenmerk, k.document, k.uitgever, k.documentSoort]), personen: "",
          link: k.url, extern: true, themas: k.themas && k.themas.length ? k.themas : undefined,
        });
      }
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
    [["kamervragen", "kamervraag", "vragen"], "Kamervragen en antwoorden", (d) => d.soort === "Kamervragen" || d.soort === "Antwoord Kamervragen"],
    [["antwoord", "antwoorden"], "antwoorden op Kamervragen", (d) => d.soort === "Antwoord Kamervragen"],
    [["commissiedebat", "commissiedebatten"], "commissiedebatten", (d) => /^Commissiedebat/.test(d.soort)],
    [["tweeminutendebat", "tweeminutendebatten"], "tweeminutendebatten", (d) => /Tweeminutendebat/.test(d.soort)],
    [["briefing", "briefings"], "technische briefings", (d) => /briefing/i.test(d.soort)],
    [["rondetafelgesprek", "rondetafelgesprekken", "rondetafel"], "rondetafelgesprekken", (d) => /Rondetafel/.test(d.soort)],
    [["debat", "debatten", "vergadering", "vergaderingen"], "vergaderingen", (d) => d.cat === "debatten"],
    [["wetsvoorstel", "wetsvoorstellen"], "wetsvoorstellen", (d) => /^Wetsvoorstel/.test(d.soort)],
    [["agenda"], "agenda", (d) => d.cat === "agenda"],
    [["toezegging", "toezeggingen"], "toezeggingen", (d) => d.cat === "toezeggingen"],
    [["kerndocument", "kerndocumenten"], "kerndocumenten", (d) => d.cat === "kerndocumenten"],
  ];
  const CAT_GEWICHT = { debatten: 1.25, wetgeving: 1.4, moties: 1, stukken: 1, agenda: 1.05, toezeggingen: 1, kerndocumenten: 1.3 };

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
      fields: ["titel", "kern", "tekst", "dossier", "personen", "themanamen"],
      tokenize: (s) => indexTokens(s),
      processTerm: (t) => term(t),
      searchOptions: {
        tokenize: (s) => tokens(s),
        boost: { titel: 4, personen: 2, kern: 1.5, tekst: 1, dossier: 0.3, themanamen: 0.7 },
        prefix: (t) => t.length >= 4,
        fuzzy: (t) => (t.length >= 5 ? 0.2 : false),
        // afgeleide woorden (kernenergie -> kernenergiewet, tikfouten) tellen minder dan het woord zelf
        weights: { fuzzy: 0.35, prefix: 0.3 },
        boostDocument: (id) => CAT_GEWICHT[perId.get(id)?.cat] || 1,
      },
    });
    ms.addAll(docs);
    const wieMap = WIE;

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

    // namen in de zoekvraag: achternamen (met of zonder tussenvoegsel) en fracties met hun synoniemen (groenlinks -> PRO)
    const TUSSEN = new Set(["van", "der", "den", "de", "het", "ter", "ten", "te", "in", "t", "op"]);
    const wieVarianten = [];
    for (const [k, v] of wieMap) {
      if (k.startsWith("p:")) {
        const t = k.slice(2).split(" ");
        if (t.join("").length >= 3) wieVarianten.push({ k, toks: t });
        let i = 0; while (i < t.length - 1 && TUSSEN.has(t[i])) i++;
        if (i > 0 && t.slice(i).join("").length >= 5) wieVarianten.push({ k, toks: t.slice(i) });
      } else {
        const t = tokens(v.label);
        wieVarianten.push({ k, toks: t });
        for (const g of groepen) if (g.some((x) => x.join(" ") === t.join(" "))) for (const x of g) wieVarianten.push({ k, toks: x });
      }
    }
    function vindWie(tk) {
      const uit = new Map();
      for (const { k, toks } of wieVarianten) {
        for (let i = 0; i + toks.length <= tk.length; i++) {
          if (toks.every((t, n) => tk[i + n] === t)) {
            const o = uit.get(k);
            if (!o || toks.length > o.len) uit.set(k, { k, start: i, len: toks.length, ...wieMap.get(k) });
          }
        }
      }
      // fracties eerst, dan wie het vaakst voorkomt
      return [...uit.values()].sort((a, b) => (a.k[0] === "f" ? -1 : 0) - (b.k[0] === "f" ? -1 : 0) || b.n - a.n);
    }

    // één deel van de vraag: een woord, of een synoniemgroep. Binnen een groep telt de beste variant, niet de som
    // (anders scoorde een stuk dat kerncentrale, kernenergie en nucleair noemt drie keer).
    function zoekDeel(deel, filter) {
      const varianten = typeof deel === "string" ? [deel] : deel.queries;
      // direct: elk woord van de variant komt (op voor- of achtervoegsel na) zelf voor, niet alleen via tikfoutcorrectie
      const past = (q, m) => q && (m.startsWith(q) || q.startsWith(m));
      const woorden = (v) => (typeof v === "string" ? [term(v)] : (v.queries || []).flatMap(woorden));
      const uit = new Map();
      for (const v of varianten) {
        const vw = woorden(v).filter(Boolean);
        for (const r of ms.search(v, { filter })) {
          const velden = Object.values(r.match).flat();
          const o = uit.get(r.id);
          const d = vw.every((q) => r.terms.some((m) => past(q, m)));
          if (!o) uit.set(r.id, { score: r.score, terms: new Set(r.terms), velden: new Set(velden), direct: d });
          else { o.score = Math.max(o.score, r.score); r.terms.forEach((t) => o.terms.add(t)); velden.forEach((x) => o.velden.add(x)); o.direct = o.direct || d; }
        }
      }
      return uit;
    }
    function combineer(delen, filter, modus) {
      const maps = delen.map((d) => zoekDeel(d, filter));
      const ids = modus === "AND" ? [...maps[0].keys()].filter((id) => maps.every((m) => m.has(id))) : [...new Set(maps.flatMap((m) => [...m.keys()]))];
      return ids.map((id) => {
        let score = 0, n = 0, zwak = false; const terms = new Set(), velden = new Set();
        for (const m of maps) { const o = m.get(id); if (!o) continue; n++; score += o.score; zwak = zwak || !o.direct; o.terms.forEach((t) => terms.add(t)); o.velden.forEach((v) => velden.add(v)); }
        return { id, score: modus === "OR" ? score * n : score, terms: [...terms], velden, zwak };
      }).sort((a, b) => b.score - a.score);
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
      // namen: als keuze aangeboden; gekozen (opts.wie) worden ze een filter en geen zoekwoord meer
      const wieOpties = vindWie(tk);
      const wie = opts.wie ? wieOpties.find((w) => w.k === opts.wie) || null : null;
      if (wie) tk = tk.filter((t, i) => i < wie.start || i >= wie.start + wie.len);
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
      const past = (d) => (sector === "alle" || (d.sectoren || []).includes(sector)) && (!typeTest || typeTest(d)) && (!wie || d.wie.includes(wie.k));
      if (!delen.length) {
        if (!wie) return { resultaten: [], modus: "AND", frasen, typeFilter, wieOpties, leeg: true };
        // alleen een naam: alles van die persoon of fractie
        return { modus: "AND", frasen, typeFilter, wieOpties, wie,
          resultaten: docs.filter(past).map((d) => ({ doc: d, score: 1, termen: new Set(), inTitel: false, zwak: false })) };
      }
      const filter = (r) => {
        const d = perId.get(r.id);
        if (!past(d)) return false;
        if (frasen.length) {
          const t = " " + tokens([d.titel, d.kern, d.tekst, d.dossier, d.personen].join(" ")).join(" ") + " ";
          if (!frasen.every((f) => t.includes(" " + f + " "))) return false;
        }
        return true;
      };
      let modus = "AND";
      let res = combineer(delen, filter, "AND");
      if (!res.length && delen.length > 1) { modus = "OR"; res = combineer(delen, filter, "OR"); }
      // een treffer is "zwak" als een woord uit de vraag alleen via tikfoutcorrectie past (kerncentrales -> kolencentrales,
      // energieverkenning -> energierekening); die tonen we alleen als er niets anders is (de vraag bevat dan zelf een tikfout)
      let resultaten = res.map((r) => ({ doc: perId.get(r.id), score: r.score, termen: new Set(r.terms), inTitel: r.velden.has("titel"), zwak: r.zwak }));
      const tikfout = resultaten.length > 0 && resultaten.every((r) => r.zwak);
      if (!tikfout) resultaten = resultaten.filter((r) => !r.zwak);
      return { modus, frasen, typeFilter, wieOpties, wie, resultaten, tikfout };
    }

    // bij nul resultaten: "Bedoelde je ...?" (dichtstbijzijnde bekende woorden) en welke losse woorden wel iets opleveren
    function afstand(a, b, max) {
      if (Math.abs(a.length - b.length) > max) return max + 1;
      let vorig = Array.from({ length: b.length + 1 }, (_, i) => i);
      for (let i = 1; i <= a.length; i++) {
        const rij = [i]; let min = i;
        for (let k = 1; k <= b.length; k++) {
          rij[k] = Math.min(vorig[k] + 1, rij[k - 1] + 1, vorig[k - 1] + (a[i - 1] === b[k - 1] ? 0 : 1));
          if (rij[k] < min) min = rij[k];
        }
        if (min > max) return max + 1;
        vorig = rij;
      }
      return vorig[b.length];
    }
    function suggesties(q) {
      const tk = tokens(String(q).replace(/"/g, " ")).filter((t) => !STOP.has(t));
      const uit = [];
      let veranderd = false;
      const nieuw = tk.map((t) => {
        if (/\d/.test(t) || ms.search(t, { fuzzy: false }).length) return t;
        const max = t.length >= 8 ? 3 : 2;
        let best = null;
        for (const [w, f] of freq) {
          if (w.length < 3 || /\d/.test(w)) continue;
          const d = afstand(t, w, max);
          if (d <= max && (!best || d < best.d || (d === best.d && f > best.f))) best = { w, d, f };
        }
        if (best) { veranderd = true; return best.w; }
        return t;
      });
      if (veranderd) { const vq = nieuw.join(" "); const n = zoek(vq).resultaten.length; if (n) uit.push({ q: vq, n, soort: "spelling" }); }
      if (tk.length > 1) for (const t of tk) { const n = zoek(t).resultaten.length; if (n && !uit.some((u) => u.q === t)) uit.push({ q: t, n, soort: "woord" }); }
      return uit;
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

    return { zoek, markeer, fragment, suggesties, aantal: docs.length, wieInfo: (k) => wieMap.get(k) };
  }

  return { maak, stam, tokens, norm };
});
