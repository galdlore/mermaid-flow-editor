import type { ReactNode } from 'react';
import type { Language, TranslationCatalog } from '../locales/types';
import type {
  ArchitectureDiagramData,
  BlockDiagramData,
  C4DiagramData,
  ClassDiagramData,
  CynefinDiagramData,
  ErDiagramData,
  EventModelingDiagramData,
  GanttDiagramData,
  GitGraphDiagramData,
  InfoDiagramData,
  IshikawaDiagramData,
  JourneyDiagramData,
  KanbanDiagramData,
  MermaidDiagramData,
  MermaidDiagramType,
  MindmapDiagramData,
  PacketDiagramData,
  PieDiagramData,
  QuadrantDiagramData,
  RadarDiagramData,
  RailroadDiagramData,
  RequirementDiagramData,
  SankeyDiagramData,
  SequenceDiagramData,
  StateDiagramData,
  TimelineDiagramData,
  TreemapDiagramData,
  TreeViewDiagramData,
  VennDiagramData,
  WardleyDiagramData,
  XYChartDiagramData,
} from '../types/editor';

export interface DiagramStateMap {
  flowchart: MermaidDiagramData;
  treeView: TreeViewDiagramData;
  gantt: GanttDiagramData;
  kanban: KanbanDiagramData;
  pie: PieDiagramData;
  xychart: XYChartDiagramData;
  architecture: ArchitectureDiagramData;
  mindmap: MindmapDiagramData;
  quadrantChart: QuadrantDiagramData;
  sequence: SequenceDiagramData;
  er: ErDiagramData;
  class: ClassDiagramData;
  state: StateDiagramData;
  c4: C4DiagramData;
  gitGraph: GitGraphDiagramData;
  timeline: TimelineDiagramData;
  block: BlockDiagramData;
  railroad: RailroadDiagramData;
  ishikawa: IshikawaDiagramData;
  journey: JourneyDiagramData;
  treemap: TreemapDiagramData;
  venn: VennDiagramData;
  wardley: WardleyDiagramData;
  cynefin: CynefinDiagramData;
  requirement: RequirementDiagramData;
  packet: PacketDiagramData;
  eventmodeling: EventModelingDiagramData;
  sankey: SankeyDiagramData;
  radar: RadarDiagramData;
  info: InfoDiagramData;
}

export type DiagramStoreKey = keyof DiagramStateMap;
export type DiagramStateCache = Partial<{ [K in DiagramStoreKey]: DiagramStateMap[K] }>;
export type EditableDiagramType = DiagramStoreKey | 'swimlane';
export type AnyDiagramData = DiagramStateMap[DiagramStoreKey];

export interface SelectionState {
  nodeId: string | null;
  edgeId: string | null;
}

export interface WorkspaceRenderArgs<T> {
  data: T;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onChange: (next: T) => void;
  onSelectNode: (id: string | null) => void;
  onSelectEdge: (id: string | null) => void;
}

export interface DiagramTransitionArgs {
  prevType: EditableDiagramType;
  currentData: AnyDiagramData | undefined;
  initialCode: string;
  lang: Language;
  t: TranslationCatalog;
}

export interface DiagramHandler<K extends DiagramStoreKey> {
  id: EditableDiagramType;
  storeKey: K;
  getSubtitle: (t: TranslationCatalog) => string;
  createDefault: (lang: Language) => DiagramStateMap[K];
  parse: (code: string) => DiagramStateMap[K];
  generate: (data: DiagramStateMap[K]) => string;
  isEmpty: (data: DiagramStateMap[K]) => boolean;
  getInitialSelection: (data: DiagramStateMap[K]) => SelectionState;
  transitionFromPrevious?: (args: DiagramTransitionArgs) => {
    data: DiagramStateMap[K];
    selection: SelectionState;
  };
  renderCanvas: (args: WorkspaceRenderArgs<DiagramStateMap[K]>) => ReactNode;
  renderInspector: (args: WorkspaceRenderArgs<DiagramStateMap[K]>) => ReactNode;
}

export interface ErasedDiagramHandler {
  id: EditableDiagramType;
  storeKey: DiagramStoreKey;
  getSubtitle: (t: TranslationCatalog) => string;
  createDefault: (lang: Language) => AnyDiagramData;
  parse: (code: string) => AnyDiagramData;
  generate: (data: AnyDiagramData) => string;
  isEmpty: (data: AnyDiagramData) => boolean;
  getInitialSelection: (data: AnyDiagramData) => SelectionState;
  transitionFromPrevious?: (args: DiagramTransitionArgs) => {
    data: AnyDiagramData;
    selection: SelectionState;
  };
  renderCanvas: (args: WorkspaceRenderArgs<AnyDiagramData>) => ReactNode;
  renderInspector: (args: WorkspaceRenderArgs<AnyDiagramData>) => ReactNode;
}

export function defineDiagramHandler<K extends DiagramStoreKey>(
  handler: DiagramHandler<K>
): ErasedDiagramHandler {
  return handler as unknown as ErasedDiagramHandler;
}

export interface DiagramRegistryEntry {
  id: MermaidDiagramType;
  storeKey?: DiagramStoreKey;
  available: boolean;
  getSubtitle: (t: TranslationCatalog) => string;
  loader: () => Promise<ErasedDiagramHandler>;
}
