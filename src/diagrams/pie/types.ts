export type PieLegendPosition =
  | 'right'
  | 'left'
  | 'top'
  | 'bottom'
  | 'center';

export interface PieSliceData {
  id: string;
  label: string;
  value: number;
}

export interface PieDiagramData {
  diagramType: 'pie';
  title?: string;
  showData?: boolean;
  textPosition?: number;
  donutHole?: number;
  legendPosition?: PieLegendPosition;
  highlightSlice?: string;
  slices: PieSliceData[];
  comments?: string[];
}
