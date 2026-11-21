# Mermaid Flow Editor 機能および設計仕様書

## 1. システム概要

Mermaid Flow Editorは、Markdown文書の編集とMermaid図のGUI作成を1つの画面に統合したエディタアプリケーションです。単一のReactおよびTypeScriptコードベースから、次の3つの配布形態を生成できる構成になっています。

| 実行環境 | 基盤技術 | 特徴と用途 |
|---|---|---|
| Windowsデスクトップアプリ | Electron (`electron-builder` / NSIS) | OS標準のファイル選択ダイアログ、直接上書き保存、PDF書き出し、`remote:request`IPC経由のCORSフリー通信に対応 |
| Webアプリケーション | Docker (`node:22-alpine` / `nginx:1.27-alpine`) | Raspberry Pi等のARM64環境を含むサーバで静的配信し、PCやAndroid端末から利用 |
| Chrome拡張機能 | Manifest V3 (`chrome/build-extension.ts`) | ツールバーアイコンから専用タブで起動（外部接続は`optional_host_permissions`で保存先選択時のみ許可を要求） |

## 2. 編集モードと画面仕様

### 2.1 デスクトップ表示（画面幅 769px 以上）

ツールバー右側の切替ボタンにより、次の2つのモードを切り替えられます。選択したモードは`localStorage`の`mermaid-flow-editor:editor-mode`に保存されます（初回未設定時は2ペイン編集）。

| モード名 | 画面構成 | 主な操作 |
|---|---|---|
| 2ペイン編集モード (`split`) | 左側にMarkdown原文テキストエリア、右側にプレビュー画面を並列表示 | 原文の直接編集、Tabキーによるインデント増減、`Enter`によるリスト継続と連番振り直し |
| 見た目編集モード (`wysiwyg`) | `@milkdown/kit`による1画面のWYSIWYGエディタを表示 | 見出し・太字・リスト・引用・表の直接入力、チェックボックスのクリック切替、表内カーソル時の行/列操作ボタン |

### 2.2 モバイル表示（画面幅 768px 以下）

狭い画面で縦幅を確保するため、2ペイン並列表示を行わず上部スイッチによる単一ペイン切替を行います。初期表示は「見た目編集」です。

| 切替ボタン | 表示内容 |
|---|---|
| 見た目編集 | `@milkdown/kit`を用いた直接編集ビュー（初回アクセス時の初期表示） |
| 編集 | Markdown原文のテキストエリア表示 |
| プレビュー | 描画結果とMermaid図のプレビュー専用表示 |

### 2.3 ツールバー・メニュー構成と遅延読込

1. **ファイルメニュー統合**: `src/components/Toolbar.tsx`の「ファイル」ドロップダウン内に、基本操作（新規、開く、保存、別名保存）、クラウド操作（クラウドから開く、クラウドに保存、クラウドに別名保存）、およびエクスポート（HTML出力、PDF出力、印刷）を集約しています。
2. **設定・ヘルプボタン**: ツールバー右端のアイコンボタンから設定モーダル（`SettingsModal`）と使い方ガイド（新規タブとして表示）を呼び出せます。Tabインデント幅（2または4スペース）は設定モーダルから変更します。
3. **モーダル遅延読込**: `MermaidModal`、`SettingsModal`、`CloudBrowserModal`は`src/App.tsx`から`React.lazy`で遅延読み込みし、初期ロードバンドルを軽量化しています。`@xyflow/react`のスタイルも`MermaidModal`側で読み込みます。

### 2.4 2ペイン直接編集のリスト継続とTabインデント

1. **Tabインデント**: `src/utils/markdownTabIndent.ts`により、設定されたスペース幅（2または4）で単一行・複数行のインデント増減を行えます。
2. **Enterリスト継続・連番振り直し**: `src/utils/markdownListContinue.ts`により、箇条書き、タスクリスト、番号付きリストの行末または行途中で`Enter`を押すと次行へ記号または次の番号を挿入し、後続の連続した同階層番号付きリストを自動で連番へ振り直します。空のリスト項目で`Enter`を押した場合はリストを終了し、後ろに残った番号付きリストを`1.`から振り直します。コードフェンス内やIME変換中は無効です。

### 2.5 見た目編集モード（WYSIWYG）の仕様

実装は`src/components/WysiwygEditor.tsx`が担います。プラグイン構成は`commonmark`、`gfm`、`history`、`listener`およびカスタムNodeViewプラグインです。

1. **ツールバー書式コマンドの共通化**: `src/components/MarkdownEditor.tsx`が現在の編集モードと画面幅を判定し、各書式操作をMilkdownコマンドまたはテキストエリア操作へ振り分けます。
2. **Mermaidブロックの扱い**: 言語指定が`mermaid`のコードブロックは専用のNodeView（`contentEditable="false"`）としてSVGを描画し、「この図をGUIで編集」ボタンから`MermaidModal`を開きます。
3. **コンテキスト表操作とdirty抑止**: カーソルが表内にあるときだけヘッダへ行/列の追加削除ボタンを表示します。外部値反映直後の正規化による不要な`isDirty`化を抑止しています。

## 3. 複数タブ管理とドラッグ＆ドロップ仕様

タブ制御の純粋ロジックは`src/utils/documentTabs.ts`、UIは`src/components/TabBar.tsx`と`src/components/Toolbar.tsx`が担当します。

### 3.1 タブデータと状態永続化

各タブは`id`、`filePath`（未保存時は`null`）、`content`、`isDirty`、`remoteFileName`、`isGuide`を保持します。ブラウザ環境では`localStorage`（キー`mermaid-flow-editor:tabs-v1`）への保存を350msデバウンスして負荷を抑えつつ、`beforeunload`および`pagehide`イベントで即時フラッシュします。旧ドラフトキー`mermaid-flow-editor:draft`が残っている場合は初回読込時に引き継ぎます。

### 3.2 同名ファイルの連番表示ルール

`computeTabDisplayTitles`関数により、ローカルファイル名、使い方ガイド名、またはクラウド上のファイル名を基に表示タイトルを決定します。開いているタブ間で表示名が重複した場合は`(2)`、`(3)`の連番を拡張子の直前へ付与します。

### 3.3 レスポンシブなタブUIとドラッグ＆ドロップ

デスクトップではツールバー直下の横スクロールタブバー、モバイルではファイル名ピルから開くタブ一覧シートを表示します。`.md`、`.markdown`、`.txt`のドロップは複数ファイル同時受付に対応し、Chromium系ブラウザでは書き込み用ハンドルも回収します。

## 4. ローカル入出力・HTML/PDF出力・クラウド保存設計

ローカルおよびエクスポートI/Oは`src/utils/fileAdapter.ts`と`src/utils/htmlExport.ts`、リモート保存とWebDAV閲覧は`src/utils/remoteStorage.ts`と`src/hooks/useCloudStorage.ts`が担当します。

| 操作 | Electron環境 | ブラウザ / Chrome拡張環境 |
|---|---|---|
| ローカル開く・保存・別名保存 | `window.electronAPI`経由のOSダイアログと許可パス書込 | File System Access API（未対応時はinput/Blobフォールバック） |
| HTML出力 | 保存ダイアログ経由で単体HTML保存 | File System Access APIまたはダウンロード保存 |
| PDF出力・印刷 | `printToPDF`で直接PDF書込（印刷は`window.print()`） | `window.print()`と`@media print`スタイルでPDF保存 |
| クラウド開く・一覧・フォルダ作成・保存 | `remote:request`IPCでメインプロセスからHTTP/WebDAV通信 | `fetch()`＋Chrome拡張時は`optional_host_permissions`の動的取得 |

### 4.1 クラウド設定と認証情報の暗号化

1. **対応プロトコル**: OpenCloud/Nextcloud等のWebDAV（`PROPFIND`による階層一覧、`GET`読込、`PUT`保存、`MKCOL`フォルダ作成）と汎用HTTP API（`PUT`/`POST`、Markdown原文またはJSON）に対応しています。
2. **暗号化保持**: `src/utils/secretCrypto.ts`を用い、初期状態では認証情報をメモリ上のみ保持します。永続化を許可した場合のみ、ユーザーが入力したパスフレーズからPBKDF2-SHA256（210,000回反復）とAES-256-GCMで暗号化して`mermaid-flow-editor:remote-secret-v1`へ保存します（パスフレーズ自体は保存しません）。
3. **非同期保存の競合保護**: ローカル保存やクラウド保存の完了時に、保存開始時点の本文と現在の本文が一致する場合のみ`isDirty`を`false`へ戻し、保存中の追加入力を保護します。

### 4.2 セキュリティ対策

1. **Electron分離**: `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`を有効化し、`remote:request`IPCでも`http:`/`https:`URL、許可メソッド、10MB上限を検証します。
2. **SVGおよびURLサニタイズ**: `src/utils/mermaidRender.ts`で`securityLevel: 'strict'`、`DOMParser`による危険タグ・イベント属性除去、最大64件のLRU描画キャッシュを実施しています。`src/utils/inputSafeguard.ts`では`//`始まりのプロトコル相対URLも拒否します。
3. **HTTPヘッダとCSP**: `index.html`と`docker/nginx.conf`で`object-src 'none'`、`form-action 'none'`、`frame-ancestors 'none'`（Nginx側）を維持し、クラウド通信向けに`connect-src 'self' https: http:`を設定しています。

## 5. Mermaid図 GUIエディタ仕様

文書内の```` ```mermaid ````ブロックは`src/utils/markdownMermaidBlocks.ts`でCommonMarkフェンス規則に沿って抽出・置換されます。レイアウトメタデータは`src/utils/mermaidEnvelope.ts`を通じて`%% @gui-state: <JSON>`コメント行へ保存し、コメントなしの手書きMermaidコードも各コンバータでパースします。

対応している図の種類は、フローチャート、スイムレーン図（`swimlane-beta`）、ツリービュー（`treeView-beta`）、カンバン、円グラフ、棒・折れ線グラフ（`xychart-beta`）、アーキテクチャ図（`architecture-beta`）、マインドマップ、四象限チャート、シーケンス図、クラス図、状態遷移図、ER図、ガントチャート、C4図（`C4Context`等）、Gitグラフ（`gitGraph`）、タイムライン（`timeline`）、ブロック図（`block-beta`）、レールロード図（`railroad-beta`等4方言）、石川図（`ishikawa-beta`）の全20種類です。

## 6. テスト・ビルドおよびCI/CD仕様

### 6.1 ローカルコマンド

| コマンド | 処理内容 |
|---|---|
| `npm run dev` | Vite開発サーバとElectronアプリを同時起動 |
| `npm test` | `npm run test:unit`（`node --test "src/utils/*.test.ts"`）と`npm run test:ui`（`vitest run`）を連続実行 |
| `npm run build` | 型検査（`tsc --noEmit`）、Electronメインコンパイル、Vite本番ビルドを実行 |
| `npm run dist` | `npm run build`のあと`electron-builder --publish never`で`release/`へNSISインストーラを出力 |
| `npm run build:extension` | Chrome拡張機能用にビルドし、`dist-extension/manifest.json`へバージョンと`optional_host_permissions`を反映 |

### 6.2 GitHub Actionsワークフロー

| ワークフロー | トリガー | 実行内容 |
|---|---|---|
| `.github/workflows/ci.yml` | `main`へのプッシュおよびプルリクエスト | `npm test`、`npm run build`、`npm run build:extension`を実行して品質を検証 |
| `.github/workflows/docker-publish.yml` | `main`へのプッシュおよび手動実行 | `linux/amd64`と`linux/arm64`向けDockerイメージをGHCRへ公開 |
| `.github/workflows/release-windows.yml` | `package.json`または同ワークフロー変更を伴う`main`プッシュ、および手動実行 | バージョン未タグ時に`npm test`を実行後、Windowsインストーラ（`.exe`）とChrome拡張機能ZIPをビルドしてGitHub Releaseを作成 |

## 7. ディレクトリ構成

| パス | 役割 |
|---|---|
| `src/components/` | UIコンポーネント群（ツールバー、タブバー、設定モーダル、クラウドブラウザ、各エディタ、20種類の図用キャンバスとインスペクタ） |
| `src/hooks/` | クラウド設定・認証ロック管理カスタムフック（`useCloudStorage.ts`） |
| `src/styles/` | モジュール分割されたCSS群（`base-editor.css`, `modals.css`, `diagrams.css`, `responsive-print.css`） |
| `src/utils/` | Markdown/Mermaidパーサとジェネレータ群、WebDAV/暗号化ストレージ、タブ管理、ファイルアダプタ、HTML出力、SVGサニタイズ、単体テスト群 |
| `src/test/` | Vitest用jsdomセットアップ（`setupVitest.ts`） |
| `src/locales/` | 日本語（`ja.ts`）・英語（`en.ts`）・ガイドテンプレート群・型定義（`types.ts`） |
| `src/types/` | 20種類の図データモデルおよびファイルI/O型定義（`editor.ts`） |
| `electron/` | Electronメインプロセス（`main.ts`）およびプリロード（`preload.ts`） |
| `chrome/` | Chrome拡張機能のバックグラウンドスクリプト（`background.ts`）およびビルド生成スクリプト（`build-extension.ts`） |
| `docker/` | 静的配信用Nginx設定ファイル（`nginx.conf`） |
| `docs/` | プライバシーポリシー（`privacy.html`）および本仕様書（`SPECIFICATION.md`） |
