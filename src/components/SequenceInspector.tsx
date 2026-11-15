import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import {
  COLOR_PALETTE_ITEMS,
  InspectorCollapsibleSection,
} from './InspectorCollapsibleSection';
import {
  FORBIDDEN_SEQUENCE_ALIAS_CHARS_REGEX,
  FORBIDDEN_SEQUENCE_ID_CHARS_REGEX,
  FORBIDDEN_SEQUENCE_TEXT_CHARS_REGEX,
} from '../utils/inputSafeguard';
import type {
  SequenceArrowType,
  SequenceBlockType,
  SequenceBoxData,
  SequenceDiagramData,
  SequenceNotePlacement,
  SequenceParticipantData,
  SequenceParticipantKind,
  SequenceStepData,
} from '../types/editor';
import {
  SEQUENCE_ARROW_OPTIONS,
  SEQUENCE_BLOCK_TYPES,
  analyzeSequenceActivation,
  appendStepToBranch,
  createUniqueSequenceBranchId,
  createUniqueSequenceStepId,
  deleteSequenceStepById,
  findSequenceStepLocation,
  isMultiBranchBlockType,
  updateSequenceStepById,
} from '../utils/sequenceConverter';

export interface SequenceInspectorProps {
  sequenceData: SequenceDiagramData;
  selectedStepId: string | null;
  selectedParticipantId: string | null;
  onChange: (next: SequenceDiagramData) => void;
  onSelectStep: (stepId: string | null) => void;
  onSelectParticipant: (participantId: string | null) => void;
}

type SequenceSectionKey = 'step' | 'participants' | 'settings' | 'comments';

const NOTE_PLACEMENTS: ReadonlyArray<SequenceNotePlacement> = [
  'right_of',
  'left_of',
  'over',
];

const RESERVED_SEQUENCE_IDS = new Set([
  'end',
  'participant',
  'actor',
  'box',
  'note',
  'loop',
  'alt',
  'else',
  'opt',
  'par',
  'and',
  'critical',
  'option',
  'break',
  'rect',
  'autonumber',
  'activate',
  'deactivate',
  'title',
  'over',
  'left',
  'right',
  'of',
  'as',
]);

function renameParticipantInSteps(
  steps: ReadonlyArray<SequenceStepData>,
  oldId: string,
  newId: string
): SequenceStepData[] {
  return steps.map((step) => {
    if (step.kind === 'message') {
      return {
        ...step,
        from: step.from === oldId ? newId : step.from,
        to: step.to === oldId ? newId : step.to,
      };
    }
    if (step.kind === 'note') {
      return {
        ...step,
        participantId: step.participantId === oldId ? newId : step.participantId,
        ...(step.participantId2
          ? {
              participantId2:
                step.participantId2 === oldId ? newId : step.participantId2,
            }
          : {}),
      };
    }
    return {
      ...step,
      branches: step.branches.map((branch) => ({
        ...branch,
        steps: renameParticipantInSteps(branch.steps, oldId, newId),
      })),
    };
  });
}

export default function SequenceInspector({
  sequenceData,
  selectedStepId,
  selectedParticipantId,
  onChange,
  onSelectStep,
  onSelectParticipant,
}: SequenceInspectorProps) {
  const { t } = useI18n();
  const s = t.inspector.sequence;
  const safeguard = t.inspector.safeguard;

  const participants = sequenceData.participants;
  const boxes = sequenceData.boxes ?? [];
  const comments = sequenceData.comments ?? [];

  const selectedLocation = useMemo(
    () => findSequenceStepLocation(sequenceData.steps, selectedStepId),
    [sequenceData.steps, selectedStepId]
  );
  const selectedStep = selectedLocation?.step ?? null;

  const selectedParticipant = useMemo(
    () =>
      participants.find((p) => p.id === selectedParticipantId) ??
      participants[0] ??
      null,
    [participants, selectedParticipantId]
  );

  const activationAnalysis = useMemo(
    () => analyzeSequenceActivation(sequenceData),
    [sequenceData]
  );

  const [participantIdDraft, setParticipantIdDraft] = useState(
    selectedParticipant?.id ?? ''
  );
  const [commentInputs, setCommentInputs] = useState<string[]>(comments);
  const [openSections, setOpenSections] = useState<Record<SequenceSectionKey, boolean>>({
    step: true,
    participants: true,
    settings: false,
    comments: false,
  });

  useEffect(() => {
    setParticipantIdDraft(selectedParticipant?.id ?? '');
  }, [selectedParticipant?.id]);

  useEffect(() => {
    setCommentInputs(sequenceData.comments ?? []);
  }, [sequenceData.comments]);

  useEffect(() => {
    if (selectedStepId) {
      setOpenSections((prev) => (prev.step ? prev : { ...prev, step: true }));
    }
  }, [selectedStepId]);

  useEffect(() => {
    if (selectedParticipantId) {
      setOpenSections((prev) =>
        prev.participants ? prev : { ...prev, participants: true }
      );
    }
  }, [selectedParticipantId]);

  const toggleSection = (key: SequenceSectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSections = (open: boolean): void => {
    setOpenSections({
      step: open,
      participants: open,
      settings: open,
      comments: open,
    });
  };

  const allExpanded = Object.values(openSections).every(Boolean);

  const updateSelectedStep = (
    updater: (step: SequenceStepData) => SequenceStepData
  ): void => {
    if (!selectedStep) return;
    onChange({
      ...sequenceData,
      steps: updateSequenceStepById(sequenceData.steps, selectedStep.id, updater),
    });
  };

  const handleDeleteSelectedStep = (): void => {
    if (!selectedStep) return;
    const nextSteps = deleteSequenceStepById(sequenceData.steps, selectedStep.id);
    onChange({ ...sequenceData, steps: nextSteps });
    onSelectStep(nextSteps[0]?.id ?? null);
  };

  const handleChangeBlockType = (nextBlockType: SequenceBlockType): void => {
    if (!selectedStep || selectedStep.kind !== 'block') return;
    const multiBranch = isMultiBranchBlockType(nextBlockType);
    const existingBranches = selectedStep.branches;
    let nextBranches = existingBranches;

    if (!multiBranch) {
      nextBranches = [existingBranches[0]];
    } else if (existingBranches.length < 2) {
      const nextBranchId = createUniqueSequenceBranchId(sequenceData.steps);
      nextBranches = [
        existingBranches[0],
        {
          id: nextBranchId,
          label: s.defaultBranchLabel(nextBlockType, 1),
          steps: [],
        },
      ];
    }

    updateSelectedStep((step) =>
      step.kind === 'block'
        ? {
            ...step,
            blockType: nextBlockType,
            ...(nextBlockType === 'rect'
              ? { color: step.color ?? '#eff6ff', label: '' }
              : { color: undefined }),
            branches: nextBranches,
          }
        : step
    );
  };

  const handleAddBranch = (): void => {
    if (!selectedStep || selectedStep.kind !== 'block') return;
    const nextBranchId = createUniqueSequenceBranchId(sequenceData.steps);
    const nextIdx = selectedStep.branches.length;
    updateSelectedStep((step) =>
      step.kind === 'block'
        ? {
            ...step,
            branches: [
              ...step.branches,
              {
                id: nextBranchId,
                label: s.defaultBranchLabel(step.blockType, nextIdx),
                steps: [],
              },
            ],
          }
        : step
    );
  };

  const handleAppendMessageToBranch = (branchId: string): void => {
    if (participants.length === 0) return;
    const stepId = createUniqueSequenceStepId(sequenceData.steps);
    const nextSteps = appendStepToBranch(
      sequenceData.steps,
      {
        id: stepId,
        kind: 'message',
        from: participants[0].id,
        to: (participants[1] ?? participants[0]).id,
        arrowType: '->>',
        text: s.defaultMessageText,
      },
      branchId
    );
    onChange({ ...sequenceData, steps: nextSteps });
    onSelectStep(stepId);
  };

  const updateSelectedParticipant = (
    patch: Partial<SequenceParticipantData>
  ): void => {
    if (!selectedParticipant) return;
    onChange({
      ...sequenceData,
      participants: participants.map((p) =>
        p.id === selectedParticipant.id ? { ...p, ...patch } : p
      ),
    });
  };

  const handleCommitParticipantId = (rawValue: string): void => {
    if (!selectedParticipant) return;
    const cleaned = rawValue.trim();
    if (!cleaned || cleaned === selectedParticipant.id) {
      setParticipantIdDraft(selectedParticipant.id);
      return;
    }
    const validFormat =
      /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(cleaned) &&
      !RESERVED_SEQUENCE_IDS.has(cleaned.toLowerCase());
    if (!validFormat || participants.some((p) => p.id === cleaned)) {
      setParticipantIdDraft(selectedParticipant.id);
      return;
    }

    const oldId = selectedParticipant.id;
    onChange({
      ...sequenceData,
      participants: participants.map((p) =>
        p.id === oldId ? { ...p, id: cleaned } : p
      ),
      steps: renameParticipantInSteps(sequenceData.steps, oldId, cleaned),
    });
    onSelectParticipant(cleaned);
  };

  const handleDeleteParticipant = (): void => {
    if (!selectedParticipant) return;
    const nextParticipants = participants.filter(
      (p) => p.id !== selectedParticipant.id
    );
    onChange({ ...sequenceData, participants: nextParticipants });
    onSelectParticipant(nextParticipants[0]?.id ?? null);
  };

  const handleAddBox = (): void => {
    const existing = new Set(boxes.map((b) => b.id));
    let num = boxes.length + 1;
    while (existing.has(`box_${num}`)) {
      num += 1;
    }
    const newBox: SequenceBoxData = {
      id: `box_${num}`,
      title: s.defaultBoxTitle(num),
      color: '#eff6ff',
    };
    onChange({ ...sequenceData, boxes: [...boxes, newBox] });
  };

  const updateBox = (boxId: string, patch: Partial<SequenceBoxData>): void => {
    onChange({
      ...sequenceData,
      boxes: boxes.map((b) => (b.id === boxId ? { ...b, ...patch } : b)),
    });
  };

  const handleDeleteBox = (boxId: string): void => {
    onChange({
      ...sequenceData,
      boxes: boxes.filter((b) => b.id !== boxId),
      participants: participants.map((p) =>
        p.boxId === boxId ? { ...p, boxId: undefined } : p
      ),
    });
  };

  const handleCommentsChange = (nextComments: string[]): void => {
    setCommentInputs(nextComments);
    const hasContent = nextComments.some((line) => line.trim() !== '');
    onChange({
      ...sequenceData,
      comments: hasContent ? nextComments : undefined,
    });
  };

  const messageSnapshot =
    selectedStep?.kind === 'message'
      ? activationAnalysis.snapshotsByStepId[selectedStep.id]
      : undefined;

  return (
    <div className="inspector-panel">
      <div className="inspector-accordion-controls">
        <button
          type="button"
          className="inspector-accordion-ctrl-btn"
          onClick={() => setAllSections(!allExpanded)}
        >
          {allExpanded
            ? t.inspector.collapseAllSections
            : t.inspector.expandAllSections}
        </button>
      </div>

      <InspectorCollapsibleSection
        title={s.stepSection}
        badgeText={selectedStep ? s.stepKindLabels[selectedStep.kind] : undefined}
        isOpen={openSections.step}
        onToggle={() => toggleSection('step')}
      >
        {!selectedStep ? (
          <p className="inspector-hint">{s.selectStepHint}</p>
        ) : selectedStep.kind === 'message' ? (
          <>
            <div className="field-row-compact">
              <label className="inspector-field">
                <span>{s.fromField}</span>
                <select
                  value={selectedStep.from}
                  onChange={(e) =>
                    updateSelectedStep((step) =>
                      step.kind === 'message' ? { ...step, from: e.target.value } : step
                    )
                  }
                >
                  {participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.alias ? `${p.alias} (${p.id})` : p.id}
                    </option>
                  ))}
                </select>
              </label>

              <label className="inspector-field">
                <span>{s.toField}</span>
                <select
                  value={selectedStep.to}
                  onChange={(e) =>
                    updateSelectedStep((step) =>
                      step.kind === 'message' ? { ...step, to: e.target.value } : step
                    )
                  }
                >
                  {participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.alias ? `${p.alias} (${p.id})` : p.id}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="button"
              className="btn-secondary btn-xs seq-swap-btn"
              onClick={() =>
                updateSelectedStep((step) =>
                  step.kind === 'message'
                    ? { ...step, from: step.to, to: step.from }
                    : step
                )
              }
            >
              <ArrowLeftRight size={12} />
              <span>{s.swapPartiesBtn}</span>
            </button>

            <label className="inspector-field">
              <span>{s.arrowTypeField}</span>
              <select
                value={selectedStep.arrowType}
                onChange={(e) =>
                  updateSelectedStep((step) =>
                    step.kind === 'message'
                      ? { ...step, arrowType: e.target.value as SequenceArrowType }
                      : step
                  )
                }
              >
                {SEQUENCE_ARROW_OPTIONS.map((arrow) => (
                  <option key={arrow} value={arrow}>
                    {s.arrowTypes[arrow]}
                  </option>
                ))}
              </select>
            </label>

            <label className="inspector-field">
              <span>{s.messageTextField}</span>
              <GuardedInput
                value={selectedStep.text}
                placeholder={s.messageTextPlaceholder}
                forbiddenRegex={FORBIDDEN_SEQUENCE_TEXT_CHARS_REGEX}
                formatError={safeguard.sequenceTextErrorChars}
                onChangeValue={(nextVal) =>
                  updateSelectedStep((step) =>
                    step.kind === 'message' ? { ...step, text: nextVal } : step
                  )
                }
              />
            </label>

            <label className="checkbox-field-label">
              <input
                type="checkbox"
                checked={Boolean(selectedStep.activateTarget)}
                onChange={(e) =>
                  updateSelectedStep((step) =>
                    step.kind === 'message'
                      ? {
                          ...step,
                          activateTarget: e.target.checked ? true : undefined,
                        }
                      : step
                  )
                }
              />
              <span>{s.activateTargetField}</span>
            </label>

            <label className="checkbox-field-label">
              <input
                type="checkbox"
                checked={Boolean(selectedStep.deactivateSource)}
                onChange={(e) =>
                  updateSelectedStep((step) =>
                    step.kind === 'message'
                      ? {
                          ...step,
                          deactivateSource: e.target.checked ? true : undefined,
                        }
                      : step
                  )
                }
              />
              <span>{s.deactivateSourceField}</span>
            </label>

            {selectedStep.deactivateSource &&
              messageSnapshot &&
              !messageSnapshot.canDeactivateSource && (
                <p className="inspector-hint seq-warn-hint">
                  {s.deactivateUnavailableHint}
                </p>
              )}

            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleDeleteSelectedStep}
            >
              <Trash2 size={14} />
              <span>{s.deleteStepBtn}</span>
            </button>
          </>
        ) : selectedStep.kind === 'note' ? (
          <>
            <label className="inspector-field">
              <span>{s.placementField}</span>
              <select
                value={selectedStep.placement}
                onChange={(e) => {
                  const placement = e.target.value as SequenceNotePlacement;
                  updateSelectedStep((step) =>
                    step.kind === 'note'
                      ? {
                          ...step,
                          placement,
                          participantId2:
                            placement === 'over' ? step.participantId2 : undefined,
                        }
                      : step
                  );
                }}
              >
                {NOTE_PLACEMENTS.map((pl) => (
                  <option key={pl} value={pl}>
                    {s.placements[pl]}
                  </option>
                ))}
              </select>
            </label>

            <label className="inspector-field">
              <span>{s.noteTargetField}</span>
              <select
                value={selectedStep.participantId}
                onChange={(e) =>
                  updateSelectedStep((step) =>
                    step.kind === 'note'
                      ? { ...step, participantId: e.target.value }
                      : step
                  )
                }
              >
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.alias ? `${p.alias} (${p.id})` : p.id}
                  </option>
                ))}
              </select>
            </label>

            {selectedStep.placement === 'over' && (
              <label className="inspector-field">
                <span>{s.noteTarget2Field}</span>
                <select
                  value={selectedStep.participantId2 ?? ''}
                  onChange={(e) =>
                    updateSelectedStep((step) =>
                      step.kind === 'note'
                        ? {
                            ...step,
                            participantId2: e.target.value || undefined,
                          }
                        : step
                    )
                  }
                >
                  <option value="">{s.noteNoSecondOption}</option>
                  {participants
                    .filter((p) => p.id !== selectedStep.participantId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.alias ? `${p.alias} (${p.id})` : p.id}
                      </option>
                    ))}
                </select>
              </label>
            )}

            <label className="inspector-field">
              <span>{s.noteTextField}</span>
              <GuardedInput
                value={selectedStep.text}
                placeholder={s.noteTextPlaceholder}
                forbiddenRegex={FORBIDDEN_SEQUENCE_TEXT_CHARS_REGEX}
                formatError={safeguard.sequenceTextErrorChars}
                onChangeValue={(nextVal) =>
                  updateSelectedStep((step) =>
                    step.kind === 'note' ? { ...step, text: nextVal } : step
                  )
                }
              />
            </label>

            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleDeleteSelectedStep}
            >
              <Trash2 size={14} />
              <span>{s.deleteStepBtn}</span>
            </button>
          </>
        ) : (
          <>
            <label className="inspector-field">
              <span>{s.blockTypeField}</span>
              <select
                value={selectedStep.blockType}
                onChange={(e) =>
                  handleChangeBlockType(e.target.value as SequenceBlockType)
                }
              >
                {SEQUENCE_BLOCK_TYPES.map((bt) => (
                  <option key={bt} value={bt}>
                    {s.blockTypes[bt]}
                  </option>
                ))}
              </select>
            </label>

            {selectedStep.blockType === 'rect' ? (
              <div className="inspector-field">
                <span>{s.blockColorField}</span>
                <div className="color-palette-grid">
                  {COLOR_PALETTE_ITEMS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      className={`color-swatch ${
                        (selectedStep.color ?? '#eff6ff') === item.value
                          ? 'is-active'
                          : ''
                      }`}
                      style={{ backgroundColor: item.value }}
                      title={t.inspector.colors[item.key]}
                      onClick={() =>
                        updateSelectedStep((step) =>
                          step.kind === 'block' ? { ...step, color: item.value } : step
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            ) : (
              <label className="inspector-field">
                <span>{s.blockLabelField}</span>
                <GuardedInput
                  value={selectedStep.label}
                  placeholder={s.blockLabelPlaceholder}
                  forbiddenRegex={FORBIDDEN_SEQUENCE_TEXT_CHARS_REGEX}
                  formatError={safeguard.sequenceTextErrorChars}
                  onChangeValue={(nextVal) =>
                    updateSelectedStep((step) =>
                      step.kind === 'block' ? { ...step, label: nextVal } : step
                    )
                  }
                />
              </label>
            )}

            {isMultiBranchBlockType(selectedStep.blockType) && (
              <div className="seq-branches-editor">
                <div className="inspector-section-subhead">
                  <span>{s.branchesHeading}</span>
                  <button
                    type="button"
                    className="btn-secondary btn-xs"
                    onClick={handleAddBranch}
                  >
                    <Plus size={12} />
                    <span>{s.addBranchBtn}</span>
                  </button>
                </div>
                {selectedStep.branches.map((branch, idx) => (
                  <div key={branch.id} className="seq-branch-card">
                    {idx === 0 ? (
                      <div className="seq-branch-card-top">
                        <span className="inspector-hint">{s.firstBranchPrimaryHint}</span>
                        <button
                          type="button"
                          className="btn-secondary btn-xs"
                          onClick={() => handleAppendMessageToBranch(branch.id)}
                        >
                          <Plus size={11} />
                          <span>{s.addMessageHereBtn}</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="seq-branch-card-row">
                          <GuardedInput
                            value={branch.label ?? ''}
                            placeholder={s.branchLabelPlaceholder}
                            ariaLabel={s.branchLabelField}
                            forbiddenRegex={FORBIDDEN_SEQUENCE_TEXT_CHARS_REGEX}
                            formatError={safeguard.sequenceTextErrorChars}
                            onChangeValue={(nextVal) =>
                              updateSelectedStep((step) =>
                                step.kind === 'block'
                                  ? {
                                      ...step,
                                      branches: step.branches.map((b) =>
                                        b.id === branch.id ? { ...b, label: nextVal } : b
                                      ),
                                    }
                                  : step
                              )
                            }
                          />
                          <button
                            type="button"
                            className="btn-icon-danger"
                            title={s.deleteBranchTitle}
                            onClick={() =>
                              updateSelectedStep((step) =>
                                step.kind === 'block'
                                  ? {
                                      ...step,
                                      branches: step.branches.filter(
                                        (b) => b.id !== branch.id
                                      ),
                                    }
                                  : step
                              )
                            }
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        <button
                          type="button"
                          className="btn-secondary btn-xs"
                          onClick={() => handleAppendMessageToBranch(branch.id)}
                        >
                          <Plus size={11} />
                          <span>{s.addMessageHereBtn}</span>
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleDeleteSelectedStep}
            >
              <Trash2 size={14} />
              <span>{s.deleteStepBtn}</span>
            </button>
          </>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={s.participantsSection}
        badgeText={participants.length}
        isOpen={openSections.participants}
        onToggle={() => toggleSection('participants')}
      >
        {participants.length === 0 ? (
          <p className="inspector-hint">{s.emptyParticipants}</p>
        ) : (
          selectedParticipant && (
            <>
              <label className="inspector-field">
                <span>{s.targetParticipantField}</span>
                <select
                  value={selectedParticipant.id}
                  onChange={(e) => onSelectParticipant(e.target.value)}
                >
                  {participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.alias ? `${p.alias} (${p.id})` : p.id}
                    </option>
                  ))}
                </select>
              </label>

              <div className="field-row-compact">
                <label className="inspector-field">
                  <span>{s.participantKindField}</span>
                  <select
                    value={selectedParticipant.kind}
                    onChange={(e) =>
                      updateSelectedParticipant({
                        kind: e.target.value as SequenceParticipantKind,
                      })
                    }
                  >
                    <option value="participant">{s.participantKinds.participant}</option>
                    <option value="actor">{s.participantKinds.actor}</option>
                  </select>
                </label>

                <label className="inspector-field">
                  <span>{s.participantIdField}</span>
                  <GuardedInput
                    value={participantIdDraft}
                    forbiddenRegex={FORBIDDEN_SEQUENCE_ID_CHARS_REGEX}
                    formatError={safeguard.sequenceIdErrorChars}
                    onChangeValue={(nextVal) => {
                      setParticipantIdDraft(nextVal);
                      handleCommitParticipantId(nextVal);
                    }}
                  />
                </label>
              </div>

              <label className="inspector-field">
                <span>{s.participantAliasField}</span>
                <GuardedInput
                  value={selectedParticipant.alias ?? ''}
                  placeholder={s.participantAliasPlaceholder}
                  forbiddenRegex={FORBIDDEN_SEQUENCE_ALIAS_CHARS_REGEX}
                  formatError={safeguard.sequenceAliasErrorChars}
                  onChangeValue={(nextVal) =>
                    updateSelectedParticipant({
                      alias: nextVal || undefined,
                    })
                  }
                />
              </label>

              <label className="inspector-field">
                <span>{s.participantBoxField}</span>
                <select
                  value={selectedParticipant.boxId ?? ''}
                  onChange={(e) =>
                    updateSelectedParticipant({
                      boxId: e.target.value || undefined,
                    })
                  }
                >
                  <option value="">{s.noBoxOption}</option>
                  {boxes.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="btn-danger-outline"
                onClick={handleDeleteParticipant}
              >
                <Trash2 size={14} />
                <span>{s.deleteParticipantBtn}</span>
              </button>
            </>
          )
        )}

        <div className="seq-boxes-subsection">
          <div className="inspector-section-subhead">
            <span>{s.boxesHeading}</span>
            <button
              type="button"
              className="btn-secondary btn-xs"
              onClick={handleAddBox}
            >
              <Plus size={12} />
              <span>{s.addBoxBtn}</span>
            </button>
          </div>
          {boxes.length === 0 ? (
            <p className="inspector-hint">{s.noBoxesHint}</p>
          ) : (
            <div className="seq-box-list">
              {boxes.map((box) => (
                <div key={box.id} className="seq-box-item">
                  <div className="seq-branch-card-row">
                    <GuardedInput
                      value={box.title}
                      ariaLabel={s.boxTitleField}
                      forbiddenRegex={FORBIDDEN_SEQUENCE_TEXT_CHARS_REGEX}
                      formatError={safeguard.sequenceTextErrorChars}
                      onChangeValue={(nextVal) =>
                        updateBox(box.id, { title: nextVal })
                      }
                    />
                    <button
                      type="button"
                      className="btn-icon-danger"
                      title={s.deleteBoxTitle}
                      onClick={() => handleDeleteBox(box.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="color-palette-grid">
                    <button
                      type="button"
                      className={`color-swatch is-transparent ${
                        !box.color ? 'is-active' : ''
                      }`}
                      title={s.noColorOption}
                      onClick={() => updateBox(box.id, { color: undefined })}
                    />
                    {COLOR_PALETTE_ITEMS.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        className={`color-swatch ${
                          box.color === item.value ? 'is-active' : ''
                        }`}
                        style={{ backgroundColor: item.value }}
                        title={t.inspector.colors[item.key]}
                        onClick={() => updateBox(box.id, { color: item.value })}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={s.settingsSection}
        isOpen={openSections.settings}
        onToggle={() => toggleSection('settings')}
      >
        <label className="inspector-field">
          <span>{s.titleField}</span>
          <GuardedInput
            value={sequenceData.title ?? ''}
            placeholder={s.titlePlaceholder}
            forbiddenRegex={FORBIDDEN_SEQUENCE_TEXT_CHARS_REGEX}
            formatError={safeguard.sequenceTextErrorChars}
            onChangeValue={(nextVal) =>
              onChange({
                ...sequenceData,
                title: nextVal || undefined,
              })
            }
          />
        </label>

        <label className="checkbox-field-label">
          <input
            type="checkbox"
            checked={Boolean(sequenceData.autonumber)}
            onChange={(e) =>
              onChange({
                ...sequenceData,
                autonumber: e.target.checked ? true : undefined,
              })
            }
          />
          <span>{s.autonumberField}</span>
        </label>
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={s.commentsSection}
        badgeText={comments.length > 0 ? comments.length : undefined}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
      >
        <label className="inspector-field">
          <span>{s.commentsField}</span>
          <textarea
            className="inspector-comments-textarea"
            rows={4}
            placeholder={s.commentsPlaceholder}
            value={commentInputs.join('\n')}
            onChange={(e) =>
              handleCommentsChange(e.target.value.split('\n'))
            }
          />
        </label>
      </InspectorCollapsibleSection>
    </div>
  );
}
