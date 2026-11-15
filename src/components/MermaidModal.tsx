import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import { useI18n, type Language, type TranslationCatalog } from '../i18n';
import type {
  ArchitectureDiagramData,
  ClassDiagramData,
  ErDiagramData,
  GanttDiagramData,
  KanbanDiagramData,
  MermaidDiagramData,
  MermaidDiagramType,
  MindmapDiagramData,
  PieDiagramData,
  QuadrantDiagramData,
  SequenceDiagramData,
  StateDiagramData,
  TreeViewDiagramData,
  XYChartDiagramData,
} from '../types/editor';
import {
  createDefaultDiagramData,
  createDefaultSwimlaneData,
  detectMermaidDiagramType,
  generateMermaidCode,
  parseMermaidCodeToGuiData,
} from '../utils/mermaidConverter';
import {
  createDefaultTreeViewData,
  generateTreeViewCode,
  parseTreeViewCodeToGuiData,
} from '../utils/treeViewConverter';
import {
  createDefaultGanttData,
  generateGanttCode,
  parseGanttCodeToGuiData,
} from '../utils/ganttConverter';
import {
  createDefaultKanbanData,
  generateKanbanCode,
  parseKanbanCodeToGuiData,
} from '../utils/kanbanConverter';
import {
  createDefaultPieData,
  generatePieCode,
  parsePieCodeToGuiData,
} from '../utils/pieConverter';
import {
  createDefaultXYChartData,
  generateXYChartCode,
  parseXYChartCodeToGuiData,
} from '../utils/xychartConverter';
import {
  createDefaultArchitectureData,
  generateArchitectureCode,
  parseArchitectureCodeToGuiData,
} from '../utils/architectureConverter';
import {
  createDefaultMindmapData,
  generateMindmapCode,
  parseMindmapCodeToGuiData,
} from '../utils/mindmapConverter';
import {
  createDefaultQuadrantData,
  generateQuadrantCode,
  parseQuadrantCodeToGuiData,
} from '../utils/quadrantConverter';
import {
  createDefaultSequenceData,
  generateSequenceCode,
  parseSequenceCodeToGuiData,
} from '../utils/sequenceConverter';
import {
  createDefaultErData,
  generateErCode,
  parseErCodeToGuiData,
} from '../utils/erConverter';
import {
  createDefaultClassData,
  generateClassCode,
  parseClassCodeToGuiData,
} from '../utils/classConverter';
import {
  createDefaultStateData,
  generateStateCode,
  parseStateCodeToGuiData,
} from '../utils/stateConverter';
import { renderMermaidSvg } from '../utils/mermaidRender';
import MermaidCanvas from './MermaidCanvas';
import MermaidInspector from './MermaidInspector';
import TreeViewCanvas from './TreeViewCanvas';
import TreeViewInspector from './TreeViewInspector';
import GanttCanvas from './GanttCanvas';
import GanttInspector from './GanttInspector';
import KanbanCanvas from './KanbanCanvas';
import KanbanInspector from './KanbanInspector';
import PieCanvas from './PieCanvas';
import PieInspector from './PieInspector';
import XYChartCanvas from './XYChartCanvas';
import XYChartInspector from './XYChartInspector';
import ArchitectureCanvas from './ArchitectureCanvas';
import ArchitectureInspector from './ArchitectureInspector';
import MindmapCanvas from './MindmapCanvas';
import MindmapInspector from './MindmapInspector';
import QuadrantCanvas from './QuadrantCanvas';
import QuadrantInspector from './QuadrantInspector';
import SequenceCanvas from './SequenceCanvas';
import SequenceInspector from './SequenceInspector';
import ErCanvas from './ErCanvas';
import ErInspector from './ErInspector';
import ClassCanvas from './ClassCanvas';
import ClassInspector from './ClassInspector';
import StateCanvas from './StateCanvas';
import StateInspector from './StateInspector';

interface DiagramStateMap {
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
}

type DiagramStoreKey = keyof DiagramStateMap;
type DiagramStateCache = Partial<{ [K in DiagramStoreKey]: DiagramStateMap[K] }>;
type EditableDiagramType = DiagramStoreKey | 'swimlane';

interface SelectionState {
  nodeId: string | null;
  edgeId: string | null;
}

interface WorkspaceRenderArgs<T> {
  data: T;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onChange: (next: T) => void;
  onSelectNode: (id: string | null) => void;
  onSelectEdge: (id: string | null) => void;
}

interface DiagramHandler<K extends DiagramStoreKey> {
  storeKey: K;
  getSubtitle: (t: TranslationCatalog) => string;
  createDefault: (lang: Language) => DiagramStateMap[K];
  parse: (code: string) => DiagramStateMap[K];
  generate: (data: DiagramStateMap[K]) => string;
  isEmpty: (data: DiagramStateMap[K]) => boolean;
  getInitialSelection: (data: DiagramStateMap[K]) => SelectionState;
  renderCanvas: (args: WorkspaceRenderArgs<DiagramStateMap[K]>) => ReactNode;
  renderInspector: (args: WorkspaceRenderArgs<DiagramStateMap[K]>) => ReactNode;
}

type AnyDiagramData = DiagramStateMap[DiagramStoreKey];

interface ErasedDiagramHandler {
  storeKey: DiagramStoreKey;
  getSubtitle: (t: TranslationCatalog) => string;
  createDefault: (lang: Language) => AnyDiagramData;
  parse: (code: string) => AnyDiagramData;
  generate: (data: AnyDiagramData) => string;
  isEmpty: (data: AnyDiagramData) => boolean;
  getInitialSelection: (data: AnyDiagramData) => SelectionState;
  renderCanvas: (args: WorkspaceRenderArgs<AnyDiagramData>) => ReactNode;
  renderInspector: (args: WorkspaceRenderArgs<AnyDiagramData>) => ReactNode;
}

function defineDiagramHandler<K extends DiagramStoreKey>(
  handler: DiagramHandler<K>
): ErasedDiagramHandler {
  return handler as unknown as ErasedDiagramHandler;
}

const DIAGRAM_HANDLERS: Record<EditableDiagramType, ErasedDiagramHandler> = {
  flowchart: defineDiagramHandler<'flowchart'>({
    storeKey: 'flowchart',
    getSubtitle: (t) => t.modal.subtitle,
    createDefault: createDefaultDiagramData,
    parse: parseMermaidCodeToGuiData,
    generate: generateMermaidCode,
    isEmpty: (data) => data.nodes.length === 0,
    getInitialSelection: (data) => ({ nodeId: data.nodes[0]?.id ?? null, edgeId: null }),
    renderCanvas: ({
      data,
      selectedNodeId,
      selectedEdgeId,
      onChange,
      onSelectNode,
      onSelectEdge,
    }) => (
      <MermaidCanvas
        diagramData={data}
        selectedNodeId={selectedNodeId}
        selectedEdgeId={selectedEdgeId}
        onChange={onChange}
        onSelectNode={onSelectNode}
        onSelectEdge={onSelectEdge}
      />
    ),
    renderInspector: ({
      data,
      selectedNodeId,
      selectedEdgeId,
      onChange,
      onSelectNode,
      onSelectEdge,
    }) => (
      <MermaidInspector
        diagramData={data}
        selectedNodeId={selectedNodeId}
        selectedEdgeId={selectedEdgeId}
        onChange={onChange}
        onSelectNode={onSelectNode}
        onSelectEdge={onSelectEdge}
      />
    ),
  }),
  swimlane: defineDiagramHandler<'flowchart'>({
    storeKey: 'flowchart',
    getSubtitle: (t) => t.modal.subtitleSwimlane,
    createDefault: createDefaultSwimlaneData,
    parse: (code) => ({ ...parseMermaidCodeToGuiData(code), diagramType: 'swimlane' as const }),
    generate: generateMermaidCode,
    isEmpty: (data) => data.nodes.length === 0,
    getInitialSelection: (data) => ({ nodeId: data.nodes[0]?.id ?? null, edgeId: null }),
    renderCanvas: ({
      data,
      selectedNodeId,
      selectedEdgeId,
      onChange,
      onSelectNode,
      onSelectEdge,
    }) => (
      <MermaidCanvas
        diagramData={data}
        selectedNodeId={selectedNodeId}
        selectedEdgeId={selectedEdgeId}
        onChange={onChange}
        onSelectNode={onSelectNode}
        onSelectEdge={onSelectEdge}
      />
    ),
    renderInspector: ({
      data,
      selectedNodeId,
      selectedEdgeId,
      onChange,
      onSelectNode,
      onSelectEdge,
    }) => (
      <MermaidInspector
        diagramData={data}
        selectedNodeId={selectedNodeId}
        selectedEdgeId={selectedEdgeId}
        onChange={onChange}
        onSelectNode={onSelectNode}
        onSelectEdge={onSelectEdge}
      />
    ),
  }),
  treeView: defineDiagramHandler<'treeView'>({
    storeKey: 'treeView',
    getSubtitle: (t) => t.modal.subtitleTreeView,
    createDefault: createDefaultTreeViewData,
    parse: parseTreeViewCodeToGuiData,
    generate: generateTreeViewCode,
    isEmpty: (data) => data.nodes.length === 0,
    getInitialSelection: (data) => ({ nodeId: data.nodes[0]?.id ?? null, edgeId: null }),
    renderCanvas: ({ data, selectedNodeId, onChange, onSelectNode }) => (
      <TreeViewCanvas
        treeData={data}
        selectedNodeId={selectedNodeId}
        onChange={onChange}
        onSelectNode={onSelectNode}
      />
    ),
    renderInspector: ({ data, selectedNodeId, onChange, onSelectNode }) => (
      <TreeViewInspector
        treeData={data}
        selectedNodeId={selectedNodeId}
        onChange={onChange}
        onSelectNode={onSelectNode}
      />
    ),
  }),
  gantt: defineDiagramHandler<'gantt'>({
    storeKey: 'gantt',
    getSubtitle: (t) => t.modal.subtitleGantt,
    createDefault: createDefaultGanttData,
    parse: parseGanttCodeToGuiData,
    generate: generateGanttCode,
    isEmpty: (data) => data.tasks.length === 0,
    getInitialSelection: (data) => ({ nodeId: data.tasks[0]?.id ?? null, edgeId: null }),
    renderCanvas: ({ data, selectedNodeId, onChange, onSelectNode }) => (
      <GanttCanvas
        ganttData={data}
        selectedTaskId={selectedNodeId}
        onChange={onChange}
        onSelectTask={onSelectNode}
      />
    ),
    renderInspector: ({ data, selectedNodeId, onChange, onSelectNode }) => (
      <GanttInspector
        ganttData={data}
        selectedTaskId={selectedNodeId}
        onChange={onChange}
        onSelectTask={onSelectNode}
      />
    ),
  }),
  kanban: defineDiagramHandler<'kanban'>({
    storeKey: 'kanban',
    getSubtitle: (t) => t.modal.subtitleKanban,
    createDefault: createDefaultKanbanData,
    parse: parseKanbanCodeToGuiData,
    generate: generateKanbanCode,
    isEmpty: (data) => data.columns.length === 0,
    getInitialSelection: (data) => ({ nodeId: data.cards[0]?.id ?? null, edgeId: null }),
    renderCanvas: ({ data, selectedNodeId, onChange, onSelectNode }) => (
      <KanbanCanvas
        kanbanData={data}
        selectedCardId={selectedNodeId}
        onChange={onChange}
        onSelectCard={onSelectNode}
      />
    ),
    renderInspector: ({ data, selectedNodeId, onChange, onSelectNode }) => (
      <KanbanInspector
        kanbanData={data}
        selectedCardId={selectedNodeId}
        onChange={onChange}
        onSelectCard={onSelectNode}
      />
    ),
  }),
  pie: defineDiagramHandler<'pie'>({
    storeKey: 'pie',
    getSubtitle: (t) => t.modal.subtitlePie,
    createDefault: createDefaultPieData,
    parse: parsePieCodeToGuiData,
    generate: generatePieCode,
    isEmpty: (data) => data.slices.length === 0,
    getInitialSelection: (data) => ({ nodeId: data.slices[0]?.id ?? null, edgeId: null }),
    renderCanvas: ({ data, selectedNodeId, onChange, onSelectNode }) => (
      <PieCanvas
        pieData={data}
        selectedSliceId={selectedNodeId}
        onChange={onChange}
        onSelectSlice={onSelectNode}
      />
    ),
    renderInspector: ({ data, selectedNodeId, onChange, onSelectNode }) => (
      <PieInspector
        pieData={data}
        selectedSliceId={selectedNodeId}
        onChange={onChange}
        onSelectSlice={onSelectNode}
      />
    ),
  }),
  xychart: defineDiagramHandler<'xychart'>({
    storeKey: 'xychart',
    getSubtitle: (t) => t.modal.subtitleXYChart,
    createDefault: createDefaultXYChartData,
    parse: parseXYChartCodeToGuiData,
    generate: generateXYChartCode,
    isEmpty: (data) => data.series.length === 0,
    getInitialSelection: (data) => ({ nodeId: data.series[0]?.id ?? null, edgeId: null }),
    renderCanvas: ({ data, selectedNodeId, onChange, onSelectNode }) => (
      <XYChartCanvas
        xychartData={data}
        selectedSeriesId={selectedNodeId}
        onChange={onChange}
        onSelectSeries={onSelectNode}
      />
    ),
    renderInspector: ({ data, selectedNodeId, onChange, onSelectNode }) => (
      <XYChartInspector
        xychartData={data}
        selectedSeriesId={selectedNodeId}
        onChange={onChange}
        onSelectSeries={onSelectNode}
      />
    ),
  }),
  architecture: defineDiagramHandler<'architecture'>({
    storeKey: 'architecture',
    getSubtitle: (t) => t.modal.subtitleArchitecture,
    createDefault: createDefaultArchitectureData,
    parse: parseArchitectureCodeToGuiData,
    generate: generateArchitectureCode,
    isEmpty: (data) => data.nodes.length === 0,
    getInitialSelection: (data) => ({
      nodeId: data.nodes[0]?.id ?? null,
      edgeId: data.edges[0]?.id ?? null,
    }),
    renderCanvas: ({
      data,
      selectedNodeId,
      selectedEdgeId,
      onChange,
      onSelectNode,
      onSelectEdge,
    }) => (
      <ArchitectureCanvas
        architectureData={data}
        selectedNodeId={selectedNodeId}
        selectedEdgeId={selectedEdgeId}
        onChange={onChange}
        onSelectNode={onSelectNode}
        onSelectEdge={onSelectEdge}
      />
    ),
    renderInspector: ({
      data,
      selectedNodeId,
      selectedEdgeId,
      onChange,
      onSelectNode,
      onSelectEdge,
    }) => (
      <ArchitectureInspector
        architectureData={data}
        selectedNodeId={selectedNodeId}
        selectedEdgeId={selectedEdgeId}
        onChange={onChange}
        onSelectNode={onSelectNode}
        onSelectEdge={onSelectEdge}
      />
    ),
  }),
  mindmap: defineDiagramHandler<'mindmap'>({
    storeKey: 'mindmap',
    getSubtitle: (t) => t.modal.subtitleMindmap,
    createDefault: createDefaultMindmapData,
    parse: parseMindmapCodeToGuiData,
    generate: generateMindmapCode,
    isEmpty: (data) => data.nodes.length === 0,
    getInitialSelection: (data) => ({ nodeId: data.nodes[0]?.id ?? null, edgeId: null }),
    renderCanvas: ({ data, selectedNodeId, onChange, onSelectNode }) => (
      <MindmapCanvas
        mindmapData={data}
        selectedNodeId={selectedNodeId}
        onChange={onChange}
        onSelectNode={onSelectNode}
      />
    ),
    renderInspector: ({ data, selectedNodeId, onChange, onSelectNode }) => (
      <MindmapInspector
        mindmapData={data}
        selectedNodeId={selectedNodeId}
        onChange={onChange}
        onSelectNode={onSelectNode}
      />
    ),
  }),
  quadrantChart: defineDiagramHandler<'quadrantChart'>({
    storeKey: 'quadrantChart',
    getSubtitle: (t) => t.modal.subtitleQuadrantChart,
    createDefault: createDefaultQuadrantData,
    parse: parseQuadrantCodeToGuiData,
    generate: generateQuadrantCode,
    isEmpty: () => false,
    getInitialSelection: (data) => ({ nodeId: data.points[0]?.id ?? null, edgeId: null }),
    renderCanvas: ({ data, selectedNodeId, onChange, onSelectNode }) => (
      <QuadrantCanvas
        data={data}
        selectedPointId={selectedNodeId}
        onChange={onChange}
        onSelectPoint={onSelectNode}
      />
    ),
    renderInspector: ({ data, selectedNodeId, onChange, onSelectNode }) => (
      <QuadrantInspector
        data={data}
        selectedPointId={selectedNodeId}
        onChange={onChange}
        onSelectPoint={onSelectNode}
      />
    ),
  }),
  sequence: defineDiagramHandler<'sequence'>({
    storeKey: 'sequence',
    getSubtitle: (t) => t.modal.subtitleSequence,
    createDefault: createDefaultSequenceData,
    parse: parseSequenceCodeToGuiData,
    generate: generateSequenceCode,
    isEmpty: (data) => data.participants.length === 0 && data.steps.length === 0,
    getInitialSelection: (data) => ({
      nodeId: data.steps[0]?.id ?? null,
      edgeId: data.participants[0]?.id ?? null,
    }),
    renderCanvas: ({
      data,
      selectedNodeId,
      selectedEdgeId,
      onChange,
      onSelectNode,
      onSelectEdge,
    }) => (
      <SequenceCanvas
        sequenceData={data}
        selectedStepId={selectedNodeId}
        selectedParticipantId={selectedEdgeId}
        onChange={onChange}
        onSelectStep={onSelectNode}
        onSelectParticipant={onSelectEdge}
      />
    ),
    renderInspector: ({
      data,
      selectedNodeId,
      selectedEdgeId,
      onChange,
      onSelectNode,
      onSelectEdge,
    }) => (
      <SequenceInspector
        sequenceData={data}
        selectedStepId={selectedNodeId}
        selectedParticipantId={selectedEdgeId}
        onChange={onChange}
        onSelectStep={onSelectNode}
        onSelectParticipant={onSelectEdge}
      />
    ),
  }),
  er: defineDiagramHandler<'er'>({
    storeKey: 'er',
    getSubtitle: (t) => t.modal.subtitleEr,
    createDefault: createDefaultErData,
    parse: parseErCodeToGuiData,
    generate: generateErCode,
    isEmpty: (data) => data.entities.length === 0 && data.relationships.length === 0,
    getInitialSelection: (data) => ({
      nodeId: data.entities[0]?.id ?? null,
      edgeId: data.relationships[0]?.id ?? null,
    }),
    renderCanvas: ({
      data,
      selectedNodeId,
      selectedEdgeId,
      onChange,
      onSelectNode,
      onSelectEdge,
    }) => (
      <ErCanvas
        erData={data}
        selectedEntityId={selectedNodeId}
        selectedRelationshipId={selectedEdgeId}
        onChange={onChange}
        onSelectEntity={onSelectNode}
        onSelectRelationship={onSelectEdge}
      />
    ),
    renderInspector: ({
      data,
      selectedNodeId,
      selectedEdgeId,
      onChange,
      onSelectNode,
      onSelectEdge,
    }) => (
      <ErInspector
        erData={data}
        selectedEntityId={selectedNodeId}
        selectedRelationshipId={selectedEdgeId}
        onChange={onChange}
        onSelectEntity={onSelectNode}
        onSelectRelationship={onSelectEdge}
      />
    ),
  }),
  class: defineDiagramHandler<'class'>({
    storeKey: 'class',
    getSubtitle: (t) => t.modal.subtitleClass,
    createDefault: createDefaultClassData,
    parse: parseClassCodeToGuiData,
    generate: generateClassCode,
    isEmpty: (data) => data.classes.length === 0 && data.relations.length === 0,
    getInitialSelection: (data) => ({
      nodeId: data.classes[0]?.id ?? null,
      edgeId: data.relations[0]?.id ?? null,
    }),
    renderCanvas: ({
      data,
      selectedNodeId,
      selectedEdgeId,
      onChange,
      onSelectNode,
      onSelectEdge,
    }) => (
      <ClassCanvas
        classData={data}
        selectedClassId={selectedNodeId}
        selectedRelationId={selectedEdgeId}
        onChange={onChange}
        onSelectClass={onSelectNode}
        onSelectRelation={onSelectEdge}
      />
    ),
    renderInspector: ({
      data,
      selectedNodeId,
      selectedEdgeId,
      onChange,
      onSelectNode,
      onSelectEdge,
    }) => (
      <ClassInspector
        classData={data}
        selectedClassId={selectedNodeId}
        selectedRelationId={selectedEdgeId}
        onChange={onChange}
        onSelectClass={onSelectNode}
        onSelectRelation={onSelectEdge}
      />
    ),
  }),
  state: defineDiagramHandler<'state'>({
    storeKey: 'state',
    getSubtitle: (t) => t.modal.subtitleState,
    createDefault: createDefaultStateData,
    parse: parseStateCodeToGuiData,
    generate: generateStateCode,
    isEmpty: (data) => data.states.length === 0 && data.transitions.length === 0,
    getInitialSelection: (data) => ({
      nodeId: data.states[0]?.id ?? null,
      edgeId: data.transitions[0]?.id ?? null,
    }),
    renderCanvas: ({
      data,
      selectedNodeId,
      selectedEdgeId,
      onChange,
      onSelectNode,
      onSelectEdge,
    }) => (
      <StateCanvas
        stateData={data}
        selectedStateId={selectedNodeId}
        selectedTransitionId={selectedEdgeId}
        onChange={onChange}
        onSelectState={onSelectNode}
        onSelectTransition={onSelectEdge}
      />
    ),
    renderInspector: ({
      data,
      selectedNodeId,
      selectedEdgeId,
      onChange,
      onSelectNode,
      onSelectEdge,
    }) => (
      <StateInspector
        stateData={data}
        selectedStateId={selectedNodeId}
        selectedTransitionId={selectedEdgeId}
        onChange={onChange}
        onSelectState={onSelectNode}
        onSelectTransition={onSelectEdge}
      />
    ),
  }),
};

function isEditableDiagramType(type: MermaidDiagramType): type is EditableDiagramType {
  return Object.prototype.hasOwnProperty.call(DIAGRAM_HANDLERS, type);
}

const DIAGRAM_TYPE_OPTIONS: ReadonlyArray<{
  id: MermaidDiagramType;
  available: boolean;
}> = [
  { id: 'flowchart', available: true },
  { id: 'swimlane', available: true },
  { id: 'treeView', available: true },
  { id: 'gantt', available: true },
  { id: 'kanban', available: true },
  { id: 'pie', available: true },
  { id: 'xychart', available: true },
  { id: 'architecture', available: true },
  { id: 'mindmap', available: true },
  { id: 'quadrantChart', available: true },
  { id: 'sequence', available: true },
  { id: 'class', available: true },
  { id: 'state', available: true },
  { id: 'er', available: true },
];

export interface MermaidModalProps {
  isOpen: boolean;
  initialCode: string;
  onApply: (mermaidCode: string) => void;
  onClose: () => void;
}

export default function MermaidModal({
  isOpen,
  initialCode,
  onApply,
  onClose,
}: MermaidModalProps) {
  const { lang, t } = useI18n();
  const reactId = useId();
  const [diagramType, setDiagramType] = useState<EditableDiagramType>('flowchart');
  const [diagramCache, setDiagramCache] = useState<DiagramStateCache>(() => ({
    flowchart: createDefaultDiagramData(lang),
  }));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<'preview' | 'code'>('preview');
  const [mobileView, setMobileView] = useState<'canvas' | 'inspector' | 'preview' | 'code'>('canvas');
  const [previewSvg, setPreviewSvg] = useState<string>('');
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const detectedType = initialCode.trim()
      ? detectMermaidDiagramType(initialCode)
      : 'flowchart';
    const nextType: EditableDiagramType = isEditableDiagramType(detectedType)
      ? detectedType
      : 'flowchart';
    const handler = DIAGRAM_HANDLERS[nextType];
    const initialized = initialCode.trim()
      ? handler.parse(initialCode)
      : handler.createDefault(lang);
    const selection = handler.getInitialSelection(initialized);

    setDiagramType(nextType);
    setDiagramCache({ [handler.storeKey]: initialized });
    setSelectedNodeId(selection.nodeId);
    setSelectedEdgeId(selection.edgeId);
    setBottomTab('preview');
    setMobileView('canvas');
  }, [isOpen, initialCode, lang]);

  const handleDiagramTypeChange = (rawNextType: MermaidDiagramType): void => {
    if (!isEditableDiagramType(rawNextType) || rawNextType === diagramType) {
      return;
    }

    const nextType = rawNextType;
    const prevType = diagramType;
    setDiagramType(nextType);

    if (nextType !== 'flowchart' && nextType !== 'swimlane') {
      const nextHandler = DIAGRAM_HANDLERS[nextType];
      const existingData = diagramCache[nextHandler.storeKey];
      const nextData = existingData ?? nextHandler.createDefault(lang);
      if (!existingData) {
        setDiagramCache((prev) => ({ ...prev, [nextHandler.storeKey]: nextData }));
      }
      const selection = nextHandler.getInitialSelection(nextData);
      setSelectedNodeId(selection.nodeId);
      setSelectedEdgeId(selection.edgeId);
      return;
    }

    const currentFlowData = diagramCache.flowchart;

    if (prevType !== 'flowchart' && prevType !== 'swimlane') {
      const baseData = currentFlowData ?? createDefaultDiagramData(lang);
      const nextFlowData =
        nextType === 'swimlane'
          ? (baseData.subgraphs?.length ?? 0) > 0
            ? { ...baseData, diagramType: 'swimlane' as const }
            : createDefaultSwimlaneData(lang)
          : { ...baseData, diagramType: 'flowchart' as const };

      setDiagramCache((prev) => ({ ...prev, flowchart: nextFlowData }));
      setSelectedNodeId(nextFlowData.nodes[0]?.id ?? null);
      setSelectedEdgeId(null);
      return;
    }

    const activeFlowData =
      currentFlowData ??
      (prevType === 'swimlane'
        ? createDefaultSwimlaneData(lang)
        : createDefaultDiagramData(lang));

    if (nextType === 'swimlane') {
      const isUntouchedFlowchart =
        !initialCode.trim() &&
        activeFlowData.nodes.length === 2 &&
        activeFlowData.nodes[0]?.id === 'node_1' &&
        activeFlowData.nodes[1]?.id === 'node_2' &&
        (!activeFlowData.subgraphs || activeFlowData.subgraphs.length === 0);

      if (isUntouchedFlowchart) {
        const nextSwimlane = createDefaultSwimlaneData(lang);
        setDiagramCache((prev) => ({ ...prev, flowchart: nextSwimlane }));
        setSelectedNodeId(nextSwimlane.nodes[0]?.id ?? null);
        setSelectedEdgeId(null);
        return;
      }

      const existingSubgraphs = activeFlowData.subgraphs ?? [];
      if (existingSubgraphs.length === 0) {
        const fallbackLaneId = 'lane_1';
        setDiagramCache((prev) => ({
          ...prev,
          flowchart: {
            ...activeFlowData,
            diagramType: 'swimlane',
            subgraphs: [
              {
                id: fallbackLaneId,
                title: t.inspector.swimlane.defaultLaneTitle(1),
                fill: '#eff6ff',
                stroke: '#2563eb',
              },
            ],
            nodes: activeFlowData.nodes.map((node) => ({
              ...node,
              subgraphId: node.subgraphId || fallbackLaneId,
            })),
          },
        }));
      } else {
        setDiagramCache((prev) => ({
          ...prev,
          flowchart: {
            ...activeFlowData,
            diagramType: 'swimlane',
          },
        }));
      }
      return;
    }

    const isUntouchedSwimlane =
      !initialCode.trim() &&
      activeFlowData.nodes.length === 3 &&
      activeFlowData.nodes[2]?.id === 'node_3' &&
      activeFlowData.subgraphs?.length === 2 &&
      activeFlowData.subgraphs[0]?.id === 'lane_1';

    if (isUntouchedSwimlane) {
      const nextFlowchart = createDefaultDiagramData(lang);
      setDiagramCache((prev) => ({ ...prev, flowchart: nextFlowchart }));
      setSelectedNodeId(nextFlowchart.nodes[0]?.id ?? null);
      setSelectedEdgeId(null);
      return;
    }

    setDiagramCache((prev) => ({
      ...prev,
      flowchart: {
        ...activeFlowData,
        diagramType: 'flowchart',
      },
    }));
  };

  const activeHandler = DIAGRAM_HANDLERS[diagramType];
  const activeStoreKey = activeHandler.storeKey;

  const activeData = useMemo(
    () => diagramCache[activeStoreKey] ?? activeHandler.createDefault(lang),
    [diagramCache, activeStoreKey, activeHandler, lang]
  );

  const handleActiveDataChange = useCallback(
    (nextData: AnyDiagramData) => {
      setDiagramCache((prev) => ({ ...prev, [activeStoreKey]: nextData }));
    },
    [activeStoreKey]
  );

  const generatedCode = useMemo(
    () => activeHandler.generate(activeData),
    [activeHandler, activeData]
  );

  const isDiagramEmpty = useMemo(
    () => activeHandler.isEmpty(activeData),
    [activeHandler, activeData]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;
    const renderId = `modal_mermaid_${reactId.replace(/[^a-zA-Z0-9_]/g, '_')}_${Date.now()}`;

    const renderPreview = async (): Promise<void> => {
      if (isDiagramEmpty) {
        if (!cancelled) {
          setPreviewSvg('');
          setPreviewError(null);
        }
        return;
      }

      const result = await renderMermaidSvg(renderId, generatedCode);
      if (!cancelled) {
        setPreviewSvg(result.svg);
        setPreviewError(result.error);
      }
    };

    void renderPreview();

    return () => {
      cancelled = true;
    };
  }, [isOpen, generatedCode, isDiagramEmpty, reactId]);

  if (!isOpen) {
    return null;
  }

  const workspaceArgs: WorkspaceRenderArgs<AnyDiagramData> = {
    data: activeData,
    selectedNodeId,
    selectedEdgeId,
    onChange: handleActiveDataChange,
    onSelectNode: setSelectedNodeId,
    onSelectEdge: setSelectedEdgeId,
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t.modal.ariaLabel}>
      <div className="mermaid-modal" data-mobile-view={mobileView}>
        <header className="modal-header">
          <div className="modal-title-group">
            <h2>{t.modal.title}</h2>
            <span className="modal-subtitle">{activeHandler.getSubtitle(t)}</span>
          </div>
          <div className="modal-header-actions">
            <label className="modal-diagram-type-select-group">
              <span className="modal-diagram-type-label">{t.modal.diagramTypeLabel}</span>
              <select
                className="modal-diagram-type-select"
                aria-label={t.modal.diagramTypeLabel}
                value={diagramType}
                onChange={(event) =>
                  handleDiagramTypeChange(event.target.value as MermaidDiagramType)
                }
              >
                {DIAGRAM_TYPE_OPTIONS.map((option) => (
                  <option
                    key={option.id}
                    value={option.id}
                    disabled={!option.available}
                  >
                    {t.modal.diagramTypes[option.id]}
                    {!option.available ? ` (${t.modal.diagramTypeComingSoon})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn-secondary" onClick={onClose}>
              <X size={15} />
              <span>{t.modal.cancel}</span>
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => onApply(generatedCode)}
            >
              <Check size={15} />
              <span>{t.modal.apply}</span>
            </button>
          </div>
        </header>

        <div className="modal-mobile-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mobileView === 'canvas'}
            className={`modal-mobile-tab-btn ${mobileView === 'canvas' ? 'is-active' : ''}`}
            onClick={() => setMobileView('canvas')}
          >
            {t.modal.mobileTabCanvas}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileView === 'inspector'}
            className={`modal-mobile-tab-btn ${mobileView === 'inspector' ? 'is-active' : ''}`}
            onClick={() => setMobileView('inspector')}
          >
            {t.modal.mobileTabInspector}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileView === 'preview'}
            className={`modal-mobile-tab-btn ${mobileView === 'preview' ? 'is-active' : ''}`}
            onClick={() => {
              setMobileView('preview');
              setBottomTab('preview');
            }}
          >
            {t.modal.mobileTabPreview}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobileView === 'code'}
            className={`modal-mobile-tab-btn ${mobileView === 'code' ? 'is-active' : ''}`}
            onClick={() => {
              setMobileView('code');
              setBottomTab('code');
            }}
          >
            {t.modal.mobileTabCode}
          </button>
        </div>

        <div className="modal-workspace">
          <div className="modal-canvas-pane">
            {activeHandler.renderCanvas(workspaceArgs)}
          </div>
          <div className="modal-inspector-pane">
            {activeHandler.renderInspector(workspaceArgs)}
          </div>
        </div>

        <footer className="modal-bottom-panel">
          <div className="modal-bottom-tabs">
            <button
              type="button"
              className={`modal-tab-btn ${bottomTab === 'preview' ? 'is-active' : ''}`}
              onClick={() => setBottomTab('preview')}
            >
              {t.modal.tabPreview}
            </button>
            <button
              type="button"
              className={`modal-tab-btn ${bottomTab === 'code' ? 'is-active' : ''}`}
              onClick={() => setBottomTab('code')}
            >
              {t.modal.tabCode}
            </button>
          </div>

          <div className="modal-bottom-content">
            {bottomTab === 'preview' ? (
              isDiagramEmpty ? (
                <div className="modal-empty-preview">{t.modal.emptyPreviewHint}</div>
              ) : previewError ? (
                <div className="mermaid-error-box">
                  <strong>{t.modal.previewErrorTitle}</strong>
                  <pre>{previewError}</pre>
                </div>
              ) : (
                <div
                  className="modal-preview-svg"
                  dangerouslySetInnerHTML={{ __html: previewSvg }}
                />
              )
            ) : (
              <pre className="modal-generated-code">{generatedCode}</pre>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
