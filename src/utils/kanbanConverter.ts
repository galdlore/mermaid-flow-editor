import type {
  KanbanCardData,
  KanbanColumnData,
  KanbanDiagramData,
  KanbanPriority,
} from '../types/editor';
import { sanitizeSafeUrl } from './inputSafeguard';
import {
  GUI_STATE_PREFIX,
  allocateUniqueId,
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
  sanitizeYamlSingleQuoted,
  unquoteYamlString,
} from './mermaidEnvelope';

const VALID_PRIORITIES = new Set<KanbanPriority>([
  'Very High',
  'High',
  'Medium',
  'Low',
  'Very Low',
]);

export function createDefaultKanbanData(
  lang: 'ja' | 'en' = 'ja'
): KanbanDiagramData {
  const isJa = lang === 'ja';
  return {
    diagramType: 'kanban',
    ticketBaseUrl: 'https://example.com/browse/#TICKET#',
    sectionWidth: 220,
    columns: [
      { id: 'todo', title: isJa ? '未着手 (Todo)' : 'Todo' },
      { id: 'in_progress', title: isJa ? '進行中 (Doing)' : 'In Progress' },
      { id: 'done', title: isJa ? '完了 (Done)' : 'Done' },
    ],
    cards: [
      {
        id: 'task_1',
        label: isJa ? 'API設計書の作成' : 'Write API specification',
        columnId: 'todo',
        assigned: 'Alice',
        ticket: 'DEV-101',
        priority: 'High',
      },
      {
        id: 'task_2',
        label: isJa ? 'デザインレビュー準備' : 'Prepare design review',
        columnId: 'todo',
        assigned: 'Bob',
        ticket: 'DEV-102',
        priority: 'Medium',
      },
      {
        id: 'task_3',
        label: isJa ? 'ログイン画面の実装' : 'Implement login UI',
        columnId: 'in_progress',
        assigned: 'Ken',
        ticket: 'DEV-98',
        priority: 'Very High',
      },
      {
        id: 'task_4',
        label: isJa ? '環境構築' : 'Initial project setup',
        columnId: 'done',
        assigned: 'Alice',
        ticket: 'DEV-90',
        priority: 'Low',
      },
    ],
  };
}

export function isValidKanbanData(value: unknown): value is KanbanDiagramData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<KanbanDiagramData>;
  if (candidate.diagramType !== 'kanban') {
    return false;
  }
  if (!Array.isArray(candidate.columns) || !Array.isArray(candidate.cards)) {
    return false;
  }
  const columnsValid = candidate.columns.every(
    (col) =>
      Boolean(col) &&
      typeof col.id === 'string' &&
      typeof col.title === 'string'
  );
  const cardsValid = candidate.cards.every(
    (card) =>
      Boolean(card) &&
      typeof card.id === 'string' &&
      typeof card.label === 'string' &&
      typeof card.columnId === 'string'
  );
  return columnsValid && cardsValid;
}

function sanitizeKanbanId(rawId: string, fallbackPrefix: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!cleaned) {
    return fallbackPrefix;
  }
  return /^[a-zA-Z_]/.test(cleaned) ? cleaned : `${fallbackPrefix}_${cleaned}`;
}

function sanitizeKanbanText(raw: string, fallback: string): string {
  const cleaned = raw
    .replace(/["'()[\]{}|<>\\;@]/g, ' ')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

function sanitizeKanbanMetaValue(raw: string): string {
  return raw
    .replace(/["'{}\\]/g, ' ')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKanbanData(data: KanbanDiagramData): KanbanDiagramData {
  const usedIds = new Set<string>();
  const columnIdMap = new Map<string, string>();
  const columns: KanbanColumnData[] = data.columns.map((col, index) => {
    const baseId = sanitizeKanbanId(col.id, `col_${index + 1}`);
    const uniqueId = allocateUniqueId(baseId, usedIds);
    columnIdMap.set(col.id, uniqueId);
    return {
      id: uniqueId,
      title: col.title.trim() || `Column ${index + 1}`,
    };
  });

  const validColIds = new Set(columns.map((c) => c.id));
  const fallbackColId = columns[0]?.id ?? '';

  const cards: KanbanCardData[] = [];
  data.cards.forEach((card, index) => {
    const mappedCol = columnIdMap.get(card.columnId) ?? card.columnId;
    const targetCol = validColIds.has(mappedCol) ? mappedCol : fallbackColId;
    if (!targetCol) {
      return;
    }
    const baseId = sanitizeKanbanId(card.id, `task_${index + 1}`);
    const uniqueId = allocateUniqueId(baseId, usedIds);

    const assigned = card.assigned?.trim() || undefined;
    const ticket = card.ticket?.trim() || undefined;
    const priority =
      card.priority && VALID_PRIORITIES.has(card.priority)
        ? card.priority
        : undefined;

    cards.push({
      id: uniqueId,
      label: card.label.trim() || `Task ${index + 1}`,
      columnId: targetCol,
      ...(assigned ? { assigned } : {}),
      ...(ticket ? { ticket } : {}),
      ...(priority ? { priority } : {}),
    });
  });

  const comments = Array.isArray(data.comments)
    ? data.comments
        .filter((line): line is string => typeof line === 'string')
        .map(sanitizeSingleLineComment)
        .filter((line) => line.length > 0)
    : undefined;
  const ticketBaseUrl = sanitizeSafeUrl(data.ticketBaseUrl);
  const sectionWidth =
    typeof data.sectionWidth === 'number' &&
    Number.isFinite(data.sectionWidth) &&
    data.sectionWidth >= 120 &&
    data.sectionWidth <= 480
      ? Math.round(data.sectionWidth)
      : undefined;

  return {
    diagramType: 'kanban',
    columns,
    cards,
    ...(ticketBaseUrl ? { ticketBaseUrl } : {}),
    ...(sectionWidth ? { sectionWidth } : {}),
    ...(comments && comments.length > 0 ? { comments } : {}),
  };
}

export function generateKanbanCode(data: KanbanDiagramData): string {
  const normalized = normalizeKanbanData(data);
  const lines: string[] = [];

  const hasCustomWidth =
    typeof normalized.sectionWidth === 'number' &&
    normalized.sectionWidth !== 200;
  const hasTicketBaseUrl = Boolean(normalized.ticketBaseUrl);

  if (hasTicketBaseUrl || hasCustomWidth) {
    lines.push('---');
    lines.push('config:');
    lines.push('  kanban:');
    if (normalized.ticketBaseUrl) {
      lines.push(
        `    ticketBaseUrl: '${sanitizeYamlSingleQuoted(normalized.ticketBaseUrl)}'`
      );
    }
    if (hasCustomWidth && normalized.sectionWidth) {
      lines.push(`    sectionWidth: ${normalized.sectionWidth}`);
    }
    lines.push('---');
  }

  lines.push('kanban');

  if (normalized.comments && normalized.comments.length > 0) {
    for (const comment of normalized.comments) {
      lines.push(`  %% ${comment}`);
    }
  }

  for (const col of normalized.columns) {
    const colTitle = sanitizeKanbanText(col.title, col.id);
    lines.push(`  ${col.id}[${colTitle}]`);

    const columnCards = normalized.cards.filter(
      (card) => card.columnId === col.id
    );
    for (const card of columnCards) {
      const cardLabel = sanitizeKanbanText(card.label, card.id);
      const metaEntries: string[] = [];
      if (card.assigned) {
        const safeAssigned = sanitizeKanbanMetaValue(card.assigned);
        if (safeAssigned) {
          metaEntries.push(`assigned: '${safeAssigned}'`);
        }
      }
      if (card.ticket) {
        const safeTicket = sanitizeKanbanMetaValue(card.ticket);
        if (safeTicket) {
          metaEntries.push(`ticket: '${safeTicket}'`);
        }
      }
      if (card.priority) {
        metaEntries.push(`priority: '${card.priority}'`);
      }

      if (metaEntries.length > 0) {
        lines.push(`    ${card.id}[${cardLabel}]@{ ${metaEntries.join(', ')} }`);
      } else {
        lines.push(`    ${card.id}[${cardLabel}]`);
      }
    }
  }

  lines.push(formatGuiStateLine(normalized));
  return lines.join('\n');
}

function parseShapeDataBlock(rawBlock: string): Record<string, string> {
  const result: Record<string, string> = {};
  const pairRegex =
    /([a-zA-Z_][a-zA-Z0-9_-]*)\s*:\s*('(?:''|[^'])*'|"(?:\\"|[^"])*"|[^,}]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pairRegex.exec(rawBlock)) !== null) {
    const key = match[1].trim();
    const value = unquoteYamlString(match[2]);
    if (value) {
      result[key] = value;
    }
  }
  return result;
}

interface ParsedKanbanNodeLine {
  indent: number;
  id: string;
  label: string;
  assigned?: string;
  ticket?: string;
  priority?: KanbanPriority;
}

function parseKanbanLine(
  line: string,
  fallbackIndex: number
): ParsedKanbanNodeLine | null {
  const indentMatch = line.match(/^(\s*)(.*)$/);
  if (!indentMatch) {
    return null;
  }
  const indent = indentMatch[1].replace(/\t/g, '  ').length;
  let body = indentMatch[2].trim();
  if (!body) {
    return null;
  }

  // Strip ::icon(...) and :::className decorators
  body = body
    .replace(/::icon\([^)]*\)/g, '')
    .replace(/:::[a-zA-Z0-9_-]+/g, '')
    .trim();

  // Extract trailing @{ ... } metadata block if present
  let meta: Record<string, string> = {};
  const shapeDataMatch = body.match(/@\{([^}]*)\}\s*$/);
  if (shapeDataMatch) {
    meta = parseShapeDataBlock(shapeDataMatch[1]);
    body = body.slice(0, shapeDataMatch.index).trim();
  }

  let id = `node_${fallbackIndex}`;
  let label = '';

  const bracketPatterns = [
    /^([a-zA-Z0-9_-]+)\s*\["([^"]*)"\]$/,
    /^([a-zA-Z0-9_-]+)\s*\[([^\]]*)\]$/,
    /^([a-zA-Z0-9_-]+)\s*\(\(([^)]*)\)\)$/,
    /^([a-zA-Z0-9_-]+)\s*\(([^)]*)\)$/,
    /^([a-zA-Z0-9_-]+)\s*\{\{([^}]*)\}\}$/,
  ];

  let matchedPattern = false;
  for (const pattern of bracketPatterns) {
    const m = body.match(pattern);
    if (m) {
      id = sanitizeKanbanId(m[1], `node_${fallbackIndex}`);
      label = m[2].trim();
      matchedPattern = true;
      break;
    }
  }

  if (!matchedPattern) {
    const anonBracket = body.match(/^\[([^\]]*)\]$/);
    if (anonBracket) {
      label = anonBracket[1].replace(/^"(.*)"$/, '$1').trim();
    } else {
      const bareIdAndText = body.match(/^([a-zA-Z0-9_-]+)(?:\s+(.+))?$/);
      if (bareIdAndText) {
        id = sanitizeKanbanId(bareIdAndText[1], `node_${fallbackIndex}`);
        label = (bareIdAndText[2] ?? bareIdAndText[1]).trim();
      } else {
        label = body;
      }
    }
  }

  if (meta.label) {
    label = meta.label;
  }
  if (!label) {
    label = id;
  }

  const priority =
    meta.priority && VALID_PRIORITIES.has(meta.priority as KanbanPriority)
      ? (meta.priority as KanbanPriority)
      : undefined;

  return {
    indent,
    id,
    label,
    assigned: meta.assigned || undefined,
    ticket: meta.ticket || undefined,
    priority,
  };
}

export function parseKanbanCodeToGuiData(code: string): KanbanDiagramData {
  const lines = code.split(/\r?\n/);

  const restored = extractGuiStateJson(lines, isValidKanbanData);
  if (restored) {
    return normalizeKanbanData(restored);
  }

  let ticketBaseUrl: string | undefined;
  let sectionWidth: number | undefined;
  const comments: string[] = [];
  const columns: KanbanColumnData[] = [];
  const cards: KanbanCardData[] = [];

  let i = 0;
  if (lines[0]?.trim() === '---') {
    i = 1;
    let inKanbanConfig = false;
    while (i < lines.length && lines[i].trim() !== '---') {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();
      if (/^kanban\s*:/.test(trimmed)) {
        inKanbanConfig = true;
      } else if (inKanbanConfig && /^ticketBaseUrl\s*:/.test(trimmed)) {
        ticketBaseUrl = unquoteYamlString(
          trimmed.slice(trimmed.indexOf(':') + 1)
        );
      } else if (inKanbanConfig && /^sectionWidth\s*:/.test(trimmed)) {
        const num = Number(trimmed.slice(trimmed.indexOf(':') + 1).trim());
        if (Number.isFinite(num) && num >= 120 && num <= 480) {
          sectionWidth = Math.round(num);
        }
      } else if (
        inKanbanConfig &&
        rawLine.length > 0 &&
        !/^\s/.test(rawLine)
      ) {
        inKanbanConfig = false;
      }
      i++;
    }
    if (i < lines.length && lines[i].trim() === '---') {
      i++;
    }
  }

  let foundHeader = false;
  let sectionIndent: number | null = null;
  let currentColumnId: string | null = null;
  let nodeCounter = 1;

  for (; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed.startsWith('%%{')) {
      const initMatch = trimmed.match(/^%%\{init\s*:\s*([\s\S]*?)\}%%$/);
      if (initMatch) {
        try {
          const parsedInit = JSON.parse(initMatch[1]) as {
            kanban?: { ticketBaseUrl?: unknown; sectionWidth?: unknown };
          };
          if (typeof parsedInit.kanban?.ticketBaseUrl === 'string') {
            ticketBaseUrl = parsedInit.kanban.ticketBaseUrl;
          }
          if (typeof parsedInit.kanban?.sectionWidth === 'number') {
            sectionWidth = Math.round(parsedInit.kanban.sectionWidth);
          }
        } catch {
          // Ignore malformed init directive
        }
      }
      continue;
    }

    if (trimmed.startsWith('%%')) {
      if (!trimmed.startsWith(GUI_STATE_PREFIX)) {
        const commentBody = trimmed.replace(/^%%+\s?/, '').trim();
        if (commentBody) {
          comments.push(commentBody);
        }
      }
      continue;
    }

    if (!foundHeader) {
      if (/^kanban\b/i.test(trimmed)) {
        foundHeader = true;
      }
      continue;
    }

    const parsedNode = parseKanbanLine(rawLine, nodeCounter++);
    if (!parsedNode) {
      continue;
    }

    if (sectionIndent === null || parsedNode.indent <= sectionIndent) {
      sectionIndent = parsedNode.indent;
      const colId = sanitizeKanbanId(parsedNode.id, `col_${columns.length + 1}`);
      columns.push({
        id: colId,
        title: parsedNode.label,
      });
      currentColumnId = colId;
    } else if (currentColumnId) {
      cards.push({
        id: parsedNode.id,
        label: parsedNode.label,
        columnId: currentColumnId,
        ...(parsedNode.assigned ? { assigned: parsedNode.assigned } : {}),
        ...(parsedNode.ticket ? { ticket: parsedNode.ticket } : {}),
        ...(parsedNode.priority ? { priority: parsedNode.priority } : {}),
      });
    }
  }

  return normalizeKanbanData({
    diagramType: 'kanban',
    columns,
    cards,
    ...(ticketBaseUrl ? { ticketBaseUrl } : {}),
    ...(sectionWidth ? { sectionWidth } : {}),
    ...(comments.length > 0 ? { comments } : {}),
  });
}
