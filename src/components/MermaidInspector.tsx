import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import {
  COLOR_PALETTE_ITEMS,
  InspectorCollapsibleSection,
  STROKE_COLOR_PALETTE_ITEMS,
} from './InspectorCollapsibleSection';
import {
  InspectorBulkControls,
  InspectorCommentsSection,
} from './InspectorCommon';
import {
  FORBIDDEN_CLASS_NAME_CHARS_REGEX,
  FORBIDDEN_LABEL_CHARS_REGEX,
  FORBIDDEN_URL_CHARS_REGEX,
} from '../utils/inputSafeguard';
import type {
  EdgeLabelStyle,
  EdgeLineType,
  MermaidClassDefData,
  MermaidDiagramData,
  MermaidDirection,
  MermaidEdgeData,
  MermaidNodeData,
  MermaidSubgraphData,
  NodeShape,
} from '../types/editor';

export interface MermaidInspectorProps {
  diagramData: MermaidDiagramData;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onChange: (next: MermaidDiagramData) => void;
  onSelectNode: (nodeId: string | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
}

const DIRECTION_VALUES: ReadonlyArray<MermaidDirection> = ['TD', 'LR', 'BT', 'RL'];

const SHAPE_VALUES: ReadonlyArray<NodeShape> = [
  'rect',
  'round',
  'stadium',
  'subroutine',
  'cylinder',
  'circle',
  'asymmetric',
  'diamond',
  'hexagon',
  'parallelogram',
  'parallelogram_alt',
  'trapezoid',
  'trapezoid_alt',
  'double_circle',
  'doc',
  'cyl_modern',
];

function ShapeMiniIcon({ shape }: { shape: NodeShape }) {
  return (
    <svg className="shape-mini-icon" viewBox="0 0 24 16" aria-hidden="true">
      {shape === 'rect' && <rect x="2" y="2" width="20" height="12" rx="1" />}
      {shape === 'round' && <rect x="2" y="2" width="20" height="12" rx="4" />}
      {shape === 'stadium' && <rect x="2" y="2" width="20" height="12" rx="6" />}
      {shape === 'subroutine' && (
        <>
          <rect x="2" y="2" width="20" height="12" rx="1" />
          <line x1="5.5" y1="2" x2="5.5" y2="14" />
          <line x1="18.5" y1="2" x2="18.5" y2="14" />
        </>
      )}
      {(shape === 'cylinder' || shape === 'cyl_modern') && (
        <>
          <path d="M 4,4.5 L 4,12.5 A 8,2.2 0 0 0 20,12.5 L 20,4.5" />
          <ellipse cx="12" cy="4.5" rx="8" ry="2.2" />
        </>
      )}
      {shape === 'circle' && <circle cx="12" cy="8" r="6.5" />}
      {shape === 'double_circle' && (
        <>
          <circle cx="12" cy="8" r="6.5" />
          <circle cx="12" cy="8" r="4.2" />
        </>
      )}
      {shape === 'asymmetric' && <polygon points="2,2 22,2 22,14 2,14 6,8" />}
      {shape === 'diamond' && <polygon points="12,1.5 22,8 12,14.5 2,8" />}
      {shape === 'hexagon' && <polygon points="6,2 18,2 22,8 18,14 6,14 2,8" />}
      {shape === 'parallelogram' && <polygon points="6,2 22,2 18,14 2,14" />}
      {shape === 'parallelogram_alt' && <polygon points="2,2 18,2 22,14 6,14" />}
      {shape === 'trapezoid' && <polygon points="6,2 18,2 22,14 2,14" />}
      {shape === 'trapezoid_alt' && <polygon points="2,2 22,2 18,14 6,14" />}
      {shape === 'doc' && <path d="M 3,2 L 21,2 L 21,12 Q 16.5,9.5 12,12 T 3,12 Z" />}
    </svg>
  );
}

const LINE_TYPE_VALUES: ReadonlyArray<EdgeLineType> = [
  'arrow',
  'line',
  'dotted',
  'thick',
  'circle',
  'cross',
  'bidirectional',
  'invisible',
];

const EDGE_LENGTH_VALUES = [0, 1, 2, 3] as const;

function createUniqueNodeId(nodes: MermaidNodeData[]): string {
  let index = nodes.length + 1;
  while (nodes.some((node) => node.id === `node_${index}`)) {
    index += 1;
  }
  return `node_${index}`;
}

function createUniqueEdgeId(edges: MermaidEdgeData[]): string {
  let index = edges.length + 1;
  while (edges.some((edge) => edge.id === `edge_${index}`)) {
    index += 1;
  }
  return `edge_${index}`;
}

function createUniqueSubgraphId(subgraphs: MermaidSubgraphData[]): string {
  let index = subgraphs.length + 1;
  while (subgraphs.some((sg) => sg.id === `sg_${index}`)) {
    index += 1;
  }
  return `sg_${index}`;
}

function sanitizeClassDefName(raw: string, fallbackIndex: number): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!cleaned) {
    return `style_${fallbackIndex}`;
  }
  return /^[a-zA-Z_]/.test(cleaned) ? cleaned : `c_${cleaned}`;
}

type InspectorSectionKey =
  | 'direction'
  | 'nodes'
  | 'edges'
  | 'subgraphs'
  | 'classDefs'
  | 'comments';

const DEFAULT_OPEN_SECTIONS: Record<InspectorSectionKey, boolean> = {
  direction: true,
  nodes: true,
  edges: false,
  subgraphs: false,
  classDefs: false,
  comments: false,
};

export default function MermaidInspector({
  diagramData,
  selectedNodeId,
  selectedEdgeId,
  onChange,
  onSelectNode,
  onSelectEdge,
}: MermaidInspectorProps) {
  const { t } = useI18n();
  const [openSections, setOpenSections] = useState<Record<InspectorSectionKey, boolean>>(
    DEFAULT_OPEN_SECTIONS
  );
  const [newEdgeSource, setNewEdgeSource] = useState<string>('');
  const [newEdgeTarget, setNewEdgeTarget] = useState<string>('');
  const [newEdgeLineType, setNewEdgeLineType] = useState<EdgeLineType>('arrow');
  const [newEdgeLength, setNewEdgeLength] = useState<number>(0);
  const [newEdgeLabelStyle, setNewEdgeLabelStyle] = useState<EdgeLabelStyle>('pipe');
  const [newEdgeStrokeColor, setNewEdgeStrokeColor] = useState<string>('');
  const [newEdgeLabel, setNewEdgeLabel] = useState<string>('');
  const isSwimlane = diagramData.diagramType === 'swimlane';
  const [newSubgraphTitle, setNewSubgraphTitle] = useState<string>('');
  const [newSubgraphDirection, setNewSubgraphDirection] = useState<MermaidDirection | ''>('');
  const [newLaneFill, setNewLaneFill] = useState<string>('#eff6ff');
  const [newLaneStroke, setNewLaneStroke] = useState<string>('#2563eb');
  const [newClassName, setNewClassName] = useState<string>('');
  const [newClassFill, setNewClassFill] = useState<string>('#eff6ff');
  const [newClassStroke, setNewClassStroke] = useState<string>('#2563eb');

  useEffect(() => {
    if (isSwimlane) {
      setOpenSections((prev) => (prev.subgraphs ? prev : { ...prev, subgraphs: true }));
    }
  }, [isSwimlane]);

  useEffect(() => {
    if (selectedNodeId) {
      setOpenSections((prev) => (prev.nodes ? prev : { ...prev, nodes: true }));
    }
  }, [selectedNodeId]);

  useEffect(() => {
    if (selectedEdgeId) {
      setOpenSections((prev) => (prev.edges ? prev : { ...prev, edges: true }));
    }
  }, [selectedEdgeId]);

  const toggleSection = (key: InspectorSectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSectionsOpen = (nextOpen: boolean): void => {
    setOpenSections({
      direction: nextOpen,
      nodes: nextOpen,
      edges: nextOpen,
      subgraphs: nextOpen,
      classDefs: nextOpen,
      comments: nextOpen,
    });
  };

  useEffect(() => {
    const nodes = diagramData.nodes;
    if (nodes.length === 0) {
      setNewEdgeSource('');
      setNewEdgeTarget('');
      return;
    }

    if (!nodes.some((n) => n.id === newEdgeSource)) {
      setNewEdgeSource(nodes[0].id);
    }

    if (!nodes.some((n) => n.id === newEdgeTarget)) {
      setNewEdgeTarget(nodes.length > 1 ? nodes[1].id : nodes[0].id);
    }
  }, [diagramData.nodes, newEdgeSource, newEdgeTarget]);

  const selectedNode =
    diagramData.nodes.find((node) => node.id === selectedNodeId) ?? null;

  const handleDirectionChange = (direction: MermaidDirection): void => {
    onChange({ ...diagramData, direction });
  };

  const handleAddNode = (targetLaneId?: string): void => {
    const nextId = createUniqueNodeId(diagramData.nodes);
    const count = diagramData.nodes.length;
    const assignedLaneId = isSwimlane
      ? targetLaneId ?? subgraphs[0]?.id
      : undefined;

    let position = {
      x: (count % 3) * 200 + 80,
      y: Math.floor(count / 3) * 130 + 60,
    };

    if (isSwimlane) {
      const laneIdx = Math.max(
        0,
        subgraphs.findIndex((sg) => sg.id === assignedLaneId)
      );
      const membersInLane = diagramData.nodes.filter(
        (n) => n.subgraphId === assignedLaneId
      ).length;
      const isHorizontalLane =
        diagramData.direction === 'LR' || diagramData.direction === 'RL';

      position = isHorizontalLane
        ? { x: 140 + membersInLane * 200, y: 60 + laneIdx * 150 }
        : { x: 60 + laneIdx * 240, y: 70 + membersInLane * 130 };
    }

    const newNode: MermaidNodeData = {
      id: nextId,
      label: isSwimlane
        ? t.inspector.swimlane.defaultStepTitle(count + 1)
        : t.inspector.defaultNewNodeLabel(count + 1),
      shape: 'rect',
      color: '#ffffff',
      ...(assignedLaneId ? { subgraphId: assignedLaneId } : {}),
      position,
    };

    onChange({
      ...diagramData,
      nodes: [...diagramData.nodes, newNode],
    });
    onSelectEdge(null);
    onSelectNode(nextId);
  };

  const handleUpdateSelectedNode = (patch: Partial<MermaidNodeData>): void => {
    if (!selectedNode) {
      return;
    }
    const nextNodes = diagramData.nodes.map((node) =>
      node.id === selectedNode.id ? { ...node, ...patch } : node
    );
    onChange({ ...diagramData, nodes: nextNodes });
  };

  const handleDeleteSelectedNode = (): void => {
    if (!selectedNode) {
      return;
    }
    const nextNodes = diagramData.nodes.filter((node) => node.id !== selectedNode.id);
    const nextEdges = diagramData.edges.filter(
      (edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id
    );
    onChange({
      ...diagramData,
      nodes: nextNodes,
      edges: nextEdges,
    });
    onSelectNode(null);
  };

  const getLengthOptionLabel = (len: number): string => {
    switch (len) {
      case 1:
        return t.inspector.edgeLengths.long1;
      case 2:
        return t.inspector.edgeLengths.long2;
      case 3:
        return t.inspector.edgeLengths.long3;
      case 0:
      default:
        return t.inspector.edgeLengths.standard;
    }
  };

  const handleAddEdge = (): void => {
    if (!newEdgeSource || !newEdgeTarget) {
      return;
    }
    const nextEdge: MermaidEdgeData = {
      id: createUniqueEdgeId(diagramData.edges),
      source: newEdgeSource,
      target: newEdgeTarget,
      lineType: newEdgeLineType,
      ...(newEdgeLength > 0 ? { extraLength: newEdgeLength } : {}),
      ...(newEdgeLabelStyle !== 'pipe' ? { labelStyle: newEdgeLabelStyle } : {}),
      ...(newEdgeStrokeColor ? { strokeColor: newEdgeStrokeColor } : {}),
      label: newEdgeLabel.trim() || undefined,
    };
    onChange({
      ...diagramData,
      edges: [...diagramData.edges, nextEdge],
    });
    setNewEdgeLabel('');
    onSelectNode(null);
    onSelectEdge(nextEdge.id);
  };

  const handleUpdateEdge = (edgeId: string, patch: Partial<MermaidEdgeData>): void => {
    const nextEdges = diagramData.edges.map((edge) =>
      edge.id === edgeId ? { ...edge, ...patch } : edge
    );
    onChange({ ...diagramData, edges: nextEdges });
  };

  const handleDeleteEdge = (edgeId: string): void => {
    const nextEdges = diagramData.edges.filter((edge) => edge.id !== edgeId);
    onChange({ ...diagramData, edges: nextEdges });
    if (selectedEdgeId === edgeId) {
      onSelectEdge(null);
    }
  };

  const subgraphs = diagramData.subgraphs ?? [];
  const classDefs = diagramData.classDefs ?? [];

  const handleAddSubgraph = (): void => {
    const nextId = createUniqueSubgraphId(subgraphs);
    const nextTitle =
      newSubgraphTitle.trim() ||
      (isSwimlane
        ? t.inspector.swimlane.defaultLaneTitle(subgraphs.length + 1)
        : t.inspector.defaultSubgraphTitle(subgraphs.length + 1));
    const nextSubgraph: MermaidSubgraphData = {
      id: nextId,
      title: nextTitle,
      ...(!isSwimlane && newSubgraphDirection ? { direction: newSubgraphDirection } : {}),
      ...(isSwimlane ? { fill: newLaneFill, stroke: newLaneStroke } : {}),
    };
    onChange({
      ...diagramData,
      subgraphs: [...subgraphs, nextSubgraph],
    });
    setNewSubgraphTitle('');
    setNewSubgraphDirection('');
  };

  const handleMoveSubgraph = (subgraphId: string, delta: -1 | 1): void => {
    const index = subgraphs.findIndex((sg) => sg.id === subgraphId);
    const nextIndex = index + delta;
    if (index < 0 || nextIndex < 0 || nextIndex >= subgraphs.length) {
      return;
    }
    const nextSubgraphs = [...subgraphs];
    const [moved] = nextSubgraphs.splice(index, 1);
    nextSubgraphs.splice(nextIndex, 0, moved);
    onChange({
      ...diagramData,
      subgraphs: nextSubgraphs,
    });
  };

  const handleUpdateSubgraph = (
    subgraphId: string,
    patch: Partial<MermaidSubgraphData>
  ): void => {
    const nextSubgraphs = subgraphs.map((sg) =>
      sg.id === subgraphId ? { ...sg, ...patch } : sg
    );
    onChange({ ...diagramData, subgraphs: nextSubgraphs });
  };

  const handleDeleteSubgraph = (subgraphId: string): void => {
    const nextSubgraphs = subgraphs.filter((sg) => sg.id !== subgraphId);
    const nextNodes = diagramData.nodes.map((node) =>
      node.subgraphId === subgraphId ? { ...node, subgraphId: undefined } : node
    );
    onChange({
      ...diagramData,
      nodes: nextNodes,
      subgraphs: nextSubgraphs.length > 0 ? nextSubgraphs : undefined,
    });
  };

  const handleAddClassDef = (): void => {
    const className = sanitizeClassDefName(newClassName, classDefs.length + 1);
    const nextClassDef: MermaidClassDefData = {
      name: className,
      fill: newClassFill,
      stroke: newClassStroke || '#475569',
      color: '#0f172a',
    };
    const exists = classDefs.some((cls) => cls.name === className);
    const nextClassDefs = exists
      ? classDefs.map((cls) => (cls.name === className ? nextClassDef : cls))
      : [...classDefs, nextClassDef];
    onChange({
      ...diagramData,
      classDefs: nextClassDefs,
    });
    setNewClassName('');
  };

  const handleDeleteClassDef = (className: string): void => {
    const nextClassDefs = classDefs.filter((cls) => cls.name !== className);
    const nextNodes = diagramData.nodes.map((node) =>
      node.className === className ? { ...node, className: undefined } : node
    );
    onChange({
      ...diagramData,
      nodes: nextNodes,
      classDefs: nextClassDefs.length > 0 ? nextClassDefs : undefined,
    });
  };

  const subgraphsOrLanesSection = (
    <InspectorCollapsibleSection
      title={isSwimlane ? t.inspector.swimlane.lanesHeading : t.inspector.subgraphsHeading}
      badgeText={isSwimlane ? subgraphs.length : subgraphs.length > 0 ? subgraphs.length : undefined}
      isOpen={openSections.subgraphs}
      onToggle={() => toggleSection('subgraphs')}
    >
      <div className="edge-add-card">
        {isSwimlane ? (
          <>
            <label className="inspector-field">
              <span>{t.inspector.swimlane.laneTitleField}</span>
              <GuardedInput
                value={newSubgraphTitle}
                onChangeValue={(nextVal) => setNewSubgraphTitle(nextVal)}
                forbiddenRegex={FORBIDDEN_LABEL_CHARS_REGEX}
                formatError={t.inspector.safeguard.syntaxErrorChars}
                placeholder={t.inspector.swimlane.laneTitlePlaceholder}
              />
            </label>
            <div className="edge-add-grid">
              <label className="inspector-field">
                <span>{t.inspector.swimlane.laneFillField}</span>
                <select
                  value={newLaneFill}
                  onChange={(event) => setNewLaneFill(event.target.value)}
                >
                  {COLOR_PALETTE_ITEMS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {t.inspector.colors[item.key]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="inspector-field">
                <span>{t.inspector.swimlane.laneStrokeField}</span>
                <select
                  value={newLaneStroke}
                  onChange={(event) => setNewLaneStroke(event.target.value)}
                >
                  {STROKE_COLOR_PALETTE_ITEMS.filter((item) => item.value !== '').map((item) => (
                    <option key={item.key} value={item.value}>
                      {t.inspector.strokeColors[item.key]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        ) : (
          <div className="edge-add-grid">
            <label className="inspector-field">
              <span>{t.inspector.subgraphTitleField}</span>
              <GuardedInput
                value={newSubgraphTitle}
                onChangeValue={(nextVal) => setNewSubgraphTitle(nextVal)}
                forbiddenRegex={FORBIDDEN_LABEL_CHARS_REGEX}
                formatError={t.inspector.safeguard.syntaxErrorChars}
                placeholder={t.inspector.subgraphTitlePlaceholder}
              />
            </label>

            <label className="inspector-field">
              <span>{t.inspector.subgraphDirectionField}</span>
              <select
                value={newSubgraphDirection}
                onChange={(event) =>
                  setNewSubgraphDirection((event.target.value as MermaidDirection) || '')
                }
              >
                <option value="">{t.inspector.subgraphDirectionInherit}</option>
                {DIRECTION_VALUES.map((dir) => (
                  <option key={dir} value={dir}>
                    {t.inspector.directions[dir]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <button type="button" className="btn-primary btn-full" onClick={handleAddSubgraph}>
          <Plus size={14} />
          <span>{isSwimlane ? t.inspector.swimlane.addLaneBtn : t.inspector.addSubgraphBtn}</span>
        </button>
      </div>

      <div className="edge-list-container">
        {subgraphs.length === 0 ? (
          <p className="inspector-hint">
            {isSwimlane ? t.inspector.swimlane.noLanesHint : t.inspector.noSubgraphsHint}
          </p>
        ) : (
          subgraphs.map((sg, idx) => (
            <div key={sg.id} className="edge-list-item">
              <div className="edge-item-row">
                {isSwimlane && (
                  <div className="lane-reorder-group">
                    <button
                      type="button"
                      className="btn-icon-subtle"
                      title={t.inspector.swimlane.moveUpTitle}
                      disabled={idx === 0}
                      onClick={() => handleMoveSubgraph(sg.id, -1)}
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      className="btn-icon-subtle"
                      title={t.inspector.swimlane.moveDownTitle}
                      disabled={idx === subgraphs.length - 1}
                      onClick={() => handleMoveSubgraph(sg.id, 1)}
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>
                )}

                <GuardedInput
                  ariaLabel={
                    isSwimlane ? t.inspector.swimlane.laneTitleField : t.inspector.subgraphTitleField
                  }
                  value={sg.title}
                  onChangeValue={(nextVal) =>
                    handleUpdateSubgraph(sg.id, { title: nextVal })
                  }
                  forbiddenRegex={FORBIDDEN_LABEL_CHARS_REGEX}
                  formatError={t.inspector.safeguard.syntaxErrorChars}
                />

                {isSwimlane ? (
                  <button
                    type="button"
                    className="btn-icon-add-step"
                    title={t.inspector.swimlane.addStepToLaneTitle}
                    onClick={() => {
                      setOpenSections((prev) => ({ ...prev, nodes: true }));
                      handleAddNode(sg.id);
                    }}
                  >
                    <Plus size={14} />
                  </button>
                ) : (
                  <select
                    aria-label={t.inspector.subgraphDirectionField}
                    value={sg.direction ?? ''}
                    onChange={(event) =>
                      handleUpdateSubgraph(sg.id, {
                        direction: (event.target.value as MermaidDirection) || undefined,
                      })
                    }
                  >
                    <option value="">{t.inspector.subgraphDirectionInherit}</option>
                    {DIRECTION_VALUES.map((dir) => (
                      <option key={dir} value={dir}>
                        {t.inspector.directions[dir]}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  className="btn-icon-danger"
                  title={
                    isSwimlane ? t.inspector.swimlane.deleteLaneTitle : t.inspector.deleteSubgraphTitle
                  }
                  onClick={() => handleDeleteSubgraph(sg.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {isSwimlane && (
                <div className="edge-item-row">
                  <select
                    aria-label={t.inspector.swimlane.laneFillField}
                    value={sg.fill ?? '#ffffff'}
                    onChange={(event) =>
                      handleUpdateSubgraph(sg.id, {
                        fill: event.target.value === '#ffffff' ? undefined : event.target.value,
                      })
                    }
                  >
                    {COLOR_PALETTE_ITEMS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {t.inspector.colors[item.key]}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label={t.inspector.swimlane.laneStrokeField}
                    value={sg.stroke ?? ''}
                    onChange={(event) =>
                      handleUpdateSubgraph(sg.id, {
                        stroke: event.target.value || undefined,
                      })
                    }
                  >
                    {STROKE_COLOR_PALETTE_ITEMS.map((item) => (
                      <option key={item.key} value={item.value}>
                        {t.inspector.strokeColors[item.key]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </InspectorCollapsibleSection>
  );

  return (
    <aside className="inspector-panel">
      <InspectorBulkControls mode="dual" onSetAll={setAllSectionsOpen} />

      {isSwimlane && subgraphsOrLanesSection}

      <InspectorCollapsibleSection
        title={t.inspector.directionHeading}
        badgeText={diagramData.direction}
        isOpen={openSections.direction}
        onToggle={() => toggleSection('direction')}
      >
        <div className="direction-grid">
          {DIRECTION_VALUES.map((directionValue) => (
            <button
              key={directionValue}
              type="button"
              className={`inspector-choice-btn ${diagramData.direction === directionValue ? 'is-active' : ''
                }`}
              onClick={() => handleDirectionChange(directionValue)}
            >
              {isSwimlane
                ? t.inspector.swimlane.directions[directionValue]
                : t.inspector.directions[directionValue]}
            </button>
          ))}
        </div>
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={isSwimlane ? t.inspector.swimlane.nodesHeading : t.inspector.nodesHeading}
        badgeText={diagramData.nodes.length}
        isOpen={openSections.nodes}
        onToggle={() => toggleSection('nodes')}
        headerAction={
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={() => {
              setOpenSections((prev) => ({ ...prev, nodes: true }));
              handleAddNode();
            }}
          >
            <Plus size={14} />
            <span>{isSwimlane ? t.inspector.swimlane.addNodeBtn : t.inspector.addNodeBtn}</span>
          </button>
        }
      >

        <label className="inspector-field">
          <span>{t.inspector.targetNodeLabel}</span>
          <select
            value={selectedNodeId ?? ''}
            onChange={(event) => {
              const id = event.target.value || null;
              onSelectEdge(null);
              onSelectNode(id);
            }}
          >
            <option value="">{t.inspector.selectNodePlaceholder}</option>
            {diagramData.nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.label} ({node.id})
              </option>
            ))}
          </select>
        </label>

        {selectedNode ? (
          <div className="node-edit-box">
            <label className="inspector-field">
              <span>{t.inspector.nodeLabelField}</span>
              <GuardedInput
                value={selectedNode.label}
                onChangeValue={(nextVal) => handleUpdateSelectedNode({ label: nextVal })}
                forbiddenRegex={FORBIDDEN_LABEL_CHARS_REGEX}
                formatError={t.inspector.safeguard.syntaxErrorChars}
                placeholder={t.inspector.nodeLabelPlaceholder}
              />
            </label>

            <div className="inspector-field">
              <span>{t.inspector.nodeShapeField}</span>
              <div className="shape-grid-group">
                {SHAPE_VALUES.map((shapeValue) => {
                  const shapeInfo = t.inspector.shapes[shapeValue];
                  return (
                    <button
                      key={shapeValue}
                      type="button"
                      title={`${shapeInfo.syntax} (${shapeInfo.meaning})`}
                      className={`shape-choice-btn ${selectedNode.shape === shapeValue ? 'is-active' : ''
                        }`}
                      onClick={() => handleUpdateSelectedNode({ shape: shapeValue })}
                    >
                      <ShapeMiniIcon shape={shapeValue} />
                      <span className="shape-choice-text">
                        <span className="shape-choice-name">{shapeInfo.label}</span>
                        <span className="shape-choice-meta">{shapeInfo.meaning}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="inspector-field">
              <span>{t.inspector.nodeColorField}</span>
              <div className="color-palette-row">
                {COLOR_PALETTE_ITEMS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    title={t.inspector.colors[color.key]}
                    className={`color-swatch-btn ${(selectedNode.color || '#ffffff') === color.value ? 'is-active' : ''
                      }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => handleUpdateSelectedNode({ color: color.value })}
                  />
                ))}
              </div>
            </div>

            <div className="inspector-field">
              <span>{t.inspector.nodeStrokeColorField}</span>
              <div className="color-palette-row">
                {STROKE_COLOR_PALETTE_ITEMS.map((stroke) => (
                  <button
                    key={stroke.key}
                    type="button"
                    title={t.inspector.strokeColors[stroke.key]}
                    className={`color-swatch-btn stroke-swatch ${(selectedNode.strokeColor || '') === stroke.value ? 'is-active' : ''
                      }`}
                    style={{
                      backgroundColor: '#ffffff',
                      borderColor: stroke.value || '#cbd5e1',
                      borderWidth: stroke.value ? '3px' : '1px',
                    }}
                    onClick={() =>
                      handleUpdateSelectedNode({ strokeColor: stroke.value || undefined })
                    }
                  />
                ))}
              </div>
            </div>

            <div className="edge-add-grid">
              <label className="inspector-field">
                <span>
                  {isSwimlane ? t.inspector.swimlane.nodeLaneField : t.inspector.nodeSubgraphField}
                </span>
                <select
                  value={selectedNode.subgraphId ?? ''}
                  onChange={(event) =>
                    handleUpdateSelectedNode({
                      subgraphId: event.target.value || undefined,
                    })
                  }
                >
                  <option value="">
                    {isSwimlane ? t.inspector.swimlane.noLaneOption : t.inspector.noSubgraphOption}
                  </option>
                  {subgraphs.map((sg) => (
                    <option key={sg.id} value={sg.id}>
                      {sg.title || sg.id} ({sg.id})
                    </option>
                  ))}
                </select>
              </label>

              <label className="inspector-field">
                <span>{t.inspector.nodeClassField}</span>
                <select
                  value={selectedNode.className ?? ''}
                  onChange={(event) =>
                    handleUpdateSelectedNode({
                      className: event.target.value || undefined,
                    })
                  }
                >
                  <option value="">{t.inspector.noClassOption}</option>
                  {classDefs.map((cls) => (
                    <option key={cls.name} value={cls.name}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="edge-add-grid">
              <label className="inspector-field">
                <span>{t.inspector.nodeLinkUrlField}</span>
                <GuardedInput
                  type="url"
                  value={selectedNode.linkUrl ?? ''}
                  onChangeValue={(nextVal) =>
                    handleUpdateSelectedNode({
                      linkUrl: nextVal || undefined,
                    })
                  }
                  forbiddenRegex={FORBIDDEN_URL_CHARS_REGEX}
                  formatError={t.inspector.safeguard.urlErrorChars}
                  placeholder={t.inspector.nodeLinkUrlPlaceholder}
                />
              </label>

              <label className="inspector-field">
                <span>{t.inspector.nodeLinkTooltipField}</span>
                <GuardedInput
                  value={selectedNode.linkTooltip ?? ''}
                  onChangeValue={(nextVal) =>
                    handleUpdateSelectedNode({
                      linkTooltip: nextVal || undefined,
                    })
                  }
                  forbiddenRegex={FORBIDDEN_LABEL_CHARS_REGEX}
                  formatError={t.inspector.safeguard.syntaxErrorChars}
                  placeholder={t.inspector.nodeLinkTooltipPlaceholder}
                />
              </label>
            </div>

            <button
              type="button"
              className="btn-danger btn-full"
              onClick={handleDeleteSelectedNode}
            >
              <Trash2 size={14} />
              <span>{t.inspector.deleteNodeBtn}</span>
            </button>
          </div>
        ) : (
          <p className="inspector-hint">{t.inspector.selectNodeHint}</p>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={t.inspector.edgesHeading}
        badgeText={diagramData.edges.length}
        isOpen={openSections.edges}
        onToggle={() => toggleSection('edges')}
      >

        <div className="edge-add-card">
          <div className="edge-add-grid">
            <label className="inspector-field">
              <span>{t.inspector.sourceLabel}</span>
              <select
                value={newEdgeSource}
                onChange={(event) => setNewEdgeSource(event.target.value)}
                disabled={diagramData.nodes.length === 0}
              >
                {diagramData.nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.label} ({node.id})
                  </option>
                ))}
              </select>
            </label>

            <label className="inspector-field">
              <span>{t.inspector.targetLabel}</span>
              <select
                value={newEdgeTarget}
                onChange={(event) => setNewEdgeTarget(event.target.value)}
                disabled={diagramData.nodes.length === 0}
              >
                {diagramData.nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.label} ({node.id})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="edge-add-grid">
            <label className="inspector-field">
              <span>{t.inspector.lineTypeLabel}</span>
              <select
                value={newEdgeLineType}
                onChange={(event) => setNewEdgeLineType(event.target.value as EdgeLineType)}
              >
                {LINE_TYPE_VALUES.map((lineValue) => (
                  <option key={lineValue} value={lineValue}>
                    {t.inspector.lineTypes[lineValue]}
                  </option>
                ))}
              </select>
            </label>

            <label className="inspector-field">
              <span>{t.inspector.edgeLabelField}</span>
              <GuardedInput
                value={newEdgeLabel}
                onChangeValue={(nextVal) => setNewEdgeLabel(nextVal)}
                forbiddenRegex={FORBIDDEN_LABEL_CHARS_REGEX}
                formatError={t.inspector.safeguard.syntaxErrorChars}
                placeholder={t.inspector.edgeLabelPlaceholder}
              />
            </label>
          </div>

          <div className="edge-add-grid">
            <label className="inspector-field">
              <span>{t.inspector.edgeLengthLabel}</span>
              <select
                value={newEdgeLength}
                onChange={(event) => setNewEdgeLength(Number(event.target.value) || 0)}
              >
                {EDGE_LENGTH_VALUES.map((lenVal) => (
                  <option key={lenVal} value={lenVal}>
                    {getLengthOptionLabel(lenVal)}
                  </option>
                ))}
              </select>
            </label>

            <label className="inspector-field">
              <span>{t.inspector.edgeLabelStyleLabel}</span>
              <select
                value={newEdgeLabelStyle}
                onChange={(event) => setNewEdgeLabelStyle(event.target.value as EdgeLabelStyle)}
                disabled={newEdgeLineType === 'invisible'}
              >
                <option value="pipe">{t.inspector.edgeLabelStyles.pipe}</option>
                <option value="inline">{t.inspector.edgeLabelStyles.inline}</option>
              </select>
            </label>
          </div>

          <label className="inspector-field">
            <span>{t.inspector.edgeStrokeColorField}</span>
            <select
              value={newEdgeStrokeColor}
              onChange={(event) => setNewEdgeStrokeColor(event.target.value)}
            >
              {STROKE_COLOR_PALETTE_ITEMS.map((item) => (
                <option key={item.key} value={item.value}>
                  {t.inspector.strokeColors[item.key]}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="btn-primary btn-full"
            onClick={handleAddEdge}
            disabled={diagramData.nodes.length === 0}
          >
            <Plus size={14} />
            <span>{t.inspector.addEdgeBtn}</span>
          </button>
        </div>

        <div className="edge-list-container">
          {diagramData.edges.length === 0 ? (
            <p className="inspector-hint">{t.inspector.noEdgesHint}</p>
          ) : (
            diagramData.edges.map((edge) => (
              <div
                key={edge.id}
                className={`edge-list-item ${edge.id === selectedEdgeId ? 'is-selected' : ''}`}
                onClick={() => {
                  onSelectNode(null);
                  onSelectEdge(edge.id);
                }}
              >
                <div className="edge-item-row">
                  <select
                    aria-label={t.inspector.sourceLabel}
                    value={edge.source}
                    onChange={(event) =>
                      handleUpdateEdge(edge.id, { source: event.target.value })
                    }
                  >
                    {diagramData.nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.label} ({node.id})
                      </option>
                    ))}
                  </select>
                  <span className="edge-arrow-mark">→</span>
                  <select
                    aria-label={t.inspector.targetLabel}
                    value={edge.target}
                    onChange={(event) =>
                      handleUpdateEdge(edge.id, { target: event.target.value })
                    }
                  >
                    {diagramData.nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.label} ({node.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="edge-item-row">
                  <select
                    aria-label={t.inspector.lineTypeLabel}
                    value={edge.lineType}
                    onChange={(event) =>
                      handleUpdateEdge(edge.id, {
                        lineType: event.target.value as EdgeLineType,
                      })
                    }
                  >
                    {LINE_TYPE_VALUES.map((lineValue) => (
                      <option key={lineValue} value={lineValue}>
                        {t.inspector.lineTypes[lineValue]}
                      </option>
                    ))}
                  </select>

                  <GuardedInput
                    ariaLabel={t.inspector.edgeLabelField}
                    value={edge.label ?? ''}
                    onChangeValue={(nextVal) =>
                      handleUpdateEdge(edge.id, {
                        label: nextVal || undefined,
                      })
                    }
                    forbiddenRegex={FORBIDDEN_LABEL_CHARS_REGEX}
                    formatError={t.inspector.safeguard.syntaxErrorChars}
                    placeholder={t.inspector.edgeItemLabelPlaceholder}
                  />

                  <button
                    type="button"
                    className="btn-icon-danger"
                    title={t.inspector.deleteEdgeTitle}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteEdge(edge.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="edge-item-row">
                  <select
                    aria-label={t.inspector.edgeLengthLabel}
                    value={edge.extraLength ?? 0}
                    onChange={(event) => {
                      const nextLen = Number(event.target.value) || 0;
                      handleUpdateEdge(edge.id, {
                        extraLength: nextLen > 0 ? nextLen : undefined,
                      });
                    }}
                  >
                    {EDGE_LENGTH_VALUES.map((lenVal) => (
                      <option key={lenVal} value={lenVal}>
                        {getLengthOptionLabel(lenVal)}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label={t.inspector.edgeLabelStyleLabel}
                    value={edge.labelStyle ?? 'pipe'}
                    disabled={edge.lineType === 'invisible'}
                    onChange={(event) => {
                      const nextStyle = event.target.value as EdgeLabelStyle;
                      handleUpdateEdge(edge.id, {
                        labelStyle: nextStyle === 'pipe' ? undefined : nextStyle,
                      });
                    }}
                  >
                    <option value="pipe">{t.inspector.edgeLabelStyles.pipe}</option>
                    <option value="inline">{t.inspector.edgeLabelStyles.inline}</option>
                  </select>

                  <select
                    aria-label={t.inspector.edgeStrokeColorField}
                    value={edge.strokeColor ?? ''}
                    onChange={(event) =>
                      handleUpdateEdge(edge.id, {
                        strokeColor: event.target.value || undefined,
                      })
                    }
                  >
                    {STROKE_COLOR_PALETTE_ITEMS.map((item) => (
                      <option key={item.key} value={item.value}>
                        {t.inspector.strokeColors[item.key]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))
          )}
        </div>
      </InspectorCollapsibleSection>

      {!isSwimlane && subgraphsOrLanesSection}

      <InspectorCollapsibleSection
        title={t.inspector.classDefsHeading}
        badgeText={classDefs.length > 0 ? classDefs.length : undefined}
        isOpen={openSections.classDefs}
        onToggle={() => toggleSection('classDefs')}
      >
        <div className="edge-add-card">
          <label className="inspector-field">
            <span>{t.inspector.classNameField}</span>
            <GuardedInput
              value={newClassName}
              onChangeValue={(nextVal) => setNewClassName(nextVal)}
              forbiddenRegex={FORBIDDEN_CLASS_NAME_CHARS_REGEX}
              formatError={t.inspector.safeguard.classNameErrorChars}
              placeholder={t.inspector.classNamePlaceholder}
            />
          </label>

          <div className="edge-add-grid">
            <label className="inspector-field">
              <span>{t.inspector.classFillField}</span>
              <select
                value={newClassFill}
                onChange={(event) => setNewClassFill(event.target.value)}
              >
                {COLOR_PALETTE_ITEMS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t.inspector.colors[item.key]}
                  </option>
                ))}
              </select>
            </label>

            <label className="inspector-field">
              <span>{t.inspector.classStrokeField}</span>
              <select
                value={newClassStroke}
                onChange={(event) => setNewClassStroke(event.target.value)}
              >
                {STROKE_COLOR_PALETTE_ITEMS.filter((item) => item.value !== '').map((item) => (
                  <option key={item.key} value={item.value}>
                    {t.inspector.strokeColors[item.key]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button type="button" className="btn-primary btn-full" onClick={handleAddClassDef}>
            <Plus size={14} />
            <span>{t.inspector.addClassDefBtn}</span>
          </button>
        </div>

        <div className="edge-list-container">
          {classDefs.length === 0 ? (
            <p className="inspector-hint">{t.inspector.noClassDefsHint}</p>
          ) : (
            classDefs.map((cls) => (
              <div key={cls.name} className="classdef-list-item">
                <span
                  className="classdef-preview-pill"
                  style={{
                    backgroundColor: cls.fill || '#ffffff',
                    borderColor: cls.stroke || '#475569',
                    color: cls.color || '#0f172a',
                  }}
                >
                  .{cls.name}
                </span>
                <button
                  type="button"
                  className="btn-icon-danger"
                  title={t.inspector.deleteClassDefTitle}
                  onClick={() => handleDeleteClassDef(cls.name)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </InspectorCollapsibleSection>

      <InspectorCommentsSection
        title={t.inspector.commentsHeading}
        placeholder={t.inspector.commentsPlaceholder}
        comments={diagramData.comments}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
        onChangeComments={(nextComments) =>
          onChange({
            ...diagramData,
            comments: nextComments,
          })
        }
      />
    </aside>
  );
}
