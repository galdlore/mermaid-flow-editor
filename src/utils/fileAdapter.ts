import type { FileOpenResult, FileSaveResult } from '../types/editor';
import { isSupportedDroppedFileName } from './documentTabs';

interface BrowserFileWritable {
  write: (data: string) => Promise<void>;
  close: () => Promise<void>;
}

export interface BrowserFileHandle {
  kind?: string;
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<BrowserFileWritable>;
  queryPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
  requestPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
}

interface DroppedDataTransferItem extends DataTransferItem {
  getAsFileSystemHandle?: () => Promise<BrowserFileHandle | null>;
}

export interface BrowserFileOpenResult extends FileOpenResult {
  handle?: BrowserFileHandle;
}

export interface DroppedMarkdownFile {
  fileName: string;
  content: string;
  handle?: BrowserFileHandle;
}

export interface DroppedMarkdownReadResult {
  files: DroppedMarkdownFile[];
  ignoredCount: number;
}

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface OpenFilePickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: FilePickerAcceptType[];
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  excludeAcceptAllOption?: boolean;
  types?: FilePickerAcceptType[];
}

interface PickerWindow {
  showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<BrowserFileHandle[]>;
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<BrowserFileHandle>;
}

const MARKDOWN_PICKER_TYPES: FilePickerAcceptType[] = [
  {
    description: 'Markdownファイル',
    accept: {
      'text/markdown': ['.md', '.markdown'],
      'text/plain': ['.txt'],
    },
  },
];

const HTML_PICKER_TYPES: FilePickerAcceptType[] = [
  {
    description: 'HTMLファイル',
    accept: {
      'text/html': ['.html', '.htm'],
    },
  },
];

const browserFileHandles = new Map<string, BrowserFileHandle>();

function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name: unknown }).name === 'AbortError'
  );
}

async function ensureWritePermission(handle: BrowserFileHandle): Promise<boolean> {
  if (typeof handle.queryPermission === 'function') {
    const status = await handle.queryPermission({ mode: 'readwrite' });
    if (status === 'granted') {
      return true;
    }
  }
  if (typeof handle.requestPermission === 'function') {
    const status = await handle.requestPermission({ mode: 'readwrite' });
    return status === 'granted';
  }
  return true;
}

async function writeToBrowserHandle(
  handle: BrowserFileHandle,
  content: string
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

function openWithInputFallback(): Promise<BrowserFileOpenResult> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.txt';

    let resolved = false;
    const finish = (result: BrowserFileOpenResult): void => {
      if (resolved) {
        return;
      }
      resolved = true;
      input.remove();
      resolve(result);
    };

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) {
        finish({ canceled: true });
        return;
      }
      const content = await file.text();
      finish({ canceled: false, filePath: file.name, content });
    });

    input.addEventListener('cancel', () => {
      finish({ canceled: true });
    });

    input.click();
  });
}

function downloadFallback(
  fileName: string,
  content: string,
  mimeType = 'text/markdown;charset=utf-8'
): FileSaveResult {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return { canceled: false, filePath: fileName };
}

/** タブに紐づくブラウザファイルハンドルを登録または解除する */
export function setBrowserFileHandle(
  tabId: string,
  handle: BrowserFileHandle | null | undefined
): void {
  if (handle) {
    browserFileHandles.set(tabId, handle);
  } else {
    browserFileHandles.delete(tabId);
  }
}

/** タブを閉じたとき等に保持中のファイルハンドルのみ解放する */
export function releaseBrowserFileHandle(tabId: string): void {
  browserFileHandles.delete(tabId);
}

/** 新規作成時や初期化時に特定タブ（または全体）のハンドル状態をリセットする */
export function resetBrowserFileHandle(tabId?: string): void {
  if (tabId) {
    browserFileHandles.delete(tabId);
    return;
  }
  browserFileHandles.clear();
  void window.electronAPI?.resetFileSession?.();
}

/** DragEventがテキスト選択ではなくファイルドロップかどうかを判定する */
export function isFileDragEvent(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) {
    return false;
  }
  return Array.from(dataTransfer.types).includes('Files');
}

/** ブラウザへドロップされたMarkdown/テキストファイルを読み込む */
export async function readDroppedMarkdownFiles(
  dataTransfer: DataTransfer
): Promise<DroppedMarkdownReadResult> {
  interface PendingEntry {
    file: File | null;
    handlePromise: Promise<BrowserFileHandle | null> | null;
  }

  // DataTransferItemListは非同期await後にクリアされるため同期的に収集する
  const pendingEntries: PendingEntry[] = [];
  if (dataTransfer.items && dataTransfer.items.length > 0) {
    for (const rawItem of Array.from(dataTransfer.items)) {
      if (rawItem.kind !== 'file') {
        continue;
      }
      const item = rawItem as DroppedDataTransferItem;
      const file = item.getAsFile();
      const handlePromise =
        typeof item.getAsFileSystemHandle === 'function'
          ? item.getAsFileSystemHandle().catch(() => null)
          : null;
      pendingEntries.push({ file, handlePromise });
    }
  } else if (dataTransfer.files && dataTransfer.files.length > 0) {
    for (const file of Array.from(dataTransfer.files)) {
      pendingEntries.push({ file, handlePromise: null });
    }
  }

  const files: DroppedMarkdownFile[] = [];
  let ignoredCount = 0;

  for (const entry of pendingEntries) {
    const resolvedHandle = entry.handlePromise ? await entry.handlePromise : null;
    if (resolvedHandle && resolvedHandle.kind && resolvedHandle.kind !== 'file') {
      ignoredCount += 1;
      continue;
    }

    let targetFile = entry.file;
    let writableHandle: BrowserFileHandle | undefined;
    if (resolvedHandle && typeof resolvedHandle.getFile === 'function') {
      writableHandle = resolvedHandle;
      if (!targetFile) {
        try {
          targetFile = await resolvedHandle.getFile();
        } catch {
          targetFile = null;
        }
      }
    }

    if (!targetFile) {
      ignoredCount += 1;
      continue;
    }

    if (!isSupportedDroppedFileName(targetFile.name, targetFile.type)) {
      ignoredCount += 1;
      continue;
    }

    const content = await targetFile.text();
    files.push({
      fileName: targetFile.name,
      content,
      handle: writableHandle,
    });
  }

  return { files, ignoredCount };
}

/** 実行環境に応じてElectronダイアログまたはブラウザAPIでファイルを開く */
export async function openMarkdownFile(): Promise<BrowserFileOpenResult> {
  if (window.electronAPI) {
    return window.electronAPI.openFile();
  }

  const pickerWindow = window as unknown as PickerWindow;
  if (typeof pickerWindow.showOpenFilePicker !== 'function') {
    return openWithInputFallback();
  }

  try {
    const handles = await pickerWindow.showOpenFilePicker({
      multiple: false,
      types: MARKDOWN_PICKER_TYPES,
    });
    const handle = handles[0];
    if (!handle) {
      return { canceled: true };
    }
    const file = await handle.getFile();
    const content = await file.text();
    return { canceled: false, filePath: file.name, content, handle };
  } catch (err) {
    if (isAbortError(err)) {
      return { canceled: true };
    }
    throw err;
  }
}

/** 実行環境に応じてElectronまたはブラウザAPIで別名保存を行う */
export async function saveMarkdownFileAs(
  tabId: string,
  content: string,
  suggestedName?: string | null
): Promise<FileSaveResult> {
  if (window.electronAPI) {
    return window.electronAPI.saveFileAs(content);
  }

  const targetName = suggestedName || 'document.md';
  const pickerWindow = window as unknown as PickerWindow;
  if (typeof pickerWindow.showSaveFilePicker !== 'function') {
    return downloadFallback(targetName, content);
  }

  try {
    const handle = await pickerWindow.showSaveFilePicker({
      suggestedName: targetName,
      types: MARKDOWN_PICKER_TYPES,
    });
    await writeToBrowserHandle(handle, content);
    browserFileHandles.set(tabId, handle);
    return { canceled: false, filePath: handle.name };
  } catch (err) {
    if (isAbortError(err)) {
      return { canceled: true };
    }
    throw err;
  }
}

/** 実行環境に応じてElectronまたはタブに紐づくハンドルへ上書き保存を行う */
export async function saveMarkdownFile(
  tabId: string,
  currentFilePath: string | null,
  content: string
): Promise<FileSaveResult> {
  if (window.electronAPI) {
    return window.electronAPI.saveFile(currentFilePath, content);
  }

  const handle = browserFileHandles.get(tabId);
  if (handle) {
    try {
      const allowed = await ensureWritePermission(handle);
      if (allowed) {
        await writeToBrowserHandle(handle, content);
        return { canceled: false, filePath: handle.name };
      }
    } catch (err) {
      if (isAbortError(err)) {
        return { canceled: true };
      }
    }
  }

  return saveMarkdownFileAs(tabId, content, currentFilePath);
}

/** 実行環境に応じてElectronまたはブラウザAPIでHTMLファイルを保存する */
export async function saveHtmlFile(
  content: string,
  suggestedName = 'document.html'
): Promise<FileSaveResult> {
  if (window.electronAPI?.saveHtmlFile) {
    return window.electronAPI.saveHtmlFile(content, suggestedName);
  }

  const targetName = suggestedName || 'document.html';
  const pickerWindow = window as unknown as PickerWindow;
  if (typeof pickerWindow.showSaveFilePicker !== 'function') {
    return downloadFallback(targetName, content, 'text/html;charset=utf-8');
  }

  try {
    const handle = await pickerWindow.showSaveFilePicker({
      suggestedName: targetName,
      types: HTML_PICKER_TYPES,
    });
    await writeToBrowserHandle(handle, content);
    return { canceled: false, filePath: handle.name };
  } catch (err) {
    if (isAbortError(err)) {
      return { canceled: true };
    }
    throw err;
  }
}

export type PdfExportResult =
  | { mode: 'electron'; canceled: boolean; filePath?: string }
  | { mode: 'print-dialog' };

/** Electron版ではPDFファイルを直接保存し、ブラウザ版等では印刷ダイアログ経由を案内する */
export async function savePdfFile(suggestedName = 'document.pdf'): Promise<PdfExportResult> {
  if (window.electronAPI?.savePdfFile) {
    const result = await window.electronAPI.savePdfFile(suggestedName);
    return {
      mode: 'electron',
      canceled: result.canceled,
      filePath: result.filePath,
    };
  }

  return { mode: 'print-dialog' };
}
