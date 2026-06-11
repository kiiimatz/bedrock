import { makeSessionCookie } from '@/lib/auth';


export async function POST() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': makeSessionCookie('', 0),
    },
  });
}
