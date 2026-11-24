import type {
  C4BoundaryData,
  C4DiagramData,
  C4ElementData,
  C4RelationData,
} from '../../types/editor';
import { formatGuiStateLine } from '../mermaidEnvelope.ts';
import {
  resolveC4BoundaryMacroName,
  resolveC4ElementMacroName,
  sanitizeC4QuotedText,
} from './defaults.ts';
import { normalizeC4Data } from './normalize.ts';

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
