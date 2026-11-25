/* MilieuRadar: leest de JSON-bestanden in data/ en tekent de pagina. Geen build-stap nodig. */
(function () {
  "use strict";
  const S = { sector: "alle", data: null, tabel: null,
    zoekMax: 30, zoekKomendAlles: false };
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MAANDEN_KORT = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  const MAANDEN = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
  const dagNL = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const VANDAAG = dagNL(new Date());
  // rode lijn in Net binnen en in tabellen (nieuwste eerst): alles vanaf de vorige werkdag is nieuw, op maandag dus vanaf vrijdag
  const NIEUW_VANAF = (() => { const d = new Date(VANDAAG + "T12:00:00"); do d.setDate(d.getDate() - 1); while (d.getDay() === 0 || d.getDay() === 6); return dagNL(d); })();
  // index van het eerste oudere item in een lijst die nieuwste eerst staat, of -1 (geen lijn als er niets nieuws boven staat)
  const grensIndex = (datums) => { const i = datums.findIndex((d) => String(d || "").slice(0, 10) < NIEUW_VANAF); return i > 0 ? i : -1; };
  // "vandaag", "morgen", "over 2 dagen"; alleen binnen twee weken, anders "" (de datum zegt dan genoeg)
  const overDagen = (dag) => { const n = Math.round((Date.parse(dag) - Date.parse(VANDAAG)) / 864e5); return n === 0 ? "vandaag" : n === 1 ? "morgen" : n > 1 && n <= 14 ? `over ${n} dagen` : ""; };
  // label bij "Volgende stap" van een wetsvoorstel; rood alleen op de dag zelf (DESIGN.md)
  function termijn(woord, dag) {
    const wanneer = overDagen(dag);
    return wanneer ? `<span class="badge termijn${wanneer === "vandaag" ? " alarm" : ""}">${hoofd(`${woord} ${wanneer}`.trim())}</span>` : "";
  }
  const WEEKDAGEN = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];
  // de lijn zelf: over de hele breedte, met links wat erboven staat en rechts wat eronder
  const GRENS_LABEL = `<span>↑ Nieuw sinds ${WEEKDAGEN[new Date(NIEUW_VANAF + "T12:00:00").getDay()].toLowerCase()} ${fmtKort(NIEUW_VANAF)}</span><span>Eerder ↓</span>`;

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
  const ICO = { x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>', pijlop: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>', pijlneer: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    pijlrechts: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>', vink: '<path d="M20 6 9 17l-5-5"/>' };
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
    // shortcut: alle data in één keer (17 nov 2026: ~8 MB, ~0,8 MB met gzip, zaken.json parsen ~30 ms); per pagina laden pas
    // als de data flink groeit of de eerste weergave merkbaar traag wordt (audit .impeccable/audit/, P2 "All data loads up front")
    const [config, debatten, agenda, zaken, activiteiten, meta, stukken, synoniemen, themas, toezeggingenData, themaMapping, stemmingen, kerndocumenten, begrotingen, wetstukken, rapporten, verzoeken, gehoord, toezeggingBrieven] = await Promise.all([
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
      load("data/tk/stemmingen.json", {}),
      load("data/kerndocumenten.json", {}),
      load("data/tk/begrotingen.json", []),
      load("data/tk/wetstukken.json", {}),
      load("data/rapporten.json", {}),
      load("data/tk/verzoeken.json", []),
      load("data/gehoord.json", { debatten: {} }),
      load("data/toezeggingen.json", { brieven: {} }),
    ]);
    // stemmingen.json: {zaak: {datum, tijd, activiteit}} (oud formaat: {zaak: datum}); de site gebruikt drie platte tabellen
    const stemDatum = {}, stemActiviteit = {}, stemTijd = {};
    for (const [nr, v] of Object.entries(stemmingen || {})) {
      if (typeof v === "string") stemDatum[nr] = v;
      else if (v && v.datum) { stemDatum[nr] = v.datum; stemTijd[nr] = v.tijd; if (v.activiteit) stemActiviteit[nr] = v.activiteit; }
    }
    S.data = { config, debatten: debatten.debatten, agenda: agenda.items, zaken, activiteiten, meta, stukken, synoniemen, themas, toezeggingen: toezeggingenData, stemmingen: stemDatum, stemActiviteit, stemTijd, kerndocumenten, begrotingen, wetstukken, rapporten, verzoeken, gehoord: gehoord.debatten, toezeggingBrieven: toezeggingBrieven.brieven };
    if (!zaken.length && !activiteiten.length && !debatten.debatten.length) {
      $("#stamp").textContent = "";
      $("#view").innerHTML = `<div class="card empty laadfout"><h2>De gegevens konden niet worden geladen</h2><p>Controleer je verbinding en probeer het opnieuw.</p><button type="button" class="knop" onclick="location.reload()">Opnieuw proberen</button></div>`;
      return;
    }
    S.T = window.MRThemas.maak(themas, themaMapping);
    // meest recente moment waarop data of samenvattingen zijn bijgewerkt
    const stempels = [meta.bijgewerkt, debatten.bijgewerkt, agenda.bijgewerkt, kerndocumenten.bijgewerkt, rapporten.bijgewerkt, gehoord.bijgewerkt, toezeggingBrieven.bijgewerkt].filter(Boolean).map((t) => new Date(t)).filter((d) => !isNaN(d));
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

  /* ---------- Kop: glijdende tab-aanduiding, hoogte van de kop, randvervaging ---------- */
  const NAV = $("nav.tabs");
  const GLIJ = document.createElement("span");
  GLIJ.className = "tab-glij"; GLIJ.setAttribute("aria-hidden", "true");
  NAV.prepend(GLIJ); NAV.classList.add("glij");
  let _glijGezet = false;
  const minderBeweging = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  // De aanduiding beweegt via een CSS-overgang op transform: die start altijd vanaf de huidige stand, dus snel wisselen blijft vloeiend.
  function zetGlij(animeer) {
    const a = NAV.querySelector(":scope > a.active, :scope > .tab-menu.active");
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

  // Documenten-menu: open bij hover (CSS) of met klik, Enter, spatie of pijl omlaag; Escape, klik buiten of een keuze sluit het
  const MENU = $(".tab-menu"), MKNOP = $(".tab-knop"), MITEMS = () => [...MENU.querySelectorAll(".tab-lijst a")];
  const zetMenu = (open) => { MENU.classList.toggle("open", open); MKNOP.setAttribute("aria-expanded", String(open)); if (!open) MENU.classList.add("dicht"); };
  MENU.addEventListener("mouseleave", () => MENU.classList.remove("dicht"));
  MENU.addEventListener("mouseenter", () => { if (!MENU.classList.contains("open")) MENU.classList.remove("dicht"); });
  MKNOP.addEventListener("click", () => zetMenu(!MENU.classList.contains("open")));
  MENU.addEventListener("keydown", (e) => {
    const items = MITEMS(), i = items.indexOf(document.activeElement);
    if (e.key === "Escape") { e.preventDefault(); zetMenu(false); MKNOP.focus(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); zetMenu(true); items[(i + 1) % items.length].focus(); }
    else if (e.key === "ArrowUp" && i >= 0) { e.preventDefault(); if (i === 0) MKNOP.focus(); else items[i - 1].focus(); }
  });
  MENU.addEventListener("focusout", (e) => { if (!MENU.contains(e.relatedTarget)) { MENU.classList.remove("open"); MKNOP.setAttribute("aria-expanded", "false"); } });
  MENU.querySelector(".tab-lijst").addEventListener("click", (e) => { if (e.target.closest("a")) { zetMenu(false); e.target.closest("a").blur(); } });
  document.addEventListener("click", (e) => { if (!MENU.contains(e.target) && MENU.classList.contains("open")) zetMenu(false); });

  // Zoeken in de kop: altijd zichtbaar; zoekt in de hele site ("/" zet de cursor erin, Escape op een leeg veld laat los)
  const ZVELD = $("#zoekveld");
  const openZoek = () => { ZVELD.focus(); ZVELD.select(); };
  ZVELD.addEventListener("keydown", (e) => { if (e.key === "Escape" && !ZVELD.value) ZVELD.blur(); });
  function zetKopHoogte() {
    const k = $("header.top");
    const vast = getComputedStyle(k).position === "sticky";
    document.documentElement.style.setProperty("--kop-h", (vast ? k.offsetHeight : 0) + "px");
  }
  let _rsz = null;
  window.addEventListener("resize", () => { clearTimeout(_rsz); _rsz = setTimeout(() => { zetKopHoogte(); zetGlij(false); if (window.MRMilieu) MRMilieu.herteken(); }, 80); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { zetKopHoogte(); zetGlij(false); });

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
    e.preventDefault(); openZoek();
  });

  // Scrollpositie: een klik op een link begint bovenaan; terug/vooruit in de browser komt terug waar je was.
  const _scrollBij = new Map();
  let _klik = true;
  document.addEventListener("click", (e) => { if (e.target.closest('a[href^="#"]')) { _klik = true; setTimeout(() => { _klik = false; }, 400); } }, true);
  window.addEventListener("scroll", () => { _scrollBij.set(location.hash || "#overzicht", window.scrollY); }, { passive: true });

  let _overzichtGezien = false;
  let _vorigeTab = null, _vorigPad = null;
  // Oude adressen: Vergaderingen (ook #debatten), Toezeggingen en Per fractie zijn opgegaan in de Agenda; wetsdossiers bestaan niet meer;
  // Stukken heet sinds 13 nov 2026 Vragen & Brieven (#vragen en #brieven); Kerndocumenten staan sinds 17 nov 2026 op #kerndocumenten/<groep>.
  function oudeRoute(tab, pad) {
    if (tab === "stukken") return "#vragen";
    if (tab === "documenten") return "#kerndocumenten" + location.hash.slice("#documenten".length);
    // Ramingen en Adviezen zijn sinds 20 nov 2026 samen Rapporten
    if (/^kerndocumenten\/(ramingen|advies)$/.test(pad)) return "#kerndocumenten/rapporten";
    if (tab === "wetgeving" && pad.includes("/") && pad !== "wetgeving/wetten" && !/^wetgeving\/\d+$/.test(pad)) return "#wetgeving";
    if (tab === "toezeggingen" || tab === "fracties") return "#agenda?terugblik=1";
    // themapagina: Agenda en Vergaderingen zijn sinds 19 nov 2026 de Agenda met het themafilter
    const type = (hashQuery().type || [])[0];
    if (tab === "themas" && (type === "agenda" || type === "vergaderingen")) return `#agenda?thema=${encodeURIComponent(pad.split("/")[1] || "")}${type === "vergaderingen" ? "&terugblik=1" : ""}`;
    if (tab !== "vergaderingen" && tab !== "debatten") return null;
    const sub = pad.split("/")[1];
    const p = new URLSearchParams(location.hash.split("?")[1] || "");
    const q = ["type", "ministerie", "thema"].filter((k) => p.get(k)).map((k) => `${k}=${encodeURIComponent(p.get(k))}`);
    if (!sub) q.push("terugblik=1");
    return `#agenda${sub ? "/" + sub : ""}${q.length ? "?" + q.join("&") : ""}`;
  }
  function route() {
    const pad = (location.hash || "#overzicht").slice(1).split("?")[0];
    const tab = pad.split("/")[0] || "overzicht";
    const oud = oudeRoute(tab, pad);
    if (oud) { history.replaceState(null, "", oud); route(); return; }
    {
      // alle documentpagina's vallen onder het menu Documenten; de menuregel van de pagina krijgt aria-current
      const DOCS = ["wetgeving", "moties", "amendementen", "vragen", "brieven", "kerndocumenten"];
      const navTab = DOCS.includes(tab) ? "documenten" : tab;
      const sub = tab === "kerndocumenten" ? `kerndocumenten/${kdGroep()}` : tab;
      document.querySelectorAll("nav.tabs > a[data-tab], nav.tabs > .tab-menu").forEach((a) => a.classList.toggle("active", a.dataset.tab === navTab));
      document.querySelectorAll("nav.tabs > a[data-tab], nav.tabs .tab-lijst a").forEach((a) => {
        if ((a.dataset.tab || a.dataset.sub) === (a.dataset.sub ? sub : navTab)) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
      });
    }
    const views = { overzicht, themas: themasPagina, wetgeving, moties, amendementen: moties, vragen: vragenBrieven, brieven: vragenBrieven, agenda, kerndocumenten: kerndocumentenPagina, over, zoeken };
    const TITELS = { themas: "Thema's", agenda: "Agenda", wetgeving: "Wetgeving", moties: "Moties", amendementen: "Amendementen", vragen: "Kamervragen", brieven: "Kamerbrieven", kerndocumenten: "Kerndocumenten", over: "Over", zoeken: "Zoeken" };
    S.tabel = null;
    document.title = TITELS[tab] ? `${TITELS[tab]} · milieuradar` : "milieuradar";
    if (tab === "themas" && pad.split("/")[1]) { const t = S.T.thema(pad.split("/")[1]); document.title = `${t ? t.label : "Thema niet gevonden"} · Thema's · milieuradar`; }
    { const v = $("#zoekveld"); if (tab === "zoeken") { if (document.activeElement !== v) v.value = zoekVraag(); } else v.value = ""; }
    if (MENU.classList.contains("open")) zetMenu(false); // ook bij terug/vooruit of een getypt adres
    $("#view").innerHTML = (views[tab] || overzicht)();
    if (/^wetgeving\/\d+$/.test(pad)) document.title = `Kamerstuk ${pad.split("/")[1]} · Wetgeving · milieuradar`;
    const tabGewisseld = tab !== _vorigeTab, eerste = _vorigeTab === null;
    if (tabGewisseld) { const v = $("#view"); v.classList.remove("binnenkomst"); void v.offsetWidth; v.classList.add("binnenkomst"); }
    // eerste bezoek aan Overzicht na een andere pagina: het radarsignaal speelt nog één keer (bij het laden speelt het vanzelf)
    if (tab === "overzicht" && !_overzichtGezien) { _overzichtGezien = true; if (!eerste) { const w = $(".wm-radar"); w.replaceWith(w.cloneNode(true)); } }
    _vorigeTab = tab;
    zetKopHoogte(); zetGlij(!eerste);
    // Thema's: overzicht en detail zijn aparte pagina's binnen dezelfde tab, dus ook daartussen bovenaan beginnen (of herstellen bij terug/vooruit)
    const themaWissel = (tab === "themas" || tab === "wetgeving") && pad !== _vorigPad && !eerste;
    if ((tabGewisseld && !eerste && !pad.includes("/")) || themaWissel) {
      const bewaard = _klik ? null : _scrollBij.get(location.hash || "#overzicht");
      if (bewaard != null) setTimeout(() => window.scrollTo(0, bewaard), 0);
      else window.scrollTo(0, 0);
    }
    _vorigPad = pad;
    _klik = false;
    zetBoven();
    if (S.tabel) bindTabel();
    if (tab === "zoeken") renderZoekResultaten();
    if (tab === "overzicht" && window.MRMilieu) MRMilieu.vul();
    passKomtEraan(); document.fonts.ready.then(passKomtEraan); // na het laden van DM Sans veranderen de regelhoogtes
    const sub = tab === "agenda" || tab === "themas" || tab === "kerndocumenten" || tab === "wetgeving" ? null : pad.split("/")[1];
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
  const FEED_ORDE = { Wetgeving: 0, Stemming: 1, Ingediend: 2, Stuk: 3 };
  // Net binnen en Komt eraan linken naar de eigen lijstpagina met die rij(en, gescheiden door een komma) opengeklapt (tweedekamer.nl staat in de rij);
  // op een themapagina naar de tabel van dat thema (#themas/<slug>?type=<param>&open=<sleutel>)
  const LIJST_PAGINA = { moties: "moties", amendementen: "amendementen", kamerbrieven: "brieven", kamervragen: "vragen" };
  const lijstHref = (param, sleutel, slug) => {
    const open = sleutel ? `open=${sleutel.split(",").map(encodeURIComponent).join(",")}` : "";
    return slug ? `#themas/${slug}?type=${param}${open ? "&" + open : ""}` : `#${LIJST_PAGINA[param]}${open ? "?" + open : ""}`;
  };
  const isDag = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || "") && d <= VANDAAG;
  // Kamerleden zonder voorletters, zoals in de motietabel: "van het lid A.B. (Anne) Jansen" -> "van het lid Jansen".
  // Alleen in titels die "het lid" of "de leden" noemen, en alleen direct na lid/leden/en/komma (niet "Inzet C.W. Artikel 2.25").
  const zonderVoorletters = (t) => (/\b(het lid|de leden)\b/i.test(t)
    ? t.replace(/(\b(?:lid|leden|en)\s+|,\s*)(?:[A-ZÀ-Ý][a-z]{0,2}\.)+\s*(?:\([^)]*\)\s*)?(?=\p{Lu}|[a-z]{1,3}\s)/gu, "$1")
    : t);
  // De soort vooraan een regel (DESIGN.md, "Rows"): een link naar zijn lijstpagina als die bestaat, anders gewone tekst.
  const SOORT_PAGINA = { Kamerbrief: "#brieven", Kamervragen: "#vragen", "Antwoord Kamervragen": "#vragen", Commissieverzoek: "#vragen?soort=Commissieverzoek", Motie: "#moties", Amendement: "#amendementen", Wetsvoorstel: "#wetgeving", Stemmingen: "#moties" };
  const soortTag = (soort, href = SOORT_PAGINA[soort]) => (href ? `<a class="tag" href="${esc(href)}">${esc(soort)}</a>` : `<span class="tag">${esc(soort)}</span>`);
  const agendaTypeTag = (type) => soortTag(type, `#agenda?type=${encodeURIComponent(type)}`);
  // Zoekresultaat: vergaderingen naar de Agenda op dat type (geweest: Terugblik), documenten naar hun lijstpagina
  const zoekSoortTag = (d) => (["agenda", "debatten"].includes(d.cat)
    ? soortTag(d.soort, `#agenda?type=${encodeURIComponent(d.soort.replace(/ \(niet samengevat\)$/, ""))}${d.cat === "debatten" ? "&terugblik=1" : ""}`)
    : soortTag(d.soort));
  // Drie regels: soort, datum en context; de titel; eventueel een staart (indieners, stemuitslag, Kamerstuk).
  function feedLi(soort, datum, meta, titel, href, staart, extern) {
    const doel = extern ? ` target="_blank" rel="noopener"` : "";
    return `<li><div class="regelmeta">${soortTag(soort)}<span class="datum">${fmtKort(datum)}</span>${meta}</div><a class="ltitel" href="${esc(href)}"${doel}>${esc(zonderVoorletters(titel))}</a>${staart ? `<div class="regel-staart">${staart}</div>` : ""}</li>`;
  }
  const feedMeta = (html) => (html ? `<span>${html}</span>` : "");
  // slug: alleen items met dit thema (themapagina); zonder slug alles (voorpagina)
  function netBinnen(slug) {
    const items = [];
    for (const z of motiesEnAmendementen()) {
      const t = z.stemtelling;
      if (!t || !isDag(t.datum)) continue;
      if (slug && !themasMotie(z).includes(slug)) continue;
      items.push({ soort: "Stemming", datum: t.datum, html: feedLi(z.soort, t.datum, feedMeta(uitslagPill(z.uitslag)),
        onderwerpZin(z), lijstHref(z.soort === "Amendement" ? "amendementen" : "moties", z.nummer, slug), `<span class="nw">${indienerKort(z)}</span>${t.voor + t.tegen ? ` <span class="nw">· Voor ${t.voor} / Tegen ${t.tegen}</span>` : ""}`, false) });
    }
    // ingediend en nog niet gestemd: één regel per vergadering (of dag) en soort, met een link naar precies die rijen in de tabel (Tobias, 24 nov 2026)
    const { actVanZaak } = motieKoppeling(), ingediend = new Map();
    for (const z of motiesEnAmendementen()) {
      if (z.stemtelling || !isDag(z.gestartOp)) continue;
      if (slug && !themasMotie(z).includes(slug)) continue;
      const a = actVanZaak.get(z.nummer), dag = z.gestartOp, k = `${a ? a.Nummer : dag}|${z.soort}`;
      if (!ingediend.has(k)) ingediend.set(k, { a, dag, soort: z.soort, nrs: [] });
      ingediend.get(k).nrs.push(z.nummer);
    }
    for (const g of ingediend.values()) {
      const param = g.soort === "Amendement" ? "amendementen" : "moties", n = g.nrs.length;
      const titel = `${nl(n)} ${g.soort === "Amendement" ? (n === 1 ? "amendement" : "amendementen") : n === 1 ? "motie" : "moties"} ingediend`;
      items.push({ soort: "Ingediend", datum: g.dag, html: feedLi(g.soort, g.dag, feedMeta(g.a ? esc(vergaderNaam(g.a)) : ""),
        titel, lijstHref(param, g.nrs.join(","), slug), "", false) });
    }
    for (const x of stukkenInSector()) {
      if (!isDag(x.datum)) continue;
      if (slug && !themasBrief(x).includes(slug)) continue;
      const dossier = (x.dossiers || [])[0];
      // Kamervragen: aan welk ministerie, en als staart wie ze stelde (achternaam en fractie, zoals in de tabel)
      const staart = isVraag(x) ? `<span class="nw">${vragenstellerKort({ indieners: x.indieners || [] })}</span>`
        : dossier ? `<span class="mono">${esc(x.kamerstuk || dossier.nummer)}</span> ${esc(dossier.titel || "")}` : "";
      // vraag of antwoord: de rij van die zaak op Kamervragen (sleutel: de vraag, anders het eerste antwoord)
      const href = x.soort === "Brief regering" ? lijstHref("kamerbrieven", x.id, slug)
        : lijstHref("kamervragen", (vraagRijen().find((r) => r.zaak && r.zaak === x.zaak) || x).id, slug);
      items.push({ soort: "Stuk", datum: x.datum, html: feedLi(x.kamer ? `${SOORT_KORT[x.soort]}, ${x.kamer}` : SOORT_KORT[x.soort] || x.soort, x.datum, feedMeta(esc(x.ministerie ? (isVraag(x) ? "aan " : "") + x.ministerie : "ministerie onbekend")),
        x.onderwerp || x.titel, href, staart, false) });
    }
    // wetgeving: nieuw ingediende wetsvoorstellen
    for (const z of wetsvoorstellenTK()) {
      if (!isDag(z.gestartOp)) continue;
      if (slug && !themasWet(z).includes(slug)) continue;
      items.push({ soort: "Wetgeving", datum: z.gestartOp, html: feedLi("Wetsvoorstel", z.gestartOp, feedMeta("Ingediend"),
        z.titel || z.onderwerp, wetHref(z), `<span class="mono">${esc(dossierLabel(z))}</span>`, false) });
    }
    return items.sort((a, b) => b.datum.localeCompare(a.datum) || FEED_ORDE[a.soort] - FEED_ORDE[b.soort]).slice(0, NET_BINNEN_MAX);
  }
  const netBinnenHtml = (items) => {
    const g = grensIndex(items.map((i) => i.datum));
    return items.map((i, n) => (n === g ? `<li class="grens" role="separator">${GRENS_LABEL}</li>` : "") + i.html).join("") || `<li class="empty">Nog niets binnen</li>`;
  };
  // Plenaire stemmingen: moties en amendementen zonder uitslag met een stemmingsdatum vanaf vandaag (zoals stemStatus()),
  // per dag geteld; slugs beperkt de telling tot die thema's. themas: alle thema's van de getelde moties (voor het themafilter).
  function stemmingenPerDag(slugs = []) {
    const stemDag = S.data.stemmingen || {}, perDag = new Map();
    for (const z of motiesEnAmendementen()) {
      if ([z.uitslag, zaakVanNr(z.nummer)?.uitslag].some((x) => x && x !== "in behandeling")) continue;
      const dag = stemDag[z.nummer];
      if (!dag || dag < VANDAAG) continue;
      const th = themasMotie(z);
      if (slugs.length && !th.some((x) => slugs.includes(x))) continue;
      const t = perDag.get(dag) || { m: 0, a: 0, tijd: "", themas: new Set(), zaken: [] };
      if (z.soort === "Amendement") t.a++; else t.m++;
      th.forEach((x) => t.themas.add(x));
      t.zaken.push(z);
      const tijd = S.data.stemTijd[z.nummer]; // de vroegste van die dag
      if (tijd && (!t.tijd || tijd < t.tijd)) t.tijd = tijd;
      perDag.set(dag, t);
    }
    return perDag;
  }
  const stemTitel = (t) => {
    const deel = (n, een, meer) => (n ? `${nl(n)} ${n === 1 ? een : meer}` : "");
    return [deel(t.m, "motie", "moties"), deel(t.a, "amendement", "amendementen")].filter(Boolean).join(" en ");
  };
  // Eerstvolgende plenaire stemming als [sorteersleutel, regel in de vorm van agendaLi()] voor Komt eraan, of null als er niets gepland is.
  // Zonder begintijd achteraan die dag, zoals agendaKey().
  function komendeStemming(slug) {
    const perDag = stemmingenPerDag(slug ? [slug] : []);
    if (!perDag.size) return null;
    const dag = [...perDag.keys()].sort()[0];
    const t = perDag.get(dag);
    return [dag + (t.tijd || "~"), `<li><div class="regelmeta">${soortTag("Stemmingen")}<span class="datum">${fmtKort(dag)}${t.tijd ? ` ${esc(t.tijd)}` : ""}</span><span>Plenaire vergadering</span></div><a class="ltitel" href="#agenda/s-${dag}${slug ? `?thema=${esc(slug)}` : ""}">${esc(stemTitel(t))}</a></li>`];
  }
  // Ruim gevuld (KOMT_MAX); na het tekenen haalt passKomtEraan() regels weg tot de kaart niet langer is dan Net binnen.
  const KOMT_MAX = 15;
  // op datum en tijd (agendaKey), de stemming op haar dag
  const komtEraan = (stemming, items, slug) => [...items.map((i) => [agendaKey(i), agendaLi(i, slug)]), ...(stemming ? [stemming] : [])]
    .sort((a, b) => opCode(a[0], b[0])).slice(0, KOMT_MAX).map((r) => r[1]).join("") || `<li class="empty">Niets gepland</li>`;
  function passKomtEraan() {
    for (const rij of document.querySelectorAll(".ov-onder")) {
      const [b, k] = rij.querySelectorAll(":scope > section > .card > .list");
      if (!b || !k || !b.lastElementChild) continue;
      const onder = b.lastElementChild.getBoundingClientRect().bottom;
      while (k.children.length > 1 && k.lastElementChild.getBoundingClientRect().bottom > onder + 8) k.lastElementChild.remove();
    }
  }
  const OV_INTRO = `<header class="ov-intro"><h1 class="ov-lead">Volg het Nederlandse milieubeleid in de Tweede Kamer.</h1>
      <p class="ov-uitleg">Bekijk hieronder welke documenten er recent zijn binnengekomen of welke vergaderingen eraan komen. Kies bovenin een <a href="#themas">thema</a>, bekijk de <a href="#agenda">agenda</a> voor komende of eerdere activiteiten, of zoek een document (bijvoorbeeld een <a href="#wetgeving">wet</a>, <a href="#moties">motie</a>, <a href="#amendementen">amendement</a>, <a href="#vragen">vragen/antwoorden</a> of <a href="#brieven">brief</a>). Je kunt ook zoeken op Kamerstuknummer of Kamerlid.</p></header>`;
  function overzicht() {
    const komend = agendaItems().filter((i) => sortKey(i.datum) >= VANDAAG).slice(0, KOMT_MAX);
    const binnen = netBinnen();
    return `
      ${OV_INTRO}
      <div class="ov-onder">
        <section aria-labelledby="ov-binnen"><h2 id="ov-binnen">Net binnen</h2><div class="card"><ul class="list">
          ${netBinnenHtml(binnen)}
        </ul><div class="kaartvoet"><a class="knop licht" href="#vragen">Alle Kamervragen</a><a class="knop licht" href="#brieven">Alle Kamerbrieven</a><a class="knop licht" href="#moties">Alle moties</a><a class="knop licht" href="#wetgeving">Alle wetgeving</a></div></div></section>
        <section aria-labelledby="ov-komt"><h2 id="ov-komt">Komt eraan</h2><div class="card"><ul class="list">
          ${komtEraan(komendeStemming(), komend)}
        </ul><div class="kaartvoet"><a class="knop licht" href="#agenda">Volledige agenda</a></div></div></section>
      </div>
      ${window.MRMilieu ? MRMilieu.sectieHtml() : ""}`;
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
    return `<h1>Thema's</h1>
      <ul class="themagrid">${S.T.lijst.map((t) => themaKaart(t)).join("")}</ul>`;
  }
  const extLink = (url, tekst) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(tekst)}</a>`;
  // Themapagina: een schakelaar tussen Overzicht (Net binnen en Komt eraan voor dit thema) en de documentsoorten.
  // Wetten, amendementen, moties, brieven en Kamervragen zijn dezelfde tabellen als op hun eigen pagina, beperkt tot dit thema
  // (zonder Themakolom); vergaderingen en agenda blijven een lijst. Route: #themas/<slug>?type=<param>&<filters>.
  const THEMA_TABS = [
    { param: "wetten", label: "Wetten", def: () => WET_DEF, hint: "Zoek op titel, Kamerstuknummer of indiener", alle: "Wetgeving" },
    { param: "amendementen", label: "Amendementen", def: () => motieDef("amendementen"), hint: "Zoek op onderwerp, Kamerlid of Kamerstuknummer", alle: "Amendementen" },
    { param: "moties", label: "Moties", def: () => motieDef("moties"), hint: "Zoek op onderwerp, Kamerlid of Kamerstuknummer", alle: "Moties" },
    { param: "kamerbrieven", label: "Kamerbrieven", def: () => BRIEF_DEF, hint: "Zoek op onderwerp of Kamerstuk", alle: "Kamerbrieven" },
    { param: "kamervragen", label: "Kamervragen", def: () => VRAAG_DEF, hint: "Zoek op onderwerp, Kamerlid of ministerie", alle: "Kamervragen" },
    { param: "kerndocumenten", label: "Kerndocumenten", def: () => kerndocDef(null), hint: "Zoek op titel, afkorting, uitgever of kenmerk", alle: "Kerndocumenten" },
  ];
  // een tabeldefinitie beperkt tot één thema: zonder Themakolom en -filter, met het adres van de themapagina
  function themaDef(def, slug, param) {
    const inThema = def.filters.thema.waarden;
    const { thema, ...filters } = def.filters;
    return { ...def, filters, kolommen: def.kolommen.filter((c) => c.filter !== "thema"),
      rijen: () => def.rijen().filter((z) => inThema(z).includes(slug)), adres: `themas/${slug}`, vast: `type=${param}` };
  }
  // trefwoord uit data/themas.json als leesbare term(en): "\\bnet(beheer|werk)" -> netbeheer, netwerk; "\\bpm ?10\\b" -> pm 10
  function leesbareTermen(re) {
    const t = re.replace(/\(\?[!=<][^)]*\)/g, "").replace(/\\b|\^|\$/g, "").replace(/\\s[?*+]?/g, " ").replace(/\\d\+?/g, "…")
      .replace(/\[([^\]])[^\]]*\]\??/g, "$1").replace(/\\(.)/g, "$1");
    const g = /^(.*?)\(([^()]*)\)(\??)(.*)$/.exec(t);
    const zonderVraag = (x) => x.replace(/ ?\?/g, (m) => (m.startsWith(" ") ? " " : "")).replace(/\s+/g, " ").trim();
    if (!g) return [zonderVraag(t)];
    const delen = g[2].split("|").map((d) => g[1] + d + g[4]);
    return (g[3] ? [g[1] + g[4], ...delen] : delen).map(zonderVraag);
  }
  // uitklapblok onder de beschrijving van een thema: de trefwoorden waarop items automatisch dit thema krijgen
  function themaTermen(slug) {
    const tw = ((S.data.themas.regels || {})[slug] || {}).trefwoorden || [];
    if (!tw.length) return "";
    const termen = uniek(tw.flatMap(leesbareTermen).filter(Boolean));
    return `<details class="meer thematermen"><summary>Welke termen horen bij dit thema</summary>
      <p>Een item krijgt dit thema als een van deze termen in de titel staat, ook als deel van een langer woord. Bij de wekelijkse review kan een item ook met de hand anders zijn ingedeeld.</p>
      <p class="termen">${termen.map(esc).join(", ")}</p></details>`;
  }
  function themaDetail(slug) {
    const t = S.T.thema(slug);
    if (!t) return `<h1>Thema niet gevonden</h1><p class="themas-intro">Er is geen thema "${esc(slug)}". <a href="#themas">Naar alle thema's</a></p>`;
    const tabs = THEMA_TABS.map((tb) => {
      const def = themaDef(tb.def(), t.slug, tb.param);
      return { ...tb, tdef: def, n: def.rijen().length };
    }).filter((tb) => tb.n);
    let gevraagd = (hashQuery().type || [])[0] || "";
    if (gevraagd === "antwoorden") gevraagd = "kamervragen";
    const actief = tabs.find((tb) => tb.param === gevraagd) || null;
    const adres = `#themas/${esc(t.slug)}`;
    const schak = `<nav class="schakelaar klein" aria-label="Onderdelen van dit thema">
        <a href="${adres}"${actief ? "" : ' aria-current="page"'}>Overzicht</a>
        <a href="#agenda?thema=${encodeURIComponent(t.slug)}">Agenda${ico("pijlrechts")}</a>
        ${tabs.map((tb) => `<a href="${adres}?type=${tb.param}"${tb === actief ? ' aria-current="page"' : ""}>${esc(tb.label)}</a>`).join("")}
      </nav>`;
    const kop = `<p class="small terug"><a href="#themas">Alle thema's</a></p>
      <h1>${esc(t.label)}</h1>
      <p class="themas-intro">${esc(t.description)}</p>${themaTermen(t.slug)}`;
    if (actief) {
      const basis = actief.def();
      return tabelPagina(actief.tdef, kop,
        `${esc(actief.label)} met het thema ${esc(t.label)}; dezelfde tabel als op <a href="#${basis.tab}?thema=${encodeURIComponent(t.slug)}">${esc(actief.alle)}</a>.`,
        actief.hint, schak);
    }
    // Overzicht: Net binnen en Komt eraan, zoals op de voorpagina, alleen voor dit thema
    const binnen = netBinnen(t.slug);
    const komend = agendaItems().filter((i) => sortKey(i.datum) >= VANDAAG && (i._act ? themasVanAct(i._act) : themasVanAgendaItem(i)).includes(t.slug)).slice(0, KOMT_MAX);
    const tabLink = (param, tekst) => (tabs.some((tb) => tb.param === param) ? `<a class="knop licht" href="${adres}?type=${param}">${tekst}</a>` : "");
    return `${kop}
      <div class="werkbalk">${schak}</div>
      <div class="ov-onder thema-ov">
        <section aria-labelledby="th-binnen"><h2 id="th-binnen">Net binnen</h2><div class="card"><ul class="list">
          ${netBinnenHtml(binnen)}
        </ul><div class="kaartvoet">${tabLink("kamervragen", "Alle Kamervragen")}${tabLink("kamerbrieven", "Alle Kamerbrieven")}${tabLink("moties", "Alle moties")}${tabLink("wetten", "Alle wetten")}</div></div></section>
        <section aria-labelledby="th-komt"><h2 id="th-komt">Komt eraan</h2><div class="card"><ul class="list">
          ${komtEraan(komendeStemming(t.slug), komend, t.slug)}
        </ul><div class="kaartvoet"><a class="knop licht" href="#agenda?thema=${encodeURIComponent(t.slug)}">Agenda voor dit thema</a></div></div></section>
      </div>`;
  }
  /* ---------- Tabellen: Moties & Amendementen, Vragen & Brieven, Wetgeving ---------- */
  // Eén tabelpatroon (DESIGN.md, "Tables"): schakelaar of titel links, zoekveld rechts; categorische kolommen zijn filters
  // (kolomkop opent een menu met vinkjes; binnen een kolom "of", tussen kolommen "en"); alleen de datum sorteert.
  // Een klik op een rij of haar titel klapt de details uit (ook de knop rechts in de titelcel); de bron staat in de details. Filters en zoekterm staan in de URL.
  // Een pagina is een definitie: { tab, rijen(), filters, kolommen, datum, link, zoektekst, detail, knopLabel, eenheid, gedeeld }.
  const nlSort = new Intl.Collator("nl", { sensitivity: "base" });
  // vaste volgorde in een filtermenu; onbekende waarden achteraan
  const opVolgorde = (vast) => (vs) => [...vast.filter((v) => vs.has(v)), ...[...vs].filter((v) => !vast.includes(v)).sort(nlSort.compare)];
  const leegCel = (t) => `<span class="leeg" title="${esc(t)}"><span aria-hidden="true">–</span><span class="sr-only">${esc(t)}</span></span>`;
  // titels altijd met een hoofdletter (zinsvorm, ook als de bron met een kleine letter begint)
  // titel van een rij: tekst; een klik erop klapt de rij uit, de bron staat als knop of link in de details (Tobias, 23 nov 2026)
  const rijTitel = (t) => `<span class="ltitel">${esc(hoofd(t))}</span>`;
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
  // in een rij hooguit twee thema's plus "+n"; met de muis op de cel (of focus op de uitklapknop) staan ze er allemaal
  const themaCel = (ids) => {
    if (ids.length <= 2) return themaChips(ids);
    const chip = (id) => `<span class="tchip">${esc(S.T.naam(id))}</span>`, rest = ids.slice(2);
    return `<span class="tchips">${chip(ids[0])}<span class="tchip-rij">${chip(ids[1])}<span class="tplus" aria-hidden="true">+${rest.length}</span></span></span><span class="sr-only">, ${rest.map((id) => esc(S.T.naam(id))).join(", ")}</span><span class="talle" aria-hidden="true">${themaChips(ids)}</span>`;
  };
  const themaKolom = (themasVan) => ({ filter: "thema", tdCls: "thema hide-sm", cel: (z) => { const th = themasVan(z); return th.length ? themaCel(th) : leegCel("Geen thema"); } });
  const themaFilter = (themasVan) => ({ label: "Thema", waarden: (z) => (themasVan(z).length ? themasVan(z) : [""]), orde: (vs) => opVolgorde([...S.T.lijst.map((t) => t.slug), ""])(vs), tekst: (v) => esc(v ? S.T.naam(v) : "Geen thema") });
  // thema's per rij onthouden: de aantallen in het filtermenu vragen ze voor elke rij opnieuw
  const onthoud = (fn, sleutel) => { const m = new Map(); return (z) => { const k = sleutel(z); let t = m.get(k); if (!t) m.set(k, (t = fn(z))); return t; }; };

  function tabelStaat(def) {
    const q = hashQuery();
    const st = { q: (q.q || []).join(","), richting: (q.volgorde || [])[0] === "oud" ? "asc" : "desc", open: q.open || [] };
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
  // past een rij bij de gekozen filters (binnen een filter "of", tussen filters "en"); behalve: dat filter telt niet mee
  const pastFilters = (filters, st, rij, behalve) => Object.entries(filters).every(([k, f]) => k === behalve || !st[k].length || f.waarden(rij).some((v) => st[k].includes(v)));
  function tabelPast(def, st, z, behalve) {
    const q = st.q.trim().toLowerCase();
    if (q && !def.zoektekst(z).toLowerCase().includes(q)) return false;
    return pastFilters(def.filters, st, z, behalve);
  }

  /* ---------- Werkbalk: zoekveld en filters boven elke lijst (tabellen en Agenda) ---------- */
  // Het zoekveld filtert deze lijst; elk filter is een menu met vinkjes en per waarde het aantal rijen onder de andere
  // filters (waarden op nul blijven staan, stil). Actieve filters staan eronder als chips met "Alles wissen".
  // Filters: { k: { label, waarden(rij), orde(set, tel), tekst(v) } }. tekst geeft html.
  // Eén rij op elke pagina (Tobias, 18 nov 2026): links de schakelaar (links), rechts de filters en helemaal rechts het zoekveld.
  // tabelpagina's (metFacetten false): de filters staan in de kolomkoppen (tabelKoppen(); Tobias, 23 nov 2026)
  const werkbalk = (hint, q, links = "", metFacetten = true) => `<div class="werkbalk">${links}${metFacetten ? `<div class="facetten" id="wfacetten"></div>` : ""}<input type="search" id="wq" placeholder="${esc(hint)}" value="${esc(q)}" aria-label="${esc(hint)}"></div>
      <div class="actieve-filters" id="wactief" hidden></div><p class="sr-only" id="wstatus" role="status"></p>`;
  // statusmelding voor schermlezers na zoeken of filteren (WCAG 4.1.3); de eerste tekening van de pagina meldt niets
  let _meldTimer = null;
  function meldAantal(n) {
    const el = $("#wstatus");
    if (!el) return;
    if (!el.dataset.klaar) { el.dataset.klaar = "1"; return; }
    clearTimeout(_meldTimer);
    _meldTimer = setTimeout(() => { el.textContent = n ? `${nl(n)} ${n === 1 ? "resultaat" : "resultaten"}` : "Geen resultaten met deze filters"; }, 400);
  }
  // w: { filters, st, rijen, past(rij, behalve), zoek(q), zet(k, waarden), wis() }
  function tekenWerkbalk(w) {
    const fe = $("#wfacetten") || $("#mkop"), ae = $("#wactief");
    if (!fe) return;
    const open = fe.querySelector("details[open]")?.dataset.f || "";
    const focusId = fe.contains(document.activeElement) ? document.activeElement.id : "";
    const facet = ([k, f]) => {
      const tel = new Map();
      for (const r of w.rijen) { const p = w.past(r, k); for (const v of f.waarden(r)) tel.set(v, (tel.get(v) || 0) + (p ? 1 : 0)); }
      for (const v of w.st[k]) if (!tel.has(v)) tel.set(v, 0);
      const n = w.st[k].length;
      return `<details class="facet${open === k ? " al-open" : ""}" data-f="${k}"${open === k ? " open" : ""}>
        <summary>${esc(f.label)}${n ? ` <span class="facet-n">${n}</span>` : ""}</summary>
        <div class="facet-menu" role="group" aria-label="${esc(f.label)}">${f.orde(new Set(tel.keys()), tel).map((v, i) =>
          `<label${tel.get(v) ? "" : ' class="nul"'}><input type="checkbox" id="wf-${k}-${i}" data-f="${k}" value="${esc(v)}"${w.st[k].includes(v) ? " checked" : ""}><span>${f.tekst(v)}</span><span class="n">${nl(tel.get(v))}</span></label>`).join("") || `<div class="muted small">Geen waarden</div>`}</div></details>`;
    };
    // werkbalk (Agenda): alle filters naast elkaar; tabel: elk filter in de kop van zijn kolom
    if (fe.id === "wfacetten") fe.innerHTML = Object.entries(w.filters).map(facet).join("");
    else for (const e of Object.entries(w.filters)) { const th = fe.querySelector(`th[data-f="${e[0]}"]`); if (th) th.innerHTML = facet(e); }
    const chips = Object.entries(w.filters).flatMap(([k, f]) => w.st[k].map((v) =>
      `<button type="button" class="chip actief" data-rm="${k}" data-v="${esc(v)}" aria-label="Filter ${f.tekst(v).replace(/<[^>]+>/g, "")} wissen">${f.tekst(v)}${ico("x")}</button>`));
    ae.innerHTML = chips.length ? `${chips.join("")}<button type="button" class="linkknop" data-wis>Alles wissen</button>` : "";
    ae.hidden = !chips.length;
    // een menu dat open bleef bij opnieuw tekenen komt niet opnieuw binnen; daarna mag het weer vervagen bij sluiten
    const ao = fe.querySelector(".al-open");
    if (ao) requestAnimationFrame(() => requestAnimationFrame(() => ao.classList.remove("al-open")));
    if (focusId && document.getElementById(focusId)) document.getElementById(focusId).focus({ preventScroll: true });
  }
  function bindWerkbalk(w) {
    const fe = $("#wfacetten") || $("#mkop"), ae = $("#wactief"), veld = $("#wq");
    veld.addEventListener("input", () => w.zoek(veld.value));
    // één menu tegelijk open
    fe.addEventListener("toggle", (e) => {
      if (e.target.open) fe.querySelectorAll("details[open]").forEach((d) => { if (d !== e.target) d.open = false; });
    }, true);
    // een dubbelklik op een regel zet het vinkje niet aan en meteen weer uit
    fe.addEventListener("click", (e) => { if (e.detail > 1 && e.target.closest(".facet-menu label")) e.preventDefault(); });
    fe.addEventListener("change", (e) => {
      const cb = e.target.closest("input[data-f]");
      if (!cb) return;
      const k = cb.dataset.f;
      w.zet(k, cb.checked ? uniek([...w.st[k], cb.value]) : w.st[k].filter((x) => x !== cb.value));
    });
    ae.addEventListener("click", (e) => {
      const b = e.target.closest("[data-rm]");
      if (b) w.zet(b.dataset.rm, w.st[b.dataset.rm].filter((x) => x !== b.dataset.v));
      else if (e.target.closest("[data-wis]")) { w.wis(); veld.focus(); }
    });
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
      if (c.filter) return `<th class="kopf" data-f="${c.filter}">${esc(def.filters[c.filter].label)}</th>`;
      if (c.datum) return `<th class="rechts dkop" aria-sort="${asc ? "ascending" : "descending"}"><button type="button" class="sorteer actief" data-sort="datum" aria-label="${esc(c.kop)}, ${asc ? "oudste" : "nieuwste"} eerst; klik om om te draaien">${esc(c.kop)}${ico(asc ? "pijlop" : "pijlneer")}</button></th>`;
      return `<th class="${c.thCls || ""}">${c.kop}</th>`;
    }).join("")}</tr>`;
  }
  // de titelcel draagt de uitklapknop (rechts, altijd zichtbaar); het label noemt de rij, aria-expanded de stand
  function tabelCel(def, c, z) {
    if (c.datum) return `<td class="datum rechts">${def.datum(z) ? fmtKort(def.datum(z)) : leegCel("Geen datum")}</td>`;
    const cel = c.cel(z);
    const knop = c.titel ? ` <button type="button" class="uitklap" aria-expanded="false" aria-label="${esc(def.knopLabel)}: ${cel.replace(/<[^>]+>/g, "").replace(/"/g, "&quot;")}">${ico("chevron")}</button>` : "";
    return `<td class="${c.tdCls || ""}">${cel}${knop}</td>`;
  }
  // kop: de titel, op één rij met het zoekveld; links: een schakelaar links in de werkbalk; voet: een stille regel onder de tabel
  function tabelPagina(def, kop, voet, zoekhint, links = "") {
    S.tabel = { def, st: tabelStaat(def) };
    return `<div class="kopbalk"><div class="kop">${kop}</div>${werkbalk(zoekhint, S.tabel.st.q, links, false)}</div>
      <div class="tablewrap"><table class="motietabel" data-tab="${def.tab}"><thead id="mkop">${tabelKoppen(def, S.tabel.st)}</thead><tbody id="mbody"></tbody></table></div>
      ${voet ? `<p class="small muted">${voet}</p>` : ""}`;
  }
  const paginaKop = (titel) => `<h1>${esc(titel)}</h1>`;
  const schakelaar = (label, opties, actief) => `<nav class="schakelaar" aria-label="${esc(label)}">
      ${opties.map(([k, l]) => `<a href="#${k}" data-tab="${k}" ${k === actief ? 'aria-current="page"' : ""}>${l}</a>`).join("")}
    </nav>`;

  function bindTabel() {
    if (!S.tabel) return;
    const { def, st } = S.tabel;
    const alle = def.rijen();
    let rows = [];
    const n = def.kolommen.length;
    // lange lijsten krijgen een kop per maand, tenzij bijna elke rij een eigen maand heeft (Wetgeving)
    const perMaand = alle.length >= 100 && alle.length >= 5 * uniek(alle.map((z) => (def.datum(z) || "").slice(0, 7))).length;
    const wisAlles = () => { st.q = ""; $("#wq").value = ""; for (const k of Object.keys(def.filters)) st[k] = []; toepassen(); };
    const w = { filters: def.filters, st, rijen: alle, past: (z, behalve) => tabelPast(def, st, z, behalve),
      zoek: (q) => { st.q = q; toepassen(); }, zet: (k, vs) => { st[k] = vs; toepassen(); }, wis: () => wisAlles() };

    const tekenRijen = () => {
      const grens = st.richting === "desc" && def.datum ? grensIndex(rows.map(def.datum)) : -1;
      const maand = (z) => (z ? (def.datum(z) || "").slice(0, 7) : null);
      $("#mbody").innerHTML = rows.map((z, i) => (i === grens ? `<tr class="grens"><td colspan="${n}">${GRENS_LABEL}</td></tr>` : "")
        + (perMaand && maand(z) !== maand(rows[i - 1]) ? `<tr class="maand"><th colspan="${n}" scope="rowgroup">${maand(z) ? esc(hoofd(fmtDatum(maand(z)))) : "Zonder datum"}</th></tr>` : "")
        + `<tr class="row" data-i="${i}">${def.kolommen.map((c) => tabelCel(def, c, z)).join("")}</tr>`).join("")
        || `<tr><td colspan="${n}" class="empty">Geen ${def.eenheid} ${tabelGefilterd(def, st) ? `met deze filters <button type="button" class="linkknop" data-wisalles>Filters wissen</button>` : "gevonden"}</td></tr>`;
    };
    const toepassen = () => {
      rows = alle.filter((z) => tabelPast(def, st, z)).sort(tabelVolgorde(def, st.richting));
      tekenRijen();
      tekenWerkbalk(w);
      meldAantal(rows.length);
      // op een themapagina: eigen adres plus vast deel (type=...)
      const q = tabelQuery(def, st);
      history.replaceState(null, "", `#${def.adres || def.tab}${def.vast ? `?${def.vast}${q ? "&" + q.slice(1) : ""}` : q}`);
      // de schakelaar op Wetgeving neemt de gedeelde filters mee naar de andere helft
      document.querySelectorAll("#view .schakelaar a[data-tab]").forEach((a) => { a.href = `#${a.dataset.tab}${tabelQuery(def, st, def.gedeeld)}`; });
    };
    bindWerkbalk(w);

    $("#mkop").addEventListener("click", (e) => {
      if (!e.target.closest("button[data-sort]")) return;
      st.richting = st.richting === "asc" ? "desc" : "asc";
      $("#mkop").innerHTML = tabelKoppen(def, st);
      toepassen();
      $("#mkop button[data-sort]").focus();
    });
    // een klik op de rij klapt de details uit (niet bij tekst selecteren)
    $("#mbody").addEventListener("click", (e) => {
      if (e.target.closest("[data-wisalles]")) { wisAlles(); $("#wq").focus(); return; }
      const tr = e.target.closest("tr.row");
      if (!tr) return;
      const knop = e.target.closest("button.uitklap");
      if (!knop && (e.target.closest("a, button") || String(window.getSelection && window.getSelection()).trim())) return;
      const nxt = tr.nextElementSibling, open = nxt && nxt.classList.contains("detail") && !nxt.classList.contains("weg");
      if (open) { nxt.classList.add("weg"); setTimeout(() => nxt.remove(), 150); } // vervaagt eerst (--d-kort), zoals hij binnenkwam
      else {
        const d = document.createElement("tr"); d.className = "detail";
        d.innerHTML = `<td colspan="${n}">${def.detail(rows[+tr.dataset.i])}</td>`;
        tr.after(d);
        vulTeksten(d);
      }
      tr.classList.toggle("open", !open);
      tr.querySelector("button.uitklap").setAttribute("aria-expanded", String(!open));
    });
    toepassen();
    // ?open=<sleutel>[,<sleutel>] (bv. vanaf Net binnen): die rijen opengeklapt, de bovenste in beeld; toepassen() heeft open al uit de URL gehaald
    const knoppen = rows.flatMap((z, i) => (st.open.includes(def.sleutel(z)) ? [$(`#mbody tr[data-i="${i}"] button.uitklap`)] : []));
    knoppen.forEach((k) => k.click());
    if (knoppen.length) setTimeout(() => knoppen[0].closest("tr").scrollIntoView({ block: "center" }), 0);
  }
  // "A, B en C"
  const opsomming = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} en ${xs[xs.length - 1]}` : xs.join(""));
  const naamFractie = (i) => `${esc(i.naam)}${i.fractie ? ` (${esc(i.fractie)})` : ""}`;

  /* ---------- Tekst van moties en amendementen, en de documentweergave ---------- */
  // data/tk/teksten.json (pipeline/teksten.py): pas geladen als iemand voor het eerst een rij openklapt
  let tekstenBelofte = null;
  const laadTeksten = () => tekstenBelofte || (tekstenBelofte = load("data/tk/teksten.json", {}).then((t) => (S.data.teksten = t || {})));
  // het besluitende deel van een motie ("verzoekt de regering", "spreekt uit", ...) staat in inkt, de overwegingen in ink-2
  const DICTUM = /^(verzoekt|spreekt|roept|draagt|wijst|besluit|en gaat over)/i;
  const TEKST_ZICHTBAAR = 8;
  function tekstHtml(z) {
    const t = (S.data.teksten || {})[z.nummer];
    if (!t || !t.blokken || !t.blokken.length) return `<p class="muted">De tekst is nog niet beschikbaar${z.docId ? "; bekijk het origineel" : ""}.</p>`;
    const blok = ([soort, x]) => soort === "kop" ? `<p class="mt-kop">${esc(x)}</p>`
      : `<p${soort === "wijz" ? ` class="mt-wijz"` : DICTUM.test(x) ? ` class="mt-dictum${/^en gaat/i.test(x) ? " slot" : ""}"` : ""}>${esc(x)}</p>`;
    // amendement: eerst de toelichting (waar het om gaat), de wijziging zelf ingeklapt
    const tl = t.blokken.map((b) => b[0] === "kop" && b[1] === "Toelichting").lastIndexOf(true);
    const wijziging = tl > 0 ? t.blokken.slice(0, tl) : [];
    const bl = tl > 0 ? t.blokken.slice(tl) : t.blokken, rest = bl.length > TEKST_ZICHTBAAR + 2 ? bl.slice(TEKST_ZICHTBAAR) : [];
    const zicht = rest.length ? bl.slice(0, TEKST_ZICHTBAAR) : bl;
    const inklap = (label, xs) => `<details class="meer"><summary>${label}</summary><div class="mt-tekst">${xs.map(blok).join("")}</div></details>`;
    // voorlopige tekst (uit docx of pdf): geen bronregel (Tobias, 18 nov 2026)
    const bron = t.bron === "ob" ? `Officiële tekst · ${extLink(`https://zoek.officielebekendmakingen.nl/kst-${t.kamerstuk}.html`, `Kamerstuk ${t.kamerstuk.replace(/-(\d+)$/, ", nr. $1")}`)}` : "";
    return `<div class="mt-tekst">${zicht.map(blok).join("")}</div>
      ${rest.length ? inklap(`Toon de rest (${nl(rest.length)} ${rest.length === 1 ? "alinea" : "alinea's"})`, rest) : ""}
      ${wijziging.length ? inklap("Toon de wijziging zelf", wijziging) : ""}
      ${bron ? `<p class="mt-bron">${bron}</p>` : ""}`;
  }
  function vulTeksten(el) {
    const plekken = [...el.querySelectorAll("[data-tekst]")];
    if (!plekken.length) return;
    laadTeksten().then(() => {
      for (const p of plekken) {
        const z = S.data.zaken.find((x) => x.nummer === p.dataset.tekst);
        if (z) p.innerHTML = tekstHtml(z);
      }
    });
  }
  const tekstBlok = (z) => (z.soort === "Motie" || z.soort === "Amendement"
    ? `<div class="mt-plek" data-tekst="${esc(z.nummer)}">${S.data.teksten ? tekstHtml(z) : `<p class="muted">Tekst laden</p>`}</div>` : "");

  // Documentweergave: pdf (pdf.js) en Word (docx-preview) rechtstreeks uit de open data van de Kamer.
  // Het gegevensmagazijn staat ophalen vanaf elke site toe (CORS), maar niet tonen in een iframe.
  const DOC_URL = (docId) => `https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0/Document/${encodeURIComponent(docId)}/resource`;
  const DOWNLOAD_URL = (dnr) => `https://www.tweedekamer.nl/downloads/document?id=${encodeURIComponent(dnr)}`;
  const downloadUrl = (d) => (d.id || d.document ? DOWNLOAD_URL(d.id || d.document) : DOC_URL(d.docId));
  const LEESBAAR = new Set(["PDF", "DOCX"]);
  // knop die het document opent; d: {docId, bestand, id (D-nummer), titel, link}
  const leesbaar = (d) => !!(d && d.docId && LEESBAAR.has(d.bestand));
  const docData = (d) => `data-doc="${esc(d.docId)}" data-bestand="${esc(d.bestand)}" data-dnr="${esc(d.id || d.document || "")}" data-titel="${esc(d.titel || "")}" data-link="${esc(d.link || "")}"`;
  const docKnop = (d, label, stijl) => (leesbaar(d) ? `<button type="button" class="doclees knop ${stijl}" ${docData(d)}>${esc(label)}</button>` : "");
  // document in een lijst: de link opent het venster, het woord Download erachter slaat het bestand op; zonder leesbaar document een gewone link
  const docRegel = (d, label, na = "") => (leesbaar(d)
    ? `<a class="doclees" href="${esc(d.link || DOC_URL(d.docId))}" aria-haspopup="dialog" ${docData(d)}>${esc(label)}</a>${na} <a class="download" href="${esc(downloadUrl(d))}" target="_blank" rel="noopener" aria-label="Download ${esc(d.titel || label)}">Download</a>`
    : `${extLink(d.link, label)}${na}`);
  // knoppenrij in de details: precies één bosgroene knop (stijl "" bij docKnop); zonder leesbaar document is dat de eerste link
  const mlinks = (knoppen, links, cls = "") => `<div class="mlinks${cls}">${knoppen || links.replace("<a ", `<a class="knop" `)}${knoppen ? links : ""}</div>`;
  let pdfjs = null, viewerToken = 0;
  async function pdfLib() {
    if (!pdfjs) {
      pdfjs = await import(new URL("assets/vendor/pdf.min.mjs", location.href).href);
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("assets/vendor/pdf.worker.min.mjs", location.href).href;
    }
    return pdfjs;
  }
  const laadScript = (src) => new Promise((ok, fout) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = fout; document.head.append(s); });
  function viewer() {
    let dlg = $("#docview");
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.id = "docview"; dlg.className = "docview"; dlg.setAttribute("aria-labelledby", "dv-titel");
    dlg.innerHTML = `<div class="dv-kop"><div class="dv-kopt"><p class="dv-meta" id="dv-meta"></p><h2 id="dv-titel"></h2></div>
      <div class="dv-acties" id="dv-acties"></div>
      <button type="button" class="dv-sluit" aria-label="Sluiten" data-dvsluit>${ico("x")}</button></div>
      <div class="dv-body" id="dv-body" tabindex="-1"></div>`;
    document.body.append(dlg);
    dlg.addEventListener("click", (e) => { if (e.target === dlg || e.target.closest("[data-dvsluit]")) dlg.close(); });
    dlg.addEventListener("close", () => { viewerToken++; document.documentElement.classList.remove("dv-open"); setTimeout(() => { if (!dlg.open) $("#dv-body").innerHTML = ""; }, 200); }); // leeg na het vervagen (--d-menu)
    return dlg;
  }
  // Word-weergave als in Word (Tobias, 24 nov 2026): lettertype, grootte, vet, cursief, onderstreept en uitlijning uit het
  // document (docx-preview); Kamervragen genummerd, voetnoten bij de tekst, vanaf 3 tussenkoppen een inhoud in de zijbalk.
  // shortcut: briefhoofd en voettekst niet getoond; docx-preview zet de zwevende kaders daarvan op de verkeerde plek
  const DOCX_OPTIES = { className: "dvw", renderHeaders: false, renderFooters: false, renderAltChunks: false, ignoreLastRenderedPageBreak: true, useBase64URL: true };
  const metTerugval = (f) => `${f.trim()}, Verdana, sans-serif`;
  const VOETNOOT = /voetnoot|footnote|eindnoot|endnote/i;
  // het bestand klaarmaken voor docx-preview: dat neemt ook het Aziatische lettertype (eastAsia) over als gewoon lettertype,
  // en kent geen grafieken; die krijgen een merkteken en worden na het tekenen een svg (wordGrafiek)
  async function docxVooraf(buffer) {
    const zip = await window.JSZip.loadAsync(buffer), grafieken = [];
    const lees = (pad) => zip.file(pad)?.async("string");
    const xml = async (pad) => { const t = await lees(pad); return t && new DOMParser().parseFromString(t, "application/xml"); };
    const rels = await xml("word/_rels/document.xml.rels"), thema = await xml("word/theme/theme1.xml");
    const relatie = new Map([...(rels?.querySelectorAll("Relationship") || [])].map((x) => [x.getAttribute("Id"), x.getAttribute("Target")]));
    for (const f of zip.file(/^word\/[\w-]+\.xml$/)) {
      let t = (await f.async("string")).replace(/<w:rFonts\b[^>]*>/g, (x) => x.replace(/ w:eastAsia(Theme)?="[^"]*"/g, ""));
      if (f.name === "word/document.xml") {
        t = t.replace(/<w:drawing>(?:(?!<\/w:drawing>)[\s\S])*?<\/w:drawing>/g, (x) => {
          const id = x.match(/<c:chart\b[^>]*\br:id="([^"]+)"/)?.[1];
          if (!id) return x;
          const [, b, h] = x.match(/<wp:extent cx="(\d+)" cy="(\d+)"/) || [0, 5486400, 2743200];
          grafieken.push({ id, b: b / 9525, h: h / 9525 });
          return `<w:t>@@grafiek${grafieken.length - 1}@@</w:t>`;
        });
      }
      zip.file(f.name, t);
    }
    for (const g of grafieken) g.xml = await xml(`word/${relatie.get(g.id)}`);
    return { bestand: await zip.generateAsync({ type: "arraybuffer" }), grafieken, thema };
  }
  // lijngrafiek uit Word, met de waarden, kleuren en assen uit het bestand
  // shortcut: alleen lijngrafieken (de enige soort in de bijlagen van nov 2026); andere soorten krijgen een zin
  function wordGrafiek({ xml, b, h }, thema) {
    const kind = (el, naam) => [...(el?.children || [])].find((x) => x.localName === naam);
    const alle = (el, naam) => [...(el?.getElementsByTagNameNS("*", naam) || [])];
    const val = (el, naam) => alle(el, naam)[0]?.getAttribute("val");
    const lijn = alle(xml, "lineChart")[0], soorten = [...(alle(xml, "plotArea")[0]?.children || [])].filter((x) => /Chart$/.test(x.localName));
    if (!lijn || soorten.length !== 1 || val(lijn, "grouping") !== "standard") return `<em>Deze grafiek kan hier niet worden getoond; hij staat in het bestand (Download).</em>`;
    const punten = (el) => alle(el, "pt").map((p) => ({ i: +p.getAttribute("idx"), v: alle(p, "v")[0]?.textContent, code: p.getAttribute("formatCode") || alle(el, "formatCode")[0]?.textContent || "" }));
    const kleur = (ln) => {
      const k = alle(ln, "srgbClr")[0]?.getAttribute("val"), sch = alle(ln, "schemeClr")[0]?.getAttribute("val");
      const hex = k || (sch && alle(alle(thema, sch)[0], "srgbClr")[0]?.getAttribute("val"));
      return /^[\da-f]{6}$/i.test(hex || "") ? `#${hex}` : "currentColor";
    };
    const reeksen = alle(lijn, "ser").map((s) => {
      const ln = alle(kind(s, "spPr"), "ln")[0];
      return { naam: alle(kind(s, "tx"), "v")[0]?.textContent || "", kleur: kleur(ln), streep: /dash/i.test(val(ln, "prstDash") || ""), cat: punten(kind(s, "cat")), ps: punten(kind(s, "val")).map((p) => ({ i: p.i, y: +p.v })).filter((p) => Number.isFinite(p.y)) };
    });
    const ys = reeksen.flatMap((s) => s.ps.map((p) => p.y));
    if (!ys.length) return "";
    const datum = (n) => new Date(Date.UTC(1899, 11, 30) + n * 864e5);
    const isDatum = (c) => /[dmy]/i.test(c.code.replace(/general|"[^"]*"/gi, "")) && Number.isFinite(+c.v);
    const cats = new Map((reeksen.find((s) => s.cat.length)?.cat || []).map((c) => [c.i, c])), n = Math.max(...reeksen.flatMap((s) => s.ps.map((p) => p.i))) + 1;
    const opDatum = alle(xml, "dateAx").length && [...cats.values()].every(isDatum);
    // de as begint bij 0, zoals in Word, behalve als de waarden dicht bij elkaar liggen
    const as = alle(xml, "valAx")[0], hoog = Math.max(...ys), laag = Math.min(...ys);
    const ruw = (hoog - (laag > hoog * 5 / 6 ? laag : Math.min(0, laag))) / 5 || 1, tien = 10 ** Math.floor(Math.log10(ruw));
    const stap = +(val(as, "majorUnit") || [1, 2, 5, 10].find((x) => x * tien >= ruw * 0.999) * tien);
    const y0 = +(val(as, "min") ?? Math.floor((laag > hoog * 5 / 6 ? laag : Math.min(0, laag)) / stap) * stap), y1 = +(val(as, "max") ?? Math.ceil(hoog / stap - 1e-9) * stap);
    const code = alle(as, "numFmt")[0]?.getAttribute("formatCode") || "", pct = code.includes("%"), dec = Math.max(0, -Math.floor(Math.log10(stap * (pct ? 100 : 1)) + 1e-9));
    const getal = (v) => `${code.includes("€") ? "€ " : ""}${(pct ? v * 100 : v).toLocaleString("nl-NL", { minimumFractionDigits: code.includes("€") ? Math.max(2, dec) : dec, maximumFractionDigits: Math.max(2, dec) })}${pct ? "%" : ""}`;
    const x0 = 56, x1 = b - 24, yb = h - 64, yt = 16;
    const px = (i) => { if (!opDatum) return x0 + ((i + 0.5) / n) * (x1 - x0); const d = [...cats.values()].map((c) => +c.v), a = Math.min(...d), z = Math.max(...d); return x0 + ((+cats.get(i)?.v - a) / (z - a || 1)) * (x1 - x0); };
    const py = (y) => yb - ((y - y0) / (y1 - y0 || 1)) * (yb - yt);
    const raster = Array.from({ length: Math.round((y1 - y0) / stap) + 1 }, (_, k) => y0 + k * stap)
      .map((v) => `<line x1="${x0}" x2="${x1}" y1="${py(v)}" y2="${py(v)}"/><text x="${x0 - 8}" y="${py(v) + 4}" text-anchor="end">${esc(getal(v))}</text>`).join("");
    let vorige = -Infinity;
    const assen = [...cats.values()].map((c) => {
      const x = px(c.i);
      if (x - vorige < 80) return ""; // labels die elkaar raken vallen weg
      vorige = x;
      return `<text x="${x}" y="${yb + 20}" text-anchor="middle">${esc(isDatum(c) ? fmtKort(datum(+c.v).toISOString().slice(0, 10)) : c.v)}</text>`;
    }).join("");
    const lijnen = reeksen.map((s) => `<polyline points="${s.ps.map((p) => `${px(p.i).toFixed(1)},${py(p.y).toFixed(1)}`).join(" ")}" stroke="${s.kleur}"${s.streep ? ` stroke-dasharray="8 4"` : ""}/>`).join("");
    const legenda = reeksen.map((s) => `<span><svg viewBox="0 0 24 4" width="24" height="4" aria-hidden="true"><line x2="24" y1="2" y2="2" stroke="${s.kleur}" stroke-width="3"${s.streep ? ` stroke-dasharray="6 3"` : ""}/></svg>${esc(s.naam)}</span>`).join("");
    return `<span class="dv-grafiek"><svg viewBox="0 0 ${b} ${h - 28}" role="img" aria-label="Lijngrafiek: ${esc(reeksen.map((s) => s.naam).join(", "))}"><g class="raster">${raster}</g>${assen}<g class="lijnen">${lijnen}</g></svg><span class="dv-legenda">${legenda}</span></span>`;
  }
  function docxHerstel(art, grafieken, thema) {
    for (const sp of art.querySelectorAll("span")) {
      const m = !sp.children.length && sp.textContent.match(/^@@grafiek(\d+)@@$/);
      if (m && grafieken[m[1]]) sp.outerHTML = wordGrafiek(grafieken[m[1]], thema);
    }
    for (const st of art.querySelectorAll("style")) {
      st.textContent = st.textContent
        // docx-preview geeft de standaardstijl alleen aan de alinea, niet aan de tekst erin: dan wint het lettertype van docDefaults
        .replace(/\.dvw p, (p\.[\w-]+) span \{/g, ".dvw p, .dvw p span, $1 span {")
        .replace(/\.dvw span \{(?=\s*font-family)/, ".dvw, .dvw span {")
        // "minstens 12pt" werd "100% + 12pt"
        .replace(/calc\(100% \+ ([\d.]+pt)\)/g, "max(1.2em, $1)")
        .replace(/font-family: ([^;}]+);/g, (_, f) => `font-family: ${metTerugval(f)};`);
    }
    for (const el of art.querySelectorAll("*")) {
      if (/^(SCRIPT|IFRAME|OBJECT|EMBED|LINK|META|FORM|INPUT|BUTTON)$/i.test(el.tagName)) { el.remove(); continue; }
      for (const a of [...el.attributes]) {
        if (/^on/i.test(a.name) || (/href$/i.test(a.name) && !/^(https?:|mailto:|#|data:image\/)/i.test(a.value))) el.removeAttribute(a.name);
      }
      if (el.tagName === "A" && /^(https?:|mailto:)/i.test(el.getAttribute("href") || "")) { el.target = "_blank"; el.rel = "noopener"; }
      if (el.style?.fontFamily) el.style.fontFamily = metTerugval(el.style.fontFamily);
      if (el.style?.lineHeight.includes("100% +")) el.style.lineHeight = el.style.lineHeight.replace(/calc\(100% \+ ([\d.]+pt)\)/, "max(1.2em, $1)");
    }
    // regels even lang als in Word, maar zonder de brede paginamarges
    for (const sec of art.querySelectorAll("section.dvw")) {
      if (!sec.textContent.trim() && !sec.querySelector("img, svg")) { sec.remove(); continue; } // voorblad met alleen een briefhoofd
      const c = getComputedStyle(sec), tekst = Math.round(sec.offsetWidth - parseFloat(c.paddingLeft) - parseFloat(c.paddingRight));
      sec.style.setProperty("--tekst", `${tekst}px`);
      // wat in Word in de brede marge hangt (inhoudsopgave), begint hier op de tekstlijn
      for (const p of sec.querySelectorAll("article p")) {
        const k = getComputedStyle(p);
        if (parseFloat(k.textIndent) + parseFloat(k.marginInlineStart) < -24) p.style.textIndent = `${-parseFloat(k.marginInlineStart)}px`;
      }
      // bijgesneden figuur: docx-preview vergroot vanuit het midden, waardoor hij naast zijn plek valt
      for (const img of sec.querySelectorAll("img")) {
        const [t, r, b, l] = (img.style.clipPath.match(/[\d.]+(?=%)/g) || []).map(Number);
        if (l != null) img.style.transformOrigin = `${(l / (l + 100 - r) || 0) * 100}% ${(t / (t + 100 - b) || 0) * 100}%`;
      }
      // figuren en tabellen breder dan de tekst: kleiner, in verhouding
      for (const img of sec.querySelectorAll("img")) if (img.offsetWidth > tekst) (img.parentElement.tagName === "DIV" ? img.parentElement : img).style.zoom = tekst / img.offsetWidth;
      for (const t of sec.querySelectorAll("table")) if (!t.parentElement.closest("table") && t.offsetWidth > tekst) t.style.zoom = tekst / t.offsetWidth;
    }
  }
  function wordExtra(body) {
    const art = body.querySelector(".dv-docx");
    const tekstVan = (p) => [...p.querySelectorAll("span")].filter((x) => !x.querySelector("span") && x.textContent.trim());
    // Kamervragen verwijzen vaak naar een nummering die niet in het bestand zit: dan zelf nummeren
    // shortcut: herkend aan de aanhef; uitbreiden als een ander soort stuk ook genummerd moet
    if (/Vragen van (het lid|de leden)/.test(art.querySelector("section")?.textContent.slice(0, 800))) {
      for (const p of art.querySelectorAll('p[class*="dvw-num-"]')) {
        if (p.textContent.trim() && getComputedStyle(p, "::before").content === "none") p.classList.add("dv-nr");
      }
    }

    // voetnoten: klik of muis op het cijfer toont de noot eronder; de lijst onderaan blijft staan
    // docx-preview geeft verwijzing en noot geen id: koppelen op volgorde binnen een blad
    for (const sec of art.querySelectorAll("section.dvw")) {
      const noten = [...sec.querySelectorAll(":scope > ol > li")];
      const refs = [...sec.querySelectorAll("article sup")].filter((x) => /^\d+$/.test(x.textContent.trim()) && VOETNOOT.test(x.closest("span[class]")?.className || ""));
      if (refs.length !== noten.length) continue; // liever geen kaartje dan de verkeerde noot
      refs.forEach((x, i) => { x._noot = noten[i]; x.classList.add("dv-ref"); x.tabIndex = 0; });
    }
    const isRef = (el) => el.closest?.("sup.dv-ref");
    let noot = null, timer = 0;
    const sluit = () => { clearTimeout(timer); noot?.remove(); noot = null; };
    const toon = (a) => {
      if (noot && noot._van === a) return;
      sluit();
      noot = document.createElement("div");
      noot.className = "dv-noot dvw"; noot._van = a;
      noot.innerHTML = a._noot.innerHTML;
      const ra = a.getBoundingClientRect(), rb = art.getBoundingClientRect();
      noot.style.setProperty("--x", `${Math.round(Math.min(ra.left - rb.left, rb.width - 440))}px`);
      noot.style.setProperty("--y", `${Math.round(ra.bottom - rb.top + 4)}px`);
      art.append(noot);
    };
    art.addEventListener("click", (e) => {
      const a = isRef(e.target);
      if (a) toon(a); else if (!e.target.closest(".dv-noot")) sluit();
      // verwijzing binnen het document: geen hashwissel, die zou de router laten springen
      const hier = e.target.closest('a[href^="#"]');
      if (hier) { e.preventDefault(); art.querySelector(`#${CSS.escape(hier.getAttribute("href").slice(1))}`)?.scrollIntoView({ block: "start" }); }
    });
    art.addEventListener("mouseover", (e) => { const a = isRef(e.target); if (a || e.target.closest(".dv-noot")) { clearTimeout(timer); if (a) toon(a); } });
    art.addEventListener("mouseout", (e) => { if (isRef(e.target) || e.target.closest(".dv-noot")) { clearTimeout(timer); timer = setTimeout(sluit, 250); } });
    body.onkeydown = (e) => { if (e.key === "Escape" && noot) { e.preventDefault(); sluit(); } else if (e.key === "Enter" && isRef(e.target)) toon(isRef(e.target)); };

    // inhoud: koppen, of alinea's die alleen vette tekst zijn (tussenkoppen in Kamerbrieven)
    const koppen = [...art.querySelectorAll("section.dvw > article p")].filter((el) => {
      const t = el.textContent.trim();
      if (!t || el.closest("table, li") || /dvw_(inhopg|toc)\d/i.test(el.className)) return false; // vette cellen, noten en de inhoudsopgave zijn geen tussenkop
      if (/dvw_(kop|heading)-?\d/i.test(el.className) || el.querySelector('[id^="_Toc"]')) return true; // _Toc: hier wijst de inhoudsopgave naar
      return t.length < 120 && /[a-z]{3}/.test(t) && tekstVan(el).every((x) => getComputedStyle(x).fontWeight >= 600);
    });
    if (koppen.length < 3) return;
    koppen.forEach((k, i) => { k.id = `dv-k${i}`; });
    art.insertAdjacentHTML("beforebegin", `<nav class="dv-inhoud" aria-label="Inhoud van het document"><p class="dv-inhoud-kop">Inhoud</p><ol>${koppen.map((k, i) =>
      `<li><a href="#dv-k${i}">${esc(k.textContent.trim())}</a></li>`).join("")}</ol></nav>`);
    body.classList.add("met-inhoud");
    const links = [...body.querySelectorAll(".dv-inhoud a")];
    body.querySelector(".dv-inhoud").addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a) return;
      e.preventDefault(); // geen hashwissel: die zou de router laten springen
      art.querySelector(a.getAttribute("href")).scrollIntoView({ block: "start" });
    });
    // de kop die nu bovenaan in beeld is licht op
    const markeer = () => {
      const top = body.getBoundingClientRect().top + 48;
      let i = -1; // boven de eerste kop: niets
      koppen.forEach((k, j) => { if (k.getBoundingClientRect().top <= top) i = j; });
      links.forEach((a, j) => (j === i ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
    };
    body.onscroll = markeer;
    markeer();
  }
  async function toonDocument(k) {
    const dlg = viewer(), token = ++viewerToken;
    const { doc, bestand, dnr, titel, link } = k.dataset;
    const body = $("#dv-body");
    $("#dv-titel").textContent = titel || "Document";
    $("#dv-meta").textContent = [bestand, dnr].filter(Boolean).join(" · ");
    $("#dv-acties").innerHTML = `${dnr ? extLink(DOWNLOAD_URL(dnr), "Download") : extLink(DOC_URL(doc), "Download")}${link ? extLink(link, "Op tweedekamer.nl") : ""}`;
    body.innerHTML = `<p class="dv-laden muted">Document laden</p>`;
    body.classList.remove("met-inhoud"); body.onscroll = body.onkeydown = null;
    document.documentElement.classList.add("dv-open");
    if (!dlg.open) {
      // het venster groeit uit de knop waarop is geklikt (en krimpt daar weer naartoe); plek berekend zonder layout van het venster
      const b = k.getBoundingClientRect(), vw = document.documentElement.clientWidth, w = Math.min(960, vw - 48);
      dlg.style.setProperty("--dv-oorsprong", `${Math.round(b.left + b.width / 2 - (vw - w) / 2)}px ${Math.round(b.top + b.height / 2 - 24)}px`);
      dlg.showModal();
    }
    body.focus({ preventScroll: true });
    const fout = () => { if (token === viewerToken) body.innerHTML = `<div class="dv-fout"><p>Het document kon hier niet worden getoond.</p><p>${extLink(dnr ? DOWNLOAD_URL(dnr) : DOC_URL(doc), "Download het bestand")}${link ? ` of ${extLink(link, "bekijk het op tweedekamer.nl")}` : ""}.</p></div>` };
    try {
      if (bestand === "DOCX") {
        if (!window.JSZip) await laadScript("assets/vendor/jszip.min.js");
        if (!window.docx) await laadScript("assets/vendor/docx-preview.min.js");
        const r = await fetch(DOC_URL(doc));
        if (!r.ok) throw new Error(r.status);
        const art = document.createElement("article");
        art.className = "dv-docx";
        const { bestand: klaar, grafieken, thema } = await docxVooraf(await r.arrayBuffer());
        await window.docx.renderAsync(klaar, art, null, DOCX_OPTIES);
        if (token !== viewerToken) return;
        body.replaceChildren(art);
        docxHerstel(art, grafieken, thema);
        wordExtra(body);
        return;
      }
      const lib = await pdfLib();
      const pdf = await lib.getDocument({ url: DOC_URL(doc), isEvalSupported: false }).promise;
      if (token !== viewerToken) { pdf.destroy(); return; }
      $("#dv-meta").textContent = [bestand, dnr, `${nl(pdf.numPages)} ${pdf.numPages === 1 ? "pagina" : "pagina's"}`].filter(Boolean).join(" · ");
      const eerste = await pdf.getPage(1);
      const breed = Math.min(body.clientWidth - 48, 860), basis = eerste.getViewport({ scale: 1 });
      const schaal = breed / basis.width;
      body.innerHTML = `<div class="dv-paginas">${Array.from({ length: pdf.numPages }, (_, i) => `<div class="dv-pagina" data-p="${i + 1}" style="--w:${breed}px;--h:${Math.round(basis.height * schaal)}px" aria-label="Pagina ${i + 1}"></div>`).join("")}</div>`;
      const teken = async (el) => {
        const page = await pdf.getPage(+el.dataset.p);
        if (token !== viewerToken) return;
        const vp = page.getViewport({ scale: schaal }), dpr = Math.min(window.devicePixelRatio || 1, 2);
        const c = document.createElement("canvas");
        c.width = Math.floor(vp.width * dpr); c.height = Math.floor(vp.height * dpr);
        el.style.setProperty("--h", `${Math.round(vp.height)}px`);
        el.style.setProperty("--scale-factor", String(schaal));
        await page.render({ canvasContext: c.getContext("2d"), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null }).promise;
        if (token !== viewerToken) return;
        el.append(c);
        const laag = document.createElement("div"); laag.className = "textLayer"; el.append(laag);
        await new lib.TextLayer({ textContentSource: page.streamTextContent(), container: laag, viewport: vp }).render();
      };
      const io = new IntersectionObserver((items) => {
        for (const it of items) if (it.isIntersecting && !it.target.dataset.klaar) { it.target.dataset.klaar = "1"; io.unobserve(it.target); teken(it.target).catch(() => {}); }
      }, { root: body, rootMargin: "800px 0px" });
      body.querySelectorAll(".dv-pagina").forEach((el) => io.observe(el));
      dlg.addEventListener("close", () => { io.disconnect(); pdf.destroy(); }, { once: true });
    } catch (e) {
      console.warn("Document niet getoond:", e);
      fout();
    }
  }
  document.addEventListener("click", (e) => {
    const k = e.target.closest(".doclees");
    if (!k || (k.href && (e.metaKey || e.ctrlKey || e.shiftKey))) return; // een link blijft in een nieuw tabblad te openen
    e.preventDefault(); e.stopPropagation();
    toonDocument(k);
  });

  /* ---------- Wetgeving ---------- */
  // Wetsvoorstellen uit de open data van de Kamer (soort Wetgeving of Initiatiefwetgeving in de gevolgde Kamerstukdossiers).
  const themasWet = onthoud((z) => themasVanZaak(z), (z) => z.nummer);
  const wetNr = (z) => String(z.dossiers[0]?.nummer || "");
  const wetHref = (z) => `#wetgeving/${encodeURIComponent(wetNr(z))}`;
  const wetSoort = (z) => (z.soort === "Initiatiefwetgeving" ? "Initiatiefwetsvoorstel" : "Regering");
  // Fasen zoals op tweedekamer.nl; welke fase geldt volgt uit onze besluiten, vergaderingen en stemmingen
  // (de Kamer zelf zet elk open wetsvoorstel op Voorbereiding).
  // na aanneming in de Tweede Kamer: fase Eerste Kamer tot de wet in het Staatsblad staat (data/tk/wetstukken.json, kamer: "Staatsblad")
  const WET_FASEN = ["Voorbereiding", "Debat", "Stemming", "Eerste Kamer", "Afgedaan"];
  const wetStb = (z) => (S.data.wetstukken[String(z.dossiers[0]?.nummer)] || []).find((d) => d.kamer === "Staatsblad");
  const AFGEDAAN = ["aangenomen", "verworpen", "ingetrokken", "vervallen"];
  const wetActiviteiten = onthoud((z) => {
    const nr = String(z.dossiers[0]?.nummer || "");
    const act = S.data.activiteiten.filter((a) => a.Datum && !["Geannuleerd", "Verplaatst"].includes(a.Status) && a.Soort !== "Procedurevergadering" && kamerstukkenVan(a).has(nr));
    // z.debatten (pipeline): ook debatten van vóór deze Kamerperiode of bij een commissie die de agenda niet volgt
    const bekend = new Set(act.map((a) => a.Nummer));
    return [...act, ...(z.debatten || []).filter((a) => !bekend.has(a.Nummer))];
  }, (z) => z.nummer);
  function wetFase(z) {
    // shortcut: een wet die de Eerste Kamer verwerpt, blijft in fase Eerste Kamer; pas aan als dat voorkomt
    if (z.uitslag === "aangenomen") return wetStb(z) ? 4 : 3;
    if (AFGEDAAN.includes(z.uitslag)) return 4;
    const soorten = z.besluiten.map((b) => b.soort || "");
    if (S.data.stemmingen[z.nummer] || z.uitslag === "aangehouden" || soorten.some((s) => /^Agenderen - stemmingen|^Stemmen - uitstellen/.test(s))) return 2;
    if (soorten.includes("Behandeling wordt voortgezet") || wetActiviteiten(z).some((a) => /^Plenair debat|^Wetgevingsoverleg|^Notaoverleg/.test(a.Soort) && a.Status === "Uitgevoerd")) return 1;
    return 0;
  }
  // "Eerste Kamer" is een naam en houdt zijn hoofdletters
  const wetStatus = (z) => { const f = wetFase(z); return f === 4 ? z.uitslag : f === 3 ? WET_FASEN[3] : WET_FASEN[f].toLowerCase(); };
  // Wetgevingsproces in gewone taal: besluiten zonder inhoud voor de lezer vallen weg, vaste soorten krijgen een eigen zin
  const STAP_WEG = /^LVIS|^Controversieel - niet|^Ter informatie|^Aanhouden - tot de volgende/;
  const STAP_TEKST = {
    "Leveren inbreng": "Inbreng voor het verslag geleverd.",
    "Aanmelden voor plenaire behandeling": "Aangemeld voor plenaire behandeling.",
    "Agenderen - plenair debat": "Op de lijst gezet voor een plenair debat.",
    "Stemmen - aangenomen": "Aangenomen door de Tweede Kamer.",
    "Stemmen - zonder stemming aannemen": "Aangenomen door de Tweede Kamer, zonder stemming.",
    "Stemmen - verworpen": "Verworpen door de Tweede Kamer.",
  };
  function wetStappen(z) {
    // de Kamerstukken (koninklijke boodschap, voorstel van wet) markeren het indienen zelf; anders één regel op de startdatum
    const stukken = S.data.wetstukken[String(z.dossiers[0]?.nummer)] || [];
    const s = stukken.length ? [] : [{ datum: z.gestartOp, html: "Wetsvoorstel ingediend." }];
    // Kamerstukken (data/tk/wetstukken.json): titel opent de documentweergave, met nummer en Download
    for (const d of stukken) {
      if (d.kamer === "Staatsblad") { s.push({ datum: d.datum, html: `Gepubliceerd in het Staatsblad: ${extLink(d.link, d.titel)}` }); continue; }
      if (d.kamer === "Eerste Kamer") { s.push({ datum: d.datum, html: `Eerste Kamer: ${extLink(d.link, d.titel)} <span class="muted mono">${esc(`${z.dossiers[0].nummer}-${d.volgnummer}`)}</span>` }); continue; }
      s.push({ datum: d.datum, html: docRegel({ ...d, id: d.document }, d.titel, ` <span class="muted mono">${esc(`${z.dossiers[0].nummer}-${d.volgnummer}`)}</span>`) });
    }
    for (const b of z.besluiten) {
      const t = STAP_TEKST[b.soort] || (b.tekst || "").trim();
      if (b.datum && t && !STAP_WEG.test(b.soort || "") && !/^Behandeld\.?$/.test(t)) s.push({ datum: b.datum, html: esc(t) });
    }
    for (const a of wetActiviteiten(z)) {
      const dag = dagNL(new Date(a.Datum));
      if (/^Inbreng/.test(a.Soort) && dag < VANDAAG) continue; // een verstreken inbrengtermijn staat al als besluit ("Inbreng geleverd")
      const opAgenda = S.data.activiteiten.some((x) => x.Nummer === a.Nummer);
      s.push({ datum: dag, html: opAgenda ? `<a href="#agenda/a-${esc(a.Nummer)}">${esc(typeNaam(a.Soort))}</a>` : extLink(a.tkLink, typeNaam(a.Soort)), gepland: a.Status !== "Uitgevoerd" && dag >= VANDAAG,
        tijd: ((x) => (x && x !== "00:00" ? `${/^Inbreng/.test(a.Soort) ? "tot " : ""}${x}` : ""))(tijdNL(a.Aanvangstijd || a.Datum)), wie: a.Voortouwnaam || a.Voortouwafkorting ? commissieNaam(a) : "",
        label: /^Inbreng/.test(a.Soort) ? termijn("Sluit", dag) : "" });
    }
    const stem = S.data.stemmingen[z.nummer], sa = S.data.stemActiviteit[z.nummer];
    if (stem >= VANDAAG && !AFGEDAAN.includes(z.uitslag) && !s.some((x) => x.datum === stem && /Stemming/.test(x.html)))
      s.push({ datum: stem, html: sa ? extLink(`https://www.tweedekamer.nl/debat_en_vergadering/plenaire_vergaderingen/details/activiteit?id=${encodeURIComponent(sa)}`, "Stemmingen") : "Stemmingen", gepland: true });
    const gezien = new Set();
    return s.filter((x) => x.datum && !gezien.has(x.datum + x.html) && gezien.add(x.datum + x.html)).sort((a, b) => a.datum.localeCompare(b.datum));
  }
  // de wet waar het voorstel over gaat vet (Tobias, 23 nov 2026): elke wet na "wijziging van (de)", anders de citeertitel tussen haakjes aan het eind
  // shortcut: titels als "Goedkeuring van het Verdrag ..." blijven zonder vet
  const WET_RE = /([A-Z][^,()]*?)(?=,|(?<!-) en | in verband| ter | tot | ten | voor | om | met | teneinde | betreffende | houdende | inzake | vanwege |\s*\(|\s*$)/y, CITEER_RE = /\(([^()]*wet[^()]*)\)\s*$/i;
  // Nederlandse wetten linken naar Geldende wetten, EU-recht naar EUR-Lex; de rest van de titel linkt naar het wetsvoorstel (Tobias, 24 nov 2026)
  const geldendeWet = onthoud((naam) => kdData().reeksen.find((d) => d.groep === "wet" && [d.titel, ...(d.alias || [])].some((x) => x.toLowerCase() === naam.toLowerCase())), (naam) => naam);
  const eurLex = (celex) => `https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=CELEX:${celex}`;
  // EU-recht dat titels zonder nummer noemen
  const EU_NAMEN = [[/Nitraatrichtlijn/, "31991L0676"], [/Gasrichtlijn/, "32009L0073"], [/richtlijn milieuaansprakelijkheid/, "32004L0035"], [/Europese klimaatwet/, "32021R1119"],
    [/verordening ontbossingsvrije grondstoffen en producten/, "32023R1115"], [/herziening van de richtlijn luchtkwaliteit/, "32024L2881"], [/herziening van de Richtlijn industriële emissies/, "32024L1785"],
    [/PIE-verordening/, "32024R1244"], [/richtlijn hernieuwbare energie/, "32018L2001"]];
  const EU_NR = String.raw`(?:nr\. )?(?:\((?:EU|EG)\) )?(?:nr\. )?(\d+)\/(\d+)(?:\/(?:EU|EG|EEG))?`;
  const EU_RE = new RegExp(String.raw`(?:uitvoerings|gedelegeerde )?(richtlijn|verordening|besluit)(?:en)? ${EU_NR}`, "gi"), EU_VOLGENDE = new RegExp(`(?:, | en )(${EU_NR})`, "y");
  // de rest van de officiële naam ("van het Europees Parlement ... betreffende ..."), tot wat er niet meer bij hoort
  const EU_NAAM = / (?:van het Europees|van de Raad|betreffende|inzake|over) .*?(?=\s*[()]|,? en tot |,?\s*tot (?:wijziging|intrekking|vervanging)|,? (?:en )?ter (?:uitvoering|ondersteuning|gedeeltelijke|aanvullende)| (?:en )?ten behoeve| en in verband| wat betreft|\s*$)/y;
  const celex = (soort, a, b) => {
    const jaarAchter = b.length === 4 && !/^(19|20)\d\d$/.test(a), [j, n] = jaarAchter && a.length !== 2 ? [b, a] : [a, b]; // "nr. 168/2013" tegenover "2008/98" en "98/70"
    return `3${j.length === 2 ? "19" + j : j}${{ r: "L", v: "R", b: "D" }[soort[0].toLowerCase()]}${n.padStart(4, "0")}`;
  };
  // de wetten in een titel: [begin, eind, adres, "EUR-Lex" | "Geldende wetten"]; zonder adres alleen vet
  function wetDelen(t) {
    const uit = [], gehad = new Set(), // elke wet één keer
       voeg = (i, n, href, waar) => { if (n > i && !uit.some((x) => i < x[1] && n > x[0])) uit.push([i, n, href, waar]); };
    const wet = (i, naam) => { const g = geldendeWet(naam); if (g && gehad.has(g.id)) return; if (g) gehad.add(g.id); voeg(i, i + naam.length, g && `#wetgeving/wetten?open=${encodeURIComponent(g.id)}`, "Geldende wetten"); };
    // na "wijziging van (de)" en "en van de": het rijtje wetten; een bekende naam mag een komma of "en" bevatten
    const bekend = kdData().reeksen.filter((d) => d.groep === "wet").flatMap((d) => [d.titel, ...(d.alias || [])]).sort((a, b) => b.length - a.length);
    for (const s of t.matchAll(/(?:wijziging (?:van )?|en van |\) en )(?:de |het )?/gi)) {
      for (let i = s.index + s[0].length; ;) {
        WET_RE.lastIndex = i;
        const naam = bekend.find((n) => t.slice(i, i + n.length).toLowerCase() === n.toLowerCase() && !/[\wë]/.test(t[i + n.length] || "")) || (WET_RE.exec(t) || [])[1];
        if (!naam || !/wet/i.test(naam)) break;
        wet(i, t.slice(i, i + naam.length));
        const v = /^(?:, en |, | en )(?:van )?(?:de |het )?/.exec(t.slice(i + naam.length));
        if (!v) break;
        i += naam.length + v[0].length;
      }
    }
    const c = !uit.length && CITEER_RE.exec(t);
    if (c) wet(c.index + 1, c[1]);
    for (const m of t.matchAll(EU_RE)) {
      let i = m.index, n = i + m[0].length, href = eurLex(celex(m[1], m[2], m[3]));
      for (let v; ;) {
        EU_VOLGENDE.lastIndex = n;
        if (!(v = EU_VOLGENDE.exec(t))) break;
        voeg(i, n, href, "EUR-Lex");
        n += v[0].length; i = n - v[1].length; href = eurLex(celex(m[1], v[2], v[3]));
      }
      EU_NAAM.lastIndex = n;
      const rest = EU_NAAM.exec(t);
      voeg(i, n + (rest ? rest[0].length : 0), href, "EUR-Lex");
    }
    for (const [re, nr] of EU_NAMEN) { const m = re.exec(t); if (m) voeg(m.index, m.index + m[0].length, eurLex(nr), "EUR-Lex"); }
    return uit.sort((a, b) => a[0] - b[0]);
  }
  // zonder href (de pagina van het wetsvoorstel zelf) is de rest platte tekst
  const wetTitel = (z, href = wetHref(z)) => {
    const t = (z.titel || z.onderwerp || "").replace(/\s+/g, " ").trim();
    let pos = 0, eerste = true, los = "", html = "";
    // aaneengesloten tekst en vet zonder adres is één link; alleen de eerste zit in de tabvolgorde
    const sluit = () => { if (los) { html += href ? `<a class="ltitel wet" href="${href}"${eerste ? "" : ` tabindex="-1"`}>${los}</a>` : los; eerste = false; los = ""; } };
    for (const [i, n, adres, waar] of wetDelen(t)) {
      const vet = `<strong>${esc(t.slice(i, n))}</strong>`;
      los += esc(t.slice(pos, i));
      pos = n;
      if (!adres) { los += vet; continue; }
      sluit();
      html += `<a class="ltitel wet geldend" href="${esc(adres)}" title="Bekijk ${waar === "EUR-Lex" ? "op" : "bij"} ${waar}"${waar === "EUR-Lex" ? ` target="_blank" rel="noopener"` : ""}>${vet}</a>`;
    }
    los += esc(t.slice(pos));
    sluit();
    return html;
  };
  const WET_DEF = {
    tab: "wetgeving", eenheid: "wetsvoorstellen", knopLabel: "Details",
    rijen: () => wetsvoorstellenTK(),
    datum: (z) => z.gestartOp, sleutel: (z) => z.nummer,
    zoektekst: (z) => `${z.titel} ${z.onderwerp} ${z.citeertitel || ""} ${z.nummer} ${dossierLabel(z)} ${z.indieners.map((i) => i.naam).join(" ")}`,
    filters: {
      thema: themaFilter(themasWet),
      status: { label: "Status", waarden: (z) => [wetStatus(z)], orde: opVolgorde(["voorbereiding", "debat", "stemming", "Eerste Kamer", ...AFGEDAAN]), tekst: (v) => uitslagPill(v) },
      soort: { label: "Ingediend door", waarden: (z) => [wetSoort(z)], orde: opVolgorde(["Regering", "Initiatiefwetsvoorstel"]), tekst: (v) => esc(v === "Regering" ? "Regering" : "Kamerleden (initiatief)") },
    },
    kolommen: [
      { titel: true, kop: "Wetsvoorstel", thCls: "ond", tdCls: "ond", cel: (z) => wetTitel(z) },
      { filter: "status", tdCls: "uitslag", cel: (z) => uitslagPill(wetStatus(z)) },
      { filter: "soort", tdCls: "indiener hide-sm", cel: (z) => (z.soort === "Initiatiefwetgeving" ? indienerKort(z) : "Regering") },
      themaKolom(themasWet),
      { kop: "Kamerstuk", thCls: "rechts hide-sm", tdCls: "kamerstuk rechts mono hide-sm", cel: (z) => esc(dossierLabel(z)) },
      { datum: true, kop: "Ingediend" },
    ],
    // uitgeklapte rij: kenmerken, fase en volgende stap; het hele verloop staat op de eigen pagina
    detail: (z) => {
      const door = z.indieners.map(naamFractie);
      const ks = z.dossiers[0];
      return `<div class="mdetail">
        <p>Zaak <span class="mono">${esc(z.nummer)}</span>${ks ? ` · Kamerstuk <span class="mono">${esc(dossierLabel(z))}</span>` : ""} · ingediend ${fmtKort(z.gestartOp)}${door.length ? `, door ${opsomming(door)}` : ""}</p>
        ${faseBlok(z)}
        ${mlinks("", `<a href="${wetHref(z)}">Alles over dit wetsvoorstel</a>${extLink(tkUrl(z), "Bekijk op tweedekamer.nl")}${extLink(z.link, "Bekijk op OpenTK")}`)}
      </div>`;
    },
  };
  function faseBlok(z) {
    const fase = wetFase(z), volgende = wetStappen(z).find((x) => x.gepland);
    return `<div class="mstemming">
      <ol class="wfasen" aria-label="Fase">${WET_FASEN.map((f, i) => `<li class="${i < fase || fase === 4 ? "klaar" : i === fase ? "nu" : ""}"${i === fase ? ` aria-current="step"` : ""}>${f}</li>`).join("")}</ol>
      ${volgende ? `<div class="wp-stap"><p class="k">Volgende stap</p><p class="wp-stapnaam">${volgende.html}</p>
        <p class="wp-stapmeta"><span class="datum">${hoofd(dagKort(volgende.datum))}${volgende.tijd ? ` ${volgende.tijd}` : ""}</span>${volgende.wie ? `<span>${esc(volgende.wie)}</span>` : ""}${volgende.label || termijn("", volgende.datum)}</p></div>`
        : fase === 3 ? `<p>Aangenomen door de Tweede Kamer; nu bij de Eerste Kamer.</p>`
        : wetStb(z) ? `<p>Aangenomen door de Eerste Kamer en gepubliceerd in het Staatsblad (${fmtKort(wetStb(z).datum)}).</p>` : ""}
    </div>`;
  }

  /* Pagina per wetsvoorstel (#wetgeving/<Kamerstuknummer>): fase, dan één tijdlijn per dag (oudste boven) met de stappen,
     Kamerstukken, vergaderingen, eigen mijlpalen (agenda.json met "kamerstuk") en moties en amendementen per stemdag;
     onderaan Kamervragen die het Kamerstuknummer of de titel noemen ("Mogelijk gerelateerd"). */
  const telwoord = (n, een, meer) => `${nl(n)} ${n === 1 ? een : meer}`;
  function stemBlokken(z) {
    const nr = wetNr(z), perDag = new Map();
    for (const x of motiesEnAmendementen().filter((x) => x.dossiers.some((d) => String(d.nummer) === nr))) {
      const dag = x.stemtelling?.datum || S.data.stemmingen[x.nummer] || x.gestartOp;
      if (!perDag.has(dag)) perDag.set(dag, []);
      perDag.get(dag).push(x);
    }
    return [...perDag].map(([dag, xs]) => {
      xs.sort((a, b) => (a.soort === b.soort ? (a.volgnummer || 0) - (b.volgnummer || 0) : a.soort === "Amendement" ? -1 : 1));
      const gestemd = xs.some((x) => x.stemtelling), gepland = !gestemd && xs.some((x) => S.data.stemmingen[x.nummer] === dag);
      const am = xs.filter((x) => x.soort === "Amendement").length, mo = xs.length - am;
      const wat = [am && telwoord(am, "amendement", "amendementen"), mo && telwoord(mo, "motie", "moties")].filter(Boolean).join(" en ");
      return { datum: dag, gepland, html: `${gestemd ? "Gestemd over" : gepland ? "Stemming over" : "Ingediend:"} ${wat}
        <ul class="wtl-zaken">${xs.map((x) => `<li><details class="wtl-zaak" data-zaak="${esc(x.nummer)}"><summary>${stemStatus(x.nummer, x.uitslag) || uitslagPill(x.uitslag)}<span>${esc(x.soort)} over ${esc(onderwerpKlein(x))} <span class="muted">${indienerKort(x)}</span></span></summary><div class="wtl-detail"></div></details></li>`).join("")}</ul>` };
    });
  }
  // een motie of amendement in de tijdlijn klapt open met dezelfde inhoud als de rij op Moties
  document.addEventListener("toggle", (e) => {
    const d = e.target;
    if (!d.matches?.("details.wtl-zaak") || !d.open || d.dataset.klaar) return;
    const z = S.data.zaken.find((x) => x.nummer === d.dataset.zaak);
    if (!z) return;
    d.dataset.klaar = "1";
    const plek = d.querySelector(".wtl-detail");
    plek.innerHTML = motieDetail(z);
    vulTeksten(plek);
  }, true);
  function wetPagina(nr) {
    const terug = `<p class="small terug"><a href="#wetgeving">Alle wetsvoorstellen</a></p>`;
    const z = wetsvoorstellenTK().find((x) => wetNr(x) === nr);
    if (!z) return `${terug}<h1>Wetsvoorstel niet gevonden</h1><p>Kamerstuk ${esc(nr)} staat niet tussen de wetsvoorstellen op deze site. ${extLink(tkUrl({ soort: "Wetgeving", dossiers: [{ nummer: nr }] }), "Zoek het op tweedekamer.nl")}</p>`;
    const mijlpalen = (S.data.agenda || []).filter((m) => String(m.kamerstuk || "") === nr && /^\d{4}-\d{2}-\d{2}/.test(m.datum || ""))
      .map((m) => ({ datum: m.datum.slice(0, 10), gepland: m.datum.slice(0, 10) >= VANDAAG, html: `${esc(m.type || "Mijlpaal")}: ${m.url ? extLink(m.url, m.titel) : esc(m.titel)}` }));
    const items = [...wetStappen(z), ...stemBlokken(z), ...mijlpalen].filter((x) => x.datum).sort((a, b) => a.datum.localeCompare(b.datum));
    const dagen = new Map();
    for (const x of items) { if (!dagen.has(x.datum)) dagen.set(x.datum, []); dagen.get(x.datum).push(x); }
    // per jaar een kop die blijft staan bij scrollen, met Kamerstuk en fase: zo weet je waar je bent in een lange tijdlijn
    const jaren = new Map();
    for (const dag of dagen) { const j = dag[0].slice(0, 4); if (!jaren.has(j)) jaren.set(j, []); jaren.get(j).push(dag); }
    // Kamervragen die het Kamerstuknummer ("37052" of "37 052") of de (citeer)titel noemen; een vraag en haar antwoord samen
    const rx = new RegExp(`\\b${nr.slice(0, 2)} ?${nr.slice(2)}\\b`), titels = [z.citeertitel, z.titel].filter(Boolean).map((t) => t.toLowerCase());
    const vragen = (S.data.stukken || []).filter((q) => q.soort === "Schriftelijke vragen").filter((q) => {
      const t = `${q.onderwerp || ""} ${q.titel || ""}`;
      return rx.test(t) || titels.some((x) => t.toLowerCase().includes(x));
    });
    // de nieuwste leesbare tekst van het voorstel (ook "Gewijzigd voorstel van wet")
    const voorstel = [...(S.data.wetstukken[nr] || [])].filter((d) => /voorstel van wet/i.test(d.titel) && docKnop(d, "x")).sort((a, b) => b.datum.localeCompare(a.datum))[0];
    const door = z.soort === "Initiatiefwetgeving" ? opsomming(z.indieners.map(naamFractie)) : "Regering";
    return `${terug}
      <h1 class="wp-titel">${wetTitel(z, "")}</h1>
      <p class="wp-meta"><span>Kamerstuk <span class="mono">${esc(dossierLabel(z))}</span></span><span>ingediend ${fmtKort(z.gestartOp)}</span><span>${esc(door)}</span>${themaChips(themasWet(z))}</p>
      <div class="wp-fase">${faseBlok(z)}</div>
      ${mlinks(voorstel ? docKnop({ ...voorstel, id: voorstel.document }, "Lees het wetsvoorstel", "") : "", `${extLink(tkUrl(z), "Bekijk op tweedekamer.nl")}${extLink(z.link, "Bekijk op OpenTK")}`, " wp-links")}
      <h2>Wetgevingsproces</h2>
      ${[...jaren].map(([j, ds]) => `<section class="wtl-jaar"><h3 class="tl-weekkop">${j}<span class="muted">Kamerstuk ${esc(nr)} · ${WET_FASEN[wetFase(z)]}</span></h3>
        <ol class="wtl">${ds.map(([d, xs]) => `<li><span class="datum">${fmtKort(d)}</span><ul>${xs.map((x) => `<li>${x.html}${x.gepland ? ` <span class="muted">(gepland)</span>` : ""}</li>`).join("")}</ul></li>`).join("")}</ol></section>`).join("")}
      ${vragen.length ? `<h2>Mogelijk gerelateerd</h2><p class="wp-uitleg">Kamervragen die het Kamerstuknummer of de titel van dit wetsvoorstel noemen.</p>
        <ul class="mstappen">${vragen.map((q) => `<li><span class="datum">${fmtKort(q.datum)}</span> <a href="#vragen?open=${encodeURIComponent(q.id)}">${esc(q.onderwerp || q.titel)}</a></li>`).join("")}</ul>` : ""}`;
  }
  // Geldende wetten: de kerndocumenten uit groepen met pagina "wetgeving" (Wettelijk kader in data/kerndocumenten.json)
  function wettenDef() {
    const K = kdData(), groepen = new Set(K.groepen.filter((g) => g.pagina === "wetgeving").map((g) => g.id));
    return {
      tab: "wetgeving/wetten", eenheid: "wetten", knopLabel: "Details", gedeeld: ["thema"],
      rijen: () => K.reeksen.filter((d) => groepen.has(d.groep)),
      datum: (d) => d.datum, sleutel: (d) => d.id,
      zoektekst: (d) => [d.titel, d.afkorting, d.kenmerk, d.uitgever].filter(Boolean).join(" "),
      filters: { thema: themaFilter(K.themasVan) },
      kolommen: [
        { titel: true, kop: "Wet", thCls: "ond", tdCls: "ond", cel: (d) => rijTitel(d.titel) },
        themaKolom(K.themasVan),
        { kop: "Kenmerk", thCls: "rechts", tdCls: "kamerstuk rechts mono", cel: (d) => (d.kenmerk ? esc(d.kenmerk) : leegCel("Geen kenmerk")) },
      ],
      detail: kdDetail,
    };
  }
  function wetgeving() {
    const los = /^wetgeving\/(\d+)$/.exec(location.hash.slice(1).split("?")[0]);
    if (los) return wetPagina(los[1]);
    const wetten = location.hash.slice(1).split("?")[0] === "wetgeving/wetten";
    const schak = schakelaar("Wetsvoorstellen of geldende wetten", [["wetgeving", "Wetsvoorstellen"], ["wetgeving/wetten", "Geldende wetten"]], wetten ? "wetgeving/wetten" : "wetgeving");
    const kop = paginaKop("Wetgeving");
    // de schakelaar staat in de kop van de titelkolom (Tobias, 23 nov 2026)
    const metSchak = (def) => ({ ...def, kolommen: def.kolommen.map((c) => (c.titel ? { ...c, kop: schak } : c)) });
    if (wetten) return tabelPagina(metSchak(wettenDef()), kop,
      "Geldende wetten die het kader vormen voor het milieubeleid; de knop in een uitgeklapte wet opent de geldende tekst op wetten.overheid.nl.",
      "Zoek op naam of BWBR-nummer");
    return tabelPagina(metSchak(WET_DEF), kop,
      "Wetsvoorstellen sinds 2019 over milieu, klimaat, energie, water, natuur en leefomgeving, rechtstreeks uit de open data van de Tweede Kamer.",
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
  const UITSLAG_ORDE = ["aangenomen", "in behandeling", "aangehouden", "verworpen", "ingetrokken", "vervallen", "vervangen"];
  const fractieFilter = (label, indieners) => ({ label, waarden: (z) => uniek(indieners(z).map((i) => fractieNaam(i.fractie)).filter(Boolean)), orde: opVolgorde([]), tekst: (v) => esc(v) });
  function motieDef(tab) {
    const soort = SOORT_VAN_TAB[tab];
    return {
      tab, eenheid: tab, knopLabel: "Stemming per fractie",
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
        { titel: true, kop: `${soort} over...`, thCls: "ond", tdCls: "ond", cel: (z) => rijTitel(onderwerpKlein(z)) },
          { filter: "uitslag", tdCls: "uitslag", cel: (z) => uitslagPill(z.uitslag) },
        { filter: "appreciatie", tdCls: "appr hide-sm", cel: (z) => { const a = appreciatie(z), ruw = (z.kabinetsappreciatie || "").trim(); return a ? esc(a) : leegCel(ruw || "Geen appreciatie"); } },
        { filter: "fractie", tdCls: "indiener hide-sm", cel: indienerKort },
        themaKolom(themasMotie),
        { kop: "Kamerstuk", thCls: "rechts hide-sm", tdCls: "kamerstuk rechts mono hide-sm", cel: (z) => esc(dossierLabel(z)) },
        { datum: true, kop: "Datum" },
      ],
      detail: motieDetail,
    };
  }
  function moties() {
    const tab = location.hash.slice(1).split(/[/?]/)[0] === "amendementen" ? "amendementen" : "moties";
    return tabelPagina(motieDef(tab), tab === "moties" ? paginaKop("Moties") : paginaKop("Amendementen"),
      "Alle gegevens komen rechtstreeks uit de open data van de Tweede Kamer.",
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
      ${tekstBlok(z)}
      ${b && t ? `<div class="mstemming"><p class="mtelling">Voor ${nl(t.voor)} / Tegen ${nl(t.tegen)}</p>
        <div class="mstemmen">${blok("Voor", fracties("Voor"))}${blok("Tegen", fracties("Tegen"))}</div></div>` : S.data.stemmingen[z.nummer] ? "" : `<p class="muted">Nog geen stemming</p>`}
      ${vergaderRegels(z)}
      ${mlinks(docKnop({ ...z, id: z.document, titel: z.onderwerp, link: tkUrl(z) }, "Bekijk het origineel", ""), `${extLink(tkUrl(z), "Bekijk op tweedekamer.nl")}${extLink(z.link, "Bekijk op OpenTK")}`)}
    </div>`;
  }
  // "Ingediend bij" (vergadering op de Agenda) en "Stemming" (plenaire Stemmingen op tweedekamer.nl)
  // "Commissiedebat: Klimaat", maar "Tweeminutendebat Kernenergie" niet dubbel
  const vergaderNaam = (a) => { const t = typeNaam(a.Soort), o = String(a.Onderwerp || "").trim(); return o && !o.toLowerCase().startsWith(t.toLowerCase()) ? `${t}: ${o}` : o || t; };
  function vergaderRegels(z) {
    const { actVanZaak, tmdNaarCd } = motieKoppeling();
    const actById = (nr) => S.data.activiteiten.find((a) => a.Nummer === nr);
    const vlink = (a) => `<a href="#agenda/a-${esc(a.Nummer)}">${esc(vergaderNaam(a))}</a>, ${esc(dagKort(dagNL(new Date(a.Datum))))}`;
    const uit = [];
    const a = actVanZaak.get(z.nummer);
    if (a) {
      const cd = tmdNaarCd.has(a.Nummer) && actById(tmdNaarCd.get(a.Nummer));
      uit.push(`<p>Ingediend bij ${vlink(a)}${cd ? ` (bij ${vlink(cd)})` : ""}</p>`);
    }
    const dag = S.data.stemmingen[z.nummer], sa = S.data.stemActiviteit[z.nummer];
    if (dag) {
      const tekst = `${dag >= VANDAAG ? "Stemming gepland" : "Gestemd"} ${dagKort(dag)}`;
      uit.push(`<p>${sa ? extLink(`https://www.tweedekamer.nl/debat_en_vergadering/plenaire_vergaderingen/details/activiteit?id=${encodeURIComponent(sa)}`, `${tekst} (plenaire stemmingen)`) : esc(tekst)}</p>`);
    }
    return uit.join("");
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
  // een verzoek heeft geen termijn, en de koppeling met een antwoord is niet volledig: dus nooit "open" of "verstreken"
  const GEEN_ANTWOORD = "Geen antwoord bekend";
  const commissieKort = (v) => String(v.commissie || "").replace(/^(vaste |algemene )?commissie voor (de )?/i, "") || "onbekend";
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
      r.uitstel = (v && v.uitstel) || [];
      r.status = a ? "Beantwoord" : r.uitstel.length ? "Uitstel gemeld" : r.dagen > ANTWOORD_TERMIJN ? "Termijn verstreken" : "Open";
      r.dossiers = [...(v ? v.dossiers || [] : []), ...r.antwoorden.flatMap((x) => x.dossiers || [])];
      r.kamerstuk = r.antwoorden.map((x) => x.kamerstuk).find(Boolean) || (v && v.kamerstuk) || null;
      return r;
    });
    for (const x of (S.data.verzoeken || []).filter(inSector)) rijen.push({
      id: x.id, zaak: x.zaak, verzoek: x, vraag: null, antwoorden: [], uitstel: [], datum: x.datum, titel: window.MRThemas.verzoekTitel(x),
      indieners: [], ministeries: x.ministeries, link: x.link, dagen: null, dossiers: [], kamerstuk: null,
      status: x.antwoorden.length ? "Beantwoord" : GEEN_ANTWOORD });
    rijen.sort((a, b) => (b.datum || "").localeCompare(a.datum || ""));
    _vragen = { bron: S.data.stukken, rijen };
    return rijen;
  }
  const themasVanVerzoek = (x) => S.T.item(TS.verzoek(x), window.MRThemas.verzoekTitel(x), []);
  const themasVraag = onthoud((r) => r.verzoek ? themasVanVerzoek(r.verzoek) : uniek([r.vraag, ...r.antwoorden].filter(Boolean).flatMap(themasVanStuk)), (r) => r.id);
  const themasBrief = onthoud((x) => themasVanStuk(x), (x) => x.id);
  const VRAAG_STATUS = { Beantwoord: "afgedaan", Open: "openstaand", "Uitstel gemeld": "openstaand", "Termijn verstreken": "openstaand", [GEEN_ANTWOORD]: "ingetrokken" };
  const vraagSoort = (r) => (r.verzoek ? "Commissieverzoek" : "Kamervraag");
  const vraagStatus = (r) => statusPunt(r.status, VRAAG_STATUS[r.status]);
  const commissieAfk = (v) => { const a = (S.data.activiteiten || []).find((x) => x.Voortouwnaam === v.commissie && x.Voortouwafkorting); return `Commissie ${a ? a.Voortouwafkorting : commissieKort(v)}`; };
  function vragenstellerKort(r) {
    if (r.verzoek) return `<span title="${esc(hoofd(r.verzoek.commissie || ""))}">${esc(commissieAfk(r.verzoek))}</span>`;
    const i = r.indieners[0];
    if (!i) return leegCel("Vragensteller onbekend");
    const naam = achternaam(i.naam), fr = i.fractie && i.fractie !== naam ? ` (${esc(i.fractie)})` : "";
    return `<span title="${esc(r.indieners.map((x) => `${x.naam}${x.fractie ? ` (${x.fractie})` : ""}`).join(", "))}">${esc(naam)}${fr}${r.indieners.length > 1 ? ` <span class="muted">c.s.</span>` : ""}</span>`;
  }
  const ministerieKort = (ms) => (ms.length ? `<span title="${esc(ms.join("; "))}">${esc(ms[0])}${ms.length > 1 ? ` <span class="muted">+${ms.length - 1}</span>` : ""}</span>` : leegCel("Onbekend"));
  // titels lezen door op de kolomkop ("Vragen over...", "Kamerbrief over...")
  const overKlein = (t) => klein(String(t || "").trim().replace(/\s+/g, " ").replace(/^(over|inzake) /i, ""));
  // bijlagen bij een Kamerbrief of antwoord (beslisnota, rapporten, analyses), uit de Kamerdata
  const metRapport = (b) => window.MRThemas.metRapport(b, S.data.rapporten);
  // beslisnota's staan altijd bovenaan (Tobias, 24 nov 2026); in het venster gaat "Op tweedekamer.nl" naar de brief of het antwoord (link)
  const isBeslisnota = (b) => /beslisnota/i.test(b.titel);
  const bijlagenBlok = (stukken) => {
    const lijst = stukken.flatMap((x) => (x.bijlagen || []).map((b) => ({ ...b, link: x.link || b.link }))).sort((a, b) => isBeslisnota(b) - isBeslisnota(a));
    return lijst.length ? `<div class="mstemming"><p class="mtelling">${lijst.length === 1 ? "Bijlage" : `Bijlagen (${lijst.length})`}</p><ul class="mstappen">${lijst.map((b) => `<li>${metRapport(b) ? `<span class="badge rapport">Rapport:</span> ` : ""}${docRegel(b, b.titel, b.bestand ? ` <span class="muted mono">${esc(b.bestand)}</span>` : "")}</li>`).join("")}</ul></div>` : "";
  };
  function verzoekDetail(v) {
    // een gekoppelde brief: de rij op Kamerbrieven als die er is, anders tweedekamer.nl
    const antw = v.antwoorden.map((a) => {
      const b = (S.data.stukken || []).find((x) => x.zaak === a.zaak && x.soort === "Brief regering");
      return `<li><span class="datum">${fmtKort(a.datum)}</span> ${b ? `<a href="#brieven?open=${encodeURIComponent(b.id)}">${esc(a.onderwerp)}</a>` : extLink(a.link, a.onderwerp)}</li>`;
    });
    return `<div class="mdetail">
      <p>Zaak <span class="mono">${esc(v.zaak)}</span> · document <span class="mono">${esc(v.id)}</span> · ${fmtKort(v.datum)}, van de ${esc(v.commissie || "commissie (onbekend)")}${v.gerichtAan.length ? `; gericht aan ${opsomming(v.gerichtAan.map(esc))}` : ""}</p>
      <div class="mstemming"><p class="mtelling">${antw.length ? "Kamerbrief met antwoord" : GEEN_ANTWOORD}</p>
        ${antw.length ? `<ul class="mstappen">${antw.join("")}</ul>` : ""}
        <p class="muted">De koppeling tussen verzoek en Kamerbrief komt van de Tweede Kamer en is niet volledig. Voor een verzoek geldt geen vaste antwoordtermijn.</p></div>
      ${mlinks(docKnop({ ...v, titel: v.onderwerp }, "Lees het verzoek", ""), extLink(v.link, "Bekijk op tweedekamer.nl"))}
    </div>`;
  }
  const VRAAG_DEF = {
    tab: "vragen", eenheid: "Kamervragen", knopLabel: "Vraag en antwoord",
    rijen: vraagRijen, datum: (r) => r.datum, sleutel: (r) => r.id,
    zoektekst: (r) => `${r.titel} ${r.zaak || ""} ${r.kamerstuk || ""} ${r.indieners.map((i) => `${i.naam} ${i.fractie || ""}`).join(" ")} ${r.verzoek ? `${r.id} ${r.verzoek.commissie} ${r.verzoek.gerichtAan.join(" ")} ` : ""}${r.ministeries.join(" ")} ${[r.vraag, ...r.antwoorden].filter(Boolean).map((x) => `${x.id} ${x.ondertekenaar || ""} ${x.onderwerp || ""}`).join(" ")} ${r.dossiers.map((d) => `${d.nummer} ${d.titel || ""}`).join(" ")}`,
    filters: {
      thema: themaFilter(themasVraag),
      soort: { label: "Soort", waarden: (r) => [vraagSoort(r)], orde: opVolgorde(["Kamervraag", "Commissieverzoek"]), tekst: (v) => esc(v) },
      status: { label: "Status", waarden: (r) => [r.status], orde: opVolgorde(["Beantwoord", "Open", "Uitstel gemeld", "Termijn verstreken", GEEN_ANTWOORD]), tekst: (v) => statusPunt(v, VRAAG_STATUS[v]) },
      fractie: { label: "Gesteld door", waarden: (r) => (r.verzoek ? [`Commissie ${commissieKort(r.verzoek)}`] : uniek(r.indieners.map((i) => fractieNaam(i.fractie)).filter(Boolean))),
        orde: (vs) => [...vs].sort((a, b) => a.startsWith("Commissie ") - b.startsWith("Commissie ") || nlSort.compare(a, b)), tekst: (v) => esc(v) },
      ministerie: { label: "Gericht aan", waarden: (r) => (r.ministeries.length ? r.ministeries : [""]), orde: opVolgorde([]), tekst: (v) => esc(v || "Onbekend") },
    },
    kolommen: [
      { titel: true, kop: "Vragen over...", thCls: "ond", tdCls: "ond", cel: (r) => rijTitel(overKlein(r.titel)) },
      { filter: "soort", tdCls: "uitslag", cel: vraagSoort },
      { filter: "status", tdCls: "uitslag", cel: vraagStatus },
      { filter: "fractie", tdCls: "indiener hide-sm", cel: vragenstellerKort },
      { filter: "ministerie", tdCls: "ministerie hide-sm", cel: (r) => ministerieKort(r.ministeries) },
      themaKolom(themasVraag),
      { datum: true, kop: "Gesteld" },
    ],
    detail: (r) => {
      if (r.verzoek) return verzoekDetail(r.verzoek);
      const v = r.vraag;
      const door = r.indieners.map(naamFractie);
      const aan = v ? (v.ministeries || []).length ? v.ministeries : [v.ministerie].filter(Boolean) : [];
      // het antwoord is de hoofdknop; zonder antwoord zijn dat de vragen
      const antwKnop = r.antwoorden.map((a, i) => docKnop({ ...a, titel: a.onderwerp || r.titel }, r.antwoorden.length > 1 ? `Lees antwoord ${i + 1}` : "Lees het antwoord", i ? "licht" : "")).join("");
      const antw = r.antwoorden.map((a) => `<li><span class="datum">${fmtKort(a.datum)}</span> ${a.soort.includes("nader") ? "Nader antwoord" : "Beantwoord"}${a.ondertekenaar ? ` door ${esc(a.ondertekenaar)}${a.functie ? ` (${esc(a.functie)})` : ""}` : ""}${v && a.datum && v.datum ? `, na ${nl(dagenTot(v.datum, a.datum))} dagen` : ""} · ${docRegel({ ...a, titel: a.onderwerp || r.titel }, "antwoord")}${a.kamerstuk ? ` · <span class="mono">${esc(a.kamerstuk)}</span>` : ""}</li>`);
      // uitgestelde beantwoording staat vóór het antwoord, ook als dat er al is
      const uitstel = r.uitstel.map((u) => `<li><span class="datum">${fmtKort(u.datum)}</span> Uitstel gemeld · ${docRegel({ ...u, titel: `Uitstel: ${r.titel}` }, "mededeling")}</li>`);
      return `<div class="mdetail">
        <p>Zaak <span class="mono">${esc(r.zaak || "onbekend")}</span>${v ? ` · document <span class="mono">${esc(v.id)}</span> · gesteld ${fmtKort(v.datum)}` : ""}${door.length ? `, door ${opsomming(door)}` : ""}${aan.length ? `; gericht aan ${opsomming(aan.map(esc))}` : ""}</p>
        <div class="mstemming"><p class="mtelling">${r.antwoorden.length ? "Antwoord" : r.dagen > ANTWOORD_TERMIJN ? `Nog niet beantwoord, ${nl(r.dagen)} dagen na het stellen (termijn ${ANTWOORD_TERMIJN} dagen)` : `Nog niet beantwoord${r.dagen != null ? `, ${nl(r.dagen)} ${r.dagen === 1 ? "dag" : "dagen"} na het stellen` : ""}`}</p>
          ${uitstel.length + antw.length ? `<ul class="mstappen">${uitstel.join("")}${antw.join("")}</ul>` : ""}</div>
        ${v ? "" : `<p class="muted">De vraag zelf is van voor het begin van deze gegevens.</p>`}
        ${mlinks(`${antwKnop}${v ? docKnop({ ...v, titel: v.onderwerp || r.titel }, "Lees de vragen", antwKnop ? "licht" : "") : ""}`, `${v ? extLink(v.link, "Vragen op tweedekamer.nl") : ""}${r.antwoorden.map((a, i) => extLink(a.link, r.antwoorden.length > 1 ? `Antwoord ${i + 1} op tweedekamer.nl` : "Antwoord op tweedekamer.nl")).join("")}`)}
        ${bijlagenBlok(r.antwoorden)}
      </div>`;
    },
  };
  const BRIEF_DEF = {
    tab: "brieven", eenheid: "Kamerbrieven", knopLabel: "Details",
    rijen: () => stukkenInSector().filter((x) => x.soort === "Brief regering"),
    datum: (x) => x.datum, sleutel: (x) => x.id,
    zoektekst: (x) => `${x.onderwerp} ${x.titel} ${x.ondertekenaar || ""} ${x.ministerie || ""} ${x.kamerstuk || ""} ${x.id} ${(x.dossiers || []).map((d) => `${d.nummer} ${d.titel || ""}`).join(" ")} ${(x.bijlagen || []).map((b) => `${b.id} ${b.titel}`).join(" ")}`,
    filters: {
      thema: themaFilter(themasBrief),
      ministerie: { label: "Ministerie", waarden: (x) => [x.ministerie || ""], orde: opVolgorde([]), tekst: (v) => esc(v || "Onbekend") },
      kamer: { label: "Kamer", waarden: (x) => [x.kamer || "Tweede Kamer"], orde: opVolgorde(["Tweede Kamer", "Eerste Kamer"]), tekst: (v) => esc(v) },
      rapport: { label: "Rapport?", waarden: (x) => [(x.bijlagen || []).some(metRapport) ? "ja" : "nee"], orde: opVolgorde(["ja", "nee"]), tekst: (v) => (v === "ja" ? "Bevat rapport" : "Zonder rapport") },
    },
    kolommen: [
      { titel: true, kop: "Kamerbrief over...", thCls: "ond", tdCls: "ond", cel: (x) => rijTitel(overKlein(x.onderwerp || x.titel)) },
      { filter: "ministerie", tdCls: "uitslag ministerie", cel: (x) => esc(x.ministerie || "Onbekend") },
      { filter: "kamer", tdCls: "uitslag", cel: (x) => esc(x.kamer || "Tweede Kamer") },
      { filter: "rapport", tdCls: "rapport", cel: (x) => ((x.bijlagen || []).some(metRapport) ? `${ico("vink")}<span class="sr-only">Bevat rapport</span>` : leegCel("Zonder rapport")) },
      themaKolom(themasBrief),
      { kop: "Kamerstuk", thCls: "rechts hide-sm", tdCls: "kamerstuk rechts mono hide-sm", cel: (x) => esc(x.kamerstuk || ((x.dossiers || [])[0] || {}).nummer || "") },
      { datum: true, kop: "Datum" },
    ],
    detail: (x) => {
      const ds = x.dossiers || [];
      const verz = x.zaak ? (S.data.verzoeken || []).filter((v) => v.antwoorden.some((a) => a.zaak === x.zaak)) : [];
      return `<div class="mdetail">
        <p>${x.kamer ? `${esc(x.ekSoort || "Kamerstuk")} aan de Eerste Kamer · ` : ""}Document <span class="mono">${esc(x.id)}</span> · ${fmtKort(x.datum)}${x.ondertekenaar ? `, ondertekend door ${esc(x.ondertekenaar)}${x.functie ? ` (${esc(x.functie)})` : ""}` : ""}</p>
        ${ds.length ? `<div class="mstemming"><p class="mtelling">Kamerstuk</p><ul class="mstappen">${ds.map((d) => `<li><span class="mono">${esc(d.nummer)}${d.toevoeging ? "-" + esc(d.toevoeging) : ""}</span> ${esc(d.titel || "")}</li>`).join("")}</ul></div>` : ""}
        ${verz.length ? `<div class="mstemming"><p class="mtelling">Op verzoek van</p><ul class="mstappen">${verz.map((v) => `<li><span class="datum">${fmtKort(v.datum)}</span> Commissie ${esc(commissieKort(v))}: <a href="#vragen?open=${encodeURIComponent(v.id)}">${esc(window.MRThemas.verzoekTitel(v))}</a></li>`).join("")}</ul></div>` : ""}
        ${mlinks(docKnop({ ...x, titel: x.onderwerp || x.titel }, "Lees de brief", ""), extLink(x.link, x.kamer ? "Bekijk op officielebekendmakingen.nl" : "Bekijk op tweedekamer.nl"))}
        ${bijlagenBlok([x])}
      </div>`;
    },
  };
  function vragenBrieven() {
    const tab = location.hash.slice(1).split(/[/?]/)[0] === "brieven" ? "brieven" : "vragen";
    return tabelPagina(tab === "brieven" ? BRIEF_DEF : VRAAG_DEF,
      tab === "brieven" ? paginaKop("Kamerbrieven") : paginaKop("Kamervragen"),
      tab === "brieven"
        ? "Kamerbrieven van ministeries over milieu, klimaat, energie, water, natuur en leefomgeving."
        : `Schriftelijke vragen van Kamerleden met het antwoord van het kabinet in dezelfde rij, en verzoeken van Kamercommissies aan bewindspersonen. Voor Kamervragen heeft het kabinet ${ANTWOORD_TERMIJN} dagen om te antwoorden.`,
      tab === "brieven" ? "Zoek op onderwerp of Kamerstuk" : "Zoek op onderwerp, Kamerlid of ministerie");
  }

  /* ---------- Debatten ---------- */
  const activiteitVan = (d) => S.data.activiteiten.find((a) => a.Nummer === d.activiteit);
  function samengevatVoor(a) {
    return S.data.debatten.find((d) => d.activiteit === a.Nummer || (d.extraActiviteiten || []).includes(a.Nummer)) ||
      S.data.debatten.find((d) => !d.activiteit && d.datum === (a.Datum ? dagNL(new Date(a.Datum)) : "") && d.type === a.Soort);
  }

  // een stuk op de agenda; is het onderwerp gelijk aan het agendapunt, dan niet nog eens; bij moties en amendementen de uitslag of de stemmingsdatum
  // "Alle moties" achter een stuk: alleen als er bij dat Kamerstuk moties zijn
  const heeftMoties = onthoud((ks) => (S.data.zaken || []).some((z) => z.soort === "Motie" && z.dossiers.some((d) => `${d.nummer}${d.toevoeging ? "-" + d.toevoeging : ""}` === ks)), (ks) => ks);
  function stukRegel(st, puntTitel, alleMoties) {
    const wie = st.ondertekenaar ? ` - ${esc(st.ondertekenaar)}${st.functie ? ", " + esc(st.functie) : ""}` : "";
    const onderwerp = (st.onderwerp || "").trim();
    const herhaalt = puntTitel && onderwerp.toLowerCase() === String(puntTitel).trim().toLowerCase();
    const motie = /^(motie|amendement)/i.test(st.soort || "");
    const stem = motie ? stemStatus(zaakUitLink(st.link)) : "";
    return `<li>${stem ? `<div class="stukstem">${stem}</div>` : ""}${motieA(motie && zaakVanNr(zaakUitLink(st.link)), st.link)}${esc(st.soort || "Document")}${st.kamerstuk ? ` (${esc(st.kamerstuk)})` : ""}</a>${st.datum ? ` d.d. ${fmtDatum(st.datum)}` : ""}${wie}${onderwerp && !herhaalt ? `: ${esc(onderwerp)}` : ""}${alleMoties ? ` ·&nbsp;<a href="#moties?q=${encodeURIComponent(alleMoties)}" aria-label="Alle moties bij Kamerstuk ${esc(alleMoties)}">Alle&nbsp;moties</a>` : ""}</li>`;
  }
  // zaaknummer uit een tweedekamer.nl-link (…?id=2026Z25015&did=…)
  const zaakUitLink = (l) => (/[?&]id=(\d{4}Z\d+)/.exec(l || "") || [])[1] || "";
  let _zaakNr = null;
  const zaakVanNr = (n) => (_zaakNr ||= new Map((S.data.zaken || []).map((z) => [z.nummer, z]))).get(n);
  // "di 17 nov"
  const dagKort = (dag) => `${WEEKDAGEN[new Date(dag + "T12:00:00").getDay()].slice(0, 2).toLowerCase()} ${+dag.slice(8)} ${MAANDEN_KORT[+dag.slice(5, 7) - 1]}`;
  // uitslag als die er is, anders de stemmingsdatum uit de agenda van de plenaire Stemmingen
  function stemStatus(nr, uitslag) {
    // "in behandeling" is geen uitslag: dan liever de stemmingsdatum
    const u = [uitslag, nr && zaakVanNr(nr)?.uitslag].find((x) => x && x !== "in behandeling");
    if (u) return uitslagPill(u);
    const dag = nr && (S.data.stemmingen || {})[nr];
    if (dag) return `<span class="status"><span class="dot" aria-hidden="true"></span>${dag >= VANDAAG ? "Stemming" : "Gestemd"} ${esc(dagKort(dag))}</span>`;
    return "";
  }

  /* ---------- Agenda ---------- */
  function agendaItems() {
    const eigen = S.data.agenda.filter(inSector).map((i) => ({ ...i, bron: "eigen" }));
    const kamer = S.data.activiteiten.filter((a) => inSector(a) && a.Status === "Gepland").map((a) => ({
      datum: a.Datum ? dagNL(new Date(a.Datum)) : null, tijd: ((x) => (x && x !== "00:00" ? x : null))(tijdNL(a.Aanvangstijd || a.Datum)), // zoals op de Agenda (tijdlijnItems)
      type: soortLabel(a), titel: a.Onderwerp, url: a.tkLink || `https://berthub.eu/tkconv/activiteit.html?nummer=${a.Nummer}`, bron: "tk", commissie: commissieNaam(a), _act: a,
    }));
    // een eigen regel gaat voor dezelfde Kameractiviteit, maar linkt wel naar die activiteit op de Agenda
    const sleutel = (i) => `${i.datum}|${(i.titel || "").toLowerCase().slice(0, 20)}`;
    const actVan = new Map(kamer.map((i) => [sleutel(i), i]));
    for (const i of eigen) { const k = actVan.get(sleutel(i)); if (k) { i._act = k._act; i.tijd ||= k.tijd; } }
    const seen = new Set();
    return [...eigen, ...kamer].filter((i) => { const k = sleutel(i); if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => opCode(agendaKey(a), agendaKey(b)));
  }
  // datum plus tijd; zonder tijd achteraan de dag, een inbrengtermijn bij gelijke tijd eerst (zoals op Agenda). Vergelijken op code: localeCompare zet "~" vóór de cijfers
  const agendaKey = (i) => sortKey(i.datum) + (i.tijd || "~") + (/^Inbreng/.test(i._act?.Soort || "") ? "" : "~");
  const opCode = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  // een Kameractiviteit opent op de Agenda (op een themapagina met dat themafilter); een eigen mijlpaal gaat naar zijn bron
  function agendaLi(i, slug) {
    const titel = i._act ? `<a class="ltitel" href="#agenda/a-${esc(i._act.Nummer)}${slug ? `?thema=${esc(slug)}` : ""}">${esc(i.titel)}</a>`
      : i.url ? `<a class="ltitel" href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.titel)}</a>` : `<span class="ltitel">${esc(i.titel)}</span>`;
    return `<li><div class="regelmeta">${agendaTypeTag(i.type)}<span class="datum">${fmtKort(i.datum)}${i.tijd ? ` ${esc(i.tijd)}` : ""}</span>${i.commissie ? `<span>${esc(i.commissie)}</span>` : ""}</div>${titel}</li>`;
  }
  /* ---------- Thema's, commissies en ministeries ---------- */
  const TYPE_NORM = { "Plenair debat (tweeminutendebat)": "Tweeminutendebat", "Plenair debat (debat)": "Plenair debat", "Plenair debat (dertigledendebat)": "Dertigledendebat", "Plenair debat (initiatiefwetgeving)": "Plenair debat (wetgeving)", "Inbreng verslag (wetsvoorstel)": "Inbreng verslag" };
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
    if (open) { open.open = false; open.querySelector("summary").focus(); }
  });
  // klik buiten een open filtermenu sluit het
  document.addEventListener("click", (e) => {
    if (e.target.closest("details.facet")) return;
    document.querySelectorAll("details.facet[open]").forEach((d) => { d.open = false; });
  });
  /* ---------- Moties bij vergaderingen ---------- */
  // Een motie hoort bij een plenaire vergadering (of wetgevings-/notaoverleg) op de dag van indienen of de dag ervoor,
  // als het Kamerstukdossier van de motie op de agenda van die vergadering staat. Twijfelgevallen worden niet gekoppeld.
  // Een tweeminutendebat "X (CD d/m)" wordt gekoppeld aan het commissiedebat X van die datum.
  let _mk = null;
  // Kamerstuknummers op de agenda van een vergadering (stukken bij de agendapunten en "36 936" of "36936" in het onderwerp)
  function kamerstukkenVan(a) {
    const s = new Set();
    for (const ap of a.agendapunten || []) for (const st of ap.stukken || []) if (st.kamerstuk) s.add(st.kamerstuk.split("-")[0]);
    for (const m of (a.Onderwerp || "").replace(/(\d{2}) (\d{3})/g, "$1$2").matchAll(/\b(\d{5})\b/g)) s.add(m[1]);
    return s;
  }
  function motieKoppeling() {
    if (_mk) return _mk;
    const plenair = S.data.activiteiten.filter((a) => a.Datum && (/^Plenair/.test(a.Soort) || ["Wetgevingsoverleg", "Notaoverleg"].includes(a.Soort)));
    const perDag = new Map();
    for (const a of plenair) { const d = dagNL(new Date(a.Datum)); if (!perDag.has(d)) perDag.set(d, []); perDag.get(d).push(a); }
    const perAct = new Map(), actVanMotie = new Map();
    for (const z of S.data.zaken) {
      if (z.soort !== "Motie" || !z.gestartOp) continue;
      const dn = new Set(z.dossiers.map((x) => String(x.nummer)));
      const kand = [...(perDag.get(z.gestartOp) || []), ...(perDag.get(plusDagen(z.gestartOp, -1)) || [])];
      const hit = kand.filter((a) => [...kamerstukkenVan(a)].some((n) => dn.has(n)));
      if (hit.length !== 1) continue;
      const nr = hit[0].Nummer;
      if (!perAct.has(nr)) perAct.set(nr, []);
      perAct.get(nr).push(z);
      actVanMotie.set(z.nummer, hit[0]);
    }
    // Een amendement wordt meestal dagen voor het debat ingediend: koppel aan de eerste plenaire vergadering (of wetgevings-/
    // notaoverleg) vanaf de dag voor het indienen, tot en met de stemming, met het Kamerstukdossier op de agenda.
    // Alleen als er op die eerste dag precies één zo'n vergadering is.
    const actVanZaak = new Map(actVanMotie), dagen = [...perDag.keys()].sort();
    for (const z of S.data.zaken) {
      if (z.soort !== "Amendement" || !z.gestartOp) continue;
      const dn = new Set(z.dossiers.map((x) => String(x.nummer)));
      const van = plusDagen(z.gestartOp, -1), tot = S.data.stemmingen[z.nummer] || "9999";
      for (const d of dagen) {
        if (d < van || d > tot) continue;
        const hit = perDag.get(d).filter((a) => [...kamerstukkenVan(a)].some((n) => dn.has(n)));
        if (!hit.length) continue;
        if (hit.length === 1) actVanZaak.set(z.nummer, hit[0]);
        break;
      }
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
    return (_mk = { perAct, actVanMotie, actVanZaak, tmdNaarCd, cdNaarTmd });
  }
  // alle moties bij een vergadering (inclusief het bijbehorende tweeminutendebat)
  function motiesBijActiviteiten(nrs) {
    const { perAct, cdNaarTmd } = motieKoppeling();
    const alle = uniek(nrs.filter(Boolean).flatMap((n) => [n, ...(cdNaarTmd.get(n) || [])]));
    return uniek(alle.flatMap((n) => perAct.get(n) || []));
  }
  // een motie of amendement die op Moties of Amendementen staat, opent daar als opengeklapte rij; de rest gaat naar tweedekamer.nl
  const motieA = (z, extern) => (z && (z.soort === "Motie" || z.soort === "Amendement") && inSector(z)
    ? `<a href="#${z.soort === "Amendement" ? "amendementen" : "moties"}?open=${encodeURIComponent(z.nummer)}">`
    : `<a href="${esc(extern)}" target="_blank" rel="noopener">`);
  function motieLijst(ms) {
    if (!ms.length) return "";
    const aangenomen = ms.filter((z) => z.uitslag === "aangenomen").length;
    return `<div class="small muted">${ms.length} ${ms.length === 1 ? "motie" : "moties"} ingediend, ${aangenomen} aangenomen</div>
      <ul class="motielijst">${ms.map((z) => `<li>${stemStatus(z.nummer, z.uitslag) || uitslagPill(z.uitslag)} ${motieA(z, tkUrl(z))}${esc(hoofd(korteTitel(z).trim()))}</a> <span class="small muted">${indienersTekst(z)}</span></li>`).join("")}</ul>`;
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
      const tijd = ((x) => (x === "00:00" ? "" : x))(tijdNL(t));
      const inbreng = /^Inbreng/.test(a.Soort || "");
      // eindtijd onder de begintijd, zodat je ziet wat tegelijk loopt (Tobias, 23 nov 2026); niet bij een inbrengtermijn
      const eind = !inbreng && tijd && a.Eindtijd && dagNL(new Date(a.Eindtijd)) === dagNL(new Date(a.Datum)) ? tijdNL(a.Eindtijd) : "";
      return { id: hier ? "d-" + sam.id : "a-" + a.Nummer, datum: dagNL(new Date(a.Datum)), t, tijd: inbreng && tijd ? "tot " + tijd : tijd, eind: eind > tijd ? eind : "", inbreng,
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

  // filters van de werkbalk; thema's in de vaste volgorde uit THEMAS, de rest op aantal
  const opAantal = (vs, tel) => [...vs].sort((a, b) => tel.get(b) - tel.get(a) || nlSort.compare(a, b));
  const AGENDA_FILTERS = {
    type: { label: "Type", waarden: (i) => arr(i.type), orde: opAantal, tekst: (v) => esc(v) },
    ministerie: { label: "Ministerie", waarden: (i) => arr(i.ministerie), orde: opAantal, tekst: (v) => esc(v) },
    thema: { label: "Thema", waarden: (i) => arr(i.thema), orde: (vs) => opVolgorde(S.T.lijst.map((t) => t.slug))(vs), tekst: (v) => esc(S.T.naam(v)) },
  };
  const AF = Object.keys(AGENDA_FILTERS);
  function leesAF() {
    const q = hashQuery(), lijst = (k) => q[k] || [];
    S.af = { ...Object.fromEntries(AF.map((f) => [f, lijst(f)])), q: lijst("q").join(","), terug: lijst("terugblik")[0] === "1" };
  }
  function afUrl(terug = S.af.terug) {
    const p = [];
    for (const f of AF) if (S.af[f].length) p.push(`${f}=${S.af[f].map(encodeURIComponent).join(",")}`);
    if (S.af.q.trim()) p.push(`q=${encodeURIComponent(S.af.q.trim())}`);
    if (terug) p.push("terugblik=1");
    return "#agenda" + (p.length ? "?" + p.join("&") : "");
  }
  const afGefilterd = () => !!S.af.q.trim() || AF.some((f) => S.af[f].length);
  function afToepassen() { history.replaceState(null, "", afUrl()); renderAgenda(); }
  function afPast(i, behalve) {
    const q = S.af.q.trim().toLowerCase();
    if (q && !`${i.titel} ${i.commissie} ${i.type}`.toLowerCase().includes(q)) return false;
    return pastFilters(AGENDA_FILTERS, S.af, i, behalve);
  }
  const afWis = () => { for (const f of AF) S.af[f] = []; S.af.q = ""; const v = $("#wq"); if (v) v.value = ""; afToepassen(); };

  // uitgeklapte samenvattingen blijven open als de lijst opnieuw wordt getekend (filter, eerder laden)
  const samOpen = new Set();
  function zetOpen(k, open) {
    k.classList.toggle("open", open);
    k.querySelector(".toggle").setAttribute("aria-expanded", String(open));
    if (open) samOpen.add(k.id); else samOpen.delete(k.id);
    // bij inklappen de vergadering in beeld houden, zodat je niet ergens verderop in de lijst belandt
    if (!open && k.getBoundingClientRect().top < 0) k.scrollIntoView({ block: "start" });
  }
  // de knop, "inklappen" of een klik ergens op de vergadering (niet op een link, knop of in de uitgeklapte inhoud)
  document.addEventListener("click", (e) => {
    const t = e.target.closest(".debat .toggle, .debat [data-inklap]");
    const rij = !t && e.target.closest(".tl-item.debat");
    if (rij && (e.target.closest("a, button, summary, details, .body-wrap") || String(window.getSelection && window.getSelection()).trim())) return;
    const k = t ? t.closest(".debat") : rij;
    if (!k) return;
    zetOpen(k, !k.classList.contains("open"));
    if (t && t.matches("[data-inklap]")) k.querySelector(".toggle").focus({ preventScroll: true });
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
      bindWerkbalk(agendaWerkbalk());
      renderAgenda();
      const el = document.getElementById(doel ? doel.id : /^s-/.test(sub) ? sub : "");
      if (el) { if (el.classList.contains("debat")) zetOpen(el, true); el.scrollIntoView({ block: "start" }); }
    }, 0);
    return `<h1 class="sr-only">Agenda</h1>
      ${werkbalk("Zoek in de agenda", S.af.q, `<div id="agendaknoppen"></div>`)}<div id="agendawrap"></div>`;
  }
  const agendaWerkbalk = () => ({ filters: AGENDA_FILTERS, st: S.af, rijen: [], past: afPast,
    zoek: (q) => { S.af.q = q; afToepassen(); }, zet: (f, vs) => { S.af[f] = vs; afToepassen(); }, wis: afWis });

  // agendapunten met de te behandelen stukken (op Kamerstuknummer); per agendapunt achter het eerste stuk van een Kamerstuk een link naar alle moties daarbij
  const puntenVan = (a) => (a?.agendapunten || []).filter((ap) => (ap.stukken || []).length || !/:\s*$/.test(ap.onderwerp || ""));
  const opKamerstuk = (x, y) => (x.kamerstuk || "~").localeCompare(y.kamerstuk || "~", "nl", { numeric: true });
  // een motie of amendement uit onze data die als stuk bij een agendapunt staat: die staat daar in de vorm van motieLijst()
  const stukMotie = (st) => (/^(motie|amendement)/i.test(st.soort || "") && zaakVanNr(zaakUitLink(st.link))) || null;
  // nummers van de moties die al in de agendapunten staan; het losse blok Moties toont alleen de rest
  const inPunten = (a) => new Set(heeftAgenda(a) ? puntenVan(a).flatMap((ap) => (ap.stukken || []).map(stukMotie).filter(Boolean).map((z) => z.nummer)) : []);
  function agendapuntenBlok(a) {
    const aps = puntenVan(a);
    if (!aps.length) return "";
    const punt = (ap) => {
      const st = [...(ap.stukken || [])].sort(opKamerstuk), ms = st.map(stukMotie).filter(Boolean), rest = st.filter((x) => !stukMotie(x)), gehad = new Set();
      const dossier = (x) => { const ks = (x.kamerstuk || "").replace(/-[^-]+$/, ""); return ks && !gehad.has(ks) && gehad.add(ks) && heeftMoties(ks) ? ks : ""; };
      return `<li><b>${esc((ap.onderwerp || "").replace(/:\s*$/, ""))}</b>${rest.length ? `<div class="small muted">Te behandelen:</div><ul class="stukken">${rest.map((x) => stukRegel(x, ap.onderwerp, dossier(x))).join("")}</ul>` : ""}${motieLijst(ms)}</li>`;
    };
    return `<ol class="agendapunten">${aps.map(punt).join("")}</ol>`;
  }
  function deelnemersBlok(a, d = {}) {
    const bewinds = a.bewindspersonen || [];
    return [
      bewinds.length ? `<div><h5>${bewinds.length > 1 ? "Bewindspersonen" : "Bewindspersoon"}</h5>${bewinds.map((b) => `<div>${esc(b.naam)}<div class="small muted">${esc(b.functie || "")}</div></div>`).join("")}</div>` : "",
      a.voorzitter ? `<div><h5>Voorzitter</h5><div>${esc(a.voorzitter.naam)}${a.voorzitter.fractie ? ` (${esc(a.voorzitter.fractie)})` : ""}</div></div>` : "",
      (d.deskundigen || []).length ? `<div><h5>Deskundigen</h5>${d.deskundigen.map((x) => `<div>${esc(x.naam)}<div class="small muted">${esc(x.organisatie || "")}</div></div>`).join("")}</div>` : "",
      (a.deelnemers || []).length ? `<div><h5>Deelnemers</h5>${a.deelnemers.filter((x, i, l) => l.findIndex((y) => y.naam === x.naam) === i).map((x) => `<div>${esc(x.naam)}${x.fractie ? ` (${esc(x.fractie)})` : x.functie ? ` <span class="small muted">${esc(x.functie)}</span>` : ""}</div>`).join("")}</div>` : "",
    ].join("");
  }
  // uitklapbare agenda bij een vergadering zonder samenvatting; niet als het enige punt de titel herhaalt zonder stukken
  function heeftAgenda(a) {
    const aps = puntenVan(a);
    if (!aps.length) return false;
    return !(aps.length === 1 && !(aps[0].stukken || []).length && (aps[0].onderwerp || "").trim().toLowerCase() === (a.Onderwerp || "").trim().toLowerCase());
  }
  // uitklapbare agenda en/of moties bij een vergadering zonder samenvatting: één knop per rij; is die er niet, dan de deelnemers en het transcript
  // transcript op gehoord.de (data/gehoord.json); een vergadering in delen heeft meer links
  const gehoordLinks = (a) => {
    const ids = S.data.gehoord[a.Nummer] || [];
    // vandaag en nog geen nummer bekend: het overzicht, waar alle debatten van de dag staan (Tobias, 25 nov 2026)
    if (!ids.length && a.Datum && dagNL(new Date(a.Datum)) === VANDAAG && !a.Besloten && !/^Inbreng/.test(a.Soort)) return extLink("https://gehoord.de/beraadslagingen", "Debatten van vandaag op gehoord.de");
    return ids.map((g, i) => extLink(`https://gehoord.de/beraadslagingen/${g}`, `Transcript op gehoord.de${ids.length > 1 ? `, deel ${i + 1}` : ""}`)).join("");
  };
  function agendaBlok(a, id, ms = [], url = "") {
    const al = inPunten(a); ms = ms.filter((z) => !al.has(z.nummer));
    const n = heeftAgenda(a) ? puntenVan(a).length : 0, open = samOpen.has(id), deelnemers = deelnemersBlok(a), transcript = gehoordLinks(a);
    if (!n && !ms.length && !(deelnemers && transcript)) return "";
    const nm = `${ms.length} ${ms.length === 1 ? "motie" : "moties"}`;
    const dicht = n && ms.length ? `Toon agenda en ${nm}` : n ? `Toon agenda (${n} ${n === 1 ? "punt" : "punten"})` : !ms.length ? "Toon deelnemers" : `Toon ${nm} (${ms.filter((z) => z.uitslag === "aangenomen").length} aangenomen)`;
    const wat = n && ms.length ? "agenda en moties" : n ? "agenda" : ms.length ? "moties" : "deelnemers";
    const inhoud = (n ? `<section><h4>Agendapunten</h4>${agendapuntenBlok(a)}</section>` : "") + (ms.length ? `<section><h4>Moties</h4>${motieLijst(ms)}</section>` : "");
    return `<button type="button" class="toggle knop licht" aria-expanded="${open}" aria-controls="b-${esc(id)}"><span class="pijltje" aria-hidden="true"></span><span class="dicht">${dicht}</span><span class="opn">Verberg ${wat}</span></button>
      <div class="body-wrap"><div class="body" id="b-${esc(id)}">
        ${!inhoud ? `<div class="deelnemers">${deelnemers}</div>` : n && deelnemers ? `<div class="sam-raster"><div class="sam-hoofd">${inhoud}</div><div class="sam-zij"><section><h4>Deelnemers</h4><div class="deelnemers">${deelnemers}</div></section></div></div>` : `<div>${inhoud}</div>`}
        <div class="uitvoet">${url ? extLink(url, "Bekijk op tweedekamer.nl") : ""}${transcript}<button type="button" class="linkknop inklap" data-inklap>${hoofd(wat)} inklappen</button></div>
      </div></div>`;
  }

  // een stemdag: alle moties en amendementen waarover wordt gestemd, met indiener en appreciatie, per Kamerstukdossier
  function stemBlok(i) {
    const open = samOpen.has(i.id), groepen = new Map();
    for (const z of i.zaken) { const d = z.dossiers[0]?.titel || "Overig"; if (!groepen.has(d)) groepen.set(d, []); groepen.get(d).push(z); }
    const rij = (z) => { const appr = appreciatie(z); return `<li>${motieA(z, tkUrl(z))}${z.soort === "Amendement" ? "Amendement: " : ""}${esc(hoofd(korteTitel(z).trim()))}</a><span class="small muted">${indienerKort(z)}${appr ? ` · Kabinet: ${esc(appr)}` : ""}</span></li>`; };
    return `<button type="button" class="toggle knop" aria-expanded="${open}" aria-controls="b-${esc(i.id)}"><span class="pijltje" aria-hidden="true"></span><span class="dicht">Toon ${esc(i.titel)}</span><span class="opn">Verberg ${esc(i.titel)}</span></button>
      <div class="body-wrap"><div class="body" id="b-${esc(i.id)}">
        ${[...groepen].map(([d, zs]) => `<section><h4>${esc(d)}</h4><ul class="motielijst stemdag">${zs.map(rij).join("")}</ul></section>`).join("")}
        <button type="button" class="linkknop inklap" data-inklap>Lijst inklappen</button>
      </div></div>`;
  }

  // brieven bij een toezegging: uit het register, anders onze eigen koppeling (data/toezeggingen.json) zolang het register nog openstaand zegt
  function toezeggingBrieven(t) {
    const uitRegister = (t.brieven || []).length > 0;
    const brieven = uitRegister ? t.brieven : ((S.data.toezeggingBrieven || {})[t.nummer] || []).map((id) => ({ id }));
    return brieven.map((b) => {
      const s = S.data.stukken.find((x) => x.id === b.id);
      if (!s && !b.onderwerp) return "";
      const regel = s ? docRegel(s, MRThemas.stukTitel(s)) : extLink(`https://www.tweedekamer.nl/kamerstukken/detail?id=${b.id}&did=${b.id}`, hoofd(b.onderwerp));
      return `<div class="small">${uitRegister ? "Stuk van" : "Nog niet verwerkt in het register; brief van"} ${fmtKort((s || b).datum)}: ${regel}</div>`;
    }).join("");
  }

  function samenvattingBlok(d, url = "") {
    const s = d.samenvatting || {};
    const a = activiteitVan(d) || {};
    const lijst = (a2) => `<ul>${a2.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
    const blok = (t, inhoud) => (inhoud ? `<section><h4>${t}</h4>${inhoud}</section>` : "");
    const agendapunten = agendapuntenBlok(a);
    const deelnemers = deelnemersBlok(a, d);
    const standpunten = (s.partijen || []).map((p) => `<div class="party"><b>${esc(p.fractie)}</b> <span class="muted small">${esc(p.spreker)}</span><div>${esc(p.positie)}</div>${p.link ? `<a class="small" href="${esc(p.link)}" target="_blank" rel="noopener">Terugluisteren</a>` : ""}</div>`).join("")
      + ((s.kabinet || []).length ? `<div class="party"><b>Kabinet</b> <span class="muted small">${esc(d.bewindspersoon || "")}</span>${lijst(s.kabinet)}</div>` : "");
    const officieel = (S.data.toezeggingen || []).filter((t) => [d.activiteit, ...(d.extraActiviteiten || [])].includes(t.activiteit));
    const toezeggingen = (officieel.length
      ? `<ul class="tzlijst">${officieel.map((t) => `<li>${statusPill(t.status)} ${esc(t.tekst)} <span class="small muted">(${esc(t.bewindspersoon)})</span>${toezeggingBrieven(t)}</li>`).join("")}</ul><div class="small muted">Uit het toezeggingenregister van de Kamer.</div>`
      : (s.toezeggingen || []).length ? lijst(s.toezeggingen) : "") +
      ((s.doorgeleid || []).length ? `<div class="small muted">Doorgeleid:</div>${lijst(s.doorgeleid)}` : "");
    const id = esc(d.id), open = samOpen.has("d-" + d.id);
    return `<button type="button" class="toggle knop" aria-expanded="${open}" aria-controls="b-${id}"><span class="pijltje" aria-hidden="true"></span><span class="dicht">Toon samenvatting</span><span class="opn">Verberg samenvatting</span></button>
      <div class="body-wrap"><div class="body" id="b-${id}">
        <div class="sam-raster"><div class="sam-hoofd">
        ${d.video ? `<div class="links"><a href="${esc(d.video)}" target="_blank" rel="noopener">Terugkijken op Debat Direct</a></div>` : ""}
        ${blok("Aanzet", d.aanzet ? `<p>${esc(d.aanzet)}</p>` : "")}
        ${blok("Kern", `<p>${esc(d.gist)}</p>${(s.kern || []).length ? lijst(s.kern) : ""}`)}
        ${blok("Standpunten fracties", standpunten)}
        ${blok("Toezeggingen", toezeggingen || `<p class="muted">Geen toezeggingen</p>`)}
        ${blok("Moties", (s.moties ? `<p>${esc(s.moties)}</p>` : "") + motieLijst(motiesBijActiviteiten([d.activiteit, ...(d.extraActiviteiten || [])]).filter((z) => !inPunten(a).has(z.nummer))))}
        ${blok("Vervolg", (s.vervolg || []).length ? lijst(s.vervolg) : "")}
        </div><div class="sam-zij">
        ${blok("Agendapunten", agendapunten)}
        ${blok("Deelnemers", deelnemers ? `<div class="deelnemers">${deelnemers}</div>` : "")}
        </div></div>
        <div class="peil voetregel">${d.niveau === "kort" ? "Korte samenvatting" : "Samenvatting"} · ${esc(d.samengevatDoor)} · ${fmtKort(d.samengevatOp)} · op basis van het automatische transcript</div>
        <div class="uitvoet">${url ? extLink(url, "Bekijk op tweedekamer.nl") : ""}${d.bron ? extLink(d.bron, "Transcript op gehoord.de") : ""}<button type="button" class="linkknop inklap" data-inklap>Samenvatting inklappen</button></div>
      </div></div>`;
  }

  function renderAgenda() {
    const el = $("#agendawrap");
    if (!el) return;
    const { vast, vaag } = tijdlijnItems();
    const start = S.data.config.startdatum || "2025-11-12";
    const terug = S.af.terug;
    // binnen het zichtbare bereik; daarover gaan ook de aantallen in de filtermenu's
    // plenaire stemmingen als eigen regel per dag (niet in Terugblik); de aantallen volgen het themafilter, zonder ministerie
    const stemRegels = terug ? [] : [...stemmingenPerDag(S.af.thema)].map(([dag, t]) => ({ id: "s-" + dag, datum: dag, t: `${dag}T${t.tijd || "~"}`, tijd: t.tijd, type: "Stemmingen",
      titel: stemTitel(t), zaken: t.zaken, commissie: "Plenaire vergadering", ministerie: [], thema: [...t.themas], gepland: true, stem: true }));
    const bereik = terug ? vast.filter(geweest) : [...stemRegels, ...vast.filter((i) => i.datum >= VANDAAG)];
    const items = bereik.filter((i) => afPast(i));
    const nu = new Date();
    const eerst = terug ? null : [...stemRegels.filter((i) => i.datum > VANDAAG || !i.tijd || i.tijd >= tijdNL(nu)), ...vast.filter((i) => i.gepland && !i.eigen && !i.inbreng && i.a && new Date(i.a.Datum) >= nu)]
      .filter((i) => afPast(i)).sort((a, b) => opCode(a.t, b.t))[0];
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
    // een regel: tijd (met Eerstvolgend), inhoud (meta met thema's, titel) en rechts de uitklapknop; de uitgeklapte inhoud over de volle breedte
    const regel = (i) => {
      const voorbij = !i.gepland && !i.eigen;
      const extern = i.url && !i.url.startsWith("#");
      const metSam = !!(i.sam && i.samHier);
      const ms = !i.sam && !i.gepland && i.a ? motiesBijActiviteiten([i.a.Nummer]) : [];
      const extra = metSam ? samenvattingBlok(i.sam, i.url) : i.stem ? stemBlok(i) : !i.sam && i.a ? agendaBlok(i.a, i.id, ms, i.url) : "";
      // live meekijken: openbare vergadering van vandaag die nog niet voorbij is (geen inbrengtermijn)
      const live = i.a && i.datum === VANDAAG && !i.a.Besloten && !i.inbreng && i.a.Status === "Gepland" && new Date(i.a.Eindtijd || i.a.Datum) >= nu;
      const uitklap = !!extra;
      // een regel die uitklapt: de titel klapt uit, de link naar de Kamer staat in de inhoud
      const titel = i.url && !uitklap ? `<a href="${esc(i.url)}" ${extern ? 'target="_blank" rel="noopener"' : ""}>${esc(i.titel)}</a>` : esc(i.titel);
      return `<li class="tl-item${voorbij ? " voorbij" : ""}${i.eigen ? " mijlpaal" : ""}${uitklap ? " debat" : ""}${uitklap && samOpen.has(i.id) ? " open" : ""}"${i.id ? ` id="${esc(i.id)}"` : ""}>
        <div class="tl-tijd">${esc(i.tijd || "")}${i.eind ? `<span class="tl-eind">tot ${esc(i.eind)}</span>` : ""}${i === eerst ? `<span class="badge alarm">Eerstvolgend</span>` : ""}</div>
        <div class="tl-inhoud">
          <div class="tl-titel">${titel}</div>
          <div class="tl-meta"><span class="tag">${esc(i.type)}</span>${i.commissie ? `<span>${esc(i.commissie)}</span>` : ""}${i.a?.zaal ? `<span>${esc(i.a.zaal)}</span>` : ""}${i.a?.Besloten && !i.inbreng ? `<span class="badge stil">Besloten</span>` : ""}${metSam && i.sam.niveau === "kort" ? `<span class="badge stil" title="Korte samenvatting: alleen de hoofdlijn">Kort</span>` : ""}${i.thema.length && !i.stem ? themaChips(i.thema, true) : ""}</div>
          ${i.sam && !metSam ? `<div class="tl-verwijs small"><a href="#agenda/d-${esc(i.sam.id)}">Samenvatting bij ${esc(i.sam.titel)}</a></div>` : ""}
        </div>
        ${live ? `<div class="tl-live"><a href="https://debatdirect.tweedekamer.nl/" target="_blank" rel="noopener">Live op Debat Direct</a></div>` : ""}
        ${extra}</li>`;
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
            <ul class="tl-lijst">${l.length ? l.sort((a, b) => opCode(a.t.slice(0, 16), b.t.slice(0, 16)) || !!b.inbreng - !!a.inbreng).map(regel).join("") : `<li class="tl-item leeg muted">${afGefilterd() ? "Niets met deze filters vandaag" : "Geen vergaderingen vandaag"}</li>`}</ul>
          </div>`;
        }).join("")}
      </section>`;
    }).join("");

    // de schakelaar staat in voor de paginatitel; de filters gaan mee naar de andere weergave
    $("#agendaknoppen").innerHTML = `<nav class="schakelaar" aria-label="Weergave">
        <a href="${esc(afUrl(false))}" data-modus=""${terug ? "" : ' aria-current="page"'}>Komend</a>
        <a href="${esc(afUrl(true))}" data-modus="terug"${terug ? ' aria-current="page"' : ""}>Geweest</a></nav>`;
    tekenWerkbalk({ ...agendaWerkbalk(), rijen: bereik });
    meldAantal(items.length);

    const vaagHier = terug ? [] : vaag.filter((i) => afPast(i));
    el.innerHTML = `
      ${afGefilterd() ? `<p class="small muted telregel">${nl(items.length)} ${items.length === 1 ? "item" : "items"} ${terug ? "sinds het begin van de Kamerperiode" : "vanaf vandaag"}</p>` : ""}
      <div class="tijdlijn">${weekHtml || `<p class="empty">${afGefilterd() ? `Niets met deze filters <button type="button" class="linkknop" data-wisalles>Filters wissen</button>` : "Niets in deze periode"}</p>`}</div>
      ${terug ? `<p class="small muted">Begin van de Kamerperiode (${fmtKort(start)})</p><a class="knop naar-ander" href="${esc(afUrl(false))}" data-modus="">Naar komende vergaderingen</a>` : ""}
      ${vaagHier.length ? `<h3 class="groepkop">Mijlpalen zonder vaste dag</h3><div class="card"><ul class="list">${vaagHier.map((i) => `<li><div class="regelmeta">${soortTag(i.type)}<span class="datum">${fmtDatum(i.datum)}</span></div>${i.url ? `<a class="ltitel" href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.titel)}</a>` : `<span class="ltitel">${esc(i.titel)}</span>`}${themaChips(i.thema, true)}</li>`).join("")}</ul></div>` : ""}`;
    const wisAlles = el.querySelector("[data-wisalles]");
    if (wisAlles) wisAlles.addEventListener("click", afWis);
    document.querySelectorAll("#agendaknoppen [data-modus], #agendawrap [data-modus]").forEach((b) => b.addEventListener("click", (e) => {
      e.preventDefault();
      const t = b.dataset.modus === "terug";
      if (t === S.af.terug) return;
      S.af.terug = t;
      afToepassen();
      window.scrollTo(0, 0);
      $(`#agendaknoppen [data-modus="${b.dataset.modus}"]`).focus({ preventScroll: true });
    }));
  }

  /* ---------- Zoeken ---------- */
  // De index (assets/zoek.js) wordt pas gebouwd bij de eerste zoekopdracht.
  // Alles wat de resultaten bepaalt staat in de URL: #zoeken?q=…&cat=moties&periode=maand&wie=f:pvv
  let _zoek = null;
  // de index neemt de motieteksten mee zodra die geladen zijn (1,3 MB, pas bij de eerste zoekopdracht); daarna opnieuw bouwen
  const zoekIndex = () => {
    if (!S.data.teksten) laadTeksten().then(() => { _zoek = null; if (location.hash.startsWith("#zoeken")) renderZoekResultaten(); });
    return _zoek || (_zoek = window.MRZoek.maak({ ...S.data, T: S.T }, S.data.synoniemen));
  };
  const zoekParams = () => new URLSearchParams(location.hash.split("?")[1] || "");
  function zoekVraag() { return zoekParams().get("q") || ""; }
  function zoekUrl(wijzig = {}) {
    const p = zoekParams();
    for (const [k, v] of Object.entries(wijzig)) { if (v) p.set(k, v); else p.delete(k); }
    const s = p.toString().replace(/%3A/gi, ":");
    return "#zoeken" + (s ? "?" + s : "");
  }
  function zetZoek(wijzig) {
    history.replaceState(null, "", zoekUrl(wijzig));
    S.zoekMax = 30; S.zoekKomendAlles = false;
    renderZoekResultaten();
  }
  const ZOEK_PERIODES = [["", "Alle jaren"], ["kamer", "Deze Kamerperiode"], ["maand", "Afgelopen maand"]];
  const periodeVan = (p) => (p === "maand" ? plusDagen(VANDAAG, -30) : p === "kamer" ? S.data.config.startdatum : "");

  // geplande stemming over een motie of amendement zonder uitslag
  // een wetsvoorstel toont in de zoekresultaten zijn fase, zoals op Wetgeving
  const zoekStatus = (d) => { const z = d.cat === "wetgeving" && zaakVanNr(d.nummer); return z ? wetStatus(z) : d.uitslag; };
  const stemOp = (d) => (d.cat === "moties" && !d.uitslag ? (S.data.stemmingen || {})[d.nummer] : "") || "";
  // wanneer iets gebeurt: geplande stemming, anders de datum; agenda zonder datum telt als toekomst
  const zoekWanneer = (d) => { const st = stemOp(d); return st >= VANDAAG ? st : d.datum ? sortKey(d.datum) : d.cat === "agenda" ? "9999" : ""; };
  const zoekDatum = (d) => (d.datum === VANDAAG ? `<span class="badge alarm">Vandaag</span>` : d.datum ? `<span class="datum">${fmtKort(d.datum)}</span>` : d.cat === "agenda" ? `<span class="datum">datum volgt</span>` : "");

  // moties en amendementen met dezelfde titel (gewijzigd, ter vervanging, opnieuw ingediend) worden één rij; de nieuwste voorop
  function voegSamen(res) {
    const groep = new Map(), uit = [];
    const nieuwer = (a, b) => (zoekWanneer(a.doc) || "").localeCompare(zoekWanneer(b.doc) || "");
    for (const r of res) {
      if (r.doc.cat !== "moties") { uit.push(r); continue; }
      const k = r.doc.soort + "|" + window.MRZoek.tokens(r.doc.titel).join(" ");
      const g = groep.get(k);
      if (!g) { const n = { ...r, ook: [] }; groep.set(k, n); uit.push(n); continue; }
      g.score = Math.max(g.score, r.score); g.inTitel = g.inTitel || r.inTitel;
      if (nieuwer(r, g) > 0) { g.ook.push({ doc: g.doc }); g.doc = r.doc; g.termen = new Set([...g.termen, ...r.termen]); }
      else g.ook.push({ doc: r.doc });
    }
    for (const r of uit) if (r.ook) r.ook.sort((a, b) => nieuwer(b, a));
    return uit;
  }

  // header: een lijst met suggesties onder het zoekveld (combobox); Enter opent de resultatenpagina.
  // Op de resultatenpagina zelf werkt de pagina direct bij en is er geen lijst.
  function bindZoekveld() {
    const veld = $("#zoekveld"), form = $("#zoekform");
    const lijst = document.createElement("div");
    lijst.id = "zoeksuggesties"; lijst.className = "zsug"; lijst.setAttribute("role", "listbox"); lijst.setAttribute("aria-label", "Suggesties"); lijst.hidden = true;
    form.appendChild(lijst);
    veld.setAttribute("role", "combobox"); veld.setAttribute("aria-autocomplete", "list"); veld.setAttribute("aria-controls", lijst.id); veld.setAttribute("aria-expanded", "false");
    let timer = null, actief = -1, opties = [];
    const opZoekpagina = () => location.hash.startsWith("#zoeken");
    const sluit = () => { lijst.hidden = true; veld.setAttribute("aria-expanded", "false"); veld.removeAttribute("aria-activedescendant"); actief = -1; };
    const zetActief = (i) => {
      actief = i;
      lijst.querySelectorAll("[role=option]").forEach((o, n) => o.setAttribute("aria-selected", String(n === i)));
      if (i >= 0) { veld.setAttribute("aria-activedescendant", "zsug-" + i); $("#zsug-" + i).scrollIntoView({ block: "nearest" }); } else veld.removeAttribute("aria-activedescendant");
    };
    const open = (o) => {
      sluit();
      if (o.extern) { window.open(o.href, "_blank", "noopener"); return; }
      naar(o.href);
    };
    // hetzelfde adres opnieuw zetten geeft geen hashchange (na replaceState kan het adres al kloppen): dan zelf tekenen
    const naar = (h) => { _klik = true; if (location.hash === h) route(); else location.hash = h; };
    const naarResultaten = (q) => { sluit(); S.zoekMax = 30; S.zoekKomendAlles = false; naar("#zoeken" + (q ? "?q=" + encodeURIComponent(q) : "")); };
    const toon = () => {
      const q = veld.value.trim();
      if (opZoekpagina()) {
        sluit();
        history.replaceState(null, "", zoekUrl({ q }));
        S.zoekMax = 30; S.zoekKomendAlles = false;
        if ($("#zoekres")) renderZoekResultaten(); else route();
        return;
      }
      if (q.length < 2) { sluit(); return; }
      const Z = zoekIndex(), uit = Z.zoek(q), res = voegSamen(uit.resultaten);
      opties = res.slice(0, 6).map(({ doc: d, termen }) => ({ href: d.link, extern: d.extern,
        html: `<span class="zsug-meta"><span class="tag">${esc(d.soort.replace(/ \(niet samengevat\)$/, ""))}</span>${zoekDatum(d)}</span><span class="zsug-titel">${Z.markeer(d.titel, termen, esc)}</span>` }));
      opties.push({ href: "#zoeken?q=" + encodeURIComponent(q), alle: true,
        html: res.length ? `Toon alle ${nl(res.length)} resultaten voor <b>${esc(q)}</b>` : `Geen directe treffers voor <b>${esc(q)}</b>; open de zoekpagina voor suggesties` });
      lijst.innerHTML = opties.map((o, i) => `<div role="option" id="zsug-${i}" class="zsug-optie${o.alle ? " zsug-alle" : ""}" aria-selected="false" data-i="${i}">${o.html}</div>`).join("");
      lijst.hidden = false; veld.setAttribute("aria-expanded", "true"); actief = -1;
    };
    veld.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(toon, opZoekpagina() ? 200 : 120); });
    veld.addEventListener("focus", () => { if (!opZoekpagina() && veld.value.trim().length >= 2) toon(); });
    veld.addEventListener("blur", () => setTimeout(sluit, 120));
    lijst.addEventListener("mousedown", (e) => e.preventDefault());
    lijst.addEventListener("click", (e) => { const o = e.target.closest("[data-i]"); if (o) open(opties[+o.dataset.i]); });
    form.addEventListener("submit", (e) => {
      e.preventDefault(); clearTimeout(timer);
      if (!lijst.hidden && actief >= 0) { open(opties[actief]); return; }
      if (opZoekpagina()) toon(); else naarResultaten(veld.value.trim());
    });
    veld.addEventListener("keydown", (e) => {
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !lijst.hidden) {
        e.preventDefault();
        const n = opties.length;
        zetActief(e.key === "ArrowDown" ? (actief + 1) % n : (actief - 1 + n) % n);
      } else if (e.key === "Escape") {
        if (!lijst.hidden) { e.preventDefault(); sluit(); return; }
        veld.value = ""; if (opZoekpagina()) toon();
      }
    });
  }
  function zoeken() {
    return `<h1 class="sr-only">Zoeken</h1><div id="zoekres" aria-live="polite"></div>`;
  }
  // dezelfde soorten en namen als het menu Documenten; vergaderingen en toezeggingen vallen onder Agenda
  const ZOEK_CATS = [["", "Alles"], ["agenda", "Agenda"], ["wetgeving", "Wetgeving"], ["moties", "Moties"], ["amendementen", "Amendementen"], ["kamervragen", "Kamervragen"], ["kamerbrieven", "Kamerbrieven"], ["kerndocumenten", "Kerndocumenten"]];
  function zoekCat(d) {
    if (d.cat === "debatten" || d.cat === "toezeggingen") return "agenda";
    if (d.cat === "moties") return d.soort === "Amendement" ? "amendementen" : "moties";
    if (d.cat === "stukken") return d.soort === "Kamerbrief" ? "kamerbrieven" : "kamervragen";
    return d.cat;
  }

  function renderZoekResultaten() {
    const el = $("#zoekres");
    if (!el) return;
    const P = zoekParams();
    const q = (P.get("q") || "").trim();
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
    const Z = zoekIndex();
    let cat = P.get("cat") || "";
    const periode = ZOEK_PERIODES.some(([p]) => p === P.get("periode")) ? P.get("periode") || "" : "";
    const uit = Z.zoek(q, { wie: P.get("wie") || "" });
    if (P.get("wie") && !uit.wie) history.replaceState(null, "", zoekUrl({ wie: "" }));
    const alle = voegSamen(uit.resultaten);
    const isKomend = (r) => zoekWanneer(r.doc) >= VANDAAG;
    const vanaf = periodeVan(periode);
    const binnen = vanaf ? alle.filter((r) => isKomend(r) || (r.doc.datum && sortKey(r.doc.datum) >= vanaf)) : alle;
    const tel = Object.fromEntries(ZOEK_CATS.map(([c]) => [c, c ? binnen.filter((r) => zoekCat(r.doc) === c).length : binnen.length]));
    if (cat && !tel[cat]) cat = "";
    const lijst = cat ? binnen.filter((r) => zoekCat(r.doc) === cat) : binnen;

    const item = ({ doc: d, termen, ook }) => {
      const link = d.extern ? `href="${esc(d.link)}" target="_blank" rel="noopener"` : `href="${esc(d.link)}"`;
      const stem = stemOp(d);
      return `<li>
        <div class="zmeta">${zoekSoortTag(d)}${d.uitslag ? uitslagPill(zoekStatus(d)) : ""}${d.cat === "toezeggingen" ? statusPill(d.status) : ""}${d.niveau === "kort" ? `<span class="badge stil">Kort</span>` : ""}${zoekDatum(d)}${stem >= VANDAAG ? `<span>Stemming ${esc(dagKort(stem))}</span>` : ""}${d.indiener ? `<span>${esc(d.indiener)}</span>` : ""}${ook && ook.length && d.kamerstuk ? `<span>Kamerstuk ${esc(d.kamerstuk)}</span>` : ""}${d.ministerie ? `<span>${esc(d.ministerie)}</span>` : ""}</div>
        <a class="ztitel" ${link}>${Z.markeer(d.titel, termen, esc)}${d.extern ? `<span class="sr-only"> (opent nieuwe pagina)</span>` : ""}</a>
        <div class="zfrag">${Z.fragment(d, termen, esc)}</div>
        ${ook && ook.length ? `<ul class="zook">${ook.map(({ doc: o }) => `<li><span class="muted">Ook:</span> <a href="${esc(o.link)}"${o.extern ? ` target="_blank" rel="noopener"` : ""}>${esc(o.soort)}${o.indiener ? ` ${esc(o.indiener)}` : ""}${o.kamerstuk ? `, Kamerstuk ${esc(o.kamerstuk)}` : ""}${o.extern ? `<span class="sr-only"> (opent nieuwe pagina)</span>` : ""}</a>${o.uitslag ? uitslagPill(zoekStatus(o)) : ""}${o.datum ? `<span class="datum">${fmtKort(o.datum)}</span>` : ""}</li>`).join("")}</ul>` : ""}
        ${themaChips(d.themas || [])}
      </li>`;
    };
    const ul = (l) => `<ul class="list zoeklijst">${l.map(item).join("")}</ul>`;
    let blokken = "", rest = lijst;
    const komend = lijst.filter(isKomend).sort((a, b) => zoekWanneer(a.doc).localeCompare(zoekWanneer(b.doc)) || b.score - a.score);
    // Komt eraan: wat vanaf vandaag gepland staat (agenda, vergaderingen, stemmingen), eerstvolgende eerst; agenda zonder datum achteraan.
    // Daarna de rest, nieuwste eerst (geen keuze voor "Beste treffer" meer, Tobias 18 nov 2026).
    const komendSet = new Set(komend);
    rest = lijst.filter((r) => !komendSet.has(r)).sort((a, b) => (b.doc.datum || "").localeCompare(a.doc.datum || "") || b.score - a.score);
    if (komend.length) {
      const toon = S.zoekKomendAlles ? komend : komend.slice(0, 5);
      blokken += `<section class="zsectie" aria-labelledby="zkomend"><h3 id="zkomend" class="zkop">Komt eraan <span class="n">${nl(komend.length)}</span></h3>
        <div class="card">${ul(toon)}${komend.length > toon.length ? `<div class="kaartvoet"><button type="button" class="chip" id="zkomendmeer">Toon alle <span class="n">${nl(komend.length)}</span></button></div>` : ""}</div></section>`;
    }
    if (rest.length) {
      const zicht = rest.slice(0, S.zoekMax);
      // per maand, nieuwste eerst
      const groepen = [];
      for (const r of zicht) {
        const m = /^(\d{4})-(\d{2})/.exec(r.doc.datum || "");
        const kop = m ? `${MAANDEN[+m[2] - 1]} ${m[1]}` : "Zonder datum";
        if (!groepen.length || groepen[groepen.length - 1].kop !== kop) groepen.push({ kop, l: [] });
        groepen[groepen.length - 1].l.push(r);
      }
      const inhoud = groepen.map((g) => `<h4 class="zmaand">${esc(hoofd(g.kop))}</h4>${ul(g.l)}`).join("");
      const metKop = komend.length;
      blokken += `<section class="zsectie" aria-labelledby="zeerder">${metKop ? `<h3 id="zeerder" class="zkop">Eerder <span class="n">${nl(rest.length)}</span></h3>` : `<h3 id="zeerder" class="${blokken ? "zkop" : "sr-only"}">Resultaten <span class="n">${nl(rest.length)}</span></h3>`}
        <div class="card">${inhoud}
        ${rest.length > S.zoekMax ? `<div class="kaartvoet"><button type="button" class="knop licht" id="zmeer">Toon meer <span class="n">${nl(rest.length - S.zoekMax)} over</span></button></div>` : ""}</div></section>`;
    }

    // niets gevonden: zeggen waardoor, en wat wel werkt
    const leeg = () => {
      const tips = [];
      const knop = (wijzig, tekst) => `<button type="button" class="chip" data-zzet='${esc(JSON.stringify(wijzig))}'>${tekst}</button>`;
      if (uit.wie) { const n = voegSamen(Z.zoek(q).resultaten).length; if (n) tips.push(`<p>Niets waarbij ${esc(uit.wie.label)} indiener, vragensteller of spreker is. ${knop({ wie: "" }, `Toon alle ${nl(n)} resultaten`)}</p>`); }
      if (periode && alle.length) tips.push(`<p>Niets in deze periode. ${knop({ periode: "" }, `Toon alle ${nl(alle.length)} resultaten`)}</p>`);
      if (!alle.length) {
        if (uit.frasen.length) { const zq = q.replace(/"/g, ""); const n = Z.zoek(zq).resultaten.length; if (n) tips.push(`<p>Niets met precies deze woordgroep. ${knop({ q: zq }, `Zoek zonder aanhalingstekens <span class="n">${nl(n)}</span>`)}</p>`); }
        const sug = Z.suggesties(q);
        const spelling = sug.filter((s) => s.soort === "spelling"), woord = sug.filter((s) => s.soort === "woord");
        if (spelling.length) tips.push(`<p>Bedoelde je ${spelling.map((s) => knop({ q: s.q }, `${esc(s.q)} <span class="n">${nl(s.n)}</span>`)).join(" ")}</p>`);
        if (woord.length) tips.push(`<p>Niets met al deze woorden samen. Wel resultaten voor ${woord.map((s) => knop({ q: s.q }, `${esc(s.q)} <span class="n">${nl(s.n)}</span>`)).join(" ")}</p>`);
        tips.push(`<p class="muted">Zoek op een korter woord, een Kamerstuknummer (bv. <code>36169</code>) of een naam, of kijk per thema:</p>
          <div class="filters">${S.T.lijst.map((t) => `<a class="chip" href="#themas/${esc(t.slug)}">${esc(t.label)}</a>`).join("")}</div>`);
      }
      return `<div class="card empty zleeg">${tips.join("") || "Geen resultaten. Probeer een ander of korter woord."}</div>`;
    };

    // ook met resultaten: bij alleen gedeeltelijke treffers of alleen tikfouttreffers een betere spelling voorstellen
    const spelling = binnen.length && (uit.modus === "OR" || uit.tikfout) ? Z.suggesties(q).filter((x) => x.soort === "spelling") : [];
    // weinig treffers op meer woorden samen: ook de losse woorden aanbieden
    const los = !spelling.length && binnen.length && alle.length < 10 && !uit.wie && !uit.frasen.length && !uit.typeFilter
      ? Z.suggesties(q).filter((x) => x.soort === "woord").map((x) => ({ ...x, n: voegSamen(Z.zoek(x.q).resultaten).length })).filter((x) => x.n > alle.length) : [];
    const wieChips = uit.wieOpties.slice(0, 3).map((w) => {
      const aan = uit.wie && uit.wie.k === w.k;
      return `<button type="button" class="chip" data-zwie="${esc(w.k)}" aria-pressed="${aan}" title="Alleen items waarbij ${esc(w.label)} indiener, vragensteller of spreker is">Alleen ${esc(w.label)}${w.fractie ? ` <span class="n">${esc(w.fractie)}</span>` : ""}</button>`;
    }).join("");
    el.innerHTML = `
      <div class="zfilterrij">
        <div class="filterkaart" role="group" aria-label="Soort resultaat">
          ${ZOEK_CATS.map(([c, l]) => `<button type="button" class="chip" data-zcat="${c}" aria-pressed="${cat === c}" ${!tel[c] && c ? "disabled" : ""}>${esc(l)} <span class="n">${nl(tel[c])}</span></button>`).join("")}
        </div>
        <div class="filterkaart" role="group" aria-label="Periode">
          ${ZOEK_PERIODES.map(([p, l]) => `<button type="button" class="chip" data-zperiode="${p}" aria-pressed="${periode === p}">${esc(l)}</button>`).join("")}
        </div>
      </div>
      <div class="zoekkop">
        <div class="zoekkop-l">
          <p class="small muted telregel">${nl(binnen.length)} ${binnen.length === 1 ? "resultaat" : "resultaten"} voor <b>${esc(q)}</b>.
            ${uit.modus === "OR" ? " Niets gevonden met al deze woorden; dit zijn resultaten met een deel ervan." : ""}
            ${uit.typeFilter ? ` Alleen <b>${esc(uit.typeFilter)}</b>, omdat dat woord in je zoekvraag staat.` : ""}
            ${uit.wie ? ` Alleen waar <b>${esc(uit.wie.label)}</b> indiener, vragensteller of spreker is.` : ""}
            ${spelling.length ? ` Bedoelde je ${spelling.map((x) => `<button type="button" class="linkknop" data-zzet='${esc(JSON.stringify({ q: x.q }))}'>${esc(x.q)}</button>`).join(" of ")}?` : ""}
            ${los.length ? ` Zoek ook op ${los.map((x) => `<button type="button" class="linkknop" data-zzet='${esc(JSON.stringify({ q: x.q, cat: "" }))}'>${esc(x.q)}</button> (${nl(x.n)})`).join(" of ")}.` : ""}</p>
          ${wieChips ? `<div class="agendamodus" role="group" aria-label="Persoon of fractie">${wieChips}</div>` : ""}
        </div>
      </div>
      ${lijst.length ? blokken : leeg()}`;
    const houdFocus = (sel) => { const b = $(sel); if (b) b.focus({ preventScroll: true }); };
    el.querySelectorAll("[data-zcat]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); zetZoek({ cat: b.dataset.zcat }); houdFocus(`button[data-zcat="${b.dataset.zcat}"]`); }));
    el.querySelectorAll("[data-zperiode]").forEach((b) => b.addEventListener("click", () => { zetZoek({ periode: b.dataset.zperiode }); houdFocus(`[data-zperiode="${b.dataset.zperiode}"]`); }));
    el.querySelectorAll("[data-zwie]").forEach((b) => b.addEventListener("click", () => { const k = b.dataset.zwie; zetZoek({ wie: uit.wie && uit.wie.k === k ? "" : k }); houdFocus(`[data-zwie="${k}"]`); }));
    el.querySelectorAll("[data-zzet]").forEach((b) => b.addEventListener("click", () => { const w = JSON.parse(b.dataset.zzet); if (w.q != null) $("#zoekveld").value = w.q; zetZoek(w); }));
    const meer = $("#zmeer"); if (meer) meer.addEventListener("click", () => { S.zoekMax += 30; renderZoekResultaten(); });
    const km = $("#zkomendmeer"); if (km) km.addEventListener("click", () => { S.zoekKomendAlles = true; renderZoekResultaten(); });
  }

  /* ---------- Over ---------- */
  /* ---------- Kerndocumenten (#documenten) ----------
     Vaste documenten voor beleidsonderzoek (data/kerndocumenten.json) plus de begrotingsstukken uit de Kamerdata
     (data/tk/begrotingen.json), in het tabelpatroon van Moties & Amendementen: een schakelaar met een tab per groep
     (#documenten/<groep>) en één tabel. Per reeks de nieuwste editie; eerdere edities staan in de uitgeklapte rij.
     Begrotingen en jaarverslagen zijn een rij per hoofdstuk. Groepen met pagina "wetgeving" staan op Wetgeving
     (Geldende wetten), groepen met verborgen: true nergens (dat filtert MRThemas.kerndocumenten al). */
  let _kd = null;
  function kdData() {
    if (_kd && _kd.bron === S.data.kerndocumenten) return _kd;
    const M = window.MRThemas, alle = M.kerndocumenten(S.data.kerndocumenten, S.data.begrotingen, S.data.rapporten, S.data.stukken);
    const groepen = (S.data.kerndocumenten.groepen || []).filter((g) => !g.verborgen);
    const reeksen = M.kerndocReeksen(alle);
    // thema's: mapping (na de review), dan het veld themas
    const themasVan = onthoud((d) => { const k = "kerndoc:" + d.id; return S.T.inMapping(k) ? S.T.item(k) : (d.themas || []).filter((t) => S.T.bestaat(t)); }, (d) => d.id);
    // naam per begrotingshoofdstuk (XII: Infrastructuur en Waterstaat)
    const hoofdstukNaam = new Map((S.data.begrotingen || []).filter((b) => b.hoofdstuk && b.naam).map((b) => [b.hoofdstuk, b.naam]));
    return (_kd = { bron: S.data.kerndocumenten, alle, groepen, reeksen, themasVan, hoofdstukNaam });
  }
  // tabs op Kerndocumenten: alle zichtbare groepen behalve die op een andere pagina staan
  const kdTabs = () => kdData().groepen.filter((g) => !g.pagina);
  function kdMeta(d) {
    return [`<span class="tag">${esc(d.soort || "Document")}</span>`, d.datum ? `<span class="datum">${fmtKort(d.datum)}</span>` : "",
      d.uitgever ? `<span>${esc(d.uitgever)}</span>` : "", d.kenmerk ? `<span class="mono">${esc(d.kenmerk)}</span>` : ""].filter(Boolean);
  }
  // "Kamerstuk 37020 XII" -> "37020-XII"; andere kenmerken (ECLI, BWBR, documentnummer) zoals ze zijn
  const kdKenmerk = (k) => String(k || "").replace(/^Kamerstuk /, "").replace(/^(\d+) ([A-Z]+)$/, "$1-$2");
  const kdBron = (url) => { try { const h = new URL(url).hostname.replace(/^www\./, ""); return h === "tweedekamer.nl" ? "Bekijk op tweedekamer.nl" : `Bekijk op ${h}`; } catch (e) { return "Bekijk het document"; } };
  function kerndocDef(groep) {
    const K = kdData();
    const themasKd = K.themasVan;
    const groepLabel = new Map(K.groepen.map((g) => [g.id, g.label]));
    const hoofdstukken = (S.data.config.kerndocumenten?.hoofdstukken) || [];
    const filters = {
      thema: themaFilter(themasKd),
      soort: { label: "Soort", waarden: (d) => [d.soort || "Document"], orde: opVolgorde(["Nota", "Begroting", "Jaarverslag", "Wetsvoorstel"]), tekst: (v) => esc(v) },
      // meer uitgevers ("RIVM en WUR", "PBL, RIVM en WUR") tellen elk apart; "e.a." valt weg
      uitgever: { label: "Uitgever", waarden: (d) => (d.uitgever ? d.uitgever.replace(/\s+e\.a\.$/, "").split(/, | en /) : [""]), orde: opVolgorde([]), tekst: (v) => esc(v || "Onbekend") },
    };
    if (groep === "rapporten") delete filters.soort;
    if (groep === "begroting") filters.hoofdstuk = { label: "Hoofdstuk", waarden: (d) => [d.hoofdstuk || ""], orde: opVolgorde(["", ...hoofdstukken]),
      tekst: (v) => (v ? `<span class="mono">${esc(v)}</span> ${esc(K.hoofdstukNaam.get(v) || "")}` : "Rijksbreed") };
    if (!groep) filters.groep = { label: "Groep", waarden: (d) => [d.groep], orde: opVolgorde(K.groepen.map((g) => g.id)), tekst: (v) => esc(groepLabel.get(v) || v) };
    const kolommen = [
      { titel: true, kop: groep === "rapporten" ? "Rapport" : "Document", thCls: "ond", tdCls: "ond", cel: (d) => rijTitel(d.titel) },
      ...(groep ? [] : [{ filter: "groep", tdCls: "uitslag", cel: (d) => esc(groepLabel.get(d.groep) || "") }]),
      ...(groep === "rapporten" ? [] : [{ filter: "soort", tdCls: "uitslag", cel: (d) => esc(d.soort || "Document") }]),
      ...(groep === "begroting" ? [{ filter: "hoofdstuk", tdCls: "kamerstuk mono", cel: (d) => (d.hoofdstuk ? `<span title="${esc(K.hoofdstukNaam.get(d.hoofdstuk) || "")}">${esc(d.hoofdstuk)}</span>` : leegCel("Rijksbreed")) }] : []),
      { filter: "uitgever", tdCls: "ministerie hide-sm", cel: (d) => (d.uitgever ? esc(d.uitgever) : leegCel("Onbekend")) },
      themaKolom(themasKd),
      ...(groep === "rapporten" ? [] : [{ kop: "Kenmerk", thCls: "rechts hide-sm", tdCls: "kamerstuk rechts mono hide-sm", cel: (d) => (d.kenmerk ? `<span title="${esc(d.kenmerk)}">${esc(kdKenmerk(d.kenmerk))}</span>` : leegCel("Geen kenmerk")) }]),
      { datum: true, kop: "Datum" },
    ];
    return {
      tab: groep ? `kerndocumenten/${groep}` : "kerndocumenten", eenheid: "kerndocumenten", knopLabel: "Details",
      rijen: () => K.reeksen.filter((d) => (groep ? d.groep === groep : K.groepen.some((g) => g.id === d.groep))),
      datum: (d) => d.datum, sleutel: (d) => d.id,
      zoektekst: (d) => [d.titel, d.afkorting, d.uitgever, d.kenmerk, kdKenmerk(d.kenmerk), d.soort, d.document, d.documentSoort, d.hoofdstuk, K.hoofdstukNaam.get(d.hoofdstuk), ...(d.eerder || []).map((e) => e.titel)].filter(Boolean).join(" "),
      filters, kolommen, detail: kdDetail,
    };
  }
  // uitgeklapte rij: kenmerken, eerdere edities en de links
  function kdDetail(d) {
    const kenm = [d.kenmerk ? (/^Kamerstuk /.test(d.kenmerk) ? `Kamerstuk <span class="mono">${esc(kdKenmerk(d.kenmerk))}</span>` : `<span class="mono">${esc(d.kenmerk)}</span>`) : "", d.document && d.document !== d.kenmerk ? `document <span class="mono">${esc(d.document)}</span>` : "",
      d.documentSoort ? esc(d.documentSoort.toLowerCase()) : "", d.datum ? `verschenen ${fmtKort(d.datum)}` : "", d.uitgever ? esc(d.uitgever) : ""].filter(Boolean);
    const eerder = d.eerder || [];
    const ed = (e) => `<li>${e.datum ? `<span class="datum">${fmtKort(e.datum)}</span> ` : ""}${docRegel({ ...e, id: e.document, link: e.url }, e.titel, e.kenmerk ? ` <span class="muted mono">${esc(kdKenmerk(e.kenmerk))}</span>` : "")}</li>`;
    return `<div class="mdetail">
      ${kenm.length ? `<p>${kenm.join(" · ")}</p>` : ""}
      ${d.brief ? `<div class="mstemming"><p class="mtelling">Bij Kamerbrief</p><ul class="mstappen"><li>${extLink(d.brief.link, d.brief.titel)} <span class="muted mono">${esc(d.brief.id)}</span></li></ul></div>` : ""}
      ${eerder.length ? `<div class="mstemming"><p class="mtelling">${eerder.length === 1 ? "Eerdere editie" : `Eerdere edities (${nl(eerder.length)})`}</p><ul class="mstappen">${eerder.map(ed).join("")}</ul></div>` : ""}
      ${mlinks(docKnop({ ...d, id: d.document, link: d.url }, "Bekijk het origineel", ""), `${extLink(d.url, kdBron(d.url))}${(d.links || []).map((l) => extLink(l.url, l.tekst)).join("")}`)}
    </div>`;
  }
  // de groep uit het adres (#kerndocumenten/<groep>); onbekend of leeg: de eerste
  function kdGroep() {
    const tabs = kdTabs(), gevraagd = location.hash.slice(1).split("?")[0].split("/")[1];
    return (tabs.find((g) => g.id === gevraagd) || tabs[0] || {}).id;
  }
  // elke groep is een eigen pagina (menu Documenten); de titel is de naam van de groep, zonder ondertitel (Tobias, 23 nov 2026)
  function kerndocumentenPagina() {
    const groep = kdGroep(), g = kdTabs().find((x) => x.id === groep) || {};
    return tabelPagina(kerndocDef(groep), paginaKop(g.label || "Kerndocumenten"), "", "Zoek op titel, afkorting, uitgever of kenmerk");
  }

  function over() {
    const m = S.data.meta;
    return `<h1>Over MilieuRadar</h1>
      <div class="card tekstkaart">
        <p>MilieuRadar volgt Nederlands milieubeleid in het parlement: wetsvoorstellen, moties en amendementen met de stemming per fractie, de agenda van de Kamer met samenvattingen van debatten, Kamervragen met de antwoorden, en Kamerbrieven. Alle fracties krijgen evenveel ruimte.</p>
        <h3>Hoe het werkt</h3>
        <ul>
          <li><b>Automatisch:</b> een script haalt moties, amendementen, stemmingen, activiteiten, Kamerbrieven, Kamervragen en de antwoorden daarop, uitstelberichten en verzoeken van Kamercommissies op uit de <a href="https://opendata.tweedekamer.nl">open data van de Tweede Kamer</a>. Daar komt geen AI aan te pas.</li>
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
      const f = $(".werkbalk");
      if (f && f.getBoundingClientRect().top < 0) f.scrollIntoView({ block: "start", behavior: minderBeweging() ? "auto" : "smooth" });
    } else location.hash = `#agenda?thema=${encodeURIComponent(id)}`;
  }, true);
  init();
})();
