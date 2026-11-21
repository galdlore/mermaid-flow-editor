import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import { InspectorCollapsibleSection } from './InspectorCollapsibleSection';
import {
  InspectorBulkControls,
  InspectorCommentsSection,
} from './InspectorCommon';
import { FORBIDDEN_CYNEFIN_TEXT_CHARS_REGEX } from '../utils/inputSafeguard';
import { CYNEFIN_DOMAIN_ORDER } from '../utils/cynefinConverter';
import { allocateUniqueId } from '../utils/mermaidEnvelope';
import type {
  CynefinDiagramData,
  CynefinDomainName,
  CynefinTransitionData,
} from '../types/editor';

export interface CynefinInspectorProps {
  cynefinData: CynefinDiagramData;
  selectedItemId: string | null;
  onChange: (next: CynefinDiagramData) => void;
  onSelectItem: (itemId: string | null) => void;
}

type CynefinSectionKey = 'item' | 'transitions' | 'settings' | 'comments';

export default function CynefinInspector({
  cynefinData,
  selectedItemId,
  onChange,
  onSelectItem,
}: CynefinInspectorProps) {
  const { t } = useI18n();
  const cyn = t.inspector.cynefin;
  const safeguard = t.inspector.safeguard;

  const selectedItem =
    cynefinData.items.find((item) => item.id === selectedItemId) ?? null;

  const [openSections, setOpenSections] = useState<
    Record<CynefinSectionKey, boolean>
  >({
    item: true,
    transitions: false,
    settings: false,
    comments: false,
  });

  useEffect(() => {
    if (selectedItemId) {
      setOpenSections((prev) => (prev.item ? prev : { ...prev, item: true }));
    }
  }, [selectedItemId]);

  const toggleSection = (key: CynefinSectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSections = (open: boolean): void => {
    setOpenSections({
      item: open,
      transitions: open,
      settings: open,
      comments: open,
    });
  };

  const allExpanded = Object.values(openSections).every(Boolean);

  const handleAddTransition = (): void => {
    const usedIds = new Set(cynefinData.transitions.map((tr) => tr.id));
    const id = allocateUniqueId(`ctr_${cynefinData.transitions.length + 1}`, usedIds);
    onChange({
      ...cynefinData,
      transitions: [
        ...cynefinData.transitions,
        { id, from: 'complex', to: 'complicated' },
      ],
    });
  };

  const updateTransition = (
    id: string,
    patch: Partial<CynefinTransitionData>
  ): void => {
    onChange({
      ...cynefinData,
      transitions: cynefinData.transitions.map((tr) =>
        tr.id === id ? { ...tr, ...patch } : tr
      ),
    });
  };

  return (
    <div className="inspector-panel">
      <InspectorBulkControls allExpanded={allExpanded} onSetAll={setAllSections} />

      <InspectorCollapsibleSection
        title={cyn.itemSection}
        isOpen={openSections.item}
        onToggle={() => toggleSection('item')}
      >
        {selectedItem ? (
          <>
            <label className="inspector-field">
              <span>{cyn.itemDomainField}</span>
              <select
                value={selectedItem.domain}
                onChange={(e) =>
                  onChange({
                    ...cynefinData,
                    items: cynefinData.items.map((item) =>
                      item.id === selectedItem.id
                        ? { ...item, domain: e.target.value as CynefinDomainName }
                        : item
                    ),
                  })
                }
              >
                {CYNEFIN_DOMAIN_ORDER.map((dom) => (
                  <option key={dom} value={dom}>
                    {cyn.domains[dom].title}
                  </option>
                ))}
              </select>
            </label>

            <label className="inspector-field">
              <span>{cyn.itemLabelField}</span>
              <GuardedInput
                value={selectedItem.label}
                placeholder={cyn.itemLabelPlaceholder}
                forbiddenRegex={FORBIDDEN_CYNEFIN_TEXT_CHARS_REGEX}
                formatError={safeguard.cynefinTextErrorChars}
                onChangeValue={(label) =>
                  onChange({
                    ...cynefinData,
                    items: cynefinData.items.map((item) =>
                      item.id === selectedItem.id ? { ...item, label } : item
                    ),
                  })
                }
              />
            </label>

            <button
              type="button"
              className="btn-danger-outline"
              onClick={() => {
                const next = cynefinData.items.filter(
                  (item) => item.id !== selectedItem.id
                );
                onChange({ ...cynefinData, items: next });
                onSelectItem(next[0]?.id ?? null);
              }}
            >
              <Trash2 size={14} />
              <span>{cyn.deleteItemBtn}</span>
            </button>
          </>
        ) : (
          <p className="inspector-hint">{cyn.selectItemPrompt}</p>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={cyn.transitionsSection}
        badgeText={cynefinData.transitions.length}
        isOpen={openSections.transitions}
        onToggle={() => toggleSection('transitions')}
        headerAction={
          <button
            type="button"
            className="btn-secondary btn-xs"
            onClick={handleAddTransition}
          >
            <Plus size={12} />
            <span>{cyn.addTransitionBtn}</span>
          </button>
        }
      >
        {cynefinData.transitions.length === 0 ? (
          <p className="inspector-hint">{cyn.emptyTransitions}</p>
        ) : (
          <div className="edge-list-container">
            {cynefinData.transitions.map((tr) => (
              <div key={tr.id} className="edge-list-item">
                <div className="form-grid-two">
                  <label className="inspector-field">
                    <span>{cyn.transitionFromField}</span>
                    <select
                      value={tr.from}
                      onChange={(e) =>
                        updateTransition(tr.id, {
                          from: e.target.value as CynefinDomainName,
                        })
                      }
                    >
                      {CYNEFIN_DOMAIN_ORDER.map((dom) => (
                        <option key={dom} value={dom}>
                          {dom}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="inspector-field">
                    <span>{cyn.transitionToField}</span>
                    <select
                      value={tr.to}
                      onChange={(e) =>
                        updateTransition(tr.id, {
                          to: e.target.value as CynefinDomainName,
                        })
                      }
                    >
                      {CYNEFIN_DOMAIN_ORDER.map((dom) => (
                        <option key={dom} value={dom}>
                          {dom}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {tr.from === tr.to && (
                  <p className="inspector-warning">{cyn.sameDomainWarning}</p>
                )}

                <div className="edge-item-row">
                  <GuardedInput
                    ariaLabel={cyn.transitionLabelField}
                    value={tr.label ?? ''}
                    placeholder={cyn.transitionLabelPlaceholder}
                    forbiddenRegex={FORBIDDEN_CYNEFIN_TEXT_CHARS_REGEX}
                    formatError={safeguard.cynefinTextErrorChars}
                    onChangeValue={(label) =>
                      updateTransition(tr.id, { label: label || undefined })
                    }
                  />
                  <button
                    type="button"
                    className="btn-icon-subtle is-danger"
                    title={cyn.deleteTransitionTitle}
                    onClick={() =>
                      onChange({
                        ...cynefinData,
                        transitions: cynefinData.transitions.filter(
                          (item) => item.id !== tr.id
                        ),
                      })
                    }
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={cyn.settingsSection}
        isOpen={openSections.settings}
        onToggle={() => toggleSection('settings')}
      >
        <label className="inspector-field">
          <span>{cyn.titleField}</span>
          <GuardedInput
            value={cynefinData.title ?? ''}
            placeholder={cyn.titlePlaceholder}
            forbiddenRegex={FORBIDDEN_CYNEFIN_TEXT_CHARS_REGEX}
            formatError={safeguard.cynefinTextErrorChars}
            onChangeValue={(val) =>
              onChange({ ...cynefinData, title: val || undefined })
            }
          />
        </label>
      </InspectorCollapsibleSection>

      <InspectorCommentsSection
        title={cyn.commentsSection}
        fieldLabel={cyn.commentsField}
        placeholder={cyn.commentsPlaceholder}
        comments={cynefinData.comments}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
        onChangeComments={(comments) => onChange({ ...cynefinData, comments })}
      />
    </div>
  );
}
