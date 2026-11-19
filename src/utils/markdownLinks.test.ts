import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMarkdownLink,
  classifyMarkdownLink,
  computeRelativeMarkdownPath,
  escapeMarkdownLinkLabel,
  formatMarkdownLinkDestination,
  normalizeWebdavPathnameSegments,
  resolveRelativeRemotePath,
  resolveRelativeRemoteUrl,
  stripMarkdownExtension,
} from './markdownLinks.ts';

test('resolveRelativeRemotePath resolves relative, parent, space-root, encoded, and clamped paths', () => {
  assert.equal(resolveRelativeRemotePath('notes/sub/index.md', './a.md'), 'notes/sub/a.md');
  assert.equal(resolveRelativeRemotePath('notes/sub/index.md', 'a.md'), 'notes/sub/a.md');
  assert.equal(resolveRelativeRemotePath('notes/sub/index.md', 'deep/a.md'), 'notes/sub/deep/a.md');
  assert.equal(resolveRelativeRemotePath('notes/sub/index.md', '../a.md'), 'notes/a.md');
  assert.equal(resolveRelativeRemotePath('notes/sub/index.md', '/docs/a.md'), 'docs/a.md');
  assert.equal(resolveRelativeRemotePath('notes/sub/index.md', '../../../../../a.md'), 'a.md');
  assert.equal(
    resolveRelativeRemotePath('notes/index.md', './my%20doc.md?view=1#sec-2'),
    'notes/my doc.md'
  );
  assert.equal(
    resolveRelativeRemotePath('notes/index.md', './%E8%A8%AD%E8%A8%88.md#top'),
    'notes/設計.md'
  );
  assert.equal(resolveRelativeRemotePath('notes/index.md', '//evil.com/a.md'), null);
  assert.equal(resolveRelativeRemotePath('notes/index.md', 'C:\\docs\\a.md'), null);
  assert.equal(resolveRelativeRemotePath('notes/index.md', 'javascript:alert(1)'), null);
});

test('resolveRelativeRemoteUrl resolves within cross-space WebDAV URLs and clamps at space root', () => {
  assert.equal(
    resolveRelativeRemoteUrl(
      'https://cloud.local/dav/spaces/abc$def/dir/a.md',
      '../b.md'
    ),
    'https://cloud.local/dav/spaces/abc$def/b.md'
  );
  assert.equal(
    resolveRelativeRemoteUrl(
      'https://cloud.local/dav/spaces/abc$def/dir/a.md',
      '../../../../../b.md'
    ),
    'https://cloud.local/dav/spaces/abc$def/b.md'
  );
  assert.equal(
    resolveRelativeRemoteUrl(
      'https://cloud.local/remote.php/dav/spaces/space1/docs/index.md',
      './specs/api%20v2.md'
    ),
    'https://cloud.local/remote.php/dav/spaces/space1/docs/specs/api%20v2.md'
  );
  assert.equal(
    resolveRelativeRemoteUrl('/dav/spaces/localspace/sub/a.md', '../b.md'),
    '/dav/spaces/localspace/b.md'
  );
});

test('computeRelativeMarkdownPath produces concise relative paths between cloud documents', () => {
  assert.equal(computeRelativeMarkdownPath('notes/index.md', 'notes/detail.md'), './detail.md');
  assert.equal(
    computeRelativeMarkdownPath('notes/index.md', 'notes/sub/detail.md'),
    './sub/detail.md'
  );
  assert.equal(
    computeRelativeMarkdownPath('notes/sub/index.md', 'notes/detail.md'),
    '../detail.md'
  );
  assert.equal(
    computeRelativeMarkdownPath('notes/sub/index.md', 'notes/other/detail.md'),
    '../other/detail.md'
  );
  assert.equal(computeRelativeMarkdownPath(null, 'notes/detail.md'), './notes/detail.md');
});

test('buildMarkdownLink, formatMarkdownLinkDestination, and escapeMarkdownLinkLabel format safe links', () => {
  assert.equal(escapeMarkdownLinkLabel('Plan [v1]\nDraft'), 'Plan \\[v1\\] Draft');
  assert.equal(formatMarkdownLinkDestination('./100% done (1).md'), './100%25%20done%20%281%29.md');
  assert.equal(formatMarkdownLinkDestination('./設計 メモ.md'), './設計%20メモ.md');
  assert.equal(
    formatMarkdownLinkDestination('https://cloud.local/dav/spaces/1$2/%E8%A8%AD%E8%A8%88%20(1).md'),
    'https://cloud.local/dav/spaces/1$2/%E8%A8%AD%E8%A8%88%20%281%29.md'
  );
  assert.equal(
    formatMarkdownLinkDestination('/dav/spaces/1$2/%E8%A8%AD%E8%A8%88.md'),
    '/dav/spaces/1$2/%E8%A8%AD%E8%A8%88.md'
  );
  assert.equal(
    buildMarkdownLink('Spec [Draft]', './notes/spec (1).md'),
    '[Spec \\[Draft\\]](./notes/spec%20%281%29.md)'
  );
  assert.equal(stripMarkdownExtension('design.spec.markdown'), 'design.spec');
  assert.equal(stripMarkdownExtension('.md'), '.md');
});

test('normalizeWebdavPathnameSegments equates /dav/ and /remote.php/dav/ prefixes', () => {
  assert.deepEqual(
    normalizeWebdavPathnameSegments('/remote.php/dav/spaces/id1/notes/a.md'),
    normalizeWebdavPathnameSegments('/dav/spaces/id1/notes/a.md')
  );
});

test('classifyMarkdownLink distinguishes OpenCloud configured URLs, cross-space URLs, external URLs, and local files', () => {
  const remoteSettings = {
    enabled: true,
    protocol: 'webdav' as const,
    endpointUrl: 'https://cloud.example.com/dav/spaces/space-1/',
  };

  // Configured Space full URL and /remote.php/dav/ variant
  assert.deepEqual(
    classifyMarkdownLink('https://cloud.example.com/dav/spaces/space-1/notes/spec.md#s1', {
      remoteSettings,
    }),
    { kind: 'remote-path', remotePath: 'notes/spec.md', fragment: '#s1' }
  );
  assert.deepEqual(
    classifyMarkdownLink(
      'https://cloud.example.com/remote.php/dav/spaces/space-1/notes/spec.md',
      { remoteSettings }
    ),
    { kind: 'remote-path', remotePath: 'notes/spec.md' }
  );

  // Relative reverse-proxy endpoint /dav/spaces/<id>/
  const proxySettings = {
    enabled: true,
    protocol: 'webdav' as const,
    endpointUrl: '/dav/spaces/space-1/',
  };
  assert.deepEqual(
    classifyMarkdownLink('/dav/spaces/space-1/docs/guide.md', {
      remoteSettings: proxySettings,
    }),
    { kind: 'remote-path', remotePath: 'docs/guide.md' }
  );
  assert.deepEqual(
    classifyMarkdownLink('/remote.php/dav/spaces/space-1/docs/guide.md', {
      remoteSettings: proxySettings,
    }),
    { kind: 'remote-path', remotePath: 'docs/guide.md' }
  );

  // Cross-space same-origin WebDAV URL
  assert.deepEqual(
    classifyMarkdownLink('https://cloud.example.com/dav/spaces/other-space/docs/ref.md', {
      remoteSettings,
    }),
    {
      kind: 'remote-url',
      url: 'https://cloud.example.com/dav/spaces/other-space/docs/ref.md',
      fileName: 'ref.md',
    }
  );

  // Different-origin URL must NEVER be classified as remote
  assert.deepEqual(
    classifyMarkdownLink('https://evil.example.com/dav/spaces/space-1/notes/spec.md', {
      remoteSettings,
    }),
    {
      kind: 'external',
      url: 'https://evil.example.com/dav/spaces/space-1/notes/spec.md',
    }
  );

  // Relative links across active tab contexts
  assert.deepEqual(
    classifyMarkdownLink('../other/readme.md', {
      remoteSettings,
      currentRemotePath: 'notes/sub/index.md',
    }),
    { kind: 'remote-path', remotePath: 'notes/other/readme.md' }
  );
  assert.deepEqual(
    classifyMarkdownLink('../sibling.md', {
      remoteSettings,
      currentRemoteUrl: 'https://cloud.example.com/dav/spaces/other-space/dir/a.md',
    }),
    {
      kind: 'remote-url',
      url: 'https://cloud.example.com/dav/spaces/other-space/sibling.md',
      fileName: 'sibling.md',
    }
  );
  assert.deepEqual(
    classifyMarkdownLink('./child.md', {
      remoteSettings,
      currentLocalFilePath: 'C:\\docs\\main.md',
      isElectron: true,
    }),
    { kind: 'relative-file', relativeHref: './child.md', fileName: 'child.md' }
  );
  assert.deepEqual(
    classifyMarkdownLink('notes/new.md', {
      remoteSettings,
    }),
    { kind: 'remote-path', remotePath: 'notes/new.md' }
  );
  assert.deepEqual(
    classifyMarkdownLink('./local.md', {
      remoteSettings: { enabled: false, protocol: 'webdav', endpointUrl: '' },
    }),
    { kind: 'relative-file', relativeHref: './local.md', fileName: 'local.md' }
  );

  // Non-markdown files, hash anchors, unsafe schemes
  assert.deepEqual(
    classifyMarkdownLink('./diagram.png', { remoteSettings, currentRemotePath: 'index.md' }),
    { kind: 'unsupported' }
  );
  assert.deepEqual(classifyMarkdownLink('#heading-2', { remoteSettings }), {
    kind: 'anchor',
    hash: '#heading-2',
  });
  assert.deepEqual(classifyMarkdownLink('javascript:alert(1)', { remoteSettings }), {
    kind: 'unsupported',
  });
});

test('classifyMarkdownLink recognizes same-origin OpenCloud WebDAV URLs in embed mode', () => {
  assert.deepEqual(
    classifyMarkdownLink(
      'https://nextcloud-pi.tailfb0b8.ts.net:9443/dav/spaces/space-9/docs/readme.md#sec',
      {
        embedHostOrigin: 'https://nextcloud-pi.tailfb0b8.ts.net:9443',
      }
    ),
    {
      kind: 'remote-url',
      url: 'https://nextcloud-pi.tailfb0b8.ts.net:9443/dav/spaces/space-9/docs/readme.md',
      fileName: 'readme.md',
      fragment: '#sec',
    }
  );

  assert.deepEqual(
    classifyMarkdownLink('/dav/spaces/space-9/notes/child.md', {
      embedHostOrigin: 'https://nextcloud-pi.tailfb0b8.ts.net:9443',
    }),
    {
      kind: 'remote-url',
      url: '/dav/spaces/space-9/notes/child.md',
      fileName: 'child.md',
    }
  );

  assert.deepEqual(
    classifyMarkdownLink('https://other.example.com/dav/spaces/space-9/docs/readme.md', {
      embedHostOrigin: 'https://nextcloud-pi.tailfb0b8.ts.net:9443',
    }),
    {
      kind: 'external',
      url: 'https://other.example.com/dav/spaces/space-9/docs/readme.md',
    }
  );
});
