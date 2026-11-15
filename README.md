# Mermaid Flow Editor

Windows 11向けのGUIベースMarkdownエディタ兼Mermaid図作成デスクトップアプリです。Markdownの文書作成からMermaidのフローチャート編集までを、すべてTypeScriptのみで構築された画面上で直感的に操作できます。Chrome拡張機能版は[Chromeウェブストア](https://chromewebstore.google.com/detail/mermaid-flow-editor/acglgnfjffdmajcdkhcdgjpbdpfmgcek)から導入できます。

## 主な機能

| 機能分類 | できること |
|---|---|
| MarkdownのGUI編集 | ツールバーから見出し、太字、リスト、引用、コード枠を挿入できます |
| 表のGUI作成 | 行数と列数を指定するフォームからMarkdownテーブルを生成できます |
| リアルタイムプレビュー | GitHub互換MarkdownとMermaid図を右側画面で即座に確認できます |
| Mermaid図のキャンバス編集 | 図形をマウスで移動し、端のハンドルから別の図形へ線をつなげます |
| 接続先のプルダウン設定 | 接続元、接続先、線の種類、ラベルを一覧のプルダウンから変更できます |
| 図の再編集と復元 | 図の座標や色をコード内のコメントへ保存し、何度でもGUIで開き直せます |
| ファイル操作 | Windowsの標準ダイアログからMarkdownファイルの読み込みと保存ができます |

## 採用している技術

| 領域 | 使用技術 |
|---|---|
| デスクトップ基盤 | Electron, electron-builder |
| 画面とビルド | React, TypeScript, Vite |
| 図形と接続のGUI | @xyflow/react |
| 描画とアイコン | mermaid, react-markdown, remark-gfm, lucide-react |

## セットアップと起動手順

Node.jsがインストールされた環境で、以下のコマンドを順番に実行してください。

```bash
# 依存パッケージのインストール
npm install

# 開発モードでの起動
npm run dev

# 型検査と本番ビルドの実行
npm run build

# Windows向けインストーラの作成
npm run dist
```

環境によっては`npm install`の実行時、Electronのインストールスクリプト承認を求められる場合があります。その場合は`npm install-scripts approve electron`を実行したあと、再度インストールを行ってください。

## ショートカットキー

| キー操作 | 実行される動作 |
|---|---|
| `Ctrl + O` | Markdownファイルを開く |
| `Ctrl + S` | 上書き保存する |
| `Ctrl + Shift + S` | 名前を付けて保存する |
| `Escape` | Mermaid図のGUI編集モーダルを閉じる |

## Chrome拡張機能としての導入手順

公式の公開ページとして[Chromeウェブストア](https://chromewebstore.google.com/detail/mermaid-flow-editor/acglgnfjffdmajcdkhcdgjpbdpfmgcek)から直接インストールできます。追加したあとは、Chromeのツールバーにある拡張機能アイコンを押すと専用タブでエディタ画面が立ち上がります。

### ローカルビルドからの手動導入

開発中の変更を手元のブラウザで試す場合は、Chrome拡張機能パッケージをローカルでビルドして読み込むこともできます。

```bash
# Chrome拡張機能パッケージの作成
npm run build:extension
```

ストアへ提出するZIPファイルまで一括で作成したい場合は、ルートにある`extensionbuild.bat`を実行してください。処理が終わると直下に`manifest.json`を含む`mermaid-flow-editor-extension.zip`が出力されます。コマンドが成功すると、`dist-extension`フォルダへも必要なファイル一式が出力されます。次にChromeのアドレスバーへ`chrome://extensions`と入力して拡張機能管理画面を開いてください。画面右上のデベロッパーモードを有効にしたあと、「パッケージ化されていない拡張機能を読み込む」から`dist-extension`フォルダを選ぶと導入が完了します。ツールバーの拡張機能アイコンを押すと、専用タブでエディタ画面が立ち上がります。

### バージョン管理とWindows版の自動リリース手順

Windows版アプリとChrome拡張機能のバージョンは、プロジェクト直下の`package.json`で一元管理します。`chrome/build-extension.ts`はビルド時に`package.json`の`version`を自動で読み込みます。`npm run build:extension`または`extensionbuild.bat`を実行すると、最新の番号が反映された`dist-extension/manifest.json`と提出用ZIPファイルが出力されます。

GitHub上での自動リリースは、バージョン差分検知方式を採用しています。`package.json`の`version`を新しい番号（例として`1.0.1`）へ書き換えて`main`ブランチへプッシュすると、`.github/workflows/release-windows.yml`が起動します。既存のタグに`v<バージョン>`が存在しない場合、GitHub Actions上でWindows用インストーラとChrome拡張機能ZIPをビルドし、タグ作成とGitHub Releaseへの公開まで自動で進みます。

## Docker（Raspberry Piサーバ対応）での起動手順

Webブラウザから利用できる静的配信版として、Dockerコンテナで起動できます。`node:22-alpine` と `nginx:1.27-alpine` をベースにしているため、PC（x86_64）だけでなく Raspberry Pi（ARM64 / ARMv7）でもそのままビルドと実行が可能です。

他の一般的なサービスや開発用ポート（3000、8080、9000など）と重複しにくいよう、初期設定の公開ポートには `18420` を割り当てています。

```bash
# コンテナのビルドとバックグラウンド起動
docker compose up -d --build
```

起動後はブラウザから `http://<サーバのIPアドレス>:18420` へアクセスしてください。公開ポートを変更したい場合は、環境変数 `APP_PORT` を指定して起動します。

```bash
APP_PORT=18421 docker compose up -d
```

### Dockge（事前ビルド済みイメージ）での起動手順

GitHub Actionsにより、`main`ブランチへプッシュすると`linux/amd64`および`linux/arm64`向けのイメージがGitHub Container Registry（GHCR）へ公開されます。Dockgeで管理する場合は、新しいスタックの作成画面へ以下の内容を入力してください。

```yaml
services:
  mermaid-editor:
    image: ghcr.io/galdlore/mermaid-flow-editor:latest
    container_name: mermaid-flow-editor
    ports:
      - "18420:80"
    restart: unless-stopped
```
