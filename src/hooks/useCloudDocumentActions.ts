import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import type { MarkdownEditorHandle } from '../components/MarkdownEditor';
import type { TranslationCatalog } from '../locales/types';
import {
  createDocumentTabId,
  getRemoteUrlBaseName,
  getTabBaseFileName,
  type DocumentTab,
  type PersistedTabsState,
} from '../utils/documentTabs';
import { releaseBrowserFileHandle } from '../utils/fileAdapter';
import {
  saveMarkdownToRemote,
  saveMarkdownToRemoteUrl,
  splitRemoteRelativePath,
  type RemoteCredentials,
  type RemoteRequestResult,
  type RemoteSaveSettings,
} from '../utils/remoteStorage';
import type { CloudBrowserMode } from './useCloudStorage';
import { isUntouchedInitialTab } from './useDocumentTabs';

export interface UseCloudDocumentActionsOptions {
  activeTab: DocumentTab;
  activeDisplayTitle: string;
  setTabsState: Dispatch<SetStateAction<PersistedTabsState>>;
  remoteSettings: RemoteSaveSettings;
  remoteCredentials: RemoteCredentials;
  setCloudBrowserMode: (mode: CloudBrowserMode | null) => void;
  formatRemoteFailureMessage: (result: RemoteRequestResult) => string;
  ensureRemoteReadyForAction: () => boolean;
  openCloudBrowser: (mode: CloudBrowserMode) => void;
  editorRef: RefObject<MarkdownEditorHandle>;
  t: TranslationCatalog;
  onStatusMessage: (message: string | null) => void;
}

export function useCloudDocumentActions({
  activeTab,
  activeDisplayTitle,
  setTabsState,
  remoteSettings,
  remoteCredentials,
  setCloudBrowserMode,
  formatRemoteFailureMessage,
  ensureRemoteReadyForAction,
  openCloudBrowser,
  editorRef,
  t,
  onStatusMessage,
}: UseCloudDocumentActionsOptions) {
  const [pendingLinkLabel, setPendingLinkLabel] = useState('');

  const cloudInitialTarget = useMemo(() => {
    if (activeTab.remoteFileName) {
      const split = splitRemoteRelativePath(activeTab.remoteFileName);
      return {
        subPath: split.folderSubPath,
        fileName: split.fileName || activeDisplayTitle,
      };
    }
    return {
      subPath: '',
      fileName: activeTab.filePath
        ? getTabBaseFileName(activeTab.filePath, t.app.untitledFileName)
        : activeDisplayTitle,
    };
  }, [activeDisplayTitle, activeTab.filePath, activeTab.remoteFileName, t.app.untitledFileName]);

  const handleOpenFromCloud = useCallback(() => {
    openCloudBrowser('open');
  }, [openCloudBrowser]);

  const handleSaveToCloudAs = useCallback(() => {
    openCloudBrowser('save-as');
  }, [openCloudBrowser]);

  const handleCloudFileOpened = useCallback(
    (remotePath: string, content: string) => {
      const reuseActive = isUntouchedInitialTab(activeTab);
      const targetTabId = reuseActive ? activeTab.id : createDocumentTabId();
      if (reuseActive) {
        releaseBrowserFileHandle(targetTabId);
      }

      setTabsState((prev) => {
        if (reuseActive && prev.tabs.some((tab) => tab.id === targetTabId)) {
          return {
            activeTabId: targetTabId,
            tabs: prev.tabs.map((tab) =>
              tab.id === targetTabId
                ? {
                    ...tab,
                    filePath: null,
                    content,
                    isDirty: false,
                    remoteFileName: remotePath,
                    remoteUrl: null,
                    isGuide: false,
                  }
                : tab
            ),
          };
        }
        return {
          activeTabId: targetTabId,
          tabs: [
            ...prev.tabs,
            {
              id: targetTabId,
              filePath: null,
              content,
              isDirty: false,
              remoteFileName: remotePath,
              remoteUrl: null,
              isGuide: false,
            },
          ],
        };
      });

      setCloudBrowserMode(null);
      onStatusMessage(t.app.statusRemoteOpened(getTabBaseFileName(remotePath, remotePath)));
      editorRef.current?.activateEditMode();
    },
    [activeTab, editorRef, onStatusMessage, setCloudBrowserMode, setTabsState, t]
  );

  const handleSaveCloudTarget = useCallback(
    async (remotePath: string): Promise<{ ok: boolean; errorText?: string }> => {
      const targetTabId = activeTab.id;
      const snapshotContent = activeTab.content;
      const result = await saveMarkdownToRemote(
        remoteSettings,
        remoteCredentials,
        remotePath,
        snapshotContent
      );
      if (result.ok) {
        setTabsState((prev) => ({
          ...prev,
          tabs: prev.tabs.map((tab) =>
            tab.id === targetTabId
              ? {
                  ...tab,
                  remoteFileName: remotePath,
                  remoteUrl: null,
                  isDirty: tab.content === snapshotContent ? false : tab.isDirty,
                  isGuide: false,
                }
              : tab
          ),
        }));
        setCloudBrowserMode(null);
        onStatusMessage(t.app.statusRemoteSaved(remotePath));
        return { ok: true };
      }
      return {
        ok: false,
        errorText: formatRemoteFailureMessage(result),
      };
    },
    [
      activeTab.content,
      activeTab.id,
      formatRemoteFailureMessage,
      onStatusMessage,
      remoteCredentials,
      remoteSettings,
      setCloudBrowserMode,
      setTabsState,
      t,
    ]
  );

  const handleSaveToCloud = useCallback(async () => {
    if (!ensureRemoteReadyForAction()) {
      return;
    }

    if (!activeTab.remoteFileName && activeTab.remoteUrl) {
      const targetTabId = activeTab.id;
      const snapshotContent = activeTab.content;
      const targetUrl = activeTab.remoteUrl;
      const result = await saveMarkdownToRemoteUrl(
        remoteSettings,
        remoteCredentials,
        targetUrl,
        snapshotContent
      );
      if (result.ok) {
        setTabsState((prev) => ({
          ...prev,
          tabs: prev.tabs.map((tab) =>
            tab.id === targetTabId
              ? {
                  ...tab,
                  isDirty: tab.content === snapshotContent ? false : tab.isDirty,
                  isGuide: false,
                }
              : tab
          ),
        }));
        onStatusMessage(
          t.app.statusRemoteSaved(getRemoteUrlBaseName(targetUrl, t.app.untitledFileName))
        );
      } else {
        onStatusMessage(formatRemoteFailureMessage(result));
      }
      return;
    }

    const targetPath = activeTab.remoteFileName
      ? activeTab.remoteFileName
      : activeTab.filePath
        ? getTabBaseFileName(activeTab.filePath, t.app.untitledFileName)
        : null;

    if (!targetPath) {
      setCloudBrowserMode('save-as');
      return;
    }

    const res = await handleSaveCloudTarget(targetPath);
    if (!res.ok && res.errorText) {
      onStatusMessage(res.errorText);
    }
  }, [
    activeTab.content,
    activeTab.filePath,
    activeTab.id,
    activeTab.remoteFileName,
    activeTab.remoteUrl,
    ensureRemoteReadyForAction,
    formatRemoteFailureMessage,
    handleSaveCloudTarget,
    onStatusMessage,
    remoteCredentials,
    remoteSettings,
    setCloudBrowserMode,
    setTabsState,
    t,
  ]);

  const handleOpenCloudLinkInserter = useCallback(() => {
    const selected = editorRef.current?.getSelectedText() ?? '';
    setPendingLinkLabel(selected);
    openCloudBrowser('insert-link');
  }, [editorRef, openCloudBrowser]);

  const handleInsertCloudLink = useCallback(
    (label: string, href: string) => {
      editorRef.current?.insertLink(label, href);
      setCloudBrowserMode(null);
      setPendingLinkLabel('');
      onStatusMessage(t.app.statusCloudLinkInserted(label));
    },
    [editorRef, onStatusMessage, setCloudBrowserMode, t]
  );

  return {
    pendingLinkLabel,
    setPendingLinkLabel,
    cloudInitialTarget,
    handleOpenFromCloud,
    handleSaveToCloudAs,
    handleCloudFileOpened,
    handleSaveCloudTarget,
    handleSaveToCloud,
    handleOpenCloudLinkInserter,
    handleInsertCloudLink,
  };
}
