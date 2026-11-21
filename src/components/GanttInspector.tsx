import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import { InspectorCollapsibleSection } from './InspectorCollapsibleSection';
import {
  InspectorBulkControls,
  InspectorCommentsSection,
} from './InspectorCommon';
import {
  FORBIDDEN_CLASS_NAME_CHARS_REGEX,
  FORBIDDEN_GANTT_LABEL_CHARS_REGEX,
  FORBIDDEN_URL_CHARS_REGEX,
} from '../utils/inputSafeguard';
import type {
  GanttDiagramData,
  GanttTaskData,
  GanttTaskEndMode,
  GanttTaskStartMode,
  GanttTaskStatus,
  GanttWeekday,
  GanttWeekend,
} from '../types/editor';

export interface GanttInspectorProps {
  ganttData: GanttDiagramData;
  selectedTaskId: string | null;
  onChange: (next: GanttDiagramData) => void;
  onSelectTask: (taskId: string | null) => void;
}

type GanttSectionKey = 'task' | 'sections' | 'settings' | 'comments';

const DURATION_PRESETS = ['1d', '3d', '5d', '1w', '2w', '0d'] as const;
const WEEKDAY_OPTIONS: ReadonlyArray<GanttWeekday> = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export default function GanttInspector({
  ganttData,
  selectedTaskId,
  onChange,
  onSelectTask,
}: GanttInspectorProps) {
  const { t } = useI18n();
  const g = t.inspector.gantt;
  const tasks = ganttData.tasks;
  const sections = ganttData.sections;
  const selectedTask = tasks.find((item) => item.id === selectedTaskId) ?? null;
  const otherTasks = tasks.filter((item) => item.id !== selectedTask?.id);
  const isIsoDateFormat = ganttData.dateFormat.trim() === 'YYYY-MM-DD';

  const [openSections, setOpenSections] = useState<Record<GanttSectionKey, boolean>>({
    task: true,
    sections: true,
    settings: false,
    comments: false,
  });

  const toggleSection = (key: GanttSectionKey): void => {
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

  const updateSelectedTask = (patch: Partial<GanttTaskData>): void => {
    if (!selectedTask) return;
    onChange({
      ...ganttData,
      tasks: tasks.map((item) =>
        item.id === selectedTask.id ? { ...item, ...patch } : item
      ),
    });
  };

  const handleRenameTaskId = (rawId: string): void => {
    if (!selectedTask) return;
    const oldId = selectedTask.id;
    const nextId = rawId.trim();
    if (!nextId || nextId === oldId) return;
    if (tasks.some((item) => item.id === nextId)) return;

    onChange({
      ...ganttData,
      tasks: tasks.map((item) => {
        const nextAfter = item.afterTaskIds?.map((id) => (id === oldId ? nextId : id));
        const nextUntil = item.untilTaskIds?.map((id) => (id === oldId ? nextId : id));
        return {
          ...(item.id === oldId ? { ...item, id: nextId } : item),
          ...(nextAfter ? { afterTaskIds: nextAfter } : {}),
          ...(nextUntil ? { untilTaskIds: nextUntil } : {}),
        };
      }),
    });
    onSelectTask(nextId);
  };

  const toggleTaskReference = (
    field: 'afterTaskIds' | 'untilTaskIds',
    refId: string
  ): void => {
    if (!selectedTask) return;
    const current = selectedTask[field] ?? [];
    const nextList = current.includes(refId)
      ? current.filter((id) => id !== refId)
      : [...current, refId];
    updateSelectedTask({
      [field]: nextList.length > 0 ? nextList : undefined,
    });
  };

  const handleAddSection = (): void => {
    const existing = new Set(sections.map((s) => s.id));
    let num = sections.length + 1;
    while (existing.has(`sec_${num}`)) {
      num++;
    }
    const id = `sec_${num}`;
    onChange({
      ...ganttData,
      sections: [...sections, { id, title: g.defaultSectionTitle(num) }],
    });
  };

  const handleMoveSection = (sectionId: string, delta: -1 | 1): void => {
    const idx = sections.findIndex((s) => s.id === sectionId);
    const target = idx + delta;
    if (idx < 0 || target < 0 || target >= sections.length) return;
    const next = [...sections];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    onChange({ ...ganttData, sections: next });
  };

  const handleDeleteSection = (sectionId: string): void => {
    onChange({
      ...ganttData,
      sections: sections.filter((s) => s.id !== sectionId),
      tasks: tasks.map((item) =>
        item.sectionId === sectionId ? { ...item, sectionId: undefined } : item
      ),
    });
  };

  const handleAddTaskInSection = (sectionId?: string): void => {
    const existing = new Set(tasks.map((item) => item.id));
    let num = tasks.length + 1;
    while (existing.has(`t${num}`)) {
      num++;
    }
    const id = `t${num}`;
    const prevTask =
      [...tasks].reverse().find((item) => item.sectionId === sectionId) ??
      tasks[tasks.length - 1];

    const nextTask: GanttTaskData = {
      id,
      label: g.defaultTaskLabel(num),
      ...(sectionId ? { sectionId } : {}),
      status: 'normal',
      startMode: prevTask ? 'after' : 'date',
      ...(prevTask ? { afterTaskIds: [prevTask.id] } : { startDate: '2026-11-16' }),
      endMode: 'duration',
      duration: '3d',
    };

    onChange({ ...ganttData, tasks: [...tasks, nextTask] });
    onSelectTask(id);
  };

  const handleDeleteTask = (taskId: string): void => {
    const nextTasks = tasks
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

  return (
    <div className="mermaid-inspector">
      <InspectorBulkControls allExpanded={allExpanded} onSetAll={setAllSections} />

      {/* 1. 選択中タスクの編集 */}
      <InspectorCollapsibleSection
        title={g.taskHeading}
        badgeText={tasks.length}
        isOpen={openSections.task}
        onToggle={() => toggleSection('task')}
        headerAction={
          <button
            type="button"
            className="btn-secondary btn-xs"
            onClick={() => handleAddTaskInSection(sections[0]?.id)}
          >
            <Plus size={13} />
            <span>{g.addTaskBtn}</span>
          </button>
        }
      >
        <div className="field-group">
          <label htmlFor="gantt-target-task">{g.targetTaskField}</label>
          <select
            id="gantt-target-task"
            value={selectedTask?.id ?? ''}
            onChange={(e) => onSelectTask(e.target.value || null)}
          >
            <option value="">{t.inspector.selectNodePlaceholder}</option>
            {tasks.map((item) => (
              <option key={item.id} value={item.id}>
                [{item.id}] {item.label}
              </option>
            ))}
          </select>
        </div>

        {selectedTask ? (
          <>
            <div className="field-group">
              <label>{g.taskLabelField}</label>
              <GuardedInput
                ariaLabel={g.taskLabelField}
                value={selectedTask.label}
                forbiddenRegex={FORBIDDEN_GANTT_LABEL_CHARS_REGEX}
                formatError={t.inspector.safeguard.syntaxErrorChars}
                placeholder={g.taskLabelPlaceholder}
                onChangeValue={(label) => updateSelectedTask({ label })}
              />
            </div>

            <div className="field-row-compact">
              <div className="field-group">
                <label htmlFor="gantt-task-section">{g.taskSectionField}</label>
                <select
                  id="gantt-task-section"
                  value={selectedTask.sectionId ?? ''}
                  onChange={(e) =>
                    updateSelectedTask({
                      sectionId: e.target.value || undefined,
                    })
                  }
                >
                  <option value="">{g.unassignedLabel}</option>
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-group">
                <label>{g.taskIdField}</label>
                <GuardedInput
                  ariaLabel={g.taskIdField}
                  value={selectedTask.id}
                  forbiddenRegex={FORBIDDEN_CLASS_NAME_CHARS_REGEX}
                  formatError={t.inspector.safeguard.classNameErrorChars}
                  placeholder={g.taskIdPlaceholder}
                  onChangeValue={handleRenameTaskId}
                />
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="gantt-task-status">{g.taskStatusField}</label>
              <select
                id="gantt-task-status"
                value={selectedTask.status}
                onChange={(e) =>
                  updateSelectedTask({
                    status: e.target.value as GanttTaskStatus,
                  })
                }
              >
                <option value="normal">{g.statuses.normal}</option>
                <option value="active">{g.statuses.active}</option>
                <option value="done">{g.statuses.done}</option>
              </select>
            </div>

            <div className="gantt-tags-group">
              <label className="checkbox-field-label">
                <input
                  type="checkbox"
                  checked={Boolean(selectedTask.crit)}
                  onChange={(e) =>
                    updateSelectedTask({
                      crit: e.target.checked ? true : undefined,
                    })
                  }
                />
                <span>{g.tagCritField}</span>
              </label>
              <label className="checkbox-field-label">
                <input
                  type="checkbox"
                  checked={Boolean(selectedTask.milestone)}
                  onChange={(e) =>
                    updateSelectedTask({
                      milestone: e.target.checked ? true : undefined,
                      ...(e.target.checked && selectedTask.endMode === 'duration'
                        ? { duration: '0d' }
                        : {}),
                    })
                  }
                />
                <span>{g.tagMilestoneField}</span>
              </label>
              <label className="checkbox-field-label">
                <input
                  type="checkbox"
                  checked={Boolean(selectedTask.vert)}
                  onChange={(e) =>
                    updateSelectedTask({
                      vert: e.target.checked ? true : undefined,
                    })
                  }
                />
                <span>{g.tagVertField}</span>
              </label>
            </div>

            <div className="field-group">
              <label htmlFor="gantt-start-mode">{g.startModeField}</label>
              <select
                id="gantt-start-mode"
                value={selectedTask.startMode}
                onChange={(e) => {
                  const nextMode = e.target.value as GanttTaskStartMode;
                  updateSelectedTask({
                    startMode: nextMode,
                    ...(nextMode === 'date' && !selectedTask.startDate
                      ? { startDate: '2026-11-16' }
                      : {}),
                    ...(nextMode === 'after' &&
                    (!selectedTask.afterTaskIds || selectedTask.afterTaskIds.length === 0) &&
                    otherTasks[0]
                      ? { afterTaskIds: [otherTasks[0].id] }
                      : {}),
                  });
                }}
              >
                <option value="date">{g.startModes.date}</option>
                <option value="after">{g.startModes.after}</option>
                <option value="auto">{g.startModes.auto}</option>
              </select>
            </div>

            {selectedTask.startMode === 'date' && (
              <div className="field-group">
                <label htmlFor="gantt-start-date">{g.startDateField}</label>
                <input
                  id="gantt-start-date"
                  type={isIsoDateFormat ? 'date' : 'text'}
                  value={selectedTask.startDate ?? ''}
                  onChange={(e) =>
                    updateSelectedTask({ startDate: e.target.value })
                  }
                />
              </div>
            )}

            {selectedTask.startMode === 'after' && (
              <div className="field-group">
                <label>{g.afterTasksField}</label>
                {otherTasks.length === 0 ? (
                  <p className="hint-text">{g.noOtherTasksHint}</p>
                ) : (
                  <div className="gantt-dep-chips">
                    {otherTasks.map((item) => {
                      const active = (selectedTask.afterTaskIds ?? []).includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`gantt-dep-chip ${active ? 'is-selected' : ''}`}
                          onClick={() => toggleTaskReference('afterTaskIds', item.id)}
                        >
                          {item.id} ({item.label})
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="field-group">
              <label htmlFor="gantt-end-mode">{g.endModeField}</label>
              <select
                id="gantt-end-mode"
                value={selectedTask.endMode}
                onChange={(e) => {
                  const nextEnd = e.target.value as GanttTaskEndMode;
                  updateSelectedTask({
                    endMode: nextEnd,
                    ...(nextEnd === 'duration' && !selectedTask.duration
                      ? { duration: '3d' }
                      : {}),
                    ...(nextEnd === 'date' && !selectedTask.endDate
                      ? { endDate: '2026-11-20' }
                      : {}),
                    ...(nextEnd === 'until' &&
                    (!selectedTask.untilTaskIds || selectedTask.untilTaskIds.length === 0) &&
                    otherTasks[0]
                      ? { untilTaskIds: [otherTasks[0].id] }
                      : {}),
                  });
                }}
              >
                <option value="duration">{g.endModes.duration}</option>
                <option value="date">{g.endModes.date}</option>
                <option value="until">{g.endModes.until}</option>
              </select>
            </div>

            {selectedTask.endMode === 'duration' && (
              <div className="field-group">
                <label htmlFor="gantt-duration">{g.durationField}</label>
                <input
                  id="gantt-duration"
                  type="text"
                  value={selectedTask.duration ?? ''}
                  placeholder={g.durationPlaceholder}
                  onChange={(e) =>
                    updateSelectedTask({ duration: e.target.value })
                  }
                />
                <div className="gantt-duration-presets">
                  {DURATION_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`gantt-preset-btn ${
                        selectedTask.duration === preset ? 'is-selected' : ''
                      }`}
                      onClick={() => updateSelectedTask({ duration: preset })}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedTask.endMode === 'date' && (
              <div className="field-group">
                <label htmlFor="gantt-end-date">{g.endDateField}</label>
                <input
                  id="gantt-end-date"
                  type={isIsoDateFormat ? 'date' : 'text'}
                  value={selectedTask.endDate ?? ''}
                  onChange={(e) =>
                    updateSelectedTask({ endDate: e.target.value })
                  }
                />
              </div>
            )}

            {selectedTask.endMode === 'until' && (
              <div className="field-group">
                <label>{g.untilTasksField}</label>
                {otherTasks.length === 0 ? (
                  <p className="hint-text">{g.noOtherTasksHint}</p>
                ) : (
                  <div className="gantt-dep-chips">
                    {otherTasks.map((item) => {
                      const active = (selectedTask.untilTaskIds ?? []).includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`gantt-dep-chip ${active ? 'is-selected' : ''}`}
                          onClick={() => toggleTaskReference('untilTaskIds', item.id)}
                        >
                          {item.id} ({item.label})
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="field-group">
              <label>{g.clickUrlField}</label>
              <GuardedInput
                type="url"
                ariaLabel={g.clickUrlField}
                value={selectedTask.clickUrl ?? ''}
                forbiddenRegex={FORBIDDEN_URL_CHARS_REGEX}
                formatError={t.inspector.safeguard.urlErrorChars}
                placeholder={g.clickUrlPlaceholder}
                onChangeValue={(clickUrl) =>
                  updateSelectedTask({ clickUrl: clickUrl || undefined })
                }
              />
            </div>

            <button
              type="button"
              className="btn-danger-outline"
              onClick={() => handleDeleteTask(selectedTask.id)}
            >
              <Trash2 size={14} />
              <span>{g.deleteTaskBtn}</span>
            </button>
          </>
        ) : (
          <p className="hint-text">{g.selectTaskHint}</p>
        )}
      </InspectorCollapsibleSection>

      {/* 2. セクション管理 */}
      <InspectorCollapsibleSection
        title={g.sectionsHeading}
        badgeText={sections.length}
        isOpen={openSections.sections}
        onToggle={() => toggleSection('sections')}
        headerAction={
          <button
            type="button"
            className="btn-secondary btn-xs"
            onClick={() => {
              if (!openSections.sections) {
                setOpenSections((prev) => ({ ...prev, sections: true }));
              }
              handleAddSection();
            }}
          >
            <Plus size={13} />
            <span>{g.addSectionBtn}</span>
          </button>
        }
      >
        {sections.length === 0 ? (
          <p className="hint-text">{g.noSectionsHint}</p>
        ) : (
          <div className="edge-list">
            {sections.map((sec, idx) => (
              <div key={sec.id} className="edge-row">
                <div className="edge-row-main">
                  <div className="lane-reorder-group">
                    <button
                      type="button"
                      className="btn-icon-subtle"
                      title={g.moveUpTitle}
                      disabled={idx === 0}
                      onClick={() => handleMoveSection(sec.id, -1)}
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      className="btn-icon-subtle"
                      title={g.moveDownTitle}
                      disabled={idx === sections.length - 1}
                      onClick={() => handleMoveSection(sec.id, 1)}
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>
                  <GuardedInput
                    value={sec.title}
                    forbiddenRegex={FORBIDDEN_GANTT_LABEL_CHARS_REGEX}
                    formatError={t.inspector.safeguard.syntaxErrorChars}
                    placeholder={g.sectionTitlePlaceholder}
                    onChangeValue={(title) =>
                      onChange({
                        ...ganttData,
                        sections: sections.map((s) =>
                          s.id === sec.id ? { ...s, title } : s
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="btn-icon-add-step"
                    title={g.addTaskToSectionTitle}
                    onClick={() => handleAddTaskInSection(sec.id)}
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn-icon-danger"
                    title={g.deleteSectionTitle}
                    onClick={() => handleDeleteSection(sec.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </InspectorCollapsibleSection>

      {/* 3. チャート全体・軸設定 */}
      <InspectorCollapsibleSection
        title={g.settingsHeading}
        isOpen={openSections.settings}
        onToggle={() => toggleSection('settings')}
      >
        <div className="field-group">
          <label>{g.titleField}</label>
          <GuardedInput
            ariaLabel={g.titleField}
            value={ganttData.title ?? ''}
            forbiddenRegex={FORBIDDEN_GANTT_LABEL_CHARS_REGEX}
            formatError={t.inspector.safeguard.syntaxErrorChars}
            placeholder={g.titlePlaceholder}
            onChangeValue={(title) =>
              onChange({ ...ganttData, title: title || undefined })
            }
          />
        </div>

        <div className="field-row-compact">
          <div className="field-group">
            <label htmlFor="gantt-date-format">{g.dateFormatField}</label>
            <input
              id="gantt-date-format"
              type="text"
              value={ganttData.dateFormat}
              onChange={(e) =>
                onChange({ ...ganttData, dateFormat: e.target.value })
              }
            />
          </div>

          <div className="field-group">
            <label htmlFor="gantt-axis-format">{g.axisFormatField}</label>
            <input
              id="gantt-axis-format"
              type="text"
              value={ganttData.axisFormat ?? ''}
              placeholder="%m/%d"
              onChange={(e) =>
                onChange({
                  ...ganttData,
                  axisFormat: e.target.value || undefined,
                })
              }
            />
          </div>
        </div>

        <div className="field-row-compact">
          <div className="field-group">
            <label htmlFor="gantt-tick-interval">{g.tickIntervalField}</label>
            <input
              id="gantt-tick-interval"
              type="text"
              value={ganttData.tickInterval ?? ''}
              placeholder={g.tickIntervalPlaceholder}
              onChange={(e) =>
                onChange({
                  ...ganttData,
                  tickInterval: e.target.value || undefined,
                })
              }
            />
          </div>

          <div className="field-group">
            <label htmlFor="gantt-today-marker">{g.todayMarkerField}</label>
            <input
              id="gantt-today-marker"
              type="text"
              value={ganttData.todayMarker ?? ''}
              placeholder={g.todayMarkerPlaceholder}
              onChange={(e) =>
                onChange({
                  ...ganttData,
                  todayMarker: e.target.value || undefined,
                })
              }
            />
          </div>
        </div>

        <div className="field-row-compact">
          <div className="field-group">
            <label htmlFor="gantt-excludes">{g.excludesField}</label>
            <input
              id="gantt-excludes"
              type="text"
              value={ganttData.excludes ?? ''}
              placeholder={g.excludesPlaceholder}
              onChange={(e) =>
                onChange({
                  ...ganttData,
                  excludes: e.target.value || undefined,
                })
              }
            />
          </div>

          <div className="field-group">
            <label htmlFor="gantt-includes">{g.includesField}</label>
            <input
              id="gantt-includes"
              type="text"
              value={ganttData.includes ?? ''}
              placeholder={g.includesPlaceholder}
              onChange={(e) =>
                onChange({
                  ...ganttData,
                  includes: e.target.value || undefined,
                })
              }
            />
          </div>
        </div>

        <div className="field-row-compact">
          <div className="field-group">
            <label htmlFor="gantt-weekday">{g.weekdayField}</label>
            <select
              id="gantt-weekday"
              value={ganttData.weekday ?? ''}
              onChange={(e) =>
                onChange({
                  ...ganttData,
                  weekday: (e.target.value || undefined) as GanttWeekday | undefined,
                })
              }
            >
              <option value="">{g.weekdayDefault}</option>
              {WEEKDAY_OPTIONS.map((wd) => (
                <option key={wd} value={wd}>
                  {g.weekdays[wd]}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group">
            <label htmlFor="gantt-weekend">{g.weekendField}</label>
            <select
              id="gantt-weekend"
              value={ganttData.weekend ?? 'saturday'}
              onChange={(e) =>
                onChange({
                  ...ganttData,
                  weekend: e.target.value as GanttWeekend,
                })
              }
            >
              <option value="saturday">{g.weekends.saturday}</option>
              <option value="friday">{g.weekends.friday}</option>
            </select>
          </div>
        </div>

        <div className="gantt-tags-group">
          <label className="checkbox-field-label">
            <input
              type="checkbox"
              checked={Boolean(ganttData.inclusiveEndDates)}
              onChange={(e) =>
                onChange({
                  ...ganttData,
                  inclusiveEndDates: e.target.checked ? true : undefined,
                })
              }
            />
            <span>{g.inclusiveEndDatesField}</span>
          </label>
          <label className="checkbox-field-label">
            <input
              type="checkbox"
              checked={Boolean(ganttData.topAxis)}
              onChange={(e) =>
                onChange({
                  ...ganttData,
                  topAxis: e.target.checked ? true : undefined,
                })
              }
            />
            <span>{g.topAxisField}</span>
          </label>
          <label className="checkbox-field-label">
            <input
              type="checkbox"
              checked={Boolean(ganttData.compactMode)}
              onChange={(e) =>
                onChange({
                  ...ganttData,
                  compactMode: e.target.checked ? true : undefined,
                })
              }
            />
            <span>{g.compactModeField}</span>
          </label>
        </div>
      </InspectorCollapsibleSection>

      {/* 4. コメント */}
      <InspectorCommentsSection
        title={t.inspector.commentsHeading}
        placeholder={t.inspector.commentsPlaceholder}
        comments={ganttData.comments}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
        onChangeComments={(nextComments) =>
          onChange({
            ...ganttData,
            comments: nextComments,
          })
        }
      />
    </div>
  );
}
