import { AlertTriangle, ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import type { PieDiagramData, PieSliceData } from '../types/editor';

export interface PieCanvasProps {
  pieData: PieDiagramData;
  selectedSliceId: string | null;
  onChange: (next: PieDiagramData) => void;
  onSelectSlice: (sliceId: string | null) => void;
}

const SLICE_PALETTE = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
  '#f97316',
  '#6366f1',
  '#14b8a6',
  '#64748b',
];

function nextSliceId(slices: PieSliceData[]): string {
  const existing = new Set(slices.map((s) => s.id));
  let num = 1;
  while (existing.has(`slice_${num}`)) {
    num++;
  }
  return `slice_${num}`;
}

function buildArcPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number
): string {
  const sweep = endAngle - startAngle;
  if (sweep >= Math.PI * 2 - 0.0001) {
    // Full circle handled by <circle> or two semicircles
    const mid = startAngle + Math.PI;
    return [
      buildArcPath(cx, cy, outerR, innerR, startAngle, mid),
      buildArcPath(cx, cy, outerR, innerR, mid, endAngle),
    ].join(' ');
  }

  const x1 = cx + outerR * Math.cos(startAngle);
  const y1 = cy + outerR * Math.sin(startAngle);
  const x2 = cx + outerR * Math.cos(endAngle);
  const y2 = cy + outerR * Math.sin(endAngle);
  const largeArc = sweep > Math.PI ? 1 : 0;

  if (innerR <= 0) {
    return `M ${cx} ${cy} L ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  }

  const x3 = cx + innerR * Math.cos(endAngle);
  const y3 = cy + innerR * Math.sin(endAngle);
  const x4 = cx + innerR * Math.cos(startAngle);
  const y4 = cy + innerR * Math.sin(startAngle);

  return [
    `M ${x1} ${y1}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');
}

export default function PieCanvas({
  pieData,
  selectedSliceId,
  onChange,
  onSelectSlice,
}: PieCanvasProps) {
  const { t } = useI18n();

  const totalValue = pieData.slices.reduce(
    (sum, s) => sum + (Number.isFinite(s.value) ? Math.max(0, s.value) : 0),
    0
  );

  const labelCounts = new Map<string, number>();
  for (const slice of pieData.slices) {
    const key = slice.label.trim();
    labelCounts.set(key, (labelCounts.get(key) ?? 0) + 1);
  }

  const hasSmallSlice =
    totalValue > 0 &&
    pieData.slices.some((s) => {
      const pct = (Math.max(0, s.value) / totalValue) * 100;
      return pct > 0 && pct.toFixed(0) === '0';
    });

  const handleAddSlice = (): void => {
    const id = nextSliceId(pieData.slices);
    const nextSlice: PieSliceData = {
      id,
      label: t.inspector.pie.defaultSliceLabel(pieData.slices.length + 1),
      value: 10,
    };
    onChange({
      ...pieData,
      slices: [...pieData.slices, nextSlice],
    });
    onSelectSlice(id);
  };

  const handleMoveSlice = (index: number, delta: -1 | 1): void => {
    const target = index + delta;
    if (target < 0 || target >= pieData.slices.length) {
      return;
    }
    const next = [...pieData.slices];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    onChange({ ...pieData, slices: next });
  };

  const handleDeleteSlice = (sliceId: string): void => {
    const remaining = pieData.slices.filter((s) => s.id !== sliceId);
    onChange({ ...pieData, slices: remaining });
    if (selectedSliceId === sliceId) {
      onSelectSlice(remaining[0]?.id ?? null);
    }
  };

  const outerR = 96;
  const innerR =
    typeof pieData.donutHole === 'number' &&
    pieData.donutHole > 0 &&
    pieData.donutHole <= 0.9
      ? outerR * pieData.donutHole
      : 0;

  let currentAngle = -Math.PI / 2;
  const arcSlices = pieData.slices.map((slice, idx) => {
    const val = Math.max(0, slice.value);
    const ratio = totalValue > 0 ? val / totalValue : 0;
    const sweep = ratio * Math.PI * 2;
    const start = currentAngle;
    const end = currentAngle + sweep;
    currentAngle = end;
    return {
      slice,
      color: SLICE_PALETTE[idx % SLICE_PALETTE.length],
      ratio,
      pctText: `${(ratio * 100).toFixed(1).replace(/\.0$/, '')}%`,
      path: sweep > 0 ? buildArcPath(115, 115, outerR, innerR, start, end) : '',
    };
  });

  return (
    <div className="pie-canvas-container">
      <div className="pie-canvas-toolbar">
        <button
          type="button"
          className="btn-secondary btn-xs"
          onClick={handleAddSlice}
        >
          <Plus size={14} />
          <span>{t.inspector.pie.addSliceBtn}</span>
        </button>
        <div className="pie-canvas-summary">
          {pieData.title && (
            <span className="pie-canvas-title-badge">{pieData.title}</span>
          )}
          <span className="pie-canvas-total-badge">
            {t.inspector.pie.totalLabel}: {Number(totalValue.toFixed(4))}
          </span>
        </div>
      </div>

      {pieData.slices.length === 0 ? (
        <div className="pie-canvas-empty">{t.inspector.pie.noSlicesHint}</div>
      ) : (
        <div className="pie-canvas-body">
          <div className="pie-visual-card">
            <svg
              className="pie-interactive-svg"
              viewBox="0 0 230 230"
              aria-label={pieData.title || 'Pie Chart'}
            >
              {totalValue <= 0 ? (
                <circle
                  cx={115}
                  cy={115}
                  r={outerR}
                  fill="#e2e8f0"
                  stroke="#cbd5e1"
                  strokeWidth={2}
                />
              ) : (
                arcSlices.map(({ slice, color, path }) =>
                  path ? (
                    <path
                      key={slice.id}
                      d={path}
                      fill={color}
                      stroke="#ffffff"
                      strokeWidth={slice.id === selectedSliceId ? 3 : 1.5}
                      className={`pie-svg-slice ${slice.id === selectedSliceId ? 'is-selected' : ''}`}
                      onClick={() => onSelectSlice(slice.id)}
                    />
                  ) : null
                )
              )}
              {innerR > 0 && (
                <circle cx={115} cy={115} r={innerR} fill="#ffffff" />
              )}
            </svg>
            {hasSmallSlice && (
              <p className="pie-small-slice-note">
                <AlertTriangle size={13} />
                <span>{t.inspector.pie.omittedSmallSliceHint}</span>
              </p>
            )}
          </div>

          <div className="pie-slice-list-pane">
            {arcSlices.map(({ slice, color, ratio, pctText }, idx) => {
              const isSelected = slice.id === selectedSliceId;
              const isDup = (labelCounts.get(slice.label.trim()) ?? 0) > 1;
              return (
                <div
                  key={slice.id}
                  role="button"
                  tabIndex={0}
                  className={`pie-slice-row ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => onSelectSlice(slice.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelectSlice(slice.id);
                    }
                  }}
                >
                  <div className="pie-slice-row-top">
                    <span
                      className="pie-color-dot"
                      style={{ backgroundColor: color }}
                    />
                    <span className="pie-slice-row-label" title={slice.label}>
                      {slice.label}
                    </span>
                    {isDup && (
                      <span
                        className="pie-dup-indicator"
                        title={t.inspector.pie.duplicateLabelWarning}
                      >
                        <AlertTriangle size={13} />
                      </span>
                    )}
                    <span className="pie-slice-row-value">{slice.value}</span>
                    <span className="pie-slice-row-pct">{pctText}</span>
                    <div
                      className="pie-slice-row-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="icon-btn-tiny"
                        disabled={idx === 0}
                        title={t.inspector.pie.moveUpTitle}
                        onClick={() => handleMoveSlice(idx, -1)}
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn-tiny"
                        disabled={idx === pieData.slices.length - 1}
                        title={t.inspector.pie.moveDownTitle}
                        onClick={() => handleMoveSlice(idx, 1)}
                      >
                        <ArrowDown size={12} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn-danger"
                        title={t.inspector.pie.deleteSliceTitle}
                        onClick={() => handleDeleteSlice(slice.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="pie-slice-bar-track">
                    <div
                      className="pie-slice-bar-fill"
                      style={{
                        width: `${Math.min(100, Math.max(0, ratio * 100))}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
