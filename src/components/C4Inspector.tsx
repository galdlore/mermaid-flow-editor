import { useEffect, useMemo, useState } from 'react';
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
  FORBIDDEN_C4_ID_CHARS_REGEX,
  FORBIDDEN_C4_QUOTED_TEXT_CHARS_REGEX,
  FORBIDDEN_C4_TITLE_CHARS_REGEX,
} from '../utils/inputSafeguard';
import type {
  C4BoundaryData,
  C4BoundaryKind,
  C4DiagramData,
  C4DiagramSubtype,
  C4ElementData,
  C4ElementKind,
  C4ElementVariant,
  C4RelationData,
  C4RelationType,
} from '../types/editor';
import {
  C4_BOUNDARY_KIND_OPTIONS,
  C4_ELEMENT_KIND_OPTIONS,
  C4_ELEMENT_VARIANT_OPTIONS,
  C4_RELATION_TYPE_OPTIONS,
  C4_SUBTYPE_OPTIONS,
  collectC4BoundaryDescendantIds,
  createUniqueC4RelationId,
  sanitizeC4Id,
} from '../utils/c4Converter';

export interface C4InspectorProps {
  c4Data: C4DiagramData;
  selectedItemId: string | null;
  selectedRelationId: string | null;
  onChange: (next: C4DiagramData) => void;
  onSelectItem: (itemId: string | null) => void;
  onSelectRelation: (relationId: string | null) => void;
}

type C4SectionKey =
  | 'element'
  | 'boundary'
  | 'relation'
  | 'settings'
  | 'comments';

const ROW_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

export default function C4Inspector({
  c4Data,
  selectedItemId,
  selectedRelationId,
  onChange,
  onSelectItem,
  onSelectRelation,
}: C4InspectorProps) {
  const { t } = useI18n();
  const c4Text = t.inspector.c4Diagram;
  const safeguard = t.inspector.safeguard;

  const selectedElement =
    c4Data.elements.find((item) => item.id === selectedItemId) ?? null;
  const selectedBoundary =
    c4Data.boundaries.find((item) => item.id === selectedItemId) ?? null;
  const selectedRelation =
    c4Data.relations.find((item) => item.id === selectedRelationId) ?? null;

  const [openSections, setOpenSections] = useState<Record<C4SectionKey, boolean>>({
    element: true,
    boundary: false,
    relation: true,
    settings: false,
    comments: false,
  });

  useEffect(() => {
    if (selectedElement) {
      setOpenSections((prev) =>
        prev.element ? prev : { ...prev, element: true }
      );
    } else if (selectedBoundary) {
      setOpenSections((prev) =>
        prev.boundary ? prev : { ...prev, boundary: true }
      );
    }
  }, [selectedElement, selectedBoundary]);

  useEffect(() => {
    if (selectedRelationId) {
      setOpenSections((prev) =>
        prev.relation ? prev : { ...prev, relation: true }
      );
    }
  }, [selectedRelationId]);

  const toggleSection = (key: C4SectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSections = (open: boolean): void => {
    setOpenSections({
      element: open,
      boundary: open,
      relation: open,
      settings: open,
      comments: open,
    });
  };

  const allExpanded = Object.values(openSections).every(Boolean);

  const selectableParentBoundaries = useMemo(() => {
    if (!selectedBoundary) {
      return c4Data.boundaries;
    }
    const descendants = collectC4BoundaryDescendantIds(
      selectedBoundary.id,
      c4Data.boundaries
    );
    return c4Data.boundaries.filter(
      (b) => b.id !== selectedBoundary.id && !descendants.has(b.id)
    );
  }, [selectedBoundary, c4Data.boundaries]);

  const updateSelectedElement = (
    updater: (el: C4ElementData) => C4ElementData
  ): void => {
    if (!selectedElement) return;
    onChange({
      ...c4Data,
      elements: c4Data.elements.map((item) =>
        item.id === selectedElement.id ? updater(item) : item
      ),
    });
  };

  const commitElementIdRename = (rawNext: string): string => {
    if (!selectedElement) return '';
    const oldId = selectedElement.id;
    const sanitized = sanitizeC4Id(rawNext);
    if (sanitized === oldId) {
      return oldId;
    }
    const usedIds = new Set<string>([
      ...c4Data.elements.filter((e) => e.id !== oldId).map((e) => e.id),
      ...c4Data.boundaries.map((b) => b.id),
    ]);
    let uniqueNext = sanitized;
    let suffix = 2;
    while (usedIds.has(uniqueNext)) {
      uniqueNext = `${sanitized}_${suffix++}`;
    }

    onChange({
      ...c4Data,
      elements: c4Data.elements.map((el) =>
        el.id === oldId ? { ...el, id: uniqueNext } : el
      ),
      relations: c4Data.relations.map((r) => ({
        ...r,
        from: r.from === oldId ? uniqueNext : r.from,
        to: r.to === oldId ? uniqueNext : r.to,
      })),
    });
    onSelectItem(uniqueNext);
    return uniqueNext;
  };

  const handleDeleteSelectedElement = (): void => {
    if (!selectedElement) return;
    const delId = selectedElement.id;
    const nextElements = c4Data.elements.filter((el) => el.id !== delId);
    const nextRelations = c4Data.relations.filter(
      (r) => r.from !== delId && r.to !== delId
    );
    onChange({
      ...c4Data,
      elements: nextElements,
      relations: nextRelations,
    });
    onSelectItem(nextElements[0]?.id ?? c4Data.boundaries[0]?.id ?? null);
    if (
      selectedRelationId &&
      !nextRelations.some((r) => r.id === selectedRelationId)
    ) {
      onSelectRelation(nextRelations[0]?.id ?? null);
    }
  };

  const updateSelectedBoundary = (
    updater: (b: C4BoundaryData) => C4BoundaryData
  ): void => {
    if (!selectedBoundary) return;
    onChange({
      ...c4Data,
      boundaries: c4Data.boundaries.map((item) =>
        item.id === selectedBoundary.id ? updater(item) : item
      ),
    });
  };

  const commitBoundaryIdRename = (rawNext: string): string => {
    if (!selectedBoundary) return '';
    const oldId = selectedBoundary.id;
    const sanitized = sanitizeC4Id(rawNext);
    if (sanitized === oldId) {
      return oldId;
    }
    const usedIds = new Set<string>([
      ...c4Data.elements.map((e) => e.id),
      ...c4Data.boundaries.filter((b) => b.id !== oldId).map((b) => b.id),
    ]);
    let uniqueNext = sanitized;
    let suffix = 2;
    while (usedIds.has(uniqueNext)) {
      uniqueNext = `${sanitized}_${suffix++}`;
    }

    onChange({
      ...c4Data,
      boundaries: c4Data.boundaries.map((b) => ({
        ...b,
        id: b.id === oldId ? uniqueNext : b.id,
        ...(b.parentBoundaryId === oldId ? { parentBoundaryId: uniqueNext } : {}),
      })),
      elements: c4Data.elements.map((el) =>
        el.boundaryId === oldId ? { ...el, boundaryId: uniqueNext } : el
      ),
    });
    onSelectItem(uniqueNext);
    return uniqueNext;
  };

  const handleDeleteSelectedBoundary = (): void => {
    if (!selectedBoundary) return;
    const delId = selectedBoundary.id;
    const fallbackParent = selectedBoundary.parentBoundaryId;
    const nextBoundaries = c4Data.boundaries
      .filter((b) => b.id !== delId)
      .map((b) =>
        b.parentBoundaryId === delId
          ? { ...b, parentBoundaryId: fallbackParent }
          : b
      );
    const nextElements = c4Data.elements.map((el) =>
      el.boundaryId === delId ? { ...el, boundaryId: fallbackParent } : el
    );

    onChange({
      ...c4Data,
      boundaries: nextBoundaries,
      elements: nextElements,
    });
    onSelectItem(nextElements[0]?.id ?? nextBoundaries[0]?.id ?? null);
  };

  const handleQuickAddRelation = (): void => {
    if (!selectedElement) return;
    const other = c4Data.elements.find((el) => el.id !== selectedElement.id);
    const created: C4RelationData = {
      id: createUniqueC4RelationId(c4Data.relations),
      relType: c4Data.subtype === 'C4Dynamic' ? 'RelIndex' : 'Rel',
      ...(c4Data.subtype === 'C4Dynamic'
        ? { index: String(c4Data.relations.length + 1) }
        : {}),
      from: selectedElement.id,
      to: other ? other.id : selectedElement.id,
      label: c4Text.defaultRelationLabel,
    };
    onChange({
      ...c4Data,
      relations: [...c4Data.relations, created],
    });
    onSelectRelation(created.id);
  };

  const updateSelectedRelation = (
    updater: (r: C4RelationData) => C4RelationData
  ): void => {
    if (!selectedRelation) return;
    onChange({
      ...c4Data,
      relations: c4Data.relations.map((item) =>
        item.id === selectedRelation.id ? updater(item) : item
      ),
    });
  };

  const handleDeleteSelectedRelation = (): void => {
    if (!selectedRelation) return;
    const nextRelations = c4Data.relations.filter(
      (r) => r.id !== selectedRelation.id
    );
    onChange({ ...c4Data, relations: nextRelations });
    onSelectRelation(nextRelations[0]?.id ?? null);
  };

  return (
    <div className="inspector-panel">
      <InspectorBulkControls allExpanded={allExpanded} onSetAll={setAllSections} />

      <InspectorCollapsibleSection
        title={c4Text.elementSection}
        badgeText={selectedElement?.id}
        isOpen={openSections.element}
        onToggle={() => toggleSection('element')}
        headerAction={
          selectedElement ? (
            <button
              type="button"
              className="btn-secondary btn-xs"
              onClick={handleQuickAddRelation}
            >
              <Plus size={12} />
              <span>{c4Text.addRelationBtn}</span>
            </button>
          ) : undefined
        }
      >
        {!selectedElement ? (
          <p className="inspector-hint">{c4Text.selectElementPrompt}</p>
        ) : (
          <>
            <CommitIdInput
              label={c4Text.elementIdField}
              value={selectedElement.id}
              forbiddenRegex={FORBIDDEN_C4_ID_CHARS_REGEX}
              formatError={safeguard.c4IdErrorChars}
              onCommit={commitElementIdRename}
            />

            <label className="inspector-field">
              <span>{c4Text.elementKindField}</span>
              <select
                value={selectedElement.kind}
                onChange={(e) => {
                  const nextKind = e.target.value as C4ElementKind;
                  updateSelectedElement((el) => ({
                    ...el,
                    kind: nextKind,
                    ...(nextKind === 'person' ? { variant: undefined } : {}),
                    ...(nextKind !== 'container' && nextKind !== 'component'
                      ? { techn: undefined }
                      : {}),
                  }));
                }}
              >
                {C4_ELEMENT_KIND_OPTIONS.map((kind) => (
                  <option key={kind} value={kind}>
                    {c4Text.elementKinds[kind]}
                  </option>
                ))}
              </select>
            </label>

            {selectedElement.kind !== 'person' && (
              <label className="inspector-field">
                <span>{c4Text.elementVariantField}</span>
                <select
                  value={selectedElement.variant ?? 'standard'}
                  onChange={(e) => {
                    const nextVar = e.target.value as C4ElementVariant;
                    updateSelectedElement((el) => ({
                      ...el,
                      variant: nextVar === 'standard' ? undefined : nextVar,
                    }));
                  }}
                >
                  {C4_ELEMENT_VARIANT_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {c4Text.elementVariants[v]}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="checkbox-field-label">
              <input
                type="checkbox"
                checked={Boolean(selectedElement.external)}
                onChange={(e) =>
                  updateSelectedElement((el) => ({
                    ...el,
                    external: e.target.checked ? true : undefined,
                  }))
                }
              />
              <span>{c4Text.elementExternalField}</span>
            </label>

            <label className="inspector-field">
              <span>{c4Text.elementParentBoundaryField}</span>
              <select
                value={selectedElement.boundaryId ?? ''}
                onChange={(e) =>
                  updateSelectedElement((el) => ({
                    ...el,
                    boundaryId: e.target.value || undefined,
                  }))
                }
              >
                <option value="">{c4Text.rootBoundaryOption}</option>
                {c4Data.boundaries.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label} ({b.id})
                  </option>
                ))}
              </select>
            </label>

            <label className="inspector-field">
              <span>{c4Text.elementLabelField}</span>
              <GuardedInput
                value={selectedElement.label}
                placeholder={c4Text.elementLabelPlaceholder}
                forbiddenRegex={FORBIDDEN_C4_QUOTED_TEXT_CHARS_REGEX}
                formatError={safeguard.c4QuotedTextErrorChars}
                onChangeValue={(label) =>
                  updateSelectedElement((el) => ({ ...el, label }))
                }
              />
            </label>

            {(selectedElement.kind === 'container' ||
              selectedElement.kind === 'component') && (
              <label className="inspector-field">
                <span>{c4Text.elementTechnField}</span>
                <GuardedInput
                  value={selectedElement.techn ?? ''}
                  placeholder={c4Text.elementTechnPlaceholder}
                  forbiddenRegex={FORBIDDEN_C4_QUOTED_TEXT_CHARS_REGEX}
                  formatError={safeguard.c4QuotedTextErrorChars}
                  onChangeValue={(val) =>
                    updateSelectedElement((el) => ({
                      ...el,
                      techn: val.trim() ? val : undefined,
                    }))
                  }
                />
              </label>
            )}

            <label className="inspector-field">
              <span>{c4Text.elementDescrField}</span>
              <GuardedInput
                value={selectedElement.descr ?? ''}
                placeholder={c4Text.elementDescrPlaceholder}
                forbiddenRegex={FORBIDDEN_C4_QUOTED_TEXT_CHARS_REGEX}
                formatError={safeguard.c4QuotedTextErrorChars}
                onChangeValue={(val) =>
                  updateSelectedElement((el) => ({
                    ...el,
                    descr: val.trim() ? val : undefined,
                  }))
                }
              />
            </label>

            <InspectorColorPalette
              label={c4Text.elementColorField}
              value={selectedElement.bgColor}
              clearTitle={c4Text.noColorOption}
              onChange={(nextBg) =>
                updateSelectedElement((el) => ({
                  ...el,
                  bgColor: nextBg,
                  // パステル背景色選択時は白文字で視認性が落ちるため濃い文字色を自動補正する
                  fontColor: nextBg
                    ? el.fontColor ?? '#0f172a'
                    : el.fontColor === '#0f172a'
                      ? undefined
                      : el.fontColor,
                }))
              }
            />

            <InspectorColorPalette
              label={c4Text.elementBorderColorField}
              value={selectedElement.borderColor}
              items={STROKE_COLOR_PALETTE_ITEMS}
              allowClear={false}
              labelMap={t.inspector.strokeColors}
              onChange={(borderColor) =>
                updateSelectedElement((el) => ({ ...el, borderColor }))
              }
            />

            <InspectorColorPalette
              label={c4Text.elementTextColorField}
              value={selectedElement.fontColor}
              items={STROKE_COLOR_PALETTE_ITEMS}
              allowClear={false}
              labelMap={{
                ...t.inspector.strokeColors,
                default: c4Text.defaultTextColorOption,
              }}
              onChange={(fontColor) =>
                updateSelectedElement((el) => ({ ...el, fontColor }))
              }
            />

            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleDeleteSelectedElement}
            >
              <Trash2 size={14} />
              <span>{c4Text.deleteElementBtn}</span>
            </button>
          </>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={c4Text.boundarySection}
        badgeText={selectedBoundary?.id}
        isOpen={openSections.boundary}
        onToggle={() => toggleSection('boundary')}
      >
        {!selectedBoundary ? (
          <p className="inspector-hint">{c4Text.selectBoundaryPrompt}</p>
        ) : (
          <>
            <CommitIdInput
              label={c4Text.boundaryIdField}
              value={selectedBoundary.id}
              forbiddenRegex={FORBIDDEN_C4_ID_CHARS_REGEX}
              formatError={safeguard.c4IdErrorChars}
              onCommit={commitBoundaryIdRename}
            />

            <label className="inspector-field">
              <span>{c4Text.boundaryKindField}</span>
              <select
                value={selectedBoundary.kind}
                onChange={(e) => {
                  const nextKind = e.target.value as C4BoundaryKind;
                  updateSelectedBoundary((b) => ({
                    ...b,
                    kind: nextKind,
                    ...(nextKind !== 'boundary' && nextKind !== 'node'
                      ? { boundaryType: undefined }
                      : {}),
                    ...(nextKind !== 'node' ? { descr: undefined } : {}),
                  }));
                }}
              >
                {C4_BOUNDARY_KIND_OPTIONS.map((k) => (
                  <option key={k} value={k}>
                    {c4Text.boundaryKinds[k]}
                  </option>
                ))}
              </select>
            </label>

            <label className="inspector-field">
              <span>{c4Text.boundaryParentField}</span>
              <select
                value={selectedBoundary.parentBoundaryId ?? ''}
                onChange={(e) =>
                  updateSelectedBoundary((b) => ({
                    ...b,
                    parentBoundaryId: e.target.value || undefined,
                  }))
                }
              >
                <option value="">{c4Text.rootBoundaryOption}</option>
                {selectableParentBoundaries.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label} ({b.id})
                  </option>
                ))}
              </select>
            </label>

            <label className="inspector-field">
              <span>{c4Text.boundaryLabelField}</span>
              <GuardedInput
                value={selectedBoundary.label}
                placeholder={c4Text.boundaryLabelPlaceholder}
                forbiddenRegex={FORBIDDEN_C4_QUOTED_TEXT_CHARS_REGEX}
                formatError={safeguard.c4QuotedTextErrorChars}
                onChangeValue={(label) =>
                  updateSelectedBoundary((b) => ({ ...b, label }))
                }
              />
            </label>

            {(selectedBoundary.kind === 'boundary' ||
              selectedBoundary.kind === 'node') && (
              <label className="inspector-field">
                <span>{c4Text.boundaryTypeField}</span>
                <GuardedInput
                  value={selectedBoundary.boundaryType ?? ''}
                  placeholder={c4Text.boundaryTypePlaceholder}
                  forbiddenRegex={FORBIDDEN_C4_QUOTED_TEXT_CHARS_REGEX}
                  formatError={safeguard.c4QuotedTextErrorChars}
                  onChangeValue={(val) =>
                    updateSelectedBoundary((b) => ({
                      ...b,
                      boundaryType: val.trim() ? val : undefined,
                    }))
                  }
                />
              </label>
            )}

            {selectedBoundary.kind === 'node' && (
              <label className="inspector-field">
                <span>{c4Text.boundaryDescrField}</span>
                <GuardedInput
                  value={selectedBoundary.descr ?? ''}
                  placeholder={c4Text.boundaryDescrPlaceholder}
                  forbiddenRegex={FORBIDDEN_C4_QUOTED_TEXT_CHARS_REGEX}
                  formatError={safeguard.c4QuotedTextErrorChars}
                  onChangeValue={(val) =>
                    updateSelectedBoundary((b) => ({
                      ...b,
                      descr: val.trim() ? val : undefined,
                    }))
                  }
                />
              </label>
            )}

            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleDeleteSelectedBoundary}
            >
              <Trash2 size={14} />
              <span>{c4Text.deleteBoundaryBtn}</span>
            </button>
          </>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={c4Text.relationSection}
        badgeText={
          c4Data.relations.length > 0 ? String(c4Data.relations.length) : undefined
        }
        isOpen={openSections.relation}
        onToggle={() => toggleSection('relation')}
      >
        {!selectedRelation ? (
          <p className="inspector-hint">{c4Text.selectRelationPrompt}</p>
        ) : (
          <>
            <label className="inspector-field">
              <span>{c4Text.relTypeField}</span>
              <select
                value={selectedRelation.relType}
                onChange={(e) => {
                  const nextType = e.target.value as C4RelationType;
                  updateSelectedRelation((r) => ({
                    ...r,
                    relType: nextType,
                    ...(nextType !== 'RelIndex' ? { index: undefined } : {}),
                  }));
                }}
              >
                {C4_RELATION_TYPE_OPTIONS.map((rt) => (
                  <option key={rt} value={rt}>
                    {c4Text.relationTypes[rt]}
                  </option>
                ))}
              </select>
            </label>

            {selectedRelation.relType === 'RelIndex' && (
              <label className="inspector-field">
                <span>{c4Text.relIndexField}</span>
                <GuardedInput
                  value={selectedRelation.index ?? ''}
                  placeholder="1"
                  forbiddenRegex={FORBIDDEN_C4_QUOTED_TEXT_CHARS_REGEX}
                  formatError={safeguard.c4QuotedTextErrorChars}
                  onChangeValue={(val) =>
                    updateSelectedRelation((r) => ({
                      ...r,
                      index: val.trim() ? val : undefined,
                    }))
                  }
                />
              </label>
            )}

            <label className="inspector-field">
              <span>{c4Text.relFromField}</span>
              <select
                value={selectedRelation.from}
                onChange={(e) =>
                  updateSelectedRelation((r) => ({ ...r, from: e.target.value }))
                }
              >
                {c4Data.elements.map((el) => (
                  <option key={el.id} value={el.id}>
                    {el.label} ({el.id})
                  </option>
                ))}
              </select>
            </label>

            <label className="inspector-field">
              <span>{c4Text.relToField}</span>
              <select
                value={selectedRelation.to}
                onChange={(e) =>
                  updateSelectedRelation((r) => ({ ...r, to: e.target.value }))
                }
              >
                {c4Data.elements.map((el) => (
                  <option key={el.id} value={el.id}>
                    {el.label} ({el.id})
                  </option>
                ))}
              </select>
            </label>

            <label className="inspector-field">
              <span>{c4Text.relLabelField}</span>
              <GuardedInput
                value={selectedRelation.label}
                placeholder={c4Text.relLabelPlaceholder}
                forbiddenRegex={FORBIDDEN_C4_QUOTED_TEXT_CHARS_REGEX}
                formatError={safeguard.c4QuotedTextErrorChars}
                onChangeValue={(label) =>
                  updateSelectedRelation((r) => ({ ...r, label }))
                }
              />
            </label>

            <label className="inspector-field">
              <span>{c4Text.relTechnField}</span>
              <GuardedInput
                value={selectedRelation.techn ?? ''}
                placeholder={c4Text.relTechnPlaceholder}
                forbiddenRegex={FORBIDDEN_C4_QUOTED_TEXT_CHARS_REGEX}
                formatError={safeguard.c4QuotedTextErrorChars}
                onChangeValue={(val) =>
                  updateSelectedRelation((r) => ({
                    ...r,
                    techn: val.trim() ? val : undefined,
                  }))
                }
              />
            </label>

            <label className="inspector-field">
              <span>{c4Text.relDescrField}</span>
              <GuardedInput
                value={selectedRelation.descr ?? ''}
                placeholder={c4Text.relDescrPlaceholder}
                forbiddenRegex={FORBIDDEN_C4_QUOTED_TEXT_CHARS_REGEX}
                formatError={safeguard.c4QuotedTextErrorChars}
                onChangeValue={(val) =>
                  updateSelectedRelation((r) => ({
                    ...r,
                    descr: val.trim() ? val : undefined,
                  }))
                }
              />
            </label>

            <InspectorColorPalette
              label={c4Text.relLineColorField}
              value={selectedRelation.lineColor}
              items={STROKE_COLOR_PALETTE_ITEMS}
              allowClear={false}
              labelMap={t.inspector.strokeColors}
              onChange={(lineColor) =>
                updateSelectedRelation((r) => ({ ...r, lineColor }))
              }
            />

            <InspectorColorPalette
              label={c4Text.relTextColorField}
              value={selectedRelation.textColor}
              items={STROKE_COLOR_PALETTE_ITEMS}
              allowClear={false}
              labelMap={{
                ...t.inspector.strokeColors,
                default: c4Text.defaultTextColorOption,
              }}
              onChange={(textColor) =>
                updateSelectedRelation((r) => ({ ...r, textColor }))
              }
            />

            <div className="inspector-actions-row">
              <button
                type="button"
                className="btn-secondary btn-xs"
                onClick={() =>
                  updateSelectedRelation((r) => ({
                    ...r,
                    from: r.to,
                    to: r.from,
                  }))
                }
              >
                <ArrowLeftRight size={13} />
                <span>{c4Text.swapEndpointsBtn}</span>
              </button>
              <button
                type="button"
                className="btn-danger-outline"
                onClick={handleDeleteSelectedRelation}
              >
                <Trash2 size={13} />
                <span>{c4Text.deleteRelationBtn}</span>
              </button>
            </div>
          </>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={c4Text.settingsSection}
        badgeText={c4Data.subtype}
        isOpen={openSections.settings}
        onToggle={() => toggleSection('settings')}
      >
        <label className="inspector-field">
          <span>{c4Text.subtypeField}</span>
          <select
            value={c4Data.subtype}
            onChange={(e) =>
              onChange({
                ...c4Data,
                subtype: e.target.value as C4DiagramSubtype,
              })
            }
          >
            {C4_SUBTYPE_OPTIONS.map((st) => (
              <option key={st} value={st}>
                {c4Text.subtypes[st]}
              </option>
            ))}
          </select>
        </label>

        <label className="inspector-field">
          <span>{c4Text.titleField}</span>
          <GuardedInput
            value={c4Data.title ?? ''}
            placeholder={c4Text.titlePlaceholder}
            forbiddenRegex={FORBIDDEN_C4_TITLE_CHARS_REGEX}
            formatError={safeguard.c4TitleErrorChars}
            onChangeValue={(val) =>
              onChange({
                ...c4Data,
                title: val.trim() ? val : undefined,
              })
            }
          />
        </label>

        <label className="inspector-field">
          <span>{c4Text.shapeInRowField}</span>
          <select
            value={c4Data.shapeInRow ?? ''}
            onChange={(e) => {
              const raw = e.target.value;
              onChange({
                ...c4Data,
                shapeInRow: raw ? Number(raw) : undefined,
              });
            }}
          >
            <option value="">{c4Text.autoOption}</option>
            {ROW_COUNT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <label className="inspector-field">
          <span>{c4Text.boundaryInRowField}</span>
          <select
            value={c4Data.boundaryInRow ?? ''}
            onChange={(e) => {
              const raw = e.target.value;
              onChange({
                ...c4Data,
                boundaryInRow: raw ? Number(raw) : undefined,
              });
            }}
          >
            <option value="">{c4Text.autoOption}</option>
            {ROW_COUNT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </InspectorCollapsibleSection>

      <InspectorCommentsSection
        title={c4Text.commentsSection}
        fieldLabel={c4Text.commentsField}
        placeholder={c4Text.commentsPlaceholder}
        comments={c4Data.comments}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
        onChangeComments={(nextComments) =>
          onChange({
            ...c4Data,
            comments: nextComments,
          })
        }
      />
    </div>
  );
}
