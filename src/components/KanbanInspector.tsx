import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
} from 'lucide-react';
import { useI18n } from '../i18n';
import GuardedInput from './GuardedInput';
import {
  FORBIDDEN_KANBAN_LABEL_CHARS_REGEX,
  FORBIDDEN_KANBAN_META_CHARS_REGEX,
  FORBIDDEN_URL_CHARS_REGEX,
} from '../utils/inputSafeguard';
import type {
  KanbanCardData,
  KanbanColumnData,
  KanbanDiagramData,
  KanbanPriority,
} from '../types/editor';

export interface KanbanInspectorProps {
  kanbanData: KanbanDiagramData;
  selectedCardId: string | null;
  onChange: (next: KanbanDiagramData) => void;
  onSelectCard: (cardId: string | null) => void;
}

type KanbanSectionKey = 'card' | 'columns' | 'settings' | 'comments';

const PRIORITY_OPTIONS: ReadonlyArray<KanbanPriority> = [
  'Very High',
  'High',
  'Medium',
  'Low',
  'Very Low',
];

interface KanbanAccordionProps {
  title: string;
  countBadge?: number;
  isOpen: boolean;
  onToggle: () => void;
  headerAction?: ReactNode;
  children: ReactNode;
}

function KanbanAccordion({
  title,
  countBadge,
  isOpen,
  onToggle,
  headerAction,
  children,
}: KanbanAccordionProps) {
  return (
    <section
      className={`inspector-section inspector-accordion ${isOpen ? 'is-open' : 'is-collapsed'}`}
    >
      <div className="inspector-section-header inspector-accordion-header">
        <button
          type="button"
          className="inspector-accordion-trigger"
          aria-expanded={isOpen}
          onClick={onToggle}
        >
          {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          <span className="inspector-accordion-title">{title}</span>
          {typeof countBadge === 'number' && (
            <span className="inspector-section-count">{countBadge}</span>
          )}
        </button>
        {headerAction && (
          <div className="inspector-accordion-actions">{headerAction}</div>
        )}
      </div>
      {isOpen && <div className="inspector-accordion-body">{children}</div>}
    </section>
  );
}

function nextUniqueId(prefix: string, usedIds: Set<string>): string {
  let num = 1;
  while (usedIds.has(`${prefix}_${num}`)) {
    num++;
  }
  return `${prefix}_${num}`;
}

export default function KanbanInspector({
  kanbanData,
  selectedCardId,
  onChange,
  onSelectCard,
}: KanbanInspectorProps) {
  const { t } = useI18n();
  const [openSections, setOpenSections] = useState<
    Record<KanbanSectionKey, boolean>
  >({
    card: true,
    columns: true,
    settings: false,
    comments: false,
  });

  useEffect(() => {
    if (selectedCardId) {
      setOpenSections((prev) => ({ ...prev, card: true }));
    }
  }, [selectedCardId]);

  const toggleSection = (key: KanbanSectionKey): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSections = (open: boolean): void => {
    setOpenSections({
      card: open,
      columns: open,
      settings: open,
      comments: open,
    });
  };

  const selectedCard =
    kanbanData.cards.find((c) => c.id === selectedCardId) ?? null;

  const updateCard = (
    cardId: string,
    patch: Partial<KanbanCardData>
  ): void => {
    onChange({
      ...kanbanData,
      cards: kanbanData.cards.map((card) =>
        card.id === cardId ? { ...card, ...patch } : card
      ),
    });
  };

  const handleAddCard = (): void => {
    const firstCol = kanbanData.columns[0];
    if (!firstCol) {
      return;
    }
    const usedIds = new Set([
      ...kanbanData.columns.map((c) => c.id),
      ...kanbanData.cards.map((c) => c.id),
    ]);
    const id = nextUniqueId('task', usedIds);
    const nextCard: KanbanCardData = {
      id,
      label: t.inspector.kanban.defaultCardLabel(kanbanData.cards.length + 1),
      columnId: selectedCard?.columnId ?? firstCol.id,
    };
    onChange({
      ...kanbanData,
      cards: [...kanbanData.cards, nextCard],
    });
    onSelectCard(id);
  };

  const handleDeleteCard = (cardId: string): void => {
    const remaining = kanbanData.cards.filter((c) => c.id !== cardId);
    onChange({
      ...kanbanData,
      cards: remaining,
    });
    if (selectedCardId === cardId) {
      onSelectCard(remaining[0]?.id ?? null);
    }
  };

  const handleAddColumn = (): void => {
    const usedIds = new Set([
      ...kanbanData.columns.map((c) => c.id),
      ...kanbanData.cards.map((c) => c.id),
    ]);
    const id = nextUniqueId('col', usedIds);
    const nextCol: KanbanColumnData = {
      id,
      title: t.inspector.kanban.defaultColumnTitle(kanbanData.columns.length + 1),
    };
    onChange({
      ...kanbanData,
      columns: [...kanbanData.columns, nextCol],
    });
  };

  const handleUpdateColumn = (
    colId: string,
    patch: Partial<KanbanColumnData>
  ): void => {
    onChange({
      ...kanbanData,
      columns: kanbanData.columns.map((col) =>
        col.id === colId ? { ...col, ...patch } : col
      ),
    });
  };

  const handleMoveColumn = (index: number, delta: -1 | 1): void => {
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= kanbanData.columns.length) {
      return;
    }
    const nextColumns = [...kanbanData.columns];
    const [moved] = nextColumns.splice(index, 1);
    nextColumns.splice(targetIndex, 0, moved);
    onChange({ ...kanbanData, columns: nextColumns });
  };

  const handleDeleteColumn = (colId: string): void => {
    const nextColumns = kanbanData.columns.filter((c) => c.id !== colId);
    const nextCards = kanbanData.cards.filter((c) => c.columnId !== colId);
    onChange({
      ...kanbanData,
      columns: nextColumns,
      cards: nextCards,
    });
    if (
      selectedCardId &&
      !nextCards.some((card) => card.id === selectedCardId)
    ) {
      onSelectCard(nextCards[0]?.id ?? null);
    }
  };

  return (
    <aside className="mermaid-inspector">
      <div className="inspector-accordion-toolbar">
        <button
          type="button"
          className="inspector-accordion-bulk-btn"
          onClick={() => setAllSections(true)}
        >
          {t.inspector.expandAllSections}
        </button>
        <button
          type="button"
          className="inspector-accordion-bulk-btn"
          onClick={() => setAllSections(false)}
        >
          {t.inspector.collapseAllSections}
        </button>
      </div>

      <KanbanAccordion
        title={t.inspector.kanban.cardHeading}
        countBadge={kanbanData.cards.length}
        isOpen={openSections.card}
        onToggle={() => toggleSection('card')}
        headerAction={
          <button
            type="button"
            className="btn-secondary btn-xs"
            disabled={kanbanData.columns.length === 0}
            onClick={handleAddCard}
          >
            <Plus size={14} />
            <span>{t.inspector.kanban.addCardBtn}</span>
          </button>
        }
      >
        {kanbanData.cards.length > 0 && (
          <div className="inspector-field">
            <label htmlFor="kanban-target-card-select">
              {t.inspector.kanban.targetCardField}
            </label>
            <select
              id="kanban-target-card-select"
              value={selectedCard?.id ?? ''}
              onChange={(event) => onSelectCard(event.target.value || null)}
            >
              {kanbanData.cards.map((card) => {
                const colTitle =
                  kanbanData.columns.find((c) => c.id === card.columnId)?.title ??
                  card.columnId;
                return (
                  <option key={card.id} value={card.id}>
                    [{colTitle}] {card.label}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {selectedCard ? (
          <div className="inspector-stack">
            <div className="inspector-field">
              <label>{t.inspector.kanban.cardLabelField}</label>
              <GuardedInput
                value={selectedCard.label}
                onChangeValue={(nextValue) =>
                  updateCard(selectedCard.id, { label: nextValue })
                }
                forbiddenRegex={FORBIDDEN_KANBAN_LABEL_CHARS_REGEX}
                formatError={t.inspector.safeguard.syntaxErrorChars}
                placeholder={t.inspector.kanban.cardLabelPlaceholder}
                ariaLabel={t.inspector.kanban.cardLabelField}
              />
            </div>

            <div className="inspector-field">
              <label htmlFor="kanban-card-column-select">
                {t.inspector.kanban.cardColumnField}
              </label>
              <select
                id="kanban-card-column-select"
                value={selectedCard.columnId}
                onChange={(event) =>
                  updateCard(selectedCard.id, { columnId: event.target.value })
                }
              >
                {kanbanData.columns.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="inspector-field">
              <label>{t.inspector.kanban.cardAssignedField}</label>
              <GuardedInput
                value={selectedCard.assigned ?? ''}
                onChangeValue={(nextValue) =>
                  updateCard(selectedCard.id, {
                    assigned: nextValue || undefined,
                  })
                }
                forbiddenRegex={FORBIDDEN_KANBAN_META_CHARS_REGEX}
                formatError={t.inspector.safeguard.kanbanMetaErrorChars}
                placeholder={t.inspector.kanban.cardAssignedPlaceholder}
                ariaLabel={t.inspector.kanban.cardAssignedField}
              />
            </div>

            <div className="inspector-field">
              <label>{t.inspector.kanban.cardTicketField}</label>
              <GuardedInput
                value={selectedCard.ticket ?? ''}
                onChangeValue={(nextValue) =>
                  updateCard(selectedCard.id, {
                    ticket: nextValue || undefined,
                  })
                }
                forbiddenRegex={FORBIDDEN_KANBAN_META_CHARS_REGEX}
                formatError={t.inspector.safeguard.kanbanMetaErrorChars}
                placeholder={t.inspector.kanban.cardTicketPlaceholder}
                ariaLabel={t.inspector.kanban.cardTicketField}
              />
            </div>

            <div className="inspector-field">
              <label htmlFor="kanban-card-priority-select">
                {t.inspector.kanban.cardPriorityField}
              </label>
              <select
                id="kanban-card-priority-select"
                value={selectedCard.priority ?? ''}
                onChange={(event) =>
                  updateCard(selectedCard.id, {
                    priority: (event.target.value || undefined) as
                      | KanbanPriority
                      | undefined,
                  })
                }
              >
                <option value="">{t.inspector.kanban.priorityNone}</option>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {t.inspector.kanban.priorities[p]}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="btn-danger btn-full"
              onClick={() => handleDeleteCard(selectedCard.id)}
            >
              <Trash2 size={14} />
              <span>{t.inspector.kanban.deleteCardBtn}</span>
            </button>
          </div>
        ) : (
          <p className="inspector-hint">{t.inspector.kanban.selectCardHint}</p>
        )}
      </KanbanAccordion>

      <KanbanAccordion
        title={t.inspector.kanban.columnsHeading}
        countBadge={kanbanData.columns.length}
        isOpen={openSections.columns}
        onToggle={() => toggleSection('columns')}
        headerAction={
          <button
            type="button"
            className="btn-secondary btn-xs"
            onClick={handleAddColumn}
          >
            <Plus size={14} />
            <span>{t.inspector.kanban.addColumnBtn}</span>
          </button>
        }
      >
        {kanbanData.columns.length === 0 ? (
          <p className="inspector-hint">{t.inspector.kanban.noColumnsHint}</p>
        ) : (
          <div className="edge-list">
            {kanbanData.columns.map((col, idx) => (
              <div key={col.id} className="edge-item-card">
                <div className="edge-item-header">
                  <div className="kanban-column-input-wrap">
                    <GuardedInput
                      value={col.title}
                      onChangeValue={(nextTitle) =>
                        handleUpdateColumn(col.id, { title: nextTitle })
                      }
                      forbiddenRegex={FORBIDDEN_KANBAN_LABEL_CHARS_REGEX}
                      formatError={t.inspector.safeguard.syntaxErrorChars}
                      placeholder={t.inspector.kanban.columnTitlePlaceholder}
                      ariaLabel={t.inspector.kanban.columnTitlePlaceholder}
                    />
                  </div>
                  <div className="lane-item-actions">
                    <button
                      type="button"
                      className="icon-btn-tiny"
                      disabled={idx === 0}
                      title={t.inspector.kanban.moveUpTitle}
                      onClick={() => handleMoveColumn(idx, -1)}
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn-tiny"
                      disabled={idx === kanbanData.columns.length - 1}
                      title={t.inspector.kanban.moveDownTitle}
                      onClick={() => handleMoveColumn(idx, 1)}
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn-danger"
                      title={t.inspector.kanban.deleteColumnTitle}
                      onClick={() => handleDeleteColumn(col.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </KanbanAccordion>

      <KanbanAccordion
        title={t.inspector.kanban.settingsHeading}
        isOpen={openSections.settings}
        onToggle={() => toggleSection('settings')}
      >
        <div className="inspector-stack">
          <div className="inspector-field">
            <label>{t.inspector.kanban.ticketBaseUrlField}</label>
            <GuardedInput
              type="url"
              value={kanbanData.ticketBaseUrl ?? ''}
              onChangeValue={(nextValue) =>
                onChange({
                  ...kanbanData,
                  ticketBaseUrl: nextValue.trim() || undefined,
                })
              }
              forbiddenRegex={FORBIDDEN_URL_CHARS_REGEX}
              formatError={t.inspector.safeguard.urlErrorChars}
              placeholder={t.inspector.kanban.ticketBaseUrlPlaceholder}
              ariaLabel={t.inspector.kanban.ticketBaseUrlField}
            />
            <p className="inspector-hint">{t.inspector.kanban.ticketBaseUrlHint}</p>
          </div>

          <div className="inspector-field">
            <label htmlFor="kanban-section-width">
              {t.inspector.kanban.sectionWidthField}
            </label>
            <input
              id="kanban-section-width"
              type="number"
              min={120}
              max={480}
              step={10}
              value={kanbanData.sectionWidth ?? 220}
              onChange={(event) => {
                const raw = event.target.value.trim();
                if (!raw) {
                  onChange({ ...kanbanData, sectionWidth: undefined });
                  return;
                }
                const parsed = Number(raw);
                if (Number.isFinite(parsed)) {
                  onChange({
                    ...kanbanData,
                    sectionWidth: Math.min(480, Math.max(120, Math.round(parsed))),
                  });
                }
              }}
            />
          </div>
        </div>
      </KanbanAccordion>

      <KanbanAccordion
        title={t.inspector.commentsHeading}
        countBadge={kanbanData.comments?.length ?? 0}
        isOpen={openSections.comments}
        onToggle={() => toggleSection('comments')}
      >
        <div className="inspector-field">
          <label htmlFor="kanban-comments-textarea">
            {t.inspector.commentsField}
          </label>
          <textarea
            id="kanban-comments-textarea"
            className="inspector-textarea"
            rows={4}
            value={(kanbanData.comments ?? []).join('\n')}
            placeholder={t.inspector.commentsPlaceholder}
            onChange={(event) => {
              const nextComments = event.target.value
                .split(/\r?\n/)
                .map((line) => line.replace(/^\s*%%+\s?/, ''));
              const hasContent = nextComments.some((l) => l.trim().length > 0);
              onChange({
                ...kanbanData,
                comments: hasContent ? nextComments : undefined,
              });
            }}
          />
        </div>
      </KanbanAccordion>
    </aside>
  );
}
