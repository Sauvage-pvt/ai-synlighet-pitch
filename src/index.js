// AI-Synlighet – Worker
// /api/gratis  → teknisk sjekk av nettsiden, inkl. kontaktsider (ingen API-kostnad)
// /api/bransje → Google Places-søk
// /api/analyse → ekte spørsmål til ChatGPT (krever demokode)
// Alt annet serveres fra /public.

const UA = "Mozilla/5.0 (compatible; AI-Synlighet/1.0; +https://ai-synlighet-pitch.lenkemotor.workers.dev)";
const AI_BOTS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "ClaudeBot", "Google-Extended"];

// Undersider som typisk har telefon og adresse
const KONTAKT_STI = /(^|[\/-])(kontakt|kontakt-oss|ta-kontakt|om|om-oss|finn-oss|besok-oss|adresse|contact|about)([\/-]|$)/i;
const MAKS_UNDERSIDER = 6;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    // CORS: gratis-sjekken kan kalles fra andre sider (f.eks. testsiden for Dahl)
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    try {
      if (url.pathname === "/api/gratis" && req.method === "POST") {
        return json(await gratis(await req.json()));
      }
      if (url.pathname === "/api/bransje" && req.method === "POST") {
        return json(await bransjekart(await req.json(), env));
      }
      if (url.pathname === "/api/analyse" && req.method === "POST") {
        const body = await req.json();
        if (!env.DEMO_KODE || body.kode !== env.DEMO_KODE) {
          return json({ feil: "Feil demokode. Full analyse er låst på denne visningssiden." }, 401);
        }
        if (!env.OPENAI_API_KEY) return json({ feil: "OPENAI_API_KEY mangler i Cloudflare." }, 500);
        return json(await analyse(body, env));
      }
    } catch (e) {
      return json({ feil: e.message || String(e) }, 400);
    }
    return env.ASSETS.fetch(req);
  },
};

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS },
  });
}

function normUrl(input) {
  let s = String(input || "").trim();
  if (!s) throw new Error("Skriv inn en nettadresse.");
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  const u = new URL(s);
  if (!u.hostname.includes(".")) throw new Error("Ugyldig nettadresse.");
  return u;
}

async function hent(u, ms = 8000) {
  try {
    const r = await fetch(u.toString(), {
      headers: { "user-agent": UA, accept: "text/html,text/plain,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(ms),
    });
    const tekst = await r.text();
    return { ok: r.ok, status: r.status, url: r.url, tekst: tekst.slice(0, 600000), type: r.headers.get("content-type") || "" };
  } catch (e) {
    return { ok: false, status: 0, url: u.toString(), tekst: "", type: "", feil: e.message };
  }
}

const stripTags = (h) =>
  h
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");

const meta = (h, name) => {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*>`, "i");
  const m = h.match(re);
  if (!m) return "";
  const c = m[0].match(/content=["']([^"']*)["']/i);
  return c ? c[1].trim() : "";
};

// Finn interne lenker til kontakt/om-sider. Tar også med lenker der lenketeksten sier kontakt.
function kontaktLenker(h, origin) {
  const basis = new URL(origin).hostname.replace(/^www\./, "");
  const funnet = new Set();
  for (const m of h.matchAll(/<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1];
    if (/^(mailto|tel|javascript):/i.test(href)) continue;
    let u;
    try {
      u = new URL(href, origin);
    } catch {
      continue;
    }
    if (u.hostname.replace(/^www\./, "") !== basis) continue;
    const lenketekst = stripTags(m[2] || "");
    if (KONTAKT_STI.test(u.pathname) || /\b(kontakt|om oss|ta kontakt)\b/i.test(lenketekst)) {
      funnet.add(u.origin + u.pathname);
    }
  }
  return [...funnet];
}

// Postnummer + sted, f.eks. "7800 Namsos" eller "7800 NAMSOS"
const POSTNR = /\b\d{4}\s+[A-ZÆØÅ][A-ZÆØÅa-zæøå-]{2,}/;

async function gratis(body) {
  const u = normUrl(body.url);
  const sted = String(body.sted || "").trim();
  const origin = u.origin;

  const [side, llms, robots, sitemap] = await Promise.all([
    hent(u),
    hent(new URL("/llms.txt", origin), 5000),
    hent(new URL("/robots.txt", origin), 5000),
    hent(new URL("/sitemap.xml", origin), 5000),
  ]);
  if (!side.ok) throw new Error(`Fikk ikke hentet ${u.hostname} (${side.status || side.feil || "ukjent feil"}).`);

  // Undersider: kontaktlenker fra forsiden + kontaktrelaterte URL-er fra sitemap
  const sitemapUrl = sitemap.ok
    ? [...sitemap.tekst.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)]
        .map((m) => m[1])
        .filter((x) => {
          try {
            return KONTAKT_STI.test(new URL(x).pathname);
          } catch {
            return false;
          }
        })
    : [];
  const kandidater = [...new Set([...kontaktLenker(side.tekst, origin), ...sitemapUrl])]
    .filter((k) => k !== side.url && k !== origin + "/")
    .slice(0, MAKS_UNDERSIDER);

  const undersider = await Promise.all(kandidater.map((k) => hent(new URL(k), 8000)));
  const sider = [
    { url: side.url, h: side.tekst, kilde: "forsiden" },
    ...undersider
      .filter((s) => s.ok && (!s.type || /html/i.test(s.type)))
      .map((s) => ({ url: s.url, h: s.tekst, kilde: new URL(s.url).pathname || "/" })),
  ];

  const h = side.tekst;
  const alleTekst = sider.map((s) => stripTags(s.h)).join(" ");
  const title = (h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim() || "";
  const desc = meta(h, "description");
  const siteName = meta(h, "og:site_name");

  // JSON-LD fra alle sidene
  const blokker = sider.flatMap((s) => [...s.h.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]));
  const typer = [];
  let harAdresse = false;
  for (const b of blokker) {
    try {
      const walk = (o) => {
        if (!o || typeof o !== "object") return;
        if (Array.isArray(o)) return o.forEach(walk);
        if (o["@type"]) typer.push(...[].concat(o["@type"]));
        if (o.address) harAdresse = true;
        Object.values(o).forEach(walk);
      };
      walk(JSON.parse(b.trim()));
    } catch {}
  }
  const GENERISK = /^(WebSite|WebPage|BreadcrumbList|ListItem|PostalAddress|ImageObject|SearchAction|EntryPoint|SiteNavigationElement|ContactPoint|GeoCoordinates|OpeningHoursSpecification|Person|Thing|CollectionPage|ItemList|Offer|PropertyValueSpecification)$/i;
  const lokalTyper = typer.filter((t) => !GENERISK.test(t));

  const harLlms = llms.ok && !/text\/html/i.test(llms.type) && llms.tekst.trim().length > 20;
  const blokkert = robots.ok ? blokkerteBotter(robots.tekst) : [];
  const harSitemap = sitemap.ok && /<(urlset|sitemapindex)/i.test(sitemap.tekst);
  const harViewport = /<meta[^>]+name=["']viewport["']/i.test(h);
  const https = new URL(side.url).protocol === "https:";

  // Kontaktinfo: sjekk alle sidene vi fant
  const postnrSide = sider.find((s) => POSTNR.test(stripTags(s.h)));
  const postnr = Boolean(postnrSide);
  const kontaktSider = sider.length > 1 ? ` · sjekket ${sider.length} sider` : " · fant ingen kontaktside å sjekke";

  const nevnerSted = sted ? alleTekst.toLowerCase().includes(sted.toLowerCase()) : null;
  const ordAntall = alleTekst.split(" ").length;

  const sjekker = [
    {
      navn: "Strukturerte data (schema.org)",
      vekt: 20,
      ok: lokalTyper.length > 0,
      funnet: typer.length ? `Fant: ${[...new Set(typer)].slice(0, 6).join(", ")}` : "Ingen strukturerte data funnet",
      tiltak: "Jeg legger inn LocalBusiness-data med navn, adresse, åpningstider og tjenester, slik at AI forstår hvem du er og hvor du er.",
    },
    {
      navn: "Adresse i strukturerte data",
      vekt: 10,
      ok: harAdresse,
      funnet: harAdresse ? "Adresse er oppgitt maskinlesbart" : "AI finner ingen maskinlesbar adresse",
      tiltak: "Jeg kobler adressen og kommunen til bedriften i koden, så du blir aktuell når noen spør om ditt område.",
    },
    {
      navn: "llms.txt",
      vekt: 15,
      ok: harLlms,
      funnet: harLlms ? "llms.txt finnes" : "Ingen llms.txt",
      tiltak: "Jeg lager en llms.txt: et kort sammendrag skrevet for AI-modeller om hva du tilbyr, hvor og til hvem.",
    },
    {
      navn: "AI-roboter har tilgang",
      vekt: 15,
      ok: blokkert.length === 0,
      funnet: !robots.ok ? "Ingen robots.txt (alle har tilgang)" : blokkert.length ? `Blokkerer: ${blokkert.join(", ")}` : "Ingen AI-roboter er blokkert",
      tiltak: "Jeg går gjennom robots.txt og åpner for ChatGPT, Perplexity og andre AI-søk, uten å åpne for det du vil holde privat.",
    },
    {
      navn: "Tittel og beskrivelse",
      vekt: 10,
      ok: title.length >= 10 && desc.length >= 50,
      funnet: `Tittel: ${title ? `«${title.slice(0, 70)}»` : "mangler"} · Beskrivelse: ${desc ? `${desc.length} tegn` : "mangler"}`,
      tiltak: "Jeg skriver tittel og beskrivelse som sier tydelig hva du gjør og hvor – det er ofte det AI siterer.",
    },
    {
      navn: "Sted nevnt på siden",
      vekt: 10,
      ok: nevnerSted !== false,
      funnet: nevnerSted === null ? "Ikke sjekket (sted ikke oppgitt)" : nevnerSted ? `«${sted}» står på nettsiden` : `«${sted}» står ikke på nettsiden`,
      tiltak: "Jeg sørger for at kommune og region står tydelig i tekst og data, så du kobles til lokale søk.",
    },
    {
      navn: "Adresse synlig",
      vekt: 10,
      ok: postnr,
      funnet: `Postadresse: ${postnr ? `ja (${postnrSide.kilde})` : "nei"}${kontaktSider}`,
      tiltak: "Jeg legger adressen synlig på forsiden og i bunnteksten, og merker den maskinlesbart.",
    },
    {
      navn: "Sitemap",
      vekt: 5,
      ok: harSitemap,
      funnet: harSitemap ? "sitemap.xml finnes" : "Ingen sitemap.xml",
      tiltak: "Jeg lager et sitemap så alle sidene dine blir funnet og lest.",
    },
    {
      navn: "Én tydelig H1",
      vekt: 6,
      ok: /<h1[^>]*>[\s\S]*?\S[\s\S]*?<\/h1>/i.test(h),
      funnet: /<h1[^>]*>/i.test(h) ? "H1 finnes på siden" : "Ingen H1 på siden",
      tiltak: "Jeg setter én H1 som sier hva du gjør og hvor, slik at både lesere og søkemotorer forstår hovedtemaet.",
    },
    {
      navn: "FAQ merket for AI-søk",
      vekt: 8,
      ok: typer.includes("FAQPage"),
      funnet: typer.includes("FAQPage") ? "FAQPage-skjema finnes" : "Ingen FAQPage-skjema",
      tiltak: "Jeg merker de vanlige spørsmålene dine med FAQPage-skjema, så AI-søk kan sitere svarene dine.",
    },
    {
      navn: "Mobil og HTTPS",
      vekt: 5,
      ok: harViewport && https,
      funnet: `Mobiltilpasset: ${harViewport ? "ja" : "nei"} · HTTPS: ${https ? "ja" : "nei"}`,
      tiltak: "Jeg sikrer at siden er mobiltilpasset og kjører på HTTPS.",
    },
  ];

  const totalVekt = sjekker.reduce((s, c) => s + c.vekt, 0);
  const opptjent = sjekker.reduce((s, c) => s + (c.ok ? c.vekt : 0), 0);
  const score = Math.round((opptjent / totalVekt) * 100);
  return {
    domene: new URL(side.url).hostname,
    navn: String(body.navn || "").trim() || siteName || title.split(/[|\-–·]/)[0].trim(),
    score,
    tynt: ordAntall < 150,
    sjekkede: sider.map((s) => s.url),
    sjekker,
  };
}

function blokkerteBotter(robots) {
  const linjer = robots
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*/, "").trim())
    .filter(Boolean);
  const grupper = [];
  let cur = null;
  for (const l of linjer) {
    const [k, ...rest] = l.split(":");
    const key = k.trim().toLowerCase();
    const val = rest.join(":").trim();
    if (key === "user-agent") {
      if (!cur || cur.regler.length) grupper.push((cur = { agenter: [], regler: [] }));
      cur.agenter.push(val.toLowerCase());
    } else if (cur && (key === "disallow" || key === "allow")) {
      cur.regler.push({ key, val });
    }
  }
  const blokkerAlt = (g) =>
    g.regler.some((r) => r.key === "disallow" && r.val === "/") && !g.regler.some((r) => r.key === "allow" && r.val === "/");
  const stjerne = grupper.find((g) => g.agenter.includes("*"));
  return AI_BOTS.filter((bot) => {
    const egen = grupper.find((g) => g.agenter.includes(bot.toLowerCase()));
    if (egen) return blokkerAlt(egen);
    return stjerne ? blokkerAlt(stjerne) : false;
  });
}

// ---------- BRANSJEKART (Google Places) ----------
// Kun bransje og sted. Ingen adresse, ingen kundeidentitet, ingen anmeldelsestekst lagres eller vises.
async function bransjekart(body, env) {
  const bransje = String(body.bransje || "").trim();
  const sted = String(body.sted || "").trim();
  if (!bransje || !sted) throw new Error("Skriv inn bransje og sted.");
  if (!env.GOOGLE_MAPS_KEY) throw new Error("GOOGLE_MAPS_KEY mangler i Cloudflare.");

  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": env.GOOGLE_MAPS_KEY,
      "x-goog-fieldmask": "places.id,places.displayName,places.location,places.rating,places.userRatingCount",
    },
    body: JSON.stringify({ textQuery: bransje + " i " + sted, languageCode: "no", regionCode: "NO", maxResultCount: 20 }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error("Google svarte " + r.status + ": " + (await r.text()).slice(0, 200));
  const data = await r.json();

  const bedrifter = (data.places || [])
    .map((p) => ({
      navn: p.displayName?.text || "",
      lat: p.location?.latitude ?? null,
      lng: p.location?.longitude ?? null,
      snitt: p.rating ?? null,
      antall: p.userRatingCount ?? 0,
    }))
    .sort((a, b) => b.antall - a.antall);

  return { bransje, sted, antall: bedrifter.length, bedrifter, kilde: "Google Places" };
}

// ---------- ANALYSE (ChatGPT) ----------
async function analyse(body, env) {
  const bransje = String(body.bransje || "").trim();
  const sted = String(body.sted || "").trim();
  if (!bransje || !sted) throw new Error("Bransje og sted må fylles ut for full analyse.");
  const domene = normUrl(body.url).hostname.replace(/^www\./, "");
  const navn = String(body.navn || "").trim();

  const sporsmal = [
    `Hvilke bedrifter tilbyr ${bransje} i ${sted}?`,
    `Jeg trenger ${bransje} i nærheten av ${sted}. Hvem anbefaler du?`,
    `Hva er de beste ${bransje}-bedriftene i ${sted} og omegn?`,
  ];
  const model = env.OPENAI_MODEL || "gpt-4o-mini";

  const svar = await Promise.all(sporsmal.map((q) => spor(q, model, env.OPENAI_API_KEY)));

  const nokler = [domene.split(".")[0], navn].filter((x) => x && x.length > 2).map(forenkle);
  const treff = (b) => {
    const s = forenkle(`${b.navn} ${b.nettside || ""}`);
    return nokler.some((n) => s.includes(n)) || (b.nettside || "").includes(domene);
  };

  const resultater = sporsmal.map((q, i) => {
    const liste = svar[i];
    const idx = liste.findIndex(treff);
    return { sporsmal: q, nevnt: idx >= 0, plass: idx >= 0 ? idx + 1 : null, antall: liste.length, bedrifter: liste.map((b) => b.navn) };
  });

  const teller = {};
  svar.flat().forEach((b) => {
    if (treff(b)) return;
    const k = b.navn.trim();
    teller[k] = (teller[k] || 0) + 1;
  });
  const konkurrenter = Object.entries(teller)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([navn2, ganger]) => ({ navn: navn2, ganger }));

  const nevntAntall = resultater.filter((r) => r.nevnt).length;
  return { modell: model, nevntAntall, totalt: sporsmal.length, resultater, konkurrenter };
}

const forenkle = (s) =>
  String(s)
    .toLowerCase()
    .replace(/\b(as|asa|da|ans|enk)\b/g, "")
    .replace(/[^a-z0-9æøå]/g, "");

async function spor(q, model, key) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Du er en hjelpsom assistent som svarer en norsk forbruker. Svar på spørsmålet med de konkrete bedriftene du ville anbefalt, i prioritert rekkefølge (maks 8). Svar KUN med JSON: {"bedrifter":[{"navn":"...","nettside":"domene eller null"}]}. Ikke finn på bedrifter du ikke kjenner til.',
        },
        { role: "user", content: q },
      ],
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!r.ok) throw new Error(`OpenAI svarte ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  try {
    const parsed = JSON.parse(data.choices[0].message.content);
    return (parsed.bedrifter || [])
      .filter((b) => b && b.navn)
      .map((b) => ({ navn: String(b.navn), nettside: b.nettside ? String(b.nettside).toLowerCase() : null }));
  } catch {
    return [];
  }
}
