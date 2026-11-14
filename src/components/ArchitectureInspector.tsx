import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import {
  FORBIDDEN_ARCHITECTURE_ICON_CHARS_REGEX,
  FORBIDDEN_ARCHITECTURE_TITLE_CHARS_REGEX,
} from '../utils/inputSafeguard';
import type {
  ArchitectureAlignDirection,
  ArchitectureAlignHintData,
  ArchitectureDiagramData,
  ArchitectureDirection,
  ArchitectureEdgeData,
  ArchitectureGroupData,
  ArchitectureNodeType,
} from '../types/editor';

export interface ArchitectureInspectorProps {
  architectureData: ArchitectureDiagramData;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onChange: (next: ArchitectureDiagramData) => void;
  onSelectNode: (nodeId: string | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
}

type ArchSectionKey = 'node' | 'edges' | 'groups' | 'layout' | 'comments';

const ARCH_DIRECTIONS: ArchitectureDirection[] = ['L', 'R', 'T', 'B'];
const BUILTIN_ICON_PRESETS = [
  'server',
  'cloud',
  'database',
  'disk',
  'internet',
  'unknown',
  'blank',
] as const;

interface ArchAccordionProps {
  title: string;
  countBadge?: number;
  isOpen: boolean;
  onToggle: () => void;
  headerAction?: ReactNode;
  children: ReactNode;
}

function ArchAccordion({
  title,
  countBadge,
  isOpen,
  onToggle,
  headerAction,
  children,
}: ArchAccordionProps) {
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
        {headerAction && (
          <div className="inspector-accordion-actions">{headerAction}</div>
        )}
      </div>
      {isOpen && <div className="inspector-accordion-body">{children}</div>}
    </section>
  );
}

function nextId(prefix: string, usedIds: Iterable<string>): string {
  const used = new Set(usedIds);
  let num = 1;
  while (used.has(`${prefix}_${num}`)) {
    num++;
  }
  return `${prefix}_${num}`;
}

function collectDescendantGroupIds(
  groups: ArchitectureGroupData[],
  rootId: string
): Set<string> {
  const result = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const group of groups) {
      if (
        group.parentId &&
        result.has(group.parentId) &&
        !result.has(group.id)
      ) {
        result.add(group.id);
        changed = true;
      }
    }
  }
  return result;
}

export default function ArchitectureInspector({
  architectureData,
  selectedNodeId,
  selectedEdgeId,
  onChange,
  onSelectNode,
  onSelectEdge,
}: ArchitectureInspectorProps) {
  const { t } = useI18n();
  const [openSections, setOpenSections] = useState<
    Record<ArchSectionKey, boolean>
  >({
    node: true,
    edges: true,
    groups: false,
    layout: false,
    comments: false,
  });

  const selectedNode =
    architectureData.nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedEdge =
    architectureData.edges.find((e) => e.id === selectedEdgeId) ?? null;

  useEffect(() => {
    if (selectedNodeId) {
      setOpenSections((prev) => ({ ...prev, node: true }));
    }
  }, [selectedNodeId]);

  useEffect(() => {
    if (selectedEdgeId) {
      setOpenSections((prev) => ({ ...prev, edges: true }));
    }
  }, [selectedEdgeId]);

  const toggleSection = (key: ArchSectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updateSelectedNode = (
    updater: (prev: NonNullable<typeof selectedNode>) => NonNullable<typeof selectedNode>
  ): void => {
    if (!selectedNode) {
      return;
    }
    onChange({
      ...architectureData,
      nodes: architectureData.nodes.map((n) =>
        n.id === selectedNode.id ? updater(n) : n
      ),
    });
  };

  const handleDeleteNode = (nodeId: string): void => {
    const nextNodes = architectureData.nodes.filter((n) => n.id !== nodeId);
    const nextEdges = architectureData.edges.filter(
      (e) => e.lhsId !== nodeId && e.rhsId !== nodeId
    );
    const nextAlignments = (architectureData.alignments ?? [])
      .map((hint) => ({
        ...hint,
        members: hint.members.filter((m) => m !== nodeId),
      }))
      .filter((hint) => hint.members.length > 0);

    onChange({
      ...architectureData,
      nodes: nextNodes,
      edges: nextEdges,
      alignments: nextAlignments.length > 0 ? nextAlignments : undefined,
    });
    if (selectedNodeId === nodeId) {
      onSelectNode(nextNodes[0]?.id ?? null);
    }
    if (selectedEdge && !nextEdges.some((e) => e.id === selectedEdge.id)) {
      onSelectEdge(nextEdges[0]?.id ?? null);
    }
  };

  const handleAddEdge = (): void => {
    if (architectureData.nodes.length < 2) {
      return;
    }
    const lhs =
      selectedNode ?? architectureData.nodes[0];
    const rhs =
      architectureData.nodes.find((n) => n.id !== lhs.id) ??
      architectureData.nodes[1];
    if (!lhs || !rhs || lhs.id === rhs.id) {
      return;
    }
    const id = nextId(
      'edge',
      architectureData.edges.map((e) => e.id)
    );
    const nextEdge: ArchitectureEdgeData = {
      id,
      lhsId: lhs.id,
      lhsDir: 'R',
      rhsId: rhs.id,
      rhsDir: 'L',
      rhsInto: true,
    };
    onChange({
      ...architectureData,
      edges: [...architectureData.edges, nextEdge],
    });
    onSelectEdge(id);
    setOpenSections((prev) => ({ ...prev, edges: true }));
  };

  const updateEdge = (
    edgeId: string,
    patch: Partial<ArchitectureEdgeData>
  ): void => {
    onChange({
      ...architectureData,
      edges: architectureData.edges.map((e) =>
        e.id === edgeId ? { ...e, ...patch } : e
      ),
    });
  };

  const handleDeleteEdge = (edgeId: string): void => {
    const nextEdges = architectureData.edges.filter((e) => e.id !== edgeId);
    onChange({
      ...architectureData,
      edges: nextEdges,
    });
    if (selectedEdgeId === edgeId) {
      onSelectEdge(nextEdges[0]?.id ?? null);
    }
  };

  const handleAddGroup = (): void => {
    const id = nextId('group', [
      ...architectureData.groups.map((g) => g.id),
      ...architectureData.nodes.map((n) => n.id),
    ]);
    const nextGroup: ArchitectureGroupData = {
      id,
      icon: 'cloud',
      title: t.inspector.architecture.defaultGroupTitle(
        architectureData.groups.length + 1
      ),
    };
    onChange({
      ...architectureData,
      groups: [...architectureData.groups, nextGroup],
    });
    setOpenSections((prev) => ({ ...prev, groups: true }));
  };

  const updateGroup = (
    groupId: string,
    patch: Partial<ArchitectureGroupData>
  ): void => {
    onChange({
      ...architectureData,
      groups: architectureData.groups.map((g) =>
        g.id === groupId ? { ...g, ...patch } : g
      ),
    });
  };

  const handleDeleteGroup = (groupId: string): void => {
    onChange({
      ...architectureData,
      groups: architectureData.groups
        .filter((g) => g.id !== groupId)
        .map((g) =>
          g.parentId === groupId ? { ...g, parentId: undefined } : g
        ),
      nodes: architectureData.nodes.map((n) =>
        n.groupId === groupId ? { ...n, groupId: undefined } : n
      ),
    });
  };

  const handleAddAlignment = (): void => {
    const initialMembers = architectureData.nodes.slice(0, 2).map((n) => n.id);
    const id = nextId(
      'align',
      (architectureData.alignments ?? []).map((a) => a.id)
    );
    const nextHint: ArchitectureAlignHintData = {
      id,
      direction: 'row',
      members: initialMembers,
    };
    onChange({
      ...architectureData,
      alignments: [...(architectureData.alignments ?? []), nextHint],
    });
  };

  const updateAlignment = (
    alignId: string,
    updater: (prev: ArchitectureAlignHintData) => ArchitectureAlignHintData
  ): void => {
    onChange({
      ...architectureData,
      alignments: (architectureData.alignments ?? []).map((a) =>
        a.id === alignId ? updater(a) : a
      ),
    });
  };

  const handleDeleteAlignment = (alignId: string): void => {
    const next = (architectureData.alignments ?? []).filter(
      (a) => a.id !== alignId
    );
    onChange({
      ...architectureData,
      alignments: next.length > 0 ? next : undefined,
    });
  };

  const handleOptionalNumberChange = (
    field: 'padding' | 'iconSize' | 'nodeSeparation',
    raw: string
  ): void => {
    const trimmed = raw.trim();
    if (!trimmed) {
      onChange({ ...architectureData, [field]: undefined });
      return;
    }
    const num = Number(trimmed);
    if (Number.isFinite(num) && num >= 0) {
      onChange({ ...architectureData, [field]: Math.round(num) });
    }
  };

  const nodeGroupMap = new Map(
    architectureData.nodes.map((n) => [n.id, n.groupId ?? ''])
  );

  const selectedIconIsPreset = selectedNode?.icon
    ? (BUILTIN_ICON_PRESETS as readonly string[]).includes(selectedNode.icon)
    : true;

  return (
    <div className="inspector-content">
      {/* Selected Node */}
      <ArchAccordion
        title={t.inspector.architecture.nodeSection}
        countBadge={architectureData.nodes.length}
        isOpen={openSections.node}
        onToggle={() => toggleSection('node')}
      >
        {architectureData.nodes.length === 0 ? (
          <p className="inspector-hint">{t.inspector.architecture.emptyNodes}</p>
        ) : (
          <>
            <div className="field-group">
              <label className="field-label">
                {t.inspector.architecture.nodeSection}
              </label>
              <select
                className="field-select"
                value={selectedNode?.id ?? ''}
                onChange={(e) => onSelectNode(e.target.value || null)}
              >
                <option value="">
                  {t.inspector.architecture.selectNodeHint}
                </option>
                {architectureData.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.type === 'junction'
                      ? `${n.id} [${t.inspector.architecture.junctionBadge}]`
                      : `${n.title || n.id} (${n.id})`}
                  </option>
                ))}
              </select>
            </div>

            {selectedNode ? (
              <>
                <div className="field-group">
                  <label className="field-label">
                    {t.inspector.architecture.nodeTypeLabel}
                  </label>
                  <select
                    className="field-select"
                    value={selectedNode.type}
                    onChange={(e) => {
                      const nextType = e.target.value as ArchitectureNodeType;
                      updateSelectedNode((prev) =>
                        nextType === 'junction'
                          ? {
                              id: prev.id,
                              type: 'junction',
                              groupId: prev.groupId,
                            }
                          : {
                              id: prev.id,
                              type: 'service',
                              icon: prev.icon || 'server',
                              title: prev.title || prev.id,
                              groupId: prev.groupId,
                            }
                      );
                    }}
                  >
                    <option value="service">
                      {t.inspector.architecture.nodeTypes.service}
                    </option>
                    <option value="junction">
                      {t.inspector.architecture.nodeTypes.junction}
                    </option>
                  </select>
                </div>

                {selectedNode.type === 'service' && (
                  <>
                    <div className="field-group">
                      <label className="field-label">
                        {t.inspector.architecture.nodeTitleLabel}
                      </label>
                      <GuardedInput
                        className="field-input"
                        value={selectedNode.title ?? ''}
                        placeholder={
                          t.inspector.architecture.nodeTitlePlaceholder
                        }
                        forbiddenRegex={FORBIDDEN_ARCHITECTURE_TITLE_CHARS_REGEX}
                        formatError={
                          t.inspector.safeguard.architectureTitleErrorChars
                        }
                        onChangeValue={(nextVal) =>
                          updateSelectedNode((prev) => ({
                            ...prev,
                            title: nextVal,
                          }))
                        }
                      />
                    </div>

                    <div className="field-group">
                      <label className="field-label">
                        {t.inspector.architecture.nodeIconLabel}
                      </label>
                      <select
                        className="field-select"
                        value={
                          selectedIconIsPreset
                            ? selectedNode.icon || 'server'
                            : 'custom'
                        }
                        onChange={(e) => {
                          if (e.target.value === 'custom') {
                            return;
                          }
                          updateSelectedNode((prev) => ({
                            ...prev,
                            icon: e.target.value,
                          }));
                        }}
                      >
                        {BUILTIN_ICON_PRESETS.map((preset) => (
                          <option key={preset} value={preset}>
                            {t.inspector.architecture.iconPresets[preset]}
                          </option>
                        ))}
                        {!selectedIconIsPreset && (
                          <option value="custom">
                            {selectedNode.icon}
                          </option>
                        )}
                      </select>
                    </div>

                    <div className="field-group">
                      <label className="field-label">
                        {t.inspector.architecture.customIconLabel}
                      </label>
                      <GuardedInput
                        className="field-input"
                        value={selectedIconIsPreset ? '' : selectedNode.icon ?? ''}
                        placeholder={
                          t.inspector.architecture.customIconPlaceholder
                        }
                        forbiddenRegex={FORBIDDEN_ARCHITECTURE_ICON_CHARS_REGEX}
                        formatError={
                          t.inspector.safeguard.architectureIconErrorChars
                        }
                        onChangeValue={(nextVal) => {
                          const trimmed = nextVal.trim();
                          updateSelectedNode((prev) => ({
                            ...prev,
                            icon: trimmed || 'server',
                          }));
                        }}
                      />
                    </div>
                  </>
                )}

                <div className="field-group">
                  <label className="field-label">
                    {t.inspector.architecture.nodeGroupLabel}
                  </label>
                  <select
                    className="field-select"
                    value={selectedNode.groupId ?? ''}
                    onChange={(e) =>
                      updateSelectedNode((prev) => ({
                        ...prev,
                        groupId: e.target.value || undefined,
                      }))
                    }
                  >
                    <option value="">
                      {t.inspector.architecture.noGroupOption}
                    </option>
                    {architectureData.groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title || g.id} ({g.id})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  className="btn-danger-outline btn-xs arch-full-btn"
                  onClick={() => handleDeleteNode(selectedNode.id)}
                >
                  <Trash2 size={13} />
                  <span>{t.inspector.architecture.deleteNode}</span>
                </button>
              </>
            ) : (
              <p className="inspector-hint">
                {t.inspector.architecture.selectNodeHint}
              </p>
            )}
          </>
        )}
      </ArchAccordion>

      {/* Edges */}
      <ArchAccordion
        title={t.inspector.architecture.edgesSection}
        countBadge={architectureData.edges.length}
        isOpen={openSections.edges}
        onToggle={() => toggleSection('edges')}
        headerAction={
          <button
            type="button"
            className="btn-secondary btn-xs"
            disabled={architectureData.nodes.length < 2}
            onClick={handleAddEdge}
          >
            <Plus size={13} />
          </button>
        }
      >
        {architectureData.edges.length === 0 ? (
          <p className="inspector-hint">{t.inspector.architecture.emptyEdges}</p>
        ) : (
          <>
            <div className="arch-edge-selector-list">
              {architectureData.edges.map((edge) => (
                <button
                  key={edge.id}
                  type="button"
                  className={`arch-edge-selector-item ${
                    edge.id === selectedEdge?.id ? 'is-selected' : ''
                  }`}
                  onClick={() => onSelectEdge(edge.id)}
                >
                  <span>
                    {edge.lhsId}:{edge.lhsDir} → {edge.rhsDir}:{edge.rhsId}
                  </span>
                  {edge.title && (
                    <span className="arch-edge-selector-label">
                      [{edge.title}]
                    </span>
                  )}
                </button>
              ))}
            </div>

            {selectedEdge && (
              <div className="arch-subcard">
                <div className="arch-edge-endpoint-grid">
                  <div className="field-group">
                    <label className="field-label">
                      {t.inspector.architecture.edgeLhsNode}
                    </label>
                    <select
                      className="field-select"
                      value={selectedEdge.lhsId}
                      onChange={(e) =>
                        updateEdge(selectedEdge.id, { lhsId: e.target.value })
                      }
                    >
                      {architectureData.nodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.title || n.id} ({n.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field-group">
                    <label className="field-label">
                      {t.inspector.architecture.edgeSideLabel}
                    </label>
                    <select
                      className="field-select"
                      value={selectedEdge.lhsDir}
                      onChange={(e) =>
                        updateEdge(selectedEdge.id, {
                          lhsDir: e.target.value as ArchitectureDirection,
                        })
                      }
                    >
                      {ARCH_DIRECTIONS.map((dir) => (
                        <option key={dir} value={dir}>
                          {t.inspector.architecture.edgeSides[dir]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="arch-checkbox-row">
                  <label className="arch-checkbox-label">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedEdge.lhsInto)}
                      onChange={(e) =>
                        updateEdge(selectedEdge.id, {
                          lhsInto: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.architecture.edgeArrowIntoLhs}</span>
                  </label>
                  <label className="arch-checkbox-label">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedEdge.lhsGroup)}
                      onChange={(e) =>
                        updateEdge(selectedEdge.id, {
                          lhsGroup: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.architecture.edgeGroupPort}</span>
                  </label>
                </div>

                <div className="arch-edge-endpoint-grid">
                  <div className="field-group">
                    <label className="field-label">
                      {t.inspector.architecture.edgeRhsNode}
                    </label>
                    <select
                      className="field-select"
                      value={selectedEdge.rhsId}
                      onChange={(e) =>
                        updateEdge(selectedEdge.id, { rhsId: e.target.value })
                      }
                    >
                      {architectureData.nodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.title || n.id} ({n.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field-group">
                    <label className="field-label">
                      {t.inspector.architecture.edgeSideLabel}
                    </label>
                    <select
                      className="field-select"
                      value={selectedEdge.rhsDir}
                      onChange={(e) =>
                        updateEdge(selectedEdge.id, {
                          rhsDir: e.target.value as ArchitectureDirection,
                        })
                      }
                    >
                      {ARCH_DIRECTIONS.map((dir) => (
                        <option key={dir} value={dir}>
                          {t.inspector.architecture.edgeSides[dir]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="arch-checkbox-row">
                  <label className="arch-checkbox-label">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedEdge.rhsInto)}
                      onChange={(e) =>
                        updateEdge(selectedEdge.id, {
                          rhsInto: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.architecture.edgeArrowIntoRhs}</span>
                  </label>
                  <label className="arch-checkbox-label">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedEdge.rhsGroup)}
                      onChange={(e) =>
                        updateEdge(selectedEdge.id, {
                          rhsGroup: e.target.checked,
                        })
                      }
                    />
                    <span>{t.inspector.architecture.edgeGroupPort}</span>
                  </label>
                </div>

                <div className="field-group">
                  <label className="field-label">
                    {t.inspector.architecture.edgeTitleLabel}
                  </label>
                  <GuardedInput
                    className="field-input"
                    value={selectedEdge.title ?? ''}
                    placeholder={t.inspector.architecture.edgeTitlePlaceholder}
                    forbiddenRegex={FORBIDDEN_ARCHITECTURE_TITLE_CHARS_REGEX}
                    formatError={
                      t.inspector.safeguard.architectureTitleErrorChars
                    }
                    onChangeValue={(nextVal) =>
                      updateEdge(selectedEdge.id, { title: nextVal })
                    }
                  />
                </div>

                {selectedEdge.lhsId === selectedEdge.rhsId && (
                  <p className="field-warning">
                    {t.inspector.architecture.edgeSameNodeWarning}
                  </p>
                )}
                {selectedEdge.lhsDir === selectedEdge.rhsDir && (
                  <p className="field-warning">
                    {t.inspector.architecture.edgeSameDirWarning}
                  </p>
                )}
                {(selectedEdge.lhsGroup || selectedEdge.rhsGroup) &&
                  nodeGroupMap.get(selectedEdge.lhsId) ===
                    nodeGroupMap.get(selectedEdge.rhsId) && (
                    <p className="field-warning">
                      {t.inspector.architecture.edgeSameGroupPortWarning}
                    </p>
                  )}

                <button
                  type="button"
                  className="btn-danger-outline btn-xs arch-full-btn"
                  onClick={() => handleDeleteEdge(selectedEdge.id)}
                >
                  <Trash2 size={13} />
                  <span>{t.inspector.architecture.deleteEdge}</span>
                </button>
              </div>
            )}
          </>
        )}
      </ArchAccordion>

      {/* Groups */}
      <ArchAccordion
        title={t.inspector.architecture.groupsSection}
        countBadge={architectureData.groups.length}
        isOpen={openSections.groups}
        onToggle={() => toggleSection('groups')}
        headerAction={
          <button
            type="button"
            className="btn-secondary btn-xs"
            onClick={handleAddGroup}
          >
            <Plus size={13} />
          </button>
        }
      >
        {architectureData.groups.length === 0 ? (
          <p className="inspector-hint">
            {t.inspector.architecture.emptyGroups}
          </p>
        ) : (
          <div className="arch-group-list">
            {architectureData.groups.map((group) => {
              const disallowedParents = collectDescendantGroupIds(
                architectureData.groups,
                group.id
              );
              const iconIsPreset = group.icon
                ? (BUILTIN_ICON_PRESETS as readonly string[]).includes(
                    group.icon
                  )
                : true;
              return (
                <div key={group.id} className="arch-subcard">
                  <div className="arch-subcard-header">
                    <span className="arch-subcard-id">{group.id}</span>
                    <button
                      type="button"
                      className="btn-icon-danger"
                      title={t.inspector.architecture.deleteGroup}
                      onClick={() => handleDeleteGroup(group.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div className="field-group">
                    <label className="field-label">
                      {t.inspector.architecture.groupTitleLabel}
                    </label>
                    <GuardedInput
                      className="field-input"
                      value={group.title}
                      placeholder={
                        t.inspector.architecture.groupTitlePlaceholder
                      }
                      forbiddenRegex={FORBIDDEN_ARCHITECTURE_TITLE_CHARS_REGEX}
                      formatError={
                        t.inspector.safeguard.architectureTitleErrorChars
                      }
                      onChangeValue={(nextVal) =>
                        updateGroup(group.id, { title: nextVal })
                      }
                    />
                  </div>

                  <div className="arch-edge-endpoint-grid">
                    <div className="field-group">
                      <label className="field-label">
                        {t.inspector.architecture.nodeIconLabel}
                      </label>
                      <select
                        className="field-select"
                        value={
                          iconIsPreset ? group.icon || 'cloud' : 'custom'
                        }
                        onChange={(e) => {
                          if (e.target.value === 'custom') {
                            return;
                          }
                          updateGroup(group.id, { icon: e.target.value });
                        }}
                      >
                        {BUILTIN_ICON_PRESETS.map((preset) => (
                          <option key={preset} value={preset}>
                            {t.inspector.architecture.iconPresets[preset]}
                          </option>
                        ))}
                        {!iconIsPreset && (
                          <option value="custom">{group.icon}</option>
                        )}
                      </select>
                    </div>

                    <div className="field-group">
                      <label className="field-label">
                        {t.inspector.architecture.groupParentLabel}
                      </label>
                      <select
                        className="field-select"
                        value={group.parentId ?? ''}
                        onChange={(e) =>
                          updateGroup(group.id, {
                            parentId: e.target.value || undefined,
                          })
                        }
                      >
                        <option value="">
                          {t.inspector.architecture.noParentOption}
                        </option>
                        {architectureData.groups
                          .filter((cand) => !disallowedParents.has(cand.id))
                          .map((cand) => (
                            <option key={cand.id} value={cand.id}>
                              {cand.title || cand.id} ({cand.id})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ArchAccordion>

      {/* Layout & Alignment */}
      <ArchAccordion
        title={t.inspector.architecture.layoutSection}
        countBadge={architectureData.alignments?.length ?? 0}
        isOpen={openSections.layout}
        onToggle={() => toggleSection('layout')}
      >
        <div className="field-group">
          <label className="field-label">
            {t.inspector.architecture.diagramTitleLabel}
          </label>
          <GuardedInput
            className="field-input"
            value={architectureData.title ?? ''}
            placeholder={t.inspector.architecture.diagramTitlePlaceholder}
            forbiddenRegex={FORBIDDEN_ARCHITECTURE_TITLE_CHARS_REGEX}
            formatError={t.inspector.safeguard.architectureTitleErrorChars}
            onChangeValue={(nextVal) =>
              onChange({ ...architectureData, title: nextVal })
            }
          />
        </div>

        <div className="arch-spacing-grid">
          <div className="field-group">
            <label className="field-label">
              {t.inspector.architecture.paddingLabel}
            </label>
            <input
              type="number"
              min={0}
              step={5}
              className="field-input"
              placeholder="40"
              value={architectureData.padding ?? ''}
              onChange={(e) =>
                handleOptionalNumberChange('padding', e.target.value)
              }
            />
          </div>
          <div className="field-group">
            <label className="field-label">
              {t.inspector.architecture.iconSizeLabel}
            </label>
            <input
              type="number"
              min={20}
              step={5}
              className="field-input"
              placeholder="80"
              value={architectureData.iconSize ?? ''}
              onChange={(e) =>
                handleOptionalNumberChange('iconSize', e.target.value)
              }
            />
          </div>
          <div className="field-group">
            <label className="field-label">
              {t.inspector.architecture.nodeSeparationLabel}
            </label>
            <input
              type="number"
              min={10}
              step={5}
              className="field-input"
              placeholder="75"
              value={architectureData.nodeSeparation ?? ''}
              onChange={(e) =>
                handleOptionalNumberChange('nodeSeparation', e.target.value)
              }
            />
          </div>
        </div>

        <div className="field-group">
          <div className="arch-align-header">
            <label className="field-label">
              {t.inspector.architecture.alignmentsLabel}
            </label>
            <button
              type="button"
              className="btn-secondary btn-xs"
              disabled={architectureData.nodes.length < 2}
              onClick={handleAddAlignment}
            >
              <Plus size={12} />
              <span>{t.inspector.architecture.addAlignment}</span>
            </button>
          </div>

          {(architectureData.alignments ?? []).map((hint) => (
            <div key={hint.id} className="arch-subcard">
              <div className="arch-align-row-top">
                <select
                  className="field-select"
                  value={hint.direction}
                  onChange={(e) =>
                    updateAlignment(hint.id, (prev) => ({
                      ...prev,
                      direction: e.target.value as ArchitectureAlignDirection,
                    }))
                  }
                >
                  <option value="row">
                    {t.inspector.architecture.alignDirs.row}
                  </option>
                  <option value="column">
                    {t.inspector.architecture.alignDirs.column}
                  </option>
                </select>
                <button
                  type="button"
                  className="btn-danger-outline btn-xs"
                  onClick={() => handleDeleteAlignment(hint.id)}
                >
                  {t.inspector.architecture.deleteAlignment}
                </button>
              </div>
              <div className="arch-align-members">
                {architectureData.nodes.map((node) => {
                  const checked = hint.members.includes(node.id);
                  return (
                    <button
                      key={node.id}
                      type="button"
                      className={`arch-align-member-pill ${
                        checked ? 'is-active' : ''
                      }`}
                      onClick={() =>
                        updateAlignment(hint.id, (prev) => ({
                          ...prev,
                          members: checked
                            ? prev.members.filter((m) => m !== node.id)
                            : [...prev.members, node.id],
                        }))
                      }
                    >
                      {node.title || node.id}
                    </button>
                  );
                })}
              </div>
              {hint.members.length < 2 && (
                <p className="field-warning">
                  {t.inspector.architecture.alignMembersHint}
                </p>
              )}
            </div>
          ))}
        </div>
      </ArchAccordion>

      {/* Comments */}
      <ArchAccordion
        title={t.inspector.architecture.commentsSection}
        countBadge={architectureData.comments?.length ?? 0}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
      >
        <div className="field-group">
          <label className="field-label">
            {t.inspector.architecture.commentsLabel}
          </label>
          <textarea
            className="field-textarea"
            rows={3}
            placeholder={t.inspector.architecture.commentsPlaceholder}
            value={(architectureData.comments ?? []).join('\n')}
            onChange={(e) => {
              const lines = e.target.value
                .split(/\r?\n/)
                .filter((line) => line.trim() !== '');
              onChange({
                ...architectureData,
                comments: lines.length > 0 ? lines : undefined,
              });
            }}
          />
        </div>
      </ArchAccordion>
    </div>
  );
}
