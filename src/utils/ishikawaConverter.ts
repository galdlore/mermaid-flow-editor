import type { IshikawaDiagramData, IshikawaNodeData } from '../types/editor';
import {
  allocateUniqueId,
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
} from './mermaidEnvelope.ts';

const MAX_ISHIKAWA_DEPTH = 16;

export function createDefaultIshikawaData(
  lang: 'ja' | 'en' = 'ja'
): IshikawaDiagramData {
  const isJa = lang === 'ja';
  return {
    diagramType: 'ishikawa',
    nodes: [
      {
        id: 'ish_root',
        depth: 0,
        label: isJa ? '品質低下の原因' : 'Low Product Quality',
      },
      { id: 'ish_1', depth: 1, label: isJa ? '人 (Man)' : 'People' },
      { id: 'ish_2', depth: 2, label: isJa ? '経験不足' : 'Lack of training' },
      { id: 'ish_3', depth: 2, label: isJa ? '引き継ぎ漏れ' : 'Poor handoff' },
      { id: 'ish_4', depth: 1, label: isJa ? '設備 (Machine)' : 'Machine' },
      { id: 'ish_5', depth: 2, label: isJa ? '装置設定ミス' : 'Misconfiguration' },
      { id: 'ish_6', depth: 2, label: isJa ? '経年劣化' : 'Hardware wear' },
      { id: 'ish_7', depth: 1, label: isJa ? '方法 (Method)' : 'Method' },
      { id: 'ish_8', depth: 2, label: isJa ? '手順書の不備' : 'Outdated SOP' },
      { id: 'ish_9', depth: 2, label: isJa ? '確認工程の欠如' : 'Missing review' },
      { id: 'ish_10', depth: 1, label: isJa ? '材料 (Material)' : 'Material' },
      { id: 'ish_11', depth: 2, label: isJa ? '品質のばらつき' : 'Inconsistent spec' },
    ],
  };
}

export function isValidIshikawaData(
  value: unknown
): value is IshikawaDiagramData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Partial<IshikawaDiagramData>;
  if (obj.diagramType !== 'ishikawa' || !Array.isArray(obj.nodes)) {
    return false;
  }
  return obj.nodes.every(
    (n) =>
      Boolean(n) &&
      typeof n === 'object' &&
      typeof n.id === 'string' &&
      typeof n.depth === 'number' &&
      typeof n.label === 'string'
  );
}

function sanitizeIshikawaLabel(raw: string): string {
  const singleLine = sanitizeSingleLineComment(raw);
  return singleLine.replace(/^%+/, '').trim();
}

export function normalizeIshikawaNodes(
  nodes: IshikawaNodeData[]
): IshikawaNodeData[] {
  if (nodes.length === 0) {
    return [];
  }
  const usedIds = new Set<string>();
  const result: IshikawaNodeData[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const raw = nodes[i];
    const baseId =
      raw.id && /^[a-zA-Z0-9_-]+$/.test(raw.id)
        ? raw.id
        : i === 0
          ? 'ish_root'
          : `ish_${i}`;
    const id = allocateUniqueId(baseId, usedIds);
    const maxAllowed =
      i === 0 ? 0 : Math.min(MAX_ISHIKAWA_DEPTH, result[i - 1].depth + 1);
    const depth =
      i === 0
        ? 0
        : Math.max(
            1,
            Math.min(
              maxAllowed,
              Math.round(Number.isFinite(raw.depth) ? raw.depth : 1)
            )
          );
    const label =
      sanitizeIshikawaLabel(raw.label) || (i === 0 ? 'Effect' : `Cause ${i}`);

    result.push({ id, depth, label });
  }
  return result;
}

export function normalizeIshikawaData(
  data: IshikawaDiagramData
): IshikawaDiagramData {
  const comments = Array.isArray(data.comments)
    ? data.comments
        .filter((c): c is string => typeof c === 'string')
        .map(sanitizeSingleLineComment)
        .filter((c) => c.length > 0)
    : undefined;
  return {
    diagramType: 'ishikawa',
    nodes: normalizeIshikawaNodes(data.nodes),
    ...(comments && comments.length > 0 ? { comments } : {}),
  };
}

export function getIshikawaSubtreeRange(
  nodes: IshikawaNodeData[],
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

export function canIndentIshikawaNode(
  nodes: IshikawaNodeData[],
  index: number
): boolean {
  if (index <= 0 || index >= nodes.length) {
    return false;
  }
  return nodes[index].depth <= nodes[index - 1].depth;
}

export function indentIshikawaNode(
  nodes: IshikawaNodeData[],
  index: number
): IshikawaNodeData[] {
  if (!canIndentIshikawaNode(nodes, index)) {
    return nodes;
  }
  const [, end] = getIshikawaSubtreeRange(nodes, index);
  const next = nodes.map((n, i) =>
    i >= index && i <= end ? { ...n, depth: n.depth + 1 } : n
  );
  return normalizeIshikawaNodes(next);
}

export function canOutdentIshikawaNode(
  nodes: IshikawaNodeData[],
  index: number
): boolean {
  if (index <= 0 || index >= nodes.length) {
    return false;
  }
  return nodes[index].depth > 1;
}

export function outdentIshikawaNode(
  nodes: IshikawaNodeData[],
  index: number
): IshikawaNodeData[] {
  if (!canOutdentIshikawaNode(nodes, index)) {
    return nodes;
  }
  const [, end] = getIshikawaSubtreeRange(nodes, index);
  const next = nodes.map((n, i) =>
    i >= index && i <= end ? { ...n, depth: Math.max(1, n.depth - 1) } : n
  );
  return normalizeIshikawaNodes(next);
}

export function canMoveIshikawaNode(
  nodes: IshikawaNodeData[],
  index: number,
  delta: -1 | 1
): boolean {
  if (index <= 0 || index >= nodes.length) {
    return false;
  }
  const [start, end] = getIshikawaSubtreeRange(nodes, index);
  if (delta === -1) {
    return start > 1;
  }
  return end < nodes.length - 1;
}

export function moveIshikawaNode(
  nodes: IshikawaNodeData[],
  index: number,
  delta: -1 | 1
): IshikawaNodeData[] {
  if (!canMoveIshikawaNode(nodes, index, delta)) {
    return nodes;
  }
  const [start, end] = getIshikawaSubtreeRange(nodes, index);
  const targetDepth = nodes[start].depth;
  const block = nodes.slice(start, end + 1);

  if (delta === -1) {
    let insertAt = start - 1;
    if (nodes[insertAt].depth >= targetDepth) {
      while (insertAt > 1 && nodes[insertAt].depth > targetDepth) {
        insertAt--;
      }
    }
    const next = [
      ...nodes.slice(0, insertAt),
      ...block,
      ...nodes.slice(insertAt, start),
      ...nodes.slice(end + 1),
    ];
    return normalizeIshikawaNodes(next);
  }

  let afterNext = end + 1;
  if (nodes[afterNext].depth >= targetDepth) {
    const [, nextSubtreeEnd] = getIshikawaSubtreeRange(nodes, afterNext);
    afterNext = nextSubtreeEnd + 1;
  } else {
    afterNext = end + 2;
  }
  const next = [
    ...nodes.slice(0, start),
    ...nodes.slice(end + 1, afterNext),
    ...block,
    ...nodes.slice(afterNext),
  ];
  return normalizeIshikawaNodes(next);
}

export function addChildIshikawaNode(
  nodes: IshikawaNodeData[],
  parentIndex: number,
  label: string
): { nodes: IshikawaNodeData[]; createdId: string } {
  const usedIds = new Set(nodes.map((n) => n.id));
  if (nodes.length === 0) {
    const createdId = allocateUniqueId('ish_root', usedIds);
    return {
      nodes: [{ id: createdId, depth: 0, label: sanitizeIshikawaLabel(label) || 'Effect' }],
      createdId,
    };
  }
  const safeParentIdx =
    parentIndex >= 0 && parentIndex < nodes.length ? parentIndex : 0;
  const parentDepth = nodes[safeParentIdx].depth;
  const [, subtreeEnd] = getIshikawaSubtreeRange(nodes, safeParentIdx);
  const insertAt = subtreeEnd + 1;
  const createdId = allocateUniqueId(`ish_${nodes.length + 1}`, usedIds);
  const newNode: IshikawaNodeData = {
    id: createdId,
    depth: parentDepth + 1,
    label: sanitizeIshikawaLabel(label) || 'Cause',
  };
  const next = normalizeIshikawaNodes([
    ...nodes.slice(0, insertAt),
    newNode,
    ...nodes.slice(insertAt),
  ]);
  return { nodes: next, createdId };
}

export function deleteIshikawaSubtree(
  nodes: IshikawaNodeData[],
  index: number
): IshikawaNodeData[] {
  if (index <= 0 || index >= nodes.length) {
    return nodes;
  }
  const [start, end] = getIshikawaSubtreeRange(nodes, index);
  return normalizeIshikawaNodes([
    ...nodes.slice(0, start),
    ...nodes.slice(end + 1),
  ]);
}

export function generateIshikawaCode(rawData: IshikawaDiagramData): string {
  const data = normalizeIshikawaData(rawData);
  const lines: string[] = ['ishikawa-beta'];

  for (const comment of data.comments ?? []) {
    const clean = sanitizeSingleLineComment(comment);
    if (clean) {
      lines.push(`%% ${clean}`);
    }
  }

  for (const node of data.nodes) {
    const indent = '    '.repeat(Math.max(0, node.depth));
    lines.push(`${indent}${node.label}`);
  }

  lines.push(formatGuiStateLine(data));
  return lines.join('\n');
}

export function parseIshikawaCodeToGuiData(code: string): IshikawaDiagramData {
  const lines = code.split(/\r?\n/);
  const fromGuiState = extractGuiStateJson(lines, isValidIshikawaData);
  if (fromGuiState) {
    return normalizeIshikawaData(fromGuiState);
  }

  const comments: string[] = [];
  const rawNodes: Array<{ indent: number; label: string }> = [];
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

    if (/^ishikawa(?:-beta)?\b/i.test(trimmed)) {
      continue;
    }

    const leadingSpaces = rawLine.length - rawLine.trimStart().length;
    const label = sanitizeIshikawaLabel(trimmed);
    if (label) {
      rawNodes.push({ indent: leadingSpaces, label });
    }
  }

  const nodes: IshikawaNodeData[] = [];
  if (rawNodes.length > 0) {
    // First node is always root (depth 0); map subsequent indentations cleanly
    const stack: number[] = [];
    nodes.push({ id: 'ish_root', depth: 0, label: rawNodes[0].label });
    for (let i = 1; i < rawNodes.length; i++) {
      const { indent, label } = rawNodes[i];
      while (stack.length > 0 && stack[stack.length - 1] >= indent) {
        stack.pop();
      }
      stack.push(indent);
      nodes.push({
        id: `ish_${i}`,
        depth: stack.length,
        label,
      });
    }
  }

  return normalizeIshikawaData({
    diagramType: 'ishikawa',
    nodes,
    ...(comments.length > 0 ? { comments } : {}),
  });
}
