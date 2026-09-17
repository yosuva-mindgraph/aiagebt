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

   This file is inlined into EVERY build target, so that warning follows the
   built files out of the door. `node build.js` prints `config INLINED` when it
   has baked a key in; `node build.js --no-config` is how you produce something
   safe to hand over.
   ========================================================================== */

window.AIB_CONFIG = {

  /* ── The voice ─────────────────────────────────────────────────────────
     With this set, Iris speaks through ElevenLabs and her mouth follows the
     real audio. Without it she uses the browser's speechSynthesis voice.

     NOTE: a published Claude Artifact blocks every external host, so the
     preview link always falls back to the browser voice however this is set.
     Serve the repo from your own host and ElevenLabs takes over.           */
  elevenLabs: {
    apiKey: '',                       // sk_...
    voiceId: '',                      // pick one at elevenlabs.io/voice-library
    modelId: 'eleven_turbo_v2_5',     // turbo = lowest latency; v3 for most expressive
    stability: 0.42,                  // lower = more expressive, less consistent
    similarity: 0.80,
  },

  /* Tuning for the fallback browser voice. */
  webSpeech: {
    rate: 0.98,
    pitch: 1.0,
    voiceNameContains: '',            // e.g. 'Serena' to pin a specific system voice
  },

  /* ── The brain ─────────────────────────────────────────────────────────
     With this set, questions are answered by an LLM that is GROUNDED in
     src/knowledge.js — it may only answer from those facts. Adding a key makes
     Iris more fluent, not more imaginative; unanswerable stays unanswerable.

     Leave it empty and retrieval answers directly from the knowledge base,
     which works offline and is what an air-gapped venue will run.          */
  llm: {
    endpoint: 'https://api.anthropic.com/v1/messages',
    apiKey: '',                       // sk-ant-...   (or blank + your own proxy)
    model: 'claude-sonnet-5',
    maxTokens: 700,
    headers: {},                      // e.g. { Authorization: 'Bearer ...' } for a proxy
  },

  /* ── The presenter ─────────────────────────────────────────────────────
     NOTHING. Deliberately — and this note is here so you stop looking.

     There is no `avatar` block because src/avatar3d.js reads no key from this
     object at all. Its only globals are window.TalkingHead / window.LipsyncEn
     (the vendored bundle) and window.AIB_AVATAR_GLB_B64 (the base64 avatar),
     and both of those are PAYLOADS that build.js inlines — not settings. Do
     not paste a 35 MB GLB in here.

     Which presenter you get is therefore a BUILD decision, not a config one:

         node build.js        canvas presenter — the deliverable
         node build.js --3d   dist/index-3d.html, with TalkingHead and the GLB

     and at runtime the 3D one still declines politely (no WebGL, reduced
     motion, a rail with no size on a phone) and hands back to the canvas bust.

     The 3D backend does have tunables — camera framing, model FPS — but they
     are constructor options passed by src/presenter.js, defaulted in
     AVATAR3D_DEFAULTS, and nothing wires them to this file. A key added here
     for them would silently do nothing, which is worse than no key at all, so
     wire it through src/app.js first if you ever need one.                  */
};
