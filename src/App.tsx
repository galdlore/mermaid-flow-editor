import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import Toolbar from './components/Toolbar';
import TabBar from './components/TabBar';
import MarkdownEditor, { type MarkdownEditorHandle } from './components/MarkdownEditor';
import { useCloudStorage } from './hooks/useCloudStorage';
import {
  INITIAL_MARKDOWN_EN,
  INITIAL_MARKDOWN_JA,
  getInitialMarkdownByLang,
  useI18n,
  type Language,
} from './i18n';
import {
  computeTabDisplayTitles,
  createDocumentTabId,
  getTabBaseFileName,
  loadPersistedTabsState,
  persistTabsState,
  TABS_STORAGE_KEY,
  type DocumentTab,
  type PersistedTabsState,
} from './utils/documentTabs';
import {
  isFileDragEvent,
  openMarkdownFile,
  readDroppedMarkdownFiles,
  releaseBrowserFileHandle,
  saveHtmlFile,
  saveMarkdownFile,
  saveMarkdownFileAs,
  savePdfFile,
  setBrowserFileHandle,
} from './utils/fileAdapter';
import {
  buildExportDocumentTitle,
  buildExportHtmlDocument,
  buildHtmlFileName,
  buildPdfFileName,
} from './utils/htmlExport';
import { replaceMermaidBlock } from './utils/markdownMermaidBlocks';
import type { TabSizeOption } from './utils/markdownTabIndent';
import { saveMarkdownToRemote, splitRemoteRelativePath } from './utils/remoteStorage';
import { isElectronEnv, readLocalStorage, writeLocalStorage } from './utils/storage';

const MermaidModal = lazy(() => import('./components/MermaidModal'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const CloudBrowserModal = lazy(() => import('./components/CloudBrowserModal'));

const LEGACY_DRAFT_STORAGE_KEY = 'mermaid-flow-editor:draft';
const EDITOR_MODE_STORAGE_KEY = 'mermaid-flow-editor:editor-mode';
const TAB_SIZE_STORAGE_KEY = 'mermaid-flow-editor:tab-size';

function loadInitialTabSize(): TabSizeOption {
  const raw = Number(readLocalStorage(TAB_SIZE_STORAGE_KEY));
  if (raw === 4) {
    return 4;
  }
  return 2;
}

function loadInitialEditorMode(): 'wysiwyg' | 'split' {
  const saved = readLocalStorage(EDITOR_MODE_STORAGE_KEY);
  if (saved === 'wysiwyg' || saved === 'split') {
    return saved;
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 768px)').matches) {
    return 'wysiwyg';
  }
  return 'split';
}

function createInitialTabsState(lang: Language): PersistedTabsState {
  const defaultSample = getInitialMarkdownByLang(lang);
  if (isElectronEnv()) {
    const id = createDocumentTabId();
    return {
      activeTabId: id,
      tabs: [
        {
          id,
          filePath: null,
          content: defaultSample,
          isDirty: false,
          isGuide: true,
        },
      ],
    };
  }
  return loadPersistedTabsState(TABS_STORAGE_KEY, LEGACY_DRAFT_STORAGE_KEY, defaultSample);
}

function isUntouchedInitialTab(tab: DocumentTab): boolean {
  if (tab.isDirty || tab.filePath !== null) {
    return false;
  }
  return (
    tab.content.trim().length === 0 ||
    tab.content === INITIAL_MARKDOWN_JA ||
    tab.content === INITIAL_MARKDOWN_EN
  );
}

export default function App() {
  const { lang, t } = useI18n();
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const dragDepthRef = useRef(0);

  const [tabsState, setTabsState] = useState<PersistedTabsState>(() =>
    createInitialTabsState(lang)
  );
  const tabsRef = useRef(tabsState.tabs);
  tabsRef.current = tabsState.tabs;

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [tabSwitcherOpen, setTabSwitcherOpen] = useState(false);
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const [editorMode, setEditorMode] = useState<'wysiwyg' | 'split'>(loadInitialEditorMode);
  const [tabSize, setTabSize] = useState<TabSizeOption>(loadInitialTabSize);

  const {
    settingsModalOpen,
    setSettingsModalOpen,
    cloudBrowserMode,
    setCloudBrowserMode,
    remoteSettings,
    remoteCredentials,
    hasStoredSecret,
    isSecretUnlocked,
    isRemoteLocked,
    formatRemoteFailureMessage,
    handleUnlockRemoteCredentials,
    handleClearStoredRemoteCredentials,
    handleSaveSettingsModal,
    ensureRemoteReadyForAction,
    openCloudBrowser,
  } = useCloudStorage({ t, onStatusMessage: setStatusMessage });

  const handleChangeEditorMode = useCallback((nextMode: 'wysiwyg' | 'split') => {
    setEditorMode(nextMode);
    writeLocalStorage(EDITOR_MODE_STORAGE_KEY, nextMode);
  }, []);

  const handleChangeTabSize = useCallback((nextSize: TabSizeOption) => {
    setTabSize(nextSize);
    writeLocalStorage(TAB_SIZE_STORAGE_KEY, String(nextSize));
  }, []);

  const [mermaidModalOpen, setMermaidModalOpen] = useState(false);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(null);
  const [editingInitialCode, setEditingInitialCode] = useState('');

  const { tabs, activeTabId } = tabsState;

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0],
    [tabs, activeTabId]
  );

  const activeTabIdRef = useRef(activeTab.id);
  activeTabIdRef.current = activeTab.id;
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayTitles = useMemo(
    () => computeTabDisplayTitles(tabs, t.app.untitledFileName, t.app.guideFileName),
    [tabs, t.app.untitledFileName, t.app.guideFileName]
  );

  const activeDisplayTitle = displayTitles[activeTab.id] || t.app.untitledFileName;

  useEffect(() => {
    document.title = `${activeTab.isDirty ? '* ' : ''}${activeDisplayTitle} - Mermaid Markdown Editor`;
  }, [activeDisplayTitle, activeTab.isDirty]);

  useEffect(() => {
    const targetSample = getInitialMarkdownByLang(lang);
    setTabsState((prev) => {
      let changed = false;
      const nextTabs = prev.tabs.map((tab) => {
        if (
          !tab.isDirty &&
          tab.filePath === null &&
          (tab.content === INITIAL_MARKDOWN_JA || tab.content === INITIAL_MARKDOWN_EN) &&
          tab.content !== targetSample
        ) {
          changed = true;
          return { ...tab, content: targetSample };
        }
        return tab;
      });
      return changed ? { ...prev, tabs: nextTabs } : prev;
    });
  }, [lang]);

  useEffect(() => {
    if (isElectronEnv()) {
      return;
    }
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      persistTabsState(TABS_STORAGE_KEY, tabsRef.current, activeTabIdRef.current);
    }, 350);

    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [tabs, activeTab.id]);

  useEffect(() => {
    if (isElectronEnv()) {
      return;
    }
    const flushNow = (): void => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      persistTabsState(TABS_STORAGE_KEY, tabsRef.current, activeTabIdRef.current);
    };
    window.addEventListener('pagehide', flushNow);
    window.addEventListener('beforeunload', flushNow);
    return () => {
      window.removeEventListener('pagehide', flushNow);
      window.removeEventListener('beforeunload', flushNow);
    };
  }, []);

  const handleChangeText = useCallback(
    (next: string) => {
      setTabsState((prev) => ({
        ...prev,
        tabs: prev.tabs.map((tab) =>
          tab.id === prev.activeTabId ? { ...tab, content: next, isDirty: true } : tab
        ),
      }));
    },
    []
  );

  const handleSelectTab = useCallback((tabId: string) => {
    setTabsState((prev) =>
      prev.tabs.some((tab) => tab.id === tabId) ? { ...prev, activeTabId: tabId } : prev
    );
  }, []);

  const handleNewTab = useCallback(() => {
    const newTabId = createDocumentTabId();
    setTabsState((prev) => ({
      activeTabId: newTabId,
      tabs: [
        ...prev.tabs,
        {
          id: newTabId,
          filePath: null,
          content: '',
          isDirty: false,
        },
      ],
    }));
    setStatusMessage(t.app.statusNewCreated);
    editorRef.current?.activateEditMode();
  }, [t]);

  const handleOpenHelpGuide = useCallback(() => {
    const guideContent = getInitialMarkdownByLang(lang);
    const existingGuide = tabsRef.current.find(
      (tab) => tab.isGuide && !tab.isDirty && tab.filePath === null
    );
    if (existingGuide) {
      setTabsState((prev) => ({
        activeTabId: existingGuide.id,
        tabs: prev.tabs.map((tab) =>
          tab.id === existingGuide.id ? { ...tab, content: guideContent } : tab
        ),
      }));
      setStatusMessage(t.app.statusHelpOpened);
      return;
    }

    const newTabId = createDocumentTabId();
    setTabsState((prev) => ({
      activeTabId: newTabId,
      tabs: [
        ...prev.tabs,
        {
          id: newTabId,
          filePath: null,
          content: guideContent,
          isDirty: false,
          isGuide: true,
        },
      ],
    }));
    setStatusMessage(t.app.statusHelpOpened);
  }, [lang, t]);

  const handleCloseTab = useCallback(
    (tabId: string) => {
      const targetIndex = tabs.findIndex((tab) => tab.id === tabId);
      if (targetIndex < 0) {
        return;
      }
      const targetTab = tabs[targetIndex];
      const targetTitle = displayTitles[tabId] || t.app.untitledFileName;

      if (targetTab.isDirty && !window.confirm(t.app.confirmCloseTab(targetTitle))) {
        return;
      }

      releaseBrowserFileHandle(tabId);

      setTabsState((prev) => {
        const index = prev.tabs.findIndex((tab) => tab.id === tabId);
        if (index < 0) {
          return prev;
        }
        if (prev.tabs.length <= 1) {
          const freshId = createDocumentTabId();
          return {
            activeTabId: freshId,
            tabs: [
              {
                id: freshId,
                filePath: null,
                content: '',
                isDirty: false,
              },
            ],
          };
        }

        const remaining = prev.tabs.filter((tab) => tab.id !== tabId);
        const nextActiveId =
          prev.activeTabId === tabId
            ? remaining[Math.min(index, remaining.length - 1)].id
            : prev.activeTabId;
        return {
          activeTabId: nextActiveId,
          tabs: remaining,
        };
      });
    },
    [displayTitles, t, tabs]
  );

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
            },
          ],
        };
      });

      setStatusMessage(
        t.app.statusOpened(getTabBaseFileName(nextFilePath, t.app.untitledFileName))
      );
      editorRef.current?.activateEditMode();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.app.statusOpenError;
      setStatusMessage(msg);
    }
  }, [activeTab, t]);

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
              isGuide: false,
            },
          ],
        };
      });

      setCloudBrowserMode(null);
      setStatusMessage(t.app.statusRemoteOpened(getTabBaseFileName(remotePath, remotePath)));
      editorRef.current?.activateEditMode();
    },
    [activeTab, setCloudBrowserMode, t]
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
                  isDirty: tab.content === snapshotContent ? false : tab.isDirty,
                  isGuide: false,
                }
              : tab
          ),
        }));
        setCloudBrowserMode(null);
        setStatusMessage(t.app.statusRemoteSaved(remotePath));
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
      remoteCredentials,
      remoteSettings,
      setCloudBrowserMode,
      t,
    ]
  );

  const handleSaveToCloud = useCallback(async () => {
    if (!ensureRemoteReadyForAction()) {
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
      setStatusMessage(res.errorText);
    }
  }, [
    activeTab.filePath,
    activeTab.remoteFileName,
    ensureRemoteReadyForAction,
    handleSaveCloudTarget,
    setCloudBrowserMode,
    t,
  ]);

  const handleSaveFile = useCallback(async () => {
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
            setStatusMessage(`${t.app.statusSaved(savedBaseName)} / ${t.app.statusRemoteLocked}`);
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
            setStatusMessage(
              `${t.app.statusSaved(savedBaseName)} / ${t.app.statusRemoteSaved(syncRemotePath)}`
            );
          } else {
            setStatusMessage(
              `${t.app.statusSaved(savedBaseName)} / ${formatRemoteFailureMessage(remoteRes)}`
            );
          }
          return;
        }

        setStatusMessage(t.app.statusSaved(savedBaseName));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.app.statusSaveError;
      setStatusMessage(msg);
    }
  }, [
    activeTab.content,
    activeTab.filePath,
    activeTab.id,
    activeTab.remoteFileName,
    formatRemoteFailureMessage,
    isRemoteLocked,
    remoteCredentials,
    remoteSettings,
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
        setStatusMessage(
          t.app.statusSaveAs(getTabBaseFileName(savedPath, t.app.untitledFileName))
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.app.statusSaveError;
      setStatusMessage(msg);
    }
  }, [activeTab.content, activeTab.filePath, activeTab.id, t]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleExportHtml = useCallback(async () => {
    try {
      const bodyHtml = editorRef.current?.getExportablePreviewHtml() ?? '';
      const documentTitle = buildExportDocumentTitle(activeTab.filePath, activeDisplayTitle);
      const suggestedFileName = buildHtmlFileName(activeTab.filePath, activeDisplayTitle);
      const htmlDocument = buildExportHtmlDocument({
        title: documentTitle,
        lang,
        bodyHtml,
      });

      const result = await saveHtmlFile(htmlDocument, suggestedFileName);
      if (!result.canceled && result.filePath) {
        setStatusMessage(
          t.app.statusExportedHtml(
            getTabBaseFileName(result.filePath, suggestedFileName)
          )
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.app.statusExportHtmlError;
      setStatusMessage(msg);
    }
  }, [activeDisplayTitle, activeTab.filePath, lang, t]);

  const handleExportPdf = useCallback(async () => {
    try {
      const suggestedFileName = buildPdfFileName(activeTab.filePath, activeDisplayTitle);
      const result = await savePdfFile(suggestedFileName);
      if (result.mode === 'print-dialog') {
        setStatusMessage(t.app.statusExportPdfPrintHint);
        requestAnimationFrame(() => {
          window.print();
        });
        return;
      }
      if (!result.canceled && result.filePath) {
        setStatusMessage(
          t.app.statusExportedPdf(
            getTabBaseFileName(result.filePath, suggestedFileName)
          )
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.app.statusExportPdfError;
      setStatusMessage(msg);
    }
  }, [activeDisplayTitle, activeTab.filePath, t]);

  useEffect(() => {
    const hasAnyDirty = tabs.some((tab) => tab.isDirty);
    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (!hasAnyDirty) {
        return;
      }
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [tabs]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (mermaidModalOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setMermaidModalOpen(false);
        }
        return;
      }

      if (settingsModalOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setSettingsModalOpen(false);
        }
        return;
      }

      if (cloudBrowserMode !== null) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setCloudBrowserMode(null);
        }
        return;
      }

      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 's' && event.shiftKey) {
        event.preventDefault();
        void handleSaveFileAs();
      } else if (key === 's') {
        event.preventDefault();
        void handleSaveFile();
      } else if (key === 'o') {
        event.preventDefault();
        void handleOpenFile();
      } else if (key === 'p' && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        handlePrint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    mermaidModalOpen,
    settingsModalOpen,
    cloudBrowserMode,
    handleOpenFile,
    handlePrint,
    handleSaveFile,
    handleSaveFileAs,
  ]);

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
            setStatusMessage(t.app.statusDroppedUnsupported);
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

        setStatusMessage(t.app.statusDroppedOpened(createdTabs.length, openedLabel));

        setTabSwitcherOpen(false);
        editorRef.current?.activateEditMode();
      } catch (err) {
        const msg = err instanceof Error ? err.message : t.app.statusDropError;
        setStatusMessage(msg);
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
  }, [mermaidModalOpen, t]);

  const handleOpenNewMermaid = (): void => {
    setEditingTabId(activeTab.id);
    setEditingBlockIndex(null);
    setEditingInitialCode('');
    setMermaidModalOpen(true);
  };

  const handleEditMermaid = (blockIndex: number, code: string): void => {
    setEditingTabId(activeTab.id);
    setEditingBlockIndex(blockIndex);
    setEditingInitialCode(code);
    setMermaidModalOpen(true);
  };

  const handleApplyMermaid = (generatedCode: string): void => {
    const targetTabId = editingTabId ?? activeTab.id;
    if (editingBlockIndex === null) {
      editorRef.current?.insertMermaidBlock(generatedCode);
    } else {
      setTabsState((prev) => ({
        ...prev,
        tabs: prev.tabs.map((tab) =>
          tab.id === targetTabId
            ? {
                ...tab,
                content: replaceMermaidBlock(tab.content, editingBlockIndex, generatedCode),
                isDirty: true,
              }
            : tab
        ),
      }));
    }
    setMermaidModalOpen(false);
  };

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

  return (
    <div className="app-shell">
      <Toolbar
        fileName={activeDisplayTitle}
        tabCount={tabs.length}
        isDirty={activeTab.isDirty}
        switcherOpen={tabSwitcherOpen}
        editorMode={editorMode}
        onToggleEditorMode={() =>
          handleChangeEditorMode(editorMode === 'wysiwyg' ? 'split' : 'wysiwyg')
        }
        onOpenTabSwitcher={() => setTabSwitcherOpen((prev) => !prev)}
        onNewFile={handleNewTab}
        onOpenFile={() => void handleOpenFile()}
        onSaveFile={() => void handleSaveFile()}
        onSaveFileAs={() => void handleSaveFileAs()}
        onOpenFromCloud={handleOpenFromCloud}
        onSaveToCloud={() => void handleSaveToCloud()}
        onSaveToCloudAs={handleSaveToCloudAs}
        onExportHtml={() => void handleExportHtml()}
        onExportPdf={() => void handleExportPdf()}
        onPrint={handlePrint}
        onOpenSettings={() => setSettingsModalOpen(true)}
        onOpenHelp={handleOpenHelpGuide}
        onHeading={(level) => editorRef.current?.applyHeading(level)}
        onBold={() => editorRef.current?.applyBold()}
        onItalic={() => editorRef.current?.applyItalic()}
        onStrike={() => editorRef.current?.applyStrike()}
        onLink={() => editorRef.current?.applyLink()}
        onBulletList={() => editorRef.current?.applyBulletList()}
        onOrderedList={() => editorRef.current?.applyOrderedList()}
        onTaskList={() => editorRef.current?.applyTaskList()}
        onQuote={() => editorRef.current?.applyQuote()}
        onCodeBlock={() => editorRef.current?.applyCodeBlock()}
        onInsertTable={(rows, cols) => editorRef.current?.insertTable(rows, cols)}
        onOpenNewMermaid={handleOpenNewMermaid}
      />

      <TabBar
        tabs={tabs}
        activeTabId={activeTab.id}
        displayTitles={displayTitles}
        switcherOpen={tabSwitcherOpen}
        onCloseSwitcher={() => setTabSwitcherOpen(false)}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
        onNewTab={handleNewTab}
      />

      {statusMessage && (
        <div className="status-banner">
          <span>{statusMessage}</span>
          <button
            type="button"
            className="status-banner-close"
            onClick={() => setStatusMessage(null)}
          >
            {t.app.closeBanner}
          </button>
        </div>
      )}

      <main className="app-main">
        <MarkdownEditor
          ref={editorRef}
          value={activeTab.content}
          onChange={handleChangeText}
          onEditMermaid={handleEditMermaid}
          editorMode={editorMode}
          onChangeEditorMode={handleChangeEditorMode}
          tabSize={tabSize}
          activeTabTitle={activeDisplayTitle}
          tabCount={tabs.length}
          isDirty={activeTab.isDirty}
          onOpenTabSwitcher={() => setTabSwitcherOpen(true)}
        />
      </main>

      {isFileDragOver && (
        <div className="drop-overlay" aria-live="polite">
          <div className="drop-overlay-card">
            <Upload size={36} className="drop-overlay-icon" />
            <div className="drop-overlay-title">{t.tabs.dropOverlayTitle}</div>
            <div className="drop-overlay-hint">{t.tabs.dropOverlayHint}</div>
          </div>
        </div>
      )}

      <Suspense fallback={null}>
        {mermaidModalOpen && (
          <MermaidModal
            isOpen={mermaidModalOpen}
            initialCode={editingInitialCode}
            onApply={handleApplyMermaid}
            onClose={() => setMermaidModalOpen(false)}
          />
        )}

        {settingsModalOpen && (
          <SettingsModal
            isOpen={settingsModalOpen}
            tabSize={tabSize}
            onChangeTabSize={handleChangeTabSize}
            remoteSettings={remoteSettings}
            remoteCredentials={remoteCredentials}
            hasStoredEncryptedCredentials={hasStoredSecret}
            isCredentialsUnlocked={isSecretUnlocked}
            onUnlockCredentials={handleUnlockRemoteCredentials}
            onClearStoredCredentials={handleClearStoredRemoteCredentials}
            onSaveSettings={handleSaveSettingsModal}
            onClose={() => setSettingsModalOpen(false)}
          />
        )}

        {cloudBrowserMode !== null && (
          <CloudBrowserModal
            isOpen={cloudBrowserMode !== null}
            mode={cloudBrowserMode}
            remoteSettings={remoteSettings}
            remoteCredentials={remoteCredentials}
            initialSubPath={cloudInitialTarget.subPath}
            initialFileName={cloudInitialTarget.fileName}
            onOpenedFile={handleCloudFileOpened}
            onSaveToPath={handleSaveCloudTarget}
            onClose={() => setCloudBrowserMode(null)}
          />
        )}
      </Suspense>
    </div>
  );
}
