# AIB Presenter

An avatar-led walkthrough of **Airport in a Box**. Iris presents the platform across
twelve scenes, and answers any question about it at any point — out loud, with the
walkthrough pausing and resuming around the interruption.

Built to the pattern of the AgentRM marketing agent (scene stage · film strip ·
live captions · ask bar), with the thing that one was missing: **a presenter with a
face.**

```
open index.html                # or dist/index.html — one file, no server, no network
```

---

## What it is

Twelve scenes, in this order:

| # | Scene | What it lands |
|---|---|---|
| 1 | Airport in a Box | All the airport's data — then build anything on it |
| 2 | Where should I start? | The chooser; jump anywhere |
| 3 | The proposition | Sits on top of everything, replaces none of it |
| 4 | All the data | 21 sources → 58 entities → 201 governed KPIs |
| 5 | The airport, modelled | 5 control centres, domains, apps — **metadata, not code** |
| 6 | Ask it anything | Governed natural language, with its sources shown |
| 7 | Build anything on it | Boards · apps · workflows · agents |
| 8 | Watch it work — **live** | One playbook, end to end, stopping at the human |
| 9 | Agents, governed | Risk tier, data scope, declared tools, evals, guardrails |
| 10 | Governance, risk & compliance | ICAO, privacy, AI governance — and its own risks |
| 11 | How it lands | ~85/15, three ways in, air-gapped |
| 12 | Let's talk | Point it at three feeds, judge it in a fortnight |

The argument is deliberately **platform-shaped**, not a module catalogue: one governed
model of the airport, then an unbounded number of things built on it. Where named use
cases appear they are framed as where airports *start*, not where the platform stops.

Everything on screen is traceable — see [`docs/CONTENT-SOURCES.md`](docs/CONTENT-SOURCES.md).

## Asking it things

The ask bar is live in every scene (`/` focuses it, or 🎤 to speak). A question pauses
the walkthrough, Iris answers aloud, and offers either the scene that covers it or
"resume where we were".

**With no keys it still works.** Answers come from `src/knowledge.js` — 38 entries,
each traceable to a source — through a small retrieval function. Below a confidence
floor Iris says she does not know rather than guessing, which is the behaviour that
survives a room full of operators.

**With an LLM key** the same retrieval runs first and the top entries are handed to the
model as *grounding*. The model may only answer from them. A key makes Iris more
fluent, not more imaginative — so the deck behaves the same in a room with no network.

## Sound

Browser `speechSynthesis` by default — no key, no network, works on a locked-down
venue machine. With `elevenLabs` configured it streams from ElevenLabs instead and the
mouth follows real audio RMS rather than a text estimate.

## Configuration

```bash
cp config.example.js config.js     # then fill in; config.js is gitignored
```

Both blocks are optional and independent. Read the warning in that file: **a key in
`config.js` is a key in the browser.** Fine on a laptop you control. For anything
reachable from the internet, leave `apiKey` blank and point `llm.endpoint` at a proxy
that holds the key server-side.

## Building the single file

```bash
node build.js                # → dist/index.html   (~0.84 MB, everything inlined)
node build.js --no-config    # same, minus config.js — safe to hand out
```

Fonts are already data URIs; the build folds in the CSS and flattens the ES modules
into one classic script. It refuses to build on a top-level name collision, because
that is a bug the module system hides and the built file does not.

## Seeing it

```bash
LD_LIBRARY_PATH=$HOME/.local/chromedeps/root/usr/lib/x86_64-linux-gnu node shoot.js
```

Drives a real browser through every scene at 1920×1080 and 1440×900, captures each one
plus the answer sheet, and **reports horizontal overflow and page errors** — the two
faults a screenshot will not tell you about. Output in `shots/` (gitignored).

This is the most useful command in the repo. Reasoning about a layout is not the same
as looking at it: this pass is what caught the presenter floating in its panel and the
mouth being invisible at rest.

## Layout

```
index.html          the shell — header · presenter rail · stage · film strip · ask bar
assets/fonts.css    GT Standard + Inter, inlined from the DXC brand pack
src/
  styles.css        tokens, both themes. One rule: SKY is the platform's, GOLD is the human's
  scenes.js         the twelve scenes — narration + stage + optional interaction
  knowledge.js      38 traceable facts + the retrieval function + the confidence floor
  avatar.js         Iris — canvas bust, visemes, blink, four states
  voice.js          ElevenLabs → Web Speech fallback; plus speech input
  ask.js            retrieval, then a grounded LLM if a key is present
  app.js            transport, narration loop, film strip, interruption handling
build.js  shoot.js  build the single file · look at it
docs/               where every claim came from · the open-source evaluation
```

### Keyboard

`space` play/pause · `←` `→` scene · `/` focus the ask bar · `esc` close the answer

## Design notes

**One colour rule, held everywhere.** Sky `#a1e6ff` is the platform's voice; Gold
`#ffae41` is the human's. The gate that waits for a person is gold. The approval step
in the live workflow is gold. The avatar's rim light turns gold when it is listening to
you. Nothing breaks it.

**Dark by default**, because this is shown on a panel in a room with the lights down
and Midnight is the brand ground. Light is fully designed — not an inversion; Sky is
too pale on paper, so the platform speaks in Royal there — and the toggle persists.

**Iris is drawn, not filmed.** A half-convincing photoreal head reads as a failure; a
confident stylised one reads as a choice. The name is from the source material —
*"like an iris, AIRIS enables an Airport to see and understand its operations"* — which
is why the eye is the most detailed thing on the face and everything else is quieter.

## Next

The production avatar should be **[met4citizen/TalkingHead](https://github.com/met4citizen/TalkingHead)**
(MIT) with a Ready Player Me GLB and the ElevenLabs WebSocket endpoint for word-level
timestamps. `src/avatar.js` is isolated behind four methods so the swap touches one
file. Reasoning, alternatives considered, and the cost: [`docs/OSS-EVALUATION.md`](docs/OSS-EVALUATION.md).

Keep the canvas presenter as the fallback for a venue machine with no GPU.
