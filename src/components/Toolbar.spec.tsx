import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n';
import Toolbar from './Toolbar';

function renderToolbar(overrides: Partial<React.ComponentProps<typeof Toolbar>> = {}) {
  const props: React.ComponentProps<typeof Toolbar> = {
    fileName: 'sample.md',
    tabCount: 1,
    isDirty: false,
    switcherOpen: false,
    editorMode: 'split',
    onToggleEditorMode: vi.fn(),
    onOpenTabSwitcher: vi.fn(),
    onNewFile: vi.fn(),
    onOpenFile: vi.fn(),
    onSaveFile: vi.fn(),
    onSaveFileAs: vi.fn(),
    onOpenFromCloud: vi.fn(),
    onSaveToCloud: vi.fn(),
    onSaveToCloudAs: vi.fn(),
    onExportHtml: vi.fn(),
    onExportPdf: vi.fn(),
    onPrint: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenHelp: vi.fn(),
    onHeading: vi.fn(),
    onBold: vi.fn(),
    onItalic: vi.fn(),
    onStrike: vi.fn(),
    onLink: vi.fn(),
    onBulletList: vi.fn(),
    onOrderedList: vi.fn(),
    onTaskList: vi.fn(),
    onQuote: vi.fn(),
    onCodeBlock: vi.fn(),
    onInsertTable: vi.fn(),
    onOpenNewMermaid: vi.fn(),
    ...overrides,
  };

  render(
    <I18nProvider>
      <Toolbar {...props} />
    </I18nProvider>
  );

  return props;
}

describe('Toolbar', () => {
  it('opens the File menu, triggers cloud/local/export actions, and closes on outside click or Escape', () => {
    const props = renderToolbar();

    const fileMenuBtn = screen.getByRole('button', { name: 'ファイル' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.click(fileMenuBtn);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'クラウドから開く' }));
    expect(props.onOpenFromCloud).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.click(fileMenuBtn);
    fireEvent.click(screen.getByRole('menuitem', { name: 'HTML出力' }));
    expect(props.onExportHtml).toHaveBeenCalledTimes(1);

    fireEvent.click(fileMenuBtn);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.click(fileMenuBtn);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('invokes settings and help callbacks from toolbar icon buttons', () => {
    const props = renderToolbar();

    fireEvent.click(screen.getByRole('button', { name: '設定（Tabインデント・クラウド保存）' }));
    expect(props.onOpenSettings).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '使い方ガイドを新しいタブで開く' }));
    expect(props.onOpenHelp).toHaveBeenCalledTimes(1);
  });
});
