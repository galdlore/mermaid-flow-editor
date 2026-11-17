import { getTabBaseFileName } from './documentTabs.ts';

export interface ExportHtmlDocumentOptions {
  title: string;
  lang: 'ja' | 'en';
  bodyHtml: string;
}

const EXPORT_DOCUMENT_STYLES = `
:root {
  --bg-page: #f8fafc;
  --bg-surface: #ffffff;
  --bg-subtle: #f8fafc;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --border-color: #e2e8f0;
  --accent-color: #2563eb;
  --danger-color: #dc2626;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  background-color: var(--bg-page);
  color: var(--text-primary);
  font-family: "Segoe UI", "Yu Gothic UI", "Meiryo", sans-serif;
  line-height: 1.7;
}

.export-document-shell {
  max-width: 920px;
  margin: 32px auto;
  padding: 36px 44px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
}

.markdown-preview-body {
  font-size: 15px;
  line-height: 1.7;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

.markdown-preview-body > *:first-child {
  margin-top: 0;
}

.markdown-preview-body h1,
.markdown-preview-body h2,
.markdown-preview-body h3 {
  margin-top: 1.2em;
  margin-bottom: 0.5em;
  line-height: 1.3;
}

.markdown-preview-body h1 {
  font-size: 1.7em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--border-color);
}

.markdown-preview-body ul,
.markdown-preview-body ol {
  padding-left: 1.5em;
  margin: 8px 0;
}

.markdown-preview-body ul.contains-task-list {
  list-style: none;
  padding-left: 0.4em;
}

.markdown-preview-body li.task-list-item input[type="checkbox"] {
  margin-right: 6px;
}

.markdown-preview-body table {
  border-collapse: collapse;
  width: 100%;
  margin: 12px 0;
}

.markdown-preview-body th,
.markdown-preview-body td {
  border: 1px solid var(--border-color);
  padding: 8px 12px;
  text-align: left;
  vertical-align: top;
}

.markdown-preview-body th {
  background-color: var(--bg-subtle);
  font-weight: 600;
}

.markdown-preview-body a {
  color: var(--accent-color);
  text-decoration: none;
}

.markdown-preview-body a:hover {
  text-decoration: underline;
}

.markdown-preview-body :not(pre) > code {
  padding: 2px 6px;
  border-radius: 4px;
  background-color: #f1f5f9;
  font-family: "Consolas", monospace;
  font-size: 0.9em;
}

.markdown-preview-body hr {
  border: none;
  border-top: 1px solid var(--border-color);
  margin: 18px 0;
}

.markdown-preview-body blockquote {
  margin: 12px 0;
  padding: 4px 14px;
  border-left: 4px solid var(--accent-color);
  background-color: var(--bg-subtle);
  color: var(--text-secondary);
}

.markdown-code-pre {
  padding: 12px 14px;
  background-color: #f8fafc;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow-x: auto;
  font-family: "Consolas", monospace;
  font-size: 13px;
}

.mermaid-pre-container {
  margin: 14px 0;
}

.mermaid-preview-card {
  padding: 16px;
  background-color: var(--bg-subtle);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  overflow-x: auto;
}

.mermaid-svg-container {
  display: flex;
  justify-content: center;
}

.mermaid-svg-container svg {
  max-width: 100%;
  height: auto;
}

.mermaid-error-box {
  padding: 10px 12px;
  border: 1px solid #fecaca;
  border-radius: 6px;
  background-color: #fef2f2;
  color: var(--danger-color);
  font-size: 13px;
}

.mermaid-error-box pre {
  margin: 6px 0 0;
  white-space: pre-wrap;
  font-size: 12px;
}

@media (max-width: 768px) {
  .export-document-shell {
    margin: 0;
    padding: 20px 16px;
    border: none;
    border-radius: 0;
    box-shadow: none;
  }
}

@media print {
  @page {
    margin: 16mm;
  }

  html,
  body {
    background-color: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .export-document-shell {
    max-width: none;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: 0;
    box-shadow: none;
  }

  .markdown-preview-body h1,
  .markdown-preview-body h2,
  .markdown-preview-body h3 {
    break-after: avoid;
    page-break-after: avoid;
  }

  .markdown-preview-body table,
  .markdown-preview-body blockquote,
  .markdown-code-pre,
  .mermaid-preview-card {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .markdown-code-pre {
    white-space: pre-wrap;
    word-break: break-word;
    overflow-x: visible;
  }

  .mermaid-preview-card {
    overflow: visible;
  }
}
`.trim();

/** HTMLテキストおよび属性値向けに特殊文字をエスケープする */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripKnownExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex > 0) {
    return fileName.slice(0, dotIndex);
  }
  return fileName;
}

/** ソースファイルパスとフォールバック名からHTML文書タイトルを作成する */
export function buildExportDocumentTitle(
  sourceFilePath: string | null,
  fallbackTitle: string
): string {
  const baseName = getTabBaseFileName(sourceFilePath, fallbackTitle);
  const stripped = stripKnownExtension(baseName).trim();
  return stripped || 'document';
}

/** ソースファイルパスとフォールバック名から指定拡張子の書き出しファイル名を作成する */
export function buildExportFileName(
  sourceFilePath: string | null,
  fallbackTitle: string,
  extension: string
): string {
  const cleanExt = extension.replace(/^\.+/, '');
  return `${buildExportDocumentTitle(sourceFilePath, fallbackTitle)}.${cleanExt}`;
}

/** ソースファイルパスとフォールバック名から書き出し用HTMLファイル名を作成する */
export function buildHtmlFileName(
  sourceFilePath: string | null,
  fallbackTitle: string
): string {
  return buildExportFileName(sourceFilePath, fallbackTitle, 'html');
}

/** ソースファイルパスとフォールバック名から書き出し用PDFファイル名を作成する */
export function buildPdfFileName(
  sourceFilePath: string | null,
  fallbackTitle: string
): string {
  return buildExportFileName(sourceFilePath, fallbackTitle, 'pdf');
}

/** プレビューDOMを複製し、編集用の操作ボタンを除いたHTML文字列を返す */
export function extractCleanPreviewHtml(previewElement: Element | null): string {
  if (!previewElement) {
    return '';
  }
  const cloned = previewElement.cloneNode(true) as Element;
  for (const button of Array.from(cloned.querySelectorAll('.mermaid-edit-float-btn'))) {
    button.remove();
  }
  return cloned.innerHTML;
}

/** 単一ファイルとして閲覧可能なHTMLドキュメント文字列を生成する */
export function buildExportHtmlDocument({
  title,
  lang,
  bodyHtml,
}: ExportHtmlDocumentOptions): string {
  const safeLang = lang === 'en' ? 'en' : 'ja';
  const safeTitle = escapeHtml(title.trim() || 'document');

  return [
    '<!DOCTYPE html>',
    `<html lang="${safeLang}">`,
    '<head>',
    '  <meta charset="UTF-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    `  <title>${safeTitle}</title>`,
    '  <style>',
    EXPORT_DOCUMENT_STYLES,
    '  </style>',
    '</head>',
    '<body>',
    '  <main class="export-document-shell">',
    '    <article class="markdown-preview-body">',
    bodyHtml,
    '    </article>',
    '  </main>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}
