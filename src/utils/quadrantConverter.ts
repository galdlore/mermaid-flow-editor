import type {
  QuadrantClassDefData,
  QuadrantConfigData,
  QuadrantDiagramData,
  QuadrantPointData,
} from '../types/editor';
import {
  GUI_STATE_PREFIX,
  allocateUniqueId,
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
} from './mermaidEnvelope.ts';

export const DEFAULT_QUADRANT_CONFIG: QuadrantConfigData = {
  chartWidth: 500,
  chartHeight: 500,
};

export function createDefaultQuadrantData(
  lang: 'ja' | 'en' = 'ja'
): QuadrantDiagramData {
  const isJa = lang === 'ja';
  return {
    diagramType: 'quadrantChart',
    title: isJa ? '施策の優先度マトリクス' : 'Reach and Engagement Matrix',
    xAxisLeft: isJa ? '低コスト' : 'Low Reach',
    xAxisRight: isJa ? '高コスト' : 'High Reach',
    yAxisBottom: isJa ? '効果小' : 'Low Engagement',
    yAxisTop: isJa ? '効果大' : 'High Engagement',
    quadrant1: isJa ? '計画的に推進' : 'We should expand',
    quadrant2: isJa ? '最優先で実施' : 'Need to promote',
    quadrant3: isJa ? '見直し・保留' : 'Re-evaluate',
    quadrant4: isJa ? '効率化を検討' : 'May be improved',
    config: { ...DEFAULT_QUADRANT_CONFIG },
    points: [
      {
        id: 'pt_1',
        label: isJa ? '施策A' : 'Campaign A',
        x: 0.3,
        y: 0.65,
      },
      {
        id: 'pt_2',
        label: isJa ? '施策B' : 'Campaign B',
        x: 0.45,
        y: 0.23,
      },
      {
        id: 'pt_3',
        label: isJa ? '施策C' : 'Campaign C',
        x: 0.57,
        y: 0.69,
      },
      {
        id: 'pt_4',
        label: isJa ? '施策D' : 'Campaign D',
        x: 0.78,
        y: 0.34,
      },
      {
        id: 'pt_5',
        label: isJa ? '施策E' : 'Campaign E',
        x: 0.22,
        y: 0.85,
        radius: 8,
        color: '#ef4444',
      },
    ],
  };
}

export function isValidQuadrantData(
  value: unknown
): value is QuadrantDiagramData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as { diagramType?: unknown; points?: unknown };
  return obj.diagramType === 'quadrantChart' && Array.isArray(obj.points);
}

function clampCoord(val: unknown): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, Math.round(val * 100) / 100));
}

/**
 * Mermaidのpoint座標パーサー規則 `(1)|(0(\.\d+)?)` に必ず適合する文字列へ整形する。
 */
export function formatQuadrantCoord(val: number): string {
  const clamped = clampCoord(val);
  if (clamped >= 1) return '1';
  if (clamped <= 0) return '0';
  return Number(clamped.toFixed(2)).toString();
}

function sanitizeQuotedText(raw: string): string {
  return raw.replace(/["\r\n]/g, '').trim();
}

function sanitizeHexColor(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (/^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(trimmed)) {
    return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  }
  return undefined;
}

function sanitizePositiveInt(
  raw: unknown,
  min: number,
  max: number
): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return undefined;
  }
  return Math.max(min, Math.min(max, Math.round(raw)));
}

function sanitizeClassName(raw?: string): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[^a-zA-Z0-9]/g, '').trim();
  return cleaned || undefined;
}

function normalizeQuadrantData(data: QuadrantDiagramData): QuadrantDiagramData {
  const title = data.title ? sanitizeQuotedText(data.title) : '';

  const classDefs: QuadrantClassDefData[] = [];
  const usedClassNames = new Set<string>();
  for (const cd of data.classDefs ?? []) {
    const name = sanitizeClassName(cd.name);
    if (!name || usedClassNames.has(name)) continue;
    usedClassNames.add(name);
    const radius = sanitizePositiveInt(cd.radius, 2, 40);
    const color = sanitizeHexColor(cd.color);
    const strokeColor = sanitizeHexColor(cd.strokeColor);
    const strokeWidthPx = sanitizePositiveInt(cd.strokeWidthPx, 0, 20);
    classDefs.push({
      name,
      ...(radius !== undefined ? { radius } : {}),
      ...(color ? { color } : {}),
      ...(strokeColor ? { strokeColor } : {}),
      ...(strokeWidthPx !== undefined ? { strokeWidthPx } : {}),
    });
  }

  const usedPointIds = new Set<string>();
  const points: QuadrantPointData[] = data.points.map((pt, index) => {
    const baseId =
      typeof pt.id === 'string' && /^[a-zA-Z0-9_-]+$/.test(pt.id)
        ? pt.id
        : `pt_${index + 1}`;
    const id = allocateUniqueId(baseId, usedPointIds);

    const rawLabel = typeof pt.label === 'string' ? pt.label : '';
    const label = sanitizeQuotedText(rawLabel) || `Point ${index + 1}`;
    const className = sanitizeClassName(pt.className);
    const radius = sanitizePositiveInt(pt.radius, 2, 40);
    const color = sanitizeHexColor(pt.color);
    const strokeColor = sanitizeHexColor(pt.strokeColor);
    const strokeWidthPx = sanitizePositiveInt(pt.strokeWidthPx, 0, 20);

    return {
      id,
      label,
      x: clampCoord(pt.x),
      y: clampCoord(pt.y),
      ...(className ? { className } : {}),
      ...(radius !== undefined ? { radius } : {}),
      ...(color ? { color } : {}),
      ...(strokeColor ? { strokeColor } : {}),
      ...(strokeWidthPx !== undefined ? { strokeWidthPx } : {}),
    };
  });

  const chartWidth =
    sanitizePositiveInt(data.config?.chartWidth, 240, 1400) ??
    DEFAULT_QUADRANT_CONFIG.chartWidth;
  const chartHeight =
    sanitizePositiveInt(data.config?.chartHeight, 240, 1400) ??
    DEFAULT_QUADRANT_CONFIG.chartHeight;

  const comments = Array.isArray(data.comments)
    ? data.comments
        .filter((c): c is string => typeof c === 'string')
        .map(sanitizeSingleLineComment)
        .filter((c) => c.length > 0)
    : undefined;

  return {
    diagramType: 'quadrantChart',
    ...(title ? { title } : {}),
    xAxisLeft: sanitizeQuotedText(typeof data.xAxisLeft === 'string' ? data.xAxisLeft : ''),
    ...(typeof data.xAxisRight === 'string' && sanitizeQuotedText(data.xAxisRight)
      ? { xAxisRight: sanitizeQuotedText(data.xAxisRight) }
      : {}),
    yAxisBottom: sanitizeQuotedText(typeof data.yAxisBottom === 'string' ? data.yAxisBottom : ''),
    ...(typeof data.yAxisTop === 'string' && sanitizeQuotedText(data.yAxisTop)
      ? { yAxisTop: sanitizeQuotedText(data.yAxisTop) }
      : {}),
    quadrant1: sanitizeQuotedText(typeof data.quadrant1 === 'string' ? data.quadrant1 : ''),
    quadrant2: sanitizeQuotedText(typeof data.quadrant2 === 'string' ? data.quadrant2 : ''),
    quadrant3: sanitizeQuotedText(typeof data.quadrant3 === 'string' ? data.quadrant3 : ''),
    quadrant4: sanitizeQuotedText(typeof data.quadrant4 === 'string' ? data.quadrant4 : ''),
    points,
    ...(classDefs.length > 0 ? { classDefs } : {}),
    config: {
      chartWidth,
      chartHeight,
    },
    ...(comments && comments.length > 0 ? { comments } : {}),
  };
}

function buildStylePairs(item: {
  radius?: number;
  color?: string;
  strokeColor?: string;
  strokeWidthPx?: number;
}): string {
  const parts: string[] = [];
  if (item.radius !== undefined) {
    parts.push(`radius: ${item.radius}`);
  }
  if (item.color) {
    parts.push(`color: ${item.color}`);
  }
  if (item.strokeColor) {
    parts.push(`stroke-color: ${item.strokeColor}`);
  }
  if (item.strokeWidthPx !== undefined) {
    parts.push(`stroke-width: ${item.strokeWidthPx}px`);
  }
  return parts.join(', ');
}

export function generateQuadrantCode(data: QuadrantDiagramData): string {
  const normalized = normalizeQuadrantData(data);
  const lines: string[] = [];

  const configDiffs: string[] = [];
  if (normalized.config.chartWidth !== DEFAULT_QUADRANT_CONFIG.chartWidth) {
    configDiffs.push(`    chartWidth: ${normalized.config.chartWidth}`);
  }
  if (normalized.config.chartHeight !== DEFAULT_QUADRANT_CONFIG.chartHeight) {
    configDiffs.push(`    chartHeight: ${normalized.config.chartHeight}`);
  }
  if (configDiffs.length > 0) {
    lines.push('---');
    lines.push('config:');
    lines.push('  quadrantChart:');
    lines.push(...configDiffs);
    lines.push('---');
  }

  lines.push('quadrantChart');

  if (normalized.title) {
    lines.push(`  title ${normalized.title}`);
  }

  if (normalized.comments && normalized.comments.length > 0) {
    for (const comment of normalized.comments) {
      lines.push(`  %% ${comment}`);
    }
  }

  if (normalized.xAxisLeft || normalized.xAxisRight) {
    const left = normalized.xAxisLeft ? `"${normalized.xAxisLeft}"` : '""';
    if (normalized.xAxisRight) {
      lines.push(`  x-axis ${left} --> "${normalized.xAxisRight}"`);
    } else {
      lines.push(`  x-axis ${left}`);
    }
  }

  if (normalized.yAxisBottom || normalized.yAxisTop) {
    const bottom = normalized.yAxisBottom
      ? `"${normalized.yAxisBottom}"`
      : '""';
    if (normalized.yAxisTop) {
      lines.push(`  y-axis ${bottom} --> "${normalized.yAxisTop}"`);
    } else {
      lines.push(`  y-axis ${bottom}`);
    }
  }

  if (normalized.quadrant1) lines.push(`  quadrant-1 "${normalized.quadrant1}"`);
  if (normalized.quadrant2) lines.push(`  quadrant-2 "${normalized.quadrant2}"`);
  if (normalized.quadrant3) lines.push(`  quadrant-3 "${normalized.quadrant3}"`);
  if (normalized.quadrant4) lines.push(`  quadrant-4 "${normalized.quadrant4}"`);

  const definedClassNames = new Set(
    (normalized.classDefs ?? []).map((c) => c.name)
  );

  for (const pt of normalized.points) {
    const clsPart =
      pt.className && definedClassNames.has(pt.className)
        ? `:::${pt.className}`
        : pt.className
          ? `:::${pt.className}`
          : '';
    const coords = `[${formatQuadrantCoord(pt.x)}, ${formatQuadrantCoord(pt.y)}]`;
    const styleStr = buildStylePairs(pt);
    lines.push(
      `  "${pt.label}"${clsPart}: ${coords}${styleStr ? ` ${styleStr}` : ''}`
    );
  }

  if (normalized.classDefs) {
    for (const cd of normalized.classDefs) {
      const styleStr = buildStylePairs(cd);
      if (styleStr) {
        lines.push(`  classDef ${cd.name} ${styleStr}`);
      }
    }
  }

  lines.push(formatGuiStateLine(normalized));
  return lines.join('\n');
}

function unquoteScalar(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"`') && trimmed.endsWith('`"') && trimmed.length >= 4) {
    return trimmed.slice(2, -2).trim();
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function parseStyleList(rawStyles: string): {
  radius?: number;
  color?: string;
  strokeColor?: string;
  strokeWidthPx?: number;
} {
  const out: {
    radius?: number;
    color?: string;
    strokeColor?: string;
    strokeWidthPx?: number;
  } = {};

  for (const part of rawStyles.split(',')) {
    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) continue;
    const key = part.slice(0, colonIdx).trim().toLowerCase();
    const val = part.slice(colonIdx + 1).trim();
    if (key === 'radius') {
      const n = Number(val);
      if (Number.isFinite(n)) out.radius = n;
    } else if (key === 'color') {
      const hex = sanitizeHexColor(val);
      if (hex) out.color = hex;
    } else if (key === 'stroke-color') {
      const hex = sanitizeHexColor(val);
      if (hex) out.strokeColor = hex;
    } else if (key === 'stroke-width') {
      const m = val.match(/^(\d+)px$/i);
      if (m) out.strokeWidthPx = Number(m[1]);
    }
  }
  return out;
}

export function parseQuadrantCodeToGuiData(code: string): QuadrantDiagramData {
  const lines = code.split(/\r?\n/);

  const restored = extractGuiStateJson(lines, isValidQuadrantData);
  if (restored) {
    return normalizeQuadrantData(restored);
  }

  let title: string | undefined;
  let xAxisLeft = '';
  let xAxisRight: string | undefined;
  let yAxisBottom = '';
  let yAxisTop: string | undefined;
  let quadrant1 = '';
  let quadrant2 = '';
  let quadrant3 = '';
  let quadrant4 = '';
  const points: QuadrantPointData[] = [];
  const classDefs: QuadrantClassDefData[] = [];
  const config: QuadrantConfigData = { ...DEFAULT_QUADRANT_CONFIG };
  const comments: string[] = [];

  let i = 0;
  if (lines[0]?.trim() === '---') {
    i = 1;
    let inQuadrantConfig = false;
    while (i < lines.length && lines[i].trim() !== '---') {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();
      if (/^quadrantChart\s*:/i.test(trimmed)) {
        inQuadrantConfig = true;
      } else if (inQuadrantConfig && /^chartWidth\s*:/i.test(trimmed)) {
        const v = Number(trimmed.slice(trimmed.indexOf(':') + 1).trim());
        if (Number.isFinite(v)) config.chartWidth = v;
      } else if (inQuadrantConfig && /^chartHeight\s*:/i.test(trimmed)) {
        const v = Number(trimmed.slice(trimmed.indexOf(':') + 1).trim());
        if (Number.isFinite(v)) config.chartHeight = v;
      } else if (inQuadrantConfig && rawLine.length > 0 && !/^\s/.test(rawLine)) {
        inQuadrantConfig = false;
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
    if (!trimmed) continue;

    if (trimmed.startsWith('%%{')) {
      const initMatch = trimmed.match(/^%%\{init\s*:\s*([\s\S]*?)\}%%$/);
      if (initMatch) {
        try {
          const parsedInit = JSON.parse(initMatch[1]) as {
            quadrantChart?: { chartWidth?: unknown; chartHeight?: unknown };
          };
          if (typeof parsedInit.quadrantChart?.chartWidth === 'number') {
            config.chartWidth = parsedInit.quadrantChart.chartWidth;
          }
          if (typeof parsedInit.quadrantChart?.chartHeight === 'number') {
            config.chartHeight = parsedInit.quadrantChart.chartHeight;
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
        if (commentBody) comments.push(commentBody);
      }
      continue;
    }

    if (!foundHeader) {
      if (/^quadrantChart\b/i.test(trimmed)) {
        foundHeader = true;
      }
      continue;
    }

    const titleMatch = trimmed.match(/^title\s+(.+)$/i);
    if (titleMatch) {
      title = sanitizeQuotedText(titleMatch[1]);
      continue;
    }

    if (/^accTitle\s*:/i.test(trimmed) || /^accDescr\s*[:{]/i.test(trimmed)) {
      continue;
    }

    const xAxisMatch = trimmed.match(/^x-axis\s+([\s\S]+)$/i);
    if (xAxisMatch) {
      const arrowParts = xAxisMatch[1].split(/--+>/);
      xAxisLeft = unquoteScalar(arrowParts[0] ?? '');
      xAxisRight = arrowParts[1] ? unquoteScalar(arrowParts[1]) : undefined;
      continue;
    }

    const yAxisMatch = trimmed.match(/^y-axis\s+([\s\S]+)$/i);
    if (yAxisMatch) {
      const arrowParts = yAxisMatch[1].split(/--+>/);
      yAxisBottom = unquoteScalar(arrowParts[0] ?? '');
      yAxisTop = arrowParts[1] ? unquoteScalar(arrowParts[1]) : undefined;
      continue;
    }

    const q1Match = trimmed.match(/^quadrant-1\s+([\s\S]+)$/i);
    if (q1Match) {
      quadrant1 = unquoteScalar(q1Match[1]);
      continue;
    }
    const q2Match = trimmed.match(/^quadrant-2\s+([\s\S]+)$/i);
    if (q2Match) {
      quadrant2 = unquoteScalar(q2Match[1]);
      continue;
    }
    const q3Match = trimmed.match(/^quadrant-3\s+([\s\S]+)$/i);
    if (q3Match) {
      quadrant3 = unquoteScalar(q3Match[1]);
      continue;
    }
    const q4Match = trimmed.match(/^quadrant-4\s+([\s\S]+)$/i);
    if (q4Match) {
      quadrant4 = unquoteScalar(q4Match[1]);
      continue;
    }

    const classDefMatch = trimmed.match(
      /^classDef\s+([a-zA-Z0-9_]+)\s+([\s\S]+)$/i
    );
    if (classDefMatch) {
      const styles = parseStyleList(classDefMatch[2]);
      classDefs.push({
        name: classDefMatch[1],
        ...styles,
      });
      continue;
    }

    // Point line: "Label"[:::cls]: [x, y] [radius: 8, color: #...]
    const pointMatch = trimmed.match(
      /^([\s\S]+?)(?::::([a-zA-Z0-9_]+))?\s*:\s*\[\s*([01](?:\.\d+)?)\s*,\s*([01](?:\.\d+)?)\s*\](?:\s+([\s\S]+))?$/
    );
    if (pointMatch) {
      const label = unquoteScalar(pointMatch[1]);
      const className = pointMatch[2]?.trim() || undefined;
      const x = Number(pointMatch[3]);
      const y = Number(pointMatch[4]);
      const styles = pointMatch[5] ? parseStyleList(pointMatch[5]) : {};
      points.push({
        id: `pt_${points.length + 1}`,
        label,
        x,
        y,
        ...(className ? { className } : {}),
        ...styles,
      });
    }
  }

  return normalizeQuadrantData({
    diagramType: 'quadrantChart',
    ...(title ? { title } : {}),
    xAxisLeft,
    ...(xAxisRight ? { xAxisRight } : {}),
    yAxisBottom,
    ...(yAxisTop ? { yAxisTop } : {}),
    quadrant1,
    quadrant2,
    quadrant3,
    quadrant4,
    points,
    ...(classDefs.length > 0 ? { classDefs } : {}),
    config,
    ...(comments.length > 0 ? { comments } : {}),
  });
}
