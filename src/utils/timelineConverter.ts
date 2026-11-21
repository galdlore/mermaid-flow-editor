import type {
  TimelineDiagramData,
  TimelineDirection,
  TimelinePeriodData,
  TimelineSectionData,
} from '../types/editor';
import {
  allocateUniqueId,
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
  unquoteYamlString,
} from './mermaidEnvelope.ts';

const VALID_DIRECTIONS = new Set<TimelineDirection>(['LR', 'TD']);

export function createDefaultTimelineData(
  lang: 'ja' | 'en' = 'ja'
): TimelineDiagramData {
  const isJa = lang === 'ja';
  return {
    diagramType: 'timeline',
    title: isJa ? 'プロダクト開発の歩み' : 'Product Evolution Timeline',
    direction: 'LR',
    sections: [
      { id: 'sec_1', title: isJa ? '立ち上げ期' : 'Foundation' },
      { id: 'sec_2', title: isJa ? '拡大期' : 'Growth' },
    ],
    periods: [
      {
        id: 'tp_1',
        sectionId: 'sec_1',
        period: isJa ? '2024 Q1' : '2024 Q1',
        events: [
          isJa ? '要件定義と試作版開発' : 'Initial design & prototype',
          isJa ? '社内テスト公開' : 'Internal alpha launch',
        ],
      },
      {
        id: 'tp_2',
        sectionId: 'sec_1',
        period: isJa ? '2024 Q3' : '2024 Q3',
        events: [isJa ? 'パブリックベータ公開' : 'Public beta release'],
      },
      {
        id: 'tp_3',
        sectionId: 'sec_2',
        period: isJa ? '2025 Q1' : '2025 Q1',
        events: [
          isJa ? '正式版 v1.0 リリース' : 'General availability v1.0',
          isJa ? 'クラウド連携を追加' : 'Added cloud integration',
        ],
      },
      {
        id: 'tp_4',
        sectionId: 'sec_2',
        period: isJa ? '2025 Q4' : '2025 Q4',
        events: [isJa ? '利用者10万人達成' : 'Reached 100k active users'],
      },
    ],
  };
}

export function isValidTimelineData(
  value: unknown
): value is TimelineDiagramData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Partial<TimelineDiagramData>;
  if (
    obj.diagramType !== 'timeline' ||
    !Array.isArray(obj.sections) ||
    !Array.isArray(obj.periods)
  ) {
    return false;
  }
  return obj.periods.every(
    (p) =>
      Boolean(p) &&
      typeof p === 'object' &&
      typeof p.id === 'string' &&
      typeof p.period === 'string' &&
      Array.isArray(p.events)
  );
}

function sanitizeTimelineText(raw: string): string {
  return raw.replace(/[:#\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeTimelineData(
  data: TimelineDiagramData
): TimelineDiagramData {
  const direction: TimelineDirection =
    data.direction && VALID_DIRECTIONS.has(data.direction)
      ? data.direction
      : 'LR';
  const title =
    typeof data.title === 'string'
      ? sanitizeTimelineText(data.title)
      : undefined;

  const usedSecIds = new Set<string>();
  const sections: TimelineSectionData[] = [];
  for (let i = 0; i < data.sections.length; i++) {
    const raw = data.sections[i];
    const baseId =
      raw.id && /^[a-zA-Z0-9_-]+$/.test(raw.id) ? raw.id : `sec_${i + 1}`;
    const id = allocateUniqueId(baseId, usedSecIds);
    const secTitle = sanitizeTimelineText(raw.title) || `Section ${i + 1}`;
    sections.push({ id, title: secTitle });
  }
  const validSecIdSet = new Set(sections.map((s) => s.id));

  const usedPeriodIds = new Set<string>();
  const periods: TimelinePeriodData[] = [];
  for (let i = 0; i < data.periods.length; i++) {
    const raw = data.periods[i];
    const baseId =
      raw.id && /^[a-zA-Z0-9_-]+$/.test(raw.id) ? raw.id : `tp_${i + 1}`;
    const id = allocateUniqueId(baseId, usedPeriodIds);
    const sectionId =
      raw.sectionId && validSecIdSet.has(raw.sectionId)
        ? raw.sectionId
        : undefined;
    const period = sanitizeTimelineText(raw.period) || `Period ${i + 1}`;
    const events = raw.events
      .filter((ev): ev is string => typeof ev === 'string')
      .map(sanitizeTimelineText)
      .filter((ev) => ev.length > 0);
    periods.push({
      id,
      ...(sectionId ? { sectionId } : {}),
      period,
      events,
    });
  }

  const comments = Array.isArray(data.comments)
    ? data.comments
        .filter((c): c is string => typeof c === 'string')
        .map(sanitizeSingleLineComment)
        .filter((c) => c.length > 0)
    : undefined;

  return {
    diagramType: 'timeline',
    ...(title ? { title } : {}),
    direction,
    sections,
    periods,
    ...(comments && comments.length > 0 ? { comments } : {}),
  };
}

function emitPeriodLines(lines: string[], item: TimelinePeriodData): void {
  if (item.events.length === 0) {
    lines.push(`    ${item.period}`);
    return;
  }
  lines.push(`    ${item.period} : ${item.events[0]}`);
  for (let i = 1; i < item.events.length; i++) {
    lines.push(`      : ${item.events[i]}`);
  }
}

export function generateTimelineCode(rawData: TimelineDiagramData): string {
  const data = normalizeTimelineData(rawData);
  const lines: string[] = [];

  lines.push(data.direction === 'TD' ? 'timeline TD' : 'timeline');

  if (data.title && data.title.trim()) {
    lines.push(`  title ${data.title.trim()}`);
  }

  for (const comment of data.comments ?? []) {
    const clean = sanitizeSingleLineComment(comment);
    if (clean) {
      lines.push(`  %% ${clean}`);
    }
  }

  const sectionIds = new Set(data.sections.map((s) => s.id));
  const unsectioned = data.periods.filter(
    (p) => !p.sectionId || !sectionIds.has(p.sectionId)
  );
  for (const period of unsectioned) {
    emitPeriodLines(lines, period);
  }

  for (const section of data.sections) {
    lines.push(`  section ${section.title}`);
    const secPeriods = data.periods.filter((p) => p.sectionId === section.id);
    for (const period of secPeriods) {
      emitPeriodLines(lines, period);
    }
  }

  lines.push(formatGuiStateLine(data));
  return lines.join('\n');
}

export function parseTimelineCodeToGuiData(code: string): TimelineDiagramData {
  const lines = code.split(/\r?\n/);
  const fromGuiState = extractGuiStateJson(lines, isValidTimelineData);
  if (fromGuiState) {
    return normalizeTimelineData(fromGuiState);
  }

  let title: string | undefined;
  let direction: TimelineDirection = 'LR';
  const sections: TimelineSectionData[] = [];
  const periods: TimelinePeriodData[] = [];
  const comments: string[] = [];

  let currentSectionId: string | undefined;
  let lastPeriod: TimelinePeriodData | null = null;
  let inFrontmatter = false;
  let secSeq = 1;
  let tpSeq = 1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
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
        continue;
      }
      const fmTitle = /^title\s*:\s*(.+)$/i.exec(trimmed);
      if (fmTitle) {
        title = unquoteYamlString(fmTitle[1]);
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

    if (trimmed.startsWith('#')) {
      continue;
    }

    const headerMatch = /^timeline(?:\s+(LR|TD))?\b/i.exec(trimmed);
    if (headerMatch) {
      if (headerMatch[1]) {
        direction = headerMatch[1].toUpperCase() as TimelineDirection;
      }
      continue;
    }

    const titleMatch = /^title\s+(.+)$/i.exec(trimmed);
    if (titleMatch) {
      title = titleMatch[1].trim();
      continue;
    }

    if (/^accTitle\s*:|^accDescr\s*[:{]/i.test(trimmed)) {
      continue;
    }

    const secMatch = /^section\s+(.+)$/i.exec(trimmed);
    if (secMatch) {
      const id = `sec_${secSeq++}`;
      sections.push({
        id,
        title: sanitizeTimelineText(secMatch[1]) || `Section ${sections.length + 1}`,
      });
      currentSectionId = id;
      lastPeriod = null;
      continue;
    }

    // Continuation line starting with ":"
    if (trimmed.startsWith(':')) {
      const contEvents = trimmed
        .split(/\s+:\s+|^:\s*/)
        .map(sanitizeTimelineText)
        .filter((ev) => ev.length > 0);
      if (lastPeriod && contEvents.length > 0) {
        lastPeriod.events.push(...contEvents);
      }
      continue;
    }

    // Period line: "period : event1 : event2" or "period"
    const cleanLine = trimmed.replace(/#.*$/, '').trim();
    if (!cleanLine) {
      continue;
    }
    const colonIdx = cleanLine.indexOf(':');
    if (colonIdx === -1) {
      const item: TimelinePeriodData = {
        id: `tp_${tpSeq++}`,
        ...(currentSectionId ? { sectionId: currentSectionId } : {}),
        period: sanitizeTimelineText(cleanLine) || `Period ${periods.length + 1}`,
        events: [],
      };
      periods.push(item);
      lastPeriod = item;
    } else {
      const periodText = sanitizeTimelineText(cleanLine.slice(0, colonIdx));
      const rest = cleanLine.slice(colonIdx + 1);
      const evs = rest
        .split(/\s+:\s+/)
        .map(sanitizeTimelineText)
        .filter((ev) => ev.length > 0);
      const item: TimelinePeriodData = {
        id: `tp_${tpSeq++}`,
        ...(currentSectionId ? { sectionId: currentSectionId } : {}),
        period: periodText || `Period ${periods.length + 1}`,
        events: evs,
      };
      periods.push(item);
      lastPeriod = item;
    }
  }

  return normalizeTimelineData({
    diagramType: 'timeline',
    ...(title ? { title } : {}),
    direction,
    sections,
    periods,
    ...(comments.length > 0 ? { comments } : {}),
  });
}
