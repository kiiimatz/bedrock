import { connect } from 'cloudflare:sockets';

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runChecks(env));
  }
};

async function runChecks(env) {
  try {
    const today  = utcDay(new Date());
    const cutoff = cutoffDay();

    const { results } = await env.DB.prepare(
      `SELECT id, name, protocols, status, check_day, check_count, check_up, check_down FROM services`
    ).all();

    if (!results.length) { console.log('[checker] no services'); return; }
    console.log(`[checker] checking ${results.length} services`);

    const outcomes = await Promise.allSettled(results.map(svc => checkOne(svc)));

    const stmts = [];
    const now   = Math.floor(Date.now() / 1000);

    for (let i = 0; i < results.length; i++) {
      const svc     = results[i];
      const outcome = outcomes[i];

      if (outcome.status === 'rejected') {
        console.error(`[checker] ${svc.name}: unexpected throw —`, outcome.reason);
        continue;
      }

      const newStatus = outcome.value;
      if (newStatus === null) continue; // no checkable protocols

      console.log(`[checker] ${svc.name}: ${svc.status} → ${newStatus}`);

      let { check_day, check_count, check_up, check_down } = svc;

      if (check_day && check_day !== today && check_count > 0) {
        const pct      = (check_up / check_count) * 100;
        const has_down = check_down > 0 ? 1 : 0;
        stmts.push(
          env.DB.prepare(
            'INSERT OR REPLACE INTO service_days (service_id, day, pct, has_down) VALUES (?, ?, ?, ?)'
          ).bind(svc.id, check_day, pct, has_down),
          env.DB.prepare(
            'DELETE FROM service_days WHERE service_id = ? AND day < ?'
          ).bind(svc.id, cutoff)
        );
        check_count = 0; check_up = 0; check_down = 0;
      }

      check_count += 1;
      if (newStatus === 'up')   check_up   += 1;
      if (newStatus === 'down') check_down += 1;

      stmts.push(
        env.DB.prepare(
          `UPDATE services
           SET status = ?, last_checked_at = ?,
               check_day = ?, check_count = ?, check_up = ?, check_down = ?
           WHERE id = ?`
        ).bind(newStatus, now, today, check_count, check_up, check_down, svc.id)
      );
    }

    if (stmts.length) await env.DB.batch(stmts);
    console.log('[checker] done');
  } catch (e) {
    console.error('[checker] fatal:', e);
  }
}

// Returns 'up' | 'degraded' | 'down' | null
async function checkOne(svc) {
  const protocols = JSON.parse(svc.protocols || '[]');
  const checkable = protocols.filter(
    p => p.proto === 'HTTP' || p.proto === 'HTTPS' || p.proto === 'TCP'
  );
  if (!checkable.length) return null;

  let best = 'down';
  for (const p of checkable) {
    const r = await checkProtocol(svc.name, p);
    if (r === 'up')       { best = 'up'; break; }
    if (r === 'degraded') { best = 'degraded'; }
  }
  return best;
}

// Returns 'up' | 'degraded' | 'down'. Tries twice before giving up.
async function checkProtocol(name, p) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (p.proto === 'TCP') {
        const sock  = connect({ hostname: p.ip, port: Number(p.port) });
        const timer = new Promise((_, rej) => setTimeout(() => rej(new Error('tcp timeout')), 8000));
        try {
          await Promise.race([sock.opened, timer]);
          console.log(`[checker] ${name} TCP ${p.ip}:${p.port} up (attempt ${attempt})`);
          return 'up';
        } finally {
          sock.close().catch(() => {});
        }
      } else {
        const scheme = p.proto.toLowerCase();
        const port   = p.port ? `:${p.port}` : '';
        const target = /^https?:\/\//i.test(p.ip) ? p.ip : `${scheme}://${p.ip}${port}`;

        const ctrl  = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        let r;
        try {
          r = await fetch(target, {
            signal:   ctrl.signal,
            redirect: 'follow',
            headers:  { 'User-Agent': 'Mozilla/5.0 (compatible; UptimeRobot/2.0)' },
          });
        } finally {
          clearTimeout(timer);
        }

        console.log(`[checker] ${name} ${p.proto} ${target} → ${r.status} (attempt ${attempt})`);

        // 2xx → up, 3xx shouldn't appear with redirect:follow but treat as up anyway
        if (r.status >= 200 && r.status < 400) return 'up';
        // 4xx → degraded (server alive, URL/auth issue)
        if (r.status >= 400 && r.status < 500) return 'degraded';
        // 5xx → down (server error)
        console.warn(`[checker] ${name} got ${r.status}, marking down`);
        return 'down';
      }
    } catch (err) {
      console.warn(`[checker] ${name} ${p.proto} attempt ${attempt} error: ${err.message}`);
      if (attempt < 2) await new Promise(res => setTimeout(res, 2000));
    }
  }
  return 'down';
}

function utcDay(d) { return d.toISOString().slice(0, 10); }

function cutoffDay() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 90);
  return utcDay(d);
}
