import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import { InspectorCollapsibleSection } from './InspectorCollapsibleSection';
import {
  InspectorBulkControls,
  InspectorCommentsSection,
} from './InspectorCommon';
import {
  FORBIDDEN_INFO_TEXT_CHARS_REGEX,
  FORBIDDEN_PACKET_TEXT_CHARS_REGEX,
} from '../utils/inputSafeguard';
import {
  computePacketBitRanges,
  PACKET_BITS_PER_ROW_OPTIONS,
} from '../utils/packetConverter';
import type { PacketBlockData, PacketDiagramData } from '../types/editor';

export interface PacketInspectorProps {
  packetData: PacketDiagramData;
  selectedBlockId: string | null;
  onChange: (next: PacketDiagramData) => void;
  onSelectBlock: (blockId: string | null) => void;
}

type PacketSectionKey = 'block' | 'layout' | 'comments';

export default function PacketInspector({
  packetData,
  selectedBlockId,
  onChange,
  onSelectBlock,
}: PacketInspectorProps) {
  const { t } = useI18n();
  const pk = t.inspector.packet;
  const safeguard = t.inspector.safeguard;

  const ranges = computePacketBitRanges(packetData.blocks);
  const selectedIndex = packetData.blocks.findIndex(
    (b) => b.id === selectedBlockId
  );
  const selectedRange = selectedIndex >= 0 ? ranges[selectedIndex] : null;
  const selectedBlock = selectedRange?.block ?? null;

  const [openSections, setOpenSections] = useState<
    Record<PacketSectionKey, boolean>
  >({
    block: true,
    layout: false,
    comments: false,
  });

  useEffect(() => {
    if (selectedBlockId) {
      setOpenSections((prev) => (prev.block ? prev : { ...prev, block: true }));
    }
  }, [selectedBlockId]);

  const toggleSection = (key: PacketSectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSections = (open: boolean): void => {
    setOpenSections({ block: open, layout: open, comments: open });
  };

  const allExpanded = Object.values(openSections).every(Boolean);

  const updateSelected = (patch: Partial<PacketBlockData>): void => {
    if (!selectedBlock) return;
    onChange({
      ...packetData,
      blocks: packetData.blocks.map((b) =>
        b.id === selectedBlock.id ? { ...b, ...patch } : b
      ),
    });
  };

  const handleMove = (delta: -1 | 1): void => {
    if (selectedIndex < 0) return;
    const nextIdx = selectedIndex + delta;
    if (nextIdx < 0 || nextIdx >= packetData.blocks.length) return;
    const next = [...packetData.blocks];
    const [moved] = next.splice(selectedIndex, 1);
    next.splice(nextIdx, 0, moved);
    onChange({ ...packetData, blocks: next });
  };

  const handleDelete = (): void => {
    if (!selectedBlock) return;
    const next = packetData.blocks.filter((b) => b.id !== selectedBlock.id);
    onChange({ ...packetData, blocks: next });
    onSelectBlock(next[0]?.id ?? null);
  };

  return (
    <div className="inspector-panel">
      <InspectorBulkControls allExpanded={allExpanded} onSetAll={setAllSections} />

      <InspectorCollapsibleSection
        title={pk.blockSection}
        isOpen={openSections.block}
        onToggle={() => toggleSection('block')}
      >
        {selectedBlock && selectedRange ? (
          <>
            <div className="inspector-role-badge">
              {pk.bitRangeLabel(
                selectedRange.startBit,
                selectedRange.endBit,
                selectedBlock.bits
              )}
            </div>

            <label className="inspector-field">
              <span>{pk.blockLabelField}</span>
              <GuardedInput
                value={selectedBlock.label}
                placeholder={pk.blockLabelPlaceholder}
                forbiddenRegex={FORBIDDEN_PACKET_TEXT_CHARS_REGEX}
                formatError={safeguard.packetTextErrorChars}
                onChangeValue={(label) => updateSelected({ label })}
              />
            </label>

            <label className="inspector-field">
              <span>{pk.bitsCountField}</span>
              <input
                type="number"
                min={1}
                step={1}
                value={selectedBlock.bits}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  updateSelected({ bits: Number.isFinite(n) && n >= 1 ? n : 1 });
                }}
              />
            </label>

            <div className="journey-score-btn-group">
              {[1, 4, 8, 16, 32].map((w) => (
                <button
                  key={w}
                  type="button"
                  className={`inspector-choice-btn ${
                    selectedBlock.bits === w ? 'is-active' : ''
                  }`}
                  onClick={() => updateSelected({ bits: w })}
                >
                  {w}b
                </button>
              ))}
            </div>

            <div className="timeline-events-heading-row">
              <button
                type="button"
                className="btn-secondary btn-xs"
                disabled={selectedIndex === 0}
                onClick={() => handleMove(-1)}
              >
                <ArrowUp size={12} />
                <span>{pk.moveUpTitle}</span>
              </button>
              <button
                type="button"
                className="btn-secondary btn-xs"
                disabled={selectedIndex === packetData.blocks.length - 1}
                onClick={() => handleMove(1)}
              >
                <ArrowDown size={12} />
                <span>{pk.moveDownTitle}</span>
              </button>
            </div>

            <button
              type="button"
              className="btn-danger-outline"
              onClick={handleDelete}
            >
              <Trash2 size={14} />
              <span>{pk.deleteBlockBtn}</span>
            </button>
          </>
        ) : (
          <p className="inspector-hint">{pk.selectBlockPrompt}</p>
        )}
      </InspectorCollapsibleSection>

      <InspectorCollapsibleSection
        title={pk.layoutSection}
        isOpen={openSections.layout}
        onToggle={() => toggleSection('layout')}
      >
        <label className="inspector-field">
          <span>{pk.bitsPerRowField}</span>
          <select
            value={packetData.bitsPerRow ?? 32}
            onChange={(e) =>
              onChange({
                ...packetData,
                bitsPerRow: Number.parseInt(e.target.value, 10) || 32,
              })
            }
          >
            {PACKET_BITS_PER_ROW_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt} bits
              </option>
            ))}
          </select>
        </label>

        <label className="inspector-checkbox-row">
          <input
            type="checkbox"
            checked={packetData.showBits !== false}
            onChange={(e) =>
              onChange({ ...packetData, showBits: e.target.checked })
            }
          />
          <span>{pk.showBitsField}</span>
        </label>

        <label className="inspector-field">
          <span>{pk.titleField}</span>
          <GuardedInput
            value={packetData.title ?? ''}
            placeholder={pk.titlePlaceholder}
            forbiddenRegex={FORBIDDEN_INFO_TEXT_CHARS_REGEX}
            formatError={safeguard.infoTextErrorChars}
            onChangeValue={(val) =>
              onChange({ ...packetData, title: val || undefined })
            }
          />
        </label>
      </InspectorCollapsibleSection>

      <InspectorCommentsSection
        title={pk.commentsSection}
        fieldLabel={pk.commentsField}
        placeholder={pk.commentsPlaceholder}
        comments={packetData.comments}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
        onChangeComments={(comments) => onChange({ ...packetData, comments })}
      />
    </div>
  );
}
