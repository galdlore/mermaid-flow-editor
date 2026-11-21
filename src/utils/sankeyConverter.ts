import type { Language } from '../locales/types.ts';
import type { SankeyDiagramData, SankeyLinkData } from '../types/editor.ts';
import {
  allocateUniqueId,
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
  sanitizeYamlSingleQuoted,
  unquoteYamlString,
} from './mermaidEnvelope.ts';

export function sanitizeSankeyLabel(raw: string, fallback = 'Node'): string {
  const cleaned = raw
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/"/g, '')
    .trim();
  return cleaned || fallback;
}

function formatSankeyCsvField(field: string): string {
  return field.includes(',') ? `"${field}"` : field;
}

function parseSankeyCsvLine(line: string): [string, string, number] | null {
  const fields: string[] = [];
  let idx = 0;
  while (idx < line.length) {
    if (line[idx] === '"') {
      idx++;
      let buf = '';
      while (idx < line.length) {
        if (line[idx] === '"' && line[idx + 1] === '"') {
          buf += '"';
          idx += 2;
        } else if (line[idx] === '"') {
          idx++;
          break;
        } else {
          buf += line[idx++];
        }
      }
      fields.push(buf);
      if (line[idx] === ',') idx++;
    } else {
      const commaIdx = line.indexOf(',', idx);
      if (commaIdx === -1) {
        fields.push(line.slice(idx));
        break;
      }
      fields.push(line.slice(idx, commaIdx));
      idx = commaIdx + 1;
    }
  }
  if (fields.length < 3) return null;
  const src = sanitizeSankeyLabel(fields[0], '');
  const tgt = sanitizeSankeyLabel(fields[1], '');
  const val = Number.parseFloat(fields[2].trim());
  if (!src || !tgt || !Number.isFinite(val) || val <= 0) return null;
  return [src, tgt, val];
}

export function createDefaultSankeyData(lang: Language = 'ja'): SankeyDiagramData {
  if (lang === 'en') {
    return {
      diagramType: 'sankey',
      title: 'Budget Allocation',
      links: [
        { id: 'sk1', source: 'Revenue', target: 'Engineering', value: 45 },
        { id: 'sk2', source: 'Revenue', target: 'Operations', value: 30 },
        { id: 'sk3', source: 'Revenue', target: 'Marketing', value: 25 },
        { id: 'sk4', source: 'Engineering', target: 'Platform', value: 25 },
        { id: 'sk5', source: 'Engineering', target: 'Product', value: 20 },
      ],
      comments: ['Department budget distribution'],
    };
  }
  return {
    diagramType: 'sankey',
    title: '部門別予算配分',
    links: [
      { id: 'sk1', source: 'Revenue', target: 'Engineering', value: 45 },
      { id: 'sk2', source: 'Revenue', target: 'Operations', value: 30 },
      { id: 'sk3', source: 'Revenue', target: 'Marketing', value: 25 },
      { id: 'sk4', source: 'Engineering', target: 'Platform', value: 25 },
      { id: 'sk5', source: 'Engineering', target: 'Product', value: 20 },
    ],
    comments: ['売上配分と開発チーム別内訳'],
  };
}

function isSankeyGuiData(val: unknown): val is SankeyDiagramData {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  return obj.diagramType === 'sankey' && Array.isArray(obj.links);
}

export function generateSankeyCode(data: SankeyDiagramData): string {
  const lines: string[] = [];
  const trimmedTitle = data.title ? data.title.replace(/[\r\n]+/g, ' ').trim() : '';
  if (trimmedTitle) {
    lines.push('---');
    lines.push(`title: '${sanitizeYamlSingleQuoted(trimmedTitle)}'`);
    lines.push('---');
  }

  lines.push('sankey-beta');

  const safeComments = (data.comments ?? [])
    .map((c) => sanitizeSingleLineComment(c))
    .filter(Boolean);
  for (const comment of safeComments) {
    lines.push(`%% ${comment}`);
  }

  const normLinks: SankeyLinkData[] = [];
  for (let i = 0; i < data.links.length; i++) {
    const link = data.links[i];
    const source = sanitizeSankeyLabel(link.source, `Source${i + 1}`);
    const target = sanitizeSankeyLabel(link.target, `Target${i + 1}`);
    if (source === target) continue;
    const value =
      Number.isFinite(link.value) && link.value > 0
        ? Math.round(link.value * 100) / 100
        : 1;
    normLinks.push({ ...link, source, target, value });
    lines.push(
      `${formatSankeyCsvField(source)},${formatSankeyCsvField(target)},${value}`
    );
  }

  const guiState: SankeyDiagramData = {
    diagramType: 'sankey',
    title: trimmedTitle || undefined,
    links: normLinks,
    comments: safeComments.length > 0 ? safeComments : undefined,
  };
  lines.push(formatGuiStateLine(guiState));
  return lines.join('\n');
}

export function parseSankeyCodeToGuiData(code: string): SankeyDiagramData {
  const lines = code.split(/\r?\n/);
  const guiState = extractGuiStateJson<SankeyDiagramData>(lines, isSankeyGuiData);
  if (guiState) {
    return {
      diagramType: 'sankey',
      title: typeof guiState.title === 'string' && guiState.title.trim() ? guiState.title.trim() : undefined,
      links: guiState.links
        .map((link, idx) => {
          const source = sanitizeSankeyLabel(String(link.source ?? ''), `Source${idx + 1}`);
          const target = sanitizeSankeyLabel(String(link.target ?? ''), `Target${idx + 1}`);
          const value =
            Number.isFinite(link.value) && link.value > 0
              ? Math.round(link.value * 100) / 100
              : 1;
          return {
            id: String(link.id || `sk_${idx + 1}`),
            source,
            target,
            value,
          };
        })
        .filter((link) => link.source !== link.target),
      comments: Array.isArray(guiState.comments)
        ? guiState.comments.filter((c): c is string => typeof c === 'string')
        : undefined,
    };
  }

  let title: string | undefined;
  const comments: string[] = [];
  const links: SankeyLinkData[] = [];
  const usedIds = new Set<string>();
  let inFrontmatter = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (i === 0 && trimmed === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (trimmed === '---') {
        inFrontmatter = false;
      } else {
        const tm = trimmed.match(/^title\s*:\s*(.+)$/i);
        if (tm) title = unquoteYamlString(tm[1]);
      }
      continue;
    }
    if (!trimmed) continue;
    if (trimmed.startsWith('%%')) {
      const c = sanitizeSingleLineComment(trimmed.slice(2));
      if (c && !c.startsWith('@gui-state:')) comments.push(c);
      continue;
    }
    if (/^sankey(?:-beta)?\b/i.test(trimmed)) continue;

    const parsedRow = parseSankeyCsvLine(trimmed);
    if (parsedRow && parsedRow[0] !== parsedRow[1]) {
      links.push({
        id: allocateUniqueId(`sk_${links.length + 1}`, usedIds),
        source: parsedRow[0],
        target: parsedRow[1],
        value: parsedRow[2],
      });
    }
  }

  return {
    diagramType: 'sankey',
    title,
    links,
    comments: comments.length > 0 ? comments : undefined,
  };
}
