import {
  forwardRef,
  isValidElement,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Pencil } from 'lucide-react';
import { useI18n } from '../i18n';
import { renderMermaidSvg } from '../utils/mermaidRender';

export interface MarkdownEditorHandle {
  insertAtCursor: (text: string) => void;
  wrapSelection: (prefix: string, suffix: string, placeholder: string) => void;
  insertLinePrefix: (prefix: string) => void;
}

export interface MarkdownEditorProps {
  value: string;
  onChange: (nextValue: string) => void;
  onEditMermaid: (blockIndex: number, code: string) => void;
}

interface MermaidBlockMeta {
  index: number;
  startLine: number;
  endLine: number;
  code: string;
}

function extractMermaidBlocks(markdown: string): MermaidBlockMeta[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: MermaidBlockMeta[] = [];
  let inMermaid = false;
  let startLine = 0;
  let buffer: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!inMermaid) {
      if (/^```\s*mermaid\b/i.test(trimmed)) {
        inMermaid = true;
        startLine = i + 1;
        buffer = [];
      }
    } else if (/^```\s*$/.test(trimmed)) {
      blocks.push({
        index: blocks.length,
        startLine,
        endLine: i + 1,
        code: buffer.join('\n'),
      });
      inMermaid = false;
    } else {
      buffer.push(lines[i]);
    }
  }

  return blocks;
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
  function MarkdownEditor({ value, onChange, onEditMermaid }, ref) {
    const { t } = useI18n();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const mermaidBlocks = useMemo(() => extractMermaidBlocks(value), [value]);

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

    return (
      <div className="editor-split-pane">
        <section className="editor-pane-left">
          <div className="pane-header">{t.editor.editorPaneHeader}</div>
          <textarea
            ref={textareaRef}
            className="markdown-textarea"
            value={value}
            onChange={(event) => onChange(event.target.value)}
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
    );
  }
);

export default MarkdownEditor;
