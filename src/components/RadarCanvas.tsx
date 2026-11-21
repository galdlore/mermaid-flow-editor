import { Plus } from 'lucide-react';
import { useI18n } from '../i18n';
import { allocateUniqueId } from '../utils/mermaidEnvelope';
import type { RadarDiagramData } from '../types/editor';

export interface RadarCanvasProps {
  radarData: RadarDiagramData;
  selectedCurveId: string | null;
  onChange: (next: RadarDiagramData) => void;
  onSelectCurve: (curveId: string | null) => void;
}

const CURVE_PALETTE = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#d97706',
  '#7c3aed',
  '#0891b2',
];

export default function RadarCanvas({
  radarData,
  selectedCurveId,
  onChange,
  onSelectCurve,
}: RadarCanvasProps) {
  const { t } = useI18n();
  const rd = t.inspector.radar;

  const axisCount = radarData.axes.length;
  const ticks = Math.min(32, Math.max(1, Math.round(radarData.ticks || 5)));
  const minVal = Math.max(0, radarData.min);
  const dataMax = Math.max(
    minVal + 1,
    ...radarData.curves.flatMap((c) => c.values)
  );
  const maxVal =
    radarData.max !== undefined && radarData.max > minVal
      ? radarData.max
      : dataMax;

  const cx = 210;
  const cy = 165;
  const radius = 115;

  const pointAt = (axisIdx: number, ratio: number): [number, number] => {
    const angle = (2 * Math.PI * axisIdx) / Math.max(1, axisCount) - Math.PI / 2;
    const r = radius * Math.max(0, Math.min(1, ratio));
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };

  const handleAddAxis = (): void => {
    const usedIds = new Set(radarData.axes.map((a) => a.id));
    const num = radarData.axes.length + 1;
    const id = allocateUniqueId(`axis${num}`, usedIds);
    onChange({
      ...radarData,
      axes: [...radarData.axes, { id, label: rd.defaultAxisLabel(num) }],
      curves: radarData.curves.map((c) => ({ ...c, values: [...c.values, 50] })),
    });
  };

  const handleAddCurve = (): void => {
    const usedIds = new Set(radarData.curves.map((c) => c.id));
    const num = radarData.curves.length + 1;
    const id = allocateUniqueId(`curve${num}`, usedIds);
    onChange({
      ...radarData,
      curves: [
        ...radarData.curves,
        {
          id,
          label: rd.defaultCurveLabel(num),
          values: radarData.axes.map(() => Math.round((minVal + maxVal) / 2)),
        },
      ],
    });
    onSelectCurve(id);
  };

  return (
    <div className="radar-canvas">
      <div className="systems-toolbar">
        <button
          type="button"
          className="btn-primary btn-xs"
          onClick={handleAddCurve}
        >
          <Plus size={13} />
          <span>{rd.addCurveBtn}</span>
        </button>
        <button
          type="button"
          className="btn-secondary btn-xs"
          onClick={handleAddAxis}
        >
          <Plus size={13} />
          <span>{rd.addAxisBtn}</span>
        </button>
        {(['circle', 'polygon'] as const).map((g) => (
          <button
            key={g}
            type="button"
            className={`inspector-choice-btn ${
              radarData.graticule === g ? 'is-active' : ''
            }`}
            onClick={() => onChange({ ...radarData, graticule: g })}
          >
            {g}
          </button>
        ))}
      </div>

      <div className="systems-canvas-scroll">
        {radarData.title && (
          <div className="systems-title-banner">{radarData.title}</div>
        )}

        {axisCount === 0 ? (
          <div className="systems-empty-state">{rd.emptyAxes}</div>
        ) : (
          <div className="systems-svg-board">
            <svg className="radar-svg" viewBox="0 0 420 330">
              {Array.from({ length: ticks }, (_, tIdx) => {
                const ratio = (tIdx + 1) / ticks;
                if (radarData.graticule === 'circle') {
                  return (
                    <circle
                      key={tIdx}
                      cx={cx}
                      cy={cy}
                      r={radius * ratio}
                      fill="none"
                      stroke="#cbd5e1"
                      strokeDasharray="3 3"
                    />
                  );
                }
                const pts = radarData.axes
                  .map((_, aIdx) => pointAt(aIdx, ratio).join(','))
                  .join(' ');
                return (
                  <polygon
                    key={tIdx}
                    points={pts}
                    fill="none"
                    stroke="#cbd5e1"
                  />
                );
              })}

              {radarData.axes.map((axis, aIdx) => {
                const [xEnd, yEnd] = pointAt(aIdx, 1);
                const [xLab, yLab] = pointAt(aIdx, 1.18);
                const anchor =
                  xLab < cx - 8 ? 'end' : xLab > cx + 8 ? 'start' : 'middle';
                return (
                  <g key={axis.id}>
                    <line
                      x1={cx}
                      y1={cy}
                      x2={xEnd}
                      y2={yEnd}
                      stroke="#cbd5e1"
                    />
                    <text
                      x={xLab}
                      y={yLab}
                      textAnchor={anchor}
                      dominantBaseline="central"
                      fontSize={11.5}
                      fontWeight={600}
                      fill="currentColor"
                    >
                      {axis.label}
                    </text>
                  </g>
                );
              })}

              {radarData.curves.map((curve, cIdx) => {
                const color = CURVE_PALETTE[cIdx % CURVE_PALETTE.length];
                const isSel = selectedCurveId === curve.id;
                const pts = radarData.axes
                  .map((_, aIdx) => {
                    const val = curve.values[aIdx] ?? minVal;
                    const ratio = (val - minVal) / Math.max(0.0001, maxVal - minVal);
                    return pointAt(aIdx, ratio).join(',');
                  })
                  .join(' ');
                return (
                  <polygon
                    key={curve.id}
                    points={pts}
                    fill={color}
                    fillOpacity={isSel ? 0.3 : 0.14}
                    stroke={color}
                    strokeWidth={isSel ? 3 : 1.75}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onSelectCurve(curve.id)}
                  />
                );
              })}
            </svg>

            {radarData.curves.length > 0 && (
              <div className="radar-legend-row">
                {radarData.curves.map((curve, cIdx) => {
                  const color = CURVE_PALETTE[cIdx % CURVE_PALETTE.length];
                  return (
                    <button
                      key={curve.id}
                      type="button"
                      className={`radar-legend-chip ${
                        selectedCurveId === curve.id ? 'is-selected' : ''
                      }`}
                      onClick={() => onSelectCurve(curve.id)}
                    >
                      <span
                        className="radar-swatch"
                        style={{ backgroundColor: color }}
                      />
                      <span>{curve.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
