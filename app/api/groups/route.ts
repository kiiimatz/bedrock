import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAuth, unauthorized } from '@/lib/auth';


export async function GET() {
  const { env } = await getCloudflareContext({ async: true });
  const { results } = await env.DB.prepare(
    'SELECT * FROM groups ORDER BY sort_order ASC, name ASC'
  ).all();
  return Response.json(results);
}

export async function POST(request: Request) {
  if (!await checkAuth(request)) return unauthorized();
  const { env } = await getCloudflareContext({ async: true });
  const { name } = await request.json() as { name: string };
  if (!name || !name.trim()) return Response.json({ error: 'name required' }, { status: 400 });
  try {
    const { meta } = await env.DB.prepare('INSERT INTO groups (name) VALUES (?)').bind(name.trim()).run();
    return Response.json({ id: (meta as { last_row_id: number }).last_row_id }, { status: 201 });
  } catch (e) {
    if (String(e).includes('UNIQUE')) return Response.json({ error: 'Group already exists' }, { status: 409 });
    throw e;
  }
}
