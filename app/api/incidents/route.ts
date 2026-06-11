import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAuth, unauthorized } from '@/lib/auth';


export async function GET() {
  const { env } = await getCloudflareContext({ async: true });
  const { results } = await env.DB.prepare(
    'SELECT * FROM incidents ORDER BY created_at DESC'
  ).all();
  return Response.json(results);
}

export async function POST(request: Request) {
  if (!await checkAuth(request)) return unauthorized();
  const { env } = await getCloudflareContext({ async: true });
  const { title, svc, message } = await request.json() as { title: string; svc?: string; message?: string };
  if (!title) return Response.json({ error: 'title required' }, { status: 400 });
  const { meta } = await env.DB.prepare(
    'INSERT INTO incidents (title, svc, message) VALUES (?, ?, ?)'
  ).bind(title, svc || 'All services', message || '').run();
  return Response.json({ id: (meta as { last_row_id: number }).last_row_id }, { status: 201 });
}
