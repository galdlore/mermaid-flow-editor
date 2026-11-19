import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTabIndentEdit } from './markdownTabIndent.ts';

test('computeTabIndentEdit inserts configured spaces at collapsed cursor', () => {
  const res2 = computeTabIndentEdit('hello world', 5, 5, 2, false);
  assert.equal(res2.nextValue, 'hello   world');
  assert.equal(res2.nextStart, 7);
  assert.equal(res2.nextEnd, 7);

  const res4 = computeTabIndentEdit('abc', 0, 0, 4, false);
  assert.equal(res4.nextValue, '    abc');
  assert.equal(res4.nextStart, 4);
  assert.equal(res4.nextEnd, 4);
});

test('computeTabIndentEdit indents and outdents multi-line selections cleanly', () => {
  const doc = 'line1\nline2\nline3';
  const indented = computeTabIndentEdit(doc, 0, doc.length, 2, false);
  assert.equal(indented.nextValue, '  line1\n  line2\n  line3');
  assert.equal(indented.nextStart, 2);
  assert.equal(indented.nextEnd, doc.length + 6);

  const outdented = computeTabIndentEdit(
    indented.nextValue,
    indented.nextStart,
    indented.nextEnd,
    2,
    true
  );
  assert.equal(outdented.nextValue, doc);
  assert.equal(outdented.nextStart, 0);
  assert.equal(outdented.nextEnd, doc.length);
});

test('computeTabIndentEdit removes leading tabs on Shift+Tab and clamps cursor to line start', () => {
  const tabDoc = '\talpha\n beta\ngamma';
  const outdented = computeTabIndentEdit(tabDoc, 2, 10, 4, true);
  assert.equal(outdented.nextValue, 'alpha\nbeta\ngamma');
  assert.equal(outdented.nextStart, 1);
  assert.equal(outdented.nextEnd, 8);

  const singleLine = '  hi';
  const clamped = computeTabIndentEdit(singleLine, 1, 1, 4, true);
  assert.equal(clamped.nextValue, 'hi');
  assert.equal(clamped.nextStart, 0);
  assert.equal(clamped.nextEnd, 0);
});
