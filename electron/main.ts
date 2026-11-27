import { app, BrowserWindow, dialog, ipcMain, Menu, shell, type FileFilter } from 'electron';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { extractMarkdownFilePathsFromArgv, SUPPORTED_MARKDOWN_EXTENSIONS } from './launchArgs';

interface ExternalFileOpenPayload {
  ok: boolean;
  filePath: string;
  content?: string;
  errorCode?: 'not-found' | 'too-large' | 'unsupported-ext' | 'read-error';
  error?: string;
}

let mainWindow: BrowserWindow | null = null;
const authorizedFilePaths = new Set<string>();
const pendingExternalFilePaths: string[] = [];
let rendererReady = false;

function normalizeAuthorizedPath(filePath: string): string {
  return path.resolve(filePath);
}

function normalizePathDedupeKey(filePath: string): string {
  return process.platform === 'win32' ? filePath.toLowerCase() : filePath;
}

function enqueueExternalFilePaths(filePaths: readonly string[]): void {
  const existingKeys = new Set(pendingExternalFilePaths.map(normalizePathDedupeKey));
  for (const rawPath of filePaths) {
    const resolved = normalizeAuthorizedPath(rawPath);
    const key = normalizePathDedupeKey(resolved);
    if (existingKeys.has(key)) {
      continue;
    }
    existingKeys.add(key);
    pendingExternalFilePaths.push(resolved);
  }
}

function focusMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  mainWindow.focus();
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
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#f3f4f6',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.platform !== 'darwin') {
    mainWindow.removeMenu();
  }

  let shown = false;
  const showWindow = (): void => {
    if (shown || !mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    shown = true;
    clearTimeout(fallbackShowTimer);
    mainWindow.show();
  };
  const fallbackShowTimer = setTimeout(showWindow, 3000);
  mainWindow.once('ready-to-show', showWindow);

  const hasInitialExternalFiles = pendingExternalFilePaths.length > 0;
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    const targetUrl = new URL(devUrl);
    if (hasInitialExternalFiles) {
      targetUrl.searchParams.set('launchFile', '1');
    }
    void mainWindow.loadURL(targetUrl.toString());
  } else {
    void mainWindow.loadFile(
      path.join(__dirname, '../dist/index.html'),
      hasInitialExternalFiles ? { query: { launchFile: '1' } } : undefined
    );
  }

  mainWindow.webContents.on('did-start-navigation', (_event, _url, isInPlace, isMainFrame) => {
    if (isMainFrame && !isInPlace) {
      rendererReady = false;
    }
  });

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
    clearTimeout(fallbackShowTimer);
    rendererReady = false;
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

const MAX_MARKDOWN_FILE_BYTES = 10 * 1024 * 1024;

async function readExternalMarkdownFile(rawPath: string): Promise<ExternalFileOpenPayload> {
  const resolvedPath = normalizeAuthorizedPath(rawPath);
  const ext = path.extname(resolvedPath).toLowerCase();
  if (!SUPPORTED_MARKDOWN_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      filePath: resolvedPath,
      errorCode: 'unsupported-ext',
      error: 'Only .md, .markdown, and .txt files can be opened.',
    };
  }

  try {
    const stats = await stat(resolvedPath);
    if (!stats.isFile()) {
      return {
        ok: false,
        filePath: resolvedPath,
        errorCode: 'not-found',
        error: 'Target is not a file.',
      };
    }
    if (stats.size > MAX_MARKDOWN_FILE_BYTES) {
      return {
        ok: false,
        filePath: resolvedPath,
        errorCode: 'too-large',
        error: 'File size exceeds 10MB limit.',
      };
    }

    const content = await readFile(resolvedPath, 'utf-8');
    authorizedFilePaths.add(resolvedPath);
    return { ok: true, filePath: resolvedPath, content };
  } catch (err) {
    const errCode = (err as NodeJS.ErrnoException | null)?.code;
    if (errCode === 'ENOENT' || errCode === 'ENOTDIR') {
      return {
        ok: false,
        filePath: resolvedPath,
        errorCode: 'not-found',
        error: 'File not found.',
      };
    }
    return {
      ok: false,
      filePath: resolvedPath,
      errorCode: 'read-error',
      error: err instanceof Error ? err.message : 'Failed to read file.',
    };
  }
}

async function dispatchExternalFilePaths(filePaths: readonly string[]): Promise<void> {
  if (filePaths.length === 0) {
    return;
  }
  if (mainWindow && !mainWindow.isDestroyed() && rendererReady) {
    for (const rawPath of filePaths) {
      const payload = await readExternalMarkdownFile(rawPath);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('file:openedExternally', payload);
      }
    }
    return;
  }
  enqueueExternalFilePaths(filePaths);
}

function parseSafeRelativeSegments(rawRelativeHref: string): string[] | null {
  const trimmed = rawRelativeHref.trim();
  if (!trimmed || trimmed.includes('\0')) {
    return null;
  }
  const hashIndex = trimmed.indexOf('#');
  const beforeHash = hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed;
  const queryIndex = beforeHash.indexOf('?');
  const cleanHref = (queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash).trim();

  if (
    !cleanHref ||
    cleanHref.startsWith('/') ||
    cleanHref.startsWith('\\') ||
    /^[a-zA-Z]:/.test(cleanHref) ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(cleanHref)
  ) {
    return null;
  }

  const decodedSegments: string[] = [];
  for (const rawSeg of cleanHref.split('/')) {
    if (!rawSeg) {
      continue;
    }
    let decoded: string;
    try {
      decoded = decodeURIComponent(rawSeg);
    } catch {
      return null;
    }
    if (
      !decoded ||
      decoded.includes('\0') ||
      decoded.includes('/') ||
      decoded.includes('\\') ||
      /^[a-zA-Z]:/.test(decoded)
    ) {
      return null;
    }
    decodedSegments.push(decoded);
  }

  return decodedSegments.length > 0 ? decodedSegments : null;
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

  ipcMain.handle(
    'file:openRelative',
    async (_event, rawBaseFilePath: unknown, rawRelativeHref: unknown) => {
      if (
        typeof rawBaseFilePath !== 'string' ||
        !rawBaseFilePath.trim() ||
        typeof rawRelativeHref !== 'string' ||
        !rawRelativeHref.trim()
      ) {
        return {
          ok: false,
          errorCode: 'invalid-path',
          error: 'Invalid path arguments.',
        };
      }

      const resolvedBase = normalizeAuthorizedPath(rawBaseFilePath);
      if (!authorizedFilePaths.has(resolvedBase)) {
        return {
          ok: false,
          errorCode: 'unauthorized',
          error: 'Base file is not authorized.',
        };
      }

      const segments = parseSafeRelativeSegments(rawRelativeHref);
      if (!segments) {
        return {
          ok: false,
          errorCode: 'invalid-path',
          error: 'Only relative paths are allowed.',
        };
      }

      const targetPath = normalizeAuthorizedPath(
        path.resolve(path.dirname(resolvedBase), ...segments)
      );
      const ext = path.extname(targetPath).toLowerCase();
      if (!SUPPORTED_MARKDOWN_EXTENSIONS.has(ext)) {
        return {
          ok: false,
          errorCode: 'unsupported-ext',
          error: 'Only .md, .markdown, and .txt files can be opened.',
        };
      }

      try {
        const stats = await stat(targetPath);
        if (!stats.isFile()) {
          return {
            ok: false,
            notFound: true,
            errorCode: 'not-found',
            error: 'Target is not a file.',
          };
        }
        if (stats.size > MAX_MARKDOWN_FILE_BYTES) {
          return {
            ok: false,
            errorCode: 'too-large',
            error: 'File size exceeds 10MB limit.',
          };
        }

        const content = await readFile(targetPath, 'utf-8');
        authorizedFilePaths.add(targetPath);
        return { ok: true, filePath: targetPath, content };
      } catch (err) {
        const errCode = (err as NodeJS.ErrnoException | null)?.code;
        if (errCode === 'ENOENT' || errCode === 'ENOTDIR') {
          return {
            ok: false,
            notFound: true,
            errorCode: 'not-found',
            error: 'Linked file not found.',
          };
        }
        return {
          ok: false,
          errorCode: 'read-error',
          error: err instanceof Error ? err.message : 'Failed to read linked file.',
        };
      }
    }
  );

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

  ipcMain.handle('file:consumePendingExternalFiles', async () => {
    rendererReady = true;
    const queued = pendingExternalFilePaths.splice(0, pendingExternalFilePaths.length);
    const results: ExternalFileOpenPayload[] = [];
    for (const filePath of queued) {
      results.push(await readExternalMarkdownFile(filePath));
    }
    return results;
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

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  enqueueExternalFilePaths(
    extractMarkdownFilePathsFromArgv(process.argv, {
      isPackaged: app.isPackaged,
      isDefaultApp: Boolean(process.defaultApp),
      workingDirectory: process.cwd(),
    })
  );

  app.on('second-instance', (_event, commandLine, workingDirectory) => {
    const filePaths = extractMarkdownFilePathsFromArgv(commandLine, {
      isPackaged: app.isPackaged,
      isDefaultApp: Boolean(process.defaultApp),
      workingDirectory,
    });
    if (!mainWindow && app.isReady()) {
      createWindow();
    }
    focusMainWindow();
    void dispatchExternalFilePaths(filePaths);
  });

  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    const filePaths = extractMarkdownFilePathsFromArgv(['app', filePath], {
      isPackaged: true,
    });
    if (app.isReady() && !mainWindow) {
      createWindow();
    }
    focusMainWindow();
    void dispatchExternalFilePaths(filePaths);
  });

  app.whenReady().then(() => {
    if (process.platform !== 'darwin') {
      Menu.setApplicationMenu(null);
    }
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
}
