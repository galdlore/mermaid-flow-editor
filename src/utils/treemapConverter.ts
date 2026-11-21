import type {
  TreemapClassDefData,
  TreemapDiagramData,
  TreemapNodeData,
  TreemapNodeKind,
} from '../types/editor.ts';
import { sanitizeCssColor } from './inputSafeguard.ts';
import {
  allocateUniqueId,
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
} from './mermaidEnvelope.ts';

const MAX_TREEMAP_DEPTH = 12;

export function sanitizeTreemapText(raw: string): string {
  return raw.replace(/["\r\n]+/g, ' ').trim();
}

export function normalizeTreemapClassName(raw: string): string {
  let clean = raw.trim().replace(/[^a-zA-Z0-9_]/g, '_');
  if (!clean) {
    return '';
  }
  if (!/^[a-zA-Z_]/.test(clean)) {
    clean = `c_${clean}`;
  }
  if (clean.length < 2) {
    clean = `${clean}_cls`;
  }
  return clean;
}

export function createDefaultTreemapData(
  lang: 'ja' | 'en' = 'ja'
): TreemapDiagramData {
  const isJa = lang === 'ja';
  return {
    diagramType: 'treemap',
    title: isJa ? '事業別売上構成' : 'Revenue Breakdown',
    nodes: [
      { id: 'tm_1', depth: 0, kind: 'section', label: isJa ? '全社売上' : 'Total Revenue' },
      { id: 'tm_2', depth: 1, kind: 'section', label: isJa ? 'クラウド事業' : 'Cloud Services' },
      { id: 'tm_3', depth: 2, kind: 'leaf', label: 'SaaS', value: 45, className: 'highlight' },
      { id: 'tm_4', depth: 2, kind: 'leaf', label: isJa ? '保守サポート' : 'Support', value: 20 },
      { id: 'tm_5', depth: 1, kind: 'leaf', label: isJa ? '導入支援' : 'Consulting', value: 35 },
    ],
    classDefs: [
      { name: 'highlight', fill: '#dbeafe', stroke: '#2563eb', color: '#1e3a8a' },
    ],
  };
}

export function isValidTreemapData(value: unknown): value is TreemapDiagramData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Partial<TreemapDiagramData>;
  if (obj.diagramType !== 'treemap' || !Array.isArray(obj.nodes)) {
    return false;
  }
  return obj.nodes.every(
    (n) =>
      Boolean(n) &&
      typeof n === 'object' &&
      typeof n.id === 'string' &&
      typeof n.depth === 'number' &&
      (n.kind === 'section' || n.kind === 'leaf') &&
      typeof n.label === 'string'
  );
}

export function normalizeTreemapNodes(nodes: TreemapNodeData[]): TreemapNodeData[] {
  if (nodes.length === 0) {
    return [];
  }
  const usedIds = new Set<string>();
  const preliminary: TreemapNodeData[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const raw = nodes[i];
    const baseId =
      raw.id && /^[a-zA-Z0-9_-]+$/.test(raw.id) ? raw.id : `tm_${i + 1}`;
    const id = allocateUniqueId(baseId, usedIds);
    const maxAllowed =
      i === 0 ? 0 : Math.min(MAX_TREEMAP_DEPTH, preliminary[i - 1].depth + 1);
    const depth =
      i === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              maxAllowed,
              Math.round(Number.isFinite(raw.depth) ? raw.depth : 0)
            )
          );
    const label = sanitizeTreemapText(raw.label) || `Item ${i + 1}`;
    const cls = raw.className ? normalizeTreemapClassName(raw.className) : '';
    const value =
      raw.kind === 'leaf'
        ? Math.max(0.01, Number.isFinite(raw.value) ? Number(raw.value) : 10)
        : undefined;

    preliminary.push({
      id,
      depth,
      kind: raw.kind === 'leaf' ? 'leaf' : 'section',
      label,
      ...(value !== undefined ? { value } : {}),
      ...(cls ? { className: cls } : {}),
    });
  }

  return preliminary.map((node, idx) => {
    const hasChild =
      idx + 1 < preliminary.length && preliminary[idx + 1].depth > node.depth;
    if (hasChild) {
      return {
        id: node.id,
        depth: node.depth,
        kind: 'section',
        label: node.label,
        ...(node.className ? { className: node.className } : {}),
      };
    }
    if (node.kind === 'leaf') {
      return {
        ...node,
        value: node.value ?? 10,
      };
    }
    return node;
  });
}

export function normalizeTreemapData(raw: TreemapDiagramData): TreemapDiagramData {
  const title = raw.title ? sanitizeTreemapText(raw.title) : '';
  const classDefs: TreemapClassDefData[] = [];
  const usedClassNames = new Set<string>();

  for (const cd of raw.classDefs ?? []) {
    const name = normalizeTreemapClassName(cd.name);
    if (!name || usedClassNames.has(name)) {
      continue;
    }
    usedClassNames.add(name);
    const fill = sanitizeCssColor(cd.fill) ?? '#dbeafe';
    const stroke = sanitizeCssColor(cd.stroke) ?? '#2563eb';
    const color = cd.color ? sanitizeCssColor(cd.color) : undefined;
    classDefs.push({
      name,
      fill,
      stroke,
      ...(color ? { color } : {}),
    });
  }

  const validClasses = new Set(classDefs.map((cd) => cd.name));
  const nodes = normalizeTreemapNodes(raw.nodes).map((n) =>
    n.className && validClasses.has(n.className)
      ? n
      : {
          id: n.id,
          depth: n.depth,
          kind: n.kind,
          label: n.label,
          ...(n.value !== undefined ? { value: n.value } : {}),
        }
  );

  const comments = Array.isArray(raw.comments)
    ? raw.comments
        .filter((c): c is string => typeof c === 'string')
        .map(sanitizeSingleLineComment)
        .filter((c) => c.length > 0)
    : undefined;

  return {
    diagramType: 'treemap',
    ...(title ? { title } : {}),
    nodes,
    ...(classDefs.length > 0 ? { classDefs } : {}),
    ...(comments && comments.length > 0 ? { comments } : {}),
  };
}

export function getTreemapSubtreeRange(
  nodes: TreemapNodeData[],
  index: number
): [number, number] {
  if (index < 0 || index >= nodes.length) {
    return [index, index];
  }
  const baseDepth = nodes[index].depth;
  let end = index;
  while (end + 1 < nodes.length && nodes[end + 1].depth > baseDepth) {
    end++;
  }
  return [index, end];
}

export function canIndentTreemapNode(nodes: TreemapNodeData[], index: number): boolean {
  if (index <= 0 || index >= nodes.length) {
    return false;
  }
  return nodes[index].depth <= nodes[index - 1].depth;
}

export function indentTreemapNode(
  nodes: TreemapNodeData[],
  index: number
): TreemapNodeData[] {
  if (!canIndentTreemapNode(nodes, index)) {
    return nodes;
  }
  const [, end] = getTreemapSubtreeRange(nodes, index);
  const next = nodes.map((n, i) =>
    i >= index && i <= end ? { ...n, depth: n.depth + 1 } : n
  );
  return normalizeTreemapNodes(next);
}

export function canOutdentTreemapNode(nodes: TreemapNodeData[], index: number): boolean {
  if (index < 0 || index >= nodes.length) {
    return false;
  }
  return nodes[index].depth > 0;
}

export function outdentTreemapNode(
  nodes: TreemapNodeData[],
  index: number
): TreemapNodeData[] {
  if (!canOutdentTreemapNode(nodes, index)) {
    return nodes;
  }
  const [, end] = getTreemapSubtreeRange(nodes, index);
  const next = nodes.map((n, i) =>
    i >= index && i <= end ? { ...n, depth: Math.max(0, n.depth - 1) } : n
  );
  return normalizeTreemapNodes(next);
}

export function canMoveTreemapNode(
  nodes: TreemapNodeData[],
  index: number,
  delta: -1 | 1
): boolean {
  if (index < 0 || index >= nodes.length) {
    return false;
  }
  const [start, end] = getTreemapSubtreeRange(nodes, index);
  const depth = nodes[index].depth;
  if (delta === -1) {
    let cursor = start - 1;
    while (cursor >= 0 && nodes[cursor].depth > depth) {
      cursor--;
    }
    return cursor >= 0 && nodes[cursor].depth === depth;
  }
  return end + 1 < nodes.length && nodes[end + 1].depth === depth;
}

export function moveTreemapNode(
  nodes: TreemapNodeData[],
  index: number,
  delta: -1 | 1
): TreemapNodeData[] {
  if (!canMoveTreemapNode(nodes, index, delta)) {
    return nodes;
  }
  const [start, end] = getTreemapSubtreeRange(nodes, index);
  const depth = nodes[index].depth;
  const moving = nodes.slice(start, end + 1);

  if (delta === -1) {
    let prevStart = start - 1;
    while (prevStart >= 0 && nodes[prevStart].depth > depth) {
      prevStart--;
    }
    const prevBlock = nodes.slice(prevStart, start);
    return normalizeTreemapNodes([
      ...nodes.slice(0, prevStart),
      ...moving,
      ...prevBlock,
      ...nodes.slice(end + 1),
    ]);
  }

  const nextIdx = end + 1;
  const [, nextEnd] = getTreemapSubtreeRange(nodes, nextIdx);
  const nextBlock = nodes.slice(nextIdx, nextEnd + 1);
  return normalizeTreemapNodes([
    ...nodes.slice(0, start),
    ...nextBlock,
    ...moving,
    ...nodes.slice(nextEnd + 1),
  ]);
}

export function addTreemapChildNode(
  nodes: TreemapNodeData[],
  parentIndex: number,
  kind: TreemapNodeKind,
  label: string,
  value = 20
): { nodes: TreemapNodeData[]; createdId: string } {
  const usedIds = new Set(nodes.map((n) => n.id));
  if (nodes.length === 0 || parentIndex < 0 || parentIndex >= nodes.length) {
    const createdId = allocateUniqueId(`tm_${nodes.length + 1}`, usedIds);
    const created: TreemapNodeData = {
      id: createdId,
      depth: 0,
      kind,
      label: sanitizeTreemapText(label) || 'Item',
      ...(kind === 'leaf' ? { value: Math.max(0.01, value) } : {}),
    };
    return {
      nodes: normalizeTreemapNodes([...nodes, created]),
      createdId,
    };
  }

  const [, subtreeEnd] = getTreemapSubtreeRange(nodes, parentIndex);
  const insertAt = subtreeEnd + 1;
  const createdId = allocateUniqueId(`tm_${nodes.length + 1}`, usedIds);
  const parentDepth = nodes[parentIndex].depth;
  const created: TreemapNodeData = {
    id: createdId,
    depth: Math.min(MAX_TREEMAP_DEPTH, parentDepth + 1),
    kind,
    label: sanitizeTreemapText(label) || 'Item',
    ...(kind === 'leaf' ? { value: Math.max(0.01, value) } : {}),
  };

  const next = normalizeTreemapNodes([
    ...nodes.slice(0, insertAt),
    created,
    ...nodes.slice(insertAt),
  ]);
  return { nodes: next, createdId };
}

export function deleteTreemapSubtree(
  nodes: TreemapNodeData[],
  index: number
): TreemapNodeData[] {
  if (index < 0 || index >= nodes.length) {
    return nodes;
  }
  const [start, end] = getTreemapSubtreeRange(nodes, index);
  return normalizeTreemapNodes([
    ...nodes.slice(0, start),
    ...nodes.slice(end + 1),
  ]);
}

export function generateTreemapCode(rawData: TreemapDiagramData): string {
  const data = normalizeTreemapData(rawData);
  const lines: string[] = ['treemap-beta'];

  if (data.title) {
    lines.push(`title ${data.title}`);
  }

  for (const node of data.nodes) {
    const indent = '    '.repeat(node.depth);
    const cls = node.className ? `:::${node.className}` : '';
    if (node.kind === 'leaf') {
      const val = Number.isInteger(node.value)
        ? String(node.value)
        : String(Number((node.value ?? 10).toFixed(2)));
      lines.push(`${indent}"${node.label}": ${val}${cls}`);
    } else {
      lines.push(`${indent}"${node.label}"${cls}`);
    }
  }

  for (const cd of data.classDefs ?? []) {
    const parts = [`fill:${cd.fill}`, `stroke:${cd.stroke}`];
    if (cd.color) {
      parts.push(`color:${cd.color}`);
    }
    lines.push(`classDef ${cd.name} ${parts.join(',')}`);
  }

  for (const comment of data.comments ?? []) {
    const clean = sanitizeSingleLineComment(comment);
    if (clean) {
      lines.push(`%% ${clean}`);
    }
  }

  lines.push(formatGuiStateLine(data));
  return lines.join('\n');
}

export function parseTreemapCodeToGuiData(code: string): TreemapDiagramData {
  const lines = code.split(/\r?\n/);
  const fromGuiState = extractGuiStateJson(lines, isValidTreemapData);
  if (fromGuiState) {
    return normalizeTreemapData(fromGuiState);
  }

  const rawRows: Array<{
    indent: number;
    kind: TreemapNodeKind;
    label: string;
    value?: number;
    className?: string;
  }> = [];
  const classDefs: TreemapClassDefData[] = [];
  const comments: string[] = [];
  let title = '';
  let inFrontmatter = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].replace(/\t/g, '    ');
    const trimmed = rawLine.trim();
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
    if (/^treemap(?:-beta)?\b/i.test(trimmed) || /^acc(?:Title|Descr)\b/i.test(trimmed)) {
      continue;
    }
    const titleMatch = /^title\s+(.+)$/i.exec(trimmed);
    if (titleMatch) {
      title = sanitizeTreemapText(titleMatch[1]);
      continue;
    }
    const classDefMatch =
      /^classDef\s+([a-zA-Z_][a-zA-Z0-9_]+)\s+([^\r\n;]+);?$/.exec(trimmed);
    if (classDefMatch) {
      const stylePairs = classDefMatch[2].split(',');
      let fill = '#dbeafe';
      let stroke = '#2563eb';
      let color: string | undefined;
      for (const pair of stylePairs) {
        const [k, v] = pair.split(':').map((s) => s.trim());
        if (k === 'fill' && v) fill = v;
        if (k === 'stroke' && v) stroke = v;
        if (k === 'color' && v) color = v;
      }
      classDefs.push({
        name: classDefMatch[1],
        fill,
        stroke,
        ...(color ? { color } : {}),
      });
      continue;
    }

    const leafMatch =
      /^(?:"([^"]*)"|'([^']*)')\s*[:,]\s*([0-9_.,]+)(?::::([a-zA-Z_][a-zA-Z0-9_]*))?\s*$/.exec(
        trimmed
      );
    const leading = rawLine.length - rawLine.trimStart().length;
    if (leafMatch) {
      const label = sanitizeTreemapText(leafMatch[1] ?? leafMatch[2] ?? '');
      const num = Number(leafMatch[3].replace(/_/g, ''));
      if (label) {
        rawRows.push({
          indent: leading,
          kind: 'leaf',
          label,
          value: Number.isFinite(num) ? num : 10,
          ...(leafMatch[4] ? { className: leafMatch[4] } : {}),
        });
      }
      continue;
    }

    const secMatch =
      /^(?:"([^"]*)"|'([^']*)')(?::::([a-zA-Z_][a-zA-Z0-9_]*))?\s*$/.exec(trimmed);
    if (secMatch) {
      const label = sanitizeTreemapText(secMatch[1] ?? secMatch[2] ?? '');
      if (label) {
        rawRows.push({
          indent: leading,
          kind: 'section',
          label,
          ...(secMatch[3] ? { className: secMatch[3] } : {}),
        });
      }
    }
  }

  const indentStack: number[] = [];
  const nodes: TreemapNodeData[] = [];
  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (indentStack.length === 0) {
      indentStack.push(row.indent);
    } else if (row.indent > indentStack[indentStack.length - 1]) {
      indentStack.push(row.indent);
    } else {
      while (
        indentStack.length > 1 &&
        indentStack[indentStack.length - 1] > row.indent
      ) {
        indentStack.pop();
      }
      if (indentStack[indentStack.length - 1] !== row.indent) {
        indentStack[indentStack.length - 1] = row.indent;
      }
    }
    const depth = Math.max(0, indentStack.length - 1);
    nodes.push({
      id: `tm_${i + 1}`,
      depth,
      kind: row.kind,
      label: row.label,
      ...(row.value !== undefined ? { value: row.value } : {}),
      ...(row.className ? { className: row.className } : {}),
    });
  }

  return normalizeTreemapData({
    diagramType: 'treemap',
    ...(title ? { title } : {}),
    nodes,
    ...(classDefs.length > 0 ? { classDefs } : {}),
    ...(comments.length > 0 ? { comments } : {}),
  });
}
