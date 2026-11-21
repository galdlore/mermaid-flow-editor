export type C4DiagramSubtype =
  | 'C4Context'
  | 'C4Container'
  | 'C4Component'
  | 'C4Dynamic'
  | 'C4Deployment';

export type C4ElementKind = 'person' | 'system' | 'container' | 'component';

export type C4ElementVariant = 'standard' | 'db' | 'queue';

export type C4BoundaryKind =
  | 'enterprise'
  | 'system'
  | 'container'
  | 'boundary'
  | 'node';

export type C4RelationType =
  | 'Rel'
  | 'BiRel'
  | 'Rel_Up'
  | 'Rel_Down'
  | 'Rel_Left'
  | 'Rel_Right'
  | 'Rel_Back'
  | 'RelIndex';

export interface C4ElementData {
  id: string;
  kind: C4ElementKind;
  variant?: C4ElementVariant;
  external?: boolean;
  label: string;
  techn?: string;
  descr?: string;
  boundaryId?: string;
  bgColor?: string;
  fontColor?: string;
  borderColor?: string;
}

export interface C4BoundaryData {
  id: string;
  kind: C4BoundaryKind;
  label: string;
  boundaryType?: string;
  descr?: string;
  parentBoundaryId?: string;
}

export interface C4RelationData {
  id: string;
  relType: C4RelationType;
  index?: string;
  from: string;
  to: string;
  label: string;
  techn?: string;
  descr?: string;
  lineColor?: string;
  textColor?: string;
}

export interface C4DiagramData {
  diagramType: 'c4';
  subtype: C4DiagramSubtype;
  title?: string;
  shapeInRow?: number;
  boundaryInRow?: number;
  elements: C4ElementData[];
  boundaries: C4BoundaryData[];
  relations: C4RelationData[];
  comments?: string[];
}
