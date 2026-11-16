import { readLocalStorage, writeLocalStorage } from './storage.ts';

export interface DocumentTab {
  id: string;
  filePath: string | null;
  content: string;
  isDirty: boolean;
}

export interface PersistedTabsState {
  activeTabId: string;
  tabs: DocumentTab[];
}

export const TABS_STORAGE_KEY = 'mermaid-flow-editor:tabs-v1';

const SUPPORTED_EXTENSIONS = ['.md', '.markdown', '.txt'];

/** ユニークなドキュメントタブIDを生成する */
export function createDocumentTabId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `tab-${crypto.randomUUID()}`;
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** ファイルパスから表示用のベースファイル名を取り出す */
export function getTabBaseFileName(
  filePath: string | null,
  untitledFileName: string
): string {
  if (!filePath) {
    return untitledFileName;
  }
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] || untitledFileName;
}

/** 重複ファイル名に対して拡張子の直前へ連番 (2), (3)... を付与する */
export function formatDuplicateFileName(fileName: string, suffixNumber: number): string {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex > 0) {
    const stem = fileName.slice(0, dotIndex);
    const ext = fileName.slice(dotIndex);
    return `${stem} (${suffixNumber})${ext}`;
  }
  return `${fileName} (${suffixNumber})`;
}

/** 開いている全タブに対して重複しない表示タイトルを計算する */
export function computeTabDisplayTitles(
  tabs: readonly Pick<DocumentTab, 'id' | 'filePath'>[],
  untitledFileName: string
): Record<string, string> {
  const result: Record<string, string> = {};
  const usedTitles = new Set<string>();

  for (const tab of tabs) {
    const baseName = getTabBaseFileName(tab.filePath, untitledFileName);
    if (!usedTitles.has(baseName)) {
      usedTitles.add(baseName);
      result[tab.id] = baseName;
      continue;
    }

    let suffix = 2;
    let candidate = formatDuplicateFileName(baseName, suffix);
    while (usedTitles.has(candidate)) {
      suffix += 1;
      candidate = formatDuplicateFileName(baseName, suffix);
    }
    usedTitles.add(candidate);
    result[tab.id] = candidate;
  }

  return result;
}

/** ドロップされたファイルが編集対応形式かどうかを判定する */
export function isSupportedDroppedFileName(fileName: string, mimeType = ''): boolean {
  const lowerName = fileName.trim().toLowerCase();
  if (SUPPORTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
    return true;
  }
  const lowerMime = mimeType.trim().toLowerCase();
  return lowerMime === 'text/markdown' || lowerMime === 'text/x-markdown';
}

/** ローカルストレージから保存済みタブ状態（または旧ドラフト）を読み込む */
export function loadPersistedTabsState(
  storageKey: string,
  legacyDraftKey: string,
  defaultSampleText: string
): PersistedTabsState {
  const raw = readLocalStorage(storageKey);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<PersistedTabsState>;
      if (Array.isArray(parsed.tabs)) {
        const validTabs = parsed.tabs.filter(
          (item): item is DocumentTab =>
            typeof item === 'object' &&
            item !== null &&
            typeof item.id === 'string' &&
            item.id.length > 0 &&
            (item.filePath === null || typeof item.filePath === 'string') &&
            typeof item.content === 'string' &&
            typeof item.isDirty === 'boolean'
        );

        if (validTabs.length > 0) {
          const activeExists =
            typeof parsed.activeTabId === 'string' &&
            validTabs.some((tab) => tab.id === parsed.activeTabId);
          return {
            tabs: validTabs,
            activeTabId: activeExists ? (parsed.activeTabId as string) : validTabs[0].id,
          };
        }
      }
    } catch {
      // 破損データ時はフォールバックへ進む
    }
  }

  const legacyDraft = readLocalStorage(legacyDraftKey);
  const initialId = createDocumentTabId();
  if (legacyDraft && legacyDraft.trim().length > 0) {
    return {
      activeTabId: initialId,
      tabs: [
        {
          id: initialId,
          filePath: null,
          content: legacyDraft,
          isDirty: false,
        },
      ],
    };
  }

  return {
    activeTabId: initialId,
    tabs: [
      {
        id: initialId,
        filePath: null,
        content: defaultSampleText,
        isDirty: false,
      },
    ],
  };
}

/** タブ一覧と選択中IDをローカルストレージへ保存する */
export function persistTabsState(
  storageKey: string,
  tabs: readonly DocumentTab[],
  activeTabId: string
): void {
  const payload: PersistedTabsState = {
    activeTabId,
    tabs: [...tabs],
  };
  writeLocalStorage(storageKey, JSON.stringify(payload));
}
