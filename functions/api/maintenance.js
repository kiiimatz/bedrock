function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestGet(context) {
  const { results } = await context.env.DB.prepare(
    'SELECT * FROM maintenance ORDER BY start_at ASC'
  ).all();
  return json(results);
}

export async function onRequestPost(context) {
  const { title, svc, start_at, end_at } = await context.request.json();
  if (!title || !start_at) return json({ error: 'title and start_at required' }, 400);
  const { meta } = await context.env.DB.prepare(
    'INSERT INTO maintenance (title, svc, start_at, end_at) VALUES (?, ?, ?, ?)'
  ).bind(title, svc || 'All services', start_at, end_at || '').run();
  return json({ id: meta.last_row_id }, 201);
}
