# Mermaid Flow Editor

Windows 11向けのGUIベースMarkdownエディタ兼Mermaid図作成デスクトップアプリです。Markdownの文書作成からMermaidのフローチャート編集までを、すべてTypeScriptのみで構築された画面上で直感的に操作できます。

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

Windows版のほかに、Chrome拡張機能版としてもビルドして利用できます。インストーラの申請が不要なため、利用中のブラウザへ手軽に組み込める構成です。

```bash
# Chrome拡張機能パッケージの作成
npm run build:extension
```

ストアへ提出するZIPファイルまで一括で作成したい場合は、ルートにある`extensionbuild.bat`を実行してください。処理が終わると直下に`manifest.json`を含む`mermaid-flow-editor-extension.zip`が出力されます。コマンドが成功すると、`dist-extension`フォルダへも必要なファイル一式が出力されます。次にChromeのアドレスバーへ`chrome://extensions`と入力して拡張機能管理画面を開いてください。画面右上のデベロッパーモードを有効にしたあと、「パッケージ化されていない拡張機能を読み込む」から`dist-extension`フォルダを選ぶと導入が完了します。ツールバーの拡張機能アイコンを押すと、専用タブでエディタ画面が立ち上がります。
