import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { extractMarkdownFilePathsFromArgv } from './launchArgs.ts';

test('extractMarkdownFilePathsFromArgv extracts packaged Windows markdown paths and quoted paths', () => {
  const result = extractMarkdownFilePathsFromArgv(
    [
      'C:\\Program Files\\Mermaid Markdown Editor\\Mermaid Markdown Editor.exe',
      'C:\\docs\\sample.md',
      '"D:\\notes\\design spec.markdown"',
    ],
    { isPackaged: true, isDefaultApp: false, platform: 'win32' }
  );

  assert.deepEqual(result, [
    path.resolve('C:\\docs\\sample.md'),
    path.resolve('D:\\notes\\design spec.markdown'),
  ]);
});

test('extractMarkdownFilePathsFromArgv skips app entry arg in dev defaultApp mode', () => {
  const result = extractMarkdownFilePathsFromArgv(
    ['node.exe', '.', 'docs/readme.md'],
    {
      isPackaged: false,
      isDefaultApp: true,
      workingDirectory: 'E:\\workspace',
      platform: 'win32',
    }
  );

  assert.deepEqual(result, [path.resolve('E:\\workspace', 'docs/readme.md')]);
});

test('extractMarkdownFilePathsFromArgv ignores flags before -- and accepts paths after --', () => {
  const result = extractMarkdownFilePathsFromArgv(
    [
      'app.exe',
      '--updated',
      '--force-run',
      '--allow-file-access-from-files',
      '--',
      '-leading-dash.md',
      'normal.txt',
    ],
    { isPackaged: true, workingDirectory: 'E:\\docs', platform: 'win32' }
  );

  assert.deepEqual(result, [
    path.resolve('E:\\docs', '-leading-dash.md'),
    path.resolve('E:\\docs', 'normal.txt'),
  ]);
});

test('extractMarkdownFilePathsFromArgv converts file URLs, filters unsupported extensions, and deduplicates case-insensitively on win32', () => {
  const result = extractMarkdownFilePathsFromArgv(
    [
      'app.exe',
      'file:///C:/docs/Spec.md',
      'c:\\docs\\spec.MD',
      'C:\\docs\\config.json',
      'C:\\docs\\installer.exe',
    ],
    { isPackaged: true, platform: 'win32' }
  );

  assert.deepEqual(result, [path.resolve('C:\\docs\\Spec.md')]);
});
