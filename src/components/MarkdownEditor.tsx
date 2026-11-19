import {
  forwardRef,
  isValidElement,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, FileText, Pencil } from 'lucide-react';
import { useI18n } from '../i18n';
import { renderMermaidSvg } from '../utils/mermaidRender';
import WysiwygEditor, { type WysiwygEditorHandle } from './WysiwygEditor';
import {
  computeTabIndentEdit,
  type TabSizeOption,
} from '../utils/markdownTabIndent';
import { computeListContinueEdit } from '../utils/markdownListContinue';
import { buildMarkdownLink, formatMarkdownLinkDestination } from '../utils/markdownLinks';
import { extractMermaidBlocks } from '../utils/markdownMermaidBlocks';
import { extractCleanPreviewHtml } from '../utils/htmlExport';

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
}

export interface MarkdownEditorProps {
  value: string;
  onChange: (nextValue: string) => void;
  onEditMermaid: (blockIndex: number, code: string) => void;
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

interface MermaidPreviewBlockProps {
  code: string;
  blockIndex: number;
  onEdit: (blockIndex: number, code: string) => void;
}

function MermaidPreviewBlock({ code, blockIndex, onEdit }: MermaidPreviewBlockProps) {
  const { t } = useI18n();
  const reactId = useId();
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const renderId = `mermaid_svg_${reactId.replace(/[^a-zA-Z0-9_]/g, '_')}_${Date.now()}`;

    const renderDiagram = async (): Promise<void> => {
      if (!code.trim()) {
        if (!cancelled) {
          setSvg('');
          setError(t.editor.emptyMermaidError);
        }
        return;
      }

      const result = await renderMermaidSvg(renderId, code);
      if (!cancelled) {
        setSvg(result.svg);
        setError(result.error);
      }
    };

    void renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [code, reactId, t.editor.emptyMermaidError]);

  return (
    <div className="mermaid-preview-card" data-mermaid-block="true">
      <button
        type="button"
        className="mermaid-edit-float-btn"
        onClick={() => onEdit(blockIndex, code)}
        title={t.editor.editDiagramTitle}
      >
        <Pencil size={14} />
        <span>{t.editor.editDiagramLabel}</span>
      </button>

      {error ? (
        <div className="mermaid-error-box">
          <strong>{t.editor.renderErrorTitle}</strong>
          <pre>{error}</pre>
        </div>
      ) : (
        <div className="mermaid-svg-container" dangerouslySetInnerHTML={{ __html: svg }} />
      )}
    </div>
  );
}

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor(
    {
      value,
      onChange,
      onEditMermaid,
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
    const [mobilePane, setMobilePane] = useState<'wysiwyg' | 'edit' | 'preview'>('wysiwyg');
    const prevEditorModeRef = useRef(editorMode);

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

    const isWysiwygActive = (): boolean => {
      if (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches) {
        return mobilePane === 'wysiwyg';
      }
      return editorMode === 'wysiwyg';
    };

    const applyEdit = (
      nextValue: string,
      selectionStart: number,
      selectionEnd: number
    ): void => {
      onChange(nextValue);
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) {
          return;
        }
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
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const nextValue = value.slice(0, start) + text + value.slice(end);
      const nextCursor = start + text.length;
      applyEdit(nextValue, nextCursor, nextCursor);
    };

    const wrapTextareaSelection = (
      prefix: string,
      suffix: string,
      placeholder: string
    ): void => {
      const textarea = textareaRef.current;
      if (!textarea) {
        onChange(`${value}${prefix}${placeholder}${suffix}`);
        return;
      }
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = value.slice(start, end);
      const inner = selected || placeholder;
      const inserted = `${prefix}${inner}${suffix}`;
      const nextValue = value.slice(0, start) + inserted + value.slice(end);
      const innerStart = start + prefix.length;
      const innerEnd = innerStart + inner.length;
      applyEdit(nextValue, innerStart, innerEnd);
    };

    const insertTextareaLinePrefix = (prefix: string): void => {
      const textarea = textareaRef.current;
      if (!textarea) {
        onChange(`${value}\n${prefix}`);
        return;
      }
      const start = textarea.selectionStart;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const nextValue = value.slice(0, lineStart) + prefix + value.slice(lineStart);
      const nextCursor = start + prefix.length;
      applyEdit(nextValue, nextCursor, nextCursor);
    };

    useImperativeHandle(
      ref,
      () => ({
        applyHeading(level: 1 | 2 | 3) {
          if (isWysiwygActive()) {
            wysiwygRef.current?.applyHeading(level);
            return;
          }
          insertTextareaLinePrefix(`${'#'.repeat(level)} `);
        },
        applyBold() {
          if (isWysiwygActive()) {
            wysiwygRef.current?.applyBold();
            return;
          }
          wrapTextareaSelection('**', '**', t.toolbar.boldPlaceholder);
        },
        applyItalic() {
          if (isWysiwygActive()) {
            wysiwygRef.current?.applyItalic();
            return;
          }
          wrapTextareaSelection('*', '*', t.toolbar.italicPlaceholder);
        },
        applyStrike() {
          if (isWysiwygActive()) {
            wysiwygRef.current?.applyStrike();
            return;
          }
          wrapTextareaSelection('~~', '~~', t.toolbar.strikePlaceholder);
        },
        applyLink() {
          if (isWysiwygActive()) {
            wysiwygRef.current?.applyLink(t.toolbar.linkPlaceholder);
            return;
          }
          wrapTextareaSelection('[', '](https://example.com)', t.toolbar.linkPlaceholder);
        },
        applyBulletList() {
          if (isWysiwygActive()) {
            wysiwygRef.current?.applyBulletList();
            return;
          }
          insertTextareaLinePrefix('- ');
        },
        applyOrderedList() {
          if (isWysiwygActive()) {
            wysiwygRef.current?.applyOrderedList();
            return;
          }
          insertTextareaLinePrefix('1. ');
        },
        applyTaskList() {
          if (isWysiwygActive()) {
            wysiwygRef.current?.applyTaskList();
            return;
          }
          insertTextareaLinePrefix('- [ ] ');
        },
        applyQuote() {
          if (isWysiwygActive()) {
            wysiwygRef.current?.applyQuote();
            return;
          }
          insertTextareaLinePrefix('> ');
        },
        applyCodeBlock() {
          if (isWysiwygActive()) {
            wysiwygRef.current?.applyCodeBlock();
            return;
          }
          insertAtTextareaCursor(t.toolbar.codeBlockSnippet);
        },
        insertTable(rows: number, cols: number) {
          if (isWysiwygActive()) {
            wysiwygRef.current?.insertTable(rows, cols);
            return;
          }
          insertAtTextareaCursor(
            buildMarkdownTable(
              rows,
              cols,
              t.toolbar.tableColHeader,
              t.toolbar.tableBodyCell
            )
          );
        },
        insertMermaidBlock(code: string) {
          if (isWysiwygActive()) {
            wysiwygRef.current?.insertMermaidBlock(code);
            return;
          }
          insertAtTextareaCursor(`\n\`\`\`mermaid\n${code}\n\`\`\`\n`);
        },
        insertLink(label: string, href: string, isPreEncodedUrl?: boolean) {
          if (isWysiwygActive()) {
            wysiwygRef.current?.insertLink(
              label,
              formatMarkdownLinkDestination(href, isPreEncodedUrl)
            );
            return;
          }
          insertAtTextareaCursor(buildMarkdownLink(label, href, isPreEncodedUrl));
        },
        getSelectedText() {
          if (isWysiwygActive()) {
            return wysiwygRef.current?.getSelectedText() ?? '';
          }
          const textarea = textareaRef.current;
          if (!textarea) {
            return '';
          }
          const { selectionStart, selectionEnd } = textarea;
          if (selectionStart === selectionEnd) {
            return '';
          }
          return value.slice(selectionStart, selectionEnd).trim();
        },
        insertAtCursor(text: string) {
          if (isWysiwygActive()) {
            wysiwygRef.current?.insertText(text);
            return;
          }
          insertAtTextareaCursor(text);
        },
        wrapSelection: wrapTextareaSelection,
        insertLinePrefix: insertTextareaLinePrefix,
        activateEditMode() {
          if (editorMode === 'wysiwyg') {
            setMobilePane('wysiwyg');
            requestAnimationFrame(() => {
              wysiwygRef.current?.focus();
            });
          } else {
            setMobilePane('edit');
            requestAnimationFrame(() => {
              textareaRef.current?.focus();
            });
          }
        },
        getExportablePreviewHtml() {
          return extractCleanPreviewHtml(previewBodyRef.current);
        },
      }),
      [value, onChange, editorMode, mobilePane, t]
    );

    const resolveBlockIndex = (startLine: number | undefined, codeText: string): number => {
      if (typeof startLine === 'number') {
        const byLine = mermaidBlocks.find(
          (block) => startLine >= block.startLine && startLine <= block.endLine
        );
        if (byLine) {
          return byLine.index;
        }
      }
      const normalized = codeText.replace(/\r\n/g, '\n').trimEnd();
      const byCode = mermaidBlocks.find(
        (block) => block.code.replace(/\r\n/g, '\n').trimEnd() === normalized
      );
      return byCode ? byCode.index : 0;
    };

    const isMermaidPreChild = (children: ReactNode): boolean => {
      if (!isValidElement<{ className?: string }>(children)) {
        return false;
      }
      return Boolean(children.props.className && /language-mermaid\b/.test(children.props.className));
    };

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
            <button
              type="button"
              role="tab"
              aria-selected={mobilePane === 'wysiwyg'}
              className={`mobile-editor-tab-btn ${mobilePane === 'wysiwyg' ? 'is-active' : ''}`}
              onClick={() => {
                setMobilePane('wysiwyg');
                onChangeEditorMode('wysiwyg');
              }}
            >
              {t.editor.mobileWysiwygLabel}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobilePane === 'edit'}
              className={`mobile-editor-tab-btn ${mobilePane === 'edit' ? 'is-active' : ''}`}
              onClick={() => {
                setMobilePane('edit');
                onChangeEditorMode('split');
              }}
            >
              {t.editor.mobileEditLabel}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobilePane === 'preview'}
              className={`mobile-editor-tab-btn ${mobilePane === 'preview' ? 'is-active' : ''}`}
              onClick={() => setMobilePane('preview')}
            >
              {t.editor.mobilePreviewLabel}
            </button>
          </div>
        </div>
        <div
          className="editor-split-pane"
          data-editor-mode={editorMode}
          data-mobile-active={mobilePane}
        >
        {(editorMode === 'wysiwyg' || mobilePane === 'wysiwyg') && (
          <WysiwygEditor
            ref={wysiwygRef}
            value={value}
            onChange={onChange}
            onEditMermaid={onEditMermaid}
            onOpenMarkdownLink={onOpenMarkdownLink}
          />
        )}
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

        <section className="editor-pane-right">
          <div className="pane-header">{t.editor.previewPaneHeader}</div>
          <div className="markdown-preview-scroll">
            <div ref={previewBodyRef} className="markdown-preview-body">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a({ node: _node, href, children, className, title, onClick, ...rest }) {
                    const rawHref = typeof href === 'string' ? href : '';
                    const isInAppDocLink = rawHref ? (isDocumentLink?.(rawHref) ?? false) : false;
                    const isExternalHttp = !isInAppDocLink && /^https?:\/\//i.test(rawHref);
                    const isHashAnchor = rawHref.startsWith('#');
                    const combinedClassName = isInAppDocLink
                      ? [className, 'markdown-doc-link'].filter(Boolean).join(' ')
                      : className;

                    return (
                      <a
                        {...rest}
                        href={rawHref || undefined}
                        className={combinedClassName}
                        target={isExternalHttp ? '_blank' : undefined}
                        rel={isExternalHttp ? 'noopener noreferrer' : undefined}
                        title={isInAppDocLink ? t.editor.openLinkedDocTitle : title}
                        onClick={(event) => {
                          onClick?.(event);
                          if (!rawHref) {
                            event.preventDefault();
                            return;
                          }
                          if (isHashAnchor) {
                            return;
                          }
                          if (isInAppDocLink && onOpenMarkdownLink) {
                            event.preventDefault();
                            onOpenMarkdownLink(rawHref);
                            return;
                          }
                          if (!isExternalHttp) {
                            event.preventDefault();
                            onOpenMarkdownLink?.(rawHref);
                          }
                        }}
                      >
                        {children}
                      </a>
                    );
                  },
                  pre({ children }) {
                    if (isMermaidPreChild(children)) {
                      return <div className="mermaid-pre-container">{children}</div>;
                    }
                    return <pre className="markdown-code-pre">{children}</pre>;
                  },
                  code({ node, className, children, ...rest }) {
                    const match = /language-(\w+)/.exec(className || '');
                    if (match && match[1].toLowerCase() === 'mermaid') {
                      const codeText = String(children).replace(/\n$/, '');
                      const blockIndex = resolveBlockIndex(node?.position?.start.line, codeText);
                      return (
                        <MermaidPreviewBlock
                          code={codeText}
                          blockIndex={blockIndex}
                          onEdit={onEditMermaid}
                        />
                      );
                    }
                    return (
                      <code className={className} {...rest}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {value}
              </ReactMarkdown>
            </div>
          </div>
        </section>
        </div>
      </div>
    );
  }
);

export default MarkdownEditor;
