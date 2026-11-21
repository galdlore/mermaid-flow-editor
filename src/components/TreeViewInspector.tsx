import { useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  FilePlus,
  FolderPlus,
  Trash2,
} from 'lucide-react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import { InspectorCollapsibleSection } from './InspectorCollapsibleSection';
import {
  InspectorBulkControls,
  InspectorCommentsSection,
} from './InspectorCommon';
import { FORBIDDEN_LABEL_CHARS_REGEX } from '../utils/inputSafeguard';
import type {
  TreeViewDiagramData,
  TreeViewIconOption,
  TreeViewNodeData,
  TreeViewNodeType,
} from '../types/editor';
import {
  addChildTreeNode,
  canIndentTreeNode,
  canMoveTreeNodeDown,
  canMoveTreeNodeUp,
  canOutdentTreeNode,
  deleteTreeSubtree,
  indentTreeNode,
  moveTreeNodeDown,
  moveTreeNodeUp,
  outdentTreeNode,
} from '../utils/treeViewConverter';

export interface TreeViewInspectorProps {
  treeData: TreeViewDiagramData;
  selectedNodeId: string | null;
  onChange: (next: TreeViewDiagramData) => void;
  onSelectNode: (nodeId: string | null) => void;
}

type TreeSectionKey = 'item' | 'settings' | 'comments';

export default function TreeViewInspector({
  treeData,
  selectedNodeId,
  onChange,
  onSelectNode,
}: TreeViewInspectorProps) {
  const { t } = useI18n();
  const tv = t.inspector.treeView;
  const nodes = treeData.nodes;
  const selectedIndex = nodes.findIndex((n) => n.id === selectedNodeId);
  const selectedNode = selectedIndex >= 0 ? nodes[selectedIndex] : null;

  const [openSections, setOpenSections] = useState<Record<TreeSectionKey, boolean>>({
    item: true,
    settings: true,
    comments: false,
  });

  const toggleSection = (key: TreeSectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSections = (open: boolean): void => {
    setOpenSections({
      item: open,
      settings: open,
      comments: open,
    });
  };

  const allExpanded = Object.values(openSections).every(Boolean);

  const updateSelectedNode = (patch: Partial<TreeViewNodeData>): void => {
    if (!selectedNode) {
      return;
    }
    onChange({
      ...treeData,
      nodes: nodes.map((node) =>
        node.id === selectedNode.id ? { ...node, ...patch } : node
      ),
    });
  };

  const handleAddChild = (parentIndex: number, nodeType: TreeViewNodeType): void => {
    const nextNum = nodes.length + 1;
    const defaultName =
      nodeType === 'directory'
        ? tv.defaultFolderName(nextNum)
        : tv.defaultFileName(nextNum);
    const { nodes: nextNodes, createdId } = addChildTreeNode(
      nodes,
      parentIndex,
      nodeType,
      defaultName
    );
    onChange({ ...treeData, nodes: nextNodes });
    onSelectNode(createdId);
  };

  const handleNumberConfigChange = (
    field: 'rowIndent' | 'lineThickness' | 'paddingX' | 'paddingY',
    rawValue: string,
    min: number,
    max: number
  ): void => {
    const parsed = Number.parseInt(rawValue, 10);
    if (Number.isNaN(parsed)) {
      return;
    }
    const clamped = Math.max(min, Math.min(max, parsed));
    onChange({
      ...treeData,
      config: {
        ...treeData.config,
        [field]: clamped,
      },
    });
  };

  return (
    <div className="mermaid-inspector">
      <InspectorBulkControls allExpanded={allExpanded} onSetAll={setAllSections} />

      {/* 1. 選択中アイテムの編集 */}
      <InspectorCollapsibleSection
        title={tv.selectedItemHeading}
        badgeText={nodes.length}
        isOpen={openSections.item}
        onToggle={() => toggleSection('item')}
      >
        <div className="field-group">
          <label htmlFor="treeview-selected-node">{t.inspector.targetNodeLabel}</label>
          <select
            id="treeview-selected-node"
            value={selectedNode?.id ?? ''}
            onChange={(e) => onSelectNode(e.target.value || null)}
          >
            <option value="">{t.inspector.selectNodePlaceholder}</option>
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {'  '.repeat(node.depth)}
                {node.name}
                {node.nodeType === 'directory' ? '/' : ''}
              </option>
            ))}
          </select>
        </div>

        {selectedNode ? (
          <>
            <div className="field-group">
              <label>{tv.itemNameField}</label>
              <GuardedInput
                ariaLabel={tv.itemNameField}
                value={selectedNode.name}
                forbiddenRegex={FORBIDDEN_LABEL_CHARS_REGEX}
                formatError={t.inspector.safeguard.syntaxErrorChars}
                placeholder={tv.itemNamePlaceholder}
                onChangeValue={(name) => updateSelectedNode({ name })}
              />
            </div>

            <div className="field-row-compact">
              <div className="field-group">
                <label htmlFor="treeview-node-type">{tv.itemTypeField}</label>
                <select
                  id="treeview-node-type"
                  value={selectedNode.nodeType}
                  onChange={(e) =>
                    updateSelectedNode({
                      nodeType: e.target.value as TreeViewNodeType,
                    })
                  }
                >
                  <option value="directory">{tv.itemTypes.directory}</option>
                  <option value="file">{tv.itemTypes.file}</option>
                </select>
              </div>

              <div className="field-group">
                <label htmlFor="treeview-node-icon">{tv.iconField}</label>
                <select
                  id="treeview-node-icon"
                  value={selectedNode.icon ?? 'auto'}
                  onChange={(e) => {
                    const nextIcon = e.target.value as TreeViewIconOption;
                    updateSelectedNode({
                      icon: nextIcon === 'auto' ? undefined : nextIcon,
                    });
                  }}
                >
                  <option value="auto">{tv.iconOptions.auto}</option>
                  <option value="folder">{tv.iconOptions.folder}</option>
                  <option value="file">{tv.iconOptions.file}</option>
                  <option value="none">{tv.iconOptions.none}</option>
                </select>
              </div>
            </div>

            <div className="field-group">
              <label className="checkbox-field-label">
                <input
                  type="checkbox"
                  checked={Boolean(selectedNode.highlight)}
                  onChange={(e) =>
                    updateSelectedNode({
                      highlight: e.target.checked ? true : undefined,
                    })
                  }
                />
                <span>{tv.highlightField}</span>
              </label>
            </div>

            <div className="field-group">
              <label>{tv.descriptionField}</label>
              <GuardedInput
                ariaLabel={tv.descriptionField}
                value={selectedNode.description ?? ''}
                forbiddenRegex={FORBIDDEN_LABEL_CHARS_REGEX}
                formatError={t.inspector.safeguard.syntaxErrorChars}
                placeholder={tv.descriptionPlaceholder}
                onChangeValue={(description) =>
                  updateSelectedNode({
                    description: description || undefined,
                  })
                }
              />
            </div>

            <div className="treeview-inspector-move-row">
              <button
                type="button"
                className="btn-secondary"
                title={tv.outdentTitle}
                disabled={!canOutdentTreeNode(nodes, selectedIndex)}
                onClick={() =>
                  onChange({
                    ...treeData,
                    nodes: outdentTreeNode(nodes, selectedIndex),
                  })
                }
              >
                <ArrowLeft size={14} />
              </button>
              <button
                type="button"
                className="btn-secondary"
                title={tv.indentTitle}
                disabled={!canIndentTreeNode(nodes, selectedIndex)}
                onClick={() =>
                  onChange({
                    ...treeData,
                    nodes: indentTreeNode(nodes, selectedIndex),
                  })
                }
              >
                <ArrowRight size={14} />
              </button>
              <button
                type="button"
                className="btn-secondary"
                title={tv.moveUpTitle}
                disabled={!canMoveTreeNodeUp(nodes, selectedIndex)}
                onClick={() =>
                  onChange({
                    ...treeData,
                    nodes: moveTreeNodeUp(nodes, selectedIndex),
                  })
                }
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                className="btn-secondary"
                title={tv.moveDownTitle}
                disabled={!canMoveTreeNodeDown(nodes, selectedIndex)}
                onClick={() =>
                  onChange({
                    ...treeData,
                    nodes: moveTreeNodeDown(nodes, selectedIndex),
                  })
                }
              >
                <ArrowDown size={14} />
              </button>
            </div>

            <div className="field-row-compact">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleAddChild(selectedIndex, 'directory')}
              >
                <FolderPlus size={14} />
                <span>{tv.addChildFolderBtn}</span>
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleAddChild(selectedIndex, 'file')}
              >
                <FilePlus size={14} />
                <span>{tv.addChildFileBtn}</span>
              </button>
            </div>

            <button
              type="button"
              className="btn-danger-outline"
              onClick={() => {
                const nextNodes = deleteTreeSubtree(nodes, selectedIndex);
                onChange({ ...treeData, nodes: nextNodes });
                onSelectNode(
                  nextNodes[Math.min(selectedIndex, nextNodes.length - 1)]?.id ?? null
                );
              }}
            >
              <Trash2 size={14} />
              <span>{tv.deleteItemBtn}</span>
            </button>
          </>
        ) : (
          <p className="hint-text">{tv.selectItemHint}</p>
        )}
      </InspectorCollapsibleSection>

      {/* 2. ツリー表示設定 */}
      <InspectorCollapsibleSection
        title={tv.settingsHeading}
        isOpen={openSections.settings}
        onToggle={() => toggleSection('settings')}
      >
        <div className="field-group">
          <label>{tv.titleField}</label>
          <GuardedInput
            ariaLabel={tv.titleField}
            value={treeData.title ?? ''}
            forbiddenRegex={FORBIDDEN_LABEL_CHARS_REGEX}
            formatError={t.inspector.safeguard.syntaxErrorChars}
            placeholder={tv.titlePlaceholder}
            onChangeValue={(title) =>
              onChange({
                ...treeData,
                title: title || undefined,
              })
            }
          />
        </div>

        <div className="field-group">
          <label className="checkbox-field-label">
            <input
              type="checkbox"
              checked={treeData.config.showIcons}
              onChange={(e) =>
                onChange({
                  ...treeData,
                  config: {
                    ...treeData.config,
                    showIcons: e.target.checked,
                  },
                })
              }
            />
            <span>{tv.showIconsField}</span>
          </label>
        </div>

        <div className="field-row-compact">
          <div className="field-group">
            <label htmlFor="treeview-row-indent">{tv.rowIndentField}</label>
            <input
              id="treeview-row-indent"
              type="number"
              min={4}
              max={48}
              value={treeData.config.rowIndent}
              onChange={(e) =>
                handleNumberConfigChange('rowIndent', e.target.value, 4, 48)
              }
            />
          </div>

          <div className="field-group">
            <label htmlFor="treeview-line-thickness">{tv.lineThicknessField}</label>
            <input
              id="treeview-line-thickness"
              type="number"
              min={1}
              max={6}
              value={treeData.config.lineThickness}
              onChange={(e) =>
                handleNumberConfigChange('lineThickness', e.target.value, 1, 6)
              }
            />
          </div>
        </div>

        <div className="field-row-compact">
          <div className="field-group">
            <label htmlFor="treeview-padding-x">{tv.paddingXField}</label>
            <input
              id="treeview-padding-x"
              type="number"
              min={1}
              max={24}
              value={treeData.config.paddingX}
              onChange={(e) =>
                handleNumberConfigChange('paddingX', e.target.value, 1, 24)
              }
            />
          </div>

          <div className="field-group">
            <label htmlFor="treeview-padding-y">{tv.paddingYField}</label>
            <input
              id="treeview-padding-y"
              type="number"
              min={1}
              max={24}
              value={treeData.config.paddingY}
              onChange={(e) =>
                handleNumberConfigChange('paddingY', e.target.value, 1, 24)
              }
            />
          </div>
        </div>
      </InspectorCollapsibleSection>

      {/* 3. コメント */}
      <InspectorCommentsSection
        title={t.inspector.commentsHeading}
        placeholder={t.inspector.commentsPlaceholder}
        comments={treeData.comments}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
        onChangeComments={(nextComments) =>
          onChange({
            ...treeData,
            comments: nextComments,
          })
        }
      />
    </div>
  );
}
