function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestGet(context) {
  const { results } = await context.env.DB.prepare(
    'SELECT * FROM services ORDER BY group_name, name'
  ).all();
  return json(results.map(s => ({
    ...s,
    group: s.group_name,
    protocols: JSON.parse(s.protocols || '[]'),
    history:   JSON.parse(s.history   || '[]'),
  })));
}

export async function onRequestPost(context) {
  const { name, group, status, protocols } = await context.request.json();
  if (!name) return json({ error: 'name required' }, 400);
  const history = JSON.stringify(Array(90).fill('up'));
  const { meta } = await context.env.DB.prepare(
    'INSERT INTO services (name, group_name, status, protocols, history) VALUES (?, ?, ?, ?, ?)'
  ).bind(name, group || '', status || 'up', JSON.stringify(protocols || []), history).run();
  return json({ id: meta.last_row_id }, 201);
}
