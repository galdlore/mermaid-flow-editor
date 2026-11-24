import { Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import GuardedInput from '../GuardedInput';
import { InspectorCollapsibleSection } from '../InspectorCollapsibleSection';
import { FORBIDDEN_ARCHITECTURE_TITLE_CHARS_REGEX } from '../../utils/inputSafeguard';
import type {
  ArchitectureDirection,
  ArchitectureEdgeData,
  ArchitectureNodeData,
} from '../../types/editor';

const ARCH_DIRECTIONS: ArchitectureDirection[] = ['L', 'R', 'T', 'B'];

export interface ArchitectureEdgeSectionProps {
  nodes: ReadonlyArray<ArchitectureNodeData>;
  edges: ReadonlyArray<ArchitectureEdgeData>;
  selectedEdge: ArchitectureEdgeData | null;
  nodeGroupMap: Map<string, string>;
  isOpen: boolean;
  onToggle: () => void;
  onSelectEdge: (edgeId: string | null) => void;
  onAddEdge: () => void;
  onUpdateEdge: (edgeId: string, patch: Partial<ArchitectureEdgeData>) => void;
  onDeleteEdge: (edgeId: string) => void;
}

export default function ArchitectureEdgeSection({
  nodes,
  edges,
  selectedEdge,
  nodeGroupMap,
  isOpen,
  onToggle,
  onSelectEdge,
  onAddEdge,
  onUpdateEdge,
  onDeleteEdge,
}: ArchitectureEdgeSectionProps) {
  const { t } = useI18n();

  return (
    <InspectorCollapsibleSection
      title={t.inspector.architecture.edgesSection}
      badgeText={edges.length}
      isOpen={isOpen}
      onToggle={onToggle}
      headerAction={
        <button
          type="button"
          className="btn-secondary btn-xs"
          disabled={nodes.length < 2}
          onClick={onAddEdge}
        >
          <Plus size={13} />
        </button>
      }
    >
      {edges.length === 0 ? (
        <p className="inspector-hint">{t.inspector.architecture.emptyEdges}</p>
      ) : (
        <>
          <div className="arch-edge-selector-list">
            {edges.map((edge) => (
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
                      onUpdateEdge(selectedEdge.id, { lhsId: e.target.value })
                    }
                  >
                    {nodes.map((n) => (
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
                      onUpdateEdge(selectedEdge.id, {
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
                      onUpdateEdge(selectedEdge.id, {
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
                      onUpdateEdge(selectedEdge.id, {
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
                      onUpdateEdge(selectedEdge.id, { rhsId: e.target.value })
                    }
                  >
                    {nodes.map((n) => (
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
                      onUpdateEdge(selectedEdge.id, {
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
                      onUpdateEdge(selectedEdge.id, {
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
                      onUpdateEdge(selectedEdge.id, {
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
                    onUpdateEdge(selectedEdge.id, { title: nextVal })
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
                onClick={() => onDeleteEdge(selectedEdge.id)}
              >
                <Trash2 size={13} />
                <span>{t.inspector.architecture.deleteEdge}</span>
              </button>
            </div>
          )}
        </>
      )}
    </InspectorCollapsibleSection>
  );
}
