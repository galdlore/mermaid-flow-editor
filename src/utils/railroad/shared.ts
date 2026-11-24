import type {
  RailroadDiagramData,
  RailroadExprKind,
  RailroadExprNode,
  RailroadRuleData,
  RailroadSyntax,
} from '../../types/editor';
import { allocateUniqueId, sanitizeSingleLineComment } from '../mermaidEnvelope.ts';

export const RAILROAD_SYNTAX_OPTIONS: ReadonlyArray<RailroadSyntax> = [
  'railroad-beta',
  'railroad-ebnf-beta',
  'railroad-abnf-beta',
  'railroad-peg-beta',
];

export const RAILROAD_EXPR_KINDS: ReadonlyArray<RailroadExprKind> = [
  'terminal',
  'nonterminal',
  'special',
  'sequence',
  'choice',
  'optional',
  'oneOrMore',
  'zeroOrMore',
];

const VALID_SYNTAXES = new Set<RailroadSyntax>(RAILROAD_SYNTAX_OPTIONS);
const VALID_EXPR_KINDS = new Set<RailroadExprKind>(RAILROAD_EXPR_KINDS);

let exprUidCounter = 1;
export function createRailroadExprId(): string {
  return `rr_e_${Date.now().toString(36)}_${exprUidCounter++}`;
}

export function createRailroadExprNode(
  kind: RailroadExprKind,
  value?: string,
  children?: RailroadExprNode[]
): RailroadExprNode {
  const id = createRailroadExprId();
  if (kind === 'terminal' || kind === 'nonterminal' || kind === 'special') {
    return {
      id,
      kind,
      value:
        value ??
        (kind === 'terminal'
          ? 'token'
          : kind === 'nonterminal'
            ? 'Item'
            : 'note'),
    };
  }
  if (kind === 'sequence' || kind === 'choice') {
    return {
      id,
      kind,
      children:
        children && children.length > 0
          ? children
          : [
              createRailroadExprNode('terminal', 'a'),
              createRailroadExprNode('terminal', 'b'),
            ],
    };
  }
  return {
    id,
    kind,
    children:
      children && children.length > 0
        ? [children[0]]
        : [createRailroadExprNode('terminal', 'item')],
  };
}

export function createDefaultRailroadData(
  lang: 'ja' | 'en' = 'ja'
): RailroadDiagramData {
  const isJa = lang === 'ja';
  return {
    diagramType: 'railroad',
    syntax: 'railroad-beta',
    title: isJa ? '数式の構文規則' : 'Expression Grammar',
    rules: [
      {
        id: 'rule_1',
        name: 'Expr',
        root: {
          id: 'expr_seq_1',
          kind: 'sequence',
          children: [
            { id: 'expr_nt_1', kind: 'nonterminal', value: 'Term' },
            {
              id: 'expr_zm_1',
              kind: 'zeroOrMore',
              children: [
                {
                  id: 'expr_seq_2',
                  kind: 'sequence',
                  children: [
                    {
                      id: 'expr_ch_1',
                      kind: 'choice',
                      children: [
                        { id: 'expr_t_plus', kind: 'terminal', value: '+' },
                        { id: 'expr_t_minus', kind: 'terminal', value: '-' },
                      ],
                    },
                    { id: 'expr_nt_2', kind: 'nonterminal', value: 'Term' },
                  ],
                },
              ],
            },
          ],
        },
      },
      {
        id: 'rule_2',
        name: 'Term',
        root: {
          id: 'term_ch_1',
          kind: 'choice',
          children: [
            { id: 'term_t_num', kind: 'terminal', value: 'number' },
            {
              id: 'term_seq_1',
              kind: 'sequence',
              children: [
                { id: 'term_t_lp', kind: 'terminal', value: '(' },
                { id: 'term_nt_expr', kind: 'nonterminal', value: 'Expr' },
                { id: 'term_t_rp', kind: 'terminal', value: ')' },
              ],
            },
          ],
        },
      },
    ],
  };
}

function isValidExprNode(val: unknown): val is RailroadExprNode {
  if (!val || typeof val !== 'object') {
    return false;
  }
  const node = val as Partial<RailroadExprNode>;
  if (
    typeof node.id !== 'string' ||
    typeof node.kind !== 'string' ||
    !VALID_EXPR_KINDS.has(node.kind)
  ) {
    return false;
  }
  if (node.children !== undefined) {
    if (!Array.isArray(node.children)) return false;
    return node.children.every(isValidExprNode);
  }
  return true;
}

export function isValidRailroadData(
  value: unknown
): value is RailroadDiagramData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Partial<RailroadDiagramData>;
  if (obj.diagramType !== 'railroad' || !Array.isArray(obj.rules)) {
    return false;
  }
  return obj.rules.every(
    (rule) =>
      Boolean(rule) &&
      typeof rule === 'object' &&
      typeof rule.id === 'string' &&
      typeof rule.name === 'string' &&
      isValidExprNode(rule.root)
  );
}

export function sanitizeRailroadRuleName(
  raw: string,
  syntax: RailroadSyntax = 'railroad-beta',
  fallback = 'Rule'
): string {
  const allowUnderscore = syntax !== 'railroad-abnf-beta';
  let cleaned = allowUnderscore
    ? raw.replace(/[^a-zA-Z0-9_-]/g, '').trim()
    : raw.replace(/_/g, '-').replace(/[^a-zA-Z0-9-]/g, '').trim();
  cleaned = cleaned.replace(/^[^a-zA-Z]+/, '');
  return cleaned || fallback;
}

function sanitizeExprText(raw?: string): string {
  if (typeof raw !== 'string') {
    return '';
  }
  return raw.replace(/["\r\n]/g, '').trim();
}

function normalizeExprNode(
  node: RailroadExprNode,
  usedIds: Set<string>,
  syntax: RailroadSyntax
): RailroadExprNode {
  const baseId =
    node.id && /^[a-zA-Z0-9_-]+$/.test(node.id)
      ? node.id
      : createRailroadExprId();
  const id = allocateUniqueId(baseId, usedIds);
  const kind: RailroadExprKind = VALID_EXPR_KINDS.has(node.kind)
    ? node.kind
    : 'terminal';

  if (kind === 'terminal' || kind === 'special') {
    const val = sanitizeExprText(node.value) || (kind === 'terminal' ? 'tok' : 'note');
    return { id, kind, value: val };
  }
  if (kind === 'nonterminal') {
    const rawVal = sanitizeExprText(node.value) || 'Rule';
    const val =
      syntax === 'railroad-abnf-beta'
        ? sanitizeRailroadRuleName(rawVal, 'railroad-abnf-beta', 'Rule')
        : rawVal;
    return { id, kind, value: val };
  }

  const rawChildren = Array.isArray(node.children) ? node.children : [];
  if (kind === 'optional' || kind === 'oneOrMore' || kind === 'zeroOrMore') {
    const first = rawChildren[0] ?? createRailroadExprNode('terminal', 'item');
    return {
      id,
      kind,
      children: [normalizeExprNode(first, usedIds, syntax)],
    };
  }

  const normalizedChildren = rawChildren.map((child) =>
    normalizeExprNode(child, usedIds, syntax)
  );
  if (normalizedChildren.length === 0) {
    normalizedChildren.push(
      normalizeExprNode(createRailroadExprNode('terminal', 'item'), usedIds, syntax)
    );
  }
  return {
    id,
    kind,
    children: normalizedChildren,
  };
}

export function normalizeRailroadData(
  data: RailroadDiagramData
): RailroadDiagramData {
  const syntax: RailroadSyntax = VALID_SYNTAXES.has(data.syntax)
    ? data.syntax
    : 'railroad-beta';
  const title =
    typeof data.title === 'string'
      ? sanitizeSingleLineComment(data.title)
      : undefined;

  const usedRuleIds = new Set<string>();
  const usedExprIds = new Set<string>();
  const rules: RailroadRuleData[] = [];

  for (let i = 0; i < data.rules.length; i++) {
    const raw = data.rules[i];
    const baseId =
      raw.id && /^[a-zA-Z0-9_-]+$/.test(raw.id) ? raw.id : `rule_${i + 1}`;
    const id = allocateUniqueId(baseId, usedRuleIds);
    const name = sanitizeRailroadRuleName(
      raw.name || `Rule${i + 1}`,
      syntax,
      `Rule${i + 1}`
    );
    const root = normalizeExprNode(raw.root, usedExprIds, syntax);
    rules.push({ id, name, root });
  }

  const comments = Array.isArray(data.comments)
    ? data.comments
        .filter((c): c is string => typeof c === 'string')
        .map(sanitizeSingleLineComment)
        .filter((c) => c.length > 0)
    : undefined;

  return {
    diagramType: 'railroad',
    syntax,
    ...(title ? { title } : {}),
    rules,
    ...(comments && comments.length > 0 ? { comments } : {}),
  };
}
