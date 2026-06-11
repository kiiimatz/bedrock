function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestPatch(context) {
  const id = context.params.id;
  const body = await context.request.json();
  if (body.status) {
    // Append to history, keep last 90
    const row = await context.env.DB.prepare('SELECT history, uptime FROM services WHERE id = ?').bind(id).first();
    if (!row) return json({ error: 'Not found' }, 404);
    const history = JSON.parse(row.history || '[]');
    history.push(body.status);
    if (history.length > 90) history.shift();
    // Recalculate uptime
    const upCount = history.filter(h => h === 'up').length;
    const uptime = (upCount / history.length) * 100;
    await context.env.DB.prepare(
      'UPDATE services SET status = ?, history = ?, uptime = ? WHERE id = ?'
    ).bind(body.status, JSON.stringify(history), uptime, id).run();
  }
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  await context.env.DB.prepare('DELETE FROM services WHERE id = ?').bind(context.params.id).run();
  return json({ ok: true });
}
