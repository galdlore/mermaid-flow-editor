import {
  forwardRef, lazy, Suspense, useCallback, useDeferredValue, useEffect,
  useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent,
} from 'react';
import { flushSync } from 'react-dom';
import { ChevronDown, FileText } from 'lucide-react';
import { useI18n } from '../i18n';
import type { WysiwygEditorHandle } from './WysiwygEditor';
import { computeTabIndentEdit, type TabSizeOption } from '../utils/markdownTabIndent';
import { computeListContinueEdit } from '../utils/markdownListContinue';
import { buildMarkdownLink, formatMarkdownLinkDestination } from '../utils/markdownLinks';
import { extractMermaidBlocks } from '../utils/markdownMermaidBlocks';
import { extractCleanPreviewHtml } from '../utils/htmlExport';

const WysiwygEditor = lazy(() => import('./WysiwygEditor'));
const loadMarkdownPreviewPane = () => import('./MarkdownPreviewPane');
const MarkdownPreviewPane = lazy(loadMarkdownPreviewPane);

function waitForRenderFlush(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
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

export interface MarkdownEditorHandle {
  applyHeading: (level: 1 | 2 | 3) => void;
  applyBold: () => void;
  applyItalic: () => void;
  applyStrike: () => void;
  applyLink: () => void;
  applyBulletList: () => void;
  applyOrderedList: () => void;
  applyTaskList: () => void;
  applyQuote: () => void;
  applyCodeBlock: () => void;
  insertTable: (rows: number, cols: number) => void;
  insertMermaidBlock: (code: string) => void;
  insertLink: (label: string, href: string, isPreEncodedUrl?: boolean) => void;
  getSelectedText: () => string;
  insertAtCursor: (text: string) => void;
  wrapSelection: (prefix: string, suffix: string, placeholder: string) => void;
  insertLinePrefix: (prefix: string) => void;
  activateEditMode: () => void;
  getExportablePreviewHtml: () => string;
  getExportablePreviewHtmlAsync: () => Promise<string>;
  preparePreviewForPrint: () => Promise<void>;
  releaseExportPreview: () => void;
}

export interface MarkdownEditorProps {
  value: string;
  onChange: (nextValue: string) => void;
  onEditMermaid: (blockIndex: number, code: string) => void;
  onOpenNewMermaid?: () => void;
  onOpenMarkdownLink?: (href: string) => void;
  isDocumentLink?: (href: string) => boolean;
  editorMode: 'wysiwyg' | 'split';
  onChangeEditorMode: (nextMode: 'wysiwyg' | 'split') => void;
  tabSize: TabSizeOption;
  activeTabTitle?: string;
  tabCount?: number;
  isDirty?: boolean;
  onOpenTabSwitcher?: () => void;
}

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor(
    {
      value,
      onChange,
      onEditMermaid,
      onOpenNewMermaid,
      onOpenMarkdownLink,
      isDocumentLink,
      editorMode,
      onChangeEditorMode,
      tabSize,
      activeTabTitle,
      tabCount = 1,
      isDirty = false,
      onOpenTabSwitcher,
    },
    ref
  ) {
    const { t } = useI18n();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const wysiwygRef = useRef<WysiwygEditorHandle>(null);
    const previewBodyRef = useRef<HTMLDivElement>(null);
    const [mobilePane, setMobilePane] = useState<'wysiwyg' | 'edit' | 'preview'>(() =>
      editorMode === 'wysiwyg' ? 'wysiwyg' : 'edit'
    );
    const [forcePreviewForExport, setForcePreviewForExport] = useState(false);
    const prevEditorModeRef = useRef(editorMode);
    const pendingMermaidCountRef = useRef(0);
    const pendingWaitersRef = useRef<Array<() => void>>([]);

    const handleMermaidPendingChange = useCallback((delta: 1 | -1): void => {
      pendingMermaidCountRef.current = Math.max(0, pendingMermaidCountRef.current + delta);
      if (pendingMermaidCountRef.current === 0 && pendingWaitersRef.current.length > 0) {
        const waiters = pendingWaitersRef.current.splice(0);
        for (const resolve of waiters) {
          resolve();
        }
      }
    }, []);

    const waitForPendingMermaid = useCallback((timeoutMs = 2000): Promise<void> => {
      if (pendingMermaidCountRef.current === 0) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        let settled = false;
        const finish = (): void => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(finish, timeoutMs);
        pendingWaitersRef.current.push(finish);
      });
    }, []);

    useEffect(() => {
      if (typeof window === 'undefined') {
        return;
      }
      const handleBeforePrint = (): void => {
        void loadMarkdownPreviewPane();
        flushSync(() => {
          setForcePreviewForExport(true);
        });
      };
      const handleAfterPrint = (): void => {
        setForcePreviewForExport(false);
      };
      window.addEventListener('beforeprint', handleBeforePrint);
      window.addEventListener('afterprint', handleAfterPrint);
      return () => {
        window.removeEventListener('beforeprint', handleBeforePrint);
        window.removeEventListener('afterprint', handleAfterPrint);
      };
    }, []);

    useEffect(() => {
      if (prevEditorModeRef.current === editorMode) {
        return;
      }
      prevEditorModeRef.current = editorMode;
      if (editorMode === 'wysiwyg') {
        setMobilePane('wysiwyg');
      } else {
        setMobilePane((prev) => (prev === 'wysiwyg' ? 'edit' : prev));
      }
    }, [editorMode]);

    const mermaidBlocks = useMemo(() => extractMermaidBlocks(value), [value]);
    const mermaidBlocksRef = useRef(mermaidBlocks);
    mermaidBlocksRef.current = mermaidBlocks;

    const deferredPreviewValue = useDeferredValue(value);
    const shouldMountTextarea = editorMode === 'split' || mobilePane === 'edit';
    const shouldMountPreview =
      editorMode === 'split' || mobilePane === 'preview' || forcePreviewForExport;
    const previewMarkdownValue = forcePreviewForExport ? value : deferredPreviewValue;

    const ensurePreviewMountedAndRendered = useCallback(async (): Promise<boolean> => {
      await loadMarkdownPreviewPane();
      const needsTemporaryMount =
        !shouldMountPreview || deferredPreviewValue !== value || !previewBodyRef.current;
      if (needsTemporaryMount) {
        flushSync(() => {
          setForcePreviewForExport(true);
        });
      }
      const deadline = Date.now() + 500;
      while (!previewBodyRef.current && Date.now() < deadline) {
        await waitForRenderFlush();
      }
      await waitForRenderFlush();
      await waitForPendingMermaid(2000);
      await waitForRenderFlush();
      return needsTemporaryMount;
    }, [
      shouldMountPreview,
      deferredPreviewValue,
      value,
      waitForPendingMermaid,
    ]);

    const isWysiwygActive = (): boolean => {
      if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 768px)')?.matches) {
        return mobilePane === 'wysiwyg';
      }
      return editorMode === 'wysiwyg';
    };

    const applyEdit = (nextValue: string, selectionStart: number, selectionEnd: number): void => {
      onChange(nextValue);
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.focus();
        textarea.setSelectionRange(selectionStart, selectionEnd);
      });
    };

    const insertAtTextareaCursor = (text: string): void => {
      const textarea = textareaRef.current;
      if (!textarea) {
        onChange(value + text);
        return;
      }
      const { selectionStart: start, selectionEnd: end } = textarea;
      const nextCursor = start + text.length;
      applyEdit(value.slice(0, start) + text + value.slice(end), nextCursor, nextCursor);
    };

    const wrapTextareaSelection = (prefix: string, suffix: string, placeholder: string): void => {
      const textarea = textareaRef.current;
      if (!textarea) {
        onChange(`${value}${prefix}${placeholder}${suffix}`);
        return;
      }
      const { selectionStart: start, selectionEnd: end } = textarea;
      const inner = value.slice(start, end) || placeholder;
      const innerStart = start + prefix.length;
      applyEdit(
        value.slice(0, start) + `${prefix}${inner}${suffix}` + value.slice(end),
        innerStart,
        innerStart + inner.length
      );
    };

    const insertTextareaLinePrefix = (prefix: string): void => {
      const textarea = textareaRef.current;
      if (!textarea) {
        onChange(`${value}\n${prefix}`);
        return;
      }
      const start = textarea.selectionStart;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const nextCursor = start + prefix.length;
      applyEdit(value.slice(0, lineStart) + prefix + value.slice(lineStart), nextCursor, nextCursor);
    };

    const runModeAction = (
      wysiwygFn: (handle: WysiwygEditorHandle | null) => void,
      textareaFn: () => void
    ): void => {
      if (isWysiwygActive()) {
        wysiwygFn(wysiwygRef.current);
        return;
      }
      textareaFn();
    };

    useImperativeHandle(
      ref,
      () => ({
        applyHeading: (level) =>
          runModeAction(
            (w) => w?.applyHeading(level),
            () => insertTextareaLinePrefix(`${'#'.repeat(level)} `)
          ),
        applyBold: () =>
          runModeAction(
            (w) => w?.applyBold(),
            () => wrapTextareaSelection('**', '**', t.toolbar.boldPlaceholder)
          ),
        applyItalic: () =>
          runModeAction(
            (w) => w?.applyItalic(),
            () => wrapTextareaSelection('*', '*', t.toolbar.italicPlaceholder)
          ),
        applyStrike: () =>
          runModeAction(
            (w) => w?.applyStrike(),
            () => wrapTextareaSelection('~~', '~~', t.toolbar.strikePlaceholder)
          ),
        applyLink: () =>
          runModeAction(
            (w) => w?.applyLink(t.toolbar.linkPlaceholder),
            () => wrapTextareaSelection('[', '](https://example.com)', t.toolbar.linkPlaceholder)
          ),
        applyBulletList: () =>
          runModeAction(
            (w) => w?.applyBulletList(),
            () => insertTextareaLinePrefix('- ')
          ),
        applyOrderedList: () =>
          runModeAction(
            (w) => w?.applyOrderedList(),
            () => insertTextareaLinePrefix('1. ')
          ),
        applyTaskList: () =>
          runModeAction(
            (w) => w?.applyTaskList(),
            () => insertTextareaLinePrefix('- [ ] ')
          ),
        applyQuote: () =>
          runModeAction(
            (w) => w?.applyQuote(),
            () => insertTextareaLinePrefix('> ')
          ),
        applyCodeBlock: () =>
          runModeAction(
            (w) => w?.applyCodeBlock(),
            () => insertAtTextareaCursor(t.toolbar.codeBlockSnippet)
          ),
        insertTable: (rows, cols) =>
          runModeAction(
            (w) => w?.insertTable(rows, cols),
            () =>
              insertAtTextareaCursor(
                buildMarkdownTable(rows, cols, t.toolbar.tableColHeader, t.toolbar.tableBodyCell)
              )
          ),
        insertMermaidBlock: (code) =>
          runModeAction(
            (w) => w?.insertMermaidBlock(code),
            () => insertAtTextareaCursor(`\n\`\`\`mermaid\n${code}\n\`\`\`\n`)
          ),
        insertLink: (label, href, isPreEncodedUrl) =>
          runModeAction(
            (w) => w?.insertLink(label, formatMarkdownLinkDestination(href, isPreEncodedUrl)),
            () => insertAtTextareaCursor(buildMarkdownLink(label, href, isPreEncodedUrl))
          ),
        getSelectedText() {
          if (isWysiwygActive()) {
            return wysiwygRef.current?.getSelectedText() ?? '';
          }
          const textarea = textareaRef.current;
          if (!textarea || textarea.selectionStart === textarea.selectionEnd) {
            return '';
          }
          return value.slice(textarea.selectionStart, textarea.selectionEnd).trim();
        },
        insertAtCursor: (text) =>
          runModeAction(
            (w) => w?.insertText(text),
            () => insertAtTextareaCursor(text)
          ),
        wrapSelection: wrapTextareaSelection,
        insertLinePrefix: insertTextareaLinePrefix,
        activateEditMode() {
          const isWysiwyg = editorMode === 'wysiwyg';
          setMobilePane(isWysiwyg ? 'wysiwyg' : 'edit');
          requestAnimationFrame(() => {
            if (isWysiwyg) {
              wysiwygRef.current?.focus();
            } else {
              textareaRef.current?.focus();
            }
          });
        },
        getExportablePreviewHtml: () => extractCleanPreviewHtml(previewBodyRef.current),
        async getExportablePreviewHtmlAsync() {
          const mountedTemporarily = await ensurePreviewMountedAndRendered();
          const html = extractCleanPreviewHtml(previewBodyRef.current);
          if (mountedTemporarily) {
            flushSync(() => {
              setForcePreviewForExport(false);
            });
          }
          return html;
        },
        async preparePreviewForPrint() {
          await ensurePreviewMountedAndRendered();
        },
        releaseExportPreview() {
          setForcePreviewForExport(false);
        },
      }),
      [value, onChange, editorMode, mobilePane, ensurePreviewMountedAndRendered, t]
    );

    const resolveBlockIndex = useCallback(
      (startLine: number | undefined, codeText: string): number => {
        const blocks = mermaidBlocksRef.current;
        if (typeof startLine === 'number') {
          const byLine = blocks.find(
            (block) => startLine >= block.startLine && startLine <= block.endLine
          );
          if (byLine) {
            return byLine.index;
          }
        }
        const normalized = codeText.replace(/\r\n/g, '\n').trimEnd();
        const byCode = blocks.find(
          (block) => block.code.replace(/\r\n/g, '\n').trimEnd() === normalized
        );
        return byCode ? byCode.index : 0;
      },
      []
    );

    const handleTextareaKeyDown = (
      event: KeyboardEvent<HTMLTextAreaElement>
    ): void => {
      if (
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        event.nativeEvent.isComposing
      ) {
        return;
      }

      const target = event.currentTarget;
      if (event.key === 'Tab') {
        event.preventDefault();
        const result = computeTabIndentEdit(
          value,
          target.selectionStart,
          target.selectionEnd,
          tabSize,
          event.shiftKey
        );
        applyEdit(result.nextValue, result.nextStart, result.nextEnd);
        return;
      }

      if (event.key === 'Enter' && !event.shiftKey) {
        const result = computeListContinueEdit(
          value,
          target.selectionStart,
          target.selectionEnd
        );
        if (result) {
          event.preventDefault();
          applyEdit(result.nextValue, result.nextStart, result.nextEnd);
        }
      }
    };

    const mobilePaneButtons: Array<{
      id: 'wysiwyg' | 'edit' | 'preview';
      label: string;
      mode?: 'wysiwyg' | 'split';
    }> = [
      { id: 'wysiwyg', label: t.editor.mobileWysiwygLabel, mode: 'wysiwyg' },
      { id: 'edit', label: t.editor.mobileEditLabel, mode: 'split' },
      { id: 'preview', label: t.editor.mobilePreviewLabel },
    ];

    return (
      <div className="editor-workspace-root">
        <div className="mobile-editor-tabs" role="tablist">
          {onOpenTabSwitcher && (
            <button
              type="button"
              className="mobile-tab-switcher-btn"
              onClick={onOpenTabSwitcher}
              title={activeTabTitle ?? t.tabs.switcherAria}
              aria-label={t.tabs.switcherAria}
            >
              <FileText size={14} className="mobile-tab-switcher-icon" />
              <span className="mobile-tab-switcher-title">
                {activeTabTitle ?? t.app.untitledFileName}
              </span>
              {isDirty && <span className="doc-tab-dirty-dot" aria-hidden="true" />}
              {tabCount > 1 && <span className="tab-count-badge">{tabCount}</span>}
              <ChevronDown size={13} className="mobile-tab-switcher-chevron" />
            </button>
          )}
          <div className="mobile-pane-switch-group">
            {mobilePaneButtons.map((pane) => (
              <button
                key={pane.id}
                type="button"
                role="tab"
                aria-selected={mobilePane === pane.id}
                className={`mobile-editor-tab-btn ${mobilePane === pane.id ? 'is-active' : ''}`}
                onClick={() => {
                  setMobilePane(pane.id);
                  if (pane.mode) {
                    onChangeEditorMode(pane.mode);
                  }
                }}
              >
                {pane.label}
              </button>
            ))}
          </div>
        </div>
        <div
          className="editor-split-pane"
          data-editor-mode={editorMode}
          data-mobile-active={mobilePane}
        >
          {(editorMode === 'wysiwyg' || mobilePane === 'wysiwyg') && (
            <Suspense
              fallback={
                <section className="editor-pane-wysiwyg">
                  <div className="pane-header">
                    <span>{t.editor.wysiwygPaneHeader}</span>
                  </div>
                  <div className="wysiwyg-editor-scroll" />
                </section>
              }
            >
              <WysiwygEditor
                ref={wysiwygRef}
                value={value}
                onChange={onChange}
                onEditMermaid={onEditMermaid}
                onOpenNewMermaid={onOpenNewMermaid}
                onOpenMarkdownLink={onOpenMarkdownLink}
              />
            </Suspense>
          )}
          {shouldMountTextarea && (
            <section className="editor-pane-left">
              <div className="pane-header">
                <span>{t.editor.editorPaneHeader}</span>
              </div>
              <textarea
                ref={textareaRef}
                className="markdown-textarea"
                style={{ tabSize }}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={handleTextareaKeyDown}
                placeholder={t.editor.editorPlaceholder}
                spellCheck={false}
              />
            </section>
          )}

          {shouldMountPreview && (
            <Suspense
              fallback={
                <section className="editor-pane-right">
                  <div className="pane-header">{t.editor.previewPaneHeader}</div>
                  <div className="markdown-preview-scroll" />
                </section>
              }
            >
              <MarkdownPreviewPane
                value={previewMarkdownValue}
                previewBodyRef={previewBodyRef}
                resolveBlockIndex={resolveBlockIndex}
                onEditMermaid={onEditMermaid}
                onOpenMarkdownLink={onOpenMarkdownLink}
                isDocumentLink={isDocumentLink}
                onRenderPendingChange={handleMermaidPendingChange}
              />
            </Suspense>
          )}
        </div>
      </div>
    );
  }
);

export default MarkdownEditor;
