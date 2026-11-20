import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
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
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  rootCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import {
  blockquoteSchema,
  codeBlockSchema,
  commonmark,
  createCodeBlockCommand,
  headingSchema,
  linkSchema,
  listItemSchema,
  paragraphSchema,
  toggleEmphasisCommand,
  toggleLinkCommand,
  toggleStrongCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
} from '@milkdown/kit/preset/commonmark';
import {
  gfm,
  insertTableCommand,
  toggleStrikethroughCommand,
} from '@milkdown/kit/preset/gfm';
import { block, BlockProvider } from '@milkdown/kit/plugin/block';
import { cursor, dropIndicatorConfig } from '@milkdown/kit/plugin/cursor';
import { history } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { lift, setBlockType } from '@milkdown/kit/prose/commands';
import { type Node as ProseNode } from '@milkdown/kit/prose/model';
import { liftListItem } from '@milkdown/kit/prose/schema-list';
import {
  type Command,
  NodeSelection,
  Plugin,
  PluginKey,
  TextSelection,
} from '@milkdown/kit/prose/state';
import {
  addColumnAfter,
  addRowAfter,
  deleteColumn,
  deleteRow,
  isInTable,
} from '@milkdown/kit/prose/tables';
import { type EditorView, type NodeView } from '@milkdown/kit/prose/view';
import { $prose, $shortcut, $view, callCommand, replaceAll } from '@milkdown/kit/utils';
import { useI18n } from '../i18n';
import { renderMermaidSvg } from '../utils/mermaidRender';
import {
  BLOCK_INSERT_ITEM_DEFS,
  type BlockInsertItemId,
  type BlockInsertTarget,
  type ResolvedBlockInsertItem,
  canMoveBlockDown,
  canMoveBlockUp,
  deleteBlock,
  detectSlashCommand,
  duplicateBlock,
  filterBlockInsertItems,
  insertBlockFromMenu,
  moveBlockDown,
  moveBlockUp,
} from '../utils/wysiwygBlockActions';

export interface WysiwygEditorHandle {
  focus: () => void;
  applyHeading: (level: 1 | 2 | 3) => void;
  applyBold: () => void;
  applyItalic: () => void;
  applyStrike: () => void;
  applyLink: (placeholder: string) => void;
  getSelectedText: () => string;
  insertLink: (label: string, href: string) => void;
  applyBulletList: () => void;
  applyOrderedList: () => void;
  applyTaskList: () => void;
  applyQuote: () => void;
  applyCodeBlock: () => void;
  insertTable: (rows: number, cols: number) => void;
  insertMermaidBlock: (code: string) => void;
  insertText: (text: string) => void;
}

export interface WysiwygEditorProps {
  value: string;
  onChange: (nextMarkdown: string) => void;
  onEditMermaid: (blockIndex: number, code: string) => void;
  onOpenNewMermaid?: () => void;
  onOpenMarkdownLink?: (href: string) => void;
}

const PENCIL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>';

const PLUS_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';

const GRIP_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>';

const MERMAID_PASSTHROUGH_EVENTS = new Set([
  'pointermove',
  'dragstart',
  'dragover',
  'dragenter',
  'dragleave',
  'drop',
  'dragend',
]);

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

type WysiwygMenuState =
  | { kind: 'insert'; blockPos: number; anchorTop: number; anchorLeft: number }
  | {
      kind: 'slash';
      query: string;
      from: number;
      to: number;
      anchorTop: number;
      anchorLeft: number;
    }
  | {
      kind: 'actions';
      blockPos: number;
      canMoveUp: boolean;
      canMoveDown: boolean;
      anchorTop: number;
      anchorLeft: number;
    };

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

function isMermaidCodeBlock(node: ProseNode): boolean {
  return String(node.attrs.language ?? '').trim().toLowerCase() === 'mermaid';
}

function countMermaidBlocksBeforePos(doc: ProseNode, targetPos: number): number {
  let count = 0;
  doc.descendants((node, pos) => {
    if (pos >= targetPos) {
      return false;
    }
    if (node.type.name === 'code_block' && isMermaidCodeBlock(node)) {
      count += 1;
    }
    return true;
  });
  return count;
}

function createErrorElement(title: string, message: string): HTMLElement {
  const box = document.createElement('div');
  box.className = 'mermaid-error-box';
  const strong = document.createElement('strong');
  strong.textContent = title;
  const pre = document.createElement('pre');
  pre.textContent = message;
  box.append(strong, pre);
  return box;
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

const WysiwygEditor = forwardRef<WysiwygEditorHandle, WysiwygEditorProps>(
  function WysiwygEditor(
    { value, onChange, onEditMermaid, onOpenNewMermaid, onOpenMarkdownLink },
    ref
  ) {
    const { t } = useI18n();
    const mountRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<Editor | null>(null);
    const readyRef = useRef(false);
    const initialValueRef = useRef(value);
    const lastEmittedRef = useRef(value);
    const suppressedDocRef = useRef<ProseNode | null>(null);
    const [isCursorInTable, setIsCursorInTable] = useState(false);

    const [menuState, setMenuState] = useState<WysiwygMenuState | null>(null);
    const [menuQuery, setMenuQuery] = useState('');
    const [menuActiveIndex, setMenuActiveIndex] = useState(0);

    const menuStateRef = useRef<WysiwygMenuState | null>(null);
    menuStateRef.current = menuState;
    const menuActiveIndexRef = useRef(0);
    menuActiveIndexRef.current = menuActiveIndex;
    const dismissedSlashTextRef = useRef<string | null>(null);
    const blockProviderRef = useRef<BlockProvider | null>(null);
    const blockPlusBtnRef = useRef<HTMLButtonElement | null>(null);
    const blockDragBtnRef = useRef<HTMLButtonElement | null>(null);
    const menuContainerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onEditMermaidRef = useRef(onEditMermaid);
    onEditMermaidRef.current = onEditMermaid;
    const onOpenNewMermaidRef = useRef(onOpenNewMermaid);
    onOpenNewMermaidRef.current = onOpenNewMermaid;
    const onOpenMarkdownLinkRef = useRef(onOpenMarkdownLink);
    onOpenMarkdownLinkRef.current = onOpenMarkdownLink;
    const stringsRef = useRef({
      editLabel: t.editor.editDiagramLabel,
      editTitle: t.editor.editDiagramTitle,
      emptyError: t.editor.emptyMermaidError,
      renderErrorTitle: t.editor.renderErrorTitle,
      blockAddTitle: t.editor.blockAddTitle,
      blockDragTitle: t.editor.blockDragTitle,
    });
    stringsRef.current = {
      editLabel: t.editor.editDiagramLabel,
      editTitle: t.editor.editDiagramTitle,
      emptyError: t.editor.emptyMermaidError,
      renderErrorTitle: t.editor.renderErrorTitle,
      blockAddTitle: t.editor.blockAddTitle,
      blockDragTitle: t.editor.blockDragTitle,
    };

    const resolvedInsertItems = useMemo<ResolvedBlockInsertItem[]>(
      () =>
        BLOCK_INSERT_ITEM_DEFS.map((def) => ({
          id: def.id,
          label: t.editor[def.labelKey],
          shortcutHint: def.shortcutHint,
          keywords: def.keywords,
        })),
      [t.editor]
    );

    const activeFilterQuery =
      menuState?.kind === 'slash'
        ? menuState.query
        : menuState?.kind === 'insert'
          ? menuQuery
          : '';

    const filteredInsertItems = useMemo(
      () => filterBlockInsertItems(resolvedInsertItems, activeFilterQuery),
      [resolvedInsertItems, activeFilterQuery]
    );
    const filteredInsertItemsRef = useRef<ResolvedBlockInsertItem[]>(filteredInsertItems);
    filteredInsertItemsRef.current = filteredInsertItems;

    const flushCurrentMarkdown = (): void => {
      const editor = editorRef.current;
      if (!editor || !readyRef.current) {
        return;
      }
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        if (suppressedDocRef.current && view.state.doc.eq(suppressedDocRef.current)) {
          return;
        }
        const nextMd = ctx.get(serializerCtx)(view.state.doc);
        if (nextMd !== lastEmittedRef.current) {
          suppressedDocRef.current = null;
          lastEmittedRef.current = nextMd;
          onChangeRef.current(nextMd);
        }
      });
    };

    const closeMenu = (): void => {
      menuStateRef.current = null;
      setMenuState(null);
      setMenuQuery('');
      setMenuActiveIndex(0);
      menuActiveIndexRef.current = 0;
    };

    const executeInsertItem = (itemId: BlockInsertItemId): void => {
      const currentMenu = menuStateRef.current;
      const editor = editorRef.current;
      if (!currentMenu || !editor || !readyRef.current || currentMenu.kind === 'actions') {
        return;
      }

      const target: BlockInsertTarget =
        currentMenu.kind === 'slash'
          ? { mode: 'slash', from: currentMenu.from, to: currentMenu.to }
          : { mode: 'after-block', blockPos: currentMenu.blockPos };

      dismissedSlashTextRef.current = null;
      closeMenu();
      blockProviderRef.current?.hide();

      editor.action((ctx) => {
        insertBlockFromMenu(ctx, itemId, target, onOpenNewMermaidRef.current);
      });
      flushCurrentMarkdown();
    };
    const executeInsertItemRef = useRef(executeInsertItem);
    executeInsertItemRef.current = executeInsertItem;

    const executeBlockAction = (
      action: 'moveUp' | 'moveDown' | 'duplicate' | 'delete'
    ): void => {
      const currentMenu = menuStateRef.current;
      const editor = editorRef.current;
      if (!currentMenu || currentMenu.kind !== 'actions' || !editor || !readyRef.current) {
        return;
      }

      const { blockPos } = currentMenu;
      closeMenu();
      blockProviderRef.current?.hide();

      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        switch (action) {
          case 'moveUp':
            moveBlockUp(view, blockPos);
            break;
          case 'moveDown':
            moveBlockDown(view, blockPos);
            break;
          case 'duplicate':
            duplicateBlock(view, blockPos);
            break;
          case 'delete':
            deleteBlock(view, blockPos);
            break;
        }
        view.focus();
      });
      flushCurrentMarkdown();
    };

    useEffect(() => {
      if (blockPlusBtnRef.current) {
        blockPlusBtnRef.current.title = t.editor.blockAddTitle;
        blockPlusBtnRef.current.setAttribute('aria-label', t.editor.blockAddTitle);
      }
      if (blockDragBtnRef.current) {
        blockDragBtnRef.current.title = t.editor.blockDragTitle;
        blockDragBtnRef.current.setAttribute('aria-label', t.editor.blockDragTitle);
      }
    }, [t.editor.blockAddTitle, t.editor.blockDragTitle]);

    useEffect(() => {
      if (menuState?.kind === 'insert') {
        requestAnimationFrame(() => {
          searchInputRef.current?.focus();
        });
      }
    }, [menuState?.kind]);

    useEffect(() => {
      if (!menuState) {
        return;
      }

      const handlePointerDown = (event: PointerEvent): void => {
        const target = event.target as globalThis.Node | null;
        if (!target) {
          return;
        }
        if (
          menuContainerRef.current?.contains(target) ||
          blockPlusBtnRef.current?.contains(target) ||
          blockDragBtnRef.current?.contains(target)
        ) {
          return;
        }
        if (menuStateRef.current?.kind === 'slash') {
          dismissedSlashTextRef.current = `/${menuStateRef.current.query}`;
        }
        closeMenu();
      };

      const handleEscapeKey = (event: KeyboardEvent): void => {
        if (event.key !== 'Escape') {
          return;
        }
        if (menuStateRef.current?.kind === 'slash') {
          dismissedSlashTextRef.current = `/${menuStateRef.current.query}`;
        }
        closeMenu();
      };

      document.addEventListener('pointerdown', handlePointerDown);
      document.addEventListener('keydown', handleEscapeKey);
      return () => {
        document.removeEventListener('pointerdown', handlePointerDown);
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }, [menuState !== null]);

    useEffect(() => {
      const mountEl = mountRef.current;
      if (!mountEl) {
        return;
      }

      let disposed = false;
      let createdEditor: Editor | null = null;
      mountEl.innerHTML = '';

      const mermaidBlockViewPlugin = $view(codeBlockSchema.node, (ctx) => {
        return (initialNode, view, getPos): NodeView => {
          if (!isMermaidCodeBlock(initialNode)) {
            const pre = document.createElement('pre');
            pre.className = 'markdown-code-pre';
            const code = document.createElement('code');
            pre.appendChild(code);

            return {
              dom: pre,
              contentDOM: code,
              update(nextNode) {
                if (nextNode.type !== initialNode.type || isMermaidCodeBlock(nextNode)) {
                  return false;
                }
                return true;
              },
            };
          }

          let currentNode = initialNode;
          let renderSeq = 0;

          const wrapper = document.createElement('div');
          wrapper.className = 'mermaid-pre-container wysiwyg-mermaid-block';
          wrapper.contentEditable = 'false';

          const card = document.createElement('div');
          card.className = 'mermaid-preview-card';
          card.dataset.mermaidBlock = 'true';

          const editBtn = document.createElement('button');
          editBtn.type = 'button';
          editBtn.className = 'mermaid-edit-float-btn';
          editBtn.title = stringsRef.current.editTitle;
          editBtn.innerHTML = `${PENCIL_SVG}<span></span>`;
          const btnLabelSpan = editBtn.querySelector('span');
          if (btnLabelSpan) {
            btnLabelSpan.textContent = stringsRef.current.editLabel;
          }

          const body = document.createElement('div');
          body.className = 'wysiwyg-mermaid-body';

          const handleEditClick = (event: MouseEvent): void => {
            event.preventDefault();
            event.stopPropagation();
            const pos = typeof getPos === 'function' ? getPos() : 0;
            const blockIndex =
              typeof pos === 'number'
                ? countMermaidBlocksBeforePos(view.state.doc, pos)
                : 0;
            const serialized = ctx.get(serializerCtx)(view.state.doc);
            if (serialized !== lastEmittedRef.current) {
              suppressedDocRef.current = null;
              lastEmittedRef.current = serialized;
              onChangeRef.current(serialized);
            }
            onEditMermaidRef.current(blockIndex, currentNode.textContent);
          };

          editBtn.addEventListener('mousedown', (event) => {
            event.preventDefault();
            event.stopPropagation();
          });
          editBtn.addEventListener('click', handleEditClick);

          const renderDiagram = async (): Promise<void> => {
            renderSeq += 1;
            const seq = renderSeq;
            const code = currentNode.textContent;
            if (!code.trim()) {
              body.replaceChildren(
                createErrorElement(
                  stringsRef.current.renderErrorTitle,
                  stringsRef.current.emptyError
                )
              );
              return;
            }

            const renderId = `mermaid_wysiwyg_${Date.now()}_${Math.random()
              .toString(36)
              .slice(2, 8)}`;
            const result = await renderMermaidSvg(renderId, code);
            if (disposed || seq !== renderSeq) {
              return;
            }
            if (result.error) {
              body.replaceChildren(
                createErrorElement(stringsRef.current.renderErrorTitle, result.error)
              );
              return;
            }
            const svgContainer = document.createElement('div');
            svgContainer.className = 'mermaid-svg-container';
            svgContainer.innerHTML = result.svg;
            body.replaceChildren(svgContainer);
          };

          card.append(editBtn, body);
          wrapper.appendChild(card);
          void renderDiagram();

          return {
            dom: wrapper,
            update(nextNode) {
              if (nextNode.type !== initialNode.type || !isMermaidCodeBlock(nextNode)) {
                return false;
              }
              if (nextNode.textContent !== currentNode.textContent) {
                currentNode = nextNode;
                void renderDiagram();
              }
              return true;
            },
            stopEvent(event) {
              return !MERMAID_PASSTHROUGH_EVENTS.has(event.type);
            },
            ignoreMutation() {
              return true;
            },
            destroy() {
              renderSeq += 1;
              editBtn.removeEventListener('click', handleEditClick);
            },
          };
        };
      });

      const initMarkdown = initialValueRef.current;
      lastEmittedRef.current = initMarkdown;

      const syncTableCursorState = (innerCtx: Ctx): void => {
        try {
          const view = innerCtx.get(editorViewCtx);
          setIsCursorInTable(isInTable(view.state));
        } catch {
          setIsCursorInTable(false);
        }
      };

      const syncSlashMenuState = (innerCtx: Ctx): void => {
        try {
          const view = innerCtx.get(editorViewCtx);
          const match = detectSlashCommand(view.state);
          if (!match) {
            dismissedSlashTextRef.current = null;
            if (menuStateRef.current?.kind === 'slash') {
              menuStateRef.current = null;
              setMenuState(null);
              setMenuActiveIndex(0);
              menuActiveIndexRef.current = 0;
            }
            return;
          }

          const rawText = `/${match.query}`;
          if (dismissedSlashTextRef.current === rawText) {
            return;
          }

          let anchorTop = 0;
          let anchorLeft = 0;
          try {
            const coords = view.coordsAtPos(match.to);
            anchorTop = coords.bottom + 6;
            anchorLeft = coords.left;
          } catch {
            const fallbackRect = mountEl.getBoundingClientRect();
            anchorTop = fallbackRect.top + 24;
            anchorLeft = fallbackRect.left + 52;
          }

          const prevMenu = menuStateRef.current;
          if (!prevMenu || prevMenu.kind !== 'slash' || prevMenu.query !== match.query) {
            menuActiveIndexRef.current = 0;
            setMenuActiveIndex(0);
          }

          const nextMenu: WysiwygMenuState = {
            kind: 'slash',
            query: match.query,
            from: match.from,
            to: match.to,
            anchorTop,
            anchorLeft,
          };
          menuStateRef.current = nextMenu;
          setMenuState(nextMenu);
        } catch {
          // ビュー未初期化時は無視する
        }
      };

      const slashKeymapPlugin = $prose(() => {
        return new Plugin({
          key: new PluginKey('WYSIWYG_SLASH_KEYMAP'),
          props: {
            handleKeyDown: (_view, event) => {
              const currentMenu = menuStateRef.current;
              if (!currentMenu || currentMenu.kind !== 'slash') {
                return false;
              }

              const items = filteredInsertItemsRef.current;
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (items.length > 0) {
                  const nextIdx = (menuActiveIndexRef.current + 1) % items.length;
                  menuActiveIndexRef.current = nextIdx;
                  setMenuActiveIndex(nextIdx);
                }
                return true;
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (items.length > 0) {
                  const nextIdx =
                    (menuActiveIndexRef.current - 1 + items.length) % items.length;
                  menuActiveIndexRef.current = nextIdx;
                  setMenuActiveIndex(nextIdx);
                }
                return true;
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                dismissedSlashTextRef.current = `/${currentMenu.query}`;
                closeMenu();
                return true;
              }
              if (event.key === 'Enter') {
                if (items.length > 0) {
                  event.preventDefault();
                  const safeIdx = Math.min(menuActiveIndexRef.current, items.length - 1);
                  executeInsertItemRef.current(items[safeIdx].id);
                  return true;
                }
                closeMenu();
                return false;
              }
              return false;
            },
          },
        });
      });

      const handleMountMouseLeave = (): void => {
        if (menuStateRef.current) {
          return;
        }
        const editor = editorRef.current;
        if (!editor || !readyRef.current) {
          return;
        }
        try {
          const isDragging = editor.action(
            (innerCtx) => innerCtx.get(editorViewCtx).dom.dataset.dragging === 'true'
          );
          if (!isDragging) {
            blockProviderRef.current?.hide();
          }
        } catch {
          // 無視する
        }
      };
      mountEl.addEventListener('mouseleave', handleMountMouseLeave);

      const exitEmptyContainerPlugin = createExitEmptyContainerOnBackspacePlugin();

      void Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, mountEl);
          ctx.set(defaultValueCtx, initMarkdown);
          ctx.set(dropIndicatorConfig.key, {
            width: 3,
            color: '#2563eb',
            class: 'milkdown-drop-indicator',
          });
          ctx.set(block.key, {
            view: () => {
              const handleDom = document.createElement('div');
              handleDom.className = 'wysiwyg-block-handle';

              const plusBtn = document.createElement('button');
              plusBtn.type = 'button';
              plusBtn.draggable = false;
              plusBtn.className = 'wysiwyg-block-handle-btn wysiwyg-block-plus-btn';
              plusBtn.title = stringsRef.current.blockAddTitle;
              plusBtn.setAttribute('aria-label', stringsRef.current.blockAddTitle);
              plusBtn.innerHTML = PLUS_SVG;

              const dragBtn = document.createElement('button');
              dragBtn.type = 'button';
              dragBtn.className = 'wysiwyg-block-handle-btn wysiwyg-block-drag-btn';
              dragBtn.title = stringsRef.current.blockDragTitle;
              dragBtn.setAttribute('aria-label', stringsRef.current.blockDragTitle);
              dragBtn.innerHTML = GRIP_SVG;

              handleDom.append(plusBtn, dragBtn);
              blockPlusBtnRef.current = plusBtn;
              blockDragBtnRef.current = dragBtn;

              const provider = new BlockProvider({
                ctx,
                content: handleDom,
                root: mountEl,
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
              blockProviderRef.current = provider;

              let didDrag = false;

              const onHandleDragStart = (): void => {
                didDrag = true;
                closeMenu();
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
                  menuStateRef.current?.kind === 'insert' &&
                  menuStateRef.current.blockPos === blockPos
                ) {
                  closeMenu();
                  return;
                }

                const rect = plusBtn.getBoundingClientRect();
                const nextMenu: WysiwygMenuState = {
                  kind: 'insert',
                  blockPos,
                  anchorTop: rect.bottom + 4,
                  anchorLeft: rect.left,
                };
                menuStateRef.current = nextMenu;
                setMenuQuery('');
                menuActiveIndexRef.current = 0;
                setMenuActiveIndex(0);
                setMenuState(nextMenu);
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
                  menuStateRef.current?.kind === 'actions' &&
                  menuStateRef.current.blockPos === blockPos
                ) {
                  closeMenu();
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
                menuStateRef.current = nextMenu;
                setMenuState(nextMenu);
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
                  if (blockProviderRef.current === provider) {
                    blockProviderRef.current = null;
                  }
                  if (blockPlusBtnRef.current === plusBtn) {
                    blockPlusBtnRef.current = null;
                  }
                  if (blockDragBtnRef.current === dragBtn) {
                    blockDragBtnRef.current = null;
                  }
                },
              };
            },
          });
          ctx.get(listenerCtx)
            .updated((innerCtx, doc, prevDoc) => {
              syncTableCursorState(innerCtx);
              syncSlashMenuState(innerCtx);
              if (prevDoc && prevDoc.eq(doc)) {
                return;
              }
              if (suppressedDocRef.current && doc.eq(suppressedDocRef.current)) {
                return;
              }
              suppressedDocRef.current = null;
              const nextMd = innerCtx.get(serializerCtx)(doc);
              if (nextMd !== lastEmittedRef.current) {
                lastEmittedRef.current = nextMd;
                onChangeRef.current(nextMd);
              }
            })
            .selectionUpdated((innerCtx) => {
              syncTableCursorState(innerCtx);
              syncSlashMenuState(innerCtx);
            })
            .blur(() => {
              flushCurrentMarkdown();
            });
        })
        .use(commonmark)
        .use(gfm)
        .use(history)
        .use(listener)
        .use(cursor)
        .use(block)
        .use(slashKeymapPlugin)
        .use(exitEmptyContainerPlugin)
        .use(mermaidBlockViewPlugin)
        .create()
        .then((editor) => {
          if (disposed) {
            void editor.destroy();
            return;
          }
          createdEditor = editor;
          editorRef.current = editor;
          readyRef.current = true;
          editor.action((ctx) => {
            const view = ctx.get(editorViewCtx);
            suppressedDocRef.current = view.state.doc;
            setIsCursorInTable(isInTable(view.state));
          });
        });

      return () => {
        disposed = true;
        readyRef.current = false;
        editorRef.current = null;
        suppressedDocRef.current = null;
        blockProviderRef.current = null;
        blockPlusBtnRef.current = null;
        blockDragBtnRef.current = null;
        mountEl.removeEventListener('mouseleave', handleMountMouseLeave);
        closeMenu();
        setIsCursorInTable(false);
        if (createdEditor) {
          void createdEditor.destroy();
        }
        mountEl.innerHTML = '';
      };
    }, []);

    useEffect(() => {
      const editor = editorRef.current;
      if (!editor || !readyRef.current) {
        initialValueRef.current = value;
        return;
      }
      if (value === lastEmittedRef.current) {
        return;
      }
      lastEmittedRef.current = value;
      closeMenu();
      blockProviderRef.current?.hide();
      editor.action(replaceAll(value));
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        suppressedDocRef.current = view.state.doc;
        setIsCursorInTable(isInTable(view.state));
      });
    }, [value]);

    const runWithFocus = (fn: (editor: Editor) => void): void => {
      const editor = editorRef.current;
      if (!editor || !readyRef.current) {
        return;
      }
      fn(editor);
      editor.action((ctx) => {
        ctx.get(editorViewCtx).focus();
      });
      flushCurrentMarkdown();
    };

    useImperativeHandle(
      ref,
      () => ({
        focus() {
          const editor = editorRef.current;
          if (!editor || !readyRef.current) {
            return;
          }
          editor.action((ctx) => {
            ctx.get(editorViewCtx).focus();
          });
        },

        applyHeading(level: 1 | 2 | 3) {
          runWithFocus((editor) => {
            editor.action((ctx) => {
              const view = ctx.get(editorViewCtx);
              const headingType = headingSchema.type(ctx);
              const paragraphType = paragraphSchema.type(ctx);
              const { $from } = view.state.selection;
              if ($from.parent.type === headingType && $from.parent.attrs.level === level) {
                setBlockType(paragraphType)(view.state, view.dispatch);
              } else {
                setBlockType(headingType, { level })(view.state, view.dispatch);
              }
            });
          });
        },

        applyBold() {
          runWithFocus((editor) => {
            editor.action(callCommand(toggleStrongCommand.key));
          });
        },

        applyItalic() {
          runWithFocus((editor) => {
            editor.action(callCommand(toggleEmphasisCommand.key));
          });
        },

        applyStrike() {
          runWithFocus((editor) => {
            editor.action(callCommand(toggleStrikethroughCommand.key));
          });
        },

        applyLink(placeholder: string) {
          runWithFocus((editor) => {
            editor.action((ctx) => {
              const view = ctx.get(editorViewCtx);
              if (view.state.selection.empty) {
                const mark = linkSchema.type(ctx).create({ href: 'https://example.com' });
                const textNode = view.state.schema.text(placeholder, [mark]);
                view.dispatch(view.state.tr.replaceSelectionWith(textNode, false));
                return;
              }
              callCommand(toggleLinkCommand.key, { href: 'https://example.com' })(ctx);
            });
          });
        },

        getSelectedText() {
          const editor = editorRef.current;
          if (!editor || !readyRef.current) {
            return '';
          }
          let selected = '';
          editor.action((ctx) => {
            const view = ctx.get(editorViewCtx);
            const { from, to } = view.state.selection;
            if (from !== to) {
              selected = view.state.doc.textBetween(from, to, ' ').trim();
            }
          });
          return selected;
        },

        insertLink(label: string, href: string) {
          const cleanHref = href.trim();
          if (!cleanHref) {
            return;
          }
          const textLabel = label.trim() || cleanHref;
          runWithFocus((editor) => {
            editor.action((ctx) => {
              const view = ctx.get(editorViewCtx);
              const mark = linkSchema.type(ctx).create({ href: cleanHref });
              const textNode = view.state.schema.text(textLabel, [mark]);
              view.dispatch(view.state.tr.replaceSelectionWith(textNode, false).scrollIntoView());
            });
          });
        },

        applyBulletList() {
          runWithFocus((editor) => {
            editor.action(callCommand(wrapInBulletListCommand.key));
          });
        },

        applyOrderedList() {
          runWithFocus((editor) => {
            editor.action(callCommand(wrapInOrderedListCommand.key));
          });
        },

        applyTaskList() {
          runWithFocus((editor) => {
            editor.action((ctx) => {
              const view = ctx.get(editorViewCtx);
              const itemType = listItemSchema.type(ctx);
              const findListItemDepth = (): number => {
                const { $from } = view.state.selection;
                for (let d = $from.depth; d > 0; d -= 1) {
                  if ($from.node(d).type === itemType) {
                    return d;
                  }
                }
                return -1;
              };

              if (findListItemDepth() < 0) {
                callCommand(wrapInBulletListCommand.key)(ctx);
              }

              const depth = findListItemDepth();
              if (depth > 0) {
                const pos = view.state.selection.$from.before(depth);
                const node = view.state.selection.$from.node(depth);
                const nextChecked = node.attrs.checked == null ? false : null;
                view.dispatch(
                  view.state.tr.setNodeMarkup(pos, undefined, {
                    ...node.attrs,
                    checked: nextChecked,
                  })
                );
              }
            });
          });
        },

        applyQuote() {
          runWithFocus((editor) => {
            editor.action(callCommand(wrapInBlockquoteCommand.key));
          });
        },

        applyCodeBlock() {
          runWithFocus((editor) => {
            editor.action(callCommand(createCodeBlockCommand.key));
          });
        },

        insertTable(rows: number, cols: number) {
          const safeRows = Math.max(1, Math.min(20, rows));
          const safeCols = Math.max(1, Math.min(12, cols));
          runWithFocus((editor) => {
            editor.action(callCommand(insertTableCommand.key, { row: safeRows + 1, col: safeCols }));
          });
        },

        insertMermaidBlock(code: string) {
          runWithFocus((editor) => {
            editor.action((ctx) => {
              const view = ctx.get(editorViewCtx);
              const cbType = codeBlockSchema.type(ctx);
              const textNode = code ? view.state.schema.text(code) : undefined;
              const blockNode = cbType.create({ language: 'mermaid' }, textNode);
              view.dispatch(view.state.tr.replaceSelectionWith(blockNode).scrollIntoView());
            });
          });
        },

        insertText(text: string) {
          runWithFocus((editor) => {
            editor.action((ctx) => {
              const view = ctx.get(editorViewCtx);
              view.dispatch(view.state.tr.insertText(text));
            });
          });
        },
      }),
      []
    );

    const handleContainerClick = (event: React.MouseEvent<HTMLDivElement>): void => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (anchor && (event.ctrlKey || event.metaKey)) {
        const rawHref = anchor.getAttribute('href') ?? '';
        if (rawHref.trim()) {
          event.preventDefault();
          event.stopPropagation();
          if (onOpenMarkdownLinkRef.current) {
            onOpenMarkdownLinkRef.current(rawHref);
          } else if (/^https?:\/\//i.test(rawHref.trim())) {
            window.open(rawHref.trim(), '_blank', 'noopener,noreferrer');
          }
        }
        return;
      }

      const taskLi = target?.closest('li[data-item-type="task"]') as HTMLElement | null;
      if (!taskLi || !editorRef.current || !readyRef.current) {
        return;
      }
      const rect = taskLi.getBoundingClientRect();
      // 左端のチェックボックス描画領域がクリックされたときだけトグルする
      if (event.clientX - rect.left > 28) {
        return;
      }
      event.preventDefault();
      editorRef.current.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        try {
          const pos = view.posAtDOM(taskLi, 0);
          const $pos = view.state.doc.resolve(pos);
          const itemType = listItemSchema.type(ctx);
          for (let d = $pos.depth; d >= 0; d -= 1) {
            if ($pos.node(d).type === itemType) {
              const itemPos = $pos.before(d);
              const itemNode = $pos.node(d);
              view.dispatch(
                view.state.tr.setNodeMarkup(itemPos, undefined, {
                  ...itemNode.attrs,
                  checked: !itemNode.attrs.checked,
                })
              );
              break;
            }
          }
        } catch {
          // 位置解決失敗時は無視する
        }
      });
      flushCurrentMarkdown();
    };

    const runTableAction = (
      tableCmd: typeof addRowAfter | typeof addColumnAfter | typeof deleteRow | typeof deleteColumn
    ): void => {
      runWithFocus((editor) => {
        editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          tableCmd(view.state, view.dispatch);
        });
      });
    };

    const safeActiveIndex =
      filteredInsertItems.length > 0
        ? Math.min(menuActiveIndex, filteredInsertItems.length - 1)
        : 0;

    const handleSearchInputKeyDown = (
      event: React.KeyboardEvent<HTMLInputElement>
    ): void => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (filteredInsertItems.length > 0) {
          const nextIdx = (safeActiveIndex + 1) % filteredInsertItems.length;
          menuActiveIndexRef.current = nextIdx;
          setMenuActiveIndex(nextIdx);
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
          setMenuActiveIndex(nextIdx);
        }
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const selected = filteredInsertItems[safeActiveIndex];
        if (selected) {
          executeInsertItem(selected.id);
        }
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
        editorRef.current?.action((ctx) => {
          ctx.get(editorViewCtx).focus();
        });
      }
    };

    return (
      <section className="editor-pane-wysiwyg">
        <div className="pane-header">
          <span>{t.editor.wysiwygPaneHeader}</span>
          {isCursorInTable ? (
            <div className="wysiwyg-table-actions">
              <button
                type="button"
                className="wysiwyg-table-btn"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runTableAction(addRowAfter)}
              >
                {t.editor.tableAddRowAfter}
              </button>
              <button
                type="button"
                className="wysiwyg-table-btn"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runTableAction(addColumnAfter)}
              >
                {t.editor.tableAddColAfter}
              </button>
              <button
                type="button"
                className="wysiwyg-table-btn"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runTableAction(deleteRow)}
              >
                {t.editor.tableDeleteRow}
              </button>
              <button
                type="button"
                className="wysiwyg-table-btn"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runTableAction(deleteColumn)}
              >
                {t.editor.tableDeleteCol}
              </button>
            </div>
          ) : (
            <span className="wysiwyg-link-hint">{t.editor.wysiwygLinkHint}</span>
          )}
        </div>
        <div
          className="wysiwyg-editor-scroll"
          onClick={handleContainerClick}
          onScroll={() => {
            if (menuStateRef.current) {
              closeMenu();
            }
          }}
        >
          <div ref={mountRef} className="wysiwyg-prosemirror-root" />
        </div>
        {menuState && (menuState.kind === 'insert' || menuState.kind === 'slash') && (
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
                  setMenuQuery(event.target.value);
                  menuActiveIndexRef.current = 0;
                  setMenuActiveIndex(0);
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
                      setMenuActiveIndex(idx);
                    }}
                    onClick={() => executeInsertItem(item.id)}
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
        )}
        {menuState && menuState.kind === 'actions' && (
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
                onClick={() => executeBlockAction('moveUp')}
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
                onClick={() => executeBlockAction('moveDown')}
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
                onClick={() => executeBlockAction('duplicate')}
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
                onClick={() => executeBlockAction('delete')}
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
        )}
      </section>
    );
  }
);

export default WysiwygEditor;
