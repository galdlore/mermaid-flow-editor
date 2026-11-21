import {
  ArrowDown,
  ArrowUp,
  Calendar,
  FolderPlus,
  Plus,
  Trash2,
} from 'lucide-react';
import { useI18n } from '../i18n';
import type {
  TimelineDiagramData,
  TimelinePeriodData,
  TimelineSectionData,
} from '../types/editor';

export interface TimelineCanvasProps {
  timelineData: TimelineDiagramData;
  selectedPeriodId: string | null;
  onChange: (next: TimelineDiagramData) => void;
  onSelectPeriod: (periodId: string | null) => void;
}

function nextUniqueId(existing: Set<string>, prefix: string): string {
  let num = existing.size + 1;
  while (existing.has(`${prefix}_${num}`)) {
    num++;
  }
  return `${prefix}_${num}`;
}

export default function TimelineCanvas({
  timelineData,
  selectedPeriodId,
  onChange,
  onSelectPeriod,
}: TimelineCanvasProps) {
  const { t } = useI18n();
  const tl = t.inspector.timeline;

  const handleAddSection = (): void => {
    const used = new Set(timelineData.sections.map((s) => s.id));
    const id = nextUniqueId(used, 'sec');
    const sec: TimelineSectionData = {
      id,
      title: tl.defaultSectionTitle(timelineData.sections.length + 1),
    };
    onChange({
      ...timelineData,
      sections: [...timelineData.sections, sec],
    });
  };

  const handleAddPeriod = (sectionId?: string): void => {
    const used = new Set(timelineData.periods.map((p) => p.id));
    const id = nextUniqueId(used, 'tp');
    const num = timelineData.periods.length + 1;
    const nextPeriod: TimelinePeriodData = {
      id,
      ...(sectionId ? { sectionId } : {}),
      period: tl.defaultPeriodLabel(num),
      events: [tl.defaultEventText(1)],
    };
    onChange({
      ...timelineData,
      periods: [...timelineData.periods, nextPeriod],
    });
    onSelectPeriod(id);
  };

  const handleAddQuickEvent = (periodId: string): void => {
    onChange({
      ...timelineData,
      periods: timelineData.periods.map((p) =>
        p.id === periodId
          ? {
              ...p,
              events: [...p.events, tl.defaultEventText(p.events.length + 1)],
            }
          : p
      ),
    });
    onSelectPeriod(periodId);
  };

  const handleMovePeriod = (periodId: string, delta: -1 | 1): void => {
    const idx = timelineData.periods.findIndex((p) => p.id === periodId);
    if (idx < 0) return;
    const target = idx + delta;
    if (target < 0 || target >= timelineData.periods.length) return;
    const next = [...timelineData.periods];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    onChange({ ...timelineData, periods: next });
  };

  const handleDeletePeriod = (periodId: string): void => {
    const idx = timelineData.periods.findIndex((p) => p.id === periodId);
    const next = timelineData.periods.filter((p) => p.id !== periodId);
    onChange({ ...timelineData, periods: next });
    if (selectedPeriodId === periodId) {
      onSelectPeriod(next[Math.min(idx, next.length - 1)]?.id ?? null);
    }
  };

  const sectionIds = new Set(timelineData.sections.map((s) => s.id));
  const unassigned = timelineData.periods.filter(
    (p) => !p.sectionId || !sectionIds.has(p.sectionId)
  );

  const groups: Array<{
    key: string;
    sectionId?: string;
    title: string;
    periods: TimelinePeriodData[];
  }> = [
    ...(unassigned.length > 0
      ? [{ key: '__unassigned', title: tl.unassignedLabel, periods: unassigned }]
      : []),
    ...timelineData.sections.map((sec) => ({
      key: sec.id,
      sectionId: sec.id,
      title: sec.title,
      periods: timelineData.periods.filter((p) => p.sectionId === sec.id),
    })),
  ];

  const isVertical = timelineData.direction === 'TD';

  return (
    <div className="timeline-canvas">
      <div className="timeline-toolbar">
        <button
          type="button"
          className="btn-secondary btn-xs"
          onClick={handleAddSection}
        >
          <FolderPlus size={13} />
          <span>{tl.addSectionBtn}</span>
        </button>
        <button
          type="button"
          className="btn-secondary btn-xs"
          onClick={() => handleAddPeriod(timelineData.sections[0]?.id)}
        >
          <Plus size={13} />
          <span>{tl.addPeriodBtn}</span>
        </button>
      </div>

      <div className="timeline-canvas-scroll">
        {timelineData.title && (
          <div className="timeline-title-banner">
            <Calendar size={14} />
            <span>{timelineData.title}</span>
          </div>
        )}

        {timelineData.periods.length === 0 &&
        timelineData.sections.length === 0 ? (
          <div className="timeline-empty-state">{tl.emptyPeriods}</div>
        ) : (
          <div
            className={`timeline-groups ${
              isVertical ? 'is-vertical' : 'is-horizontal'
            }`}
          >
            {groups.map((grp) => (
              <div key={grp.key} className="timeline-section-band">
                <div className="timeline-section-header">
                  <span className="timeline-section-title">{grp.title}</span>
                  <button
                    type="button"
                    className="timeline-section-add-btn"
                    title={tl.addPeriodToSectionTitle}
                    onClick={() => handleAddPeriod(grp.sectionId)}
                  >
                    <Plus size={12} />
                  </button>
                </div>

                <div
                  className={`timeline-periods-track ${
                    isVertical ? 'is-vertical' : 'is-horizontal'
                  }`}
                >
                  {grp.periods.length === 0 ? (
                    <div className="timeline-section-empty">
                      {tl.emptyPeriods}
                    </div>
                  ) : (
                    grp.periods.map((period) => {
                      const isSelected = period.id === selectedPeriodId;
                      const globalIdx = timelineData.periods.findIndex(
                        (p) => p.id === period.id
                      );
                      return (
                        <div
                          key={period.id}
                          className={`timeline-period-card ${
                            isSelected ? 'is-selected' : ''
                          }`}
                          onClick={() => onSelectPeriod(period.id)}
                        >
                          <div className="timeline-period-header">
                            <span className="timeline-period-badge">
                              {period.period}
                            </span>
                            <div
                              className="timeline-period-actions"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="treeview-action-btn"
                                title={tl.moveUpTitle}
                                disabled={globalIdx <= 0}
                                onClick={() => handleMovePeriod(period.id, -1)}
                              >
                                <ArrowUp size={11} />
                              </button>
                              <button
                                type="button"
                                className="treeview-action-btn"
                                title={tl.moveDownTitle}
                                disabled={
                                  globalIdx >= timelineData.periods.length - 1
                                }
                                onClick={() => handleMovePeriod(period.id, 1)}
                              >
                                <ArrowDown size={11} />
                              </button>
                              <button
                                type="button"
                                className="treeview-action-btn is-danger"
                                title={tl.deletePeriodBtn}
                                onClick={() => handleDeletePeriod(period.id)}
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>

                          <ul className="timeline-event-list">
                            {period.events.map((ev, evIdx) => (
                              <li key={evIdx} className="timeline-event-chip">
                                {ev}
                              </li>
                            ))}
                          </ul>

                          <button
                            type="button"
                            className="timeline-inline-add-event"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddQuickEvent(period.id);
                            }}
                          >
                            <Plus size={11} />
                            <span>{tl.addEventBtn}</span>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
