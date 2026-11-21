import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
  FORBIDDEN_VENN_ID_CHARS_REGEX,
  FORBIDDEN_VENN_TEXT_CHARS_REGEX,
} from '../utils/inputSafeguard';
import { allocateUniqueId } from '../utils/mermaidEnvelope';
import { sanitizeVennId } from '../utils/vennConverter';
import type { VennDiagramData, VennSetData, VennUnionData } from '../types/editor';

export interface VennInspectorProps {
  vennData: VennDiagramData;
  selectedSetId: string | null;
  selectedUnionId: string | null;
  onChange: (next: VennDiagramData) => void;
  onSelectSet: (setId: string | null) => void;
  onSelectUnion: (unionId: string | null) => void;
}

type VennSectionKey = 'set' | 'union' | 'settings' | 'comments';

function setsMatch(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, idx) => v === sb[idx]);
}

export default function VennInspector({
  vennData,
  selectedSetId,
  selectedUnionId,
  onChange,
  onSelectSet,
  onSelectUnion,
}: VennInspectorProps) {
  const { t } = useI18n();
  const vn = t.inspector.venn;
  const safeguard = t.inspector.safeguard;

  const selectedSet = vennData.sets.find((s) => s.id === selectedSetId) ?? null;
  const selectedUnion =
    vennData.unions.find((u) => u.id === selectedUnionId) ?? null;

  const [openSections, setOpenSections] = useState<Record<VennSectionKey, boolean>>({
    set: true,
    union: false,
    settings: false,
    comments: false,
  });

  useEffect(() => {
    if (selectedSetId) {
      setOpenSections((prev) => (prev.set ? prev : { ...prev, set: true }));
    }
  }, [selectedSetId]);

  useEffect(() => {
    if (selectedUnionId) {
      setOpenSections((prev) => (prev.union ? prev : { ...prev, union: true }));
    }
  }, [selectedUnionId]);

  const toggleSection = (key: VennSectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSections = (open: boolean): void => {
    setOpenSections({ set: open, union: open, settings: open, comments: open });
  };

  const allExpanded = Object.values(openSections).every(Boolean);

  const updateSet = (patch: Partial<VennSetData>): void => {
    if (!selectedSet) return;
    onChange({
      ...vennData,
      sets: vennData.sets.map((s) =>
        s.id === selectedSet.id ? { ...s, ...patch } : s
      ),
    });
  };

  const handleRenameSetId = (rawNext: string): string => {
    if (!selectedSet) return '';
    const candidate = sanitizeVennId(rawNext, '');
    if (!candidate) return selectedSet.id;
    if (
      candidate !== selectedSet.id &&
      vennData.sets.some((s) => s.id === candidate)
    ) {
      return selectedSet.id;
    }
    const oldId = selectedSet.id;
    onChange({
      ...vennData,
      sets: vennData.sets.map((s) =>
        s.id === oldId ? { ...s, id: candidate } : s
      ),
      unions: vennData.unions.map((u) => ({
        ...u,
        sets: u.sets.map((m) => (m === oldId ? candidate : m)).sort(),
      })),
      texts: vennData.texts.map((txt) => ({
        ...txt,
        sets: txt.sets.map((m) => (m === oldId ? candidate : m)).sort(),
      })),
    });
    onSelectSet(candidate);
    return candidate;
  };

  const handleDeleteSet = (): void => {
    if (!selectedSet) return;
    const nextSets = vennData.sets.filter((s) => s.id !== selectedSet.id);
    const nextUnions = vennData.unions
      .map((u) => ({ ...u, sets: u.sets.filter((m) => m !== selectedSet.id) }))
      .filter((u) => u.sets.length >= 2);
    const nextTexts = vennData.texts.filter(
      (txt) => !txt.sets.includes(selectedSet.id)
    );
    onChange({
      ...vennData,
      sets: nextSets,
      unions: nextUnions,
      texts: nextTexts,
    });
    onSelectSet(nextSets[0]?.id ?? null);
  };

  const updateUnion = (patch: Partial<VennUnionData>): void => {
    if (!selectedUnion) return;
    onChange({
      ...vennData,
      unions: vennData.unions.map((u) =>
        u.id === selectedUnion.id ? { ...u, ...patch } : u
      ),
    });
  };

  const toggleUnionMember = (memberId: string): void => {
    if (!selectedUnion) return;
    const exists = selectedUnion.sets.includes(memberId);
    const nextMembers = exists
      ? selectedUnion.sets.filter((m) => m !== memberId)
      : [...selectedUnion.sets, memberId].sort();
    if (nextMembers.length < 2) return;
    const oldMembers = selectedUnion.sets;
    onChange({
      ...vennData,
      unions: vennData.unions.map((u) =>
        u.id === selectedUnion.id ? { ...u, sets: nextMembers } : u
      ),
      texts: vennData.texts.map((txt) =>
        setsMatch(txt.sets, oldMembers) ? { ...txt, sets: nextMembers } : txt
      ),
    });
  };

  const addTextForScope = (scopeSets: string[]): void => {
    const usedIds = new Set(vennData.texts.map((txt) => txt.id));
    const id = allocateUniqueId(`txt_${vennData.texts.length + 1}`, usedIds);
    onChange({
      ...vennData,
      texts: [
        ...vennData.texts,
        {
          id,
          sets: [...scopeSets].sort(),
          label: vn.defaultTextLabel(vennData.texts.length + 1),
        },
      ],
    });
  };

  const renderTextsEditor = (scopeSets: string[]) => {
    const matching = vennData.texts.filter((txt) => setsMatch(txt.sets, scopeSets));
    return (
      <div className="inspector-field">
        <div className="timeline-events-heading-row">
          <span>{vn.textsHeading}</span>
          <button
            type="button"
            className="btn-secondary btn-xs"
            onClick={() => addTextForScope(scopeSets)}
          >
            <Plus size={12} />
            <span>{vn.addTextBtn}</span>
          </button>
        </div>
        {matching.length === 0 ? (
          <p className="inspector-hint">{vn.emptyTexts}</p>
        ) : (
          <div className="timeline-events-editor">
            {matching.map((txt) => (
              <div key={txt.id} className="timeline-event-edit-row">
                <GuardedInput
                  value={txt.label}
                  placeholder={vn.textItemPlaceholder}
                  forbiddenRegex={FORBIDDEN_VENN_TEXT_CHARS_REGEX}
                  formatError={safeguard.vennTextErrorChars}
                  onChangeValue={(label) =>
                    onChange({
                      ...vennData,
                      texts: vennData.texts.map((item) =>
                        item.id === txt.id ? { ...item, label } : item
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  className="btn-icon-subtle is-danger"
                  title={vn.deleteTextTitle}
                  onClick={() =>
                    onChange({
                      ...vennData,
                      texts: vennData.texts.filter((item) => item.id !== txt.id),
                    })
                  }
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const duplicateUnionExists =
    selectedUnion !== null &&
    vennData.unions.some(
      (u) => u.id !== selectedUnion.id && setsMatch(u.sets, selectedUnion.sets)
    );

  return (
    <div className="inspector-panel">
      <InspectorBulkControls allExpanded={allExpanded} onSetAll={setAllSections} />

      <InspectorCollapsibleSection
        title={vn.setsSection}
        isOpen={openSections.set}
        onToggle={() => toggleSection('set')}
      >
        {selectedSet ? (
          <>
            <CommitIdInput
              label={vn.setIdField}
              value={selectedSet.id}
              placeholder={vn.setIdPlaceholder}
              hint={vn.setIdHint}
              forbiddenRegex={FORBIDDEN_VENN_ID_CHARS_REGEX}
              formatError={safeguard.vennIdErrorChars}
              onCommit={handleRenameSetId}
            />

            <label className="inspector-field">
              <span>{vn.setLabelField}</span>
              <GuardedInput
                value={selectedSet.label}
                placeholder={vn.setLabelPlaceholder}
                forbiddenRegex={FORBIDDEN_VENN_TEXT_CHARS_REGEX}
                formatError={safeguard.vennTextErrorChars}
                onChangeValue={(label) => updateSet({ label })}
              />
            </label>

            <label className="inspector-field">
              <span>{vn.sizeField}</span>
              <input
                type="number"
                min={1}
                step={1}
                value={selectedSet.size}
                onChange={(e) => {
                  const num = Number(e.target.value);
                  updateSet({ size: Number.isFinite(num) && num >= 1 ? num : 1 });
                }}
              />
            </label>

            <InspectorColorPalette
              label={vn.fillColorField}
              value={selectedSet.fill}
              clearTitle={vn.noColorOption}
              onChange={(fill) => updateSet({ fill })}
            />

            {renderTextsEditor([selectedSet.id])}

            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleDeleteSet}
            >
              <Trash2 size={14} />
              <span>{vn.deleteSetBtn}</span>
            </button>
          </>
        ) : (
          <p className="inspector-hint">{vn.selectTargetPrompt}</p>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={vn.unionsSection}
        badgeText={vennData.unions.length}
        isOpen={openSections.union}
        onToggle={() => toggleSection('union')}
      >
        {vennData.sets.length < 2 ? (
          <p className="inspector-hint">{vn.unionMinSetsHint}</p>
        ) : selectedUnion ? (
          <>
            <div className="inspector-field">
              <span>{vn.unionMembersField}</span>
              <div className="venn-checkbox-grid">
                {vennData.sets.map((s) => {
                  const active = selectedUnion.sets.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={`venn-member-chip ${active ? 'is-active' : ''}`}
                      onClick={() => toggleUnionMember(s.id)}
                    >
                      {s.id}
                    </button>
                  );
                })}
              </div>
              {duplicateUnionExists && (
                <p className="inspector-warning">{vn.duplicateUnionWarning}</p>
              )}
            </div>

            <label className="inspector-field">
              <span>{vn.unionLabelField}</span>
              <GuardedInput
                value={selectedUnion.label ?? ''}
                placeholder={vn.unionLabelPlaceholder}
                forbiddenRegex={FORBIDDEN_VENN_TEXT_CHARS_REGEX}
                formatError={safeguard.vennTextErrorChars}
                onChangeValue={(label) =>
                  updateUnion({ label: label || undefined })
                }
              />
            </label>

            <label className="inspector-field">
              <span>{vn.sizeField}</span>
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={selectedUnion.size}
                onChange={(e) => {
                  const num = Number(e.target.value);
                  updateUnion({
                    size: Number.isFinite(num) && num >= 0.5 ? num : 0.5,
                  });
                }}
              />
            </label>

            {renderTextsEditor(selectedUnion.sets)}

            <button
              type="button"
              className="btn-danger-outline"
              onClick={() => {
                const nextUnions = vennData.unions.filter(
                  (u) => u.id !== selectedUnion.id
                );
                onChange({ ...vennData, unions: nextUnions });
                onSelectUnion(nextUnions[0]?.id ?? null);
              }}
            >
              <Trash2 size={14} />
              <span>{vn.deleteUnionBtn}</span>
            </button>
          </>
        ) : (
          <p className="inspector-hint">{vn.emptyUnions}</p>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={vn.settingsSection}
        isOpen={openSections.settings}
        onToggle={() => toggleSection('settings')}
      >
        <label className="inspector-field">
          <span>{vn.titleField}</span>
          <GuardedInput
            value={vennData.title ?? ''}
            placeholder={vn.titlePlaceholder}
            forbiddenRegex={FORBIDDEN_VENN_TEXT_CHARS_REGEX}
            formatError={safeguard.vennTextErrorChars}
            onChangeValue={(val) =>
              onChange({ ...vennData, title: val || undefined })
            }
          />
        </label>
      </InspectorCollapsibleSection>

      <InspectorCommentsSection
        title={vn.commentsSection}
        fieldLabel={vn.commentsField}
        placeholder={vn.commentsPlaceholder}
        comments={vennData.comments}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
        onChangeComments={(comments) => onChange({ ...vennData, comments })}
      />
    </div>
  );
}
