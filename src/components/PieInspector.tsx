import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import { InspectorCollapsibleSection } from './InspectorCollapsibleSection';
import {
  InspectorBulkControls,
  InspectorCommentsSection,
} from './InspectorCommon';
import { FORBIDDEN_PIE_LABEL_CHARS_REGEX } from '../utils/inputSafeguard';
import type {
  PieDiagramData,
  PieLegendPosition,
  PieSliceData,
} from '../types/editor';

export interface PieInspectorProps {
  pieData: PieDiagramData;
  selectedSliceId: string | null;
  onChange: (next: PieDiagramData) => void;
  onSelectSlice: (sliceId: string | null) => void;
}

type PieSectionKey = 'slice' | 'slicesList' | 'settings' | 'comments';

const LEGEND_POSITION_OPTIONS: ReadonlyArray<PieLegendPosition> = [
  'right',
  'left',
  'top',
  'bottom',
  'center',
];

function nextSliceId(slices: PieSliceData[]): string {
  const existing = new Set(slices.map((s) => s.id));
  let num = 1;
  while (existing.has(`slice_${num}`)) {
    num++;
  }
  return `slice_${num}`;
}

export default function PieInspector({
  pieData,
  selectedSliceId,
  onChange,
  onSelectSlice,
}: PieInspectorProps) {
  const { t } = useI18n();
  const [openSections, setOpenSections] = useState<
    Record<PieSectionKey, boolean>
  >({
    slice: true,
    slicesList: false,
    settings: true,
    comments: false,
  });

  useEffect(() => {
    if (selectedSliceId) {
      setOpenSections((prev) => ({ ...prev, slice: true }));
    }
  }, [selectedSliceId]);

  const toggleSection = (key: PieSectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSections = (open: boolean): void => {
    setOpenSections({
      slice: open,
      slicesList: open,
      settings: open,
      comments: open,
    });
  };

  const selectedSlice =
    pieData.slices.find((s) => s.id === selectedSliceId) ?? null;

  const isSelectedLabelDuplicate = Boolean(
    selectedSlice &&
      pieData.slices.filter(
        (s) => s.label.trim() === selectedSlice.label.trim()
      ).length > 1
  );

  const updateSlice = (
    sliceId: string,
    patch: Partial<PieSliceData>
  ): void => {
    onChange({
      ...pieData,
      slices: pieData.slices.map((s) =>
        s.id === sliceId ? { ...s, ...patch } : s
      ),
    });
  };

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

  const handleDeleteSlice = (sliceId: string): void => {
    const remaining = pieData.slices.filter((s) => s.id !== sliceId);
    onChange({ ...pieData, slices: remaining });
    if (selectedSliceId === sliceId) {
      onSelectSlice(remaining[0]?.id ?? null);
    }
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

  const uniqueLabelsForHighlight = Array.from(
    new Set(pieData.slices.map((s) => s.label.trim()).filter(Boolean))
  );

  return (
    <aside className="mermaid-inspector">
      <InspectorBulkControls mode="dual" onSetAll={setAllSections} />

      <InspectorCollapsibleSection
        title={t.inspector.pie.sliceHeading}
        badgeText={pieData.slices.length}
        isOpen={openSections.slice}
        onToggle={() => toggleSection('slice')}
        headerAction={
          <button
            type="button"
            className="btn-secondary btn-xs"
            onClick={handleAddSlice}
          >
            <Plus size={14} />
            <span>{t.inspector.pie.addSliceBtn}</span>
          </button>
        }
      >
        {pieData.slices.length > 0 && (
          <div className="inspector-field">
            <label htmlFor="pie-target-slice-select">
              {t.inspector.pie.targetSliceField}
            </label>
            <select
              id="pie-target-slice-select"
              value={selectedSlice?.id ?? ''}
              onChange={(event) => onSelectSlice(event.target.value || null)}
            >
              {pieData.slices.map((slice) => (
                <option key={slice.id} value={slice.id}>
                  {slice.label} ({slice.value})
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedSlice ? (
          <div className="inspector-stack">
            <div className="inspector-field">
              <label>{t.inspector.pie.sliceLabelField}</label>
              <GuardedInput
                value={selectedSlice.label}
                onChangeValue={(nextLabel) =>
                  updateSlice(selectedSlice.id, { label: nextLabel })
                }
                forbiddenRegex={FORBIDDEN_PIE_LABEL_CHARS_REGEX}
                formatError={t.inspector.safeguard.pieLabelErrorChars}
                placeholder={t.inspector.pie.sliceLabelPlaceholder}
                ariaLabel={t.inspector.pie.sliceLabelField}
              />
              {isSelectedLabelDuplicate && (
                <p className="safeguard-error-text">
                  {t.inspector.pie.duplicateLabelWarning}
                </p>
              )}
            </div>

            <div className="inspector-field">
              <label htmlFor="pie-slice-value-input">
                {t.inspector.pie.sliceValueField}
              </label>
              <input
                id="pie-slice-value-input"
                type="number"
                min={0}
                step="any"
                value={selectedSlice.value}
                onChange={(event) => {
                  const num = Number(event.target.value);
                  updateSlice(selectedSlice.id, {
                    value: Number.isFinite(num) ? Math.max(0, num) : 0,
                  });
                }}
              />
            </div>

            <button
              type="button"
              className="btn-danger btn-full"
              onClick={() => handleDeleteSlice(selectedSlice.id)}
            >
              <Trash2 size={14} />
              <span>{t.inspector.pie.deleteSliceBtn}</span>
            </button>
          </div>
        ) : (
          <p className="inspector-hint">{t.inspector.pie.selectSliceHint}</p>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={t.inspector.pie.slicesListHeading}
        badgeText={pieData.slices.length}
        isOpen={openSections.slicesList}
        onToggle={() => toggleSection('slicesList')}
        headerAction={
          <button
            type="button"
            className="btn-secondary btn-xs"
            onClick={handleAddSlice}
          >
            <Plus size={14} />
            <span>{t.inspector.pie.addSliceBtn}</span>
          </button>
        }
      >
        {pieData.slices.length === 0 ? (
          <p className="inspector-hint">{t.inspector.pie.noSlicesHint}</p>
        ) : (
          <div className="edge-list">
            {pieData.slices.map((slice, idx) => (
              <div key={slice.id} className="edge-item-card">
                <div className="pie-inspector-slice-row">
                  <div className="pie-inspector-slice-label-wrap">
                    <GuardedInput
                      value={slice.label}
                      onChangeValue={(nextLabel) =>
                        updateSlice(slice.id, { label: nextLabel })
                      }
                      forbiddenRegex={FORBIDDEN_PIE_LABEL_CHARS_REGEX}
                      formatError={t.inspector.safeguard.pieLabelErrorChars}
                      placeholder={t.inspector.pie.sliceLabelPlaceholder}
                      ariaLabel={t.inspector.pie.sliceLabelField}
                    />
                  </div>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    className="pie-inspector-value-mini"
                    aria-label={t.inspector.pie.sliceValueField}
                    value={slice.value}
                    onChange={(event) => {
                      const num = Number(event.target.value);
                      updateSlice(slice.id, {
                        value: Number.isFinite(num) ? Math.max(0, num) : 0,
                      });
                    }}
                  />
                  <div className="lane-item-actions">
                    <button
                      type="button"
                      className="icon-btn-tiny"
                      disabled={idx === 0}
                      title={t.inspector.pie.moveUpTitle}
                      onClick={() => handleMoveSlice(idx, -1)}
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn-tiny"
                      disabled={idx === pieData.slices.length - 1}
                      title={t.inspector.pie.moveDownTitle}
                      onClick={() => handleMoveSlice(idx, 1)}
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn-danger"
                      title={t.inspector.pie.deleteSliceTitle}
                      onClick={() => handleDeleteSlice(slice.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={t.inspector.pie.settingsHeading}
        isOpen={openSections.settings}
        onToggle={() => toggleSection('settings')}
      >
        <div className="inspector-stack">
          <div className="inspector-field">
            <label>{t.inspector.pie.titleField}</label>
            <GuardedInput
              value={pieData.title ?? ''}
              onChangeValue={(nextTitle) =>
                onChange({
                  ...pieData,
                  title: nextTitle || undefined,
                })
              }
              forbiddenRegex={FORBIDDEN_PIE_LABEL_CHARS_REGEX}
              formatError={t.inspector.safeguard.pieLabelErrorChars}
              placeholder={t.inspector.pie.titlePlaceholder}
              ariaLabel={t.inspector.pie.titleField}
            />
          </div>

          <label className="inspector-checkbox-row">
            <input
              type="checkbox"
              checked={Boolean(pieData.showData)}
              onChange={(event) =>
                onChange({
                  ...pieData,
                  showData: event.target.checked || undefined,
                })
              }
            />
            <span>{t.inspector.pie.showDataField}</span>
          </label>

          <div className="inspector-field">
            <label htmlFor="pie-donut-hole-range">
              {t.inspector.pie.donutHoleField} ({(pieData.donutHole ?? 0).toFixed(2)})
            </label>
            <input
              id="pie-donut-hole-range"
              type="range"
              min={0}
              max={0.9}
              step={0.05}
              value={pieData.donutHole ?? 0}
              onChange={(event) =>
                onChange({
                  ...pieData,
                  donutHole: Number(event.target.value),
                })
              }
            />
          </div>

          <div className="inspector-field">
            <label htmlFor="pie-text-pos-range">
              {t.inspector.pie.textPositionField} (
              {(pieData.textPosition ?? 0.75).toFixed(2)})
            </label>
            <input
              id="pie-text-pos-range"
              type="range"
              min={0.1}
              max={1.0}
              step={0.05}
              value={pieData.textPosition ?? 0.75}
              onChange={(event) =>
                onChange({
                  ...pieData,
                  textPosition: Number(event.target.value),
                })
              }
            />
          </div>

          <div className="inspector-field">
            <label htmlFor="pie-legend-pos-select">
              {t.inspector.pie.legendPositionField}
            </label>
            <select
              id="pie-legend-pos-select"
              value={pieData.legendPosition ?? 'right'}
              onChange={(event) =>
                onChange({
                  ...pieData,
                  legendPosition: event.target.value as PieLegendPosition,
                })
              }
            >
              {LEGEND_POSITION_OPTIONS.map((pos) => (
                <option key={pos} value={pos}>
                  {t.inspector.pie.legendPositions[pos]}
                </option>
              ))}
            </select>
          </div>

          <div className="inspector-field">
            <label htmlFor="pie-highlight-slice-select">
              {t.inspector.pie.highlightSliceField}
            </label>
            <select
              id="pie-highlight-slice-select"
              value={pieData.highlightSlice ?? ''}
              onChange={(event) =>
                onChange({
                  ...pieData,
                  highlightSlice: event.target.value || undefined,
                })
              }
            >
              <option value="">{t.inspector.pie.highlightOptions.none}</option>
              <option value="hover">
                {t.inspector.pie.highlightOptions.hover}
              </option>
              {uniqueLabelsForHighlight.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </InspectorCollapsibleSection>

      <InspectorCommentsSection
        title={t.inspector.commentsHeading}
        placeholder={t.inspector.commentsPlaceholder}
        comments={pieData.comments}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
        rows={4}
        onChangeComments={(nextComments) =>
          onChange({
            ...pieData,
            comments: nextComments,
          })
        }
      />
    </aside>
  );
}
