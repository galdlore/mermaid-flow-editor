import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Box,
  FolderOpen,
  Plus,
  Space,
  Trash2,
} from 'lucide-react';
import { useI18n } from '../i18n';
import type {
  BlockDiagramData,
  BlockItemData,
  BlockItemKind,
} from '../types/editor';

export interface BlockCanvasProps {
  blockData: BlockDiagramData;
  selectedItemId: string | null;
  onChange: (next: BlockDiagramData) => void;
  onSelectItem: (itemId: string | null) => void;
}

function nextItemId(items: BlockItemData[], prefix: string): string {
  const used = new Set(items.map((i) => i.id));
  let num = items.length + 1;
  while (used.has(`${prefix}_${num}`)) {
    num++;
  }
  return `${prefix}_${num}`;
}

export default function BlockCanvas({
  blockData,
  selectedItemId,
  onChange,
  onSelectItem,
}: BlockCanvasProps) {
  const { t } = useI18n();
  const blk = t.inspector.blockDiagram;

  const gridCols = blockData.columns > 0 ? blockData.columns : 3;

  const handleAddItem = (
    kind: BlockItemKind,
    parentGroupId?: string
  ): void => {
    const prefix =
      kind === 'group'
        ? 'grp'
        : kind === 'arrow'
          ? 'arr'
          : kind === 'space'
            ? 'spc'
            : 'blk';
    const id = nextItemId(blockData.items, prefix);
    const num = blockData.items.length + 1;

    let item: BlockItemData;
    if (kind === 'space') {
      item = {
        id,
        kind: 'space',
        span: 1,
        ...(parentGroupId ? { parentGroupId } : {}),
      };
    } else if (kind === 'arrow') {
      item = {
        id,
        kind: 'arrow',
        label: blk.defaultArrowLabel,
        arrowDirection: 'right',
        span: 1,
        ...(parentGroupId ? { parentGroupId } : {}),
      };
    } else if (kind === 'group') {
      item = {
        id,
        kind: 'group',
        label: blk.defaultGroupLabel(num),
        span: Math.min(2, gridCols),
        groupColumns: 2,
      };
    } else {
      item = {
        id,
        kind: 'node',
        label: blk.defaultNodeLabel(num),
        shape: 'square',
        span: 1,
        ...(parentGroupId ? { parentGroupId } : {}),
      };
    }

    onChange({
      ...blockData,
      items: [...blockData.items, item],
    });
    onSelectItem(id);
  };

  const handleMoveItem = (itemId: string, delta: -1 | 1): void => {
    const idx = blockData.items.findIndex((i) => i.id === itemId);
    if (idx < 0) return;
    const target = idx + delta;
    if (target < 0 || target >= blockData.items.length) return;
    const next = [...blockData.items];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    onChange({ ...blockData, items: next });
  };

  const handleDeleteItem = (itemId: string): void => {
    const idx = blockData.items.findIndex((i) => i.id === itemId);
    const nextItems = blockData.items
      .filter((i) => i.id !== itemId)
      .map((i) =>
        i.parentGroupId === itemId ? { ...i, parentGroupId: undefined } : i
      );
    const nextEdges = blockData.edges.filter(
      (e) => e.from !== itemId && e.to !== itemId
    );
    onChange({
      ...blockData,
      items: nextItems,
      edges: nextEdges,
    });
    if (selectedItemId === itemId) {
      onSelectItem(nextItems[Math.min(idx, nextItems.length - 1)]?.id ?? null);
    }
  };

  const topLevelItems = blockData.items.filter((i) => !i.parentGroupId);

  const renderItemCard = (item: BlockItemData, colMax: number) => {
    const isSelected = item.id === selectedItemId;
    const globalIdx = blockData.items.findIndex((i) => i.id === item.id);
    const span = Math.min(Math.max(1, item.span ?? 1), colMax);

    if (item.kind === 'group') {
      const children = blockData.items.filter(
        (c) => c.parentGroupId === item.id && c.kind !== 'group'
      );
      const innerCols =
        item.groupColumns && item.groupColumns > 0 ? item.groupColumns : 2;
      return (
        <div
          key={item.id}
          className={`block-group-card ${isSelected ? 'is-selected' : ''}`}
          style={{
            gridColumn: `span ${span}`,
            ...(item.fill ? { backgroundColor: item.fill } : {}),
            ...(item.stroke ? { borderColor: item.stroke } : {}),
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelectItem(item.id);
          }}
        >
          <div className="block-card-header">
            <span className="block-id-pill">
              <FolderOpen size={11} />
              <span>{item.id}</span>
            </span>
            <span className="block-span-pill">{blk.spanBadge(item.span ?? 1)}</span>
            <div
              className="block-card-actions"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="treeview-action-btn"
                title={blk.addChildNodeBtn}
                onClick={() => handleAddItem('node', item.id)}
              >
                <Plus size={11} />
              </button>
              <button
                type="button"
                className="treeview-action-btn"
                title={blk.moveUpTitle}
                disabled={globalIdx <= 0}
                onClick={() => handleMoveItem(item.id, -1)}
              >
                <ArrowUp size={11} />
              </button>
              <button
                type="button"
                className="treeview-action-btn"
                title={blk.moveDownTitle}
                disabled={globalIdx >= blockData.items.length - 1}
                onClick={() => handleMoveItem(item.id, 1)}
              >
                <ArrowDown size={11} />
              </button>
              <button
                type="button"
                className="treeview-action-btn is-danger"
                title={blk.deleteItemBtn}
                onClick={() => handleDeleteItem(item.id)}
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>

          <div
            className="block-group-inner-grid"
            style={{
              gridTemplateColumns: `repeat(${innerCols}, minmax(0, 1fr))`,
            }}
          >
            {children.length === 0 ? (
              <div
                className="block-group-empty"
                style={{ gridColumn: `span ${innerCols}` }}
              >
                {blk.emptyGroupChildren}
              </div>
            ) : (
              children.map((child) => renderItemCard(child, innerCols))
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        key={item.id}
        className={`block-item-card is-${item.kind} ${
          isSelected ? 'is-selected' : ''
        }`}
        style={{
          gridColumn: `span ${span}`,
          ...(item.fill ? { backgroundColor: item.fill } : {}),
          ...(item.stroke ? { borderColor: item.stroke } : {}),
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelectItem(item.id);
        }}
      >
        <div className="block-card-header">
          <span className="block-id-pill">
            {item.kind === 'space' ? (
              <Space size={11} />
            ) : item.kind === 'arrow' ? (
              <ArrowRight size={11} />
            ) : (
              <Box size={11} />
            )}
            <span>{item.kind === 'space' ? 'space' : item.id}</span>
          </span>
          <span className="block-span-pill">{blk.spanBadge(item.span ?? 1)}</span>
          <div
            className="block-card-actions"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="treeview-action-btn"
              title={blk.moveUpTitle}
              disabled={globalIdx <= 0}
              onClick={() => handleMoveItem(item.id, -1)}
            >
              <ArrowUp size={11} />
            </button>
            <button
              type="button"
              className="treeview-action-btn"
              title={blk.moveDownTitle}
              disabled={globalIdx >= blockData.items.length - 1}
              onClick={() => handleMoveItem(item.id, 1)}
            >
              <ArrowDown size={11} />
            </button>
            <button
              type="button"
              className="treeview-action-btn is-danger"
              title={blk.deleteItemBtn}
              onClick={() => handleDeleteItem(item.id)}
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>
        <div className="block-card-body">
          {item.kind === 'space' ? (
            <span className="block-space-text">space:{item.span ?? 1}</span>
          ) : item.kind === 'arrow' ? (
            <span className="block-arrow-text">
              {item.label} ({item.arrowDirection ?? 'right'})
            </span>
          ) : (
            <>
              <span className="block-card-label">{item.label || item.id}</span>
              <span className="block-shape-badge">
                {blk.itemShapes[item.shape ?? 'square']}
              </span>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="block-canvas">
      <div className="block-toolbar">
        <button
          type="button"
          className="btn-secondary btn-xs"
          onClick={() => handleAddItem('node')}
        >
          <Plus size={13} />
          <span>{blk.addNodeBtn}</span>
        </button>
        <button
          type="button"
          className="btn-secondary btn-xs"
          onClick={() => handleAddItem('group')}
        >
          <FolderOpen size={13} />
          <span>{blk.addGroupBtn}</span>
        </button>
        <button
          type="button"
          className="btn-secondary btn-xs"
          onClick={() => handleAddItem('arrow')}
        >
          <ArrowRight size={13} />
          <span>{blk.addArrowBtn}</span>
        </button>
        <button
          type="button"
          className="btn-secondary btn-xs"
          onClick={() => handleAddItem('space')}
        >
          <Space size={13} />
          <span>{blk.addSpaceBtn}</span>
        </button>
        <span className="block-cols-badge">
          {blockData.columns > 0
            ? `columns ${blockData.columns}`
            : blk.columnsAutoOption}
        </span>
      </div>

      <div className="block-canvas-scroll">
        {topLevelItems.length === 0 ? (
          <div className="block-empty-state">{blk.emptyItems}</div>
        ) : (
          <div
            className="block-grid-preview"
            style={{
              gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
            }}
          >
            {topLevelItems.map((item) => renderItemCard(item, gridCols))}
          </div>
        )}

        {blockData.edges.length > 0 && (
          <div className="block-edges-strip">
            <span className="block-edges-strip-title">
              {blk.edgesSection} ({blockData.edges.length})
            </span>
            <div className="block-edges-chips">
              {blockData.edges.map((edge) => (
                <span key={edge.id} className="block-edge-chip">
                  {edge.from}
                  {' '}
                  {edge.lineType === 'bidirectional'
                    ? '<-->'
                    : edge.lineType === 'dotted'
                      ? '-.->'
                      : edge.lineType === 'thick'
                        ? '==>'
                        : edge.lineType === 'line'
                          ? '---'
                          : '-->'}
                  {' '}
                  {edge.to}
                  {edge.label ? ` (${edge.label})` : ''}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
