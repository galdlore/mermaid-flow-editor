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
}

const electronAPI: ElectronBridgeAPI = {
  openFile: () => ipcRenderer.invoke('file:open') as Promise<FileOpenResult>,
  saveFile: (filePath: string | null, content: string) =>
    ipcRenderer.invoke('file:save', filePath, content) as Promise<FileSaveResult>,
  saveFileAs: (content: string) =>
    ipcRenderer.invoke('file:saveAs', content) as Promise<FileSaveResult>,
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
