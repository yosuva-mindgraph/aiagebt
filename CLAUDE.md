# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

AIB Presenter: a single-page, dependency-free browser app. A canvas-drawn presenter ("AIRIS")
narrates thirteen short scenes about the "Airport in a Box" platform and answers spoken or typed
questions at any point, with a figures panel beside every answer. Vanilla ES modules + CSS, no framework, no package.json, no npm install,
no test suite. The git root is this `aiagebt/` directory; the parent folder only holds an
unrelated Python venv.

The README covers the product framing, keyboard shortcuts and design rationale. Do not
duplicate it here; read it once.

## Commands

```bash
open index.html                 # dev: loads src/*.js as ES modules straight from disk
                                # (Chrome refuses module imports over file://; use dist/index.html
                                #  or any static server, e.g. python3 -m http.server)
cp config.example.js config.js  # optional keys (ElevenLabs voice, LLM). config.js is gitignored.

node build.js                   # → dist/index.html, everything inlined (fonts, CSS, config.js)
node build.js --no-config       # same, minus config.js — the only build safe to hand out
node build.js --artifact        # also writes dist/artifact.html (scaffolding stripped for Claude Artifact hosting)

node shoot-cdp.js               # visual check, no dependencies: drives a local Chrome/Brave/Edge headless
                                # over the DevTools protocol through every scene at 1920×1080 and 1440×900,
                                # plus the answer sheet, a don't-know, the light theme and the AIRIS run;
                                # writes shots/, exits 1 on overflow, missing figures or page errors
node shoot-cdp.js --scene live  # one scene (substring match on the scene title)
node shoot.js                   # the same pass on Playwright (needs AIB_PLAYWRIGHT=/path/to/node_modules/playwright)
```

There is no linter and no unit test runner. The screenshot pass is the verification: run
`node build.js` first (it screenshots the built file, not `src/`), then `node shoot-cdp.js`, and treat
a non-zero exit as a failing build. Fix overflow rather than reasoning it away. Then look at the
PNGs in `shots/` — the pass catches faults, not ugliness.

Use `shoot-cdp.js` on this Mac: Playwright is not installed and the Chrome extension is not connected.
It finds Chrome, Chromium, Brave or Edge under `/Applications` (`AIB_BROWSER` overrides) and needs
only Node 22+ for the built-in WebSocket. Retrieval can be unit-checked without a browser:
`node -e "import('./src/knowledge.js').then(m => console.log(m.search('your question')))"`.

`dist/index.html` is committed on purpose (it is the double-click deliverable). After any change
under `src/`, `index.html` or `assets/`, rebuild and commit `dist/` too.

## Architecture

### The build is a regex flattener, not a bundler

`build.js` concatenates the modules listed in its `MODULES` array, in that fixed dependency
order, into one classic `<script>`. It strips `import ... from`, `export const/let/function/class`,
`export { ... }` and a single `export default`. Consequences for any edit:

- A new `src/` module must be added to `MODULES` in dependency order (leaves first).
- Every top-level declaration shares one scope in the built file. The build fails on a name
  collision across modules, which is why `app.js` has `wait`, `voice.js` has `sleep`, and
  `app.js` has `$`. Pick unique top-level names; anything indented is fine.
- Only those import/export forms are understood. No `export * from` and no dynamic `import()`.
  `export { ... }` lists are deleted outright, so `export { a as b }` silently loses `b`.
- Fonts are already data URIs inside `assets/fonts.css` (three `@font-face` lines carrying most
  of the repo's bytes). Never reformat or prettify that file.

### Runtime module graph

```
index.html      shell + config.js (onerror → window.AIB_CONFIG = {})
src/app.js      App controller; exposes window.app (shoot.js drives it)
  ├─ scenes.js     SCENES[], sceneIndex(id)
  ├─ avatar.js     Avatar — 4-method public surface
  ├─ voice.js      Voice (ElevenLabs → Web Speech), estimate(), createRecogniser()
  └─ ask.js        Ask (retrieval → optional grounded LLM, OpenAI or Anthropic), spokenForm()
       └─ knowledge.js   KB[], search(), CONFIDENCE_FLOOR, DONT_KNOW, WINKS
```

### Token-based cancellation in `app.js`

`App.token` is incremented on every `render()`, `pause()` and `handleAsk()`. Every async loop
captures `const my = ++this.token` and bails with `if (my !== this.token) return;` after each
`await`. Any new asynchronous flow (narration, answering, animation with awaits) must follow
this pattern, or a stale narration keeps running after the user changes scene or asks a
question.

### Scene contract (`src/scenes.js`)

Each scene is `{ id, title, eyebrow, flag?, lines[], html(), enter?(ctx) }`.
`lines` are spoken and captioned one at a time; `html()` returns the stage markup;
`enter(ctx)` runs after the stage mounts with:

- `ctx.root` — the stage element
- `ctx.goto(id, { play })` — jump to another scene
- `ctx.ask(question)` — route a canned question through the ask pipeline
- `ctx.onLine(n, fn)` — fire `fn` when narration reaches line `n` (scenes 8 and 9 start their
  animations this way; keep the line index in step if you edit those `lines`)
- `ctx.onLeave(fn)` — cleanup; clear any timers here or they fire on the next scene

Scene `id`s are stable keys: the knowledge base deep-links answers to them, so renaming one
means updating every `scene:` field in `knowledge.js`.

### Answering (`src/ask.js` + `src/knowledge.js`)

Retrieval always runs first. `search()` scores each KB entry's `k` + `q` text against the
question (IDF-weighted term match, plural-stripped, stem partial credit, adjacent-pair bonus,
bonus when the entry `id` words or the whole `q` appear verbatim), normalised by question
length, and reports `matched` / `coverage`. `isGrounded(hit)` is the rule: score at or above
`CONFIDENCE_FLOOR` (0.34) **and** at least three matched words or half the question matched —
one generic word ("plan", "hall") over the floor is not enough. Otherwise AIRIS answers
`DONT_KNOW` instead of guessing.

With an LLM configured, the same top hits (plus their `facts`) are passed as grounding and the
`SYSTEM` prompt forbids answering outside them (no prices, ROI figures always "indicative range",
never imply a module ceiling, no client names the grounding does not contain, at most 70 words,
warm with one light touch of humour). `Ask.provider` is `llm.provider`, else guessed from the
endpoint or key prefix; OpenAI uses Chat Completions with `max_completion_tokens`, Anthropic uses
Messages. `hasLLM` is true only with a key or a non-vendor endpoint (a proxy), so a blank config
never makes a doomed network call. LLM output is run through `sanitise()` (allowlist: p, b, strong,
em, i, ul, ol, li, br) and any failure or the 12 s timeout falls back to the local answer. The
parser accepts Anthropic content blocks, `choices[0].message.content`, or `output_text`. `via` is
`local`, `llm` or `local-fallback` and drives the label under the answer.

Every answer also returns `visual` — `{ icon, facts[], sources[], related[] }` built from the
hits — which `app.js` renders in the `#ansFigs` panel with count-up numbers. Local answers get a
random `WINKS` sign-off about 45% of the time; don't add one to `DONT_KNOW`.

Adding a KB entry: `{ id, q, k, scene, icon, src, facts, a }`. `k` and `q` are what is scored
(the tokeniser strips plurals, and a verbatim `q` match earns a bonus), so include synonyms and
the phrasing a visitor would actually use. `a` is HTML in AIRIS's voice, at most ~70 words.
`facts` is up to four `{ n, l, human? }` tiles; `n` must start with the digits for the count-up
to animate. `src` must be one of the labels listed at the top of `docs/CONTENT-SOURCES.md`.
`scene` must be a valid scene id. `build.js` counts entries by matching `^\s*id: '`, so keep
`id:` at the start of its own line.

### Voice and avatar

`Voice.say(text)` resolves when the line finishes regardless of backend. ElevenLabs is used whenever
`elevenLabs.apiKey` is set (`voiceId` falls back to the premade default); it decodes to an `AudioContext` so real RMS reaches
`Avatar.setLevel()`. Web Speech is the fallback and has a guard timeout because Chrome silently
drops long utterances. `estimate(text)` (~153 wpm) drives lip-sync timing and timeouts when no
real audio exists.

`Avatar` is deliberately isolated behind `setState(s)`, `speak(text, durationMs)`,
`stopSpeaking()` and `setLevel(rms)`. The planned production swap to met4citizen/TalkingHead
(see `docs/OSS-EVALUATION.md`) must touch only `avatar.js`; keep that interface intact and keep
the canvas bust as the no-GPU fallback.

### Hosting constraint

A published Claude Artifact blocks all external hosts, so neither ElevenLabs nor an LLM
endpoint works there; the artifact always uses Web Speech and local retrieval. That is a
property of the preview, not a bug to fix in code.

## Content and design rules

- **Every claim is traceable.** Any number or statement added to `scenes.js` or `knowledge.js`
  needs a row in `docs/CONTENT-SOURCES.md`. Where product metadata and a slide disagree, the
  product wins. The product repo lives at `/Users/yosuvaberry/Documents/Mindgraph/Airport-Hub`
  on this machine; the two DXC PDFs (AIRIS briefing v5, PTE Asia brief) are the other sources.
- **Client names need clearance.** Only DXC's public references (Hong Kong, Western Sydney,
  Montreal) are named. Perth, Qantas and the Malaysian references stay out even though the v5
  briefing uses them. Nothing DXC-internal from the PTE brief (rosters, phone numbers,
  competitor list, lead process) goes into the knowledge base.
- **Short and warm.** Scene narration is at most four lines; answers at most ~70 words. AIRIS
  is friendly and a little playful, never at anyone's expense, and never quotes a price.
- **Platform, not modules.** Copy must never imply a fixed catalogue or a ceiling on what can be
  built; named use cases are "where airports start".
- **One colour rule.** `--sky` is the platform's voice, `--gold` is the human's (gates, approval
  steps, the avatar's rim light when listening). Nothing breaks it.
- **Light theme is a redesign, not an inversion.** Tokens live in `:root` in `styles.css`;
  light overrides map Sky to Royal and darken Gold for contrast. Theme is set via
  `data-theme` on `<html>` and persisted under the `aib-theme` localStorage key.
- A key in `config.js` is a key in the browser. Never commit one; use `--no-config` for
  anything handed out; point `llm.endpoint` at a proxy for anything internet-reachable.
