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
| `assets/avatar.glb` | **6.56 MiB (6,877,280 B)** | Same reason. A **VALID** avatar (MIT), converted by `tools/convert-valid-avatar.mjs` — see `docs/AVATAR.md`. |
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
ctor=ok armature=true visemeMorphs=15 marker=fired markerAfterStop=false
  avatar loaded in 152ms · 81 morph targets · queue drained to 0
  rig: root "Armature" · 52 required bones present · eyes [LeftEye,RightEye]
  visemes: 15/15 present
```

The smoke test asserts the visemes **by name** and permits only `sil` to be missing, on
the grounds that `sil` is silence — which is also exactly what every other viseme
relaxing to 0 renders — and that the morph apply path is guarded
(`if (this.mtAvatar.hasOwnProperty(mt))`, ~L2434). Any other absence fails, because that
would be an avatar that mouths some phonemes and not others.

That tolerance is currently unused. The CC0 placeholder this repo shipped first did read
`visemeMorphs=14`; the VALID avatar now committed emits all 15, so the recorded
acceptance deviation is closed. **The tolerance stays anyway** — it is a statement about
what `sil` means, not a workaround for one file.

**Nothing here proves the mouth MOVES.** This suite checks that the contract is
satisfied, and a rig can satisfy every line of it and still render a mannequin — that is
the exact failure a Daz-scheme avatar produces. The test that samples
`morphTargetInfluences` frame by frame during real speech lives with the converter; see
`docs/AVATAR.md` §6.

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

## The avatar — VALID, MIT, and converted

`assets/avatar.glb` is **`Black_F_1_Busi` from the VALID library**, MIT, converted for
this pinned TalkingHead by `tools/convert-valid-avatar.mjs`:

```
source   c-frame/valid-avatars-glb @ c4719df  ·  avatars/Black/Black_F_1_Busi.glb
         sha256 e8158244ef013f65fa4724d0831a860bd6bc4bb5fdaa1b81c0050910beb44a83
output   sha256 410f99339be663b806bb3060032f30dfbdc9fa7491e5b4d8d2d724f927d4e66d
         6,877,280 bytes  ·  6.56 MiB  ·  glTF 2.0 binary
licence  MIT, Copyright (c) 2022 Tiffany Do
```

**Everything about that choice — the licence text verbatim, the citation VALID asks for,
why this avatar, the full 96→67 morph mapping, what is approximated, what is inert, and
the evidence that the mouth actually moves — is in `docs/AVATAR.md`.** This section keeps
only what a reader of *this* file needs: the contract a replacement must satisfy, and why
the obvious sources are unusable.

### Why not the avatars bundled with TalkingHead

Of the six example avatars in the TalkingHead repository, five cannot be used here:

| Avatar | Size | Licence | Usable? |
|---|---|---|---|
| `brunette.glb` / `brunette-t.glb` | 4.5 MB | Ready Player Me, **CC BY-NC 4.0** | ✗ non-commercial |
| `avatar.glb` (Avaturn) | 13.8 MB | Avaturn, non-commercial | ✗ |
| `avatarsdk.glb` | 12.3 MB | AvatarSDK, non-commercial | ✗ |
| `vroid.glb` | 2.3 MB | VRoid Studio, non-commercial | ✗ |
| **`mpfb.glb`** | **36.8 MB** | **CC0 — public domain** | ✓ **the only usable one** |

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

`mpfb.glb` — the sixth, CC0 — is what this repo shipped first, and it remains the
fallback of record. It is a generic MakeHuman figure in a logo t-shirt and jeans at
35 MiB, which is not what presents an airport platform to a CFO, so it was replaced.
**Do not swap back to a smaller non-commercial avatar to improve the numbers.**

### Swapping the avatar

It is a one-constant change with no code impact: edit `SOURCE` in
`tools/convert-valid-avatar.mjs` (name, URL, byte count, sha256), then

    node tools/convert-valid-avatar.mjs
    node tools/check-avatar-glb.mjs assets/avatar.glb
    node vendor/smoke.cjs

Any GLB already meeting the contract below can equally be dropped straight at
`assets/avatar.glb`; run the gate and the smoke test either way. Nothing in `src/`,
`build.js` or `vendor/` knows which avatar it is.

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

Ready Player Me used to make meeting that contract a ten-minute job and no longer
exists, so the realistic sources are now: the **VALID** library via
`tools/convert-valid-avatar.mjs` (what is committed — MIT, 210 validated avatars, and the
converter handles the Daz-scheme mismatch), a rig authored to the contract in
Blender + MPFB, or a commissioned model.

**Meeting the contract is necessary and not sufficient.** A VALID avatar satisfies every
bullet above the moment it is renamed and reparented, and still renders a motionless
mannequin twisted ninety degrees away from camera, because `showAvatar()` overwrites the
rest pose with absolute bone rotations authored against an RPM rig. `docs/AVATAR.md` §3.3
is that story. Check a new avatar with `tools/check-avatar-glb.mjs`, which adds the
checks `vendor/smoke.cjs` cannot make from inside the browser — morph meshes outside the
`Armature` subtree, zero-delta "present" shapes, and extensions the pinned loader cannot
decode.

### Size — done, and where the bytes went

35.11 MiB → **6.56 MiB**, via `gltf-transform` in `tools/convert-valid-avatar.mjs`.

The bulk was **not** texture data, which is the usual guess and was the guess recorded
here: the VALID source ships two webp maps totalling 240 KB and they are passed through
untouched (three r180 reads `EXT_texture_webp` natively). It was **morph-target
storage** — 67 targets over a 22k-vertex mesh is ~30 MB of mostly zeroes, because a
viseme does not move the scalp. glTF **sparse accessors** store only the vertices that
move. Measurements, and the one ordering that produces a smaller file that is silently
corrupt, are in `docs/AVATAR.md` §8.

Still excluded, unchanged:

1. **Meshopt — no.** Better than Draco, but TalkingHead supports it only on git `main`,
   not the npm 1.7.0 we are pinned to; taking it reintroduces the unresolvable
   `retargeter.mjs` import described above. Note that the upstream c-frame GLBs *are*
   meshopt-compressed, which is why the converter has to decode it out rather than
   re-host the file.
2. **Draco — no.** `dracoEnabled` fetches its decoder from `gstatic.com`. That is an
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
| `assets/avatar.glb` | The avatar — VALID `Black_F_1_Busi`, MIT, 6.56 MiB. **Generated** by `tools/convert-valid-avatar.mjs`; committed because the booth machine has no npm. See `docs/AVATAR.md`. |
| `tools/convert-valid-avatar.mjs` | Builds `assets/avatar.glb` from the pinned VALID source: reparents, retargets the rest pose, remaps 96 Daz morphs onto 15 visemes + 52 ARKit shapes, synthesises gaze. Deterministic. |
| `tools/check-avatar-glb.mjs` | The avatar acceptance gate. No npm dependencies — parses the GLB by hand so it can be run against a candidate before anything is installed. |
