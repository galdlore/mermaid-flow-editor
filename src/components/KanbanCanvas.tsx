import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Plus,
  Tag,
  User,
} from 'lucide-react';
import { useI18n } from '../i18n';
import type {
  KanbanCardData,
  KanbanColumnData,
  KanbanDiagramData,
  KanbanPriority,
} from '../types/editor';

export interface KanbanCanvasProps {
  kanbanData: KanbanDiagramData;
  selectedCardId: string | null;
  onChange: (next: KanbanDiagramData) => void;
  onSelectCard: (cardId: string | null) => void;
}

const PRIORITY_COLOR_MAP: Record<KanbanPriority, string> = {
  'Very High': '#ef4444',
  High: '#f97316',
  Medium: '#64748b',
  Low: '#3b82f6',
  'Very Low': '#38bdf8',
};

function generateNextId(prefix: string, existingIds: Set<string>): string {
  let num = 1;
  while (existingIds.has(`${prefix}_${num}`)) {
    num++;
  }
  return `${prefix}_${num}`;
}

export default function KanbanCanvas({
  kanbanData,
  selectedCardId,
  onChange,
  onSelectCard,
}: KanbanCanvasProps) {
  const { t } = useI18n();

  const handleAddColumn = (): void => {
    const existingIds = new Set([
      ...kanbanData.columns.map((c) => c.id),
      ...kanbanData.cards.map((c) => c.id),
    ]);
    const id = generateNextId('col', existingIds);
    const nextCol: KanbanColumnData = {
      id,
      title: t.inspector.kanban.defaultColumnTitle(kanbanData.columns.length + 1),
    };
    onChange({
      ...kanbanData,
      columns: [...kanbanData.columns, nextCol],
    });
  };

  const handleAddCard = (columnId: string): void => {
    const existingIds = new Set([
      ...kanbanData.columns.map((c) => c.id),
      ...kanbanData.cards.map((c) => c.id),
    ]);
    const id = generateNextId('task', existingIds);
    const newCard: KanbanCardData = {
      id,
      label: t.inspector.kanban.defaultCardLabel(kanbanData.cards.length + 1),
      columnId,
    };
    onChange({
      ...kanbanData,
      cards: [...kanbanData.cards, newCard],
    });
    onSelectCard(id);
  };

  const handleMoveColumn = (colIndex: number, delta: -1 | 1): void => {
    const targetIndex = colIndex + delta;
    if (targetIndex < 0 || targetIndex >= kanbanData.columns.length) {
      return;
    }
    const nextCols = [...kanbanData.columns];
    const [moved] = nextCols.splice(colIndex, 1);
    nextCols.splice(targetIndex, 0, moved);
    onChange({ ...kanbanData, columns: nextCols });
  };

  const handleMoveCardVertical = (cardId: string, delta: -1 | 1): void => {
    const targetCard = kanbanData.cards.find((c) => c.id === cardId);
    if (!targetCard) {
      return;
    }
    const sameColumnCards = kanbanData.cards.filter(
      (c) => c.columnId === targetCard.columnId
    );
    const indexInCol = sameColumnCards.findIndex((c) => c.id === cardId);
    const swapIndexInCol = indexInCol + delta;
    if (
      indexInCol === -1 ||
      swapIndexInCol < 0 ||
      swapIndexInCol >= sameColumnCards.length
    ) {
      return;
    }

    const neighborId = sameColumnCards[swapIndexInCol].id;
    const globalA = kanbanData.cards.findIndex((c) => c.id === cardId);
    const globalB = kanbanData.cards.findIndex((c) => c.id === neighborId);
    if (globalA === -1 || globalB === -1) {
      return;
    }

    const nextCards = [...kanbanData.cards];
    const tmp = nextCards[globalA];
    nextCards[globalA] = nextCards[globalB];
    nextCards[globalB] = tmp;
    onChange({ ...kanbanData, cards: nextCards });
  };

  const handleMoveCardColumn = (cardId: string, delta: -1 | 1): void => {
    const card = kanbanData.cards.find((c) => c.id === cardId);
    if (!card) {
      return;
    }
    const currentColIdx = kanbanData.columns.findIndex(
      (c) => c.id === card.columnId
    );
    const nextColIdx = currentColIdx + delta;
    if (
      currentColIdx === -1 ||
      nextColIdx < 0 ||
      nextColIdx >= kanbanData.columns.length
    ) {
      return;
    }
    const targetColumnId = kanbanData.columns[nextColIdx].id;
    onChange({
      ...kanbanData,
      cards: kanbanData.cards.map((item) =>
        item.id === cardId ? { ...item, columnId: targetColumnId } : item
      ),
    });
  };

  const defaultAddColumnId = kanbanData.columns[0]?.id;

  return (
    <div className="kanban-canvas-container">
      <div className="kanban-canvas-toolbar">
        <button
          type="button"
          className="btn-secondary btn-xs"
          onClick={handleAddColumn}
        >
          <Plus size={14} />
          <span>{t.inspector.kanban.addColumnBtn}</span>
        </button>
        {defaultAddColumnId && (
          <button
            type="button"
            className="btn-secondary btn-xs"
            onClick={() => handleAddCard(defaultAddColumnId)}
          >
            <Plus size={14} />
            <span>{t.inspector.kanban.addCardBtn}</span>
          </button>
        )}
      </div>

      {kanbanData.columns.length === 0 ? (
        <div className="kanban-canvas-empty">{t.inspector.kanban.noColumnsHint}</div>
      ) : (
        <div className="kanban-board-scroll">
          <div className="kanban-board">
            {kanbanData.columns.map((column, colIndex) => {
              const columnCards = kanbanData.cards.filter(
                (card) => card.columnId === column.id
              );

              return (
                <section key={column.id} className="kanban-column">
                  <header className="kanban-column-header">
                    <div className="kanban-column-title-row">
                      <span className="kanban-column-title" title={column.title}>
                        {column.title}
                      </span>
                      <span className="kanban-column-count">
                        {columnCards.length}
                      </span>
                    </div>
                    <div className="kanban-column-actions">
                      <button
                        type="button"
                        className="icon-btn-tiny"
                        disabled={colIndex === 0}
                        title={t.inspector.kanban.moveColumnLeftTitle}
                        onClick={() => handleMoveColumn(colIndex, -1)}
                      >
                        <ArrowLeft size={12} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn-tiny"
                        disabled={colIndex === kanbanData.columns.length - 1}
                        title={t.inspector.kanban.moveColumnRightTitle}
                        onClick={() => handleMoveColumn(colIndex, 1)}
                      >
                        <ArrowRight size={12} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn-tiny"
                        title={t.inspector.kanban.addCardToColumnTitle}
                        onClick={() => handleAddCard(column.id)}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </header>

                  <div className="kanban-column-cards">
                    {columnCards.length === 0 ? (
                      <div className="kanban-column-empty">
                        {t.inspector.kanban.emptyColumnHint}
                      </div>
                    ) : (
                      columnCards.map((card, cardIdx) => {
                        const isSelected = card.id === selectedCardId;
                        const priorityColor = card.priority
                          ? PRIORITY_COLOR_MAP[card.priority]
                          : undefined;

                        return (
                          <div
                            key={card.id}
                            role="button"
                            tabIndex={0}
                            className={`kanban-card ${isSelected ? 'is-selected' : ''}`}
                            style={
                              priorityColor
                                ? { borderLeft: `4px solid ${priorityColor}` }
                                : undefined
                            }
                            onClick={() => onSelectCard(card.id)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                onSelectCard(card.id);
                              }
                            }}
                          >
                            <div className="kanban-card-title">{card.label}</div>

                            {(card.ticket || card.assigned || card.priority) && (
                              <div className="kanban-card-meta">
                                {card.ticket && (
                                  <span className="kanban-card-badge kanban-card-badge-ticket">
                                    <Tag size={11} />
                                    <span>{card.ticket}</span>
                                  </span>
                                )}
                                {card.assigned && (
                                  <span className="kanban-card-badge kanban-card-badge-assigned">
                                    <User size={11} />
                                    <span>{card.assigned}</span>
                                  </span>
                                )}
                                {card.priority && (
                                  <span
                                    className="kanban-card-badge kanban-card-badge-priority"
                                    style={
                                      priorityColor
                                        ? {
                                            borderColor: priorityColor,
                                            color: priorityColor,
                                          }
                                        : undefined
                                    }
                                  >
                                    {card.priority}
                                  </span>
                                )}
                              </div>
                            )}

                            <div
                              className="kanban-card-controls"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="icon-btn-tiny"
                                disabled={colIndex === 0}
                                title={t.inspector.kanban.moveCardLeftTitle}
                                onClick={() => handleMoveCardColumn(card.id, -1)}
                              >
                                <ArrowLeft size={12} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn-tiny"
                                disabled={cardIdx === 0}
                                title={t.inspector.kanban.moveUpTitle}
                                onClick={() => handleMoveCardVertical(card.id, -1)}
                              >
                                <ArrowUp size={12} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn-tiny"
                                disabled={cardIdx === columnCards.length - 1}
                                title={t.inspector.kanban.moveDownTitle}
                                onClick={() => handleMoveCardVertical(card.id, 1)}
                              >
                                <ArrowDown size={12} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn-tiny"
                                disabled={
                                  colIndex === kanbanData.columns.length - 1
                                }
                                title={t.inspector.kanban.moveCardRightTitle}
                                onClick={() => handleMoveCardColumn(card.id, 1)}
                              >
                                <ArrowRight size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
