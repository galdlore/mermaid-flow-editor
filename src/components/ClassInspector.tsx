import { useEffect, useState } from 'react';
import { ArrowDown, ArrowLeftRight, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import {
  COLOR_PALETTE_ITEMS,
  InspectorCollapsibleSection,
} from './InspectorCollapsibleSection';
import {
  FORBIDDEN_CLASS_GENERIC_CHARS_REGEX,
  FORBIDDEN_CLASS_ID_CHARS_REGEX,
  FORBIDDEN_CLASS_MEMBER_CHARS_REGEX,
  FORBIDDEN_CLASS_QUOTED_TEXT_CHARS_REGEX,
} from '../utils/inputSafeguard';
import type {
  ClassDiagramData,
  ClassDiagramDirection,
  ClassMemberClassifier,
  ClassMemberData,
  ClassMemberKind,
  ClassMemberVisibility,
  ClassNodeData,
  ClassNoteData,
  ClassRelationData,
  ClassRelationType,
} from '../types/editor';
import {
  CLASS_DIRECTION_OPTIONS,
  CLASS_RELATION_OPTIONS,
  CLASS_STEREOTYPE_SUGGESTIONS,
  CLASS_VISIBILITY_OPTIONS,
  createUniqueClassMemberId,
  createUniqueClassNoteId,
  formatClassMemberSignature,
  sanitizeClassId,
} from '../utils/classConverter';

export interface ClassInspectorProps {
  classData: ClassDiagramData;
  selectedClassId: string | null;
  selectedRelationId: string | null;
  onChange: (next: ClassDiagramData) => void;
  onSelectClass: (classId: string | null) => void;
  onSelectRelation: (relationId: string | null) => void;
}

type ClassSectionKey = 'class' | 'relation' | 'notes' | 'settings' | 'comments';

export default function ClassInspector({
  classData,
  selectedClassId,
  selectedRelationId,
  onChange,
  onSelectClass,
  onSelectRelation,
}: ClassInspectorProps) {
  const { t } = useI18n();
  const c = t.inspector.classDiagram;
  const safeguard = t.inspector.safeguard;

  const selectedClass =
    classData.classes.find((item) => item.id === selectedClassId) ?? null;
  const selectedRelation =
    classData.relations.find((item) => item.id === selectedRelationId) ?? null;
  const notes = classData.notes ?? [];

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [classIdDraft, setClassIdDraft] = useState(selectedClass?.id ?? '');
  const [commentInputs, setCommentInputs] = useState<string[]>(
    classData.comments ?? []
  );
  const [openSections, setOpenSections] = useState<Record<ClassSectionKey, boolean>>({
    class: true,
    relation: true,
    notes: false,
    settings: false,
    comments: false,
  });

  useEffect(() => {
    setClassIdDraft(selectedClass?.id ?? '');
    if (!selectedClass) {
      setSelectedMemberId(null);
      return;
    }
    setSelectedMemberId((prev) =>
      prev && selectedClass.members.some((m) => m.id === prev)
        ? prev
        : selectedClass.members[0]?.id ?? null
    );
  }, [selectedClass]);

  useEffect(() => {
    setCommentInputs(classData.comments ?? []);
  }, [classData.comments]);

  useEffect(() => {
    if (selectedClassId) {
      setOpenSections((prev) => (prev.class ? prev : { ...prev, class: true }));
    }
  }, [selectedClassId]);

  useEffect(() => {
    if (selectedRelationId) {
      setOpenSections((prev) =>
        prev.relation ? prev : { ...prev, relation: true }
      );
    }
  }, [selectedRelationId]);

  const toggleSection = (key: ClassSectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSections = (open: boolean): void => {
    setOpenSections({
      class: open,
      relation: open,
      notes: open,
      settings: open,
      comments: open,
    });
  };

  const allExpanded = Object.values(openSections).every(Boolean);

  const selectedMember =
    selectedClass?.members.find((m) => m.id === selectedMemberId) ??
    selectedClass?.members[0] ??
    null;

  const updateSelectedClass = (
    updater: (cls: ClassNodeData) => ClassNodeData
  ): void => {
    if (!selectedClass) return;
    onChange({
      ...classData,
      classes: classData.classes.map((cls) =>
        cls.id === selectedClass.id ? updater(cls) : cls
      ),
    });
  };

  const commitClassIdRename = (): void => {
    if (!selectedClass) return;
    const oldId = selectedClass.id;
    const baseNext = sanitizeClassId(classIdDraft, oldId);
    const otherIds = new Set(
      classData.classes.filter((item) => item.id !== oldId).map((item) => item.id)
    );
    let uniqueNext = baseNext;
    let suffix = 2;
    while (otherIds.has(uniqueNext)) {
      uniqueNext = `${baseNext}_${suffix++}`;
    }

    setClassIdDraft(uniqueNext);
    if (uniqueNext === oldId) {
      return;
    }

    const nextNotes = notes.map((n) =>
      n.targetClassId === oldId ? { ...n, targetClassId: uniqueNext } : n
    );

    onChange({
      ...classData,
      classes: classData.classes.map((cls) =>
        cls.id === oldId ? { ...cls, id: uniqueNext } : cls
      ),
      relations: classData.relations.map((rel) => ({
        ...rel,
        from: rel.from === oldId ? uniqueNext : rel.from,
        to: rel.to === oldId ? uniqueNext : rel.to,
      })),
      ...(nextNotes.length > 0 ? { notes: nextNotes } : {}),
    });
    onSelectClass(uniqueNext);
  };

  const handleDeleteSelectedClass = (): void => {
    if (!selectedClass) return;
    const delId = selectedClass.id;
    const nextClasses = classData.classes.filter((item) => item.id !== delId);
    const nextRelations = classData.relations.filter(
      (rel) => rel.from !== delId && rel.to !== delId
    );
    const nextNotes = notes.map((n) =>
      n.targetClassId === delId ? { ...n, targetClassId: undefined } : n
    );
    onChange({
      ...classData,
      classes: nextClasses,
      relations: nextRelations,
      ...(nextNotes.length > 0 ? { notes: nextNotes } : { notes: undefined }),
    });
    onSelectClass(nextClasses[0]?.id ?? null);
    if (
      selectedRelationId &&
      !nextRelations.some((rel) => rel.id === selectedRelationId)
    ) {
      onSelectRelation(nextRelations[0]?.id ?? null);
    }
  };

  const handleAddMember = (kind: ClassMemberKind): void => {
    if (!selectedClass) return;
    const nextId = createUniqueClassMemberId(classData.classes);
    const created: ClassMemberData =
      kind === 'method'
        ? {
            id: nextId,
            kind: 'method',
            visibility: '+',
            name: `action${selectedClass.members.length + 1}`,
            params: '',
            type: 'void',
          }
        : {
            id: nextId,
            kind: 'field',
            visibility: '-',
            type: 'string',
            name: `field${selectedClass.members.length + 1}`,
          };
    updateSelectedClass((cls) => ({
      ...cls,
      members: [...cls.members, created],
    }));
    setSelectedMemberId(nextId);
  };

  const handleMoveMember = (memberId: string, delta: -1 | 1): void => {
    if (!selectedClass) return;
    const idx = selectedClass.members.findIndex((m) => m.id === memberId);
    const nextIdx = idx + delta;
    if (idx < 0 || nextIdx < 0 || nextIdx >= selectedClass.members.length) {
      return;
    }
    const copy = [...selectedClass.members];
    const [moved] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, moved);
    updateSelectedClass((cls) => ({ ...cls, members: copy }));
  };

  const handleDeleteMember = (memberId: string): void => {
    if (!selectedClass) return;
    const nextMembers = selectedClass.members.filter((m) => m.id !== memberId);
    updateSelectedClass((cls) => ({ ...cls, members: nextMembers }));
    if (selectedMember?.id === memberId) {
      setSelectedMemberId(nextMembers[0]?.id ?? null);
    }
  };

  const updateSelectedMember = (
    updater: (m: ClassMemberData) => ClassMemberData
  ): void => {
    if (!selectedClass || !selectedMember) return;
    updateSelectedClass((cls) => ({
      ...cls,
      members: cls.members.map((m) => (m.id === selectedMember.id ? updater(m) : m)),
    }));
  };

  const updateSelectedRelation = (
    updater: (rel: ClassRelationData) => ClassRelationData
  ): void => {
    if (!selectedRelation) return;
    onChange({
      ...classData,
      relations: classData.relations.map((rel) =>
        rel.id === selectedRelation.id ? updater(rel) : rel
      ),
    });
  };

  const handleDeleteSelectedRelation = (): void => {
    if (!selectedRelation) return;
    const nextRelations = classData.relations.filter(
      (rel) => rel.id !== selectedRelation.id
    );
    onChange({ ...classData, relations: nextRelations });
    onSelectRelation(nextRelations[0]?.id ?? null);
  };

  const handleAddNote = (): void => {
    const nextId = createUniqueClassNoteId(notes);
    const created: ClassNoteData = {
      id: nextId,
      ...(selectedClassId ? { targetClassId: selectedClassId } : {}),
      text: c.defaultNoteText,
    };
    onChange({ ...classData, notes: [...notes, created] });
  };

  const updateNote = (noteId: string, updater: (n: ClassNoteData) => ClassNoteData): void => {
    onChange({
      ...classData,
      notes: notes.map((n) => (n.id === noteId ? updater(n) : n)),
    });
  };

  const deleteNote = (noteId: string): void => {
    const nextNotes = notes.filter((n) => n.id !== noteId);
    onChange({
      ...classData,
      notes: nextNotes.length > 0 ? nextNotes : undefined,
    });
  };

  const comments = classData.comments ?? [];
  const handleCommentsChange = (lines: string[]): void => {
    setCommentInputs(lines);
    const cleaned = lines.map((line) => line.trim()).filter((line) => line.length > 0);
    onChange({
      ...classData,
      comments: cleaned.length > 0 ? cleaned : undefined,
    });
  };

  return (
    <div className="inspector-panel">
      <div className="inspector-accordion-controls">
        <button
          type="button"
          className="inspector-accordion-ctrl-btn"
          onClick={() => setAllSections(!allExpanded)}
        >
          {allExpanded
            ? t.inspector.collapseAllSections
            : t.inspector.expandAllSections}
        </button>
      </div>

      <InspectorCollapsibleSection
        title={c.classSection}
        badgeText={selectedClass ? selectedClass.id : undefined}
        isOpen={openSections.class}
        onToggle={() => toggleSection('class')}
      >
        {!selectedClass ? (
          <p className="inspector-hint">{c.selectClassPrompt}</p>
        ) : (
          <>
            <div className="inspector-field" onBlur={commitClassIdRename}>
              <span>{c.classIdField}</span>
              <GuardedInput
                value={classIdDraft}
                placeholder="User"
                forbiddenRegex={FORBIDDEN_CLASS_ID_CHARS_REGEX}
                formatError={safeguard.classIdErrorChars}
                onChangeValue={setClassIdDraft}
              />
            </div>

            <label className="inspector-field">
              <span>{c.classLabelField}</span>
              <GuardedInput
                value={selectedClass.label ?? ''}
                placeholder={c.classLabelPlaceholder}
                forbiddenRegex={FORBIDDEN_CLASS_QUOTED_TEXT_CHARS_REGEX}
                formatError={safeguard.classQuotedTextErrorChars}
                onChangeValue={(nextVal) =>
                  updateSelectedClass((cls) => ({
                    ...cls,
                    label: nextVal || undefined,
                  }))
                }
              />
            </label>

            <div className="field-row-compact">
              <label className="inspector-field">
                <span>{c.classGenericField}</span>
                <GuardedInput
                  value={selectedClass.generic ?? ''}
                  placeholder={c.classGenericPlaceholder}
                  forbiddenRegex={FORBIDDEN_CLASS_GENERIC_CHARS_REGEX}
                  formatError={safeguard.classGenericErrorChars}
                  onChangeValue={(nextVal) =>
                    updateSelectedClass((cls) => ({
                      ...cls,
                      generic: nextVal || undefined,
                    }))
                  }
                />
              </label>

              <label className="inspector-field">
                <span>{c.classNamespaceField}</span>
                <GuardedInput
                  value={selectedClass.namespace ?? ''}
                  placeholder={c.classNamespacePlaceholder}
                  forbiddenRegex={FORBIDDEN_CLASS_ID_CHARS_REGEX}
                  formatError={safeguard.classIdErrorChars}
                  onChangeValue={(nextVal) =>
                    updateSelectedClass((cls) => ({
                      ...cls,
                      namespace: nextVal || undefined,
                    }))
                  }
                />
              </label>
            </div>

            <label className="inspector-field">
              <span>{c.classStereotypeField}</span>
              <select
                value={selectedClass.stereotype ?? ''}
                onChange={(ev) =>
                  updateSelectedClass((cls) => ({
                    ...cls,
                    stereotype: ev.target.value || undefined,
                  }))
                }
              >
                {CLASS_STEREOTYPE_SUGGESTIONS.map((st) => (
                  <option key={st || '__none'} value={st}>
                    {c.stereotypeOptions[st] ?? `<<${st}>>`}
                  </option>
                ))}
              </select>
            </label>

            <div className="inspector-field">
              <span>{c.classColorField}</span>
              <div className="color-palette-grid">
                <button
                  type="button"
                  className={`color-swatch is-transparent ${
                    !selectedClass.color ? 'is-active' : ''
                  }`}
                  title={c.noColorOption}
                  onClick={() =>
                    updateSelectedClass((cls) => ({ ...cls, color: undefined }))
                  }
                />
                {COLOR_PALETTE_ITEMS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`color-swatch ${
                      selectedClass.color === item.value ? 'is-active' : ''
                    }`}
                    style={{ backgroundColor: item.value }}
                    title={t.inspector.colors[item.key]}
                    onClick={() =>
                      updateSelectedClass((cls) => ({ ...cls, color: item.value }))
                    }
                  />
                ))}
              </div>
            </div>

            <div className="er-attrs-editor">
              <div className="inspector-section-subhead">
                <span>
                  {c.membersHeading} ({selectedClass.members.length})
                </span>
                <div className="cls-subhead-actions">
                  <button
                    type="button"
                    className="btn-secondary btn-xs"
                    onClick={() => handleAddMember('field')}
                  >
                    <Plus size={11} />
                    <span>{c.addFieldBtn}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-xs"
                    onClick={() => handleAddMember('method')}
                  >
                    <Plus size={11} />
                    <span>{c.addMethodBtn}</span>
                  </button>
                </div>
              </div>

              {selectedClass.members.length === 0 ? (
                <p className="inspector-hint">{c.emptyMembers}</p>
              ) : (
                <>
                  <div className="er-inspector-attr-list">
                    {selectedClass.members.map((m, idx) => {
                      const isActive = m.id === selectedMember?.id;
                      return (
                        <div
                          key={m.id}
                          className={`er-inspector-attr-item ${
                            isActive ? 'is-active' : ''
                          }`}
                          onClick={() => setSelectedMemberId(m.id)}
                        >
                          <span className="er-inspector-attr-label">
                            {formatClassMemberSignature(m)}
                          </span>
                          <div
                            className="er-inspector-attr-actions"
                            onClick={(ev) => ev.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="treeview-action-btn"
                              disabled={idx === 0}
                              title={c.moveUpTitle}
                              onClick={() => handleMoveMember(m.id, -1)}
                            >
                              <ArrowUp size={11} />
                            </button>
                            <button
                              type="button"
                              className="treeview-action-btn"
                              disabled={idx === selectedClass.members.length - 1}
                              title={c.moveDownTitle}
                              onClick={() => handleMoveMember(m.id, 1)}
                            >
                              <ArrowDown size={11} />
                            </button>
                            <button
                              type="button"
                              className="treeview-action-btn is-danger"
                              title={c.deleteMemberTitle}
                              onClick={() => handleDeleteMember(m.id)}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedMember && (
                    <div className="er-attr-detail-box">
                      <div className="field-row-compact">
                        <label className="inspector-field">
                          <span>{c.memberKindField}</span>
                          <select
                            value={selectedMember.kind}
                            onChange={(ev) =>
                              updateSelectedMember((m) => ({
                                ...m,
                                kind: ev.target.value as ClassMemberKind,
                              }))
                            }
                          >
                            <option value="field">{c.memberKinds.field}</option>
                            <option value="method">{c.memberKinds.method}</option>
                          </select>
                        </label>

                        <label className="inspector-field">
                          <span>{c.memberVisibilityField}</span>
                          <select
                            value={selectedMember.visibility}
                            onChange={(ev) =>
                              updateSelectedMember((m) => ({
                                ...m,
                                visibility: ev.target.value as ClassMemberVisibility,
                              }))
                            }
                          >
                            {CLASS_VISIBILITY_OPTIONS.map((vis) => (
                              <option key={vis || '__none'} value={vis}>
                                {c.visibilities[vis]}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="field-row-compact">
                        <label className="inspector-field">
                          <span>{c.memberNameField}</span>
                          <GuardedInput
                            value={selectedMember.name}
                            placeholder="id"
                            forbiddenRegex={FORBIDDEN_CLASS_MEMBER_CHARS_REGEX}
                            formatError={safeguard.classMemberErrorChars}
                            onChangeValue={(nextVal) =>
                              updateSelectedMember((m) => ({
                                ...m,
                                name: nextVal || 'member',
                              }))
                            }
                          />
                        </label>

                        <label className="inspector-field">
                          <span>
                            {selectedMember.kind === 'method'
                              ? c.memberReturnTypeField
                              : c.memberTypeField}
                          </span>
                          <GuardedInput
                            value={selectedMember.type ?? ''}
                            placeholder="string"
                            forbiddenRegex={FORBIDDEN_CLASS_MEMBER_CHARS_REGEX}
                            formatError={safeguard.classMemberErrorChars}
                            onChangeValue={(nextVal) =>
                              updateSelectedMember((m) => ({
                                ...m,
                                type: nextVal || undefined,
                              }))
                            }
                          />
                        </label>
                      </div>

                      {selectedMember.kind === 'method' && (
                        <label className="inspector-field">
                          <span>{c.memberParamsField}</span>
                          <GuardedInput
                            value={selectedMember.params ?? ''}
                            placeholder={c.memberParamsPlaceholder}
                            forbiddenRegex={FORBIDDEN_CLASS_MEMBER_CHARS_REGEX}
                            formatError={safeguard.classMemberErrorChars}
                            onChangeValue={(nextVal) =>
                              updateSelectedMember((m) => ({
                                ...m,
                                params: nextVal || undefined,
                              }))
                            }
                          />
                        </label>
                      )}

                      <label className="inspector-field">
                        <span>{c.memberClassifierField}</span>
                        <select
                          value={selectedMember.classifier ?? 'none'}
                          onChange={(ev) => {
                            const val = ev.target.value as ClassMemberClassifier;
                            updateSelectedMember((m) => ({
                              ...m,
                              classifier: val === 'none' ? undefined : val,
                            }));
                          }}
                        >
                          <option value="none">{c.classifiers.none}</option>
                          <option value="static">{c.classifiers.static}</option>
                          {selectedMember.kind === 'method' && (
                            <option value="abstract">{c.classifiers.abstract}</option>
                          )}
                        </select>
                      </label>
                    </div>
                  )}
                </>
              )}
            </div>

            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleDeleteSelectedClass}
            >
              <Trash2 size={13} />
              <span>{c.deleteClassBtn}</span>
            </button>
          </>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={c.relationSection}
        badgeText={classData.relations.length}
        isOpen={openSections.relation}
        onToggle={() => toggleSection('relation')}
      >
        {!selectedRelation ? (
          <p className="inspector-hint">{c.selectRelationPrompt}</p>
        ) : (
          <>
            <div className="field-row-compact">
              <label className="inspector-field">
                <span>{c.relFromField}</span>
                <select
                  value={selectedRelation.from}
                  onChange={(ev) =>
                    updateSelectedRelation((rel) => ({ ...rel, from: ev.target.value }))
                  }
                >
                  {classData.classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.label ? `${cls.label} (${cls.id})` : cls.id}
                    </option>
                  ))}
                </select>
              </label>

              <label className="inspector-field">
                <span>{c.relToField}</span>
                <select
                  value={selectedRelation.to}
                  onChange={(ev) =>
                    updateSelectedRelation((rel) => ({ ...rel, to: ev.target.value }))
                  }
                >
                  {classData.classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.label ? `${cls.label} (${cls.id})` : cls.id}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="button"
              className="btn-secondary btn-xs seq-swap-btn"
              onClick={() =>
                updateSelectedRelation((rel) => ({
                  ...rel,
                  from: rel.to,
                  to: rel.from,
                  fromCardinality: rel.toCardinality,
                  toCardinality: rel.fromCardinality,
                }))
              }
            >
              <ArrowLeftRight size={12} />
              <span>{c.swapEndpointsBtn}</span>
            </button>

            <label className="inspector-field">
              <span>{c.relTypeField}</span>
              <select
                value={selectedRelation.relationType}
                onChange={(ev) =>
                  updateSelectedRelation((rel) => ({
                    ...rel,
                    relationType: ev.target.value as ClassRelationType,
                  }))
                }
              >
                {CLASS_RELATION_OPTIONS.map((rt) => (
                  <option key={rt} value={rt}>
                    {c.relationTypes[rt]}
                  </option>
                ))}
              </select>
            </label>

            <div className="field-row-compact">
              <label className="inspector-field">
                <span>{c.relFromCardField}</span>
                <GuardedInput
                  value={selectedRelation.fromCardinality ?? ''}
                  placeholder="1"
                  forbiddenRegex={FORBIDDEN_CLASS_QUOTED_TEXT_CHARS_REGEX}
                  formatError={safeguard.classQuotedTextErrorChars}
                  onChangeValue={(nextVal) =>
                    updateSelectedRelation((rel) => ({
                      ...rel,
                      fromCardinality: nextVal || undefined,
                    }))
                  }
                />
              </label>

              <label className="inspector-field">
                <span>{c.relToCardField}</span>
                <GuardedInput
                  value={selectedRelation.toCardinality ?? ''}
                  placeholder="0..*"
                  forbiddenRegex={FORBIDDEN_CLASS_QUOTED_TEXT_CHARS_REGEX}
                  formatError={safeguard.classQuotedTextErrorChars}
                  onChangeValue={(nextVal) =>
                    updateSelectedRelation((rel) => ({
                      ...rel,
                      toCardinality: nextVal || undefined,
                    }))
                  }
                />
              </label>
            </div>

            <label className="inspector-field">
              <span>{c.relLabelField}</span>
              <GuardedInput
                value={selectedRelation.label ?? ''}
                placeholder={c.relLabelPlaceholder}
                forbiddenRegex={FORBIDDEN_CLASS_MEMBER_CHARS_REGEX}
                formatError={safeguard.classMemberErrorChars}
                onChangeValue={(nextVal) =>
                  updateSelectedRelation((rel) => ({
                    ...rel,
                    label: nextVal || undefined,
                  }))
                }
              />
            </label>

            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleDeleteSelectedRelation}
            >
              <Trash2 size={13} />
              <span>{c.deleteRelationBtn}</span>
            </button>
          </>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={c.notesSection}
        badgeText={notes.length > 0 ? notes.length : undefined}
        isOpen={openSections.notes}
        onToggle={() => toggleSection('notes')}
        headerAction={
          <button
            type="button"
            className="btn-secondary btn-xs"
            onClick={handleAddNote}
          >
            <Plus size={11} />
            <span>{c.addNoteBtn}</span>
          </button>
        }
      >
        {notes.length === 0 ? (
          <p className="inspector-hint">{c.emptyNotes}</p>
        ) : (
          <div className="seq-box-list">
            {notes.map((n) => (
              <div key={n.id} className="seq-box-item">
                <div className="seq-branch-card-row">
                  <select
                    value={n.targetClassId ?? ''}
                    onChange={(ev) =>
                      updateNote(n.id, (prev) => ({
                        ...prev,
                        targetClassId: ev.target.value || undefined,
                      }))
                    }
                  >
                    <option value="">{c.noteGeneralOption}</option>
                    {classData.classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.label ? `${cls.label} (${cls.id})` : cls.id}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-icon-danger"
                    title={c.deleteNoteTitle}
                    onClick={() => deleteNote(n.id)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <GuardedInput
                  value={n.text}
                  placeholder={c.noteTextPlaceholder}
                  forbiddenRegex={FORBIDDEN_CLASS_QUOTED_TEXT_CHARS_REGEX}
                  formatError={safeguard.classQuotedTextErrorChars}
                  onChangeValue={(nextVal) =>
                    updateNote(n.id, (prev) => ({ ...prev, text: nextVal }))
                  }
                />
              </div>
            ))}
          </div>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={c.settingsSection}
        isOpen={openSections.settings}
        onToggle={() => toggleSection('settings')}
      >
        <label className="inspector-field">
          <span>{c.titleField}</span>
          <GuardedInput
            value={classData.title ?? ''}
            placeholder={c.titlePlaceholder}
            forbiddenRegex={FORBIDDEN_CLASS_QUOTED_TEXT_CHARS_REGEX}
            formatError={safeguard.classQuotedTextErrorChars}
            onChangeValue={(nextVal) =>
              onChange({
                ...classData,
                title: nextVal || undefined,
              })
            }
          />
        </label>

        <label className="inspector-field">
          <span>{c.directionField}</span>
          <select
            value={classData.direction ?? 'TB'}
            onChange={(ev) =>
              onChange({
                ...classData,
                direction: ev.target.value as ClassDiagramDirection,
              })
            }
          >
            {CLASS_DIRECTION_OPTIONS.map((dir) => (
              <option key={dir} value={dir}>
                {c.directions[dir]}
              </option>
            ))}
          </select>
        </label>
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={c.commentsSection}
        badgeText={comments.length > 0 ? comments.length : undefined}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
      >
        <label className="inspector-field">
          <span>{c.commentsField}</span>
          <textarea
            className="inspector-comments-textarea"
            rows={4}
            placeholder={c.commentsPlaceholder}
            value={commentInputs.join('\n')}
            onChange={(ev) => handleCommentsChange(ev.target.value.split('\n'))}
          />
        </label>
      </InspectorCollapsibleSection>
    </div>
  );
}
