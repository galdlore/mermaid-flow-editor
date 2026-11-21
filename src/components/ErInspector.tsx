import { useEffect, useState } from 'react';
import { ArrowDown, ArrowLeftRight, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import { InspectorCollapsibleSection } from './InspectorCollapsibleSection';
import {
  CommitIdInput,
  InspectorBulkControls,
  InspectorColorPalette,
  InspectorCommentsSection,
} from './InspectorCommon';
import {
  FORBIDDEN_ER_ATTR_NAME_CHARS_REGEX,
  FORBIDDEN_ER_ATTR_TYPE_CHARS_REGEX,
  FORBIDDEN_ER_ENTITY_ID_CHARS_REGEX,
  FORBIDDEN_ER_QUOTED_TEXT_CHARS_REGEX,
} from '../utils/inputSafeguard';
import type {
  ErAttributeData,
  ErAttributeKey,
  ErCardinality,
  ErDiagramData,
  ErDiagramDirection,
  ErEntityData,
  ErRelationshipData,
} from '../types/editor';
import {
  ER_ATTR_TYPE_SUGGESTIONS,
  ER_CARDINALITY_OPTIONS,
  ER_DIRECTION_OPTIONS,
  createUniqueErAttributeId,
  sanitizeErEntityId,
} from '../utils/erConverter';

export interface ErInspectorProps {
  erData: ErDiagramData;
  selectedEntityId: string | null;
  selectedRelationshipId: string | null;
  onChange: (next: ErDiagramData) => void;
  onSelectEntity: (entityId: string | null) => void;
  onSelectRelationship: (relationshipId: string | null) => void;
}

type ErSectionKey = 'entity' | 'relationship' | 'settings' | 'comments';

const ATTR_KEY_CHOICES: ReadonlyArray<ErAttributeKey> = ['PK', 'FK', 'UK'];

export default function ErInspector({
  erData,
  selectedEntityId,
  selectedRelationshipId,
  onChange,
  onSelectEntity,
  onSelectRelationship,
}: ErInspectorProps) {
  const { t } = useI18n();
  const e = t.inspector.er;
  const safeguard = t.inspector.safeguard;

  const selectedEntity =
    erData.entities.find((item) => item.id === selectedEntityId) ?? null;
  const selectedRelationship =
    erData.relationships.find((item) => item.id === selectedRelationshipId) ?? null;

  const [selectedAttrId, setSelectedAttrId] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<ErSectionKey, boolean>>({
    entity: true,
    relationship: true,
    settings: false,
    comments: false,
  });

  useEffect(() => {
    if (!selectedEntity) {
      setSelectedAttrId(null);
      return;
    }
    setSelectedAttrId((prev) =>
      prev && selectedEntity.attributes.some((a) => a.id === prev)
        ? prev
        : selectedEntity.attributes[0]?.id ?? null
    );
  }, [selectedEntity]);

  useEffect(() => {
    if (selectedEntityId) {
      setOpenSections((prev) => (prev.entity ? prev : { ...prev, entity: true }));
    }
  }, [selectedEntityId]);

  useEffect(() => {
    if (selectedRelationshipId) {
      setOpenSections((prev) =>
        prev.relationship ? prev : { ...prev, relationship: true }
      );
    }
  }, [selectedRelationshipId]);

  const toggleSection = (key: ErSectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSections = (open: boolean): void => {
    setOpenSections({
      entity: open,
      relationship: open,
      settings: open,
      comments: open,
    });
  };

  const allExpanded = Object.values(openSections).every(Boolean);

  const selectedAttr =
    selectedEntity?.attributes.find((a) => a.id === selectedAttrId) ??
    selectedEntity?.attributes[0] ??
    null;

  const updateSelectedEntity = (
    updater: (ent: ErEntityData) => ErEntityData
  ): void => {
    if (!selectedEntity) return;
    onChange({
      ...erData,
      entities: erData.entities.map((ent) =>
        ent.id === selectedEntity.id ? updater(ent) : ent
      ),
    });
  };

  const commitEntityIdRename = (rawNext: string): string => {
    if (!selectedEntity) return '';
    const oldId = selectedEntity.id;
    const baseNext = sanitizeErEntityId(rawNext, oldId);
    const otherIds = new Set(
      erData.entities.filter((item) => item.id !== oldId).map((item) => item.id)
    );
    let uniqueNext = baseNext;
    let suffix = 2;
    while (otherIds.has(uniqueNext)) {
      uniqueNext = `${baseNext}_${suffix++}`;
    }

    if (uniqueNext === oldId) {
      return oldId;
    }

    onChange({
      ...erData,
      entities: erData.entities.map((ent) =>
        ent.id === oldId ? { ...ent, id: uniqueNext } : ent
      ),
      relationships: erData.relationships.map((rel) => ({
        ...rel,
        from: rel.from === oldId ? uniqueNext : rel.from,
        to: rel.to === oldId ? uniqueNext : rel.to,
      })),
    });
    onSelectEntity(uniqueNext);
    return uniqueNext;
  };

  const handleDeleteSelectedEntity = (): void => {
    if (!selectedEntity) return;
    const delId = selectedEntity.id;
    const nextEntities = erData.entities.filter((item) => item.id !== delId);
    const nextRelationships = erData.relationships.filter(
      (rel) => rel.from !== delId && rel.to !== delId
    );
    onChange({
      ...erData,
      entities: nextEntities,
      relationships: nextRelationships,
    });
    onSelectEntity(nextEntities[0]?.id ?? null);
    if (
      selectedRelationshipId &&
      !nextRelationships.some((rel) => rel.id === selectedRelationshipId)
    ) {
      onSelectRelationship(nextRelationships[0]?.id ?? null);
    }
  };

  const handleAddAttribute = (): void => {
    if (!selectedEntity) return;
    const nextId = createUniqueErAttributeId(erData.entities);
    const newAttr: ErAttributeData = {
      id: nextId,
      type: 'string',
      name: `col_${selectedEntity.attributes.length + 1}`,
    };
    updateSelectedEntity((ent) => ({
      ...ent,
      attributes: [...ent.attributes, newAttr],
    }));
    setSelectedAttrId(nextId);
  };

  const handleMoveAttribute = (attrId: string, delta: -1 | 1): void => {
    if (!selectedEntity) return;
    const idx = selectedEntity.attributes.findIndex((a) => a.id === attrId);
    const nextIdx = idx + delta;
    if (idx < 0 || nextIdx < 0 || nextIdx >= selectedEntity.attributes.length) {
      return;
    }
    const copy = [...selectedEntity.attributes];
    const [moved] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, moved);
    updateSelectedEntity((ent) => ({ ...ent, attributes: copy }));
  };

  const handleDeleteAttribute = (attrId: string): void => {
    if (!selectedEntity) return;
    const nextAttrs = selectedEntity.attributes.filter((a) => a.id !== attrId);
    updateSelectedEntity((ent) => ({ ...ent, attributes: nextAttrs }));
    if (selectedAttr?.id === attrId) {
      setSelectedAttrId(nextAttrs[0]?.id ?? null);
    }
  };

  const updateSelectedAttr = (
    updater: (attr: ErAttributeData) => ErAttributeData
  ): void => {
    if (!selectedEntity || !selectedAttr) return;
    updateSelectedEntity((ent) => ({
      ...ent,
      attributes: ent.attributes.map((a) =>
        a.id === selectedAttr.id ? updater(a) : a
      ),
    }));
  };

  const toggleAttrKey = (key: ErAttributeKey): void => {
    if (!selectedAttr) return;
    const current = new Set(selectedAttr.keys ?? []);
    if (current.has(key)) {
      current.delete(key);
    } else {
      current.add(key);
    }
    const ordered = ATTR_KEY_CHOICES.filter((k) => current.has(k));
    updateSelectedAttr((attr) => ({
      ...attr,
      keys: ordered.length > 0 ? ordered : undefined,
    }));
  };

  const updateSelectedRelationship = (
    updater: (rel: ErRelationshipData) => ErRelationshipData
  ): void => {
    if (!selectedRelationship) return;
    onChange({
      ...erData,
      relationships: erData.relationships.map((rel) =>
        rel.id === selectedRelationship.id ? updater(rel) : rel
      ),
    });
  };

  const handleDeleteSelectedRelationship = (): void => {
    if (!selectedRelationship) return;
    const nextRelationships = erData.relationships.filter(
      (rel) => rel.id !== selectedRelationship.id
    );
    onChange({ ...erData, relationships: nextRelationships });
    onSelectRelationship(nextRelationships[0]?.id ?? null);
  };

  return (
    <div className="inspector-panel">
      <InspectorBulkControls allExpanded={allExpanded} onSetAll={setAllSections} />

      <InspectorCollapsibleSection
        title={e.entitySection}
        badgeText={selectedEntity ? selectedEntity.id : undefined}
        isOpen={openSections.entity}
        onToggle={() => toggleSection('entity')}
      >
        {!selectedEntity ? (
          <p className="inspector-hint">{e.selectEntityPrompt}</p>
        ) : (
          <>
            <CommitIdInput
              label={e.entityIdField}
              value={selectedEntity.id}
              placeholder="CUSTOMER"
              forbiddenRegex={FORBIDDEN_ER_ENTITY_ID_CHARS_REGEX}
              formatError={safeguard.erEntityIdErrorChars}
              onCommit={commitEntityIdRename}
            />

            <label className="inspector-field">
              <span>{e.entityAliasField}</span>
              <GuardedInput
                value={selectedEntity.alias ?? ''}
                placeholder={e.entityAliasPlaceholder}
                forbiddenRegex={FORBIDDEN_ER_QUOTED_TEXT_CHARS_REGEX}
                formatError={safeguard.erQuotedTextErrorChars}
                onChangeValue={(nextVal) =>
                  updateSelectedEntity((ent) => ({
                    ...ent,
                    alias: nextVal || undefined,
                  }))
                }
              />
            </label>

            <InspectorColorPalette
              label={e.entityColorField}
              value={selectedEntity.color}
              clearTitle={e.noColorOption}
              onChange={(color) => updateSelectedEntity((ent) => ({ ...ent, color }))}
            />

            <div className="er-attrs-editor">
              <div className="inspector-section-subhead">
                <span>
                  {e.attributesHeading} ({selectedEntity.attributes.length})
                </span>
                <button
                  type="button"
                  className="btn-secondary btn-xs"
                  onClick={handleAddAttribute}
                >
                  <Plus size={12} />
                  <span>{e.addAttributeBtn}</span>
                </button>
              </div>

              {selectedEntity.attributes.length === 0 ? (
                <p className="inspector-hint">{e.emptyAttributes}</p>
              ) : (
                <>
                  <div className="er-inspector-attr-list">
                    {selectedEntity.attributes.map((attr, idx) => {
                      const isActive = attr.id === selectedAttr?.id;
                      return (
                        <div
                          key={attr.id}
                          className={`er-inspector-attr-item ${
                            isActive ? 'is-active' : ''
                          }`}
                          onClick={() => setSelectedAttrId(attr.id)}
                        >
                          <span className="er-inspector-attr-label">
                            {attr.type} {attr.name}
                            {attr.keys && attr.keys.length > 0
                              ? ` [${attr.keys.join(',')}]`
                              : ''}
                          </span>
                          <div
                            className="er-inspector-attr-actions"
                            onClick={(ev) => ev.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="treeview-action-btn"
                              disabled={idx === 0}
                              title={e.moveUpTitle}
                              onClick={() => handleMoveAttribute(attr.id, -1)}
                            >
                              <ArrowUp size={11} />
                            </button>
                            <button
                              type="button"
                              className="treeview-action-btn"
                              disabled={idx === selectedEntity.attributes.length - 1}
                              title={e.moveDownTitle}
                              onClick={() => handleMoveAttribute(attr.id, 1)}
                            >
                              <ArrowDown size={11} />
                            </button>
                            <button
                              type="button"
                              className="treeview-action-btn is-danger"
                              title={e.deleteAttributeTitle}
                              onClick={() => handleDeleteAttribute(attr.id)}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedAttr && (
                    <div className="er-attr-detail-box">
                      <label className="inspector-field">
                        <span>{e.attributeTypeField}</span>
                        <GuardedInput
                          value={selectedAttr.type}
                          placeholder="varchar(255)"
                          forbiddenRegex={FORBIDDEN_ER_ATTR_TYPE_CHARS_REGEX}
                          formatError={safeguard.erAttrTypeErrorChars}
                          onChangeValue={(nextVal) =>
                            updateSelectedAttr((attr) => ({
                              ...attr,
                              type: nextVal || 'string',
                            }))
                          }
                        />
                      </label>

                      <div className="er-type-chips">
                        {ER_ATTR_TYPE_SUGGESTIONS.map((typeOpt) => (
                          <button
                            key={typeOpt}
                            type="button"
                            className={`er-type-chip ${
                              selectedAttr.type === typeOpt ? 'is-active' : ''
                            }`}
                            onClick={() =>
                              updateSelectedAttr((attr) => ({ ...attr, type: typeOpt }))
                            }
                          >
                            {typeOpt}
                          </button>
                        ))}
                      </div>

                      <label className="inspector-field">
                        <span>{e.attributeNameField}</span>
                        <GuardedInput
                          value={selectedAttr.name}
                          placeholder="user_id"
                          forbiddenRegex={FORBIDDEN_ER_ATTR_NAME_CHARS_REGEX}
                          formatError={safeguard.erAttrNameErrorChars}
                          onChangeValue={(nextVal) =>
                            updateSelectedAttr((attr) => ({
                              ...attr,
                              name: nextVal || 'col',
                            }))
                          }
                        />
                      </label>

                      <div className="inspector-field">
                        <span>{e.attributeKeysField}</span>
                        <div className="er-keys-checkboxes">
                          {ATTR_KEY_CHOICES.map((keyOpt) => (
                            <label key={keyOpt} className="checkbox-field-label">
                              <input
                                type="checkbox"
                                checked={(selectedAttr.keys ?? []).includes(keyOpt)}
                                onChange={() => toggleAttrKey(keyOpt)}
                              />
                              <span>{e.keyLabels[keyOpt]}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <label className="inspector-field">
                        <span>{e.attributeCommentField}</span>
                        <GuardedInput
                          value={selectedAttr.comment ?? ''}
                          placeholder={e.attributeCommentPlaceholder}
                          forbiddenRegex={FORBIDDEN_ER_QUOTED_TEXT_CHARS_REGEX}
                          formatError={safeguard.erQuotedTextErrorChars}
                          onChangeValue={(nextVal) =>
                            updateSelectedAttr((attr) => ({
                              ...attr,
                              comment: nextVal || undefined,
                            }))
                          }
                        />
                      </label>
                    </div>
                  )}
                </>
              )}
            </div>

            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleDeleteSelectedEntity}
            >
              <Trash2 size={13} />
              <span>{e.deleteEntityBtn}</span>
            </button>
          </>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={e.relationshipSection}
        badgeText={erData.relationships.length}
        isOpen={openSections.relationship}
        onToggle={() => toggleSection('relationship')}
      >
        {!selectedRelationship ? (
          <p className="inspector-hint">{e.selectRelationshipPrompt}</p>
        ) : (
          <>
            <div className="field-row-compact">
              <label className="inspector-field">
                <span>{e.relFromField}</span>
                <select
                  value={selectedRelationship.from}
                  onChange={(ev) =>
                    updateSelectedRelationship((rel) => ({
                      ...rel,
                      from: ev.target.value,
                    }))
                  }
                >
                  {erData.entities.map((ent) => (
                    <option key={ent.id} value={ent.id}>
                      {ent.alias ? `${ent.alias} (${ent.id})` : ent.id}
                    </option>
                  ))}
                </select>
              </label>

              <label className="inspector-field">
                <span>{e.relToField}</span>
                <select
                  value={selectedRelationship.to}
                  onChange={(ev) =>
                    updateSelectedRelationship((rel) => ({
                      ...rel,
                      to: ev.target.value,
                    }))
                  }
                >
                  {erData.entities.map((ent) => (
                    <option key={ent.id} value={ent.id}>
                      {ent.alias ? `${ent.alias} (${ent.id})` : ent.id}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="button"
              className="btn-secondary btn-xs seq-swap-btn"
              onClick={() =>
                updateSelectedRelationship((rel) => ({
                  ...rel,
                  from: rel.to,
                  to: rel.from,
                  fromCardinality: rel.toCardinality,
                  toCardinality: rel.fromCardinality,
                }))
              }
            >
              <ArrowLeftRight size={12} />
              <span>{e.swapEndpointsBtn}</span>
            </button>

            <div className="field-row-compact">
              <label className="inspector-field">
                <span>{e.relFromCardField}</span>
                <select
                  value={selectedRelationship.fromCardinality}
                  onChange={(ev) =>
                    updateSelectedRelationship((rel) => ({
                      ...rel,
                      fromCardinality: ev.target.value as ErCardinality,
                    }))
                  }
                >
                  {ER_CARDINALITY_OPTIONS.map((card) => (
                    <option key={card} value={card}>
                      {e.cardinalities[card]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="inspector-field">
                <span>{e.relToCardField}</span>
                <select
                  value={selectedRelationship.toCardinality}
                  onChange={(ev) =>
                    updateSelectedRelationship((rel) => ({
                      ...rel,
                      toCardinality: ev.target.value as ErCardinality,
                    }))
                  }
                >
                  {ER_CARDINALITY_OPTIONS.map((card) => (
                    <option key={card} value={card}>
                      {e.cardinalities[card]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="inspector-field">
              <span>{e.relIdentifyingField}</span>
              <select
                value={selectedRelationship.identifying ? 'solid' : 'dashed'}
                onChange={(ev) =>
                  updateSelectedRelationship((rel) => ({
                    ...rel,
                    identifying: ev.target.value === 'solid',
                  }))
                }
              >
                <option value="solid">{e.relIdentifyingTrue}</option>
                <option value="dashed">{e.relIdentifyingFalse}</option>
              </select>
            </label>

            <label className="inspector-field">
              <span>{e.relLabelField}</span>
              <GuardedInput
                value={selectedRelationship.label}
                placeholder={e.relLabelPlaceholder}
                forbiddenRegex={FORBIDDEN_ER_QUOTED_TEXT_CHARS_REGEX}
                formatError={safeguard.erQuotedTextErrorChars}
                onChangeValue={(nextVal) =>
                  updateSelectedRelationship((rel) => ({ ...rel, label: nextVal }))
                }
              />
            </label>

            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleDeleteSelectedRelationship}
            >
              <Trash2 size={13} />
              <span>{e.deleteRelationshipBtn}</span>
            </button>
          </>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={e.settingsSection}
        isOpen={openSections.settings}
        onToggle={() => toggleSection('settings')}
      >
        <label className="inspector-field">
          <span>{e.titleField}</span>
          <GuardedInput
            value={erData.title ?? ''}
            placeholder={e.titlePlaceholder}
            forbiddenRegex={FORBIDDEN_ER_QUOTED_TEXT_CHARS_REGEX}
            formatError={safeguard.erQuotedTextErrorChars}
            onChangeValue={(nextVal) =>
              onChange({
                ...erData,
                title: nextVal || undefined,
              })
            }
          />
        </label>

        <label className="inspector-field">
          <span>{e.directionField}</span>
          <select
            value={erData.direction ?? 'TB'}
            onChange={(ev) =>
              onChange({
                ...erData,
                direction: ev.target.value as ErDiagramDirection,
              })
            }
          >
            {ER_DIRECTION_OPTIONS.map((dir) => (
              <option key={dir} value={dir}>
                {e.directions[dir]}
              </option>
            ))}
          </select>
        </label>
      </InspectorCollapsibleSection>

      <InspectorCommentsSection
        title={e.commentsSection}
        fieldLabel={e.commentsField}
        placeholder={e.commentsPlaceholder}
        comments={erData.comments}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
        rows={4}
        onChangeComments={(nextComments) =>
          onChange({
            ...erData,
            comments: nextComments,
          })
        }
      />
    </div>
  );
}
