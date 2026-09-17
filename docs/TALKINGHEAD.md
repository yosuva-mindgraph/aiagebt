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
| `vendor/talkinghead.bundle.js` | 812 KB | The deliverable is `dist/index.html` — one file you double-click on a booth machine with no network and no npm. A dependency you have to install is not a deliverable. |
| `assets/avatar.glb` | 4.50 MB | Same reason. Also **placeholder** — see the licence section below, it is not shippable as-is. |
| `package-lock.json` | — | The bundle is only reproducible if the inputs are. |

This is the same call the repo already made for the 731 KB `assets/fonts.css` (fonts as
data URIs) and for `dist/index.html` itself. `node_modules/` stays gitignored: `npm ci`
is how you **regenerate** the bundle, never how you **obtain** it.

Budget, for whoever is watching the file size: base64'd into the page, the bundle is
~1.06 MB and the GLB ~6.0 MB, on top of the current ~890 KB. Call it 8 MB for the
finished single file. Large, but it is a local file, not a download.

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
mouth, and speaks. Expected:

```
ctor=ok armature=true visemeMorphs=15 marker=fired markerAfterStop=false
```

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

Measured: loads in ~0.2–0.4 s, `armature: true`, 81 morph targets of which **15 are
`viseme_*`**. Count the visemes, don't assume them — a GLB exported without the Oculus
viseme set loads perfectly happily and then never moves its lips.

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

## The avatar is a placeholder — and its licence blocks shipping

`assets/avatar.glb` is **`brunette.glb` from the TalkingHead repository**, byte-identical
to `met4citizen/TalkingHead@main:avatars/brunette.glb`:

```
sha256  8864c504b5c11daa2f0037afffdc0815bb0fa2e6062e37a584746116a3c2f538
size    4,721,528 bytes · glTF 2.0 binary
```

It is here because it is known-good — it loads, it rigs, it has all 15 visemes, so it
proves the pipeline rather than the art.

> **Licence — read before shipping.** The TalkingHead *code* is MIT (Mika Suominen,
> 2023–2024) and the bundle is fine. The **avatar is not MIT.** The project's README
> states that `brunette.glb` was created at Ready Player Me and is *"free to all
> developers for **non-commercial** use under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)"*,
> and that integrating Ready Player Me avatars into a commercial app requires signing up
> as a Ready Player Me developer.
>
> A MindGraph × DXC sales walkthrough shown to prospects is commercial use. **This file
> must be replaced before the presenter is used with a client**, or the use must be
> cleared with Ready Player Me. This is a licence constraint, not a preference — flagging
> it here because it is invisible in the binary and easy to inherit by accident.

Choosing the real Iris is a brand decision, not an engineering one. Swapping her is a
**one-file change with no code impact** — drop the new GLB at `assets/avatar.glb` and
re-run `vendor/smoke.cjs`. Requirements for the replacement:

- **GLB**, Ready Player Me / PlayerZero **full-body** (the class expects a Mixamo-compatible
  rig whose root object is named `Armature`; a head-only export will not load).
- Exported **with the morph targets**, or the mouth will not move. The URL parameters
  matter:
  `?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png`
- **Not** Draco-compressed (see trap 3).
- Licensed for commercial use — a Ready Player Me developer account, or an avatar we own.

The smoke test will tell you if it rigged and how many visemes it has; if `visemeMorphs`
comes back anything other than 15, the export was wrong, not the code.

---

## Files

| Path | What it is |
|---|---|
| `vendor/entry.mjs` | The two-line seam. The only place either package is imported. |
| `vendor/build-vendor.mjs` | Shells esbuild with the four flags. Verifies the pins, then verifies its own output. |
| `vendor/talkinghead.bundle.js` | **Generated — do not edit.** |
| `vendor/smoke.html` | The page under test. Driven by the harness; needs the GLB handed to it. |
| `vendor/smoke.cjs` | Playwright harness. Opens the page from `file://` and asserts the five behaviours above. |
| `assets/avatar.glb` | Placeholder avatar. See the licence section. |
