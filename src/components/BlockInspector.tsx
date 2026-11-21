import { useEffect, useState } from 'react';
import { ArrowLeftRight, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import {
  InspectorCollapsibleSection,
  STROKE_COLOR_PALETTE_ITEMS,
} from './InspectorCollapsibleSection';
import {
  CommitIdInput,
  InspectorBulkControls,
  InspectorColorPalette,
  InspectorCommentsSection,
} from './InspectorCommon';
import {
  FORBIDDEN_BLOCK_ID_CHARS_REGEX,
  FORBIDDEN_BLOCK_TEXT_CHARS_REGEX,
} from '../utils/inputSafeguard';
import {
  BLOCK_ARROW_DIRECTIONS,
  BLOCK_EDGE_LINE_TYPES,
  BLOCK_SHAPE_OPTIONS,
  sanitizeBlockId,
} from '../utils/blockConverter';
import type {
  BlockArrowDirection,
  BlockDiagramData,
  BlockEdgeData,
  BlockEdgeLineType,
  BlockItemData,
  BlockItemKind,
  BlockNodeShape,
} from '../types/editor';

export interface BlockInspectorProps {
  blockData: BlockDiagramData;
  selectedItemId: string | null;
  onChange: (next: BlockDiagramData) => void;
  onSelectItem: (itemId: string | null) => void;
}

type BlockSectionKey = 'item' | 'edges' | 'settings' | 'comments';

const ITEM_KINDS: BlockItemKind[] = ['node', 'group', 'arrow', 'space'];

export default function BlockInspector({
  blockData,
  selectedItemId,
  onChange,
  onSelectItem,
}: BlockInspectorProps) {
  const { t } = useI18n();
  const blk = t.inspector.blockDiagram;
  const safeguard = t.inspector.safeguard;

  const selectedIndex = blockData.items.findIndex(
    (i) => i.id === selectedItemId
  );
  const selectedItem =
    selectedIndex >= 0 ? blockData.items[selectedIndex] : null;

  const [openSections, setOpenSections] = useState<
    Record<BlockSectionKey, boolean>
  >({
    item: true,
    edges: true,
    settings: false,
    comments: false,
  });

  useEffect(() => {
    if (selectedItemId) {
      setOpenSections((prev) => (prev.item ? prev : { ...prev, item: true }));
    }
  }, [selectedItemId]);

  const toggleSection = (key: BlockSectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSections = (open: boolean): void => {
    setOpenSections({ item: open, edges: open, settings: open, comments: open });
  };

  const allExpanded = Object.values(openSections).every(Boolean);

  const groups = blockData.items.filter((i) => i.kind === 'group');
  const connectableItems = blockData.items.filter((i) => i.kind !== 'space');

  const updateSelectedItem = (patch: Partial<BlockItemData>): void => {
    if (!selectedItem) return;
    onChange({
      ...blockData,
      items: blockData.items.map((item) =>
        item.id === selectedItem.id ? { ...item, ...patch } : item
      ),
    });
  };

  const commitIdRename = (rawNext: string): string => {
    if (!selectedItem) return '';
    const candidate = sanitizeBlockId(rawNext, selectedItem.id);
    if (candidate === selectedItem.id) {
      return selectedItem.id;
    }
    const existing = new Set(
      blockData.items
        .filter((i) => i.id !== selectedItem.id)
        .map((i) => i.id)
    );
    let unique = candidate;
    let suffix = 2;
    while (existing.has(unique)) {
      unique = `${candidate}_${suffix++}`;
    }
    const oldId = selectedItem.id;
    onChange({
      ...blockData,
      items: blockData.items.map((item) => {
        if (item.id === oldId) {
          return { ...item, id: unique };
        }
        if (item.parentGroupId === oldId) {
          return { ...item, parentGroupId: unique };
        }
        return item;
      }),
      edges: blockData.edges.map((edge) => ({
        ...edge,
        from: edge.from === oldId ? unique : edge.from,
        to: edge.to === oldId ? unique : edge.to,
      })),
    });
    onSelectItem(unique);
    return unique;
  };

  const handleDeleteSelected = (): void => {
    if (!selectedItem) return;
    const nextItems = blockData.items
      .filter((i) => i.id !== selectedItem.id)
      .map((i) =>
        i.parentGroupId === selectedItem.id
          ? { ...i, parentGroupId: undefined }
          : i
      );
    const nextEdges = blockData.edges.filter(
      (e) => e.from !== selectedItem.id && e.to !== selectedItem.id
    );
    onChange({
      ...blockData,
      items: nextItems,
      edges: nextEdges,
    });
    onSelectItem(
      nextItems[Math.min(selectedIndex, nextItems.length - 1)]?.id ?? null
    );
  };

  const handleAddEdge = (): void => {
    if (connectableItems.length < 2) return;
    const used = new Set(blockData.edges.map((e) => e.id));
    let num = blockData.edges.length + 1;
    while (used.has(`bedge_${num}`)) {
      num++;
    }
    const newEdge: BlockEdgeData = {
      id: `bedge_${num}`,
      from: connectableItems[0].id,
      to: connectableItems[1].id,
      lineType: 'arrow',
    };
    onChange({
      ...blockData,
      edges: [...blockData.edges, newEdge],
    });
  };

  const updateEdge = (
    edgeId: string,
    patch: Partial<BlockEdgeData>
  ): void => {
    onChange({
      ...blockData,
      edges: blockData.edges.map((e) =>
        e.id === edgeId ? { ...e, ...patch } : e
      ),
    });
  };

  const deleteEdge = (edgeId: string): void => {
    onChange({
      ...blockData,
      edges: blockData.edges.filter((e) => e.id !== edgeId),
    });
  };

  return (
    <div className="inspector-panel">
      <InspectorBulkControls allExpanded={allExpanded} onSetAll={setAllSections} />

      <InspectorCollapsibleSection
        title={blk.itemSection}
        badgeText={blockData.items.length}
        isOpen={openSections.item}
        onToggle={() => toggleSection('item')}
      >
        {selectedItem ? (
          <>
            <label className="inspector-field">
              <span>{blk.itemKindField}</span>
              <select
                value={selectedItem.kind}
                onChange={(e) => {
                  const nextKind = e.target.value as BlockItemKind;
                  const patch: Partial<BlockItemData> = { kind: nextKind };
                  if (nextKind === 'group') {
                    patch.parentGroupId = undefined;
                    patch.groupColumns = selectedItem.groupColumns ?? 2;
                  }
                  if (nextKind === 'node' && !selectedItem.shape) {
                    patch.shape = 'square';
                  }
                  if (nextKind === 'arrow' && !selectedItem.arrowDirection) {
                    patch.arrowDirection = 'right';
                  }
                  updateSelectedItem(patch);
                }}
              >
                {ITEM_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {blk.itemKinds[k]}
                  </option>
                ))}
              </select>
            </label>

            {selectedItem.kind !== 'space' && (
              <CommitIdInput
                label={blk.itemIdField}
                value={selectedItem.id}
                forbiddenRegex={FORBIDDEN_BLOCK_ID_CHARS_REGEX}
                formatError={safeguard.blockIdErrorChars}
                onCommit={commitIdRename}
              />
            )}

            {selectedItem.kind !== 'space' && selectedItem.kind !== 'group' && (
              <label className="inspector-field">
                <span>{blk.itemLabelField}</span>
                <GuardedInput
                  value={selectedItem.label ?? ''}
                  placeholder={blk.itemLabelPlaceholder}
                  forbiddenRegex={FORBIDDEN_BLOCK_TEXT_CHARS_REGEX}
                  formatError={safeguard.blockTextErrorChars}
                  onChangeValue={(label) => updateSelectedItem({ label })}
                />
              </label>
            )}

            {selectedItem.kind === 'node' && (
              <label className="inspector-field">
                <span>{blk.itemShapeField}</span>
                <select
                  value={selectedItem.shape ?? 'square'}
                  onChange={(e) =>
                    updateSelectedItem({
                      shape: e.target.value as BlockNodeShape,
                    })
                  }
                >
                  {BLOCK_SHAPE_OPTIONS.map((shape) => (
                    <option key={shape} value={shape}>
                      {blk.itemShapes[shape]}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {selectedItem.kind === 'arrow' && (
              <label className="inspector-field">
                <span>{blk.arrowDirField}</span>
                <select
                  value={selectedItem.arrowDirection ?? 'right'}
                  onChange={(e) =>
                    updateSelectedItem({
                      arrowDirection: e.target.value as BlockArrowDirection,
                    })
                  }
                >
                  {BLOCK_ARROW_DIRECTIONS.map((dir) => (
                    <option key={dir} value={dir}>
                      {blk.arrowDirs[dir]}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="inspector-field">
              <span>{blk.itemSpanField}</span>
              <input
                type="number"
                min={1}
                max={12}
                value={selectedItem.span ?? 1}
                onChange={(e) => {
                  const parsed = Number.parseInt(e.target.value, 10);
                  if (!Number.isNaN(parsed)) {
                    updateSelectedItem({
                      span: Math.max(1, Math.min(12, parsed)),
                    });
                  }
                }}
              />
            </label>

            {selectedItem.kind === 'group' && (
              <label className="inspector-field">
                <span>{blk.groupColumnsField}</span>
                <select
                  value={String(selectedItem.groupColumns ?? 2)}
                  onChange={(e) =>
                    updateSelectedItem({
                      groupColumns: Number.parseInt(e.target.value, 10),
                    })
                  }
                >
                  <option value="0">{blk.columnsAutoOption}</option>
                  {[1, 2, 3, 4, 5, 6, 8, 12].map((n) => (
                    <option key={n} value={String(n)}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {selectedItem.kind !== 'group' && groups.length > 0 && (
              <label className="inspector-field">
                <span>{blk.parentGroupField}</span>
                <select
                  value={selectedItem.parentGroupId ?? ''}
                  onChange={(e) =>
                    updateSelectedItem({
                      parentGroupId: e.target.value || undefined,
                    })
                  }
                >
                  <option value="">{blk.rootScopeOption}</option>
                  {groups.map((grp) => (
                    <option key={grp.id} value={grp.id}>
                      {grp.id}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {selectedItem.kind !== 'space' && (
              <>
                <InspectorColorPalette
                  label={blk.fillColorField}
                  value={selectedItem.fill}
                  clearTitle={blk.noColorOption}
                  onChange={(fill) => updateSelectedItem({ fill })}
                />

                <InspectorColorPalette
                  label={blk.strokeColorField}
                  value={selectedItem.stroke}
                  items={STROKE_COLOR_PALETTE_ITEMS}
                  allowClear={false}
                  labelMap={t.inspector.strokeColors}
                  onChange={(stroke) => updateSelectedItem({ stroke })}
                />
              </>
            )}

            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleDeleteSelected}
            >
              <Trash2 size={14} />
              <span>{blk.deleteItemBtn}</span>
            </button>
          </>
        ) : (
          <p className="inspector-hint">{blk.selectItemPrompt}</p>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={blk.edgesSection}
        badgeText={blockData.edges.length}
        isOpen={openSections.edges}
        onToggle={() => toggleSection('edges')}
        headerAction={
          <button
            type="button"
            className="btn-secondary btn-xs"
            disabled={connectableItems.length < 2}
            onClick={handleAddEdge}
          >
            <Plus size={12} />
            <span>{blk.addEdgeBtn}</span>
          </button>
        }
      >
        {blockData.edges.length === 0 ? (
          <p className="inspector-hint">{blk.emptyEdges}</p>
        ) : (
          <div className="block-edges-list">
            {blockData.edges.map((edge) => (
              <div key={edge.id} className="block-edge-edit-card">
                <div className="block-edge-endpoints-row">
                  <select
                    aria-label={blk.edgeFromField}
                    value={edge.from}
                    onChange={(e) =>
                      updateEdge(edge.id, { from: e.target.value })
                    }
                  >
                    {connectableItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.id}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="treeview-action-btn"
                    title={blk.swapEndpointsBtn}
                    onClick={() =>
                      updateEdge(edge.id, { from: edge.to, to: edge.from })
                    }
                  >
                    <ArrowLeftRight size={12} />
                  </button>
                  <select
                    aria-label={blk.edgeToField}
                    value={edge.to}
                    onChange={(e) =>
                      updateEdge(edge.id, { to: e.target.value })
                    }
                  >
                    {connectableItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.id}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="treeview-action-btn is-danger"
                    title={blk.deleteEdgeTitle}
                    onClick={() => deleteEdge(edge.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                <div className="block-edge-meta-row">
                  <select
                    aria-label={blk.edgeLineTypeField}
                    value={edge.lineType}
                    onChange={(e) =>
                      updateEdge(edge.id, {
                        lineType: e.target.value as BlockEdgeLineType,
                      })
                    }
                  >
                    {BLOCK_EDGE_LINE_TYPES.map((lt) => (
                      <option key={lt} value={lt}>
                        {blk.edgeLineTypes[lt]}
                      </option>
                    ))}
                  </select>
                  <GuardedInput
                    ariaLabel={blk.edgeLabelField}
                    value={edge.label ?? ''}
                    placeholder={blk.edgeLabelPlaceholder}
                    forbiddenRegex={FORBIDDEN_BLOCK_TEXT_CHARS_REGEX}
                    formatError={safeguard.blockTextErrorChars}
                    onChangeValue={(val) =>
                      updateEdge(edge.id, { label: val || undefined })
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={blk.settingsSection}
        isOpen={openSections.settings}
        onToggle={() => toggleSection('settings')}
      >
        <label className="inspector-field">
          <span>{blk.columnsField}</span>
          <select
            value={String(blockData.columns)}
            onChange={(e) =>
              onChange({
                ...blockData,
                columns: Number.parseInt(e.target.value, 10),
              })
            }
          >
            <option value="0">{blk.columnsAutoOption}</option>
            {[1, 2, 3, 4, 5, 6, 8, 12].map((n) => (
              <option key={n} value={String(n)}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </InspectorCollapsibleSection>

      <InspectorCommentsSection
        title={blk.commentsSection}
        fieldLabel={blk.commentsField}
        placeholder={blk.commentsPlaceholder}
        comments={blockData.comments}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
        onChangeComments={(nextComments) =>
          onChange({
            ...blockData,
            comments: nextComments,
          })
        }
      />
    </div>
  );
}
