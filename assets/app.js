/* MilieuRadar: leest de JSON-bestanden in data/ en tekent de pagina. Geen build-stap nodig. */
(function () {
  "use strict";
  const S = { sector: "alle", data: null, motieFilter: { q: "", uitslag: [], appreciatie: [], fractie: [], richting: "desc" },
    stukFilter: { q: "", soort: "", ministerie: "", max: 100 },
    zoekCat: "", zoekMax: 30 };
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MAANDEN_KORT = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  const MAANDEN = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
  const dagNL = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const VANDAAG = dagNL(new Date());
  const WEEKDAGEN = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];

  function fmtDatum(d) {
    if (!d) return "datum onbekend";
    let m;
    if ((m = /^(\d{4})-Q(\d)$/.exec(d))) return `Q${m[2]} ${m[1]}`;
    if ((m = /^(\d{4})-voorjaar$/.exec(d))) return `voorjaar ${m[1]}`;
    if ((m = /^(\d{4})-(\d{2})$/.exec(d))) return `${MAANDEN[+m[2] - 1]} ${m[1]}`;
    if ((m = /^(\d{4})$/.exec(d))) return m[1];
    if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d))) return `${+m[3]} ${MAANDEN[+m[2] - 1]} ${m[1]}`;
    return d;
  }
  // Korte datum, het vaste formaat voor meta, tabellen en bronstempels: "11 nov 2026".
  // De lange vorm (fmtDatum, "11 november 2026") alleen binnen lopende zinnen.
  function fmtKort(d) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || "");
    return m ? `${+m[3]} ${MAANDEN_KORT[+m[2] - 1]} ${m[1]}` : fmtDatum(d);
  }
  // "12 nov 2026 21:59" in Nederlandse tijd (zelfde datumformaat als de rest van de site)
  function fmtTijdstip(d) {
    const p = Object.fromEntries(new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric", hour12: false })
      .formatToParts(d).map((x) => [x.type, x.value]));
    return `${fmtKort(`${p.year}-${p.month}-${p.day}`)} ${p.hour}:${p.minute}`;
  }
  // getallen in Nederlandse notatie: 1.092
  const nl = (n) => (typeof n === "number" ? n.toLocaleString("nl-NL") : n);
  // eerste letter hoofdletter (labels in zinsvorm)
  const hoofd = (s) => { s = String(s ?? ""); return s.charAt(0).toUpperCase() + s.slice(1); };
  // lucide-iconen, 16px, lijn 1,5 (stijl in .ico)
  const ICO = { x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', omhoog: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>', pijlop: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>', pijlneer: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>' };
  const ico = (n) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICO[n]}</svg>`;
  // sorteersleutel voor vage datums ("2026-Q4" -> 2026-12-31 etc.)
  function sortKey(d) {
    if (!d) return "9999";
    let m;
    if ((m = /^(\d{4})-Q(\d)$/.exec(d))) return `${m[1]}-${String(m[2] * 3).padStart(2, "0")}-31`;
    if ((m = /^(\d{4})-voorjaar$/.exec(d))) return `${m[1]}-05-31`;
    if ((m = /^(\d{4})-(\d{2})$/.exec(d))) return `${d}-31`;
    return d.slice(0, 10);
  }

  async function load(path, fallback) {
    try {
      const r = await fetch(path, { cache: "no-cache" });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (e) {
      console.warn("Kon niet laden:", path, e);
      return fallback;
    }
  }

  async function init() {
    const [config, debatten, agenda, zaken, activiteiten, meta, stukken, synoniemen, themas, toezeggingenData, themaMapping] = await Promise.all([
      load("pipeline/config.json", { sectoren: {} }),
      load("data/debatten.json", { debatten: [] }),
      load("data/agenda.json", { items: [] }),
      load("data/tk/zaken.json", []),
      load("data/tk/activiteiten.json", []),
      load("data/tk/meta.json", {}),
      load("data/tk/stukken.json", []),
      load("data/zoeksynoniemen.json", { groepen: [] }),
      load("data/themas.json", { regels: {} }),
      load("data/tk/toezeggingen.json", []),
      load("data/themas-mapping.json", {}),
    ]);
    S.data = { config, debatten: debatten.debatten, agenda: agenda.items, zaken, activiteiten, meta, stukken, synoniemen, themas, toezeggingen: toezeggingenData };
    if (!zaken.length && !activiteiten.length && !debatten.debatten.length) {
      $("#stamp").textContent = "";
      $("#view").innerHTML = `<div class="card empty laadfout"><h2>De gegevens konden niet worden geladen</h2><p>Controleer je verbinding en probeer het opnieuw.</p><button type="button" class="knop" onclick="location.reload()">Opnieuw proberen</button></div>`;
      return;
    }
    S.T = window.MRThemas.maak(themas, themaMapping);
    // meest recente moment waarop data of samenvattingen zijn bijgewerkt
    const stempels = [meta.bijgewerkt, debatten.bijgewerkt, agenda.bijgewerkt].filter(Boolean).map((t) => new Date(t)).filter((d) => !isNaN(d));
    $("#stamp").textContent = stempels.length ? `Bijgewerkt ${fmtTijdstip(new Date(Math.max(...stempels)))}` : "Bijgewerkt onbekend";
    bindZoekveld();
    window.addEventListener("hashchange", route);
    route();
  }

  function inSector(item) {
    if (S.sector === "alle") return true;
    const s = item.sectoren || (item.sector ? [item.sector] : []);
    return s.includes(S.sector);
  }

  // randeffect onder de kop: alleen als er inhoud onder schuift
  const zetScrollRand = () => document.body.classList.toggle("gescrold", window.scrollY > 4);
  window.addEventListener("scroll", zetScrollRand, { passive: true });

  /* ---------- Kop: glijdende tab-aanduiding, hoogte van de kop, randvervaging ---------- */
  const NAV = $("nav.tabs");
  const GLIJ = document.createElement("span");
  GLIJ.className = "tab-glij"; GLIJ.setAttribute("aria-hidden", "true");
  NAV.prepend(GLIJ); NAV.classList.add("glij");
  let _glijGezet = false;
  const minderBeweging = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  // De aanduiding beweegt via een CSS-overgang op transform: die start altijd vanaf de huidige stand, dus snel wisselen blijft vloeiend.
  function zetGlij(animeer) {
    const a = NAV.querySelector("a.active");
    if (!a) { GLIJ.style.opacity = "0"; return; }
    const direct = !animeer || !_glijGezet || GLIJ.style.opacity === "0";
    if (direct) GLIJ.style.transition = "none";
    GLIJ.style.width = a.offsetWidth + "px";
    GLIJ.style.transform = `translateX(${a.offsetLeft}px)`;
    GLIJ.style.opacity = "1";
    if (direct) { void GLIJ.offsetWidth; GLIJ.style.transition = ""; }
    _glijGezet = true;
    // actieve tab in beeld houden als de tabbalk zelf scrolt (telefoon)
    if (NAV.scrollWidth > NAV.clientWidth + 1) {
      const doel = a.offsetLeft - (NAV.clientWidth - a.offsetWidth) / 2;
      NAV.scrollTo({ left: doel, behavior: animeer && !minderBeweging() ? "smooth" : "auto" });
    }
  }
  function zetNavRand() {
    NAV.classList.toggle("fade-l", NAV.scrollLeft > 4);
    NAV.classList.toggle("fade-r", NAV.scrollLeft + NAV.clientWidth < NAV.scrollWidth - 4);
  }
  NAV.addEventListener("scroll", zetNavRand, { passive: true });
  function zetKopHoogte() {
    const k = $("header.top");
    const vast = getComputedStyle(k).position === "sticky";
    document.documentElement.style.setProperty("--kop-h", (vast ? k.offsetHeight : 0) + "px");
  }
  let _rsz = null;
  window.addEventListener("resize", () => { clearTimeout(_rsz); _rsz = setTimeout(() => { zetKopHoogte(); zetGlij(false); zetNavRand(); if (window.MRMilieu) MRMilieu.herteken(); }, 80); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { zetKopHoogte(); zetGlij(false); zetNavRand(); });

  // Terug naar boven: verschijnt pas na flink scrollen
  const BOVEN = $("#naarboven");
  const zetBoven = () => BOVEN.classList.toggle("zichtbaar", window.scrollY > Math.max(900, window.innerHeight * 1.2));
  window.addEventListener("scroll", zetBoven, { passive: true });
  BOVEN.addEventListener("click", () => { window.scrollTo({ top: 0, behavior: minderBeweging() ? "auto" : "smooth" }); $("#view").focus({ preventScroll: true }); });

  // Sneltoets "/" zet de cursor in het zoekveld
  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    e.preventDefault(); const v = $("#zoekveld"); v.focus(); v.select();
  });

  // Scrollpositie: een klik op een link begint bovenaan; terug/vooruit in de browser komt terug waar je was.
  const _scrollBij = new Map();
  let _klik = true;
  document.addEventListener("click", (e) => { if (e.target.closest('a[href^="#"]')) { _klik = true; setTimeout(() => { _klik = false; }, 400); } }, true);
  window.addEventListener("scroll", () => { _scrollBij.set(location.hash || "#overzicht", window.scrollY); }, { passive: true });

  let _vorigeTab = null, _vorigPad = null;
  // Oude adressen: Vergaderingen (ook #debatten), Toezeggingen en Per fractie zijn opgegaan in de Agenda; wetsdossiers bestaan niet meer.
  function oudeRoute(tab, pad) {
    if (tab === "wetgeving" && pad.includes("/")) return "#wetgeving";
    if (tab === "toezeggingen" || tab === "fracties") return "#agenda?terugblik=1";
    if (tab !== "vergaderingen" && tab !== "debatten") return null;
    const sub = pad.split("/")[1];
    const p = new URLSearchParams(location.hash.split("?")[1] || "");
    const q = ["type", "commissie", "ministerie", "thema"].filter((k) => p.get(k)).map((k) => `${k}=${encodeURIComponent(p.get(k))}`);
    if (!sub) q.push("terugblik=1");
    return `#agenda${sub ? "/" + sub : ""}${q.length ? "?" + q.join("&") : ""}`;
  }
  function route() {
    const pad = (location.hash || "#overzicht").slice(1).split("?")[0];
    const tab = pad.split("/")[0] || "overzicht";
    const oud = oudeRoute(tab, pad);
    if (oud) { history.replaceState(null, "", oud); route(); return; }
    document.querySelectorAll("nav.tabs a").forEach((a) => {
      const navTab = tab === "amendementen" ? "moties" : tab;
      a.classList.toggle("active", a.dataset.tab === navTab);
      if (a.dataset.tab === navTab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    const views = { overzicht, themas: themasPagina, wetgeving, moties, amendementen: moties, stukken, agenda, over, zoeken };
    const TITELS = { themas: "Thema's", agenda: "Agenda", wetgeving: "Wetgeving", moties: "Moties", amendementen: "Amendementen", stukken: "Stukken van ministeries", over: "Over", zoeken: "Zoeken" };
    document.title = TITELS[tab] ? `${TITELS[tab]} · milieuradar` : "milieuradar";
    if (tab === "themas" && pad.split("/")[1]) { const t = S.T.thema(pad.split("/")[1]); document.title = `${t ? t.label : "Thema niet gevonden"} · Thema's · milieuradar`; }
    { const v = $("#zoekveld"); if (tab === "zoeken") { if (document.activeElement !== v) v.value = zoekVraag(); } else v.value = ""; }
    $("#view").innerHTML = (views[tab] || overzicht)();
    const tabGewisseld = tab !== _vorigeTab, eerste = _vorigeTab === null;
    if (tabGewisseld) { const v = $("#view"); v.classList.remove("binnenkomst"); void v.offsetWidth; v.classList.add("binnenkomst"); }
    _vorigeTab = tab;
    zetKopHoogte(); zetGlij(!eerste); zetNavRand();
    // Thema's: overzicht en detail zijn aparte pagina's binnen dezelfde tab, dus ook daartussen bovenaan beginnen (of herstellen bij terug/vooruit)
    const themaWissel = tab === "themas" && pad !== _vorigPad && !eerste;
    if ((tabGewisseld && !eerste && !pad.includes("/")) || themaWissel) {
      const bewaard = _klik ? null : _scrollBij.get(location.hash || "#overzicht");
      if (bewaard != null) setTimeout(() => window.scrollTo(0, bewaard), 0);
      else window.scrollTo(0, 0);
    }
    _vorigPad = pad;
    _klik = false;
    zetScrollRand(); zetBoven();
    if (tab === "moties" || tab === "amendementen") bindMoties();
    if (tab === "stukken") bindStukken();
    if (tab === "zoeken") renderZoekResultaten();
    if (tab === "overzicht" && window.MRMilieu) MRMilieu.vul();
    const sub = tab === "agenda" || tab === "themas" ? null : pad.split("/")[1];
    if (sub) { const t = document.getElementById(sub); if (t) { if (t.tagName === "DETAILS") t.open = true; if (t.classList.contains("debat")) t.classList.add("open"); t.scrollIntoView({ behavior: "smooth", block: "start" }); } }
  }

  /* ---------- helpers ---------- */
  const motiesEnAmendementen = () => S.data.zaken.filter((z) => (z.soort === "Motie" || z.soort === "Amendement") && inSector(z));
  const wetsvoorstellenTK = () => S.data.zaken.filter((z) => (z.soort === "Wetgeving" || z.soort === "Initiatiefwetgeving") && inSector(z));
  const isDebat = (a) => debatSoorten.includes(a.Soort) || (a.Soort || "").startsWith("Plenair debat");
  const soortLabel = (a) => a.SoortWeergave || a.Soort;
  const commissieNaam = (a) => (a.Voortouwafkorting === "TK" || !a.Voortouwnaam) ? "Plenaire vergadering" : a.Voortouwnaam.replace(/^(vaste |algemene )?commissie voor /i, "");
  const tijdNL = (iso) => iso ? new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "";
  const debatSoorten = ["Commissiedebat", "Plenair debat", "Tweeminutendebat", "Wetgevingsoverleg", "Notaoverleg", "Rondetafelgesprek", "Technische briefing", "Hoorzitting", "Dertigledendebat", "Debat"];

  // status: stip plus woord (de stip draagt de kleur, het woord de betekenis)
  function uitslagPill(u) {
    const cls = (u || "in behandeling").replace(/\s+/g, "-");
    return `<span class="status ${cls}"><span class="dot" aria-hidden="true"></span>${esc(hoofd(u || "in behandeling"))}</span>`;
  }
  function indienersTekst(z) {
    const eerste = z.indieners.find((i) => /^indiener|eerste/i.test(i.relatie || "")) || z.indieners[0];
    if (!eerste) return "";
    const mede = z.indieners.length - 1;
    return `${esc(eerste.naam)}${eerste.fractie ? ` (${esc(eerste.fractie)})` : ""}${mede > 0 ? ` c.s. (+${mede})` : ""}`;
  }
  const korteTitel = (z) => { const t = z.onderwerp || z.titel || ""; return /^(nader )?(gewijzigde? )?(motie|amendement)\b/i.test(t) ? t.replace(/^.*? over /i, "") : t; };
  function dossierLabel(z) {
    return z.dossiers.map((d) => `${d.nummer}${d.toevoeging ? "-" + d.toevoeging : ""}`).join(", ");
  }

  const uniek = (arr) => [...new Set(arr)];

  /* ---------- Overzicht ---------- */
  // "Net binnen": één chronologische lijst van stukken, stemmingen en wetgeving.
  // Alle bronnen gebruiken ISO-datums (JJJJ-MM-DD); alleen datums op de dag nauwkeurig en niet in de toekomst tellen mee.
  // Geen tijden in de data, dus binnen één dag: Wetgeving, dan Stemming, dan Stuk.
  const NET_BINNEN_MAX = 10;
  const FEED_ORDE = { Wetgeving: 0, Stemming: 1, Stuk: 2 };
  const isDag = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || "") && d <= VANDAAG;
  // Kamerleden zonder voorletters, zoals in de motietabel: "van het lid A.B. (Anne) Jansen" -> "van het lid Jansen".
  // Alleen in titels die "het lid" of "de leden" noemen, en alleen direct na lid/leden/en/komma (niet "Inzet C.W. Artikel 2.25").
  const zonderVoorletters = (t) => (/\b(het lid|de leden)\b/i.test(t)
    ? t.replace(/(\b(?:lid|leden|en)\s+|,\s*)(?:[A-ZÀ-Ý][a-z]{0,2}\.)+\s*(?:\([^)]*\)\s*)?(?=\p{Lu}|[a-z]{1,3}\s)/gu, "$1")
    : t);
  // Eén doorlopende regel: soort (accent), datum, status of ministerie, titel; daarna eventueel een stille staart (indieners, Kamerstuk).
  function feedLi(soort, datum, meta, titel, href, staart, extern) {
    const doel = extern ? ` target="_blank" rel="noopener"` : "";
    return `<li class="feed"><span class="feed-soort">${esc(soort)}</span><span class="feed-datum">${fmtKort(datum)}</span>${meta}<a class="ltitel" href="${esc(href)}"${doel}>${esc(zonderVoorletters(titel))}</a>${staart ? `<span class="feed-staart">${staart}</span>` : ""}</li>`;
  }
  const feedMeta = (html) => (html ? `<span class="feed-meta">${html}</span>` : "");
  function netBinnen() {
    const items = [];
    for (const z of motiesEnAmendementen()) {
      const t = z.stemtelling;
      if (!t || !isDag(t.datum)) continue;
      items.push({ soort: "Stemming", datum: t.datum, html: feedLi(z.soort, t.datum, feedMeta(uitslagPill(z.uitslag)),
        onderwerpZin(z), tkUrl(z), `<span class="nw">${indienerKort(z)}</span>${t.voor + t.tegen ? ` <span class="nw">· Voor ${t.voor} / Tegen ${t.tegen}</span>` : ""}`, true) });
    }
    for (const x of stukkenInSector()) {
      if (!isDag(x.datum)) continue;
      const dossier = (x.dossiers || [])[0];
      items.push({ soort: "Stuk", datum: x.datum, html: feedLi(SOORT_KORT[x.soort] || x.soort, x.datum, feedMeta(esc(x.ministerie || "ministerie onbekend")),
        x.onderwerp || x.titel, x.link, dossier ? `<span class="mono">${esc(x.kamerstuk || dossier.nummer)}</span> ${esc(dossier.titel || "")}` : "", true) });
    }
    // wetgeving: nieuw ingediende wetsvoorstellen
    for (const z of wetsvoorstellenTK()) {
      if (!isDag(z.gestartOp)) continue;
      items.push({ soort: "Wetgeving", datum: z.gestartOp, html: feedLi("Wetsvoorstel", z.gestartOp, feedMeta("Ingediend"),
        z.titel || z.onderwerp, z.link, `<span class="mono">${esc(dossierLabel(z))}</span>`, true) });
    }
    return items.sort((a, b) => b.datum.localeCompare(a.datum) || FEED_ORDE[a.soort] - FEED_ORDE[b.soort]).slice(0, NET_BINNEN_MAX);
  }
  function overzicht() {
    const komend = agendaItems().filter((i) => sortKey(i.datum) >= VANDAAG).slice(0, 6);
    const binnen = netBinnen();
    return `
      ${window.MRMilieu ? MRMilieu.sectieHtml() : ""}
      <div class="ov-onder">
        <section aria-labelledby="ov-binnen"><h2 id="ov-binnen">Net binnen</h2><div class="card"><ul class="list">
          ${binnen.map((i) => i.html).join("") || `<li class="empty">Nog niets binnen</li>`}
        </ul><div class="kaartvoet"><a href="#stukken">Alle stukken</a><a href="#moties">Alle moties en amendementen</a><a href="#wetgeving">Wetgeving</a></div></div></section>
        <section aria-labelledby="ov-komt"><h2 id="ov-komt">Komt eraan</h2><div class="card"><ul class="list">
          ${komend.map((i) => agendaLi(i)).join("") || `<li class="empty">Niets gepland</li>`}
        </ul><div class="kaartvoet"><a href="#agenda">Volledige agenda</a></div></div></section>
      </div>`;
  }

  /* ---------- Thema's ---------- */
  // Routes: #themas (overzicht) en #themas/<slug> (detail). Gereserveerd voor latere filters: #themas/<slug>?type=<soort>,
  // met soort uit MRThemas.SOORTEN[].param (wetten, amendementen, moties, kamerbrieven, antwoorden, vergaderingen, agenda).
  // Alle tellingen komen uit MRThemas.bronItems: dezelfde lijst als de review-CSV en de noscript-lijst.
  let _themaIndex = null;
  function themaIndex() {
    if (_themaIndex) return _themaIndex;
    const items = window.MRThemas.bronItems(S.data);
    const perThema = new Map(S.T.lijst.map((t) => [t.slug, []]));
    const zonder = [];
    const gezien = new Set();
    for (const x of items) {
      if (gezien.has(x.sleutel)) continue;
      gezien.add(x.sleutel);
      x.themas = window.MRThemas.themasVanItem(S.T, x);
      // nog niet geclassificeerd = geen thema en (nog) niet nagekeken; bewust zonder thema (mapping met []) telt niet mee
      if (!x.themas.length && !S.T.inMapping(x.sleutel)) zonder.push(x);
      for (const sl of x.themas) perThema.get(sl)?.push(x);
    }
    return (_themaIndex = { items, perThema, zonder });
  }
  // eerstvolgend moment: vroegste datum vanaf vandaag (vage datums als "Q4 2026" achteraan in hun periode)
  function eerstvolgend(lijst) {
    return lijst.flatMap((x) => x.momenten || []).filter((m) => sortKey(m.datum) >= VANDAAG)
      .sort((a, b) => sortKey(a.datum).localeCompare(sortKey(b.datum)) || (a.label || "").localeCompare(b.label || ""))[0] || null;
  }
  function telRegel(lijst) {
    return window.MRThemas.SOORTEN.map((s) => { const n = lijst.filter((x) => x.soort === s.code).length; return n ? `${nl(n)} ${n === 1 ? s.een : s.veel}` : ""; })
      .filter(Boolean).join(" · ");
  }
  function themaKaart(t, lijst) {
    const m = eerstvolgend(lijst);
    const vandaag = m && m.datum === VANDAAG;
    return `<li><a class="themakaart" href="#themas/${esc(t.slug)}">
      <h3>${esc(t.label)}</h3>
      ${lijst.length ? `<p class="themakaart-tal">${nl(lijst.length)} ${lijst.length === 1 ? "item" : "items"}</p>
      <p class="themakaart-soorten">${telRegel(lijst)}</p>
      ${m ? `<p class="themakaart-moment"><span class="tag">${esc(m.label)}</span><span class="datum${vandaag ? " vandaag" : ""}">${vandaag ? "Vandaag" : fmtKort(m.datum)}</span><span class="moment-titel">${esc(m.titel)}</span></p>` : ""}`
        : `<p class="themakaart-leeg">Nog geen items</p>`}
    </a></li>`;
  }
  function themasPagina() {
    const pad = (location.hash || "").slice(1).split("?")[0].split("/");
    if (pad[1]) return themaDetail(decodeURIComponent(pad[1]));
    const { perThema, zonder } = themaIndex();
    return `<h2>Thema's</h2>
      <p class="muted small themas-intro">Alle wetten, moties, amendementen, Kamerbrieven, antwoorden op Kamervragen, vergaderingen en agenda-items in tien vaste thema's. Een item kan bij meer dan één thema horen.${zonder.length ? ` <span class="nw">${nl(zonder.length)} ${zonder.length === 1 ? "item" : "items"} nog niet geclassificeerd.</span>` : ""}</p>
      <ul class="themagrid">${S.T.lijst.map((t) => themaKaart(t, perThema.get(t.slug))).join("")}</ul>`;
  }
  // Detail: per documentsoort een groep (volgorde uit MRThemas.SOORTEN), lege groepen weg, nieuwste eerst
  // (Agenda: eerstvolgende eerst). Per item: datum, status, Kamerstuk; de rest achter "Meer details".
  const GROEP_ZICHTBAAR = 20;
  const datumVan = (x) => {
    const r = x.ref;
    if (x.soort === "motie" || x.soort === "amendement") return motieDatum(r);
    return x.datum || "";
  };
  const feit = (dt, dd) => (dd ? `<dt>${esc(dt)}</dt><dd>${dd}</dd>` : "");
  const extLink = (url, tekst) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(tekst)}</a>`;
  function agendapuntenLijst(a) {
    const ap = (a?.agendapunten || []).map((p) => p.onderwerp).filter(Boolean);
    return ap.length ? `<ul class="agendapunten">${ap.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "";
  }
  function themaRegel(x, slug) {
    const r = x.ref;
    let meta = [], titel = x.titel, href = "", extern = true, feiten = "";
    const datum = datumVan(x);
    if (datum) meta.push(`<span class="datum">${fmtKort(datum)}</span>`);
    if (x.soort === "wet") {
      meta.push(uitslagPill(r.uitslag));
      if (r.dossiers?.length) meta.push(`<span class="mono">${esc(dossierLabel(r))}</span>`);
      href = r.link;
      feiten = feit("Titel", r.onderwerp && r.onderwerp !== r.titel ? esc(r.onderwerp) : "") + feit("Ingediend door", esc(r.indieners.map((i) => i.naam).join(", ")))
        + feit("Laatste stap", r.gestartOp ? `${fmtDatum(r.gestartOp)}: ingediend` : "") + feit("Links", [r.tkLink && extLink(r.tkLink, "tweedekamer.nl"), extLink(r.link, "OpenTK")].filter(Boolean).join(" · "));
    } else if (x.soort === "motie" || x.soort === "amendement") {
      meta.push(uitslagPill(r.uitslag), `<span>${indienerKort(r)}</span>`);
      if (r.dossiers?.length) meta.push(`<span class="mono">${esc(dossierLabel(r))}</span>`);
      titel = onderwerpZin(r); href = tkUrl(r);
      const t = r.stemtelling;
      feiten = feit("Volledige tekst", esc(r.onderwerp)) + feit("Indieners", esc(r.indieners.map((i) => `${i.naam}${i.fractie ? ` (${i.fractie})` : ""}`).join(", ")))
        + feit("Appreciatie kabinet", esc(appreciatie(r))) + feit("Stemming", t && t.voor + t.tegen ? `Voor ${t.voor} / Tegen ${t.tegen} (${fmtKort(t.datum)})` : "")
        + feit("Kamerstuk", esc((r.dossiers || []).map((d) => `${d.nummer} ${d.titel || ""}`).join("; "))) + feit("Links", [extLink(tkUrl(r), "tweedekamer.nl"), extLink(r.link, "OpenTK")].join(" · "));
    } else if (x.soort === "brief" || x.soort === "antwoord") {
      meta.push(`<span>${esc(r.ministerie || "ministerie onbekend")}</span>`, `<span class="mono">${esc(r.kamerstuk || r.id)}</span>`);
      titel = r.onderwerp || r.titel; href = r.link;
      feiten = feit("Ondertekend door", esc([r.ondertekenaar, r.functie].filter(Boolean).join(", "))) + feit("Kamerstuk", esc((r.dossiers || []).map((d) => `${d.nummer} ${d.titel || ""}`).join("; ")))
        + feit("Document", `<span class="mono">${esc(r.id)}</span>`);
    } else if (x.sleutel.startsWith("agenda:")) {
      meta.push(`<span class="tag">${esc(r.type || "Mijlpaal")}</span>`);
      href = r.url || ""; feiten = "";
    } else if (r.Nummer) { // Kameractiviteit (vergadering of agenda)
      meta.push(`<span class="tag">${esc(window.MRThemas.typeNaam(r.Soort))}</span>`, `<span>${esc(commissieNaam(r))}</span>`);
      if (x.soort === "agenda" && r.Aanvangstijd) meta.splice(1, 0, `<span class="datum">${esc(tijdNL(r.Aanvangstijd))}</span>`);
      href = `#agenda/a-${r.Nummer}`; extern = false;
      feiten = feit("Agendapunten", agendapuntenLijst(r)) + feit("Activiteit", `<span class="mono">${esc(r.Nummer)}</span>`);
    } else { // samengevat debat
      const a = activiteitVan(r);
      meta.push(`<span class="tag">${esc(typeNaam(a ? a.Soort : r.type))}</span>`, `<span>${esc(a ? commissieNaam(a) : r.commissie || "")}</span>`, `<span class="badge stil">samengevat</span>`);
      href = `#agenda/d-${r.id}`; extern = false;
      feiten = feit("Kern", esc(r.gist)) + feit("Agendapunten", agendapuntenLijst(a));
    }
    const andere = x.themas.filter((sl) => sl !== slug);
    const link = href ? `<a class="ltitel" href="${esc(href)}"${extern ? ' target="_blank" rel="noopener"' : ""}>${extern ? titelMetPijl(titel) : esc(titel)}</a>` : `<span class="ltitel">${esc(titel)}</span>`;
    return `<li class="themaregel">
      <div class="regelmeta">${meta.join("")}</div>
      <div class="themaregel-titel">${link}</div>
      ${andere.length ? `<div class="tchips" aria-label="Ook bij">${andere.map((sl) => `<a class="tchip" href="#themas/${esc(sl)}">${esc(S.T.naam(sl))}</a>`).join("")}</div>` : ""}
      ${feiten ? `<details class="meer"><summary>Meer details</summary><dl class="facts">${feiten}</dl></details>` : ""}
    </li>`;
  }
  function themaDetail(slug) {
    const t = S.T.thema(slug);
    if (!t) return `<h2>Thema niet gevonden</h2><p class="themas-intro">Er is geen thema "${esc(slug)}". <a href="#themas">Naar alle thema's</a></p>`;
    const lijst = themaIndex().perThema.get(t.slug);
    const groepen = window.MRThemas.SOORTEN.map((so) => {
      const l = lijst.filter((x) => x.soort === so.code)
        .sort((a, b) => so.code === "agenda" ? sortKey(datumVan(a)).localeCompare(sortKey(datumVan(b))) : sortKey(datumVan(b)).localeCompare(sortKey(datumVan(a))));
      if (!l.length) return "";
      const meer = l.length - GROEP_ZICHTBAAR;
      return `<section aria-labelledby="g-${so.param}">
        <h3 class="groepkop" id="g-${so.param}">${esc(so.groep)} <span class="muted small">(${nl(l.length)})</span></h3>
        <div class="card"><ul class="list" id="gl-${so.param}">${l.map((x, i) => themaRegel(x, t.slug).replace('<li class="themaregel">', `<li class="themaregel"${i >= GROEP_ZICHTBAAR ? " hidden" : ""}>`)).join("")}</ul>
        ${meer > 0 ? `<button type="button" class="knop licht toonalle" data-toonalle="gl-${so.param}" aria-controls="gl-${so.param}" aria-expanded="false">Toon alle ${nl(l.length)} ${so.veel}</button>` : ""}</div>
      </section>`;
    }).join("");
    return `<p class="small terug"><a href="#themas">Alle thema's</a></p>
      <h2>${esc(t.label)}</h2>
      <p class="themas-intro">${esc(t.description)}</p>
      <p class="muted small">${lijst.length ? `${nl(lijst.length)} ${lijst.length === 1 ? "item" : "items"}: ${telRegel(lijst)}` : "Nog geen items"}</p>
      ${groepen}`;
  }
  // "Toon alle": de verborgen regels van een groep tonen en de focus op de eerste nieuwe regel zetten
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-toonalle]");
    if (!b) return;
    const ul = document.getElementById(b.dataset.toonalle);
    const eerste = ul.querySelector("li[hidden]");
    ul.querySelectorAll("li[hidden]").forEach((li) => { li.hidden = false; });
    b.remove();
    const doel = eerste && eerste.querySelector("a, summary");
    if (doel) doel.focus();
  });

  /* ---------- Wetgeving ---------- */
  // Wetsvoorstellen uit de open data van de Kamer (soort Wetgeving of Initiatiefwetgeving in de gevolgde Kamerstukdossiers).
  function wetgeving() {
    const lijst = wetsvoorstellenTK().slice().sort((a, b) => (b.gestartOp || "").localeCompare(a.gestartOp || ""));
    return `<h2>Wetgeving</h2>
      <p class="muted small">Wetsvoorstellen over milieu, klimaat, energie, water, natuur en leefomgeving, rechtstreeks uit de open data van de Tweede Kamer. Nieuwste eerst; een klik op een titel opent het wetsvoorstel op OpenTK.</p>
      ${lijst.length ? `<div class="tablewrap"><table class="wettabel"><thead><tr><th class="ond">Wetsvoorstel</th><th>Status</th><th class="rechts hide-sm">Kamerstuk</th><th class="rechts">Ingediend</th></tr></thead><tbody>
        ${lijst.map((z) => `<tr><td class="ond"><a class="ltitel" href="${esc(z.link)}" target="_blank" rel="noopener">${esc(z.titel || z.onderwerp)}</a>${((t) => (t.length ? `<div>${themaChips(t)}</div>` : ""))(themasVanZaak(z))}</td><td class="nw">${uitslagPill(z.uitslag)}</td><td class="rechts mono hide-sm">${esc(dossierLabel(z))}</td><td class="datum rechts">${fmtKort(z.gestartOp)}</td></tr>`).join("")}
      </tbody></table></div>` : `<p class="empty">Geen wetsvoorstellen gevonden</p>`}`;
  }

  /* ---------- Moties en amendementen ---------- */
  // Eén tabel voor beide soorten; de grote schakelaar bovenaan wisselt tussen #moties en #amendementen.
  // Uitslag, Appreciatie kabinet en Indiener zijn filters (meerdere waarden per kolom); alleen Datum sorteert.
  // Een klik op een rij opent het document op tweedekamer.nl; de knop naast de titel klapt de stemming uit.
  const SOORT_VAN_TAB = { moties: "Motie", amendementen: "Amendement" };
  const motieNav = (actief) => `<nav class="schakelaar" aria-label="Moties of amendementen">
      ${[["moties", "Moties"], ["amendementen", "Amendementen"]].map(([k, l]) => `<a href="#${k}" ${k === actief ? 'aria-current="page"' : ""}>${l}</a>`).join("")}
    </nav>`;
  // link naar het document op tweedekamer.nl (D-nummer uit de pipeline); anders zoeken op het zaaknummer
  const tkUrl = (z) => z.tkLink || `https://www.tweedekamer.nl/zoeken?q=${encodeURIComponent(z.nummer)}`;
  const onderwerpZin = (z) => hoofd(korteTitel(z).trim().replace(/\s+/g, " "));
  const titelMetPijl = (t) => { const i = t.lastIndexOf(" "); return `${esc(t.slice(0, i + 1))}<span class="nw">${esc(t.slice(i + 1))}<span class="ext" aria-hidden="true"></span></span>`; };
  const motieDatum = (z) => z.stemtelling?.datum || z.gestartOp || "";
  const eersteIndiener = (z) => z.indieners.find((i) => /^indiener|eerste/i.test(i.relatie || "")) || z.indieners[0];
  // "I. el Abassi" -> "el Abassi"; "J.P. (Jimmy) Dijk" -> "Dijk"
  const achternaam = (n) => String(n || "").replace(/^(?:[A-ZÀ-Ýa-z]{1,3}\.)+\s*(?:\([^)]*\)\s*)?/, "");
  function indienerKort(z) {
    const i = eersteIndiener(z);
    if (!i) return "";
    const naam = achternaam(i.naam), mede = z.indieners.length > 1;
    const fr = i.fractie && i.fractie !== naam ? ` (${esc(i.fractie)})` : "";
    const alle = z.indieners.map((x) => `${x.naam}${x.fractie ? ` (${x.fractie})` : ""}`).join(", ");
    return `<span title="${esc(alle)}">${esc(naam)}${fr}${mede ? ` <span class="muted">c.s.</span>` : ""}</span>`;
  }
  // appreciatie van het kabinet: de vijf vaste oordelen plus twee varianten; de rest (nog niet bekend, niet beschikbaar) is leeg
  const APPRECIATIES = ["Oordeel Kamer", "Overgenomen", "Ontraden", "Ontraden, tenzij gewijzigd", "Overbodig", "Ontijdig", "Verzocht aan te houden"];
  function appreciatie(z) {
    const a = (z.kabinetsappreciatie || "").trim();
    if (/^verzocht/i.test(a)) return "Verzocht aan te houden";
    return APPRECIATIES.includes(a) ? a : "";
  }
  const UITSLAG_ORDE = ["aangenomen", "in behandeling", "aangehouden", "verworpen", "ingetrokken", "vervallen"];
  const nlSort = new Intl.Collator("nl", { sensitivity: "base" });
  // vaste volgorde in een filtermenu; onbekende waarden achteraan
  const opVolgorde = (vast) => (vs) => [...vast.filter((v) => vs.has(v)), ...[...vs].filter((v) => !vast.includes(v)).sort(nlSort.compare)];

  // Filters per kolom. waarden(z): de waarden van een rij (een rij past als één ervan gekozen is);
  // binnen een kolom telt "of", tussen kolommen "en". Indiener telt alle indieners, ook mede-indieners.
  const MOTIE_FILTERS = {
    uitslag: { label: "Uitslag", waarden: (z) => [z.uitslag || "in behandeling"], orde: opVolgorde(UITSLAG_ORDE), tekst: (v) => uitslagPill(v) },
    appreciatie: { label: "Appreciatie kabinet", waarden: (z) => [appreciatie(z)], orde: opVolgorde([...APPRECIATIES, ""]), tekst: (v) => esc(v || "Geen appreciatie") },
    fractie: { label: "Indiener", waarden: (z) => uniek(z.indieners.map((i) => fractieNaam(i.fractie)).filter(Boolean)), orde: opVolgorde([]), tekst: (v) => esc(v) },
  };
  const motieZoektekst = (z) => `${z.onderwerp} ${z.titel} ${z.indieners.map((i) => `${i.naam} ${i.fractie}`).join(" ")} ${z.dossiers.map((d) => `${d.nummer}${d.toevoeging ? "-" + d.toevoeging : ""}`).join(" ")}`.toLowerCase();
  // past een motie bij zoekterm en filters; `behalve` laat één kolom buiten beschouwing (voor de aantallen in het menu van die kolom)
  function motiePast(z, behalve) {
    const f = S.motieFilter, q = f.q.trim().toLowerCase();
    if (q && !motieZoektekst(z).includes(q)) return false;
    return Object.entries(MOTIE_FILTERS).every(([k, def]) => k === behalve || !f[k].length || def.waarden(z).some((v) => f[k].includes(v)));
  }
  const motieGefilterd = () => !!S.motieFilter.q.trim() || Object.keys(MOTIE_FILTERS).some((k) => S.motieFilter[k].length);
  // alleen Datum sorteert: nieuwste of oudste eerst; zonder datum altijd onderaan, bij gelijke datum op zaaknummer
  const motieVolgorde = (richting) => (a, b) => {
    const x = motieDatum(a), y = motieDatum(b), r = richting === "asc" ? 1 : -1;
    if (!x || !y) return x === y ? 0 : x ? -1 : 1;
    return (x.localeCompare(y) || String(a.nummer).localeCompare(String(b.nummer))) * r;
  };
  function motieKoppen(soort) {
    const f = S.motieFilter, asc = f.richting === "asc";
    const filterKop = (k) => {
      const n = f[k].length, label = MOTIE_FILTERS[k].label;
      return `<th class="fkop"><button type="button" class="kopfilter${n ? " actief" : ""}" data-filter="${k}" aria-expanded="false" aria-controls="mfmenu" aria-label="Filter ${esc(label.toLowerCase())}${n ? `, ${n} gekozen` : ""}">${esc(label)}${n ? `<span class="facet-n">${n}</span>` : ""}</button></th>`;
    };
    return `<tr>
      <th class="ond">${soort}</th><th class="knopcel"><span class="sr-only">Stemming</span></th>
      ${filterKop("uitslag")}${filterKop("appreciatie")}${filterKop("fractie")}
      <th class="rechts hide-sm">Kamerstuk</th>
      <th class="rechts dkop" aria-sort="${asc ? "ascending" : "descending"}"><button type="button" class="sorteer actief" data-sort="datum" aria-label="Datum, ${asc ? "oudste" : "nieuwste"} eerst; klik om om te draaien">Datum${ico(asc ? "pijlop" : "pijlneer")}</button></th>
    </tr>`;
  }

  function moties() {
    const tab = location.hash.slice(1).split(/[/?]/)[0] === "amendementen" ? "amendementen" : "moties";
    const soort = SOORT_VAN_TAB[tab];
    return `${motieNav(tab)}<h2 class="sr-only">${tab === "moties" ? "Moties" : "Amendementen"}</h2>
      <div class="filters motiezoek"><input type="search" id="mq" placeholder="Zoek op onderwerp, Kamerlid of Kamerstuknummer" value="${esc(S.motieFilter.q)}" aria-label="Zoeken"></div>
      <div class="tablewrap"><table class="motietabel" data-soort="${soort}"><thead id="mkop">${motieKoppen(soort)}</thead><tbody id="mbody"></tbody></table></div>
      <div id="mfmenu" class="kopmenu" popover="manual"></div>
      <p class="small muted">Een klik op een rij opent ${soort === "Motie" ? "de motie" : "het amendement"} op tweedekamer.nl; de knop naast de titel toont de stemming per fractie. Uitslag, Appreciatie kabinet en Indiener filteren, Datum sorteert. Alle gegevens komen rechtstreeks uit de open data van de Tweede Kamer.</p>`;
  }
  function bindMoties() {
    const f = S.motieFilter, soort = $(".motietabel").dataset.soort, menu = $("#mfmenu");
    const alle = motiesEnAmendementen().filter((z) => z.soort === soort);
    const kanPopover = typeof menu.showPopover === "function";
    if (!kanPopover) menu.hidden = true;
    // documentbrede luisteraars van een vorige weergave opruimen
    if (S.motieAf) S.motieAf.abort();
    S.motieAf = new AbortController();
    const sig = { signal: S.motieAf.signal };
    let rows = [], openKol = "";
    const knopVan = (k) => $(`#mkop button[data-filter="${k}"]`);

    const tekenKop = () => {
      $("#mkop").innerHTML = motieKoppen(soort);
      if (openKol) knopVan(openKol).setAttribute("aria-expanded", "true");
    };
    const tekenRijen = () => {
      const eenheid = soort === "Motie" ? "moties" : "amendementen";
      $("#mbody").innerHTML = rows.map((z, i) => {
        const a = appreciatie(z), ruw = (z.kabinetsappreciatie || "").trim();
        return `<tr class="row" data-i="${i}">
          <td class="ond"><a class="ltitel" href="${esc(tkUrl(z))}" target="_blank" rel="noopener">${titelMetPijl(onderwerpZin(z))}</a></td>
          <td class="knopcel"><button type="button" class="uitklap" aria-expanded="false" aria-label="Stemming per fractie tonen">${ico("chevron")}</button></td>
          <td class="uitslag">${uitslagPill(z.uitslag)}</td>
          <td class="appr hide-sm">${a ? esc(a) : `<span class="leeg" title="${esc(ruw || "Geen appreciatie")}"><span aria-hidden="true">–</span><span class="sr-only">${esc(ruw || "Geen appreciatie")}</span></span>`}</td>
          <td class="indiener hide-sm">${indienerKort(z)}</td>
          <td class="kamerstuk rechts mono hide-sm">${esc(dossierLabel(z))}</td>
          <td class="datum rechts">${fmtKort(motieDatum(z))}</td>
        </tr>`;
      }).join("") || `<tr><td colspan="7" class="empty">Geen ${eenheid} ${motieGefilterd() ? `met deze filters <button type="button" class="linkknop" data-wisalles>Filters wissen</button>` : "gevonden"}</td></tr>`;
    };
    const toepassen = () => {
      rows = alle.filter((z) => motiePast(z)).sort(motieVolgorde(f.richting));
      tekenKop();
      tekenRijen();
    };

    // filtermenu: één popover voor de drie kolommen, met per waarde het aantal rijen onder de andere filters
    const menuInhoud = (k) => {
      const def = MOTIE_FILTERS[k], tel = new Map();
      for (const z of alle) {
        const past = motiePast(z, k);
        for (const v of def.waarden(z)) tel.set(v, (tel.get(v) || 0) + (past ? 1 : 0));
      }
      for (const v of f[k]) if (!tel.has(v)) tel.set(v, 0);
      return `<div role="group" aria-label="${esc(def.label)}">${def.orde(new Set(tel.keys())).map((v, i) =>
        `<label${tel.get(v) ? "" : ' class="nul"'}><input type="checkbox" id="mf-${k}-${i}" value="${esc(v)}" ${f[k].includes(v) ? "checked" : ""}><span>${def.tekst(v)}</span><span class="n">${nl(tel.get(v))}</span></label>`).join("")}</div>
        ${f[k].length ? `<div class="kopmenu-voet"><button type="button" class="linkknop" data-wis="${k}">Wissen</button></div>` : ""}`;
    };
    // het menu ligt in de bovenste laag (popover), zodat de tabelrand het niet afknipt; plaats het onder de kolomkop
    const plaats = () => {
      const b = openKol && knopVan(openKol);
      if (!b || !menu.isConnected) return;
      const r = b.getBoundingClientRect(), w = menu.offsetWidth;
      // zonder eigen opvulling (tabelkop) staat het vinkje onder de koptekst; als knop (telefoon) lijnt het menu uit met de knop
      const inspring = parseFloat(getComputedStyle(b).paddingLeft) ? 0 : 13;
      menu.style.left = `${Math.max(12, Math.min(r.left - inspring, innerWidth - w - 12))}px`;
      menu.style.top = `${r.bottom + 4}px`;
      menu.style.maxHeight = `${Math.max(160, Math.min(340, innerHeight - r.bottom - 16))}px`;
    };
    const openMenu = (k) => {
      openKol = k;
      menu.innerHTML = menuInhoud(k);
      tekenKop();
      if (kanPopover) { if (!menu.matches(":popover-open")) menu.showPopover(); } else menu.hidden = false;
      plaats();
      const eerste = menu.querySelector("input:checked") || menu.querySelector("input");
      if (eerste) eerste.focus({ preventScroll: true });
    };
    const sluitMenu = (focus) => {
      if (!openKol) return;
      const k = openKol;
      openKol = "";
      if (kanPopover) { if (menu.matches(":popover-open")) menu.hidePopover(); } else menu.hidden = true;
      const b = knopVan(k);
      if (b) { b.setAttribute("aria-expanded", "false"); if (focus) b.focus(); }
    };
    const menuOpnieuw = (focusId) => {
      toepassen();
      menu.innerHTML = menuInhoud(openKol);
      plaats();
      const el = (focusId && document.getElementById(focusId)) || menu.querySelector("input");
      if (el) el.focus({ preventScroll: true });
    };
    menu.addEventListener("change", (e) => {
      const cb = e.target.closest("input[type=checkbox]");
      if (!cb || !openKol) return;
      f[openKol] = cb.checked ? uniek([...f[openKol], cb.value]) : f[openKol].filter((x) => x !== cb.value);
      menuOpnieuw(cb.id);
    });
    menu.addEventListener("click", (e) => {
      const w = e.target.closest("[data-wis]");
      if (w) { f[w.dataset.wis] = []; menuOpnieuw(); }
    });
    // focus die het menu verlaat (Tab) sluit het, behalve naar een andere filterkop
    menu.addEventListener("focusout", (e) => {
      const n = e.relatedTarget;
      if (openKol && n && !menu.contains(n) && !n.closest("#mkop button[data-filter]")) sluitMenu(false);
    });
    document.addEventListener("pointerdown", (e) => {
      if (openKol && !menu.contains(e.target) && !e.target.closest("#mkop button[data-filter]")) sluitMenu(false);
    }, sig);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && openKol) { e.preventDefault(); sluitMenu(true); } }, sig);
    window.addEventListener("scroll", plaats, { ...sig, passive: true, capture: true });
    window.addEventListener("resize", plaats, sig);

    $("#mq").addEventListener("input", (e) => { f.q = e.target.value; toepassen(); });
    $("#mkop").addEventListener("click", (e) => {
      const fb = e.target.closest("button[data-filter]");
      if (fb) { if (openKol === fb.dataset.filter) sluitMenu(true); else openMenu(fb.dataset.filter); return; }
      if (e.target.closest("button[data-sort]")) {
        f.richting = f.richting === "asc" ? "desc" : "asc";
        sluitMenu(false);
        toepassen();
        $("#mkop button[data-sort]").focus();
      }
    });
    $("#mbody").addEventListener("click", (e) => {
      if (e.target.closest("[data-wisalles]")) {
        f.q = ""; $("#mq").value = "";
        for (const k of Object.keys(MOTIE_FILTERS)) f[k] = [];
        toepassen();
        $("#mq").focus();
        return;
      }
      const tr = e.target.closest("tr.row");
      if (!tr) return;
      const knop = e.target.closest("button.uitklap");
      if (knop) {
        const nxt = tr.nextElementSibling, open = nxt && nxt.classList.contains("detail");
        if (open) nxt.remove();
        else {
          const d = document.createElement("tr"); d.className = "detail";
          d.innerHTML = `<td colspan="7">${motieDetail(rows[+tr.dataset.i])}</td>`;
          tr.after(d);
        }
        tr.classList.toggle("open", !open);
        knop.setAttribute("aria-expanded", String(!open));
        knop.setAttribute("aria-label", open ? "Stemming per fractie tonen" : "Stemming per fractie verbergen");
        return;
      }
      // de titel is zelf de link; elders in de rij doet de klik hetzelfde (niet bij tekst selecteren)
      if (e.target.closest("a, td.knopcel")) return;
      if (String(window.getSelection && window.getSelection()).trim()) return;
      window.open(tr.querySelector("a.ltitel").href, "_blank", "noopener");
    });
    toepassen();
  }
  // "A, B en C"
  const opsomming = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} en ${xs[xs.length - 1]}` : xs.join(""));
  // Uitgeklapte rij: alleen de kenmerken, de stemverhouding, de fracties voor en tegen, en de twee links.
  function motieDetail(z) {
    const b = [...z.besluiten].reverse().find((x) => x.stemmen.length), t = z.stemtelling;
    // elke fractie één keer, ook bij een hoofdelijke stemming (daar staat elk Kamerlid apart in de data)
    const fracties = (soort) => uniek(b.stemmen.filter((s) => s.soort === soort).map((s) => s.fractie)).sort(nlSort.compare);
    const blok = (label, fs) => `<div><div class="k">${label}:</div><div>${fs.length ? fs.map(esc).join(", ") : `<span class="muted">geen</span>`}</div></div>`;
    const eerste = eersteIndiener(z), door = [eerste, ...z.indieners.filter((i) => i !== eerste)].filter(Boolean).map((i) => `${esc(i.naam)}${i.fractie ? ` (${esc(i.fractie)})` : ""}`);
    return `<div class="mdetail">
      <p>Zaak <span class="mono">${esc(z.nummer)}</span>${z.document ? ` · document <span class="mono">${esc(z.document)}</span>` : ""} · ingediend ${fmtKort(z.gestartOp)}${door.length ? `, door ${opsomming(door)}` : ""}</p>
      ${b && t ? `<div class="mstemming"><p class="mtelling">Voor ${nl(t.voor)} / Tegen ${nl(t.tegen)}</p>
        <div class="mstemmen">${blok("Voor", fracties("Voor"))}${blok("Tegen", fracties("Tegen"))}</div></div>` : `<p class="muted">Nog geen stemming</p>`}
      <div class="mlinks"><a href="${esc(tkUrl(z))}" target="_blank" rel="noopener">Bekijk op tweedekamer.nl</a><a href="${esc(z.link)}" target="_blank" rel="noopener">Bekijk op OpenTK</a></div>
    </div>`;
  }

  /* ---------- Stukken van ministeries ---------- */
  const SOORT_KORT = { "Brief regering": "Kamerbrief", "Antwoord schriftelijke vragen": "Antwoord Kamervragen", "Antwoord schriftelijke vragen (nader)": "Antwoord Kamervragen" };
  const stukkenInSector = () => (S.data.stukken || []).filter(inSector).slice().sort((a, b) => (b.datum || "").localeCompare(a.datum || ""));
  function sectorNaam(code) { return (S.data.config.sectoren[code] || {}).naam || code; }
  function stukLi(x) {
    const dossier = (x.dossiers || [])[0];
    return `<li><div class="regelmeta"><span class="tag">${esc(SOORT_KORT[x.soort] || x.soort)}</span><span class="datum">${fmtKort(x.datum)}</span><span>${esc(x.ministerie || "ministerie onbekend")}</span></div>
      <div><a class="ltitel" href="${esc(x.link)}" target="_blank" rel="noopener">${esc(x.onderwerp || x.titel)}</a></div>
      <div class="small muted">${dossier ? `<span class="mono">${esc(x.kamerstuk || dossier.nummer)}</span> ${esc(dossier.titel || "")}` : `<span class="mono">${esc(x.id)}</span>`}</div>${themaChips(themasVanStuk(x))}</li>`;
  }
  function stukken() {
    const all = stukkenInSector();
    const f = S.stukFilter;
    const ministeries = [...new Set(all.map((x) => x.ministerie).filter(Boolean))].sort();
    const opt = (v, l, cur) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(l)}</option>`;
    return `<h2>Stukken van ministeries</h2>
      <p class="small muted">Kamerbrieven en antwoorden op Kamervragen sinds het begin van de Kamerperiode die over milieu, klimaat, energie, water, natuur of leefomgeving gaan. Een stuk staat hier als het in een relevant Kamerstukdossier zit of als de titel een trefwoord bevat; alle brieven van het ministerie van Klimaat en Groene Groei staan erin. De selectie is automatisch en kan dus iets te ruim of te krap zijn.</p>
      <div class="filters">
        <input type="search" id="sq" placeholder="Zoek op onderwerp, Kamerstuk of bewindspersoon" value="${esc(f.q)}" aria-label="Zoeken">
        <select id="ssoort" aria-label="Soort">${opt("", "Alle soorten", f.soort)}${opt("Brief regering", "Kamerbrieven", f.soort)}${opt("Antwoord", "Antwoorden op Kamervragen", f.soort)}</select>
        <select id="sministerie" aria-label="Ministerie">${opt("", "Alle ministeries", f.ministerie)}${ministeries.map((m) => opt(m, m, f.ministerie)).join("")}</select>
      </div>
      <div class="small muted telregel" id="scount"></div>
      <div class="card"><ul class="list" id="slijst"></ul><div id="smeer"></div></div>`;
  }
  function bindStukken() {
    const f = S.stukFilter;
    const upd = (reset) => {
      if (reset) f.max = 100;
      f.q = $("#sq").value; f.soort = $("#ssoort").value; f.ministerie = $("#sministerie").value;
      const q = f.q.toLowerCase();
      const rows = stukkenInSector().filter((x) =>
        (!f.soort || (x.soort || "").startsWith(f.soort)) && (!f.ministerie || x.ministerie === f.ministerie) &&
        (!q || `${x.onderwerp} ${x.titel} ${x.ondertekenaar} ${x.kamerstuk} ${(x.dossiers || []).map((d) => d.nummer + " " + (d.titel || "")).join(" ")}`.toLowerCase().includes(q)));
      $("#scount").textContent = `${nl(rows.length)} ${rows.length === 1 ? "stuk" : "stukken"}`;
      $("#slijst").innerHTML = rows.slice(0, f.max).map(stukLi).join("") || `<li class="empty">Geen stukken gevonden</li>`;
      $("#smeer").innerHTML = rows.length > f.max ? `<div class="kaartvoet"><button type="button" class="chip" id="smeerknop">Toon meer <span class="n">${nl(rows.length - f.max)} over</span></button></div>` : "";
      const k = $("#smeerknop"); if (k) k.addEventListener("click", () => { f.max += 100; upd(false); });
    };
    ["#sq", "#ssoort", "#sministerie"].forEach((sel) => $(sel).addEventListener("input", () => upd(true)));
    upd(false);
  }

  /* ---------- Debatten ---------- */
  const activiteitVan = (d) => S.data.activiteiten.find((a) => a.Nummer === d.activiteit);
  function samengevatVoor(a) {
    return S.data.debatten.find((d) => d.activiteit === a.Nummer || (d.extraActiviteiten || []).includes(a.Nummer)) ||
      S.data.debatten.find((d) => !d.activiteit && d.datum === (a.Datum ? dagNL(new Date(a.Datum)) : "") && d.type === a.Soort);
  }

  function stukRegel(st) {
    const wie = st.ondertekenaar ? ` - ${esc(st.ondertekenaar)}${st.functie ? ", " + esc(st.functie) : ""}` : "";
    return `<li>${st.kamerstuk ? `<a href="${esc(st.link)}" target="_blank" rel="noopener">${esc(st.kamerstuk)}</a> ` : `<a href="${esc(st.link)}" target="_blank" rel="noopener">document</a> `}${esc(st.soort || "")}${st.datum ? ` d.d. ${fmtDatum(st.datum)}` : ""}${wie}: ${esc(st.onderwerp || "")}</li>`;
  }

  /* ---------- Agenda ---------- */
  function agendaItems() {
    const eigen = S.data.agenda.filter(inSector).map((i) => ({ ...i, bron: "eigen" }));
    const kamer = S.data.activiteiten.filter((a) => inSector(a) && a.Status === "Gepland").map((a) => ({
      datum: a.Datum ? dagNL(new Date(a.Datum)) : null, tijd: a.Aanvangstijd ? tijdNL(a.Aanvangstijd) : null,
      type: soortLabel(a), titel: a.Onderwerp, url: a.tkLink || `https://berthub.eu/tkconv/activiteit.html?nummer=${a.Nummer}`, bron: "tk", commissie: commissieNaam(a), _act: a,
    }));
    const seen = new Set();
    return [...eigen, ...kamer].filter((i) => { const k = `${i.datum}|${(i.titel || "").toLowerCase().slice(0, 20)}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => sortKey(a.datum).localeCompare(sortKey(b.datum)));
  }
  function agendaLi(i) {
    return `<li><div class="regelmeta"><span class="datum">${fmtKort(i.datum)}${i.tijd ? ` ${esc(i.tijd)}` : ""}</span><span class="tag">${esc(i.type)}</span></div><div>${i.url ? `<a class="ltitel" href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.titel)}</a>` : `<span class="ltitel">${esc(i.titel)}</span>`}</div>${i.commissie ? `<div class="small muted">${esc(i.commissie)}</div>` : ""}</li>`;
  }
  /* ---------- Thema's, commissies en ministeries ---------- */
  const TYPE_NORM = { "Plenair debat (tweeminutendebat)": "Tweeminutendebat", "Plenair debat (debat)": "Plenair debat", "Plenair debat (dertigledendebat)": "Dertigledendebat", "Plenair debat (initiatiefwetgeving)": "Plenair debat (wetgeving)" };
  const typeNaam = (s) => TYPE_NORM[s] || s || "Overig";
  function ministerieUitFunctie(f) {
    if (!f) return null;
    if (/^minister-president/i.test(f)) return "Algemene Zaken";
    const m = /^(?:minister|staatssecretaris)(?: van staat)? (?:van|voor) (.+)$/i.exec(f.trim());
    return m ? m[1].replace(/^(de|het) /i, "") : null;
  }
  const _ministerieCache = new Map();
  function ministeriesVan(a) {
    if (!a) return [];
    if (_ministerieCache.has(a.Nummer)) return _ministerieCache.get(a.Nummer);
    const uit = uniek([...(a.bewindspersonen || []).map((b) => ministerieUitFunctie(b.functie)),
      ...(a.agendapunten || []).flatMap((ap) => (ap.stukken || []).map((st) => ministerieUitFunctie(st.functie)))].filter(Boolean)).sort();
    _ministerieCache.set(a.Nummer, uit);
    return uit;
  }
  const _themaCache = new Map();
  // Thema's per item: de goedgekeurde mapping (data/themas-mapping.json) gaat voor de regels (data/themas.json); zie assets/themas.js.
  const TS = window.MRThemas.sleutel;
  function themasVanAct(a) {
    if (!a) return [];
    if (!_themaCache.has(a.Nummer)) _themaCache.set(a.Nummer, S.T.item(TS.debat(a.Nummer), a.Onderwerp, (a.agendapunten || []).map((ap) => ap.onderwerp)));
    return _themaCache.get(a.Nummer);
  }
  function themasVanDebat(d) {
    const sl = TS.debat(d.activiteit || d.id);
    if (S.T.inMapping(sl)) return S.T.item(sl);
    if (d.themas && d.themas.length) return d.themas;
    const a = activiteitVan(d);
    return S.T.voor(d.titel, (a?.agendapunten || []).map((ap) => ap.onderwerp));
  }
  const themasVanZaak = (z) => S.T.item(TS.zaak(z), window.MRThemas.korteTitel(z), [], (z.dossiers || []).map((d) => d.titel));
  const themasVanStuk = (x) => S.T.item(TS.stuk(x), window.MRThemas.stukTitel(x), [], (x.dossiers || []).map((d) => d.titel));
  const themasVanAgendaItem = (i) => S.T.item(TS.agenda(i), i.titel, []);
  function themaChips(ids, klikbaar) {
    if (!ids || !ids.length) return "";
    return `<span class="tchips">${ids.map((id) => klikbaar
      ? `<button type="button" class="tchip" data-vthema="${esc(id)}" aria-pressed="${!!(S.af && opAgenda() && S.af.thema.includes(id))}" title="Filter de agenda op ${esc(S.T.naam(id))}">${esc(S.T.naam(id))}</button>`
      : `<span class="tchip">${esc(S.T.naam(id))}</span>`).join("")}</span>`;
  }
  const opAgenda = () => location.hash.slice(1).split(/[/?]/)[0] === "agenda";
  const arr = (x) => (Array.isArray(x) ? x : x ? [x] : []);

  // Escape sluit een open filtermenu en zet de focus terug op de knop
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const open = document.querySelector("details.facet[open]");
    if (open) { open.open = false; S.aOpen = ""; open.querySelector("summary").focus(); }
  });
  // klik buiten een open filtermenu sluit het
  document.addEventListener("click", (e) => {
    if (e.target.closest("details.facet")) return;
    document.querySelectorAll("details.facet[open]").forEach((d) => { d.open = false; });
    S.aOpen = "";
  });
  /* ---------- Moties bij vergaderingen ---------- */
  // Een motie hoort bij een plenaire vergadering (of wetgevings-/notaoverleg) op de dag van indienen of de dag ervoor,
  // als het Kamerstukdossier van de motie op de agenda van die vergadering staat. Twijfelgevallen worden niet gekoppeld.
  // Een tweeminutendebat "X (CD d/m)" wordt gekoppeld aan het commissiedebat X van die datum.
  let _mk = null;
  function motieKoppeling() {
    if (_mk) return _mk;
    const plenair = S.data.activiteiten.filter((a) => a.Datum && (/^Plenair/.test(a.Soort) || ["Wetgevingsoverleg", "Notaoverleg"].includes(a.Soort)));
    const perDag = new Map();
    for (const a of plenair) { const d = dagNL(new Date(a.Datum)); if (!perDag.has(d)) perDag.set(d, []); perDag.get(d).push(a); }
    const nums = (a) => {
      const s = new Set();
      for (const ap of a.agendapunten || []) for (const st of ap.stukken || []) if (st.kamerstuk) s.add(st.kamerstuk.split("-")[0]);
      for (const m of (a.Onderwerp || "").replace(/(\d{2}) (\d{3})/g, "$1$2").matchAll(/\b(\d{5})\b/g)) s.add(m[1]);
      return s;
    };
    const perAct = new Map(), actVanMotie = new Map();
    for (const z of S.data.zaken) {
      if (z.soort !== "Motie" || !z.gestartOp) continue;
      const dn = new Set(z.dossiers.map((x) => String(x.nummer)));
      const kand = [...(perDag.get(z.gestartOp) || []), ...(perDag.get(plusDagen(z.gestartOp, -1)) || [])];
      const hit = kand.filter((a) => [...nums(a)].some((n) => dn.has(n)));
      if (hit.length !== 1) continue;
      const nr = hit[0].Nummer;
      if (!perAct.has(nr)) perAct.set(nr, []);
      perAct.get(nr).push(z);
      actVanMotie.set(z.nummer, hit[0]);
    }
    // tweeminutendebat -> commissiedebat
    const tmdNaarCd = new Map(), cdNaarTmd = new Map();
    const normT = (s) => (s || "").toLowerCase().replace(/\(.*?\)/g, "").replace(/^tweeminutendebat\s*/, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    const cds = S.data.activiteiten.filter((a) => a.Soort === "Commissiedebat" && a.Datum);
    for (const t of S.data.activiteiten.filter((a) => /tweeminutendebat/i.test(a.Soort) || /^Tweeminutendebat/i.test(a.Onderwerp || ""))) {
      const m = /\(CD (\d{1,2})\/(\d{1,2})\)/.exec(t.Onderwerp || "");
      if (!m) continue;
      const naam = normT(t.Onderwerp);
      const cd = cds.filter((c) => { const d = new Date(c.Datum); return d.getDate() === +m[1] && d.getMonth() + 1 === +m[2] && c.Datum <= (t.Datum || "9999"); })
        .find((c) => { const n = normT(c.Onderwerp); return n && (n.startsWith(naam.slice(0, 12)) || naam.startsWith(n.slice(0, 12))); });
      if (cd) { tmdNaarCd.set(t.Nummer, cd.Nummer); if (!cdNaarTmd.has(cd.Nummer)) cdNaarTmd.set(cd.Nummer, []); cdNaarTmd.get(cd.Nummer).push(t.Nummer); }
    }
    return (_mk = { perAct, actVanMotie, tmdNaarCd, cdNaarTmd });
  }
  // alle moties bij een vergadering (inclusief het bijbehorende tweeminutendebat)
  function motiesBijActiviteiten(nrs) {
    const { perAct, cdNaarTmd } = motieKoppeling();
    const alle = uniek(nrs.filter(Boolean).flatMap((n) => [n, ...(cdNaarTmd.get(n) || [])]));
    return uniek(alle.flatMap((n) => perAct.get(n) || []));
  }
  function motieLijst(ms) {
    if (!ms.length) return "";
    const aangenomen = ms.filter((z) => z.uitslag === "aangenomen").length;
    return `<div class="small muted">${ms.length} ${ms.length === 1 ? "motie" : "moties"} ingediend, ${aangenomen} aangenomen</div>
      <ul class="motielijst">${ms.map((z) => `<li>${uitslagPill(z.uitslag)} <a href="${esc(z.link)}" target="_blank" rel="noopener">${esc(korteTitel(z))}</a> <span class="small muted">${indienersTekst(z)}</span></li>`).join("")}</ul>`;
  }

  /* ---------- Toezeggingen en fracties (hulpfuncties) ---------- */
  // status van een toezegging uit het register van de Kamer; zonder status komt de toezegging uit onze samenvatting
  function statusPill(s) {
    if (!s) return `<span class="status uit-samenvatting" title="Uit onze samenvatting van het transcript; staat (nog) niet in het register van de Kamer"><span class="dot" aria-hidden="true"></span>Uit samenvatting</span>`;
    const cls = /^afgedaan/i.test(s) ? "afgedaan" : "openstaand";
    return `<span class="status ${cls}"><span class="dot" aria-hidden="true"></span>${esc(hoofd(s.toLowerCase()))}</span>`;
  }
  // GroenLinks-PvdA is voortgezet als PRO en telt daarom mee bij PRO.
  const FRACTIE_ALIAS = { "GroenLinks-PvdA": "PRO", "GL-PvdA": "PRO", "GroenLinks": "PRO", "PvdA": "PRO" };
  const fractieNaam = (f) => { const n = String(f || "").replace(/\s*\(.*\)\s*$/, "").replace(/^Lid\s+/i, "").trim(); return FRACTIE_ALIAS[n] || n; };

  /* ---------- Agenda: tijdlijn van vergaderingen, met samenvattingen ---------- */
  // Eén pagina voor wat komt en wat is geweest: geplande en uitgevoerde Kameractiviteiten, samengevatte vergaderingen
  // en eigen mijlpalen (data/agenda.json). Standaard vanaf vandaag, bovenaan beginnend; Terugblik toont alleen wat is geweest, nieuwste eerst.
  // Filters staan in de URL: #agenda?thema=adaptatie&type=Commissiedebat&terugblik=1.
  // #agenda/d-<samenvatting-id> en #agenda/a-<activiteitnummer> openen die dag, met de samenvatting uitgeklapt.
  const isDatum = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || "");
  function maandagVan(dag) { const d = new Date(dag + "T12:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dagNL(d); }
  function plusDagen(dag, n) { const d = new Date(dag + "T12:00:00"); d.setDate(d.getDate() + n); return dagNL(d); }
  function weekNr(dag) { const d = new Date(dag + "T12:00:00"); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); const j = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d - j) / 864e5 - 3 + ((j.getDay() + 6) % 7)) / 7); }
  let _ti = null;
  const tkActLink = (a) => a.tkLink || `https://berthub.eu/tkconv/activiteit.html?nummer=${a.Nummer}`;
  function tijdlijnItems() {
    if (_ti) return _ti;
    const acts = S.data.activiteiten.filter((a) => a.Datum && (a.Status === "Gepland" || a.Status === "Uitgevoerd"));
    const nummers = new Set(acts.map((a) => a.Nummer));
    const getoond = new Set();
    const items = acts.map((a) => {
      const sam = samengevatVoor(a);
      // hoort een samenvatting bij meer activiteiten, dan staat ze bij de hoofdactiviteit; de andere verwijzen ernaar
      const hier = !!sam && !getoond.has(sam.id) && (!sam.activiteit || sam.activiteit === a.Nummer || !nummers.has(sam.activiteit));
      if (hier) getoond.add(sam.id);
      const t = a.Aanvangstijd || a.Datum;
      return { id: hier ? "d-" + sam.id : "a-" + a.Nummer, datum: dagNL(new Date(a.Datum)), t, tijd: ((x) => (x === "00:00" ? "" : x))(tijdNL(t)),
        type: typeNaam(a.Soort), titel: a.Onderwerp, commissie: commissieNaam(a), ministerie: uniek([...ministeriesVan(a), ...((sam && sam.ministeries) || [])]),
        a, sam, samHier: hier, gepland: a.Status === "Gepland", thema: sam ? themasVanDebat(sam) : themasVanAct(a), url: tkActLink(a) };
    });
    // samenvattingen zonder (gevonden) Kameractiviteit
    for (const d of S.data.debatten) {
      if (getoond.has(d.id) || !isDatum(d.datum)) continue;
      items.push({ id: "d-" + d.id, datum: d.datum, t: d.datum, tijd: "", type: typeNaam(d.type), titel: d.titel, commissie: d.commissie || "",
        ministerie: d.ministeries || [], sam: d, samHier: true, gepland: false, thema: themasVanDebat(d), url: d.tkLink || "" });
    }
    const sleutels = new Set(items.map((x) => x.datum + "|" + x.titel.toLowerCase().slice(0, 20)));
    const eigen = S.data.agenda.filter((i) => !sleutels.has((i.datum || "") + "|" + (i.titel || "").toLowerCase().slice(0, 20))).map((i) => ({
      id: "", datum: i.datum, t: i.datum || "", tijd: i.tijd || "", type: i.type || "Mijlpaal", titel: i.titel, eigen: true, url: i.url,
      commissie: "", ministerie: [], thema: themasVanAgendaItem(i), gepland: true }));
    return (_ti = { vast: [...items, ...eigen.filter((i) => isDatum(i.datum))].sort((a, b) => a.t.localeCompare(b.t)), vaag: eigen.filter((i) => !isDatum(i.datum)).sort((a, b) => sortKey(a.datum).localeCompare(sortKey(b.datum))) });
  }
  const geweest = (i) => i.datum < VANDAAG || (!i.gepland && !i.eigen);

  const AGENDA_FACETTEN = [["type", "Type"], ["commissie", "Commissie"], ["ministerie", "Ministerie"], ["thema", "Thema"]];
  const facetLabel = (f, v) => (f === "thema" ? S.T.naam(v) : v);
  function leesAF() {
    const p = new URLSearchParams(location.hash.split("?")[1] || "");
    const lijst = (k) => (p.get(k) ? p.get(k).split(",").filter(Boolean) : []);
    S.af = { type: lijst("type"), commissie: lijst("commissie"), ministerie: lijst("ministerie"), thema: lijst("thema"), terug: p.get("terugblik") === "1" };
  }
  function afUrl() {
    const p = [];
    for (const [f] of AGENDA_FACETTEN) if (S.af[f].length) p.push(`${f}=${S.af[f].map(encodeURIComponent).join(",")}`);
    if (S.af.terug) p.push("terugblik=1");
    return "#agenda" + (p.length ? "?" + p.join("&") : "");
  }
  const afGefilterd = () => AGENDA_FACETTEN.some(([f]) => S.af[f].length);
  function afToepassen() { history.replaceState(null, "", afUrl()); renderAgenda(); }
  const afPast = (i, behalve) => AGENDA_FACETTEN.every(([f]) => f === behalve || !S.af[f].length || arr(i[f]).some((v) => S.af[f].includes(v)));

  // uitgeklapte samenvattingen blijven open als de lijst opnieuw wordt getekend (filter, eerder laden)
  const samOpen = new Set();
  function zetOpen(k, open) {
    k.classList.toggle("open", open);
    k.querySelector(".toggle").setAttribute("aria-expanded", String(open));
    if (open) samOpen.add(k.id); else samOpen.delete(k.id);
    // bij inklappen de vergadering in beeld houden, zodat je niet ergens verderop in de lijst belandt
    if (!open && k.getBoundingClientRect().top < 0) k.scrollIntoView({ block: "start" });
  }
  document.addEventListener("click", (e) => {
    const t = e.target.closest(".debat .toggle, .debat [data-inklap]");
    if (!t) return;
    const k = t.closest(".debat");
    zetOpen(k, !k.classList.contains("open"));
    if (t.matches("[data-inklap]")) k.querySelector(".toggle").focus({ preventScroll: true });
  });

  function agenda() {
    leesAF();
    const sub = location.hash.split("?")[0].split("/")[1] || "";
    let doel = null;
    if (sub) {
      const { vast } = tijdlijnItems();
      doel = vast.find((i) => i.id === sub) || vast.find((i) => i.a && "a-" + i.a.Nummer === sub) || null;
      if (doel && doel.sam && !doel.samHier) doel = vast.find((i) => i.sam === doel.sam && i.samHier) || doel;
      // een vergadering die is geweest staat in Terugblik
      if (doel && doel.datum < VANDAAG && !S.af.terug) { S.af.terug = true; history.replaceState(null, "", location.hash.split("?")[0] + afUrl().slice("#agenda".length)); }
    }
    setTimeout(() => {
      renderAgenda();
      const el = doel && document.getElementById(doel.id);
      if (el) { if (el.classList.contains("debat")) zetOpen(el, true); el.scrollIntoView({ block: "start" }); }
    }, 0);
    return `<div class="agendakop"><h2>Agenda</h2><div id="agendaknoppen" class="agendaknoppen"></div></div>
      <div id="agendafilters"></div><div id="agendawrap"></div>`;
  }

  function samenvattingBlok(d) {
    const s = d.samenvatting || {};
    const a = activiteitVan(d) || {};
    const lijst = (a2) => `<ul>${a2.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
    const blok = (t, inhoud) => (inhoud ? `<section><h4>${t}</h4>${inhoud}</section>` : "");
    const aps = (a.agendapunten || []).filter((ap) => ap.stukken.length || !/:\s*$/.test(ap.onderwerp || ""));
    const agendapunten = aps.length
      ? `<ol class="agendapunten">${aps.map((ap) => `<li><b>${esc(ap.onderwerp)}</b>${ap.stukken.length ? `<div class="small muted">Te behandelen:</div><ul class="stukken">${ap.stukken.map(stukRegel).join("")}</ul>` : ""}</li>`).join("")}</ol>` : "";
    const bewinds = a.bewindspersonen || [];
    const deelnemers = [
      bewinds.length ? `<div><h5>${bewinds.length > 1 ? "Bewindspersonen" : "Bewindspersoon"}</h5>${bewinds.map((b) => `<div>${esc(b.naam)}<div class="small muted">${esc(b.functie || "")}</div></div>`).join("")}</div>` : "",
      a.voorzitter ? `<div><h5>Voorzitter</h5><div>${esc(a.voorzitter.naam)}${a.voorzitter.fractie ? ` (${esc(a.voorzitter.fractie)})` : ""}</div></div>` : "",
      (d.deskundigen || []).length ? `<div><h5>Deskundigen</h5>${d.deskundigen.map((x) => `<div>${esc(x.naam)}<div class="small muted">${esc(x.organisatie || "")}</div></div>`).join("")}</div>` : "",
      (a.deelnemers || []).length ? `<div><h5>Deelnemers</h5>${a.deelnemers.map((x) => `<div>${esc(x.naam)}${x.fractie ? ` (${esc(x.fractie)})` : x.functie ? ` <span class="small muted">${esc(x.functie)}</span>` : ""}</div>`).join("")}</div>` : "",
    ].join("");
    const standpunten = (s.partijen || []).map((p) => `<div class="party"><b>${esc(p.fractie)}</b> <span class="muted small">${esc(p.spreker)}</span><div>${esc(p.positie)}</div>${p.link ? `<a class="small" href="${esc(p.link)}" target="_blank" rel="noopener">Terugluisteren</a>` : ""}</div>`).join("")
      + ((s.kabinet || []).length ? `<div class="party"><b>Kabinet</b> <span class="muted small">${esc(d.bewindspersoon || "")}</span>${lijst(s.kabinet)}</div>` : "");
    const officieel = (S.data.toezeggingen || []).filter((t) => [d.activiteit, ...(d.extraActiviteiten || [])].includes(t.activiteit));
    const toezeggingen = (officieel.length
      ? `<ul class="tzlijst">${officieel.map((t) => `<li>${statusPill(t.status)} ${esc(t.tekst)} <span class="small muted">(${esc(t.bewindspersoon)})</span></li>`).join("")}</ul><div class="small muted">Uit het toezeggingenregister van de Kamer.</div>`
      : (s.toezeggingen || []).length ? lijst(s.toezeggingen) : "") +
      ((s.doorgeleid || []).length ? `<div class="small muted">Doorgeleid:</div>${lijst(s.doorgeleid)}` : "");
    const id = esc(d.id), open = samOpen.has("d-" + d.id);
    return `<button type="button" class="toggle" aria-expanded="${open}" aria-controls="b-${id}"><span class="pijltje" aria-hidden="true"></span><span class="dicht">Toon samenvatting</span><span class="opn">Verberg samenvatting</span></button>
      <div class="body-wrap"><div class="body" id="b-${id}">
        <div class="sam-raster"><div class="sam-hoofd">
        <div class="links">${d.video ? `<a href="${esc(d.video)}" target="_blank" rel="noopener">Terugkijken op Debat Direct</a>` : ""}${d.bron ? `<a href="${esc(d.bron)}" target="_blank" rel="noopener">Transcript</a>` : ""}</div>
        ${blok("Aanzet", d.aanzet ? `<p>${esc(d.aanzet)}</p>` : "")}
        ${blok("Kern", `<p>${esc(d.gist)}</p>${(s.kern || []).length ? lijst(s.kern) : ""}`)}
        ${blok("Standpunten fracties", standpunten)}
        ${blok("Toezeggingen", toezeggingen || `<p class="muted">Geen toezeggingen</p>`)}
        ${blok("Moties", (s.moties ? `<p>${esc(s.moties)}</p>` : "") + motieLijst(motiesBijActiviteiten([d.activiteit, ...(d.extraActiviteiten || [])])))}
        ${blok("Vervolg", (s.vervolg || []).length ? lijst(s.vervolg) : "")}
        </div><div class="sam-zij">
        ${blok("Agendapunten", agendapunten)}
        ${blok("Deelnemers", deelnemers ? `<div class="deelnemers">${deelnemers}</div>` : "")}
        </div></div>
        <div class="peil voetregel">${d.niveau === "kort" ? "Korte samenvatting" : "Samenvatting"} · ${esc(d.samengevatDoor)} · ${fmtKort(d.samengevatOp)} · op basis van het automatische transcript</div>
        <button type="button" class="linkknop inklap" data-inklap>Samenvatting inklappen</button>
      </div></div>`;
  }

  function renderAgenda() {
    const el = $("#agendawrap");
    if (!el) return;
    const { vast, vaag } = tijdlijnItems();
    const start = S.data.config.startdatum || "2025-11-12";
    const terug = S.af.terug;
    // binnen het zichtbare bereik; daarover gaan ook de aantallen in de filtermenu's
    const bereik = terug ? vast.filter(geweest) : vast.filter((i) => i.datum >= VANDAAG);
    const items = bereik.filter((i) => afPast(i));
    const nu = new Date();
    const eerst = terug ? null : vast.find((i) => i.gepland && !i.eigen && afPast(i) && i.a && new Date(i.a.Datum) >= nu);
    // per week, per dag
    const weken = new Map();
    const voeg = (dag, item) => {
      const w = maandagVan(dag);
      if (!weken.has(w)) weken.set(w, new Map());
      const dagen = weken.get(w);
      if (!dagen.has(dag)) dagen.set(dag, []);
      if (item) dagen.get(dag).push(item);
    };
    for (const i of items) voeg(i.datum, i);
    if (!terug) voeg(VANDAAG, null);
    const dezeWeek = maandagVan(VANDAAG);
    const volgorde = (a, b) => (terug ? b.localeCompare(a) : a.localeCompare(b));
    const regel = (i) => {
      const voorbij = !i.gepland && !i.eigen;
      const extern = i.url && !i.url.startsWith("#");
      const titel = i.url ? `<a href="${esc(i.url)}" ${extern ? 'target="_blank" rel="noopener"' : ""}>${esc(i.titel)}</a>` : esc(i.titel);
      const metSam = !!(i.sam && i.samHier);
      const ms = !metSam && !i.sam && !i.gepland && i.a ? motiesBijActiviteiten([i.a.Nummer]) : [];
      const extra = metSam ? samenvattingBlok(i.sam)
        : i.sam ? `<div class="tl-verwijs small"><a href="#agenda/d-${esc(i.sam.id)}">Samenvatting bij ${esc(i.sam.titel)}</a></div>`
        : ms.length ? `<details class="motiedetails"><summary>${ms.length} ${ms.length === 1 ? "motie" : "moties"} (${ms.filter((z) => z.uitslag === "aangenomen").length} aangenomen)</summary>${motieLijst(ms)}</details>` : "";
      return `<li class="tl-item${voorbij ? " voorbij" : ""}${i === eerst ? " eerst" : ""}${i.eigen ? " mijlpaal" : ""}${metSam ? " debat" : ""}${metSam && samOpen.has(i.id) ? " open" : ""}"${i.id ? ` id="${esc(i.id)}"` : ""}>
        <div class="tl-tijd">${esc(i.tijd || "")}</div>
        <div class="tl-inhoud">
          <div class="tl-meta"><span class="tag">${esc(i.type)}</span>${i === eerst ? `<span class="badge alarm">Eerstvolgend</span>` : ""}${i.commissie ? `<span>${esc(i.commissie)}</span>` : ""}${metSam && i.sam.niveau === "kort" ? `<span class="badge stil" title="Korte samenvatting: alleen de hoofdlijn">Kort</span>` : ""}</div>
          <div class="tl-titel">${titel}</div>
          ${i.thema.length ? `<div class="kaartlabels">${themaChips(i.thema, true)}</div>` : ""}
          ${extra}
        </div></li>`;
    };
    const weekHtml = [...weken.entries()].sort((a, b) => volgorde(a[0], b[0])).map(([w, dagen]) => {
      const eind = plusDagen(w, 6);
      const label = w === dezeWeek ? "Deze week" : w === plusDagen(dezeWeek, 7) ? "Volgende week" : w === plusDagen(dezeWeek, -7) ? "Vorige week" : "";
      const n = [...dagen.values()].reduce((s, l) => s + l.length, 0);
      return `<section class="tl-week ${w < dezeWeek ? "verleden" : ""}">
        <h3 class="tl-weekkop">Week ${weekNr(w)}${label ? ` <span class="weeklabel">${label}</span>` : ""} <span class="muted">${+w.slice(8)} ${MAANDEN_KORT[+w.slice(5, 7) - 1]} t/m ${+eind.slice(8)} ${MAANDEN_KORT[+eind.slice(5, 7) - 1]} ${eind.slice(0, 4)}</span> <span class="muted small">${n} ${n === 1 ? "item" : "items"}</span></h3>
        ${[...dagen.entries()].sort((a, b) => volgorde(a[0], b[0])).map(([dag, l]) => {
          const d = new Date(dag + "T12:00:00");
          const isV = dag === VANDAAG;
          return `<div class="tl-dag ${isV ? "vandaag" : ""} ${dag < VANDAAG ? "verleden" : ""}" ${isV ? 'id="vandaag"' : ""}>
            <div class="tl-datum"><div class="wd">${isV ? "Vandaag" : WEEKDAGEN[d.getDay()].slice(0, 2)}</div><div class="dn">${+dag.slice(8)}</div><div class="mn">${MAANDEN_KORT[+dag.slice(5, 7) - 1]}</div></div>
            <ul class="tl-lijst">${l.length ? l.sort((a, b) => a.t.localeCompare(b.t)).map(regel).join("") : `<li class="tl-item leeg muted">${afGefilterd() ? "Niets met deze filters vandaag" : "Geen vergaderingen vandaag"}</li>`}</ul>
          </div>`;
        }).join("")}
      </section>`;
    }).join("");

    // naast de titel alleen de weergave; in beide weergaven dezelfde knoppen
    $("#agendaknoppen").innerHTML = `
      <div class="agendamodus" role="group" aria-label="Weergave">
        <button type="button" class="chip" data-modus="" aria-pressed="${!terug}">Vanaf vandaag</button>
        <button type="button" class="chip" data-modus="terug" aria-pressed="${terug}">Terugblik</button>
      </div>`;
    document.querySelectorAll("#agendaknoppen [data-modus]").forEach((b) => b.addEventListener("click", () => {
      const t = b.dataset.modus === "terug";
      if (t === S.af.terug) return;
      S.af.terug = t;
      afToepassen();
      window.scrollTo(0, 0);
      $(`#agendaknoppen [data-modus="${b.dataset.modus}"]`).focus({ preventScroll: true });
    }));

    renderAgendaFilters(bereik);

    const vaagHier = terug ? [] : vaag.filter((i) => afPast(i));
    el.innerHTML = `
      ${afGefilterd() ? `<p class="small muted telregel">${nl(items.length)} ${items.length === 1 ? "item" : "items"} ${terug ? "sinds het begin van de Kamerperiode" : "vanaf vandaag"}</p>` : ""}
      <div class="tijdlijn">${weekHtml || `<p class="empty">${afGefilterd() ? `Niets met deze filters <button type="button" class="linkknop" data-wisalles>Filters wissen</button>` : "Niets in deze periode"}</p>`}</div>
      ${terug ? `<p class="small muted">Begin van de Kamerperiode (${fmtKort(start)})</p>` : ""}
      ${vaagHier.length ? `<h3 class="groepkop">Mijlpalen zonder vaste dag</h3><div class="card"><ul class="list">${vaagHier.map((i) => `<li><div class="regelmeta"><span class="datum">${fmtDatum(i.datum)}</span><span class="tag">${esc(i.type)}</span></div><div>${i.url ? `<a class="ltitel" href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.titel)}</a>` : `<span class="ltitel">${esc(i.titel)}</span>`}</div>${themaChips(i.thema, true)}</li>`).join("")}</ul></div>` : ""}`;
    const wisAlles = el.querySelector("[data-wisalles]");
    if (wisAlles) wisAlles.addEventListener("click", () => { for (const [f] of AGENDA_FACETTEN) S.af[f] = []; afToepassen(); });
  }

  // Filterbalk: per facet een menu met vinkjes (meerdere waarden, "of"; facetten samen "en"), met per waarde het aantal
  // onder de andere filters. Thema's in de vaste volgorde uit THEMAS, de rest op aantal.
  function renderAgendaFilters(bereik) {
    const fb = $("#agendafilters");
    if (!fb) return;
    const facet = ([f, label]) => {
      const tel = new Map();
      for (const i of bereik) if (afPast(i, f)) for (const v of arr(i[f])) tel.set(v, (tel.get(v) || 0) + 1);
      for (const v of S.af[f]) if (!tel.has(v)) tel.set(v, 0);
      const waarden = f === "thema" ? S.T.lijst.map((t) => [t.slug, tel.get(t.slug) || 0])
        : [...tel.entries()].sort((a, b) => b[1] - a[1] || nlSort.compare(a[0], b[0]));
      const n = S.af[f].length;
      return `<details class="facet" data-f="${f}" ${S.aOpen === f ? "open" : ""}>
        <summary>${label}${n ? ` <span class="facet-n">${n}</span>` : ""}</summary>
        <div class="facet-menu" role="group" aria-label="${label}">
          ${waarden.map(([v, c], k) => `<label${c ? "" : ' class="nul"'}><input type="checkbox" id="af-${f}-${k}" data-f="${f}" value="${esc(v)}" ${S.af[f].includes(v) ? "checked" : ""}>
            <span>${esc(facetLabel(f, v))}</span><span class="n">${nl(c)}</span></label>`).join("") || `<div class="muted small">Geen waarden</div>`}
        </div></details>`;
    };
    const actief = AGENDA_FACETTEN.flatMap(([f]) => S.af[f].map((v) => `<button type="button" class="chip actief" data-rm="${f}" data-v="${esc(v)}" aria-label="Filter ${esc(facetLabel(f, v))} wissen">${esc(facetLabel(f, v))}${ico("x")}</button>`));
    fb.innerHTML = `<div class="filterbalk">
        <div class="facetten">${AGENDA_FACETTEN.map(facet).join("")}</div>
        ${actief.length ? `<div class="actieve-filters">${actief.join("")}<button type="button" class="linkknop" data-wis>Alles wissen</button></div>` : ""}
      </div>`;
    fb.querySelectorAll("details.facet").forEach((d) => d.addEventListener("toggle", () => {
      if (d.open) { S.aOpen = d.dataset.f; fb.querySelectorAll("details.facet").forEach((o) => { if (o !== d) o.open = false; }); }
      else if (S.aOpen === d.dataset.f) S.aOpen = "";
    }));
    fb.querySelectorAll("input[data-f]").forEach((cb) => cb.addEventListener("change", () => {
      const f = cb.dataset.f, v = cb.value, id = cb.id;
      S.af[f] = cb.checked ? uniek([...S.af[f], v]) : S.af[f].filter((x) => x !== v);
      afToepassen();
      const terug = document.getElementById(id); if (terug) terug.focus();
    }));
    fb.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => {
      S.af[b.dataset.rm] = S.af[b.dataset.rm].filter((x) => x !== b.dataset.v);
      afToepassen();
    }));
    const wis = fb.querySelector("[data-wis]");
    if (wis) wis.addEventListener("click", () => { for (const [f] of AGENDA_FACETTEN) S.af[f] = []; afToepassen(); });
  }

  /* ---------- Zoeken ---------- */
  // De index (assets/zoek.js) wordt pas gebouwd bij de eerste zoekopdracht.
  let _zoek = null;
  const zoekIndex = () => _zoek || (_zoek = window.MRZoek.maak({ ...S.data, T: S.T }, S.data.synoniemen));
  function zoekVraag() {
    const qs = (location.hash.split("?")[1] || "");
    return new URLSearchParams(qs).get("q") || "";
  }
  function bindZoekveld() {
    const veld = $("#zoekveld"), form = $("#zoekform");
    let timer = null;
    const ga = (direct) => {
      const q = veld.value.trim();
      const nieuw = "#zoeken" + (q ? "?q=" + encodeURIComponent(q) : "");
      if (location.hash.startsWith("#zoeken")) {
        history.replaceState(null, "", nieuw);
        S.zoekMax = 30;
        if ($("#zoekres")) renderZoekResultaten(); else route();
      } else if (q.length >= 2 || direct) {
        S.zoekCat = ""; S.zoekMax = 30;
        location.hash = nieuw;
      }
    };
    veld.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => ga(false), 200); });
    form.addEventListener("submit", (e) => { e.preventDefault(); clearTimeout(timer); ga(true); });
    veld.addEventListener("keydown", (e) => { if (e.key === "Escape") { veld.value = ""; ga(false); } });
  }
  function zoeken() {
    return `<h2 class="sr-only">Zoeken</h2><div id="zoekres" aria-live="polite"></div>`;
  }
  const ZOEK_CATS = [["", "Alles"], ["debatten", "Vergaderingen"], ["wetgeving", "Wetsvoorstellen"], ["moties", "Moties & amendementen"], ["stukken", "Stukken"], ["toezeggingen", "Toezeggingen"], ["agenda", "Agenda"]];
  function renderZoekResultaten() {
    const el = $("#zoekres");
    if (!el) return;
    const q = zoekVraag().trim();
    if (!q) {
      el.innerHTML = `<h2>Zoeken</h2><div class="card zoektips">
        <p>Zoek in alle debatten, samenvattingen, wetsvoorstellen, moties, amendementen, Kamerbrieven en de agenda. </p>
        <ul>
          <li>Zoek op onderwerp, Kamerlid, fractie, bewindspersoon of Kamerstuknummer (bv. <code>36169</code>).</li>
          <li>Afkortingen werken ook: <code>KRW</code> vindt Kaderrichtlijn Water.</li>
          <li>Zet woorden tussen aanhalingstekens voor een exacte woordgroep: <code>"groen gas"</code>.</li>
          <li>Kleine tikfouten en meervouden worden herkend.</li>
        </ul></div>`;
      return;
    }
    const uit = zoekIndex().zoek(q);
    const alle = uit.resultaten;
    const tel = Object.fromEntries(ZOEK_CATS.map(([c]) => [c, c ? alle.filter((r) => r.doc.cat === c).length : alle.length]));
    if (S.zoekCat && !tel[S.zoekCat]) S.zoekCat = "";
    const lijst = S.zoekCat ? alle.filter((r) => r.doc.cat === S.zoekCat) : alle;
    const Z = zoekIndex();
    const item = ({ doc: d, termen }) => {
      const link = d.extern ? `href="${esc(d.link)}" target="_blank" rel="noopener"` : `href="${esc(d.link)}"`;
      return `<li>
        <div class="zmeta"><span class="tag">${esc(d.soort)}</span>${d.uitslag ? uitslagPill(d.uitslag) : ""}${d.cat === "toezeggingen" ? statusPill(d.status) : ""}${d.niveau === "kort" ? `<span class="badge stil">Kort</span>` : ""}${d.datum ? `<span class="datum">${fmtKort(d.datum)}</span>` : ""}${d.ministerie ? `<span>${esc(d.ministerie)}</span>` : ""}</div>
        <a class="ztitel" ${link}>${Z.markeer(d.titel, termen, esc)}${d.extern ? `<span class="sr-only"> (opent nieuwe pagina)</span>` : ""}</a>
        <div class="zfrag">${Z.fragment(d, termen, esc)}</div>${themaChips(d.themas || [])}
      </li>`;
    };
    el.innerHTML = `
      <div class="filters" role="group" aria-label="Soort resultaat">
        ${ZOEK_CATS.map(([c, l]) => `<button type="button" class="chip" data-zcat="${c}" aria-pressed="${S.zoekCat === c}" ${!tel[c] && c ? "disabled" : ""}>${esc(l)} <span class="n">${nl(tel[c])}</span></button>`).join("")}
      </div>
      <p class="small muted telregel">${nl(alle.length)} ${alle.length === 1 ? "resultaat" : "resultaten"} voor <b>${esc(q)}</b>.
        ${uit.modus === "OR" ? " Niets gevonden met al deze woorden; dit zijn resultaten met een deel ervan." : ""}
${uit.typeFilter ? ` Alleen <b>${esc(uit.typeFilter)}</b>, omdat dat woord in je zoekvraag staat.` : ""}</p>
      ${lijst.length ? `<div class="card"><ul class="list zoeklijst">${lijst.slice(0, S.zoekMax).map(item).join("")}</ul>
        ${lijst.length > S.zoekMax ? `<div class="kaartvoet"><button type="button" class="chip" id="zmeer">Toon meer <span class="n">${nl(lijst.length - S.zoekMax)} over</span></button></div>` : ""}</div>`
        : `<div class="card empty">Geen resultaten. Probeer een ander of korter woord.</div>`}`;
    el.querySelectorAll("[data-zcat]").forEach((b) => b.addEventListener("click", () => { S.zoekCat = b.dataset.zcat; S.zoekMax = 30; renderZoekResultaten(); }));
    const meer = $("#zmeer"); if (meer) meer.addEventListener("click", () => { S.zoekMax += 30; renderZoekResultaten(); });
  }

  /* ---------- Over ---------- */
  function over() {
    const m = S.data.meta;
    return `<h2>Over MilieuRadar</h2>
      <div class="card tekstkaart">
        <p>MilieuRadar volgt Nederlands milieubeleid in het parlement: wetsvoorstellen, moties en amendementen met de stemming per fractie, de agenda van de Kamer met samenvattingen van debatten, en stukken van ministeries. Alle fracties krijgen evenveel ruimte.</p>
        <h3>Hoe het werkt</h3>
        <ul>
          <li><b>Automatisch:</b> een script haalt moties, amendementen, stemmingen, activiteiten en stukken van ministeries (Kamerbrieven en antwoorden op Kamervragen) op uit de <a href="https://opendata.tweedekamer.nl">open data van de Tweede Kamer</a>. Daar komt geen AI aan te pas.</li>
          <li><b>Samenvattingen:</b> debatten worden door Claude samengevat op basis van automatische transcripten van <a href="https://gehoord.de/beraadslagingen">gehoord.de</a>. Die transcripten zijn niet door mensen gecorrigeerd en sprekers kunnen er soms een paar seconden naast zitten. Gebruik de links om na te luisteren en citeer de Handelingen.</li>
          <li><b>Toezeggingen</b> bij een samengevatte vergadering komen uit het toezeggingenregister van de Tweede Kamer; als de vergadering daar nog niet in staat, uit de samenvatting.</li>
          <li><b>Thema's</b>: alles valt in tien vaste thema's (zie <a href="#themas">Thema's</a>). Een voorstel komt uit trefwoorden in titels, agendapunten en Kamerstukdossiers; nagekeken indelingen gaan daarvoor. Wat de trefwoorden niet zeker kunnen indelen, blijft zonder thema tot het is beoordeeld. Moties worden aan een vergadering gekoppeld als de datum en het Kamerstukdossier overeenkomen; bij twijfel niet.</li>
          <li><b>Privacy:</b> de site gebruikt geen cookies of tracking.</li>
        </ul>
        <h3>Status</h3>
        <dl class="facts"><dt>Kamerdata</dt><dd>${m.bijgewerkt ? fmtDatum(m.bijgewerkt) : "nog niet opgehaald"} (${m.aantalZaken ?? 0} zaken, ${m.aantalActiviteiten ?? 0} activiteiten, ${m.aantalStukken ?? 0} stukken van ministeries)</dd>
        <dt>Periode</dt><dd>vanaf ${fmtDatum(S.data.config.startdatum)}</dd>
        ${m.fouten?.length ? `<dt>Meldingen</dt><dd>${m.fouten.map(esc).join("<br>")}</dd>` : ""}</dl>
      </div>`;
  }

  // themalabels: op de Agenda een filter aan of uit, elders naar de Agenda met dat filter
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-vthema]");
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const id = b.dataset.vthema;
    if (opAgenda() && S.af) {
      S.af.thema = S.af.thema.includes(id) ? S.af.thema.filter((x) => x !== id) : [...S.af.thema, id];
      afToepassen();
      const f = $("#agendafilters");
      if (f && f.getBoundingClientRect().top < 0) f.scrollIntoView({ block: "start", behavior: minderBeweging() ? "auto" : "smooth" });
    } else location.hash = `#agenda?thema=${encodeURIComponent(id)}`;
  }, true);
  init();
})();
