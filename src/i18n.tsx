import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  EdgeLabelStyle,
  EdgeLineType,
  MermaidDirection,
  NodeShape,
} from './types/editor';

export type Language = 'ja' | 'en';

export const LANG_STORAGE_KEY = 'mermaid-flow-editor:lang';

export const INITIAL_MARKDOWN_JA = `# Mermaid Markdown Editor

上部のツールバーから見出しや表、Mermaid図をGUI操作で挿入できます。

## 基本的な使い方

1. 左側の編集エリアに文章を書くか、ツールバーのボタンを押します。
2. 「Mermaid図をGUI作成」ボタンを押すと、図形と接続先をGUIで組み立てられます。
3. 右側のプレビュー上にある「この図をGUIで編集」ボタンから、既存の図を何度でも編集し直せます。

## サンプルフローチャート

\`\`\`mermaid
flowchart TD
  node_1(["開始"])
  style node_1 fill:#eff6ff,stroke:#475569,color:#0f172a
  node_2{"条件を確認"}
  node_3["完了処理"]
  style node_3 fill:#f0fdf4,stroke:#475569,color:#0f172a
  node_1 -->|"入力あり"| node_2
  node_2 -->|"OK"| node_3
%% @gui-state: {"direction":"TD","nodes":[{"id":"node_1","label":"開始","shape":"stadium","color":"#eff6ff","position":{"x":180,"y":40}},{"id":"node_2","label":"条件を確認","shape":"diamond","color":"#ffffff","position":{"x":185,"y":155}},{"id":"node_3","label":"完了処理","shape":"rect","color":"#f0fdf4","position":{"x":180,"y":310}}],"edges":[{"id":"edge_1","source":"node_1","target":"node_2","label":"入力あり","lineType":"arrow"},{"id":"edge_2","source":"node_2","target":"node_3","label":"OK","lineType":"arrow"}]}
\`\`\`
`;

export const INITIAL_MARKDOWN_EN = `# Mermaid Markdown Editor

Use the toolbar above to insert headings, tables, and Mermaid diagrams visually.

## Basic Usage

1. Write Markdown in the left editor pane or click the formatting buttons in the toolbar.
2. Click "Create Mermaid Diagram" to build shapes and connections in the visual GUI builder.
3. Click "Edit Diagram in GUI" on any diagram in the right preview pane to edit it again anytime.

## Sample Flowchart

\`\`\`mermaid
flowchart TD
  node_1(["Start"])
  style node_1 fill:#eff6ff,stroke:#475569,color:#0f172a
  node_2{"Check condition"}
  node_3["Complete"]
  style node_3 fill:#f0fdf4,stroke:#475569,color:#0f172a
  node_1 -->|"Has input"| node_2
  node_2 -->|"OK"| node_3
%% @gui-state: {"direction":"TD","nodes":[{"id":"node_1","label":"Start","shape":"stadium","color":"#eff6ff","position":{"x":180,"y":40}},{"id":"node_2","label":"Check condition","shape":"diamond","color":"#ffffff","position":{"x":185,"y":155}},{"id":"node_3","label":"Complete","shape":"rect","color":"#f0fdf4","position":{"x":180,"y":310}}],"edges":[{"id":"edge_1","source":"node_1","target":"node_2","label":"Has input","lineType":"arrow"},{"id":"edge_2","source":"node_2","target":"node_3","label":"OK","lineType":"arrow"}]}
\`\`\`
`;

export function getInitialMarkdownByLang(lang: Language): string {
  return lang === 'ja' ? INITIAL_MARKDOWN_JA : INITIAL_MARKDOWN_EN;
}

export function detectInitialLanguage(): Language {
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
      if (saved === 'ja' || saved === 'en') {
        return saved;
      }
    } catch {
      // ストレージ参照不可時はブラウザ言語から判定する
    }
  }

  if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') {
    return navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en';
  }

  return 'en';
}

interface TranslationCatalog {
  app: {
    untitledFileName: string;
    confirmDiscard: (actionLabel: string) => string;
    actionNew: string;
    actionOpen: string;
    statusNewCreated: string;
    statusOpened: (fileName: string) => string;
    statusOpenError: string;
    statusSaved: (fileName: string) => string;
    statusSaveAs: (fileName: string) => string;
    statusSaveError: string;
    closeBanner: string;
  };
  toolbar: {
    newTitle: string;
    newLabel: string;
    openTitle: string;
    openLabel: string;
    saveTitle: string;
    saveLabel: string;
    saveAsTitle: string;
    saveAsLabel: string;
    h1Title: string;
    h2Title: string;
    h3Title: string;
    boldTitle: string;
    boldPlaceholder: string;
    italicTitle: string;
    italicPlaceholder: string;
    strikeTitle: string;
    strikePlaceholder: string;
    linkTitle: string;
    linkPlaceholder: string;
    bulletListTitle: string;
    orderedListTitle: string;
    taskListTitle: string;
    quoteTitle: string;
    codeBlockTitle: string;
    codeBlockSnippet: string;
    tableButtonTitle: string;
    tableButtonLabel: string;
    tablePopoverTitle: string;
    tableRows: string;
    tableCols: string;
    tableClose: string;
    tableInsert: string;
    tableColHeader: (index: number) => string;
    tableBodyCell: string;
    mermaidButtonTitle: string;
    mermaidButtonLabel: string;
    unsavedBadge: string;
    langButtonLabel: string;
    langButtonTitle: string;
  };
  editor: {
    emptyMermaidError: string;
    editDiagramTitle: string;
    editDiagramLabel: string;
    renderErrorTitle: string;
    editorPaneHeader: string;
    editorPlaceholder: string;
    previewPaneHeader: string;
  };
  modal: {
    ariaLabel: string;
    title: string;
    subtitle: string;
    cancel: string;
    apply: string;
    tabPreview: string;
    tabCode: string;
    emptyPreviewHint: string;
    previewErrorTitle: string;
  };
  inspector: {
    directionHeading: string;
    directions: Record<MermaidDirection, string>;
    nodesHeading: string;
    addNodeBtn: string;
    defaultNewNodeLabel: (num: number) => string;
    targetNodeLabel: string;
    selectNodePlaceholder: string;
    nodeLabelField: string;
    nodeLabelPlaceholder: string;
    nodeShapeField: string;
    shapes: Record<NodeShape, { label: string; meaning: string; syntax: string }>;
    nodeColorField: string;
    nodeStrokeColorField: string;
    strokeColors: {
      default: string;
      slate: string;
      blue: string;
      green: string;
      amber: string;
      red: string;
      purple: string;
    };
    nodeSubgraphField: string;
    noSubgraphOption: string;
    nodeClassField: string;
    noClassOption: string;
    nodeLinkUrlField: string;
    nodeLinkUrlPlaceholder: string;
    nodeLinkTooltipField: string;
    nodeLinkTooltipPlaceholder: string;
    colors: {
      white: string;
      blue: string;
      green: string;
      yellow: string;
      red: string;
      purple: string;
    };
    deleteNodeBtn: string;
    selectNodeHint: string;
    edgesHeading: string;
    sourceLabel: string;
    targetLabel: string;
    lineTypeLabel: string;
    lineTypes: Record<EdgeLineType, string>;
    edgeLengthLabel: string;
    edgeLengths: {
      standard: string;
      long1: string;
      long2: string;
      long3: string;
    };
    edgeLabelStyleLabel: string;
    edgeLabelStyles: Record<EdgeLabelStyle, string>;
    edgeStrokeColorField: string;
    edgeLabelField: string;
    edgeLabelPlaceholder: string;
    addEdgeBtn: string;
    noEdgesHint: string;
    edgeItemLabelPlaceholder: string;
    deleteEdgeTitle: string;
    subgraphsHeading: string;
    subgraphTitleField: string;
    subgraphTitlePlaceholder: string;
    subgraphDirectionField: string;
    subgraphDirectionInherit: string;
    addSubgraphBtn: string;
    defaultSubgraphTitle: (num: number) => string;
    noSubgraphsHint: string;
    deleteSubgraphTitle: string;
    classDefsHeading: string;
    classNameField: string;
    classNamePlaceholder: string;
    classFillField: string;
    classStrokeField: string;
    addClassDefBtn: string;
    noClassDefsHint: string;
    deleteClassDefTitle: string;
    commentsHeading: string;
    commentsField: string;
    commentsPlaceholder: string;
    safeguard: {
      syntaxErrorChars: (chars: string[]) => string;
      urlErrorChars: (chars: string[]) => string;
      classNameErrorChars: (chars: string[]) => string;
    };
  };
}

function formatCharList(chars: string[], lang: Language): string {
  return chars
    .map((ch) => {
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        return lang === 'ja' ? '「空白」' : '"Space"';
      }
      return lang === 'ja' ? `「${ch}」` : `"${ch}"`;
    })
    .join(lang === 'ja' ? '' : ' ');
}

const translations: Record<Language, TranslationCatalog> = {
  ja: {
    app: {
      untitledFileName: '無題.md',
      confirmDiscard: (actionLabel) =>
        `未保存の変更があります。内容を破棄して${actionLabel}を続けますか？`,
      actionNew: '新規作成',
      actionOpen: 'ファイルを開く操作',
      statusNewCreated: '新しいドキュメントを作成しました。',
      statusOpened: (fileName) => `ファイルを開きました: ${fileName}`,
      statusOpenError: 'ファイルの読み込みに失敗しました。',
      statusSaved: (fileName) => `保存しました: ${fileName}`,
      statusSaveAs: (fileName) => `名前を付けて保存しました: ${fileName}`,
      statusSaveError: 'ファイルの保存に失敗しました。',
      closeBanner: '閉じる',
    },
    toolbar: {
      newTitle: '新規作成',
      newLabel: '新規',
      openTitle: 'ファイルを開く (Ctrl+O)',
      openLabel: '開く',
      saveTitle: '上書き保存 (Ctrl+S)',
      saveLabel: '保存',
      saveAsTitle: '名前を付けて保存 (Ctrl+Shift+S)',
      saveAsLabel: '別名保存',
      h1Title: '見出し1 (H1)',
      h2Title: '見出し2 (H2)',
      h3Title: '見出し3 (H3)',
      boldTitle: '太字',
      boldPlaceholder: '太字テキスト',
      italicTitle: '斜体',
      italicPlaceholder: '斜体テキスト',
      strikeTitle: '打ち消し線',
      strikePlaceholder: '打ち消しテキスト',
      linkTitle: 'リンク挿入',
      linkPlaceholder: 'リンク名',
      bulletListTitle: '箇条書きリスト',
      orderedListTitle: '番号付きリスト',
      taskListTitle: 'タスクリスト',
      quoteTitle: '引用',
      codeBlockTitle: 'コードブロック',
      codeBlockSnippet: '\n```\nここにコードを入力\n```\n',
      tableButtonTitle: '表をGUIで作成して挿入',
      tableButtonLabel: '表を挿入',
      tablePopoverTitle: '表の挿入設定',
      tableRows: '行数',
      tableCols: '列数',
      tableClose: '閉じる',
      tableInsert: '挿入',
      tableColHeader: (index) => `列${index}`,
      tableBodyCell: '内容',
      mermaidButtonTitle: 'Mermaid図をGUIで新規作成',
      mermaidButtonLabel: 'Mermaid図をGUI作成',
      unsavedBadge: '未保存',
      langButtonLabel: 'JA',
      langButtonTitle: '表示言語を英語に切り替え (Switch to English)',
    },
    editor: {
      emptyMermaidError: 'Mermaidコードが空です。',
      editDiagramTitle: 'この図をGUIで編集',
      editDiagramLabel: 'この図をGUIで編集',
      renderErrorTitle: '図の描画エラー',
      editorPaneHeader: 'Markdown編集',
      editorPlaceholder:
        'ここにMarkdownを入力するか、上部のボタンから要素を挿入してください。',
      previewPaneHeader: 'リアルタイムプレビュー',
    },
    modal: {
      ariaLabel: 'Mermaid GUIエディタ',
      title: 'Mermaid図 GUIエディタ',
      subtitle: 'キャンバスのドラッグ接続と右側プルダウンの両方で編集できます',
      cancel: 'キャンセル',
      apply: 'Markdownに反映',
      tabPreview: 'Mermaid描画プレビュー',
      tabCode: '生成されたMermaidコード',
      emptyPreviewHint: '右側のパネルから「要素を追加」を押すと図が表示されます。',
      previewErrorTitle: 'プレビュー描画エラー',
    },
    inspector: {
      directionHeading: '図の向き設定',
      directions: {
        TD: '上から下 (TD)',
        LR: '左から右 (LR)',
        BT: '下から上 (BT)',
        RL: '右から左 (RL)',
      },
      nodesHeading: '要素の追加と編集',
      addNodeBtn: '要素を追加',
      defaultNewNodeLabel: (num) => `要素 ${num}`,
      targetNodeLabel: '編集対象の要素',
      selectNodePlaceholder: '要素を選択してください',
      nodeLabelField: 'ラベル名',
      nodeLabelPlaceholder: '要素のテキスト',
      nodeShapeField: '図形の形状',
      shapes: {
        rect: { label: '四角', meaning: '処理', syntax: 'A[文字]' },
        round: { label: '角丸', meaning: '柔らかい処理', syntax: 'A(文字)' },
        stadium: { label: 'スタジアム', meaning: '開始・終了', syntax: 'A([文字])' },
        subroutine: { label: 'サブルーチン', meaning: '別の処理を呼ぶ', syntax: 'A[[文字]]' },
        cylinder: { label: '円柱', meaning: 'データベース', syntax: 'A[(文字)]' },
        circle: { label: '円', meaning: '接続点', syntax: 'A((文字))' },
        asymmetric: { label: '旗', meaning: '注記', syntax: 'A>文字]' },
        diamond: { label: 'ひし形', meaning: '分岐（条件）', syntax: 'A{文字}' },
        hexagon: { label: '六角形', meaning: '準備', syntax: 'A{{文字}}' },
        parallelogram: { label: '平行四辺形', meaning: '入出力', syntax: 'A[/文字/]' },
        parallelogram_alt: { label: '逆平行四辺形', meaning: '入出力', syntax: 'A[\\文字\\]' },
        trapezoid: { label: '台形', meaning: '手作業', syntax: 'A[/文字\\]' },
        trapezoid_alt: { label: '逆台形', meaning: '手作業', syntax: 'A[\\文字/]' },
        double_circle: { label: '二重円', meaning: '終了', syntax: 'A(((文字)))' },
        doc: { label: '書類', meaning: '帳票', syntax: 'A@{ shape: doc }' },
        cyl_modern: { label: '円柱（新記法）', meaning: 'データベース', syntax: 'A@{ shape: cyl }' },
      },
      nodeColorField: '背景色',
      nodeStrokeColorField: '枠線色 (style)',
      strokeColors: {
        default: '標準',
        slate: '濃いグレー',
        blue: '青',
        green: '緑',
        amber: 'オレンジ',
        red: '赤',
        purple: '紫',
      },
      nodeSubgraphField: '所属グループ (subgraph)',
      noSubgraphOption: 'なし（ルート）',
      nodeClassField: '適用スタイルクラス (class)',
      noClassOption: 'なし',
      nodeLinkUrlField: 'クリック先URL (click)',
      nodeLinkUrlPlaceholder: 'https://example.com',
      nodeLinkTooltipField: 'リンク説明（ツールチップ）',
      nodeLinkTooltipPlaceholder: '任意の説明',
      colors: {
        white: '白',
        blue: '青',
        green: '緑',
        yellow: '黄',
        red: '赤',
        purple: '紫',
      },
      deleteNodeBtn: 'この要素を削除',
      selectNodeHint:
        'キャンバス上の図形をクリックするか、上のプルダウンから編集する要素を選んでください。',
      edgesHeading: '接続先のGUI設定',
      sourceLabel: '接続元',
      targetLabel: '接続先',
      lineTypeLabel: '線の種類',
      lineTypes: {
        arrow: '矢印 (-->)',
        line: '線のみ (---)',
        dotted: '点線矢印 (-.->)',
        thick: '太い矢印 (==>)',
        circle: '先端が丸 (--o)',
        cross: '先端がバツ (--x)',
        bidirectional: '双方向 (<-->)',
        invisible: '見えない線 (~~~)',
      },
      edgeLengthLabel: '矢印の長さ',
      edgeLengths: {
        standard: '標準',
        long1: '長め (+1)',
        long2: 'より長く (+2)',
        long3: '最長 (+3)',
      },
      edgeLabelStyleLabel: 'ラベル記法',
      edgeLabelStyles: {
        pipe: '標準 (-->|文字|)',
        inline: 'インライン (-- 文字 -->)',
      },
      edgeStrokeColorField: '線の色 (linkStyle)',
      edgeLabelField: '接続ラベル',
      edgeLabelPlaceholder: '任意 (例: はい)',
      addEdgeBtn: '接続を追加',
      noEdgesHint: '登録されている接続線はありません。',
      edgeItemLabelPlaceholder: 'ラベルなし',
      deleteEdgeTitle: 'この接続を削除',
      subgraphsHeading: 'グループ化 (subgraph)',
      subgraphTitleField: 'グループ名',
      subgraphTitlePlaceholder: '例: 前処理グループ',
      subgraphDirectionField: 'グループ内の向き',
      subgraphDirectionInherit: '図全体と同じ',
      addSubgraphBtn: 'グループを追加',
      defaultSubgraphTitle: (num) => `グループ ${num}`,
      noSubgraphsHint: '作成されたサブグラフはありません。',
      deleteSubgraphTitle: 'このグループを削除',
      classDefsHeading: 'スタイル定義 (classDef)',
      classNameField: 'クラス名',
      classNamePlaceholder: '例: highlight',
      classFillField: '塗り色',
      classStrokeField: '枠線色',
      addClassDefBtn: 'クラスを追加',
      noClassDefsHint: '定義されたスタイルクラスはありません。',
      deleteClassDefTitle: 'このクラスを削除',
      commentsHeading: 'コメントメモ (%%)',
      commentsField: '1行につき1つのコメントを出力します',
      commentsPlaceholder: '例: ここに図の補足メモを書けます',
      safeguard: {
        syntaxErrorChars: (chars) =>
          `${formatCharList(chars, 'ja')}の文字は構文エラーになるため使えません（全角の（）などは入力できます）`,
        urlErrorChars: (chars) =>
          `${formatCharList(chars, 'ja')}の文字や空白はURL欄では使えません`,
        classNameErrorChars: (chars) =>
          `${formatCharList(chars, 'ja')}はクラス名に使えません（半角英数字・_・- のみ入力できます）`,
      },
    },
  },
  en: {
    app: {
      untitledFileName: 'Untitled.md',
      confirmDiscard: (actionLabel) =>
        `You have unsaved changes. Discard them and continue to ${actionLabel}?`,
      actionNew: 'create a new document',
      actionOpen: 'open a file',
      statusNewCreated: 'Created a new document.',
      statusOpened: (fileName) => `Opened file: ${fileName}`,
      statusOpenError: 'Failed to open the file.',
      statusSaved: (fileName) => `Saved: ${fileName}`,
      statusSaveAs: (fileName) => `Saved as: ${fileName}`,
      statusSaveError: 'Failed to save the file.',
      closeBanner: 'Close',
    },
    toolbar: {
      newTitle: 'New Document',
      newLabel: 'New',
      openTitle: 'Open File (Ctrl+O)',
      openLabel: 'Open',
      saveTitle: 'Save (Ctrl+S)',
      saveLabel: 'Save',
      saveAsTitle: 'Save As (Ctrl+Shift+S)',
      saveAsLabel: 'Save As',
      h1Title: 'Heading 1 (H1)',
      h2Title: 'Heading 2 (H2)',
      h3Title: 'Heading 3 (H3)',
      boldTitle: 'Bold',
      boldPlaceholder: 'bold text',
      italicTitle: 'Italic',
      italicPlaceholder: 'italic text',
      strikeTitle: 'Strikethrough',
      strikePlaceholder: 'strikethrough text',
      linkTitle: 'Insert Link',
      linkPlaceholder: 'link text',
      bulletListTitle: 'Bulleted List',
      orderedListTitle: 'Numbered List',
      taskListTitle: 'Task List',
      quoteTitle: 'Blockquote',
      codeBlockTitle: 'Code Block',
      codeBlockSnippet: '\n```\nEnter code here\n```\n',
      tableButtonTitle: 'Create and insert a Markdown table',
      tableButtonLabel: 'Insert Table',
      tablePopoverTitle: 'Table Settings',
      tableRows: 'Rows',
      tableCols: 'Columns',
      tableClose: 'Close',
      tableInsert: 'Insert',
      tableColHeader: (index) => `Col ${index}`,
      tableBodyCell: 'Value',
      mermaidButtonTitle: 'Create a new Mermaid diagram in GUI',
      mermaidButtonLabel: 'Create Mermaid Diagram',
      unsavedBadge: 'Unsaved',
      langButtonLabel: 'EN',
      langButtonTitle: 'Switch language to Japanese (日本語に切り替え)',
    },
    editor: {
      emptyMermaidError: 'Mermaid code is empty.',
      editDiagramTitle: 'Edit this diagram in GUI',
      editDiagramLabel: 'Edit Diagram in GUI',
      renderErrorTitle: 'Diagram Render Error',
      editorPaneHeader: 'Markdown Editor',
      editorPlaceholder:
        'Type Markdown here, or use the toolbar buttons above to insert elements.',
      previewPaneHeader: 'Live Preview',
    },
    modal: {
      ariaLabel: 'Mermaid GUI Editor',
      title: 'Mermaid Diagram GUI Editor',
      subtitle: 'Edit by dragging connections on the canvas or using the right panel',
      cancel: 'Cancel',
      apply: 'Apply to Markdown',
      tabPreview: 'Mermaid Preview',
      tabCode: 'Generated Mermaid Code',
      emptyPreviewHint:
        'Click "Add Node" in the right panel to preview your diagram.',
      previewErrorTitle: 'Preview Render Error',
    },
    inspector: {
      directionHeading: 'Diagram Direction',
      directions: {
        TD: 'Top to Bottom (TD)',
        LR: 'Left to Right (LR)',
        BT: 'Bottom to Top (BT)',
        RL: 'Right to Left (RL)',
      },
      nodesHeading: 'Nodes',
      addNodeBtn: 'Add Node',
      defaultNewNodeLabel: (num) => `Node ${num}`,
      targetNodeLabel: 'Target Node',
      selectNodePlaceholder: 'Select a node',
      nodeLabelField: 'Label',
      nodeLabelPlaceholder: 'Node text',
      nodeShapeField: 'Shape',
      shapes: {
        rect: { label: 'Rectangle', meaning: 'Process', syntax: 'A[text]' },
        round: { label: 'Rounded', meaning: 'Soft Process', syntax: 'A(text)' },
        stadium: { label: 'Stadium', meaning: 'Start / End', syntax: 'A([text])' },
        subroutine: { label: 'Subroutine', meaning: 'Sub-process', syntax: 'A[[text]]' },
        cylinder: { label: 'Cylinder', meaning: 'Database', syntax: 'A[(text)]' },
        circle: { label: 'Circle', meaning: 'Connector', syntax: 'A((text))' },
        asymmetric: { label: 'Flag', meaning: 'Note', syntax: 'A>text]' },
        diamond: { label: 'Diamond', meaning: 'Decision', syntax: 'A{text}' },
        hexagon: { label: 'Hexagon', meaning: 'Preparation', syntax: 'A{{text}}' },
        parallelogram: { label: 'Parallelogram', meaning: 'Input / Output', syntax: 'A[/text/]' },
        parallelogram_alt: { label: 'Parallelogram Alt', meaning: 'Input / Output', syntax: 'A[\\text\\]' },
        trapezoid: { label: 'Trapezoid', meaning: 'Manual', syntax: 'A[/text\\]' },
        trapezoid_alt: { label: 'Inv. Trapezoid', meaning: 'Manual', syntax: 'A[\\text/]' },
        double_circle: { label: 'Double Circle', meaning: 'End', syntax: 'A(((text)))' },
        doc: { label: 'Document', meaning: 'Document', syntax: 'A@{ shape: doc }' },
        cyl_modern: { label: 'Cylinder v11', meaning: 'Database', syntax: 'A@{ shape: cyl }' },
      },
      nodeColorField: 'Background Color',
      nodeStrokeColorField: 'Border Color (style)',
      strokeColors: {
        default: 'Default',
        slate: 'Slate',
        blue: 'Blue',
        green: 'Green',
        amber: 'Amber',
        red: 'Red',
        purple: 'Purple',
      },
      nodeSubgraphField: 'Subgraph Group',
      noSubgraphOption: 'None (Root)',
      nodeClassField: 'Style Class (class)',
      noClassOption: 'None',
      nodeLinkUrlField: 'Click Link URL (click)',
      nodeLinkUrlPlaceholder: 'https://example.com',
      nodeLinkTooltipField: 'Link Tooltip',
      nodeLinkTooltipPlaceholder: 'Optional description',
      colors: {
        white: 'White',
        blue: 'Blue',
        green: 'Green',
        yellow: 'Yellow',
        red: 'Red',
        purple: 'Purple',
      },
      deleteNodeBtn: 'Delete This Node',
      selectNodeHint:
        'Click a node on the canvas or select one from the dropdown above to edit.',
      edgesHeading: 'Connections',
      sourceLabel: 'From',
      targetLabel: 'To',
      lineTypeLabel: 'Line Style',
      lineTypes: {
        arrow: 'Arrow (-->)',
        line: 'Line Only (---)',
        dotted: 'Dotted Arrow (-.->)',
        thick: 'Thick Arrow (==>)',
        circle: 'Circle End (--o)',
        cross: 'Cross End (--x)',
        bidirectional: 'Bidirectional (<-->)',
        invisible: 'Invisible (~~~)',
      },
      edgeLengthLabel: 'Link Length',
      edgeLengths: {
        standard: 'Standard',
        long1: 'Long (+1)',
        long2: 'Longer (+2)',
        long3: 'Longest (+3)',
      },
      edgeLabelStyleLabel: 'Label Syntax',
      edgeLabelStyles: {
        pipe: 'Pipe (-->|text|)',
        inline: 'Inline (-- text -->)',
      },
      edgeStrokeColorField: 'Link Color (linkStyle)',
      edgeLabelField: 'Connection Label',
      edgeLabelPlaceholder: 'Optional (e.g. Yes)',
      addEdgeBtn: 'Add Connection',
      noEdgesHint: 'No connections registered yet.',
      edgeItemLabelPlaceholder: 'No label',
      deleteEdgeTitle: 'Delete Connection',
      subgraphsHeading: 'Subgraphs (Group)',
      subgraphTitleField: 'Group Title',
      subgraphTitlePlaceholder: 'e.g. Preprocessing',
      subgraphDirectionField: 'Inner Direction',
      subgraphDirectionInherit: 'Same as diagram',
      addSubgraphBtn: 'Add Subgraph',
      defaultSubgraphTitle: (num) => `Group ${num}`,
      noSubgraphsHint: 'No subgraphs defined yet.',
      deleteSubgraphTitle: 'Delete Subgraph',
      classDefsHeading: 'Style Classes (classDef)',
      classNameField: 'Class Name',
      classNamePlaceholder: 'e.g. highlight',
      classFillField: 'Fill',
      classStrokeField: 'Stroke',
      addClassDefBtn: 'Add Style Class',
      noClassDefsHint: 'No style classes defined yet.',
      deleteClassDefTitle: 'Delete Style Class',
      commentsHeading: 'Comments (%%)',
      commentsField: 'One %% comment line emitted per row',
      commentsPlaceholder: 'e.g. Flowchart notes go here',
      safeguard: {
        syntaxErrorChars: (chars) =>
          `Characters ${formatCharList(chars, 'en')} cannot be used due to Mermaid syntax errors.`,
        urlErrorChars: (chars) =>
          `Spaces and ${formatCharList(chars, 'en')} cannot be used in the URL field.`,
        classNameErrorChars: (chars) =>
          `${formatCharList(chars, 'en')} cannot be used in class names (use A-Z, 0-9, _, -).`,
      },
    },
  },
};

export interface I18nContextValue {
  lang: Language;
  setLang: (nextLang: Language) => void;
  toggleLang: () => void;
  t: TranslationCatalog;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(detectInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // ストレージ書き込み不可時は無視する
    }
  }, [lang]);

  const setLang = useCallback((nextLang: Language) => {
    setLangState(nextLang);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => (prev === 'ja' ? 'en' : 'ja'));
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      toggleLang,
      t: translations[lang],
    }),
    [lang, setLang, toggleLang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}
