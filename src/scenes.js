/* ============================================================================
   The walkthrough. Thirteen scenes.

   This is a PLATFORM story, not a use-case story. The shape of the argument is:
     all your data, in one governed place
       → the airport modelled on top of it
         → ask it anything
           → build anything on it — boards, apps, workflows, agents
             → watch one run, then watch AIRIS coordinate a real disruption
               → and every one of those is governed by construction.

   The narration is deliberately short: at most four lines a scene, each one
   sentence or two, in a warm voice. AIRIS is a friendly guide, not a lecturer.
   The stage carries the detail; the voice carries the point.

   Every figure is traceable to the product's own metadata, to the AIRIS /
   Thinking Airport briefing, or to a document on the share — see
   docs/CONTENT-SOURCES.md.

   Shape of a scene:
     id        stable key; the knowledge base deep-links answers to it
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

export const SCENES = [

/* 1 ──────────────────────────────────────────────────────────────────────── */
{
  id: 'open',
  title: 'AIRIS · Thinking Airport',
  eyebrow: 'Airport vertical · MindGraph × DXC',
  lines: [
    "Hi, I'm AIRIS. This is Thinking Airport — the intelligence platform MindGraph and DXC put on top of an airport.",
    "In one line: all of your airport's data in one governed place, and then anything you like built on top of it.",
    "Here's the tour: the data, the model, asking it questions, building on it, watching it run, and how it lands. A few minutes — and you can stop me any time."
  ],
  html: () => `
    <p class="eyebrow">Airport vertical · MindGraph × DXC · Confidential</p>
    <h1>All of the airport's data.<br>Then build anything on it.</h1>
    <p class="lede">Airports already own the plumbing — AODB, FIDS, ERP, baggage, A-CDM, CCTV,
      building management, the sensor estate. Thinking Airport replaces none of it. It reads every
      source into <strong>one governed model</strong>, and turns that model into the surface every
      board, app, workflow and agent is built on.</p>
    <div class="gate" style="margin-top:6px">Nothing you own is replaced. There is no ceiling on what you can build.</div>

    <h2>The tour</h2>
    <div class="tour">
      <button class="stop" data-goto="data"><span class="si">🗄️</span><span class="sn">data</span><span class="st">Every source, one model</span></button>
      <button class="stop" data-goto="model"><span class="si">🏗️</span><span class="sn">model</span><span class="st">The airport, modelled</span></button>
      <button class="stop" data-goto="ask"><span class="si">💬</span><span class="sn">ask</span><span class="st">Ask it anything</span></button>
      <button class="stop" data-goto="build"><span class="si">🧩</span><span class="sn">build</span><span class="st">Boards, apps, workflows, agents</span></button>
      <button class="stop" data-goto="live"><span class="si">⚡</span><span class="sn">live</span><span class="st">Watch it run, live</span></button>
      <button class="stop human" data-goto="deploy"><span class="si">🛫</span><span class="sn">landing</span><span class="st">How it lands in your airport</span></button>
    </div>
    <div class="gate">One governed pipeline. Every question, every board, every workflow and every
      agent resolves through it — so access, masking and audit are the same everywhere.</div>`,
  enter(ctx) {
    ctx.root.querySelectorAll('[data-goto]').forEach(b =>
      b.addEventListener('click', () => ctx.goto(b.dataset.goto, { play: true })));
  }
},

/* 2 ──────────────────────────────────────────────────────────────────────── */
{
  id: 'start',
  title: 'Where should I start?',
  eyebrow: '▸ where should I start?',
  lines: [
    "Before I dive in — where would you like to start? Pick anything, or take the full tour.",
    "You can scrub with the strip on the right, and interrupt me with a question whenever you like."
  ],
  html: () => `
    <p class="eyebrow">▸ where should I start?</p>
    <h1>Pick a door.<br>Or take the whole tour.</h1>
    <p class="lede">Every scene stands on its own, and I'll happily jump between them. Choose what
      you're most curious about and I'll take you straight there.</p>
    <div class="chooser">
      <button data-goto="data"><span>🗄&nbsp;&nbsp;The data — every source, one model</span><span class="arrow">→</span></button>
      <button data-goto="model"><span>🏗&nbsp;&nbsp;The airport, modelled</span><span class="arrow">→</span></button>
      <button data-goto="ask"><span>💬&nbsp;&nbsp;Ask it anything</span><span class="arrow">→</span></button>
      <button data-goto="build"><span>🧩&nbsp;&nbsp;Build anything on it</span><span class="arrow">→</span></button>
      <button data-goto="airis"><span>⚡&nbsp;&nbsp;One disruption, end to end — the AIRIS demo</span><span class="arrow">→</span></button>
      <button data-goto="agents"><span>🤖&nbsp;&nbsp;Agents, governed</span><span class="arrow">→</span></button>
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
  eyebrow: 'the proposition',
  lines: [
    "The proposition in one sentence: we don't replace a single system you own.",
    "Thinking Airport sits on top. It reads every source, unifies the data into one model, and puts AI, prediction and automation over it.",
    "It reads by default, and only writes back where you've opened that door — which is what makes it safe for a live ops room.",
    "And every lever lands on a number a CFO recognises: cost out, capex deferred, revenue up, risk removed."
  ],
  html: () => `
    <p class="eyebrow">the proposition</p>
    <h1>Sits on top of everything.<br>Replaces none of it.</h1>
    <p class="lede">Source systems untouched. Read — and written only where you allow it — through
      APIs and the service bus. <strong>No replacement, no downtime</strong>, value added incrementally.
      Of the ways into an airport this is the fastest ROI and the lowest disruption.</p>

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

    <h2>The levers everything is measured against</h2>
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
  eyebrow: 'the data fabric',
  lines: [
    "Everything else rests on this, so one moment here.",
    "Every source feed lands in one canonical model — the airport's entities and its KPIs, each defined exactly once.",
    "That 'once' is the whole trick. On-time performance means the same thing in a dashboard, a workflow and a regulator's report.",
    "Around it sit the catalog, lineage, a business glossary — and a governed SQL explorer for the people who like to write their own."
  ],
  html: () => `
    <p class="eyebrow">the data fabric · one governed model</p>
    <h1>Every source, one model,<br>one definition of the truth.</h1>

    <div class="pipeline">
      <div class="stage-step"><div class="sn">Sources</div><div class="sv">Every feed</div><div class="sd">AODB, A-CDM, BHS, DCS, sensors, car park, retail POS, ASQ, airline master data — mapped into the same place</div></div>
      <div class="arrow-r">→</div>
      <div class="stage-step"><div class="sn">Canonical model</div><div class="sv">One model</div><div class="sd">the airport described once, independent of the system it came from</div></div>
      <div class="arrow-r">→</div>
      <div class="stage-step"><div class="sn">Governed KPIs</div><div class="sv">Defined once</div><div class="sd">measures reused by every board, workflow, agent and answer</div></div>
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
  eyebrow: 'the operating model',
  lines: [
    "On top of the data sits the airport itself, modelled the way you actually run it.",
    "The control centres — operations, the tower, emergency, network and security — plus business domains like energy, ESG and facilities, and the apps already built on it.",
    "Now the sentence to remember: adding a domain is metadata, not code. Name it, point it at an entity, and it arrives with a working dashboard.",
    "So I won't give you a fixed list of use cases. The list is however many your airport has."
  ],
  html: () => `
    <p class="eyebrow">the operating model</p>
    <h1>The airport, modelled<br>the way you run it.</h1>

    <h2>The control centres</h2>
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
      ${card('Flow360', 'Live passenger flow on the sensor estate — curb to gate — queues, check-in, fill level, objects and PRM, forecasts, a live 2D floor and a 3D twin layer. Anonymous counts and coordinates, never images.')}
      ${card('Revenue Management', 'Aeronautical and non-aeronautical revenue: airline billing (tariff → gross charges → incentive credit → net invoice → collection), the airline marketing incentive programme, and route development from market opportunity through business case to launch and ROI.')}
      ${card('AIR Disaster Management', 'Coordinated response for major disruption and crisis events, wired to the emergency operations centre.')}
      ${card('Connected Health', 'Rapid emergency response linked to connected medical devices — incidents, AED deployments, patients treated, hospital transfers.')}
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
  eyebrow: 'the assistant',
  lines: [
    "First thing the model buys you: the end of the report queue.",
    "Anyone asks a question in plain language and gets the answer, with a chart, in seconds — across every source at once.",
    "It only sees what your role can see, it cites its sources, and it's logged.",
    "And when it doesn't know, it says so. In a room full of operators, that's the most important habit it has."
  ],
  html: () => `
    <p class="eyebrow">the assistant · governed natural language</p>
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
  eyebrow: 'the build surfaces',
  lines: [
    "Now the part that makes it a platform, not a product.",
    "Dashboards, applications, workflows and agents all get built on the model — by the people who need them.",
    "My favourite trigger is the one everyone forgets — fire when an expected event doesn't arrive. A silent feed is a fault.",
    "The next dashboard costs what the first one did. That's what unbounded actually means."
  ],
  html: () => `
    <p class="eyebrow">the build surfaces</p>
    <h1>Boards, apps, workflows, agents.<br>Built by the people who need them.</h1>

    <div class="grid g2">
      ${card('Dashboards — endless', 'A canvas of tiles over any governed measure, in any combination, saved and shared. Publish a board to an audience — a partner, an executive, a regulator — with its own access scope. There is no fixed set, and the next one costs what the first did.', 'Every tile resolves through the governed pipeline. A board cannot show a number its viewer is not allowed to see.')}
      ${card('Applications — described, then generated', 'Describe the application you want on your data and it is generated against the canonical model, from a component library: hero, navbar, KPI, chart, data table, timeline, filter bar, search, status badge, flight board, map, gallery, form. Then edited by hand where you want it precise.', 'Generated apps inherit the same scopes and audit as everything else — they are not a side door to the data.')}
      ${card('Workflows — the automation canvas', 'Triggers: manual run, schedule or cron, a governed measure crossing a threshold, an inbound webhook, a live push event, another workflow failing, or an expected event that never arrived. Actions: query the lakehouse, ask a registered agent, branch, open an alert, email, POST to any REST API, or notify Slack, Teams, Discord, Telegram or WhatsApp.', 'Playbooks come with it — some seeded and switched off so a fresh install has something real to turn on, more in the library. Examples, not the ceiling.')}
      ${card('Agents — registered, not improvised', 'Purpose-built agents over the same data scope, each with a risk tier, a declared tool set, evaluations and guardrails. A catalog, a run history, and a topology view of which agent calls what.', 'Shipped today: Airport Hub Analyst, Ops Analyst, Baggage Analyst, Retail Analyst, Data Steward, Compliance Explainer.')}
    </div>

    <h2>The trigger people forget</h2>
    <div class="ba">
      <div class="before"><b>Everyone builds this</b>Alert when a number goes past a threshold. Useful, and it is the first thing every monitoring tool does.</div>
      <div class="after"><b>This one catches the outage</b>Fire when an <b>expected event does not arrive</b> — a heartbeat on a silent feed. A dashboard reading zero and a dashboard reading nothing look identical until something asks the question.</div>
    </div>
    <div class="note">Forecast models are registered alongside — delay prediction, passenger-flow
      forecasting and baggage anomaly detection — in the same catalog, under the same provenance
      rules. They are locked for now and marked "coming soon"; I'd rather tell you that than pretend.</div>`
},

/* 8 ──────────────────────────────────────────────────────────────────────── */
{
  id: 'live',
  title: 'Watch it work — live',
  flag: 'live',
  eyebrow: 'one workflow, end to end',
  lines: [
    "Let me stop describing it and run one.",
    "A shipped playbook: a security queue has been over its wait-time target for too long. Every step you'll see is a node you can swap.",
    "The event fires. It queries the model, asks an agent to explain, opens a single alert — not a flood — and tells the right people.",
    "Then it stops, because the last step is a human. The machine watches, explains and drafts. A person makes the call."
  ],
  html: () => `
    <p class="eyebrow">one workflow, end to end</p>
    <h1>Trigger, query, agent, alert,<br>notify — then a human.</h1>
    <p class="lede">A shipped playbook: <strong>a security queue has been over the airport's wait-time
      target for too long.</strong> Every stage below is a node — swap any one and it is a
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
            <li data-s="0"><span class="sk">trigger</span><span class="sb">Live event — security queue over its wait-time target</span></li>
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
          <p style="margin-bottom:10px">The same shape runs a baggage SLA watch, a cargo
            dwell breach, a non-aero revenue dip, an IT availability alert or an emergency activation.
            Only the nodes differ.</p>
          <div class="estate">
            <span>manual</span><span>schedule / cron</span><span>threshold</span><span>webhook</span>
            <span>live event</span><span>on another flow's failure</span><span>missing event</span>
          </div>
          <div class="roi" style="margin-top:12px"><b>Playbooks</b>
            Seeded, switched off: Flight OTP &amp; delay · Baggage mishandling &amp; first-bag SLA ·
            Security screening &amp; breach. In the library: Airline OTP &amp; cancellations · Cargo dwell
            &amp; throughput · Customer complaint &amp; ASQ · Emergency response · IT availability &amp; SLA ·
            Retail non-aero revenue dip · Security wait above target · Lounge at capacity · Daily
            passenger-flow report
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
    ctx.onLine(2, run);            // fires as the narration reaches "the event fires"
    ctx.onLeave(clear);
  }
},

/* 9 ──────────────────────────────────────────────────────────────────────── */
{
  id: 'airis',
  title: 'One disruption, end to end',
  flag: 'live',
  eyebrow: 'the AIRIS demo',
  lines: [
    "Now a little about me at full scale — the AIRIS demo DXC built. One routine disruption, end to end.",
    "A gate change moves a full flight of passengers between terminals. Done by hand, that's long minutes of calls and emails across every team.",
    "AIRIS orchestrates every connected system — AODB, A-CDM, the event bus, FIDS, wayfinding, baggage — and coordinates the whole response in seconds, not minutes.",
    "Ops gets ranked options, not a wall of alerts. The passenger gets a map straight away. Security gets a head start. One event, understood once."
  ],
  html: () => `
    <p class="eyebrow">the AIRIS demo · AI Real-Time Integrated Solution</p>
    <h1>One event. Every system.<br>Seconds, not minutes.</h1>
    <p class="lede">A gate change moves <strong>a full flight of passengers</strong> to another terminal
      after a short delay. Handled by hand, it ripples across every stakeholder group in calls, emails
      and manual updates. AIRIS coordinates the same event <strong>in seconds</strong>, with every
      stakeholder seeing the update built for their role.</p>

    <div class="airis">
      <div class="card">
        <div class="airis-bar"><span class="track"><span class="fill" id="airisFill"></span></span></div>
        <div class="airis-status" id="airisStatus">● gate change detected · waiting</div>
        <div class="syslist" id="airisSys">
          <div class="sys">AODB</div><div class="sys">A-CDM</div><div class="sys">Event bus</div>
          <div class="sys">FIDS</div><div class="sys">Digital wayfinding</div><div class="sys">Baggage — BHS</div>
          <div class="sys more">…and every other system on the estate</div>
        </div>
        <button class="btn primary" id="airisBtn" style="margin-top:14px;width:100%">▸ Run the disruption</button>
      </div>

      <div class="personas" id="airisPersonas">
        <div class="persona"><div class="who">APOC · operations</div><div class="what">Three response options with impact analysis — not a wall of alerts.</div><div class="lands">Resolved in seconds, not phone calls.</div></div>
        <div class="persona"><div class="who">Passenger</div><div class="what">An instant notification with a map to the new gate.</div><div class="lands">Confusion prevented before it starts.</div></div>
        <div class="persona"><div class="who">Security</div><div class="what">A predictive surge alert well before it happens.</div><div class="lands">A lane opens proactively — no queue ever builds.</div></div>
        <div class="persona"><div class="who">Airline</div><div class="what">Full context for crew positioning and network impact.</div><div class="lands">A collaborative decision, not a unilateral one.</div></div>
        <div class="persona"><div class="who">CFO · finance</div><div class="what">Cost avoidance quantified per incident.</div><div class="lands">A measurable business case, not an operational narrative.</div></div>
      </div>
    </div>

    <div class="note">Drawn from DXC's AIRIS demonstration. Any cost figure around it is illustrative,
      modelled on industry benchmarks, and is replaced by an airport's own incident data.</div>`,
  enter(ctx) {
    const fill = ctx.root.querySelector('#airisFill');
    const status = ctx.root.querySelector('#airisStatus');
    const btn = ctx.root.querySelector('#airisBtn');
    const systems = [...ctx.root.querySelectorAll('#airisSys .sys')];
    const personas = [...ctx.root.querySelectorAll('#airisPersonas .persona')];
    let timers = [];
    let raf = 0;

    const clear = () => { timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf); };
    const reset = () => {
      clear();
      fill.style.width = '0%'; const cardEl = fill.closest('.card'); cardEl.classList.remove('done'); cardEl.dataset.done = '';
      status.textContent = '● gate change detected · waiting';
      systems.forEach(s => s.classList.remove('lit'));
      personas.forEach(p => p.classList.remove('lit'));
      btn.disabled = false; btn.textContent = '▸ Run the disruption';
    };

    const DUR = 6200;   // the whole coordination, compressed into a few real seconds
    const run = () => {
      reset();
      btn.disabled = true; btn.textContent = 'Coordinating…';
      status.textContent = '● AIRIS coordinating · every system';
      const t0 = performance.now();
      const tick = now => {
        const p = Math.min(1, (now - t0) / DUR);
        fill.style.width = `${Math.round(p * 100)}%`;
        if (p < 1) raf = requestAnimationFrame(tick);
        else {
          const cardEl = fill.closest('.card'); cardEl.classList.add('done'); cardEl.dataset.done = '1';
          status.textContent = '● coordinated · every stakeholder updated';
          btn.disabled = false; btn.textContent = '↻ Run it again';
        }
      };
      raf = requestAnimationFrame(tick);
      systems.forEach((s, i) => timers.push(setTimeout(() => s.classList.add('lit'), 300 + i * 420)));
      personas.forEach((p, i) => timers.push(setTimeout(() => p.classList.add('lit'), 900 + i * 1000)));
    };

    btn.addEventListener('click', run);
    ctx.onLine(2, run);            // fires as the narration reaches "AIRIS orchestrates every connected system"
    ctx.onLeave(clear);
  }
},

/* 10 ─────────────────────────────────────────────────────────────────────── */
{
  id: 'agents',
  title: 'Agents, governed',
  eyebrow: 'the agents',
  lines: [
    "A word on the agents, because this is where most AI platforms quietly stop being auditable.",
    "An agent here is a registered object, not a prompt someone pasted: a purpose, a risk tier, declared tools, its own data scope, evals and guardrails.",
    "Shipped today: an airport analyst, ops, baggage and retail analysts, a data steward and a compliance explainer. You register your own the same way.",
    "And anything irreversible waits in one approvals inbox for a person. That's the shape of the thing, not a setting."
  ],
  html: () => `
    <p class="eyebrow">the agents · registered, scoped, evaluated</p>
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

/* 11 ─────────────────────────────────────────────────────────────────────── */
{
  id: 'governance',
  title: 'Governance, risk & compliance',
  eyebrow: 'GRC',
  lines: [
    "Most platforms sell governance as a module you buy later. Here it's part of the navigation itself — and it governs the platform, too.",
    "The obligation register carries what you're actually held to: the ICAO annexes, your emergency plan, ESG, personal data — and now AI governance.",
    "The risk register scores both sides: runway incursion and baggage SLA, right next to data-access scope and unapproved AI extraction.",
    "Why it matters: the question that kills AI pilots is never 'is it clever'. It's 'show me who saw what, and why the model said that'. This answers both."
  ],
  html: () => `
    <p class="eyebrow">governance, risks &amp; compliance</p>
    <h1>Governs the airport —<br>and governs itself.</h1>

    <h2>Obligations tracked</h2>
    <div class="grid g2">
      ${card('Aviation', 'ICAO Annex 19 safety management · Annex 17 security · Annex 14 aerodrome · the Airport Emergency Plan · IGOM ground operations · slot punctuality.')}
      ${card('Data &amp; privacy', 'Personal-data protection · GDPR transfers · breach notification · ISO 27001 access control and logging · audit evidence · retention schedules.')}
      ${card('Sustainability', 'ISO 14001 environmental management and Airport Carbon Accreditation; ESG reporting against ACI and GRI.')}
      ${card('AI', 'EU AI Act-style transparency and human oversight, plus provenance of AI output — tracked as obligations in the same register as everything else, not in a separate slide.')}
    </div>

    <h2>Risks scored — both sides of the house</h2>
    <div class="grid g2">
      <div class="card">
        <div class="card-head"><h3>The airport</h3><span class="chip partial">operational</span></div>
        <p>Runway incursion · emergency readiness · AVSEC breach · OT cyber · OTP degradation ·
          baggage SLA · disruption · resource shortfall · aeronautical revenue concentration ·
          non-aero shortfall · ESG targets. Each with an owner, and a live signal where the platform can see one.</p>
      </div>
      <div class="card">
        <div class="card-head"><h3>The platform itself</h3><span class="chip live">self-governing</span></div>
        <p>Data access scope · personal-data exposure · unapproved AI extraction · engine dependency ·
          audit gap. The platform carries its own risks in the same register, scored on the same
          scale — because a tool that cannot be audited is a risk to the airport that bought it.</p>
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

/* 12 ─────────────────────────────────────────────────────────────────────── */
{
  id: 'deploy',
  title: 'How it lands',
  eyebrow: 'delivery',
  lines: [
    "So how does it actually land in your airport?",
    "Most of what you'd deploy already exists and is proven. The rest is your brand, your maps, your rules, your workflows. You're funding a tailoring, not a build.",
    "Ways in: greenfield, brownfield in phases, or the intelligent layer — where nothing you own moves. That last one is the fastest return.",
    "And it runs anywhere: cloud, on-prem, hybrid, or fully air-gapped. If a feed drops, the board keeps the last known picture and tells you how old it is."
  ],
  html: () => `
    <p class="eyebrow">delivery &amp; engagement</p>
    <h1>Built once.<br>Tailored per airport.</h1>

    <h2>Effort to go live</h2>
    <div class="bars" style="margin-top:4px">
      <div class="bar"><span>Pre-built &amp; proven</span><span class="track"><span class="fill" style="width:85%"></span></span><span class="v">most</span></div>
      <div class="bar"><span>Tailored to you</span><span class="track"><span class="fill" style="width:15%;background:linear-gradient(90deg,var(--gold),var(--peach))"></span></span><span class="v">the rest</span></div>
    </div>
    <p class="lede" style="margin-top:14px">The tailored part is brand and UX, terminal and zone maps,
      local regulations, language and currency, ops workflows and SLAs, and data migration. Everything
      else is reused as-is.</p>

    <h2>Ways in</h2>
    <div class="grid g3">
      ${card('Greenfield', '<b style="color:var(--ink)">Fits</b> a new airport or terminal, no entrenched systems, moving off paper.<br><br><b style="color:var(--ink)">How</b> deploy the full pre-built platform on the reference architecture; configure brand, zones, workflows.', 'Fastest route to modern. Main risk is change management — mitigated with proven blueprints and adoption support.')}
      ${card('Brownfield', '<b style="color:var(--ink)">Fits</b> ageing or unsupported systems, high licence cost, a consolidation mandate.<br><br><b style="color:var(--ink)">How</b> assess and map the estate, deploy in parallel behind an integration bridge, migrate and validate, cut over module by module.', 'Phased, never big-bang. Risk is migration and cutover — mitigated by parallel run and rollback at every reversible step.')}
      ${card('Intelligent layer', '<b style="color:var(--ink)">Fits</b> systems that work and must stay, heavy prior investment, a low-disruption or regulatory constraint on the core.<br><br><b style="color:var(--ink)">How</b> connect via API and ESB adapters, normalise into the canonical model, add AI, analytics and orchestration on top.', 'Fastest ROI and lowest disruption of the three. Risk is source-system API access — mitigated by the adapter library and a validation layer.')}
    </div>

    <h2>Where it runs</h2>
    <div class="grid g3">
      ${card('Anywhere', 'Cloud, on-premise, hybrid, or fully air-gapped. No cloud or network dependency at runtime.')}
      ${card('Degrades honestly', 'When a feed or the backend drops, the board keeps rendering the last known state behind a clear <span style="color:var(--melon);font-family:var(--mono);font-size:11px">FEED STALE</span> banner — and says how old it is.')}
      ${card('Ingest-only by default', 'It reads. It does not write back into an operational system unless you have explicitly opened that door.')}
    </div>

    <h2>The track record behind it</h2>
    <div class="grid g3">
      ${card('In production', 'Services live across several airports, AI systems, dashboards and automation bots — running today, not on a roadmap.')}
      ${card('Measured outcomes', 'Security paperwork sharply reduced and fully offline-capable in restricted zones; faster complaint response with a measurable CX uplift; paper contracts gone.')}
      ${card('Recognised', 'The home-to-gate passenger ecosystem took the IDC Future Enterprise Award.')}
    </div>`
},

/* 13 ─────────────────────────────────────────────────────────────────────── */
{
  id: 'talk',
  title: "Let's talk",
  eyebrow: 'next',
  lines: [
    "That's the tour — thank you for staying with me.",
    "If you take one thing: airports don't have a systems problem. They have a coordination problem, and a data problem underneath it. Solve the second and the first falls out.",
    "The shortest honest next step is small: a few real feeds, a short trial, and your own people building on it. Ask me anything — I'm still here."
  ],
  html: () => `
    <p class="eyebrow">next</p>
    <h1>Point it at a few feeds.<br>Judge it on evidence.</h1>
    <p class="lede">The fastest way to test everything I've said is not a workshop. It's a small,
      contained piece of your real estate, mapped into the canonical model, with a board, a workflow
      and an agent built on top of it by your own people.</p>
    <div class="grid g3">
      ${card('Baseline', 'A short assessment against your own systems, incident volume and cost data. Every indicative range in this walkthrough gets replaced by your number.')}
      ${card('A few feeds, mapped', 'A few real sources into the canonical model. Then your team builds a board, a workflow and an agent on it — without us.')}
      ${card('Scale on evidence', 'What gets built next is decided by what the first one proved, not by what was on the original slide.')}
    </div>

    <h2>Questions I get asked most</h2>
    <div class="chooser" style="max-width:100%">
      <button data-q="Will this replace my AODB or my existing systems?"><span>Will this replace my existing systems?</span><span class="arrow">→</span></button>
      <button data-q="What is AIRIS and what did the demo show?"><span>What is AIRIS?</span><span class="arrow">→</span></button>
      <button data-q="Can it run air-gapped with no network at all?"><span>Can it run air-gapped?</span><span class="arrow">→</span></button>
      <button data-q="How do you stop an AI agent seeing data it should not see?"><span>How do you stop an agent over-reaching?</span><span class="arrow">→</span></button>
      <button data-q="Can we build our own dashboards and workflows without you?"><span>Can we build our own, without you?</span><span class="arrow">→</span></button>
      <button data-q="Where is DXC at PTE Asia and when are the talks?"><span>Where do I find DXC at PTE Asia?</span><span class="arrow">→</span></button>
    </div>`,
  enter(ctx) {
    ctx.root.querySelectorAll('[data-q]').forEach(b =>
      b.addEventListener('click', () => ctx.ask(b.dataset.q)));
  }
}
];

export const sceneIndex = id => SCENES.findIndex(s => s.id === id);
