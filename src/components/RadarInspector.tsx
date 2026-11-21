import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import { InspectorCollapsibleSection } from './InspectorCollapsibleSection';
import {
  CommitIdInput,
  InspectorBulkControls,
  InspectorCommentsSection,
} from './InspectorCommon';
import {
  FORBIDDEN_INFO_TEXT_CHARS_REGEX,
  FORBIDDEN_RADAR_ID_CHARS_REGEX,
  FORBIDDEN_RADAR_TEXT_CHARS_REGEX,
} from '../utils/inputSafeguard';
import { allocateUniqueId } from '../utils/mermaidEnvelope';
import { sanitizeRadarId } from '../utils/radarConverter';
import type {
  RadarCurveData,
  RadarDiagramData,
  RadarGraticule,
} from '../types/editor';

export interface RadarInspectorProps {
  radarData: RadarDiagramData;
  selectedCurveId: string | null;
  onChange: (next: RadarDiagramData) => void;
  onSelectCurve: (curveId: string | null) => void;
}

type RadarSectionKey = 'curve' | 'axes' | 'chartOptions' | 'comments';

export default function RadarInspector({
  radarData,
  selectedCurveId,
  onChange,
  onSelectCurve,
}: RadarInspectorProps) {
  const { t } = useI18n();
  const rd = t.inspector.radar;
  const safeguard = t.inspector.safeguard;

  const selectedCurve =
    radarData.curves.find((c) => c.id === selectedCurveId) ?? null;

  const [openSections, setOpenSections] = useState<
    Record<RadarSectionKey, boolean>
  >({
    curve: true,
    axes: false,
    chartOptions: false,
    comments: false,
  });

  useEffect(() => {
    if (selectedCurveId) {
      setOpenSections((prev) => (prev.curve ? prev : { ...prev, curve: true }));
    }
  }, [selectedCurveId]);

  const toggleSection = (key: RadarSectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSections = (open: boolean): void => {
    setOpenSections({
      curve: open,
      axes: open,
      chartOptions: open,
      comments: open,
    });
  };

  const allExpanded = Object.values(openSections).every(Boolean);

  const updateCurve = (patch: Partial<RadarCurveData>): void => {
    if (!selectedCurve) return;
    onChange({
      ...radarData,
      curves: radarData.curves.map((c) =>
        c.id === selectedCurve.id ? { ...c, ...patch } : c
      ),
    });
  };

  const handleRenameCurveId = (rawNext: string): string => {
    if (!selectedCurve) return '';
    const candidate = sanitizeRadarId(rawNext, '');
    if (!candidate) return selectedCurve.id;
    if (
      candidate !== selectedCurve.id &&
      radarData.curves.some((c) => c.id === candidate)
    ) {
      return selectedCurve.id;
    }
    onChange({
      ...radarData,
      curves: radarData.curves.map((c) =>
        c.id === selectedCurve.id ? { ...c, id: candidate } : c
      ),
    });
    onSelectCurve(candidate);
    return candidate;
  };

  const handleMoveAxis = (idx: number, delta: -1 | 1): void => {
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= radarData.axes.length) return;
    const nextAxes = [...radarData.axes];
    const [movedAxis] = nextAxes.splice(idx, 1);
    nextAxes.splice(nextIdx, 0, movedAxis);
    const nextCurves = radarData.curves.map((c) => {
      const vals = radarData.axes.map((_, i) => c.values[i] ?? 0);
      const [movedVal] = vals.splice(idx, 1);
      vals.splice(nextIdx, 0, movedVal);
      return { ...c, values: vals };
    });
    onChange({ ...radarData, axes: nextAxes, curves: nextCurves });
  };

  const handleDeleteAxis = (idx: number): void => {
    const nextAxes = radarData.axes.filter((_, i) => i !== idx);
    const nextCurves = radarData.curves.map((c) => ({
      ...c,
      values: c.values.filter((_, i) => i !== idx),
    }));
    onChange({ ...radarData, axes: nextAxes, curves: nextCurves });
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

  return (
    <div className="inspector-panel">
      <InspectorBulkControls allExpanded={allExpanded} onSetAll={setAllSections} />

      <InspectorCollapsibleSection
        title={rd.curveSection}
        isOpen={openSections.curve}
        onToggle={() => toggleSection('curve')}
      >
        {selectedCurve ? (
          <>
            <CommitIdInput
              label={rd.curveIdField}
              value={selectedCurve.id}
              placeholder={rd.curveIdPlaceholder}
              hint={rd.curveIdHint}
              forbiddenRegex={FORBIDDEN_RADAR_ID_CHARS_REGEX}
              formatError={safeguard.radarIdErrorChars}
              onCommit={handleRenameCurveId}
            />

            <label className="inspector-field">
              <span>{rd.curveLabelField}</span>
              <GuardedInput
                value={selectedCurve.label}
                placeholder={rd.curveLabelPlaceholder}
                forbiddenRegex={FORBIDDEN_RADAR_TEXT_CHARS_REGEX}
                formatError={safeguard.radarTextErrorChars}
                onChangeValue={(label) => updateCurve({ label })}
              />
            </label>

            <div className="systems-section-heading">{rd.curveValuesHeading}</div>
            {radarData.axes.map((axis, aIdx) => (
              <label key={axis.id} className="inspector-field">
                <span>
                  {axis.label} ({axis.id})
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={selectedCurve.values[aIdx] ?? 0}
                  onChange={(e) => {
                    const num = Number(e.target.value);
                    const nextVal = Number.isFinite(num) && num >= 0 ? num : 0;
                    const nextValues = radarData.axes.map((_, i) =>
                      i === aIdx ? nextVal : (selectedCurve.values[i] ?? 0)
                    );
                    updateCurve({ values: nextValues });
                  }}
                />
              </label>
            ))}

            <button
              type="button"
              className="btn-danger-outline"
              onClick={() => {
                const next = radarData.curves.filter(
                  (c) => c.id !== selectedCurve.id
                );
                onChange({ ...radarData, curves: next });
                onSelectCurve(next[0]?.id ?? null);
              }}
            >
              <Trash2 size={14} />
              <span>{rd.deleteCurveBtn}</span>
            </button>
          </>
        ) : (
          <p className="inspector-hint">{rd.selectCurvePrompt}</p>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={rd.axesSection}
        isOpen={openSections.axes}
        onToggle={() => toggleSection('axes')}
      >
        <div className="timeline-events-heading-row">
          <span />
          <button
            type="button"
            className="btn-secondary btn-xs"
            onClick={handleAddAxis}
          >
            <Plus size={12} />
            <span>{rd.addAxisBtn}</span>
          </button>
        </div>
        {radarData.axes.length === 0 ? (
          <p className="inspector-hint">{rd.emptyAxes}</p>
        ) : (
          <div className="timeline-events-editor">
            {radarData.axes.map((axis, idx) => (
              <div key={axis.id} className="inspector-list-card">
                <CommitIdInput
                  label={rd.axisIdField}
                  value={axis.id}
                  placeholder={rd.axisIdPlaceholder}
                  forbiddenRegex={FORBIDDEN_RADAR_ID_CHARS_REGEX}
                  formatError={safeguard.radarIdErrorChars}
                  onCommit={(raw) => {
                    const candidate = sanitizeRadarId(raw, '');
                    if (!candidate) return axis.id;
                    if (
                      candidate !== axis.id &&
                      radarData.axes.some((a) => a.id === candidate)
                    ) {
                      return axis.id;
                    }
                    onChange({
                      ...radarData,
                      axes: radarData.axes.map((a, i) =>
                        i === idx ? { ...a, id: candidate } : a
                      ),
                    });
                    return candidate;
                  }}
                />
                <label className="inspector-field">
                  <span>{rd.axisLabelField}</span>
                  <GuardedInput
                    value={axis.label}
                    placeholder={rd.axisLabelPlaceholder}
                    forbiddenRegex={FORBIDDEN_RADAR_TEXT_CHARS_REGEX}
                    formatError={safeguard.radarTextErrorChars}
                    onChangeValue={(label) =>
                      onChange({
                        ...radarData,
                        axes: radarData.axes.map((a, i) =>
                          i === idx ? { ...a, label } : a
                        ),
                      })
                    }
                  />
                </label>
                <div className="timeline-events-heading-row">
                  <button
                    type="button"
                    className="btn-icon-subtle"
                    title={rd.moveAxisUpTitle}
                    disabled={idx === 0}
                    onClick={() => handleMoveAxis(idx, -1)}
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    type="button"
                    className="btn-icon-subtle"
                    title={rd.moveAxisDownTitle}
                    disabled={idx === radarData.axes.length - 1}
                    onClick={() => handleMoveAxis(idx, 1)}
                  >
                    <ArrowDown size={12} />
                  </button>
                  <button
                    type="button"
                    className="btn-icon-subtle is-danger"
                    title={rd.deleteAxisTitle}
                    onClick={() => handleDeleteAxis(idx)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={rd.chartOptionsSection}
        isOpen={openSections.chartOptions}
        onToggle={() => toggleSection('chartOptions')}
      >
        <label className="inspector-field">
          <span>{rd.titleField}</span>
          <GuardedInput
            value={radarData.title ?? ''}
            placeholder={rd.titlePlaceholder}
            forbiddenRegex={FORBIDDEN_INFO_TEXT_CHARS_REGEX}
            formatError={safeguard.infoTextErrorChars}
            onChangeValue={(val) =>
              onChange({ ...radarData, title: val || undefined })
            }
          />
        </label>

        <label className="inspector-checkbox-row">
          <input
            type="checkbox"
            checked={radarData.showLegend}
            onChange={(e) =>
              onChange({ ...radarData, showLegend: e.target.checked })
            }
          />
          <span>{rd.showLegendField}</span>
        </label>

        <label className="inspector-field">
          <span>{rd.ticksField}</span>
          <input
            type="number"
            min={1}
            max={32}
            step={1}
            value={radarData.ticks}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              onChange({
                ...radarData,
                ticks: Number.isFinite(n) ? Math.min(32, Math.max(1, n)) : 5,
              });
            }}
          />
        </label>

        <label className="inspector-field">
          <span>{rd.minField}</span>
          <input
            type="number"
            min={0}
            step={1}
            value={radarData.min}
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange({
                ...radarData,
                min: Number.isFinite(n) && n >= 0 ? n : 0,
              });
            }}
          />
        </label>

        <label className="inspector-field">
          <span>{rd.maxField}</span>
          <input
            type="number"
            min={0}
            step={1}
            value={radarData.max ?? ''}
            onChange={(e) => {
              if (e.target.value.trim() === '') {
                onChange({ ...radarData, max: undefined });
                return;
              }
              const n = Number(e.target.value);
              onChange({
                ...radarData,
                max: Number.isFinite(n) && n >= 0 ? n : undefined,
              });
            }}
          />
          <p className="inspector-hint">{rd.maxAutoHint}</p>
        </label>

        <label className="inspector-field">
          <span>{rd.graticuleField}</span>
          <select
            value={radarData.graticule}
            onChange={(e) =>
              onChange({
                ...radarData,
                graticule: e.target.value as RadarGraticule,
              })
            }
          >
            <option value="circle">{rd.graticules.circle}</option>
            <option value="polygon">{rd.graticules.polygon}</option>
          </select>
        </label>
      </InspectorCollapsibleSection>

      <InspectorCommentsSection
        title={rd.commentsSection}
        fieldLabel={rd.commentsField}
        placeholder={rd.commentsPlaceholder}
        comments={radarData.comments}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
        onChangeComments={(comments) => onChange({ ...radarData, comments })}
      />
    </div>
  );
}
