export type StateDiagramDirection = 'TB' | 'BT' | 'LR' | 'RL';

export type StateKind = 'normal' | 'composite' | 'choice' | 'fork' | 'join';

export interface StateNodeData {
  id: string;
  label?: string;
  description?: string;
  kind: StateKind;
  parentId?: string;
  subDirection?: StateDiagramDirection;
  color?: string;
}

export interface StateTransitionData {
  id: string;
  from: string;
  to: string;
  label?: string;
  scopeId?: string;
}

export type StateNotePosition = 'left of' | 'right of';

export interface StateNoteData {
  id: string;
  targetStateId: string;
  position: StateNotePosition;
  text: string;
}

export interface StateDiagramData {
  diagramType: 'state';
  title?: string;
  direction?: StateDiagramDirection;
  states: StateNodeData[];
  transitions: StateTransitionData[];
  notes?: StateNoteData[];
  comments?: string[];
}
