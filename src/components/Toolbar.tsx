import { useState } from 'react';
import {
  Bold,
  CheckSquare,
  Code,
  FileDown,
  FilePlus,
  FolderOpen,
  GitBranch,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListOrdered,
  Quote,
  Save,
  Strikethrough,
  Table,
} from 'lucide-react';

export interface ToolbarProps {
  fileName: string;
  isDirty: boolean;
  onNewFile: () => void;
  onOpenFile: () => void;
  onSaveFile: () => void;
  onSaveFileAs: () => void;
  onInsertLinePrefix: (prefix: string) => void;
  onWrapSelection: (prefix: string, suffix: string, placeholder: string) => void;
  onInsertText: (text: string) => void;
  onOpenNewMermaid: () => void;
}

function buildMarkdownTable(rows: number, cols: number): string {
  const safeRows = Math.max(1, Math.min(20, rows));
  const safeCols = Math.max(1, Math.min(12, cols));

  const headers = Array.from({ length: safeCols }, (_, index) => `列${index + 1}`);
  const dividers = Array.from({ length: safeCols }, () => '---');
  const bodyRow = Array.from({ length: safeCols }, () => '内容');

  const lines = [
    `| ${headers.join(' | ')} |`,
    `| ${dividers.join(' | ')} |`,
    ...Array.from({ length: safeRows }, () => `| ${bodyRow.join(' | ')} |`),
  ];

  return `\n${lines.join('\n')}\n`;
}

export default function Toolbar({
  fileName,
  isDirty,
  onNewFile,
  onOpenFile,
  onSaveFile,
  onSaveFileAs,
  onInsertLinePrefix,
  onWrapSelection,
  onInsertText,
  onOpenNewMermaid,
}: ToolbarProps) {
  const [tablePopoverOpen, setTablePopoverOpen] = useState(false);
  const [tableRows, setTableRows] = useState(2);
  const [tableCols, setTableCols] = useState(2);

  const handleInsertTable = (): void => {
    onInsertText(buildMarkdownTable(tableRows, tableCols));
    setTablePopoverOpen(false);
  };

  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <button type="button" className="toolbar-btn" onClick={onNewFile} title="新規作成">
          <FilePlus size={16} />
          <span>新規</span>
        </button>
        <button type="button" className="toolbar-btn" onClick={onOpenFile} title="ファイルを開く (Ctrl+O)">
          <FolderOpen size={16} />
          <span>開く</span>
        </button>
        <button type="button" className="toolbar-btn" onClick={onSaveFile} title="上書き保存 (Ctrl+S)">
          <Save size={16} />
          <span>保存</span>
        </button>
        <button type="button" className="toolbar-btn" onClick={onSaveFileAs} title="名前を付けて保存 (Ctrl+Shift+S)">
          <FileDown size={16} />
          <span>別名保存</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onClick={() => onInsertLinePrefix('# ')}
          title="見出し1 (H1)"
        >
          <Heading1 size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onClick={() => onInsertLinePrefix('## ')}
          title="見出し2 (H2)"
        >
          <Heading2 size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onClick={() => onInsertLinePrefix('### ')}
          title="見出し3 (H3)"
        >
          <Heading3 size={16} />
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onClick={() => onWrapSelection('**', '**', '太字テキスト')}
          title="太字"
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onClick={() => onWrapSelection('*', '*', '斜体テキスト')}
          title="斜体"
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onClick={() => onWrapSelection('~~', '~~', '打ち消しテキスト')}
          title="打ち消し線"
        >
          <Strikethrough size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onClick={() => onWrapSelection('[', '](https://example.com)', 'リンク名')}
          title="リンク挿入"
        >
          <Link size={16} />
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onClick={() => onInsertLinePrefix('- ')}
          title="箇条書きリスト"
        >
          <List size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onClick={() => onInsertLinePrefix('1. ')}
          title="番号付きリスト"
        >
          <ListOrdered size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onClick={() => onInsertLinePrefix('- [ ] ')}
          title="タスクリスト"
        >
          <CheckSquare size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onClick={() => onInsertLinePrefix('> ')}
          title="引用"
        >
          <Quote size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onClick={() => onInsertText('\n```\nここにコードを入力\n```\n')}
          title="コードブロック"
        >
          <Code size={16} />
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group toolbar-popover-anchor">
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => setTablePopoverOpen((prev) => !prev)}
          title="表をGUIで作成して挿入"
        >
          <Table size={16} />
          <span>表を挿入</span>
        </button>

        {tablePopoverOpen && (
          <div className="table-popover">
            <div className="table-popover-title">表の挿入設定</div>
            <label className="table-popover-field">
              <span>行数</span>
              <input
                type="number"
                min={1}
                max={20}
                value={tableRows}
                onChange={(event) => setTableRows(Number(event.target.value) || 1)}
              />
            </label>
            <label className="table-popover-field">
              <span>列数</span>
              <input
                type="number"
                min={1}
                max={12}
                value={tableCols}
                onChange={(event) => setTableCols(Number(event.target.value) || 1)}
              />
            </label>
            <div className="table-popover-actions">
              <button type="button" className="btn-secondary" onClick={() => setTablePopoverOpen(false)}>
                閉じる
              </button>
              <button type="button" className="btn-primary" onClick={handleInsertTable}>
                挿入
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          className="toolbar-btn toolbar-btn-accent"
          onClick={onOpenNewMermaid}
          title="Mermaid図をGUIで新規作成"
        >
          <GitBranch size={16} />
          <span>Mermaid図をGUI作成</span>
        </button>
      </div>

      <div className="toolbar-file-status" title={fileName}>
        <span className="file-name-text">{fileName}</span>
        {isDirty && <span className="unsaved-badge">未保存</span>}
      </div>
    </header>
  );
}
