# Where every claim came from

Nothing in the scenes or the knowledge base is invented. This is the map, so a
number can be challenged in a meeting and traced in under a minute.

Two locations:

- **Share** — `/srv/samba/mindgraph1/Airports in a Box/` (the `/mindgraph1/…` path
  as seen from a Mac).
- **Product** — `~/projects/airports-hub/airport-hub/`, the Airport Hub repo itself.
  Where the product and a slide disagree, **the product wins** — a metadata file is
  a fact and a deck is a claim.

---

## Platform structure

| Claim | Source |
|---|---|
| Five areas: Airport Business · Data Fabric · Intelligence 360 · GRC · Settings | Product · `web/src/app/nav.ts` |
| Five control centres — AOCC, ATC, EOC, NOC, SOC, with their full names and purposes | Product · `metadata/ops/centres/*.yaml` |
| AOCC subdomains (flight/FIDS, cargo, baggage, retail, airline, passenger, ticketing/DCS, vehicle/landside, feedback) and the ATC / EOC / NOC / SOC subdomains | Product · `metadata/ops/domains/{aocc,atc,eoc,noc,soc}.yaml` |
| Business domains — Energy, ESG, Facility, Safety Training, AVSEC, OT Security, Healthcare | Product · `metadata/ops/domains/business.yaml` |
| Applications — Passenger360, Revenue Management (Airline Billing / Airline Marketing / Routes), AIR Disaster Management, Connected Health, Roster | Product · `metadata/ops/domains/applications.yaml` |
| **"Adding a domain/subdomain is METADATA, not code … a new domain immediately gets the standard 'connect this data' dashboard and lights up when its entity is mapped"** | Product · `api/routes/domains.py`, module docstring. Quoted almost verbatim — it is the single strongest line in the codebase. |
| EOC follows ICAO Annex 14 / FAA Part 139 | Product · `metadata/ops/centres/eoc.yaml` |

## The data foundation

| Claim | Source |
|---|---|
| **58 canonical entities** (Flight, FlightLeg, Bag, BagEvent, Passenger, Cargo, RetailTransaction, Energy, ESG, Roster*, Rev*, Pax* …) | Product · `metadata/canonical/schema.yaml` → `entities` |
| **201 governed KPIs** | Product · `metadata/canonical/schema.yaml` → `kpis` |
| **21 mapped sources** — A-CDM staging, active flight, BHS messages and reclaim, self-bag-drop passenger/session, CUSS, VAMS vehicle and car-park, camera data, retail POS, ASQ, airline master data | Product · `metadata/sources/*.yaml` (21 files) |
| "One governed pipeline" — every tile resolves through `RequestService.query_canonical_as` | Product · `api/routes/domains.py` docstring |
| Catalog / lineage / glossary / governed explorer / documents / sources | Product · `web/src/app/nav.ts`, Data Fabric section |

## Build surfaces

| Claim | Source |
|---|---|
| Workflow trigger types — manual, schedule/cron, threshold on a governed measure, webhook, live event, another workflow's failure, **missing expected event (heartbeat)** | Product · `metadata/flows/nodes.yaml` |
| Action types — canonical query, ask an agent, branch, open alert (deduped), email, HTTP POST, REST call, Slack, Discord, Teams, Telegram, WhatsApp | Product · `metadata/flows/nodes.yaml` |
| **Eleven shipped playbooks**, seeded disabled | Product · `metadata/flows/dxc_demo_use_cases.json`. Note its own `note` field says "nine demo use cases" while the `flows` array holds eleven — the scenes use **eleven**, the actual count. |
| The scene-8 example (security queue over the wait-time target for two minutes) | Product · same file, flow "Security wait above target" |
| App component library — hero, navbar, footer, kpi, chart, data-table, timeline, filter-bar, search, status-badge, flight-board, map, gallery, form | Product · `metadata/apps/components.yaml` |
| Six agents — Airport Hub Analyst, Ops Analyst, Baggage Analyst, Retail Analyst, Data Steward, Compliance Explainer | Product · `metadata/agents/*.yaml` |
| Agents carry `risk_tier`, `purpose`, `model`, `tools`, `evaluation` | Product · `metadata/agents/main.yaml` and siblings |
| Agent catalog / runs / topology / evaluations / guardrails as surfaces | Product · `web/src/app/nav.ts`; `web/src/pages/agents/` |
| Three ML models — delay-predictor, pax-flow-forecaster, baggage-anomaly | Product · `metadata/agents/ml_models.yaml` |

## Governance

| Claim | Source |
|---|---|
| 14 obligations — ICAO Annex 19 / 17 / 14, emergency plan, IGOM, slot punctuality, ESG, PDPA personal data, GDPR transfers, breach notification, access control, audit evidence, AI governance, model provenance | Product · `metadata/governance/obligations.yaml` |
| 14 risks, airport **and platform** — incl. data access scope, PII exposure, unapproved AI extraction | Product · `metadata/governance/risks.yaml` |
| PDPA principles, retention schedules, cross-border | Product · `metadata/compliance/pdpa.yaml` |
| Column-level access matrix · Trust · Activity/audit · governance packs · proposed-vs-active policies and glossary | Product · `web/src/app/nav.ts`; `metadata/{policies,glossary,packs}/` |

## Delivery, proof and commercials

| Claim | Source |
|---|---|
| Sits-on-top-of list; speaks-every-protocol list; "plug into anything, replace nothing" | Share · `Inputs/Initial Deck/MG Airport Capablities.pdf` pp. 4–5 |
| **~85% pre-built / ~15% tailored**, and what the 15% is | Share · same, p. 4 |
| Three ways in — Greenfield / Brownfield / Intelligent layer, with when-it-fits, approach, what-you-get and risk for each | Share · same, pp. 16–18 |
| 15 services · 5 airports · 12 AI systems · 70+ dashboards · 16+ bots · 8 departments · ±72h FIDS horizon | Share · same, pp. 1, 3, 6, 14 |
| ↓80% security paperwork · 100% offline-capable · 25% faster response · 35% CX uplift · 0 paper contracts · 4 CMS → 1 | Share · same, pp. 2, 8, 9, 10 |
| IDC Future Enterprise Award 2023 | Share · same, p. 7 |
| Four ROI levers; the eleven-module blueprint and its HAVE / PARTIAL / TO BUILD status; Energy as recommended lead module | Share · `Outputs/Airport-in-a-Box_Intelligent-Layer_Module-Blueprint_2026-07-23.pdf` |
| "ROI figures are indicative industry ranges, validated per airport in a short baseline assessment during onboarding" | Share · same, closing note. **Reproduced on screen wherever a range appears — this is a requirement, not a nicety.** |
| AIRIS = AI Real-Time Integrated System; "like an iris, AIRIS enables an Airport to *see*" | Share · `Inputs/Thinking_Airport_AIRIS_Briefing - v2[28].docx` |
| Thinking Airport = the vision; AIRIS = the proof point. Keep distinct. | Share · same |
| 83-second coordination vs 5–15 min manual; 17 systems orchestrated | Share · same. **Demonstrated**, per that document. |
| Financial figures around AIRIS are illustrative, modelled on IATA/ICAO benchmarks | Share · same, "Reading the numbers correctly" |
| FEED STALE / OFFLINE degradation; ingest-only; air-gapped, no runtime network dependency | `~/projects/airports-in-a-box/README.md` |

## Brand

| Asset | Source |
|---|---|
| Midnight `#0e1020` · Canvas `#f6f3f0` · Sky `#a1e6ff` · Gold `#ffae41` · Peach `#ffc982` · True Blue `#4995ff` · Royal `#004aac` · Melon `#ff7e51` · Red `#d14600` | Share · `Inputs/Brand Guidelines/Color Palette ASE/DXC Brand Colors-RGB.ase` |
| GT Standard L Extended (Medium 500, Bold 700) · Inter (variable) | Share · `Inputs/Brand Guidelines/{GT_Standard_font,Inter_font}/` — inlined as data URIs in `assets/fonts.css` |
| Mindgraph logo is **not** in the software; partner branding sits on the venue screens | Per the 16 September call, recorded in the PTE stand build's README |

---

## Deliberately not used

- **Named clients, airports and airlines.** The Malaysian references were sanitised out
  of the AIB codebase on purpose (`sanitize: replace real Malaysian airport/airline
  references with approved fictional set`), and the AIRIS briefing states the Perth
  engagement is named "for internal alignment only — confirm clearance before
  referencing that client in any external-facing collateral." Iris says "a live hub
  airport group" and "five airports". **Do not put a client name in here without
  clearance.**
- **Any price, rate card or per-seat figure.** Nothing in the sources supports one, and
  `knowledge.js` routes every pricing question to the account team.
- **The stand games.** A separate piece of work with a different audience; only the DXC
  brand pack is shared with it.
