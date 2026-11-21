import type {
  RailroadDiagramData,
  RailroadExprKind,
  RailroadExprNode,
  RailroadRuleData,
  RailroadSyntax,
} from '../types/editor';
import {
  allocateUniqueId,
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
  unquoteYamlString,
} from './mermaidEnvelope.ts';

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

// --- Pure tree helpers for RailroadCanvas / RailroadInspector ---

export function findRailroadExprNode(
  root: RailroadExprNode,
  targetId: string
): RailroadExprNode | null {
  if (root.id === targetId) {
    return root;
  }
  for (const child of root.children ?? []) {
    const found = findRailroadExprNode(child, targetId);
    if (found) {
      return found;
    }
  }
  return null;
}

export function updateRailroadExprNode(
  root: RailroadExprNode,
  targetId: string,
  updater: (node: RailroadExprNode) => RailroadExprNode
): RailroadExprNode {
  if (root.id === targetId) {
    return updater(root);
  }
  if (!root.children) {
    return root;
  }
  let changed = false;
  const nextChildren = root.children.map((child) => {
    const next = updateRailroadExprNode(child, targetId, updater);
    if (next !== child) {
      changed = true;
    }
    return next;
  });
  return changed ? { ...root, children: nextChildren } : root;
}

export function appendRailroadExprChild(
  root: RailroadExprNode,
  parentId: string,
  child: RailroadExprNode
): RailroadExprNode {
  return updateRailroadExprNode(root, parentId, (node) => {
    if (node.kind === 'sequence' || node.kind === 'choice') {
      return { ...node, children: [...(node.children ?? []), child] };
    }
    if (
      node.kind === 'optional' ||
      node.kind === 'oneOrMore' ||
      node.kind === 'zeroOrMore'
    ) {
      const existing = node.children?.[0];
      if (!existing) {
        return { ...node, children: [child] };
      }
      const seqNode: RailroadExprNode =
        existing.kind === 'sequence'
          ? { ...existing, children: [...(existing.children ?? []), child] }
          : createRailroadExprNode('sequence', undefined, [existing, child]);
      return { ...node, children: [seqNode] };
    }
    return createRailroadExprNode('sequence', undefined, [node, child]);
  });
}

export function wrapRailroadExprNode(
  root: RailroadExprNode,
  targetId: string,
  wrapperKind: 'sequence' | 'choice' | 'optional' | 'oneOrMore' | 'zeroOrMore'
): { root: RailroadExprNode; wrapperId: string } {
  const wrapperId = createRailroadExprId();
  const nextRoot = updateRailroadExprNode(root, targetId, (node) => {
    if (wrapperKind === 'sequence' || wrapperKind === 'choice') {
      return {
        id: wrapperId,
        kind: wrapperKind,
        children: [
          node,
          createRailroadExprNode(
            'terminal',
            wrapperKind === 'choice' ? 'alt' : 'next'
          ),
        ],
      };
    }
    return {
      id: wrapperId,
      kind: wrapperKind,
      children: [node],
    };
  });
  return { root: nextRoot, wrapperId };
}

export function moveRailroadExprChild(
  root: RailroadExprNode,
  targetId: string,
  delta: -1 | 1
): RailroadExprNode {
  if (!root.children) {
    return root;
  }
  const idx = root.children.findIndex((c) => c.id === targetId);
  if (idx !== -1) {
    const swapIdx = idx + delta;
    if (swapIdx < 0 || swapIdx >= root.children.length) {
      return root;
    }
    const next = [...root.children];
    const [moved] = next.splice(idx, 1);
    next.splice(swapIdx, 0, moved);
    return { ...root, children: next };
  }
  return {
    ...root,
    children: root.children.map((c) => moveRailroadExprChild(c, targetId, delta)),
  };
}

export function deleteRailroadExprNode(
  root: RailroadExprNode,
  targetId: string
): RailroadExprNode {
  if (root.id === targetId) {
    // Root wrapper can be unwrapped to its first child if composite
    if (root.children && root.children.length > 0) {
      return root.children[0];
    }
    return root;
  }
  if (!root.children) {
    return root;
  }
  const idx = root.children.findIndex((c) => c.id === targetId);
  if (idx !== -1) {
    const target = root.children[idx];
    // If target is a unary wrapper with a child inside sequence/choice, replace with its child
    if (
      (target.kind === 'optional' ||
        target.kind === 'oneOrMore' ||
        target.kind === 'zeroOrMore') &&
      target.children &&
      target.children.length === 1 &&
      root.children.length <= 1
    ) {
      return { ...root, children: [target.children[0]] };
    }
    if (root.children.length <= 1) {
      return root;
    }
    return {
      ...root,
      children: root.children.filter((c) => c.id !== targetId),
    };
  }
  return {
    ...root,
    children: root.children.map((c) => deleteRailroadExprNode(c, targetId)),
  };
}

// --- Code Generation for all 4 dialects ---

function escapeDoubleQuoted(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function emitFunctionalExpr(node: RailroadExprNode): string {
  switch (node.kind) {
    case 'terminal':
      return `terminal("${escapeDoubleQuoted(node.value ?? '')}")`;
    case 'nonterminal':
      return `nonterminal("${escapeDoubleQuoted(node.value ?? 'Rule')}")`;
    case 'special':
      return `special("${escapeDoubleQuoted(node.value ?? '')}")`;
    case 'sequence': {
      const children = node.children ?? [];
      if (children.length === 0) return 'terminal("")';
      if (children.length === 1) return emitFunctionalExpr(children[0]);
      return `sequence(${children.map(emitFunctionalExpr).join(', ')})`;
    }
    case 'choice': {
      const children = node.children ?? [];
      if (children.length === 0) return 'terminal("")';
      if (children.length === 1) return emitFunctionalExpr(children[0]);
      return `choice(${children.map(emitFunctionalExpr).join(', ')})`;
    }
    case 'optional': {
      const child = node.children?.[0];
      return `optional(${child ? emitFunctionalExpr(child) : 'terminal("")'})`;
    }
    case 'oneOrMore': {
      const child = node.children?.[0];
      return `oneOrMore(${child ? emitFunctionalExpr(child) : 'terminal("")'})`;
    }
    case 'zeroOrMore': {
      const child = node.children?.[0];
      return `zeroOrMore(${child ? emitFunctionalExpr(child) : 'terminal("")'})`;
    }
  }
}

function emitEbnfExpr(node: RailroadExprNode, parentKind?: RailroadExprKind): string {
  switch (node.kind) {
    case 'terminal':
      return `"${escapeDoubleQuoted(node.value ?? '')}"`;
    case 'nonterminal':
      return sanitizeRailroadRuleName(node.value ?? 'Rule', 'railroad-ebnf-beta', 'Rule');
    case 'special': {
      const safe = (node.value ?? 'note').replace(/[?;]/g, '').trim() || 'note';
      return `? ${safe} ?`;
    }
    case 'sequence': {
      const children = node.children ?? [];
      if (children.length === 0) return '""';
      if (children.length === 1) return emitEbnfExpr(children[0], parentKind);
      return children.map((c) => emitEbnfExpr(c, 'sequence')).join(' , ');
    }
    case 'choice': {
      const children = node.children ?? [];
      if (children.length === 0) return '""';
      if (children.length === 1) return emitEbnfExpr(children[0], parentKind);
      const inner = children.map((c) => emitEbnfExpr(c, 'choice')).join(' | ');
      return parentKind === 'sequence' || parentKind === 'oneOrMore'
        ? `( ${inner} )`
        : inner;
    }
    case 'optional': {
      const child = node.children?.[0];
      return `[ ${child ? emitEbnfExpr(child) : '""'} ]`;
    }
    case 'zeroOrMore': {
      const child = node.children?.[0];
      return `{ ${child ? emitEbnfExpr(child) : '""'} }`;
    }
    case 'oneOrMore': {
      const child = node.children?.[0];
      if (!child) return '""+';
      const inner = emitEbnfExpr(child, 'oneOrMore');
      if (
        child.kind === 'terminal' ||
        child.kind === 'nonterminal' ||
        child.kind === 'special'
      ) {
        return `${inner}+`;
      }
      return `( ${inner} )+`;
    }
  }
}

function emitAbnfExpr(node: RailroadExprNode, parentKind?: RailroadExprKind): string {
  switch (node.kind) {
    case 'terminal':
    case 'special':
      return `"${(node.value ?? '').replace(/"/g, "'")}"`;
    case 'nonterminal':
      return sanitizeRailroadRuleName(node.value ?? 'Rule', 'railroad-abnf-beta', 'Rule');
    case 'sequence': {
      const children = node.children ?? [];
      if (children.length === 0) return '""';
      if (children.length === 1) return emitAbnfExpr(children[0], parentKind);
      return children.map((c) => emitAbnfExpr(c, 'sequence')).join(' ');
    }
    case 'choice': {
      const children = node.children ?? [];
      if (children.length === 0) return '""';
      if (children.length === 1) return emitAbnfExpr(children[0], parentKind);
      const inner = children.map((c) => emitAbnfExpr(c, 'choice')).join(' / ');
      return parentKind === 'sequence' ||
        parentKind === 'oneOrMore' ||
        parentKind === 'zeroOrMore'
        ? `(${inner})`
        : inner;
    }
    case 'optional': {
      const child = node.children?.[0];
      return `[${child ? emitAbnfExpr(child) : '""'}]`;
    }
    case 'zeroOrMore': {
      const child = node.children?.[0];
      if (!child) return '*""';
      const inner = emitAbnfExpr(child, 'zeroOrMore');
      if (child.kind === 'sequence' && (child.children?.length ?? 0) > 1) {
        return `*(${inner})`;
      }
      return `*${inner}`;
    }
    case 'oneOrMore': {
      const child = node.children?.[0];
      if (!child) return '1*""';
      const inner = emitAbnfExpr(child, 'oneOrMore');
      if (child.kind === 'sequence' && (child.children?.length ?? 0) > 1) {
        return `1*(${inner})`;
      }
      return `1*${inner}`;
    }
  }
}

function emitPegExpr(node: RailroadExprNode, parentKind?: RailroadExprKind): string {
  switch (node.kind) {
    case 'terminal':
    case 'special':
      return `"${escapeDoubleQuoted(node.value ?? '')}"`;
    case 'nonterminal':
      return sanitizeRailroadRuleName(node.value ?? 'Rule', 'railroad-peg-beta', 'Rule');
    case 'sequence': {
      const children = node.children ?? [];
      if (children.length === 0) return '""';
      if (children.length === 1) return emitPegExpr(children[0], parentKind);
      return children.map((c) => emitPegExpr(c, 'sequence')).join(' ');
    }
    case 'choice': {
      const children = node.children ?? [];
      if (children.length === 0) return '""';
      if (children.length === 1) return emitPegExpr(children[0], parentKind);
      const inner = children.map((c) => emitPegExpr(c, 'choice')).join(' / ');
      return parentKind && parentKind !== 'choice' ? `(${inner})` : inner;
    }
    case 'optional':
    case 'oneOrMore':
    case 'zeroOrMore': {
      const suffix =
        node.kind === 'optional' ? '?' : node.kind === 'oneOrMore' ? '+' : '*';
      const child = node.children?.[0];
      if (!child) return `""${suffix}`;
      const inner = emitPegExpr(child, node.kind);
      if (
        child.kind === 'terminal' ||
        child.kind === 'nonterminal' ||
        child.kind === 'special'
      ) {
        return `${inner}${suffix}`;
      }
      if (inner.startsWith('(') && inner.endsWith(')')) {
        return `${inner}${suffix}`;
      }
      return `(${inner})${suffix}`;
    }
  }
}

export function generateRailroadCode(rawData: RailroadDiagramData): string {
  const data = normalizeRailroadData(rawData);
  const lines: string[] = [data.syntax];

  if (data.title && data.title.trim()) {
    lines.push(`  title ${data.title.trim()}`);
  }

  for (const comment of data.comments ?? []) {
    const clean = sanitizeSingleLineComment(comment);
    if (clean) {
      lines.push(`  %% ${clean}`);
    }
  }

  for (const rule of data.rules) {
    if (data.syntax === 'railroad-beta') {
      lines.push(`  ${rule.name} = ${emitFunctionalExpr(rule.root)};`);
    } else if (data.syntax === 'railroad-ebnf-beta') {
      lines.push(`  ${rule.name} = ${emitEbnfExpr(rule.root)};`);
    } else if (data.syntax === 'railroad-abnf-beta') {
      lines.push(`  ${rule.name} = ${emitAbnfExpr(rule.root)};`);
    } else {
      lines.push(`  ${rule.name} <- ${emitPegExpr(rule.root)};`);
    }
  }

  lines.push(formatGuiStateLine(data));
  return lines.join('\n');
}

// --- Plain-text Parsers ---

function splitTopLevelArgs(input: string, sepChar: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let depth = 0;
  let inQuote = false;
  let quoteChar = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuote) {
      cur += ch;
      if (ch === quoteChar && input[i - 1] !== '\\') {
        inQuote = false;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
      cur += ch;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if ((ch === ')' || ch === ']' || ch === '}') && depth > 0) depth--;

    if (ch === sepChar && depth === 0) {
      if (cur.trim()) parts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function unquoteEscaped(raw: string): string {
  const t = raw.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, '\\');
  }
  return t;
}

function parseFunctionalRailroadExpr(raw: string): RailroadExprNode {
  const trimmed = raw.trim();
  const callMatch = /^([a-zA-Z_]+)\(([\s\S]*)\)$/.exec(trimmed);
  if (!callMatch) {
    if (/^["']/.test(trimmed)) {
      return createRailroadExprNode('terminal', unquoteEscaped(trimmed));
    }
    return createRailroadExprNode('nonterminal', trimmed || 'Rule');
  }
  const fnName = callMatch[1];
  const inner = callMatch[2].trim();

  if (fnName === 'terminal') {
    return createRailroadExprNode('terminal', unquoteEscaped(inner));
  }
  if (fnName === 'nonterminal') {
    return createRailroadExprNode('nonterminal', unquoteEscaped(inner));
  }
  if (fnName === 'special') {
    return createRailroadExprNode('special', unquoteEscaped(inner));
  }
  if (fnName === 'optional') {
    return createRailroadExprNode('optional', undefined, [
      parseFunctionalRailroadExpr(inner),
    ]);
  }
  if (fnName === 'oneOrMore') {
    return createRailroadExprNode('oneOrMore', undefined, [
      parseFunctionalRailroadExpr(inner),
    ]);
  }
  if (fnName === 'zeroOrMore') {
    return createRailroadExprNode('zeroOrMore', undefined, [
      parseFunctionalRailroadExpr(inner),
    ]);
  }
  if (fnName === 'sequence' || fnName === 'choice') {
    const args = splitTopLevelArgs(inner, ',').map(parseFunctionalRailroadExpr);
    if (args.length === 1) {
      return args[0];
    }
    return createRailroadExprNode(fnName, undefined, args);
  }
  return createRailroadExprNode('terminal', trimmed);
}

interface Token {
  type: 'str' | 'special' | 'id' | 'sym';
  value: string;
}

function tokenizeNotation(input: string, syntax: RailroadSyntax): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const q = ch;
      let j = i + 1;
      let buf = '';
      while (j < input.length && input[j] !== q) {
        if (input[j] === '\\' && j + 1 < input.length) {
          buf += input[j + 1];
          j += 2;
        } else {
          buf += input[j];
          j++;
        }
      }
      tokens.push({ type: 'str', value: buf });
      i = j + 1;
      continue;
    }
    if (ch === '?' && syntax === 'railroad-ebnf-beta') {
      const endQ = input.indexOf('?', i + 1);
      if (endQ !== -1) {
        tokens.push({
          type: 'special',
          value: input.slice(i + 1, endQ).trim(),
        });
        i = endQ + 1;
        continue;
      }
    }
    if (syntax === 'railroad-abnf-beta' && ch === '%') {
      const m = /^%[xXdDbB][0-9A-Fa-f.-]+/.exec(input.slice(i));
      if (m) {
        tokens.push({ type: 'str', value: m[0] });
        i += m[0].length;
        continue;
      }
    }
    if (syntax === 'railroad-abnf-beta' && /^[0-9]*\*/.test(input.slice(i))) {
      const m = /^([0-9]*\*[0-9]*)/.exec(input.slice(i))!;
      tokens.push({ type: 'sym', value: m[1] });
      i += m[1].length;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(input.slice(i))!;
      tokens.push({ type: 'id', value: m[0] });
      i += m[0].length;
      continue;
    }
    tokens.push({ type: 'sym', value: ch });
    i++;
  }
  return tokens;
}

function parseNotationExpr(raw: string, syntax: RailroadSyntax): RailroadExprNode {
  const tokens = tokenizeNotation(raw, syntax);
  let pos = 0;

  const peek = (): Token | undefined => tokens[pos];
  const consume = (): Token | undefined => tokens[pos++];

  const parseChoice = (): RailroadExprNode => {
    const alts: RailroadExprNode[] = [parseSequence()];
    const altSep = syntax === 'railroad-ebnf-beta' ? '|' : '/';
    while (peek()?.type === 'sym' && peek()?.value === altSep) {
      consume();
      alts.push(parseSequence());
    }
    return alts.length === 1
      ? alts[0]
      : createRailroadExprNode('choice', undefined, alts);
  };

  const parseSequence = (): RailroadExprNode => {
    const seq: RailroadExprNode[] = [];
    const altSep = syntax === 'railroad-ebnf-beta' ? '|' : '/';
    while (pos < tokens.length) {
      const tk = peek()!;
      if (
        tk.type === 'sym' &&
        (tk.value === altSep ||
          tk.value === ')' ||
          tk.value === ']' ||
          tk.value === '}')
      ) {
        break;
      }
      if (syntax === 'railroad-ebnf-beta' && tk.type === 'sym' && tk.value === ',') {
        consume();
        continue;
      }
      seq.push(parseTerm());
    }
    if (seq.length === 0) {
      return createRailroadExprNode('terminal', 'item');
    }
    return seq.length === 1
      ? seq[0]
      : createRailroadExprNode('sequence', undefined, seq);
  };

  const parseTerm = (): RailroadExprNode => {
    if (syntax === 'railroad-abnf-beta' && peek()?.type === 'sym' && peek()!.value.includes('*')) {
      const rep = consume()!.value;
      const target = parsePrimary();
      const kind: RailroadExprKind = rep.startsWith('1*')
        ? 'oneOrMore'
        : 'zeroOrMore';
      return createRailroadExprNode(kind, undefined, [target]);
    }
    if (syntax === 'railroad-peg-beta' && peek()?.type === 'sym' && (peek()!.value === '&' || peek()!.value === '!')) {
      consume();
    }
    let node = parsePrimary();
    if (syntax === 'railroad-ebnf-beta' || syntax === 'railroad-peg-beta') {
      const post = peek();
      if (post?.type === 'sym' && (post.value === '?' || post.value === '*' || post.value === '+')) {
        consume();
        const kind: RailroadExprKind =
          post.value === '?'
            ? 'optional'
            : post.value === '+'
              ? 'oneOrMore'
              : 'zeroOrMore';
        node = createRailroadExprNode(kind, undefined, [node]);
      }
    }
    return node;
  };

  const parsePrimary = (): RailroadExprNode => {
    const tk = consume();
    if (!tk) {
      return createRailroadExprNode('terminal', 'item');
    }
    if (tk.type === 'str') {
      return createRailroadExprNode('terminal', tk.value);
    }
    if (tk.type === 'special') {
      return createRailroadExprNode('special', tk.value);
    }
    if (tk.type === 'id') {
      return createRailroadExprNode('nonterminal', tk.value);
    }
    if (tk.value === '(') {
      const inner = parseChoice();
      if (peek()?.value === ')') consume();
      return inner;
    }
    if (tk.value === '[') {
      const inner = parseChoice();
      if (peek()?.value === ']') consume();
      return createRailroadExprNode('optional', undefined, [inner]);
    }
    if (tk.value === '{' && syntax === 'railroad-ebnf-beta') {
      const inner = parseChoice();
      if (peek()?.value === '}') consume();
      return createRailroadExprNode('zeroOrMore', undefined, [inner]);
    }
    return createRailroadExprNode('terminal', tk.value);
  };

  return parseChoice();
}

export function parseRailroadCodeToGuiData(code: string): RailroadDiagramData {
  const lines = code.split(/\r?\n/);
  const fromGuiState = extractGuiStateJson(lines, isValidRailroadData);
  if (fromGuiState) {
    return normalizeRailroadData(fromGuiState);
  }

  let syntax: RailroadSyntax = 'railroad-beta';
  let title: string | undefined;
  const comments: string[] = [];
  const bodyChunks: string[] = [];
  let inFrontmatter = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      continue;
    }
    if (i === 0 && trimmed === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (trimmed === '---') {
        inFrontmatter = false;
        continue;
      }
      const fmTitle = /^title\s*:\s*(.+)$/i.exec(trimmed);
      if (fmTitle) {
        title = unquoteYamlString(fmTitle[1]);
      }
      continue;
    }

    if (trimmed.startsWith('%%')) {
      const comment = trimmed.slice(2).trim();
      if (comment && !comment.startsWith('@gui-state:')) {
        comments.push(comment);
      }
      continue;
    }

    if (/^railroad-ebnf-beta\b/i.test(trimmed)) {
      syntax = 'railroad-ebnf-beta';
      continue;
    }
    if (/^railroad-abnf-beta\b/i.test(trimmed)) {
      syntax = 'railroad-abnf-beta';
      continue;
    }
    if (/^railroad-peg-beta\b/i.test(trimmed)) {
      syntax = 'railroad-peg-beta';
      continue;
    }
    if (/^railroad-beta\b/i.test(trimmed)) {
      syntax = 'railroad-beta';
      continue;
    }

    const titleMatch = /^title\s+(.+)$/i.exec(trimmed);
    if (titleMatch) {
      title = unquoteYamlString(titleMatch[1]);
      continue;
    }

    if (/^accTitle\s*:|^accDescr\s*[:{]/i.test(trimmed)) {
      continue;
    }

    bodyChunks.push(trimmed);
  }

  const joined = bodyChunks.join(' ');
  const statements = splitTopLevelArgs(joined, ';');
  const rules: RailroadRuleData[] = [];
  let ruleSeq = 1;

  for (const stmt of statements) {
    const ruleMatch = /^([A-Za-z_][A-Za-z0-9_-]*)\s*(?:<-|::=|=)\s*([\s\S]+)$/.exec(
      stmt
    );
    if (!ruleMatch) {
      continue;
    }
    const name = sanitizeRailroadRuleName(
      ruleMatch[1],
      syntax,
      `Rule${ruleSeq}`
    );
    const exprText = ruleMatch[2].trim();
    const root =
      syntax === 'railroad-beta'
        ? parseFunctionalRailroadExpr(exprText)
        : parseNotationExpr(exprText, syntax);
    rules.push({
      id: `rule_${ruleSeq++}`,
      name,
      root,
    });
  }

  return normalizeRailroadData({
    diagramType: 'railroad',
    syntax,
    ...(title ? { title } : {}),
    rules,
    ...(comments.length > 0 ? { comments } : {}),
  });
}
