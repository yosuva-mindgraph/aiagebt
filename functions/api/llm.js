/* POST /api/llm → the Azure OpenAI (or OpenAI) chat-completions route, key held here.
   Secrets: AZURE_ENDPOINT (base URL, e.g. https://…/openai/v1), AZURE_KEY. */
import { gate, passthrough } from '../_gate.js';

export async function onRequestPost({ request, env }) {
  const denied = gate(request, env); if (denied) return denied;
  if (!env.AZURE_KEY || !env.AZURE_ENDPOINT) return new Response(JSON.stringify({ error: 'LLM not configured' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  const base = String(env.AZURE_ENDPOINT).replace(/\/+$/, '');
  const url = /\/chat\/completions$/.test(base) ? base : `${base}/chat/completions`;
  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.AZURE_KEY}`, 'api-key': env.AZURE_KEY },
    body: await request.text(),
  });
  return passthrough(upstream);
}
