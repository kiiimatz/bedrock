import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAuth, unauthorized } from '@/lib/auth';


export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await checkAuth(request)) return unauthorized();
  const { env } = await getCloudflareContext({ async: true });
  const { id } = await params;
  const body = await request.json() as { name?: string };
  if (body.name !== undefined) {
    const name = (body.name || '').trim();
    if (!name) return Response.json({ error: 'name required' }, { status: 400 });
    const old = await env.DB.prepare('SELECT name FROM groups WHERE id = ?').bind(id).first() as { name: string } | null;
    if (!old) return Response.json({ error: 'Not found' }, { status: 404 });
    try {
      await env.DB.batch([
        env.DB.prepare('UPDATE groups SET name = ? WHERE id = ?').bind(name, id),
        env.DB.prepare('UPDATE services SET group_name = ? WHERE group_name = ?').bind(name, old.name),
      ]);
    } catch (e) {
      if (String(e).includes('UNIQUE')) return Response.json({ error: 'Group name already exists' }, { status: 409 });
      throw e;
    }
  }
  return Response.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await checkAuth(request)) return unauthorized();
  const { env } = await getCloudflareContext({ async: true });
  const { id } = await params;
  const url = new URL(request.url);
  const deleteServices = url.searchParams.get('deleteServices') === '1';
  const grp = await env.DB.prepare('SELECT name FROM groups WHERE id = ?').bind(id).first() as { name: string } | null;
  if (!grp) return Response.json({ error: 'Not found' }, { status: 404 });
  if (deleteServices) {
    const { results: toDelete } = await env.DB.prepare(
      'SELECT id FROM services WHERE group_name = ?'
    ).bind(grp.name).all();
    const delStmts = toDelete.flatMap((r: Record<string, unknown>) => {
      const row = r as { id: number };
      return [
        env.DB.prepare('DELETE FROM services WHERE id = ?').bind(row.id),
        env.DB.prepare('DELETE FROM service_days WHERE service_id = ?').bind(row.id),
      ];
    });
    if (delStmts.length) await env.DB.batch(delStmts);
  } else {
    await env.DB.prepare("UPDATE services SET group_name = '' WHERE group_name = ?").bind(grp.name).run();
  }
  await env.DB.prepare('DELETE FROM groups WHERE id = ?').bind(id).run();
  return Response.json({ ok: true });
}
