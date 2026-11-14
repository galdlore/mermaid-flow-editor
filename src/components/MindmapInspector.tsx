import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import {
  FORBIDDEN_MINDMAP_CLASS_CHARS_REGEX,
  FORBIDDEN_MINDMAP_ICON_CHARS_REGEX,
  FORBIDDEN_MINDMAP_LABEL_CHARS_REGEX,
} from '../utils/inputSafeguard';
import {
  DEFAULT_MINDMAP_CONFIG,
  getMindmapSubtreeRange,
  normalizeMindmapNodes,
} from '../utils/mindmapConverter';
import type {
  MindmapDiagramData,
  MindmapNodeData,
  MindmapNodeShape,
} from '../types/editor';

export interface MindmapInspectorProps {
  mindmapData: MindmapDiagramData;
  selectedNodeId: string | null;
  onChange: (next: MindmapDiagramData) => void;
  onSelectNode: (nodeId: string | null) => void;
}

type MindmapSectionKey = 'node' | 'settings' | 'comments';

const SHAPE_OPTIONS: MindmapNodeShape[] = [
  'default',
  'rounded',
  'rect',
  'circle',
  'cloud',
  'bang',
  'hexagon',
];

const ICON_PRESETS = [
  'fa fa-book',
  'fa fa-lightbulb',
  'fa fa-gears',
  'fa fa-check',
  'fa fa-star',
];

const CLASS_PRESETS = ['urgent', 'large', 'urgent large'];

interface MindmapAccordionProps {
  title: string;
  countBadge?: number;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function MindmapAccordion({
  title,
  countBadge,
  isOpen,
  onToggle,
  children,
}: MindmapAccordionProps) {
  return (
    <section
      className={`inspector-section inspector-accordion ${isOpen ? 'is-open' : 'is-collapsed'}`}
    >
      <div className="inspector-section-header inspector-accordion-header">
        <button
          type="button"
          className="inspector-accordion-trigger"
          aria-expanded={isOpen}
          onClick={onToggle}
        >
          {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          <span className="inspector-accordion-title">{title}</span>
          {typeof countBadge === 'number' && (
            <span className="inspector-section-count">{countBadge}</span>
          )}
        </button>
      </div>
      {isOpen && <div className="inspector-accordion-body">{children}</div>}
    </section>
  );
}

export default function MindmapInspector({
  mindmapData,
  selectedNodeId,
  onChange,
  onSelectNode,
}: MindmapInspectorProps) {
  const { t } = useI18n();
  const [openSections, setOpenSections] = useState<
    Record<MindmapSectionKey, boolean>
  >({
    node: true,
    settings: false,
    comments: false,
  });

  const nodes = mindmapData.nodes;
  const selectedIndex = nodes.findIndex((n) => n.id === selectedNodeId);
  const selectedNode = selectedIndex >= 0 ? nodes[selectedIndex] : null;

  useEffect(() => {
    if (selectedNodeId) {
      setOpenSections((prev) => ({ ...prev, node: true }));
    }
  }, [selectedNodeId]);

  const toggleSection = (key: MindmapSectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updateSelectedNode = (
    updater: (prev: MindmapNodeData) => MindmapNodeData
  ): void => {
    if (!selectedNode) {
      return;
    }
    onChange({
      ...mindmapData,
      nodes: nodes.map((n) => (n.id === selectedNode.id ? updater(n) : n)),
    });
  };

  const handleDeleteSelected = (): void => {
    if (selectedIndex <= 0) {
      return;
    }
    const [start, end] = getMindmapSubtreeRange(nodes, selectedIndex);
    const nextNodes = normalizeMindmapNodes([
      ...nodes.slice(0, start),
      ...nodes.slice(end + 1),
    ]);
    onChange({ ...mindmapData, nodes: nextNodes });
    onSelectNode(nextNodes[Math.min(start, nextNodes.length - 1)]?.id ?? null);
  };

  const handleConfigNumber = (
    field: 'padding' | 'maxNodeWidth',
    raw: string,
    min: number,
    max: number
  ): void => {
    const parsed = Number(raw);
    const fallback = DEFAULT_MINDMAP_CONFIG[field];
    const safeVal = Number.isFinite(parsed)
      ? Math.max(min, Math.min(max, Math.round(parsed)))
      : fallback;
    onChange({
      ...mindmapData,
      config: {
        ...mindmapData.config,
        [field]: safeVal,
      },
    });
  };

  return (
    <div className="inspector-content">
      {/* Selected Topic */}
      <MindmapAccordion
        title={t.inspector.mindmap.nodeSection}
        countBadge={nodes.length}
        isOpen={openSections.node}
        onToggle={() => toggleSection('node')}
      >
        {selectedNode ? (
          <>
            <div className="field-group">
              <label className="field-label">
                {t.inspector.mindmap.labelField}
              </label>
              <GuardedInput
                className="field-input"
                value={selectedNode.label}
                placeholder={t.inspector.mindmap.labelPlaceholder}
                forbiddenRegex={FORBIDDEN_MINDMAP_LABEL_CHARS_REGEX}
                formatError={t.inspector.safeguard.mindmapLabelErrorChars}
                onChangeValue={(nextVal) =>
                  updateSelectedNode((prev) => ({ ...prev, label: nextVal }))
                }
              />
            </div>

            <div className="field-group">
              <label className="field-label">
                {t.inspector.mindmap.shapeField}
              </label>
              <select
                className="field-select"
                value={selectedNode.shape}
                onChange={(e) => {
                  const nextShape = e.target.value as MindmapNodeShape;
                  updateSelectedNode((prev) => ({
                    ...prev,
                    shape: nextShape,
                    useMarkdown:
                      nextShape === 'default' ? false : prev.useMarkdown,
                  }));
                }}
              >
                {SHAPE_OPTIONS.map((shape) => (
                  <option key={shape} value={shape}>
                    {t.inspector.mindmap.shapes[shape]}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-group">
              <label className="mindmap-checkbox-label">
                <input
                  type="checkbox"
                  checked={Boolean(selectedNode.useMarkdown)}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    updateSelectedNode((prev) => ({
                      ...prev,
                      useMarkdown: enabled || undefined,
                      shape:
                        enabled && prev.shape === 'default'
                          ? 'rounded'
                          : prev.shape,
                    }));
                  }}
                />
                <span>{t.inspector.mindmap.useMarkdownField}</span>
              </label>
              <p className="inspector-hint">
                {t.inspector.mindmap.useMarkdownHint}
              </p>
            </div>

            <div className="field-group">
              <label className="field-label">
                {t.inspector.mindmap.iconField}
              </label>
              <GuardedInput
                className="field-input"
                value={selectedNode.icon ?? ''}
                placeholder={t.inspector.mindmap.iconPlaceholder}
                forbiddenRegex={FORBIDDEN_MINDMAP_ICON_CHARS_REGEX}
                formatError={t.inspector.safeguard.mindmapIconErrorChars}
                onChangeValue={(nextVal) =>
                  updateSelectedNode((prev) => ({
                    ...prev,
                    icon: nextVal.trim() || undefined,
                  }))
                }
              />
              <div className="mindmap-presets-row">
                <span className="mindmap-presets-label">
                  {t.inspector.mindmap.iconPresetsLabel}
                </span>
                {ICON_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`mindmap-preset-pill ${
                      selectedNode.icon === preset ? 'is-active' : ''
                    }`}
                    onClick={() =>
                      updateSelectedNode((prev) => ({
                        ...prev,
                        icon: prev.icon === preset ? undefined : preset,
                      }))
                    }
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="field-group">
              <label className="field-label">
                {t.inspector.mindmap.cssClassField}
              </label>
              <GuardedInput
                className="field-input"
                value={selectedNode.cssClass ?? ''}
                placeholder={t.inspector.mindmap.cssClassPlaceholder}
                forbiddenRegex={FORBIDDEN_MINDMAP_CLASS_CHARS_REGEX}
                formatError={t.inspector.safeguard.mindmapClassErrorChars}
                onChangeValue={(nextVal) =>
                  updateSelectedNode((prev) => ({
                    ...prev,
                    cssClass: nextVal.trim() || undefined,
                  }))
                }
              />
              <div className="mindmap-presets-row">
                <span className="mindmap-presets-label">
                  {t.inspector.mindmap.cssClassPresetsLabel}
                </span>
                {CLASS_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`mindmap-preset-pill ${
                      selectedNode.cssClass === preset ? 'is-active' : ''
                    }`}
                    onClick={() =>
                      updateSelectedNode((prev) => ({
                        ...prev,
                        cssClass: prev.cssClass === preset ? undefined : preset,
                      }))
                    }
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {selectedIndex > 0 && (
              <button
                type="button"
                className="btn-danger-outline btn-xs mindmap-full-btn"
                onClick={handleDeleteSelected}
              >
                <Trash2 size={13} />
                <span>{t.inspector.mindmap.deleteNodeBtn}</span>
              </button>
            )}
          </>
        ) : (
          <p className="inspector-hint">
            {t.inspector.mindmap.selectNodeHint}
          </p>
        )}
      </MindmapAccordion>

      {/* Settings */}
      <MindmapAccordion
        title={t.inspector.mindmap.settingsSection}
        isOpen={openSections.settings}
        onToggle={() => toggleSection('settings')}
      >
        <div className="mindmap-settings-grid">
          <div className="field-group">
            <label className="field-label">
              {t.inspector.mindmap.paddingField}
            </label>
            <input
              type="number"
              min={2}
              max={60}
              className="field-input"
              value={mindmapData.config.padding}
              onChange={(e) =>
                handleConfigNumber('padding', e.target.value, 2, 60)
              }
            />
          </div>
          <div className="field-group">
            <label className="field-label">
              {t.inspector.mindmap.maxNodeWidthField}
            </label>
            <input
              type="number"
              min={80}
              max={600}
              step={10}
              className="field-input"
              value={mindmapData.config.maxNodeWidth}
              onChange={(e) =>
                handleConfigNumber('maxNodeWidth', e.target.value, 80, 600)
              }
            />
          </div>
        </div>
      </MindmapAccordion>

      {/* Comments */}
      <MindmapAccordion
        title={t.inspector.mindmap.commentsSection}
        countBadge={mindmapData.comments?.length ?? 0}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
      >
        <div className="field-group">
          <label className="field-label">
            {t.inspector.mindmap.commentsField}
          </label>
          <textarea
            className="field-textarea"
            rows={3}
            placeholder={t.inspector.mindmap.commentsPlaceholder}
            value={(mindmapData.comments ?? []).join('\n')}
            onChange={(e) => {
              const lines = e.target.value
                .split(/\r?\n/)
                .filter((line) => line.trim() !== '');
              onChange({
                ...mindmapData,
                comments: lines.length > 0 ? lines : undefined,
              });
            }}
          />
        </div>
      </MindmapAccordion>
    </div>
  );
}
