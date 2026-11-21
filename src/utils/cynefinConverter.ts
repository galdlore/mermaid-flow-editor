import type {
  CynefinDiagramData,
  CynefinDomainName,
  CynefinItemData,
  CynefinTransitionData,
} from '../types/editor.ts';
import {
  allocateUniqueId,
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
} from './mermaidEnvelope.ts';

export const CYNEFIN_DOMAIN_ORDER: ReadonlyArray<CynefinDomainName> = [
  'complex',
  'complicated',
  'clear',
  'chaotic',
  'confusion',
];

const VALID_DOMAIN_SET = new Set<string>(CYNEFIN_DOMAIN_ORDER);

export function sanitizeCynefinText(raw: string): string {
  return raw.replace(/["\\\r\n]+/g, ' ').trim();
}

export function createDefaultCynefinData(
  lang: 'ja' | 'en' = 'ja'
): CynefinDiagramData {
  const isJa = lang === 'ja';
  return {
    diagramType: 'cynefin',
    title: isJa ? '課題の意思決定分類' : 'Situation Decision Matrix',
    items: [
      { id: 'cyn_1', domain: 'complex', label: isJa ? '新規事業のプロトタイプ検証' : 'New market experiment' },
      { id: 'cyn_2', domain: 'complicated', label: isJa ? 'DBボトルネックの分析' : 'Performance bottleneck analysis' },
      { id: 'cyn_3', domain: 'clear', label: isJa ? '定例デプロイ手順の実行' : 'Standard deployment runbook' },
      { id: 'cyn_4', domain: 'chaotic', label: isJa ? '本番障害の緊急復旧' : 'Major outage triage' },
      { id: 'cyn_5', domain: 'confusion', label: isJa ? '方針未定の要望対応' : 'Unscoped stakeholder request' },
    ],
    transitions: [
      {
        id: 'ctr_1',
        from: 'complex',
        to: 'complicated',
        label: isJa ? '知見の体系化' : 'Codify insights',
      },
      {
        id: 'ctr_2',
        from: 'chaotic',
        to: 'clear',
        label: isJa ? '標準手順化' : 'Standardize',
      },
    ],
  };
}

export function isValidCynefinData(value: unknown): value is CynefinDiagramData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Partial<CynefinDiagramData>;
  if (
    obj.diagramType !== 'cynefin' ||
    !Array.isArray(obj.items) ||
    !Array.isArray(obj.transitions)
  ) {
    return false;
  }
  return (
    obj.items.every(
      (item) =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.domain === 'string' &&
        VALID_DOMAIN_SET.has(item.domain) &&
        typeof item.label === 'string'
    ) &&
    obj.transitions.every(
      (tr) =>
        Boolean(tr) &&
        typeof tr === 'object' &&
        typeof tr.id === 'string' &&
        typeof tr.from === 'string' &&
        typeof tr.to === 'string' &&
        VALID_DOMAIN_SET.has(tr.from) &&
        VALID_DOMAIN_SET.has(tr.to)
    )
  );
}

export function normalizeCynefinData(raw: CynefinDiagramData): CynefinDiagramData {
  const usedItemIds = new Set<string>();
  const items: CynefinItemData[] = [];

  for (let i = 0; i < raw.items.length; i++) {
    const src = raw.items[i];
    const baseId =
      src.id && /^[a-zA-Z0-9_-]+$/.test(src.id) ? src.id : `cyn_${i + 1}`;
    const id = allocateUniqueId(baseId, usedItemIds);
    const domain: CynefinDomainName = VALID_DOMAIN_SET.has(src.domain)
      ? src.domain
      : 'complex';
    items.push({
      id,
      domain,
      label: sanitizeCynefinText(src.label) || `Item ${i + 1}`,
    });
  }

  const usedTransitionIds = new Set<string>();
  const transitions: CynefinTransitionData[] = [];
  for (let i = 0; i < raw.transitions.length; i++) {
    const src = raw.transitions[i];
    if (!VALID_DOMAIN_SET.has(src.from) || !VALID_DOMAIN_SET.has(src.to)) {
      continue;
    }
    const baseId =
      src.id && /^[a-zA-Z0-9_-]+$/.test(src.id) ? src.id : `ctr_${i + 1}`;
    const id = allocateUniqueId(baseId, usedTransitionIds);
    const label = src.label ? sanitizeCynefinText(src.label) : '';
    transitions.push({
      id,
      from: src.from,
      to: src.to,
      ...(label ? { label } : {}),
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
    diagramType: 'cynefin',
    ...(title ? { title } : {}),
    items,
    transitions,
    ...(comments && comments.length > 0 ? { comments } : {}),
  };
}

export function generateCynefinCode(rawData: CynefinDiagramData): string {
  const data = normalizeCynefinData(rawData);
  const lines: string[] = ['cynefin-beta'];

  if (data.title) {
    lines.push(`  title ${data.title}`);
  }

  for (const domain of CYNEFIN_DOMAIN_ORDER) {
    const domainItems = data.items.filter((item) => item.domain === domain);
    if (domainItems.length === 0) {
      continue;
    }
    lines.push(`  ${domain}`);
    for (const item of domainItems) {
      lines.push(`    "${item.label}"`);
    }
  }

  for (const tr of data.transitions) {
    if (tr.from === tr.to) {
      continue;
    }
    if (tr.label) {
      lines.push(`  ${tr.from} --> ${tr.to}: "${tr.label}"`);
    } else {
      lines.push(`  ${tr.from} --> ${tr.to}`);
    }
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

export function parseCynefinCodeToGuiData(code: string): CynefinDiagramData {
  const lines = code.split(/\r?\n/);
  const fromGuiState = extractGuiStateJson(lines, isValidCynefinData);
  if (fromGuiState) {
    return normalizeCynefinData(fromGuiState);
  }

  const items: CynefinItemData[] = [];
  const transitions: CynefinTransitionData[] = [];
  const comments: string[] = [];
  let title = '';
  let currentDomain: CynefinDomainName | null = null;
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
    if (/^cynefin-beta\b/i.test(trimmed) || /^acc(?:Title|Descr)\b/i.test(trimmed)) {
      continue;
    }
    const titleMatch = /^title\s+(.+)$/i.exec(trimmed);
    if (titleMatch) {
      title = titleMatch[1].replace(/[#;\r\n]+/g, ' ').trim();
      continue;
    }

    const domainOnlyMatch =
      /^(complex|complicated|clear|chaotic|confusion)$/i.exec(trimmed);
    if (domainOnlyMatch) {
      currentDomain = domainOnlyMatch[1].toLowerCase() as CynefinDomainName;
      continue;
    }

    const transMatch =
      /^(complex|complicated|clear|chaotic|confusion)\s*-->\s*(complex|complicated|clear|chaotic|confusion)(?:\s*:\s*(?:"([^"]*)"|'([^']*)'|(.+)))?\s*$/i.exec(
        trimmed
      );
    if (transMatch) {
      const label = sanitizeCynefinText(
        transMatch[3] ?? transMatch[4] ?? transMatch[5] ?? ''
      );
      transitions.push({
        id: `ctr_${transitions.length + 1}`,
        from: transMatch[1].toLowerCase() as CynefinDomainName,
        to: transMatch[2].toLowerCase() as CynefinDomainName,
        ...(label ? { label } : {}),
      });
      continue;
    }

    if (currentDomain) {
      const quotedMatch = /^"([^"]*)"|'([^']*)'$/.exec(trimmed);
      const label = sanitizeCynefinText(
        quotedMatch ? (quotedMatch[1] ?? quotedMatch[2] ?? '') : trimmed
      );
      if (label) {
        items.push({
          id: `cyn_${items.length + 1}`,
          domain: currentDomain,
          label,
        });
      }
    }
  }

  return normalizeCynefinData({
    diagramType: 'cynefin',
    ...(title ? { title } : {}),
    items,
    transitions,
    ...(comments.length > 0 ? { comments } : {}),
  });
}
