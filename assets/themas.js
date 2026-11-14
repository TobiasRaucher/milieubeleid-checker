/* MilieuRadar: de vaste thema-indeling (THEMAS), de regels die thema's voorstellen, de goedgekeurde mapping
   (data/themas-mapping.json) en één lijst van alle items die een thema kunnen krijgen.
   Werkt in de browser (window.MRThemas) en in Node (pipeline/themas_review.js, pipeline/themas_noscript.js). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MRThemas = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // De vaste taxonomie. Volgorde is de volgorde op de site. Geen kleur of icoon per thema (DESIGN.md, "Themes").
  const THEMAS = Object.freeze([
    { slug: "energie-klimaat", label: "Energie & klimaat", volgorde: 1,
      description: "Klimaatdoelen en de Klimaatwet, uitstoot van broeikasgassen, het energiesysteem, het stroomnet, gas, kernenergie en duurzame energie." },
    { slug: "industrie-circulaire-economie", label: "Industrie & circulaire economie", volgorde: 2,
      description: "Verduurzaming van de industrie en maatwerkafspraken, grondstoffen, afval en recycling, en chemische stoffen zoals pfas." },
    { slug: "mobiliteit-infrastructuur", label: "Mobiliteit & infrastructuur", volgorde: 3,
      description: "Wegverkeer, openbaar vervoer, luchtvaart en scheepvaart, en de infrastructuur waarover dat gaat." },
    { slug: "gebouwde-omgeving", label: "Gebouwde omgeving", volgorde: 4,
      description: "Woningen en gebouwen: bouwen, isoleren en verwarmen, en de verduurzaming van de bestaande voorraad." },
    { slug: "landbouw-natuur-stikstof", label: "Landbouw, natuur & stikstof", volgorde: 5,
      description: "Stikstof, mest en veehouderij, gewasbescherming, natuurherstel, Natura 2000 en biodiversiteit." },
    { slug: "water-bodem", label: "Water & bodem", volgorde: 6,
      description: "Waterkwaliteit, drinkwater en grondwater, de Kaderrichtlijn Water, bodemkwaliteit en bodemdaling." },
    { slug: "luchtkwaliteit", label: "Luchtkwaliteit", volgorde: 7,
      description: "Fijnstof, luchtverontreiniging en uitstoot van schadelijke stoffen naar de lucht, en de gevolgen voor gezondheid." },
    { slug: "oceanen", label: "Oceanen", volgorde: 8,
      description: "De Noordzee en de Waddenzee, visserij, mariene natuur, diepzeemijnbouw en internationale afspraken over de oceaan." },
    { slug: "adaptatie", label: "Adaptatie", volgorde: 9,
      description: "Aanpassen aan klimaatverandering: waterveiligheid en dijken, zeespiegelstijging, droogte, hitte en wateroverlast." },
    { slug: "sectoroverstijgend", label: "Sectoroverstijgend", volgorde: 10,
      description: "Beleid dat alle sectoren raakt: het stelsel van milieuwetten en de Omgevingswet, ruimtelijke ordening, vergunningverlening en handhaving, de EU-Milieuraad en brede verkenningen." },
  ]);
  const PER_SLUG = new Map(THEMAS.map((t) => [t.slug, t]));

  // tekst in kleine letters zonder accenten; de regels in data/themas.json gaan daarvan uit
  const norm = (s) => String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const sleutel = {
    zaak: (z) => "zaak:" + z.nummer,
    stuk: (s) => "stuk:" + s.id,
    debat: (nummerOfId) => "debat:" + nummerOfId,
    agenda: (i) => "agenda:" + (i.datum || "zonder-datum") + "-" + norm(i.titel).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60),
  };

  // regels: { slug: { trefwoorden: [regex], alleenZonderAndere: [regex] } }
  // mapping: { "zaak:2026Z25015": { themas: [...], bron: "..." }, ... } (platte sleutels; velden met _ worden genegeerd)
  function maak(regels, mapping) {
    const R = (regels && regels.regels) || {};
    const lijst = THEMAS.map((t) => ({
      ...t,
      re: ((R[t.slug] || {}).trefwoorden || []).map((x) => new RegExp(x)),
      reZwak: ((R[t.slug] || {}).alleenZonderAndere || []).map((x) => new RegExp(x)),
    }));
    const M = mapping || {};
    const treffers = (re, tekst) => re.filter((r) => r.test(tekst)).map((r) => r.source);

    // Voorstel op basis van de regels, met de grond ervoor.
    // zekerheid: "titel" (trefwoord in de titel), "context" (in minstens twee overige teksten), "dossier" (in de dossiertitel),
    // "zwak" (één treffer in de overige teksten: niet toegekend, wel als suggestie), "geen".
    // dossiers: titels van de Kamerstukdossiers; tellen alleen als de titel zelf niets oplevert (begrotingen alleen als suggestie)
    function voorstel(titel, overig, dossiers) {
      const t = norm(titel), rest = (overig || []).filter(Boolean).map(norm);
      const uit = [], grond = {};
      for (const th of lijst) {
        const inTitel = treffers(th.re, t);
        const inRest = rest.filter((n) => th.re.some((r) => r.test(n))).length;
        if (inTitel.length) { uit.push({ slug: th.slug, z: "titel" }); grond[th.slug] = inTitel; }
        else if (inRest >= 2) { uit.push({ slug: th.slug, z: "context" }); grond[th.slug] = [...new Set(rest.flatMap((n) => treffers(th.re, n)))]; }
      }
      // trefwoorden die alleen tellen als geen ander thema in de titel staat (bv. "milieubeleid" zonder onderwerp)
      if (!uit.some((x) => x.z === "titel")) for (const th of lijst) {
        if (uit.some((x) => x.slug === th.slug)) continue;
        const zw = treffers(th.reZwak, t);
        if (zw.length) { uit.push({ slug: th.slug, z: "titel" }); grond[th.slug] = zw; }
      }
      if (uit.length) {
        const z = uit.some((x) => x.z === "titel") ? "titel" : "context";
        return { themas: sorteer(uit.map((x) => x.slug)), zekerheid: z, grond, suggestie: [] };
      }
      const dos = (dossiers || []).filter(Boolean).map(norm);
      // begrotingen en verzameldossiers van EU-raden (bv. "Raad voor Vervoer, Telecommunicatie en Energie", waar ook de Telecomraad onder valt)
      // zeggen te weinig over het onderwerp: alleen als suggestie
      const begroting = (n) => /begroting|^raad |^europese raad|milieuraad/.test(n);
      const inDossier = lijst.filter((th) => dos.some((n) => !begroting(n) && th.re.some((r) => r.test(n))));
      // sectoroverstijgend telt in een dossiertitel alleen als er geen ander thema in staat ("Wijziging van de Wet milieubeheer ... groen gas")
      if (inDossier.length > 1) inDossier.splice(0, inDossier.length, ...inDossier.filter((th) => th.slug !== "sectoroverstijgend"));
      if (inDossier.length) {
        for (const th of inDossier) grond[th.slug] = [...new Set(dos.flatMap((n) => treffers(th.re, n)))];
        return { themas: sorteer(inDossier.map((th) => th.slug)), zekerheid: "dossier", grond, suggestie: [] };
      }
      const zwak = lijst.filter((th) => [...rest, ...dos].some((n) => th.re.some((r) => r.test(n)))).map((th) => th.slug);
      return { themas: [], zekerheid: zwak.length ? "zwak" : "geen", grond: {}, suggestie: zwak };
    }
    const voor = (titel, overig, dossiers) => voorstel(titel, overig, dossiers).themas;
    // goedgekeurde mapping eerst; anders de regels
    function item(sl, titel, overig, dossiers) {
      const m = M[sl];
      if (m && Array.isArray(m.themas)) return sorteer(m.themas.filter((s) => PER_SLUG.has(s)));
      return voor(titel, overig, dossiers);
    }
    const bron = (sl) => (M[sl] ? M[sl].bron || "mapping" : "regels");
    return { lijst: THEMAS, voorstel, voor, item, bron, inMapping: (sl) => !!M[sl], naam: (s) => PER_SLUG.get(s)?.label || s, bestaat: (s) => PER_SLUG.has(s), thema: (s) => PER_SLUG.get(s) };
  }
  const sorteer = (slugs) => [...new Set(slugs)].sort((a, b) => (PER_SLUG.get(a)?.volgorde ?? 99) - (PER_SLUG.get(b)?.volgorde ?? 99));

  /* ---------- Alle items die een thema kunnen krijgen ----------
     Eén bron voor de site (Thema's), de review-CSV en de noscript-lijst, zodat de tellingen overal gelijk zijn.
     soort: wet, amendement, motie, brief, vraag, antwoord, vergadering, agenda.
     - wet: de wetsvoorstellen uit de Kamerdata (zoals de tab Wetgeving)
     - vergadering: samengevatte debatten plus uitgevoerde Kameractiviteiten zonder samenvatting (Terugblik op de tab Agenda)
     - agenda: geplande Kameractiviteiten plus eigen mijlpalen (data/agenda.json); sleutel debat: blijft gelijk als een geplande vergadering wordt gehouden
     momenten: datums vanaf vandaag die als "eerstvolgend moment" kunnen gelden, met een typelabel. */
  const dagNL = (iso) => (iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso)) : null);
  // "Antwoord op vragen van het lid X over Y" -> "Y" (namen van Kamerleden tellen niet als trefwoord)
  const stukTitel = (s) => (s.onderwerp || s.titel || "").replace(/^(antwoord(en)? op )?(de )?(schriftelijke )?vragen van (het lid|de leden) .*? over /i, "");
  const korteTitel = (z) => { const t = z.onderwerp || z.titel || ""; return /^(nader )?(gewijzigde? )?(motie|amendement)\b/i.test(t) ? t.replace(/^.*? over /i, "") : t; };
  const DEBAT_SOORTEN = ["Commissiedebat", "Plenair debat", "Tweeminutendebat", "Wetgevingsoverleg", "Notaoverleg", "Rondetafelgesprek", "Technische briefing", "Hoorzitting", "Dertigledendebat", "Debat"];
  const isDebat = (a) => DEBAT_SOORTEN.includes(a.Soort) || (a.Soort || "").startsWith("Plenair debat");
  const TYPE_NORM = { "Plenair debat (tweeminutendebat)": "Tweeminutendebat", "Plenair debat (debat)": "Plenair debat", "Plenair debat (dertigledendebat)": "Dertigledendebat", "Plenair debat (initiatiefwetgeving)": "Plenair debat (wetgeving)" };
  const typeNaam = (s) => TYPE_NORM[s] || s || "Overig";

  function bronItems(data) {
    const uit = [];
    const zaken = data.zaken || [], stukken = data.stukken || [], acts = data.activiteiten || [];
    const debatten = data.debatten || [];
    const agendapunten = (a) => (a ? (a.agendapunten || []).map((ap) => ap.onderwerp) : []);

    // wetten
    for (const z of zaken) {
      if (!/wetgeving/i.test(z.soort)) continue;
      uit.push({ sleutel: sleutel.zaak(z), soort: "wet", datum: z.gestartOp, titel: z.titel || z.onderwerp, overig: [], dossiers: (z.dossiers || []).map((d) => d.titel), ref: z, momenten: [] });
    }
    // moties en amendementen: titel zonder "Motie van het lid X over"; de dossiertitel telt als overige tekst
    for (const z of zaken) {
      if (z.soort !== "Motie" && z.soort !== "Amendement") continue;
      uit.push({ sleutel: sleutel.zaak(z), soort: z.soort === "Motie" ? "motie" : "amendement", datum: z.gestartOp, titel: korteTitel(z), overig: [], dossiers: (z.dossiers || []).map((d) => d.titel), ref: z, momenten: [] });
    }
    // stukken
    for (const s of stukken) {
      uit.push({ sleutel: sleutel.stuk(s), soort: /antwoord/i.test(s.soort) ? "antwoord" : s.soort === "Schriftelijke vragen" ? "vraag" : "brief", datum: s.datum, titel: stukTitel(s), overig: [], dossiers: (s.dossiers || []).map((d) => d.titel), ref: s, momenten: [] });
    }
    // vergaderingen: samenvattingen en uitgevoerde activiteiten zonder samenvatting
    const perNummer = new Map(acts.map((a) => [a.Nummer, a]));
    const samengevat = new Set(debatten.flatMap((d) => [d.activiteit, ...(d.extraActiviteiten || [])]).filter(Boolean));
    const losSamengevat = debatten.filter((d) => !d.activiteit);
    const isSamengevat = (a) => samengevat.has(a.Nummer) || losSamengevat.some((d) => d.datum === dagNL(a.Datum) && d.type === a.Soort);
    for (const d of debatten) {
      const a = perNummer.get(d.activiteit);
      uit.push({ sleutel: sleutel.debat(d.activiteit || d.id), soort: "vergadering", datum: d.datum, titel: d.titel, overig: agendapunten(a), ref: d, momenten: [], themasVeld: d.themas });
    }
    for (const a of acts) {
      if (!isDebat(a) || a.Status !== "Uitgevoerd" || !a.Datum || isSamengevat(a)) continue;
      uit.push({ sleutel: sleutel.debat(a.Nummer), soort: "vergadering", datum: dagNL(a.Datum), titel: a.Onderwerp, overig: agendapunten(a), ref: a, momenten: [] });
    }
    // agenda: geplande activiteiten en eigen mijlpalen (zelfde ontdubbeling als de tab Agenda)
    const gezien = new Set();
    for (const a of acts) {
      if (a.Status !== "Gepland") continue;
      const datum = dagNL(a.Datum);
      gezien.add(`${datum}|${norm(a.Onderwerp).slice(0, 20)}`);
      uit.push({ sleutel: sleutel.debat(a.Nummer), soort: "agenda", datum, titel: a.Onderwerp, overig: agendapunten(a), ref: a, momenten: datum ? [{ label: typeNaam(a.Soort), datum, titel: a.Onderwerp }] : [] });
    }
    for (const i of data.agenda || []) {
      if (gezien.has(`${i.datum}|${norm(i.titel).slice(0, 20)}`)) continue;
      uit.push({ sleutel: sleutel.agenda(i), soort: "agenda", datum: i.datum, titel: i.titel, overig: [], ref: i, momenten: i.datum ? [{ label: i.type || "Mijlpaal", datum: i.datum, titel: i.titel }] : [] });
    }
    return uit;
  }

  // thema's van een item uit bronItems: mapping, dan een handmatig themas-veld in een samenvatting, dan de regels
  function themasVanItem(T, x) {
    if (T.inMapping(x.sleutel)) return T.item(x.sleutel);
    if (x.themasVeld && x.themasVeld.length) return sorteer(x.themasVeld.filter((s) => PER_SLUG.has(s)));
    return T.voor(x.titel, x.overig, x.dossiers);
  }

  // soorten in de volgorde van de themapagina, met enkelvoud en meervoud voor de tellingen
  const SOORTEN = [
    { code: "wet", param: "wetten", groep: "Wetten", een: "wet", veel: "wetten" },
    { code: "amendement", param: "amendementen", groep: "Amendementen", een: "amendement", veel: "amendementen" },
    { code: "motie", param: "moties", groep: "Moties", een: "motie", veel: "moties" },
    { code: "brief", param: "kamerbrieven", groep: "Kamerbrieven", een: "brief", veel: "brieven" },
    { code: "vraag", param: "kamervragen", groep: "Kamervragen", een: "vraag", veel: "vragen" },
    { code: "antwoord", param: "antwoorden", groep: "Antwoorden op Kamervragen", een: "antwoord", veel: "antwoorden" },
    { code: "vergadering", param: "vergaderingen", groep: "Vergaderingen", een: "vergadering", veel: "vergaderingen" },
    { code: "agenda", param: "agenda", groep: "Agenda", een: "op de agenda", veel: "op de agenda" },
  ];

  // officiële pagina op tweedekamer.nl: motie of amendement via het D-nummer (tkLink uit de pipeline), een wetsvoorstel via
  // zijn Kamerstuknummer, anders zoeken op het zaaknummer. OpenTK (z.link) staat alleen nog als tweede link in de details.
  function tkUrl(z) {
    if (z.tkLink) return z.tkLink;
    const d = (z.dossiers || [])[0];
    if (/wetgeving/i.test(z.soort || "") && d) return `https://www.tweedekamer.nl/kamerstukken/wetsvoorstellen/detail?cfg=wetsvoorsteldetails&qry=wetsvoorstel%3A${encodeURIComponent(`${d.nummer}${d.toevoeging ? "-" + d.toevoeging : ""}`)}`;
    return `https://www.tweedekamer.nl/zoeken?q=${encodeURIComponent(z.nummer)}`;
  }

  return { THEMAS, SOORTEN, maak, tkUrl, norm, sleutel, bronItems, themasVanItem, korteTitel, stukTitel, typeNaam };
});
