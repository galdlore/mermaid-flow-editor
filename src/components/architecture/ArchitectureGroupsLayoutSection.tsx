import { Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n';
import GuardedInput from '../GuardedInput';
import { InspectorCollapsibleSection } from '../InspectorCollapsibleSection';
import { BUILTIN_ICON_PRESETS } from './ArchitectureNodeSection';
import { FORBIDDEN_ARCHITECTURE_TITLE_CHARS_REGEX } from '../../utils/inputSafeguard';
import type {
  ArchitectureAlignDirection,
  ArchitectureAlignHintData,
  ArchitectureDiagramData,
  ArchitectureGroupData,
  ArchitectureNodeData,
} from '../../types/editor';

function collectDescendantGroupIds(
  groups: ReadonlyArray<ArchitectureGroupData>,
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

export interface ArchitectureGroupsSectionProps {
  groups: ReadonlyArray<ArchitectureGroupData>;
  isOpen: boolean;
  onToggle: () => void;
  onAddGroup: () => void;
  onUpdateGroup: (groupId: string, patch: Partial<ArchitectureGroupData>) => void;
  onDeleteGroup: (groupId: string) => void;
}

export function ArchitectureGroupsSection({
  groups,
  isOpen,
  onToggle,
  onAddGroup,
  onUpdateGroup,
  onDeleteGroup,
}: ArchitectureGroupsSectionProps) {
  const { t } = useI18n();

  return (
    <InspectorCollapsibleSection
      title={t.inspector.architecture.groupsSection}
      badgeText={groups.length}
      isOpen={isOpen}
      onToggle={onToggle}
      headerAction={
        <button
          type="button"
          className="btn-secondary btn-xs"
          onClick={onAddGroup}
        >
          <Plus size={13} />
        </button>
      }
    >
      {groups.length === 0 ? (
        <p className="inspector-hint">
          {t.inspector.architecture.emptyGroups}
        </p>
      ) : (
        <div className="arch-group-list">
          {groups.map((group) => {
            const disallowedParents = collectDescendantGroupIds(
              groups,
              group.id
            );
            const iconIsPreset = group.icon
              ? (BUILTIN_ICON_PRESETS as readonly string[]).includes(group.icon)
              : true;
            return (
              <div key={group.id} className="arch-subcard">
                <div className="arch-subcard-header">
                  <span className="arch-subcard-id">{group.id}</span>
                  <button
                    type="button"
                    className="btn-icon-danger"
                    title={t.inspector.architecture.deleteGroup}
                    onClick={() => onDeleteGroup(group.id)}
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
                      onUpdateGroup(group.id, { title: nextVal })
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
                      value={iconIsPreset ? group.icon || 'cloud' : 'custom'}
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          return;
                        }
                        onUpdateGroup(group.id, { icon: e.target.value });
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
                        onUpdateGroup(group.id, {
                          parentId: e.target.value || undefined,
                        })
                      }
                    >
                      <option value="">
                        {t.inspector.architecture.noParentOption}
                      </option>
                      {groups
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
    </InspectorCollapsibleSection>
  );
}

export interface ArchitectureLayoutSectionProps {
  architectureData: ArchitectureDiagramData;
  nodes: ReadonlyArray<ArchitectureNodeData>;
  isOpen: boolean;
  onToggle: () => void;
  onChangeTitle: (nextTitle: string) => void;
  onOptionalNumberChange: (
    field: 'padding' | 'iconSize' | 'nodeSeparation',
    raw: string
  ) => void;
  onAddAlignment: () => void;
  onUpdateAlignment: (
    alignId: string,
    updater: (prev: ArchitectureAlignHintData) => ArchitectureAlignHintData
  ) => void;
  onDeleteAlignment: (alignId: string) => void;
}

export function ArchitectureLayoutSection({
  architectureData,
  nodes,
  isOpen,
  onToggle,
  onChangeTitle,
  onOptionalNumberChange,
  onAddAlignment,
  onUpdateAlignment,
  onDeleteAlignment,
}: ArchitectureLayoutSectionProps) {
  const { t } = useI18n();

  return (
    <InspectorCollapsibleSection
      title={t.inspector.architecture.layoutSection}
      badgeText={architectureData.alignments?.length ?? 0}
      isOpen={isOpen}
      onToggle={onToggle}
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
          onChangeValue={onChangeTitle}
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
            onChange={(e) => onOptionalNumberChange('padding', e.target.value)}
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
            onChange={(e) => onOptionalNumberChange('iconSize', e.target.value)}
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
              onOptionalNumberChange('nodeSeparation', e.target.value)
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
            disabled={nodes.length < 2}
            onClick={onAddAlignment}
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
                  onUpdateAlignment(hint.id, (prev) => ({
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
                onClick={() => onDeleteAlignment(hint.id)}
              >
                {t.inspector.architecture.deleteAlignment}
              </button>
            </div>
            <div className="arch-align-members">
              {nodes.map((node) => {
                const checked = hint.members.includes(node.id);
                return (
                  <button
                    key={node.id}
                    type="button"
                    className={`arch-align-member-pill ${
                      checked ? 'is-active' : ''
                    }`}
                    onClick={() =>
                      onUpdateAlignment(hint.id, (prev) => ({
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
    </InspectorCollapsibleSection>
  );
}
