'use client';
import { useEffect, useRef, useState } from 'react';
import type { Service, Incident } from '@/lib/types';

function segClass(h: { pct: number; down: number; cls?: string } | null): string {
  if (h === null) return 'nodata';
  if (h.cls)      return h.cls;
  if (h.down)     return 'down';
  if (h.pct < 100) return 'degraded';
  return 'up';
}

function ServiceItem({ svc }: { svc: Service }) {
  const [open, setOpen] = useState(false);
  const history = svc.history;

  const tipRef     = useRef<HTMLDivElement>(null);
  const tipDateRef = useRef<HTMLSpanElement>(null);
  const tipValRef  = useRef<HTMLSpanElement>(null);
  const activeRef  = useRef<number | null>(null);

  function applyContent(j: number) {
    const h = history[j];
    const d = history.length - j;
    const label = d === 1 ? 'Today' : d === history.length ? '90 days ago' : `${d} days ago`;
    const clsLabel: Record<string, string> = { up: 'Operational', degraded: 'Degraded', down: 'Down' };
    const value  = h === null ? 'No data'
      : h.cls ? (clsLabel[h.cls] ?? (h.cls.charAt(0).toUpperCase() + h.cls.slice(1)))
      : `${h.pct.toFixed(1)}%`;
    if (tipDateRef.current) tipDateRef.current.textContent = label;
    if (tipValRef.current)  tipValRef.current.textContent  = value;
  }

  function handleSegEnter(j: number, e: React.MouseEvent<HTMLDivElement>) {
    const tip = tipRef.current;
    if (!tip) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const left = rect.left + rect.width / 2;
    const top  = rect.top;
    const wasVisible = activeRef.current !== null;
    activeRef.current = j;

    if (!wasVisible) {
      applyContent(j);
      tip.style.transition = 'none';
      tip.style.left   = `${left}px`;
      tip.style.top    = `${top}px`;
      tip.style.opacity   = '0';
      tip.style.transform = 'translateX(-50%) translateY(calc(-100% - 10px)) scale(0.86)';
      tip.offsetHeight;
      tip.style.transition = 'opacity 0.15s ease, transform 0.17s cubic-bezier(.34,1.5,.64,1)';
      tip.style.opacity   = '1';
      tip.style.transform = 'translateX(-50%) translateY(calc(-100% - 10px)) scale(1)';
    } else {
      tip.style.transition = 'none';
      tip.style.left = `${left}px`;
      tip.style.top  = `${top}px`;
      applyContent(j);
    }
  }

  function handleBarLeave() {
    const tip = tipRef.current;
    if (!tip || activeRef.current === null) return;
    activeRef.current = null;
    tip.style.transition = 'opacity 0.14s ease, transform 0.14s ease';
    tip.style.opacity   = '0';
    tip.style.transform = 'translateX(-50%) translateY(calc(-100% - 10px)) scale(0.86)';
  }

  return (
    <div className="svc-item">
      <div
        className="svc-header"
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpen(o => !o); }}
      >
        <div className="svc-left">
          <svg className={`chev${open ? ' open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="13" height="13">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          <span className="svc-name">{svc.name}</span>
        </div>
        <div className="svc-right">
          <div className={`mini-bar-wrap${!open ? ' visible' : ''}`}>
            <div className="mini-bar">
              {history.slice(-20).map((h, i) => (
                <span key={i} className={`mini-seg ${segClass(h)}`} />
              ))}
            </div>
          </div>
          <span className="svc-uptime">{Number(svc.uptime).toFixed(2)}% uptime</span>
          <div className={`sdot ${svc.status}`} />
        </div>
      </div>
      <div className={`svc-body ${open ? 'open' : 'closed'}`}>
        <div className="svc-body-inner">
          <div className="bar-labels">
            <span className="bar-label">90 days ago</span>
            <span className="bar-label">Today</span>
          </div>
          <div className="uptime-bar" onMouseLeave={handleBarLeave}>
            {history.map((h, j) => (
              <div
                key={j}
                className={`seg ${segClass(h)}`}
                onMouseEnter={(e) => handleSegEnter(j, e)}
              />
            ))}
          </div>
        </div>
      </div>

      <div ref={tipRef} className="seg-tip-float" style={{ opacity: 0 }}>
        <span ref={tipDateRef} className="tip-date" />
        <span ref={tipValRef}  className="tip-val"  />
      </div>
    </div>
  );
}

interface Props {
  initialServices: Service[];
  initialIncidents: Incident[];
  initialUpdatedAt: number;
}

export default function StatusPageClient({ initialServices, initialIncidents, initialUpdatedAt }: Props) {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [incidents, setIncidents] = useState<Incident[]>(initialIncidents);
  const [updated, setUpdated] = useState(() => 'Updated ' + new Date(initialUpdatedAt).toLocaleTimeString());
  const [incOpen, setIncOpen] = useState(false);
  const incSectionRef = useRef<HTMLDivElement>(null);
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

  async function load() {
    try {
      const [svcRes, incRes] = await Promise.all([
        fetch('/api/services'),
        fetch('/api/incidents'),
      ]);
      setServices(svcRes.ok ? await svcRes.json() : []);
      setIncidents(incRes.ok ? await incRes.json() : []);
    } catch {
      // keep current data on error
    }
    setUpdated('Updated ' + new Date().toLocaleTimeString());
  }

  useEffect(() => {
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  const activeInc = incidents.filter(i => !i.resolved);
  const allStatuses = services.map(s => s.status);
  const hasDown = allStatuses.includes('down');
  const hasDegraded = allStatuses.includes('degraded');

  let bannerClass = 'banner ok';
  let bannerText = 'All systems operational';
  let bannerIconPath = <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>;
  const clickable = activeInc.length > 0 && !hasDown;

  if (hasDown) {
    bannerClass = 'banner err';
    bannerText = 'Some systems are down';
    bannerIconPath = <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>;
  } else if (activeInc.length > 0) {
    bannerClass = 'banner err clickable';
    bannerText = activeInc.length === 1 ? 'Active incident' : `${activeInc.length} active incidents`;
    bannerIconPath = <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>;
  } else if (hasDegraded) {
    bannerClass = 'banner warn';
    bannerText = 'Degraded performance detected';
    bannerIconPath = <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>;
  }

  function toggleInc() {
    if (!clickable) return;
    const el = incSectionRef.current;
    if (!el) return;
    if (incOpen) {
      el.style.maxHeight = el.offsetHeight + 'px';
      el.offsetHeight;
      el.style.maxHeight = '0';
      el.style.opacity = '0';
      setIncOpen(false);
    } else {
      el.style.maxHeight = el.scrollHeight + 'px';
      el.style.opacity = '1';
      setIncOpen(true);
      el.addEventListener('transitionend', function unlock(ev: TransitionEvent) {
        if (ev.propertyName === 'max-height' && incOpen) {
          el.style.maxHeight = 'none';
        }
        el.removeEventListener('transitionend', unlock as EventListener);
      });
    }
  }

  const groups = [...new Set(services.map(s => s.group || ''))];
  const namedGroups = groups.filter(g => g);
  const ungrouped = services.filter(s => !s.group);

  return (
    <div className="status-page">
      <header className="s-header">
        <div className="logo">
          <span className="logo-text">bedrock</span>
        </div>
        <div className="header-right">
          <span className="updated-label" suppressHydrationWarning>{updated}</span>
          <button className="theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
        </div>
      </header>

      <div className="inc-block">
        <div
          className={bannerClass}
          onClick={toggleInc}
          role={clickable ? 'button' : undefined}
        >
          <svg className="banner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {bannerIconPath}
          </svg>
          <span>{bannerText}</span>
          {clickable && (
            <svg className={`banner-chev${incOpen ? ' open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" width="13" height="13">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          )}
        </div>
        <div
          ref={incSectionRef}
          className="inc-section"
          style={{ maxHeight: 0, opacity: 0 }}
        >
          {activeInc.length > 0 && (
            <div className="inc-list">
              {activeInc.map(inc => (
                <div key={inc.id} className="inc-card">
                  <div className="inc-card-top">
                    <span className="inc-dot" />
                    <span className="inc-card-title">{inc.title}</span>
                    <span className="inc-card-svc">{inc.svc}</span>
                  </div>
                  {inc.message && <div className="inc-card-msg">{inc.message}</div>}
                  <div className="inc-card-time">{new Date(inc.created_at * 1000).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="s-groups">
        {ungrouped.map(svc => (
          <div key={svc.id} className="svc-standalone">
            <ServiceItem svc={svc} />
          </div>
        ))}
        {namedGroups.map(g => {
          const svcs = services.filter(s => s.group === g);
          return (
            <div key={g} className="group-block">
              <div className="group-label">{g}</div>
              <div className="group-wrap">
                {svcs.map(svc => <ServiceItem key={svc.id} svc={svc} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
