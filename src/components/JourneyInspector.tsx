import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import { InspectorCollapsibleSection } from './InspectorCollapsibleSection';
import {
  InspectorBulkControls,
  InspectorCommentsSection,
} from './InspectorCommon';
import {
  FORBIDDEN_JOURNEY_ACTOR_CHARS_REGEX,
  FORBIDDEN_JOURNEY_TEXT_CHARS_REGEX,
} from '../utils/inputSafeguard';
import { allocateUniqueId } from '../utils/mermaidEnvelope';
import type { JourneyDiagramData, JourneyTaskData } from '../types/editor';

export interface JourneyInspectorProps {
  journeyData: JourneyDiagramData;
  selectedTaskId: string | null;
  onChange: (next: JourneyDiagramData) => void;
  onSelectTask: (taskId: string | null) => void;
}

type JourneySectionKey = 'task' | 'sections' | 'settings' | 'comments';

const SCORE_LEVELS: ReadonlyArray<1 | 2 | 3 | 4 | 5> = [1, 2, 3, 4, 5];

export default function JourneyInspector({
  journeyData,
  selectedTaskId,
  onChange,
  onSelectTask,
}: JourneyInspectorProps) {
  const { t } = useI18n();
  const jn = t.inspector.journey;
  const safeguard = t.inspector.safeguard;

  const selectedTask =
    journeyData.tasks.find((item) => item.id === selectedTaskId) ?? null;

  const [openSections, setOpenSections] = useState<
    Record<JourneySectionKey, boolean>
  >({
    task: true,
    sections: false,
    settings: false,
    comments: false,
  });

  useEffect(() => {
    if (selectedTaskId) {
      setOpenSections((prev) => (prev.task ? prev : { ...prev, task: true }));
    }
  }, [selectedTaskId]);

  const toggleSection = (key: JourneySectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSections = (open: boolean): void => {
    setOpenSections({
      task: open,
      sections: open,
      settings: open,
      comments: open,
    });
  };

  const allExpanded = Object.values(openSections).every(Boolean);

  const updateSelectedTask = (patch: Partial<JourneyTaskData>): void => {
    if (!selectedTask) return;
    onChange({
      ...journeyData,
      tasks: journeyData.tasks.map((item) =>
        item.id === selectedTask.id ? { ...item, ...patch } : item
      ),
    });
  };

  const handleDeleteSelectedTask = (): void => {
    if (!selectedTask) return;
    const next = journeyData.tasks.filter((item) => item.id !== selectedTask.id);
    onChange({ ...journeyData, tasks: next });
    onSelectTask(next[0]?.id ?? null);
  };

  const handleAddSection = (): void => {
    const usedIds = new Set(journeyData.sections.map((s) => s.id));
    const id = allocateUniqueId(`sec_${journeyData.sections.length + 1}`, usedIds);
    onChange({
      ...journeyData,
      sections: [
        ...journeyData.sections,
        { id, title: jn.defaultSectionTitle(journeyData.sections.length + 1) },
      ],
    });
  };

  const handleMoveSection = (idx: number, delta: -1 | 1): void => {
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= journeyData.sections.length) return;
    const next = [...journeyData.sections];
    const [moved] = next.splice(idx, 1);
    next.splice(nextIdx, 0, moved);
    onChange({ ...journeyData, sections: next });
  };

  const handleDeleteSection = (sectionId: string): void => {
    onChange({
      ...journeyData,
      sections: journeyData.sections.filter((s) => s.id !== sectionId),
      tasks: journeyData.tasks.map((item) =>
        item.sectionId === sectionId ? { ...item, sectionId: undefined } : item
      ),
    });
  };

  return (
    <div className="inspector-panel">
      <InspectorBulkControls allExpanded={allExpanded} onSetAll={setAllSections} />

      <InspectorCollapsibleSection
        title={jn.taskSection}
        isOpen={openSections.task}
        onToggle={() => toggleSection('task')}
      >
        {selectedTask ? (
          <>
            <label className="inspector-field">
              <span>{jn.taskLabelField}</span>
              <GuardedInput
                value={selectedTask.label}
                placeholder={jn.taskLabelPlaceholder}
                forbiddenRegex={FORBIDDEN_JOURNEY_TEXT_CHARS_REGEX}
                formatError={safeguard.journeyTextErrorChars}
                onChangeValue={(label) => updateSelectedTask({ label })}
              />
            </label>

            <div className="inspector-field">
              <span>{jn.scoreField}</span>
              <div className="journey-score-btn-group">
                {SCORE_LEVELS.map((scoreVal) => (
                  <button
                    key={scoreVal}
                    type="button"
                    className={`inspector-choice-btn ${
                      selectedTask.score === scoreVal ? 'is-active' : ''
                    }`}
                    title={jn.scoreLabels[scoreVal]}
                    onClick={() => updateSelectedTask({ score: scoreVal })}
                  >
                    {scoreVal}
                  </button>
                ))}
              </div>
              <p className="inspector-hint">
                {jn.scoreLabels[selectedTask.score as 1 | 2 | 3 | 4 | 5] ??
                  jn.scoreLabels[3]}
              </p>
            </div>

            <label className="inspector-field">
              <span>{jn.actorsField}</span>
              <GuardedInput
                value={selectedTask.actors.join(', ')}
                placeholder={jn.actorsPlaceholder}
                forbiddenRegex={FORBIDDEN_JOURNEY_TEXT_CHARS_REGEX}
                formatError={safeguard.journeyActorErrorChars}
                onChangeValue={(raw) => {
                  const actors = raw
                    .split(',')
                    .map((s) =>
                      s.replace(FORBIDDEN_JOURNEY_ACTOR_CHARS_REGEX, '').trim()
                    )
                    .filter((s) => s.length > 0);
                  updateSelectedTask({ actors });
                }}
              />
            </label>

            <label className="inspector-field">
              <span>{jn.taskSectionField}</span>
              <select
                value={selectedTask.sectionId ?? ''}
                onChange={(e) =>
                  updateSelectedTask({ sectionId: e.target.value || undefined })
                }
              >
                <option value="">{jn.unassignedLabel}</option>
                {journeyData.sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.title}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleDeleteSelectedTask}
            >
              <Trash2 size={14} />
              <span>{jn.deleteTaskBtn}</span>
            </button>
          </>
        ) : (
          <p className="inspector-hint">{jn.selectTaskPrompt}</p>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={jn.sectionsSection}
        badgeText={journeyData.sections.length}
        isOpen={openSections.sections}
        onToggle={() => toggleSection('sections')}
        headerAction={
          <button
            type="button"
            className="btn-secondary btn-xs"
            onClick={handleAddSection}
          >
            <Plus size={12} />
            <span>{jn.addSectionBtn}</span>
          </button>
        }
      >
        {journeyData.sections.length === 0 ? (
          <p className="inspector-hint">{jn.emptySections}</p>
        ) : (
          <div className="timeline-sections-list">
            {journeyData.sections.map((sec, idx) => (
              <div key={sec.id} className="timeline-section-row">
                <GuardedInput
                  ariaLabel={jn.sectionTitleField}
                  value={sec.title}
                  forbiddenRegex={FORBIDDEN_JOURNEY_TEXT_CHARS_REGEX}
                  formatError={safeguard.journeyTextErrorChars}
                  onChangeValue={(title) =>
                    onChange({
                      ...journeyData,
                      sections: journeyData.sections.map((item) =>
                        item.id === sec.id ? { ...item, title } : item
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  className="btn-icon-subtle"
                  title={jn.moveUpTitle}
                  disabled={idx === 0}
                  onClick={() => handleMoveSection(idx, -1)}
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  className="btn-icon-subtle"
                  title={jn.moveDownTitle}
                  disabled={idx === journeyData.sections.length - 1}
                  onClick={() => handleMoveSection(idx, 1)}
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  type="button"
                  className="btn-icon-subtle is-danger"
                  title={jn.deleteSectionTitle}
                  onClick={() => handleDeleteSection(sec.id)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={jn.settingsSection}
        isOpen={openSections.settings}
        onToggle={() => toggleSection('settings')}
      >
        <label className="inspector-field">
          <span>{jn.titleField}</span>
          <GuardedInput
            value={journeyData.title ?? ''}
            placeholder={jn.titlePlaceholder}
            forbiddenRegex={FORBIDDEN_JOURNEY_TEXT_CHARS_REGEX}
            formatError={safeguard.journeyTextErrorChars}
            onChangeValue={(val) =>
              onChange({ ...journeyData, title: val || undefined })
            }
          />
        </label>
      </InspectorCollapsibleSection>

      <InspectorCommentsSection
        title={jn.commentsSection}
        fieldLabel={jn.commentsField}
        placeholder={jn.commentsPlaceholder}
        comments={journeyData.comments}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
        onChangeComments={(comments) => onChange({ ...journeyData, comments })}
      />
    </div>
  );
}
