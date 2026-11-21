import type { Language } from '../locales/types.ts';
import type { InfoDiagramData } from '../types/editor.ts';
import {
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
} from './mermaidEnvelope.ts';

function sanitizeInfoScalar(raw: string): string {
  return raw.replace(/[\r\n{}%]+/g, ' ').trim();
}

export function createDefaultInfoData(lang: Language = 'ja'): InfoDiagramData {
  if (lang === 'en') {
    return {
      diagramType: 'info',
      showInfo: true,
      title: 'Mermaid Runtime Info',
      accTitle: 'Mermaid Version',
      accDescr: 'Displays the active Mermaid version',
    };
  }
  return {
    diagramType: 'info',
    showInfo: true,
    title: 'Mermaidバージョン情報',
    accTitle: 'バージョン情報',
    accDescr: '現在使用中のMermaidバージョン番号を表示します',
  };
}

function isInfoGuiData(val: unknown): val is InfoDiagramData {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  return obj.diagramType === 'info' && typeof obj.showInfo === 'boolean';
}

export function generateInfoCode(data: InfoDiagramData): string {
  const lines: string[] = ['info'];

  const safeComments = (data.comments ?? [])
    .map((c) => sanitizeSingleLineComment(c))
    .filter(Boolean);
  for (const comment of safeComments) {
    lines.push(`  %% ${comment}`);
  }

  if (data.showInfo) {
    lines.push('  showInfo');
  }

  const trimmedTitle = data.title ? sanitizeInfoScalar(data.title) : '';
  const trimmedAccTitle = data.accTitle ? sanitizeInfoScalar(data.accTitle) : '';
  const trimmedAccDescr = data.accDescr ? sanitizeInfoScalar(data.accDescr) : '';

  if (trimmedTitle) {
    lines.push(`  title ${trimmedTitle}`);
  }
  if (trimmedAccTitle) {
    lines.push(`  accTitle: ${trimmedAccTitle}`);
  }
  if (trimmedAccDescr) {
    lines.push(`  accDescr: ${trimmedAccDescr}`);
  }

  const guiState: InfoDiagramData = {
    diagramType: 'info',
    showInfo: Boolean(data.showInfo),
    title: trimmedTitle || undefined,
    accTitle: trimmedAccTitle || undefined,
    accDescr: trimmedAccDescr || undefined,
    comments: safeComments.length > 0 ? safeComments : undefined,
  };
  lines.push(formatGuiStateLine(guiState));
  return lines.join('\n');
}

export function parseInfoCodeToGuiData(code: string): InfoDiagramData {
  const lines = code.split(/\r?\n/);
  const guiState = extractGuiStateJson<InfoDiagramData>(lines, isInfoGuiData);
  if (guiState) {
    return {
      diagramType: 'info',
      showInfo: Boolean(guiState.showInfo),
      title:
        typeof guiState.title === 'string' && guiState.title.trim()
          ? sanitizeInfoScalar(guiState.title)
          : undefined,
      accTitle:
        typeof guiState.accTitle === 'string' && guiState.accTitle.trim()
          ? sanitizeInfoScalar(guiState.accTitle)
          : undefined,
      accDescr:
        typeof guiState.accDescr === 'string' && guiState.accDescr.trim()
          ? sanitizeInfoScalar(guiState.accDescr)
          : undefined,
      comments: Array.isArray(guiState.comments)
        ? guiState.comments.filter((c): c is string => typeof c === 'string')
        : undefined,
    };
  }

  let showInfo = false;
  let title: string | undefined;
  let accTitle: string | undefined;
  let accDescr: string | undefined;
  const comments: string[] = [];
  let inFrontmatter = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (i === 0 && trimmed === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (trimmed === '---') inFrontmatter = false;
      continue;
    }
    if (!trimmed) continue;
    if (trimmed.startsWith('%%')) {
      const c = sanitizeSingleLineComment(trimmed.slice(2));
      if (c && !c.startsWith('@gui-state:')) comments.push(c);
      continue;
    }
    if (/^info\b/i.test(trimmed)) continue;
    if (/^showInfo\b/i.test(trimmed)) {
      showInfo = true;
      continue;
    }
    const titleM = trimmed.match(/^title\s+(.+)$/i);
    if (titleM) {
      title = sanitizeInfoScalar(titleM[1]);
      continue;
    }
    const atM = trimmed.match(/^accTitle\s*:\s*(.+)$/i);
    if (atM) {
      accTitle = sanitizeInfoScalar(atM[1]);
      continue;
    }
    const adM = trimmed.match(/^accDescr\s*:\s*(.+)$/i);
    if (adM) {
      accDescr = sanitizeInfoScalar(adM[1]);
      continue;
    }
  }

  return {
    diagramType: 'info',
    showInfo,
    title,
    accTitle,
    accDescr,
    comments: comments.length > 0 ? comments : undefined,
  };
}
