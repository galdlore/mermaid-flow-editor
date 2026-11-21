export type SequenceParticipantKind = 'participant' | 'actor';

export interface SequenceBoxData {
  id: string;
  title: string;
  color?: string;
}

export interface SequenceParticipantData {
  id: string;
  alias?: string;
  kind: SequenceParticipantKind;
  boxId?: string;
}

export type SequenceArrowType =
  | '->>'
  | '-->>'
  | '->'
  | '-->'
  | '-x'
  | '--x'
  | '-)'
  | '--)'
  | '<<->>'
  | '<<-->>';

export type SequenceNotePlacement = 'right_of' | 'left_of' | 'over';

export type SequenceBlockType =
  | 'loop'
  | 'alt'
  | 'opt'
  | 'par'
  | 'critical'
  | 'break'
  | 'rect';

export interface SequenceMessageStepData {
  id: string;
  kind: 'message';
  from: string;
  to: string;
  arrowType: SequenceArrowType;
  text: string;
  activateTarget?: boolean;
  deactivateSource?: boolean;
}

export interface SequenceNoteStepData {
  id: string;
  kind: 'note';
  placement: SequenceNotePlacement;
  participantId: string;
  participantId2?: string;
  text: string;
}

export interface SequenceBlockBranchData {
  id: string;
  label?: string;
  steps: SequenceStepData[];
}

export interface SequenceBlockStepData {
  id: string;
  kind: 'block';
  blockType: SequenceBlockType;
  label: string;
  color?: string;
  branches: SequenceBlockBranchData[];
}

export type SequenceStepData =
  | SequenceMessageStepData
  | SequenceNoteStepData
  | SequenceBlockStepData;

export interface SequenceDiagramData {
  diagramType: 'sequence';
  title?: string;
  autonumber?: boolean;
  boxes?: SequenceBoxData[];
  participants: SequenceParticipantData[];
  steps: SequenceStepData[];
  comments?: string[];
}
