import { Plus } from 'lucide-react';
import { useI18n } from '../i18n';
import { allocateUniqueId } from '../utils/mermaidEnvelope';
import type { SankeyDiagramData, SankeyLinkData } from '../types/editor';

export interface SankeyCanvasProps {
  sankeyData: SankeyDiagramData;
  selectedLinkId: string | null;
  onChange: (next: SankeyDiagramData) => void;
  onSelectLink: (linkId: string | null) => void;
}

const NODE_COLORS = [
  '#2563eb',
  '#0891b2',
  '#16a34a',
  '#d97706',
  '#7c3aed',
  '#db2777',
  '#0d9488',
];

interface PositionedNode {
  name: string;
  col: number;
  x: number;
  y: number;
  h: number;
  color: string;
}

function buildSankeyLayout(links: ReadonlyArray<SankeyLinkData>) {
  const names: string[] = [];
  const nameSet = new Set<string>();
  const totals = new Map<string, { inVal: number; outVal: number }>();

  const ensure = (n: string) => {
    if (!nameSet.has(n)) {
      nameSet.add(n);
      names.push(n);
      totals.set(n, { inVal: 0, outVal: 0 });
    }
  };

  for (const l of links) {
    ensure(l.source);
    ensure(l.target);
    totals.get(l.source)!.outVal += Math.max(0.1, l.value);
    totals.get(l.target)!.inVal += Math.max(0.1, l.value);
  }

  const colMap = new Map<string, number>();
  for (const n of names) colMap.set(n, 0);

  const maxDepth = Math.max(1, names.length);
  for (let pass = 0; pass < maxDepth; pass++) {
    let changed = false;
    for (const l of links) {
      if (l.source === l.target) continue;
      const sc = colMap.get(l.source) ?? 0;
      const tc = colMap.get(l.target) ?? 0;
      if (tc <= sc && sc + 1 < maxDepth) {
        colMap.set(l.target, sc + 1);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const maxCol = Math.max(1, ...Array.from(colMap.values()));
  const byCol = new Map<number, string[]>();
  for (const n of names) {
    const c = colMap.get(n) ?? 0;
    const arr = byCol.get(c) ?? [];
    arr.push(n);
    byCol.set(c, arr);
  }

  const width = 620;
  const height = 300;
  const padX = 80;
  const padY = 24;
  const nodeW = 14;
  const usableW = width - padX * 2 - nodeW;
  const usableH = height - padY * 2;

  const nodes = new Map<string, PositionedNode>();
  names.forEach((name, idx) => {
    const col = colMap.get(name) ?? 0;
    const colNodes = byCol.get(col) ?? [name];
    const rowIdx = colNodes.indexOf(name);
    const gap = 12;
    const availH = Math.max(40, usableH - gap * Math.max(0, colNodes.length - 1));
    const h = Math.max(20, Math.min(72, availH / colNodes.length));
    const totalColH = colNodes.length * h + Math.max(0, colNodes.length - 1) * gap;
    const startY = padY + (usableH - totalColH) / 2;
    const x = maxCol === 0 ? width / 2 : padX + (col / maxCol) * usableW;
    const y = startY + rowIdx * (h + gap);
    nodes.set(name, {
      name,
      col,
      x,
      y,
      h,
      color: NODE_COLORS[idx % NODE_COLORS.length],
    });
  });

  const maxFlow = Math.max(1, ...links.map((l) => l.value));
  return { width, height, nodeW, nodes, maxFlow };
}

export default function SankeyCanvas({
  sankeyData,
  selectedLinkId,
  onChange,
  onSelectLink,
}: SankeyCanvasProps) {
  const { t } = useI18n();
  const sk = t.inspector.sankey;
  const layout = buildSankeyLayout(sankeyData.links);

  const handleAddLink = (): void => {
    const usedIds = new Set(sankeyData.links.map((l) => l.id));
    const id = allocateUniqueId(`sk_${sankeyData.links.length + 1}`, usedIds);
    const num = sankeyData.links.length + 1;
    onChange({
      ...sankeyData,
      links: [
        ...sankeyData.links,
        {
          id,
          source: `${sk.defaultSourcePrefix}${num}`,
          target: `${sk.defaultTargetPrefix}${num}`,
          value: 15,
        },
      ],
    });
    onSelectLink(id);
  };

  return (
    <div className="sankey-canvas">
      <div className="systems-toolbar">
        <button
          type="button"
          className="btn-primary btn-xs"
          onClick={handleAddLink}
        >
          <Plus size={13} />
          <span>{sk.addLinkBtn}</span>
        </button>
      </div>

      <div className="systems-canvas-scroll">
        {sankeyData.title && (
          <div className="systems-title-banner">{sankeyData.title}</div>
        )}

        {sankeyData.links.length === 0 ? (
          <div className="systems-empty-state">{sk.emptyLinks}</div>
        ) : (
          <>
            <div className="systems-svg-board">
              <svg
                className="sankey-svg"
                viewBox={`0 0 ${layout.width} ${layout.height}`}
              >
                {sankeyData.links.map((link) => {
                  const src = layout.nodes.get(link.source);
                  const tgt = layout.nodes.get(link.target);
                  if (!src || !tgt) return null;
                  const x1 = src.x + layout.nodeW;
                  const y1 = src.y + src.h / 2;
                  const x2 = tgt.x;
                  const y2 = tgt.y + tgt.h / 2;
                  const cx = (x1 + x2) / 2;
                  const sw = 4 + (link.value / layout.maxFlow) * 18;
                  const isSel = selectedLinkId === link.id;
                  return (
                    <path
                      key={link.id}
                      d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
                      fill="none"
                      stroke={isSel ? 'var(--accent-color, #2563eb)' : src.color}
                      strokeOpacity={isSel ? 0.85 : 0.35}
                      strokeWidth={sw}
                      style={{ cursor: 'pointer' }}
                      onClick={() => onSelectLink(link.id)}
                    />
                  );
                })}

                {Array.from(layout.nodes.values()).map((node) => (
                  <g key={node.name}>
                    <rect
                      x={node.x}
                      y={node.y}
                      width={layout.nodeW}
                      height={node.h}
                      rx={3}
                      fill={node.color}
                    />
                    <text
                      x={node.col === 0 ? node.x - 6 : node.x + layout.nodeW + 6}
                      y={node.y + node.h / 2}
                      textAnchor={node.col === 0 ? 'end' : 'start'}
                      dominantBaseline="central"
                      fontSize={11}
                      fontWeight={600}
                      fill="currentColor"
                    >
                      {node.name}
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            <div className="sankey-links-list">
              {sankeyData.links.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  className={`sankey-link-pill ${
                    selectedLinkId === link.id ? 'is-selected' : ''
                  }`}
                  onClick={() => onSelectLink(link.id)}
                >
                  <span>
                    {link.source} → {link.target}
                  </span>
                  <strong>{link.value}</strong>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
