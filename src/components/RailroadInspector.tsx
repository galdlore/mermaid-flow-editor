import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import { InspectorCollapsibleSection } from './InspectorCollapsibleSection';
import {
  InspectorBulkControls,
  InspectorCommentsSection,
} from './InspectorCommon';
import {
  FORBIDDEN_RAILROAD_RULE_ID_CHARS_REGEX,
  FORBIDDEN_RAILROAD_TEXT_CHARS_REGEX,
} from '../utils/inputSafeguard';
import {
  RAILROAD_EXPR_KINDS,
  RAILROAD_SYNTAX_OPTIONS,
  appendRailroadExprChild,
  createRailroadExprNode,
  deleteRailroadExprNode,
  findRailroadExprNode,
  moveRailroadExprChild,
  sanitizeRailroadRuleName,
  updateRailroadExprNode,
  wrapRailroadExprNode,
} from '../utils/railroadConverter';
import type {
  RailroadDiagramData,
  RailroadExprKind,
  RailroadExprNode,
  RailroadRuleData,
  RailroadSyntax,
} from '../types/editor';

export interface RailroadInspectorProps {
  railroadData: RailroadDiagramData;
  selectedNodeId: string | null;
  selectedRuleId: string | null;
  onChange: (next: RailroadDiagramData) => void;
  onSelectNode: (nodeId: string | null) => void;
  onSelectRule: (ruleId: string | null) => void;
}

type RailroadSectionKey = 'node' | 'rule' | 'settings' | 'comments';

const LEAF_KINDS = new Set<RailroadExprKind>([
  'terminal',
  'nonterminal',
  'special',
]);

export default function RailroadInspector({
  railroadData,
  selectedNodeId,
  selectedRuleId,
  onChange,
  onSelectNode,
  onSelectRule,
}: RailroadInspectorProps) {
  const { t } = useI18n();
  const rr = t.inspector.railroad;
  const safeguard = t.inspector.safeguard;

  const activeRule: RailroadRuleData | null =
    railroadData.rules.find((r) => r.id === selectedRuleId) ??
    (selectedNodeId
      ? railroadData.rules.find((r) =>
          Boolean(findRailroadExprNode(r.root, selectedNodeId))
        ) ?? null
      : null) ??
    railroadData.rules[0] ??
    null;

  const selectedNode: RailroadExprNode | null =
    activeRule && selectedNodeId
      ? findRailroadExprNode(activeRule.root, selectedNodeId)
      : null;

  const [ruleNameDraft, setRuleNameDraft] = useState(activeRule?.name ?? '');
  const [openSections, setOpenSections] = useState<
    Record<RailroadSectionKey, boolean>
  >({
    node: true,
    rule: true,
    settings: false,
    comments: false,
  });

  useEffect(() => {
    setRuleNameDraft(activeRule?.name ?? '');
  }, [activeRule]);

  useEffect(() => {
    if (selectedNodeId) {
      setOpenSections((prev) => (prev.node ? prev : { ...prev, node: true }));
    }
  }, [selectedNodeId]);

  const toggleSection = (key: RailroadSectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSections = (open: boolean): void => {
    setOpenSections({ node: open, rule: open, settings: open, comments: open });
  };

  const allExpanded = Object.values(openSections).every(Boolean);

  const updateActiveRuleRoot = (nextRoot: RailroadExprNode): void => {
    if (!activeRule) return;
    onChange({
      ...railroadData,
      rules: railroadData.rules.map((r) =>
        r.id === activeRule.id ? { ...r, root: nextRoot } : r
      ),
    });
  };

  const handleNodeKindChange = (nextKind: RailroadExprKind): void => {
    if (!activeRule || !selectedNode) return;
    const nextRoot = updateRailroadExprNode(
      activeRule.root,
      selectedNode.id,
      (node) => {
        if (LEAF_KINDS.has(nextKind)) {
          return {
            id: node.id,
            kind: nextKind,
            value:
              node.value ||
              (nextKind === 'nonterminal'
                ? 'Rule'
                : nextKind === 'special'
                  ? 'note'
                  : 'token'),
          };
        }
        if (nextKind === 'sequence' || nextKind === 'choice') {
          const children =
            node.children && node.children.length > 0
              ? node.children
              : [
                  createRailroadExprNode(
                    LEAF_KINDS.has(node.kind) ? node.kind : 'terminal',
                    node.value || 'a'
                  ),
                  createRailroadExprNode('terminal', 'b'),
                ];
          return { id: node.id, kind: nextKind, children };
        }
        const firstChild =
          node.children?.[0] ??
          createRailroadExprNode(
            LEAF_KINDS.has(node.kind) ? node.kind : 'terminal',
            node.value || 'item'
          );
        return { id: node.id, kind: nextKind, children: [firstChild] };
      }
    );
    updateActiveRuleRoot(nextRoot);
  };

  const handleAddChild = (): void => {
    if (!activeRule || !selectedNode) return;
    const child = createRailroadExprNode('terminal', 'item');
    const nextRoot = appendRailroadExprChild(
      activeRule.root,
      selectedNode.id,
      child
    );
    updateActiveRuleRoot(nextRoot);
    onSelectNode(child.id);
  };

  const handleWrapSelected = (
    wrapperKind:
      | 'optional'
      | 'oneOrMore'
      | 'zeroOrMore'
      | 'sequence'
      | 'choice'
  ): void => {
    if (!activeRule || !selectedNode) return;
    const { root, wrapperId } = wrapRailroadExprNode(
      activeRule.root,
      selectedNode.id,
      wrapperKind
    );
    updateActiveRuleRoot(root);
    onSelectNode(wrapperId);
  };

  const handleDeleteOrUnwrapNode = (): void => {
    if (!activeRule || !selectedNode) return;
    const nextRoot = deleteRailroadExprNode(activeRule.root, selectedNode.id);
    updateActiveRuleRoot(nextRoot);
    onSelectNode(nextRoot.id);
  };

  const handleDeleteActiveRule = (): void => {
    if (!activeRule) return;
    const idx = railroadData.rules.findIndex((r) => r.id === activeRule.id);
    const nextRules = railroadData.rules.filter((r) => r.id !== activeRule.id);
    onChange({ ...railroadData, rules: nextRules });
    const fallback = nextRules[Math.min(idx, nextRules.length - 1)] ?? null;
    onSelectRule(fallback?.id ?? null);
    onSelectNode(fallback?.root.id ?? null);
  };

  const isLeaf = selectedNode ? LEAF_KINDS.has(selectedNode.kind) : false;

  return (
    <div className="inspector-panel">
      <InspectorBulkControls allExpanded={allExpanded} onSetAll={setAllSections} />

      <InspectorCollapsibleSection
        title={rr.nodeSection}
        isOpen={openSections.node}
        onToggle={() => toggleSection('node')}
      >
        {activeRule && selectedNode ? (
          <>
            <label className="inspector-field">
              <span>{rr.nodeKindField}</span>
              <select
                value={selectedNode.kind}
                onChange={(e) =>
                  handleNodeKindChange(e.target.value as RailroadExprKind)
                }
              >
                {RAILROAD_EXPR_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {rr.nodeKinds[kind]}
                  </option>
                ))}
              </select>
            </label>

            {isLeaf ? (
              <label className="inspector-field">
                <span>{rr.nodeValueField}</span>
                <GuardedInput
                  value={selectedNode.value ?? ''}
                  placeholder={rr.nodeValuePlaceholder}
                  forbiddenRegex={FORBIDDEN_RAILROAD_TEXT_CHARS_REGEX}
                  formatError={safeguard.railroadTextErrorChars}
                  onChangeValue={(val) => {
                    const nextRoot = updateRailroadExprNode(
                      activeRule.root,
                      selectedNode.id,
                      (node) => ({ ...node, value: val })
                    );
                    updateActiveRuleRoot(nextRoot);
                  }}
                />
              </label>
            ) : (
              <div className="railroad-node-container-actions">
                <button
                  type="button"
                  className="btn-secondary btn-xs"
                  onClick={handleAddChild}
                >
                  <Plus size={12} />
                  <span>{rr.addChildBtn}</span>
                </button>
              </div>
            )}

            <div className="inspector-field">
              <span>{rr.wrapInLabel}</span>
              <div className="railroad-wrap-grid">
                {(
                  [
                    ['optional', '?'],
                    ['oneOrMore', '+'],
                    ['zeroOrMore', '*'],
                    ['sequence', 'SEQ'],
                    ['choice', 'OR'],
                  ] as const
                ).map(([kind, label]) => (
                  <button
                    key={kind}
                    type="button"
                    className="inspector-choice-btn"
                    onClick={() => handleWrapSelected(kind)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {activeRule.root.id !== selectedNode.id && (
              <div className="railroad-move-row">
                <button
                  type="button"
                  className="btn-secondary btn-xs"
                  title={rr.moveUpTitle}
                  onClick={() =>
                    updateActiveRuleRoot(
                      moveRailroadExprChild(activeRule.root, selectedNode.id, -1)
                    )
                  }
                >
                  <ArrowUp size={12} />
                  <span>{rr.moveUpTitle}</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-xs"
                  title={rr.moveDownTitle}
                  onClick={() =>
                    updateActiveRuleRoot(
                      moveRailroadExprChild(activeRule.root, selectedNode.id, 1)
                    )
                  }
                >
                  <ArrowDown size={12} />
                  <span>{rr.moveDownTitle}</span>
                </button>
              </div>
            )}

            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleDeleteOrUnwrapNode}
            >
              <Trash2 size={14} />
              <span>{rr.unwrapOrDeleteBtn}</span>
            </button>
          </>
        ) : (
          <p className="inspector-hint">{rr.selectNodePrompt}</p>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={rr.ruleSection}
        badgeText={railroadData.rules.length}
        isOpen={openSections.rule}
        onToggle={() => toggleSection('rule')}
      >
        {activeRule ? (
          <>
            <div
              className="inspector-field"
              onBlur={() => {
                const clean = sanitizeRailroadRuleName(
                  ruleNameDraft,
                  railroadData.syntax,
                  activeRule.name
                );
                setRuleNameDraft(clean);
                if (clean !== activeRule.name) {
                  onChange({
                    ...railroadData,
                    rules: railroadData.rules.map((r) =>
                      r.id === activeRule.id ? { ...r, name: clean } : r
                    ),
                  });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const clean = sanitizeRailroadRuleName(
                    ruleNameDraft,
                    railroadData.syntax,
                    activeRule.name
                  );
                  setRuleNameDraft(clean);
                  if (clean !== activeRule.name) {
                    onChange({
                      ...railroadData,
                      rules: railroadData.rules.map((r) =>
                        r.id === activeRule.id ? { ...r, name: clean } : r
                      ),
                    });
                  }
                }
              }}
            >
              <span>{rr.ruleNameField}</span>
              <GuardedInput
                value={ruleNameDraft}
                placeholder={rr.ruleNamePlaceholder}
                forbiddenRegex={FORBIDDEN_RAILROAD_RULE_ID_CHARS_REGEX}
                formatError={safeguard.railroadRuleIdErrorChars}
                onChangeValue={setRuleNameDraft}
              />
            </div>

            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleDeleteActiveRule}
            >
              <Trash2 size={14} />
              <span>{rr.deleteRuleBtn}</span>
            </button>
          </>
        ) : (
          <p className="inspector-hint">{rr.emptyRules}</p>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={rr.settingsSection}
        isOpen={openSections.settings}
        onToggle={() => toggleSection('settings')}
      >
        <label className="inspector-field">
          <span>{rr.syntaxField}</span>
          <select
            value={railroadData.syntax}
            onChange={(e) =>
              onChange({
                ...railroadData,
                syntax: e.target.value as RailroadSyntax,
              })
            }
          >
            {RAILROAD_SYNTAX_OPTIONS.map((syn) => (
              <option key={syn} value={syn}>
                {rr.syntaxes[syn]}
              </option>
            ))}
          </select>
        </label>

        {railroadData.syntax === 'railroad-abnf-beta' && (
          <p className="inspector-hint">{rr.abnfSpecialNotice}</p>
        )}

        <label className="inspector-field">
          <span>{rr.titleField}</span>
          <GuardedInput
            value={railroadData.title ?? ''}
            placeholder={rr.titlePlaceholder}
            forbiddenRegex={FORBIDDEN_RAILROAD_TEXT_CHARS_REGEX}
            formatError={safeguard.railroadTextErrorChars}
            onChangeValue={(val) =>
              onChange({ ...railroadData, title: val || undefined })
            }
          />
        </label>
      </InspectorCollapsibleSection>

      <InspectorCommentsSection
        title={rr.commentsSection}
        fieldLabel={rr.commentsField}
        placeholder={rr.commentsPlaceholder}
        comments={railroadData.comments}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
        onChangeComments={(nextComments) =>
          onChange({
            ...railroadData,
            comments: nextComments,
          })
        }
      />
    </div>
  );
}
