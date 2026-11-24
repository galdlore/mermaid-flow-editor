import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGlobalShortcuts, type UseGlobalShortcutsOptions } from './useGlobalShortcuts';

function ShortcutHarness(props: UseGlobalShortcutsOptions) {
  useGlobalShortcuts(props);
  return null;
}

function createDefaultOptions(
  overrides: Partial<UseGlobalShortcutsOptions> = {}
): UseGlobalShortcutsOptions {
  return {
    mermaidModalOpen: false,
    settingsModalOpen: false,
    cloudBrowserMode: null,
    onCloseMermaidModal: vi.fn(),
    onCloseSettingsModal: vi.fn(),
    onCloseCloudBrowser: vi.fn(),
    onNewFile: vi.fn(),
    onOpenFile: vi.fn().mockResolvedValue(undefined),
    onPrint: vi.fn().mockResolvedValue(undefined),
    onSaveFile: vi.fn().mockResolvedValue(undefined),
    onSaveFileAs: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('useGlobalShortcuts', () => {
  it('triggers onNewFile for Ctrl+N, Cmd+N, Ctrl+Alt+N, and Alt+N and prevents default', () => {
    const opts = createDefaultOptions();
    render(<ShortcutHarness {...opts} />);

    const combos: KeyboardEventInit[] = [
      { key: 'n', code: 'KeyN', ctrlKey: true },
      { key: 'n', code: 'KeyN', metaKey: true },
      { key: 'Dead', code: 'KeyN', ctrlKey: true, altKey: true },
      { key: 'n', code: 'KeyN', altKey: true },
    ];

    for (const init of combos) {
      const event = new KeyboardEvent('keydown', { cancelable: true, ...init });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }

    expect(opts.onNewFile).toHaveBeenCalledTimes(4);
  });

  it('ignores Ctrl+Shift+N and IME composing events for new-file shortcut', () => {
    const opts = createDefaultOptions();
    render(<ShortcutHarness {...opts} />);

    fireEvent.keyDown(window, { key: 'N', code: 'KeyN', ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(window, { key: 'n', code: 'KeyN', ctrlKey: true, isComposing: true });
    fireEvent.keyDown(window, { key: 'n', code: 'KeyN', altKey: true, isComposing: true });

    expect(opts.onNewFile).not.toHaveBeenCalled();
  });

  it('suppresses file shortcuts when a modal is open and handles Escape', () => {
    const opts = createDefaultOptions({ mermaidModalOpen: true });
    render(<ShortcutHarness {...opts} />);

    fireEvent.keyDown(window, { key: 'n', code: 'KeyN', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'n', code: 'KeyN', altKey: true });
    expect(opts.onNewFile).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(opts.onCloseMermaidModal).toHaveBeenCalledTimes(1);
  });

  it('preserves Ctrl+O, Ctrl+S, Ctrl+Shift+S, and Ctrl+P shortcuts', () => {
    const opts = createDefaultOptions();
    render(<ShortcutHarness {...opts} />);

    fireEvent.keyDown(window, { key: 'o', ctrlKey: true });
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'S', ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(window, { key: 'p', ctrlKey: true });

    expect(opts.onOpenFile).toHaveBeenCalledTimes(1);
    expect(opts.onSaveFile).toHaveBeenCalledTimes(1);
    expect(opts.onSaveFileAs).toHaveBeenCalledTimes(1);
    expect(opts.onPrint).toHaveBeenCalledTimes(1);
  });
});
