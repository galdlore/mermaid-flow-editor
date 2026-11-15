import { useMemo } from 'react';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Box,
  ChevronLeft,
  ChevronRight,
  Link2,
  Plus,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { useI18n } from '../i18n';
import type {
  ClassDiagramData,
  ClassMemberData,
  ClassMemberKind,
  ClassNodeData,
  ClassNoteData,
  ClassRelationData,
} from '../types/editor';
import {
  createUniqueClassId,
  createUniqueClassMemberId,
  createUniqueClassNoteId,
  createUniqueClassRelationId,
  formatClassMemberSignature,
} from '../utils/classConverter';

export interface ClassCanvasProps {
  classData: ClassDiagramData;
  selectedClassId: string | null;
  selectedRelationId: string | null;
  onChange: (next: ClassDiagramData) => void;
  onSelectClass: (classId: string | null) => void;
  onSelectRelation: (relationId: string | null) => void;
}

function getClassDisplay(cls: ClassNodeData | undefined, fallbackId: string): string {
  if (!cls) return fallbackId;
  const genericSuffix = cls.generic ? `<${cls.generic}>` : '';
  return cls.label
    ? `${cls.label} (${cls.id}${genericSuffix})`
    : `${cls.id}${genericSuffix}`;
}

export default function ClassCanvas({
  classData,
  selectedClassId,
  selectedRelationId,
  onChange,
  onSelectClass,
  onSelectRelation,
}: ClassCanvasProps) {
  const { t } = useI18n();
  const c = t.inspector.classDiagram;

  const classMap = useMemo(() => {
    const map = new Map<string, ClassNodeData>();
    for (const cls of classData.classes) {
      map.set(cls.id, cls);
    }
    return map;
  }, [classData.classes]);

  const notes = classData.notes ?? [];

  const handleAddClass = (): void => {
    const nextId = createUniqueClassId(classData.classes);
    const nextMemId = createUniqueClassMemberId(classData.classes);
    const created: ClassNodeData = {
      id: nextId,
      label: c.defaultClassLabel(classData.classes.length + 1),
      members: [
        {
          id: nextMemId,
          kind: 'field',
          visibility: '-',
          type: 'string',
          name: 'name',
        },
      ],
    };
    onChange({
      ...classData,
      classes: [...classData.classes, created],
    });
    onSelectClass(nextId);
  };

  const handleMoveClass = (classId: string, delta: -1 | 1): void => {
    const idx = classData.classes.findIndex((item) => item.id === classId);
    const targetIdx = idx + delta;
    if (idx < 0 || targetIdx < 0 || targetIdx >= classData.classes.length) {
      return;
    }
    const copy = [...classData.classes];
    const [moved] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, moved);
    onChange({ ...classData, classes: copy });
  };

  const handleDeleteClass = (classId: string): void => {
    const nextClasses = classData.classes.filter((item) => item.id !== classId);
    const nextRelations = classData.relations.filter(
      (rel) => rel.from !== classId && rel.to !== classId
    );
    const nextNotes = notes.map((n) =>
      n.targetClassId === classId ? { ...n, targetClassId: undefined } : n
    );
    onChange({
      ...classData,
      classes: nextClasses,
      relations: nextRelations,
      ...(nextNotes.length > 0 ? { notes: nextNotes } : { notes: undefined }),
    });
    if (selectedClassId === classId) {
      onSelectClass(nextClasses[0]?.id ?? null);
    }
    if (
      selectedRelationId &&
      !nextRelations.some((rel) => rel.id === selectedRelationId)
    ) {
      onSelectRelation(nextRelations[0]?.id ?? null);
    }
  };

  const handleAddMemberToClass = (classId: string, kind: ClassMemberKind): void => {
    const target = classData.classes.find((item) => item.id === classId);
    if (!target) return;
    const nextMemId = createUniqueClassMemberId(classData.classes);
    const created: ClassMemberData =
      kind === 'method'
        ? {
            id: nextMemId,
            kind: 'method',
            visibility: '+',
            name: `action${target.members.length + 1}`,
            params: '',
            type: 'void',
          }
        : {
            id: nextMemId,
            kind: 'field',
            visibility: '-',
            type: 'string',
            name: `field${target.members.length + 1}`,
          };

    onChange({
      ...classData,
      classes: classData.classes.map((cls) =>
        cls.id === classId ? { ...cls, members: [...cls.members, created] } : cls
      ),
    });
    onSelectClass(classId);
  };

  const handleMoveMember = (classId: string, memberId: string, delta: -1 | 1): void => {
    onChange({
      ...classData,
      classes: classData.classes.map((cls) => {
        if (cls.id !== classId) return cls;
        const idx = cls.members.findIndex((m) => m.id === memberId);
        const nextIdx = idx + delta;
        if (idx < 0 || nextIdx < 0 || nextIdx >= cls.members.length) {
          return cls;
        }
        const copy = [...cls.members];
        const [moved] = copy.splice(idx, 1);
        copy.splice(nextIdx, 0, moved);
        return { ...cls, members: copy };
      }),
    });
  };

  const handleDeleteMember = (classId: string, memberId: string): void => {
    onChange({
      ...classData,
      classes: classData.classes.map((cls) =>
        cls.id === classId
          ? { ...cls, members: cls.members.filter((m) => m.id !== memberId) }
          : cls
      ),
    });
  };

  const handleAddRelation = (): void => {
    if (classData.classes.length === 0) return;
    const fromCls =
      classData.classes.find((item) => item.id === selectedClassId) ??
      classData.classes[0];
    const toCls =
      classData.classes.find((item) => item.id !== fromCls.id) ?? fromCls;
    const nextRelId = createUniqueClassRelationId(classData.relations);
    const created: ClassRelationData = {
      id: nextRelId,
      from: fromCls.id,
      to: toCls.id,
      relationType: '-->',
      label: c.defaultRelationLabel,
    };
    onChange({
      ...classData,
      relations: [...classData.relations, created],
    });
    onSelectRelation(nextRelId);
  };

  const handleMoveRelation = (relId: string, delta: -1 | 1): void => {
    const idx = classData.relations.findIndex((item) => item.id === relId);
    const nextIdx = idx + delta;
    if (idx < 0 || nextIdx < 0 || nextIdx >= classData.relations.length) {
      return;
    }
    const copy = [...classData.relations];
    const [moved] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, moved);
    onChange({ ...classData, relations: copy });
  };

  const handleSwapRelation = (relId: string): void => {
    onChange({
      ...classData,
      relations: classData.relations.map((rel) =>
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

  const handleDeleteRelation = (relId: string): void => {
    const nextRelations = classData.relations.filter((rel) => rel.id !== relId);
    onChange({ ...classData, relations: nextRelations });
    if (selectedRelationId === relId) {
      onSelectRelation(nextRelations[0]?.id ?? null);
    }
  };

  const handleAddNote = (): void => {
    const nextNoteId = createUniqueClassNoteId(notes);
    const newNote: ClassNoteData = {
      id: nextNoteId,
      ...(selectedClassId ? { targetClassId: selectedClassId } : {}),
      text: c.defaultNoteText,
    };
    onChange({
      ...classData,
      notes: [...notes, newNote],
    });
  };

  const handleDeleteNote = (noteId: string): void => {
    const nextNotes = notes.filter((n) => n.id !== noteId);
    onChange({
      ...classData,
      notes: nextNotes.length > 0 ? nextNotes : undefined,
    });
  };

  const targetClassForAdd =
    classData.classes.find((item) => item.id === selectedClassId)?.id ??
    classData.classes[0]?.id ??
    null;

  return (
    <div className="er-canvas">
      <div className="treeview-toolbar">
        <div className="treeview-toolbar-group">
          <button
            type="button"
            className="btn-secondary treeview-toolbar-btn"
            onClick={handleAddClass}
          >
            <Box size={14} />
            <span>{c.addClassBtn}</span>
          </button>
          <button
            type="button"
            className="btn-secondary treeview-toolbar-btn"
            disabled={!targetClassForAdd}
            onClick={() => {
              if (targetClassForAdd) {
                handleAddMemberToClass(targetClassForAdd, 'field');
              }
            }}
          >
            <Plus size={14} />
            <span>{c.addFieldBtn}</span>
          </button>
          <button
            type="button"
            className="btn-secondary treeview-toolbar-btn"
            disabled={!targetClassForAdd}
            onClick={() => {
              if (targetClassForAdd) {
                handleAddMemberToClass(targetClassForAdd, 'method');
              }
            }}
          >
            <Plus size={14} />
            <span>{c.addMethodBtn}</span>
          </button>
        </div>

        <div className="treeview-toolbar-group">
          <button
            type="button"
            className="btn-secondary treeview-toolbar-btn"
            disabled={classData.classes.length === 0}
            onClick={handleAddRelation}
          >
            <Link2 size={14} />
            <span>{c.addRelationBtn}</span>
          </button>
          <button
            type="button"
            className="btn-secondary treeview-toolbar-btn"
            onClick={handleAddNote}
          >
            <StickyNote size={14} />
            <span>{c.addNoteBtn}</span>
          </button>
        </div>

        <div className="seq-toolbar-meta">
          <span className="seq-meta-pill">{classData.direction ?? 'TB'}</span>
          {classData.title && (
            <span className="treeview-title-pill">{classData.title}</span>
          )}
        </div>
      </div>

      <div className="er-canvas-scroll">
        {classData.classes.length === 0 ? (
          <div className="treeview-empty-state">{c.emptyClasses}</div>
        ) : (
          <div className="er-board">
            <div className="er-entities-grid">
              {classData.classes.map((cls, clsIdx) => {
                const isSelected = cls.id === selectedClassId;
                const fields = cls.members.filter((m) => m.kind === 'field');
                const methods = cls.members.filter((m) => m.kind === 'method');

                const renderMemberRow = (m: ClassMemberData) => {
                  const rawIndex = cls.members.findIndex((item) => item.id === m.id);
                  return (
                    <div key={m.id} className="cls-member-row">
                      <span className="cls-member-sig">
                        {formatClassMemberSignature(m)}
                      </span>
                      <div
                        className="er-attr-row-actions"
                        onClick={(ev) => ev.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="treeview-action-btn"
                          disabled={rawIndex <= 0}
                          title={c.moveUpTitle}
                          onClick={() => handleMoveMember(cls.id, m.id, -1)}
                        >
                          <ArrowUp size={11} />
                        </button>
                        <button
                          type="button"
                          className="treeview-action-btn"
                          disabled={rawIndex === cls.members.length - 1}
                          title={c.moveDownTitle}
                          onClick={() => handleMoveMember(cls.id, m.id, 1)}
                        >
                          <ArrowDown size={11} />
                        </button>
                        <button
                          type="button"
                          className="treeview-action-btn is-danger"
                          title={c.deleteMemberTitle}
                          onClick={() => handleDeleteMember(cls.id, m.id)}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  );
                };

                return (
                  <div
                    key={cls.id}
                    className={`er-entity-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => onSelectClass(cls.id)}
                  >
                    <div
                      className="cls-card-header"
                      style={cls.color ? { backgroundColor: cls.color } : undefined}
                    >
                      <div className="cls-card-badges">
                        {cls.namespace && (
                          <span className="cls-namespace-pill">{cls.namespace}</span>
                        )}
                        {cls.stereotype && (
                          <span className="cls-stereotype-pill">
                            &lt;&lt;{cls.stereotype}&gt;&gt;
                          </span>
                        )}
                        <div
                          className="er-entity-actions cls-header-actions"
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          <span className="er-attr-count-badge">
                            {c.memberCountLabel(cls.members.length)}
                          </span>
                          <button
                            type="button"
                            className="treeview-action-btn"
                            disabled={clsIdx === 0}
                            title={c.moveLeftTitle}
                            onClick={() => handleMoveClass(cls.id, -1)}
                          >
                            <ChevronLeft size={11} />
                          </button>
                          <button
                            type="button"
                            className="treeview-action-btn"
                            disabled={clsIdx === classData.classes.length - 1}
                            title={c.moveRightTitle}
                            onClick={() => handleMoveClass(cls.id, 1)}
                          >
                            <ChevronRight size={11} />
                          </button>
                          <button
                            type="button"
                            className="treeview-action-btn is-danger"
                            title={c.deleteClassBtn}
                            onClick={() => handleDeleteClass(cls.id)}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                      <div className="cls-card-title-row">
                        <span className="er-entity-icon">
                          <Box size={14} />
                        </span>
                        <span className="er-entity-title">
                          {cls.label || cls.id}
                          {cls.generic ? `<${cls.generic}>` : ''}
                        </span>
                        {cls.label && (
                          <span className="er-entity-id-sub">{cls.id}</span>
                        )}
                      </div>
                    </div>

                    <div className="cls-compartments">
                      {cls.members.length === 0 ? (
                        <div className="er-attr-empty">{c.emptyMembers}</div>
                      ) : (
                        <>
                          {fields.length > 0 && (
                            <div className="cls-compartment">
                              {fields.map(renderMemberRow)}
                            </div>
                          )}
                          {methods.length > 0 && (
                            <div className="cls-compartment">
                              {methods.map(renderMemberRow)}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div
                      className="cls-card-footer"
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="btn-secondary btn-xs"
                        onClick={() => handleAddMemberToClass(cls.id, 'field')}
                      >
                        <Plus size={11} />
                        <span>{c.addFieldBtn}</span>
                      </button>
                      <button
                        type="button"
                        className="btn-secondary btn-xs"
                        onClick={() => handleAddMemberToClass(cls.id, 'method')}
                      >
                        <Plus size={11} />
                        <span>{c.addMethodBtn}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="er-relationships-section">
              <div className="er-section-head">
                <span>
                  {c.relationsHeading} ({classData.relations.length})
                </span>
                <button
                  type="button"
                  className="btn-secondary btn-xs"
                  onClick={handleAddRelation}
                >
                  <Plus size={11} />
                  <span>{c.addRelationBtn}</span>
                </button>
              </div>

              {classData.relations.length === 0 ? (
                <div className="er-rel-empty">{c.emptyRelations}</div>
              ) : (
                <div className="er-rel-list">
                  {classData.relations.map((rel, relIdx) => {
                    const isSelected = rel.id === selectedRelationId;
                    return (
                      <div
                        key={rel.id}
                        className={`er-rel-row ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => onSelectRelation(rel.id)}
                      >
                        <div className="er-rel-summary">
                          <span className="er-rel-entity-pill">
                            {getClassDisplay(classMap.get(rel.from), rel.from)}
                          </span>
                          {rel.fromCardinality && (
                            <span className="cls-card-mult">
                              {rel.fromCardinality}
                            </span>
                          )}
                          <span
                            className={`er-rel-symbol-badge ${
                              rel.relationType.includes('..') ? 'is-dashed' : 'is-solid'
                            }`}
                          >
                            {rel.relationType}
                          </span>
                          {rel.toCardinality && (
                            <span className="cls-card-mult">{rel.toCardinality}</span>
                          )}
                          <span className="er-rel-entity-pill">
                            {getClassDisplay(classMap.get(rel.to), rel.to)}
                          </span>
                          {rel.label && (
                            <span className="er-rel-label-pill">{rel.label}</span>
                          )}
                        </div>
                        <div
                          className="er-rel-actions"
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="treeview-action-btn"
                            title={c.swapEndpointsBtn}
                            onClick={() => handleSwapRelation(rel.id)}
                          >
                            <ArrowLeftRight size={11} />
                          </button>
                          <button
                            type="button"
                            className="treeview-action-btn"
                            disabled={relIdx === 0}
                            title={c.moveUpTitle}
                            onClick={() => handleMoveRelation(rel.id, -1)}
                          >
                            <ArrowUp size={11} />
                          </button>
                          <button
                            type="button"
                            className="treeview-action-btn"
                            disabled={relIdx === classData.relations.length - 1}
                            title={c.moveDownTitle}
                            onClick={() => handleMoveRelation(rel.id, 1)}
                          >
                            <ArrowDown size={11} />
                          </button>
                          <button
                            type="button"
                            className="treeview-action-btn is-danger"
                            title={c.deleteRelationBtn}
                            onClick={() => handleDeleteRelation(rel.id)}
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

            {notes.length > 0 && (
              <div className="er-relationships-section">
                <div className="er-section-head">
                  <span>
                    {c.notesSection} ({notes.length})
                  </span>
                  <button
                    type="button"
                    className="btn-secondary btn-xs"
                    onClick={handleAddNote}
                  >
                    <Plus size={11} />
                    <span>{c.addNoteBtn}</span>
                  </button>
                </div>
                <div className="cls-notes-strip">
                  {notes.map((n) => (
                    <div key={n.id} className="cls-note-chip">
                      <StickyNote size={12} />
                      <span className="cls-note-target">
                        {n.targetClassId ? `for ${n.targetClassId}:` : c.noteGeneralOption}
                      </span>
                      <span className="cls-note-text">{n.text}</span>
                      <button
                        type="button"
                        className="treeview-action-btn is-danger"
                        title={c.deleteNoteTitle}
                        onClick={() => handleDeleteNote(n.id)}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
