import {
  ArrowDown,
  ArrowUp,
  Indent,
  Outdent,
  Plus,
  Target,
  Trash2,
} from 'lucide-react';
import { useI18n } from '../i18n';
import type { IshikawaDiagramData, IshikawaNodeData } from '../types/editor';
import {
  addChildIshikawaNode,
  canIndentIshikawaNode,
  canMoveIshikawaNode,
  canOutdentIshikawaNode,
  deleteIshikawaSubtree,
  getIshikawaSubtreeRange,
  indentIshikawaNode,
  moveIshikawaNode,
  outdentIshikawaNode,
} from '../utils/ishikawaConverter';

export interface IshikawaCanvasProps {
  ishikawaData: IshikawaDiagramData;
  selectedNodeId: string | null;
  onChange: (next: IshikawaDiagramData) => void;
  onSelectNode: (nodeId: string | null) => void;
}

const BONE_COLORS = [
  '#2563eb',
  '#16a34a',
  '#d97706',
  '#9333ea',
  '#0891b2',
  '#db2777',
];

interface MajorBoneGroup {
  majorIndex: number;
  majorNode: IshikawaNodeData;
  descendants: Array<{ node: IshikawaNodeData; globalIndex: number }>;
  color: string;
}

export default function IshikawaCanvas({
  ishikawaData,
  selectedNodeId,
  onChange,
  onSelectNode,
}: IshikawaCanvasProps) {
  const { t } = useI18n();
  const ish = t.inspector.ishikawa;

  const nodes = ishikawaData.nodes;
  const rootNode = nodes[0] ?? null;
  const selectedIndex = nodes.findIndex((n) => n.id === selectedNodeId);

  const canIndent =
    selectedIndex > 0 && canIndentIshikawaNode(nodes, selectedIndex);
  const canOutdent =
    selectedIndex > 0 && canOutdentIshikawaNode(nodes, selectedIndex);
  const canMoveUp =
    selectedIndex > 0 && canMoveIshikawaNode(nodes, selectedIndex, -1);
  const canMoveDown =
    selectedIndex > 0 && canMoveIshikawaNode(nodes, selectedIndex, 1);

  const handleAddMajorCause = (): void => {
    const label = ish.defaultCauseLabel(nodes.length);
    const { nodes: nextNodes, createdId } = addChildIshikawaNode(
      nodes,
      0,
      label
    );
    onChange({ ...ishikawaData, nodes: nextNodes });
    onSelectNode(createdId);
  };

  const handleAddSubCause = (parentIdx?: number): void => {
    const anchor = parentIdx ?? (selectedIndex >= 0 ? selectedIndex : 0);
    const label = ish.defaultCauseLabel(nodes.length);
    const { nodes: nextNodes, createdId } = addChildIshikawaNode(
      nodes,
      anchor,
      label
    );
    onChange({ ...ishikawaData, nodes: nextNodes });
    onSelectNode(createdId);
  };

  const handleDelete = (idx: number): void => {
    if (idx <= 0) return;
    const nextNodes = deleteIshikawaSubtree(nodes, idx);
    onChange({ ...ishikawaData, nodes: nextNodes });
    if (nodes[idx]?.id === selectedNodeId) {
      onSelectNode(
        nextNodes[Math.min(idx, nextNodes.length - 1)]?.id ?? null
      );
    }
  };

  // Group depth-1 major bones and split alternating into upper/lower fishbones
  const majorGroups: MajorBoneGroup[] = [];
  for (let i = 1; i < nodes.length; i++) {
    if (nodes[i].depth === 1) {
      const [, end] = getIshikawaSubtreeRange(nodes, i);
      const descendants: Array<{ node: IshikawaNodeData; globalIndex: number }> =
        [];
      for (let j = i + 1; j <= end; j++) {
        descendants.push({ node: nodes[j], globalIndex: j });
      }
      majorGroups.push({
        majorIndex: i,
        majorNode: nodes[i],
        descendants,
        color: BONE_COLORS[majorGroups.length % BONE_COLORS.length],
      });
    }
  }

  const upperBones = majorGroups.filter((_, idx) => idx % 2 === 0);
  const lowerBones = majorGroups.filter((_, idx) => idx % 2 === 1);

  const renderBoneCard = (bone: MajorBoneGroup, position: 'upper' | 'lower') => {
    const isMajorSelected = bone.majorNode.id === selectedNodeId;
    return (
      <div
        key={bone.majorNode.id}
        className={`ishikawa-bone-card is-${position} ${
          isMajorSelected ? 'is-selected' : ''
        }`}
        style={{ borderColor: bone.color }}
        onClick={() => onSelectNode(bone.majorNode.id)}
      >
        <div
          className="ishikawa-bone-header"
          style={{ backgroundColor: `${bone.color}14` }}
        >
          <span
            className="ishikawa-bone-dot"
            style={{ backgroundColor: bone.color }}
          />
          <span className="ishikawa-bone-title">{bone.majorNode.label}</span>
          <div
            className="ishikawa-bone-actions"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="treeview-action-btn"
              title={ish.addSubCauseBtn}
              onClick={() => handleAddSubCause(bone.majorIndex)}
            >
              <Plus size={11} />
            </button>
            <button
              type="button"
              className="treeview-action-btn is-danger"
              title={ish.deleteSubtreeBtn}
              onClick={() => handleDelete(bone.majorIndex)}
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>

        <div className="ishikawa-subcauses-list">
          {bone.descendants.map(({ node, globalIndex }) => {
            const isSubSelected = node.id === selectedNodeId;
            return (
              <div
                key={node.id}
                className={`ishikawa-subcause-row ${
                  isSubSelected ? 'is-selected' : ''
                }`}
                style={{
                  paddingLeft: `${8 + Math.max(0, node.depth - 2) * 14}px`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectNode(node.id);
                }}
              >
                <span className="ishikawa-sub-branch" aria-hidden="true">
                  └
                </span>
                <span className="ishikawa-sub-label">{node.label}</span>
                <button
                  type="button"
                  className="treeview-action-btn is-danger ishikawa-sub-del"
                  title={ish.deleteSubtreeBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(globalIndex);
                  }}
                >
                  <Trash2 size={10} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="ishikawa-canvas">
      <div className="ishikawa-toolbar">
        <button
          type="button"
          className="btn-secondary btn-xs"
          onClick={handleAddMajorCause}
        >
          <Plus size={13} />
          <span>{ish.addMajorCauseBtn}</span>
        </button>
        <button
          type="button"
          className="btn-secondary btn-xs"
          disabled={nodes.length === 0}
          onClick={() => handleAddSubCause()}
        >
          <Plus size={13} />
          <span>{ish.addSubCauseBtn}</span>
        </button>
        <div className="ishikawa-toolbar-divider" />
        <button
          type="button"
          className="btn-secondary btn-xs"
          title={ish.outdentTitle}
          disabled={!canOutdent}
          onClick={() =>
            onChange({
              ...ishikawaData,
              nodes: outdentIshikawaNode(nodes, selectedIndex),
            })
          }
        >
          <Outdent size={13} />
        </button>
        <button
          type="button"
          className="btn-secondary btn-xs"
          title={ish.indentTitle}
          disabled={!canIndent}
          onClick={() =>
            onChange({
              ...ishikawaData,
              nodes: indentIshikawaNode(nodes, selectedIndex),
            })
          }
        >
          <Indent size={13} />
        </button>
        <button
          type="button"
          className="btn-secondary btn-xs"
          title={ish.moveUpTitle}
          disabled={!canMoveUp}
          onClick={() =>
            onChange({
              ...ishikawaData,
              nodes: moveIshikawaNode(nodes, selectedIndex, -1),
            })
          }
        >
          <ArrowUp size={13} />
        </button>
        <button
          type="button"
          className="btn-secondary btn-xs"
          title={ish.moveDownTitle}
          disabled={!canMoveDown}
          onClick={() =>
            onChange({
              ...ishikawaData,
              nodes: moveIshikawaNode(nodes, selectedIndex, 1),
            })
          }
        >
          <ArrowDown size={13} />
        </button>
      </div>

      <div className="ishikawa-canvas-scroll">
        {!rootNode ? (
          <div className="ishikawa-empty-state">{ish.emptyTree}</div>
        ) : (
          <div className="ishikawa-fishbone-layout">
            <div className="ishikawa-bones-area">
              <div className="ishikawa-bones-row is-upper">
                {upperBones.map((bone) => renderBoneCard(bone, 'upper'))}
              </div>

              <div className="ishikawa-spine-bar" aria-hidden="true">
                <div className="ishikawa-spine-line" />
                <div className="ishikawa-spine-arrow" />
              </div>

              <div className="ishikawa-bones-row is-lower">
                {lowerBones.map((bone) => renderBoneCard(bone, 'lower'))}
              </div>
            </div>

            <div
              className={`ishikawa-head-card ${
                rootNode.id === selectedNodeId ? 'is-selected' : ''
              }`}
              onClick={() => onSelectNode(rootNode.id)}
            >
              <span className="ishikawa-head-badge">
                <Target size={12} />
                <span>{ish.effectRoleLabel}</span>
              </span>
              <span className="ishikawa-head-label">{rootNode.label}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
