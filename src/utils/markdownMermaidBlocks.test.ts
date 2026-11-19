import test from 'node:test';
import assert from 'node:assert/strict';
import { extractMermaidBlocks, replaceMermaidBlock } from './markdownMermaidBlocks.ts';

test('extractMermaidBlocks parses backtick and tilde fences while ignoring non-mermaid blocks', () => {
  const md = [
    '# Title',
    '',
    '```typescript',
    'const x = 1;',
    '```',
    '',
    '  ```mermaid',
    '  flowchart TD',
    '    A --> B',
    '  ```',
    '',
    '~~~MERMAID',
    'pie',
    '  "A" : 10',
    '~~~',
  ].join('\n');

  const blocks = extractMermaidBlocks(md);
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks[0], {
    index: 0,
    startLine: 7,
    endLine: 10,
    code: '  flowchart TD\n    A --> B',
  });
  assert.deepEqual(blocks[1], {
    index: 1,
    startLine: 12,
    endLine: 15,
    code: 'pie\n  "A" : 10',
  });
});

test('extractMermaidBlocks handles unclosed mermaid fences and backticks in info strings', () => {
  const md = [
    '```js `ignored',
    '```mermaid',
    'flowchart LR',
    '  X --> Y',
  ].join('\n');

  const blocks = extractMermaidBlocks(md);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].code, 'flowchart LR\n  X --> Y');
});

test('replaceMermaidBlock replaces targeted block preserving indent and ignores out-of-range indices', () => {
  const md = [
    'Intro',
    '  ```mermaid',
    '  flowchart TD',
    '    A --> B',
    '  ```',
    '',
    '```mermaid',
    'pie',
    '  "One" : 1',
    '```',
    'Outro',
  ].join('\n');

  const replacedFirst = replaceMermaidBlock(md, 0, 'flowchart LR\n  C --> D');
  assert.equal(
    replacedFirst,
    [
      'Intro',
      '  ```mermaid',
      'flowchart LR',
      '  C --> D',
      '  ```',
      '',
      '```mermaid',
      'pie',
      '  "One" : 1',
      '```',
      'Outro',
    ].join('\n')
  );

  assert.equal(replaceMermaidBlock(md, 99, 'flowchart TD'), md);
  assert.equal(replaceMermaidBlock(md, -1, 'flowchart TD'), md);
});
