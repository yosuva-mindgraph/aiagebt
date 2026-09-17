/* ============================================================================
   THE MOTIONLESS MANNEQUIN.

   This is the failure that does not look like one. T7 found it directly: running
   the candidate GLB through gltf-transform's quantize() + sparse() produced a
   4.35 MB file that passed EVERY name-based check — 'Armature' present, 52/52
   bones, LeftEye/RightEye, 15/15 viseme_* morph targets, 52/52 ARKit shapes — and
   that loaded, rendered and lit correctly. sparse() had zeroed every morph delta.
   The names were all there. The geometry behind them was not. The avatar sat
   perfectly still through twelve scenes of narration and nothing anywhere said a
   word about it.

   So a clean load is not proof, a morph COUNT is not proof, and — this is the
   part worth being precise about — even `morphTargetInfluences` moving is not
   proof on its own. TalkingHead sets those influences from its own viseme
   schedule; it never reads the geometry. On a sparse-zeroed GLB the influences
   animate beautifully and the face does not move at all.

   Hence three checks, in the order that matters:

     1. GEOMETRY. Read morphAttributes.position for every viseme and every ARKit
        shape and take the largest absolute delta. This is the one that catches
        the mannequin, because it looks at the thing sparse() destroys.
     2. INFLUENCES. Drive a real line through the real backend and watch the
        influences rise mid-line and return to rest. This catches the opposite
        failure — good geometry that nothing is driving.
     3. tools/check-avatar-glb.mjs, run against the FILE, every time. It decodes
        the BIN chunk by hand with no npm dependencies, so it cannot start
        agreeing with whatever gltf-transform did. It existed already and was
        not wired to anything that runs; now it is.

   ── what is allowed to be inert, and why it is not a loophole ─────────────
   Exactly six targets may have zero deltas, and the set is asserted EXACTLY —
   not "at most six", not "these are ignored". A seventh appearing is a failure,
   and one of these six gaining geometry is also a failure, because that would
   mean the file changed under a test that claims to know what is in it.

     viseme_sil        silence IS the rest pose; every other viseme at 0 renders
                       the same thing, and the apply path skips absent keys.
     mouthRollLower    Daz/Mimic has no lip-roll shape at all — no analogue.
     mouthRollUpper    as above.
     mouthShrugUpper   Chin covers the lower shrug; faking the upper one from
                       the disgust shape drags the nose with it.
     mouthPressLeft    JawCompress is the only press shape, it is bilateral, and
     mouthPressRight   it is already spent on mouthClose — faking a one-sided
                       press from it would drive mouthClose twice.

   All six are documented in docs/AVATAR.md §5. They are present-by-name because
   talkinghead.mjs reads 20 of the ARKit shapes UNGUARDED every frame (:2619),
   so absent is a TypeError per frame and inert is one idle knob out of twenty.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { launch, openPage, ready, BUDGET, ROOT } from './lib/harness.mjs';

/** The only targets allowed to be present-and-inert. Asserted as a SET. */
const MAY_BE_INERT = [
  'mouthPressLeft', 'mouthPressRight', 'mouthRollLower', 'mouthRollUpper',
  'mouthShrugUpper', 'viseme_sil',
];

/* Measured POSITION deltas on the shipped avatar run from 0.0045 (viseme_FF, a
   lip-and-teeth shape that barely moves a vertex) to 0.036 (viseme_RR). The
   floor sits below the smallest of those.

   It does NOT need much margin, and tightening it would be a mistake: this is a
   zero/not-zero test, not a quality bar. sparse() writes exact 0.0 — it does not
   write 0.004. Anything that has to argue about the threshold is asking the
   wrong question. */
const FLOOR = 1e-3;

/* ── READ MORPH DELTAS THROUGH getX/getY/getZ, NEVER THROUGH .array ─────────
   This avatar's h_TeethDown morph attributes are INTERLEAVED: count is 4737 and
   itemSize is 3, but the backing .array is 28422 long, because POSITION and
   NORMAL deltas share one bufferView at stride 24. A naive scan of .array
   therefore reads the NEIGHBOURING NORMAL deltas as if they were positions.

   That is not a nitpick — it is a FALSE GREEN on exactly the failure this file
   exists to catch. sparse() zeroes POSITION and leaves the normals beside it
   untouched, so an .array scan finds those normals and reports a dead target as
   healthy. Measured against the deliberately zeroed avatar built at the bottom
   of this file: scanning .array reported 13 of 14 dead visemes as fine.

   getX/getY/getZ respect stride and offset on both BufferAttribute and
   InterleavedBufferAttribute, and read POSITION and nothing else.
   (This comment lives outside the probe: a backtick inside a template literal
   ends it, and the resulting error is a long way from its cause.) */
const PAGE_PROBE = `
window.__qaAvatar = {
  /* Largest absolute morph POSITION delta per target name, across every mesh
     that carries it. -1 means the mesh has the name but no position deltas. */
  deltas() {
    const th = window.app.presenter.backend.th;
    const out = {};
    th.scene.traverse(o => {
      if (!o.isMesh || !o.morphTargetDictionary) return;
      const pos = (o.geometry.morphAttributes && o.geometry.morphAttributes.position) || [];
      for (const [name, idx] of Object.entries(o.morphTargetDictionary)) {
        const attr = pos[idx];
        let mx = -1;
        if (attr) {
          mx = 0;
          for (let i = 0; i < attr.count; i++) {
            const d = Math.max(Math.abs(attr.getX(i)), Math.abs(attr.getY(i)), Math.abs(attr.getZ(i)));
            if (d > mx) mx = d;
          }
        }
        out[name] = Math.max(out[name] === undefined ? -1 : out[name], mx);
      }
    });
    return out;
  },

  /* Which attributes are interleaved, so the report can say so rather than
     leaving the next reader to rediscover it. */
  interleaving() {
    const th = window.app.presenter.backend.th;
    const out = [];
    th.scene.traverse(o => {
      if (!o.isMesh || !o.morphTargetDictionary) return;
      const pos = (o.geometry.morphAttributes && o.geometry.morphAttributes.position) || [];
      const strided = pos.filter(a => a && a.array && a.array.length > a.count * a.itemSize).length;
      if (strided) out.push(o.name + ': ' + strided + '/' + pos.length + ' interleaved');
    });
    return out;
  },

  /* The live influence of one target, read off the meshes TalkingHead bound to
     it (mtAvatar[name].ms are the morphTargetInfluences ARRAYS, .is the indices). */
  influence(name) {
    const mt = window.app.presenter.backend.th.mtAvatar[name];
    if (!mt || !mt.ms) return null;
    let mx = 0;
    for (let k = 0; k < mt.ms.length; k++) mx = Math.max(mx, Math.abs(mt.ms[k][mt.is[k]] || 0));
    return mx;
  },

  visemeNames() {
    return Object.keys(window.app.presenter.backend.th.mtAvatar).filter(k => k.startsWith('viseme_'));
  },

  /**
   * Speak a real line through the real backend and watch the visemes.
   * Returns the peak influence reached per viseme while speaking, and the
   * residual once it has been stopped and given time to settle.
   */
  async watchWhileSpeaking(seconds) {
    const b = window.app.presenter.backend;
    const v = window.app.presenter.voice;
    const ctx = v.audioCtx || b.audioContext;
    await ctx.resume().catch(() => {});

    // A synthetic clip in TalkingHead's OWN context (seam S3) — the ElevenLabs
    // shape, which is the path that actually drives visemes off an audio clock.
    const words = 'twenty one sources governed end to end and answerable'.split(' ');
    const buf = ctx.createBuffer(1, Math.round(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.sin(i / 24) * 0.05;
    const step = Math.round(seconds * 1000 / words.length);
    const clip = {
      audioBuffer: buf, words,
      wtimes: words.map((_, i) => i * step),
      wdurations: words.map(() => step),
      durationMs: Math.round(seconds * 1000),
    };

    const names = window.__qaAvatar.visemeNames();
    const peak = {}; names.forEach(n => peak[n] = 0);
    const samples = [];

    const flight = b.speak(words.join(' '), clip.durationMs, clip);
    const until = performance.now() + seconds * 1000;
    while (performance.now() < until) {
      await new Promise(r => requestAnimationFrame(r));
      let frameMax = 0, frameName = null;
      for (const n of names) {
        const v2 = window.__qaAvatar.influence(n) || 0;
        if (v2 > peak[n]) peak[n] = v2;
        if (v2 > frameMax) { frameMax = v2; frameName = n; }
      }
      samples.push([Math.round(performance.now() - (until - seconds * 1000)), Number(frameMax.toFixed(3)), frameName]);
    }

    b.stopSpeaking();
    await flight;
    // TalkingHead eases morphs back rather than snapping; give it real frames.
    for (let i = 0; i < 180; i++) await new Promise(r => requestAnimationFrame(r));
    const residual = {};
    let residualMax = 0;
    for (const n of names) { residual[n] = window.__qaAvatar.influence(n) || 0; residualMax = Math.max(residualMax, residual[n]); }

    return {
      peak, residual, residualMax,
      movers: Object.entries(peak).filter(([, v]) => v > 0.05).map(([n, v]) => n + '=' + v.toFixed(2)),
      samplesTaken: samples.length,
      busiestFrames: samples.filter(s => s[1] > 0.05).slice(0, 6),
    };
  },
};
`;

export async function run(t) {
  /* ── 0. the file-level gate, run every time rather than by hand ─────── */
  const glb = path.join(ROOT, 'assets/avatar.glb');
  const stat = fs.statSync(glb);
  t.note(`assets/avatar.glb — ${stat.size.toLocaleString()} B (${(stat.size / 1024 / 1024).toFixed(2)} MiB)`);

  let toolOut = '', toolOk = true;
  try {
    toolOut = execFileSync(process.execPath, ['tools/check-avatar-glb.mjs', 'assets/avatar.glb'],
      { cwd: ROOT, encoding: 'utf8' });
  } catch (err) { toolOk = false; toolOut = String(err.stdout || '') + String(err.stderr || ''); }
  t.ok(toolOk && /PASSES/.test(toolOut),
    'tools/check-avatar-glb.mjs passes against the shipped GLB — WIRED INTO THE GATE, not run by hand',
    (toolOut.trim().split('\n').pop() || '').trim());
  t.ok(/visemes: 15\/15 present/.test(toolOut), 'the file carries all 15 Oculus visemes',
    (toolOut.match(/visemes: .*/) || [''])[0]);
  t.ok(/ARKit: 52\/52 present/.test(toolOut), 'the file carries all 52 ARKit shapes',
    (toolOut.match(/ARKit: 52.*/) || [''])[0]);
  t.ok(!/EXT_meshopt_compression|KHR_draco/.test(toolOut),
    'no extension the pinned loader cannot decode offline (no meshopt, no draco)',
    (toolOut.match(/extensionsUsed: .*/) || [''])[0]);

  const browser = await launch();
  try {
    const { page, errors } = await openPage(browser, 'three', { budget: BUDGET.three });
    const info = await ready(page, BUDGET.three);
    t.ok(info.backendKind === 'talkinghead',
      'the 3D presenter is actually up (otherwise everything below is vacuous)', `backend=${info.backendKind}`);
    if (info.backendKind !== 'talkinghead') { await page.context().close(); return; }

    await page.evaluate(PAGE_PROBE);

    /* ── 1. GEOMETRY: the deltas sparse() would have zeroed ─────────── */
    const deltas = await page.evaluate(() => window.__qaAvatar.deltas());
    const strided = await page.evaluate(() => window.__qaAvatar.interleaving());
    if (strided.length) t.note(`interleaved morph attributes (read via getX/Y/Z, not .array): ${strided.join(' · ')}`);
    const visemes = Object.keys(deltas).filter(n => n.startsWith('viseme_')).sort();
    t.ok(visemes.length === 15, 'the loaded avatar exposes 15 viseme morph targets', `${visemes.length}: ok`);

    const inert = Object.entries(deltas).filter(([, v]) => v === 0).map(([n]) => n).sort();
    const noDeltaArray = Object.entries(deltas).filter(([, v]) => v < 0).map(([n]) => n).sort();

    const articulating = visemes.filter(n => n !== 'viseme_sil');
    const deadVisemes = articulating.filter(n => !(deltas[n] > FLOOR));
    t.ok(deadVisemes.length === 0,
      'every articulating viseme has REAL GEOMETRY behind it — this is the mannequin check',
      deadVisemes.length
        ? `ZERO-DELTA VISEMES: ${deadVisemes.join(', ')}`
        : `14/14 move · smallest ${articulating.map(n => [n, deltas[n]]).sort((a, b) => a[1] - b[1])[0].join('=')} · largest ${articulating.map(n => [n, deltas[n]]).sort((a, b) => b[1] - a[1])[0].join('=')}`);

    t.eq(inert, MAY_BE_INERT,
      'the inert set is EXACTLY the six documented placeholders — no seventh, and none of the six silently gained geometry');
    t.eq(noDeltaArray, [], 'no morph target is missing its position deltas entirely');

    // A whole-file sanity number: a sparse-zeroed GLB reports a handful of
    // movers, not most of the rig.
    const moving = Object.values(deltas).filter(v => v > FLOOR).length;
    t.ok(moving >= 60, 'the rig as a whole carries real deformation',
      `${moving} of ${Object.keys(deltas).length} morph targets have non-zero geometry`);

    /* ── 2. INFLUENCES: something is actually driving them ──────────── */
    const live = await page.evaluate(() => window.__qaAvatar.watchWhileSpeaking(4));
    t.ok(live.movers.length >= 3,
      'viseme influences MOVE mid-line — the mouth is being driven, not just modelled',
      `${live.movers.length} visemes peaked over 0.05: ${live.movers.slice(0, 6).join(' ')}`);
    t.ok(Math.max(...Object.values(live.peak)) > 0.3,
      'and they are driven to a real amplitude, not a twitch',
      `peak influence ${Math.max(...Object.values(live.peak)).toFixed(3)} over ${live.samplesTaken} frames`);
    t.ok(live.residualMax < 0.05,
      'and they return to rest once the line is stopped',
      `largest residual influence ${live.residualMax.toFixed(4)}`);
    t.note(`busiest frames [ms, influence, viseme]: ${JSON.stringify(live.busiestFrames)}`);

    /* ── 3. the head is on screen and rendering ─────────────────────── */
    const onScreen = await page.evaluate(() => {
      const c = document.querySelector('#avatar3d canvas');
      return c ? { w: c.width, h: c.height, cssW: c.clientWidth, visible: getComputedStyle(c).display !== 'none' } : null;
    });
    t.ok(onScreen && onScreen.w > 8 && onScreen.h > 8 && onScreen.visible,
      'the renderer canvas is mounted at a real size', JSON.stringify(onScreen));
    const busted = await page.evaluate(() => getComputedStyle(document.querySelector('#avatar')).display);
    t.ok(busted === 'none', 'and the canvas bust is hidden — exactly one presenter on screen', busted);

    t.eq(errors, [], 'no page errors while exercising the avatar');
    await page.context().close();

    /* ── 4. NEGATIVE CONTROL: build the mannequin and require a red ───────
       Everything above is green on a good file, which is exactly what the
       4.35 MB sparse-zeroed GLB was too. So reproduce that file: load the real
       avatar, fill every morph POSITION accessor with zeros — which is what
       sparse() did — and require BOTH detectors to go red on it.

       This is the check that says the other checks are real. If this block ever
       passes silently, the mannequin detector has stopped detecting. */
    await mannequinControl(t, browser);
  } finally {
    await browser.close();
  }
}

/** Zero every morph delta, exactly as gltf-transform's sparse() silently did. */
async function makeMannequin(outGlb) {
  const { NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(path.join(ROOT, 'assets/avatar.glb'));
  let zeroed = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      for (const target of prim.listTargets()) {
        const pos = target.getAttribute('POSITION');
        if (!pos) continue;
        const a = pos.getArray();
        a.fill(0);
        pos.setArray(a);
        zeroed++;
      }
    }
  }
  await io.write(outGlb, doc);
  return zeroed;
}

async function mannequinControl(t, browser) {
  const scratch = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'aib-mannequin-'));
  try {
    let zeroed = 0;
    try {
      zeroed = await makeMannequin(path.join(scratch, 'avatar.glb'));
    } catch (err) {
      t.ok(false, 'NEGATIVE CONTROL: could not build the mannequin GLB (run `npm ci` first)',
        String(err?.message || err).slice(0, 200));
      return;
    }
    t.note(`negative control: zeroed ${zeroed} morph targets — names intact, geometry gone`);

    /* (a) the file-level gate must refuse it, by NAME and with a non-zero exit */
    let out = '', code = 0;
    try {
      out = execFileSync(process.execPath, ['tools/check-avatar-glb.mjs', path.join(scratch, 'avatar.glb')],
        { cwd: ROOT, encoding: 'utf8' });
    } catch (err) { code = err.status; out = String(err.stdout || '') + String(err.stderr || ''); }
    t.ok(code !== 0 && /motionless mannequin/.test(out),
      'NEGATIVE CONTROL: check-avatar-glb.mjs REJECTS a sparse-zeroed avatar',
      (out.trim().split('\n').pop() || '').trim().slice(0, 160));
    t.ok(/15\/15 present/.test(out) && /52\/52 present/.test(out),
      '…and it rejected it despite 15/15 visemes and 52/52 ARKit being PRESENT BY NAME — which is the whole point',
      'a name-based check would have shipped this file');

    /* (b) and the in-browser check must go red on the same bytes.
       Build a whole --3d target around the mannequin in a scratch tree, so the
       browser assertion is exercised on a real, loadable page rather than on a
       hand-made fixture. build.js is COPIED, never symlinked: it resolves
       everything from its own __dirname and a symlink would build the repo. */
    fs.copyFileSync(path.join(ROOT, 'build.js'), path.join(scratch, 'build.js'));
    for (const l of ['index.html', 'src', 'vendor']) fs.symlinkSync(path.join(ROOT, l), path.join(scratch, l));
    fs.mkdirSync(path.join(scratch, 'assets'));
    fs.symlinkSync(path.join(ROOT, 'assets/fonts.css'), path.join(scratch, 'assets/fonts.css'));
    fs.renameSync(path.join(scratch, 'avatar.glb'), path.join(scratch, 'assets/avatar.glb'));
    execFileSync(process.execPath, ['build.js', '--3d'], { cwd: scratch, encoding: 'utf8' });

    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    await page.goto('file://' + path.join(scratch, 'dist', 'index-3d.html'),
      { waitUntil: 'load', timeout: BUDGET.three.load });
    await page.waitForFunction(() => Boolean(window.app), null, { timeout: BUDGET.three.attach });
    const kind = await page.evaluate(async () => { await window.app.ready; return window.app.presenter.backendKind; });

    if (kind !== 'talkinghead') {
      t.ok(false, 'NEGATIVE CONTROL: the mannequin build did not bring up the 3D backend', `backend=${kind}`);
    } else {
      await page.evaluate(PAGE_PROBE);
      const d = await page.evaluate(() => window.__qaAvatar.deltas());
      const dead = Object.keys(d).filter(n => n.startsWith('viseme_') && n !== 'viseme_sil' && !(d[n] > FLOOR));
      t.ok(dead.length === 14,
        'NEGATIVE CONTROL: the in-browser geometry check goes RED on the mannequin — it has teeth',
        `${dead.length}/14 articulating visemes reported dead: ${dead.slice(0, 5).join(',')}…`);

      /* And the proof that influences alone are NOT enough: on this very file,
         with every delta zeroed, TalkingHead still animates the influences
         beautifully. A gate built only on morphTargetInfluences would be green
         on a mannequin. */
      const live = await page.evaluate(() => window.__qaAvatar.watchWhileSpeaking(3));
      t.ok(live.movers.length >= 2,
        'NEGATIVE CONTROL: …and influences still animate on the mannequin — which is exactly why the GEOMETRY check has to exist',
        `${live.movers.length} visemes peaked over 0.05 on a face that cannot move: ${live.movers.slice(0, 4).join(' ')}`);
    }
    await ctx.close();
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}
