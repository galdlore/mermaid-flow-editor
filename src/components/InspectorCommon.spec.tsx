import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n';
import {
  CommitIdInput,
  InspectorBulkControls,
  InspectorColorPalette,
  InspectorCommentsSection,
} from './InspectorCommon';

describe('InspectorCommon', () => {
  it('renders InspectorBulkControls in toggle and dual modes and invokes callbacks', () => {
    const onSetAllToggle = vi.fn();
    const { rerender } = render(
      <I18nProvider>
        <InspectorBulkControls allExpanded={false} onSetAll={onSetAllToggle} />
      </I18nProvider>
    );

    const expandBtn = screen.getByRole('button', { name: 'すべて展開' });
    fireEvent.click(expandBtn);
    expect(onSetAllToggle).toHaveBeenCalledWith(true);

    rerender(
      <I18nProvider>
        <InspectorBulkControls allExpanded={true} onSetAll={onSetAllToggle} />
      </I18nProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'すべて折りたたむ' }));
    expect(onSetAllToggle).toHaveBeenCalledWith(false);

    const onSetAllDual = vi.fn();
    rerender(
      <I18nProvider>
        <InspectorBulkControls mode="dual" onSetAll={onSetAllDual} />
      </I18nProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'すべて展開' }));
    fireEvent.click(screen.getByRole('button', { name: 'すべて折りたたむ' }));
    expect(onSetAllDual).toHaveBeenNthCalledWith(1, true);
    expect(onSetAllDual).toHaveBeenNthCalledWith(2, false);
  });

  it('strips leading %% in InspectorCommentsSection, keeps trailing newline while typing, and clears on empty', () => {
    function Harness() {
      const [comments, setComments] = useState<string[] | undefined>(['初期メモ']);
      return (
        <I18nProvider>
          <InspectorCommentsSection
            title="コメント"
            placeholder="コメントを入力"
            comments={comments}
            isOpen={true}
            onToggle={vi.fn()}
            onChangeComments={setComments}
          />
          <div data-testid="serialized">{JSON.stringify(comments ?? null)}</div>
        </I18nProvider>
      );
    }

    render(<Harness />);
    const textarea = screen.getByPlaceholderText('コメントを入力') as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: '%% line1\n' } });
    expect(textarea.value).toBe('%% line1\n');
    expect(screen.getByTestId('serialized')).toHaveTextContent('["line1"]');

    fireEvent.change(textarea, { target: { value: '%% line1\n  %%% line2  ' } });
    expect(screen.getByTestId('serialized')).toHaveTextContent('["line1","line2"]');

    fireEvent.change(textarea, { target: { value: '   \n  ' } });
    expect(screen.getByTestId('serialized')).toHaveTextContent('null');
  });

  it('selects and clears colors in InspectorColorPalette', () => {
    const onChange = vi.fn();
    render(
      <I18nProvider>
        <InspectorColorPalette
          label="背景色"
          value="#eff6ff"
          clearTitle="色なし"
          onChange={onChange}
        />
      </I18nProvider>
    );

    const clearBtn = screen.getByRole('button', { name: '色なし' });
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith(undefined);

    const greenBtn = screen.getByRole('button', { name: '緑' });
    fireEvent.click(greenBtn);
    expect(onChange).toHaveBeenCalledWith('#f0fdf4');
  });

  it('commits ID on blur and Enter key in CommitIdInput while normalizing returned values', () => {
    const onCommit = vi.fn((raw: string) => raw.trim().toUpperCase() || 'NODE_1');
    render(
      <I18nProvider>
        <CommitIdInput
          label="ノードID"
          value="NODE_1"
          placeholder="NODE_1"
          forbiddenRegex={/[;]/g}
          formatError={(chars) => `blocked:${chars.join(',')}`}
          onCommit={onCommit}
        />
      </I18nProvider>
    );

    const input = screen.getByLabelText('ノードID') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '  node_2  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCommit).toHaveBeenCalledWith('  node_2  ');
    expect(input.value).toBe('NODE_2');

    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith('   ');
    expect(input.value).toBe('NODE_1');
  });
});
