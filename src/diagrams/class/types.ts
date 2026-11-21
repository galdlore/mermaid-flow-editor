export type ClassDiagramDirection = 'TB' | 'BT' | 'LR' | 'RL';

export type ClassMemberVisibility = '+' | '-' | '#' | '~' | '';

export type ClassMemberClassifier = 'none' | 'static' | 'abstract';

export type ClassMemberKind = 'field' | 'method';

export interface ClassMemberData {
  id: string;
  kind: ClassMemberKind;
  visibility: ClassMemberVisibility;
  name: string;
  type?: string;
  params?: string;
  classifier?: ClassMemberClassifier;
}

export interface ClassNodeData {
  id: string;
  label?: string;
  generic?: string;
  stereotype?: string;
  namespace?: string;
  color?: string;
  members: ClassMemberData[];
}

export type ClassRelationType =
  | '--|>'
  | '..|>'
  | '*--'
  | 'o--'
  | '-->'
  | '..>'
  | '--'
  | '..';

export interface ClassRelationData {
  id: string;
  from: string;
  to: string;
  relationType: ClassRelationType;
  fromCardinality?: string;
  toCardinality?: string;
  label?: string;
}

export interface ClassNoteData {
  id: string;
  targetClassId?: string;
  text: string;
}

export interface ClassDiagramData {
  diagramType: 'class';
  title?: string;
  direction?: ClassDiagramDirection;
  classes: ClassNodeData[];
  relations: ClassRelationData[];
  notes?: ClassNoteData[];
  comments?: string[];
}
