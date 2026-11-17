# Mermaid Flow Editor 機能および設計仕様書

## 1. システム概要

Mermaid Flow Editorは、Markdown文書の編集とMermaid図のGUI作成を1つの画面に統合したエディタアプリケーションです。単一のReactおよびTypeScriptコードベースから、次の3つの配布形態を生成できる構成になっています。

| 実行環境 | 基盤技術 | 特徴と用途 |
|---|---|---|
| Windowsデスクトップアプリ | Electron (`electron-builder` / NSIS) | OS標準のファイル選択ダイアログと直接上書き保存に対応 |
| Webアプリケーション | Docker (`node:22-alpine` / `nginx:1.27-alpine`) | Raspberry Pi等のARM64環境を含むサーバで静的配信し、PCやAndroid端末から利用 |
| Chrome拡張機能 | Manifest V3 (`chrome/build-extension.ts`) | ツールバーアイコンから専用タブで起動（外部通信権限なし） |

## 2. 編集モードと画面仕様

### 2.1 デスクトップ表示（画面幅 769px 以上）

ツールバー右側の切替ボタンにより、次の2つのモードを切り替えられます。選択したモードは `localStorage` の `mermaid-flow-editor:editor-mode` に保存されます（初回未設定時は2ペイン編集）。

| モード名 | 画面構成 | 主な操作 |
|---|---|---|
| 2ペイン編集モード (`split`) | 左側にMarkdown原文テキストエリア、右側にプレビュー画面を並列表示 | 原文の直接編集、Tabキーによるインデント幅設定（2または4スペース） |
| 見た目編集モード (`wysiwyg`) | `@milkdown/kit` による1画面のWYSIWYGエディタを表示 | 見出し・太字・リスト・引用・表の直接入力、チェックボックスのクリック切替、ヘッダからの表行/列操作 |

### 2.2 モバイル表示（画面幅 768px 以下）

狭い画面で縦幅を確保するため、2ペイン並列表示を行わず上部スイッチによる単一ペイン切替を行います。初期表示は「見た目編集」です。

| 切替ボタン | 表示内容 |
|---|---|
| 見た目編集 | `@milkdown/kit` を用いた直接編集ビュー（初回アクセス時の初期表示） |
| 編集 | Markdown原文のテキストエリア表示 |
| プレビュー | 描画結果とMermaid図のプレビュー専用表示 |

### 2.3 見た目編集モード（WYSIWYG）の仕様

実装は `src/components/WysiwygEditor.tsx` が担います。プラグイン構成は `commonmark`、`gfm`、`history`、`listener` およびカスタムNodeViewプラグインです。

1. **ツールバー書式コマンドの共通化**: `src/components/MarkdownEditor.tsx` が現在の編集モードと画面幅を判定し、見出し（H1〜H3）、太字、斜体、打ち消し線、リンク、箇条書き、番号付きリスト、タスクリスト、引用、コードブロック、表挿入の各操作をMilkdownコマンドまたはテキストエリア操作へ振り分けます。
2. **Mermaidブロックの扱い**: 言語指定が `mermaid` のコードブロックは、編集可能なコード欄ではなく専用のNodeView（`contentEditable="false"`）としてSVGを描画します。右上の「この図をGUIで編集」ボタンから現在のMarkdownを同期したうえで `MermaidModal` を開きます。
3. **タブ切替時の不要なdirty化防止**: 外部プロップの変更で `replaceAll` を適用した直後のドキュメント状態を保持し、Milkdown内部の正規化だけで `isDirty` が立つのを防ぎます。

## 3. 複数タブ管理とドラッグ＆ドロップ仕様

タブ制御の純粋ロジックは `src/utils/documentTabs.ts`、UIは `src/components/TabBar.tsx` と `src/components/Toolbar.tsx` が担当します。

### 3.1 タブデータと状態永続化

各タブは `id`、`filePath`（未保存時は `null`）、`content`、`isDirty` を保持します。Electron以外のブラウザ環境では、変更のたびに全タブ配列と選択中タブIDを `localStorage`（キー `mermaid-flow-editor:tabs-v1`）へ保存します。旧バージョンの単一ドラフトキー `mermaid-flow-editor:draft` が残っている場合は初回読込時に1つ目のタブへ引き継ぎます。

### 3.2 同名ファイルの連番表示ルール

`computeTabDisplayTitles` 関数により、開いているタブ群の中でベースファイル名が重複した場合、2つ目以降へ拡張子の手前に `(2)`、`(3)` の連番を付けて表示名を算出します。すでに同じ連番付きファイル名が別のタブで開かれている場合は衝突しない次の番号へ繰り上げます。元の `filePath` 自体は書き換えないため、保存時のファイル名は維持されます。

### 3.3 レスポンシブなタブUI

| 画面幅 | タブUIの構成 | 操作 |
|---|---|---|
| デスクトップ（769px以上） | ツールバー直下の横スクロールタブバー | クリック切替、中クリックまたは×ボタンで閉じる、`+` ボタンで新規タブ追加 |
| モバイル（768px以下） | ツールバーおよびエディタ上部のファイル名ピルから開くタブ一覧シート | 縦幅を消費せず一覧からタブ切替、新規追加、押しやすいサイズ（36px）の閉じるボタン |

未保存（`isDirty === true`）のタブを閉じる際は確認ダイアログを表示します。最後の1タブを閉じた場合は空の無題タブを1つ新しく生成します。また、いずれかのタブに未保存変更がある状態でページやウィンドウを閉じようとすると `beforeunload` 警告を発火します。

### 3.4 ドラッグ＆ドロップ仕様

`src/App.tsx` のグローバルイベントおよび `src/utils/fileAdapter.ts` の `readDroppedMarkdownFiles` で処理します。

1. `DataTransfer.types` に `Files` が含まれる場合のみファイルドロップとして反応し、エディタ内のテキスト選択ドラッグを誤検知しません。
2. ドラッグ中は全画面オーバーレイ（`.drop-overlay`）を表示します。
3. ドロップイベント内で同期的にファイル一覧およびChromiumの `getAsFileSystemHandle()` を回収したあと、非同期でテキストを読み込みます。
4. 拡張子 `.md`、`.markdown`、`.txt` またはMIMEタイプ `text/markdown` / `text/x-markdown` を受け入れ、1回のドロップで複数ファイルを順番に新しいタブとして追加します。
5. 開いた直後は自動的に編集可能なモード（モバイルでは「見た目編集」または「編集」）へ切り替わります。

## 4. ファイル入出力とセキュリティ設計

環境の違いは `src/utils/fileAdapter.ts` で吸収しています。

| 操作 | Electron環境 | Chromium系ブラウザ（File System Access API対応） | その他ブラウザ・フォールバック |
|---|---|---|---|
| ファイルを開く | `window.electronAPI.openFile()` | `showOpenFilePicker()` で読込＋ハンドルをタブID別に保持 | `<input type="file">` で読込 |
| 上書き保存 | 許可済みパスセット `authorizedFilePaths` 検証後に書込 | タブIDに紐づくハンドル（ドロップ時含む）の書込権限確認後に直接書込 | 別名保存へ移行 |
| 名前を付けて保存 | `showSaveDialog` 経由で保存し許可パスへ登録 | `showSaveFilePicker()` で保存＋新規ハンドルをタブへ紐づけ | `Blob` ダウンロード出力 |

### 4.1 セキュリティ対策

1. **Electron分離**: `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true` を有効化し、外部リンクの遷移・新規ウィンドウをすべて抑止して安全なHTTP/HTTPSのみOSブラウザへ委譲します。保存先パスはメインプロセス側の `authorizedFilePaths` に登録されたファイルに限定します。
2. **SVGサニタイズ**: `src/utils/mermaidRender.ts` で描画時に `securityLevel: 'strict'` を指定したうえで、`DOMParser` により `<script>`、`<iframe>`、`<object>`、`<embed>`、`on*` 属性、危険なURLスキームを除去します。
3. **HTTPヘッダとCSP**: `index.html` と `docker/nginx.conf` で `default-src 'self'`、`object-src 'none'`、`form-action 'none'`、`frame-ancestors 'none'`（Nginx側）を設定し、外部スクリプトやフレーム埋め込みを遮断します。

## 5. Mermaid図 GUIエディタ仕様

文書内の ` ```mermaid ` ブロックは `src/utils/markdownMermaidBlocks.ts` でCommonMarkフェンス規則に沿って抽出・置換されます。新規作成または各図の編集ボタンから `src/components/MermaidModal.tsx` が起動します。

### 5.1 状態保存（`%% @gui-state:`）

ノード座標や色設定などMermaid構文だけでは表現しきれないGUI上のレイアウト情報は、`src/utils/mermaidEnvelope.ts` を通じてMermaidコード内の `%% @gui-state: <JSON>` コメント行として保存します。再編集時はコメント行の型検証付きJSONを優先して読み込み、コメントがない手書きのMermaidコードも各コンバータのパーサで解析してGUIへ復元します。

### 5.2 対応している図の種類（全15種類）

| 種別キー | 図の種類 | キャンバス / インスペクタ | コンバータ |
|---|---|---|---|
| `flowchart` | フローチャート | `MermaidCanvas` / `MermaidInspector` | `mermaidConverter.ts` |
| `swimlane` | スイムレーン図 (`swimlane-beta`) | `MermaidCanvas` / `MermaidInspector` | `mermaidConverter.ts` |
| `treeView` | ツリービュー (`treeView-beta`) | `TreeViewCanvas` / `TreeViewInspector` | `treeViewConverter.ts` |
| `kanban` | カンバン | `KanbanCanvas` / `KanbanInspector` | `kanbanConverter.ts` |
| `pie` | 円グラフ | `PieCanvas` / `PieInspector` | `pieConverter.ts` |
| `xychart` | 棒・折れ線グラフ (`xychart-beta`) | `XYChartCanvas` / `XYChartInspector` | `xychartConverter.ts` |
| `architecture` | アーキテクチャ図 (`architecture-beta`) | `ArchitectureCanvas` / `ArchitectureInspector` | `architectureConverter.ts` |
| `mindmap` | マインドマップ | `MindmapCanvas` / `MindmapInspector` | `mindmapConverter.ts` |
| `quadrantChart` | 四象限チャート | `QuadrantCanvas` / `QuadrantInspector` | `quadrantConverter.ts` |
| `sequence` | シーケンス図 | `SequenceCanvas` / `SequenceInspector` | `sequenceConverter.ts` |
| `class` | クラス図 | `ClassCanvas` / `ClassInspector` | `classConverter.ts` |
| `state` | 状態遷移図 | `StateCanvas` / `StateInspector` | `stateConverter.ts` |
| `er` | ER図 | `ErCanvas` / `ErInspector` | `erConverter.ts` |
| `gantt` | ガントチャート | `GanttCanvas` / `GanttInspector` | `ganttConverter.ts` |
| `c4` | C4図 (`C4Context` 等) | `C4Canvas` / `C4Inspector` | `c4Converter.ts` |

## 6. ビルドおよびCI/CDリリース仕様

### 6.1 ローカルコマンド

| コマンド | 処理内容 |
|---|---|
| `npm run dev` | Vite開発サーバとElectronアプリを同時起動 |
| `npm run build` | 型検査（`tsc --noEmit`）、Electronメインコンパイル、Vite本番ビルドを実行 |
| `npm run dist` | `npm run build` のあと `electron-builder --publish never` で `release/` へNSISインストーラを出力 |
| `npm run build:extension` | Chrome拡張機能用にビルドし、`chrome/build-extension.ts` が `package.json` の `version` を `dist-extension/manifest.json` へ自動反映 |
| `node --test src/utils/documentTabs.test.ts` | タブ命名、重複連番、永続化、拡張子フィルタの単体テストを実行 |

### 6.2 GitHub Actions自動ワークフロー

| ワークフロー | トリガー | 実行内容 |
|---|---|---|
| `.github/workflows/docker-publish.yml` | `main` へのプッシュおよび手動実行 | `linux/amd64` と `linux/arm64` 向けDockerイメージをGHCR（`ghcr.io/galdlore/mermaid-flow-editor`）へ公開 |
| `.github/workflows/release-windows.yml` | `package.json` または同ワークフロー変更を伴う `main` へのプッシュ、および手動実行 | `package.json` のバージョンに対応するタグ `v<version>` が未作成の場合のみ、Windowsインストーラ（`.exe`）とChrome拡張機能ZIPをビルドし、タグとGitHub Releaseを作成 |

## 7. ディレクトリ構成

| パス | 役割 |
|---|---|
| `src/components/` | UIコンポーネント群（ツールバー、タブバー、各エディタ、15種類の図用キャンバスとインスペクタ） |
| `src/utils/` | Markdown/Mermaidパーサとジェネレータ群、タブ管理、ファイルアダプタ、SVGサニタイズ、入力保護 |
| `src/locales/` | 日本語（`ja.ts`）・英語（`en.ts`）・テンプレート群・型定義（`types.ts`） |
| `src/types/` | 15種類の図データモデルおよびファイルI/O型定義（`editor.ts`） |
| `electron/` | Electronメインプロセス（`main.ts`）およびプリロード（`preload.ts`） |
| `chrome/` | Chrome拡張機能のバックグラウンドスクリプト（`background.ts`）およびビルド生成スクリプト（`build-extension.ts`） |
| `docker/` | 静的配信用Nginx設定ファイル（`nginx.conf`） |
| `docs/` | プライバシーポリシー（`privacy.html`）および本仕様書（`SPECIFICATION.md`） |
