import type { MouseEvent as ReactMouseEvent, MutableRefObject } from 'react';
import { Editor, editorViewCtx } from '@milkdown/kit/core';
import {
  codeBlockSchema,
  createCodeBlockCommand,
  headingSchema,
  linkSchema,
  listItemSchema,
  paragraphSchema,
  toggleEmphasisCommand,
  toggleStrongCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
} from '@milkdown/kit/preset/commonmark';
import { insertTableCommand, toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm';
import { setBlockType } from '@milkdown/kit/prose/commands';
import { callCommand } from '@milkdown/kit/utils';
import type { WysiwygEditorHandle } from './types';

export interface CreateWysiwygHandleDeps {
  editorRef: MutableRefObject<Editor | null>;
  readyRef: MutableRefObject<boolean>;
  runWithFocus: (fn: (editor: Editor) => void) => void;
  onOpenLinkEditor: () => void;
}

export function createWysiwygImperativeHandle({
  editorRef,
  readyRef,
  runWithFocus,
  onOpenLinkEditor,
}: CreateWysiwygHandleDeps): WysiwygEditorHandle {
  return {
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

    applyLink(_placeholder: string) {
      onOpenLinkEditor();
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
          const linkType = linkSchema.type(ctx);
          const mark = linkType.create({ href: cleanHref });
          const textNode = view.state.schema.text(textLabel, [mark]);
          const tr = view.state.tr
            .replaceSelectionWith(textNode, false)
            .removeStoredMark(linkType)
            .scrollIntoView();
          view.dispatch(tr);
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
  };
}

export function toggleTaskListItemAtDom(editor: Editor, taskLi: HTMLElement): void {
  editor.action((ctx) => {
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
}

export function handleWysiwygContainerClick(
  event: ReactMouseEvent<HTMLDivElement>,
  editor: Editor | null,
  ready: boolean,
  onOpenMarkdownLink: ((href: string) => void) | undefined,
  flushCurrentMarkdown: () => void,
  onClickLink?: (anchorEl: HTMLAnchorElement, href: string) => void
): void {
  const target = event.target as HTMLElement | null;
  const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
  if (anchor) {
    const rawHref = anchor.getAttribute('href') ?? '';
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      if (rawHref.trim()) {
        event.stopPropagation();
        if (onOpenMarkdownLink) {
          onOpenMarkdownLink(rawHref);
        } else if (/^https?:\/\//i.test(rawHref.trim())) {
          window.open(rawHref.trim(), '_blank', 'noopener,noreferrer');
        }
      }
      return;
    }
    onClickLink?.(anchor, rawHref);
    return;
  }

  const taskLi = target?.closest('li[data-item-type="task"]') as HTMLElement | null;
  if (!taskLi || !editor || !ready) {
    return;
  }
  const rect = taskLi.getBoundingClientRect();
  // 左端のチェックボックス描画領域がクリックされたときだけトグルする
  if (event.clientX - rect.left > 28) {
    return;
  }
  event.preventDefault();
  toggleTaskListItemAtDom(editor, taskLi);
  flushCurrentMarkdown();
}
