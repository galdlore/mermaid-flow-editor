import type { CSSProperties, KeyboardEvent, MutableRefObject, ReactNode, RefObject } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckSquare,
  Code,
  Copy,
  GitBranch,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Minus,
  Quote,
  Table,
  Trash2,
} from 'lucide-react';
import { useI18n } from '../../i18n';
import type {
  BlockInsertItemId,
  ResolvedBlockInsertItem,
} from '../../utils/wysiwygBlockActions';
import type { WysiwygBlockAction, WysiwygMenuState } from './types';

const BLOCK_ITEM_ICON_MAP: Record<BlockInsertItemId, ReactNode> = {
  heading1: <Heading1 size={15} />,
  heading2: <Heading2 size={15} />,
  heading3: <Heading3 size={15} />,
  bulletList: <List size={15} />,
  orderedList: <ListOrdered size={15} />,
  taskList: <CheckSquare size={15} />,
  table: <Table size={15} />,
  mermaid: <GitBranch size={15} />,
  codeBlock: <Code size={15} />,
  blockquote: <Quote size={15} />,
  divider: <Minus size={15} />,
};

function getClampedMenuStyle(
  anchorTop: number,
  anchorLeft: number,
  menuWidth: number,
  estimatedHeight: number
): CSSProperties {
  if (typeof window === 'undefined') {
    return { top: anchorTop, left: anchorLeft };
  }
  const padding = 8;
  const maxLeft = Math.max(padding, window.innerWidth - menuWidth - padding);
  const left = Math.min(Math.max(padding, anchorLeft), maxLeft);
  const maxTop = Math.max(padding, window.innerHeight - estimatedHeight - padding);
  const top = Math.min(Math.max(padding, anchorTop), maxTop);
  return { top, left };
}

export interface WysiwygBlockMenusProps {
  menuState: WysiwygMenuState | null;
  menuQuery: string;
  menuActiveIndex: number;
  filteredInsertItems: ResolvedBlockInsertItem[];
  menuContainerRef: RefObject<HTMLDivElement>;
  searchInputRef: RefObject<HTMLInputElement>;
  menuActiveIndexRef: MutableRefObject<number>;
  onChangeMenuQuery: (next: string) => void;
  onChangeMenuActiveIndex: (idx: number) => void;
  onExecuteInsertItem: (id: BlockInsertItemId) => void;
  onExecuteBlockAction: (action: WysiwygBlockAction) => void;
  onCloseAndFocusEditor: () => void;
}

export default function WysiwygBlockMenus({
  menuState,
  menuQuery,
  menuActiveIndex,
  filteredInsertItems,
  menuContainerRef,
  searchInputRef,
  menuActiveIndexRef,
  onChangeMenuQuery,
  onChangeMenuActiveIndex,
  onExecuteInsertItem,
  onExecuteBlockAction,
  onCloseAndFocusEditor,
}: WysiwygBlockMenusProps) {
  const { t } = useI18n();

  if (!menuState) {
    return null;
  }

  const safeActiveIndex =
    filteredInsertItems.length > 0
      ? Math.min(menuActiveIndex, filteredInsertItems.length - 1)
      : 0;

  const handleSearchInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (filteredInsertItems.length > 0) {
        const nextIdx = (safeActiveIndex + 1) % filteredInsertItems.length;
        menuActiveIndexRef.current = nextIdx;
        onChangeMenuActiveIndex(nextIdx);
      }
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (filteredInsertItems.length > 0) {
        const nextIdx =
          (safeActiveIndex - 1 + filteredInsertItems.length) %
          filteredInsertItems.length;
        menuActiveIndexRef.current = nextIdx;
        onChangeMenuActiveIndex(nextIdx);
      }
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const selected = filteredInsertItems[safeActiveIndex];
      if (selected) {
        onExecuteInsertItem(selected.id);
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onCloseAndFocusEditor();
    }
  };

  if (menuState.kind === 'insert' || menuState.kind === 'slash') {
    return (
      <div
        ref={menuContainerRef}
        className="wysiwyg-block-menu"
        role="menu"
        style={getClampedMenuStyle(menuState.anchorTop, menuState.anchorLeft, 248, 360)}
      >
        {menuState.kind === 'insert' && (
          <input
            ref={searchInputRef}
            type="text"
            className="wysiwyg-block-menu-search"
            value={menuQuery}
            placeholder={t.editor.blockMenuSearchPlaceholder}
            onChange={(event) => {
              onChangeMenuQuery(event.target.value);
              menuActiveIndexRef.current = 0;
              onChangeMenuActiveIndex(0);
            }}
            onKeyDown={handleSearchInputKeyDown}
          />
        )}
        <div className="wysiwyg-block-menu-list">
          {filteredInsertItems.length === 0 ? (
            <div className="wysiwyg-block-menu-empty">{t.editor.blockMenuNoMatch}</div>
          ) : (
            filteredInsertItems.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={`wysiwyg-block-menu-item ${
                  idx === safeActiveIndex ? 'is-active' : ''
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => {
                  menuActiveIndexRef.current = idx;
                  onChangeMenuActiveIndex(idx);
                }}
                onClick={() => onExecuteInsertItem(item.id)}
              >
                <span className="wysiwyg-block-menu-item-icon">
                  {BLOCK_ITEM_ICON_MAP[item.id]}
                </span>
                <span className="wysiwyg-block-menu-item-label">{item.label}</span>
                <span className="wysiwyg-block-menu-item-hint">{item.shortcutHint}</span>
              </button>
            ))
          )}
        </div>
        {menuState.kind === 'insert' && (
          <div className="wysiwyg-block-menu-footer">{t.editor.blockMenuSlashHint}</div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={menuContainerRef}
      className="wysiwyg-block-menu wysiwyg-block-actions-menu"
      role="menu"
      style={getClampedMenuStyle(menuState.anchorTop, menuState.anchorLeft, 196, 168)}
    >
      <div className="wysiwyg-block-menu-list">
        <button
          type="button"
          role="menuitem"
          className="wysiwyg-block-menu-item"
          disabled={!menuState.canMoveUp}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onExecuteBlockAction('moveUp')}
        >
          <span className="wysiwyg-block-menu-item-icon">
            <ArrowUp size={15} />
          </span>
          <span className="wysiwyg-block-menu-item-label">
            {t.editor.blockActionMoveUp}
          </span>
        </button>
        <button
          type="button"
          role="menuitem"
          className="wysiwyg-block-menu-item"
          disabled={!menuState.canMoveDown}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onExecuteBlockAction('moveDown')}
        >
          <span className="wysiwyg-block-menu-item-icon">
            <ArrowDown size={15} />
          </span>
          <span className="wysiwyg-block-menu-item-label">
            {t.editor.blockActionMoveDown}
          </span>
        </button>
        <button
          type="button"
          role="menuitem"
          className="wysiwyg-block-menu-item"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onExecuteBlockAction('duplicate')}
        >
          <span className="wysiwyg-block-menu-item-icon">
            <Copy size={15} />
          </span>
          <span className="wysiwyg-block-menu-item-label">
            {t.editor.blockActionDuplicate}
          </span>
        </button>
        <button
          type="button"
          role="menuitem"
          className="wysiwyg-block-menu-item is-danger"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onExecuteBlockAction('delete')}
        >
          <span className="wysiwyg-block-menu-item-icon">
            <Trash2 size={15} />
          </span>
          <span className="wysiwyg-block-menu-item-label">
            {t.editor.blockActionDelete}
          </span>
        </button>
      </div>
    </div>
  );
}
