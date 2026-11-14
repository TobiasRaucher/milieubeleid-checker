/* MilieuRadar: leest de JSON-bestanden in data/ en tekent de pagina. Geen build-stap nodig. */
(function () {
  "use strict";
  const S = { sector: "alle", data: null, tabel: null,
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
  // eerste letter klein, behalve bij een afkorting ("PFAS", "CO2"): daar staat na de eerste letter nog een hoofdletter of cijfer
  const klein = (s) => { s = String(s ?? ""); return /^\S[^\s]*[A-Z0-9]/.test(s.split(" ")[0]) ? s : s.charAt(0).toLowerCase() + s.slice(1); };
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
  // Oude adressen: Vergaderingen (ook #debatten), Toezeggingen en Per fractie zijn opgegaan in de Agenda; wetsdossiers bestaan niet meer;
  // Stukken heet sinds 13 nov 2026 Vragen & Brieven (#vragen en #brieven).
  function oudeRoute(tab, pad) {
    if (tab === "stukken") return "#vragen";
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
      const navTab = { amendementen: "moties", brieven: "vragen" }[tab] || tab;
      a.classList.toggle("active", a.dataset.tab === navTab);
      if (a.dataset.tab === navTab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    const views = { overzicht, themas: themasPagina, wetgeving, moties, amendementen: moties, vragen: vragenBrieven, brieven: vragenBrieven, agenda, over, zoeken };
    const TITELS = { themas: "Thema's", agenda: "Agenda", wetgeving: "Wetgeving", moties: "Moties & Amendementen", amendementen: "Moties & Amendementen", vragen: "(Antwoord) Kamervragen", brieven: "Kamerbrieven", over: "Over", zoeken: "Zoeken" };
    S.tabel = null; S.themaLijst = null;
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
    if (S.tabel) bindTabel();
    if (S.themaLijst) bindThemaLijst();
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
  // slug: alleen items met dit thema (themapagina); zonder slug alles (voorpagina)
  function netBinnen(slug) {
    const items = [];
    for (const z of motiesEnAmendementen()) {
      const t = z.stemtelling;
      if (!t || !isDag(t.datum)) continue;
      if (slug && !themasMotie(z).includes(slug)) continue;
      items.push({ soort: "Stemming", datum: t.datum, html: feedLi(z.soort, t.datum, feedMeta(uitslagPill(z.uitslag)),
        onderwerpZin(z), tkUrl(z), `<span class="nw">${indienerKort(z)}</span>${t.voor + t.tegen ? ` <span class="nw">· Voor ${t.voor} / Tegen ${t.tegen}</span>` : ""}`, true) });
    }
    for (const x of stukkenInSector()) {
      if (!isDag(x.datum)) continue;
      if (slug && !themasBrief(x).includes(slug)) continue;
      const dossier = (x.dossiers || [])[0];
      // Kamervragen: aan welk ministerie, en als staart wie ze stelde (achternaam en fractie, zoals in de tabel)
      const staart = isVraag(x) ? `<span class="nw">${vragenstellerKort({ indieners: x.indieners || [] })}</span>`
        : dossier ? `<span class="mono">${esc(x.kamerstuk || dossier.nummer)}</span> ${esc(dossier.titel || "")}` : "";
      items.push({ soort: "Stuk", datum: x.datum, html: feedLi(SOORT_KORT[x.soort] || x.soort, x.datum, feedMeta(esc(x.ministerie ? (isVraag(x) ? "aan " : "") + x.ministerie : "ministerie onbekend")),
        x.onderwerp || x.titel, x.link, staart, true) });
    }
    // wetgeving: nieuw ingediende wetsvoorstellen
    for (const z of wetsvoorstellenTK()) {
      if (!isDag(z.gestartOp)) continue;
      if (slug && !themasWet(z).includes(slug)) continue;
      items.push({ soort: "Wetgeving", datum: z.gestartOp, html: feedLi("Wetsvoorstel", z.gestartOp, feedMeta("Ingediend"),
        z.titel || z.onderwerp, tkUrl(z), `<span class="mono">${esc(dossierLabel(z))}</span>`, true) });
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
        </ul><div class="kaartvoet"><a href="#vragen">Alle vragen en brieven</a><a href="#moties">Alle moties en amendementen</a><a href="#wetgeving">Wetgeving</a></div></div></section>
        <section aria-labelledby="ov-komt"><h2 id="ov-komt">Komt eraan</h2><div class="card"><ul class="list">
          ${komend.map((i) => agendaLi(i)).join("") || `<li class="empty">Niets gepland</li>`}
        </ul><div class="kaartvoet"><a href="#agenda">Volledige agenda</a></div></div></section>
      </div>`;
  }

  /* ---------- Thema's ---------- */
  // Routes: #themas (overzicht) en #themas/<slug> (detail). Gereserveerd voor latere filters: #themas/<slug>?type=<soort>,
  // met soort uit MRThemas.SOORTEN[].param (wetten, amendementen, moties, kamerbrieven, kamervragen, antwoorden, vergaderingen, agenda).
  // Alle tellingen komen uit MRThemas.bronItems: dezelfde lijst als de review-CSV en de noscript-lijst.
  let _themaIndex = null;
  function themaIndex() {
    if (_themaIndex) return _themaIndex;
    const items = window.MRThemas.bronItems(S.data);
    const perThema = new Map(S.T.lijst.map((t) => [t.slug, []]));
    const gezien = new Set();
    for (const x of items) {
      if (gezien.has(x.sleutel)) continue;
      gezien.add(x.sleutel);
      x.themas = window.MRThemas.themasVanItem(S.T, x);
      for (const sl of x.themas) perThema.get(sl)?.push(x);
    }
    return (_themaIndex = { items, perThema });
  }
  // Overzicht: alleen de naam; tellingen en details staan op de themapagina (Tobias, 14 nov 2026)
  function themaKaart(t) {
    return `<li><a class="themakaart" href="#themas/${esc(t.slug)}"><h3>${esc(t.label)}</h3></a></li>`;
  }
  function themasPagina() {
    const pad = (location.hash || "").slice(1).split("?")[0].split("/");
    if (pad[1]) return themaDetail(decodeURIComponent(pad[1]));
    return `<h2>Thema's</h2>
      <ul class="themagrid">${S.T.lijst.map((t) => themaKaart(t)).join("")}</ul>`;
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
      href = tkUrl(r);
      feiten = feit("Titel", r.onderwerp && r.onderwerp !== r.titel ? esc(r.onderwerp) : "") + feit("Ingediend door", esc(r.indieners.map((i) => i.naam).join(", ")))
        + feit("Laatste stap", r.gestartOp ? `${fmtDatum(r.gestartOp)}: ingediend` : "") + feit("Links", [extLink(tkUrl(r), "tweedekamer.nl"), extLink(r.link, "OpenTK")].join(" · "));
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
  // Themapagina: een schakelaar tussen Overzicht (Net binnen en Komt eraan voor dit thema) en de documentsoorten.
  // Wetten, amendementen, moties, brieven en Kamervragen zijn dezelfde tabellen als op hun eigen pagina, beperkt tot dit thema
  // (zonder Themakolom); vergaderingen en agenda blijven een lijst. Route: #themas/<slug>?type=<param>&<filters>.
  const THEMA_TABS = [
    { param: "wetten", label: "Wetten", def: () => WET_DEF, hint: "Zoek op titel, Kamerstuknummer of indiener", alle: "Wetgeving" },
    { param: "amendementen", label: "Amendementen", def: () => motieDef("amendementen"), hint: "Zoek op onderwerp, Kamerlid of Kamerstuknummer", alle: "Moties & Amendementen" },
    { param: "moties", label: "Moties", def: () => motieDef("moties"), hint: "Zoek op onderwerp, Kamerlid of Kamerstuknummer", alle: "Moties & Amendementen" },
    { param: "kamerbrieven", label: "Kamerbrieven", def: () => BRIEF_DEF, hint: "Zoek op onderwerp of Kamerstuk", alle: "Vragen & Brieven" },
    { param: "kamervragen", label: "Kamervragen", def: () => VRAAG_DEF, hint: "Zoek op onderwerp, Kamerlid of ministerie", alle: "Vragen & Brieven" },
    { param: "vergaderingen", label: "Vergaderingen", soort: "vergadering", hint: "Zoek in vergaderingen" },
    { param: "agenda", label: "Agenda", soort: "agenda", hint: "Zoek in de agenda" },
  ];
  // een tabeldefinitie beperkt tot één thema: zonder Themakolom en -filter, met het adres van de themapagina
  function themaDef(def, slug, param) {
    const inThema = def.filters.thema.waarden;
    const { thema, ...filters } = def.filters;
    return { ...def, filters, kolommen: def.kolommen.filter((c) => c.filter !== "thema"), gedeeld: (def.gedeeld || []).filter((k) => k !== "thema"),
      rijen: () => def.rijen().filter((z) => inThema(z).includes(slug)), adres: `themas/${slug}`, vast: `type=${param}` };
  }
  const themaLijstItems = (slug, soort) => themaIndex().perThema.get(slug).filter((x) => x.soort === soort)
    .sort((a, b) => soort === "agenda" ? sortKey(datumVan(a)).localeCompare(sortKey(datumVan(b))) : sortKey(datumVan(b)).localeCompare(sortKey(datumVan(a))));
  function themaDetail(slug) {
    const t = S.T.thema(slug);
    if (!t) return `<h2>Thema niet gevonden</h2><p class="themas-intro">Er is geen thema "${esc(slug)}". <a href="#themas">Naar alle thema's</a></p>`;
    const tabs = THEMA_TABS.map((tb) => {
      const def = tb.def ? themaDef(tb.def(), t.slug, tb.param) : null;
      return { ...tb, tdef: def, n: def ? def.rijen().length : themaLijstItems(t.slug, tb.soort).length };
    }).filter((tb) => tb.n);
    let gevraagd = (hashQuery().type || [])[0] || "";
    if (gevraagd === "antwoorden") gevraagd = "kamervragen";
    const actief = tabs.find((tb) => tb.param === gevraagd) || null;
    const adres = `#themas/${esc(t.slug)}`;
    const schak = `<nav class="schakelaar klein" aria-label="Onderdelen van dit thema">
        <a href="${adres}"${actief ? "" : ' aria-current="page"'}>Overzicht</a>
        ${tabs.map((tb) => `<a href="${adres}?type=${tb.param}"${tb === actief ? ' aria-current="page"' : ""}>${esc(tb.label)}<span class="schak-n">${nl(tb.n)}</span></a>`).join("")}
      </nav>`;
    const kop = `<p class="small terug"><a href="#themas">Alle thema's</a></p>
      <h2>${esc(t.label)}</h2>
      <p class="themas-intro">${esc(t.description)}</p>`;
    if (actief && actief.tdef) {
      const basis = actief.def();
      return tabelPagina(actief.tdef, { titel: kop, links: schak },
        `${esc(actief.label)} met het thema ${esc(t.label)}; dezelfde tabel als op <a href="#${basis.tab}?thema=${encodeURIComponent(t.slug)}">${esc(actief.alle)}</a>. Een klik op een rij opent het document op tweedekamer.nl.`,
        actief.hint);
    }
    if (actief) {
      const l = themaLijstItems(t.slug, actief.soort);
      S.themaLijst = { slug: t.slug, param: actief.param };
      const q = (hashQuery().q || []).join(",");
      return `${kop}
        <div class="filters motiekop">${schak}<input type="search" id="tlq" placeholder="${esc(actief.hint)}" value="${esc(q)}" aria-label="Zoeken"></div>
        <div class="card"><ul class="list" id="tl-lijst">${l.map((x, i) => themaRegel(x, t.slug).replace('<li class="themaregel">', `<li class="themaregel"${i >= GROEP_ZICHTBAAR ? " hidden" : ""}>`)).join("")}
          <li class="empty" id="tl-leeg" hidden>Niets gevonden</li></ul>
        ${l.length > GROEP_ZICHTBAAR ? `<button type="button" class="knop licht toonalle" data-toonalle="tl-lijst" aria-controls="tl-lijst" aria-expanded="false">Toon alle ${nl(l.length)} ${esc(actief.label.toLowerCase())}</button>` : ""}</div>`;
    }
    // Overzicht: Net binnen en Komt eraan, zoals op de voorpagina, alleen voor dit thema
    const binnen = netBinnen(t.slug);
    const komend = agendaItems().filter((i) => sortKey(i.datum) >= VANDAAG && (i._act ? themasVanAct(i._act) : themasVanAgendaItem(i)).includes(t.slug)).slice(0, 6);
    const tabLink = (param, tekst) => (tabs.some((tb) => tb.param === param) ? `<a href="${adres}?type=${param}">${tekst}</a>` : "");
    return `${kop}
      <div class="filters motiekop">${schak}</div>
      <div class="ov-onder thema-ov">
        <section aria-labelledby="th-binnen"><h2 id="th-binnen">Net binnen</h2><div class="card"><ul class="list">
          ${binnen.map((i) => i.html).join("") || `<li class="empty">Nog niets binnen</li>`}
        </ul><div class="kaartvoet">${tabLink("kamervragen", "Kamervragen")}${tabLink("kamerbrieven", "Kamerbrieven")}${tabLink("moties", "Moties")}${tabLink("wetten", "Wetten")}</div></div></section>
        <section aria-labelledby="th-komt"><h2 id="th-komt">Komt eraan</h2><div class="card"><ul class="list">
          ${komend.map((i) => agendaLi(i)).join("") || `<li class="empty">Niets gepland</li>`}
        </ul><div class="kaartvoet"><a href="#agenda?thema=${encodeURIComponent(t.slug)}">Agenda voor dit thema</a></div></div></section>
      </div>`;
  }
  // Vergaderingen en Agenda op een themapagina: het zoekveld filtert de regels op tekst; de zoekterm staat in de URL
  function bindThemaLijst() {
    const { slug, param } = S.themaLijst, veld = $("#tlq"), ul = $("#tl-lijst"), leeg = $("#tl-leeg");
    const regels = [...ul.querySelectorAll("li.themaregel")];
    const toepassen = () => {
      const q = veld.value.trim().toLowerCase(), knop = document.querySelector('[data-toonalle="tl-lijst"]');
      if (q) regels.forEach((li) => { li.hidden = !li.textContent.toLowerCase().includes(q); });
      else regels.forEach((li, i) => { li.hidden = !!knop && i >= GROEP_ZICHTBAAR; });
      if (knop) knop.hidden = !!q;
      leeg.hidden = regels.some((li) => !li.hidden);
      history.replaceState(null, "", `#themas/${slug}?type=${param}${q ? `&q=${encodeURIComponent(veld.value.trim())}` : ""}`);
    };
    veld.addEventListener("input", toepassen);
    if (veld.value.trim()) toepassen();
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

  /* ---------- Tabellen: Moties & Amendementen, Vragen & Brieven, Wetgeving ---------- */
  // Eén tabelpatroon (DESIGN.md, "Tables"): schakelaar of titel links, zoekveld rechts; categorische kolommen zijn filters
  // (kolomkop opent een menu met vinkjes; binnen een kolom "of", tussen kolommen "en"); alleen de datum sorteert.
  // Een klik op een rij opent het document; de knop naast de titel klapt de kenmerken uit. Filters en zoekterm staan in de URL.
  // Een pagina is een definitie: { tab, rijen(), filters, kolommen, datum, link, zoektekst, detail, knopLabel, eenheid, gedeeld }.
  const nlSort = new Intl.Collator("nl", { sensitivity: "base" });
  // vaste volgorde in een filtermenu; onbekende waarden achteraan
  const opVolgorde = (vast) => (vs) => [...vast.filter((v) => vs.has(v)), ...[...vs].filter((v) => !vast.includes(v)).sort(nlSort.compare)];
  const leegCel = (t) => `<span class="leeg" title="${esc(t)}"><span aria-hidden="true">–</span><span class="sr-only">${esc(t)}</span></span>`;
  const titelMetPijl = (t) => { const i = t.lastIndexOf(" "); return `${esc(t.slice(0, i + 1))}<span class="nw">${esc(t.slice(i + 1))}<span class="ext" aria-hidden="true"></span></span>`; };
  const statusPunt = (woord, cls) => `<span class="status ${cls}"><span class="dot" aria-hidden="true"></span>${esc(woord)}</span>`;
  // ?k=a,b: elke waarde apart gecodeerd, dus een komma in een waarde ("Landbouw, Visserij, ...") blijft heel
  function hashQuery() {
    const uit = {};
    for (const deel of (location.hash.split("?")[1] || "").split("&")) {
      if (!deel) continue;
      const i = deel.indexOf("="), dec = (v) => { try { return decodeURIComponent(v.replace(/\+/g, " ")); } catch (e) { return v; } };
      uit[dec(i < 0 ? deel : deel.slice(0, i))] = i < 0 ? [] : deel.slice(i + 1).split(",").filter(Boolean).map(dec);
    }
    return uit;
  }
  const themaKolom = (themasVan) => ({ filter: "thema", tdCls: "thema hide-sm", cel: (z) => { const th = themasVan(z); return th.length ? themaChips(th) : leegCel("Geen thema"); } });
  const themaFilter = (themasVan) => ({ label: "Thema", waarden: (z) => (themasVan(z).length ? themasVan(z) : [""]), orde: (vs) => opVolgorde([...S.T.lijst.map((t) => t.slug), ""])(vs), tekst: (v) => esc(v ? S.T.naam(v) : "Geen thema") });
  // thema's per rij onthouden: de aantallen in het filtermenu vragen ze voor elke rij opnieuw
  const onthoud = (fn, sleutel) => { const m = new Map(); return (z) => { const k = sleutel(z); let t = m.get(k); if (!t) m.set(k, (t = fn(z))); return t; }; };

  function tabelStaat(def) {
    const q = hashQuery();
    const st = { q: (q.q || []).join(","), richting: (q.volgorde || [])[0] === "oud" ? "asc" : "desc" };
    for (const k of Object.keys(def.filters)) st[k] = q[k] || [];
    return st;
  }
  function tabelQuery(def, st, alleen) {
    const p = [];
    for (const k of Object.keys(def.filters)) if (st[k].length && (!alleen || alleen.includes(k))) p.push(`${k}=${st[k].map(encodeURIComponent).join(",")}`);
    if (st.q.trim()) p.push(`q=${encodeURIComponent(st.q.trim())}`);
    if (st.richting === "asc") p.push("volgorde=oud");
    return p.length ? "?" + p.join("&") : "";
  }
  function tabelPast(def, st, z, behalve) {
    const q = st.q.trim().toLowerCase();
    if (q && !def.zoektekst(z).toLowerCase().includes(q)) return false;
    return Object.entries(def.filters).every(([k, f]) => k === behalve || !st[k].length || f.waarden(z).some((v) => st[k].includes(v)));
  }
  const tabelGefilterd = (def, st) => !!st.q.trim() || Object.keys(def.filters).some((k) => st[k].length);
  // alleen de datum sorteert: nieuwste of oudste eerst; zonder datum altijd onderaan, bij gelijke datum op sleutel
  const tabelVolgorde = (def, richting) => (a, b) => {
    const x = def.datum(a) || "", y = def.datum(b) || "", r = richting === "asc" ? 1 : -1;
    if (!x || !y) return x === y ? 0 : x ? -1 : 1;
    return (x.localeCompare(y) || String(def.sleutel(a)).localeCompare(String(def.sleutel(b)))) * r;
  };
  function tabelKoppen(def, st) {
    const asc = st.richting === "asc";
    return `<tr>${def.kolommen.map((c) => {
      if (c.filter) {
        const n = st[c.filter].length, label = def.filters[c.filter].label;
        return `<th class="fkop"><button type="button" class="kopfilter${n ? " actief" : ""}" data-filter="${c.filter}" aria-expanded="false" aria-controls="mfmenu" aria-label="Filter ${esc(label.toLowerCase())}${n ? `, ${n} gekozen` : ""}">${esc(label)}${n ? `<span class="facet-n">${n}</span>` : ""}</button></th>`;
      }
      if (c.knop) return `<th class="knopcel"><span class="sr-only">${esc(def.knopLabel[0])}</span></th>`;
      if (c.datum) return `<th class="rechts dkop" aria-sort="${asc ? "ascending" : "descending"}"><button type="button" class="sorteer actief" data-sort="datum" aria-label="${esc(c.kop)}, ${asc ? "oudste" : "nieuwste"} eerst; klik om om te draaien">${esc(c.kop)}${ico(asc ? "pijlop" : "pijlneer")}</button></th>`;
      return `<th class="${c.thCls || ""}">${c.kop}</th>`;
    }).join("")}</tr>`;
  }
  function tabelCel(def, c, z) {
    if (c.knop) return `<td class="knopcel"><button type="button" class="uitklap" aria-expanded="false" aria-label="${esc(def.knopLabel[0])}">${ico("chevron")}</button></td>`;
    if (c.datum) return `<td class="datum rechts">${fmtKort(def.datum(z))}</td>`;
    return `<td class="${c.tdCls || ""}">${c.cel(z)}</td>`;
  }
  // kop: de schakelaar of paginatitel met het zoekveld rechts; voet: de uitleg onder de tabel
  function tabelPagina(def, kop, voet, zoekhint) {
    S.tabel = { def, st: tabelStaat(def) };
    return `${kop.titel}
      <div class="filters motiekop">${kop.links}<input type="search" id="mq" placeholder="${esc(zoekhint)}" value="${esc(S.tabel.st.q)}" aria-label="Zoeken"></div>
      <div class="tablewrap"><table class="motietabel" data-tab="${def.tab}"><thead id="mkop">${tabelKoppen(def, S.tabel.st)}</thead><tbody id="mbody"></tbody></table></div>
      <div id="mfmenu" class="kopmenu" popover="manual"></div>
      <p class="small muted">${voet}</p>`;
  }
  const schakelaar = (label, opties, actief) => `<nav class="schakelaar" aria-label="${esc(label)}">
      ${opties.map(([k, l]) => `<a href="#${k}" data-tab="${k}" ${k === actief ? 'aria-current="page"' : ""}>${l}</a>`).join("")}
    </nav>`;

  function bindTabel() {
    if (!S.tabel) return;
    const { def, st } = S.tabel, menu = $("#mfmenu");
    const alle = def.rijen();
    const kanPopover = typeof menu.showPopover === "function";
    if (!kanPopover) menu.hidden = true;
    // documentbrede luisteraars van een vorige weergave opruimen
    if (S.tabelAf) S.tabelAf.abort();
    S.tabelAf = new AbortController();
    const sig = { signal: S.tabelAf.signal };
    let rows = [], openKol = "";
    const knopVan = (k) => $(`#mkop button[data-filter="${k}"]`);
    const n = def.kolommen.length;

    const tekenKop = () => {
      $("#mkop").innerHTML = tabelKoppen(def, st);
      if (openKol) knopVan(openKol).setAttribute("aria-expanded", "true");
    };
    const tekenRijen = () => {
      $("#mbody").innerHTML = rows.map((z, i) => `<tr class="row" data-i="${i}">${def.kolommen.map((c) => tabelCel(def, c, z)).join("")}</tr>`).join("")
        || `<tr><td colspan="${n}" class="empty">Geen ${def.eenheid} ${tabelGefilterd(def, st) ? `met deze filters <button type="button" class="linkknop" data-wisalles>Filters wissen</button>` : "gevonden"}</td></tr>`;
    };
    const toepassen = () => {
      rows = alle.filter((z) => tabelPast(def, st, z)).sort(tabelVolgorde(def, st.richting));
      tekenKop();
      tekenRijen();
      // op een themapagina: eigen adres plus vast deel (type=...)
      const q = tabelQuery(def, st);
      history.replaceState(null, "", `#${def.adres || def.tab}${def.vast ? `?${def.vast}${q ? "&" + q.slice(1) : ""}` : q}`);
      // de schakelaar neemt de gedeelde filters mee naar de andere helft
      document.querySelectorAll(".motiekop .schakelaar a[data-tab]").forEach((a) => { a.href = `#${a.dataset.tab}${tabelQuery(def, st, def.gedeeld)}`; });
    };

    // filtermenu: één popover voor alle kolommen, met per waarde het aantal rijen onder de andere filters
    const menuInhoud = (k) => {
      const f = def.filters[k], tel = new Map();
      for (const z of alle) {
        const past = tabelPast(def, st, z, k);
        for (const v of f.waarden(z)) tel.set(v, (tel.get(v) || 0) + (past ? 1 : 0));
      }
      for (const v of st[k]) if (!tel.has(v)) tel.set(v, 0);
      return `<div role="group" aria-label="${esc(f.label)}">${f.orde(new Set(tel.keys())).map((v, i) =>
        `<label${tel.get(v) ? "" : ' class="nul"'}><input type="checkbox" id="mf-${k}-${i}" value="${esc(v)}" ${st[k].includes(v) ? "checked" : ""}><span>${f.tekst(v)}</span><span class="n">${nl(tel.get(v))}</span></label>`).join("")}</div>
        ${st[k].length ? `<div class="kopmenu-voet"><button type="button" class="linkknop" data-wis="${k}">Wissen</button></div>` : ""}`;
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
      st[openKol] = cb.checked ? uniek([...st[openKol], cb.value]) : st[openKol].filter((x) => x !== cb.value);
      menuOpnieuw(cb.id);
    });
    menu.addEventListener("click", (e) => {
      const w = e.target.closest("[data-wis]");
      if (w) { st[w.dataset.wis] = []; menuOpnieuw(); }
    });
    // focus die het menu verlaat (Tab) sluit het, behalve naar een andere filterkop
    menu.addEventListener("focusout", (e) => {
      const t = e.relatedTarget;
      if (openKol && t && !menu.contains(t) && !t.closest("#mkop button[data-filter]")) sluitMenu(false);
    });
    document.addEventListener("pointerdown", (e) => {
      if (openKol && !menu.contains(e.target) && !e.target.closest("#mkop button[data-filter]")) sluitMenu(false);
    }, sig);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && openKol) { e.preventDefault(); sluitMenu(true); } }, sig);
    window.addEventListener("scroll", plaats, { ...sig, passive: true, capture: true });
    window.addEventListener("resize", plaats, sig);

    $("#mq").addEventListener("input", (e) => { st.q = e.target.value; toepassen(); });
    $("#mkop").addEventListener("click", (e) => {
      const fb = e.target.closest("button[data-filter]");
      if (fb) { if (openKol === fb.dataset.filter) sluitMenu(true); else openMenu(fb.dataset.filter); return; }
      if (e.target.closest("button[data-sort]")) {
        st.richting = st.richting === "asc" ? "desc" : "asc";
        sluitMenu(false);
        toepassen();
        $("#mkop button[data-sort]").focus();
      }
    });
    $("#mbody").addEventListener("click", (e) => {
      if (e.target.closest("[data-wisalles]")) {
        st.q = ""; $("#mq").value = "";
        for (const k of Object.keys(def.filters)) st[k] = [];
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
          d.innerHTML = `<td colspan="${n}">${def.detail(rows[+tr.dataset.i])}</td>`;
          tr.after(d);
        }
        tr.classList.toggle("open", !open);
        knop.setAttribute("aria-expanded", String(!open));
        knop.setAttribute("aria-label", def.knopLabel[open ? 0 : 1]);
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
  const naamFractie = (i) => `${esc(i.naam)}${i.fractie ? ` (${esc(i.fractie)})` : ""}`;

  /* ---------- Wetgeving ---------- */
  // Wetsvoorstellen uit de open data van de Kamer (soort Wetgeving of Initiatiefwetgeving in de gevolgde Kamerstukdossiers).
  const themasWet = onthoud((z) => themasVanZaak(z), (z) => z.nummer);
  const wetSoort = (z) => (z.soort === "Initiatiefwetgeving" ? "Initiatiefwetsvoorstel" : "Regering");
  const WET_DEF = {
    tab: "wetgeving", eenheid: "wetsvoorstellen", knopLabel: ["Details tonen", "Details verbergen"],
    rijen: () => wetsvoorstellenTK(),
    datum: (z) => z.gestartOp, sleutel: (z) => z.nummer,
    zoektekst: (z) => `${z.titel} ${z.onderwerp} ${z.citeertitel || ""} ${z.nummer} ${dossierLabel(z)} ${z.indieners.map((i) => i.naam).join(" ")}`,
    filters: {
      thema: themaFilter(themasWet),
      status: { label: "Status", waarden: (z) => [z.uitslag || "in behandeling"], orde: opVolgorde(["in behandeling", "aangenomen", "verworpen", "ingetrokken", "vervallen"]), tekst: (v) => uitslagPill(v) },
      soort: { label: "Ingediend door", waarden: (z) => [wetSoort(z)], orde: opVolgorde(["Regering", "Initiatiefwetsvoorstel"]), tekst: (v) => esc(v === "Regering" ? "Regering" : "Kamerleden (initiatief)") },
    },
    kolommen: [
      themaKolom(themasWet),
      { kop: "Wetsvoorstel", thCls: "ond", tdCls: "ond", cel: (z) => `<a class="ltitel" href="${esc(tkUrl(z))}" target="_blank" rel="noopener">${titelMetPijl(z.titel || z.onderwerp || "")}</a>` },
      { knop: true },
      { filter: "status", tdCls: "uitslag", cel: (z) => uitslagPill(z.uitslag) },
      { filter: "soort", tdCls: "indiener hide-sm", cel: (z) => (z.soort === "Initiatiefwetgeving" ? indienerKort(z) : "Regering") },
      { kop: "Kamerstuk", thCls: "rechts hide-sm", tdCls: "kamerstuk rechts mono hide-sm", cel: (z) => esc(dossierLabel(z)) },
      { datum: true, kop: "Ingediend" },
    ],
    detail: (z) => {
      const stappen = [...z.besluiten].filter((b) => b.tekst).sort((a, b) => (b.datum || "").localeCompare(a.datum || "")).slice(0, 4);
      const door = z.indieners.map(naamFractie);
      const ks = z.dossiers[0];
      return `<div class="mdetail">
        <p>Zaak <span class="mono">${esc(z.nummer)}</span>${ks ? ` · Kamerstuk <span class="mono">${esc(dossierLabel(z))}</span>` : ""} · ingediend ${fmtKort(z.gestartOp)}${door.length ? `, door ${opsomming(door)}` : ""}</p>
        ${stappen.length ? `<div class="mstemming"><p class="mtelling">Laatste stappen</p><ul class="mstappen">${stappen.map((b) => `<li><span class="datum">${fmtKort(b.datum)}</span> ${esc(b.tekst)}</li>`).join("")}</ul></div>` : ""}
        <div class="mlinks">${extLink(tkUrl(z), "Bekijk op tweedekamer.nl")}${extLink(z.link, "Bekijk op OpenTK")}</div>
      </div>`;
    },
  };
  function wetgeving() {
    return tabelPagina(WET_DEF, { titel: "", links: `<h2 class="tabeltitel">Wetgeving</h2>` },
      "Wetsvoorstellen sinds 2019 over milieu, klimaat, energie, water, natuur en leefomgeving, rechtstreeks uit de open data van de Tweede Kamer. Een klik op een rij opent het wetsvoorstel op tweedekamer.nl; de knop naast de titel toont de laatste stappen. Thema, Status en Ingediend door filteren, Ingediend sorteert.",
      "Zoek op titel, Kamerstuknummer of indiener");
  }

  /* ---------- Moties en amendementen ---------- */
  // Eén tabel voor beide soorten; de grote schakelaar bovenaan wisselt tussen #moties en #amendementen (filters gaan mee).
  const SOORT_VAN_TAB = { moties: "Motie", amendementen: "Amendement" };
  // link naar het document op tweedekamer.nl (D-nummer uit de pipeline); anders zoeken op het zaaknummer
  const tkUrl = window.MRThemas.tkUrl;
  const onderwerpZin = (z) => hoofd(korteTitel(z).trim().replace(/\s+/g, " "));
  // in de tabel leest de titel door op de kolomkop "Motie over..."
  const onderwerpKlein = (z) => klein(korteTitel(z).trim().replace(/\s+/g, " ").replace(/^over /i, ""));
  const themasMotie = onthoud((z) => themasVanZaak(z), (z) => z.nummer);
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
  const fractieFilter = (label, indieners) => ({ label, waarden: (z) => uniek(indieners(z).map((i) => fractieNaam(i.fractie)).filter(Boolean)), orde: opVolgorde([]), tekst: (v) => esc(v) });
  function motieDef(tab) {
    const soort = SOORT_VAN_TAB[tab];
    return {
      tab, eenheid: tab, knopLabel: ["Stemming per fractie tonen", "Stemming per fractie verbergen"],
      gedeeld: ["thema", "uitslag", "appreciatie", "fractie"],
      rijen: () => motiesEnAmendementen().filter((z) => z.soort === soort),
      datum: motieDatum, sleutel: (z) => z.nummer,
      zoektekst: (z) => `${z.onderwerp} ${z.titel} ${z.indieners.map((i) => `${i.naam} ${i.fractie}`).join(" ")} ${z.dossiers.map((d) => `${d.nummer}${d.toevoeging ? "-" + d.toevoeging : ""}`).join(" ")}`,
      // Indiener telt alle indieners, ook mede-indieners
      filters: {
        thema: themaFilter(themasMotie),
        uitslag: { label: "Uitslag", waarden: (z) => [z.uitslag || "in behandeling"], orde: opVolgorde(UITSLAG_ORDE), tekst: (v) => uitslagPill(v) },
        appreciatie: { label: "Appreciatie kabinet", waarden: (z) => [appreciatie(z)], orde: opVolgorde([...APPRECIATIES, ""]), tekst: (v) => esc(v || "Geen appreciatie") },
        fractie: fractieFilter("Indiener", (z) => z.indieners),
      },
      kolommen: [
        themaKolom(themasMotie),
        { kop: `${soort} over...`, thCls: "ond", tdCls: "ond", cel: (z) => `<a class="ltitel" href="${esc(tkUrl(z))}" target="_blank" rel="noopener">${titelMetPijl(onderwerpKlein(z))}</a>` },
        { knop: true },
        { filter: "uitslag", tdCls: "uitslag", cel: (z) => uitslagPill(z.uitslag) },
        { filter: "appreciatie", tdCls: "appr hide-sm", cel: (z) => { const a = appreciatie(z), ruw = (z.kabinetsappreciatie || "").trim(); return a ? esc(a) : leegCel(ruw || "Geen appreciatie"); } },
        { filter: "fractie", tdCls: "indiener hide-sm", cel: indienerKort },
        { kop: "Kamerstuk", thCls: "rechts hide-sm", tdCls: "kamerstuk rechts mono hide-sm", cel: (z) => esc(dossierLabel(z)) },
        { datum: true, kop: "Datum" },
      ],
      detail: motieDetail,
    };
  }
  function moties() {
    const tab = location.hash.slice(1).split(/[/?]/)[0] === "amendementen" ? "amendementen" : "moties";
    return tabelPagina(motieDef(tab), { titel: `<h2 class="sr-only">Moties &amp; Amendementen</h2>`, links: schakelaar("Moties of amendementen", [["moties", "Moties"], ["amendementen", "Amendementen"]], tab) },
      `Een klik op een rij opent ${tab === "moties" ? "de motie" : "het amendement"} op tweedekamer.nl; de knop naast de titel toont de stemming per fractie. Thema, Uitslag, Appreciatie kabinet en Indiener filteren, Datum sorteert. Alle gegevens komen rechtstreeks uit de open data van de Tweede Kamer.`,
      "Zoek op onderwerp, Kamerlid of Kamerstuknummer");
  }
  // Uitgeklapte rij: alleen de kenmerken, de stemverhouding, de fracties voor en tegen, en de twee links.
  function motieDetail(z) {
    const b = [...z.besluiten].reverse().find((x) => x.stemmen.length), t = z.stemtelling;
    // elke fractie één keer, ook bij een hoofdelijke stemming (daar staat elk Kamerlid apart in de data)
    const fracties = (soort) => uniek(b.stemmen.filter((s) => s.soort === soort).map((s) => s.fractie)).sort(nlSort.compare);
    const blok = (label, fs) => `<div><div class="k">${label}:</div><div>${fs.length ? fs.map(esc).join(", ") : `<span class="muted">geen</span>`}</div></div>`;
    const eerste = eersteIndiener(z), door = [eerste, ...z.indieners.filter((i) => i !== eerste)].filter(Boolean).map(naamFractie);
    return `<div class="mdetail">
      <p>Zaak <span class="mono">${esc(z.nummer)}</span>${z.document ? ` · document <span class="mono">${esc(z.document)}</span>` : ""} · ingediend ${fmtKort(z.gestartOp)}${door.length ? `, door ${opsomming(door)}` : ""}</p>
      ${b && t ? `<div class="mstemming"><p class="mtelling">Voor ${nl(t.voor)} / Tegen ${nl(t.tegen)}</p>
        <div class="mstemmen">${blok("Voor", fracties("Voor"))}${blok("Tegen", fracties("Tegen"))}</div></div>` : `<p class="muted">Nog geen stemming</p>`}
      <div class="mlinks">${extLink(tkUrl(z), "Bekijk op tweedekamer.nl")}${extLink(z.link, "Bekijk op OpenTK")}</div>
    </div>`;
  }

  /* ---------- Vragen & Brieven ---------- */
  // Kamerbrieven, Kamervragen en antwoorden daarop (data/tk/stukken.json). Een vraag en haar antwoord delen het zaaknummer
  // en staan samen in één rij van de tabel Kamervragen. Antwoordtermijn: drie weken (Reglement van Orde).
  const SOORT_KORT = { "Brief regering": "Kamerbrief", "Schriftelijke vragen": "Kamervragen", "Antwoord schriftelijke vragen": "Antwoord Kamervragen", "Antwoord schriftelijke vragen (nader)": "Antwoord Kamervragen" };
  const stukkenInSector = () => (S.data.stukken || []).filter(inSector).slice().sort((a, b) => (b.datum || "").localeCompare(a.datum || ""));
  const isVraag = (x) => x.soort === "Schriftelijke vragen";
  const isAntwoord = (x) => /^Antwoord/.test(x.soort || "");
  const ANTWOORD_TERMIJN = 21;
  const dagenTot = (van, tot) => Math.round((Date.parse(tot) - Date.parse(van)) / 864e5);
  // "Antwoord op vragen van het lid Kostić over ..." -> ["Kostić"] (alleen als de vraag zelf niet in de data staat)
  const vragenstellersUitTitel = (t) => { const m = /vragen van (?:het lid|de leden) (.+?) (?:over|inzake|naar aanleiding van) /i.exec(t || ""); return m ? m[1].split(/,\s*| en /).map((n) => n.trim()).filter(Boolean) : []; };
  let _vragen = null;
  function vraagRijen() {
    if (_vragen && _vragen.bron === S.data.stukken) return _vragen.rijen;
    const per = new Map();
    for (const x of stukkenInSector()) {
      if (!isVraag(x) && !isAntwoord(x)) continue;
      const k = x.zaak || x.id;
      const r = per.get(k) || { zaak: x.zaak, vraag: null, antwoorden: [] };
      if (isVraag(x)) r.vraag = x; else r.antwoorden.push(x);
      per.set(k, r);
    }
    const rijen = [...per.values()].map((r) => {
      r.antwoorden.sort((a, b) => (a.datum || "").localeCompare(b.datum || ""));
      const a = r.antwoorden[0], v = r.vraag;
      r.id = v ? v.id : a.id;
      r.datum = v ? v.datum : a.datum;
      r.titel = v ? v.onderwerp || v.titel : window.MRThemas.stukTitel(a);
      r.indieners = v ? v.indieners || [] : vragenstellersUitTitel(zonderVoorletters(a.onderwerp || a.titel)).map((naam) => ({ naam }));
      r.ministeries = v ? (v.ministeries && v.ministeries.length ? v.ministeries : [v.ministerie].filter(Boolean)) : uniek(r.antwoorden.map((x) => x.ministerie).filter(Boolean));
      r.link = (v || a).link;
      r.dagen = a || !r.datum ? null : dagenTot(r.datum, VANDAAG);
      r.status = a ? "Beantwoord" : r.dagen > ANTWOORD_TERMIJN ? "Termijn verstreken" : "Open";
      r.dossiers = [...(v ? v.dossiers || [] : []), ...r.antwoorden.flatMap((x) => x.dossiers || [])];
      r.kamerstuk = r.antwoorden.map((x) => x.kamerstuk).find(Boolean) || (v && v.kamerstuk) || null;
      return r;
    });
    _vragen = { bron: S.data.stukken, rijen };
    return rijen;
  }
  const themasVraag = onthoud((r) => uniek([r.vraag, ...r.antwoorden].filter(Boolean).flatMap(themasVanStuk)), (r) => r.id);
  const themasBrief = onthoud((x) => themasVanStuk(x), (x) => x.id);
  const VRAAG_STATUS = { Beantwoord: "afgedaan", Open: "openstaand", "Termijn verstreken": "openstaand" };
  const vraagStatus = (r) => statusPunt(r.status, VRAAG_STATUS[r.status]);
  function vragenstellerKort(r) {
    const i = r.indieners[0];
    if (!i) return leegCel("Vragensteller onbekend");
    const naam = achternaam(i.naam), fr = i.fractie && i.fractie !== naam ? ` (${esc(i.fractie)})` : "";
    return `<span title="${esc(r.indieners.map((x) => `${x.naam}${x.fractie ? ` (${x.fractie})` : ""}`).join(", "))}">${esc(naam)}${fr}${r.indieners.length > 1 ? ` <span class="muted">c.s.</span>` : ""}</span>`;
  }
  const ministerieKort = (ms) => (ms.length ? `<span title="${esc(ms.join("; "))}">${esc(ms[0])}${ms.length > 1 ? ` <span class="muted">+${ms.length - 1}</span>` : ""}</span>` : leegCel("Onbekend"));
  // titels lezen door op de kolomkop ("Vragen over...", "Kamerbrief over...")
  const overKlein = (t) => klein(String(t || "").trim().replace(/\s+/g, " ").replace(/^(over|inzake) /i, ""));
  const STUK_GEDEELD = ["thema", "ministerie"];
  const VRAAG_DEF = {
    tab: "vragen", eenheid: "Kamervragen", knopLabel: ["Vraag en antwoord tonen", "Vraag en antwoord verbergen"], gedeeld: STUK_GEDEELD,
    rijen: vraagRijen, datum: (r) => r.datum, sleutel: (r) => r.id,
    zoektekst: (r) => `${r.titel} ${r.zaak || ""} ${r.kamerstuk || ""} ${r.indieners.map((i) => `${i.naam} ${i.fractie || ""}`).join(" ")} ${r.ministeries.join(" ")} ${[r.vraag, ...r.antwoorden].filter(Boolean).map((x) => `${x.id} ${x.ondertekenaar || ""} ${x.onderwerp || ""}`).join(" ")} ${r.dossiers.map((d) => `${d.nummer} ${d.titel || ""}`).join(" ")}`,
    filters: {
      thema: themaFilter(themasVraag),
      status: { label: "Status", waarden: (r) => [r.status], orde: opVolgorde(["Beantwoord", "Open", "Termijn verstreken"]), tekst: (v) => statusPunt(v, VRAAG_STATUS[v]) },
      fractie: fractieFilter("Gesteld door", (r) => r.indieners),
      ministerie: { label: "Gericht aan", waarden: (r) => (r.ministeries.length ? r.ministeries : [""]), orde: opVolgorde([]), tekst: (v) => esc(v || "Onbekend") },
    },
    kolommen: [
      themaKolom(themasVraag),
      { kop: "Vragen over...", thCls: "ond", tdCls: "ond", cel: (r) => `<a class="ltitel" href="${esc(r.link)}" target="_blank" rel="noopener">${titelMetPijl(overKlein(r.titel))}</a>` },
      { knop: true },
      { filter: "status", tdCls: "uitslag", cel: vraagStatus },
      { filter: "fractie", tdCls: "indiener hide-sm", cel: vragenstellerKort },
      { filter: "ministerie", tdCls: "ministerie hide-sm", cel: (r) => ministerieKort(r.ministeries) },
      { datum: true, kop: "Gesteld" },
    ],
    detail: (r) => {
      const v = r.vraag;
      const door = r.indieners.map(naamFractie);
      const aan = v ? (v.ministeries || []).length ? v.ministeries : [v.ministerie].filter(Boolean) : [];
      const antw = r.antwoorden.map((a) => `<li><span class="datum">${fmtKort(a.datum)}</span> ${a.soort.includes("nader") ? "Nader antwoord" : "Beantwoord"}${a.ondertekenaar ? ` door ${esc(a.ondertekenaar)}${a.functie ? ` (${esc(a.functie)})` : ""}` : ""}${v && a.datum && v.datum ? `, na ${nl(dagenTot(v.datum, a.datum))} dagen` : ""} · ${extLink(a.link, "antwoord")}${a.kamerstuk ? ` · <span class="mono">${esc(a.kamerstuk)}</span>` : ""}</li>`);
      return `<div class="mdetail">
        <p>Zaak <span class="mono">${esc(r.zaak || "onbekend")}</span>${v ? ` · document <span class="mono">${esc(v.id)}</span> · gesteld ${fmtKort(v.datum)}` : ""}${door.length ? `, door ${opsomming(door)}` : ""}${aan.length ? `; gericht aan ${opsomming(aan.map(esc))}` : ""}</p>
        <div class="mstemming"><p class="mtelling">${r.antwoorden.length ? "Antwoord" : r.status === "Termijn verstreken" ? `Nog niet beantwoord, ${nl(r.dagen)} dagen na het stellen (termijn ${ANTWOORD_TERMIJN} dagen)` : `Nog niet beantwoord${r.dagen != null ? `, ${nl(r.dagen)} ${r.dagen === 1 ? "dag" : "dagen"} na het stellen` : ""}`}</p>
          ${antw.length ? `<ul class="mstappen">${antw.join("")}</ul>` : ""}</div>
        ${v ? "" : `<p class="muted">De vraag zelf is van voor het begin van deze gegevens.</p>`}
        <div class="mlinks">${v ? extLink(v.link, "Vragen op tweedekamer.nl") : ""}${r.antwoorden.map((a, i) => extLink(a.link, r.antwoorden.length > 1 ? `Antwoord ${i + 1} op tweedekamer.nl` : "Antwoord op tweedekamer.nl")).join("")}</div>
      </div>`;
    },
  };
  const BRIEF_DEF = {
    tab: "brieven", eenheid: "Kamerbrieven", knopLabel: ["Details tonen", "Details verbergen"], gedeeld: STUK_GEDEELD,
    rijen: () => stukkenInSector().filter((x) => x.soort === "Brief regering"),
    datum: (x) => x.datum, sleutel: (x) => x.id,
    zoektekst: (x) => `${x.onderwerp} ${x.titel} ${x.ondertekenaar || ""} ${x.ministerie || ""} ${x.kamerstuk || ""} ${x.id} ${(x.dossiers || []).map((d) => `${d.nummer} ${d.titel || ""}`).join(" ")}`,
    filters: {
      thema: themaFilter(themasBrief),
      ministerie: { label: "Ministerie", waarden: (x) => [x.ministerie || ""], orde: opVolgorde([]), tekst: (v) => esc(v || "Onbekend") },
    },
    kolommen: [
      themaKolom(themasBrief),
      { kop: "Kamerbrief over...", thCls: "ond", tdCls: "ond", cel: (x) => `<a class="ltitel" href="${esc(x.link)}" target="_blank" rel="noopener">${titelMetPijl(overKlein(x.onderwerp || x.titel))}</a>` },
      { knop: true },
      { filter: "ministerie", tdCls: "uitslag ministerie", cel: (x) => esc(x.ministerie || "Onbekend") },
      { kop: "Kamerstuk", thCls: "rechts hide-sm", tdCls: "kamerstuk rechts mono hide-sm", cel: (x) => esc(x.kamerstuk || ((x.dossiers || [])[0] || {}).nummer || "") },
      { datum: true, kop: "Datum" },
    ],
    detail: (x) => {
      const ds = x.dossiers || [];
      return `<div class="mdetail">
        <p>Document <span class="mono">${esc(x.id)}</span> · ${fmtKort(x.datum)}${x.ondertekenaar ? `, ondertekend door ${esc(x.ondertekenaar)}${x.functie ? ` (${esc(x.functie)})` : ""}` : ""}</p>
        ${ds.length ? `<div class="mstemming"><p class="mtelling">Kamerstuk</p><ul class="mstappen">${ds.map((d) => `<li><span class="mono">${esc(d.nummer)}${d.toevoeging ? "-" + esc(d.toevoeging) : ""}</span> ${esc(d.titel || "")}</li>`).join("")}</ul></div>` : ""}
        <div class="mlinks">${extLink(x.link, "Bekijk op tweedekamer.nl")}</div>
      </div>`;
    },
  };
  function vragenBrieven() {
    const tab = location.hash.slice(1).split(/[/?]/)[0] === "brieven" ? "brieven" : "vragen";
    return tabelPagina(tab === "brieven" ? BRIEF_DEF : VRAAG_DEF,
      { titel: `<h2 class="sr-only">(Antwoord) Kamervragen &amp; Brieven</h2>`, links: schakelaar("Kamervragen of Kamerbrieven", [["vragen", `<span class="hide-sm">(Antwoord)&nbsp;</span>Kamervragen`], ["brieven", "Brieven"]], tab) },
      tab === "brieven"
        ? "Kamerbrieven van ministeries over milieu, klimaat, energie, water, natuur en leefomgeving. Een klik op een rij opent de brief op tweedekamer.nl; de knop naast de titel toont het Kamerstuk. Thema en Ministerie filteren, Datum sorteert."
        : `Schriftelijke vragen van Kamerleden met het antwoord van het kabinet in dezelfde rij. Een klik op een rij opent de vragen op tweedekamer.nl; de knop naast de titel toont het antwoord. Het kabinet heeft ${ANTWOORD_TERMIJN} dagen om te antwoorden. Thema, Status, Gesteld door en Gericht aan filteren, Gesteld sorteert.`,
      tab === "brieven" ? "Zoek op onderwerp of Kamerstuk" : "Zoek op onderwerp, Kamerlid of ministerie");
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
      <ul class="motielijst">${ms.map((z) => `<li>${uitslagPill(z.uitslag)} <a href="${esc(tkUrl(z))}" target="_blank" rel="noopener">${esc(korteTitel(z))}</a> <span class="small muted">${indienersTekst(z)}</span></li>`).join("")}</ul>`;
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
    const q = hashQuery(), lijst = (k) => q[k] || [];
    S.af = { type: lijst("type"), commissie: lijst("commissie"), ministerie: lijst("ministerie"), thema: lijst("thema"), terug: lijst("terugblik")[0] === "1" };
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
  const ZOEK_CATS = [["", "Alles"], ["debatten", "Vergaderingen"], ["wetgeving", "Wetsvoorstellen"], ["moties", "Moties & amendementen"], ["stukken", "Vragen & brieven"], ["toezeggingen", "Toezeggingen"], ["agenda", "Agenda"]];
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
        <p>MilieuRadar volgt Nederlands milieubeleid in het parlement: wetsvoorstellen, moties en amendementen met de stemming per fractie, de agenda van de Kamer met samenvattingen van debatten, Kamervragen met de antwoorden, en Kamerbrieven. Alle fracties krijgen evenveel ruimte.</p>
        <h3>Hoe het werkt</h3>
        <ul>
          <li><b>Automatisch:</b> een script haalt moties, amendementen, stemmingen, activiteiten, Kamerbrieven, Kamervragen en de antwoorden daarop op uit de <a href="https://opendata.tweedekamer.nl">open data van de Tweede Kamer</a>. Daar komt geen AI aan te pas.</li>
          <li><b>Samenvattingen:</b> debatten worden door Claude samengevat op basis van automatische transcripten van <a href="https://gehoord.de/beraadslagingen">gehoord.de</a>. Die transcripten zijn niet door mensen gecorrigeerd en sprekers kunnen er soms een paar seconden naast zitten. Gebruik de links om na te luisteren en citeer de Handelingen.</li>
          <li><b>Toezeggingen</b> bij een samengevatte vergadering komen uit het toezeggingenregister van de Tweede Kamer; als de vergadering daar nog niet in staat, uit de samenvatting.</li>
          <li><b>Thema's</b>: alles valt in tien vaste thema's (zie <a href="#themas">Thema's</a>). Een voorstel komt uit trefwoorden in titels, agendapunten en Kamerstukdossiers; nagekeken indelingen gaan daarvoor. Wat de trefwoorden niet zeker kunnen indelen, blijft zonder thema tot het is beoordeeld. Moties worden aan een vergadering gekoppeld als de datum en het Kamerstukdossier overeenkomen; bij twijfel niet.</li>
          <li><b>Privacy:</b> de site gebruikt geen cookies of tracking.</li>
        </ul>
        <h3>Status</h3>
        <dl class="facts"><dt>Kamerdata</dt><dd>${m.bijgewerkt ? fmtDatum(m.bijgewerkt) : "nog niet opgehaald"} (${m.aantalZaken ?? 0} zaken, ${m.aantalActiviteiten ?? 0} activiteiten, ${m.aantalStukken ?? 0} brieven, vragen en antwoorden)</dd>
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
