'use client';

import { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Service, Group, Protocol } from '@/lib/types';

// ── Grip icon ──────────────────────────────────────────────────────────────────

function GripIcon() {
  return (
    <svg className="drag-grip" viewBox="0 0 10 16" fill="currentColor" width="10" height="14" aria-hidden="true">
      <circle cx="3" cy="3" r="1.2"/><circle cx="7" cy="3" r="1.2"/>
      <circle cx="3" cy="8" r="1.2"/><circle cx="7" cy="8" r="1.2"/>
      <circle cx="3" cy="13" r="1.2"/><circle cx="7" cy="13" r="1.2"/>
    </svg>
  );
}

// ── Protocol pill ──────────────────────────────────────────────────────────────

function ProtoPill({ proto }: { proto: string }) {
  return <span className={`proto-pill ${proto}`}>{proto}</span>;
}

// ── Service edit panel ─────────────────────────────────────────────────────────

interface ServiceEditProps {
  svc: Service;
  groups: Group[];
  onClose: () => void;
  onSaved: () => void;
}

function ServiceEdit({ svc, groups, onClose, onSaved }: ServiceEditProps) {
  const [name, setName] = useState(svc.name);
  const [group, setGroup] = useState(svc.group || '');
  const [status, setStatus] = useState(svc.status);
  const [protos, setProtos] = useState<Protocol[]>(JSON.parse(JSON.stringify(svc.protocols || [])));
  const [newProto, setNewProto] = useState('HTTP');
  const [newIp, setNewIp] = useState('');
  const [newPort, setNewPort] = useState('');
  const [saving, setSaving] = useState(false);

  const needsPort = (p: string) => ['TCP','UDP','QUIC'].includes(p);

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/services/${svc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, group, status, protocols: protos }),
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function addProto() {
    if (!newIp.trim()) return;
    setProtos(prev => [...prev, { proto: newProto as Protocol['proto'], ip: newIp.trim(), port: newPort.trim() || undefined }]);
    setNewIp(''); setNewPort('');
  }

  return (
    <div className="svc-edit">
      <div className="svc-edit-inner">
        <div className="row3">
          <div className="field"><label>Name</label><input value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="field">
            <label>Group</label>
            <select value={group} onChange={e => setGroup(e.target.value)}>
              <option value="">— ungrouped —</option>
              {groups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as Service['status'])}>
              <option value="up">up</option>
              <option value="degraded">degraded</option>
              <option value="down">down</option>
            </select>
          </div>
        </div>
        <div className="section-label" style={{ marginBottom: 8 }}>Protocols / endpoints</div>
        <div>
          {protos.map((p, i) => (
            <div key={i} className="proto-row">
              <select
                className="proto-edit-sel"
                value={p.proto}
                onChange={e => setProtos(prev => prev.map((x, j) => j === i ? { ...x, proto: e.target.value as Protocol['proto'] } : x))}
              >
                {['TCP','UDP','HTTP','HTTPS','QUIC'].map(pr => <option key={pr}>{pr}</option>)}
              </select>
              <input
                className="proto-edit-ip"
                value={p.ip}
                placeholder="IP / Host / URL"
                onChange={e => setProtos(prev => prev.map((x, j) => j === i ? { ...x, ip: e.target.value } : x))}
              />
              {needsPort(p.proto) && (
                <input
                  className="proto-edit-port"
                  value={p.port || ''}
                  placeholder="port"
                  onChange={e => setProtos(prev => prev.map((x, j) => j === i ? { ...x, port: e.target.value } : x))}
                />
              )}
              <button className="proto-del" onClick={() => setProtos(prev => prev.filter((_, j) => j !== i))}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="12" height="12"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          ))}
        </div>
        <div className="row4">
          <div className="field">
            <label>Protocol</label>
            <select value={newProto} onChange={e => setNewProto(e.target.value)}>
              {['TCP','UDP','HTTP','HTTPS','QUIC'].map(pr => <option key={pr}>{pr}</option>)}
            </select>
          </div>
          {needsPort(newProto) && (
            <div className="field"><label>Port</label><input value={newPort} onChange={e => setNewPort(e.target.value)} placeholder="3000" /></div>
          )}
          <div className="field"><label>IP / Host / URL</label><input value={newIp} onChange={e => setNewIp(e.target.value)} placeholder="example.com" /></div>
          <div className="field align-end">
            <button className="btn btn-ghost w-full" onClick={addProto}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="13" height="13"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add
            </button>
          </div>
        </div>
        <div className="flex-end">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sortable service row ───────────────────────────────────────────────────────

interface SvcRowProps {
  svc: Service;
  groups: Group[];
  overlay?: boolean;
  onDelete: (id: number) => void;
  onSaved: () => void;
  onStatusChange: (id: number, status: string) => void;
}

function SvcRow({ svc, groups, overlay, onDelete, onSaved, onStatusChange }: SvcRowProps) {
  const [editOpen, setEditOpen] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `svc-${svc.id}`, disabled: editOpen });

  const style = overlay ? {} : {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : undefined,
    position: isDragging ? 'relative' as const : undefined,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div ref={overlay ? undefined : setNodeRef} style={overlay ? {} : style}>
      <div className="a-row" style={overlay ? { boxShadow: '0 4px 16px rgba(0,0,0,0.3)', borderRadius: 6, opacity: 0.95 } : {}}>
        <div {...(overlay ? {} : { ...attributes, ...listeners })} style={{ cursor: overlay ? 'grabbing' : 'grab', touchAction: 'none', display: 'flex', alignItems: 'center' }}>
          <GripIcon />
        </div>
        <div className="a-row-info">
          <div className="a-row-name">{svc.name}</div>
          <div className="a-row-sub">
            <span>{svc.group || 'ungrouped'}</span>
            {(svc.protocols || []).map((p, i) => <ProtoPill key={i} proto={p.proto} />)}
          </div>
        </div>
        <select
          className="status-sel"
          value={svc.status}
          onChange={e => onStatusChange(svc.id, e.target.value)}
          onPointerDown={e => e.stopPropagation()}
        >
          <option value="up">up</option>
          <option value="degraded">degraded</option>
          <option value="down">down</option>
        </select>
        <div className={`sdot ${svc.status}`} />
        <button className="icon-btn" onPointerDown={e => e.stopPropagation()} onClick={() => setEditOpen(o => !o)} title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button className="icon-btn" onPointerDown={e => e.stopPropagation()} onClick={() => onDelete(svc.id)} title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
      {editOpen && (
        <ServiceEdit
          svc={svc}
          groups={groups}
          onClose={() => setEditOpen(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

// ── Drop placeholder for empty ungrouped zone (no useDroppable, just useSortable) ──

const UNGRP_PLACEHOLDER = 'ungrp-placeholder';

function UngrpPlaceholder() {
  const { setNodeRef, isOver } = useSortable({ id: UNGRP_PLACEHOLDER });
  return (
    <div
      ref={setNodeRef}
      className="zone-drop-hint"
      style={isOver ? { background: 'rgba(255,255,255,0.04)', borderRadius: 6 } : undefined}
    >
      — drop here to ungroup —
    </div>
  );
}

// ── Sortable group block ───────────────────────────────────────────────────────

interface GrpBlockProps {
  group: Group;
  services: Service[];
  allGroups: Group[];
  overlay?: boolean;
  onDelete: (id: number) => void;
  onSaved: () => void;
  onStatusChange: (id: number, status: string) => void;
}

function GrpBlock({ group, services, allGroups, overlay, onDelete, onSaved, onStatusChange }: GrpBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `grp-${group.id}` });

  const style = overlay ? {} : {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : undefined,
  };

  const svcIds = services.map(s => `svc-${s.id}` as UniqueIdentifier);

  return (
    <div ref={overlay ? undefined : setNodeRef} style={overlay ? {} : style} className="grp-block">
      <div
        className="grp-block-hd"
        style={overlay ? { boxShadow: '0 4px 16px rgba(0,0,0,0.35)', cursor: 'grabbing' } : {}}
        {...(overlay ? {} : { ...attributes, ...listeners })}
      >
        <GripIcon />
        <span>{group.name}</span>
      </div>
      <SortableContext items={svcIds} strategy={verticalListSortingStrategy}>
        {services.map(svc => (
          <SvcRow
            key={svc.id}
            svc={svc}
            groups={allGroups}
            onDelete={onDelete}
            onSaved={onSaved}
            onStatusChange={onStatusChange}
          />
        ))}
      </SortableContext>
      {services.length === 0 && (
        <div className="zone-drop-hint">— drop a service here —</div>
      )}
    </div>
  );
}

// ── Main AllServices component ─────────────────────────────────────────────────

interface AllServicesProps {
  initialServices: Service[];
  initialGroups: Group[];
  onRefresh: () => void;
}

export default function AllServices({ initialServices, initialGroups, onRefresh }: AllServicesProps) {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  // Sync when parent refreshes
  useEffect(() => { setServices(initialServices); }, [initialServices]);
  useEffect(() => { setGroups(initialGroups); }, [initialGroups]);

  // Ref tracks the live target group during drag (avoids stale closure in onDragEnd)
  const dragTargetGroupRef = useRef<string | null>(null);
  const dragActiveSvcIdRef = useRef<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Active item for overlay ──────────────────────────────────────────────────
  const activeService = activeId && typeof activeId === 'string' && activeId.startsWith('svc-')
    ? services.find(s => s.id === parseInt(activeId.slice(4)))
    : null;
  const activeGroup = activeId && typeof activeId === 'string' && activeId.startsWith('grp-')
    ? groups.find(g => g.id === parseInt(activeId.slice(4)))
    : null;
  const activeGroupServices = activeGroup ? services.filter(s => s.group === activeGroup.name) : [];

  // ── onDragStart ──────────────────────────────────────────────────────────────
  function onDragStart(event: DragStartEvent) {
    setActiveId(event.active.id);
    const id = String(event.active.id);
    if (id.startsWith('svc-')) {
      const svcId = parseInt(id.slice(4));
      dragActiveSvcIdRef.current = svcId;
      dragTargetGroupRef.current = services.find(s => s.id === svcId)?.group ?? null;
    }
  }

  // ── onDragOver: track target group in ref only — do NOT update React state here.
  // Updating SortableContext items during an active drag causes React #185 with
  // @dnd-kit 6.x + React 19. State update happens once in onDragEnd instead.
  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeIdStr = String(active.id);
    if (!activeIdStr.startsWith('svc-')) return;

    const overIdStr = String(over.id);
    let targetGroup: string;

    if (overIdStr === UNGRP_PLACEHOLDER) {
      targetGroup = '';
    } else if (overIdStr.startsWith('grp-')) {
      const grpId = parseInt(overIdStr.slice(4));
      const grp = groups.find(g => g.id === grpId);
      if (!grp) return;
      targetGroup = grp.name;
    } else if (overIdStr.startsWith('svc-')) {
      const overSvcId = parseInt(overIdStr.slice(4));
      targetGroup = services.find(s => s.id === overSvcId)?.group ?? '';
    } else {
      return;
    }

    // Only update ref — no setServices here
    dragTargetGroupRef.current = targetGroup;
  }

  // ── onDragEnd: finalize position + API calls ─────────────────────────────────
  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    // Read from refs (always current, no stale closure)
    const finalTargetGroup = dragTargetGroupRef.current;
    const activeSvcId = dragActiveSvcIdRef.current;
    dragTargetGroupRef.current = null;
    dragActiveSvcIdRef.current = null;

    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    // ── Group reorder ──────────────────────────────────────────────────────────
    if (activeIdStr.startsWith('grp-') && overIdStr.startsWith('grp-')) {
      const activeGrpId = parseInt(activeIdStr.slice(4));
      const overGrpId = parseInt(overIdStr.slice(4));
      if (activeGrpId === overGrpId) return;

      const oldIndex = groups.findIndex(g => g.id === activeGrpId);
      const newIndex = groups.findIndex(g => g.id === overGrpId);
      const newGroups = arrayMove(groups, oldIndex, newIndex);
      setGroups(newGroups);

      fetch('/api/groups/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: newGroups.map(g => g.id) }),
      }).catch(() => {});
      return;
    }

    // ── Service move / reorder ─────────────────────────────────────────────────
    if (!activeIdStr.startsWith('svc-') || activeSvcId === null) return;

    const isValidOver = overIdStr.startsWith('svc-') || overIdStr.startsWith('grp-') || overIdStr === UNGRP_PLACEHOLDER;
    if (!isValidOver) return;

    setServices(currentServices => {
      const activeSvc = currentServices.find(s => s.id === activeSvcId);
      if (!activeSvc) return currentServices;

      const sourceGroup = activeSvc.group ?? '';
      // finalTargetGroup: null means onDragOver never fired → stay in same group
      const destGroup = finalTargetGroup ?? sourceGroup;

      // 1. Apply group change to the dragged service
      let next: Service[] = currentServices.map(s =>
        s.id === activeSvcId ? { ...s, group: destGroup } : s
      );

      // 2. Reorder within destination group if dropped on a specific service there
      if (overIdStr.startsWith('svc-')) {
        const overSvcId = parseInt(overIdStr.slice(4));
        const overSvcGroup = currentServices.find(s => s.id === overSvcId)?.group ?? '';
        if (overSvcGroup === destGroup) {
          const members = next.filter(s => (s.group ?? '') === destGroup);
          const fromIdx = members.findIndex(s => s.id === activeSvcId);
          const toIdx   = members.findIndex(s => s.id === overSvcId);
          if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
            const reordered = arrayMove(members, fromIdx, toIdx);
            const rest = next.filter(s => (s.group ?? '') !== destGroup);
            next = [...rest, ...reordered];
          }
        }
      }

      queueMicrotask(() => {
        if (destGroup !== sourceGroup) {
          fetch(`/api/services/${activeSvcId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ group: destGroup }),
          }).catch(() => {});
        }
        const members = next.filter(s => (s.group ?? '') === destGroup);
        if (members.length > 1) {
          fetch('/api/services/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: members.map(s => s.id) }),
          }).catch(() => {});
        }
      });

      return next;
    });
  }

  async function deleteService(id: number) {
    if (!confirm('Delete this service?')) return;
    await fetch(`/api/services/${id}`, { method: 'DELETE' });
    setServices(prev => prev.filter(s => s.id !== id));
  }

  async function changeStatus(id: number, status: string) {
    await fetch(`/api/services/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setServices(prev => prev.map(s => s.id === id ? { ...s, status: status as Service['status'] } : s));
  }

  const ungrouped = services.filter(s => !(s.group));
  // When ungrouped is empty, include a placeholder so there's a drop target
  const ungroupedIds: UniqueIdentifier[] = ungrouped.length > 0
    ? ungrouped.map(s => `svc-${s.id}`)
    : [UNGRP_PLACEHOLDER];
  const grpIds = groups.map(g => `grp-${g.id}` as UniqueIdentifier);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="all-svc-canvas">
        {/* Ungrouped zone — always rendered, plain div (no useDroppable to avoid React 19 issues) */}
        <div className="ungrp-zone">
          <SortableContext items={ungroupedIds} strategy={verticalListSortingStrategy}>
            {ungrouped.map(svc => (
              <SvcRow
                key={svc.id}
                svc={svc}
                groups={groups}
                onDelete={deleteService}
                onSaved={onRefresh}
                onStatusChange={changeStatus}
              />
            ))}
            {ungrouped.length === 0 && <UngrpPlaceholder />}
          </SortableContext>
        </div>

        {/* Group blocks */}
        <SortableContext items={grpIds} strategy={verticalListSortingStrategy}>
          {groups.map(g => (
            <GrpBlock
              key={g.id}
              group={g}
              services={services.filter(s => s.group === g.name)}
              allGroups={groups}
              onDelete={deleteService}
              onSaved={onRefresh}
              onStatusChange={changeStatus}
            />
          ))}
        </SortableContext>
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={{ duration: 160, easing: 'ease' }}>
        {activeService && (
          <SvcRow
            svc={activeService}
            groups={groups}
            overlay
            onDelete={() => {}}
            onSaved={() => {}}
            onStatusChange={() => {}}
          />
        )}
        {activeGroup && (
          <GrpBlock
            group={activeGroup}
            services={activeGroupServices}
            allGroups={groups}
            overlay
            onDelete={() => {}}
            onSaved={() => {}}
            onStatusChange={() => {}}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
