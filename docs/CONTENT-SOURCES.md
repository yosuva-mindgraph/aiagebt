# Where every claim came from

Nothing in the scenes or the knowledge base is invented. This is the map, so a
claim can be challenged in a meeting and traced in under a minute.

Two locations:

- **Share** — `/srv/samba/mindgraph1/Airports in a Box/` (the `/mindgraph1/…` path
  as seen from a Mac).
- **Product** — `~/projects/airports-hub/airport-hub/`, the Airport Hub repo itself.
  Where the product and a slide disagree, **the product wins** — a metadata file is
  a fact and a deck is a claim.

> **The product is called Intelligent Airport.** The share folder above, and the
> blueprint PDF cited under *Delivery*, were filed under the product's earlier name
> and their filenames still carry it. **Those are citations and they stay exactly as
> they are** — a source is identified by the name it was filed under, and a brand
> pass that edits the filenames makes every claim in this table untraceable. Two rows
> near the end of *Delivery* name the engine and the vision this product demonstrates;
> **neither of those is the product's name either**, and those rows exist precisely to
> keep the three apart. Leave all of it alone.

> **The deck quotes no figures any more.** Where a row below still names one, it is
> recording what the SOURCE holds — not a claim on screen. Two classes were removed by
> operator decision, across three passes. **Deployment-shape** counts went first in
> principle and last in practice: canonical entities, governed KPIs, mapped sources,
> control centres, shipped playbooks, agents, ML models, the passenger-flow prediction
> horizon. Every one of those is a function of the airport's own data estate and systems
> rather than a property of the platform — a different estate lands on a different count,
> so quoting ours implies theirs. **Track-record** figures went for a different reason:
> the services / airports / AI-systems / dashboards / bots / departments strip, the
> outcome percentages, the ~85/~15 delivery split, the ±72-hour horizon and the IDC award
> are DXC's history rather than the prospect's, and a room asked to accept them cannot
> check them.
>
> **The citations themselves stay exactly as they are**, for the same reason the filenames
> above do. The metadata files and PDFs are still the provenance for the *qualitative*
> statements that replaced the figures, and a reader who cannot see where a count came
> from is a reader who helpfully puts it back. Restoring one to a scene or a
> knowledge-base answer reverses a decision the operator has now taken three times; it is
> not a copy edit. What each row's **Claim** column describes is what is actually on
> screen today.

---

## Platform structure

| Claim | Source |
|---|---|
| Five areas: Airport Business · Data Fabric · Intelligence 360 · GRC · Settings | Product · `web/src/app/nav.ts` |
| The control centres — AOCC, ATC, EOC, NOC, SOC, with their full names and purposes | Product · `metadata/ops/centres/*.yaml` (five files). The **names** are on screen and the **count** is not: which centres an airport runs is its operating model's question. Scene 5's sixth card, "…and the next one", is the qualitative form of the same point. |
| AOCC subdomains (flight/FIDS, cargo, baggage, retail, airline, passenger, ticketing/DCS, vehicle/landside, feedback) and the ATC / EOC / NOC / SOC subdomains | Product · `metadata/ops/domains/{aocc,atc,eoc,noc,soc}.yaml` |
| Business domains — Energy, ESG, Facility, Safety Training, AVSEC, OT Security, Healthcare | Product · `metadata/ops/domains/business.yaml` |
| Applications — Passenger360, Revenue Management (Airline Billing / Airline Marketing / Routes), AIR Disaster Management, Connected Health, Roster | Product · `metadata/ops/domains/applications.yaml` |
| **"Adding a domain/subdomain is METADATA, not code … a new domain immediately gets the standard 'connect this data' dashboard and lights up when its entity is mapped"** | Product · `api/routes/domains.py`, module docstring. Quoted almost verbatim — it is the single strongest line in the codebase. |
| EOC follows ICAO Annex 14 / FAA Part 139 | Product · `metadata/ops/centres/eoc.yaml` |

## The data foundation

| Claim | Source |
|---|---|
| The canonical **entities**, named — Flight, FlightLeg, Bag, BagEvent, Passenger, Cargo, RetailTransaction, Energy, ESG, Roster\*, Rev\*, Pax\* … | Product · `metadata/canonical/schema.yaml` → `entities` (58 of them). The examples are on screen in scene 4 and the kb `data-model`; the count is not. The entity LIST is the load-bearing part — it is what makes "one model of the airport" concrete — so it survived the removal intact. |
| **Governed KPIs**, defined once over those entities and reused by every board, workflow, agent and answer | Product · `metadata/canonical/schema.yaml` → `kpis` (201 of them). "Defined once" is the claim scene 4 makes and its narration depends on; the count is not on screen. |
| The **mapped source feeds** — A-CDM staging, active flight, BHS messages and reclaim, self-bag-drop passenger/session, CUSS, VAMS vehicle and car-park, camera data, retail POS, ASQ, airline master data | Product · `metadata/sources/*.yaml` (21 files). The feeds are named on screen; how many an airport ends up with is a question about its estate. Scene 4's pipeline reads **Every / One / Once** where it used to read 21 / 58 / 201. |
| "One governed pipeline" — every tile resolves through `RequestService.query_canonical_as` | Product · `api/routes/domains.py` docstring |
| Catalog / lineage / glossary / governed explorer / documents / sources | Product · `web/src/app/nav.ts`, Data Fabric section |

## Build surfaces

| Claim | Source |
|---|---|
| Workflow trigger types — manual, schedule/cron, threshold on a governed measure, webhook, live event, another workflow's failure, **missing expected event (heartbeat)** | Product · `metadata/flows/nodes.yaml` |
| Action types — canonical query, ask an agent, branch, open alert (deduped), email, HTTP POST, REST call, Slack, Discord, Teams, Telegram, WhatsApp | Product · `metadata/flows/nodes.yaml` |
| **Shipped playbooks**, seeded disabled, and their eleven names — Flight OTP, Airline OTP, baggage SLA, cargo dwell, retail dip, complaint/ASQ, security screening, security wait, lounge capacity, IT availability, emergency response | Product · `metadata/flows/dxc_demo_use_cases.json` (the `flows` array holds eleven; its own `note` field wrongly says "nine"). The **names** are on screen in scene 8's side panel and the kb `playbooks`; the count is not. That discrepancy is why the count was worth distrusting even before the operator ruled on it. |
| The scene-8 example (security queue over the wait-time target for two minutes) | Product · same file, flow "Security wait above target" |
| App component library — hero, navbar, footer, kpi, chart, data-table, timeline, filter-bar, search, status-badge, flight-board, map, gallery, form | Product · `metadata/apps/components.yaml` |
| The shipped agents — Airport Hub Analyst, Ops Analyst, Baggage Analyst, Retail Analyst, Data Steward, Compliance Explainer | Product · `metadata/agents/*.yaml` (six of them). All six are named on screen in scene 9, on their own cards and in the narration; only the word "six" went. |
| Agents carry `risk_tier`, `purpose`, `model`, `tools`, `evaluation` | Product · `metadata/agents/main.yaml` and siblings |
| Agent catalog / runs / topology / evaluations / guardrails as surfaces | Product · `web/src/app/nav.ts`; `web/src/pages/agents/` |
| The shipped ML models — delay-predictor, pax-flow-forecaster, baggage-anomaly | Product · `metadata/agents/ml_models.yaml` (three of them, all three named on screen in scene 7's note and the kb `models`; the count is not). |
| The pax-flow forecaster alerts staffing **far enough ahead to open a lane before the queue forms** | Product · same file. **Uncited as to horizon**: the old "15–30 minutes ahead" in the kb `passenger-flow` never had a row here, which is part of why it went. How far ahead it lands depends on an airport's sensor coverage, feed latency and passenger flow, so the claim is now qualitative and needs no figure to stand up. |

## Governance

| Claim | Source |
|---|---|
| The obligations tracked — ICAO Annex 19 / 17 / 14, emergency plan, IGOM, slot punctuality, ESG, PDPA personal data, GDPR transfers, breach notification, access control, audit evidence, AI governance, model provenance | Product · `metadata/governance/obligations.yaml` (fourteen of them). Scene 10 and the kb `governance` **list** them and never counted them, so nothing changed on screen here. The Annex numerals are part of the standards' names and are not figures. |
| The risks scored, airport **and platform** — incl. data access scope, PII exposure, unapproved AI extraction | Product · `metadata/governance/risks.yaml` (fourteen of them). Listed, never counted, in scene 10 and the kb `risk-register`. |
| PDPA principles, retention schedules, cross-border | Product · `metadata/compliance/pdpa.yaml` |
| Column-level access matrix · Trust · Activity/audit · governance packs · proposed-vs-active policies and glossary | Product · `web/src/app/nav.ts`; `metadata/{policies,glossary,packs}/` |

## Delivery, proof and commercials

| Claim | Source |
|---|---|
| Sits-on-top-of list; speaks-every-protocol list; "plug into anything, replace nothing" | Share · `Inputs/Initial Deck/MG Airport Capablities.pdf` pp. 4–5 |
| **What is reused and what is tailored** — the model, pipelines, boards, KPIs, playbooks, agents and governance register are reused; brand and UX, terminal and zone maps, local regulations, language and currency, ops workflows and SLAs, and data migration are tailored | Share · same, p. 4, which puts it at **~85% pre-built / ~15% tailored**. The split came off the deck in g17: a brownfield estate with heavy legacy does not land at 15% tailoring, and it is the figure a COO holds us to eighteen months later, because it is a number about OUR side of the contract. Scene 11 now names what is in each half instead of sizing them. |
| Three ways in — Greenfield / Brownfield / Intelligent layer, with when-it-fits, approach, what-you-get and risk for each | Share · same, pp. 16–18 |
| **NOT ON SCREEN** — 15 services · 5 airports · 12 AI systems · 70+ dashboards · 16+ bots · 8 departments · ±72h FIDS horizon | Share · same, pp. 1, 3, 6, 14. Scene 11's track-record strip and the kb `proof` carried these; **both are gone**. They are DXC's history rather than the prospect's, and a strip of six figures was the loudest numeric object in the deck. The kb `proof` now answers the same question with the two pillars, the third-party cybersecurity ring fence, a reference call and a baseline. |
| **NOT ON SCREEN** — ↓80% security paperwork · 100% offline-capable · 25% faster response · 35% CX uplift · 0 paper contracts · 4 CMS → 1 | Share · same, pp. 2, 8, 9, 10. Removed in g15 (the benefit percentages) and this pass (the residue in scene 11's note). The source itself concedes the point — see the "indicative industry ranges" row below. The qualitative claims they backed survive: offline-capable in restricted zones, analyst time handed back, complaint response and CX improved. |
| **NOT ON SCREEN** — IDC Future Enterprise Award 2023 | Share · same, p. 7. Went with scene 11's note. Not a number, but the same class: it is the home-to-gate ecosystem's award at **those** airports, and it sat inside the paragraph the track-record removal took. Restoring it alone would re-open the "whose history is this?" question the pass exists to close. |
| Four ROI levers; the eleven-module blueprint and its HAVE / PARTIAL / TO BUILD status; Energy as recommended lead module | Share · `Outputs/Airport-in-a-Box_Intelligent-Layer_Module-Blueprint_2026-07-23.pdf` |
| "ROI figures are indicative industry ranges, validated per airport in a short baseline assessment during onboarding" | Share · same, closing note. This line is why the deck holds. **No range appears on screen any more**, so the requirement to caveat one is satisfied by there being nothing to caveat — read it as a floor, not a licence: if a figure is ever added back, this caveat rides with it. What the caveat used to do is now done positively, by scene 3's ROI note, scene 12's Baseline card and the kb `roi`, `data-model`, `sources`, `dashboards`, `proof` and `passenger-flow`, each of which says why there is no figure and points at the baseline. |
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
| Mindgraph logo, 200×200 RGBA — coral-to-gold node mark over a grey `MINDGRAPH` wordmark | Share · `Inputs/Brand Guidelines/Mindgraph Logo.png`, committed verbatim as `assets/mindgraph-logo.png` and cropped into two `data:` URIs in `src/styles.css` |

### The MindGraph logo: two surfaces, two decisions

These read as a contradiction and are not. They are decisions about **different
products**, taken five days apart, and each one still holds on its own surface.

| Surface | Decision | Source |
|---|---|---|
| **The PTE stand build** (separate repo, different audience) | The Mindgraph logo is **not** in the software; partner branding sits on the venue screens around it | Per the 16 September call, recorded in that build's README. Unchanged — nothing here touches it |
| **This presenter** (`index.html` header) | The MindGraph logo **is** in the software, in the header, as the first half of a `MindGraph × DXC` partner lockup | Per the operator, after the client demo. This **reverses** the line above *for this surface only* |

The reversal was asked for because the presenter's header carried the DXC mark
and the product name while MindGraph appeared only as text in scene 1's eyebrow
— on a deck that is a joint proposition, and that a stranger reads in ten
seconds. The stand's argument (the venue screens already carry the partner
brands, so the software need not) never applied to a file that is opened on a
laptop with no venue around it.

Two details of the implementation are themselves source decisions, recorded here
because the next person will otherwise read them as drift from the brand file:

- **The wordmark is knocked through to `--ink`, not painted grey.** The supplied
  grey measures **2.95:1 on the dark header** — below even the 3:1 floor for a
  non-text graphic, on the theme this deck defaults to. Knocked through it reads
  17.06:1 dark and 15.43:1 light. The letterforms are the brand's own and
  untouched; only the fill follows the theme, which is what the DXC mark beside
  it already does. `src/styles.css` carries both measurements.
- **The node mark keeps its own colours in both themes.** That coral-to-gold
  gradient is the logo. Its two ends resolve to `#E06F51` and `#FFAC49` — Melon
  and Gold to within a few points — so it sits inside the DXC ten by accident
  rather than by adjustment, and nothing was recoloured to make it fit. The
  price is the light theme, where those ends measure 2.62:1 and 1.53:1; the mark
  still reads because the coral strokes carry the shape, but if that is ever
  judged unacceptable the fix is **a reversed asset from MindGraph**, not a
  filter invented in this repo.

---

## Deliberately not used

- **Named clients, airports and airlines.** The Malaysian references were sanitised out
  of the product codebase on purpose (`sanitize: replace real Malaysian airport/airline
  references with approved fictional set`), and the AIRIS briefing states the Perth
  engagement is named "for internal alignment only — confirm clearance before
  referencing that client in any external-facing collateral." Iris used to say "five
  airports"; since the track-record removal she says only "airports that are already
  customers", and offers a reference call instead of naming one. **Do not put a client
  name in here without clearance** — and note that the un-named, un-counted form is now
  the deliberate one, not a placeholder waiting to be filled in.
- **Any price, rate card or per-seat figure.** Nothing in the sources supports one, and
  `knowledge.js` routes every pricing question to the account team.
- **The stand games.** A separate piece of work with a different audience; only the DXC
  brand pack is shared with it.
