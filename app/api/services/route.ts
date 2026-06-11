import { getCloudflareContext } from '@opennextjs/cloudflare';
import { checkAuth, unauthorized } from '@/lib/auth';


function utcDay(d: Date) { return d.toISOString().slice(0, 10); }

export async function GET() {
  const { env } = await getCloudflareContext({ async: true });

  const { results: svcs } = await env.DB.prepare(
    `SELECT s.* FROM services s
     LEFT JOIN groups g ON s.group_name = g.name
     ORDER BY COALESCE(g.sort_order, 999999) ASC, s.sort_order ASC, s.name ASC`
  ).all();

  if (!svcs.length) return Response.json([]);

  const today = utcDay(new Date());
  const days: string[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    days.push(utcDay(d));
  }

  const svcIds = svcs.map((s: Record<string, unknown>) => s.id);
  const cutoff = days[0];
  const placeholders = svcIds.map(() => '?').join(',');
  const { results: dayRows } = await env.DB.prepare(
    `SELECT service_id, day, pct, has_down FROM service_days WHERE service_id IN (${placeholders}) AND day >= ?`
  ).bind(...svcIds, cutoff).all();

  const dayMap: Record<string, Record<string, unknown>> = {};
  for (const r of dayRows) {
    const row = r as Record<string, unknown>;
    dayMap[`${row.service_id}:${row.day}`] = row;
  }

  const data = svcs.map((s: Record<string, unknown>) => {
    const createdDay = s.created_at ? utcDay(new Date((s.created_at as number) * 1000)) : today;
    const history = days.map((day: string) => {
      if (day < createdDay) return null;
      if (day === today) {
        const checkCount = (s.check_count as number) || 0;
        const checkUp = (s.check_up as number) || 0;
        const checkDown = (s.check_down as number) || 0;
        const pct = checkCount > 0 ? (checkUp / checkCount) * 100 : 100;
        return { pct, down: checkDown > 0 ? 1 : 0, cls: s.status as string };
      }
      const entry = dayMap[`${s.id}:${day}`];
      if (!entry) return null;
      return { pct: entry.pct as number, down: entry.has_down as number };
    });
    const validDays = history.filter((h) => h !== null);
    const uptime = validDays.length
      ? validDays.reduce((sum, h) => sum + (h!.pct), 0) / validDays.length
      : 100;
    return {
      id: s.id,
      name: s.name,
      group: s.group_name,
      status: s.status,
      protocols: JSON.parse((s.protocols as string) || '[]'),
      history,
      uptime,
    };
  });

  return Response.json(data);
}

export async function POST(request: Request) {
  if (!await checkAuth(request)) return unauthorized();
  const { env } = await getCloudflareContext({ async: true });
  const { name, group, status, protocols } = await request.json() as {
    name: string; group?: string; status?: string; protocols?: unknown[];
  };
  if (!name) return Response.json({ error: 'name required' }, { status: 400 });
  const { meta } = await env.DB.prepare(
    'INSERT INTO services (name, group_name, status, protocols) VALUES (?, ?, ?, ?)'
  ).bind(name, group || '', status || 'up', JSON.stringify(protocols || [])).run();
  return Response.json({ id: (meta as { last_row_id: number }).last_row_id }, { status: 201 });
}
