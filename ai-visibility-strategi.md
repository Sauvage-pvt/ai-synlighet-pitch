# AI-Synlighet for SMB — Strategi & Implementering

## Executive Summary

AI-søk (ChatGPT, Perplexity, Claude) vokser eksponentielt. Norske SMB-er har ingen måte å vite:
- Om de dukker opp når folk spør AI hvor de skal handle
- Hvem konkurrentene er i AI-resultatene
- Hva som gjør at AI ikke nevner dem

**AI-Synlighet** er et verktøy som måler og fikser dette problemet. Tre tiers, fra gratis til subscription.

---

## Markedsanalyse

### Størrelse
- **Norske SMB-er:** ~250 000
- **Target (Trøndelag):** ~15 000
- **Realistisk marked år 1:** 500–2000 (2-13%)

### Trend
- ChatGPT-bruk i Norge: +300% (2023–2024)
- "Jeg spør AI først"-andel: 58% under 30, 34% totalt
- AI-søk vokser 10× raskere enn Google

### Konkurranse
- **Nimt.ai** — svensk, visibility-tracking, SaaS (€360k seed)
- **Google AI Overview** — built-in, begrenset data
- **Lokale aktører:** Ingen

**Gapet:** Billig, norsk, SMB-fokusert løsning = First-mover advantage

---

## Produktbeskrivelse

### Tier 1: Gratis Simulering (Inbound)

**Hva det gjør:**
- Bruker crawler på side → ekstraherer nøkkelord
- Simulerer relevante AI-spørsmål ("Hvem tilbyr [bransje] i [kommune]?")
- Scorer på skala hvor sannsynlig det er du dukker opp
- Sjekker teknisk readiness (schema, robots, llms.txt, mobile)

**Output:**
- Rapport med score (0–100)
- "Du burde dukke opp" — men du gjør det ikke
- 5 konkurrenter som gjør det
- Konkrete fikskroker (schema-data, llms.txt)

**Pris:** Inkludert (lead-magnet)

**Tech:** Cloudflare Worker + fetch API + keyword extraction

---

### Tier 2: Analyse (One-time)

**Hva det gjør:**
- Samme som Tier 1 PLUSS:
- Kjører 3–5 faktiske spørsmål gjennom ChatGPT API
- Parser resultatene for å se: "Dukker DU opp? Hvor? På plass hvor?"
- Sammenligner dine resultater med konkurrentene
- Gir konkrete prioriteringer ("Fikk LocalBusiness-data først, så llms.txt")

**Output:**
- Simulering + Faktiske resultater
- Konkurranse-sammenligning ("Du ranker #7 av 8 på 'øl-bar Steinkjer'")
- Priorisert action-liste (hva som gir mest boost)
- Kostnadsestimater for implementering (hvis du vil lage selv)

**Pris:** 799 kr per analyse

**Tech:** ChatGPT API (gpt-4o), parsing, comparison logic

---

### Tier 3: Subscription (Tracking)

**Hva det gjør:**
- Kjører samme test hver uke
- Lagrer historikk (tracker endringer over tid)
- Viser dashboard: "Din rank går fra #7 → #6 → #4"
- Alerter når konkurrenter dukker opp eller forsvinner
- Månedlig rapport med insights

**Output:**
- Dashboard (private portal)
- Grafer over tid
- Konkurranse-signaler (når konkurrenter endrer strategi)
- Månedlig oppsummering

**Pris:** 299 kr/mnd

**Tech:** Same as Tier 2 + persistence (Durable Objects eller KV) + UI dashboard

---

## Implementeringsplan

### Fase 1 (2 uker)
- [ ] Finalize Tier 1 (gratis simulering)
- [ ] Cloudflare Worker setup
- [ ] Test på 10 lokale bedrifter

### Fase 2 (1 uke)
- [ ] Tier 2 (API-integrasjon)
- [ ] ChatGPT API setup
- [ ] Prising-kalkulator

### Fase 3 (2 uker)
- [ ] Tier 3 (Dashboard + tracking)
- [ ] Durable Objects setup
- [ ] Alerting-logic

### Fase 4 (1 uke)
- [ ] Marketing-landsseide
- [ ] SMB-outreach (start Steinkjer)

**Total:** 6 uker til MVP (all three tiers)

---

## Prising-logikk

### Cost per Analyse (Tier 2)
- ChatGPT API: 3–5 spørsmål × $0.003 (gpt-4o) = ~$0.02 per analyse
- Parsing + Processing: ~$0.02
- **Total kostnader:** ~$0.04 per analyse
- **Selgepris:** 799 kr ≈ $75
- **Margin:** ~99%

### Cost per Subscription (Tier 3)
- 1 test per uke × 52 uker = 52 API-kall per år
- ~$1.04/år per kunde
- **Subscription:** 299 kr/mnd = $3 588/år per kunde
- **Margin:** 99%+

### Scenario: 500 Tier 2 + 100 Tier 3 kunder
- Tier 2: 500 × 799 kr = 399 500 kr (one-time revenue)
- Tier 3: 100 × 299 × 12 = 358 800 kr (annual recurring)
- **Year 1 revenue:** ~758 000 kr

---

## Go-to-Market

### Launch (Steinkjer)
1. **Pitch Steinkjer Utvikling** — de promoterer til lokale bedrifter
2. **Free tier for alle** — minimal friction
3. **Case studies** — 3–5 lokale suksesser
4. **Upsell til Tier 2** (analyse-oppdrag)
5. **Tier 3 for seriøse konkurrenter** (subscription)

### Expansion (Norge)
- LinkedIn outreach til SMB-eiere
- Partnering med Gründerraketten, NOK osv.
- Content-marketing (blogg: "AI-søk endrer alt")

---

## Risiko & Mitigering

| Risiko | Sannsynlighet | Løsning |
|--------|---|---|
| API-kostnader vokser raskere enn inntekter | Lav | Batch processing, caching |
| Konkurrenter (nimt.ai) lanserer i Norge | Medium | First-mover, lokal fokus, cheaper |
| SMB-er bryr seg ikke om AI-synlighet | Medium | Start med Tier 1 (gratis), show value |
| ChatGPT endrer API-prising | Low–Medium | Diversifiser til Perplexity API later |

---

## KPIs å tracke

1. **Gratis tier signups:** Target 1000 år 1
2. **Tier 2 konvertering:** 2–3% av gratis → betalt
3. **Tier 3 retention:** 80%+ monthly (SMB-subscriptions)
4. **Customer acquisition cost:** <200 kr
5. **Lifetime value:** >5000 kr (Tier 3 only)

---

## Konklusjon

AI-søk er ikke kommende — det er nå. SMB-er trenger verktøy for å bli funnet. Denne løsningen:

- ✓ Løser et reelt problem
- ✓ Har en klar business-modell
- ✓ Kan bygges raskt
- ✓ Skalerer med minimal kostnad
- ✓ Lokalt, norsk first-mover

**Ready to build?**


---

## Statuslogg

### 2026-10-09: Oppsett av demokode og OpenAI-nøkkel

- Workeren `ai-synlighet-pitch` er deployet på ai-synlighet-pitch.lenkemotor.workers.dev og er koblet til dette repoet.
- «Feil demokode» kom av at `DEMO_KODE` ikke var lagt inn i Cloudflare. Bare `OPENAI_MODEL` fantes.
- Lagt inn under Settings → Variables and secrets (Production), begge som **Secret**:
  - `DEMO_KODE`: koden som skrives i feltet «Demokode (full analyse)»
  - `OPENAI_API_KEY`: nøkkel fra platform.openai.com
- `OPENAI_MODEL` = `gpt-4o-mini`, satt som vanlig variabel i `wrangler.jsonc`.
- Siden fungerer. Gratis sjekk virker uten kode.
- Full analyse er ikke testet helt ennå, fordi OpenAI-kontoen ikke har kreditt.

**Neste steg**

- [ ] Kjøpe API-kreditt på platform.openai.com (Settings → Billing, minst ca. 5 dollar). API-et faktureres separat fra ChatGPT-abonnement.
- [ ] Teste full analyse med demokoden.

**Merk:** Verdiene for secrets lagres bare i Cloudflare, aldri i repoet. Får du «Feil demokode», sjekk mellomrom og store/små bokstaver, og legg koden inn på nytt med blyant-ikonet.
