import test from 'node:test';
import assert from 'node:assert/strict';
import { computeListContinueEdit } from './markdownListContinue.ts';

test('bullet list continues with same indent and marker, and exits on empty item', () => {
  const doc = '  * first item';
  const cont = computeListContinueEdit(doc, doc.length, doc.length);
  assert.ok(cont);
  assert.equal(cont.nextValue, '  * first item\n  * ');
  assert.equal(cont.nextStart, cont.nextValue.length);
  assert.equal(cont.nextEnd, cont.nextValue.length);

  const exit = computeListContinueEdit(cont.nextValue, cont.nextStart, cont.nextEnd);
  assert.ok(exit);
  assert.equal(exit.nextValue, '  * first item\n');
  assert.equal(exit.nextStart, '  * first item\n'.length);
});

test('task list always continues with unchecked checkbox and exits on empty task item', () => {
  const doc = '- [x] completed task';
  const cont = computeListContinueEdit(doc, doc.length, doc.length);
  assert.ok(cont);
  assert.equal(cont.nextValue, '- [x] completed task\n- [ ] ');
  assert.equal(cont.nextStart, cont.nextValue.length);

  const exit = computeListContinueEdit(cont.nextValue, cont.nextStart, cont.nextEnd);
  assert.ok(exit);
  assert.equal(exit.nextValue, '- [x] completed task\n');
});

test('ordered list increments number and renumbers contiguous following items', () => {
  const doc = '1. alpha\n2. beta\n3. gamma\n\n1. separate block\n2. next block';
  const endOfFirst = '1. alpha'.length;
  const result = computeListContinueEdit(doc, endOfFirst, endOfFirst);
  assert.ok(result);
  assert.equal(
    result.nextValue,
    '1. alpha\n2. \n3. beta\n4. gamma\n\n1. separate block\n2. next block'
  );
  assert.equal(result.nextStart, '1. alpha\n2. '.length);
});

test('ordered list renumbers past nested child items without altering nested numbering', () => {
  const doc = '1. parent one\n  - nested bullet\n  1. nested one\n2. parent two\n3. parent three';
  const endOfFirst = '1. parent one'.length;
  const result = computeListContinueEdit(doc, endOfFirst, endOfFirst);
  assert.ok(result);
  assert.equal(
    result.nextValue,
    '1. parent one\n2. \n  - nested bullet\n  1. nested one\n3. parent two\n4. parent three'
  );
});

test('empty ordered item splits list and renumbers following contiguous items from 1', () => {
  const doc = '1. first\n2. \n3. second\n4) third';
  const endOfEmpty = '1. first\n2. '.length;
  const result = computeListContinueEdit(doc, endOfEmpty, endOfEmpty);
  assert.ok(result);
  assert.equal(result.nextValue, '1. first\n\n1. second\n2) third');
  assert.equal(result.nextStart, '1. first\n'.length);
});

test('splitting text in the middle of an ordered item places trailing text on the new line', () => {
  const doc = '1. hello world\n2. next';
  const cursor = '1. hello '.length;
  const result = computeListContinueEdit(doc, cursor, cursor);
  assert.ok(result);
  assert.equal(result.nextValue, '1. hello \n2. world\n3. next');
  assert.equal(result.nextStart, '1. hello \n2. '.length);
});

test('returns null before marker, inside code fence, on multi-line selection, or on plain text', () => {
  assert.equal(computeListContinueEdit('- item', 0, 0), null);
  assert.equal(computeListContinueEdit('- item', 1, 1), null);
  assert.equal(computeListContinueEdit('plain line', 10, 10), null);
  assert.equal(computeListContinueEdit('- a\n- b', 2, 5), null);

  const fenced = '```mermaid\nflowchart TD\n- not a list\n```\n- real list';
  const insideFencePos = fenced.indexOf('- not a list') + '- not a list'.length;
  assert.equal(computeListContinueEdit(fenced, insideFencePos, insideFencePos), null);

  const outsideFencePos = fenced.length;
  const outsideResult = computeListContinueEdit(fenced, outsideFencePos, outsideFencePos);
  assert.ok(outsideResult);
  assert.equal(outsideResult.nextValue, `${fenced}\n- `);
});
