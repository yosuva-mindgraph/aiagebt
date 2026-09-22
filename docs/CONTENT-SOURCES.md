# Where every claim came from

Nothing in the scenes or the knowledge base is invented. This is the map, so a
number can be challenged in a meeting and traced in under a minute.

Four locations:

- **Product** — `/Users/yosuvaberry/Documents/Mindgraph/Airport-Hub/airport-hub/`, the
  Airport Hub repo (on the original Linux box it was `~/projects/airports-hub/airport-hub/`).
  Where the product and a slide disagree, **the product wins** — a metadata file is a fact
  and a deck is a claim.
- **AIRIS briefing** — `Thinking_Airport_AIRIS_Briefing - v5edits.pdf` (DXC, "PTE Thinking
  Airport Brief", 23 September 2026, 21 pp). Supersedes the v2 `.docx` on the share.
- **PTE Asia brief** — `KBYG - PTE Asia - 20 sept.pdf` (DXC, "Know Before You Go, PTE Asia
  2026, Singapore", 34 pp). **DXC Internal** — only visitor-facing facts are used; see the
  "Deliberately not used" section.
- **Share** — `/srv/samba/mindgraph1/Airports in a Box/` (the `/mindgraph1/…` path as seen
  from a Mac): the capabilities deck, the module blueprint, the brand pack.

In `src/knowledge.js` every entry carries a `src` label that maps to one of these:
`Airport Hub metadata` / `Airport Hub repo` → Product · `AIRIS briefing` /
`Thinking Airport brief` → AIRIS briefing · `PTE Asia brief` → PTE Asia brief ·
`AIB capabilities deck` / `module blueprint` → Share.

---

## Corrections made on 22 September 2026 (product wins)

| Was on screen | Now on screen | Why |
|---|---|---|
| 58 canonical entities · 201 KPIs | **59 entities · 204 KPIs** | `metadata/canonical/schema.yaml` counted: 59 `- id:` under `entities:`, 204 `- {id:` under `kpis:` (PaxJourney added in Passenger360 P7) |
| Eleven playbooks ship, disabled | **Three seeded (off) + nine in the library = twelve** | `metadata/flows/use_cases.json` holds 3 flows; `metadata/flows/use_case_library.json` holds 9 and is not seeded. The old `dxc_demo_use_cases.json` count is gone. |
| 14 risks (11 airport + 3 platform) | **16 risks (11 airport + 5 platform)** | `metadata/governance/risks.yaml`: `r_engine_dependency` and `r_audit_gap` added |
| Passenger360 | **Flow360** (formerly Passenger360) | `web/src/app/flow360Redirect.test.ts`; `applications.yaml` label |
| Three forecast models ship | **Three registered, locked, "coming soon"** | `metadata/agents/ml_models.yaml` — all `locked: true` |
| Five applications | **Eight** (Revenue Management is an umbrella over Airline Billing, Airline Marketing, Routes) | `metadata/ops/domains/applications.yaml` |
| Healthcare as a live domain | Healthcare is a **placeholder** ("coming later") | `metadata/ops/domains/business.yaml` |

## Platform structure

| Claim | Source |
|---|---|
| Five areas: Airport Business · Data Fabric · Intelligence 360 · GRC · Settings (plus Home, the twin) | Product · `web/src/app/nav.ts` |
| Five control centres — AOCC, ATC, EOC, NOC, SOC, with their full names and purposes | Product · `metadata/ops/centres/*.yaml` |
| AOCC subdomains (9) and the ATC / EOC / NOC / SOC subdomains; 37 subdomains in all, 31 live · 5 connect · 1 placeholder | Product · `metadata/ops/domains/{aocc,atc,eoc,noc,soc,business,applications}.yaml` |
| Business domains — Energy, ESG, Facility, Safety Training, AVSEC, OT Security, Healthcare (placeholder) | Product · `metadata/ops/domains/business.yaml` |
| Applications (8) — AIR Disaster Management, Revenue Management, Airline Billing, Airline Marketing, Routes, Flow360, Connected Health, Roster | Product · `metadata/ops/domains/applications.yaml` |
| **"Adding a domain/subdomain is METADATA, not code … a new domain immediately gets the standard 'connect this data' dashboard and lights up when its entity is mapped"** | Product · `api/routes/domains.py`, module docstring, lines 1–11. Quoted almost verbatim. |
| EOC follows ICAO Annex 14 / FAA Part 139 | Product · `metadata/ops/centres/eoc.yaml` |
| Under the hood the product is "Airport Hub"; white-label per-tenant skins; "one deployed instance per airport" | Product · `metadata/branding/*.yaml`; `docs/PRODUCT_CONTEXT.md`; `docs/DEMO-SCRIPT.md` |

## The data foundation

| Claim | Source |
|---|---|
| **59 canonical entities**, anchored to ACRIS, IATA AIDX and IATA Resolution 753 | Product · `metadata/canonical/schema.yaml` header + `entities` |
| **204 governed KPIs** | Product · `metadata/canonical/schema.yaml` → `kpis` |
| **21 mapped sources** from ten source systems — ACDM, ASQ, FLIRT, FIDS, BBIT (BHS), SBD, CUSS, VAMS, VTS, Xilnex POS | Product · `metadata/sources/*.yaml` (21 files) |
| "One governed pipeline" — every tile resolves through `RequestService.query_canonical_as`; "There is no second enforcement path" | Product · `api/routes/domains.py`; `docs/PRODUCT_CONTEXT.md` |
| Catalog / lineage / glossary / governed explorer / documents / sources | Product · `web/src/app/nav.ts`, Data Fabric section |
| Lineage: 8 declared layers source → raw → curated → canonical → KPI → agent → flow → dashboard; "never inferred by magic" | Product · `serving/lineage.py` |
| Live connector types: external Iceberg + BigQuery; 12 roadmap connectors shown as demo cards | Product · `ingestion/base.py` |
| Baggage: six feeds (BHS ×3, SBD ×3), Bag / BagEvent / BagFlow entities, first-/last-bag KPIs, Baggage Analyst scope, Res 753 pack. Cargo: Cargo / CargoVolume entities, `cargo_throughput`, library playbook. Flights: six feeds (ACDM, FIDS, FLIRT, ASQ ×3), Flight / FlightLeg / AirlinePerformance, OTP playbook at < 80 % every 10 min | Product · `metadata/sources/*.yaml`; `metadata/canonical/schema.yaml`; `metadata/ops/domains/aocc.yaml`; `metadata/flows/use_cases.json`; `metadata/governance/packs/res753.yaml` |
| Open-source stack: MinIO · Apache Iceberg · DuckDB · FastAPI · React; no Docker, no JVM; 8 GB laptop; runs with no LLM key | Product · `airport-hub/README.md`; `CLAUDE.md` |
| Nine LLM providers (Anthropic, OpenAI, Groq, Ollama, Vertex, Bedrock, Azure, OpenRouter …); per-purpose engines | Product · `intelligence/llm.py`; `intelligence/engines.py`; `docs/FEATURE_MATRIX.md` |
| Synthetic demo world "Horizon International"; 61 rolling days; 700 flights/day; 5.49M rows / 53 tables | Product · `airport-hub/README.md`; `metadata/generation.yaml`; `DEPLOYMENT.md` |

## Build surfaces

| Claim | Source |
|---|---|
| Workflow trigger types (7) — manual, schedule/cron, threshold on a governed measure, webhook, live event, another workflow's failure, **missing expected event** | Product · `metadata/flows/nodes.yaml` |
| 20 node kinds: 7 triggers · data query · AI agent · logic · 4 actions · 5 channels (Slack, Discord, Teams, Telegram, WhatsApp) · sticky note | Product · `metadata/flows/nodes.yaml` |
| Three shipped playbooks (seeded, disabled) + nine library playbooks | Product · `metadata/flows/use_cases.json`, `use_case_library.json` |
| The scene-8 example (security queue over target for two minutes) | Product · library flow "Security wait above target"; `serving/pax_live.py` (2 min over target → OpsAlert + `trigger.live`) |
| App component library — hero, navbar, footer, kpi, chart, data-table, timeline, filter-bar, search, status-badge, flight-board, map, gallery, form | Product · `metadata/apps/components.yaml` |
| Dashboard Studio — 12-column canvas, component library, versions, drafts, cross-filter/drill-down; "no data path starts in the editor"; publish internal / protected / public | Product · `airport-hub/README.md` §Studio; `serving/publish.py` |
| Workflow copilot (plan-first, grounded), durable execution, impact chains for 3 watched KPIs | Product · `docs/FEATURE_MATRIX.md`; `metadata/ops/impact_chains.yaml` |
| Six agents — Airport Hub Analyst, Ops Analyst, Baggage Analyst, Retail Analyst, Data Steward, Compliance Explainer; Compliance Explainer has an empty data scope by design | Product · `metadata/agents/*.yaml` |
| Agents carry `risk_tier`, `purpose`, `model`, `tools`, `data_scope`, `guardrails`, `evaluation` | Product · `metadata/agents/main.yaml` and siblings |
| Three ML models registered, all locked ("Prediction models are coming soon") | Product · `metadata/agents/ml_models.yaml` |
| MCP server with six tools; Claude Desktop connection; REST docs | Product · `airport-hub/README.md`; `CONNECT-CLAUDE-DESKTOP.md` |
| Flow360 — T1 plan 70 zones · 46 lines · 166 sensors · 123 process points; IATA ADRM LoS bands; anonymous coordinates, never images; Xovis-compatible ingest | Product · `airport-hub/README.md` §Flow360; `passesnger360/00_INDEX.md` |

## Governance

| Claim | Source |
|---|---|
| 14 obligations — ICAO Annex 19 / 17 / 14, emergency plan, IGOM, service quality, ISO 14001 / ACA, personal data, GDPR transfers, breach notification, ISO 27001 access control and logging, EU AI Act-style oversight, provenance of AI output. "Nothing here is auto-marked compliant" | Product · `metadata/governance/obligations.yaml` |
| 16 risks, airport **and platform**, 5×5 scored, owners, live signals or "not instrumented" | Product · `metadata/governance/risks.yaml`; `serving/grc.py` |
| Five governance packs — ai_baseline (locked), data_minimisation, ops_security, pdpa, res753 | Product · `metadata/governance/packs/` |
| PDPA principles, retention schedules, cross-border | Product · `metadata/compliance/pdpa.yaml` |
| Column-level access matrix · Trust · Activity/audit · proposed-vs-active policies and glossary; "Never wire a proposal directly to enforcement" | Product · `serving/access.py`; `metadata/policies/{active,proposed}/`; `CLAUDE.md` |
| SQL guardrails: one statement, SELECT-only, allow-listed tables, LIMIT clamped at 10,000; masks compiled into SQL; "even a fully hijacked LLM cannot exceed SELECT" | Product · `airport-hub/README.md` §Guardrails, §Security |
| 10 deterministic security probes; 8 locked at the SuperAdmin floor; AI governance on AIGE 7 principles + NIST AI RMF; AI incident register | Product · `tests/evals/golden.yaml`; `metadata/agents/floor.yaml`; `serving/aigov.py` |
| Roles superadmin / admin / analyst / service; scopes data:read, raw:read, pii:read, docs:read, catalog:read; "scopes ∩ policies, conflicts resolve restrictive" | Product · `core/identity.py`; `airport-hub/README.md` |

## Delivery, proof and commercials

| Claim | Source |
|---|---|
| Sits-on-top-of list; speaks-every-protocol list; "plug into anything, replace nothing" | Share · `Inputs/Initial Deck/MG Airport Capablities.pdf` pp. 4–5 |
| **~85% pre-built / ~15% tailored**, and what the 15% is | Share · same, p. 4. Not in the product repo — a delivery claim, labelled as such. |
| Three ways in — Greenfield / Brownfield / Intelligent layer | Share · same, pp. 16–18 |
| 15 services · 5 airports · 12 AI systems · 70+ dashboards · 16+ bots · 8 departments · ±72h FIDS horizon | Share · same, pp. 1, 3, 6, 14 |
| ↓80% security paperwork · 100% offline-capable · 25% faster response · 35% CX uplift · 0 paper contracts · 4 CMS → 1 | Share · same, pp. 2, 8, 9, 10 |
| IDC Future Enterprise Award 2023 | Share · same, p. 7 |
| Four ROI levers; Energy as recommended lead module | Share · `Outputs/Airport-in-a-Box_Intelligent-Layer_Module-Blueprint_2026-07-23.pdf` |
| "ROI figures are indicative industry ranges, validated per airport in a short baseline assessment during onboarding" | Share · same, closing note. **Reproduced on screen wherever a range appears — this is a requirement, not a nicety.** |
| FEED STALE / OFFLINE degradation; ingest-only; air-gapped, no runtime network dependency | `~/projects/airports-in-a-box/README.md` (the AIB repo on the Linux box). Not in the Airport Hub repo. |

## AIRIS and Thinking Airport (v5 briefing)

| Claim | Source |
|---|---|
| AIRIS = AI Real-Time Integrated Solution, "the digital brain of the airport"; "like the iris of an eye, AIRIS enables an Airport to *see*" | AIRIS briefing §7.5, §10 |
| Thinking Airport = DXC's vision; AIRIS = the proof point; "Anticipate. Personalise. Adapt. Engage." | §7.1, §7.5 |
| Four pillars — Predictive Operations · Hyper-Personalised Journeys · Adaptive Infrastructure · Dynamic Commercial Ecosystem | §7.4, §8 |
| Detect → react → recover becomes sense → predict → decide → act; "predicting a queue 18 minutes before it forms" | §7.1, §8.1 |
| Gate change: 187 passengers, T3-14 → NT-103, 4-minute delay; manual 5–15 min across five stakeholder groups; 17 systems (AODB, A-CDM, event bus, FIDS, digital wayfinding, BHS …); **83 seconds** | §7.5, §9.1, §10 |
| Five personas and what each sees — APOC three options · passenger 18-second notification with map · security surge alert 15 minutes early · airline crew/network context · CFO cost avoidance per incident | §9.2 |
| Five lessons | §9.3 |
| 80–90% improvement vs manual; 98% orchestration; 18-second notifications; zero complaints; sub-minute coordination across 2 precincts / 5 terminals | §7.5, §10 "second slide" |
| Cost avoidance ≈ $13,620 per incident; > $1.5M annual projection — **illustrative, IATA benchmarks, requires the airport's own incident data** | §10. Always said with the caveat. |
| Top-3 core messages (passengers / partners / airport) | §7.3 |
| Biometric single identity curb to gate, privacy by design | §7.1, §8.2 |
| DXC MSI offer — seven parts; vendor-neutral; does not subcontract suppliers; procurement agent; ORAT hand-back; 80–100 core systems; interface pattern library | §2 |
| First MSI Hong Kong International (1990s); Western Sydney commissioned October 2025 then a 3-year managed-services award; Montreal managed services ("everything except the network"); project delivery with COTS | §2, §3. Stated in the doc as the public PTE brochure summary. |
| Partners at PTE — Airport Intelligence (Brussels Airport subsidiary, A130), Solace (D100), Mindgraph on the DXC stand; DXC–Mindgraph exclusive go-to-market agreement for agentic services on a data fabric | §4 |

## PTE Asia 2026 (visitor-facing only)

| Claim | Source |
|---|---|
| PTE Asia 2026, Singapore, 23–24 September, Marina Bay Sands Basement 2 Halls D & E; first Asia edition; ~3,500 attendees | PTE Asia brief p. 2 |
| DXC Gold Sponsor, 18 sqm booth **C120** | p. 2, p. 5 |
| Wed 23 Sep 10:20–10:40 solo talk "Tomorrow Airport… Today" (Gordon Heap, Principal Aviation); 12:00–12:40 panel "Designing the airport of tomorrow, Digital Masterplanning in Asia" (Daniel Biondi, CTO Asia Pacific); panel speakers from Perth Airports, GBIA, AOT; Passenger Experience Theatre | pp. 4, 13, 14 |
| Booth zones — A (LED wall 3360×1080: A1 Mindgraph gamification showcase, A2 hero), B (43" touchscreen: ROI calculator, use cases), C (32" pod: deep dives) | pp. 6–7 |
| 3-minute, 5-question survey via QR; token of appreciation: suit bag or Bluetooth luggage tracker | pp. 10–11, 17 |
| Offering focus — MSI (core), passenger experience, terminal operations, airport command & control | p. 2 |
| Executive core message (fragmented → coordinated real-time operating intelligence) | p. 3 |

## Brand

| Asset | Source |
|---|---|
| Midnight `#0e1020` · Canvas `#f6f3f0` · Sky `#a1e6ff` · Gold `#ffae41` · Peach `#ffc982` · True Blue `#4995ff` · Royal `#004aac` · Melon `#ff7e51` · Red `#d14600` | Share · `Inputs/Brand Guidelines/Color Palette ASE/DXC Brand Colors-RGB.ase` |
| GT Standard L Extended (Medium 500, Bold 700) · Inter (variable) | Share · `Inputs/Brand Guidelines/{GT_Standard_font,Inter_font}/` — inlined as data URIs in `assets/fonts.css` |
| Mindgraph logo is **not** in the software; partner branding sits on the venue screens | Per the 16 September call, recorded in the PTE stand build's README |

---

## Deliberately not used

- **Named client airports and airlines beyond DXC's public references.** The Malaysian
  references were sanitised out of the AIB codebase on purpose, and the v2 briefing said the
  Perth engagement was "for internal alignment only — confirm clearance". The v5 demo script
  names Perth Airport and Qantas; AIRIS does **not**. She says "a two-precinct, five-terminal
  hub". Hong Kong, Western Sydney and Montreal are used because the briefing presents them
  as the public PTE brochure summary. **Do not add a client name without clearance.**
- **Everything DXC-internal in the PTE brief**: the duty roster and personal phone numbers,
  the competitor list and the instruction not to share information with them, the attendee
  list, the campaign code and pipeline target, lead-capture / Salesforce process, dress code,
  media slots, DOOH plan. AIRIS is a booth assistant; none of that is hers to say.
- **Any price, rate card or per-seat figure.** Nothing in the sources supports one, and
  `knowledge.js` routes every pricing question to the account team. The AIRIS cost-avoidance
  figures are benefits, not prices, and are always caveated.
- **The stand games' content.** A separate piece of work; AIRIS only points to Zone A1.
- **Deployment secrets**: the Azure VM address, credentials, key files and `DEPLOYMENT.md`
  internals from the product repo.
