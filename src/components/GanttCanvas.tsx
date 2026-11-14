import {
  ArrowDown,
  ArrowUp,
  Diamond,
  FolderPlus,
  Plus,
  Trash2,
} from 'lucide-react';
import { useMemo } from 'react';
import { useI18n } from '../i18n';
import type { GanttDiagramData, GanttTaskData } from '../types/editor';
import {
  formatUtcDateShort,
  resolveGanttTimeline,
} from '../utils/ganttConverter';

export interface GanttCanvasProps {
  ganttData: GanttDiagramData;
  selectedTaskId: string | null;
  onChange: (next: GanttDiagramData) => void;
  onSelectTask: (taskId: string | null) => void;
}

function nextUniqueId(existing: ReadonlySet<string>, prefix: string, startNum: number): string {
  let num = startNum;
  while (existing.has(`${prefix}${num}`)) {
    num++;
  }
  return `${prefix}${num}`;
}

export default function GanttCanvas({
  ganttData,
  selectedTaskId,
  onChange,
  onSelectTask,
}: GanttCanvasProps) {
  const { t } = useI18n();
  const g = t.inspector.gantt;

  const timeline = useMemo(() => resolveGanttTimeline(ganttData), [ganttData]);
  const midMs = Math.round((timeline.minStartMs + timeline.maxEndMs) / 2);

  const handleAddSection = (): void => {
    const existingIds = new Set(ganttData.sections.map((s) => s.id));
    const secNum = ganttData.sections.length + 1;
    const id = nextUniqueId(existingIds, 'sec_', secNum);
    onChange({
      ...ganttData,
      sections: [
        ...ganttData.sections,
        { id, title: g.defaultSectionTitle(secNum) },
      ],
    });
  };

  const handleAddTask = (
    options?: { sectionId?: string; milestone?: boolean }
  ): void => {
    const existingIds = new Set(ganttData.tasks.map((task) => task.id));
    const taskNum = ganttData.tasks.length + 1;
    const id = nextUniqueId(existingIds, 't', taskNum);
    const targetSectionId = options?.sectionId ?? ganttData.sections[0]?.id;

    // 同じセクション内の最後のタスク（なければ全体最後）の後ろへ繋ぐ
    const prevTask =
      [...ganttData.tasks]
        .reverse()
        .find((item) => item.sectionId === targetSectionId) ??
      ganttData.tasks[ganttData.tasks.length - 1];

    const isMilestone = Boolean(options?.milestone);
    const nextTask: GanttTaskData = {
      id,
      label: isMilestone
        ? g.defaultMilestoneLabel(taskNum)
        : g.defaultTaskLabel(taskNum),
      ...(targetSectionId ? { sectionId: targetSectionId } : {}),
      status: 'normal',
      ...(isMilestone ? { milestone: true } : {}),
      startMode: prevTask ? 'after' : 'date',
      ...(prevTask ? { afterTaskIds: [prevTask.id] } : { startDate: '2026-11-16' }),
      endMode: 'duration',
      duration: isMilestone ? '0d' : '3d',
    };

    onChange({
      ...ganttData,
      tasks: [...ganttData.tasks, nextTask],
    });
    onSelectTask(id);
  };

  const handleMoveTask = (taskId: string, delta: -1 | 1): void => {
    const idx = ganttData.tasks.findIndex((item) => item.id === taskId);
    if (idx < 0) return;
    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= ganttData.tasks.length) return;
    const nextTasks = [...ganttData.tasks];
    const [moved] = nextTasks.splice(idx, 1);
    nextTasks.splice(targetIdx, 0, moved);
    onChange({ ...ganttData, tasks: nextTasks });
  };

  const handleDeleteTask = (taskId: string): void => {
    const nextTasks = ganttData.tasks
      .filter((item) => item.id !== taskId)
      .map((item) => ({
        ...item,
        ...(item.afterTaskIds
          ? { afterTaskIds: item.afterTaskIds.filter((id) => id !== taskId) }
          : {}),
        ...(item.untilTaskIds
          ? { untilTaskIds: item.untilTaskIds.filter((id) => id !== taskId) }
          : {}),
      }));
    onChange({ ...ganttData, tasks: nextTasks });
    if (selectedTaskId === taskId) {
      onSelectTask(nextTasks[0]?.id ?? null);
    }
  };

  const sectionIdSet = new Set(ganttData.sections.map((s) => s.id));
  const unassignedTasks = ganttData.tasks.filter(
    (item) => !item.sectionId || !sectionIdSet.has(item.sectionId)
  );

  const groups: Array<{
    key: string;
    sectionId?: string;
    title: string;
    tasks: GanttTaskData[];
  }> = [
    ...(unassignedTasks.length > 0
      ? [{ key: '__unassigned', title: g.unassignedLabel, tasks: unassignedTasks }]
      : []),
    ...ganttData.sections.map((sec) => ({
      key: sec.id,
      sectionId: sec.id,
      title: sec.title,
      tasks: ganttData.tasks.filter((item) => item.sectionId === sec.id),
    })),
  ];

  const renderTaskRow = (task: GanttTaskData) => {
    const isSelected = task.id === selectedTaskId;
    const span = timeline.spansById[task.id];
    const globalIdx = ganttData.tasks.findIndex((item) => item.id === task.id);

    const barClasses = [
      'gantt-bar',
      task.status === 'done' ? 'is-done' : '',
      task.status === 'active' ? 'is-active' : '',
      task.crit ? 'is-crit' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div
        key={task.id}
        className={`gantt-task-row ${isSelected ? 'is-selected' : ''}`}
        onClick={() => onSelectTask(task.id)}
      >
        <div className="gantt-task-info">
          <span className="gantt-task-id-pill">{task.id}</span>
          <span className="gantt-task-label">{task.label}</span>
          {task.crit && <span className="gantt-tag-pill is-crit">crit</span>}
          {task.status !== 'normal' && (
            <span className={`gantt-tag-pill is-${task.status}`}>
              {task.status}
            </span>
          )}
          {task.milestone && (
            <span className="gantt-tag-pill is-milestone">
              <Diamond size={10} />
            </span>
          )}
          {task.vert && <span className="gantt-tag-pill is-vert">vert</span>}
        </div>

        <div className="gantt-track-cell">
          <div className="gantt-track">
            {span && task.vert ? (
              <div
                className="gantt-vert-marker"
                style={{ left: `${span.leftPct}%` }}
                title={`${formatUtcDateShort(span.startMs)}`}
              />
            ) : span && task.milestone ? (
              <div
                className={`gantt-milestone-marker ${task.crit ? 'is-crit' : ''}`}
                style={{ left: `${span.leftPct}%` }}
                title={`${task.label}: ${formatUtcDateShort(span.startMs)}`}
              />
            ) : span ? (
              <div
                className={barClasses}
                style={{
                  left: `${span.leftPct}%`,
                  width: `${span.widthPct}%`,
                }}
                title={`${task.label}: ${formatUtcDateShort(span.startMs)} - ${formatUtcDateShort(span.endMs)}`}
              />
            ) : null}
          </div>
        </div>

        <div
          className="gantt-row-actions"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="treeview-action-btn"
            title={g.moveUpTitle}
            disabled={globalIdx <= 0}
            onClick={() => handleMoveTask(task.id, -1)}
          >
            <ArrowUp size={12} />
          </button>
          <button
            type="button"
            className="treeview-action-btn"
            title={g.moveDownTitle}
            disabled={globalIdx < 0 || globalIdx >= ganttData.tasks.length - 1}
            onClick={() => handleMoveTask(task.id, 1)}
          >
            <ArrowDown size={12} />
          </button>
          <button
            type="button"
            className="treeview-action-btn is-danger"
            title={g.deleteTaskBtn}
            onClick={() => handleDeleteTask(task.id)}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="gantt-canvas">
      <div className="treeview-toolbar">
        <div className="treeview-toolbar-group">
          <button
            type="button"
            className="btn-secondary treeview-toolbar-btn"
            onClick={handleAddSection}
          >
            <FolderPlus size={14} />
            <span>{g.addSectionBtn}</span>
          </button>
          <button
            type="button"
            className="btn-secondary treeview-toolbar-btn"
            onClick={() => handleAddTask()}
          >
            <Plus size={14} />
            <span>{g.addTaskBtn}</span>
          </button>
          <button
            type="button"
            className="btn-secondary treeview-toolbar-btn"
            onClick={() => handleAddTask({ milestone: true })}
          >
            <Diamond size={14} />
            <span>{g.addMilestoneBtn}</span>
          </button>
        </div>

        {ganttData.title && (
          <span className="treeview-title-pill">{ganttData.title}</span>
        )}
      </div>

      <div className="gantt-canvas-scroll">
        <div className="gantt-axis-header">
          <div className="gantt-axis-label-col" />
          <div className="gantt-axis-scale">
            <span>{formatUtcDateShort(timeline.minStartMs)}</span>
            <span>{formatUtcDateShort(midMs)}</span>
            <span>{formatUtcDateShort(timeline.maxEndMs)}</span>
          </div>
          <div className="gantt-axis-actions-col" />
        </div>

        {ganttData.tasks.length === 0 && ganttData.sections.length === 0 ? (
          <div className="treeview-empty-state">{g.emptyTasksHint}</div>
        ) : (
          <div className="gantt-groups">
            {groups.map((group) => (
              <div key={group.key} className="gantt-section-block">
                <div className="gantt-section-header">
                  <span className="gantt-section-title">{group.title}</span>
                  {group.sectionId && (
                    <button
                      type="button"
                      className="btn-secondary btn-xs"
                      title={g.addTaskToSectionTitle}
                      onClick={() => handleAddTask({ sectionId: group.sectionId })}
                    >
                      <Plus size={12} />
                      <span>{g.addTaskBtn}</span>
                    </button>
                  )}
                </div>
                {group.tasks.length === 0 ? (
                  <div className="gantt-section-empty">{g.emptyTasksHint}</div>
                ) : (
                  <div className="gantt-task-rows">
                    {group.tasks.map(renderTaskRow)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
