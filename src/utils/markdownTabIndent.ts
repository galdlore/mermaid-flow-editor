export const TAB_SIZE_OPTIONS = [2, 4] as const;
export type TabSizeOption = (typeof TAB_SIZE_OPTIONS)[number];

export interface TabIndentEditResult {
  nextValue: string;
  nextStart: number;
  nextEnd: number;
}

/**
 * Tab / Shift+Tab 押下時のスペース挿入および行インデント増減を計算する。
 */
export function computeTabIndentEdit(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  tabSize: number,
  shiftKey: boolean
): TabIndentEditResult {
  const safeSize = Math.max(1, tabSize);
  const indentUnit = ' '.repeat(safeSize);
  const selectedText = value.slice(selectionStart, selectionEnd);

  if (!shiftKey && !selectedText.includes('\n')) {
    const nextValue =
      value.slice(0, selectionStart) + indentUnit + value.slice(selectionEnd);
    const nextCursor = selectionStart + indentUnit.length;
    return {
      nextValue,
      nextStart: nextCursor,
      nextEnd: nextCursor,
    };
  }

  const blockStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
  const effectiveEnd =
    selectionEnd > selectionStart && value[selectionEnd - 1] === '\n'
      ? selectionEnd - 1
      : selectionEnd;
  const nextNewline = value.indexOf('\n', effectiveEnd);
  const blockEnd = nextNewline === -1 ? value.length : nextNewline;

  const targetLines = value.slice(blockStart, blockEnd).split('\n');

  if (!shiftKey) {
    const indentedBlock = targetLines
      .map((line) => indentUnit + line)
      .join('\n');
    return {
      nextValue:
        value.slice(0, blockStart) + indentedBlock + value.slice(blockEnd),
      nextStart: selectionStart + indentUnit.length,
      nextEnd: selectionEnd + indentUnit.length * targetLines.length,
    };
  }

  let firstRemoved = 0;
  let totalRemoved = 0;
  const outdentedLines = targetLines.map((line, index) => {
    let removeCount = 0;
    if (line.startsWith('\t')) {
      removeCount = 1;
    } else {
      while (removeCount < safeSize && line[removeCount] === ' ') {
        removeCount += 1;
      }
    }
    if (index === 0) {
      firstRemoved = removeCount;
    }
    totalRemoved += removeCount;
    return line.slice(removeCount);
  });

  const nextStart = Math.max(blockStart, selectionStart - firstRemoved);
  const nextEnd =
    selectionStart === selectionEnd
      ? nextStart
      : Math.max(nextStart, selectionEnd - totalRemoved);

  return {
    nextValue:
      value.slice(0, blockStart) +
      outdentedLines.join('\n') +
      value.slice(blockEnd),
    nextStart,
    nextEnd,
  };
}
