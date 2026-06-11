// bedrock _worker.js — Cloudflare Pages Advanced Mode

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (path.startsWith('/api/')) {
      // ── Unprotected auth endpoints ───────────────────────────────────────────
      if (path === '/api/auth/login'  && method === 'POST') return handleLogin(request, env);
      if (path === '/api/auth/logout' && method === 'POST') return handleLogout();

      // ── Public read-only endpoints ────────────────────────────────────────────
      if (path === '/api/groups'      && method === 'GET') return getGroups(env);
      if (path === '/api/incidents'   && method === 'GET') return getIncidents(env);
      if (path === '/api/maintenance' && method === 'GET') return getMaintenance(env);
      if (path === '/api/services'    && method === 'GET') return getServices(env);

      // ── Protected endpoints — check session ──────────────────────────────────
      const authed = await checkAuth(request, env);
      if (!authed) return json({ error: 'Unauthorized' }, 401);

      // Debug: test what the checker actually sees for a given URL (admin only)
      if (path === '/api/debug/check' && method === 'GET') return debugCheck(url, env);

      // Services (write)
      if (path === '/api/services' && method === 'POST') return createService(request, env);
      const svcMatch = path.match(/^\/api\/services\/(\d+)$/);
      if (svcMatch) {
        const id = svcMatch[1];
        if (method === 'PATCH')  return updateService(id, request, env);
        if (method === 'DELETE') return deleteService(id, env);
      }

      // Groups (write)
      if (path === '/api/groups' && method === 'POST') return createGroup(request, env);
      if (path === '/api/groups/reorder'   && method === 'POST') return reorderGroups(request, env);
      if (path === '/api/services/reorder' && method === 'POST') return reorderServices(request, env);
      const grpMatch = path.match(/^\/api\/groups\/(\d+)$/);
      if (grpMatch) {
        const id = grpMatch[1];
        if (method === 'PATCH')  return updateGroup(id, request, env);
        if (method === 'DELETE') return deleteGroup(id, request, env);
      }

      // Incidents (write)
      if (path === '/api/incidents' && method === 'POST') return createIncident(request, env);
      const incMatch = path.match(/^\/api\/incidents\/(\d+)$/);
      if (incMatch) {
        const id = incMatch[1];
        if (method === 'PATCH')  return updateIncident(id, request, env);
        if (method === 'DELETE') return deleteIncident(id, env);
      }

      // Maintenance (write)
      if (path === '/api/maintenance' && method === 'POST') return createMaintenance(request, env);
      const mtMatch = path.match(/^\/api\/maintenance\/(\d+)$/);
      if (mtMatch) {
        const id = mtMatch[1];
        if (method === 'DELETE') return deleteMaintenance(id, env);
      }

      return json({ error: 'Not found' }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};

// ── Auth ──────────────────────────────────────────────────────────────────────

async function checkAuth(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match  = cookie.split(';').map(c => c.trim()).find(c => c.startsWith('session='));
  const session = match ? match.slice('session='.length) : undefined;
  if (!session) return false;
  return verifySession(session, env.SESSION_SECRET);
}

async function handleLogin(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const windowStart = Math.floor(Date.now() / 1000) - 300;

  const { results } = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM login_attempts WHERE ip = ? AND attempted_at > ?'
  ).bind(ip, windowStart).all();

  if (results[0].count >= 5) return json({ error: 'Too many attempts. Try again later.' }, 429);

  await env.DB.prepare('INSERT INTO login_attempts (ip) VALUES (?)').bind(ip).run();
  await env.DB.prepare('DELETE FROM login_attempts WHERE attempted_at < ?').bind(windowStart).run();

  const { username, password } = await request.json();
  if (username !== env.ADMIN_USERNAME || password !== env.ADMIN_PASSWORD) {
    return json({ error: 'Invalid credentials' }, 401);
  }

  const payload = btoa(JSON.stringify({ sub: username, exp: Date.now() + 86400000 }));
  const sig = await hmac(env.SESSION_SECRET, payload);
  const token = `${payload}.${sig}`;

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`
    }
  });
}

function handleLogout() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'
    }
  });
}

// ── Groups ────────────────────────────────────────────────────────────────────

async function getGroups(env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM groups ORDER BY sort_order ASC, name ASC'
  ).all();
  return json(results);
}

async function createGroup(request, env) {
  const { name } = await request.json();
  if (!name || !name.trim()) return json({ error: 'name required' }, 400);
  try {
    const { meta } = await env.DB.prepare('INSERT INTO groups (name) VALUES (?)').bind(name.trim()).run();
    return json({ id: meta.last_row_id }, 201);
  } catch (e) {
    if (String(e).includes('UNIQUE')) return json({ error: 'Group already exists' }, 409);
    throw e;
  }
}

async function updateGroup(id, request, env) {
  const body = await request.json();
  if (body.name !== undefined) {
    const name = (body.name || '').trim();
    if (!name) return json({ error: 'name required' }, 400);
    const old = await env.DB.prepare('SELECT name FROM groups WHERE id = ?').bind(id).first();
    if (!old) return json({ error: 'Not found' }, 404);
    try {
      await env.DB.batch([
        env.DB.prepare('UPDATE groups SET name = ? WHERE id = ?').bind(name, id),
        env.DB.prepare('UPDATE services SET group_name = ? WHERE group_name = ?').bind(name, old.name),
      ]);
    } catch (e) {
      if (String(e).includes('UNIQUE')) return json({ error: 'Group name already exists' }, 409);
      throw e;
    }
  }
  return json({ ok: true });
}

async function reorderGroups(request, env) {
  const { ids } = await request.json();
  if (!Array.isArray(ids) || !ids.length) return json({ error: 'ids required' }, 400);
  await env.DB.batch(ids.map((id, i) =>
    env.DB.prepare('UPDATE groups SET sort_order = ? WHERE id = ?').bind(i, id)
  ));
  return json({ ok: true });
}

async function reorderServices(request, env) {
  const { ids } = await request.json();
  if (!Array.isArray(ids) || !ids.length) return json({ error: 'ids required' }, 400);
  await env.DB.batch(ids.map((id, i) =>
    env.DB.prepare('UPDATE services SET sort_order = ? WHERE id = ?').bind(i, id)
  ));
  return json({ ok: true });
}

async function deleteGroup(id, request, env) {
  const url = new URL(request.url);
  const deleteServices = url.searchParams.get('deleteServices') === '1';

  const grp = await env.DB.prepare('SELECT name FROM groups WHERE id = ?').bind(id).first();
  if (!grp) return json({ error: 'Not found' }, 404);

  if (deleteServices) {
    const { results: toDelete } = await env.DB.prepare(
      'SELECT id FROM services WHERE group_name = ?'
    ).bind(grp.name).all();
    const delStmts = toDelete.flatMap(r => [
      env.DB.prepare('DELETE FROM services WHERE id = ?').bind(r.id),
      env.DB.prepare('DELETE FROM service_days WHERE service_id = ?').bind(r.id),
    ]);
    if (delStmts.length) await env.DB.batch(delStmts);
  } else {
    await env.DB.prepare("UPDATE services SET group_name = '' WHERE group_name = ?").bind(grp.name).run();
  }
  await env.DB.prepare('DELETE FROM groups WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

// ── Services ──────────────────────────────────────────────────────────────────

async function getServices(env) {
  const { results: svcs } = await env.DB.prepare(
    `SELECT s.* FROM services s
     LEFT JOIN groups g ON s.group_name = g.name
     ORDER BY COALESCE(g.sort_order, 999999) ASC, s.sort_order ASC, s.name ASC`
  ).all();

  if (!svcs.length) return json([]);

  // Build 90-day date array (UTC), index 0 = 89 days ago, index 89 = today
  const today = utcDay(new Date());
  const days = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    days.push(utcDay(d));
  }

  // Fetch committed daily records for all services
  const svcIds = svcs.map(s => s.id);
  const cutoff = days[0];
  const placeholders = svcIds.map(() => '?').join(',');
  const { results: dayRows } = await env.DB.prepare(
    `SELECT service_id, day, pct, has_down FROM service_days
     WHERE service_id IN (${placeholders}) AND day >= ?`
  ).bind(...svcIds, cutoff).all();

  const dayMap = {};
  for (const r of dayRows) {
    dayMap[`${r.service_id}:${r.day}`] = r;
  }

  return json(svcs.map(s => {
    // Determine when this service was created (UTC date string)
    const createdDay = s.created_at ? utcDay(new Date(s.created_at * 1000)) : today;

    const history = days.map(day => {
      if (day < createdDay) return null; // service didn't exist yet

      if (day === today) {
        // Today: show current live status (not a daily average yet)
        const pct = s.check_count > 0 ? (s.check_up / s.check_count) * 100 : 100;
        return { pct, down: s.check_down > 0 ? 1 : 0, cls: s.status };
      }

      const entry = dayMap[`${s.id}:${day}`];
      if (!entry) return null;
      return { pct: entry.pct, down: entry.has_down };
    });

    const validDays = history.filter(h => h !== null);
    const uptime = validDays.length
      ? validDays.reduce((sum, h) => sum + h.pct, 0) / validDays.length
      : 100;

    return {
      id:        s.id,
      name:      s.name,
      group:     s.group_name,
      status:    s.status,
      protocols: JSON.parse(s.protocols || '[]'),
      history,
      uptime,
    };
  }));
}

async function createService(request, env) {
  const { name, group, status, protocols } = await request.json();
  if (!name) return json({ error: 'name required' }, 400);
  const { meta } = await env.DB.prepare(
    'INSERT INTO services (name, group_name, status, protocols) VALUES (?, ?, ?, ?)'
  ).bind(name, group || '', status || 'up', JSON.stringify(protocols || [])).run();
  return json({ id: meta.last_row_id }, 201);
}

async function updateService(id, request, env) {
  const body = await request.json();
  const fields = [], vals = [];
  if (body.status    !== undefined) { fields.push('status = ?');     vals.push(body.status); }
  if (body.name      !== undefined) { fields.push('name = ?');       vals.push(String(body.name).trim()); }
  if (body.group     !== undefined) { fields.push('group_name = ?'); vals.push(body.group); }
  if (body.protocols !== undefined) { fields.push('protocols = ?');  vals.push(JSON.stringify(body.protocols)); }
  if (!fields.length) return json({ ok: true });
  const exists = await env.DB.prepare('SELECT id FROM services WHERE id = ?').bind(id).first();
  if (!exists) return json({ error: 'Not found' }, 404);
  await env.DB.prepare(`UPDATE services SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...vals, id).run();
  return json({ ok: true });
}

async function deleteService(id, env) {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM services WHERE id = ?').bind(id),
    env.DB.prepare('DELETE FROM service_days WHERE service_id = ?').bind(id),
  ]);
  return json({ ok: true });
}

// ── Incidents ─────────────────────────────────────────────────────────────────

async function getIncidents(env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM incidents ORDER BY created_at DESC'
  ).all();
  return json(results);
}

async function createIncident(request, env) {
  const { title, svc, message } = await request.json();
  if (!title) return json({ error: 'title required' }, 400);
  const { meta } = await env.DB.prepare(
    'INSERT INTO incidents (title, svc, message) VALUES (?, ?, ?)'
  ).bind(title, svc || 'All services', message || '').run();
  return json({ id: meta.last_row_id }, 201);
}

async function updateIncident(id, request, env) {
  const { resolved } = await request.json();
  await env.DB.prepare('UPDATE incidents SET resolved = ? WHERE id = ?')
    .bind(resolved ? 1 : 0, id).run();
  return json({ ok: true });
}

async function deleteIncident(id, env) {
  await env.DB.prepare('DELETE FROM incidents WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

// ── Maintenance ───────────────────────────────────────────────────────────────

async function getMaintenance(env) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM maintenance ORDER BY start_at ASC'
  ).all();
  return json(results);
}

async function createMaintenance(request, env) {
  const { title, svc, start_at, end_at } = await request.json();
  if (!title || !start_at) return json({ error: 'title and start_at required' }, 400);
  const { meta } = await env.DB.prepare(
    'INSERT INTO maintenance (title, svc, start_at, end_at) VALUES (?, ?, ?, ?)'
  ).bind(title, svc || 'All services', start_at, end_at || '').run();
  return json({ id: meta.last_row_id }, 201);
}

async function deleteMaintenance(id, env) {
  await env.DB.prepare('DELETE FROM maintenance WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function utcDay(d) {
  return d.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function cutoffDay() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 90);
  return utcDay(d);
}

// ── Debug ─────────────────────────────────────────────────────────────────────

async function debugCheck(url, env) {
  const proto = (url.searchParams.get('proto') || 'http').toUpperCase();
  const timestamp = new Date().toISOString();

  // TCP / UDP
  if (proto === 'TCP' || proto === 'UDP') {
    const host = url.searchParams.get('host');
    const port = Number(url.searchParams.get('port'));
    if (!host || !port) return json({ error: 'host and port required for TCP/UDP' }, 400);

    const result = { proto, host, port, timestamp };
    try {
      const { connect } = await import('cloudflare:sockets');
      const sock = connect(
        { hostname: host, port },
        proto === 'UDP' ? { type: 'udp' } : {}
      );
      const timer = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout after 10s')), 10000));
      const t0 = Date.now();
      try {
        await Promise.race([sock.opened, timer]);
        result.ok      = true;
        result.latencyMs = Date.now() - t0;
      } finally {
        sock.close().catch(() => {});
      }
    } catch (e) {
      result.ok    = false;
      result.error = e.message;
      result.type  = e.constructor?.name;
    }
    return json(result);
  }

  // HTTP / HTTPS
  const target = url.searchParams.get('url');
  if (!target) return json({ error: 'url param required for HTTP/HTTPS, or proto=tcp&host=...&port=...' }, 400);

  const result = { proto, url: target, timestamp };
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const t0 = Date.now();
    const r  = await fetch(target, {
      signal:   ctrl.signal,
      redirect: 'follow',
      headers:  { 'User-Agent': 'Mozilla/5.0 (compatible; UptimeRobot/2.0)' },
    });
    clearTimeout(timer);
    const body = await r.text().catch(() => '');
    result.ok          = true;
    result.latencyMs   = Date.now() - t0;
    result.status      = r.status;
    result.statusText  = r.statusText;
    result.finalUrl    = r.url;
    result.bodySnippet = body.slice(0, 300);
    result.headers     = Object.fromEntries(
      ['content-type', 'server', 'cf-ray', 'x-powered-by'].map(k => [k, r.headers.get(k)])
    );
  } catch (e) {
    clearTimeout(timer);
    result.ok    = false;
    result.error = e.message;
    result.type  = e.constructor?.name;
  }
  return json(result);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function verifySession(token, secret) {
  try {
    const dot = token.lastIndexOf('.');
    if (dot < 0) return false;
    const payload  = token.slice(0, dot);
    const sig      = token.slice(dot + 1);
    const expected = await hmac(secret, payload);
    if (expected !== sig) return false;
    const { exp } = JSON.parse(atob(payload));
    return Date.now() < exp;
  } catch { return false; }
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
