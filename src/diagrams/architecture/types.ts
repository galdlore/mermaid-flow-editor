export type ArchitectureDirection = 'L' | 'R' | 'T' | 'B';

export type ArchitectureNodeType = 'service' | 'junction';

export type ArchitectureAlignDirection = 'row' | 'column';

export interface ArchitectureGroupData {
  id: string;
  title: string;
  icon?: string;
  parentId?: string;
}

export interface ArchitectureNodeData {
  id: string;
  type: ArchitectureNodeType;
  title?: string;
  icon?: string;
  groupId?: string;
}

export interface ArchitectureEdgeData {
  id: string;
  lhsId: string;
  lhsDir: ArchitectureDirection;
  lhsInto?: boolean;
  lhsGroup?: boolean;
  rhsId: string;
  rhsDir: ArchitectureDirection;
  rhsInto?: boolean;
  rhsGroup?: boolean;
  title?: string;
}

export interface ArchitectureAlignHintData {
  id: string;
  direction: ArchitectureAlignDirection;
  members: string[];
}

export interface ArchitectureDiagramData {
  diagramType: 'architecture';
  title?: string;
  groups: ArchitectureGroupData[];
  nodes: ArchitectureNodeData[];
  edges: ArchitectureEdgeData[];
  alignments?: ArchitectureAlignHintData[];
  padding?: number;
  iconSize?: number;
  nodeSeparation?: number;
  comments?: string[];
}
