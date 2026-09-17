#!/usr/bin/env node
/* ============================================================================
   THE AVATAR ACCEPTANCE GATE.

       node tools/check-avatar-glb.mjs assets/avatar.glb
       node tools/check-avatar-glb.mjs assets/avatar.glb --list-morphs

   Exits non-zero if the GLB would not drive TalkingHead 1.7.0 properly. No npm
   dependencies on purpose: it parses the container by hand (12-byte header, JSON
   chunk length at offset 12, chunk type 0x4E4F534A at 16, JSON at 20) so it can
   be run against any candidate avatar before anything is installed, and so it
   cannot silently start agreeing with whatever gltf-transform did.

   It exists because the failure this project actually hit is not a crash.
   talkinghead.mjs:1260 throws 'Blend shapes not found' ONLY when
   `this.morphs.length === 0`. A rig with 96 morph targets under some other
   naming scheme — which is what every VALID avatar is — sails past that check,
   loads, renders, and then never moves its mouth. Counting morphs proves
   nothing; the names are the contract, and so is the geometry behind them.

   ── what is checked, and why each one is load-bearing ─────────────────────────

   armature       A node named EXACTLY 'Armature' (opt.modelRoot). On npm 1.7.0
                  showAvatar() throws 'Avatar object Armature not found', and
                  unlike git main it does NOT strip a `mixamorig` prefix.

   meshesInside   Every morph-carrying mesh must be a DESCENDANT of that
                  Armature node. This is the check a flat node-name scan misses
                  entirely: talkinghead.mjs:1251 collects morph meshes with
                  `this.armature.traverse(...)`, so a mesh that is a SIBLING of
                  the skeleton contributes nothing. VALID avatars ship exactly
                  that shape — seven mesh nodes and Hips, all at scene root —
                  and would produce a zero-morph load.

   bones          The 52 names showAvatar() requires (opt.modelRoot plus every
                  posePropNames prefix). Transcribed here rather than derived,
                  because this file must run without node_modules; vendor/
                  smoke.cjs derives the same list off the live instance and pins
                  its length, which is what catches the list itself moving.

   eyes           LeftEye / RightEye. NOT in the library's required[], but
                  showAvatar():1386 then calls objectLeftEye.getWorldPosition()
                  unguarded, so their absence is a death on `undefined` rather
                  than a named error.

   visemes        All 15 Oculus visemes. The mouth is the entire point; an
                  absent viseme is a phoneme with no shape. 'sil' is included in
                  the required set here — unlike the vendored smoke test, which
                  tolerates it — because this converter can and does emit it.

   arkit          The 52 ARKit shapes. Missing ones are reported individually
                  rather than as a count, because they are NOT interchangeable:
                    · 20 of them are in talkinghead's `mtRandomized` list, read
                      UNGUARDED every frame at :2619 (`j = this.mtAvatar[i];
                      if (!j.needsUpdate)`). Absent ⇒ a TypeError per frame.
                    · 6 more (eyeLookIn/Out Left/Right, eyesLookUp/Down) are
                      read unguarded at :2582-2587 on every eye-contact update.
                    · eyeLookUp/DownLeft/Right feed the mtExtras mixes.
                  So "survivable" is a per-name judgement, and the gate prints
                  the names so the judgement has to be written down.

   inertTargets   The silent-success detector. A morph target whose POSITION
                  deltas are all zero is present in name and does nothing. The
                  gate decodes the deltas out of the BIN chunk and reports them,
                  so a placeholder can never be mistaken for a working shape.
                  Any INERT VISEME is fatal — that is the motionless mannequin.

   loaderExts     glTF extensions the pinned loader cannot handle. TalkingHead
                  1.7.0 registers no MeshoptDecoder, and DRACOLoader is only
                  wired when dracoEnabled — which we must never set, because its
                  decoderPath is gstatic.com and this thing ships air-gapped.
                  The upstream c-frame GLBs use EXT_meshopt_compression, so this
                  check is the difference between a converted file and a
                  re-hosted one.
   ========================================================================== */

import fs from 'node:fs';
import process from 'node:process';

/* The 52 names showAvatar() derives from posePropNames — six spine/head joints
   plus 23 per side. Ordered so the printout groups readably. */
const BONES = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head'];
for (const s of ['Left', 'Right']) {
  for (const b of ['Shoulder', 'Arm', 'ForeArm', 'Hand', 'UpLeg', 'Leg', 'Foot', 'ToeBase',
    'HandThumb1', 'HandThumb2', 'HandThumb3', 'HandIndex1', 'HandIndex2', 'HandIndex3',
    'HandMiddle1', 'HandMiddle2', 'HandMiddle3', 'HandRing1', 'HandRing2', 'HandRing3',
    'HandPinky1', 'HandPinky2', 'HandPinky3']) BONES.push(s + b);
}

const EYES = ['LeftEye', 'RightEye'];

const ARKIT = `eyeBlinkLeft eyeBlinkRight eyeLookDownLeft eyeLookDownRight eyeLookInLeft
eyeLookInRight eyeLookOutLeft eyeLookOutRight eyeLookUpLeft eyeLookUpRight eyeSquintLeft
eyeSquintRight eyeWideLeft eyeWideRight jawForward jawLeft jawRight jawOpen mouthClose
mouthFunnel mouthPucker mouthLeft mouthRight mouthSmileLeft mouthSmileRight mouthFrownLeft
mouthFrownRight mouthDimpleLeft mouthDimpleRight mouthStretchLeft mouthStretchRight
mouthRollLower mouthRollUpper mouthShrugLower mouthShrugUpper mouthPressLeft mouthPressRight
mouthLowerDownLeft mouthLowerDownRight mouthUpperUpLeft mouthUpperUpRight browDownLeft
browDownRight browInnerUp browOuterUpLeft browOuterUpRight cheekPuff cheekSquintLeft
cheekSquintRight noseSneerLeft noseSneerRight tongueOut`.trim().split(/\s+/);

const VISEMES = ['viseme_sil', 'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD', 'viseme_kk',
  'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR', 'viseme_aa', 'viseme_E', 'viseme_I',
  'viseme_O', 'viseme_U'];

/* Read UNGUARDED by talkinghead.mjs every frame — see the header. An absence
   here is a per-frame TypeError, not a shape that merely cannot be driven. */
const ARKIT_FATAL_IF_ABSENT = new Set([
  // mtRandomized, :2619 — `j = this.mtAvatar[i]; if (!j.needsUpdate)`
  'mouthDimpleLeft', 'mouthDimpleRight', 'mouthLeft', 'mouthPressLeft', 'mouthPressRight',
  'mouthStretchLeft', 'mouthStretchRight', 'mouthShrugLower', 'mouthShrugUpper',
  'noseSneerLeft', 'noseSneerRight', 'mouthRollLower', 'mouthRollUpper', 'browDownLeft',
  'browDownRight', 'browOuterUpLeft', 'browOuterUpRight', 'cheekPuff', 'cheekSquintLeft',
  'cheekSquintRight',
  // eye contact, :2584-2587
  'eyeLookInLeft', 'eyeLookOutLeft', 'eyeLookInRight', 'eyeLookOutRight',
]);

/* The one viseme allowed to be zero-delta, and the only one.
   'sil' is silence, and silence is what the rest pose already renders — so a
   zero-delta target IS the correct shape, not a placeholder standing in for one.
   Traced through the published 1.7.0 tarball rather than assumed: no lipsync
   module ever EMITS viseme_sil (in lipsync-en/de/fi/fr it appears only as a row
   in the visemeDurations table), its one consumer is resetLips(), and that is
   guarded by `if (ndx !== undefined)` at :2736. Nothing is lost. Anything else
   flat is a phoneme with no mouth. */
const VISEME_MAY_BE_INERT = new Set(['viseme_sil']);

/* Extensions the pinned loader cannot decode. KHR_mesh_quantization and
   EXT_texture_webp are both supported by three r180 and are NOT listed. */
const LOADER_CANNOT_DECODE = ['EXT_meshopt_compression', 'KHR_draco_mesh_compression'];

const COMPONENT = {
  5120: { array: Int8Array, size: 1 }, 5121: { array: Uint8Array, size: 1 },
  5122: { array: Int16Array, size: 2 }, 5123: { array: Uint16Array, size: 2 },
  5125: { array: Uint32Array, size: 4 }, 5126: { array: Float32Array, size: 4 },
};
const NUM_COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

/** Split a .glb into its JSON chunk and its BIN chunk. */
function readGlb(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 20 || buf.toString('utf8', 0, 4) !== 'glTF') throw new Error(`${file}: not a GLB`);
  const jsonLen = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== 0x4e4f534a) throw new Error(`${file}: chunk 0 is not JSON`);
  const json = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
  /* Chunk 1, if present, is the BIN. Chunk headers are 8 bytes and padded to 4. */
  let bin = null;
  let off = 20 + jsonLen;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    if (type === 0x004e4942) { bin = buf.subarray(off + 8, off + 8 + len); break; }
    off += 8 + len + ((4 - (len % 4)) % 4);
  }
  return { buf, json, bin };
}

/**
 * Walk one accessor's values. Returns false as soon as a non-zero is seen, true
 * if every value read was zero, and null — "cannot tell" rather than "no" — when
 * the data is not reachable as plain uncompressed bytes. A gate that guessed
 * here would be worse than one that says it does not know.
 *
 * SPARSE IS THE TRAP. Blender/MPFB writes morph deltas as sparse accessors with
 * NO base bufferView at all: the base is zero-filled by spec and every real
 * value lives in accessor.sparse.values. Reading only the base therefore calls
 * every shape on such a file inert — which is exactly backwards, and would have
 * condemned a perfectly good avatar.
 */
function readAccessorAllZero(json, bin, acc) {
  const comp = COMPONENT[acc.componentType];
  if (!comp) return null;
  const nComp = NUM_COMPONENTS[acc.type];
  if (acc.bufferView !== undefined) {
    const bv = json.bufferViews[acc.bufferView];
    if (json.buffers[bv.buffer]?.uri !== undefined) return null;   // external .bin
    if (bv.extensions?.EXT_meshopt_compression) return null;       // needs the decoder
    if (!bin) return null;
    const elemSize = nComp * comp.size;
    const stride = bv.byteStride || elemSize;
    const base = (bv.byteOffset || 0) + (acc.byteOffset || 0);
    for (let i = 0; i < acc.count; i++) {
      const at = base + i * stride;
      if (at + elemSize > bin.length) return null;
      const view = new comp.array(bin.buffer, bin.byteOffset + at, nComp);
      for (let k = 0; k < view.length; k++) if (view[k] !== 0) return false;
    }
  }
  return true;
}

/** True iff this morph-delta accessor, base AND sparse override, is all zeros. */
function accessorIsAllZero(json, bin, index) {
  const acc = json.accessors?.[index];
  if (!acc) return null;
  const base = readAccessorAllZero(json, bin, acc);
  if (base !== true) return base;              // non-zero, or undecodable
  if (!acc.sparse) return acc.count ? true : null;
  /* The sparse override. Its values accessor is described inline rather than by
     index, so synthesise the shape readAccessorAllZero expects. */
  const v = acc.sparse.values;
  return readAccessorAllZero(json, bin, {
    bufferView: v.bufferView, byteOffset: v.byteOffset || 0,
    componentType: acc.componentType, type: acc.type, count: acc.sparse.count,
  });
}

export function checkGlb(file) {
  const { buf, json, bin } = readGlb(file);

  const nodes = json.nodes || [];
  const nodeNames = new Set(nodes.map(n => n.name).filter(Boolean));
  const miss = (list, have) => list.filter(x => !have.has(x));

  /* ── the Armature subtree ───────────────────────────────────────────────── */
  const armatureIdx = nodes.findIndex(n => n.name === 'Armature');
  const inArmature = new Set();
  if (armatureIdx >= 0) {
    const walk = i => { if (inArmature.has(i)) return; inArmature.add(i); (nodes[i].children || []).forEach(walk); };
    walk(armatureIdx);
  }

  /* ── morph targets, per mesh, with their names ──────────────────────────── */
  const meshTargetNames = (json.meshes || []).map(m => {
    /* targetNames live on the mesh, or on a primitive, or both — exporters
       disagree and both spellings are in the wild. Take whichever has them. */
    const fromMesh = m.extras?.targetNames || [];
    const fromPrim = m.primitives?.map(p => p.extras?.targetNames).find(x => x && x.length) || [];
    return fromMesh.length ? fromMesh : fromPrim;
  });

  const targets = new Set();          // every morph target name anywhere in the file
  const reachable = new Set();        // …reachable from the Armature, i.e. actually usable
  const inert = new Set();            // …whose POSITION deltas are all zero everywhere
  const zeroSomewhere = new Set();
  const movesSomewhere = new Set();
  const undetermined = new Set();     // …whose deltas could not be decoded here
  const morphMeshNodes = [];

  nodes.forEach((n, i) => {
    if (n.mesh === undefined) return;
    const names = meshTargetNames[n.mesh] || [];
    if (!names.length) return;
    morphMeshNodes.push({ node: n.name || `#${i}`, mesh: json.meshes[n.mesh].name, inArmature: inArmature.has(i), count: names.length });
    for (const t of names) { targets.add(t); if (inArmature.has(i)) reachable.add(t); }

    /* Zero-delta detection. A name is inert only if it is zero in EVERY
       primitive that carries it — the teeth copy of a viseme being flat is
       fine as long as the face copy moves — so record both verdicts and
       resolve after the walk. */
    for (const p of json.meshes[n.mesh].primitives || []) {
      (p.targets || []).forEach((tgt, ti) => {
        const name = names[ti];
        if (!name || tgt.POSITION === undefined) return;
        const z = accessorIsAllZero(json, bin, tgt.POSITION);
        if (z === null) undetermined.add(name);
        else if (z === true) zeroSomewhere.add(name);
        else movesSomewhere.add(name);
      });
    }
  });
  for (const name of zeroSomewhere) if (!movesSomewhere.has(name)) inert.add(name);

  const extsUsed = json.extensionsUsed || [];
  const out = {
    file,
    bytes: buf.length,
    nodes: nodeNames.size,
    morphTargets: targets.size,
    sceneRoots: (json.scenes?.[json.scene ?? 0]?.nodes || []).map(i => nodes[i]?.name),
    hasArmature: armatureIdx >= 0,
    mixamoPrefixed: [...nodeNames].some(n => n.startsWith('mixamorig')),
    morphMeshes: morphMeshNodes,
    morphMeshesOutsideArmature: morphMeshNodes.filter(m => !m.inArmature).map(m => m.node),
    bonesMissing: miss(BONES, nodeNames),
    bonesOutsideArmature: armatureIdx >= 0
      ? BONES.filter(b => { const i = nodes.findIndex(n => n.name === b); return i >= 0 && !inArmature.has(i); })
      : BONES.slice(),
    eyesMissing: miss(EYES, nodeNames),
    visemesMissing: miss(VISEMES, reachable),
    visemesInert: VISEMES.filter(v => inert.has(v)),
    visemesInertFatal: VISEMES.filter(v => inert.has(v) && !VISEME_MAY_BE_INERT.has(v)),
    arkitMissing: miss(ARKIT, reachable),
    arkitInert: ARKIT.filter(a => inert.has(a)),
    unreadableTargets: [...undetermined].length,
    extensionsUsed: extsUsed,
    extensionsLoaderCannotDecode: extsUsed.filter(e => LOADER_CANNOT_DECODE.includes(e)),
  };

  out.arkitMissingFatal = out.arkitMissing.filter(a => ARKIT_FATAL_IF_ABSENT.has(a));
  out.arkitMissingSurvivable = out.arkitMissing.filter(a => !ARKIT_FATAL_IF_ABSENT.has(a));

  out.failures = [];
  if (!out.hasArmature) out.failures.push("no node named exactly 'Armature' — showAvatar() throws 'Avatar object Armature not found'");
  if (out.mixamoPrefixed) out.failures.push('node names carry a mixamorig prefix — npm 1.7.0 does not strip it');
  if (out.bonesMissing.length) out.failures.push(`${out.bonesMissing.length} required bone(s) absent: ${out.bonesMissing.join(',')}`);
  if (out.bonesOutsideArmature.length) out.failures.push(`bone(s) outside the Armature subtree: ${out.bonesOutsideArmature.join(',')}`);
  if (out.eyesMissing.length) out.failures.push(`eye bone(s) absent: ${out.eyesMissing.join(',')} — getWorldPosition() of undefined at showAvatar():1386`);
  if (out.morphMeshesOutsideArmature.length) out.failures.push(`morph mesh(es) outside the Armature subtree, so armature.traverse() will not see them: ${out.morphMeshesOutsideArmature.join(',')}`);
  if (out.visemesMissing.length) out.failures.push(`viseme(s) absent: ${out.visemesMissing.join(',')} — those phonemes have no mouth shape`);
  if (out.visemesInertFatal.length) out.failures.push(`viseme(s) present but ZERO-DELTA: ${out.visemesInertFatal.join(',')} — this is the motionless mannequin`);
  if (out.arkitMissingFatal.length) out.failures.push(`ARKit shape(s) absent that talkinghead reads UNGUARDED: ${out.arkitMissingFatal.join(',')} — TypeError per frame`);
  if (out.extensionsLoaderCannotDecode.length) out.failures.push(`extension(s) the pinned loader cannot decode: ${out.extensionsLoaderCannotDecode.join(',')}`);

  out.PASSES = out.failures.length === 0;
  return out;
}

/* ── CLI ─────────────────────────────────────────────────────────────────── */
if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node tools/check-avatar-glb.mjs <file.glb> [--list-morphs]'); process.exit(2); }
  const r = checkGlb(file);
  const mb = (r.bytes / 1048576).toFixed(2);

  console.log(`${r.file}`);
  console.log(`  ${r.bytes.toLocaleString('en-US')} B (${mb} MiB) · ${r.nodes} nodes · ${r.morphTargets} morph targets`);
  console.log(`  scene roots: ${r.sceneRoots.join(', ')}`);
  console.log(`  Armature root: ${r.hasArmature ? 'present' : 'ABSENT'}${r.mixamoPrefixed ? ' · mixamorig prefix PRESENT' : ''}`);
  console.log(`  bones: ${BONES.length - r.bonesMissing.length}/${BONES.length} present, ${r.bonesMissing.length} missing${r.bonesMissing.length ? ` [${r.bonesMissing.join(',')}]` : ''}`);
  console.log(`  eyes: ${r.eyesMissing.length} missing${r.eyesMissing.length ? ` [${r.eyesMissing.join(',')}]` : ''}`);
  for (const m of r.morphMeshes) {
    console.log(`  morph mesh "${m.mesh}" · ${m.count} targets · ${m.inArmature ? 'inside Armature' : 'OUTSIDE ARMATURE — invisible to talkinghead'}`);
  }
  console.log(`  visemes: ${VISEMES.length - r.visemesMissing.length}/${VISEMES.length} present, ${r.visemesMissing.length} missing${r.visemesMissing.length ? ` [${r.visemesMissing.join(',')}]` : ''}`);
  if (r.visemesInert.length) {
    const ok = r.visemesInert.filter(v => VISEME_MAY_BE_INERT.has(v));
    const bad = r.visemesInertFatal;
    console.log(`  visemes zero-delta: [${r.visemesInert.join(',')}]${ok.length ? ` — ${ok.join(',')} is the rest pose and is correct` : ''}${bad.length ? ` — ${bad.join(',')} IS A DEAD PHONEME` : ''}`);
  }
  console.log(`  ARKit: ${ARKIT.length - r.arkitMissing.length}/${ARKIT.length} present, ${r.arkitMissing.length} missing`);
  if (r.arkitMissing.length) {
    console.log(`    missing (UNGUARDED — fatal): ${r.arkitMissingFatal.length ? r.arkitMissingFatal.join(', ') : '(none)'}`);
    console.log(`    missing (survivable):        ${r.arkitMissingSurvivable.length ? r.arkitMissingSurvivable.join(', ') : '(none)'}`);
  }
  if (r.arkitInert.length) console.log(`  ARKit present but ZERO-DELTA (inert placeholders): ${r.arkitInert.length} → ${r.arkitInert.join(', ')}`);
  console.log(`  extensionsUsed: ${r.extensionsUsed.join(', ') || '(none)'}`);
  if (r.unreadableTargets) console.log(`  note: ${r.unreadableTargets} target(s) could not be decoded here (compressed or external buffer) — zero-delta detection skipped for those`);

  if (process.argv.includes('--list-morphs')) {
    const { json } = readGlb(file);
    console.log('\n  morph targets by mesh:');
    for (const m of json.meshes || []) {
      const names = m.extras?.targetNames || m.primitives?.map(p => p.extras?.targetNames).find(x => x && x.length) || [];
      if (!names.length) continue;
      console.log(`   ${m.name} (${names.length}):`);
      for (let i = 0; i < names.length; i += 4) console.log('     ' + names.slice(i, i + 4).map(s => s.padEnd(24)).join(''));
    }
  }

  if (r.failures.length) {
    console.log(`\n${r.failures.length} failure(s):`);
    r.failures.forEach(f => console.log('  ✗ ' + f));
    process.exit(1);
  }
  console.log('\n✓ PASSES — this GLB satisfies the TalkingHead 1.7.0 rig + blend-shape contract.');
}
