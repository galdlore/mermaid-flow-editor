import type { FileOpenResult, FileSaveResult } from '../types/editor';

interface BrowserFileWritable {
  write: (data: string) => Promise<void>;
  close: () => Promise<void>;
}

interface BrowserFileHandle {
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<BrowserFileWritable>;
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

let currentBrowserFileHandle: BrowserFileHandle | null = null;

function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name: unknown }).name === 'AbortError'
  );
}

async function writeToBrowserHandle(
  handle: BrowserFileHandle,
  content: string
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

function openWithInputFallback(): Promise<FileOpenResult> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.txt';

    let resolved = false;
    const finish = (result: FileOpenResult): void => {
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
      currentBrowserFileHandle = null;
      finish({ canceled: false, filePath: file.name, content });
    });

    input.addEventListener('cancel', () => {
      finish({ canceled: true });
    });

    input.click();
  });
}

function downloadFallback(fileName: string, content: string): FileSaveResult {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
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

/** 新規作成時にファイルハンドル保持状態とElectron側認可状態を初期化する */
export function resetBrowserFileHandle(): void {
  currentBrowserFileHandle = null;
  void window.electronAPI?.resetFileSession?.();
}

/** 実行環境に応じてElectronダイアログまたはブラウザAPIでファイルを開く */
export async function openMarkdownFile(): Promise<FileOpenResult> {
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
    currentBrowserFileHandle = handle;
    return { canceled: false, filePath: file.name, content };
  } catch (err) {
    if (isAbortError(err)) {
      return { canceled: true };
    }
    throw err;
  }
}

/** 実行環境に応じてElectronまたはブラウザAPIで別名保存を行う */
export async function saveMarkdownFileAs(
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
    currentBrowserFileHandle = handle;
    return { canceled: false, filePath: handle.name };
  } catch (err) {
    if (isAbortError(err)) {
      return { canceled: true };
    }
    throw err;
  }
}

/** 実行環境に応じてElectronまたは保持中のハンドルへ上書き保存を行う */
export async function saveMarkdownFile(
  currentFilePath: string | null,
  content: string
): Promise<FileSaveResult> {
  if (window.electronAPI) {
    return window.electronAPI.saveFile(currentFilePath, content);
  }

  if (currentBrowserFileHandle) {
    await writeToBrowserHandle(currentBrowserFileHandle, content);
    return { canceled: false, filePath: currentBrowserFileHandle.name };
  }

  return saveMarkdownFileAs(content, currentFilePath);
}
