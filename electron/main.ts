import { app, BrowserWindow, dialog, ipcMain, shell, type FileFilter } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

let mainWindow: BrowserWindow | null = null;
const authorizedFilePaths = new Set<string>();

function normalizeAuthorizedPath(filePath: string): string {
  return path.resolve(filePath);
}

function isSafeExternalUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

const MARKDOWN_FILTERS: FileFilter[] = [
  { name: 'Markdown', extensions: ['md', 'markdown'] },
  { name: 'すべてのファイル', extensions: ['*'] },
];

const HTML_FILTERS: FileFilter[] = [
  { name: 'HTML', extensions: ['html', 'htm'] },
  { name: 'すべてのファイル', extensions: ['*'] },
];

const PDF_FILTERS: FileFilter[] = [
  { name: 'PDF', extensions: ['pdf'] },
  { name: 'すべてのファイル', extensions: ['*'] },
];

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    title: 'Mermaid Markdown Editor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowedPrefix = devUrl || 'file://';
    if (!url.startsWith(allowedPrefix)) {
      event.preventDefault();
      if (isSafeExternalUrl(url)) {
        void shell.openExternal(url);
      }
    }
  });

  mainWindow.webContents.on('will-prevent-unload', (event) => {
    if (!mainWindow) {
      return;
    }

    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      buttons: ['保存せずに閉じる', 'キャンセル'],
      defaultId: 1,
      cancelId: 1,
      title: '確認',
      message: '未保存の変更があります。',
      detail: '保存せずにウィンドウを閉じると編集内容が失われます。よろしいですか？',
    });

    if (choice === 0) {
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function saveWithDialog(content: string): Promise<{ canceled: boolean; filePath?: string }> {
  const options = {
    title: '名前を付けてMarkdownを保存',
    defaultPath: 'document.md',
    filters: MARKDOWN_FILTERS,
  };

  const result = mainWindow
    ? await dialog.showSaveDialog(mainWindow, options)
    : await dialog.showSaveDialog(options);

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  const resolvedPath = normalizeAuthorizedPath(result.filePath);
  authorizedFilePaths.add(resolvedPath);
  await writeFile(resolvedPath, content, 'utf-8');
  return { canceled: false, filePath: resolvedPath };
}

function resolveSafeDefaultFileName(suggestedName: unknown, fallbackName: string): string {
  if (typeof suggestedName !== 'string') {
    return fallbackName;
  }
  const baseName = path.basename(suggestedName).trim();
  return baseName || fallbackName;
}

async function saveHtmlWithDialog(
  content: string,
  suggestedName?: string
): Promise<{ canceled: boolean; filePath?: string }> {
  const options = {
    title: 'HTMLファイルとして保存',
    defaultPath: resolveSafeDefaultFileName(suggestedName, 'document.html'),
    filters: HTML_FILTERS,
  };

  const result = mainWindow
    ? await dialog.showSaveDialog(mainWindow, options)
    : await dialog.showSaveDialog(options);

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  const resolvedPath = normalizeAuthorizedPath(result.filePath);
  await writeFile(resolvedPath, content, 'utf-8');
  return { canceled: false, filePath: resolvedPath };
}

async function savePdfWithDialog(
  suggestedName?: string
): Promise<{ canceled: boolean; filePath?: string }> {
  if (!mainWindow) {
    throw new Error('Main window is not available for PDF export.');
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'PDFファイルとして保存',
    defaultPath: resolveSafeDefaultFileName(suggestedName, 'document.pdf'),
    filters: PDF_FILTERS,
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  const pdfBuffer = await mainWindow.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    preferCSSPageSize: true,
  });

  const resolvedPath = normalizeAuthorizedPath(result.filePath);
  await writeFile(resolvedPath, pdfBuffer);
  return { canceled: false, filePath: resolvedPath };
}

function registerIpcHandlers(): void {
  ipcMain.handle('file:open', async () => {
    const options = {
      title: 'Markdownファイルを開く',
      properties: ['openFile'] as Array<'openFile'>,
      filters: MARKDOWN_FILTERS,
    };

    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const resolvedPath = normalizeAuthorizedPath(result.filePaths[0]);
    const content = await readFile(resolvedPath, 'utf-8');
    authorizedFilePaths.add(resolvedPath);
    return { canceled: false, filePath: resolvedPath, content };
  });

  ipcMain.handle('file:save', async (_event, filePath: unknown, content: unknown) => {
    if (typeof content !== 'string') {
      throw new Error('Invalid file content.');
    }

    if (typeof filePath !== 'string' || !filePath.trim()) {
      return saveWithDialog(content);
    }

    const resolvedPath = normalizeAuthorizedPath(filePath);
    if (!authorizedFilePaths.has(resolvedPath)) {
      return saveWithDialog(content);
    }

    await writeFile(resolvedPath, content, 'utf-8');
    return { canceled: false, filePath: resolvedPath };
  });

  ipcMain.handle('file:saveAs', async (_event, content: unknown) => {
    if (typeof content !== 'string') {
      throw new Error('Invalid file content.');
    }
    return saveWithDialog(content);
  });

  ipcMain.handle(
    'file:saveHtml',
    async (_event, content: unknown, suggestedName: unknown) => {
      if (typeof content !== 'string') {
        throw new Error('Invalid HTML content.');
      }
      return saveHtmlWithDialog(
        content,
        typeof suggestedName === 'string' ? suggestedName : undefined
      );
    }
  );

  ipcMain.handle('file:savePdf', async (_event, suggestedName: unknown) => {
    return savePdfWithDialog(
      typeof suggestedName === 'string' ? suggestedName : undefined
    );
  });

  ipcMain.handle('file:resetSession', () => {
    authorizedFilePaths.clear();
  });

  ipcMain.handle('remote:request', async (_event, rawPayload: unknown) => {
    if (typeof rawPayload !== 'object' || rawPayload === null) {
      return { ok: false, status: 0, statusText: 'Bad Request', error: 'Invalid request payload.' };
    }

    const payload = rawPayload as Record<string, unknown>;
    const rawUrl = typeof payload.url === 'string' ? payload.url.trim() : '';
    if (!isSafeExternalUrl(rawUrl)) {
      return {
        ok: false,
        status: 0,
        statusText: 'Bad Request',
        error: 'Only http:// and https:// URLs are allowed.',
      };
    }

    const allowedMethods = new Set(['GET', 'PUT', 'POST', 'OPTIONS', 'HEAD', 'PROPFIND', 'MKCOL']);
    const method = typeof payload.method === 'string' ? payload.method.toUpperCase() : '';
    if (!allowedMethods.has(method)) {
      return { ok: false, status: 0, statusText: 'Bad Request', error: 'Unsupported HTTP method.' };
    }

    const cleanHeaders: Record<string, string> = {};
    if (typeof payload.headers === 'object' && payload.headers !== null) {
      for (const [key, val] of Object.entries(payload.headers as Record<string, unknown>)) {
        if (typeof val === 'string') {
          cleanHeaders[key] = val;
        }
      }
    }

    const body = typeof payload.body === 'string' ? payload.body : undefined;
    const readResponseBody = payload.readResponseBody === true;
    const hasRequestBody = method === 'PUT' || method === 'POST' || method === 'PROPFIND';
    const maxResponseBytes = 10 * 1024 * 1024;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch(rawUrl, {
        method,
        headers: cleanHeaders,
        body: hasRequestBody ? body : undefined,
        signal: controller.signal,
      });

      let bodyText: string | undefined;
      if (readResponseBody && response.ok) {
        const contentLength = Number(response.headers.get('content-length') ?? '0');
        if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) {
          return {
            ok: false,
            status: 413,
            statusText: 'Payload Too Large',
            error: 'File size exceeds 10MB limit.',
          };
        }
        const buf = await response.arrayBuffer();
        if (buf.byteLength > maxResponseBytes) {
          return {
            ok: false,
            status: 413,
            statusText: 'Payload Too Large',
            error: 'File size exceeds 10MB limit.',
          };
        }
        bodyText = new TextDecoder('utf-8').decode(buf);
      }

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        bodyText,
        error: response.ok ? undefined : `HTTP ${response.status} ${response.statusText}`.trim(),
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        statusText: 'Network Error',
        error: err instanceof Error ? err.message : 'Network error',
      };
    } finally {
      clearTimeout(timer);
    }
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
