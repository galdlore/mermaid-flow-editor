import { useMemo } from 'react';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Database,
  Link2,
  Plus,
  Trash2,
} from 'lucide-react';
import { useI18n } from '../i18n';
import type { ErAttributeData, ErDiagramData, ErEntityData, ErRelationshipData } from '../types/editor';
import {
  createUniqueErAttributeId,
  createUniqueErEntityId,
  createUniqueErRelationshipId,
  formatErCardinalityPairSymbol,
} from '../utils/erConverter';

export interface ErCanvasProps {
  erData: ErDiagramData;
  selectedEntityId: string | null;
  selectedRelationshipId: string | null;
  onChange: (next: ErDiagramData) => void;
  onSelectEntity: (entityId: string | null) => void;
  onSelectRelationship: (relationshipId: string | null) => void;
}

function getEntityDisplay(entity: ErEntityData | undefined, fallbackId: string): string {
  if (!entity) return fallbackId;
  return entity.alias ? `${entity.alias} (${entity.id})` : entity.id;
}

export default function ErCanvas({
  erData,
  selectedEntityId,
  selectedRelationshipId,
  onChange,
  onSelectEntity,
  onSelectRelationship,
}: ErCanvasProps) {
  const { t } = useI18n();
  const e = t.inspector.er;

  const entityMap = useMemo(() => {
    const map = new Map<string, ErEntityData>();
    for (const ent of erData.entities) {
      map.set(ent.id, ent);
    }
    return map;
  }, [erData.entities]);

  const handleAddEntity = (): void => {
    const nextId = createUniqueErEntityId(erData.entities);
    const nextAttrId = createUniqueErAttributeId(erData.entities);
    const created: ErEntityData = {
      id: nextId,
      alias: e.defaultEntityAlias(erData.entities.length + 1),
      attributes: [
        {
          id: nextAttrId,
          type: 'int',
          name: 'id',
          keys: ['PK'],
        },
      ],
    };
    onChange({
      ...erData,
      entities: [...erData.entities, created],
    });
    onSelectEntity(nextId);
  };

  const handleMoveEntity = (entityId: string, delta: -1 | 1): void => {
    const idx = erData.entities.findIndex((item) => item.id === entityId);
    const targetIdx = idx + delta;
    if (idx < 0 || targetIdx < 0 || targetIdx >= erData.entities.length) {
      return;
    }
    const nextEntities = [...erData.entities];
    const [moved] = nextEntities.splice(idx, 1);
    nextEntities.splice(targetIdx, 0, moved);
    onChange({ ...erData, entities: nextEntities });
  };

  const handleDeleteEntity = (entityId: string): void => {
    const nextEntities = erData.entities.filter((item) => item.id !== entityId);
    const nextRelationships = erData.relationships.filter(
      (rel) => rel.from !== entityId && rel.to !== entityId
    );
    onChange({
      ...erData,
      entities: nextEntities,
      relationships: nextRelationships,
    });
    if (selectedEntityId === entityId) {
      onSelectEntity(nextEntities[0]?.id ?? null);
    }
    if (
      selectedRelationshipId &&
      !nextRelationships.some((rel) => rel.id === selectedRelationshipId)
    ) {
      onSelectRelationship(nextRelationships[0]?.id ?? null);
    }
  };

  const handleAddAttributeToEntity = (entityId: string): void => {
    const target = erData.entities.find((ent) => ent.id === entityId);
    if (!target) return;
    const nextAttrId = createUniqueErAttributeId(erData.entities);
    const nextAttr: ErAttributeData = {
      id: nextAttrId,
      type: 'string',
      name: `col_${target.attributes.length + 1}`,
    };
    onChange({
      ...erData,
      entities: erData.entities.map((ent) =>
        ent.id === entityId
          ? { ...ent, attributes: [...ent.attributes, nextAttr] }
          : ent
      ),
    });
    onSelectEntity(entityId);
  };

  const handleMoveAttribute = (entityId: string, attrId: string, delta: -1 | 1): void => {
    onChange({
      ...erData,
      entities: erData.entities.map((ent) => {
        if (ent.id !== entityId) return ent;
        const idx = ent.attributes.findIndex((a) => a.id === attrId);
        const nextIdx = idx + delta;
        if (idx < 0 || nextIdx < 0 || nextIdx >= ent.attributes.length) {
          return ent;
        }
        const copy = [...ent.attributes];
        const [moved] = copy.splice(idx, 1);
        copy.splice(nextIdx, 0, moved);
        return { ...ent, attributes: copy };
      }),
    });
  };

  const handleDeleteAttribute = (entityId: string, attrId: string): void => {
    onChange({
      ...erData,
      entities: erData.entities.map((ent) =>
        ent.id === entityId
          ? { ...ent, attributes: ent.attributes.filter((a) => a.id !== attrId) }
          : ent
      ),
    });
  };

  const handleAddRelationship = (): void => {
    if (erData.entities.length === 0) return;
    const fromEnt =
      erData.entities.find((item) => item.id === selectedEntityId) ?? erData.entities[0];
    const otherEnt =
      erData.entities.find((item) => item.id !== fromEnt.id) ?? fromEnt;
    const nextRelId = createUniqueErRelationshipId(erData.relationships);
    const created: ErRelationshipData = {
      id: nextRelId,
      from: fromEnt.id,
      to: otherEnt.id,
      fromCardinality: 'exactly_one',
      toCardinality: 'zero_or_more',
      identifying: true,
      label: e.defaultRelationshipLabel,
    };
    onChange({
      ...erData,
      relationships: [...erData.relationships, created],
    });
    onSelectRelationship(nextRelId);
  };

  const handleMoveRelationship = (relId: string, delta: -1 | 1): void => {
    const idx = erData.relationships.findIndex((item) => item.id === relId);
    const nextIdx = idx + delta;
    if (idx < 0 || nextIdx < 0 || nextIdx >= erData.relationships.length) {
      return;
    }
    const copy = [...erData.relationships];
    const [moved] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, moved);
    onChange({ ...erData, relationships: copy });
  };

  const handleSwapRelationship = (relId: string): void => {
    onChange({
      ...erData,
      relationships: erData.relationships.map((rel) =>
        rel.id === relId
          ? {
              ...rel,
              from: rel.to,
              to: rel.from,
              fromCardinality: rel.toCardinality,
              toCardinality: rel.fromCardinality,
            }
          : rel
      ),
    });
  };

  const handleDeleteRelationship = (relId: string): void => {
    const nextRelationships = erData.relationships.filter((rel) => rel.id !== relId);
    onChange({ ...erData, relationships: nextRelationships });
    if (selectedRelationshipId === relId) {
      onSelectRelationship(nextRelationships[0]?.id ?? null);
    }
  };

  const targetEntityForAttrAdd =
    erData.entities.find((item) => item.id === selectedEntityId)?.id ??
    erData.entities[0]?.id ??
    null;

  return (
    <div className="er-canvas">
      <div className="treeview-toolbar">
        <div className="treeview-toolbar-group">
          <button
            type="button"
            className="btn-secondary treeview-toolbar-btn"
            onClick={handleAddEntity}
          >
            <Database size={14} />
            <span>{e.addEntityBtn}</span>
          </button>
          <button
            type="button"
            className="btn-secondary treeview-toolbar-btn"
            disabled={!targetEntityForAttrAdd}
            onClick={() => {
              if (targetEntityForAttrAdd) {
                handleAddAttributeToEntity(targetEntityForAttrAdd);
              }
            }}
          >
            <Plus size={14} />
            <span>{e.addAttributeBtn}</span>
          </button>
          <button
            type="button"
            className="btn-secondary treeview-toolbar-btn"
            disabled={erData.entities.length === 0}
            onClick={handleAddRelationship}
          >
            <Link2 size={14} />
            <span>{e.addRelationshipBtn}</span>
          </button>
        </div>

        <div className="seq-toolbar-meta">
          <span className="seq-meta-pill">{erData.direction ?? 'TB'}</span>
          {erData.title && (
            <span className="treeview-title-pill">{erData.title}</span>
          )}
        </div>
      </div>

      <div className="er-canvas-scroll">
        {erData.entities.length === 0 ? (
          <div className="treeview-empty-state">{e.emptyEntities}</div>
        ) : (
          <div className="er-board">
            <div className="er-entities-grid">
              {erData.entities.map((ent, entIdx) => {
                const isSelected = ent.id === selectedEntityId;
                return (
                  <div
                    key={ent.id}
                    className={`er-entity-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => onSelectEntity(ent.id)}
                  >
                    <div
                      className="er-entity-header"
                      style={ent.color ? { backgroundColor: ent.color } : undefined}
                    >
                      <div className="er-entity-title-wrap">
                        <span className="er-entity-icon">
                          <Database size={14} />
                        </span>
                        <div className="er-entity-titles">
                          <span className="er-entity-title">
                            {ent.alias || ent.id}
                          </span>
                          {ent.alias && (
                            <span className="er-entity-id-sub">{ent.id}</span>
                          )}
                        </div>
                      </div>
                      <div
                        className="er-entity-actions"
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        <span className="er-attr-count-badge">
                          {e.attrCountLabel(ent.attributes.length)}
                        </span>
                        <button
                          type="button"
                          className="treeview-action-btn"
                          disabled={entIdx === 0}
                          title={e.moveLeftTitle}
                          onClick={() => handleMoveEntity(ent.id, -1)}
                        >
                          <ChevronLeft size={11} />
                        </button>
                        <button
                          type="button"
                          className="treeview-action-btn"
                          disabled={entIdx === erData.entities.length - 1}
                          title={e.moveRightTitle}
                          onClick={() => handleMoveEntity(ent.id, 1)}
                        >
                          <ChevronRight size={11} />
                        </button>
                        <button
                          type="button"
                          className="treeview-action-btn is-danger"
                          title={e.deleteEntityBtn}
                          onClick={() => handleDeleteEntity(ent.id)}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>

                    <div className="er-entity-attrs">
                      {ent.attributes.length === 0 ? (
                        <div className="er-attr-empty">{e.emptyAttributes}</div>
                      ) : (
                        ent.attributes.map((attr, attrIdx) => (
                          <div key={attr.id} className="er-attr-row">
                            <div className="er-attr-keys">
                              {(attr.keys ?? []).map((k) => (
                                <span
                                  key={k}
                                  className={`er-key-badge is-${k.toLowerCase()}`}
                                >
                                  {k}
                                </span>
                              ))}
                            </div>
                            <span className="er-attr-name" title={attr.name}>
                              {attr.name}
                            </span>
                            <span className="er-attr-type" title={attr.type}>
                              {attr.type}
                            </span>
                            {attr.comment && (
                              <span className="er-attr-comment" title={attr.comment}>
                                {attr.comment}
                              </span>
                            )}
                            <div
                              className="er-attr-row-actions"
                              onClick={(ev) => ev.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="treeview-action-btn"
                                disabled={attrIdx === 0}
                                title={e.moveUpTitle}
                                onClick={() => handleMoveAttribute(ent.id, attr.id, -1)}
                              >
                                <ArrowUp size={11} />
                              </button>
                              <button
                                type="button"
                                className="treeview-action-btn"
                                disabled={attrIdx === ent.attributes.length - 1}
                                title={e.moveDownTitle}
                                onClick={() => handleMoveAttribute(ent.id, attr.id, 1)}
                              >
                                <ArrowDown size={11} />
                              </button>
                              <button
                                type="button"
                                className="treeview-action-btn is-danger"
                                title={e.deleteAttributeTitle}
                                onClick={() => handleDeleteAttribute(ent.id, attr.id)}
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div
                      className="er-entity-footer"
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="btn-secondary btn-xs"
                        onClick={() => handleAddAttributeToEntity(ent.id)}
                      >
                        <Plus size={11} />
                        <span>{e.addAttributeBtn}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="er-relationships-section">
              <div className="er-section-head">
                <span>
                  {e.relationshipsHeading} ({erData.relationships.length})
                </span>
                <button
                  type="button"
                  className="btn-secondary btn-xs"
                  onClick={handleAddRelationship}
                >
                  <Plus size={11} />
                  <span>{e.addRelationshipBtn}</span>
                </button>
              </div>

              {erData.relationships.length === 0 ? (
                <div className="er-rel-empty">{e.emptyRelationships}</div>
              ) : (
                <div className="er-rel-list">
                  {erData.relationships.map((rel, relIdx) => {
                    const isSelected = rel.id === selectedRelationshipId;
                    const symbol = formatErCardinalityPairSymbol(
                      rel.fromCardinality,
                      rel.toCardinality,
                      rel.identifying
                    );
                    return (
                      <div
                        key={rel.id}
                        className={`er-rel-row ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => onSelectRelationship(rel.id)}
                      >
                        <div className="er-rel-summary">
                          <span className="er-rel-entity-pill">
                            {getEntityDisplay(entityMap.get(rel.from), rel.from)}
                          </span>
                          <span
                            className={`er-rel-symbol-badge ${
                              rel.identifying ? 'is-solid' : 'is-dashed'
                            }`}
                          >
                            {symbol}
                          </span>
                          <span className="er-rel-entity-pill">
                            {getEntityDisplay(entityMap.get(rel.to), rel.to)}
                          </span>
                          <span className="er-rel-label-pill">
                            {rel.label || '""'}
                          </span>
                        </div>
                        <div
                          className="er-rel-actions"
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="treeview-action-btn"
                            title={e.swapEndpointsBtn}
                            onClick={() => handleSwapRelationship(rel.id)}
                          >
                            <ArrowLeftRight size={11} />
                          </button>
                          <button
                            type="button"
                            className="treeview-action-btn"
                            disabled={relIdx === 0}
                            title={e.moveUpTitle}
                            onClick={() => handleMoveRelationship(rel.id, -1)}
                          >
                            <ArrowUp size={11} />
                          </button>
                          <button
                            type="button"
                            className="treeview-action-btn"
                            disabled={relIdx === erData.relationships.length - 1}
                            title={e.moveDownTitle}
                            onClick={() => handleMoveRelationship(rel.id, 1)}
                          >
                            <ArrowDown size={11} />
                          </button>
                          <button
                            type="button"
                            className="treeview-action-btn is-danger"
                            title={e.deleteRelationshipBtn}
                            onClick={() => handleDeleteRelationship(rel.id)}
                          >
                            <Trash2 size={11} />
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
