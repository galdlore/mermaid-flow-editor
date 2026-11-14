export type MermaidDirection = 'TD' | 'LR' | 'BT' | 'RL';

export type NodeShape =
  | 'rect'
  | 'round'
  | 'stadium'
  | 'subroutine'
  | 'cylinder'
  | 'circle'
  | 'asymmetric'
  | 'diamond'
  | 'hexagon'
  | 'parallelogram'
  | 'parallelogram_alt'
  | 'trapezoid'
  | 'trapezoid_alt'
  | 'double_circle'
  | 'doc'
  | 'cyl_modern';

export type EdgeLineType =
  | 'arrow'
  | 'line'
  | 'dotted'
  | 'thick'
  | 'circle'
  | 'cross'
  | 'bidirectional'
  | 'invisible';

export type EdgeLabelStyle = 'pipe' | 'inline';

export interface MermaidSubgraphData {
  id: string;
  title: string;
  direction?: MermaidDirection;
}

export interface MermaidClassDefData {
  name: string;
  fill?: string;
  stroke?: string;
  color?: string;
}

export interface MermaidNodeData {
  id: string;
  label: string;
  shape: NodeShape;
  color?: string;
  strokeColor?: string;
  className?: string;
  subgraphId?: string;
  linkUrl?: string;
  linkTooltip?: string;
  position: {
    x: number;
    y: number;
  };
}

export interface MermaidEdgeData {
  id: string;
  source: string;
  target: string;
  label?: string;
  lineType: EdgeLineType;
  extraLength?: number;
  labelStyle?: EdgeLabelStyle;
  strokeColor?: string;
}

export interface MermaidDiagramData {
  direction: MermaidDirection;
  nodes: MermaidNodeData[];
  edges: MermaidEdgeData[];
  subgraphs?: MermaidSubgraphData[];
  classDefs?: MermaidClassDefData[];
  comments?: string[];
}

export interface FileOpenResult {
  canceled: boolean;
  filePath?: string;
  content?: string;
}

export interface FileSaveResult {
  canceled: boolean;
  filePath?: string;
}

export interface ElectronAPI {
  openFile: () => Promise<FileOpenResult>;
  saveFile: (filePath: string | null, content: string) => Promise<FileSaveResult>;
  saveFileAs: (content: string) => Promise<FileSaveResult>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
