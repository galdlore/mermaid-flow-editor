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
import {
  computeTabIndentEdit,
  TAB_SIZE_OPTIONS,
  type TabSizeOption,
} from '../utils/markdownTabIndent';
import { extractMermaidBlocks } from '../utils/markdownMermaidBlocks';
import { readLocalStorage, writeLocalStorage } from '../utils/storage';

const TAB_SIZE_STORAGE_KEY = 'mermaid-flow-editor:tab-size';

function loadInitialTabSize(): TabSizeOption {
  const raw = Number(readLocalStorage(TAB_SIZE_STORAGE_KEY));
  if (raw === 4) {
    return 4;
  }
  return 2;
}

export interface MarkdownEditorHandle {
  insertAtCursor: (text: string) => void;
  wrapSelection: (prefix: string, suffix: string, placeholder: string) => void;
  insertLinePrefix: (prefix: string) => void;
  activateEditMode: () => void;
}

export interface MarkdownEditorProps {
  value: string;
  onChange: (nextValue: string) => void;
  onEditMermaid: (blockIndex: number, code: string) => void;
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
      activeTabTitle,
      tabCount = 1,
      isDirty = false,
      onOpenTabSwitcher,
    },
    ref
  ) {
    const { t } = useI18n();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [tabSize, setTabSize] = useState<TabSizeOption>(loadInitialTabSize);
    const [mobilePane, setMobilePane] = useState<'edit' | 'preview'>('edit');

    const mermaidBlocks = useMemo(() => extractMermaidBlocks(value), [value]);

    const handleTabSizeChange = (nextSize: TabSizeOption): void => {
      setTabSize(nextSize);
      writeLocalStorage(TAB_SIZE_STORAGE_KEY, String(nextSize));
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

    useImperativeHandle(
      ref,
      () => ({
        insertAtCursor(text: string) {
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
        },

        wrapSelection(prefix: string, suffix: string, placeholder: string) {
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
        },

        insertLinePrefix(prefix: string) {
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
        },

        activateEditMode() {
          setMobilePane('edit');
          requestAnimationFrame(() => {
            textareaRef.current?.focus();
          });
        },
      }),
      [value, onChange]
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
        event.key !== 'Tab' ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        event.nativeEvent.isComposing
      ) {
        return;
      }

      event.preventDefault();
      const target = event.currentTarget;
      const result = computeTabIndentEdit(
        value,
        target.selectionStart,
        target.selectionEnd,
        tabSize,
        event.shiftKey
      );
      applyEdit(result.nextValue, result.nextStart, result.nextEnd);
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
              aria-selected={mobilePane === 'edit'}
              className={`mobile-editor-tab-btn ${mobilePane === 'edit' ? 'is-active' : ''}`}
              onClick={() => setMobilePane('edit')}
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
        <div className="editor-split-pane" data-mobile-active={mobilePane}>
        <section className="editor-pane-left">
          <div className="pane-header">
            <span>{t.editor.editorPaneHeader}</span>
            <label className="pane-tab-size-control">
              <span>{t.editor.tabSizeLabel}</span>
              <select
                className="pane-tab-size-select"
                aria-label={t.editor.tabSizeLabel}
                value={tabSize}
                onChange={(event) =>
                  handleTabSizeChange(Number(event.target.value) === 4 ? 4 : 2)
                }
              >
                {TAB_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {t.editor.tabSpacesOption(size)}
                  </option>
                ))}
              </select>
            </label>
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
            <div className="markdown-preview-body">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
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
