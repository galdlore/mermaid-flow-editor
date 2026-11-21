import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import type { CynefinDiagramData, CynefinDomainName } from '../types/editor';
import { allocateUniqueId } from '../utils/mermaidEnvelope';

export interface CynefinCanvasProps {
  cynefinData: CynefinDiagramData;
  selectedItemId: string | null;
  onChange: (next: CynefinDiagramData) => void;
  onSelectItem: (itemId: string | null) => void;
}

const BOARD_DOMAIN_ORDER: ReadonlyArray<CynefinDomainName> = [
  'complex',
  'complicated',
  'chaotic',
  'clear',
  'confusion',
];

export default function CynefinCanvas({
  cynefinData,
  selectedItemId,
  onChange,
  onSelectItem,
}: CynefinCanvasProps) {
  const { t } = useI18n();
  const cyn = t.inspector.cynefin;

  const selectedIndex = cynefinData.items.findIndex(
    (item) => item.id === selectedItemId
  );
  const selectedItem =
    selectedIndex >= 0 ? cynefinData.items[selectedIndex] : null;

  const handleAddItem = (domain?: CynefinDomainName): void => {
    const usedIds = new Set(cynefinData.items.map((item) => item.id));
    const id = allocateUniqueId(`cyn_${cynefinData.items.length + 1}`, usedIds);
    const targetDomain = domain ?? selectedItem?.domain ?? 'complex';
    onChange({
      ...cynefinData,
      items: [
        ...cynefinData.items,
        {
          id,
          domain: targetDomain,
          label: cyn.defaultItemLabel(cynefinData.items.length + 1),
        },
      ],
    });
    onSelectItem(id);
  };

  const handleMove = (delta: -1 | 1): void => {
    if (selectedIndex < 0) return;
    const nextIdx = selectedIndex + delta;
    if (nextIdx < 0 || nextIdx >= cynefinData.items.length) return;
    const next = [...cynefinData.items];
    const [moved] = next.splice(selectedIndex, 1);
    next.splice(nextIdx, 0, moved);
    onChange({ ...cynefinData, items: next });
  };

  const handleDeleteSelected = (): void => {
    if (!selectedItem) return;
    const next = cynefinData.items.filter((item) => item.id !== selectedItem.id);
    onChange({ ...cynefinData, items: next });
    onSelectItem(next[0]?.id ?? null);
  };

  return (
    <div className="cynefin-canvas">
      <div className="cynefin-toolbar">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => handleAddItem()}
        >
          <Plus size={14} />
          <span>{cyn.addItemBtn}</span>
        </button>
        <button
          type="button"
          className="btn-icon-subtle"
          title={cyn.moveUpTitle}
          disabled={selectedIndex <= 0}
          onClick={() => handleMove(-1)}
        >
          <ArrowUp size={14} />
        </button>
        <button
          type="button"
          className="btn-icon-subtle"
          title={cyn.moveDownTitle}
          disabled={
            selectedIndex < 0 || selectedIndex >= cynefinData.items.length - 1
          }
          onClick={() => handleMove(1)}
        >
          <ArrowDown size={14} />
        </button>
        <button
          type="button"
          className="btn-icon-subtle is-danger"
          title={cyn.deleteItemBtn}
          disabled={!selectedItem}
          onClick={handleDeleteSelected}
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="cynefin-canvas-scroll">
        {cynefinData.title && (
          <div className="strategy-title-banner">{cynefinData.title}</div>
        )}

        <div className="cynefin-grid-board">
          {BOARD_DOMAIN_ORDER.map((domain) => {
            const domainMeta = cyn.domains[domain];
            const domainItems = cynefinData.items.filter(
              (item) => item.domain === domain
            );
            return (
              <div
                key={domain}
                className="cynefin-domain-box"
                data-domain={domain}
              >
                <div className="cynefin-domain-head">
                  <div>
                    <div className="cynefin-domain-title">{domainMeta.title}</div>
                    <div className="cynefin-domain-sub">{domainMeta.subtitle}</div>
                  </div>
                  <button
                    type="button"
                    className="btn-icon-subtle"
                    title={cyn.addItemBtn}
                    onClick={() => handleAddItem(domain)}
                  >
                    <Plus size={12} />
                  </button>
                </div>

                {domainItems.length === 0 ? (
                  <p className="inspector-hint">{cyn.emptyDomainItems}</p>
                ) : (
                  <div className="cynefin-items-wrap">
                    {domainItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`cynefin-item-pill ${
                          item.id === selectedItemId ? 'is-selected' : ''
                        }`}
                        onClick={() => onSelectItem(item.id)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {cynefinData.transitions.length > 0 && (
          <div className="cynefin-transitions-bar">
            {cynefinData.transitions.map((tr) => (
              <span key={tr.id} className="cynefin-transition-chip">
                {tr.from} → {tr.to}
                {tr.label ? ` : ${tr.label}` : ''}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
