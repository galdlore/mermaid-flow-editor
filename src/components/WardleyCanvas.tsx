import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useI18n } from '../i18n';
import type { WardleyDiagramData } from '../types/editor';
import { allocateUniqueId } from '../utils/mermaidEnvelope';
import {
  clampWardleyCoord,
  getDefaultEvolutionStages,
} from '../utils/wardleyConverter';

export interface WardleyCanvasProps {
  wardleyData: WardleyDiagramData;
  selectedItemId: string | null;
  onChange: (next: WardleyDiagramData) => void;
  onSelectItem: (itemId: string | null) => void;
}

const SVG_W = 600;
const SVG_H = 400;
const PAD_LEFT = 48;
const PAD_RIGHT = 24;
const PAD_TOP = 24;
const PAD_BOTTOM = 44;
const PLOT_W = SVG_W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = SVG_H - PAD_TOP - PAD_BOTTOM;

function toSvgX(evo: number): number {
  return PAD_LEFT + clampWardleyCoord(evo) * PLOT_W;
}

function toSvgY(vis: number): number {
  return PAD_TOP + (1 - clampWardleyCoord(vis)) * PLOT_H;
}

const STRATEGY_COLORS: Record<string, string> = {
  build: '#16a34a',
  buy: '#2563eb',
  outsource: '#9333ea',
  market: '#d97706',
};

type DragTarget = {
  id: string;
  kind: 'anchor' | 'component' | 'note';
};

export default function WardleyCanvas({
  wardleyData,
  selectedItemId,
  onChange,
  onSelectItem,
}: WardleyCanvasProps) {
  const { lang, t } = useI18n();
  const wd = t.inspector.wardley;
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null);
  const latestDataRef = useRef(wardleyData);
  latestDataRef.current = wardleyData;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!dragTarget) return;

    const handlePointerMove = (event: PointerEvent): void => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const svgX = ((event.clientX - rect.left) / rect.width) * SVG_W;
      const svgY = ((event.clientY - rect.top) / rect.height) * SVG_H;
      const evolution = clampWardleyCoord((svgX - PAD_LEFT) / PLOT_W);
      const visibility = clampWardleyCoord(1 - (svgY - PAD_TOP) / PLOT_H);
      const current = latestDataRef.current;

      if (dragTarget.kind === 'anchor') {
        onChangeRef.current({
          ...current,
          anchors: current.anchors.map((a) =>
            a.id === dragTarget.id ? { ...a, visibility, evolution } : a
          ),
        });
      } else if (dragTarget.kind === 'component') {
        onChangeRef.current({
          ...current,
          components: current.components.map((c) =>
            c.id === dragTarget.id ? { ...c, visibility, evolution } : c
          ),
        });
      } else {
        onChangeRef.current({
          ...current,
          notes: (current.notes ?? []).map((n) =>
            n.id === dragTarget.id ? { ...n, visibility, evolution } : n
          ),
        });
      }
    };

    const handlePointerUp = (): void => setDragTarget(null);

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragTarget]);

  const stages =
    wardleyData.evolutionStages ?? getDefaultEvolutionStages(lang);

  const posById = new Map<string, { x: number; y: number }>();
  for (const a of wardleyData.anchors) {
    posById.set(a.id, { x: toSvgX(a.evolution), y: toSvgY(a.visibility) });
  }
  for (const c of wardleyData.components) {
    posById.set(c.id, { x: toSvgX(c.evolution), y: toSvgY(c.visibility) });
  }

  const allElementIds = () =>
    new Set([
      ...wardleyData.anchors.map((a) => a.id),
      ...wardleyData.components.map((c) => c.id),
      ...(wardleyData.notes ?? []).map((n) => n.id),
    ]);

  const handleAddComponent = (): void => {
    const id = allocateUniqueId(
      `cmp_${wardleyData.components.length + 1}`,
      allElementIds()
    );
    onChange({
      ...wardleyData,
      components: [
        ...wardleyData.components,
        {
          id,
          name: wd.defaultComponentName(wardleyData.components.length + 1),
          visibility: 0.55,
          evolution: 0.45,
          strategy: 'build',
        },
      ],
    });
    onSelectItem(id);
  };

  const handleAddAnchor = (): void => {
    const id = allocateUniqueId(
      `anc_${wardleyData.anchors.length + 1}`,
      allElementIds()
    );
    onChange({
      ...wardleyData,
      anchors: [
        ...wardleyData.anchors,
        {
          id,
          name: wd.defaultAnchorName(wardleyData.anchors.length + 1),
          visibility: 0.92,
          evolution: 0.5,
        },
      ],
    });
    onSelectItem(id);
  };

  const handleAddNote = (): void => {
    const existingNotes = wardleyData.notes ?? [];
    const id = allocateUniqueId(
      `note_${existingNotes.length + 1}`,
      allElementIds()
    );
    onChange({
      ...wardleyData,
      notes: [
        ...existingNotes,
        {
          id,
          text: wd.defaultNoteText(existingNotes.length + 1),
          visibility: 0.72,
          evolution: 0.25,
        },
      ],
    });
    onSelectItem(id);
  };

  const hasElements =
    wardleyData.anchors.length > 0 ||
    wardleyData.components.length > 0 ||
    (wardleyData.notes?.length ?? 0) > 0;

  return (
    <div className="wardley-canvas">
      <div className="wardley-toolbar">
        <button type="button" className="btn-secondary" onClick={handleAddComponent}>
          <Plus size={14} />
          <span>{wd.addComponentBtn}</span>
        </button>
        <button type="button" className="btn-secondary" onClick={handleAddAnchor}>
          <Plus size={14} />
          <span>{wd.addAnchorBtn}</span>
        </button>
        <button type="button" className="btn-secondary" onClick={handleAddNote}>
          <Plus size={14} />
          <span>{wd.addNoteBtn}</span>
        </button>
      </div>

      <div className="wardley-canvas-scroll">
        {wardleyData.title && (
          <div className="strategy-title-banner">{wardleyData.title}</div>
        )}

        {!hasElements ? (
          <div className="strategy-empty-state">{wd.emptyElements}</div>
        ) : (
          <div className="wardley-map-wrap">
            <p className="wardley-map-hint">{wd.dragHint}</p>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="wardley-svg"
            >
              {/* Axes & stage dividers */}
              <rect
                x={PAD_LEFT}
                y={PAD_TOP}
                width={PLOT_W}
                height={PLOT_H}
                fill="#ffffff"
                stroke="#cbd5e1"
              />
              {[0.25, 0.5, 0.75].map((boundary) => {
                const x = toSvgX(boundary);
                return (
                  <line
                    key={boundary}
                    x1={x}
                    y1={PAD_TOP}
                    x2={x}
                    y2={PAD_TOP + PLOT_H}
                    stroke="#cbd5e1"
                    strokeDasharray="4 4"
                  />
                );
              })}
              {stages.map((stageLabel, idx) => (
                <text
                  key={`${stageLabel}_${idx}`}
                  x={PAD_LEFT + ((idx + 0.5) / 4) * PLOT_W}
                  y={SVG_H - 16}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="#475569"
                >
                  {stageLabel}
                </text>
              ))}
              <text
                x={16}
                y={PAD_TOP + PLOT_H / 2}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill="#475569"
                transform={`rotate(-90 16 ${PAD_TOP + PLOT_H / 2})`}
              >
                Visibility
              </text>

              {/* Dependency links */}
              {wardleyData.links.map((link) => {
                const fromPos = posById.get(link.from);
                const toPos = posById.get(link.to);
                if (!fromPos || !toPos) return null;
                const isFlow = link.style?.startsWith('flow');
                const dash =
                  link.style === 'dotted'
                    ? '3 3'
                    : link.style === 'dashed' || isFlow
                      ? '6 3'
                      : undefined;
                return (
                  <g key={link.id}>
                    <line
                      x1={fromPos.x}
                      y1={fromPos.y}
                      x2={toPos.x}
                      y2={toPos.y}
                      stroke={isFlow ? '#0891b2' : '#64748b'}
                      strokeWidth={isFlow ? 2.2 : 1.5}
                      strokeDasharray={dash}
                    />
                    {link.label && (
                      <text
                        x={(fromPos.x + toPos.x) / 2}
                        y={(fromPos.y + toPos.y) / 2 - 4}
                        textAnchor="middle"
                        fontSize="10"
                        fill="#0f172a"
                      >
                        {link.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Planned evolutions */}
              {wardleyData.components.map((comp) => {
                if (comp.evolveTo === undefined) return null;
                const x1 = toSvgX(comp.evolution);
                const x2 = toSvgX(comp.evolveTo);
                const y = toSvgY(comp.visibility);
                return (
                  <g key={`evo_${comp.id}`}>
                    <line
                      x1={x1}
                      y1={y}
                      x2={x2}
                      y2={y}
                      stroke="#dc2626"
                      strokeWidth={1.75}
                      strokeDasharray="5 3"
                    />
                    <circle
                      cx={x2}
                      cy={y}
                      r={6}
                      fill="#ffffff"
                      stroke="#dc2626"
                      strokeWidth={1.75}
                    />
                  </g>
                );
              })}

              {/* Anchors */}
              {wardleyData.anchors.map((anchor) => {
                const x = toSvgX(anchor.evolution);
                const y = toSvgY(anchor.visibility);
                const isSelected = anchor.id === selectedItemId;
                return (
                  <g
                    key={anchor.id}
                    className="wardley-node-group"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onSelectItem(anchor.id);
                      setDragTarget({ id: anchor.id, kind: 'anchor' });
                    }}
                  >
                    <polygon
                      points={`${x},${y - 9} ${x + 9},${y} ${x},${y + 9} ${x - 9},${y}`}
                      fill={isSelected ? '#2563eb' : '#0f172a'}
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                    <text
                      x={x}
                      y={y - 13}
                      textAnchor="middle"
                      fontSize="11.5"
                      fontWeight="700"
                      fill="#0f172a"
                    >
                      {anchor.name}
                    </text>
                  </g>
                );
              })}

              {/* Components */}
              {wardleyData.components.map((comp) => {
                const x = toSvgX(comp.evolution);
                const y = toSvgY(comp.visibility);
                const isSelected = comp.id === selectedItemId;
                const accent = comp.strategy
                  ? STRATEGY_COLORS[comp.strategy] ?? '#334155'
                  : '#334155';
                return (
                  <g
                    key={comp.id}
                    className="wardley-node-group"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onSelectItem(comp.id);
                      setDragTarget({ id: comp.id, kind: 'component' });
                    }}
                  >
                    {comp.inertia && (
                      <rect
                        x={x + 11}
                        y={y - 10}
                        width={4}
                        height={20}
                        fill="#dc2626"
                        rx={1}
                      />
                    )}
                    <circle
                      cx={x}
                      cy={y}
                      r={isSelected ? 9 : 7.5}
                      fill={isSelected ? '#dbeafe' : '#ffffff'}
                      stroke={isSelected ? '#2563eb' : accent}
                      strokeWidth={2.5}
                    />
                    <text
                      x={x + 12}
                      y={y - 8}
                      fontSize="11.5"
                      fontWeight={isSelected ? '700' : '600'}
                      fill="#0f172a"
                    >
                      {comp.name}
                    </text>
                  </g>
                );
              })}

              {/* Notes */}
              {(wardleyData.notes ?? []).map((note) => {
                const x = toSvgX(note.evolution);
                const y = toSvgY(note.visibility);
                const isSelected = note.id === selectedItemId;
                return (
                  <g
                    key={note.id}
                    className="wardley-node-group"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onSelectItem(note.id);
                      setDragTarget({ id: note.id, kind: 'note' });
                    }}
                  >
                    <rect
                      x={x - 42}
                      y={y - 12}
                      width={84}
                      height={22}
                      rx={4}
                      fill="#fef9c3"
                      stroke={isSelected ? '#2563eb' : '#eab308'}
                      strokeWidth={isSelected ? 2 : 1.2}
                    />
                    <text
                      x={x}
                      y={y + 3}
                      textAnchor="middle"
                      fontSize="10.5"
                      fill="#713f12"
                    >
                      {note.text}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
