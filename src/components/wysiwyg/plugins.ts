import type { MutableRefObject } from 'react';
import { editorViewCtx } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import { BlockProvider } from '@milkdown/kit/plugin/block';
import {
  blockquoteSchema,
  listItemSchema,
  paragraphSchema,
} from '@milkdown/kit/preset/commonmark';
import { lift } from '@milkdown/kit/prose/commands';
import { liftListItem } from '@milkdown/kit/prose/schema-list';
import {
  type Command,
  NodeSelection,
  Plugin,
  PluginKey,
  TextSelection,
} from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { $prose, $shortcut } from '@milkdown/kit/utils';
import {
  canMoveBlockDown,
  canMoveBlockUp,
  detectSlashCommand,
  type BlockInsertItemId,
  type ResolvedBlockInsertItem,
} from '../../utils/wysiwygBlockActions';
import type { WysiwygEditorStrings, WysiwygMenuState } from './types';

const PLUS_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';

const GRIP_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>';

function resolveFallbackBlockPos(view: EditorView): number {
  const { doc, selection } = view.state;
  if (doc.childCount === 0) {
    return 0;
  }
  if (selection instanceof NodeSelection) {
    return selection.from;
  }
  const { $from } = selection;
  return $from.depth >= 1 ? $from.before(1) : 0;
}

/**
 * リスト項目や引用内の空の段落で Backspace を押したとき、1段階外側のコンテナへ抜ける Milkdown ショートカットを生成する。
 */
export function createExitEmptyContainerOnBackspacePlugin() {
  return $shortcut((ctx) => ({
    Backspace: {
      key: 'Backspace',
      // Milkdown 標準の listItemKeymap (既定 priority: 50) の joinBackward より先に判定させる
      priority: 100,
      onRun: (): Command => (state, dispatch) => {
        const { selection } = state;
        if (!(selection instanceof TextSelection) || !selection.empty) {
          return false;
        }

        const { $from } = selection;
        if ($from.depth < 2) {
          return false;
        }
        if ($from.parent.type !== paragraphSchema.type(ctx)) {
          return false;
        }
        if ($from.parent.content.size !== 0 || $from.parentOffset !== 0) {
          return false;
        }

        const parentNode = $from.node(-1);
        const itemType = listItemSchema.type(ctx);
        if (parentNode.type === itemType) {
          if (parentNode.childCount === 1) {
            return liftListItem(itemType)(state, dispatch);
          }
          if ($from.index(-1) > 0) {
            return lift(state, dispatch);
          }
          return false;
        }

        if (parentNode.type === blockquoteSchema.type(ctx)) {
          return lift(state, dispatch);
        }

        return false;
      },
    },
  }));
}

export interface SlashSyncDeps {
  mountEl: HTMLElement;
  menuStateRef: MutableRefObject<WysiwygMenuState | null>;
  menuActiveIndexRef: MutableRefObject<number>;
  dismissedSlashTextRef: MutableRefObject<string | null>;
  setMenuState: (next: WysiwygMenuState | null) => void;
  setMenuActiveIndex: (index: number) => void;
}

export function syncSlashMenuState(innerCtx: Ctx, deps: SlashSyncDeps): void {
  try {
    const view = innerCtx.get(editorViewCtx);
    const match = detectSlashCommand(view.state);
    if (!match) {
      deps.dismissedSlashTextRef.current = null;
      if (deps.menuStateRef.current?.kind === 'slash') {
        deps.menuStateRef.current = null;
        deps.setMenuState(null);
        deps.setMenuActiveIndex(0);
        deps.menuActiveIndexRef.current = 0;
      }
      return;
    }

    const rawText = `/${match.query}`;
    if (deps.dismissedSlashTextRef.current === rawText) {
      return;
    }

    let anchorTop = 0;
    let anchorLeft = 0;
    try {
      const coords = view.coordsAtPos(match.to);
      anchorTop = coords.bottom + 6;
      anchorLeft = coords.left;
    } catch {
      const fallbackRect = deps.mountEl.getBoundingClientRect();
      anchorTop = fallbackRect.top + 24;
      anchorLeft = fallbackRect.left + 52;
    }

    const prevMenu = deps.menuStateRef.current;
    if (!prevMenu || prevMenu.kind !== 'slash' || prevMenu.query !== match.query) {
      deps.menuActiveIndexRef.current = 0;
      deps.setMenuActiveIndex(0);
    }

    const nextMenu: WysiwygMenuState = {
      kind: 'slash',
      query: match.query,
      from: match.from,
      to: match.to,
      anchorTop,
      anchorLeft,
    };
    deps.menuStateRef.current = nextMenu;
    deps.setMenuState(nextMenu);
  } catch {
    // ビュー未初期化時は無視する
  }
}

export interface SlashKeymapDeps {
  menuStateRef: MutableRefObject<WysiwygMenuState | null>;
  menuActiveIndexRef: MutableRefObject<number>;
  filteredInsertItemsRef: MutableRefObject<ResolvedBlockInsertItem[]>;
  dismissedSlashTextRef: MutableRefObject<string | null>;
  setMenuActiveIndex: (index: number) => void;
  closeMenu: () => void;
  executeInsertItem: (itemId: BlockInsertItemId) => void;
}

export function createSlashKeymapPlugin(deps: SlashKeymapDeps) {
  return $prose(() => {
    return new Plugin({
      key: new PluginKey('WYSIWYG_SLASH_KEYMAP'),
      props: {
        handleKeyDown: (_view, event) => {
          const currentMenu = deps.menuStateRef.current;
          if (!currentMenu || currentMenu.kind !== 'slash') {
            return false;
          }

          const items = deps.filteredInsertItemsRef.current;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (items.length > 0) {
              const nextIdx = (deps.menuActiveIndexRef.current + 1) % items.length;
              deps.menuActiveIndexRef.current = nextIdx;
              deps.setMenuActiveIndex(nextIdx);
            }
            return true;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (items.length > 0) {
              const nextIdx =
                (deps.menuActiveIndexRef.current - 1 + items.length) % items.length;
              deps.menuActiveIndexRef.current = nextIdx;
              deps.setMenuActiveIndex(nextIdx);
            }
            return true;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            deps.dismissedSlashTextRef.current = `/${currentMenu.query}`;
            deps.closeMenu();
            return true;
          }
          if (event.key === 'Enter') {
            if (items.length > 0) {
              event.preventDefault();
              const safeIdx = Math.min(deps.menuActiveIndexRef.current, items.length - 1);
              deps.executeInsertItem(items[safeIdx].id);
              return true;
            }
            deps.closeMenu();
            return false;
          }
          return false;
        },
      },
    });
  });
}

export interface BlockHandleViewDeps {
  mountEl: HTMLElement;
  getStrings: () => WysiwygEditorStrings;
  blockProviderRef: MutableRefObject<BlockProvider | null>;
  blockPlusBtnRef: MutableRefObject<HTMLButtonElement | null>;
  blockDragBtnRef: MutableRefObject<HTMLButtonElement | null>;
  menuStateRef: MutableRefObject<WysiwygMenuState | null>;
  menuActiveIndexRef: MutableRefObject<number>;
  setMenuState: (next: WysiwygMenuState | null) => void;
  setMenuQuery: (next: string) => void;
  setMenuActiveIndex: (idx: number) => void;
  closeMenu: () => void;
}

export function createBlockHandleViewFactory(ctx: Ctx, deps: BlockHandleViewDeps) {
  const strings = deps.getStrings();
  const handleDom = document.createElement('div');
  handleDom.className = 'wysiwyg-block-handle';

  const plusBtn = document.createElement('button');
  plusBtn.type = 'button';
  plusBtn.draggable = false;
  plusBtn.className = 'wysiwyg-block-handle-btn wysiwyg-block-plus-btn';
  plusBtn.title = strings.blockAddTitle;
  plusBtn.setAttribute('aria-label', strings.blockAddTitle);
  plusBtn.innerHTML = PLUS_SVG;

  const dragBtn = document.createElement('button');
  dragBtn.type = 'button';
  dragBtn.className = 'wysiwyg-block-handle-btn wysiwyg-block-drag-btn';
  dragBtn.title = strings.blockDragTitle;
  dragBtn.setAttribute('aria-label', strings.blockDragTitle);
  dragBtn.innerHTML = GRIP_SVG;

  handleDom.append(plusBtn, dragBtn);
  deps.blockPlusBtnRef.current = plusBtn;
  deps.blockDragBtnRef.current = dragBtn;

  const provider = new BlockProvider({
    ctx,
    content: handleDom,
    root: deps.mountEl,
    getPlacement: () => 'left-start',
    getOffset: () => ({ mainAxis: 8, crossAxis: 0 }),
    getPosition: ({ active }) => {
      const rect = active.el.getBoundingClientRect();
      if (active.node.type.name === 'list_item') {
        return {
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left - 22,
          width: rect.width + 22,
          height: rect.height,
          x: (rect.x ?? rect.left) - 22,
          y: rect.y ?? rect.top,
        };
      }
      return rect;
    },
  });
  deps.blockProviderRef.current = provider;

  let didDrag = false;

  const onHandleDragStart = (): void => {
    didDrag = true;
    deps.closeMenu();
  };
  const onPlusMouseDown = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
  };
  const onPlusMouseUp = (event: MouseEvent): void => {
    event.stopPropagation();
  };
  const onPlusDragStart = (event: DragEvent): void => {
    event.preventDefault();
    event.stopPropagation();
  };
  const onPlusClick = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    const view = ctx.get(editorViewCtx);
    const blockPos = provider.active
      ? provider.active.$pos.pos
      : resolveFallbackBlockPos(view);

    if (
      deps.menuStateRef.current?.kind === 'insert' &&
      deps.menuStateRef.current.blockPos === blockPos
    ) {
      deps.closeMenu();
      return;
    }

    const rect = plusBtn.getBoundingClientRect();
    const nextMenu: WysiwygMenuState = {
      kind: 'insert',
      blockPos,
      anchorTop: rect.bottom + 4,
      anchorLeft: rect.left,
    };
    deps.menuStateRef.current = nextMenu;
    deps.setMenuQuery('');
    deps.menuActiveIndexRef.current = 0;
    deps.setMenuActiveIndex(0);
    deps.setMenuState(nextMenu);
  };
  const onDragMouseDown = (): void => {
    didDrag = false;
  };
  const onDragClick = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    if (didDrag) {
      didDrag = false;
      return;
    }

    const view = ctx.get(editorViewCtx);
    const blockPos = provider.active
      ? provider.active.$pos.pos
      : resolveFallbackBlockPos(view);

    if (
      deps.menuStateRef.current?.kind === 'actions' &&
      deps.menuStateRef.current.blockPos === blockPos
    ) {
      deps.closeMenu();
      return;
    }

    const rect = dragBtn.getBoundingClientRect();
    const nextMenu: WysiwygMenuState = {
      kind: 'actions',
      blockPos,
      canMoveUp: canMoveBlockUp(view.state.doc, blockPos),
      canMoveDown: canMoveBlockDown(view.state.doc, blockPos),
      anchorTop: rect.bottom + 4,
      anchorLeft: rect.left,
    };
    deps.menuStateRef.current = nextMenu;
    deps.setMenuState(nextMenu);
  };

  handleDom.addEventListener('dragstart', onHandleDragStart);
  plusBtn.addEventListener('mousedown', onPlusMouseDown);
  plusBtn.addEventListener('mouseup', onPlusMouseUp);
  plusBtn.addEventListener('dragstart', onPlusDragStart);
  plusBtn.addEventListener('click', onPlusClick);
  dragBtn.addEventListener('mousedown', onDragMouseDown);
  dragBtn.addEventListener('click', onDragClick);

  provider.update();

  return {
    update: () => {
      provider.update();
    },
    destroy: () => {
      handleDom.removeEventListener('dragstart', onHandleDragStart);
      plusBtn.removeEventListener('mousedown', onPlusMouseDown);
      plusBtn.removeEventListener('mouseup', onPlusMouseUp);
      plusBtn.removeEventListener('dragstart', onPlusDragStart);
      plusBtn.removeEventListener('click', onPlusClick);
      dragBtn.removeEventListener('mousedown', onDragMouseDown);
      dragBtn.removeEventListener('click', onDragClick);
      provider.destroy();
      if (deps.blockProviderRef.current === provider) {
        deps.blockProviderRef.current = null;
      }
      if (deps.blockPlusBtnRef.current === plusBtn) {
        deps.blockPlusBtnRef.current = null;
      }
      if (deps.blockDragBtnRef.current === dragBtn) {
        deps.blockDragBtnRef.current = null;
      }
    },
  };
}
