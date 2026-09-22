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
     With an apiKey, AIRIS speaks through ElevenLabs and the meter follows the
     real audio. Without it she uses the browser's speechSynthesis voice.

     Two personas, switchable from the header (the choice is remembered):
     'friday' (female) and 'jarvis' (male). Each names an ElevenLabs voice ID;
     the premade ones below are in every account, or paste your own.
     Soft, even narration: eleven_multilingual_v2 with stability ~0.6, a little
     style, speed just under 1. eleven_v3 is more expressive but slower and
     only takes stability 0 / 0.5 / 1.

     NOTE: a published Claude Artifact blocks every external host, so the
     preview link always falls back to the browser voice however this is set.
     Serve the repo from your own host and ElevenLabs takes over.           */
  elevenLabs: {
    apiKey: '',                       // sk_...
    persona: 'friday',                // 'friday' | 'jarvis' — the default until the visitor switches
    voices: {
      friday: { label: 'Friday', gender: 'female', voiceId: 'pFZP5JQG7iQjIQuC4Bku' },   // Lily — velvety, calm, British
      jarvis: { label: 'Jarvis', gender: 'male',   voiceId: 'JBFqnCBsd6RMkjVDRZzb' },   // George — warm, mature, British
    },
    voiceId: '',                      // legacy single voice; used only if the chosen persona has no voiceId
    modelId: 'eleven_multilingual_v2',
    stability: 0.62,
    similarity: 0.80,
    style: 0.12,
    speed: 0.93,                      // 0.7–1.2; ignored by eleven_v3
    prewarm: true,                    // after Start, generate every scene line in the background once (cached after that)
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

     provider: 'openai' (default) or 'anthropic'.
     endpoint: blank for the provider's own API, or an SDK-style base URL —
       e.g. Azure OpenAI 'https://<resource>.services.ai.azure.com/openai/v1'
       (the /chat/completions route is appended for you) — or your proxy.
     model: the model, or on Azure the DEPLOYMENT name.
     apiVersion: only for Azure's classic surface (…openai.azure.com/openai/
       deployments/…); the v1 surface above rejects it — leave blank there.
     reasoningEffort: gpt-5 / o-series only; defaults to 'minimal' for them so
       the thinking budget does not eat the spoken answer.

     Leave apiKey empty and retrieval answers directly from the knowledge base,
     which works offline and is what an air-gapped venue will run.          */
  llm: {
    provider: 'openai',
    apiKey: '',                       // sk-… / Azure key   (or blank + your own proxy at `endpoint`)
    model: 'gpt-4o-mini',             // OpenAI model or Azure deployment name, e.g. 'gpt-5.4-nano'
    endpoint: '',                     // blank = api.openai.com; or a base URL / proxy
    apiVersion: '',                   // Azure classic surface only
    reasoningEffort: '',              // '' = automatic ('minimal' for gpt-5 / o-series)
    maxTokens: 260,                   // raise to ~900 for a reasoning model; the prompt still keeps answers ≤70 words
    timeoutMs: 12000,                 // after this, fall back to the local answer
    headers: {},                      // extra headers, e.g. for a proxy
  },
};
