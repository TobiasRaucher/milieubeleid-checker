/* MilieuRadar: leest de JSON-bestanden in data/ en tekent de pagina. Geen build-stap nodig. */
(function () {
  "use strict";
  const S = { sector: "alle", data: null, motieFilter: { q: "", uitslag: [], appreciatie: [], fractie: [], richting: "desc" },
    dossierFilter: "", debatOrde: "nieuw", agendaOrde: "oud", stukFilter: { q: "", soort: "", ministerie: "", max: 100 },
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
    const [config, dossiers, debatten, agenda, zaken, activiteiten, meta, stukken, synoniemen, themas, toezeggingenData] = await Promise.all([
      load("pipeline/config.json", { sectoren: {} }),
      load("data/dossiers.json", { fasen: [], dossiers: [] }),
      load("data/debatten.json", { debatten: [] }),
      load("data/agenda.json", { items: [] }),
      load("data/tk/zaken.json", []),
      load("data/tk/activiteiten.json", []),
      load("data/tk/meta.json", {}),
      load("data/tk/stukken.json", []),
      load("data/zoeksynoniemen.json", { groepen: [] }),
      load("data/themas.json", { themas: [], terugval: {} }),
      load("data/tk/toezeggingen.json", []),
    ]);
    S.data = { config, dossiers, debatten: debatten.debatten, agenda: agenda.items, zaken, activiteiten, meta, stukken, synoniemen, themas, toezeggingen: toezeggingenData };
    if (!zaken.length && !activiteiten.length && !debatten.debatten.length) {
      $("#stamp").textContent = "";
      $("#view").innerHTML = `<div class="card empty laadfout"><h2>De gegevens konden niet worden geladen</h2><p>Controleer je verbinding en probeer het opnieuw.</p><button type="button" class="knop" onclick="location.reload()">Opnieuw proberen</button></div>`;
      return;
    }
    S.T = window.MRThemas.maak(themas);
    // meest recente moment waarop data of samenvattingen zijn bijgewerkt
    const stempels = [meta.bijgewerkt, debatten.bijgewerkt, dossiers.bijgewerkt, agenda.bijgewerkt].filter(Boolean).map((t) => new Date(t)).filter((d) => !isNaN(d));
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

  let _vorigeTab = null;
  function route() {
    const pad = (location.hash || "#overzicht").slice(1).split("?")[0];
    let tab = pad.split("/")[0] || "overzicht";
    if (tab === "debatten") tab = "vergaderingen";
    document.querySelectorAll("nav.tabs a").forEach((a) => {
      const navTab = ["toezeggingen", "fracties"].includes(tab) ? "vergaderingen" : tab === "amendementen" ? "moties" : tab;
      a.classList.toggle("active", a.dataset.tab === navTab);
      if (a.dataset.tab === navTab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    const views = { overzicht, wetgeving, moties, amendementen: moties, vergaderingen, toezeggingen, fracties, stukken, agenda, over, zoeken };
    const TITELS = { agenda: "Agenda", wetgeving: "Wetgeving", moties: "Moties", amendementen: "Amendementen", vergaderingen: "Vergaderingen", toezeggingen: "Toezeggingen", fracties: "Per fractie", stukken: "Stukken van ministeries", over: "Over", zoeken: "Zoeken" };
    document.title = TITELS[tab] ? `${TITELS[tab]} · milieuradar` : "milieuradar";
    if (tab !== "agenda") S.agendaGescrold = false;
    { const v = $("#zoekveld"); if (tab === "zoeken") { if (document.activeElement !== v) v.value = zoekVraag(); } else v.value = ""; }
    $("#view").innerHTML = (views[tab] || overzicht)();
    const tabGewisseld = tab !== _vorigeTab, eerste = _vorigeTab === null;
    if (tabGewisseld) { const v = $("#view"); v.classList.remove("binnenkomst"); void v.offsetWidth; v.classList.add("binnenkomst"); }
    _vorigeTab = tab;
    zetKopHoogte(); zetGlij(!eerste); zetNavRand();
    if (tabGewisseld && !eerste && !pad.includes("/")) {
      const bewaard = _klik ? null : _scrollBij.get(location.hash || "#overzicht");
      if (bewaard != null) setTimeout(() => window.scrollTo(0, bewaard), 0);
      else if (tab !== "agenda") window.scrollTo(0, 0);
    }
    _klik = false;
    zetScrollRand(); zetBoven();
    if (tab === "moties" || tab === "amendementen") bindMoties();
    if (tab === "stukken") bindStukken();
    if (tab === "zoeken") renderZoekResultaten();
    if (tab === "overzicht" && window.MRMilieu) MRMilieu.vul();
    const sub = tab === "vergaderingen" ? null : pad.split("/")[1];
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
  function faseIndex(code) { return S.data.dossiers.fasen.findIndex((f) => f.code === code); }

  /* ---------- Dossiers: koppeling van debatten en agenda aan dossiers ---------- */
  // Een debat of agenda-item hoort bij een dossier als (1) het handmatig is gekoppeld (veld "dossiers"),
  // (2) een van de agendastukken in een Kamerstukdossier van dat dossier zit, of (3) een zoekterm in het onderwerp staat.
  // Eén debat kan zo bij meerdere dossiers horen.
  let _dos = null;
  function alleDossiers() {
    if (_dos) return _dos;
    const D = S.data.dossiers;
    const norm = (d, groep) => ({
      id: d.id, groep, titel: d.kortTitel || d.titel,
      kamerstukken: [d.kamerstuk, ...(d.kamerstukken || [])].filter(Boolean).map(String),
      zoektermen: (d.zoektermen || []).map((z) => z.toLowerCase()),
      sectoren: d.sectoren || (d.sector ? [d.sector] : []),
    });
    _dos = [...(D.beleidsdossiers || []).map((d) => norm(d, "Beleidsdossiers")), ...D.dossiers.map((d) => norm(d, "Wetgeving"))];
    return _dos;
  }
  const dossierTitel = (id) => alleDossiers().find((d) => d.id === id)?.titel || id;
  const _actCache = new Map();
  function dossiersVanActiviteit(a) {
    if (!a) return [];
    if (_actCache.has(a.Nummer)) return _actCache.get(a.Nummer);
    const nums = new Set();
    let tekst = a.Onderwerp || "";
    for (const ap of a.agendapunten || []) {
      tekst += " | " + (ap.onderwerp || "");
      for (const st of ap.stukken || []) { if (st.kamerstuk) nums.add(st.kamerstuk.split("-")[0]); }
    }
    // Kamerstuknummers in de titel, bv. "Begroting (37 020-XXIII)"
    for (const m of (a.Onderwerp || "").replace(/(\d{2}) (\d{3})/g, "$1$2").matchAll(/\b(\d{5})\b/g)) nums.add(m[1]);
    const t = tekst.toLowerCase();
    const uit = alleDossiers().filter((d) => d.kamerstukken.some((k) => nums.has(k)) || d.zoektermen.some((z) => t.includes(z))).map((d) => d.id);
    _actCache.set(a.Nummer, uit);
    return uit;
  }
  const uniek = (arr) => [...new Set(arr)];
  const dossiersVanDebat = (d) => uniek([...(d.dossiers || []), ...dossiersVanActiviteit(activiteitVan(d))]);
  const dossiersVanAgendaItem = (i) => uniek([...(i.dossiers || []), ...(i.dossier ? [i.dossier] : []), ...dossiersVanActiviteit(i._act)]);
  const pastBijFilter = (ids) => !S.dossierFilter || ids.includes(S.dossierFilter);

  function dossierChips(ids) {
    if (!ids.length) return "";
    return `<span class="dchips">${ids.map((id) => `<button type="button" class="dchip" data-setdossier="${esc(id)}" aria-pressed="${!!(S.vf && S.vf.dossier.includes(id) && location.hash.startsWith("#vergaderingen")) || S.agendaDossier === id}" title="Toon alles bij dit dossier">${esc(dossierTitel(id))}</button>`).join("")}</span>`;
  }

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
  const wetSoort = (type) => (/^wetsvoorstel/i.test(type || "") ? "Wetsvoorstel" : type || "Wetsvoorstel");
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
    // wetgeving: de laatste stap van de gevolgde dossiers, plus nieuwe wetsvoorstellen die (nog) geen eigen dossier hebben
    const gevolgd = S.data.dossiers.dossiers.filter(inSector);
    const bekend = new Set(gevolgd.map((d) => String(d.kamerstuk)));
    for (const d of gevolgd) {
      const s = d.laatsteStap;
      if (!s || !isDag(s.datum)) continue;
      items.push({ soort: "Wetgeving", datum: s.datum, html: feedLi(wetSoort(d.type), s.datum, feedMeta(d.kamerstuk ? `<span class="mono">${esc(d.kamerstuk)}</span>` : ""),
        d.kortTitel || d.titel, `#wetgeving/w-${d.id}`, esc(s.tekst), false) });
    }
    for (const z of wetsvoorstellenTK()) {
      if (!isDag(z.gestartOp) || z.dossiers.some((x) => bekend.has(String(x.nummer)))) continue;
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

  /* ---------- Wetgeving ---------- */
  function dossierCard(d, compact) {
    const fasen = S.data.dossiers.fasen;
    const idx = faseIndex(d.fase);
    const gekoppeld = d.kamerstuk ? S.data.zaken.filter((z) => (z.soort === "Motie" || z.soort === "Amendement") && z.dossiers.some((x) => String(x.nummer) === String(d.kamerstuk))) : [];
    const deb = uniek([...(d.debatten || []).map((id) => S.data.debatten.find((x) => x.id === id)),
      ...S.data.debatten.filter((x) => dossiersVanDebat(x).includes(d.id))]).filter(Boolean).sort((a, b) => b.datum.localeCompare(a.datum));
    return `<div class="card ${d.prioriteit ? "prio" : ""}" id="w-${esc(d.id)}">
      <div class="small muted">${d.prioriteit && !compact ? `<span class="prio-label">Aandachtsdossier</span> · ` : ""}${esc(d.type)}${d.kamerstuk ? ` · Kamerstuk <span class="mono">${esc(d.kamerstuk)}</span>` : " · nog geen Kamerstuknummer"} · ${esc(d.thema || "")}</div>
      <h3>${esc(d.titel)}</h3>
      <div class="stepper" title="Fase: ${esc(fasen[idx]?.naam || d.fase)}">${fasen.map((f, i) => `<span class="st ${i < idx ? "done" : i === idx ? "now" : ""}"></span>`).join("")}</div>
      <div class="steplabels">${fasen.map((f, i) => `<span class="${i === idx ? "now" : "hide-sm"}">${esc(f.naam)}</span>`).join("")}</div>
      <div class="dos-kolommen"><div class="dos-tekst"><p>${esc(d.samenvatting)}</p>
      ${!compact && d.kanttekeningen?.length ? `<h4>Kanttekeningen</h4><ul>${d.kanttekeningen.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>` : ""}</div>
      <dl class="facts">
        ${d.laatsteStap ? `<dt>Laatste stap</dt><dd>${fmtDatum(d.laatsteStap.datum)}: ${esc(d.laatsteStap.tekst)}</dd>` : ""}
        ${d.volgendeStap ? `<dt>Volgende stap</dt><dd>${fmtDatum(d.volgendeStap.datum)}: ${esc(d.volgendeStap.tekst)}</dd>` : ""}
        ${d.deadline ? `<dt>Deadline</dt><dd><b>${fmtDatum(d.deadline.datum)}</b>: ${esc(d.deadline.tekst)}</dd>` : ""}
        ${(d.stemmingen || []).map((s) => `<dt>Stemming ${esc(s.kamer)}</dt><dd>${fmtDatum(s.datum)}: ${esc(s.uitslag)}</dd>`).join("")}
      </dl></div>
      ${deb.length ? `<div class="small voetregel">Debatten: ${deb.map((x) => `<a href="#vergaderingen/d-${x.id}">${esc(x.titel)} (${fmtKort(x.datum)})</a>`).join(" · ")}</div>` : ""}
      ${gekoppeld.length ? `<div class="small">Moties en amendementen bij dit dossier: <a href="#moties" data-dossier="${esc(d.kamerstuk)}">${gekoppeld.length}</a></div>` : ""}
      <div class="kaartvoet">${compact ? `<a href="#wetgeving/w-${esc(d.id)}">Volledig dossier</a>` : ""}<a href="#vergaderingen?dossier=${encodeURIComponent(d.id)}">Vergaderingen bij dit dossier</a><a href="#agenda?dossier=${encodeURIComponent(d.id)}">Agenda</a></div>
      ${!compact && d.bronnen?.length ? `<div class="small muted voetregel">Bronnen: ${d.bronnen.map((b) => `<a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.titel)}</a>`).join(" · ")}</div>` : ""}
    </div>`;
  }
  function wetgeving() {
    const dos = S.data.dossiers.dossiers.filter(inSector).sort((a, b) => (b.prioriteit - a.prioriteit) || faseIndex(a.fase) - faseIndex(b.fase));
    const bekend = new Set(dos.map((d) => String(d.kamerstuk)));
    const extra = wetsvoorstellenTK().filter((z) => !z.dossiers.some((x) => bekend.has(String(x.nummer))));
    return `<h2>Wetgeving</h2>
      <p class="muted small">Gesorteerd van vroege naar late fase. Het aandachtsdossier staat bovenaan.</p>
      <div class="grid">${dos.map((d) => dossierCard(d, false)).join("")}</div>
      ${extra.length ? `<h2>Automatisch gevonden wetsvoorstellen</h2><div class="tablewrap"><table><thead><tr><th>Dossier</th><th>Titel</th><th>Gestart</th><th>Status</th></tr></thead><tbody>
        ${extra.map((z) => `<tr><td class="nw">${dossierLabel(z)}</td><td><a class="ltitel" href="${esc(z.link)}" target="_blank" rel="noopener">${esc(z.titel || z.onderwerp)}</a></td><td class="nw">${fmtKort(z.gestartOp)}</td><td>${uitslagPill(z.uitslag)}</td></tr>`).join("")}
      </tbody></table></div>` : ""}`;
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
      <th class="rechts hide-sm">Dossier</th>
      <th class="rechts dkop" aria-sort="${asc ? "ascending" : "descending"}"><button type="button" class="sorteer actief" data-sort="datum" aria-label="Datum, ${asc ? "oudste" : "nieuwste"} eerst; klik om om te draaien">Datum${ico(asc ? "pijlop" : "pijlneer")}</button></th>
    </tr>`;
  }

  function moties() {
    const tab = location.hash.slice(1).split(/[/?]/)[0] === "amendementen" ? "amendementen" : "moties";
    const soort = SOORT_VAN_TAB[tab];
    return `${motieNav(tab)}<h2 class="sr-only">${tab === "moties" ? "Moties" : "Amendementen"}</h2>
      <div class="filters motiezoek"><input type="search" id="mq" placeholder="Zoek op onderwerp, Kamerlid of dossier" value="${esc(S.motieFilter.q)}" aria-label="Zoeken"></div>
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
          <td class="dossier rechts mono hide-sm">${esc(dossierLabel(z))}</td>
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
      <div class="small muted">${dossier ? `<span class="mono">${esc(x.kamerstuk || dossier.nummer)}</span> ${esc(dossier.titel || "")}` : `<span class="mono">${esc(x.id)}</span>`}</div>${themaChips(themasVanTekst(x.onderwerp || x.titel, x.sectoren))}</li>`;
  }
  function stukken() {
    const all = stukkenInSector();
    const f = S.stukFilter;
    const ministeries = [...new Set(all.map((x) => x.ministerie).filter(Boolean))].sort();
    const opt = (v, l, cur) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(l)}</option>`;
    return `<h2>Stukken van ministeries</h2>
      <p class="small muted">Kamerbrieven en antwoorden op Kamervragen sinds het begin van de Kamerperiode die over milieu, klimaat, energie, water, natuur of leefomgeving gaan. Een stuk staat hier als het in een relevant Kamerstukdossier zit of als de titel een trefwoord bevat; alle brieven van het ministerie van Klimaat en Groene Groei staan erin. De selectie is automatisch en kan dus iets te ruim of te krap zijn.</p>
      <div class="filters">
        <input type="search" id="sq" placeholder="Zoek op onderwerp, dossier of bewindspersoon" value="${esc(f.q)}" aria-label="Zoeken">
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

  function debatCard(d, it) {
    const s = d.samenvatting || {};
    const a = activiteitVan(d) || {};
    const lijst = (a2) => `<ul>${a2.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
    const blok = (t, inhoud) => (inhoud ? `<section><h4>${t}</h4>${inhoud}</section>` : "");
    const commissie = a.Voortouwnaam ? commissieNaam(a) : d.commissie;
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
      ? `<ul class="tzlijst">${officieel.map((t) => `<li>${statusPill(t.status)} ${esc(t.tekst)} <span class="small muted">(${esc(t.bewindspersoon)})</span></li>`).join("")}</ul><div class="small muted">Uit het toezeggingenregister van de Kamer. <a href="#toezeggingen">Alle toezeggingen</a></div>`
      : (s.toezeggingen || []).length ? lijst(s.toezeggingen) : "") +
      ((s.doorgeleid || []).length ? `<div class="small muted">Doorgeleid:</div>${lijst(s.doorgeleid)}` : "");
    const tkLink = a.tkLink || d.tkLink;
    return `<article class="card debat" id="d-${esc(d.id)}">
      <div class="meta">${esc(commissie || "")} · <span class="datum">${fmtKort(d.datum)}</span></div>
      <div class="titelrij"><span class="tag">${esc(d.type)}</span><h3>${esc(d.titel)}</h3>${d.niveau === "kort" ? `<span class="badge stil" title="Korte samenvatting: alleen de hoofdlijn">Kort</span>` : ""}</div>
      <div class="kaartlabels">${themaChips(it ? it.thema : themasVanDebat(d), true)}${dossierChips(it ? it.dossier : dossiersVanDebat(d))}</div>
      ${it && it.ministerie.length ? `<div class="small muted">Ministerie: ${esc(it.ministerie.join(", "))}</div>` : ""}
      <div class="links">
        ${d.video ? `<a href="${esc(d.video)}" target="_blank" rel="noopener">Terugkijken op Debat Direct</a>` : ""}
        ${tkLink ? `<a href="${esc(tkLink)}" target="_blank" rel="noopener">Pagina Tweede Kamer</a>` : ""}
        <a href="${esc(d.bron)}" target="_blank" rel="noopener">Transcript</a>
      </div>
      <button class="toggle" aria-expanded="false" aria-controls="b-${esc(d.id)}"><span class="pijltje" aria-hidden="true"></span><span class="dicht">Toon samenvatting</span><span class="opn">Verberg samenvatting</span></button>
      <div class="body-wrap"><div class="body" id="b-${esc(d.id)}">
        <div class="sam-raster"><div class="sam-hoofd">
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
      </div></div>
    </article>`;
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
  function agendaLi(i, chips) {
    return `<li><div class="regelmeta"><span class="datum">${fmtKort(i.datum)}${i.tijd ? ` ${esc(i.tijd)}` : ""}</span><span class="tag">${esc(i.type)}</span></div><div>${i.url ? `<a class="ltitel" href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.titel)}</a>` : `<span class="ltitel">${esc(i.titel)}</span>`}</div>${i.commissie ? `<div class="small muted">${esc(i.commissie)}</div>` : ""}${chips ? dossierChips(dossiersVanAgendaItem(i)) : ""}</li>`;
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
  function themasVanAct(a) {
    if (!a) return [];
    if (!_themaCache.has(a.Nummer)) _themaCache.set(a.Nummer, S.T.voor(a.Onderwerp, (a.agendapunten || []).map((ap) => ap.onderwerp), a.sectoren));
    return _themaCache.get(a.Nummer);
  }
  function themasVanDebat(d) {
    if (d.themas && d.themas.length) return d.themas;
    const a = activiteitVan(d);
    return S.T.voor(d.titel, (a?.agendapunten || []).map((ap) => ap.onderwerp), d.sector ? [d.sector] : []);
  }
  const themasVanTekst = (titel, sectoren) => S.T.voor(titel, [], sectoren);
  function themaChips(ids, klikbaar) {
    if (!ids || !ids.length) return "";
    return `<span class="tchips">${ids.map((id) => klikbaar
      ? `<button type="button" class="tchip" data-vthema="${esc(id)}" title="Toon alle vergaderingen over ${esc(S.T.naam(id))}"><i style="background:${S.T.kleur(id)}"></i>${esc(S.T.naam(id))}</button>`
      : `<span class="tchip"><i style="background:${S.T.kleur(id)}"></i>${esc(S.T.naam(id))}</span>`).join("")}</span>`;
  }
  const arr = (x) => (Array.isArray(x) ? x : x ? [x] : []);

  /* ---------- Vergaderingen ---------- */
  // Alle uitgevoerde vergaderingen: samengevat (kaart met samenvatting) of nog niet samengevat (compacte kaart).
  let _vi = null;
  function vergaderItems() {
    if (_vi) return _vi;
    const items = [];
    const mk = (d, a) => ({
      d, a, id: d ? "d-" + d.id : "a-" + a.Nummer,
      datum: d ? d.datum : dagNL(new Date(a.Datum)), t: a?.Datum || d?.datum || "",
      titel: d ? d.titel : a.Onderwerp,
      type: typeNaam(a ? a.Soort : d.type),
      commissie: uniek([a && (a.Voortouwnaam || a.Voortouwafkorting) ? commissieNaam(a) : d?.commissie, ...((d && d.commissies) || [])].filter(Boolean)),
      ministerie: uniek([...ministeriesVan(a), ...((d && d.ministeries) || [])]),
      thema: d ? themasVanDebat(d) : themasVanAct(a),
      dossier: d ? dossiersVanDebat(d) : dossiersVanActiviteit(a),
      sam: d ? "ja" : "nee",
    });
    for (const d of S.data.debatten) items.push(mk(d, activiteitVan(d) || S.data.activiteiten.find((a) => samengevatVoor(a) === d)));
    for (const a of S.data.activiteiten) if (isDebat(a) && a.Status === "Uitgevoerd" && a.Datum && !samengevatVoor(a)) items.push(mk(null, a));
    return (_vi = items);
  }
  const FACETTEN = [["type", "Type"], ["commissie", "Commissie"], ["ministerie", "Ministerie"], ["thema", "Thema"], ["dossier", "Dossier"]];
  const GROEPEN = [["", "Niet groeperen"], ["maand", "Maand"], ["type", "Type"], ["commissie", "Commissie"], ["ministerie", "Ministerie"], ["thema", "Thema"], ["dossier", "Dossier"]];
  const facetLabel = (f, v) => (f === "thema" ? S.T.naam(v) : f === "dossier" ? dossierTitel(v) : v);
  function leesVF() {
    const p = new URLSearchParams(location.hash.split("?")[1] || "");
    const lijst = (k) => (p.get(k) ? p.get(k).split(",").filter(Boolean) : []);
    S.vf = { type: lijst("type"), commissie: lijst("commissie"), ministerie: lijst("ministerie"), thema: lijst("thema"), dossier: lijst("dossier"),
      sam: p.get("samenvatting") || "", groep: p.get("groep") || "", orde: p.get("orde") || "nieuw" };
  }
  function vfUrl() {
    const p = [];
    for (const [f] of FACETTEN) if (S.vf[f].length) p.push(`${f}=${S.vf[f].map(encodeURIComponent).join(",")}`);
    if (S.vf.sam) p.push("samenvatting=" + S.vf.sam);
    if (S.vf.groep) p.push("groep=" + S.vf.groep);
    if (S.vf.orde !== "nieuw") p.push("orde=" + S.vf.orde);
    return "#vergaderingen" + (p.length ? "?" + p.join("&") : "");
  }
  function vfToepassen() { history.replaceState(null, "", vfUrl()); renderVergaderingen(); }
  const vfPast = (it, behalve) => FACETTEN.every(([f]) => f === behalve || !S.vf[f].length || arr(it[f]).some((v) => S.vf[f].includes(v))) && (!S.vf.sam || it.sam === S.vf.sam);

  function vergaderingen() {
    leesVF();
    setTimeout(() => {
      renderVergaderingen();
      const sub = location.hash.split("?")[0].split("/")[1];
      const t = sub && document.getElementById(sub);
      if (t) { t.classList.add("open"); t.scrollIntoView({ block: "start" }); }
    }, 0);
    return `${subnav("vergaderingen")}<h2>Vergaderingen</h2>
      <p class="muted small">Debatten, overleggen, briefings en rondetafelgesprekken die zijn geweest. Wat nog komt staat in de <a href="#agenda">agenda</a>. Samenvattingen zijn gebaseerd op automatische transcripten; geen officiële bron.</p>
      <div id="vergaderwrap"></div>`;
  }
  function renderVergaderingen() {
    const el = $("#vergaderwrap");
    if (!el) return;
    const open = S.vOpen || "";
    const alle = vergaderItems();
    const lijst = alle.filter((it) => vfPast(it));
    const desc = S.vf.orde !== "oud";
    lijst.sort((a, b) => (desc ? b.t.localeCompare(a.t) : a.t.localeCompare(b.t)));

    const facet = ([f, label]) => {
      const tel = new Map();
      for (const it of alle) if (vfPast(it, f)) for (const v of arr(it[f])) tel.set(v, (tel.get(v) || 0) + 1);
      for (const v of S.vf[f]) if (!tel.has(v)) tel.set(v, 0);
      const waarden = [...tel.entries()].sort((a, b) => b[1] - a[1] || facetLabel(f, a[0]).localeCompare(facetLabel(f, b[0])));
      const n = S.vf[f].length;
      return `<details class="facet" data-f="${f}" ${open === f ? "open" : ""}>
        <summary>${label}${n ? ` <span class="facet-n">${n}</span>` : ""}</summary>
        <div class="facet-menu" role="group" aria-label="${label}">
          ${waarden.map(([v, c], i) => `<label><input type="checkbox" id="vf-${f}-${i}" data-f="${f}" value="${esc(v)}" ${S.vf[f].includes(v) ? "checked" : ""}>
            ${f === "thema" ? `<i class="dotje" style="background:${S.T.kleur(v)}"></i>` : ""}<span>${esc(facetLabel(f, v))}</span><span class="n">${c}</span></label>`).join("") || `<div class="muted small">Geen waarden</div>`}
        </div></details>`;
    };
    const actief = FACETTEN.flatMap(([f]) => S.vf[f].map((v) => `<button type="button" class="chip actief" data-rm="${f}" data-v="${esc(v)}" aria-label="Filter ${esc(facetLabel(f, v))} wissen">${f === "thema" ? `<span class="sdot" style="background:${S.T.kleur(v)}"></span>` : ""}${esc(facetLabel(f, v))}${ico("x")}</button>`));
    if (S.vf.sam) actief.push(`<button type="button" class="chip actief" data-rm="sam">${S.vf.sam === "ja" ? "Met" : "Zonder"} samenvatting${ico("x")}</button>`);

    const render = (l) => `<div class="grid">${l.map((it) => (it.d ? debatCard(it.d, it) : vergaderCompact(it))).join("")}</div>`;
    let inhoud;
    if (!lijst.length) inhoud = `<p class="empty">Geen vergaderingen met deze filters</p>`;
    else if (!S.vf.groep) inhoud = render(lijst);
    else {
      const sleutel = (it) => (S.vf.groep === "maand" ? [it.datum.slice(0, 7)] : arr(it[S.vf.groep]));
      const groepen = new Map();
      for (const it of lijst) { const ks = sleutel(it); for (const k of ks.length ? ks : ["(onbekend)"]) { if (!groepen.has(k)) groepen.set(k, []); groepen.get(k).push(it); } }
      let volg = [...groepen.entries()];
      if (S.vf.groep === "maand") volg.sort((a, b) => (desc ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0])));
      else volg.sort((a, b) => b[1].length - a[1].length || String(a[0]).localeCompare(String(b[0])));
      const kop = (k) => (S.vf.groep === "maand" ? (k === "(onbekend)" ? k : `${MAANDEN[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`)
        : S.vf.groep === "thema" ? `<i class="dotje" style="background:${S.T.kleur(k)}"></i>${esc(S.T.naam(k))}` : esc(facetLabel(S.vf.groep, k)));
      inhoud = volg.map(([k, l]) => `<h3 class="groepkop">${kop(k)} <span class="muted small">(${l.length})</span></h3>${render(l)}`).join("");
    }
    const nSam = lijst.filter((it) => it.d).length;
    el.innerHTML = `
      <div class="filterbalk">
        <div class="facetten">${FACETTEN.map(facet).join("")}</div>
        <div class="filterkeuzes">
          <label class="label" for="vsam">Samenvatting</label>
          <select id="vsam"><option value="">Alle</option><option value="ja" ${S.vf.sam === "ja" ? "selected" : ""}>Met samenvatting</option><option value="nee" ${S.vf.sam === "nee" ? "selected" : ""}>Nog niet samengevat</option></select>
          <label class="label" for="vgroep">Groeperen</label>
          <select id="vgroep">${GROEPEN.map(([v, l]) => `<option value="${v}" ${S.vf.groep === v ? "selected" : ""}>${l}</option>`).join("")}</select>
          <label class="label" for="vorde">Ordenen</label>
          <select id="vorde"><option value="nieuw">Nieuwste eerst</option><option value="oud" ${S.vf.orde === "oud" ? "selected" : ""}>Oudste eerst</option></select>
        </div>
        ${actief.length ? `<div class="actieve-filters">${actief.join("")}<button type="button" class="linkknop" data-wis>Alles wissen</button></div>` : ""}
      </div>
      <p class="small muted telregel">${nl(lijst.length)} ${lijst.length === 1 ? "vergadering" : "vergaderingen"}, waarvan ${nl(nSam)} samengevat</p>
      ${inhoud}`;
    bindVergaderingen();
  }
  function bindVergaderingen() {
    const el = $("#vergaderwrap");
    el.querySelectorAll("details.facet").forEach((d) => d.addEventListener("toggle", () => {
      if (d.open) { S.vOpen = d.dataset.f; el.querySelectorAll("details.facet").forEach((o) => { if (o !== d) o.open = false; }); }
      else if (S.vOpen === d.dataset.f) S.vOpen = "";
    }));
    el.querySelectorAll("input[data-f]").forEach((cb) => cb.addEventListener("change", () => {
      const f = cb.dataset.f, v = cb.value;
      S.vf[f] = cb.checked ? uniek([...S.vf[f], v]) : S.vf[f].filter((x) => x !== v);
      const id = cb.id;
      vfToepassen();
      const terug = document.getElementById(id); if (terug) terug.focus();
    }));
    el.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => {
      if (b.dataset.rm === "sam") S.vf.sam = ""; else S.vf[b.dataset.rm] = S.vf[b.dataset.rm].filter((x) => x !== b.dataset.v);
      vfToepassen();
    }));
    const wis = el.querySelector("[data-wis]");
    if (wis) wis.addEventListener("click", () => { for (const [f] of FACETTEN) S.vf[f] = []; S.vf.sam = ""; vfToepassen(); });
    $("#vsam").addEventListener("change", (e) => { S.vf.sam = e.target.value; vfToepassen(); });
    $("#vgroep").addEventListener("change", (e) => { S.vf.groep = e.target.value; vfToepassen(); });
    $("#vorde").addEventListener("change", (e) => { S.vf.orde = e.target.value; vfToepassen(); });
    const wissel = (kaart) => {
      const open = kaart.classList.toggle("open");
      kaart.querySelector(".toggle").setAttribute("aria-expanded", open);
      // bij inklappen de kaart in beeld houden, zodat je niet ergens verderop in de lijst belandt
      if (!open && kaart.getBoundingClientRect().top < 0) kaart.scrollIntoView({ block: "start" });
    };
    el.querySelectorAll(".debat .toggle").forEach((b) => b.addEventListener("click", () => wissel(b.closest(".debat"))));
    el.querySelectorAll("[data-inklap]").forEach((b) => b.addEventListener("click", () => { const k = b.closest(".debat"); wissel(k); k.querySelector(".toggle").focus({ preventScroll: true }); }));
  }
  // Escape sluit een open filtermenu en zet de focus terug op de knop
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const open = document.querySelector("details.facet[open]");
    if (open) { open.open = false; S.vOpen = ""; open.querySelector("summary").focus(); }
  });
  // klik buiten een open filtermenu sluit het
  document.addEventListener("click", (e) => {
    if (e.target.closest("details.facet")) return;
    document.querySelectorAll("details.facet[open]").forEach((d) => { d.open = false; });
    S.vOpen = "";
  });
  function vergaderCompact(it) {
    const a = it.a;
    return `<article class="card debat compact" id="${esc(it.id)}">
      <div class="meta">${esc(it.commissie.join(" · "))} · <span class="datum">${fmtKort(it.datum)}${a.Aanvangstijd ? " " + tijdNL(a.Aanvangstijd) : ""}</span></div>
      <div class="titelrij"><span class="tag">${esc(it.type)}</span><h3><a href="${esc(a.tkLink || `https://berthub.eu/tkconv/activiteit.html?nummer=${a.Nummer}`)}" target="_blank" rel="noopener">${esc(a.Onderwerp)}</a></h3><span class="badge stil">Nog niet samengevat</span></div>
      <div class="kaartlabels">${themaChips(it.thema, true)}${dossierChips(it.dossier)}</div>
      ${it.ministerie.length ? `<div class="small muted">Ministerie: ${esc(it.ministerie.join(", "))}</div>` : ""}
      ${((ms) => ms.length ? `<details class="motiedetails"><summary>${ms.length} ${ms.length === 1 ? "motie" : "moties"} (${ms.filter((z) => z.uitslag === "aangenomen").length} aangenomen)</summary>${motieLijst(ms)}</details>` : "")(motiesBijActiviteiten([a.Nummer]))}
    </article>`;
  }

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

  /* ---------- Toezeggingen ---------- */
  // Officiële toezeggingen uit het register van de Kamer, aangevuld met toezeggingen uit onze samenvattingen
  // voor vergaderingen waarvan het register (nog) niets bevat.
  const subnav = (actief) => `<nav class="subnav" aria-label="Onderdelen van vergaderingen">
      ${[["vergaderingen", "Vergaderingen"], ["toezeggingen", "Toezeggingen"], ["fracties", "Per fractie"]].filter(([k]) => k !== "fracties" || typeof fracties === "function")
        .map(([k, l]) => `<a href="#${k}" ${k === actief ? 'aria-current="page" class="actief"' : ""}>${l}</a>`).join("")}
    </nav>`;
  const actPerNummer = () => S._actNr || (S._actNr = new Map(S.data.activiteiten.map((a) => [a.Nummer, a])));
  const debatVanAct = (nr) => { const a = actPerNummer().get(nr); return a ? samengevatVoor(a) : S.data.debatten.find((d) => d.activiteit === nr); };
  let _tz = null;
  function toezeggingItems() {
    if (_tz) return _tz;
    const items = (S.data.toezeggingen || []).map((t) => {
      const a = actPerNummer().get(t.activiteit);
      const d = debatVanAct(t.activiteit);
      return { ...t, bron: "register", a, d,
        thema: d ? themasVanDebat(d) : a ? themasVanAct(a) : S.T.voor(t.tekst, [], []),
        vergadering: d ? d.titel : a ? a.Onderwerp : "", vergaderLink: d ? `#vergaderingen/d-${d.id}` : a ? (a.tkLink || "") : "",
        vergaderDatum: d ? d.datum : a?.Datum ? dagNL(new Date(a.Datum)) : "" };
    });
    const metRegister = new Set(items.map((t) => t.activiteit));
    for (const d of S.data.debatten) {
      const nrs = [d.activiteit, ...(d.extraActiviteiten || [])].filter(Boolean);
      if (nrs.some((n) => metRegister.has(n))) continue;
      const a = activiteitVan(d);
      for (const tekst of (d.samenvatting || {}).toezeggingen || []) {
        items.push({ tekst, bron: "samenvatting", status: "", ministerie: (ministeriesVan(a)[0]) || "", bewindspersoon: d.bewindspersoon || "", d, a,
          thema: themasVanDebat(d), datum: d.datum, vergadering: d.titel, vergaderLink: `#vergaderingen/d-${d.id}`, vergaderDatum: d.datum });
      }
    }
    return (_tz = items.sort((x, y) => (y.datum || "").localeCompare(x.datum || "")));
  }
  function statusPill(s) {
    if (!s) return `<span class="status uit-samenvatting" title="Uit onze samenvatting van het transcript; staat (nog) niet in het register van de Kamer"><span class="dot" aria-hidden="true"></span>Uit samenvatting</span>`;
    const cls = /^afgedaan/i.test(s) ? "afgedaan" : "openstaand";
    return `<span class="status ${cls}"><span class="dot" aria-hidden="true"></span>${esc(hoofd(s.toLowerCase()))}</span>`;
  }
  function toezeggingen() {
    const p = new URLSearchParams(location.hash.split("?")[1] || "");
    S.tf = { status: p.get("status") || "", ministerie: p.get("ministerie") || "", thema: p.get("thema") || "", groep: p.get("groep") || "", q: S.tf?.q || "" };
    setTimeout(renderToezeggingen, 0);
    return `${subnav("toezeggingen")}<h2>Toezeggingen</h2>
      <p class="muted small">Wat bewindspersonen in vergaderingen hebben toegezegd. De status komt uit het <a href="https://www.tweedekamer.nl/kamerstukken/toezeggingen" target="_blank" rel="noopener">toezeggingenregister van de Tweede Kamer</a>; dat wordt bijgehouden door de Kamer en loopt soms wat achter. Voor recente vergaderingen zonder registratie staan de toezeggingen uit onze samenvatting.</p>
      <div id="tzwrap"></div>`;
  }
  function tfUrl() {
    const p = [];
    for (const k of ["status", "ministerie", "thema", "groep"]) if (S.tf[k]) p.push(`${k}=${encodeURIComponent(S.tf[k])}`);
    return "#toezeggingen" + (p.length ? "?" + p.join("&") : "");
  }
  function renderToezeggingen() {
    const el = $("#tzwrap");
    if (!el) return;
    const alle = toezeggingItems();
    const q = S.tf.q.trim().toLowerCase();
    const lijst = alle.filter((t) => (!S.tf.status || (S.tf.status === "samenvatting" ? !t.status : t.status === S.tf.status)) &&
      (!S.tf.ministerie || t.ministerie === S.tf.ministerie) && (!S.tf.thema || t.thema.includes(S.tf.thema)) &&
      (!q || `${t.tekst} ${t.bewindspersoon} ${t.vergadering}`.toLowerCase().includes(q)));
    const tel = (f) => alle.filter(f).length;
    const ministeries = uniek(alle.map((t) => t.ministerie).filter(Boolean)).sort();
    const opt = (v, l, cur) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(l)}</option>`;
    const item = (t) => `<li class="tz">
      <div class="zmeta">${statusPill(t.status)}<span class="datum">${fmtKort(t.datum)}</span>${t.bewindspersoon ? `<span>${esc(t.bewindspersoon)}</span>` : ""}${t.ministerie ? `<span>${esc(t.ministerie)}</span>` : ""}${t.nakoming ? `<span>afgedaan ${fmtKort(t.nakoming)}</span>` : ""}</div>
      <div class="tz-tekst">${esc(t.tekst)}</div>
      <div class="kaartlabels">${t.vergadering ? `<span class="small">Bij: ${t.vergaderLink ? `<a href="${esc(t.vergaderLink)}" ${t.vergaderLink.startsWith("#") ? "" : 'target="_blank" rel="noopener"'}>${esc(t.vergadering)}</a>` : esc(t.vergadering)}${t.vergaderDatum ? ` (${fmtKort(t.vergaderDatum)})` : ""}</span>` : ""}${themaChips(t.thema)}</div>
    </li>`;
    let inhoud;
    if (!lijst.length) inhoud = `<p class="empty">Geen toezeggingen met deze filters</p>`;
    else if (!S.tf.groep) inhoud = `<div class="card"><ul class="list">${lijst.map(item).join("")}</ul></div>`;
    else {
      const sleutel = (t) => (S.tf.groep === "thema" ? (t.thema.length ? t.thema : ["(geen thema)"]) : [t[S.tf.groep] || "(onbekend)"]);
      const g = new Map();
      for (const t of lijst) for (const k of sleutel(t)) { if (!g.has(k)) g.set(k, []); g.get(k).push(t); }
      inhoud = [...g.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, l]) =>
        `<h3 class="groepkop">${S.tf.groep === "thema" && S.T.bestaat(k) ? `<i class="dotje" style="background:${S.T.kleur(k)}"></i>${esc(S.T.naam(k))}` : esc(k)} <span class="muted small">(${l.length})</span></h3><div class="card"><ul class="list">${l.map(item).join("")}</ul></div>`).join("");
    }
    el.innerHTML = `
      <div class="filterbalk">
        <div class="facetten" role="group" aria-label="Status">
          ${[["", "Alle", tel(() => true)], ["Openstaand", "Openstaand", tel((t) => t.status === "Openstaand")], ["Afgedaan", "Afgedaan", tel((t) => t.status === "Afgedaan")], ["samenvatting", "Uit samenvatting", tel((t) => !t.status)]]
            .map(([v, l, n]) => `<button type="button" class="chip" data-tstatus="${v}" aria-pressed="${S.tf.status === v}">${l} <span class="n">${nl(n)}</span></button>`).join("")}
        </div>
        <div class="filterkeuzes">
          <input type="search" id="tq" placeholder="Zoek in toezeggingen" value="${esc(S.tf.q)}" aria-label="Zoek in toezeggingen">
          <label class="label" for="tmin">Ministerie</label><select id="tmin">${opt("", "Alle ministeries", S.tf.ministerie)}${ministeries.map((m) => opt(m, m, S.tf.ministerie)).join("")}</select>
          <label class="label" for="tthema">Thema</label><select id="tthema">${opt("", "Alle thema's", S.tf.thema)}${S.T.lijst.map((t) => opt(t.id, t.naam, S.tf.thema)).join("")}</select>
          <label class="label" for="tgroep">Groeperen</label><select id="tgroep">${[["", "Niet groeperen"], ["ministerie", "Ministerie"], ["thema", "Thema"], ["bewindspersoon", "Bewindspersoon"], ["vergadering", "Vergadering"]].map(([v, l]) => opt(v, l, S.tf.groep)).join("")}</select>
        </div>
      </div>
      <p class="small muted telregel">${nl(lijst.length)} ${lijst.length === 1 ? "toezegging" : "toezeggingen"}</p>
      ${inhoud}`;
    const zet = () => { history.replaceState(null, "", tfUrl()); renderToezeggingen(); };
    el.querySelectorAll("[data-tstatus]").forEach((b) => b.addEventListener("click", () => { S.tf.status = b.dataset.tstatus; zet(); }));
    $("#tmin").addEventListener("change", (e) => { S.tf.ministerie = e.target.value; zet(); });
    $("#tthema").addEventListener("change", (e) => { S.tf.thema = e.target.value; zet(); });
    $("#tgroep").addEventListener("change", (e) => { S.tf.groep = e.target.value; zet(); });
    const tq = $("#tq");
    tq.addEventListener("input", () => { S.tf.q = tq.value; clearTimeout(S._tqt); S._tqt = setTimeout(() => { renderToezeggingen(); const n = $("#tq"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 200); });
  }

  /* ---------- Per fractie ---------- */
  // Alle fracties krijgen dezelfde opbouw en staan alfabetisch. GroenLinks-PvdA is voortgezet als PRO en telt daarom mee bij PRO.
  const FRACTIE_ALIAS = { "GroenLinks-PvdA": "PRO", "GL-PvdA": "PRO", "GroenLinks": "PRO", "PvdA": "PRO" };
  const fractieNaam = (f) => { const n = String(f || "").replace(/\s*\(.*\)\s*$/, "").replace(/^Lid\s+/i, "").trim(); return FRACTIE_ALIAS[n] || n; };
  let _fr = null;
  function fractieData() {
    if (_fr) return _fr;
    const fr = new Map();
    const get = (n) => { if (!fr.has(n)) fr.set(n, { naam: n, inbreng: [], ingediend: [], mede: [], stemmen: [] }); return fr.get(n); };
    for (const d of S.data.debatten) for (const p of (d.samenvatting || {}).partijen || []) { const n = fractieNaam(p.fractie); if (n) get(n).inbreng.push({ d, p }); }
    for (const z of S.data.zaken) {
      if (z.soort !== "Motie" && z.soort !== "Amendement") continue;
      for (const i of z.indieners || []) { const n = fractieNaam(i.fractie); if (!n) continue; (/^indiener/i.test(i.relatie || "") ? get(n).ingediend : get(n).mede).push(z); }
      const b = [...(z.besluiten || [])].reverse().find((x) => x.stemmen && x.stemmen.length);
      if (!b) continue;
      const per = new Map();
      for (const st of b.stemmen) { const n = fractieNaam(st.fractie); if (!n) continue; if (!per.has(n)) per.set(n, { Voor: 0, Tegen: 0 }); if (st.soort in per.get(n)) per.get(n)[st.soort]++; }
      for (const [n, t] of per) if (t.Voor + t.Tegen) get(n).stemmen.push({ z, voor: t.Voor >= t.Tegen });
    }
    // alleen fracties die deze Kamerperiode echt actief zijn (stemmen of inbreng)
    const lijst = [...fr.values()].filter((f) => f.stemmen.length >= 25 || f.inbreng.length).map((f) => ({ ...f, ingediend: uniek(f.ingediend), mede: uniek(f.mede) }))
      .sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
    return (_fr = lijst);
  }
  function fracties() {
    const p = new URLSearchParams(location.hash.split("?")[1] || "");
    const keuze = p.get("f") || "";
    const thema = p.get("thema") || "";
    const lijst = fractieData();
    const pct = (a, b) => (b ? Math.round((100 * a) / b) + "%" : "–");
    const kies = `<div class="filters" role="group" aria-label="Kies een fractie">${lijst.map((f) => `<a class="chip" href="#fracties?f=${encodeURIComponent(f.naam)}${thema ? "&thema=" + thema : ""}" aria-pressed="${f.naam === keuze}" ${f.naam === keuze ? 'aria-current="page"' : ""}>${esc(f.naam)}</a>`).join("")}</div>`;
    const themaKeuze = (basis) => `<div class="filterkeuzes"><label class="label" for="fthema">Thema</label><select id="fthema" onchange="location.hash='${basis}'+(this.value?'&thema='+this.value:'')">
      <option value="">Alle thema's</option>${S.T.lijst.map((t) => `<option value="${t.id}" ${t.id === thema ? "selected" : ""}>${esc(t.naam)}</option>`).join("")}</select></div>`;
    const zaakThemas = (z) => themasVanTekst(korteTitel(z), z.sectoren);
    const inThema = (ids) => !thema || ids.includes(thema);
    const intro = `${subnav("fracties")}<h2>Per fractie</h2>
      <p class="muted small">Wat elke fractie inbracht in de samengevatte vergaderingen, welke moties en amendementen ze indiende en hoe ze stemde over de moties en amendementen op milieuradar. Alle fracties krijgen dezelfde opbouw en staan op alfabet. PRO is de voortzetting van GroenLinks-PvdA; die worden samen geteld. Stemmen over moties zeggen niet alles: een fractie kan om uiteenlopende redenen voor of tegen stemmen.</p>
      ${kies}`;
    if (!keuze) {
      return `${intro}${themaKeuze("#fracties?")}
        <div class="tablewrap"><table><thead><tr><th>Fractie</th><th>Inbreng in samengevatte vergaderingen</th><th>Moties en amendementen ingediend (eerste indiener)</th><th>Daarvan aangenomen</th><th>Stemde voor (van de moties en amendementen waarover gestemd is)</th></tr></thead><tbody>
        ${lijst.map((f) => {
          const inb = f.inbreng.filter(({ d }) => inThema(themasVanDebat(d)));
          const ing = f.ingediend.filter((z) => inThema(zaakThemas(z)));
          const st = f.stemmen.filter(({ z }) => inThema(zaakThemas(z)));
          return `<tr><td><a href="#fracties?f=${encodeURIComponent(f.naam)}${thema ? "&thema=" + thema : ""}"><b>${esc(f.naam)}</b></a></td><td>${inb.length}</td><td>${ing.length}</td><td>${ing.filter((z) => z.uitslag === "aangenomen").length} (${pct(ing.filter((z) => z.uitslag === "aangenomen").length, ing.filter((z) => ["aangenomen", "verworpen"].includes(z.uitslag)).length)})</td><td>${st.filter((s) => s.voor).length} van ${st.length} (${pct(st.filter((s) => s.voor).length, st.length)})</td></tr>`;
        }).join("")}
        </tbody></table></div>`;
    }
    const f = lijst.find((x) => x.naam === keuze);
    if (!f) return `${intro}<p class="empty">Onbekende fractie.</p>`;
    const inb = f.inbreng.filter(({ d }) => inThema(themasVanDebat(d))).sort((a, b) => b.d.datum.localeCompare(a.d.datum));
    const ing = f.ingediend.filter((z) => inThema(zaakThemas(z))).sort((a, b) => (b.gestartOp || "").localeCompare(a.gestartOp || ""));
    const st = f.stemmen.filter(({ z }) => inThema(zaakThemas(z)));
    const perThema = S.T.lijst.map((t) => { const l = f.stemmen.filter(({ z }) => zaakThemas(z).includes(t.id)); return { t, n: l.length, voor: l.filter((s) => s.voor).length }; }).filter((x) => x.n >= 3);
    return `${intro}${themaKeuze(`#fracties?f=${encodeURIComponent(f.naam)}`)}
      <h2>${esc(f.naam)}</h2>
      <div class="stats drie">
        <div class="stat"><div class="num">${nl(inb.length)}</div><div class="lbl">keer inbreng in samengevatte vergaderingen</div></div>
        <div class="stat"><div class="num">${nl(ing.length)}</div><div class="lbl">moties en amendementen als eerste indiener, ${ing.filter((z) => z.uitslag === "aangenomen").length} aangenomen</div></div>
        <div class="stat"><div class="num">${pct(st.filter((s) => s.voor).length, st.length)}</div><div class="lbl">voor gestemd, ${nl(st.filter((s) => s.voor).length)} van ${nl(st.length)} stemmingen</div></div>
      </div>
      ${perThema.length && !thema ? `<h3 class="groepkop">Stemgedrag per thema</h3><div class="card"><ul class="list themastem">${perThema.map((x) => `<li><span class="tchip"><i style="background:${x.t.kleur}"></i>${esc(x.t.naam)}</span><span class="balk" role="img" aria-label="${x.voor} van ${x.n} voor"><span style="width:${(100 * x.voor) / x.n}%"></span></span><span class="small">${x.voor} van ${x.n} voor</span></li>`).join("")}</ul></div>` : ""}
      <h3 class="groepkop">Inbreng in vergaderingen <span class="muted small">(${inb.length})</span></h3>
      ${inb.length ? `<div class="card"><ul class="list">${inb.map(({ d, p }) => `<li><div class="zmeta"><span class="tag">${esc(d.type)}</span><span class="datum">${fmtKort(d.datum)}</span><span>${esc(p.spreker || "")}</span></div>
        <a class="ltitel" href="#vergaderingen/d-${esc(d.id)}">${esc(d.titel)}</a><div>${esc(p.positie)}</div>${p.link ? `<a class="small" href="${esc(p.link)}" target="_blank" rel="noopener">Terugluisteren</a>` : ""}</li>`).join("")}</ul></div>` : `<p class="empty">Geen inbreng in samengevatte vergaderingen${thema ? " over dit thema" : ""}.</p>`}
      <h3 class="groepkop">Ingediende moties en amendementen <span class="muted small">(${ing.length})</span></h3>
      ${ing.length ? `<div class="card"><ul class="motielijst">${ing.slice(0, 80).map((z) => `<li>${uitslagPill(z.uitslag)} <span class="tag">${esc(z.soort)}</span> <a href="${esc(z.link)}" target="_blank" rel="noopener">${esc(korteTitel(z))}</a> <span class="small muted datum">${fmtKort(z.gestartOp)}</span></li>`).join("")}</ul>${ing.length > 80 ? `<p class="small muted">En ${ing.length - 80} meer; zie <a href="#moties">Moties</a>.</p>` : ""}</div>` : `<p class="empty">Geen moties of amendementen als eerste indiener${thema ? " over dit thema" : ""}.</p>`}`;
  }

  /* ---------- Agenda (tijdlijn) ---------- */
  const isDatum = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || "");
  function maandagVan(dag) { const d = new Date(dag + "T12:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dagNL(d); }
  function plusDagen(dag, n) { const d = new Date(dag + "T12:00:00"); d.setDate(d.getDate() + n); return dagNL(d); }
  function weekNr(dag) { const d = new Date(dag + "T12:00:00"); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); const j = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d - j) / 864e5 - 3 + ((j.getDay() + 6) % 7)) / 7); }
  let _ti = null;
  const icsUrl = () => new URL("data/agenda.ics", location.href.split("#")[0]).href;
  function tijdlijnItems() {
    if (_ti) return _ti;
    const acts = S.data.activiteiten.filter((a) => a.Datum && (a.Status === "Gepland" || a.Status === "Uitgevoerd")).map((a) => {
      const sam = samengevatVoor(a);
      return { datum: dagNL(new Date(a.Datum)), t: a.Aanvangstijd || a.Datum, tijd: ((t) => (t === "00:00" ? "" : t))(tijdNL(a.Aanvangstijd || a.Datum)), type: typeNaam(a.Soort), titel: a.Onderwerp,
        commissie: commissieNaam(a), a, sam, gepland: a.Status === "Gepland", thema: sam ? themasVanDebat(sam) : themasVanAct(a), dossier: dossiersVanActiviteit(a),
        url: sam ? `#vergaderingen/d-${sam.id}` : (a.tkLink || `https://berthub.eu/tkconv/activiteit.html?nummer=${a.Nummer}`) };
    });
    const sleutels = new Set(acts.map((x) => x.datum + "|" + x.titel.toLowerCase().slice(0, 20)));
    const eigen = S.data.agenda.filter((i) => !sleutels.has((i.datum || "") + "|" + (i.titel || "").toLowerCase().slice(0, 20))).map((i) => ({
      datum: i.datum, t: i.datum || "", tijd: i.tijd || "", type: i.type || "Mijlpaal", titel: i.titel, eigen: true, url: i.url,
      thema: themasVanTekst(i.titel, i.sectoren || (i.sector ? [i.sector] : [])), dossier: dossiersVanAgendaItem(i), gepland: true }));
    return (_ti = { vast: [...acts, ...eigen.filter((i) => isDatum(i.datum))].sort((a, b) => a.t.localeCompare(b.t)), vaag: eigen.filter((i) => !isDatum(i.datum)).sort((a, b) => sortKey(a.datum).localeCompare(sortKey(b.datum))) });
  }
  function agenda() {
    const p = new URLSearchParams(location.hash.split("?")[1] || "");
    S.agendaDossier = p.get("dossier") || "";
    const start = S.data.config.startdatum || "2025-11-12";
    if (!S.agendaVanaf) S.agendaVanaf = maandagVan(plusDagen(VANDAAG, -21));
    setTimeout(() => { renderAgenda(); if (!S.agendaGescrold) { const v = $("#vandaag"); if (v) v.scrollIntoView({ block: "start" }); S.agendaGescrold = true; } }, 0);
    return `<div class="agendakop"><h2>Agenda</h2><div id="agendaknoppen" class="agendaknoppen"></div></div><div id="agendawrap"></div>`;
  }
  function renderAgenda() {
    const el = $("#agendawrap");
    if (!el) return;
    const { vast, vaag } = tijdlijnItems();
    const dos = S.agendaDossier;
    const past = (i) => !dos || (i.dossier || []).includes(dos);
    const start = S.data.config.startdatum || "2025-11-12";
    const items = vast.filter((i) => i.datum >= S.agendaVanaf && past(i));
    const nu = new Date();
    const eerst = vast.find((i) => i.gepland && !i.eigen && past(i) && i.a && new Date(i.a.Datum) >= nu);
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
    if (VANDAAG >= S.agendaVanaf) voeg(VANDAAG, null);
    const dezeWeek = maandagVan(VANDAAG);
    const regel = (i) => {
      const voorbij = !i.gepland && !i.eigen;
      const extern = i.url && !i.url.startsWith("#");
      const titel = i.url ? `<a href="${esc(i.url)}" ${extern ? 'target="_blank" rel="noopener"' : ""}>${esc(i.titel)}</a>` : esc(i.titel);
      return `<li class="tl-item ${voorbij ? "voorbij" : ""} ${i === eerst ? "eerst" : ""} ${i.eigen ? "mijlpaal" : ""}">
        <div class="tl-tijd">${esc(i.tijd || "")}</div>
        <div class="tl-inhoud">
          <div class="tl-meta"><span class="tag">${esc(i.type)}</span>${i === eerst ? `<span class="badge alarm">Eerstvolgend</span>` : ""}${i.sam ? `<span class="badge">Samenvatting</span>` : ""}${i.commissie ? `<span>${esc(i.commissie)}</span>` : ""}</div>
          <div class="tl-titel">${titel}</div>
          <div class="kaartlabels">${themaChips(i.thema)}${dossierChips(i.dossier || [])}</div>
        </div></li>`;
    };
    const weekHtml = [...weken.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([w, dagen]) => {
      const eind = plusDagen(w, 6);
      const label = w === dezeWeek ? "Deze week" : w === plusDagen(dezeWeek, 7) ? "Volgende week" : w === plusDagen(dezeWeek, -7) ? "Vorige week" : "";
      const n = [...dagen.values()].reduce((s, l) => s + l.length, 0);
      return `<section class="tl-week ${w < dezeWeek ? "verleden" : ""}">
        <h3 class="tl-weekkop">Week ${weekNr(w)}${label ? ` <span class="weeklabel">${label}</span>` : ""} <span class="muted">${+w.slice(8)} ${MAANDEN_KORT[+w.slice(5, 7) - 1]} t/m ${+eind.slice(8)} ${MAANDEN_KORT[+eind.slice(5, 7) - 1]} ${eind.slice(0, 4)}</span> <span class="muted small">${n} ${n === 1 ? "item" : "items"}</span></h3>
        ${[...dagen.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([dag, l]) => {
          const d = new Date(dag + "T12:00:00");
          const isV = dag === VANDAAG;
          return `<div class="tl-dag ${isV ? "vandaag" : ""} ${dag < VANDAAG ? "verleden" : ""}" ${isV ? 'id="vandaag"' : ""}>
            <div class="tl-datum"><div class="wd">${isV ? "Vandaag" : WEEKDAGEN[d.getDay()].slice(0, 2)}</div><div class="dn">${+dag.slice(8)}</div><div class="mn">${MAANDEN_KORT[+dag.slice(5, 7) - 1]}</div></div>
            <ul class="tl-lijst">${l.length ? l.sort((a, b) => a.t.localeCompare(b.t)).map(regel).join("") : `<li class="tl-item leeg muted">Geen vergaderingen vandaag</li>`}</ul>
          </div>`;
        }).join("")}
      </section>`;
    }).join("");
    const komend7 = vast.filter((i) => i.gepland && !i.eigen && past(i) && i.datum >= VANDAAG && i.datum <= plusDagen(VANDAAG, 7)).length;
    const komend30 = vast.filter((i) => i.gepland && !i.eigen && past(i) && i.datum >= VANDAAG && i.datum <= plusDagen(VANDAAG, 30)).length;
    $("#agendaknoppen").innerHTML = `
      <span class="small muted">Komende 7 dagen <b class="datum">${komend7}</b> · 30 dagen <b class="datum">${komend30}</b></span>
      <button type="button" class="chip" id="naarvandaag">Naar vandaag</button>
      <details class="facet abonneer"><summary>In je eigen agenda</summary><div class="facet-menu rechts">
        <p class="small">Abonneer je op deze agenda; nieuwe en verplaatste vergaderingen verschijnen dan vanzelf in je eigen agenda (elke werkdag bijgewerkt).</p>
        <a class="knop" href="${esc(icsUrl().replace(/^https:/, "webcal:"))}">Abonneren (Apple Agenda, Outlook)</a>
        <a class="knop licht" href="https://calendar.google.com/calendar/r?cid=${encodeURIComponent(icsUrl().replace(/^https:/, "webcal:"))}" target="_blank" rel="noopener">Toevoegen aan Google Agenda</a>
        <label class="small muted" for="icslink">Of kopieer de link:</label>
        <div class="kopieer"><input id="icslink" readonly value="${esc(icsUrl())}"><button type="button" class="chip" id="icskopie">Kopieer</button></div>
      </div></details>`;
    const kop = $("#icskopie");
    if (kop) kop.addEventListener("click", () => { const i = $("#icslink"); i.select(); (navigator.clipboard ? navigator.clipboard.writeText(i.value) : Promise.reject()).then(() => { kop.textContent = "Gekopieerd"; }).catch(() => document.execCommand("copy")); });
    el.innerHTML = `
      ${dos ? `<div class="note">Alleen agenda-items bij <b>${esc(dossierTitel(dos))}</b>. <a href="#agenda">Filter wissen</a></div>` : ""}
      ${S.agendaVanaf > start ? `<div class="tl-eerder"><button type="button" class="chip" id="eerder">${ico("omhoog")}Eerder laden</button> <span class="small muted">Per 4 weken, terug tot ${fmtKort(start)}</span></div>` : `<p class="small muted">Begin van de Kamerperiode (${fmtKort(start)})</p>`}
      <div class="tijdlijn">${weekHtml || `<p class="empty">Niets in deze periode</p>`}</div>
      ${vaag.filter(past).length ? `<h3 class="groepkop">Mijlpalen zonder vaste dag</h3><div class="card"><ul class="list">${vaag.filter(past).map((i) => `<li><div class="regelmeta"><span class="datum">${fmtDatum(i.datum)}</span><span class="tag">${esc(i.type)}</span></div><div>${i.url ? `<a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.titel)}</a>` : esc(i.titel)}</div>${themaChips(i.thema)}</li>`).join("")}</ul></div>` : ""}`;
    const eerder = $("#eerder");
    if (eerder) eerder.addEventListener("click", () => {
      const ref = $("#vandaag") || el.querySelector(".tl-week");
      const voor = ref ? ref.getBoundingClientRect().top : 0;
      const nieuw = maandagVan(plusDagen(S.agendaVanaf, -28));
      S.agendaVanaf = nieuw < start ? start : nieuw;
      renderAgenda();
      const ref2 = $("#vandaag") || el.querySelector(".tl-week");
      if (ref2) window.scrollBy(0, ref2.getBoundingClientRect().top - voor);
    });
    $("#naarvandaag").addEventListener("click", () => { const v = $("#vandaag"); if (v) v.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); });
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
  const ZOEK_CATS = [["", "Alles"], ["debatten", "Debatten"], ["dossiers", "Dossiers"], ["moties", "Moties & amendementen"], ["stukken", "Stukken"], ["toezeggingen", "Toezeggingen"], ["agenda", "Agenda"]];
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
      const link = d.extern ? `href="${esc(d.link)}" target="_blank" rel="noopener"` : `href="${esc(d.link)}"${d.setdossier ? ` data-setdossier="${esc(d.setdossier)}"` : ""}`;
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
        <p>MilieuRadar volgt Nederlands milieubeleid in het parlement: de fase van wetsvoorstellen, moties en amendementen met de stemming per fractie, samenvattingen van debatten en wat er op de agenda staat. Alle fracties krijgen evenveel ruimte.</p>
        <h3>Hoe het werkt</h3>
        <ul>
          <li><b>Automatisch:</b> een script haalt moties, amendementen, stemmingen, activiteiten en stukken van ministeries (Kamerbrieven en antwoorden op Kamervragen) op uit de <a href="https://opendata.tweedekamer.nl">open data van de Tweede Kamer</a>. Daar komt geen AI aan te pas.</li>
          <li><b>Samenvattingen:</b> debatten worden door Claude samengevat op basis van automatische transcripten van <a href="https://gehoord.de/beraadslagingen">gehoord.de</a>. Die transcripten zijn niet door mensen gecorrigeerd en sprekers kunnen er soms een paar seconden naast zitten. Gebruik de links om na te luisteren en citeer de Handelingen.</li>
          <li><b>Wetgevingsdossiers</b> worden handmatig bijgehouden met bronvermelding.</li>
          <li><b>Toezeggingen</b> komen uit het toezeggingenregister van de Tweede Kamer; voor recente vergaderingen die daar nog niet in staan uit onze samenvatting.</li>
          <li><b>Thema's</b> worden automatisch toegekend op basis van trefwoorden in titels en agendapunten, en bij samenvattingen met de hand gecontroleerd. Moties worden aan een vergadering gekoppeld als de datum en het Kamerstukdossier overeenkomen; bij twijfel niet.</li>
          <li><b>Privacy:</b> de site gebruikt geen cookies of tracking.</li>
        </ul>
        <h3>Status</h3>
        <dl class="facts"><dt>Kamerdata</dt><dd>${m.bijgewerkt ? fmtDatum(m.bijgewerkt) : "nog niet opgehaald"} (${m.aantalZaken ?? 0} zaken, ${m.aantalActiviteiten ?? 0} activiteiten, ${m.aantalStukken ?? 0} stukken van ministeries)</dd>
        <dt>Periode</dt><dd>vanaf ${fmtDatum(S.data.config.startdatum)}</dd>
        ${m.fouten?.length ? `<dt>Meldingen</dt><dd>${m.fouten.map(esc).join("<br>")}</dd>` : ""}</dl>
      </div>`;
  }

  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-dossier]");
    // "Moties en amendementen bij dit dossier": zoek op het Kamerstuknummer, zichtbaar en te wissen in het zoekveld
    if (a) { Object.assign(S.motieFilter, { q: a.dataset.dossier, uitslag: [], appreciatie: [], fractie: [] }); }
    // dossier- en themalabels: op Vergaderingen een filter aan/uit, elders naar Vergaderingen met dat filter
    const b = e.target.closest("[data-setdossier], [data-vthema]");
    if (b) {
      const [f, id] = b.dataset.vthema ? ["thema", b.dataset.vthema] : ["dossier", b.dataset.setdossier];
      const tab = location.hash.slice(1).split(/[/?]/)[0];
      if (b.tagName !== "A") { e.preventDefault(); e.stopPropagation(); }
      if (tab === "vergaderingen" && S.vf) {
        S.vf[f] = S.vf[f].includes(id) ? S.vf[f].filter((x) => x !== id) : [...S.vf[f], id];
        vfToepassen();
        window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      } else if (tab === "agenda" && f === "dossier") {
        location.hash = S.agendaDossier === id ? "#agenda" : "#agenda?dossier=" + encodeURIComponent(id);
      } else if (b.tagName !== "A") {
        location.hash = `#vergaderingen?${f}=${encodeURIComponent(id)}`;
      }
    }
  }, true);
  init();
})();
