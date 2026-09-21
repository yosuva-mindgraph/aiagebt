/* ============================================================================
   The knowledge base.

   Iris answers from this when no LLM key is configured, and an LLM is given
   the matching entries as grounding when one IS configured. Either way the
   facts come from here, so the answer is the same shape in a boardroom with
   no network as it is on a laptop with one.

   Every entry is traceable to a source document or to the product's own
   metadata — see docs/CONTENT-SOURCES.md. If it is not in a source, it is not
   in here. An unanswerable question gets an honest "I don't know", which is
   the behaviour that survives a room full of operators.

   Fields:
     k      keywords and synonyms — scored against the question
     scene  scene id to offer as a jump
     a      the answer, in Iris's voice (HTML allowed)
   ========================================================================== */

export const KB = [

/* ── what it is ─────────────────────────────────────────────────────────── */
{
  id: 'what-is-it',
  k: 'what is the intelligent airport platform what does it do overview explain product summary tell me about',
  scene: 'open',
  a: `<p>Intelligent Airport is a <b>platform</b> that sits on top of the systems an airport
     already runs — it replaces none of them.</p>
     <p>It reads every source system into <b>one governed model of the airport</b>: the canonical
     entities your airport actually runs on, and the KPIs over them, <b>defined once</b>. On top of that
     model you get a governed assistant you can ask anything, and four build surfaces —
     <b>dashboards, applications, workflows and AI agents</b> — all of which your own people build,
     without an engineering ticket.</p>
     <p>The important distinction: it is not a fixed menu of modules. Adding a business domain or a
     control centre is <b>metadata, not code</b>. That is why I won't give you a finite list of use
     cases — the list is however many your airport has.</p>`
},
{
  id: 'platform-not-product',
  k: 'platform or product difference fixed modules menu list of use cases limited endless unbounded roadmap ceiling',
  scene: 'model',
  a: `<p>A product gives you a fixed set of screens and a roadmap you wait on. A platform gives you the
     data foundation and the tools to build on it yourself.</p>
     <p>Concretely: adding a business domain or a control centre writes a metadata file. It arrives with
     the standard governed dashboard immediately and lights up the moment its entity is mapped. No
     release, no ticket, no waiting on us.</p>
     <p>Same for boards, apps, workflows and agents — the twentieth costs what the second did. That is
     what "unbounded" actually means, and it is the whole commercial argument.</p>`
},
/* ── the three names, and why they are TWO entries ─────────────────────────
   The entry named name-airis answers "which of these is which?" — it is the
   disambiguator, and it leads with AIRIS because that is the name people hear
   and cannot place. The entry named thinking-airport, below it, answers "what
   IS the Thinking Airport?" — a different question, which wants the vision
   first rather than a glossary.

   Splitting them is deliberate, not duplication. Folding the vision into the
   disambiguator would mean that question got an answer opening "AIRIS is the
   AI Real-Time Integrated System…", which is a correct paragraph about
   something else. Both entries end by holding the three apart, because the one
   failure that matters here is letting any two of them merge:

       Intelligent Airport — the PRODUCT. What is bought and delivered.
       Thinking Airport    — DXC's VISION. A framework, not a purchasable thing.
       AIRIS               — the named PROOF POINT inside that vision.

   src/ask.js's system prompt says the same thing to the LLM, and
   docs/CONTENT-SOURCES.md keeps the sources apart on the same grounds.
   ------------------------------------------------------------------------ */
{
  id: 'name-airis',
  k: 'airis what does airis mean thinking airport name iris acronym three names difference between distinguish which is which',
  scene: 'open',
  a: `<p><b>AIRIS</b> is the AI Real-Time Integrated System — the name for the real-time intelligence that
     connects the airport's systems and puts customer experience at the centre of the decision. The
     briefing puts it well: <i>like an iris, it lets the airport see and understand its own
     operations.</i></p>
     <p><b>Thinking Airport</b> is the wider DXC vision it demonstrates — predictive operations,
     hyper-personalised journeys, adaptive infrastructure and a dynamic commercial ecosystem. Keep the
     two distinct: Thinking Airport is the framework, AIRIS is the proof point.</p>
     <p><b>Intelligent Airport</b> is the third name in that family: the product itself — the one
     you'd actually be buying, and what I'm walking you through today.</p>
     <p>And I'm Iris — I just do the talking.</p>`
},
{
  id: 'thinking-airport',
  k: 'thinking airport dxc vision framework living ecosystem adaptive person-centric ai-driven anticipating personalising journeys predictive operations infrastructure dynamic commercial ecosystem pillars aspiration',
  scene: 'open',
  a: `<p><b>Thinking Airport</b> is DXC's vision for the AI-driven, person-centric, adaptive airport.
     The briefing states it in one line: it turns a fixed piece of infrastructure into a
     <b>living ecosystem</b>, anticipating, personalising and adapting in real time, for passengers
     and partners alike.</p>
     <p>It is a single framework spanning <b>predictive operations</b>, <b>hyper-personalised
     journeys</b>, <b>adaptive infrastructure</b>, and a <b>dynamic commercial ecosystem</b>.</p>
     <p>Three names here, and they don't collapse into one. Thinking Airport is the <b>vision</b>.
     <b>AIRIS</b> is the proof point that demonstrates it. <b>Intelligent Airport</b> is the
     <b>product</b> — the one you'd actually be buying, and what I'm walking you through today. The
     product is how an airport gets a foundation the vision can stand on.</p>`
},

/* ── the data foundation ────────────────────────────────────────────────── */
{
  id: 'data-model',
  k: 'data model canonical entities schema kpi kpis how many single source of truth semantic layer definition',
  scene: 'data',
  a: `<p>Source systems land in the lakehouse and are mapped into <b>one canonical model</b> — flight,
     flight leg, bag, bag event, passenger, check-in, cargo, retail transaction, parking, energy, ESG,
     facility, roster, revenue, sensor, emergency event, IT system, security event and so on — with the
     <b>governed KPIs</b> defined on top of them.</p>
     <p>I won't quote you a number of entities or a number of KPIs, because it isn't a fixed property of
     the product. It falls out of the source systems <i>your</i> airport runs and the measures <i>your</i>
     airport is held to — a different estate lands on a different model, which is what the baseline
     assessment maps.</p>
     <p>Defined once is the point. On-time performance means the same thing in a dashboard, in a
     workflow's threshold, in an agent's answer and in the board that goes to your regulator. There is
     exactly one place to change a definition, and exactly one place to audit who saw what.</p>`
},
{
  id: 'sources',
  k: 'data sources feeds connect integration how many sources what systems ingest mapped',
  scene: 'data',
  a: `<p>The feeds mapped today include A-CDM staging, active flight, baggage handling messages and
     reclaim, self-bag-drop passenger and session data, CUSS check-in, vehicle access and car-park
     transactions, camera data, retail POS, ASQ survey data and airline master data.</p>
     <p>How many you end up with is a question about your estate rather than about the product — you
     connect the systems you run, and the answer is however many that is.</p>
     <p>New sources connect through the same layer: real-time streaming, scheduled ETL, REST pulls,
     webhooks, file drops — and RPA where a system has no API at all. Mapping a new system's entity into
     the canonical model lights up everything downstream with no downstream change.</p>`
},
{
  id: 'catalog',
  k: 'catalog lineage glossary documents explorer sql who can query metadata discovery',
  scene: 'data',
  a: `<p>Around the model sits the data fabric: a <b>catalog</b> of every table and document with
     <b>lineage</b> back to source and forward to everything that consumes it; a <b>business glossary</b>
     binding the word a director uses to the field an engineer built; a <b>governed SQL explorer</b> for
     people who want SQL — through the same pipeline, so masking, row policies and audit apply
     identically; and <b>document search</b> over SOPs, data dictionaries and policy documents, so
     "what is our rule for this?" is answerable alongside "what is the number".</p>`
},

/* ── the airport model ──────────────────────────────────────────────────────
   NO COUNT SURVIVES A LIST THAT IS PRINTED BESIDE IT. Four entries in this file
   used to size the thing they then enumerated — the AOCC's subdomains below,
   Revenue Management's applications, the navigation's areas under `governance`,
   and the Thinking Airport framework's strands under `thinking-airport`. Each
   count is redundant against the list, each moves with a release or with the
   airport's own operating model, and one surviving figure invites "why is that
   one quotable when nothing else is". The lists all stayed; only the numbers
   went. docs/CONTENT-SOURCES.md carries the source and the reasoning per row.

   Do not restate a removed figure in a comment either: build.js inlines this
   file into dist/index.html verbatim, so a number in a comment is a number a
   prospect finds in View Source. Keep the reasoning, drop the quotation.
   ------------------------------------------------------------------------ */
{
  id: 'control-centres',
  k: 'control centres aocc atc eoc noc soc operations tower emergency network security centre',
  scene: 'model',
  a: `<p>The control centres modelled today:</p>
     <ul>
       <li><b>AOCC</b> — day-to-day flight, baggage, passenger and resource operations. Its subdomains:
         flight/FIDS, cargo, baggage, retail, airline, passenger, ticketing/DCS, vehicle/landside, feedback.</li>
       <li><b>ATC</b> — runway and airspace movements: runway movements, tower watch, airspace feed.</li>
       <li><b>EOC</b> — crisis coordination per the Airport Emergency Plan (ICAO Annex 14 / FAA Part 139):
         emergency incidents, response resources, mass notification and mustering.</li>
       <li><b>NOC</b> — the technology backbone: system uptime, network and telecoms, IT incidents.</li>
       <li><b>SOC</b> — physical and cyber together: CCTV and access control, checkpoint screening,
         perimeter and restricted areas, cyber/SIEM.</li>
     </ul>
     <p>And the next one is whichever you need — a centre is a metadata file, not a release. Which
     centres your airport ends up running is your operating model's question, not ours.</p>`
},
{
  id: 'domains-apps',
  k: 'business domains applications energy esg facility safety avsec ot security passenger360 revenue roster disaster health what applications',
  scene: 'model',
  a: `<p><b>Business domains:</b> Energy Management, ESG and carbon, Facility Management (CMMS), Safety
     Training, AVSEC, OT Security, Healthcare.</p>
     <p><b>Applications already built on the platform:</b> Passenger360 (live flow on the sensor estate —
     queues, check-in, fill level, objects and PRM, forecasts, a live 2D floor and a 3D twin layer);
     Revenue Management (airline billing from tariff through incentive credit to collection, the airline
     marketing incentive programme, and route development from opportunity to ROI); AIR Disaster
     Management; Connected Health; Roster Management.</p>
     <p>These are where airports start. They are not where the platform stops.</p>`
},
{
  id: 'add-domain',
  k: 'add new domain module custom extend metadata not code build our own new use case bespoke',
  scene: 'model',
  a: `<p>An administrator adds it inside the product. Name the domain, give it subdomains, point them at
     canonical entities — the platform writes the metadata file and the domain arrives with the standard
     governed dashboard. It lights up as soon as its entity is mapped.</p>
     <p>This is the line I'd hold onto: <b>adding a domain is metadata, not code.</b> No release cycle,
     no professional-services engagement, no place in our backlog.</p>`
},

/* ── ask / assistant ────────────────────────────────────────────────────── */
{
  id: 'assistant',
  k: 'assistant ask question natural language plain english chatbot nl query kai analytics reports analyst',
  scene: 'ask',
  a: `<p>Anyone asks an operational question in plain language and gets an answer with a chart, in
     seconds, across every connected source at once. No SQL, no ticket to the analytics team, no two-day
     wait for a report that was stale on delivery.</p>
     <p>It runs under the asker's own identity through the same governed pipeline — so column masking and
     row policies apply, and it can only see what that person is allowed to see. It names the entities
     and KPIs it resolved through, so a sceptical director can follow the number back to source. And it
     is logged.</p>
     <p>In practice this is where analyst time gets handed back — they stop running other people's
     reports. How much depends on how much of that work your analysts are doing today, which is one of
     the things a baseline assessment measures.</p>`
},
{
  id: 'hallucination',
  k: 'hallucinate hallucination wrong answer made up invent accuracy trust the answer confident incorrect',
  scene: 'ask',
  a: `<p>Three things reduce it to something an operator can live with.</p>
     <ul>
       <li>It does not free-associate over a corpus — it resolves through the canonical model and the
         governed KPI definitions. The number comes from a query, not from a memory.</li>
       <li>Every answer cites the entities and KPIs it went through, so it is checkable.</li>
       <li>An ambiguous question comes back as a question. That is deliberate — a confident wrong
         number is worse than no number in an ops room.</li>
     </ul>
     <p>And agents have evaluation suites that run against them, so drift is caught by the evals rather
     than by a passenger.</p>`
},

/* ── build surfaces ─────────────────────────────────────────────────────── */
{
  id: 'dashboards',
  k: 'dashboards boards how many dashboards build a dashboard charts tiles reports publish share viewer',
  scene: 'build',
  a: `<p>A dashboard is a canvas of tiles over any governed measure, in any combination — built by the
     person who needs it, saved, and shared. Any board can be <b>published</b> to an audience (a partner,
     an executive, a regulator) with its own access scope.</p>
     <p>There is no fixed set. Every tile resolves through the governed pipeline, so a board cannot show
     a number its viewer is not allowed to see — which is what makes "let them build their own" a safe
     sentence rather than a reckless one.</p>
     <p>How many you end up with is not a number I can give you — that is the point of the surface. The
     twentieth board costs what the second did, so the ceiling is your people's appetite rather than our
     roadmap.</p>`
},
{
  id: 'apps',
  k: 'apps applications build an app app builder generate low code no code studio component',
  scene: 'build',
  a: `<p>Describe the application you want on your data and it is generated against the canonical model,
     assembled from a component library — hero, navbar, KPI row, chart, data table, timeline, filter bar,
     search, status badge, flight board, map, gallery, form — then edited by hand where you want it
     exact.</p>
     <p>Generated apps inherit the same access scopes and audit trail as everything else. They are not a
     side door to the data.</p>`
},
{
  id: 'workflows',
  k: 'workflow workflows automation automate playbook triggers nodes n8n flows alerting schedule cron webhook',
  scene: 'build',
  a: `<p>Workflows are built on a canvas of trigger and action nodes.</p>
     <p><b>Triggers:</b> manual run, schedule or cron, a governed measure crossing a threshold, an
     inbound webhook, a live push event, another workflow failing (the error-handler pattern), and —
     the one people forget — <b>an expected event that never arrived</b>. A silent feed is a fault, and
     a dashboard reading zero looks identical to one reading nothing until something asks.</p>
     <p><b>Actions:</b> query the lakehouse through the canonical schema, ask a registered agent, branch,
     open an alert in the operations register (raised once, not again while it is open), email via the
     relay, POST to any REST API, or notify Slack, Teams, Discord, Telegram or WhatsApp.</p>
     <p>Playbooks ship with the product, disabled, so a fresh install has something real to turn on
     deliberately.</p>`
},
{
  id: 'playbooks',
  k: 'shipped playbooks examples eleven nine use cases demo what workflows come with it out of the box',
  scene: 'live',
  a: `<p>Shipped and switched off until you enable them: Flight OTP &amp; delay watch · Airline OTP &amp;
     cancellations monitor · Baggage mishandling &amp; first-bag SLA · Cargo dwell &amp; throughput watch ·
     Retail non-aero revenue dip · Customer-complaint &amp; ASQ watch · Security screening &amp; breach
     watch · Security wait above target · Lounge at capacity · IT system availability &amp; SLA breach ·
     Emergency response watch.</p>
     <p>They are examples of the shape, not the limit of it. Swap any node and it is a different
     workflow entirely.</p>`
},

/* ── agents ─────────────────────────────────────────────────────────────── */
{
  id: 'agents',
  k: 'agents ai agents how many agents what agents bot autonomous llm which agents',
  scene: 'agents',
  a: `<p>These ship today: <b>Airport Hub Analyst</b> (the general analyst, routes to the specialist that
     owns the question), <b>Ops Analyst</b>, <b>Baggage Analyst</b>, <b>Retail Analyst</b>,
     <b>Data Steward</b> (catalog, lineage and glossary hygiene — proposes, never decides) and
     <b>Compliance Explainer</b>. You register your own the same way.</p>
     <p>An agent here is a registered object, not a prompt somebody pasted into a chat window. Each
     carries a purpose, a declared risk tier, a declared tool set, its own governed data scope, an
     evaluation suite and guardrails — plus a full run history and a topology view of what calls what.</p>`
},
{
  id: 'agent-safety',
  k: 'agent see data it should not overreach guardrail scope risk tier permission agent security stop an agent rogue',
  scene: 'agents',
  a: `<p>Four mechanisms, and none of them live in the prompt.</p>
     <ul>
       <li><b>Data scope.</b> The agent runs through the same governed pipeline as everyone else. Column
         masking and row policies are applied by the pipeline, so an agent cannot see what its scope
         forbids — whoever asked it.</li>
       <li><b>Risk tier.</b> Declared, not inferred. What an agent may reach is a function of its tier,
         and changing a tier is itself a governed change.</li>
       <li><b>Declared tools.</b> Written down and rendered in the topology view, so "what can this thing
         actually do?" has a visual answer.</li>
       <li><b>Guardrails and evaluations</b> enforced outside the model, with a replayable run history.</li>
     </ul>
     <p>And anything irreversible waits in the approvals inbox for a person.</p>`
},
{
  id: 'human-in-loop',
  k: 'human in the loop approval approve gate who decides autonomous safe irreversible sign off',
  scene: 'live',
  a: `<p>The machine does the watching, the querying, the explaining and the drafting. <b>A person makes
     the call.</b></p>
     <p>Anything irreversible lands in a single approvals inbox and waits. That is the shape of the
     platform rather than a setting on it — which is what makes it safe to point at a live airport
     rather than at a lab.</p>`
},
{
  id: 'models',
  k: 'ml models prediction forecast predictive delay predictor pax flow baggage anomaly which llm engine model',
  scene: 'build',
  a: `<p>Forecast models ship alongside the platform: a <b>delay predictor</b>, a <b>passenger-flow
     forecaster</b> and a <b>baggage anomaly</b> detector. They sit in the same catalog under the same
     provenance rules as everything else.</p>
     <p>Which LLM engine serves which purpose is an administrator setting — you can point it at your own
     engines and swap them without touching a single board or workflow. Model provenance is tracked as a
     governance obligation, not an afterthought.</p>`
},

/* ── governance ─────────────────────────────────────────────────────────── */
{
  id: 'governance',
  k: 'governance compliance grc regulation icao iata annex obligation audit regulator standards',
  scene: 'governance',
  a: `<p>Governance is in the navigation, not a module sold later — and it governs the platform as well
     as the airport.</p>
     <p><b>Obligations tracked:</b> ICAO Annex 19 safety management, Annex 17 security, Annex 14
     aerodrome, the Airport Emergency Plan, IGOM ground operations, slot punctuality, ESG reporting
     (against ACI, GRI and Airport Carbon Accreditation), personal-data protection, cross-border
     transfer, breach notification, access control, audit evidence, AI governance, and model
     provenance.</p>
     <p>Obligations and policies ship as <b>governance packs</b>, so a new airport starts from the
     aviation baseline rather than a blank register.</p>`
},
{
  id: 'risk-register',
  k: 'risk register risks scored what risks runway incursion cyber breach exposure',
  scene: 'governance',
  a: `<p>The register scores both sides of the house on one scale.</p>
     <p><b>The airport:</b> runway incursion · emergency readiness · AVSEC breach · OT cyber · OTP
     degradation · baggage SLA · disruption · resource shortfall · aeronautical revenue concentration ·
     non-aero shortfall · ESG targets.</p>
     <p><b>The platform itself:</b> data access scope · personal-data exposure · unapproved AI
     extraction. It carries its own risks in the same register — because a tool that cannot be audited
     is a risk to the airport that bought it.</p>`
},
{
  id: 'privacy',
  k: 'privacy pdpa gdpr personal data pii retention cross border biometric data protection',
  scene: 'governance',
  a: `<p>Personal-data handling is modelled explicitly: principles for notice and choice, disclosure,
     security, retention, data integrity and access; documented retention schedules; and cross-border
     transfer rules. Breach notification is an obligation in the register with the rest.</p>
     <p>Underneath it, a <b>column-level access matrix</b> — masking applied by the pipeline, so it holds
     identically for a board, a query, a workflow and an agent. Plus a trust view covering data
     protection and AI governance posture, and an audit trail across every surface.</p>
     <p>Privacy is designed in from the start rather than bolted on — that is the position, and the
     access matrix is what makes it a claim you can inspect.</p>`
},
{
  id: 'audit',
  k: 'audit trail logging who saw what telemetry activity evidence traceability prove',
  scene: 'governance',
  a: `<p>Every surface writes to one audit trail: who asked, under what scope, what came back, and what
     was approved. Activity and telemetry are a first-class view, not a log file someone has to go and
     find.</p>
     <p>The commercial point: an airport is a regulated environment, and the question that kills AI
     pilots is never "is it clever". It is "can you show me who saw what, and why the model said that".
     This answers both.</p>`
},

/* ── deployment ─────────────────────────────────────────────────────────── */
{
  id: 'onprem',
  k: 'on premise cloud air gapped offline no network deploy where does it run hosting sovereign',
  scene: 'deploy',
  a: `<p>Cloud, on-premise, hybrid, or <b>fully air-gapped</b> — no cloud or network dependency at
     runtime. That last one is not a marketing line: it is built for a restricted ops room with the
     Wi-Fi switched off.</p>
     <p>And it degrades honestly. When a feed or the backend drops, the board keeps rendering the last
     known state behind a clear <b>FEED STALE</b> banner and says how old it is — because a dark screen
     in an operations room is worse than an old one.</p>`
},
{
  id: 'onboarding',
  k: 'onboard onboarding how long timeline implementation deploy time greenfield brownfield intelligent layer migrate',
  scene: 'deploy',
  a: `<p>Three ways in, and which one fits you is a five-minute conversation rather than a proposal.</p>
     <ul>
       <li><b>Greenfield</b> — no entrenched estate. Deploy the full pre-built platform on the reference
         architecture and configure brand, zones and workflows. Fastest route to modern; main risk is
         change management.</li>
       <li><b>Brownfield</b> — ageing or siloed systems to consolidate. Assess and map the estate, deploy
         in parallel behind an integration bridge, migrate and validate, cut over module by module with
         a rollback at every step. Phased, never big-bang.</li>
       <li><b>Intelligent layer</b> — your systems stay exactly as they are and we overlay on top.
         Fastest ROI and lowest disruption of the three; the risk is source-system API access, mitigated
         by the adapter library and a validation layer.</li>
     </ul>
     <p>Whichever way in you take, most of what you deploy already exists and is proven. What gets
     tailored is brand and UX, terminal and zone maps, local regulations, language and currency, ops
     workflows and SLAs, and data migration. How much tailoring yours needs depends on your estate —
     a new terminal and a brownfield consolidation are not the same job — which is what the baseline
     assessment sizes.</p>`
},
{
  id: 'replace-systems',
  k: 'replace rip out aodb existing systems do we have to change swap remove vendor lock legacy',
  scene: 'proposition',
  a: `<p>No. It replaces nothing.</p>
     <p>Source systems are untouched — read, and written only where you have explicitly opened that door,
     through APIs and the service bus. Ingest-only is the default. No replacement, no downtime, value
     added incrementally.</p>
     <p>That is the entire premise: airports do not have a systems problem, they have a coordination
     problem sitting on top of systems that already work, and a data problem underneath it that nobody
     has solved once, properly, in one place.</p>`
},

/* ── proof and commercials ──────────────────────────────────────────────── */
{
  id: 'proof',
  k: 'proof real proven track record production live today reference customer who uses it evidence credibility',
  scene: 'deploy',
  a: `<p>It is in production today rather than in a lab. The live estate is built on two pillars —
     <b>Digital &amp; Cloud</b> and <b>Data &amp; AI</b> — ring-fenced by a third-party cybersecurity
     layer, with services, AI systems, dashboards and automation bots in daily use at airports that are
     already customers.</p>
     <p>What I won't do is put figures on that. Not a count of deployments, not a percentage, not a
     benefit. Every one of those was measured at those airports, against their baselines and their
     estates — quoting them to you implies they are what yours would be, and today nobody knows that.</p>
     <p>So the honest form of proof is a reference call and a baseline. Ask the MindGraph and DXC team
     to put you in front of an airport already running it, and let the baseline assessment produce your
     numbers out of your own systems. That is proof you can check, rather than proof you have to
     take.</p>`
},
{
  id: 'roi',
  k: 'roi return on investment business case payback cost savings numbers guarantee benefit money value',
  scene: 'proposition',
  a: `<p>Four levers, and every capability is measured against one of them: <b>cost out</b> (utilities,
     maintenance, labour), <b>capex deferred</b> (sweat the stands, belts and terminal you already own),
     <b>revenue up</b> (non-aero spend per passenger on the same footfall), and <b>risk removed</b>
     (compliance, carbon and security exposure closed, with the audit trail behind it).</p>
     <p>I'll be straight with you about the numbers: I am not going to quote you one. What each lever
     is worth varies enormously by airport — traffic mix, cost base, what you have already automated —
     so a percentage lifted from somebody else's airport tells you nothing reliable about yours.</p>
     <p>Your numbers come out of a short baseline assessment against your own systems, incident volume
     and cost data during onboarding. Anything you hear before that is a starting point for discovery,
     not a commitment.</p>`
},
{
  id: 'where-to-start',
  k: 'where do we start first module pilot proof of concept poc quick win next step trial',
  scene: 'talk',
  a: `<p>The shortest honest next step is small. Point it at two or three of your real feeds, let it build
     the canonical model for them, and then have <b>your own people</b> build a board, a workflow and an
     agent on top — without us in the room.</p>
     <p>You'll know inside a fortnight whether what I've told you is true, and the test is the one that
     actually matters: can your team extend it, or do they have to call us.</p>
     <p>If you'd rather lead with a contained P&amp;L win instead, energy and utilities is the usual
     starting point — fastest payback and the most visible line on the airport P&amp;L.</p>`
},
{
  id: 'competitors',
  k: 'competitors different from others why you sita amadeus veovo how are you different differentiator alternative',
  scene: 'proposition',
  a: `<p>Three things I'd put forward, and you should press on all of them.</p>
     <ul>
       <li><b>It is an overlay, not a replacement.</b> Nothing gets ripped out, so the decision is not
         bet-the-airport.</li>
       <li><b>It is a platform your team extends.</b> A new domain is metadata, not a change request to
         us. Most of the market sells you a fixed application and a roadmap.</li>
       <li><b>Governance is in the navigation, not in an appendix</b> — and the platform carries its own
         risks in the same register as the airport's.</li>
     </ul>
     <p>What I won't claim is that nobody else does queue prediction or a command dashboard. Plenty do.
     The difference is what happens on the day you want the twentieth thing built.</p>`
},
{
  id: 'build-our-own',
  k: 'build our own without you self service do we need you professional services dependency team extend',
  scene: 'build',
  a: `<p>Yes — that is the design intent, and I'd make it the acceptance test for the whole engagement.</p>
     <p>Dashboards, applications, workflows and agents are all built inside the product by the people who
     need them. Adding a business domain is an administrator action. The governed pipeline is what makes
     that safe: whatever your team builds inherits the same access scopes, masking and audit, so
     self-service does not mean ungoverned.</p>`
},
{
  id: 'security',
  k: 'security cyber secure zero trust rbac access control who can see what permissions roles',
  scene: 'governance',
  a: `<p>Access is enforced by the pipeline rather than by each surface: a <b>column-level access
     matrix</b> with masking and row policies, applied identically to a board, a query, a workflow and an
     agent. Members and access are managed as groups, grants and packs, with an editor / viewer split so
     most of the building can read the platform safely.</p>
     <p>In the wider production estate, the cybersecurity ring fence is a third-party layer: zero-trust
     access control, 3D zone mapping, air-gapped offline operations and video anomaly detection.</p>`
},
{
  id: 'passenger-flow',
  k: 'passenger flow queue congestion spectra xovis sensor prediction wait time security queue passenger360',
  scene: 'model',
  a: `<p>Passenger360 runs live flow on the sensor estate — queues, check-in, fill level, object and PRM
     counts, forecasts, a live 2D floor and a 3D twin layer, modelled as its own canonical entities (zone,
     line, sensor, process point, occupancy, queue, heat, forecast, alert).</p>
     <p>The prediction side calls congestion at security, immigration and check-in from IoT sensor trends
     and the flight schedule, and alerts staffing <b>while there is still time to act on it</b> — far
     enough ahead that a duty manager can open a lane before the queue forms, rather than reading about
     it once it is visible on the ground.</p>
     <p>How far ahead that lands is your airport's answer rather than ours. It falls out of your sensor
     coverage, your feed latency and how passengers actually move through your terminal, which is what
     the baseline measures. Shipped playbooks ride on it: a security queue over target for two minutes,
     and a lounge reaching capacity.</p>`
},
{
  id: 'energy',
  k: 'energy utilities power consumption cost carbon esg sustainability emissions bms scada meters',
  scene: 'model',
  a: `<p>Energy Management is a business domain on the platform — cooling-energy, chiller-plant and
     utilities analytics over BMS, SCADA, smart meters, HVAC and lighting: live consumption and cost by
     terminal, zone and asset, with anomaly and waste detection.</p>
     <p>ESG sits beside it for sustainability, emissions and carbon reporting against ACI, GRI and Airport
     Carbon Accreditation, with ESG reporting tracked as a governance obligation.</p>
     <p>It is the usual first module when an airport wants one contained, high-visibility P&amp;L win
     before scaling. What it is worth depends on your tariffs, your climate and how your plant runs
     today, so the number comes out of a baseline against your own meters rather than out of a
     brochure.</p>`
},
{
  id: 'revenue',
  k: 'revenue billing airline charges invoice incentive marketing routes commercial non aero retail monetise',
  scene: 'model',
  a: `<p>Revenue Management is a set of applications on the governed ledger.</p>
     <ul>
       <li><b>Airline Billing</b> — tariff → gross charges → incentive credit → net invoice → collection.</li>
       <li><b>Airline Marketing</b> — the incentive programme: eligibility, quarterly computation,
         validation and lock.</li>
       <li><b>Routes</b> — market opportunity → business case → agreement → launch → performance → ROI,
         with AI scoring on the opportunity.</li>
     </ul>
     <p>On the non-aeronautical side: spend-per-passenger analytics, conversion optimisation and dynamic
     retail and parking offers — growth on the same footfall.</p>`
},
{
  id: 'stale-offline',
  k: 'offline stale feed drops network fails resilience what if it goes down degraded outage venue',
  scene: 'deploy',
  a: `<p>It keeps rendering. When a feed or the backend drops, the board holds the last known state behind
     a clear <b>FEED STALE</b> or <b>OFFLINE</b> banner and states how old the data is, rather than going
     blank.</p>
     <p>That behaviour is deliberate: in an operations room a dark screen is worse than an old one, and a
     screen that lies about being current is worse than both. There is also a workflow trigger for the
     inverse case — fire when an expected event does <i>not</i> arrive, so a silent feed raises a fault
     instead of quietly reading zero.</p>`
},
{
  id: 'ai-governance',
  k: 'ai governance ai act responsible ai model risk explainability provenance regulate ai',
  scene: 'governance',
  a: `<p>AI governance and model provenance are tracked as <b>obligations in the same register</b> as ICAO
     Annex 17 and personal-data protection — not in a separate deck.</p>
     <p>Operationally that means: agents carry declared risk tiers, declared tool sets and evaluation
     suites; which engine serves which purpose is an explicit administrator setting; runs are recorded
     and replayable; and "unapproved AI extraction" is a scored risk on the platform's own side of the
     register.</p>`
},
{
  id: 'cost-price',
  k: 'cost price how much licensing pricing budget expensive per seat commercial model',
  scene: 'talk',
  a: `<p>Pricing isn't mine to quote — that's a conversation with your MindGraph and DXC account team, and
     it depends on scope, airports in the group, and which way in you take.</p>
     <p>What I can tell you is the shape of the commercial argument: most of what you deploy already
     exists and is proven, so you are funding a tailoring rather than a build. How much tailoring depends
     on your estate, which is what the baseline assessment sizes. And the intelligent-layer route is the
     fastest ROI of the three because nothing is replaced.</p>`
},
];

/* ── retrieval ────────────────────────────────────────────────────────────
   Deliberately simple and deliberately legible: token overlap with a light
   IDF-ish weighting, a bigram bonus, and a floor below which Iris says she
   does not know rather than returning her least-bad guess.
   ------------------------------------------------------------------------ */

const STOP = new Set(('a an the is are was were be been do does did can could would should will ' +
  'of to in on at for with by from about into over and or but if then than that this these those ' +
  'it its as what which who whom how why when where your you we our us i me my they them their ' +
  'have has had not no yes so such very more most much many any some all one two also just really' ).split(' '));

const tok = s => String(s || '').toLowerCase()
  .replace(/[^a-z0-9\s-]/g, ' ')
  .split(/\s+/)
  .filter(w => w.length > 2 && !STOP.has(w));

/** Document frequency, computed once, so common words count for less. */
const DF = (() => {
  const df = new Map();
  for (const e of KB) for (const w of new Set(tok(e.k))) df.set(w, (df.get(w) || 0) + 1);
  return df;
})();

export function search(question, limit = 3) {
  const q = tok(question);
  if (!q.length) return [];
  const qSet = new Set(q);
  const raw = String(question || '').toLowerCase();

  const scored = KB.map(e => {
    const ks = tok(e.k);
    const kSet = new Set(ks);
    let score = 0;
    for (const w of qSet) {
      if (kSet.has(w)) score += 1 / Math.log2(2 + (DF.get(w) || 1));
      // partial credit for stems: "dashboards" vs "dashboard"
      else if ([...kSet].some(k => k.length > 4 && (k.startsWith(w) || w.startsWith(k)))) score += 0.45;
    }
    // adjacent-pair bonus — "air gapped", "risk register", "human loop"
    for (let i = 0; i < q.length - 1; i++) {
      if (e.k.includes(`${q[i]} ${q[i + 1]}`)) score += 0.8;
    }
    // a question that names the topic outright
    if (e.id.split('-').every(p => raw.includes(p))) score += 0.6;
    return { e, score: score / Math.sqrt(qSet.size) };
  })
  .filter(x => x.score > 0)
  .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}

export const CONFIDENCE_FLOOR = 0.34;

export const DONT_KNOW = `<p>I don't have that in what I've been given, and I'd rather say so than
  make something up — in an airport a confident wrong answer is the expensive kind.</p>
  <p>Put it to the MindGraph and DXC team and they'll come back with a real answer. In the meantime,
  try me on the data model, the build surfaces, the agents, governance, or how it would deploy.</p>`;
