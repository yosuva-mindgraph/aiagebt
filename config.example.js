/* ============================================================================
   Copy to config.js and fill in. config.js is gitignored — never commit a key.

       cp config.example.js config.js

   Everything below is optional. With no config at all the walkthrough still
   runs end to end: it narrates with the browser's built-in voice and answers
   questions from the knowledge base in src/knowledge.js.

   ── A WARNING WORTH READING ────────────────────────────────────────────────
   A key in config.js is a key in the browser. Fine for a laptop you control on
   a stand. Not fine for anything reachable from the internet — anyone can open
   dev tools and take it. For that, leave apiKey blank and point `endpoint` at a
   small proxy of your own that holds the key server-side. See README.
   ========================================================================== */

window.AIB_CONFIG = {

  /* ── The voice ─────────────────────────────────────────────────────────
     With an apiKey, AIRIS speaks through ElevenLabs and her mouth follows the
     real audio. Without it she uses the browser's speechSynthesis voice.

     voiceId: leave blank for the default premade voice, or pick one at
     elevenlabs.io/voice-library and paste its ID.

     NOTE: a published Claude Artifact blocks every external host, so the
     preview link always falls back to the browser voice however this is set.
     Serve the repo from your own host and ElevenLabs takes over.           */
  elevenLabs: {
    apiKey: '',                       // sk_...
    voiceId: '',                      // blank = default voice
    modelId: 'eleven_turbo_v2_5',     // turbo = lowest latency; eleven_multilingual_v2 = most expressive
    stability: 0.45,                  // lower = more expressive, less consistent
    similarity: 0.80,
    style: 0.35,                      // a little warmth; 0 = flat
  },

  /* Tuning for the fallback browser voice. */
  webSpeech: {
    rate: 1.0,
    pitch: 1.05,
    voiceNameContains: '',            // e.g. 'Samantha' to pin a specific system voice
  },

  /* ── The brain ─────────────────────────────────────────────────────────
     With a key, questions are answered by an LLM that is GROUNDED in
     src/knowledge.js — it may only answer from those facts. A key makes AIRIS
     more fluent, not more imaginative; unanswerable stays unanswerable.

     provider: 'openai' (default) or 'anthropic'. Leave endpoint blank to use
     the provider's own API, or set it to your proxy and leave apiKey blank.

     Leave apiKey empty and retrieval answers directly from the knowledge base,
     which works offline and is what an air-gapped venue will run.          */
  llm: {
    provider: 'openai',
    apiKey: '',                       // sk-...        (or blank + your own proxy at `endpoint`)
    model: 'gpt-4o-mini',             // any OpenAI chat model; for Anthropic use e.g. 'claude-sonnet-5'
    endpoint: '',                     // blank = provider default; or 'https://your-proxy/…'
    maxTokens: 260,                   // short answers on purpose — AIRIS speaks these aloud
    timeoutMs: 12000,                 // after this, fall back to the local answer
    headers: {},                      // e.g. { Authorization: 'Bearer …' } for a proxy
  },
};
