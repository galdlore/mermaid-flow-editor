import type { ClassDiagramData, ClassNodeData } from '../../types/editor';
import {
  formatGuiStateLine,
  sanitizeSingleLineComment,
  sanitizeYamlSingleQuoted,
} from '../mermaidEnvelope.ts';
import {
  formatClassMemberSignature,
  normalizeClassData,
  sanitizeClassMemberText,
  sanitizeClassQuotedText,
} from './shared.ts';

function emitClassDeclaration(
  lines: string[],
  cls: ClassNodeData,
  colorClassMap: Map<string, string>,
  indent: string
): void {
  const genericPart = cls.generic ? `~${cls.generic}~` : '';
  const labelPart = cls.label ? `["${sanitizeClassQuotedText(cls.label)}"]` : '';
  const classStylePart =
    cls.color && colorClassMap.has(cls.color)
      ? `:::${colorClassMap.get(cls.color)}`
      : '';
  const header = `${indent}class ${cls.id}${genericPart}${labelPart}${classStylePart}`;

  if (!cls.stereotype && cls.members.length === 0) {
    lines.push(header);
    return;
  }

  lines.push(`${header} {`);
  if (cls.stereotype) {
    lines.push(`${indent}  <<${cls.stereotype}>>`);
  }
  for (const member of cls.members) {
    lines.push(`${indent}  ${formatClassMemberSignature(member)}`);
  }
  lines.push(`${indent}}`);
}

export function generateClassCode(rawData: ClassDiagramData): string {
  const data = normalizeClassData(rawData);
  const lines: string[] = [];

  if (data.title) {
    lines.push('---');
    lines.push(`title: '${sanitizeYamlSingleQuoted(data.title)}'`);
    lines.push('---');
  }

  lines.push('classDiagram');

  for (const comment of data.comments ?? []) {
    const clean = sanitizeSingleLineComment(comment);
    if (clean) {
      lines.push(`  %% ${clean}`);
    }
  }

  if (data.direction && data.direction !== 'TB') {
    lines.push(`  direction ${data.direction}`);
  }

  const colorToClassName = new Map<string, string>();
  for (const cls of data.classes) {
    if (cls.color && !colorToClassName.has(cls.color)) {
      const className = `cls_color_${colorToClassName.size + 1}`;
      colorToClassName.set(cls.color, className);
      lines.push(`  classDef ${className} fill:${cls.color},stroke:#64748b,color:#0f172a`);
    }
  }

  const emittedNamespaces = new Set<string>();
  for (const cls of data.classes) {
    if (cls.namespace) {
      if (emittedNamespaces.has(cls.namespace)) {
        continue;
      }
      emittedNamespaces.add(cls.namespace);
      lines.push(`  namespace ${cls.namespace} {`);
      for (const nsMember of data.classes) {
        if (nsMember.namespace === cls.namespace) {
          emitClassDeclaration(lines, nsMember, colorToClassName, '    ');
        }
      }
      lines.push('  }');
    } else {
      emitClassDeclaration(lines, cls, colorToClassName, '  ');
    }
  }

  for (const note of data.notes ?? []) {
    const text = `"${sanitizeClassQuotedText(note.text)}"`;
    if (note.targetClassId) {
      lines.push(`  note for ${note.targetClassId} ${text}`);
    } else {
      lines.push(`  note ${text}`);
    }
  }

  for (const rel of data.relations) {
    const parts = [rel.from];
    if (rel.fromCardinality) {
      parts.push(`"${sanitizeClassQuotedText(rel.fromCardinality)}"`);
    }
    parts.push(rel.relationType);
    if (rel.toCardinality) {
      parts.push(`"${sanitizeClassQuotedText(rel.toCardinality)}"`);
    }
    parts.push(rel.to);
    const labelPart = rel.label ? ` : ${sanitizeClassMemberText(rel.label)}` : '';
    lines.push(`  ${parts.join(' ')}${labelPart}`);
  }

  lines.push(formatGuiStateLine(data));
  return lines.join('\n');
}
