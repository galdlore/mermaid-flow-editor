import type {
  C4BoundaryData,
  C4BoundaryKind,
  C4DiagramData,
  C4DiagramSubtype,
  C4ElementData,
  C4ElementKind,
  C4ElementVariant,
  C4RelationData,
  C4RelationType,
} from '../types/editor';
import { sanitizeCssColor } from './inputSafeguard.ts';
import {
  GUI_STATE_PREFIX,
  allocateUniqueId,
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
} from './mermaidEnvelope.ts';

const VALID_SUBTYPES = new Set<C4DiagramSubtype>([
  'C4Context',
  'C4Container',
  'C4Component',
  'C4Dynamic',
  'C4Deployment',
]);

const VALID_ELEMENT_KINDS = new Set<C4ElementKind>([
  'person',
  'system',
  'container',
  'component',
]);

const VALID_ELEMENT_VARIANTS = new Set<C4ElementVariant>([
  'standard',
  'db',
  'queue',
]);

const VALID_BOUNDARY_KINDS = new Set<C4BoundaryKind>([
  'enterprise',
  'system',
  'container',
  'boundary',
  'node',
]);

const VALID_RELATION_TYPES = new Set<C4RelationType>([
  'Rel',
  'BiRel',
  'Rel_Up',
  'Rel_Down',
  'Rel_Left',
  'Rel_Right',
  'Rel_Back',
  'RelIndex',
]);

const RESERVED_C4_KEYWORDS = new Set([
  'global',
  'title',
  'direction',
  'c4context',
  'c4container',
  'c4component',
  'c4dynamic',
  'c4deployment',
  'person',
  'person_ext',
  'system',
  'system_ext',
  'systemdb',
  'systemdb_ext',
  'systemqueue',
  'systemqueue_ext',
  'container',
  'container_ext',
  'containerdb',
  'containerdb_ext',
  'containerqueue',
  'containerqueue_ext',
  'component',
  'component_ext',
  'componentdb',
  'componentdb_ext',
  'componentqueue',
  'componentqueue_ext',
  'boundary',
  'enterprise_boundary',
  'system_boundary',
  'container_boundary',
  'deployment_node',
  'node',
  'node_l',
  'node_r',
  'rel',
  'birel',
  'rel_u',
  'rel_up',
  'rel_d',
  'rel_down',
  'rel_l',
  'rel_left',
  'rel_r',
  'rel_right',
  'rel_back',
  'rel_b',
  'relindex',
  'updateelementstyle',
  'updaterelstyle',
  'updatelayoutconfig',
]);

export const C4_SUBTYPE_OPTIONS: ReadonlyArray<C4DiagramSubtype> = [
  'C4Context',
  'C4Container',
  'C4Component',
  'C4Dynamic',
  'C4Deployment',
];

export const C4_ELEMENT_KIND_OPTIONS: ReadonlyArray<C4ElementKind> = [
  'person',
  'system',
  'container',
  'component',
];

export const C4_ELEMENT_VARIANT_OPTIONS: ReadonlyArray<C4ElementVariant> = [
  'standard',
  'db',
  'queue',
];

export const C4_BOUNDARY_KIND_OPTIONS: ReadonlyArray<C4BoundaryKind> = [
  'enterprise',
  'system',
  'container',
  'boundary',
  'node',
];

export const C4_RELATION_TYPE_OPTIONS: ReadonlyArray<C4RelationType> = [
  'Rel',
  'BiRel',
  'Rel_Up',
  'Rel_Down',
  'Rel_Left',
  'Rel_Right',
  'Rel_Back',
  'RelIndex',
];

export function createDefaultC4Data(lang: 'ja' | 'en' = 'ja'): C4DiagramData {
  if (lang === 'en') {
    return {
      diagramType: 'c4',
      subtype: 'C4Context',
      title: 'System Context Diagram for Banking Platform',
      shapeInRow: 3,
      boundaryInRow: 1,
      elements: [
        {
          id: 'customer',
          kind: 'person',
          label: 'Banking Customer',
          descr: 'A personal banking customer accessing online services',
        },
        {
          id: 'webApp',
          kind: 'system',
          label: 'Internet Banking System',
          descr: 'Allows customers to view balances and make transfers',
          boundaryId: 'enterpriseCore',
        },
        {
          id: 'ledgerDb',
          kind: 'system',
          variant: 'db',
          label: 'Core Ledger DB',
          descr: 'Stores customer accounts and transaction history',
          boundaryId: 'enterpriseCore',
        },
        {
          id: 'mailSystem',
          kind: 'system',
          external: true,
          label: 'E-mail System',
          descr: 'External SMTP delivery service',
        },
      ],
      boundaries: [
        {
          id: 'enterpriseCore',
          kind: 'enterprise',
          label: 'Bank Enterprise',
        },
      ],
      relations: [
        {
          id: 'rel_1',
          relType: 'Rel',
          from: 'customer',
          to: 'webApp',
          label: 'Uses',
          techn: 'HTTPS',
        },
        {
          id: 'rel_2',
          relType: 'Rel',
          from: 'webApp',
          to: 'ledgerDb',
          label: 'Reads and writes',
          techn: 'SQL / TLS',
        },
        {
          id: 'rel_3',
          relType: 'Rel',
          from: 'webApp',
          to: 'mailSystem',
          label: 'Sends alerts via',
          techn: 'SMTP',
        },
        {
          id: 'rel_4',
          relType: 'Rel_Back',
          from: 'customer',
          to: 'mailSystem',
          label: 'Sends notifications to',
        },
      ],
    };
  }

  return {
    diagramType: 'c4',
    subtype: 'C4Context',
    title: 'インターネットバンキング システムコンテキスト図',
    shapeInRow: 3,
    boundaryInRow: 1,
    elements: [
      {
        id: 'customer',
        kind: 'person',
        label: '個人顧客',
        descr: 'オンライン口座機能を利用する銀行の顧客',
      },
      {
        id: 'webApp',
        kind: 'system',
        label: 'インターネットバンキング',
        descr: '残高照会や振込手続きを提供する中核システム',
        boundaryId: 'enterpriseCore',
      },
      {
        id: 'ledgerDb',
        kind: 'system',
        variant: 'db',
        label: '勘定系データベース',
        descr: '口座残高と取引履歴を永続化する',
        boundaryId: 'enterpriseCore',
      },
      {
        id: 'mailSystem',
        kind: 'system',
        external: true,
        label: '外部メール配信基盤',
        descr: '通知メールを送信する外部サービス',
      },
    ],
    boundaries: [
      {
        id: 'enterpriseCore',
        kind: 'enterprise',
        label: '自社グループ基盤',
      },
    ],
    relations: [
      {
        id: 'rel_1',
        relType: 'Rel',
        from: 'customer',
        to: 'webApp',
        label: '操作する',
        techn: 'HTTPS',
      },
      {
        id: 'rel_2',
        relType: 'Rel',
        from: 'webApp',
        to: 'ledgerDb',
        label: '参照・更新する',
        techn: 'SQL / TLS',
      },
      {
        id: 'rel_3',
        relType: 'Rel',
        from: 'webApp',
        to: 'mailSystem',
        label: '通知を依頼する',
        techn: 'SMTP',
      },
      {
        id: 'rel_4',
        relType: 'Rel_Back',
        from: 'customer',
        to: 'mailSystem',
        label: '通知メールを受信',
      },
    ],
  };
}

export function sanitizeC4Id(raw: string): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!cleaned) {
    return 'item';
  }
  const prefixed = /^[a-zA-Z_]/.test(cleaned) ? cleaned : `c4_${cleaned}`;
  return RESERVED_C4_KEYWORDS.has(prefixed.toLowerCase())
    ? `${prefixed}_item`
    : prefixed;
}

function sanitizeC4QuotedText(raw: string): string {
  return raw.replace(/["\r\n]/g, '').trim();
}

function sanitizeC4Title(raw: string): string {
  return raw.replace(/[#;\r\n]/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function clampGridCount(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return undefined;
  }
  const intVal = Math.round(raw);
  if (intVal < 1) return undefined;
  return Math.min(10, Math.max(1, intVal));
}

export function createUniqueC4ElementId(
  elements: ReadonlyArray<C4ElementData>,
  boundaries: ReadonlyArray<C4BoundaryData>,
  preferred = 'element'
): string {
  const used = new Set<string>([
    ...elements.map((e) => e.id),
    ...boundaries.map((b) => b.id),
  ]);
  const base = sanitizeC4Id(preferred);
  if (!used.has(base)) {
    return base;
  }
  let idx = elements.length + 1;
  while (used.has(`${base}_${idx}`)) {
    idx++;
  }
  return `${base}_${idx}`;
}

export function createUniqueC4BoundaryId(
  elements: ReadonlyArray<C4ElementData>,
  boundaries: ReadonlyArray<C4BoundaryData>,
  preferred = 'boundary'
): string {
  const used = new Set<string>([
    ...elements.map((e) => e.id),
    ...boundaries.map((b) => b.id),
  ]);
  const base = sanitizeC4Id(preferred);
  if (!used.has(base)) {
    return base;
  }
  let idx = boundaries.length + 1;
  while (used.has(`${base}_${idx}`)) {
    idx++;
  }
  return `${base}_${idx}`;
}

export function createUniqueC4RelationId(
  relations: ReadonlyArray<C4RelationData>
): string {
  const used = new Set(relations.map((r) => r.id));
  let idx = relations.length + 1;
  while (used.has(`rel_${idx}`)) {
    idx++;
  }
  return `rel_${idx}`;
}

/**
 * 境界IDを指定して配下の子孫境界ID集合を返す（循環防止用）。
 */
export function collectC4BoundaryDescendantIds(
  rootId: string,
  boundaries: ReadonlyArray<C4BoundaryData>
): Set<string> {
  const descendants = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const b of boundaries) {
      if (
        b.parentBoundaryId === current &&
        !descendants.has(b.id) &&
        b.id !== rootId
      ) {
        descendants.add(b.id);
        queue.push(b.id);
      }
    }
  }
  return descendants;
}

export function resolveC4ElementMacroName(el: C4ElementData): string {
  const extSuffix = el.external ? '_Ext' : '';
  if (el.kind === 'person') {
    return `Person${extSuffix}`;
  }
  const variantSuffix =
    el.variant === 'db' ? 'Db' : el.variant === 'queue' ? 'Queue' : '';
  const prefix =
    el.kind === 'system'
      ? 'System'
      : el.kind === 'container'
        ? 'Container'
        : 'Component';
  return `${prefix}${variantSuffix}${extSuffix}`;
}

export function resolveC4BoundaryMacroName(kind: C4BoundaryKind): string {
  switch (kind) {
    case 'enterprise':
      return 'Enterprise_Boundary';
    case 'system':
      return 'System_Boundary';
    case 'container':
      return 'Container_Boundary';
    case 'node':
      return 'Deployment_Node';
    default:
      return 'Boundary';
  }
}

export function isValidC4Data(val: unknown): val is C4DiagramData {
  if (!val || typeof val !== 'object') {
    return false;
  }
  const obj = val as Record<string, unknown>;
  if (obj.diagramType !== 'c4') {
    return false;
  }
  if (
    !Array.isArray(obj.elements) ||
    !Array.isArray(obj.boundaries) ||
    !Array.isArray(obj.relations)
  ) {
    return false;
  }
  const elementsOk = obj.elements.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      typeof (item as { id?: unknown }).id === 'string' &&
      typeof (item as { label?: unknown }).label === 'string'
  );
  const boundariesOk = obj.boundaries.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      typeof (item as { id?: unknown }).id === 'string' &&
      typeof (item as { label?: unknown }).label === 'string'
  );
  const relationsOk = obj.relations.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      typeof (item as { from?: unknown }).from === 'string' &&
      typeof (item as { to?: unknown }).to === 'string'
  );
  return elementsOk && boundariesOk && relationsOk;
}

export function normalizeC4Data(data: C4DiagramData): C4DiagramData {
  const subtype: C4DiagramSubtype = VALID_SUBTYPES.has(data.subtype)
    ? data.subtype
    : 'C4Context';

  const usedAliasIds = new Set<string>();
  const boundaryIdMap = new Map<string, string>();
  const normalizedBoundaries: C4BoundaryData[] = [];

  for (const b of data.boundaries) {
    const rawId = b.id.trim();
    const id = allocateUniqueId(sanitizeC4Id(rawId || 'boundary'), usedAliasIds);
    if (rawId && !boundaryIdMap.has(rawId)) {
      boundaryIdMap.set(rawId, id);
    }
    const kind: C4BoundaryKind = VALID_BOUNDARY_KINDS.has(b.kind)
      ? b.kind
      : 'system';
    const label = sanitizeC4QuotedText(b.label) || id;
    const boundaryType = b.boundaryType
      ? sanitizeC4QuotedText(b.boundaryType)
      : undefined;
    const descr = b.descr ? sanitizeC4QuotedText(b.descr) : undefined;
    const parentBoundaryId = b.parentBoundaryId?.trim() || undefined;

    normalizedBoundaries.push({
      id,
      kind,
      label,
      ...(boundaryType ? { boundaryType } : {}),
      ...(descr ? { descr } : {}),
      ...(parentBoundaryId ? { parentBoundaryId } : {}),
    });
  }

  // 親境界のIDを再マップし、存在しない親や自己・循環参照を断つ
  const validBoundaryIds = new Set(normalizedBoundaries.map((b) => b.id));
  const rawParentMap = new Map<string, string | undefined>();
  for (const b of normalizedBoundaries) {
    const mapped = b.parentBoundaryId
      ? boundaryIdMap.get(b.parentBoundaryId) ?? sanitizeC4Id(b.parentBoundaryId)
      : undefined;
    const safeParent =
      mapped && mapped !== b.id && validBoundaryIds.has(mapped)
        ? mapped
        : undefined;
    rawParentMap.set(b.id, safeParent);
  }

  for (const b of normalizedBoundaries) {
    let curr = rawParentMap.get(b.id);
    const seen = new Set<string>([b.id]);
    let hasCycle = false;
    while (curr) {
      if (seen.has(curr)) {
        hasCycle = true;
        break;
      }
      seen.add(curr);
      curr = rawParentMap.get(curr);
    }
    if (hasCycle) {
      rawParentMap.set(b.id, undefined);
      b.parentBoundaryId = undefined;
    } else {
      b.parentBoundaryId = rawParentMap.get(b.id);
    }
  }

  const elementIdMap = new Map<string, string>();
  const normalizedElements: C4ElementData[] = [];

  for (const el of data.elements) {
    const rawId = el.id.trim();
    const id = allocateUniqueId(sanitizeC4Id(rawId || 'element'), usedAliasIds);
    if (rawId && !elementIdMap.has(rawId)) {
      elementIdMap.set(rawId, id);
    }
    const kind: C4ElementKind = VALID_ELEMENT_KINDS.has(el.kind)
      ? el.kind
      : 'system';
    const variant: C4ElementVariant | undefined =
      kind !== 'person' && el.variant && VALID_ELEMENT_VARIANTS.has(el.variant)
        ? el.variant
        : undefined;
    const external = Boolean(el.external);
    const label = sanitizeC4QuotedText(el.label) || id;
    const techn =
      (kind === 'container' || kind === 'component') && el.techn
        ? sanitizeC4QuotedText(el.techn)
        : undefined;
    const descr = el.descr ? sanitizeC4QuotedText(el.descr) : undefined;
    const mappedBoundary = el.boundaryId
      ? boundaryIdMap.get(el.boundaryId.trim()) ?? sanitizeC4Id(el.boundaryId)
      : undefined;
    const boundaryId =
      mappedBoundary && validBoundaryIds.has(mappedBoundary)
        ? mappedBoundary
        : undefined;
    const bgColor = sanitizeCssColor(el.bgColor);
    const fontColor = sanitizeCssColor(el.fontColor);
    const borderColor = sanitizeCssColor(el.borderColor);

    normalizedElements.push({
      id,
      kind,
      ...(variant && variant !== 'standard' ? { variant } : {}),
      ...(external ? { external: true } : {}),
      label,
      ...(techn ? { techn } : {}),
      ...(descr ? { descr } : {}),
      ...(boundaryId ? { boundaryId } : {}),
      ...(bgColor ? { bgColor } : {}),
      ...(fontColor ? { fontColor } : {}),
      ...(borderColor ? { borderColor } : {}),
    });
  }

  const validElementIds = new Set(normalizedElements.map((e) => e.id));
  const usedRelIds = new Set<string>();
  const normalizedRelations: C4RelationData[] = [];

  for (const r of data.relations) {
    const from = elementIdMap.get(r.from.trim()) ?? sanitizeC4Id(r.from);
    const to = elementIdMap.get(r.to.trim()) ?? sanitizeC4Id(r.to);
    if (!validElementIds.has(from) || !validElementIds.has(to)) {
      continue;
    }
    const id = allocateUniqueId(
      sanitizeC4Id(r.id || 'rel'),
      usedRelIds
    );
    const relType: C4RelationType = VALID_RELATION_TYPES.has(r.relType)
      ? r.relType
      : 'Rel';
    const index =
      relType === 'RelIndex' && r.index
        ? sanitizeC4QuotedText(r.index)
        : undefined;
    const label = sanitizeC4QuotedText(r.label) || 'Uses';
    const techn = r.techn ? sanitizeC4QuotedText(r.techn) : undefined;
    const descr = r.descr ? sanitizeC4QuotedText(r.descr) : undefined;
    const lineColor = sanitizeCssColor(r.lineColor);
    const textColor = sanitizeCssColor(r.textColor);

    normalizedRelations.push({
      id,
      relType,
      ...(index ? { index } : {}),
      from,
      to,
      label,
      ...(techn ? { techn } : {}),
      ...(descr ? { descr } : {}),
      ...(lineColor ? { lineColor } : {}),
      ...(textColor ? { textColor } : {}),
    });
  }

  const title = data.title ? sanitizeC4Title(data.title) : undefined;
  const shapeInRow = clampGridCount(data.shapeInRow);
  const boundaryInRow = clampGridCount(data.boundaryInRow);
  const comments = (data.comments ?? [])
    .map(sanitizeSingleLineComment)
    .filter((line) => line.length > 0 && !/^@gui-state\s*:/i.test(line));

  return {
    diagramType: 'c4',
    subtype,
    ...(title ? { title } : {}),
    ...(shapeInRow ? { shapeInRow } : {}),
    ...(boundaryInRow ? { boundaryInRow } : {}),
    elements: normalizedElements,
    boundaries: normalizedBoundaries,
    relations: normalizedRelations,
    ...(comments.length > 0 ? { comments } : {}),
  };
}

function formatElementLine(el: C4ElementData, indent: string): string {
  const macro = resolveC4ElementMacroName(el);
  const args: string[] = [el.id, `"${sanitizeC4QuotedText(el.label) || el.id}"`];

  if (el.kind === 'container' || el.kind === 'component') {
    const techn = el.techn ? sanitizeC4QuotedText(el.techn) : '';
    const descr = el.descr ? sanitizeC4QuotedText(el.descr) : '';
    if (descr) {
      args.push(`"${techn}"`, `"${descr}"`);
    } else if (techn) {
      args.push(`"${techn}"`);
    }
  } else {
    const descr = el.descr ? sanitizeC4QuotedText(el.descr) : '';
    if (descr) {
      args.push(`"${descr}"`);
    }
  }

  return `${indent}${macro}(${args.join(', ')})`;
}

function formatBoundaryHeader(b: C4BoundaryData): string {
  const macro = resolveC4BoundaryMacroName(b.kind);
  const args: string[] = [b.id, `"${sanitizeC4QuotedText(b.label) || b.id}"`];

  if (b.kind === 'boundary') {
    const bType = b.boundaryType ? sanitizeC4QuotedText(b.boundaryType) : '';
    if (bType) {
      args.push(`"${bType}"`);
    }
  } else if (b.kind === 'node') {
    const bType = b.boundaryType ? sanitizeC4QuotedText(b.boundaryType) : '';
    const descr = b.descr ? sanitizeC4QuotedText(b.descr) : '';
    if (descr) {
      args.push(`"${bType}"`, `"${descr}"`);
    } else if (bType) {
      args.push(`"${bType}"`);
    }
  }

  return `${macro}(${args.join(', ')}) {`;
}

function formatRelationLine(rel: C4RelationData, indexOrder: number): string {
  const args: string[] = [];
  if (rel.relType === 'RelIndex') {
    const idxText = rel.index?.trim() || String(indexOrder);
    args.push(idxText);
  }
  args.push(rel.from, rel.to, `"${sanitizeC4QuotedText(rel.label) || 'Uses'}"`);

  const techn = rel.techn ? sanitizeC4QuotedText(rel.techn) : '';
  const descr = rel.descr ? sanitizeC4QuotedText(rel.descr) : '';
  if (descr) {
    args.push(`"${techn}"`, `"${descr}"`);
  } else if (techn) {
    args.push(`"${techn}"`);
  }

  return `  ${rel.relType}(${args.join(', ')})`;
}

export function generateC4Code(rawData: C4DiagramData): string {
  const data = normalizeC4Data(rawData);
  const lines: string[] = [];

  for (const comment of data.comments ?? []) {
    lines.push(`%% ${comment}`);
  }
  lines.push(formatGuiStateLine(data));
  lines.push(data.subtype);

  if (data.title) {
    lines.push(`  title ${data.title}`);
  }

  const elementsByBoundary = new Map<string | undefined, C4ElementData[]>();
  for (const el of data.elements) {
    const list = elementsByBoundary.get(el.boundaryId) ?? [];
    list.push(el);
    elementsByBoundary.set(el.boundaryId, list);
  }

  const boundariesByParent = new Map<string | undefined, C4BoundaryData[]>();
  for (const b of data.boundaries) {
    const list = boundariesByParent.get(b.parentBoundaryId) ?? [];
    list.push(b);
    boundariesByParent.set(b.parentBoundaryId, list);
  }

  const hasBoundaryContent = (boundaryId: string): boolean => {
    if ((elementsByBoundary.get(boundaryId)?.length ?? 0) > 0) {
      return true;
    }
    return (boundariesByParent.get(boundaryId) ?? []).some((child) =>
      hasBoundaryContent(child.id)
    );
  };

  const emitScope = (scopeId: string | undefined, level: number): void => {
    const indent = '  '.repeat(level);
    for (const el of elementsByBoundary.get(scopeId) ?? []) {
      lines.push(formatElementLine(el, indent));
    }
    for (const b of boundariesByParent.get(scopeId) ?? []) {
      // Mermaid C4構文は空の { } 境界ブロックを許容しないため、子要素または有効な子境界を持つ場合のみ出力する
      if (!hasBoundaryContent(b.id)) {
        continue;
      }
      lines.push(`${indent}${formatBoundaryHeader(b)}`);
      emitScope(b.id, level + 1);
      lines.push(`${indent}}`);
    }
  };

  emitScope(undefined, 1);

  data.relations.forEach((rel, idx) => {
    lines.push(formatRelationLine(rel, idx + 1));
  });

  for (const el of data.elements) {
    const styleArgs: string[] = [];
    if (el.bgColor) styleArgs.push(`$bgColor="${el.bgColor}"`);
    if (el.fontColor) styleArgs.push(`$fontColor="${el.fontColor}"`);
    if (el.borderColor) styleArgs.push(`$borderColor="${el.borderColor}"`);
    if (styleArgs.length > 0) {
      lines.push(`  UpdateElementStyle(${el.id}, ${styleArgs.join(', ')})`);
    }
  }

  for (const rel of data.relations) {
    const relStyleArgs: string[] = [];
    if (rel.textColor) relStyleArgs.push(`$textColor="${rel.textColor}"`);
    if (rel.lineColor) relStyleArgs.push(`$lineColor="${rel.lineColor}"`);
    if (relStyleArgs.length > 0) {
      lines.push(
        `  UpdateRelStyle(${rel.from}, ${rel.to}, ${relStyleArgs.join(', ')})`
      );
    }
  }

  if (data.shapeInRow || data.boundaryInRow) {
    const layoutArgs: string[] = [];
    if (data.shapeInRow) {
      layoutArgs.push(`$c4ShapeInRow="${data.shapeInRow}"`);
    }
    if (data.boundaryInRow) {
      layoutArgs.push(`$c4BoundaryInRow="${data.boundaryInRow}"`);
    }
    lines.push(`  UpdateLayoutConfig(${layoutArgs.join(', ')})`);
  }

  return lines.join('\n');
}

interface ParsedMacroCall {
  positional: string[];
  named: Record<string, string>;
}

/**
 * マクロ括弧内の引数リストをダブルクォートを考慮して分割する。
 */
function parseMacroArgs(argsRaw: string): ParsedMacroCall {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < argsRaw.length; i++) {
    const ch = argsRaw[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (ch === ',' && !inQuotes) {
      tokens.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0 || argsRaw.trim().endsWith(',')) {
    tokens.push(current.trim());
  }

  const positional: string[] = [];
  const named: Record<string, string> = {};

  for (const tok of tokens) {
    const kvMatch = tok.match(/^\$([a-zA-Z0-9_]+)\s*=\s*"([^"]*)"$/);
    if (kvMatch) {
      named[kvMatch[1]] = kvMatch[2].trim();
      continue;
    }
    const unquotedKvMatch = tok.match(/^\$([a-zA-Z0-9_]+)\s*=\s*(.+)$/);
    if (unquotedKvMatch) {
      named[unquotedKvMatch[1]] = unquotedKvMatch[2].replace(/^"|"$/g, '').trim();
      continue;
    }
    positional.push(tok.replace(/^"|"$/g, '').trim());
  }

  return { positional, named };
}

function parseElementMacro(
  macroName: string
): { kind: C4ElementKind; variant: C4ElementVariant; external: boolean } | null {
  const lower = macroName.toLowerCase();
  const external = lower.endsWith('_ext');
  const core = external ? lower.slice(0, -4) : lower;

  if (core === 'person') {
    return { kind: 'person', variant: 'standard', external };
  }
  const map: Record<string, { kind: C4ElementKind; variant: C4ElementVariant }> = {
    system: { kind: 'system', variant: 'standard' },
    systemdb: { kind: 'system', variant: 'db' },
    systemqueue: { kind: 'system', variant: 'queue' },
    container: { kind: 'container', variant: 'standard' },
    containerdb: { kind: 'container', variant: 'db' },
    containerqueue: { kind: 'container', variant: 'queue' },
    component: { kind: 'component', variant: 'standard' },
    componentdb: { kind: 'component', variant: 'db' },
    componentqueue: { kind: 'component', variant: 'queue' },
  };
  const matched = map[core];
  return matched ? { ...matched, external } : null;
}

function parseBoundaryMacro(macroName: string): C4BoundaryKind | null {
  switch (macroName.toLowerCase()) {
    case 'enterprise_boundary':
      return 'enterprise';
    case 'system_boundary':
      return 'system';
    case 'container_boundary':
      return 'container';
    case 'boundary':
      return 'boundary';
    case 'deployment_node':
    case 'node':
    case 'node_l':
    case 'node_r':
      return 'node';
    default:
      return null;
  }
}

function parseRelMacro(macroName: string): C4RelationType | null {
  switch (macroName.toLowerCase()) {
    case 'rel':
      return 'Rel';
    case 'birel':
      return 'BiRel';
    case 'rel_up':
    case 'rel_u':
      return 'Rel_Up';
    case 'rel_down':
    case 'rel_d':
      return 'Rel_Down';
    case 'rel_left':
    case 'rel_l':
      return 'Rel_Left';
    case 'rel_right':
    case 'rel_r':
      return 'Rel_Right';
    case 'rel_back':
    case 'rel_b':
      return 'Rel_Back';
    case 'relindex':
      return 'RelIndex';
    default:
      return null;
  }
}

export function parseC4CodeToGuiData(code: string): C4DiagramData {
  const lines = code.split(/\r?\n/);
  const embeddedState = extractGuiStateJson(lines, isValidC4Data);
  if (embeddedState) {
    return normalizeC4Data(embeddedState);
  }

  let subtype: C4DiagramSubtype = 'C4Context';
  let title: string | undefined;
  let shapeInRow: number | undefined;
  let boundaryInRow: number | undefined;
  const elements: C4ElementData[] = [];
  const boundaries: C4BoundaryData[] = [];
  const relations: C4RelationData[] = [];
  const comments: string[] = [];

  const boundaryStack: string[] = [];
  let inFrontmatter = false;
  let relIndexCounter = 1;

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
    if (trimmed.startsWith(GUI_STATE_PREFIX)) {
      continue;
    }
    if (trimmed.startsWith('%%')) {
      const commentBody = trimmed.slice(2).trim();
      if (commentBody) {
        comments.push(commentBody);
      }
      continue;
    }

    const headerMatch = trimmed.match(
      /^(C4(?:Context|Container|Component|Dynamic|Deployment))\b/i
    );
    if (headerMatch) {
      const canonical = C4_SUBTYPE_OPTIONS.find(
        (opt) => opt.toLowerCase() === headerMatch[1].toLowerCase()
      );
      if (canonical) {
        subtype = canonical;
      }
      continue;
    }

    if (/^title\s+/i.test(trimmed)) {
      title = sanitizeC4Title(trimmed.replace(/^title\s+/i, ''));
      continue;
    }

    if (trimmed === '}') {
      if (boundaryStack.length > 0) {
        boundaryStack.pop();
      }
      continue;
    }

    const macroMatch = trimmed.match(
      /^([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*)\)\s*(\{)?\s*$/
    );
    if (!macroMatch) {
      continue;
    }

    const macroName = macroMatch[1];
    const parsedArgs = parseMacroArgs(macroMatch[2]);
    const hasOpenBrace = Boolean(macroMatch[3]);

    const boundaryKind = parseBoundaryMacro(macroName);
    if (boundaryKind) {
      const id = sanitizeC4Id(parsedArgs.positional[0] || `boundary_${boundaries.length + 1}`);
      const label = parsedArgs.positional[1] || id;
      const boundaryType =
        boundaryKind === 'boundary' || boundaryKind === 'node'
          ? parsedArgs.positional[2] || parsedArgs.named.type || undefined
          : undefined;
      const descr =
        boundaryKind === 'node'
          ? parsedArgs.positional[3] || parsedArgs.named.descr || undefined
          : undefined;
      const parentBoundaryId =
        boundaryStack.length > 0
          ? boundaryStack[boundaryStack.length - 1]
          : undefined;

      boundaries.push({
        id,
        kind: boundaryKind,
        label,
        ...(boundaryType ? { boundaryType } : {}),
        ...(descr ? { descr } : {}),
        ...(parentBoundaryId ? { parentBoundaryId } : {}),
      });

      if (hasOpenBrace || lines[i + 1]?.trim() === '{') {
        boundaryStack.push(id);
        if (!hasOpenBrace && lines[i + 1]?.trim() === '{') {
          i++;
        }
      }
      continue;
    }

    const elSpec = parseElementMacro(macroName);
    if (elSpec) {
      const id = sanitizeC4Id(parsedArgs.positional[0] || `el_${elements.length + 1}`);
      const label = parsedArgs.positional[1] || id;
      const boundaryId =
        boundaryStack.length > 0
          ? boundaryStack[boundaryStack.length - 1]
          : undefined;

      let techn: string | undefined;
      let descr: string | undefined;
      if (elSpec.kind === 'container' || elSpec.kind === 'component') {
        techn = parsedArgs.positional[2] || parsedArgs.named.techn || undefined;
        descr = parsedArgs.positional[3] || parsedArgs.named.descr || undefined;
      } else {
        descr = parsedArgs.positional[2] || parsedArgs.named.descr || undefined;
      }

      elements.push({
        id,
        kind: elSpec.kind,
        ...(elSpec.variant !== 'standard' ? { variant: elSpec.variant } : {}),
        ...(elSpec.external ? { external: true } : {}),
        label,
        ...(techn ? { techn } : {}),
        ...(descr ? { descr } : {}),
        ...(boundaryId ? { boundaryId } : {}),
      });
      continue;
    }

    const relType = parseRelMacro(macroName);
    if (relType) {
      const offset = relType === 'RelIndex' ? 1 : 0;
      const index =
        relType === 'RelIndex' ? parsedArgs.positional[0] || undefined : undefined;
      const from = parsedArgs.positional[offset];
      const to = parsedArgs.positional[offset + 1];
      if (!from || !to) {
        continue;
      }
      const label = parsedArgs.positional[offset + 2] || 'Uses';
      const techn =
        parsedArgs.positional[offset + 3] || parsedArgs.named.techn || undefined;
      const descr =
        parsedArgs.positional[offset + 4] || parsedArgs.named.descr || undefined;

      relations.push({
        id: `rel_${relIndexCounter++}`,
        relType,
        ...(index ? { index } : {}),
        from: sanitizeC4Id(from),
        to: sanitizeC4Id(to),
        label,
        ...(techn ? { techn } : {}),
        ...(descr ? { descr } : {}),
      });
      continue;
    }

    if (macroName.toLowerCase() === 'updateelementstyle') {
      const targetId = sanitizeC4Id(parsedArgs.positional[0] || '');
      const el = elements.find((item) => item.id === targetId);
      if (el) {
        const bgColor = sanitizeCssColor(
          parsedArgs.named.bgColor ?? parsedArgs.positional[1]
        );
        const fontColor = sanitizeCssColor(
          parsedArgs.named.fontColor ?? parsedArgs.positional[2]
        );
        const borderColor = sanitizeCssColor(
          parsedArgs.named.borderColor ?? parsedArgs.positional[3]
        );
        if (bgColor) el.bgColor = bgColor;
        if (fontColor) el.fontColor = fontColor;
        if (borderColor) el.borderColor = borderColor;
      }
      continue;
    }

    if (macroName.toLowerCase() === 'updaterelstyle') {
      const from = sanitizeC4Id(parsedArgs.positional[0] || '');
      const to = sanitizeC4Id(parsedArgs.positional[1] || '');
      const rel = relations.find((item) => item.from === from && item.to === to);
      if (rel) {
        const textColor = sanitizeCssColor(
          parsedArgs.named.textColor ?? parsedArgs.positional[2]
        );
        const lineColor = sanitizeCssColor(
          parsedArgs.named.lineColor ?? parsedArgs.positional[3]
        );
        if (textColor) rel.textColor = textColor;
        if (lineColor) rel.lineColor = lineColor;
      }
      continue;
    }

    if (macroName.toLowerCase() === 'updatelayoutconfig') {
      const shapeVal = Number(
        parsedArgs.named.c4ShapeInRow ?? parsedArgs.positional[0]
      );
      const boundaryVal = Number(
        parsedArgs.named.c4BoundaryInRow ?? parsedArgs.positional[1]
      );
      if (Number.isFinite(shapeVal) && shapeVal >= 1) {
        shapeInRow = clampGridCount(shapeVal);
      }
      if (Number.isFinite(boundaryVal) && boundaryVal >= 1) {
        boundaryInRow = clampGridCount(boundaryVal);
      }
    }
  }

  return normalizeC4Data({
    diagramType: 'c4',
    subtype,
    ...(title ? { title } : {}),
    ...(shapeInRow ? { shapeInRow } : {}),
    ...(boundaryInRow ? { boundaryInRow } : {}),
    elements,
    boundaries,
    relations,
    ...(comments.length > 0 ? { comments } : {}),
  });
}
