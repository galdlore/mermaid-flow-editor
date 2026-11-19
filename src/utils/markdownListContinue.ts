export interface ListContinueEditResult {
  nextValue: string;
  nextStart: number;
  nextEnd: number;
}

const FENCE_OPEN_REGEX = /^\s{0,3}(`{3,}|~{3,})(.*)$/;
const FENCE_CLOSE_REGEX = /^\s{0,3}(`{3,}|~{3,})\s*$/;

const TASK_LIST_REGEX = /^([ \t]*)([-*+])([ \t]+)\[[ xX]\]([ \t]+)(.*)$/;
const BULLET_LIST_REGEX = /^([ \t]*)([-*+])([ \t]+)(.*)$/;
const ORDERED_LIST_REGEX = /^([ \t]*)(\d+)([.)])([ \t]+)(.*)$/;

function getIndentWidth(indent: string): number {
  let width = 0;
  for (let i = 0; i < indent.length; i += 1) {
    width += indent[i] === '\t' ? 2 : 1;
  }
  return width;
}

function isInsideOpenCodeFence(lines: readonly string[], lineIndex: number): boolean {
  let activeChar: '`' | '~' | null = null;
  let activeLength = 0;

  for (let i = 0; i < lineIndex; i += 1) {
    const line = lines[i];
    if (activeChar === null) {
      const openMatch = line.match(FENCE_OPEN_REGEX);
      if (!openMatch) {
        continue;
      }
      const seq = openMatch[1];
      const char = seq[0] as '`' | '~';
      const rest = openMatch[2] ?? '';
      if (char === '`' && rest.includes('`')) {
        continue;
      }
      activeChar = char;
      activeLength = seq.length;
    } else {
      const closeMatch = line.match(FENCE_CLOSE_REGEX);
      if (closeMatch) {
        const seq = closeMatch[1];
        if (seq[0] === activeChar && seq.length >= activeLength) {
          activeChar = null;
          activeLength = 0;
        }
      }
    }
  }

  return activeChar !== null;
}

function renumberContiguousOrderedItems(
  lines: string[],
  startIndex: number,
  baseIndent: string,
  startNumber: number
): void {
  const baseWidth = getIndentWidth(baseIndent);
  let nextNumber = startNumber;

  for (let i = startIndex; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*$/.test(line)) {
      break;
    }

    const indentMatch = line.match(/^([ \t]*)/);
    const lineIndent = indentMatch ? indentMatch[1] : '';
    const lineWidth = getIndentWidth(lineIndent);

    if (lineWidth < baseWidth) {
      break;
    }
    if (lineWidth > baseWidth) {
      continue;
    }
    if (lineIndent !== baseIndent) {
      break;
    }

    const orderedMatch = line.match(ORDERED_LIST_REGEX);
    if (!orderedMatch) {
      break;
    }

    const [, indent, , delim, space, content] = orderedMatch;
    lines[i] = `${indent}${nextNumber}${delim}${space}${content}`;
    nextNumber += 1;
  }
}

function getLineStartOffset(lines: readonly string[], lineIndex: number): number {
  let offset = 0;
  for (let i = 0; i < lineIndex; i += 1) {
    offset += lines[i].length + 1;
  }
  return offset;
}

function findLineIndexAtOffset(lines: readonly string[], offset: number): {
  lineIndex: number;
  lineStartOffset: number;
} {
  let currentOffset = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const lineEnd = currentOffset + lines[i].length;
    if (offset <= lineEnd || i === lines.length - 1) {
      return { lineIndex: i, lineStartOffset: currentOffset };
    }
    currentOffset = lineEnd + 1;
  }
  return { lineIndex: 0, lineStartOffset: 0 };
}

/**
 * 2ペイン直接編集で Enter 押下時の Markdown リスト自動継続・終了・連番振り直しを計算する。
 * リスト継続対象外の場合は null を返し、ブラウザ標準の改行動作に委ねる。
 */
export function computeListContinueEdit(
  value: string,
  selectionStart: number,
  selectionEnd: number
): ListContinueEditResult | null {
  if (selectionStart < 0 || selectionEnd < selectionStart || selectionEnd > value.length) {
    return null;
  }

  if (value.slice(selectionStart, selectionEnd).includes('\n')) {
    return null;
  }

  const lines = value.split('\n');
  const { lineIndex, lineStartOffset } = findLineIndexAtOffset(lines, selectionStart);

  if (isInsideOpenCodeFence(lines, lineIndex)) {
    return null;
  }

  const currentLine = lines[lineIndex];
  const colStart = selectionStart - lineStartOffset;
  const colEnd = selectionEnd - lineStartOffset;

  const taskMatch = currentLine.match(TASK_LIST_REGEX);
  if (taskMatch) {
    const [, indent, bullet, sp1, sp2, content] = taskMatch;
    const markerLength = indent.length + bullet.length + sp1.length + 3 + sp2.length;
    if (colStart < markerLength) {
      return null;
    }

    if (content.trim().length === 0) {
      lines[lineIndex] = '';
      const nextValue = lines.join('\n');
      return {
        nextValue,
        nextStart: lineStartOffset,
        nextEnd: lineStartOffset,
      };
    }

    const beforeCursor = currentLine.slice(0, colStart);
    const afterCursor = currentLine.slice(colEnd);
    const nextPrefix = `${indent}${bullet}${sp1}[ ] `;
    lines.splice(lineIndex, 1, beforeCursor, `${nextPrefix}${afterCursor}`);
    const nextCursor = lineStartOffset + beforeCursor.length + 1 + nextPrefix.length;
    return {
      nextValue: lines.join('\n'),
      nextStart: nextCursor,
      nextEnd: nextCursor,
    };
  }

  const bulletMatch = currentLine.match(BULLET_LIST_REGEX);
  if (bulletMatch) {
    const [, indent, bullet, sp, content] = bulletMatch;
    const markerLength = indent.length + bullet.length + sp.length;
    if (colStart < markerLength) {
      return null;
    }

    if (content.trim().length === 0) {
      lines[lineIndex] = '';
      const nextValue = lines.join('\n');
      return {
        nextValue,
        nextStart: lineStartOffset,
        nextEnd: lineStartOffset,
      };
    }

    const beforeCursor = currentLine.slice(0, colStart);
    const afterCursor = currentLine.slice(colEnd);
    const nextPrefix = `${indent}${bullet}${sp}`;
    lines.splice(lineIndex, 1, beforeCursor, `${nextPrefix}${afterCursor}`);
    const nextCursor = lineStartOffset + beforeCursor.length + 1 + nextPrefix.length;
    return {
      nextValue: lines.join('\n'),
      nextStart: nextCursor,
      nextEnd: nextCursor,
    };
  }

  const orderedMatch = currentLine.match(ORDERED_LIST_REGEX);
  if (orderedMatch) {
    const [, indent, numStr, delim, sp, content] = orderedMatch;
    const markerLength = indent.length + numStr.length + delim.length + sp.length;
    if (colStart < markerLength) {
      return null;
    }

    if (content.trim().length === 0) {
      lines[lineIndex] = '';
      renumberContiguousOrderedItems(lines, lineIndex + 1, indent, 1);
      const nextCursor = getLineStartOffset(lines, lineIndex);
      return {
        nextValue: lines.join('\n'),
        nextStart: nextCursor,
        nextEnd: nextCursor,
      };
    }

    const beforeCursor = currentLine.slice(0, colStart);
    const afterCursor = currentLine.slice(colEnd);
    const nextNumber = Number.parseInt(numStr, 10) + 1;
    const nextPrefix = `${indent}${nextNumber}${delim}${sp}`;
    lines.splice(lineIndex, 1, beforeCursor, `${nextPrefix}${afterCursor}`);
    renumberContiguousOrderedItems(lines, lineIndex + 2, indent, nextNumber + 1);

    const nextCursor = lineStartOffset + beforeCursor.length + 1 + nextPrefix.length;
    return {
      nextValue: lines.join('\n'),
      nextStart: nextCursor,
      nextEnd: nextCursor,
    };
  }

  return null;
}
