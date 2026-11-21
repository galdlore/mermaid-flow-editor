import type {
  JourneyDiagramData,
  JourneySectionData,
  JourneyTaskData,
} from '../types/editor.ts';
import {
  allocateUniqueId,
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
} from './mermaidEnvelope.ts';

function sanitizeJourneyText(raw: string): string {
  return raw.replace(/[:#;\r\n]+/g, ' ').trim();
}

function sanitizeJourneyActor(raw: string): string {
  return raw.replace(/[:#;,\r\n]+/g, ' ').trim();
}

export function clampJourneyScore(raw: number): number {
  if (!Number.isFinite(raw)) {
    return 3;
  }
  return Math.max(1, Math.min(5, Math.round(raw)));
}

export function createDefaultJourneyData(
  lang: 'ja' | 'en' = 'ja'
): JourneyDiagramData {
  const isJa = lang === 'ja';
  return {
    diagramType: 'journey',
    title: isJa ? 'オンライン購入の体験' : 'Online Purchase Journey',
    sections: [
      { id: 'sec_1', title: isJa ? '検索と選定' : 'Discovery' },
      { id: 'sec_2', title: isJa ? '決済と配送' : 'Checkout & Delivery' },
    ],
    tasks: [
      {
        id: 'task_1',
        label: isJa ? '商品を検索する' : 'Search for product',
        score: 5,
        actors: [isJa ? '顧客' : 'Customer'],
        sectionId: 'sec_1',
      },
      {
        id: 'task_2',
        label: isJa ? 'レビューを比較する' : 'Compare reviews',
        score: 4,
        actors: [isJa ? '顧客' : 'Customer'],
        sectionId: 'sec_1',
      },
      {
        id: 'task_3',
        label: isJa ? '決済フォームに入力する' : 'Fill checkout form',
        score: 2,
        actors: [isJa ? '顧客' : 'Customer', isJa ? '決済システム' : 'Payment'],
        sectionId: 'sec_2',
      },
      {
        id: 'task_4',
        label: isJa ? '完了通知を受け取る' : 'Receive confirmation',
        score: 5,
        actors: [isJa ? '顧客' : 'Customer', isJa ? 'メール通知' : 'Email'],
        sectionId: 'sec_2',
      },
    ],
  };
}

export function isValidJourneyData(value: unknown): value is JourneyDiagramData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Partial<JourneyDiagramData>;
  if (
    obj.diagramType !== 'journey' ||
    !Array.isArray(obj.sections) ||
    !Array.isArray(obj.tasks)
  ) {
    return false;
  }
  return (
    obj.sections.every(
      (s) =>
        Boolean(s) &&
        typeof s === 'object' &&
        typeof s.id === 'string' &&
        typeof s.title === 'string'
    ) &&
    obj.tasks.every(
      (t) =>
        Boolean(t) &&
        typeof t === 'object' &&
        typeof t.id === 'string' &&
        typeof t.label === 'string' &&
        typeof t.score === 'number'
    )
  );
}

export function normalizeJourneyData(raw: JourneyDiagramData): JourneyDiagramData {
  const usedSecIds = new Set<string>();
  const sectionIdMap = new Map<string, string>();
  const sections: JourneySectionData[] = [];

  for (let i = 0; i < raw.sections.length; i++) {
    const src = raw.sections[i];
    const base =
      src.id && /^[a-zA-Z0-9_-]+$/.test(src.id) ? src.id : `sec_${i + 1}`;
    const id = allocateUniqueId(base, usedSecIds);
    sectionIdMap.set(src.id, id);
    sections.push({
      id,
      title: sanitizeJourneyText(src.title) || `Section ${i + 1}`,
    });
  }

  const validSecIds = new Set(sections.map((s) => s.id));
  const usedTaskIds = new Set<string>();
  const tasks: JourneyTaskData[] = [];

  for (let i = 0; i < raw.tasks.length; i++) {
    const src = raw.tasks[i];
    const base =
      src.id && /^[a-zA-Z0-9_-]+$/.test(src.id) ? src.id : `task_${i + 1}`;
    const id = allocateUniqueId(base, usedTaskIds);
    const mappedSec = src.sectionId ? sectionIdMap.get(src.sectionId) : undefined;
    const actors = Array.isArray(src.actors)
      ? src.actors.map(sanitizeJourneyActor).filter((a) => a.length > 0)
      : [];

    tasks.push({
      id,
      label: sanitizeJourneyText(src.label) || `Task ${i + 1}`,
      score: clampJourneyScore(src.score),
      actors,
      ...(mappedSec && validSecIds.has(mappedSec) ? { sectionId: mappedSec } : {}),
    });
  }

  const title = raw.title ? sanitizeJourneyText(raw.title) : '';
  const comments = Array.isArray(raw.comments)
    ? raw.comments
        .filter((c): c is string => typeof c === 'string')
        .map(sanitizeSingleLineComment)
        .filter((c) => c.length > 0)
    : undefined;

  return {
    diagramType: 'journey',
    ...(title ? { title } : {}),
    sections,
    tasks,
    ...(comments && comments.length > 0 ? { comments } : {}),
  };
}

function formatJourneyTaskLine(task: JourneyTaskData): string {
  const actorPart = task.actors.length > 0 ? `: ${task.actors.join(', ')}` : '';
  return `    ${task.label}: ${task.score}${actorPart}`;
}

export function generateJourneyCode(rawData: JourneyDiagramData): string {
  const data = normalizeJourneyData(rawData);
  const lines: string[] = ['journey'];

  if (data.title) {
    lines.push(`  title ${data.title}`);
  }

  for (const comment of data.comments ?? []) {
    const clean = sanitizeSingleLineComment(comment);
    if (clean) {
      lines.push(`  %% ${clean}`);
    }
  }

  const unassigned = data.tasks.filter((t) => !t.sectionId);
  for (const task of unassigned) {
    lines.push(formatJourneyTaskLine(task));
  }

  for (const sec of data.sections) {
    lines.push(`  section ${sec.title}`);
    const secTasks = data.tasks.filter((t) => t.sectionId === sec.id);
    for (const task of secTasks) {
      lines.push(formatJourneyTaskLine(task));
    }
  }

  lines.push(formatGuiStateLine(data));
  return lines.join('\n');
}

export function parseJourneyCodeToGuiData(code: string): JourneyDiagramData {
  const lines = code.split(/\r?\n/);
  const fromGuiState = extractGuiStateJson(lines, isValidJourneyData);
  if (fromGuiState) {
    return normalizeJourneyData(fromGuiState);
  }

  const sections: JourneySectionData[] = [];
  const tasks: JourneyTaskData[] = [];
  const comments: string[] = [];
  let title = '';
  let currentSectionId: string | undefined;
  let inFrontmatter = false;

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
    if (/^journey\b/i.test(trimmed) || /^acc(?:Title|Descr)\b/i.test(trimmed)) {
      continue;
    }
    const titleMatch = /^title\s+(.+)$/i.exec(trimmed);
    if (titleMatch) {
      title = sanitizeJourneyText(titleMatch[1]);
      continue;
    }
    const secMatch = /^section\s+(.+)$/i.exec(trimmed);
    if (secMatch) {
      const id = `sec_${sections.length + 1}`;
      sections.push({ id, title: sanitizeJourneyText(secMatch[1]) || `Section ${sections.length + 1}` });
      currentSectionId = id;
      continue;
    }

    const parts = trimmed.split(':');
    if (parts.length >= 2) {
      const label = sanitizeJourneyText(parts[0]);
      const parsedScore = Number(parts[1].trim());
      const actorsRaw = parts.slice(2).join(':');
      const actors = actorsRaw
        ? actorsRaw.split(',').map(sanitizeJourneyActor).filter((a) => a.length > 0)
        : [];
      if (label) {
        tasks.push({
          id: `task_${tasks.length + 1}`,
          label,
          score: clampJourneyScore(Number.isFinite(parsedScore) ? parsedScore : 3),
          actors,
          ...(currentSectionId ? { sectionId: currentSectionId } : {}),
        });
      }
    }
  }

  return normalizeJourneyData({
    diagramType: 'journey',
    ...(title ? { title } : {}),
    sections,
    tasks,
    ...(comments.length > 0 ? { comments } : {}),
  });
}
