import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allocateUniqueId,
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
  sanitizeYamlSingleQuoted,
  unquoteYamlString,
} from './mermaidEnvelope.ts';

test('extractGuiStateJson validates parsed JSON and skips invalid or malformed lines', () => {
  interface SampleState {
    count: number;
  }
  const isSample = (val: unknown): val is SampleState =>
    typeof val === 'object' &&
    val !== null &&
    typeof (val as SampleState).count === 'number';

  const line = formatGuiStateLine({ count: 3 });
  assert.equal(line, '%% @gui-state: {"count":3}');

  const valid = extractGuiStateJson(['flowchart TD', '%% @gui-state: {broken}', line], isSample);
  assert.deepEqual(valid, { count: 3 });

  const rejectedType = extractGuiStateJson(['%% @gui-state: {"count":"bad"}'], isSample);
  assert.equal(rejectedType, null);
});

test('comment, YAML quoting, and unique ID helpers normalize safely', () => {
  assert.equal(sanitizeSingleLineComment('  line1\r\nline2\n '), 'line1 line2');
  assert.equal(sanitizeYamlSingleQuoted("it's\na 'test'"), "it''s a ''test''");
  assert.equal(unquoteYamlString(" 'it''s ok' "), "it's ok");
  assert.equal(unquoteYamlString('"quoted"'), 'quoted');
  assert.equal(unquoteYamlString('plain'), 'plain');

  const used = new Set(['node', 'node_2']);
  assert.equal(allocateUniqueId('node', used), 'node_3');
  assert.equal(allocateUniqueId('item', used), 'item');
  assert.equal(used.has('node_3'), true);
  assert.equal(used.has('item'), true);
});
