import type {
  EdgeLineType,
  MermaidClassDefData,
  MermaidDiagramData,
  MermaidDirection,
  MermaidEdgeData,
  MermaidNodeData,
  MermaidSubgraphData,
  NodeShape,
} from '../../types/editor';
import { sanitizeCssColor, sanitizeSafeUrl } from '../inputSafeguard.ts';
import { sanitizeSingleLineComment } from '../mermaidEnvelope.ts';

export const VALID_DIRECTIONS: ReadonlyArray<MermaidDirection> = ['TD', 'LR', 'BT', 'RL'];
export const VALID_SHAPES: ReadonlyArray<NodeShape> = [
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
export const VALID_LINE_TYPES: ReadonlyArray<EdgeLineType> = [
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

export function sanitizeId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_]/g, '_');
  return /^[a-zA-Z_]/.test(cleaned) ? cleaned : `n_${cleaned}`;
}

export function sanitizeMermaidText(raw: string): string {
  return raw
    .replace(/"/g, '#quot;')
    .replace(/\|/g, '#124;')
    .replace(/\r?\n/g, ' ')
    .trim();
}

export function escapeLabel(label: string): string {
  return sanitizeMermaidText(label) || '要素';
}

export function unescapeLabel(raw: string): string {
  return raw
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/#quot;/g, '"')
    .replace(/#124;/g, '|')
    .trim();
}

export function sanitizeClassName(rawName: string): string {
  const cleaned = rawName.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!cleaned) {
    return '';
  }
  return /^[a-zA-Z_]/.test(cleaned) ? cleaned : `c_${cleaned}`;
}

export function formatNodeSyntax(node: MermaidNodeData): string {
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

export interface ConnectorSyntaxParts {
  connector: string;
  startPrefix: string | null;
  endSuffix: string | null;
}

export function getConnectorParts(lineType: EdgeLineType, extraLength = 0): ConnectorSyntaxParts {
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

export function emitNodeLines(lines: string[], node: MermaidNodeData, indent: string): void {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isValidDiagramData(value: unknown): value is MermaidDiagramData {
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
