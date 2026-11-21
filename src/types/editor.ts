export type MermaidDiagramType =
  | 'flowchart'
  | 'swimlane'
  | 'treeView'
  | 'kanban'
  | 'pie'
  | 'xychart'
  | 'architecture'
  | 'mindmap'
  | 'quadrantChart'
  | 'sequence'
  | 'class'
  | 'state'
  | 'er'
  | 'gantt'
  | 'c4'
  | 'gitGraph'
  | 'timeline'
  | 'block'
  | 'railroad'
  | 'ishikawa'
  | 'journey'
  | 'treemap'
  | 'venn'
  | 'wardley'
  | 'cynefin'
  | 'requirement'
  | 'packet'
  | 'eventmodeling'
  | 'sankey'
  | 'radar'
  | 'info';

export type * from '../diagrams/flowchart/types.ts';
export type * from '../diagrams/treeView/types.ts';
export type * from '../diagrams/gantt/types.ts';
export type * from '../diagrams/kanban/types.ts';
export type * from '../diagrams/pie/types.ts';
export type * from '../diagrams/xychart/types.ts';
export type * from '../diagrams/architecture/types.ts';
export type * from '../diagrams/mindmap/types.ts';
export type * from '../diagrams/quadrantChart/types.ts';
export type * from '../diagrams/sequence/types.ts';
export type * from '../diagrams/er/types.ts';
export type * from '../diagrams/class/types.ts';
export type * from '../diagrams/state/types.ts';
export type * from '../diagrams/c4/types.ts';
export type * from '../diagrams/gitGraph/types.ts';
export type * from '../diagrams/timeline/types.ts';
export type * from '../diagrams/block/types.ts';
export type * from '../diagrams/railroad/types.ts';
export type * from '../diagrams/ishikawa/types.ts';
export type * from '../diagrams/journey/types.ts';
export type * from '../diagrams/treemap/types.ts';
export type * from '../diagrams/venn/types.ts';
export type * from '../diagrams/wardley/types.ts';
export type * from '../diagrams/cynefin/types.ts';
export type * from '../diagrams/requirement/types.ts';
export type * from '../diagrams/packet/types.ts';
export type * from '../diagrams/eventmodeling/types.ts';
export type * from '../diagrams/sankey/types.ts';
export type * from '../diagrams/radar/types.ts';
export type * from '../diagrams/info/types.ts';

export interface FileOpenResult {
  canceled: boolean;
  filePath?: string;
  content?: string;
}

export interface RelativeFileOpenResult {
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

export interface FileSaveResult {
  canceled: boolean;
  filePath?: string;
}

export type RemoteRequestMethod =
  | 'GET'
  | 'PUT'
  | 'POST'
  | 'OPTIONS'
  | 'HEAD'
  | 'PROPFIND'
  | 'MKCOL';

export interface RemoteRequestPayload {
  url: string;
  method: RemoteRequestMethod;
  headers: Record<string, string>;
  body?: string;
  readResponseBody?: boolean;
}

export interface RemoteRequestIpcResult {
  ok: boolean;
  status: number;
  statusText: string;
  bodyText?: string;
  error?: string;
}

export interface ElectronAPI {
  openFile: () => Promise<FileOpenResult>;
  openRelativeFile?: (baseFilePath: string, relativeHref: string) => Promise<RelativeFileOpenResult>;
  saveFile: (filePath: string | null, content: string) => Promise<FileSaveResult>;
  saveFileAs: (content: string) => Promise<FileSaveResult>;
  saveHtmlFile?: (content: string, suggestedName?: string) => Promise<FileSaveResult>;
  savePdfFile?: (suggestedName?: string) => Promise<FileSaveResult>;
  resetFileSession?: () => Promise<void>;
  remoteRequest?: (payload: RemoteRequestPayload) => Promise<RemoteRequestIpcResult>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
