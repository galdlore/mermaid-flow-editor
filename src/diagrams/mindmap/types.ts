export type MindmapNodeShape =
  | 'default'
  | 'rounded'
  | 'rect'
  | 'circle'
  | 'cloud'
  | 'bang'
  | 'hexagon';

export interface MindmapNodeData {
  id: string;
  depth: number;
  label: string;
  shape: MindmapNodeShape;
  icon?: string;
  cssClass?: string;
  useMarkdown?: boolean;
}

export interface MindmapConfigData {
  padding: number;
  maxNodeWidth: number;
}

export interface MindmapDiagramData {
  diagramType: 'mindmap';
  config: MindmapConfigData;
  nodes: MindmapNodeData[];
  comments?: string[];
}
