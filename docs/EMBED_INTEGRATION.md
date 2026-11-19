# 埋め込み連携ガイド

Mermaid Flow EditorをOpenCloudのWeb拡張機能や外部ポータルへ`iframe`で組み込むための手順書です。クエリパラメータによる埋め込み起動と、`postMessage`を使った双方向通信の仕様をまとめています。

## 起動URLパラメータ

埋め込みモードは、アプリのURLへ`embed=1`を付けて開くと有効になります。通常のブラウザ利用時の保存データとは独立して動くため、ホスト側のファイル操作を既存のタブ状態へ干渉させずに扱えます。

| パラメータ | 指定例 | 必須 | 説明 |
|---|---|---|---|
| `embed` | `1` または `true` | 必須 | 埋め込みモードを有効にします |
| `origin` | `https://nextcloud-pi.tailfb0b8.ts.net:9443` | 推奨 | 通信を許可する親ウィンドウのオリジンです |
| `mode` | `wysiwyg` または `split` | 任意 | 初期表示の編集モードを指定します |
| `lang` | `ja` または `en` | 任意 | 初期表示言語を指定します |
| `readonly` | `1` または `true` | 任意 | 読み取り専用として開き保存を禁止します |

親ウィンドウのオリジン検証は、`origin`パラメータを最優先で使います。指定がない場合は`document.referrer`または同一オリジンの親フレームから補完し、いずれも確認できない場合は通信を行わずに警告を出して停止します。

## postMessage通信仕様

すべてのメッセージは`channel`を`mermaid-flow-editor-embed`とし、`version`を`1`で統一しています。送信時は`postMessage`の第2引数に`'*'`を使わず、互いに検証済みのオリジンだけを指定してください。

### 子エディタから親ホストへのメッセージ

| `type` | 主なフィールド | 用途 |
|---|---|---|
| `ready` | `capabilities` | 初期化完了と対応機能（`save`、`linkedDocs`、`dirtyState`）を通知します |
| `dirty-change` | `fileId`, `isDirty` | 未保存状態の有無が変わったときに通知します |
| `save-request` | `requestId`, `fileId`, `fileName`, `remotePath`, `content` | `Ctrl+S`や保存ボタンの押下時に上書き保存を依頼します |
| `open-link-request` | `requestId`, `href`, `resolvedRemotePath`, `fromFileId`, `fromRemotePath` | `.md`リンクのクリック時に別タブ用の本文取得を依頼します |

### 親ホストから子エディタへのメッセージ

| `type` | 主なフィールド | 用途 |
|---|---|---|
| `load-document` | `fileId`, `fileName`, `remotePath`, `content`, `readOnly`, `openInNewTab`, `lang`, `editorMode` | 開くMarkdown本文をエディタへ渡します |
| `save-result` | `requestId`, `ok`, `error` | `save-request`に対する保存結果を返します |
| `open-link-result` | `requestId`, `ok`, `fileId`, `fileName`, `remotePath`, `content`, `readOnly`, `notFound`, `error` | `open-link-request`で取得した別ファイルの本文を返します |
| `request-save` | `requestId` | 親ホスト側のボタン等からエディタへ保存実行を指示します |

`save-request`と`open-link-request`の応答待ちタイムアウトは15秒です。親側では受け取った`requestId`をそのまま`save-result`や`open-link-result`へ含めて返してください。

```ts
// 子 -> 親 (ready)
{
  channel: 'mermaid-flow-editor-embed',
  version: 1,
  type: 'ready',
  capabilities: { save: true, linkedDocs: true, dirtyState: true }
}

// 親 -> 子 (load-document)
{
  channel: 'mermaid-flow-editor-embed',
  version: 1,
  type: 'load-document',
  fileId: 'file-123',
  fileName: 'design.md',
  remotePath: 'docs/design.md',
  content: '# 設計メモ\n',
  readOnly: false
}
```

## Raspberry PiとDockerの設定

標準状態のNginx設定はクリックジャッキング対策として`X-Frame-Options: DENY`と`frame-ancestors 'none'`を送出します。OpenCloudの画面内へ`iframe`表示する場合は、Dockge側の環境変数へ`EMBED_FRAME_ANCESTORS`を設定してください。起動スクリプトの`25-embed-headers.sh`が設定値を検証した上でヘッダを切り替えます。

```yaml
services:
  mermaid-editor:
    container_name: mermaid-flow-editor
    environment:
      EMBED_FRAME_ANCESTORS: "'self' https://nextcloud-pi.tailfb0b8.ts.net:9443"
```

あわせてOpenCloud側でも`csp.yaml`の`directives.frame-src`にMermaid Flow Editorのオリジンを追記してください。異なるオリジン間の通信を避けたい場合は、同じリバースプロキシ配下のパスへ公開する構成も有効です。

## OpenCloud拡張側の実装手順

OpenCloudのWeb拡張機能はVue3と`@opencloud-eu/web-pkg`の`defineWebApplication`で作成し、`WEB_ASSET_APPS_PATH`配下へ配置します。処理の流れは以下の順序で組み立てます。

1. `window.location.origin`を`origin`パラメータへ詰めた`?embed=1&origin=...`の`iframe`を生成します。
2. 子から`ready`を受け取ったら、開いたファイルのWebDAV本文を取得して`load-document`を送信します。
3. 子から`dirty-change`が届いたら、閉じる前の離脱確認や保存アイコンの状態表示へ反映します。
4. `save-request`を受けたらログイン済みセッションでWebDAVの`PUT`を実行し、`save-result`を返します。
5. `open-link-request`を受けたら`resolvedRemotePath`または`href`のファイルをWebDAVの`GET`で取得し、`open-link-result`を返します。
