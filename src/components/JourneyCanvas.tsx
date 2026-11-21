import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import type { JourneyDiagramData, JourneyTaskData } from '../types/editor';
import { allocateUniqueId } from '../utils/mermaidEnvelope';

export interface JourneyCanvasProps {
  journeyData: JourneyDiagramData;
  selectedTaskId: string | null;
  onChange: (next: JourneyDiagramData) => void;
  onSelectTask: (taskId: string | null) => void;
}

export default function JourneyCanvas({
  journeyData,
  selectedTaskId,
  onChange,
  onSelectTask,
}: JourneyCanvasProps) {
  const { t } = useI18n();
  const jn = t.inspector.journey;

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

  const handleAddTask = (sectionId?: string): void => {
    const usedIds = new Set(journeyData.tasks.map((task) => task.id));
    const id = allocateUniqueId(`task_${journeyData.tasks.length + 1}`, usedIds);
    const defaultActor = journeyData.tasks[0]?.actors[0];
    const nextTask: JourneyTaskData = {
      id,
      label: jn.defaultTaskLabel(journeyData.tasks.length + 1),
      score: 4,
      actors: defaultActor ? [defaultActor] : [],
      ...(sectionId ? { sectionId } : {}),
    };
    onChange({
      ...journeyData,
      tasks: [...journeyData.tasks, nextTask],
    });
    onSelectTask(id);
  };

  const handleMoveTask = (taskId: string, delta: -1 | 1): void => {
    const idx = journeyData.tasks.findIndex((item) => item.id === taskId);
    const nextIdx = idx + delta;
    if (idx < 0 || nextIdx < 0 || nextIdx >= journeyData.tasks.length) {
      return;
    }
    const next = [...journeyData.tasks];
    const [moved] = next.splice(idx, 1);
    next.splice(nextIdx, 0, moved);
    onChange({ ...journeyData, tasks: next });
  };

  const handleDeleteTask = (taskId: string): void => {
    const next = journeyData.tasks.filter((item) => item.id !== taskId);
    onChange({ ...journeyData, tasks: next });
    if (selectedTaskId === taskId) {
      onSelectTask(next[0]?.id ?? null);
    }
  };

  const unassignedTasks = journeyData.tasks.filter((task) => !task.sectionId);

  const renderTaskCard = (task: JourneyTaskData) => {
    const isSelected = task.id === selectedTaskId;
    const idx = journeyData.tasks.findIndex((item) => item.id === task.id);
    return (
      <div
        key={task.id}
        role="button"
        tabIndex={0}
        className={`journey-task-card ${isSelected ? 'is-selected' : ''}`}
        data-score={task.score}
        onClick={() => onSelectTask(task.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectTask(task.id);
          }
        }}
      >
        <div className="journey-task-top">
          <span className="journey-task-label">{task.label}</span>
          <span className="journey-score-badge">{task.score}/5</span>
        </div>
        {task.actors.length > 0 && (
          <div className="journey-actor-row">
            {task.actors.map((actor, actorIdx) => (
              <span key={`${actor}_${actorIdx}`} className="journey-actor-pill">
                {actor}
              </span>
            ))}
          </div>
        )}
        <div className="timeline-card-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="btn-icon-subtle"
            title={jn.moveUpTitle}
            disabled={idx <= 0}
            onClick={() => handleMoveTask(task.id, -1)}
          >
            <ArrowUp size={12} />
          </button>
          <button
            type="button"
            className="btn-icon-subtle"
            title={jn.moveDownTitle}
            disabled={idx >= journeyData.tasks.length - 1}
            onClick={() => handleMoveTask(task.id, 1)}
          >
            <ArrowDown size={12} />
          </button>
          <button
            type="button"
            className="btn-icon-subtle is-danger"
            title={jn.deleteTaskBtn}
            onClick={() => handleDeleteTask(task.id)}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="journey-canvas">
      <div className="journey-toolbar">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => handleAddTask(journeyData.sections[0]?.id)}
        >
          <Plus size={14} />
          <span>{jn.addTaskBtn}</span>
        </button>
        <button type="button" className="btn-secondary" onClick={handleAddSection}>
          <Plus size={14} />
          <span>{jn.addSectionBtn}</span>
        </button>
      </div>

      <div className="journey-canvas-scroll">
        {journeyData.title && (
          <div className="strategy-title-banner">{journeyData.title}</div>
        )}

        {journeyData.tasks.length === 0 && journeyData.sections.length === 0 ? (
          <div className="strategy-empty-state">{jn.emptyTasks}</div>
        ) : (
          <div className="journey-board">
            {unassignedTasks.length > 0 && (
              <div className="journey-section-col">
                <div className="journey-section-header">
                  <span>{jn.unassignedLabel}</span>
                  <button
                    type="button"
                    className="btn-icon-subtle"
                    title={jn.addTaskToSectionTitle}
                    onClick={() => handleAddTask(undefined)}
                  >
                    <Plus size={13} />
                  </button>
                </div>
                {unassignedTasks.map(renderTaskCard)}
              </div>
            )}

            {journeyData.sections.map((section) => {
              const secTasks = journeyData.tasks.filter(
                (task) => task.sectionId === section.id
              );
              return (
                <div key={section.id} className="journey-section-col">
                  <div className="journey-section-header">
                    <span>{section.title}</span>
                    <button
                      type="button"
                      className="btn-icon-subtle"
                      title={jn.addTaskToSectionTitle}
                      onClick={() => handleAddTask(section.id)}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  {secTasks.length === 0 ? (
                    <p className="inspector-hint">{jn.emptyTasks}</p>
                  ) : (
                    secTasks.map(renderTaskCard)
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
