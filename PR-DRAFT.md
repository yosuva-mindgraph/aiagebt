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
the 3D ceiling to make room** — if a future avatar blows it, the answer is tighter texture
compression in the converter.

> **Superseded by §12.3, and worth reading as a pair.** The constant named here was
> `SIZE_LIMIT_MB`, a single ceiling shared by all three targets; `g20` split it into
> per-target `SIZE_LIMITS_MB = { canvas: 18, three: 12 }`. This paragraph also warned that
> the test *re-derived* the cap from `build.js`, so raising the constant would raise the
> assertion with it and the guard would stop guarding. That hole was real and is now closed:
> `g22` pins both caps to literal expected values, so moving either one fails the gate.

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

---

## 9. Speech delivery: the script, not the engine

Two further branches, `g11` and `g12`, fast-forwarded onto the tip above. The stack is linear
(`e844798` → `822ab00` → `96a9fca`), so there was nothing to resolve.

This pass changes **narration and three knowledge-base answers only**. Checked mechanically by
importing both revisions of `src/scenes.js`: the twelve scene `id`s, titles, icons and flags are
identical, all twelve `html()` stage markups render byte-identical, and the hedge vocabulary is
an identical multiset. The only numerals that move anywhere in the narration are the three ICAO
annexes, spelled out for the voice (below) — the same annexes, not a different claim.

### 9.1 The voice is robotic because there is no key

`config.js` is gitignored and absent from this tree, so **no ElevenLabs credential is
configured**. `src/voice.js:140` logs `[voice] no ElevenLabs key — narrating with Web Speech`
and every line is spoken by the browser's built-in `speechSynthesis`. That is the engine in the
room today, and it is the least forgiving one available.

Fixing the engine needs a key, and the defaults it would use are themselves unvalidated (§9.6).
This work is the half that needs no key: **the text**. Shorter sentences, a hyphen that tells a
synthesiser to spell rather than pronounce, and symbols expanded into words improve *every*
engine — ElevenLabs included — and they help the `speechSynthesis` fallback most, because it has
the least capacity to recover from input it cannot parse.

Nothing here was listened to. Headless Chromium exposes the `speechSynthesis` API but reports
**0 installed voices** (measured on this branch), so the strings are proven and the sound is not.
That limit is why this is a source fix rather than a tuning pass.

### 9.2 Sentence length

`src/scenes.js`, narration `lines` only.

| | before (`e844798`) | after (`96a9fca`) |
|---|---|---|
| scenes | 12 | 12 |
| narration lines | 61 | 71 |
| sentences | 136 | 184 |
| mean sentence length | 12.9 w | **9.8 w** |
| longest sentence | 41 w | 20 w |
| sentences over 20 w | **29** | **0** |

Measured by importing `SCENES` from both revisions and counting whitespace-separated tokens.
Re-measured excluding free-standing em-dashes as tokens, the means are 12.8 w → 9.7 w and the
longest 40 w → 20 w; **29 → 0 holds under both counts**, as does the 20-word ceiling.

The range is still 1 w … 20 w, so this is varied prose rather than staccato. Every split falls on
a clause boundary that was already in the sentence.

### 9.3 The acronym rule that was actually applied

Acronyms were judged one at a time, not expanded wholesale — the audience is airport executives,
and reading ICAO or AVSEC out in full every time would be condescending and would pad the runtime.
Three classes, only one of which is touched:

1. **Letters that cannot form a sayable syllable** — `ESG`, `KPI`, `DXC`, `CFO`, `SQL`, `CMMS`,
   `PRM`, `BMS`, `ETL`, `LLM`, `CCTV`. Every engine already spells these out correctly, so there
   is nothing to fix. **Left alone.**
2. **Acronyms meant to be said as a word** — `ICAO`, `IGOM`, `AVSEC`, `SCADA`, `FIDS`, `CUSS`,
   `SIEM`, `AIRIS`. Saying them as words is the correct reading. **Left alone.**
3. **Letters that form a word or a plausible syllable**, so the engine confidently says the wrong
   thing out loud. **This is the only class changed.**

`IT` is the case that makes the rule obvious: "the network and IT operations centre" is read as
"the network and *it* operations centre". It becomes `I-T`. Likewise `SLA` → `S-L-A` (else
"slah"), `SOC` → `S-O-C` ("sock"), `ASQ` → `A-S-Q` ("ask"), `ROI` → `R-O-I` ("roy"). A hyphen is
the one cue every engine reads as "spell this".

Verified against the branch: `SQL`, `DXC`, `AI`, `ESG`, `KPI`, `CFO`, `ICAO` and `AVSEC` all
still appear verbatim in the narration — none was expanded.

Two further cases are handled in the narration as **wording** rather than spelling, because a
gloss is what the audience needs on first use: `AOCC` → "the airport operations control centre —
the A-O-C-C", `OT` → "operational technology", `IGOM` → "IGOM, the ground operations manual",
and `ICAO Annex 19 / 17 / 14` → "the annexes of the International Civil Aviation Organization.
Annex nineteen … Annex seventeen … Annex fourteen". `IGOM` keeps its word-reading; only the gloss
is added.

### 9.4 `spokenForm()` normalises the speech; the answer sheet keeps its typography

`src/ask.js` gains a 36-rule normalisation table — 13 symbol/range rules, 18 acronym rules
(16 distinct acronyms, `SLA`/`SLAs` and `API`/`APIs` being singular/plural pairs), and 5 tidy-up
rules. Measured output:

| sheet (displayed) | spoken |
|---|---|
| `a ±72-hour flight horizon` | `a plus or minus 72-hour flight horizon` |
| `paperwork down ~80% today` | `paperwork down around 80 percent today` |
| `70+ dashboards` | `70 or more dashboards` |
| `15-30 minutes` | `15 to 30 minutes` |
| `2D and 3D maps` | `2-D and 3-D maps` |
| `Digital & Cloud` | `Digital and Cloud` |
| `tariff → gross → net` | `tariff, then gross, then net` |
| `one · two · three` | `one. two. three` |
| `editor/viewer` | `editor or viewer` |
| `an alert (raised once) here` | `an alert, raised once, here` |
| `a baggage SLA and two SLAs` | `a baggage S-L-A and two service-level agreements` |
| `SQL, DXC, AI, ESG, KPI, ICAO, IGOM, AVSEC` | *(unchanged)* |

It lives in `src/ask.js` and not in `src/voice.js` deliberately. Scene narration is captioned and
spoken from the *same* string, and `src/app.js` lights the caption word by word **by index**
against the spoken word timings — so a normaliser that changed the word count on the way to the
voice would silently desynchronise the highlight the moment a key is configured. An answer has no
such problem: `app.js` captions `spokenForm(html)` and then speaks `spokenForm(html)`, so caption
and speech are the same tokens either way, and only the rich answer **sheet** keeps the tight
typographic form.

Numbers stay as digits on purpose — every engine reads `72` as "seventy-two". It is the symbols
*around* them that come out as silence or nonsense.

### 9.5 Three knowledge-base answers that read fine and speak wrong

These are content, not symbols: a normaliser rule special-casing them would have been a content
edit in a normaliser's clothes. Fixed in `src/knowledge.js` (38 entries; 3 answer bodies changed,
no `id`, no `scene`, no figure, no hedge).

| id | was | now |
|---|---|---|
| `workflows` | `(deduped while one is open)` | `(raised once, not again while it is open)` |
| `proof` | `two pillars — Digital & Cloud and Data & AI` | `two pillars — one **Digital & Cloud**, one **Data & AI**` |
| `governance` | `ESG reporting (ACI / GRI / Airport Carbon Accreditation)` | `ESG reporting (against ACI, GRI and Airport Carbon Accreditation)` |

- **`deduped`** is a clipping every engine mangles ("dee-doop-ed"). The parenthesis flattens to a
  comma pair on the way to the voice, so the replacement clause has to stand on its own without
  the bracket that made it legible on screen. The suppression window is unchanged.
- **The two pillar names** spoke as four items, and a listener could not recover the grouping.
  Leaving the ampersand alone does not help — engines say "and", or worse, "ampersand". The
  "one … one …" enumerator delimits the two names by ear; the bolding is the display half of the
  same fix. Both pillar names survive intact.
- **`ACI / GRI / ...`** hit the normaliser's slash-as-"or" rule, which is right for `editor/viewer`
  and `flight/FIDS` but simply false here — these are three frameworks you report against
  *collectively*. Fixed in the source rather than by special-casing a sound rule. Spoken output is
  now `ESG reporting, against A-C-I, G-R-I and Airport Carbon Accreditation`.

One deliberate leftover: the stage label at `src/scenes.js:482` still reads
`Open in the operations alert register · deduped while one is open`. That is on-screen diagram
text, never spoken — the same display/speech split that keeps the answer sheet's typography.

### 9.6 Known follow-up: the shipped ElevenLabs defaults are unvalidated

Recorded here alongside §7, and **not blocking** — none of it can execute without a key.

What ships today (`config.example.js:31-36`, defaulted identically at `src/voice.js:145`):

| setting | shipped | status |
|---|---|---|
| `modelId` | `eleven_turbo_v2_5` | reported **deprecated**; not verifiable from this tree |
| `stability` | `0.42` | below the **0.65–0.75** range researched for measured corporate delivery |
| `style` | *unset* | absent from `voice_settings`; should be explicitly `0` |
| `similarity` | `0.80` | not in question |

Low stability buys expressiveness at the cost of consistency, which is the wrong trade for a
narrator reading the same deck to a board every time. None of these three has been validated
against a live voice, because no key exists in this tree to validate them with.

**The open question is the model, and it is not cosmetic.** `src/voice.js:157` calls
`/v1/text-to-speech/{voiceId}/with-timestamps?output_format=mp3_44100_128`. That endpoint returns
the MP3 as `audio_base64` *plus* a character alignment; `wordsFromAlignment()` converts
`character_start_times_seconds` / `character_end_times_seconds` into `words` / `wtimes` /
`wdurations`, and `src/avatar3d.js:483` hands those to TalkingHead's `speakAudio()`. That chain
**is** the word-accurate lip-sync in the 3D build.

**It is unconfirmed whether Eleven v3 serves `/with-timestamps` at all.** If it does not, the
failure is graceful but real: `src/avatar3d.js:456` falls back to
`wordTimingsFromText(text, durationMs)`, which *estimates* word timings by distributing the clip
duration across the text. The mouth keeps moving and stays roughly in sync, but it is no longer
driven by the measured audio. Moving to v3 for its expressiveness would therefore trade
word-accurate lip-sync for estimated lip-sync — possibly for nothing, possibly for a lot.
**Answer the endpoint question before changing `modelId`.** It needs a key; it does not need a
code change.

### 9.7 Sizes and gate at this tip

The §6 figures were measured at the rebrand tip (`e844798`) and are superseded by these; the
speech work adds **+5,085 B** to each of the three targets, all of it narration and answer text.

| target | bytes | | vs §6 |
|---|---|---|---|
| `dist/index.html` | 1,041,444 B | 0.993 MiB | +5,085 B |
| `dist/artifact.html` | 1,040,953 B | 0.993 MiB | +5,085 B |
| `dist/index-3d.html` | 11,714,564 B | 11.172 MiB | +5,085 B |
| `assets/avatar.glb` | 7,381,268 B | 7.04 MiB | unchanged |

`dist/index-3d.html` now runs **868,348 B (0.828 MiB) under the 12 MiB ceiling**, down from
873,433 B. The avatar is untouched — still `Hispanic_F_3_Busi`,
`70fbdc0efd10b595c7181dc0e4082d8a415e68f6b46d5522ccf73f83d0cf8e35`, 7,381,268 B.

Gate on this tip: **322/322 green in 455.1 s**. `shoot.js` 28 shots / 12 scenes on `canvas`;
`shoot.js --3d` 28 shots reporting `backend: talkinghead` at both viewport sizes;
`vendor/smoke.cjs` clean offline from `file://`. `git status` is clean after a full rebuild, so
the two committed targets are byte-identical to what `build.js` produces from this tree, and
`dist/index-3d.html` remains untracked and ignored.

---

## 10. Pre-rendered voice, unquantified claims, and a container

This pass integrates four branches onto `matron/integration-intelligent-airport`, merged in
dependency order: `g14-prerender-backend` → `g15-noclaims-frontend` → `g16-docker-backend` →
`g17-effortsplit-frontend`. Voice first, deliberately: `g15` and `g17` edit narration lines, and
the clip-keying has to exist before those edits land or there is nothing for the fallback to be
measured against.

All four merged cleanly except `dist/*.html`, which conflicted on `g15` and was resolved the only
way a built file should be — **take one side, then rebuild**. No built file was hand-merged.

### 10.1 Iris has a real voice, and it is in the file

`tools/prerender-voice.mjs` renders every spoken line ONCE, at a desk, with a key nobody ships,
and bakes the result into the canvas targets as base64. The runtime needs no key, no account and
no network, which is what makes it work in the three places a live API never could: the booth pod
with the network unplugged, the emailed file, and `dist/artifact.html`, whose CSP as a published
Artifact has always denied an outbound call.

**The endpoint question left open in §9.6 is now answered, empirically.** `eleven_v3` *does*
serve `/with-timestamps`: all **115** clips in the cache came back with a usable character
alignment, and the gate measures **72/72 clips carrying word timings, 72/72 tokenising exactly as
the caption does**. The trade §9.6 worried about — expressiveness bought with estimated rather
than measured lip-sync — does not have to be made. Settings as shipped: `eleven_v3`,
`mp3_22050_32`, stability `0.70`, similarity `0.80`, style `0`, speaker boost on; the low-stability
default §9.6 flagged is gone.

A full narration render is **~2 minutes**, not an afternoon: the original 66-clip run took
**96.7 s** wall at concurrency 3, and 72 clips extrapolates to a little under two minutes.

**Clips are addressed by a hash of the exact spoken string, not by scene id and line index**, and
this is the load-bearing design decision rather than an implementation detail. Under id-and-index
keying an edited line keeps its old clip: the caption reads the new sentence while the room hears
the old one, with nothing red anywhere — a deck confidently saying something nobody wrote. Under
text keying an edited line simply has no clip, misses, and falls back to the voice this deck has
always had. The gate asserts both halves (`§3.5`): the edited line misses, and **6/6 of its
unedited neighbours still hit**, so invalidation is per LINE and not per scene.

That property paid for itself twice in this pass. `g15` changed one narration line and the
re-render called the API **once**; `g17` changed three and it called the API **three times**, with
the other 69 coming straight from `.voice-cache/`.

### 10.2 The numbers a prospect could hold us to are gone

`g15` and `g17` remove every quantified benefit or outcome claim from the script and the
knowledge base, and replace it with the qualitative form plus a pointer to where a real number
comes from.

| removed | now reads | where |
|---|---|---|
| "roughly eighty percent of analyst time gets handed back" | "analyst time gets handed back. They stop running other people's reports." | scene 6 `ask`, `kb assistant` |
| "~25% faster / ~35% CX uplift / paperwork down ~80%" | "complaint response times and customer-experience scores both improved" | scene 11 `deploy`, `kb proof` |
| "double-digit utility-cost reduction with payback in months" | "depends on your tariffs, your climate and how your plant runs today" | `kb energy` |
| indicative ROI range | "I am not going to quote you one" | scene 3 `proposition`, `kb roi` |
| "~85% pre-built / ~15% tailored" | "most of what you deploy already exists and is proven" | scene 11 `deploy`, `kb onboarding`, `kb cost-price` |

**The reason is not squeamishness.** Every one of these varies per airport — traffic mix, cost
base, tariffs, how much is already automated, whether it is a new terminal or a brownfield
consolidation — and the source documents *already said so*. The deck was quoting another airport's
measurement as though it were a forecast of the listener's. The replacement is not vaguer, it is
more honest about the same fact, and it routes every one of them to the baseline assessment, which
is where the airport's own number was always going to come from.

The `~85/15` split was kept in `g15` and removed in `g17`. Keeping it was the wrong call — it is
the clearest case in the deck of a number that varies per airport — and `g15`'s commit message
overstated the confirmation behind that judgement. `g17` corrects both.

**Deliberately kept:** everything about *architecture* and everything about *track record*. Fifteen
services in production across five airports, twelve AI systems, 70+ dashboards, 8 departments,
16+ automation bots, the ±72-hour flight horizon, the IDC Future Enterprise Award 2023. Those are
things that happened, not outcomes promised to a listener, and scene 11 now says so in as many
words: *"Those were measured at those airports — yours would be measured at yours."*

### 10.3 The deck as a container

`g16` adds a multi-stage `Dockerfile` that serves the canvas build over nginx, with four
independent guards against the key ever reaching the image — a context audit that fails if
`config.js` is in the build context at all, a `COPY` allowlist that structurally cannot admit it,
`--no-config` on the build, and a `grep` over the *built artifact* rather than over its inputs.
The final image carries the deck, its `.gz`, and nothing else: **no node binary, no `node_modules`,
no source**. Verified on `aib-deck:final`: `0` matches for `config.js` anywhere in the filesystem,
`0` matches for an `sk_`/`sk-ant-` key shape in the served deck.

### 10.4 Sizes at this tip

The tracked pair is **UNVOICED** and stays that way. `g14` committed them carrying the 4.4 MB
speech payload; that is regenerable output that goes stale the moment a line changes — precisely
the argument `.gitignore` already makes for `assets/voice-clips.js` and `dist/index-3d.html`.

| target | bytes | | tracked? | voice |
|---|---|---|---|---|
| `dist/index.html` | 1,071,628 B | 1.02 MB | **yes** | no |
| `dist/artifact.html` | 1,071,137 B | 1.02 MB | **yes** | no |
| `dist/index.html` (voiced) | 5,684,530 B | 5.42 MB | no — generated | 72 clips, 14.2 min |
| `dist/artifact.html` (voiced) | 5,684,039 B | 5.42 MB | no — generated | 72 clips, 14.2 min |
| `dist/index-3d.html` | 11,744,748 B | 11.20 MB | no — gitignored | none, by design |
| `assets/voice-clips.js` | 4,612,882 B | 4.40 MB | no — gitignored | — |
| `aib-deck:final` image | — | **38.4 MB** | — | see §10.5 |

`dist/index-3d.html` is **byte-identical with and without `--no-voice`**
(`ad036999…8cbd4bd8e6` either way), which is the 3D target's "no flag can give this speech" rule
holding in practice rather than in a comment.

### 10.5 Two things that need a decision, not a patch

**(a) `assets/voice-clips.js` is not in `.dockerignore`, so the image size depends on untracked
local state.** The `Dockerfile` builds with `--no-config` but not `--no-voice`, and `assets/` is
copied wholesale into the builder. Measured, on one tree, changing nothing but whether the
generated clips file is present:

| build context | served `index.html` | image |
|---|---|---|
| with `assets/voice-clips.js` | 5,684,530 B | **38.4 MB** |
| without it | 1,071,628 B | **23.6 MB** |

Both builds are green and both pass every key guard; `23.6 MB` is what `g16` measured on its own
branch, where the clips file did not exist yet. This is the *same* objection `.dockerignore`
already makes, in writing, about `dist/`: *"An image that can quietly ship whatever happened to be
sitting in dist/ on the packager's laptop is not reproducible from source, it just looks like it
is."* The clips file is now a second instance of exactly that. Either the container ships the
voice on purpose (add nothing, restate the size, and the build stops being reproducible without
the cache) or it does not (one line in `.dockerignore`, or `--no-voice` in the `RUN`). **Left
untouched — this is a product decision about what the container is, not a merge conflict.**

**(b) The voiced and unvoiced builds write to the SAME two paths**, so the voiced outputs cannot be
gitignored the way `dist/index-3d.html` is. `git status` is clean after `node build.js --no-voice
--3d --artifact`, and *dirty* after `node build.js --artifact` or after `node tests/run.mjs` —
which builds voiced whenever the clips file exists, and must, because that is the build the voice
suite tests. Today that is a footgun handled by knowing about it. If the tracked pair is to stay
unvoiced permanently, the voiced targets want their own filenames.

The voiced pair for publication has been preserved outside the repository at
`/home/mindgraph1/projects/aib-presenter-voiced/`, and regenerates in about a second with
`node build.js --artifact`.

### 10.6 Gate at this tip

**359/359 green in 564.7 s**, measured against the voiced build.

| target | chars scanned by the gate | bytes on disk |
|---|---|---|
| `dist/index.html` | 5,672,908 | 5,684,530 |
| `dist/artifact.html` | 5,672,419 | 5,684,039 |
| `dist/index-3d.html` | 11,733,154 | 11,744,748 |

The ~11.6 KB gap between the two columns is **not a stale build** — it is multi-byte UTF-8 (em
dashes, curly quotes, `±`) counted once as characters and once as bytes. Both columns describe the
same three files, `sha256` verified.

Also green on this tree: `shoot.js` 28 shots / 12 scenes on `canvas`; `shoot.js --3d` 28 shots
reporting `backend: talkinghead` at both viewports; `vendor/smoke.cjs` clean offline from `file://`
with 15/15 visemes and 52/52 required bones. A separate probe pointed at `dist/artifact.html`
confirms the **voiced artifact plays real audio from `file://` with zero external requests** —
rms `0.1198`, peak `0.720`, 626/692 analyser frames over 0.05, `external === []`. `git grep -E
'sk_[A-Za-z0-9]{40,}'` matches nothing in any tracked file.

### 10.7 Known non-blocking follow-ups

Added to §7.

1. **The canvas caption has no word-by-word highlight, and now visibly leaves something on the
   table.** `src/app.js:343 _word()` is driven by TalkingHead's `onsubtitles`; the canvas backend
   has no word clock and never calls it, so the caption is one static, fully-lit line. That was a
   fair trade when there were no timings. There are now: every clip ships `words`/`wtimes`/
   `wdurations`, and the gate measures **72/72 tokenising exactly as the caption splits** — i.e.
   the highlight could be driven by index, today, on the target that actually goes out. The data
   is in the file and unused.

2. **The 39 knowledge-base answers are rendered and cached but not packed.** They are in
   `.voice-cache/` — 39 clips, 7.56 MB of MP3, 32.9 minutes — and the shipped payload is
   `scope narration`, so an answer falls back to Web Speech exactly as it always has. The gate
   asserts this is a decision rather than a bug (`§2.2`, *"39 string(s) deliberately unvoiced"*).
   `--scope all` packs them: measured today that is **13.78 MB** of canvas target with 6 answers
   still uncached, and **~15.3 MB** once those 6 are rendered — against a 12 MB ceiling. Six
   answers are stale (`assistant`, `proof`, `roi`, `energy` from `g15`; `onboarding`,
   `cost-price` from `g17`) and would cost 6 API calls, not 39.

3. **Scene 11's track-record note lost force.** "Complaint response times and customer-experience
   scores both improved" is true and unfalsifiable and lands softer than the figures it replaced.
   The figures themselves were never the problem — presenting another airport's measurement as an
   unattributed general claim was. Restoring them attributed to a named airport and year would put
   the force back without putting a number in the listener's hands that they could hold us to.

4. **`.bars` / `.bar` in `src/styles.css` is now dead CSS.** Scene 11's effort-split bar chart was
   its only consumer and `g17` replaced it with an `icard` pair. Left in place deliberately: it is
   harmless, and an unrelated edit does not belong in the tree the final gate measured.

---

## 11. No figures anywhere: the deployment-shape counts and the proof strip

`g18-noshapecounts-frontend` (two commits, `1cea452` then `6e04148`) merged clean onto
`c345be5` — no conflict, `dist/` deliberately not committed on the branch and regenerated here.

This is the **third** correction in the same direction. §10.2 recorded `g15` removing quantified
*outcomes* and `g17` removing the `~85/~15` split, and it recorded that architecture and track
record were *"deliberately kept"*. The operator has now rejected both of those categories too:
first the platform-shape counts (58 canonical entities, 201 governed KPIs, 21 mapped sources, five
control centres, eleven playbooks, six agents, three ML models), then scene 11's entire
track-record strip and the last surviving figure, the `15–30 minutes` prediction horizon in
`kb passenger-flow`.

**The pattern is worth naming, because it is the useful finding here.** Each pass removed numbers
a previous pass had explicitly decided to keep, and the reasoning that protected them each time —
*"that is architecture, not an outcome"*, *"that is a platform property, not an airport's"* — did
not survive contact with the operator. The stable rule turned out to be simpler and blunter than
any of the three passes guessed: **a figure on screen is a figure the room can hold us to,
regardless of what class we think it belongs to.** Anything numeric in this deck should be
treated as removed-by-default rather than as agreed, and §11.4 lists what is still there.

### 11.1 What replaced the counts

Nothing was left blank and nothing points at an absence, which is the part worth reviewing:

- Scene 4's three-stage pipeline read `21 / 58 / 201`; it now reads **Every / One / Once** —
  which, read across, is the scene's own `h1`: *every source, one model, one definition*.
- Scene 1's opening `.metrics` strip dropped three airport-varying counts and now carries three
  platform invariants — **1 governed model · 0 systems replaced · ∞ things you can build** — all
  three human-flagged, so the strip is uniform rather than two figures and an orphan.
- `kb data-model`, `kb sources`, `kb dashboards` and `kb passenger-flow` gained an explicit
  paragraph saying *why* there is no number, each pointing at the baseline assessment — the same
  move scene 3's ROI note and scene 12's Baseline card already made.
- `kb proof` was rewritten around a **reference call plus a baseline** — *"proof you can check,
  rather than proof you have to take"* — which is a stronger answer than the strip it replaces.
- Scene 11 now **ends where its narration ends**. The track-record section was never narrated, so
  the scene previously ran on for two silent sections past its last spoken line.

`docs/CONTENT-SOURCES.md` keeps every citation and moves the figures into the *source* column, so
the provenance survives without the claim. That is the right call: a reader who cannot see where a
count came from is a reader who helpfully puts it back.

### 11.2 Re-render: 4 clips

`g18` invalidated 14 clips — 4 narration lines (scene 4 `data` idx 2, scene 5 `model` idx 1,
scene 8 `live` idx 6, scene 9 `agents` idx 3) and 10 knowledge answers. At the shipped
`narration` scope that is **4 API calls**; the 10 answers are not packed. The other 68 came
straight from `.voice-cache/`. Narration line count is 72 before and after, so no index shifted
and scene 8's `onLine(2)` hook is unaffected.

### 11.3 Gate and sizes

**359/359 green in 571.8 s.** No `browserType.launch` contention signature.

| target | chars (gate) | bytes on disk | sha256 |
|---|---|---|---|
| `dist/index.html` voiced | 5,658,123 | **5,669,764** | `d055c53b…` |
| `dist/artifact.html` voiced | 5,657,634 | **5,669,273** | `5e81adec…` |
| `dist/index-3d.html` | 11,736,765 | **11,748,378** | — |
| `dist/index.html` tracked, unvoiced | — | **1,075,258** | — |
| `dist/artifact.html` tracked, unvoiced | — | **1,074,767** | — |
| `assets/voice-clips.js` | — | 4,594,486 | 72 clips · 14.1 min |
| `aib-deck:final` | — | **38.4 MB** | serves the 5,669,764 B voiced deck |

The ~11.6 KB char/byte delta is multi-byte UTF-8, as in §10.6 — the same three files in both
columns.

`shoot.js` and `vendor/smoke.cjs` were green at §10.6 and neither is affected by a text-only
change. Docker context audit on `aib-deck:final`: **0** `config.js` anywhere in the image, **0**
`sk_`/`sk-ant-` matches in the served deck, `apiKey` present only as an identifier in the
config-*reading* code and never assigned a literal, no node binary, document root is the deck and
its `.gz` and nothing else.

### 11.4 Figures that SURVIVED, and are suspect rather than agreed

Per the rule in §11, these are reported and **not acted on**. None is an outcome or benefit claim;
all are structure counts of the same class `g18` was removing, and for the first four the
corresponding `docs/CONTENT-SOURCES.md` row was *not* updated while its siblings were — which
suggests they were missed rather than decided.

| # | figure | where | note |
|---|---|---|---|
| 1 | "**Nine** subdomains: flight/FIDS, cargo, baggage…" | `src/knowledge.js:151`, `kb control-centres` | The strongest case. `g18` edited *this entry*, changing "Five control centres are modelled" to "The control centres modelled today" — and left a count six lines below it. |
| 2 | "The same **seven-stage** shape runs a baggage SLA watch…" | `src/scenes.js:541`, scene 8 on-screen | Counts the workflow diagram's stages — same class as the removed "eleven playbooks". |
| 3 | "Revenue Management is **three** applications" | `src/knowledge.js:539`, `kb revenue` | Same class as the removed "six agents" / "three ML models". |
| 4 | "one of the **five** things in the navigation" | `src/scenes.js:659` (**spoken**), `src/knowledge.js:330` | Counts the product's own nav, so the weakest case — but its `CONTENT-SOURCES.md` row ("Five areas: …") is the one row in Platform structure left unrevised. Fixing this one costs a clip re-render; the other three do not. |
| 5 | `1` / `0` / `∞` in scene 1's `.metrics` | `src/scenes.js:205` | **Deliberate and documented** — platform invariants, not estate counts. Recorded only because they are still digits in the same visual object the removed counts sat in, so a reader applying the blunt rule will ask. |

### 11.5 The retracted figures still ship inside the artifact's source comments

`build.js` inlines `src/*.js` verbatim, comments included — it always has. `g18` documented its
removals in long block comments *in the files that get inlined*, quoting what went. So **View
Source on the published artifact shows every number the operator ordered removed**, with
attribution:

> `58 canonical entities` · `201 governed KPIs` · `21 / 58 / 201` · `15 services` · `5 airports` ·
> `12 AI systems` · `16+ bots` · `8 departments` · `zero paper contracts`

Not on screen, not spoken, not in the caption — but in the file that gets handed to a prospect,
and findable with Ctrl-F. Given that the stated reason for the removals is that a prospect could
hold us to these numbers, this is worth a decision. **Not acted on** — stripping comments from the
build is a change to `build.js`'s contract, and editing another branch's comments is not
integration work.

### 11.6 Carried forward from §10.5, still open, still not acted on

1. **`assets/voice-clips.js` is not in `.dockerignore`**, so the image's size and audio behaviour
   depend on untracked local state: 38.4 MB serving a voiced deck here, 23.6 MB serving a silent
   one on a clone. Unchanged this pass.
2. **The voiced and unvoiced builds share filenames**, so the voiced targets cannot be gitignored.
   `git status` is clean after `node build.js --no-voice --3d --artifact` and dirty after
   `node tests/run.mjs`. Unchanged this pass.

Also still open from §10.7: the canvas caption has no word-by-word highlight despite shipping
72/72 exactly-tokenising timings; the 39 knowledge answers are cached but unpacked; and
`.bars` / `.bar` in `src/styles.css` is dead CSS — its only consumer was scene 11's effort-split
bar chart, removed in `g17`, and a fresh grep over `src/` after `g18` still finds no `class="bar"`
or `class="bars"` anywhere.

---

## 12. Host-and-run: every spoken string pre-rendered, and the container that needs no key

Four branches: `g19-figureleak-frontend`, `g20-allscope-backend`, `g21-spokenfield-backend`,
`g22-testfix-backend`. All merged clean. `g20` and `g21` were **siblings, not a chain** — `g20`
branched from `d5c36e0` (before `g19`) and `g21` from `4288cb4` (after it) — but they have **zero
file overlap**, so R4 held and `g19`'s work survived the `g20` merge untouched (verified: empty
diff across the four files `g20` branched behind).

This pass makes the container **host-and-run**: deploy it, and every string the deck can speak is
already in the file, in the real voice, with no credential anywhere in the image.

### 12.1 `--scope all` is not what "everything the deck speaks" meant

§10.7 and §11.6 recorded the 39 knowledge answers as "cached but not packed", and said
`--scope all` packs them and closes the gap. **That was wrong, and the way it was wrong is the
interesting part.** `Ask.answer()` returns three shapes of HTML and the prerenderer only ever
produced one of them:

- `DONT_KNOW` (`src/knowledge.js`) sits **outside** the `KB` array, so no scope value reached it.
- The blended answer (`src/ask.js`) is `top.e.a + runner-up`, a runtime concatenation that is
  never any single entry's string — so `voiceClipKey()` misses and it falls through to
  `speechSynthesis`.

Backend measured it over 1,400 realistic queries through the real no-LLM path: 1,219 hits, but
**105 blends and 76 don't-knows spoke in the robotic voice**. The blend set is combinatorial — up
to 1,482 ordered pairs from 39 entries — so it could not have been pre-rendered at any scope.

**My verification shared the blind spot exactly, and so did the gate's.** I checked the packed
payload against the `KB` array; `DONT_KNOW` is not in `KB`, and a blend is not an array member, so
neither the `§2.1` coverage assertion nor my own reading could see either. An array-membership
test cannot discover a string that is built at runtime.

`g21`'s fix decouples what is **spoken** from what is **displayed**: `Ask.answer()` gains a
`spoken` field, the sheet keeps the blend, and only `spokenForm(top.e.a)` is ever spoken. That
collapses 1,482 possible strings to 39 already-rendered ones. `src/app.js` speaks `spoken` rather
than re-deriving it from `html` — deliberately, because re-deriving would restore the exact bug.

### 12.2 The render, and the silent-failure hole closed

`--scope all`: **20 clips rendered in 133.6 s, 92 from cache. 112/112 packed** — 72 narration, 39
answers, `DONT_KNOW` — **11.33 MB of MP3, 49.3 minutes of speech**, 15.20 MB as base64.

§10.5(a) recorded that a packager with a stale narration-scope clips file got a green build that
answered every question robotically, with nothing anywhere complaining. `g20`'s `--require-voice`
closes it, and the `Dockerfile` now builds `--no-config --require-voice`. **All three refusals
verified individually:**

| condition | result |
|---|---|
| `--no-voice --require-voice` | exit 1 — "contradict each other" |
| clips file absent | exit 1 — names the render command |
| payload present but `scope !== 'all'` | exit 1 — *"answers every question in the robotic one — which looks correct right up until somebody asks something"* |

That also resolves §10.5(a)'s *other* half in a definite direction: the image's contents no longer
vary silently with untracked local state, because the build now **fails** rather than quietly
shipping a lesser deck. §10.5(b) is unchanged — voiced and unvoiced still share filenames, so the
tracked pair is still `--no-voice` and `node tests/run.mjs` still leaves `dist/` voiced.

### 12.3 The gate went red first, and both failures were fixtures

The first run of this cycle was **380/385**. Neither failure was a product defect and neither was
environmental — they were deterministic assertion failures, with no `browserType.launch` error in
the run, on a box where the browser canary passed in 8.5 s.

- **4 × `voice` §1.3** — `g20` renamed `SIZE_LIMIT_MB` → `SIZE_LIMITS_MB`, updated
  `tests/build.test.mjs`, and left `tests/voice.test.mjs` matching the old name → `NaN` → one root
  cause, four symptoms. Present on `g20`'s own branch; not a merge artifact.
- **1 × `guards`** — `g21` added `spoken` to `Ask.answer()`; the `pin()` stub in
  `tests/guards.test.mjs` still returned four fields, so `src/app.js`'s `spoken.length` threw
  inside a deliberately-unawaited `handleAsk()`. Three `pin()` call sites, three identical
  `TypeError`s, none naming the cause.

**This was the third time a test fixture's private copy of a contract had drifted from the real
one** — the voice suite's parallel corpus omitting `DONT_KNOW` was the first, found by inspection;
these two were the second and third. `g22` fixes both by **deriving rather than duplicating**: the
stub now builds `spoken` from the same `spokenForm()` `src/ask.js` uses, and a new `check()`
asserts the stub's key set against the real `Ask.answer()`'s *before* anything is pinned — so the
next contract change fails by name instead of by `TypeError`.

`g22` also rewrote §1.3 rather than renaming it. The old assertion's claim — "the speech did not
raise the ceiling" — is **false by design** now that the canvas cap is deliberately 18 MB, and
making it pass would have been the wrong repair. Both caps are pinned to their declared literals,
which is the property worth defending: a cap re-derived from whatever the file contains passes for
any number at all. That closes the hazard §6 flagged and could only warn about.

A note on where this was caught: Backend could not run either browser suite — its sandbox cannot
launch Chrome at all — so it replicated both suites' assertion logic in Node, 16/16, with two
non-circular controls. That is good evidence and it is not the suites running; the green below is
a real browser.

### 12.4 Gate and sizes

**388/388 green in 562.5 s.** (388, not 385 — `g22`'s §1.3 rewrite adds three assertions.) Eleven
suites including `g21`'s new pure-Node `ask` suite at 13/13.

| target | chars (gate) | **bytes on disk** | cap | headroom |
|---|---|---|---|---|
| `dist/index.html` voiced | 17,005,779 | **17,017,616** | 18 MB | 1.77 MB |
| `dist/artifact.html` voiced | 17,005,290 | **17,017,125** | 18 MB | 1.77 MB |
| `dist/index-3d.html` | 11,741,746 | **11,753,411** | 12 MB | 0.79 MB |
| `dist/index.html` tracked, unvoiced | — | **1,080,291** | — | — |
| `dist/artifact.html` tracked, unvoiced | — | **1,079,800** | — | — |
| `assets/voice-clips.js` | — | 15,937,305 | — | 112 clips · 49.3 min |

The ~11.7 KB char/byte delta is multi-byte UTF-8, as in §10.6 and §11.3. `--scope all` costs the
3D target nothing — it does not carry the speech and there is no flag to give it any — so its
headroom is unchanged.

### 12.5 The container

**`aib-deck:final` — 74.9 MB.** It stores the 17.0 MB page *and* its 12.4 MB precompressed copy;
base64 audio only compresses ~27%, which is why it is 74.9 and not the ~48 MB a naive estimate
gives. Verified serving: `healthz` ok, 17,017,616 B plain, **12,447,702 B with
`content-encoding: gzip`** off the precompressed layer.

Audit on the image itself: **0** `config.js` anywhere in the filesystem, **0** `sk_`/`sk-ant-`
matches in the served deck, **0** literal assignments to `apiKey`, no node binary, no `/build`
tree, document root is the deck and its `.gz` and nothing else, and the voice payload is present.

**Planted-key test.** Planting a fake `config.js` alone proves nothing — `.dockerignore` excludes
it and the audit correctly sees an empty context. The test that means something plants the key
**and** simulates the `.dockerignore` regression the audit exists to catch. Done: the build
**refused at the context-audit stage, exit 1, no image produced**, and both files were restored.
That is guard 0 demonstrated doing the one job no other guard can do, since `.dockerignore` is by
definition invisible to anything that only sees what `.dockerignore` let through.

Deliverables in `/home/mindgraph1/projects/aib-presenter-voiced/`:

| file | bytes | sha256 |
|---|---|---|
| `aib-deck-final.tar.gz` | **30,576,427** | `db802084871b20b78d41b061a2d98f2705323faa7e4af54e48adccc9e2b61ec5` |
| `artifact.html` | 17,017,125 | `f9e87d0adf38efef73774dbfb841284bf02d4123930c206723bde5821407ed84` |
| `index.html` | 17,017,616 | `10beea75c0e9fd2f69cf5e2239d2a2ffd48d324defa4e827246eb7a1e0808f1d` |

`gzip -t` clean, 23 tar entries, manifest readable.

### 12.6 Still open

1. **§10.5(b) — voiced and unvoiced share filenames.** Unchanged. The tracked pair is built
   `--no-voice`; `node tests/run.mjs` leaves `dist/` voiced. Separate filenames would end it.
2. **§10.7(1) — the canvas caption has no word-by-word highlight.** Now more pointed: all 112
   clips carry word timings, and at `--scope all` that includes every answer, so the data to light
   a caption by index exists for every string the deck can speak and is used for none of them on
   the target that ships.
3. **§11.4(5) — `1` / `0` / `∞` in scene 1's `.metrics`.** Deliberate platform invariants, still
   the only digits left in the walkthrough.
4. **`.bars` / `.bar` in `src/styles.css` is dead CSS.** Last consumer went in `g17`.

---

## 13. Questions beyond the briefing: a key-holding proxy, and a deck that ships none

Four branches, merged in QA's order: `proxy-backend` (t1), `endpoint-frontend` (t2),
`publicconfig-flow` (t3), `proxy-qa` (t4). **Path scopes verified disjoint before merging** — no
file is touched by two branches — so R3 allowed the straight sequence and all four merged with
zero conflicts.

The deck can now answer questions *past* the 39 curated facts and speak them. A companion
`aib-proxy` container holds the Anthropic and ElevenLabs credentials server-side; nginx routes
same-origin `/api/llm` and `/api/tts` to it. **The artifact ships no credential of any kind** —
`--public-config` splices `config.public.js`, which contains two relative paths and nothing else.

There are now three distinct deployments rather than a quality ladder:

| build | config | what it is |
|---|---|---|
| `build.js` | `config.js` | key in the page — a laptop on a stand you own |
| `build.js --no-config` | none | no network at all — emailed file, booth stick, air-gapped venue |
| `build.js --public-config` | `config.public.js` | same-origin proxy — the public URL, live voice and LLM, no credential in the artifact |

### 13.1 The no_ship that made this correct, and why it was not about money

QA's first pass failed it. `src/ask.js` gated on `hasLLM` alone and never read the `grounded`
value computed a line above, so with an endpoint configured **every** question went to the model:
39 knowledge-base questions produced 78 paid calls and **0/39** returned the curated text.

The cost was the visible symptom; the governance failure was the real one. `src/knowledge.js`
carries the never-quote-a-price rule, the no-quantified-outcomes rewrites of §11 and §12, and the
"I am not going to quote you one" answers — and **those rules hold only while the text is fixed.**
A model paraphrasing them is a model free to re-derive a number the operator spent three passes
removing. §11 recorded the rule as *"a figure on screen is one the room can hold us to"*; a
rephrasing layer over the briefing would have quietly reopened it.

The fix inverts the gate: `src/ask.js:178` returns the curated answer **before** `hasLLM` is
consulted at `:194`, so a grounded question cannot reach the model whatever the config says. Now
0 calls and 39/39 curated. Only sub-floor questions cost a round trip. `via` gained a fourth
value, `llm-unbriefed`, for the case where the model answered with nothing relevant to draw on —
and it does not trip `guards.test.mjs`, because `g22` made that check pin the **key set** rather
than the values. A fixture fixed two cycles ago paying off here is worth noting.

### 13.2 Gate

**445/445 green in 696.1 s**, matching QA's figure exactly — baseline 388 plus 57 new checks, no
pre-existing suite's count changed. Twelve suites; the new `proxy` suite is 50 checks in 120.8 s.

Setup matters and was done first: `npm ci`, `assets/voice-clips.js` (15,937,305 B) and
`.voice-cache/` (139 clips) present, `LD_LIBRARY_PATH` set. Browser canary green before the run.
The `avatar` and `voice §0` failures that have been reported around this repo are that setup
missing, not code.

| target | chars (gate) | **bytes on disk** | cap |
|---|---|---|---|
| `dist/index.html` voiced, no-config | 17,019,677 | **17,032,050** | 18 MB |
| `dist/artifact.html` voiced, no-config | 17,019,188 | **17,031,559** | 18 MB |
| `dist/index-3d.html` | 11,755,644 | **11,767,845** | 12 MB |
| `dist/index.html` **`--public-config`** | — | **17,039,451** | 18 MB |
| `dist/index.html` tracked, unvoiced | — | **1,094,725** | — |
| `dist/artifact.html` tracked, unvoiced | — | **1,094,234** | — |

Zero API calls this cycle — the cache is complete at all scope.

### 13.3 The two images, and the guards proved by firing them

| image | size | serves |
|---|---|---|
| `aib-deck:proxy` | **75 MB** | 17,039,451 B page + 12,455,406 B precompressed |
| `aib-proxy:final` | **242 MB** | the two keyless routes |

`aib-deck:proxy` audit: **0** `config.js`, **0** `.env`, **0** key-shaped strings in the served
deck, **0** literal `apiKey` assignments, both `/api/` endpoints present, voice payload present,
no node binary, document root is the deck and its `.gz`.

`aib-proxy:final`: **refuses to start** without `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY` and
`ELEVENLABS_VOICE_ID` — exit 1, naming the missing variables. No key-shaped string anywhere in the
image, no `.env`, no credential in its environment, runs as non-root `node`. The model is pinned
to `claude-sonnet-5` server-side and a client-supplied `model` is discarded, which is the property
that matters on an unauthenticated endpoint.

**Planted-secret tests — three, because there are now two audit stages.** Planting a fake
`config.js` alone proves nothing: `.dockerignore` excludes it and the audit correctly sees an empty
context. So:

| test | expected | result |
|---|---|---|
| fake `config.js` **+** the `config.js` line removed from `.dockerignore` | refuse | **exit 1, no image** |
| fake `.env` (deliberately *not* in `.dockerignore`, so the audit can fire) | refuse | **exit 1, no image** |
| `.env.example` present | **allow** — a guard that cries wolf gets deleted | **exit 0, image built** |

Fake keys only; the real key never left its own worktree. Both files restored, tree clean.
`assertPublicConfigClean()` is exercised by the gate itself at `proxy` §1.4–§1.6, including a key
that appears **only in a comment** — which matters because this file is inlined verbatim.

### 13.4 Deliverables

`/home/mindgraph1/projects/aib-presenter-voiced/`

| file | bytes | sha256 |
|---|---|---|
| `aib-deck-proxy.tar.gz` | **30,594,886** | `d8d31f4115254b2903293f86ef37a595d6f05eaa6d3bd2470952e373b47f3347` |
| `aib-proxy-final.tar.gz` | **61,356,041** | `007dc2ee074b16f6cc36a9fb79b2127a89da9d02743ec9134c8ad315dd17a09c` |
| `index.html` (voiced, no-config) | 17,032,050 | `72a1f353444e7f37844c3d413430b1799ca65977c3a8d23d4474dc90f34915c3` |
| `artifact.html` (voiced, no-config) | 17,031,559 | `7c9ce5acb3c7d94ea45025fbdac6650dd3f3c059760eecfef5e2da8bd971d991` |

Both tarballs `gzip -t` clean; 23 and 17 tar entries. **`aib-deck-final.tar.gz` (30,576,427 B) in
that directory is SUPERSEDED** — the previous cycle's deck image, with no proxy support. Left in
place rather than deleted, but it is one wrong `scp` away from re-deploying the old build.

### 13.5 Open pre-flight items

1. **The Anthropic parameter combination has never been exercised against the live API.**
   `thinking: { type: 'disabled' }` + `output_config: { effort: 'low' }` on `claude-sonnet-5`, with
   `max_tokens` 350. No key was available to any agent in this cycle. The reasoning behind it is
   sound and written down — adaptive thinking is on by default and `max_tokens` caps thinking and
   text together, so omitting the field would spend the budget before the answer starts — but it is
   **untested**, and it is the single thing between a working `/api/llm` and a 400. **First live
   call with a real key is the pre-flight.** The ElevenLabs half *was* verified live: a real call
   through the proxy returned valid MP3 with intact character timings.
2. **No rate limiting on the public, unauthenticated `/api/`.** Accepted risk, not a defect — the
   operator has been told the spend exposure twice and explicitly accepted it. Worth recording that
   §13.1's gating fix shrank it substantially and incidentally: ordinary questions no longer reach
   the proxy at all, so the exposed surface is sub-floor questions only.

### 13.6 Two findings from integration

**(a) `docker/default.conf.template`'s 502 comment is right, and the reported 504 is a different
failure.** The comment says a missing proxy yields 502 on `/api/`. I could not reproduce 504 from a
missing proxy; I measured **502 in both constructible cases**:

| condition | code | latency |
|---|---|---|
| upstream name does not resolve (no peer at all) | **502** | 30 s — `resolver … valid=30s` timing out |
| name resolves, nothing listening on 8091 | **502** | 1 ms — `proxy_connect_timeout 5s`, refused |

504 needs the upstream to **accept** the connection and then not answer within
`proxy_read_timeout 120s` — a *wedged* proxy, not an absent one. So the comment is accurate for
what it describes; the 504 that was observed was a third state worth documenting separately rather
than a correction to this one.

**More useful than either number: the browser rarely sees it.** `src/ask.js` carries a 15,000 ms
deadline and `src/voice.js` a 12,000 ms one, so the client aborts and degrades long before nginx's
30 s resolve or 120 s read timeout expires. The only case a visitor actually meets the nginx status
is the fast one — connection refused, 502 in a millisecond. The property holds in every case
measured: **deck serves in full, nginx stays `healthy`, and routing recovers with no restart.**

**(b) `dist/artifact.html` silently carries no config in any mode, and with `--public-config` that
is correct by accident.** The artifact target is assembled from a `<style>…</style>` slice plus the
`<body>` contents, and the config seam sits in `<head>` outside both — so the
`window.AIB_CONFIG = {…}` assignment is dropped. Measured on the `--public-config` build:
`dist/index.html` has the assignment and 4 endpoint references; `dist/artifact.html` has **0
assignments** and only the 2 references that live in inlined `src/` comments.

This has always been true — the committed artifact at `4b3456c` has no assignment either — and it
went unnoticed because no earlier mode put anything functional in that file. **For the Artifact
channel it is the right outcome:** a relative `/api/tts` would resolve against `claude.ai` and 404,
so the artifact degrading to pre-rendered speech plus the local knowledge base is what you want.
But it is undocumented, it is **untested** — `proxy` §1.3 asserts the endpoints are inlined and
reads `index.html` only — and it is fragile: moving the config seam below `<style>` would start
shipping endpoints that 404 on the host they would resolve against. Not acted on; it is a design
decision about what the artifact target promises, not integration work.

### 13.7 Still open from earlier sections

1. **§10.5(b)** — voiced and unvoiced builds share filenames, so `node tests/run.mjs` leaves
   `dist/` voiced and the tracked pair must be rebuilt `--no-voice` afterward. Now three variants
   share those two paths rather than two, so the footgun is slightly worse than when it was
   recorded.
2. **§10.7(1)** — the canvas caption still has no word-by-word highlight, though all 112 clips
   carry timings that tokenise exactly as the caption splits.
3. **§11.4(5)** — `1` / `0` / `∞` in scene 1's `.metrics`, deliberate platform invariants.
4. **`.bars` / `.bar`** in `src/styles.css` is dead CSS; last consumer went in `g17`.
