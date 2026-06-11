import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAuth, unauthorized } from '@/lib/auth';


export async function POST(request: Request) {
  if (!await checkAuth(request)) return unauthorized();
  const { env } = await getCloudflareContext({ async: true });
  const { ids } = await request.json() as { ids: number[] };
  if (!Array.isArray(ids) || !ids.length) return Response.json({ error: 'ids required' }, { status: 400 });
  await env.DB.batch(ids.map((id, i) =>
    env.DB.prepare('UPDATE services SET sort_order = ? WHERE id = ?').bind(i, id)
  ));
  return Response.json({ ok: true });
}
