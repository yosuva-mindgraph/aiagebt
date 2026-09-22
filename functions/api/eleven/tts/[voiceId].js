/* POST /api/eleven/tts/:voiceId?output_format=… → ElevenLabs text-to-speech, key held here. */
import { gate, passthrough } from '../../../_gate.js';

export async function onRequestPost({ request, env, params }) {
  const denied = gate(request, env); if (denied) return denied;
  if (!env.ELEVEN_KEY) return new Response('voice not configured', { status: 503 });
  const q = new URL(request.url).search;
  const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(params.voiceId)}${q}`, {
    method: 'POST',
    headers: { 'xi-api-key': env.ELEVEN_KEY, 'Content-Type': 'application/json' },
    body: await request.text(),
  });
  return passthrough(upstream);
}
