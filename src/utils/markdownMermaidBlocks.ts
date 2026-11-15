export interface MermaidBlockMeta {
  index: number;
  startLine: number;
  endLine: number;
  code: string;
}

interface ScannedMermaidBlock extends MermaidBlockMeta {
  startLineIndex: number;
  endLineIndex: number;
  indent: string;
}

interface ActiveFenceState {
  char: '`' | '~';
  length: number;
  indent: string;
  isMermaid: boolean;
  startLineIndex: number;
  buffer: string[];
}

const FENCE_OPEN_REGEX = /^(\s{0,3})(`{3,}|~{3,})\s*([^\s`~]+)?(.*)$/;
const FENCE_CLOSE_REGEX = /^\s{0,3}(`{3,}|~{3,})\s*$/;

function scanMermaidBlocks(markdown: string): {
  lines: string[];
  blocks: ScannedMermaidBlock[];
} {
  const lines = markdown.split(/\r?\n/);
  const blocks: ScannedMermaidBlock[] = [];
  let activeFence: ActiveFenceState | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (!activeFence) {
      const openMatch = line.match(FENCE_OPEN_REGEX);
      if (!openMatch) {
        continue;
      }

      const indent = openMatch[1];
      const fenceSeq = openMatch[2];
      const fenceChar = fenceSeq[0] as '`' | '~';
      const infoLang = openMatch[3] ?? '';
      const infoRest = openMatch[4] ?? '';

      // CommonMark仕様: バッククォートフェンスのinfo文字列にはバッククォートを含められない
      if (fenceChar === '`' && (infoLang.includes('`') || infoRest.includes('`'))) {
        continue;
      }

      activeFence = {
        char: fenceChar,
        length: fenceSeq.length,
        indent,
        isMermaid: infoLang.toLowerCase() === 'mermaid',
        startLineIndex: i,
        buffer: [],
      };
      continue;
    }

    const closeMatch = line.match(FENCE_CLOSE_REGEX);
    if (
      closeMatch &&
      closeMatch[1][0] === activeFence.char &&
      closeMatch[1].length >= activeFence.length
    ) {
      if (activeFence.isMermaid) {
        blocks.push({
          index: blocks.length,
          startLine: activeFence.startLineIndex + 1,
          endLine: i + 1,
          code: activeFence.buffer.join('\n'),
          startLineIndex: activeFence.startLineIndex,
          endLineIndex: i,
          indent: activeFence.indent,
        });
      }
      activeFence = null;
      continue;
    }

    if (activeFence.isMermaid) {
      activeFence.buffer.push(line);
    }
  }

  if (activeFence && activeFence.isMermaid) {
    blocks.push({
      index: blocks.length,
      startLine: activeFence.startLineIndex + 1,
      endLine: lines.length,
      code: activeFence.buffer.join('\n'),
      startLineIndex: activeFence.startLineIndex,
      endLineIndex: lines.length - 1,
      indent: activeFence.indent,
    });
  }

  return { lines, blocks };
}

/**
 * CommonMarkのコードフェンス規則に従い、Markdown内のMermaidブロックを抽出する。
 */
export function extractMermaidBlocks(markdown: string): MermaidBlockMeta[] {
  const { blocks } = scanMermaidBlocks(markdown);
  return blocks.map(({ index, startLine, endLine, code }) => ({
    index,
    startLine,
    endLine,
    code,
  }));
}

/**
 * 指定インデックスのMermaidブロックを新しいコードで安全に置き換える。
 */
export function replaceMermaidBlock(
  markdown: string,
  targetBlockIndex: number,
  newMermaidCode: string
): string {
  const { lines, blocks } = scanMermaidBlocks(markdown);
  const target = blocks[targetBlockIndex];
  if (!target) {
    return markdown;
  }

  const replacementLines = [
    `${target.indent}\`\`\`mermaid`,
    ...newMermaidCode.split(/\r?\n/),
    `${target.indent}\`\`\``,
  ];
  lines.splice(
    target.startLineIndex,
    target.endLineIndex - target.startLineIndex + 1,
    ...replacementLines
  );
  return lines.join('\n');
}
