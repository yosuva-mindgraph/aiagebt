#!/usr/bin/env node
/* ============================================================================
   Turn a VALID avatar into an avatar TalkingHead 1.7.0 can actually drive.

       node tools/convert-valid-avatar.mjs                    # → assets/avatar.glb
       node tools/convert-valid-avatar.mjs --source <url|path> --out <file>
       node tools/convert-valid-avatar.mjs --with-source-morphs --out /tmp/probe.glb

   Then, always:

       node tools/check-avatar-glb.mjs assets/avatar.glb

   ── why this file exists ──────────────────────────────────────────────────────

   The avatar this demo shipped with was Ready Player Me's brunette.glb, CC BY-NC
   4.0 — non-commercial. This is a MindGraph × DXC product walkthrough handed to
   prospects, so it cannot ship, and the documented way to clear those rights no
   longer exists: Ready Player Me shut down on 2026-01-31 and every one of its
   hostnames is now NXDOMAIN. The replacement is the VALID library (MIT,
   Copyright (c) 2022 Tiffany Do) — see docs/AVATAR.md for the licence, the
   citation, and why this particular avatar.

   VALID avatars are NOT drop-in. They load into TalkingHead perfectly happily
   and then stand there twisted ninety degrees away from camera, never moving —
   the worst failure mode available: no error, no warning, a mannequin. FIVE
   separate things are wrong with them, and only the first is the one anybody
   looks for.

     1. NAMING. VALID carries 96 morph targets in Daz/Mimic's scheme —
        `h_expressions.AE_AA_h`, `h_teeth.t_S_h` — and zero of the 15 Oculus
        visemes and zero of the 52 ARKit shapes TalkingHead drives.
        talkinghead.mjs:1260 throws 'Blend shapes not found' ONLY when
        `this.morphs.length === 0`. 96 ≠ 0, so it loads. Silence.

     2. HIERARCHY. There is no `Armature`. The scene roots are the seven mesh
        nodes and `Hips`, as siblings. Two failures fall out of that: showAvatar()
        throws 'Avatar object Armature not found' on opt.modelRoot, AND — the
        subtle one — :1251 collects morph meshes with `armature.traverse(...)`,
        so meshes that are SIBLINGS of the skeleton would contribute nothing even
        once a root existed. Both are fixed by reparenting, not by renaming.

     3. THE REST POSE — the big one, and the one that is invisible until you
        render it. showAvatar() OVERWRITES every bone rotation with
        poseTemplates['side'], a fixed set of absolute local rotations authored
        against a Ready Player Me rig. Daz bone frames are not RPM bone frames.
        Measured against that template, the CC0 mpfb rig differs by a mean of
        24° (worst: thumbs); VALID differs by 42°, with Hips 128°, Spine 142°,
        LeftUpLeg 154° and both shoulders over 100°. See `retargetRestPose`.

     4. COMPRESSION. The c-frame GLBs use EXT_meshopt_compression. TalkingHead
        1.7.0 registers no MeshoptDecoder (that is main-only), and Draco is not
        an option either — dracoDecoderPath points at gstatic.com and this thing
        ships air-gapped on one HTML file. So the output must carry neither.

     5. UNGUARDED READS. "a missing ARKit shape is survivable" is true for most
        of them and false for 24: talkinghead's animate() reads 20 `mtRandomized`
        names at :2619 and 4 eye-gaze names at :2584 through
        `this.mtAvatar[name].…` with no guard. Absent ⇒ a TypeError every frame.
        Those therefore get a zero-delta placeholder, which is inert but present.

   ── the gaze problem, and why we synthesise geometry for it ──────────────────

   TalkingHead does NOT rotate the LeftEye/RightEye bones. It reads their world
   position (:1386, :3912) for height and for speakTo targeting, and that is all.
   Gaze is 100% morph-driven: animFactory maps `eyesRotateX/Y` onto
   eyeLookUp/Down/In/OutLeft/Right (:2251-2258), and the eye-contact path assigns
   to those same keys every frame (:2582-2587). An avatar without them has a
   fixed stare — which on a presenter is worse than it sounds, because eye
   contact is the one thing the format is for.

   VALID has no eyeLook* shapes, but it does have the eyeballs as their own
   meshes (h_L_eye / h_R_eye) rigged to the LeftEye/RightEye joints. So the eight
   shapes are GENERATED here: rotate those meshes' vertices about the eyeball
   centre and store the result as morph deltas. That is real motion derived from
   the real geometry, not an approximation of a different shape.

   ── determinism ──────────────────────────────────────────────────────────────

   Same input bytes ⇒ same output bytes — verified by running it twice and by
   running it again after a clean `npm ci`. The source is fetched once into
   node_modules/.cache (already ignored) and checked against a pinned SHA-256;
   the asset.generator string is fixed rather than left to the toolchain version;
   nothing is randomised; texture bytes are passed through untouched because the
   source already ships EXT_texture_webp, which three r180 reads natively.

   AND IT IS NOT THE GATE. This file believes it succeeded. `tools/check-avatar-glb.mjs`
   parses the result from scratch with no dependencies — including whether any
   "present" morph target is secretly all zeroes — and the motionless-mannequin
   test samples morphTargetInfluences in a real browser during real speech.
   Neither of those trusts this one. See docs/AVATAR.md §6.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, prune, dedup, sparse } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');

/* ── the source ─────────────────────────────────────────────────────────────

   c-frame/valid-avatars-glb is the glTF conversion of xrtlab's FBX-only VALID
   release, by vincentfretin, linked from VALID's own README under "VALID
   Extensions". MIT, same copyright holder. The FBX originals would need a
   Blender round-trip to reach glTF at all, so this is both the shorter path and
   the one upstream points at.

   Why Black_F_1_Busi: argued in full in docs/AVATAR.md. In short — business
   attire because the audience is airport executives; joint-highest validated
   agreement in the whole library (0.98 ethnicity, 0.98 gender, n=132 across 33
   countries, from VALID's own published Agreement-Rates); and the only one of
   the top-ranked candidates whose face survives TalkingHead's default lighting,
   which clips the palest avatars to white. Changing it is this constant plus a
   sha256; the rest of the pipeline is avatar-agnostic and was verified on three. */
const SOURCE = {
  avatar: 'Black_F_1_Busi',
  ethnicity: 'Black',
  /* Pinned to a COMMIT, not to `main`. The `main` URL in docs/AVATAR.md resolves
     to the same bytes today; this one will still resolve to them after an
     upstream force-push, and the sha256 below is checked on every run either
     way. c-frame/valid-avatars-glb @ c4719df, 2023-12-16. */
  url: 'https://raw.githubusercontent.com/c-frame/valid-avatars-glb/c4719df7a2b60a96cc7f56d67e247674b68c4ea7/avatars/Black/Black_F_1_Busi.glb',
  commit: 'c4719df7a2b60a96cc7f56d67e247674b68c4ea7',
  bytes: 1718008,
  sha256: 'e8158244ef013f65fa4724d0831a860bd6bc4bb5fdaa1b81c0050910beb44a83',
};

/* ── the morph map ──────────────────────────────────────────────────────────

   Source names are given SHORT: `h_expressions.AE_AA_h` is written `AE_AA`, and
   `h_teeth.t_S_h` is written `t_S` (the two namespaces do not collide, so one
   flat table covers both meshes). A spec's sources are looked up per-primitive,
   so a viseme that names both `AE_AA` and `t_AE_AA` drives the face on the face
   mesh and the lower teeth/tongue on the teeth mesh — which is how the content
   was authored, and why the teeth do not stay behind when the jaw opens.

   Weight 1 with a single source REUSES that accessor rather than copying it;
   only genuine blends allocate.

   Every entry carries a `why`. These are printed by --explain and reproduced in
   docs/AVATAR.md, because a phoneme map that nobody can audit is a map that
   quietly rots.                                                              */

const VISEME_MAP = [
  { out: 'viseme_sil', mix: {}, why: 'silence = the rest pose. A zero-delta target is exactly that, and is what every other viseme relaxing to 0 already renders.' },
  { out: 'viseme_PP', mix: { MPB_Up: 1, MPB_Down: 1, t_MPB: 1 }, why: 'p/b/m closure. Daz splits the bilabial into upper and lower lip halves; both at full is the closed mouth.' },
  { out: 'viseme_FF', mix: { FV: 1, t_FV: 1 }, why: 'f/v — exact counterpart, lower lip to upper teeth.' },
  { out: 'viseme_TH', mix: { H_EST: 1, t_H_EST: 1, OutMiddle_tg: 0.3 }, why: 'th. H_EST is the nearest Daz shape (open, relaxed); the tongue is pushed slightly between the teeth to make it read as dental rather than as a vowel.' },
  { out: 'viseme_DD', mix: { TD_I: 1, t_TD_I: 1, Up_tg: 0.6 }, why: 't/d. TD_I is the Daz T/D+I shape; tongue raised to the alveolar ridge separates it from viseme_I, which is the same lips without the tongue.' },
  { out: 'viseme_kk', mix: { KG: 1, t_KG: 1 }, why: 'k/g — exact counterpart.' },
  { out: 'viseme_CH', mix: { SH_CH: 1, t_SH_CH: 1 }, why: 'ch/sh/j — exact counterpart.' },
  { out: 'viseme_SS', mix: { S: 1, t_S: 1 }, why: 's/z — exact counterpart.' },
  { out: 'viseme_nn', mix: { TD_I: 0.6, t_TD_I: 0.6, Up_tg: 1 }, why: 'n/l. Same alveolar contact as DD but the lips stay nearer neutral and the tongue does all the work.' },
  { out: 'viseme_RR', mix: { UH_OO: 0.35, t_UH_OO: 0.35, RRR_In_tg: 1 }, why: 'r. Daz ships an explicit retroflex tongue shape (RRR_In); the slight lip rounding on top is what makes an English r read at a distance.' },
  { out: 'viseme_aa', mix: { AE_AA: 1, t_AE_AA: 1 }, why: 'ɑ — exact counterpart.' },
  { out: 'viseme_E', mix: { Ax_E: 1, t_Ax_E: 1 }, why: 'e/schwa — exact counterpart.' },
  { out: 'viseme_I', mix: { TD_I: 1, t_TD_I: 1 }, why: 'ɪ — exact counterpart (Daz groups the I vowel with T/D).' },
  { out: 'viseme_O', mix: { AO_a: 1, t_AO_a: 1 }, why: 'o — exact counterpart.' },
  { out: 'viseme_U', mix: { UW_U: 1, t_UW_U: 1 }, why: 'u — exact counterpart. (UH_OO is the nearer-neutral rounded pair, kept for RR.)' },
];

const ARKIT_MAP = [
  /* eyes — lids */
  { out: 'eyeBlinkLeft', mix: { LeyeClose: 1 }, why: 'exact counterpart.' },
  { out: 'eyeBlinkRight', mix: { ReyeClose: 1 }, why: 'exact counterpart.' },
  { out: 'eyeWideLeft', mix: { LeyeOpen: 1 }, why: 'exact counterpart.' },
  { out: 'eyeWideRight', mix: { ReyeOpen: 1 }, why: 'exact counterpart.' },
  { out: 'eyeSquintLeft', mix: { Lsquint: 1 }, why: 'exact counterpart.' },
  { out: 'eyeSquintRight', mix: { Rsquint: 1 }, why: 'exact counterpart.' },
  { out: 'cheekSquintLeft', mix: { LlowLid: 1 }, why: 'ARKit cheekSquint is the lower-lid/cheek raise of a genuine smile; LlowLid is that muscle.' },
  { out: 'cheekSquintRight', mix: { RlowLid: 1 }, why: 'as cheekSquintLeft.' },

  /* jaw */
  { out: 'jawOpen', mix: { MouthOpen: 1, t_MouthOpen: 1 }, why: 'exact counterpart; the teeth copy keeps the lower teeth with the jaw.' },
  { out: 'jawForward', mix: { JawFront: 1, t_JawFront: 1 }, why: 'exact counterpart.' },
  { out: 'jawLeft', mix: { Ljaw: 1, t_Ljaw: 1 }, why: 'exact counterpart.' },
  { out: 'jawRight', mix: { Rjaw: 1, t_Rjaw: 1 }, why: 'exact counterpart.' },
  { out: 'mouthClose', mix: { JawCompress: 1, t_JawCompress: 1 }, why: 'ARKit mouthClose shuts the lips against an open jaw; JawCompress is the lip-compression shape.' },

  /* lips */
  { out: 'mouthPucker', mix: { Kiss: 1 }, why: 'exact counterpart.' },
  { out: 'mouthFunnel', mix: { AO_a: 0.55, t_AO_a: 0.55, Kiss: 0.45 }, why: 'no counterpart. Funnel is an open O with the lips carried forward — the AO vowel plus part of the pucker is that, and it is the shape 😳 and 🙄 reach for.' },
  { out: 'mouthLeft', mix: { LlipSide: 1 }, why: 'exact counterpart.' },
  { out: 'mouthRight', mix: { RlipSide: 1 }, why: 'exact counterpart.' },
  { out: 'mouthSmileLeft', mix: { LsmileOpen: 1 }, why: 'the open smile, not the closed one — ARKit mouthSmile is used alongside jawOpen, and mtExtras builds mouthSmile from it.' },
  { out: 'mouthSmileRight', mix: { RsmileOpen: 1 }, why: 'as mouthSmileLeft.' },
  { out: 'mouthFrownLeft', mix: { LmouthSad: 1 }, why: 'exact counterpart — corner pulled down.' },
  { out: 'mouthFrownRight', mix: { RmouthSad: 1 }, why: 'exact counterpart.' },
  { out: 'mouthStretchLeft', mix: { LsmileClose: 1 }, why: 'the closed smile pulls the corner sideways without opening, which is what ARKit mouthStretch does.' },
  { out: 'mouthStretchRight', mix: { RsmileClose: 1 }, why: 'as mouthStretchLeft.' },
  { out: 'mouthDimpleLeft', mix: { LlipCorner: 1 }, why: 'the lip-corner shape is the closest thing to the dimpling pull; it is only ever driven to ~0.2 by mtRandomized.' },
  { out: 'mouthDimpleRight', mix: { RlipCorner: 1 }, why: 'as mouthDimpleLeft.' },
  { out: 'mouthUpperUpLeft', mix: { LlipUp: 1 }, why: 'exact counterpart.' },
  { out: 'mouthUpperUpRight', mix: { RlipUp: 1 }, why: 'exact counterpart.' },
  { out: 'mouthLowerDownLeft', mix: { LlipDown: 1 }, why: 'exact counterpart.' },
  { out: 'mouthLowerDownRight', mix: { RlipDown: 1 }, why: 'exact counterpart.' },
  { out: 'mouthShrugLower', mix: { Chin: 1 }, why: 'ARKit mouthShrugLower is the chin-boss raise that pushes the lower lip up; Chin is that shape.' },

  /* brows */
  { out: 'browDownLeft', mix: { LbrowDown: 1, LLbrowDown: 0.6 }, why: 'VALID splits each brow into inner (Lbrow) and outer (LLbrow); ARKit browDown is the whole brow, weighted to the inner half.' },
  { out: 'browDownRight', mix: { RbrowDown: 1, RRbrowDown: 0.6 }, why: 'as browDownLeft.' },
  { out: 'browInnerUp', mix: { LbrowUp: 1, RbrowUp: 1 }, why: 'ARKit has ONE inner-brow shape; VALID has two. Both at full.' },
  { out: 'browOuterUpLeft', mix: { LLbrowUp: 1 }, why: 'LLbrow is the outer half of the left brow.' },
  { out: 'browOuterUpRight', mix: { RRbrowUp: 1 }, why: 'as browOuterUpLeft.' },

  /* nose, cheeks, tongue */
  { out: 'cheekPuff', mix: { Lblow: 1, Rblow: 1 }, why: 'ARKit cheekPuff is bilateral; VALID splits it per side.' },
  { out: 'noseSneerLeft', mix: { Lnostril: 1, Ldisgust: 0.6 }, why: 'sneer is the nostril flare plus the disgust wrinkle that lifts the upper lip; neither alone reads as a sneer.' },
  { out: 'noseSneerRight', mix: { Rnostril: 1, Rdisgust: 0.6 }, why: 'as noseSneerLeft.' },
  { out: 'tongueOut', mix: { OutMiddle_tg: 1 }, why: 'exact counterpart — VALID rigs the tongue on the lower-teeth mesh.' },

  /* ── no analogue, and no honest approximation. Zero-delta placeholders. ────
     Each of these is in talkinghead's mtRandomized list, read UNGUARDED at
     :2619, so the name MUST exist or the animate loop throws once per frame.
     Present-and-inert is the correct trade: the idle micro-expression simply
     has one fewer knob, instead of the render dying.                        */
  { out: 'mouthRollLower', mix: {}, why: 'no analogue — Daz/Mimic has no lip-roll shape at all. Placeholder.' },
  { out: 'mouthRollUpper', mix: {}, why: 'no analogue. Placeholder.' },
  { out: 'mouthShrugUpper', mix: {}, why: 'no analogue — Chin covers the lower shrug only, and faking the upper one from the disgust shape pulls the nose with it. Placeholder.' },
  { out: 'mouthPressLeft', mix: {}, why: 'no analogue — JawCompress is the only press and it is bilateral, already spent on mouthClose. Faking a one-sided press from it would drive mouthClose twice. Placeholder.' },
  { out: 'mouthPressRight', mix: {}, why: 'as mouthPressLeft. Placeholder.' },
];

/* The eight gaze shapes, generated from the eyeball meshes rather than mapped.
   `pitch` is a rotation about the head's left-right axis, `yaw` about its up
   axis; `deg` is how far that shape rotates the eye at influence 1.0.

   8° is deliberately conservative. TalkingHead drives these to 1.0 on a hard
   glance, and a human eye's comfortable excursion before the head follows is
   roughly 10-15°; overshooting is what makes a synthesised gaze look deranged. */
const GAZE_DEG = 8;
const GAZE_MAP = [
  { out: 'eyeLookUpLeft', eye: 'L', pitch: +1, yaw: 0 },
  { out: 'eyeLookUpRight', eye: 'R', pitch: +1, yaw: 0 },
  { out: 'eyeLookDownLeft', eye: 'L', pitch: -1, yaw: 0 },
  { out: 'eyeLookDownRight', eye: 'R', pitch: -1, yaw: 0 },
  /* "in" is toward the nose and "out" is toward the ear, so the two eyes take
     OPPOSITE yaw for the same-named shape. +yaw here is a rotation about the
     head's up axis that turns the pupil toward the character's own RIGHT; the
     axis directions themselves are measured from the rig (below) rather than
     assumed, so a model built facing -Z would come out the same way up. */
  { out: 'eyeLookInLeft', eye: 'L', pitch: 0, yaw: +1 },
  { out: 'eyeLookOutLeft', eye: 'L', pitch: 0, yaw: -1 },
  { out: 'eyeLookInRight', eye: 'R', pitch: 0, yaw: -1 },
  { out: 'eyeLookOutRight', eye: 'R', pitch: 0, yaw: +1 },
];

/* Which mesh carries the zero-delta placeholders. h_L_gland is the lacrimal
   caruncle — 138 vertices, the smallest mesh in the rig — so 6 placeholder
   targets cost ~5 KB instead of the ~800 KB they would cost on the face. They
   only have to EXIST: talkinghead unions the morph dictionaries of every mesh
   under the Armature to build mtAvatar, and never asks which mesh a key was on. */
const PLACEHOLDER_MESH = 'h_L_gland';

const FACE_PREFIX = 'h_expressions.';
const TEETH_PREFIX = 'h_teeth.';

/** `h_expressions.AE_AA_h` → `AE_AA`; `h_teeth.t_S_h` → `t_S`. */
function shortName(name) {
  let s = name;
  if (s.startsWith(FACE_PREFIX)) s = s.slice(FACE_PREFIX.length);
  else if (s.startsWith(TEETH_PREFIX)) s = s.slice(TEETH_PREFIX.length);
  return s.endsWith('_h') ? s.slice(0, -2) : s;
}

/* ── tiny 4×4 affine maths ──────────────────────────────────────────────────
   Column-major, as glTF and gl-matrix both are. Written out rather than pulled
   from three so this tool stays a build-time script with no renderer in it. */
const mulMat = (a, b) => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
};
const applyPoint = (m, v) => {
  const w = m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15];
  return [
    (m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12]) / w,
    (m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13]) / w,
    (m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]) / w,
  ];
};
const applyDir = (m, v) => [
  m[0] * v[0] + m[4] * v[1] + m[8] * v[2],
  m[1] * v[0] + m[5] * v[1] + m[9] * v[2],
  m[2] * v[0] + m[6] * v[1] + m[10] * v[2],
];
/** General 4×4 inverse (Laplace expansion). The matrices here are affine, but
    an affine-only shortcut would silently give wrong answers on a sheared rig. */
function invertMat(m) {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) throw new Error('singular matrix');
  const d = 1 / det;
  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * d, (a02 * b10 - a01 * b11 - a03 * b09) * d,
    (a31 * b05 - a32 * b04 + a33 * b03) * d, (a22 * b04 - a21 * b05 - a23 * b03) * d,
    (a12 * b08 - a10 * b11 - a13 * b07) * d, (a00 * b11 - a02 * b08 + a03 * b07) * d,
    (a32 * b02 - a30 * b05 - a33 * b01) * d, (a20 * b05 - a22 * b02 + a23 * b01) * d,
    (a10 * b10 - a11 * b08 + a13 * b06) * d, (a01 * b08 - a00 * b10 - a03 * b06) * d,
    (a30 * b04 - a31 * b02 + a33 * b00) * d, (a21 * b02 - a20 * b04 - a23 * b00) * d,
    (a11 * b07 - a10 * b09 - a12 * b06) * d, (a00 * b09 - a01 * b07 + a02 * b06) * d,
    (a31 * b01 - a30 * b03 - a32 * b00) * d, (a20 * b03 - a21 * b01 + a22 * b00) * d,
  ];
}
/** Rotation about an arbitrary axis through the origin (Rodrigues, as a mat4). */
function rotationMat(axis, rad) {
  const l = Math.hypot(...axis);
  const [x, y, z] = axis.map(v => v / l);
  const c = Math.cos(rad), s = Math.sin(rad), t = 1 - c;
  return [
    t * x * x + c, t * x * y + s * z, t * x * z - s * y, 0,
    t * x * y - s * z, t * y * y + c, t * y * z + s * x, 0,
    t * x * z + s * y, t * y * z - s * x, t * z * z + c, 0,
    0, 0, 0, 1,
  ];
}
/** Minimal-arc rotation taking unit vector `from` onto unit vector `to`. */
function minArcMat(from, to) {
  const d = from[0] * to[0] + from[1] * to[1] + from[2] * to[2];
  if (d > 0.999999) return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  let axis = [
    from[1] * to[2] - from[2] * to[1],
    from[2] * to[0] - from[0] * to[2],
    from[0] * to[1] - from[1] * to[0],
  ];
  if (Math.hypot(...axis) < 1e-8) {
    /* Antiparallel: any perpendicular axis will do; pick the most stable one. */
    const a = Math.abs(from[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    axis = [
      from[1] * a[2] - from[2] * a[1],
      from[2] * a[0] - from[0] * a[2],
      from[0] * a[1] - from[1] * a[0],
    ];
  }
  return rotationMat(axis, Math.acos(Math.max(-1, Math.min(1, d))));
}
/** mat4 → {t, q, s}. Uniform-ish scale assumed, which holds for a skeleton. */
function decomposeTRS(m) {
  let sx = Math.hypot(m[0], m[1], m[2]);
  const sy = Math.hypot(m[4], m[5], m[6]);
  const sz = Math.hypot(m[8], m[9], m[10]);
  /* A negative determinant means a mirrored basis; glTF cannot express that in
     a quaternion, so fold the flip into X the way three's decompose() does. */
  const det = m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]);
  if (det < 0) sx = -sx;
  const r = [m[0] / sx, m[1] / sx, m[2] / sx, m[4] / sy, m[5] / sy, m[6] / sy, m[8] / sz, m[9] / sz, m[10] / sz];
  const [r00, r01, r02, r10, r11, r12, r20, r21, r22] = r;   // r[col*3+row]
  const trace = r00 + r11 + r22;
  let q;
  if (trace > 0) {
    const f = Math.sqrt(trace + 1) * 2;
    q = [(r12 - r21) / f, (r20 - r02) / f, (r01 - r10) / f, 0.25 * f];
  } else if (r00 > r11 && r00 > r22) {
    const f = Math.sqrt(1 + r00 - r11 - r22) * 2;
    q = [0.25 * f, (r10 + r01) / f, (r20 + r02) / f, (r12 - r21) / f];
  } else if (r11 > r22) {
    const f = Math.sqrt(1 + r11 - r00 - r22) * 2;
    q = [(r10 + r01) / f, 0.25 * f, (r21 + r12) / f, (r20 - r02) / f];
  } else {
    const f = Math.sqrt(1 + r22 - r00 - r11) * 2;
    q = [(r20 + r02) / f, (r21 + r12) / f, 0.25 * f, (r01 - r10) / f];
  }
  const n = Math.hypot(...q) || 1;
  return { t: [m[12], m[13], m[14]], q: q.map(v => v / n), s: [sx, sy, sz] };
}
/** Euler XYZ (radians) → quaternion [x,y,z,w]. three's default order, which is
    what propsToThreeObjects() uses when it reads a pose template. */
function eulerXYZToQuat(x, y, z) {
  const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  ];
}
/** TRS → column-major mat4, matching three's Object3D.matrix composition. */
function composeTRS([tx, ty, tz], [qx, qy, qz, qw], [sx, sy, sz]) {
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2;
  const yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

/* ── source acquisition ─────────────────────────────────────────────────── */

async function fetchSource(url, log) {
  const cacheDir = path.join(ROOT, 'node_modules', '.cache', 'valid-avatar');
  const cached = path.join(cacheDir, path.basename(new URL(url).pathname));
  if (fs.existsSync(cached)) { log(`source: ${cached} (cached)`); return fs.readFileSync(cached); }
  log(`source: GET ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cached, buf);
  return buf;
}

/**
 * Hoist primitive-level targetNames up to the mesh.
 *
 * glTF lets `targetNames` sit in mesh.extras or primitive.extras and exporters
 * disagree; gltf-transform's reader only looks at the mesh (core writer.js
 * :4237). Normalise in the raw JSON before the document is built, so a source
 * that used the primitive spelling does not arrive with its morphs called
 * "0","1","2".
 */
function normaliseTargetNames(glb, log) {
  const jsonLen = glb.readUInt32LE(12);
  const json = JSON.parse(glb.toString('utf8', 20, 20 + jsonLen));
  let hoisted = 0;
  for (const mesh of json.meshes || []) {
    if (mesh.extras?.targetNames?.length) continue;
    const fromPrim = (mesh.primitives || []).map(p => p.extras?.targetNames).find(n => n && n.length);
    if (!fromPrim) continue;
    mesh.extras = { ...(mesh.extras || {}), targetNames: fromPrim };
    hoisted++;
  }
  if (!hoisted) return glb;
  log(`normalised targetNames: hoisted from primitive.extras to mesh.extras on ${hoisted} mesh(es)`);
  /* Re-emit the container with the edited JSON chunk; the BIN chunk is copied
     through byte for byte, so nothing but the JSON changes. */
  const jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPad = Buffer.concat([jsonBuf, Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20)]);
  const rest = glb.subarray(20 + jsonLen);
  const out = Buffer.alloc(12 + 8 + jsonPad.length + rest.length);
  out.write('glTF', 0, 'ascii');
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(jsonPad.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  jsonPad.copy(out, 20);
  rest.copy(out, 20 + jsonPad.length);
  return out;
}

/* ── stage 1: hierarchy ─────────────────────────────────────────────────── */

/**
 * Build the `Armature` root TalkingHead demands, and — the part that matters
 * more — put every mesh INSIDE it.
 *
 * VALID's scene is flat: Hips and the seven mesh nodes are all roots. Adding a
 * root named Armature over just the skeleton would clear showAvatar()'s
 * required[] check and still produce a mannequin, because :1251 walks
 * `armature.traverse()` to find morph meshes and would find none.
 *
 * The new root is left at identity on purpose. Skinned meshes are bound with
 * their world matrix (three's GLTFLoader passes mesh.matrixWorld as the bind
 * matrix), so an Armature with any transform on it would shift the bind pose;
 * and showAvatar() does `this.armature.scale.setScalar(1)` at :1243, which
 * would silently discard a scale put here anyway.
 */
function buildArmature(doc, log) {
  const root = doc.getRoot();
  const scene = root.listScenes()[0];
  const existing = root.listNodes().find(n => n.getName() === 'Armature');
  if (existing) { log('hierarchy: Armature already present, left alone'); return existing; }

  const armature = doc.createNode('Armature');
  const roots = scene.listChildren();
  for (const n of roots) { scene.removeChild(n); armature.addChild(n); }
  scene.addChild(armature);

  /* glTF lets skin.skeleton be omitted and VALID omits it. Point it at Hips so
     the file says what it means; three derives the bind matrices from
     inverseBindMatrices either way, so this is documentation, not behaviour. */
  const hips = root.listNodes().find(n => n.getName() === 'Hips');
  for (const skin of root.listSkins()) if (!skin.getSkeleton() && hips) skin.setSkeleton(hips);

  log(`hierarchy: created Armature over ${roots.length} former scene root(s): ${roots.map(n => n.getName()).join(', ')}`);
  return armature;
}

/* ── stage 2: the rest pose ─────────────────────────────────────────────────

   THE BIG ONE. Everything above is naming and plumbing; this is the difference
   between an avatar and a contortionist, and it is the reason a VALID avatar
   cannot simply be renamed into place.

   showAvatar() does not READ the avatar's rest pose — it OVERWRITES it. At
   :1321-1339 it walks posePropNames, takes the live quaternion off each bone and
   does `.copy(this.poseBase.props[x])`, where poseBase was built in the
   constructor from poseTemplates['side']. So whatever you load, the skeleton is
   forced into one fixed set of ABSOLUTE local rotations authored against a Ready
   Player Me rig.

   Absolute local rotations are only meaningful in a known BONE-FRAME CONVENTION.
   Both rigs put the bone along its local +Y — but they disagree about the roll
   around that axis and about where the anatomical offsets (shoulder off the
   spine, leg off the hips, eye off the head) point. Measured against the 'side'
   template, the CC0 mpfb rig this repo currently ships differs by a mean of 24°,
   worst 76°, and the worst are thumbs. VALID differs by a mean of 42° with Hips
   128°, Spine 142°, LeftUpLeg 154°, RightFoot 145° and both shoulders over 100°.
   Those are the bones that orient the entire body. It renders, reports nothing,
   and stands there turned ninety degrees away from camera with its chin up.

   ── what does NOT fix it ────────────────────────────────────────────────────

   Setting the avatar's local rotations to the template values and re-posing the
   mesh to match. That bakes in at build time exactly what showAvatar() does at
   load time, so the load becomes a no-op and the avatar is just as twisted, only
   now permanently. It was worth trying once to be sure; it is recorded here so
   nobody has to try it twice.

   The reason it cannot work: a local translation like Head→LeftEye
   (3.41, 7.38, -2.97) is expressed in the PARENT's frame. Re-orienting the frame
   without re-expressing the offset swings the eyes around the skull. Chain bones
   are immune (they sit at (0, L, 0), so roll cannot move them) — the anatomical
   offsets are not.

   ── what does ──────────────────────────────────────────────────────────────

   Rebuild the skeleton with:
     · the ORIENTATIONS the template will impose        (read from the library)
     · the OFFSET DIRECTIONS of a known-good rig        (REFERENCE_BONE_DIR below)
     · VALID's own BONE LENGTHS                         (proportions preserved)
   and then move the mesh onto it with linear blend skinning.

   Bones the template does not name — the *_end tips, LeftEye/RightEye, and Daz's
   extra LeftFingerBase/RightFingerBase — keep their local transform unchanged,
   which carries them rigidly with their parent. That is what keeps the eyeballs
   in their sockets: the face mesh (weighted to Head) and the eye meshes (weighted
   to LeftEye/RightEye) are moved by the same transform, so they cannot separate.

   The algebra, using three's real binding — GLTFLoader:4308 binds with an
   IDENTITY bind matrix, so the mesh NODE's transform is ignored, per spec:

     rest world of a vertex   P = Σ wⱼ · Wⱼ · IBMⱼ · v          ( = v, at rest)
     retargeted               P' = Σ wⱼ · W'ⱼ · IBMⱼ · v
     choose                   IBM'ⱼ = W'ⱼ⁻¹
     then at the new rest     Σ wⱼ · W'ⱼ · W'ⱼ⁻¹ · v' = v'      ✓

   so the new vertex data IS P'. Morph deltas are added before skinning, so they
   take the linear part of the same blended matrix; IBM ≈ W⁻¹ means W'·IBM is
   rigid, so normals take that linear part too and stay unit length.

   The template is READ OUT OF THE PINNED LIBRARY rather than transcribed — 53
   numbers copied into this file are 53 numbers that rot the first time the pin
   moves. A version bump either updates this automatically or fails loudly. */

/* Unit local-translation directions from the CC0 mpfb rig (the avatar this repo
   shipped before this change, and the one demonstrably compatible with the pose
   templates), measured with:

     node -e "…listNodes() → getTranslation(), normalised…"  on assets/avatar.glb

   Only the direction is taken; every length comes from VALID, so proportions are
   VALID's own. Note how few of these are anything but (0,1,0): the convention is
   "bone along local +Y", and the interesting entries are exactly the anatomical
   offsets that a roll difference would otherwise scramble. */
const REFERENCE_BONE_DIR = {
  Spine: [0, 1, 0], Spine1: [0, 1, 0], Spine2: [0, 1, 0], Neck: [0, 1, 0],
  Head: [0.01069, 0.93532, 0.35363],
  LeftShoulder: [0.29034, 0.8746, 0.38831], LeftArm: [0, 1, 0], LeftForeArm: [0, 1, 0], LeftHand: [0, 1, 0],
  LeftUpLeg: [0.91045, -0.41312, -0.02045], LeftLeg: [0, 1, 0], LeftFoot: [0, 1, 0], LeftToeBase: [0, 1, 0],
  LeftHandThumb1: [-0.42034, 0.88658, 0.19312], LeftHandThumb2: [0, 1, 0], LeftHandThumb3: [0, 1, 0],
  LeftHandIndex1: [-0.15066, 0.98834, 0.02214], LeftHandIndex2: [0, 1, 0], LeftHandIndex3: [0, 1, 0],
  LeftHandMiddle1: [0.06201, 0.99204, -0.10963], LeftHandMiddle2: [0, 1, 0], LeftHandMiddle3: [0, 1, 0],
  LeftHandRing1: [0.24194, 0.95305, -0.18209], LeftHandRing2: [0, 1, 0], LeftHandRing3: [0, 1, 0],
  LeftHandPinky1: [0.44292, 0.87345, -0.20227], LeftHandPinky2: [0, 1, 0], LeftHandPinky3: [0, 1, 0],
  RightShoulder: [-0.29034, 0.8746, 0.38831], RightArm: [0, 1, 0], RightForeArm: [0, 1, 0], RightHand: [0, 1, 0],
  RightUpLeg: [-0.93871, -0.33681, -0.0734], RightLeg: [0, 1, 0], RightFoot: [0, 1, 0], RightToeBase: [0, 1, 0],
  RightHandThumb1: [0.42033, 0.88658, 0.19312], RightHandThumb2: [0, 1, 0], RightHandThumb3: [0, 1, 0],
  RightHandIndex1: [0.15066, 0.98834, 0.02214], RightHandIndex2: [0, 1, 0], RightHandIndex3: [0, 1, 0],
  RightHandMiddle1: [-0.06201, 0.99204, -0.10963], RightHandMiddle2: [0, 1, 0], RightHandMiddle3: [0, 1, 0],
  RightHandRing1: [-0.24194, 0.95305, -0.18209], RightHandRing2: [0, 1, 0], RightHandRing3: [0, 1, 0],
  RightHandPinky1: [-0.44292, 0.87345, -0.20227], RightHandPinky2: [0, 1, 0], RightHandPinky3: [0, 1, 0],
};

function readPoseTemplate(name, log) {
  const src = path.join(ROOT, 'node_modules', '@met4citizen', 'talkinghead', 'modules', 'talkinghead.mjs');
  if (!fs.existsSync(src)) throw new Error(`cannot read the pose template: ${src} not found — run npm ci`);
  const text = fs.readFileSync(src, 'utf8');
  const at = text.indexOf('this.poseTemplates = {');
  if (at < 0) throw new Error('talkinghead.mjs no longer contains `this.poseTemplates = {` — the retarget target must be re-derived by hand');
  let depth = 0, end = -1;
  const start = text.indexOf('{', at);
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) throw new Error('could not find the end of the poseTemplates literal');
  const literal = text.slice(start, end + 1);
  if (/=>|function\s*\(|this\./.test(literal)) {
    throw new Error('the poseTemplates literal is no longer pure data — refusing to evaluate it');
  }
  // eslint-disable-next-line no-new-func
  const templates = new Function(`return ${literal}`)();
  if (!templates[name]) throw new Error(`pose template "${name}" not found; have: ${Object.keys(templates).join(', ')}`);
  log(`retarget: read poseTemplates['${name}'] from the pinned talkinghead (${Object.keys(templates[name].props).length} props)`);
  return templates[name].props;
}

function retargetRestPose(doc, templateName, log) {
  const props = readPoseTemplate(templateName, log);
  const root = doc.getRoot();
  const byName = new Map(root.listNodes().map(n => [n.getName(), n]));

  const targetRot = new Map();
  const targetPos = new Map();
  for (const [key, val] of Object.entries(props)) {
    const [bone, prop] = key.split('.');
    if (!byName.has(bone)) { log(`retarget: template names "${bone}", which this rig does not have — skipped`); continue; }
    if (prop === 'rotation') targetRot.set(bone, eulerXYZToQuat(val.x, val.y, val.z));
    else if (prop === 'position') targetPos.set(bone, [val.x, val.y, val.z]);
  }
  const missingDirs = [...targetRot.keys()].filter(b => b !== 'Hips' && !REFERENCE_BONE_DIR[b]);
  if (missingDirs.length) throw new Error(`no reference offset direction for: ${missingDirs.join(', ')}`);

  /* Pass 1 — measure. Nothing is mutated until every old world matrix is read. */
  const armature = byName.get('Armature');
  const oldW = new Map();
  (function measure(node, parent) {
    const m = mulMat(parent, composeTRS(node.getTranslation(), node.getRotation(), node.getScale()));
    oldW.set(node.getName(), m);
    for (const c of node.listChildren()) measure(c, m);
  })(armature, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

  /* Pass 2 — rebuild the skeleton AND work out how the mesh must follow it.

     These cannot be two passes, because they feed each other. A bone's
     anatomical swing Aⱼ is measured from where its chain child ENDS UP, so the
     child's new placement has to exist first; and a bone the template does not
     name — the *_end tips, LeftEye/RightEye, Daz's extra LeftFingerBase — has to
     be carried by its parent's swing, so the parent's Aⱼ has to exist first.
     One walk, in that order: template children, then the swing, then the rest.

     Two DIFFERENT rotations come out of this, and conflating them is the whole
     trap:

       W'ⱼ  the bone's new FRAME — the template's orientation, because that is
            what showAvatar() will impose whatever we write. Absorbed by IBM'.
       Gⱼ   the bone's new PLACEMENT — a pure world-space pose change derived
            only from joint POSITIONS, which carry no convention. Applied to
            vertices.

     Using W'ⱼ · IBMⱼ for the vertices instead — the obvious move — bakes the
     roll difference between Daz's and RPM's bone frames into the geometry.
     VALID's Head frame is rolled 90° from RPM's, so it rotates the face round
     the skull and lands one eye in front of the head and the other behind. That
     was measured, not guessed: eyeball separation came out along +Z instead of
     ±X. Frame roll is a labelling difference and must never reach a vertex. */

  const newW = new Map();
  const newLocal = new Map();
  const G = new Map();
  const posOf = m => [m[12], m[13], m[14]];
  const unit = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  let reoriented = 0;

  newW.set('Armature', I4);
  G.set('Armature', I4);

  (function rebuild(node, parentSwing) {
    const name = node.getName();
    const mine = newW.get(name);
    const kids = node.listChildren();

    /* (a) template children first: template rotation, reference offset
           direction, VALID's own bone length. */
    for (const kid of kids) {
      const kName = kid.getName();
      if (!targetRot.has(kName)) continue;
      reoriented++;
      const lq = targetRot.get(kName);
      let lt;
      if (targetPos.has(kName)) {
        /* The template pins Hips outright at (0, 1, 0) and showAvatar() will
           set it regardless, so bake it or the bind is 3 cm out on frame one. */
        lt = targetPos.get(kName);
      } else {
        const pk = posOf(oldW.get(kName)), pn = posOf(oldW.get(name));
        const len = Math.hypot(pk[0] - pn[0], pk[1] - pn[1], pk[2] - pn[2]);
        /* Divide back through the parent's world scale: VALID leaves 0.01 on
           Hips, so everything below it is written in centimetres. */
        const parentScale = Math.hypot(mine[0], mine[1], mine[2]) || 1;
        lt = REFERENCE_BONE_DIR[kName].map(v => (v * len) / parentScale);
      }
      newLocal.set(kName, { t: lt, q: lq });
      newW.set(kName, mulMat(mine, composeTRS(lt, lq, kid.getScale())));
    }

    /* (b) this bone's swing, from where its chain continuation landed. The
           shoulders hang off Spine2 and the legs off Hips as OFFSETS; only the
           child the reference rig places straight along the bone, at (0,1,0),
           is the continuation. A bone with no continuation — Head, the toes,
           the fingertips — inherits, which is precisely what keeps the face
           pointing forward instead of following the Head bone's roll. */
    const chainChild = kids.find(c => {
      const d = REFERENCE_BONE_DIR[c.getName()];
      return d && d[0] === 0 && d[1] === 1 && d[2] === 0;
    }) || kids.find(c => REFERENCE_BONE_DIR[c.getName()]);

    let A = parentSwing;
    if (chainChild && newW.has(chainChild.getName())) {
      const cName = chainChild.getName();
      const pOldSelf = posOf(oldW.get(name));
      const dVal = applyDir(parentSwing, unit(posOf(oldW.get(cName)).map((v, k) => v - pOldSelf[k])));
      const dTgt = unit(posOf(newW.get(cName)).map((v, k) => v - posOf(mine)[k]));
      A = mulMat(minArcMat(unit(dVal), dTgt), parentSwing);
    }

    const pOld = posOf(oldW.get(name)), pNew = posOf(mine);
    G.set(name, mulMat(
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, pNew[0], pNew[1], pNew[2], 1],
      mulMat(A, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -pOld[0], -pOld[1], -pOld[2], 1]),
    ));

    /* (c) everything the template does not name, carried rigidly by THIS bone's
           anatomical transform — not by its frame. That is what keeps the
           eyeballs in their sockets: the face mesh (weighted to Head) and the
           eye meshes (weighted to LeftEye/RightEye) are moved by the same G. */
    for (const kid of kids) {
      const kName = kid.getName();
      if (newW.has(kName)) continue;
      const w = mulMat(G.get(name), oldW.get(kName));
      newW.set(kName, w);
      const local = decomposeTRS(mulMat(invertMat(mine), w));
      newLocal.set(kName, { t: local.t, q: local.q, s: local.s });
    }

    for (const kid of kids) rebuild(kid, A);
  })(armature, I4);

  /* The joint census is cheap and is the fastest way to see a retarget go wrong
     — a head at knee height, or two eyes at the same x. Left in, behind a flag. */
  if (process.env.AIB_DEBUG_RETARGET) {
    for (const b of ['Hips', 'Spine', 'Spine2', 'Neck', 'Head', 'LeftEye', 'RightEye', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'LeftUpLeg', 'LeftFoot']) {
      if (!oldW.has(b)) continue;
      const a = posOf(oldW.get(b)).map(v => +v.toFixed(4));
      const c = posOf(newW.get(b)).map(v => +v.toFixed(4));
      log(`   ${b.padEnd(14)} old[${a}] new[${c}]`);
    }
  }
  let verts = 0, movedTargets = 0;
  for (const node of root.listNodes()) {
    const skin = node.getSkin();
    const mesh = node.getMesh();
    if (!skin || !mesh) continue;
    const joints = skin.listJoints();
    const ibmAcc = skin.getInverseBindMatrices();

    /* Dⱼ = Gⱼ · (Wⱼ · IBMⱼ).

       The right-hand factor is the map from this mesh's own vertex space into
       world space at the ORIGINAL rest — which is not the identity and is not
       the mesh node's transform either. VALID stores the eyeballs centred on
       their own local origin and lets the inverse-bind matrix place them, so
       skipping this factor puts the head somewhere around knee height. (Also
       measured, also on the first attempt.) Gⱼ then does the actual re-posing,
       in world space, and since IBM'ⱼ = W'ⱼ⁻¹ the result is stored in world
       coordinates — the same convention RPM and mpfb rigs use. */
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const D = joints.map((j, i) => {
      const ibm = [];
      ibmAcc.getElement(i, ibm);
      const toWorld = mulMat(oldW.get(j.getName()) || j.getWorldMatrix(), ibm);
      return mulMat(G.get(j.getName()) || identity, toWorld);
    });

    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const nor = prim.getAttribute('NORMAL');
      const jA = prim.getAttribute('JOINTS_0');
      const wA = prim.getAttribute('WEIGHTS_0');
      if (!pos || !jA || !wA) continue;

      const n = pos.getCount();
      const newPos = new Float32Array(n * 3);
      const newNor = nor ? new Float32Array(n * 3) : null;
      const targets = prim.listTargets();
      const tPos = targets.map(t => t.getAttribute('POSITION'));
      const tNor = targets.map(t => t.getAttribute('NORMAL'));
      const outTPos = tPos.map(a => (a ? new Float32Array(a.getCount() * 3) : null));
      const outTNor = tNor.map(a => (a ? new Float32Array(a.getCount() * 3) : null));

      const v = [], nv = [], jj = [], ww = [], d = [];
      const B = new Array(16);
      for (let i = 0; i < n; i++) {
        pos.getElement(i, v);
        jA.getElement(i, jj);
        wA.getElement(i, ww);
        B.fill(0);
        let wsum = 0;
        for (let k = 0; k < jj.length; k++) {
          const w = ww[k];
          if (!w) continue;
          wsum += w;
          const M = D[jj[k]];
          for (let q = 0; q < 16; q++) B[q] += M[q] * w;
        }
        if (wsum < 1e-6) {
          /* An unweighted vertex would collapse to the origin. Leave it alone
             and let the gate's geometry checks notice if there are many. */
          newPos.set([v[0], v[1], v[2]], i * 3);
          if (newNor) { nor.getElement(i, nv); newNor.set([nv[0], nv[1], nv[2]], i * 3); }
          continue;
        }
        if (Math.abs(wsum - 1) > 1e-4) for (let q = 0; q < 16; q++) B[q] /= wsum;

        newPos.set(applyPoint(B, v), i * 3);
        if (newNor) {
          nor.getElement(i, nv);
          const r = applyDir(B, nv);
          const l = Math.hypot(r[0], r[1], r[2]) || 1;
          newNor.set([r[0] / l, r[1] / l, r[2] / l], i * 3);
        }
        for (let t = 0; t < targets.length; t++) {
          if (outTPos[t]) { tPos[t].getElement(i, d); outTPos[t].set(applyDir(B, d), i * 3); }
          if (outTNor[t]) { tNor[t].getElement(i, d); outTNor[t].set(applyDir(B, d), i * 3); }
        }
        verts++;
      }

      pos.setArray(newPos).setType('VEC3').setNormalized(false);
      if (nor) nor.setArray(newNor).setType('VEC3').setNormalized(false);
      for (let t = 0; t < targets.length; t++) {
        if (outTPos[t]) { tPos[t].setArray(outTPos[t]).setNormalized(false); movedTargets++; }
        if (outTNor[t]) tNor[t].setArray(outTNor[t]).setNormalized(false);
      }
    }

    /* IBM'ⱼ = W'ⱼ⁻¹: the new bind IS the new rest. */
    const ibmOut = new Float32Array(joints.length * 16);
    joints.forEach((j, i) => ibmOut.set(invertMat(newW.get(j.getName()) || j.getWorldMatrix()), i * 16));
    skin.setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(ibmOut).setBuffer(root.listBuffers()[0]));

    /* The mesh node's own transform is ignored for skinned meshes (glTF spec;
       three binds with the identity at GLTFLoader:4308). VALID leaves a 0.01
       scale on it, which is inert but reads as if it meant something. */
    node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
  }

  /* Only now write the joints. */
  for (const [name, { t, q, s }] of newLocal) {
    const node = byName.get(name);
    if (!node || name === 'Armature') continue;
    node.setTranslation(t).setRotation(q);
    if (s) node.setScale(s);
  }

  log(`retarget: bind pose rebuilt onto poseTemplates['${templateName}'] · ${reoriented} bones re-oriented · ${verts.toLocaleString('en-US')} vertices and ${movedTargets} morph targets re-posed`);
}


/* ── stage 3: morph targets ─────────────────────────────────────────────── */

function zeroAccessorLike(doc, src) {
  return doc.createAccessor()
    .setType(src.getType())
    .setArray(new Float32Array(src.getCount() * src.getElementSize()))
    .setBuffer(doc.getRoot().listBuffers()[0]);
}

/**
 * Rewrite one primitive's morph targets from the source scheme into the
 * TalkingHead scheme.
 *
 * Returns the set of output names this primitive ended up carrying, so the
 * caller can work out which names still need a placeholder somewhere.
 */
function remapPrimitive(doc, prim, specs, opts) {
  const byShort = new Map();
  for (const t of prim.listTargets()) byShort.set(shortName(t.getName()), t);

  const built = [];
  const names = new Set();

  for (const spec of specs) {
    const sources = Object.entries(spec.mix).filter(([k]) => byShort.has(k));
    if (!sources.length) continue;

    let target;
    if (sources.length === 1 && sources[0][1] === 1) {
      /* Pure rename. Share the source accessors — no new bytes at all. */
      const src = byShort.get(sources[0][0]);
      target = doc.createPrimitiveTarget(spec.out);
      for (const sem of src.listSemantics()) target.setAttribute(sem, src.getAttribute(sem));
    } else {
      /* A real blend. Sum the weighted deltas per semantic. POSITION always;
         NORMAL only if every contributing source has one, because a partial
         normal sum lights worse than no normal delta at all. */
      target = doc.createPrimitiveTarget(spec.out);
      const semantics = ['POSITION', 'NORMAL'].filter(sem =>
        sources.every(([k]) => byShort.get(k).getAttribute(sem)));
      for (const sem of semantics) {
        const first = byShort.get(sources[0][0]).getAttribute(sem);
        const acc = zeroAccessorLike(doc, first);
        const out = acc.getArray();
        for (const [k, w] of sources) {
          const arr = byShort.get(k).getAttribute(sem).getArray();
          for (let i = 0; i < out.length; i++) out[i] += arr[i] * w;
        }
        target.setAttribute(sem, acc);
      }
    }
    built.push(target);
    names.add(spec.out);
  }

  /* Debug mode: keep the source shapes alongside, under `src_<short>`, so each
     one can be driven individually from a browser. This is how the mapping
     above was derived and checked — see docs/AVATAR.md. */
  if (opts.withSourceMorphs) {
    for (const [short, src] of byShort) {
      const t = doc.createPrimitiveTarget(`src_${short}`);
      for (const sem of src.listSemantics()) t.setAttribute(sem, src.getAttribute(sem));
      built.push(t);
      names.add(`src_${short}`);
    }
  }

  for (const t of prim.listTargets()) prim.removeTarget(t);
  for (const t of built) prim.addTarget(t);
  return names;
}

function remapMorphTargets(doc, opts, log) {
  const specs = [...VISEME_MAP, ...ARKIT_MAP];
  const covered = new Set();
  const perMesh = [];

  for (const mesh of doc.getRoot().listMeshes()) {
    let n = 0;
    for (const prim of mesh.listPrimitives()) {
      if (!prim.listTargets().length) continue;
      const names = remapPrimitive(doc, prim, specs, opts);
      names.forEach(x => covered.add(x));
      n = Math.max(n, names.size);
    }
    if (n) {
      mesh.setWeights(new Array(n).fill(0));
      perMesh.push(`${mesh.getName()}=${n}`);
    }
  }
  log(`morphs: remapped → ${perMesh.join(' ')}`);

  /* Anything the map declared but no mesh could build — either an empty mix
     (declared placeholder) or a mix whose sources this particular avatar lacks. */
  const needPlaceholder = specs.map(s => s.out).filter(o => !covered.has(o));
  if (needPlaceholder.length) {
    const carrier = doc.getRoot().listMeshes().find(m => m.getName() === PLACEHOLDER_MESH);
    if (!carrier) throw new Error(`placeholder carrier mesh "${PLACEHOLDER_MESH}" not found`);
    for (const prim of carrier.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      for (const name of needPlaceholder) {
        prim.addTarget(doc.createPrimitiveTarget(name).setAttribute('POSITION', zeroAccessorLike(doc, pos)));
      }
    }
    carrier.setWeights(new Array(carrier.listPrimitives()[0].listTargets().length).fill(0));
    log(`morphs: ${needPlaceholder.length} zero-delta placeholder(s) on ${PLACEHOLDER_MESH} → ${needPlaceholder.join(', ')}`);
  }
  return { covered, needPlaceholder };
}

/* ── stage 4: gaze ──────────────────────────────────────────────────────── */

/**
 * The REST transform of a rigidly-skinned mesh's vertices.
 *
 * The eyeball meshes' own nodes are at the identity with a uniform 0.01 scale,
 * and their vertex data is centred on the LOCAL ORIGIN — both eyes sit on top of
 * each other in mesh space. Nothing about where an eye actually is lives in the
 * node graph: it lives in the skin, as `jointWorldMatrix × inverseBindMatrix`.
 *
 * So the node's world matrix is the wrong transform to reason in, and using it
 * is how the first version of this function measured a left-right axis of
 * exactly [0,0,0]. Resolve the dominant joint from the weights, and build the
 * rest matrix from that instead.
 */
function restTransformOf(node) {
  const skin = node.getSkin();
  const prim = node.getMesh().listPrimitives()[0];
  const joints = skin.listJoints();
  const jointsAttr = prim.getAttribute('JOINTS_0');
  const weightsAttr = prim.getAttribute('WEIGHTS_0');
  if (!skin || !jointsAttr || !weightsAttr) return null;

  /* Dominant joint by total weight across the mesh. For an eyeball that is
     LeftEye/RightEye at essentially weight 1 everywhere, but summing rather
     than sampling one vertex means a stray weight cannot pick the wrong bone. */
  const totals = new Map();
  const j = [], w = [];
  for (let i = 0; i < jointsAttr.getCount(); i++) {
    jointsAttr.getElement(i, j);
    weightsAttr.getElement(i, w);
    for (let k = 0; k < j.length; k++) if (w[k] > 0) totals.set(j[k], (totals.get(j[k]) || 0) + w[k]);
  }
  let best = -1, bestW = -1;
  for (const [idx, tw] of totals) if (tw > bestW) { bestW = tw; best = idx; }
  const jointNode = joints[best];

  const ibmAcc = skin.getInverseBindMatrices();
  const ibm = [];
  ibmAcc.getElement(best, ibm);
  /* rest = jointWorld × inverseBind. Both column-major, as glTF stores them. */
  return { matrix: mulMat(jointNode.getWorldMatrix(), ibm), joint: jointNode.getName(), share: bestW / jointsAttr.getCount() };
}

/**
 * Generate the eight eyeLook* shapes by actually rotating the eyeballs.
 *
 * Every axis is MEASURED from the rig rather than assumed, so this does not
 * quietly produce a cross-eyed avatar on a model built facing the other way:
 *   · the left-right axis comes from the two eyeballs' own rest positions,
 *   · the up axis from the Neck→Head direction, which is the one direction in a
 *     humanoid rig that means the same thing whichever way the character faces.
 * The L/R assignment is then CHECKED against the LeftEye/RightEye joints the
 * eyeballs are actually weighted to, and the whole stage bails rather than
 * guessing if they disagree.
 */
function synthesiseGaze(doc, log) {
  const root = doc.getRoot();
  const nodeByName = new Map(root.listNodes().map(n => [n.getName(), n]));
  const eyes = {};
  for (const [key, meshName, wantJoint] of [['L', 'h_L_eye', 'LeftEye'], ['R', 'h_R_eye', 'RightEye']]) {
    const node = root.listNodes().find(n => n.getMesh()?.getName() === meshName);
    if (!node) { log(`gaze: SKIPPED — no node carrying mesh ${meshName}`); return []; }
    const rest = restTransformOf(node);
    if (!rest) { log(`gaze: SKIPPED — ${meshName} is not rigidly skinned`); return []; }
    if (rest.joint !== wantJoint) {
      log(`gaze: SKIPPED — ${meshName} is weighted to "${rest.joint}", not "${wantJoint}"; the L/R convention cannot be trusted`);
      return [];
    }
    const prim = node.getMesh().listPrimitives()[0];
    const pos = prim.getAttribute('POSITION');
    /* Centre of rotation = centre of the eyeball's own bounds, in rest space. */
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    const el = [];
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, el);
      const p = applyPoint(rest.matrix, el);
      for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
    }
    eyes[key] = {
      node, prim, pos,
      rest: rest.matrix, inv: invertMat(rest.matrix),
      centre: lo.map((v, k) => (v + hi[k]) / 2),
    };
  }

  const rightAxis = eyes.R.centre.map((v, k) => v - eyes.L.centre[k]);
  if (Math.hypot(...rightAxis) < 1e-6) { log('gaze: SKIPPED — the two eyeballs measure to the same point'); return []; }
  const head = nodeByName.get('Head'), neck = nodeByName.get('Neck');
  if (!head || !neck) { log('gaze: SKIPPED — Head/Neck not found'); return []; }
  const hp = applyPoint(head.getWorldMatrix(), [0, 0, 0]);
  const np = applyPoint(neck.getWorldMatrix(), [0, 0, 0]);
  const upAxis = hp.map((v, k) => v - np[k]);

  const f = v => v.map(x => x.toFixed(4)).join(', ');
  log(`gaze: eyeballs at L[${f(eyes.L.centre)}] R[${f(eyes.R.centre)}]`);
  log(`gaze: right axis [${f(rightAxis)}] · up axis [${f(upAxis)}]`);

  const rad = (GAZE_DEG * Math.PI) / 180;
  const made = [];
  for (const g of GAZE_MAP) {
    const e = eyes[g.eye];
    /* Right-hand rule, with `rightAxis` pointing at the character's right ear:
       +θ about it tips the pupil UP, so pitch takes its sign directly. +θ about
       `upAxis` turns the pupil toward the character's own RIGHT — which is the
       convention GAZE_MAP's yaw signs are written against. */
    const rot = g.pitch ? rotationMat(rightAxis, g.pitch * rad) : rotationMat(upAxis, -g.yaw * rad);
    const acc = zeroAccessorLike(doc, e.pos);
    const out = acc.getArray();
    const el = [];
    for (let i = 0; i < e.pos.getCount(); i++) {
      e.pos.getElement(i, el);
      const p = applyPoint(e.rest, el);                       // → rest space
      const rel = p.map((v, k) => v - e.centre[k]);           // → about the eyeball centre
      const rotated = applyDir(rot, rel).map((v, k) => v + e.centre[k]);
      const local = applyPoint(e.inv, rotated);               // → back to mesh space
      out[i * 3] = local[0] - el[0];
      out[i * 3 + 1] = local[1] - el[1];
      out[i * 3 + 2] = local[2] - el[2];
    }
    e.prim.addTarget(doc.createPrimitiveTarget(g.out).setAttribute('POSITION', acc));
    made.push(g.out);
  }
  for (const key of ['L', 'R']) {
    eyes[key].node.getMesh().setWeights(new Array(eyes[key].prim.listTargets().length).fill(0));
  }
  log(`gaze: synthesised ${made.length} shapes at ${GAZE_DEG}° → ${made.join(', ')}`);
  return made;
}

/* ── main ───────────────────────────────────────────────────────────────── */

function parseArgs(argv) {
  const o = { out: path.join(ROOT, 'assets', 'avatar.glb'), source: null, withSourceMorphs: false, explain: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') o.out = path.resolve(argv[++i]);
    else if (a === '--source') o.source = argv[++i];
    else if (a === '--with-source-morphs') o.withSourceMorphs = true;
    else if (a === '--explain') o.explain = true;
    else if (a === '--quiet') o.quiet = true;
    else if (a === '--help' || a === '-h') { o.help = true; }
    else throw new Error(`unknown argument: ${a}`);
  }
  return o;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const log = opts.quiet ? () => {} : (...a) => console.log('·', ...a);

  if (opts.help) {
    /* The file's own header comment is the manual; there is no second copy to
       drift. Strip the shebang and the comment fence. */
    const header = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0];
    console.log(header.replace(/^#![^\n]*\n/, '').replace(/^\/\* =+\n?/, '').trimEnd());
    return;
  }
  if (opts.explain) {
    console.log('VISEMES (15)');
    for (const s of VISEME_MAP) console.log(`  ${s.out.padEnd(12)} ← ${Object.entries(s.mix).map(([k, v]) => `${k}×${v}`).join(' + ') || '(zero-delta)'}\n      ${s.why}`);
    console.log('\nARKIT (mapped)');
    for (const s of ARKIT_MAP) console.log(`  ${s.out.padEnd(20)} ← ${Object.entries(s.mix).map(([k, v]) => `${k}×${v}`).join(' + ') || '(zero-delta)'}\n      ${s.why}`);
    console.log('\nGAZE (synthesised geometry, not mapped)');
    for (const g of GAZE_MAP) console.log(`  ${g.out.padEnd(20)} ← rotate ${g.eye === 'L' ? 'h_L_eye' : 'h_R_eye'} ${GAZE_DEG}° ${g.pitch ? (g.pitch > 0 ? 'up' : 'down') : (g.yaw > 0 ? 'yaw+' : 'yaw-')}`);
    return;
  }

  const t0 = Date.now();
  let glb;
  if (opts.source && !/^https?:/.test(opts.source)) {
    glb = fs.readFileSync(opts.source);
    log(`source: ${opts.source} (local)`);
  } else {
    glb = await fetchSource(opts.source || SOURCE.url, log);
  }
  const sha = crypto.createHash('sha256').update(glb).digest('hex');
  log(`source: ${glb.length.toLocaleString('en-US')} B · sha256 ${sha}`);
  if (!opts.source && sha !== SOURCE.sha256) {
    throw new Error(`source sha256 mismatch\n  expected ${SOURCE.sha256}\n  got      ${sha}\nUpstream changed. Re-verify the licence and the rig before pinning the new hash.`);
  }

  glb = normaliseTargetNames(glb, log);

  /* MeshoptDecoder instantiates its wasm asynchronously. Skipping this await
     works whenever something slow happened first — the very first run, which
     downloads the source, always passes — and then fails on every cached run
     with `Cannot read properties of undefined (reading 'exports')`. A race that
     only shows up on the second run is worth one line to remove. */
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.readBinary(new Uint8Array(glb));
  /* gltf-transform's own logger is INFO by default and narrates each transform
     to stderr; route it through the same --quiet switch as everything else so
     the tool has exactly one voice. */
  doc.setLogger(new Logger(opts.quiet ? Logger.Verbosity.SILENT : Logger.Verbosity.INFO));

  /* Decode away everything the pinned loader cannot read.

     Disposing the EXTENSION OBJECT is separate from decoding the data and is
     not optional: a document read from a meshopt file keeps EXTMeshoptCompression
     attached, and the writer then tries to RE-encode with a decoder-only
     registration, dying on `Cannot read properties of undefined (reading
     'encodeGltfBuffer')` — an error that says nothing about what is wrong. */
  await doc.transform(dequantize());
  const dropped = [];
  for (const ext of doc.getRoot().listExtensionsUsed()) {
    if (/EXT_meshopt_compression|KHR_draco_mesh_compression|KHR_mesh_quantization/.test(ext.extensionName)) {
      dropped.push(ext.extensionName);
      ext.dispose();
    }
  }
  log(`decoded: dropped ${dropped.join(' + ') || '(nothing to drop)'} · kept ${doc.getRoot().listExtensionsUsed().map(e => e.extensionName).join(', ') || 'no extensions'}`);

  buildArmature(doc, log);
  retargetRestPose(doc, 'side', log);
  remapMorphTargets(doc, opts, log);
  synthesiseGaze(doc, log);

  /* prune (drops the source accessors nothing references any more), dedup (the
     pure renames already share accessors; this catches the rest), then sparse.

     sparse() is the one that matters. A morph delta is zero over most of the
     mesh — a viseme does not move the scalp — and glTF's sparse accessor stores
     only the vertices that DO move. Without it this file is 32 MB of mostly
     zeroes; with it, 6.7. The source only got away with 1.6 MB because meshopt
     was doing the same job in a form the pinned loader cannot read.

     NOT quantize(). Measured, in this order:
         none                32,000,440 B   correct
         sparse               6,747,852 B   correct          ← shipped
         quantize            21,703,336 B   correct
         sparse → quantize   21,703,336 B   correct (quantize undoes the sparsity)
         quantize → sparse    4,350,992 B   CORRUPT
     The last one is the trap. gltf-transform's sparse writer zeroes the values
     of a NORMALIZED INTEGER accessor — every delta comes back all-zero — so the
     smallest file is also a mannequin, and only tools/check-avatar-glb.mjs's
     zero-delta detector tells the two apart. 2.4 MB is not worth a silent
     mouth; if that bug is ever fixed, `quantize → sparse` is the next win and
     the gate will confirm it in one run. */
  const census = tag => log(`${tag}: ${doc.getRoot().listAccessors().length} accessors · ${doc.getRoot().listSkins().length} skins · ${doc.getRoot().listNodes().length} nodes`);
  census('built  ');
  await doc.transform(prune());
  census('pruned ');
  await doc.transform(dedup());
  census('deduped');
  /* VALID ships one skin per mesh with identical joints and bind matrices;
     dedup folds all seven into one, which is where most of the node overhead
     went. */
  await doc.transform(sparse({ ratio: 1 / 3 }));
  census('packed ');

  /* Fixed generator string: the toolchain's own would change with every
     gltf-transform bump and break byte-for-byte reproducibility. */
  doc.getRoot().getAsset().generator = `aib-presenter tools/convert-valid-avatar.mjs (source: ${SOURCE.avatar})`;
  doc.getRoot().getAsset().copyright = 'VALID avatar library — MIT, Copyright (c) 2022 Tiffany Do. See docs/AVATAR.md.';

  const bytes = await io.writeBinary(doc);
  fs.mkdirSync(path.dirname(opts.out), { recursive: true });
  fs.writeFileSync(opts.out, bytes);

  log(`wrote ${opts.out} · ${bytes.length.toLocaleString('en-US')} B (${(bytes.length / 1048576).toFixed(2)} MiB) · sha256 ${crypto.createHash('sha256').update(bytes).digest('hex')}`);
  log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s — now run: node tools/check-avatar-glb.mjs ${path.relative(ROOT, opts.out)}`);
}

main().catch(e => { console.error('✗ ' + e.message); process.exit(1); });
