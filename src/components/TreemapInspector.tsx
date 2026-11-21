import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import { InspectorCollapsibleSection } from './InspectorCollapsibleSection';
import {
  CommitIdInput,
  InspectorBulkControls,
  InspectorCommentsSection,
} from './InspectorCommon';
import {
  FORBIDDEN_TREEMAP_CLASS_CHARS_REGEX,
  FORBIDDEN_TREEMAP_TEXT_CHARS_REGEX,
} from '../utils/inputSafeguard';
import {
  deleteTreemapSubtree,
  normalizeTreemapClassName,
  normalizeTreemapNodes,
} from '../utils/treemapConverter';
import type {
  TreemapDiagramData,
  TreemapNodeData,
  TreemapNodeKind,
} from '../types/editor';

export interface TreemapInspectorProps {
  treemapData: TreemapDiagramData;
  selectedNodeId: string | null;
  onChange: (next: TreemapDiagramData) => void;
  onSelectNode: (nodeId: string | null) => void;
}

type TreemapSectionKey = 'node' | 'classDefs' | 'settings' | 'comments';

export default function TreemapInspector({
  treemapData,
  selectedNodeId,
  onChange,
  onSelectNode,
}: TreemapInspectorProps) {
  const { t } = useI18n();
  const tm = t.inspector.treemap;
  const safeguard = t.inspector.safeguard;

  const selectedIndex = treemapData.nodes.findIndex(
    (n) => n.id === selectedNodeId
  );
  const selectedNode =
    selectedIndex >= 0 ? treemapData.nodes[selectedIndex] : null;
  const hasChildren =
    selectedIndex >= 0 &&
    selectedIndex + 1 < treemapData.nodes.length &&
    treemapData.nodes[selectedIndex + 1].depth > treemapData.nodes[selectedIndex].depth;

  const [openSections, setOpenSections] = useState<
    Record<TreemapSectionKey, boolean>
  >({
    node: true,
    classDefs: false,
    settings: false,
    comments: false,
  });

  useEffect(() => {
    if (selectedNodeId) {
      setOpenSections((prev) => (prev.node ? prev : { ...prev, node: true }));
    }
  }, [selectedNodeId]);

  const toggleSection = (key: TreemapSectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSections = (open: boolean): void => {
    setOpenSections({
      node: open,
      classDefs: open,
      settings: open,
      comments: open,
    });
  };

  const allExpanded = Object.values(openSections).every(Boolean);

  const updateSelectedNode = (patch: Partial<TreemapNodeData>): void => {
    if (!selectedNode) return;
    const nextNodes = normalizeTreemapNodes(
      treemapData.nodes.map((node) =>
        node.id === selectedNode.id ? { ...node, ...patch } : node
      )
    );
    onChange({ ...treemapData, nodes: nextNodes });
  };

  const handleAddClassDef = (): void => {
    const existing = treemapData.classDefs ?? [];
    const used = new Set(existing.map((c) => c.name));
    let n = existing.length + 1;
    while (used.has(`style_${n}`)) {
      n++;
    }
    onChange({
      ...treemapData,
      classDefs: [
        ...existing,
        { name: `style_${n}`, fill: '#fef08a', stroke: '#ca8a04', color: '#1e293b' },
      ],
    });
  };

  const handleRenameClassDef = (index: number, rawName: string): string => {
    const existing = treemapData.classDefs ?? [];
    const target = existing[index];
    if (!target) return '';
    const candidate = normalizeTreemapClassName(rawName);
    if (!candidate) return target.name;
    const duplicate = existing.some((cd, i) => i !== index && cd.name === candidate);
    if (duplicate) return target.name;

    onChange({
      ...treemapData,
      classDefs: existing.map((cd, i) =>
        i === index ? { ...cd, name: candidate } : cd
      ),
      nodes: treemapData.nodes.map((n) =>
        n.className === target.name ? { ...n, className: candidate } : n
      ),
    });
    return candidate;
  };

  return (
    <div className="inspector-panel">
      <InspectorBulkControls allExpanded={allExpanded} onSetAll={setAllSections} />

      <InspectorCollapsibleSection
        title={tm.nodeSection}
        isOpen={openSections.node}
        onToggle={() => toggleSection('node')}
      >
        {selectedNode ? (
          <>
            <label className="inspector-field">
              <span>{tm.nodeKindField}</span>
              <select
                value={selectedNode.kind}
                disabled={hasChildren}
                onChange={(e) => {
                  const nextKind = e.target.value as TreemapNodeKind;
                  updateSelectedNode({
                    kind: nextKind,
                    value: nextKind === 'leaf' ? selectedNode.value ?? 20 : undefined,
                  });
                }}
              >
                <option value="section">{tm.nodeKinds.section}</option>
                <option value="leaf">{tm.nodeKinds.leaf}</option>
              </select>
            </label>

            <label className="inspector-field">
              <span>{tm.nodeLabelField}</span>
              <GuardedInput
                value={selectedNode.label}
                placeholder={tm.nodeLabelPlaceholder}
                forbiddenRegex={FORBIDDEN_TREEMAP_TEXT_CHARS_REGEX}
                formatError={safeguard.treemapTextErrorChars}
                onChangeValue={(label) => updateSelectedNode({ label })}
              />
            </label>

            {selectedNode.kind === 'leaf' && (
              <label className="inspector-field">
                <span>{tm.nodeValueField}</span>
                <input
                  type="number"
                  min={0.01}
                  step="any"
                  value={selectedNode.value ?? 10}
                  onChange={(e) => {
                    const num = Number(e.target.value);
                    updateSelectedNode({
                      value: Number.isFinite(num) && num > 0 ? num : 1,
                    });
                  }}
                />
              </label>
            )}

            <label className="inspector-field">
              <span>{tm.nodeClassField}</span>
              <select
                value={selectedNode.className ?? ''}
                onChange={(e) =>
                  updateSelectedNode({ className: e.target.value || undefined })
                }
              >
                <option value="">{tm.noClassOption}</option>
                {(treemapData.classDefs ?? []).map((cd) => (
                  <option key={cd.name} value={cd.name}>
                    {cd.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="btn-danger-outline"
              onClick={() => {
                const nextNodes = deleteTreemapSubtree(
                  treemapData.nodes,
                  selectedIndex
                );
                onChange({ ...treemapData, nodes: nextNodes });
                onSelectNode(nextNodes[0]?.id ?? null);
              }}
            >
              <Trash2 size={14} />
              <span>{tm.deleteSubtreeBtn}</span>
            </button>
          </>
        ) : (
          <p className="inspector-hint">{tm.selectNodePrompt}</p>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={tm.classDefsSection}
        badgeText={(treemapData.classDefs ?? []).length}
        isOpen={openSections.classDefs}
        onToggle={() => toggleSection('classDefs')}
        headerAction={
          <button
            type="button"
            className="btn-secondary btn-xs"
            onClick={handleAddClassDef}
          >
            <Plus size={12} />
            <span>{tm.addClassDefBtn}</span>
          </button>
        }
      >
        {(treemapData.classDefs ?? []).length === 0 ? (
          <p className="inspector-hint">{tm.noClassDefs}</p>
        ) : (
          <div className="edge-list-container">
            {(treemapData.classDefs ?? []).map((cd, idx) => (
              <div key={`${cd.name}_${idx}`} className="edge-list-item">
                <div className="edge-item-row">
                  <CommitIdInput
                    label={tm.classNameField}
                    value={cd.name}
                    placeholder={tm.classNamePlaceholder}
                    forbiddenRegex={FORBIDDEN_TREEMAP_CLASS_CHARS_REGEX}
                    formatError={safeguard.treemapClassErrorChars}
                    onCommit={(raw) => handleRenameClassDef(idx, raw)}
                  />
                  <button
                    type="button"
                    className="btn-icon-subtle is-danger"
                    title={tm.deleteClassDefTitle}
                    onClick={() =>
                      onChange({
                        ...treemapData,
                        classDefs: (treemapData.classDefs ?? []).filter(
                          (_, i) => i !== idx
                        ),
                      })
                    }
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <div className="form-grid-two">
                  <label className="inspector-field">
                    <span>{tm.classFillField}</span>
                    <input
                      type="color"
                      value={cd.fill}
                      onChange={(e) =>
                        onChange({
                          ...treemapData,
                          classDefs: (treemapData.classDefs ?? []).map((item, i) =>
                            i === idx ? { ...item, fill: e.target.value } : item
                          ),
                        })
                      }
                    />
                  </label>
                  <label className="inspector-field">
                    <span>{tm.classStrokeField}</span>
                    <input
                      type="color"
                      value={cd.stroke}
                      onChange={(e) =>
                        onChange({
                          ...treemapData,
                          classDefs: (treemapData.classDefs ?? []).map((item, i) =>
                            i === idx ? { ...item, stroke: e.target.value } : item
                          ),
                        })
                      }
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={tm.settingsSection}
        isOpen={openSections.settings}
        onToggle={() => toggleSection('settings')}
      >
        <label className="inspector-field">
          <span>{tm.titleField}</span>
          <GuardedInput
            value={treemapData.title ?? ''}
            placeholder={tm.titlePlaceholder}
            forbiddenRegex={FORBIDDEN_TREEMAP_TEXT_CHARS_REGEX}
            formatError={safeguard.treemapTextErrorChars}
            onChangeValue={(val) =>
              onChange({ ...treemapData, title: val || undefined })
            }
          />
        </label>
      </InspectorCollapsibleSection>

      <InspectorCommentsSection
        title={tm.commentsSection}
        fieldLabel={tm.commentsField}
        placeholder={tm.commentsPlaceholder}
        comments={treemapData.comments}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
        onChangeComments={(comments) => onChange({ ...treemapData, comments })}
      />
    </div>
  );
}
