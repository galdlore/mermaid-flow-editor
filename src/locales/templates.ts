import type { Language } from './types';

export const INITIAL_MARKDOWN_JA = `# Mermaid Markdown Editor

上部のツールバーから見出しや表、Mermaid図をGUI操作で挿入できます。

## 基本的な使い方

1. 左側の編集エリアに文章を書くか、ツールバーのボタンを押します。
2. 「Mermaid図をGUI作成」ボタンを押すと、図形と接続先をGUIで組み立てられます。
3. 右側のプレビュー上にある「この図をGUIで編集」ボタンから、既存の図を何度でも編集し直せます。

## サンプルフローチャート

\`\`\`mermaid
flowchart TD
  node_1(["開始"])
  style node_1 fill:#eff6ff,stroke:#475569,color:#0f172a
  node_2{"条件を確認"}
  node_3["完了処理"]
  style node_3 fill:#f0fdf4,stroke:#475569,color:#0f172a
  node_1 -->|"入力あり"| node_2
  node_2 -->|"OK"| node_3
%% @gui-state: {"direction":"TD","nodes":[{"id":"node_1","label":"開始","shape":"stadium","color":"#eff6ff","position":{"x":180,"y":40}},{"id":"node_2","label":"条件を確認","shape":"diamond","color":"#ffffff","position":{"x":185,"y":155}},{"id":"node_3","label":"完了処理","shape":"rect","color":"#f0fdf4","position":{"x":180,"y":310}}],"edges":[{"id":"edge_1","source":"node_1","target":"node_2","label":"入力あり","lineType":"arrow"},{"id":"edge_2","source":"node_2","target":"node_3","label":"OK","lineType":"arrow"}]}
\`\`\`
`;

export const INITIAL_MARKDOWN_EN = `# Mermaid Markdown Editor

Use the toolbar above to insert headings, tables, and Mermaid diagrams visually.

## Basic Usage

1. Write Markdown in the left editor pane or click the formatting buttons in the toolbar.
2. Click "Create Mermaid Diagram" to build shapes and connections in the visual GUI builder.
3. Click "Edit Diagram in GUI" on any diagram in the right preview pane to edit it again anytime.

## Sample Flowchart

\`\`\`mermaid
flowchart TD
  node_1(["Start"])
  style node_1 fill:#eff6ff,stroke:#475569,color:#0f172a
  node_2{"Check condition"}
  node_3["Complete"]
  style node_3 fill:#f0fdf4,stroke:#475569,color:#0f172a
  node_1 -->|"Has input"| node_2
  node_2 -->|"OK"| node_3
%% @gui-state: {"direction":"TD","nodes":[{"id":"node_1","label":"Start","shape":"stadium","color":"#eff6ff","position":{"x":180,"y":40}},{"id":"node_2","label":"Check condition","shape":"diamond","color":"#ffffff","position":{"x":185,"y":155}},{"id":"node_3","label":"Complete","shape":"rect","color":"#f0fdf4","position":{"x":180,"y":310}}],"edges":[{"id":"edge_1","source":"node_1","target":"node_2","label":"Has input","lineType":"arrow"},{"id":"edge_2","source":"node_2","target":"node_3","label":"OK","lineType":"arrow"}]}
\`\`\`
`;

export function getInitialMarkdownByLang(lang: Language): string {
  return lang === 'ja' ? INITIAL_MARKDOWN_JA : INITIAL_MARKDOWN_EN;
}
