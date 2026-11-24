import { Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import GuardedInput from '../GuardedInput';
import { InspectorCollapsibleSection } from '../InspectorCollapsibleSection';
import { InspectorColorPalette } from '../InspectorCommon';
import {
  FORBIDDEN_SEQUENCE_ALIAS_CHARS_REGEX,
  FORBIDDEN_SEQUENCE_ID_CHARS_REGEX,
  FORBIDDEN_SEQUENCE_TEXT_CHARS_REGEX,
} from '../../utils/inputSafeguard';
import type {
  SequenceBoxData,
  SequenceDiagramData,
  SequenceParticipantData,
  SequenceParticipantKind,
} from '../../types/editor';

export interface SequenceParticipantsSectionProps {
  participants: ReadonlyArray<SequenceParticipantData>;
  selectedParticipant: SequenceParticipantData | null;
  participantIdDraft: string;
  boxes: ReadonlyArray<SequenceBoxData>;
  isOpen: boolean;
  onToggle: () => void;
  onSelectParticipant: (participantId: string | null) => void;
  onChangeParticipantIdDraft: (nextDraft: string) => void;
  onCommitParticipantId: (rawValue: string) => void;
  onUpdateSelectedParticipant: (patch: Partial<SequenceParticipantData>) => void;
  onDeleteParticipant: () => void;
  onAddBox: () => void;
  onUpdateBox: (boxId: string, patch: Partial<SequenceBoxData>) => void;
  onDeleteBox: (boxId: string) => void;
}

export function SequenceParticipantsSection({
  participants,
  selectedParticipant,
  participantIdDraft,
  boxes,
  isOpen,
  onToggle,
  onSelectParticipant,
  onChangeParticipantIdDraft,
  onCommitParticipantId,
  onUpdateSelectedParticipant,
  onDeleteParticipant,
  onAddBox,
  onUpdateBox,
  onDeleteBox,
}: SequenceParticipantsSectionProps) {
  const { t } = useI18n();
  const s = t.inspector.sequence;
  const safeguard = t.inspector.safeguard;

  return (
    <InspectorCollapsibleSection
      title={s.participantsSection}
      badgeText={participants.length}
      isOpen={isOpen}
      onToggle={onToggle}
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
                    onUpdateSelectedParticipant({
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
                    onChangeParticipantIdDraft(nextVal);
                    onCommitParticipantId(nextVal);
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
                  onUpdateSelectedParticipant({
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
                  onUpdateSelectedParticipant({
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
              onClick={onDeleteParticipant}
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
            onClick={onAddBox}
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
                      onUpdateBox(box.id, { title: nextVal })
                    }
                  />
                  <button
                    type="button"
                    className="btn-icon-danger"
                    title={s.deleteBoxTitle}
                    onClick={() => onDeleteBox(box.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <InspectorColorPalette
                  value={box.color}
                  clearTitle={s.noColorOption}
                  onChange={(color) => onUpdateBox(box.id, { color })}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </InspectorCollapsibleSection>
  );
}

export interface SequenceSettingsSectionProps {
  sequenceData: SequenceDiagramData;
  isOpen: boolean;
  onToggle: () => void;
  onChange: (next: SequenceDiagramData) => void;
}

export function SequenceSettingsSection({
  sequenceData,
  isOpen,
  onToggle,
  onChange,
}: SequenceSettingsSectionProps) {
  const { t } = useI18n();
  const s = t.inspector.sequence;
  const safeguard = t.inspector.safeguard;

  return (
    <InspectorCollapsibleSection
      title={s.settingsSection}
      isOpen={isOpen}
      onToggle={onToggle}
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
  );
}
