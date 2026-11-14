import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Toolbar from './components/Toolbar';
import MarkdownEditor, { type MarkdownEditorHandle } from './components/MarkdownEditor';
import MermaidModal from './components/MermaidModal';

const INITIAL_MARKDOWN = `# Mermaid Markdown Editor

上部のツールバーから見出しや表、Mermaid図をGUI操作で挿入できます。

## 基本的な使い方

1. 左側の編集エリアに文章を書くか、ツールバーのボタンを押します。
2. 「Mermaid図をGUI作成」ボタンを押すと、図形と接続先をGUIで組み立てられます。
3. 右側のプレビュー上にある「この図をGUIで編集」ボタンから、既存の図を何度でも編集し直せます。

## サンプルフローチャート

\`\`\`mermaid
flowchart TD
  node_1(["開始"])
  style node_1 fill:#eff6ff,stroke:#475569,color:#0f172a
  node_2{"条件を確認"}
  node_3["完了処理"]
  style node_3 fill:#f0fdf4,stroke:#475569,color:#0f172a
  node_1 -->|"入力あり"| node_2
  node_2 -->|"OK"| node_3
%% @gui-state: {"direction":"TD","nodes":[{"id":"node_1","label":"開始","shape":"stadium","color":"#eff6ff","position":{"x":180,"y":40}},{"id":"node_2","label":"条件を確認","shape":"diamond","color":"#ffffff","position":{"x":185,"y":155}},{"id":"node_3","label":"完了処理","shape":"rect","color":"#f0fdf4","position":{"x":180,"y":310}}],"edges":[{"id":"edge_1","source":"node_1","target":"node_2","label":"入力あり","lineType":"arrow"},{"id":"edge_2","source":"node_2","target":"node_3","label":"OK","lineType":"arrow"}]}
\`\`\`
`;

function replaceMermaidBlock(
  markdown: string,
  targetBlockIndex: number,
  newMermaidCode: string
): string {
  const lines = markdown.split(/\r?\n/);
  let currentIndex = -1;
  let inMermaid = false;
  let startLine = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!inMermaid) {
      if (/^```\s*mermaid\b/i.test(trimmed)) {
        inMermaid = true;
        currentIndex += 1;
        startLine = i;
      }
    } else if (/^```\s*$/.test(trimmed)) {
      if (currentIndex === targetBlockIndex) {
        const replacementLines = ['```mermaid', ...newMermaidCode.split(/\r?\n/), '```'];
        lines.splice(startLine, i - startLine + 1, ...replacementLines);
        return lines.join('\n');
      }
      inMermaid = false;
    }
  }

  return markdown;
}

function getDisplayFileName(filePath: string | null): string {
  if (!filePath) {
    return '無題.md';
  }
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] || '無題.md';
}

export default function App() {
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const [markdownText, setMarkdownText] = useState(INITIAL_MARKDOWN);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [mermaidModalOpen, setMermaidModalOpen] = useState(false);
  const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(null);
  const [editingInitialCode, setEditingInitialCode] = useState('');

  const fileName = useMemo(() => getDisplayFileName(currentFilePath), [currentFilePath]);

  useEffect(() => {
    document.title = `${isDirty ? '* ' : ''}${fileName} - Mermaid Markdown Editor`;
  }, [fileName, isDirty]);

  const handleChangeText = useCallback((next: string) => {
    setMarkdownText(next);
    setIsDirty(true);
  }, []);

  const confirmDiscardIfDirty = useCallback(
    (actionLabel: string): boolean => {
      if (!isDirty) {
        return true;
      }
      return window.confirm(`未保存の変更があります。内容を破棄して${actionLabel}を続けますか？`);
    },
    [isDirty]
  );

  const handleNewFile = useCallback(() => {
    if (!confirmDiscardIfDirty('新規作成')) {
      return;
    }
    setMarkdownText('');
    setCurrentFilePath(null);
    setIsDirty(false);
    setStatusMessage('新しいドキュメントを作成しました。');
  }, [confirmDiscardIfDirty]);

  const handleOpenFile = useCallback(async () => {
    if (!window.electronAPI) {
      setStatusMessage('デスクトップアプリの環境でのみファイルを開けます。');
      return;
    }
    if (!confirmDiscardIfDirty('ファイルを開く操作')) {
      return;
    }

    try {
      const result = await window.electronAPI.openFile();
      if (!result.canceled && result.filePath && typeof result.content === 'string') {
        setMarkdownText(result.content);
        setCurrentFilePath(result.filePath);
        setIsDirty(false);
        setStatusMessage(`ファイルを開きました: ${getDisplayFileName(result.filePath)}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ファイルの読み込みに失敗しました。';
      setStatusMessage(msg);
    }
  }, [confirmDiscardIfDirty]);

  const handleSaveFile = useCallback(async () => {
    if (!window.electronAPI) {
      setStatusMessage('デスクトップアプリの環境でのみファイルを保存できます。');
      return;
    }

    try {
      const result = await window.electronAPI.saveFile(currentFilePath, markdownText);
      if (!result.canceled && result.filePath) {
        setCurrentFilePath(result.filePath);
        setIsDirty(false);
        setStatusMessage(`保存しました: ${getDisplayFileName(result.filePath)}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ファイルの保存に失敗しました。';
      setStatusMessage(msg);
    }
  }, [currentFilePath, markdownText]);

  const handleSaveFileAs = useCallback(async () => {
    if (!window.electronAPI) {
      setStatusMessage('デスクトップアプリの環境でのみファイルを保存できます。');
      return;
    }

    try {
      const result = await window.electronAPI.saveFileAs(markdownText);
      if (!result.canceled && result.filePath) {
        setCurrentFilePath(result.filePath);
        setIsDirty(false);
        setStatusMessage(`名前を付けて保存しました: ${getDisplayFileName(result.filePath)}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ファイルの保存に失敗しました。';
      setStatusMessage(msg);
    }
  }, [markdownText]);

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
            閉じる
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
