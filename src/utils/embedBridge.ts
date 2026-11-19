export const EMBED_CHANNEL = 'mermaid-flow-editor-embed' as const;
export const EMBED_PROTOCOL_VERSION = 1 as const;

export interface EmbedConfig {
  enabled: boolean;
  parentOrigin: string | null;
  initialMode?: 'wysiwyg' | 'split';
  initialLang?: 'ja' | 'en';
  readOnly: boolean;
}

export interface EmbedReadyMessage {
  channel: typeof EMBED_CHANNEL;
  version: typeof EMBED_PROTOCOL_VERSION;
  type: 'ready';
  capabilities: {
    save: true;
    linkedDocs: true;
    dirtyState: true;
  };
}

export interface EmbedDirtyChangeMessage {
  channel: typeof EMBED_CHANNEL;
  version: typeof EMBED_PROTOCOL_VERSION;
  type: 'dirty-change';
  fileId?: string;
  isDirty: boolean;
}

export interface EmbedSaveRequestMessage {
  channel: typeof EMBED_CHANNEL;
  version: typeof EMBED_PROTOCOL_VERSION;
  type: 'save-request';
  requestId: string;
  fileId?: string;
  fileName: string;
  remotePath?: string;
  content: string;
}

export interface EmbedOpenLinkRequestMessage {
  channel: typeof EMBED_CHANNEL;
  version: typeof EMBED_PROTOCOL_VERSION;
  type: 'open-link-request';
  requestId: string;
  href: string;
  resolvedRemotePath?: string;
  fromFileId?: string;
  fromRemotePath?: string;
}

export type EmbedChildMessage =
  | EmbedReadyMessage
  | EmbedDirtyChangeMessage
  | EmbedSaveRequestMessage
  | EmbedOpenLinkRequestMessage;

export interface EmbedLoadDocumentMessage {
  channel: typeof EMBED_CHANNEL;
  version: typeof EMBED_PROTOCOL_VERSION;
  type: 'load-document';
  fileId?: string;
  fileName: string;
  remotePath?: string;
  content: string;
  readOnly?: boolean;
  openInNewTab?: boolean;
  lang?: 'ja' | 'en';
  editorMode?: 'wysiwyg' | 'split';
}

export interface EmbedSaveResultMessage {
  channel: typeof EMBED_CHANNEL;
  version: typeof EMBED_PROTOCOL_VERSION;
  type: 'save-result';
  requestId: string;
  ok: boolean;
  error?: string;
}

export interface EmbedOpenLinkResultMessage {
  channel: typeof EMBED_CHANNEL;
  version: typeof EMBED_PROTOCOL_VERSION;
  type: 'open-link-result';
  requestId: string;
  ok: boolean;
  fileId?: string;
  fileName?: string;
  remotePath?: string;
  content?: string;
  readOnly?: boolean;
  notFound?: boolean;
  error?: string;
}

export interface EmbedRequestSaveMessage {
  channel: typeof EMBED_CHANNEL;
  version: typeof EMBED_PROTOCOL_VERSION;
  type: 'request-save';
  requestId?: string;
}

export type EmbedParentMessage =
  | EmbedLoadDocumentMessage
  | EmbedSaveResultMessage
  | EmbedOpenLinkResultMessage
  | EmbedRequestSaveMessage;

/** URL文字列またはオリジン文字列から安全な http(s) オリジンを取り出す */
export function parseHttpOrigin(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

/** URLクエリとreferrerから埋め込み起動パラメータを解析する */
export function parseEmbedConfig(search?: string, referrer?: string): EmbedConfig {
  const params = new URLSearchParams(search ?? '');
  const rawEmbed = params.get('embed')?.trim().toLowerCase() ?? '';
  const enabled = rawEmbed === '1' || rawEmbed === 'true';

  const rawReadOnly = params.get('readonly')?.trim().toLowerCase() ?? '';
  const readOnly = rawReadOnly === '1' || rawReadOnly === 'true';

  const rawMode = params.get('mode')?.trim().toLowerCase() ?? '';
  const initialMode = rawMode === 'wysiwyg' || rawMode === 'split' ? rawMode : undefined;

  const rawLang = params.get('lang')?.trim().toLowerCase() ?? '';
  const initialLang = rawLang === 'ja' || rawLang === 'en' ? rawLang : undefined;

  const parentOrigin = parseHttpOrigin(params.get('origin')) ?? parseHttpOrigin(referrer);

  return {
    enabled,
    parentOrigin,
    ...(initialMode ? { initialMode } : {}),
    ...(initialLang ? { initialLang } : {}),
    readOnly,
  };
}

/** 受信したMessageEventの送信元ウィンドウとオリジンが許可対象か検証する */
export function isAllowedEmbedMessageEvent(
  eventOrigin: string,
  eventSource: unknown,
  expectedParentOrigin: string | null,
  parentWindow: unknown
): boolean {
  return (
    Boolean(expectedParentOrigin) &&
    Boolean(parentWindow) &&
    eventOrigin === expectedParentOrigin &&
    eventSource === parentWindow
  );
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

/** 親ホストからのpostMessageペイロードを検証して正規化メッセージを返す */
export function parseEmbedParentMessage(data: unknown): EmbedParentMessage | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const obj = data as Record<string, unknown>;
  if (obj.channel !== EMBED_CHANNEL || obj.version !== EMBED_PROTOCOL_VERSION) {
    return null;
  }

  switch (obj.type) {
    case 'load-document': {
      if (typeof obj.fileName !== 'string' || typeof obj.content !== 'string') {
        return null;
      }
      const lang = obj.lang === 'ja' || obj.lang === 'en' ? obj.lang : undefined;
      const editorMode =
        obj.editorMode === 'wysiwyg' || obj.editorMode === 'split' ? obj.editorMode : undefined;
      return {
        channel: EMBED_CHANNEL,
        version: EMBED_PROTOCOL_VERSION,
        type: 'load-document',
        fileId: readOptionalString(obj.fileId),
        fileName: obj.fileName,
        remotePath: readOptionalString(obj.remotePath),
        content: obj.content,
        readOnly: readOptionalBoolean(obj.readOnly),
        openInNewTab: readOptionalBoolean(obj.openInNewTab),
        ...(lang ? { lang } : {}),
        ...(editorMode ? { editorMode } : {}),
      };
    }

    case 'save-result': {
      if (typeof obj.requestId !== 'string' || !obj.requestId || typeof obj.ok !== 'boolean') {
        return null;
      }
      return {
        channel: EMBED_CHANNEL,
        version: EMBED_PROTOCOL_VERSION,
        type: 'save-result',
        requestId: obj.requestId,
        ok: obj.ok,
        error: readOptionalString(obj.error),
      };
    }

    case 'open-link-result': {
      if (typeof obj.requestId !== 'string' || !obj.requestId || typeof obj.ok !== 'boolean') {
        return null;
      }
      return {
        channel: EMBED_CHANNEL,
        version: EMBED_PROTOCOL_VERSION,
        type: 'open-link-result',
        requestId: obj.requestId,
        ok: obj.ok,
        fileId: readOptionalString(obj.fileId),
        fileName: readOptionalString(obj.fileName),
        remotePath: readOptionalString(obj.remotePath),
        content: readOptionalString(obj.content),
        readOnly: readOptionalBoolean(obj.readOnly),
        notFound: readOptionalBoolean(obj.notFound),
        error: readOptionalString(obj.error),
      };
    }

    case 'request-save': {
      return {
        channel: EMBED_CHANNEL,
        version: EMBED_PROTOCOL_VERSION,
        type: 'request-save',
        requestId: readOptionalString(obj.requestId),
      };
    }

    default:
      return null;
  }
}

/** 埋め込みリクエスト識別用の一意なIDを生成する */
export function createEmbedRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `embed-${crypto.randomUUID()}`;
  }
  return `embed-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** 子エディタの初期化完了通知メッセージを生成する */
export function createEmbedReadyMessage(): EmbedReadyMessage {
  return {
    channel: EMBED_CHANNEL,
    version: EMBED_PROTOCOL_VERSION,
    type: 'ready',
    capabilities: {
      save: true,
      linkedDocs: true,
      dirtyState: true,
    },
  };
}

/** 編集中フラグの変更通知メッセージを生成する */
export function createEmbedDirtyChangeMessage(
  isDirty: boolean,
  fileId?: string
): EmbedDirtyChangeMessage {
  return {
    channel: EMBED_CHANNEL,
    version: EMBED_PROTOCOL_VERSION,
    type: 'dirty-change',
    ...(fileId ? { fileId } : {}),
    isDirty,
  };
}

/** 親ホストへの保存要求メッセージを生成する */
export function createEmbedSaveRequestMessage(payload: {
  requestId: string;
  fileId?: string;
  fileName: string;
  remotePath?: string;
  content: string;
}): EmbedSaveRequestMessage {
  return {
    channel: EMBED_CHANNEL,
    version: EMBED_PROTOCOL_VERSION,
    type: 'save-request',
    requestId: payload.requestId,
    ...(payload.fileId ? { fileId: payload.fileId } : {}),
    fileName: payload.fileName,
    ...(payload.remotePath ? { remotePath: payload.remotePath } : {}),
    content: payload.content,
  };
}

/** 親ホストへの別ファイル読み込み要求メッセージを生成する */
export function createEmbedOpenLinkRequestMessage(payload: {
  requestId: string;
  href: string;
  resolvedRemotePath?: string;
  fromFileId?: string;
  fromRemotePath?: string;
}): EmbedOpenLinkRequestMessage {
  return {
    channel: EMBED_CHANNEL,
    version: EMBED_PROTOCOL_VERSION,
    type: 'open-link-request',
    requestId: payload.requestId,
    href: payload.href,
    ...(payload.resolvedRemotePath ? { resolvedRemotePath: payload.resolvedRemotePath } : {}),
    ...(payload.fromFileId ? { fromFileId: payload.fromFileId } : {}),
    ...(payload.fromRemotePath ? { fromRemotePath: payload.fromRemotePath } : {}),
  };
}
