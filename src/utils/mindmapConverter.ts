import type {
  MindmapConfigData,
  MindmapDiagramData,
  MindmapNodeData,
  MindmapNodeShape,
} from '../types/editor';
import {
  GUI_STATE_PREFIX,
  allocateUniqueId,
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
} from './mermaidEnvelope';

export const DEFAULT_MINDMAP_CONFIG: MindmapConfigData = {
  padding: 10,
  maxNodeWidth: 200,
};

const VALID_SHAPES = new Set<MindmapNodeShape>([
  'default',
  'rounded',
  'rect',
  'circle',
  'cloud',
  'bang',
  'hexagon',
]);

export function createDefaultMindmapData(
  lang: 'ja' | 'en' = 'ja'
): MindmapDiagramData {
  const isJa = lang === 'ja';
  return {
    diagramType: 'mindmap',
    config: { ...DEFAULT_MINDMAP_CONFIG },
    nodes: [
      {
        id: 'root',
        depth: 0,
        label: isJa ? '中心テーマ' : 'Central Topic',
        shape: 'circle',
      },
      {
        id: 'mm_1',
        depth: 1,
        label: isJa ? '企画・調査' : 'Origins',
        shape: 'rounded',
        icon: 'fa fa-book',
      },
      {
        id: 'mm_2',
        depth: 2,
        label: isJa ? 'ユーザー課題' : 'User Needs',
        shape: 'default',
      },
      {
        id: 'mm_3',
        depth: 2,
        label: isJa ? '要件整理' : 'Requirements',
        shape: 'rect',
      },
      {
        id: 'mm_4',
        depth: 1,
        label: isJa ? '設計・開発' : 'Design & Build',
        shape: 'hexagon',
        icon: 'fa fa-gears',
      },
      {
        id: 'mm_5',
        depth: 2,
        label: isJa ? 'プロトタイプ' : 'Prototype',
        shape: 'cloud',
      },
      {
        id: 'mm_6',
        depth: 2,
        label: isJa ? '重点チェック' : 'Key Milestone',
        shape: 'bang',
      },
    ],
  };
}

export function isValidMindmapData(
  value: unknown
): value is MindmapDiagramData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as { diagramType?: unknown; nodes?: unknown };
  return obj.diagramType === 'mindmap' && Array.isArray(obj.nodes);
}

function clampInt(raw: unknown, fallback: number, min: number, max: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(raw)));
}

function normalizeConfig(config?: Partial<MindmapConfigData>): MindmapConfigData {
  return {
    padding: clampInt(config?.padding, DEFAULT_MINDMAP_CONFIG.padding, 2, 60),
    maxNodeWidth: clampInt(
      config?.maxNodeWidth,
      DEFAULT_MINDMAP_CONFIG.maxNodeWidth,
      80,
      600
    ),
  };
}

function sanitizeLabel(raw: string): string {
  return raw.replace(/[()[\]{}"`\r\n]/g, '').trim();
}

function sanitizeIcon(raw?: string): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[)\r\n]/g, '').trim();
  return cleaned || undefined;
}

function sanitizeCssClass(raw?: string): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[^a-zA-Z0-9_ -]/g, '').trim();
  return cleaned || undefined;
}

export function normalizeMindmapNodes(
  nodes: MindmapNodeData[]
): MindmapNodeData[] {
  if (nodes.length === 0) {
    return [];
  }

  const usedIds = new Set<string>();
  const result: MindmapNodeData[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const raw = nodes[i];
    const baseId =
      raw.id && /^[a-zA-Z0-9_-]+$/.test(raw.id)
        ? raw.id
        : i === 0
          ? 'root'
          : `mm_${i}`;
    const id = allocateUniqueId(baseId, usedIds);

    const depth =
      i === 0
        ? 0
        : Math.max(
            1,
            Math.min(
              result[i - 1].depth + 1,
              Math.round(Number.isFinite(raw.depth) ? raw.depth : 1)
            )
          );

    const shape: MindmapNodeShape = VALID_SHAPES.has(raw.shape)
      ? raw.shape
      : 'default';
    const label = sanitizeLabel(raw.label) || (i === 0 ? 'Root' : `Topic ${i}`);
    const icon = sanitizeIcon(raw.icon);
    const cssClass = sanitizeCssClass(raw.cssClass);
    const useMarkdown = Boolean(raw.useMarkdown);

    result.push({
      id,
      depth,
      label,
      shape: useMarkdown && shape === 'default' ? 'rounded' : shape,
      ...(icon ? { icon } : {}),
      ...(cssClass ? { cssClass } : {}),
      ...(useMarkdown ? { useMarkdown: true } : {}),
    });
  }

  return result;
}

function normalizeMindmapData(data: MindmapDiagramData): MindmapDiagramData {
  const comments = Array.isArray(data.comments)
    ? data.comments
        .filter((c): c is string => typeof c === 'string')
        .map(sanitizeSingleLineComment)
        .filter((c) => c.length > 0)
    : undefined;
  return {
    diagramType: 'mindmap',
    config: normalizeConfig(data.config),
    nodes: normalizeMindmapNodes(data.nodes),
    ...(comments && comments.length > 0 ? { comments } : {}),
  };
}

export function getMindmapSubtreeRange(
  nodes: MindmapNodeData[],
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

export function canIndentMindmapNode(
  nodes: MindmapNodeData[],
  index: number
): boolean {
  if (index <= 0 || index >= nodes.length) {
    return false;
  }
  return nodes[index].depth <= nodes[index - 1].depth;
}

export function indentMindmapNode(
  nodes: MindmapNodeData[],
  index: number
): MindmapNodeData[] {
  if (!canIndentMindmapNode(nodes, index)) {
    return nodes;
  }
  const [, end] = getMindmapSubtreeRange(nodes, index);
  const next = nodes.map((n, i) =>
    i >= index && i <= end ? { ...n, depth: n.depth + 1 } : n
  );
  return normalizeMindmapNodes(next);
}

export function canOutdentMindmapNode(
  nodes: MindmapNodeData[],
  index: number
): boolean {
  if (index <= 0 || index >= nodes.length) {
    return false;
  }
  return nodes[index].depth > 1;
}

export function outdentMindmapNode(
  nodes: MindmapNodeData[],
  index: number
): MindmapNodeData[] {
  if (!canOutdentMindmapNode(nodes, index)) {
    return nodes;
  }
  const [, end] = getMindmapSubtreeRange(nodes, index);
  const next = nodes.map((n, i) =>
    i >= index && i <= end ? { ...n, depth: Math.max(1, n.depth - 1) } : n
  );
  return normalizeMindmapNodes(next);
}

export function canMoveMindmapNode(
  nodes: MindmapNodeData[],
  index: number,
  delta: -1 | 1
): boolean {
  if (index <= 0 || index >= nodes.length) {
    return false;
  }
  const [start, end] = getMindmapSubtreeRange(nodes, index);
  if (delta === -1) {
    return start > 1;
  }
  return end < nodes.length - 1;
}

export function moveMindmapNode(
  nodes: MindmapNodeData[],
  index: number,
  delta: -1 | 1
): MindmapNodeData[] {
  if (!canMoveMindmapNode(nodes, index, delta)) {
    return nodes;
  }

  const [start, end] = getMindmapSubtreeRange(nodes, index);
  const targetDepth = nodes[start].depth;
  const block = nodes.slice(start, end + 1);

  if (delta === -1) {
    // Find sibling just above or single previous node
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
    return normalizeMindmapNodes(next);
  }

  // Move down past the next sibling subtree (or next single node)
  const nextIndex = end + 1;
  let afterTargetEnd = nextIndex;
  if (nodes[nextIndex].depth === targetDepth) {
    [, afterTargetEnd] = getMindmapSubtreeRange(nodes, nextIndex);
  }
  const next = [
    ...nodes.slice(0, start),
    ...nodes.slice(end + 1, afterTargetEnd + 1),
    ...block,
    ...nodes.slice(afterTargetEnd + 1),
  ];
  return normalizeMindmapNodes(next);
}

function formatMindmapNodeText(node: MindmapNodeData): string {
  const safeLabel = sanitizeLabel(node.label) || node.id;
  const inner = node.useMarkdown ? `"\`${safeLabel}\`"` : safeLabel;

  switch (node.shape) {
    case 'rounded':
      return `${node.id}(${inner})`;
    case 'rect':
      return `${node.id}[${inner}]`;
    case 'circle':
      return `${node.id}((${inner}))`;
    case 'cloud':
      return `${node.id})${inner}(`;
    case 'bang':
      return `${node.id}))${inner}((`;
    case 'hexagon':
      return `${node.id}{{${inner}}}`;
    case 'default':
    default:
      return safeLabel;
  }
}

export function generateMindmapCode(data: MindmapDiagramData): string {
  const normalized = normalizeMindmapData(data);
  const lines: string[] = [];

  const configDiffs: string[] = [];
  if (normalized.config.padding !== DEFAULT_MINDMAP_CONFIG.padding) {
    configDiffs.push(`    padding: ${normalized.config.padding}`);
  }
  if (normalized.config.maxNodeWidth !== DEFAULT_MINDMAP_CONFIG.maxNodeWidth) {
    configDiffs.push(`    maxNodeWidth: ${normalized.config.maxNodeWidth}`);
  }

  if (configDiffs.length > 0) {
    lines.push('---');
    lines.push('config:');
    lines.push('  mindmap:');
    lines.push(...configDiffs);
    lines.push('---');
  }

  lines.push('mindmap');

  if (normalized.comments && normalized.comments.length > 0) {
    for (const comment of normalized.comments) {
      lines.push(`  %% ${comment}`);
    }
  }

  for (const node of normalized.nodes) {
    const indent = '  '.repeat(node.depth + 1);
    lines.push(`${indent}${formatMindmapNodeText(node)}`);
    if (node.icon) {
      lines.push(`${indent}  ::icon(${node.icon})`);
    }
    if (node.cssClass) {
      lines.push(`${indent}  :::${node.cssClass}`);
    }
  }

  lines.push(formatGuiStateLine(normalized));
  return lines.join('\n');
}

function unwrapLabel(raw: string): { label: string; useMarkdown: boolean } {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"`') && trimmed.endsWith('`"') && trimmed.length >= 4) {
    return {
      label: trimmed.slice(2, -2).trim(),
      useMarkdown: true,
    };
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return {
      label: trimmed.slice(1, -1).trim(),
      useMarkdown: false,
    };
  }
  return { label: trimmed, useMarkdown: false };
}

function parseMindmapNodeLine(
  body: string,
  index: number
): Pick<MindmapNodeData, 'id' | 'label' | 'shape' | 'useMarkdown'> {
  const patterns: Array<{
    regex: RegExp;
    shape: MindmapNodeShape;
  }> = [
    { regex: /^([^()[\]{}\n]+)?\(\(([\s\S]+)\)\)$/, shape: 'circle' },
    { regex: /^([^()[\]{}\n]+)?\)\)([\s\S]+)\(\($/, shape: 'bang' },
    { regex: /^([^()[\]{}\n]+)?\{\{([\s\S]+)\}\}$/, shape: 'hexagon' },
    { regex: /^([^()[\]{}\n]+)?\)([\s\S]+)\($/, shape: 'cloud' },
    { regex: /^([^()[\]{}\n]+)?\[([\s\S]+)\]$/, shape: 'rect' },
    { regex: /^([^()[\]{}\n]+)?\(([\s\S]+)\)$/, shape: 'rounded' },
  ];

  for (const { regex, shape } of patterns) {
    const match = body.match(regex);
    if (match) {
      const rawId = match[1]?.trim() ?? '';
      const validId =
        rawId && /^[a-zA-Z0-9_-]+$/.test(rawId)
          ? rawId
          : index === 0
            ? 'root'
            : `mm_${index}`;
      const unwrapped = unwrapLabel(match[2]);
      return {
        id: validId,
        label: sanitizeLabel(unwrapped.label) || (index === 0 ? 'Root' : `Topic ${index}`),
        shape,
        ...(unwrapped.useMarkdown ? { useMarkdown: true } : {}),
      };
    }
  }

  return {
    id: index === 0 ? 'root' : `mm_${index}`,
    label: sanitizeLabel(body) || (index === 0 ? 'Root' : `Topic ${index}`),
    shape: 'default',
  };
}

export function parseMindmapCodeToGuiData(code: string): MindmapDiagramData {
  const lines = code.split(/\r?\n/);

  const restored = extractGuiStateJson(lines, isValidMindmapData);
  if (restored) {
    return normalizeMindmapData(restored);
  }

  const config: MindmapConfigData = { ...DEFAULT_MINDMAP_CONFIG };
  const nodes: MindmapNodeData[] = [];
  const comments: string[] = [];

  let i = 0;
  if (lines[0]?.trim() === '---') {
    i = 1;
    let inMindmapConfig = false;
    while (i < lines.length && lines[i].trim() !== '---') {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();
      if (/^mindmap\s*:/i.test(trimmed)) {
        inMindmapConfig = true;
      } else if (inMindmapConfig && /^padding\s*:/i.test(trimmed)) {
        const val = Number(trimmed.slice(trimmed.indexOf(':') + 1).trim());
        if (Number.isFinite(val)) config.padding = val;
      } else if (inMindmapConfig && /^maxNodeWidth\s*:/i.test(trimmed)) {
        const val = Number(trimmed.slice(trimmed.indexOf(':') + 1).trim());
        if (Number.isFinite(val)) config.maxNodeWidth = val;
      } else if (inMindmapConfig && rawLine.length > 0 && !/^\s/.test(rawLine)) {
        inMindmapConfig = false;
      }
      i++;
    }
    if (i < lines.length && lines[i].trim() === '---') {
      i++;
    }
  }

  let foundHeader = false;
  const indentStack: number[] = [];

  for (; i < lines.length; i++) {
    const expanded = lines[i].replace(/\t/g, '  ');
    const trimmed = expanded.trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed.startsWith('%%{')) {
      const initMatch = trimmed.match(/^%%\{init\s*:\s*([\s\S]*?)\}%%$/);
      if (initMatch) {
        try {
          const parsedInit = JSON.parse(initMatch[1]) as {
            mindmap?: { padding?: unknown; maxNodeWidth?: unknown };
          };
          if (typeof parsedInit.mindmap?.padding === 'number') {
            config.padding = parsedInit.mindmap.padding;
          }
          if (typeof parsedInit.mindmap?.maxNodeWidth === 'number') {
            config.maxNodeWidth = parsedInit.mindmap.maxNodeWidth;
          }
        } catch {
          // Ignore malformed init
        }
      }
      continue;
    }

    if (trimmed.startsWith('%%')) {
      if (!trimmed.startsWith(GUI_STATE_PREFIX)) {
        const body = trimmed.replace(/^%%+\s?/, '').trim();
        if (body) {
          comments.push(body);
        }
      }
      continue;
    }

    if (!foundHeader) {
      if (/^mindmap\b/i.test(trimmed)) {
        foundHeader = true;
      }
      continue;
    }

    const iconMatch = trimmed.match(/^::icon\(([^)]+)\)$/);
    if (iconMatch) {
      if (nodes.length > 0) {
        nodes[nodes.length - 1].icon = sanitizeIcon(iconMatch[1]);
      }
      continue;
    }

    if (trimmed.startsWith(':::')) {
      if (nodes.length > 0) {
        nodes[nodes.length - 1].cssClass = sanitizeCssClass(trimmed.slice(3));
      }
      continue;
    }

    const indentLen = expanded.match(/^ */)?.[0].length ?? 0;

    let depth = 0;
    if (nodes.length === 0) {
      indentStack.push(indentLen);
      depth = 0;
    } else {
      while (
        indentStack.length > 1 &&
        indentLen <= indentStack[indentStack.length - 1]
      ) {
        indentStack.pop();
      }
      depth = Math.max(1, indentStack.length);
      indentStack.push(indentLen);
    }

    const parsedNode = parseMindmapNodeLine(trimmed, nodes.length);
    nodes.push({
      ...parsedNode,
      depth,
    });
  }

  if (nodes.length === 0) {
    return normalizeMindmapData({
      diagramType: 'mindmap',
      config,
      nodes: [
        {
          id: 'root',
          depth: 0,
          label: 'Root',
          shape: 'circle',
        },
      ],
      ...(comments.length > 0 ? { comments } : {}),
    });
  }

  return normalizeMindmapData({
    diagramType: 'mindmap',
    config,
    nodes,
    ...(comments.length > 0 ? { comments } : {}),
  });
}
