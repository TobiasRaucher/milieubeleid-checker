/* MilieuRadar: thema's toekennen op basis van trefwoorden (data/themas.json). Werkt in de browser (window.MRThemas) en in Node. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MRThemas = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const norm = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  function maak(cfg) {
    const lijst = ((cfg && cfg.themas) || []).map((t) => ({ ...t, re: (t.trefwoorden || []).map((x) => new RegExp(x)) }));
    const perId = new Map(lijst.map((t) => [t.id, t]));
    const terugval = (cfg && cfg.terugval) || {};
    // titel telt altijd; overige teksten (bv. agendapunten) pas bij twee treffers; daarna één treffer; daarna de sector
    function voor(titel, overig, sectoren) {
      const t = norm(titel), rest = (overig || []).filter(Boolean).map(norm);
      const telt = (th, n) => th.re.some((r) => r.test(n));
      let ids = lijst.filter((th) => telt(th, t) || rest.filter((n) => telt(th, n)).length >= 2).map((th) => th.id);
      if (!ids.length) ids = lijst.filter((th) => rest.some((n) => telt(th, n))).map((th) => th.id);
      if (!ids.length) for (const s of sectoren || []) ids.push(...(terugval[s] || []));
      return [...new Set(ids)];
    }
    return { lijst, voor, naam: (id) => perId.get(id)?.naam || id, kleur: (id) => perId.get(id)?.kleur || "#888", bestaat: (id) => perId.has(id) };
  }
  return { maak, norm };
});
