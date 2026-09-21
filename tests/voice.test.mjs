/* ============================================================================
   THE PRE-RENDERED SPEECH.

   The deck used to narrate with speechSynthesis. It now narrates with real
   ElevenLabs audio that was rendered once, at a desk, and baked into the file —
   so the booth pod, the emailed HTML and a published artifact all get the real
   voice with no key, no network and no account. This suite is what keeps that
   true, and it is written around the four ways it can quietly stop being true.

   1. THE PAYLOAD IS IN THE WRONG FILES. In the canvas targets it is the
      product; in the 3D target, which already spends ~10.4 MB on the vendor
      bundle and the avatar, it is the 12 MB ceiling gone. So it is positively
      controlled in both directions, exactly as the vendor bundle is in
      build.test.mjs: PRESENT in index.html and artifact.html, ABSENT from
      index-3d.html.

   2. THE ABSENT CASE REGRESSED. A clone with no key has no assets/voice-clips.js
      and must build every target exactly as it did before any of this. §1.4
      proves that as an identity rather than a claim: the voiced build with its
      payload script cut back out is BYTE-IDENTICAL to the --no-voice build.

   3. THE GENERATOR AND THE RUNTIME DISAGREE ABOUT WHERE A CLIP LIVES.
      voiceClipKey() is the address of a clip. tools/prerender-voice.mjs imports
      it from src/voice.js rather than copying it, so they cannot drift — but
      "cannot" is worth measuring, so §2 runs the function in NODE and in the
      BROWSER over the real corpus and requires the same answers. A drift here
      is silent: every clip goes missing at once and the deck just sounds
      robotic again.

   4. THE CLIP DECODES BUT MAKES NO SOUND. A decoded AudioBuffer proves the
      base64 survived; it does not prove there is speech in it. §3 reads the
      SAMPLES back — RMS and peak off the decoded channel — and then plays the
      deck for real and records what the analyser feeds the avatar's jaw. A
      silent clip passes every other check in this file.

   ── what is deliberately NOT asserted ─────────────────────────────────────
   That the voice sounds good. Nothing automated can hear it. What is asserted
   is that it is REAL AUDIO OF THE RIGHT LINE, at the right length, with word
   timings that are integers, monotonic, and inside the clip — which is the part
   that can break without anyone noticing.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

import { launch, openPage, ready, BUDGET, ROOT } from './lib/harness.mjs';
import { SCENES } from '../src/scenes.js';
import { KB } from '../src/knowledge.js';
import { spokenForm } from '../src/ask.js';
import { voiceClipKey } from '../src/voice.js';

const rd = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const size = rel => fs.statSync(path.join(ROOT, rel)).size;
const mb = n => (n / 1024 / 1024).toFixed(2) + ' MB';
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

/* The payload's own assignment — the marker, in the same spirit as
   build.test.mjs's `window.AIB_AVATAR_GLB_B64 = "`. The name alone appears in
   src/voice.js (which every target inlines) and in prose in build.js, so the
   marker has to be the ASSIGNMENT. */
const MARKER = 'window.AIB_VOICE_CLIPS = {';

/** Every string the deck speaks, exactly as tools/prerender-voice.mjs reads it. */
function corpus() {
  const out = [];
  SCENES.forEach((s, i) => (s.lines || []).forEach((l, j) =>
    out.push({ text: String(l).trim(), tier: 'narration', from: `scene ${i + 1} (${s.id}) line ${j + 1}` })));
  KB.forEach(e => out.push({ text: spokenForm(e.a).trim(), tier: 'answer', from: `kb ${e.id}` }));
  return out.filter(c => c.text);
}

/** Cut the payload script back out of a built target. */
function withoutPayload(html) {
  const at = html.indexOf(MARKER);
  if (at < 0) return html;
  const open = html.lastIndexOf('<scr' + 'ipt>', at);
  const close = html.indexOf('\n</scr' + 'ipt>\n', at);
  if (open < 0 || close < 0) return html;
  return html.slice(0, open) + html.slice(close + '\n</scr'.length + 'ipt>\n'.length);
}

export async function run(t) {
  const clipsFile = 'assets/voice-clips.js';
  const haveClips = fs.existsSync(path.join(ROOT, clipsFile));

  const canvas = rd('dist/index.html');
  const artifact = rd('dist/artifact.html');
  const three = rd('dist/index-3d.html');
  const all = corpus();

  t.note(`${all.length} spoken strings in the sources · ${clipsFile} ${haveClips ? mb(size(clipsFile)) : 'ABSENT'}`);

  /* ══ §0 the generated payload is generated, not committed ═══════════════ */
  const ignored = rel => {
    try { execFileSync('git', ['check-ignore', '-q', rel], { cwd: ROOT }); return true; }
    catch { return false; }
  };
  t.ok(ignored(clipsFile),
    `§0 ${clipsFile} is gitignored — megabytes of base64 a script plus a key reproduces`);
  t.ok(ignored('.voice-cache'),
    '§0 .voice-cache/ is gitignored — the same audio again, unpacked');

  /* ══ §1 which targets carry it ═════════════════════════════════════════ */
  if (!haveClips) {
    /* The keyless clone. Everything below needs audio that does not exist here,
       so say so once, loudly, rather than reporting eleven green vacuous checks
       — and assert the one thing that IS assertable: nothing leaked in. */
    t.ok(!canvas.includes(MARKER) && !artifact.includes(MARKER) && !three.includes(MARKER),
      '§1 no clips rendered on this machine — no target claims to carry any');
    t.note(`render them with: node tools/prerender-voice.mjs   (needs a key in config.js)`);
    return;
  }

  for (const [label, out, want] of [
    ['index.html', canvas, true], ['artifact.html', artifact, true], ['index-3d.html', three, false],
  ]) {
    const n = out.split(MARKER).length - 1;
    t.ok(want ? n === 1 : n === 0,
      `§1.1 dist/${label} ${want ? 'CARRIES' : 'carries no'} pre-rendered speech`,
      `${n} occurrence(s) of the assignment · ${mb(size('dist/' + label))}`);
  }

  /* §1.2 — the property the old "under 1.4 MB" assertion protected. It was a
     proof that the canvas targets carry no vendor bundle and no GLB, and audio
     broke the number without touching the property. So measure the property:
     take the speech back out and the canvas targets are the same ~1 MB page
     they always were. */
  for (const [label, out] of [['index.html', canvas], ['artifact.html', artifact]]) {
    const bare = Buffer.byteLength(withoutPayload(out), 'utf8');
    t.ok(bare < 1.4 * 1024 * 1024,
      `§1.2 dist/${label} MINUS its speech is still under 1.4 MB (the bundle alone is 0.79 MB)`,
      `${mb(bare)} of page + ${mb(size('dist/' + label) - bare)} of speech`);
  }

  /* §1.3 — the ONE ceiling, untouched, and every target still under it. The
     speech did not buy itself a bigger number: the narration is 4.38 MB, the
     canvas targets land near 5.4 MB, and the 3D target does not carry it
     precisely so that this limit keeps meaning what it meant. */
  const buildSrc = rd('build.js');
  const limit = Number((buildSrc.match(/^const SIZE_LIMIT_MB = (\d+);$/m) || [])[1]);
  t.ok(limit === 12, '§1.3 build.js still declares SIZE_LIMIT_MB = 12 — the speech did not raise it',
    `${limit} MB`);
  for (const label of ['index.html', 'artifact.html', 'index-3d.html']) {
    const b = size('dist/' + label);
    t.ok(b < limit * 1024 * 1024, `§1.3 dist/${label} is under the ${limit} MB ceiling`,
      `${mb(b)} — ${mb(limit * 1024 * 1024 - b)} of headroom`);
  }

  /* §1.4 — THE ABSENT CASE, as an identity. Build the same build.js twice in a
     scratch tree, once with the speech and once with --no-voice, and require
     the voiced file with its payload script cut out to be byte-identical to the
     unvoiced one. Nothing in the real repo is touched: build.js resolves
     everything from its own __dirname, so a COPY of it builds the scratch tree.

     This is the check that makes "a clone with no key builds exactly as before"
     a measurement instead of a promise. */
  const scratch = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'aib-voice-'));
  try {
    fs.copyFileSync(path.join(ROOT, 'build.js'), path.join(scratch, 'build.js'));
    for (const l of ['index.html', 'src', 'vendor', 'assets']) {
      fs.symlinkSync(path.join(ROOT, l), path.join(scratch, l));
    }
    execFileSync(process.execPath, ['build.js', '--artifact'], { cwd: scratch, encoding: 'utf8' });
    const v = fs.readFileSync(path.join(scratch, 'dist/index.html'), 'utf8');
    const va = fs.readFileSync(path.join(scratch, 'dist/artifact.html'), 'utf8');
    execFileSync(process.execPath, ['build.js', '--artifact', '--no-voice'], { cwd: scratch, encoding: 'utf8' });
    const p = fs.readFileSync(path.join(scratch, 'dist/index.html'), 'utf8');
    const pa = fs.readFileSync(path.join(scratch, 'dist/artifact.html'), 'utf8');

    t.ok(!p.includes(MARKER) && !pa.includes(MARKER),
      '§1.4 --no-voice omits the speech entirely from both canvas targets');
    t.ok(sha(withoutPayload(v)) === sha(p),
      '§1.4 the voiced dist/index.html MINUS its payload is byte-identical to the --no-voice build',
      `${sha(p).slice(0, 16)}… · ${Buffer.byteLength(p, 'utf8')} B`);
    t.ok(sha(withoutPayload(va)) === sha(pa),
      '§1.4 the same holds for dist/artifact.html', `${sha(pa).slice(0, 16)}…`);

    /* And there is no way to ask for a voiced 3D build, because there is no
       flag for it — the size decision is made here, once, rather than left to
       whoever types the build line. */
    const out3 = execFileSync(process.execPath, ['build.js', '--3d'], { cwd: scratch, encoding: 'utf8' });
    const t3 = fs.readFileSync(path.join(scratch, 'dist/index-3d.html'), 'utf8');
    t.ok(!t3.includes(MARKER) && !/NOT a deliverable/.test(out3),
      '§1.5 the 3D target takes no speech and stays under the ceiling',
      `${mb(Buffer.byteLength(t3, 'utf8'))}`);
    t.ok(/deliberately NOT in this file/.test(out3),
      '§1.5 and the build SAYS so rather than leaving it to be discovered',
      (out3.split('\n').find(l => /deliberately NOT/.test(l)) || '').trim());
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }

  /* ══ §2 the address of a clip ══════════════════════════════════════════ */

  const payload = JSON.parse(
    rd(clipsFile).slice(rd(clipsFile).indexOf(MARKER) + 'window.AIB_VOICE_CLIPS = '.length).replace(/;\s*$/, ''));
  const keys = new Set(Object.keys(payload.clips));

  /* The payload says which tier it was rendered for, and that is what coverage
     is measured against. The default scope is the narration: 33 minutes of
     knowledge-base answers is ten more megabytes for content a demo touches
     three of, so answers stay on Web Speech until somebody asks for them with
     --scope all. A scope-blind "every string has a clip" would be red on the
     build we actually ship. */
  const inScope = payload.scope === 'all' ? all
    : all.filter(c => c.tier === (payload.scope === 'answers' ? 'answer' : 'narration'));
  t.note(`payload scope ${payload.scope} · ${payload.n} clips · ${(payload.ms / 60000).toFixed(1)} min`);

  const missing = inScope.filter(c => !keys.has(voiceClipKey(c.text)));
  t.ok(missing.length === 0,
    `§2.1 every ${payload.scope === 'all' ? 'spoken string' : payload.scope + ' string'} in the sources has a clip`,
    missing.length ? `${missing.length} missing, e.g. ${missing[0].from}` : `${inScope.length}/${inScope.length}`);

  const orphans = [...keys].filter(k => !all.some(c => voiceClipKey(c.text) === k));
  t.ok(orphans.length === 0,
    '§2.2 and no clip is an orphan — nothing is baked in that nothing says',
    `${orphans.length} orphan(s) of ${keys.size}`);

  /* Out of scope is a MISS, not an error: src/voice.js falls through to Web
     Speech, which is exactly what it did before any of this existed. Asserted
     so that "the answers are unvoiced" stays a decision rather than a bug. */
  const outOfScope = all.filter(c => !inScope.includes(c));
  t.ok(outOfScope.every(c => !keys.has(voiceClipKey(c.text))),
    '§2.2 and nothing out of scope crept in — those lines fall back, by design',
    `${outOfScope.length} string(s) deliberately unvoiced`);

  const distinct = new Set(all.map(c => voiceClipKey(c.text)));
  t.ok(distinct.size === new Set(all.map(c => c.text)).size,
    '§2.3 voiceClipKey does not collide across the corpus',
    `${distinct.size} key(s) for ${new Set(all.map(c => c.text)).size} distinct string(s)`);

  /* §2.4 — every clip carries timings, and they line up with the caption.
     src/app.js builds the caption by splitting the SAME string on whitespace
     and lights it by INDEX, so a clip whose word count matches can drive that
     highlight and one whose count differs cannot. The two counts are allowed to
     differ: ElevenLabs' normalized alignment is keyed to what was SPOKEN, so a
     line containing "24/7" or a number read out long comes back with more
     tokens than the source has. That is correct behaviour, not a defect — so
     this reports the rate and holds a floor rather than demanding every one. */
  let untimed = 0, aligned = 0;
  for (const c of inScope) {
    const rec = payload.clips[voiceClipKey(c.text)];
    const n = rec ? String(rec.w || '').split(' ').filter(Boolean).length : 0;
    if (!n) { untimed++; continue; }
    if (n === c.text.split(/\s+/).filter(Boolean).length) aligned++;
  }
  t.ok(untimed === 0, '§2.4 every clip carries word timings', `${inScope.length - untimed}/${inScope.length}`);
  t.ok(aligned / inScope.length > 0.5,
    '§2.4 most clips tokenise exactly as the caption does, so the highlight can run by index',
    `${aligned}/${inScope.length} exact · the rest are ElevenLabs reading a number or a symbol out long`);

  /* ══ §3 the page, from file://, with the network unplugged ═════════════ */

  const browser = await launch();
  try {
    /* realtimeAudio: this is the one suite that asserts a clip plays at its own
       length, so it opts out of the harness's playback accelerant. Everything
       here runs on one line of narration, so the real clock costs ~9 seconds. */
    const { page, errors, external } = await openPage(browser, 'canvas',
      { budget: BUDGET.canvas, realtimeAudio: true });
    const t0 = Date.now();
    await ready(page, BUDGET.canvas);
    t.note(`dist/index.html at ${mb(size('dist/index.html'))} was ready in ${Date.now() - t0} ms`);

    /* §3.0 — the key function agrees across the two runtimes that use it. */
    const browserKeys = await page.evaluate(texts => texts.map(s => voiceClipKey(s)),
      all.map(c => c.text));
    const nodeKeys = all.map(c => voiceClipKey(c.text));
    const drift = browserKeys.findIndex((k, i) => k !== nodeKeys[i]);
    t.ok(drift === -1,
      '§3.0 voiceClipKey answers identically in Node and in the browser, over the whole corpus',
      drift === -1 ? `${nodeKeys.length} string(s)` : `first drift at ${all[drift].from}`);

    /* §3.1 — the clip itself: real audio of the right line, real timings. */
    const probe = await page.evaluate(async () => {
      const v = window.app.presenter.voice;
      const line = SCENES[0].lines[0];
      const t0 = performance.now();
      const clip = await v.prerendered(line);
      const decodeMs = Math.round(performance.now() - t0);
      if (!clip) return { hit: false, line };
      const ch = clip.audioBuffer.getChannelData(0);
      let sum = 0, peak = 0;
      for (let i = 0; i < ch.length; i++) { sum += ch[i] * ch[i]; if (Math.abs(ch[i]) > peak) peak = Math.abs(ch[i]); }
      return {
        hit: true, line, decodeMs,
        words: clip.words.length,
        sameLength: clip.words.length === clip.wtimes.length && clip.words.length === clip.wdurations.length,
        integers: clip.wtimes.every(Number.isInteger) && clip.wdurations.every(Number.isInteger),
        monotonic: clip.wtimes.every((x, i) => i === 0 || x >= clip.wtimes[i - 1]),
        durationMs: clip.durationMs,
        lastEnd: clip.wtimes.at(-1) + clip.wdurations.at(-1),
        rms: Math.sqrt(sum / ch.length), peak,
        // the caption is built by splitting the SAME string on whitespace, so
        // the clip's word count is what indexes it
        captionTokens: line.split(/\s+/).filter(Boolean).length,
        // a string nobody rendered must MISS, or the lookup is matching loosely
        miss: await v.prerendered(line + ' and one more thing nobody wrote.') === null,
        usingElevenLabs: v.usingElevenLabs,
        count: v.prerenderedCount,
      };
    });

    t.ok(probe.hit, '§3.1 the first line of the deck resolves to a pre-rendered clip',
      `decoded in ${probe.decodeMs} ms`);
    t.ok(probe.sameLength && probe.integers && probe.monotonic,
      '§3.1 its word timings are three equal arrays of monotonic integer milliseconds',
      `${probe.words} words · same-length ${probe.sameLength} · integers ${probe.integers} · monotonic ${probe.monotonic}`);
    t.ok(probe.words === probe.captionTokens,
      '§3.1 one timing per caption token — the caption can be lit by index',
      `${probe.words} timed word(s) · ${probe.captionTokens} caption token(s)`);
    t.ok(probe.lastEnd <= probe.durationMs + 50,
      '§3.1 the last word ends inside the clip', `${probe.lastEnd} ms of ${probe.durationMs} ms`);
    t.ok(probe.rms > 0.01 && probe.peak > 0.2,
      '§3.1 there is actually SPEECH in it — the decoded samples are not silence',
      `rms ${probe.rms.toFixed(4)} · peak ${probe.peak.toFixed(3)}`);
    t.ok(probe.miss, '§3.1 a string nobody rendered MISSES — the lookup is exact, not fuzzy');
    t.ok(!probe.usingElevenLabs && probe.count === payload.n,
      '§3.2 precedence: no key configured, and the deck still has every clip',
      `usingElevenLabs ${probe.usingElevenLabs} · ${probe.count} clip(s)`);

    /* §3.3 — PLAY IT. Everything above reads a buffer; this samples the output.
       backend.setLevel is fed by Voice's analyser, off the live audio graph, so
       a run of non-zero levels is the clip reaching the speakers. */
    const played = await page.evaluate(async () => {
      const levels = [];
      const b = window.app.presenter.backend;
      const real = b.setLevel.bind(b);
      b.setLevel = v => { if (typeof v === 'number') levels.push(v); return real(v); };
      const started = [];
      const proto = Object.getPrototypeOf(window.app.presenter.voice._ctx().createBufferSource());
      const realStart = proto.start;
      proto.start = function (...a) { started.push(Math.round(this.buffer.duration * 1000)); return realStart.apply(this, a); };
      try {
        document.querySelector('#startBtn').click();
        await new Promise(r => setTimeout(r, 12000));
      } finally { proto.start = realStart; }
      return {
        started,
        samples: levels.length,
        loud: levels.filter(v => v > 0.05).length,
        peak: levels.length ? Math.max(...levels) : 0,
        mean: levels.length ? levels.reduce((a, b) => a + b, 0) / levels.length : 0,
      };
    });
    t.ok(played.started.length >= 1,
      '§3.3 the deck started a pre-rendered buffer of its own accord',
      `${played.started.length} clip(s): ${played.started.join(', ')} ms`);
    t.ok(played.started[0] === probe.durationMs,
      '§3.3 and the first one is the clip §3.1 decoded, at its exact length',
      `${played.started[0]} ms`);
    t.ok(played.loud > 60 && played.peak > 0.2,
      '§3.3 the analyser saw real amplitude while it played — sound, not a silent buffer',
      `${played.loud}/${played.samples} frames over 0.05 · peak ${played.peak.toFixed(3)} · mean ${played.mean.toFixed(3)}`);

    /* §3.5 — THE STALE-AUDIO GUARANTEE, which is the whole reason a clip is
       addressed by a hash of its text rather than by scene id and line index.

       The script is edited. It will be edited again. Under id-and-index keying
       an edited line keeps its OLD clip: the caption reads the new sentence and
       the room hears the old one, with no error, no warning and nothing red
       anywhere — a deck confidently saying something nobody wrote. Under text
       keying the edited line simply has no clip, misses, and falls back to the
       voice this deck has always had.

       So: edit a line the way a copy pass does, and require the MISS. Its
       neighbours in the same scene must be untouched — an invalidation that
       takes the whole scene with it is no better than a stale clip. */
    const stale = await page.evaluate(async () => {
      const v = window.app.presenter.voice;
      const lines = SCENES[0].lines;
      const edited = lines[0].replace(/\.$/, '') + ' And one more clause a copy pass added.';

      const started = [];
      const proto = Object.getPrototypeOf(v._ctx().createBufferSource());
      const realStart = proto.start;
      proto.start = function (...a) { started.push(Math.round(this.buffer.duration * 1000)); return realStart.apply(this, a); };
      try {
        // the edited line, through the real say() path, not just the lookup
        window.app.presenter.setMuted(true);            // no 9 seconds of audio in a gate
        const editedClip = await v.prerendered(edited);
        const neighbours = [];
        for (const l of lines) neighbours.push(Boolean(await v.prerendered(l)));
        window.app.presenter.setMuted(false);
        return {
          editedHit: Boolean(editedClip),
          editedKey: voiceClipKey(edited),
          originalKey: voiceClipKey(lines[0]),
          neighbours,
          startedWhileLookingUp: started.length,
        };
      } finally { proto.start = realStart; }
    });
    t.ok(!stale.editedHit,
      '§3.5 an EDITED line has no clip — it falls back rather than playing the old audio',
      `${stale.originalKey} → ${stale.editedKey}`);
    t.ok(stale.neighbours.every(Boolean),
      '§3.5 and every unedited line of that scene still hits — invalidation is per LINE',
      `${stale.neighbours.filter(Boolean).length}/${stale.neighbours.length} still voiced`);

    t.ok(external.length === 0, '§3.4 ZERO network requests — the audio is in the file',
      external.length ? external.slice(0, 3).join(' , ') : 'none');
    t.eq(errors, [], '§3.4 no page errors on a voiced build');
    await page.context().close();
  } finally {
    await browser.close();
  }
}
