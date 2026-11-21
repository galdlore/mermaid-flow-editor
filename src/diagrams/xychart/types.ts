export type XYChartOrientation = 'vertical' | 'horizontal';

export type XYChartXAxisType = 'band' | 'linear';

export type XYChartSeriesType = 'bar' | 'line';

export interface XYChartSeriesData {
  id: string;
  type: XYChartSeriesType;
  title?: string;
  values: number[];
}

export interface XYChartDiagramData {
  diagramType: 'xychart';
  orientation: XYChartOrientation;
  title?: string;
  xAxisTitle?: string;
  xAxisType: XYChartXAxisType;
  xAxisCategories: string[];
  xAxisMin?: number;
  xAxisMax?: number;
  yAxisTitle?: string;
  yAxisAutoRange?: boolean;
  yAxisMin?: number;
  yAxisMax?: number;
  series: XYChartSeriesData[];
  showDataLabel?: boolean;
  showDataLabelOutsideBar?: boolean;
  chartWidth?: number;
  chartHeight?: number;
  comments?: string[];
}
