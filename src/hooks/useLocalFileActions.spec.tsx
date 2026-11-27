import { StrictMode, useRef, useState } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarkdownEditorHandle } from '../components/MarkdownEditor';
import { jaCatalog } from '../locales/ja';
import type { ElectronAPI, ExternalFileOpenPayload } from '../types/editor';
import type { PersistedTabsState } from '../utils/documentTabs';
import {
  applyExternalFilesToTabsState,
  resetExternalFileConsumerForTests,
  useLocalFileActions,
} from './useLocalFileActions';

interface HarnessProps {
  initialState: PersistedTabsState;
  onStatusMessage: (msg: string | null) => void;
  onCloseTabSwitcher: () => void;
  activateEditMode: () => void;
  onSnapshot: (state: PersistedTabsState) => void;
}

function LocalFileActionsHarness({
  initialState,
  onStatusMessage,
  onCloseTabSwitcher,
  activateEditMode,
  onSnapshot,
}: HarnessProps) {
  const [tabsState, setTabsState] = useState<PersistedTabsState>(initialState);
  const tabsRef = useRef(tabsState.tabs);
  tabsRef.current = tabsState.tabs;
  onSnapshot(tabsState);

  const activeTab =
    tabsState.tabs.find((tab) => tab.id === tabsState.activeTabId) ?? tabsState.tabs[0];
  const editorRef = useRef<MarkdownEditorHandle>({
    activateEditMode,
  } as unknown as MarkdownEditorHandle);

  useLocalFileActions({
    activeTab,
    activeDisplayTitle: activeTab.filePath ?? '無題.md',
    tabsRef,
    setTabsState,
    lang: 'ja',
    t: jaCatalog,
    isEmbedMode: false,
    requestEmbedSave: vi.fn().mockResolvedValue({ ok: true }),
    remoteSettings: {
      enabled: false,
      protocol: 'webdav',
      endpointUrl: '',
      authType: 'none',
      customMethod: 'PUT',
      payloadFormat: 'raw',
      syncWithLocalSave: false,
      secretPersistence: 'memory',
    },
    remoteCredentials: { username: '', password: '', bearerToken: '' },
    isRemoteLocked: () => false,
    formatRemoteFailureMessage: () => 'remote error',
    editorRef,
    mermaidModalOpen: false,
    onCloseTabSwitcher,
    onStatusMessage,
  });

  return null;
}

describe('useLocalFileActions external file opening', () => {
  const originalElectronAPI = window.electronAPI;

  beforeEach(() => {
    resetExternalFileConsumerForTests();
  });

  afterEach(() => {
    window.electronAPI = originalElectronAPI;
    resetExternalFileConsumerForTests();
  });

  it('consumes pending launch files once under StrictMode and replaces untouched initial tab', async () => {
    const consumeMock = vi.fn<() => Promise<ExternalFileOpenPayload[]>>().mockResolvedValue([
      {
        ok: true,
        filePath: 'C:\\docs\\target.md',
        content: '# Target Content',
      },
    ]);
    const api: ElectronAPI = {
      openFile: vi.fn(),
      saveFile: vi.fn(),
      saveFileAs: vi.fn(),
      consumePendingExternalFiles: consumeMock,
      onExternalFileOpened: vi.fn(() => () => {}),
    };
    window.electronAPI = api;

    const statusSpy = vi.fn();
    const closeSwitcherSpy = vi.fn();
    const activateEditSpy = vi.fn();
    let latestState: PersistedTabsState = {
      activeTabId: 'tab-init',
      tabs: [
        {
          id: 'tab-init',
          filePath: null,
          content: '',
          isDirty: false,
          isGuide: false,
        },
      ],
    };

    render(
      <StrictMode>
        <LocalFileActionsHarness
          initialState={latestState}
          onStatusMessage={statusSpy}
          onCloseTabSwitcher={closeSwitcherSpy}
          activateEditMode={activateEditSpy}
          onSnapshot={(next) => {
            latestState = next;
          }}
        />
      </StrictMode>
    );

    await waitFor(() => {
      expect(latestState.tabs).toHaveLength(1);
      expect(latestState.tabs[0].filePath).toBe('C:\\docs\\target.md');
    });

    expect(consumeMock).toHaveBeenCalledTimes(1);
    expect(latestState.tabs[0].id).toBe('tab-init');
    expect(latestState.tabs[0].content).toBe('# Target Content');
    expect(latestState.tabs[0].isDirty).toBe(false);
    expect(latestState.tabs[0].isGuide).toBe(false);
    expect(statusSpy).toHaveBeenCalledWith('ファイルを開きました: target.md');
    expect(closeSwitcherSpy).toHaveBeenCalled();
    expect(activateEditSpy).toHaveBeenCalled();
  });

  it('opens second-instance files in a new tab and switches to existing tab when same path arrives', async () => {
    let listener: ((payload: ExternalFileOpenPayload) => void) | null = null;
    const api: ElectronAPI = {
      openFile: vi.fn(),
      saveFile: vi.fn(),
      saveFileAs: vi.fn(),
      consumePendingExternalFiles: vi.fn().mockResolvedValue([]),
      onExternalFileOpened: vi.fn((cb) => {
        listener = cb;
        return () => {
          listener = null;
        };
      }),
    };
    window.electronAPI = api;

    const statusSpy = vi.fn();
    let latestState: PersistedTabsState = {
      activeTabId: 'tab-1',
      tabs: [
        {
          id: 'tab-1',
          filePath: 'C:\\Docs\\First.md',
          content: '# First',
          isDirty: false,
        },
      ],
    };

    render(
      <LocalFileActionsHarness
        initialState={latestState}
        onStatusMessage={statusSpy}
        onCloseTabSwitcher={vi.fn()}
        activateEditMode={vi.fn()}
        onSnapshot={(next) => {
          latestState = next;
        }}
      />
    );

    await waitFor(() => {
      expect(listener).not.toBeNull();
    });

    act(() => {
      listener?.({
        ok: true,
        filePath: 'C:\\Docs\\Second.md',
        content: '# Second',
      });
    });

    expect(latestState.tabs).toHaveLength(2);
    expect(latestState.activeTabId).toBe(latestState.tabs[1].id);
    expect(latestState.tabs[1].filePath).toBe('C:\\Docs\\Second.md');
    expect(statusSpy).toHaveBeenCalledWith('ファイルを開きました: Second.md');

    act(() => {
      listener?.({
        ok: true,
        filePath: 'c:/docs/first.MD',
        content: '# First',
      });
    });

    expect(latestState.tabs).toHaveLength(2);
    expect(latestState.activeTabId).toBe('tab-1');
    expect(statusSpy).toHaveBeenCalledWith('すでに開いているタブへ切り替えました: First.md');
  });

  it('reports error status without altering tabs when external file load fails', () => {
    const initial: PersistedTabsState = {
      activeTabId: 'tab-1',
      tabs: [
        {
          id: 'tab-1',
          filePath: null,
          content: '',
          isDirty: false,
          isGuide: false,
        },
      ],
    };

    const result = applyExternalFilesToTabsState(initial, [
      {
        ok: false,
        filePath: 'C:\\docs\\missing.md',
        errorCode: 'not-found',
        error: 'File not found.',
      },
    ]);

    expect(result.nextState).toBe(initial);
    expect(result.openedPaths).toEqual([]);
    expect(result.switchedPaths).toEqual([]);
    expect(result.failedPayloads).toHaveLength(1);
    expect(result.failedPayloads[0].error).toBe('File not found.');
  });
});
