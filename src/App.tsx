import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Toolbar from './components/Toolbar';
import MarkdownEditor, { type MarkdownEditorHandle } from './components/MarkdownEditor';
import MermaidModal from './components/MermaidModal';
import {
  INITIAL_MARKDOWN_EN,
  INITIAL_MARKDOWN_JA,
  getInitialMarkdownByLang,
  useI18n,
  type Language,
} from './i18n';
import {
  openMarkdownFile,
  resetBrowserFileHandle,
  saveMarkdownFile,
  saveMarkdownFileAs,
} from './utils/fileAdapter';
import { replaceMermaidBlock } from './utils/markdownMermaidBlocks';
import { isElectronEnv, readLocalStorage, writeLocalStorage } from './utils/storage';

const DRAFT_STORAGE_KEY = 'mermaid-flow-editor:draft';

function getDisplayFileName(filePath: string | null, untitledFileName: string): string {
  if (!filePath) {
    return untitledFileName;
  }
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] || untitledFileName;
}

function loadInitialMarkdown(lang: Language): string {
  if (!isElectronEnv()) {
    const savedDraft = readLocalStorage(DRAFT_STORAGE_KEY);
    if (savedDraft && savedDraft.trim().length > 0) {
      return savedDraft;
    }
  }
  return getInitialMarkdownByLang(lang);
}

export default function App() {
  const { lang, t } = useI18n();
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const [markdownText, setMarkdownText] = useState<string>(() => loadInitialMarkdown(lang));
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [mermaidModalOpen, setMermaidModalOpen] = useState(false);
  const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(null);
  const [editingInitialCode, setEditingInitialCode] = useState('');

  const fileName = useMemo(
    () => getDisplayFileName(currentFilePath, t.app.untitledFileName),
    [currentFilePath, t.app.untitledFileName]
  );

  useEffect(() => {
    document.title = `${isDirty ? '* ' : ''}${fileName} - Mermaid Markdown Editor`;
  }, [fileName, isDirty]);

  useEffect(() => {
    if (
      !isDirty &&
      (markdownText === INITIAL_MARKDOWN_JA || markdownText === INITIAL_MARKDOWN_EN)
    ) {
      const targetSample = getInitialMarkdownByLang(lang);
      if (markdownText !== targetSample) {
        setMarkdownText(targetSample);
      }
    }
  }, [lang, isDirty, markdownText]);

  useEffect(() => {
    if (isElectronEnv()) {
      return;
    }
    writeLocalStorage(DRAFT_STORAGE_KEY, markdownText);
  }, [markdownText]);

  const handleChangeText = useCallback((next: string) => {
    setMarkdownText(next);
    setIsDirty(true);
  }, []);

  const confirmDiscardIfDirty = useCallback(
    (actionLabel: string): boolean => {
      if (!isDirty) {
        return true;
      }
      return window.confirm(t.app.confirmDiscard(actionLabel));
    },
    [isDirty, t]
  );

  const handleNewFile = useCallback(() => {
    if (!confirmDiscardIfDirty(t.app.actionNew)) {
      return;
    }
    resetBrowserFileHandle();
    setMarkdownText('');
    setCurrentFilePath(null);
    setIsDirty(false);
    setStatusMessage(t.app.statusNewCreated);
  }, [confirmDiscardIfDirty, t]);

  const handleOpenFile = useCallback(async () => {
    if (!confirmDiscardIfDirty(t.app.actionOpen)) {
      return;
    }

    try {
      const result = await openMarkdownFile();
      if (!result.canceled && result.filePath && typeof result.content === 'string') {
        setMarkdownText(result.content);
        setCurrentFilePath(result.filePath);
        setIsDirty(false);
        setStatusMessage(
          t.app.statusOpened(getDisplayFileName(result.filePath, t.app.untitledFileName))
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.app.statusOpenError;
      setStatusMessage(msg);
    }
  }, [confirmDiscardIfDirty, t]);

  const handleSaveFile = useCallback(async () => {
    try {
      const result = await saveMarkdownFile(currentFilePath, markdownText);
      if (!result.canceled && result.filePath) {
        setCurrentFilePath(result.filePath);
        setIsDirty(false);
        setStatusMessage(
          t.app.statusSaved(getDisplayFileName(result.filePath, t.app.untitledFileName))
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.app.statusSaveError;
      setStatusMessage(msg);
    }
  }, [currentFilePath, markdownText, t]);

  const handleSaveFileAs = useCallback(async () => {
    try {
      const result = await saveMarkdownFileAs(markdownText, currentFilePath);
      if (!result.canceled && result.filePath) {
        setCurrentFilePath(result.filePath);
        setIsDirty(false);
        setStatusMessage(
          t.app.statusSaveAs(getDisplayFileName(result.filePath, t.app.untitledFileName))
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.app.statusSaveError;
      setStatusMessage(msg);
    }
  }, [currentFilePath, markdownText, t]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (!isDirty) {
        return;
      }
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (mermaidModalOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setMermaidModalOpen(false);
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mermaidModalOpen, handleOpenFile, handleSaveFile, handleSaveFileAs]);

  const handleOpenNewMermaid = (): void => {
    setEditingBlockIndex(null);
    setEditingInitialCode('');
    setMermaidModalOpen(true);
  };

  const handleEditMermaid = (blockIndex: number, code: string): void => {
    setEditingBlockIndex(blockIndex);
    setEditingInitialCode(code);
    setMermaidModalOpen(true);
  };

  const handleApplyMermaid = (generatedCode: string): void => {
    if (editingBlockIndex === null) {
      editorRef.current?.insertAtCursor(`\n\`\`\`mermaid\n${generatedCode}\n\`\`\`\n`);
    } else {
      const updated = replaceMermaidBlock(markdownText, editingBlockIndex, generatedCode);
      setMarkdownText(updated);
      setIsDirty(true);
    }
    setMermaidModalOpen(false);
  };

  return (
    <div className="app-shell">
      <Toolbar
        fileName={fileName}
        isDirty={isDirty}
        onNewFile={handleNewFile}
        onOpenFile={() => void handleOpenFile()}
        onSaveFile={() => void handleSaveFile()}
        onSaveFileAs={() => void handleSaveFileAs()}
        onInsertLinePrefix={(prefix) => editorRef.current?.insertLinePrefix(prefix)}
        onWrapSelection={(prefix, suffix, placeholder) =>
          editorRef.current?.wrapSelection(prefix, suffix, placeholder)
        }
        onInsertText={(text) => editorRef.current?.insertAtCursor(text)}
        onOpenNewMermaid={handleOpenNewMermaid}
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
          value={markdownText}
          onChange={handleChangeText}
          onEditMermaid={handleEditMermaid}
        />
      </main>

      <MermaidModal
        isOpen={mermaidModalOpen}
        initialCode={editingInitialCode}
        onApply={handleApplyMermaid}
        onClose={() => setMermaidModalOpen(false)}
      />
    </div>
  );
}
