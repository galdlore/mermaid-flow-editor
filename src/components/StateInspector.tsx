import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import { InspectorCollapsibleSection } from './InspectorCollapsibleSection';
import {
  CommitIdInput,
  InspectorBulkControls,
  InspectorColorPalette,
  InspectorCommentsSection,
} from './InspectorCommon';
import {
  FORBIDDEN_STATE_ID_CHARS_REGEX,
  FORBIDDEN_STATE_LABEL_CHARS_REGEX,
  FORBIDDEN_STATE_TEXT_CHARS_REGEX,
} from '../utils/inputSafeguard';
import type {
  StateDiagramData,
  StateDiagramDirection,
  StateKind,
  StateNodeData,
  StateNoteData,
  StateNotePosition,
  StateTransitionData,
} from '../types/editor';
import {
  START_END_STATE_ID,
  STATE_DIRECTION_OPTIONS,
  STATE_KIND_OPTIONS,
  STATE_NOTE_POSITION_OPTIONS,
  collectStateDescendantIds,
  createUniqueStateNoteId,
  createUniqueStateTransitionId,
  sanitizeStateId,
} from '../utils/stateConverter';

export interface StateInspectorProps {
  stateData: StateDiagramData;
  selectedStateId: string | null;
  selectedTransitionId: string | null;
  onChange: (next: StateDiagramData) => void;
  onSelectState: (stateId: string | null) => void;
  onSelectTransition: (transitionId: string | null) => void;
}

type StateSectionKey = 'state' | 'transition' | 'notes' | 'settings' | 'comments';

export default function StateInspector({
  stateData,
  selectedStateId,
  selectedTransitionId,
  onChange,
  onSelectState,
  onSelectTransition,
}: StateInspectorProps) {
  const { t } = useI18n();
  const sText = t.inspector.stateDiagram;
  const safeguard = t.inspector.safeguard;

  const selectedState =
    stateData.states.find((item) => item.id === selectedStateId) ?? null;
  const selectedTransition =
    stateData.transitions.find((item) => item.id === selectedTransitionId) ??
    null;
  const notes = stateData.notes ?? [];

  const [openSections, setOpenSections] = useState<Record<StateSectionKey, boolean>>({
    state: true,
    transition: true,
    notes: false,
    settings: false,
    comments: false,
  });

  useEffect(() => {
    if (selectedStateId) {
      setOpenSections((prev) => (prev.state ? prev : { ...prev, state: true }));
    }
  }, [selectedStateId]);

  useEffect(() => {
    if (selectedTransitionId) {
      setOpenSections((prev) =>
        prev.transition ? prev : { ...prev, transition: true }
      );
    }
  }, [selectedTransitionId]);

  const toggleSection = (key: StateSectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSections = (open: boolean): void => {
    setOpenSections({
      state: open,
      transition: open,
      notes: open,
      settings: open,
      comments: open,
    });
  };

  const allExpanded = Object.values(openSections).every(Boolean);

  const compositeParents = useMemo(() => {
    if (!selectedState) {
      return stateData.states.filter((st) => st.kind === 'composite');
    }
    const descendants = collectStateDescendantIds(
      selectedState.id,
      stateData.states
    );
    return stateData.states.filter(
      (st) =>
        st.kind === 'composite' &&
        st.id !== selectedState.id &&
        !descendants.has(st.id)
    );
  }, [selectedState, stateData.states]);

  const allCompositeStates = useMemo(
    () => stateData.states.filter((st) => st.kind === 'composite'),
    [stateData.states]
  );

  const updateSelectedState = (
    updater: (st: StateNodeData) => StateNodeData
  ): void => {
    if (!selectedState) return;
    onChange({
      ...stateData,
      states: stateData.states.map((item) =>
        item.id === selectedState.id ? updater(item) : item
      ),
    });
  };

  const commitStateIdRename = (rawNext: string): string => {
    if (!selectedState) return '';
    const oldId = selectedState.id;
    const sanitized = sanitizeStateId(rawNext);
    if (sanitized === oldId) {
      return oldId;
    }

    const usedIds = new Set(
      stateData.states.filter((s) => s.id !== oldId).map((s) => s.id)
    );
    let uniqueNext = sanitized;
    let suffix = 2;
    while (usedIds.has(uniqueNext)) {
      uniqueNext = `${sanitized}_${suffix++}`;
    }

    const nextNotes = notes.map((n) =>
      n.targetStateId === oldId ? { ...n, targetStateId: uniqueNext } : n
    );

    onChange({
      ...stateData,
      states: stateData.states.map((st) => ({
        ...st,
        id: st.id === oldId ? uniqueNext : st.id,
        ...(st.parentId === oldId ? { parentId: uniqueNext } : {}),
      })),
      transitions: stateData.transitions.map((tr) => ({
        ...tr,
        from: tr.from === oldId ? uniqueNext : tr.from,
        to: tr.to === oldId ? uniqueNext : tr.to,
        ...(tr.scopeId === oldId ? { scopeId: uniqueNext } : {}),
      })),
      ...(nextNotes.length > 0 ? { notes: nextNotes } : {}),
    });
    onSelectState(uniqueNext);
    return uniqueNext;
  };

  const handleStateKindChange = (nextKind: StateKind): void => {
    if (!selectedState || selectedState.kind === nextKind) return;
    const id = selectedState.id;
    const leavingComposite =
      selectedState.kind === 'composite' && nextKind !== 'composite';

    onChange({
      ...stateData,
      states: stateData.states.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            kind: nextKind,
            ...(nextKind !== 'composite' ? { subDirection: undefined } : {}),
            ...(nextKind !== 'normal' ? { description: undefined } : {}),
          };
        }
        if (leavingComposite && item.parentId === id) {
          return { ...item, parentId: undefined };
        }
        return item;
      }),
      transitions: leavingComposite
        ? stateData.transitions.map((tr) =>
            tr.scopeId === id ? { ...tr, scopeId: undefined } : tr
          )
        : stateData.transitions,
    });
  };

  const handleDeleteSelectedState = (): void => {
    if (!selectedState) return;
    const delId = selectedState.id;
    const nextStates = stateData.states
      .filter((item) => item.id !== delId)
      .map((item) =>
        item.parentId === delId ? { ...item, parentId: undefined } : item
      );
    const nextTransitions = stateData.transitions
      .filter((tr) => tr.from !== delId && tr.to !== delId)
      .map((tr) =>
        tr.scopeId === delId ? { ...tr, scopeId: undefined } : tr
      );
    const nextNotes = notes.filter((n) => n.targetStateId !== delId);

    onChange({
      ...stateData,
      states: nextStates,
      transitions: nextTransitions,
      ...(nextNotes.length > 0 ? { notes: nextNotes } : { notes: undefined }),
    });
    onSelectState(nextStates[0]?.id ?? null);
    if (
      selectedTransitionId &&
      !nextTransitions.some((tr) => tr.id === selectedTransitionId)
    ) {
      onSelectTransition(nextTransitions[0]?.id ?? null);
    }
  };

  const handleQuickAddTransition = (): void => {
    if (!selectedState) return;
    const otherState = stateData.states.find((s) => s.id !== selectedState.id);
    const created: StateTransitionData = {
      id: createUniqueStateTransitionId(stateData.transitions),
      from: selectedState.id,
      to: otherState ? otherState.id : START_END_STATE_ID,
      label: sText.defaultTransitionLabel,
      ...(selectedState.parentId ? { scopeId: selectedState.parentId } : {}),
    };
    onChange({
      ...stateData,
      transitions: [...stateData.transitions, created],
    });
    onSelectTransition(created.id);
  };

  const updateSelectedTransition = (
    updater: (tr: StateTransitionData) => StateTransitionData
  ): void => {
    if (!selectedTransition) return;
    onChange({
      ...stateData,
      transitions: stateData.transitions.map((tr) =>
        tr.id === selectedTransition.id ? updater(tr) : tr
      ),
    });
  };

  const handleDeleteSelectedTransition = (): void => {
    if (!selectedTransition) return;
    const nextTransitions = stateData.transitions.filter(
      (tr) => tr.id !== selectedTransition.id
    );
    onChange({ ...stateData, transitions: nextTransitions });
    onSelectTransition(nextTransitions[0]?.id ?? null);
  };

  const handleAddNote = (): void => {
    const target = selectedState?.id ?? stateData.states[0]?.id;
    if (!target) return;
    const created: StateNoteData = {
      id: createUniqueStateNoteId(notes),
      targetStateId: target,
      position: 'right of',
      text: sText.defaultNoteText,
    };
    onChange({ ...stateData, notes: [...notes, created] });
  };

  const updateNote = (
    noteId: string,
    updater: (n: StateNoteData) => StateNoteData
  ): void => {
    onChange({
      ...stateData,
      notes: notes.map((n) => (n.id === noteId ? updater(n) : n)),
    });
  };

  const deleteNote = (noteId: string): void => {
    const nextNotes = notes.filter((n) => n.id !== noteId);
    onChange({
      ...stateData,
      notes: nextNotes.length > 0 ? nextNotes : undefined,
    });
  };

  const renderEndpointOptions = () => (
    <>
      <option value={START_END_STATE_ID}>{sText.startEndLabel}</option>
      {stateData.states.map((st) => (
        <option key={st.id} value={st.id}>
          {st.label && st.label !== st.id ? `${st.label} (${st.id})` : st.id}
        </option>
      ))}
    </>
  );

  return (
    <div className="inspector-panel">
      <InspectorBulkControls allExpanded={allExpanded} onSetAll={setAllSections} />

      <InspectorCollapsibleSection
        title={sText.stateSection}
        badgeText={selectedState ? selectedState.id : undefined}
        isOpen={openSections.state}
        onToggle={() => toggleSection('state')}
      >
        {!selectedState ? (
          <p className="inspector-hint">{sText.selectStatePrompt}</p>
        ) : (
          <>
            <CommitIdInput
              label={sText.stateIdField}
              value={selectedState.id}
              placeholder="Idle"
              forbiddenRegex={FORBIDDEN_STATE_ID_CHARS_REGEX}
              formatError={safeguard.stateIdErrorChars}
              onCommit={commitStateIdRename}
            />

            <label className="inspector-field">
              <span>{sText.stateKindField}</span>
              <select
                value={selectedState.kind}
                onChange={(e) =>
                  handleStateKindChange(e.target.value as StateKind)
                }
              >
                {STATE_KIND_OPTIONS.map((kind) => (
                  <option key={kind} value={kind}>
                    {sText.stateKinds[kind]}
                  </option>
                ))}
              </select>
            </label>

            <label className="inspector-field">
              <span>{sText.stateLabelField}</span>
              <GuardedInput
                value={selectedState.label ?? ''}
                placeholder={sText.stateLabelPlaceholder}
                forbiddenRegex={FORBIDDEN_STATE_LABEL_CHARS_REGEX}
                formatError={safeguard.stateLabelErrorChars}
                onChangeValue={(label) =>
                  updateSelectedState((st) => ({
                    ...st,
                    label: label.length > 0 ? label : undefined,
                  }))
                }
              />
            </label>

            {selectedState.kind === 'normal' && (
              <label className="inspector-field">
                <span>{sText.stateDescField}</span>
                <GuardedInput
                  value={selectedState.description ?? ''}
                  placeholder={sText.stateDescPlaceholder}
                  forbiddenRegex={FORBIDDEN_STATE_TEXT_CHARS_REGEX}
                  formatError={safeguard.stateTextErrorChars}
                  onChangeValue={(description) =>
                    updateSelectedState((st) => ({
                      ...st,
                      description:
                        description.length > 0 ? description : undefined,
                    }))
                  }
                />
              </label>
            )}

            <label className="inspector-field">
              <span>{sText.stateParentField}</span>
              <select
                value={selectedState.parentId ?? ''}
                onChange={(e) =>
                  updateSelectedState((st) => ({
                    ...st,
                    parentId: e.target.value || undefined,
                  }))
                }
              >
                <option value="">{sText.rootScopeOption}</option>
                {compositeParents.map((parent) => (
                  <option key={parent.id} value={parent.id}>
                    {parent.label && parent.label !== parent.id
                      ? `${parent.label} (${parent.id})`
                      : parent.id}
                  </option>
                ))}
              </select>
            </label>

            {selectedState.kind === 'composite' && (
              <label className="inspector-field">
                <span>{sText.compositeDirectionField}</span>
                <select
                  value={selectedState.subDirection ?? ''}
                  onChange={(e) =>
                    updateSelectedState((st) => ({
                      ...st,
                      subDirection: e.target.value
                        ? (e.target.value as StateDiagramDirection)
                        : undefined,
                    }))
                  }
                >
                  <option value="">{sText.inheritDirectionOption}</option>
                  {STATE_DIRECTION_OPTIONS.map((dir) => (
                    <option key={dir} value={dir}>
                      {sText.directions[dir]}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <InspectorColorPalette
              label={sText.stateColorField}
              value={selectedState.color}
              clearTitle={sText.noColorOption}
              onChange={(color) => updateSelectedState((st) => ({ ...st, color }))}
            />

            <div className="inspector-actions-row">
              <button
                type="button"
                className="btn-secondary btn-xs"
                onClick={handleQuickAddTransition}
              >
                <Plus size={13} />
                <span>{sText.addTransitionBtn}</span>
              </button>
              <button
                type="button"
                className="btn-danger-outline"
                onClick={handleDeleteSelectedState}
              >
                <Trash2 size={13} />
                <span>{sText.deleteStateBtn}</span>
              </button>
            </div>
          </>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={sText.transitionSection}
        badgeText={selectedTransition ? `${selectedTransition.from} -> ${selectedTransition.to}` : undefined}
        isOpen={openSections.transition}
        onToggle={() => toggleSection('transition')}
      >
        {!selectedTransition ? (
          <p className="inspector-hint">{sText.selectTransitionPrompt}</p>
        ) : (
          <>
            <label className="inspector-field">
              <span>{sText.transFromField}</span>
              <select
                value={selectedTransition.from}
                onChange={(e) =>
                  updateSelectedTransition((tr) => ({
                    ...tr,
                    from: e.target.value,
                  }))
                }
              >
                {renderEndpointOptions()}
              </select>
            </label>

            <label className="inspector-field">
              <span>{sText.transToField}</span>
              <select
                value={selectedTransition.to}
                onChange={(e) =>
                  updateSelectedTransition((tr) => ({
                    ...tr,
                    to: e.target.value,
                  }))
                }
              >
                {renderEndpointOptions()}
              </select>
            </label>

            <label className="inspector-field">
              <span>{sText.transScopeField}</span>
              <select
                value={selectedTransition.scopeId ?? ''}
                onChange={(e) =>
                  updateSelectedTransition((tr) => ({
                    ...tr,
                    scopeId: e.target.value || undefined,
                  }))
                }
              >
                <option value="">{sText.rootScopeOption}</option>
                {allCompositeStates.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.label && comp.label !== comp.id
                      ? `${comp.label} (${comp.id})`
                      : comp.id}
                  </option>
                ))}
              </select>
            </label>

            <label className="inspector-field">
              <span>{sText.transLabelField}</span>
              <GuardedInput
                value={selectedTransition.label ?? ''}
                placeholder={sText.transLabelPlaceholder}
                forbiddenRegex={FORBIDDEN_STATE_TEXT_CHARS_REGEX}
                formatError={safeguard.stateTextErrorChars}
                onChangeValue={(label) =>
                  updateSelectedTransition((tr) => ({
                    ...tr,
                    label: label.length > 0 ? label : undefined,
                  }))
                }
              />
            </label>

            <div className="inspector-actions-row">
              <button
                type="button"
                className="btn-secondary btn-xs"
                onClick={() =>
                  updateSelectedTransition((tr) => ({
                    ...tr,
                    from: tr.to,
                    to: tr.from,
                  }))
                }
              >
                <ArrowLeftRight size={13} />
                <span>{sText.swapEndpointsBtn}</span>
              </button>
              <button
                type="button"
                className="btn-danger-outline"
                onClick={handleDeleteSelectedTransition}
              >
                <Trash2 size={13} />
                <span>{sText.deleteTransitionBtn}</span>
              </button>
            </div>
          </>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={sText.notesSection}
        badgeText={notes.length > 0 ? String(notes.length) : undefined}
        isOpen={openSections.notes}
        onToggle={() => toggleSection('notes')}
      >
        <div className="inspector-subhead">
          <span />
          <button
            type="button"
            className="btn-secondary btn-xs"
            disabled={stateData.states.length === 0}
            onClick={handleAddNote}
          >
            <Plus size={12} />
            <span>{sText.addNoteBtn}</span>
          </button>
        </div>

        {notes.length === 0 ? (
          <p className="inspector-hint">{sText.emptyNotes}</p>
        ) : (
          <div className="er-attr-inspector-list">
            {notes.map((n) => (
              <div key={n.id} className="er-attr-inspector-card">
                <div className="er-attr-inspector-row">
                  <select
                    aria-label={sText.noteTargetField}
                    value={n.targetStateId}
                    onChange={(e) =>
                      updateNote(n.id, (prev) => ({
                        ...prev,
                        targetStateId: e.target.value,
                      }))
                    }
                  >
                    {stateData.states.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.id}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={sText.notePositionField}
                    value={n.position}
                    onChange={(e) =>
                      updateNote(n.id, (prev) => ({
                        ...prev,
                        position: e.target.value as StateNotePosition,
                      }))
                    }
                  >
                    {STATE_NOTE_POSITION_OPTIONS.map((pos) => (
                      <option key={pos} value={pos}>
                        {sText.notePositions[pos]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="treeview-action-btn is-danger"
                    title={sText.deleteNoteTitle}
                    onClick={() => deleteNote(n.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <GuardedInput
                  value={n.text}
                  placeholder={sText.noteTextPlaceholder}
                  forbiddenRegex={FORBIDDEN_STATE_TEXT_CHARS_REGEX}
                  formatError={safeguard.stateTextErrorChars}
                  onChangeValue={(text) =>
                    updateNote(n.id, (prev) => ({ ...prev, text }))
                  }
                />
              </div>
            ))}
          </div>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={sText.settingsSection}
        badgeText={stateData.direction ?? 'TB'}
        isOpen={openSections.settings}
        onToggle={() => toggleSection('settings')}
      >
        <label className="inspector-field">
          <span>{sText.titleField}</span>
          <input
            type="text"
            value={stateData.title ?? ''}
            placeholder={sText.titlePlaceholder}
            onChange={(e) =>
              onChange({
                ...stateData,
                title: e.target.value.trim() ? e.target.value : undefined,
              })
            }
          />
        </label>

        <label className="inspector-field">
          <span>{sText.directionField}</span>
          <select
            value={stateData.direction ?? 'TB'}
            onChange={(e) =>
              onChange({
                ...stateData,
                direction: e.target.value as StateDiagramDirection,
              })
            }
          >
            {STATE_DIRECTION_OPTIONS.map((dir) => (
              <option key={dir} value={dir}>
                {sText.directions[dir]}
              </option>
            ))}
          </select>
        </label>
      </InspectorCollapsibleSection>

      <InspectorCommentsSection
        title={sText.commentsSection}
        fieldLabel={sText.commentsField}
        placeholder={sText.commentsPlaceholder}
        comments={stateData.comments}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
        onChangeComments={(nextComments) =>
          onChange({
            ...stateData,
            comments: nextComments,
          })
        }
      />
    </div>
  );
}
