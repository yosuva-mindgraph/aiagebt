# A 3D talking presenter, behind a seam, with the canvas deck untouched as the default

## What this is

The AIB Presenter deck currently narrates through a drawn 2D bust on a `<canvas>`. This
adds a second, photoreal presenter — a rigged GLB driven by
[met4citizen/TalkingHead](https://github.com/met4citizen/TalkingHead) 1.7.0 in WebGL,
lip-synced to the ElevenLabs audio — as an **opt-in third build target**. The shipping
default does not change: `dist/index.html` is still canvas-only, still opens from
`file://` with no network, and is still what you hand a client.

It also fixes a bug that is in the artifact shipping today: **the deck never advanced
past scene 2 on its own.** That is unrelated to the 3D work and is called out separately
below, because it is the one change here that affects the current product.

## Why a seam rather than a swap

The 3D presenter cannot be a hard requirement. A booth machine with a blocklisted GPU, a
viewer who has asked for reduced motion, a phone where the avatar rail is `display:none`
— none of those are errors, and none of them may cost the client their walkthrough. So
the two presenters sit behind one interface and the deck never learns which is up.

**`Presenter` owns "speak one line."** `await presenter.say(text)` is the only thing the
controller awaits, and everything the two backends disagree about lives behind it. The
disagreement is real: the 3D backend drives visemes off its own audio clock, so it must
do the *playing* as well as the mouthing; the canvas backend only draws, so `Voice`
plays. Hence the split in **`Voice`**, which gained `synthesize()` and `play()` as
separate calls. `Voice.say()` remains as the one-shot path — it is now `synthesize()`
then `_play()`, falling back to `speakBrowser()` — so callers that just want a line
spoken are unaffected:

```js
const clip = await voice.synthesize(text);      // null = no key / failed
if (backend.ownsPlayback && clip)               // TalkingHead: it plays
  await backend.speak(text, clip.durationMs, clip);
else {                                          // canvas: Voice plays
  backend.speak(text, estimate(text));          // visual, alongside
  await (clip ? voice.play(clip) : voice.speakBrowser(text));
}
```

`synthesize()` also converts ElevenLabs' character alignment into **word timings**:
ElevenLabs returns per-character start/end times in **seconds**; TalkingHead's
`speakAudio()` wants per-**word** times in **integer milliseconds**. A word starts at its
first character's start and runs to its last character's end, hence `wordsFromAlignment()`
and the ×1000. `normalized_alignment` is preferred over `alignment` where present,
because it is keyed to what was actually *spoken* ("2025" read as "twenty twenty-five").
Those word times are what drive caption highlighting in the shell.

**Degradation is silent and permanent for the session.** `Avatar3D.create()` returns
`null` — it does not throw — for every one of: no `window.TalkingHead`, no
`window.LipsyncEn`, `prefers-reduced-motion: reduce`, a zero-size or hidden mount, no
WebGL context, or a constructor that threw. It logs the reason **once** per session
(`Avatar3D._warned`), the `Presenter` takes the canvas bust, and it does not retry. A
`backendKind` of `canvas` is the normal path, not an error state.

`Presenter.create()` itself never returns `null` and is documented never to throw. If
neither backend comes up — a `shoot.js` frame, a test harness, a page with no avatar
element at all — it stands in an inert backend (`kind: 'none'`) so narration still runs
rather than making every call site null-check.

`say()` always settles. It resolves on the natural end of the line or within a frame or
two of `cancel()`, and never rejects or hangs. That is not defensive decoration: the cold
open literally says *"Stop me with a question at any point"*, so interruption is the
normal case, and there are four independent ways a line can otherwise go quiet forever —
TalkingHead dropping a pending `speakMarker` (below), Chrome silently dropping a long
`SpeechSynthesisUtterance` without firing `onend`, an `AudioContext` suspended mid-clip
never firing `onended`, and an ElevenLabs fetch that neither resolves nor rejects. Each
layer guards its own case and `say()` races the lot against an explicit cancel signal.

One more seam worth knowing (S3): TalkingHead 1.7.0 builds its **own** `AudioContext` in
`initAudioGraph()` and gives you nowhere to inject one. When the 3D backend comes up, the
`Presenter` hands that context to `Voice` so a clip is decoded and played in one context
at one sample rate.

## Three build targets

| Target | Size | Contents | Committed? |
|---|---|---|---|
| `dist/index.html` | 945,586 B (0.90 MB) | canvas presenter only — no vendor bundle, no GLB | yes |
| `dist/artifact.html` | 945,085 B (0.90 MB) | same, head/body scaffolding stripped for Artifact CSP | yes |
| `dist/index-3d.html` | 10,946,722 B (10.44 MB) | + 0.79 MB TalkingHead bundle + 9,169,708 chars of base64 GLB | **no — gitignored** |

`node build.js` / `node build.js --artifact` / `node build.js --3d`.

**On the canvas target being "unchanged":** its *contract* is unchanged and that is what
matters — zero network requests, no vendor bundle, no inlined GLB, opens from `file://`.
It is **not** byte-identical to master: it grew **892,333 → 945,586 B (+53,253 B, +6%)**
because `src/presenter.js` and `src/avatar3d.js` are inlined into it along with the rest
of `src/`. Those modules are inert there — the file mentions `window.TalkingHead` only in
the guards that find it missing, and the two `assets/avatar.glb` occurrences are default
path strings, not payload. Verified: no `model/gltf-binary;base64`, none of the vendor
bundle's signatures. The gate asserts zero network requests on all three targets.

`dist/index-3d.html` is deliberately **not** committed. It is ~10.4 MB of generated bytes
whose two sources (`vendor/talkinghead.bundle.js`, `assets/avatar.glb`) are *already* in
git in their real form. Committing it would put a third copy in every clone and a fresh
10 MB blob in history on every avatar tweak. Rebuild it in about a second with
`node build.js --3d`.

## The licensing story

**Ready Player Me is gone.** It shut down on **2026-01-31** after the Netflix
acquisition; `readyplayer.me`, `models.readyplayer.me`, `api.readyplayer.me` and
`docs.readyplayer.me` all fail to resolve. The avatar this repo first shipped,
`brunette.glb`, is RPM under **CC BY-NC 4.0** — non-commercial — and there is no longer
any route to clear those rights from anyone. It cannot ship and the question is closed.
This matters because essentially every TalkingHead tutorial and sample reaches for an RPM
avatar, so the obvious path is a dead end and will stay one.

We ship **`Black_F_1_Busi`** from the **VALID** library (Validated Avatar Library for
Inclusion and Diversity, UCF + Google) — 210 perceptually validated, fully-rigged
avatars. VALID ships FBX only, so we consume the glTF conversion at
[`c-frame/valid-avatars-glb`](https://github.com/c-frame/valid-avatars-glb) (commit
`c4719df`), which VALID's own README links under "VALID Extensions".

**Licence: MIT — Copyright (c) 2022 Tiffany Do.** Both repositories' `LICENSE` files are
byte-identical. MIT permits commercial use, modification and sublicensing and requires
only that the notice travel with the work; `assets/avatar.glb`'s `asset.copyright` field
carries it. VALID asks that the paper be cited — MIT does not require it, we do it anyway:

> Do, T. D., Zelenty, S., Gonzalez-Franco, M., & McMahan, R. P. (2023). **VALID: a
> perceptually validated Virtual Avatar Library for Inclusion and Diversity.** *Frontiers
> in Virtual Reality*, 4. https://doi.org/10.3389/frvir.2023.1248915

| | |
|---|---|
| Source | `.../valid-avatars-glb/c4719df.../avatars/Black/Black_F_1_Busi.glb` |
| Source bytes / sha256 | 1,718,008 · `e8158244…` |
| Shipped bytes / sha256 | **6,877,280 (6.56 MiB)** · **`410f9933…`** |

`tools/convert-valid-avatar.mjs` re-verifies the source sha256 on every run and refuses
to proceed on a mismatch, so an upstream change cannot slip through quietly. This
replaces `mpfb.glb` (CC0, 36,815,920 B), which remains the documented fallback of record.

**The full provenance record, with verbatim licence text and dated hashes, is
[`docs/AVATAR.md`](docs/AVATAR.md).** It exists because a grant for a free 3D asset is a
line in a file the author can edit at any time, and this project hands that asset to
clients inside a single downloadable file.

## The bug this fixes, which is already shipping

**The walkthrough never auto-advanced past scene 2.** Not "1 to 2 was flaky" — the deck
could not run itself at all, only be clicked through.

`render()` ends with `if (play) this.play()`. `play()` opens with
`if (this.playing) return`. Nothing cleared the flag between them, so the recursive call
at the end of every scene was swallowed: scene 1 narrated, scene 2 rendered, and the deck
then sat there with `playing = true`, the transport reading "Pause presentation",
`avatarState` on "standing by", and nothing speaking. Measured on the **unmodified master
`dist/index.html` that ships today**:

```
{"seen":[{"n":"scene 1 / 12","at":"0.1s"},{"n":"scene 2 / 12","at":"3.5s"}],
 "playing":true,"line":0,"i":1,"token":4,"state":"idle"}
```

The guard is right to exist — two narration loops on one scene would double every line —
it just does not apply to a scene change, which has already bumped `this.token` and
killed the loop it is replacing. The fix clears the flag only on the play branch, so
`render(i, {play:false})` and the cold open's button copy are untouched:

```js
if (play) { this.playing = false; this.play(); }
else this._setState('idle');
```

**Why `shoot.js` could never have caught it:** the screenshot harness drives
`render(i, {play:false})` and steps scenes itself. It never exercises auto-advance, so 28
green screenshots were fully compatible with a deck that cannot advance. This is now
covered by `tests/autoadvance.test.mjs`, which has a **negative control**: the same probe
is run against `git show master:dist/index.html` and is *required to stall*. If that
control ever goes green, the test has lost its teeth and says so.

## Five traps a maintainer will otherwise re-discover

Each is documented at length in `docs/TALKINGHEAD.md` and `docs/AVATAR.md`; one line each
here so they are at least visible from the PR.

1. **`--define:import.meta.url='"file:///bundled/"'`** — without it, esbuild leaves
   `import_meta.url` in the IIFE, `new URL('./playback-worklet.js', undefined)` throws at
   module scope, and `window.TalkingHead` is never assigned. `vendor/build-vendor.mjs`
   asserts the substitution happened rather than trusting it.
2. **`stopSpeaking()` discards a pending `speakMarker`** — `talkinghead.mjs` L3446 does
   `this.speechQueue.length = 0`, and the marker callback is *in* that queue, so it is
   thrown away uncalled. `Avatar3D.speak()` resolves its own promise on cancel with a
   done-guard; `vendor/smoke.cjs` pins the behaviour as `markerAfterStop: false`.
3. **`$&` in `String.replace`** — the replacement string is not a literal splice; it
   expands `$&`, `$1`, `` $` `` and `$'`. The minified three.js in the vendor bundle
   contains exactly one `$&`, so splicing the bundle in as a *string* re-inserted the
   `<script src=…>` tag into the middle of the bundle: `Unexpected token '<'`, the whole
   payload failing to parse, and ~8800px of horizontal overflow, from a character nobody
   typed. Every splice in `build.js` now goes through a **replacer function**, which opts
   out of `$`-expansion entirely. The same helper hard-fails on a *silent miss* — if a
   seam in `index.html` is reformatted, `.replace()` would otherwise return the string
   unchanged and ship a page that loads nothing.
4. **`showAvatar()` overwrites the rest pose** — it does not read the avatar's rest pose,
   it writes RPM-authored rotations over it. A VALID avatar comes out turned and
   misaligned. That is why the converter retargets the rest pose to match what
   `showAvatar()` is going to impose, making the overwrite a no-op.
5. **`quantize()` + `sparse()` silently zeroes morph deltas** — measured across all five
   orderings, `quantize → sparse` produces the smallest file (4,350,992 B) and a **perfect
   mannequin**: gltf-transform's sparse writer zeroes the values of a normalized-integer
   accessor, so every morph delta comes back all-zero. Nothing but a zero-delta geometry
   check distinguishes it from a working avatar. We ship `sparse` alone (6,877,280 B).

## Evidence

**162/162 checks pass in 471.4s**, across `units`, `build`, `offline`, `cancel`,
`degrade`, `autoadvance` and `avatar`, over all three build targets. Highlights:

- 15/15 Oculus visemes and 52/52 ARKit shapes present; 66 of 72 morph targets carry
  non-zero geometry; 14/14 articulating visemes move with real amplitude (peak influence
  0.896) and return to rest (largest residual 0.0000).
- No WebGL → falls back to canvas, warns exactly once as a **warning not an error**, all
  twelve scenes still narrate, questions still answered, zero network requests, no page
  errors. Same for `prefers-reduced-motion: reduce` and a 0×0 mount.
- Zero network requests on all three targets, with every `@font-face` a `data:` URI.
- `tools/check-avatar-glb.mjs` is **wired into the gate**, not run by hand.

**The two load-bearing tests have negative controls** — they were watched going red
against known-bad inputs, because a test that has never failed is a test whose teeth are
unproven:

- *Auto-advance*: run against `master:dist/index.html` it must **stall**, and stall in
  exactly the reported state (`playing:true`, button "Pause presentation", silent).
- *Mannequin*: run against a deliberately sparse-zeroed avatar, `check-avatar-glb.mjs`
  must **reject** it — and it does so despite 15/15 visemes and 52/52 ARKit being
  **present by name**, which is the entire point. A name-based check would have shipped
  that file. The in-browser geometry check also goes red on it, while influences still
  animate — which is precisely why the geometry check has to exist.

Other gates, on the integrated branch:

```
node tests/run.mjs                → 162/162 checks passed in 471.4s — gate is green.
node shoot.js                     → 28 shots, backend: canvas, no overflow, no page errors
node shoot.js --3d                → 28 shots, backend: talkinghead, no overflow, no page errors
node vendor/smoke.cjs             → ctor=ok armature=true visemeMorphs=15 marker=fired
                                    markerAfterStop=false · 52 required bones · 15/15 visemes
```

`git status` is clean after `npm ci && node build.js && node build.js --artifact &&
node build.js --3d` — the committed `dist/index.html` and `dist/artifact.html` rebuild
**byte-identical**, and `dist/index-3d.html` stays untracked.

## Known follow-ups (none blocking)

- **`AIB_CONFIG` does not reach `Presenter.create()`.** The call site passes only
  `voice`, `canvas`, `mount` and `onWord`, so the `talkingHead` options — camera view,
  camera distance, mood, `modelFPS` — are reachable only by editing `AVATAR3D_DEFAULTS`.
  The plumbing exists on both ends; the wire between them does not.
- **Six zero-delta placeholder morphs ship by design** — `viseme_sil` plus five ARKit
  shapes (`mouthRollLower`, `mouthRollUpper`, `mouthShrugUpper`, `mouthPressLeft`,
  `mouthPressRight`). They are present-by-name with no geometry because TalkingHead's
  `animate()` indexes `mtRandomized` names with no guard, so an *absent* name throws a
  `TypeError` every frame that picks it. `viseme_sil` is correct rather than a compromise:
  no lipsync module ever emits it. Documented in `docs/AVATAR.md` §5, and the gate asserts
  the inert set is *exactly* those six — no seventh, and none of the six silently gaining
  geometry.
- **`"test": "node tests/run.mjs"` is not in `package.json` scripts.** Run it directly.
- **Do not add `"type": "module"` to `package.json`.** `build.js`, `shoot.js` and
  `vendor/smoke.cjs` are CommonJS and all three would break.

## Files worth reading first

`docs/AVATAR.md` (provenance, licence, the conversion, the mannequin trap) ·
`docs/TALKINGHEAD.md` (the vendor bundle, the pins, traps 1–4) · `src/presenter.js` (the
seam) · `src/avatar3d.js` (both backends) · `build.js` (the splice guard).
