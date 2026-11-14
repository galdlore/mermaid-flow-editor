import type {
  GanttDiagramData,
  GanttSectionData,
  GanttTaskData,
  GanttTaskStatus,
  GanttWeekday,
  GanttWeekend,
} from '../types/editor';

const GUI_STATE_PREFIX = '%% @gui-state:';
const TASK_TAGS = new Set(['active', 'done', 'crit', 'milestone', 'vert']);
const VALID_WEEKDAYS = new Set<string>([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);

export function createDefaultGanttData(lang: 'ja' | 'en' = 'ja'): GanttDiagramData {
  const isJa = lang === 'ja';
  return {
    diagramType: 'gantt',
    title: isJa ? '開発スケジュール' : 'Development Schedule',
    dateFormat: 'YYYY-MM-DD',
    axisFormat: '%m/%d',
    excludes: 'weekends',
    sections: [
      { id: 'sec_1', title: isJa ? '企画・設計' : 'Planning & Design' },
      { id: 'sec_2', title: isJa ? '開発・リリース' : 'Build & Release' },
    ],
    tasks: [
      {
        id: 't1',
        label: isJa ? '要件定義' : 'Requirements',
        sectionId: 'sec_1',
        status: 'done',
        startMode: 'date',
        startDate: '2026-11-16',
        endMode: 'duration',
        duration: '3d',
      },
      {
        id: 't2',
        label: isJa ? '画面設計' : 'UI Design',
        sectionId: 'sec_1',
        status: 'active',
        crit: true,
        startMode: 'after',
        afterTaskIds: ['t1'],
        endMode: 'duration',
        duration: '4d',
      },
      {
        id: 't3',
        label: isJa ? '実装フェーズ' : 'Implementation',
        sectionId: 'sec_2',
        status: 'normal',
        startMode: 'after',
        afterTaskIds: ['t2'],
        endMode: 'duration',
        duration: '5d',
      },
      {
        id: 't4',
        label: isJa ? 'リリース判定' : 'Release Gate',
        sectionId: 'sec_2',
        status: 'normal',
        crit: true,
        milestone: true,
        startMode: 'after',
        afterTaskIds: ['t3'],
        endMode: 'duration',
        duration: '0d',
      },
    ],
  };
}

export function isValidGanttData(value: unknown): value is GanttDiagramData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Partial<GanttDiagramData>;
  return (
    obj.diagramType === 'gantt' &&
    Array.isArray(obj.sections) &&
    Array.isArray(obj.tasks)
  );
}

function sanitizeGanttText(raw: string): string {
  return raw
    .replace(/[:#;]/g, ' ')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function sanitizeTaskId(raw: string, fallbackIndex: number): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_');
  return cleaned || `t${fallbackIndex}`;
}

function buildReferencedTaskIds(tasks: ReadonlyArray<GanttTaskData>): Set<string> {
  const refs = new Set<string>();
  for (const task of tasks) {
    for (const id of task.afterTaskIds ?? []) {
      if (id.trim()) refs.add(id.trim());
    }
    for (const id of task.untilTaskIds ?? []) {
      if (id.trim()) refs.add(id.trim());
    }
  }
  return refs;
}

function formatGanttTaskLine(
  task: GanttTaskData,
  taskIndex: number,
  prevTask: GanttTaskData | null,
  referencedIds: ReadonlySet<string>,
  fallbackStartDate: string
): string {
  const label = sanitizeGanttText(task.label) || `Task ${taskIndex + 1}`;
  const id = sanitizeTaskId(task.id, taskIndex + 1);
  const parts: string[] = [];

  if (task.crit) parts.push('crit');
  if (task.status === 'done') parts.push('done');
  else if (task.status === 'active') parts.push('active');
  if (task.milestone) parts.push('milestone');
  if (task.vert) parts.push('vert');

  const endSpec =
    task.endMode === 'until' && (task.untilTaskIds?.length ?? 0) > 0
      ? `until ${task.untilTaskIds!.join(' ')}`
      : task.endMode === 'date' && task.endDate?.trim()
        ? task.endDate.trim()
        : (task.duration?.trim() || (task.milestone ? '0d' : '3d'));

  let startSpec = '';
  if (task.startMode === 'after' && (task.afterTaskIds?.length ?? 0) > 0) {
    startSpec = `after ${task.afterTaskIds!.join(' ')}`;
  } else if (task.startMode === 'date') {
    startSpec = task.startDate?.trim() || fallbackStartDate;
  } else if (!prevTask) {
    startSpec = task.startDate?.trim() || fallbackStartDate;
  }

  // autoモードでもクリックリンクや依存先として参照される場合は明示IDを持たせる
  const needsExplicitId = referencedIds.has(id) || Boolean(task.clickUrl?.trim());
  if (!startSpec && prevTask && needsExplicitId) {
    const prevId = sanitizeTaskId(prevTask.id, taskIndex);
    startSpec = `after ${prevId}`;
  }

  if (startSpec) {
    parts.push(id, startSpec, endSpec);
  } else {
    parts.push(endSpec);
  }

  return `${label} :${parts.join(', ')}`;
}

export function generateGanttCode(data: GanttDiagramData): string {
  const lines: string[] = [];

  if (data.compactMode || data.topAxis) {
    lines.push('---');
    if (data.compactMode) {
      lines.push('displayMode: compact');
    }
    if (data.topAxis) {
      // Mermaid v11.17.2のパーサー不具合(yy.TopAxis)を回避するためconfig経由で設定する
      lines.push('config:', '  gantt:', '    topAxis: true');
    }
    lines.push('---');
  }

  lines.push('gantt');

  if (data.title && data.title.trim()) {
    lines.push(`  title ${sanitizeGanttText(data.title)}`);
  }

  const dateFormat = data.dateFormat.trim() || 'YYYY-MM-DD';
  lines.push(`  dateFormat ${dateFormat}`);

  if (data.axisFormat && data.axisFormat.trim()) {
    lines.push(`  axisFormat ${sanitizeGanttText(data.axisFormat)}`);
  }
  if (data.tickInterval && data.tickInterval.trim()) {
    lines.push(`  tickInterval ${sanitizeGanttText(data.tickInterval)}`);
  }
  if (data.excludes && data.excludes.trim()) {
    lines.push(`  excludes ${sanitizeGanttText(data.excludes)}`);
  }
  if (data.includes && data.includes.trim()) {
    lines.push(`  includes ${sanitizeGanttText(data.includes)}`);
  }
  if (data.weekday) {
    lines.push(`  weekday ${data.weekday}`);
  }
  if (data.weekend && data.weekend !== 'saturday') {
    lines.push(`  weekend ${data.weekend}`);
  }
  if (data.todayMarker && data.todayMarker.trim()) {
    lines.push(`  todayMarker ${data.todayMarker.trim()}`);
  }
  if (data.inclusiveEndDates) {
    lines.push('  inclusiveEndDates');
  }

  for (const comment of data.comments ?? []) {
    const cleanComment = comment.trim();
    if (cleanComment) {
      lines.push(`  %% ${cleanComment}`);
    }
  }

  const sectionIdSet = new Set(data.sections.map((s) => s.id));
  const referencedIds = buildReferencedTaskIds(data.tasks);
  const fallbackDate =
    data.tasks.find((t) => t.startDate?.trim())?.startDate?.trim() || '2026-11-16';

  const orderedTasks: GanttTaskData[] = [];
  const unassigned = data.tasks.filter(
    (t) => !t.sectionId || !sectionIdSet.has(t.sectionId)
  );
  let lastEmitted: GanttTaskData | null = null;
  let globalIdx = 0;

  for (const task of unassigned) {
    lines.push(
      `  ${formatGanttTaskLine(task, globalIdx++, lastEmitted, referencedIds, fallbackDate)}`
    );
    orderedTasks.push(task);
    lastEmitted = task;
  }

  for (const section of data.sections) {
    lines.push(`  section ${sanitizeGanttText(section.title) || section.id}`);
    const secTasks = data.tasks.filter((t) => t.sectionId === section.id);
    for (const task of secTasks) {
      lines.push(
        `    ${formatGanttTaskLine(task, globalIdx++, lastEmitted, referencedIds, fallbackDate)}`
      );
      orderedTasks.push(task);
      lastEmitted = task;
    }
  }

  for (const [idx, task] of orderedTasks.entries()) {
    const url = task.clickUrl?.trim();
    if (url) {
      const id = sanitizeTaskId(task.id, idx + 1);
      const safeUrl = url.replace(/"/g, '%22');
      lines.push(`  click ${id} href "${safeUrl}"`);
    }
  }

  lines.push(`${GUI_STATE_PREFIX} ${JSON.stringify(data)}`);
  return lines.join('\n');
}

function parseTaskTokens(
  rawData: string,
  index: number
): Omit<GanttTaskData, 'label' | 'sectionId'> {
  const tokens = rawData
    .replace(/^:/, '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let status: GanttTaskStatus = 'normal';
  let crit = false;
  let milestone = false;
  let vert = false;

  while (tokens.length > 0 && TASK_TAGS.has(tokens[0])) {
    const tag = tokens.shift()!;
    if (tag === 'done') status = 'done';
    else if (tag === 'active') status = 'active';
    else if (tag === 'crit') crit = true;
    else if (tag === 'milestone') milestone = true;
    else if (tag === 'vert') vert = true;
  }

  let id = `t${index + 1}`;
  let startRaw = '';
  let endRaw = '3d';

  if (tokens.length === 1) {
    endRaw = tokens[0];
  } else if (tokens.length === 2) {
    startRaw = tokens[0];
    endRaw = tokens[1];
  } else if (tokens.length >= 3) {
    id = tokens[0];
    startRaw = tokens[1];
    endRaw = tokens[2];
  }

  let startMode: GanttTaskData['startMode'] = 'auto';
  let startDate: string | undefined;
  let afterTaskIds: string[] | undefined;

  if (startRaw) {
    const afterMatch = startRaw.match(/^after\s+(.+)$/i);
    if (afterMatch) {
      startMode = 'after';
      afterTaskIds = afterMatch[1].trim().split(/\s+/).filter(Boolean);
    } else {
      startMode = 'date';
      startDate = startRaw;
    }
  }

  let endMode: GanttTaskData['endMode'] = 'duration';
  let duration: string | undefined;
  let endDate: string | undefined;
  let untilTaskIds: string[] | undefined;

  const untilMatch = endRaw.match(/^until\s+(.+)$/i);
  if (untilMatch) {
    endMode = 'until';
    untilTaskIds = untilMatch[1].trim().split(/\s+/).filter(Boolean);
  } else if (/^\d+(?:\.\d+)?(?:ms|[Mdhmswy])$/.test(endRaw)) {
    endMode = 'duration';
    duration = endRaw;
  } else {
    endMode = 'date';
    endDate = endRaw;
  }

  return {
    id,
    status,
    ...(crit ? { crit: true } : {}),
    ...(milestone ? { milestone: true } : {}),
    ...(vert ? { vert: true } : {}),
    startMode,
    ...(startDate ? { startDate } : {}),
    ...(afterTaskIds && afterTaskIds.length > 0 ? { afterTaskIds } : {}),
    endMode,
    ...(duration ? { duration } : {}),
    ...(endDate ? { endDate } : {}),
    ...(untilTaskIds && untilTaskIds.length > 0 ? { untilTaskIds } : {}),
  };
}

export function parseGanttCodeToGuiData(code: string): GanttDiagramData {
  const lines = code.split(/\r?\n/);

  // 1. %% @gui-state: からの完全復元を優先する
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(GUI_STATE_PREFIX)) {
      const jsonPart = trimmed.slice(GUI_STATE_PREFIX.length).trim();
      try {
        const parsed: unknown = JSON.parse(jsonPart);
        if (isValidGanttData(parsed)) {
          return parsed;
        }
      } catch {
        // 解析失敗時はテキストパースにフォールバックする
      }
    }
  }

  let compactMode = false;
  let inFrontmatter = false;
  let seenHeader = false;
  let title = '';
  let dateFormat = 'YYYY-MM-DD';
  let axisFormat = '';
  let tickInterval = '';
  let excludes = '';
  let includes = '';
  let todayMarker = '';
  let inclusiveEndDates = false;
  let topAxis = false;
  let weekday: GanttWeekday | undefined;
  let weekend: GanttWeekend | undefined;

  const sections: GanttSectionData[] = [];
  const tasks: GanttTaskData[] = [];
  const comments: string[] = [];
  const clickMap = new Map<string, string>();
  let activeSectionId: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (i === 0 && trimmed === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (trimmed === '---') {
        inFrontmatter = false;
        continue;
      }
      if (/^displayMode:\s*compact\s*$/i.test(trimmed)) {
        compactMode = true;
      }
      if (/^topAxis:\s*true\s*$/i.test(trimmed)) {
        topAxis = true;
      }
      continue;
    }

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

    if (!seenHeader) {
      if (/^gantt\b/i.test(trimmed)) {
        seenHeader = true;
      }
      continue;
    }

    if (/^title\s+/i.test(trimmed)) {
      title = trimmed.replace(/^title\s+/i, '').trim();
      continue;
    }
    if (/^dateFormat\s+/i.test(trimmed)) {
      dateFormat = trimmed.replace(/^dateFormat\s+/i, '').trim();
      continue;
    }
    if (/^axisFormat\s+/i.test(trimmed)) {
      axisFormat = trimmed.replace(/^axisFormat\s+/i, '').trim();
      continue;
    }
    if (/^tickInterval\s+/i.test(trimmed)) {
      tickInterval = trimmed.replace(/^tickInterval\s+/i, '').trim();
      continue;
    }
    if (/^excludes\s+/i.test(trimmed)) {
      excludes = trimmed.replace(/^excludes\s+/i, '').trim();
      continue;
    }
    if (/^includes\s+/i.test(trimmed)) {
      includes = trimmed.replace(/^includes\s+/i, '').trim();
      continue;
    }
    if (/^todayMarker\s+/i.test(trimmed)) {
      todayMarker = trimmed.replace(/^todayMarker\s+/i, '').trim();
      continue;
    }
    if (/^inclusiveEndDates\b/i.test(trimmed)) {
      inclusiveEndDates = true;
      continue;
    }
    if (/^topAxis\b/i.test(trimmed)) {
      topAxis = true;
      continue;
    }
    if (/^weekday\s+/i.test(trimmed)) {
      const wd = trimmed.replace(/^weekday\s+/i, '').trim().toLowerCase();
      if (VALID_WEEKDAYS.has(wd)) {
        weekday = wd as GanttWeekday;
      }
      continue;
    }
    if (/^weekend\s+/i.test(trimmed)) {
      const we = trimmed.replace(/^weekend\s+/i, '').trim().toLowerCase();
      if (we === 'friday' || we === 'saturday') {
        weekend = we;
      }
      continue;
    }
    if (/^section\s+/i.test(trimmed)) {
      const secTitle = trimmed.replace(/^section\s+/i, '').trim();
      const secId = `sec_${sections.length + 1}`;
      sections.push({ id: secId, title: secTitle });
      activeSectionId = secId;
      continue;
    }
    if (/^(?:accTitle|accDescr)\b/i.test(trimmed)) {
      continue;
    }

    const clickMatch = trimmed.match(/^click\s+([a-zA-Z0-9_-]+)\s+href\s+"([^"]*)"/i);
    if (clickMatch) {
      clickMap.set(clickMatch[1], clickMatch[2]);
      continue;
    }

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      const label = trimmed.slice(0, colonIdx).trim();
      const dataPart = trimmed.slice(colonIdx + 1).trim();
      if (label && dataPart) {
        const parsedTask = parseTaskTokens(dataPart, tasks.length);
        tasks.push({
          ...parsedTask,
          label,
          ...(activeSectionId ? { sectionId: activeSectionId } : {}),
        });
      }
    }
  }

  for (const task of tasks) {
    const url = clickMap.get(task.id);
    if (url) {
      task.clickUrl = url;
    }
  }

  return {
    diagramType: 'gantt',
    ...(title ? { title } : {}),
    dateFormat: dateFormat || 'YYYY-MM-DD',
    ...(axisFormat ? { axisFormat } : {}),
    ...(tickInterval ? { tickInterval } : {}),
    ...(excludes ? { excludes } : {}),
    ...(includes ? { includes } : {}),
    ...(todayMarker ? { todayMarker } : {}),
    ...(inclusiveEndDates ? { inclusiveEndDates } : {}),
    ...(topAxis ? { topAxis } : {}),
    ...(compactMode ? { compactMode } : {}),
    ...(weekday ? { weekday } : {}),
    ...(weekend ? { weekend } : {}),
    sections,
    tasks,
    ...(comments.length > 0 ? { comments } : {}),
  };
}

export interface ResolvedGanttTaskSpan {
  taskId: string;
  startMs: number;
  endMs: number;
  leftPct: number;
  widthPct: number;
}

export interface ResolvedGanttTimeline {
  minStartMs: number;
  maxEndMs: number;
  spansById: Record<string, ResolvedGanttTaskSpan>;
}

const MS_PER_HOUR = 3600 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

function parseSimpleDateMs(raw: string | undefined): number | null {
  if (!raw) return null;
  const isoMatch = raw.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2}))?/);
  if (isoMatch) {
    const y = Number.parseInt(isoMatch[1], 10);
    const m = Number.parseInt(isoMatch[2], 10) - 1;
    const d = Number.parseInt(isoMatch[3], 10);
    const hh = isoMatch[4] ? Number.parseInt(isoMatch[4], 10) : 0;
    const mm = isoMatch[5] ? Number.parseInt(isoMatch[5], 10) : 0;
    return Date.UTC(y, m, d, hh, mm, 0, 0);
  }
  const timestamp = Date.parse(raw.trim());
  return Number.isNaN(timestamp) ? null : timestamp;
}

function durationToMs(raw: string | undefined): number {
  const m = raw?.trim().match(/^(\d+(?:\.\d+)?)(ms|[Mdhmswy])$/);
  if (!m) {
    return 3 * MS_PER_DAY;
  }
  const val = Number.parseFloat(m[1]);
  const unit = m[2];
  switch (unit) {
    case 'ms':
      return val;
    case 's':
      return val * 1000;
    case 'm':
      return val * 60 * 1000;
    case 'h':
      return val * MS_PER_HOUR;
    case 'd':
      return val * MS_PER_DAY;
    case 'w':
      return val * 7 * MS_PER_DAY;
    case 'M':
      return val * 30 * MS_PER_DAY;
    case 'y':
      return val * 365 * MS_PER_DAY;
    default:
      return 3 * MS_PER_DAY;
  }
}

/**
 * キャンバス上のバー表示用に各タスクの推定開始・終了時刻と%座標を計算する。
 */
export function resolveGanttTimeline(
  data: GanttDiagramData
): ResolvedGanttTimeline {
  const defaultAnchorMs =
    parseSimpleDateMs(data.tasks.find((t) => t.startDate)?.startDate) ??
    Date.UTC(2026, 10, 16);
  const rawSpans = new Map<string, { startMs: number; endMs: number }>();

  let prevEndMs = defaultAnchorMs;

  // 表示順（セクションごと + 未所属）に解決して after / auto を追跡する
  const sectionIdSet = new Set(data.sections.map((s) => s.id));
  const orderedTasks = [
    ...data.tasks.filter((t) => !t.sectionId || !sectionIdSet.has(t.sectionId)),
    ...data.sections.flatMap((sec) =>
      data.tasks.filter((t) => t.sectionId === sec.id)
    ),
  ];

  for (const task of orderedTasks) {
    let startMs = prevEndMs;

    if (task.startMode === 'date') {
      startMs = parseSimpleDateMs(task.startDate) ?? prevEndMs;
    } else if (task.startMode === 'after' && (task.afterTaskIds?.length ?? 0) > 0) {
      let latestEnd: number | null = null;
      for (const refId of task.afterTaskIds!) {
        const refSpan = rawSpans.get(refId);
        if (refSpan && (latestEnd === null || refSpan.endMs > latestEnd)) {
          latestEnd = refSpan.endMs;
        }
      }
      startMs = latestEnd ?? prevEndMs;
    }

    let endMs = startMs + durationToMs(task.duration);
    if (task.endMode === 'date') {
      const explicitEnd = parseSimpleDateMs(task.endDate);
      if (explicitEnd !== null) {
        endMs = Math.max(
          startMs,
          data.inclusiveEndDates ? explicitEnd + MS_PER_DAY : explicitEnd
        );
      }
    } else if (task.endMode === 'until' && (task.untilTaskIds?.length ?? 0) > 0) {
      let earliestStart: number | null = null;
      for (const refId of task.untilTaskIds!) {
        const refSpan = rawSpans.get(refId);
        if (refSpan && (earliestStart === null || refSpan.startMs < earliestStart)) {
          earliestStart = refSpan.startMs;
        }
      }
      if (earliestStart !== null) {
        endMs = Math.max(startMs, earliestStart);
      }
    }

    if (task.milestone && task.endMode === 'duration' && !task.duration) {
      endMs = startMs;
    }

    rawSpans.set(task.id, { startMs, endMs });
    prevEndMs = Math.max(startMs, endMs);
  }

  let minStartMs = defaultAnchorMs;
  let maxEndMs = defaultAnchorMs + 7 * MS_PER_DAY;
  if (rawSpans.size > 0) {
    const starts = Array.from(rawSpans.values()).map((s) => s.startMs);
    const ends = Array.from(rawSpans.values()).map((s) => s.endMs);
    minStartMs = Math.min(...starts);
    maxEndMs = Math.max(...ends, minStartMs + MS_PER_DAY);
  }

  const totalSpan = Math.max(MS_PER_DAY, maxEndMs - minStartMs);
  const spansById: Record<string, ResolvedGanttTaskSpan> = {};

  for (const [taskId, span] of rawSpans.entries()) {
    const leftPct = ((span.startMs - minStartMs) / totalSpan) * 100;
    const rawWidthPct = ((span.endMs - span.startMs) / totalSpan) * 100;
    spansById[taskId] = {
      taskId,
      startMs: span.startMs,
      endMs: span.endMs,
      leftPct: Math.max(0, Math.min(100, leftPct)),
      widthPct: Math.max(1.5, Math.min(100 - leftPct, rawWidthPct)),
    };
  }

  return { minStartMs, maxEndMs, spansById };
}

export function formatUtcDateShort(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${m}/${day}`;
}
