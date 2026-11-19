import type {
  XYChartDiagramData,
  XYChartOrientation,
  XYChartSeriesData,
  XYChartSeriesType,
  XYChartXAxisType,
} from '../types/editor';
import {
  GUI_STATE_PREFIX,
  allocateUniqueId,
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
} from './mermaidEnvelope.ts';

export function createDefaultXYChartData(
  lang: 'ja' | 'en' = 'ja'
): XYChartDiagramData {
  const isJa = lang === 'ja';
  return {
    diagramType: 'xychart',
    orientation: 'vertical',
    title: isJa ? '月別売上・利益推移' : 'Monthly Sales & Profit',
    xAxisTitle: isJa ? '月' : 'Month',
    xAxisType: 'band',
    xAxisCategories: isJa
      ? ['1月', '2月', '3月', '4月', '5月', '6月']
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    yAxisTitle: isJa ? '金額 (万円)' : 'Amount ($k)',
    yAxisAutoRange: false,
    yAxisMin: 0,
    yAxisMax: 600,
    showDataLabel: false,
    showDataLabelOutsideBar: false,
    series: [
      {
        id: 'series_1',
        type: 'bar',
        title: isJa ? '売上' : 'Sales',
        values: [240, 310, 290, 420, 480, 530],
      },
      {
        id: 'series_2',
        type: 'line',
        title: isJa ? '利益' : 'Profit',
        values: [80, 120, 105, 160, 195, 220],
      },
    ],
  };
}

export function isValidXYChartData(value: unknown): value is XYChartDiagramData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<XYChartDiagramData>;
  if (
    candidate.diagramType !== 'xychart' ||
    !Array.isArray(candidate.series) ||
    !Array.isArray(candidate.xAxisCategories)
  ) {
    return false;
  }
  return candidate.series.every(
    (s) =>
      Boolean(s) &&
      typeof s.id === 'string' &&
      (s.type === 'bar' || s.type === 'line') &&
      Array.isArray(s.values) &&
      s.values.every((v) => typeof v === 'number' && Number.isFinite(v))
  );
}

function escapeQuotedXYText(raw: string): string {
  return raw
    .replace(/"/g, '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeXYChartData(data: XYChartDiagramData): XYChartDiagramData {
  const orientation: XYChartOrientation =
    data.orientation === 'horizontal' ? 'horizontal' : 'vertical';
  const xAxisType: XYChartXAxisType =
    data.xAxisType === 'linear' ? 'linear' : 'band';

  const xAxisCategories = data.xAxisCategories.map(
    (c, idx) => escapeQuotedXYText(c) || `${idx + 1}`
  );

  const usedIds = new Set<string>();
  const series: XYChartSeriesData[] = data.series.map((s, index) => {
    const baseId =
      s.id.replace(/[^a-zA-Z0-9_-]/g, '_') || `series_${index + 1}`;
    const uniqueId = allocateUniqueId(baseId, usedIds);

    const values = s.values.map((v) =>
      typeof v === 'number' && Number.isFinite(v) ? Number(v.toFixed(4)) : 0
    );
    const title = s.title ? escapeQuotedXYText(s.title) : '';

    return {
      id: uniqueId,
      type: s.type === 'line' ? 'line' : 'bar',
      ...(title ? { title } : {}),
      values,
    };
  });

  const title = data.title ? escapeQuotedXYText(data.title) : '';
  const xAxisTitle = data.xAxisTitle ? escapeQuotedXYText(data.xAxisTitle) : '';
  const yAxisTitle = data.yAxisTitle ? escapeQuotedXYText(data.yAxisTitle) : '';

  const xAxisMin =
    typeof data.xAxisMin === 'number' && Number.isFinite(data.xAxisMin)
      ? data.xAxisMin
      : 1;
  const xAxisMaxRaw =
    typeof data.xAxisMax === 'number' && Number.isFinite(data.xAxisMax)
      ? data.xAxisMax
      : Math.max(xAxisMin + 1, 10);
  const xAxisMax = xAxisMaxRaw >= xAxisMin ? xAxisMaxRaw : xAxisMin + 1;

  const yAxisAutoRange = Boolean(data.yAxisAutoRange);
  const yAxisMin =
    typeof data.yAxisMin === 'number' && Number.isFinite(data.yAxisMin)
      ? data.yAxisMin
      : 0;
  const yAxisMaxRaw =
    typeof data.yAxisMax === 'number' && Number.isFinite(data.yAxisMax)
      ? data.yAxisMax
      : Math.max(yAxisMin + 10, 100);
  const yAxisMax = yAxisMaxRaw > yAxisMin ? yAxisMaxRaw : yAxisMin + 10;

  const chartWidth =
    typeof data.chartWidth === 'number' &&
    Number.isFinite(data.chartWidth) &&
    data.chartWidth >= 300 &&
    data.chartWidth <= 2000
      ? Math.round(data.chartWidth)
      : undefined;
  const chartHeight =
    typeof data.chartHeight === 'number' &&
    Number.isFinite(data.chartHeight) &&
    data.chartHeight >= 240 &&
    data.chartHeight <= 1600
      ? Math.round(data.chartHeight)
      : undefined;

  const comments = Array.isArray(data.comments)
    ? data.comments
        .filter((line): line is string => typeof line === 'string')
        .map(sanitizeSingleLineComment)
        .filter((line) => line.length > 0)
    : undefined;

  return {
    diagramType: 'xychart',
    orientation,
    ...(title ? { title } : {}),
    ...(xAxisTitle ? { xAxisTitle } : {}),
    xAxisType,
    xAxisCategories,
    ...(xAxisType === 'linear' ? { xAxisMin, xAxisMax } : {}),
    ...(yAxisTitle ? { yAxisTitle } : {}),
    yAxisAutoRange,
    ...(!yAxisAutoRange ? { yAxisMin, yAxisMax } : {}),
    series,
    ...(data.showDataLabel ? { showDataLabel: true } : {}),
    ...(data.showDataLabelOutsideBar ? { showDataLabelOutsideBar: true } : {}),
    ...(chartWidth ? { chartWidth } : {}),
    ...(chartHeight ? { chartHeight } : {}),
    ...(comments && comments.length > 0 ? { comments } : {}),
  };
}

export function generateXYChartCode(data: XYChartDiagramData): string {
  const normalized = normalizeXYChartData(data);
  const lines: string[] = [];

  const configEntries: string[] = [];
  if (normalized.showDataLabel) {
    configEntries.push('    showDataLabel: true');
  }
  if (normalized.showDataLabelOutsideBar) {
    configEntries.push('    showDataLabelOutsideBar: true');
  }
  if (normalized.chartWidth && normalized.chartWidth !== 700) {
    configEntries.push(`    width: ${normalized.chartWidth}`);
  }
  if (normalized.chartHeight && normalized.chartHeight !== 500) {
    configEntries.push(`    height: ${normalized.chartHeight}`);
  }

  if (configEntries.length > 0) {
    lines.push('---');
    lines.push('config:');
    lines.push('  xyChart:');
    lines.push(...configEntries);
    lines.push('---');
  }

  lines.push(
    normalized.orientation === 'horizontal'
      ? 'xychart-beta horizontal'
      : 'xychart-beta'
  );

  if (normalized.title) {
    // Always wrap title in double quotes so Japanese/spaces/punctuation never fail lexing
    lines.push(`  title "${normalized.title}"`);
  }

  if (normalized.comments && normalized.comments.length > 0) {
    for (const comment of normalized.comments) {
      lines.push(`  %% ${comment}`);
    }
  }

  const xTitlePart = normalized.xAxisTitle ? ` "${normalized.xAxisTitle}"` : '';
  if (normalized.xAxisType === 'band') {
    const safeCats =
      normalized.xAxisCategories.length > 0
        ? normalized.xAxisCategories
        : ['1'];
    const catList = safeCats.map((cat) => `"${cat}"`).join(', ');
    lines.push(`  x-axis${xTitlePart} [${catList}]`);
  } else {
    lines.push(
      `  x-axis${xTitlePart} ${normalized.xAxisMin ?? 1} --> ${normalized.xAxisMax ?? 10}`
    );
  }

  const yTitlePart = normalized.yAxisTitle ? ` "${normalized.yAxisTitle}"` : '';
  const yRangePart = !normalized.yAxisAutoRange
    ? ` ${normalized.yAxisMin ?? 0} --> ${normalized.yAxisMax ?? 100}`
    : '';
  if (yTitlePart || yRangePart) {
    lines.push(`  y-axis${yTitlePart}${yRangePart}`);
  }

  const targetCount =
    normalized.xAxisType === 'band' && normalized.xAxisCategories.length > 0
      ? normalized.xAxisCategories.length
      : Math.max(1, ...normalized.series.map((s) => s.values.length));

  for (const series of normalized.series) {
    const titlePart = series.title ? ` "${series.title}"` : '';
    const adjustedValues =
      normalized.xAxisType === 'band'
        ? Array.from({ length: targetCount }, (_, i) => series.values[i] ?? 0)
        : series.values.length > 0
          ? series.values
          : [0];
    lines.push(`  ${series.type}${titlePart} [${adjustedValues.join(', ')}]`);
  }

  lines.push(formatGuiStateLine(normalized));
  return lines.join('\n');
}

function parseLeadingXYText(input: string): { text: string; rest: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { text: '', rest: '' };
  }
  if (trimmed.startsWith('"')) {
    const endQuote = trimmed.indexOf('"', 1);
    if (endQuote !== -1) {
      return {
        text: trimmed.slice(1, endQuote).trim(),
        rest: trimmed.slice(endQuote + 1).trim(),
      };
    }
  }
  // If range or bracket starts immediately, there is no title text
  if (
    trimmed.startsWith('[') ||
    /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)\s*-->/.test(trimmed)
  ) {
    return { text: '', rest: trimmed };
  }
  const rangeOrBracketMatch = trimmed.match(
    /^([\s\S]+?)\s+(\[[\s\S]*\]|[+-]?(?:\d+(?:\.\d+)?|\.\d+)\s*-->[\s\S]*)$/
  );
  if (rangeOrBracketMatch) {
    return {
      text: rangeOrBracketMatch[1].trim(),
      rest: rangeOrBracketMatch[2].trim(),
    };
  }
  return { text: trimmed, rest: '' };
}

function parseBracketStringList(bracketContent: string): string[] {
  const items: string[] = [];
  let i = 0;
  const len = bracketContent.length;
  while (i < len) {
    while (i < len && (bracketContent[i] === ',' || /\s/.test(bracketContent[i]))) {
      i++;
    }
    if (i >= len) {
      break;
    }
    if (bracketContent[i] === '"') {
      const close = bracketContent.indexOf('"', i + 1);
      if (close !== -1) {
        items.push(bracketContent.slice(i + 1, close).trim());
        i = close + 1;
        continue;
      }
    }
    const comma = bracketContent.indexOf(',', i);
    const chunk =
      comma === -1
        ? bracketContent.slice(i).trim()
        : bracketContent.slice(i, comma).trim();
    if (chunk) {
      items.push(chunk);
    }
    if (comma === -1) {
      break;
    }
    i = comma + 1;
  }
  return items;
}

export function parseXYChartCodeToGuiData(code: string): XYChartDiagramData {
  const lines = code.split(/\r?\n/);

  const restored = extractGuiStateJson(lines, isValidXYChartData);
  if (restored) {
    return normalizeXYChartData(restored);
  }

  let orientation: XYChartOrientation = 'vertical';
  let title: string | undefined;
  let xAxisTitle: string | undefined;
  let xAxisType: XYChartXAxisType = 'band';
  let xAxisCategories: string[] = [];
  let xAxisMin: number | undefined;
  let xAxisMax: number | undefined;
  let yAxisTitle: string | undefined;
  let yAxisAutoRange = true;
  let yAxisMin: number | undefined;
  let yAxisMax: number | undefined;
  let showDataLabel = false;
  let showDataLabelOutsideBar = false;
  let chartWidth: number | undefined;
  let chartHeight: number | undefined;
  const series: XYChartSeriesData[] = [];
  const comments: string[] = [];

  let i = 0;
  if (lines[0]?.trim() === '---') {
    i = 1;
    let inXYConfig = false;
    while (i < lines.length && lines[i].trim() !== '---') {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();
      if (/^xyChart\s*:/i.test(trimmed)) {
        inXYConfig = true;
      } else if (inXYConfig && /^showDataLabel\s*:/i.test(trimmed)) {
        showDataLabel = /true/i.test(trimmed.slice(trimmed.indexOf(':') + 1));
      } else if (inXYConfig && /^showDataLabelOutsideBar\s*:/i.test(trimmed)) {
        showDataLabelOutsideBar = /true/i.test(
          trimmed.slice(trimmed.indexOf(':') + 1)
        );
      } else if (inXYConfig && /^width\s*:/i.test(trimmed)) {
        const n = Number(trimmed.slice(trimmed.indexOf(':') + 1).trim());
        if (Number.isFinite(n)) {
          chartWidth = n;
        }
      } else if (inXYConfig && /^height\s*:/i.test(trimmed)) {
        const n = Number(trimmed.slice(trimmed.indexOf(':') + 1).trim());
        if (Number.isFinite(n)) {
          chartHeight = n;
        }
      } else if (inXYConfig && rawLine.length > 0 && !/^\s/.test(rawLine)) {
        inXYConfig = false;
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
            xyChart?: {
              showDataLabel?: unknown;
              showDataLabelOutsideBar?: unknown;
              width?: unknown;
              height?: unknown;
            };
          };
          if (typeof parsedInit.xyChart?.showDataLabel === 'boolean') {
            showDataLabel = parsedInit.xyChart.showDataLabel;
          }
          if (
            typeof parsedInit.xyChart?.showDataLabelOutsideBar === 'boolean'
          ) {
            showDataLabelOutsideBar = parsedInit.xyChart.showDataLabelOutsideBar;
          }
          if (typeof parsedInit.xyChart?.width === 'number') {
            chartWidth = parsedInit.xyChart.width;
          }
          if (typeof parsedInit.xyChart?.height === 'number') {
            chartHeight = parsedInit.xyChart.height;
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
      const headerMatch = trimmed.match(/^xychart(?:-beta)?\b(.*)$/i);
      if (headerMatch) {
        foundHeader = true;
        if (/\bhorizontal\b/i.test(headerMatch[1])) {
          orientation = 'horizontal';
        }
      }
      continue;
    }

    const titleMatch = trimmed.match(/^title\s+([\s\S]+)$/i);
    if (titleMatch) {
      const { text } = parseLeadingXYText(titleMatch[1]);
      title = text || undefined;
      continue;
    }

    const xAxisMatch = trimmed.match(/^x-axis(?:\s+([\s\S]+))?$/i);
    if (xAxisMatch) {
      const body = (xAxisMatch[1] ?? '').trim();
      const { text, rest } = parseLeadingXYText(body);
      xAxisTitle = text || undefined;
      if (rest.startsWith('[')) {
        const bracketEnd = rest.lastIndexOf(']');
        const inner =
          bracketEnd !== -1 ? rest.slice(1, bracketEnd) : rest.slice(1);
        xAxisType = 'band';
        xAxisCategories = parseBracketStringList(inner);
      } else {
        const rangeMatch = rest.match(
          /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*-->\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))$/
        );
        if (rangeMatch) {
          xAxisType = 'linear';
          xAxisMin = Number(rangeMatch[1]);
          xAxisMax = Number(rangeMatch[2]);
        }
      }
      continue;
    }

    const yAxisMatch = trimmed.match(/^y-axis(?:\s+([\s\S]+))?$/i);
    if (yAxisMatch) {
      const body = (yAxisMatch[1] ?? '').trim();
      const { text, rest } = parseLeadingXYText(body);
      yAxisTitle = text || undefined;
      const rangeMatch = rest.match(
        /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*-->\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))$/
      );
      if (rangeMatch) {
        yAxisAutoRange = false;
        yAxisMin = Number(rangeMatch[1]);
        yAxisMax = Number(rangeMatch[2]);
      }
      continue;
    }

    const plotMatch = trimmed.match(/^(bar|line)\s+([\s\S]+)$/i);
    if (plotMatch) {
      const plotType = plotMatch[1].toLowerCase() as XYChartSeriesType;
      const { text, rest } = parseLeadingXYText(plotMatch[2]);
      const bracketMatch = rest.match(/^\[([\s\S]*)\]$/);
      if (bracketMatch) {
        const values = bracketMatch[1]
          .split(',')
          .map((token) => Number(token.trim()))
          .filter((n) => Number.isFinite(n));
        series.push({
          id: `series_${series.length + 1}`,
          type: plotType,
          ...(text ? { title: text } : {}),
          values,
        });
      }
    }
  }

  if (xAxisType === 'band' && xAxisCategories.length === 0) {
    const maxLen = Math.max(0, ...series.map((s) => s.values.length));
    if (maxLen > 0) {
      xAxisCategories = Array.from({ length: maxLen }, (_, idx) => `${idx + 1}`);
    }
  }

  return normalizeXYChartData({
    diagramType: 'xychart',
    orientation,
    ...(title ? { title } : {}),
    ...(xAxisTitle ? { xAxisTitle } : {}),
    xAxisType,
    xAxisCategories,
    ...(xAxisMin !== undefined ? { xAxisMin } : {}),
    ...(xAxisMax !== undefined ? { xAxisMax } : {}),
    ...(yAxisTitle ? { yAxisTitle } : {}),
    yAxisAutoRange,
    ...(yAxisMin !== undefined ? { yAxisMin } : {}),
    ...(yAxisMax !== undefined ? { yAxisMax } : {}),
    series,
    ...(showDataLabel ? { showDataLabel: true } : {}),
    ...(showDataLabelOutsideBar ? { showDataLabelOutsideBar: true } : {}),
    ...(chartWidth !== undefined ? { chartWidth } : {}),
    ...(chartHeight !== undefined ? { chartHeight } : {}),
    ...(comments.length > 0 ? { comments } : {}),
  });
}
