import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import {
  InspectorBulkControls,
  InspectorCommentsSection,
} from './InspectorCommon';
import {
  SequenceParticipantsSection,
  SequenceSettingsSection,
} from './sequence/SequenceParticipantsSection';
import SequenceStepSection from './sequence/SequenceStepSection';
import type {
  SequenceBlockType,
  SequenceBoxData,
  SequenceDiagramData,
  SequenceParticipantData,
  SequenceStepData,
} from '../types/editor';
import {
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

  const participants = sequenceData.participants;
  const boxes = sequenceData.boxes ?? [];

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

  const messageSnapshot =
    selectedStep?.kind === 'message'
      ? activationAnalysis.snapshotsByStepId[selectedStep.id]
      : undefined;

  return (
    <div className="inspector-panel">
      <InspectorBulkControls allExpanded={allExpanded} onSetAll={setAllSections} />

      <SequenceStepSection
        selectedStep={selectedStep}
        participants={participants}
        messageSnapshot={messageSnapshot}
        isOpen={openSections.step}
        onToggle={() => toggleSection('step')}
        onUpdateSelectedStep={updateSelectedStep}
        onDeleteSelectedStep={handleDeleteSelectedStep}
        onChangeBlockType={handleChangeBlockType}
        onAddBranch={handleAddBranch}
        onAppendMessageToBranch={handleAppendMessageToBranch}
      />

      <SequenceParticipantsSection
        participants={participants}
        selectedParticipant={selectedParticipant}
        participantIdDraft={participantIdDraft}
        boxes={boxes}
        isOpen={openSections.participants}
        onToggle={() => toggleSection('participants')}
        onSelectParticipant={onSelectParticipant}
        onChangeParticipantIdDraft={setParticipantIdDraft}
        onCommitParticipantId={handleCommitParticipantId}
        onUpdateSelectedParticipant={updateSelectedParticipant}
        onDeleteParticipant={handleDeleteParticipant}
        onAddBox={handleAddBox}
        onUpdateBox={updateBox}
        onDeleteBox={handleDeleteBox}
      />

      <SequenceSettingsSection
        sequenceData={sequenceData}
        isOpen={openSections.settings}
        onToggle={() => toggleSection('settings')}
        onChange={onChange}
      />

      <InspectorCommentsSection
        title={s.commentsSection}
        fieldLabel={s.commentsField}
        placeholder={s.commentsPlaceholder}
        comments={sequenceData.comments}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
        rows={4}
        onChangeComments={(nextComments) =>
          onChange({
            ...sequenceData,
            comments: nextComments,
          })
        }
      />
    </div>
  );
}
