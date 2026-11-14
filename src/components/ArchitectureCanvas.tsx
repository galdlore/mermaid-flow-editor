import {
  ArrowRight,
  ArrowRightLeft,
  Box,
  Cloud,
  Database,
  Folder,
  FolderPlus,
  GitCommitHorizontal,
  Globe,
  HardDrive,
  Plus,
  Server,
} from 'lucide-react';
import { useI18n } from '../i18n';
import type {
  ArchitectureDiagramData,
  ArchitectureDirection,
  ArchitectureEdgeData,
  ArchitectureGroupData,
  ArchitectureNodeData,
} from '../types/editor';

export interface ArchitectureCanvasProps {
  architectureData: ArchitectureDiagramData;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onChange: (next: ArchitectureDiagramData) => void;
  onSelectNode: (nodeId: string | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
}

const OPPOSITE_DIR: Record<ArchitectureDirection, ArchitectureDirection> = {
  L: 'R',
  R: 'L',
  T: 'B',
  B: 'T',
};

function nextId(prefix: string, existingIds: Iterable<string>): string {
  const used = new Set(existingIds);
  let num = 1;
  while (used.has(`${prefix}_${num}`)) {
    num++;
  }
  return `${prefix}_${num}`;
}

function renderArchIcon(icon?: string, size = 16) {
  switch ((icon ?? 'server').trim().toLowerCase()) {
    case 'cloud':
      return <Cloud size={size} />;
    case 'database':
      return <Database size={size} />;
    case 'disk':
      return <HardDrive size={size} />;
    case 'internet':
      return <Globe size={size} />;
    case 'server':
      return <Server size={size} />;
    case 'blank':
      return null;
    default:
      return <Box size={size} />;
  }
}

export default function ArchitectureCanvas({
  architectureData,
  selectedNodeId,
  selectedEdgeId,
  onChange,
  onSelectNode,
  onSelectEdge,
}: ArchitectureCanvasProps) {
  const { t } = useI18n();

  const groupIds = new Set(architectureData.groups.map((g) => g.id));

  const nodeLabelMap = new Map<string, string>();
  for (const node of architectureData.nodes) {
    nodeLabelMap.set(
      node.id,
      node.type === 'junction'
        ? `${node.id} (${t.inspector.architecture.junctionBadge})`
        : node.title?.trim() || node.id
    );
  }

  const handleAddNode = (nodeType: 'service' | 'junction'): void => {
    const existingIds = [
      ...architectureData.nodes.map((n) => n.id),
      ...architectureData.groups.map((g) => g.id),
    ];
    const id = nextId(nodeType === 'junction' ? 'junction' : 'service', existingIds);
    const selectedNode = architectureData.nodes.find((n) => n.id === selectedNodeId);
    const defaultGroupId = selectedNode?.groupId;

    const newNode: ArchitectureNodeData =
      nodeType === 'junction'
        ? {
            id,
            type: 'junction',
            ...(defaultGroupId ? { groupId: defaultGroupId } : {}),
          }
        : {
            id,
            type: 'service',
            icon: 'server',
            title: t.inspector.architecture.defaultServiceTitle(
              architectureData.nodes.filter((n) => n.type === 'service').length + 1
            ),
            ...(defaultGroupId ? { groupId: defaultGroupId } : {}),
          };

    onChange({
      ...architectureData,
      nodes: [...architectureData.nodes, newNode],
    });
    onSelectNode(id);
    onSelectEdge(null);
  };

  const handleAddGroup = (): void => {
    const existingIds = [
      ...architectureData.groups.map((g) => g.id),
      ...architectureData.nodes.map((n) => n.id),
    ];
    const id = nextId('group', existingIds);
    const newGroup: ArchitectureGroupData = {
      id,
      icon: 'cloud',
      title: t.inspector.architecture.defaultGroupTitle(
        architectureData.groups.length + 1
      ),
    };
    onChange({
      ...architectureData,
      groups: [...architectureData.groups, newGroup],
    });
  };

  const handleAddEdge = (): void => {
    if (architectureData.nodes.length < 2) {
      return;
    }
    const lhsNode =
      architectureData.nodes.find((n) => n.id === selectedNodeId) ??
      architectureData.nodes[0];
    const rhsNode =
      architectureData.nodes.find((n) => n.id !== lhsNode.id) ??
      architectureData.nodes[1];
    if (!lhsNode || !rhsNode || lhsNode.id === rhsNode.id) {
      return;
    }
    const id = nextId(
      'edge',
      architectureData.edges.map((e) => e.id)
    );
    const lhsDir: ArchitectureDirection = 'R';
    const newEdge: ArchitectureEdgeData = {
      id,
      lhsId: lhsNode.id,
      lhsDir,
      rhsId: rhsNode.id,
      rhsDir: OPPOSITE_DIR[lhsDir],
      rhsInto: true,
    };
    onChange({
      ...architectureData,
      edges: [...architectureData.edges, newEdge],
    });
    onSelectEdge(id);
  };

  const renderNodeCard = (node: ArchitectureNodeData) => {
    const isSelected = node.id === selectedNodeId;
    const isJunction = node.type === 'junction';

    return (
      <button
        key={node.id}
        type="button"
        className={`arch-node-card ${isJunction ? 'is-junction' : 'is-service'} ${
          isSelected ? 'is-selected' : ''
        }`}
        onClick={() => onSelectNode(node.id)}
      >
        <div className="arch-node-icon">
          {isJunction ? (
            <GitCommitHorizontal size={16} />
          ) : (
            renderArchIcon(node.icon, 18) ?? <Box size={16} />
          )}
        </div>
        <div className="arch-node-meta">
          <div className="arch-node-title">
            {isJunction
              ? t.inspector.architecture.junctionBadge
              : node.title?.trim() || node.id}
          </div>
          <div className="arch-node-id">
            <span>{node.id}</span>
            {!isJunction && node.icon && (
              <span className="arch-node-icon-tag">{node.icon}</span>
            )}
          </div>
        </div>
      </button>
    );
  };

  const renderGroupBox = (
    group: ArchitectureGroupData,
    visited: Set<string>,
    depth = 0
  ) => {
    if (visited.has(group.id) || depth > 8) {
      return null;
    }
    const nextVisited = new Set(visited);
    nextVisited.add(group.id);

    const childGroups = architectureData.groups.filter(
      (g) => g.parentId === group.id
    );
    const childNodes = architectureData.nodes.filter(
      (n) => n.groupId === group.id
    );

    return (
      <div
        key={group.id}
        className={`arch-group-box ${depth > 0 ? 'is-nested' : ''}`}
      >
        <div className="arch-group-header">
          <span className="arch-group-icon">
            {renderArchIcon(group.icon || 'cloud', 14) ?? <Folder size={14} />}
          </span>
          <span className="arch-group-title">{group.title || group.id}</span>
          <span className="arch-group-id">{group.id}</span>
        </div>

        <div className="arch-group-content">
          {childNodes.length > 0 && (
            <div className="arch-nodes-grid">
              {childNodes.map((node) => renderNodeCard(node))}
            </div>
          )}
          {childGroups.length > 0 && (
            <div className="arch-nested-groups">
              {childGroups.map((cg) => renderGroupBox(cg, nextVisited, depth + 1))}
            </div>
          )}
          {childNodes.length === 0 && childGroups.length === 0 && (
            <div className="arch-group-empty">
              {t.inspector.architecture.emptyNodes}
            </div>
          )}
        </div>
      </div>
    );
  };

  const topGroups = architectureData.groups.filter(
    (g) => !g.parentId || !groupIds.has(g.parentId) || g.parentId === g.id
  );
  const ungroupedNodes = architectureData.nodes.filter(
    (n) => !n.groupId || !groupIds.has(n.groupId)
  );

  return (
    <div className="arch-canvas-container">
      <div className="arch-canvas-toolbar">
        <button
          type="button"
          className="btn-secondary btn-xs"
          onClick={() => handleAddNode('service')}
        >
          <Plus size={14} />
          <span>{t.inspector.architecture.addService}</span>
        </button>
        <button
          type="button"
          className="btn-secondary btn-xs"
          onClick={() => handleAddNode('junction')}
        >
          <GitCommitHorizontal size={14} />
          <span>{t.inspector.architecture.addJunction}</span>
        </button>
        <button
          type="button"
          className="btn-secondary btn-xs"
          onClick={handleAddGroup}
        >
          <FolderPlus size={14} />
          <span>{t.inspector.architecture.addGroup}</span>
        </button>
        <button
          type="button"
          className="btn-secondary btn-xs"
          disabled={architectureData.nodes.length < 2}
          onClick={handleAddEdge}
        >
          <ArrowRightLeft size={14} />
          <span>{t.inspector.architecture.addEdge}</span>
        </button>
      </div>

      <div className="arch-canvas-board">
        {architectureData.title && (
          <div className="arch-diagram-title-banner">
            {architectureData.title}
          </div>
        )}

        {architectureData.nodes.length === 0 &&
        architectureData.groups.length === 0 ? (
          <div className="arch-empty-state">
            {t.inspector.architecture.emptyNodes}
          </div>
        ) : (
          <div className="arch-layout-stack">
            {ungroupedNodes.length > 0 && (
              <div className="arch-ungrouped-box">
                <div className="arch-group-header is-ungrouped">
                  <span className="arch-group-title">
                    {t.inspector.architecture.ungroupedTitle}
                  </span>
                </div>
                <div className="arch-nodes-grid">
                  {ungroupedNodes.map((node) => renderNodeCard(node))}
                </div>
              </div>
            )}

            {topGroups.map((group) => renderGroupBox(group, new Set()))}
          </div>
        )}
      </div>

      <div className="arch-edges-strip">
        <div className="arch-edges-strip-title">
          {t.inspector.architecture.edgesSection} ({architectureData.edges.length})
        </div>
        {architectureData.edges.length === 0 ? (
          <div className="arch-edges-empty">
            {t.inspector.architecture.emptyEdges}
          </div>
        ) : (
          <div className="arch-edges-pills">
            {architectureData.edges.map((edge) => {
              const isSelected = edge.id === selectedEdgeId;
              const lhsName = nodeLabelMap.get(edge.lhsId) ?? edge.lhsId;
              const rhsName = nodeLabelMap.get(edge.rhsId) ?? edge.rhsId;
              return (
                <button
                  key={edge.id}
                  type="button"
                  className={`arch-edge-pill ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => onSelectEdge(edge.id)}
                >
                  <span className="arch-edge-node">{lhsName}</span>
                  <span className="arch-edge-port">
                    :{edge.lhsDir}
                    {edge.lhsGroup ? '{g}' : ''}
                  </span>
                  <span className="arch-edge-arrow">
                    {edge.lhsInto ? '<' : ''}
                    {edge.title ? ` [${edge.title}] ` : ' '}
                    <ArrowRight size={12} />
                    {edge.rhsInto ? '' : ''}
                  </span>
                  <span className="arch-edge-port">
                    {edge.rhsDir}
                    {edge.rhsGroup ? '{g}' : ''}:
                  </span>
                  <span className="arch-edge-node">{rhsName}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
