export interface WysiwygEditorHandle {
  focus: () => void;
  applyHeading: (level: 1 | 2 | 3) => void;
  applyBold: () => void;
  applyItalic: () => void;
  applyStrike: () => void;
  applyLink: (placeholder: string) => void;
  getSelectedText: () => string;
  insertLink: (label: string, href: string) => void;
  applyBulletList: () => void;
  applyOrderedList: () => void;
  applyTaskList: () => void;
  applyQuote: () => void;
  applyCodeBlock: () => void;
  insertTable: (rows: number, cols: number) => void;
  insertMermaidBlock: (code: string) => void;
  insertText: (text: string) => void;
}

export interface WysiwygEditorProps {
  value: string;
  onChange: (nextMarkdown: string) => void;
  onEditMermaid: (blockIndex: number, code: string) => void;
  onOpenNewMermaid?: () => void;
  onOpenMarkdownLink?: (href: string) => void;
}

export type WysiwygMenuState =
  | { kind: 'insert'; blockPos: number; anchorTop: number; anchorLeft: number }
  | {
      kind: 'slash';
      query: string;
      from: number;
      to: number;
      anchorTop: number;
      anchorLeft: number;
    }
  | {
      kind: 'actions';
      blockPos: number;
      canMoveUp: boolean;
      canMoveDown: boolean;
      anchorTop: number;
      anchorLeft: number;
    };

export interface WysiwygEditorStrings {
  editLabel: string;
  editTitle: string;
  emptyError: string;
  renderErrorTitle: string;
  blockAddTitle: string;
  blockDragTitle: string;
}

export type WysiwygBlockAction = 'moveUp' | 'moveDown' | 'duplicate' | 'delete';
