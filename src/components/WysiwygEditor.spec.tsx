import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  rootCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { listener } from '@milkdown/kit/plugin/listener';
import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { I18nProvider } from '../i18n';
import { jaCatalog } from '../locales/ja';
import {
  BLOCK_INSERT_ITEM_DEFS,
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
import WysiwygEditor, {
  createExitEmptyContainerOnBackspacePlugin,
} from './WysiwygEditor';

if (typeof Range !== 'undefined') {
  if (typeof Range.prototype.getBoundingClientRect !== 'function') {
    Range.prototype.getBoundingClientRect = () =>
      ({
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
  }
  if (typeof Range.prototype.getClientRects !== 'function') {
    Range.prototype.getClientRects = () =>
      ({
        length: 0,
        item: () => null,
        [Symbol.iterator]: function* () {},
      }) as unknown as DOMRectList;
  }
}

vi.mock('../utils/mermaidRender', () => ({
  renderMermaidSvg: vi.fn().mockResolvedValue({ svg: '<svg></svg>', error: null }),
}));

const activeEditors: Editor[] = [];

async function createTestEditor(markdown: string): Promise<Editor> {
  const mountEl = document.createElement('div');
  document.body.appendChild(mountEl);

  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, mountEl);
      ctx.set(defaultValueCtx, markdown);
    })
    .use(commonmark)
    .use(gfm)
    .use(history)
    .use(listener)
    .use(createExitEmptyContainerOnBackspacePlugin())
    .create();

  activeEditors.push(editor);
  return editor;
}

function dispatchKey(view: EditorView, key: string): boolean {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  });
  return Boolean(view.someProp('handleKeyDown', (handler) => handler(view, event)));
}

function typeTextWithInputRules(view: EditorView, text: string): void {
  for (const ch of text) {
    const { from, to } = view.state.selection;
    const handled = view.someProp('handleTextInput', (handler) =>
      handler(view, from, to, ch, () => view.state.tr.insertText(ch, from, to))
    );
    if (!handled) {
      view.dispatch(view.state.tr.insertText(ch, from, to));
    }
  }
}

function findTextRange(
  view: EditorView,
  targetText: string
): { from: number; to: number } {
  let found: { from: number; to: number } | null = null;
  view.state.doc.descendants((node, pos) => {
    if (found) {
      return false;
    }
    if (node.isText && node.text === targetText) {
      found = { from: pos, to: pos + node.text.length };
      return false;
    }
    return true;
  });
  if (!found) {
    throw new Error(`Text "${targetText}" was not found in document`);
  }
  return found;
}

function setCursorAtText(
  view: EditorView,
  targetText: string,
  edge: 'start' | 'end'
): void {
  const range = findTextRange(view, targetText);
  const pos = edge === 'start' ? range.from : range.to;
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)));
}

function clearTextAndFocus(view: EditorView, targetText: string): void {
  const range = findTextRange(view, targetText);
  const tr = view.state.tr.delete(range.from, range.to);
  tr.setSelection(TextSelection.create(tr.doc, range.from));
  view.dispatch(tr);
}

function readEditorSnapshot(editor: Editor) {
  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const markdown = ctx.get(serializerCtx)(view.state.doc);
    const { $from } = view.state.selection;
    return {
      docString: view.state.doc.toString(),
      markdown,
      depth: $from.depth,
      parentType: $from.parent.type.name,
      parentText: $from.parent.textContent,
      parentAttrs: $from.parent.attrs,
    };
  });
}

afterEach(async () => {
  while (activeEditors.length > 0) {
    const editor = activeEditors.pop();
    if (editor) {
      await editor.destroy();
    }
  }
  document.body.innerHTML = '';
});

describe('WysiwygEditor Backspace exit behavior', () => {
  it('exits bullet list on Backspace after Enter, allows top-level ## heading, and joins back on second Backspace', async () => {
    const editor = await createTestEditor('- item1');
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      setCursorAtText(view, 'item1', 'end');
      dispatchKey(view, 'Enter');
      expect(dispatchKey(view, 'Backspace')).toBe(true);
    });

    const afterFirstBackspace = readEditorSnapshot(editor);
    expect(afterFirstBackspace.depth).toBe(1);
    expect(afterFirstBackspace.parentType).toBe('paragraph');
    expect(afterFirstBackspace.docString).toBe(
      'doc(bullet_list(list_item(paragraph("item1"))), paragraph)'
    );

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      typeTextWithInputRules(view, '## Title');
    });

    const afterHeading = readEditorSnapshot(editor);
    expect(afterHeading.depth).toBe(1);
    expect(afterHeading.parentType).toBe('heading');
    expect(afterHeading.parentAttrs.level).toBe(2);
    expect(afterHeading.markdown).toBe('* item1\n\n## Title\n');

    // 1回目の Backspace 直後に続けて 2回目を押し、直前の項目の末尾へ戻る挙動も確認する
    const editor2 = await createTestEditor('- item1');
    editor2.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      setCursorAtText(view, 'item1', 'end');
      dispatchKey(view, 'Enter');
      dispatchKey(view, 'Backspace');
      dispatchKey(view, 'Backspace');
    });
    const afterSecondBackspace = readEditorSnapshot(editor2);
    expect(afterSecondBackspace.docString).toBe(
      'doc(bullet_list(list_item(paragraph("item1"))))'
    );
    expect(afterSecondBackspace.depth).toBe(3);
  });

  it('exits ordered list on Backspace from an empty list item', async () => {
    const editor = await createTestEditor('1. item1');
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      setCursorAtText(view, 'item1', 'end');
      dispatchKey(view, 'Enter');
      expect(dispatchKey(view, 'Backspace')).toBe(true);
    });

    const snap = readEditorSnapshot(editor);
    expect(snap.depth).toBe(1);
    expect(snap.parentType).toBe('paragraph');
    expect(snap.docString).toBe(
      'doc(ordered_list(list_item(paragraph("item1"))), paragraph)'
    );
    expect(snap.markdown).toBe('1. item1\n');
  });

  it('exits task list on Backspace after Enter and when clearing an existing task item', async () => {
    const editorFromEnter = await createTestEditor('- [ ] task1');
    editorFromEnter.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      setCursorAtText(view, 'task1', 'end');
      dispatchKey(view, 'Enter');
      expect(dispatchKey(view, 'Backspace')).toBe(true);
    });

    const snapFromEnter = readEditorSnapshot(editorFromEnter);
    expect(snapFromEnter.depth).toBe(1);
    expect(snapFromEnter.parentType).toBe('paragraph');
    expect(snapFromEnter.markdown).toBe('* [ ] task1\n');

    const editorCleared = await createTestEditor('- [ ] t1\n- [ ] t2');
    editorCleared.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      clearTextAndFocus(view, 't2');
      expect(dispatchKey(view, 'Backspace')).toBe(true);
    });

    const snapCleared = readEditorSnapshot(editorCleared);
    expect(snapCleared.depth).toBe(1);
    expect(snapCleared.parentType).toBe('paragraph');
    expect(snapCleared.markdown).toBe('* [ ] t1\n');
  });

  it('lifts nested bullet list one level per Backspace press', async () => {
    const editor = await createTestEditor('- item1\n  - sub1');
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      setCursorAtText(view, 'sub1', 'end');
      dispatchKey(view, 'Enter');
      expect(dispatchKey(view, 'Backspace')).toBe(true);
    });

    const afterFirst = readEditorSnapshot(editor);
    expect(afterFirst.depth).toBe(3);
    expect(afterFirst.parentType).toBe('paragraph');

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      expect(dispatchKey(view, 'Backspace')).toBe(true);
    });

    const afterSecond = readEditorSnapshot(editor);
    expect(afterSecond.depth).toBe(1);
    expect(afterSecond.parentType).toBe('paragraph');
    expect(afterSecond.markdown).toBe('* item1\n  * sub1\n');
  });

  it('exits blockquotes one level per Backspace across end, single-empty, nested, and middle positions', async () => {
    const editorEnd = await createTestEditor('> quote1');
    editorEnd.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      setCursorAtText(view, 'quote1', 'end');
      dispatchKey(view, 'Enter');
      expect(dispatchKey(view, 'Backspace')).toBe(true);
    });
    const snapEnd = readEditorSnapshot(editorEnd);
    expect(snapEnd.depth).toBe(1);
    expect(snapEnd.docString).toBe('doc(blockquote(paragraph("quote1")), paragraph)');

    const editorSingle = await createTestEditor('> ');
    editorSingle.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 2)));
      expect(dispatchKey(view, 'Backspace')).toBe(true);
    });
    const snapSingle = readEditorSnapshot(editorSingle);
    expect(snapSingle.depth).toBe(1);
    expect(snapSingle.docString).toBe('doc(paragraph)');
    expect(snapSingle.markdown).toBe('');

    const editorNested = await createTestEditor('> > q');
    editorNested.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      setCursorAtText(view, 'q', 'end');
      dispatchKey(view, 'Enter');
      expect(dispatchKey(view, 'Backspace')).toBe(true);
    });
    const snapNestedFirst = readEditorSnapshot(editorNested);
    expect(snapNestedFirst.depth).toBe(2);
    expect(snapNestedFirst.docString).toBe(
      'doc(blockquote(blockquote(paragraph("q")), paragraph))'
    );

    editorNested.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      expect(dispatchKey(view, 'Backspace')).toBe(true);
    });
    const snapNestedSecond = readEditorSnapshot(editorNested);
    expect(snapNestedSecond.depth).toBe(1);
    expect(snapNestedSecond.docString).toBe(
      'doc(blockquote(blockquote(paragraph("q"))), paragraph)'
    );

    const editorMiddle = await createTestEditor('> q1\n>\n> q2');
    editorMiddle.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      setCursorAtText(view, 'q1', 'end');
      dispatchKey(view, 'Enter');
      expect(dispatchKey(view, 'Backspace')).toBe(true);
    });
    const snapMiddle = readEditorSnapshot(editorMiddle);
    expect(snapMiddle.depth).toBe(1);
    expect(snapMiddle.docString).toBe(
      'doc(blockquote(paragraph("q1")), paragraph, blockquote(paragraph("q2")))'
    );
  });

  it('exits list inside blockquote to blockquote on 1st Backspace and to document on 2nd Backspace', async () => {
    const editor = await createTestEditor('> - item1');
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      setCursorAtText(view, 'item1', 'end');
      dispatchKey(view, 'Enter');
      expect(dispatchKey(view, 'Backspace')).toBe(true);
    });

    const afterFirst = readEditorSnapshot(editor);
    expect(afterFirst.depth).toBe(2);
    expect(afterFirst.docString).toBe(
      'doc(blockquote(bullet_list(list_item(paragraph("item1"))), paragraph))'
    );

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      expect(dispatchKey(view, 'Backspace')).toBe(true);
    });

    const afterSecond = readEditorSnapshot(editor);
    expect(afterSecond.depth).toBe(1);
    expect(afterSecond.docString).toBe(
      'doc(blockquote(bullet_list(list_item(paragraph("item1")))), paragraph)'
    );
  });

  it('lifts only the empty secondary paragraph out of a multi-paragraph list item', async () => {
    const editor = await createTestEditor('- item1\n\n  item2');
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      clearTextAndFocus(view, 'item2');
      expect(dispatchKey(view, 'Backspace')).toBe(true);
    });

    const snap = readEditorSnapshot(editor);
    expect(snap.depth).toBe(1);
    expect(snap.docString).toBe(
      'doc(bullet_list(list_item(paragraph("item1"))), paragraph)'
    );
    expect(snap.markdown).toBe('* item1\n');
  });

  it('preserves default Backspace behavior for non-empty items, empty headings, and empty parent items with nested lists', async () => {
    const nonEmptyEditor = await createTestEditor('- item1\n- item2');
    nonEmptyEditor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      setCursorAtText(view, 'item2', 'start');
      dispatchKey(view, 'Backspace');
    });
    const nonEmptySnap = readEditorSnapshot(nonEmptyEditor);
    expect(nonEmptySnap.depth).toBe(3);
    expect(nonEmptySnap.docString).toBe(
      'doc(bullet_list(list_item(paragraph("item1"), paragraph("item2"))))'
    );

    const headingEditor = await createTestEditor('## ');
    headingEditor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)));
      dispatchKey(view, 'Backspace');
    });
    const headingSnap = readEditorSnapshot(headingEditor);
    expect(headingSnap.parentType).toBe('heading');
    expect(headingSnap.parentAttrs.level).toBe(1);

    const nestedChildEditor = await createTestEditor('- parent\n  - sub1');
    nestedChildEditor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      clearTextAndFocus(view, 'parent');
      dispatchKey(view, 'Backspace');
    });
    const nestedChildSnap = readEditorSnapshot(nestedChildEditor);
    expect(nestedChildSnap.docString).toBe(
      'doc(bullet_list(list_item(paragraph, bullet_list(list_item(paragraph("sub1"))))))'
    );
  });

  it('mounts and unmounts WysiwygEditor cleanly without errors', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const onChange = vi.fn();
      const onEditMermaid = vi.fn();
      const { container, unmount } = render(
        <I18nProvider>
          <WysiwygEditor
            value="- item1"
            onChange={onChange}
            onEditMermaid={onEditMermaid}
          />
        </I18nProvider>
      );

      await waitFor(() => {
        const pm = container.querySelector('.ProseMirror');
        expect(pm).not.toBeNull();
        expect(pm?.textContent).toContain('item1');
      });

      unmount();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});

describe('wysiwygBlockActions helpers', () => {
  it('moves, duplicates, and deletes paragraphs, list items, and mermaid blocks safely', async () => {
    const editor = await createTestEditor(
      'first\n\n```mermaid\nflowchart TD\n  A --> B\n```\n\nlast'
    );
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const doc = view.state.doc;
      const pos0 = 0;
      const pos1 = doc.child(0).nodeSize;
      const pos2 = pos1 + doc.child(1).nodeSize;

      expect(canMoveBlockUp(doc, pos0)).toBe(false);
      expect(canMoveBlockDown(doc, pos0)).toBe(true);
      expect(canMoveBlockUp(doc, pos2)).toBe(true);
      expect(canMoveBlockDown(doc, pos2)).toBe(false);

      expect(moveBlockUp(view, pos1)).toBe(true);
      expect(view.state.doc.child(0).type.name).toBe('code_block');
      expect(view.state.doc.child(1).textContent).toBe('first');

      expect(moveBlockDown(view, 0)).toBe(true);
      expect(view.state.doc.child(0).textContent).toBe('first');
      expect(view.state.doc.child(1).type.name).toBe('code_block');

      const mermaidPos = view.state.doc.child(0).nodeSize;
      expect(duplicateBlock(view, mermaidPos)).toBe(true);
      expect(view.state.doc.childCount).toBe(4);
      expect(view.state.doc.child(2).type.name).toBe('code_block');

      expect(deleteBlock(view, mermaidPos)).toBe(true);
      expect(view.state.doc.childCount).toBe(3);
    });

    const listEditor = await createTestEditor('- alpha\n- beta');
    listEditor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const list = view.state.doc.child(0);
      const secondItemPos = 1 + list.child(0).nodeSize;

      expect(moveBlockUp(view, secondItemPos)).toBe(true);
      expect(view.state.doc.child(0).child(0).textContent).toBe('beta');

      expect(duplicateBlock(view, 1)).toBe(true);
      expect(view.state.doc.child(0).childCount).toBe(3);

      expect(deleteBlock(view, 1)).toBe(true);
      expect(deleteBlock(view, 1)).toBe(true);
      expect(view.state.doc.child(0).childCount).toBe(1);

      // リスト最後の1項目を削除すると親の bullet_list も除去され、空段落が1つ残る
      expect(deleteBlock(view, 1)).toBe(true);
      expect(view.state.doc.toString()).toBe('doc(paragraph)');
    });
  });

  it('inserts every block menu type cleanly for after-block and slash targets', async () => {
    const emptyEditor = await createTestEditor('');
    emptyEditor.action((ctx) => {
      expect(
        insertBlockFromMenu(ctx, 'heading2', { mode: 'after-block', blockPos: 0 })
      ).toBe(true);
      const view = ctx.get(editorViewCtx);
      expect(view.state.doc.childCount).toBe(1);
      expect(view.state.doc.child(0).type.name).toBe('heading');
      expect(view.state.doc.child(0).attrs.level).toBe(2);
    });

    const listEditor = await createTestEditor('- item1');
    listEditor.action((ctx) => {
      // list_item (pos 1) から挿入すると、リストの外側にトップレベル要素として挿入される
      expect(
        insertBlockFromMenu(ctx, 'table', { mode: 'after-block', blockPos: 1 })
      ).toBe(true);
      const view = ctx.get(editorViewCtx);
      expect(view.state.doc.child(0).type.name).toBe('bullet_list');
      expect(view.state.doc.child(1).type.name).toBe('table');
    });

    const typesEditor = await createTestEditor('anchor');
    typesEditor.action((ctx) => {
      const itemsToInsert = [
        'heading1',
        'heading3',
        'bulletList',
        'orderedList',
        'taskList',
        'codeBlock',
        'blockquote',
        'divider',
        'mermaid',
      ] as const;

      for (const itemId of itemsToInsert) {
        const view = ctx.get(editorViewCtx);
        const lastIdx = view.state.doc.childCount - 1;
        let lastPos = 0;
        for (let i = 0; i < lastIdx; i += 1) {
          lastPos += view.state.doc.child(i).nodeSize;
        }
        expect(
          insertBlockFromMenu(ctx, itemId, { mode: 'after-block', blockPos: lastPos })
        ).toBe(true);
      }

      const doc = ctx.get(editorViewCtx).state.doc;
      expect(doc.child(1).type.name).toBe('heading');
      expect(doc.child(1).attrs.level).toBe(1);
      expect(doc.child(2).type.name).toBe('heading');
      expect(doc.child(2).attrs.level).toBe(3);

      const md = ctx.get(serializerCtx)(doc);
      expect(md).toContain('#\n');
      expect(md).toContain('###\n');
      expect(md).toContain('* [ ]');
      expect(md).toContain('```mermaid');
      expect(md).toContain('***');
      expect(md).toContain('>');
    });

    const slashEditor = await createTestEditor('/table');
    slashEditor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      setCursorAtText(view, '/table', 'end');
      const match = detectSlashCommand(view.state);
      expect(match).not.toBeNull();
      const onOpenNewMermaid = vi.fn();
      expect(
        insertBlockFromMenu(
          ctx,
          'mermaid',
          { mode: 'slash', from: match!.from, to: match!.to },
          onOpenNewMermaid
        )
      ).toBe(true);
      expect(onOpenNewMermaid).toHaveBeenCalledTimes(1);
      expect(view.state.doc.toString()).toBe('doc(paragraph)');
    });
  });

  it('detects slash commands and filters block items across Japanese and English keywords', async () => {
    const resolvedItems = BLOCK_INSERT_ITEM_DEFS.map((def) => ({
      id: def.id,
      label: jaCatalog.editor[def.labelKey],
      shortcutHint: def.shortcutHint,
      keywords: def.keywords,
    }));

    expect(filterBlockInsertItems(resolvedItems, '').length).toBe(
      BLOCK_INSERT_ITEM_DEFS.length
    );
    expect(filterBlockInsertItems(resolvedItems, '表').map((x) => x.id)).toContain(
      'table'
    );
    expect(filterBlockInsertItems(resolvedItems, 'mer').map((x) => x.id)).toEqual([
      'mermaid',
    ]);
    expect(filterBlockInsertItems(resolvedItems, 'h2').map((x) => x.id)).toEqual([
      'heading2',
    ]);

    const slashStart = await createTestEditor('/表');
    slashStart.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      setCursorAtText(view, '/表', 'end');
      const match = detectSlashCommand(view.state);
      expect(match).toEqual({ query: '表', from: 1, to: 3 });
    });

    const slashSpace = await createTestEditor('/ foo');
    slashSpace.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      setCursorAtText(view, '/ foo', 'end');
      expect(detectSlashCommand(view.state)).toBeNull();
    });

    const slashMid = await createTestEditor('hello /table');
    slashMid.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      setCursorAtText(view, 'hello /table', 'end');
      expect(detectSlashCommand(view.state)).toBeNull();
    });

    const slashCode = await createTestEditor('```\n/mermaid\n```');
    slashCode.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      setCursorAtText(view, '/mermaid', 'end');
      expect(detectSlashCommand(view.state)).toBeNull();
    });
  });
});

describe('WysiwygEditor block handle and menu UI', () => {
  it('opens insert menu from + button, filters items, inserts table and triggers Mermaid modal', async () => {
    const onChange = vi.fn();
    const onEditMermaid = vi.fn();
    const onOpenNewMermaid = vi.fn();
    const { container } = render(
      <I18nProvider>
        <WysiwygEditor
          value="hello"
          onChange={onChange}
          onEditMermaid={onEditMermaid}
          onOpenNewMermaid={onOpenNewMermaid}
        />
      </I18nProvider>
    );

    const plusBtn = await waitFor(() => {
      const btn = container.querySelector(
        '.wysiwyg-block-plus-btn'
      ) as HTMLButtonElement | null;
      expect(btn).not.toBeNull();
      return btn!;
    });

    fireEvent.click(plusBtn);
    const searchInput = await screen.findByPlaceholderText(
      jaCatalog.editor.blockMenuSearchPlaceholder
    );
    fireEvent.change(searchInput, { target: { value: '表' } });

    const tableItem = screen.getByRole('menuitem', {
      name: new RegExp(
        jaCatalog.editor.blockItemTable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      ),
    });
    fireEvent.click(tableItem);

    await waitFor(() => {
      expect(container.querySelector('table')).not.toBeNull();
      expect(onChange).toHaveBeenCalled();
    });

    // 再度 + ボタンから Mermaid図 (GUI作成) を選択すると新規モーダル用コールバックが呼ばれる
    fireEvent.click(plusBtn);
    const mermaidItem = await screen.findByRole('menuitem', {
      name: /Mermaid図/,
    });
    fireEvent.click(mermaidItem);
    expect(onOpenNewMermaid).toHaveBeenCalledTimes(1);
  });

  it('opens block action menu from drag handle click and duplicates block', async () => {
    const onChange = vi.fn();
    const onEditMermaid = vi.fn();
    const { container } = render(
      <I18nProvider>
        <WysiwygEditor
          value="alpha"
          onChange={onChange}
          onEditMermaid={onEditMermaid}
        />
      </I18nProvider>
    );

    const dragBtn = await waitFor(() => {
      const btn = container.querySelector(
        '.wysiwyg-block-drag-btn'
      ) as HTMLButtonElement | null;
      expect(btn).not.toBeNull();
      return btn!;
    });

    fireEvent.click(dragBtn);
    expect(
      await screen.findByRole('menuitem', { name: jaCatalog.editor.blockActionMoveUp })
    ).toBeDisabled();
    expect(
      screen.getByRole('menuitem', { name: jaCatalog.editor.blockActionMoveDown })
    ).toBeDisabled();
    const duplicateBtn = screen.getByRole('menuitem', {
      name: jaCatalog.editor.blockActionDuplicate,
    });
    expect(
      screen.getByRole('menuitem', { name: jaCatalog.editor.blockActionDelete })
    ).toBeInTheDocument();

    fireEvent.click(duplicateBtn);
    await waitFor(() => {
      const paragraphs = container.querySelectorAll('.ProseMirror > p');
      expect(paragraphs.length).toBe(2);
      expect(onChange).toHaveBeenCalledWith('alpha\n\nalpha\n');
    });
  });
});
