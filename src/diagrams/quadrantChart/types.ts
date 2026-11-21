export interface QuadrantClassDefData {
  name: string;
  radius?: number;
  color?: string;
  strokeColor?: string;
  strokeWidthPx?: number;
}

export interface QuadrantPointData {
  id: string;
  label: string;
  x: number;
  y: number;
  className?: string;
  radius?: number;
  color?: string;
  strokeColor?: string;
  strokeWidthPx?: number;
}

export interface QuadrantConfigData {
  chartWidth: number;
  chartHeight: number;
}

export interface QuadrantDiagramData {
  diagramType: 'quadrantChart';
  title?: string;
  xAxisLeft: string;
  xAxisRight?: string;
  yAxisBottom: string;
  yAxisTop?: string;
  quadrant1: string;
  quadrant2: string;
  quadrant3: string;
  quadrant4: string;
  points: QuadrantPointData[];
  classDefs?: QuadrantClassDefData[];
  config: QuadrantConfigData;
  comments?: string[];
}
