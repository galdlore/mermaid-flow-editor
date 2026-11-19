import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAuthHeaders,
  buildRemoteFolderUrl,
  buildRemoteTargetUrl,
  clearEncryptedCredentials,
  createDefaultRemoteSettings,
  createRemoteWebdavFolder,
  hasEncryptedCredentials,
  joinRemoteRelativePath,
  listRemoteWebdavDirectory,
  loadMarkdownFromRemote,
  loadRemoteSettings,
  normalizeRemoteRelativePath,
  parseWebdavPropfindXml,
  saveEncryptedCredentials,
  saveMarkdownToRemote,
  saveRemoteSettings,
  splitRemoteRelativePath,
  testRemoteConnection,
  unlockEncryptedCredentials,
  validateRemoteEndpointUrl,
} from './remoteStorage.ts';

function installMockLocalStorage(): () => void {
  const store = new Map<string, string>();
  const globalTarget = globalThis as unknown as {
    window?: {
      localStorage: {
        getItem: (key: string) => string | null;
        setItem: (key: string, value: string) => void;
        removeItem: (key: string) => void;
      };
    };
  };
  const previousWindow = globalTarget.window;
  globalTarget.window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
  };
  return () => {
    globalTarget.window = previousWindow;
  };
}

test('validateRemoteEndpointUrl accepts http/https and relative paths when allowed', () => {
  assert.equal(validateRemoteEndpointUrl('', true), 'empty');
  assert.equal(validateRemoteEndpointUrl('https://cloud.example.com/dav/spaces/1/', false), null);
  assert.equal(validateRemoteEndpointUrl('http://192.168.1.50:9200/dav/', false), null);
  assert.equal(validateRemoteEndpointUrl('/dav/spaces/notes/', true), null);
  assert.equal(validateRemoteEndpointUrl('/dav/spaces/notes/', false), 'relative-not-allowed');
  assert.equal(validateRemoteEndpointUrl('//evil.com/dav', true), 'invalid-url');
  assert.equal(validateRemoteEndpointUrl('file:///etc/passwd', true), 'invalid-protocol');
  assert.equal(validateRemoteEndpointUrl('javascript:alert(1)', true), 'invalid-protocol');
});

test('buildRemoteTargetUrl constructs encoded WebDAV and custom HTTP URLs', () => {
  assert.equal(
    buildRemoteTargetUrl(
      { protocol: 'webdav', endpointUrl: 'https://cloud.local/dav/notes/' },
      '設計メモ.md'
    ),
    'https://cloud.local/dav/notes/%E8%A8%AD%E8%A8%88%E3%83%A1%E3%83%A2.md'
  );

  assert.equal(
    buildRemoteTargetUrl(
      { protocol: 'webdav', endpointUrl: '/dav/spaces/docs' },
      'C:\\folder\\readme.md'
    ),
    '/dav/spaces/docs/readme.md'
  );

  assert.equal(
    buildRemoteTargetUrl(
      { protocol: 'custom-http', endpointUrl: 'https://api.local/save?name={filename}' },
      'my doc.md'
    ),
    'https://api.local/save?name=my%20doc.md'
  );

  assert.equal(
    buildRemoteTargetUrl(
      { protocol: 'custom-http', endpointUrl: 'https://api.local/webhook' },
      'doc.md'
    ),
    'https://api.local/webhook'
  );
});

test('buildAuthHeaders generates Basic UTF-8 and Bearer authorization headers', () => {
  const basic = buildAuthHeaders('basic', {
    username: 'taro',
    password: 'pw',
    bearerToken: '',
  });
  assert.equal(basic.Authorization, `Basic ${Buffer.from('taro:pw', 'utf-8').toString('base64')}`);

  const bearer = buildAuthHeaders('bearer', {
    username: '',
    password: '',
    bearerToken: 'tok-123',
  });
  assert.deepEqual(bearer, { Authorization: 'Bearer tok-123' });

  assert.deepEqual(
    buildAuthHeaders('none', { username: 'a', password: 'b', bearerToken: 'c' }),
    {}
  );
});

test('remote settings and encrypted credentials round-trip through localStorage without plaintext leaks', async () => {
  const restore = installMockLocalStorage();
  try {
    const settings = {
      ...createDefaultRemoteSettings(),
      enabled: true,
      endpointUrl: 'https://raspi.local/dav/spaces/personal/',
      syncWithLocalSave: true,
      secretPersistence: 'encrypted' as const,
    };
    saveRemoteSettings(settings, 'test-settings');
    assert.deepEqual(loadRemoteSettings('test-settings'), settings);

    assert.equal(hasEncryptedCredentials('test-secret'), false);

    const creds = {
      username: 'gald',
      password: 'super-secret-password',
      bearerToken: '',
    };
    await saveEncryptedCredentials(creds, 'unlock-key-123', 'test-secret');
    assert.equal(hasEncryptedCredentials('test-secret'), true);

    const storedRaw = window.localStorage.getItem('test-secret') ?? '';
    assert.equal(storedRaw.includes('super-secret-password'), false);
    assert.equal(storedRaw.includes('gald'), false);

    const unlocked = await unlockEncryptedCredentials('unlock-key-123', 'test-secret');
    assert.deepEqual(unlocked, creds);

    await assert.rejects(() => unlockEncryptedCredentials('wrong-key', 'test-secret'));

    clearEncryptedCredentials('test-secret');
    assert.equal(hasEncryptedCredentials('test-secret'), false);
  } finally {
    restore();
  }
});

test('relative path helpers normalize, split, and join safely while preserving Windows basenames', () => {
  assert.equal(normalizeRemoteRelativePath('/notes//sub/../memo.md/'), 'notes/sub/memo.md');
  assert.equal(normalizeRemoteRelativePath('C:\\docs\\readme.md'), 'readme.md');
  assert.deepEqual(splitRemoteRelativePath('notes/work/spec.md'), {
    folderSubPath: 'notes/work',
    fileName: 'spec.md',
  });
  assert.deepEqual(splitRemoteRelativePath('spec.md'), {
    folderSubPath: '',
    fileName: 'spec.md',
  });
  assert.equal(joinRemoteRelativePath('notes/work', 'draft.md'), 'notes/work/draft.md');
  assert.equal(joinRemoteRelativePath('notes/work', '/root.md'), 'root.md');

  assert.equal(
    buildRemoteFolderUrl('https://cloud.local/dav/spaces/1/', '設計 ノート/sub'),
    'https://cloud.local/dav/spaces/1/%E8%A8%AD%E8%A8%88%20%E3%83%8E%E3%83%BC%E3%83%88/sub/'
  );
  assert.equal(
    buildRemoteTargetUrl(
      { protocol: 'webdav', endpointUrl: 'https://cloud.local/dav/spaces/1/' },
      '設計 ノート/memo.md'
    ),
    'https://cloud.local/dav/spaces/1/%E8%A8%AD%E8%A8%88%20%E3%83%8E%E3%83%BC%E3%83%88/memo.md'
  );
});

test('parseWebdavPropfindXml parses OpenCloud d: and default-namespace XML and excludes self folder', () => {
  const openCloudXml = `<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/dav/spaces/personal/notes/</d:href>
    <d:propstat>
      <d:prop>
        <d:resourcetype><d:collection/></d:resourcetype>
        <d:getlastmodified>Thu, 19 Nov 2026 10:00:00 GMT</d:getlastmodified>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
    <d:propstat>
      <d:prop><d:getcontentlength/></d:prop>
      <d:status>HTTP/1.1 404 Not Found</d:status>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/dav/spaces/personal/notes/%E8%A8%AD%E8%A8%88%20%E6%9B%B8.md</d:href>
    <d:propstat>
      <d:prop>
        <d:resourcetype/>
        <d:getcontentlength>1234</d:getcontentlength>
        <d:getlastmodified>Thu, 19 Nov 2026 11:00:00 GMT</d:getlastmodified>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>https://cloud.example.com/dav/spaces/personal/notes/archive/</d:href>
    <d:propstat>
      <d:prop>
        <d:resourcetype><d:collection /></d:resourcetype>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`;

  const entries = parseWebdavPropfindXml(
    openCloudXml,
    'https://cloud.example.com/dav/spaces/personal/notes/',
    'notes'
  );
  assert.equal(entries.length, 2);
  assert.deepEqual(entries[0], {
    name: 'archive',
    relativePath: 'notes/archive',
    isDirectory: true,
    size: null,
    lastModified: null,
  });
  assert.deepEqual(entries[1], {
    name: '設計 書.md',
    relativePath: 'notes/設計 書.md',
    isDirectory: false,
    size: 1234,
    lastModified: 'Thu, 19 Nov 2026 11:00:00 GMT',
  });

  const defaultNsXml = `<multistatus xmlns="DAV:">
    <response>
      <href>/dav/</href>
      <propstat><prop><resourcetype><collection/></resourcetype></prop><status>HTTP/1.1 200 OK</status></propstat>
    </response>
    <response>
      <href>/dav/a%26b.txt</href>
      <propstat><prop><resourcetype/><getcontentlength>42</getcontentlength></prop><status>HTTP/1.1 200 OK</status></propstat>
    </response>
  </multistatus>`;
  const defaultEntries = parseWebdavPropfindXml(defaultNsXml, '/dav/', '');
  assert.equal(defaultEntries.length, 1);
  assert.equal(defaultEntries[0].name, 'a&b.txt');
  assert.equal(defaultEntries[0].size, 42);
});

test('parseWebdavPropfindXml excludes grandchildren and handles reverse-proxy path prefixes', () => {
  const deepXml = `<d:multistatus xmlns:d="DAV:">
    <d:response>
      <d:href>/upstream/dav/notes/</d:href>
      <d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>
    </d:response>
    <d:response>
      <d:href>/upstream/dav/notes/direct.md</d:href>
      <d:propstat><d:prop><d:resourcetype/><d:getcontentlength>10</d:getcontentlength></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>
    </d:response>
    <d:response>
      <d:href>/upstream/dav/notes/sub/</d:href>
      <d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>
    </d:response>
    <d:response>
      <d:href>/upstream/dav/notes/sub/grandchild.md</d:href>
      <d:propstat><d:prop><d:resourcetype/><d:getcontentlength>20</d:getcontentlength></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>
    </d:response>
  </d:multistatus>`;

  const entries = parseWebdavPropfindXml(deepXml, '/dav/notes/', '');
  assert.deepEqual(
    entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory })),
    [
      { name: 'sub', isDirectory: true },
      { name: 'direct.md', isDirectory: false },
    ]
  );
});

test('remoteStorage network operations handle 200/207/201, 401, 405 fallbacks, 413 oversize, and CORS TypeError', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string; headers: Record<string, string>; body?: string }> = [];

  try {
    const baseSettings = {
      ...createDefaultRemoteSettings(),
      enabled: true,
      endpointUrl: 'https://cloud.example.com/dav/',
    };
    const creds = { username: 'alice', password: 'pw', bearerToken: '' };

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      calls.push({
        url,
        method,
        headers: (init?.headers ?? {}) as Record<string, string>,
        body: typeof init?.body === 'string' ? init.body : undefined,
      });

      if (method === 'PROPFIND' && url.endsWith('/dav/')) {
        const xml = `<d:multistatus xmlns:d="DAV:">
          <d:response><d:href>/dav/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
          <d:response><d:href>/dav/spec.md</d:href><d:propstat><d:prop><d:resourcetype/><d:getcontentlength>12</d:getcontentlength></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
        </d:multistatus>`;
        return new Response(xml, { status: 207, statusText: 'Multi-Status' });
      }
      if (method === 'GET' && url.endsWith('/dav/spec.md')) {
        return new Response('# Hello', { status: 200, statusText: 'OK' });
      }
      if (method === 'GET' && url.endsWith('/dav/huge.md')) {
        return new Response('small', {
          status: 200,
          statusText: 'OK',
          headers: { 'content-length': String(11 * 1024 * 1024) },
        });
      }
      if (method === 'MKCOL') {
        return new Response(null, { status: 201, statusText: 'Created' });
      }
      if (method === 'PUT') {
        return new Response(null, { status: 201, statusText: 'Created' });
      }
      if (method === 'OPTIONS') {
        return new Response(null, { status: 405, statusText: 'Method Not Allowed' });
      }
      if (method === 'HEAD') {
        return new Response(null, { status: 200, statusText: 'OK' });
      }
      return new Response(null, { status: 401, statusText: 'Unauthorized' });
    }) as typeof fetch;

    const listRes = await listRemoteWebdavDirectory(baseSettings, creds, '');
    assert.equal(listRes.ok, true);
    assert.equal(listRes.entries.length, 1);
    assert.equal(listRes.entries[0].name, 'spec.md');

    const readRes = await loadMarkdownFromRemote(baseSettings, creds, 'spec.md');
    assert.equal(readRes.ok, true);
    assert.equal(readRes.content, '# Hello');

    const hugeRes = await loadMarkdownFromRemote(baseSettings, creds, 'huge.md');
    assert.equal(hugeRes.ok, false);
    assert.equal(hugeRes.status, 413);

    const mkcolRes = await createRemoteWebdavFolder(baseSettings, creds, 'sub/nested');
    assert.equal(mkcolRes.ok, true);

    const putRes = await saveMarkdownToRemote(baseSettings, creds, 'sub/note.md', '# Body');
    assert.equal(putRes.ok, true);

    const customSettings = {
      ...baseSettings,
      protocol: 'custom-http' as const,
      endpointUrl: 'https://api.example.com/save',
      customMethod: 'POST' as const,
      payloadFormat: 'json' as const,
      authType: 'bearer' as const,
    };
    const bearerCreds = { username: '', password: '', bearerToken: 'tok-xyz' };
    const postRes = await saveMarkdownToRemote(customSettings, bearerCreds, 'doc.md', '# Hi');
    assert.equal(postRes.ok, false);
    assert.equal(postRes.status, 401);
    assert.equal(calls[calls.length - 1].headers.Authorization, 'Bearer tok-xyz');
    assert.equal(calls[calls.length - 1].body, JSON.stringify({ fileName: 'doc.md', content: '# Hi' }));

    const testWebdavFallback = await testRemoteConnection(baseSettings, creds);
    assert.equal(testWebdavFallback.ok, true);
    assert.equal(testWebdavFallback.status, 207);

    const testCustomFallback = await testRemoteConnection(customSettings, bearerCreds);
    assert.equal(testCustomFallback.ok, true);
    assert.equal(testCustomFallback.status, 200);

    globalThis.fetch = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;

    const netErr = await listRemoteWebdavDirectory(baseSettings, creds, '');
    assert.equal(netErr.ok, false);
    assert.equal(netErr.isCorsOrNetworkError, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
