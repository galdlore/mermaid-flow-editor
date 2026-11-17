import { contextBridge, ipcRenderer } from 'electron';

interface FileOpenResult {
  canceled: boolean;
  filePath?: string;
  content?: string;
}

interface FileSaveResult {
  canceled: boolean;
  filePath?: string;
}

interface ElectronBridgeAPI {
  openFile: () => Promise<FileOpenResult>;
  saveFile: (filePath: string | null, content: string) => Promise<FileSaveResult>;
  saveFileAs: (content: string) => Promise<FileSaveResult>;
  saveHtmlFile: (content: string, suggestedName?: string) => Promise<FileSaveResult>;
  savePdfFile: (suggestedName?: string) => Promise<FileSaveResult>;
  resetFileSession: () => Promise<void>;
}

const electronAPI: ElectronBridgeAPI = {
  openFile: () => ipcRenderer.invoke('file:open') as Promise<FileOpenResult>,
  saveFile: (filePath: string | null, content: string) =>
    ipcRenderer.invoke('file:save', filePath, content) as Promise<FileSaveResult>,
  saveFileAs: (content: string) =>
    ipcRenderer.invoke('file:saveAs', content) as Promise<FileSaveResult>,
  saveHtmlFile: (content: string, suggestedName?: string) =>
    ipcRenderer.invoke('file:saveHtml', content, suggestedName) as Promise<FileSaveResult>,
  savePdfFile: (suggestedName?: string) =>
    ipcRenderer.invoke('file:savePdf', suggestedName) as Promise<FileSaveResult>,
  resetFileSession: () => ipcRenderer.invoke('file:resetSession') as Promise<void>,
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
