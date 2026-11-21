export type RadarGraticule = 'circle' | 'polygon';

export interface RadarAxisData {
  id: string;
  label: string;
}

export interface RadarCurveData {
  id: string;
  label: string;
  values: number[];
}

export interface RadarDiagramData {
  diagramType: 'radar';
  title?: string;
  axes: RadarAxisData[];
  curves: RadarCurveData[];
  showLegend: boolean;
  ticks: number;
  min: number;
  max?: number;
  graticule: RadarGraticule;
  comments?: string[];
}
