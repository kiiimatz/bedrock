export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);

  // Only protect /api/* except /api/auth/login and /api/auth/logout
  const isProtectedApi = url.pathname.startsWith('/api/') &&
    !url.pathname.startsWith('/api/auth/');

  if (isProtectedApi) {
    const cookie = request.headers.get('Cookie') || '';
    const session = cookie.split(';').map(c => c.trim())
      .find(c => c.startsWith('session='))?.split('=')[1];

    if (!session || !await verifySession(session, env.SESSION_SECRET)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return next();
}

async function verifySession(token, secret) {
  try {
    const [payload, sig] = token.split('.');
    const expected = await hmac(secret, payload);
    return expected === sig;
  } catch { return false; }
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
