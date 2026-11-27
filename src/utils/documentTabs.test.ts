import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeTabDisplayTitles,
  formatDuplicateFileName,
  getRemoteUrlBaseName,
  getTabBaseFileName,
  isSameLocalFilePath,
  isSupportedDroppedFileName,
  loadPersistedTabsState,
  persistTabsState,
} from './documentTabs.ts';

function installMockLocalStorage(): () => void {
  const store = new Map<string, string>();
  const globalTarget = globalThis as unknown as {
    window?: {
      localStorage: {
        getItem: (key: string) => string | null;
        setItem: (key: string, value: string) => void;
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
    },
  };
  return () => {
    globalTarget.window = previousWindow;
  };
}

test('getTabBaseFileName extracts basename across Windows and POSIX separators', () => {
  assert.equal(getTabBaseFileName('C:\\docs\\readme.md', '無題.md'), 'readme.md');
  assert.equal(getTabBaseFileName('/home/user/notes.markdown', '無題.md'), 'notes.markdown');
  assert.equal(getTabBaseFileName(null, '無題.md'), '無題.md');
});

test('formatDuplicateFileName inserts suffix before extension or at end when absent', () => {
  assert.equal(formatDuplicateFileName('notes.md', 2), 'notes (2).md');
  assert.equal(formatDuplicateFileName('README', 2), 'README (2)');
  assert.equal(formatDuplicateFileName('.hidden', 2), '.hidden (2)');
});

test('computeTabDisplayTitles numbers duplicate filenames and avoids collisions', () => {
  const titles = computeTabDisplayTitles(
    [
      { id: 't1', filePath: 'C:\\a\\notes.md' },
      { id: 't2', filePath: 'D:\\b\\notes (2).md' },
      { id: 't3', filePath: 'E:\\c\\notes.md' },
      { id: 't4', filePath: null },
      { id: 't5', filePath: null },
    ],
    '無題.md'
  );

  assert.deepEqual(titles, {
    t1: 'notes.md',
    t2: 'notes (2).md',
    t3: 'notes (3).md',
    t4: '無題.md',
    t5: '無題 (2).md',
  });
});

test('isSupportedDroppedFileName accepts markdown and plain text extensions', () => {
  assert.equal(isSupportedDroppedFileName('spec.md'), true);
  assert.equal(isSupportedDroppedFileName('SPEC.MD'), true);
  assert.equal(isSupportedDroppedFileName('guide.markdown'), true);
  assert.equal(isSupportedDroppedFileName('memo.txt'), true);
  assert.equal(isSupportedDroppedFileName('unknown', 'text/markdown'), true);
  assert.equal(isSupportedDroppedFileName('diagram.png', 'image/png'), false);
  assert.equal(isSupportedDroppedFileName('manual.pdf', 'application/pdf'), false);
});

test('persistTabsState and loadPersistedTabsState round-trip tabs and migrate legacy draft', () => {
  const restore = installMockLocalStorage();
  try {
    const legacyState = loadPersistedTabsState('tabs-key', 'legacy-key', '# Default');
    assert.equal(legacyState.tabs.length, 1);
    assert.equal(legacyState.tabs[0].content, '# Default');

    window.localStorage.setItem('legacy-key', '# Saved Legacy');
    const migrated = loadPersistedTabsState('tabs-key', 'legacy-key', '# Default');
    assert.equal(migrated.tabs[0].content, '# Saved Legacy');

    const tabs = [
      { id: 'tab-a', filePath: 'a.md', content: '# A', isDirty: false },
      { id: 'tab-b', filePath: 'b.md', content: '# B', isDirty: true },
    ];
    persistTabsState('tabs-key', tabs, 'tab-b');

    const restored = loadPersistedTabsState('tabs-key', 'legacy-key', '# Default');
    assert.equal(restored.activeTabId, 'tab-b');
    assert.deepEqual(restored.tabs, tabs);

    const guideTabs = [
      {
        id: 'tab-g',
        filePath: null,
        content: '# Guide',
        isDirty: false,
        isGuide: true,
        remoteFileName: 'guide.md',
      },
    ];
    persistTabsState('tabs-key', guideTabs, 'tab-g');
    const restoredGuide = loadPersistedTabsState('tabs-key', 'legacy-key', '# Default');
    assert.deepEqual(restoredGuide.tabs, guideTabs);
    assert.deepEqual(
      computeTabDisplayTitles(restoredGuide.tabs, '無題.md', '使い方ガイド.md'),
      { 'tab-g': '使い方ガイド.md' }
    );
    assert.deepEqual(
      computeTabDisplayTitles(
        [{ id: 'tab-r', filePath: null, remoteFileName: 'notes/design.md' }],
        '無題.md',
        '使い方ガイド.md'
      ),
      { 'tab-r': 'design.md' }
    );

    assert.equal(
      getRemoteUrlBaseName(
        'https://cloud.example.com/dav/spaces/other/%E8%A8%AD%E8%A8%88%20%E6%9B%B8.md#sec',
        '無題.md'
      ),
      '設計 書.md'
    );

    const urlTabs = [
      {
        id: 'tab-u',
        filePath: null,
        content: '# Remote URL',
        isDirty: false,
        remoteUrl: 'https://cloud.example.com/dav/spaces/other/%E4%BB%95%E6%A7%98%E6%9B%B8.md',
      },
    ];
    persistTabsState('tabs-key', urlTabs, 'tab-u');
    const restoredUrl = loadPersistedTabsState('tabs-key', 'legacy-key', '# Default');
    assert.deepEqual(restoredUrl.tabs, urlTabs);
    assert.deepEqual(
      computeTabDisplayTitles(restoredUrl.tabs, '無題.md', '使い方ガイド.md'),
      { 'tab-u': '仕様書.md' }
    );
  } finally {
    restore();
  }
});

test('isSameLocalFilePath compares Windows paths case-insensitively and across slashes', () => {
  assert.equal(
    isSameLocalFilePath('C:\\Docs\\Spec.md', 'c:/docs/spec.MD'),
    true
  );
  assert.equal(
    isSameLocalFilePath('\\\\Server\\Share\\Note.md', '//server/share/note.md'.replace(/\//g, '\\')),
    true
  );
  assert.equal(isSameLocalFilePath('C:\\Docs\\a.md', 'C:\\Docs\\b.md'), false);
  assert.equal(isSameLocalFilePath('/tmp/Spec.md', '/tmp/spec.md'), false);
  assert.equal(isSameLocalFilePath(null, 'C:\\Docs\\a.md'), false);
});
