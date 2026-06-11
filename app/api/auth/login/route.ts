import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createToken, makeSessionCookie } from '@/lib/auth';


export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const windowStart = Math.floor(Date.now() / 1000) - 300;

  const { results } = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM login_attempts WHERE ip = ? AND attempted_at > ?'
  ).bind(ip, windowStart).all();

  if ((results[0] as { count: number }).count >= 5) {
    return Response.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  await env.DB.prepare('INSERT INTO login_attempts (ip) VALUES (?)').bind(ip).run();
  await env.DB.prepare('DELETE FROM login_attempts WHERE attempted_at < ?').bind(windowStart).run();

  const { username, password } = await request.json() as { username: string; password: string };
  if (username !== env.ADMIN_USERNAME || password !== env.ADMIN_PASSWORD) {
    return Response.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = await createToken(username, env.SESSION_SECRET);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': makeSessionCookie(token),
    },
  });
}
