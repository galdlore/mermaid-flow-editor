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
  | 'gantt'
  | 'c4';

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

export type SequenceParticipantKind = 'participant' | 'actor';

export interface SequenceBoxData {
  id: string;
  title: string;
  color?: string;
}

export interface SequenceParticipantData {
  id: string;
  alias?: string;
  kind: SequenceParticipantKind;
  boxId?: string;
}

export type SequenceArrowType =
  | '->>'
  | '-->>'
  | '->'
  | '-->'
  | '-x'
  | '--x'
  | '-)'
  | '--)'
  | '<<->>'
  | '<<-->>';

export type SequenceNotePlacement = 'right_of' | 'left_of' | 'over';

export type SequenceBlockType =
  | 'loop'
  | 'alt'
  | 'opt'
  | 'par'
  | 'critical'
  | 'break'
  | 'rect';

export interface SequenceMessageStepData {
  id: string;
  kind: 'message';
  from: string;
  to: string;
  arrowType: SequenceArrowType;
  text: string;
  activateTarget?: boolean;
  deactivateSource?: boolean;
}

export interface SequenceNoteStepData {
  id: string;
  kind: 'note';
  placement: SequenceNotePlacement;
  participantId: string;
  participantId2?: string;
  text: string;
}

export interface SequenceBlockBranchData {
  id: string;
  label?: string;
  steps: SequenceStepData[];
}

export interface SequenceBlockStepData {
  id: string;
  kind: 'block';
  blockType: SequenceBlockType;
  label: string;
  color?: string;
  branches: SequenceBlockBranchData[];
}

export type SequenceStepData =
  | SequenceMessageStepData
  | SequenceNoteStepData
  | SequenceBlockStepData;

export interface SequenceDiagramData {
  diagramType: 'sequence';
  title?: string;
  autonumber?: boolean;
  boxes?: SequenceBoxData[];
  participants: SequenceParticipantData[];
  steps: SequenceStepData[];
  comments?: string[];
}

export type ErDiagramDirection = 'TB' | 'BT' | 'LR' | 'RL';

export type ErAttributeKey = 'PK' | 'FK' | 'UK';

export type ErCardinality =
  | 'zero_or_one'
  | 'exactly_one'
  | 'zero_or_more'
  | 'one_or_more';

export interface ErAttributeData {
  id: string;
  type: string;
  name: string;
  keys?: ErAttributeKey[];
  comment?: string;
}

export interface ErEntityData {
  id: string;
  alias?: string;
  color?: string;
  attributes: ErAttributeData[];
}

export interface ErRelationshipData {
  id: string;
  from: string;
  to: string;
  fromCardinality: ErCardinality;
  toCardinality: ErCardinality;
  identifying: boolean;
  label: string;
}

export interface ErDiagramData {
  diagramType: 'er';
  title?: string;
  direction?: ErDiagramDirection;
  entities: ErEntityData[];
  relationships: ErRelationshipData[];
  comments?: string[];
}

export type ClassDiagramDirection = 'TB' | 'BT' | 'LR' | 'RL';

export type ClassMemberVisibility = '+' | '-' | '#' | '~' | '';

export type ClassMemberClassifier = 'none' | 'static' | 'abstract';

export type ClassMemberKind = 'field' | 'method';

export interface ClassMemberData {
  id: string;
  kind: ClassMemberKind;
  visibility: ClassMemberVisibility;
  name: string;
  type?: string;
  params?: string;
  classifier?: ClassMemberClassifier;
}

export interface ClassNodeData {
  id: string;
  label?: string;
  generic?: string;
  stereotype?: string;
  namespace?: string;
  color?: string;
  members: ClassMemberData[];
}

export type ClassRelationType =
  | '--|>'
  | '..|>'
  | '*--'
  | 'o--'
  | '-->'
  | '..>'
  | '--'
  | '..';

export interface ClassRelationData {
  id: string;
  from: string;
  to: string;
  relationType: ClassRelationType;
  fromCardinality?: string;
  toCardinality?: string;
  label?: string;
}

export interface ClassNoteData {
  id: string;
  targetClassId?: string;
  text: string;
}

export interface ClassDiagramData {
  diagramType: 'class';
  title?: string;
  direction?: ClassDiagramDirection;
  classes: ClassNodeData[];
  relations: ClassRelationData[];
  notes?: ClassNoteData[];
  comments?: string[];
}

export type StateDiagramDirection = 'TB' | 'BT' | 'LR' | 'RL';

export type StateKind = 'normal' | 'composite' | 'choice' | 'fork' | 'join';

export interface StateNodeData {
  id: string;
  label?: string;
  description?: string;
  kind: StateKind;
  parentId?: string;
  subDirection?: StateDiagramDirection;
  color?: string;
}

export interface StateTransitionData {
  id: string;
  from: string;
  to: string;
  label?: string;
  scopeId?: string;
}

export type StateNotePosition = 'left of' | 'right of';

export interface StateNoteData {
  id: string;
  targetStateId: string;
  position: StateNotePosition;
  text: string;
}

export interface StateDiagramData {
  diagramType: 'state';
  title?: string;
  direction?: StateDiagramDirection;
  states: StateNodeData[];
  transitions: StateTransitionData[];
  notes?: StateNoteData[];
  comments?: string[];
}

export type C4DiagramSubtype =
  | 'C4Context'
  | 'C4Container'
  | 'C4Component'
  | 'C4Dynamic'
  | 'C4Deployment';

export type C4ElementKind = 'person' | 'system' | 'container' | 'component';

export type C4ElementVariant = 'standard' | 'db' | 'queue';

export type C4BoundaryKind =
  | 'enterprise'
  | 'system'
  | 'container'
  | 'boundary'
  | 'node';

export type C4RelationType =
  | 'Rel'
  | 'BiRel'
  | 'Rel_Up'
  | 'Rel_Down'
  | 'Rel_Left'
  | 'Rel_Right'
  | 'Rel_Back'
  | 'RelIndex';

export interface C4ElementData {
  id: string;
  kind: C4ElementKind;
  variant?: C4ElementVariant;
  external?: boolean;
  label: string;
  techn?: string;
  descr?: string;
  boundaryId?: string;
  bgColor?: string;
  fontColor?: string;
  borderColor?: string;
}

export interface C4BoundaryData {
  id: string;
  kind: C4BoundaryKind;
  label: string;
  boundaryType?: string;
  descr?: string;
  parentBoundaryId?: string;
}

export interface C4RelationData {
  id: string;
  relType: C4RelationType;
  index?: string;
  from: string;
  to: string;
  label: string;
  techn?: string;
  descr?: string;
  lineColor?: string;
  textColor?: string;
}

export interface C4DiagramData {
  diagramType: 'c4';
  subtype: C4DiagramSubtype;
  title?: string;
  shapeInRow?: number;
  boundaryInRow?: number;
  elements: C4ElementData[];
  boundaries: C4BoundaryData[];
  relations: C4RelationData[];
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
  saveHtmlFile?: (content: string, suggestedName?: string) => Promise<FileSaveResult>;
  savePdfFile?: (suggestedName?: string) => Promise<FileSaveResult>;
  resetFileSession?: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
