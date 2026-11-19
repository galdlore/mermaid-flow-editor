import { useEffect, useRef, useState, type MouseEvent } from 'react';
import {
  Bold,
  CheckSquare,
  ChevronDown,
  CloudDownload,
  CloudUpload,
  Code,
  Columns2,
  FileCode2,
  FileDown,
  FileOutput,
  FilePlus,
  FileText,
  FolderOpen,
  FolderUp,
  GitBranch,
  Heading1,
  Heading2,
  Heading3,
  HelpCircle,
  Italic,
  Languages,
  Link,
  List,
  ListOrdered,
  PenLine,
  Printer,
  Quote,
  Save,
  Settings,
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
  onOpenFromCloud: () => void;
  onSaveToCloud: () => void;
  onSaveToCloudAs: () => void;
  onExportHtml: () => void;
  onExportPdf: () => void;
  onPrint: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
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
  onOpenFromCloud,
  onSaveToCloud,
  onSaveToCloudAs,
  onExportHtml,
  onExportPdf,
  onPrint,
  onOpenSettings,
  onOpenHelp,
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
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [tablePopoverOpen, setTablePopoverOpen] = useState(false);
  const [tableRows, setTableRows] = useState(2);
  const [tableCols, setTableCols] = useState(2);

  const fileMenuAnchorRef = useRef<HTMLDivElement>(null);
  const tablePopoverAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!fileMenuOpen && !tablePopoverOpen) {
      return;
    }

    const handlePointerDown = (event: globalThis.MouseEvent): void => {
      const target = event.target as Node | null;
      if (
        fileMenuOpen &&
        fileMenuAnchorRef.current &&
        target &&
        !fileMenuAnchorRef.current.contains(target)
      ) {
        setFileMenuOpen(false);
      }
      if (
        tablePopoverOpen &&
        tablePopoverAnchorRef.current &&
        target &&
        !tablePopoverAnchorRef.current.contains(target)
      ) {
        setTablePopoverOpen(false);
      }
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setFileMenuOpen(false);
        setTablePopoverOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fileMenuOpen, tablePopoverOpen]);

  const keepEditorFocus = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
  };

  const handleInsertTable = (): void => {
    onInsertTable(tableRows, tableCols);
    setTablePopoverOpen(false);
  };

  const runFileAction = (action: () => void): void => {
    setFileMenuOpen(false);
    action();
  };

  return (
    <header className="toolbar">
      <div className="toolbar-group toolbar-popover-anchor" ref={fileMenuAnchorRef}>
        <button
          type="button"
          className={`toolbar-btn toolbar-file-menu-btn ${fileMenuOpen ? 'is-open' : ''}`}
          aria-haspopup="menu"
          aria-expanded={fileMenuOpen}
          onClick={() => {
            setTablePopoverOpen(false);
            setFileMenuOpen((prev) => !prev);
          }}
          title={t.toolbar.fileMenuTitle}
        >
          <FileText size={16} />
          <span>{t.toolbar.fileMenuLabel}</span>
          <ChevronDown size={13} />
        </button>

        {fileMenuOpen && (
          <div className="file-menu-popover" role="menu">
            <div className="file-menu-section-label">{t.toolbar.fileSectionBasic}</div>
            <button
              type="button"
              role="menuitem"
              className="file-menu-item"
              onClick={() => runFileAction(onNewFile)}
              title={t.toolbar.newTitle}
            >
              <FilePlus size={15} />
              <span className="file-menu-item-label">{t.toolbar.newLabel}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="file-menu-item"
              onClick={() => runFileAction(onOpenFile)}
              title={t.toolbar.openTitle}
            >
              <FolderOpen size={15} />
              <span className="file-menu-item-label">{t.toolbar.openLabel}</span>
              <span className="file-menu-shortcut">Ctrl+O</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="file-menu-item"
              onClick={() => runFileAction(onSaveFile)}
              title={t.toolbar.saveTitle}
            >
              <Save size={15} />
              <span className="file-menu-item-label">{t.toolbar.saveLabel}</span>
              <span className="file-menu-shortcut">Ctrl+S</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="file-menu-item"
              onClick={() => runFileAction(onSaveFileAs)}
              title={t.toolbar.saveAsTitle}
            >
              <FileDown size={15} />
              <span className="file-menu-item-label">{t.toolbar.saveAsLabel}</span>
              <span className="file-menu-shortcut">Ctrl+Shift+S</span>
            </button>

            <div className="file-menu-divider" />
            <div className="file-menu-section-label">{t.toolbar.fileSectionCloud}</div>
            <button
              type="button"
              role="menuitem"
              className="file-menu-item"
              onClick={() => runFileAction(onOpenFromCloud)}
              title={t.toolbar.openCloudTitle}
            >
              <CloudDownload size={15} />
              <span className="file-menu-item-label">{t.toolbar.openCloudLabel}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="file-menu-item"
              onClick={() => runFileAction(onSaveToCloud)}
              title={t.toolbar.saveCloudTitle}
            >
              <CloudUpload size={15} />
              <span className="file-menu-item-label">{t.toolbar.saveCloudLabel}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="file-menu-item"
              onClick={() => runFileAction(onSaveToCloudAs)}
              title={t.toolbar.saveCloudAsTitle}
            >
              <FolderUp size={15} />
              <span className="file-menu-item-label">{t.toolbar.saveCloudAsLabel}</span>
            </button>

            <div className="file-menu-divider" />
            <div className="file-menu-section-label">{t.toolbar.fileSectionExport}</div>
            <button
              type="button"
              role="menuitem"
              className="file-menu-item"
              onClick={() => runFileAction(onExportHtml)}
              title={t.toolbar.exportHtmlTitle}
            >
              <FileCode2 size={15} />
              <span className="file-menu-item-label">{t.toolbar.exportHtmlLabel}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="file-menu-item"
              onClick={() => runFileAction(onExportPdf)}
              title={t.toolbar.exportPdfTitle}
            >
              <FileOutput size={15} />
              <span className="file-menu-item-label">{t.toolbar.exportPdfLabel}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="file-menu-item"
              onClick={() => runFileAction(onPrint)}
              title={t.toolbar.printTitle}
            >
              <Printer size={15} />
              <span className="file-menu-item-label">{t.toolbar.printLabel}</span>
              <span className="file-menu-shortcut">Ctrl+P</span>
            </button>
          </div>
        )}
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

      <div className="toolbar-group toolbar-popover-anchor" ref={tablePopoverAnchorRef}>
        <button
          type="button"
          className="toolbar-btn"
          onMouseDown={keepEditorFocus}
          onClick={() => {
            setFileMenuOpen(false);
            setTablePopoverOpen((prev) => !prev);
          }}
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
        <button
          type="button"
          className="toolbar-icon-pill-btn"
          onClick={onOpenSettings}
          title={t.toolbar.settingsTitle}
          aria-label={t.toolbar.settingsTitle}
        >
          <Settings size={15} />
        </button>
        <button
          type="button"
          className="toolbar-icon-pill-btn"
          onClick={onOpenHelp}
          title={t.toolbar.helpTitle}
          aria-label={t.toolbar.helpTitle}
        >
          <HelpCircle size={15} />
        </button>
      </div>
    </header>
  );
}
