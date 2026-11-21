import { formatCharList, type InspectorCoreTranslations } from '../types';

export const enInspectorCore: InspectorCoreTranslations = {
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
    sequenceTextErrorChars: (chars) =>
      `Characters ${formatCharList(chars, 'en')} cannot be used inside sequence diagram text.`,
    sequenceAliasErrorChars: (chars) =>
      `Characters ${formatCharList(chars, 'en')} cannot be used in participant aliases.`,
    sequenceIdErrorChars: (chars) =>
      `${formatCharList(chars, 'en')} cannot be used in participant IDs (use A-Z, 0-9, _, -).`,
    erEntityIdErrorChars: (chars) =>
      `${formatCharList(chars, 'en')} cannot be used in entity IDs (use A-Z, 0-9, _, -).`,
    erQuotedTextErrorChars: (chars) =>
      `Characters ${formatCharList(chars, 'en')} cannot be used inside quoted ER diagram text.`,
    erAttrTypeErrorChars: (chars) =>
      `Spaces and ${formatCharList(chars, 'en')} cannot be used in attribute types.`,
    erAttrNameErrorChars: (chars) =>
      `Spaces and ${formatCharList(chars, 'en')} cannot be used in attribute names.`,
    classIdErrorChars: (chars) =>
      `${formatCharList(chars, 'en')} cannot be used in class IDs (use A-Z, 0-9, _, -).`,
    classGenericErrorChars: (chars) =>
      `Characters ${formatCharList(chars, 'en')} cannot be used in generic parameters ~T~.`,
    classQuotedTextErrorChars: (chars) =>
      `Characters ${formatCharList(chars, 'en')} cannot be used inside quoted class diagram text.`,
    classMemberErrorChars: (chars) =>
      `Characters ${formatCharList(chars, 'en')} cannot be used inside member signatures or relation labels.`,
    stateIdErrorChars: (chars) =>
      `${formatCharList(chars, 'en')} cannot be used in state IDs (use A-Z, 0-9, _, -).`,
    stateLabelErrorChars: (chars) =>
      `Characters ${formatCharList(chars, 'en')} cannot be used in quoted state labels.`,
    stateTextErrorChars: (chars) =>
      `Characters ${formatCharList(chars, 'en')} cannot be used in state descriptions, transition labels, or notes.`,
    c4IdErrorChars: (chars) =>
      `${formatCharList(chars, 'en')} cannot be used in C4 alias IDs (use A-Z, 0-9, _, -).`,
    c4QuotedTextErrorChars: (chars) =>
      `Characters ${formatCharList(chars, 'en')} cannot be used inside quoted C4 macro fields.`,
    c4TitleErrorChars: (chars) =>
      `Characters ${formatCharList(chars, 'en')} cannot be used inside C4 diagram titles.`,
    gitBranchErrorChars: (chars) =>
      `Spaces and ${formatCharList(chars, 'en')} cannot be used in branch names.`,
    gitTextErrorChars: (chars) =>
      `Characters ${formatCharList(chars, 'en')} cannot be used in Git graph quoted fields.`,
    timelineTextErrorChars: (chars) =>
      `Characters ${formatCharList(chars, 'en')} cannot be used in timeline text (reserved for ":" separators and "#" comments).`,
    blockIdErrorChars: (chars) =>
      `${formatCharList(chars, 'en')} cannot be used in block IDs (use A-Z, 0-9, _).`,
    blockTextErrorChars: (chars) =>
      `Characters ${formatCharList(chars, 'en')} cannot be used inside block labels.`,
    railroadRuleIdErrorChars: (chars) =>
      `${formatCharList(chars, 'en')} cannot be used in railroad rule names (use A-Z, 0-9, _, -).`,
    railroadTextErrorChars: (chars) =>
      `Characters ${formatCharList(chars, 'en')} cannot be used inside railroad string values.`,
    ishikawaTextErrorChars: (chars) =>
      `Characters ${formatCharList(chars, 'en')} cannot be used inside single-line Ishikawa items.`,
    journeyTextErrorChars: (chars) =>
      `Characters ${formatCharList(chars, 'en')} cannot be used inside journey task or section labels.`,
    journeyActorErrorChars: (chars) =>
      `Characters ${formatCharList(chars, 'en')} cannot be used inside individual actor names.`,
    treemapTextErrorChars: (chars) =>
      `Characters ${formatCharList(chars, 'en')} cannot be used inside treemap quoted labels.`,
    treemapClassErrorChars: (chars) =>
      `${formatCharList(chars, 'en')} cannot be used in treemap class names (use A-Z, 0-9, _).`,
    vennIdErrorChars: (chars) =>
      `${formatCharList(chars, 'en')} cannot be used in set IDs (use A-Z, 0-9, _, -).`,
    vennTextErrorChars: (chars) =>
      `Characters ${formatCharList(chars, 'en')} cannot be used inside Venn label syntax.`,
    wardleyTextErrorChars: (chars) =>
      `Characters ${formatCharList(chars, 'en')} cannot be used inside Wardley quoted strings.`,
    cynefinTextErrorChars: (chars) =>
      `Characters ${formatCharList(chars, 'en')} cannot be used inside Cynefin quoted strings.`,
    requirementTextErrorChars: (chars) =>
      `Characters ${formatCharList(chars, 'en')} cannot be used inside requirement diagram quoted strings.`,
    packetTextErrorChars: (chars) =>
      `Characters ${formatCharList(chars, 'en')} cannot be used inside packet field labels.`,
    eventModelingIdErrorChars: (chars) =>
      `${formatCharList(chars, 'en')} cannot be used in identifiers (use A-Z, 0-9, _).`,
    eventModelingTextErrorChars: (chars) =>
      `Characters ${formatCharList(chars, 'en')} cannot be used inside Event Modeling inline data or braces.`,
    sankeyLabelErrorChars: (chars) =>
      `Characters ${formatCharList(chars, 'en')} cannot be used in Sankey node names (Mermaid Sankey supports printable ASCII only).`,
    radarIdErrorChars: (chars) =>
      `${formatCharList(chars, 'en')} cannot be used in radar IDs (use A-Z, 0-9, _, -).`,
    radarTextErrorChars: (chars) =>
      `Characters ${formatCharList(chars, 'en')} cannot be used inside radar chart labels.`,
    infoTextErrorChars: (chars) =>
      `Characters ${formatCharList(chars, 'en')} cannot be used inside info title/accessibility fields.`,
  },
};
