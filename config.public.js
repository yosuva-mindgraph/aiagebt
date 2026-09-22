/* ============================================================================
   The config for a build that faces the PUBLIC INTERNET.

   This file is TRACKED. config.js is gitignored because it holds a key; this
   one is committed because it holds the opposite of a key — it is the file that
   says "there is no credential in this page, ask the server instead." Read that
   sentence as the spec: if a secret ever appears below, this file stops being
   safe to commit and the deck stops being safe to publish, in the same edit.

   Spliced in by `node build.js --public-config`, at the same config.js seam
   everything else uses. Nothing here is read at build time — it is one
   assignment statement inlined verbatim into the artifact, exactly as config.js
   is.

   ── WHAT THIS IS FOR ───────────────────────────────────────────────────────
   config.example.js has carried the warning for as long as it has existed:

       "A key in config.js is a key in the browser. Fine for a laptop you
        control on a stand. Not fine for anything reachable from the internet —
        anyone can open dev tools and take it. For that, leave apiKey blank and
        point `endpoint` at a small proxy of your own that holds the key
        server-side."

   This file IS that second half, written down rather than left as advice. The
   deck is deployed public and unauthenticated. There is a companion service
   (`aib-proxy`) that holds the ElevenLabs and Anthropic credentials server-side
   and exposes two keyless routes. The browser calls those routes; the key never
   leaves the VM.

   So the three configurations are now distinct, and they are not on a scale
   from worse to better — they are three different deployments:

       node build.js                     config.js   → key in the page.
                                         A laptop on a stand, that you own.
       node build.js --no-config         no config   → no network at all.
                                         The emailed file, the booth stick, the
                                         air-gapped venue. Pre-rendered speech
                                         and the local knowledge base.
       node build.js --public-config     this file   → same-origin proxy.
                                         The public URL. Live voice and a live
                                         LLM, no credential in the artifact.

   ── WHY THE PATHS ARE RELATIVE, AND WHY THAT IS NOT A STYLE CHOICE ─────────
   `/api/llm`, not `https://some-host/api/llm`, and this is the load-bearing
   line in the file.

   The deployment sits behind a Cloudflare quick tunnel, whose hostname is
   EPHEMERAL: a generated `*.trycloudflare.com` name that is different every
   time the tunnel restarts. (It is deliberately not written out here — this
   file is inlined verbatim into the artifact, so naming today's hostname even
   in a comment would ship a stale hostname to every visitor and invite someone
   to paste it into the endpoint below.) Bake that hostname in and the
   artifact is correct for as long as one process stays up, and silently broken
   afterwards: the page loads fine, the deck narrates fine off the pre-rendered
   speech, and only a question typed into the ask box reveals that every call is
   going to a host that no longer exists. A relative path has no hostname to go
   stale. It resolves against whatever origin served the page, so the same bytes
   work through the tunnel, through a future named hostname, and through
   `127.0.0.1:8090` on the VM itself.

   It is also what makes the request SAME-ORIGIN, which buys two things for
   free: no CORS preflight to configure on the proxy, and a Content-Security
   -Policy of `connect-src 'self'` that permits exactly these two calls and
   nothing else. See docker/default.conf.template, which routes /api/ and
   carries that CSP note.

   ── WHAT MUST NEVER BE ADDED HERE ──────────────────────────────────────────
   No credential of any kind. No ElevenLabs key, no Anthropic key, no bearer
   token in `headers`, no `voiceId`.

   The last one surprises people, so: the voice id is not a secret, but it is
   not a CLIENT's business either. src/voice.js only sends text to `/api/tts`;
   which voice speaks it is the proxy's decision, made server-side next to the
   key. Putting it here would mean a visitor could ask the proxy to render
   audio in any voice on the account, which is somebody else's bill.

   This is not left to discipline. build.js refuses to build if this file
   contains anything key-shaped or any populated credential field — see
   assertPublicConfigClean() there. The check exists because .dockerignore
   CANNOT protect this file: config.js is kept out of the image by being
   excluded from the build context, but this file has to ENTER the context to
   be built with, and it is in git besides. The fence that works for config.js
   is structurally unavailable here, so the guard is a content check instead.
   ========================================================================== */

window.AIB_CONFIG = {

  /* ── The voice ─────────────────────────────────────────────────────────
     Same-origin, keyless. src/voice.js POSTs the line to be spoken and gets
     audio back; the proxy adds the credential and picks the voice.

     If the proxy is down this does NOT break the deck. voice.js falls through
     exactly as it does for a missing key — to the pre-rendered speech if the
     build carries it, and to the browser's speechSynthesis if it does not.
     A proxy outage costs the live voice, never the walkthrough.            */
  elevenLabs: {
    endpoint: '/api/tts',
  },

  /* ── The brain ─────────────────────────────────────────────────────────
     Same-origin, keyless, and grounded server-side. src/ask.js treats a set
     `endpoint` as "there is an LLM" without needing a key alongside it, which
     is the whole point of a proxy.

     Degrades the same way: no proxy, no LLM, and retrieval answers straight
     out of src/knowledge.js — which is what the air-gapped build does all the
     time, so it is a well-travelled path rather than an emergency one.     */
  llm: {
    endpoint: '/api/llm',
  },

  /* Deliberately nothing else.

     Not webSpeech (its defaults are right and are src/voice.js's business),
     not model or maxTokens (the proxy pins those next to the key — a public
     page must not get to choose how many tokens it spends on someone else's
     account), and not `headers` (its documented use is an Authorization
     bearer, which is a credential, which is the one thing this file exists
     to not contain).

     Every field NOT here falls back to the default baked into src/. That is
     the safe direction: an unset field is a default, whereas a field set here
     is a public, editable-by-nobody-but-still-visible instruction to the
     server. Keep this file as small as it is. */
};
