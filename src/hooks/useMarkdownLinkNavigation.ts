import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { TranslationCatalog } from '../locales/types';
import {
  getTabBaseFileName,
  type DocumentTab,
  type PersistedTabsState,
} from '../utils/documentTabs';
import { openRelativeMarkdownFile } from '../utils/fileAdapter';
import { classifyMarkdownLink, resolveRelativeRemotePath } from '../utils/markdownLinks';
import {
  loadMarkdownFromRemote,
  loadMarkdownFromRemoteUrl,
  type RemoteCredentials,
  type RemoteRequestResult,
  type RemoteSaveSettings,
} from '../utils/remoteStorage';
import { isElectronEnv } from '../utils/storage';

export interface UseMarkdownLinkNavigationOptions {
  activeTab: DocumentTab;
  displayTitles: Record<string, string>;
  tabsRef: MutableRefObject<DocumentTab[]>;
  setTabsState: Dispatch<SetStateAction<PersistedTabsState>>;
  remoteSettings: RemoteSaveSettings;
  remoteCredentials: RemoteCredentials;
  isRemoteLocked: (settings: RemoteSaveSettings, creds: RemoteCredentials) => boolean;
  ensureRemoteReadyForAction: () => boolean;
  formatRemoteFailureMessage: (result: RemoteRequestResult) => string;
  isEmbedMode: boolean;
  embedParentOrigin: string | null;
  initialEmbedReadOnly: boolean;
  requestEmbedOpenLink: (params: {
    href: string;
    resolvedRemotePath: string | null;
    fromFileId?: string;
    fromRemotePath?: string | null;
  }) => Promise<{
    ok: boolean;
    notFound?: boolean;
    error?: string;
    fileName?: string;
    fileId?: string;
    remotePath?: string | null;
    content?: string;
    readOnly?: boolean;
  }>;
  openOrFocusTab: (
    predicate: (tab: DocumentTab) => boolean,
    newTabData: Omit<DocumentTab, 'id'>,
    switchedMessage: string,
    openedMessage: string
  ) => void;
  t: TranslationCatalog;
  onStatusMessage: (message: string | null) => void;
}

export function useMarkdownLinkNavigation({
  activeTab,
  displayTitles,
  tabsRef,
  setTabsState,
  remoteSettings,
  remoteCredentials,
  isRemoteLocked,
  ensureRemoteReadyForAction,
  formatRemoteFailureMessage,
  isEmbedMode,
  embedParentOrigin,
  initialEmbedReadOnly,
  requestEmbedOpenLink,
  openOrFocusTab,
  t,
  onStatusMessage,
}: UseMarkdownLinkNavigationOptions) {
  const classifyCurrentLink = useCallback(
    (href: string) =>
      classifyMarkdownLink(href, {
        remoteSettings,
        currentRemotePath: activeTab.remoteFileName,
        currentRemoteUrl: activeTab.remoteUrl,
        currentLocalFilePath: activeTab.filePath,
        isElectron: isElectronEnv(),
        embedHostOrigin: isEmbedMode ? embedParentOrigin : null,
      }),
    [
      activeTab.filePath,
      activeTab.remoteFileName,
      activeTab.remoteUrl,
      embedParentOrigin,
      isEmbedMode,
      remoteSettings,
    ]
  );

  const isDocumentLink = useCallback(
    (href: string): boolean => {
      const classified = classifyCurrentLink(href);
      return (
        classified.kind === 'remote-path' ||
        classified.kind === 'remote-url' ||
        classified.kind === 'relative-file'
      );
    },
    [classifyCurrentLink]
  );

  const openRemotePathLink = useCallback(
    async (targetRemotePath: string): Promise<void> => {
      const label = getTabBaseFileName(targetRemotePath, targetRemotePath);
      const existingTab = tabsRef.current.find(
        (tab) => tab.remoteFileName === targetRemotePath
      );
      if (existingTab) {
        setTabsState((prev) => ({ ...prev, activeTabId: existingTab.id }));
        onStatusMessage(t.app.statusSwitchedExistingTab(label));
        return;
      }
      if (!ensureRemoteReadyForAction()) {
        return;
      }
      const res = await loadMarkdownFromRemote(
        remoteSettings,
        remoteCredentials,
        targetRemotePath
      );
      if (!res.ok || typeof res.content !== 'string') {
        onStatusMessage(
          res.status === 404
            ? t.app.statusLinkedFileNotFound(res.fileName || targetRemotePath)
            : formatRemoteFailureMessage(res)
        );
        return;
      }
      const resolvedLabel = getTabBaseFileName(res.remotePath, res.fileName);
      openOrFocusTab(
        (tab) => tab.remoteFileName === res.remotePath,
        {
          filePath: null,
          content: res.content,
          isDirty: false,
          remoteFileName: res.remotePath,
          remoteUrl: null,
          isGuide: false,
        },
        t.app.statusSwitchedExistingTab(resolvedLabel),
        t.app.statusRemoteOpened(resolvedLabel)
      );
    },
    [
      ensureRemoteReadyForAction,
      formatRemoteFailureMessage,
      onStatusMessage,
      openOrFocusTab,
      remoteCredentials,
      remoteSettings,
      setTabsState,
      t,
      tabsRef,
    ]
  );

  const handleOpenMarkdownLink = useCallback(
    async (href: string) => {
      const classified = classifyCurrentLink(href);
      if (classified.kind === 'anchor' || classified.kind === 'unsupported') {
        return;
      }
      if (classified.kind === 'external') {
        window.open(classified.url, '_blank', 'noopener,noreferrer');
        return;
      }

      if (isEmbedMode) {
        const resolvedRemotePath =
          classified.kind === 'remote-path'
            ? classified.remotePath
            : activeTab.remoteFileName && classified.kind === 'relative-file'
              ? resolveRelativeRemotePath(activeTab.remoteFileName, classified.relativeHref)
              : null;
        const resolvedRemoteUrl = classified.kind === 'remote-url' ? classified.url : null;

        const existingEmbedTab = tabsRef.current.find(
          (tab) =>
            (resolvedRemotePath !== null && tab.remoteFileName === resolvedRemotePath) ||
            (resolvedRemoteUrl !== null && tab.remoteUrl === resolvedRemoteUrl)
        );
        if (existingEmbedTab) {
          const existingTitle = getTabBaseFileName(
            existingEmbedTab.remoteFileName ?? null,
            displayTitles[existingEmbedTab.id] || t.app.untitledFileName
          );
          setTabsState((prev) => ({ ...prev, activeTabId: existingEmbedTab.id }));
          onStatusMessage(t.app.statusSwitchedExistingTab(existingTitle));
          return;
        }

        const res = await requestEmbedOpenLink({
          href,
          resolvedRemotePath,
          fromFileId: activeTab.embedFileId ?? undefined,
          fromRemotePath: activeTab.remoteFileName,
        });
        if (!res.ok || typeof res.content !== 'string') {
          if (res.notFound) {
            onStatusMessage(t.app.statusLinkedFileNotFound(res.fileName || href));
          } else {
            const detail =
              res.error === 'timeout' ? t.app.statusEmbedTimeout : res.error || href;
            onStatusMessage(t.app.statusLinkedFileOpenError(detail));
          }
          return;
        }

        const nextRemotePath = res.remotePath?.trim() || resolvedRemotePath || null;
        const nextFileId = res.fileId ?? null;
        const nextTitle = getTabBaseFileName(
          nextRemotePath,
          res.fileName || t.app.untitledFileName
        );
        openOrFocusTab(
          (tab) =>
            (nextFileId !== null && tab.embedFileId === nextFileId) ||
            (nextRemotePath !== null && tab.remoteFileName === nextRemotePath) ||
            (resolvedRemoteUrl !== null && tab.remoteUrl === resolvedRemoteUrl),
          {
            filePath: null,
            content: res.content,
            isDirty: false,
            remoteFileName: nextRemotePath ?? (res.fileName || null),
            remoteUrl: nextRemotePath ? null : resolvedRemoteUrl,
            isGuide: false,
            embedFileId: nextFileId,
            embedReadOnly: res.readOnly ?? initialEmbedReadOnly,
          },
          t.app.statusSwitchedExistingTab(nextTitle),
          t.app.statusOpened(nextTitle)
        );
        return;
      }

      if (classified.kind === 'remote-path') {
        await openRemotePathLink(classified.remotePath);
        return;
      }

      if (classified.kind === 'remote-url') {
        const targetRemoteUrl = classified.url;
        const existingTab = tabsRef.current.find(
          (tab) => tab.remoteUrl === targetRemoteUrl
        );
        if (existingTab) {
          setTabsState((prev) => ({ ...prev, activeTabId: existingTab.id }));
          onStatusMessage(t.app.statusSwitchedExistingTab(classified.fileName));
          return;
        }
        if (!ensureRemoteReadyForAction()) {
          return;
        }
        const res = await loadMarkdownFromRemoteUrl(
          remoteSettings,
          remoteCredentials,
          targetRemoteUrl
        );
        if (!res.ok || typeof res.content !== 'string') {
          onStatusMessage(
            res.status === 404
              ? t.app.statusLinkedFileNotFound(res.fileName || classified.fileName)
              : formatRemoteFailureMessage(res)
          );
          return;
        }
        openOrFocusTab(
          (tab) => tab.remoteUrl === targetRemoteUrl,
          {
            filePath: null,
            content: res.content,
            isDirty: false,
            remoteFileName: null,
            remoteUrl: targetRemoteUrl,
            isGuide: false,
          },
          t.app.statusSwitchedExistingTab(res.fileName),
          t.app.statusRemoteOpened(res.fileName)
        );
        return;
      }

      if (!isElectronEnv()) {
        onStatusMessage(
          !activeTab.filePath && !remoteSettings.enabled
            ? t.app.statusLinkedLocalRequiresSave
            : t.app.statusLinkedLocalBrowserUnsupported
        );
        return;
      }

      if (!activeTab.filePath) {
        onStatusMessage(t.app.statusLinkedLocalRequiresSave);
        return;
      }

      const relRes = await openRelativeMarkdownFile(
        activeTab.filePath,
        classified.relativeHref
      );
      if (!relRes.ok || !relRes.filePath || typeof relRes.content !== 'string') {
        if (
          (relRes.notFound || relRes.errorCode === 'not-found') &&
          activeTab.remoteFileName &&
          remoteSettings.enabled &&
          remoteSettings.protocol === 'webdav' &&
          !isRemoteLocked(remoteSettings, remoteCredentials)
        ) {
          const fallbackRemotePath = resolveRelativeRemotePath(
            activeTab.remoteFileName,
            classified.relativeHref
          );
          if (fallbackRemotePath) {
            await openRemotePathLink(fallbackRemotePath);
            return;
          }
        }

        if (relRes.errorCode === 'unauthorized') {
          onStatusMessage(t.app.statusLinkedLocalRequiresOpen);
        } else if (relRes.notFound || relRes.errorCode === 'not-found') {
          onStatusMessage(t.app.statusLinkedFileNotFound(classified.fileName));
        } else {
          onStatusMessage(
            t.app.statusLinkedFileOpenError(relRes.error || classified.fileName)
          );
        }
        return;
      }

      const openedFilePath = relRes.filePath;
      const baseName = getTabBaseFileName(openedFilePath, classified.fileName);
      openOrFocusTab(
        (tab) => tab.filePath === openedFilePath,
        {
          filePath: openedFilePath,
          content: relRes.content,
          isDirty: false,
          remoteFileName: null,
          remoteUrl: null,
          isGuide: false,
        },
        t.app.statusSwitchedExistingTab(baseName),
        t.app.statusOpened(baseName)
      );
    },
    [
      activeTab.embedFileId,
      activeTab.filePath,
      activeTab.remoteFileName,
      classifyCurrentLink,
      displayTitles,
      ensureRemoteReadyForAction,
      formatRemoteFailureMessage,
      initialEmbedReadOnly,
      isEmbedMode,
      isRemoteLocked,
      onStatusMessage,
      openOrFocusTab,
      openRemotePathLink,
      remoteCredentials,
      remoteSettings,
      requestEmbedOpenLink,
      setTabsState,
      t,
      tabsRef,
    ]
  );

  return {
    classifyCurrentLink,
    isDocumentLink,
    handleOpenMarkdownLink,
  };
}
