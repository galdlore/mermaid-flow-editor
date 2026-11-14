import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Background,
  ConnectionMode,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ViewportPortal,
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
  type OnNodeDrag,
} from '@xyflow/react';
import type {
  EdgeLineType,
  MermaidClassDefData,
  MermaidDiagramData,
  MermaidEdgeData,
  MermaidNodeData,
  MermaidSubgraphData,
  NodeShape,
} from '../types/editor';

type CustomNodeData = {
  label: string;
  shape: NodeShape;
  color: string;
  strokeColor?: string;
  textColor?: string;
  hasLink?: boolean;
};

type MermaidFlowNode = Node<CustomNodeData, 'mermaidNode'>;

export interface MermaidCanvasProps {
  diagramData: MermaidDiagramData;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onChange: (next: MermaidDiagramData) => void;
  onSelectNode: (nodeId: string | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
}

const VECTOR_SHAPES = new Set<NodeShape>([
  'subroutine',
  'cylinder',
  'cyl_modern',
  'asymmetric',
  'hexagon',
  'parallelogram',
  'parallelogram_alt',
  'trapezoid',
  'trapezoid_alt',
  'double_circle',
  'doc',
]);

function NodeVectorBackdrop({
  shape,
  bgColor,
  strokeColor,
  selected,
}: {
  shape: NodeShape;
  bgColor: string;
  strokeColor?: string;
  selected: boolean;
}) {
  const stroke = selected ? '#2563eb' : (strokeColor || '#64748b');
  const commonProps = {
    fill: bgColor,
    stroke,
    strokeWidth: 2,
    vectorEffect: 'non-scaling-stroke' as const,
  };

  if (shape === 'double_circle') {
    return (
      <svg className="mermaid-shape-svg" viewBox="0 0 104 104" aria-hidden="true">
        <circle cx="52" cy="52" r="49" {...commonProps} />
        <circle cx="52" cy="52" r="42" fill="none" stroke={stroke} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }

  if (shape === 'cylinder' || shape === 'cyl_modern') {
    return (
      <svg className="mermaid-shape-svg" viewBox="0 0 140 68" preserveAspectRatio="none" aria-hidden="true">
        <path d="M 2,13 L 2,55 A 68,10 0 0 0 138,55 L 138,13 Z" {...commonProps} />
        <ellipse cx="70" cy="13" rx="68" ry="10" {...commonProps} />
      </svg>
    );
  }

  return (
    <svg className="mermaid-shape-svg" viewBox="0 0 140 60" preserveAspectRatio="none" aria-hidden="true">
      {shape === 'subroutine' && (
        <>
          <rect x="2" y="2" width="136" height="56" rx="3" {...commonProps} />
          <line x1="14" y1="2" x2="14" y2="58" stroke={stroke} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <line x1="126" y1="2" x2="126" y2="58" stroke={stroke} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </>
      )}
      {shape === 'asymmetric' && <polygon points="2,2 138,2 138,58 2,58 18,30" {...commonProps} />}
      {shape === 'hexagon' && <polygon points="16,2 124,2 138,30 124,58 16,58 2,30" {...commonProps} />}
      {shape === 'parallelogram' && <polygon points="20,2 138,2 120,58 2,58" {...commonProps} />}
      {shape === 'parallelogram_alt' && <polygon points="2,2 120,2 138,58 20,58" {...commonProps} />}
      {shape === 'trapezoid' && <polygon points="20,2 120,2 138,58 2,58" {...commonProps} />}
      {shape === 'trapezoid_alt' && <polygon points="2,2 138,2 120,58 20,58" {...commonProps} />}
      {shape === 'doc' && <path d="M 2,2 L 138,2 L 138,48 Q 104,37 70,48 T 2,48 Z" {...commonProps} />}
    </svg>
  );
}

function MermaidCustomNode({ data, selected }: NodeProps<MermaidFlowNode>) {
  const shapeClass = `shape-${data.shape}`;
  const isVector = VECTOR_SHAPES.has(data.shape);
  const isCustomBg = data.shape === 'diamond' || isVector;
  const selectedClass = selected ? 'is-selected' : '';
  const vectorClass = isVector ? 'has-vector-bg' : '';
  const bgColor = data.color || '#ffffff';

  const outerStyle: React.CSSProperties | undefined = isCustomBg
    ? data.textColor
      ? { color: data.textColor }
      : undefined
    : {
      backgroundColor: bgColor,
      ...(data.strokeColor && !selected ? { borderColor: data.strokeColor } : {}),
      ...(data.textColor ? { color: data.textColor } : {}),
    };

  return (
    <div
      className={`mermaid-flow-node ${shapeClass} ${vectorClass} ${selectedClass}`}
      style={outerStyle}
    >
      {data.shape === 'diamond' && (
        <div
          className="mermaid-diamond-bg"
          style={{
            backgroundColor: bgColor,
            ...(data.strokeColor && !selected ? { borderColor: data.strokeColor } : {}),
          }}
        />
      )}

      {isVector && (
        <NodeVectorBackdrop
          shape={data.shape}
          bgColor={bgColor}
          strokeColor={data.strokeColor}
          selected={Boolean(selected)}
        />
      )}

      {data.hasLink && (
        <span className="mermaid-node-link-badge" aria-hidden="true">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
            <path
              d="M6.5 9.5L9.5 6.5M5.5 7.5L4 9a2.5 2.5 0 0 0 3.5 3.5l1.5-1.5M10.5 8.5L12 7a2.5 2.5 0 0 0-3.5-3.5L7 5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </span>
      )}

      <Handle id="top" type="source" position={Position.Top} className="mermaid-handle" />
      <Handle id="right" type="source" position={Position.Right} className="mermaid-handle" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="mermaid-handle" />
      <Handle id="left" type="source" position={Position.Left} className="mermaid-handle" />

      <div className="mermaid-flow-node-label">{data.label}</div>
    </div>
  );
}

const nodeTypes = {
  mermaidNode: MermaidCustomNode,
};

function sanitizeColorId(color: string): string {
  return color.replace(/[^a-zA-Z0-9]/g, '');
}

function toFlowNodes(
  nodes: MermaidNodeData[],
  classDefs: MermaidClassDefData[] | undefined,
  selectedNodeId: string | null
): MermaidFlowNode[] {
  const classMap = new Map<string, MermaidClassDefData>();
  for (const cls of classDefs ?? []) {
    classMap.set(cls.name, cls);
  }

  return nodes.map((node) => {
    const classDef = node.className ? classMap.get(node.className) : undefined;
    const hasCustomNodeFill = Boolean(node.color && node.color !== '#ffffff');
    const fillColor = (hasCustomNodeFill ? node.color : classDef?.fill) || node.color || '#ffffff';
    const strokeColor = node.strokeColor || classDef?.stroke;
    const textColor = classDef?.color;

    return {
      id: node.id,
      type: 'mermaidNode',
      position: { x: node.position.x, y: node.position.y },
      selected: node.id === selectedNodeId,
      data: {
        label: node.label,
        shape: node.shape,
        color: fillColor,
        strokeColor,
        textColor,
        hasLink: Boolean(node.linkUrl && node.linkUrl.trim()),
      },
    };
  });
}

function getEdgeStyle(
  lineType: EdgeLineType,
  isSelected: boolean,
  strokeColor?: string
): React.CSSProperties {
  const stroke = isSelected
    ? '#2563eb'
    : strokeColor || (lineType === 'invisible' ? '#94a3b8' : '#475569');
  switch (lineType) {
    case 'dotted':
      return { stroke, strokeWidth: isSelected ? 2.5 : 2, strokeDasharray: '6 4' };
    case 'thick':
      return { stroke, strokeWidth: isSelected ? 4.5 : 3.5 };
    case 'invisible':
      return {
        stroke: isSelected ? '#60a5fa' : strokeColor || '#94a3b8',
        strokeWidth: isSelected ? 2.5 : 1.5,
        strokeDasharray: '3 5',
        opacity: isSelected ? 0.9 : 0.45,
      };
    case 'circle':
    case 'cross':
    case 'bidirectional':
    case 'line':
    case 'arrow':
    default:
      return { stroke, strokeWidth: isSelected ? 2.5 : 2 };
  }
}

function getEdgeMarkers(
  lineType: EdgeLineType,
  isSelected: boolean,
  strokeColor?: string
): Pick<Edge, 'markerStart' | 'markerEnd'> {
  const color = isSelected ? '#2563eb' : strokeColor || '#475569';
  const customSuffix = !isSelected && strokeColor ? `-${sanitizeColorId(strokeColor)}` : '';
  switch (lineType) {
    case 'line':
    case 'invisible':
      return { markerStart: undefined, markerEnd: undefined };
    case 'circle':
      return {
        markerStart: undefined,
        markerEnd: isSelected
          ? 'mermaid-marker-circle-selected'
          : `mermaid-marker-circle${customSuffix}`,
      };
    case 'cross':
      return {
        markerStart: undefined,
        markerEnd: isSelected
          ? 'mermaid-marker-cross-selected'
          : `mermaid-marker-cross${customSuffix}`,
      };
    case 'bidirectional':
      return {
        markerStart: { type: MarkerType.ArrowClosed, color },
        markerEnd: { type: MarkerType.ArrowClosed, color },
      };
    case 'arrow':
    case 'dotted':
    case 'thick':
    default:
      return {
        markerStart: undefined,
        markerEnd: { type: MarkerType.ArrowClosed, color },
      };
  }
}

function toFlowEdges(
  edges: MermaidEdgeData[],
  selectedEdgeId: string | null
): Edge[] {
  return edges.map((edge) => {
    const isSelected = edge.id === selectedEdgeId;
    const markers = getEdgeMarkers(edge.lineType, isSelected, edge.strokeColor);
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label || undefined,
      selected: isSelected,
      style: getEdgeStyle(edge.lineType, isSelected, edge.strokeColor),
      ...markers,
    };
  });
}

function createUniqueEdgeId(existingEdges: MermaidEdgeData[]): string {
  let index = existingEdges.length + 1;
  while (existingEdges.some((edge) => edge.id === `edge_${index}`)) {
    index += 1;
  }
  return `edge_${index}`;
}

interface SubgraphBox {
  subgraph: MermaidSubgraphData;
  x: number;
  y: number;
  width: number;
  height: number;
}

function buildSubgraphBoxes(
  diagramData: MermaidDiagramData,
  flowNodes: MermaidFlowNode[]
): SubgraphBox[] {
  const subgraphs = diagramData.subgraphs;
  if (!subgraphs || subgraphs.length === 0) {
    return [];
  }

  const flowNodeMap = new Map<string, MermaidFlowNode>();
  for (const fn of flowNodes) {
    flowNodeMap.set(fn.id, fn);
  }

  if (diagramData.diagramType === 'swimlane') {
    const isHorizontal = diagramData.direction === 'LR' || diagramData.direction === 'RL';

    if (isHorizontal) {
      let globalMinX = Infinity;
      let globalMaxX = -Infinity;
      for (const fn of flowNodes) {
        const w = fn.measured?.width ?? 150;
        globalMinX = Math.min(globalMinX, fn.position.x);
        globalMaxX = Math.max(globalMaxX, fn.position.x + w);
      }
      const laneX = Number.isFinite(globalMinX) ? Math.min(20, globalMinX - 110) : 20;
      const laneWidth = Number.isFinite(globalMaxX)
        ? Math.max(660, globalMaxX - laneX + 36)
        : 660;

      let cursorY = 20;
      return subgraphs.map((subgraph) => {
        const members = diagramData.nodes
          .filter((n) => n.subgraphId === subgraph.id)
          .map((n) => flowNodeMap.get(n.id))
          .filter((n): n is MermaidFlowNode => Boolean(n));

        if (members.length === 0) {
          const box: SubgraphBox = {
            subgraph,
            x: laneX,
            y: cursorY,
            width: laneWidth,
            height: 128,
          };
          cursorY += 136;
          return box;
        }

        let minY = Infinity;
        let maxY = -Infinity;
        for (const fn of members) {
          const h = fn.measured?.height ?? 62;
          minY = Math.min(minY, fn.position.y);
          maxY = Math.max(maxY, fn.position.y + h);
        }
        const y = minY - 22;
        const height = Math.max(128, maxY - minY + 44);
        cursorY = Math.max(cursorY, y + height + 8);
        return { subgraph, x: laneX, y, width: laneWidth, height };
      });
    }

    let globalMinY = Infinity;
    let globalMaxY = -Infinity;
    for (const fn of flowNodes) {
      const h = fn.measured?.height ?? 62;
      globalMinY = Math.min(globalMinY, fn.position.y);
      globalMaxY = Math.max(globalMaxY, fn.position.y + h);
    }
    const laneY = Number.isFinite(globalMinY) ? Math.min(16, globalMinY - 56) : 16;
    const laneHeight = Number.isFinite(globalMaxY)
      ? Math.max(360, globalMaxY - laneY + 32)
      : 360;

    let cursorX = 20;
    return subgraphs.map((subgraph) => {
      const members = diagramData.nodes
        .filter((n) => n.subgraphId === subgraph.id)
        .map((n) => flowNodeMap.get(n.id))
        .filter((n): n is MermaidFlowNode => Boolean(n));

      if (members.length === 0) {
        const box: SubgraphBox = {
          subgraph,
          x: cursorX,
          y: laneY,
          width: 220,
          height: laneHeight,
        };
        cursorX += 228;
        return box;
      }

      let minX = Infinity;
      let maxX = -Infinity;
      for (const fn of members) {
        const w = fn.measured?.width ?? 150;
        minX = Math.min(minX, fn.position.x);
        maxX = Math.max(maxX, fn.position.x + w);
      }
      const x = minX - 24;
      const width = Math.max(220, maxX - minX + 48);
      cursorX = Math.max(cursorX, x + width + 8);
      return { subgraph, x, y: laneY, width, height: laneHeight };
    });
  }

  return subgraphs.map((subgraph, index) => {
    const memberFlowNodes = diagramData.nodes
      .filter((n) => n.subgraphId === subgraph.id)
      .map((n) => flowNodeMap.get(n.id))
      .filter((n): n is MermaidFlowNode => Boolean(n));

    if (memberFlowNodes.length === 0) {
      return {
        subgraph,
        x: 40 + index * 230,
        y: 20,
        width: 200,
        height: 92,
      };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const fn of memberFlowNodes) {
      const width = fn.measured?.width ?? 150;
      const height = fn.measured?.height ?? 62;
      minX = Math.min(minX, fn.position.x);
      minY = Math.min(minY, fn.position.y);
      maxX = Math.max(maxX, fn.position.x + width);
      maxY = Math.max(maxY, fn.position.y + height);
    }

    const padX = 24;
    const padTop = 40;
    const padBottom = 22;

    return {
      subgraph,
      x: minX - padX,
      y: minY - padTop,
      width: Math.max(180, maxX - minX + padX * 2),
      height: Math.max(96, maxY - minY + padTop + padBottom),
    };
  });
}

export default function MermaidCanvas({
  diagramData,
  selectedNodeId,
  selectedEdgeId,
  onChange,
  onSelectNode,
  onSelectEdge,
}: MermaidCanvasProps) {
  const [flowNodes, setFlowNodes] = useState<MermaidFlowNode[]>(() =>
    toFlowNodes(diagramData.nodes, diagramData.classDefs, selectedNodeId)
  );

  useEffect(() => {
    setFlowNodes(toFlowNodes(diagramData.nodes, diagramData.classDefs, selectedNodeId));
  }, [diagramData.nodes, diagramData.classDefs, selectedNodeId]);

  const flowEdges = useMemo(
    () => toFlowEdges(diagramData.edges, selectedEdgeId),
    [diagramData.edges, selectedEdgeId]
  );

  const customEdgeColors = useMemo(() => {
    const colors = new Set<string>();
    for (const edge of diagramData.edges) {
      if (edge.strokeColor) {
        colors.add(edge.strokeColor);
      }
    }
    return Array.from(colors);
  }, [diagramData.edges]);

  const subgraphBoxes = useMemo(
    () => buildSubgraphBoxes(diagramData, flowNodes),
    [diagramData, flowNodes]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<MermaidFlowNode>[]) => {
      setFlowNodes((current) => applyNodeChanges(changes, current));
    },
    []
  );

  const handleNodeDragStop: OnNodeDrag<MermaidFlowNode> = useCallback(
    (_event, draggedNode) => {
      const nodeW = draggedNode.measured?.width ?? 150;
      const nodeH = draggedNode.measured?.height ?? 62;
      const centerX = draggedNode.position.x + nodeW / 2;
      const centerY = draggedNode.position.y + nodeH / 2;

      let droppedLaneId: string | undefined;
      if (diagramData.diagramType === 'swimlane') {
        const hitBox = subgraphBoxes.find(
          (box) =>
            centerX >= box.x &&
            centerX <= box.x + box.width &&
            centerY >= box.y &&
            centerY <= box.y + box.height
        );
        if (hitBox) {
          droppedLaneId = hitBox.subgraph.id;
        }
      }

      const nextNodes = diagramData.nodes.map((node) =>
        node.id === draggedNode.id
          ? {
            ...node,
            ...(droppedLaneId ? { subgraphId: droppedLaneId } : {}),
            position: {
              x: Math.round(draggedNode.position.x),
              y: Math.round(draggedNode.position.y),
            },
          }
          : node
      );

      onChange({
        ...diagramData,
        nodes: nextNodes,
      });
    },
    [diagramData, onChange, subgraphBoxes]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) {
        return;
      }

      const newEdge: MermaidEdgeData = {
        id: createUniqueEdgeId(diagramData.edges),
        source: connection.source,
        target: connection.target,
        lineType: 'arrow',
      };

      onChange({
        ...diagramData,
        edges: [...diagramData.edges, newEdge],
      });
      onSelectNode(null);
      onSelectEdge(newEdge.id);
    },
    [diagramData, onChange, onSelectEdge, onSelectNode]
  );

  return (
    <div className="mermaid-canvas-root">
      <svg
        style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
        aria-hidden="true"
      >
        <defs>
          <marker
            id="mermaid-marker-circle"
            markerWidth="12"
            markerHeight="12"
            viewBox="0 0 12 12"
            refX="9"
            refY="6"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <circle cx="6" cy="6" r="3.5" fill="#ffffff" stroke="#475569" strokeWidth="1.8" />
          </marker>
          <marker
            id="mermaid-marker-circle-selected"
            markerWidth="12"
            markerHeight="12"
            viewBox="0 0 12 12"
            refX="9"
            refY="6"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <circle cx="6" cy="6" r="3.5" fill="#ffffff" stroke="#2563eb" strokeWidth="1.8" />
          </marker>
          <marker
            id="mermaid-marker-cross"
            markerWidth="12"
            markerHeight="12"
            viewBox="0 0 12 12"
            refX="8"
            refY="6"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M 3 3 L 9 9 M 9 3 L 3 9" stroke="#475569" strokeWidth="2" strokeLinecap="round" fill="none" />
          </marker>
          <marker
            id="mermaid-marker-cross-selected"
            markerWidth="12"
            markerHeight="12"
            viewBox="0 0 12 12"
            refX="8"
            refY="6"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M 3 3 L 9 9 M 9 3 L 3 9" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" fill="none" />
          </marker>
          {customEdgeColors.map((color) => {
            const suffix = sanitizeColorId(color);
            return (
              <g key={suffix}>
                <marker
                  id={`mermaid-marker-circle-${suffix}`}
                  markerWidth="12"
                  markerHeight="12"
                  viewBox="0 0 12 12"
                  refX="9"
                  refY="6"
                  orient="auto"
                  markerUnits="userSpaceOnUse"
                >
                  <circle cx="6" cy="6" r="3.5" fill="#ffffff" stroke={color} strokeWidth="1.8" />
                </marker>
                <marker
                  id={`mermaid-marker-cross-${suffix}`}
                  markerWidth="12"
                  markerHeight="12"
                  viewBox="0 0 12 12"
                  refX="8"
                  refY="6"
                  orient="auto"
                  markerUnits="userSpaceOnUse"
                >
                  <path d="M 3 3 L 9 9 M 9 3 L 3 9" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
                </marker>
              </g>
            );
          })}
        </defs>
      </svg>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        onNodesChange={handleNodesChange}
        onNodeDragStop={handleNodeDragStop}
        onConnect={handleConnect}
        onNodeClick={(_event, node) => {
          onSelectEdge(null);
          onSelectNode(node.id);
        }}
        onEdgeClick={(_event, edge) => {
          onSelectNode(null);
          onSelectEdge(edge.id);
        }}
        onPaneClick={() => {
          onSelectNode(null);
          onSelectEdge(null);
        }}
        fitView
      >
        {subgraphBoxes.length > 0 && (
          <ViewportPortal>
            {subgraphBoxes.map(({ subgraph, x, y, width, height }) => {
              const isSwimlane = diagramData.diagramType === 'swimlane';
              const isHorizontalLane =
                diagramData.direction === 'LR' || diagramData.direction === 'RL';

              if (isSwimlane) {
                return (
                  <div
                    key={subgraph.id}
                    className={`mermaid-swimlane-box ${isHorizontalLane ? 'is-horizontal' : 'is-vertical'
                      }`}
                    style={{
                      transform: `translate(${x}px, ${y}px)`,
                      width: `${width}px`,
                      height: `${height}px`,
                      ...(subgraph.stroke ? { borderColor: subgraph.stroke } : {}),
                    }}
                  >
                    <div
                      className="mermaid-swimlane-header"
                      style={{
                        ...(subgraph.fill ? { backgroundColor: subgraph.fill } : {}),
                        ...(subgraph.stroke ? { borderColor: subgraph.stroke } : {}),
                      }}
                    >
                      <span className="mermaid-swimlane-title">
                        {subgraph.title || subgraph.id}
                      </span>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={subgraph.id}
                  className="mermaid-subgraph-box"
                  style={{
                    transform: `translate(${x}px, ${y}px)`,
                    width: `${width}px`,
                    height: `${height}px`,
                    ...(subgraph.fill ? { backgroundColor: subgraph.fill } : {}),
                    ...(subgraph.stroke ? { borderColor: subgraph.stroke } : {}),
                  }}
                >
                  <div className="mermaid-subgraph-header">
                    <span className="mermaid-subgraph-title">
                      {subgraph.title || subgraph.id}
                    </span>
                    {subgraph.direction && (
                      <span className="mermaid-subgraph-dir">{subgraph.direction}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </ViewportPortal>
        )}
        <Background gap={18} size={1} color="#cbd5e1" />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
