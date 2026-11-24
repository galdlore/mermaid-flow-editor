import { ArrowLeftRight, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import GuardedInput from '../GuardedInput';
import { InspectorCollapsibleSection } from '../InspectorCollapsibleSection';
import { InspectorColorPalette } from '../InspectorCommon';
import { FORBIDDEN_SEQUENCE_TEXT_CHARS_REGEX } from '../../utils/inputSafeguard';
import type {
  SequenceArrowType,
  SequenceBlockType,
  SequenceNotePlacement,
  SequenceParticipantData,
  SequenceStepData,
} from '../../types/editor';
import {
  SEQUENCE_ARROW_OPTIONS,
  SEQUENCE_BLOCK_TYPES,
  isMultiBranchBlockType,
  type SequenceStepActivationSnapshot,
} from '../../utils/sequenceConverter';

const NOTE_PLACEMENTS: ReadonlyArray<SequenceNotePlacement> = [
  'right_of',
  'left_of',
  'over',
];

export interface SequenceStepSectionProps {
  selectedStep: SequenceStepData | null;
  participants: ReadonlyArray<SequenceParticipantData>;
  messageSnapshot: SequenceStepActivationSnapshot | undefined;
  isOpen: boolean;
  onToggle: () => void;
  onUpdateSelectedStep: (updater: (step: SequenceStepData) => SequenceStepData) => void;
  onDeleteSelectedStep: () => void;
  onChangeBlockType: (nextBlockType: SequenceBlockType) => void;
  onAddBranch: () => void;
  onAppendMessageToBranch: (branchId: string) => void;
}

export default function SequenceStepSection({
  selectedStep,
  participants,
  messageSnapshot,
  isOpen,
  onToggle,
  onUpdateSelectedStep,
  onDeleteSelectedStep,
  onChangeBlockType,
  onAddBranch,
  onAppendMessageToBranch,
}: SequenceStepSectionProps) {
  const { t } = useI18n();
  const s = t.inspector.sequence;
  const safeguard = t.inspector.safeguard;

  return (
    <InspectorCollapsibleSection
      title={s.stepSection}
      badgeText={selectedStep ? s.stepKindLabels[selectedStep.kind] : undefined}
      isOpen={isOpen}
      onToggle={onToggle}
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
                  onUpdateSelectedStep((step) =>
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
                  onUpdateSelectedStep((step) =>
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
              onUpdateSelectedStep((step) =>
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
                onUpdateSelectedStep((step) =>
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
                onUpdateSelectedStep((step) =>
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
                onUpdateSelectedStep((step) =>
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
                onUpdateSelectedStep((step) =>
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
            onClick={onDeleteSelectedStep}
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
                onUpdateSelectedStep((step) =>
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
                onUpdateSelectedStep((step) =>
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
                  onUpdateSelectedStep((step) =>
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
                onUpdateSelectedStep((step) =>
                  step.kind === 'note' ? { ...step, text: nextVal } : step
                )
              }
            />
          </label>

          <button
            type="button"
            className="btn-danger-outline"
            onClick={onDeleteSelectedStep}
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
                onChangeBlockType(e.target.value as SequenceBlockType)
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
            <InspectorColorPalette
              label={s.blockColorField}
              value={selectedStep.color ?? '#eff6ff'}
              allowClear={false}
              onChange={(nextColor) =>
                onUpdateSelectedStep((step) =>
                  step.kind === 'block' ? { ...step, color: nextColor } : step
                )
              }
            />
          ) : (
            <label className="inspector-field">
              <span>{s.blockLabelField}</span>
              <GuardedInput
                value={selectedStep.label}
                placeholder={s.blockLabelPlaceholder}
                forbiddenRegex={FORBIDDEN_SEQUENCE_TEXT_CHARS_REGEX}
                formatError={safeguard.sequenceTextErrorChars}
                onChangeValue={(nextVal) =>
                  onUpdateSelectedStep((step) =>
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
                  onClick={onAddBranch}
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
                        onClick={() => onAppendMessageToBranch(branch.id)}
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
                            onUpdateSelectedStep((step) =>
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
                            onUpdateSelectedStep((step) =>
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
                        onClick={() => onAppendMessageToBranch(branch.id)}
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
            onClick={onDeleteSelectedStep}
          >
            <Trash2 size={14} />
            <span>{s.deleteStepBtn}</span>
          </button>
        </>
      )}
    </InspectorCollapsibleSection>
  );
}
