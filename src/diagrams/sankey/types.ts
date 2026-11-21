export interface SankeyLinkData {
  id: string;
  source: string;
  target: string;
  value: number;
}

export interface SankeyDiagramData {
  diagramType: 'sankey';
  title?: string;
  links: SankeyLinkData[];
  comments?: string[];
}
