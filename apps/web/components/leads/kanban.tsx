'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { Flame, Thermometer, Snowflake, User, Phone, Mail, Building2, CheckCircle2, Clock, X } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

export interface LeadContact {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}

export interface LeadStage {
  id: string;
  name: string;
  color?: string | null;
  position: number;
  isWon?: boolean;
  isLost?: boolean;
}

export interface Lead {
  id: string;
  title: string;
  valueCents?: number | null;
  temperature: 'COLD' | 'WARM' | 'HOT';
  status: 'OPEN' | 'WON' | 'LOST';
  interest?: string | null;
  intention?: string | null;
  contact: LeadContact;
  stage: LeadStage;
  assignedUser?: { id: string; name: string; avatarUrl?: string | null } | null;
  createdAt: string;
}

export interface Pipeline {
  id: string;
  name: string;
  isDefault?: boolean;
  stages: LeadStage[];
}

interface KanbanBoardProps {
  token: string;
  pipeline: Pipeline;
  initialLeads: Lead[];
}

const temperatureIcons = {
  HOT: Flame,
  WARM: Thermometer,
  COLD: Snowflake,
} as const;

const temperatureColors = {
  HOT: 'text-red-400',
  WARM: 'text-amber-400',
  COLD: 'text-sky-400',
} as const;

export function KanbanBoard({ token, pipeline, initialLeads }: KanbanBoardProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  // Agrupa leads por stage
  const byStage = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const s of pipeline.stages) map[s.id] = [];
    for (const l of leads) {
      if (map[l.stage.id]) map[l.stage.id].push(l);
    }
    return map;
  }, [leads, pipeline.stages]);

  const activeLead = useMemo(
    () => (activeId ? leads.find((l) => l.id === activeId) : null),
    [activeId, leads],
  );

  async function moveLead(leadId: string, newStageId: string) {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage.id === newStageId) return;

    // Optimistic update
    const newStage = pipeline.stages.find((s) => s.id === newStageId);
    if (!newStage) return;

    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              stage: { ...l.stage, id: newStageId, name: newStage.name, color: newStage.color },
              status: newStage.isWon ? 'WON' : newStage.isLost ? 'LOST' : 'OPEN',
            }
          : l,
      ),
    );

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/crm/leads/' + leadId + '/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stageId: newStageId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || 'Erro ao mover lead');
      }
    } catch (e) {
      // Reverte em caso de erro
      setLeads(initialLeads);
      setError((e as Error).message);
      setTimeout(() => setError(null), 4000);
    } finally {
      setSaving(false);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const newStageId = over.id as string;
    moveLead(active.id as string, newStageId);
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/20">
          <X className="h-4 w-4" />
          {error}
        </div>
      )}
      {saving && (
        <div className="flex items-center gap-2 rounded-lg bg-kairos-500/10 px-3 py-2 text-sm text-kairos-300 ring-1 ring-kairos-500/20">
          <Clock className="h-4 w-4 animate-pulse" />
          Salvando movimento...
        </div>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          {pipeline.stages.map((stage) => {
            const stageLeads = byStage[stage.id] || [];
            const stageValue = stageLeads.reduce((sum, l) => sum + (l.valueCents || 0), 0);

            return (
              <KanbanColumn key={stage.id} stage={stage} count={stageLeads.length} value={stageValue}>
                {stageLeads.map((lead) => (
                  <DraggableLeadCard key={lead.id} lead={lead} />
                ))}
                {stageLeads.length === 0 && (
                  <div className="rounded-lg border border-dashed border-ink-800 p-4 text-center text-xs text-ink-600">
                    Arraste um lead aqui
                  </div>
                )}
              </KanbanColumn>
            );
          })}
        </div>

        <DragOverlay>
          {activeLead ? <LeadCardContent lead={activeLead} dragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function KanbanColumn({
  stage,
  count,
  value,
  children,
}: {
  stage: LeadStage;
  count: number;
  value: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-2xl bg-ink-900/40 ring-1 ring-ink-800/80 transition',
        isOver && 'ring-2 ring-kairos-500/40 bg-ink-900/70',
        stage.isWon && 'ring-emerald-500/30',
        stage.isLost && 'ring-red-500/30',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-ink-800/60">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: stage.color || '#10b981' }}
          />
          <h3 className="text-sm font-semibold text-ink-100 truncate">{stage.name}</h3>
          <span className="rounded-full bg-ink-800 px-1.5 py-0.5 text-2xs font-medium text-ink-400">
            {count}
          </span>
        </div>
        {stage.isWon && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
      </div>

      {/* Total */}
      {value > 0 && (
        <div className="px-3 py-1.5 text-2xs text-ink-500 border-b border-ink-800/40">
          Total: <span className="font-semibold text-ink-300">{formatCurrency(value)}</span>
        </div>
      )}

      {/* Cards */}
      <div className="flex-1 space-y-2 p-2 min-h-[200px]">
        {children}
      </div>
    </div>
  );
}

function DraggableLeadCard({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-30',
      )}
    >
      <LeadCardContent lead={lead} />
    </div>
  );
}

function LeadCardContent({ lead, dragging = false }: { lead: Lead; dragging?: boolean }) {
  const TempIcon = temperatureIcons[lead.temperature];

  return (
    <div
      className={cn(
        'rounded-xl bg-ink-900 ring-1 ring-ink-800 p-3 space-y-2 transition',
        !dragging && 'hover:ring-ink-700 hover:bg-ink-900/80',
        dragging && 'shadow-2xl ring-kairos-500/50 rotate-2',
      )}
    >
      {/* Header: contact name + temperature */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <User className="h-3.5 w-3.5 shrink-0 text-ink-500" />
          <span className="text-sm font-semibold text-ink-100 truncate">
            {lead.contact.name}
          </span>
        </div>
        <TempIcon className={cn('h-3.5 w-3.5 shrink-0', temperatureColors[lead.temperature])} />
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium text-ink-200 leading-tight">{lead.title}</h4>

      {/* Contact info */}
      {(lead.contact.phone || lead.contact.email) && (
        <div className="space-y-0.5 text-2xs text-ink-500">
          {lead.contact.phone && (
            <div className="flex items-center gap-1.5">
              <Phone className="h-3 w-3" />
              {lead.contact.phone}
            </div>
          )}
          {lead.contact.email && (
            <div className="flex items-center gap-1.5 truncate">
              <Mail className="h-3 w-3" />
              {lead.contact.email}
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {(lead.interest || lead.intention) && (
        <div className="flex flex-wrap gap-1">
          {lead.interest && (
            <span className="rounded-full bg-ink-800 px-2 py-0.5 text-2xs text-ink-300">
              {lead.interest}
            </span>
          )}
          {lead.intention && (
            <span className="rounded-full bg-kairos-500/10 px-2 py-0.5 text-2xs text-kairos-300 ring-1 ring-kairos-500/20">
              {lead.intention}
            </span>
          )}
        </div>
      )}

      {/* Value */}
      {lead.valueCents && lead.valueCents > 0 && (
        <div className="border-t border-ink-800/60 pt-2 text-sm font-semibold text-kairos-300">
          {formatCurrency(lead.valueCents)}
        </div>
      )}

      {/* Assigned user */}
      {lead.assignedUser && (
        <div className="flex items-center gap-1.5 border-t border-ink-800/60 pt-2 text-2xs text-ink-500">
          <div className="grid h-5 w-5 place-items-center rounded-full bg-ink-800 text-2xs text-ink-300">
            {lead.assignedUser.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          {lead.assignedUser.name}
        </div>
      )}
    </div>
  );
}
