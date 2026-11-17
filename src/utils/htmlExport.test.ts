import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExportDocumentTitle,
  buildExportHtmlDocument,
  buildHtmlFileName,
  buildPdfFileName,
  escapeHtml,
} from './htmlExport.ts';

test('escapeHtml escapes HTML meta-characters', () => {
  assert.equal(
    escapeHtml(`<script>alert("x&'y")</script>`),
    '&lt;script&gt;alert(&quot;x&amp;&#39;y&quot;)&lt;/script&gt;'
  );
});

test('buildExportDocumentTitle, buildHtmlFileName, and buildPdfFileName strip markdown extensions', () => {
  assert.equal(buildExportDocumentTitle('C:\\docs\\design.md', '無題.md'), 'design');
  assert.equal(buildHtmlFileName('/tmp/spec.markdown', '無題.md'), 'spec.html');
  assert.equal(buildHtmlFileName(null, '無題.md'), '無題.html');
  assert.equal(buildHtmlFileName('README', 'Untitled.md'), 'README.html');
  assert.equal(buildPdfFileName('C:\\docs\\design.md', '無題.md'), 'design.pdf');
  assert.equal(buildPdfFileName(null, 'Untitled.md'), 'Untitled.pdf');
});

test('buildExportHtmlDocument produces standalone HTML with escaped title and embedded styles', () => {
  const html = buildExportHtmlDocument({
    title: '仕様 <v1> & "メモ"',
    lang: 'ja',
    bodyHtml: '<h1>見出し</h1><div class="mermaid-svg-container"><svg></svg></div>',
  });

  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<html lang="ja">/);
  assert.match(html, /<title>仕様 &lt;v1&gt; &amp; &quot;メモ&quot;<\/title>/);
  assert.match(html, /<style>[\s\S]*\.mermaid-preview-card[\s\S]*@media print[\s\S]*<\/style>/);
  assert.match(html, /<article class="markdown-preview-body">[\s\S]*<h1>見出し<\/h1>/);
});
