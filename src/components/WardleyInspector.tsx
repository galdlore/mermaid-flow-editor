import { useEffect, useState } from 'react';
import { ArrowLeftRight, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import { InspectorCollapsibleSection } from './InspectorCollapsibleSection';
import {
  InspectorBulkControls,
  InspectorCommentsSection,
} from './InspectorCommon';
import { FORBIDDEN_WARDLEY_TEXT_CHARS_REGEX } from '../utils/inputSafeguard';
import { allocateUniqueId } from '../utils/mermaidEnvelope';
import {
  clampWardleyCoord,
  getDefaultEvolutionStages,
  WARDLEY_LINK_STYLE_OPTIONS,
  WARDLEY_STRATEGY_OPTIONS,
} from '../utils/wardleyConverter';
import type {
  WardleyComponentData,
  WardleyDiagramData,
  WardleyLinkData,
  WardleyLinkStyle,
  WardleyStrategy,
} from '../types/editor';

export interface WardleyInspectorProps {
  wardleyData: WardleyDiagramData;
  selectedItemId: string | null;
  onChange: (next: WardleyDiagramData) => void;
  onSelectItem: (itemId: string | null) => void;
}

type WardleySectionKey = 'item' | 'links' | 'evolution' | 'settings' | 'comments';

export default function WardleyInspector({
  wardleyData,
  selectedItemId,
  onChange,
  onSelectItem,
}: WardleyInspectorProps) {
  const { lang, t } = useI18n();
  const wd = t.inspector.wardley;
  const safeguard = t.inspector.safeguard;

  const anchor = wardleyData.anchors.find((a) => a.id === selectedItemId) ?? null;
  const component =
    wardleyData.components.find((c) => c.id === selectedItemId) ?? null;
  const note =
    (wardleyData.notes ?? []).find((n) => n.id === selectedItemId) ?? null;

  const [openSections, setOpenSections] = useState<
    Record<WardleySectionKey, boolean>
  >({
    item: true,
    links: false,
    evolution: false,
    settings: false,
    comments: false,
  });

  useEffect(() => {
    if (selectedItemId) {
      setOpenSections((prev) => (prev.item ? prev : { ...prev, item: true }));
    }
  }, [selectedItemId]);

  const toggleSection = (key: WardleySectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSections = (open: boolean): void => {
    setOpenSections({
      item: open,
      links: open,
      evolution: open,
      settings: open,
      comments: open,
    });
  };

  const allExpanded = Object.values(openSections).every(Boolean);

  const endpointOptions = [
    ...wardleyData.anchors.map((a) => ({ id: a.id, name: a.name })),
    ...wardleyData.components.map((c) => ({ id: c.id, name: c.name })),
  ];

  const handleAddLink = (): void => {
    if (endpointOptions.length < 2) return;
    const usedIds = new Set(wardleyData.links.map((l) => l.id));
    const id = allocateUniqueId(`lnk_${wardleyData.links.length + 1}`, usedIds);
    onChange({
      ...wardleyData,
      links: [
        ...wardleyData.links,
        {
          id,
          from: endpointOptions[0].id,
          to: endpointOptions[1].id,
          style: 'solid',
        },
      ],
    });
  };

  const updateLink = (id: string, patch: Partial<WardleyLinkData>): void => {
    onChange({
      ...wardleyData,
      links: wardleyData.links.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    });
  };

  const stages =
    wardleyData.evolutionStages ?? getDefaultEvolutionStages(lang);

  const activeName = anchor?.name ?? component?.name ?? note?.text ?? '';
  const activeVis = anchor?.visibility ?? component?.visibility ?? note?.visibility ?? 0.5;
  const activeEvo = anchor?.evolution ?? component?.evolution ?? note?.evolution ?? 0.5;
  const activeKindLabel = anchor
    ? wd.elementKinds.anchor
    : component
      ? wd.elementKinds.component
      : wd.elementKinds.note;

  const updateCoords = (vis: number, evo: number): void => {
    const v = clampWardleyCoord(vis);
    const e = clampWardleyCoord(evo);
    if (anchor) {
      onChange({
        ...wardleyData,
        anchors: wardleyData.anchors.map((a) =>
          a.id === anchor.id ? { ...a, visibility: v, evolution: e } : a
        ),
      });
    } else if (component) {
      onChange({
        ...wardleyData,
        components: wardleyData.components.map((c) =>
          c.id === component.id ? { ...c, visibility: v, evolution: e } : c
        ),
      });
    } else if (note) {
      onChange({
        ...wardleyData,
        notes: (wardleyData.notes ?? []).map((n) =>
          n.id === note.id ? { ...n, visibility: v, evolution: e } : n
        ),
      });
    }
  };

  const updateName = (nextText: string): void => {
    if (anchor) {
      onChange({
        ...wardleyData,
        anchors: wardleyData.anchors.map((a) =>
          a.id === anchor.id ? { ...a, name: nextText } : a
        ),
      });
    } else if (component) {
      onChange({
        ...wardleyData,
        components: wardleyData.components.map((c) =>
          c.id === component.id ? { ...c, name: nextText } : c
        ),
      });
    } else if (note) {
      onChange({
        ...wardleyData,
        notes: (wardleyData.notes ?? []).map((n) =>
          n.id === note.id ? { ...n, text: nextText } : n
        ),
      });
    }
  };

  const handleDeleteSelected = (): void => {
    if (anchor) {
      const nextAnchors = wardleyData.anchors.filter((a) => a.id !== anchor.id);
      const nextLinks = wardleyData.links.filter(
        (l) => l.from !== anchor.id && l.to !== anchor.id
      );
      onChange({ ...wardleyData, anchors: nextAnchors, links: nextLinks });
      onSelectItem(wardleyData.components[0]?.id ?? nextAnchors[0]?.id ?? null);
    } else if (component) {
      const nextComps = wardleyData.components.filter((c) => c.id !== component.id);
      const nextLinks = wardleyData.links.filter(
        (l) => l.from !== component.id && l.to !== component.id
      );
      onChange({ ...wardleyData, components: nextComps, links: nextLinks });
      onSelectItem(nextComps[0]?.id ?? wardleyData.anchors[0]?.id ?? null);
    } else if (note) {
      const nextNotes = (wardleyData.notes ?? []).filter((n) => n.id !== note.id);
      onChange({ ...wardleyData, notes: nextNotes });
      onSelectItem(wardleyData.components[0]?.id ?? nextNotes[0]?.id ?? null);
    }
  };

  const updateComp = (patch: Partial<WardleyComponentData>): void => {
    if (!component) return;
    onChange({
      ...wardleyData,
      components: wardleyData.components.map((c) =>
        c.id === component.id ? { ...c, ...patch } : c
      ),
    });
  };

  return (
    <div className="inspector-panel">
      <InspectorBulkControls allExpanded={allExpanded} onSetAll={setAllSections} />

      <InspectorCollapsibleSection
        title={wd.itemSection}
        isOpen={openSections.item}
        onToggle={() => toggleSection('item')}
      >
        {anchor || component || note ? (
          <>
            <div className="inspector-role-badge">{activeKindLabel}</div>
            <label className="inspector-field">
              <span>{wd.nameField}</span>
              <GuardedInput
                value={activeName}
                placeholder={wd.namePlaceholder}
                forbiddenRegex={FORBIDDEN_WARDLEY_TEXT_CHARS_REGEX}
                formatError={safeguard.wardleyTextErrorChars}
                onChangeValue={updateName}
              />
            </label>

            <label className="inspector-field">
              <span>
                {wd.visibilityField}: {activeVis.toFixed(2)}
              </span>
              <input
                type="range"
                min={0.05}
                max={0.95}
                step={0.01}
                value={activeVis}
                onChange={(e) => updateCoords(Number(e.target.value), activeEvo)}
              />
            </label>

            <label className="inspector-field">
              <span>
                {wd.evolutionField}: {activeEvo.toFixed(2)}
              </span>
              <input
                type="range"
                min={0.05}
                max={0.95}
                step={0.01}
                value={activeEvo}
                onChange={(e) => updateCoords(activeVis, Number(e.target.value))}
              />
            </label>

            {component && (
              <>
                <label className="inspector-field">
                  <span>{wd.strategyField}</span>
                  <select
                    value={component.strategy ?? ''}
                    onChange={(e) =>
                      updateComp({
                        strategy:
                          (e.target.value as WardleyStrategy) || undefined,
                      })
                    }
                  >
                    <option value="">{wd.noStrategyOption}</option>
                    {WARDLEY_STRATEGY_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {wd.strategies[st]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="inspector-checkbox">
                  <input
                    type="checkbox"
                    checked={Boolean(component.inertia)}
                    onChange={(e) =>
                      updateComp({ inertia: e.target.checked || undefined })
                    }
                  />
                  <span>{wd.inertiaField}</span>
                </label>

                <label className="inspector-checkbox">
                  <input
                    type="checkbox"
                    checked={component.evolveTo !== undefined}
                    onChange={(e) =>
                      updateComp({
                        evolveTo: e.target.checked
                          ? Math.min(0.95, clampWardleyCoord(component.evolution + 0.2))
                          : undefined,
                      })
                    }
                  />
                  <span>{wd.evolveEnabledField}</span>
                </label>

                {component.evolveTo !== undefined && (
                  <label className="inspector-field">
                    <span>
                      {wd.evolveToField}: {component.evolveTo.toFixed(2)}
                    </span>
                    <input
                      type="range"
                      min={0.05}
                      max={0.95}
                      step={0.01}
                      value={component.evolveTo}
                      onChange={(e) =>
                        updateComp({ evolveTo: clampWardleyCoord(Number(e.target.value)) })
                      }
                    />
                  </label>
                )}
              </>
            )}

            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleDeleteSelected}
            >
              <Trash2 size={14} />
              <span>{wd.deleteElementBtn}</span>
            </button>
          </>
        ) : (
          <p className="inspector-hint">{wd.selectElementPrompt}</p>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={wd.linksSection}
        badgeText={wardleyData.links.length}
        isOpen={openSections.links}
        onToggle={() => toggleSection('links')}
        headerAction={
          <button
            type="button"
            className="btn-secondary btn-xs"
            disabled={endpointOptions.length < 2}
            onClick={handleAddLink}
          >
            <Plus size={12} />
            <span>{wd.addLinkBtn}</span>
          </button>
        }
      >
        {wardleyData.links.length === 0 ? (
          <p className="inspector-hint">{wd.emptyLinks}</p>
        ) : (
          <div className="edge-list-container">
            {wardleyData.links.map((link) => (
              <div key={link.id} className="edge-list-item">
                <div className="form-grid-two">
                  <label className="inspector-field">
                    <span>{wd.linkFromField}</span>
                    <select
                      value={link.from}
                      onChange={(e) => updateLink(link.id, { from: e.target.value })}
                    >
                      {endpointOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="inspector-field">
                    <span>{wd.linkToField}</span>
                    <select
                      value={link.to}
                      onChange={(e) => updateLink(link.id, { to: e.target.value })}
                    >
                      {endpointOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="inspector-field">
                  <span>{wd.linkStyleField}</span>
                  <select
                    value={link.style ?? 'solid'}
                    onChange={(e) =>
                      updateLink(link.id, { style: e.target.value as WardleyLinkStyle })
                    }
                  >
                    {WARDLEY_LINK_STYLE_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {wd.linkStyles[st]}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="edge-item-row">
                  <GuardedInput
                    ariaLabel={wd.linkLabelField}
                    value={link.label ?? ''}
                    placeholder={wd.linkLabelPlaceholder}
                    forbiddenRegex={FORBIDDEN_WARDLEY_TEXT_CHARS_REGEX}
                    formatError={safeguard.wardleyTextErrorChars}
                    onChangeValue={(label) =>
                      updateLink(link.id, { label: label || undefined })
                    }
                  />
                  <button
                    type="button"
                    className="btn-icon-subtle"
                    title={wd.swapEndpointsBtn}
                    onClick={() =>
                      updateLink(link.id, { from: link.to, to: link.from })
                    }
                  >
                    <ArrowLeftRight size={12} />
                  </button>
                  <button
                    type="button"
                    className="btn-icon-subtle is-danger"
                    title={wd.deleteLinkTitle}
                    onClick={() =>
                      onChange({
                        ...wardleyData,
                        links: wardleyData.links.filter((l) => l.id !== link.id),
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
        title={wd.evolutionSection}
        isOpen={openSections.evolution}
        onToggle={() => toggleSection('evolution')}
      >
        <div className="timeline-sections-list">
          {stages.map((label, idx) => (
            <label key={idx} className="inspector-field">
              <span>{wd.stageLabel(idx)}</span>
              <GuardedInput
                value={label}
                forbiddenRegex={FORBIDDEN_WARDLEY_TEXT_CHARS_REGEX}
                formatError={safeguard.wardleyTextErrorChars}
                onChangeValue={(nextVal) => {
                  const nextStages = [...stages] as [string, string, string, string];
                  nextStages[idx] = nextVal;
                  onChange({ ...wardleyData, evolutionStages: nextStages });
                }}
              />
            </label>
          ))}
        </div>
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={wd.settingsSection}
        isOpen={openSections.settings}
        onToggle={() => toggleSection('settings')}
      >
        <label className="inspector-field">
          <span>{wd.titleField}</span>
          <GuardedInput
            value={wardleyData.title ?? ''}
            placeholder={wd.titlePlaceholder}
            forbiddenRegex={FORBIDDEN_WARDLEY_TEXT_CHARS_REGEX}
            formatError={safeguard.wardleyTextErrorChars}
            onChangeValue={(val) =>
              onChange({ ...wardleyData, title: val || undefined })
            }
          />
        </label>
      </InspectorCollapsibleSection>

      <InspectorCommentsSection
        title={wd.commentsSection}
        fieldLabel={wd.commentsField}
        placeholder={wd.commentsPlaceholder}
        comments={wardleyData.comments}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
        onChangeComments={(comments) => onChange({ ...wardleyData, comments })}
      />
    </div>
  );
}
