import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAuth, unauthorized } from '@/lib/auth';


export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await checkAuth(request)) return unauthorized();
  const { env } = await getCloudflareContext({ async: true });
  const { id } = await params;
  const { resolved } = await request.json() as { resolved: boolean };
  await env.DB.prepare('UPDATE incidents SET resolved = ? WHERE id = ?').bind(resolved ? 1 : 0, id).run();
  return Response.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await checkAuth(request)) return unauthorized();
  const { env } = await getCloudflareContext({ async: true });
  const { id } = await params;
  await env.DB.prepare('DELETE FROM incidents WHERE id = ?').bind(id).run();
  return Response.json({ ok: true });
}
