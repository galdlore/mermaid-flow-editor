import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmbedDirtyChangeMessage,
  createEmbedOpenLinkRequestMessage,
  createEmbedReadyMessage,
  createEmbedSaveRequestMessage,
  EMBED_CHANNEL,
  EMBED_PROTOCOL_VERSION,
  isAllowedEmbedMessageEvent,
  parseEmbedConfig,
  parseEmbedParentMessage,
  parseHttpOrigin,
} from './embedBridge.ts';

test('parseHttpOrigin validates only http and https origins', () => {
  assert.equal(
    parseHttpOrigin('https://nextcloud-pi.tailfb0b8.ts.net:9443/apps/files/'),
    'https://nextcloud-pi.tailfb0b8.ts.net:9443'
  );
  assert.equal(parseHttpOrigin('http://localhost:9200'), 'http://localhost:9200');
  assert.equal(parseHttpOrigin('javascript:alert(1)'), null);
  assert.equal(parseHttpOrigin('file:///etc/passwd'), null);
  assert.equal(parseHttpOrigin('//evil.example.com'), null);
  assert.equal(parseHttpOrigin(''), null);
});

test('parseEmbedConfig parses query params, referrer fallback, and rejects unsafe origins', () => {
  assert.deepEqual(parseEmbedConfig('', ''), {
    enabled: false,
    parentOrigin: null,
    readOnly: false,
  });

  assert.deepEqual(
    parseEmbedConfig(
      '?embed=1&origin=https%3A%2F%2Fcloud.example.com%3A9443&mode=split&lang=en&readonly=true',
      'https://other.example.com/page'
    ),
    {
      enabled: true,
      parentOrigin: 'https://cloud.example.com:9443',
      initialMode: 'split',
      initialLang: 'en',
      readOnly: true,
    }
  );

  assert.deepEqual(
    parseEmbedConfig('?embed=true&mode=wysiwyg&lang=ja', 'https://ref.example.com/path/doc'),
    {
      enabled: true,
      parentOrigin: 'https://ref.example.com',
      initialMode: 'wysiwyg',
      initialLang: 'ja',
      readOnly: false,
    }
  );

  assert.deepEqual(
    parseEmbedConfig('?embed=1&origin=javascript:alert(1)&mode=invalid&lang=fr', 'null'),
    {
      enabled: true,
      parentOrigin: null,
      readOnly: false,
    }
  );
});

test('isAllowedEmbedMessageEvent requires strict origin and source equality', () => {
  const fakeParent = { postMessage: () => undefined };
  const otherWindow = { postMessage: () => undefined };

  assert.equal(
    isAllowedEmbedMessageEvent(
      'https://cloud.example.com',
      fakeParent,
      'https://cloud.example.com',
      fakeParent
    ),
    true
  );
  assert.equal(
    isAllowedEmbedMessageEvent(
      'https://evil.example.com',
      fakeParent,
      'https://cloud.example.com',
      fakeParent
    ),
    false
  );
  assert.equal(
    isAllowedEmbedMessageEvent(
      'https://cloud.example.com',
      otherWindow,
      'https://cloud.example.com',
      fakeParent
    ),
    false
  );
  assert.equal(
    isAllowedEmbedMessageEvent('https://cloud.example.com', fakeParent, null, fakeParent),
    false
  );
});

test('parseEmbedParentMessage validates protocol envelope and fields', () => {
  const loadMsg = parseEmbedParentMessage({
    channel: EMBED_CHANNEL,
    version: EMBED_PROTOCOL_VERSION,
    type: 'load-document',
    fileId: 'f-1',
    fileName: 'spec.md',
    remotePath: 'docs/spec.md',
    content: '# Spec',
    readOnly: false,
    openInNewTab: true,
    lang: 'ja',
    editorMode: 'split',
  });
  assert.deepEqual(loadMsg, {
    channel: EMBED_CHANNEL,
    version: EMBED_PROTOCOL_VERSION,
    type: 'load-document',
    fileId: 'f-1',
    fileName: 'spec.md',
    remotePath: 'docs/spec.md',
    content: '# Spec',
    readOnly: false,
    openInNewTab: true,
    lang: 'ja',
    editorMode: 'split',
  });

  assert.deepEqual(
    parseEmbedParentMessage({
      channel: EMBED_CHANNEL,
      version: EMBED_PROTOCOL_VERSION,
      type: 'save-result',
      requestId: 'req-1',
      ok: true,
    }),
    {
      channel: EMBED_CHANNEL,
      version: EMBED_PROTOCOL_VERSION,
      type: 'save-result',
      requestId: 'req-1',
      ok: true,
      error: undefined,
    }
  );

  assert.deepEqual(
    parseEmbedParentMessage({
      channel: EMBED_CHANNEL,
      version: EMBED_PROTOCOL_VERSION,
      type: 'open-link-result',
      requestId: 'req-2',
      ok: false,
      notFound: true,
      error: 'Not found',
    }),
    {
      channel: EMBED_CHANNEL,
      version: EMBED_PROTOCOL_VERSION,
      type: 'open-link-result',
      requestId: 'req-2',
      ok: false,
      fileId: undefined,
      fileName: undefined,
      remotePath: undefined,
      content: undefined,
      readOnly: undefined,
      notFound: true,
      error: 'Not found',
    }
  );

  assert.deepEqual(
    parseEmbedParentMessage({
      channel: EMBED_CHANNEL,
      version: EMBED_PROTOCOL_VERSION,
      type: 'request-save',
      requestId: 'host-save-1',
    }),
    {
      channel: EMBED_CHANNEL,
      version: EMBED_PROTOCOL_VERSION,
      type: 'request-save',
      requestId: 'host-save-1',
    }
  );

  assert.equal(parseEmbedParentMessage(null), null);
  assert.equal(
    parseEmbedParentMessage({
      channel: 'other-channel',
      version: EMBED_PROTOCOL_VERSION,
      type: 'request-save',
    }),
    null
  );
  assert.equal(
    parseEmbedParentMessage({
      channel: EMBED_CHANNEL,
      version: 99,
      type: 'request-save',
    }),
    null
  );
  assert.equal(
    parseEmbedParentMessage({
      channel: EMBED_CHANNEL,
      version: EMBED_PROTOCOL_VERSION,
      type: 'load-document',
      fileName: 'a.md',
    }),
    null
  );
  assert.equal(
    parseEmbedParentMessage({
      channel: EMBED_CHANNEL,
      version: EMBED_PROTOCOL_VERSION,
      type: 'save-result',
      requestId: '',
      ok: true,
    }),
    null
  );
});

test('embed child message builders emit well-formed envelopes', () => {
  assert.deepEqual(createEmbedReadyMessage(), {
    channel: EMBED_CHANNEL,
    version: EMBED_PROTOCOL_VERSION,
    type: 'ready',
    capabilities: { save: true, linkedDocs: true, dirtyState: true },
  });

  assert.deepEqual(createEmbedDirtyChangeMessage(true, 'file-1'), {
    channel: EMBED_CHANNEL,
    version: EMBED_PROTOCOL_VERSION,
    type: 'dirty-change',
    fileId: 'file-1',
    isDirty: true,
  });

  assert.deepEqual(
    createEmbedSaveRequestMessage({
      requestId: 'r-1',
      fileId: 'file-1',
      fileName: 'doc.md',
      remotePath: 'notes/doc.md',
      content: '# Body',
    }),
    {
      channel: EMBED_CHANNEL,
      version: EMBED_PROTOCOL_VERSION,
      type: 'save-request',
      requestId: 'r-1',
      fileId: 'file-1',
      fileName: 'doc.md',
      remotePath: 'notes/doc.md',
      content: '# Body',
    }
  );

  assert.deepEqual(
    createEmbedOpenLinkRequestMessage({
      requestId: 'r-2',
      href: './sub.md',
      resolvedRemotePath: 'notes/sub.md',
      fromFileId: 'file-1',
      fromRemotePath: 'notes/doc.md',
    }),
    {
      channel: EMBED_CHANNEL,
      version: EMBED_PROTOCOL_VERSION,
      type: 'open-link-request',
      requestId: 'r-2',
      href: './sub.md',
      resolvedRemotePath: 'notes/sub.md',
      fromFileId: 'file-1',
      fromRemotePath: 'notes/doc.md',
    }
  );
});
