import { Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import GuardedInput from '../GuardedInput';
import { InspectorCollapsibleSection } from '../InspectorCollapsibleSection';
import {
  FORBIDDEN_ARCHITECTURE_ICON_CHARS_REGEX,
  FORBIDDEN_ARCHITECTURE_TITLE_CHARS_REGEX,
} from '../../utils/inputSafeguard';
import type {
  ArchitectureGroupData,
  ArchitectureNodeData,
  ArchitectureNodeType,
} from '../../types/editor';

export const BUILTIN_ICON_PRESETS = [
  'server',
  'cloud',
  'database',
  'disk',
  'internet',
  'unknown',
  'blank',
] as const;

export interface ArchitectureNodeSectionProps {
  nodes: ReadonlyArray<ArchitectureNodeData>;
  groups: ReadonlyArray<ArchitectureGroupData>;
  selectedNode: ArchitectureNodeData | null;
  isOpen: boolean;
  onToggle: () => void;
  onSelectNode: (nodeId: string | null) => void;
  onUpdateSelectedNode: (
    updater: (prev: ArchitectureNodeData) => ArchitectureNodeData
  ) => void;
  onDeleteNode: (nodeId: string) => void;
}

export default function ArchitectureNodeSection({
  nodes,
  groups,
  selectedNode,
  isOpen,
  onToggle,
  onSelectNode,
  onUpdateSelectedNode,
  onDeleteNode,
}: ArchitectureNodeSectionProps) {
  const { t } = useI18n();
  const selectedIconIsPreset = selectedNode?.icon
    ? (BUILTIN_ICON_PRESETS as readonly string[]).includes(selectedNode.icon)
    : true;

  return (
    <InspectorCollapsibleSection
      title={t.inspector.architecture.nodeSection}
      badgeText={nodes.length}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      {nodes.length === 0 ? (
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
              {nodes.map((n) => (
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
                    onUpdateSelectedNode((prev) =>
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
                        onUpdateSelectedNode((prev) => ({
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
                        onUpdateSelectedNode((prev) => ({
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
                        onUpdateSelectedNode((prev) => ({
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
                    onUpdateSelectedNode((prev) => ({
                      ...prev,
                      groupId: e.target.value || undefined,
                    }))
                  }
                >
                  <option value="">
                    {t.inspector.architecture.noGroupOption}
                  </option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title || g.id} ({g.id})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="btn-danger-outline btn-xs arch-full-btn"
                onClick={() => onDeleteNode(selectedNode.id)}
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
    </InspectorCollapsibleSection>
  );
}
