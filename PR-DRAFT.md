# Intelligent Airport: rename, DXC brand system, and a presenter that was three bugs rather than a taste problem

## What this is

The product is renamed from **Airport in a Box** to **Intelligent Airport**, and the deck
is rebuilt to DXC's brand guidelines. The trigger was an operator's review of the shipped
artifact: the presenter "looks like a kid did it", and the UI was to be designed to DXC
guidelines rather than approximately branded.

Ten task branches, integrated in dependency order onto one branch. Nothing here changes the
delivery promise: `dist/index.html` is still one file that opens from `file://` on an
unplugged booth machine, with no network and no icon font.

The review below is organised around the three findings that drove the work, because each
of them turned out to be different from the complaint that produced it.

| | |
|---|---|
| Branches integrated | `g1`…`g10`, all ancestors of the integration tip |
| Gate | **322/322 green**, 441.1 s |
| Shipped avatar | `Hispanic_F_3_Busi` · `70fbdc0e…8e35` · 7,381,268 B |
| Targets | `index.html` 1,036,359 B · `artifact.html` 1,035,868 B · `index-3d.html` 11,709,479 B |

---

## 1. The avatar was three bugs, not taste

The 3D presenter read as "cheap 3D" — blown out, flat, chin in the air, and wearing
something with a patent-leather sheen. Three separate defects, each measured, each fixed at
its own layer. None of them was a judgement call about how a presenter should look.

**The key light shipped at intensity 30.** Stock TalkingHead lights for its own demo page:
a `0x8888AA` directional at `lightDirectIntensity: 30`, `phi 1 / theta 2`. `setLighting()`
resolves that pair of angles through `setFromSphericalCoords(2, phi, theta)` to

```
(2·sin φ·sin θ, 2·cos φ, 2·sin φ·cos θ) = (1.53, 1.08, −0.70)
```

— above, camera-right and **behind** the head, aimed at the light's default target, the
origin, which is the avatar's **feet**. A rake light at 30, pointed at the floor. That one
number is most of the "blown out and flat", and it is why pale faces clipped to white. The
*angle* is a decent three-quarter rim and is kept; only the intensity was wrong. It drops
to **3**, and the budget goes on colour instead: DXC Sky `0xA1E6FF` as the cool rim, DXC
Peach `0xFFC982` as the warm ambient fill at 2.0. The spot light is set to 0 — it aims at
the feet too and contributed only a hard edge across the jaw, and `setLighting()` flips
`visible` false at zero intensity, so it costs nothing per frame.

**The chin-up was `lookAtCamera()`, and it was never aiming at the camera.** `th.lookAtCamera(1200)`
sat in `setState()` on `listening` and `speaking`, which is why she was level while silent
and staring at the ceiling the moment anyone spoke to her. The mechanism: `speakTo` is never
set, so `lookAtCamera()` falls through to `lookAt(null, null, dur)`, and `lookAt`'s null
defaults are the screen position of **the avatar's own eyes** — it projects them and aims at
that. The vertical target is then

```
convertRange(eyeScreenY, [c−y, c+y], [−0.3, 0.6]) − u + d
```

with the same `eyeScreenY` as `c`, i.e. always the midpoint of that range. It resolves to a
**constant +0.15 pitch bias** minus the head chain's current pitch `u` — a fixed backward
tilt applied on top of whatever pose she is in. Removing the call is the whole fix, A/B'd on
fresh page loads under an identical audio line.

Two escape hatches were tried and rejected, both rendered rather than reasoned about:
`avatarIgnoreCamera: true` looks official (`lookAtCamera` checks it and diverts to
`lookAhead()`) but is worse — `lookAhead()` queues `eyeContact: [0]` plus a random
`bodyRotateX/Y` of ±0.125, so instead of a chin-up you get a presenter glancing off to one
side mid-sentence. Cancelling it with a manual `Head.rotation.x` over-corrects, and the value
it must cancel depends on the current pose, so it is wrong in every state but the one it was
tuned in.

**One thing a reviewer must know before touching this:** the library re-issues the call
itself. `startSpeaking()` contains

```js
else if (t.audio) t.isRaw || (this.lookAtCamera(500), …)
```

so every line carrying audio — which is the shipped ElevenLabs path — calls `lookAtCamera`
from inside the bundle. That call cannot be removed from outside and does not need to be:
**fired from the speaking pose its `u` term very nearly cancels the +0.15 and it renders
level.** That is measured on the shipped rig, not assumed, and the comment at the removal
site says so, so nobody monkey-patches the bundle later on a theory.

What actually holds the viewer is the eyes — `avatarIdleEyeContact` and
`avatarSpeakingEyeContact` at 1, `avatarIdleHeadMove` 0, speaking head move 0.15. That is
what the removed call was reaching for, without pitching the whole head to get it.

**The patent-leather sheen was the GLB's own material, not the lighting.** VALID's avatars
ship `roughnessFactor: 0.5, metallicFactor: 0` with **no** metallicRoughness texture, so the
specular lobe is one flat number and 0.5 is semi-gloss plastic; suiting and knit are 0.7–0.9.
The reflection hypothesis was tested and killed: an `envMapIntensity` sweep at 1.0 / 0.45 /
0.18 / 0 showed **no visible difference at all**, while clamping roughness turned wet vinyl
into matt wool in one step. So it is clamped **at convert time**, in
`tools/convert-valid-avatar.mjs` — `clampMaterials()` floors roughness at 0.72 and caps
metallic at 0.05 across both materials — and the renderer needs no patch. The fix is in the
artifact, so it also holds for anything else that loads the GLB.

**Framing, the fourth complaint, was a crop problem and not a material one.** The suit read
as a leotard because the old band `[1.216, 1.899]` put the bottom edge at mid-chest, above
the jacket button (1.06) and the hem (0.96). With no lapel notch and no hem in shot, the
garment is a grey torso with a lighter panel down the middle. `cameraDistance` can never fix
it — it is a zoom about the bottom edge, not a dolly — and `cameraY` is the only control that
moves that edge, inverted. Rendered ladder: the button appears at ≤1.05 (not enough on its
own), the hem line at ≤0.90, hem and trousers together at ≤0.80. Ships as
`mid` / `−1.95` / `−0.33`, a band of `[0.779, 1.838]`. The cost is head size: chin-to-crown
goes 145 px → 74 px of the 339 px panel. Lip-sync survives it — a full `viseme_aa` opens the
mouth about 6 px at this framing, which is plainly visible motion — and the evidence grid is
in `docs/TALKINGHEAD.md`. Do not crop back up; the leotard comes back with it.

## 2. The avatar itself

`Hispanic_F_3_Busi`, from [VALID](https://github.com/c-frame/valid-avatars-glb), pinned at
commit `c4719df`. **MIT**, © 2022 Tiffany Do. MIT does not require citation; VALID's README
asks for it and we do it anyway — **Do et al. 2023** (Do, Zelenty, Gonzalez-Franco, McMahan),
full BibTeX in `docs/AVATAR.md`.

Why this one. VALID's female `Busi` outfit is not the male one: male `Busi` is a charcoal
suit, white shirt, striped tie, but **female `Busi` is an open blazer over a lilac crew-neck
knit**, and that lilac panel is what read as a shiny catsuit in the published artifact.
`Hispanic_F_3_Busi` is the exception in the whole female `Busi` set — her knit is grey.

Measured rather than eyeballed, both avatars rendered through this repo's own vendor bundle
at identical camera and lighting on a flat black backdrop, every torso pixel binned by hue:

| | violet band (255–300°) |
|---|---|
| `Black_F_1_Busi` (incumbent) | 270° at 24.0% sat 0.170 · 255° at 10.2% sat 0.105 — **34% of the torso**, lilac confirmed |
| `Hispanic_F_3_Busi` (this one) | **nothing in the band at all** |

Being precise, because "grey" overclaims: it is a desaturated **slate blue-grey**, mean
saturation 0.178 at hue 205–240°. It reads as tailoring rather than as a costume, which is
the point, but it is cooler than "grey" suggests.

**The cost, stated plainly.** VALID's avatars carry perceptual agreement rates from 1,006
participants across 33 countries. The incumbent was joint 1st at 0.98/0.98. This one is
**11th of 16** on min(own-ethnicity, female): **ethnic agreement 0.59**, against the
predecessor's 0.98. That is a real regression against the criterion the superseded document
made its headline, and it is recorded rather than buried, in `docs/AVATAR.md` §2.5 with the
full ranking read off VALID's own `All-Agreement-Rates.csv` at the pinned commit.

Why it is nevertheless acceptable: **gender agreement holds at 0.93**, and gender is the only
attribute this product makes a claim about — Iris is a named female presenter. The low number
is ethnic *ambiguity*, not illegibility: `Hispanic_F_03` splits Hispanic 0.59 / White 0.52 /
AIAN 0.22. VALID's agreement measure exists so that researchers who need a stimulus to read
as a specific demographic can pick one. **This deck asserts nothing about the presenter's
ethnicity**, so an avatar that reads ambiguously costs it nothing it was trying to buy.

It is also worth noting the incumbent's own selection argument is now void: it was chosen
partly for being "the only top-ranked candidate whose face survives TalkingHead's default
lighting" — which is a workaround for the intensity-30 bug fixed in §1. Selecting an avatar
to survive a defect and then fixing the defect leaves the selection resting on nothing.

## 3. The brand work was not a palette job

The palette and the typefaces were **already** the official DXC pack before this branch.
Swapping colours was never the work. Four things were actually wrong.

**Every neutral was invented off-palette.** DXC ships ten colours and no grey, so every
neutral in the sheet is now a `color-mix()` of two **named** palette colours — the provenance
of every value is in the code and there is no invented hex anywhere in it. Where a resolved
value matters (the four tokens `src/avatar.js` reads; see the follow-ups) the hex is written
with its mix beside it.

**`--royal` and `--red` were missing from both light blocks.** `--royal` was declared in
`:root` only, so in the light theme `getPropertyValue()` returned `''` and the avatar fell
through to its hard-coded 2024 dark-theme fallback: **the presenter painted the light theme
in dark-theme Royal.** Nothing could see it — `getPropertyValue()` answers `''` rather than
throwing, and the avatar is pixels on a canvas that no browser check inspects. The guard that
now catches it was **red on arrival**, on that live defect. It derives its token list by
parsing `src/avatar.js`'s own lookups out of the source (a typed list would guard the wrong
tokens once the bust is replaced — which it since has been) and requires each one to be
literal hex in `:root`, `[data-theme="light"]` **and** the `prefers-color-scheme` block.

**Emoji were being used as scene icons, against DXC's own written rule.** They rendered as a
different picture per OS and as tofu on the headless box `shoot.js` photographs. They are
gone: the gate scans all three built targets for pictographic codepoints and finds **zero**,
with a positive control proving the scanner matches an emoji when one is present.

**There was no DXC logo anywhere.** The header is now one lockup — the mark at 17 px
(cap-height matched), the product name, a 1 px rule, the scene — and the cold open carries
the mark alone at 20 px. One copy of the path serves both themes; the DXC Light and Dark
marks are the same geometry at a different fill. There is deliberately no second wordmark:
"MindGraph × DXC" reads in the eyebrow, and two marks plus an attribution is three things
competing to be the brand.

**The icons.** **48 of the pack's 62** icons, converted from the native vector geometry in
`DXC_New Brand Icons_Dec 2025.pptx`, plus the DXC brand mark. Each is a single path on a
24×24 grid at `fill=currentColor`, so an icon is one string and its colour is whatever the
element it lands in is already painting. Everything is inline in `src/icons.js` — no icon
font, no sprite sheet fetched through `xlink:href`, no `@import`, no CDN — because
`tests/offline.test.mjs` asserts zero network requests and the deliverable has to survive
being flattened into one inline script tag on a USB stick.

Placement follows DXC's own rule, *communicate, don't decorate*: an icon earns its place when
it **is** the control (the 15 px transport), when it is the only identifier a truncated row
has (the 18 px scene navigator), or when it classifies something the reader is scanning for.
Not on an eyebrow — an eyebrow is already a label. Three glyphs the pack does not have are
therefore **words** on the page rather than borrowed lookalikes: there is no
microphone/speaker/mute, no sun/moon and no bell, so "Sound on" and "Light" are buttons that
read as words on purpose. Six icons carry enough internal detail to smudge below 24 px and
are used at ≥20 px only — which is why scene 5 is identified in the navigator by `graph-nodes`
and not by `data-model`, the glyph its title would suggest: at 18 px `data-model` is a grey
smear. And the pack's TRAVEL & TRANSPORTATION glyph draws a **train**, so on an airport
product the aircraft glyph `airline` is used and the train is not in the file at all.

**The light theme is re-keyed on measured contrast, not on taste.** WCAG 2.1, against the two
light grounds:

| | on White | on Canvas | |
|---|---|---|---|
| Sky | 1.37:1 | 1.24:1 | unreadable |
| Gold | 1.84:1 | 1.67:1 | unreadable |
| Melon | 2.51:1 | 2.27:1 | unreadable |
| Royal | 8.15:1 | 7.38:1 | passes |
| Red | 4.58:1 | 4.14:1 | passes on White, AA-large on Canvas |

Sky is the platform's voice and Gold is the human's — but those are dark-theme *names* and
the tokens are semantic *slots*, so the slot outranks the name. In light, the two slots hold
Royal and Red. The palette answers itself and no third-party brown was needed. Red on Canvas
at 4.14:1 is the one marginal pair and it is deliberate — Red is the only warm of the ten that
reads at all on paper, and the alternative was inventing an eleventh colour. Every small red
label in the light theme sits on a White surface where it measures 4.58:1; the only two
red-on-Canvas runs are `.gate` at 15 px and `.q-line` at 22 px, both short and both by design.

## 4. The drawn bust became the IRIS aperture

The canvas presenter was a flat, perfectly symmetrical mask: one ellipse head, two identical
eyes with solid black pupils, arc brows, a lens mouth, a nose that met nothing, and
translucent hair that read as a swim cap. Nothing in it was asymmetric, shaded off-axis or
highlighted. Its own header had the principle right — *a half-convincing photoreal head reads
as a failure; a confident drawn one reads as a choice* — and did not honour it.

Improving the drawing is a fight it cannot win. The 3D build ships a photoreal GLB, so a
better bust competes with a real head on the real head's ground, in the **default** build,
which is the one most clients see. So it stops drawing a person and states the product's own
metaphor instead: *like an iris, AIRIS enables an Airport to see and understand its
operations*. An aperture cannot fall into the uncanny valley, because it is not attempting a
face.

It is canvas 2D, and every element is a function of the one number the backend already
provides through `setLevel()`: a 36-tick level ring (10° apart — enough that the lit run reads
as a continuous arc, few enough that one tick is a legible 1/36 step), two concentric
hairlines, a centre reading, and a radial ground glow. No face, no shoulders, no hair, no
scanlines. When `setLevel()` is null — Web Speech, or no API key at all, which is the common
case — the envelope is synthesised from the viseme track so the ring never sits dead through a
line. Literal aperture blades were tried first and cut: overlapping polygons read as a sci-fi
rune rather than an instrument.

**What it cost, deliberately: the literal metaphor lost its pupil.** The first cut had one —
a disc at .74 of the inner hairline's radius with a hole cut dead centre by
`destination-out`, which is what an aperture literally is and was correct on both themes with
no colour decision to get wrong. At rail width, beside a live caption and a name badge, it
read as an **eyeball** holding contact with the room for the length of a walkthrough — worse
than the lifeless bust it replaced, because a stare is an active thing. A pale disc with a
dark centre is the schematic of an eye in two elements, and no amount of tuning the sizes
fixes that.

So three things went, and the centre is now a *reading* rather than a pupil. The light runs
.33–.38 at rest and .46–.56 at full drive instead of .74–.85, so the ring is the visual mass.
There is no closed shape with a darker middle — no fill, no boundary stroke, no
`destination-out` hole, just a bloom whose last gradient stop is transparent and whose outer
circle is the filled circle, with peak alpha held under a lit tick's at every drive, so the
highest-contrast marks on the canvas are always out on the dial. And the bilateral symmetry
about the vertical that makes any round thing read as a face is broken by a datum running
through the middle and out through gaps in the inner hairline, carrying an unequal reading: a
bar that fills rightward, graded dim-to-bright so the energy sits at the moving end and never
back at dead centre. That bar also replaces the constricting hole as the level's second
channel.

Ring geometry is recovered from `getImageData` at 0.952R and asserted: 2–3 lit ticks at rest,
13–30 through a synthesised line, 2 to 40 across a real RMS ramp of 0.02 to 0.42, back to 3 at
rest. The colour semantic is unchanged and non-negotiable — Sky when the platform speaks, Gold
when it is the human's turn, Peach while thinking. `visemesFor()`, `VISEME` and every `Avatar`
method keep their signatures, because `src/presenter.js` and `src/avatar3d.js` depend on them.

## 5. The gate went 162 → 322 and got faster

| | checks | wall clock |
|---|---|---|
| before this branch | 162 | 471.4 s |
| after `g1` (fail-open seams) | 197 | |
| after `g3` (test hygiene) | 215 | 363.1 s / 367.7 s back to back |
| **this branch** | **322** | **441.1 s** |

Roughly double the checks, still under the pre-existing baseline. The saving came from `g3`:
the avatar suite's negative control was a **coin toss** — `movers.length >= 2` reported 1, 2,
5 and 6 across four runs of identical source, and a clean run failed it at 1. The cause was
aliasing, not the avatar. SwiftShader renders that target at 1–3 fps while TalkingHead
advances `animClock` by real elapsed time, so a 3-second line was sampled three to nine times
and whole visemes opened and closed between two samples; instrumented, 3/5/9/9/16 frames gave
2/3/8/7/9 movers and peak amplitude swung 0.33–0.90 on the same bytes. The sampler now speaks
through TalkingHead's own `setSlowdownRate()` — which divides every animation delta by *k*
**and** sets audio `playbackRate` to 1/*k*, so schedule and sound stretch together — and stops
on a frame **count** rather than a wall-clock deadline. Same GLB, same backend, same
`speakAudio()` path, played slowly enough for the camera actually available. No threshold was
moved and no check was dropped; the suite went 240 s → 47 s.

### The assertion worth reviewing: build conservation

`tests/integration.test.mjs` adds 107 checks that only become possible once all the branches
are in one tree. §1 is the one to read.

**This codebase shipped a build that was correct in source and broken in the artifact five
separate times:**

- the `<style>` splice missed and the artifact shipped with **no CSS** — and because it got
  *smaller*, it passed the size cap;
- the body splice missed the same way;
- `String.replace` honoured `$&` in the replacement and re-inserted a script tag into the
  middle of minified three.js;
- a backtick inside a comment inside a template literal closed the literal and killed first
  paint;
- the word "html" in angle brackets, written in **prose in a source comment**, tripped the
  no-scaffolding assertion on a correct file.

`node --check` passes on every one of those. So does `assertNoCollisions()`. The existing
suite catches each of them — with a check written *after the fact, naming that specific
symptom*: three payload probes, a sha256 of the vendor bundle, a >10 KB floor on the style
block. Those are good checks and they stay. But they are a list of yesterday's accidents, and
the sixth failure will be a splice nobody has thought of yet.

The generic property underneath all five is conservation. `build.js` is a pure inliner: it
reads a fixed set of inputs, applies one documented transform (`flatten()`, which removes
import/export lines), and splices into a shell at four named seams. Therefore **every retained
line of every input must appear, verbatim, in every target that is supposed to carry it.**
That is not a heuristic — it is what "inline" means. Measured here at **3,756 JS lines, 919
CSS lines and 146 shell lines per target**, in about a second, with no browser. A splice that
drops a region fails it; a replacement that corrupts a region fails it; a seam that moves
fails it. None of those had to be predicted. It is deliberately comment-blind — it compares
source lines to output lines and never parses prose — which is the fifth failure above, a
false positive in a test rather than a fault in the artifact. `artifact.html` is held to
dropping *exactly* the 13 lines of document scaffolding, no more and no less.

**Why this was demonstrated rather than asserted.** A plausible new bug planted in
`build.js`'s `flatten()` produces a broken artifact that `build.js` ships with **exit 0**,
that the `guards` suite calls green, that the `units` suite calls green, and that
`build.test.mjs`'s *"rebuilding produces an identical dist"* **passes** — because both sides
of that comparison share the bug. Every pre-existing check compared the builder against
itself. §1.0 and §1.1 go red on all three targets and name the lost lines. §1.6 is the
negative control: a single corrupted stylesheet line is detected and reported by name.

§2 is the runtime half, and the reason it exists rather than being assumed: a page can parse,
satisfy every byte-level assertion in §1, and still paint nothing. It opens all three targets
and requires a state impossible to fake — stylesheet applied *measured off the live cascade*,
not off the presence of a `<style>` tag; app constructed; presenter attached; shell laid out
at a real size. That covers the one failure conservation cannot see: text that survived intact
but landed in the wrong JS context.

§3–§7 are the cross-branch assertions: the aperture in light theme (Royal linework,
translucent layers intact — the one that produces no error and no red test anywhere else), a
real question answered in both themes with the jump chip resolving to a scene that exists and
actually navigating, the theme toggle round-tripping through `localStorage` across a reload
with the aperture coming back up Royal, both presenter backends narrating all twelve scenes,
and zero emoji in any target.

Three fail-open seams were closed in `g1` before any of the brand work landed, each watched
failing first: `dist/artifact.html` was sliced with raw `indexOf()` outside the `splice()`
helper, and `indexOf` answers `−1` rather than throwing — `−1` is a usable offset, so a
`<style>` tag gaining an attribute made the slice **empty** and the artifact shipped with no
CSS at 183,026 B, got smaller, and passed every existing assertion including the cap. That is
exactly what a brand pass trips. `shoot.js` is the only part of the gate that selects on CSS
classes: renaming `.strip-item` returned `[]`, the per-scene loop never ran, **zero**
screenshots were taken, zero overflow checks happened, and it printed "no overflow, no page
errors" and exited 0 — and `shots/` was not cleared between runs, so the printed count could
be met entirely by stale PNGs from the previous run.

## 6. Sizes

| target | bytes | | note |
|---|---|---|---|
| `dist/index.html` | 1,036,359 B | 0.988 MiB | committed; the double-click deliverable |
| `dist/artifact.html` | 1,035,868 B | 0.988 MiB | committed; scaffolding stripped for hosting |
| `dist/index-3d.html` | 11,709,479 B | 11.167 MiB | **not committed** — gitignored, rebuild with `node build.js --3d` |
| `assets/avatar.glb` | 7,381,268 B | 7.04 MiB | 1,007,340 B under the 8 MiB cap |

`dist/index-3d.html` runs **873,433 B (0.833 MiB) under the 12 MiB ceiling** — it is the
avatar base64'd plus the 0.79 MB vendor bundle plus `src/` and the fonts. **Do not raise
`SIZE_LIMIT_MB` to make room.** `tests/build.test.mjs` reads that constant back out of
`build.js`, so raising it raises the test with it and the guard stops guarding; if a future
avatar blows the ceiling the answer is tighter texture compression in the converter.

`dist/index-3d.html` stays out of git on purpose: it is ~10.2 MiB of generated bytes that are
*already* in the repository, twice, in their real form. Committing it would put a third copy
in every clone and a fresh 10 MB blob in history on every avatar tweak.

## 7. Known non-blocking follow-ups

None of these blocks the merge. All are recorded so the next person does not rediscover them.

- **Scene eyebrow numbers contradict the navigator.** Ten of the twelve scenes carry a
  numbered eyebrow (`01 · the proposition` … `10 · next`) while the navigator counts *scene 3
  of 12* … *scene 12 of 12* — every one of the ten is offset by two, because scenes 1 and 2
  are unnumbered. **Pre-existing and byte-identical to `master`**; not touched here because
  renumbering is a content decision, not a brand one.
- **`shoot.js` has never photographed the light theme.** It takes 28 shots at two viewport
  sizes on both builds and every one of them is Midnight. The light theme is covered by the
  gate's DOM and computed-style assertions, but there is no visual record of it at all.
- **`--peach` cannot be used as an avatar token, and it costs Melon on Canvas.** Note the
  rationale that stood here for years was **empirically wrong**: it claimed the `var()`
  indirection fails at runtime, and measured in Chrome 153 against the built file that is
  simply not true — a computed custom property comes back substituted, one hop or two, so
  `--peach` reads `#FFC982` on Midnight and `#FF7E51` on Canvas and `_alpha()` takes either
  apart perfectly well. `color-mix()` is the thing that really does come back unsubstituted.
  The real constraint lives in the **test**: `tests/guards.test.mjs` derives its token list
  from `src/avatar.js`'s own lookups and requires each to be literal hex *where the stylesheet
  declares it*, and `--peach` is declared as `var(--dxc-peach)` / `var(--dxc-melon)` in all
  three theme blocks — so adding a lookup fails exactly three checks (measured, then
  reverted). The thinking hue therefore stays tinted from `--gold`, and the price is written
  down honestly: on Midnight `.34` toward white lands `#FFCA82` against a real Peach of
  `#FFC982`, one step of green, nothing lost; on Canvas `--gold` is DXC Red and `.26` lands
  `#DD7642` against a true Melon of `#FF7E51` — duller by 34 red, 8 green, 15 blue. Fixing it
  properly is a `src/styles.css` change, i.e. a palette decision.
- **`AIB_*` identifiers are deliberately un-renamed** — `window.AIB_CONFIG`,
  `window.AIB_AVATAR_GLB_B64`, `localStorage 'aib-theme'`, `AIB_PLAYWRIGHT`. Renaming
  `AIB_CONFIG` silently invalidates every operator's gitignored `config.js`: no keys, no
  voice, no LLM, **and no error to tell them**. `aib-theme` cold-starts every viewer's saved
  theme. `AIB_AVATAR_GLB_B64` is pinned as a literal payload marker by 9 checks in
  `tests/build.test.mjs`. None of the four is visible to an audience.
- **`docs/AVATAR.md`'s `index-3d.html` size row is a snapshot from `g6`** (11,619,314 B) and
  predates the icon, aperture and rig work; the shipped file is 11,709,479 B. The *ceiling* it
  documents is correct and asserted; only the point-in-time actual has drifted.

Also unswept on purpose: **AIRIS** and **Thinking Airport** are not renamed. AIRIS is the
engine from the source briefing and is where Iris's own name comes from; Thinking Airport is
DXC's vision framing. The rename turns a two-way distinction into a three-way one, so the
knowledge-base entry that exists to separate them now covers the product name too, and
`docs/CONTENT-SOURCES.md` gained a note telling a future brand pass to leave the source
filenames alone — a citation is identified by the name it was filed under, and editing it
makes every claim in that table untraceable.

## 8. Verifying this branch

```
npm ci
node build.js && node build.js --artifact && node build.js --3d

LD_LIBRARY_PATH=$HOME/.local/chromedeps/root/usr/lib/x86_64-linux-gnu node tests/run.mjs
LD_LIBRARY_PATH=$HOME/.local/chromedeps/root/usr/lib/x86_64-linux-gnu node shoot.js
LD_LIBRARY_PATH=$HOME/.local/chromedeps/root/usr/lib/x86_64-linux-gnu node shoot.js --3d
LD_LIBRARY_PATH=$HOME/.local/chromedeps/root/usr/lib/x86_64-linux-gnu node vendor/smoke.cjs
```

The `LD_LIBRARY_PATH` prefix is required for **`tests/run.mjs` as well**, not only for
`shoot.js` — without it every browser-backed suite dies with `Target page, context or browser
has been closed`.

Observed on this branch:

```
322/322 checks passed in 441.1s
gate is green.

shooting dist/index.html — canvas presenter
  [1080p] backend: canvas
  [laptop] backend: canvas
28 shots → shots/*
no overflow, no page errors.

shooting dist/index-3d.html — 3D presenter (TalkingHead)
  [1080p] backend: talkinghead
  [laptop] backend: talkinghead
28 shots → shots/3d-*
no overflow, no page errors.

bundle runs offline from file://, no page errors.
```

Per-suite: `build` 33 · `guards` 45 · `units` 29 · `autoadvance` 22 · `cancel` 31 ·
`offline` 14 · `degrade` 18 · `avatar` 23 · `integration` 107.

`git status` is clean after a full rebuild, which is the check that matters for the two
committed targets: `dist/index.html` and `dist/artifact.html` are byte-identical to what
`build.js` produces from this tree. `dist/index-3d.html` is untracked and ignored.

```
$ sha256sum assets/avatar.glb
70fbdc0efd10b595c7181dc0e4082d8a415e68f6b46d5522ccf73f83d0cf8e35  assets/avatar.glb
```
