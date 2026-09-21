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
     icon      the scene's IDENTIFIER in the navigator, and on every jump chip
               the answer sheet offers. Not decoration: the navigator is twelve
               rows in a 310px column where titles truncate, so at 18px the
               glyph is frequently the only part of a row that survives. One
               name from src/icons.js; see the table beside SCENES below.
     flag      optional filmstrip badge ("live")
     lines     narration, one caption at a time
     html()    the stage
     enter(ctx) optional — runs after the stage mounts

   `eyebrow` USED TO BE a thirteenth field. It duplicated, as data, the string
   each html() already hard-codes into its own <p class="eyebrow">, nothing ever
   read it, and by the time it went the two copies had drifted apart in three
   scenes. So had `data-full="1"` on the chooser's last button, which nothing
   has read since the chooser stopped special-casing it. Both are gone; the
   rendered eyebrow is the only copy, and it carries NO icon — an eyebrow is
   already a label, and labelling a label is the definition of decoration.
   ========================================================================== */

import { dxcIcon } from './icons.js';

/* small helpers so the stage markup stays readable */
const card = (title, body, foot, chip) => `
  <div class="card">
    ${chip ? `<div class="card-head"><h3>${title}</h3>${chip}</div>` : `<h3>${title}</h3>`}
    <p>${body}</p>
    ${foot ? `<div class="roi">${foot}</div>` : ''}
  </div>`;

/* The same card with a 24px classifier above its title.
   24px because three of the glyphs used this way — data-model, data-pipeline,
   table-masked — carry enough internal structure to smudge below it, and a grid
   whose icons are two different sizes reads as a mistake. It is all-or-nothing
   per GRID for the same reason: one card with an icon among five without looks
   like a card that failed to load. */
const icard = (icon, title, body, foot) => `
  <div class="card has-ico">
    <span class="ico">${dxcIcon(icon, 24)}</span>
    <h3>${title}</h3>
    <p>${body}</p>
    ${foot ? `<div class="roi">${foot}</div>` : ''}
  </div>`;

const metric = (icon, n, l, human) => `
  <div class="metric">
    <div class="mh"><span class="ico">${dxcIcon(icon, 20)}</span><div class="n${human ? ' human' : ''}">${n}</div></div>
    <div class="l">${l}</div>
  </div>`;

/* The gate — the one rule that makes the platform safe to point at a live
   airport — always opens with `approved`, the pack's human-approval glyph. It
   is the one icon in the deck that is repeated deliberately: five scenes make
   the same promise and the mark is what makes them read as the same promise. */
const gate = body => `
  <div class="gate"><span class="ico">${dxcIcon('approved', 20)}</span><p>${body}</p></div>`;

/* A chooser row: the destination scene's own glyph at 20px, the label, and the
   pack's arrow where a text "→" used to be. The arrow is the one glyph here
   that IS decoration — but it was already on the page as a character, and a
   character is at the mercy of the machine's fallback font in a way a path is
   not. Like for like, minus the font dependency. */
const choice = (to, icon, label, cls) => `
      <button${cls ? ` class="${cls}"` : ''} data-goto="${to}">
        <span class="ico">${dxcIcon(icon, 20)}</span>
        <span class="lb">${label}</span>
        <span class="ico arrow">${dxcIcon('arrow-right', 18)}</span>
      </button>`;

/* One stage of the data pipeline. The icon is 24px and sits on the label row:
   the three steps are what the whole deck rests on, and they are the one place
   a reader scans left-to-right for a SHAPE rather than for a word. */
const step = (icon, name, value, detail) => `
      <div class="stage-step">
        <div class="sn"><span class="ico">${dxcIcon(icon, 24)}</span>${name}</div>
        <div class="sv">${value}</div>
        <div class="sd">${detail}</div>
      </div>`;

/* The same row shape for scene 12's questions — no leading glyph, because six
   rows carrying the same "question" icon would say nothing six times. */
const question = (q, label) => `
      <button data-q="${q}">
        <span class="lb">${label}</span>
        <span class="ico arrow">${dxcIcon('arrow-right', 18)}</span>
      </button>`;

/* The product's name, in one place, because it is spoken aloud and it has been
   renamed once already. NOT the same thing as AIRIS (the engine named in the
   source briefing, and where Iris gets her own name) or as DXC's "Thinking
   Airport" vision — docs/CONTENT-SOURCES.md keeps all three distinct on
   purpose, and the knowledge base has an entry that explains the difference. */
export const PRODUCT = 'Intelligent Airport';

/* ── the navigator's twelve glyphs, and why each one ──────────────────────
     1  airline        an airport product, so the aircraft — NOT the pack's
                       TRAVEL & TRANSPORTATION glyph, which draws a train
     2  target         "where should I start?" is the objective, chosen
     3  idea           the proposition
     4  database       all of the airport's data
     5  graph-nodes    the airport modelled. `data-model` is the glyph this
                       title asks for and it is TIER 3: at the navigator's 18px
                       it is a grey smear, so the tier-1 graph reads instead
     6  chat-ai        the assistant
     7  cubes          build anything on it
     8  monitor        watch it work — a console
     9  sparkle        the pack's mark for generated output
    10  shield-check   governance holds
    11  plane-arrival  how it lands, literally
    12  users          let's talk — the people in the room                    */
export const SCENES = [

/* 1 ──────────────────────────────────────────────────────────────────────── */
{
  id: 'open',
  title: PRODUCT,
  icon: 'airline',
  /* THE OPENING ORDER IS THE POINT. This scene used to run claim → NEGATE →
     re-claim: line 1 spent the most valuable ten seconds of the deck on "let me
     be clear about what this is … it is not an application, it is not a fixed
     list of modules", and line 2 then asserted the positive anyway. A stranger
     heard what it is NOT before they had any idea what it IS, and heard the
     same idea twice.

     So the contrast MOVED rather than went: it is still here, once, at index 3,
     after the positive claim has landed and after the four build surfaces have
     shown what the claim buys. Nothing about the argument changed — scene 3 is
     still built on "replaces nothing" and needs this deck to have set it up.

     Index 4 is the Thinking Airport line, and it is ONE sentence on purpose.
     Thinking Airport is DXC's VISION; Intelligent Airport is the product that
     serves it; AIRIS is the named proof point. Three names that sound alike and
     must not merge — src/knowledge.js has two entries holding them apart, and
     docs/CONTENT-SOURCES.md says the same thing about the sources. A second
     sentence here starts explaining the vision instead of selling the product.

     Every sentence in this scene is under 20 words and the scene means 7.8 —
     the delivery pass's numbers, unchanged. Check with the count before editing:
     a 30-word sentence reads fine and speaks badly. */
  lines: [
    "I'm Iris, and I speak for Intelligent Airport. It's the platform MindGraph and DXC put on top of an airport you already run.",
    "Every system in your airport, read into one governed model of your data. And then anything you want built on top of it.",
    "A dashboard. An application. An automated workflow. An AI agent. Asked for in plain language, and built without an engineering ticket. Governed the same way whether it took you five minutes or five months.",
    "So it is a platform. Not an application. And not a fixed menu of modules.",
    "DXC's vision behind it is the Thinking Airport — an airport anticipating, personalising and adapting in real time.",
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
      ${metric('database', '58', 'Canonical entities')}
      ${metric('chart-bar', '201', 'Governed KPIs')}
      ${metric('monitor', '5', 'Control centres')}
      ${metric('server', '0', 'Systems replaced', true)}
      ${metric('cubes', '∞', 'Things you can build', true)}
    </div>
    ${gate(`One governed pipeline. Every question, every board, every workflow and every
      agent resolves through it — so access, masking and audit are the same everywhere.`)}`
},

/* 2 ──────────────────────────────────────────────────────────────────────── */
{
  id: 'start',
  title: 'Where should I start?',
  icon: 'target',
  lines: [
    "Before I dive in — where would you like me to start?",
    "Pick whatever you're most curious about and I'll take you straight there. Or choose the full walkthrough and I'll give you the whole tour.",
    "You can scrub back with the film strip on the right at any point. And you can stop me with a question whenever you like."
  ],
  /* THE EMOJI FIX. Every row here used to open with an emoji and two &nbsp; —
     a compass, a file box, a brick wall, a stopwatch, a shield, a departing
     plane, none of them named here as characters because the acceptance grep
     for this change counts emoji in this file and a comment is still a hit.

     It was a typographic and an operational problem at once. Typographic: an
     emoji is somebody else's illustration in somebody else's colour palette,
     sitting in a deck that is otherwise two DXC typefaces and ten DXC colours.
     Operational: the glyph comes from whatever emoji font the MACHINE happens
     to have, so it renders as a different picture on macOS, on Windows and on
     Android — and as a tofu box on a headless Linux booth image with no emoji
     font at all, which is exactly what shoot.js has been photographing.

     Each row's icon is now the DESTINATION SCENE's own glyph at 20px, so the
     chooser and the navigator agree about what a scene looks like. The last row
     is the transport's `play`, because "give me the full walkthrough" is not a
     seventh destination — it is pressing start. */
  html: () => `
    <p class="eyebrow">where should I start?</p>
    <h1>Where should I take you first?</h1>
    <p class="lede">Tap one — I'll jump right there.</p>
    <div class="chooser">
      ${choice('proposition', 'idea', 'What it actually is')}
      ${choice('data', 'database', 'The data foundation — what it knows')}
      ${choice('build', 'cubes', 'Building boards, apps, workflows and agents')}
      ${choice('live', 'monitor', 'Show me it working — live')}
      ${choice('governance', 'shield-check', 'Governance, risk and compliance')}
      ${choice('deploy', 'plane-arrival', 'How it would land in my airport')}
      ${choice('proposition', 'play', 'Give me the full walkthrough', 'full')}
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
  icon: 'idea',
  lines: [
    "Here is the proposition in one sentence. We do not replace a single system you own.",
    "What we add is a non-invasive overlay. It connects to every source system and unifies the data into one canonical model. Then it puts AI, prediction, automation and a single command picture on top.",
    "Everything it reads is ingest-only by default. It does not write back into an operational system unless you have explicitly opened that door. That is what makes it safe to point at an ops room rather than a lab.",
    "And the reason airports say yes is not the architecture. It's that every lever it pulls lands on a number a CFO recognises. Cost out. Capex deferred. Revenue up. Risk removed."
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
      ${icard('chart-bar', 'Cost out', 'Utilities, maintenance, labour — the fastest and most visible payback on the P&amp;L.')}
      ${icard('layers', 'Capex deferred', 'Sweat the stands, belts and terminal you already own instead of building more.')}
      ${icard('chart-line-up', 'Revenue up', 'Non-aeronautical spend per passenger, on the same footfall.')}
      ${icard('shield-check', 'Risk removed', 'Compliance, carbon and security exposure closed, with the audit trail behind it.')}
    </div>
    <div class="note">Any ROI range quoted in this walkthrough is an indicative industry figure. It is
      replaced by your own number in a short baseline assessment during onboarding — never quoted as a
      guarantee before that.</div>`
},

/* 4 ──────────────────────────────────────────────────────────────────────── */
{
  id: 'data',
  title: 'All the data',
  icon: 'database',
  lines: [
    "Everything else I'm going to show you rests on this scene, so let me spend a moment here.",
    "Source systems land in the lakehouse and are mapped into one canonical model of the airport.",
    "Fifty-eight entities — flight, bag, passenger, cargo, retail transaction, energy, roster, revenue, sensor, emergency event, I-T system, and so on. On top of them sit two hundred and one key performance indicators, defined once.",
    "Defined once is the important part. On-time performance means the same thing in the operations dashboard and in a workflow's threshold. The same thing in an agent's answer, and in the board that goes to your regulator. There is no second definition hiding in someone's spreadsheet.",
    "Around it sits the catalog — every table and document, with their lineage back to source. And a business glossary, so the word a director uses resolves to the field an engineer built.",
    "And there's a governed SQL explorer, for the people who'd rather write the query themselves. Same masking, same row policies, same audit trail. We do not make the analysts leave."
  ],
  html: () => `
    <p class="eyebrow">02 · the data fabric · one governed model</p>
    <h1>Every source, one model,<br>one definition of the truth.</h1>

    <div class="pipeline">
      ${step('data-exchange', 'Sources', '21', 'mapped feeds — AODB, A-CDM, BHS, DCS, sensors, car park, retail POS, ASQ, airline master data')}
      <div class="arrow-r">${dxcIcon('arrow-right', 20)}</div>
      ${step('graph-nodes', 'Canonical model', '58', 'entities — the airport described once, independent of the system it came from')}
      <div class="arrow-r">${dxcIcon('arrow-right', 20)}</div>
      ${step('chart-bar', 'Governed KPIs', '201', 'measures defined once and reused by every board, workflow, agent and answer')}
    </div>

    <h2>What sits around it</h2>
    <div class="grid g2">
      ${icard('layers', 'Catalog', 'Every table and document in the estate, browsable, with lineage back to the source system and forward to everything that consumes it.')}
      ${icard('data-model', 'Airport model', 'The canonical schema and its source mappings. Map a new system’s entity here and everything downstream lights up — no downstream change.')}
      ${icard('file', 'Business glossary', 'The word a director uses, bound to the field an engineer built. Proposed terms go through review before they become canon.')}
      ${icard('code-window', 'Governed explorer', 'SQL for people who want SQL — through the same pipeline, so masking, row policies and audit apply identically.')}
      ${icard('folder', 'Documents', 'SOPs, data-sharing policies, data dictionaries and compliance rules, searchable and citable by the assistant alongside the structured data.')}
      ${icard('data-exchange', 'Sources', 'Connect and manage feeds. Real-time streaming, scheduled ETL, REST pulls, webhooks and file drops all land in the same place.')}
    </div>
    ${gate(`One governed pipeline. A question, a dashboard tile, a workflow threshold and an
      agent’s answer all resolve the same way — so there is exactly one place to change a definition,
      and exactly one place to audit who saw what.`)}`
},

/* 5 ──────────────────────────────────────────────────────────────────────── */
{
  id: 'model',
  title: 'The airport, modelled',
  icon: 'graph-nodes',
  lines: [
    "On top of the data sits the airport itself — modelled the way you actually run it.",
    "Five control centres. The airport operations control centre — the A-O-C-C — for day-to-day flight, baggage, passenger and resource operations. The tower.",
    "The emergency operations centre, structured to your airport emergency plan. The network and I-T operations centre. And the security operations centre, physical and cyber together.",
    "Alongside them, the business domains — energy, ESG, facility management, safety training, aviation security, operational technology security. And the applications: passenger flow, revenue management, disaster operations, connected health, rostering.",
    "Now here is the sentence I want you to remember. It's the whole difference between a product and a platform.",
    "Adding a domain is metadata, not code. You name it, you point it at an entity, and it arrives with a working dashboard. No release. No engineering ticket. No waiting for our roadmap.",
    "That's why I won't give you a fixed list of use cases. The list is however many your airport has."
  ],
  html: () => `
    <p class="eyebrow">03 · the operating model</p>
    <h1>The airport, modelled<br>the way you run it.</h1>

    <!-- The estate, iconed: a console, a tower, an incident, a rack, a camera.
         Six three-letter acronyms in a grid are six near-identical rectangles
         to anyone who does not already know what AOCC and NOC stand for — the
         glyph is the only thing that distinguishes them at a glance, which is
         precisely the case where an icon communicates rather than decorates. -->
    <h2>Five control centres</h2>
    <div class="grid g3">
      ${icard('monitor', 'AOCC', 'Airport Operations Control Centre — day-to-day flight, baggage, passenger and resource operations.', 'Flight / FIDS · Cargo · Baggage · Retail · Airline · Passenger · Ticketing / DCS · Vehicle / Landside · Feedback')}
      ${icard('broadcast', 'ATC', 'Air Traffic Control Tower — runway and airspace movements: tower, ground and approach.', 'Runway movements · Tower watch · Airspace feed')}
      ${icard('warning', 'EOC', 'Emergency Operations Centre — crisis coordination per the Airport Emergency Plan (ICAO Annex 14 / FAA Part 139).', 'Emergency incidents · Response resources · Mass notification &amp; mustering')}
      ${icard('server', 'NOC', 'Network / IT Operations Centre — the technology backbone that runs the airport: uptime, network, applications, incidents.', 'System uptime · Network &amp; telecoms · IT incidents')}
      ${icard('cctv', 'SOC', 'Security Operations Centre — physical and cyber security monitoring and response, in one place.', 'CCTV &amp; access control · Checkpoint screening · Perimeter &amp; restricted areas · Cyber / SIEM')}
      ${icard('sparkle', '…and the next one', 'A control centre is a metadata file. Name it, give it subdomains, point them at entities — it appears with the standard governed dashboard.', 'Added by an administrator in the product, not by us in a release.')}
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

    ${gate(`Adding a domain or a control centre is <b>metadata, not code</b>. It gets the
      standard governed dashboard immediately, and lights up the moment its entity is mapped.`)}`
},

/* 6 ──────────────────────────────────────────────────────────────────────── */
{
  id: 'ask',
  title: 'Ask it anything',
  icon: 'chat-ai',
  lines: [
    "With the model in place, the first thing it buys you is the end of the report queue.",
    "Anyone in the building asks an operational question in plain language. They get an answer, with a chart, in seconds — across every connected source at once. No SQL. No ticket to the analytics team. No two-day wait for a report that was stale when it arrived.",
    "The word governed matters here. The assistant answers through the same pipeline as everything else. So it can only see what your role is allowed to see. Masking applies. Row policies apply. The answer is logged.",
    "It cites where the number came from, so a sceptical director can follow it back to the source table. And when it doesn't know, it says so, rather than inventing a figure. That is the single most important behaviour in a room full of operators.",
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
            <span class="lbl"><span class="ico">${dxcIcon('checklist', 13)}</span>resolved through</span>
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
      ${icard('user-shield', 'It only sees your scope', 'The assistant runs under the asker’s identity. Column masking and row policies are applied by the pipeline, not by the prompt.')}
      ${icard('checklist', 'It shows its working', 'Every answer names the entities and KPIs it resolved through, so the number can be followed back to source.')}
      ${icard('stamp', 'It is logged', 'Question, scope and result land in the audit trail — the same trail a regulator would be shown.')}
      ${icard('file', 'It reads documents too', 'SOPs, data dictionaries and policy documents are searchable alongside the structured data, so “what is our rule for this?” is answerable.')}
      ${icard('sliders', 'Engines are yours to choose', 'Which model serves which purpose is an administrator setting. Swap the engine without touching a single board or workflow.')}
      ${icard('warning', 'It can be wrong out loud', 'An ambiguous question comes back as a question. That is deliberate — a confident wrong number is worse than no number.')}
    </div>`
},

/* 7 ──────────────────────────────────────────────────────────────────────── */
{
  id: 'build',
  title: 'Build anything on it',
  icon: 'cubes',
  lines: [
    "Now the part that makes this a platform rather than a product.",
    "Four things get built on that data model. And all four are built by the people who need them, rather than by an engineering backlog.",
    "Dashboards. Not a fixed set. A canvas of tiles over any governed measure — saved, shared, and published to whoever should see it.",
    "Applications. Describe what you want on your data, and it is generated against the canonical model. Hero, KPI row, charts, tables, flight boards, maps, forms. Then refined by hand where you want it exact.",
    "Workflows. A canvas of triggers and actions — schedules, thresholds, webhooks, live events. And the one people forget: fire when an expected event doesn't arrive. A silent feed is a fault.",
    "And agents. Registered, scoped, evaluated, guardrailed. I'll come to them next.",
    "The point is that the twentieth dashboard costs what the second one did. That is what unbounded actually means."
  ],
  html: () => `
    <p class="eyebrow">05 · the build surfaces</p>
    <h1>Boards, apps, workflows, agents.<br>Built by the people who need them.</h1>

    <!-- The four build surfaces at 24px. data-pipeline and agent are TIER 3 —
         they smudge below 24 — which is why they are here and not, say, in the
         navigator. -->
    <div class="grid g2">
      ${icard('monitor', 'Dashboards — endless', 'A canvas of tiles over any governed measure, in any combination, saved and shared. Publish a board to an audience — a partner, an executive, a regulator — with its own access scope. There is no fixed set, and the twentieth costs what the second did.', 'Every tile resolves through the governed pipeline. A board cannot show a number its viewer is not allowed to see.')}
      ${icard('code-window', 'Applications — described, then generated', 'Describe the application you want on your data and it is generated against the canonical model, from a component library: hero, navbar, KPI, chart, data table, timeline, filter bar, search, status badge, flight board, map, gallery, form. Then edited by hand where you want it precise.', 'Generated apps inherit the same scopes and audit as everything else — they are not a side door to the data.')}
      ${icard('data-pipeline', 'Workflows — the automation canvas', 'Triggers: manual run, schedule or cron, a governed measure crossing a threshold, an inbound webhook, a live push event, another workflow failing, or an expected event that never arrived. Actions: query the lakehouse, ask a registered agent, branch, open an alert, email, POST to any REST API, or notify Slack, Teams, Discord, Telegram or WhatsApp.', 'Eleven playbooks ship with the product, disabled, so a fresh install has something real to turn on. They are examples — not the ceiling.')}
      ${icard('agent', 'Agents — registered, not improvised', 'Purpose-built agents over the same data scope, each with a risk tier, a declared tool set, evaluations and guardrails. A catalog, a run history, and a topology view of which agent calls what.', 'Shipped today: Airport Hub Analyst, Ops Analyst, Baggage Analyst, Retail Analyst, Data Steward, Compliance Explainer.')}
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
  icon: 'monitor',
  flag: 'live',
  lines: [
    /* LINE INDEX 2 IS LOAD-BEARING. enter() below fires the workflow animation
       on `ctx.onLine(2, run)` — the line that opens "The live event fires."
       Lines may be reworded in place and split from index 3 onwards, but
       inserting or removing anything ABOVE index 2 desynchronises the demo
       from the voice. */
    "Let me stop describing it and run one.",
    "This is a shipped playbook: a security queue has been over the airport's wait-time target for two minutes. Watch every stage, because every stage is a node you can swap.",
    "The live event fires. The workflow queries the canonical model — governed, so it sees exactly what its scope allows. It asks a registered agent to explain what it's looking at. It opens an alert in the operations register. Once only, so the same queue doesn't raise forty of them. It notifies the channels that matter.",
    "And then it stops. Because the last step is a human.",
    "That's the rule that makes an automated platform safe to point at a live airport.",
    "The machine does the watching, the querying, the explaining and the drafting. And a person makes the call.",
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
          <!-- The lamp is a CSS circle, not a ● character: the status is the one
               thing on this bar that CHANGES while the workflow runs, and it
               used to be a glyph plus an inline style.color set from three
               places in enter(). One data-state attribute now drives both. -->
          <span class="status" id="runStatus" data-state="off"><i class="lamp"></i><span class="rs">DISABLED</span></span>
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
        <button class="btn primary wide" id="runBtn">
          <span class="ico">${dxcIcon('play', 15)}</span><span class="lbl">Run the workflow</span>
        </button>
      </div>
    </div>

    ${gate(`The machine watches, queries, explains and drafts. <b>A person makes the call.</b>
      That is the rule that makes this safe to point at a live airport.`)}`,
  enter(ctx) {
    const steps = [...ctx.root.querySelectorAll('#runSteps li')];
    const status = ctx.root.querySelector('#runStatus');
    const statusText = status.querySelector('.rs');
    const btn = ctx.root.querySelector('#runBtn');
    /* The BUTTON's label, not the button: #runBtn now carries a play glyph as
       its first child, and setting textContent on the button itself would
       delete it on the first press. */
    const btnLabel = btn.querySelector('.lbl');
    let timers = [];

    const say = (state, text) => { status.dataset.state = state; statusText.textContent = text; };

    const clear = () => { timers.forEach(clearTimeout); timers = []; };
    const reset = () => {
      clear();
      steps.forEach(s => s.classList.remove('lit', 'waiting'));
      say('off', 'DISABLED');
      btnLabel.textContent = 'Run the workflow'; btn.disabled = false;
    };

    const run = () => {
      reset();
      btn.disabled = true; btnLabel.textContent = 'Running…';
      say('running', 'RUNNING');
      steps.forEach((s, i) => {
        timers.push(setTimeout(() => {
          s.classList.add('lit');
          if (i === steps.length - 1) {
            s.classList.add('waiting');
            say('human', 'WAITING FOR A HUMAN');
            btn.disabled = false; btnLabel.textContent = 'Run it again';
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
  icon: 'sparkle',
  lines: [
    "A word about the agents, because this is where most AI platforms quietly stop being auditable.",
    "An agent here is not a prompt somebody pasted into a chat window. It's a registered object — with a purpose, a risk tier and a declared set of tools. Its own governed data scope, an evaluation suite, and guardrails.",
    "There's a catalog of them, a full run history, and a topology view. It shows you which agent calls which tool, and which other agent. So nobody has to guess what is talking to what.",
    "Six ship with the product. An airport hub analyst, an operations analyst, a baggage analyst, a retail analyst, a data steward, and a compliance explainer. You register your own the same way.",
    "And everything irreversible lands in one approvals inbox. Human in the loop is not a setting we can forget to switch on. It is the shape of the thing."
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

    <!-- The six SHIPPED agents above carry no icon on purpose: they already
         carry a "shipped" chip, and six cards each wearing the same agent
         glyph would be six copies of a word the heading has already said.

         Note for anyone adding a comment here: this is inside a TEMPLATE
         LITERAL, so a backtick in the prose ends the template and the built
         file dies at first paint with "Unexpected identifier". Say the icon
         names in plain words, not in code quotes. -->
    <h2>What every agent carries</h2>
    <div class="grid g3">
      ${icard('flag', 'A risk tier', 'Declared, not inferred. What an agent is allowed to reach is a function of its tier, and changing a tier is a governed change.')}
      ${icard('lock', 'A data scope', 'It runs under its own scope through the same pipeline. An agent cannot see what its scope forbids, whoever asked it.')}
      ${icard('sliders', 'Declared tools', 'The tool set is written down. The topology view renders it, so “what can this thing actually do?” has a visual answer.')}
      ${icard('checklist', 'Evaluations', 'A suite that runs against it. An agent whose behaviour drifts is caught by its evals, not by a passenger.')}
      ${icard('shield-check', 'Guardrails', 'Explicit constraints on output and action, enforced outside the prompt.')}
      ${icard('eye-clock', 'A run history', 'Every run, its inputs, its scope and its result — replayable.')}
    </div>

    ${gate(`Anything irreversible lands in one <b>approvals inbox</b> and waits for a person.
      Human-in-the-loop is the shape of the platform, not a setting on it.`)}`
},

/* 10 ─────────────────────────────────────────────────────────────────────── */
{
  id: 'governance',
  title: 'Governance, risk & compliance',
  icon: 'shield-check',
  lines: [
    "Most platforms treat governance as a module you buy later. Here it is one of the five things in the navigation. And it governs the platform itself, as well as the airport.",
    "The obligation register carries what you're actually held to.",
    "On the aviation side, the annexes of the International Civil Aviation Organization. Annex nineteen for safety management, Annex seventeen for security, Annex fourteen for aerodromes.",
    "Your airport emergency plan. IGOM, the ground operations manual. Slot punctuality, and ESG reporting.",
    "Then personal data and cross-border transfer. Breach notification, access control, audit evidence. And, increasingly, AI governance and model provenance.",
    "The risk register scores both sides of the house. On the airport's side: runway incursion, emergency readiness, security breach, operational technology cyber.",
    "Then on-time degradation, baggage S-L-A, resource shortfall, revenue concentration and ESG targets. And right next to them: data access scope, personal-data exposure, and unapproved AI extraction.",
    "Underneath sit column-level access policies. A trust view covering data protection and AI governance. And an audit and telemetry trail across every surface.",
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
      ${icard('table-masked', 'Column-level access', 'An access matrix down to the column. Masking is applied by the pipeline, so it holds for a board, a query, a workflow and an agent equally.')}
      ${icard('badge-check', 'Trust view', 'Data protection and AI governance posture in one place — the view you would put in front of an auditor.')}
      ${icard('stamp', 'Activity &amp; telemetry', 'Audit across every surface: who asked, under what scope, what came back, and what was approved.')}
      ${icard('layers', 'Governance packs', 'Obligations and policies ship as packs, so a new airport starts with the aviation baseline rather than a blank register.')}
      ${icard('filter', 'Proposed vs active', 'Policies and glossary terms have a proposed state and an active state. A definition changes through review, not by edit.')}
      ${icard('user-group', 'Members &amp; access', 'Groups, grants and packs — with an editor / viewer split, so most of the building can read the platform safely.')}
    </div>`
},

/* 11 ─────────────────────────────────────────────────────────────────────── */
{
  id: 'deploy',
  title: 'How it lands',
  icon: 'plane-arrival',
  lines: [
    "So how does it actually land in your airport?",
    "About eighty-five percent of what you'd deploy already exists and is proven in production.",
    "The remaining fifteen is your brand, your terminal and zone maps, and your local regulations. Language and currency. Your workflows and service-level agreements. And your data migration.",
    "That ratio is the commercial argument. You are not funding a build. You are funding a tailoring.",
    "Three ways in. Greenfield, where there's no entrenched estate and we stand the whole platform up.",
    "Brownfield, where ageing systems get consolidated in phases, behind a parallel run with a rollback at every step. Or the intelligent layer, where your systems stay exactly as they are and we overlay on top. Fastest return on investment, lowest disruption.",
    "And it runs where you need it. Cloud, on-premise, hybrid, or fully air-gapped — for a restricted ops room with no network at all.",
    "When a feed drops, the board keeps rendering the last known state. It sits behind a clear stale banner, and it says how old the data is. Because a dark screen in an operations room is worse than an old one."
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
      ${icard('location-dot', 'Anywhere', 'Cloud, on-premise, hybrid, or fully air-gapped. No cloud or network dependency at runtime.')}
      ${icard('warning', 'Degrades honestly', 'When a feed or the backend drops, the board keeps rendering the last known state behind a clear '
        + `<span class="badge stale">${dxcIcon('warning', 12)}FEED STALE</span>`
        + ' banner — and says how old it is.')}
      ${icard('lock', 'Ingest-only by default', 'It reads. It does not write back into an operational system unless you have explicitly opened that door.')}
    </div>

    <h2>The track record behind it</h2>
    <div class="metrics">
      ${metric('server', '15', 'Services in production')}
      ${metric('location-dot', '5', 'Airports live')}
      ${metric('ai-chip', '12', 'AI systems')}
      ${metric('monitor', '70+', 'Dashboards')}
      ${metric('agent', '16+', 'Automation bots', true)}
      ${metric('user-group', '8', 'Departments unified', true)}
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
  icon: 'users',
  lines: [
    "That's the tour.",
    "If you take one thing from it: airports do not have a systems problem. They have a coordination problem, sitting on top of systems that already work. And underneath that, a data problem nobody has solved once, properly, in one place.",
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
    <div class="chooser wide">
      ${question('Will this replace my AODB or my existing systems?', 'Will this replace my existing systems?')}
      ${question('What is actually built today versus what still has to be built?', "What's actually built today?")}
      ${question('Can it run air-gapped with no network at all?', 'Can it run air-gapped?')}
      ${question('How do you stop an AI agent seeing data it should not see?', 'How do you stop an agent over-reaching?')}
      ${question('Can we build our own dashboards and workflows without you?', 'Can we build our own, without you?')}
      ${question('How long does it take to onboard an airport?', 'How long does onboarding take?')}
    </div>`,
  enter(ctx) {
    ctx.root.querySelectorAll('[data-q]').forEach(b =>
      b.addEventListener('click', () => ctx.ask(b.dataset.q)));
  }
}
];

export const sceneIndex = id => SCENES.findIndex(s => s.id === id);
