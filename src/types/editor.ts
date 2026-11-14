export type MermaidDirection = 'TD' | 'LR' | 'BT' | 'RL';

export type NodeShape = 'rect' | 'round' | 'diamond' | 'circle' | 'stadium';

export type EdgeLineType = 'arrow' | 'dotted' | 'thick' | 'line';

export interface MermaidNodeData {
  id: string;
  label: string;
  shape: NodeShape;
  color?: string;
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
}

export interface MermaidDiagramData {
  direction: MermaidDirection;
  nodes: MermaidNodeData[];
  edges: MermaidEdgeData[];
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
