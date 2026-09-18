/* ============================================================================
   The walkthrough. Twelve scenes.

   This is a PLATFORM story, not a use-case story. The shape of the argument is:
     all your data, in one governed place
       → the airport modelled on top of it
         → ask it anything
           → build anything on it — boards, apps, workflows, agents
             → and every one of those is governed by construction.

   The named use cases that appear are examples of what has already been built,
   explicitly framed as where airports START, not where the platform stops.

   Every figure is traceable to the product's own metadata or to a document in
   the "Airports in a Box" folder on the share (the folder name predates the
   product being called Intelligent Airport) — see docs/CONTENT-SOURCES.md.

   Shape of a scene:
     id        stable key; the knowledge base deep-links answers to it. These
               twelve ids are an API — src/knowledge.js deep-links to them and
               scene 2's chooser jumps by them. Renaming one is a breaking
               change, not a copy edit.
     title     header + filmstrip label
     flag      optional filmstrip badge ("live")
     lines     narration, one caption at a time
     html()    the stage
     enter(ctx) optional — runs after the stage mounts
   ========================================================================== */

/* small helpers so the stage markup stays readable */
const card = (title, body, foot, chip) => `
  <div class="card">
    ${chip ? `<div class="card-head"><h3>${title}</h3>${chip}</div>` : `<h3>${title}</h3>`}
    <p>${body}</p>
    ${foot ? `<div class="roi">${foot}</div>` : ''}
  </div>`;

const metric = (n, l, human) => `
  <div class="metric"><div class="n${human ? ' human' : ''}">${n}</div><div class="l">${l}</div></div>`;

/* The product's name, in one place, because it is spoken aloud and it has been
   renamed once already. NOT the same thing as AIRIS (the engine named in the
   source briefing, and where Iris gets her own name) or as DXC's "Thinking
   Airport" vision — docs/CONTENT-SOURCES.md keeps all three distinct on
   purpose, and the knowledge base has an entry that explains the difference. */
export const PRODUCT = 'Intelligent Airport';

export const SCENES = [

/* 1 ──────────────────────────────────────────────────────────────────────── */
{
  id: 'open',
  title: PRODUCT,
  eyebrow: 'Airport vertical · MindGraph × DXC',
  lines: [
    "I'm Iris, and I speak for Intelligent Airport — the platform MindGraph and DXC put on top of an airport you already run.",
    "Let me be clear about what this is before anything else. It is not an application. It is not a fixed list of modules you pick from a menu.",
    "It is a platform. Every system in your airport, read into one governed model of your data — and then anything you want built on top of it.",
    "A dashboard. An application. An automated workflow. An AI agent. Asked for in plain language, built without an engineering ticket, and governed the same way whether it took you five minutes or five months.",
    "Your airport already owns the plumbing. This is the brain that sits on top of it. Let me show you."
  ],
  html: () => `
    <p class="eyebrow">Airport vertical · MindGraph × DXC · Confidential</p>
    <h1>All of the airport's data.<br>Then build anything on it.</h1>
    <p class="lede">Airports already own the plumbing — AODB, FIDS, ERP, baggage, A-CDM, CCTV,
      building management, the sensor estate. Intelligent Airport replaces none of it. It reads every
      source into <strong>one governed model</strong>, and turns that model into the surface every
      board, app, workflow and agent is built on.</p>
    <div class="metrics">
      ${metric('58', 'Canonical entities')}
      ${metric('201', 'Governed KPIs')}
      ${metric('5', 'Control centres')}
      ${metric('0', 'Systems replaced', true)}
      ${metric('∞', 'Things you can build', true)}
    </div>
    <div class="gate">One governed pipeline. Every question, every board, every workflow and every
      agent resolves through it — so access, masking and audit are the same everywhere.</div>`
},

/* 2 ──────────────────────────────────────────────────────────────────────── */
{
  id: 'start',
  title: 'Where should I start?',
  eyebrow: '▸ where should I start?',
  lines: [
    "Before I dive in — where would you like me to start?",
    "Pick whatever you're most curious about and I'll take you straight there. Or choose the full walkthrough and I'll give you the whole tour.",
    "You can scrub back with the film strip on the right at any point, and you can stop me with a question whenever you like."
  ],
  html: () => `
    <p class="eyebrow">▸ where should I start?</p>
    <h1>Where should I take you first?</h1>
    <p class="lede">Tap one — I'll jump right there.</p>
    <div class="chooser">
      <button data-goto="proposition"><span>🧭&nbsp;&nbsp;What it actually is</span><span class="arrow">→</span></button>
      <button data-goto="data"><span>🗄&nbsp;&nbsp;The data foundation — what it knows</span><span class="arrow">→</span></button>
      <button data-goto="build"><span>🧱&nbsp;&nbsp;Building boards, apps, workflows and agents</span><span class="arrow">→</span></button>
      <button data-goto="live"><span>⏱&nbsp;&nbsp;Show me it working — live</span><span class="arrow">→</span></button>
      <button data-goto="governance"><span>🛡&nbsp;&nbsp;Governance, risk and compliance</span><span class="arrow">→</span></button>
      <button data-goto="deploy"><span>🛫&nbsp;&nbsp;How it would land in my airport</span><span class="arrow">→</span></button>
      <button class="full" data-goto="proposition" data-full="1"><span>▸&nbsp;&nbsp;Give me the full walkthrough</span><span class="arrow">→</span></button>
    </div>`,
  enter(ctx) {
    ctx.root.querySelectorAll('[data-goto]').forEach(b =>
      b.addEventListener('click', () => ctx.goto(b.dataset.goto, { play: true })));
  }
},

/* 3 ──────────────────────────────────────────────────────────────────────── */
{
  id: 'proposition',
  title: 'The proposition',
  eyebrow: '01 · the proposition',
  lines: [
    "Here is the proposition in one sentence. We do not replace a single system you own.",
    "What we add is a non-invasive overlay. It connects to every source system, unifies the data into one canonical model, and puts AI, prediction, automation and a single command picture on top.",
    "Everything it reads is ingest-only by default. It does not write back into an operational system unless you have explicitly opened that door — which is what makes it safe to point at an ops room rather than a lab.",
    "And the reason airports say yes is not the architecture. It's that every lever it pulls lands on a number a CFO recognises: cost out, capex deferred, revenue up, risk removed."
  ],
  html: () => `
    <p class="eyebrow">01 · the proposition</p>
    <h1>Sits on top of everything.<br>Replaces none of it.</h1>
    <p class="lede">Source systems untouched. Read — and written only where you allow it — through
      APIs and the service bus. <strong>No replacement, no downtime</strong>, value added incrementally.
      Of the three ways into an airport this is the fastest ROI and the lowest disruption.</p>

    <h2>What it plugs into</h2>
    <div class="estate">
      <span>AODB</span><span>FIDS &amp; flight schedule</span><span>ERP / Finance</span>
      <span>Baggage — BHS &amp; BRS</span><span>A-CDM</span><span>CCTV / VMS</span>
      <span>BMS / SCADA &amp; meters</span><span>IoT — Xovis, BLE, Wi-Fi</span>
      <span>DCS / ticketing</span><span>Car park &amp; landside</span><span>Retail POS</span>
      <span>Legacy &amp; mainframe</span><span>Airline / GDS</span><span>Government &amp; regulator</span>
    </div>
    <h2>Speaks every protocol</h2>
    <div class="estate">
      <span>REST / JSON</span><span>SOAP / XML</span><span>GraphQL</span><span>Kafka / MQ</span>
      <span>SFTP / CSV</span><span>Webhooks</span><span>ODBC / JDBC</span><span>MQTT / IoT</span>
      <span>gRPC</span><span>RPA — where there is no API at all</span>
    </div>

    <h2>The four levers everything is measured against</h2>
    <div class="grid g4">
      ${card('Cost out', 'Utilities, maintenance, labour — the fastest and most visible payback on the P&amp;L.')}
      ${card('Capex deferred', 'Sweat the stands, belts and terminal you already own instead of building more.')}
      ${card('Revenue up', 'Non-aeronautical spend per passenger, on the same footfall.')}
      ${card('Risk removed', 'Compliance, carbon and security exposure closed, with the audit trail behind it.')}
    </div>
    <div class="note">Any ROI range quoted in this walkthrough is an indicative industry figure. It is
      replaced by your own number in a short baseline assessment during onboarding — never quoted as a
      guarantee before that.</div>`
},

/* 4 ──────────────────────────────────────────────────────────────────────── */
{
  id: 'data',
  title: 'All the data',
  eyebrow: '02 · the data fabric',
  lines: [
    "Everything else I'm going to show you rests on this scene, so let me spend a moment here.",
    "Source systems land in the lakehouse and are mapped into one canonical model of the airport. Fifty-eight entities — flight, bag, passenger, cargo, retail transaction, energy, roster, revenue, sensor, emergency event, IT system, and so on. Two hundred and one KPIs defined once, on top of them.",
    "Defined once is the important part. On-time performance means the same thing in the operations dashboard, in a workflow's threshold, in an agent's answer and in the board that goes to your regulator. There is no second definition hiding in someone's spreadsheet.",
    "Around it sits the catalog: every table and document, their lineage back to source, and a business glossary so the word a director uses resolves to the field an engineer built.",
    "And there's a governed SQL explorer for the people who'd rather write the query themselves — same masking, same row policies, same audit trail. We do not make the analysts leave."
  ],
  html: () => `
    <p class="eyebrow">02 · the data fabric · one governed model</p>
    <h1>Every source, one model,<br>one definition of the truth.</h1>

    <div class="pipeline">
      <div class="stage-step"><div class="sn">Sources</div><div class="sv">21</div><div class="sd">mapped feeds — AODB, A-CDM, BHS, DCS, sensors, car park, retail POS, ASQ, airline master data</div></div>
      <div class="arrow-r">→</div>
      <div class="stage-step"><div class="sn">Canonical model</div><div class="sv">58</div><div class="sd">entities — the airport described once, independent of the system it came from</div></div>
      <div class="arrow-r">→</div>
      <div class="stage-step"><div class="sn">Governed KPIs</div><div class="sv">201</div><div class="sd">measures defined once and reused by every board, workflow, agent and answer</div></div>
    </div>

    <h2>What sits around it</h2>
    <div class="grid g2">
      ${card('Catalog', 'Every table and document in the estate, browsable, with lineage back to the source system and forward to everything that consumes it.')}
      ${card('Airport model', 'The canonical schema and its source mappings. Map a new system’s entity here and everything downstream lights up — no downstream change.')}
      ${card('Business glossary', 'The word a director uses, bound to the field an engineer built. Proposed terms go through review before they become canon.')}
      ${card('Governed explorer', 'SQL for people who want SQL — through the same pipeline, so masking, row policies and audit apply identically.')}
      ${card('Documents', 'SOPs, data-sharing policies, data dictionaries and compliance rules, searchable and citable by the assistant alongside the structured data.')}
      ${card('Sources', 'Connect and manage feeds. Real-time streaming, scheduled ETL, REST pulls, webhooks and file drops all land in the same place.')}
    </div>
    <div class="gate">One governed pipeline. A question, a dashboard tile, a workflow threshold and an
      agent’s answer all resolve the same way — so there is exactly one place to change a definition,
      and exactly one place to audit who saw what.</div>`
},

/* 5 ──────────────────────────────────────────────────────────────────────── */
{
  id: 'model',
  title: 'The airport, modelled',
  eyebrow: '03 · the operating model',
  lines: [
    "On top of the data sits the airport itself — modelled the way you actually run it.",
    "Five control centres. The AOCC for day-to-day flight, baggage, passenger and resource operations. The tower. The emergency operations centre, structured to your airport emergency plan. The network and IT operations centre. And the security operations centre, physical and cyber together.",
    "Alongside them, the business domains — energy, ESG, facility management, safety training, aviation security, OT security. And the applications: passenger flow, revenue management, disaster operations, connected health, rostering.",
    "Now here is the sentence I want you to remember, because it's the whole difference between a product and a platform.",
    "Adding a domain is metadata, not code. You name it, you point it at an entity, and it arrives with a working dashboard. No release. No engineering ticket. No waiting for our roadmap.",
    "That's why I won't give you a fixed list of use cases. The list is however many your airport has."
  ],
  html: () => `
    <p class="eyebrow">03 · the operating model</p>
    <h1>The airport, modelled<br>the way you run it.</h1>

    <h2>Five control centres</h2>
    <div class="grid g3">
      ${card('AOCC', 'Airport Operations Control Centre — day-to-day flight, baggage, passenger and resource operations.', 'Flight / FIDS · Cargo · Baggage · Retail · Airline · Passenger · Ticketing / DCS · Vehicle / Landside · Feedback')}
      ${card('ATC', 'Air Traffic Control Tower — runway and airspace movements: tower, ground and approach.', 'Runway movements · Tower watch · Airspace feed')}
      ${card('EOC', 'Emergency Operations Centre — crisis coordination per the Airport Emergency Plan (ICAO Annex 14 / FAA Part 139).', 'Emergency incidents · Response resources · Mass notification &amp; mustering')}
      ${card('NOC', 'Network / IT Operations Centre — the technology backbone that runs the airport: uptime, network, applications, incidents.', 'System uptime · Network &amp; telecoms · IT incidents')}
      ${card('SOC', 'Security Operations Centre — physical and cyber security monitoring and response, in one place.', 'CCTV &amp; access control · Checkpoint screening · Perimeter &amp; restricted areas · Cyber / SIEM')}
      ${card('…and the next one', 'A control centre is a metadata file. Name it, give it subdomains, point them at entities — it appears with the standard governed dashboard.', 'Added by an administrator in the product, not by us in a release.')}
    </div>

    <h2>Business domains</h2>
    <div class="estate">
      <span>Energy Management</span><span>ESG &amp; carbon</span><span>Facility Management / CMMS</span>
      <span>Safety Training</span><span>AVSEC</span><span>OT Security</span><span>Healthcare</span>
    </div>

    <h2>Applications already built on it</h2>
    <div class="grid g2">
      ${card('Passenger360', 'Live passenger flow on the sensor estate — queues, check-in, fill level, objects and PRM, forecasts, a live 2D floor and a 3D twin layer.')}
      ${card('Revenue Management', 'Aeronautical and non-aeronautical revenue: airline billing (tariff → gross charges → incentive credit → net invoice → collection), the airline marketing incentive programme, and route development from market opportunity through business case to launch and ROI.')}
      ${card('AIR Disaster Management', 'Coordinated response for major disruption and crisis events, wired to the emergency operations centre.')}
      ${card('Connected Health', 'Rapid emergency response linked to connected medical devices.')}
      ${card('Roster Management', 'Staff scheduling and roster analytics — demand, standby, assignment, absence, touchpoints.')}
      ${card('Published boards', 'Any board can be published to a viewer audience — partners, executives, a regulator — with its own access scope.')}
    </div>

    <div class="gate">Adding a domain or a control centre is <b>metadata, not code</b>. It gets the
      standard governed dashboard immediately, and lights up the moment its entity is mapped.</div>`
},

/* 6 ──────────────────────────────────────────────────────────────────────── */
{
  id: 'ask',
  title: 'Ask it anything',
  eyebrow: '04 · the assistant',
  lines: [
    "With the model in place, the first thing it buys you is the end of the report queue.",
    "Anyone in the building asks an operational question in plain language and gets an answer, with a chart, in seconds. Across every connected source at once. No SQL. No ticket to the analytics team. No two-day wait for a report that was stale when it arrived.",
    "The word governed matters here. The assistant answers through the same pipeline as everything else — so it can only see what your role is allowed to see. Masking applies. Row policies apply. The answer is logged.",
    "It cites where the number came from, so a sceptical director can follow it back to the source table. And when it doesn't know, it says so rather than inventing a figure — which is the single most important behaviour in a room full of operators.",
    "In practice this is where roughly eighty percent of analyst time gets handed back."
  ],
  html: () => `
    <p class="eyebrow">04 · the assistant · governed natural language</p>
    <h1>Ask in plain language.<br>Get the number, and its source.</h1>

    <div class="screen">
      <div class="screen-bar">
        <span class="lamps"><i style="background:var(--melon)"></i><i style="background:var(--gold)"></i><i style="background:var(--ok)"></i></span>
        <span>assistant · governed query</span>
        <span style="margin-left:auto;color:var(--ink-3)">scope: your role</span>
      </div>
      <div class="screen-body">
        <div class="qa">
          <div class="q-line">“Which airline lost us the most on-time performance last month, and was it the same stands each time?”</div>
          <div class="a-line">
            <span class="a-tag">answer</span>
            Resolved across <b>flight legs</b>, <b>airline performance</b> and <b>resource allocation</b> —
            returned as a ranked chart with the stand breakdown beneath it, in seconds.
          </div>
          <div class="cites">
            <span class="lbl">resolved through</span>
            <span class="cite">canonical · FlightLeg</span>
            <span class="cite">canonical · AirlinePerformance</span>
            <span class="cite">kpi · otp_pct</span>
            <span class="cite">kpi · avg_leg_delay</span>
          </div>
        </div>
      </div>
    </div>

    <h2>What makes it safe to put in front of the floor</h2>
    <div class="grid g3">
      ${card('It only sees your scope', 'The assistant runs under the asker’s identity. Column masking and row policies are applied by the pipeline, not by the prompt.')}
      ${card('It shows its working', 'Every answer names the entities and KPIs it resolved through, so the number can be followed back to source.')}
      ${card('It is logged', 'Question, scope and result land in the audit trail — the same trail a regulator would be shown.')}
      ${card('It reads documents too', 'SOPs, data dictionaries and policy documents are searchable alongside the structured data, so “what is our rule for this?” is answerable.')}
      ${card('Engines are yours to choose', 'Which model serves which purpose is an administrator setting. Swap the engine without touching a single board or workflow.')}
      ${card('It can be wrong out loud', 'An ambiguous question comes back as a question. That is deliberate — a confident wrong number is worse than no number.')}
    </div>`
},

/* 7 ──────────────────────────────────────────────────────────────────────── */
{
  id: 'build',
  title: 'Build anything on it',
  eyebrow: '05 · the build surfaces',
  lines: [
    "Now the part that makes this a platform rather than a product.",
    "Four things get built on that data model, and all four are built by the people who need them rather than by an engineering backlog.",
    "Dashboards. Not a fixed set — a canvas of tiles over any governed measure, saved, shared, and published to whoever should see it.",
    "Applications. Describe what you want on your data and it is generated against the canonical model — hero, KPI row, charts, tables, flight boards, maps, forms — then refined by hand where you want it exact.",
    "Workflows. A canvas of triggers and actions: schedules, thresholds, webhooks, live events, and the one people forget — fire when an expected event doesn't arrive. A silent feed is a fault.",
    "And agents. Registered, scoped, evaluated, guardrailed. I'll come to them next.",
    "The point is that the twentieth dashboard costs what the second one did. That is what unbounded actually means."
  ],
  html: () => `
    <p class="eyebrow">05 · the build surfaces</p>
    <h1>Boards, apps, workflows, agents.<br>Built by the people who need them.</h1>

    <div class="grid g2">
      ${card('Dashboards — endless', 'A canvas of tiles over any governed measure, in any combination, saved and shared. Publish a board to an audience — a partner, an executive, a regulator — with its own access scope. There is no fixed set, and the twentieth costs what the second did.', 'Every tile resolves through the governed pipeline. A board cannot show a number its viewer is not allowed to see.')}
      ${card('Applications — described, then generated', 'Describe the application you want on your data and it is generated against the canonical model, from a component library: hero, navbar, KPI, chart, data table, timeline, filter bar, search, status badge, flight board, map, gallery, form. Then edited by hand where you want it precise.', 'Generated apps inherit the same scopes and audit as everything else — they are not a side door to the data.')}
      ${card('Workflows — the automation canvas', 'Triggers: manual run, schedule or cron, a governed measure crossing a threshold, an inbound webhook, a live push event, another workflow failing, or an expected event that never arrived. Actions: query the lakehouse, ask a registered agent, branch, open an alert, email, POST to any REST API, or notify Slack, Teams, Discord, Telegram or WhatsApp.', 'Eleven playbooks ship with the product, disabled, so a fresh install has something real to turn on. They are examples — not the ceiling.')}
      ${card('Agents — registered, not improvised', 'Purpose-built agents over the same data scope, each with a risk tier, a declared tool set, evaluations and guardrails. A catalog, a run history, and a topology view of which agent calls what.', 'Shipped today: Airport Hub Analyst, Ops Analyst, Baggage Analyst, Retail Analyst, Data Steward, Compliance Explainer.')}
    </div>

    <h2>The trigger people forget</h2>
    <div class="ba">
      <div class="before"><b>Everyone builds this</b>Alert when a number goes past a threshold. Useful, and it is the first thing every monitoring tool does.</div>
      <div class="after"><b>This one catches the outage</b>Fire when an <b>expected event does not arrive</b> — a heartbeat on a silent feed. A dashboard reading zero and a dashboard reading nothing look identical until something asks the question.</div>
    </div>
    <div class="note">Three forecast models ship alongside — delay prediction, passenger-flow
      forecasting and baggage anomaly detection — and sit in the same catalog, under the same
      provenance rules, as everything else.</div>`
},

/* 8 ──────────────────────────────────────────────────────────────────────── */
{
  id: 'live',
  title: 'Watch it work — live',
  flag: 'live',
  eyebrow: '06 · one workflow, end to end',
  lines: [
    "Let me stop describing it and run one.",
    "This is a shipped playbook: a security queue has been over the airport's wait-time target for two minutes. Watch every stage, because every stage is a node you can swap.",
    "The live event fires. The workflow queries the canonical model — governed, so it sees exactly what its scope allows. It asks a registered agent to explain what it's looking at. It opens an alert in the operations register, deduped so the same queue doesn't raise forty of them. It notifies the channels that matter.",
    "And then it stops. Because the last step is a human.",
    "That's the rule that makes an automated platform safe to point at a live airport: the machine does the watching, the querying, the explaining and the drafting — and a person makes the call.",
    "Eleven of these ship with the product, switched off, so a fresh install has something real to turn on. They are examples. Swap any node and it's a different workflow entirely."
  ],
  html: () => `
    <p class="eyebrow">06 · one workflow, end to end</p>
    <h1>Trigger, query, agent, alert,<br>notify — then a human.</h1>
    <p class="lede">A shipped playbook: <strong>a security queue has been over the airport's wait-time
      target for two minutes.</strong> Every stage below is a node — swap any one and it is a
      different workflow.</p>

    <div class="run">
      <div class="run-screen">
        <div class="screen-bar">
          <span class="lamps"><i style="background:var(--melon)"></i><i style="background:var(--gold)"></i><i style="background:var(--ok)"></i></span>
          <span>workflow · security wait above target</span>
          <span style="margin-left:auto" id="runStatus">● DISABLED</span>
        </div>
        <div class="screen-body">
          <ol class="steps" id="runSteps">
            <li data-s="0"><span class="sk">trigger</span><span class="sb">Live event — security queue over target for 2 min</span></li>
            <li data-s="1"><span class="sk">query</span><span class="sb">Canonical query — PaxQueue, PaxProcessPoint, PaxLineCount · masking and row policy applied</span></li>
            <li data-s="2"><span class="sk">agent</span><span class="sb">Ops Analyst explains it — under its own governed data scope</span></li>
            <li data-s="3"><span class="sk">branch</span><span class="sb">Above threshold? → true</span></li>
            <li data-s="4"><span class="sk">alert</span><span class="sb">Open in the operations alert register · deduped while one is open</span></li>
            <li data-s="5"><span class="sk">notify</span><span class="sb">Email the duty manager · post to the SOC channel</span></li>
            <li data-s="6" class="human"><span class="sk">approval</span><span class="sb">Waits for a person — open a lane, hold, or dismiss</span></li>
          </ol>
        </div>
      </div>

      <div class="run-side">
        <div class="card">
          <h3>Every node is swappable</h3>
          <p style="margin-bottom:10px">The same seven-stage shape runs a baggage SLA watch, a cargo
            dwell breach, a non-aero revenue dip, an IT availability alert or an emergency activation.
            Only the nodes differ.</p>
          <div class="estate">
            <span>manual</span><span>schedule / cron</span><span>threshold</span><span>webhook</span>
            <span>live event</span><span>on another flow's failure</span><span>missing event</span>
          </div>
          <div class="roi" style="margin-top:12px"><b>Shipped playbooks</b>
            Flight OTP &amp; delay · Airline OTP &amp; cancellations · Baggage mishandling &amp; first-bag
            SLA · Cargo dwell &amp; throughput · Retail non-aero revenue dip · Customer complaint &amp;
            ASQ · Security screening &amp; breach · Security wait above target · Lounge at capacity ·
            IT availability &amp; SLA breach · Emergency response watch
          </div>
        </div>
        <button class="btn primary" id="runBtn" style="margin-top:12px;width:100%">▸ Run the workflow</button>
      </div>
    </div>

    <div class="gate">The machine watches, queries, explains and drafts. <b>A person makes the call.</b>
      That is the rule that makes this safe to point at a live airport.</div>`,
  enter(ctx) {
    const steps = [...ctx.root.querySelectorAll('#runSteps li')];
    const status = ctx.root.querySelector('#runStatus');
    const btn = ctx.root.querySelector('#runBtn');
    let timers = [];

    const clear = () => { timers.forEach(clearTimeout); timers = []; };
    const reset = () => {
      clear();
      steps.forEach(s => s.classList.remove('lit', 'waiting'));
      status.textContent = '● DISABLED'; status.style.color = 'var(--ink-3)';
      btn.textContent = '▸ Run the workflow'; btn.disabled = false;
    };

    const run = () => {
      reset();
      btn.disabled = true; btn.textContent = 'Running…';
      status.textContent = '● RUNNING'; status.style.color = 'var(--gold)';
      steps.forEach((s, i) => {
        timers.push(setTimeout(() => {
          s.classList.add('lit');
          if (i === steps.length - 1) {
            s.classList.add('waiting');
            status.textContent = '● WAITING FOR A HUMAN';
            status.style.color = 'var(--gold)';
            btn.disabled = false; btn.textContent = '↻ Run it again';
          }
        }, 380 + i * 780));
      });
    };

    btn.addEventListener('click', run);
    ctx.onLine(2, run);            // fires as the narration reaches "the live event fires"
    ctx.onLeave(clear);
  }
},

/* 9 ──────────────────────────────────────────────────────────────────────── */
{
  id: 'agents',
  title: 'Agents, governed',
  eyebrow: '07 · the agents',
  lines: [
    "A word about the agents, because this is where most AI platforms quietly stop being auditable.",
    "An agent here is not a prompt somebody pasted into a chat window. It's a registered object with a purpose, a risk tier, a declared set of tools, its own governed data scope, an evaluation suite and guardrails.",
    "There's a catalog of them, a full run history, and a topology view that shows you which agent calls which tool and which other agent — so nobody has to guess what is talking to what.",
    "Six ship with the product. An airport hub analyst, an operations analyst, a baggage analyst, a retail analyst, a data steward, and a compliance explainer. You register your own the same way.",
    "And everything irreversible lands in one approvals inbox. Human in the loop is not a setting we can forget to switch on — it is the shape of the thing."
  ],
  html: () => `
    <p class="eyebrow">07 · the agents · registered, scoped, evaluated</p>
    <h1>An agent is an object,<br>not a prompt somebody pasted.</h1>

    <div class="grid g3">
      ${card('Airport Hub Analyst', 'The general analyst across the whole governed estate — routes a question to the specialist that owns it.', '', '<span class="chip live">shipped</span>')}
      ${card('Ops Analyst', 'Operational questions and workflow explanations — the agent the live playbooks call.', '', '<span class="chip live">shipped</span>')}
      ${card('Baggage Analyst', 'First-bag SLA, mishandling and baggage-flow explanation against the baggage entities.', '', '<span class="chip live">shipped</span>')}
      ${card('Retail Analyst', 'Non-aeronautical revenue, conversion and spend-per-passenger.', '', '<span class="chip live">shipped</span>')}
      ${card('Data Steward', 'Catalog, lineage and glossary hygiene — proposes, never decides.', '', '<span class="chip live">shipped</span>')}
      ${card('Compliance Explainer', 'Translates an obligation into what it means for this airport, citing the document it came from.', '', '<span class="chip live">shipped</span>')}
    </div>

    <h2>What every agent carries</h2>
    <div class="grid g3">
      ${card('A risk tier', 'Declared, not inferred. What an agent is allowed to reach is a function of its tier, and changing a tier is a governed change.')}
      ${card('A data scope', 'It runs under its own scope through the same pipeline. An agent cannot see what its scope forbids, whoever asked it.')}
      ${card('Declared tools', 'The tool set is written down. The topology view renders it, so “what can this thing actually do?” has a visual answer.')}
      ${card('Evaluations', 'A suite that runs against it. An agent whose behaviour drifts is caught by its evals, not by a passenger.')}
      ${card('Guardrails', 'Explicit constraints on output and action, enforced outside the prompt.')}
      ${card('A run history', 'Every run, its inputs, its scope and its result — replayable.')}
    </div>

    <div class="gate">Anything irreversible lands in one <b>approvals inbox</b> and waits for a person.
      Human-in-the-loop is the shape of the platform, not a setting on it.</div>`
},

/* 10 ─────────────────────────────────────────────────────────────────────── */
{
  id: 'governance',
  title: 'Governance, risk & compliance',
  eyebrow: '08 · GRC',
  lines: [
    "Most platforms treat governance as a module you buy later. Here it is one of the five things in the navigation, and it governs the platform itself as well as the airport.",
    "The obligation register carries what you're actually held to. ICAO Annex 19 safety management, Annex 17 security, Annex 14 aerodrome, your emergency plan, IGOM ground operations, slot punctuality, ESG reporting, personal data and cross-border transfer, breach notification, access control, audit evidence — and, increasingly, AI governance and model provenance.",
    "The risk register scores both sides of the house: runway incursion, emergency readiness, security breach, OT cyber, on-time degradation, baggage SLA, resource shortfall, revenue concentration, ESG targets — and next to them, data access scope, personal-data exposure, and unapproved AI extraction.",
    "Underneath sit column-level access policies, a trust view covering data protection and AI governance, and an audit and telemetry trail across every surface.",
    "The reason this matters commercially is simple. An airport is a regulated environment, and the question that kills AI pilots is never 'is it clever'. It's 'can you show me who saw what, and why the model said that'. This answers both."
  ],
  html: () => `
    <p class="eyebrow">08 · governance, risks &amp; compliance</p>
    <h1>Governs the airport —<br>and governs itself.</h1>

    <h2>Obligations tracked</h2>
    <div class="grid g2">
      ${card('Aviation', 'ICAO Annex 19 safety management · Annex 17 security · Annex 14 aerodrome · the Airport Emergency Plan · IGOM ground operations · slot punctuality.')}
      ${card('Data &amp; privacy', 'Personal-data protection · cross-border transfer · breach notification · access control · audit evidence · retention schedules.')}
      ${card('Sustainability', 'ESG reporting against ACI, GRI and Airport Carbon Accreditation.')}
      ${card('AI', 'AI governance and model provenance — tracked as obligations in the same register as everything else, not in a separate slide.')}
    </div>

    <h2>Risks scored — both sides of the house</h2>
    <div class="grid g2">
      <div class="card">
        <div class="card-head"><h3>The airport</h3><span class="chip partial">operational</span></div>
        <p>Runway incursion · emergency readiness · AVSEC breach · OT cyber · OTP degradation ·
          baggage SLA · disruption · resource shortfall · aeronautical revenue concentration ·
          non-aero shortfall · ESG targets.</p>
      </div>
      <div class="card">
        <div class="card-head"><h3>The platform itself</h3><span class="chip live">self-governing</span></div>
        <p>Data access scope · personal-data exposure · unapproved AI extraction. The platform
          carries its own risks in the same register, scored on the same scale — because a tool that
          cannot be audited is a risk to the airport that bought it.</p>
      </div>
    </div>

    <h2>The controls behind them</h2>
    <div class="grid g3">
      ${card('Column-level access', 'An access matrix down to the column. Masking is applied by the pipeline, so it holds for a board, a query, a workflow and an agent equally.')}
      ${card('Trust view', 'Data protection and AI governance posture in one place — the view you would put in front of an auditor.')}
      ${card('Activity &amp; telemetry', 'Audit across every surface: who asked, under what scope, what came back, and what was approved.')}
      ${card('Governance packs', 'Obligations and policies ship as packs, so a new airport starts with the aviation baseline rather than a blank register.')}
      ${card('Proposed vs active', 'Policies and glossary terms have a proposed state and an active state. A definition changes through review, not by edit.')}
      ${card('Members &amp; access', 'Groups, grants and packs — with an editor / viewer split, so most of the building can read the platform safely.')}
    </div>`
},

/* 11 ─────────────────────────────────────────────────────────────────────── */
{
  id: 'deploy',
  title: 'How it lands',
  eyebrow: '09 · delivery',
  lines: [
    "So how does it actually land in your airport?",
    "About eighty-five percent of what you'd deploy already exists and is proven in production. The remaining fifteen is your brand, your terminal and zone maps, your local regulations, language and currency, your workflows and SLAs, and your data migration.",
    "That ratio is the commercial argument. You are not funding a build. You are funding a tailoring.",
    "Three ways in. Greenfield, where there's no entrenched estate and we stand the whole platform up. Brownfield, where ageing systems get consolidated in phases behind a parallel run with a rollback at every step. Or the intelligent layer, where your systems stay exactly as they are and we overlay on top — fastest ROI, lowest disruption.",
    "And it runs where you need it. Cloud, on-premise, hybrid, or fully air-gapped for a restricted ops room with no network at all. When a feed drops the board keeps rendering the last known state behind a clear stale banner, and says how old it is — because a dark screen in an operations room is worse than an old one."
  ],
  html: () => `
    <p class="eyebrow">09 · delivery &amp; engagement</p>
    <h1>Built once.<br>Tailored per airport.</h1>

    <h2>Effort to go live</h2>
    <div class="bars" style="margin-top:4px">
      <div class="bar"><span>Pre-built &amp; proven</span><span class="track"><span class="fill" style="width:85%"></span></span><span class="v">~85%</span></div>
      <div class="bar"><span>Tailored to you</span><span class="track"><span class="fill" style="width:15%;background:linear-gradient(90deg,var(--gold),var(--peach))"></span></span><span class="v">~15%</span></div>
    </div>
    <p class="lede" style="margin-top:14px">The tailored fifteen is brand and UX, terminal and zone maps,
      local regulations, language and currency, ops workflows and SLAs, and data migration. Everything
      else is reused as-is.</p>

    <h2>Three ways in</h2>
    <div class="grid g3">
      ${card('01 · Greenfield', '<b style="color:var(--ink)">Fits</b> a new airport or terminal, no entrenched systems, moving off paper.<br><br><b style="color:var(--ink)">How</b> deploy the full pre-built platform on the reference architecture; configure brand, zones, workflows.', 'Fastest route to modern. Main risk is change management — mitigated with proven blueprints and adoption support.')}
      ${card('02 · Brownfield', '<b style="color:var(--ink)">Fits</b> ageing or unsupported systems, high licence cost, a consolidation mandate.<br><br><b style="color:var(--ink)">How</b> assess and map the estate, deploy in parallel behind an integration bridge, migrate and validate, cut over module by module.', 'Phased, never big-bang. Risk is migration and cutover — mitigated by parallel run and rollback at every reversible step.')}
      ${card('03 · Intelligent layer', '<b style="color:var(--ink)">Fits</b> systems that work and must stay, heavy prior investment, a low-disruption or regulatory constraint on the core.<br><br><b style="color:var(--ink)">How</b> connect via API and ESB adapters, normalise into the canonical model, add AI, analytics and orchestration on top.', 'Fastest ROI and lowest disruption of the three. Risk is source-system API access — mitigated by the adapter library and a validation layer.')}
    </div>

    <h2>Where it runs</h2>
    <div class="grid g3">
      ${card('Anywhere', 'Cloud, on-premise, hybrid, or fully air-gapped. No cloud or network dependency at runtime.')}
      ${card('Degrades honestly', 'When a feed or the backend drops, the board keeps rendering the last known state behind a clear <span style="color:var(--melon);font-family:var(--mono);font-size:11px">FEED STALE</span> banner — and says how old it is.')}
      ${card('Ingest-only by default', 'It reads. It does not write back into an operational system unless you have explicitly opened that door.')}
    </div>

    <h2>The track record behind it</h2>
    <div class="metrics">
      ${metric('15', 'Services in production')}
      ${metric('5', 'Airports live')}
      ${metric('12', 'AI systems')}
      ${metric('70+', 'Dashboards')}
      ${metric('16+', 'Automation bots', true)}
      ${metric('8', 'Departments unified', true)}
    </div>
    <div class="note">Security paperwork down ~80% and fully offline-capable in restricted zones;
      complaint response ~25% faster with a ~35% CX uplift across five airports; zero paper contracts
      and four content platforms collapsed into one. The home-to-gate passenger ecosystem took the
      IDC Future Enterprise Award 2023.</div>`
},

/* 12 ─────────────────────────────────────────────────────────────────────── */
{
  id: 'talk',
  title: "Let's talk",
  eyebrow: '10 · next',
  lines: [
    "That's the tour.",
    "If you take one thing from it: airports do not have a systems problem. They have a coordination problem sitting on top of systems that already work — and a data problem underneath it that nobody has solved once, properly, in one place.",
    "This solves the second one first, and then the first one falls out of it.",
    "The shortest honest next step is small. Point it at two or three of your real feeds and let it build the canonical model for them. You'll know inside a fortnight whether what I've told you is true.",
    "Ask me anything you like. I'm still here."
  ],
  html: () => `
    <p class="eyebrow">10 · next</p>
    <h1>Point it at three feeds.<br>Judge it in a fortnight.</h1>
    <p class="lede">The fastest way to test everything I've said is not a workshop. It's a small,
      contained piece of your real estate, mapped into the canonical model, with a board, a workflow
      and an agent built on top of it by your own people.</p>
    <div class="grid g3">
      ${card('1 · Baseline', 'A short assessment against your own systems, incident volume and cost data. Every indicative range in this walkthrough gets replaced by your number.')}
      ${card('2 · Three feeds, mapped', 'Two or three real sources into the canonical model. Then your team builds a board, a workflow and an agent on it — without us.')}
      ${card('3 · Scale on evidence', 'What gets built next is decided by what the first one proved, not by what was on the original slide.')}
    </div>

    <h2>Questions I get asked most</h2>
    <div class="chooser" style="max-width:100%">
      <button data-q="Will this replace my AODB or my existing systems?"><span>Will this replace my existing systems?</span><span class="arrow">→</span></button>
      <button data-q="What is actually built today versus what still has to be built?"><span>What's actually built today?</span><span class="arrow">→</span></button>
      <button data-q="Can it run air-gapped with no network at all?"><span>Can it run air-gapped?</span><span class="arrow">→</span></button>
      <button data-q="How do you stop an AI agent seeing data it should not see?"><span>How do you stop an agent over-reaching?</span><span class="arrow">→</span></button>
      <button data-q="Can we build our own dashboards and workflows without you?"><span>Can we build our own, without you?</span><span class="arrow">→</span></button>
      <button data-q="How long does it take to onboard an airport?"><span>How long does onboarding take?</span><span class="arrow">→</span></button>
    </div>`,
  enter(ctx) {
    ctx.root.querySelectorAll('[data-q]').forEach(b =>
      b.addEventListener('click', () => ctx.ask(b.dataset.q)));
  }
}
];

export const sceneIndex = id => SCENES.findIndex(s => s.id === id);
