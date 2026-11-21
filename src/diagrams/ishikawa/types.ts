export interface IshikawaNodeData {
  id: string;
  depth: number;
  label: string;
}

export interface IshikawaDiagramData {
  diagramType: 'ishikawa';
  nodes: IshikawaNodeData[];
  comments?: string[];
}
