export type TreemapNodeKind = 'section' | 'leaf';

export interface TreemapNodeData {
  id: string;
  depth: number;
  kind: TreemapNodeKind;
  label: string;
  value?: number;
  className?: string;
}

export interface TreemapClassDefData {
  name: string;
  fill: string;
  stroke: string;
  color?: string;
}

export interface TreemapDiagramData {
  diagramType: 'treemap';
  title?: string;
  nodes: TreemapNodeData[];
  classDefs?: TreemapClassDefData[];
  comments?: string[];
}
