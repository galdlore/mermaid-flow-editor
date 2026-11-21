export type BlockNodeShape =
  | 'square'
  | 'round'
  | 'stadium'
  | 'subroutine'
  | 'cylinder'
  | 'circle'
  | 'doublecircle'
  | 'diamond'
  | 'hexagon'
  | 'lean_right'
  | 'lean_left'
  | 'trapezoid'
  | 'inv_trapezoid'
  | 'asymmetric';

export type BlockArrowDirection = 'right' | 'left' | 'up' | 'down' | 'x' | 'y';

export type BlockItemKind = 'node' | 'space' | 'arrow' | 'group';

export type BlockEdgeLineType =
  | 'arrow'
  | 'line'
  | 'dotted'
  | 'thick'
  | 'bidirectional';

export interface BlockItemData {
  id: string;
  kind: BlockItemKind;
  label?: string;
  shape?: BlockNodeShape;
  span?: number;
  arrowDirection?: BlockArrowDirection;
  groupColumns?: number;
  parentGroupId?: string;
  fill?: string;
  stroke?: string;
}

export interface BlockEdgeData {
  id: string;
  from: string;
  to: string;
  lineType: BlockEdgeLineType;
  label?: string;
}

export interface BlockDiagramData {
  diagramType: 'block';
  columns: number;
  items: BlockItemData[];
  edges: BlockEdgeData[];
  comments?: string[];
}
