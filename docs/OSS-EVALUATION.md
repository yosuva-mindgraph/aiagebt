# Open source we could take and customise

What we need, split into four parts, with a recommendation for each. The short
version: **only the avatar is worth taking from open source.** The rest is either
already built here, or a vendor SDK, or would cost more to bend than to write.

---

## 1. The presentation shell — write it (done)

There is no open-source project that does "narrated, scene-based, avatar-led product
walkthrough with a live Q&A". The nearest things are all wrong in a way that costs
more to fix than to skip:

| Considered | Why not |
|---|---|
| [reveal.js](https://github.com/hakimel/reveal.js) · [Spectacle](https://github.com/FormidableLabs/spectacle) · [Slidev](https://github.com/slidevjs/slidev) | Slide decks. No narration state machine, no interruption model, no Q&A. We would use ~5% of them and fight the routing. |
| [Vercel AI Chatbot](https://github.com/vercel/ai-chatbot) · [assistant-ui](https://github.com/assistant-ui/assistant-ui) | Excellent chat scaffolds — but a chat transcript is the *opposite* shape. The reference is a presenter driving a stage, where chat is the interrupt, not the frame. |
| [Chatbot UI](https://github.com/mckaywrigley/chatbot-ui) | Same. Also a full Supabase/Next stack for what is one text input. |

This repo is that shell. ~1,900 lines, no runtime dependency, builds to one offline
HTML file. That is smaller than the config of any of the above.

---

## 2. The avatar — **take `met4citizen/TalkingHead`** ⭐

**→ https://github.com/met4citizen/TalkingHead — MIT**

This is the one to take, and it is close to a perfect fit.

> **Status: taken, and the avatar is solved.** The library is vendored as an offline
> bundle (`docs/TALKINGHEAD.md` — pins, traps, rig contract) and a licence-clean avatar
> now ships (`docs/AVATAR.md`). **The verdict below stands; the avatar-sourcing
> paragraph did not.** It assumed Ready Player Me, and Ready Player Me no longer exists.
> The corrections are inline and flagged.

- **What it is:** a JavaScript class that renders a full-body 3D avatar in Three.js
  and lip-syncs it in real time.
- **Avatar format:** GLB, **full body**, root object named exactly `Armature`, **52
  specifically-named bones** (including all five finger chains, and `LeftUpLeg`/`Leg`/
  `Foot`/`ToeBase` — a half-body avatar is categorically incompatible), plus `LeftEye`
  and `RightEye`, plus **52 ARKit blend shapes** and **15 Oculus viseme shapes**.
  ~~A free [Ready Player Me](https://readyplayer.me) avatar exports exactly this — which
  means a photoreal-ish presenter is a 10-minute job, not a modelling project.~~
  **Wrong as of 2026.** Ready Player Me **shut down on 2026-01-31** after being acquired
  by Netflix (announced 2025-12-19); all its hostnames now fail to resolve, verified. So
  the free-avatar-in-ten-minutes route is gone, and with it the only documented way to
  license an RPM avatar for commercial use.
  **The replacement is the [VALID](https://github.com/xrtlab/Validated-Avatar-Library-for-Inclusion-and-Diversity---VALID)
  library — MIT, 210 perceptually validated avatars, seven ethnicities, business
  attire included.** It is not a drop-in: a VALID rig meets the bone contract exactly
  and then loads, renders, reports nothing, and never moves, because its 96 morph
  targets are in a Daz/Mimic scheme and its bone frames are not RPM's.
  `tools/convert-valid-avatar.mjs` closes that gap — see `docs/AVATAR.md`.
- **ElevenLabs is already integrated**, via the ElevenLabs **WebSocket** API with
  **word-level timestamps** — which is the whole reason the lip-sync is good rather
  than amplitude-jiggle. Azure Speech, Google TTS, OpenAI, Gemini and Grok are also
  wired in their test app.
- **API:** `showAvatar()`, `speakText(text, opt, onsubtitles)`, `speakAudio(audio, opt)`,
  `setMood()`, `playGesture()`, `playAnimation()` (Mixamo FBX).
- **Install:** npm `@met4citizen/talkinghead`, or an importmap from jsDelivr.
  Backend optional — a proxy is only needed to keep the TTS key off the client,
  which we want anyway.
- **Bonus we should use:** `onsubtitles` gives word-by-word callbacks, so the caption
  in the presenter rail can highlight the word being spoken. `setMood()` and
  `playGesture()` give us a presenter that gestures on emphasis instead of a talking
  head that stares.

### How it drops in

`src/avatar.js` is deliberately isolated behind a four-method interface, so the swap
touches one file and nothing else:

```js
setState('idle' | 'speaking' | 'listening' | 'thinking')
speak(text, durationMs)     // → talkingHead.speakText(text, {}, onsubtitles)
setLevel(rms | null)        // → not needed; TalkingHead has real visemes
stopSpeaking()              // → talkingHead.stopSpeaking()
```

Replace the `<canvas id="avatar">` with a `<div>`, construct `TalkingHead` against it,
and map those four calls. `src/voice.js` hands its audio to `speakAudio()` instead of
an AudioContext. Everything else — scenes, narration loop, film strip, Q&A — is
untouched.

**Cost of the swap:** roughly half a day for the wiring. The avatar is no longer part of
that estimate at all — it is done, licence-clean and committed. See below.

**The one real trade-off:** it needs WebGL and a GLB, so the single-file offline build
gets bigger and needs a GPU. Concretely: 6.56 MiB of avatar, about 9.6 MB once base64'd
into `dist/index.html`. The canvas presenter in this repo stays as the fallback for a
locked-down venue machine — keep both.

### The avatar licensing problem — **resolved**

Of the six example avatars bundled with TalkingHead, **five are non-commercial and
therefore unusable here** — this is a MindGraph × DXC product walkthrough shown to
prospects, and the single-file build hands the asset to the client outright:

| Avatar | Size | Licence | Usable? |
|---|---|---|---|
| `brunette.glb` / `brunette-t.glb` | 4.5 MB | Ready Player Me, **CC BY-NC 4.0** | ✗ non-commercial |
| `avatar.glb` (Avaturn) | 13.8 MB | Avaturn, non-commercial | ✗ |
| `avatarsdk.glb` | 12.3 MB | AvatarSDK, non-commercial | ✗ |
| `vroid.glb` | 2.3 MB | VRoid Studio, non-commercial | ✗ |
| **`mpfb.glb`** | **36.8 MB** | **CC0 — public domain** | ✓ **the only one** |

`mpfb.glb` was committed first, on licence grounds alone, and is now the **fallback of
record** rather than the shipped avatar: a generic MakeHuman figure in a logo t-shirt and
jeans at 35 MiB is not what presents an airport platform to a CFO.

**What ships instead: a VALID avatar** — `Black_F_1_Busi`, **MIT, Copyright (c) 2022
Tiffany Do**, 6.56 MiB, business dress, and joint-highest validated agreement in the
library (0.98 ethnicity / 0.98 gender, n=132 across 33 countries, from VALID's own
published data). Commercial use is unambiguously permitted; the citation VALID asks for
is honoured in `docs/AVATAR.md` alongside the verbatim licence, the source hashes and the
dated provenance record.

**What it cost, since "just use a free avatar" is exactly the assumption that killed the
last plan:** VALID ships FBX, so the glTF conversion comes from `c-frame/valid-avatars-glb`
(MIT, same holder, linked from VALID's own README). Those files are meshopt-compressed,
which the pinned loader cannot decode; carry 96 Daz/Mimic morph targets and none of the
15 visemes or 52 ARKit shapes; have no `Armature` and put their meshes *outside* the
skeleton; and — the one that actually took the time — have Daz bone frames, which
TalkingHead's absolute RPM-authored pose templates twist ninety degrees off camera.
`tools/convert-valid-avatar.mjs` fixes all four deterministically and
`tools/check-avatar-glb.mjs` gates the result. **Budget a day for a new avatar library,
not ten minutes** — and never accept "it loaded" as evidence.

---

### Also evaluated, for the record

| Project | Licence | Verdict |
|---|---|---|
| [Open-LLM-VTuber](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber) | MIT | Genuinely good and fully offline — Live2D avatar, ASR, LLM, TTS, voice interruption, ~7k stars. **Wrong register:** Live2D is an anime aesthetic, and this is going in front of an airport CFO. Also a Python backend for something that should be a static file. Worth stealing *ideas* from — its interruption handling is better than ours. |
| [OpenAvatarChat](https://github.com/HumanAIGC-Engineering/OpenAvatarChat) | Apache-2.0 | Modular real-time digital human (LiteAvatar 2D, LAM 3D gaussian). Highest visual ceiling of the open options. **Needs a GPU box and a Python service** — that is an infrastructure decision, not a UI one. Revisit if we ever want photoreal and control the hosting. |
| [Pipecat](https://github.com/pipecat-ai/pipecat) / [LiveKit Agents](https://github.com/livekit/agents) | BSD / Apache-2.0 | Real-time **conversation** frameworks — full duplex, barge-in, and first-class avatar plugins (Simli, Tavus, Beyond Presence). The right answer *if* the goal changes from "narrated walkthrough with Q&A" to "interrupt it mid-sentence like a phone call". Not needed for this. |
| Wav2Lip / SadTalker / MuseTalk / EchoMimic | mixed, several non-commercial | Offline video generation. Could pre-render the twelve narrations as photoreal video at very high quality — but they cannot answer an unscripted question with the same face, so we would end up with two presenters. **Check the licences carefully** if this is ever revisited; several are research-only. |
| HeyGen / D-ID / Synthesia / Simli / Tavus | commercial | Best-looking by a distance, per-minute pricing, and a hard dependency on their cloud. Rules itself out for an air-gapped venue. Reasonable for a web-only variant. |

---

## 3. The voice — vendor SDK, no repo needed

ElevenLabs directly. `src/voice.js` already implements it: streams MP3, decodes it
through an AudioContext, and feeds real RMS to the avatar. Falls back to the browser's
built-in `speechSynthesis` when there is no key — which is what an air-gapped room runs.

Pick the model deliberately: **`eleven_turbo_v2_5`** for lowest latency (it matters,
because Iris has to answer a live question), or **v3** when expressiveness is worth the
extra delay. When we move to TalkingHead, switch to the **WebSocket** endpoint so we get
word-level timestamps — that is the single biggest upgrade to lip-sync quality available.

Speech *input* uses the browser's own `SpeechRecognition` — free, no dependency. If it
has to work offline, [whisper.cpp](https://github.com/ggerganov/whisper.cpp) with a
small model is the drop-in.

## 4. The brain — no repo needed

`src/ask.js` is ~120 lines: retrieve from the knowledge base, hand the top entries to
the model as grounding, refuse to answer outside it. A RAG framework (LangChain,
LlamaIndex) would be a large dependency for one `fetch` and a scoring function over
38 facts.

**The thing to protect:** the LLM is *grounded*, not authoritative. It may only answer
from `src/knowledge.js`. Adding a key makes Iris more fluent, not more imaginative, and
unanswerable questions stay unanswerable. Do not relax that to make a demo smoother.

**Before this goes anywhere public:** move the key behind a proxy. A key in `config.js`
is a key in the browser, and anyone can read it. `llm.endpoint` exists for exactly this.

---

## Recommendation

1. **Ship the current build as the layout.** It runs offline, on any machine, today.
2. **Swap in TalkingHead + ElevenLabs WebSocket** for the customer-facing version — MIT,
   purpose-built, ~half a day, one file changes. The library is vendored offline
   (`docs/TALKINGHEAD.md`) and the avatar is done: ~~+ a Ready Player Me avatar~~ —
   **that route is gone**, RPM shut down 2026-01-31 — replaced by a **VALID** avatar,
   MIT, licence-clean, business-dressed, 6.56 MiB, with its mouth proven to move
   (`docs/AVATAR.md`). No longer the critical path. The one decision still open is
   *which* of the 210 VALID avatars presents as Iris; that is a client call and it is one
   constant in `tools/convert-valid-avatar.mjs`.
3. **Keep the canvas presenter as the fallback** for venue machines with no GPU.
4. **Put the LLM key behind a proxy** before it is reachable from the internet.
5. Revisit Pipecat / LiveKit only if we decide people should be able to interrupt Iris
   mid-sentence. That is a different product, not a bigger version of this one.
