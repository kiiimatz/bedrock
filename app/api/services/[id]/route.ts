import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAuth, unauthorized } from '@/lib/auth';


export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await checkAuth(request)) return unauthorized();
  const { env } = await getCloudflareContext({ async: true });
  const { id } = await params;
  const body = await request.json() as Record<string, unknown>;
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (body.status    !== undefined) { fields.push('status = ?');     vals.push(body.status); }
  if (body.name      !== undefined) { fields.push('name = ?');       vals.push(String(body.name).trim()); }
  if (body.group     !== undefined) { fields.push('group_name = ?'); vals.push(body.group); }
  if (body.protocols !== undefined) { fields.push('protocols = ?');  vals.push(JSON.stringify(body.protocols)); }
  if (!fields.length) return Response.json({ ok: true });
  const exists = await env.DB.prepare('SELECT id FROM services WHERE id = ?').bind(id).first();
  if (!exists) return Response.json({ error: 'Not found' }, { status: 404 });
  await env.DB.prepare(`UPDATE services SET ${fields.join(', ')} WHERE id = ?`).bind(...vals, id).run();
  return Response.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await checkAuth(request)) return unauthorized();
  const { env } = await getCloudflareContext({ async: true });
  const { id } = await params;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM services WHERE id = ?').bind(id),
    env.DB.prepare('DELETE FROM service_days WHERE service_id = ?').bind(id),
  ]);
  return Response.json({ ok: true });
}
