import { useEffect, useState } from 'react';
import { ArrowLeftRight, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import { InspectorCollapsibleSection } from './InspectorCollapsibleSection';
import {
  InspectorBulkControls,
  InspectorCommentsSection,
} from './InspectorCommon';
import {
  FORBIDDEN_REQUIREMENT_TEXT_CHARS_REGEX,
  FORBIDDEN_SANKEY_LABEL_CHARS_REGEX,
} from '../utils/inputSafeguard';
import type { SankeyDiagramData, SankeyLinkData } from '../types/editor';

export interface SankeyInspectorProps {
  sankeyData: SankeyDiagramData;
  selectedLinkId: string | null;
  onChange: (next: SankeyDiagramData) => void;
  onSelectLink: (linkId: string | null) => void;
}

type SankeySectionKey = 'link' | 'summary' | 'settings' | 'comments';

export default function SankeyInspector({
  sankeyData,
  selectedLinkId,
  onChange,
  onSelectLink,
}: SankeyInspectorProps) {
  const { t } = useI18n();
  const sk = t.inspector.sankey;
  const safeguard = t.inspector.safeguard;

  const selectedLink =
    sankeyData.links.find((l) => l.id === selectedLinkId) ?? null;

  const [openSections, setOpenSections] = useState<
    Record<SankeySectionKey, boolean>
  >({
    link: true,
    summary: false,
    settings: false,
    comments: false,
  });

  useEffect(() => {
    if (selectedLinkId) {
      setOpenSections((prev) => (prev.link ? prev : { ...prev, link: true }));
    }
  }, [selectedLinkId]);

  const toggleSection = (key: SankeySectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSections = (open: boolean): void => {
    setOpenSections({
      link: open,
      summary: open,
      settings: open,
      comments: open,
    });
  };

  const allExpanded = Object.values(openSections).every(Boolean);

  const updateSelected = (patch: Partial<SankeyLinkData>): void => {
    if (!selectedLink) return;
    onChange({
      ...sankeyData,
      links: sankeyData.links.map((l) =>
        l.id === selectedLink.id ? { ...l, ...patch } : l
      ),
    });
  };

  const handleDelete = (): void => {
    if (!selectedLink) return;
    const next = sankeyData.links.filter((l) => l.id !== selectedLink.id);
    onChange({ ...sankeyData, links: next });
    onSelectLink(next[0]?.id ?? null);
  };

  const nodeTotals = new Map<string, { inflow: number; outflow: number }>();
  for (const link of sankeyData.links) {
    const s = nodeTotals.get(link.source) ?? { inflow: 0, outflow: 0 };
    s.outflow += link.value;
    nodeTotals.set(link.source, s);
    const d = nodeTotals.get(link.target) ?? { inflow: 0, outflow: 0 };
    d.inflow += link.value;
    nodeTotals.set(link.target, d);
  }

  return (
    <div className="inspector-panel">
      <InspectorBulkControls allExpanded={allExpanded} onSetAll={setAllSections} />

      <InspectorCollapsibleSection
        title={sk.linkSection}
        isOpen={openSections.link}
        onToggle={() => toggleSection('link')}
      >
        {selectedLink ? (
          <>
            <label className="inspector-field">
              <span>{sk.sourceField}</span>
              <GuardedInput
                value={selectedLink.source}
                placeholder={sk.sourcePlaceholder}
                forbiddenRegex={FORBIDDEN_SANKEY_LABEL_CHARS_REGEX}
                formatError={safeguard.sankeyLabelErrorChars}
                onChangeValue={(source) => updateSelected({ source })}
              />
            </label>

            <label className="inspector-field">
              <span>{sk.targetField}</span>
              <GuardedInput
                value={selectedLink.target}
                placeholder={sk.targetPlaceholder}
                forbiddenRegex={FORBIDDEN_SANKEY_LABEL_CHARS_REGEX}
                formatError={safeguard.sankeyLabelErrorChars}
                onChangeValue={(target) => updateSelected({ target })}
              />
            </label>

            <p className="inspector-hint">{sk.asciiHint}</p>

            <label className="inspector-field">
              <span>{sk.valueField}</span>
              <input
                type="number"
                min={0.1}
                step={0.5}
                value={selectedLink.value}
                onChange={(e) => {
                  const num = Number(e.target.value);
                  updateSelected({
                    value: Number.isFinite(num) && num > 0 ? num : 1,
                  });
                }}
              />
            </label>

            <button
              type="button"
              className="btn-secondary btn-xs"
              onClick={() =>
                updateSelected({
                  source: selectedLink.target,
                  target: selectedLink.source,
                })
              }
            >
              <ArrowLeftRight size={12} />
              <span>{sk.swapEndpointsBtn}</span>
            </button>

            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleDelete}
            >
              <Trash2 size={14} />
              <span>{sk.deleteLinkBtn}</span>
            </button>
          </>
        ) : (
          <p className="inspector-hint">{sk.selectLinkPrompt}</p>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={sk.summarySection}
        isOpen={openSections.summary}
        onToggle={() => toggleSection('summary')}
      >
        {nodeTotals.size === 0 ? (
          <p className="inspector-hint">{sk.emptyLinks}</p>
        ) : (
          <div className="timeline-events-editor">
            <div className="systems-section-heading">{sk.nodesHeading}</div>
            {Array.from(nodeTotals.entries()).map(([name, tot]) => (
              <div key={name} className="sankey-link-pill">
                <span>{name}</span>
                <span>
                  in {Math.round(tot.inflow * 100) / 100} / out{' '}
                  {Math.round(tot.outflow * 100) / 100}
                </span>
              </div>
            ))}
          </div>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={sk.settingsSection}
        isOpen={openSections.settings}
        onToggle={() => toggleSection('settings')}
      >
        <label className="inspector-field">
          <span>{sk.titleField}</span>
          <GuardedInput
            value={sankeyData.title ?? ''}
            placeholder={sk.titlePlaceholder}
            forbiddenRegex={FORBIDDEN_REQUIREMENT_TEXT_CHARS_REGEX}
            formatError={safeguard.requirementTextErrorChars}
            onChangeValue={(val) =>
              onChange({ ...sankeyData, title: val || undefined })
            }
          />
        </label>
      </InspectorCollapsibleSection>

      <InspectorCommentsSection
        title={sk.commentsSection}
        fieldLabel={sk.commentsField}
        placeholder={sk.commentsPlaceholder}
        comments={sankeyData.comments}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
        onChangeComments={(comments) => onChange({ ...sankeyData, comments })}
      />
    </div>
  );
}
