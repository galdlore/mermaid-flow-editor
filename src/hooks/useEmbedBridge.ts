import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import {
  createEmbedDirtyChangeMessage,
  createEmbedOpenLinkRequestMessage,
  createEmbedReadyMessage,
  createEmbedRequestId,
  createEmbedSaveRequestMessage,
  EMBED_CHANNEL,
  EMBED_PROTOCOL_VERSION,
  isAllowedEmbedMessageEvent,
  parseEmbedConfig,
  parseEmbedParentMessage,
  type EmbedChildMessage,
  type EmbedConfig,
  type EmbedLoadDocumentMessage,
  type EmbedOpenLinkResultMessage,
} from '../utils/embedBridge';

export interface UseEmbedBridgeOptions {
  onLoadDocument: (message: EmbedLoadDocumentMessage) => void;
  onHostRequestSave: () => void;
  initialConfig?: EmbedConfig;
  parentWindow?: Pick<Window, 'postMessage'> | null;
  requestTimeoutMs?: number;
}

interface PendingEntry<T> {
  resolve: (value: T) => void;
  timer: ReturnType<typeof setTimeout>;
}

const DEFAULT_EMBED_REQUEST_TIMEOUT_MS = 15_000;

export function resolveRuntimeEmbedConfig(): EmbedConfig {
  if (typeof window === 'undefined') {
    return { enabled: false, parentOrigin: null, readOnly: false };
  }
  const parsed = parseEmbedConfig(
    window.location?.search ?? '',
    typeof document !== 'undefined' ? document.referrer : ''
  );
  if (parsed.enabled && !parsed.parentOrigin) {
    try {
      if (
        window.parent &&
        window.parent !== window &&
        window.parent.location?.origin === window.location.origin
      ) {
        return { ...parsed, parentOrigin: window.location.origin };
      }
    } catch {
      // クロスオリジン親参照時は無視してフェイルクローズする
    }
  }
  return parsed;
}

function clearPendingMap<T>(
  mapRef: MutableRefObject<Map<string, PendingEntry<T>>>,
  makeCancelledResult: (requestId: string) => T
): void {
  for (const [reqId, entry] of mapRef.current.entries()) {
    clearTimeout(entry.timer);
    entry.resolve(makeCancelledResult(reqId));
  }
  mapRef.current.clear();
}

export function useEmbedBridge({
  onLoadDocument,
  onHostRequestSave,
  initialConfig,
  parentWindow,
  requestTimeoutMs = DEFAULT_EMBED_REQUEST_TIMEOUT_MS,
}: UseEmbedBridgeOptions) {
  const embedConfig = useMemo<EmbedConfig>(
    () => initialConfig ?? resolveRuntimeEmbedConfig(),
    [initialConfig]
  );

  const targetParent = useMemo<Pick<Window, 'postMessage'> | null>(() => {
    if (parentWindow !== undefined) {
      return parentWindow;
    }
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      return window.parent;
    }
    return null;
  }, [parentWindow]);

  const embedParentOrigin = embedConfig.parentOrigin;
  const embedOriginReady =
    embedConfig.enabled && Boolean(embedParentOrigin) && Boolean(targetParent);

  const onLoadDocumentRef = useRef(onLoadDocument);
  onLoadDocumentRef.current = onLoadDocument;
  const onHostRequestSaveRef = useRef(onHostRequestSave);
  onHostRequestSaveRef.current = onHostRequestSave;

  const pendingSavesRef = useRef(
    new Map<string, PendingEntry<{ ok: boolean; error?: string }>>()
  );
  const pendingOpenLinksRef = useRef(
    new Map<string, PendingEntry<EmbedOpenLinkResultMessage>>()
  );

  const postToParent = useCallback(
    (message: EmbedChildMessage): boolean => {
      if (!embedOriginReady || !targetParent || !embedParentOrigin) {
        return false;
      }
      targetParent.postMessage(message, embedParentOrigin);
      return true;
    },
    [embedOriginReady, embedParentOrigin, targetParent]
  );

  useEffect(() => {
    if (!embedOriginReady || !targetParent || !embedParentOrigin || typeof window === 'undefined') {
      return;
    }

    const handleMessage = (event: MessageEvent): void => {
      if (
        !isAllowedEmbedMessageEvent(
          event.origin,
          event.source,
          embedParentOrigin,
          targetParent
        )
      ) {
        return;
      }

      const parsed = parseEmbedParentMessage(event.data);
      if (!parsed) {
        return;
      }

      if (parsed.type === 'load-document') {
        onLoadDocumentRef.current(parsed);
        return;
      }

      if (parsed.type === 'request-save') {
        onHostRequestSaveRef.current();
        return;
      }

      if (parsed.type === 'save-result') {
        const entry = pendingSavesRef.current.get(parsed.requestId);
        if (entry) {
          clearTimeout(entry.timer);
          pendingSavesRef.current.delete(parsed.requestId);
          entry.resolve({ ok: parsed.ok, error: parsed.error });
        }
        return;
      }

      if (parsed.type === 'open-link-result') {
        const entry = pendingOpenLinksRef.current.get(parsed.requestId);
        if (entry) {
          clearTimeout(entry.timer);
          pendingOpenLinksRef.current.delete(parsed.requestId);
          entry.resolve(parsed);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    postToParent(createEmbedReadyMessage());

    return () => {
      window.removeEventListener('message', handleMessage);
      clearPendingMap(pendingSavesRef, () => ({ ok: false, error: 'unmounted' }));
      clearPendingMap(pendingOpenLinksRef, (reqId): EmbedOpenLinkResultMessage => ({
        channel: EMBED_CHANNEL,
        version: EMBED_PROTOCOL_VERSION,
        type: 'open-link-result',
        requestId: reqId,
        ok: false,
        error: 'unmounted',
      }));
    };
  }, [embedOriginReady, embedParentOrigin, postToParent, targetParent]);

  const notifyDirtyChange = useCallback(
    (isDirty: boolean, fileId?: string): void => {
      postToParent(createEmbedDirtyChangeMessage(isDirty, fileId));
    },
    [postToParent]
  );

  const enqueueRequest = useCallback(
    <TResult>(
      mapRef: MutableRefObject<Map<string, PendingEntry<TResult>>>,
      requestId: string,
      message: EmbedChildMessage,
      makeFailureResult: (error: string) => TResult
    ): Promise<TResult> => {
      if (!embedOriginReady || !targetParent || !embedParentOrigin) {
        return Promise.resolve(makeFailureResult('Embed origin is not available.'));
      }

      return new Promise<TResult>((resolve) => {
        const timer = setTimeout(() => {
          mapRef.current.delete(requestId);
          resolve(makeFailureResult('timeout'));
        }, requestTimeoutMs);

        mapRef.current.set(requestId, { resolve, timer });
        targetParent.postMessage(message, embedParentOrigin);
      });
    },
    [embedOriginReady, embedParentOrigin, requestTimeoutMs, targetParent]
  );

  const requestEmbedSave = useCallback(
    (payload: {
      fileId?: string;
      fileName: string;
      remotePath?: string | null;
      content: string;
    }): Promise<{ ok: boolean; error?: string }> => {
      const requestId = createEmbedRequestId();
      const message = createEmbedSaveRequestMessage({
        requestId,
        fileId: payload.fileId,
        fileName: payload.fileName,
        remotePath: payload.remotePath ?? undefined,
        content: payload.content,
      });
      return enqueueRequest(pendingSavesRef, requestId, message, (error) => ({
        ok: false,
        error,
      }));
    },
    [enqueueRequest]
  );

  const requestEmbedOpenLink = useCallback(
    (payload: {
      href: string;
      resolvedRemotePath?: string | null;
      fromFileId?: string;
      fromRemotePath?: string | null;
    }): Promise<EmbedOpenLinkResultMessage> => {
      const requestId = createEmbedRequestId();
      const message = createEmbedOpenLinkRequestMessage({
        requestId,
        href: payload.href,
        resolvedRemotePath: payload.resolvedRemotePath ?? undefined,
        fromFileId: payload.fromFileId,
        fromRemotePath: payload.fromRemotePath ?? undefined,
      });
      return enqueueRequest(pendingOpenLinksRef, requestId, message, (error) => ({
        channel: EMBED_CHANNEL,
        version: EMBED_PROTOCOL_VERSION,
        type: 'open-link-result',
        requestId,
        ok: false,
        error,
      }));
    },
    [enqueueRequest]
  );

  return {
    embedConfig,
    isEmbedMode: embedConfig.enabled,
    embedParentOrigin,
    embedOriginReady,
    notifyDirtyChange,
    requestEmbedSave,
    requestEmbedOpenLink,
  };
}
