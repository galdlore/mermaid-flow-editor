import { useEffect } from 'react';
import type { CloudBrowserMode } from './useCloudStorage';

export interface UseGlobalShortcutsOptions {
  mermaidModalOpen: boolean;
  settingsModalOpen: boolean;
  cloudBrowserMode: CloudBrowserMode | null;
  onCloseMermaidModal: () => void;
  onCloseSettingsModal: () => void;
  onCloseCloudBrowser: () => void;
  onNewFile: () => void;
  onOpenFile: () => Promise<void>;
  onPrint: () => Promise<void>;
  onSaveFile: () => Promise<void>;
  onSaveFileAs: () => Promise<void>;
}

export function useGlobalShortcuts({
  mermaidModalOpen,
  settingsModalOpen,
  cloudBrowserMode,
  onCloseMermaidModal,
  onCloseSettingsModal,
  onCloseCloudBrowser,
  onNewFile,
  onOpenFile,
  onPrint,
  onSaveFile,
  onSaveFileAs,
}: UseGlobalShortcutsOptions): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (mermaidModalOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          onCloseMermaidModal();
        }
        return;
      }

      if (settingsModalOpen) {
        if (event.key === 'Escape') {
          event.preventDefault();
          onCloseSettingsModal();
        }
        return;
      }

      if (cloudBrowserMode !== null) {
        if (event.key === 'Escape') {
          event.preventDefault();
          onCloseCloudBrowser();
        }
        return;
      }

      if (event.isComposing) {
        return;
      }

      if (
        event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'n'
      ) {
        event.preventDefault();
        onNewFile();
        return;
      }

      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 's' && event.shiftKey) {
        event.preventDefault();
        void onSaveFileAs();
      } else if (key === 's') {
        event.preventDefault();
        void onSaveFile();
      } else if (key === 'o') {
        event.preventDefault();
        void onOpenFile();
      } else if (key === 'p' && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        void onPrint();
      } else if (!event.shiftKey && (key === 'n' || (event.altKey && event.code === 'KeyN'))) {
        event.preventDefault();
        onNewFile();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    cloudBrowserMode,
    mermaidModalOpen,
    onCloseCloudBrowser,
    onCloseMermaidModal,
    onCloseSettingsModal,
    onNewFile,
    onOpenFile,
    onPrint,
    onSaveFile,
    onSaveFileAs,
    settingsModalOpen,
  ]);
}
