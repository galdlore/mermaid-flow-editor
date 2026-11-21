import { ArrowDown, ArrowUp, Indent, Outdent, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import type {
  TreemapClassDefData,
  TreemapDiagramData,
  TreemapNodeData,
} from '../types/editor';
import {
  addTreemapChildNode,
  canIndentTreemapNode,
  canMoveTreemapNode,
  canOutdentTreemapNode,
  deleteTreemapSubtree,
  indentTreemapNode,
  moveTreemapNode,
  outdentTreemapNode,
} from '../utils/treemapConverter';

export interface TreemapCanvasProps {
  treemapData: TreemapDiagramData;
  selectedNodeId: string | null;
  onChange: (next: TreemapDiagramData) => void;
  onSelectNode: (nodeId: string | null) => void;
}

interface TreeTileNode {
  node: TreemapNodeData;
  weight: number;
  children: TreeTileNode[];
}

function buildVisualForest(nodes: TreemapNodeData[]): TreeTileNode[] {
  const roots: TreeTileNode[] = [];
  const stack: TreeTileNode[] = [];

  for (const node of nodes) {
    const item: TreeTileNode = {
      node,
      weight: node.kind === 'leaf' ? Math.max(1, node.value ?? 10) : 0,
      children: [],
    };
    while (stack.length > 0 && stack[stack.length - 1].node.depth >= node.depth) {
      stack.pop();
    }
    if (stack.length === 0) {
      roots.push(item);
    } else {
      stack[stack.length - 1].children.push(item);
    }
    stack.push(item);
  }

  const computeWeight = (item: TreeTileNode): number => {
    if (item.children.length === 0) {
      item.weight = item.node.kind === 'leaf' ? Math.max(1, item.node.value ?? 10) : 15;
      return item.weight;
    }
    const sum = item.children.reduce((acc, child) => acc + computeWeight(child), 0);
    item.weight = Math.max(10, sum);
    return item.weight;
  };

  roots.forEach(computeWeight);
  return roots;
}

export default function TreemapCanvas({
  treemapData,
  selectedNodeId,
  onChange,
  onSelectNode,
}: TreemapCanvasProps) {
  const { t } = useI18n();
  const tm = t.inspector.treemap;

  const nodes = treemapData.nodes;
  const selectedIndex = nodes.findIndex((n) => n.id === selectedNodeId);
  const classDefMap = new Map<string, TreemapClassDefData>(
    (treemapData.classDefs ?? []).map((cd) => [cd.name, cd])
  );

  const canIndent =
    selectedIndex > 0 && canIndentTreemapNode(nodes, selectedIndex);
  const canOutdent =
    selectedIndex >= 0 && canOutdentTreemapNode(nodes, selectedIndex);
  const canMoveUp =
    selectedIndex >= 0 && canMoveTreemapNode(nodes, selectedIndex, -1);
  const canMoveDown =
    selectedIndex >= 0 && canMoveTreemapNode(nodes, selectedIndex, 1);

  const handleAddNode = (kind: 'section' | 'leaf', asChild: boolean): void => {
    const label =
      kind === 'section'
        ? tm.defaultSectionLabel(nodes.length + 1)
        : tm.defaultLeafLabel(nodes.length + 1);
    const parentIdx = asChild && selectedIndex >= 0 ? selectedIndex : -1;
    const { nodes: nextNodes, createdId } = addTreemapChildNode(
      nodes,
      parentIdx,
      kind,
      label,
      20
    );
    onChange({ ...treemapData, nodes: nextNodes });
    onSelectNode(createdId);
  };

  const handleDeleteSelected = (): void => {
    if (selectedIndex < 0) return;
    const nextNodes = deleteTreemapSubtree(nodes, selectedIndex);
    onChange({ ...treemapData, nodes: nextNodes });
    onSelectNode(
      nextNodes[Math.min(selectedIndex, nextNodes.length - 1)]?.id ?? null
    );
  };

  const forest = buildVisualForest(nodes);

  const renderTile = (tile: TreeTileNode) => {
    const { node, weight, children } = tile;
    const isSelected = node.id === selectedNodeId;
    const cls = node.className ? classDefMap.get(node.className) : undefined;
    const tileStyle = cls
      ? {
          flex: `${weight} 1 120px`,
          backgroundColor: cls.fill,
          borderColor: cls.stroke,
          color: cls.color,
        }
      : { flex: `${weight} 1 120px` };

    return (
      <div
        key={node.id}
        role="button"
        tabIndex={0}
        className={`treemap-tile ${node.kind === 'leaf' ? 'is-leaf' : ''} ${
          isSelected ? 'is-selected' : ''
        }`}
        style={tileStyle}
        onClick={(e) => {
          e.stopPropagation();
          onSelectNode(node.id);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onSelectNode(node.id);
          }
        }}
      >
        <div className="treemap-tile-header">
          <span>{node.label}</span>
          {node.kind === 'leaf' && (
            <span className="treemap-tile-value">{node.value ?? 10}</span>
          )}
        </div>
        {children.length > 0 && (
          <div className="treemap-tile-children">{children.map(renderTile)}</div>
        )}
      </div>
    );
  };

  return (
    <div className="treemap-canvas">
      <div className="treemap-toolbar">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => handleAddNode('section', false)}
        >
          <Plus size={14} />
          <span>{tm.addSectionBtn}</span>
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => handleAddNode('leaf', false)}
        >
          <Plus size={14} />
          <span>{tm.addLeafBtn}</span>
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={selectedIndex < 0}
          onClick={() => handleAddNode('leaf', true)}
        >
          <Plus size={14} />
          <span>{tm.addChildLeafBtn}</span>
        </button>
        <button
          type="button"
          className="btn-icon-subtle"
          title={tm.indentTitle}
          disabled={!canIndent}
          onClick={() =>
            onChange({
              ...treemapData,
              nodes: indentTreemapNode(nodes, selectedIndex),
            })
          }
        >
          <Indent size={14} />
        </button>
        <button
          type="button"
          className="btn-icon-subtle"
          title={tm.outdentTitle}
          disabled={!canOutdent}
          onClick={() =>
            onChange({
              ...treemapData,
              nodes: outdentTreemapNode(nodes, selectedIndex),
            })
          }
        >
          <Outdent size={14} />
        </button>
        <button
          type="button"
          className="btn-icon-subtle"
          title={tm.moveUpTitle}
          disabled={!canMoveUp}
          onClick={() =>
            onChange({
              ...treemapData,
              nodes: moveTreemapNode(nodes, selectedIndex, -1),
            })
          }
        >
          <ArrowUp size={14} />
        </button>
        <button
          type="button"
          className="btn-icon-subtle"
          title={tm.moveDownTitle}
          disabled={!canMoveDown}
          onClick={() =>
            onChange({
              ...treemapData,
              nodes: moveTreemapNode(nodes, selectedIndex, 1),
            })
          }
        >
          <ArrowDown size={14} />
        </button>
        <button
          type="button"
          className="btn-icon-subtle is-danger"
          title={tm.deleteSubtreeBtn}
          disabled={selectedIndex < 0}
          onClick={handleDeleteSelected}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="treemap-canvas-scroll">
        {treemapData.title && (
          <div className="strategy-title-banner">{treemapData.title}</div>
        )}

        {nodes.length === 0 ? (
          <div className="strategy-empty-state">{tm.emptyTree}</div>
        ) : (
          <>
            <div className="treemap-tile-stage">{forest.map(renderTile)}</div>

            <div className="treemap-tree-list">
              {nodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  className={`treemap-tree-row ${
                    node.id === selectedNodeId ? 'is-selected' : ''
                  }`}
                  style={{ paddingLeft: `${10 + node.depth * 18}px` }}
                  onClick={() => onSelectNode(node.id)}
                >
                  <span className="treemap-kind-badge">{node.kind}</span>
                  <span>{node.label}</span>
                  {node.kind === 'leaf' && (
                    <span className="treemap-tile-value">{node.value ?? 10}</span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
