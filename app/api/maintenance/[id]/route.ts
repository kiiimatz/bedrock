import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAuth, unauthorized } from '@/lib/auth';


export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await checkAuth(request)) return unauthorized();
  const { env } = await getCloudflareContext({ async: true });
  const { id } = await params;
  await env.DB.prepare('DELETE FROM maintenance WHERE id = ?').bind(id).run();
  return Response.json({ ok: true });
}
