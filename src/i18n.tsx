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
  GanttTaskEndMode,
  GanttTaskStartMode,
  GanttTaskStatus,
  GanttWeekday,
  GanttWeekend,
  KanbanPriority,
  MermaidDiagramType,
  MermaidDirection,
  MindmapNodeShape,
  NodeShape,
  ArchitectureAlignDirection,
  ArchitectureDirection,
  ArchitectureNodeType,
  PieLegendPosition,
  TreeViewIconOption,
  TreeViewNodeType,
  XYChartOrientation,
  XYChartSeriesType,
  XYChartXAxisType,
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
    tabSizeLabel: string;
    tabSpacesOption: (count: number) => string;
  };
  modal: {
    ariaLabel: string;
    title: string;
    subtitle: string;
    subtitleSwimlane: string;
    subtitleTreeView: string;
    subtitleGantt: string;
    subtitleKanban: string;
    subtitlePie: string;
    subtitleXYChart: string;
    subtitleArchitecture: string;
    subtitleMindmap: string;
    subtitleQuadrantChart: string;
    diagramTypeLabel: string;
    diagramTypeComingSoon: string;
    diagramTypes: Record<MermaidDiagramType, string>;
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
    expandAllSections: string;
    collapseAllSections: string;
    swimlane: {
      lanesHeading: string;
      laneTitleField: string;
      laneTitlePlaceholder: string;
      laneFillField: string;
      laneStrokeField: string;
      addLaneBtn: string;
      defaultLaneTitle: (num: number) => string;
      noLanesHint: string;
      deleteLaneTitle: string;
      moveUpTitle: string;
      moveDownTitle: string;
      addStepToLaneTitle: string;
      nodeLaneField: string;
      noLaneOption: string;
      nodesHeading: string;
      addNodeBtn: string;
      defaultStepTitle: (num: number) => string;
      directions: Record<MermaidDirection, string>;
    };
    treeView: {
      settingsHeading: string;
      titleField: string;
      titlePlaceholder: string;
      showIconsField: string;
      rowIndentField: string;
      lineThicknessField: string;
      paddingXField: string;
      paddingYField: string;
      selectedItemHeading: string;
      itemNameField: string;
      itemNamePlaceholder: string;
      itemTypeField: string;
      itemTypes: Record<TreeViewNodeType, string>;
      highlightField: string;
      iconField: string;
      iconOptions: Record<TreeViewIconOption, string>;
      descriptionField: string;
      descriptionPlaceholder: string;
      addFolderBtn: string;
      addFileBtn: string;
      addChildFolderBtn: string;
      addChildFileBtn: string;
      outdentTitle: string;
      indentTitle: string;
      moveUpTitle: string;
      moveDownTitle: string;
      deleteItemBtn: string;
      selectItemHint: string;
      emptyTreeHint: string;
      defaultFolderName: (num: number) => string;
      defaultFileName: (num: number) => string;
      rootLabel: string;
    };
    gantt: {
      taskHeading: string;
      sectionsHeading: string;
      settingsHeading: string;
      addSectionBtn: string;
      addTaskBtn: string;
      addMilestoneBtn: string;
      addTaskToSectionTitle: string;
      unassignedLabel: string;
      defaultSectionTitle: (num: number) => string;
      defaultTaskLabel: (num: number) => string;
      defaultMilestoneLabel: (num: number) => string;
      noSectionsHint: string;
      emptyTasksHint: string;
      selectTaskHint: string;
      targetTaskField: string;
      taskLabelField: string;
      taskLabelPlaceholder: string;
      taskIdField: string;
      taskIdPlaceholder: string;
      taskSectionField: string;
      taskStatusField: string;
      statuses: Record<GanttTaskStatus, string>;
      tagCritField: string;
      tagMilestoneField: string;
      tagVertField: string;
      startModeField: string;
      startModes: Record<GanttTaskStartMode, string>;
      startDateField: string;
      afterTasksField: string;
      noOtherTasksHint: string;
      endModeField: string;
      endModes: Record<GanttTaskEndMode, string>;
      durationField: string;
      durationPlaceholder: string;
      endDateField: string;
      untilTasksField: string;
      clickUrlField: string;
      clickUrlPlaceholder: string;
      deleteTaskBtn: string;
      moveUpTitle: string;
      moveDownTitle: string;
      deleteSectionTitle: string;
      sectionTitlePlaceholder: string;
      titleField: string;
      titlePlaceholder: string;
      dateFormatField: string;
      axisFormatField: string;
      tickIntervalField: string;
      tickIntervalPlaceholder: string;
      excludesField: string;
      excludesPlaceholder: string;
      includesField: string;
      includesPlaceholder: string;
      todayMarkerField: string;
      todayMarkerPlaceholder: string;
      weekdayField: string;
      weekdayDefault: string;
      weekdays: Record<GanttWeekday, string>;
      weekendField: string;
      weekends: Record<GanttWeekend, string>;
      inclusiveEndDatesField: string;
      topAxisField: string;
      compactModeField: string;
      timelineAxisStart: string;
      timelineAxisEnd: string;
    };
    kanban: {
      cardHeading: string;
      columnsHeading: string;
      settingsHeading: string;
      addColumnBtn: string;
      addCardBtn: string;
      addCardToColumnTitle: string;
      defaultColumnTitle: (num: number) => string;
      defaultCardLabel: (num: number) => string;
      noColumnsHint: string;
      emptyColumnHint: string;
      selectCardHint: string;
      targetCardField: string;
      cardLabelField: string;
      cardLabelPlaceholder: string;
      cardColumnField: string;
      cardAssignedField: string;
      cardAssignedPlaceholder: string;
      cardTicketField: string;
      cardTicketPlaceholder: string;
      cardPriorityField: string;
      priorityNone: string;
      priorities: Record<KanbanPriority, string>;
      moveCardLeftTitle: string;
      moveCardRightTitle: string;
      moveUpTitle: string;
      moveDownTitle: string;
      deleteCardBtn: string;
      deleteColumnTitle: string;
      columnTitlePlaceholder: string;
      moveColumnLeftTitle: string;
      moveColumnRightTitle: string;
      ticketBaseUrlField: string;
      ticketBaseUrlPlaceholder: string;
      ticketBaseUrlHint: string;
      sectionWidthField: string;
    };
    pie: {
      sliceHeading: string;
      slicesListHeading: string;
      settingsHeading: string;
      addSliceBtn: string;
      defaultSliceLabel: (num: number) => string;
      noSlicesHint: string;
      selectSliceHint: string;
      targetSliceField: string;
      sliceLabelField: string;
      sliceLabelPlaceholder: string;
      sliceValueField: string;
      duplicateLabelWarning: string;
      moveUpTitle: string;
      moveDownTitle: string;
      deleteSliceBtn: string;
      deleteSliceTitle: string;
      titleField: string;
      titlePlaceholder: string;
      showDataField: string;
      donutHoleField: string;
      textPositionField: string;
      legendPositionField: string;
      legendPositions: Record<PieLegendPosition, string>;
      highlightSliceField: string;
      highlightOptions: {
        none: string;
        hover: string;
      };
      totalLabel: string;
      omittedSmallSliceHint: string;
    };
    xychart: {
      seriesHeading: string;
      axesHeading: string;
      settingsHeading: string;
      addBarBtn: string;
      addLineBtn: string;
      addCategoryBtn: string;
      addPointBtn: string;
      defaultCategoryLabel: (num: number) => string;
      defaultSeriesTitle: (type: XYChartSeriesType, num: number) => string;
      noSeriesHint: string;
      selectSeriesHint: string;
      targetSeriesField: string;
      seriesTypeField: string;
      seriesTypes: Record<XYChartSeriesType, string>;
      seriesTitleField: string;
      seriesTitlePlaceholder: string;
      valuesCsvField: string;
      moveUpTitle: string;
      moveDownTitle: string;
      deleteSeriesBtn: string;
      deleteCategoryTitle: string;
      categoryPlaceholder: string;
      orientationField: string;
      orientations: Record<XYChartOrientation, string>;
      chartTitleField: string;
      chartTitlePlaceholder: string;
      xAxisTitleField: string;
      xAxisTitlePlaceholder: string;
      xAxisTypeField: string;
      xAxisTypes: Record<XYChartXAxisType, string>;
      xAxisMinField: string;
      xAxisMaxField: string;
      yAxisTitleField: string;
      yAxisTitlePlaceholder: string;
      yAxisAutoRangeField: string;
      yAxisMinField: string;
      yAxisMaxField: string;
      showDataLabelField: string;
      showDataLabelOutsideBarField: string;
      chartWidthField: string;
      chartHeightField: string;
      categoryColumnHeader: string;
      pointColumnHeader: string;
      autoQuoteHint: string;
    };
    architecture: {
      addService: string;
      addJunction: string;
      addGroup: string;
      addEdge: string;
      defaultServiceTitle: (index: number) => string;
      defaultGroupTitle: (index: number) => string;
      nodeSection: string;
      edgesSection: string;
      groupsSection: string;
      layoutSection: string;
      commentsSection: string;
      emptyNodes: string;
      selectNodeHint: string;
      nodeTypeLabel: string;
      nodeTypes: Record<ArchitectureNodeType, string>;
      nodeTitleLabel: string;
      nodeTitlePlaceholder: string;
      nodeIconLabel: string;
      customIconLabel: string;
      customIconPlaceholder: string;
      iconPresets: Record<string, string>;
      nodeGroupLabel: string;
      noGroupOption: string;
      deleteNode: string;
      emptyEdges: string;
      edgeLhsNode: string;
      edgeRhsNode: string;
      edgeSideLabel: string;
      edgeSides: Record<ArchitectureDirection, string>;
      edgeArrowIntoLhs: string;
      edgeArrowIntoRhs: string;
      edgeGroupPort: string;
      edgeTitleLabel: string;
      edgeTitlePlaceholder: string;
      edgeSameNodeWarning: string;
      edgeSameDirWarning: string;
      edgeSameGroupPortWarning: string;
      deleteEdge: string;
      emptyGroups: string;
      groupTitleLabel: string;
      groupTitlePlaceholder: string;
      groupParentLabel: string;
      noParentOption: string;
      deleteGroup: string;
      diagramTitleLabel: string;
      diagramTitlePlaceholder: string;
      alignmentsLabel: string;
      addAlignment: string;
      alignDirLabel: string;
      alignDirs: Record<ArchitectureAlignDirection, string>;
      alignMembersHint: string;
      deleteAlignment: string;
      paddingLabel: string;
      iconSizeLabel: string;
      nodeSeparationLabel: string;
      ungroupedTitle: string;
      junctionBadge: string;
      commentsLabel: string;
      commentsPlaceholder: string;
    };
    mindmap: {
      addChildBtn: string;
      addSiblingBtn: string;
      indentBtn: string;
      outdentBtn: string;
      moveUpBtn: string;
      moveDownBtn: string;
      deleteNodeBtn: string;
      rootBadge: string;
      defaultTopicLabel: (index: number) => string;
      nodeSection: string;
      settingsSection: string;
      commentsSection: string;
      selectNodeHint: string;
      labelField: string;
      labelPlaceholder: string;
      shapeField: string;
      shapes: Record<MindmapNodeShape, string>;
      useMarkdownField: string;
      useMarkdownHint: string;
      iconField: string;
      iconPlaceholder: string;
      iconPresetsLabel: string;
      cssClassField: string;
      cssClassPlaceholder: string;
      cssClassPresetsLabel: string;
      paddingField: string;
      maxNodeWidthField: string;
      commentsField: string;
      commentsPlaceholder: string;
    };
    quadrantChart: {
      addPointBtn: string;
      deletePointBtn: string;
      dragHint: string;
      defaultPointLabel: (index: number) => string;
      defaultClassName: (index: number) => string;
      pointSection: string;
      quadrantsSection: string;
      classesSection: string;
      settingsSection: string;
      commentsSection: string;
      emptyPoints: string;
      selectPointHint: string;
      pointLabelField: string;
      pointXField: string;
      pointYField: string;
      pointClassField: string;
      noClassOption: string;
      radiusField: string;
      colorField: string;
      strokeColorField: string;
      strokeWidthField: string;
      clearStyleBtn: string;
      titleField: string;
      titlePlaceholder: string;
      q1Field: string;
      q2Field: string;
      q3Field: string;
      q4Field: string;
      xAxisLeftField: string;
      xAxisRightField: string;
      yAxisBottomField: string;
      yAxisTopField: string;
      addClassBtn: string;
      emptyClasses: string;
      classNameField: string;
      chartWidthField: string;
      chartHeightField: string;
      commentsField: string;
      commentsPlaceholder: string;
    };
    safeguard: {
      syntaxErrorChars: (chars: string[]) => string;
      urlErrorChars: (chars: string[]) => string;
      classNameErrorChars: (chars: string[]) => string;
      kanbanMetaErrorChars: (chars: string[]) => string;
      pieLabelErrorChars: (chars: string[]) => string;
      xychartTextErrorChars: (chars: string[]) => string;
      architectureTitleErrorChars: (chars: string[]) => string;
      architectureIconErrorChars: (chars: string[]) => string;
      mindmapLabelErrorChars: (chars: string[]) => string;
      mindmapIconErrorChars: (chars: string[]) => string;
      mindmapClassErrorChars: (chars: string[]) => string;
      quadrantTextErrorChars: (chars: string[]) => string;
      quadrantClassErrorChars: (chars: string[]) => string;
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
      tabSizeLabel: 'Tabインデント',
      tabSpacesOption: (count) => `${count}スペース`,
    },
    modal: {
      ariaLabel: 'Mermaid GUIエディタ',
      title: 'Mermaid図 GUIエディタ',
      subtitle: 'キャンバスのドラッグ接続と右側プルダウンの両方で編集できます',
      subtitleSwimlane: 'レーンごとにステップを配置して担当者間の業務フローを作成できます',
      subtitleTreeView: 'フォルダやファイルの階層構造をツリー形式で組み立てられます',
      subtitleGantt: 'セクションごとにタスクの開始日・期間・依存関係をタイムラインで管理できます',
      subtitleKanban: '列ごとにタスクカードを整理し担当者・チケット・優先度を設定できます',
      subtitlePie: '項目の数値やドーナツ比率・凡例位置を指定して円グラフを作成できます',
      subtitleXYChart: '棒グラフや折れ線グラフの系列とX軸・Y軸を組み合わせて可視化できます',
      subtitleArchitecture: 'グループ・サービス・ジャンクションの接続方向（L/R/T/B）を設定して構成図を作成できます',
      subtitleMindmap: '中心テーマから枝分かれするトピック・形・アイコン・クラスを階層構造で編集できます',
      subtitleQuadrantChart: '4象限の軸ラベルと各ポイントの座標（0〜1）をドラッグで配置できます',
      diagramTypeLabel: '図の種類',
      diagramTypeComingSoon: '順次対応',
      diagramTypes: {
        flowchart: 'フローチャート (flowchart)',
        swimlane: 'スイムレーン図 (swimlane-beta)',
        treeView: 'ツリービュー (treeView-beta)',
        kanban: 'カンバン (kanban)',
        pie: '円グラフ (pie)',
        xychart: '棒・折れ線グラフ (xychart-beta)',
        architecture: 'アーキテクチャ図 (architecture-beta)',
        mindmap: 'マインドマップ (mindmap)',
        quadrantChart: '四象限チャート (quadrantChart)',
        sequence: 'シーケンス図 (sequenceDiagram)',
        class: 'クラス図 (classDiagram)',
        state: '状態遷移図 (stateDiagram)',
        er: 'ER図 (erDiagram)',
        gantt: 'ガントチャート (gantt)',
      },
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
      expandAllSections: 'すべて展開',
      collapseAllSections: 'すべて折りたたむ',
      swimlane: {
        lanesHeading: 'スイムレーン (担当・部門)',
        laneTitleField: 'レーン名',
        laneTitlePlaceholder: '例: 顧客 / 承認者',
        laneFillField: '帯の色',
        laneStrokeField: '枠線色',
        addLaneBtn: 'レーンを追加',
        defaultLaneTitle: (num) => `レーン ${num}`,
        noLanesHint: 'スイムレーンがまだありません。レーンを追加してステップを割り当てられます。',
        deleteLaneTitle: 'このレーンを削除',
        moveUpTitle: '前のレーンへ入れ替え',
        moveDownTitle: '後のレーンへ入れ替え',
        addStepToLaneTitle: 'このレーンへステップを追加',
        nodeLaneField: '所属レーン (swimlane)',
        noLaneOption: 'レーン未所属',
        nodesHeading: '工程・ステップの編集',
        addNodeBtn: 'ステップを追加',
        defaultStepTitle: (num) => `処理 ${num}`,
        directions: {
          LR: '横レーン・左から右 (LR)',
          TD: '縦レーン・上から下 (TD)',
          RL: '横レーン・右から左 (RL)',
          BT: '縦レーン・下から上 (BT)',
        },
      },
      treeView: {
        settingsHeading: 'ツリー表示設定',
        titleField: '図タイトル (title)',
        titlePlaceholder: '例: プロジェクト構成',
        showIconsField: 'フォルダ・ファイルアイコンを表示する (showIcons)',
        rowIndentField: '階層の横インデント幅 (rowIndent)',
        lineThicknessField: '接続線の太さ (lineThickness)',
        paddingXField: '横余白 (paddingX)',
        paddingYField: '縦余白 (paddingY)',
        selectedItemHeading: '選択中アイテムの編集',
        itemNameField: '名前',
        itemNamePlaceholder: '例: src / index.ts',
        itemTypeField: '種類',
        itemTypes: {
          directory: 'フォルダ (末尾に /)',
          file: 'ファイル',
        },
        highlightField: 'ハイライト強調 (:::highlight)',
        iconField: '個別アイコン (icon)',
        iconOptions: {
          auto: '自動 (全体設定に従う)',
          folder: 'フォルダ (folder)',
          file: 'ファイル (file)',
          none: '非表示 (icon())',
        },
        descriptionField: '注釈・説明文 (## 説明)',
        descriptionPlaceholder: '例: エントリーポイント',
        addFolderBtn: 'ルートフォルダ追加',
        addFileBtn: 'ルートファイル追加',
        addChildFolderBtn: '子フォルダ追加',
        addChildFileBtn: '子ファイル追加',
        outdentTitle: '階層を浅くする',
        indentTitle: '1つ上の要素の子にする',
        moveUpTitle: '同じ階層内で上へ移動',
        moveDownTitle: '同じ階層内で下へ移動',
        deleteItemBtn: 'アイテムを削除 (配下含む)',
        selectItemHint: '左側のツリーから編集するフォルダやファイルを選択してください。',
        emptyTreeHint: '要素がまだありません。上のボタンからフォルダやファイルを追加してください。',
        defaultFolderName: (num) => `folder_${num}`,
        defaultFileName: (num) => `file_${num}.txt`,
        rootLabel: '/ (ルート)',
      },
      gantt: {
        taskHeading: '選択中タスクの編集',
        sectionsHeading: 'セクション管理',
        settingsHeading: 'チャート全体・軸設定',
        addSectionBtn: 'セクション追加',
        addTaskBtn: 'タスク追加',
        addMilestoneBtn: 'マイルストーン追加',
        addTaskToSectionTitle: 'このセクションへタスクを追加',
        unassignedLabel: 'セクション未指定',
        defaultSectionTitle: (num) => `フェーズ ${num}`,
        defaultTaskLabel: (num) => `タスク ${num}`,
        defaultMilestoneLabel: (num) => `マイルストーン ${num}`,
        noSectionsHint: 'セクションがまだありません。上のボタンから追加できます。',
        emptyTasksHint: 'タスクがまだありません。上のボタンから追加してください。',
        selectTaskHint: '左側のタイムラインから編集するタスクを選択してください。',
        targetTaskField: '編集対象タスク',
        taskLabelField: 'タスク名',
        taskLabelPlaceholder: '例: 要件定義',
        taskIdField: 'タスクID (依存先・リンク用)',
        taskIdPlaceholder: '例: t1',
        taskSectionField: '所属セクション',
        taskStatusField: '進捗状態',
        statuses: {
          normal: '通常',
          active: '進行中 (active)',
          done: '完了 (done)',
        },
        tagCritField: '重要パス (crit)',
        tagMilestoneField: 'マイルストーン (milestone)',
        tagVertField: '縦マーカー線 (vert)',
        startModeField: '開始タイミング',
        startModes: {
          date: '開始日を指定',
          after: '他タスクの完了後 (after)',
          auto: '直前タスクの直後 (省略)',
        },
        startDateField: '開始日時',
        afterTasksField: '完了待ちタスク (複数選択可)',
        noOtherTasksHint: '指定できる他のタスクがありません。',
        endModeField: '終了・期間指定',
        endModes: {
          duration: '期間 (3d / 2w / 12h など)',
          date: '終了日を指定',
          until: '他タスク開始まで (until)',
        },
        durationField: '期間 (d / w / M / h)',
        durationPlaceholder: '例: 5d',
        endDateField: '終了日時',
        untilTasksField: '開始待ちタスク (複数選択可)',
        clickUrlField: 'クリック時のURL (任意)',
        clickUrlPlaceholder: 'https://example.com',
        deleteTaskBtn: 'このタスクを削除',
        moveUpTitle: '上へ移動',
        moveDownTitle: '下へ移動',
        deleteSectionTitle: 'このセクションを削除',
        sectionTitlePlaceholder: '例: 企画・設計',
        titleField: 'チャートタイトル (title)',
        titlePlaceholder: '例: 開発スケジュール',
        dateFormatField: '入力日付フォーマット (dateFormat)',
        axisFormatField: '軸ラベル書式 (axisFormat)',
        tickIntervalField: '目盛り間隔 (tickInterval)',
        tickIntervalPlaceholder: '例: 1day / 1week',
        excludesField: '除外日 (excludes)',
        excludesPlaceholder: '例: weekends',
        includesField: '除外から戻す日 (includes)',
        includesPlaceholder: '例: 2026-11-22',
        todayMarkerField: '今日線表示 (todayMarker)',
        todayMarkerPlaceholder: '空欄で標準 / off で非表示',
        weekdayField: '週の開始曜日 (weekday)',
        weekdayDefault: '標準 (日曜日)',
        weekdays: {
          monday: '月曜日 (monday)',
          tuesday: '火曜日 (tuesday)',
          wednesday: '水曜日 (wednesday)',
          thursday: '木曜日 (thursday)',
          friday: '金曜日 (friday)',
          saturday: '土曜日 (saturday)',
          sunday: '日曜日 (sunday)',
        },
        weekendField: '週末の基準 (weekend)',
        weekends: {
          saturday: '土・日 (saturday)',
          friday: '金・土 (friday)',
        },
        inclusiveEndDatesField: '終了日を期間に含める (inclusiveEndDates)',
        topAxisField: '上側にも日付軸を表示する (topAxis)',
        compactModeField: 'コンパクト表示モード (displayMode: compact)',
        timelineAxisStart: '開始',
        timelineAxisEnd: '終了',
      },
      kanban: {
        cardHeading: '選択中のカード',
        columnsHeading: '列 (セクション)',
        settingsHeading: 'ボード設定 (kanban)',
        addColumnBtn: '列を追加',
        addCardBtn: 'カードを追加',
        addCardToColumnTitle: 'この列にカードを追加',
        defaultColumnTitle: (num) => `列 ${num}`,
        defaultCardLabel: (num) => `タスク ${num}`,
        noColumnsHint: '列がありません。「列を追加」からボードの列を作成してください。',
        emptyColumnHint: 'カードなし',
        selectCardHint: 'キャンバスまたは上からカードを選択して編集してください。',
        targetCardField: '編集対象カード',
        cardLabelField: 'カード内容 (タイトル)',
        cardLabelPlaceholder: '例: ログイン画面の実装',
        cardColumnField: '所属する列',
        cardAssignedField: '担当者 (assigned)',
        cardAssignedPlaceholder: '例: Alice',
        cardTicketField: 'チケット番号 (ticket)',
        cardTicketPlaceholder: '例: DEV-101',
        cardPriorityField: '優先度 (priority)',
        priorityNone: '指定なし',
        priorities: {
          'Very High': '最優先 (Very High)',
          High: '高 (High)',
          Medium: '中 (Medium)',
          Low: '低 (Low)',
          'Very Low': '最低 (Very Low)',
        },
        moveCardLeftTitle: '左の列へ移動',
        moveCardRightTitle: '右の列へ移動',
        moveUpTitle: '上へ移動',
        moveDownTitle: '下へ移動',
        deleteCardBtn: 'このカードを削除',
        deleteColumnTitle: 'この列を削除',
        columnTitlePlaceholder: '例: 進行中 (Doing)',
        moveColumnLeftTitle: '左へ移動',
        moveColumnRightTitle: '右へ移動',
        ticketBaseUrlField: 'チケットベースURL (ticketBaseUrl)',
        ticketBaseUrlPlaceholder: 'https://example.com/browse/#TICKET#',
        ticketBaseUrlHint: '#TICKET# の部分に各カードのチケット番号が埋め込まれます。',
        sectionWidthField: '列の幅 (sectionWidth / px)',
      },
      pie: {
        sliceHeading: '選択中の項目',
        slicesListHeading: '項目一覧・割合',
        settingsHeading: 'グラフ表示設定',
        addSliceBtn: '項目を追加',
        defaultSliceLabel: (num) => `項目 ${num}`,
        noSlicesHint: '項目がありません。「項目を追加」からスライスを作成してください。',
        selectSliceHint: '左の一覧または上のプルダウンから項目を選択して編集してください。',
        targetSliceField: '編集対象の項目',
        sliceLabelField: '項目名 (ラベル)',
        sliceLabelPlaceholder: '例: 開発費',
        sliceValueField: '数値 (0以上)',
        duplicateLabelWarning: '同じ項目名が重複しています。Mermaid仕様上、後の同名は集計されません。',
        moveUpTitle: '上へ移動',
        moveDownTitle: '下へ移動',
        deleteSliceBtn: 'この項目を削除',
        deleteSliceTitle: 'この項目を削除',
        titleField: 'グラフタイトル (title)',
        titlePlaceholder: '例: 開発工数の内訳',
        showDataField: '凡例に実数値も表示する (showData)',
        donutHoleField: 'ドーナツ穴の割合 (donutHole: 0〜0.9)',
        textPositionField: '%ラベルの位置 (textPosition: 0.1〜1.0)',
        legendPositionField: '凡例の位置 (legendPosition)',
        legendPositions: {
          right: '右 (right)',
          left: '左 (left)',
          top: '上 (top)',
          bottom: '下 (bottom)',
          center: '中央 (center)',
        },
        highlightSliceField: '強調表示 (highlightSlice)',
        highlightOptions: {
          none: 'なし',
          hover: 'ホバー時に強調 (hover)',
        },
        totalLabel: '合計',
        omittedSmallSliceHint: '1%未満または0%表示となる項目は円弧が非表示になります（凡例には残ります）。',
      },
      xychart: {
        seriesHeading: 'データ系列 (bar / line)',
        axesHeading: '向き・タイトル・X軸・Y軸',
        settingsHeading: 'チャート表示設定',
        addBarBtn: '棒系列を追加',
        addLineBtn: '線系列を追加',
        addCategoryBtn: 'X軸カテゴリを追加',
        addPointBtn: 'データ点を追加',
        defaultCategoryLabel: (num) => `項目${num}`,
        defaultSeriesTitle: (type, num) =>
          type === 'bar' ? `棒系列 ${num}` : `折れ線 ${num}`,
        noSeriesHint: '系列がありません。「棒系列を追加」または「線系列を追加」から作成してください。',
        selectSeriesHint: '左の一覧または上のプルダウンから編集したい系列を選択してください。',
        targetSeriesField: '編集対象の系列',
        seriesTypeField: 'グラフ種別',
        seriesTypes: {
          bar: '棒グラフ (bar)',
          line: '折れ線グラフ (line)',
        },
        seriesTitleField: '系列ラベル (任意)',
        seriesTitlePlaceholder: '例: 売上高',
        valuesCsvField: '数値データ (カンマ区切り)',
        moveUpTitle: '上へ移動',
        moveDownTitle: '下へ移動',
        deleteSeriesBtn: 'この系列を削除',
        deleteCategoryTitle: 'この項目を削除',
        categoryPlaceholder: '例: 1月',
        orientationField: 'グラフの向き',
        orientations: {
          vertical: '縦向き (標準)',
          horizontal: '横向き (horizontal)',
        },
        chartTitleField: 'グラフタイトル (title)',
        chartTitlePlaceholder: '例: 月別売上・利益推移',
        xAxisTitleField: 'X軸タイトル',
        xAxisTitlePlaceholder: '例: 月',
        xAxisTypeField: 'X軸の種類',
        xAxisTypes: {
          band: 'カテゴリ一覧 [文字列, ...]',
          linear: '数値範囲 (最小 --> 最大)',
        },
        xAxisMinField: 'X軸 最小値',
        xAxisMaxField: 'X軸 最大値',
        yAxisTitleField: 'Y軸タイトル',
        yAxisTitlePlaceholder: '例: 金額 (万円)',
        yAxisAutoRangeField: 'Y軸の範囲をデータから自動決定する',
        yAxisMinField: 'Y軸 最小値',
        yAxisMaxField: 'Y軸 最大値',
        showDataLabelField: '棒の上に数値を表示する (showDataLabel)',
        showDataLabelOutsideBarField: '棒の外側に数値を出す (showDataLabelOutsideBar)',
        chartWidthField: 'チャート幅 (px)',
        chartHeightField: 'チャート高さ (px)',
        categoryColumnHeader: 'X軸カテゴリ名',
        pointColumnHeader: 'データ点',
        autoQuoteHint: '日本語や記号が構文エラーにならないよう、タイトルと軸ラベルは自動で "" で囲って出力します。',
      },
      architecture: {
        addService: 'サービス追加',
        addJunction: 'ジャンクション追加',
        addGroup: 'グループ追加',
        addEdge: '接続線追加',
        defaultServiceTitle: (index) => `サービス ${index}`,
        defaultGroupTitle: (index) => `グループ ${index}`,
        nodeSection: '選択中のノード',
        edgesSection: '接続線',
        groupsSection: 'グループ階層',
        layoutSection: '全体・整列設定',
        commentsSection: 'コメント',
        emptyNodes: 'サービスやジャンクションがありません。上のボタンから追加できます。',
        selectNodeHint: 'キャンバスからサービスまたはジャンクションを選択すると詳細を編集できます。',
        nodeTypeLabel: 'ノード種別',
        nodeTypes: {
          service: 'サービス (service)',
          junction: 'ジャンクション (junction)',
        },
        nodeTitleLabel: '表示名',
        nodeTitlePlaceholder: '例: Webサーバー',
        nodeIconLabel: 'アイコンプリセット',
        customIconLabel: 'カスタムアイコン (Iconify名)',
        customIconPlaceholder: '例: logos:aws-ec2 (空欄でプリセット)',
        iconPresets: {
          server: 'サーバー (server)',
          cloud: 'クラウド (cloud)',
          database: 'データベース (database)',
          disk: 'ストレージ (disk)',
          internet: 'インターネット (internet)',
          unknown: '汎用アイコン (unknown)',
          blank: 'アイコンなし (blank)',
        },
        nodeGroupLabel: '所属グループ',
        noGroupOption: '(グループなし)',
        deleteNode: 'このノードを削除',
        emptyEdges: '接続線がありません。',
        edgeLhsNode: '接続元ノード',
        edgeRhsNode: '接続先ノード',
        edgeSideLabel: '接続辺',
        edgeSides: {
          L: '左 (L)',
          R: '右 (R)',
          T: '上 (T)',
          B: '下 (B)',
        },
        edgeArrowIntoLhs: '元側へ矢印 (<)',
        edgeArrowIntoRhs: '先側へ矢印 (>)',
        edgeGroupPort: 'グループ境界から接続 ({group})',
        edgeTitleLabel: '接続ラベル',
        edgeTitlePlaceholder: '例: HTTPS / SQL (空欄可)',
        edgeSameNodeWarning: '同じノード同士は接続できません（別ノードを選んでください）',
        edgeSameDirWarning: 'Mermaidの制約により同一方向（L-Lなど）は使えません。出力時に自動補正されます。',
        edgeSameGroupPortWarning: '同じグループ内では {group} を指定できないため、出力時に自動解除されます。',
        deleteEdge: 'この接続線を削除',
        emptyGroups: 'グループはありません。',
        groupTitleLabel: 'グループ名',
        groupTitlePlaceholder: '例: クラウド基盤',
        groupParentLabel: '親グループ',
        noParentOption: '(最上位グループ)',
        deleteGroup: 'グループを削除',
        diagramTitleLabel: '図のタイトル',
        diagramTitlePlaceholder: '例: システム構成図 (空欄可)',
        alignmentsLabel: '整列ヒント (align)',
        addAlignment: '整列を追加',
        alignDirLabel: '方向',
        alignDirs: {
          row: '横一列 (row)',
          column: '縦一列 (column)',
        },
        alignMembersHint: '2つ以上のノードを選ぶと整列ヒントが出力されます',
        deleteAlignment: '削除',
        paddingLabel: 'グループ余白 (padding)',
        iconSizeLabel: 'アイコンサイズ (iconSize)',
        nodeSeparationLabel: 'ノード間隔 (nodeSeparation)',
        ungroupedTitle: 'グループ未所属',
        junctionBadge: '中継点',
        commentsLabel: '%% コメント（1行1コメント）',
        commentsPlaceholder: '構成の補足メモなど',
      },
      mindmap: {
        addChildBtn: '子トピック追加',
        addSiblingBtn: '兄弟トピック追加',
        indentBtn: '字下げ',
        outdentBtn: '字上げ',
        moveUpBtn: '上へ',
        moveDownBtn: '下へ',
        deleteNodeBtn: 'このトピックを削除',
        rootBadge: '中心 (Root)',
        defaultTopicLabel: (index) => `トピック ${index}`,
        nodeSection: '選択中のトピック',
        settingsSection: 'レイアウト設定',
        commentsSection: 'コメント',
        selectNodeHint: '左側のツリーからトピックを選ぶと詳細を編集できます。',
        labelField: 'トピック名',
        labelPlaceholder: '例: 新機能の企画',
        shapeField: 'ノードの形',
        shapes: {
          default: '枠なしテキスト (Default)',
          rounded: '角丸四角形 (text)',
          rect: '四角形 [text]',
          circle: '円形 ((text))',
          cloud: '雲形 )text(',
          bang: '強調・爆発形 ))text((',
          hexagon: '六角形 {{text}}',
        },
        useMarkdownField: 'Markdown記法を有効にする ("`...`")',
        useMarkdownHint: '**太字** や *斜体* を使う場合は枠なし以外の形を選びます。',
        iconField: 'アイコン (::icon)',
        iconPlaceholder: '例: fa fa-book / mdi:star',
        iconPresetsLabel: 'よく使うアイコン',
        cssClassField: 'CSSクラス (:::)',
        cssClassPlaceholder: '例: urgent large',
        cssClassPresetsLabel: 'クラス候補',
        paddingField: 'ノード余白 (padding)',
        maxNodeWidthField: '最大ノード幅 (maxNodeWidth)',
        commentsField: '%% コメント（1行1コメント）',
        commentsPlaceholder: '企画のメモなど',
      },
      quadrantChart: {
        addPointBtn: 'ポイント追加',
        deletePointBtn: '選択ポイントを削除',
        dragHint: '点をドラッグで移動、空白をダブルクリックでその座標にポイントを追加できます',
        defaultPointLabel: (index) => `項目 ${index}`,
        defaultClassName: (index) => `group${index}`,
        pointSection: '選択中のポイント',
        quadrantsSection: 'タイトル・4象限・軸ラベル',
        classesSection: 'スタイルクラス (classDef)',
        settingsSection: 'サイズ・余白設定',
        commentsSection: 'コメント',
        emptyPoints: 'ポイントがありません。上のボタンやボードのダブルクリックで追加できます。',
        selectPointHint: 'ボードまたは一覧からポイントを選ぶと編集できます。',
        pointLabelField: '項目名',
        pointXField: 'X座標 (0.00 〜 1.00)',
        pointYField: 'Y座標 (0.00 〜 1.00)',
        pointClassField: 'スタイルクラス (:::)',
        noClassOption: '(指定なし)',
        radiusField: '点の半径 (radius)',
        colorField: '塗り色 (color)',
        strokeColorField: '枠線色 (stroke-color)',
        strokeWidthField: '枠線太さ px (stroke-width)',
        clearStyleBtn: '個別スタイル解除',
        titleField: 'タイトル',
        titlePlaceholder: '例: 施策の優先度マトリクス',
        q1Field: '第1象限 右上 (quadrant-1)',
        q2Field: '第2象限 左上 (quadrant-2)',
        q3Field: '第3象限 左下 (quadrant-3)',
        q4Field: '第4象限 右下 (quadrant-4)',
        xAxisLeftField: 'X軸 左端',
        xAxisRightField: 'X軸 右端 (任意)',
        yAxisBottomField: 'Y軸 下端',
        yAxisTopField: 'Y軸 上端 (任意)',
        addClassBtn: 'クラス追加',
        emptyClasses: 'スタイルクラスはありません。',
        classNameField: 'クラス名',
        chartWidthField: 'チャート幅 (chartWidth)',
        chartHeightField: 'チャート高さ (chartHeight)',
        commentsField: '%% コメント（1行1コメント）',
        commentsPlaceholder: '分析メモなど',
      },
      safeguard: {
        syntaxErrorChars: (chars) =>
          `${formatCharList(chars, 'ja')}の文字は構文エラーになるため使えません（全角の（）などは入力できます）`,
        urlErrorChars: (chars) =>
          `${formatCharList(chars, 'ja')}の文字や空白はURL欄では使えません`,
        classNameErrorChars: (chars) =>
          `${formatCharList(chars, 'ja')}はクラス名に使えません（半角英数字・_・- のみ入力できます）`,
        kanbanMetaErrorChars: (chars) =>
          `${formatCharList(chars, 'ja')}の文字はカンバンメタデータ構文と干渉するため使えません`,
        pieLabelErrorChars: (chars) =>
          `${formatCharList(chars, 'ja')}の文字は円グラフの項目名構文エラーになるため使えません`,
        xychartTextErrorChars: (chars) =>
          `${formatCharList(chars, 'ja')}は二重引用符で囲う際の構文エラーになるため使えません（日本語や括弧はそのまま入力できます）`,
        architectureTitleErrorChars: (chars) =>
          `${formatCharList(chars, 'ja')}の文字は構成図のタイトルや [ ] ラベル構文と干渉するため使えません`,
        architectureIconErrorChars: (chars) =>
          `${formatCharList(chars, 'ja')}はアイコン名に使えません（半角英数字・_・:・- のみ入力できます）`,
        mindmapLabelErrorChars: (chars) =>
          `${formatCharList(chars, 'ja')}の文字はマインドマップの図形記号と干渉するため使えません（全角の（）などは入力できます）`,
        mindmapIconErrorChars: (chars) =>
          `${formatCharList(chars, 'ja')}は ::icon(...) 構文と干渉するため使えません`,
        mindmapClassErrorChars: (chars) =>
          `${formatCharList(chars, 'ja')}は :::クラス名 に使えません（半角英数字・空白・_・- のみ入力できます）`,
        quadrantTextErrorChars: (chars) =>
          `${formatCharList(chars, 'ja')}の文字は四象限チャートの引用符構文と干渉するため使えません`,
        quadrantClassErrorChars: (chars) =>
          `${formatCharList(chars, 'ja')}は四象限チャートのクラス名に使えません（半角英数字のみ入力できます）`,
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
      tabSizeLabel: 'Tab Indent',
      tabSpacesOption: (count) => `${count} spaces`,
    },
    modal: {
      ariaLabel: 'Mermaid GUI Editor',
      title: 'Mermaid Diagram GUI Editor',
      subtitle: 'Edit by dragging connections on the canvas or using the right panel',
      subtitleSwimlane: 'Organize steps across lanes to map cross-team workflows',
      subtitleTreeView: 'Build hierarchical folder and file structures visually',
      subtitleGantt: 'Schedule tasks, sections, milestones, and dependencies on a timeline',
      subtitleKanban: 'Organize cards across columns with assignees, tickets, and priority badges',
      subtitlePie: 'Configure slice values, donut hole ratio, and legend placement visually',
      subtitleXYChart: 'Combine bar and line series with custom X and Y axes',
      subtitleArchitecture: 'Build cloud and service architecture diagrams with grouped nodes and L/R/T/B edges',
      subtitleMindmap: 'Organize branching topics with node shapes, icons, classes, and hierarchical levels',
      subtitleQuadrantChart: 'Plot and drag items across 4 quadrants with X/Y axes and custom point styles',
      diagramTypeLabel: 'Diagram Type',
      diagramTypeComingSoon: 'Coming soon',
      diagramTypes: {
        flowchart: 'Flowchart (flowchart)',
        swimlane: 'Swimlane Diagram (swimlane-beta)',
        treeView: 'Tree View (treeView-beta)',
        kanban: 'Kanban Board (kanban)',
        pie: 'Pie Chart (pie)',
        xychart: 'XY Chart (xychart-beta)',
        architecture: 'Architecture (architecture-beta)',
        mindmap: 'Mindmap (mindmap)',
        quadrantChart: 'Quadrant Chart (quadrantChart)',
        sequence: 'Sequence Diagram (sequenceDiagram)',
        class: 'Class Diagram (classDiagram)',
        state: 'State Diagram (stateDiagram)',
        er: 'ER Diagram (erDiagram)',
        gantt: 'Gantt Chart (gantt)',
      },
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
      expandAllSections: 'Expand All',
      collapseAllSections: 'Collapse All',
      swimlane: {
        lanesHeading: 'Swimlanes (Roles / Teams)',
        laneTitleField: 'Lane Name',
        laneTitlePlaceholder: 'e.g. Customer / Ops',
        laneFillField: 'Lane Fill',
        laneStrokeField: 'Lane Border',
        addLaneBtn: 'Add Lane',
        defaultLaneTitle: (num) => `Lane ${num}`,
        noLanesHint: 'No swimlanes yet. Add a lane and assign workflow steps to it.',
        deleteLaneTitle: 'Delete Lane',
        moveUpTitle: 'Move Lane Earlier',
        moveDownTitle: 'Move Lane Later',
        addStepToLaneTitle: 'Add Step to This Lane',
        nodeLaneField: 'Assigned Lane',
        noLaneOption: 'Unassigned',
        nodesHeading: 'Steps & Nodes',
        addNodeBtn: 'Add Step',
        defaultStepTitle: (num) => `Step ${num}`,
        directions: {
          LR: 'Horizontal Lanes (LR)',
          TD: 'Vertical Lanes (TD)',
          RL: 'Horizontal Right-Left (RL)',
          BT: 'Vertical Bottom-Up (BT)',
        },
      },
      treeView: {
        settingsHeading: 'Tree Settings',
        titleField: 'Diagram Title',
        titlePlaceholder: 'e.g. Project Structure',
        showIconsField: 'Show folder/file icons (showIcons)',
        rowIndentField: 'Indent Width (rowIndent)',
        lineThicknessField: 'Line Thickness (lineThickness)',
        paddingXField: 'Padding X (paddingX)',
        paddingYField: 'Padding Y (paddingY)',
        selectedItemHeading: 'Selected Item',
        itemNameField: 'Name',
        itemNamePlaceholder: 'e.g. src / index.ts',
        itemTypeField: 'Type',
        itemTypes: {
          directory: 'Directory (trailing /)',
          file: 'File',
        },
        highlightField: 'Highlight row (:::highlight)',
        iconField: 'Icon Override',
        iconOptions: {
          auto: 'Auto (follow tree setting)',
          folder: 'Folder (icon(folder))',
          file: 'File (icon(file))',
          none: 'Hidden (icon())',
        },
        descriptionField: 'Description (## note)',
        descriptionPlaceholder: 'e.g. Entry point',
        addFolderBtn: 'Add Root Folder',
        addFileBtn: 'Add Root File',
        addChildFolderBtn: 'Add Child Folder',
        addChildFileBtn: 'Add Child File',
        outdentTitle: 'Outdent (move level up)',
        indentTitle: 'Indent under previous item',
        moveUpTitle: 'Move up among siblings',
        moveDownTitle: 'Move down among siblings',
        deleteItemBtn: 'Delete Item (and children)',
        selectItemHint: 'Select a folder or file in the left tree to edit its properties.',
        emptyTreeHint: 'No tree items yet. Add a folder or file using the buttons above.',
        defaultFolderName: (num) => `folder_${num}`,
        defaultFileName: (num) => `file_${num}.txt`,
        rootLabel: '/ (root)',
      },
      gantt: {
        taskHeading: 'Selected Task',
        sectionsHeading: 'Sections',
        settingsHeading: 'Chart & Axis Settings',
        addSectionBtn: 'Add Section',
        addTaskBtn: 'Add Task',
        addMilestoneBtn: 'Add Milestone',
        addTaskToSectionTitle: 'Add Task to Section',
        unassignedLabel: 'Unassigned',
        defaultSectionTitle: (num) => `Phase ${num}`,
        defaultTaskLabel: (num) => `Task ${num}`,
        defaultMilestoneLabel: (num) => `Milestone ${num}`,
        noSectionsHint: 'No sections yet. Add a section above.',
        emptyTasksHint: 'No tasks yet. Add a task or milestone above.',
        selectTaskHint: 'Select a task from the timeline on the left to edit it.',
        targetTaskField: 'Target Task',
        taskLabelField: 'Task Name',
        taskLabelPlaceholder: 'e.g. Requirements',
        taskIdField: 'Task ID (for after / until / click)',
        taskIdPlaceholder: 'e.g. t1',
        taskSectionField: 'Section',
        taskStatusField: 'Status',
        statuses: {
          normal: 'Normal',
          active: 'Active (active)',
          done: 'Done (done)',
        },
        tagCritField: 'Critical path (crit)',
        tagMilestoneField: 'Milestone (milestone)',
        tagVertField: 'Vertical marker (vert)',
        startModeField: 'Start Timing',
        startModes: {
          date: 'Explicit Date',
          after: 'After Other Task(s)',
          auto: 'Follow Previous Task',
        },
        startDateField: 'Start Date',
        afterTasksField: 'Wait For Completion (after)',
        noOtherTasksHint: 'No other tasks available.',
        endModeField: 'End / Duration',
        endModes: {
          duration: 'Duration (e.g. 5d, 2w)',
          date: 'Explicit End Date',
          until: 'Until Task Starts (until)',
        },
        durationField: 'Duration (d / w / M / h)',
        durationPlaceholder: 'e.g. 5d',
        endDateField: 'End Date',
        untilTasksField: 'Until Start Of (until)',
        clickUrlField: 'Click URL (optional)',
        clickUrlPlaceholder: 'https://example.com',
        deleteTaskBtn: 'Delete Task',
        moveUpTitle: 'Move Up',
        moveDownTitle: 'Move Down',
        deleteSectionTitle: 'Delete Section',
        sectionTitlePlaceholder: 'e.g. Planning',
        titleField: 'Chart Title',
        titlePlaceholder: 'e.g. Project Schedule',
        dateFormatField: 'Date Format',
        axisFormatField: 'Axis Format (strftime)',
        tickIntervalField: 'Tick Interval',
        tickIntervalPlaceholder: 'e.g. 1day / 1week',
        excludesField: 'Excludes',
        excludesPlaceholder: 'e.g. weekends',
        includesField: 'Includes Override',
        includesPlaceholder: 'e.g. 2026-11-22',
        todayMarkerField: 'Today Marker',
        todayMarkerPlaceholder: 'default / off',
        weekdayField: 'Week Starts On (weekday)',
        weekdayDefault: 'Default (sunday)',
        weekdays: {
          monday: 'Monday',
          tuesday: 'Tuesday',
          wednesday: 'Wednesday',
          thursday: 'Thursday',
          friday: 'Friday',
          saturday: 'Saturday',
          sunday: 'Sunday',
        },
        weekendField: 'Weekend Days (weekend)',
        weekends: {
          saturday: 'Sat-Sun (saturday)',
          friday: 'Fri-Sat (friday)',
        },
        inclusiveEndDatesField: 'Inclusive End Dates',
        topAxisField: 'Show Top Axis (topAxis)',
        compactModeField: 'Compact Display Mode',
        timelineAxisStart: 'Start',
        timelineAxisEnd: 'End',
      },
      kanban: {
        cardHeading: 'Selected Card',
        columnsHeading: 'Columns (Sections)',
        settingsHeading: 'Board Settings (kanban)',
        addColumnBtn: 'Add Column',
        addCardBtn: 'Add Card',
        addCardToColumnTitle: 'Add card to this column',
        defaultColumnTitle: (num) => `Column ${num}`,
        defaultCardLabel: (num) => `Task ${num}`,
        noColumnsHint: 'No columns yet. Add a column to start building the board.',
        emptyColumnHint: 'No cards',
        selectCardHint: 'Select a card on the board or above to edit its details.',
        targetCardField: 'Target Card',
        cardLabelField: 'Card Title',
        cardLabelPlaceholder: 'e.g. Implement login UI',
        cardColumnField: 'Column',
        cardAssignedField: 'Assignee (assigned)',
        cardAssignedPlaceholder: 'e.g. Alice',
        cardTicketField: 'Ticket ID (ticket)',
        cardTicketPlaceholder: 'e.g. DEV-101',
        cardPriorityField: 'Priority (priority)',
        priorityNone: 'None',
        priorities: {
          'Very High': 'Very High',
          High: 'High',
          Medium: 'Medium',
          Low: 'Low',
          'Very Low': 'Very Low',
        },
        moveCardLeftTitle: 'Move to previous column',
        moveCardRightTitle: 'Move to next column',
        moveUpTitle: 'Move Up',
        moveDownTitle: 'Move Down',
        deleteCardBtn: 'Delete This Card',
        deleteColumnTitle: 'Delete Column',
        columnTitlePlaceholder: 'e.g. In Progress',
        moveColumnLeftTitle: 'Move Left',
        moveColumnRightTitle: 'Move Right',
        ticketBaseUrlField: 'Ticket Base URL (ticketBaseUrl)',
        ticketBaseUrlPlaceholder: 'https://example.com/browse/#TICKET#',
        ticketBaseUrlHint: '#TICKET# is replaced with each card ticket value.',
        sectionWidthField: 'Column Width (sectionWidth / px)',
      },
      pie: {
        sliceHeading: 'Selected Slice',
        slicesListHeading: 'Slices & Breakdown',
        settingsHeading: 'Chart Display Settings',
        addSliceBtn: 'Add Slice',
        defaultSliceLabel: (num) => `Slice ${num}`,
        noSlicesHint: 'No slices yet. Click "Add Slice" to create one.',
        selectSliceHint: 'Select a slice from the canvas or dropdown above to edit it.',
        targetSliceField: 'Target Slice',
        sliceLabelField: 'Slice Label',
        sliceLabelPlaceholder: 'e.g. Implementation',
        sliceValueField: 'Value (>= 0)',
        duplicateLabelWarning: 'Duplicate slice label found. Mermaid ignores subsequent duplicate labels.',
        moveUpTitle: 'Move Up',
        moveDownTitle: 'Move Down',
        deleteSliceBtn: 'Delete This Slice',
        deleteSliceTitle: 'Delete Slice',
        titleField: 'Chart Title (title)',
        titlePlaceholder: 'e.g. Project Effort Breakdown',
        showDataField: 'Show raw values in legend (showData)',
        donutHoleField: 'Donut Hole Ratio (donutHole: 0 - 0.9)',
        textPositionField: 'Percentage Label Radius (textPosition)',
        legendPositionField: 'Legend Position (legendPosition)',
        legendPositions: {
          right: 'Right (right)',
          left: 'Left (left)',
          top: 'Top (top)',
          bottom: 'Bottom (bottom)',
          center: 'Center (center)',
        },
        highlightSliceField: 'Highlight Slice (highlightSlice)',
        highlightOptions: {
          none: 'None',
          hover: 'Highlight on hover (hover)',
        },
        totalLabel: 'Total',
        omittedSmallSliceHint: 'Slices rounding to 0% are hidden from the pie arcs (but kept in the legend).',
      },
      xychart: {
        seriesHeading: 'Data Series (bar / line)',
        axesHeading: 'Orientation, Title & Axes',
        settingsHeading: 'Chart Display Settings',
        addBarBtn: 'Add Bar Series',
        addLineBtn: 'Add Line Series',
        addCategoryBtn: 'Add X Category',
        addPointBtn: 'Add Point',
        defaultCategoryLabel: (num) => `Item ${num}`,
        defaultSeriesTitle: (type, num) =>
          type === 'bar' ? `Bar ${num}` : `Line ${num}`,
        noSeriesHint: 'No series yet. Click "Add Bar Series" or "Add Line Series" to begin.',
        selectSeriesHint: 'Select a series from the left preview or dropdown above to edit it.',
        targetSeriesField: 'Target Series',
        seriesTypeField: 'Series Type',
        seriesTypes: {
          bar: 'Bar (bar)',
          line: 'Line (line)',
        },
        seriesTitleField: 'Series Label (optional)',
        seriesTitlePlaceholder: 'e.g. Revenue',
        valuesCsvField: 'Numeric Values (comma separated)',
        moveUpTitle: 'Move Up',
        moveDownTitle: 'Move Down',
        deleteSeriesBtn: 'Delete This Series',
        deleteCategoryTitle: 'Delete Item',
        categoryPlaceholder: 'e.g. Jan',
        orientationField: 'Orientation',
        orientations: {
          vertical: 'Vertical (default)',
          horizontal: 'Horizontal (horizontal)',
        },
        chartTitleField: 'Chart Title (title)',
        chartTitlePlaceholder: 'e.g. Monthly Sales & Profit',
        xAxisTitleField: 'X-Axis Title',
        xAxisTitlePlaceholder: 'e.g. Month',
        xAxisTypeField: 'X-Axis Mode',
        xAxisTypes: {
          band: 'Categories [label, ...]',
          linear: 'Numeric Range (min --> max)',
        },
        xAxisMinField: 'X-Axis Min',
        xAxisMaxField: 'X-Axis Max',
        yAxisTitleField: 'Y-Axis Title',
        yAxisTitlePlaceholder: 'e.g. Amount ($k)',
        yAxisAutoRangeField: 'Auto-fit Y-axis range from data',
        yAxisMinField: 'Y-Axis Min',
        yAxisMaxField: 'Y-Axis Max',
        showDataLabelField: 'Show data labels on bars (showDataLabel)',
        showDataLabelOutsideBarField: 'Place data labels outside bars',
        chartWidthField: 'Chart Width (px)',
        chartHeightField: 'Chart Height (px)',
        categoryColumnHeader: 'X-Axis Category',
        pointColumnHeader: 'Point',
        autoQuoteHint: 'Titles and axis labels are automatically wrapped in double quotes "" so non-ASCII text works safely.',
      },
      architecture: {
        addService: 'Add Service',
        addJunction: 'Add Junction',
        addGroup: 'Add Group',
        addEdge: 'Add Edge',
        defaultServiceTitle: (index) => `Service ${index}`,
        defaultGroupTitle: (index) => `Group ${index}`,
        nodeSection: 'Selected Node',
        edgesSection: 'Edges',
        groupsSection: 'Groups',
        layoutSection: 'Layout & Alignment',
        commentsSection: 'Comments',
        emptyNodes: 'No services or junctions yet. Use the toolbar buttons above to add one.',
        selectNodeHint: 'Click a service or junction on the board to edit its properties.',
        nodeTypeLabel: 'Node Type',
        nodeTypes: {
          service: 'Service (service)',
          junction: 'Junction (junction)',
        },
        nodeTitleLabel: 'Label',
        nodeTitlePlaceholder: 'e.g., Web Server',
        nodeIconLabel: 'Icon Preset',
        customIconLabel: 'Custom Icon (Iconify ID)',
        customIconPlaceholder: 'e.g., logos:aws-ec2 (optional)',
        iconPresets: {
          server: 'Server (server)',
          cloud: 'Cloud (cloud)',
          database: 'Database (database)',
          disk: 'Disk / Storage (disk)',
          internet: 'Internet (internet)',
          unknown: 'Generic (unknown)',
          blank: 'Blank (blank)',
        },
        nodeGroupLabel: 'Group',
        noGroupOption: '(Ungrouped)',
        deleteNode: 'Delete Node',
        emptyEdges: 'No edges defined yet.',
        edgeLhsNode: 'From Node',
        edgeRhsNode: 'To Node',
        edgeSideLabel: 'Port Side',
        edgeSides: {
          L: 'Left (L)',
          R: 'Right (R)',
          T: 'Top (T)',
          B: 'Bottom (B)',
        },
        edgeArrowIntoLhs: 'Arrow into source (<)',
        edgeArrowIntoRhs: 'Arrow into target (>)',
        edgeGroupPort: 'Group boundary ({group})',
        edgeTitleLabel: 'Edge Label',
        edgeTitlePlaceholder: 'e.g., HTTPS / SQL (optional)',
        edgeSameNodeWarning: 'Source and target must be different nodes.',
        edgeSameDirWarning: 'Mermaid forbids matching directions (e.g. L to L); output adjusts automatically.',
        edgeSameGroupPortWarning: '{group} cannot be used inside the same group; skipped on output.',
        deleteEdge: 'Delete Edge',
        emptyGroups: 'No groups defined yet.',
        groupTitleLabel: 'Group Title',
        groupTitlePlaceholder: 'e.g., Cloud Platform',
        groupParentLabel: 'Parent Group',
        noParentOption: '(Top-level group)',
        deleteGroup: 'Delete Group',
        diagramTitleLabel: 'Diagram Title',
        diagramTitlePlaceholder: 'e.g., System Architecture (optional)',
        alignmentsLabel: 'Alignment Hints (align)',
        addAlignment: 'Add Alignment',
        alignDirLabel: 'Direction',
        alignDirs: {
          row: 'Row (row)',
          column: 'Column (column)',
        },
        alignMembersHint: 'Select 2 or more nodes to emit an align directive',
        deleteAlignment: 'Delete',
        paddingLabel: 'Group Padding (padding)',
        iconSizeLabel: 'Icon Size (iconSize)',
        nodeSeparationLabel: 'Node Separation (nodeSeparation)',
        ungroupedTitle: 'Ungrouped Nodes',
        junctionBadge: 'Junction',
        commentsLabel: '%% Comments (one per line)',
        commentsPlaceholder: 'Architecture notes',
      },
      mindmap: {
        addChildBtn: 'Add Child',
        addSiblingBtn: 'Add Sibling',
        indentBtn: 'Indent',
        outdentBtn: 'Outdent',
        moveUpBtn: 'Move Up',
        moveDownBtn: 'Move Down',
        deleteNodeBtn: 'Delete Topic',
        rootBadge: 'Root',
        defaultTopicLabel: (index) => `Topic ${index}`,
        nodeSection: 'Selected Topic',
        settingsSection: 'Layout Settings',
        commentsSection: 'Comments',
        selectNodeHint: 'Select a topic on the left tree to edit its details.',
        labelField: 'Topic Label',
        labelPlaceholder: 'e.g., Feature Planning',
        shapeField: 'Shape',
        shapes: {
          default: 'Default (no border)',
          rounded: 'Rounded (text)',
          rect: 'Rectangle [text]',
          circle: 'Circle ((text))',
          cloud: 'Cloud )text(',
          bang: 'Bang ))text((',
          hexagon: 'Hexagon {{text}}',
        },
        useMarkdownField: 'Enable Markdown text ("`...`")',
        useMarkdownHint: 'Use **bold** or *italic*; switches Default shape to Rounded.',
        iconField: 'Icon (::icon)',
        iconPlaceholder: 'e.g., fa fa-book',
        iconPresetsLabel: 'Quick Icons',
        cssClassField: 'CSS Classes (:::)',
        cssClassPlaceholder: 'e.g., urgent large',
        cssClassPresetsLabel: 'Quick Classes',
        paddingField: 'Node Padding (padding)',
        maxNodeWidthField: 'Max Node Width (maxNodeWidth)',
        commentsField: '%% Comments (one per line)',
        commentsPlaceholder: 'Mindmap notes',
      },
      quadrantChart: {
        addPointBtn: 'Add Point',
        deletePointBtn: 'Delete Selected Point',
        dragHint: 'Drag any point on the grid, or double-click empty space to add a point there.',
        defaultPointLabel: (index) => `Item ${index}`,
        defaultClassName: (index) => `group${index}`,
        pointSection: 'Selected Point',
        quadrantsSection: 'Title, Quadrants & Axes',
        classesSection: 'Style Classes (classDef)',
        settingsSection: 'Chart Size',
        commentsSection: 'Comments',
        emptyPoints: 'No points yet. Click Add Point or double-click the grid.',
        selectPointHint: 'Click a point on the board to edit its position and style.',
        pointLabelField: 'Point Label',
        pointXField: 'X Coordinate (0.00 - 1.00)',
        pointYField: 'Y Coordinate (0.00 - 1.00)',
        pointClassField: 'Class Name (:::)',
        noClassOption: '(None)',
        radiusField: 'Radius (radius)',
        colorField: 'Fill Color (color)',
        strokeColorField: 'Stroke Color (stroke-color)',
        strokeWidthField: 'Stroke Width px (stroke-width)',
        clearStyleBtn: 'Reset Point Overrides',
        titleField: 'Chart Title',
        titlePlaceholder: 'e.g., Priority Matrix',
        q1Field: 'Quadrant 1 Top-Right',
        q2Field: 'Quadrant 2 Top-Left',
        q3Field: 'Quadrant 3 Bottom-Left',
        q4Field: 'Quadrant 4 Bottom-Right',
        xAxisLeftField: 'X-Axis Left',
        xAxisRightField: 'X-Axis Right (optional)',
        yAxisBottomField: 'Y-Axis Bottom',
        yAxisTopField: 'Y-Axis Top (optional)',
        addClassBtn: 'Add Class',
        emptyClasses: 'No class definitions yet.',
        classNameField: 'Class Name',
        chartWidthField: 'Chart Width (chartWidth)',
        chartHeightField: 'Chart Height (chartHeight)',
        commentsField: '%% Comments (one per line)',
        commentsPlaceholder: 'Analysis notes',
      },
      safeguard: {
        syntaxErrorChars: (chars) =>
          `Characters ${formatCharList(chars, 'en')} cannot be used due to Mermaid syntax errors.`,
        urlErrorChars: (chars) =>
          `Spaces and ${formatCharList(chars, 'en')} cannot be used in the URL field.`,
        classNameErrorChars: (chars) =>
          `${formatCharList(chars, 'en')} cannot be used in class names (use A-Z, 0-9, _, -).`,
        kanbanMetaErrorChars: (chars) =>
          `Characters ${formatCharList(chars, 'en')} cannot be used in Kanban metadata fields.`,
        pieLabelErrorChars: (chars) =>
          `Characters ${formatCharList(chars, 'en')} cannot be used in pie chart labels.`,
        xychartTextErrorChars: (chars) =>
          `Characters ${formatCharList(chars, 'en')} cannot be used inside quoted XY chart text.`,
        architectureTitleErrorChars: (chars) =>
          `Characters ${formatCharList(chars, 'en')} cannot be used in architecture titles or [ ] labels.`,
        architectureIconErrorChars: (chars) =>
          `${formatCharList(chars, 'en')} cannot be used in icon names (use A-Z, 0-9, _, :, -).`,
        mindmapLabelErrorChars: (chars) =>
          `Characters ${formatCharList(chars, 'en')} cannot be used in mindmap topic labels.`,
        mindmapIconErrorChars: (chars) =>
          `Characters ${formatCharList(chars, 'en')} cannot be used inside ::icon(...).`,
        mindmapClassErrorChars: (chars) =>
          `${formatCharList(chars, 'en')} cannot be used in mindmap ::: classes (use A-Z, 0-9, space, _, -).`,
        quadrantTextErrorChars: (chars) =>
          `Characters ${formatCharList(chars, 'en')} cannot be used inside quadrant chart text.`,
        quadrantClassErrorChars: (chars) =>
          `${formatCharList(chars, 'en')} cannot be used in quadrant class names (use A-Z, a-z, 0-9 only).`,
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
