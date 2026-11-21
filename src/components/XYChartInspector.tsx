import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import { InspectorCollapsibleSection } from './InspectorCollapsibleSection';
import {
  InspectorBulkControls,
  InspectorCommentsSection,
} from './InspectorCommon';
import { FORBIDDEN_XYCHART_TEXT_CHARS_REGEX } from '../utils/inputSafeguard';
import type {
  XYChartDiagramData,
  XYChartOrientation,
  XYChartSeriesData,
  XYChartSeriesType,
  XYChartXAxisType,
} from '../types/editor';

export interface XYChartInspectorProps {
  xychartData: XYChartDiagramData;
  selectedSeriesId: string | null;
  onChange: (next: XYChartDiagramData) => void;
  onSelectSeries: (seriesId: string | null) => void;
}

type XYChartSectionKey = 'series' | 'axes' | 'settings' | 'comments';

function nextSeriesId(series: XYChartSeriesData[]): string {
  const used = new Set(series.map((s) => s.id));
  let num = 1;
  while (used.has(`series_${num}`)) {
    num++;
  }
  return `series_${num}`;
}

export default function XYChartInspector({
  xychartData,
  selectedSeriesId,
  onChange,
  onSelectSeries,
}: XYChartInspectorProps) {
  const { t } = useI18n();
  const [openSections, setOpenSections] = useState<
    Record<XYChartSectionKey, boolean>
  >({
    series: true,
    axes: true,
    settings: false,
    comments: false,
  });
  const [csvDraft, setCsvDraft] = useState('');

  const selectedSeries =
    xychartData.series.find((s) => s.id === selectedSeriesId) ?? null;

  useEffect(() => {
    if (selectedSeries) {
      setOpenSections((prev) => ({ ...prev, series: true }));
      setCsvDraft(selectedSeries.values.join(', '));
    } else {
      setCsvDraft('');
    }
  }, [selectedSeries?.id, selectedSeries?.values.join(',')]);

  const toggleSection = (key: XYChartSectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSections = (open: boolean): void => {
    setOpenSections({
      series: open,
      axes: open,
      settings: open,
      comments: open,
    });
  };

  const updateSeries = (
    seriesId: string,
    patch: Partial<XYChartSeriesData>
  ): void => {
    onChange({
      ...xychartData,
      series: xychartData.series.map((s) =>
        s.id === seriesId ? { ...s, ...patch } : s
      ),
    });
  };

  const handleAddSeries = (): void => {
    const id = nextSeriesId(xychartData.series);
    const pointLen = Math.max(
      1,
      xychartData.xAxisType === 'band'
        ? xychartData.xAxisCategories.length
        : Math.max(...xychartData.series.map((s) => s.values.length), 1)
    );
    const nextSeries: XYChartSeriesData = {
      id,
      type: 'bar',
      title: t.inspector.xychart.defaultSeriesTitle(
        'bar',
        xychartData.series.length + 1
      ),
      values: Array.from({ length: pointLen }, () => 100),
    };
    onChange({
      ...xychartData,
      series: [...xychartData.series, nextSeries],
    });
    onSelectSeries(id);
  };

  const handleDeleteSeries = (seriesId: string): void => {
    const remaining = xychartData.series.filter((s) => s.id !== seriesId);
    onChange({ ...xychartData, series: remaining });
    if (selectedSeriesId === seriesId) {
      onSelectSeries(remaining[0]?.id ?? null);
    }
  };

  return (
    <aside className="mermaid-inspector">
      <InspectorBulkControls mode="dual" onSetAll={setAllSections} />

      <InspectorCollapsibleSection
        title={t.inspector.xychart.seriesHeading}
        badgeText={xychartData.series.length}
        isOpen={openSections.series}
        onToggle={() => toggleSection('series')}
        headerAction={
          <button
            type="button"
            className="btn-secondary btn-xs"
            onClick={handleAddSeries}
          >
            <Plus size={14} />
            <span>{t.inspector.xychart.addBarBtn}</span>
          </button>
        }
      >
        {xychartData.series.length > 0 && (
          <div className="inspector-field">
            <label htmlFor="xychart-target-series-select">
              {t.inspector.xychart.targetSeriesField}
            </label>
            <select
              id="xychart-target-series-select"
              value={selectedSeries?.id ?? ''}
              onChange={(event) => onSelectSeries(event.target.value || null)}
            >
              {xychartData.series.map((s, idx) => (
                <option key={s.id} value={s.id}>
                  [{s.type}] {s.title || t.inspector.xychart.defaultSeriesTitle(s.type, idx + 1)}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedSeries ? (
          <div className="inspector-stack">
            <div className="inspector-field">
              <label htmlFor="xychart-series-type-select">
                {t.inspector.xychart.seriesTypeField}
              </label>
              <select
                id="xychart-series-type-select"
                value={selectedSeries.type}
                onChange={(event) =>
                  updateSeries(selectedSeries.id, {
                    type: event.target.value as XYChartSeriesType,
                  })
                }
              >
                <option value="bar">
                  {t.inspector.xychart.seriesTypes.bar}
                </option>
                <option value="line">
                  {t.inspector.xychart.seriesTypes.line}
                </option>
              </select>
            </div>

            <div className="inspector-field">
              <label>{t.inspector.xychart.seriesTitleField}</label>
              <GuardedInput
                value={selectedSeries.title ?? ''}
                onChangeValue={(nextTitle) =>
                  updateSeries(selectedSeries.id, {
                    title: nextTitle || undefined,
                  })
                }
                forbiddenRegex={FORBIDDEN_XYCHART_TEXT_CHARS_REGEX}
                formatError={t.inspector.safeguard.xychartTextErrorChars}
                placeholder={t.inspector.xychart.seriesTitlePlaceholder}
                ariaLabel={t.inspector.xychart.seriesTitleField}
              />
            </div>

            <div className="inspector-field">
              <label htmlFor="xychart-series-values-csv">
                {t.inspector.xychart.valuesCsvField}
              </label>
              <input
                id="xychart-series-values-csv"
                type="text"
                value={csvDraft}
                onChange={(event) => {
                  const raw = event.target.value;
                  setCsvDraft(raw);
                  const nums = raw
                    .split(',')
                    .map((token) => token.trim())
                    .filter((token) => token !== '' && token !== '-' && token !== '+')
                    .map((token) => Number(token))
                    .filter((n) => Number.isFinite(n));
                  if (nums.length > 0) {
                    updateSeries(selectedSeries.id, { values: nums });
                  }
                }}
              />
            </div>

            <button
              type="button"
              className="btn-danger btn-full"
              onClick={() => handleDeleteSeries(selectedSeries.id)}
            >
              <Trash2 size={14} />
              <span>{t.inspector.xychart.deleteSeriesBtn}</span>
            </button>
          </div>
        ) : (
          <p className="inspector-hint">{t.inspector.xychart.selectSeriesHint}</p>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={t.inspector.xychart.axesHeading}
        isOpen={openSections.axes}
        onToggle={() => toggleSection('axes')}
      >
        <div className="inspector-stack">
          <p className="inspector-hint">{t.inspector.xychart.autoQuoteHint}</p>

          <div className="inspector-field">
            <label htmlFor="xychart-orientation-select">
              {t.inspector.xychart.orientationField}
            </label>
            <select
              id="xychart-orientation-select"
              value={xychartData.orientation}
              onChange={(event) =>
                onChange({
                  ...xychartData,
                  orientation: event.target.value as XYChartOrientation,
                })
              }
            >
              <option value="vertical">
                {t.inspector.xychart.orientations.vertical}
              </option>
              <option value="horizontal">
                {t.inspector.xychart.orientations.horizontal}
              </option>
            </select>
          </div>

          <div className="inspector-field">
            <label>{t.inspector.xychart.chartTitleField}</label>
            <GuardedInput
              value={xychartData.title ?? ''}
              onChangeValue={(nextVal) =>
                onChange({ ...xychartData, title: nextVal || undefined })
              }
              forbiddenRegex={FORBIDDEN_XYCHART_TEXT_CHARS_REGEX}
              formatError={t.inspector.safeguard.xychartTextErrorChars}
              placeholder={t.inspector.xychart.chartTitlePlaceholder}
              ariaLabel={t.inspector.xychart.chartTitleField}
            />
          </div>

          <div className="inspector-field">
            <label>{t.inspector.xychart.xAxisTitleField}</label>
            <GuardedInput
              value={xychartData.xAxisTitle ?? ''}
              onChangeValue={(nextVal) =>
                onChange({ ...xychartData, xAxisTitle: nextVal || undefined })
              }
              forbiddenRegex={FORBIDDEN_XYCHART_TEXT_CHARS_REGEX}
              formatError={t.inspector.safeguard.xychartTextErrorChars}
              placeholder={t.inspector.xychart.xAxisTitlePlaceholder}
              ariaLabel={t.inspector.xychart.xAxisTitleField}
            />
          </div>

          <div className="inspector-field">
            <label htmlFor="xychart-xaxis-type-select">
              {t.inspector.xychart.xAxisTypeField}
            </label>
            <select
              id="xychart-xaxis-type-select"
              value={xychartData.xAxisType}
              onChange={(event) =>
                onChange({
                  ...xychartData,
                  xAxisType: event.target.value as XYChartXAxisType,
                  xAxisMin: xychartData.xAxisMin ?? 1,
                  xAxisMax:
                    xychartData.xAxisMax ??
                    Math.max(2, xychartData.xAxisCategories.length),
                })
              }
            >
              <option value="band">
                {t.inspector.xychart.xAxisTypes.band}
              </option>
              <option value="linear">
                {t.inspector.xychart.xAxisTypes.linear}
              </option>
            </select>
          </div>

          {xychartData.xAxisType === 'linear' && (
            <div className="xychart-range-row">
              <div className="inspector-field">
                <label htmlFor="xychart-xmin-input">
                  {t.inspector.xychart.xAxisMinField}
                </label>
                <input
                  id="xychart-xmin-input"
                  type="number"
                  step="any"
                  value={xychartData.xAxisMin ?? 1}
                  onChange={(event) => {
                    const n = Number(event.target.value);
                    onChange({
                      ...xychartData,
                      xAxisMin: Number.isFinite(n) ? n : 1,
                    });
                  }}
                />
              </div>
              <div className="inspector-field">
                <label htmlFor="xychart-xmax-input">
                  {t.inspector.xychart.xAxisMaxField}
                </label>
                <input
                  id="xychart-xmax-input"
                  type="number"
                  step="any"
                  value={xychartData.xAxisMax ?? 10}
                  onChange={(event) => {
                    const n = Number(event.target.value);
                    onChange({
                      ...xychartData,
                      xAxisMax: Number.isFinite(n) ? n : 10,
                    });
                  }}
                />
              </div>
            </div>
          )}

          <div className="inspector-field">
            <label>{t.inspector.xychart.yAxisTitleField}</label>
            <GuardedInput
              value={xychartData.yAxisTitle ?? ''}
              onChangeValue={(nextVal) =>
                onChange({ ...xychartData, yAxisTitle: nextVal || undefined })
              }
              forbiddenRegex={FORBIDDEN_XYCHART_TEXT_CHARS_REGEX}
              formatError={t.inspector.safeguard.xychartTextErrorChars}
              placeholder={t.inspector.xychart.yAxisTitlePlaceholder}
              ariaLabel={t.inspector.xychart.yAxisTitleField}
            />
          </div>

          <label className="inspector-checkbox-row">
            <input
              type="checkbox"
              checked={Boolean(xychartData.yAxisAutoRange)}
              onChange={(event) =>
                onChange({
                  ...xychartData,
                  yAxisAutoRange: event.target.checked,
                  yAxisMin: xychartData.yAxisMin ?? 0,
                  yAxisMax: xychartData.yAxisMax ?? 100,
                })
              }
            />
            <span>{t.inspector.xychart.yAxisAutoRangeField}</span>
          </label>

          {!xychartData.yAxisAutoRange && (
            <div className="xychart-range-row">
              <div className="inspector-field">
                <label htmlFor="xychart-ymin-input">
                  {t.inspector.xychart.yAxisMinField}
                </label>
                <input
                  id="xychart-ymin-input"
                  type="number"
                  step="any"
                  value={xychartData.yAxisMin ?? 0}
                  onChange={(event) => {
                    const n = Number(event.target.value);
                    onChange({
                      ...xychartData,
                      yAxisMin: Number.isFinite(n) ? n : 0,
                    });
                  }}
                />
              </div>
              <div className="inspector-field">
                <label htmlFor="xychart-ymax-input">
                  {t.inspector.xychart.yAxisMaxField}
                </label>
                <input
                  id="xychart-ymax-input"
                  type="number"
                  step="any"
                  value={xychartData.yAxisMax ?? 100}
                  onChange={(event) => {
                    const n = Number(event.target.value);
                    onChange({
                      ...xychartData,
                      yAxisMax: Number.isFinite(n) ? n : 100,
                    });
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={t.inspector.xychart.settingsHeading}
        isOpen={openSections.settings}
        onToggle={() => toggleSection('settings')}
      >
        <div className="inspector-stack">
          <label className="inspector-checkbox-row">
            <input
              type="checkbox"
              checked={Boolean(xychartData.showDataLabel)}
              onChange={(event) =>
                onChange({
                  ...xychartData,
                  showDataLabel: event.target.checked || undefined,
                })
              }
            />
            <span>{t.inspector.xychart.showDataLabelField}</span>
          </label>

          {xychartData.showDataLabel && (
            <label className="inspector-checkbox-row">
              <input
                type="checkbox"
                checked={Boolean(xychartData.showDataLabelOutsideBar)}
                onChange={(event) =>
                  onChange({
                    ...xychartData,
                    showDataLabelOutsideBar: event.target.checked || undefined,
                  })
                }
              />
              <span>{t.inspector.xychart.showDataLabelOutsideBarField}</span>
            </label>
          )}

          <div className="xychart-range-row">
            <div className="inspector-field">
              <label htmlFor="xychart-width-input">
                {t.inspector.xychart.chartWidthField}
              </label>
              <input
                id="xychart-width-input"
                type="number"
                min={300}
                max={2000}
                step={20}
                value={xychartData.chartWidth ?? 700}
                onChange={(event) => {
                  const raw = event.target.value.trim();
                  if (!raw) {
                    onChange({ ...xychartData, chartWidth: undefined });
                    return;
                  }
                  const n = Number(raw);
                  if (Number.isFinite(n)) {
                    onChange({
                      ...xychartData,
                      chartWidth: Math.min(2000, Math.max(300, Math.round(n))),
                    });
                  }
                }}
              />
            </div>

            <div className="inspector-field">
              <label htmlFor="xychart-height-input">
                {t.inspector.xychart.chartHeightField}
              </label>
              <input
                id="xychart-height-input"
                type="number"
                min={240}
                max={1600}
                step={20}
                value={xychartData.chartHeight ?? 500}
                onChange={(event) => {
                  const raw = event.target.value.trim();
                  if (!raw) {
                    onChange({ ...xychartData, chartHeight: undefined });
                    return;
                  }
                  const n = Number(raw);
                  if (Number.isFinite(n)) {
                    onChange({
                      ...xychartData,
                      chartHeight: Math.min(1600, Math.max(240, Math.round(n))),
                    });
                  }
                }}
              />
            </div>
          </div>
        </div>
      </InspectorCollapsibleSection>

      <InspectorCommentsSection
        title={t.inspector.commentsHeading}
        placeholder={t.inspector.commentsPlaceholder}
        comments={xychartData.comments}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
        rows={4}
        onChangeComments={(nextComments) =>
          onChange({
            ...xychartData,
            comments: nextComments,
          })
        }
      />
    </aside>
  );
}
