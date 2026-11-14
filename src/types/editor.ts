export type MermaidDiagramType =
  | 'flowchart'
  | 'swimlane'
  | 'treeView'
  | 'kanban'
  | 'pie'
  | 'xychart'
  | 'architecture'
  | 'mindmap'
  | 'quadrantChart'
  | 'sequence'
  | 'class'
  | 'state'
  | 'er'
  | 'gantt';

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
  fill?: string;
  stroke?: string;
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
  diagramType?: 'flowchart' | 'swimlane';
  direction: MermaidDirection;
  nodes: MermaidNodeData[];
  edges: MermaidEdgeData[];
  subgraphs?: MermaidSubgraphData[];
  classDefs?: MermaidClassDefData[];
  comments?: string[];
}

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

export type GanttTaskStatus = 'normal' | 'active' | 'done';

export type GanttTaskStartMode = 'date' | 'after' | 'auto';

export type GanttTaskEndMode = 'duration' | 'date' | 'until';

export type GanttWeekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type GanttWeekend = 'saturday' | 'friday';

export interface GanttSectionData {
  id: string;
  title: string;
}

export interface GanttTaskData {
  id: string;
  label: string;
  sectionId?: string;
  status: GanttTaskStatus;
  crit?: boolean;
  milestone?: boolean;
  vert?: boolean;
  startMode: GanttTaskStartMode;
  startDate?: string;
  afterTaskIds?: string[];
  endMode: GanttTaskEndMode;
  duration?: string;
  endDate?: string;
  untilTaskIds?: string[];
  clickUrl?: string;
}

export interface GanttDiagramData {
  diagramType: 'gantt';
  title?: string;
  dateFormat: string;
  axisFormat?: string;
  tickInterval?: string;
  excludes?: string;
  includes?: string;
  todayMarker?: string;
  inclusiveEndDates?: boolean;
  topAxis?: boolean;
  compactMode?: boolean;
  weekday?: GanttWeekday;
  weekend?: GanttWeekend;
  sections: GanttSectionData[];
  tasks: GanttTaskData[];
  comments?: string[];
}

export type KanbanPriority =
  | 'Very High'
  | 'High'
  | 'Medium'
  | 'Low'
  | 'Very Low';

export interface KanbanColumnData {
  id: string;
  title: string;
}

export interface KanbanCardData {
  id: string;
  label: string;
  columnId: string;
  assigned?: string;
  ticket?: string;
  priority?: KanbanPriority;
}

export interface KanbanDiagramData {
  diagramType: 'kanban';
  columns: KanbanColumnData[];
  cards: KanbanCardData[];
  ticketBaseUrl?: string;
  sectionWidth?: number;
  comments?: string[];
}

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

export type ArchitectureDirection = 'L' | 'R' | 'T' | 'B';

export type ArchitectureNodeType = 'service' | 'junction';

export type ArchitectureAlignDirection = 'row' | 'column';

export interface ArchitectureGroupData {
  id: string;
  title: string;
  icon?: string;
  parentId?: string;
}

export interface ArchitectureNodeData {
  id: string;
  type: ArchitectureNodeType;
  title?: string;
  icon?: string;
  groupId?: string;
}

export interface ArchitectureEdgeData {
  id: string;
  lhsId: string;
  lhsDir: ArchitectureDirection;
  lhsInto?: boolean;
  lhsGroup?: boolean;
  rhsId: string;
  rhsDir: ArchitectureDirection;
  rhsInto?: boolean;
  rhsGroup?: boolean;
  title?: string;
}

export interface ArchitectureAlignHintData {
  id: string;
  direction: ArchitectureAlignDirection;
  members: string[];
}

export interface ArchitectureDiagramData {
  diagramType: 'architecture';
  title?: string;
  groups: ArchitectureGroupData[];
  nodes: ArchitectureNodeData[];
  edges: ArchitectureEdgeData[];
  alignments?: ArchitectureAlignHintData[];
  padding?: number;
  iconSize?: number;
  nodeSeparation?: number;
  comments?: string[];
}

export type MindmapNodeShape =
  | 'default'
  | 'rounded'
  | 'rect'
  | 'circle'
  | 'cloud'
  | 'bang'
  | 'hexagon';

export interface MindmapNodeData {
  id: string;
  depth: number;
  label: string;
  shape: MindmapNodeShape;
  icon?: string;
  cssClass?: string;
  useMarkdown?: boolean;
}

export interface MindmapConfigData {
  padding: number;
  maxNodeWidth: number;
}

export interface MindmapDiagramData {
  diagramType: 'mindmap';
  config: MindmapConfigData;
  nodes: MindmapNodeData[];
  comments?: string[];
}

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
