import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import type { QuadrantClassDefData, QuadrantDiagramData, QuadrantPointData } from '../types/editor';

interface QuadrantCanvasProps {
  data: QuadrantDiagramData;
  selectedPointId: string | null;
  onSelectPoint: (pointId: string | null) => void;
  onChange: (nextData: QuadrantDiagramData) => void;
}

const VIEW_W = 640;
const VIEW_H = 510;
const PLOT_LEFT = 76;
const PLOT_TOP = 64;
const PLOT_W = 528;
const PLOT_H = 386;
const PLOT_RIGHT = PLOT_LEFT + PLOT_W;
const PLOT_BOTTOM = PLOT_TOP + PLOT_H;
const PLOT_CX = PLOT_LEFT + PLOT_W / 2;
const PLOT_CY = PLOT_TOP + PLOT_H / 2;

const QUADRANT_BG = {
  q1: '#eef2ff',
  q2: '#f0fdf4',
  q3: '#fefce8',
  q4: '#fdf2f8',
};

const QUADRANT_TEXT_COLOR = {
  q1: '#3730a3',
  q2: '#166534',
  q3: '#854d0e',
  q4: '#9d174d',
};

function clamp01(val: number): number {
  if (!Number.isFinite(val)) return 0.5;
  return Math.max(0, Math.min(1, Math.round(val * 100) / 100));
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

function resolvePointVisual(
  point: QuadrantPointData,
  classMap: Map<string, QuadrantClassDefData>
): {
  radius: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
} {
  const cls = point.className ? classMap.get(point.className) : undefined;
  const radius = point.radius ?? cls?.radius ?? 7;
  const fill = point.color ?? cls?.color ?? '#4f46e5';
  const stroke = point.strokeColor ?? cls?.strokeColor ?? '#ffffff';
  const strokeWidth = point.strokeWidthPx ?? cls?.strokeWidthPx ?? 2;
  return {
    radius: Math.max(4, Math.min(28, Number.isFinite(radius) ? radius : 7)),
    fill,
    stroke,
    strokeWidth: Math.max(0, Math.min(8, Number.isFinite(strokeWidth) ? strokeWidth : 2)),
  };
}

export const QuadrantCanvas: React.FC<QuadrantCanvasProps> = ({
  data,
  selectedPointId,
  onSelectPoint,
  onChange,
}) => {
  const { t } = useI18n();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const dataRef = useRef(data);
  dataRef.current = data;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const classMap = useMemo(() => {
    const map = new Map<string, QuadrantClassDefData>();
    for (const cls of data.classDefs ?? []) {
      map.set(cls.name, cls);
    }
    return map;
  }, [data.classDefs]);

  const clientToNormalized = (clientX: number, clientY: number): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0.5, y: 0.5 };
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: 0.5, y: 0.5 };
    const svgX = ((clientX - rect.left) / rect.width) * VIEW_W;
    const svgY = ((clientY - rect.top) / rect.height) * VIEW_H;
    const x = clamp01((svgX - PLOT_LEFT) / PLOT_W);
    const y = clamp01((PLOT_BOTTOM - svgY) / PLOT_H);
    return { x, y };
  };

  useEffect(() => {
    if (!draggingId) return;

    const handlePointerMove = (e: PointerEvent) => {
      const { x, y } = clientToNormalized(e.clientX, e.clientY);
      const current = dataRef.current;
      const target = current.points.find((pt) => pt.id === draggingId);
      if (!target || (target.x === x && target.y === y)) return;
      onChangeRef.current({
        ...current,
        points: current.points.map((pt) => (pt.id === draggingId ? { ...pt, x, y } : pt)),
      });
    };

    const handlePointerUp = () => {
      setDraggingId(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [draggingId]);

  const addPointAt = (x: number, y: number) => {
    const nextIdx = data.points.length + 1;
    const newId = `pt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newPoint: QuadrantPointData = {
      id: newId,
      label: t.inspector.quadrantChart.defaultPointLabel(nextIdx),
      x: clamp01(x),
      y: clamp01(y),
    };
    onChange({
      ...data,
      points: [...data.points, newPoint],
    });
    onSelectPoint(newId);
  };

  const handleDeleteSelected = () => {
    if (!selectedPointId) return;
    const nextPoints = data.points.filter((pt) => pt.id !== selectedPointId);
    onChange({
      ...data,
      points: nextPoints,
    });
    onSelectPoint(nextPoints[0]?.id ?? null);
  };

  const handleSvgDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const { x, y } = clientToNormalized(e.clientX, e.clientY);
    addPointAt(x, y);
  };

  const selectedPoint = data.points.find((pt) => pt.id === selectedPointId) ?? null;

  return (
    <div className="quadrant-canvas-container">
      <div className="quadrant-toolbar">
        <div className="quadrant-toolbar-actions">
          <button
            type="button"
            className="toolbar-btn primary"
            onClick={() => addPointAt(0.5, 0.5)}
          >
            {t.inspector.quadrantChart.addPointBtn}
          </button>
          <button
            type="button"
            className="toolbar-btn danger"
            onClick={handleDeleteSelected}
            disabled={!selectedPoint}
          >
            {t.inspector.quadrantChart.deletePointBtn}
          </button>
        </div>
        <span className="quadrant-toolbar-hint">{t.inspector.quadrantChart.dragHint}</span>
      </div>

      <div className="quadrant-board-wrap">
        <svg
          ref={svgRef}
          className={`quadrant-svg${draggingId ? ' is-dragging' : ''}`}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          onDoubleClick={handleSvgDoubleClick}
        >
          {/* Chart Title */}
          {data.title && (
            <text
              x={PLOT_CX}
              y={28}
              textAnchor="middle"
              className="quadrant-svg-title"
            >
              {truncateText(data.title, 48)}
            </text>
          )}

          {/* Quadrant Backgrounds: Q2 (top-left), Q1 (top-right), Q3 (bottom-left), Q4 (bottom-right) */}
          <rect
            x={PLOT_LEFT}
            y={PLOT_TOP}
            width={PLOT_W / 2}
            height={PLOT_H / 2}
            fill={QUADRANT_BG.q2}
          />
          <rect
            x={PLOT_CX}
            y={PLOT_TOP}
            width={PLOT_W / 2}
            height={PLOT_H / 2}
            fill={QUADRANT_BG.q1}
          />
          <rect
            x={PLOT_LEFT}
            y={PLOT_CY}
            width={PLOT_W / 2}
            height={PLOT_H / 2}
            fill={QUADRANT_BG.q3}
          />
          <rect
            x={PLOT_CX}
            y={PLOT_CY}
            width={PLOT_W / 2}
            height={PLOT_H / 2}
            fill={QUADRANT_BG.q4}
          />

          {/* Subtle Quarter Grid Lines */}
          {[0.25, 0.75].map((ratio) => (
            <g key={ratio} className="quadrant-svg-subgrid">
              <line
                x1={PLOT_LEFT + PLOT_W * ratio}
                y1={PLOT_TOP}
                x2={PLOT_LEFT + PLOT_W * ratio}
                y2={PLOT_BOTTOM}
              />
              <line
                x1={PLOT_LEFT}
                y1={PLOT_TOP + PLOT_H * ratio}
                x2={PLOT_RIGHT}
                y2={PLOT_TOP + PLOT_H * ratio}
              />
            </g>
          ))}

          {/* Outer Frame & Center Crosshairs */}
          <rect
            x={PLOT_LEFT}
            y={PLOT_TOP}
            width={PLOT_W}
            height={PLOT_H}
            fill="none"
            className="quadrant-svg-border"
          />
          <line
            x1={PLOT_CX}
            y1={PLOT_TOP}
            x2={PLOT_CX}
            y2={PLOT_BOTTOM}
            className="quadrant-svg-centerline"
          />
          <line
            x1={PLOT_LEFT}
            y1={PLOT_CY}
            x2={PLOT_RIGHT}
            y2={PLOT_CY}
            className="quadrant-svg-centerline"
          />

          {/* Quadrant Labels */}
          <text
            x={PLOT_LEFT + PLOT_W * 0.25}
            y={PLOT_TOP + 22}
            textAnchor="middle"
            fill={QUADRANT_TEXT_COLOR.q2}
            className="quadrant-svg-qlabel"
          >
            {truncateText(data.quadrant2, 26)}
            <title>{data.quadrant2}</title>
          </text>
          <text
            x={PLOT_LEFT + PLOT_W * 0.75}
            y={PLOT_TOP + 22}
            textAnchor="middle"
            fill={QUADRANT_TEXT_COLOR.q1}
            className="quadrant-svg-qlabel"
          >
            {truncateText(data.quadrant1, 26)}
            <title>{data.quadrant1}</title>
          </text>
          <text
            x={PLOT_LEFT + PLOT_W * 0.25}
            y={PLOT_CY + 22}
            textAnchor="middle"
            fill={QUADRANT_TEXT_COLOR.q3}
            className="quadrant-svg-qlabel"
          >
            {truncateText(data.quadrant3, 26)}
            <title>{data.quadrant3}</title>
          </text>
          <text
            x={PLOT_LEFT + PLOT_W * 0.75}
            y={PLOT_CY + 22}
            textAnchor="middle"
            fill={QUADRANT_TEXT_COLOR.q4}
            className="quadrant-svg-qlabel"
          >
            {truncateText(data.quadrant4, 26)}
            <title>{data.quadrant4}</title>
          </text>

          {/* X Axis Labels */}
          <text
            x={PLOT_LEFT + PLOT_W * 0.25}
            y={PLOT_BOTTOM + 28}
            textAnchor="middle"
            className="quadrant-svg-axis"
          >
            {truncateText(data.xAxisLeft, 28)}
            <title>{data.xAxisLeft}</title>
          </text>
          {data.xAxisRight && (
            <text
              x={PLOT_LEFT + PLOT_W * 0.75}
              y={PLOT_BOTTOM + 28}
              textAnchor="middle"
              className="quadrant-svg-axis"
            >
              {truncateText(data.xAxisRight, 28)}
              <title>{data.xAxisRight}</title>
            </text>
          )}

          {/* Y Axis Labels (rotated on left side) */}
          <text
            x={28}
            y={PLOT_TOP + PLOT_H * 0.75}
            textAnchor="middle"
            transform={`rotate(-90 28 ${PLOT_TOP + PLOT_H * 0.75})`}
            className="quadrant-svg-axis"
          >
            {truncateText(data.yAxisBottom, 24)}
            <title>{data.yAxisBottom}</title>
          </text>
          {data.yAxisTop && (
            <text
              x={28}
              y={PLOT_TOP + PLOT_H * 0.25}
              textAnchor="middle"
              transform={`rotate(-90 28 ${PLOT_TOP + PLOT_H * 0.25})`}
              className="quadrant-svg-axis"
            >
              {truncateText(data.yAxisTop, 24)}
              <title>{data.yAxisTop}</title>
            </text>
          )}

          {/* Numeric Boundary Ticks */}
          <text x={PLOT_LEFT} y={PLOT_BOTTOM + 14} textAnchor="middle" className="quadrant-svg-tick">
            0.0
          </text>
          <text x={PLOT_CX} y={PLOT_BOTTOM + 14} textAnchor="middle" className="quadrant-svg-tick">
            0.5
          </text>
          <text x={PLOT_RIGHT} y={PLOT_BOTTOM + 14} textAnchor="middle" className="quadrant-svg-tick">
            1.0
          </text>
          <text x={PLOT_LEFT - 8} y={PLOT_BOTTOM + 4} textAnchor="end" className="quadrant-svg-tick">
            0.0
          </text>
          <text x={PLOT_LEFT - 8} y={PLOT_CY + 4} textAnchor="end" className="quadrant-svg-tick">
            0.5
          </text>
          <text x={PLOT_LEFT - 8} y={PLOT_TOP + 4} textAnchor="end" className="quadrant-svg-tick">
            1.0
          </text>

          {/* Points */}
          {data.points.map((pt) => {
            const cx = PLOT_LEFT + clamp01(pt.x) * PLOT_W;
            const cy = PLOT_BOTTOM - clamp01(pt.y) * PLOT_H;
            const isSelected = pt.id === selectedPointId;
            const visual = resolvePointVisual(pt, classMap);
            const labelOnLeft = pt.x > 0.78;
            const labelYOffset = pt.y < 0.08 ? -visual.radius - 6 : visual.radius + 14;

            return (
              <g
                key={pt.id}
                className={`quadrant-svg-point${isSelected ? ' is-selected' : ''}`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelectPoint(pt.id);
                  setDraggingId(pt.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                }}
              >
                {isSelected && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={visual.radius + 5}
                    className="quadrant-svg-point-ring"
                  />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={visual.radius}
                  fill={visual.fill}
                  stroke={visual.stroke}
                  strokeWidth={visual.strokeWidth}
                />
                <text
                  x={labelOnLeft ? cx - visual.radius - 6 : cx}
                  y={labelOnLeft ? cy + 4 : cy + labelYOffset}
                  textAnchor={labelOnLeft ? 'end' : 'middle'}
                  className="quadrant-svg-point-label"
                >
                  {truncateText(pt.label, 20)}
                  <title>{`${pt.label} [${pt.x.toFixed(2)}, ${pt.y.toFixed(2)}]`}</title>
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Quick Point Selector Pills */}
      <div className="quadrant-point-pills">
        {data.points.length === 0 ? (
          <span className="quadrant-empty-inline">{t.inspector.quadrantChart.emptyPoints}</span>
        ) : (
          data.points.map((pt) => (
            <button
              key={pt.id}
              type="button"
              className={`quadrant-point-pill${pt.id === selectedPointId ? ' is-selected' : ''}`}
              onClick={() => onSelectPoint(pt.id)}
            >
              <span className="quadrant-point-pill-label">{pt.label}</span>
              <span className="quadrant-point-pill-coords">
                {pt.x.toFixed(2)}, {pt.y.toFixed(2)}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default QuadrantCanvas;
