function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestGet(context) {
  const { results } = await context.env.DB.prepare(
    'SELECT * FROM incidents ORDER BY created_at DESC'
  ).all();
  return json(results);
}

export async function onRequestPost(context) {
  const { title, svc, message } = await context.request.json();
  if (!title) return json({ error: 'title required' }, 400);
  const { meta } = await context.env.DB.prepare(
    'INSERT INTO incidents (title, svc, message) VALUES (?, ?, ?)'
  ).bind(title, svc || 'All services', message || '').run();
  return json({ id: meta.last_row_id }, 201);
}
