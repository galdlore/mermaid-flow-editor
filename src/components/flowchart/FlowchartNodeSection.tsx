import { Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import GuardedInput from '../GuardedInput';
import {
  COLOR_PALETTE_ITEMS,
  InspectorCollapsibleSection,
  STROKE_COLOR_PALETTE_ITEMS,
} from '../InspectorCollapsibleSection';
import {
  FORBIDDEN_LABEL_CHARS_REGEX,
  FORBIDDEN_URL_CHARS_REGEX,
} from '../../utils/inputSafeguard';
import type {
  MermaidClassDefData,
  MermaidNodeData,
  MermaidSubgraphData,
  NodeShape,
} from '../../types/editor';

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

export interface FlowchartNodeSectionProps {
  isSwimlane: boolean;
  nodes: ReadonlyArray<MermaidNodeData>;
  subgraphs: ReadonlyArray<MermaidSubgraphData>;
  classDefs: ReadonlyArray<MermaidClassDefData>;
  selectedNodeId: string | null;
  selectedNode: MermaidNodeData | null;
  isOpen: boolean;
  onToggle: () => void;
  onAddAndOpenNode: () => void;
  onSelectNode: (nodeId: string | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
  onUpdateSelectedNode: (patch: Partial<MermaidNodeData>) => void;
  onDeleteSelectedNode: () => void;
}

export default function FlowchartNodeSection({
  isSwimlane,
  nodes,
  subgraphs,
  classDefs,
  selectedNodeId,
  selectedNode,
  isOpen,
  onToggle,
  onAddAndOpenNode,
  onSelectNode,
  onSelectEdge,
  onUpdateSelectedNode,
  onDeleteSelectedNode,
}: FlowchartNodeSectionProps) {
  const { t } = useI18n();

  return (
    <InspectorCollapsibleSection
      title={isSwimlane ? t.inspector.swimlane.nodesHeading : t.inspector.nodesHeading}
      badgeText={nodes.length}
      isOpen={isOpen}
      onToggle={onToggle}
      headerAction={
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={onAddAndOpenNode}
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
          {nodes.map((node) => (
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
              onChangeValue={(nextVal) => onUpdateSelectedNode({ label: nextVal })}
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
                    className={`shape-choice-btn ${
                      selectedNode.shape === shapeValue ? 'is-active' : ''
                    }`}
                    onClick={() => onUpdateSelectedNode({ shape: shapeValue })}
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
                  className={`color-swatch-btn ${
                    (selectedNode.color || '#ffffff') === color.value ? 'is-active' : ''
                  }`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => onUpdateSelectedNode({ color: color.value })}
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
                  className={`color-swatch-btn stroke-swatch ${
                    (selectedNode.strokeColor || '') === stroke.value ? 'is-active' : ''
                  }`}
                  style={{
                    backgroundColor: '#ffffff',
                    borderColor: stroke.value || '#cbd5e1',
                    borderWidth: stroke.value ? '3px' : '1px',
                  }}
                  onClick={() =>
                    onUpdateSelectedNode({ strokeColor: stroke.value || undefined })
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
                  onUpdateSelectedNode({
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
                  onUpdateSelectedNode({
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
                  onUpdateSelectedNode({
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
                  onUpdateSelectedNode({
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
            onClick={onDeleteSelectedNode}
          >
            <Trash2 size={14} />
            <span>{t.inspector.deleteNodeBtn}</span>
          </button>
        </div>
      ) : (
        <p className="inspector-hint">{t.inspector.selectNodeHint}</p>
      )}
    </InspectorCollapsibleSection>
  );
}
