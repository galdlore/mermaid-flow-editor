import { useState, type MouseEvent } from 'react';
import {
  Bold,
  CheckSquare,
  ChevronDown,
  Code,
  Columns2,
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
  PenLine,
  Quote,
  Save,
  Strikethrough,
  Table,
} from 'lucide-react';
import { useI18n } from '../i18n';

export interface ToolbarProps {
  fileName: string;
  tabCount: number;
  isDirty: boolean;
  switcherOpen: boolean;
  editorMode: 'wysiwyg' | 'split';
  onToggleEditorMode: () => void;
  onOpenTabSwitcher: () => void;
  onNewFile: () => void;
  onOpenFile: () => void;
  onSaveFile: () => void;
  onSaveFileAs: () => void;
  onHeading: (level: 1 | 2 | 3) => void;
  onBold: () => void;
  onItalic: () => void;
  onStrike: () => void;
  onLink: () => void;
  onBulletList: () => void;
  onOrderedList: () => void;
  onTaskList: () => void;
  onQuote: () => void;
  onCodeBlock: () => void;
  onInsertTable: (rows: number, cols: number) => void;
  onOpenNewMermaid: () => void;
}

export default function Toolbar({
  fileName,
  tabCount,
  isDirty,
  switcherOpen,
  editorMode,
  onToggleEditorMode,
  onOpenTabSwitcher,
  onNewFile,
  onOpenFile,
  onSaveFile,
  onSaveFileAs,
  onHeading,
  onBold,
  onItalic,
  onStrike,
  onLink,
  onBulletList,
  onOrderedList,
  onTaskList,
  onQuote,
  onCodeBlock,
  onInsertTable,
  onOpenNewMermaid,
}: ToolbarProps) {
  const { toggleLang, t } = useI18n();
  const [tablePopoverOpen, setTablePopoverOpen] = useState(false);
  const [tableRows, setTableRows] = useState(2);
  const [tableCols, setTableCols] = useState(2);

  const keepEditorFocus = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
  };

  const handleInsertTable = (): void => {
    onInsertTable(tableRows, tableCols);
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
          onMouseDown={keepEditorFocus}
          onClick={() => onHeading(1)}
          title={t.toolbar.h1Title}
        >
          <Heading1 size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onMouseDown={keepEditorFocus}
          onClick={() => onHeading(2)}
          title={t.toolbar.h2Title}
        >
          <Heading2 size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onMouseDown={keepEditorFocus}
          onClick={() => onHeading(3)}
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
          onMouseDown={keepEditorFocus}
          onClick={onBold}
          title={t.toolbar.boldTitle}
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onMouseDown={keepEditorFocus}
          onClick={onItalic}
          title={t.toolbar.italicTitle}
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onMouseDown={keepEditorFocus}
          onClick={onStrike}
          title={t.toolbar.strikeTitle}
        >
          <Strikethrough size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onMouseDown={keepEditorFocus}
          onClick={onLink}
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
          onMouseDown={keepEditorFocus}
          onClick={onBulletList}
          title={t.toolbar.bulletListTitle}
        >
          <List size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onMouseDown={keepEditorFocus}
          onClick={onOrderedList}
          title={t.toolbar.orderedListTitle}
        >
          <ListOrdered size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onMouseDown={keepEditorFocus}
          onClick={onTaskList}
          title={t.toolbar.taskListTitle}
        >
          <CheckSquare size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onMouseDown={keepEditorFocus}
          onClick={onQuote}
          title={t.toolbar.quoteTitle}
        >
          <Quote size={16} />
        </button>
        <button
          type="button"
          className="toolbar-btn toolbar-btn-icon"
          onMouseDown={keepEditorFocus}
          onClick={onCodeBlock}
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
          onMouseDown={keepEditorFocus}
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
          onMouseDown={keepEditorFocus}
          onClick={onOpenNewMermaid}
          title={t.toolbar.mermaidButtonTitle}
        >
          <GitBranch size={16} />
          <span>{t.toolbar.mermaidButtonLabel}</span>
        </button>

        <button
          type="button"
          className={`toolbar-btn toolbar-mode-toggle-btn ${editorMode === 'wysiwyg' ? 'is-active' : ''}`}
          onClick={onToggleEditorMode}
          title={t.toolbar.editorModeToggleTitle}
        >
          {editorMode === 'wysiwyg' ? <Columns2 size={16} /> : <PenLine size={16} />}
          <span>
            {editorMode === 'wysiwyg'
              ? t.toolbar.editorModeSplitLabel
              : t.toolbar.editorModeWysiwygLabel}
          </span>
        </button>
      </div>

      <div className="toolbar-file-status">
        <button
          type="button"
          className="toolbar-tab-switcher-btn"
          onClick={onOpenTabSwitcher}
          aria-expanded={switcherOpen}
          title={`${fileName} (${t.tabs.switcherAria})`}
        >
          <span className="file-name-text">{fileName}</span>
          {tabCount > 1 && <span className="tab-count-badge">{tabCount}</span>}
          {isDirty && <span className="unsaved-badge">{t.toolbar.unsavedBadge}</span>}
          <ChevronDown size={13} className="toolbar-tab-chevron" />
        </button>
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
