import type {
  BlockArrowDirection,
  BlockDiagramData,
  BlockEdgeData,
  BlockEdgeLineType,
  BlockItemData,
  BlockItemKind,
  BlockNodeShape,
} from '../types/editor';
import { sanitizeCssColor } from './inputSafeguard.ts';
import {
  allocateUniqueId,
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
} from './mermaidEnvelope.ts';

export const BLOCK_SHAPE_OPTIONS: ReadonlyArray<BlockNodeShape> = [
  'square',
  'round',
  'stadium',
  'subroutine',
  'cylinder',
  'circle',
  'doublecircle',
  'diamond',
  'hexagon',
  'lean_right',
  'lean_left',
  'trapezoid',
  'inv_trapezoid',
  'asymmetric',
];

export const BLOCK_ARROW_DIRECTIONS: ReadonlyArray<BlockArrowDirection> = [
  'right',
  'left',
  'up',
  'down',
  'x',
  'y',
];

export const BLOCK_EDGE_LINE_TYPES: ReadonlyArray<BlockEdgeLineType> = [
  'arrow',
  'line',
  'dotted',
  'thick',
  'bidirectional',
];

const VALID_SHAPES = new Set<BlockNodeShape>(BLOCK_SHAPE_OPTIONS);
const VALID_ARROW_DIRS = new Set<BlockArrowDirection>(BLOCK_ARROW_DIRECTIONS);
const VALID_ITEM_KINDS = new Set<BlockItemKind>([
  'node',
  'space',
  'arrow',
  'group',
]);
const VALID_EDGE_TYPES = new Set<BlockEdgeLineType>(BLOCK_EDGE_LINE_TYPES);
const RESERVED_BLOCK_IDS = new Set([
  'block',
  'end',
  'space',
  'columns',
  'style',
  'class',
  'classdef',
  'default',
  'linkstyle',
  'interpolate',
  'acctitle',
  'accdescr',
]);

export function sanitizeBlockId(raw: string, fallback = 'blk_1'): string {
  let cleaned = raw.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+/, '');
  if (!cleaned) {
    return fallback;
  }
  if (/^[0-9]/.test(cleaned) || RESERVED_BLOCK_IDS.has(cleaned.toLowerCase())) {
    cleaned = `blk_${cleaned}`;
  }
  return cleaned;
}

function sanitizeBlockLabel(raw?: string): string {
  if (typeof raw !== 'string') {
    return '';
  }
  return raw.replace(/["`\r\n]/g, '').trim();
}

export function createDefaultBlockData(
  lang: 'ja' | 'en' = 'ja'
): BlockDiagramData {
  const isJa = lang === 'ja';
  return {
    diagramType: 'block',
    columns: 3,
    items: [
      {
        id: 'frontend',
        kind: 'node',
        label: isJa ? 'フロントエンド' : 'Frontend UI',
        shape: 'round',
        span: 2,
        fill: '#eff6ff',
        stroke: '#2563eb',
      },
      {
        id: 'db',
        kind: 'node',
        label: isJa ? 'データベース' : 'Database',
        shape: 'cylinder',
        span: 1,
        fill: '#f0fdf4',
        stroke: '#16a34a',
      },
      {
        id: 'space_1',
        kind: 'space',
        span: 1,
      },
      {
        id: 'backend_grp',
        kind: 'group',
        label: isJa ? 'バックエンド群' : 'Backend Cluster',
        span: 2,
        groupColumns: 2,
      },
      {
        id: 'api',
        kind: 'node',
        label: 'API Server',
        shape: 'square',
        span: 1,
        parentGroupId: 'backend_grp',
      },
      {
        id: 'cache',
        kind: 'node',
        label: 'Cache',
        shape: 'stadium',
        span: 1,
        parentGroupId: 'backend_grp',
      },
      {
        id: 'flow_arrow',
        kind: 'arrow',
        label: isJa ? '連携' : 'Sync',
        arrowDirection: 'right',
        span: 3,
      },
    ],
    edges: [
      {
        id: 'bedge_1',
        from: 'frontend',
        to: 'api',
        lineType: 'arrow',
        label: 'HTTPS',
      },
      {
        id: 'bedge_2',
        from: 'api',
        to: 'db',
        lineType: 'arrow',
      },
    ],
  };
}

export function isValidBlockData(value: unknown): value is BlockDiagramData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Partial<BlockDiagramData>;
  if (
    obj.diagramType !== 'block' ||
    typeof obj.columns !== 'number' ||
    !Array.isArray(obj.items) ||
    !Array.isArray(obj.edges)
  ) {
    return false;
  }
  return obj.items.every(
    (item) =>
      Boolean(item) &&
      typeof item === 'object' &&
      typeof item.id === 'string' &&
      typeof item.kind === 'string' &&
      VALID_ITEM_KINDS.has(item.kind)
  );
}

function clampSpan(raw: unknown, fallback = 1, max = 12): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return fallback;
  }
  return Math.max(1, Math.min(max, Math.round(raw)));
}

export function normalizeBlockData(data: BlockDiagramData): BlockDiagramData {
  const columns =
    typeof data.columns === 'number' && Number.isFinite(data.columns)
      ? Math.max(0, Math.min(12, Math.round(data.columns)))
      : 3;

  const usedItemIds = new Set<string>();
  const idRemap = new Map<string, string>();

  // First pass: register groups and items with collision-free safe IDs
  const rawItems: BlockItemData[] = [];
  for (let i = 0; i < data.items.length; i++) {
    const raw = data.items[i];
    const kind: BlockItemKind = VALID_ITEM_KINDS.has(raw.kind)
      ? raw.kind
      : 'node';
    const baseId = sanitizeBlockId(
      raw.id || `${kind}_${i + 1}`,
      `${kind}_${i + 1}`
    );
    const id = allocateUniqueId(baseId, usedItemIds);
    if (raw.id) {
      idRemap.set(raw.id, id);
    }

    const span = clampSpan(raw.span, 1, 12);
    const fill = sanitizeCssColor(raw.fill);
    const stroke = sanitizeCssColor(raw.stroke);

    if (kind === 'space') {
      rawItems.push({
        id,
        kind: 'space',
        span,
        ...(raw.parentGroupId ? { parentGroupId: raw.parentGroupId } : {}),
      });
    } else if (kind === 'arrow') {
      const dir: BlockArrowDirection =
        raw.arrowDirection && VALID_ARROW_DIRS.has(raw.arrowDirection)
          ? raw.arrowDirection
          : 'right';
      rawItems.push({
        id,
        kind: 'arrow',
        label: sanitizeBlockLabel(raw.label) || 'Arrow',
        arrowDirection: dir,
        span,
        ...(raw.parentGroupId ? { parentGroupId: raw.parentGroupId } : {}),
        ...(fill ? { fill } : {}),
        ...(stroke ? { stroke } : {}),
      });
    } else if (kind === 'group') {
      const groupColumns =
        typeof raw.groupColumns === 'number' && Number.isFinite(raw.groupColumns)
          ? Math.max(0, Math.min(12, Math.round(raw.groupColumns)))
          : 2;
      rawItems.push({
        id,
        kind: 'group',
        ...(sanitizeBlockLabel(raw.label)
          ? { label: sanitizeBlockLabel(raw.label) }
          : {}),
        span,
        groupColumns,
        ...(fill ? { fill } : {}),
        ...(stroke ? { stroke } : {}),
      });
    } else {
      const shape: BlockNodeShape =
        raw.shape && VALID_SHAPES.has(raw.shape) ? raw.shape : 'square';
      rawItems.push({
        id,
        kind: 'node',
        label: sanitizeBlockLabel(raw.label) || id,
        shape,
        span,
        ...(raw.parentGroupId ? { parentGroupId: raw.parentGroupId } : {}),
        ...(fill ? { fill } : {}),
        ...(stroke ? { stroke } : {}),
      });
    }
  }

  const groupIds = new Set(
    rawItems.filter((item) => item.kind === 'group').map((item) => item.id)
  );

  const items = rawItems.map((item) => {
    if (item.kind === 'group' || !item.parentGroupId) {
      const { parentGroupId: _drop, ...rest } = item;
      return rest;
    }
    const mappedParent = idRemap.get(item.parentGroupId) ?? item.parentGroupId;
    if (!groupIds.has(mappedParent)) {
      const { parentGroupId: _drop, ...rest } = item;
      return rest;
    }
    return { ...item, parentGroupId: mappedParent };
  });

  const connectableIds = new Set(
    items.filter((item) => item.kind !== 'space').map((item) => item.id)
  );
  const usedEdgeIds = new Set<string>();
  const edges: BlockEdgeData[] = [];

  for (let i = 0; i < data.edges.length; i++) {
    const raw = data.edges[i];
    if (!raw || typeof raw !== 'object') {
      continue;
    }
    const from = idRemap.get(raw.from) ?? raw.from;
    const to = idRemap.get(raw.to) ?? raw.to;
    if (!connectableIds.has(from) || !connectableIds.has(to)) {
      continue;
    }
    const baseEdgeId =
      raw.id && /^[a-zA-Z0-9_-]+$/.test(raw.id) ? raw.id : `bedge_${i + 1}`;
    const id = allocateUniqueId(baseEdgeId, usedEdgeIds);
    const lineType: BlockEdgeLineType =
      raw.lineType && VALID_EDGE_TYPES.has(raw.lineType)
        ? raw.lineType
        : 'arrow';
    const label = sanitizeBlockLabel(raw.label);
    edges.push({
      id,
      from,
      to,
      lineType,
      ...(label ? { label } : {}),
    });
  }

  const comments = Array.isArray(data.comments)
    ? data.comments
        .filter((c): c is string => typeof c === 'string')
        .map(sanitizeSingleLineComment)
        .filter((c) => c.length > 0)
    : undefined;

  return {
    diagramType: 'block',
    columns,
    items,
    edges,
    ...(comments && comments.length > 0 ? { comments } : {}),
  };
}

function formatBlockNodeSyntax(item: BlockItemData): string {
  const label = sanitizeBlockLabel(item.label) || item.id;
  const quoted = `"${label}"`;
  const shape = item.shape ?? 'square';
  let shapeExpr: string;
  switch (shape) {
    case 'round':
      shapeExpr = `(${quoted})`;
      break;
    case 'stadium':
      shapeExpr = `([${quoted}])`;
      break;
    case 'subroutine':
      shapeExpr = `[[${quoted}]]`;
      break;
    case 'cylinder':
      shapeExpr = `[(${quoted})]`;
      break;
    case 'circle':
      shapeExpr = `((${quoted}))`;
      break;
    case 'doublecircle':
      shapeExpr = `(((${quoted})))`;
      break;
    case 'diamond':
      shapeExpr = `{${quoted}}`;
      break;
    case 'hexagon':
      shapeExpr = `{{${quoted}}}`;
      break;
    case 'lean_right':
      shapeExpr = `[/${quoted}/]`;
      break;
    case 'lean_left':
      shapeExpr = `[\\${quoted}\\]`;
      break;
    case 'trapezoid':
      shapeExpr = `[/${quoted}\\]`;
      break;
    case 'inv_trapezoid':
      shapeExpr = `[\\${quoted}/]`;
      break;
    case 'asymmetric':
      shapeExpr = `>${quoted}]`;
      break;
    case 'square':
    default:
      shapeExpr = `[${quoted}]`;
      break;
  }
  const spanSuffix = item.span && item.span > 1 ? `:${item.span}` : '';
  return `${item.id}${shapeExpr}${spanSuffix}`;
}

function formatBlockItemLine(item: BlockItemData, indent: string): string {
  if (item.kind === 'space') {
    return item.span && item.span > 1
      ? `${indent}space:${item.span}`
      : `${indent}space`;
  }
  if (item.kind === 'arrow') {
    const label = sanitizeBlockLabel(item.label) || 'Arrow';
    const dir = item.arrowDirection ?? 'right';
    const spanSuffix = item.span && item.span > 1 ? `:${item.span}` : '';
    return `${indent}${item.id}<["${label}"]>(${dir})${spanSuffix}`;
  }
  return `${indent}${formatBlockNodeSyntax(item)}`;
}

function formatBlockEdgeLine(edge: BlockEdgeData): string {
  const label = sanitizeBlockLabel(edge.label);
  if (!label) {
    switch (edge.lineType) {
      case 'line':
        return `  ${edge.from} --- ${edge.to}`;
      case 'dotted':
        return `  ${edge.from} -.-> ${edge.to}`;
      case 'thick':
        return `  ${edge.from} ==> ${edge.to}`;
      case 'bidirectional':
        return `  ${edge.from} <--> ${edge.to}`;
      case 'arrow':
      default:
        return `  ${edge.from} --> ${edge.to}`;
    }
  }

  switch (edge.lineType) {
    case 'line':
      return `  ${edge.from} -- "${label}" --- ${edge.to}`;
    case 'dotted':
      return `  ${edge.from} -. "${label}" .-> ${edge.to}`;
    case 'thick':
      return `  ${edge.from} == "${label}" ==> ${edge.to}`;
    case 'bidirectional':
      return `  ${edge.from} <-- "${label}" --> ${edge.to}`;
    case 'arrow':
    default:
      return `  ${edge.from} -- "${label}" --> ${edge.to}`;
  }
}

export function generateBlockCode(rawData: BlockDiagramData): string {
  const data = normalizeBlockData(rawData);
  const lines: string[] = ['block-beta'];

  if (data.columns > 0) {
    lines.push(`  columns ${data.columns}`);
  } else {
    lines.push('  columns auto');
  }

  for (const comment of data.comments ?? []) {
    const clean = sanitizeSingleLineComment(comment);
    if (clean) {
      lines.push(`  %% ${clean}`);
    }
  }

  const topLevelItems = data.items.filter((item) => !item.parentGroupId);
  for (const item of topLevelItems) {
    if (item.kind === 'group') {
      const spanSuffix = item.span && item.span > 1 ? `:${item.span}` : '';
      lines.push(`  block:${item.id}${spanSuffix}`);
      if (item.groupColumns && item.groupColumns > 0) {
        lines.push(`    columns ${item.groupColumns}`);
      } else if (item.groupColumns === 0) {
        lines.push('    columns auto');
      }
      const children = data.items.filter(
        (child) => child.parentGroupId === item.id && child.kind !== 'group'
      );
      for (const child of children) {
        lines.push(formatBlockItemLine(child, '    '));
      }
      lines.push('  end');
    } else {
      lines.push(formatBlockItemLine(item, '  '));
    }
  }

  for (const edge of data.edges) {
    lines.push(formatBlockEdgeLine(edge));
  }

  for (const item of data.items) {
    if (item.kind === 'space') {
      continue;
    }
    const styleProps: string[] = [];
    if (item.fill) {
      styleProps.push(`fill:${item.fill}`);
    }
    if (item.stroke) {
      styleProps.push(`stroke:${item.stroke}`);
    }
    if (styleProps.length > 0) {
      lines.push(`  style ${item.id} ${styleProps.join(',')}`);
    }
  }

  lines.push(formatGuiStateLine(data));
  return lines.join('\n');
}

function unquoteBlockLabel(raw: string): string {
  const t = raw.trim();
  if (
    (t.startsWith('"`') && t.endsWith('`"')) ||
    (t.startsWith('`"') && t.endsWith('"`'))
  ) {
    return t.slice(2, -2).trim();
  }
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1).trim();
  }
  return t;
}

function parseSingleBlockToken(
  token: string,
  parentGroupId: string | undefined,
  spaceSeqRef: { val: number }
): BlockItemData | null {
  const spaceMatch = /^space(?::(\d+))?$/i.exec(token);
  if (spaceMatch) {
    return {
      id: `space_${spaceSeqRef.val++}`,
      kind: 'space',
      span: spaceMatch[1] ? Number.parseInt(spaceMatch[1], 10) : 1,
      ...(parentGroupId ? { parentGroupId } : {}),
    };
  }

  const arrowMatch =
    /^([a-zA-Z0-9_]+)<\[([\s\S]*?)\]>\(([^)]+)\)(?::(\d+))?$/.exec(token);
  if (arrowMatch) {
    const dirRaw = arrowMatch[3].trim().toLowerCase() as BlockArrowDirection;
    const arrowDirection: BlockArrowDirection = VALID_ARROW_DIRS.has(dirRaw)
      ? dirRaw
      : 'right';
    return {
      id: arrowMatch[1],
      kind: 'arrow',
      label: unquoteBlockLabel(arrowMatch[2]) || arrowMatch[1],
      arrowDirection,
      span: arrowMatch[4] ? Number.parseInt(arrowMatch[4], 10) : 1,
      ...(parentGroupId ? { parentGroupId } : {}),
    };
  }

  const spanMatch = /:(\d+)$/.exec(token);
  const span = spanMatch ? Number.parseInt(spanMatch[1], 10) : 1;
  const body = spanMatch ? token.slice(0, spanMatch.index) : token;

  const shapePatterns: Array<{
    shape: BlockNodeShape;
    re: RegExp;
  }> = [
    { shape: 'doublecircle', re: /^([a-zA-Z0-9_]+)\(\(\(([\s\S]*?)\)\)\)$/ },
    { shape: 'circle', re: /^([a-zA-Z0-9_]+)\(\(([\s\S]*?)\)\)$/ },
    { shape: 'stadium', re: /^([a-zA-Z0-9_]+)\(\[([\s\S]*?)\]\)$/ },
    { shape: 'subroutine', re: /^([a-zA-Z0-9_]+)\[\[([\s\S]*?)\]\]$/ },
    { shape: 'cylinder', re: /^([a-zA-Z0-9_]+)\[\(([\s\S]*?)\)\]$/ },
    { shape: 'hexagon', re: /^([a-zA-Z0-9_]+)\{\{([\s\S]*?)\}\}$/ },
    { shape: 'diamond', re: /^([a-zA-Z0-9_]+)\{([\s\S]*?)\}$/ },
    { shape: 'lean_right', re: /^([a-zA-Z0-9_]+)\[\/([\s\S]*?)\/\]$/ },
    { shape: 'lean_left', re: /^([a-zA-Z0-9_]+)\[\\([\s\S]*?)\\\]$/ },
    { shape: 'trapezoid', re: /^([a-zA-Z0-9_]+)\[\/([\s\S]*?)\\\]$/ },
    { shape: 'inv_trapezoid', re: /^([a-zA-Z0-9_]+)\[\\([\s\S]*?)\/\]$/ },
    { shape: 'asymmetric', re: /^([a-zA-Z0-9_]+)>([\s\S]*?)\]$/ },
    { shape: 'round', re: /^([a-zA-Z0-9_]+)\(([\s\S]*?)\)$/ },
    { shape: 'square', re: /^([a-zA-Z0-9_]+)\[([\s\S]*?)\]$/ },
  ];

  for (const { shape, re } of shapePatterns) {
    const m = re.exec(body);
    if (m) {
      return {
        id: m[1],
        kind: 'node',
        label: unquoteBlockLabel(m[2]) || m[1],
        shape,
        span,
        ...(parentGroupId ? { parentGroupId } : {}),
      };
    }
  }

  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(body)) {
    return {
      id: body,
      kind: 'node',
      label: body,
      shape: 'square',
      span,
      ...(parentGroupId ? { parentGroupId } : {}),
    };
  }

  return null;
}

/**
 * 1行内に空白区切りで複数並べられたブロック定義（例: a["A"]:2 b("B") space）を分割する。
 */
function splitBlockTokensOnLine(line: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      current += ch;
      if (ch === quoteChar && line[i - 1] !== '\\') {
        inQuote = false;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
      current += ch;
      continue;
    }
    if (ch === '(') parenDepth++;
    else if (ch === ')' && parenDepth > 0) parenDepth--;
    else if (ch === '[') bracketDepth++;
    else if (ch === ']' && bracketDepth > 0) bracketDepth--;
    else if (ch === '{') braceDepth++;
    else if (ch === '}' && braceDepth > 0) braceDepth--;

    if (
      /\s/.test(ch) &&
      parenDepth === 0 &&
      bracketDepth === 0 &&
      braceDepth === 0
    ) {
      if (current.trim()) {
        tokens.push(current.trim());
        current = '';
      }
      continue;
    }
    current += ch;
  }

  if (current.trim()) {
    tokens.push(current.trim());
  }
  return tokens;
}

export function parseBlockCodeToGuiData(code: string): BlockDiagramData {
  const lines = code.split(/\r?\n/);
  const fromGuiState = extractGuiStateJson(lines, isValidBlockData);
  if (fromGuiState) {
    return normalizeBlockData(fromGuiState);
  }

  let columns = 3;
  const items: BlockItemData[] = [];
  const itemById = new Map<string, BlockItemData>();
  const edges: BlockEdgeData[] = [];
  const comments: string[] = [];

  const groupStack: BlockItemData[] = [];
  const spaceSeqRef = { val: 1 };
  let groupSeq = 1;
  let edgeSeq = 1;
  let inFrontmatter = false;

  const ensureNode = (id: string): void => {
    if (!itemById.has(id)) {
      const node: BlockItemData = {
        id,
        kind: 'node',
        label: id,
        shape: 'square',
        span: 1,
      };
      itemById.set(id, node);
      items.push(node);
    }
  };

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

    if (/^block-beta\b|^block\s*$/i.test(trimmed)) {
      continue;
    }

    if (/^accTitle\s*:|^accDescr\s*[:{]/i.test(trimmed)) {
      continue;
    }

    const colMatch = /^columns\s+(auto|\d+)\b/i.exec(trimmed);
    if (colMatch) {
      const colVal =
        colMatch[1].toLowerCase() === 'auto'
          ? 0
          : Number.parseInt(colMatch[1], 10);
      if (groupStack.length > 0) {
        groupStack[groupStack.length - 1].groupColumns = colVal;
      } else {
        columns = colVal;
      }
      continue;
    }

    const grpStartMatch =
      /^block(?::([a-zA-Z0-9_]+))?(?::(\d+))?$/i.exec(trimmed);
    if (grpStartMatch) {
      const grpId = sanitizeBlockId(
        grpStartMatch[1] || `group_${groupSeq++}`,
        `group_${groupSeq}`
      );
      const grpItem: BlockItemData = {
        id: grpId,
        kind: 'group',
        label: grpId,
        span: grpStartMatch[2] ? Number.parseInt(grpStartMatch[2], 10) : 1,
        groupColumns: 2,
      };
      items.push(grpItem);
      itemById.set(grpId, grpItem);
      groupStack.push(grpItem);
      continue;
    }

    if (/^end\b/i.test(trimmed)) {
      if (groupStack.length > 0) {
        groupStack.pop();
      }
      continue;
    }

    const styleMatch = /^style\s+([a-zA-Z0-9_, ]+?)\s+(.+)$/i.exec(trimmed);
    if (styleMatch) {
      const targetIds = styleMatch[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const fillMatch = /\bfill\s*:\s*([^,\s;]+)/i.exec(styleMatch[2]);
      const strokeMatch = /\bstroke\s*:\s*([^,\s;]+)/i.exec(styleMatch[2]);
      for (const tid of targetIds) {
        const target = itemById.get(tid);
        if (target) {
          if (fillMatch) {
            const c = sanitizeCssColor(fillMatch[1]);
            if (c) target.fill = c;
          }
          if (strokeMatch) {
            const c = sanitizeCssColor(strokeMatch[1]);
            if (c) target.stroke = c;
          }
        }
      }
      continue;
    }

    if (/^(?:classDef|class|linkStyle|interpolate)\b/i.test(trimmed)) {
      continue;
    }

    // Labeled edge
    const labeledEdgeMatch =
      /^([a-zA-Z0-9_]+)\s*(<--|--|-\.|==)\s*"([^"]*)"\s*(-->|---|-\.->|\.->|==>)\s*([a-zA-Z0-9_]+)$/.exec(
        trimmed
      );
    if (labeledEdgeMatch) {
      const from = labeledEdgeMatch[1];
      const opLeft = labeledEdgeMatch[2];
      const label = labeledEdgeMatch[3].trim();
      const opRight = labeledEdgeMatch[4];
      const to = labeledEdgeMatch[5];
      let lineType: BlockEdgeLineType = 'arrow';
      if (opLeft === '<--') lineType = 'bidirectional';
      else if (opLeft === '==') lineType = 'thick';
      else if (opLeft === '-.') lineType = 'dotted';
      else if (opRight === '---') lineType = 'line';
      ensureNode(from);
      ensureNode(to);
      edges.push({
        id: `bedge_${edgeSeq++}`,
        from,
        to,
        lineType,
        ...(label ? { label } : {}),
      });
      continue;
    }

    // Unlabeled edge
    const edgeMatch =
      /^([a-zA-Z0-9_]+)\s*(<-->|-->|---|-\.->|==>)\s*([a-zA-Z0-9_]+)$/.exec(
        trimmed
      );
    if (edgeMatch) {
      const from = edgeMatch[1];
      const op = edgeMatch[2];
      const to = edgeMatch[3];
      const lineType: BlockEdgeLineType =
        op === '---'
          ? 'line'
          : op === '-.->'
            ? 'dotted'
            : op === '==>'
              ? 'thick'
              : op === '<-->'
                ? 'bidirectional'
                : 'arrow';
      ensureNode(from);
      ensureNode(to);
      edges.push({
        id: `bedge_${edgeSeq++}`,
        from,
        to,
        lineType,
      });
      continue;
    }

    const activeGroupId =
      groupStack.length > 0 ? groupStack[groupStack.length - 1].id : undefined;
    const tokens = splitBlockTokensOnLine(trimmed);
    for (const token of tokens) {
      const parsed = parseSingleBlockToken(token, activeGroupId, spaceSeqRef);
      if (parsed) {
        if (itemById.has(parsed.id) && parsed.kind !== 'space') {
          const existing = itemById.get(parsed.id)!;
          if (parsed.label && existing.label === existing.id) {
            existing.label = parsed.label;
          }
          if (parsed.shape) existing.shape = parsed.shape;
          if (parsed.span && parsed.span > 1) existing.span = parsed.span;
        } else {
          itemById.set(parsed.id, parsed);
          items.push(parsed);
        }
      }
    }
  }

  return normalizeBlockData({
    diagramType: 'block',
    columns,
    items,
    edges,
    ...(comments.length > 0 ? { comments } : {}),
  });
}
