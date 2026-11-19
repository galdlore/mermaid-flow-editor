import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEmbedBridge } from './useEmbedBridge';
import {
  EMBED_CHANNEL,
  EMBED_PROTOCOL_VERSION,
  type EmbedConfig,
} from '../utils/embedBridge';

const HOST_ORIGIN = 'https://nextcloud-pi.tailfb0b8.ts.net:9443';

const BASE_CONFIG: EmbedConfig = {
  enabled: true,
  parentOrigin: HOST_ORIGIN,
  readOnly: false,
};

describe('useEmbedBridge', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends ready strictly to expectedParentOrigin and ignores untrusted origin or source messages', () => {
    const parentWindow = { postMessage: vi.fn() };
    const otherSource = { postMessage: vi.fn() };
    const onLoadDocument = vi.fn();
    const onHostRequestSave = vi.fn();

    renderHook(() =>
      useEmbedBridge({
        initialConfig: BASE_CONFIG,
        parentWindow,
        onLoadDocument,
        onHostRequestSave,
      })
    );

    expect(parentWindow.postMessage).toHaveBeenCalledTimes(1);
    expect(parentWindow.postMessage).toHaveBeenCalledWith(
      {
        channel: EMBED_CHANNEL,
        version: EMBED_PROTOCOL_VERSION,
        type: 'ready',
        capabilities: { save: true, linkedDocs: true, dirtyState: true },
      },
      HOST_ORIGIN
    );

    // Wrong origin
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://evil.example.com',
          source: parentWindow as unknown as Window,
          data: {
            channel: EMBED_CHANNEL,
            version: EMBED_PROTOCOL_VERSION,
            type: 'load-document',
            fileName: 'evil.md',
            content: 'bad',
          },
        })
      );
    });

    // Wrong source window
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: HOST_ORIGIN,
          source: otherSource as unknown as Window,
          data: {
            channel: EMBED_CHANNEL,
            version: EMBED_PROTOCOL_VERSION,
            type: 'request-save',
          },
        })
      );
    });

    expect(onLoadDocument).not.toHaveBeenCalled();
    expect(onHostRequestSave).not.toHaveBeenCalled();

    // Valid origin and source
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: HOST_ORIGIN,
          source: parentWindow as unknown as Window,
          data: {
            channel: EMBED_CHANNEL,
            version: EMBED_PROTOCOL_VERSION,
            type: 'load-document',
            fileId: 'f-1',
            fileName: 'spec.md',
            remotePath: 'docs/spec.md',
            content: '# Hello',
          },
        })
      );
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: HOST_ORIGIN,
          source: parentWindow as unknown as Window,
          data: {
            channel: EMBED_CHANNEL,
            version: EMBED_PROTOCOL_VERSION,
            type: 'request-save',
          },
        })
      );
    });

    expect(onLoadDocument).toHaveBeenCalledTimes(1);
    expect(onLoadDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: 'f-1',
        fileName: 'spec.md',
        remotePath: 'docs/spec.md',
        content: '# Hello',
      })
    );
    expect(onHostRequestSave).toHaveBeenCalledTimes(1);
  });

  it('correlates save-request and open-link-request with matching parent results and handles timeout', async () => {
    vi.useFakeTimers();
    const parentWindow = { postMessage: vi.fn() };

    const { result } = renderHook(() =>
      useEmbedBridge({
        initialConfig: BASE_CONFIG,
        parentWindow,
        onLoadDocument: vi.fn(),
        onHostRequestSave: vi.fn(),
        requestTimeoutMs: 5000,
      })
    );

    let savePromise!: Promise<{ ok: boolean; error?: string }>;
    act(() => {
      savePromise = result.current.requestEmbedSave({
        fileId: 'f-1',
        fileName: 'spec.md',
        remotePath: 'docs/spec.md',
        content: '# Updated',
      });
    });

    const saveCall = parentWindow.postMessage.mock.calls.find(
      (call) => (call[0] as { type?: string }).type === 'save-request'
    );
    expect(saveCall?.[1]).toBe(HOST_ORIGIN);
    const saveReqId = (saveCall?.[0] as { requestId: string }).requestId;

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: HOST_ORIGIN,
          source: parentWindow as unknown as Window,
          data: {
            channel: EMBED_CHANNEL,
            version: EMBED_PROTOCOL_VERSION,
            type: 'save-result',
            requestId: saveReqId,
            ok: true,
          },
        })
      );
    });

    await expect(savePromise).resolves.toEqual({ ok: true, error: undefined });

    let linkPromise!: ReturnType<typeof result.current.requestEmbedOpenLink>;
    act(() => {
      linkPromise = result.current.requestEmbedOpenLink({
        href: './child.md',
        resolvedRemotePath: 'docs/child.md',
        fromFileId: 'f-1',
        fromRemotePath: 'docs/spec.md',
      });
    });

    const linkCall = parentWindow.postMessage.mock.calls.find(
      (call) => (call[0] as { type?: string }).type === 'open-link-request'
    );
    const linkReqId = (linkCall?.[0] as { requestId: string }).requestId;

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: HOST_ORIGIN,
          source: parentWindow as unknown as Window,
          data: {
            channel: EMBED_CHANNEL,
            version: EMBED_PROTOCOL_VERSION,
            type: 'open-link-result',
            requestId: linkReqId,
            ok: true,
            fileId: 'f-2',
            fileName: 'child.md',
            remotePath: 'docs/child.md',
            content: '# Child',
          },
        })
      );
    });

    await expect(linkPromise).resolves.toMatchObject({
      ok: true,
      fileId: 'f-2',
      fileName: 'child.md',
      content: '# Child',
    });

    // Timeout case when parent does not respond
    let timeoutSavePromise!: Promise<{ ok: boolean; error?: string }>;
    act(() => {
      timeoutSavePromise = result.current.requestEmbedSave({
        fileId: 'f-1',
        fileName: 'spec.md',
        content: '# Slow',
      });
    });

    act(() => {
      vi.advanceTimersByTime(5001);
    });

    await expect(timeoutSavePromise).resolves.toEqual({ ok: false, error: 'timeout' });
  });
});
