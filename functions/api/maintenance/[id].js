function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestDelete(context) {
  await context.env.DB.prepare('DELETE FROM maintenance WHERE id = ?').bind(context.params.id).run();
  return json({ ok: true });
}
