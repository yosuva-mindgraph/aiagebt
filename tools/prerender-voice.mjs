#!/usr/bin/env node
/* ============================================================================
   Render every spoken line ONCE, offline, and bake it into the build.

       node tools/prerender-voice.mjs              the 12 scenes' narration
       node tools/prerender-voice.mjs --scope all  + the knowledge-base answers
       node tools/prerender-voice.mjs --pack-only  repack the cache, call nothing
       node tools/prerender-voice.mjs --plan       what it WOULD do, no calls
       node tools/prerender-voice.mjs --force      re-render everything

   Output: assets/voice-clips.js — one assignment to window.AIB_VOICE_CLIPS,
   which build.js inlines into the canvas targets when it is there and omits
   cleanly when it is not. Generated and gitignored, for the same reason
   dist/index-3d.html is: it is megabytes of base64 that this script plus a key
   reproduces exactly.

   ── WHY THIS EXISTS ───────────────────────────────────────────────────────
   The deck used to narrate with the browser's speechSynthesis, which sounds
   like a machine reading a list. A live ElevenLabs key fixes that and breaks
   everything else: the booth pod has no network, the emailed file has no
   account, and a published artifact's CSP blocks the host outright. Rendering
   once, here, at a desk, with a key nobody ships, gives all three of them the
   real voice and costs them nothing at runtime.

   ── WHAT IT RENDERS ───────────────────────────────────────────────────────
   Nothing is typed twice. The corpus is READ from the sources at run time:

     · every lines[] entry of every scene in src/scenes.js — the DEFAULT scope,
       because the narration is the thing every viewer hears
     · --scope all adds spokenForm(a) of every entry in src/knowledge.js — the
       spoken form, not the answer HTML, because src/app.js speaks
       spokenForm(html) and a clip rendered from the markup would be audio of a
       string nobody ever says. It is 39 answers, 33 minutes and about 10 MB of
       base64 for content a demo touches three of, which is why it is opt-in;
       without it an answer falls back to Web Speech exactly as it always has.

   So adding a scene line adds a clip on the next run, and nothing here has to
   be kept in step with the script by hand.

   ── RESUMABLE AND IDEMPOTENT ──────────────────────────────────────────────
   Every clip lands in .voice-cache/ under voiceClipKey(text) — the SAME
   function src/voice.js uses to look it up at runtime, imported rather than
   copied, so the generator and the page cannot disagree about where a clip
   lives. A cached clip is reused unless the voice, model, format or settings
   it was rendered with have changed. Edit one narration line and exactly one
   clip is re-rendered; run the whole thing twice and the second run makes zero
   API calls. That matters because the corpus is minutes of calls, and because
   an editing pass on the script should not cost the whole of it again.

   ── THE KEY ───────────────────────────────────────────────────────────────
   Read from config.js (gitignored), or from --config <path>, or from
   AIB_VOICE_CONFIG. It is never logged, never written to the cache, never
   written to the payload, and never included in an error message — errors
   report status codes and the first line of the body, and the body of an auth
   failure does not contain the key you sent.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SCENES } from '../src/scenes.js';
import { KB } from '../src/knowledge.js';
import { spokenForm } from '../src/ask.js';
import { voiceClipKey, wordsFromAlignment, pickAlignment } from '../src/voice.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, '.voice-cache');
const OUT = path.join(ROOT, 'assets', 'voice-clips.js');

/* ── arguments ──────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const val = (f, d = null) => { const i = argv.indexOf(f); return i > -1 ? argv[i + 1] : d; };

const SCOPE = val('--scope', 'narration');      // narration | answers | all
const PACK_ONLY = has('--pack-only');
const PLAN = has('--plan');
const FORCE = has('--force');
const CONCURRENCY = Math.max(1, Number(val('--concurrency', 3)) || 3);

if (!['all', 'narration', 'answers'].includes(SCOPE)) {
  console.error(`--scope must be all | narration | answers (got ${JSON.stringify(SCOPE)})`);
  process.exit(1);
}

/* ── the key, and the rest of the voice settings ────────────────────────── */

/**
 * config.js is a browser file: one assignment to window.AIB_CONFIG. Run it with
 * a stand-in window rather than parsing it, so the file stays the single place
 * the settings live and a comment in it can never break this.
 */
function loadVoiceConfig() {
  const file = path.resolve(val('--config') || process.env.AIB_VOICE_CONFIG || path.join(ROOT, 'config.js'));
  if (!fs.existsSync(file)) {
    console.error(`no config at ${file}`);
    console.error('  cp config.example.js config.js and fill in elevenLabs.apiKey + voiceId,');
    console.error('  or point this at one:  node tools/prerender-voice.mjs --config /path/to/config.js');
    process.exit(1);
  }
  const win = {};
  new Function('window', fs.readFileSync(file, 'utf8'))(win);
  const el = (win.AIB_CONFIG || {}).elevenLabs || {};
  if (!el.apiKey || !el.voiceId) {
    console.error(`${file} has no elevenLabs.apiKey / voiceId.`);
    process.exit(1);
  }
  return {
    apiKey: el.apiKey,
    // Everything below this line is safe to print. apiKey is not, and is the
    // only field that never leaves this object.
    params: {
      voice: el.voiceId,
      model: el.modelId || 'eleven_v3',
      format: val('--format') || 'mp3_22050_32',
      settings: {
        stability: el.stability ?? 0.70,
        similarity_boost: el.similarity ?? 0.80,
        style: el.style ?? 0,
        use_speaker_boost: el.useSpeakerBoost ?? true,
      },
    },
  };
}

/* ── the corpus ─────────────────────────────────────────────────────────── */

/**
 * Every string the deck speaks, in the form it is actually spoken in.
 *
 * Deduplicated by key: two scenes that happen to share a line share one clip,
 * because the clip is addressed by the text and nothing else.
 */
function corpus() {
  const out = new Map();
  const add = (text, tier, from) => {
    const t = String(text || '').trim();
    if (!t) return;
    const key = voiceClipKey(t);
    const seen = out.get(key);
    if (seen) {
      if (seen.text !== t) {
        // A 64-bit space and 111 strings: this should never fire. If it ever
        // does, it is a clip about to play under the wrong line, so stop.
        console.error(`voiceClipKey COLLISION on ${key}:`);
        console.error(`  ${seen.from}: ${JSON.stringify(seen.text.slice(0, 70))}`);
        console.error(`  ${from}: ${JSON.stringify(t.slice(0, 70))}`);
        process.exit(1);
      }
      seen.from += `, ${from}`;
      return;
    }
    out.set(key, { key, text: t, tier, from });
  };

  SCENES.forEach((s, i) => (s.lines || []).forEach((l, j) =>
    add(l, 'narration', `scene ${i + 1} (${s.id}) line ${j + 1}`)));
  KB.forEach(e => add(spokenForm(e.a), 'answer', `kb ${e.id}`));

  const all = [...out.values()];
  if (SCOPE === 'all') return all;
  return all.filter(c => c.tier === (SCOPE === 'narration' ? 'narration' : 'answer'));
}

/* ── the cache ──────────────────────────────────────────────────────────── */

const mp3Path = key => path.join(CACHE, `${key}.mp3`);
const metaPath = key => path.join(CACHE, `${key}.json`);

/** The cached render for this key, if it was made with THESE settings. */
function cached(key, params) {
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath(key), 'utf8'));
    const same = meta.voice === params.voice
      && meta.model === params.model
      && meta.format === params.format
      && JSON.stringify(meta.settings) === JSON.stringify(params.settings);
    if (!same) return null;
    const size = fs.statSync(mp3Path(key)).size;
    if (!size || size !== meta.bytes) return null;
    return meta;
  } catch { return null; }
}

/* ── ElevenLabs ─────────────────────────────────────────────────────────── */

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * One line → one MP3 on disk plus its word timings in a sidecar.
 *
 * /with-timestamps answers JSON: the MP3 base64 in audio_base64, with the
 * character alignment beside it. The character-seconds to word-milliseconds
 * conversion is src/voice.js's wordsFromAlignment(), imported — there is one
 * converter in this repo and this is not a second one.
 */
async function render(item, key, params, attempt = 1) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(params.voice)}` +
    `/with-timestamps?output_format=${encodeURIComponent(params.format)}`,
    {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: item.text, model_id: params.model, voice_settings: params.settings }),
    });

  if (!res.ok) {
    const body = (await res.text()).slice(0, 200).replace(/\s+/g, ' ');
    // 429 is the rate limit and 5xx is theirs, not ours: both are worth waiting
    // out, because losing an eight-minute run to one blip is the thing that
    // makes people stop using a generator.
    if ((res.status === 429 || res.status >= 500) && attempt <= 4) {
      const wait = 2000 * attempt * attempt;
      console.log(`      ${res.status} — retrying in ${wait / 1000}s (attempt ${attempt + 1}/5)`);
      await sleep(wait);
      return render(item, key, params, attempt + 1);
    }
    throw new Error(`HTTP ${res.status}: ${body}`);
  }

  const payload = await res.json();
  const audio = Buffer.from(String(payload.audio_base64 || ''), 'base64');
  if (!audio.length) throw new Error('no audio_base64 in the response');

  const { words, wtimes, wdurations } = wordsFromAlignment(pickAlignment(payload));
  const align = pickAlignment(payload);
  const durationMs = align
    ? Math.round(Number(align.character_end_times_seconds.at(-1)) * 1000)
    : 0;

  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(mp3Path(item.key), audio);
  const meta = {
    key: item.key,
    tier: item.tier,
    from: item.from,
    text: item.text,
    chars: item.text.length,
    w: words.join(' '),
    t: wtimes.join(','),
    d: wdurations.join(','),
    nwords: words.length,
    durationMs,
    bytes: audio.length,
    voice: params.voice,
    model: params.model,
    format: params.format,
    settings: params.settings,
    renderedAt: new Date().toISOString(),
  };
  fs.writeFileSync(metaPath(item.key), JSON.stringify(meta, null, 2));
  return meta;
}

/* ── the payload ────────────────────────────────────────────────────────── */

/**
 * JSON that is safe to sit inside a script inside a document.
 *
 * JSON.stringify escapes quotes and backslashes and nothing else, so the two
 * characters that can end a script element early — the angle bracket and the
 * slash before it — are escaped here by hand. Base64 cannot produce them, but
 * the spoken WORDS travel in this object too, and those come from the sources.
 * U+2028 and U+2029 go with them: legal in JSON, line terminators in JS.
 */
const safeJson = value => JSON.stringify(value)
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/[\u2028\u2029]/g, c => (c === '\u2028' ? '\\u2028' : '\\u2029'));

function pack(items, params) {
  const clips = {};
  let mp3Bytes = 0, ms = 0, missing = 0, untimed = 0;

  for (const item of items) {
    const meta = cached(item.key, params);
    if (!meta) { missing++; continue; }
    clips[item.key] = {
      a: fs.readFileSync(mp3Path(item.key)).toString('base64'),
      w: meta.w,
      t: meta.t,
      d: meta.d,
    };
    mp3Bytes += meta.bytes;
    ms += meta.durationMs;
    if (!meta.nwords) untimed++;
  }

  const n = Object.keys(clips).length;
  const minutes = (ms / 60000).toFixed(1);
  const note = `${n} clips · ${minutes} min · ${params.format} · ${params.model} · scope ${SCOPE}`;
  const body = `/* voice-clips: ${note} */\n`
    + '/* GENERATED by tools/prerender-voice.mjs — do not edit, do not commit. */\n'
    + `window.AIB_VOICE_CLIPS = ${safeJson({
      v: 1, format: params.format, model: params.model, voice: params.voice,
      scope: SCOPE, n, mp3Bytes, ms, clips,
    })};\n`;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, body);
  return { n, missing, untimed, mp3Bytes, ms, bytes: Buffer.byteLength(body, 'utf8'), note };
}

/* ── run ────────────────────────────────────────────────────────────────── */

const mb = n => (n / 1024 / 1024).toFixed(2) + ' MB';

async function main() {
  const { apiKey, params } = loadVoiceConfig();
  const items = corpus();
  const narration = items.filter(i => i.tier === 'narration').length;

  console.log(`corpus   ${items.length} clips — ${narration} narration, ${items.length - narration} answers`);
  console.log(`voice    ${params.voice} · ${params.model} · ${params.format}`);
  console.log(`settings ${JSON.stringify(params.settings)}`);
  console.log(`cache    ${path.relative(ROOT, CACHE)}`);

  const todo = PACK_ONLY ? [] : items.filter(i => FORCE || !cached(i.key, params));
  console.log(`to render ${todo.length}${todo.length ? '' : '  (everything is already cached)'}`);

  if (PLAN) {
    for (const i of todo) console.log(`  would render ${i.key}  ${i.tier.padEnd(9)} ${i.chars || i.text.length}ch  ${i.from}`);
    return;
  }

  const t0 = Date.now();
  let done = 0, failed = [];
  if (todo.length) {
    // A small fixed pool. Three at a time turns ~9 minutes of serial calls into
    // ~3 and stays well clear of the rate limit; 429s are retried anyway.
    const queue = todo.slice();
    const worker = async () => {
      for (;;) {
        const item = queue.shift();
        if (!item) return;
        try {
          const meta = await render(item, apiKey, params);
          done++;
          console.log(`  ${String(done).padStart(3)}/${todo.length}  ${item.key}  ` +
            `${String(meta.bytes).padStart(7)}B  ${(meta.durationMs / 1000).toFixed(1)}s  ` +
            `${meta.nwords}w  ${item.from}`);
        } catch (err) {
          failed.push([item, err]);
          console.log(`  ✗       ${item.key}  ${item.from} — ${err.message}`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  }
  const wall = (Date.now() - t0) / 1000;

  const packed = pack(items, params);

  console.log('');
  console.log(`rendered  ${done} clip(s) in ${wall.toFixed(1)}s${failed.length ? `, ${failed.length} FAILED` : ''}`);
  console.log(`packed    ${packed.n}/${items.length} clips · ${mb(packed.mp3Bytes)} of MP3 · ` +
    `${(packed.ms / 60000).toFixed(1)} min of speech`);
  console.log(`          ${path.relative(ROOT, OUT)}  ${mb(packed.bytes)} as base64` +
    ` (+${((packed.bytes / packed.mp3Bytes - 1) * 100).toFixed(0)}%)`);
  if (packed.missing) console.log(`  ⚠  ${packed.missing} clip(s) are not in the cache — those lines will fall back.`);
  if (packed.untimed) console.log(`  ⚠  ${packed.untimed} clip(s) carry no word timings.`);
  if (failed.length) {
    console.log('');
    console.log('FAILED — rerun to pick up exactly these; everything else is cached:');
    for (const [item, err] of failed) console.log(`  ${item.from} — ${err.message}`);
    process.exit(1);
  }
  console.log('');
  console.log('now:  node build.js --3d --artifact');
}

main().catch(err => { console.error(err?.message || err); process.exit(1); });
