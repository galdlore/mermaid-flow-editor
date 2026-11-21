import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Plus,
  Trash2,
} from 'lucide-react';
import { useI18n } from '../i18n';
import type {
  RailroadDiagramData,
  RailroadExprNode,
  RailroadRuleData,
  RailroadSyntax,
} from '../types/editor';
import {
  RAILROAD_SYNTAX_OPTIONS,
  createRailroadExprNode,
} from '../utils/railroadConverter';

export interface RailroadCanvasProps {
  railroadData: RailroadDiagramData;
  selectedNodeId: string | null;
  selectedRuleId: string | null;
  onChange: (next: RailroadDiagramData) => void;
  onSelectNode: (nodeId: string | null) => void;
  onSelectRule: (ruleId: string | null) => void;
}

function nextRuleId(rules: RailroadRuleData[]): string {
  const used = new Set(rules.map((r) => r.id));
  let num = rules.length + 1;
  while (used.has(`rule_${num}`)) {
    num++;
  }
  return `rule_${num}`;
}

export default function RailroadCanvas({
  railroadData,
  selectedNodeId,
  selectedRuleId,
  onChange,
  onSelectNode,
  onSelectRule,
}: RailroadCanvasProps) {
  const { t } = useI18n();
  const rr = t.inspector.railroad;

  const handleAddRule = (): void => {
    const id = nextRuleId(railroadData.rules);
    const num = railroadData.rules.length + 1;
    const root = createRailroadExprNode('sequence', undefined, [
      createRailroadExprNode('terminal', 'start'),
      createRailroadExprNode('nonterminal', 'Item'),
    ]);
    const newRule: RailroadRuleData = {
      id,
      name: rr.defaultRuleName(num),
      root,
    };
    onChange({
      ...railroadData,
      rules: [...railroadData.rules, newRule],
    });
    onSelectRule(id);
    onSelectNode(root.id);
  };

  const handleMoveRule = (index: number, delta: -1 | 1): void => {
    const target = index + delta;
    if (target < 0 || target >= railroadData.rules.length) return;
    const next = [...railroadData.rules];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    onChange({ ...railroadData, rules: next });
  };

  const handleDeleteRule = (ruleId: string, index: number): void => {
    const next = railroadData.rules.filter((r) => r.id !== ruleId);
    onChange({ ...railroadData, rules: next });
    if (selectedRuleId === ruleId) {
      const fallback = next[Math.min(index, next.length - 1)] ?? null;
      onSelectRule(fallback?.id ?? null);
      onSelectNode(fallback?.root.id ?? null);
    }
  };

  const renderExprTree = (
    node: RailroadExprNode,
    ruleId: string
  ): React.ReactNode => {
    const isSelected = node.id === selectedNodeId;
    const handleClick = (e: React.MouseEvent): void => {
      e.stopPropagation();
      onSelectRule(ruleId);
      onSelectNode(node.id);
    };

    if (
      node.kind === 'terminal' ||
      node.kind === 'nonterminal' ||
      node.kind === 'special'
    ) {
      return (
        <button
          key={node.id}
          type="button"
          className={`railroad-leaf-chip is-${node.kind} ${
            isSelected ? 'is-selected' : ''
          }`}
          onClick={handleClick}
        >
          {node.kind === 'terminal'
            ? `"${node.value ?? ''}"`
            : node.kind === 'special'
              ? `? ${node.value ?? ''} ?`
              : node.value ?? 'Rule'}
        </button>
      );
    }

    if (node.kind === 'sequence') {
      const children = node.children ?? [];
      return (
        <div
          key={node.id}
          className={`railroad-expr-box is-sequence ${
            isSelected ? 'is-selected' : ''
          }`}
          onClick={handleClick}
        >
          <span className="railroad-box-tag">SEQ</span>
          <div className="railroad-seq-row">
            {children.map((child, idx) => (
              <div key={child.id} className="railroad-seq-item">
                {idx > 0 && (
                  <ArrowRight
                    size={12}
                    className="railroad-seq-arrow"
                    aria-hidden="true"
                  />
                )}
                {renderExprTree(child, ruleId)}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (node.kind === 'choice') {
      const children = node.children ?? [];
      return (
        <div
          key={node.id}
          className={`railroad-expr-box is-choice ${
            isSelected ? 'is-selected' : ''
          }`}
          onClick={handleClick}
        >
          <span className="railroad-box-tag">OR</span>
          <div className="railroad-choice-stack">
            {children.map((child) => (
              <div key={child.id} className="railroad-choice-branch">
                {renderExprTree(child, ruleId)}
              </div>
            ))}
          </div>
        </div>
      );
    }

    const badgeText =
      node.kind === 'optional'
        ? '0..1 (?)'
        : node.kind === 'oneOrMore'
          ? '1+ (+)'
          : '0+ (*)';
    const inner = node.children?.[0];

    return (
      <div
        key={node.id}
        className={`railroad-expr-box is-${node.kind} ${
          isSelected ? 'is-selected' : ''
        }`}
        onClick={handleClick}
      >
        <span className="railroad-box-tag">{badgeText}</span>
        <div className="railroad-unary-body">
          {inner ? renderExprTree(inner, ruleId) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="railroad-canvas">
      <div className="railroad-toolbar">
        <button
          type="button"
          className="btn-secondary btn-xs"
          onClick={handleAddRule}
        >
          <Plus size={13} />
          <span>{rr.addRuleBtn}</span>
        </button>

        <select
          className="railroad-syntax-select"
          aria-label={rr.syntaxField}
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
              {syn}
            </option>
          ))}
        </select>
      </div>

      <div className="railroad-canvas-scroll">
        {railroadData.title && (
          <div className="railroad-title-banner">{railroadData.title}</div>
        )}

        {railroadData.rules.length === 0 ? (
          <div className="railroad-empty-state">{rr.emptyRules}</div>
        ) : (
          <div className="railroad-rules-list">
            {railroadData.rules.map((rule, idx) => {
              const isRuleSelected = rule.id === selectedRuleId;
              return (
                <div
                  key={rule.id}
                  className={`railroad-rule-card ${
                    isRuleSelected ? 'is-rule-selected' : ''
                  }`}
                  onClick={() => {
                    onSelectRule(rule.id);
                    onSelectNode(rule.root.id);
                  }}
                >
                  <div className="railroad-rule-header">
                    <span className="railroad-rule-name">{rule.name}</span>
                    <span className="railroad-rule-op">
                      {railroadData.syntax === 'railroad-peg-beta' ? '<-' : '='}
                    </span>
                    <div
                      className="railroad-rule-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="treeview-action-btn"
                        title={rr.moveUpTitle}
                        disabled={idx === 0}
                        onClick={() => handleMoveRule(idx, -1)}
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        type="button"
                        className="treeview-action-btn"
                        title={rr.moveDownTitle}
                        disabled={idx === railroadData.rules.length - 1}
                        onClick={() => handleMoveRule(idx, 1)}
                      >
                        <ArrowDown size={12} />
                      </button>
                      <button
                        type="button"
                        className="treeview-action-btn is-danger"
                        title={rr.deleteRuleBtn}
                        onClick={() => handleDeleteRule(rule.id, idx)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="railroad-rule-diagram">
                    {renderExprTree(rule.root, rule.id)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
