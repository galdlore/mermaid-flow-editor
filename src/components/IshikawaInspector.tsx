import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Indent,
  Outdent,
  Plus,
  Trash2,
} from 'lucide-react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import { InspectorCollapsibleSection } from './InspectorCollapsibleSection';
import {
  InspectorBulkControls,
  InspectorCommentsSection,
} from './InspectorCommon';
import { FORBIDDEN_ISHIKAWA_TEXT_CHARS_REGEX } from '../utils/inputSafeguard';
import {
  addChildIshikawaNode,
  canIndentIshikawaNode,
  canMoveIshikawaNode,
  canOutdentIshikawaNode,
  deleteIshikawaSubtree,
  getIshikawaSubtreeRange,
  indentIshikawaNode,
  moveIshikawaNode,
  normalizeIshikawaNodes,
  outdentIshikawaNode,
} from '../utils/ishikawaConverter';
import type { IshikawaDiagramData, IshikawaNodeData } from '../types/editor';

export interface IshikawaInspectorProps {
  ishikawaData: IshikawaDiagramData;
  selectedNodeId: string | null;
  onChange: (next: IshikawaDiagramData) => void;
  onSelectNode: (nodeId: string | null) => void;
}

type IshikawaSectionKey = 'node' | 'comments';

export default function IshikawaInspector({
  ishikawaData,
  selectedNodeId,
  onChange,
  onSelectNode,
}: IshikawaInspectorProps) {
  const { t } = useI18n();
  const ish = t.inspector.ishikawa;
  const safeguard = t.inspector.safeguard;

  const nodes = ishikawaData.nodes;
  const selectedIndex = nodes.findIndex((n) => n.id === selectedNodeId);
  const selectedNode = selectedIndex >= 0 ? nodes[selectedIndex] : null;

  const [openSections, setOpenSections] = useState<
    Record<IshikawaSectionKey, boolean>
  >({
    node: true,
    comments: false,
  });

  useEffect(() => {
    if (selectedNodeId) {
      setOpenSections((prev) => (prev.node ? prev : { ...prev, node: true }));
    }
  }, [selectedNodeId]);

  const toggleSection = (key: IshikawaSectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSections = (open: boolean): void => {
    setOpenSections({ node: open, comments: open });
  };

  const allExpanded = Object.values(openSections).every(Boolean);

  const updateSelectedLabel = (label: string): void => {
    if (!selectedNode) return;
    onChange({
      ...ishikawaData,
      nodes: nodes.map((n) =>
        n.id === selectedNode.id ? { ...n, label } : n
      ),
    });
  };

  const handleAddChild = (): void => {
    const anchor = selectedIndex >= 0 ? selectedIndex : 0;
    const { nodes: nextNodes, createdId } = addChildIshikawaNode(
      nodes,
      anchor,
      ish.defaultCauseLabel(nodes.length)
    );
    onChange({ ...ishikawaData, nodes: nextNodes });
    onSelectNode(createdId);
  };

  const handleAddSibling = (): void => {
    if (!selectedNode || selectedIndex <= 0) {
      handleAddChild();
      return;
    }
    const [, subtreeEnd] = getIshikawaSubtreeRange(nodes, selectedIndex);
    const insertAt = subtreeEnd + 1;
    const createdId = `ish_${Date.now().toString(36)}`;
    const newNode: IshikawaNodeData = {
      id: createdId,
      depth: selectedNode.depth,
      label: ish.defaultCauseLabel(nodes.length),
    };
    const nextNodes = normalizeIshikawaNodes([
      ...nodes.slice(0, insertAt),
      newNode,
      ...nodes.slice(insertAt),
    ]);
    onChange({ ...ishikawaData, nodes: nextNodes });
    onSelectNode(createdId);
  };

  const handleDeleteSubtree = (): void => {
    if (selectedIndex <= 0) return;
    const nextNodes = deleteIshikawaSubtree(nodes, selectedIndex);
    onChange({ ...ishikawaData, nodes: nextNodes });
    onSelectNode(
      nextNodes[Math.min(selectedIndex, nextNodes.length - 1)]?.id ?? null
    );
  };

  const roleLabel =
    selectedNode?.depth === 0
      ? ish.effectRoleLabel
      : selectedNode?.depth === 1
        ? ish.majorRoleLabel
        : ish.subRoleLabel;

  return (
    <div className="inspector-panel">
      <InspectorBulkControls allExpanded={allExpanded} onSetAll={setAllSections} />

      <InspectorCollapsibleSection
        title={ish.nodeSection}
        badgeText={nodes.length}
        isOpen={openSections.node}
        onToggle={() => toggleSection('node')}
      >
        <label className="inspector-field">
          <span>{t.inspector.targetNodeLabel}</span>
          <select
            value={selectedNode?.id ?? ''}
            onChange={(e) => onSelectNode(e.target.value || null)}
          >
            <option value="">{t.inspector.selectNodePlaceholder}</option>
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {'  '.repeat(node.depth)}
                {node.label}
              </option>
            ))}
          </select>
        </label>

        {selectedNode ? (
          <>
            <div className="ishikawa-role-badge">{roleLabel}</div>

            <label className="inspector-field">
              <span>{ish.nodeLabelField}</span>
              <GuardedInput
                value={selectedNode.label}
                placeholder={ish.nodeLabelPlaceholder}
                forbiddenRegex={FORBIDDEN_ISHIKAWA_TEXT_CHARS_REGEX}
                formatError={safeguard.ishikawaTextErrorChars}
                onChangeValue={updateSelectedLabel}
              />
            </label>

            <div className="ishikawa-inspector-btn-row">
              <button
                type="button"
                className="btn-secondary btn-xs"
                onClick={handleAddChild}
              >
                <Plus size={12} />
                <span>{ish.addSubCauseBtn}</span>
              </button>
              {selectedIndex > 0 && (
                <button
                  type="button"
                  className="btn-secondary btn-xs"
                  onClick={handleAddSibling}
                >
                  <Plus size={12} />
                  <span>{ish.addSiblingCauseBtn}</span>
                </button>
              )}
            </div>

            {selectedIndex > 0 && (
              <>
                <div className="ishikawa-inspector-move-grid">
                  <button
                    type="button"
                    className="btn-secondary btn-xs"
                    disabled={!canOutdentIshikawaNode(nodes, selectedIndex)}
                    onClick={() =>
                      onChange({
                        ...ishikawaData,
                        nodes: outdentIshikawaNode(nodes, selectedIndex),
                      })
                    }
                  >
                    <Outdent size={12} />
                    <span>{ish.outdentTitle}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-xs"
                    disabled={!canIndentIshikawaNode(nodes, selectedIndex)}
                    onClick={() =>
                      onChange({
                        ...ishikawaData,
                        nodes: indentIshikawaNode(nodes, selectedIndex),
                      })
                    }
                  >
                    <Indent size={12} />
                    <span>{ish.indentTitle}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-xs"
                    disabled={!canMoveIshikawaNode(nodes, selectedIndex, -1)}
                    onClick={() =>
                      onChange({
                        ...ishikawaData,
                        nodes: moveIshikawaNode(nodes, selectedIndex, -1),
                      })
                    }
                  >
                    <ArrowUp size={12} />
                    <span>{ish.moveUpTitle}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-xs"
                    disabled={!canMoveIshikawaNode(nodes, selectedIndex, 1)}
                    onClick={() =>
                      onChange({
                        ...ishikawaData,
                        nodes: moveIshikawaNode(nodes, selectedIndex, 1),
                      })
                    }
                  >
                    <ArrowDown size={12} />
                    <span>{ish.moveDownTitle}</span>
                  </button>
                </div>

                <button
                  type="button"
                  className="btn-danger-outline"
                  onClick={handleDeleteSubtree}
                >
                  <Trash2 size={14} />
                  <span>{ish.deleteSubtreeBtn}</span>
                </button>
              </>
            )}
          </>
        ) : (
          <p className="inspector-hint">{ish.selectNodePrompt}</p>
        )}
      </InspectorCollapsibleSection>

      <InspectorCommentsSection
        title={ish.commentsSection}
        fieldLabel={ish.commentsField}
        placeholder={ish.commentsPlaceholder}
        comments={ishikawaData.comments}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
        onChangeComments={(nextComments) =>
          onChange({
            ...ishikawaData,
            comments: nextComments,
          })
        }
      />
    </div>
  );
}
