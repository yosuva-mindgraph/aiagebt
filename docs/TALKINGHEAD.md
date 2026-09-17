# The vendored TalkingHead bundle

`docs/OSS-EVALUATION.md` recommended taking [met4citizen/TalkingHead](https://github.com/met4citizen/TalkingHead)
for the avatar. This is the record of actually taking it: what is committed, why it is
committed rather than installed, and the four non-obvious things that will otherwise
cost someone a day each.

The short version: **`vendor/talkinghead.bundle.js` is a generated, committed, classic
`<script>` that puts `TalkingHead` and `LipsyncEn` on `window`, and nothing else touches
`three` or `@met4citizen/talkinghead` ever again.**

---

## What is committed, and why

| File | Size | Why it is in git |
|---|---|---|
| `vendor/talkinghead.bundle.js` | 812 KB (831,359 B) | The deliverable is `dist/index.html` — one file you double-click on a booth machine with no network and no npm. A dependency you have to install is not a deliverable. |
| `assets/avatar.glb` | **35.11 MiB (36,815,920 B)** | Same reason. **CC0**, and a placeholder — see the avatar section. |
| `package-lock.json` | — | The bundle is only reproducible if the inputs are. |

This is the same call the repo already made for the 731 KB `assets/fonts.css` (fonts as
data URIs) and for `dist/index.html` itself. `node_modules/` stays gitignored: `npm ci`
is how you **regenerate** the bundle, never how you **obtain** it.

**Size, stated plainly, because it is the uncomfortable number here.** Base64'd into the
page the bundle is ~1.06 MB and the avatar ~49 MB, on top of the current ~890 KB — call
it **~51 MB for the finished single file**, against ~8 MB had the non-commercial avatar
been usable. That is the price of the only CC0 option, and it was paid deliberately: see
the avatar section. It is a local file rather than a download, so it costs load time on
the booth machine, not bandwidth. Optimising it is a real follow-up (a `gltf-transform`
pass with webp textures is the route — **not** Draco, see below), but it is not worth
doing before the final avatar is chosen, since the work would be thrown away.

---

## Seam S1 — the contract

`vendor/talkinghead.bundle.js` is a **classic script** (not a module) that assigns:

```js
window.TalkingHead   // the class
window.LipsyncEn     // the English lipsync processor, for the hand-over below
```

Consumers read those two off `window`. **Nothing in `src/` may `import` from `'three'`
or `'@met4citizen/talkinghead'`.**

That is not stylistic. `build.js` flattens the ES modules in `src/` into one classic
`<script>` by *deleting* import statements with a regex — it is explicitly "not a bundler
and does not pretend to be". A real bare-specifier import in `src/` would therefore be
stripped silently, and the first symptom would be `TalkingHead is not defined` on a
stand. Keeping the seam at `window` is what lets that small inliner stay sufficient, and
removes any need for an importmap or a `<script type="module">` on the page.

`vendor/smoke.cjs` enforces this by diffing `Object.keys(window)` either side of the
`<script>` tag. The pinned set is:

```
LipsyncEn, TalkingHead, __THREE__
```

`__THREE__` is three.js's own doing: it writes its revision string (`"180"`) to `window`
so that a **second** copy of three loading on the page logs *"Multiple instances of
Three.js being imported"*. It is a string, not an API. It could be deleted in
`vendor/entry.mjs` to make the seam read as exactly two names, and that would throw away
a real duplicate-load warning for cosmetics — so it stays, pinned, as a known member of
the set rather than something that crept in. There is deliberately **no `THREE` global**
to reach for.

---

## Regenerating

```bash
npm ci
node vendor/build-vendor.mjs
git diff --exit-code vendor/talkinghead.bundle.js   # must be clean
```

The build is deterministic: same pinned versions in, byte-identical bundle out. The
banner carries no timestamp for exactly that reason, and `build-vendor.mjs` refuses to
run if `node_modules` has drifted from the pins. If `git diff` is dirty after a
regeneration you have changed an input, so find out which one before committing.

Then always:

```bash
LD_LIBRARY_PATH=$HOME/.local/chromedeps/root/usr/lib/x86_64-linux-gnu node vendor/smoke.cjs
```

which loads the bundle from a real `file://` URL and asserts it constructs, rigs, has a
mouth, and speaks. Expected, with the CC0 avatar currently committed:

```
ctor=ok armature=true visemeMorphs=14 marker=fired markerAfterStop=false
  avatar loaded in ~1600ms · 80 morph targets · queue drained to 0
  rig: root "Armature" · 52 required bones present · eyes [LeftEye,RightEye]
  visemes: 14/15 present (missing: sil)
```

`visemeMorphs=14` is correct, not a defect — `mpfb.glb` ships no `viseme_sil`, and `sil`
is silence, which is also exactly what every other viseme relaxing to 0 renders. The
morph apply path is guarded (`if (this.mtAvatar.hasOwnProperty(mt))`, ~L2434), so an
absent morph is skipped rather than thrown on. The smoke test therefore asserts the **14
articulating** visemes individually and permits only `sil` to be missing; any other
absence fails, because that would be an avatar that mouths some phonemes and not others.

---

## Pins, and why these exact ones

```
@met4citizen/talkinghead  1.7.0     (exact)
three                     0.180.0   (exact)
esbuild                   0.28.2    (exact)
```

All three are **devDependencies** — nothing ships at runtime, the bundle is the artifact.

**Install from npm, not from GitHub `main`.** They are not the same code, and the
difference is fatal:

- npm `1.7.0` — `talkinghead.mjs` is 4,825 lines and self-consistent.
- GitHub `main` — 4,895 lines, and imports `./retargeter.mjs` plus `MeshoptDecoder`.
  **`retargeter.mjs` is not listed in the package's `files[]`,** so it is not on npm and
  not at a predictable URL. Vendoring from `raw.githubusercontent.com` gives you an
  import that cannot be resolved, and a bundle that will not build.

**`three` is pinned to `0.180.0`, not `^0.180.0`.** The package declares `^0.180.0`; on a
`0.x` version a caret only permits patch releases, and `0.180.0` is currently the only
`0.180.x` published — so the caret is not protecting anything today, and an exact pin is
what makes the bundle reproducible. three.js also makes breaking changes on minor
revisions, so a floating range here would be a trap rather than a convenience.

**`package.json` must NOT set `"type": "module"`.** `build.js` and `shoot.js` are CommonJS
and use `require()`. Adding that field breaks the entire repo's tooling in one line. The
vendor scripts sidestep it by extension instead: `build-vendor.mjs` is ESM because it is
`.mjs`, `smoke.cjs` is CommonJS because it is `.cjs`.

---

## The four traps

### 1. `import.meta.url` kills the bundle before your code runs

`talkinghead.mjs` line 34, at module scope:

```js
const workletUrl = new URL('./playback-worklet.js', import.meta.url);
```

esbuild has no `import.meta` in an IIFE, so it emits `var import_meta = {}` and that
expression becomes `new URL('./playback-worklet.js', undefined)` — which **throws
`Invalid URL`**. At module scope, which means it throws during the `<script>`, which
means `window.TalkingHead` is never assigned. The only symptom you get is
`TalkingHead is not defined` somewhere else entirely.

The fix is in `vendor/build-vendor.mjs` and is load-bearing, not cosmetic:

```
--define:import.meta.url='"file:///bundled/"'
```

Any valid absolute URL will do, because the value is never read: `workletUrl` is used
only by `streamStart()`, the WebSocket streaming path. **We never call `streamStart`.**
If that changes, this is the line to revisit — streaming would need the worklet at a
genuinely reachable URL, or inlined as a blob.

### 2. Lipsync must be handed over, not lazily imported

TalkingHead loads lipsync processors with a **computed dynamic `import()`** of
`./lipsync-<lang>.mjs`. Computed, so esbuild cannot follow it; relative to the original
module, so the path does not exist once bundled; and it would want the network anyway.

The lazy path is guarded:

```js
lipsyncGetProcessor(lang, path="./") {
  if ( !this.lipsync.hasOwnProperty(lang) ) { … import(moduleName) … }
```

So construct with an **empty** module list and populate the key yourself. The guard then
makes the dynamic import a no-op and it never fires:

```js
const th = new TalkingHead(el, { lipsyncLang: 'en', lipsyncModules: [], … });
th.lipsync['en'] = new LipsyncEn();          // the statically-bundled one
```

Verified end to end — `th.lipsyncWordsToVisemes('sources','en').visemes` returns
`["SS","aa","RR","SS","I","SS"]` with no network at all. `vendor/smoke.cjs` asserts that
exact output, so a regression here fails loudly instead of silently falling back to a
motionless mouth.

### 3. The GLB cannot be `fetch`ed from `file://` — use a Blob

Chrome CORS-blocks `fetch()` of a `file://` URL, even a sibling one. So `showAvatar({url:
'assets/avatar.glb'})` works on a dev server and fails on the booth machine, which is
the one place it has to work.

What does work, and is what the shipped page will do anyway since it is a single
self-contained file:

```js
base64 → Uint8Array → new Blob([bytes], {type:'model/gltf-binary'})
       → URL.createObjectURL(blob) → showAvatar({ url })
```

Measured with the committed 35 MiB CC0 avatar: loads in ~1.6 s, `armature: true`, 80
morph targets of which **14 are `viseme_*`**. Check the visemes by name, don't assume
them — a GLB exported without the Oculus viseme set loads perfectly happily and then
never moves its lips.

**`dracoEnabled` must stay `false`** (its default). Turning it on makes TalkingHead fetch
a decoder from `https://www.gstatic.com/draco/v1/decoders/`, which is an air-gap
violation. If a Draco-compressed avatar is ever wanted, the decoder has to be vendored
too and `dracoDecoderPath` pointed at it locally.

### 4. `stopSpeaking()` silently discards a pending `speakMarker`

`speakMarker(cb)` pushes `{ marker: cb }` onto `speechQueue`. `stopSpeaking()` does:

```js
this.speechQueue.length = 0;
```

The pending marker goes with it, **uncalled**. Measured, and asserted as `false` in the
smoke test so the behaviour is pinned rather than rediscovered.

This matters more here than in most projects. The whole premise of this presenter is
*"stop me with a question at any point"* — so an interruption is the normal case, not the
edge case. Anything that sequences the walkthrough off a `speakMarker` callback
("when Iris finishes this line, advance the scene") will **stall the first time a viewer
interrupts her**. Whoever wires the narration needs an explicit path for the interrupted
case; the callback will not arrive.

---

## The avatar — CC0, placeholder, and the only licence-safe option there was

`assets/avatar.glb` is **`mpfb.glb` from the TalkingHead repository**, byte-identical to
`met4citizen/TalkingHead@main:avatars/mpfb.glb`:

```
sha256   63c645a2a863b9972e9a9c2ed576a1de4c390b8475508e1473e69c87a3ee299c
size     36,815,920 bytes  ·  35.11 MiB  ·  glTF 2.0 binary
licence  CC0 (public domain) — built in Blender with the MPFB extension
```

**It was chosen for its licence, not its looks or its size.** Of the six example avatars
bundled with TalkingHead, five cannot be used here:

| Avatar | Size | Licence | Usable? |
|---|---|---|---|
| `brunette.glb` / `brunette-t.glb` | 4.5 MB | Ready Player Me, **CC BY-NC 4.0** | ✗ non-commercial |
| `avatar.glb` (Avaturn) | 13.8 MB | Avaturn, non-commercial | ✗ |
| `avatarsdk.glb` | 12.3 MB | AvatarSDK, non-commercial | ✗ |
| `vroid.glb` | 2.3 MB | VRoid Studio, non-commercial | ✗ |
| **`mpfb.glb`** | **36.8 MB** | **CC0 — public domain** | ✓ **the only one** |

> **Why non-commercial is a hard blocker here.** This is a MindGraph × DXC product
> walkthrough shown to prospects. That is commercial use, unambiguously, and CC BY-NC
> forbids it. It is not a footnote to clear later — the asset is delivered to the client
> and, being one HTML file, is effectively downloadable, which is precisely the case the
> TalkingHead README warns about.
>
> **And the escape hatch is gone.** The npm 1.7.0 README says that to use a Ready Player
> Me avatar commercially "you must sign up as a Ready Player Me developer". **Ready
> Player Me shut down on 2026-01-31**, following its acquisition by Netflix (announced
> 2025-12-19). Verified from this box: `readyplayer.me`, `models.readyplayer.me`,
> `api.readyplayer.me` and `docs.readyplayer.me` all fail to resolve — no A record. The
> current `main` README has quietly dropped that sentence. So there is **no route to
> license an RPM avatar for commercial use at all**, and nothing to escalate. The whole
> "a free Ready Player Me avatar is a 10-minute job" premise in
> `docs/OSS-EVALUATION.md` died with the company; that file has been corrected.

So we pay 35 MiB for a clean licence. That is the trade, made knowingly. **Do not swap
back to a smaller non-commercial avatar to improve the numbers.**

### It is still a placeholder

`mpfb.glb` is a generic MakeHuman figure. It proves the pipeline, not the brand — Iris
still has to be chosen, and that is a brand decision, not an engineering one. Swapping
her is a **one-file change with no code impact**: drop the new GLB at `assets/avatar.glb`
and re-run `vendor/smoke.cjs`.

### What a replacement avatar must satisfy

"A Mixamo-compatible rig" is far too loose. The real contract, verified against the
pinned npm 1.7.0 and asserted by `vendor/smoke.cjs`:

- **Full body. Non-negotiable.** The required-bone list includes `LeftUpLeg`, `RightUpLeg`,
  `Leg`, `Foot`, `ToeBase`. A half-body or head-only avatar is categorically incompatible,
  even though the presenter only ever frames the upper body.
- **Root object named exactly `Armature`.** On npm 1.7.0 the `mixamorig` prefix is **not**
  stripped, so a GLB exported straight out of Mixamo works on git `main` and fails here.
  This is a pin-specific trap.
- **52 specifically-named bones**: `Hips`, `Spine`, `Spine1`, `Spine2`, `Neck`, `Head`,
  and per side `Shoulder`, `Arm`, `ForeArm`, `Hand`, `UpLeg`, `Leg`, `Foot`, `ToeBase`,
  plus all five finger chains `HandThumb1-3`, `HandIndex1-3`, `HandMiddle1-3`,
  `HandRing1-3`, `HandPinky1-3`. These fail loudly — `Avatar object <name> not found`.
- **`LeftEye` and `RightEye`.** These are the nasty ones: they are **not** in the library's
  `required[]` check, but `showAvatar()` then calls
  `this.objectLeftEye.getWorldPosition(plEye)` unguarded (~L1384) to estimate avatar
  height. Without them you get `TypeError: Cannot read properties of undefined (reading
  'getWorldPosition')`, which names nothing and points at nothing. The smoke test checks
  them explicitly so a bad export fails with a sentence instead.
- **52 ARKit blend shapes + 15 Oculus visemes** (`viseme_sil` may be absent, as above).
  The 5 "extras" — `mouthOpen`, `mouthSmile`, `eyesClosed`, `eyesLookUp`, `eyesLookDown` —
  are **optional**: TalkingHead synthesises them from ARKit shapes via `mtExtras`, and
  the committed CC0 avatar ships none of them and works. So do not treat the old
  RPM-era export URL as a requirements list.
- **Not Draco-compressed** (see trap 3).
- **Licensed for commercial use.** CC0, a licence we own, or an avatar we commission.

Realistically, a brand-correct Iris now means **authoring a rig to that contract**
(Blender + MPFB, or a commissioned model), because the service that used to make it a
ten-minute job no longer exists.

### If someone later optimises the size

Worth doing once the final avatar is settled, not before. The order of preference:

1. **`gltf-transform` with webp textures** — this is the route. Texture data, not
   geometry, is the bulk of a 35 MiB humanoid.
2. **Meshopt** — better than Draco, but TalkingHead only supports it on **git `main`**,
   not the npm 1.7.0 we are pinned to. Taking it means taking `main`, which reintroduces
   the unresolvable `retargeter.mjs` import described above.
3. **Draco — no.** `dracoEnabled` fetches its decoder from `gstatic.com`. That is an
   air-gap violation, which is the one thing this whole vendoring exercise exists to
   prevent.

---

## Files

| Path | What it is |
|---|---|
| `vendor/entry.mjs` | The two-line seam. The only place either package is imported. |
| `vendor/build-vendor.mjs` | Shells esbuild with the four flags. Verifies the pins, then verifies its own output. |
| `vendor/talkinghead.bundle.js` | **Generated — do not edit.** |
| `vendor/smoke.html` | The page under test. Driven by the harness; needs the GLB handed to it. |
| `vendor/smoke.cjs` | Playwright harness. Opens the page from `file://` and asserts the behaviours above, plus the full rig contract. |
| `assets/avatar.glb` | Placeholder avatar — `mpfb.glb`, CC0, 35.11 MiB. See the avatar section. |
