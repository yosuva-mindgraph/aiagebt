/* ============================================================================
   The knowledge base.

   AIRIS answers from this when no LLM key is configured, and an LLM is given
   the matching entries as grounding when one IS configured. Either way the
   facts come from here, so the answer is the same shape in a boardroom with
   no network as it is on a laptop with one.

   Every entry is traceable to a source document or to the product's own
   metadata — see docs/CONTENT-SOURCES.md. If it is not in a source, it is not
   in here. An unanswerable question gets an honest "I don't know", which is
   the behaviour that survives a room full of operators.

   Voice: warm, short, a little playful. At most ~70 words an answer — AIRIS
   speaks these out loud, and nobody wants a lecture at a conference stand.

   Fields:
     id     stable key
     q      the question this answers, in a visitor's words (shown as a chip)
     k      keywords and synonyms — scored against the question
     scene  scene id to offer as a jump
     icon   one emoji for the figures panel
     src    where it came from, in three words (shown as a chip)
     facts  up to four figures for the panel: { n, l, human? }
     a      the answer, in AIRIS's voice (HTML allowed)
   ========================================================================== */

export const KB = [

/* ── what it is ─────────────────────────────────────────────────────────── */
{
  id: 'what-is-it',
  q: 'What is AIRIS — Thinking Airport?',
  k: 'what is airis thinking airport product airport in a box aib what does it do overview explain platform summary tell me about introduce',
  scene: 'open',
  icon: '📦',
  src: 'Airport Hub metadata',
  facts: [{ n: '59', l: 'canonical entities' }, { n: '204', l: 'governed KPIs' }, { n: '21', l: 'source feeds' }, { n: '0', l: 'systems replaced', human: true }],
  a: `<p><b>AIRIS — Thinking Airport</b> is an intelligence <b>platform</b> that sits on top of the systems an airport
     already runs — and replaces none of them.</p>
     <p>It reads every source into one governed model of the airport: 59 entities and 204 KPIs, defined
     once. On top of that you get a governed assistant you can ask anything, and four things your own
     people build — dashboards, apps, workflows and AI agents.</p>`
},
{
  id: 'platform-not-product',
  q: 'Is it a product or a platform?',
  k: 'platform or product difference fixed modules menu list of use cases limited endless unbounded roadmap ceiling',
  scene: 'model',
  icon: '🧩',
  src: 'Airport Hub metadata',
  facts: [{ n: '∞', l: 'things you can build' }, { n: '1', l: 'metadata file per domain' }, { n: '0', l: 'engineering tickets', human: true }],
  a: `<p>A product gives you fixed screens and a roadmap to wait on. A platform gives you the data
     foundation and the tools to build on it yourself.</p>
     <p>Concretely: adding a business domain writes a metadata file, and it arrives with a governed
     dashboard the moment its entity is mapped. The twentieth dashboard costs what the second did.
     That's what "unbounded" really means.</p>`
},
{
  id: 'name-airis',
  q: 'What does AIRIS stand for?',
  k: 'airis what does airis mean stand for name iris acronym why called airis who are you your name introduce yourself',
  scene: 'airis',
  icon: '👁️',
  src: 'AIRIS briefing',
  facts: [{ n: '17', l: 'systems in one demo' }, { n: '83', l: 'seconds to coordinate' }],
  a: `<p><b>AIRIS</b> is DXC's AI Real-Time Integrated Solution — the digital brain of the airport.
     The briefing puts it nicely: <i>like the iris of an eye, it lets an airport see and understand its
     own operations in real time.</i></p>
     <p>And that's me. Today I'm the digital brain <i>and</i> your guide — the talking is a side job.</p>`
},
{
  id: 'mindgraph-dxc',
  q: 'Who are MindGraph and DXC?',
  k: 'mindgraph dxc who built this built made by created by partnership who are you from company vendor behind it relationship exclusive go to market',
  scene: 'open',
  icon: '🤝',
  src: 'Thinking Airport brief',
  facts: [{ n: '2', l: 'partners, one platform' }, { n: '1990s', l: 'DXC first airport MSI' }],
  a: `<p>Two partners. <b>DXC</b> is the master systems integrator for airports — it has been integrating
     airport systems since a Hong Kong programme in the 1990s. <b>MindGraph</b> provides the agentic AI
     and the data fabric underneath.</p>
     <p>Together they have an exclusive go-to-market agreement: MindGraph's agents on a governed data
     fabric, delivered through DXC for airport operations end to end.</p>`
},

/* ── the data foundation ────────────────────────────────────────────────── */
{
  id: 'data-model',
  q: 'How is the data modelled?',
  k: 'data model canonical entities schema kpi kpis how many single source of truth semantic layer definition defined once',
  scene: 'data',
  icon: '🗄️',
  src: 'Airport Hub metadata',
  facts: [{ n: '59', l: 'canonical entities' }, { n: '204', l: 'governed KPIs' }, { n: '3', l: 'industry anchors: ACRIS, AIDX, Res 753' }, { n: '1', l: 'place to change a definition', human: true }],
  a: `<p>Every source lands in the lakehouse and is mapped into one canonical model: <b>59 entities</b>
     — flight, bag, passenger, cargo, retail, energy, roster, revenue, sensor and so on — with
     <b>204 KPIs</b> defined on top, anchored to the ACRIS semantic model, IATA AIDX and Resolution 753.</p>
     <p>"Defined once" is the whole point. On-time performance means the same thing in a dashboard, a
     workflow threshold, an agent's answer and the report to your regulator. One place to change it,
     one place to audit it.</p>`
},
{
  id: 'sources',
  q: 'Which source systems does it connect to?',
  k: 'data sources feeds connect integration how many sources what systems ingest mapped aodb fids bhs cuss connectors parking car park landside vehicle lpr camera pos',
  scene: 'data',
  icon: '🔌',
  src: 'Airport Hub metadata',
  facts: [{ n: '21', l: 'feeds mapped today' }, { n: '10', l: 'source systems' }, { n: '5', l: 'ways to connect' }],
  a: `<p>Twenty-one feeds are mapped today — A-CDM, live flight, baggage handling and reclaim,
     self-bag-drop, CUSS check-in, car park and vehicle access, camera data, retail POS, ASQ surveys and
     airline master data among them.</p>
     <p>New ones connect through the same layer: streaming, scheduled ETL, REST, webhooks, file drops —
     and RPA where a system has no API at all. Map the entity once and everything downstream lights up.</p>`
},
{
  id: 'catalog',
  q: 'What is the data fabric around the model?',
  k: 'catalog lineage glossary documents explorer sql who can query metadata discovery data fabric',
  scene: 'data',
  icon: '🧭',
  src: 'Airport Hub metadata',
  facts: [{ n: '6', l: 'fabric surfaces' }, { n: '1', l: 'governed pipeline' }],
  a: `<p>Around the model sits the data fabric: a <b>catalog</b> with lineage back to source and forward
     to everything that uses it; a <b>business glossary</b> binding the word a director uses to the
     field an engineer built; a <b>governed SQL explorer</b> for the people who like writing their own;
     and <b>document search</b> over SOPs and policies.</p>
     <p>All through one pipeline — same masking, same audit.</p>`
},

/* ── the airport model ──────────────────────────────────────────────────── */
{
  id: 'control-centres',
  q: 'Which control centres are modelled?',
  k: 'control centres aocc atc eoc noc soc operations tower emergency network security centre apoc',
  scene: 'model',
  icon: '🏢',
  src: 'Airport Hub metadata',
  facts: [{ n: '5', l: 'control centres' }, { n: '9', l: 'AOCC subdomains' }, { n: '+1', l: 'whenever you need it', human: true }],
  a: `<p>Five, modelled the way you run them:</p>
     <ul>
       <li><b>AOCC</b> — flights, baggage, passengers and resources, in nine subdomains.</li>
       <li><b>ATC</b> — runway and airspace. <b>EOC</b> — crisis coordination to your emergency plan.</li>
       <li><b>NOC</b> — the IT backbone. <b>SOC</b> — physical and cyber security together.</li>
     </ul>
     <p>And the sixth is whichever one you need — a centre is a metadata file, not a release.</p>`
},
{
  id: 'domains-apps',
  q: 'What applications already exist on it?',
  k: 'business domains applications energy esg facility safety avsec ot security passenger360 revenue roster disaster health what applications already on the platform shipped apps',
  scene: 'model',
  icon: '🏗️',
  src: 'Airport Hub metadata',
  facts: [{ n: '7', l: 'business domains' }, { n: '8', l: 'applications' }, { n: '37', l: 'subdomains modelled' }],
  a: `<p><b>Domains:</b> Energy, ESG and carbon, Facility Management, Safety Training, AVSEC, OT Security
     — and Healthcare, which is a placeholder for later.</p>
     <p><b>Applications already on the platform:</b> Flow360 for live passenger flow, Revenue Management
     with Airline Billing, Airline Marketing and Routes, AIR Disaster Management, Connected Health and
     Roster Management. Eight in all.</p>
     <p>Those are where airports start. They are not where the platform stops.</p>`
},
{
  id: 'add-domain',
  q: 'How do we add a new domain or use case?',
  k: 'add new domain module custom extend metadata not code build our own new use case bespoke create add a centre',
  scene: 'model',
  icon: '➕',
  src: 'Airport Hub metadata',
  facts: [{ n: '1', l: 'metadata file' }, { n: '0', l: 'release cycles', human: true }, { n: '0', l: 'tickets to us', human: true }],
  a: `<p>An administrator does it inside the product: name the domain, give it subdomains, point them at
     canonical entities. The platform writes the metadata file and the domain arrives with the standard
     governed dashboard, live the moment its entity is mapped.</p>
     <p>The line to remember: <b>adding a domain is metadata, not code.</b> No release, no backlog, no
     waiting for us.</p>`
},

/* ── ask / assistant ────────────────────────────────────────────────────── */
{
  id: 'assistant',
  q: 'Can anyone just ask it questions?',
  k: 'assistant ask question natural language plain english chatbot nl query analytics reports analyst copilot',
  scene: 'ask',
  icon: '💬',
  src: 'Airport Hub metadata',
  facts: [{ n: '~80%', l: 'analyst time handed back' }, { n: '0', l: 'SQL required', human: true }],
  a: `<p>Yes — anyone asks an operational question in plain language and gets the answer, with a chart,
     in seconds, across every connected source at once. No SQL, no ticket, no two-day wait for a stale
     report.</p>
     <p>It runs under your own identity through the governed pipeline, so it only sees what you're
     allowed to see, it cites its sources, and it's logged. Roughly 80% of analyst time comes back.</p>`
},
{
  id: 'hallucination',
  q: 'How do you stop it making things up?',
  k: 'hallucinate hallucination wrong answer made up invent accuracy trust the answer confident incorrect reliable',
  scene: 'ask',
  icon: '🎯',
  src: 'Airport Hub metadata',
  facts: [{ n: '3', l: 'safeguards' }, { n: '100%', l: 'answers cite sources' }],
  a: `<p>Three things. It resolves through the canonical model and governed KPI definitions — the number
     comes from a query, not a memory. Every answer cites the entities and KPIs it used, so it's
     checkable. And an ambiguous question comes back as a question.</p>
     <p>A confident wrong number is worse than no number in an ops room. Same rule I follow, by the way.</p>`
},

/* ── build surfaces ─────────────────────────────────────────────────────── */
{
  id: 'dashboards',
  q: 'How do dashboards get made?',
  k: 'dashboards boards how many dashboards build a dashboard charts tiles reports publish share viewer',
  scene: 'build',
  icon: '📊',
  src: 'Airport Hub metadata',
  facts: [{ n: '70+', l: 'dashboards in production' }, { n: '8', l: 'departments served' }, { n: '∞', l: 'boards you can add', human: true }],
  a: `<p>A dashboard is a canvas of tiles over any governed measure, built by the person who needs it,
     saved, shared, and publishable to an audience — a partner, an executive, a regulator — with its own
     access scope.</p>
     <p>Every tile resolves through the governed pipeline, so a board can't show a number its viewer
     isn't allowed to see. That's what makes "build your own" a safe sentence. The production estate
     runs 70+ today.</p>`
},
{
  id: 'apps',
  q: 'Can it generate applications?',
  k: 'apps applications build an app app builder generate low code no code studio component describe',
  scene: 'build',
  icon: '📱',
  src: 'Airport Hub metadata',
  facts: [{ n: '14', l: 'components in the library' }, { n: '1', l: 'sentence to describe it', human: true }],
  a: `<p>Describe the application you want on your data and it's generated against the canonical model
     from a component library — hero, KPI row, charts, tables, timeline, flight board, map, forms and
     more — then edited by hand where you want it exact.</p>
     <p>Generated apps inherit the same access scopes and audit trail as everything else. They're not a
     side door to the data.</p>`
},
{
  id: 'workflows',
  q: 'What can the workflows trigger on?',
  k: 'workflow workflows automation automate playbook triggers nodes flows alerting schedule cron webhook actions notify',
  scene: 'build',
  icon: '⚙️',
  src: 'Airport Hub metadata',
  facts: [{ n: '7', l: 'trigger types' }, { n: '20', l: 'node kinds' }, { n: '5', l: 'chat channels' }, { n: '12', l: 'playbooks' }],
  a: `<p>Workflows are a canvas of triggers and actions. <b>Triggers:</b> manual, schedule, a KPI crossing
     a threshold, a webhook, a live event, another workflow failing — and my favourite, <b>an expected
     event that never arrived</b>. A silent feed is a fault.</p>
     <p><b>Actions:</b> query the model, ask an agent, branch, open a deduped alert, email, call any REST
     API, or notify Slack, Teams, WhatsApp and friends.</p>`
},
{
  id: 'playbooks',
  q: 'What comes out of the box?',
  k: 'shipped playbooks examples eleven use cases demo what workflows come with it out of the box ready made templates',
  scene: 'live',
  icon: '📚',
  src: 'Airport Hub metadata',
  facts: [{ n: '3', l: 'seeded, switched off' }, { n: '9', l: 'more in the library' }, { n: '0', l: 'on by default', human: true }],
  a: `<p>Three playbooks are seeded, switched off, so a fresh install has something real to turn on
     deliberately: flight OTP and delay watch, baggage first-bag SLA, and security screening and breach
     watch.</p>
     <p>Nine more sit in the library, ready to copy in: airline cancellations, cargo dwell, complaint and
     ASQ, emergency response, IT availability, retail revenue dip, security wait above target, lounge at
     capacity, and a daily passenger-flow report. Examples of the shape, not the limit of it.</p>`
},

/* ── agents ─────────────────────────────────────────────────────────────── */
{
  id: 'agents',
  q: 'Which AI agents ship with it?',
  k: 'agents ai agents how many agents what agents bot autonomous llm which agents registered',
  scene: 'agents',
  icon: '🤖',
  src: 'Airport Hub metadata',
  facts: [{ n: '6', l: 'agents shipped' }, { n: '6', l: 'things each one carries' }],
  a: `<p>Six ship today: the <b>Airport Hub Analyst</b>, plus Ops, Baggage and Retail analysts, a
     <b>Data Steward</b> that proposes but never decides, and a <b>Compliance Explainer</b>. You register
     your own the same way.</p>
     <p>An agent here is a registered object, not a prompt somebody pasted — it carries a purpose, a
     risk tier, declared tools, its own data scope, evals, guardrails and a replayable run history. The
     Compliance Explainer's data scope is empty on purpose: it has no SQL reach at all.</p>`
},
{
  id: 'agent-safety',
  q: 'How do you stop an agent seeing data it shouldn’t?',
  k: 'agent see data it should not overreach guardrail scope risk tier permission agent security stop an agent rogue over reaching',
  scene: 'agents',
  icon: '🛡️',
  src: 'Airport Hub metadata',
  facts: [{ n: '4', l: 'mechanisms' }, { n: '0', l: 'live in the prompt', human: true }],
  a: `<p>Four mechanisms, and none of them live in the prompt.</p>
     <ul>
       <li><b>Data scope</b> — masking and row policies applied by the pipeline, whoever asked.</li>
       <li><b>Risk tier</b> — declared, and changing it is itself a governed change.</li>
       <li><b>Declared tools</b> and <b>guardrails with evals</b>, enforced outside the model.</li>
     </ul>
     <p>And anything irreversible waits in the approvals inbox for a person.</p>`
},
{
  id: 'human-in-loop',
  q: 'Is there a human in the loop?',
  k: 'human in the loop approval approve gate who decides autonomous safe irreversible sign off person makes the call',
  scene: 'live',
  icon: '🙋',
  src: 'Airport Hub metadata',
  facts: [{ n: '1', l: 'approvals inbox', human: true }, { n: '100%', l: 'irreversible actions wait', human: true }],
  a: `<p>Always. The machine does the watching, the querying, the explaining and the drafting.
     <b>A person makes the call.</b></p>
     <p>Anything irreversible lands in one approvals inbox and waits. That's the shape of the platform,
     not a setting on it — which is what makes it safe to point at a live airport rather than a lab.</p>`
},
{
  id: 'models',
  q: 'Which AI models does it use?',
  k: 'ml models prediction forecast predictive delay predictor pax flow baggage anomaly which llm engine model swap',
  scene: 'build',
  icon: '🔮',
  src: 'Airport Hub metadata',
  facts: [{ n: '3', l: 'forecast models registered' }, { n: '9', l: 'LLM providers' }, { n: '1', l: 'admin setting to swap engines' }],
  a: `<p>Three forecast models are registered — a <b>delay predictor</b>, a <b>passenger-flow
     forecaster</b> and a <b>baggage anomaly</b> detector — in the same catalog, under the same provenance
     rules. Honest answer: they're locked and marked "coming soon" today.</p>
     <p>Which LLM engine serves which purpose is an administrator setting. Point it at your own engines
     and swap them without touching a single board or workflow.</p>`
},

/* ── governance ─────────────────────────────────────────────────────────── */
{
  id: 'governance',
  q: 'What obligations does it track?',
  k: 'governance compliance grc regulation icao iata annex obligation audit regulator standards obligations',
  scene: 'governance',
  icon: '📜',
  src: 'Airport Hub metadata',
  facts: [{ n: '14', l: 'obligations tracked' }, { n: '5', l: 'governance packs' }, { n: '1', l: 'register for airport and platform' }],
  a: `<p>Governance is one of the five things in the navigation, not a module sold later — and it governs
     the platform as well as the airport.</p>
     <p>Fourteen obligations: ICAO Annexes 19, 17 and 14, your emergency plan, IATA IGOM, service quality,
     ISO 14001 and carbon accreditation, personal data and GDPR transfers, breach notification, ISO 27001
     access control and logging, EU AI Act-style oversight, and provenance of AI output. Nothing is
     auto-marked compliant — the platform shows the evidence, a person makes the claim.</p>`
},
{
  id: 'risk-register',
  q: 'What is in the risk register?',
  k: 'risk register risks scored what risks runway incursion cyber breach exposure scored both sides',
  scene: 'governance',
  icon: '⚠️',
  src: 'Airport Hub metadata',
  facts: [{ n: '16', l: 'risks on one register' }, { n: '11', l: 'airport risks' }, { n: '5', l: 'risks the platform carries itself' }],
  a: `<p>Both sides of the house, on one scale. <b>The airport:</b> runway incursion, emergency readiness,
     AVSEC breach, OT cyber, on-time degradation, baggage SLA, disruption, resource shortfall, revenue
     concentration, ESG targets.</p>
     <p><b>The platform itself:</b> data access scope, personal-data exposure, unapproved AI extraction,
     engine dependency, audit gap. Sixteen in all, 5×5 scored, each with an owner — and a risk with no
     live signal reads "not instrumented", never a made-up status.</p>`
},
{
  id: 'privacy',
  q: 'How is personal data protected?',
  k: 'privacy pdpa gdpr personal data pii retention cross border data protection masking confidential',
  scene: 'governance',
  icon: '🔒',
  src: 'Airport Hub metadata',
  facts: [{ n: '1', l: 'column-level access matrix' }, { n: '4', l: 'surfaces it holds for' }],
  a: `<p>Personal data is modelled explicitly — notice, disclosure, security, retention schedules,
     cross-border rules, breach notification — all as obligations in the register.</p>
     <p>Underneath, a <b>column-level access matrix</b>: masking is applied by the pipeline, so it holds
     identically for a board, a query, a workflow and an agent. Privacy by design, and the matrix is
     the bit you can actually inspect.</p>`
},
{
  id: 'audit',
  q: 'Can you show who saw what?',
  k: 'audit trail logging who saw what telemetry activity evidence traceability prove regulator show me',
  scene: 'governance',
  icon: '🧾',
  src: 'Airport Hub metadata',
  facts: [{ n: '1', l: 'audit trail across every surface' }, { n: '4', l: 'things it records' }],
  a: `<p>Yes. Every surface writes to one audit trail: who asked, under what scope, what came back, and
     what was approved. Activity and telemetry are a first-class view, not a log file someone has to go
     and find.</p>
     <p>The question that kills AI pilots is never "is it clever". It's "show me who saw what, and why
     the model said that". This answers both.</p>`
},
{
  id: 'ai-governance',
  q: 'How is the AI itself governed?',
  k: 'ai governance ai act responsible ai model risk explainability provenance regulate ai ethics',
  scene: 'governance',
  icon: '⚖️',
  src: 'Airport Hub metadata',
  facts: [{ n: '2', l: 'AI obligations in the register' }, { n: '100%', l: 'runs replayable' }],
  a: `<p>AI governance and model provenance are obligations in the <b>same register</b> as ICAO Annex 17
     and personal data — not a separate deck.</p>
     <p>In practice: agents carry declared risk tiers, tools and evaluation suites; which engine serves
     which purpose is an explicit setting; runs are recorded and replayable; and "unapproved AI
     extraction" is a scored risk on the platform's own side of the register.</p>`
},
{
  id: 'security',
  q: 'How is access controlled?',
  k: 'security cyber secure zero trust rbac access control who can see what permissions roles groups grants',
  scene: 'governance',
  icon: '🔐',
  src: 'Airport Hub metadata',
  facts: [{ n: '1', l: 'access matrix, column level' }, { n: '2', l: 'roles: editor and viewer' }],
  a: `<p>Access is enforced by the pipeline, not by each screen: a column-level access matrix with
     masking and row policies, applied the same way to a board, a query, a workflow and an agent.
     Members are managed as groups, grants and packs, with an editor / viewer split.</p>
     <p>In the wider estate, a third-party cybersecurity layer ring-fences it: zero-trust access,
     air-gapped operation, video anomaly detection.</p>`
},

/* ── deployment ─────────────────────────────────────────────────────────── */
{
  id: 'onprem',
  q: 'Where does it run?',
  k: 'on premise cloud air gapped offline no network deploy where does it run hosting sovereign run anywhere',
  scene: 'deploy',
  icon: '🏝️',
  src: 'AIB capabilities deck',
  facts: [{ n: '4', l: 'ways to host' }, { n: '0', l: 'runtime cloud dependency', human: true }],
  a: `<p>Cloud, on-premise, hybrid, or <b>fully air-gapped</b> — no cloud or network dependency at
     runtime. That last one isn't a marketing line; it's built for a restricted ops room with the Wi-Fi
     switched off.</p>
     <p>And it degrades honestly: when a feed drops, the board keeps the last known picture behind a
     clear <b>FEED STALE</b> banner and says how old it is. A dark screen in an ops room is worse than
     an old one.</p>`
},
{
  id: 'onboarding',
  q: 'How long does it take to land in an airport?',
  k: 'onboard onboarding how long timeline implementation deploy time greenfield brownfield intelligent layer migrate ways in',
  scene: 'deploy',
  icon: '🛫',
  src: 'AIB capabilities deck',
  facts: [{ n: '~85%', l: 'pre-built and proven' }, { n: '~15%', l: 'tailored to you', human: true }, { n: '3', l: 'ways in' }],
  a: `<p>Three ways in, and which one fits you is a five-minute chat:</p>
     <ul>
       <li><b>Greenfield</b> — stand the whole platform up on the reference architecture.</li>
       <li><b>Brownfield</b> — consolidate in phases, parallel run, rollback at every step.</li>
       <li><b>Intelligent layer</b> — your systems stay put and we overlay. Fastest ROI, least disruption.</li>
     </ul>
     <p>About 85% already exists; the other 15% is your brand, maps, rules, workflows and migration.</p>`
},
{
  id: 'replace-systems',
  q: 'Will it replace my existing systems?',
  k: 'replace rip out aodb existing systems do we have to change swap remove vendor lock legacy keep',
  scene: 'proposition',
  icon: '🧱',
  src: 'AIB capabilities deck',
  facts: [{ n: '0', l: 'systems replaced', human: true }, { n: '0', l: 'downtime', human: true }],
  a: `<p>No. It replaces nothing — your AODB stays your AODB.</p>
     <p>Source systems are read through APIs and the service bus, and written to only where you've
     explicitly opened that door. Ingest-only is the default. No replacement, no downtime, value added
     step by step.</p>
     <p>Airports don't have a systems problem. They have a coordination problem on top of systems that
     already work.</p>`
},
{
  id: 'stale-offline',
  q: 'What happens if a feed or the network goes down?',
  k: 'offline stale feed drops network fails resilience what if it goes down degraded outage venue heartbeat',
  scene: 'deploy',
  icon: '📡',
  src: 'AIB capabilities deck',
  facts: [{ n: '1', l: 'FEED STALE banner' }, { n: '1', l: 'missing-event trigger' }],
  a: `<p>It keeps rendering. When a feed or the backend drops, the board holds the last known state
     behind a clear <b>FEED STALE</b> or <b>OFFLINE</b> banner and says how old the data is, rather than
     going blank.</p>
     <p>And there's a workflow trigger for the inverse: fire when an expected event does <i>not</i>
     arrive. A silent feed raises a fault instead of quietly reading zero.</p>`
},

/* ── proof and commercials ──────────────────────────────────────────────── */
{
  id: 'proof',
  q: 'Is any of this actually in production?',
  k: 'proof real proven track record production live today reference customer who uses it evidence credibility award',
  scene: 'deploy',
  icon: '🏆',
  src: 'AIB capabilities deck',
  facts: [{ n: '15', l: 'services in production' }, { n: '5', l: 'airports live' }, { n: '12', l: 'AI systems' }, { n: '2023', l: 'IDC award', human: true }],
  a: `<p>Yes — fifteen services in production across five airports, twelve AI systems, 70+ dashboards
     serving eight departments and 16+ automation bots live.</p>
     <p>Measured outcomes: security paperwork down about 80% and offline-capable in restricted zones,
     complaint response about 25% faster with a 35% CX uplift, zero paper contracts. The home-to-gate
     passenger ecosystem won the IDC Future Enterprise Award 2023.</p>`
},
{
  id: 'roi',
  q: 'What is the return on investment?',
  k: 'roi return on investment business case payback savings numbers guarantee benefit money value levers worth it',
  scene: 'proposition',
  icon: '📈',
  src: 'module blueprint',
  facts: [{ n: '4', l: 'ROI levers' }, { n: '1', l: 'baseline replaces every range', human: true }],
  a: `<p>Four levers, and every capability is measured against one: <b>cost out</b>, <b>capex deferred</b>,
     <b>revenue up</b> and <b>risk removed</b>.</p>
     <p>I'll be straight with you: any ROI range you hear from us is an indicative industry figure. It's
     replaced by your own number in a short baseline assessment during onboarding, and it's never a
     guarantee before that.</p>`
},
{
  id: 'where-to-start',
  q: 'Where should we start?',
  k: 'where do we start first module pilot proof of concept poc quick win next step trial fortnight',
  scene: 'talk',
  icon: '🚀',
  src: 'module blueprint',
  facts: [{ n: '3', l: 'real feeds' }, { n: '14', l: 'days to judge it', human: true }],
  a: `<p>Small. Point it at two or three of your real feeds, let it build the canonical model, and then
     have <b>your own people</b> build a board, a workflow and an agent on top — without us in the room.</p>
     <p>You'll know inside a fortnight whether what I've told you is true. If you'd rather lead with a
     contained P&amp;L win, energy and utilities is the usual first move.</p>`
},
{
  id: 'competitors',
  q: 'How is this different from the others?',
  k: 'competitors different from others why you how are you different differentiator alternative compare versus',
  scene: 'proposition',
  icon: '🔍',
  src: 'module blueprint',
  facts: [{ n: '3', l: 'honest differences' }, { n: '0', l: 'systems ripped out', human: true }],
  a: `<p>Three things, and do press on all of them. It's an <b>overlay, not a replacement</b>, so it isn't
     a bet-the-airport decision. It's a <b>platform your team extends</b> — a new domain is metadata, not
     a change request. And <b>governance is in the navigation</b>, not an appendix.</p>
     <p>What I won't claim is that nobody else does queue prediction. Plenty do. The difference is the
     day you want the twentieth thing built.</p>`
},
{
  id: 'build-our-own',
  q: 'Can we build our own, without you?',
  k: 'build our own without you self service do we need you professional services dependency team extend ourselves',
  scene: 'build',
  icon: '🛠️',
  src: 'Airport Hub metadata',
  facts: [{ n: '4', l: 'things your team builds' }, { n: '0', l: 'tickets to us', human: true }],
  a: `<p>Yes — that's the design intent, and I'd make it the acceptance test for the whole engagement.</p>
     <p>Dashboards, apps, workflows and agents are all built inside the product by the people who need
     them; adding a domain is an administrator action. The governed pipeline is what makes that safe:
     whatever your team builds inherits the same scopes, masking and audit.</p>`
},
{
  id: 'passenger-flow',
  q: 'Can it predict queues?',
  k: 'passenger flow queue congestion sensor prediction wait time security queue passenger360 flow360 predict queues crowd xovis level of service',
  scene: 'model',
  icon: '🚶',
  src: 'Airport Hub repo',
  facts: [{ n: '166', l: 'sensors on the T1 plan' }, { n: '70', l: 'zones' }, { n: '2', l: 'minutes over target → alert' }, { n: '0', l: 'images, ever', human: true }],
  a: `<p>Yes. <b>Flow360</b> — formerly Passenger360 — runs live passenger flow from curb to gate on the
     sensor estate: queues, check-in, fill level, PRM counts, forecasts and a lane advisor, on a live
     floor plan and inside the 3D twin. Anonymous counts and coordinates, never images.</p>
     <p>Waits are graded on IATA level-of-service bands. Two minutes over target raises an ops alert and
     fires a live workflow trigger, so staffing hears before the queue is visible on the ground.</p>`
},
{
  id: 'energy',
  q: 'What does it do for energy and carbon?',
  k: 'energy utilities power consumption carbon esg sustainability emissions bms scada meters green electricity',
  scene: 'model',
  icon: '⚡',
  src: 'module blueprint',
  facts: [{ n: '3', l: 'reporting frameworks' }, { n: '1', l: 'usual first P&L win', human: true }],
  a: `<p>Energy Management is a business domain on the platform — chiller plant, HVAC, lighting and
     utilities analytics over BMS, SCADA and smart meters, with live consumption and cost by terminal,
     zone and asset, plus anomaly and waste detection.</p>
     <p>ESG sits beside it for carbon reporting against ACI, GRI and Airport Carbon Accreditation. It's
     the usual first module for a contained, visible win; the payback range is indicative until your
     own meters set the baseline.</p>`
},
{
  id: 'revenue',
  q: 'How does it handle airline billing and revenue?',
  k: 'revenue billing airline charges invoice incentive marketing routes commercial non aero retail monetise',
  scene: 'model',
  icon: '💷',
  src: 'Airport Hub metadata',
  facts: [{ n: '3', l: 'revenue applications' }, { n: '5', l: 'billing stages' }],
  a: `<p>Revenue Management is three applications on the governed ledger: <b>Airline Billing</b> from
     tariff to net invoice to collection; <b>Airline Marketing</b> for the incentive programme; and
     <b>Routes</b>, from market opportunity through business case to launch and ROI, with AI scoring on
     the opportunity.</p>
     <p>On the non-aero side: spend-per-passenger analytics and dynamic retail and parking offers —
     growth on the same footfall.</p>`
},
{
  id: 'cost-price',
  q: 'How much does it cost?',
  k: 'cost costs price how much licensing pricing budget expensive per seat commercial model fee subscription charge pay',
  scene: 'talk',
  icon: '🏷️',
  src: 'module blueprint',
  facts: [{ n: '~85%', l: 'already built and proven' }, { n: '1', l: 'conversation with the account team', human: true }],
  a: `<p>Pricing isn't mine to quote — that's a conversation with the MindGraph and DXC team on the stand,
     and it depends on scope, how many airports, and which way in you take.</p>
     <p>What I can tell you is the shape of it: about 85% of what you deploy already exists and is
     proven, so you're funding a tailoring rather than a build.</p>`
},

/* ── the airport's own subjects ─────────────────────────────────────────── */
{
  id: 'baggage',
  q: 'How does it handle baggage?',
  k: 'baggage bags bag handling bhs first bag last bag mishandled reclaim belt chute self bag drop sbd tracking resolution 753 baggage analyst',
  scene: 'model',
  icon: '🧳',
  src: 'Airport Hub metadata',
  facts: [{ n: '6', l: 'baggage feeds mapped' }, { n: '1', l: 'baggage analyst agent' }, { n: '753', l: 'IATA resolution pack' }],
  a: `<p>Baggage is one of the AOCC's nine subdomains, fed by six mapped sources — BHS messaging for
     arrivals, chutes and reclaim belts, plus three self-bag-drop feeds — and modelled as its own
     entities: bag, bag event and bag flow.</p>
     <p>On top sit the first-bag and last-bag delivery KPIs, a <b>Baggage Analyst</b> agent scoped to
     baggage tables only, a first-bag SLA playbook, and an IATA Resolution 753 governance pack that masks
     bag-tag numbers without the personal-data scope.</p>`
},
{
  id: 'cargo',
  q: 'What about cargo?',
  k: 'cargo freight air cargo dwell throughput cargo terminal tonnage cargo volume route month',
  scene: 'model',
  icon: '📦',
  src: 'Airport Hub metadata',
  facts: [{ n: '2', l: 'cargo entities' }, { n: '1', l: 'cargo dwell playbook' }],
  a: `<p>Cargo and freight is an AOCC subdomain with its own canonical entities — Cargo, and cargo
     volume by route and month — and a cargo throughput KPI, grouped by cargo terminal on the
     dashboard.</p>
     <p>A cargo dwell and throughput watch sits in the playbook library, ready to copy in: it fires when
     dwell time drifts and briefs operations. Like everything else, adding more cargo detail is
     metadata, not code.</p>`
},
{
  id: 'flights-otp',
  q: 'What does it do for flight operations?',
  k: 'flights flight operations on time performance otp delay delays punctuality movements cancellations turnaround stand gate a-cdm fids airside',
  scene: 'model',
  icon: '🛩️',
  src: 'Airport Hub metadata',
  facts: [{ n: '6', l: 'flight feeds mapped' }, { n: '80%', l: 'OTP alert threshold' }, { n: '1', l: 'ops analyst agent' }],
  a: `<p>Flights are the AOCC's headline subdomain: A-CDM milestones, live FIDS, seasonal schedule and
     passenger counts land as flight, flight leg and airline-performance entities, with movements,
     on-time performance, average delay, cancellations and severe delays as governed KPIs.</p>
     <p>The <b>Ops Analyst</b> agent answers on them, and the shipped flight OTP playbook watches
     on-time performance every ten minutes and briefs operations when it drops below 80%.</p>`
},

/* ── under the hood (the Airport Hub repo) ──────────────────────────────── */
{
  id: 'airport-hub-name',
  q: 'Is Airport Hub the same thing as Thinking Airport?',
  k: 'airport hub same thing under the hood product name what is it called lakehouse white label skins tenant brand',
  scene: 'open',
  icon: '🏷️',
  src: 'Airport Hub repo',
  facts: [{ n: '3', l: 'engines in one product' }, { n: '1', l: 'deployed instance per airport' }],
  a: `<p>Yes. Under the hood the product is <b>Airport Hub</b>, MindGraph's data-intelligence platform;
     AIRIS — Thinking Airport is the MindGraph and DXC offer built on it.</p>
     <p>Three engines in one: a lakehouse that reads the airport's sources, an intelligence layer that
     turns documents into policies and a glossary, and a governed serving layer that only ever returns
     data under enforced policy. It's white-label — one deployed instance per airport, in your brand.</p>`
},
{
  id: 'tech-stack',
  q: 'What is it built on?',
  k: 'built on technology stack open source minio iceberg duckdb fastapi react python docker kubernetes architecture infrastructure requirements laptop',
  scene: 'deploy',
  icon: '🧱',
  src: 'Airport Hub repo',
  facts: [{ n: '3', l: 'open-source engines' }, { n: '8 GB', l: 'laptop is enough' }, { n: '0', l: 'LLM keys required', human: true }],
  a: `<p>Open source, top to bottom: MinIO object storage, Apache Iceberg tables and the DuckDB query
     engine for the lakehouse; a Python FastAPI back end; a React front end. No Docker needed, no JVM,
     and it installs with one command on macOS or Linux.</p>
     <p>It runs happily on an 8 GB laptop, and it runs with no LLM key at all — AI is an accelerant,
     not a dependency. When you scale out, the same tables move to Kubernetes and a bigger engine.</p>`
},
{
  id: 'llm-providers',
  q: 'Which LLMs can it use?',
  k: 'which llm providers openai anthropic claude groq ollama local model vertex bedrock azure openrouter bring your own key engine per purpose',
  scene: 'ask',
  icon: '🔌',
  src: 'Airport Hub repo',
  facts: [{ n: '9', l: 'LLM providers' }, { n: '4', l: 'purposes: chat, agents, extraction, builder' }],
  a: `<p>Nine, and it's configuration, never code: Anthropic, OpenAI, Groq, Ollama for fully local
     models, plus Vertex, Bedrock, Azure and OpenRouter.</p>
     <p>Each purpose — chat, agents, document extraction, the app builder — can point at a different
     engine. Bring your own key, or use the instance's courtesy engine under a daily quota. Swap the
     engine and the eval history tells you whether quality held.</p>`
},
{
  id: 'sql-guardrails',
  q: 'What stops the AI running a bad query?',
  k: 'guardrails bad query sql injection prompt injection hijacked llm select only allowlist limit ast proof deterministic rails safe query jailbreak',
  scene: 'ask',
  icon: '🛤️',
  src: 'Airport Hub repo',
  facts: [{ n: '1', l: 'statement, SELECT only' }, { n: '10,000', l: 'row cap, always injected' }, { n: '10', l: 'security probes, always run' }],
  a: `<p>Deterministic rails that don't consult the model. Every query is proven before it runs: one
     statement, SELECT only, allow-listed tables, a row limit injected and capped at ten thousand.
     Masks are compiled into the SQL itself, so no alias or cast can unmask a column.</p>
     <p>The posture in one line: even a fully hijacked LLM cannot exceed a SELECT on allowed tables with
     policies applied. Injection attempts are screened at the door and audited.</p>`
},
{
  id: 'proposals',
  q: 'Can the AI change a policy by itself?',
  k: 'ai change policy itself proposed proposals approve promote human promotes extraction takes effect glossary terms review nothing an llm produces',
  scene: 'governance',
  icon: '✍️',
  src: 'Airport Hub repo',
  facts: [{ n: '0', l: 'LLM outputs take effect on their own', human: true }, { n: '1', l: 'approval flow' }],
  a: `<p>No, and that's deliberate. When the platform reads your policy documents, the rules and glossary
     terms it extracts land as <b>proposals</b>, each with its provenance — the source chunk, the model,
     the prompt version.</p>
     <p>Enforcement reads only the active, human-approved set. A person promotes a proposal in the
     portal, or it never takes effect. Nothing an LLM produces is live until someone says so.</p>`
},
{
  id: 'mcp',
  q: 'Can other tools or agents connect to it?',
  k: 'mcp model context protocol api rest connect other tools agents claude desktop a2a integration keys external agent access json',
  scene: 'build',
  icon: '🔗',
  src: 'Airport Hub repo',
  facts: [{ n: '6', l: 'MCP tools' }, { n: '5', l: 'scopes' }, { n: '1', l: 'pipeline, however you connect' }],
  a: `<p>Yes. There's a REST API with docs, and an <b>MCP server</b> — the same protocol Claude Desktop
     and other agents speak — with six tools: query data, run SQL, search documents, list domains,
     describe a table, and read the active policies.</p>
     <p>Every route goes through the one governed pipeline with per-client keys and default-deny scopes,
     and it returns data-only JSON. An outside agent gets exactly what its key allows, and nothing more.</p>`
},
{
  id: 'roles-scopes',
  q: 'What roles and permissions exist?',
  k: 'roles permissions scopes superadmin admin analyst service viewer editor default deny pii read raw read who can edit build',
  scene: 'governance',
  icon: '🧑‍💼',
  src: 'Airport Hub repo',
  facts: [{ n: '4', l: 'roles' }, { n: '5', l: 'scopes' }, { n: '1', l: 'rule: conflicts resolve restrictive' }],
  a: `<p>Four roles — superadmin, admin, analyst and service — and five scopes: curated data, raw data,
     personal data, documents and catalog. Analysts, the regular airport users, see curated data only.</p>
     <p>Effective permission is your scopes <i>intersected</i> with the active policies, and any conflict
     resolves to the more restrictive side. Someone viewing a published board gets a short-lived token
     that opens that one link and nothing else.</p>`
},
{
  id: 'lineage',
  q: 'Does it have data lineage?',
  k: 'lineage trace back to source impact analysis where did the number come from upstream downstream graph declared',
  scene: 'data',
  icon: '🕸️',
  src: 'Airport Hub repo',
  facts: [{ n: '8', l: 'lineage layers' }, { n: '0', l: 'inferred by magic', human: true }],
  a: `<p>Whole-estate lineage, built only from what's declared: source system, raw, curated, canonical
     entity, KPI, agent, workflow, dashboard — eight layers in one graph.</p>
     <p>The same graph powers the lineage explorer, the little lineage view on every asset page, and
     impact analysis — so "what breaks if I change this feed?" has a picture, not a guess.</p>`
},
{
  id: 'connectors',
  q: 'What connectors and integrations are there?',
  k: 'connectors integrations connector catalog bigquery snowflake kafka sap erp crm hrms rest api csv excel postgres roadmap sources connect new system',
  scene: 'data',
  icon: '🧷',
  src: 'Airport Hub repo',
  facts: [{ n: '21', l: 'airport feeds mapped' }, { n: '2', l: 'live connector types' }, { n: '12', l: 'roadmap connectors' }],
  a: `<p>Twenty-one airport feeds are mapped today from ten source systems — A-CDM, FIDS, baggage
     messaging, self-bag-drop, kiosks and e-gates, parking and camera LPR, retail POS, ASQ and passenger
     counts. Live connector types: external Iceberg tables and BigQuery.</p>
     <p>Twelve more — REST, MCP, Postgres and MySQL, Snowflake and Redshift, cloud storage, Kafka,
     files, AODB/RMS, CRM, SAP, ERP and HRMS — are shown honestly as roadmap cards with demo data, not
     pretended to be built.</p>`
},
{
  id: 'studio',
  q: 'Can we edit the dashboards ourselves?',
  k: 'studio edit dashboards ourselves drag drop canvas layout versions publish public protected internal author component library customise boards',
  scene: 'build',
  icon: '🎨',
  src: 'Airport Hub repo',
  facts: [{ n: '12', l: 'column canvas' }, { n: '3', l: 'publish modes' }, { n: '0', l: 'data paths start in the editor', human: true }],
  a: `<p>Yes — every control-centre, domain and application board opens in the Dashboard Studio: a
     drag-and-resize canvas with KPI, chart, table, live table, funnel, radar, alert and agent-chat
     components, cross-filter and drill-down, version history and draft autosave.</p>
     <p>Bindings are typed against the canonical model only, and no data path starts in the editor —
     preview, runtime and the published page all render through the governed pipeline. Publish
     internally, protected, or public.</p>`
},
{
  id: 'evals-security',
  q: 'How do you prove the guardrails hold?',
  k: 'prove guardrails hold evals evaluation golden probes security regression tests ai governance dashboard nist aige incident register locked floor superadmin',
  scene: 'governance',
  icon: '🧪',
  src: 'Airport Hub repo',
  facts: [{ n: '10', l: 'security probes, always run' }, { n: '8', l: 'locked at the floor' }, { n: '7', l: 'AI-governance principles' }],
  a: `<p>Ten deterministic security probes run on every check without any LLM: masks hold, row filters
     hold, DDL and multi-statement refused, raw tables gated, the row limit injected. Eight of them are
     locked at a floor a customer admin cannot switch off.</p>
     <p>The rule in the codebase: a probe that starts failing is a vulnerability, not a flaky test. The
     AI-governance view is framed on seven AIGE principles and the NIST AI framework, with its own
     incident register.</p>`
},
{
  id: 'demo-data',
  q: 'Is the demo data real?',
  k: 'demo data real synthetic fake sample horizon international fictional airport which airport is this whose data',
  scene: 'deploy',
  icon: '🧪',
  src: 'Airport Hub repo',
  facts: [{ n: '61', l: 'rolling days of data' }, { n: '700', l: 'flights a day' }, { n: '5.5M', l: 'rows, 53 tables' }],
  a: `<p>It's synthetic and generic on purpose. The demo hub is a fictional "Horizon International" with
     made-up home carriers; the foreign destinations are real. Nothing place-specific is hard-coded —
     you set the airport's name, code and time zone in settings.</p>
     <p>Sixty-one rolling days ending today, about 700 flights a day, five and a half million rows across
     53 tables — so the demo never goes stale and never shows anyone's real data.</p>`
},
{
  id: 'impact',
  q: 'Can it show the business impact of a workflow?',
  k: 'business impact workflow value outcomes impact chain causal ai impact dashboard what is it worth measure benefit',
  scene: 'build',
  icon: '🔗',
  src: 'Airport Hub repo',
  facts: [{ n: '3', l: 'watched KPIs with causal chains' }, { n: '1', l: 'toggle back to governed-only', human: true }],
  a: `<p>Yes. Each watched KPI — on-time percentage, first-bag minutes, queue wait — has a declared causal
     chain: which operational and business measures it moves, in which direction, with what lag and
     strength, and a one-line reason for each link.</p>
     <p>That feeds a workflow's AI Impact dashboard. Any demo-story overlay is flagged "illustrative"
     and sits one toggle away from the governed-only view.</p>`
},
{
  id: 'workflow-copilot',
  q: 'Can the AI build a workflow for me?',
  k: 'copilot build a workflow for me describe automation plan first canvas generate flow durable execution checkpoints sub flows',
  scene: 'build',
  icon: '🪄',
  src: 'Airport Hub repo',
  facts: [{ n: '20', l: 'node kinds' }, { n: '1', l: 'human approval where it matters', human: true }],
  a: `<p>Yes. Describe the automation and the workflow copilot plans it first, grounded in your real
     entities and KPIs, then lays it out on the canvas for you to check. Twenty node kinds: triggers,
     governed queries, an agent step, logic, alerts, email, HTTP and five chat channels.</p>
     <p>Runs are durable — checkpoints and recovery — with sub-flows, an approvals inbox, and evals for
     the workflow itself.</p>`
},

/* ── AIRIS and Thinking Airport (the DXC briefing) ──────────────────────── */
{
  id: 'airis-demo',
  q: 'What is AIRIS and what did the demo show?',
  k: 'airis demo what is airis gate change gate swap 187 passengers 83 seconds 17 systems how many systems orchestrate orchestrates orchestrated disruption scenario digital brain real time integrated solution',
  scene: 'airis',
  icon: '⚡',
  src: 'AIRIS briefing',
  facts: [{ n: '83', l: 'seconds to coordinate' }, { n: '17', l: 'systems orchestrated' }, { n: '187', l: 'passengers moved' }, { n: '5–15', l: 'minutes, done by hand', human: true }],
  a: `<p><b>AIRIS</b> — that's me — is DXC's AI Real-Time Integrated Solution: a digital brain that lets
     an airport see its operations and act on them as one.</p>
     <p>The demo: a gate change moves 187 passengers between terminals after a four-minute delay. By hand
     that's 5 to 15 minutes of calls and emails across five teams. AIRIS orchestrated 17 systems — AODB,
     A-CDM, the event bus, FIDS, wayfinding, baggage — and coordinated the whole response in
     <b>83 seconds</b>.</p>`
},
{
  id: 'airis-personas',
  q: 'Who benefits in the AIRIS scenario?',
  k: 'personas stakeholders five personas apoc ops passenger security airline cfo finance what does each see one event five views',
  scene: 'airis',
  icon: '👥',
  src: 'AIRIS briefing',
  facts: [{ n: '5', l: 'stakeholders, one event' }, { n: '18', l: 'seconds to notify the passenger' }, { n: '15', l: 'minute head start for security', human: true }],
  a: `<p>Five people, one event, five different definitions of success:</p>
     <ul>
       <li><b>Ops</b> sees three options with impact analysis, not a wall of alerts.</li>
       <li><b>The passenger</b> gets a map to the new gate in 18 seconds. <b>Security</b> gets a surge alert 15 minutes early, so a lane opens before a queue forms.</li>
       <li><b>The airline</b> gets crew and network context; <b>finance</b> gets cost avoidance per incident.</li>
     </ul>`
},
{
  id: 'airis-results',
  q: 'What results did AIRIS demonstrate?',
  k: 'airis results numbers improvement 80 90 percent 98 orchestration cost avoidance per incident annual benefit roi calculator benchmark iata demonstrated outcomes',
  scene: 'airis',
  icon: '📈',
  src: 'AIRIS briefing',
  facts: [{ n: '80–90%', l: 'faster than manual' }, { n: '98%', l: 'system orchestration' }, { n: '18', l: 'second notifications' }, { n: '0', l: 'passenger complaints', human: true }],
  a: `<p>Sub-minute coordination across two precincts and five terminals, 98% orchestration of 17
     systems, 18-second passenger notifications and zero complaints — an 80 to 90% improvement in speed
     over manual coordination.</p>
     <p>The financial side is illustrative: cost avoidance of around $13,600 per incident and a
     projected annual benefit north of $1.5 million, modelled on IATA benchmarks. Those get replaced by
     an airport's own incident data — never quoted as a guarantee.</p>`
},
{
  id: 'airis-lessons',
  q: 'What did DXC learn from the AIRIS demo?',
  k: 'lessons learned five lessons communication beats disruption proactive beats reactive coordination speed contains measurable value what did you learn takeaways',
  scene: 'airis',
  icon: '💡',
  src: 'AIRIS briefing',
  facts: [{ n: '5', l: 'lessons' }, { n: '15', l: 'minute head start prevents a queue', human: true }],
  a: `<p>Five lessons, and the first is my favourite: passengers don't resent a gate change — they resent
     not knowing. Proactive notice turns a bad moment into a non-event.</p>
     <ul>
       <li>Proactive beats reactive: a 15-minute head start prevents a queue rather than managing one.</li>
       <li>Coordination speed contains disruption — one delay doesn't cascade into the next flight.</li>
       <li>Every stakeholder scores success differently, and value has to be measurable to win investment.</li>
     </ul>`
},
{
  id: 'thinking-airport',
  q: 'What is the Thinking Airport?',
  k: 'thinking airport vision dxc living ecosystem anticipate personalise adapt engage sense predict decide act future airport digital twin framework',
  scene: 'airis',
  icon: '🧠',
  src: 'Thinking Airport brief',
  facts: [{ n: '4', l: 'pillars, one framework' }, { n: '18', l: 'minutes: a queue predicted before it forms' }],
  a: `<p><b>Thinking Airport</b> is DXC's vision — and the name this platform carries: an airport that senses,
     anticipates, adapts and responds in real time, a living ecosystem rather than a fixed piece of
     infrastructure. Anticipate. Personalise. Adapt. Engage.</p>
     <p>The operating model shifts from detect-react-recover to <b>sense-predict-decide-act</b>: a queue
     predicted 18 minutes before it forms, resources rerouted before the disruption lands. AIRIS is the
     proof point; Thinking Airport is the framework.</p>`
},
{
  id: 'four-pillars',
  q: 'What are the four pillars?',
  k: 'four pillars predictive operations hyper personalised journeys adaptive infrastructure dynamic commercial ecosystem pillar',
  scene: 'airis',
  icon: '🏛️',
  src: 'Thinking Airport brief',
  facts: [{ n: '4', l: 'pillars' }, { n: '1', l: 'set of outcomes they all drive to' }],
  a: `<p>Four pillars, one story:</p>
     <ul>
       <li><b>Predictive operations</b> — anticipate disruption, queues and demand, act before impact.</li>
       <li><b>Hyper-personalised journeys</b> — one biometric identity from curb to gate, privacy by design.</li>
       <li><b>Adaptive infrastructure</b> — buildings, OT and utilities that sense and respond. And a <b>dynamic commercial ecosystem</b> — the airport as a digital marketplace.</li>
     </ul>
     <p>AIRIS demonstrates the first pillar in practice.</p>`
},
{
  id: 'biometric-journey',
  q: 'How does the passenger journey change?',
  k: 'biometric identity single credential curb to gate seamless journey passenger experience personalised privacy by design one identity friction',
  scene: 'airis',
  icon: '🪪',
  src: 'Thinking Airport brief',
  facts: [{ n: '1', l: 'identity, curb to gate' }, { n: '0', l: 'repeated document checks', human: true }],
  a: `<p>One identity, one seamless journey. A single biometric credential carries a traveller from curb
     to gate — no repeated document checks, no friction — with privacy designed in from the start.</p>
     <p>The outcome for passengers is simple: less friction, less stress, and more relevant
     communication. The same intelligence that does that also cuts carbon and strengthens security.</p>`
},
{
  id: 'ecosystem-outcomes',
  q: 'What is in it for airlines, retailers and partners?',
  k: 'outcomes partners airlines retailers ground handlers passengers airport operator what is in it for benefits stakeholders ecosystem one connected',
  scene: 'airis',
  icon: '🌐',
  src: 'Thinking Airport brief',
  facts: [{ n: '3', l: 'core messages' }, { n: '1', l: 'real-time picture, shared' }],
  a: `<p>Three outcomes, one picture. <b>Passengers</b>: less friction, less stress, more relevant
     communication. <b>Partners</b>: airlines, retailers and ground handlers acting on the same real-time
     view. <b>The airport</b>: resilience by design, better resource use, lower-carbon operations, safety
     and security always on.</p>
     <p>The point is that an event is understood once, coordinated once, and translated into the right
     action for every stakeholder.</p>`
},

/* ── DXC for airports ───────────────────────────────────────────────────── */
{
  id: 'msi',
  q: 'What does DXC do as a master systems integrator?',
  k: 'msi master systems integrator what is msi integration programme governance pmo orat operational readiness vendor neutral procurement suppliers new terminal expansion greenfield build',
  scene: 'deploy',
  icon: '🏗️',
  src: 'Thinking Airport brief',
  facts: [{ n: '7', l: 'parts to the MSI offer' }, { n: '80–100', l: 'core systems in a typical airport' }, { n: '2025', l: 'latest MSI commissioned', human: true }],
  a: `<p>When an airport builds or expands, DXC acts as the <b>Master Systems Integrator</b>: programme
     governance, end-to-end PMO, architecture and design governance, the integration framework, managing
     the suppliers to one integrated outcome, all levels of testing before opening, and change and
     training.</p>
     <p>It's vendor-neutral — DXC doesn't subcontract the suppliers; it manages them on your behalf. A
     typical airport runs 80 to 100 core systems, and the secret sauce is the integration between them.</p>`
},
{
  id: 'dxc-airports',
  q: 'What is DXC’s track record with airports?',
  k: 'dxc track record airports experience hong kong western sydney montreal managed services project execution cots references how long has dxc worked with airports',
  scene: 'deploy',
  icon: '🛬',
  src: 'Thinking Airport brief',
  facts: [{ n: '1990s', l: 'first airport MSI' }, { n: 'Oct 2025', l: 'Western Sydney commissioned' }, { n: '3', l: 'year managed services at WSI' }],
  a: `<p>DXC's first airport MSI was Hong Kong International in the 1990s. The most recent is Western
     Sydney International, commissioned in October 2025 — which then awarded DXC a three-year managed
     services contract.</p>
     <p>Beyond MSI there's project delivery with off-the-shelf software, and managed services — at
     Montreal, DXC runs everything except the network. DXC has catalogued every interface design into a
     library of patterns, which is what takes risk out of a programme.</p>`
},
{
  id: 'partners',
  q: 'Who are DXC’s partners at PTE Asia?',
  k: 'partners partnership solace airport intelligence brussels mindgraph agentic services booth partners promoting collaborate',
  scene: 'talk',
  icon: '🤝',
  src: 'Thinking Airport brief',
  facts: [{ n: '3', l: 'partners at PTE Asia' }, { n: 'A130', l: 'Airport Intelligence stand' }, { n: 'D100', l: 'Solace stand' }],
  a: `<p>Three. <b>Airport Intelligence</b>, a subsidiary of Brussels Airport, provides operational
     advice and is at stand A130. <b>Solace</b> provides the event-streaming and integration appliances
     many of the world's biggest airports run on — stand D100. And <b>MindGraph</b>, here on the DXC
     stand, provides the agentic AI on the data fabric.</p>
     <p>DXC stays vendor-neutral on the MSI side — that's what lets it be an independent advisor.</p>`
},
{
  id: 'dxc-offering-focus',
  q: 'What is DXC focusing on at PTE?',
  k: 'offering focus dxc what does dxc offer airports passenger experience terminal operations command control modernisation services capabilities',
  scene: 'proposition',
  icon: '🎯',
  src: 'PTE Asia brief',
  facts: [{ n: '4', l: 'focus areas' }, { n: '1', l: 'core offer: MSI' }],
  a: `<p>Four things. <b>Master Systems Integration</b> is the core. Around it: <b>passenger
     experience</b>, <b>terminal operations</b> and <b>airport command and control</b> — with AI-enabled
     transformation shown in action rather than described on a slide.</p>
     <p>The bigger message: helping airports move from fragmented decision-making to coordinated,
     real-time operating intelligence.</p>`
},

/* ── PTE Asia 2026 (visitor-facing facts only) ──────────────────────────── */
{
  id: 'pte-asia',
  q: 'Where is DXC at PTE Asia and when are the talks?',
  k: 'pte asia passenger terminal expo singapore where is dxc stand booth c120 marina bay sands hall when dates 23 24 september gold sponsor event find dxc location',
  scene: 'talk',
  icon: '📍',
  src: 'PTE Asia brief',
  facts: [{ n: 'C120', l: 'DXC stand' }, { n: '23–24', l: 'September 2026' }, { n: '~3,500', l: 'expected attendees' }, { n: '1st', l: 'Asia edition of PTE', human: true }],
  a: `<p>You're at Passenger Terminal Expo Asia 2026 — the first Asia edition — at Marina Bay Sands,
     Basement 2, Halls D and E, on the 23rd and 24th of September. DXC is a Gold Sponsor at
     <b>stand C120</b>.</p>
     <p>Two sessions on Wednesday the 23rd: a solo talk at 10:20 and a panel at midday, both in the
     Passenger Experience Theatre. Ask me about them.</p>`
},
{
  id: 'dxc-talks',
  q: 'What are DXC’s speaking sessions?',
  k: 'speaking sessions talk panel presentation tomorrow airport today digital masterplanning theatre when is the talk speakers gordon daniel agenda time',
  scene: 'talk',
  icon: '🎤',
  src: 'PTE Asia brief',
  facts: [{ n: '10:20', l: 'Wed 23 Sep · solo talk' }, { n: '12:00', l: 'Wed 23 Sep · panel' }, { n: '2', l: 'sessions' }],
  a: `<p>Two, both on Wednesday the 23rd in the Passenger Experience Theatre.</p>
     <ul>
       <li><b>10:20 – 10:40</b> — "Tomorrow Airport… Today", with Gordon Heap, DXC's Principal for Aviation.</li>
       <li><b>12:00 – 12:40</b> — panel: "Designing the airport of tomorrow — digital masterplanning in Asia", with Daniel Biondi, DXC's CTO for Asia Pacific, alongside leaders from Perth Airport, GBIA and Airports of Thailand.</li>
     </ul>`
},
{
  id: 'booth-zones',
  q: 'What can I see on the stand?',
  k: 'stand booth zones what can i see led wall touchscreen pod demo roi calculator hero games gamification showcase deep dive zone a b c',
  scene: 'talk',
  icon: '🖥️',
  src: 'PTE Asia brief',
  facts: [{ n: '3', l: 'showcase zones' }, { n: '3360×1080', l: 'main LED wall' }, { n: '43"', l: 'touchscreen, zone B' }],
  a: `<p>Three zones. <b>Zone A</b> is the big LED wall: MindGraph's gamification showcase on one side
     and the hero demo on the other. <b>Zone B</b> is a 43-inch touchscreen with the ROI calculator and
     use cases. <b>Zone C</b> is a 32-inch pod for double-click, deep-dive sessions.</p>
     <p>And there's me. I'm the one that never needs a coffee break.</p>`
},
{
  id: 'survey-gift',
  q: 'Is there a survey or a gift?',
  k: 'survey gift giveaway token of appreciation luggage tracker suit bag qr code questionnaire free prize scan',
  scene: 'talk',
  icon: '🎁',
  src: 'PTE Asia brief',
  facts: [{ n: '3', l: 'minutes' }, { n: '5', l: 'questions' }, { n: '1', l: 'gift, your pick', human: true }],
  a: `<p>There is. Scan the QR code on the stand, answer five quick questions — about three minutes on
     where your airport is investing and what the airport of 2030 needs — and pick a token of
     appreciation: a suit bag or a Bluetooth luggage tracker.</p>
     <p>I'd recommend the tracker. I've seen the baggage KPIs.</p>`
},
{
  id: 'games',
  q: 'What are the games on the stand?',
  k: 'games play gamification game showcase interactive zone a1 mindgraph games fun',
  scene: 'talk',
  icon: '🎮',
  src: 'PTE Asia brief',
  facts: [{ n: 'A1', l: 'zone for the games' }],
  a: `<p>Zone A1 on the LED wall is MindGraph's gamification showcase — an interactive way into the same
     airport intelligence, run by the MindGraph team on the stand. They'll happily walk you through
     it; I stick to the platform story.</p>`
},
{
  id: 'joke',
  q: 'Tell me a joke',
  k: 'joke funny laugh humour humor make me laugh something funny lighten up',
  scene: 'talk',
  icon: '😄',
  src: 'AIRIS, unsourced',
  facts: [{ n: '1', l: 'joke, on the house', human: true }],
  a: `<p>Alright. I asked the baggage system for a joke. It said it would get back to me in three to
     five business days.</p>
     <p>Here's a better one: a workflow that fires when nothing happens. Sounds like a joke — it's
     actually my favourite feature. Ask me about the missing-event trigger.</p>`
},
];

/* ── a few gentle sign-offs ──────────────────────────────────────────────
   Appended to some local answers (never to a don't-know). Airport-flavoured,
   short, and never at anyone's expense. The LLM path writes its own.      */
export const WINKS = [
  'And no, I don’t get frequent-flyer points for this.',
  'I’d offer you a coffee, but I’m made of pixels.',
  'Fun fact: I have never lost a bag. Mostly because I don’t have hands.',
  'If only real gate changes were this quick.',
  'I’ll be here all conference — no boarding pass required.',
  'Ask me another. I never get tired; it’s one of my better features.',
  'That’s the short version. I can do a longer one, but you’d miss your flight.',
  'I’d say “trust me”, but I’d rather you checked the source. It’s right there.',
  'See? Not every AI answer needs a paragraph.',
  'Small print: I’m a presenter, not a lawyer. The team handles the fine print.',
];

/* ── retrieval ────────────────────────────────────────────────────────────
   Deliberately simple and deliberately legible: token overlap with a light
   IDF-ish weighting, a bigram bonus, and a floor below which AIRIS says she
   does not know rather than returning her least-bad guess. The entry's own
   question (q) is scored alongside its keywords.
   ------------------------------------------------------------------------ */

const STOP = new Set(('a an the is are was were be been do does did can could would should will ' +
  'shall may might must of in on at to for from by with about as into like through after over between ' +
  'and or but if then so than that this these those it its i we you they he she them our your their me my ' +
  'what which who whom whose how why when where there here have has had having get got give give me ' +
  'tell explain please just really very much more most some any all also too').split(' '));

/* a very light stemmer: plurals only, so "systems" meets "system" and
   "biometrics" meets "biometric" without a stemming library */
const stem = w => (w.length > 4 && /s$/.test(w) && !/ss$/.test(w)) ? w.slice(0, -1) : w;

const tok = s => String(s || '').toLowerCase()
  .replace(/[’']/g, '')
  .split(/[^a-z0-9%]+/)
  .filter(w => w && !STOP.has(w))
  .map(stem);

const norm = s => String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

const keysOf = e => `${e.k} ${e.q || ''}`;

const DF = (() => {
  const m = new Map();
  for (const e of KB) for (const w of new Set(tok(keysOf(e)))) m.set(w, (m.get(w) || 0) + 1);
  return m;
})();

export function search(question, limit = 3) {
  const q = tok(question);
  if (!q.length) return [];
  const qSet = new Set(q);
  const raw = String(question || '').toLowerCase();

  const scored = KB.map(e => {
    const keys = keysOf(e).toLowerCase();
    const ks = tok(keys);
    const kSet = new Set(ks);
    let score = 0;
    let matched = 0;
    for (const w of qSet) {
      if (kSet.has(w)) { score += 1 / Math.log2(2 + (DF.get(w) || 1)); matched++; }
      // partial credit for stems: "dashboards" vs "dashboard"
      else if ([...kSet].some(k => k.length > 4 && (k.startsWith(w) || w.startsWith(k)))) { score += 0.45; matched++; }
    }
    // adjacent-pair bonus — "air gapped", "risk register", "human loop"
    for (let i = 0; i < q.length - 1; i++) {
      if (keys.includes(`${q[i]} ${q[i + 1]}`)) score += 0.8;
    }
    // a question that names the topic outright
    if (e.id.split('-').every(p => raw.includes(p))) score += 0.6;
    // the entry's own question, asked verbatim (chips, stage buttons)
    if (e.q && norm(raw).includes(norm(e.q))) score += 1.2;
    return { e, score: score / Math.sqrt(qSet.size), matched, coverage: matched / qSet.size };
  })
  .filter(x => x.score > 0)
  .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}

export const CONFIDENCE_FLOOR = 0.34;

/** A hit AIRIS is allowed to answer from: over the floor, AND enough of the
    question actually matched — one generic word ("plan", "hall") is not enough. */
export const isGrounded = h => Boolean(h) && h.score >= CONFIDENCE_FLOOR && (h.matched >= 3 || h.coverage >= 0.5);

export const DONT_KNOW = `<p>Ooh — that one isn't in what I've been given, and I'd rather say so than make
  something up. In an airport, a confident wrong answer is the expensive kind.</p>
  <p>The MindGraph and DXC team on the stand will have a proper answer. Meanwhile, try me on the data
  model, the AIRIS demo, the agents, governance, or how it lands in your airport.</p>`;
