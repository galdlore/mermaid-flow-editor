import type { Language } from './types';

export const APP_VERSION =
  typeof __APP_VERSION__ === 'string' && __APP_VERSION__.trim().length > 0
    ? __APP_VERSION__.trim()
    : 'dev';

export const INITIAL_MARKDOWN_JA = `# Mermaid Flow Editor 使い方ガイド (v${APP_VERSION})

Mermaid Flow Editorは、Markdown文書と31種類のMermaid図をGUI操作だけで作成・編集できる複数タブ対応エディタです。ツールバー右上の「？」ボタンからいつでもこのガイドを開き直せます。

## 1. 2つの編集モードを切り替える

画面上部の切替ボタンから、用途に合わせて2つの編集モードを使い分けられます。

1. 見た目編集モードではMarkdownの記号を手書きせずに、見出しや太字、リスト、引用、表を画面上でそのまま入力できます。
2. 表の中にカーソルを置くと、右上のヘッダに行や列を増減するGUIボタンが表示されます。
3. 2ペイン編集モードではMarkdown原文とリアルタイムプレビューを並べて表示でき、リスト行でEnterを押すと次の記号や連番が自動で続きます。

## 2. 31種類のMermaid図をGUIで組み立てる

ツールバーの「Mermaid図をGUI作成」ボタンを押すか、下の図に表示されている「この図をGUIで編集」ボタンを押すと専用エディタが開きます。フローチャートやスイムレーン図をはじめ、ツリービュー、ガントチャート、カンバン、円グラフ、棒・折れ線グラフ、アーキテクチャ図、マインドマップ、四象限チャート、シーケンス図、クラス図、状態遷移図、ER図、C4図、Gitグラフ、タイムライン、ブロック図、レールロード図、石川図、ユーザージャーニー図、ツリーマップ、ベン図、ウォードリーマップ、クネビン図、要件図、パケット図、イベントモデリング図、サンキー図、レーダーチャート、バージョン情報を視覚的に編集できます。

\`\`\`mermaid
flowchart TD
  node_1(["開始"])
  style node_1 fill:#eff6ff,stroke:#475569,color:#0f172a
  node_2{"編集方法を選ぶ"}
  node_3["見た目編集で作成"]
  style node_3 fill:#f0fdf4,stroke:#475569,color:#0f172a
  node_4["2ペインで調整"]
  style node_4 fill:#fefce8,stroke:#475569,color:#0f172a
  node_1 -->|"GUI中心"| node_2
  node_2 -->|"記号なし"| node_3
  node_2 -->|"原文も確認"| node_4
%% @gui-state: {"direction":"TD","nodes":[{"id":"node_1","label":"開始","shape":"stadium","color":"#eff6ff","position":{"x":180,"y":30}},{"id":"node_2","label":"編集方法を選ぶ","shape":"diamond","color":"#ffffff","position":{"x":185,"y":145}},{"id":"node_3","label":"見た目編集で作成","shape":"rect","color":"#f0fdf4","position":{"x":40,"y":290}},{"id":"node_4","label":"2ペインで調整","shape":"rect","color":"#fefce8","position":{"x":310,"y":290}}],"edges":[{"id":"edge_1","source":"node_1","target":"node_2","label":"GUI中心","lineType":"arrow"},{"id":"edge_2","source":"node_2","target":"node_3","label":"記号なし","lineType":"arrow"},{"id":"edge_3","source":"node_2","target":"node_4","label":"原文も確認","lineType":"arrow"}]}
\`\`\`

## 3. クリックで試せるタスクリスト

見た目編集モードでは、チェックボックスをクリックするだけで完了状態を切り替えられます。

- [x] 「ファイル」メニューから新規作成・開く・保存・HTMLやPDF出力を使う
- [ ] 右上の歯車アイコンからTabインデント数やOpenCloud/WebDAV保存を設定し、クラウドから開く・別フォルダへ保存する
- [ ] 別の.mdファイルへのリンク（2ペインプレビューは通常クリック、見た目編集はCtrl+クリック）でアプリ内の別タブを開き、ツールバーからクラウドファイルへのリンクを挿入する
- [ ] .mdファイルを画面へドラッグ＆ドロップして新しいタブで開く

## 4. 主なショートカットキー

見た目編集モードで表のセルをクリックすると、行や列の追加・削除ボタンを試せます。

| 操作内容 | キー操作 |
|---|---|
| 新規タブ作成 | Ctrl+N（ブラウザではAlt+N / Ctrl+Alt+N） |
| ファイルを開く | Ctrl+O |
| 上書き保存 | Ctrl+S |
| 名前を付けて保存 | Ctrl+Shift+S |
| 印刷またはPDF保存 | Ctrl+P |
| モーダルを閉じる | Escape |

## 5. 別のMarkdownファイルへのリンク例

文書内に他の\`.md\`ファイルへのリンクを書いておくと、2ペイン編集のプレビューでは通常のクリック、見た目編集では\`Ctrl+クリック\`（Macは\`Cmd+クリック\`）でアプリ内の新しいタブとして開けます。すでに開いているファイルであればそのタブへ切り替わります。

| リンクの目的 | Markdownの書き方例 |
|---|---|
| 同じフォルダ内のファイル（OpenCloud / ローカル共通） | \`[設計書](./design.md)\` |
| 下のフォルダ内のファイル | \`[API仕様](specs/api.md)\` |
| 上のフォルダ内のファイル | \`[トップへ戻る](../index.md)\` |
| OpenCloudのSpaceルート基準 | \`[目次](/docs/index.md)\` |
| OpenCloudのWebDAVフルURL | \`[別Spaceのメモ](https://cloud.example.com/dav/spaces/<space-id>/memo.md)\` |

ツールバーのリンク挿入ボタンの右にある「クラウドファイルへのリンクを挿入」アイコンを押すと、OpenCloud上のファイル一覧から選ぶだけで相対パスやWebDAVフルURLのリンク記法を自動挿入できます。
`;

export const INITIAL_MARKDOWN_EN = `# Mermaid Flow Editor Usage Guide (v${APP_VERSION})

Mermaid Flow Editor is a multi-tab editor for creating Markdown documents and 31 types of Mermaid diagrams visually. Click the "?" help button in the top-right toolbar anytime to reopen this guide.

## 1. Switch Between Visual and Split Modes

Use the mode toggle button in the toolbar to pick the editing style you prefer.

1. In Visual Mode, write headings, bold text, lists, blockquotes, and tables directly without typing raw Markdown syntax.
2. Place your cursor inside any table in Visual Mode to reveal row and column controls in the pane header.
3. In Split Mode, edit raw Markdown side-by-side with a live preview—pressing Enter on bullet, task, or numbered lists automatically continues and renumbers items.

## 2. Build 31 Mermaid Diagram Types Visually

Click "Create Mermaid Diagram" in the toolbar or click "Edit Diagram in GUI" on the diagram below to open the visual builder. You can edit Flowcharts, Swimlane Diagrams, Tree Views, Gantt Charts, Kanban Boards, Pie Charts, XY Charts, Architecture Diagrams, Mindmaps, Quadrant Charts, Sequence Diagrams, Class Diagrams, State Diagrams, ER Diagrams, C4 Diagrams, Git Graphs, Timelines, Block Diagrams, Railroad Diagrams, Ishikawa Diagrams, User Journeys, Treemaps, Venn Diagrams, Wardley Maps, Cynefin Frameworks, Requirement Diagrams, Packet Diagrams, Event Modeling Diagrams, Sankey Diagrams, Radar Charts, and Version Info.

\`\`\`mermaid
flowchart TD
  node_1(["Start"])
  style node_1 fill:#eff6ff,stroke:#475569,color:#0f172a
  node_2{"Choose Mode"}
  node_3["Write in Visual GUI"]
  style node_3 fill:#f0fdf4,stroke:#475569,color:#0f172a
  node_4["Refine in Split Mode"]
  style node_4 fill:#fefce8,stroke:#475569,color:#0f172a
  node_1 -->|"Flexible"| node_2
  node_2 -->|"No syntax"| node_3
  node_2 -->|"Raw Markdown"| node_4
%% @gui-state: {"direction":"TD","nodes":[{"id":"node_1","label":"Start","shape":"stadium","color":"#eff6ff","position":{"x":180,"y":30}},{"id":"node_2","label":"Choose Mode","shape":"diamond","color":"#ffffff","position":{"x":185,"y":145}},{"id":"node_3","label":"Write in Visual GUI","shape":"rect","color":"#f0fdf4","position":{"x":40,"y":290}},{"id":"node_4","label":"Refine in Split Mode","shape":"rect","color":"#fefce8","position":{"x":310,"y":290}}],"edges":[{"id":"edge_1","source":"node_1","target":"node_2","label":"Flexible","lineType":"arrow"},{"id":"edge_2","source":"node_2","target":"node_3","label":"No syntax","lineType":"arrow"},{"id":"edge_3","source":"node_2","target":"node_4","label":"Raw Markdown","lineType":"arrow"}]}
\`\`\`

## 3. Interactive Task List

In Visual Mode, click any checkbox directly to toggle its status.

- [x] Use the File menu for New, Open, Save, Open/Save Cloud, and HTML / PDF / Print export
- [ ] Open Settings (gear icon) to configure Tab indentation or encrypted OpenCloud / WebDAV access
- [ ] Click linked .md files (click in Preview or Ctrl+Click in Visual Mode) to open them in new tabs, or insert cloud file links from the toolbar
- [ ] Drag and drop .md files onto the window to open them in new tabs

## 4. Keyboard Shortcuts

Click inside this table in Visual Mode to try adding or removing rows and columns.

| Action | Shortcut |
|---|---|
| New Document Tab | Ctrl+N (Alt+N / Ctrl+Alt+N in browsers) |
| Open File | Ctrl+O |
| Save File | Ctrl+S |
| Save File As | Ctrl+Shift+S |
| Print / Save as PDF | Ctrl+P |
| Close Modal / Menu | Escape |

## 5. Linking to Other Markdown Files

Links to other \`.md\` files open in a new tab inside the app (or switch to the existing tab if already open). Click directly in Split Mode preview, or use \`Ctrl+Click\` (\`Cmd+Click\` on macOS) in Visual Mode.

| Link Target | Markdown Example |
|---|---|
| Same folder (OpenCloud & Electron local) | \`[Design Doc](./design.md)\` |
| Subfolder | \`[API Spec](specs/api.md)\` |
| Parent folder | \`[Back to Top](../index.md)\` |
| OpenCloud Space root | \`[Index](/docs/index.md)\` |
| OpenCloud full WebDAV URL | \`[Cross-Space Note](https://cloud.example.com/dav/spaces/<space-id>/memo.md)\` |

Click the "Insert Link to Cloud File" button next to the Link icon in the toolbar to browse OpenCloud files and insert either a relative path or a full WebDAV URL automatically.
`;

export function getInitialMarkdownByLang(lang: Language): string {
  return lang === 'ja' ? INITIAL_MARKDOWN_JA : INITIAL_MARKDOWN_EN;
}
