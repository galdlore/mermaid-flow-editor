import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import { InspectorCollapsibleSection } from './InspectorCollapsibleSection';
import {
  InspectorBulkControls,
  InspectorCommentsSection,
} from './InspectorCommon';
import { FORBIDDEN_TIMELINE_TEXT_CHARS_REGEX } from '../utils/inputSafeguard';
import type {
  TimelineDiagramData,
  TimelineDirection,
  TimelinePeriodData,
} from '../types/editor';

export interface TimelineInspectorProps {
  timelineData: TimelineDiagramData;
  selectedPeriodId: string | null;
  onChange: (next: TimelineDiagramData) => void;
  onSelectPeriod: (periodId: string | null) => void;
}

type TimelineSectionKey = 'period' | 'sections' | 'settings' | 'comments';

const DIRECTIONS: TimelineDirection[] = ['LR', 'TD'];

export default function TimelineInspector({
  timelineData,
  selectedPeriodId,
  onChange,
  onSelectPeriod,
}: TimelineInspectorProps) {
  const { t } = useI18n();
  const tl = t.inspector.timeline;
  const safeguard = t.inspector.safeguard;

  const selectedIndex = timelineData.periods.findIndex(
    (p) => p.id === selectedPeriodId
  );
  const selectedPeriod =
    selectedIndex >= 0 ? timelineData.periods[selectedIndex] : null;

  const [openSections, setOpenSections] = useState<
    Record<TimelineSectionKey, boolean>
  >({
    period: true,
    sections: false,
    settings: false,
    comments: false,
  });

  useEffect(() => {
    if (selectedPeriodId) {
      setOpenSections((prev) =>
        prev.period ? prev : { ...prev, period: true }
      );
    }
  }, [selectedPeriodId]);

  const toggleSection = (key: TimelineSectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSections = (open: boolean): void => {
    setOpenSections({
      period: open,
      sections: open,
      settings: open,
      comments: open,
    });
  };

  const allExpanded = Object.values(openSections).every(Boolean);

  const updateSelectedPeriod = (patch: Partial<TimelinePeriodData>): void => {
    if (!selectedPeriod) return;
    onChange({
      ...timelineData,
      periods: timelineData.periods.map((p) =>
        p.id === selectedPeriod.id ? { ...p, ...patch } : p
      ),
    });
  };

  const handleEventChange = (evIdx: number, value: string): void => {
    if (!selectedPeriod) return;
    const nextEvents = selectedPeriod.events.map((ev, i) =>
      i === evIdx ? value : ev
    );
    updateSelectedPeriod({ events: nextEvents });
  };

  const handleAddEvent = (): void => {
    if (!selectedPeriod) return;
    updateSelectedPeriod({
      events: [
        ...selectedPeriod.events,
        tl.defaultEventText(selectedPeriod.events.length + 1),
      ],
    });
  };

  const handleMoveEvent = (evIdx: number, delta: -1 | 1): void => {
    if (!selectedPeriod) return;
    const target = evIdx + delta;
    if (target < 0 || target >= selectedPeriod.events.length) return;
    const nextEvents = [...selectedPeriod.events];
    const [moved] = nextEvents.splice(evIdx, 1);
    nextEvents.splice(target, 0, moved);
    updateSelectedPeriod({ events: nextEvents });
  };

  const handleDeleteEvent = (evIdx: number): void => {
    if (!selectedPeriod) return;
    updateSelectedPeriod({
      events: selectedPeriod.events.filter((_, i) => i !== evIdx),
    });
  };

  const handleDeleteSelectedPeriod = (): void => {
    if (!selectedPeriod) return;
    const next = timelineData.periods.filter((p) => p.id !== selectedPeriod.id);
    onChange({ ...timelineData, periods: next });
    onSelectPeriod(
      next[Math.min(selectedIndex, next.length - 1)]?.id ?? null
    );
  };

  const handleAddSection = (): void => {
    const used = new Set(timelineData.sections.map((s) => s.id));
    let num = timelineData.sections.length + 1;
    while (used.has(`sec_${num}`)) {
      num++;
    }
    onChange({
      ...timelineData,
      sections: [
        ...timelineData.sections,
        { id: `sec_${num}`, title: tl.defaultSectionTitle(num) },
      ],
    });
  };

  const handleUpdateSectionTitle = (secId: string, title: string): void => {
    onChange({
      ...timelineData,
      sections: timelineData.sections.map((s) =>
        s.id === secId ? { ...s, title } : s
      ),
    });
  };

  const handleMoveSection = (secIdx: number, delta: -1 | 1): void => {
    const target = secIdx + delta;
    if (target < 0 || target >= timelineData.sections.length) return;
    const next = [...timelineData.sections];
    const [moved] = next.splice(secIdx, 1);
    next.splice(target, 0, moved);
    onChange({ ...timelineData, sections: next });
  };

  const handleDeleteSection = (secId: string): void => {
    onChange({
      ...timelineData,
      sections: timelineData.sections.filter((s) => s.id !== secId),
      periods: timelineData.periods.map((p) =>
        p.sectionId === secId ? { ...p, sectionId: undefined } : p
      ),
    });
  };

  return (
    <div className="inspector-panel">
      <InspectorBulkControls allExpanded={allExpanded} onSetAll={setAllSections} />

      <InspectorCollapsibleSection
        title={tl.periodSection}
        badgeText={timelineData.periods.length}
        isOpen={openSections.period}
        onToggle={() => toggleSection('period')}
      >
        {selectedPeriod ? (
          <>
            <label className="inspector-field">
              <span>{tl.periodLabelField}</span>
              <GuardedInput
                value={selectedPeriod.period}
                placeholder={tl.periodLabelPlaceholder}
                forbiddenRegex={FORBIDDEN_TIMELINE_TEXT_CHARS_REGEX}
                formatError={safeguard.timelineTextErrorChars}
                onChangeValue={(period) => updateSelectedPeriod({ period })}
              />
            </label>

            <label className="inspector-field">
              <span>{tl.periodSectionField}</span>
              <select
                value={selectedPeriod.sectionId ?? ''}
                onChange={(e) =>
                  updateSelectedPeriod({
                    sectionId: e.target.value || undefined,
                  })
                }
              >
                <option value="">{tl.unassignedLabel}</option>
                {timelineData.sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.title}
                  </option>
                ))}
              </select>
            </label>

            <div className="inspector-field">
              <div className="timeline-events-heading-row">
                <span>{tl.eventsListHeading}</span>
                <button
                  type="button"
                  className="btn-secondary btn-xs"
                  onClick={handleAddEvent}
                >
                  <Plus size={12} />
                  <span>{tl.addEventBtn}</span>
                </button>
              </div>
              <div className="timeline-events-editor">
                {selectedPeriod.events.map((ev, evIdx) => (
                  <div key={evIdx} className="timeline-event-edit-row">
                    <GuardedInput
                      value={ev}
                      placeholder={tl.eventTextPlaceholder}
                      forbiddenRegex={FORBIDDEN_TIMELINE_TEXT_CHARS_REGEX}
                      formatError={safeguard.timelineTextErrorChars}
                      onChangeValue={(val) => handleEventChange(evIdx, val)}
                    />
                    <button
                      type="button"
                      className="treeview-action-btn"
                      title={tl.moveUpTitle}
                      disabled={evIdx === 0}
                      onClick={() => handleMoveEvent(evIdx, -1)}
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      className="treeview-action-btn"
                      title={tl.moveDownTitle}
                      disabled={evIdx === selectedPeriod.events.length - 1}
                      onClick={() => handleMoveEvent(evIdx, 1)}
                    >
                      <ArrowDown size={12} />
                    </button>
                    <button
                      type="button"
                      className="treeview-action-btn is-danger"
                      title={tl.deleteEventTitle}
                      onClick={() => handleDeleteEvent(evIdx)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleDeleteSelectedPeriod}
            >
              <Trash2 size={14} />
              <span>{tl.deletePeriodBtn}</span>
            </button>
          </>
        ) : (
          <p className="inspector-hint">{tl.selectPeriodPrompt}</p>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={tl.sectionsSection}
        badgeText={timelineData.sections.length}
        isOpen={openSections.sections}
        onToggle={() => toggleSection('sections')}
        headerAction={
          <button
            type="button"
            className="btn-secondary btn-xs"
            onClick={handleAddSection}
          >
            <Plus size={12} />
            <span>{tl.addSectionBtn}</span>
          </button>
        }
      >
        {timelineData.sections.length === 0 ? (
          <p className="inspector-hint">{tl.emptySections}</p>
        ) : (
          <div className="timeline-sections-list">
            {timelineData.sections.map((sec, idx) => (
              <div key={sec.id} className="timeline-section-edit-row">
                <GuardedInput
                  value={sec.title}
                  placeholder={tl.sectionTitleField}
                  forbiddenRegex={FORBIDDEN_TIMELINE_TEXT_CHARS_REGEX}
                  formatError={safeguard.timelineTextErrorChars}
                  onChangeValue={(val) => handleUpdateSectionTitle(sec.id, val)}
                />
                <button
                  type="button"
                  className="treeview-action-btn"
                  title={tl.moveUpTitle}
                  disabled={idx === 0}
                  onClick={() => handleMoveSection(idx, -1)}
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  className="treeview-action-btn"
                  title={tl.moveDownTitle}
                  disabled={idx === timelineData.sections.length - 1}
                  onClick={() => handleMoveSection(idx, 1)}
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  type="button"
                  className="treeview-action-btn is-danger"
                  title={tl.deleteSectionTitle}
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
        title={tl.settingsSection}
        isOpen={openSections.settings}
        onToggle={() => toggleSection('settings')}
      >
        <label className="inspector-field">
          <span>{tl.titleField}</span>
          <GuardedInput
            value={timelineData.title ?? ''}
            placeholder={tl.titlePlaceholder}
            forbiddenRegex={FORBIDDEN_TIMELINE_TEXT_CHARS_REGEX}
            formatError={safeguard.timelineTextErrorChars}
            onChangeValue={(val) =>
              onChange({ ...timelineData, title: val || undefined })
            }
          />
        </label>

        <div className="inspector-field">
          <span>{tl.directionField}</span>
          <div className="direction-grid">
            {DIRECTIONS.map((dir) => (
              <button
                key={dir}
                type="button"
                className={`inspector-choice-btn ${
                  (timelineData.direction ?? 'LR') === dir ? 'is-active' : ''
                }`}
                onClick={() => onChange({ ...timelineData, direction: dir })}
              >
                {tl.directions[dir]}
              </button>
            ))}
          </div>
        </div>
      </InspectorCollapsibleSection>

      <InspectorCommentsSection
        title={tl.commentsSection}
        fieldLabel={tl.commentsField}
        placeholder={tl.commentsPlaceholder}
        comments={timelineData.comments}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
        onChangeComments={(nextComments) =>
          onChange({
            ...timelineData,
            comments: nextComments,
          })
        }
      />
    </div>
  );
}
