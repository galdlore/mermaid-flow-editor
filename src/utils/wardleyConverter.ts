import type {
  WardleyAnchorData,
  WardleyComponentData,
  WardleyDiagramData,
  WardleyLinkData,
  WardleyLinkStyle,
  WardleyNoteData,
  WardleyStrategy,
} from '../types/editor.ts';
import {
  allocateUniqueId,
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
} from './mermaidEnvelope.ts';

export const WARDLEY_STRATEGY_OPTIONS: ReadonlyArray<WardleyStrategy> = [
  'build',
  'buy',
  'outsource',
  'market',
];

export const WARDLEY_LINK_STYLE_OPTIONS: ReadonlyArray<WardleyLinkStyle> = [
  'solid',
  'dashed',
  'dotted',
  'flow-forward',
  'flow-backward',
  'flow-bidirectional',
];

const STRATEGY_SET = new Set<string>(WARDLEY_STRATEGY_OPTIONS);
const LINK_STYLE_SET = new Set<string>(WARDLEY_LINK_STYLE_OPTIONS);

export function getDefaultEvolutionStages(
  lang: 'ja' | 'en' = 'ja'
): [string, string, string, string] {
  return lang === 'ja'
    ? ['創成期', 'カスタム構築', '製品 (+レンタル)', 'コモディティ (+汎用)']
    : ['Genesis', 'Custom Built', 'Product (+rental)', 'Commodity (+utility)'];
}

export function sanitizeWardleyText(raw: string): string {
  return raw.replace(/["\\\r\n]+/g, ' ').trim();
}

export function clampWardleyCoord(raw: number): number {
  if (!Number.isFinite(raw)) {
    return 0.5;
  }
  const normalized = raw > 1 && raw <= 100 ? raw / 100 : raw;
  const clamped = Math.max(0.01, Math.min(0.99, normalized));
  return Math.round(clamped * 100) / 100;
}

function formatWardleyCoord(raw: number): string {
  return clampWardleyCoord(raw).toFixed(2);
}

export function createDefaultWardleyData(
  lang: 'ja' | 'en' = 'ja'
): WardleyDiagramData {
  const isJa = lang === 'ja';
  return {
    diagramType: 'wardley',
    title: isJa ? 'プロダクト価値連鎖マップ' : 'Product Value Chain Map',
    evolutionStages: getDefaultEvolutionStages(lang),
    anchors: [
      {
        id: 'anc_1',
        name: isJa ? '利用者' : 'Customer',
        visibility: 0.94,
        evolution: 0.45,
      },
    ],
    components: [
      {
        id: 'cmp_1',
        name: isJa ? 'Webアプリ' : 'Web App',
        visibility: 0.78,
        evolution: 0.48,
        strategy: 'build',
      },
      {
        id: 'cmp_2',
        name: isJa ? '認証基盤' : 'Auth Service',
        visibility: 0.52,
        evolution: 0.62,
        strategy: 'buy',
        inertia: true,
        evolveTo: 0.82,
      },
      {
        id: 'cmp_3',
        name: isJa ? 'データベース' : 'Database',
        visibility: 0.34,
        evolution: 0.78,
        strategy: 'market',
      },
      {
        id: 'cmp_4',
        name: isJa ? 'クラウド基盤' : 'Cloud Hosting',
        visibility: 0.16,
        evolution: 0.9,
        strategy: 'market',
      },
    ],
    links: [
      { id: 'lnk_1', from: 'anc_1', to: 'cmp_1', style: 'solid' },
      { id: 'lnk_2', from: 'cmp_1', to: 'cmp_2', style: 'solid', label: 'OAuth' },
      { id: 'lnk_3', from: 'cmp_1', to: 'cmp_3', style: 'solid' },
      { id: 'lnk_4', from: 'cmp_2', to: 'cmp_4', style: 'dashed' },
      { id: 'lnk_5', from: 'cmp_3', to: 'cmp_4', style: 'solid' },
    ],
    notes: [
      {
        id: 'note_1',
        text: isJa ? '内製集中領域' : 'Focus differentiation',
        visibility: 0.68,
        evolution: 0.25,
      },
    ],
  };
}

export function isValidWardleyData(value: unknown): value is WardleyDiagramData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Partial<WardleyDiagramData>;
  if (
    obj.diagramType !== 'wardley' ||
    !Array.isArray(obj.anchors) ||
    !Array.isArray(obj.components) ||
    !Array.isArray(obj.links)
  ) {
    return false;
  }
  return obj.components.every(
    (c) =>
      Boolean(c) &&
      typeof c === 'object' &&
      typeof c.id === 'string' &&
      typeof c.name === 'string' &&
      typeof c.visibility === 'number' &&
      typeof c.evolution === 'number'
  );
}

export function normalizeWardleyData(raw: WardleyDiagramData): WardleyDiagramData {
  const usedIds = new Set<string>();
  const idMap = new Map<string, string>();
  const usedNames = new Set<string>();

  const makeUniqueName = (baseRaw: string, fallback: string): string => {
    const clean = sanitizeWardleyText(baseRaw) || fallback;
    let candidate = clean;
    let suffix = 2;
    while (usedNames.has(candidate)) {
      candidate = `${clean} ${suffix++}`;
    }
    usedNames.add(candidate);
    return candidate;
  };

  const anchors: WardleyAnchorData[] = [];
  for (let i = 0; i < raw.anchors.length; i++) {
    const src = raw.anchors[i];
    const baseId =
      src.id && /^[a-zA-Z0-9_-]+$/.test(src.id) ? src.id : `anc_${i + 1}`;
    const id = allocateUniqueId(baseId, usedIds);
    idMap.set(src.id, id);
    anchors.push({
      id,
      name: makeUniqueName(src.name, `Anchor ${i + 1}`),
      visibility: clampWardleyCoord(src.visibility),
      evolution: clampWardleyCoord(src.evolution),
    });
  }

  const components: WardleyComponentData[] = [];
  for (let i = 0; i < raw.components.length; i++) {
    const src = raw.components[i];
    const baseId =
      src.id && /^[a-zA-Z0-9_-]+$/.test(src.id) ? src.id : `cmp_${i + 1}`;
    const id = allocateUniqueId(baseId, usedIds);
    idMap.set(src.id, id);
    const strategy =
      src.strategy && STRATEGY_SET.has(src.strategy) ? src.strategy : undefined;
    const evolveTo =
      typeof src.evolveTo === 'number' && Number.isFinite(src.evolveTo)
        ? clampWardleyCoord(src.evolveTo)
        : undefined;

    components.push({
      id,
      name: makeUniqueName(src.name, `Component ${i + 1}`),
      visibility: clampWardleyCoord(src.visibility),
      evolution: clampWardleyCoord(src.evolution),
      ...(strategy ? { strategy } : {}),
      ...(src.inertia ? { inertia: true } : {}),
      ...(evolveTo !== undefined ? { evolveTo } : {}),
    });
  }

  const validEndpointIds = new Set([
    ...anchors.map((a) => a.id),
    ...components.map((c) => c.id),
  ]);
  const usedLinkIds = new Set<string>();
  const links: WardleyLinkData[] = [];

  for (let i = 0; i < raw.links.length; i++) {
    const src = raw.links[i];
    const from = idMap.get(src.from) ?? src.from;
    const to = idMap.get(src.to) ?? src.to;
    if (!validEndpointIds.has(from) || !validEndpointIds.has(to) || from === to) {
      continue;
    }
    const baseId =
      src.id && /^[a-zA-Z0-9_-]+$/.test(src.id) ? src.id : `lnk_${i + 1}`;
    const id = allocateUniqueId(baseId, usedLinkIds);
    const style =
      src.style && LINK_STYLE_SET.has(src.style) ? src.style : 'solid';
    const label = src.label ? sanitizeWardleyText(src.label).replace(/;/g, ' ') : '';

    links.push({
      id,
      from,
      to,
      style,
      ...(label ? { label } : {}),
    });
  }

  const usedNoteIds = new Set<string>();
  const notes: WardleyNoteData[] = [];
  for (let i = 0; i < (raw.notes ?? []).length; i++) {
    const src = raw.notes![i];
    const baseId =
      src.id && /^[a-zA-Z0-9_-]+$/.test(src.id) ? src.id : `note_${i + 1}`;
    const id = allocateUniqueId(baseId, usedNoteIds);
    notes.push({
      id,
      text: sanitizeWardleyText(src.text) || `Note ${i + 1}`,
      visibility: clampWardleyCoord(src.visibility),
      evolution: clampWardleyCoord(src.evolution),
    });
  }

  const stages =
    Array.isArray(raw.evolutionStages) && raw.evolutionStages.length === 4
      ? ([
          sanitizeWardleyText(raw.evolutionStages[0]) || 'Genesis',
          sanitizeWardleyText(raw.evolutionStages[1]) || 'Custom Built',
          sanitizeWardleyText(raw.evolutionStages[2]) || 'Product',
          sanitizeWardleyText(raw.evolutionStages[3]) || 'Commodity',
        ] as [string, string, string, string])
      : undefined;

  const title = raw.title ? raw.title.replace(/[#;\r\n]+/g, ' ').trim() : '';
  const comments = Array.isArray(raw.comments)
    ? raw.comments
        .filter((c): c is string => typeof c === 'string')
        .map(sanitizeSingleLineComment)
        .filter((c) => c.length > 0)
    : undefined;

  return {
    diagramType: 'wardley',
    ...(title ? { title } : {}),
    ...(stages ? { evolutionStages: stages } : {}),
    anchors,
    components,
    links,
    ...(notes.length > 0 ? { notes } : {}),
    ...(comments && comments.length > 0 ? { comments } : {}),
  };
}

function linkStyleToArrowSyntax(style: WardleyLinkStyle | undefined): {
  fromPort: string;
  arrow: string;
} {
  switch (style) {
    case 'dashed':
      return { fromPort: '', arrow: '-->' };
    case 'dotted':
      return { fromPort: '', arrow: '-.->' };
    case 'flow-forward':
      return { fromPort: '', arrow: '+>' };
    case 'flow-backward':
      return { fromPort: '', arrow: '+<' };
    case 'flow-bidirectional':
      return { fromPort: '', arrow: '+<>' };
    case 'solid':
    default:
      return { fromPort: '', arrow: '->' };
  }
}

export function generateWardleyCode(rawData: WardleyDiagramData): string {
  const data = normalizeWardleyData(rawData);
  const lines: string[] = ['wardley-beta'];

  if (data.title) {
    lines.push(`title ${data.title}`);
  }

  if (data.evolutionStages) {
    lines.push(
      `evolution ${data.evolutionStages.map((s) => `"${s}"`).join(' -> ')}`
    );
  }

  const nameById = new Map<string, string>();
  for (const anchor of data.anchors) {
    nameById.set(anchor.id, anchor.name);
    lines.push(
      `anchor "${anchor.name}" [${formatWardleyCoord(anchor.visibility)}, ${formatWardleyCoord(anchor.evolution)}]`
    );
  }

  for (const comp of data.components) {
    nameById.set(comp.id, comp.name);
    const strategyPart = comp.strategy ? ` (${comp.strategy})` : '';
    const inertiaPart = comp.inertia ? ' inertia' : '';
    lines.push(
      `component "${comp.name}" [${formatWardleyCoord(comp.visibility)}, ${formatWardleyCoord(comp.evolution)}]${strategyPart}${inertiaPart}`
    );
  }

  for (const link of data.links) {
    const fromName = nameById.get(link.from);
    const toName = nameById.get(link.to);
    if (!fromName || !toName) {
      continue;
    }
    const { fromPort, arrow } = linkStyleToArrowSyntax(link.style);
    const labelPart = link.label ? `; ${link.label}` : '';
    lines.push(`"${fromName}"${fromPort} ${arrow} "${toName}"${labelPart}`);
  }

  for (const comp of data.components) {
    if (comp.evolveTo !== undefined) {
      lines.push(`evolve "${comp.name}" ${formatWardleyCoord(comp.evolveTo)}`);
    }
  }

  for (const note of data.notes ?? []) {
    lines.push(
      `note "${note.text}" [${formatWardleyCoord(note.visibility)}, ${formatWardleyCoord(note.evolution)}]`
    );
  }

  for (const comment of data.comments ?? []) {
    const clean = sanitizeSingleLineComment(comment);
    if (clean) {
      lines.push(`%% ${clean}`);
    }
  }

  lines.push(formatGuiStateLine(data));
  return lines.join('\n');
}

function unquoteWardleyName(raw: string): string {
  const t = raw.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1).trim();
  }
  return t;
}

export function parseWardleyCodeToGuiData(code: string): WardleyDiagramData {
  const lines = code.split(/\r?\n/);
  const fromGuiState = extractGuiStateJson(lines, isValidWardleyData);
  if (fromGuiState) {
    return normalizeWardleyData(fromGuiState);
  }

  const anchors: WardleyAnchorData[] = [];
  const components: WardleyComponentData[] = [];
  const rawLinks: Array<{
    fromName: string;
    toName: string;
    style: WardleyLinkStyle;
    label?: string;
  }> = [];
  const evolves: Array<{ name: string; target: number }> = [];
  const notes: WardleyNoteData[] = [];
  const comments: string[] = [];
  let evolutionStages: [string, string, string, string] | undefined;
  let title = '';
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
    if (/^wardley-beta\b/i.test(trimmed) || /^size\s*\[/i.test(trimmed)) {
      continue;
    }
    const titleMatch = /^title\s+(.+)$/i.exec(trimmed);
    if (titleMatch) {
      title = titleMatch[1].replace(/[#;\r\n]+/g, ' ').trim();
      continue;
    }
    const evoMatch = /^evolution\s+(.+)$/i.exec(trimmed);
    if (evoMatch) {
      const parts = evoMatch[1]
        .split('->')
        .map((p) => sanitizeWardleyText(unquoteWardleyName(p.split('@')[0])))
        .filter((p) => p.length > 0);
      if (parts.length >= 4) {
        evolutionStages = [parts[0], parts[1], parts[2], parts[3]];
      }
      continue;
    }
    const anchorMatch =
      /^anchor\s+(.+?)\s*\[\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\]\s*$/i.exec(trimmed);
    if (anchorMatch) {
      anchors.push({
        id: `anc_${anchors.length + 1}`,
        name: sanitizeWardleyText(unquoteWardleyName(anchorMatch[1])),
        visibility: clampWardleyCoord(Number(anchorMatch[2])),
        evolution: clampWardleyCoord(Number(anchorMatch[3])),
      });
      continue;
    }
    const compMatch =
      /^component\s+(.+?)\s*\[\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\](.*)$/i.exec(
        trimmed
      );
    if (compMatch) {
      const tail = compMatch[4] || '';
      const stratMatch = /\((build|buy|outsource|market)\)/i.exec(tail);
      const hasInertia = /\binertia\b/i.test(tail);
      components.push({
        id: `cmp_${components.length + 1}`,
        name: sanitizeWardleyText(unquoteWardleyName(compMatch[1])),
        visibility: clampWardleyCoord(Number(compMatch[2])),
        evolution: clampWardleyCoord(Number(compMatch[3])),
        ...(stratMatch
          ? { strategy: stratMatch[1].toLowerCase() as WardleyStrategy }
          : {}),
        ...(hasInertia ? { inertia: true } : {}),
      });
      continue;
    }
    const evolveMatch = /^evolve\s+(.+?)\s+([0-9.]+)\s*$/i.exec(trimmed);
    if (evolveMatch) {
      evolves.push({
        name: sanitizeWardleyText(unquoteWardleyName(evolveMatch[1])),
        target: clampWardleyCoord(Number(evolveMatch[2])),
      });
      continue;
    }
    const noteMatch =
      /^note\s+("[^"]*"|'[^']*')\s*\[\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\]\s*$/i.exec(
        trimmed
      );
    if (noteMatch) {
      notes.push({
        id: `note_${notes.length + 1}`,
        text: sanitizeWardleyText(unquoteWardleyName(noteMatch[1])),
        visibility: clampWardleyCoord(Number(noteMatch[2])),
        evolution: clampWardleyCoord(Number(noteMatch[3])),
      });
      continue;
    }

    const linkMatch =
      /^("[^"]*"|'[^']*'|[^+\-\s][^->\n]*?)\s*(\+<>|\+>|\+<|-.->|-->|->)\s*("[^"]*"|'[^']*'|[^;\n]+?)(?:\s*;\s*(.+))?$/.exec(
        trimmed
      );
    if (linkMatch) {
      const arrowTok = linkMatch[2];
      const style: WardleyLinkStyle =
        arrowTok === '-->'
          ? 'dashed'
          : arrowTok === '-.->'
            ? 'dotted'
            : arrowTok === '+>'
              ? 'flow-forward'
              : arrowTok === '+<'
                ? 'flow-backward'
                : arrowTok === '+<>'
                  ? 'flow-bidirectional'
                  : 'solid';
      rawLinks.push({
        fromName: sanitizeWardleyText(unquoteWardleyName(linkMatch[1])),
        toName: sanitizeWardleyText(unquoteWardleyName(linkMatch[3])),
        style,
        ...(linkMatch[4] ? { label: sanitizeWardleyText(linkMatch[4]) } : {}),
      });
    }
  }

  for (const evo of evolves) {
    const targetComp = components.find((c) => c.name === evo.name);
    if (targetComp) {
      targetComp.evolveTo = evo.target;
    }
  }

  const idByName = new Map<string, string>();
  for (const a of anchors) idByName.set(a.name, a.id);
  for (const c of components) idByName.set(c.name, c.id);

  const links: WardleyLinkData[] = [];
  for (const rl of rawLinks) {
    const fromId = idByName.get(rl.fromName);
    const toId = idByName.get(rl.toName);
    if (fromId && toId) {
      links.push({
        id: `lnk_${links.length + 1}`,
        from: fromId,
        to: toId,
        style: rl.style,
        ...(rl.label ? { label: rl.label } : {}),
      });
    }
  }

  return normalizeWardleyData({
    diagramType: 'wardley',
    ...(title ? { title } : {}),
    ...(evolutionStages ? { evolutionStages } : {}),
    anchors,
    components,
    links,
    ...(notes.length > 0 ? { notes } : {}),
    ...(comments.length > 0 ? { comments } : {}),
  });
}
