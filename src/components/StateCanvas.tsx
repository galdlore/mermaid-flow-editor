import { useMemo } from 'react';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  GitBranch,
  GitFork,
  GitMerge,
  Layers,
  Plus,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { useI18n } from '../i18n';
import type {
  StateDiagramData,
  StateKind,
  StateNodeData,
  StateNoteData,
  StateTransitionData,
} from '../types/editor';
import {
  START_END_STATE_ID,
  createUniqueStateId,
  createUniqueStateNoteId,
  createUniqueStateTransitionId,
} from '../utils/stateConverter';

export interface StateCanvasProps {
  stateData: StateDiagramData;
  selectedStateId: string | null;
  selectedTransitionId: string | null;
  onChange: (next: StateDiagramData) => void;
  onSelectState: (stateId: string | null) => void;
  onSelectTransition: (transitionId: string | null) => void;
}

function renderKindIcon(kind: StateKind) {
  switch (kind) {
    case 'composite':
      return <Layers size={13} />;
    case 'choice':
      return <GitBranch size={13} />;
    case 'fork':
      return <GitFork size={13} />;
    case 'join':
      return <GitMerge size={13} />;
    default:
      return <CircleDot size={13} />;
  }
}

function getStateDisplay(
  st: StateNodeData | undefined,
  fallbackId: string,
  startEndLabel: string
): string {
  if (fallbackId === START_END_STATE_ID) {
    return startEndLabel;
  }
  if (!st) {
    return fallbackId;
  }
  return st.label && st.label !== st.id ? `${st.label} (${st.id})` : st.id;
}

export default function StateCanvas({
  stateData,
  selectedStateId,
  selectedTransitionId,
  onChange,
  onSelectState,
  onSelectTransition,
}: StateCanvasProps) {
  const { t } = useI18n();
  const sText = t.inspector.stateDiagram;

  const stateMap = useMemo(() => {
    const map = new Map<string, StateNodeData>();
    for (const st of stateData.states) {
      map.set(st.id, st);
    }
    return map;
  }, [stateData.states]);

  const notes = stateData.notes ?? [];

  const handleAddState = (kind: StateKind): void => {
    const baseName =
      kind === 'composite'
        ? 'Group'
        : kind === 'choice'
          ? 'Check'
          : kind === 'fork'
            ? 'Fork'
            : kind === 'join'
              ? 'Join'
              : 'State';
    const nextId = createUniqueStateId(stateData.states, baseName);
    const num = stateData.states.length + 1;
    const label =
      kind === 'composite'
        ? sText.defaultCompositeLabel(num)
        : kind === 'choice'
          ? sText.defaultChoiceLabel(num)
          : sText.defaultStateLabel(num);

    const selectedNode = selectedStateId ? stateMap.get(selectedStateId) : undefined;
    const parentId =
      selectedNode?.kind === 'composite' && kind !== 'composite'
        ? selectedNode.id
        : undefined;

    const created: StateNodeData = {
      id: nextId,
      kind,
      label,
      ...(parentId ? { parentId } : {}),
    };

    onChange({
      ...stateData,
      states: [...stateData.states, created],
    });
    onSelectState(nextId);
  };

  const handleMoveSiblingState = (stateId: string, delta: -1 | 1): void => {
    const target = stateMap.get(stateId);
    if (!target) {
      return;
    }
    const siblingIndices = stateData.states
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => (item.parentId ?? undefined) === (target.parentId ?? undefined));

    const pos = siblingIndices.findIndex(({ item }) => item.id === stateId);
    const nextPos = pos + delta;
    if (pos < 0 || nextPos < 0 || nextPos >= siblingIndices.length) {
      return;
    }

    const fromIndex = siblingIndices[pos].index;
    const toIndex = siblingIndices[nextPos].index;
    const copy = [...stateData.states];
    const temp = copy[fromIndex];
    copy[fromIndex] = copy[toIndex];
    copy[toIndex] = temp;
    onChange({ ...stateData, states: copy });
  };

  const handleDeleteState = (stateId: string): void => {
    const nextStates = stateData.states
      .filter((item) => item.id !== stateId)
      .map((item) =>
        item.parentId === stateId ? { ...item, parentId: undefined } : item
      );
    const nextTransitions = stateData.transitions
      .filter((tr) => tr.from !== stateId && tr.to !== stateId)
      .map((tr) =>
        tr.scopeId === stateId ? { ...tr, scopeId: undefined } : tr
      );
    const nextNotes = notes.filter((n) => n.targetStateId !== stateId);

    onChange({
      ...stateData,
      states: nextStates,
      transitions: nextTransitions,
      ...(nextNotes.length > 0 ? { notes: nextNotes } : { notes: undefined }),
    });
    if (selectedStateId === stateId) {
      onSelectState(nextStates[0]?.id ?? null);
    }
    if (
      selectedTransitionId &&
      !nextTransitions.some((tr) => tr.id === selectedTransitionId)
    ) {
      onSelectTransition(nextTransitions[0]?.id ?? null);
    }
  };

  const handleAddTransition = (): void => {
    if (stateData.states.length === 0) {
      return;
    }
    const firstState = stateData.states[0];
    const activeState = selectedStateId ? stateMap.get(selectedStateId) : undefined;
    const fromId = activeState?.id ?? START_END_STATE_ID;
    const toId =
      stateData.states.find((s) => s.id !== fromId)?.id ?? firstState.id;

    const nextId = createUniqueStateTransitionId(stateData.transitions);
    const created: StateTransitionData = {
      id: nextId,
      from: fromId,
      to: toId,
      label: sText.defaultTransitionLabel,
    };
    onChange({
      ...stateData,
      transitions: [...stateData.transitions, created],
    });
    onSelectTransition(nextId);
  };

  const handleMoveTransition = (transId: string, delta: -1 | 1): void => {
    const idx = stateData.transitions.findIndex((tr) => tr.id === transId);
    const targetIdx = idx + delta;
    if (idx < 0 || targetIdx < 0 || targetIdx >= stateData.transitions.length) {
      return;
    }
    const copy = [...stateData.transitions];
    const [moved] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, moved);
    onChange({ ...stateData, transitions: copy });
  };

  const handleSwapTransition = (transId: string): void => {
    onChange({
      ...stateData,
      transitions: stateData.transitions.map((tr) =>
        tr.id === transId ? { ...tr, from: tr.to, to: tr.from } : tr
      ),
    });
  };

  const handleDeleteTransition = (transId: string): void => {
    const nextTransitions = stateData.transitions.filter((tr) => tr.id !== transId);
    onChange({ ...stateData, transitions: nextTransitions });
    if (selectedTransitionId === transId) {
      onSelectTransition(nextTransitions[0]?.id ?? null);
    }
  };

  const handleAddNote = (): void => {
    const target = selectedStateId ?? stateData.states[0]?.id;
    if (!target) {
      return;
    }
    const created: StateNoteData = {
      id: createUniqueStateNoteId(notes),
      targetStateId: target,
      position: 'right of',
      text: sText.defaultNoteText,
    };
    onChange({ ...stateData, notes: [...notes, created] });
  };

  const handleDeleteNote = (noteId: string): void => {
    const nextNotes = notes.filter((n) => n.id !== noteId);
    onChange({
      ...stateData,
      ...(nextNotes.length > 0 ? { notes: nextNotes } : { notes: undefined }),
    });
  };

  const renderStateCard = (st: StateNodeData, idx: number, siblingTotal: number) => {
    const isSelected = st.id === selectedStateId;
    const children = stateData.states.filter((item) => item.parentId === st.id);

    return (
      <div
        key={st.id}
        className={`er-entity-card ${
          st.kind === 'composite' ? 'st-composite-card' : ''
        } ${isSelected ? 'is-selected' : ''}`}
        onClick={(ev) => {
          ev.stopPropagation();
          onSelectState(st.id);
        }}
      >
        <div
          className="cls-card-header"
          style={st.color ? { backgroundColor: st.color } : undefined}
        >
          <div className="cls-card-badges">
            <span className={`st-kind-pill st-kind-${st.kind}`}>
              {renderKindIcon(st.kind)}
              <span>{st.kind}</span>
            </span>
            {st.kind === 'composite' && st.subDirection && (
              <span className="seq-meta-pill">{st.subDirection}</span>
            )}
            <div
              className="er-entity-actions cls-header-actions"
              onClick={(ev) => ev.stopPropagation()}
            >
              {st.kind === 'composite' && (
                <span className="er-attr-count-badge">
                  {sText.childCountLabel(children.length)}
                </span>
              )}
              <button
                type="button"
                className="treeview-action-btn"
                disabled={idx === 0}
                title={sText.moveLeftTitle}
                onClick={() => handleMoveSiblingState(st.id, -1)}
              >
                <ChevronLeft size={11} />
              </button>
              <button
                type="button"
                className="treeview-action-btn"
                disabled={idx === siblingTotal - 1}
                title={sText.moveRightTitle}
                onClick={() => handleMoveSiblingState(st.id, 1)}
              >
                <ChevronRight size={11} />
              </button>
              <button
                type="button"
                className="treeview-action-btn is-danger"
                title={sText.deleteStateBtn}
                onClick={() => handleDeleteState(st.id)}
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>

          <div className="cls-card-title-row">
            <span className="er-entity-icon">{renderKindIcon(st.kind)}</span>
            <div className="er-entity-title-wrap">
              <span className="er-entity-name">{st.label || st.id}</span>
              {st.label && st.label !== st.id && (
                <span className="er-entity-id">{st.id}</span>
              )}
            </div>
          </div>
        </div>

        {st.kind === 'normal' && st.description && (
          <div className="st-desc-body">{st.description}</div>
        )}

        {st.kind === 'composite' && (
          <div className="st-composite-body">
            {children.length === 0 ? (
              <div className="er-attr-empty">{sText.emptyCompositeChildren}</div>
            ) : (
              <div className="st-children-grid">
                {children.map((child, childIdx) =>
                  renderStateCard(child, childIdx, children.length)
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const rootStates = stateData.states.filter((st) => !st.parentId);

  return (
    <div className="er-canvas-container">
      <div className="seq-canvas-toolbar">
        <div className="seq-toolbar-group">
          <button
            type="button"
            className="seq-tool-btn is-primary"
            onClick={() => handleAddState('normal')}
          >
            <Plus size={14} />
            <span>{sText.addStateBtn}</span>
          </button>
          <button
            type="button"
            className="seq-tool-btn"
            onClick={() => handleAddState('composite')}
          >
            <Layers size={14} />
            <span>{sText.addCompositeBtn}</span>
          </button>
          <button
            type="button"
            className="seq-tool-btn"
            onClick={() => handleAddState('choice')}
          >
            <GitBranch size={14} />
            <span>{sText.addChoiceBtn}</span>
          </button>
          <button
            type="button"
            className="seq-tool-btn"
            disabled={stateData.states.length === 0}
            onClick={handleAddTransition}
          >
            <ArrowRight size={14} />
            <span>{sText.addTransitionBtn}</span>
          </button>
          <button
            type="button"
            className="seq-tool-btn"
            disabled={stateData.states.length === 0}
            onClick={handleAddNote}
          >
            <StickyNote size={14} />
            <span>{sText.addNoteBtn}</span>
          </button>
        </div>

        <div className="seq-toolbar-meta">
          <span className="seq-meta-pill">{stateData.direction ?? 'TB'}</span>
          {stateData.title && (
            <span className="treeview-title-pill">{stateData.title}</span>
          )}
        </div>
      </div>

      <div className="er-canvas-scroll">
        {stateData.states.length === 0 ? (
          <div className="treeview-empty-state">{sText.emptyStates}</div>
        ) : (
          <div className="er-board">
            <div className="er-entities-grid">
              {rootStates.map((st, idx) =>
                renderStateCard(st, idx, rootStates.length)
              )}
            </div>

            {notes.length > 0 && (
              <div className="cls-notes-strip">
                {notes.map((n) => (
                  <div
                    key={n.id}
                    className="cls-note-chip"
                    onClick={() => onSelectState(n.targetStateId)}
                  >
                    <StickyNote size={12} />
                    <span className="cls-note-target">
                      [{n.position === 'left of' ? 'L' : 'R'} {n.targetStateId}]
                    </span>
                    <span className="cls-note-text">{n.text}</span>
                    <button
                      type="button"
                      className="treeview-action-btn is-danger"
                      title={sText.deleteNoteTitle}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        handleDeleteNote(n.id);
                      }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="er-relations-panel">
              <div className="er-relations-header">
                <span>
                  {sText.transitionsHeading} ({stateData.transitions.length})
                </span>
              </div>
              {stateData.transitions.length === 0 ? (
                <div className="er-rel-empty">{sText.emptyTransitions}</div>
              ) : (
                <div className="er-relations-list">
                  {stateData.transitions.map((tr, trIdx) => {
                    const isTransSelected = tr.id === selectedTransitionId;
                    const fromDisplay = getStateDisplay(
                      stateMap.get(tr.from),
                      tr.from,
                      sText.startEndLabel
                    );
                    const toDisplay = getStateDisplay(
                      stateMap.get(tr.to),
                      tr.to,
                      sText.startEndLabel
                    );
                    const scopeNode = tr.scopeId
                      ? stateMap.get(tr.scopeId)
                      : undefined;
                    return (
                      <div
                        key={tr.id}
                        className={`er-rel-row ${
                          isTransSelected ? 'is-selected' : ''
                        }`}
                        onClick={() => onSelectTransition(tr.id)}
                      >
                        <div className="er-rel-endpoints">
                          <span
                            className={`er-rel-entity ${
                              tr.from === START_END_STATE_ID ? 'st-pseudo-ep' : ''
                            }`}
                          >
                            {fromDisplay}
                          </span>
                          <span className="er-rel-connector">--&gt;</span>
                          <span
                            className={`er-rel-entity ${
                              tr.to === START_END_STATE_ID ? 'st-pseudo-ep' : ''
                            }`}
                          >
                            {toDisplay}
                          </span>
                          {scopeNode && (
                            <span className="cls-card-mult">
                              @{scopeNode.id}
                            </span>
                          )}
                        </div>

                        {tr.label && (
                          <span className="er-rel-label-pill">{tr.label}</span>
                        )}

                        <div
                          className="er-rel-actions"
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="treeview-action-btn"
                            disabled={trIdx === 0}
                            title={sText.moveUpTitle}
                            onClick={() => handleMoveTransition(tr.id, -1)}
                          >
                            <ArrowUp size={11} />
                          </button>
                          <button
                            type="button"
                            className="treeview-action-btn"
                            disabled={trIdx === stateData.transitions.length - 1}
                            title={sText.moveDownTitle}
                            onClick={() => handleMoveTransition(tr.id, 1)}
                          >
                            <ArrowDown size={11} />
                          </button>
                          <button
                            type="button"
                            className="treeview-action-btn"
                            title={sText.swapEndpointsBtn}
                            onClick={() => handleSwapTransition(tr.id)}
                          >
                            <ArrowLeftRight size={11} />
                          </button>
                          <button
                            type="button"
                            className="treeview-action-btn is-danger"
                            title={sText.deleteTransitionBtn}
                            onClick={() => handleDeleteTransition(tr.id)}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
