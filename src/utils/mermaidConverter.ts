import type {
  EdgeLineType,
  MermaidDiagramData,
  MermaidDirection,
  MermaidEdgeData,
  MermaidNodeData,
  NodeShape,
} from '../types/editor';

const GUI_STATE_PREFIX = '%% @gui-state:';

const VALID_DIRECTIONS: ReadonlyArray<MermaidDirection> = ['TD', 'LR', 'BT', 'RL'];
const VALID_SHAPES: ReadonlyArray<NodeShape> = ['rect', 'round', 'diamond', 'circle', 'stadium'];
const VALID_LINE_TYPES: ReadonlyArray<EdgeLineType> = ['arrow', 'dotted', 'thick', 'line'];

export function createDefaultDiagramData(): MermaidDiagramData {
  return {
    direction: 'TD',
    nodes: [
      {
        id: 'node_1',
        label: '開始',
        shape: 'stadium',
        color: '#eff6ff',
        position: { x: 180, y: 40 },
      },
      {
        id: 'node_2',
        label: '処理を実行',
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
        label: '次へ',
        lineType: 'arrow',
      },
    ],
  };
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
    case 'diamond':
      return `  ${id}{"${label}"}`;
    case 'circle':
      return `  ${id}(("${label}"))`;
    case 'stadium':
      return `  ${id}(["${label}"])`;
    case 'rect':
    default:
      return `  ${id}["${label}"]`;
  }
}

function getEdgeConnector(lineType: EdgeLineType): string {
  switch (lineType) {
    case 'dotted':
      return '-.->';
    case 'thick':
      return '==>';
    case 'line':
      return '---';
    case 'arrow':
    default:
      return '-->';
  }
}

export function generateMermaidCode(data: MermaidDiagramData): string {
  const lines: string[] = [`flowchart ${data.direction}`];

  for (const node of data.nodes) {
    lines.push(formatNodeSyntax(node));
    if (node.color && node.color !== '#ffffff') {
      lines.push(`  style ${sanitizeId(node.id)} fill:${node.color},stroke:#475569,color:#0f172a`);
    }
  }

  for (const edge of data.edges) {
    const sourceId = sanitizeId(edge.source);
    const targetId = sanitizeId(edge.target);
    const connector = getEdgeConnector(edge.lineType);
    const labelText = edge.label ? sanitizeMermaidText(edge.label) : '';

    if (labelText) {
      lines.push(`  ${sourceId} ${connector}|"${labelText}"| ${targetId}`);
    } else {
      lines.push(`  ${sourceId} ${connector} ${targetId}`);
    }
  }

  lines.push(`${GUI_STATE_PREFIX} ${JSON.stringify(data)}`);
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

  return validNodes && validEdges;
}

interface ParsedNodeToken {
  id: string;
  label?: string;
  shape?: NodeShape;
}

function parseNodeToken(token: string): ParsedNodeToken | null {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }

  const stadiumMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s*\(\[(.*)\]\)$/);
  if (stadiumMatch) {
    return {
      id: stadiumMatch[1],
      label: unescapeLabel(stadiumMatch[2]) || stadiumMatch[1],
      shape: 'stadium',
    };
  }

  const circleMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s*\(\((.*)\)\)$/);
  if (circleMatch) {
    return {
      id: circleMatch[1],
      label: unescapeLabel(circleMatch[2]) || circleMatch[1],
      shape: 'circle',
    };
  }

  const diamondMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s*\{(.*)\}$/);
  if (diamondMatch) {
    return {
      id: diamondMatch[1],
      label: unescapeLabel(diamondMatch[2]) || diamondMatch[1],
      shape: 'diamond',
    };
  }

  const roundMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s*\((.*)\)$/);
  if (roundMatch) {
    return {
      id: roundMatch[1],
      label: unescapeLabel(roundMatch[2]) || roundMatch[1],
      shape: 'round',
    };
  }

  const rectMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s*\[(.*)\]$/);
  if (rectMatch) {
    return {
      id: rectMatch[1],
      label: unescapeLabel(rectMatch[2]) || rectMatch[1],
      shape: 'rect',
    };
  }

  const idOnlyMatch = trimmed.match(/^([a-zA-Z0-9_]+)$/);
  if (idOnlyMatch) {
    return { id: idOnlyMatch[1] };
  }

  return null;
}

function parseLineType(connector: string): EdgeLineType {
  switch (connector) {
    case '-.->':
      return 'dotted';
    case '==>':
      return 'thick';
    case '---':
      return 'line';
    case '-->':
    default:
      return 'arrow';
  }
}

export function parseMermaidCodeToGuiData(code: string): MermaidDiagramData {
  if (!code || !code.trim()) {
    return { direction: 'TD', nodes: [], edges: [] };
  }

  const lines = code.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(GUI_STATE_PREFIX)) {
      const jsonPart = trimmed.slice(GUI_STATE_PREFIX.length).trim();
      try {
        const parsed: unknown = JSON.parse(jsonPart);
        if (isValidDiagramData(parsed)) {
          return parsed;
        }
      } catch {
        // JSON解析失敗時は手書き構文の解析へフォールバックする
      }
    }
  }

  let direction: MermaidDirection = 'TD';
  const nodeMap = new Map<string, Omit<MermaidNodeData, 'position'>>();
  const edges: MermaidEdgeData[] = [];

  const ensureNode = (token: ParsedNodeToken): void => {
    const existing = nodeMap.get(token.id);
    if (!existing) {
      nodeMap.set(token.id, {
        id: token.id,
        label: token.label ?? token.id,
        shape: token.shape ?? 'rect',
        color: '#ffffff',
      });
      return;
    }

    if (token.label) {
      existing.label = token.label;
    }
    if (token.shape) {
      existing.shape = token.shape;
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('%%')) {
      continue;
    }

    const headerMatch = trimmed.match(/^(?:flowchart|graph)\s+(TD|TB|LR|BT|RL)\b/i);
    if (headerMatch) {
      const rawDir = headerMatch[1].toUpperCase();
      direction = rawDir === 'TB' ? 'TD' : (rawDir as MermaidDirection);
      continue;
    }

    if (/^(?:style|classDef|class|click|linkStyle|subgraph|end|direction)\b/i.test(trimmed)) {
      continue;
    }

    const edgeMatch = trimmed.match(
      /^(.+?)\s*(-->|-\.->|==>|---)\s*(?:\|\s*"?([^"|]*)"?\s*\|\s*)?(.+?)\s*;?$/
    );

    if (edgeMatch) {
      const leftToken = parseNodeToken(edgeMatch[1]);
      const connector = edgeMatch[2];
      const edgeLabel = edgeMatch[3] ? unescapeLabel(edgeMatch[3]) : undefined;
      const rightToken = parseNodeToken(edgeMatch[4]);

      if (leftToken && rightToken) {
        ensureNode(leftToken);
        ensureNode(rightToken);
        edges.push({
          id: `edge_${edges.length + 1}`,
          source: leftToken.id,
          target: rightToken.id,
          label: edgeLabel || undefined,
          lineType: parseLineType(connector),
        });
        continue;
      }
    }

    const singleNode = parseNodeToken(trimmed.replace(/;$/, ''));
    if (singleNode) {
      ensureNode(singleNode);
    }
  }

  if (nodeMap.size === 0) {
    return { direction: 'TD', nodes: [], edges: [] };
  }

  const nodes: MermaidNodeData[] = Array.from(nodeMap.values()).map((node, index) => ({
    ...node,
    position: {
      x: (index % 3) * 230 + 60,
      y: Math.floor(index / 3) * 140 + 50,
    },
  }));

  return {
    direction,
    nodes,
    edges,
  };
}
