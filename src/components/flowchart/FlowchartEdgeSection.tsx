import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import GuardedInput from '../GuardedInput';
import {
  InspectorCollapsibleSection,
  STROKE_COLOR_PALETTE_ITEMS,
} from '../InspectorCollapsibleSection';
import { FORBIDDEN_LABEL_CHARS_REGEX } from '../../utils/inputSafeguard';
import type {
  EdgeLabelStyle,
  EdgeLineType,
  MermaidEdgeData,
  MermaidNodeData,
} from '../../types/editor';

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

export interface FlowchartNewEdgeDraft {
  source: string;
  target: string;
  lineType: EdgeLineType;
  extraLength: number;
  labelStyle: EdgeLabelStyle;
  strokeColor: string;
  label: string;
}

export interface FlowchartEdgeSectionProps {
  nodes: ReadonlyArray<MermaidNodeData>;
  edges: ReadonlyArray<MermaidEdgeData>;
  selectedEdgeId: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onSelectNode: (nodeId: string | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
  onAddEdge: (draft: FlowchartNewEdgeDraft) => void;
  onUpdateEdge: (edgeId: string, patch: Partial<MermaidEdgeData>) => void;
  onDeleteEdge: (edgeId: string) => void;
}

export default function FlowchartEdgeSection({
  nodes,
  edges,
  selectedEdgeId,
  isOpen,
  onToggle,
  onSelectNode,
  onSelectEdge,
  onAddEdge,
  onUpdateEdge,
  onDeleteEdge,
}: FlowchartEdgeSectionProps) {
  const { t } = useI18n();
  const [newEdgeSource, setNewEdgeSource] = useState<string>('');
  const [newEdgeTarget, setNewEdgeTarget] = useState<string>('');
  const [newEdgeLineType, setNewEdgeLineType] = useState<EdgeLineType>('arrow');
  const [newEdgeLength, setNewEdgeLength] = useState<number>(0);
  const [newEdgeLabelStyle, setNewEdgeLabelStyle] = useState<EdgeLabelStyle>('pipe');
  const [newEdgeStrokeColor, setNewEdgeStrokeColor] = useState<string>('');
  const [newEdgeLabel, setNewEdgeLabel] = useState<string>('');

  useEffect(() => {
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
  }, [nodes, newEdgeSource, newEdgeTarget]);

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

  const handleSubmitNewEdge = (): void => {
    if (!newEdgeSource || !newEdgeTarget) {
      return;
    }
    onAddEdge({
      source: newEdgeSource,
      target: newEdgeTarget,
      lineType: newEdgeLineType,
      extraLength: newEdgeLength,
      labelStyle: newEdgeLabelStyle,
      strokeColor: newEdgeStrokeColor,
      label: newEdgeLabel,
    });
    setNewEdgeLabel('');
  };

  return (
    <InspectorCollapsibleSection
      title={t.inspector.edgesHeading}
      badgeText={edges.length}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="edge-add-card">
        <div className="edge-add-grid">
          <label className="inspector-field">
            <span>{t.inspector.sourceLabel}</span>
            <select
              value={newEdgeSource}
              onChange={(event) => setNewEdgeSource(event.target.value)}
              disabled={nodes.length === 0}
            >
              {nodes.map((node) => (
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
              disabled={nodes.length === 0}
            >
              {nodes.map((node) => (
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
          onClick={handleSubmitNewEdge}
          disabled={nodes.length === 0}
        >
          <Plus size={14} />
          <span>{t.inspector.addEdgeBtn}</span>
        </button>
      </div>

      <div className="edge-list-container">
        {edges.length === 0 ? (
          <p className="inspector-hint">{t.inspector.noEdgesHint}</p>
        ) : (
          edges.map((edge) => (
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
                    onUpdateEdge(edge.id, { source: event.target.value })
                  }
                >
                  {nodes.map((node) => (
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
                    onUpdateEdge(edge.id, { target: event.target.value })
                  }
                >
                  {nodes.map((node) => (
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
                    onUpdateEdge(edge.id, {
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
                    onUpdateEdge(edge.id, {
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
                    onDeleteEdge(edge.id);
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
                    onUpdateEdge(edge.id, {
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
                    onUpdateEdge(edge.id, {
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
                    onUpdateEdge(edge.id, {
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
  );
}
