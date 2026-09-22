/* POST /api/eleven/stt (multipart: file, model_id) → ElevenLabs speech-to-text, key held here. */
import { gate, passthrough } from '../../_gate.js';

export async function onRequestPost({ request, env }) {
  const denied = gate(request, env); if (denied) return denied;
  if (!env.ELEVEN_KEY) return new Response('voice not configured', { status: 503 });
  const upstream = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': env.ELEVEN_KEY, 'Content-Type': request.headers.get('Content-Type') || 'multipart/form-data' },
    body: request.body,
  });
  return passthrough(upstream);
}
