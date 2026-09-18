# The avatar — VALID, and what it took to make it work

`assets/avatar.glb` is a **VALID** avatar, converted for TalkingHead 1.7.0 by
`tools/convert-valid-avatar.mjs` and gated by `tools/check-avatar-glb.mjs`.

    node tools/convert-valid-avatar.mjs        # regenerates assets/avatar.glb
    node tools/check-avatar-glb.mjs assets/avatar.glb

Both are deterministic. Three consecutive runs produce byte-identical output.

This file is the source of truth for the avatar: which one, why, what the converter
does to it, and what the evidence is. It is meant to be read on its own.

---

## 1. Provenance and licence — the record

Dated **2026-09-18**. This section exists because the grant for a free 3D asset is a
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
| Avatar | `Hispanic_F_3_Busi` |
| Source URL (pinned) | `https://raw.githubusercontent.com/c-frame/valid-avatars-glb/c4719df7a2b60a96cc7f56d67e247674b68c4ea7/avatars/Hispanic/Hispanic_F_3_Busi.glb` |
| Source URL (`main`) | `https://raw.githubusercontent.com/c-frame/valid-avatars-glb/main/avatars/Hispanic/Hispanic_F_3_Busi.glb` |
| Source bytes | 2,064,884 |
| Source sha256 | `82840256e75dbab736b95757b9a8fb1ba46c265b04f11d185f7ac139d2d8161f` |
| **Shipped** `assets/avatar.glb` bytes | **7,381,268** (7.04 MiB) |
| **Shipped** `assets/avatar.glb` sha256 | **`70fbdc0efd10b595c7181dc0e4082d8a415e68f6b46d5522ccf73f83d0cf8e35`** |

The pinned-commit URL and the `main` URL were fetched separately and compared
byte-for-byte on 2026-09-18: **identical**, same 2,064,884 bytes, same sha256. The
pinned URL is nevertheless what the converter uses, because it survives an upstream
force-push. `tools/convert-valid-avatar.mjs:1240` re-verifies the source sha256 on
every run and refuses to proceed on a mismatch, so an upstream change cannot slip
through quietly. (The check is skipped only for an explicit `--source` override, which
is the debug path and never builds the shipped asset.)

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

Two things, in order:

- **`Black_F_1_Busi`**, the previous VALID pick. Same library, same licence, same
  converter. Replaced for the reasons in §2 — it is not a rights or a rigging problem.
- **`mpfb.glb`**, CC0, 36,815,920 B, sha256
  `63c645a2a863b9972e9a9c2ed576a1de4c390b8475508e1473e69c87a3ee299c`. Landed as the
  only usable avatar in the TalkingHead repo (the other five are non-commercial) and
  still the fallback of record — see §8. Its licence is fine; a MakeHuman figure in a
  logo t-shirt and jeans is not what presents an airport platform to a CFO, and 35 MiB
  for it is five times what the VALID conversion costs.

---

## 2. Which avatar, and why

The operator's verdict on the previously published artifact was that the presenter
"looks like a kid did it". Two separate things were causing that, and only one of them
is a lighting problem. This section is about the one that is a *casting* problem.

### 2.1 The finding that decided it: the female `Busi` outfit is not the male one

All **35** validated avatars were converted and rendered through the real pipeline —
that is every non-`X_`-prefixed row in VALID's own agreement table, 16 female and 19
male. The outfit names are misleading in a way that is invisible from the model list:

- **Male `Busi`** is a charcoal suit over a white shirt with a striped tie. It reads
  as business dress immediately.
- **Female `Busi`** is an open blazer over a **lilac crew-neck knit**. The blazer is
  fine. The lilac panel is not: at presenter scale it is a large, saturated,
  mid-value block in the centre of frame, and combined with VALID's glossy default
  material (§6) **that panel is what reads as a "shiny catsuit"** in the currently
  published artifact.

**`Hispanic_F_3_Busi` is the exception. Her knit is grey.** That is the primary
reason for the pick, and it is measured rather than asserted — see §2.4.

### 2.2 The incumbent's selection argument no longer holds

`Black_F_1_Busi` was chosen on four criteria, and the one that actually broke the tie
was this (quoting the superseded version of this file):

> …the only one of the top-ranked candidates whose face survives TalkingHead's default
> lighting, which clips the palest avatars to white.

That is not an argument about an avatar. It is **a workaround for a lighting bug** —
TalkingHead 1.7.0 ships `lightAmbientIntensity: 2`, `lightDirectIntensity: 30` and ACES
tone mapping, which blows out pale skin. That bug is being fixed separately. Selecting
an avatar to survive a defect, and then fixing the defect, leaves the selection
resting on nothing, so the criterion is retired.

Separately, `Black_F_1_Busi` **reads about thirty years old**. For a presenter fronting
a platform walkthrough to airport executives that is young for the role, and it
contributed directly to the operator's complaint.

### 2.3 What was held fixed

**The presenter stays female.** This is an operator decision, not a derived one. It
also keeps the name **Iris** working — she is named off AIRIS — and the rest of the
repo already assumes it (`showAvatar({ body: 'F' })`, and `src/scenes.js` speaks in
her voice).

**Business attire and validated-only** are unchanged: the `Busi` outfit, and none of
the 35 extra `X_`-prefixed models that were never put through the validation study.

### 2.4 The colour claim, measured

"Grey, not lilac" is the whole case, so it is measured rather than eyeballed. Both
avatars were rendered through the repo's own `vendor/talkinghead.bundle.js` at
identical camera, identical lighting, on a **flat black** backdrop (so no blue panel
gradient can bleed into the reading), and every torso pixel was binned by hue:

| | dominant hue buckets (share, mean saturation) | verdict |
|---|---|---|
| `Black_F_1_Busi` (incumbent) | 240° 38.9% sat 0.063 · 300° 24.6% sat 0.012 · **270° 24.0% sat 0.170** · **255° 10.2% sat 0.105** | **34% of the torso sits in the violet band at real saturation — lilac, confirmed** |
| `Hispanic_F_3_Busi` (this one) | 210° 59.8% · 225° 21.9% · 240° 14.4% · 195° 1.3% | **nothing in the 255–300° violet band at all — the lilac is gone** |

**Being precise about what "grey" means here, because it is not neutral grey.** The
new suit measures mean saturation 0.178 at hue 205–240°, i.e. a **desaturated slate
blue-grey**. It reads as tailoring rather than as a costume, which is the thing that
matters, but anyone expecting a neutral charcoal should know it is cooler than that.
Some of that is the material and the `RoomEnvironment` probe TalkingHead installs,
not the albedo — the flat-black render above still measures it, so it is not just
backdrop bleed.

Also worth recording, because the `upper` camera crop is misleading: at `upper` the
frame cuts at the chest, which hides the jacket hem, the single button and the
trousers, and the remaining torso-plus-arms genuinely does read as a leotard. At
`full` the garment is unambiguous — a hip-length single-button blazer, flared
trousers, black flats. **The "catsuit" read is part garment gloss (fixed in §6) and
part framing** (owned by the camera/lighting work, not by this file).

### 2.5 The cost, stated plainly: validated agreement drops

The superseded version of this file made **highest validated agreement** its headline
criterion. This pick abandons that, and the doc should say so rather than quietly drop
the table.

VALID publishes per-avatar agreement rates — the proportion of 132 participants across
33 countries who read each avatar as the ethnicity and gender it was built to
represent (`Metadata/Agreement-Rates/All-Agreement-Rates.csv`, read at the pinned
commit). Ranking all 16 validated female avatars by the *lower* of their
own-ethnicity and female agreement:

| rank | avatar | own-ethnicity | female | min |
|---|---|---|---|---|
| 1 | Asian_F_01 | 0.98 | 0.98 | 0.98 |
| 2 | **Black_F_01** (incumbent) | **0.98** | **0.98** | **0.98** |
| 3 | White_F_02 | 0.96 | 0.98 | 0.96 |
| 4 | Asian_F_03 | 0.95 | 0.97 | 0.95 |
| 5 | Black_F_03 | 0.95 | 0.97 | 0.95 |
| 6 | Black_F_02 | 0.98 | 0.94 | 0.94 |
| 7 | White_F_01 | 0.94 | 0.97 | 0.94 |
| 8 | White_F_03 | 0.94 | 0.99 | 0.94 |
| 9 | Asian_F_02 | 0.93 | 0.96 | 0.93 |
| 10 | Hispanic_F_01 | 0.64 | 0.95 | 0.64 |
| **11** | **Hispanic_F_03** (this one) | **0.59** | **0.93** | **0.59** |
| 12 | AIAN_F_01 | 0.55 | 0.64 | 0.55 |
| 13 | AIAN_F_02 | 0.55 | 0.75 | 0.55 |
| 14 | Hispanic_F_02 | 0.52 | 0.95 | 0.52 |
| 15 | MENA_F_01 | 0.37 | 0.98 | 0.37 |
| 16 | MENA_F_02 | 0.32 | 0.98 | 0.32 |

So this is **11th of 16, down from joint 1st**. Why that is an acceptable trade, and
what it would take to reverse it:

- **The figure that matters for Iris holds.** Gender agreement is **0.93** — she reads
  as female to 93% of a 33-country sample. That is the only agreement figure this
  project makes a claim about.
- **The low number is ethnic *ambiguity*, not illegibility.** `Hispanic_F_03` splits
  Hispanic 0.59 / White 0.52 / AIAN 0.22. VALID's agreement measure exists so that
  researchers studying representation can assert an avatar reads as a specific
  demographic. **This project asserts nothing about the presenter's ethnicity**, so an
  avatar that reads as more than one thing costs us nothing we were using.
- **It is not a rigging or a licence difference.** Same library, same MIT grant, same
  Daz morph set, same converter, same gate.

If the client wants the agreement figure back, `Asian_F_01` is the top-ranked
alternative — **but it must be re-checked against §2.1 first**, because the lilac knit
is the default in this outfit and the grey is the exception. Do not swap on the
agreement table alone.

### 2.6 Changing it

One constant and a hash: `SOURCE` in `tools/convert-valid-avatar.mjs` (avatar name,
ethnicity, URL, byte count, sha256), then re-run the converter and the gate. Nothing
else in the pipeline knows which avatar it is — verified by converting four of them,
not asserted. Two things to expect on any swap:

- the `MAY_BE_INERT` set in `tests/avatar.test.mjs` may move (§5 says exactly when);
- the file size moves, and `dist/index-3d.html` has a hard ceiling (§9).

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
source textures are already webp, so there is nothing to gain by re-encoding them.

`Hispanic_F_3_Busi` ships four webp textures — a body colour map and normal map, plus
a **hair** colour map and normal map (see 3.2).

### 3.2 No `Armature`, and the meshes outside it

VALID's scene roots are all siblings — meshes and skeleton together. For this avatar
there are **nine**: `H_DDS_HighRes, h_L_eye, h_L_gland, h_R_eye, h_R_gland,
h_TeethDown, h_TeethUp, h_wig, Hips`. Two failures, and the second is the one that
bites:

- `showAvatar()` throws `Avatar object Armature not found` on `opt.modelRoot`.
- `:1251` collects morph meshes with `this.armature.traverse(...)`. A root named
  `Armature` placed over only the skeleton clears the first check and still yields
  **zero** morph meshes, because the meshes are siblings of the skeleton, not
  descendants. `tools/check-avatar-glb.mjs` checks for this explicitly; a flat
  node-name scan cannot see it.

The converter creates `Armature` at the identity and reparents all nine roots under it.

**`h_wig` is new relative to the incumbent** and is worth knowing about: this avatar
carries its hair as separate geometry with its own `Hair` material and its own colour
and normal maps. `Black_F_1_Busi` had no hair mesh at all — eight scene roots, two
textures, one `_Body` material — because her close-cropped hair is part of the head
mesh and its body texture. It needs no special case anywhere — `buildArmature` reparents whatever roots it finds, the sheen
clamp walks whatever materials exist, and the wig has no morph targets so the morph
stage skips it — but it is most of the size difference: **+346,876 B of source and
+503,988 B of converted output.** The source also carries eight skins (one per mesh,
all with identical joints and bind matrices); `dedup()` folds them to one.

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
| VALID (broken) | 42° | Hips 128°, Spine 142°, LeftUpLeg 154°, RightFoot 145°, both shoulders >100° |

Those are the bones that orient the whole body. The un-retargeted result is upright-ish,
turned ninety degrees away from camera, chin in the air, one arm folded behind the
back. No error, no warning.

The converter rebuilds the bind pose with:

- the **orientations** the template will impose — read out of the pinned
  `talkinghead.mjs` by parsing its own `poseTemplates` object literal, not transcribed,
  so a version bump either updates automatically or fails loudly;
- the **offset directions** of a known-good rig (`REFERENCE_BONE_DIR`, measured off
  `mpfb.glb`, which is demonstrably compatible);
- VALID's own **bone lengths**, so the proportions stay VALID's;

and then moves the mesh onto it with linear blend skinning, setting
`inverseBindMatrix = inverse(newWorldMatrix)` so the new bind *is* the new rest and
`showAvatar()`'s overwrite becomes a no-op. For this avatar that is **52 bones
re-oriented, 34,183 vertices and 96 morph targets re-posed**.

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

The counts are **identical** to the incumbent's (65 + 31), which is why the mapping
table below needed no change for this swap, and why the inert set did not move (§5).

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
| `mouthFunnel` | `AO_a`×0.55 + `t_AO_a`×0.55 + `Kiss`×0.45 | **synthesised.** No counterpart. Funnel is an open O with the lips carried forward. |
| `mouthLeft` / `mouthRight` | `LlipSide` / `RlipSide` | exact. **The smallest real deltas in the file** — see §5. |
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
rather than guessing on a rig built facing the other way. Measured on this avatar:

```
gaze: eyeballs at L[0.0613, 1.6132, 0.1214] R[0.0028, 1.6184, 0.1211]
gaze: right axis [-0.0586, 0.0051, -0.0003] · up axis [0.0072, 0.0884, 0.0442]
```

The right axis is dominated by X and the up axis by Y, which is what a correctly
measured humanoid rig looks like; a cross-eyed result would show up as a sign flip here
before it showed up on screen.

### 4.4 Deliberately NOT authored

`mouthOpen`, `mouthSmile`, `eyesClosed`, `eyesLookUp`, `eyesLookDown`. TalkingHead
synthesises all five from ARKit shapes via `mtExtras` at load (`:1271-1276`), and
authoring them here would only override that with something worse. The converted file
carries 67 targets on disk and `mtAvatar` reports 81 keys at runtime; the difference is
those five plus the nine `mtCustoms`.

---

## 5. What is inert, and why that is survivable

Six targets ship as **zero-delta placeholders** — present by name, no geometry. They
live on `h_L_gland`, the 138-vertex lacrimal caruncle, so six of them cost about 5 KB
instead of the ~800 KB they would cost on the 22k-vertex face. TalkingHead unions the
morph dictionaries of every mesh under the `Armature` to build `mtAvatar` and never
asks which mesh a key came from.

`tests/avatar.test.mjs` asserts this set **exactly** — not "at most six", not "these
are ignored". A seventh appearing is a failure, and one of the six silently gaining
geometry is also a failure.

| Target | Why inert |
|---|---|
| `viseme_sil` | **Correct, not a compromise.** Silence is the rest pose, which is also what every other viseme relaxing to 0 renders. Traced through the published 1.7.0 tarball: no lipsync module ever *emits* `viseme_sil`, its one consumer is `resetLips()`, and that is guarded. |
| `mouthRollLower` | No analogue — Daz/Mimic has no lip-roll shape at all. |
| `mouthRollUpper` | No analogue. |
| `mouthShrugUpper` | No analogue. `Chin` covers the lower shrug; faking the upper one from the disgust shape drags the nose with it. |
| `mouthPressLeft` | No analogue. `JawCompress` is the only press shape and it is bilateral, already spent on `mouthClose`; faking a one-sided press from it would drive `mouthClose` twice. |
| `mouthPressRight` | As above. |

### 5.1 Re-baselined across the avatar swap — and it did not move

A source swap is exactly the change that ought to shift this set, so all 67 targets
were re-measured on **both** files rather than the set being re-asserted on faith.
Result: **the same six names, nothing added, nothing removed.**

That is not luck, and the reason tells you when it *will* move. These six are
placeholders **by construction** — they are the six specs in
`tools/convert-valid-avatar.mjs` whose `mix` is literally `{}`, so they are emitted as
zero-delta accessors whatever the source contains. The other 61 are built from named
Daz/Mimic shapes, and both avatars carry the identical source morph set (65 on
`h_expressions`, 31 on `h_teeth`), so all 61 resolved and moved on both. **This set
moves only if a future source avatar is missing one of the mapped Daz shapes**, at
which point `remapPrimitive` skips the spec and the placeholder branch picks it up —
precisely the drift the exact-set assertion exists to catch.

Measured maxima either side of the swap (largest |POSITION| delta per target, max over
the meshes carrying it):

| | `Black_F_1_Busi` | `Hispanic_F_3_Busi` |
|---|---|---|
| targets | 67 | 67 |
| exactly zero | 6 | 6 |
| above the 1e-3 floor | 61 | 61 |
| smallest articulating viseme | `viseme_FF` 0.00446 | `viseme_FF` 0.00403 |
| largest viseme | `viseme_RR` 0.03560 | `viseme_RR` 0.03564 |
| **tightest margin in the file** | `mouthLeft`/`mouthRight` 0.00218 | `mouthLeft`/`mouthRight` **0.00128** |

`mouthLeft`/`mouthRight` are `LlipSide`/`RlipSide`, a sideways lip slide that genuinely
barely displaces a vertex. At 1.3× the floor they are now the closest real shape to it.
If a later avatar pushes them under 1e-3 the symptom is the `moving >= 60` assertion
dropping to 59, **not** the inert-set assertion — read that failure as "a real shape
got small", not "a delta got zeroed".

### 5.2 Why they exist at all rather than simply being absent

The loader never validates morph targets, so a missing ARKit name does not throw
*there*. It throws in the render loop. `animate()` reads 20 `mtRandomized` names at
`:2619` — `j = this.mtAvatar[i]; if (!j.needsUpdate)` — with no guard, and four
eye-gaze names at `:2584-2587` the same way. All five of the ARKit shapes above are in
`mtRandomized`. Absent, they produce a `TypeError` on every frame that happens to pick
them; the rAF is rescheduled before the body runs, so the loop survives, the avatar
freezes, and the console fills. Present-and-inert costs the idle micro-expression one
knob out of twenty. That is the trade, and it is the right way round.

This failure mode was reproduced deliberately during development — and then
accidentally, by a test harness that emptied `mtRandomized` to freeze the idle jitter
and indexed it with `undefined`, producing the identical error and very nearly
convicting a working avatar of being a mannequin.

### 5.3 How to measure morph deltas without getting a false green

**Read deltas through `getX/getY/getZ` (in three.js) or `getElement` (in
gltf-transform). Never scan the backing `.array`.**

This avatar's `h_TeethDown` morph attributes are **interleaved** — the gate reports
`19/22 interleaved` — because POSITION and NORMAL deltas share one bufferView at
stride 24. A naive `.array` scan therefore reads the neighbouring NORMAL deltas as if
they were positions.

That is not a nitpick. It is a **false green on exactly the failure the test exists to
catch**: `sparse()` zeroes POSITION and leaves the normals beside it untouched, so an
`.array` scan finds those normals and reports a dead target as healthy. Measured
against a deliberately zeroed avatar, scanning `.array` reported **13 of 14 dead
visemes as fine**.

---

## 6. The sheen — killed at convert time, not at runtime

This is the second half of "looks like a kid did it", and it is a material bug rather
than a casting one.

### 6.1 What it was

VALID's materials ship `roughnessFactor: 0.5, metallicFactor: 0` with **no
metallicRoughness texture** — verified on both avatars, so the specular lobe is one
flat number. 0.5 is semi-gloss plastic. Wool suiting and a knit are 0.7–0.9. The
result is a wet, patent-leather sheen across the suit and (on this avatar) the hair.

### 6.2 It is not the lighting and not the environment map

Established by elimination rather than argument. TalkingHead installs a
`RoomEnvironment` PMREM on `scene.environment` unconditionally, and `envMapIntensity`
is the only knob that reaches it — so that was the first suspect. An
`envMapIntensity` sweep at **1.0 / 0.45 / 0.18 / 0** produced **no visible
difference**. Clamping roughness turned wet vinyl into matt wool in one step.

### 6.3 What the converter does

`clampMaterials` in `tools/convert-valid-avatar.mjs`, run as stage 4 alongside the
morph work:

```js
for (const m of doc.getRoot().listMaterials()) {
  m.setRoughnessFactor(Math.max(m.getRoughnessFactor(), 0.72));
  m.setMetallicFactor(Math.min(m.getMetallicFactor(), 0.05));
}
```

- **Roughness floored at 0.72**, with `max()` so a material that is already matter is
  left alone.
- **Metallic capped at 0.05**, with `min()`. VALID already ships 0, so this changes
  nothing today — it is a guard so a future source avatar cannot reintroduce the same
  look silently.
- **Base colour, normals and textures are untouched.** This changes how the cloth
  catches light, not what colour it is.

On this avatar it reports:

```
materials: clamped 2 → _Body rough 0.5→0.72 metal 0→0 · Hair rough 0.5→0.72 metal 0→0
```

### 6.4 Why at convert time

Three reasons that all point the same way:

- **The artifact is then correct on its own terms.** Anyone loading
  `assets/avatar.glb` in any viewer gets the matt version. A runtime patch is
  invisible to every other tool.
- **A runtime patch would need a hook we do not own.** It has to run after the loader
  and before the first frame, on a code path TalkingHead owns — a hook to maintain
  across TalkingHead versions forever, to fix bytes we control.
- **The 3D lighting is being tuned separately against this artifact.** If the sheen
  were cancelled by a runtime patch, the lighting work would be tuning against a
  surface property that is not in the file it is holding.

Read back out of the shipped GLB in a real browser, with no runtime patching of any
kind, all eight meshes report `roughness=0.72 metalness=0, roughnessMap=false,
metalnessMap=false`. That is the proof the clamp is in the file.

### 6.5 What it fixes, and what it does NOT — read this before judging a screenshot

Measured, on a flat-black backdrop so the panel gradient cannot pollute the reading,
over the torso band, as a 2×2 of clamp × key-light. **The first metric anyone reaches
for is the wrong one**, which is worth saying because it made the clamp look
ineffective on the first pass:

> "% of pixels above 0.72 luminance" conflates a bright *diffuse* garment with a sharp
> *specular* highlight. A mid-grey suit under strong ambient has many bright pixels at
> any roughness. Gloss is the **shape** of the highlight, not its presence — so measure
> `p99 − p50` (how far the spike sits above the diffuse base), the mean 8×8 local
> standard deviation, and the mean luminance gradient. **Lower is matter on all three.**

| key light | roughness | lum p50 | local contrast | gradient |
|---|---|---|---|---|
| stock 30 | 0.50 | 0.502 | 0.01814 | 0.01234 |
| stock 30 | **0.72 (shipped)** | 0.470 | **0.01416** (−22%) | **0.00826** (−33%) |
| reduced 3 | 0.50 | 0.433 | 0.01792 | 0.01251 |
| reduced 3 | 0.72 | 0.424 | 0.01588 | 0.00967 |

Two conclusions, and the second one corrects an assumption that was worth testing:

1. **The clamp does what it was supposed to.** At stock lighting it removes **22% of
   the local contrast and 33% of the luminance gradient** in the garment — i.e. a third
   of the highlight structure. On screen the hard specular streaks on the shoulders,
   sleeves and trousers soften noticeably; it is most obvious at the `full` camera
   view, where the trousers stop looking like PVC.

2. **The key light and the clamp are ORTHOGONAL levers, not a gloss lever plus a
   multiplier.** Dropping `lightDirectIntensity` from 30 to 3 lowers overall brightness
   (p50 0.470 → 0.424) and leaves gloss essentially alone (local contrast 0.01416 →
   0.01588 — it does not improve, it drifts slightly the wrong way). So the intuition
   that "with the clamp in place, lowering the key light will finish the job" is
   **false, and was measured to be false.** What is left over after the clamp is
   dominated by `lightAmbientIntensity: 2` plus the unconditional `RoomEnvironment`
   PMREM, not by the directional light.

The practical consequence for whoever tunes the lighting: **the directional intensity
is not the knob for the remaining brightness** — ambient and the environment probe
are. And gloss is already handled here, in the file, so it does not need to be
re-fought in the renderer.

One thing the clamp explicitly does **not** fix, so nobody has to rediscover it: at the
`upper` camera crop the frame cuts at the chest, hiding the jacket hem, the button and
the trousers, and the remaining torso-plus-arms reads as a leotard however matt it is.
That is **framing**, and it belongs to the camera work (§2.4).

---

## 7. Acceptance — the evidence

`node tests/run.mjs` → **197/197 checks passed in 637.0s**, run alone on an otherwise
idle box (see the load-artifact note at the end of this section).

### Determinism

```
$ node tools/convert-valid-avatar.mjs && sha256sum assets/avatar.glb
70fbdc0efd10b595c7181dc0e4082d8a415e68f6b46d5522ccf73f83d0cf8e35  assets/avatar.glb
$ node tools/convert-valid-avatar.mjs && sha256sum assets/avatar.glb
70fbdc0efd10b595c7181dc0e4082d8a415e68f6b46d5522ccf73f83d0cf8e35  assets/avatar.glb
$ node tools/convert-valid-avatar.mjs && sha256sum assets/avatar.glb
70fbdc0efd10b595c7181dc0e4082d8a415e68f6b46d5522ccf73f83d0cf8e35  assets/avatar.glb
```

Three runs — the first cold (fetching the source), the rest from the
`node_modules/.cache` copy — byte-identical.

### The file-level gate

```
$ node tools/check-avatar-glb.mjs assets/avatar.glb
assets/avatar.glb
  7,381,268 B (7.04 MiB) · 123 nodes · 67 morph targets
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

A clean load proves nothing — that *is* the failure mode. `tests/avatar.test.mjs` loads
the shipped GLB in headless Chromium through the vendor bundle, reads the morph
**geometry** (the thing `sparse()` destroys), then plays a synthetic utterance and
samples the raw `morphTargetInfluences` arrays three.js hands the GPU, once per
rendered frame:

```
      assets/avatar.glb — 7,381,268 B (7.04 MiB)
ok  tools/check-avatar-glb.mjs passes against the shipped GLB
ok  the file carries all 15 Oculus visemes  — visemes: 15/15 present, 0 missing
ok  the file carries all 52 ARKit shapes  — ARKit: 52/52 present, 0 missing
ok  no extension the pinned loader cannot decode offline (no meshopt, no draco)
ok  the 3D presenter is actually up  — backend=talkinghead
      interleaved morph attributes (read via getX/Y/Z, not .array): h_TeethDown: 19/22 interleaved
ok  the loaded avatar exposes 15 viseme morph targets  — 15: ok
ok  every articulating viseme has REAL GEOMETRY behind it — this is the mannequin check
      14/14 move · smallest viseme_FF=0.004033 · largest viseme_RR=0.035639
ok  the inert set is EXACTLY the six documented placeholders
      ["mouthPressLeft","mouthPressRight","mouthRollLower","mouthRollUpper","mouthShrugUpper","viseme_sil"]
ok  no morph target is missing its position deltas entirely  — []
ok  the rig as a whole carries real deformation  — 66 of 72 morph targets have non-zero geometry
ok  viseme influences MOVE mid-line — the mouth is being driven, not just modelled
      7 visemes peaked over 0.05: viseme_FF=0.90 viseme_DD=0.60 viseme_SS=0.23
        viseme_nn=0.59 viseme_E=0.28 viseme_I=0.40
ok  and they are driven to a real amplitude, not a twitch  — peak influence 0.898 over 11 frames
ok  and they return to rest once the line is stopped  — largest residual influence 0.0000
      busiest frames [ms, influence, viseme]: [[3,0.535,"viseme_DD"],[401,0.588,"viseme_nn"],
        [809,0.399,"viseme_I"],[1254,0.426,"viseme_nn"],[1733,0.595,"viseme_DD"],[2156,0.617,"viseme_U"]]
```

Peaks land **through the line**, not at one edge, and every viseme returns to **exactly**
0 afterwards. Note `66 of 72` rather than `61 of 67`: at runtime `mtExtras` synthesises
five more keys from the ARKit shapes (§4.4), so 61 real + 5 synthesised move and the same
6 placeholders stay flat.

The suite carries its own **negative control**, which is the part that makes the rest
believable: it rebuilds the 4.35 MB failure — load the real avatar, zero every morph
POSITION accessor exactly as `gltf-transform`'s `sparse()` silently did — and requires
both detectors to go red on it, *despite* 15/15 visemes and 52/52 ARKit still being
present by name. It also demonstrates that influences keep animating beautifully on a
face that cannot move, which is why the geometry check has to exist at all.

Two measurement traps, if this is ever re-run:

- **Sample per rendered frame, not on a timer.** Under software WebGL a 34k-vertex,
  55-morph head can render at ~1 fps and saturates the main thread; a 33 ms
  `setInterval` fired *three* times across a three-second line.
- **Freeze before screenshotting a live frame.** A software screenshot takes about a
  second, by which time the morph has eased away. Calling `th.stop()` at the instant
  the threshold is crossed holds the last drawn frame, which is the frame the reading
  describes.
- **Do not run two software-WebGL suites at once.** `tests/autoadvance.test.mjs`
  asserts a wall-clock stall threshold (`worstStall < 10000` ms); a second headless
  Chromium on the same box pushed it to 10,514 ms and failed a green tree. That
  failure is a **load artifact, not a defect** — the same tree passes run alone. If
  you see it, check `ps -eo args | grep -cE '^node tests/run\.mjs'` before debugging
  anything.

### Screenshots

Rendered through the repo's own `vendor/talkinghead.bundle.js`, in the rail's real 1:1
panel, with **no runtime material patching** — so what is on screen is what is in the
file.

| File | What it shows |
|---|---|
| `shots/avatar/avatar-01-rest.png` | at rest: eyes open, mouth closed |
| `shots/avatar/avatar-02-mid-viseme.png` | mid-word during real speech — `viseme_I` frozen at 0.604 with blink at 0.098, so the mouth is open and the eyes are not shut |
| `shots/avatar/avatar-06-sheen-A-clamped.png` | the sheen A/B, shipped (roughness 0.72) |
| `shots/avatar/avatar-06-sheen-B-unclamped.png` | …and the control: same GLB, roughness forced back to 0.50 at runtime |
| `shots/avatar/avatar-07-full-clamped.png` | whole garment, clamped — this is the view that shows it is a trouser suit |
| `shots/avatar/avatar-07-full-unclamped.png` | …and unclamped, where the trousers read as PVC |
| `shots/avatar/avatar-08-colour-old-lilac.png` | `Black_F_1_Busi` on flat black — the lilac knit |
| `shots/avatar/avatar-08-colour-new-grey.png` | `Hispanic_F_3_Busi` on flat black — the grey knit |

The mid-viseme still needs a **conjunction** to be worth anything: freeze on a wide
vowel over 0.45 **and** blink under 0.12. Freezing on the first viseme threshold alone
is how you get a still of an avatar blinking at the floor — which is exactly what the
first attempt produced.

(`shots/` is gitignored — these are evidence for review, not build output.)

---

## 8. If this ever needs backing out

The immediate predecessor is `Black_F_1_Busi`, same library and licence — see §1
"What this replaces" and §2 for why it went. Reverting is the `SOURCE` constant plus
its sha256 (`e8158244ef013f65fa4724d0831a860bd6bc4bb5fdaa1b81c0050910beb44a83`,
1,718,008 B) and a converter run. Note the lilac knit comes back with it.

The deeper fallback of record is `mpfb.glb`, CC0:

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

## 9. Size

| | |
|---|---|
| VALID source (meshopt-compressed) | 2,064,884 B · 1.97 MiB |
| **shipped** `assets/avatar.glb` (sparse accessors) | **7,381,268 B · 7.04 MiB** |
| previous VALID avatar (`Black_F_1_Busi`) | 6,877,280 B · 6.56 MiB |
| previous CC0 avatar (`mpfb.glb`) | 36,815,920 B · 35.11 MiB |

The +503,988 B over `Black_F_1_Busi` is the `h_wig` mesh and its two extra textures
(§3.2), not a regression in the pipeline.

**Two hard ceilings, both asserted by `tests/build.test.mjs`:**

| Gate | Limit | Actual | Headroom |
|---|---|---|---|
| `assets/avatar.glb` (`build.test.mjs:147`) | 8 MiB = 8,388,608 B | 7,381,268 B | **1,007,340 B** |
| `dist/index-3d.html` (`SIZE_LIMIT_MB` in `build.js`) | 12 MB = 12,582,912 B | 11,619,314 B | **963,598 B** |

`dist/index-3d.html` is the avatar base64'd (≈ 9.84 MB) plus the vendor bundle
(0.79 MB) plus `src/` and the fonts. **Do not raise `SIZE_LIMIT_MB` to make room** —
`tests/build.test.mjs:141` reads that constant back out of `build.js`, so raising it
raises the test with it and the guard stops guarding. If a future avatar blows the
ceiling, the answer is tighter texture compression in the converter.

The whole reason the file is 7 MB rather than 2 MB is morph-target storage: 67 targets
over a 22k-vertex mesh is ~32 MB of mostly zeroes, because a viseme does not move the
scalp. glTF sparse accessors store only the vertices that do move.

**Not `quantize()`.** Measured end to end, all five orderings, on **`White_F_2_Busi`**
— the candidate the pipeline was originally developed against, so the absolute bytes
below are that avatar's, not this one's. The *ordering* is what transfers:

| Pipeline | Bytes | Correct? |
|---|---|---|
| none | 32,000,440 | ✓ |
| **sparse** | **6,747,852** | **✓ shipped ordering** |
| quantize | 21,703,336 | ✓ |
| sparse → quantize | 21,703,336 | ✓ (quantize undoes the sparsity) |
| quantize → sparse | 4,350,992 | ✗ **corrupt** |

The last row is the trap. `gltf-transform`'s sparse writer zeroes the values of a
*normalized integer* accessor, so every morph delta comes back all-zero — the smallest
file is also a perfect mannequin, and nothing but the gate's zero-delta detector tells
the two apart. 2.4 MB is not worth a silent mouth. If that bug is ever fixed,
`quantize → sparse` is the next win and one gate run will confirm it.

Draco is excluded on principle, not on size: `dracoDecoderPath` fetches from
`gstatic.com` and this ships air-gapped. Meshopt is excluded because the pinned loader
cannot decode it.
