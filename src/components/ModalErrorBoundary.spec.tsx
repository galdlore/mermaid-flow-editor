import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ModalErrorBoundary from './ModalErrorBoundary';

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Failed to fetch dynamically imported module');
  }
  return <div>正常なコンテンツ</div>;
}

function Harness({
  shouldThrow,
  onCloseSpy,
  onReloadSpy,
}: {
  shouldThrow: boolean;
  onCloseSpy: () => void;
  onReloadSpy: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <ModalErrorBoundary
      title="画面を表示できませんでした"
      description="ページの再読み込みで解消します。"
      reloadLabel="ページを再読み込み"
      closeLabel="閉じる"
      resetKey={open ? '1' : '0'}
      onClose={() => {
        setOpen(false);
        onCloseSpy();
      }}
      onReload={onReloadSpy}
    >
      {open && <ThrowingChild shouldThrow={shouldThrow} />}
    </ModalErrorBoundary>
  );
}

describe('ModalErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children normally when no error is thrown', () => {
    render(
      <Harness
        shouldThrow={false}
        onCloseSpy={vi.fn()}
        onReloadSpy={vi.fn()}
      />
    );

    expect(screen.getByText('正常なコンテンツ')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('catches synchronous render errors, shows fallback alertdialog, and handles Reload and Close', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onCloseSpy = vi.fn();
    const onReloadSpy = vi.fn();

    render(
      <Harness
        shouldThrow
        onCloseSpy={onCloseSpy}
        onReloadSpy={onReloadSpy}
      />
    );

    const dialog = screen.getByRole('alertdialog', { name: '画面を表示できませんでした' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('ページの再読み込みで解消します。')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch dynamically imported module')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ページを再読み込み' }));
    expect(onReloadSpy).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    expect(onCloseSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
