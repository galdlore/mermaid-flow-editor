import { ArrowDown, ArrowUp, BarChart3, Plus, Trash2, TrendingUp } from 'lucide-react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import { FORBIDDEN_XYCHART_TEXT_CHARS_REGEX } from '../utils/inputSafeguard';
import type {
  XYChartDiagramData,
  XYChartSeriesData,
  XYChartSeriesType,
} from '../types/editor';

export interface XYChartCanvasProps {
  xychartData: XYChartDiagramData;
  selectedSeriesId: string | null;
  onChange: (next: XYChartDiagramData) => void;
  onSelectSeries: (seriesId: string | null) => void;
}

const SERIES_PALETTE = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
];

function nextSeriesId(series: XYChartSeriesData[]): string {
  const used = new Set(series.map((s) => s.id));
  let num = 1;
  while (used.has(`series_${num}`)) {
    num++;
  }
  return `series_${num}`;
}

export default function XYChartCanvas({
  xychartData,
  selectedSeriesId,
  onChange,
  onSelectSeries,
}: XYChartCanvasProps) {
  const { t } = useI18n();

  const rowCount =
    xychartData.xAxisType === 'band'
      ? Math.max(
          xychartData.xAxisCategories.length,
          ...xychartData.series.map((s) => s.values.length)
        )
      : Math.max(1, ...xychartData.series.map((s) => s.values.length));

  const handleAddSeries = (type: XYChartSeriesType): void => {
    const id = nextSeriesId(xychartData.series);
    const pointLen =
      xychartData.xAxisType === 'band'
        ? Math.max(1, xychartData.xAxisCategories.length)
        : Math.max(1, rowCount);
    const defaultValue = type === 'bar' ? 100 : 50;
    const nextSeries: XYChartSeriesData = {
      id,
      type,
      title: t.inspector.xychart.defaultSeriesTitle(
        type,
        xychartData.series.length + 1
      ),
      values: Array.from({ length: pointLen }, () => defaultValue),
    };
    const nextCats =
      xychartData.xAxisType === 'band' &&
      xychartData.xAxisCategories.length === 0
        ? [t.inspector.xychart.defaultCategoryLabel(1)]
        : xychartData.xAxisCategories;
    onChange({
      ...xychartData,
      xAxisCategories: nextCats,
      series: [...xychartData.series, nextSeries],
    });
    onSelectSeries(id);
  };

  const handleAddPointOrCategory = (): void => {
    const nextCats =
      xychartData.xAxisType === 'band'
        ? [
            ...xychartData.xAxisCategories,
            t.inspector.xychart.defaultCategoryLabel(
              xychartData.xAxisCategories.length + 1
            ),
          ]
        : xychartData.xAxisCategories;

    const targetLen =
      xychartData.xAxisType === 'band' ? nextCats.length : rowCount + 1;

    const nextSeries = xychartData.series.map((s) => {
      const padded = [...s.values];
      while (padded.length < targetLen) {
        padded.push(padded[padded.length - 1] ?? 0);
      }
      return { ...s, values: padded };
    });

    onChange({
      ...xychartData,
      xAxisCategories: nextCats,
      series: nextSeries,
    });
  };

  const handleCategoryChange = (rowIdx: number, nextLabel: string): void => {
    const nextCats = [...xychartData.xAxisCategories];
    while (nextCats.length <= rowIdx) {
      nextCats.push(t.inspector.xychart.defaultCategoryLabel(nextCats.length + 1));
    }
    nextCats[rowIdx] = nextLabel;
    onChange({ ...xychartData, xAxisCategories: nextCats });
  };

  const handleMoveRow = (rowIdx: number, delta: -1 | 1): void => {
    const targetIdx = rowIdx + delta;
    if (targetIdx < 0 || targetIdx >= rowCount) {
      return;
    }

    const nextCats = [...xychartData.xAxisCategories];
    if (xychartData.xAxisType === 'band' && targetIdx < nextCats.length) {
      const tmp = nextCats[rowIdx];
      nextCats[rowIdx] = nextCats[targetIdx];
      nextCats[targetIdx] = tmp;
    }

    const nextSeries = xychartData.series.map((s) => {
      const vals = Array.from({ length: rowCount }, (_, i) => s.values[i] ?? 0);
      const tmp = vals[rowIdx];
      vals[rowIdx] = vals[targetIdx];
      vals[targetIdx] = tmp;
      return { ...s, values: vals };
    });

    onChange({
      ...xychartData,
      xAxisCategories: nextCats,
      series: nextSeries,
    });
  };

  const handleDeleteRow = (rowIdx: number): void => {
    const nextCats =
      xychartData.xAxisType === 'band'
        ? xychartData.xAxisCategories.filter((_, i) => i !== rowIdx)
        : xychartData.xAxisCategories;
    const nextSeries = xychartData.series.map((s) => ({
      ...s,
      values: s.values.filter((_, i) => i !== rowIdx),
    }));
    onChange({
      ...xychartData,
      xAxisCategories: nextCats,
      series: nextSeries,
    });
  };

  const handleCellChange = (
    seriesId: string,
    rowIdx: number,
    rawValue: string
  ): void => {
    const num = Number(rawValue);
    const safeVal = Number.isFinite(num) ? num : 0;
    onChange({
      ...xychartData,
      series: xychartData.series.map((s) => {
        if (s.id !== seriesId) {
          return s;
        }
        const vals = Array.from(
          { length: Math.max(rowCount, s.values.length) },
          (_, i) => s.values[i] ?? 0
        );
        vals[rowIdx] = safeVal;
        return { ...s, values: vals };
      }),
    });
  };

  // Compute simple SVG mini preview coordinates
  const svgW = 540;
  const svgH = 190;
  const padL = 42;
  const padR = 18;
  const padT = 20;
  const padB = 30;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const allVals = xychartData.series.flatMap((s) =>
    s.values.slice(0, Math.max(1, rowCount))
  );
  const rawMin =
    !xychartData.yAxisAutoRange && typeof xychartData.yAxisMin === 'number'
      ? xychartData.yAxisMin
      : Math.min(0, ...(allVals.length > 0 ? allVals : [0]));
  const rawMax =
    !xychartData.yAxisAutoRange && typeof xychartData.yAxisMax === 'number'
      ? xychartData.yAxisMax
      : Math.max(10, ...(allVals.length > 0 ? allVals : [10]));
  const yMin = rawMin;
  const yMax = rawMax > rawMin ? rawMax : rawMin + 10;

  const valueToY = (val: number): number => {
    const clamped = Math.min(yMax, Math.max(yMin, val));
    const ratio = (clamped - yMin) / (yMax - yMin);
    return padT + plotH * (1 - ratio);
  };

  const baseLineY = valueToY(Math.min(yMax, Math.max(yMin, 0)));
  const barSeries = xychartData.series.filter((s) => s.type === 'bar');
  const categoryStep = plotW / Math.max(1, rowCount);

  return (
    <div className="xychart-canvas-container">
      <div className="xychart-canvas-toolbar">
        <div className="xychart-toolbar-buttons">
          <button
            type="button"
            className="btn-secondary btn-xs"
            onClick={() => handleAddSeries('bar')}
          >
            <BarChart3 size={14} />
            <span>{t.inspector.xychart.addBarBtn}</span>
          </button>
          <button
            type="button"
            className="btn-secondary btn-xs"
            onClick={() => handleAddSeries('line')}
          >
            <TrendingUp size={14} />
            <span>{t.inspector.xychart.addLineBtn}</span>
          </button>
          <button
            type="button"
            className="btn-secondary btn-xs"
            onClick={handleAddPointOrCategory}
          >
            <Plus size={14} />
            <span>
              {xychartData.xAxisType === 'band'
                ? t.inspector.xychart.addCategoryBtn
                : t.inspector.xychart.addPointBtn}
            </span>
          </button>
        </div>

        <div className="xychart-series-pills">
          {xychartData.series.map((s, idx) => {
            const color = SERIES_PALETTE[idx % SERIES_PALETTE.length];
            const isSelected = s.id === selectedSeriesId;
            return (
              <button
                key={s.id}
                type="button"
                className={`xychart-series-pill ${isSelected ? 'is-selected' : ''}`}
                onClick={() => onSelectSeries(s.id)}
              >
                <span
                  className="xychart-series-dot"
                  style={{ backgroundColor: color }}
                />
                <span>
                  {s.title ||
                    t.inspector.xychart.defaultSeriesTitle(s.type, idx + 1)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {xychartData.series.length === 0 ? (
        <div className="xychart-canvas-empty">
          {t.inspector.xychart.noSeriesHint}
        </div>
      ) : (
        <div className="xychart-canvas-body">
          <div className="xychart-preview-card">
            <svg
              className="xychart-mini-svg"
              viewBox={`0 0 ${svgW} ${svgH}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Grid lines & Y ticks */}
              {[0, 0.5, 1].map((tRatio) => {
                const gy = padT + plotH * (1 - tRatio);
                const gVal = yMin + (yMax - yMin) * tRatio;
                return (
                  <g key={tRatio}>
                    <line
                      x1={padL}
                      y1={gy}
                      x2={svgW - padR}
                      y2={gy}
                      stroke="#e2e8f0"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={padL - 6}
                      y={gy + 4}
                      fontSize={10}
                      fill="#64748b"
                      textAnchor="end"
                    >
                      {Number(gVal.toFixed(1))}
                    </text>
                  </g>
                );
              })}

              <line
                x1={padL}
                y1={padT}
                x2={padL}
                y2={padT + plotH}
                stroke="#94a3b8"
              />
              <line
                x1={padL}
                y1={baseLineY}
                x2={svgW - padR}
                y2={baseLineY}
                stroke="#94a3b8"
              />

              {/* X labels */}
              {Array.from({ length: rowCount }, (_, rowIdx) => {
                const cx = padL + categoryStep * (rowIdx + 0.5);
                const label =
                  xychartData.xAxisType === 'band'
                    ? xychartData.xAxisCategories[rowIdx] ?? `${rowIdx + 1}`
                    : `${rowIdx + 1}`;
                return (
                  <text
                    key={rowIdx}
                    x={cx}
                    y={svgH - 8}
                    fontSize={10}
                    fill="#475569"
                    textAnchor="middle"
                  >
                    {label.length > 8 ? `${label.slice(0, 7)}…` : label}
                  </text>
                );
              })}

              {/* Bars */}
              {xychartData.series.map((s, seriesIdx) => {
                if (s.type !== 'bar') {
                  return null;
                }
                const color = SERIES_PALETTE[seriesIdx % SERIES_PALETTE.length];
                const barRank = barSeries.findIndex((b) => b.id === s.id);
                const groupW = Math.min(44, categoryStep * 0.72);
                const singleBarW = Math.max(
                  6,
                  groupW / Math.max(1, barSeries.length)
                );
                const isSelected = s.id === selectedSeriesId;

                return (
                  <g key={s.id} opacity={isSelected ? 1 : 0.85}>
                    {Array.from({ length: rowCount }, (_, rowIdx) => {
                      const val = s.values[rowIdx] ?? 0;
                      const cx = padL + categoryStep * (rowIdx + 0.5);
                      const x = cx - groupW / 2 + barRank * singleBarW;
                      const valY = valueToY(val);
                      const y = Math.min(valY, baseLineY);
                      const h = Math.max(2, Math.abs(baseLineY - valY));
                      return (
                        <rect
                          key={rowIdx}
                          x={x + 1}
                          y={y}
                          width={Math.max(4, singleBarW - 2)}
                          height={h}
                          rx={2}
                          fill={color}
                          stroke={isSelected ? '#0f172a' : 'none'}
                          strokeWidth={isSelected ? 1.5 : 0}
                          className="xychart-svg-interactive"
                          onClick={() => onSelectSeries(s.id)}
                        />
                      );
                    })}
                  </g>
                );
              })}

              {/* Lines */}
              {xychartData.series.map((s, seriesIdx) => {
                if (s.type !== 'line') {
                  return null;
                }
                const color = SERIES_PALETTE[seriesIdx % SERIES_PALETTE.length];
                const isSelected = s.id === selectedSeriesId;
                const points = Array.from({ length: rowCount }, (_, rowIdx) => {
                  const val = s.values[rowIdx] ?? 0;
                  const px = padL + categoryStep * (rowIdx + 0.5);
                  const py = valueToY(val);
                  return { px, py };
                });
                const polylinePoints = points
                  .map((p) => `${p.px},${p.py}`)
                  .join(' ');

                return (
                  <g key={s.id}>
                    {points.length > 1 && (
                      <polyline
                        fill="none"
                        stroke={color}
                        strokeWidth={isSelected ? 3 : 2}
                        points={polylinePoints}
                        className="xychart-svg-interactive"
                        onClick={() => onSelectSeries(s.id)}
                      />
                    )}
                    {points.map((p, idx) => (
                      <circle
                        key={idx}
                        cx={p.px}
                        cy={p.py}
                        r={isSelected ? 4.5 : 3.5}
                        fill="#ffffff"
                        stroke={color}
                        strokeWidth={2}
                        className="xychart-svg-interactive"
                        onClick={() => onSelectSeries(s.id)}
                      />
                    ))}
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="xychart-matrix-wrap">
            <table className="xychart-matrix-table">
              <thead>
                <tr>
                  <th className="xychart-col-axis">
                    {xychartData.xAxisType === 'band'
                      ? t.inspector.xychart.categoryColumnHeader
                      : t.inspector.xychart.pointColumnHeader}
                  </th>
                  {xychartData.series.map((s, idx) => {
                    const color = SERIES_PALETTE[idx % SERIES_PALETTE.length];
                    const isSelected = s.id === selectedSeriesId;
                    return (
                      <th
                        key={s.id}
                        className={`xychart-col-series ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => onSelectSeries(s.id)}
                      >
                        <div className="xychart-col-series-inner">
                          <span
                            className="xychart-series-dot"
                            style={{ backgroundColor: color }}
                          />
                          <span>
                            {s.title ||
                              t.inspector.xychart.defaultSeriesTitle(
                                s.type,
                                idx + 1
                              )}
                          </span>
                          <span className="xychart-col-type-tag">
                            {s.type === 'bar' ? 'bar' : 'line'}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                  <th className="xychart-col-actions" />
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: rowCount }, (_, rowIdx) => (
                  <tr key={rowIdx}>
                    <td>
                      {xychartData.xAxisType === 'band' ? (
                        <GuardedInput
                          value={xychartData.xAxisCategories[rowIdx] ?? ''}
                          onChangeValue={(nextVal) =>
                            handleCategoryChange(rowIdx, nextVal)
                          }
                          forbiddenRegex={FORBIDDEN_XYCHART_TEXT_CHARS_REGEX}
                          formatError={t.inspector.safeguard.xychartTextErrorChars}
                          placeholder={t.inspector.xychart.categoryPlaceholder}
                          ariaLabel={t.inspector.xychart.categoryColumnHeader}
                        />
                      ) : (
                        <span className="xychart-point-index">
                          #{rowIdx + 1}
                        </span>
                      )}
                    </td>
                    {xychartData.series.map((s) => (
                      <td
                        key={s.id}
                        className={
                          s.id === selectedSeriesId ? 'is-selected-col' : ''
                        }
                      >
                        <input
                          type="number"
                          step="any"
                          className="xychart-cell-input"
                          aria-label={`${s.title ?? s.id} #${rowIdx + 1}`}
                          value={s.values[rowIdx] ?? 0}
                          onFocus={() => onSelectSeries(s.id)}
                          onChange={(event) =>
                            handleCellChange(s.id, rowIdx, event.target.value)
                          }
                        />
                      </td>
                    ))}
                    <td>
                      <div className="lane-item-actions">
                        <button
                          type="button"
                          className="icon-btn-tiny"
                          disabled={rowIdx === 0}
                          title={t.inspector.xychart.moveUpTitle}
                          onClick={() => handleMoveRow(rowIdx, -1)}
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn-tiny"
                          disabled={rowIdx === rowCount - 1}
                          title={t.inspector.xychart.moveDownTitle}
                          onClick={() => handleMoveRow(rowIdx, 1)}
                        >
                          <ArrowDown size={12} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn-danger"
                          disabled={rowCount <= 1}
                          title={t.inspector.xychart.deleteCategoryTitle}
                          onClick={() => handleDeleteRow(rowIdx)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
