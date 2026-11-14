import React, { useState } from 'react';
import { useI18n } from '../i18n';
import type {
  QuadrantClassDefData,
  QuadrantDiagramData,
  QuadrantPointData,
} from '../types/editor';
import {
  FORBIDDEN_QUADRANT_CLASS_CHARS_REGEX,
  FORBIDDEN_QUADRANT_TEXT_CHARS_REGEX,
} from '../utils/inputSafeguard';
import GuardedInput from './GuardedInput';

interface QuadrantInspectorProps {
  data: QuadrantDiagramData;
  selectedPointId: string | null;
  onSelectPoint: (pointId: string | null) => void;
  onChange: (nextData: QuadrantDiagramData) => void;
}

type SectionKey = 'point' | 'quadrants' | 'classes' | 'settings' | 'comments';

function clampCoord(val: number): number {
  if (!Number.isFinite(val)) return 0.5;
  return Math.max(0, Math.min(1, Math.round(val * 100) / 100));
}

function normalizeOptionalNumber(raw: string, min: number, max: number): number | undefined {
  if (raw.trim() === '') return undefined;
  const num = Number(raw);
  if (!Number.isFinite(num)) return undefined;
  return Math.max(min, Math.min(max, Math.round(num)));
}

export const QuadrantInspector: React.FC<QuadrantInspectorProps> = ({
  data,
  selectedPointId,
  onSelectPoint,
  onChange,
}) => {
  const { t } = useI18n();
  const qText = t.inspector.quadrantChart;

  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    point: true,
    quadrants: true,
    classes: false,
    settings: false,
    comments: false,
  });

  const toggleSection = (key: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedPoint = data.points.find((pt) => pt.id === selectedPointId) ?? null;

  const updateSelectedPoint = (patch: Partial<QuadrantPointData>) => {
    if (!selectedPoint) return;
    onChange({
      ...data,
      points: data.points.map((pt) => (pt.id === selectedPoint.id ? { ...pt, ...patch } : pt)),
    });
  };

  const handleDeleteSelectedPoint = () => {
    if (!selectedPoint) return;
    const nextPoints = data.points.filter((pt) => pt.id !== selectedPoint.id);
    onChange({ ...data, points: nextPoints });
    onSelectPoint(nextPoints[0]?.id ?? null);
  };

  const handleAddClassDef = () => {
    const existing = data.classDefs ?? [];
    const existingNames = new Set(existing.map((c) => c.name));
    let idx = existing.length + 1;
    let candidate = qText.defaultClassName(idx);
    while (existingNames.has(candidate)) {
      idx += 1;
      candidate = qText.defaultClassName(idx);
    }
    const nextClass: QuadrantClassDefData = {
      name: candidate,
      color: '#ef4444',
      radius: 8,
    };
    onChange({
      ...data,
      classDefs: [...existing, nextClass],
    });
  };

  const updateClassDef = (index: number, patch: Partial<QuadrantClassDefData>) => {
    const existing = data.classDefs ?? [];
    const target = existing[index];
    if (!target) return;

    const oldName = target.name;
    const nextName = patch.name ?? oldName;
    const nextClasses = existing.map((cls, i) => (i === index ? { ...cls, ...patch } : cls));

    // Rename references in points if the class name changed
    const nextPoints =
      nextName !== oldName
        ? data.points.map((pt) => (pt.className === oldName ? { ...pt, className: nextName } : pt))
        : data.points;

    onChange({
      ...data,
      classDefs: nextClasses,
      points: nextPoints,
    });
  };

  const handleDeleteClassDef = (index: number) => {
    const existing = data.classDefs ?? [];
    const target = existing[index];
    if (!target) return;
    const nextClasses = existing.filter((_, i) => i !== index);
    const nextPoints = data.points.map((pt) =>
      pt.className === target.name ? { ...pt, className: undefined } : pt
    );
    onChange({
      ...data,
      classDefs: nextClasses.length > 0 ? nextClasses : undefined,
      points: nextPoints,
    });
  };

  const formatTextError = (chars: string[]) => t.inspector.safeguard.quadrantTextErrorChars(chars);
  const formatClassError = (chars: string[]) => t.inspector.safeguard.quadrantClassErrorChars(chars);

  return (
    <div className="inspector-body quadrant-inspector-body">
      {/* 1. Selected Point Section */}
      <div className="quadrant-section">
        <button
          type="button"
          className="quadrant-section-header"
          onClick={() => toggleSection('point')}
        >
          <span>{qText.pointSection}</span>
          <span className="quadrant-section-chevron">{openSections.point ? '▼' : '▶'}</span>
        </button>

        {openSections.point && (
          <div className="quadrant-section-body">
            {!selectedPoint ? (
              <p className="quadrant-empty-msg">
                {data.points.length === 0 ? qText.emptyPoints : qText.selectPointHint}
              </p>
            ) : (
              <>
                <div className="field-group">
                  <label className="field-label">{qText.pointLabelField}</label>
                  <GuardedInput
                    value={selectedPoint.label}
                    onChangeValue={(val) => updateSelectedPoint({ label: val })}
                    forbiddenRegex={FORBIDDEN_QUADRANT_TEXT_CHARS_REGEX}
                    formatError={formatTextError}
                    className="field-input"
                  />
                </div>

                <div className="quadrant-coord-row">
                  <div className="field-group">
                    <label className="field-label">{qText.pointXField}</label>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={selectedPoint.x}
                      onChange={(e) =>
                        updateSelectedPoint({ x: clampCoord(parseFloat(e.target.value)) })
                      }
                      className="field-input"
                    />
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={selectedPoint.x}
                      onChange={(e) =>
                        updateSelectedPoint({ x: clampCoord(parseFloat(e.target.value)) })
                      }
                      className="quadrant-range"
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">{qText.pointYField}</label>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.01}
                      value={selectedPoint.y}
                      onChange={(e) =>
                        updateSelectedPoint({ y: clampCoord(parseFloat(e.target.value)) })
                      }
                      className="field-input"
                    />
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={selectedPoint.y}
                      onChange={(e) =>
                        updateSelectedPoint({ y: clampCoord(parseFloat(e.target.value)) })
                      }
                      className="quadrant-range"
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label">{qText.pointClassField}</label>
                  <select
                    className="field-input"
                    value={selectedPoint.className ?? ''}
                    onChange={(e) =>
                      updateSelectedPoint({ className: e.target.value || undefined })
                    }
                  >
                    <option value="">{qText.noClassOption}</option>
                    {(data.classDefs ?? []).map((cls) => (
                      <option key={cls.name} value={cls.name}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="quadrant-style-grid">
                  <div className="field-group">
                    <label className="field-label">{qText.radiusField}</label>
                    <input
                      type="number"
                      min={1}
                      max={40}
                      placeholder="auto"
                      value={selectedPoint.radius ?? ''}
                      onChange={(e) =>
                        updateSelectedPoint({
                          radius: normalizeOptionalNumber(e.target.value, 1, 40),
                        })
                      }
                      className="field-input"
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label">{qText.strokeWidthField}</label>
                    <input
                      type="number"
                      min={0}
                      max={12}
                      placeholder="auto"
                      value={selectedPoint.strokeWidthPx ?? ''}
                      onChange={(e) =>
                        updateSelectedPoint({
                          strokeWidthPx: normalizeOptionalNumber(e.target.value, 0, 12),
                        })
                      }
                      className="field-input"
                    />
                  </div>
                </div>

                <div className="quadrant-color-row">
                  <div className="field-group">
                    <label className="field-label">{qText.colorField}</label>
                    <div className="quadrant-color-picker">
                      <input
                        type="color"
                        value={selectedPoint.color ?? '#4f46e5'}
                        onChange={(e) => updateSelectedPoint({ color: e.target.value })}
                        className="quadrant-color-swatch"
                      />
                      <span className="quadrant-color-hex">
                        {selectedPoint.color ?? 'default'}
                      </span>
                      {selectedPoint.color && (
                        <button
                          type="button"
                          className="quadrant-mini-clear"
                          onClick={() => updateSelectedPoint({ color: undefined })}
                        >
                          {qText.clearStyleBtn}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="field-group">
                    <label className="field-label">{qText.strokeColorField}</label>
                    <div className="quadrant-color-picker">
                      <input
                        type="color"
                        value={selectedPoint.strokeColor ?? '#ffffff'}
                        onChange={(e) => updateSelectedPoint({ strokeColor: e.target.value })}
                        className="quadrant-color-swatch"
                      />
                      <span className="quadrant-color-hex">
                        {selectedPoint.strokeColor ?? 'default'}
                      </span>
                      {selectedPoint.strokeColor && (
                        <button
                          type="button"
                          className="quadrant-mini-clear"
                          onClick={() => updateSelectedPoint({ strokeColor: undefined })}
                        >
                          {qText.clearStyleBtn}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="toolbar-btn danger quadrant-full-btn"
                  onClick={handleDeleteSelectedPoint}
                >
                  {qText.deletePointBtn}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 2. Title, Quadrants 1-4, X/Y Axes */}
      <div className="quadrant-section">
        <button
          type="button"
          className="quadrant-section-header"
          onClick={() => toggleSection('quadrants')}
        >
          <span>{qText.quadrantsSection}</span>
          <span className="quadrant-section-chevron">{openSections.quadrants ? '▼' : '▶'}</span>
        </button>

        {openSections.quadrants && (
          <div className="quadrant-section-body">
            <div className="field-group">
              <label className="field-label">{qText.titleField}</label>
              <GuardedInput
                value={data.title ?? ''}
                onChangeValue={(val) => onChange({ ...data, title: val })}
                forbiddenRegex={FORBIDDEN_QUADRANT_TEXT_CHARS_REGEX}
                formatError={formatTextError}
                placeholder={qText.titlePlaceholder}
                className="field-input"
              />
            </div>

            <div className="quadrant-label-grid">
              <div className="field-group">
                <label className="field-label">{qText.q2Field}</label>
                <GuardedInput
                  value={data.quadrant2}
                  onChangeValue={(val) => onChange({ ...data, quadrant2: val })}
                  forbiddenRegex={FORBIDDEN_QUADRANT_TEXT_CHARS_REGEX}
                  formatError={formatTextError}
                  className="field-input"
                />
              </div>
              <div className="field-group">
                <label className="field-label">{qText.q1Field}</label>
                <GuardedInput
                  value={data.quadrant1}
                  onChangeValue={(val) => onChange({ ...data, quadrant1: val })}
                  forbiddenRegex={FORBIDDEN_QUADRANT_TEXT_CHARS_REGEX}
                  formatError={formatTextError}
                  className="field-input"
                />
              </div>
              <div className="field-group">
                <label className="field-label">{qText.q3Field}</label>
                <GuardedInput
                  value={data.quadrant3}
                  onChangeValue={(val) => onChange({ ...data, quadrant3: val })}
                  forbiddenRegex={FORBIDDEN_QUADRANT_TEXT_CHARS_REGEX}
                  formatError={formatTextError}
                  className="field-input"
                />
              </div>
              <div className="field-group">
                <label className="field-label">{qText.q4Field}</label>
                <GuardedInput
                  value={data.quadrant4}
                  onChangeValue={(val) => onChange({ ...data, quadrant4: val })}
                  forbiddenRegex={FORBIDDEN_QUADRANT_TEXT_CHARS_REGEX}
                  formatError={formatTextError}
                  className="field-input"
                />
              </div>
            </div>

            <div className="quadrant-label-grid">
              <div className="field-group">
                <label className="field-label">{qText.xAxisLeftField}</label>
                <GuardedInput
                  value={data.xAxisLeft}
                  onChangeValue={(val) => onChange({ ...data, xAxisLeft: val })}
                  forbiddenRegex={FORBIDDEN_QUADRANT_TEXT_CHARS_REGEX}
                  formatError={formatTextError}
                  className="field-input"
                />
              </div>
              <div className="field-group">
                <label className="field-label">{qText.xAxisRightField}</label>
                <GuardedInput
                  value={data.xAxisRight ?? ''}
                  onChangeValue={(val) => onChange({ ...data, xAxisRight: val })}
                  forbiddenRegex={FORBIDDEN_QUADRANT_TEXT_CHARS_REGEX}
                  formatError={formatTextError}
                  className="field-input"
                />
              </div>
              <div className="field-group">
                <label className="field-label">{qText.yAxisBottomField}</label>
                <GuardedInput
                  value={data.yAxisBottom}
                  onChangeValue={(val) => onChange({ ...data, yAxisBottom: val })}
                  forbiddenRegex={FORBIDDEN_QUADRANT_TEXT_CHARS_REGEX}
                  formatError={formatTextError}
                  className="field-input"
                />
              </div>
              <div className="field-group">
                <label className="field-label">{qText.yAxisTopField}</label>
                <GuardedInput
                  value={data.yAxisTop ?? ''}
                  onChangeValue={(val) => onChange({ ...data, yAxisTop: val })}
                  forbiddenRegex={FORBIDDEN_QUADRANT_TEXT_CHARS_REGEX}
                  formatError={formatTextError}
                  className="field-input"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Class Definitions (classDef) */}
      <div className="quadrant-section">
        <button
          type="button"
          className="quadrant-section-header"
          onClick={() => toggleSection('classes')}
        >
          <span>{qText.classesSection}</span>
          <span className="quadrant-section-chevron">{openSections.classes ? '▼' : '▶'}</span>
        </button>

        {openSections.classes && (
          <div className="quadrant-section-body">
            <button
              type="button"
              className="toolbar-btn primary quadrant-full-btn"
              onClick={handleAddClassDef}
            >
              {qText.addClassBtn}
            </button>

            {(!data.classDefs || data.classDefs.length === 0) ? (
              <p className="quadrant-empty-msg">{qText.emptyClasses}</p>
            ) : (
              data.classDefs.map((cls, index) => (
                <div key={index} className="quadrant-class-card">
                  <div className="quadrant-class-card-head">
                    <div className="field-group quadrant-class-name-field">
                      <label className="field-label">{qText.classNameField}</label>
                      <GuardedInput
                        value={cls.name}
                        onChangeValue={(val) => {
                          if (val.trim()) {
                            updateClassDef(index, { name: val });
                          }
                        }}
                        forbiddenRegex={FORBIDDEN_QUADRANT_CLASS_CHARS_REGEX}
                        formatError={formatClassError}
                        className="field-input"
                      />
                    </div>
                    <button
                      type="button"
                      className="toolbar-btn danger quadrant-class-del-btn"
                      onClick={() => handleDeleteClassDef(index)}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="quadrant-style-grid">
                    <div className="field-group">
                      <label className="field-label">{qText.radiusField}</label>
                      <input
                        type="number"
                        min={1}
                        max={40}
                        placeholder="auto"
                        value={cls.radius ?? ''}
                        onChange={(e) =>
                          updateClassDef(index, {
                            radius: normalizeOptionalNumber(e.target.value, 1, 40),
                          })
                        }
                        className="field-input"
                      />
                    </div>
                    <div className="field-group">
                      <label className="field-label">{qText.strokeWidthField}</label>
                      <input
                        type="number"
                        min={0}
                        max={12}
                        placeholder="auto"
                        value={cls.strokeWidthPx ?? ''}
                        onChange={(e) =>
                          updateClassDef(index, {
                            strokeWidthPx: normalizeOptionalNumber(e.target.value, 0, 12),
                          })
                        }
                        className="field-input"
                      />
                    </div>
                  </div>

                  <div className="quadrant-color-row">
                    <div className="field-group">
                      <label className="field-label">{qText.colorField}</label>
                      <div className="quadrant-color-picker">
                        <input
                          type="color"
                          value={cls.color ?? '#ef4444'}
                          onChange={(e) => updateClassDef(index, { color: e.target.value })}
                          className="quadrant-color-swatch"
                        />
                        <span className="quadrant-color-hex">{cls.color ?? 'default'}</span>
                        {cls.color && (
                          <button
                            type="button"
                            className="quadrant-mini-clear"
                            onClick={() => updateClassDef(index, { color: undefined })}
                          >
                            {qText.clearStyleBtn}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="field-group">
                      <label className="field-label">{qText.strokeColorField}</label>
                      <div className="quadrant-color-picker">
                        <input
                          type="color"
                          value={cls.strokeColor ?? '#ffffff'}
                          onChange={(e) => updateClassDef(index, { strokeColor: e.target.value })}
                          className="quadrant-color-swatch"
                        />
                        <span className="quadrant-color-hex">{cls.strokeColor ?? 'default'}</span>
                        {cls.strokeColor && (
                          <button
                            type="button"
                            className="quadrant-mini-clear"
                            onClick={() => updateClassDef(index, { strokeColor: undefined })}
                          >
                            {qText.clearStyleBtn}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 4. Chart Size Settings */}
      <div className="quadrant-section">
        <button
          type="button"
          className="quadrant-section-header"
          onClick={() => toggleSection('settings')}
        >
          <span>{qText.settingsSection}</span>
          <span className="quadrant-section-chevron">{openSections.settings ? '▼' : '▶'}</span>
        </button>

        {openSections.settings && (
          <div className="quadrant-section-body">
            <div className="quadrant-style-grid">
              <div className="field-group">
                <label className="field-label">{qText.chartWidthField}</label>
                <input
                  type="number"
                  min={200}
                  max={2000}
                  step={10}
                  value={data.config.chartWidth}
                  onChange={(e) => {
                    const nextW = normalizeOptionalNumber(e.target.value, 200, 2000);
                    if (nextW !== undefined) {
                      onChange({
                        ...data,
                        config: { ...data.config, chartWidth: nextW },
                      });
                    }
                  }}
                  className="field-input"
                />
              </div>
              <div className="field-group">
                <label className="field-label">{qText.chartHeightField}</label>
                <input
                  type="number"
                  min={200}
                  max={2000}
                  step={10}
                  value={data.config.chartHeight}
                  onChange={(e) => {
                    const nextH = normalizeOptionalNumber(e.target.value, 200, 2000);
                    if (nextH !== undefined) {
                      onChange({
                        ...data,
                        config: { ...data.config, chartHeight: nextH },
                      });
                    }
                  }}
                  className="field-input"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Comments (%%) */}
      <div className="quadrant-section">
        <button
          type="button"
          className="quadrant-section-header"
          onClick={() => toggleSection('comments')}
        >
          <span>{qText.commentsSection}</span>
          <span className="quadrant-section-chevron">{openSections.comments ? '▼' : '▶'}</span>
        </button>

        {openSections.comments && (
          <div className="quadrant-section-body">
            <div className="field-group">
              <label className="field-label">{qText.commentsField}</label>
              <textarea
                rows={3}
                className="field-input field-textarea"
                placeholder={qText.commentsPlaceholder}
                value={(data.comments ?? []).join('\n')}
                onChange={(e) => {
                  const rawLines = e.target.value.split('\n');
                  const hasNonEmpty = rawLines.some((line) => line.trim().length > 0);
                  onChange({
                    ...data,
                    comments: hasNonEmpty ? rawLines : undefined,
                  });
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuadrantInspector;
