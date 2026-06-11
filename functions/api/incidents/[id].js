function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestPatch(context) {
  const { resolved } = await context.request.json();
  await context.env.DB.prepare('UPDATE incidents SET resolved = ? WHERE id = ?')
    .bind(resolved ? 1 : 0, context.params.id).run();
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  await context.env.DB.prepare('DELETE FROM incidents WHERE id = ?').bind(context.params.id).run();
  return json({ ok: true });
}
