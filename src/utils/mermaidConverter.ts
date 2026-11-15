import type {
  EdgeLabelStyle,
  EdgeLineType,
  MermaidClassDefData,
  MermaidDiagramData,
  MermaidDiagramType,
  MermaidDirection,
  MermaidEdgeData,
  MermaidNodeData,
  MermaidSubgraphData,
  NodeShape,
} from '../types/editor';
import { sanitizeCssColor, sanitizeSafeUrl } from './inputSafeguard';
import {
  GUI_STATE_PREFIX,
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
} from './mermaidEnvelope';

const VALID_DIRECTIONS: ReadonlyArray<MermaidDirection> = ['TD', 'LR', 'BT', 'RL'];
const VALID_SHAPES: ReadonlyArray<NodeShape> = [
  'rect',
  'round',
  'stadium',
  'subroutine',
  'cylinder',
  'circle',
  'asymmetric',
  'diamond',
  'hexagon',
  'parallelogram',
  'parallelogram_alt',
  'trapezoid',
  'trapezoid_alt',
  'double_circle',
  'doc',
  'cyl_modern',
];
const VALID_LINE_TYPES: ReadonlyArray<EdgeLineType> = [
  'arrow',
  'line',
  'dotted',
  'thick',
  'circle',
  'cross',
  'bidirectional',
  'invisible',
];

export function createDefaultDiagramData(lang: 'ja' | 'en' = 'ja'): MermaidDiagramData {
  const isJa = lang === 'ja';
  return {
    direction: 'TD',
    nodes: [
      {
        id: 'node_1',
        label: isJa ? '開始' : 'Start',
        shape: 'stadium',
        color: '#eff6ff',
        position: { x: 180, y: 40 },
      },
      {
        id: 'node_2',
        label: isJa ? '処理を実行' : 'Process',
        shape: 'rect',
        color: '#ffffff',
        position: { x: 180, y: 170 },
      },
    ],
    edges: [
      {
        id: 'edge_1',
        source: 'node_1',
        target: 'node_2',
        label: isJa ? '次へ' : 'Next',
        lineType: 'arrow',
      },
    ],
  };
}

export function createDefaultSwimlaneData(lang: 'ja' | 'en' = 'ja'): MermaidDiagramData {
  const isJa = lang === 'ja';
  return {
    diagramType: 'swimlane',
    direction: 'LR',
    subgraphs: [
      {
        id: 'lane_1',
        title: isJa ? '顧客' : 'Customer',
        fill: '#eff6ff',
        stroke: '#2563eb',
      },
      {
        id: 'lane_2',
        title: isJa ? '対応チーム' : 'Support Team',
        fill: '#f0fdf4',
        stroke: '#16a34a',
      },
    ],
    nodes: [
      {
        id: 'node_1',
        label: isJa ? '問い合わせ' : 'Request',
        shape: 'stadium',
        color: '#ffffff',
        subgraphId: 'lane_1',
        position: { x: 140, y: 60 },
      },
      {
        id: 'node_2',
        label: isJa ? '内容確認' : 'Triage',
        shape: 'diamond',
        color: '#fefce8',
        subgraphId: 'lane_2',
        position: { x: 340, y: 210 },
      },
      {
        id: 'node_3',
        label: isJa ? '回答を受領' : 'Receive Reply',
        shape: 'rect',
        color: '#ffffff',
        subgraphId: 'lane_1',
        position: { x: 540, y: 60 },
      },
    ],
    edges: [
      {
        id: 'edge_1',
        source: 'node_1',
        target: 'node_2',
        lineType: 'arrow',
      },
      {
        id: 'edge_2',
        source: 'node_2',
        target: 'node_3',
        label: isJa ? '完了' : 'Done',
        lineType: 'arrow',
      },
    ],
  };
}

export function detectMermaidDiagramType(code: string): MermaidDiagramType {
  const lines = code.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(GUI_STATE_PREFIX)) {
      const jsonPart = trimmed.slice(GUI_STATE_PREFIX.length).trim();
      try {
        const parsed: unknown = JSON.parse(jsonPart);
        if (
          parsed &&
          typeof parsed === 'object' &&
          (parsed as { diagramType?: unknown }).diagramType === 'treeView' &&
          Array.isArray((parsed as { nodes?: unknown }).nodes)
        ) {
          return 'treeView';
        }
        if (
          parsed &&
          typeof parsed === 'object' &&
          (parsed as { diagramType?: unknown }).diagramType === 'gantt' &&
          Array.isArray((parsed as { tasks?: unknown }).tasks)
        ) {
          return 'gantt';
        }
        if (
          parsed &&
          typeof parsed === 'object' &&
          (parsed as { diagramType?: unknown }).diagramType === 'kanban' &&
          Array.isArray((parsed as { columns?: unknown }).columns)
        ) {
          return 'kanban';
        }
        if (
          parsed &&
          typeof parsed === 'object' &&
          (parsed as { diagramType?: unknown }).diagramType === 'pie' &&
          Array.isArray((parsed as { slices?: unknown }).slices)
        ) {
          return 'pie';
        }
        if (
          parsed &&
          typeof parsed === 'object' &&
          (parsed as { diagramType?: unknown }).diagramType === 'xychart' &&
          Array.isArray((parsed as { series?: unknown }).series)
        ) {
          return 'xychart';
        }
        if (
          parsed &&
          typeof parsed === 'object' &&
          (parsed as { diagramType?: unknown }).diagramType === 'architecture' &&
          Array.isArray((parsed as { nodes?: unknown }).nodes)
        ) {
          return 'architecture';
        }
        if (
          parsed &&
          typeof parsed === 'object' &&
          (parsed as { diagramType?: unknown }).diagramType === 'mindmap' &&
          Array.isArray((parsed as { nodes?: unknown }).nodes)
        ) {
          return 'mindmap';
        }
        if (
          parsed &&
          typeof parsed === 'object' &&
          (parsed as { diagramType?: unknown }).diagramType === 'quadrantChart' &&
          Array.isArray((parsed as { points?: unknown }).points)
        ) {
          return 'quadrantChart';
        }
        if (
          parsed &&
          typeof parsed === 'object' &&
          (parsed as { diagramType?: unknown }).diagramType === 'sequence' &&
          Array.isArray((parsed as { participants?: unknown }).participants) &&
          Array.isArray((parsed as { steps?: unknown }).steps)
        ) {
          return 'sequence';
        }
        if (
          parsed &&
          typeof parsed === 'object' &&
          (parsed as { diagramType?: unknown }).diagramType === 'er' &&
          Array.isArray((parsed as { entities?: unknown }).entities) &&
          Array.isArray((parsed as { relationships?: unknown }).relationships)
        ) {
          return 'er';
        }
        if (
          parsed &&
          typeof parsed === 'object' &&
          (parsed as { diagramType?: unknown }).diagramType === 'class' &&
          Array.isArray((parsed as { classes?: unknown }).classes) &&
          Array.isArray((parsed as { relations?: unknown }).relations)
        ) {
          return 'class';
        }
        if (
          parsed &&
          typeof parsed === 'object' &&
          (parsed as { diagramType?: unknown }).diagramType === 'state' &&
          Array.isArray((parsed as { states?: unknown }).states) &&
          Array.isArray((parsed as { transitions?: unknown }).transitions)
        ) {
          return 'state';
        }
        if (
          parsed &&
          typeof parsed === 'object' &&
          (parsed as { diagramType?: unknown }).diagramType === 'c4' &&
          Array.isArray((parsed as { elements?: unknown }).elements) &&
          Array.isArray((parsed as { boundaries?: unknown }).boundaries) &&
          Array.isArray((parsed as { relations?: unknown }).relations)
        ) {
          return 'c4';
        }
        if (isValidDiagramData(parsed) && parsed.diagramType === 'swimlane') {
          return 'swimlane';
        }
      } catch {
        // JSON解析失敗時はテキスト判定へフォールバックする
      }
    }
  }
  let inFrontmatter = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
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
    if (!trimmed || trimmed.startsWith('%%')) {
      continue;
    }
    if (/^treeView-beta\b/i.test(trimmed)) {
      return 'treeView';
    }
    if (/^gantt\b/i.test(trimmed)) {
      return 'gantt';
    }
    if (/^kanban\b/i.test(trimmed)) {
      return 'kanban';
    }
    if (/^pie\b/i.test(trimmed)) {
      return 'pie';
    }
    if (/^xychart(-beta)?\b/i.test(trimmed)) {
      return 'xychart';
    }
    if (/^architecture(?:-beta)?\b/i.test(trimmed)) {
      return 'architecture';
    }
    if (/^mindmap\b/i.test(trimmed)) {
      return 'mindmap';
    }
    if (/^quadrantChart\b/i.test(trimmed)) {
      return 'quadrantChart';
    }
    if (/^sequenceDiagram\b/i.test(trimmed)) {
      return 'sequence';
    }
    if (/^erDiagram\b/i.test(trimmed)) {
      return 'er';
    }
    if (/^classDiagram(?:-v2)?\b/i.test(trimmed)) {
      return 'class';
    }
    if (/^stateDiagram(?:-v2)?\b/i.test(trimmed)) {
      return 'state';
    }
    if (/^C4(?:Context|Container|Component|Dynamic|Deployment)\b/i.test(trimmed)) {
      return 'c4';
    }
    if (/^swimlane-beta\b/i.test(trimmed)) {
      return 'swimlane';
    }
    break;
  }
  return 'flowchart';
}

function sanitizeId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_]/g, '_');
  return /^[a-zA-Z_]/.test(cleaned) ? cleaned : `n_${cleaned}`;
}

function sanitizeMermaidText(raw: string): string {
  return raw
    .replace(/"/g, '#quot;')
    .replace(/\|/g, '#124;')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function escapeLabel(label: string): string {
  return sanitizeMermaidText(label) || '要素';
}

function unescapeLabel(raw: string): string {
  return raw
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/#quot;/g, '"')
    .replace(/#124;/g, '|')
    .trim();
}

function formatNodeSyntax(node: MermaidNodeData): string {
  const id = sanitizeId(node.id);
  const label = escapeLabel(node.label);

  switch (node.shape) {
    case 'round':
      return `  ${id}("${label}")`;
    case 'stadium':
      return `  ${id}(["${label}"])`;
    case 'subroutine':
      return `  ${id}[["${label}"]]`;
    case 'cylinder':
      return `  ${id}[("${label}")]`;
    case 'circle':
      return `  ${id}(("${label}"))`;
    case 'asymmetric':
      return `  ${id}>"${label}"]`;
    case 'diamond':
      return `  ${id}{"${label}"}`;
    case 'hexagon':
      return `  ${id}{{"${label}"}}`;
    case 'parallelogram':
      return `  ${id}[/"${label}"/]`;
    case 'parallelogram_alt':
      return `  ${id}[\\"${label}"\\]`;
    case 'trapezoid':
      return `  ${id}[/"${label}"\\]`;
    case 'trapezoid_alt':
      return `  ${id}[\\"${label}"/]`;
    case 'double_circle':
      return `  ${id}((("${label}")))`;
    case 'doc':
      return `  ${id}@{ shape: doc, label: "${label}" }`;
    case 'cyl_modern':
      return `  ${id}@{ shape: cyl, label: "${label}" }`;
    case 'rect':
    default:
      return `  ${id}["${label}"]`;
  }
}

interface ConnectorSyntaxParts {
  connector: string;
  startPrefix: string | null;
  endSuffix: string | null;
}

function getConnectorParts(lineType: EdgeLineType, extraLength = 0): ConnectorSyntaxParts {
  const len = Math.max(0, Math.min(3, Math.round(extraLength)));
  switch (lineType) {
    case 'line': {
      const dashes = '-'.repeat(3 + len);
      return { connector: dashes, startPrefix: '--', endSuffix: dashes };
    }
    case 'dotted': {
      const dots = '.'.repeat(1 + len);
      return { connector: `-${dots}->`, startPrefix: '-.', endSuffix: `${dots}->` };
    }
    case 'thick': {
      const equals = `${'='.repeat(2 + len)}>`;
      return { connector: equals, startPrefix: '==', endSuffix: equals };
    }
    case 'circle': {
      const end = `${'-'.repeat(2 + len)}o`;
      return { connector: end, startPrefix: '--', endSuffix: end };
    }
    case 'cross': {
      const end = `${'-'.repeat(2 + len)}x`;
      return { connector: end, startPrefix: '--', endSuffix: end };
    }
    case 'bidirectional': {
      const dashes = '-'.repeat(2 + len);
      return { connector: `<${dashes}>`, startPrefix: '<--', endSuffix: `${dashes}>` };
    }
    case 'invisible': {
      const tildes = '~'.repeat(3 + len);
      return { connector: tildes, startPrefix: null, endSuffix: null };
    }
    case 'arrow':
    default: {
      const end = `${'-'.repeat(2 + len)}>`;
      return { connector: end, startPrefix: '--', endSuffix: end };
    }
  }
}

function sanitizeClassName(rawName: string): string {
  const cleaned = rawName.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!cleaned) {
    return '';
  }
  return /^[a-zA-Z_]/.test(cleaned) ? cleaned : `c_${cleaned}`;
}

function buildNodeStyleParts(node: MermaidNodeData): string[] {
  const parts: string[] = [];
  const hasCustomFill = Boolean(node.color && node.color !== '#ffffff');
  if (hasCustomFill && node.color) {
    parts.push(`fill:${node.color}`);
  }
  if (node.strokeColor) {
    parts.push(`stroke:${node.strokeColor}`);
  } else if (hasCustomFill) {
    parts.push('stroke:#475569');
  }
  if (hasCustomFill) {
    parts.push('color:#0f172a');
  }
  return parts;
}

function emitNodeLines(lines: string[], node: MermaidNodeData, indent: string): void {
  lines.push(`${indent}${formatNodeSyntax(node).trimStart()}`);
  const styleParts = buildNodeStyleParts(node);
  if (styleParts.length > 0) {
    lines.push(`${indent}style ${sanitizeId(node.id)} ${styleParts.join(',')}`);
  }
}

export function normalizeDiagramData(data: MermaidDiagramData): MermaidDiagramData {
  const direction: MermaidDirection = VALID_DIRECTIONS.includes(data.direction)
    ? data.direction
    : 'TD';

  const nodes: MermaidNodeData[] = data.nodes.map((node) => {
    const color = sanitizeCssColor(node.color);
    const strokeColor = sanitizeCssColor(node.strokeColor);
    const linkUrl = sanitizeSafeUrl(node.linkUrl);
    const linkTooltip = node.linkTooltip
      ? sanitizeSingleLineComment(node.linkTooltip)
      : '';
    const className = node.className ? sanitizeClassName(node.className) : '';
    const posX = Number.isFinite(node.position?.x) ? node.position.x : 0;
    const posY = Number.isFinite(node.position?.y) ? node.position.y : 0;

    return {
      id: node.id,
      label: node.label,
      shape: VALID_SHAPES.includes(node.shape) ? node.shape : 'rect',
      ...(color ? { color } : {}),
      ...(strokeColor ? { strokeColor } : {}),
      ...(className ? { className } : {}),
      ...(node.subgraphId ? { subgraphId: node.subgraphId } : {}),
      ...(linkUrl ? { linkUrl } : {}),
      ...(linkTooltip ? { linkTooltip } : {}),
      position: { x: posX, y: posY },
    };
  });

  const edges: MermaidEdgeData[] = data.edges.map((edge) => {
    const strokeColor = sanitizeCssColor(edge.strokeColor);
    const rawExtra = edge.extraLength;
    const extraLength =
      typeof rawExtra === 'number' && Number.isFinite(rawExtra)
        ? Math.max(0, Math.min(3, Math.round(rawExtra)))
        : 0;
    const labelStyle =
      edge.labelStyle === 'inline' || edge.labelStyle === 'pipe'
        ? edge.labelStyle
        : undefined;

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ...(edge.label ? { label: edge.label } : {}),
      lineType: VALID_LINE_TYPES.includes(edge.lineType) ? edge.lineType : 'arrow',
      ...(extraLength > 0 ? { extraLength } : {}),
      ...(labelStyle ? { labelStyle } : {}),
      ...(strokeColor ? { strokeColor } : {}),
    };
  });

  const subgraphs: MermaidSubgraphData[] | undefined = data.subgraphs
    ?.map((sg) => {
      const fill = sanitizeCssColor(sg.fill);
      const stroke = sanitizeCssColor(sg.stroke);
      const sgDir =
        sg.direction && VALID_DIRECTIONS.includes(sg.direction)
          ? sg.direction
          : undefined;
      return {
        id: sg.id,
        title: sg.title,
        ...(sgDir ? { direction: sgDir } : {}),
        ...(fill ? { fill } : {}),
        ...(stroke ? { stroke } : {}),
      };
    });

  const classDefs: MermaidClassDefData[] | undefined = data.classDefs
    ?.map((cls) => {
      const name = sanitizeClassName(cls.name);
      if (!name) {
        return null;
      }
      const fill = sanitizeCssColor(cls.fill);
      const stroke = sanitizeCssColor(cls.stroke);
      const color = sanitizeCssColor(cls.color);
      return {
        name,
        ...(fill ? { fill } : {}),
        ...(stroke ? { stroke } : {}),
        ...(color ? { color } : {}),
      };
    })
    .filter((cls): cls is MermaidClassDefData => cls !== null);

  const comments = data.comments
    ?.map(sanitizeSingleLineComment)
    .filter((line) => line.length > 0);

  return {
    ...(data.diagramType === 'swimlane' ? { diagramType: 'swimlane' as const } : {}),
    direction,
    nodes,
    edges,
    ...(subgraphs && subgraphs.length > 0 ? { subgraphs } : {}),
    ...(classDefs && classDefs.length > 0 ? { classDefs } : {}),
    ...(comments && comments.length > 0 ? { comments } : {}),
  };
}

export function generateMermaidCode(rawData: MermaidDiagramData): string {
  const data = normalizeDiagramData(rawData);
  const isSwimlane = data.diagramType === 'swimlane';
  const headerLine = isSwimlane
    ? `swimlane-beta ${data.direction}`
    : `flowchart ${data.direction}`;
  const lines: string[] = [headerLine];

  for (const comment of data.comments ?? []) {
    const clean = sanitizeSingleLineComment(comment);
    if (clean) {
      lines.push(`  %% ${clean}`);
    }
  }

  for (const classDef of data.classDefs ?? []) {
    const className = sanitizeClassName(classDef.name);
    if (!className) {
      continue;
    }
    const props: string[] = [];
    if (classDef.fill) props.push(`fill:${classDef.fill}`);
    if (classDef.stroke) props.push(`stroke:${classDef.stroke}`);
    if (classDef.color) props.push(`color:${classDef.color}`);
    if (props.length > 0) {
      lines.push(`  classDef ${className} ${props.join(',')}`);
    }
  }

  const subgraphs = data.subgraphs ?? [];
  const subgraphIds = new Set(subgraphs.map((sg) => sg.id));

  for (const sg of subgraphs) {
    const sgId = sanitizeId(sg.id);
    const sgTitle = sanitizeMermaidText(sg.title || sg.id) || sgId;
    lines.push(`  subgraph ${sgId}["${sgTitle}"]`);
    if (!isSwimlane && sg.direction) {
      lines.push(`    direction ${sg.direction}`);
    }
    for (const node of data.nodes) {
      if (node.subgraphId === sg.id) {
        emitNodeLines(lines, node, '    ');
      }
    }
    lines.push('  end');

    const sgStyleParts: string[] = [];
    if (sg.fill && sg.fill !== '#ffffff') sgStyleParts.push(`fill:${sg.fill}`);
    if (sg.stroke) sgStyleParts.push(`stroke:${sg.stroke}`);
    if (sg.fill && sg.fill !== '#ffffff') sgStyleParts.push('color:#0f172a');
    if (sgStyleParts.length > 0) {
      lines.push(`  style ${sgId} ${sgStyleParts.join(',')}`);
    }
  }

  for (const node of data.nodes) {
    if (!node.subgraphId || !subgraphIds.has(node.subgraphId)) {
      emitNodeLines(lines, node, '  ');
    }
  }

  for (const node of data.nodes) {
    if (node.className) {
      const className = sanitizeClassName(node.className);
      if (className) {
        lines.push(`  class ${sanitizeId(node.id)} ${className}`);
      }
    }
  }

  const linkStyleLines: string[] = [];
  data.edges.forEach((edge, index) => {
    const sourceId = sanitizeId(edge.source);
    const targetId = sanitizeId(edge.target);
    const parts = getConnectorParts(edge.lineType, edge.extraLength ?? 0);
    const labelText = edge.label ? sanitizeMermaidText(edge.label) : '';

    if (labelText) {
      if (edge.labelStyle === 'inline' && parts.startPrefix && parts.endSuffix) {
        lines.push(`  ${sourceId} ${parts.startPrefix} "${labelText}" ${parts.endSuffix} ${targetId}`);
      } else {
        lines.push(`  ${sourceId} ${parts.connector}|"${labelText}"| ${targetId}`);
      }
    } else {
      lines.push(`  ${sourceId} ${parts.connector} ${targetId}`);
    }

    if (edge.strokeColor) {
      linkStyleLines.push(`  linkStyle ${index} stroke:${edge.strokeColor}`);
    }
  });

  lines.push(...linkStyleLines);

  for (const node of data.nodes) {
    const safeUrl = sanitizeSafeUrl(node.linkUrl);
    if (safeUrl) {
      const encodedUrl = safeUrl.replace(/"/g, '%22');
      const tooltip = node.linkTooltip?.trim()
        ? ` "${sanitizeMermaidText(node.linkTooltip.trim())}"`
        : '';
      lines.push(`  click ${sanitizeId(node.id)} "${encodedUrl}"${tooltip}`);
    }
  }

  lines.push(formatGuiStateLine(data));
  return lines.join('\n');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidDiagramData(value: unknown): value is MermaidDiagramData {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.direction !== 'string' || !VALID_DIRECTIONS.includes(value.direction as MermaidDirection)) {
    return false;
  }
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    return false;
  }

  const validNodes = value.nodes.every((node) => {
    if (!isRecord(node)) return false;
    if (typeof node.id !== 'string' || typeof node.label !== 'string') return false;
    if (typeof node.shape !== 'string' || !VALID_SHAPES.includes(node.shape as NodeShape)) return false;
    if (!isRecord(node.position)) return false;
    return typeof node.position.x === 'number' && typeof node.position.y === 'number';
  });

  const validEdges = value.edges.every((edge) => {
    if (!isRecord(edge)) return false;
    if (typeof edge.id !== 'string' || typeof edge.source !== 'string' || typeof edge.target !== 'string') {
      return false;
    }
    return typeof edge.lineType === 'string' && VALID_LINE_TYPES.includes(edge.lineType as EdgeLineType);
  });

  if (value.subgraphs !== undefined) {
    if (
      !Array.isArray(value.subgraphs) ||
      !value.subgraphs.every(
        (sg) => isRecord(sg) && typeof sg.id === 'string' && typeof sg.title === 'string',
      )
    ) {
      return false;
    }
  }

  if (value.classDefs !== undefined) {
    if (
      !Array.isArray(value.classDefs) ||
      !value.classDefs.every((cls) => isRecord(cls) && typeof cls.name === 'string')
    ) {
      return false;
    }
  }

  if (value.comments !== undefined) {
    if (!Array.isArray(value.comments) || !value.comments.every((c) => typeof c === 'string')) {
      return false;
    }
  }

  return validNodes && validEdges;
}

interface ParsedNodeToken {
  id: string;
  label?: string;
  shape?: NodeShape;
  className?: string;
}

const MODERN_SHAPE_MAP: Record<string, NodeShape> = {
  doc: 'doc',
  document: 'doc',
  cyl: 'cyl_modern',
  cylinder: 'cyl_modern',
  db: 'cyl_modern',
  database: 'cyl_modern',
  rect: 'rect',
  rounded: 'round',
  stadium: 'stadium',
  subproc: 'subroutine',
  subroutine: 'subroutine',
  circle: 'circle',
  circ: 'circle',
  diam: 'diamond',
  diamond: 'diamond',
  hex: 'hexagon',
  hexagon: 'hexagon',
  'lean-r': 'parallelogram',
  'lean-l': 'parallelogram_alt',
  'trap-b': 'trapezoid',
  'trap-t': 'trapezoid_alt',
  'dbl-circ': 'double_circle',
};

const NODE_TOKEN_PATTERNS: ReadonlyArray<{ regex: RegExp; shape: NodeShape }> = [
  { regex: /^([a-zA-Z0-9_]+)\s*\(\(\((.*)\)\)\)$/, shape: 'double_circle' },
  { regex: /^([a-zA-Z0-9_]+)\s*\(\[(.*)\]\)$/, shape: 'stadium' },
  { regex: /^([a-zA-Z0-9_]+)\s*\[\[(.*)\]\]$/, shape: 'subroutine' },
  { regex: /^([a-zA-Z0-9_]+)\s*\[\((.*)\)\]$/, shape: 'cylinder' },
  { regex: /^([a-zA-Z0-9_]+)\s*\[\/(.*)\/\]$/, shape: 'parallelogram' },
  { regex: /^([a-zA-Z0-9_]+)\s*\[\\(.*)\\\]$/, shape: 'parallelogram_alt' },
  { regex: /^([a-zA-Z0-9_]+)\s*\[\/(.*)\\\]$/, shape: 'trapezoid' },
  { regex: /^([a-zA-Z0-9_]+)\s*\[\\(.*)\/\]$/, shape: 'trapezoid_alt' },
  { regex: /^([a-zA-Z0-9_]+)\s*\{\{(.*)\}\}$/, shape: 'hexagon' },
  { regex: /^([a-zA-Z0-9_]+)\s*>(.*)\]$/, shape: 'asymmetric' },
  { regex: /^([a-zA-Z0-9_]+)\s*\(\((.*)\)\)$/, shape: 'circle' },
  { regex: /^([a-zA-Z0-9_]+)\s*\{(.*)\}$/, shape: 'diamond' },
  { regex: /^([a-zA-Z0-9_]+)\s*\((.*)\)$/, shape: 'round' },
  { regex: /^([a-zA-Z0-9_]+)\s*\[(.*)\]$/, shape: 'rect' },
];

function parseModernShapeToken(trimmed: string): ParsedNodeToken | null {
  const modernMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s*@\{([\s\S]*)\}$/);
  if (!modernMatch) {
    return null;
  }

  const id = modernMatch[1];
  const body = modernMatch[2];
  const shapeMatch = body.match(/(?:^|,)\s*shape\s*:\s*["']?([a-zA-Z0-9_-]+)["']?/i);
  const labelMatch = body.match(/(?:^|,)\s*label\s*:\s*("([^"]*)"|'([^']*)'|[^,}]+)/i);

  const rawShape = shapeMatch ? shapeMatch[1].toLowerCase() : 'rect';
  const mappedShape = MODERN_SHAPE_MAP[rawShape] ?? 'rect';
  const rawLabel = labelMatch ? (labelMatch[2] ?? labelMatch[3] ?? labelMatch[1]) : '';
  const label = unescapeLabel(rawLabel) || id;

  return { id, label, shape: mappedShape };
}

function parseNodeToken(token: string): ParsedNodeToken | null {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }

  let body = trimmed;
  let className: string | undefined;
  const classSuffixMatch = body.match(/^([\s\S]+?):::([a-zA-Z0-9_-]+)$/);
  if (classSuffixMatch) {
    body = classSuffixMatch[1].trim();
    className = classSuffixMatch[2];
  }

  const modernToken = parseModernShapeToken(body);
  if (modernToken) {
    return className ? { ...modernToken, className } : modernToken;
  }

  for (const pattern of NODE_TOKEN_PATTERNS) {
    const matched = body.match(pattern.regex);
    if (matched) {
      return {
        id: matched[1],
        label: unescapeLabel(matched[2]) || matched[1],
        shape: pattern.shape,
        ...(className ? { className } : {}),
      };
    }
  }

  const idOnlyMatch = body.match(/^([a-zA-Z0-9_]+)$/);
  if (idOnlyMatch) {
    return {
      id: idOnlyMatch[1],
      ...(className ? { className } : {}),
    };
  }

  return null;
}

interface ConnectorMeta {
  lineType: EdgeLineType;
  extraLength: number;
}

function parseConnectorMeta(connector: string): ConnectorMeta {
  const bidirMatch = connector.match(/^<(-{2,})>$/);
  if (bidirMatch) {
    return { lineType: 'bidirectional', extraLength: Math.min(3, bidirMatch[1].length - 2) };
  }

  const arrowMatch = connector.match(/^(-{2,})>$/);
  if (arrowMatch) {
    return { lineType: 'arrow', extraLength: Math.min(3, arrowMatch[1].length - 2) };
  }

  const circleMatch = connector.match(/^(-{2,})o$/);
  if (circleMatch) {
    return { lineType: 'circle', extraLength: Math.min(3, circleMatch[1].length - 2) };
  }

  const crossMatch = connector.match(/^(-{2,})x$/);
  if (crossMatch) {
    return { lineType: 'cross', extraLength: Math.min(3, crossMatch[1].length - 2) };
  }

  const lineMatch = connector.match(/^(-{3,})$/);
  if (lineMatch) {
    return { lineType: 'line', extraLength: Math.min(3, lineMatch[1].length - 3) };
  }

  const dottedMatch = connector.match(/^-(\.+)->$/);
  if (dottedMatch) {
    return { lineType: 'dotted', extraLength: Math.min(3, dottedMatch[1].length - 1) };
  }

  const thickMatch = connector.match(/^(={2,})>$/);
  if (thickMatch) {
    return { lineType: 'thick', extraLength: Math.min(3, thickMatch[1].length - 2) };
  }

  const invisibleMatch = connector.match(/^(~{3,})$/);
  if (invisibleMatch) {
    return { lineType: 'invisible', extraLength: Math.min(3, invisibleMatch[1].length - 3) };
  }

  return { lineType: 'arrow', extraLength: 0 };
}

function parseInlineConnectorMeta(start: string, end: string): ConnectorMeta | null {
  if (start === '<--') {
    const match = end.match(/^(-{2,})>$/);
    if (match) {
      return { lineType: 'bidirectional', extraLength: Math.min(3, match[1].length - 2) };
    }
    return null;
  }

  if (start === '--') {
    const arrowMatch = end.match(/^(-{2,})>$/);
    if (arrowMatch) {
      return { lineType: 'arrow', extraLength: Math.min(3, arrowMatch[1].length - 2) };
    }
    const circleMatch = end.match(/^(-{2,})o$/);
    if (circleMatch) {
      return { lineType: 'circle', extraLength: Math.min(3, circleMatch[1].length - 2) };
    }
    const crossMatch = end.match(/^(-{2,})x$/);
    if (crossMatch) {
      return { lineType: 'cross', extraLength: Math.min(3, crossMatch[1].length - 2) };
    }
    const lineMatch = end.match(/^(-{3,})$/);
    if (lineMatch) {
      return { lineType: 'line', extraLength: Math.min(3, lineMatch[1].length - 3) };
    }
    return null;
  }

  if (start === '-.') {
    const dottedMatch = end.match(/^-?(\.+)->$/);
    if (dottedMatch) {
      return { lineType: 'dotted', extraLength: Math.min(3, dottedMatch[1].length - 1) };
    }
    return null;
  }

  if (start === '==') {
    const thickMatch = end.match(/^(={2,})>$/);
    if (thickMatch) {
      return { lineType: 'thick', extraLength: Math.min(3, thickMatch[1].length - 2) };
    }
    return null;
  }

  return null;
}

function splitChainNodes(side: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < side.length; i += 1) {
    const ch = side[i];
    if (quote) {
      current += ch;
      if (ch === quote && side[i - 1] !== '\\') {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }

    if (ch === '(' || ch === '[' || ch === '{') {
      depth += 1;
      current += ch;
      continue;
    }

    if ((ch === ')' || ch === ']' || ch === '}') && depth > 0) {
      depth -= 1;
      current += ch;
      continue;
    }

    if (ch === '&' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
  }

  parts.push(current.trim());
  return parts.filter((part) => part.length > 0);
}

function parseChainTokens(side: string): ParsedNodeToken[] | null {
  const segments = splitChainNodes(side);
  if (segments.length === 0) {
    return null;
  }
  const tokens: ParsedNodeToken[] = [];
  for (const seg of segments) {
    const parsed = parseNodeToken(seg);
    if (!parsed) {
      return null;
    }
    tokens.push(parsed);
  }
  return tokens;
}

interface ParsedEdgeStatement {
  leftTokens: ParsedNodeToken[];
  rightTokens: ParsedNodeToken[];
  lineType: EdgeLineType;
  extraLength: number;
  label?: string;
  labelStyle?: EdgeLabelStyle;
}

function parseEdgeStatement(trimmed: string): ParsedEdgeStatement | null {
  const inlineMatch = trimmed.match(
    /^(.+?)\s+(<--|--|-\.|==)\s+(.+?)\s+(--+>|---+|--+o|--+x|(?:-)?\.+->|==+>)\s+(.+?)\s*;?$/
  );

  if (inlineMatch) {
    const meta = parseInlineConnectorMeta(inlineMatch[2], inlineMatch[4]);
    if (meta) {
      const leftTokens = parseChainTokens(inlineMatch[1]);
      const rightTokens = parseChainTokens(inlineMatch[5]);
      if (leftTokens && rightTokens) {
        return {
          leftTokens,
          rightTokens,
          lineType: meta.lineType,
          extraLength: meta.extraLength,
          label: unescapeLabel(inlineMatch[3]) || undefined,
          labelStyle: 'inline',
        };
      }
    }
  }

  const standardMatch = trimmed.match(
    /^(.+?)\s*(<-{2,}>|-{2,}>|-{2,}o|-{2,}x|-{3,}|-\.+->|={2,}>|~{3,})\s*(?:\|\s*"?([^"|]*)"?\s*\|\s*)?(.+?)\s*;?$/
  );

  if (standardMatch) {
    const leftTokens = parseChainTokens(standardMatch[1]);
    const rightTokens = parseChainTokens(standardMatch[4]);
    if (leftTokens && rightTokens) {
      const meta = parseConnectorMeta(standardMatch[2]);
      const edgeLabel = standardMatch[3] ? unescapeLabel(standardMatch[3]) : undefined;
      return {
        leftTokens,
        rightTokens,
        lineType: meta.lineType,
        extraLength: meta.extraLength,
        label: edgeLabel || undefined,
      };
    }
  }

  return null;
}

function parseStylePropertyMap(rawProps: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of rawProps.split(',')) {
    const colonIndex = part.indexOf(':');
    if (colonIndex === -1) {
      continue;
    }
    const key = part.slice(0, colonIndex).trim().toLowerCase();
    const val = part.slice(colonIndex + 1).trim();
    if (key && val) {
      result[key] = val;
    }
  }
  return result;
}

function parseSubgraphHeader(
  rawHeader: string,
  existingIds: Set<string>,
): { id: string; title: string } {
  const bracketMatch = rawHeader.match(/^([a-zA-Z0-9_-]+)\s*\[([\s\S]*)\]$/);
  if (bracketMatch) {
    const id = bracketMatch[1];
    const title = unescapeLabel(bracketMatch[2]) || id;
    return { id, title };
  }

  const title = unescapeLabel(rawHeader) || 'Group';
  const baseId = sanitizeId(title);
  let id = baseId;
  let suffix = 2;
  while (existingIds.has(id)) {
    id = `${baseId}_${suffix++}`;
  }
  return { id, title };
}

export function parseMermaidCodeToGuiData(code: string): MermaidDiagramData {
  if (!code || !code.trim()) {
    return { direction: 'TD', nodes: [], edges: [] };
  }

  const lines = code.split(/\r?\n/);

  const restored = extractGuiStateJson(lines, isValidDiagramData);
  if (restored) {
    return normalizeDiagramData(restored);
  }

  let diagramType: 'flowchart' | 'swimlane' | undefined;
  let direction: MermaidDirection = 'TD';
  const nodeMap = new Map<string, Omit<MermaidNodeData, 'position'>>();
  const edges: MermaidEdgeData[] = [];
  const subgraphs: MermaidSubgraphData[] = [];
  const subgraphIds = new Set<string>();
  const subgraphStack: string[] = [];
  const classDefs: MermaidClassDefData[] = [];
  const comments: string[] = [];
  const linkStrokeByIndex = new Map<number, string>();

  const ensureNode = (
    token: ParsedNodeToken,
    options?: { assignCurrentSubgraph?: boolean },
  ): Omit<MermaidNodeData, 'position'> => {
    const activeSubgraphId =
      options?.assignCurrentSubgraph && subgraphStack.length > 0
        ? subgraphStack[subgraphStack.length - 1]
        : undefined;

    const existing = nodeMap.get(token.id);
    if (!existing) {
      const created: Omit<MermaidNodeData, 'position'> = {
        id: token.id,
        label: token.label ?? token.id,
        shape: token.shape ?? 'rect',
        color: '#ffffff',
        ...(token.className ? { className: token.className } : {}),
        ...(activeSubgraphId ? { subgraphId: activeSubgraphId } : {}),
      };
      nodeMap.set(token.id, created);
      return created;
    }

    if (token.label) {
      existing.label = token.label;
    }
    if (token.shape) {
      existing.shape = token.shape;
    }
    if (token.className) {
      existing.className = token.className;
    }
    if (activeSubgraphId && !existing.subgraphId) {
      existing.subgraphId = activeSubgraphId;
    }
    return existing;
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
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

    const headerMatch = trimmed.match(/^(?:flowchart|graph|swimlane-beta)(?:\s+(TD|TB|LR|BT|RL))?\b/i);
    if (headerMatch) {
      if (/^swimlane-beta\b/i.test(trimmed)) {
        diagramType = 'swimlane';
      }
      if (headerMatch[1]) {
        const rawDir = headerMatch[1].toUpperCase();
        direction = rawDir === 'TB' ? 'TD' : (rawDir as MermaidDirection);
      }
      continue;
    }

    const subgraphMatch = trimmed.match(/^subgraph\s+(.+)$/i);
    if (subgraphMatch) {
      const parsedSg = parseSubgraphHeader(subgraphMatch[1].trim(), subgraphIds);
      if (!subgraphIds.has(parsedSg.id)) {
        subgraphIds.add(parsedSg.id);
        subgraphs.push(parsedSg);
      }
      subgraphStack.push(parsedSg.id);
      continue;
    }

    if (/^end\b/i.test(trimmed)) {
      if (subgraphStack.length > 0) {
        subgraphStack.pop();
      }
      continue;
    }

    const dirMatch = trimmed.match(/^direction\s+(TD|TB|LR|BT|RL)\b/i);
    if (dirMatch) {
      if (subgraphStack.length > 0) {
        const activeId = subgraphStack[subgraphStack.length - 1];
        const rawDir = dirMatch[1].toUpperCase();
        const sgDir: MermaidDirection = rawDir === 'TB' ? 'TD' : (rawDir as MermaidDirection);
        const sgTarget = subgraphs.find((sg) => sg.id === activeId);
        if (sgTarget) {
          sgTarget.direction = sgDir;
        }
      }
      continue;
    }

    const classDefMatch = trimmed.match(/^classDef\s+([a-zA-Z0-9_-]+)\s+(.+)$/i);
    if (classDefMatch) {
      const name = classDefMatch[1];
      const props = parseStylePropertyMap(classDefMatch[2]);
      const existingIdx = classDefs.findIndex((c) => c.name === name);
      const nextDef: MermaidClassDefData = {
        name,
        ...(props.fill ? { fill: props.fill } : {}),
        ...(props.stroke ? { stroke: props.stroke } : {}),
        ...(props.color ? { color: props.color } : {}),
      };
      if (existingIdx >= 0) {
        classDefs[existingIdx] = nextDef;
      } else {
        classDefs.push(nextDef);
      }
      continue;
    }

    const classAssignMatch = trimmed.match(/^class\s+([a-zA-Z0-9_,\s-]+?)\s+([a-zA-Z0-9_-]+)\s*;?$/i);
    if (classAssignMatch) {
      const clsName = classAssignMatch[2];
      const ids = classAssignMatch[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const id of ids) {
        const node = ensureNode({ id });
        node.className = clsName;
      }
      continue;
    }

    const styleMatch = trimmed.match(/^style\s+([a-zA-Z0-9_,\s-]+?)\s+(.+)$/i);
    if (styleMatch) {
      const props = parseStylePropertyMap(styleMatch[2]);
      const ids = styleMatch[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const id of ids) {
        if (subgraphIds.has(id)) {
          const sgTarget = subgraphs.find((sg) => sg.id === id);
          if (sgTarget) {
            if (props.fill) sgTarget.fill = props.fill;
            if (props.stroke) sgTarget.stroke = props.stroke;
          }
          continue;
        }
        const node = ensureNode({ id });
        if (props.fill) {
          node.color = props.fill;
        }
        if (props.stroke) {
          node.strokeColor = props.stroke;
        }
      }
      continue;
    }

    const linkStyleMatch = trimmed.match(/^linkStyle\s+(\d+(?:\s*,\s*\d+)*)\s+(.+)$/i);
    if (linkStyleMatch) {
      const props = parseStylePropertyMap(linkStyleMatch[2]);
      if (props.stroke) {
        const indices = linkStyleMatch[1]
          .split(',')
          .map((s) => Number.parseInt(s.trim(), 10))
          .filter((n) => !Number.isNaN(n) && n >= 0);
        for (const idx of indices) {
          linkStrokeByIndex.set(idx, props.stroke);
        }
      }
      continue;
    }

    const clickMatch = trimmed.match(
      /^click\s+([a-zA-Z0-9_]+)\s+(?:"([^"]*)"|'([^']*)'|(\S+))(?:\s+(?:"([^"]*)"|'([^']*)'))?/i,
    );
    if (clickMatch) {
      const nodeId = clickMatch[1];
      const url = (clickMatch[2] ?? clickMatch[3] ?? clickMatch[4] ?? '').trim();
      const tooltip = (clickMatch[5] ?? clickMatch[6] ?? '').trim();
      const node = ensureNode({ id: nodeId });
      if (url) {
        node.linkUrl = url;
      }
      if (tooltip) {
        node.linkTooltip = tooltip;
      }
      continue;
    }

    if (/^(?:linkStyle|click)\b/i.test(trimmed)) {
      continue;
    }

    const parsedEdge = parseEdgeStatement(trimmed);
    if (parsedEdge) {
      for (const leftToken of parsedEdge.leftTokens) {
        ensureNode(leftToken, { assignCurrentSubgraph: true });
      }
      for (const rightToken of parsedEdge.rightTokens) {
        ensureNode(rightToken, { assignCurrentSubgraph: true });
      }
      for (const leftToken of parsedEdge.leftTokens) {
        for (const rightToken of parsedEdge.rightTokens) {
          edges.push({
            id: `edge_${edges.length + 1}`,
            source: leftToken.id,
            target: rightToken.id,
            label: parsedEdge.label,
            lineType: parsedEdge.lineType,
            ...(parsedEdge.extraLength > 0 ? { extraLength: parsedEdge.extraLength } : {}),
            ...(parsedEdge.labelStyle ? { labelStyle: parsedEdge.labelStyle } : {}),
          });
        }
      }
      continue;
    }

    const singleNode = parseNodeToken(trimmed.replace(/;$/, ''));
    if (singleNode) {
      ensureNode(singleNode, { assignCurrentSubgraph: true });
    }
  }

  for (const [edgeIndex, strokeColor] of linkStrokeByIndex.entries()) {
    if (edges[edgeIndex]) {
      edges[edgeIndex].strokeColor = strokeColor;
    }
  }

  if (nodeMap.size === 0 && subgraphs.length === 0 && classDefs.length === 0 && comments.length === 0) {
    return { direction: 'TD', nodes: [], edges: [] };
  }

  const nodes: MermaidNodeData[] = Array.from(nodeMap.values()).map((node, index) => ({
    ...node,
    position: {
      x: (index % 3) * 230 + 60,
      y: Math.floor(index / 3) * 140 + 50,
    },
  }));

  return normalizeDiagramData({
    ...(diagramType ? { diagramType } : {}),
    direction,
    nodes,
    edges,
    ...(subgraphs.length > 0 ? { subgraphs } : {}),
    ...(classDefs.length > 0 ? { classDefs } : {}),
    ...(comments.length > 0 ? { comments } : {}),
  });
}
