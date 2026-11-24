import type {
  RailroadDiagramData,
  RailroadExprKind,
  RailroadExprNode,
  RailroadRuleData,
  RailroadSyntax,
} from '../../types/editor';
import { extractGuiStateJson, unquoteYamlString } from '../mermaidEnvelope.ts';
import {
  createRailroadExprNode,
  isValidRailroadData,
  normalizeRailroadData,
  sanitizeRailroadRuleName,
} from './shared.ts';

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
