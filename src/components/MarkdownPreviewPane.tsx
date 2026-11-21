import {
  isValidElement,
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Pencil } from 'lucide-react';
import { useI18n } from '../i18n';
import { renderMermaidSvg } from '../utils/mermaidRender';

const REMARK_PLUGINS = [remarkGfm];

function isMermaidPreChild(children: ReactNode): boolean {
  if (!isValidElement<{ className?: string }>(children)) {
    return false;
  }
  return Boolean(
    children.props.className && /language-mermaid\b/.test(children.props.className)
  );
}

interface MermaidPreviewBlockProps {
  code: string;
  blockIndex: number;
  onEdit: (blockIndex: number, code: string) => void;
  onRenderPendingChange?: (delta: 1 | -1) => void;
}

const MermaidPreviewBlock = memo(function MermaidPreviewBlock({
  code,
  blockIndex,
  onEdit,
  onRenderPendingChange,
}: MermaidPreviewBlockProps) {
  const { t } = useI18n();
  const reactId = useId();
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const hasRenderedOnceRef = useRef(false);
  const onRenderPendingChangeRef = useRef(onRenderPendingChange);
  onRenderPendingChangeRef.current = onRenderPendingChange;

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const markStart = (): void => {
      if (!inFlight) {
        inFlight = true;
        onRenderPendingChangeRef.current?.(1);
      }
    };

    const markEnd = (): void => {
      if (inFlight) {
        inFlight = false;
        onRenderPendingChangeRef.current?.(-1);
      }
    };

    if (!code.trim()) {
      hasRenderedOnceRef.current = true;
      setSvg('');
      setError(t.editor.emptyMermaidError);
      return () => {
        cancelled = true;
        markEnd();
      };
    }

    const renderId = `mermaid_svg_${reactId.replace(/[^a-zA-Z0-9_]/g, '_')}_${Date.now()}`;
    const delayMs = hasRenderedOnceRef.current ? 200 : 0;
    markStart();

    const renderDiagram = async (): Promise<void> => {
      try {
        const result = await renderMermaidSvg(renderId, code);
        if (!cancelled) {
          hasRenderedOnceRef.current = true;
          setSvg(result.svg);
          setError(result.error);
        }
      } finally {
        markEnd();
      }
    };

    if (delayMs === 0) {
      void renderDiagram();
    } else {
      timer = setTimeout(() => {
        timer = null;
        void renderDiagram();
      }, delayMs);
    }

    return () => {
      cancelled = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      markEnd();
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
});

export interface MarkdownPreviewPaneProps {
  value: string;
  previewBodyRef: RefObject<HTMLDivElement>;
  resolveBlockIndex: (startLine: number | undefined, codeText: string) => number;
  onEditMermaid: (blockIndex: number, code: string) => void;
  onOpenMarkdownLink?: (href: string) => void;
  isDocumentLink?: (href: string) => boolean;
  onRenderPendingChange?: (delta: 1 | -1) => void;
}

export default function MarkdownPreviewPane({
  value,
  previewBodyRef,
  resolveBlockIndex,
  onEditMermaid,
  onOpenMarkdownLink,
  isDocumentLink,
  onRenderPendingChange,
}: MarkdownPreviewPaneProps) {
  const { t } = useI18n();
  const onEditMermaidRef = useRef(onEditMermaid);
  onEditMermaidRef.current = onEditMermaid;
  const onOpenMarkdownLinkRef = useRef(onOpenMarkdownLink);
  onOpenMarkdownLinkRef.current = onOpenMarkdownLink;
  const isDocumentLinkRef = useRef(isDocumentLink);
  isDocumentLinkRef.current = isDocumentLink;

  const handleEditMermaidStable = useRef((blockIndex: number, code: string) => {
    onEditMermaidRef.current(blockIndex, code);
  }).current;

  const markdownComponents = useMemo<Components>(
    () => ({
      a({ node: _node, href, children, className, title, onClick, ...rest }) {
        const rawHref = typeof href === 'string' ? href : '';
        const isInAppDocLink = rawHref
          ? (isDocumentLinkRef.current?.(rawHref) ?? false)
          : false;
        const isExternalHttp =
          !isInAppDocLink && /^https?:\/\//i.test(rawHref);
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
              if (isInAppDocLink && onOpenMarkdownLinkRef.current) {
                event.preventDefault();
                onOpenMarkdownLinkRef.current(rawHref);
                return;
              }
              if (!isExternalHttp) {
                event.preventDefault();
                onOpenMarkdownLinkRef.current?.(rawHref);
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
          const blockIndex = resolveBlockIndex(
            node?.position?.start.line,
            codeText
          );
          return (
            <MermaidPreviewBlock
              code={codeText}
              blockIndex={blockIndex}
              onEdit={handleEditMermaidStable}
              onRenderPendingChange={onRenderPendingChange}
            />
          );
        }
        return (
          <code className={className} {...rest}>
            {children}
          </code>
        );
      },
    }),
    [
      t.editor.openLinkedDocTitle,
      resolveBlockIndex,
      handleEditMermaidStable,
      onRenderPendingChange,
    ]
  );

  return (
    <section className="editor-pane-right">
      <div className="pane-header">{t.editor.previewPaneHeader}</div>
      <div className="markdown-preview-scroll">
        <div ref={previewBodyRef} className="markdown-preview-body">
          <ReactMarkdown
            remarkPlugins={REMARK_PLUGINS}
            components={markdownComponents}
          >
            {value}
          </ReactMarkdown>
        </div>
      </div>
    </section>
  );
}
