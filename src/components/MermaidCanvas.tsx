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
  MermaidDiagramData,
  MermaidEdgeData,
  MermaidNodeData,
  NodeShape,
} from '../types/editor';

type CustomNodeData = {
  label: string;
  shape: NodeShape;
  color: string;
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

function MermaidCustomNode({ data, selected }: NodeProps<MermaidFlowNode>) {
  const shapeClass = `shape-${data.shape}`;
  const selectedClass = selected ? 'is-selected' : '';
  const bgColor = data.color || '#ffffff';

  return (
    <div
      className={`mermaid-flow-node ${shapeClass} ${selectedClass}`}
      style={data.shape === 'diamond' ? undefined : { backgroundColor: bgColor }}
    >
      {data.shape === 'diamond' && (
        <div
          className="mermaid-diamond-bg"
          style={{ backgroundColor: bgColor }}
        />
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

function toFlowNodes(
  nodes: MermaidNodeData[],
  selectedNodeId: string | null
): MermaidFlowNode[] {
  return nodes.map((node) => ({
    id: node.id,
    type: 'mermaidNode',
    position: { x: node.position.x, y: node.position.y },
    selected: node.id === selectedNodeId,
    data: {
      label: node.label,
      shape: node.shape,
      color: node.color || '#ffffff',
    },
  }));
}

function getEdgeStyle(lineType: EdgeLineType, isSelected: boolean): React.CSSProperties {
  const stroke = isSelected ? '#2563eb' : '#475569';
  switch (lineType) {
    case 'dotted':
      return { stroke, strokeWidth: isSelected ? 2.5 : 2, strokeDasharray: '6 4' };
    case 'thick':
      return { stroke, strokeWidth: isSelected ? 4 : 3 };
    case 'line':
    case 'arrow':
    default:
      return { stroke, strokeWidth: isSelected ? 2.5 : 2 };
  }
}

function toFlowEdges(
  edges: MermaidEdgeData[],
  selectedEdgeId: string | null
): Edge[] {
  return edges.map((edge) => {
    const isSelected = edge.id === selectedEdgeId;
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label || undefined,
      selected: isSelected,
      style: getEdgeStyle(edge.lineType, isSelected),
      markerEnd:
        edge.lineType === 'line'
          ? undefined
          : {
              type: MarkerType.ArrowClosed,
              color: isSelected ? '#2563eb' : '#475569',
            },
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

export default function MermaidCanvas({
  diagramData,
  selectedNodeId,
  selectedEdgeId,
  onChange,
  onSelectNode,
  onSelectEdge,
}: MermaidCanvasProps) {
  const [flowNodes, setFlowNodes] = useState<MermaidFlowNode[]>(() =>
    toFlowNodes(diagramData.nodes, selectedNodeId)
  );

  useEffect(() => {
    setFlowNodes(toFlowNodes(diagramData.nodes, selectedNodeId));
  }, [diagramData.nodes, selectedNodeId]);

  const flowEdges = useMemo(
    () => toFlowEdges(diagramData.edges, selectedEdgeId),
    [diagramData.edges, selectedEdgeId]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<MermaidFlowNode>[]) => {
      setFlowNodes((current) => applyNodeChanges(changes, current));
    },
    []
  );

  const handleNodeDragStop: OnNodeDrag<MermaidFlowNode> = useCallback(
    (_event, draggedNode) => {
      const nextNodes = diagramData.nodes.map((node) =>
        node.id === draggedNode.id
          ? {
              ...node,
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
    [diagramData, onChange]
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
        <Background gap={18} size={1} color="#cbd5e1" />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
