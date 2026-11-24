import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { InspectorCollapsibleSection } from './InspectorCollapsibleSection';
import {
  InspectorBulkControls,
  InspectorCommentsSection,
} from './InspectorCommon';
import FlowchartEdgeSection, {
  type FlowchartNewEdgeDraft,
} from './flowchart/FlowchartEdgeSection';
import FlowchartNodeSection from './flowchart/FlowchartNodeSection';
import {
  FlowchartClassDefsSection,
  FlowchartSubgraphsSection,
} from './flowchart/FlowchartStructureSection';
import type {
  MermaidClassDefData,
  MermaidDiagramData,
  MermaidDirection,
  MermaidEdgeData,
  MermaidNodeData,
  MermaidSubgraphData,
} from '../types/editor';

export interface MermaidInspectorProps {
  diagramData: MermaidDiagramData;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onChange: (next: MermaidDiagramData) => void;
  onSelectNode: (nodeId: string | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
}

const DIRECTION_VALUES: ReadonlyArray<MermaidDirection> = ['TD', 'LR', 'BT', 'RL'];

function createUniqueNodeId(nodes: MermaidNodeData[]): string {
  let index = nodes.length + 1;
  while (nodes.some((node) => node.id === `node_${index}`)) {
    index += 1;
  }
  return `node_${index}`;
}

function createUniqueEdgeId(edges: MermaidEdgeData[]): string {
  let index = edges.length + 1;
  while (edges.some((edge) => edge.id === `edge_${index}`)) {
    index += 1;
  }
  return `edge_${index}`;
}

function createUniqueSubgraphId(subgraphs: MermaidSubgraphData[]): string {
  let index = subgraphs.length + 1;
  while (subgraphs.some((sg) => sg.id === `sg_${index}`)) {
    index += 1;
  }
  return `sg_${index}`;
}

function sanitizeClassDefName(raw: string, fallbackIndex: number): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!cleaned) {
    return `style_${fallbackIndex}`;
  }
  return /^[a-zA-Z_]/.test(cleaned) ? cleaned : `c_${cleaned}`;
}

type InspectorSectionKey =
  | 'direction'
  | 'nodes'
  | 'edges'
  | 'subgraphs'
  | 'classDefs'
  | 'comments';

const DEFAULT_OPEN_SECTIONS: Record<InspectorSectionKey, boolean> = {
  direction: true,
  nodes: true,
  edges: false,
  subgraphs: false,
  classDefs: false,
  comments: false,
};

export default function MermaidInspector({
  diagramData,
  selectedNodeId,
  selectedEdgeId,
  onChange,
  onSelectNode,
  onSelectEdge,
}: MermaidInspectorProps) {
  const { t } = useI18n();
  const [openSections, setOpenSections] = useState<Record<InspectorSectionKey, boolean>>(
    DEFAULT_OPEN_SECTIONS
  );
  const isSwimlane = diagramData.diagramType === 'swimlane';

  useEffect(() => {
    if (isSwimlane) {
      setOpenSections((prev) => (prev.subgraphs ? prev : { ...prev, subgraphs: true }));
    }
  }, [isSwimlane]);

  useEffect(() => {
    if (selectedNodeId) {
      setOpenSections((prev) => (prev.nodes ? prev : { ...prev, nodes: true }));
    }
  }, [selectedNodeId]);

  useEffect(() => {
    if (selectedEdgeId) {
      setOpenSections((prev) => (prev.edges ? prev : { ...prev, edges: true }));
    }
  }, [selectedEdgeId]);

  const toggleSection = (key: InspectorSectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSectionsOpen = (nextOpen: boolean): void => {
    setOpenSections({
      direction: nextOpen,
      nodes: nextOpen,
      edges: nextOpen,
      subgraphs: nextOpen,
      classDefs: nextOpen,
      comments: nextOpen,
    });
  };

  const subgraphs = diagramData.subgraphs ?? [];
  const classDefs = diagramData.classDefs ?? [];
  const selectedNode =
    diagramData.nodes.find((node) => node.id === selectedNodeId) ?? null;

  const handleDirectionChange = (direction: MermaidDirection): void => {
    onChange({ ...diagramData, direction });
  };

  const handleAddNode = (targetLaneId?: string): void => {
    const nextId = createUniqueNodeId(diagramData.nodes);
    const count = diagramData.nodes.length;
    const assignedLaneId = isSwimlane
      ? targetLaneId ?? subgraphs[0]?.id
      : undefined;

    let position = {
      x: (count % 3) * 200 + 80,
      y: Math.floor(count / 3) * 130 + 60,
    };

    if (isSwimlane) {
      const laneIdx = Math.max(
        0,
        subgraphs.findIndex((sg) => sg.id === assignedLaneId)
      );
      const membersInLane = diagramData.nodes.filter(
        (n) => n.subgraphId === assignedLaneId
      ).length;
      const isHorizontalLane =
        diagramData.direction === 'LR' || diagramData.direction === 'RL';

      position = isHorizontalLane
        ? { x: 140 + membersInLane * 200, y: 60 + laneIdx * 150 }
        : { x: 60 + laneIdx * 240, y: 70 + membersInLane * 130 };
    }

    const newNode: MermaidNodeData = {
      id: nextId,
      label: isSwimlane
        ? t.inspector.swimlane.defaultStepTitle(count + 1)
        : t.inspector.defaultNewNodeLabel(count + 1),
      shape: 'rect',
      color: '#ffffff',
      ...(assignedLaneId ? { subgraphId: assignedLaneId } : {}),
      position,
    };

    onChange({
      ...diagramData,
      nodes: [...diagramData.nodes, newNode],
    });
    onSelectEdge(null);
    onSelectNode(nextId);
  };

  const handleUpdateSelectedNode = (patch: Partial<MermaidNodeData>): void => {
    if (!selectedNode) {
      return;
    }
    const nextNodes = diagramData.nodes.map((node) =>
      node.id === selectedNode.id ? { ...node, ...patch } : node
    );
    onChange({ ...diagramData, nodes: nextNodes });
  };

  const handleDeleteSelectedNode = (): void => {
    if (!selectedNode) {
      return;
    }
    const nextNodes = diagramData.nodes.filter((node) => node.id !== selectedNode.id);
    const nextEdges = diagramData.edges.filter(
      (edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id
    );
    onChange({
      ...diagramData,
      nodes: nextNodes,
      edges: nextEdges,
    });
    onSelectNode(null);
  };

  const handleAddEdge = (draft: FlowchartNewEdgeDraft): void => {
    const nextEdge: MermaidEdgeData = {
      id: createUniqueEdgeId(diagramData.edges),
      source: draft.source,
      target: draft.target,
      lineType: draft.lineType,
      ...(draft.extraLength > 0 ? { extraLength: draft.extraLength } : {}),
      ...(draft.labelStyle !== 'pipe' ? { labelStyle: draft.labelStyle } : {}),
      ...(draft.strokeColor ? { strokeColor: draft.strokeColor } : {}),
      label: draft.label.trim() || undefined,
    };
    onChange({
      ...diagramData,
      edges: [...diagramData.edges, nextEdge],
    });
    onSelectNode(null);
    onSelectEdge(nextEdge.id);
  };

  const handleUpdateEdge = (edgeId: string, patch: Partial<MermaidEdgeData>): void => {
    const nextEdges = diagramData.edges.map((edge) =>
      edge.id === edgeId ? { ...edge, ...patch } : edge
    );
    onChange({ ...diagramData, edges: nextEdges });
  };

  const handleDeleteEdge = (edgeId: string): void => {
    const nextEdges = diagramData.edges.filter((edge) => edge.id !== edgeId);
    onChange({ ...diagramData, edges: nextEdges });
    if (selectedEdgeId === edgeId) {
      onSelectEdge(null);
    }
  };

  const handleAddSubgraph = (draft: {
    title: string;
    direction: MermaidDirection | '';
    fill: string;
    stroke: string;
  }): void => {
    const nextId = createUniqueSubgraphId(subgraphs);
    const nextTitle =
      draft.title.trim() ||
      (isSwimlane
        ? t.inspector.swimlane.defaultLaneTitle(subgraphs.length + 1)
        : t.inspector.defaultSubgraphTitle(subgraphs.length + 1));
    const nextSubgraph: MermaidSubgraphData = {
      id: nextId,
      title: nextTitle,
      ...(!isSwimlane && draft.direction ? { direction: draft.direction } : {}),
      ...(isSwimlane ? { fill: draft.fill, stroke: draft.stroke } : {}),
    };
    onChange({
      ...diagramData,
      subgraphs: [...subgraphs, nextSubgraph],
    });
  };

  const handleMoveSubgraph = (subgraphId: string, delta: -1 | 1): void => {
    const index = subgraphs.findIndex((sg) => sg.id === subgraphId);
    const nextIndex = index + delta;
    if (index < 0 || nextIndex < 0 || nextIndex >= subgraphs.length) {
      return;
    }
    const nextSubgraphs = [...subgraphs];
    const [moved] = nextSubgraphs.splice(index, 1);
    nextSubgraphs.splice(nextIndex, 0, moved);
    onChange({
      ...diagramData,
      subgraphs: nextSubgraphs,
    });
  };

  const handleUpdateSubgraph = (
    subgraphId: string,
    patch: Partial<MermaidSubgraphData>
  ): void => {
    const nextSubgraphs = subgraphs.map((sg) =>
      sg.id === subgraphId ? { ...sg, ...patch } : sg
    );
    onChange({ ...diagramData, subgraphs: nextSubgraphs });
  };

  const handleDeleteSubgraph = (subgraphId: string): void => {
    const nextSubgraphs = subgraphs.filter((sg) => sg.id !== subgraphId);
    const nextNodes = diagramData.nodes.map((node) =>
      node.subgraphId === subgraphId ? { ...node, subgraphId: undefined } : node
    );
    onChange({
      ...diagramData,
      nodes: nextNodes,
      subgraphs: nextSubgraphs.length > 0 ? nextSubgraphs : undefined,
    });
  };

  const handleAddClassDef = (draft: {
    name: string;
    fill: string;
    stroke: string;
  }): void => {
    const className = sanitizeClassDefName(draft.name, classDefs.length + 1);
    const nextClassDef: MermaidClassDefData = {
      name: className,
      fill: draft.fill,
      stroke: draft.stroke || '#475569',
      color: '#0f172a',
    };
    const exists = classDefs.some((cls) => cls.name === className);
    const nextClassDefs = exists
      ? classDefs.map((cls) => (cls.name === className ? nextClassDef : cls))
      : [...classDefs, nextClassDef];
    onChange({
      ...diagramData,
      classDefs: nextClassDefs,
    });
  };

  const handleDeleteClassDef = (className: string): void => {
    const nextClassDefs = classDefs.filter((cls) => cls.name !== className);
    const nextNodes = diagramData.nodes.map((node) =>
      node.className === className ? { ...node, className: undefined } : node
    );
    onChange({
      ...diagramData,
      nodes: nextNodes,
      classDefs: nextClassDefs.length > 0 ? nextClassDefs : undefined,
    });
  };

  const subgraphsOrLanesSection = (
    <FlowchartSubgraphsSection
      isSwimlane={isSwimlane}
      directionValues={DIRECTION_VALUES}
      subgraphs={subgraphs}
      isOpen={openSections.subgraphs}
      onToggle={() => toggleSection('subgraphs')}
      onAddSubgraph={handleAddSubgraph}
      onMoveSubgraph={handleMoveSubgraph}
      onUpdateSubgraph={handleUpdateSubgraph}
      onDeleteSubgraph={handleDeleteSubgraph}
      onAddNodeInLane={(laneId) => {
        setOpenSections((prev) => ({ ...prev, nodes: true }));
        handleAddNode(laneId);
      }}
    />
  );

  return (
    <aside className="inspector-panel">
      <InspectorBulkControls mode="dual" onSetAll={setAllSectionsOpen} />

      {isSwimlane && subgraphsOrLanesSection}

      <InspectorCollapsibleSection
        title={t.inspector.directionHeading}
        badgeText={diagramData.direction}
        isOpen={openSections.direction}
        onToggle={() => toggleSection('direction')}
      >
        <div className="direction-grid">
          {DIRECTION_VALUES.map((directionValue) => (
            <button
              key={directionValue}
              type="button"
              className={`inspector-choice-btn ${diagramData.direction === directionValue ? 'is-active' : ''
                }`}
              onClick={() => handleDirectionChange(directionValue)}
            >
              {isSwimlane
                ? t.inspector.swimlane.directions[directionValue]
                : t.inspector.directions[directionValue]}
            </button>
          ))}
        </div>
      </InspectorCollapsibleSection>

      <FlowchartNodeSection
        isSwimlane={isSwimlane}
        nodes={diagramData.nodes}
        subgraphs={subgraphs}
        classDefs={classDefs}
        selectedNodeId={selectedNodeId}
        selectedNode={selectedNode}
        isOpen={openSections.nodes}
        onToggle={() => toggleSection('nodes')}
        onAddAndOpenNode={() => {
          setOpenSections((prev) => ({ ...prev, nodes: true }));
          handleAddNode();
        }}
        onSelectNode={onSelectNode}
        onSelectEdge={onSelectEdge}
        onUpdateSelectedNode={handleUpdateSelectedNode}
        onDeleteSelectedNode={handleDeleteSelectedNode}
      />

      <FlowchartEdgeSection
        nodes={diagramData.nodes}
        edges={diagramData.edges}
        selectedEdgeId={selectedEdgeId}
        isOpen={openSections.edges}
        onToggle={() => toggleSection('edges')}
        onSelectNode={onSelectNode}
        onSelectEdge={onSelectEdge}
        onAddEdge={handleAddEdge}
        onUpdateEdge={handleUpdateEdge}
        onDeleteEdge={handleDeleteEdge}
      />

      {!isSwimlane && subgraphsOrLanesSection}

      <FlowchartClassDefsSection
        classDefs={classDefs}
        isOpen={openSections.classDefs}
        onToggle={() => toggleSection('classDefs')}
        onAddClassDef={handleAddClassDef}
        onDeleteClassDef={handleDeleteClassDef}
      />

      <InspectorCommentsSection
        title={t.inspector.commentsHeading}
        placeholder={t.inspector.commentsPlaceholder}
        comments={diagramData.comments}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
        onChangeComments={(nextComments) =>
          onChange({
            ...diagramData,
            comments: nextComments,
          })
        }
      />
    </aside>
  );
}
