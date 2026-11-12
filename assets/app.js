/* Milieubeleid-checker: leest de JSON-bestanden in data/ en tekent de pagina. Geen build-stap nodig. */
(function () {
  "use strict";
  const S = { sector: "alle", data: null, motieFilter: { q: "", soort: "", uitslag: "", fractie: "", dossier: "" },
    dossierFilter: "", debatOrde: "nieuw", agendaOrde: "oud" };
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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
  // "hh:mm dd/mm/yyyy" in Nederlandse tijd
  function fmtTijdstip(d) {
    const p = Object.fromEntries(new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric", hour12: false })
      .formatToParts(d).map((x) => [x.type, x.value]));
    return `${p.hour}:${p.minute} ${p.day}/${p.month}/${p.year}`;
  }
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
    const [config, dossiers, debatten, agenda, zaken, activiteiten, meta] = await Promise.all([
      load("pipeline/config.json", { sectoren: {} }),
      load("data/dossiers.json", { fasen: [], dossiers: [] }),
      load("data/debatten.json", { debatten: [] }),
      load("data/agenda.json", { items: [] }),
      load("data/tk/zaken.json", []),
      load("data/tk/activiteiten.json", []),
      load("data/tk/meta.json", {}),
    ]);
    S.data = { config, dossiers, debatten: debatten.debatten, agenda: agenda.items, zaken, activiteiten, meta };
    // meest recente moment waarop data of samenvattingen zijn bijgewerkt
    const stempels = [meta.bijgewerkt, debatten.bijgewerkt, dossiers.bijgewerkt, agenda.bijgewerkt].filter(Boolean).map((t) => new Date(t)).filter((d) => !isNaN(d));
    $("#stamp").textContent = stempels.length ? `Laatste update: ${fmtTijdstip(new Date(Math.max(...stempels)))}` : "Laatste update: onbekend";
    renderSectorFilter();
    window.addEventListener("hashchange", route);
    route();
  }

  function inSector(item) {
    if (S.sector === "alle") return true;
    const s = item.sectoren || (item.sector ? [item.sector] : []);
    return s.includes(S.sector);
  }

  function renderSectorFilter() {
    const el = $("#sectorfilter");
    const sect = S.data.config.sectoren || {};
    const chips = [`<span class="label">Sector</span>`, chip("alle", "Alle sectoren", true)];
    for (const [code, s] of Object.entries(sect)) chips.push(chip(code, s.naam + (s.actief ? "" : " (binnenkort)"), s.actief));
    el.innerHTML = chips.join("");
    el.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { S.sector = b.dataset.code; renderSectorFilter(); route(); }));
    function chip(code, naam, actief) {
      return `<button class="chip" data-code="${code}" aria-pressed="${S.sector === code}" ${actief ? "" : "disabled"}>${esc(naam)}</button>`;
    }
  }

  function route() {
    const tab = (location.hash || "#overzicht").slice(1).split("/")[0] || "overzicht";
    document.querySelectorAll("nav.tabs a").forEach((a) => a.classList.toggle("active", a.dataset.tab === tab));
    const views = { overzicht, wetgeving, moties, debatten, agenda, over };
    $("#view").innerHTML = (views[tab] || overzicht)();
    if (tab === "moties") bindMoties();
    const sub = location.hash.split("/")[1];
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

  function uitslagPill(u) {
    const cls = (u || "in behandeling").replace(/\s+/g, "-");
    const icon = { aangenomen: "✓", verworpen: "✕", aangehouden: "‖", ingetrokken: "–", vervallen: "–" }[u] || "";
    return `<span class="pill ${cls}"><span class="dot" aria-hidden="true"></span>${icon} ${esc(u || "in behandeling")}</span>`;
  }
  function voteBar(t) {
    if (!t || !(t.voor + t.tegen)) return "";
    const tot = t.voor + t.tegen;
    const v = (100 * t.voor) / tot, g = 100 - v;
    const vCls = g === 0 ? "v only" : "v", tCls = v === 0 ? "t only" : "t";
    return `<div class="votebar" role="img" aria-label="${t.voor} voor, ${t.tegen} tegen">` +
      (t.voor ? `<span class="${vCls}" style="width:${v}%" title="Voor: ${t.voor} zetels"></span>` : "") +
      (t.tegen ? `<span class="${tCls}" style="width:${g}%" title="Tegen: ${t.tegen} zetels"></span>` : "") +
      `</div><div class="votelegend"><span><i style="background:var(--voor)"></i>Voor ${t.voor}</span><span><i style="background:var(--tegen)"></i>Tegen ${t.tegen}</span>${t.datum ? `<span>${fmtDatum(t.datum)}</span>` : ""}</div>`;
  }
  function indienersTekst(z) {
    const eerste = z.indieners.find((i) => /^indiener|eerste/i.test(i.relatie || "")) || z.indieners[0];
    if (!eerste) return "";
    const mede = z.indieners.length - 1;
    return `${esc(eerste.naam)}${eerste.fractie ? ` (${esc(eerste.fractie)})` : ""}${mede > 0 ? ` c.s. (+${mede})` : ""}`;
  }
  const korteTitel = (z) => { const t = z.onderwerp || z.titel || ""; return /^(nader )?(gewijzigde )?(motie|amendement)\b/i.test(t) ? t.replace(/^.*? over /i, "") : t; };
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
    return `<span class="dchips">${ids.map((id) => `<button type="button" class="dchip" data-setdossier="${esc(id)}" aria-pressed="${S.dossierFilter === id}" title="Toon alles bij dit dossier">${esc(dossierTitel(id))}</button>`).join("")}</span>`;
  }

  // Filterbalk: dossierkeuze (met aantallen) en ordening. items = lijst van [ids] om te tellen.
  function dossierBalk(idLijsten, ordeKey, ordeOpties) {
    const tel = {};
    for (const ids of idLijsten) for (const id of ids) tel[id] = (tel[id] || 0) + 1;
    const opts = alleDossiers().filter((d) => S.sector === "alle" || d.sectoren.includes(S.sector));
    const groep = (g) => {
      const o = opts.filter((d) => d.groep === g && (tel[d.id] || S.dossierFilter === d.id));
      return o.length ? `<optgroup label="${g}">${o.map((d) => `<option value="${esc(d.id)}" ${S.dossierFilter === d.id ? "selected" : ""}>${esc(d.titel)} (${tel[d.id] || 0})</option>`).join("")}</optgroup>` : "";
    };
    return `<div class="filters dossierbalk">
      <label class="label" for="dsel">Dossier</label>
      <select id="dsel"><option value="">Alle dossiers (${idLijsten.length})</option>${groep("Beleidsdossiers")}${groep("Wetgeving")}</select>
      <label class="label" for="dorde">Ordenen</label>
      <select id="dorde" data-key="${ordeKey}">${ordeOpties.map(([v, l]) => `<option value="${v}" ${S[ordeKey] === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      ${S.dossierFilter ? `<button type="button" class="chip" data-setdossier="">Filter wissen ✕</button>` : ""}
    </div>`;
  }
  function bindDossierBalk() {
    const sel = $("#dsel"), orde = $("#dorde");
    if (sel) sel.addEventListener("change", () => { S.dossierFilter = sel.value; route(); });
    if (orde) orde.addEventListener("change", () => { S[orde.dataset.key] = orde.value; route(); });
  }
  // Groepeert items per dossier (een item kan in meerdere groepen staan); items zonder dossier onderaan.
  function perDossier(items, idsVan, render) {
    const opts = alleDossiers().filter((d) => !S.dossierFilter || d.id === S.dossierFilter);
    const blokken = opts.map((d) => [d, items.filter((x) => idsVan(x).includes(d.id))]).filter(([, l]) => l.length)
      .map(([d, l]) => `<h3 class="groepkop">${esc(d.titel)} <span class="muted small">(${l.length})</span></h3>${render(l)}`);
    const zonder = S.dossierFilter ? [] : items.filter((x) => !idsVan(x).length);
    if (zonder.length) blokken.push(`<h3 class="groepkop">Zonder dossier <span class="muted small">(${zonder.length})</span></h3>${render(zonder)}`);
    return blokken.join("") || `<p class="empty">Niets gevonden.</p>`;
  }

  /* ---------- Overzicht ---------- */
  function overzicht() {
    const ma = motiesEnAmendementen();
    const moties = ma.filter((z) => z.soort === "Motie");
    const aangenomen = moties.filter((z) => z.uitslag === "aangenomen").length;
    const besloten = moties.filter((z) => ["aangenomen", "verworpen"].includes(z.uitslag)).length;
    const dos = S.data.dossiers.dossiers.filter(inSector);
    const lopend = dos.filter((d) => faseIndex(d.fase) < faseIndex("staatsblad")).length;
    const deb = S.data.debatten.filter(inSector);
    const acts = S.data.activiteiten.filter((a) => inSector(a) && isDebat(a) && a.Status === "Uitgevoerd");
    const prio = dos.filter((d) => d.prioriteit);

    const recentStem = ma.filter((z) => z.stemtelling).sort((a, b) => (b.stemtelling.datum || "").localeCompare(a.stemtelling.datum || "")).slice(0, 6);
    const komend = agendaItems().filter((i) => sortKey(i.datum) >= VANDAAG).slice(0, 6);

    return `
      <div class="grid kpi">
        ${tile(lopend, "wetsvoorstellen in voorbereiding of behandeling", "#wetgeving")}
        ${tile(moties.length, "moties sinds begin Kamerperiode", "#moties")}
        ${tile(besloten ? Math.round((100 * aangenomen) / besloten) + "%" : "–", `van de ${besloten} moties waarover is gestemd aangenomen`, "#moties")}
        ${tile(`${deb.length}<span class="muted" style="font-size:18px"> / ${Math.max(acts.length, deb.length)}</span>`, "debatten samengevat (van uitgevoerde activiteiten)", "#debatten")}
      </div>
      ${prio.map((d) => `<h2>Aandachtsdossier</h2>${dossierCard(d, true)}`).join("")}
      <div class="grid two">
        <div><h2>Recente stemmingen</h2><div class="card"><ul class="list">
          ${recentStem.map((z) => `<li>${uitslagPill(z.uitslag)} <span class="tag">${esc(z.soort)}</span><div>${esc(korteTitel(z))}</div><div class="small muted">${indienersTekst(z)}</div>${voteBar(z.stemtelling)}</li>`).join("") || `<li class="empty">Nog geen stemmingen.</li>`}
        </ul><a class="small" href="#moties">Alle moties en amendementen →</a></div></div>
        <div><h2>Komt eraan</h2><div class="card"><ul class="list">
          ${komend.map((i) => agendaLi(i)).join("") || `<li class="empty">Niets gepland.</li>`}
        </ul><a class="small" href="#agenda">Volledige agenda →</a></div>
        <h2>Laatste samenvattingen</h2><div class="card"><ul class="list">
          ${deb.slice().sort((a, b) => b.datum.localeCompare(a.datum)).slice(0, 3).map((d) => `<li><span class="tag">${esc(d.type)}</span> <b>${esc(d.titel)}</b> <span class="small muted">${fmtDatum(d.datum)}</span><div class="small">${esc(d.gist)}</div><a class="small" href="#debatten/d-${d.id}">Lees de samenvatting →</a></li>`).join("")}
        </ul></div></div>
      </div>`;
    function tile(n, lbl, href) { return `<a class="card tile" href="${href}" style="text-decoration:none;color:inherit"><div class="num">${n}</div><div class="lbl">${lbl}</div></a>`; }
  }

  /* ---------- Wetgeving ---------- */
  function dossierCard(d, compact) {
    const fasen = S.data.dossiers.fasen;
    const idx = faseIndex(d.fase);
    const gekoppeld = d.kamerstuk ? S.data.zaken.filter((z) => (z.soort === "Motie" || z.soort === "Amendement") && z.dossiers.some((x) => String(x.nummer) === String(d.kamerstuk))) : [];
    const deb = uniek([...(d.debatten || []).map((id) => S.data.debatten.find((x) => x.id === id)),
      ...S.data.debatten.filter((x) => dossiersVanDebat(x).includes(d.id))]).filter(Boolean).sort((a, b) => b.datum.localeCompare(a.datum));
    return `<div class="card ${d.prioriteit ? "prio" : ""}" id="w-${esc(d.id)}">
      <div class="small muted">${esc(d.type)}${d.kamerstuk ? ` · Kamerstuk ${esc(d.kamerstuk)}` : " · nog geen Kamerstuknummer"} · ${esc(d.thema || "")}</div>
      <h3>${esc(d.titel)}</h3>
      <div class="stepper" title="Fase: ${esc(fasen[idx]?.naam || d.fase)}">${fasen.map((f, i) => `<span class="st ${i < idx ? "done" : i === idx ? "now" : ""}"></span>`).join("")}</div>
      <div class="steplabels">${fasen.map((f, i) => `<span class="${i === idx ? "now" : "hide-sm"}">${esc(f.naam)}</span>`).join("")}</div>
      <p>${esc(d.samenvatting)}</p>
      <dl class="facts">
        ${d.laatsteStap ? `<dt>Laatste stap</dt><dd>${fmtDatum(d.laatsteStap.datum)}: ${esc(d.laatsteStap.tekst)}</dd>` : ""}
        ${d.volgendeStap ? `<dt>Volgende stap</dt><dd>${fmtDatum(d.volgendeStap.datum)}: ${esc(d.volgendeStap.tekst)}</dd>` : ""}
        ${d.deadline ? `<dt>Deadline</dt><dd><b>${fmtDatum(d.deadline.datum)}</b>: ${esc(d.deadline.tekst)}</dd>` : ""}
        ${(d.stemmingen || []).map((s) => `<dt>Stemming ${esc(s.kamer)}</dt><dd>${fmtDatum(s.datum)}: ${esc(s.uitslag)}</dd>`).join("")}
      </dl>
      ${!compact && d.kanttekeningen?.length ? `<h3 style="margin-top:12px">Kanttekeningen</h3><ul>${d.kanttekeningen.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>` : ""}
      ${deb.length ? `<div class="small" style="margin-top:10px">Debatten: ${deb.map((x) => `<a href="#debatten/d-${x.id}">${esc(x.titel)} (${fmtDatum(x.datum)})</a>`).join(" · ")}</div>` : ""}
      ${gekoppeld.length ? `<div class="small">Moties/amendementen bij dit dossier: <a href="#moties" data-dossier="${esc(d.kamerstuk)}">${gekoppeld.length}</a></div>` : ""}
      <div class="small"><a href="#debatten" data-setdossier="${esc(d.id)}">Alle debatten bij dit dossier →</a> · <a href="#agenda" data-setdossier="${esc(d.id)}">Agenda →</a></div>
      ${!compact && d.bronnen?.length ? `<div class="small muted" style="margin-top:8px">Bronnen: ${d.bronnen.map((b) => `<a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.titel)}</a>`).join(" · ")}</div>` : ""}
      ${compact ? `<div class="small" style="margin-top:8px"><a href="#wetgeving/w-${esc(d.id)}">Volledig dossier →</a></div>` : ""}
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
        ${extra.map((z) => `<tr><td>${dossierLabel(z)}</td><td><a href="${esc(z.link)}" target="_blank" rel="noopener">${esc(z.titel || z.onderwerp)}</a></td><td>${fmtDatum(z.gestartOp)}</td><td>${uitslagPill(z.uitslag)}</td></tr>`).join("")}
      </tbody></table></div>` : ""}`;
  }

  /* ---------- Moties ---------- */
  function moties() {
    const all = motiesEnAmendementen();
    const fracties = [...new Set(all.flatMap((z) => z.indieners.map((i) => i.fractie)).filter(Boolean))].sort();
    const dossiers = [...new Set(all.flatMap((z) => z.dossiers.map((d) => `${d.nummer}${d.toevoeging ? "-" + d.toevoeging : ""}|${d.titel || ""}`)))].sort();
    const f = S.motieFilter;
    const opt = (v, l, cur) => `<option value="${esc(v)}" ${v === cur ? "selected" : ""}>${esc(l)}</option>`;
    return `<h2>Moties &amp; amendementen</h2>
      <div class="filters">
        <input type="search" id="mq" placeholder="Zoek op onderwerp of Kamerlid" value="${esc(f.q)}" aria-label="Zoeken">
        <select id="msoort" aria-label="Soort">${opt("", "Alle soorten", f.soort)}${opt("Motie", "Moties", f.soort)}${opt("Amendement", "Amendementen", f.soort)}</select>
        <select id="muitslag" aria-label="Uitslag">${opt("", "Elke uitslag", f.uitslag)}${["aangenomen", "verworpen", "aangehouden", "ingetrokken", "in behandeling"].map((u) => opt(u, u, f.uitslag)).join("")}</select>
        <select id="mfractie" aria-label="Fractie indiener">${opt("", "Elke fractie (indiener)", f.fractie)}${fracties.map((x) => opt(x, x, f.fractie)).join("")}</select>
        <select id="mdossier" aria-label="Dossier">${opt("", "Elk dossier", f.dossier)}${dossiers.map((x) => { const [n, t] = x.split("|"); return opt(n, `${n} ${t.slice(0, 50)}`, f.dossier); }).join("")}</select>
      </div>
      <div class="small muted" id="mcount"></div>
      <div class="tablewrap"><table><thead><tr><th>Uitslag</th><th>Onderwerp</th><th class="hide-sm">Indiener</th><th class="hide-sm">Dossier</th><th>Datum</th></tr></thead><tbody id="mbody"></tbody></table></div>
      <p class="small muted">Klik op een rij voor de stemming per fractie en de link naar het document. Uitslag en stemmen komen rechtstreeks uit de open data van de Tweede Kamer.</p>`;
  }
  function bindMoties() {
    const f = S.motieFilter;
    const upd = () => {
      f.q = $("#mq").value; f.soort = $("#msoort").value; f.uitslag = $("#muitslag").value; f.fractie = $("#mfractie").value; f.dossier = $("#mdossier").value;
      const q = f.q.toLowerCase();
      const rows = motiesEnAmendementen().filter((z) =>
        (!f.soort || z.soort === f.soort) && (!f.uitslag || z.uitslag === f.uitslag) &&
        (!f.fractie || z.indieners.some((i) => i.fractie === f.fractie)) &&
        (!f.dossier || z.dossiers.some((d) => `${d.nummer}${d.toevoeging ? "-" + d.toevoeging : ""}` === f.dossier)) &&
        (!q || `${z.onderwerp} ${z.titel} ${z.indieners.map((i) => i.naam + " " + i.fractie).join(" ")}`.toLowerCase().includes(q))
      ).sort((a, b) => ((b.stemtelling?.datum || b.gestartOp) || "").localeCompare((a.stemtelling?.datum || a.gestartOp) || ""));
      $("#mcount").textContent = `${rows.length} resultaten`;
      $("#mbody").innerHTML = rows.map((z, i) => `<tr class="row" data-i="${i}" tabindex="0"><td>${uitslagPill(z.uitslag)}</td><td><span class="tag">${esc(z.soort)}</span> ${esc(korteTitel(z))}${z.kabinetsappreciatie && !/nog niet bekend|niet beschikbaar/i.test(z.kabinetsappreciatie) ? `<div class="small muted">Kabinet: ${esc(z.kabinetsappreciatie)}</div>` : ""}</td><td class="hide-sm">${indienersTekst(z)}</td><td class="hide-sm">${dossierLabel(z)}</td><td>${fmtDatum(z.stemtelling?.datum || z.gestartOp)}</td></tr>`).join("") || `<tr><td colspan="5" class="empty">Geen resultaten.</td></tr>`;
      $("#mbody").querySelectorAll("tr.row").forEach((tr) => {
        const open = () => {
          const nxt = tr.nextElementSibling;
          if (nxt && nxt.classList.contains("detail")) { nxt.remove(); return; }
          const z = rows[+tr.dataset.i];
          const d = document.createElement("tr"); d.className = "detail";
          d.innerHTML = `<td colspan="5">${motieDetail(z)}</td>`;
          tr.after(d);
        };
        tr.addEventListener("click", open);
        tr.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
      });
    };
    ["#mq", "#msoort", "#muitslag", "#mfractie", "#mdossier"].forEach((s) => $(s).addEventListener("input", upd));
    upd();
  }
  function motieDetail(z) {
    const b = [...z.besluiten].reverse().find((x) => x.stemmen.length);
    const groep = (soort) => b ? b.stemmen.filter((s) => s.soort === soort).map((s) => `${esc(s.fractie)}${s.zetels && !/hoofdelijk/i.test(b.stemmingssoort || "") ? ` (${s.zetels})` : ""}`).join(", ") : "";
    return `<div><b>${esc(z.onderwerp || z.titel)}</b></div>
      <div class="small muted">Zaak ${esc(z.nummer)} · ingediend ${fmtDatum(z.gestartOp)} · indieners: ${z.indieners.map((i) => `${esc(i.naam)} (${esc(i.fractie)})`).join(", ") || "onbekend"}</div>
      ${voteBar(z.stemtelling)}
      ${b ? `<div class="fracties"><span class="k">Voor</span><span>${groep("Voor") || "–"}</span><span class="k">Tegen</span><span>${groep("Tegen") || "–"}</span>${groep("Niet deelgenomen") ? `<span class="k">Niet deelgenomen</span><span>${groep("Niet deelgenomen")}</span>` : ""}</div>` : `<div class="small muted">Nog geen stemming.</div>`}
      ${z.besluiten.length ? `<div class="small" style="margin-top:8px">Besluiten: ${z.besluiten.map((x) => `${x.datum ? fmtDatum(x.datum) + ": " : ""}${esc(x.tekst)}`).join(" · ")}</div>` : ""}
      <div class="small" style="margin-top:6px"><a href="${esc(z.link)}" target="_blank" rel="noopener">Bekijk op OpenTK →</a></div>`;
  }

  /* ---------- Debatten ---------- */
  const activiteitVan = (d) => S.data.activiteiten.find((a) => a.Nummer === d.activiteit);
  function samengevatVoor(a) {
    return S.data.debatten.find((d) => d.activiteit === a.Nummer) ||
      S.data.debatten.find((d) => !d.activiteit && d.datum === (a.Datum ? dagNL(new Date(a.Datum)) : "") && d.type === a.Soort);
  }

  // Agendabalk: 2 eerdere debatten, vandaag in het midden, 2 komende; pijlen schuiven één debat op
  function agendaLijst() {
    const ev = S.data.activiteiten
      .filter((a) => inSector(a) && isDebat(a) && a.Datum && (a.Status === "Gepland" || a.Status === "Uitgevoerd"))
      .filter((a) => pastBijFilter(uniek([...dossiersVanActiviteit(a), ...((samengevatVoor(a) || {}).dossiers || [])])))
      .map((a) => ({ a, dag: dagNL(new Date(a.Datum)), t: a.Datum }))
      .sort((x, y) => x.t.localeCompare(y.t));
    let mid = ev.findIndex((e) => e.dag === VANDAAG);
    if (mid === -1) {
      mid = ev.findIndex((e) => e.dag > VANDAAG);
      if (mid === -1) mid = ev.length;
      ev.splice(mid, 0, { leeg: true, dag: VANDAAG });
    }
    return { ev, mid };
  }
  function agendaBalk() {
    const { ev, mid } = agendaLijst();
    const c = Math.min(Math.max(mid + (S.agendaOffset || 0), 0), ev.length - 1);
    const slots = [-2, -1, 0, 1, 2].map((k) => ev[c + k]);
    const slot = (e, k) => {
      const pos = k === 0 ? "midden" : Math.abs(k) === 2 ? "buiten" : "";
      if (!e) return `<div class="slot leeg ${pos}"></div>`;
      const d = new Date(e.dag + "T12:00:00");
      const kop = `<div class="dag">${e.dag === VANDAAG ? "Vandaag" : WEEKDAGEN[d.getDay()]}</div><div class="datum">${+e.dag.slice(8)} ${MAANDEN[+e.dag.slice(5, 7) - 1].slice(0, 3)} ${e.dag.slice(0, 4)}${e.a ? ` · ${tijdNL(e.a.Datum)}` : ""}</div>`;
      const vandaag = e.dag === VANDAAG ? "vandaag" : "";
      if (e.leeg) return `<div class="slot ${vandaag} ${pos}">${kop}<div class="titel muted">Geen debat vandaag</div></div>`;
      const sam = samengevatVoor(e.a);
      const href = sam ? `#debatten/d-${sam.id}` : e.a.tkLink;
      return `<a class="slot ${vandaag} ${pos}" href="${esc(href)}" ${sam ? "" : 'target="_blank" rel="noopener"'} title="${esc(e.a.Onderwerp)}">${kop}
        <div class="soort">${esc(soortLabel(e.a))}${sam ? ` <span class="badge">samenvatting</span>` : ""}</div>
        <div class="titel">${esc(e.a.Onderwerp)}</div><div class="com">${esc(commissieNaam(e.a))}</div></a>`;
    };
    return `<div class="agendabalk" id="agendabalk" aria-label="Agenda debatten">
      <button class="pijl" data-stap="-1" ${c <= 0 ? "disabled" : ""} aria-label="Eerder debat"><span aria-hidden="true">‹</span><small>Eerder</small></button>
      ${slots.map((e, i) => slot(e, i - 2)).join("")}
      <button class="pijl" data-stap="1" ${c >= ev.length - 1 ? "disabled" : ""} aria-label="Later debat"><small>Later</small><span aria-hidden="true">›</span></button>
    </div>`;
  }
  function bindAgendaBalk() {
    const el = document.getElementById("agendabalk");
    if (!el) return;
    el.querySelectorAll("button.pijl").forEach((b) => b.addEventListener("click", () => {
      S.agendaOffset = (S.agendaOffset || 0) + +b.dataset.stap;
      el.outerHTML = agendaBalk();
      bindAgendaBalk();
    }));
  }

  function debatten() {
    const desc = S.debatOrde !== "oud";
    const cmp = (x, y) => desc ? y.localeCompare(x) : x.localeCompare(y);
    const alleDeb = S.data.debatten.filter(inSector);
    const alleOpen = S.data.activiteiten.filter((a) => inSector(a) && isDebat(a) && a.Status === "Uitgevoerd" && !samengevatVoor(a));
    const deb = alleDeb.filter((d) => pastBijFilter(dossiersVanDebat(d))).sort((a, b) => cmp(a.datum, b.datum));
    const open = alleOpen.filter((a) => pastBijFilter(dossiersVanActiviteit(a))).sort((a, b) => cmp(a.Datum || "", b.Datum || ""));
    const perD = S.debatOrde === "dossier";
    const kaarten = (l) => `<div class="grid">${l.map(debatCard).join("")}</div>`;
    const tabel = (l) => `<div class="tablewrap"><table><thead><tr><th>Datum</th><th>Soort</th><th>Onderwerp</th><th class="hide-sm">Commissie</th></tr></thead><tbody>
        ${l.map((a) => `<tr><td>${fmtDatum(a.Datum ? dagNL(new Date(a.Datum)) : null)}</td><td>${esc(soortLabel(a))}</td><td><a href="${esc(a.tkLink)}" target="_blank" rel="noopener">${esc(a.Onderwerp)}</a><div>${dossierChips(dossiersVanActiviteit(a))}</div></td><td class="hide-sm">${esc(commissieNaam(a))}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">${S.dossierFilter ? "Niets bij dit dossier." : "Alles is samengevat."}</td></tr>`}
      </tbody></table></div>`;
    setTimeout(bindDebatten, 0);
    return `${dossierBalk([...alleDeb.map(dossiersVanDebat), ...alleOpen.map(dossiersVanActiviteit)], "debatOrde",
        [["nieuw", "Nieuwste eerst"], ["oud", "Oudste eerst"], ["dossier", "Per dossier"]])}
      <h2>Agenda</h2>${agendaBalk()}
      <h2>Samengevatte debatten <span class="muted small">(${deb.length})</span></h2>
      <p class="muted small">Klik op een debat voor aanleiding, agendapunten, samenvatting, standpunten, toezeggingen en deelnemers. Klik op een dossierlabel om alles bij dat dossier te zien. Samenvattingen zijn gebaseerd op automatische transcripten; geen officiële bron.</p>
      ${deb.length ? (perD ? perDossier(deb, dossiersVanDebat, kaarten) : kaarten(deb)) : `<p class="empty">Nog geen samenvattingen${S.dossierFilter ? " bij dit dossier" : ""}.</p>`}
      <h2>Nog niet samengevat <span class="muted small">(${open.length})</span></h2>
      ${perD && open.length ? perDossier(open, dossiersVanActiviteit, tabel) : tabel(open)}`;
  }
  function bindDebatten() {
    bindAgendaBalk();
    bindDossierBalk();
    document.querySelectorAll(".debat .toggle").forEach((b) => b.addEventListener("click", () => {
      const kaart = b.closest(".debat");
      kaart.classList.toggle("open");
      b.setAttribute("aria-expanded", kaart.classList.contains("open"));
    }));
  }

  function stukRegel(st) {
    const wie = st.ondertekenaar ? ` - ${esc(st.ondertekenaar)}${st.functie ? ", " + esc(st.functie) : ""}` : "";
    return `<li>${st.kamerstuk ? `<a href="${esc(st.link)}" target="_blank" rel="noopener">${esc(st.kamerstuk)}</a> ` : `<a href="${esc(st.link)}" target="_blank" rel="noopener">document</a> `}${esc(st.soort || "")}${st.datum ? ` d.d. ${fmtDatum(st.datum)}` : ""}${wie}: ${esc(st.onderwerp || "")}</li>`;
  }

  function debatCard(d) {
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
    const standpunten = (s.partijen || []).map((p) => `<div class="party"><b>${esc(p.fractie)}</b> <span class="muted small">${esc(p.spreker)}</span><div>${esc(p.positie)}</div>${p.link ? `<a class="small" href="${esc(p.link)}" target="_blank" rel="noopener">Terugluisteren →</a>` : ""}</div>`).join("")
      + ((s.kabinet || []).length ? `<div class="party"><b>Kabinet</b> <span class="muted small">${esc(d.bewindspersoon || "")}</span>${lijst(s.kabinet)}</div>` : "");
    const toezeggingen = ((s.toezeggingen || []).length ? lijst(s.toezeggingen) : "") +
      ((s.doorgeleid || []).length ? `<div class="small muted">Doorgeleid:</div>${lijst(s.doorgeleid)}` : "");
    const tkLink = a.tkLink || d.tkLink;
    return `<article class="card debat" id="d-${esc(d.id)}">
      <div class="meta">${esc(commissie || "")} · ${fmtDatum(d.datum)}</div>
      <div class="titelrij"><span class="tag">${esc(d.type)}</span><h3>${esc(d.titel)}</h3>${d.niveau === "kort" ? ` <span class="tag" title="Korte samenvatting: alleen de hoofdlijn">kort</span>` : ""}</div>
      ${dossierChips(dossiersVanDebat(d))}
      <div class="links">
        ${d.video ? `<a href="${esc(d.video)}" target="_blank" rel="noopener">▶ Terugkijken op Debat Direct</a>` : ""}
        ${tkLink ? `<a href="${esc(tkLink)}" target="_blank" rel="noopener">Pagina Tweede Kamer</a>` : ""}
        <a href="${esc(d.bron)}" target="_blank" rel="noopener">Transcript</a>
      </div>
      <button class="toggle" aria-expanded="false" aria-controls="b-${esc(d.id)}"><span class="pijltje" aria-hidden="true">▾</span><span class="dicht">Toon samenvatting</span><span class="opn">Verberg samenvatting</span></button>
      <div class="body" id="b-${esc(d.id)}">
        ${blok("Aanzet", d.aanzet ? `<p>${esc(d.aanzet)}</p>` : "")}
        ${blok("Agendapunten", agendapunten)}
        ${blok("Kern", `<p>${esc(d.gist)}</p>${(s.kern || []).length ? lijst(s.kern) : ""}`)}
        ${blok("Standpunten fracties", standpunten)}
        ${blok("Toezeggingen", toezeggingen || `<p class="muted">Geen toezeggingen.</p>`)}
        ${blok("Moties", s.moties ? `<p>${esc(s.moties)}</p>` : "")}
        ${blok("Vervolg", (s.vervolg || []).length ? lijst(s.vervolg) : "")}
        ${blok("Deelnemers", deelnemers ? `<div class="deelnemers">${deelnemers}</div>` : "")}
        <div class="small muted" style="margin-top:12px">${d.niveau === "kort" ? "Korte samenvatting" : "Samengevat"} door ${esc(d.samengevatDoor)} op ${fmtDatum(d.samengevatOp)} op basis van het automatische transcript.</div>
      </div>
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
    return `<li><b>${fmtDatum(i.datum)}</b>${i.tijd ? ` ${esc(i.tijd)}` : ""} <span class="tag">${esc(i.type)}</span><div>${i.url ? `<a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.titel)}</a>` : esc(i.titel)}</div>${i.commissie ? `<div class="small muted">${esc(i.commissie)}</div>` : ""}${chips ? dossierChips(dossiersVanAgendaItem(i)) : ""}</li>`;
  }
  function agenda() {
    const alle = agendaItems().filter((i) => sortKey(i.datum) >= VANDAAG);
    let items = alle.filter((i) => pastBijFilter(dossiersVanAgendaItem(i)));
    if (S.agendaOrde === "nieuw") {
      // verste eerst, maar items zonder datum blijven onderaan
      const zonder = items.filter((i) => !i.datum);
      items = items.filter((i) => i.datum).reverse().concat(zonder);
    }
    const lijst = (l) => `<div class="card"><ul class="list">${l.map((i) => agendaLi(i, true)).join("") || `<li class="empty">Niets gepland${S.dossierFilter ? " bij dit dossier" : ""}.</li>`}</ul></div>`;
    setTimeout(bindDossierBalk, 0);
    return `${dossierBalk(alle.map(dossiersVanAgendaItem), "agendaOrde", [["oud", "Eerstvolgende eerst"], ["nieuw", "Verste eerst"], ["dossier", "Per dossier"]])}
      <h2>Agenda</h2><p class="muted small">Geplande Kameractiviteiten (automatisch) plus mijlpalen en deadlines. Activiteiten zonder datum staan onderaan. Klik op een dossierlabel om alleen dat dossier te zien.</p>
      ${S.agendaOrde === "dossier" ? perDossier(items, dossiersVanAgendaItem, lijst) : lijst(items)}`;
  }

  /* ---------- Over ---------- */
  function over() {
    const m = S.data.meta;
    return `<h2>Over deze checker</h2>
      <div class="card">
        <p>Deze checker volgt Nederlands milieubeleid in het parlement: de fase van wetsvoorstellen, moties en amendementen met de stemming per fractie, samenvattingen van debatten en wat er op de agenda staat. Alle fracties krijgen evenveel ruimte.</p>
        <h3>Hoe het werkt</h3>
        <ul>
          <li><b>Automatisch:</b> een script haalt moties, amendementen, stemmingen en activiteiten op uit de <a href="https://opendata.tweedekamer.nl">open data van de Tweede Kamer</a>. Daar komt geen AI aan te pas.</li>
          <li><b>Samenvattingen:</b> debatten worden door Claude samengevat op basis van automatische transcripten van <a href="https://gehoord.de/beraadslagingen">gehoord.de</a>. Die transcripten zijn niet door mensen gecorrigeerd en sprekers kunnen er soms een paar seconden naast zitten. Gebruik de links om na te luisteren en citeer de Handelingen.</li>
          <li><b>Wetgevingsdossiers</b> worden handmatig bijgehouden met bronvermelding.</li>
        </ul>
        <h3>Status</h3>
        <dl class="facts"><dt>Kamerdata</dt><dd>${m.bijgewerkt ? fmtDatum(m.bijgewerkt) : "nog niet opgehaald"} (${m.aantalZaken ?? 0} zaken, ${m.aantalActiviteiten ?? 0} activiteiten)</dd>
        <dt>Periode</dt><dd>vanaf ${fmtDatum(S.data.config.startdatum)}</dd>
        ${m.fouten?.length ? `<dt>Meldingen</dt><dd>${m.fouten.map(esc).join("<br>")}</dd>` : ""}</dl>
      </div>`;
  }

  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-dossier]");
    if (a) { S.motieFilter.dossier = a.dataset.dossier; }
    const b = e.target.closest("[data-setdossier]");
    if (b) {
      const id = b.dataset.setdossier;
      // nogmaals klikken op het actieve label wist het filter
      S.dossierFilter = b.classList.contains("dchip") && S.dossierFilter === id ? "" : id;
      if (b.tagName !== "A") { e.preventDefault(); e.stopPropagation(); route(); }
    }
  }, true);
  init();
})();
