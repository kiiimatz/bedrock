export async function onRequestPost(context) {
  const { request, env } = context;

  // Rate limiting via D1
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const windowStart = Math.floor(Date.now() / 1000) - 300; // 5 min window
  const { results } = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM login_attempts WHERE ip = ? AND attempted_at > ?'
  ).bind(ip, windowStart).all();

  if (results[0].count >= 5) {
    return json({ error: 'Too many attempts. Try again later.' }, 429);
  }

  await env.DB.prepare('INSERT INTO login_attempts (ip) VALUES (?)').bind(ip).run();

  // Clean old attempts
  await env.DB.prepare('DELETE FROM login_attempts WHERE attempted_at < ?')
    .bind(windowStart).run();

  const { username, password } = await request.json();
  if (username !== env.ADMIN_USERNAME || password !== env.ADMIN_PASSWORD) {
    return json({ error: 'Invalid credentials' }, 401);
  }

  const payload = btoa(JSON.stringify({ sub: username, exp: Date.now() + 86400000 }));
  const sig = await hmac(env.SESSION_SECRET, payload);
  const token = `${payload}.${sig}`;

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`
    }
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
