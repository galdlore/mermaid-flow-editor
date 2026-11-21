import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from 'react';
import type { MarkdownEditorHandle } from '../components/MarkdownEditor';
import type { Language } from '../i18n';
import type { TranslationCatalog } from '../locales/types';
import {
  computeTabDisplayTitles,
  createDocumentTabId,
  getTabBaseFileName,
  type DocumentTab,
  type PersistedTabsState,
} from '../utils/documentTabs';
import {
  isFileDragEvent,
  openMarkdownFile,
  readDroppedMarkdownFiles,
  saveHtmlFile,
  saveMarkdownFile,
  saveMarkdownFileAs,
  savePdfFile,
  setBrowserFileHandle,
} from '../utils/fileAdapter';
import {
  buildExportDocumentTitle,
  buildExportHtmlDocument,
  buildHtmlFileName,
  buildPdfFileName,
} from '../utils/htmlExport';
import {
  saveMarkdownToRemote,
  type RemoteCredentials,
  type RemoteRequestResult,
  type RemoteSaveSettings,
} from '../utils/remoteStorage';
import { isUntouchedInitialTab } from './useDocumentTabs';

export interface UseLocalFileActionsOptions {
  activeTab: DocumentTab;
  activeDisplayTitle: string;
  tabsRef: MutableRefObject<DocumentTab[]>;
  setTabsState: Dispatch<SetStateAction<PersistedTabsState>>;
  lang: Language;
  t: TranslationCatalog;
  isEmbedMode: boolean;
  requestEmbedSave: (params: {
    fileId?: string;
    fileName: string;
    remotePath?: string | null;
    content: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  remoteSettings: RemoteSaveSettings;
  remoteCredentials: RemoteCredentials;
  isRemoteLocked: (settings: RemoteSaveSettings, creds: RemoteCredentials) => boolean;
  formatRemoteFailureMessage: (result: RemoteRequestResult) => string;
  editorRef: RefObject<MarkdownEditorHandle>;
  mermaidModalOpen: boolean;
  onCloseTabSwitcher: () => void;
  onStatusMessage: (message: string | null) => void;
}

export function useLocalFileActions({
  activeTab,
  activeDisplayTitle,
  tabsRef,
  setTabsState,
  lang,
  t,
  isEmbedMode,
  requestEmbedSave,
  remoteSettings,
  remoteCredentials,
  isRemoteLocked,
  formatRemoteFailureMessage,
  editorRef,
  mermaidModalOpen,
  onCloseTabSwitcher,
  onStatusMessage,
}: UseLocalFileActionsOptions) {
  const dragDepthRef = useRef(0);
  const [isFileDragOver, setIsFileDragOver] = useState(false);

  const handleOpenFile = useCallback(async () => {
    try {
      const result = await openMarkdownFile();
      if (result.canceled || !result.filePath || typeof result.content !== 'string') {
        return;
      }

      const nextFilePath = result.filePath;
      const nextContent = result.content;
      const reuseActive = isUntouchedInitialTab(activeTab);
      const targetTabId = reuseActive ? activeTab.id : createDocumentTabId();

      setBrowserFileHandle(targetTabId, result.handle ?? null);

      setTabsState((prev) => {
        if (reuseActive && prev.tabs.some((tab) => tab.id === targetTabId)) {
          return {
            activeTabId: targetTabId,
            tabs: prev.tabs.map((tab) =>
              tab.id === targetTabId
                ? {
                    ...tab,
                    filePath: nextFilePath,
                    content: nextContent,
                    isDirty: false,
                    isGuide: false,
                    remoteFileName: null,
                    remoteUrl: null,
                    embedFileId: null,
                    embedReadOnly: false,
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
              filePath: nextFilePath,
              content: nextContent,
              isDirty: false,
              remoteUrl: null,
              embedFileId: null,
              embedReadOnly: false,
            },
          ],
        };
      });

      onStatusMessage(
        t.app.statusOpened(getTabBaseFileName(nextFilePath, t.app.untitledFileName))
      );
      editorRef.current?.activateEditMode();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.app.statusOpenError;
      onStatusMessage(msg);
    }
  }, [activeTab, editorRef, onStatusMessage, setTabsState, t]);

  const handleSaveFile = useCallback(async () => {
    if (isEmbedMode) {
      if (activeTab.embedReadOnly) {
        onStatusMessage(t.app.statusEmbedReadOnly);
        return;
      }
      const targetTabId = activeTab.id;
      const snapshotContent = activeTab.content;
      const targetFileName = getTabBaseFileName(
        activeTab.remoteFileName || activeTab.filePath,
        activeDisplayTitle || t.app.untitledFileName
      );
      const res = await requestEmbedSave({
        fileId: activeTab.embedFileId ?? undefined,
        fileName: targetFileName,
        remotePath: activeTab.remoteFileName,
        content: snapshotContent,
      });
      if (res.ok) {
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
        onStatusMessage(t.app.statusSaved(targetFileName));
      } else {
        const detail =
          res.error === 'timeout'
            ? t.app.statusEmbedTimeout
            : res.error || t.app.statusSaveError;
        onStatusMessage(t.app.statusEmbedSaveError(detail));
      }
      return;
    }

    try {
      const targetTabId = activeTab.id;
      const snapshotContent = activeTab.content;
      const snapshotRemoteFileName = activeTab.remoteFileName;
      const result = await saveMarkdownFile(targetTabId, activeTab.filePath, snapshotContent);
      if (!result.canceled && result.filePath) {
        const savedPath = result.filePath;
        const savedBaseName = getTabBaseFileName(savedPath, t.app.untitledFileName);
        setTabsState((prev) => ({
          ...prev,
          tabs: prev.tabs.map((tab) =>
            tab.id === targetTabId
              ? {
                  ...tab,
                  filePath: savedPath,
                  isDirty: tab.content === snapshotContent ? false : tab.isDirty,
                  isGuide: false,
                }
              : tab
          ),
        }));

        if (
          remoteSettings.enabled &&
          remoteSettings.endpointUrl.trim() &&
          remoteSettings.syncWithLocalSave
        ) {
          if (isRemoteLocked(remoteSettings, remoteCredentials)) {
            onStatusMessage(`${t.app.statusSaved(savedBaseName)} / ${t.app.statusRemoteLocked}`);
            return;
          }
          const syncRemotePath = snapshotRemoteFileName || savedBaseName;
          const remoteRes = await saveMarkdownToRemote(
            remoteSettings,
            remoteCredentials,
            syncRemotePath,
            snapshotContent
          );
          if (remoteRes.ok) {
            setTabsState((prev) => ({
              ...prev,
              tabs: prev.tabs.map((tab) =>
                tab.id === targetTabId ? { ...tab, remoteFileName: syncRemotePath } : tab
              ),
            }));
            onStatusMessage(
              `${t.app.statusSaved(savedBaseName)} / ${t.app.statusRemoteSaved(syncRemotePath)}`
            );
          } else {
            onStatusMessage(
              `${t.app.statusSaved(savedBaseName)} / ${formatRemoteFailureMessage(remoteRes)}`
            );
          }
          return;
        }

        onStatusMessage(t.app.statusSaved(savedBaseName));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.app.statusSaveError;
      onStatusMessage(msg);
    }
  }, [
    activeDisplayTitle,
    activeTab.content,
    activeTab.embedFileId,
    activeTab.embedReadOnly,
    activeTab.filePath,
    activeTab.id,
    activeTab.remoteFileName,
    formatRemoteFailureMessage,
    isEmbedMode,
    isRemoteLocked,
    onStatusMessage,
    remoteCredentials,
    remoteSettings,
    requestEmbedSave,
    setTabsState,
    t,
  ]);

  const handleSaveFileAs = useCallback(async () => {
    try {
      const targetTabId = activeTab.id;
      const snapshotContent = activeTab.content;
      const result = await saveMarkdownFileAs(targetTabId, snapshotContent, activeTab.filePath);
      if (!result.canceled && result.filePath) {
        const savedPath = result.filePath;
        setTabsState((prev) => ({
          ...prev,
          tabs: prev.tabs.map((tab) =>
            tab.id === targetTabId
              ? {
                  ...tab,
                  filePath: savedPath,
                  isDirty: tab.content === snapshotContent ? false : tab.isDirty,
                  isGuide: false,
                }
              : tab
          ),
        }));
        onStatusMessage(
          t.app.statusSaveAs(getTabBaseFileName(savedPath, t.app.untitledFileName))
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.app.statusSaveError;
      onStatusMessage(msg);
    }
  }, [activeTab.content, activeTab.filePath, activeTab.id, onStatusMessage, setTabsState, t]);

  const handlePrint = useCallback(async () => {
    await editorRef.current?.preparePreviewForPrint();
    window.print();
  }, [editorRef]);

  const handleExportHtml = useCallback(async () => {
    try {
      const bodyHtml = (await editorRef.current?.getExportablePreviewHtmlAsync()) ?? '';
      const documentTitle = buildExportDocumentTitle(activeTab.filePath, activeDisplayTitle);
      const suggestedFileName = buildHtmlFileName(activeTab.filePath, activeDisplayTitle);
      const htmlDocument = buildExportHtmlDocument({
        title: documentTitle,
        lang,
        bodyHtml,
      });

      const result = await saveHtmlFile(htmlDocument, suggestedFileName);
      if (!result.canceled && result.filePath) {
        onStatusMessage(
          t.app.statusExportedHtml(
            getTabBaseFileName(result.filePath, suggestedFileName)
          )
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.app.statusExportHtmlError;
      onStatusMessage(msg);
    }
  }, [activeDisplayTitle, activeTab.filePath, editorRef, lang, onStatusMessage, t]);

  const handleExportPdf = useCallback(async () => {
    let keepMountedForPrintDialog = false;
    try {
      await editorRef.current?.preparePreviewForPrint();
      const suggestedFileName = buildPdfFileName(activeTab.filePath, activeDisplayTitle);
      const result = await savePdfFile(suggestedFileName);
      if (result.mode === 'print-dialog') {
        keepMountedForPrintDialog = true;
        onStatusMessage(t.app.statusExportPdfPrintHint);
        requestAnimationFrame(() => {
          window.print();
        });
        return;
      }
      if (!result.canceled && result.filePath) {
        onStatusMessage(
          t.app.statusExportedPdf(
            getTabBaseFileName(result.filePath, suggestedFileName)
          )
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.app.statusExportPdfError;
      onStatusMessage(msg);
    } finally {
      if (!keepMountedForPrintDialog) {
        editorRef.current?.releaseExportPreview();
      }
    }
  }, [activeDisplayTitle, activeTab.filePath, editorRef, onStatusMessage, t]);

  useEffect(() => {
    const resetDragState = (): void => {
      dragDepthRef.current = 0;
      setIsFileDragOver(false);
    };

    const handleDragEnter = (event: DragEvent): void => {
      if (!isFileDragEvent(event.dataTransfer)) {
        return;
      }
      event.preventDefault();
      dragDepthRef.current += 1;
      if (!mermaidModalOpen) {
        setIsFileDragOver(true);
      }
    };

    const handleDragOver = (event: DragEvent): void => {
      if (!isFileDragEvent(event.dataTransfer)) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = mermaidModalOpen ? 'none' : 'copy';
      }
    };

    const handleDragLeave = (event: DragEvent): void => {
      if (dragDepthRef.current <= 0 && !isFileDragEvent(event.dataTransfer)) {
        return;
      }
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsFileDragOver(false);
      }
    };

    const handleDrop = async (event: DragEvent): Promise<void> => {
      const fileDrop = isFileDragEvent(event.dataTransfer);
      if (!fileDrop) {
        return;
      }
      event.preventDefault();
      resetDragState();

      if (mermaidModalOpen || !event.dataTransfer) {
        return;
      }

      try {
        const { files, ignoredCount } = await readDroppedMarkdownFiles(event.dataTransfer);
        if (files.length === 0) {
          if (ignoredCount > 0) {
            onStatusMessage(t.app.statusDroppedUnsupported);
          }
          return;
        }

        const createdTabs: DocumentTab[] = files.map((droppedFile) => {
          const id = createDocumentTabId();
          setBrowserFileHandle(id, droppedFile.handle ?? null);
          return {
            id,
            filePath: droppedFile.fileName,
            content: droppedFile.content,
            isDirty: false,
          };
        });

        const nextActiveId = createdTabs[createdTabs.length - 1].id;
        const previewNextTabs = [...tabsRef.current, ...createdTabs];
        const nextTitles = computeTabDisplayTitles(previewNextTabs, t.app.untitledFileName);
        const openedLabel =
          nextTitles[nextActiveId] ||
          createdTabs[createdTabs.length - 1].filePath ||
          t.app.untitledFileName;

        setTabsState((prev) => ({
          activeTabId: nextActiveId,
          tabs: [...prev.tabs, ...createdTabs],
        }));

        onStatusMessage(t.app.statusDroppedOpened(createdTabs.length, openedLabel));
        onCloseTabSwitcher();
        editorRef.current?.activateEditMode();
      } catch (err) {
        const msg = err instanceof Error ? err.message : t.app.statusDropError;
        onStatusMessage(msg);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
    window.addEventListener('blur', resetDragState);
    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('blur', resetDragState);
    };
  }, [editorRef, mermaidModalOpen, onCloseTabSwitcher, onStatusMessage, setTabsState, t, tabsRef]);

  return {
    isFileDragOver,
    handleOpenFile,
    handleSaveFile,
    handleSaveFileAs,
    handlePrint,
    handleExportHtml,
    handleExportPdf,
  };
}
