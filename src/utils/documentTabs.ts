import { readLocalStorage, writeLocalStorage } from './storage.ts';

export interface DocumentTab {
  id: string;
  filePath: string | null;
  content: string;
  isDirty: boolean;
  remoteFileName?: string | null;
  remoteUrl?: string | null;
  isGuide?: boolean;
  embedFileId?: string | null;
  embedReadOnly?: boolean;
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

/** 2つのローカルファイルパスが同一ファイルを指すか判定する（Windowsの大文字・小文字と区切り文字を吸収） */
export function isSameLocalFilePath(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) {
    return false;
  }
  if (a === b) {
    return true;
  }
  const isWindowsPath = (value: string): boolean =>
    /^[a-zA-Z]:[\\/]/.test(value) || /^\\\\/.test(value);
  if (isWindowsPath(a) && isWindowsPath(b)) {
    return a.replace(/\//g, '\\').toLowerCase() === b.replace(/\//g, '\\').toLowerCase();
  }
  return false;
}

/** リモートURLから末尾ファイル名（デコード済み）を取り出す */
export function getRemoteUrlBaseName(remoteUrl: string, fallback: string): string {
  const cleanUrl = remoteUrl.trim().split(/[?#]/)[0] ?? '';
  const withoutTrailingSlash = cleanUrl.replace(/\/+$/, '');
  const lastSlash = withoutTrailingSlash.lastIndexOf('/');
  const rawSegment = lastSlash >= 0 ? withoutTrailingSlash.slice(lastSlash + 1) : withoutTrailingSlash;
  if (!rawSegment) {
    return fallback;
  }
  try {
    return decodeURIComponent(rawSegment) || fallback;
  } catch {
    return rawSegment;
  }
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
  tabs: readonly Pick<DocumentTab, 'id' | 'filePath' | 'isGuide' | 'remoteFileName' | 'remoteUrl'>[],
  untitledFileName: string,
  guideFileName?: string
): Record<string, string> {
  const result: Record<string, string> = {};
  const usedTitles = new Set<string>();

  for (const tab of tabs) {
    let baseName: string;
    if (tab.filePath) {
      baseName = getTabBaseFileName(tab.filePath, untitledFileName);
    } else if (tab.isGuide && guideFileName) {
      baseName = guideFileName;
    } else if (tab.remoteFileName) {
      baseName = getTabBaseFileName(tab.remoteFileName, untitledFileName);
    } else if (tab.remoteUrl) {
      baseName = getRemoteUrlBaseName(tab.remoteUrl, untitledFileName);
    } else {
      baseName = untitledFileName;
    }
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
            typeof item.isDirty === 'boolean' &&
            (item.remoteFileName === undefined ||
              item.remoteFileName === null ||
              typeof item.remoteFileName === 'string') &&
            (item.remoteUrl === undefined ||
              item.remoteUrl === null ||
              typeof item.remoteUrl === 'string') &&
            (item.isGuide === undefined || typeof item.isGuide === 'boolean') &&
            (item.embedFileId === undefined ||
              item.embedFileId === null ||
              typeof item.embedFileId === 'string') &&
            (item.embedReadOnly === undefined || typeof item.embedReadOnly === 'boolean')
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
        isGuide: true,
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
