# AIB Presenter

An avatar-led walkthrough of **Airport in a Box**. AIRIS presents the platform across
thirteen short scenes, and answers any question about it at any point — out loud, with
figures beside the answer, and the walkthrough pausing and resuming around the interruption.

Built to the pattern of the AgentRM marketing agent (scene stage · film strip · live
captions · ask bar), with the thing that one was missing: **a presenter with a face.**

```
open dist/index.html           # one file, no server, no network (keyless)
open dist/stand.html           # the same file with your keys baked in — the stand machine opens this
```

---

## What it is

Thirteen scenes, in this order. The narration is deliberately short — at most four lines a
scene, about a thousand words for the whole tour — because the stage carries the detail and
nobody wants a lecture at a stand.

| # | Scene | What it lands |
|---|---|---|
| 1 | Airport in a Box | Three lines: hello, one sentence on what it is, the tour in six stops |
| 2 | Where should I start? | The chooser; jump anywhere |
| 3 | The proposition | Sits on top of everything, replaces none of it |
| 4 | All the data | 21 sources → 59 entities → 204 governed KPIs |
| 5 | The airport, modelled | 5 control centres, domains, apps — **metadata, not code** |
| 6 | Ask it anything | Governed natural language, with its sources shown |
| 7 | Build anything on it | Boards · apps · workflows · agents |
| 8 | Watch it work — **live** | One playbook, end to end, stopping at the human |
| 9 | One disruption, 83 seconds — **live** | DXC's AIRIS demo: 187 passengers, 17 systems, five personas |
| 10 | Agents, governed | Risk tier, data scope, declared tools, evals, guardrails |
| 11 | Governance, risk & compliance | ICAO, privacy, AI governance — and its own risks |
| 12 | How it lands | ~85/15, three ways in, air-gapped |
| 13 | Let's talk | Point it at three feeds, judge it in a fortnight |

The argument is deliberately **platform-shaped**, not a module catalogue: one governed
model of the airport, then an unbounded number of things built on it. Where named use
cases appear they are framed as where airports *start*, not where the platform stops.

Everything on screen is traceable — see [`docs/CONTENT-SOURCES.md`](docs/CONTENT-SOURCES.md).
Where the product repo and a slide disagree, the product wins; the corrections made are
listed at the top of that file.

## Asking it things

The ask bar is live in every scene (`/` focuses it, or 🎤 to speak). A question pauses
the walkthrough, AIRIS answers aloud — short, warm, and with a gentle joke now and then —
and the answer sheet shows the words on the left and the **figures on the right**: an
icon, up to four numbers that count up, the sources they came from, and two related
questions to tap next.

**With no keys it still works.** Answers come from `src/knowledge.js` — 71 entries, each
traceable to a source — through a small retrieval function. Below a confidence floor AIRIS
says she does not know rather than guessing, which is the behaviour that survives a room
full of operators.

**With an LLM key** the same retrieval runs first and the top entries are handed to the
model as *grounding*. The model may only answer from them, in at most 70 words, in AIRIS's
voice. A key makes AIRIS more fluent, not more imaginative — so the deck behaves the same
in a room with no network.

## Sound

Browser `speechSynthesis` by default — no key, no network, works on a locked-down venue
machine. With an ElevenLabs key configured it streams from ElevenLabs instead and the
voice meter follows real audio RMS rather than a text estimate.

**Speak** records in the page and transcribes through ElevenLabs Scribe when the key is
present — it works in every browser, holds gold while it listens, stops on a pause or a tap,
and has a Cancel beside it. Without a key it falls back to the browser's own recognition
(Chrome only, needs Google's service), and any failure is said out loud rather than swallowed.

## Configuration

```bash
cp config.example.js config.js     # then fill in; config.js is gitignored
```

Two blocks, both optional and independent:

- `elevenLabs.apiKey` — the voice. Two personas, **Friday** (female) and **Jarvis** (male),
  each an ElevenLabs voice ID under `elevenLabs.voices`; a switch in the header picks one and
  remembers it on that machine. The defaults are premade voices (Lily and George) with soft
  settings: multilingual v2, stability 0.62, a little style, speed 0.93. Eleven v3 accepts
  stability only as 0 / 0.5 / 1 and ignores the v2 knobs; the code snaps the value so a v3
  build never silently falls back. Every distinct line is fetched **once**
  and replayed from memory and IndexedDB after that, so a day of looping the deck costs
  the characters of one run. The next line is generated while the current one plays, and
  after Start the whole deck warms in the background (`prewarm: false` to turn that off), so
  even the first tour has no gaps once the opening line is out.
- `llm` — the brain. `provider: 'openai'` (default) or `'anthropic'`; `apiKey`; `model`
  (an OpenAI model, or on Azure the deployment name). `endpoint` takes a full route, an
  SDK-style base URL such as Azure's `…/openai/v1`, or your proxy; leave it blank for the
  provider's own API. gpt-5 / o-series models get `reasoning_effort: minimal` automatically.

Read the warning in that file: **a key in `config.js` is a key in the browser.** Fine on a
laptop you control on a stand. For anything reachable from the internet, leave `apiKey`
blank and point `llm.endpoint` at a proxy that holds the key server-side.

## Building the single file

```bash
node build.js                # → dist/index.html  (~0.9 MB, everything inlined, NO keys — safe to commit and hand out)
                             #   + dist/stand.html when config.js exists (keys baked in — gitignored; the stand machine opens this one)
node build.js --no-config    # skip dist/stand.html
node build.js --artifact     # also dist/artifact.html for Claude Artifact hosting
```

The keyed file is deliberately a different name from the tracked one, so a build can never
put a key into git by accident.

Fonts are already data URIs; the build folds in the CSS and flattens the ES modules
into one classic script. It refuses to build on a top-level name collision, because
that is a bug the module system hides and the built file does not.

## Seeing it

```bash
node shoot-cdp.js                                   # no dependencies: drives Chrome / Brave / Edge headless
AIB_PLAYWRIGHT=/path/to/node_modules/playwright node shoot.js   # the Playwright variant
```

Either one drives a real browser through every scene at 1920×1080 and 1440×900, captures
each one plus the answer sheet, a don't-know, the light theme and the AIRIS run, and
**reports horizontal overflow, missing figures and page errors** — the faults a screenshot
will not tell you about. Output in `shots/` (gitignored). `shoot-cdp.js` needs only Node 22+
and a Chrome-family browser in `/Applications` (or `AIB_BROWSER=/path/to/binary`). On the
original Linux box `shoot.js` needed `LD_LIBRARY_PATH=$HOME/.local/chromedeps/root/usr/lib/x86_64-linux-gnu`.

This is the most useful command in the repo. Reasoning about a layout is not the same
as looking at it.

## Layout

```
index.html          the shell — header · presenter rail · stage · film strip · ask bar · answer sheet
assets/fonts.css    GT Standard + Inter, inlined from the DXC brand pack
src/
  styles.css        tokens, both themes. One rule: SKY is the platform's, GOLD is the human's
  scenes.js         the thirteen scenes — narration + stage + optional interaction
  knowledge.js      71 traceable entries, each with figures + a source label, the retrieval function, the sign-offs
  avatar.js         AIRIS — holographic core on canvas, voice meter, four states
  voice.js          ElevenLabs → Web Speech fallback; plus speech input
  ask.js            retrieval, then a grounded LLM (OpenAI or Anthropic) if a key is present
  app.js            transport, narration loop, film strip, interruption handling, the figures panel
build.js  shoot-cdp.js  shoot.js   build the single file · look at it (no deps) · look at it (Playwright)
docs/               where every claim came from · the open-source evaluation
```

### Keyboard

`space` play/pause · `←` `→` scene · `/` focus the ask bar · `esc` close the answer

## Design notes

**One colour rule, held everywhere.** Sky `#a1e6ff` is the platform's voice; Gold
`#ffae41` is the human's. The gate that waits for a person is gold. The approval step
in the live workflow is gold. The avatar's rim light turns gold when it is listening to
you. AIRIS's sign-off jokes are gold, because a smile is the human's. Nothing breaks it.

**Dark by default**, because this is shown on a panel in a room with the lights down
and Midnight is the brand ground. Light is fully designed — not an inversion; Sky is
too pale on paper, so the platform speaks in Royal there — and the toggle persists.

**AIRIS is a core, not a face.** A holographic iris — glowing aperture, rotating rings of
ticks, arcs and brackets, a circular voice meter and a slow field of particles — in the
style of a film AI's interface. The name is from the source material —
*"like the iris of an eye, AIRIS enables an Airport to see and understand its operations"* —
which is why the aperture is the centre of the design. Sky when it speaks, gold when it
listens (with sonar pings), peach and spinning while it thinks.

**She is short on purpose.** Every answer is capped near 70 words and every scene near
four lines. The figures panel does the rest of the talking.

## Next

The production avatar should be **[met4citizen/TalkingHead](https://github.com/met4citizen/TalkingHead)**
(MIT) with a Ready Player Me GLB and the ElevenLabs WebSocket endpoint for word-level
timestamps. `src/avatar.js` is isolated behind four methods so the swap touches one
file. Reasoning, alternatives considered, and the cost: [`docs/OSS-EVALUATION.md`](docs/OSS-EVALUATION.md).

Keep the canvas presenter as the fallback for a venue machine with no GPU.
