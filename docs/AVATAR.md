# The avatar — VALID, and what it took to make it work

`assets/avatar.glb` is a **VALID** avatar, converted for TalkingHead 1.7.0 by
`tools/convert-valid-avatar.mjs` and gated by `tools/check-avatar-glb.mjs`.

    node tools/convert-valid-avatar.mjs        # regenerates assets/avatar.glb
    node tools/check-avatar-glb.mjs assets/avatar.glb

Both are deterministic. Two consecutive runs produce byte-identical output.

---

## 1. Provenance and licence — the record

Dated **2026-09-17**. This section exists because the grant for a free 3D asset is a
line in a file the author can edit at any time, and this project hands the asset to
clients inside a single downloadable file. A dated snapshot with hashes is what makes
that defensible later.

### The library

**Validated Avatar Library for Inclusion and Diversity (VALID)** — University of
Central Florida + Google.
`https://github.com/xrtlab/Validated-Avatar-Library-for-Inclusion-and-Diversity---VALID`
at commit `31faed0138b7c0dd97e380ab04921c70a5d5c9f8` (2023-12-18).

210 fully-rigged, **perceptually validated** avatars: 7 ethnicities × male/female ×
5 outfits (Busi / Casual / Medi / Milit / Util). Ships **FBX only** — there are no
glTF files in that repository.

### The glTF conversion we actually consume

`https://github.com/c-frame/valid-avatars-glb` at commit
`c4719df7a2b60a96cc7f56d67e247674b68c4ea7` (2023-12-16), by
[vincentfretin](https://github.com/vincentfretin), and linked from VALID's own README
under "VALID Extensions". Same copyright holder, same licence. 234 `.glb` files.

The exact file:

| | |
|---|---|
| Source URL (pinned) | `https://raw.githubusercontent.com/c-frame/valid-avatars-glb/c4719df7a2b60a96cc7f56d67e247674b68c4ea7/avatars/Black/Black_F_1_Busi.glb` |
| Source URL (`main`) | `https://raw.githubusercontent.com/c-frame/valid-avatars-glb/main/avatars/Black/Black_F_1_Busi.glb` |
| Source bytes | 1,718,008 |
| Source sha256 | `e8158244ef013f65fa4724d0831a860bd6bc4bb5fdaa1b81c0050910beb44a83` |
| Converted bytes | 6,877,280 (6.56 MiB) |
| Converted sha256 | `410f99339be663b806bb3060032f30dfbdc9fa7491e5b4d8d2d724f927d4e66d` |

The pinned-commit URL and the `main` URL resolved to identical bytes when this was
written. `tools/convert-valid-avatar.mjs` re-verifies the sha256 on every run and
refuses to proceed on a mismatch, so an upstream change cannot slip through quietly.

### Licence — verbatim, as fetched from both repositories

Both `xrtlab/…VALID/LICENSE` and `c-frame/valid-avatars-glb/LICENSE` are byte-identical:

```
MIT License

Copyright (c) 2022 Tiffany Do

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

MIT permits commercial use, modification and sublicensing, and requires only that the
notice above travel with the work. The `asset.copyright` field of `assets/avatar.glb`
carries it; this file is the full record.

### Citation — asked for, and cheap to honour

VALID's README asks that the paper be cited. MIT does not require it; we do it anyway.

> Do, T. D., Zelenty, S., Gonzalez-Franco, M., & McMahan, R. P. (2023).
> **VALID: a perceptually validated Virtual Avatar Library for Inclusion and Diversity.**
> *Frontiers in Virtual Reality*, 4.
> https://doi.org/10.3389/frvir.2023.1248915

```bibtex
@article{do2023,
  AUTHOR  = {Do, Tiffany D. and Zelenty, Steve and Gonzalez-Franco, Mar and McMahan, Ryan P.},
  TITLE   = {VALID: a perceptually validated Virtual Avatar Library for Inclusion and Diversity},
  JOURNAL = {Frontiers in Virtual Reality},
  VOLUME  = {4},
  YEAR    = {2023},
  URL     = {https://www.frontiersin.org/articles/10.3389/frvir.2023.1248915},
  DOI     = {10.3389/frvir.2023.1248915},
  ISSN    = {2673-4192}
}
```

### Why not Ready Player Me

Because it does not exist. RPM shut down on **2026-01-31** after the Netflix
acquisition; `readyplayer.me`, `models.readyplayer.me`, `api.readyplayer.me` and
`docs.readyplayer.me` all fail to resolve from this box. The avatar this repo first
shipped, `brunette.glb`, is RPM under **CC BY-NC 4.0** — non-commercial — and there is
no longer any route to clear those rights. It cannot ship and the question is closed.

### What this replaces

`mpfb.glb`, CC0, 36,815,920 B, sha256
`63c645a2a863b9972e9a9c2ed576a1de4c390b8475508e1473e69c87a3ee299c`. Landed as the
only usable avatar in the TalkingHead repo (the other five are non-commercial) and
still the fallback of record — see §7. Its licence is fine; a MakeHuman figure in a
logo t-shirt and jeans is not what presents an airport platform to a CFO, and 35 MiB
for it is five times what the VALID conversion costs.

---

## 2. Which avatar, and why

Four criteria, in order. The first three are hard; the fourth is what broke the tie.

**1. Business attire.** The audience is airport executives. That restricts the library
to the `Busi` outfit — 42 of the 210.

**2. One of the validated avatars.** VALID ships 35 extra `X_`-prefixed models that were
*not* put through the validation study. The validation is the entire reason to prefer
this library over any other free rig, so using an unvalidated one throws away the only
thing that makes the choice defensible. Excluded.

**3. Female.** The presenter is Iris and the rest of the repo already assumes it —
`showAvatar({ body: 'F' })` in `vendor/smoke.html`, and `src/scenes.js` speaks in her
voice. 21 candidates after (1) and (2).

**4. Highest validated agreement.** VALID publishes per-avatar agreement rates — the
proportion of 132 participants across 33 countries who read each avatar as the
ethnicity and gender it was built to represent
(`Metadata/Agreement-Rates/All-Agreement-Rates.csv`). Ranking the female `Busi`
candidates by the *lower* of their ethnicity and gender agreement:

| Avatar | own-ethnicity | female | min |
|---|---|---|---|
| **Asian_F_1** | 0.98 | 0.98 | **0.98** |
| **Black_F_1** | 0.98 | 0.98 | **0.98** |
| White_F_2 | 0.96 | 0.98 | 0.96 |
| Asian_F_3 | 0.95 | 0.97 | 0.95 |
| Black_F_3 | 0.95 | 0.97 | 0.95 |
| White_F_1 | 0.94 | 0.97 | 0.94 |
| … | | | |
| MENA_F_2 | 0.32 | 0.98 | 0.32 |

Picking anything below the top is choosing to be less legible to the audience for no
stated reason. That leaves a tie: **Asian_F_1** and **Black_F_1**.

**The tie-break was a render, not an opinion.** All three of the top candidates were
converted and photographed through the real pipeline at the `upper` camera view — the
one the presenter actually uses — and the result is
`shots/avatar/avatar-04-candidates.png`. TalkingHead 1.7.0's default lighting is
bright (`lightAmbientIntensity: 2`, `lightDirectIntensity: 30`, ACES tone mapping), and
under it the two pale-skinned candidates clip: the face loses its modelling, the eye
sockets flatten, and the expression stops reading. `Black_F_1_Busi` holds its shading,
its eyes read at small sizes, and the dark suit over the lilac top separates cleanly
from the background. It is the only one of the three that looks like a person on the
stand rather than a render.

**So: `Black_F_1_Busi`.** Top of the library on its own published measure, in business
dress, and the one that survives the lighting it will actually be shown under.

**This is a client-facing decision and the client may want a different one.** It is one
constant away: `SOURCE` in `tools/convert-valid-avatar.mjs` (avatar name, URL, byte
count, sha256), then re-run the converter and the gate. Nothing else in the pipeline
knows which avatar it is — that was verified by converting three of them, not asserted.

---

## 3. What was wrong with a VALID avatar, and what the converter does

A VALID GLB is **not** a drop-in. Worse: it loads, renders, reports no error, and does
not move. `talkinghead.mjs:1260` throws `'Blend shapes not found'` only when
`this.morphs.length === 0`; VALID has 96, so the check passes and the avatar stands
there in silence. Four separate faults, in the order the converter fixes them.

### 3.1 Compression the pinned loader cannot read

The c-frame GLBs use `EXT_meshopt_compression` and `KHR_mesh_quantization`.
TalkingHead 1.7.0 registers no `MeshoptDecoder` (that is git-main only), and Draco is
not an alternative — `dracoDecoderPath` points at `gstatic.com`, which breaks the air
gap this project is built around. The converter decodes both away and disposes the
extension objects. `EXT_texture_webp` is *kept*: three r180 reads it natively, and the
source textures are already webp (a 210 KB colour map and a 30 KB normal map), so there
is nothing to gain by re-encoding them.

### 3.2 No `Armature`, and the meshes outside it

VALID's scene roots are `H_DDS_HighRes, h_L_eye, h_L_gland, h_R_eye, h_R_gland,
h_TeethDown, h_TeethUp, Hips` — seven meshes and a skeleton, all siblings. Two
failures, and the second is the one that bites:

- `showAvatar()` throws `Avatar object Armature not found` on `opt.modelRoot`.
- `:1251` collects morph meshes with `this.armature.traverse(...)`. A root named
  `Armature` placed over only the skeleton clears the first check and still yields
  **zero** morph meshes, because the meshes are siblings of the skeleton, not
  descendants. `tools/check-avatar-glb.mjs` checks for this explicitly; a flat
  node-name scan cannot see it.

The converter creates `Armature` at the identity and reparents all eight roots under it.

### 3.3 The rest pose — the big one

`showAvatar()` does not *read* the avatar's rest pose, it **overwrites** it. At
`:1321-1339` it walks `posePropNames`, takes the live quaternion off each bone, and
`.copy()`s in `poseBase.props[...]` — built in the constructor from
`poseTemplates['side']`, a fixed set of **absolute local rotations authored against a
Ready Player Me rig**.

Absolute local rotations only mean anything in a known bone-frame convention. Both rigs
put the bone along its local **+Y**; they disagree about the roll around it and about
where the anatomical offsets point. Measured against the `side` template:

| Rig | mean | worst |
|---|---|---|
| CC0 `mpfb.glb` (works) | 24° | 76° (thumbs) |
| VALID `Black_F_1_Busi` (broken) | 42° | Hips 128°, Spine 142°, LeftUpLeg 154°, RightFoot 145°, both shoulders >100° |

Those are the bones that orient the whole body. The un-retargeted result is in the
left panel of `shots/avatar/avatar-05-retarget-before-after.png`: upright-ish, turned
ninety degrees away from camera, chin in the air, one arm folded behind the back. No
error, no warning.

The converter rebuilds the bind pose with:

- the **orientations** the template will impose — read out of the pinned
  `talkinghead.mjs` by parsing its own `poseTemplates` object literal, not transcribed,
  so a version bump either updates automatically or fails loudly;
- the **offset directions** of a known-good rig (`REFERENCE_BONE_DIR`, measured off
  `mpfb.glb`, which is demonstrably compatible);
- VALID's own **bone lengths**, so the proportions stay VALID's;

and then moves the mesh onto it with linear blend skinning, setting
`inverseBindMatrix = inverse(newWorldMatrix)` so the new bind *is* the new rest and
`showAvatar()`'s overwrite becomes a no-op.

Two things had to be kept apart, and conflating them is the whole trap:

- the bone's new **frame** (the template's orientation) — absorbed by the inverse-bind
  matrix, never applied to a vertex;
- the bone's new **placement** — a world-space pose change derived only from joint
  *positions*, which carry no convention. This is what the vertices get.

Using `newWorldMatrix · inverseBindMatrix` for the vertices — the obvious move — bakes
the roll difference into the geometry. VALID's `Head` frame is rolled 90° from RPM's, so
it rotates the face around the skull and lands one eye in front of the head and the
other behind; that was measured (eyeball separation came out along +Z instead of ±X),
not reasoned about. Both dead ends are recorded in the source so nobody repeats them.

Bones the template does not name — the `*_end` tips, `LeftEye`/`RightEye`, and Daz's
extra `LeftFingerBase`/`RightFingerBase` — keep their local transform and are carried
rigidly by their parent's placement. That is what keeps the eyeballs in their sockets:
the face mesh (weighted to `Head`) and the eye meshes (weighted to `LeftEye`/`RightEye`)
are moved by the same transform, so they cannot separate.

### 3.4 The morph targets

96 targets in a Daz/Mimic scheme, split across two meshes — `h_expressions.<NAME>_h`
on the face (65) and `h_teeth.<NAME>` on the lower teeth and tongue (31) — and **0 of
the 15 Oculus visemes, 0 of the 52 ARKit shapes**. The full map is §4.

---

## 4. The mapping table

Source names are given short: `h_expressions.AE_AA_h` → `AE_AA`, `h_teeth.t_S_h` →
`t_S`. The two namespaces do not collide. A spec's sources are resolved **per
primitive**, so an entry naming both `AE_AA` and `t_AE_AA` drives the face on the face
mesh and the teeth/tongue on the teeth mesh — which is how the content was authored,
and why the lower teeth do not stay behind when the jaw opens.

`node tools/convert-valid-avatar.mjs --explain` prints this table from the live source.

### 4.1 Visemes — all 15, none missing

| Output | ← source | Note |
|---|---|---|
| `viseme_sil` | *(zero-delta)* | Silence is the rest pose. See §5. |
| `viseme_PP` | `MPB_Up`×1 + `MPB_Down`×1 + `t_MPB`×1 | Daz splits the bilabial into upper and lower lip halves. |
| `viseme_FF` | `FV`×1 + `t_FV`×1 | exact counterpart |
| `viseme_TH` | `H_EST`×1 + `t_H_EST`×1 + `OutMiddle_tg`×0.3 | **approximated.** H_EST is the nearest Daz shape; the tongue is pushed slightly between the teeth so it reads as dental rather than as a vowel. |
| `viseme_DD` | `TD_I`×1 + `t_TD_I`×1 + `Up_tg`×0.6 | **approximated.** TD_I is Daz's T/D+I shape; the raised tongue is what separates it from `viseme_I`. |
| `viseme_kk` | `KG`×1 + `t_KG`×1 | exact counterpart |
| `viseme_CH` | `SH_CH`×1 + `t_SH_CH`×1 | exact counterpart |
| `viseme_SS` | `S`×1 + `t_S`×1 | exact counterpart |
| `viseme_nn` | `TD_I`×0.6 + `t_TD_I`×0.6 + `Up_tg`×1 | **approximated.** Same alveolar contact as DD, lips nearer neutral. |
| `viseme_RR` | `UH_OO`×0.35 + `t_UH_OO`×0.35 + `RRR_In_tg`×1 | **approximated.** Daz ships an explicit retroflex tongue shape; the slight lip rounding is what makes an English r read at a distance. |
| `viseme_aa` | `AE_AA`×1 + `t_AE_AA`×1 | exact counterpart |
| `viseme_E` | `Ax_E`×1 + `t_Ax_E`×1 | exact counterpart |
| `viseme_I` | `TD_I`×1 + `t_TD_I`×1 | exact counterpart (Daz groups the I vowel with T/D) |
| `viseme_O` | `AO_a`×1 + `t_AO_a`×1 | exact counterpart |
| `viseme_U` | `UW_U`×1 + `t_UW_U`×1 | exact counterpart |

### 4.2 ARKit — 47 of 52 driven by real geometry

| Output | ← source | Note |
|---|---|---|
| `eyeBlinkLeft` / `Right` | `LeyeClose` / `ReyeClose` | exact |
| `eyeWideLeft` / `Right` | `LeyeOpen` / `ReyeOpen` | exact |
| `eyeSquintLeft` / `Right` | `Lsquint` / `Rsquint` | exact |
| `cheekSquintLeft` / `Right` | `LlowLid` / `RlowLid` | **approximated.** ARKit cheekSquint is the lower-lid/cheek raise of a genuine smile; that is the muscle VALID calls lowLid. |
| `jawOpen` | `MouthOpen` + `t_MouthOpen` | exact; the teeth copy keeps the lower teeth with the jaw |
| `jawForward` | `JawFront` + `t_JawFront` | exact |
| `jawLeft` / `jawRight` | `Ljaw`+`t_Ljaw` / `Rjaw`+`t_Rjaw` | exact |
| `mouthClose` | `JawCompress` + `t_JawCompress` | **approximated.** ARKit mouthClose shuts the lips against an open jaw; JawCompress is the lip-compression shape. |
| `mouthPucker` | `Kiss` | exact |
| `mouthFunnel` | `AO_a`×0.55 + `t_AO_a`×0.55 + `Kiss`×0.45 | **synthesised.** No counterpart. Funnel is an open O with the lips carried forward; this is the shape 😳 and 🙄 reach for. |
| `mouthLeft` / `mouthRight` | `LlipSide` / `RlipSide` | exact |
| `mouthSmileLeft` / `Right` | `LsmileOpen` / `RsmileOpen` | the **open** smile, not the closed one — ARKit mouthSmile is used alongside jawOpen, and `mtExtras` builds `mouthSmile` from it |
| `mouthFrownLeft` / `Right` | `LmouthSad` / `RmouthSad` | exact |
| `mouthStretchLeft` / `Right` | `LsmileClose` / `RsmileClose` | **approximated.** The closed smile pulls the corner sideways without opening, which is what mouthStretch does. |
| `mouthDimpleLeft` / `Right` | `LlipCorner` / `RlipCorner` | **approximated.** Nearest thing to the dimpling pull; only ever driven to ~0.2 by `mtRandomized`. |
| `mouthUpperUpLeft` / `Right` | `LlipUp` / `RlipUp` | exact |
| `mouthLowerDownLeft` / `Right` | `LlipDown` / `RlipDown` | exact |
| `mouthShrugLower` | `Chin` | **approximated.** ARKit mouthShrugLower is the chin-boss raise that pushes the lower lip up. |
| `browDownLeft` / `Right` | `LbrowDown`×1 + `LLbrowDown`×0.6 (mirrored) | **combined.** VALID splits each brow into inner and outer; ARKit browDown is the whole brow, weighted to the inner half. |
| `browInnerUp` | `LbrowUp`×1 + `RbrowUp`×1 | **combined.** ARKit has one inner-brow shape; VALID has two. |
| `browOuterUpLeft` / `Right` | `LLbrowUp` / `RRbrowUp` | exact (LL/RR is the outer half) |
| `cheekPuff` | `Lblow`×1 + `Rblow`×1 | **combined.** ARKit cheekPuff is bilateral; VALID splits it per side. |
| `noseSneerLeft` / `Right` | `Lnostril`×1 + `Ldisgust`×0.6 (mirrored) | **combined.** A sneer is the nostril flare *plus* the wrinkle that lifts the upper lip; neither alone reads. |
| `tongueOut` | `OutMiddle_tg` | exact — VALID rigs the tongue on the lower-teeth mesh |

### 4.3 Gaze — 8 shapes, generated rather than mapped

VALID has no `eyeLook*` shapes at all, and it matters more than it sounds.

**TalkingHead never rotates the `LeftEye`/`RightEye` bones.** It reads their world
*position* (`:1386` for avatar height, `:3912` for `speakTo` targeting) and nothing
else. Gaze is 100% morph-driven: `animFactory` translates `eyesRotateX/Y` into
`eyeLookUp/Down/In/OutLeft/Right` at `:2251-2258`, and the eye-contact path assigns to
those same keys every frame at `:2582-2587`. An avatar without them has a fixed stare —
on a presenter whose whole job is to look at the room, that is not cosmetic.

So the converter **generates** them from the real geometry: `h_L_eye` and `h_R_eye` are
their own meshes rigged to the eye joints, and each shape is those meshes' vertices
rotated **8°** about the eyeball centre. Not an approximation of a different shape —
actual eyeball rotation.

8° is deliberate: TalkingHead drives these to 1.0 on a hard glance, a human eye's
comfortable excursion before the head follows is roughly 10-15°, and overshooting is
what makes a synthesised gaze look deranged.

Every axis is measured off the rig, never assumed — the left-right axis from the two
eyeballs' own rest positions, the up axis from Neck→Head — and the L/R assignment is
checked against the joints the eyeballs are actually weighted to, so the stage bails
rather than guessing on a rig built facing the other way. `gazeSideA` / `gazeSideB` in
`shots/avatar/avatar-03-expression-sheet.png` are the proof that the in/out signs are
right: if either were inverted, one of those frames would be cross-eyed.

### 4.4 Deliberately NOT authored

`mouthOpen`, `mouthSmile`, `eyesClosed`, `eyesLookUp`, `eyesLookDown`. TalkingHead
synthesises all five from ARKit shapes via `mtExtras` at load (`:1271-1276`), and
authoring them here would only override that with something worse. The converted file
carries 67 targets on disk and `mtAvatar` reports 81 keys at runtime; the difference is
those five plus the nine `mtCustoms`.

---

## 5. What is absent or inert, and why that is survivable

Six targets ship as **zero-delta placeholders** — present by name, no geometry. They
live on `h_L_gland`, the 138-vertex lacrimal caruncle, so six of them cost about 5 KB
instead of the ~800 KB they would cost on the 22k-vertex face. TalkingHead unions the
morph dictionaries of every mesh under the `Armature` to build `mtAvatar` and never
asks which mesh a key came from.

| Target | Why inert |
|---|---|
| `viseme_sil` | **Correct, not a compromise.** Silence is the rest pose, which is also what every other viseme relaxing to 0 renders. Traced through the published 1.7.0 tarball: no lipsync module ever *emits* `viseme_sil` (in `lipsync-en/de/fi/fr` it appears only as a row in the `visemeDurations` table), its one consumer is `resetLips()`, and that is guarded. |
| `mouthRollLower` | No analogue — Daz/Mimic has no lip-roll shape at all. |
| `mouthRollUpper` | No analogue. |
| `mouthShrugUpper` | No analogue. `Chin` covers the lower shrug; faking the upper one from the disgust shape drags the nose with it. |
| `mouthPressLeft` | No analogue. `JawCompress` is the only press shape and it is bilateral, already spent on `mouthClose`; faking a one-sided press from it would drive `mouthClose` twice. |
| `mouthPressRight` | As above. |

**Why they exist at all rather than simply being absent.** The loader never validates
morph targets, so a missing ARKit name does not throw *there*. It throws in the render
loop. `animate()` reads 20 `mtRandomized` names at `:2619` —
`j = this.mtAvatar[i]; if (!j.needsUpdate)` — with no guard, and four eye-gaze names at
`:2584-2587` the same way. All five of the shapes above are in `mtRandomized`. Absent,
they produce a `TypeError` on every frame that happens to pick them; the rAF is
rescheduled before the body runs, so the loop survives, the avatar freezes, and the
console fills. Present-and-inert costs the idle micro-expression one knob out of twenty.
That is the trade, and it is the right way round.

This failure mode was reproduced deliberately during development — and then
accidentally, by a test harness that emptied `mtRandomized` to freeze the idle jitter
and indexed it with `undefined`, producing the identical error and very nearly
convicting a working avatar of being a mannequin.

---

## 6. Acceptance — the evidence

### The gate

```
$ node tools/check-avatar-glb.mjs assets/avatar.glb
assets/avatar.glb
  6,877,280 B (6.56 MiB) · 92 nodes · 67 morph targets
  scene roots: Armature
  Armature root: present
  bones: 52/52 present, 0 missing
  eyes: 0 missing
  morph mesh "H_DDS_HighRes" · 52 targets · inside Armature
  morph mesh "h_L_eye" · 4 targets · inside Armature
  morph mesh "h_L_gland" · 6 targets · inside Armature
  morph mesh "h_R_eye" · 4 targets · inside Armature
  morph mesh "h_TeethDown" · 21 targets · inside Armature
  visemes: 15/15 present, 0 missing
  visemes zero-delta: [viseme_sil] — viseme_sil is the rest pose and is correct
  ARKit: 52/52 present, 0 missing
  ARKit present but ZERO-DELTA (inert placeholders): 5 → mouthRollLower, mouthRollUpper,
    mouthShrugUpper, mouthPressLeft, mouthPressRight
  extensionsUsed: EXT_texture_webp

✓ PASSES — this GLB satisfies the TalkingHead 1.7.0 rig + blend-shape contract.
```

### The motionless-mannequin test

A clean load proves nothing — that *is* the failure mode. The real test loads the
converted GLB in headless Chromium through the T1 vendor bundle, plays a synthetic
utterance through `speakAudio()`, and samples the raw `morphTargetInfluences` arrays
three.js hands the GPU, once per rendered frame. All 14 articulating visemes rise
during speech and all 15 return to exactly 0 afterwards:

```
  samples: 398 rendered frames over the utterance (~60.2 fps, software WebGL)
    viseme_sil  0         0f
    viseme_PP   0.8957    9f     viseme_SS   0.5984   22f
    viseme_FF   0.8996   55f     viseme_nn   0.5998   10f
    viseme_TH   0.5986   16f     viseme_RR   0.5995   28f
    viseme_DD   0.5998   37f     viseme_aa   0.5986   54f
    viseme_kk   0.5995   29f     viseme_E    0.5961   20f
    viseme_CH   0.5899   18f     viseme_I    0.5952   34f
                                 viseme_O    0.5947   16f
                                 viseme_U    0.5863   22f
  rest after: 0 viseme(s) non-zero

  visemes driven above 0.15: 14/14
✓ THE MOUTH MOVES. Visemes rise during speech and return to rest after.
```

The test line — *"Baggage moves through the check point to zone four via cargo gate
thirty five which our system watches for you"* — was **computed** against the pinned
`lipsync-en`, not written by ear. Two earlier drafts silently missed `PP` and `CH` and
therefore proved nothing about those two shapes.

Two measurement traps are worth knowing if this is ever re-run:

- **Sample per rendered frame, not on a timer.** Under software WebGL a 22k-vertex,
  55-morph head renders at about 1 fps and saturates the main thread; a 33 ms
  `setInterval` fired *three* times across a three-second line.
- **Blank the draw call for the measurement.** `animate()` computes every influence and
  only then calls `this.render()` (`:2725`), so stubbing the draw leaves the numbers
  untouched and takes the loop to 60 fps. Drawing is restored for the stills.
- **Freeze before screenshotting a live frame.** A software screenshot takes about a
  second, by which time the morph has eased away — the first three attempts at
  `avatar-02-mid-viseme.png` all came back with a closed mouth on an avatar that was
  demonstrably talking. Calling `th.stop()` at the instant the threshold is crossed
  holds the last drawn frame, which is the frame the reading describes. The committed
  still was captured with a single viseme held at 0.850.

### T1's vendor smoke test, unchanged

```
$ node vendor/smoke.cjs
ctor=ok armature=true visemeMorphs=15 marker=fired markerAfterStop=false
  avatar loaded in 152ms · 81 morph targets · queue drained to 0
  rig: root "Armature" · 52 required bones present · eyes [LeftEye,RightEye]
  visemes: 15/15 present
  offline lipsync 'sources' → [SS,aa,RR,SS,I,SS]
bundle runs offline from file://, no page errors.
```

`visemeMorphs=15`, not 14. T1 recorded an acceptance deviation because `mpfb.glb` ships
no `viseme_sil`; that deviation is now closed and `vendor/smoke.cjs`'s
`visemesMayOmit: ['sil']` tolerance is no longer being used by anything.

`node build.js` and `node shoot.js` both pass unchanged — 28 shots, no overflow, no page
errors.

### Screenshots

| File | What it shows |
|---|---|
| `shots/avatar/avatar-01-rest.png` | at rest |
| `shots/avatar/avatar-02-mid-viseme.png` | mid-word, mouth open, during real speech |
| `shots/avatar/avatar-03-expression-sheet.png` | 24 stills — every viseme, both blinks separately, smile, frown, brows, all four gaze directions, cheek puff, tongue |
| `shots/avatar/avatar-04-candidates.png` | the three top-ranked candidates at full/upper/head, which is how the choice was made |
| `shots/avatar/avatar-05-retarget-before-after.png` | before and after the rest-pose retarget, against the c-frame preview and the CC0 fallback |

(`shots/` is gitignored — these are evidence for review, not build output.)

---

## 7. If this ever needs backing out

The fallback of record is `mpfb.glb`, CC0:

```
https://raw.githubusercontent.com/met4citizen/TalkingHead/main/avatars/mpfb.glb
36,815,920 B · sha256 63c645a2a863b9972e9a9c2ed576a1de4c390b8475508e1473e69c87a3ee299c
```

CC0 is granted per-asset in the TalkingHead README (the same list marks its four
siblings non-commercial, so it is deliberate rather than incidental). CC0 requires no
attribution; crediting MakeHuman/MPFB and Mika Suominen is prudent belt-and-braces
anyway, since the upstream MakeHuman packs are described as "CC0/CC-BY".

It costs 30 MB more, ships no `viseme_sil`, and wears a logo t-shirt and jeans. It is
not recommended, and it is not needed — but it is a `git revert` away and the gate will
tell you immediately which one you are holding.

---

## 8. Size

| | |
|---|---|
| VALID source (meshopt-compressed) | 1,718,008 B · 1.64 MiB |
| **shipped** `assets/avatar.glb` (sparse accessors) | **6,877,280 B · 6.56 MiB** |
| previous CC0 avatar | 36,815,920 B · 35.11 MiB |

The whole difference is morph-target storage: 67 targets over a 22k-vertex mesh is
~30 MB of mostly zeroes, because a viseme does not move the scalp. glTF sparse
accessors store only the vertices that do move.

**Not `quantize()`.** Measured end to end, all five orderings, on `White_F_2_Busi`
(the candidate the pipeline was developed against — the shipped `Black_F_1_Busi` lands
within 2% of the `sparse` row):

| Pipeline | Bytes | Correct? |
|---|---|---|
| none | 32,000,440 | ✓ |
| **sparse** | **6,747,852** | **✓ shipped** |
| quantize | 21,703,336 | ✓ |
| sparse → quantize | 21,703,336 | ✓ (quantize undoes the sparsity) |
| quantize → sparse | 4,350,992 | ✗ **corrupt** |

The last row is the trap. gltf-transform's sparse writer zeroes the values of a
*normalized integer* accessor, so every morph delta comes back all-zero — the smallest
file is also a perfect mannequin, and nothing but the gate's zero-delta detector tells
the two apart. 2.4 MB is not worth a silent mouth. If that bug is ever fixed,
`quantize → sparse` is the next win and one gate run will confirm it.

Draco is excluded on principle, not on size: `dracoDecoderPath` fetches from
`gstatic.com` and this ships air-gapped. Meshopt is excluded because the pinned loader
cannot decode it.

`dist/index.html` does not yet inline the avatar — `build.js` currently inlines only
`src/`, the fonts and the vendor bundle (0.84 MB). When it does, expect roughly
6.56 MiB × 4/3 for base64, i.e. about 9.6 MB, against about 47 MB with the CC0 avatar.
