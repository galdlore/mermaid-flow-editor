import { Plus } from 'lucide-react';
import { useI18n } from '../i18n';
import type { VennDiagramData } from '../types/editor';
import { allocateUniqueId } from '../utils/mermaidEnvelope';

export interface VennCanvasProps {
  vennData: VennDiagramData;
  selectedSetId: string | null;
  selectedUnionId: string | null;
  onChange: (next: VennDiagramData) => void;
  onSelectSet: (setId: string | null) => void;
  onSelectUnion: (unionId: string | null) => void;
}

const DEFAULT_FILLS = ['#dbeafe', '#dcfce7', '#fef9c3', '#f3e8ff', '#ffe4e6'];
const DEFAULT_STROKES = ['#2563eb', '#16a34a', '#ca8a04', '#9333ea', '#e11d48'];

export default function VennCanvas({
  vennData,
  selectedSetId,
  selectedUnionId,
  onChange,
  onSelectSet,
  onSelectUnion,
}: VennCanvasProps) {
  const { t } = useI18n();
  const vn = t.inspector.venn;

  const handleAddSet = (): void => {
    const usedIds = new Set(vennData.sets.map((s) => s.id));
    const letter = String.fromCharCode(65 + (vennData.sets.length % 26));
    const id = allocateUniqueId(letter, usedIds);
    const idx = vennData.sets.length % DEFAULT_FILLS.length;
    onChange({
      ...vennData,
      sets: [
        ...vennData.sets,
        {
          id,
          label: vn.defaultSetLabel(id),
          size: 16,
          fill: DEFAULT_FILLS[idx],
          stroke: DEFAULT_STROKES[idx],
        },
      ],
    });
    onSelectUnion(null);
    onSelectSet(id);
  };

  const handleAddUnion = (): void => {
    if (vennData.sets.length < 2) return;
    const usedIds = new Set(vennData.unions.map((u) => u.id));
    const id = allocateUniqueId(`union_${vennData.unions.length + 1}`, usedIds);
    const pair = [vennData.sets[0].id, vennData.sets[1].id].sort();
    onChange({
      ...vennData,
      unions: [
        ...vennData.unions,
        {
          id,
          sets: pair,
          label: `${vennData.sets[0].label} ∩ ${vennData.sets[1].label}`,
          size: 5,
        },
      ],
    });
    onSelectSet(null);
    onSelectUnion(id);
  };

  // Compute SVG circle geometry for previewing up to N sets cleanly
  const count = vennData.sets.length;
  const maxSize = Math.max(1, ...vennData.sets.map((s) => s.size));
  const circles = vennData.sets.map((setItem, i) => {
    const r = 42 + Math.sqrt(setItem.size / maxSize) * 44;
    let cx = 240;
    let cy = 135;
    if (count === 2) {
      cx = i === 0 ? 185 : 295;
    } else if (count >= 3) {
      const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / count;
      cx = 240 + Math.cos(angle) * 68;
      cy = 140 + Math.sin(angle) * 52;
    }
    return {
      setItem,
      cx,
      cy,
      r,
      fill: setItem.fill ?? DEFAULT_FILLS[i % DEFAULT_FILLS.length],
      stroke: setItem.stroke ?? DEFAULT_STROKES[i % DEFAULT_STROKES.length],
    };
  });

  return (
    <div className="venn-canvas">
      <div className="venn-toolbar">
        <button type="button" className="btn-secondary" onClick={handleAddSet}>
          <Plus size={14} />
          <span>{vn.addSetBtn}</span>
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={vennData.sets.length < 2}
          onClick={handleAddUnion}
        >
          <Plus size={14} />
          <span>{vn.addUnionBtn}</span>
        </button>
      </div>

      <div className="venn-canvas-scroll">
        {vennData.title && (
          <div className="strategy-title-banner">{vennData.title}</div>
        )}

        {vennData.sets.length === 0 ? (
          <div className="strategy-empty-state">{vn.emptySets}</div>
        ) : (
          <>
            <div className="venn-visual-stage">
              <svg viewBox="0 0 480 280" className="venn-svg">
                {circles.map(({ setItem, cx, cy, r, fill, stroke }) => {
                  const isSelected = setItem.id === selectedSetId;
                  return (
                    <g
                      key={setItem.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        onSelectUnion(null);
                        onSelectSet(setItem.id);
                      }}
                    >
                      <circle
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill={fill}
                        fillOpacity={setItem.fillOpacity ?? 0.45}
                        stroke={isSelected ? '#1d4ed8' : stroke}
                        strokeWidth={isSelected ? 3 : 1.75}
                      />
                      <text
                        x={cx}
                        y={cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={setItem.textColor ?? '#0f172a'}
                        fontSize="12"
                        fontWeight="700"
                      >
                        {setItem.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="venn-cards-grid">
              {vennData.sets.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`venn-entity-card ${
                    s.id === selectedSetId ? 'is-selected' : ''
                  }`}
                  onClick={() => {
                    onSelectUnion(null);
                    onSelectSet(s.id);
                  }}
                >
                  <div className="venn-card-head">
                    <span>{s.label}</span>
                    <span className="treemap-tile-value">:{s.size}</span>
                  </div>
                  <div className="inspector-hint">set {s.id}</div>
                </button>
              ))}
              {vennData.unions.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className={`venn-entity-card ${
                    u.id === selectedUnionId ? 'is-selected' : ''
                  }`}
                  onClick={() => {
                    onSelectSet(null);
                    onSelectUnion(u.id);
                  }}
                >
                  <div className="venn-card-head">
                    <span>{u.label || u.sets.join(' ∩ ')}</span>
                    <span className="treemap-tile-value">:{u.size}</span>
                  </div>
                  <div className="inspector-hint">union {u.sets.join(', ')}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
