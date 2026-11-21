export type ErDiagramDirection = 'TB' | 'BT' | 'LR' | 'RL';

export type ErAttributeKey = 'PK' | 'FK' | 'UK';

export type ErCardinality =
  | 'zero_or_one'
  | 'exactly_one'
  | 'zero_or_more'
  | 'one_or_more';

export interface ErAttributeData {
  id: string;
  type: string;
  name: string;
  keys?: ErAttributeKey[];
  comment?: string;
}

export interface ErEntityData {
  id: string;
  alias?: string;
  color?: string;
  attributes: ErAttributeData[];
}

export interface ErRelationshipData {
  id: string;
  from: string;
  to: string;
  fromCardinality: ErCardinality;
  toCardinality: ErCardinality;
  identifying: boolean;
  label: string;
}

export interface ErDiagramData {
  diagramType: 'er';
  title?: string;
  direction?: ErDiagramDirection;
  entities: ErEntityData[];
  relationships: ErRelationshipData[];
  comments?: string[];
}
