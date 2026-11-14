import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  Highlighter,
  Plus,
  Trash2,
} from 'lucide-react';
import { useI18n } from '../i18n';
import type { TreeViewDiagramData, TreeViewNodeType } from '../types/editor';
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

export interface TreeViewCanvasProps {
  treeData: TreeViewDiagramData;
  selectedNodeId: string | null;
  onChange: (next: TreeViewDiagramData) => void;
  onSelectNode: (nodeId: string | null) => void;
}

export default function TreeViewCanvas({
  treeData,
  selectedNodeId,
  onChange,
  onSelectNode,
}: TreeViewCanvasProps) {
  const { t } = useI18n();
  const tv = t.inspector.treeView;
  const nodes = treeData.nodes;
  const selectedIndex = nodes.findIndex((n) => n.id === selectedNodeId);

  const handleAddRoot = (nodeType: TreeViewNodeType): void => {
    const nextNum = nodes.length + 1;
    const defaultName =
      nodeType === 'directory'
        ? tv.defaultFolderName(nextNum)
        : tv.defaultFileName(nextNum);
    const { nodes: nextNodes, createdId } = addChildTreeNode(
      nodes,
      -1,
      nodeType,
      defaultName
    );
    onChange({ ...treeData, nodes: nextNodes });
    onSelectNode(createdId);
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

  return (
    <div className="treeview-canvas">
      <div className="treeview-toolbar">
        <div className="treeview-toolbar-group">
          <button
            type="button"
            className="btn-secondary treeview-toolbar-btn"
            onClick={() => handleAddRoot('directory')}
          >
            <FolderPlus size={14} />
            <span>{tv.addFolderBtn}</span>
          </button>
          <button
            type="button"
            className="btn-secondary treeview-toolbar-btn"
            onClick={() => handleAddRoot('file')}
          >
            <FilePlus size={14} />
            <span>{tv.addFileBtn}</span>
          </button>
        </div>

        {selectedIndex >= 0 && (
          <div className="treeview-toolbar-group">
            <button
              type="button"
              className="btn-secondary treeview-toolbar-btn"
              onClick={() => handleAddChild(selectedIndex, 'directory')}
            >
              <FolderPlus size={14} />
              <span>{tv.addChildFolderBtn}</span>
            </button>
            <button
              type="button"
              className="btn-secondary treeview-toolbar-btn"
              onClick={() => handleAddChild(selectedIndex, 'file')}
            >
              <FilePlus size={14} />
              <span>{tv.addChildFileBtn}</span>
            </button>
          </div>
        )}
      </div>

      <div className="treeview-canvas-scroll">
        <div className="treeview-root-header">
          <Folder size={15} className="treeview-icon-folder" />
          <span className="treeview-root-name">{tv.rootLabel}</span>
          {treeData.title && (
            <span className="treeview-title-pill">{treeData.title}</span>
          )}
        </div>

        {nodes.length === 0 ? (
          <div className="treeview-empty-state">{tv.emptyTreeHint}</div>
        ) : (
          <div className="treeview-list" role="tree" aria-label={tv.rootLabel}>
            {nodes.map((node, index) => {
              const isSelected = node.id === selectedNodeId;
              const isDir = node.nodeType === 'directory';
              const showVisualIcon =
                node.icon === 'folder' ||
                node.icon === 'file' ||
                (node.icon !== 'none' && treeData.config.showIcons);

              return (
                <div
                  key={node.id}
                  role="treeitem"
                  aria-selected={isSelected}
                  className={`treeview-row ${isSelected ? 'is-selected' : ''} ${
                    node.highlight ? 'is-highlighted' : ''
                  }`}
                  onClick={() => onSelectNode(node.id)}
                >
                  <div className="treeview-row-main">
                    {Array.from({ length: node.depth + 1 }).map((_, depthIdx) => (
                      <span
                        key={depthIdx}
                        className={`treeview-indent-guide ${
                          depthIdx === node.depth ? 'is-branch' : ''
                        }`}
                        aria-hidden="true"
                      />
                    ))}

                    {showVisualIcon && (
                      <span className="treeview-node-icon" aria-hidden="true">
                        {node.icon === 'file' || (!isDir && node.icon !== 'folder') ? (
                          <FileText size={14} className="treeview-icon-file" />
                        ) : (
                          <Folder size={14} className="treeview-icon-folder" />
                        )}
                      </span>
                    )}

                    <span
                      className={`treeview-node-name ${
                        isDir ? 'is-directory' : 'is-file'
                      }`}
                    >
                      {node.name}
                      {isDir ? '/' : ''}
                    </span>

                    {node.highlight && (
                      <span className="treeview-badge-highlight" title=":::highlight">
                        <Highlighter size={11} />
                      </span>
                    )}

                    {node.description && (
                      <span className="treeview-node-desc">## {node.description}</span>
                    )}
                  </div>

                  <div
                    className="treeview-row-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="treeview-action-btn"
                      title={tv.addChildFileBtn}
                      onClick={() => handleAddChild(index, 'file')}
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      type="button"
                      className="treeview-action-btn"
                      title={tv.outdentTitle}
                      disabled={!canOutdentTreeNode(nodes, index)}
                      onClick={() =>
                        onChange({
                          ...treeData,
                          nodes: outdentTreeNode(nodes, index),
                        })
                      }
                    >
                      <ArrowLeft size={12} />
                    </button>
                    <button
                      type="button"
                      className="treeview-action-btn"
                      title={tv.indentTitle}
                      disabled={!canIndentTreeNode(nodes, index)}
                      onClick={() =>
                        onChange({
                          ...treeData,
                          nodes: indentTreeNode(nodes, index),
                        })
                      }
                    >
                      <ArrowRight size={12} />
                    </button>
                    <button
                      type="button"
                      className="treeview-action-btn"
                      title={tv.moveUpTitle}
                      disabled={!canMoveTreeNodeUp(nodes, index)}
                      onClick={() =>
                        onChange({
                          ...treeData,
                          nodes: moveTreeNodeUp(nodes, index),
                        })
                      }
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      className="treeview-action-btn"
                      title={tv.moveDownTitle}
                      disabled={!canMoveTreeNodeDown(nodes, index)}
                      onClick={() =>
                        onChange({
                          ...treeData,
                          nodes: moveTreeNodeDown(nodes, index),
                        })
                      }
                    >
                      <ArrowDown size={12} />
                    </button>
                    <button
                      type="button"
                      className="treeview-action-btn is-danger"
                      title={tv.deleteItemBtn}
                      onClick={() => {
                        const nextNodes = deleteTreeSubtree(nodes, index);
                        onChange({ ...treeData, nodes: nextNodes });
                        if (isSelected) {
                          onSelectNode(
                            nextNodes[Math.min(index, nextNodes.length - 1)]?.id ?? null
                          );
                        }
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
