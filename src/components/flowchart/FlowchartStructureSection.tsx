import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import GuardedInput from '../GuardedInput';
import {
  COLOR_PALETTE_ITEMS,
  InspectorCollapsibleSection,
  STROKE_COLOR_PALETTE_ITEMS,
} from '../InspectorCollapsibleSection';
import {
  FORBIDDEN_CLASS_NAME_CHARS_REGEX,
  FORBIDDEN_LABEL_CHARS_REGEX,
} from '../../utils/inputSafeguard';
import type {
  MermaidClassDefData,
  MermaidDirection,
  MermaidSubgraphData,
} from '../../types/editor';

export interface FlowchartSubgraphsSectionProps {
  isSwimlane: boolean;
  directionValues: ReadonlyArray<MermaidDirection>;
  subgraphs: ReadonlyArray<MermaidSubgraphData>;
  isOpen: boolean;
  onToggle: () => void;
  onAddSubgraph: (draft: {
    title: string;
    direction: MermaidDirection | '';
    fill: string;
    stroke: string;
  }) => void;
  onMoveSubgraph: (subgraphId: string, delta: -1 | 1) => void;
  onUpdateSubgraph: (subgraphId: string, patch: Partial<MermaidSubgraphData>) => void;
  onDeleteSubgraph: (subgraphId: string) => void;
  onAddNodeInLane: (laneId: string) => void;
}

export function FlowchartSubgraphsSection({
  isSwimlane,
  directionValues,
  subgraphs,
  isOpen,
  onToggle,
  onAddSubgraph,
  onMoveSubgraph,
  onUpdateSubgraph,
  onDeleteSubgraph,
  onAddNodeInLane,
}: FlowchartSubgraphsSectionProps) {
  const { t } = useI18n();
  const [newSubgraphTitle, setNewSubgraphTitle] = useState<string>('');
  const [newSubgraphDirection, setNewSubgraphDirection] = useState<MermaidDirection | ''>('');
  const [newLaneFill, setNewLaneFill] = useState<string>('#eff6ff');
  const [newLaneStroke, setNewLaneStroke] = useState<string>('#2563eb');

  const handleSubmit = (): void => {
    onAddSubgraph({
      title: newSubgraphTitle,
      direction: newSubgraphDirection,
      fill: newLaneFill,
      stroke: newLaneStroke,
    });
    setNewSubgraphTitle('');
    setNewSubgraphDirection('');
  };

  return (
    <InspectorCollapsibleSection
      title={isSwimlane ? t.inspector.swimlane.lanesHeading : t.inspector.subgraphsHeading}
      badgeText={
        isSwimlane ? subgraphs.length : subgraphs.length > 0 ? subgraphs.length : undefined
      }
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="edge-add-card">
        {isSwimlane ? (
          <>
            <label className="inspector-field">
              <span>{t.inspector.swimlane.laneTitleField}</span>
              <GuardedInput
                value={newSubgraphTitle}
                onChangeValue={(nextVal) => setNewSubgraphTitle(nextVal)}
                forbiddenRegex={FORBIDDEN_LABEL_CHARS_REGEX}
                formatError={t.inspector.safeguard.syntaxErrorChars}
                placeholder={t.inspector.swimlane.laneTitlePlaceholder}
              />
            </label>
            <div className="edge-add-grid">
              <label className="inspector-field">
                <span>{t.inspector.swimlane.laneFillField}</span>
                <select
                  value={newLaneFill}
                  onChange={(event) => setNewLaneFill(event.target.value)}
                >
                  {COLOR_PALETTE_ITEMS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {t.inspector.colors[item.key]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="inspector-field">
                <span>{t.inspector.swimlane.laneStrokeField}</span>
                <select
                  value={newLaneStroke}
                  onChange={(event) => setNewLaneStroke(event.target.value)}
                >
                  {STROKE_COLOR_PALETTE_ITEMS.filter((item) => item.value !== '').map((item) => (
                    <option key={item.key} value={item.value}>
                      {t.inspector.strokeColors[item.key]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        ) : (
          <div className="edge-add-grid">
            <label className="inspector-field">
              <span>{t.inspector.subgraphTitleField}</span>
              <GuardedInput
                value={newSubgraphTitle}
                onChangeValue={(nextVal) => setNewSubgraphTitle(nextVal)}
                forbiddenRegex={FORBIDDEN_LABEL_CHARS_REGEX}
                formatError={t.inspector.safeguard.syntaxErrorChars}
                placeholder={t.inspector.subgraphTitlePlaceholder}
              />
            </label>

            <label className="inspector-field">
              <span>{t.inspector.subgraphDirectionField}</span>
              <select
                value={newSubgraphDirection}
                onChange={(event) =>
                  setNewSubgraphDirection((event.target.value as MermaidDirection) || '')
                }
              >
                <option value="">{t.inspector.subgraphDirectionInherit}</option>
                {directionValues.map((dir) => (
                  <option key={dir} value={dir}>
                    {t.inspector.directions[dir]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <button type="button" className="btn-primary btn-full" onClick={handleSubmit}>
          <Plus size={14} />
          <span>{isSwimlane ? t.inspector.swimlane.addLaneBtn : t.inspector.addSubgraphBtn}</span>
        </button>
      </div>

      <div className="edge-list-container">
        {subgraphs.length === 0 ? (
          <p className="inspector-hint">
            {isSwimlane ? t.inspector.swimlane.noLanesHint : t.inspector.noSubgraphsHint}
          </p>
        ) : (
          subgraphs.map((sg, idx) => (
            <div key={sg.id} className="edge-list-item">
              <div className="edge-item-row">
                {isSwimlane && (
                  <div className="lane-reorder-group">
                    <button
                      type="button"
                      className="btn-icon-subtle"
                      title={t.inspector.swimlane.moveUpTitle}
                      disabled={idx === 0}
                      onClick={() => onMoveSubgraph(sg.id, -1)}
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      className="btn-icon-subtle"
                      title={t.inspector.swimlane.moveDownTitle}
                      disabled={idx === subgraphs.length - 1}
                      onClick={() => onMoveSubgraph(sg.id, 1)}
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>
                )}

                <GuardedInput
                  ariaLabel={
                    isSwimlane ? t.inspector.swimlane.laneTitleField : t.inspector.subgraphTitleField
                  }
                  value={sg.title}
                  onChangeValue={(nextVal) =>
                    onUpdateSubgraph(sg.id, { title: nextVal })
                  }
                  forbiddenRegex={FORBIDDEN_LABEL_CHARS_REGEX}
                  formatError={t.inspector.safeguard.syntaxErrorChars}
                />

                {isSwimlane ? (
                  <button
                    type="button"
                    className="btn-icon-add-step"
                    title={t.inspector.swimlane.addStepToLaneTitle}
                    onClick={() => onAddNodeInLane(sg.id)}
                  >
                    <Plus size={14} />
                  </button>
                ) : (
                  <select
                    aria-label={t.inspector.subgraphDirectionField}
                    value={sg.direction ?? ''}
                    onChange={(event) =>
                      onUpdateSubgraph(sg.id, {
                        direction: (event.target.value as MermaidDirection) || undefined,
                      })
                    }
                  >
                    <option value="">{t.inspector.subgraphDirectionInherit}</option>
                    {directionValues.map((dir) => (
                      <option key={dir} value={dir}>
                        {t.inspector.directions[dir]}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  className="btn-icon-danger"
                  title={
                    isSwimlane ? t.inspector.swimlane.deleteLaneTitle : t.inspector.deleteSubgraphTitle
                  }
                  onClick={() => onDeleteSubgraph(sg.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {isSwimlane && (
                <div className="edge-item-row">
                  <select
                    aria-label={t.inspector.swimlane.laneFillField}
                    value={sg.fill ?? '#ffffff'}
                    onChange={(event) =>
                      onUpdateSubgraph(sg.id, {
                        fill: event.target.value === '#ffffff' ? undefined : event.target.value,
                      })
                    }
                  >
                    {COLOR_PALETTE_ITEMS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {t.inspector.colors[item.key]}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label={t.inspector.swimlane.laneStrokeField}
                    value={sg.stroke ?? ''}
                    onChange={(event) =>
                      onUpdateSubgraph(sg.id, {
                        stroke: event.target.value || undefined,
                      })
                    }
                  >
                    {STROKE_COLOR_PALETTE_ITEMS.map((item) => (
                      <option key={item.key} value={item.value}>
                        {t.inspector.strokeColors[item.key]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </InspectorCollapsibleSection>
  );
}

export interface FlowchartClassDefsSectionProps {
  classDefs: ReadonlyArray<MermaidClassDefData>;
  isOpen: boolean;
  onToggle: () => void;
  onAddClassDef: (draft: { name: string; fill: string; stroke: string }) => void;
  onDeleteClassDef: (className: string) => void;
}

export function FlowchartClassDefsSection({
  classDefs,
  isOpen,
  onToggle,
  onAddClassDef,
  onDeleteClassDef,
}: FlowchartClassDefsSectionProps) {
  const { t } = useI18n();
  const [newClassName, setNewClassName] = useState<string>('');
  const [newClassFill, setNewClassFill] = useState<string>('#eff6ff');
  const [newClassStroke, setNewClassStroke] = useState<string>('#2563eb');

  const handleSubmit = (): void => {
    onAddClassDef({
      name: newClassName,
      fill: newClassFill,
      stroke: newClassStroke,
    });
    setNewClassName('');
  };

  return (
    <InspectorCollapsibleSection
      title={t.inspector.classDefsHeading}
      badgeText={classDefs.length > 0 ? classDefs.length : undefined}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="edge-add-card">
        <label className="inspector-field">
          <span>{t.inspector.classNameField}</span>
          <GuardedInput
            value={newClassName}
            onChangeValue={(nextVal) => setNewClassName(nextVal)}
            forbiddenRegex={FORBIDDEN_CLASS_NAME_CHARS_REGEX}
            formatError={t.inspector.safeguard.classNameErrorChars}
            placeholder={t.inspector.classNamePlaceholder}
          />
        </label>

        <div className="edge-add-grid">
          <label className="inspector-field">
            <span>{t.inspector.classFillField}</span>
            <select
              value={newClassFill}
              onChange={(event) => setNewClassFill(event.target.value)}
            >
              {COLOR_PALETTE_ITEMS.map((item) => (
                <option key={item.value} value={item.value}>
                  {t.inspector.colors[item.key]}
                </option>
              ))}
            </select>
          </label>

          <label className="inspector-field">
            <span>{t.inspector.classStrokeField}</span>
            <select
              value={newClassStroke}
              onChange={(event) => setNewClassStroke(event.target.value)}
            >
              {STROKE_COLOR_PALETTE_ITEMS.filter((item) => item.value !== '').map((item) => (
                <option key={item.key} value={item.value}>
                  {t.inspector.strokeColors[item.key]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button type="button" className="btn-primary btn-full" onClick={handleSubmit}>
          <Plus size={14} />
          <span>{t.inspector.addClassDefBtn}</span>
        </button>
      </div>

      <div className="edge-list-container">
        {classDefs.length === 0 ? (
          <p className="inspector-hint">{t.inspector.noClassDefsHint}</p>
        ) : (
          classDefs.map((cls) => (
            <div key={cls.name} className="classdef-list-item">
              <span
                className="classdef-preview-pill"
                style={{
                  backgroundColor: cls.fill || '#ffffff',
                  borderColor: cls.stroke || '#475569',
                  color: cls.color || '#0f172a',
                }}
              >
                .{cls.name}
              </span>
              <button
                type="button"
                className="btn-icon-danger"
                title={t.inspector.deleteClassDefTitle}
                onClick={() => onDeleteClassDef(cls.name)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </InspectorCollapsibleSection>
  );
}
