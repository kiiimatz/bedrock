'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { Service, Group, Incident, MaintenanceWindow } from '@/lib/types';
import dynamic from 'next/dynamic';

const AllServices = dynamic(() => import('@/components/admin/AllServices'), { ssr: false });

// ── SVG icons ──────────────────────────────────────────────────────────────────

function LogoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>
      <line x1="12" y1="7" x2="5" y2="17"/><line x1="12" y1="7" x2="19" y2="17"/><line x1="5" y1="19" x2="19" y2="19"/>
    </svg>
  );
}

function GripIcon() {
  return (
    <svg className="drag-grip" viewBox="0 0 10 16" fill="currentColor" width="10" height="14" aria-hidden="true">
      <circle cx="3" cy="3" r="1.2"/><circle cx="7" cy="3" r="1.2"/>
      <circle cx="3" cy="8" r="1.2"/><circle cx="7" cy="8" r="1.2"/>
      <circle cx="3" cy="13" r="1.2"/><circle cx="7" cy="13" r="1.2"/>
    </svg>
  );
}

// ── Groups section (top GROUPS card) ──────────────────────────────────────────

function GroupsList({ groups, services, onRefresh }: {
  groups: Group[];
  services: Service[];
  onRefresh: () => void;
}) {
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [localGroups, setLocalGroups] = useState(groups);
  const dropRef = useRef<number | null>(null);

  useEffect(() => setLocalGroups(groups), [groups]);

  const cnt: Record<string, number> = {};
  services.forEach(s => { const g = s.group || ''; cnt[g] = (cnt[g] || 0) + 1; });

  async function addGroup() {
    if (!newName.trim()) return;
    await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setNewName('');
    onRefresh();
  }

  async function renameGroup(id: number) {
    if (!editName.trim()) return;
    await fetch(`/api/groups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim() }),
    });
    setEditId(null);
    onRefresh();
  }

  async function deleteGroup(id: number, deleteServices: boolean) {
    await fetch(`/api/groups/${id}?deleteServices=${deleteServices ? 1 : 0}`, { method: 'DELETE' });
    setDeleteId(null);
    onRefresh();
  }

  // Simple HTML5 DnD for groups list (works fine here since no nested elements)
  function handleDragStart(id: number) { setDragId(id); }
  function handleDragOver(e: React.DragEvent, id: number) {
    e.preventDefault();
    dropRef.current = id;
  }
  function handleDrop(e: React.DragEvent, targetId: number) {
    e.preventDefault();
    if (dragId === null || dragId === targetId) return;
    const from = localGroups.findIndex(g => g.id === dragId);
    const to   = localGroups.findIndex(g => g.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...localGroups];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setLocalGroups(next);
    fetch('/api/groups/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: next.map(g => g.id) }),
    }).catch(() => {});
    setDragId(null);
  }

  return (
    <div className="card">
      <div className="card-hd">
        <span className="card-title">Groups</span>
        <span className="card-hint">Drag to reorder · Double-click name to rename</span>
      </div>
      <div className="card-body">
        <div className="row2" style={{ alignItems: 'flex-end' }}>
          <div className="field">
            <label>Group name</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Relays"
              onKeyDown={e => e.key === 'Enter' && addGroup()}
            />
          </div>
          <div className="field align-end">
            <button className="btn btn-ghost w-full" onClick={addGroup}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="13" height="13"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add group
            </button>
          </div>
        </div>
      </div>

      <div className="grp-list">
        {localGroups.length === 0 && <div className="empty">No groups yet. Add one above.</div>}
        {localGroups.map(g => (
          <div key={g.id}>
            <div
              className={`grp-row${dragId === g.id ? ' dragging' : ''}`}
              draggable
              onDragStart={() => handleDragStart(g.id)}
              onDragOver={e => handleDragOver(e, g.id)}
              onDrop={e => handleDrop(e, g.id)}
              onDragEnd={() => setDragId(null)}
            >
              <GripIcon />
              {editId === g.id ? (
                <input
                  className="grp-name-input"
                  value={editName}
                  autoFocus
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') renameGroup(g.id);
                    if (e.key === 'Escape') setEditId(null);
                  }}
                  onBlur={() => renameGroup(g.id)}
                />
              ) : (
                <span
                  className="grp-row-name"
                  onDoubleClick={() => { setEditId(g.id); setEditName(g.name); }}
                >
                  {g.name}
                </span>
              )}
              <span className="grp-row-count">{cnt[g.name] || 0} services</span>
              <button
                className="icon-btn"
                onClick={() => setDeleteId(g.id)}
                title="Delete group"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            </div>
            {deleteId === g.id && (
              <div className="grp-del-confirm">
                <span>Delete "{g.name}"?</span>
                <button className="btn btn-sm btn-ghost" onClick={() => deleteGroup(g.id, false)}>Move services out</button>
                <button className="btn btn-sm btn-danger" onClick={() => deleteGroup(g.id, true)}>Delete services too</button>
                <button className="btn btn-sm btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Add service card ───────────────────────────────────────────────────────────

function AddService({ groups, onAdded }: { groups: Group[]; onAdded: () => void }) {
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [status, setStatus] = useState('up');
  const [proto, setProto] = useState('TCP');
  const [port, setPort] = useState('');
  const [ip, setIp] = useState('');
  const [protos, setProtos] = useState<{ proto: string; ip: string; port: string }[]>([]);

  const needsPort = (p: string) => ['TCP','UDP','QUIC'].includes(p);

  function addProto() {
    if (!ip.trim()) return;
    setProtos(prev => [...prev, { proto, ip: ip.trim(), port: port.trim() }]);
    setIp(''); setPort('');
  }

  async function addService() {
    if (!name.trim()) return;
    await fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        group,
        status,
        protocols: protos.map(p => ({ proto: p.proto, ip: p.ip, ...(p.port ? { port: p.port } : {}) })),
      }),
    });
    setName(''); setGroup(''); setStatus('up'); setProtos([]); setIp(''); setPort('');
    onAdded();
  }

  return (
    <div className="card">
      <div className="card-hd"><span className="card-title">Add service</span></div>
      <div className="card-body">
        <div className="row3">
          <div className="field">
            <label>Service name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Tokyo-A Relay" />
          </div>
          <div className="field">
            <label>Group</label>
            <select value={group} onChange={e => setGroup(e.target.value)}>
              <option value="">— ungrouped —</option>
              {groups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Initial status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}>
              <option value="up">up</option>
              <option value="degraded">degraded</option>
              <option value="down">down</option>
            </select>
          </div>
        </div>
        <div className="section-label" style={{ marginBottom: 8 }}>Protocols / endpoints</div>
        {protos.map((p, i) => (
          <div key={i} className="proto-row">
            <span className="proto-pill">{p.proto}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.ip}{p.port ? `:${p.port}` : ''}</span>
            <span />
            <button className="proto-del" onClick={() => setProtos(prev => prev.filter((_, j) => j !== i))}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        ))}
        <div className="row4">
          <div className="field">
            <label>Protocol</label>
            <select value={proto} onChange={e => setProto(e.target.value)}>
              {['TCP','UDP','HTTP','HTTPS','QUIC'].map(pr => <option key={pr}>{pr}</option>)}
            </select>
          </div>
          {needsPort(proto) && (
            <div className="field"><label>Port</label><input value={port} onChange={e => setPort(e.target.value)} placeholder="3000" /></div>
          )}
          <div className="field"><label>IP / Host / URL</label><input value={ip} onChange={e => setIp(e.target.value)} placeholder="example.com or https://…" /></div>
          <div className="field align-end">
            <button className="btn btn-ghost w-full" onClick={addProto}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="13" height="13"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add
            </button>
          </div>
        </div>
        <div className="flex-end">
          <button className="btn btn-primary" onClick={addService}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>
            Save service
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Incidents tab ──────────────────────────────────────────────────────────────

function IncidentsTab({ services, onRefresh }: { services: Service[]; onRefresh: () => void }) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [title, setTitle] = useState('');
  const [svc, setSvc] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const res = await fetch('/api/incidents');
    if (res.ok) setIncidents(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function postIncident() {
    if (!title.trim()) return;
    await fetch('/api/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), svc: svc || 'All services', message }),
    });
    setTitle(''); setSvc(''); setMessage('');
    load();
  }

  async function resolve(id: number) {
    await fetch(`/api/incidents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved: true }),
    });
    load();
  }

  async function deleteInc(id: number) {
    await fetch(`/api/incidents/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <>
      <div className="card">
        <div className="card-hd"><span className="card-title">Post incident</span></div>
        <div className="card-body">
          <div className="row2">
            <div className="field"><label>Title</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Elevated latency on Tokyo-A" /></div>
            <div className="field">
              <label>Affected service</label>
              <select value={svc} onChange={e => setSvc(e.target.value)}>
                <option value="">All services</option>
                {services.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="field mb8"><label>Message</label><textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="We are investigating…" /></div>
          <div className="flex-end">
            <button className="btn btn-primary" onClick={postIncident}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="13" height="13"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              Post
            </button>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-hd"><span className="card-title">Active &amp; recent</span></div>
        <div className="adm-list">
          {incidents.length === 0 && <div className="empty">No incidents.</div>}
          {incidents.map(inc => (
            <div key={inc.id} className="adm-row">
              <div className="adm-row-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="adm-row-title">{inc.title}</span>
                  {inc.resolved ? <span className="resolved-badge">Resolved</span> : <span className="active-badge">Active</span>}
                </div>
                <div className="adm-row-meta">{inc.svc} · {new Date(inc.created_at * 1000).toLocaleString()}</div>
                {inc.message && <div className="adm-row-msg">{inc.message}</div>}
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {!inc.resolved && (
                  <button className="btn btn-sm btn-ghost" onClick={() => resolve(inc.id)}>Resolve</button>
                )}
                <button className="icon-btn" onClick={() => deleteInc(inc.id)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Maintenance tab ────────────────────────────────────────────────────────────

function MaintenanceTab({ services }: { services: Service[] }) {
  const [windows, setWindows] = useState<MaintenanceWindow[]>([]);
  const [title, setTitle] = useState('');
  const [svc, setSvc] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');

  async function load() {
    const res = await fetch('/api/maintenance');
    if (res.ok) setWindows(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function addMaint() {
    if (!title.trim() || !startAt) return;
    await fetch('/api/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), svc: svc || 'All services', start_at: startAt, end_at: endAt }),
    });
    setTitle(''); setSvc(''); setStartAt(''); setEndAt('');
    load();
  }

  async function deleteMaint(id: number) {
    await fetch(`/api/maintenance/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <>
      <div className="card">
        <div className="card-hd"><span className="card-title">Schedule maintenance</span></div>
        <div className="card-body">
          <div className="row2">
            <div className="field"><label>Title</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="TLS certificate renewal" /></div>
            <div className="field">
              <label>Affected service</label>
              <select value={svc} onChange={e => setSvc(e.target.value)}>
                <option value="">All services</option>
                {services.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="row2">
            <div className="field"><label>Start</label><input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} /></div>
            <div className="field"><label>End</label><input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} /></div>
          </div>
          <div className="flex-end">
            <button className="btn btn-primary" onClick={addMaint}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="13" height="13"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg>
              Schedule
            </button>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-hd"><span className="card-title">Upcoming</span></div>
        <div className="adm-list">
          {windows.length === 0 && <div className="empty">No maintenance scheduled.</div>}
          {windows.map(w => (
            <div key={w.id} className="adm-row">
              <div className="adm-row-info">
                <div className="adm-row-title">{w.title}</div>
                <div className="adm-row-meta">{w.svc} · {w.start_at}{w.end_at ? ` → ${w.end_at}` : ''}</div>
              </div>
              <button className="icon-btn" onClick={() => deleteMaint(w.id)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Login screen ───────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function doLogin() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        onLogin();
      } else {
        const data = await res.json() as { error?: string };
        setError(data.error || 'Incorrect username or password.');
        setTimeout(() => setError(''), 3000);
      }
    } catch {
      setError('Network error.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="view-login">
      <div className="login-card">
        <div className="login-logo">
          <span className="logo-text">bedrock <span className="logo-sub">/ admin</span></span>
        </div>
        <p className="login-sub">Sign in to manage services, incidents, and maintenance.</p>
        {error && <div className="login-err visible">{error}</div>}
        <div className="field"><label htmlFor="loginUser">Username</label>
          <input id="loginUser" type="text" value={username} autoComplete="username" onChange={e => setUsername(e.target.value)} />
        </div>
        <div className="field"><label htmlFor="loginPass">Password</label>
          <input id="loginPass" type="password" value={password} placeholder="••••••••" autoComplete="current-password"
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doLogin()}
          />
        </div>
        <div className="login-footer">
          <a href="/" className="btn btn-ghost btn-icon" aria-label="Back to status page">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
          </a>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={doLogin} disabled={loading}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Admin dashboard ────────────────────────────────────────────────────────────

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<'svc' | 'inc' | 'mt'>('svc');
  const [services, setServices] = useState<Service[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return document.documentElement.classList.contains('light') ? 'light' : 'dark';
  });

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (next === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    try { localStorage.setItem('theme', next); } catch {}
  }
  const [groups, setGroups] = useState<Group[]>([]);

  const load = useCallback(async () => {
    try {
      const [svcRes, grpRes] = await Promise.all([
        fetch('/api/services'),
        fetch('/api/groups'),
      ]);
      if (svcRes.status === 401) { onLogout(); return; }
      setServices(svcRes.ok ? await svcRes.json() : []);
      setGroups(grpRes.ok ? await grpRes.json() : []);
    } catch { /* ignore */ }
  }, [onLogout]);

  useEffect(() => { load(); }, [load]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    onLogout();
  }

  return (
    <div className="admin-wrap">
      <div className="admin-page">
        <header className="admin-header">
          <div className="admin-logo">
            <span className="logo-text">bedrock</span>
            <span className="admin-badge">admin</span>
          </div>
          <div className="admin-actions">
            <button className="btn btn-ghost btn-sm btn-icon" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              {theme === 'dark' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              )}
            </button>
            <a href="/" className="btn btn-ghost btn-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="13" height="13"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              Status page
            </a>
            <button className="btn btn-ghost btn-sm" onClick={logout}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="13" height="13"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sign out
            </button>
          </div>
        </header>

        <nav className="nav" role="tablist">
          {([
            ['svc', 'Services', <><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></>],
            ['inc', 'Incidents', <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>],
            ['mt', 'Maintenance', <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>],
          ] as [string, string, React.ReactNode][]).map(([id, label, icon]) => (
            <button
              key={id}
              className={`nav-btn${tab === id ? ' active' : ''}`}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id as typeof tab)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13" aria-hidden="true">{icon}</svg>
              {label}
            </button>
          ))}
        </nav>

        {tab === 'svc' && (
          <div className="tab active">
            <GroupsList groups={groups} services={services} onRefresh={load} />
            <AddService groups={groups} onAdded={load} />
            <div className="card">
              <div className="card-hd">
                <span className="card-title">All services</span>
                <span className="card-hint">Drag services between groups · Drag group header to reorder</span>
              </div>
              <AllServices initialServices={services} initialGroups={groups} onRefresh={load} />
            </div>
          </div>
        )}
        {tab === 'inc' && (
          <div className="tab active">
            <IncidentsTab services={services} onRefresh={load} />
          </div>
        )}
        {tab === 'mt' && (
          <div className="tab active">
            <MaintenanceTab services={services} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page root ──────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  const handleLogin  = useCallback(() => setAuthed(true),  []);
  const handleLogout = useCallback(() => setAuthed(false), []);

  useEffect(() => {
    // GET /api/groups is auth-protected: 200 = authed, 401 = not authed
    fetch('/api/groups')
      .then(res => setAuthed(res.status !== 401))
      .catch(() => setAuthed(true));
  }, []);

  if (authed === null) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Loading…</div>;
  }

  if (!authed) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <AdminDashboard onLogout={handleLogout} />;
}
