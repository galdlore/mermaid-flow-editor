import {
  ArrowDown,
  ArrowUp,
  Indent,
  Outdent,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useI18n } from '../i18n';
import {
  canIndentMindmapNode,
  canMoveMindmapNode,
  canOutdentMindmapNode,
  getMindmapSubtreeRange,
  indentMindmapNode,
  moveMindmapNode,
  normalizeMindmapNodes,
  outdentMindmapNode,
} from '../utils/mindmapConverter';
import type {
  MindmapDiagramData,
  MindmapNodeData,
  MindmapNodeShape,
} from '../types/editor';

export interface MindmapCanvasProps {
  mindmapData: MindmapDiagramData;
  selectedNodeId: string | null;
  onChange: (next: MindmapDiagramData) => void;
  onSelectNode: (nodeId: string | null) => void;
}

const BRANCH_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
];

const SHAPE_BADGE: Record<MindmapNodeShape, string> = {
  default: 'Aa',
  rounded: '( )',
  rect: '[ ]',
  circle: '(( ))',
  cloud: ') (',
  bang: ')) ((',
  hexagon: '{{ }}',
};

function nextTopicId(nodes: MindmapNodeData[]): string {
  const used = new Set(nodes.map((n) => n.id));
  let num = 1;
  while (used.has(`mm_${num}`)) {
    num++;
  }
  return `mm_${num}`;
}

export default function MindmapCanvas({
  mindmapData,
  selectedNodeId,
  onChange,
  onSelectNode,
}: MindmapCanvasProps) {
  const { t } = useI18n();
  const nodes = mindmapData.nodes;
  const selectedIndex = nodes.findIndex((n) => n.id === selectedNodeId);
  const selectedNode = selectedIndex >= 0 ? nodes[selectedIndex] : null;

  const canIndent =
    selectedIndex >= 0 && canIndentMindmapNode(nodes, selectedIndex);
  const canOutdent =
    selectedIndex >= 0 && canOutdentMindmapNode(nodes, selectedIndex);
  const canMoveUp =
    selectedIndex >= 0 && canMoveMindmapNode(nodes, selectedIndex, -1);
  const canMoveDown =
    selectedIndex >= 0 && canMoveMindmapNode(nodes, selectedIndex, 1);

  const insertTopic = (asChild: boolean): void => {
    const id = nextTopicId(nodes);
    const label = t.inspector.mindmap.defaultTopicLabel(nodes.length);

    if (nodes.length === 0) {
      const rootNode: MindmapNodeData = {
        id: 'root',
        depth: 0,
        label,
        shape: 'circle',
      };
      onChange({ ...mindmapData, nodes: [rootNode] });
      onSelectNode('root');
      return;
    }

    const anchorIndex = selectedIndex >= 0 ? selectedIndex : 0;
    const anchor = nodes[anchorIndex];
    const targetDepth = asChild
      ? anchor.depth + 1
      : Math.max(1, anchor.depth);
    const [, subtreeEnd] = getMindmapSubtreeRange(nodes, anchorIndex);
    const insertAt = asChild ? anchorIndex + 1 : subtreeEnd + 1;

    const newNode: MindmapNodeData = {
      id,
      depth: targetDepth,
      label,
      shape: targetDepth === 1 ? 'rounded' : 'default',
    };

    const nextNodes = normalizeMindmapNodes([
      ...nodes.slice(0, insertAt),
      newNode,
      ...nodes.slice(insertAt),
    ]);
    onChange({ ...mindmapData, nodes: nextNodes });
    onSelectNode(id);
  };

  const handleDeleteSelected = (): void => {
    if (selectedIndex <= 0) {
      return;
    }
    const [start, end] = getMindmapSubtreeRange(nodes, selectedIndex);
    const nextNodes = normalizeMindmapNodes([
      ...nodes.slice(0, start),
      ...nodes.slice(end + 1),
    ]);
    onChange({ ...mindmapData, nodes: nextNodes });
    onSelectNode(
      nextNodes[Math.min(start, nextNodes.length - 1)]?.id ?? null
    );
  };

  // Compute level-1 branch index for coloring each subtree
  let currentBranch = -1;
  const nodeBranchColors = nodes.map((node) => {
    if (node.depth === 0) {
      return '#1e293b';
    }
    if (node.depth === 1) {
      currentBranch += 1;
    }
    return BRANCH_COLORS[Math.max(0, currentBranch) % BRANCH_COLORS.length];
  });

  return (
    <div className="mindmap-canvas-container">
      <div className="mindmap-canvas-toolbar">
        <button
          type="button"
          className="btn-secondary btn-xs"
          onClick={() => insertTopic(true)}
        >
          <Plus size={14} />
          <span>{t.inspector.mindmap.addChildBtn}</span>
        </button>
        <button
          type="button"
          className="btn-secondary btn-xs"
          disabled={selectedIndex <= 0}
          onClick={() => insertTopic(false)}
        >
          <Plus size={14} />
          <span>{t.inspector.mindmap.addSiblingBtn}</span>
        </button>
        <div className="mindmap-toolbar-divider" />
        <button
          type="button"
          className="btn-secondary btn-xs"
          disabled={!canIndent}
          title={t.inspector.mindmap.indentBtn}
          onClick={() =>
            onChange({
              ...mindmapData,
              nodes: indentMindmapNode(nodes, selectedIndex),
            })
          }
        >
          <Indent size={14} />
          <span>{t.inspector.mindmap.indentBtn}</span>
        </button>
        <button
          type="button"
          className="btn-secondary btn-xs"
          disabled={!canOutdent}
          title={t.inspector.mindmap.outdentBtn}
          onClick={() =>
            onChange({
              ...mindmapData,
              nodes: outdentMindmapNode(nodes, selectedIndex),
            })
          }
        >
          <Outdent size={14} />
          <span>{t.inspector.mindmap.outdentBtn}</span>
        </button>
        <button
          type="button"
          className="btn-secondary btn-xs"
          disabled={!canMoveUp}
          title={t.inspector.mindmap.moveUpBtn}
          onClick={() =>
            onChange({
              ...mindmapData,
              nodes: moveMindmapNode(nodes, selectedIndex, -1),
            })
          }
        >
          <ArrowUp size={14} />
        </button>
        <button
          type="button"
          className="btn-secondary btn-xs"
          disabled={!canMoveDown}
          title={t.inspector.mindmap.moveDownBtn}
          onClick={() =>
            onChange({
              ...mindmapData,
              nodes: moveMindmapNode(nodes, selectedIndex, 1),
            })
          }
        >
          <ArrowDown size={14} />
        </button>
        <button
          type="button"
          className="btn-danger-outline btn-xs"
          disabled={!selectedNode || selectedIndex <= 0}
          title={t.inspector.mindmap.deleteNodeBtn}
          onClick={handleDeleteSelected}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="mindmap-tree-list">
        {nodes.map((node, index) => {
          const isSelected = node.id === selectedNodeId;
          const isRoot = index === 0;
          const color = nodeBranchColors[index];

          return (
            <button
              key={node.id}
              type="button"
              className={`mindmap-tree-row ${isRoot ? 'is-root' : ''} ${
                isSelected ? 'is-selected' : ''
              }`}
              style={{ paddingLeft: `${12 + node.depth * 22}px` }}
              onClick={() => onSelectNode(node.id)}
            >
              <span
                className="mindmap-branch-dot"
                style={{ backgroundColor: color }}
              />
              <span className="mindmap-shape-badge">
                {SHAPE_BADGE[node.shape]}
              </span>
              <span className="mindmap-row-label">{node.label}</span>
              {isRoot && (
                <span className="mindmap-root-tag">
                  {t.inspector.mindmap.rootBadge}
                </span>
              )}
              {node.icon && (
                <span className="mindmap-meta-tag">
                  <Sparkles size={11} />
                  <span>{node.icon}</span>
                </span>
              )}
              {node.cssClass && (
                <span className="mindmap-class-tag">.{node.cssClass}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
