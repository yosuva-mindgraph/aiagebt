/* Shared by every proxy route. When AIB_PASSCODE is set on the project, a request
   must carry the same value in X-AIB-Pass, or it gets a 401 and never reaches a
   paid API. Without the secret the proxy is open — fine for a private preview. */
export function gate(request, env) {
  const need = env.AIB_PASSCODE;
  if (!need) return null;
  const got = request.headers.get('X-AIB-Pass') || '';
  if (got === need) return null;
  return new Response(JSON.stringify({ error: 'access code required' }), {
    status: 401, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export function passthrough(upstream, extra = {}) {
  const headers = new Headers({ 'Cache-Control': 'no-store', ...extra });
  const ct = upstream.headers.get('Content-Type'); if (ct) headers.set('Content-Type', ct);
  return new Response(upstream.body, { status: upstream.status, headers });
}
