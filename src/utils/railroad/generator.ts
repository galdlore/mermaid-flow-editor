import type {
  RailroadDiagramData,
  RailroadExprKind,
  RailroadExprNode,
} from '../../types/editor';
import { formatGuiStateLine, sanitizeSingleLineComment } from '../mermaidEnvelope.ts';
import { normalizeRailroadData, sanitizeRailroadRuleName } from './shared.ts';

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
