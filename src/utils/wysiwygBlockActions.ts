import { editorViewCtx } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import {
  codeBlockSchema,
  createCodeBlockCommand,
  headingSchema,
  hrSchema,
  listItemSchema,
  paragraphSchema,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
} from '@milkdown/kit/preset/commonmark';
import { insertTableCommand } from '@milkdown/kit/preset/gfm';
import { setBlockType } from '@milkdown/kit/prose/commands';
import { Fragment, type Node as ProseNode } from '@milkdown/kit/prose/model';
import {
  type EditorState,
  NodeSelection,
  Selection,
  TextSelection,
  type Transaction,
} from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { callCommand } from '@milkdown/kit/utils';
import type { TranslationCatalog } from '../locales/types';

export type BlockInsertItemId =
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'table'
  | 'mermaid'
  | 'codeBlock'
  | 'blockquote'
  | 'divider';

export type BlockInsertLabelKey = {
  [K in keyof TranslationCatalog['editor']]: TranslationCatalog['editor'][K] extends string
    ? K
    : never;
}[keyof TranslationCatalog['editor']];

export interface BlockInsertItemDef {
  id: BlockInsertItemId;
  labelKey: BlockInsertLabelKey;
  shortcutHint: string;
  keywords: readonly string[];
}

export interface ResolvedBlockInsertItem {
  id: BlockInsertItemId;
  label: string;
  shortcutHint: string;
  keywords: readonly string[];
}

export interface SlashMatch {
  query: string;
  from: number;
  to: number;
}

export type BlockInsertTarget =
  | { mode: 'after-block'; blockPos: number }
  | { mode: 'slash'; from: number; to: number };

const DEFAULT_MERMAID_SNIPPET = 'flowchart TD\n  A[Start] --> B[End]';

export const BLOCK_INSERT_ITEM_DEFS: readonly BlockInsertItemDef[] = [
  {
    id: 'heading1',
    labelKey: 'blockItemHeading1',
    shortcutHint: '#',
    keywords: ['h1', 'heading', 'title', '見出し', 'タイトル', 'みだし'],
  },
  {
    id: 'heading2',
    labelKey: 'blockItemHeading2',
    shortcutHint: '##',
    keywords: ['h2', 'heading', 'subtitle', '見出し', 'みだし'],
  },
  {
    id: 'heading3',
    labelKey: 'blockItemHeading3',
    shortcutHint: '###',
    keywords: ['h3', 'heading', '見出し', 'みだし'],
  },
  {
    id: 'bulletList',
    labelKey: 'blockItemBulletList',
    shortcutHint: '-',
    keywords: ['ul', 'bullet', 'list', '箇条書き', 'リスト', 'かじょうがき'],
  },
  {
    id: 'orderedList',
    labelKey: 'blockItemOrderedList',
    shortcutHint: '1.',
    keywords: ['ol', 'ordered', 'number', 'list', '番号', 'リスト', 'ばんごう'],
  },
  {
    id: 'taskList',
    labelKey: 'blockItemTaskList',
    shortcutHint: '[ ]',
    keywords: ['task', 'todo', 'check', 'checkbox', 'タスク', 'チェック', 'たすく'],
  },
  {
    id: 'table',
    labelKey: 'blockItemTable',
    shortcutHint: '| |',
    keywords: ['table', 'grid', '表', 'テーブル', 'ひょう'],
  },
  {
    id: 'mermaid',
    labelKey: 'blockItemMermaid',
    shortcutHint: 'mermaid',
    keywords: ['mermaid', 'diagram', 'chart', 'flow', '図', 'フロー', 'マーメイド', 'ず'],
  },
  {
    id: 'codeBlock',
    labelKey: 'blockItemCodeBlock',
    shortcutHint: '```',
    keywords: ['code', 'fence', 'pre', 'snippet', 'コード', 'ソース', 'こーど'],
  },
  {
    id: 'blockquote',
    labelKey: 'blockItemQuote',
    shortcutHint: '>',
    keywords: ['quote', 'blockquote', '引用', 'いんよう'],
  },
  {
    id: 'divider',
    labelKey: 'blockItemDivider',
    shortcutHint: '---',
    keywords: ['hr', 'divider', 'line', 'separator', '区切り', '線', 'くぎり'],
  },
];

/**
 * 挿入メニュー項目を検索文字列で絞り込む。
 */
export function filterBlockInsertItems(
  items: readonly ResolvedBlockInsertItem[],
  rawQuery: string
): ResolvedBlockInsertItem[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return [...items];
  }
  return items.filter(
    (item) =>
      item.label.toLowerCase().includes(query) ||
      item.shortcutHint.toLowerCase().includes(query) ||
      item.keywords.some((kw) => kw.toLowerCase().includes(query))
  );
}

/**
 * 最上位の空段落行先頭に入力された "/" スラッシュコマンドを検出する。
 */
export function detectSlashCommand(state: EditorState): SlashMatch | null {
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty) {
    return null;
  }

  const { $from } = selection;
  if (
    $from.depth !== 1 ||
    $from.parent.type.name !== 'paragraph' ||
    $from.parentOffset !== $from.parent.content.size
  ) {
    return null;
  }

  const match = /^\/([^\s/]*)$/.exec($from.parent.textContent);
  if (!match) {
    return null;
  }

  return {
    query: match[1],
    from: $from.start(),
    to: $from.pos,
  };
}

function selectMovedOrCopiedBlock(
  tr: Transaction,
  pos: number,
  node: ProseNode
): void {
  if (node.isAtom) {
    tr.setSelection(NodeSelection.create(tr.doc, pos));
    return;
  }
  tr.setSelection(Selection.near(tr.doc.resolve(pos + 1)));
}

/**
 * 指定位置のブロックを1つ上へ移動できるか判定する。
 */
export function canMoveBlockUp(doc: ProseNode, blockPos: number): boolean {
  if (blockPos < 0 || blockPos >= doc.content.size) {
    return false;
  }
  const node = doc.nodeAt(blockPos);
  if (!node) {
    return false;
  }
  return doc.resolve(blockPos).index() > 0;
}

/**
 * 指定位置のブロックを1つ下へ移動できるか判定する。
 */
export function canMoveBlockDown(doc: ProseNode, blockPos: number): boolean {
  if (blockPos < 0 || blockPos >= doc.content.size) {
    return false;
  }
  const node = doc.nodeAt(blockPos);
  if (!node) {
    return false;
  }
  const $pos = doc.resolve(blockPos);
  return $pos.index() + 1 < $pos.parent.childCount;
}

/**
 * 指定位置のブロックを直前の兄弟ブロックと入れ替えて上へ移動する。
 */
export function moveBlockUp(view: EditorView, blockPos: number): boolean {
  const { doc } = view.state;
  if (!canMoveBlockUp(doc, blockPos)) {
    return false;
  }

  const blockNode = doc.nodeAt(blockPos);
  if (!blockNode) {
    return false;
  }

  const $pos = doc.resolve(blockPos);
  const prevNode = $pos.parent.child($pos.index() - 1);
  const prevPos = blockPos - prevNode.nodeSize;
  const blockEnd = blockPos + blockNode.nodeSize;

  const tr = view.state.tr.replaceWith(
    prevPos,
    blockEnd,
    Fragment.from([blockNode, prevNode])
  );
  selectMovedOrCopiedBlock(tr, prevPos, blockNode);
  view.dispatch(tr.scrollIntoView());
  return true;
}

/**
 * 指定位置のブロックを直後の兄弟ブロックと入れ替えて下へ移動する。
 */
export function moveBlockDown(view: EditorView, blockPos: number): boolean {
  const { doc } = view.state;
  if (!canMoveBlockDown(doc, blockPos)) {
    return false;
  }

  const blockNode = doc.nodeAt(blockPos);
  if (!blockNode) {
    return false;
  }

  const $pos = doc.resolve(blockPos);
  const nextNode = $pos.parent.child($pos.index() + 1);
  const nextEnd = blockPos + blockNode.nodeSize + nextNode.nodeSize;

  const tr = view.state.tr.replaceWith(
    blockPos,
    nextEnd,
    Fragment.from([nextNode, blockNode])
  );
  const newBlockPos = blockPos + nextNode.nodeSize;
  selectMovedOrCopiedBlock(tr, newBlockPos, blockNode);
  view.dispatch(tr.scrollIntoView());
  return true;
}

/**
 * 指定位置のブロックを直後に複製する。
 */
export function duplicateBlock(view: EditorView, blockPos: number): boolean {
  const { doc } = view.state;
  if (blockPos < 0 || blockPos >= doc.content.size) {
    return false;
  }

  const blockNode = doc.nodeAt(blockPos);
  if (!blockNode) {
    return false;
  }

  const $pos = doc.resolve(blockPos);
  if (!$pos.parent.canReplaceWith($pos.index() + 1, $pos.index() + 1, blockNode.type)) {
    return false;
  }

  const blockEnd = blockPos + blockNode.nodeSize;
  const copy = blockNode.copy(blockNode.content);
  const tr = view.state.tr.insert(blockEnd, copy);
  selectMovedOrCopiedBlock(tr, blockEnd, copy);
  view.dispatch(tr.scrollIntoView());
  return true;
}

/**
 * 指定位置のブロックを削除する。単独の子しか持たないラッパーは空にせず親ごと取り除き、
 * 文書全体が1ブロックだけのときは空の段落へ置き換える。
 */
export function deleteBlock(view: EditorView, blockPos: number): boolean {
  const { doc } = view.state;
  if (blockPos < 0 || blockPos >= doc.content.size) {
    return false;
  }

  const blockNode = doc.nodeAt(blockPos);
  if (!blockNode) {
    return false;
  }

  let delFrom = blockPos;
  let delTo = blockPos + blockNode.nodeSize;
  let $cur = doc.resolve(delFrom);

  while ($cur.depth > 0 && $cur.parent.childCount === 1) {
    delFrom = $cur.before($cur.depth);
    delTo = $cur.after($cur.depth);
    $cur = doc.resolve(delFrom);
  }

  if ($cur.depth === 0 && doc.childCount === 1) {
    const emptyParagraph = doc.type.schema.nodes.paragraph.create();
    const tr = view.state.tr.replaceWith(delFrom, delTo, emptyParagraph);
    tr.setSelection(TextSelection.create(tr.doc, delFrom + 1));
    view.dispatch(tr.scrollIntoView());
    return true;
  }

  const tr = view.state.tr.delete(delFrom, delTo);
  const clampPos = Math.min(delFrom, tr.doc.content.size);
  tr.setSelection(Selection.near(tr.doc.resolve(clampPos)));
  view.dispatch(tr.scrollIntoView());
  return true;
}

function prepareTargetParagraph(
  ctx: Ctx,
  target: BlockInsertTarget
): void {
  const view = ctx.get(editorViewCtx);
  const paragraphType = paragraphSchema.type(ctx);

  if (target.mode === 'slash') {
    const tr = view.state.tr.delete(target.from, target.to);
    tr.setSelection(TextSelection.create(tr.doc, target.from));
    view.dispatch(tr);
    return;
  }

  const { doc } = view.state;
  if (target.blockPos >= 0 && target.blockPos < doc.content.size) {
    const blockNode = doc.nodeAt(target.blockPos);
    if (blockNode) {
      const $pos = doc.resolve(target.blockPos);
      if (
        $pos.depth === 0 &&
        blockNode.type === paragraphType &&
        blockNode.content.size === 0
      ) {
        const tr = view.state.tr.setSelection(
          TextSelection.create(doc, target.blockPos + 1)
        );
        view.dispatch(tr);
        return;
      }

      const afterTopPos =
        $pos.depth === 0 ? target.blockPos + blockNode.nodeSize : $pos.after(1);
      const tr = view.state.tr.insert(afterTopPos, paragraphType.create());
      tr.setSelection(TextSelection.create(tr.doc, afterTopPos + 1));
      view.dispatch(tr.scrollIntoView());
      return;
    }
  }

  const endPos = doc.content.size;
  const tr = view.state.tr.insert(endPos, paragraphType.create());
  tr.setSelection(TextSelection.create(tr.doc, endPos + 1));
  view.dispatch(tr.scrollIntoView());
}

/**
 * 挿入メニューまたはスラッシュコマンドからブロックを挿入する。
 */
export function insertBlockFromMenu(
  ctx: Ctx,
  itemId: BlockInsertItemId,
  target: BlockInsertTarget,
  onOpenNewMermaid?: () => void
): boolean {
  prepareTargetParagraph(ctx, target);
  const view = ctx.get(editorViewCtx);
  const paragraphType = paragraphSchema.type(ctx);

  let handled = false;
  switch (itemId) {
    case 'heading1':
    case 'heading2':
    case 'heading3': {
      const level = itemId === 'heading1' ? 1 : itemId === 'heading2' ? 2 : 3;
      handled = setBlockType(headingSchema.type(ctx), { level })(
        view.state,
        view.dispatch
      );
      break;
    }
    case 'bulletList': {
      handled = callCommand(wrapInBulletListCommand.key)(ctx);
      break;
    }
    case 'orderedList': {
      handled = callCommand(wrapInOrderedListCommand.key)(ctx);
      break;
    }
    case 'taskList': {
      const wrapped = callCommand(wrapInBulletListCommand.key)(ctx);
      if (wrapped) {
        const itemType = listItemSchema.type(ctx);
        const { $from } = view.state.selection;
        for (let d = $from.depth; d > 0; d -= 1) {
          if ($from.node(d).type === itemType) {
            const pos = $from.before(d);
            const node = $from.node(d);
            view.dispatch(
              view.state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                checked: false,
              })
            );
            break;
          }
        }
      }
      handled = wrapped;
      break;
    }
    case 'blockquote': {
      handled = callCommand(wrapInBlockquoteCommand.key)(ctx);
      break;
    }
    case 'codeBlock': {
      handled = callCommand(createCodeBlockCommand.key)(ctx);
      break;
    }
    case 'table': {
      handled = callCommand(insertTableCommand.key, { row: 3, col: 3 })(ctx);
      break;
    }
    case 'divider': {
      const { $from } = view.state.selection;
      const start = $from.before();
      const end = $from.after();
      const nodes = Fragment.from([
        hrSchema.type(ctx).create(),
        paragraphType.create(),
      ]);
      const tr = view.state.tr.replaceWith(start, end, nodes);
      tr.setSelection(TextSelection.create(tr.doc, start + 2));
      view.dispatch(tr.scrollIntoView());
      handled = true;
      break;
    }
    case 'mermaid': {
      if (onOpenNewMermaid) {
        onOpenNewMermaid();
        return true;
      }
      const cbType = codeBlockSchema.type(ctx);
      const blockNode = cbType.create(
        { language: 'mermaid' },
        view.state.schema.text(DEFAULT_MERMAID_SNIPPET)
      );
      view.dispatch(
        view.state.tr.replaceSelectionWith(blockNode).scrollIntoView()
      );
      handled = true;
      break;
    }
  }

  view.focus();
  return handled;
}
