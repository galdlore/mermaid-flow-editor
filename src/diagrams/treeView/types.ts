export type TreeViewNodeType = 'directory' | 'file';

export type TreeViewIconOption = 'auto' | 'folder' | 'file' | 'none';

export interface TreeViewNodeData {
  id: string;
  depth: number;
  name: string;
  nodeType: TreeViewNodeType;
  description?: string;
  highlight?: boolean;
  icon?: TreeViewIconOption;
}

export interface TreeViewConfigData {
  showIcons: boolean;
  rowIndent: number;
  lineThickness: number;
  paddingX: number;
  paddingY: number;
}

export interface TreeViewDiagramData {
  diagramType: 'treeView';
  title?: string;
  config: TreeViewConfigData;
  nodes: TreeViewNodeData[];
  comments?: string[];
}
