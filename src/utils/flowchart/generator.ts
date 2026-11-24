import type { MermaidDiagramData } from '../../types/editor';
import { sanitizeSafeUrl } from '../inputSafeguard.ts';
import { formatGuiStateLine, sanitizeSingleLineComment } from '../mermaidEnvelope.ts';
import {
  emitNodeLines,
  getConnectorParts,
  normalizeDiagramData,
  sanitizeClassName,
  sanitizeId,
  sanitizeMermaidText,
} from './shared.ts';

export function generateMermaidCode(rawData: MermaidDiagramData): string {
  const data = normalizeDiagramData(rawData);
  const isSwimlane = data.diagramType === 'swimlane';
  const headerLine = isSwimlane
    ? `swimlane-beta ${data.direction}`
    : `flowchart ${data.direction}`;
  const lines: string[] = [headerLine];

  for (const comment of data.comments ?? []) {
    const clean = sanitizeSingleLineComment(comment);
    if (clean) {
      lines.push(`  %% ${clean}`);
    }
  }

  for (const classDef of data.classDefs ?? []) {
    const className = sanitizeClassName(classDef.name);
    if (!className) {
      continue;
    }
    const props: string[] = [];
    if (classDef.fill) props.push(`fill:${classDef.fill}`);
    if (classDef.stroke) props.push(`stroke:${classDef.stroke}`);
    if (classDef.color) props.push(`color:${classDef.color}`);
    if (props.length > 0) {
      lines.push(`  classDef ${className} ${props.join(',')}`);
    }
  }

  const subgraphs = data.subgraphs ?? [];
  const subgraphIds = new Set(subgraphs.map((sg) => sg.id));

  for (const sg of subgraphs) {
    const sgId = sanitizeId(sg.id);
    const sgTitle = sanitizeMermaidText(sg.title || sg.id) || sgId;
    lines.push(`  subgraph ${sgId}["${sgTitle}"]`);
    if (!isSwimlane && sg.direction) {
      lines.push(`    direction ${sg.direction}`);
    }
    for (const node of data.nodes) {
      if (node.subgraphId === sg.id) {
        emitNodeLines(lines, node, '    ');
      }
    }
    lines.push('  end');

    const sgStyleParts: string[] = [];
    if (sg.fill && sg.fill !== '#ffffff') sgStyleParts.push(`fill:${sg.fill}`);
    if (sg.stroke) sgStyleParts.push(`stroke:${sg.stroke}`);
    if (sg.fill && sg.fill !== '#ffffff') sgStyleParts.push('color:#0f172a');
    if (sgStyleParts.length > 0) {
      lines.push(`  style ${sgId} ${sgStyleParts.join(',')}`);
    }
  }

  for (const node of data.nodes) {
    if (!node.subgraphId || !subgraphIds.has(node.subgraphId)) {
      emitNodeLines(lines, node, '  ');
    }
  }

  for (const node of data.nodes) {
    if (node.className) {
      const className = sanitizeClassName(node.className);
      if (className) {
        lines.push(`  class ${sanitizeId(node.id)} ${className}`);
      }
    }
  }

  const linkStyleLines: string[] = [];
  data.edges.forEach((edge, index) => {
    const sourceId = sanitizeId(edge.source);
    const targetId = sanitizeId(edge.target);
    const parts = getConnectorParts(edge.lineType, edge.extraLength ?? 0);
    const labelText = edge.label ? sanitizeMermaidText(edge.label) : '';

    if (labelText) {
      if (edge.labelStyle === 'inline' && parts.startPrefix && parts.endSuffix) {
        lines.push(`  ${sourceId} ${parts.startPrefix} "${labelText}" ${parts.endSuffix} ${targetId}`);
      } else {
        lines.push(`  ${sourceId} ${parts.connector}|"${labelText}"| ${targetId}`);
      }
    } else {
      lines.push(`  ${sourceId} ${parts.connector} ${targetId}`);
    }

    if (edge.strokeColor) {
      linkStyleLines.push(`  linkStyle ${index} stroke:${edge.strokeColor}`);
    }
  });

  lines.push(...linkStyleLines);

  for (const node of data.nodes) {
    const safeUrl = sanitizeSafeUrl(node.linkUrl);
    if (safeUrl) {
      const encodedUrl = safeUrl.replace(/"/g, '%22');
      const tooltip = node.linkTooltip?.trim()
        ? ` "${sanitizeMermaidText(node.linkTooltip.trim())}"`
        : '';
      lines.push(`  click ${sanitizeId(node.id)} "${encodedUrl}"${tooltip}`);
    }
  }

  lines.push(formatGuiStateLine(data));
  return lines.join('\n');
}
