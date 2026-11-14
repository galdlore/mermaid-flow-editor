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
  Languages,
  Link,
  List,
  ListOrdered,
  Quote,
  Save,
  Strikethrough,
  Table,
} from 'lucide-react';
import { useI18n } from '../i18n';

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

function buildMarkdownTable(
  rows: number,
  cols: number,
  getColHeader: (index: number) => string,
  bodyCell: string
): string {
  const safeRows = Math.max(1, Math.min(20, rows));
  const safeCols = Math.max(1, Math.min(12, cols));

  const headers = Array.from({ length: safeCols }, (_, index) => getColHeader(index + 1));
  const dividers = Array.from({ length: safeCols }, () => '---');
  const bodyRow = Array.from({ length: safeCols }, () => bodyCell);

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
  const { toggleLang, t } = useI18n();
  const [tablePopoverOpen, setTablePopoverOpen] = useState(false);
  const [tableRows, setTableRows] = useState(2);
  const [tableCols, setTableCols] = useState(2);

  const handleInsertTable = (): void => {
    onInsertText(
      buildMarkdownTable(
        tableRows,
        tableCols,
        t.toolbar.tableColHeader,
        t.toolbar.tableBodyCell
      )
    );
    setTablePopoverOpen(false);
  };

  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <button type="button" className="toolbar-btn" onClick={onNewFile} title={t.toolbar.newTitle}>
          <FilePlus size={16} />
          <span>{t.toolbar.newLabel}</span>
        </button>
        <button type="button" className="toolbar-btn" onClick={onOpenFile} title={t.toolbar.openTitle}>
          <FolderOpen size={16} />
          <span>{t.toolbar.openLabel}</span>
        </button>
        <button type="button" className="toolbar-btn" onClick={onSaveFile} title={t.toolbar.saveTitle}>
          <Save size={16} />
          <span>{t.toolbar.saveLabel}</span>
        </button>
        <button type="button" className="toolbar-btn" onClick={onSaveFileAs} title={t.toolbar.saveAsTitle}>
          <FileDown size={16} />
          <span>{t.toolbar.saveAsLabel}</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onClick={() => onInsertLinePrefix('# ')}
          title={t.toolbar.h1Title}
        >
          <Heading1 size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onClick={() => onInsertLinePrefix('## ')}
          title={t.toolbar.h2Title}
        >
          <Heading2 size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onClick={() => onInsertLinePrefix('### ')}
          title={t.toolbar.h3Title}
        >
          <Heading3 size={16} />
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onClick={() => onWrapSelection('**', '**', t.toolbar.boldPlaceholder)}
          title={t.toolbar.boldTitle}
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onClick={() => onWrapSelection('*', '*', t.toolbar.italicPlaceholder)}
          title={t.toolbar.italicTitle}
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onClick={() => onWrapSelection('~~', '~~', t.toolbar.strikePlaceholder)}
          title={t.toolbar.strikeTitle}
        >
          <Strikethrough size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onClick={() => onWrapSelection('[', '](https://example.com)', t.toolbar.linkPlaceholder)}
          title={t.toolbar.linkTitle}
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
          title={t.toolbar.bulletListTitle}
        >
          <List size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onClick={() => onInsertLinePrefix('1. ')}
          title={t.toolbar.orderedListTitle}
        >
          <ListOrdered size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onClick={() => onInsertLinePrefix('- [ ] ')}
          title={t.toolbar.taskListTitle}
        >
          <CheckSquare size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onClick={() => onInsertLinePrefix('> ')}
          title={t.toolbar.quoteTitle}
        >
          <Quote size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onClick={() => onInsertText(t.toolbar.codeBlockSnippet)}
          title={t.toolbar.codeBlockTitle}
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
          title={t.toolbar.tableButtonTitle}
        >
          <Table size={16} />
          <span>{t.toolbar.tableButtonLabel}</span>
        </button>

        {tablePopoverOpen && (
          <div className="table-popover">
            <div className="table-popover-title">{t.toolbar.tablePopoverTitle}</div>
            <label className="table-popover-field">
              <span>{t.toolbar.tableRows}</span>
              <input
                type="number"
                min={1}
                max={20}
                value={tableRows}
                onChange={(event) => setTableRows(Number(event.target.value) || 1)}
              />
            </label>
            <label className="table-popover-field">
              <span>{t.toolbar.tableCols}</span>
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
                {t.toolbar.tableClose}
              </button>
              <button type="button" className="btn-primary" onClick={handleInsertTable}>
                {t.toolbar.tableInsert}
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          className="toolbar-btn toolbar-btn-accent"
          onClick={onOpenNewMermaid}
          title={t.toolbar.mermaidButtonTitle}
        >
          <GitBranch size={16} />
          <span>{t.toolbar.mermaidButtonLabel}</span>
        </button>
      </div>

      <div className="toolbar-file-status" title={fileName}>
        <span className="file-name-text">{fileName}</span>
        {isDirty && <span className="unsaved-badge">{t.toolbar.unsavedBadge}</span>}
        <button
          type="button"
          className="toolbar-lang-btn"
          onClick={toggleLang}
          title={t.toolbar.langButtonTitle}
          aria-label={t.toolbar.langButtonTitle}
        >
          <Languages size={14} />
          <span>{t.toolbar.langButtonLabel}</span>
        </button>
      </div>
    </header>
  );
}
