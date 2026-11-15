import { Fragment, useMemo } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Layers,
  MessageSquarePlus,
  Plus,
  StickyNote,
  Trash2,
  User,
  Box,
} from 'lucide-react';
import { useI18n } from '../i18n';
import type {
  SequenceArrowType,
  SequenceBlockStepData,
  SequenceDiagramData,
  SequenceMessageStepData,
  SequenceNoteStepData,
  SequenceParticipantData,
  SequenceStepData,
} from '../types/editor';
import {
  analyzeSequenceActivation,
  appendStepToBranch,
  createUniqueSequenceBranchId,
  createUniqueSequenceStepId,
  deleteSequenceStepById,
  insertSequenceStepAfter,
  moveSequenceStepById,
} from '../utils/sequenceConverter';

export interface SequenceCanvasProps {
  sequenceData: SequenceDiagramData;
  selectedStepId: string | null;
  selectedParticipantId: string | null;
  onChange: (next: SequenceDiagramData) => void;
  onSelectStep: (stepId: string | null) => void;
  onSelectParticipant: (participantId: string | null) => void;
}

function createUniqueParticipantId(
  participants: ReadonlyArray<SequenceParticipantData>,
  prefix: string
): string {
  const existing = new Set(participants.map((p) => p.id));
  let num = participants.length + 1;
  while (existing.has(`${prefix}_${num}`)) {
    num += 1;
  }
  return `${prefix}_${num}`;
}

function getParticipantDisplay(p: SequenceParticipantData): string {
  return p.alias?.trim() || p.id;
}

function isDottedArrow(arrowType: SequenceArrowType): boolean {
  return arrowType.startsWith('--') || arrowType === '<<-->>';
}

function renderMessageArrowGlyph(
  arrowType: SequenceArrowType,
  direction: 'ltr' | 'rtl' | 'self'
): string {
  if (direction === 'self') {
    return arrowType;
  }
  return arrowType;
}

export default function SequenceCanvas({
  sequenceData,
  selectedStepId,
  selectedParticipantId,
  onChange,
  onSelectStep,
  onSelectParticipant,
}: SequenceCanvasProps) {
  const { t } = useI18n();
  const s = t.inspector.sequence;

  const participants = sequenceData.participants;
  const boxes = sequenceData.boxes ?? [];
  const boxMap = useMemo(() => {
    const map = new Map<string, { title: string; color?: string }>();
    for (const b of boxes) {
      map.set(b.id, { title: b.title, color: b.color });
    }
    return map;
  }, [boxes]);

  const participantIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    participants.forEach((p, idx) => map.set(p.id, idx));
    return map;
  }, [participants]);

  const activationAnalysis = useMemo(
    () => analyzeSequenceActivation(sequenceData),
    [sequenceData]
  );

  // 表示用の連番マップを先行計算する
  const messageNumbers = useMemo(() => {
    const nums = new Map<string, number>();
    let seqNum = 1;
    const walk = (list: ReadonlyArray<SequenceStepData>): void => {
      for (const step of list) {
        if (step.kind === 'message') {
          nums.set(step.id, seqNum++);
        } else if (step.kind === 'block') {
          for (const branch of step.branches) {
            walk(branch.steps);
          }
        }
      }
    };
    walk(sequenceData.steps);
    return nums;
  }, [sequenceData.steps]);

  const handleAddParticipant = (kind: 'participant' | 'actor'): void => {
    const num = participants.length + 1;
    const id = createUniqueParticipantId(
      participants,
      kind === 'actor' ? 'actor' : 'svc'
    );
    const alias =
      kind === 'actor'
        ? s.defaultActorAlias(num)
        : s.defaultParticipantAlias(num);
    const nextParticipants = [
      ...participants,
      { id, alias, kind },
    ];
    onChange({
      ...sequenceData,
      participants: nextParticipants,
    });
    onSelectParticipant(id);
  };

  const handleMoveParticipant = (id: string, delta: -1 | 1): void => {
    const idx = participants.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= participants.length) return;
    const next = [...participants];
    const [moved] = next.splice(idx, 1);
    next.splice(targetIdx, 0, moved);
    onChange({ ...sequenceData, participants: next });
  };

  const handleDeleteParticipant = (id: string): void => {
    const nextParticipants = participants.filter((p) => p.id !== id);
    onChange({
      ...sequenceData,
      participants: nextParticipants,
    });
    if (selectedParticipantId === id) {
      onSelectParticipant(nextParticipants[0]?.id ?? null);
    }
  };

  const createNewMessage = (): SequenceMessageStepData | null => {
    if (participants.length === 0) return null;
    const id = createUniqueSequenceStepId(sequenceData.steps);
    const from = participants[0].id;
    const to = (participants[1] ?? participants[0]).id;
    return {
      id,
      kind: 'message',
      from,
      to,
      arrowType: '->>',
      text: s.defaultMessageText,
    };
  };

  const createNewNote = (): SequenceNoteStepData | null => {
    if (participants.length === 0) return null;
    const id = createUniqueSequenceStepId(sequenceData.steps);
    return {
      id,
      kind: 'note',
      placement: 'right_of',
      participantId: participants[0].id,
      text: s.defaultNoteText,
    };
  };

  const createNewBlock = (): SequenceBlockStepData => {
    const id = createUniqueSequenceStepId(sequenceData.steps);
    const branchId1 = createUniqueSequenceBranchId(sequenceData.steps);
    const msg = createNewMessage();
    return {
      id,
      kind: 'block',
      blockType: 'alt',
      label: s.defaultBlockLabel('alt'),
      branches: [
        {
          id: branchId1,
          steps: msg ? [{ ...msg, id: `${id}_m1` }] : [],
        },
        {
          id: `${branchId1}_2`,
          label: s.defaultBranchLabel('alt', 1),
          steps: [],
        },
      ],
    };
  };

  const handleAddStepToolbar = (kind: 'message' | 'note' | 'block'): void => {
    if (participants.length === 0 && kind !== 'block') return;
    const newStep: SequenceStepData | null =
      kind === 'message'
        ? createNewMessage()
        : kind === 'note'
          ? createNewNote()
          : createNewBlock();
    if (!newStep) return;

    const nextSteps = insertSequenceStepAfter(
      sequenceData.steps,
      selectedStepId,
      newStep
    );
    onChange({ ...sequenceData, steps: nextSteps });
    onSelectStep(newStep.id);
  };

  const handleAddStepToBranch = (
    branchId: string,
    kind: 'message' | 'note'
  ): void => {
    const newStep = kind === 'message' ? createNewMessage() : createNewNote();
    if (!newStep) return;
    const nextSteps = appendStepToBranch(sequenceData.steps, newStep, branchId);
    onChange({ ...sequenceData, steps: nextSteps });
    onSelectStep(newStep.id);
  };

  const handleMoveStep = (stepId: string, delta: -1 | 1): void => {
    onChange({
      ...sequenceData,
      steps: moveSequenceStepById(sequenceData.steps, stepId, delta),
    });
  };

  const handleDeleteStep = (stepId: string): void => {
    const nextSteps = deleteSequenceStepById(sequenceData.steps, stepId);
    onChange({ ...sequenceData, steps: nextSteps });
    if (selectedStepId === stepId) {
      onSelectStep(nextSteps[0]?.id ?? null);
    }
  };

  const colCount = Math.max(1, participants.length);

  const renderLifelineGuides = (activeDepths?: Record<string, number>) => {
    if (participants.length === 0) return null;
    return (
      <div className="seq-lifeline-layer" aria-hidden="true">
        {participants.map((p, idx) => {
          const leftPercent = ((idx + 0.5) / colCount) * 100;
          const isActive = (activeDepths?.[p.id] ?? 0) > 0;
          return (
            <div
              key={p.id}
              className={`seq-lifeline-col ${isActive ? 'is-active' : ''}`}
              style={{ left: `${leftPercent}%` }}
            />
          );
        })}
      </div>
    );
  };

  const renderMessageRow = (
    step: SequenceMessageStepData,
    index: number,
    total: number
  ) => {
    const fromIdx = participantIndexMap.get(step.from) ?? 0;
    const toIdx = participantIndexMap.get(step.to) ?? 0;
    const isSelf = fromIdx === toIdx;
    const isLtr = fromIdx < toIdx;
    const minIdx = Math.min(fromIdx, toIdx);
    const maxIdx = Math.max(fromIdx, toIdx);
    const startPercent = ((minIdx + 0.5) / colCount) * 100;
    const spanPercent = isSelf
      ? 100 / (colCount * 2.2)
      : ((maxIdx - minIdx) / colCount) * 100;
    const isSelected = step.id === selectedStepId;
    const dotted = isDottedArrow(step.arrowType);
    const isCross = step.arrowType.endsWith('x');
    const isBidi = step.arrowType.startsWith('<<');
    const num = messageNumbers.get(step.id);
    const snap = activationAnalysis.snapshotsByStepId[step.id];

    return (
      <div
        key={step.id}
        className={`seq-step-row seq-message-row ${isSelected ? 'is-selected' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onSelectStep(step.id);
        }}
      >
        <div className="seq-timeline-lane">
          {renderLifelineGuides(snap?.postDepths)}

          {isSelf ? (
            <div
              className={`seq-self-arrow ${dotted ? 'is-dotted' : ''}`}
              style={{
                left: `calc(${((fromIdx + 0.5) / colCount) * 100}% )`,
                width: `max(64px, ${Math.min(26, spanPercent)}%)`,
              }}
            >
              <span className="seq-msg-label">
                {sequenceData.autonumber && num ? (
                  <span className="seq-msg-num">{num}</span>
                ) : null}
                <span className="seq-msg-text">{step.text || '...'}</span>
                <span className="seq-msg-arrow-tag">
                  {renderMessageArrowGlyph(step.arrowType, 'self')}
                </span>
              </span>
            </div>
          ) : (
            <div
              className={`seq-arrow-span ${isLtr ? 'is-ltr' : 'is-rtl'} ${
                dotted ? 'is-dotted' : ''
              } ${isCross ? 'is-cross' : ''} ${isBidi ? 'is-bidi' : ''}`}
              style={{
                left: `${startPercent}%`,
                width: `${spanPercent}%`,
              }}
            >
              <div className="seq-arrow-label-wrap">
                {sequenceData.autonumber && num ? (
                  <span className="seq-msg-num">{num}</span>
                ) : null}
                <span className="seq-msg-text">{step.text || '...'}</span>
                {step.activateTarget && (
                  <span className="seq-act-pill is-plus">+</span>
                )}
                {snap?.canDeactivateSource && (
                  <span className="seq-act-pill is-minus">-</span>
                )}
              </div>
              <div className="seq-arrow-line">
                {(isBidi || !isLtr) && (
                  <span className="seq-arrow-head is-left" aria-hidden="true">
                    {isCross && !isLtr ? '×' : '◀'}
                  </span>
                )}
                <span className="seq-arrow-shaft" />
                {(isBidi || isLtr) && (
                  <span className="seq-arrow-head is-right" aria-hidden="true">
                    {isCross && isLtr ? '×' : '▶'}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div
          className="seq-row-actions"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="treeview-action-btn"
            disabled={index === 0}
            title={s.moveUpTitle}
            onClick={() => handleMoveStep(step.id, -1)}
          >
            <ArrowUp size={12} />
          </button>
          <button
            type="button"
            className="treeview-action-btn"
            disabled={index === total - 1}
            title={s.moveDownTitle}
            onClick={() => handleMoveStep(step.id, 1)}
          >
            <ArrowDown size={12} />
          </button>
          <button
            type="button"
            className="treeview-action-btn is-danger"
            title={s.deleteStepBtn}
            onClick={() => handleDeleteStep(step.id)}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    );
  };

  const renderNoteRow = (
    step: SequenceNoteStepData,
    index: number,
    total: number
  ) => {
    const idx1 = participantIndexMap.get(step.participantId) ?? 0;
    const idx2 =
      step.placement === 'over' && step.participantId2
        ? participantIndexMap.get(step.participantId2) ?? idx1
        : idx1;
    const minIdx = Math.min(idx1, idx2);
    const maxIdx = Math.max(idx1, idx2);

    let centerPercent = ((idx1 + 0.5) / colCount) * 100;
    if (step.placement === 'over') {
      centerPercent = (((minIdx + maxIdx) / 2 + 0.5) / colCount) * 100;
    } else if (step.placement === 'left_of') {
      centerPercent = Math.max(8, centerPercent - 100 / (colCount * 3));
    } else if (step.placement === 'right_of') {
      centerPercent = Math.min(92, centerPercent + 100 / (colCount * 3));
    }

    const isSelected = step.id === selectedStepId;
    const snap = activationAnalysis.snapshotsByStepId[step.id];

    return (
      <div
        key={step.id}
        className={`seq-step-row seq-note-row ${isSelected ? 'is-selected' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onSelectStep(step.id);
        }}
      >
        <div className="seq-timeline-lane">
          {renderLifelineGuides(snap?.postDepths)}
          <div
            className="seq-note-card"
            style={{
              left: `${centerPercent}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <StickyNote size={12} className="seq-note-icon" />
            <span className="seq-note-text">{step.text}</span>
          </div>
        </div>

        <div
          className="seq-row-actions"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="treeview-action-btn"
            disabled={index === 0}
            title={s.moveUpTitle}
            onClick={() => handleMoveStep(step.id, -1)}
          >
            <ArrowUp size={12} />
          </button>
          <button
            type="button"
            className="treeview-action-btn"
            disabled={index === total - 1}
            title={s.moveDownTitle}
            onClick={() => handleMoveStep(step.id, 1)}
          >
            <ArrowDown size={12} />
          </button>
          <button
            type="button"
            className="treeview-action-btn is-danger"
            title={s.deleteStepBtn}
            onClick={() => handleDeleteStep(step.id)}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    );
  };

  const renderStepList = (steps: ReadonlyArray<SequenceStepData>) => {
    return steps.map((step, index) => {
      if (step.kind === 'message') {
        return renderMessageRow(step, index, steps.length);
      }
      if (step.kind === 'note') {
        return renderNoteRow(step, index, steps.length);
      }
      const isSelected = step.id === selectedStepId;
      const isRect = step.blockType === 'rect';
      const rectStyle = isRect && step.color ? { backgroundColor: `${step.color}88` } : undefined;
      const branchKeyword =
        step.blockType === 'par'
          ? s.branchKeywords.par
          : step.blockType === 'critical'
            ? s.branchKeywords.critical
            : s.branchKeywords.alt;

      return (
        <div
          key={step.id}
          className={`seq-block-frame ${isSelected ? 'is-selected' : ''} ${
            isRect ? 'is-rect' : ''
          }`}
          style={rectStyle}
          onClick={(e) => {
            e.stopPropagation();
            onSelectStep(step.id);
          }}
        >
          <div className="seq-block-header">
            <div className="seq-block-header-main">
              <span className="seq-block-kind-badge">{step.blockType}</span>
              {!isRect && (
                <span className="seq-block-label">
                  {step.label ? `[${step.label}]` : ''}
                </span>
              )}
            </div>
            <div
              className="seq-row-actions"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="treeview-action-btn"
                disabled={index === 0}
                title={s.moveUpTitle}
                onClick={() => handleMoveStep(step.id, -1)}
              >
                <ArrowUp size={12} />
              </button>
              <button
                type="button"
                className="treeview-action-btn"
                disabled={index === steps.length - 1}
                title={s.moveDownTitle}
                onClick={() => handleMoveStep(step.id, 1)}
              >
                <ArrowDown size={12} />
              </button>
              <button
                type="button"
                className="treeview-action-btn is-danger"
                title={s.deleteStepBtn}
                onClick={() => handleDeleteStep(step.id)}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          <div className="seq-block-branches">
            {step.branches.map((branch, branchIdx) => (
              <Fragment key={branch.id}>
                {branchIdx > 0 && (
                  <div className="seq-branch-divider">
                    <span className="seq-branch-tag">
                      {branchKeyword}
                      {branch.label ? ` [${branch.label}]` : ''}
                    </span>
                  </div>
                )}
                <div className="seq-branch-steps">
                  {branch.steps.length === 0 ? (
                    <div className="seq-branch-empty">{s.emptyBranchHint}</div>
                  ) : (
                    renderStepList(branch.steps)
                  )}
                </div>
                {participants.length > 0 && (
                  <div
                    className="seq-branch-footer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="btn-secondary btn-xs"
                      onClick={() => handleAddStepToBranch(branch.id, 'message')}
                    >
                      <Plus size={11} />
                      <span>{s.addMessageHereBtn}</span>
                    </button>
                    <button
                      type="button"
                      className="btn-secondary btn-xs"
                      onClick={() => handleAddStepToBranch(branch.id, 'note')}
                    >
                      <StickyNote size={11} />
                      <span>{s.addNoteHereBtn}</span>
                    </button>
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="seq-canvas">
      <div className="treeview-toolbar">
        <div className="treeview-toolbar-group">
          <button
            type="button"
            className="btn-secondary treeview-toolbar-btn"
            onClick={() => handleAddParticipant('participant')}
          >
            <Box size={14} />
            <span>{s.addParticipantBtn}</span>
          </button>
          <button
            type="button"
            className="btn-secondary treeview-toolbar-btn"
            onClick={() => handleAddParticipant('actor')}
          >
            <User size={14} />
            <span>{s.addActorBtn}</span>
          </button>
        </div>

        <div className="treeview-toolbar-group">
          <button
            type="button"
            className="btn-secondary treeview-toolbar-btn"
            disabled={participants.length === 0}
            onClick={() => handleAddStepToolbar('message')}
          >
            <MessageSquarePlus size={14} />
            <span>{s.addMessageBtn}</span>
          </button>
          <button
            type="button"
            className="btn-secondary treeview-toolbar-btn"
            disabled={participants.length === 0}
            onClick={() => handleAddStepToolbar('note')}
          >
            <StickyNote size={14} />
            <span>{s.addNoteBtn}</span>
          </button>
          <button
            type="button"
            className="btn-secondary treeview-toolbar-btn"
            disabled={participants.length === 0}
            onClick={() => handleAddStepToolbar('block')}
          >
            <Layers size={14} />
            <span>{s.addBlockBtn}</span>
          </button>
        </div>

        <div className="seq-toolbar-meta">
          {sequenceData.autonumber && (
            <span className="seq-meta-pill">{s.autonumberBadge}</span>
          )}
          {sequenceData.title && (
            <span className="treeview-title-pill">{sequenceData.title}</span>
          )}
        </div>
      </div>

      <div className="seq-canvas-scroll">
        {participants.length === 0 ? (
          <div className="treeview-empty-state">{s.emptyParticipants}</div>
        ) : (
          <div
            className="seq-board"
            style={{ minWidth: `${Math.max(540, participants.length * 145 + 96)}px` }}
          >
            <div className="seq-participants-row">
              <div
                className="seq-participants-grid"
                style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
              >
                {participants.map((p, idx) => {
                  const isSelected = p.id === selectedParticipantId;
                  const boxInfo = p.boxId ? boxMap.get(p.boxId) : undefined;
                  return (
                    <div key={p.id} className="seq-participant-cell">
                      {boxInfo && (
                        <div
                          className="seq-participant-box-badge"
                          style={
                            boxInfo.color ? { backgroundColor: boxInfo.color } : undefined
                          }
                          title={boxInfo.title}
                        >
                          {boxInfo.title}
                        </div>
                      )}
                      <div
                        className={`seq-participant-card ${
                          isSelected ? 'is-selected' : ''
                        } ${p.kind === 'actor' ? 'is-actor' : ''}`}
                        onClick={() => onSelectParticipant(p.id)}
                      >
                        <div className="seq-participant-card-top">
                          <span className="seq-participant-icon">
                            {p.kind === 'actor' ? <User size={14} /> : <Box size={14} />}
                          </span>
                          <span className="seq-participant-name">
                            {getParticipantDisplay(p)}
                          </span>
                        </div>
                        <div className="seq-participant-card-bottom">
                          <span className="seq-participant-id">{p.id}</span>
                          <div
                            className="seq-participant-actions"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="treeview-action-btn"
                              disabled={idx === 0}
                              title={s.moveLeftTitle}
                              onClick={() => handleMoveParticipant(p.id, -1)}
                            >
                              <ChevronLeft size={11} />
                            </button>
                            <button
                              type="button"
                              className="treeview-action-btn"
                              disabled={idx === participants.length - 1}
                              title={s.moveRightTitle}
                              onClick={() => handleMoveParticipant(p.id, 1)}
                            >
                              <ChevronRight size={11} />
                            </button>
                            <button
                              type="button"
                              className="treeview-action-btn is-danger"
                              title={s.deleteParticipantBtn}
                              onClick={() => handleDeleteParticipant(p.id)}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="seq-row-actions-spacer" />
            </div>

            <div className="seq-steps-area">
              {sequenceData.steps.length === 0 ? (
                <div className="treeview-empty-state">{s.emptySteps}</div>
              ) : (
                renderStepList(sequenceData.steps)
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
