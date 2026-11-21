import type {
  VennDiagramData,
  VennSetData,
  VennTextItemData,
  VennUnionData,
} from '../types/editor.ts';
import { sanitizeCssColor } from './inputSafeguard.ts';
import {
  allocateUniqueId,
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
} from './mermaidEnvelope.ts';

export function sanitizeVennId(raw: string, fallback = 'S'): string {
  let clean = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!clean) {
    return fallback;
  }
  if (!/^[a-zA-Z_]/.test(clean)) {
    clean = `S_${clean}`;
  }
  return clean;
}

export function sanitizeVennText(raw: string): string {
  return raw.replace(/["[\]\r\n]+/g, ' ').trim();
}

function makeSetSignature(setIds: ReadonlyArray<string>): string {
  return [...setIds].sort().join('|');
}

export function createDefaultVennData(lang: 'ja' | 'en' = 'ja'): VennDiagramData {
  const isJa = lang === 'ja';
  return {
    diagramType: 'venn',
    title: isJa ? '技術スキルの重なり' : 'Skill Overlap',
    sets: [
      {
        id: 'Frontend',
        label: isJa ? 'フロントエンド' : 'Frontend',
        size: 20,
        fill: '#dbeafe',
        stroke: '#2563eb',
      },
      {
        id: 'Backend',
        label: isJa ? 'バックエンド' : 'Backend',
        size: 20,
        fill: '#dcfce7',
        stroke: '#16a34a',
      },
      {
        id: 'Infra',
        label: isJa ? 'インフラ / SRE' : 'Infrastructure',
        size: 16,
        fill: '#fef9c3',
        stroke: '#ca8a04',
      },
    ],
    unions: [
      {
        id: 'union_1',
        sets: ['Backend', 'Frontend'],
        label: isJa ? 'フルスタック' : 'Full-Stack',
        size: 6,
      },
      {
        id: 'union_2',
        sets: ['Backend', 'Infra'],
        label: 'DevOps',
        size: 5,
      },
    ],
    texts: [
      { id: 'txt_1', sets: ['Frontend'], label: 'React / UI' },
      { id: 'txt_2', sets: ['Backend'], label: 'API / DB' },
      { id: 'txt_3', sets: ['Backend', 'Frontend'], label: 'TypeScript' },
    ],
  };
}

export function isValidVennData(value: unknown): value is VennDiagramData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Partial<VennDiagramData>;
  if (
    obj.diagramType !== 'venn' ||
    !Array.isArray(obj.sets) ||
    !Array.isArray(obj.unions) ||
    !Array.isArray(obj.texts)
  ) {
    return false;
  }
  return (
    obj.sets.every(
      (s) =>
        Boolean(s) &&
        typeof s === 'object' &&
        typeof s.id === 'string' &&
        typeof s.label === 'string' &&
        typeof s.size === 'number'
    ) &&
    obj.unions.every(
      (u) =>
        Boolean(u) &&
        typeof u === 'object' &&
        typeof u.id === 'string' &&
        Array.isArray(u.sets) &&
        typeof u.size === 'number'
    ) &&
    obj.texts.every(
      (t) =>
        Boolean(t) &&
        typeof t === 'object' &&
        typeof t.id === 'string' &&
        Array.isArray(t.sets) &&
        typeof t.label === 'string'
    )
  );
}

export function normalizeVennData(raw: VennDiagramData): VennDiagramData {
  const usedSetIds = new Set<string>();
  const setIdMap = new Map<string, string>();
  const sets: VennSetData[] = [];

  for (let i = 0; i < raw.sets.length; i++) {
    const src = raw.sets[i];
    const cleanBase = sanitizeVennId(src.id, `Set${i + 1}`);
    const id = allocateUniqueId(cleanBase, usedSetIds);
    setIdMap.set(src.id, id);

    const fill = src.fill ? sanitizeCssColor(src.fill) : undefined;
    const stroke = src.stroke ? sanitizeCssColor(src.stroke) : undefined;
    const textColor = src.textColor ? sanitizeCssColor(src.textColor) : undefined;
    const fillOpacity =
      typeof src.fillOpacity === 'number' && Number.isFinite(src.fillOpacity)
        ? Math.max(0.05, Math.min(1, src.fillOpacity))
        : undefined;

    sets.push({
      id,
      label: sanitizeVennText(src.label) || id,
      size: Math.max(1, Number.isFinite(src.size) ? src.size : 10),
      ...(fill ? { fill } : {}),
      ...(stroke ? { stroke } : {}),
      ...(textColor ? { textColor } : {}),
      ...(fillOpacity !== undefined ? { fillOpacity } : {}),
    });
  }

  const validSetIds = new Set(sets.map((s) => s.id));
  const usedUnionIds = new Set<string>();
  const unions: VennUnionData[] = [];

  for (let i = 0; i < raw.unions.length; i++) {
    const src = raw.unions[i];
    const mapped = Array.from(
      new Set(
        src.sets
          .map((id) => setIdMap.get(id) ?? id)
          .filter((id) => validSetIds.has(id))
      )
    ).sort();
    if (mapped.length < 2) {
      continue;
    }
    const baseId =
      src.id && /^[a-zA-Z0-9_-]+$/.test(src.id) ? src.id : `union_${i + 1}`;
    const id = allocateUniqueId(baseId, usedUnionIds);
    const label = src.label ? sanitizeVennText(src.label) : '';
    const fill = src.fill ? sanitizeCssColor(src.fill) : undefined;
    const stroke = src.stroke ? sanitizeCssColor(src.stroke) : undefined;

    unions.push({
      id,
      sets: mapped,
      ...(label ? { label } : {}),
      size: Math.max(0.5, Number.isFinite(src.size) ? src.size : 4),
      ...(fill ? { fill } : {}),
      ...(stroke ? { stroke } : {}),
    });
  }

  const validUnionSignatures = new Set(unions.map((u) => makeSetSignature(u.sets)));
  const usedTextIds = new Set<string>();
  const texts: VennTextItemData[] = [];

  for (let i = 0; i < raw.texts.length; i++) {
    const src = raw.texts[i];
    const mapped = Array.from(
      new Set(
        src.sets
          .map((id) => setIdMap.get(id) ?? id)
          .filter((id) => validSetIds.has(id))
      )
    ).sort();
    const isSingleValidSet = mapped.length === 1;
    const isDeclaredUnion =
      mapped.length >= 2 && validUnionSignatures.has(makeSetSignature(mapped));
    if (!isSingleValidSet && !isDeclaredUnion) {
      continue;
    }

    const baseId = sanitizeVennId(src.id, `txt_${i + 1}`);
    const id = allocateUniqueId(baseId, usedTextIds);
    const label = sanitizeVennText(src.label) || id;

    texts.push({
      id,
      sets: mapped,
      label,
    });
  }

  const title = raw.title ? raw.title.replace(/[#;\r\n]+/g, ' ').trim() : '';
  const comments = Array.isArray(raw.comments)
    ? raw.comments
        .filter((c): c is string => typeof c === 'string')
        .map(sanitizeSingleLineComment)
        .filter((c) => c.length > 0)
    : undefined;

  return {
    diagramType: 'venn',
    ...(title ? { title } : {}),
    sets,
    unions,
    texts,
    ...(comments && comments.length > 0 ? { comments } : {}),
  };
}

function formatVennStyleLine(
  targetList: string[],
  styles: { fill?: string; stroke?: string; textColor?: string; fillOpacity?: number }
): string | null {
  const fields: string[] = [];
  if (styles.fill) fields.push(`fill:${styles.fill}`);
  if (styles.stroke) fields.push(`stroke:${styles.stroke}`);
  if (styles.textColor) fields.push(`color:${styles.textColor}`);
  if (styles.fillOpacity !== undefined) {
    fields.push(`fill-opacity:${styles.fillOpacity}`);
  }
  if (fields.length === 0) {
    return null;
  }
  return `  style ${targetList.join(', ')} ${fields.join(', ')}`;
}

export function generateVennCode(rawData: VennDiagramData): string {
  const data = normalizeVennData(rawData);
  const lines: string[] = ['venn-beta'];

  if (data.title) {
    lines.push(`  title ${data.title}`);
  }

  for (const comment of data.comments ?? []) {
    const clean = sanitizeSingleLineComment(comment);
    if (clean) {
      lines.push(`  %% ${clean}`);
    }
  }

  const textsBySig = new Map<string, VennTextItemData[]>();
  for (const txt of data.texts) {
    const sig = makeSetSignature(txt.sets);
    const list = textsBySig.get(sig) ?? [];
    list.push(txt);
    textsBySig.set(sig, list);
  }

  // MermaidのvennDBはunionより前に全setの宣言を要求する
  for (const setItem of data.sets) {
    const labelPart = setItem.label ? `["${setItem.label}"]` : '';
    lines.push(`  set ${setItem.id}${labelPart}:${setItem.size}`);
    for (const txt of textsBySig.get(setItem.id) ?? []) {
      lines.push(`    text ${txt.id}["${txt.label}"]`);
    }
  }

  const seenUnionSigs = new Set<string>();
  for (const unionItem of data.unions) {
    const sig = makeSetSignature(unionItem.sets);
    const labelPart = unionItem.label ? `["${unionItem.label}"]` : '';
    lines.push(`  union ${unionItem.sets.join(', ')}${labelPart}:${unionItem.size}`);
    if (!seenUnionSigs.has(sig)) {
      seenUnionSigs.add(sig);
      for (const txt of textsBySig.get(sig) ?? []) {
        lines.push(`    text ${txt.id}["${txt.label}"]`);
      }
    }
  }

  for (const setItem of data.sets) {
    const styleLine = formatVennStyleLine([setItem.id], setItem);
    if (styleLine) {
      lines.push(styleLine);
    }
  }

  for (const unionItem of data.unions) {
    const styleLine = formatVennStyleLine(unionItem.sets, unionItem);
    if (styleLine) {
      lines.push(styleLine);
    }
  }

  lines.push(formatGuiStateLine(data));
  return lines.join('\n');
}

function unquoteVennToken(raw: string): string {
  const t = raw.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    return t.slice(1, -1);
  }
  return t;
}

export function parseVennCodeToGuiData(code: string): VennDiagramData {
  const lines = code.split(/\r?\n/);
  const fromGuiState = extractGuiStateJson(lines, isValidVennData);
  if (fromGuiState) {
    return normalizeVennData(fromGuiState);
  }

  const sets: VennSetData[] = [];
  const unions: VennUnionData[] = [];
  const texts: VennTextItemData[] = [];
  const comments: string[] = [];
  let title = '';
  let currentSets: string[] | null = null;
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
    if (/^venn-beta\b/i.test(trimmed)) {
      continue;
    }

    const titleMatch = /^title\s+(.+)$/i.exec(trimmed);
    if (titleMatch) {
      title = titleMatch[1].replace(/[#;\r\n]+/g, ' ').trim();
      continue;
    }

    const setMatch =
      /^set\s+("[^"]*"|[A-Za-z_][A-Za-z0-9_-]*)(?:\s*\[(?:"([^"]*)"|([^\]]*))\])?(?:\s*:\s*([+-]?\d+(?:\.\d+)?))?\s*$/i.exec(
        trimmed
      );
    if (setMatch) {
      const rawId = unquoteVennToken(setMatch[1]);
      const id = sanitizeVennId(rawId, `Set${sets.length + 1}`);
      const label = sanitizeVennText(setMatch[2] ?? setMatch[3] ?? rawId) || id;
      const size = setMatch[4] ? Number(setMatch[4]) : 10;
      sets.push({ id, label, size });
      currentSets = [id];
      continue;
    }

    const unionMatch =
      /^union\s+([^\[:]+?)(?:\s*\[(?:"([^"]*)"|([^\]]*))\])?(?:\s*:\s*([+-]?\d+(?:\.\d+)?))?\s*$/i.exec(
        trimmed
      );
    if (unionMatch) {
      const members = unionMatch[1]
        .split(',')
        .map((m) => sanitizeVennId(unquoteVennToken(m), ''))
        .filter((m) => m.length > 0);
      if (members.length >= 2) {
        const sorted = Array.from(new Set(members)).sort();
        const label = sanitizeVennText(unionMatch[2] ?? unionMatch[3] ?? '');
        const size = unionMatch[4] ? Number(unionMatch[4]) : 10 / Math.pow(sorted.length, 2);
        unions.push({
          id: `union_${unions.length + 1}`,
          sets: sorted,
          ...(label ? { label } : {}),
          size,
        });
        currentSets = sorted;
      }
      continue;
    }

    const explicitTextMatch =
      /^text\s+\[([^\]]+)\]\s+("[^"]*"|[A-Za-z_][A-Za-z0-9_-]*)(?:\s*\[(?:"([^"]*)"|([^\]]*))\])?\s*$/i.exec(
        trimmed
      );
    if (explicitTextMatch) {
      const members = explicitTextMatch[1]
        .split(',')
        .map((m) => sanitizeVennId(unquoteVennToken(m), ''))
        .filter((m) => m.length > 0);
      const tid = sanitizeVennId(unquoteVennToken(explicitTextMatch[2]), `txt_${texts.length + 1}`);
      const label = sanitizeVennText(
        explicitTextMatch[3] ?? explicitTextMatch[4] ?? unquoteVennToken(explicitTextMatch[2])
      );
      if (members.length > 0 && label) {
        texts.push({ id: tid, sets: members.sort(), label });
      }
      continue;
    }

    const indentedTextMatch =
      /^text\s+("[^"]*"|[A-Za-z_0-9-]+)(?:\s*\[(?:"([^"]*)"|([^\]]*))\])?\s*$/i.exec(
        trimmed
      );
    if (indentedTextMatch && currentSets) {
      const tid = sanitizeVennId(unquoteVennToken(indentedTextMatch[1]), `txt_${texts.length + 1}`);
      const label = sanitizeVennText(
        indentedTextMatch[2] ?? indentedTextMatch[3] ?? unquoteVennToken(indentedTextMatch[1])
      );
      if (label) {
        texts.push({ id: tid, sets: currentSets, label });
      }
      continue;
    }

    const styleMatch = /^style\s+(.+?)\s+((?:fill|stroke|color|fill-opacity)\s*:.*)$/i.exec(
      trimmed
    );
    if (styleMatch) {
      const targets = styleMatch[1]
        .split(',')
        .map((t) => sanitizeVennId(unquoteVennToken(t), ''))
        .filter((t) => t.length > 0)
        .sort();
      const stylePairs = styleMatch[2].split(',');
      let fill: string | undefined;
      let stroke: string | undefined;
      let textColor: string | undefined;
      let fillOpacity: number | undefined;
      for (const pair of stylePairs) {
        const colonIdx = pair.indexOf(':');
        if (colonIdx < 0) continue;
        const k = pair.slice(0, colonIdx).trim().toLowerCase();
        const v = pair.slice(colonIdx + 1).trim();
        if (k === 'fill') fill = sanitizeCssColor(v);
        if (k === 'stroke') stroke = sanitizeCssColor(v);
        if (k === 'color') textColor = sanitizeCssColor(v);
        if (k === 'fill-opacity') {
          const num = Number(v);
          if (Number.isFinite(num)) fillOpacity = num;
        }
      }
      if (targets.length === 1) {
        const targetSet = sets.find((s) => s.id === targets[0]);
        if (targetSet) {
          if (fill) targetSet.fill = fill;
          if (stroke) targetSet.stroke = stroke;
          if (textColor) targetSet.textColor = textColor;
          if (fillOpacity !== undefined) targetSet.fillOpacity = fillOpacity;
        }
      } else if (targets.length >= 2) {
        const sig = makeSetSignature(targets);
        const targetUnion = unions.find((u) => makeSetSignature(u.sets) === sig);
        if (targetUnion) {
          if (fill) targetUnion.fill = fill;
          if (stroke) targetUnion.stroke = stroke;
        }
      }
    }
  }

  return normalizeVennData({
    diagramType: 'venn',
    ...(title ? { title } : {}),
    sets,
    unions,
    texts,
    ...(comments.length > 0 ? { comments } : {}),
  });
}
