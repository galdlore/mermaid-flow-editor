import { Plus } from 'lucide-react';
import { useI18n } from '../i18n';
import { allocateUniqueId } from '../utils/mermaidEnvelope';
import {
  computePacketBitRanges,
  PACKET_BITS_PER_ROW_OPTIONS,
} from '../utils/packetConverter';
import type { PacketBlockData, PacketDiagramData } from '../types/editor';

export interface PacketCanvasProps {
  packetData: PacketDiagramData;
  selectedBlockId: string | null;
  onChange: (next: PacketDiagramData) => void;
  onSelectBlock: (blockId: string | null) => void;
}

interface PacketRowSegment {
  block: PacketBlockData;
  startBit: number;
  endBit: number;
  cols: number;
}

function splitBlocksIntoRows(
  blocks: ReadonlyArray<PacketBlockData>,
  bitsPerRow: number
): PacketRowSegment[][] {
  const ranges = computePacketBitRanges(blocks);
  const rows: PacketRowSegment[][] = [];
  let currentRow: PacketRowSegment[] = [];
  let rowFilled = 0;

  for (const item of ranges) {
    let remaining = item.block.bits;
    let segStart = item.startBit;
    while (remaining > 0) {
      const spaceInRow = bitsPerRow - rowFilled;
      const take = Math.min(remaining, spaceInRow);
      currentRow.push({
        block: item.block,
        startBit: segStart,
        endBit: segStart + take - 1,
        cols: take,
      });
      segStart += take;
      remaining -= take;
      rowFilled += take;
      if (rowFilled >= bitsPerRow) {
        rows.push(currentRow);
        currentRow = [];
        rowFilled = 0;
      }
    }
  }
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }
  return rows;
}

export default function PacketCanvas({
  packetData,
  selectedBlockId,
  onChange,
  onSelectBlock,
}: PacketCanvasProps) {
  const { t } = useI18n();
  const pk = t.inspector.packet;
  const bitsPerRow = packetData.bitsPerRow ?? 32;
  const showBits = packetData.showBits !== false;
  const rows = splitBlocksIntoRows(packetData.blocks, bitsPerRow);

  const handleAddBlock = (): void => {
    const usedIds = new Set(packetData.blocks.map((b) => b.id));
    const id = allocateUniqueId(`pkt_${packetData.blocks.length + 1}`, usedIds);
    const num = packetData.blocks.length + 1;
    onChange({
      ...packetData,
      blocks: [
        ...packetData.blocks,
        { id, bits: 8, label: pk.defaultBlockLabel(num) },
      ],
    });
    onSelectBlock(id);
  };

  return (
    <div className="packet-canvas">
      <div className="systems-toolbar">
        <button
          type="button"
          className="btn-primary btn-xs"
          onClick={handleAddBlock}
        >
          <Plus size={13} />
          <span>{pk.addBlockBtn}</span>
        </button>

        {PACKET_BITS_PER_ROW_OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`inspector-choice-btn ${bitsPerRow === opt ? 'is-active' : ''}`}
            onClick={() => onChange({ ...packetData, bitsPerRow: opt })}
          >
            {opt}b
          </button>
        ))}

        <button
          type="button"
          className={`inspector-choice-btn ${showBits ? 'is-active' : ''}`}
          onClick={() => onChange({ ...packetData, showBits: !showBits })}
        >
          {pk.showBitsField}
        </button>
      </div>

      <div className="systems-canvas-scroll">
        {packetData.title && (
          <div className="systems-title-banner">{packetData.title}</div>
        )}

        {packetData.blocks.length === 0 ? (
          <div className="systems-empty-state">{pk.emptyBlocks}</div>
        ) : (
          <div className="packet-rows-stack">
            {rows.map((rowSegments, rIdx) => (
              <div key={rIdx} className="packet-row-wrap">
                {showBits && rIdx === 0 && (
                  <div
                    className="packet-bit-ruler"
                    style={{
                      gridTemplateColumns: `repeat(${bitsPerRow}, minmax(0, 1fr))`,
                    }}
                  >
                    {Array.from({ length: bitsPerRow }, (_, b) => (
                      <div key={b} className="packet-bit-tick">
                        {b}
                      </div>
                    ))}
                  </div>
                )}
                <div
                  className="packet-blocks-grid"
                  style={{
                    gridTemplateColumns: `repeat(${bitsPerRow}, minmax(0, 1fr))`,
                  }}
                >
                  {rowSegments.map((seg, sIdx) => (
                    <button
                      key={`${seg.block.id}_${sIdx}`}
                      type="button"
                      className={`packet-segment-btn ${
                        selectedBlockId === seg.block.id ? 'is-selected' : ''
                      }`}
                      style={{ gridColumn: `span ${seg.cols}` }}
                      onClick={() => onSelectBlock(seg.block.id)}
                    >
                      <span>{seg.block.label}</span>
                      <span className="packet-segment-range">
                        {seg.startBit === seg.endBit
                          ? `${seg.startBit}`
                          : `${seg.startBit}-${seg.endBit}`}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
