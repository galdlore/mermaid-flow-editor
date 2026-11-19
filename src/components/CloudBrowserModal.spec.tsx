import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n';
import { createDefaultRemoteSettings } from '../utils/remoteStorage';
import CloudBrowserModal from './CloudBrowserModal';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('CloudBrowserModal', () => {
  it('navigates WebDAV directories, loads a selected file, and handles PROPFIND fallback', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();

      if (method === 'PROPFIND' && url.endsWith('/dav/')) {
        return new Response(
          `<d:multistatus xmlns:d="DAV:">
            <d:response><d:href>/dav/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
            <d:response><d:href>/dav/notes/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
            <d:response><d:href>/dav/image.png</d:href><d:propstat><d:prop><d:resourcetype/><d:getcontentlength>900</d:getcontentlength></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
          </d:multistatus>`,
          { status: 207 }
        );
      }
      if (method === 'PROPFIND' && url.endsWith('/dav/notes/')) {
        return new Response(
          `<d:multistatus xmlns:d="DAV:">
            <d:response><d:href>/dav/notes/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
            <d:response><d:href>/dav/notes/plan.md</d:href><d:propstat><d:prop><d:resourcetype/><d:getcontentlength>42</d:getcontentlength></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
          </d:multistatus>`,
          { status: 207 }
        );
      }
      if (method === 'GET' && url.endsWith('/dav/notes/plan.md')) {
        return new Response('# Remote Plan', { status: 200 });
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    const onOpenedFile = vi.fn();

    render(
      <I18nProvider>
        <CloudBrowserModal
          isOpen
          mode="open"
          remoteSettings={{
            ...createDefaultRemoteSettings(),
            enabled: true,
            endpointUrl: 'https://cloud.example.com/dav/',
            authType: 'none',
          }}
          remoteCredentials={{ username: '', password: '', bearerToken: '' }}
          initialSubPath=""
          initialFileName=""
          onOpenedFile={onOpenedFile}
          onSaveToPath={vi.fn().mockResolvedValue({ ok: true })}
          onClose={vi.fn()}
        />
      </I18nProvider>
    );

    const notesFolder = await screen.findByRole('option', { name: /notes/ });
    expect(screen.queryByRole('option', { name: /image\.png/ })).not.toBeInTheDocument();

    fireEvent.click(notesFolder);
    const planFile = await screen.findByRole('option', { name: /plan\.md/ });
    fireEvent.click(planFile);

    expect(screen.getByText('対象パス /notes/plan.md')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '開く' }));
    await waitFor(() => {
      expect(onOpenedFile).toHaveBeenCalledWith('notes/plan.md', '# Remote Plan');
    });
  });

  it('creates a new folder in save-as mode and submits target path', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'PROPFIND') {
        return new Response(
          `<d:multistatus xmlns:d="DAV:">
            <d:response><d:href>/dav/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
          </d:multistatus>`,
          { status: 207 }
        );
      }
      if (method === 'MKCOL') {
        return new Response(null, { status: 201 });
      }
      return new Response(null, { status: 500 });
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const onSaveToPath = vi.fn().mockResolvedValue({ ok: true });

    render(
      <I18nProvider>
        <CloudBrowserModal
          isOpen
          mode="save-as"
          remoteSettings={{
            ...createDefaultRemoteSettings(),
            enabled: true,
            endpointUrl: 'https://cloud.example.com/dav/',
            authType: 'none',
          }}
          remoteCredentials={{ username: '', password: '', bearerToken: '' }}
          initialSubPath=""
          initialFileName="draft.md"
          onOpenedFile={vi.fn()}
          onSaveToPath={onSaveToPath}
          onClose={vi.fn()}
        />
      </I18nProvider>
    );

    await screen.findByText('このフォルダには表示できる項目がありません。');

    fireEvent.click(screen.getByRole('button', { name: '新規フォルダ' }));
    fireEvent.change(screen.getByPlaceholderText('新しいフォルダ名'), {
      target: { value: 'specs' },
    });
    fireEvent.click(screen.getByRole('button', { name: '作成' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'https://cloud.example.com/dav/specs/',
        expect.objectContaining({ method: 'MKCOL' })
      );
    });

    fireEvent.change(screen.getByLabelText('ファイル名または相対パス'), {
      target: { value: 'specs/final.md' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ここへ保存' }));

    await waitFor(() => {
      expect(onSaveToPath).toHaveBeenCalledWith('specs/final.md');
    });
  });

  it('allows opening directly by path when PROPFIND directory listing fails', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'PROPFIND') {
        return new Response(null, { status: 403, statusText: 'Forbidden' });
      }
      if (method === 'GET' && url.endsWith('/dav/direct/readme.md')) {
        return new Response('# Direct Open', { status: 200 });
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    const onOpenedFile = vi.fn();

    render(
      <I18nProvider>
        <CloudBrowserModal
          isOpen
          mode="open"
          remoteSettings={{
            ...createDefaultRemoteSettings(),
            enabled: true,
            endpointUrl: 'https://cloud.example.com/dav/',
            authType: 'none',
          }}
          remoteCredentials={{ username: '', password: '', bearerToken: '' }}
          initialSubPath=""
          initialFileName=""
          onOpenedFile={onOpenedFile}
          onSaveToPath={vi.fn().mockResolvedValue({ ok: true })}
          onClose={vi.fn()}
        />
      </I18nProvider>
    );

    expect(
      await screen.findByText(
        '一覧を取得できない場合でも、下の入力欄へファイル名や相対パス（例: notes/memo.md）を直接指定して開く・保存できます。'
      )
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('ファイル名または相対パス'), {
      target: { value: 'direct/readme.md' },
    });
    fireEvent.click(screen.getByRole('button', { name: '開く' }));

    await waitFor(() => {
      expect(onOpenedFile).toHaveBeenCalledWith('direct/readme.md', '# Direct Open');
    });
  });
});
