import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function checkAuth(request: Request): Promise<boolean> {
  const { env } = await getCloudflareContext({ async: true });
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.split(';').map((c: string) => c.trim()).find((c: string) => c.startsWith('session='));
  const session = match ? match.slice('session='.length) : undefined;
  if (!session) return false;
  return verifySession(session, env.SESSION_SECRET);
}

async function verifySession(token: string, secret: string): Promise<boolean> {
  try {
    const dot = token.lastIndexOf('.');
    if (dot < 0) return false;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = await hmac(secret, payload);
    if (expected !== sig) return false;
    const { exp } = JSON.parse(atob(payload));
    return Date.now() < exp;
  } catch { return false; }
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

export function makeSessionCookie(token: string, maxAge = 86400) {
  return `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export async function createToken(username: string, secret: string): Promise<string> {
  const payload = btoa(JSON.stringify({ sub: username, exp: Date.now() + 86400000 }));
  const sig = await hmac(secret, payload);
  return `${payload}.${sig}`;
}
