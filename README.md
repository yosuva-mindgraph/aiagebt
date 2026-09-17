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

`config.js` is inlined into **every** build target, so that warning follows the built
files out of the door. `build.js` prints `config INLINED` and a reminder when it has
baked a key in; `--no-config` is how you produce something safe to hand over.

## The presenter

Two backends behind one interface, and the page picks at runtime:

| | |
|---|---|
| **canvas** | Iris drawn in 2D — `src/avatar.js`. Visemes, blink, four states. No GPU, no download, no dependency. This is what ships. |
| **talkinghead** | A rigged GLB in WebGL via [met4citizen/TalkingHead](https://github.com/met4citizen/TalkingHead) (MIT), vendored offline in `vendor/`. Drives its own audio clock, so it does the playing as well as the mouthing. |

`Avatar3D.create()` **answers `null` rather than throwing** when it cannot have a 3D
presenter — no `window.TalkingHead`, a blocklisted GPU, `prefers-reduced-motion`, or a
rail that is `display:none` on a phone. None of those are errors; they are "no 3D
today", logged once, and the walkthrough carries on with the canvas bust. That is why
the shipped file can simply leave the 3D bytes out.

## Building the single file

```bash
node build.js                # → dist/index.html      the deliverable
node build.js --3d           # → + dist/index-3d.html  with the 3D presenter
node build.js --artifact     # → + dist/artifact.html  for a hosted Artifact
node build.js --no-config    # omit config.js — composes with all of the above
```

Every run rebuilds `dist/index.html`; the flags **add** targets rather than replacing
it, so the deliverable is never accidentally a 3D build.

| Target | Contains | Size |
|---|---|---|
| `dist/index.html` | CSS, fonts, all eight modules, config. **Canvas presenter only.** | **0.90 MB** |
| `dist/index-3d.html` | the same, **plus** the TalkingHead bundle (0.79 MB) and the avatar GLB as base64 | 48.5 MB today — see below |
| `dist/artifact.html` | `dist/index.html` with `<head>`/`<body>` stripped and the theme stamped by script | 0.90 MB |

**`dist/index.html` is the one with the promise**: copy it to a booth machine, unplug
the network, double-click, press F11. Nothing it needs is outside the file. That
promise is the whole reason for the constraints here — data-URI fonts, no bundler,
and no TalkingHead bytes.

`dist/index-3d.html` is **built on demand and not committed** — at the moment it is
48.5 MB, because `assets/avatar.glb` is the 35 MiB CC0 placeholder and base64 adds a
third again. The build says so loudly rather than quietly emitting it, and points at
`tools/convert-valid-avatar.mjs`. Compressed to the 2–3 MB that avatar should be, this
target lands around 4 MB. The fix is compressing *that* asset, never swapping to a
smaller non-commercial one — see below.

`dist/artifact.html` is canvas-only and not negotiable about it: a published Artifact's
CSP blocks external hosts, and a payload of tens of megabytes would not survive the
round trip regardless.

Fonts are already data URIs; the build folds in the CSS and flattens the ES modules
into one classic script. Two things it refuses to do rather than ship:

- **Top-level name collisions.** Flattening puts every module in one scope, so two
  modules that each declare a private `pause` become a `SyntaxError` that only appears
  in the built file. `build.js` exits 1 and names both files.
- **A seam that has moved.** The `<script>`/`<link>` tags in `index.html` are matched
  literally. Reformat one and the regex silently stops matching, and a build that
  "succeeded" ships a page that loads nothing — so a miss is a hard failure, not a
  shrug.

## Seeing it

```bash
LD_LIBRARY_PATH=$HOME/.local/chromedeps/root/usr/lib/x86_64-linux-gnu node shoot.js
```

Drives a real browser through `dist/index.html` — so `node build.js` first — at
1920×1080 and 1440×900, captures every scene plus the answer sheet, and **reports
horizontal overflow and page errors** — the two faults a screenshot will not tell you
about. 28 shots, into `shots/` (gitignored).

Console errors count as failures, which is why the build strips the optional
`vendor/` and `assets/` script tags out of the canvas targets instead of leaving them
to 404: under `file://` a missing relative script is `ERR_FILE_NOT_FOUND`, and four
red lines in the console on a machine on a stand is not "harmless".

This is the most useful command in the repo. Reasoning about a layout is not the same
as looking at it: this pass is what caught the presenter floating in its panel and the
mouth being invisible at rest.

## Layout

```
index.html          the shell — header · presenter rail · stage · film strip · ask bar
assets/fonts.css    GT Standard + Inter, inlined from the DXC brand pack
assets/avatar.glb   the rigged avatar — CC0 placeholder, 35 MiB (see below)
src/
  styles.css        tokens, both themes. One rule: SKY is the platform's, GOLD is the human's
  scenes.js         the twelve scenes — narration + stage + optional interaction
  knowledge.js      38 traceable facts + the retrieval function + the confidence floor
  avatar.js         Iris — canvas bust, visemes, blink, four states
  voice.js          ElevenLabs → Web Speech fallback; plus speech input
  avatar3d.js       the two backends behind one interface; 3D falls back by answering null
  presenter.js      picks a backend, owns say/cancel, hides the seam from app.js
  ask.js            retrieval, then a grounded LLM if a key is present
  app.js            transport, narration loop, film strip, interruption handling
vendor/             TalkingHead + three.js bundled offline, and the smoke test that pins it
tools/              avatar validation and compression
build.js  shoot.js  build the single file · look at it
docs/               where every claim came from · the open-source evaluation · the TalkingHead traps
```

The eight files under `src/` are inlined **in dependency order** — `build.js` holds the
list. Order matters: get it wrong and the built file still parses, it just dies at
`Presenter is not defined` on first paint.

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

## The avatar, and its licence

TalkingHead is **in**, vendored offline in `vendor/` and pinned by `vendor/smoke.cjs`.
What is still open is *who Iris is*.

`assets/avatar.glb` is **`mpfb.glb`, CC0 (public domain)**, 35.11 MiB. It was chosen for
its licence, not its looks or its size: of the six avatars TalkingHead ships as examples,
it is **the only one that is not non-commercial**. This is a MindGraph × DXC walkthrough
shown to prospects — that is commercial use, unambiguously — and the deck is delivered as
one HTML file, which is to say downloadable. CC BY-NC does not survive that.

> **The Ready Player Me route no longer exists.** An earlier version of this README
> recommended it, and `docs/OSS-EVALUATION.md` costed it as a ten-minute job. **RPM shut
> down on 2026-01-31**, following its acquisition by Netflix — its domains no longer
> resolve, and the sentence in TalkingHead's README about signing up as an RPM developer
> to use an avatar commercially has quietly gone with it. There is no route to license an
> RPM avatar at all now, so the smaller `brunette.glb` is not an option however the size
> pressure reads. Both documents are corrected.

So: **35 MiB is the price of a clean licence, paid knowingly.** Do not trade it back.
The legitimate way down is compressing *this* asset — `gltf-transform` with webp
textures, which is what `tools/convert-valid-avatar.mjs` is for; texture data, not
geometry, is the bulk of a humanoid GLB.

`mpfb.glb` is a generic MakeHuman figure: it proves the pipeline, not the brand. A
brand-correct Iris now means **authoring a rig to the contract** (Blender + MPFB, or a
commissioned model) — full body, `Armature` root, 52 named bones, `LeftEye`/`RightEye`,
52 ARKit shapes + 15 visemes, no Draco. That contract, and every trap behind it, is in
[`docs/TALKINGHEAD.md`](docs/TALKINGHEAD.md); the alternatives and the cost are in
[`docs/OSS-EVALUATION.md`](docs/OSS-EVALUATION.md). Swapping the model itself is a
one-file change: drop the GLB at `assets/avatar.glb` and re-run `vendor/smoke.cjs`.

The canvas presenter stays regardless — it is the fallback for a venue machine with no
GPU, and it is what `dist/index.html` ships.
