import { formatCharList, type InspectorCoreTranslations } from '../types';

export const jaInspectorCore: InspectorCoreTranslations = {
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
    sequenceTextErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字はシーケンス図の文区切り・改行構文と干渉するため使えません`,
    sequenceAliasErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字はparticipantのエイリアス構文と干渉するため使えません`,
    sequenceIdErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}は識別IDに使えません（半角英数字・_・- のみ入力できます）`,
    erEntityIdErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}はエンティティIDに使えません（半角英数字・_・- のみ入力できます）`,
    erQuotedTextErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字はER図の引用符構文・改行と干渉するため使えません`,
    erAttrTypeErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字や空白は属性のデータ型には使えません`,
    erAttrNameErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字や空白は属性名には使えません`,
    classIdErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}はクラスIDに使えません（半角英数字・_・- のみ入力できます）`,
    classGenericErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字はジェネリクス型 ~T~ 構文と干渉するため使えません`,
    classQuotedTextErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字はクラス図の引用符・セミコロン・改行構文と干渉するため使えません`,
    classMemberErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字はメンバー定義・関連ラベル構文と干渉するため使えません`,
    stateIdErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}は状態IDに使えません（半角英数字・_・- のみ入力できます）`,
    stateLabelErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字は状態の引用符ラベル・改行構文と干渉するため使えません`,
    stateTextErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字は状態説明・遷移ラベル・ノート構文と干渉するため使えません`,
    c4IdErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}はC4エイリアスIDに使えません（半角英数字・_・- のみ入力できます）`,
    c4QuotedTextErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字はC4マクロの引用符・改行構文と干渉するため使えません`,
    c4TitleErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字はC4図のタイトル構文と干渉するため使えません`,
    gitBranchErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字や空白はブランチ名に使えません`,
    gitTextErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字はGitグラフの引用符・改行構文と干渉するため使えません`,
    timelineTextErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字はタイムラインの区切り記号（:）やコメント（#）と干渉するため使えません`,
    blockIdErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}はブロックIDに使えません（半角英数字と _ のみ入力できます）`,
    blockTextErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字はブロック図の引用符・改行構文と干渉するため使えません`,
    railroadRuleIdErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}はルール名に使えません（半角英数字・_・- のみ入力できます）`,
    railroadTextErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字はレールロード図の文字列構文と干渉するため使えません`,
    ishikawaTextErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}は1行1項目構文のため入力できません`,
    journeyTextErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字はジャーニー図の区切り記号（:）・コメント構文と干渉するため使えません`,
    journeyActorErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字はアクター名の区切り記号と干渉するため使えません`,
    treemapTextErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字はツリーマップの引用符・改行構文と干渉するため使えません`,
    treemapClassErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}はクラス名に使えません（半角英数字と _ のみ入力できます）`,
    vennIdErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}は集合IDに使えません（半角英数字・_・- のみ入力できます）`,
    vennTextErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字はベン図のラベル構文と干渉するため使えません`,
    wardleyTextErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字はウォードリーマップの引用符構文と干渉するため使えません`,
    cynefinTextErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字はクネビン図の引用符構文と干渉するため使えません`,
    requirementTextErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字は要件図の引用符構文・改行と干渉するため使えません`,
    packetTextErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字はパケット図のラベル引用符構文と干渉するため使えません`,
    eventModelingIdErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}は識別子に使えません（半角英数字と _ のみ入力できます）`,
    eventModelingTextErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字はイベントモデリング図のブロック構文と干渉するため使えません`,
    sankeyLabelErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}はサンキー図の項目名に使えません（Mermaid仕様上、半角ASCII文字のみ対応しています）`,
    radarIdErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}はIDに使えません（半角英数字・_・- のみ入力できます）`,
    radarTextErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字はレーダーチャートのラベル引用符構文と干渉するため使えません`,
    infoTextErrorChars: (chars) =>
      `${formatCharList(chars, 'ja')}の文字はinfo図のメタデータ構文と干渉するため使えません`,
  },
};
