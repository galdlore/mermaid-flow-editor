import { createRef, forwardRef, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n';
import MarkdownEditor, { type MarkdownEditorHandle } from './MarkdownEditor';
import { renderMermaidSvg } from '../utils/mermaidRender';

vi.mock('./WysiwygEditor', () => ({
  default: forwardRef<HTMLDivElement>((_props, ref) => (
    <div ref={ref} data-testid="wysiwyg-mock" />
  )),
}));

vi.mock('../utils/mermaidRender', () => ({
  renderMermaidSvg: vi.fn().mockResolvedValue({ svg: '<svg></svg>', error: null }),
}));

function ControlledSplitEditor({
  initialValue,
  onOpenMarkdownLink,
  isDocumentLink,
}: {
  initialValue: string;
  onOpenMarkdownLink?: (href: string) => void;
  isDocumentLink?: (href: string) => boolean;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <I18nProvider>
      <MarkdownEditor
        value={value}
        onChange={setValue}
        onEditMermaid={vi.fn()}
        onOpenMarkdownLink={onOpenMarkdownLink}
        isDocumentLink={isDocumentLink}
        editorMode="split"
        onChangeEditorMode={vi.fn()}
        tabSize={2}
      />
    </I18nProvider>
  );
}

describe('MarkdownEditor split mode keyboard editing', () => {
  it('continues bullet and ordered lists on Enter and indents on Tab', () => {
    render(<ControlledSplitEditor initialValue={'1. first\n2. third'} />);

    expect(screen.queryByTestId('wysiwyg-mock')).toBeNull();

    const textarea = screen.getByPlaceholderText(
      'ここにMarkdownを入力するか、上部のボタンから要素を挿入してください。'
    ) as HTMLTextAreaElement;

    const endOfFirst = '1. first'.length;
    textarea.setSelectionRange(endOfFirst, endOfFirst);
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(textarea.value).toBe('1. first\n2. \n3. third');

    const lineStart = '1. first\n'.length;
    textarea.setSelectionRange(lineStart, lineStart);
    fireEvent.keyDown(textarea, { key: 'Tab' });

    expect(textarea.value).toBe('1. first\n  2. \n3. third');
  });

  it('intercepts in-app markdown document links in preview and marks external links safely', async () => {
    const onOpenMarkdownLink = vi.fn();
    render(
      <ControlledSplitEditor
        initialValue={'[仕様書](./spec.md) と [外部](https://example.com)'}
        onOpenMarkdownLink={onOpenMarkdownLink}
        isDocumentLink={(href) => href.endsWith('.md')}
      />
    );

    const specLink = await screen.findByRole('link', { name: '仕様書' }, { timeout: 4000 });
    expect(specLink).toHaveClass('markdown-doc-link');
    expect(specLink).not.toHaveAttribute('target', '_blank');

    const clickResult = fireEvent.click(specLink);
    expect(clickResult).toBe(false);
    expect(onOpenMarkdownLink).toHaveBeenCalledWith('./spec.md');

    const externalLink = screen.getByRole('link', { name: '外部' });
    expect(externalLink).toHaveAttribute('target', '_blank');
    expect(externalLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('unmounts split preview pane in wysiwyg mode and renders clean HTML on demand for export', async () => {
    vi.mocked(renderMermaidSvg).mockClear();
    const editorRef = createRef<MarkdownEditorHandle>();
    const md = '# タイトル\n\n```mermaid\nflowchart TD\n  A-->B\n```';

    render(
      <I18nProvider>
        <MarkdownEditor
          ref={editorRef}
          value={md}
          onChange={vi.fn()}
          onEditMermaid={vi.fn()}
          editorMode="wysiwyg"
          onChangeEditorMode={vi.fn()}
          tabSize={2}
        />
      </I18nProvider>
    );

    expect(document.querySelector('.editor-pane-left')).toBeNull();
    expect(document.querySelector('.editor-pane-right')).toBeNull();

    const exportedHtml =
      (await editorRef.current?.getExportablePreviewHtmlAsync()) ?? '';

    expect(exportedHtml).toContain('<h1>タイトル</h1>');
    expect(exportedHtml).toContain('<svg></svg>');
    expect(exportedHtml).not.toContain('mermaid-edit-float-btn');
    expect(document.querySelector('.editor-pane-right')).toBeNull();
  });

  it('does not re-render unchanged Mermaid blocks when editing surrounding text in split mode', async () => {
    vi.mocked(renderMermaidSvg).mockClear();
    const initial = '```mermaid\nflowchart TD\n  A-->B\n```\n\nメモ1';
    render(<ControlledSplitEditor initialValue={initial} />);

    await waitFor(() => {
      expect(vi.mocked(renderMermaidSvg)).toHaveBeenCalledTimes(1);
    });

    const textarea = screen.getByPlaceholderText(
      'ここにMarkdownを入力するか、上部のボタンから要素を挿入してください。'
    ) as HTMLTextAreaElement;

    fireEvent.change(textarea, {
      target: { value: '```mermaid\nflowchart TD\n  A-->B\n```\n\nメモ2' },
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });

    expect(vi.mocked(renderMermaidSvg)).toHaveBeenCalledTimes(1);
  });
});
