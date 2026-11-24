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
} from '../../types/editor';
import { sanitizeCssColor } from '../inputSafeguard.ts';
import { GUI_STATE_PREFIX, extractGuiStateJson } from '../mermaidEnvelope.ts';
import {
  C4_SUBTYPE_OPTIONS,
  clampGridCount,
  sanitizeC4Id,
  sanitizeC4Title,
} from './defaults.ts';
import { isValidC4Data, normalizeC4Data } from './normalize.ts';

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
