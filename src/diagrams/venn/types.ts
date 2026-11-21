export interface VennSetData {
  id: string;
  label: string;
  size: number;
  fill?: string;
  stroke?: string;
  textColor?: string;
  fillOpacity?: number;
}

export interface VennUnionData {
  id: string;
  sets: string[];
  label?: string;
  size: number;
  fill?: string;
  stroke?: string;
}

export interface VennTextItemData {
  id: string;
  sets: string[];
  label: string;
}

export interface VennDiagramData {
  diagramType: 'venn';
  title?: string;
  sets: VennSetData[];
  unions: VennUnionData[];
  texts: VennTextItemData[];
  comments?: string[];
}
