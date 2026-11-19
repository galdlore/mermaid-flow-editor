import type {
  PieDiagramData,
  PieLegendPosition,
  PieSliceData,
} from '../types/editor';
import {
  GUI_STATE_PREFIX,
  allocateUniqueId,
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
  sanitizeYamlSingleQuoted,
  unquoteYamlString,
} from './mermaidEnvelope.ts';

const VALID_LEGEND_POSITIONS = new Set<PieLegendPosition>([
  'right',
  'left',
  'top',
  'bottom',
  'center',
]);

export function createDefaultPieData(lang: 'ja' | 'en' = 'ja'): PieDiagramData {
  const isJa = lang === 'ja';
  return {
    diagramType: 'pie',
    title: isJa ? '開発工数の内訳' : 'Project Effort Breakdown',
    showData: true,
    textPosition: 0.75,
    donutHole: 0,
    legendPosition: 'right',
    slices: [
      { id: 'slice_1', label: isJa ? '設計' : 'Design', value: 25 },
      { id: 'slice_2', label: isJa ? '実装' : 'Implementation', value: 45 },
      { id: 'slice_3', label: isJa ? 'テスト' : 'Testing', value: 20 },
      { id: 'slice_4', label: isJa ? '運用準備' : 'Release Prep', value: 10 },
    ],
  };
}

export function isValidPieData(value: unknown): value is PieDiagramData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<PieDiagramData>;
  if (candidate.diagramType !== 'pie' || !Array.isArray(candidate.slices)) {
    return false;
  }
  return candidate.slices.every(
    (slice) =>
      Boolean(slice) &&
      typeof slice.id === 'string' &&
      typeof slice.label === 'string' &&
      typeof slice.value === 'number' &&
      Number.isFinite(slice.value)
  );
}

function sanitizePieLabel(raw: string, fallback: string): string {
  const cleaned = raw
    .replace(/"/g, '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

function sanitizePieTitle(raw: string): string {
  return raw
    .replace(/[\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePieData(data: PieDiagramData): PieDiagramData {
  const usedIds = new Set<string>();
  const slices: PieSliceData[] = data.slices.map((slice, index) => {
    const baseId = slice.id.replace(/[^a-zA-Z0-9_-]/g, '_') || `slice_${index + 1}`;
    const uniqueId = allocateUniqueId(baseId, usedIds);

    const numericVal =
      typeof slice.value === 'number' && Number.isFinite(slice.value)
        ? Math.max(0, Number(slice.value.toFixed(6)))
        : 0;

    return {
      id: uniqueId,
      label: slice.label.trim() || `Item ${index + 1}`,
      value: numericVal,
    };
  });

  const title = data.title ? sanitizePieTitle(data.title) : '';
  const textPosition =
    typeof data.textPosition === 'number' && Number.isFinite(data.textPosition)
      ? Math.min(1, Math.max(0.1, Number(data.textPosition.toFixed(2))))
      : undefined;
  const donutHole =
    typeof data.donutHole === 'number' && Number.isFinite(data.donutHole)
      ? Math.min(0.9, Math.max(0, Number(data.donutHole.toFixed(2))))
      : undefined;
  const legendPosition =
    data.legendPosition && VALID_LEGEND_POSITIONS.has(data.legendPosition)
      ? data.legendPosition
      : undefined;
  const highlightSlice = data.highlightSlice
    ? sanitizeSingleLineComment(data.highlightSlice)
    : undefined;
  const comments = Array.isArray(data.comments)
    ? data.comments
        .filter((line): line is string => typeof line === 'string')
        .map(sanitizeSingleLineComment)
        .filter((line) => line.length > 0)
    : undefined;

  return {
    diagramType: 'pie',
    ...(title ? { title } : {}),
    ...(data.showData ? { showData: true } : {}),
    ...(textPosition !== undefined ? { textPosition } : {}),
    ...(donutHole !== undefined ? { donutHole } : {}),
    ...(legendPosition ? { legendPosition } : {}),
    ...(highlightSlice ? { highlightSlice } : {}),
    slices,
    ...(comments && comments.length > 0 ? { comments } : {}),
  };
}

export function generatePieCode(data: PieDiagramData): string {
  const normalized = normalizePieData(data);
  const lines: string[] = [];

  const configEntries: string[] = [];
  if (
    typeof normalized.textPosition === 'number' &&
    normalized.textPosition !== 0.75
  ) {
    configEntries.push(`    textPosition: ${normalized.textPosition}`);
  }
  if (typeof normalized.donutHole === 'number' && normalized.donutHole > 0) {
    configEntries.push(`    donutHole: ${normalized.donutHole}`);
  }
  if (normalized.legendPosition && normalized.legendPosition !== 'right') {
    configEntries.push(`    legendPosition: '${normalized.legendPosition}'`);
  }
  if (normalized.highlightSlice) {
    configEntries.push(
      `    highlightSlice: '${sanitizeYamlSingleQuoted(normalized.highlightSlice)}'`
    );
  }

  if (configEntries.length > 0) {
    lines.push('---');
    lines.push('config:');
    lines.push('  pie:');
    lines.push(...configEntries);
    lines.push('---');
  }

  lines.push(normalized.showData ? 'pie showData' : 'pie');

  if (normalized.title) {
    lines.push(`  title ${normalized.title}`);
  }

  if (normalized.comments && normalized.comments.length > 0) {
    for (const comment of normalized.comments) {
      lines.push(`  %% ${comment}`);
    }
  }

  for (let i = 0; i < normalized.slices.length; i++) {
    const slice = normalized.slices[i];
    const safeLabel = sanitizePieLabel(slice.label, `Item ${i + 1}`);
    lines.push(`  "${safeLabel}" : ${slice.value}`);
  }

  lines.push(formatGuiStateLine(normalized));
  return lines.join('\n');
}

export function parsePieCodeToGuiData(code: string): PieDiagramData {
  const lines = code.split(/\r?\n/);

  const restored = extractGuiStateJson(lines, isValidPieData);
  if (restored) {
    return normalizePieData(restored);
  }

  let title: string | undefined;
  let showData = false;
  let textPosition: number | undefined;
  let donutHole: number | undefined;
  let legendPosition: PieLegendPosition | undefined;
  let highlightSlice: string | undefined;
  const comments: string[] = [];
  const slices: PieSliceData[] = [];

  let i = 0;
  if (lines[0]?.trim() === '---') {
    i = 1;
    let inPieConfig = false;
    while (i < lines.length && lines[i].trim() !== '---') {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();
      if (/^pie\s*:/.test(trimmed)) {
        inPieConfig = true;
      } else if (inPieConfig && /^textPosition\s*:/.test(trimmed)) {
        const num = Number(trimmed.slice(trimmed.indexOf(':') + 1).trim());
        if (Number.isFinite(num)) {
          textPosition = num;
        }
      } else if (inPieConfig && /^donutHole\s*:/.test(trimmed)) {
        const num = Number(trimmed.slice(trimmed.indexOf(':') + 1).trim());
        if (Number.isFinite(num)) {
          donutHole = num;
        }
      } else if (inPieConfig && /^legendPosition\s*:/.test(trimmed)) {
        const pos = unquoteYamlString(trimmed.slice(trimmed.indexOf(':') + 1));
        if (VALID_LEGEND_POSITIONS.has(pos as PieLegendPosition)) {
          legendPosition = pos as PieLegendPosition;
        }
      } else if (inPieConfig && /^highlightSlice\s*:/.test(trimmed)) {
        highlightSlice = unquoteYamlString(trimmed.slice(trimmed.indexOf(':') + 1));
      } else if (inPieConfig && rawLine.length > 0 && !/^\s/.test(rawLine)) {
        inPieConfig = false;
      }
      i++;
    }
    if (i < lines.length && lines[i].trim() === '---') {
      i++;
    }
  }

  let foundHeader = false;
  for (; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed.startsWith('%%{')) {
      const initMatch = trimmed.match(/^%%\{init\s*:\s*([\s\S]*?)\}%%$/);
      if (initMatch) {
        try {
          const parsedInit = JSON.parse(initMatch[1]) as {
            pie?: {
              textPosition?: unknown;
              donutHole?: unknown;
              legendPosition?: unknown;
              highlightSlice?: unknown;
            };
          };
          if (typeof parsedInit.pie?.textPosition === 'number') {
            textPosition = parsedInit.pie.textPosition;
          }
          if (typeof parsedInit.pie?.donutHole === 'number') {
            donutHole = parsedInit.pie.donutHole;
          }
          if (
            typeof parsedInit.pie?.legendPosition === 'string' &&
            VALID_LEGEND_POSITIONS.has(parsedInit.pie.legendPosition as PieLegendPosition)
          ) {
            legendPosition = parsedInit.pie.legendPosition as PieLegendPosition;
          }
          if (typeof parsedInit.pie?.highlightSlice === 'string') {
            highlightSlice = parsedInit.pie.highlightSlice;
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
      const headerMatch = trimmed.match(/^pie\b(.*)$/i);
      if (headerMatch) {
        foundHeader = true;
        let rest = headerMatch[1].trim();
        if (/^showData\b/i.test(rest)) {
          showData = true;
          rest = rest.replace(/^showData\b/i, '').trim();
        }
        const inlineTitle = rest.match(/^title\s+(.+)$/i);
        if (inlineTitle) {
          title = inlineTitle[1].trim();
        }
      }
      continue;
    }

    if (/^showData\b/i.test(trimmed)) {
      showData = true;
      continue;
    }

    const titleMatch = trimmed.match(/^title\s+(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      continue;
    }

    if (/^accTitle\s*:/i.test(trimmed) || /^accDescr\s*[:{]/i.test(trimmed)) {
      continue;
    }

    const sliceMatch = trimmed.match(/^"([^"]*)"\s*:\s*([+-]?\d+(?:\.\d+)?)/);
    if (sliceMatch) {
      const label = sliceMatch[1].trim();
      const val = Number(sliceMatch[2]);
      if (Number.isFinite(val)) {
        slices.push({
          id: `slice_${slices.length + 1}`,
          label: label || `Item ${slices.length + 1}`,
          value: Math.max(0, val),
        });
      }
    }
  }

  return normalizePieData({
    diagramType: 'pie',
    ...(title ? { title } : {}),
    ...(showData ? { showData: true } : {}),
    ...(textPosition !== undefined ? { textPosition } : {}),
    ...(donutHole !== undefined ? { donutHole } : {}),
    ...(legendPosition ? { legendPosition } : {}),
    ...(highlightSlice ? { highlightSlice } : {}),
    slices,
    ...(comments.length > 0 ? { comments } : {}),
  });
}
