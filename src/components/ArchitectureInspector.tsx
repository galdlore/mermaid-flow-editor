import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import {
  InspectorBulkControls,
  InspectorCommentsSection,
} from './InspectorCommon';
import ArchitectureEdgeSection from './architecture/ArchitectureEdgeSection';
import {
  ArchitectureGroupsSection,
  ArchitectureLayoutSection,
} from './architecture/ArchitectureGroupsLayoutSection';
import ArchitectureNodeSection from './architecture/ArchitectureNodeSection';
import type {
  ArchitectureAlignHintData,
  ArchitectureDiagramData,
  ArchitectureEdgeData,
  ArchitectureGroupData,
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

function nextId(prefix: string, usedIds: Iterable<string>): string {
  const used = new Set(usedIds);
  let num = 1;
  while (used.has(`${prefix}_${num}`)) {
    num++;
  }
  return `${prefix}_${num}`;
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

  const setAllSections = (open: boolean): void => {
    setOpenSections({
      node: open,
      edges: open,
      groups: open,
      layout: open,
      comments: open,
    });
  };
  const allExpanded = Object.values(openSections).every(Boolean);

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
    const lhs = selectedNode ?? architectureData.nodes[0];
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

  return (
    <div className="inspector-content">
      <InspectorBulkControls allExpanded={allExpanded} onSetAll={setAllSections} />

      <ArchitectureNodeSection
        nodes={architectureData.nodes}
        groups={architectureData.groups}
        selectedNode={selectedNode}
        isOpen={openSections.node}
        onToggle={() => toggleSection('node')}
        onSelectNode={onSelectNode}
        onUpdateSelectedNode={updateSelectedNode}
        onDeleteNode={handleDeleteNode}
      />

      <ArchitectureEdgeSection
        nodes={architectureData.nodes}
        edges={architectureData.edges}
        selectedEdge={selectedEdge}
        nodeGroupMap={nodeGroupMap}
        isOpen={openSections.edges}
        onToggle={() => toggleSection('edges')}
        onSelectEdge={onSelectEdge}
        onAddEdge={handleAddEdge}
        onUpdateEdge={updateEdge}
        onDeleteEdge={handleDeleteEdge}
      />

      <ArchitectureGroupsSection
        groups={architectureData.groups}
        isOpen={openSections.groups}
        onToggle={() => toggleSection('groups')}
        onAddGroup={handleAddGroup}
        onUpdateGroup={updateGroup}
        onDeleteGroup={handleDeleteGroup}
      />

      <ArchitectureLayoutSection
        architectureData={architectureData}
        nodes={architectureData.nodes}
        isOpen={openSections.layout}
        onToggle={() => toggleSection('layout')}
        onChangeTitle={(nextTitle) =>
          onChange({ ...architectureData, title: nextTitle })
        }
        onOptionalNumberChange={handleOptionalNumberChange}
        onAddAlignment={handleAddAlignment}
        onUpdateAlignment={updateAlignment}
        onDeleteAlignment={handleDeleteAlignment}
      />

      <InspectorCommentsSection
        title={t.inspector.architecture.commentsSection}
        fieldLabel={t.inspector.architecture.commentsLabel}
        placeholder={t.inspector.architecture.commentsPlaceholder}
        comments={architectureData.comments}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
        onChangeComments={(nextComments) =>
          onChange({
            ...architectureData,
            comments: nextComments,
          })
        }
      />
    </div>
  );
}
