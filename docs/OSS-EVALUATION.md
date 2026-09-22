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

- **What it is:** a JavaScript class that renders a full-body 3D avatar in Three.js
  and lip-syncs it in real time.
- **Avatar format:** GLB with a Mixamo-compatible rig (root object named `Armature`),
  **52 ARKit blend shapes** + **15 Oculus viseme shapes**. A free
  [Ready Player Me](https://readyplayer.me) avatar exports exactly this — which means
  a photoreal-ish presenter is a 10-minute job, not a modelling project.
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

**Cost of the swap:** roughly half a day, most of it choosing and rigging the avatar.

**The one real trade-off:** it needs WebGL and a ~5–15 MB GLB, so the single-file
offline build gets meaningfully bigger and needs a GPU. The canvas presenter in this
repo stays as the fallback for a locked-down venue machine — keep both.

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
because AIRIS has to answer a live question), or **v3** when expressiveness is worth the
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
from `src/knowledge.js`. Adding a key makes AIRIS more fluent, not more imaginative, and
unanswerable questions stay unanswerable. Do not relax that to make a demo smoother.

**Before this goes anywhere public:** move the key behind a proxy. A key in `config.js`
is a key in the browser, and anyone can read it. `llm.endpoint` exists for exactly this.

---

## Recommendation

1. **Ship the current build as the layout.** It runs offline, on any machine, today.
2. **Swap in TalkingHead + a Ready Player Me avatar + ElevenLabs WebSocket** for the
   customer-facing version — MIT, purpose-built, ~half a day, one file changes.
3. **Keep the canvas presenter as the fallback** for venue machines with no GPU.
4. **Put the LLM key behind a proxy** before it is reachable from the internet.
5. Revisit Pipecat / LiveKit only if we decide people should be able to interrupt AIRIS
   mid-sentence. That is a different product, not a bigger version of this one.
