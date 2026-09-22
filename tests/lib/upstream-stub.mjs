/* ============================================================================
   The stubbed upstream, installed BEFORE proxy/server.mjs loads.

       node --import tests/lib/upstream-stub.mjs proxy/server.mjs

   proxy/server.mjs calls api.anthropic.com and api.elevenlabs.io through the
   global fetch, by absolute URL. This replaces that fetch in the same process,
   before the server's first line runs, and records what it was handed.

   TWO reasons it is this rather than a rewritten base URL in the proxy:

     1. The proxy is the code under test. Adding an AIB_UPSTREAM_BASE knob to
        server.mjs so it could be tested would mean the thing gated is not the
        thing deployed, and it would put a "point this at any host" switch into
        a service that faces the internet. The test bends; the product does not.

     2. It makes an outbound call IMPOSSIBLE rather than merely unlikely. There
        is no path from here to a real API: every URL is answered locally, so no
        key is needed, none is read, and no request can be billed. The keys the
        launcher supplies are literal fakes, which is fine precisely because
        nothing downstream of this file ever uses them for anything.

   Everything it captures is written as JSONL to AIB_UPSTREAM_CAPTURE, so the
   suite can assert on the body the proxy COMPOSED — which is where "does it
   forward a caller's system prompt" is actually answerable.
   ========================================================================== */

import fs from 'node:fs';

const CAPTURE = process.env.AIB_UPSTREAM_CAPTURE || '';
const MODE = process.env.AIB_UPSTREAM_MODE || 'ok';
const STATUS = Number(process.env.AIB_UPSTREAM_STATUS || 200);
const BODY = process.env.AIB_UPSTREAM_BODY || '';

const record = entry => {
  if (!CAPTURE) return;
  try { fs.appendFileSync(CAPTURE, JSON.stringify(entry) + '\n'); } catch { /* best effort */ }
};

const ANTHROPIC_OK = {
  id: 'msg_stub', type: 'message', role: 'assistant', model: 'claude-sonnet-5',
  content: [{ type: 'text', text: '<p>A stubbed upstream answer.</p>' }],
  stop_reason: 'end_turn',
};

/* The shape src/voice.js reads. Kept minimal on purpose — the proxy passes the
   body through byte for byte and never looks inside it, so what matters here is
   that the bytes arrive unchanged, which the suite checks by comparing what it
   gets back against this. */
const ELEVENLABS_OK = {
  audio_base64: 'UklGRiQAAABXQVZF',
  alignment: {
    characters: ['h', 'i'],
    character_start_times_seconds: [0, 0.1],
    character_end_times_seconds: [0.1, 0.2],
  },
  normalized_alignment: {
    characters: ['h', 'i'],
    character_start_times_seconds: [0, 0.1],
    character_end_times_seconds: [0.1, 0.2],
  },
};

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : String(input?.url || input);
  let parsed = null;
  try { parsed = JSON.parse(init.body || 'null'); } catch { parsed = null; }

  record({
    url,
    method: init.method || 'GET',
    headers: Object.fromEntries(Object.entries(init.headers || {})),
    body: parsed,
    rawBody: typeof init.body === 'string' ? init.body : null,
  });

  if (MODE === 'wedge') {
    // Never resolves unless the caller's AbortSignal fires — which is the proxy
    // having its own deadline, the thing this mode is here to observe.
    return new Promise((_resolve, reject) => {
      const sig = init.signal;
      if (sig) sig.addEventListener('abort', () => {
        const e = new Error('The operation was aborted'); e.name = 'AbortError'; reject(e);
      });
    });
  }

  if (MODE === 'throw') throw new Error('stubbed upstream transport failure');

  const isTts = /elevenlabs/i.test(url);
  const body = BODY || JSON.stringify(isTts ? ELEVENLABS_OK : ANTHROPIC_OK);
  const status = MODE === 'status' ? STATUS : 200;

  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
