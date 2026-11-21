import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import { InspectorCollapsibleSection } from './InspectorCollapsibleSection';
import {
  CommitIdInput,
  InspectorBulkControls,
  InspectorCommentsSection,
} from './InspectorCommon';
import {
  FORBIDDEN_EVENTMODELING_ID_CHARS_REGEX,
  FORBIDDEN_EVENTMODELING_TEXT_CHARS_REGEX,
  FORBIDDEN_REQUIREMENT_TEXT_CHARS_REGEX,
} from '../utils/inputSafeguard';
import {
  EVENTMODELING_DATA_TYPE_OPTIONS,
  EVENTMODELING_ENTITY_TYPE_OPTIONS,
  sanitizeEventModelingId,
} from '../utils/eventModelingConverter';
import { allocateUniqueId } from '../utils/mermaidEnvelope';
import type {
  EventModelingDataType,
  EventModelingDiagramData,
  EventModelingEntityType,
  EventModelingFrameData,
  EventModelingFrameKind,
} from '../types/editor';

export interface EventModelingInspectorProps {
  eventModelingData: EventModelingDiagramData;
  selectedFrameId: string | null;
  onChange: (next: EventModelingDiagramData) => void;
  onSelectFrame: (frameId: string | null) => void;
}

type EmSectionKey = 'frame' | 'dataEntities' | 'notes' | 'settings' | 'comments';

export default function EventModelingInspector({
  eventModelingData,
  selectedFrameId,
  onChange,
  onSelectFrame,
}: EventModelingInspectorProps) {
  const { t } = useI18n();
  const em = t.inspector.eventmodeling;
  const safeguard = t.inspector.safeguard;

  const selectedFrame =
    eventModelingData.frames.find((f) => f.id === selectedFrameId) ?? null;

  const [openSections, setOpenSections] = useState<Record<EmSectionKey, boolean>>({
    frame: true,
    dataEntities: false,
    notes: false,
    settings: false,
    comments: false,
  });

  useEffect(() => {
    if (selectedFrameId) {
      setOpenSections((prev) => (prev.frame ? prev : { ...prev, frame: true }));
    }
  }, [selectedFrameId]);

  const toggleSection = (key: EmSectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSections = (open: boolean): void => {
    setOpenSections({
      frame: open,
      dataEntities: open,
      notes: open,
      settings: open,
      comments: open,
    });
  };

  const allExpanded = Object.values(openSections).every(Boolean);

  const updateFrame = (patch: Partial<EventModelingFrameData>): void => {
    if (!selectedFrame) return;
    onChange({
      ...eventModelingData,
      frames: eventModelingData.frames.map((f) =>
        f.id === selectedFrame.id ? { ...f, ...patch } : f
      ),
    });
  };

  const handleRenameFrameNumber = (rawNext: string): string => {
    if (!selectedFrame) return '';
    const digits = rawNext.replace(/[^0-9]/g, '').slice(0, 3);
    if (!digits) return selectedFrame.frameNumber;
    if (
      digits !== selectedFrame.frameNumber &&
      eventModelingData.frames.some((f) => f.frameNumber === digits)
    ) {
      return selectedFrame.frameNumber;
    }
    const oldNum = selectedFrame.frameNumber;
    onChange({
      ...eventModelingData,
      frames: eventModelingData.frames.map((f) =>
        f.id === selectedFrame.id
          ? { ...f, frameNumber: digits }
          : {
              ...f,
              sourceFrames: f.sourceFrames.map((s) => (s === oldNum ? digits : s)),
            }
      ),
      notes: (eventModelingData.notes ?? []).map((n) =>
        n.frameNumber === oldNum ? { ...n, frameNumber: digits } : n
      ),
    });
    return digits;
  };

  const toggleSourceFrame = (srcNum: string): void => {
    if (!selectedFrame) return;
    const exists = selectedFrame.sourceFrames.includes(srcNum);
    updateFrame({
      sourceFrames: exists
        ? selectedFrame.sourceFrames.filter((s) => s !== srcNum)
        : [...selectedFrame.sourceFrames, srcNum],
    });
  };

  const handleDeleteFrame = (): void => {
    if (!selectedFrame) return;
    const oldNum = selectedFrame.frameNumber;
    const nextFrames = eventModelingData.frames
      .filter((f) => f.id !== selectedFrame.id)
      .map((f) => ({
        ...f,
        sourceFrames: f.sourceFrames.filter((s) => s !== oldNum),
      }));
    const nextNotes = (eventModelingData.notes ?? []).filter(
      (n) => n.frameNumber !== oldNum
    );
    onChange({
      ...eventModelingData,
      frames: nextFrames,
      notes: nextNotes,
    });
    onSelectFrame(nextFrames[0]?.id ?? null);
  };

  const handleAddData = (): void => {
    const usedIds = new Set(eventModelingData.dataEntities.map((d) => d.id));
    const usedNames = new Set(eventModelingData.dataEntities.map((d) => d.name));
    const id = allocateUniqueId(
      `emd_${eventModelingData.dataEntities.length + 1}`,
      usedIds
    );
    const name = allocateUniqueId(
      `Payload${eventModelingData.dataEntities.length + 1}`,
      usedNames
    );
    onChange({
      ...eventModelingData,
      dataEntities: [
        ...eventModelingData.dataEntities,
        { id, name, dataType: 'json', body: '{\n  "ok": true\n}' },
      ],
    });
  };

  const handleAddNote = (): void => {
    const targetNum =
      selectedFrame?.frameNumber ?? eventModelingData.frames[0]?.frameNumber;
    if (!targetNum) return;
    const notes = eventModelingData.notes ?? [];
    const usedIds = new Set(notes.map((n) => n.id));
    const id = allocateUniqueId(`emn_${notes.length + 1}`, usedIds);
    onChange({
      ...eventModelingData,
      notes: [...notes, { id, frameNumber: targetNum, body: em.noteBodyPlaceholder }],
    });
  };

  return (
    <div className="inspector-panel">
      <InspectorBulkControls allExpanded={allExpanded} onSetAll={setAllSections} />

      <InspectorCollapsibleSection
        title={em.frameSection}
        isOpen={openSections.frame}
        onToggle={() => toggleSection('frame')}
      >
        {selectedFrame ? (
          <>
            <label className="inspector-field">
              <span>{em.frameKindField}</span>
              <select
                value={selectedFrame.frameKind}
                onChange={(e) =>
                  updateFrame({ frameKind: e.target.value as EventModelingFrameKind })
                }
              >
                <option value="tf">{em.frameKinds.tf}</option>
                <option value="rf">{em.frameKinds.rf}</option>
              </select>
            </label>

            <CommitIdInput
              label={em.frameNumberField}
              value={selectedFrame.frameNumber}
              placeholder={em.frameNumberPlaceholder}
              hint={em.frameNumberHint}
              forbiddenRegex={/[^0-9]/g}
              formatError={safeguard.eventModelingIdErrorChars}
              onCommit={handleRenameFrameNumber}
            />

            <label className="inspector-field">
              <span>{em.entityTypeField}</span>
              <select
                value={selectedFrame.entityType}
                onChange={(e) =>
                  updateFrame({
                    entityType: e.target.value as EventModelingEntityType,
                  })
                }
              >
                {EVENTMODELING_ENTITY_TYPE_OPTIONS.map((et) => (
                  <option key={et} value={et}>
                    {em.entityTypes[et]}
                  </option>
                ))}
              </select>
            </label>

            <label className="inspector-field">
              <span>{em.namespaceField}</span>
              <GuardedInput
                value={selectedFrame.namespace ?? ''}
                placeholder={em.namespacePlaceholder}
                forbiddenRegex={FORBIDDEN_EVENTMODELING_ID_CHARS_REGEX}
                formatError={safeguard.eventModelingIdErrorChars}
                onChangeValue={(val) =>
                  updateFrame({ namespace: val || undefined })
                }
              />
            </label>

            <label className="inspector-field">
              <span>{em.entityNameField}</span>
              <GuardedInput
                value={selectedFrame.entityName}
                placeholder={em.entityNamePlaceholder}
                forbiddenRegex={FORBIDDEN_EVENTMODELING_ID_CHARS_REGEX}
                formatError={safeguard.eventModelingIdErrorChars}
                onChangeValue={(entityName) => updateFrame({ entityName })}
              />
            </label>

            <div className="inspector-field">
              <span>{em.sourceFramesField}</span>
              <div className="em-pill-toggle-grid">
                {eventModelingData.frames
                  .filter((f) => f.id !== selectedFrame.id)
                  .map((f) => {
                    const active = selectedFrame.sourceFrames.includes(f.frameNumber);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        className={`inspector-choice-btn ${active ? 'is-active' : ''}`}
                        onClick={() => toggleSourceFrame(f.frameNumber)}
                      >
                        {f.frameNumber}
                      </button>
                    );
                  })}
              </div>
            </div>

            <label className="inspector-field">
              <span>{em.dataRefField}</span>
              <select
                value={selectedFrame.dataRef ?? ''}
                onChange={(e) =>
                  updateFrame({ dataRef: e.target.value || undefined })
                }
              >
                <option value="">{em.noDataRefOption}</option>
                {eventModelingData.dataEntities.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="inspector-field">
              <span>{em.inlineDataField}</span>
              <GuardedInput
                value={selectedFrame.inlineData ?? ''}
                placeholder={em.inlineDataPlaceholder}
                forbiddenRegex={FORBIDDEN_EVENTMODELING_TEXT_CHARS_REGEX}
                formatError={safeguard.eventModelingTextErrorChars}
                onChangeValue={(val) =>
                  updateFrame({ inlineData: val || undefined })
                }
              />
            </label>

            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleDeleteFrame}
            >
              <Trash2 size={14} />
              <span>{em.deleteFrameBtn}</span>
            </button>
          </>
        ) : (
          <p className="inspector-hint">{em.selectFramePrompt}</p>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={em.dataEntitiesSection}
        isOpen={openSections.dataEntities}
        onToggle={() => toggleSection('dataEntities')}
      >
        <div className="timeline-events-heading-row">
          <span />
          <button
            type="button"
            className="btn-secondary btn-xs"
            onClick={handleAddData}
          >
            <Plus size={12} />
            <span>{em.addDataBtn}</span>
          </button>
        </div>
        {eventModelingData.dataEntities.length === 0 ? (
          <p className="inspector-hint">{em.emptyDataEntities}</p>
        ) : (
          <div className="timeline-events-editor">
            {eventModelingData.dataEntities.map((d) => (
              <div key={d.id} className="inspector-list-card">
                <label className="inspector-field">
                  <span>{em.dataNameField}</span>
                  <GuardedInput
                    value={d.name}
                    placeholder={em.dataNamePlaceholder}
                    forbiddenRegex={FORBIDDEN_EVENTMODELING_ID_CHARS_REGEX}
                    formatError={safeguard.eventModelingIdErrorChars}
                    onChangeValue={(val) => {
                      const nextName = sanitizeEventModelingId(val, d.name);
                      onChange({
                        ...eventModelingData,
                        dataEntities: eventModelingData.dataEntities.map((item) =>
                          item.id === d.id ? { ...item, name: nextName } : item
                        ),
                      });
                    }}
                  />
                </label>
                <label className="inspector-field">
                  <span>{em.dataTypeField}</span>
                  <select
                    value={d.dataType ?? ''}
                    onChange={(e) =>
                      onChange({
                        ...eventModelingData,
                        dataEntities: eventModelingData.dataEntities.map((item) =>
                          item.id === d.id
                            ? {
                                ...item,
                                dataType: e.target.value
                                  ? (e.target.value as EventModelingDataType)
                                  : undefined,
                              }
                            : item
                        ),
                      })
                    }
                  >
                    <option value="">{em.noInlineDataOption}</option>
                    {EVENTMODELING_DATA_TYPE_OPTIONS.map((dt) => (
                      <option key={dt} value={dt}>
                        {em.dataTypeOptions[dt]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inspector-field">
                  <span>{em.dataBodyField}</span>
                  <textarea
                    className="em-textarea"
                    value={d.body}
                    placeholder={em.dataBodyPlaceholder}
                    onChange={(e) =>
                      onChange({
                        ...eventModelingData,
                        dataEntities: eventModelingData.dataEntities.map((item) =>
                          item.id === d.id ? { ...item, body: e.target.value } : item
                        ),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="btn-icon-subtle is-danger"
                  title={em.deleteDataTitle}
                  onClick={() =>
                    onChange({
                      ...eventModelingData,
                      dataEntities: eventModelingData.dataEntities.filter(
                        (item) => item.id !== d.id
                      ),
                    })
                  }
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={em.notesSection}
        isOpen={openSections.notes}
        onToggle={() => toggleSection('notes')}
      >
        <div className="timeline-events-heading-row">
          <span />
          <button
            type="button"
            className="btn-secondary btn-xs"
            disabled={eventModelingData.frames.length === 0}
            onClick={handleAddNote}
          >
            <Plus size={12} />
            <span>{em.addNoteBtn}</span>
          </button>
        </div>
        {(eventModelingData.notes ?? []).length === 0 ? (
          <p className="inspector-hint">{em.emptyNotes}</p>
        ) : (
          <div className="timeline-events-editor">
            {(eventModelingData.notes ?? []).map((note) => (
              <div key={note.id} className="inspector-list-card">
                <label className="inspector-field">
                  <span>{em.noteFrameField}</span>
                  <select
                    value={note.frameNumber}
                    onChange={(e) =>
                      onChange({
                        ...eventModelingData,
                        notes: (eventModelingData.notes ?? []).map((n) =>
                          n.id === note.id
                            ? { ...n, frameNumber: e.target.value }
                            : n
                        ),
                      })
                    }
                  >
                    {eventModelingData.frames.map((f) => (
                      <option key={f.id} value={f.frameNumber}>
                        {f.frameNumber} ({f.entityName})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inspector-field">
                  <span>{em.noteBodyField}</span>
                  <textarea
                    className="em-textarea"
                    value={note.body}
                    placeholder={em.noteBodyPlaceholder}
                    onChange={(e) =>
                      onChange({
                        ...eventModelingData,
                        notes: (eventModelingData.notes ?? []).map((n) =>
                          n.id === note.id ? { ...n, body: e.target.value } : n
                        ),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="btn-icon-subtle is-danger"
                  title={em.deleteNoteTitle}
                  onClick={() =>
                    onChange({
                      ...eventModelingData,
                      notes: (eventModelingData.notes ?? []).filter(
                        (n) => n.id !== note.id
                      ),
                    })
                  }
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={em.settingsSection}
        isOpen={openSections.settings}
        onToggle={() => toggleSection('settings')}
      >
        <label className="inspector-field">
          <span>{em.titleField}</span>
          <GuardedInput
            value={eventModelingData.title ?? ''}
            placeholder={em.titlePlaceholder}
            forbiddenRegex={FORBIDDEN_REQUIREMENT_TEXT_CHARS_REGEX}
            formatError={safeguard.requirementTextErrorChars}
            onChangeValue={(val) =>
              onChange({ ...eventModelingData, title: val || undefined })
            }
          />
        </label>
      </InspectorCollapsibleSection>

      <InspectorCommentsSection
        title={em.commentsSection}
        fieldLabel={em.commentsField}
        placeholder={em.commentsPlaceholder}
        comments={eventModelingData.comments}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
        onChangeComments={(comments) =>
          onChange({ ...eventModelingData, comments })
        }
      />
    </div>
  );
}
