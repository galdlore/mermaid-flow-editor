import { app, BrowserWindow, dialog, ipcMain, type FileFilter } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

let mainWindow: BrowserWindow | null = null;

const MARKDOWN_FILTERS: FileFilter[] = [
  { name: 'Markdown', extensions: ['md', 'markdown'] },
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
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

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

  await writeFile(result.filePath, content, 'utf-8');
  return { canceled: false, filePath: result.filePath };
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

    const filePath = result.filePaths[0];
    const content = await readFile(filePath, 'utf-8');
    return { canceled: false, filePath, content };
  });

  ipcMain.handle('file:save', async (_event, filePath: string | null, content: string) => {
    if (!filePath) {
      return saveWithDialog(content);
    }

    await writeFile(filePath, content, 'utf-8');
    return { canceled: false, filePath };
  });

  ipcMain.handle('file:saveAs', async (_event, content: string) => {
    return saveWithDialog(content);
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
