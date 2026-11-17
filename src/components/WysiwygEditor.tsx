import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
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
import { history } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { setBlockType } from '@milkdown/kit/prose/commands';
import { type Node as ProseNode } from '@milkdown/kit/prose/model';
import {
  addColumnAfter,
  addRowAfter,
  deleteColumn,
  deleteRow,
  isInTable,
} from '@milkdown/kit/prose/tables';
import { type NodeView } from '@milkdown/kit/prose/view';
import { $view, callCommand, replaceAll } from '@milkdown/kit/utils';
import { useI18n } from '../i18n';
import { renderMermaidSvg } from '../utils/mermaidRender';

export interface WysiwygEditorHandle {
  focus: () => void;
  applyHeading: (level: 1 | 2 | 3) => void;
  applyBold: () => void;
  applyItalic: () => void;
  applyStrike: () => void;
  applyLink: (placeholder: string) => void;
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
}

const PENCIL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>';

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

const WysiwygEditor = forwardRef<WysiwygEditorHandle, WysiwygEditorProps>(
  function WysiwygEditor({ value, onChange, onEditMermaid }, ref) {
    const { t } = useI18n();
    const mountRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<Editor | null>(null);
    const readyRef = useRef(false);
    const initialValueRef = useRef(value);
    const lastEmittedRef = useRef(value);
    const suppressedDocRef = useRef<ProseNode | null>(null);
    const [isCursorInTable, setIsCursorInTable] = useState(false);

    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onEditMermaidRef = useRef(onEditMermaid);
    onEditMermaidRef.current = onEditMermaid;
    const stringsRef = useRef({
      editLabel: t.editor.editDiagramLabel,
      editTitle: t.editor.editDiagramTitle,
      emptyError: t.editor.emptyMermaidError,
      renderErrorTitle: t.editor.renderErrorTitle,
    });
    stringsRef.current = {
      editLabel: t.editor.editDiagramLabel,
      editTitle: t.editor.editDiagramTitle,
      emptyError: t.editor.emptyMermaidError,
      renderErrorTitle: t.editor.renderErrorTitle,
    };

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
              return event.type !== 'dragstart';
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

      void Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, mountEl);
          ctx.set(defaultValueCtx, initMarkdown);
          ctx.get(listenerCtx)
            .updated((innerCtx, doc, prevDoc) => {
              syncTableCursorState(innerCtx);
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
            })
            .blur(() => {
              flushCurrentMarkdown();
            });
        })
        .use(commonmark)
        .use(gfm)
        .use(history)
        .use(listener)
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

    return (
      <section className="editor-pane-wysiwyg">
        <div className="pane-header">
          <span>{t.editor.wysiwygPaneHeader}</span>
          {isCursorInTable && (
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
          )}
        </div>
        <div className="wysiwyg-editor-scroll" onClick={handleContainerClick}>
          <div ref={mountRef} className="wysiwyg-prosemirror-root" />
        </div>
      </section>
    );
  }
);

export default WysiwygEditor;
