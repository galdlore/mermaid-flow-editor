import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import MarkdownEditor, { type MarkdownEditorHandle } from './components/MarkdownEditor';
import ModalErrorBoundary from './components/ModalErrorBoundary';
import TabBar from './components/TabBar';
import Toolbar from './components/Toolbar';
import { useCloudDocumentActions } from './hooks/useCloudDocumentActions';
import { useCloudStorage } from './hooks/useCloudStorage';
import { useDocumentTabs } from './hooks/useDocumentTabs';
import { resolveRuntimeEmbedConfig, useEmbedBridge } from './hooks/useEmbedBridge';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useLocalFileActions } from './hooks/useLocalFileActions';
import { useMarkdownLinkNavigation } from './hooks/useMarkdownLinkNavigation';
import { useI18n } from './i18n';
import type { EmbedLoadDocumentMessage } from './utils/embedBridge';
import { replaceMermaidBlock } from './utils/markdownMermaidBlocks';

const MermaidModal = lazy(() => import('./components/MermaidModal'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const CloudBrowserModal = lazy(() => import('./components/CloudBrowserModal'));

export default function App() {
  const { lang, setLang, t } = useI18n();
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const hostRequestSaveRef = useRef<() => void>(() => {});
  const embedLoaderRef = useRef<(msg: EmbedLoadDocumentMessage) => void>(() => {});
  const initialEmbedConfig = useMemo(() => resolveRuntimeEmbedConfig(), []);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [tabSwitcherOpen, setTabSwitcherOpen] = useState(false);
  const [mermaidModalOpen, setMermaidModalOpen] = useState(false);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(null);
  const [editingInitialCode, setEditingInitialCode] = useState('');

  const {
    setTabsState,
    tabsRef,
    tabs,
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
  } = useDocumentTabs({
    initialEmbedConfig,
    lang,
    setLang,
    t,
    onStatusMessage: setStatusMessage,
    editorRef,
  });

  embedLoaderRef.current = handleEmbedLoadDocument;

  const stableOnLoadDocument = useCallback((msg: EmbedLoadDocumentMessage) => {
    embedLoaderRef.current(msg);
  }, []);

  const stableOnHostRequestSave = useCallback(() => {
    hostRequestSaveRef.current();
  }, []);

  const {
    isEmbedMode,
    embedParentOrigin,
    embedOriginReady,
    notifyDirtyChange,
    requestEmbedSave,
    requestEmbedOpenLink,
  } = useEmbedBridge({
    initialConfig: initialEmbedConfig,
    onLoadDocument: stableOnLoadDocument,
    onHostRequestSave: stableOnHostRequestSave,
  });

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

  const {
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
  } = useCloudDocumentActions({
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
    onStatusMessage: setStatusMessage,
  });

  const handleCloseTabSwitcher = useCallback(() => setTabSwitcherOpen(false), []);

  const {
    isFileDragOver,
    handleOpenFile,
    handleSaveFile,
    handleSaveFileAs,
    handlePrint,
    handleExportHtml,
    handleExportPdf,
  } = useLocalFileActions({
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
    onCloseTabSwitcher: handleCloseTabSwitcher,
    onStatusMessage: setStatusMessage,
  });

  hostRequestSaveRef.current = () => {
    void handleSaveFile();
  };

  const { isDocumentLink, handleOpenMarkdownLink } = useMarkdownLinkNavigation({
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
    initialEmbedReadOnly: initialEmbedConfig.readOnly,
    requestEmbedOpenLink,
    openOrFocusTab,
    t,
    onStatusMessage: setStatusMessage,
  });

  const handleCloseMermaidModal = useCallback(() => setMermaidModalOpen(false), []);
  const handleCloseSettingsModal = useCallback(
    () => setSettingsModalOpen(false),
    [setSettingsModalOpen]
  );
  const handleCloseCloudBrowser = useCallback(
    () => setCloudBrowserMode(null),
    [setCloudBrowserMode]
  );

  useGlobalShortcuts({
    mermaidModalOpen,
    settingsModalOpen,
    cloudBrowserMode,
    onCloseMermaidModal: handleCloseMermaidModal,
    onCloseSettingsModal: handleCloseSettingsModal,
    onCloseCloudBrowser: handleCloseCloudBrowser,
    onNewFile: handleNewTab,
    onOpenFile: handleOpenFile,
    onPrint: handlePrint,
    onSaveFile: handleSaveFile,
    onSaveFileAs: handleSaveFileAs,
  });

  useEffect(() => {
    if (isEmbedMode && !embedOriginReady) {
      setStatusMessage(t.app.statusEmbedOriginMissing);
    }
  }, [embedOriginReady, isEmbedMode, t.app.statusEmbedOriginMissing]);

  const lastNotifiedDirtyRef = useRef<{
    tabId: string;
    isDirty: boolean;
    fileId?: string;
  } | null>(null);

  useEffect(() => {
    if (!isEmbedMode || !embedOriginReady) {
      return;
    }
    const isEmbeddedDocTab = Boolean(activeTab.embedFileId || activeTab.remoteFileName);
    if (!isEmbeddedDocTab) {
      return;
    }
    const nextState = {
      tabId: activeTab.id,
      isDirty: activeTab.isDirty,
      fileId: activeTab.embedFileId ?? undefined,
    };
    const prevState = lastNotifiedDirtyRef.current;
    if (
      prevState &&
      prevState.tabId === nextState.tabId &&
      prevState.isDirty === nextState.isDirty &&
      prevState.fileId === nextState.fileId
    ) {
      return;
    }
    lastNotifiedDirtyRef.current = nextState;
    notifyDirtyChange(nextState.isDirty, nextState.fileId);
  }, [
    activeTab.embedFileId,
    activeTab.id,
    activeTab.isDirty,
    activeTab.remoteFileName,
    embedOriginReady,
    isEmbedMode,
    notifyDirtyChange,
  ]);

  const handleOpenNewMermaid = useCallback((): void => {
    setEditingTabId(activeTabIdRef.current);
    setEditingBlockIndex(null);
    setEditingInitialCode('');
    setMermaidModalOpen(true);
  }, [activeTabIdRef]);

  const handleEditMermaid = useCallback(
    (blockIndex: number, code: string): void => {
      setEditingTabId(activeTabIdRef.current);
      setEditingBlockIndex(blockIndex);
      setEditingInitialCode(code);
      setMermaidModalOpen(true);
    },
    [activeTabIdRef]
  );

  const handleApplyMermaid = useCallback(
    (generatedCode: string): void => {
      const targetTabId = editingTabId ?? activeTabIdRef.current;
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
    },
    [activeTabIdRef, editingBlockIndex, editingTabId, setTabsState]
  );

  const toolbarActionsRef = useRef({
    editorMode,
    handleChangeEditorMode,
    handleOpenFile,
    handleSaveFile,
    handleSaveFileAs,
    handleOpenFromCloud,
    handleSaveToCloud,
    handleSaveToCloudAs,
    handleExportHtml,
    handleExportPdf,
    handlePrint,
    handleOpenHelpGuide,
    handleOpenCloudLinkInserter,
    handleOpenNewMermaid,
    handleNewTab,
  });
  toolbarActionsRef.current = {
    editorMode,
    handleChangeEditorMode,
    handleOpenFile,
    handleSaveFile,
    handleSaveFileAs,
    handleOpenFromCloud,
    handleSaveToCloud,
    handleSaveToCloudAs,
    handleExportHtml,
    handleExportPdf,
    handlePrint,
    handleOpenHelpGuide,
    handleOpenCloudLinkInserter,
    handleOpenNewMermaid,
    handleNewTab,
  };

  const handleToggleEditorMode = useCallback(() => {
    const { editorMode: currentMode, handleChangeEditorMode: changeMode } =
      toolbarActionsRef.current;
    changeMode(currentMode === 'wysiwyg' ? 'split' : 'wysiwyg');
  }, []);
  const handleToggleTabSwitcher = useCallback(() => setTabSwitcherOpen((prev) => !prev), []);
  const handleOpenTabSwitcher = useCallback(() => setTabSwitcherOpen(true), []);
  const handleOpenSettings = useCallback(() => setSettingsModalOpen(true), [setSettingsModalOpen]);
  const handleStableNewFile = useCallback(() => toolbarActionsRef.current.handleNewTab(), []);
  const handleStableOpenFile = useCallback(() => void toolbarActionsRef.current.handleOpenFile(), []);
  const handleStableSaveFile = useCallback(() => void toolbarActionsRef.current.handleSaveFile(), []);
  const handleStableSaveFileAs = useCallback(
    () => void toolbarActionsRef.current.handleSaveFileAs(),
    []
  );
  const handleStableOpenFromCloud = useCallback(
    () => toolbarActionsRef.current.handleOpenFromCloud(),
    []
  );
  const handleStableSaveToCloud = useCallback(
    () => void toolbarActionsRef.current.handleSaveToCloud(),
    []
  );
  const handleStableSaveToCloudAs = useCallback(
    () => toolbarActionsRef.current.handleSaveToCloudAs(),
    []
  );
  const handleStableExportHtml = useCallback(
    () => void toolbarActionsRef.current.handleExportHtml(),
    []
  );
  const handleStableExportPdf = useCallback(
    () => void toolbarActionsRef.current.handleExportPdf(),
    []
  );
  const handleStablePrint = useCallback(() => void toolbarActionsRef.current.handlePrint(), []);
  const handleStableOpenHelp = useCallback(() => toolbarActionsRef.current.handleOpenHelpGuide(), []);
  const handleStableHeading = useCallback(
    (level: 1 | 2 | 3) => editorRef.current?.applyHeading(level),
    []
  );
  const handleStableBold = useCallback(() => editorRef.current?.applyBold(), []);
  const handleStableItalic = useCallback(() => editorRef.current?.applyItalic(), []);
  const handleStableStrike = useCallback(() => editorRef.current?.applyStrike(), []);
  const handleStableLink = useCallback(() => editorRef.current?.applyLink(), []);
  const handleStableInsertCloudLink = useCallback(
    () => toolbarActionsRef.current.handleOpenCloudLinkInserter(),
    []
  );
  const handleStableBulletList = useCallback(() => editorRef.current?.applyBulletList(), []);
  const handleStableOrderedList = useCallback(() => editorRef.current?.applyOrderedList(), []);
  const handleStableTaskList = useCallback(() => editorRef.current?.applyTaskList(), []);
  const handleStableQuote = useCallback(() => editorRef.current?.applyQuote(), []);
  const handleStableCodeBlock = useCallback(() => editorRef.current?.applyCodeBlock(), []);
  const handleStableInsertTable = useCallback(
    (rows: number, cols: number) => editorRef.current?.insertTable(rows, cols),
    []
  );
  const handleStableOpenNewMermaid = useCallback(
    () => toolbarActionsRef.current.handleOpenNewMermaid(),
    []
  );
  const handleStableMarkdownLink = useCallback(
    (href: string) => void handleOpenMarkdownLink(href),
    [handleOpenMarkdownLink]
  );

  return (
    <div className="app-shell">
      <Toolbar
        fileName={activeDisplayTitle}
        tabCount={tabs.length}
        isDirty={activeTab.isDirty}
        switcherOpen={tabSwitcherOpen}
        editorMode={editorMode}
        isEmbedMode={isEmbedMode}
        onToggleEditorMode={handleToggleEditorMode}
        onOpenTabSwitcher={handleToggleTabSwitcher}
        onNewFile={handleStableNewFile}
        onOpenFile={handleStableOpenFile}
        onSaveFile={handleStableSaveFile}
        onSaveFileAs={handleStableSaveFileAs}
        onOpenFromCloud={handleStableOpenFromCloud}
        onSaveToCloud={handleStableSaveToCloud}
        onSaveToCloudAs={handleStableSaveToCloudAs}
        onExportHtml={handleStableExportHtml}
        onExportPdf={handleStableExportPdf}
        onPrint={handleStablePrint}
        onOpenSettings={handleOpenSettings}
        onOpenHelp={handleStableOpenHelp}
        onHeading={handleStableHeading}
        onBold={handleStableBold}
        onItalic={handleStableItalic}
        onStrike={handleStableStrike}
        onLink={handleStableLink}
        onInsertCloudLink={handleStableInsertCloudLink}
        onBulletList={handleStableBulletList}
        onOrderedList={handleStableOrderedList}
        onTaskList={handleStableTaskList}
        onQuote={handleStableQuote}
        onCodeBlock={handleStableCodeBlock}
        onInsertTable={handleStableInsertTable}
        onOpenNewMermaid={handleStableOpenNewMermaid}
      />

      <TabBar
        tabs={tabs}
        activeTabId={activeTab.id}
        displayTitles={displayTitles}
        switcherOpen={tabSwitcherOpen}
        onCloseSwitcher={handleCloseTabSwitcher}
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
          onOpenNewMermaid={handleOpenNewMermaid}
          onOpenMarkdownLink={handleStableMarkdownLink}
          isDocumentLink={isDocumentLink}
          editorMode={editorMode}
          onChangeEditorMode={handleChangeEditorMode}
          tabSize={tabSize}
          activeTabTitle={activeDisplayTitle}
          tabCount={tabs.length}
          isDirty={activeTab.isDirty}
          onOpenTabSwitcher={handleOpenTabSwitcher}
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

      <ModalErrorBoundary
        title={t.app.modalErrorTitle}
        description={t.app.modalErrorDescription}
        reloadLabel={t.app.modalErrorReloadBtn}
        closeLabel={t.app.modalErrorCloseBtn}
        resetKey={`${mermaidModalOpen ? 1 : 0}-${settingsModalOpen ? 1 : 0}-${cloudBrowserMode ?? 'none'}`}
        onClose={() => {
          setMermaidModalOpen(false);
          setSettingsModalOpen(false);
          setCloudBrowserMode(null);
          setPendingLinkLabel('');
        }}
      >
        <Suspense fallback={null}>
          {mermaidModalOpen && (
            <MermaidModal
              isOpen={mermaidModalOpen}
              initialCode={editingInitialCode}
              onApply={handleApplyMermaid}
              onClose={handleCloseMermaidModal}
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
              onClose={handleCloseSettingsModal}
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
              currentRemotePath={activeTab.remoteFileName}
              initialLinkLabel={pendingLinkLabel}
              onOpenedFile={handleCloudFileOpened}
              onSaveToPath={handleSaveCloudTarget}
              onInsertLink={handleInsertCloudLink}
              onClose={() => {
                setCloudBrowserMode(null);
                setPendingLinkLabel('');
              }}
            />
          )}
        </Suspense>
      </ModalErrorBoundary>
    </div>
  );
}
