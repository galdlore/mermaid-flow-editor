import { useMemo } from 'react';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  Box,
  ChevronLeft,
  ChevronRight,
  Component as ComponentIcon,
  Cpu,
  Database,
  Layers,
  MessageSquare,
  Plus,
  Server,
  Trash2,
  User,
} from 'lucide-react';
import { useI18n } from '../i18n';
import type {
  C4BoundaryData,
  C4BoundaryKind,
  C4DiagramData,
  C4ElementData,
  C4ElementKind,
  C4RelationData,
} from '../types/editor';
import {
  createUniqueC4BoundaryId,
  createUniqueC4ElementId,
  createUniqueC4RelationId,
  resolveC4BoundaryMacroName,
  resolveC4ElementMacroName,
} from '../utils/c4Converter';

export interface C4CanvasProps {
  c4Data: C4DiagramData;
  selectedItemId: string | null;
  selectedRelationId: string | null;
  onChange: (next: C4DiagramData) => void;
  onSelectItem: (itemId: string | null) => void;
  onSelectRelation: (relationId: string | null) => void;
}

function renderElementIcon(el: C4ElementData) {
  if (el.kind === 'person') {
    return <User size={13} />;
  }
  if (el.variant === 'db') {
    return <Database size={13} />;
  }
  if (el.variant === 'queue') {
    return <MessageSquare size={13} />;
  }
  if (el.kind === 'component') {
    return <ComponentIcon size={13} />;
  }
  if (el.kind === 'container') {
    return <Box size={13} />;
  }
  return <Cpu size={13} />;
}

function renderBoundaryIcon(kind: C4BoundaryKind) {
  if (kind === 'node') {
    return <Server size={13} />;
  }
  return <Layers size={13} />;
}

function defaultElementKindForSubtype(
  subtype: C4DiagramData['subtype']
): C4ElementKind {
  switch (subtype) {
    case 'C4Component':
      return 'component';
    case 'C4Container':
    case 'C4Dynamic':
    case 'C4Deployment':
      return 'container';
    default:
      return 'system';
  }
}

function defaultBoundaryKindForSubtype(
  subtype: C4DiagramData['subtype']
): C4BoundaryKind {
  switch (subtype) {
    case 'C4Deployment':
      return 'node';
    case 'C4Component':
      return 'container';
    default:
      return 'system';
  }
}

export default function C4Canvas({
  c4Data,
  selectedItemId,
  selectedRelationId,
  onChange,
  onSelectItem,
  onSelectRelation,
}: C4CanvasProps) {
  const { t } = useI18n();
  const c4Text = t.inspector.c4Diagram;

  const elementMap = useMemo(() => {
    const map = new Map<string, C4ElementData>();
    for (const el of c4Data.elements) {
      map.set(el.id, el);
    }
    return map;
  }, [c4Data.elements]);

  const boundaryMap = useMemo(() => {
    const map = new Map<string, C4BoundaryData>();
    for (const b of c4Data.boundaries) {
      map.set(b.id, b);
    }
    return map;
  }, [c4Data.boundaries]);

  const handleAddElement = (targetBoundaryId?: string): void => {
    const kind = defaultElementKindForSubtype(c4Data.subtype);
    const num = c4Data.elements.length + 1;
    const nextId = createUniqueC4ElementId(
      c4Data.elements,
      c4Data.boundaries,
      `${kind}${num}`
    );

    const inferredBoundary =
      targetBoundaryId ??
      (selectedItemId && boundaryMap.has(selectedItemId)
        ? selectedItemId
        : selectedItemId && elementMap.has(selectedItemId)
          ? elementMap.get(selectedItemId)?.boundaryId
          : undefined);

    const created: C4ElementData = {
      id: nextId,
      kind,
      label: c4Text.defaultElementLabel(num),
      ...(kind === 'container' || kind === 'component'
        ? { techn: 'Service' }
        : {}),
      ...(inferredBoundary ? { boundaryId: inferredBoundary } : {}),
    };

    onChange({
      ...c4Data,
      elements: [...c4Data.elements, created],
    });
    onSelectItem(nextId);
  };

  const handleAddBoundary = (targetParentId?: string): void => {
    const kind = defaultBoundaryKindForSubtype(c4Data.subtype);
    const num = c4Data.boundaries.length + 1;
    const nextId = createUniqueC4BoundaryId(
      c4Data.elements,
      c4Data.boundaries,
      `boundary${num}`
    );

    const inferredParent =
      targetParentId ??
      (selectedItemId && boundaryMap.has(selectedItemId)
        ? selectedItemId
        : undefined);

    const created: C4BoundaryData = {
      id: nextId,
      kind,
      label: c4Text.defaultBoundaryLabel(num),
      ...(kind === 'node' ? { boundaryType: 'Server' } : {}),
      ...(inferredParent ? { parentBoundaryId: inferredParent } : {}),
    };

    onChange({
      ...c4Data,
      boundaries: [...c4Data.boundaries, created],
    });
    onSelectItem(nextId);
  };

  const handleMoveElement = (elementId: string, delta: -1 | 1): void => {
    const target = elementMap.get(elementId);
    if (!target) return;
    const siblings = c4Data.elements
      .map((item, index) => ({ item, index }))
      .filter(
        ({ item }) =>
          (item.boundaryId ?? undefined) === (target.boundaryId ?? undefined)
      );
    const pos = siblings.findIndex(({ item }) => item.id === elementId);
    const nextPos = pos + delta;
    if (pos < 0 || nextPos < 0 || nextPos >= siblings.length) return;

    const copy = [...c4Data.elements];
    const fromIdx = siblings[pos].index;
    const toIdx = siblings[nextPos].index;
    const tmp = copy[fromIdx];
    copy[fromIdx] = copy[toIdx];
    copy[toIdx] = tmp;
    onChange({ ...c4Data, elements: copy });
  };

  const handleMoveBoundary = (boundaryId: string, delta: -1 | 1): void => {
    const target = boundaryMap.get(boundaryId);
    if (!target) return;
    const siblings = c4Data.boundaries
      .map((item, index) => ({ item, index }))
      .filter(
        ({ item }) =>
          (item.parentBoundaryId ?? undefined) ===
          (target.parentBoundaryId ?? undefined)
      );
    const pos = siblings.findIndex(({ item }) => item.id === boundaryId);
    const nextPos = pos + delta;
    if (pos < 0 || nextPos < 0 || nextPos >= siblings.length) return;

    const copy = [...c4Data.boundaries];
    const fromIdx = siblings[pos].index;
    const toIdx = siblings[nextPos].index;
    const tmp = copy[fromIdx];
    copy[fromIdx] = copy[toIdx];
    copy[toIdx] = tmp;
    onChange({ ...c4Data, boundaries: copy });
  };

  const handleDeleteElement = (elementId: string): void => {
    const nextElements = c4Data.elements.filter((el) => el.id !== elementId);
    const nextRelations = c4Data.relations.filter(
      (r) => r.from !== elementId && r.to !== elementId
    );
    onChange({
      ...c4Data,
      elements: nextElements,
      relations: nextRelations,
    });
    if (selectedItemId === elementId) {
      onSelectItem(nextElements[0]?.id ?? c4Data.boundaries[0]?.id ?? null);
    }
    if (
      selectedRelationId &&
      !nextRelations.some((r) => r.id === selectedRelationId)
    ) {
      onSelectRelation(nextRelations[0]?.id ?? null);
    }
  };

  const handleDeleteBoundary = (boundaryId: string): void => {
    const deletedBoundary = boundaryMap.get(boundaryId);
    const nextParent = deletedBoundary?.parentBoundaryId;

    // 境界を削除した際は子要素・直下境界を上位スコープ（またはルート）へ移す
    const nextBoundaries = c4Data.boundaries
      .filter((b) => b.id !== boundaryId)
      .map((b) =>
        b.parentBoundaryId === boundaryId
          ? { ...b, parentBoundaryId: nextParent }
          : b
      );
    const nextElements = c4Data.elements.map((el) =>
      el.boundaryId === boundaryId ? { ...el, boundaryId: nextParent } : el
    );

    onChange({
      ...c4Data,
      boundaries: nextBoundaries,
      elements: nextElements,
    });
    if (selectedItemId === boundaryId) {
      onSelectItem(nextElements[0]?.id ?? nextBoundaries[0]?.id ?? null);
    }
  };

  const handleAddRelation = (): void => {
    if (c4Data.elements.length === 0) return;
    const activeEl =
      selectedItemId && elementMap.has(selectedItemId)
        ? elementMap.get(selectedItemId)!
        : c4Data.elements[0];
    const targetEl =
      c4Data.elements.find((el) => el.id !== activeEl.id) ?? c4Data.elements[0];

    const nextId = createUniqueC4RelationId(c4Data.relations);
    const created: C4RelationData = {
      id: nextId,
      relType: c4Data.subtype === 'C4Dynamic' ? 'RelIndex' : 'Rel',
      ...(c4Data.subtype === 'C4Dynamic'
        ? { index: String(c4Data.relations.length + 1) }
        : {}),
      from: activeEl.id,
      to: targetEl.id,
      label: c4Text.defaultRelationLabel,
    };

    onChange({
      ...c4Data,
      relations: [...c4Data.relations, created],
    });
    onSelectRelation(nextId);
  };

  const handleMoveRelation = (relId: string, delta: -1 | 1): void => {
    const idx = c4Data.relations.findIndex((r) => r.id === relId);
    const targetIdx = idx + delta;
    if (idx < 0 || targetIdx < 0 || targetIdx >= c4Data.relations.length) return;
    const copy = [...c4Data.relations];
    const [moved] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, moved);
    onChange({ ...c4Data, relations: copy });
  };

  const handleSwapRelation = (relId: string): void => {
    onChange({
      ...c4Data,
      relations: c4Data.relations.map((r) =>
        r.id === relId ? { ...r, from: r.to, to: r.from } : r
      ),
    });
  };

  const handleDeleteRelation = (relId: string): void => {
    const nextRelations = c4Data.relations.filter((r) => r.id !== relId);
    onChange({ ...c4Data, relations: nextRelations });
    if (selectedRelationId === relId) {
      onSelectRelation(nextRelations[0]?.id ?? null);
    }
  };

  const renderElementCard = (
    el: C4ElementData,
    idx: number,
    siblingTotal: number
  ) => {
    const isSelected = el.id === selectedItemId;
    const macroName = resolveC4ElementMacroName(el);

    return (
      <div
        key={el.id}
        className={`er-entity-card c4-element-card ${
          el.external ? 'is-external' : ''
        } ${isSelected ? 'is-selected' : ''}`}
        onClick={(ev) => {
          ev.stopPropagation();
          onSelectItem(el.id);
        }}
      >
        <div
          className="cls-card-header"
          style={{
            ...(el.bgColor ? { backgroundColor: el.bgColor } : {}),
            ...(el.fontColor ? { color: el.fontColor } : {}),
            ...(el.borderColor ? { borderBottomColor: el.borderColor } : {}),
          }}
        >
          <div className="cls-card-badges">
            <span className={`c4-kind-pill c4-kind-${el.kind}`}>
              {renderElementIcon(el)}
              <span>{macroName}</span>
            </span>
            <div
              className="er-entity-actions cls-header-actions"
              onClick={(ev) => ev.stopPropagation()}
            >
              <button
                type="button"
                className="treeview-action-btn"
                disabled={idx === 0}
                title={c4Text.moveLeftTitle}
                onClick={() => handleMoveElement(el.id, -1)}
              >
                <ChevronLeft size={11} />
              </button>
              <button
                type="button"
                className="treeview-action-btn"
                disabled={idx === siblingTotal - 1}
                title={c4Text.moveRightTitle}
                onClick={() => handleMoveElement(el.id, 1)}
              >
                <ChevronRight size={11} />
              </button>
              <button
                type="button"
                className="treeview-action-btn is-danger"
                title={c4Text.deleteElementBtn}
                onClick={() => handleDeleteElement(el.id)}
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>

          <div className="cls-card-title-row">
            <span className="er-entity-icon">{renderElementIcon(el)}</span>
            <div className="er-entity-title-wrap">
              <span className="er-entity-name">{el.label || el.id}</span>
              <span className="er-entity-id">{el.id}</span>
            </div>
          </div>
        </div>

        {(el.techn || el.descr) && (
          <div className="c4-element-body">
            {el.techn && <span className="c4-techn-pill">[{el.techn}]</span>}
            {el.descr && <p className="c4-element-descr">{el.descr}</p>}
          </div>
        )}
      </div>
    );
  };

  const renderBoundaryCard = (
    b: C4BoundaryData,
    idx: number,
    siblingTotal: number
  ) => {
    const isSelected = b.id === selectedItemId;
    const childElements = c4Data.elements.filter((el) => el.boundaryId === b.id);
    const childBoundaries = c4Data.boundaries.filter(
      (sub) => sub.parentBoundaryId === b.id
    );
    const totalChildren = childElements.length + childBoundaries.length;

    return (
      <div
        key={b.id}
        className={`c4-boundary-card ${isSelected ? 'is-selected' : ''}`}
        onClick={(ev) => {
          ev.stopPropagation();
          onSelectItem(b.id);
        }}
      >
        <div className="c4-boundary-header">
          <div className="cls-card-badges">
            <span className={`c4-boundary-pill c4-bkind-${b.kind}`}>
              {renderBoundaryIcon(b.kind)}
              <span>{resolveC4BoundaryMacroName(b.kind)}</span>
            </span>
            {b.boundaryType && (
              <span className="seq-meta-pill">[{b.boundaryType}]</span>
            )}
            <span className="er-attr-count-badge">
              {c4Text.boundaryCountBadge(totalChildren)}
            </span>
            <div
              className="er-entity-actions cls-header-actions"
              onClick={(ev) => ev.stopPropagation()}
            >
              <button
                type="button"
                className="treeview-action-btn"
                title={c4Text.addElementBtn}
                onClick={() => handleAddElement(b.id)}
              >
                <Plus size={11} />
              </button>
              <button
                type="button"
                className="treeview-action-btn"
                disabled={idx === 0}
                title={c4Text.moveLeftTitle}
                onClick={() => handleMoveBoundary(b.id, -1)}
              >
                <ChevronLeft size={11} />
              </button>
              <button
                type="button"
                className="treeview-action-btn"
                disabled={idx === siblingTotal - 1}
                title={c4Text.moveRightTitle}
                onClick={() => handleMoveBoundary(b.id, 1)}
              >
                <ChevronRight size={11} />
              </button>
              <button
                type="button"
                className="treeview-action-btn is-danger"
                title={c4Text.deleteBoundaryBtn}
                onClick={() => handleDeleteBoundary(b.id)}
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>

          <div className="cls-card-title-row">
            <span className="er-entity-icon">{renderBoundaryIcon(b.kind)}</span>
            <div className="er-entity-title-wrap">
              <span className="er-entity-name">{b.label || b.id}</span>
              <span className="er-entity-id">{b.id}</span>
            </div>
          </div>
          {b.descr && <div className="c4-boundary-descr">{b.descr}</div>}
        </div>

        <div className="c4-boundary-body">
          {totalChildren === 0 ? (
            <div className="er-attr-empty">{c4Text.emptyBoundaryChildren}</div>
          ) : (
            <div className="c4-boundary-contents">
              {childElements.length > 0 && (
                <div className="c4-elements-grid">
                  {childElements.map((el, elIdx) =>
                    renderElementCard(el, elIdx, childElements.length)
                  )}
                </div>
              )}
              {childBoundaries.length > 0 && (
                <div className="c4-boundaries-stack">
                  {childBoundaries.map((sub, subIdx) =>
                    renderBoundaryCard(sub, subIdx, childBoundaries.length)
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const rootElements = c4Data.elements.filter((el) => !el.boundaryId);
  const rootBoundaries = c4Data.boundaries.filter((b) => !b.parentBoundaryId);

  return (
    <div className="er-canvas-container">
      <div className="seq-canvas-toolbar">
        <div className="seq-toolbar-group">
          <button
            type="button"
            className="seq-tool-btn is-primary"
            onClick={() => handleAddElement()}
          >
            <Plus size={14} />
            <span>{c4Text.addElementBtn}</span>
          </button>
          <button
            type="button"
            className="seq-tool-btn"
            onClick={() => handleAddBoundary()}
          >
            <Layers size={14} />
            <span>{c4Text.addBoundaryBtn}</span>
          </button>
          <button
            type="button"
            className="seq-tool-btn"
            disabled={c4Data.elements.length === 0}
            onClick={handleAddRelation}
          >
            <ArrowRight size={14} />
            <span>{c4Text.addRelationBtn}</span>
          </button>
        </div>

        <div className="seq-toolbar-meta">
          <span className="seq-meta-pill">{c4Data.subtype}</span>
          {c4Data.title && (
            <span className="treeview-title-pill">{c4Data.title}</span>
          )}
        </div>
      </div>

      <div className="er-canvas-scroll">
        {c4Data.elements.length === 0 && c4Data.boundaries.length === 0 ? (
          <div className="treeview-empty-state">{c4Text.emptyElements}</div>
        ) : (
          <div className="er-board">
            {rootElements.length > 0 && (
              <div className="c4-root-section">
                <div className="c4-scope-label">{c4Text.rootScopeLabel}</div>
                <div className="c4-elements-grid">
                  {rootElements.map((el, idx) =>
                    renderElementCard(el, idx, rootElements.length)
                  )}
                </div>
              </div>
            )}

            {rootBoundaries.length > 0 && (
              <div className="c4-boundaries-stack">
                {rootBoundaries.map((b, idx) =>
                  renderBoundaryCard(b, idx, rootBoundaries.length)
                )}
              </div>
            )}

            <div className="er-relationships-section">
              <div className="er-section-head">
                <span>
                  {c4Text.relationsHeading} ({c4Data.relations.length})
                </span>
                <button
                  type="button"
                  className="inspector-mini-btn"
                  disabled={c4Data.elements.length === 0}
                  onClick={handleAddRelation}
                >
                  <Plus size={12} />
                  <span>{c4Text.addRelationBtn}</span>
                </button>
              </div>

              {c4Data.relations.length === 0 ? (
                <div className="er-rel-empty">{c4Text.emptyRelations}</div>
              ) : (
                <div className="er-rel-list">
                  {c4Data.relations.map((rel, idx) => {
                    const isSelected = rel.id === selectedRelationId;
                    const fromEl = elementMap.get(rel.from);
                    const toEl = elementMap.get(rel.to);
                    const fromDisplay = fromEl ? fromEl.label : rel.from;
                    const toDisplay = toEl ? toEl.label : rel.to;

                    return (
                      <div
                        key={rel.id}
                        className={`er-rel-row ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => onSelectRelation(rel.id)}
                      >
                        <div className="er-rel-summary">
                          <span className="er-rel-symbol-badge">
                            {rel.relType}
                            {rel.relType === 'RelIndex' && rel.index
                              ? `#${rel.index}`
                              : ''}
                          </span>
                          <span className="er-rel-entity-pill">{fromDisplay}</span>
                          <span className="er-rel-symbol-badge">
                            {rel.relType === 'BiRel' ? '↔' : '→'}
                          </span>
                          <span className="er-rel-entity-pill">{toDisplay}</span>
                          <span className="er-rel-label-pill">
                            : {rel.label}
                            {rel.techn ? ` [${rel.techn}]` : ''}
                          </span>
                        </div>

                        <div
                          className="er-rel-actions"
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="treeview-action-btn"
                            disabled={idx === 0}
                            title={c4Text.moveUpTitle}
                            onClick={() => handleMoveRelation(rel.id, -1)}
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            type="button"
                            className="treeview-action-btn"
                            disabled={idx === c4Data.relations.length - 1}
                            title={c4Text.moveDownTitle}
                            onClick={() => handleMoveRelation(rel.id, 1)}
                          >
                            <ArrowDown size={12} />
                          </button>
                          <button
                            type="button"
                            className="treeview-action-btn"
                            title={c4Text.swapEndpointsBtn}
                            onClick={() => handleSwapRelation(rel.id)}
                          >
                            <ArrowLeftRight size={12} />
                          </button>
                          <button
                            type="button"
                            className="treeview-action-btn is-danger"
                            title={c4Text.deleteRelationBtn}
                            onClick={() => handleDeleteRelation(rel.id)}
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
        )}
      </div>
    </div>
  );
}
