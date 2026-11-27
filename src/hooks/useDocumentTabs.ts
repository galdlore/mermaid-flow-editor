import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type { MarkdownEditorHandle } from '../components/MarkdownEditor';
import {
  getInitialMarkdownByLang,
  INITIAL_MARKDOWN_EN,
  INITIAL_MARKDOWN_JA,
  type Language,
  type TranslationCatalog,
} from '../i18n';
import {
  computeTabDisplayTitles,
  createDocumentTabId,
  getTabBaseFileName,
  loadPersistedTabsState,
  persistTabsState,
  TABS_STORAGE_KEY,
  type DocumentTab,
  type PersistedTabsState,
} from '../utils/documentTabs';
import type { EmbedConfig, EmbedLoadDocumentMessage } from '../utils/embedBridge';
import { releaseBrowserFileHandle } from '../utils/fileAdapter';
import type { TabSizeOption } from '../utils/markdownTabIndent';
import { isElectronEnv, readLocalStorage, writeLocalStorage } from '../utils/storage';

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

function loadInitialEditorMode(
  embedInitialMode?: 'wysiwyg' | 'split'
): 'wysiwyg' | 'split' {
  if (embedInitialMode) {
    return embedInitialMode;
  }
  const saved = readLocalStorage(EDITOR_MODE_STORAGE_KEY);
  if (saved === 'wysiwyg' || saved === 'split') {
    return saved;
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 768px)').matches) {
    return 'wysiwyg';
  }
  return 'split';
}

function hasLaunchFileQuery(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return new URLSearchParams(window.location.search).get('launchFile') === '1';
  } catch {
    return false;
  }
}

function createInitialTabsState(lang: Language, isEmbedMode: boolean): PersistedTabsState {
  if (isEmbedMode) {
    const id = createDocumentTabId();
    return {
      activeTabId: id,
      tabs: [
        {
          id,
          filePath: null,
          content: '',
          isDirty: false,
          isGuide: false,
          remoteFileName: null,
          remoteUrl: null,
          embedFileId: null,
        },
      ],
    };
  }
  const defaultSample = getInitialMarkdownByLang(lang);
  if (isElectronEnv()) {
    const id = createDocumentTabId();
    const launchingExternalFile = hasLaunchFileQuery();
    return {
      activeTabId: id,
      tabs: [
        {
          id,
          filePath: null,
          content: launchingExternalFile ? '' : defaultSample,
          isDirty: false,
          isGuide: !launchingExternalFile,
        },
      ],
    };
  }
  return loadPersistedTabsState(TABS_STORAGE_KEY, LEGACY_DRAFT_STORAGE_KEY, defaultSample);
}

export function isUntouchedInitialTab(tab: DocumentTab): boolean {
  if (tab.isDirty || tab.filePath !== null) {
    return false;
  }
  if (tab.isGuide && !tab.remoteFileName && !tab.remoteUrl && !tab.embedFileId) {
    return true;
  }
  return (
    tab.content.trim().length === 0 ||
    tab.content === INITIAL_MARKDOWN_JA ||
    tab.content === INITIAL_MARKDOWN_EN
  );
}

export interface UseDocumentTabsOptions {
  initialEmbedConfig: EmbedConfig;
  lang: Language;
  setLang: (nextLang: Language) => void;
  t: TranslationCatalog;
  onStatusMessage: (message: string | null) => void;
  editorRef: RefObject<MarkdownEditorHandle>;
}

export function useDocumentTabs({
  initialEmbedConfig,
  lang,
  setLang,
  t,
  onStatusMessage,
  editorRef,
}: UseDocumentTabsOptions) {
  const isEmbedMode = initialEmbedConfig.enabled;
  const [tabsState, setTabsState] = useState<PersistedTabsState>(() =>
    createInitialTabsState(lang, isEmbedMode)
  );
  const tabsRef = useRef(tabsState.tabs);
  tabsRef.current = tabsState.tabs;

  const [editorMode, setEditorMode] = useState<'wysiwyg' | 'split'>(() =>
    loadInitialEditorMode(isEmbedMode ? initialEmbedConfig.initialMode : undefined)
  );
  const [tabSize, setTabSize] = useState<TabSizeOption>(loadInitialTabSize);

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
        const isCleanGuideTab =
          Boolean(tab.isGuide) &&
          !tab.remoteFileName &&
          !tab.remoteUrl &&
          !tab.embedFileId;
        if (
          !tab.isDirty &&
          tab.filePath === null &&
          (isCleanGuideTab ||
            tab.content === INITIAL_MARKDOWN_JA ||
            tab.content === INITIAL_MARKDOWN_EN) &&
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
    if (isElectronEnv() || isEmbedMode) {
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
  }, [isEmbedMode, tabs, activeTab.id]);

  useEffect(() => {
    if (isElectronEnv() || isEmbedMode) {
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
  }, [isEmbedMode]);

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

  const handleChangeEditorMode = useCallback(
    (nextMode: 'wysiwyg' | 'split') => {
      setEditorMode(nextMode);
      if (!isEmbedMode) {
        writeLocalStorage(EDITOR_MODE_STORAGE_KEY, nextMode);
      }
    },
    [isEmbedMode]
  );

  const handleChangeTabSize = useCallback((nextSize: TabSizeOption) => {
    setTabSize(nextSize);
    writeLocalStorage(TAB_SIZE_STORAGE_KEY, String(nextSize));
  }, []);

  const handleChangeText = useCallback((next: string) => {
    setTabsState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((tab) =>
        tab.id === prev.activeTabId ? { ...tab, content: next, isDirty: true } : tab
      ),
    }));
  }, []);

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
    onStatusMessage(t.app.statusNewCreated);
    editorRef.current?.activateEditMode();
  }, [editorRef, onStatusMessage, t]);

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
      onStatusMessage(t.app.statusHelpOpened);
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
    onStatusMessage(t.app.statusHelpOpened);
  }, [lang, onStatusMessage, t]);

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

  const openOrFocusTab = useCallback(
    (
      predicate: (tab: DocumentTab) => boolean,
      newTabData: Omit<DocumentTab, 'id'>,
      switchedMessage: string,
      openedMessage: string
    ) => {
      const existingSync = tabsRef.current.find(predicate);
      if (existingSync) {
        setTabsState((prev) => ({ ...prev, activeTabId: existingSync.id }));
        onStatusMessage(switchedMessage);
        return;
      }

      const newTabId = createDocumentTabId();
      setTabsState((prev) => {
        const existingInState = prev.tabs.find(predicate);
        if (existingInState) {
          return { ...prev, activeTabId: existingInState.id };
        }
        return {
          activeTabId: newTabId,
          tabs: [...prev.tabs, { id: newTabId, ...newTabData }],
        };
      });
      onStatusMessage(openedMessage);
      editorRef.current?.activateEditMode();
    },
    [editorRef, onStatusMessage]
  );

  const handleEmbedLoadDocument = useCallback(
    (msg: EmbedLoadDocumentMessage) => {
      if (msg.lang) {
        setLang(msg.lang);
      }
      if (msg.editorMode) {
        setEditorMode(msg.editorMode);
      }

      const nextRemotePath = msg.remotePath?.trim() || null;
      const fallbackFileName = msg.fileName?.trim() || null;
      const tabRemoteName = nextRemotePath ?? fallbackFileName;
      const nextFileId = msg.fileId ?? null;
      const nextReadOnly = msg.readOnly ?? initialEmbedConfig.readOnly;
      const loadedTitle = getTabBaseFileName(
        tabRemoteName,
        msg.fileName || t.app.untitledFileName
      );
      const candidateTabId = createDocumentTabId();

      setTabsState((prev) => {
        const matchedTab = prev.tabs.find(
          (tab) =>
            (nextFileId !== null && tab.embedFileId === nextFileId) ||
            (nextRemotePath !== null && tab.remoteFileName === nextRemotePath)
        );
        if (matchedTab) {
          if (msg.openInNewTab) {
            return { ...prev, activeTabId: matchedTab.id };
          }
          return {
            activeTabId: matchedTab.id,
            tabs: prev.tabs.map((tab) =>
              tab.id === matchedTab.id
                ? {
                    ...tab,
                    filePath: null,
                    content: msg.content,
                    isDirty: false,
                    remoteFileName: tabRemoteName,
                    remoteUrl: null,
                    isGuide: false,
                    embedFileId: nextFileId,
                    embedReadOnly: nextReadOnly,
                  }
                : tab
            ),
          };
        }

        const currentActive =
          prev.tabs.find((tab) => tab.id === prev.activeTabId) ?? prev.tabs[0];
        const canReuseEmptyEmbedTab =
          !msg.openInNewTab &&
          currentActive &&
          !currentActive.isDirty &&
          !currentActive.embedFileId &&
          !currentActive.remoteFileName &&
          !currentActive.filePath &&
          currentActive.content.trim().length === 0;

        if (canReuseEmptyEmbedTab) {
          return {
            activeTabId: currentActive.id,
            tabs: prev.tabs.map((tab) =>
              tab.id === currentActive.id
                ? {
                    ...tab,
                    filePath: null,
                    content: msg.content,
                    isDirty: false,
                    remoteFileName: tabRemoteName,
                    remoteUrl: null,
                    isGuide: false,
                    embedFileId: nextFileId,
                    embedReadOnly: nextReadOnly,
                  }
                : tab
            ),
          };
        }

        return {
          activeTabId: candidateTabId,
          tabs: [
            ...prev.tabs,
            {
              id: candidateTabId,
              filePath: null,
              content: msg.content,
              isDirty: false,
              remoteFileName: tabRemoteName,
              remoteUrl: null,
              isGuide: false,
              embedFileId: nextFileId,
              embedReadOnly: nextReadOnly,
            },
          ],
        };
      });

      onStatusMessage(t.app.statusOpened(loadedTitle));
      editorRef.current?.activateEditMode();
    },
    [editorRef, initialEmbedConfig.readOnly, onStatusMessage, setLang, t]
  );

  return {
    tabsState,
    setTabsState,
    tabsRef,
    tabs,
    activeTabId,
    activeTab,
    activeTabIdRef,
    displayTitles,
    activeDisplayTitle,
    editorMode,
    handleChangeEditorMode,
    tabSize,
    handleChangeTabSize,
    handleChangeText,
    handleSelectTab,
    handleNewTab,
    handleOpenHelpGuide,
    handleCloseTab,
    openOrFocusTab,
    handleEmbedLoadDocument,
  };
}
