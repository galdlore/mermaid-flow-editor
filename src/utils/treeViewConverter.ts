import type {
  TreeViewConfigData,
  TreeViewDiagramData,
  TreeViewIconOption,
  TreeViewNodeData,
  TreeViewNodeType,
} from '../types/editor';
import {
  GUI_STATE_PREFIX,
  allocateUniqueId,
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
} from './mermaidEnvelope.ts';

export const DEFAULT_TREE_VIEW_CONFIG: Readonly<TreeViewConfigData> = {
  showIcons: false,
  rowIndent: 10,
  lineThickness: 1,
  paddingX: 5,
  paddingY: 5,
};

export function createDefaultTreeViewData(lang: 'ja' | 'en' = 'ja'): TreeViewDiagramData {
  const isJa = lang === 'ja';
  return {
    diagramType: 'treeView',
    title: '',
    config: {
      showIcons: true,
      rowIndent: 14,
      lineThickness: 1,
      paddingX: 5,
      paddingY: 5,
    },
    nodes: [
      {
        id: 'tree_1',
        depth: 0,
        name: 'my-app',
        nodeType: 'directory',
        description: isJa ? 'ルートフォルダ' : 'Root folder',
      },
      {
        id: 'tree_2',
        depth: 1,
        name: 'src',
        nodeType: 'directory',
        highlight: true,
        description: isJa ? 'ソースコード' : 'Source files',
      },
      {
        id: 'tree_3',
        depth: 2,
        name: 'index.ts',
        nodeType: 'file',
        description: isJa ? 'エントリーポイント' : 'Entry point',
      },
      {
        id: 'tree_4',
        depth: 2,
        name: 'App.tsx',
        nodeType: 'file',
      },
      {
        id: 'tree_5',
        depth: 1,
        name: 'README.md',
        nodeType: 'file',
        description: isJa ? 'プロジェクト説明' : 'Documentation',
      },
    ],
  };
}

const MAX_TREE_DEPTH = 32;
const VALID_TREE_ICONS = new Set<TreeViewIconOption>(['auto', 'folder', 'file', 'none']);

function clampTreeInt(raw: unknown, fallback: number, min: number, max: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(raw)));
}

export function isValidTreeViewData(value: unknown): value is TreeViewDiagramData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Partial<TreeViewDiagramData>;
  if (
    obj.diagramType !== 'treeView' ||
    !obj.config ||
    typeof obj.config !== 'object' ||
    !Array.isArray(obj.nodes)
  ) {
    return false;
  }
  return obj.nodes.every(
    (node) =>
      Boolean(node) &&
      typeof node === 'object' &&
      typeof node.id === 'string' &&
      typeof node.name === 'string' &&
      typeof node.depth === 'number'
  );
}

export function normalizeTreeViewData(data: TreeViewDiagramData): TreeViewDiagramData {
  const rawConfig = data.config as Partial<TreeViewConfigData> | undefined;
  const config: TreeViewConfigData = {
    showIcons: Boolean(rawConfig?.showIcons),
    rowIndent: clampTreeInt(
      rawConfig?.rowIndent,
      DEFAULT_TREE_VIEW_CONFIG.rowIndent,
      0,
      100
    ),
    lineThickness: clampTreeInt(
      rawConfig?.lineThickness,
      DEFAULT_TREE_VIEW_CONFIG.lineThickness,
      1,
      20
    ),
    paddingX: clampTreeInt(
      rawConfig?.paddingX,
      DEFAULT_TREE_VIEW_CONFIG.paddingX,
      0,
      100
    ),
    paddingY: clampTreeInt(
      rawConfig?.paddingY,
      DEFAULT_TREE_VIEW_CONFIG.paddingY,
      0,
      100
    ),
  };

  const usedIds = new Set<string>();
  const nodes: TreeViewNodeData[] = [];
  for (let i = 0; i < data.nodes.length; i++) {
    const raw = data.nodes[i];
    const baseId =
      raw.id && /^[a-zA-Z0-9_-]+$/.test(raw.id) ? raw.id : `tree_${i + 1}`;
    const id = allocateUniqueId(baseId, usedIds);
    const maxAllowedDepth =
      i === 0 ? 0 : Math.min(MAX_TREE_DEPTH, nodes[i - 1].depth + 1);
    const depth = clampTreeInt(raw.depth, 0, 0, maxAllowedDepth);
    const name = sanitizeSingleLineComment(raw.name) || 'item';
    const nodeType: TreeViewNodeType =
      raw.nodeType === 'directory' ? 'directory' : 'file';
    const description =
      typeof raw.description === 'string'
        ? sanitizeSingleLineComment(raw.description)
        : '';
    const icon =
      raw.icon && VALID_TREE_ICONS.has(raw.icon) ? raw.icon : undefined;

    nodes.push({
      id,
      depth,
      name,
      nodeType,
      ...(description ? { description } : {}),
      ...(raw.highlight ? { highlight: true } : {}),
      ...(icon ? { icon } : {}),
    });
  }

  const title =
    typeof data.title === 'string' ? sanitizeSingleLineComment(data.title) : '';
  const comments = Array.isArray(data.comments)
    ? data.comments
        .filter((c): c is string => typeof c === 'string')
        .map(sanitizeSingleLineComment)
        .filter((c) => c.length > 0)
    : undefined;

  return {
    diagramType: 'treeView',
    ...(title ? { title } : {}),
    config,
    nodes,
    ...(comments && comments.length > 0 ? { comments } : {}),
  };
}

/**
 * Node名とアノテーションをMermaid treeView-betaの1行へ整形する。
 */
function formatTreeNodeName(name: string, nodeType: TreeViewNodeType): string {
  const cleanedBase = name.trim().replace(/\/+$/, '') || 'item';
  const rawToken = nodeType === 'directory' ? `${cleanedBase}/` : cleanedBase;
  const needsQuotes = /[\s#:()'"]|^(?:icon\(|:::|##)/.test(rawToken);
  if (!needsQuotes) {
    return rawToken;
  }
  const safeQuoted = rawToken.replace(/"/g, "'");
  return `"${safeQuoted}"`;
}

/**
 * デフォルト設定から変更されている設定項目だけを %%{init: ...}%% 用オブジェクトとして返す。
 */
function buildNonDefaultTreeConfig(
  config: TreeViewConfigData
): Partial<TreeViewConfigData> | null {
  const diff: Partial<TreeViewConfigData> = {};
  if (config.showIcons !== DEFAULT_TREE_VIEW_CONFIG.showIcons) {
    diff.showIcons = config.showIcons;
  }
  if (config.rowIndent !== DEFAULT_TREE_VIEW_CONFIG.rowIndent) {
    diff.rowIndent = config.rowIndent;
  }
  if (config.lineThickness !== DEFAULT_TREE_VIEW_CONFIG.lineThickness) {
    diff.lineThickness = config.lineThickness;
  }
  if (config.paddingX !== DEFAULT_TREE_VIEW_CONFIG.paddingX) {
    diff.paddingX = config.paddingX;
  }
  if (config.paddingY !== DEFAULT_TREE_VIEW_CONFIG.paddingY) {
    diff.paddingY = config.paddingY;
  }
  return Object.keys(diff).length > 0 ? diff : null;
}

export function generateTreeViewCode(rawData: TreeViewDiagramData): string {
  const data = normalizeTreeViewData(rawData);
  const lines: string[] = [];

  const configDiff = buildNonDefaultTreeConfig(data.config);
  if (configDiff) {
    lines.push(`%%{init: ${JSON.stringify({ treeView: configDiff })}}%%`);
  }

  lines.push('treeView-beta');

  if (data.title && data.title.trim()) {
    lines.push(`title ${data.title.trim()}`);
  }

  for (const comment of data.comments ?? []) {
    const cleanComment = sanitizeSingleLineComment(comment);
    if (cleanComment) {
      lines.push(`%% ${cleanComment}`);
    }
  }

  for (const node of data.nodes) {
    const indent = '    '.repeat(Math.max(0, node.depth));
    const parts: string[] = [formatTreeNodeName(node.name, node.nodeType)];

    if (node.highlight) {
      parts.push(':::highlight');
    }

    if (node.icon && node.icon !== 'auto') {
      parts.push(node.icon === 'none' ? 'icon()' : `icon(${node.icon})`);
    }

    if (node.description && node.description.trim()) {
      parts.push(`## ${node.description.trim()}`);
    }

    lines.push(`${indent}${parts.join(' ')}`);
  }

  lines.push(formatGuiStateLine(data));
  return lines.join('\n');
}

const ALL_BOX_CHARS = /[─━│┃└┗├┣]/;
const BRANCH_CHAR = /[└┗├┣]/;
const DASH_CHAR = /[─━]/;
const DECORATION_ONLY = /^[\s│┃]+$/;

function preprocessBoxDrawingLines(bodyLines: string[]): string[] {
  const expanded = bodyLines.map((line) => line.replace(/\t/g, '    '));
  const hasBox = expanded.some((line) => ALL_BOX_CHARS.test(line));
  if (!hasBox) {
    return expanded;
  }

  let segmentWidth = 4;
  for (const line of expanded) {
    const match = BRANCH_CHAR.exec(line);
    if (match?.index && match.index > 0) {
      segmentWidth = match.index;
      break;
    }
  }

  const normalizedLines: string[] = [];
  for (const line of expanded) {
    const trimmed = line.trim();
    if (!trimmed || DECORATION_ONLY.test(line)) {
      continue;
    }
    const branchMatch = BRANCH_CHAR.exec(line);
    if (branchMatch?.index !== undefined) {
      const branchCol = branchMatch.index;
      const depth = Math.round(branchCol / segmentWidth) + 1;
      let pos = branchCol + 1;
      while (pos < line.length && DASH_CHAR.test(line[pos])) {
        pos++;
      }
      while (pos < line.length && line[pos] === ' ') {
        pos++;
      }
      const content = line.slice(pos).trimEnd();
      if (content) {
        normalizedLines.push(`${'    '.repeat(depth)}${content}`);
      }
      continue;
    }
    if (/^[\s─━│┃└┗├┣]+$/.test(line)) {
      continue;
    }
    normalizedLines.push(line);
  }
  return normalizedLines;
}

function parseTreeNodeContent(
  content: string
): {
  name: string;
  nodeType: TreeViewNodeType;
  highlight: boolean;
  icon?: TreeViewIconOption;
  description?: string;
} | null {
  let rest = content.trim();
  if (!rest) {
    return null;
  }

  let description: string | undefined;
  let icon: TreeViewIconOption | undefined;
  let highlight = false;

  // 先頭の名前部分をクォート有無で切り出す
  let rawName = '';
  if (
    (rest.startsWith('"') && rest.indexOf('"', 1) !== -1) ||
    (rest.startsWith("'") && rest.indexOf("'", 1) !== -1)
  ) {
    const quote = rest[0];
    const closeIdx = rest.indexOf(quote, 1);
    rawName = rest.slice(1, closeIdx);
    rest = rest.slice(closeIdx + 1).trim();
  } else {
    const annotationMatch = rest.match(/[ \t]+(?::::|icon\(|##)/);
    if (annotationMatch?.index !== undefined) {
      rawName = rest.slice(0, annotationMatch.index).trim();
      rest = rest.slice(annotationMatch.index).trim();
    } else {
      rawName = rest;
      rest = '';
    }
  }

  // ## description を先に分離（後ろはすべて説明テキスト扱い）
  const descMatch = rest.match(/(?:^|\s)##\s*(.*)$/);
  if (descMatch && descMatch.index !== undefined) {
    const descText = descMatch[1].trim();
    if (descText) {
      description = descText;
    }
    rest = rest.slice(0, descMatch.index).trim();
  }

  const classMatch = rest.match(/(?:^|\s):::\s*([a-zA-Z_][\w-]*)/);
  if (classMatch) {
    if (classMatch[1] === 'highlight') {
      highlight = true;
    }
    rest = rest.replace(classMatch[0], ' ').trim();
  }

  const iconMatch = rest.match(/(?:^|\s)icon\(([\w-]*(?::[\w-]+)?)\)/);
  if (iconMatch) {
    const iconName = iconMatch[1];
    if (iconName === '') {
      icon = 'none';
    } else if (iconName === 'folder' || iconName === 'file') {
      icon = iconName;
    }
  }

  const isDirectory = rawName.endsWith('/');
  const cleanName = isDirectory ? rawName.slice(0, -1) : rawName;
  if (!cleanName) {
    return null;
  }

  return {
    name: cleanName,
    nodeType: isDirectory ? 'directory' : 'file',
    highlight,
    ...(icon ? { icon } : {}),
    ...(description ? { description } : {}),
  };
}

function applyInitTreeConfig(
  rawJson: string,
  target: TreeViewConfigData
): void {
  try {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      const normalized = rawJson.replace(
        /([\{,]\s*)(['"]?)([a-zA-Z_][a-zA-Z0-9_]*)\2\s*:/g,
        '$1"$3":'
      );
      parsed = JSON.parse(normalized);
    }
    if (!parsed || typeof parsed !== 'object') {
      return;
    }
    const tv = (parsed as { treeView?: Record<string, unknown> }).treeView;
    if (!tv || typeof tv !== 'object') {
      return;
    }
    if (typeof tv.showIcons === 'boolean') target.showIcons = tv.showIcons;
    if (typeof tv.rowIndent === 'number') target.rowIndent = tv.rowIndent;
    if (typeof tv.lineThickness === 'number') target.lineThickness = tv.lineThickness;
    if (typeof tv.paddingX === 'number') target.paddingX = tv.paddingX;
    if (typeof tv.paddingY === 'number') target.paddingY = tv.paddingY;
  } catch {
    // initディレクティブ解析失敗時はデフォルト値を維持する
  }
}

export function parseTreeViewCodeToGuiData(code: string): TreeViewDiagramData {
  const lines = code.split(/\r?\n/);

  // 1. %% @gui-state: からの完全復元を優先する
  const restored = extractGuiStateJson(lines, isValidTreeViewData);
  if (restored) {
    return normalizeTreeViewData(restored);
  }

  const config: TreeViewConfigData = { ...DEFAULT_TREE_VIEW_CONFIG };
  const comments: string[] = [];
  let title = '';
  const rawBodyLines: string[] = [];
  let seenHeader = false;
  let inFrontmatter = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (i === 0 && trimmed === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (trimmed === '---') {
        inFrontmatter = false;
        continue;
      }
      const boolMatch = trimmed.match(/^showIcons:\s*(true|false)\s*$/i);
      if (boolMatch) {
        config.showIcons = boolMatch[1].toLowerCase() === 'true';
      }
      const numMatch = trimmed.match(/^(rowIndent|lineThickness|paddingX|paddingY):\s*(\d+)\s*$/);
      if (numMatch) {
        config[numMatch[1] as 'rowIndent' | 'lineThickness' | 'paddingX' | 'paddingY'] =
          Number.parseInt(numMatch[2], 10);
      }
      continue;
    }

    const initMatch = trimmed.match(/^%%\{\s*init\s*:\s*([\s\S]*?)\s*\}%%$/);
    if (initMatch) {
      applyInitTreeConfig(initMatch[1], config);
      continue;
    }

    if (trimmed.startsWith('%%')) {
      if (!trimmed.startsWith(GUI_STATE_PREFIX)) {
        const commentBody = trimmed.slice(2).trim();
        if (commentBody) {
          comments.push(commentBody);
        }
      }
      continue;
    }

    if (!seenHeader) {
      if (!trimmed) {
        continue;
      }
      if (/^treeView-beta\b/i.test(trimmed)) {
        seenHeader = true;
      }
      continue;
    }

    if (/^title(?:\s+(.*))?$/i.test(trimmed)) {
      const m = trimmed.match(/^title(?:\s+(.*))?$/i);
      if (m?.[1]) {
        title = m[1].trim();
      }
      continue;
    }

    if (/^(?:accTitle|accDescr)\b/i.test(trimmed)) {
      continue;
    }

    rawBodyLines.push(rawLine);
  }

  const normalizedLines = preprocessBoxDrawingLines(rawBodyLines);
  const nodes: TreeViewNodeData[] = [];
  const indentStack: number[] = [-1];

  for (const line of normalizedLines) {
    const expanded = line.replace(/\t/g, '    ');
    const trimmed = expanded.trim();
    if (!trimmed) {
      continue;
    }

    const indentMatch = expanded.match(/^ */);
    const indentLen = indentMatch ? indentMatch[0].length : 0;

    while (indentStack.length > 1 && indentLen <= indentStack[indentStack.length - 1]) {
      indentStack.pop();
    }
    const depth = indentStack.length - 1;
    indentStack.push(indentLen);

    const parsedNode = parseTreeNodeContent(trimmed);
    if (!parsedNode) {
      continue;
    }

    nodes.push({
      id: `tree_${nodes.length + 1}`,
      depth,
      name: parsedNode.name,
      nodeType: parsedNode.nodeType,
      ...(parsedNode.highlight ? { highlight: true } : {}),
      ...(parsedNode.icon ? { icon: parsedNode.icon } : {}),
      ...(parsedNode.description ? { description: parsedNode.description } : {}),
    });
  }

  return normalizeTreeViewData({
    diagramType: 'treeView',
    ...(title ? { title } : {}),
    config,
    nodes,
    ...(comments.length > 0 ? { comments } : {}),
  });
}

/**
 * 配列内の index を根とする部分木の末尾インデックスを返す。
 */
export function getSubtreeEndIndex(
  nodes: ReadonlyArray<TreeViewNodeData>,
  index: number
): number {
  const rootDepth = nodes[index]?.depth ?? 0;
  let end = index;
  while (end + 1 < nodes.length && nodes[end + 1].depth > rootDepth) {
    end++;
  }
  return end;
}

export function canIndentTreeNode(
  nodes: ReadonlyArray<TreeViewNodeData>,
  index: number
): boolean {
  if (index <= 0 || index >= nodes.length) {
    return false;
  }
  return nodes[index].depth <= nodes[index - 1].depth;
}

export function indentTreeNode(
  nodes: ReadonlyArray<TreeViewNodeData>,
  index: number
): TreeViewNodeData[] {
  if (!canIndentTreeNode(nodes, index)) {
    return [...nodes];
  }
  const end = getSubtreeEndIndex(nodes, index);
  return nodes.map((node, i) =>
    i >= index && i <= end ? { ...node, depth: node.depth + 1 } : node
  );
}

export function canOutdentTreeNode(
  nodes: ReadonlyArray<TreeViewNodeData>,
  index: number
): boolean {
  if (index < 0 || index >= nodes.length) {
    return false;
  }
  return nodes[index].depth > 0;
}

export function outdentTreeNode(
  nodes: ReadonlyArray<TreeViewNodeData>,
  index: number
): TreeViewNodeData[] {
  if (!canOutdentTreeNode(nodes, index)) {
    return [...nodes];
  }
  const currentDepth = nodes[index].depth;
  const end = getSubtreeEndIndex(nodes, index);

  // 親を探し、親の部分木末尾より前にいるなら末尾へ移動して階層整合性を保つ
  let parentIdx = -1;
  for (let i = index - 1; i >= 0; i--) {
    if (nodes[i].depth < currentDepth) {
      parentIdx = i;
      break;
    }
  }

  if (parentIdx === -1) {
    return nodes.map((node, i) =>
      i >= index && i <= end
        ? { ...node, depth: Math.max(0, node.depth - 1) }
        : node
    );
  }

  const parentEnd = getSubtreeEndIndex(nodes, parentIdx);
  const subtree = nodes
    .slice(index, end + 1)
    .map((n) => ({ ...n, depth: Math.max(0, n.depth - 1) }));

  if (end === parentEnd) {
    return [...nodes.slice(0, index), ...subtree, ...nodes.slice(end + 1)];
  }

  const before = nodes.slice(0, index);
  const afterWithinParent = nodes.slice(end + 1, parentEnd + 1);
  const rest = nodes.slice(parentEnd + 1);
  return [...before, ...afterWithinParent, ...subtree, ...rest];
}

function findPrevSiblingIndex(
  nodes: ReadonlyArray<TreeViewNodeData>,
  index: number
): number {
  if (index <= 0 || index >= nodes.length) {
    return -1;
  }
  const targetDepth = nodes[index].depth;
  for (let i = index - 1; i >= 0; i--) {
    if (nodes[i].depth < targetDepth) {
      return -1;
    }
    if (nodes[i].depth === targetDepth) {
      return i;
    }
  }
  return -1;
}

function findNextSiblingIndex(
  nodes: ReadonlyArray<TreeViewNodeData>,
  index: number
): number {
  if (index < 0 || index >= nodes.length) {
    return -1;
  }
  const targetDepth = nodes[index].depth;
  const end = getSubtreeEndIndex(nodes, index);
  const nextIdx = end + 1;
  if (nextIdx >= nodes.length || nodes[nextIdx].depth < targetDepth) {
    return -1;
  }
  return nextIdx;
}

export function canMoveTreeNodeUp(
  nodes: ReadonlyArray<TreeViewNodeData>,
  index: number
): boolean {
  return findPrevSiblingIndex(nodes, index) >= 0;
}

export function moveTreeNodeUp(
  nodes: ReadonlyArray<TreeViewNodeData>,
  index: number
): TreeViewNodeData[] {
  const prevIdx = findPrevSiblingIndex(nodes, index);
  if (prevIdx < 0) {
    return [...nodes];
  }
  const end = getSubtreeEndIndex(nodes, index);
  const prevBlock = nodes.slice(prevIdx, index);
  const currBlock = nodes.slice(index, end + 1);
  return [
    ...nodes.slice(0, prevIdx),
    ...currBlock,
    ...prevBlock,
    ...nodes.slice(end + 1),
  ];
}

export function canMoveTreeNodeDown(
  nodes: ReadonlyArray<TreeViewNodeData>,
  index: number
): boolean {
  return findNextSiblingIndex(nodes, index) >= 0;
}

export function moveTreeNodeDown(
  nodes: ReadonlyArray<TreeViewNodeData>,
  index: number
): TreeViewNodeData[] {
  const nextIdx = findNextSiblingIndex(nodes, index);
  if (nextIdx < 0) {
    return [...nodes];
  }
  const nextEnd = getSubtreeEndIndex(nodes, nextIdx);
  const currBlock = nodes.slice(index, nextIdx);
  const nextBlock = nodes.slice(nextIdx, nextEnd + 1);
  return [
    ...nodes.slice(0, index),
    ...nextBlock,
    ...currBlock,
    ...nodes.slice(nextEnd + 1),
  ];
}

export function generateNextTreeNodeId(
  nodes: ReadonlyArray<TreeViewNodeData>
): string {
  let num = nodes.length + 1;
  const existing = new Set(nodes.map((n) => n.id));
  while (existing.has(`tree_${num}`)) {
    num++;
  }
  return `tree_${num}`;
}

export function addChildTreeNode(
  nodes: ReadonlyArray<TreeViewNodeData>,
  parentIndex: number,
  nodeType: TreeViewNodeType,
  name: string
): { nodes: TreeViewNodeData[]; createdId: string } {
  const id = generateNextTreeNodeId(nodes);
  if (parentIndex < 0 || parentIndex >= nodes.length) {
    const nextNode: TreeViewNodeData = {
      id,
      depth: 0,
      name,
      nodeType,
    };
    return { nodes: [...nodes, nextNode], createdId: id };
  }

  const parent = nodes[parentIndex];
  const end = getSubtreeEndIndex(nodes, parentIndex);
  const childNode: TreeViewNodeData = {
    id,
    depth: parent.depth + 1,
    name,
    nodeType,
  };

  // 子を追加する親はフォルダ型に揃える
  const nextNodes = nodes.map((n, i) =>
    i === parentIndex && n.nodeType !== 'directory'
      ? { ...n, nodeType: 'directory' as const }
      : n
  );

  return {
    nodes: [
      ...nextNodes.slice(0, end + 1),
      childNode,
      ...nextNodes.slice(end + 1),
    ],
    createdId: id,
  };
}

export function deleteTreeSubtree(
  nodes: ReadonlyArray<TreeViewNodeData>,
  index: number
): TreeViewNodeData[] {
  if (index < 0 || index >= nodes.length) {
    return [...nodes];
  }
  const end = getSubtreeEndIndex(nodes, index);
  return [...nodes.slice(0, index), ...nodes.slice(end + 1)];
}
