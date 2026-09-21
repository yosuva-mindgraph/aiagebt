# Intelligent Airport — the presenter

An avatar-led walkthrough of **Intelligent Airport**. Iris presents the platform across
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
| 1 | Intelligent Airport | All the airport's data — then build anything on it |
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
| **canvas** | Iris as an aperture — `src/avatar.js`. A level ring reading out the speech envelope, four states. No face, so no visemes drawn and nothing to blink. No GPU, no download, no dependency. This is what ships. |
| **talkinghead** | A rigged GLB in WebGL via [met4citizen/TalkingHead](https://github.com/met4citizen/TalkingHead) (MIT), vendored offline in `vendor/`. Drives its own audio clock, so it does the playing as well as the mouthing. |

`Avatar3D.create()` **answers `null` rather than throwing** when it cannot have a 3D
presenter — no `window.TalkingHead`, a blocklisted GPU, `prefers-reduced-motion`, or a
rail that is `display:none` on a phone. None of those are errors; they are "no 3D
today", logged once, and the walkthrough carries on with the canvas aperture. That is why
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
| `dist/index.html` | CSS, fonts, all eight modules, config. **Canvas presenter only.** | **~0.9 MB** |
| `dist/index-3d.html` | the same, **plus** the TalkingHead bundle (0.79 MB) and the avatar GLB as base64 | avatar-dependent — `build.js` prints it and holds a ceiling |
| `dist/artifact.html` | `dist/index.html` with `<head>`/`<body>` stripped and the theme stamped by script | ~0.9 MB |

**`dist/index.html` is the one with the promise**: copy it to a booth machine, unplug
the network, double-click, press F11. Nothing it needs is outside the file. That
promise is the whole reason for the constraints here — data-URI fonts, no bundler,
and no TalkingHead bytes.

`dist/index-3d.html` is **built on demand and not committed**. Base64 adds a third again
to whatever `assets/avatar.glb` weighs, so this target's size is the avatar's size and
almost nothing else's. `build.js` declares a per-target `SIZE_LIMITS_MB` (`three: 12`,
against `canvas: 18` for the speech-carrying targets) and goes loud rather than
quietly emitting a file too big to hand anybody, naming `tools/convert-valid-avatar.mjs`
as the fix; `tests/build.test.mjs` builds an oversized GLB in a scratch tree to watch
that guard actually fire. The fix for an over-ceiling build is always **compressing that
asset**, never swapping in a smaller one whose licence forbids commercial use. The
committed avatar's provenance, licence and measured size live in
[`docs/AVATAR.md`](docs/AVATAR.md).

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

## Deploying it on a VM

The double-click promise covers a booth machine. When the deck has to live at a URL
instead, there is a container: **nginx serving `dist/index.html` and nothing else.**

```bash
docker build -t aib-deck .
docker run -d --name aib-deck -p 80:8080 aib-deck
```

That is the whole deployment. **~75 MB** with the pre-rendered speech baked in (23.6 MB
without it), serves on **8080** inside the container, and carries no Node, no
`node_modules` and no source — the build happens in a discarded first stage, so the image
is reproducible from this repo rather than from whatever was in someone's `dist/` at the
time. (`dist/` is in `.dockerignore` specifically so that cannot happen.)

The image needs `assets/voice-clips.js` to exist, rendered at `--scope all`. It is
generated and gitignored, so a fresh clone does not have one:

```bash
node tools/prerender-voice.mjs --scope all      # once, on a machine with a key
```

The build **refuses** to proceed without it rather than quietly shipping a robotic deck —
see below.

**Port.** 8080 inside, because a non-root process cannot bind 80. Remap it with `-p`
(above). If you need a different *internal* port — host networking, say — set
`-e AIB_PORT=9090 -p 9090:9090`; the config is a template and the healthcheck follows it.

**Updating the deck.** There is no content mount and no copying a file into a running
container: rebuild the image and replace the container.

```bash
docker build -t aib-deck . && docker rm -f aib-deck && docker run -d --name aib-deck -p 80:8080 aib-deck
```

Browsers pick the new deck up on the next load — the page is served `Cache-Control:
no-cache`, which means *revalidate*, not *don't cache*. A repeat visitor sends a
conditional request and gets a `304` with an empty body when nothing changed, so
revisits stay cheap while a redeploy is never stale. Caching it `immutable` would be
wrong here: there is one URL, `/`, and rebuilding does not change it, so a booth laptop
that cached it hard would have no way to hear about a fix.

**No key ever enters the image.** `config.js` holds an ElevenLabs key and `build.js`
inlines it *verbatim* into the page, so it is excluded in `.dockerignore`, the builder
copies an allowlist rather than `COPY . .`, the build runs `--no-config`, and a final
step greps the artifact for key-shaped strings and fails the build. The served page ships
`window.AIB_CONFIG = {}`.

**And it still speaks in the real voice — that is the point.** The image needs no key
because there is nothing left for one to do: at `--scope all` the pre-rendered payload
covers *every string the deck can speak* — the twelve scenes' narration, all 39
knowledge-base answers, and the "I don't have that" reply Iris falls back on when a
question is off-script. No runtime text means no synthesis, which means no credential,
which is what makes this a **host-and-run** container rather than one you configure.

That property is load-bearing and it used to be unenforced. `assets/voice-clips.js` is
gitignored, so whether the image spoke in a human voice or the flat browser one came down
to whether the file happened to exist on the packager's machine — and nothing failed
either way. `build.js --require-voice`, which the Dockerfile passes, turns all three
versions of that into a build error naming the cause: no payload, a narration-scope one
(which narrates beautifully and answers every question robotically), or one short of the
corpus because an edited line silently dropped its own clip.

**Nothing needs to reach the internet.** Everything is inlined, fonts included, and with
no key configured the ElevenLabs and Anthropic call sites are never taken. Driving the
running container with a real browser records **exactly one request — the document
itself.** So: no CDN, no API, no egress, and **no reverse proxy for services that do not
exist**. Do not add one looking for a backend; there isn't one.

**HTTPS.** The container deliberately speaks plain HTTP — terminate TLS in front of it.
On a real VM that is Caddy, Traefik or nginx on the host with a Let's Encrypt cert,
proxying to `127.0.0.1:8080`; behind a cloud load balancer, terminate there and point the
target group at the container. The only thing to get right is forwarding the `Host`
header. Nothing in the deck reads a cookie, a session or a header, so there is no
trusted-proxy configuration to do.

**Hardening.** It already runs as `nginx` (uid 101) — including PID 1, which the stock
nginx image does not do — and everything writable lives in `/tmp`. So it runs fully
locked down:

```bash
docker run -d --name aib-deck -p 80:8080 \
  --read-only --tmpfs /tmp --tmpfs /etc/nginx/conf.d:uid=101,gid=101 \
  --cap-drop ALL --security-opt no-new-privileges \
  aib-deck
```

The second `--tmpfs` is not optional under `--read-only`: the entrypoint renders the port
template into `/etc/nginx/conf.d` at boot and needs somewhere to write it.

**Liveness.** `HEALTHCHECK` polls `/healthz`, a constant string — not `/`. Probing the
deck itself would push the whole artifact through the stack every 30 seconds for no
added signal, and that bill grows with the file.

`docker/nginx.conf` and `docker/default.conf.template` carry the reasoning for each
choice.

## Layout

```
index.html          the shell — header · presenter rail · stage · film strip · ask bar
assets/fonts.css    GT Standard + Inter, inlined from the DXC brand pack
assets/avatar.glb   the rigged avatar — provenance, licence and size in docs/AVATAR.md
src/
  styles.css        tokens, both themes. One rule: SKY is the platform's, GOLD is the human's
  scenes.js         the twelve scenes — narration + stage + optional interaction
  knowledge.js      38 traceable facts + the retrieval function + the confidence floor
  avatar.js         Iris — the canvas aperture, speech envelope, four states
  voice.js          ElevenLabs → Web Speech fallback; plus speech input
  avatar3d.js       the two backends behind one interface; 3D falls back by answering null
  presenter.js      picks a backend, owns say/cancel, hides the seam from app.js
  ask.js            retrieval, then a grounded LLM if a key is present
  app.js            transport, narration loop, film strip, interruption handling
vendor/             TalkingHead + three.js bundled offline, and the smoke test that pins it
tools/              avatar validation and compression
build.js  shoot.js  build the single file · look at it
Dockerfile          multi-stage: build the deck, then nginx + the one artifact
docker/             nginx main config and the port template
docs/               where every claim came from · the avatar · the open-source evaluation · the TalkingHead traps
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

**The canvas Iris is an aperture, not a face.** The drawn bust that stood here used to
argue that a half-convincing photoreal head reads as a failure while a confident stylised
one reads as a choice. That argument lost its own ground: the 3D backend now loads a
genuinely photoreal GLB, so a drawing is no longer the confident alternative to a bad
render — it is a drawing competing with a real head, on the real head's terms, in the
DEFAULT build that most clients are shown. An aperture never enters that contest. It
cannot fall into the uncanny valley, because it is not attempting a face.

What it does instead is state the product's own metaphor. Her name is from the source
material — *"like an iris, AIRIS enables an Airport to see and understand its
operations"* — so what is drawn is the instrument that does the seeing: a level ring, two
hairlines, a datum across the middle and a small light on it. A single number — real RMS
when ElevenLabs is present, synthesised from the viseme track when it is not — drives the
lit ticks, the hairline radii, the centre light and the bar on the datum, so the ring
reads out speech rather than miming a mouth. There is deliberately no eye: a pale disc
with a dark middle inside a ring is an eyeball whatever the comments call it, and the
first cut of this held the room's gaze for the length of a walkthrough before it was cut
back. The ring is the subject; the centre is a reading. The argument in full, including
the two shapes that were tried and rejected, is the header of
[`src/avatar.js`](src/avatar.js).

What the 3D backend loads instead is [`docs/AVATAR.md`](docs/AVATAR.md)'s business, not
this note's.

## The avatar

TalkingHead is **in**, vendored offline in `vendor/` and pinned by `vendor/smoke.cjs`.

**Which file Iris is, where it came from, what its licence permits and what it measures
are all recorded in [`docs/AVATAR.md`](docs/AVATAR.md). That document is the source of
truth and this one deliberately does not restate it.** An earlier README kept its own
copy of those facts, the copy went stale, and it ended up describing an asset — and a
licence — that was no longer the one committed. A wrong licence claim in a README is
worse than no claim, so there is now exactly one place for them and it is not here.

What this file does own:

- **Commercial use is the binding constraint**, and it is what rules out most free
  avatars. This is a MindGraph × DXC walkthrough shown to prospects, delivered as one
  downloadable HTML file. A CC BY-NC asset does not survive that, however neatly it
  would solve the size problem — so size pressure is never a reason to trade the licence
  back. The legitimate way down is compressing the asset we are entitled to use:
  `gltf-transform` with webp textures, which is what `tools/convert-valid-avatar.mjs` is
  for, because texture data rather than geometry is the bulk of a humanoid GLB.
- **The rig contract is not negotiable** — full body, an `Armature` root, named bones and
  eyes, ARKit shapes plus visemes, no Draco. The exact contract and every trap behind it
  are in [`docs/TALKINGHEAD.md`](docs/TALKINGHEAD.md); the alternatives that were
  considered and why they lost are in
  [`docs/OSS-EVALUATION.md`](docs/OSS-EVALUATION.md).
- **Swapping the model is a one-file change** — drop the GLB at `assets/avatar.glb`, then
  re-run `node tools/check-avatar-glb.mjs assets/avatar.glb` and `vendor/smoke.cjs`. The
  checker exists because a GLB that loads cleanly is not the same as a GLB whose mouth
  moves.
- **The canvas presenter stays regardless.** It is the fallback for a venue machine with
  no GPU, and it is what `dist/index.html` ships.
