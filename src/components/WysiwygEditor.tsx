import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import '@milkdown/kit/prose/view/style/prosemirror.css';
import '@milkdown/kit/prose/tables/style/tables.css';
import '../styles/wysiwyg-editor.css';
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  rootCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { block, type BlockProvider } from '@milkdown/kit/plugin/block';
import { cursor, dropIndicatorConfig } from '@milkdown/kit/plugin/cursor';
import { history } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import {
  addColumnAfter,
  addRowAfter,
  deleteColumn,
  deleteRow,
  isInTable,
} from '@milkdown/kit/prose/tables';
import { replaceAll } from '@milkdown/kit/utils';
import { useI18n } from '../i18n';
import {
  BLOCK_INSERT_ITEM_DEFS,
  type BlockInsertItemId,
  type BlockInsertTarget,
  type ResolvedBlockInsertItem,
  deleteBlock,
  duplicateBlock,
  filterBlockInsertItems,
  insertBlockFromMenu,
  moveBlockDown,
  moveBlockUp,
} from '../utils/wysiwygBlockActions';
import WysiwygBlockMenus from './wysiwyg/WysiwygBlockMenus';
import {
  createWysiwygImperativeHandle,
  handleWysiwygContainerClick,
} from './wysiwyg/editorCommands';
import { createMermaidBlockViewPlugin } from './wysiwyg/mermaidNodeView';
import {
  createBlockHandleViewFactory,
  createExitEmptyContainerOnBackspacePlugin,
  createSlashKeymapPlugin,
  syncSlashMenuState,
} from './wysiwyg/plugins';
import type {
  WysiwygBlockAction,
  WysiwygEditorHandle,
  WysiwygEditorProps,
  WysiwygEditorStrings,
  WysiwygMenuState,
} from './wysiwyg/types';

export { createExitEmptyContainerOnBackspacePlugin } from './wysiwyg/plugins';
export type { WysiwygEditorHandle, WysiwygEditorProps } from './wysiwyg/types';

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

    const stringsRef = useRef<WysiwygEditorStrings>({
      editLabel: t.editor.editDiagramLabel,
      editTitle: t.editor.editDiagramTitle,
      emptyError: t.editor.emptyMermaidError,
      renderErrorTitle: t.editor.renderErrorTitle,
      blockAddTitle: t.editor.blockAddTitle,
      blockDragTitle: t.editor.blockDragTitle,
    });
    stringsRef.current.editLabel = t.editor.editDiagramLabel;
    stringsRef.current.editTitle = t.editor.editDiagramTitle;
    stringsRef.current.emptyError = t.editor.emptyMermaidError;
    stringsRef.current.renderErrorTitle = t.editor.renderErrorTitle;
    stringsRef.current.blockAddTitle = t.editor.blockAddTitle;
    stringsRef.current.blockDragTitle = t.editor.blockDragTitle;

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

    const executeBlockAction = (action: WysiwygBlockAction): void => {
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

    const hasOpenMenu = menuState !== null;

    useEffect(() => {
      if (!hasOpenMenu) {
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
    }, [hasOpenMenu]);

    useEffect(() => {
      const mountEl = mountRef.current;
      if (!mountEl) {
        return;
      }

      let disposed = false;
      let createdEditor: Editor | null = null;
      mountEl.innerHTML = '';

      const mermaidBlockViewPlugin = createMermaidBlockViewPlugin({
        isDisposed: () => disposed,
        getStrings: () => stringsRef.current,
        getLastEmitted: () => lastEmittedRef.current,
        onSyncExternalMarkdown: (nextMarkdown) => {
          suppressedDocRef.current = null;
          lastEmittedRef.current = nextMarkdown;
          onChangeRef.current(nextMarkdown);
        },
        onEditMermaid: (blockIndex, code) => onEditMermaidRef.current(blockIndex, code),
      });

      const syncTableCursorState = (innerCtx: Ctx): void => {
        try {
          const view = innerCtx.get(editorViewCtx);
          setIsCursorInTable(isInTable(view.state));
        } catch {
          setIsCursorInTable(false);
        }
      };

      const slashDeps = {
        mountEl,
        menuStateRef,
        menuActiveIndexRef,
        dismissedSlashTextRef,
        setMenuState,
        setMenuActiveIndex,
      };

      const slashKeymapPlugin = createSlashKeymapPlugin({
        menuStateRef,
        menuActiveIndexRef,
        filteredInsertItemsRef,
        dismissedSlashTextRef,
        setMenuActiveIndex,
        closeMenu,
        executeInsertItem: (itemId) => executeInsertItemRef.current(itemId),
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
      const initMarkdown = initialValueRef.current;
      lastEmittedRef.current = initMarkdown;

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
            view: () =>
              createBlockHandleViewFactory(ctx, {
                mountEl,
                getStrings: () => stringsRef.current,
                blockProviderRef,
                blockPlusBtnRef,
                blockDragBtnRef,
                menuStateRef,
                menuActiveIndexRef,
                setMenuState,
                setMenuQuery,
                setMenuActiveIndex,
                closeMenu,
              }),
          });
          ctx.get(listenerCtx)
            .updated((innerCtx, doc, prevDoc) => {
              syncTableCursorState(innerCtx);
              syncSlashMenuState(innerCtx, slashDeps);
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
              syncSlashMenuState(innerCtx, slashDeps);
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

    const runWithFocusRef = useRef(runWithFocus);
    runWithFocusRef.current = runWithFocus;

    useImperativeHandle(
      ref,
      () =>
        createWysiwygImperativeHandle({
          editorRef,
          readyRef,
          runWithFocus: (fn) => runWithFocusRef.current(fn),
        }),
      []
    );

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

    const handleCloseAndFocusEditor = (): void => {
      closeMenu();
      editorRef.current?.action((ctx) => {
        ctx.get(editorViewCtx).focus();
      });
    };

    const tableActions = [
      { cmd: addRowAfter, label: t.editor.tableAddRowAfter },
      { cmd: addColumnAfter, label: t.editor.tableAddColAfter },
      { cmd: deleteRow, label: t.editor.tableDeleteRow },
      { cmd: deleteColumn, label: t.editor.tableDeleteCol },
    ];

    return (
      <section className="editor-pane-wysiwyg">
        <div className="pane-header">
          <span>{t.editor.wysiwygPaneHeader}</span>
          {isCursorInTable ? (
            <div className="wysiwyg-table-actions">
              {tableActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className="wysiwyg-table-btn"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => runTableAction(action.cmd)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : (
            <span className="wysiwyg-link-hint">{t.editor.wysiwygLinkHint}</span>
          )}
        </div>
        <div
          className="wysiwyg-editor-scroll"
          onClick={(event) =>
            handleWysiwygContainerClick(
              event,
              editorRef.current,
              readyRef.current,
              onOpenMarkdownLinkRef.current,
              flushCurrentMarkdown
            )
          }
          onScroll={() => {
            if (menuStateRef.current) {
              closeMenu();
            }
          }}
        >
          <div ref={mountRef} className="wysiwyg-prosemirror-root" />
        </div>
        <WysiwygBlockMenus
          menuState={menuState}
          menuQuery={menuQuery}
          menuActiveIndex={menuActiveIndex}
          filteredInsertItems={filteredInsertItems}
          menuContainerRef={menuContainerRef}
          searchInputRef={searchInputRef}
          menuActiveIndexRef={menuActiveIndexRef}
          onChangeMenuQuery={setMenuQuery}
          onChangeMenuActiveIndex={setMenuActiveIndex}
          onExecuteInsertItem={executeInsertItem}
          onExecuteBlockAction={executeBlockAction}
          onCloseAndFocusEditor={handleCloseAndFocusEditor}
        />
      </section>
    );
  }
);

export default WysiwygEditor;
