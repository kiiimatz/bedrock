import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAuth, unauthorized } from '@/lib/auth';


export async function GET() {
  const { env } = await getCloudflareContext({ async: true });
  const { results } = await env.DB.prepare(
    'SELECT * FROM maintenance ORDER BY start_at ASC'
  ).all();
  return Response.json(results);
}

export async function POST(request: Request) {
  if (!await checkAuth(request)) return unauthorized();
  const { env } = await getCloudflareContext({ async: true });
  const { title, svc, start_at, end_at } = await request.json() as {
    title: string; svc?: string; start_at: string; end_at?: string;
  };
  if (!title || !start_at) return Response.json({ error: 'title and start_at required' }, { status: 400 });
  const { meta } = await env.DB.prepare(
    'INSERT INTO maintenance (title, svc, start_at, end_at) VALUES (?, ?, ?, ?)'
  ).bind(title, svc || 'All services', start_at, end_at || '').run();
  return Response.json({ id: (meta as { last_row_id: number }).last_row_id }, { status: 201 });
}
