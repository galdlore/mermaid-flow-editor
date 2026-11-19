import { contextBridge, ipcRenderer } from 'electron';

interface FileOpenResult {
  canceled: boolean;
  filePath?: string;
  content?: string;
}

interface RelativeFileOpenResult {
  ok: boolean;
  filePath?: string;
  content?: string;
  notFound?: boolean;
  errorCode?:
    | 'invalid-path'
    | 'unauthorized'
    | 'unsupported-ext'
    | 'too-large'
    | 'not-found'
    | 'read-error';
  error?: string;
}

interface FileSaveResult {
  canceled: boolean;
  filePath?: string;
}

interface RemoteRequestPayload {
  url: string;
  method: 'GET' | 'PUT' | 'POST' | 'OPTIONS' | 'HEAD' | 'PROPFIND' | 'MKCOL';
  headers: Record<string, string>;
  body?: string;
  readResponseBody?: boolean;
}

interface RemoteRequestIpcResult {
  ok: boolean;
  status: number;
  statusText: string;
  bodyText?: string;
  error?: string;
}

interface ElectronBridgeAPI {
  openFile: () => Promise<FileOpenResult>;
  openRelativeFile: (baseFilePath: string, relativeHref: string) => Promise<RelativeFileOpenResult>;
  saveFile: (filePath: string | null, content: string) => Promise<FileSaveResult>;
  saveFileAs: (content: string) => Promise<FileSaveResult>;
  saveHtmlFile: (content: string, suggestedName?: string) => Promise<FileSaveResult>;
  savePdfFile: (suggestedName?: string) => Promise<FileSaveResult>;
  resetFileSession: () => Promise<void>;
  remoteRequest: (payload: RemoteRequestPayload) => Promise<RemoteRequestIpcResult>;
}

const electronAPI: ElectronBridgeAPI = {
  openFile: () => ipcRenderer.invoke('file:open') as Promise<FileOpenResult>,
  openRelativeFile: (baseFilePath: string, relativeHref: string) =>
    ipcRenderer.invoke('file:openRelative', baseFilePath, relativeHref) as Promise<RelativeFileOpenResult>,
  saveFile: (filePath: string | null, content: string) =>
    ipcRenderer.invoke('file:save', filePath, content) as Promise<FileSaveResult>,
  saveFileAs: (content: string) =>
    ipcRenderer.invoke('file:saveAs', content) as Promise<FileSaveResult>,
  saveHtmlFile: (content: string, suggestedName?: string) =>
    ipcRenderer.invoke('file:saveHtml', content, suggestedName) as Promise<FileSaveResult>,
  savePdfFile: (suggestedName?: string) =>
    ipcRenderer.invoke('file:savePdf', suggestedName) as Promise<FileSaveResult>,
  resetFileSession: () => ipcRenderer.invoke('file:resetSession') as Promise<void>,
  remoteRequest: (payload: RemoteRequestPayload) =>
    ipcRenderer.invoke('remote:request', payload) as Promise<RemoteRequestIpcResult>,
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
