import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import {
  InspectorBulkControls,
  InspectorCommentsSection,
} from './InspectorCommon';
import C4BoundarySection from './c4/C4BoundarySection';
import C4ElementSection from './c4/C4ElementSection';
import { C4RelationSection, C4SettingsSection } from './c4/C4RelationSection';
import type {
  C4BoundaryData,
  C4DiagramData,
  C4ElementData,
  C4RelationData,
} from '../types/editor';
import {
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

      <C4ElementSection
        selectedElement={selectedElement}
        boundaries={c4Data.boundaries}
        isOpen={openSections.element}
        onToggle={() => toggleSection('element')}
        onQuickAddRelation={handleQuickAddRelation}
        onCommitElementId={commitElementIdRename}
        onUpdateSelectedElement={updateSelectedElement}
        onDeleteSelectedElement={handleDeleteSelectedElement}
      />

      <C4BoundarySection
        selectedBoundary={selectedBoundary}
        selectableParentBoundaries={selectableParentBoundaries}
        isOpen={openSections.boundary}
        onToggle={() => toggleSection('boundary')}
        onCommitBoundaryId={commitBoundaryIdRename}
        onUpdateSelectedBoundary={updateSelectedBoundary}
        onDeleteSelectedBoundary={handleDeleteSelectedBoundary}
      />

      <C4RelationSection
        elements={c4Data.elements}
        relationsCount={c4Data.relations.length}
        selectedRelation={selectedRelation}
        isOpen={openSections.relation}
        onToggle={() => toggleSection('relation')}
        onUpdateSelectedRelation={updateSelectedRelation}
        onDeleteSelectedRelation={handleDeleteSelectedRelation}
      />

      <C4SettingsSection
        c4Data={c4Data}
        isOpen={openSections.settings}
        onToggle={() => toggleSection('settings')}
        onChange={onChange}
      />

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
