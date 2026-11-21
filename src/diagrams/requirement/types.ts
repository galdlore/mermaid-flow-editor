export type RequirementKind =
  | 'requirement'
  | 'functionalRequirement'
  | 'interfaceRequirement'
  | 'performanceRequirement'
  | 'physicalRequirement'
  | 'designConstraint';

export type RequirementRisk = 'low' | 'medium' | 'high';

export type RequirementVerifyMethod =
  | 'analysis'
  | 'demonstration'
  | 'inspection'
  | 'test';

export type RequirementRelationType =
  | 'contains'
  | 'copies'
  | 'derives'
  | 'satisfies'
  | 'verifies'
  | 'refines'
  | 'traces';

export type RequirementDirection = 'TB' | 'BT' | 'LR' | 'RL';

export interface RequirementNodeData {
  id: string;
  name: string;
  kind: RequirementKind;
  reqId: string;
  text: string;
  risk: RequirementRisk;
  verifyMethod: RequirementVerifyMethod;
}

export interface RequirementElementData {
  id: string;
  name: string;
  type: string;
  docref: string;
}

export interface RequirementRelationData {
  id: string;
  sourceId: string;
  targetId: string;
  type: RequirementRelationType;
}

export interface RequirementDiagramData {
  diagramType: 'requirement';
  title?: string;
  direction?: RequirementDirection;
  requirements: RequirementNodeData[];
  elements: RequirementElementData[];
  relations: RequirementRelationData[];
  comments?: string[];
}
