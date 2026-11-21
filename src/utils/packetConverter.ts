import type { Language } from '../locales/types.ts';
import type { PacketBlockData, PacketDiagramData } from '../types/editor.ts';
import {
  allocateUniqueId,
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
} from './mermaidEnvelope.ts';

export const PACKET_BITS_PER_ROW_OPTIONS: ReadonlyArray<number> = [8, 16, 32, 64];

export interface PacketBitRangeItem {
  block: PacketBlockData;
  startBit: number;
  endBit: number;
}

function sanitizePacketText(raw: string, fallback: string): string {
  const cleaned = raw.replace(/["\\\r\n]/g, '').trim();
  return cleaned || fallback;
}

function sanitizePacketTitle(raw: string): string {
  return raw.replace(/[\r\n%]+/g, ' ').trim();
}

export function computePacketBitRanges(
  blocks: ReadonlyArray<PacketBlockData>
): PacketBitRangeItem[] {
  let cursor = 0;
  return blocks.map((block) => {
    const bits = Number.isFinite(block.bits) && block.bits >= 1 ? Math.round(block.bits) : 1;
    const startBit = cursor;
    const endBit = cursor + bits - 1;
    cursor = endBit + 1;
    return {
      block: { ...block, bits },
      startBit,
      endBit,
    };
  });
}

export function createDefaultPacketData(lang: Language = 'ja'): PacketDiagramData {
  if (lang === 'en') {
    return {
      diagramType: 'packet',
      title: 'TCP Header',
      bitsPerRow: 32,
      showBits: true,
      blocks: [
        { id: 'pkt1', bits: 16, label: 'Source Port' },
        { id: 'pkt2', bits: 16, label: 'Destination Port' },
        { id: 'pkt3', bits: 32, label: 'Sequence Number' },
        { id: 'pkt4', bits: 4, label: 'Header Len' },
        { id: 'pkt5', bits: 4, label: 'Reserved' },
        { id: 'pkt6', bits: 8, label: 'Control Flags' },
        { id: 'pkt7', bits: 16, label: 'Window Size' },
      ],
    };
  }
  return {
    diagramType: 'packet',
    title: 'TCPヘッダ構造',
    bitsPerRow: 32,
    showBits: true,
    blocks: [
      { id: 'pkt1', bits: 16, label: '送信元ポート' },
      { id: 'pkt2', bits: 16, label: '宛先ポート' },
      { id: 'pkt3', bits: 32, label: 'シーケンス番号' },
      { id: 'pkt4', bits: 4, label: 'ヘッダ長' },
      { id: 'pkt5', bits: 4, label: '予約' },
      { id: 'pkt6', bits: 8, label: '制御フラグ' },
      { id: 'pkt7', bits: 16, label: 'ウィンドウサイズ' },
    ],
  };
}

function isPacketGuiData(val: unknown): val is PacketDiagramData {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  return obj.diagramType === 'packet' && Array.isArray(obj.blocks);
}

export function generatePacketCode(data: PacketDiagramData): string {
  const bitsPerRow =
    typeof data.bitsPerRow === 'number' && data.bitsPerRow >= 4
      ? Math.round(data.bitsPerRow)
      : 32;
  const showBits = data.showBits !== false;
  const needsFrontmatter = bitsPerRow !== 32 || !showBits;

  const lines: string[] = [];
  if (needsFrontmatter) {
    lines.push('---');
    lines.push('config:');
    lines.push('  packet:');
    lines.push(`    bitsPerRow: ${bitsPerRow}`);
    lines.push(`    showBits: ${showBits}`);
    lines.push('---');
  }

  lines.push('packet-beta');

  const safeComments = (data.comments ?? [])
    .map((c) => sanitizeSingleLineComment(c))
    .filter(Boolean);
  for (const comment of safeComments) {
    lines.push(`  %% ${comment}`);
  }

  const trimmedTitle = data.title ? sanitizePacketTitle(data.title) : '';
  if (trimmedTitle) {
    lines.push(`  title ${trimmedTitle}`);
  }

  const ranges = computePacketBitRanges(data.blocks);
  const normBlocks: PacketBlockData[] = [];
  for (let i = 0; i < ranges.length; i++) {
    const { block, startBit, endBit } = ranges[i];
    const safeLabel = sanitizePacketText(block.label, `Field ${i + 1}`);
    normBlocks.push({ ...block, label: safeLabel });
    if (startBit === endBit) {
      lines.push(`  ${startBit}: "${safeLabel}"`);
    } else {
      lines.push(`  ${startBit}-${endBit}: "${safeLabel}"`);
    }
  }

  const guiState: PacketDiagramData = {
    diagramType: 'packet',
    title: trimmedTitle || undefined,
    bitsPerRow,
    showBits,
    blocks: normBlocks,
    comments: safeComments.length > 0 ? safeComments : undefined,
  };
  lines.push(formatGuiStateLine(guiState));
  return lines.join('\n');
}

export function parsePacketCodeToGuiData(code: string): PacketDiagramData {
  const lines = code.split(/\r?\n/);
  const guiState = extractGuiStateJson<PacketDiagramData>(lines, isPacketGuiData);
  if (guiState) {
    return {
      diagramType: 'packet',
      title: typeof guiState.title === 'string' && guiState.title.trim() ? guiState.title.trim() : undefined,
      bitsPerRow:
        typeof guiState.bitsPerRow === 'number' && guiState.bitsPerRow >= 4
          ? Math.round(guiState.bitsPerRow)
          : 32,
      showBits: guiState.showBits !== false,
      blocks: guiState.blocks.map((b, idx) => ({
        id: String(b.id || `pkt_${idx + 1}`),
        bits: Number.isFinite(b.bits) && b.bits >= 1 ? Math.round(b.bits) : 1,
        label: sanitizePacketText(String(b.label ?? ''), `Field ${idx + 1}`),
      })),
      comments: Array.isArray(guiState.comments)
        ? guiState.comments.filter((c): c is string => typeof c === 'string')
        : undefined,
    };
  }

  let title: string | undefined;
  let bitsPerRow = 32;
  let showBits = true;
  const blocks: PacketBlockData[] = [];
  const comments: string[] = [];
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
        const bpr = trimmed.match(/^bitsPerRow\s*:\s*(\d+)/i);
        if (bpr) {
          const parsed = Number.parseInt(bpr[1], 10);
          if (parsed >= 4) bitsPerRow = parsed;
        }
        const sb = trimmed.match(/^showBits\s*:\s*(true|false)/i);
        if (sb) {
          showBits = sb[1].toLowerCase() === 'true';
        }
      }
      continue;
    }
    if (!trimmed) continue;
    if (trimmed.startsWith('%%')) {
      const c = sanitizeSingleLineComment(trimmed.slice(2));
      if (c && !c.startsWith('@gui-state:')) comments.push(c);
      continue;
    }
    if (/^packet(?:-beta)?\b/i.test(trimmed)) continue;

    const titleM = trimmed.match(/^title\s+(.+)$/i);
    if (titleM) {
      title = sanitizePacketTitle(titleM[1]);
      continue;
    }

    const plusM = trimmed.match(/^\+(\d+)\s*:\s*(?:"([^"]*)"|'([^']*)')/);
    if (plusM) {
      const bits = Math.max(1, Number.parseInt(plusM[1], 10));
      const label = sanitizePacketText(
        plusM[2] ?? plusM[3] ?? '',
        `Field ${blocks.length + 1}`
      );
      blocks.push({
        id: allocateUniqueId(`pkt_${blocks.length + 1}`, usedIds),
        bits,
        label,
      });
      continue;
    }

    const rangeM = trimmed.match(/^(\d+)(?:\s*-\s*(\d+))?\s*:\s*(?:"([^"]*)"|'([^']*)')/);
    if (rangeM) {
      const start = Number.parseInt(rangeM[1], 10);
      const end = rangeM[2] !== undefined ? Number.parseInt(rangeM[2], 10) : start;
      const bits = Math.max(1, end - start + 1);
      const label = sanitizePacketText(
        rangeM[3] ?? rangeM[4] ?? '',
        `Field ${blocks.length + 1}`
      );
      blocks.push({
        id: allocateUniqueId(`pkt_${blocks.length + 1}`, usedIds),
        bits,
        label,
      });
    }
  }

  return {
    diagramType: 'packet',
    title,
    bitsPerRow,
    showBits,
    blocks,
    comments: comments.length > 0 ? comments : undefined,
  };
}
