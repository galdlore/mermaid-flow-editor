import './styles.css';
import MermaidCanvas from '../../components/MermaidCanvas';
import MermaidInspector from '../../components/MermaidInspector';
import type { Language, TranslationCatalog } from '../../locales/types';
import {
  createDefaultDiagramData,
  createDefaultSwimlaneData,
  generateMermaidCode,
  parseMermaidCodeToGuiData,
} from '../../utils/mermaidConverter';
import {
  defineDiagramHandler,
  type DiagramTransitionArgs,
} from '../types';

function transitionToFlowchart({
  prevType,
  currentData,
  initialCode,
  lang,
}: DiagramTransitionArgs) {
  const activeFlowData =
    currentData && 'nodes' in currentData && 'edges' in currentData
      ? (currentData as ReturnType<typeof createDefaultDiagramData>)
      : prevType === 'swimlane'
        ? createDefaultSwimlaneData(lang)
        : createDefaultDiagramData(lang);

  if (prevType !== 'swimlane') {
    const nextFlowData = {
      ...activeFlowData,
      diagramType: 'flowchart' as const,
    };
    return {
      data: nextFlowData,
      selection: {
        nodeId: nextFlowData.nodes[0]?.id ?? null,
        edgeId: null,
      },
    };
  }

  const isUntouchedSwimlane =
    !initialCode.trim() &&
    activeFlowData.nodes.length === 3 &&
    activeFlowData.nodes[2]?.id === 'node_3' &&
    activeFlowData.subgraphs?.length === 2 &&
    activeFlowData.subgraphs[0]?.id === 'lane_1';

  const nextFlowchart = isUntouchedSwimlane
    ? createDefaultDiagramData(lang)
    : {
        ...activeFlowData,
        diagramType: 'flowchart' as const,
      };

  return {
    data: nextFlowchart,
    selection: {
      nodeId: nextFlowchart.nodes[0]?.id ?? null,
      edgeId: null,
    },
  };
}

function transitionToSwimlane({
  prevType,
  currentData,
  initialCode,
  lang,
  t,
}: DiagramTransitionArgs) {
  if (prevType !== 'flowchart') {
    const baseData =
      currentData && 'nodes' in currentData && 'edges' in currentData
        ? (currentData as ReturnType<typeof createDefaultDiagramData>)
        : createDefaultDiagramData(lang);
    const nextFlowData =
      (baseData.subgraphs?.length ?? 0) > 0
        ? { ...baseData, diagramType: 'swimlane' as const }
        : createDefaultSwimlaneData(lang);

    return {
      data: nextFlowData,
      selection: {
        nodeId: nextFlowData.nodes[0]?.id ?? null,
        edgeId: null,
      },
    };
  }

  const activeFlowData =
    currentData && 'nodes' in currentData && 'edges' in currentData
      ? (currentData as ReturnType<typeof createDefaultDiagramData>)
      : createDefaultDiagramData(lang);

  const isUntouchedFlowchart =
    !initialCode.trim() &&
    activeFlowData.nodes.length === 2 &&
    activeFlowData.nodes[0]?.id === 'node_1' &&
    activeFlowData.nodes[1]?.id === 'node_2' &&
    (!activeFlowData.subgraphs || activeFlowData.subgraphs.length === 0);

  if (isUntouchedFlowchart) {
    const nextSwimlane = createDefaultSwimlaneData(lang);
    return {
      data: nextSwimlane,
      selection: {
        nodeId: nextSwimlane.nodes[0]?.id ?? null,
        edgeId: null,
      },
    };
  }

  const existingSubgraphs = activeFlowData.subgraphs ?? [];
  const nextSwimlane =
    existingSubgraphs.length === 0
      ? {
          ...activeFlowData,
          diagramType: 'swimlane' as const,
          subgraphs: [
            {
              id: 'lane_1',
              title: t.inspector.swimlane.defaultLaneTitle(1),
              fill: '#eff6ff',
              stroke: '#2563eb',
            },
          ],
          nodes: activeFlowData.nodes.map((node) => ({
            ...node,
            subgraphId: node.subgraphId || 'lane_1',
          })),
        }
      : {
          ...activeFlowData,
          diagramType: 'swimlane' as const,
        };

  return {
    data: nextSwimlane,
    selection: {
      nodeId: nextSwimlane.nodes[0]?.id ?? null,
      edgeId: null,
    },
  };
}

export const flowchartHandler = defineDiagramHandler<'flowchart'>({
  id: 'flowchart',
  storeKey: 'flowchart',
  getSubtitle: (t: TranslationCatalog) => t.modal.subtitle,
  createDefault: (lang: Language) => createDefaultDiagramData(lang),
  parse: parseMermaidCodeToGuiData,
  generate: generateMermaidCode,
  isEmpty: (data) => data.nodes.length === 0,
  getInitialSelection: (data) => ({ nodeId: data.nodes[0]?.id ?? null, edgeId: null }),
  transitionFromPrevious: transitionToFlowchart,
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
});

export const swimlaneHandler = defineDiagramHandler<'flowchart'>({
  id: 'swimlane',
  storeKey: 'flowchart',
  getSubtitle: (t: TranslationCatalog) => t.modal.subtitleSwimlane,
  createDefault: (lang: Language) => createDefaultSwimlaneData(lang),
  parse: (code) => ({ ...parseMermaidCodeToGuiData(code), diagramType: 'swimlane' as const }),
  generate: generateMermaidCode,
  isEmpty: (data) => data.nodes.length === 0,
  getInitialSelection: (data) => ({ nodeId: data.nodes[0]?.id ?? null, edgeId: null }),
  transitionFromPrevious: transitionToSwimlane,
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
});

export default flowchartHandler;
