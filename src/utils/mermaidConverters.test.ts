import test from 'node:test';
import assert from 'node:assert/strict';
import type { MermaidDiagramType } from '../types/editor.ts';
import {
  createDefaultDiagramData,
  createDefaultSwimlaneData,
  detectMermaidDiagramType,
  generateMermaidCode,
  parseMermaidCodeToGuiData,
} from './mermaidConverter.ts';
import {
  createDefaultTreeViewData,
  generateTreeViewCode,
  parseTreeViewCodeToGuiData,
} from './treeViewConverter.ts';
import {
  createDefaultGanttData,
  generateGanttCode,
  parseGanttCodeToGuiData,
} from './ganttConverter.ts';
import {
  createDefaultKanbanData,
  generateKanbanCode,
  parseKanbanCodeToGuiData,
} from './kanbanConverter.ts';
import {
  createDefaultPieData,
  generatePieCode,
  parsePieCodeToGuiData,
} from './pieConverter.ts';
import {
  createDefaultXYChartData,
  generateXYChartCode,
  parseXYChartCodeToGuiData,
} from './xychartConverter.ts';
import {
  createDefaultArchitectureData,
  generateArchitectureCode,
  parseArchitectureCodeToGuiData,
} from './architectureConverter.ts';
import {
  createDefaultMindmapData,
  generateMindmapCode,
  parseMindmapCodeToGuiData,
} from './mindmapConverter.ts';
import {
  createDefaultQuadrantData,
  generateQuadrantCode,
  parseQuadrantCodeToGuiData,
} from './quadrantConverter.ts';
import {
  createDefaultSequenceData,
  generateSequenceCode,
  parseSequenceCodeToGuiData,
} from './sequenceConverter.ts';
import {
  createDefaultClassData,
  generateClassCode,
  parseClassCodeToGuiData,
} from './classConverter.ts';
import {
  createDefaultStateData,
  generateStateCode,
  parseStateCodeToGuiData,
} from './stateConverter.ts';
import {
  createDefaultErData,
  generateErCode,
  parseErCodeToGuiData,
} from './erConverter.ts';
import {
  createDefaultC4Data,
  generateC4Code,
  parseC4CodeToGuiData,
} from './c4Converter.ts';
import {
  createDefaultGitGraphData,
  generateGitGraphCode,
  parseGitGraphCodeToGuiData,
  simulateGitGraphState,
} from './gitGraphConverter.ts';
import {
  createDefaultTimelineData,
  generateTimelineCode,
  parseTimelineCodeToGuiData,
} from './timelineConverter.ts';
import {
  createDefaultBlockData,
  generateBlockCode,
  parseBlockCodeToGuiData,
  sanitizeBlockId,
} from './blockConverter.ts';
import {
  createDefaultRailroadData,
  generateRailroadCode,
  parseRailroadCodeToGuiData,
} from './railroadConverter.ts';
import {
  createDefaultIshikawaData,
  generateIshikawaCode,
  parseIshikawaCodeToGuiData,
} from './ishikawaConverter.ts';
import {
  createDefaultJourneyData,
  generateJourneyCode,
  parseJourneyCodeToGuiData,
} from './journeyConverter.ts';
import {
  createDefaultTreemapData,
  generateTreemapCode,
  parseTreemapCodeToGuiData,
} from './treemapConverter.ts';
import {
  createDefaultVennData,
  generateVennCode,
  parseVennCodeToGuiData,
} from './vennConverter.ts';
import {
  createDefaultWardleyData,
  generateWardleyCode,
  parseWardleyCodeToGuiData,
} from './wardleyConverter.ts';
import {
  createDefaultCynefinData,
  generateCynefinCode,
  parseCynefinCodeToGuiData,
} from './cynefinConverter.ts';
import {
  createDefaultRequirementData,
  generateRequirementCode,
  parseRequirementCodeToGuiData,
} from './requirementConverter.ts';
import {
  createDefaultPacketData,
  generatePacketCode,
  parsePacketCodeToGuiData,
} from './packetConverter.ts';
import {
  createDefaultEventModelingData,
  generateEventModelingCode,
  parseEventModelingCodeToGuiData,
} from './eventModelingConverter.ts';
import {
  createDefaultSankeyData,
  generateSankeyCode,
  parseSankeyCodeToGuiData,
} from './sankeyConverter.ts';
import {
  createDefaultRadarData,
  generateRadarCode,
  parseRadarCodeToGuiData,
} from './radarConverter.ts';
import {
  createDefaultInfoData,
  generateInfoCode,
  parseInfoCodeToGuiData,
} from './infoConverter.ts';
import { GUI_STATE_PREFIX } from './mermaidEnvelope.ts';

interface ConverterCase<T> {
  type: MermaidDiagramType;
  expectedPlainType?: MermaidDiagramType;
  createDefault: (lang: 'ja' | 'en') => T;
  generate: (data: T) => string;
  parse: (code: string) => T;
  assertPopulated: (data: T, stage: string) => void;
}

function stripGuiStateLines(code: string): string {
  return code
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith(GUI_STATE_PREFIX))
    .join('\n');
}

function runConverterCase<T>(spec: ConverterCase<T>): void {
  for (const lang of ['ja', 'en'] as const) {
    const initial = spec.createDefault(lang);
    spec.assertPopulated(initial, `${spec.type}(${lang}) initial`);

    const generated = spec.generate(initial);
    assert.ok(generated.trim().length > 0, `${spec.type}(${lang}) generated code should be non-empty`);
    assert.equal(
      detectMermaidDiagramType(generated),
      spec.type,
      `${spec.type}(${lang}) detected type mismatch with @gui-state`
    );

    const reparsedWithState = spec.parse(generated);
    spec.assertPopulated(reparsedWithState, `${spec.type}(${lang}) reparsed with @gui-state`);

    const plainCode = stripGuiStateLines(generated);
    const expectedPlain = spec.expectedPlainType ?? spec.type;
    assert.equal(
      detectMermaidDiagramType(plainCode),
      expectedPlain,
      `${spec.type}(${lang}) detected type mismatch without @gui-state`
    );

    const reparsedPlain = spec.parse(plainCode);
    spec.assertPopulated(reparsedPlain, `${spec.type}(${lang}) reparsed plain`);

    const regeneratedPlain = spec.generate(reparsedPlain);
    assert.ok(regeneratedPlain.trim().length > 0, `${spec.type}(${lang}) regenerated plain non-empty`);
  }
}

test('all 31 Mermaid diagram converters round-trip defaults with and without @gui-state', () => {
  runConverterCase({
    type: 'flowchart',
    createDefault: createDefaultDiagramData,
    generate: generateMermaidCode,
    parse: parseMermaidCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.nodes.length >= 2, `${stage}: nodes`);
      assert.ok(d.edges.length >= 1, `${stage}: edges`);
    },
  });

  runConverterCase({
    type: 'swimlane',
    createDefault: createDefaultSwimlaneData,
    generate: generateMermaidCode,
    parse: parseMermaidCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.nodes.length >= 2, `${stage}: nodes`);
      assert.ok((d.subgraphs?.length ?? 0) >= 2, `${stage}: subgraphs`);
    },
  });

  runConverterCase({
    type: 'treeView',
    createDefault: createDefaultTreeViewData,
    generate: generateTreeViewCode,
    parse: parseTreeViewCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.nodes.length >= 2, `${stage}: nodes`);
    },
  });

  runConverterCase({
    type: 'gantt',
    createDefault: createDefaultGanttData,
    generate: generateGanttCode,
    parse: parseGanttCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.tasks.length >= 2, `${stage}: tasks`);
    },
  });

  runConverterCase({
    type: 'kanban',
    createDefault: createDefaultKanbanData,
    generate: generateKanbanCode,
    parse: parseKanbanCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.columns.length >= 2, `${stage}: columns`);
      assert.ok(d.cards.length >= 2, `${stage}: cards`);
    },
  });

  runConverterCase({
    type: 'pie',
    createDefault: createDefaultPieData,
    generate: generatePieCode,
    parse: parsePieCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.slices.length >= 2, `${stage}: slices`);
    },
  });

  runConverterCase({
    type: 'xychart',
    createDefault: createDefaultXYChartData,
    generate: generateXYChartCode,
    parse: parseXYChartCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.series.length >= 1, `${stage}: series`);
    },
  });

  runConverterCase({
    type: 'architecture',
    createDefault: createDefaultArchitectureData,
    generate: generateArchitectureCode,
    parse: parseArchitectureCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.nodes.length >= 2, `${stage}: nodes`);
      assert.ok(d.edges.length >= 1, `${stage}: edges`);
    },
  });

  runConverterCase({
    type: 'mindmap',
    createDefault: createDefaultMindmapData,
    generate: generateMindmapCode,
    parse: parseMindmapCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.nodes.length >= 2, `${stage}: nodes`);
    },
  });

  runConverterCase({
    type: 'quadrantChart',
    createDefault: createDefaultQuadrantData,
    generate: generateQuadrantCode,
    parse: parseQuadrantCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.points.length >= 2, `${stage}: points`);
    },
  });

  runConverterCase({
    type: 'sequence',
    createDefault: createDefaultSequenceData,
    generate: generateSequenceCode,
    parse: parseSequenceCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.participants.length >= 2, `${stage}: participants`);
      assert.ok(d.steps.length >= 1, `${stage}: steps`);
    },
  });

  runConverterCase({
    type: 'class',
    createDefault: createDefaultClassData,
    generate: generateClassCode,
    parse: parseClassCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.classes.length >= 2, `${stage}: classes`);
      assert.ok(d.relations.length >= 1, `${stage}: relations`);
    },
  });

  runConverterCase({
    type: 'state',
    createDefault: createDefaultStateData,
    generate: generateStateCode,
    parse: parseStateCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.states.length >= 2, `${stage}: states`);
      assert.ok(d.transitions.length >= 1, `${stage}: transitions`);
    },
  });

  runConverterCase({
    type: 'er',
    createDefault: createDefaultErData,
    generate: generateErCode,
    parse: parseErCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.entities.length >= 2, `${stage}: entities`);
      assert.ok(d.relationships.length >= 1, `${stage}: relationships`);
    },
  });

  runConverterCase({
    type: 'c4',
    createDefault: createDefaultC4Data,
    generate: generateC4Code,
    parse: parseC4CodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.elements.length >= 2, `${stage}: elements`);
      assert.ok(d.relations.length >= 1, `${stage}: relations`);
    },
  });

  runConverterCase({
    type: 'gitGraph',
    createDefault: createDefaultGitGraphData,
    generate: generateGitGraphCode,
    parse: parseGitGraphCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.operations.length >= 4, `${stage}: operations`);
    },
  });

  runConverterCase({
    type: 'timeline',
    createDefault: createDefaultTimelineData,
    generate: generateTimelineCode,
    parse: parseTimelineCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.sections.length >= 2, `${stage}: sections`);
      assert.ok(d.periods.length >= 2, `${stage}: periods`);
    },
  });

  runConverterCase({
    type: 'block',
    createDefault: createDefaultBlockData,
    generate: generateBlockCode,
    parse: parseBlockCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.items.length >= 4, `${stage}: items`);
      assert.ok(d.edges.length >= 1, `${stage}: edges`);
    },
  });

  runConverterCase({
    type: 'railroad',
    createDefault: createDefaultRailroadData,
    generate: generateRailroadCode,
    parse: parseRailroadCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.rules.length >= 2, `${stage}: rules`);
    },
  });

  runConverterCase({
    type: 'ishikawa',
    createDefault: createDefaultIshikawaData,
    generate: generateIshikawaCode,
    parse: parseIshikawaCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.nodes.length >= 5, `${stage}: nodes`);
    },
  });

  runConverterCase({
    type: 'journey',
    createDefault: createDefaultJourneyData,
    generate: generateJourneyCode,
    parse: parseJourneyCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.sections.length >= 1, `${stage}: sections`);
      assert.ok(d.tasks.length >= 2, `${stage}: tasks`);
    },
  });

  runConverterCase({
    type: 'treemap',
    createDefault: createDefaultTreemapData,
    generate: generateTreemapCode,
    parse: parseTreemapCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.nodes.length >= 3, `${stage}: nodes`);
    },
  });

  runConverterCase({
    type: 'venn',
    createDefault: createDefaultVennData,
    generate: generateVennCode,
    parse: parseVennCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.sets.length >= 2, `${stage}: sets`);
    },
  });

  runConverterCase({
    type: 'wardley',
    createDefault: createDefaultWardleyData,
    generate: generateWardleyCode,
    parse: parseWardleyCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.anchors.length >= 1, `${stage}: anchors`);
      assert.ok(d.components.length >= 2, `${stage}: components`);
      assert.ok(d.links.length >= 1, `${stage}: links`);
    },
  });

  runConverterCase({
    type: 'cynefin',
    createDefault: createDefaultCynefinData,
    generate: generateCynefinCode,
    parse: parseCynefinCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.items.length >= 2, `${stage}: items`);
    },
  });

  runConverterCase({
    type: 'requirement',
    createDefault: createDefaultRequirementData,
    generate: generateRequirementCode,
    parse: parseRequirementCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.requirements.length >= 2, `${stage}: requirements`);
      assert.ok(d.elements.length >= 1, `${stage}: elements`);
      assert.ok(d.relations.length >= 1, `${stage}: relations`);
    },
  });

  runConverterCase({
    type: 'packet',
    createDefault: createDefaultPacketData,
    generate: generatePacketCode,
    parse: parsePacketCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.blocks.length >= 3, `${stage}: blocks`);
    },
  });

  runConverterCase({
    type: 'eventmodeling',
    createDefault: createDefaultEventModelingData,
    generate: generateEventModelingCode,
    parse: parseEventModelingCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.frames.length >= 4, `${stage}: frames`);
    },
  });

  runConverterCase({
    type: 'sankey',
    createDefault: createDefaultSankeyData,
    generate: generateSankeyCode,
    parse: parseSankeyCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.links.length >= 3, `${stage}: links`);
    },
  });

  runConverterCase({
    type: 'radar',
    createDefault: createDefaultRadarData,
    generate: generateRadarCode,
    parse: parseRadarCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.ok(d.axes.length >= 3, `${stage}: axes`);
      assert.ok(d.curves.length >= 1, `${stage}: curves`);
    },
  });

  runConverterCase({
    type: 'info',
    createDefault: createDefaultInfoData,
    generate: generateInfoCode,
    parse: parseInfoCodeToGuiData,
    assertPopulated: (d, stage) => {
      assert.equal(d.diagramType, 'info', `${stage}: info`);
      assert.equal(typeof d.showInfo, 'boolean', `${stage}: showInfo`);
    },
  });
});

test('detectMermaidDiagramType recognizes swimlane-beta header without @gui-state', () => {
  assert.equal(detectMermaidDiagramType('swimlane-beta\n  lane A'), 'swimlane');
});

test('gitGraphConverter parses plain-text orientation, init config, switch, merge, cherry-pick and simulates branch state', () => {
  const plain = `%%{init: {"gitGraph": {"mainBranchName": "trunk", "showBranches": false}}}%%
gitGraph TB:
  title Release Flow
  %% comment line
  commit id: "c1"
  branch feature order: 2
  commit id: "c2" type: HIGHLIGHT tag: "v0.1"
  switch trunk
  commit id: "c3"
  merge feature id: "m1" tag: "v1.0"
  cherry-pick id: "c2" parent: "c1" tag: "pick"`;

  assert.equal(detectMermaidDiagramType(plain), 'gitGraph');
  const parsed = parseGitGraphCodeToGuiData(plain);
  assert.equal(parsed.orientation, 'TB');
  assert.equal(parsed.title, 'Release Flow');
  assert.equal(parsed.mainBranchName, 'trunk');
  assert.equal(parsed.showBranches, false);
  assert.equal(parsed.operations.length, 7);
  assert.equal(parsed.operations[1]?.order, 2);
  assert.equal(parsed.operations[3]?.kind, 'checkout');
  assert.equal(parsed.operations[6]?.kind, 'cherry-pick');
  assert.equal(parsed.operations[6]?.parent, 'c1');

  const sim = simulateGitGraphState(parsed);
  assert.deepEqual(sim.allBranches, ['trunk', 'feature']);
  assert.equal(sim.steps[2]?.activeBranch, 'feature');
  assert.equal(sim.steps[3]?.activeBranch, 'trunk');
  assert.equal(sim.steps[5]?.warning, undefined);

  const regen = generateGitGraphCode(parsed);
  assert.match(regen, /gitGraph TB:/);
  assert.match(regen, /%%\{init:/);
});

test('timelineConverter parses plain-text TD direction, multi-event continuation lines, and sanitizes colons/hashes', () => {
  const plain = `timeline TD
  title Product: History #1
  section Phase 1
    2024 Q1 : Kickoff : Prototype
      : Alpha test
    2024 Q2 : Beta`;

  assert.equal(detectMermaidDiagramType(plain), 'timeline');
  const parsed = parseTimelineCodeToGuiData(plain);
  assert.equal(parsed.direction, 'TD');
  assert.equal(parsed.title, 'Product History 1');
  assert.equal(parsed.sections.length, 1);
  assert.equal(parsed.periods.length, 2);
  assert.deepEqual(parsed.periods[0]?.events, ['Kickoff', 'Prototype', 'Alpha test']);
});

test('blockConverter parses columns, spans, spaces, nested blocks, arrows, edges, styles, and protects reserved IDs', () => {
  assert.equal(sanitizeBlockId('end'), 'blk_end');
  assert.equal(sanitizeBlockId('123abc'), 'blk_123abc');

  const plain = `block-beta
  columns 3
  a["Web"]:2 b[("DB")]
  space:2
  block:grp1:2
    columns 2
    c("API")
    d(("Cache"))
  end
  arr<["Sync"]>(right)
  a -- "HTTPS" --> c
  c <--> d
  style a fill:#eff6ff,stroke:#2563eb`;

  assert.equal(detectMermaidDiagramType(plain), 'block');
  const parsed = parseBlockCodeToGuiData(plain);
  assert.equal(parsed.columns, 3);
  const aItem = parsed.items.find((i) => i.id === 'a');
  assert.equal(aItem?.span, 2);
  assert.equal(aItem?.fill, '#eff6ff');
  assert.equal(aItem?.stroke, '#2563eb');
  const cItem = parsed.items.find((i) => i.id === 'c');
  assert.equal(cItem?.parentGroupId, 'grp1');
  assert.equal(cItem?.shape, 'round');
  const arrItem = parsed.items.find((i) => i.id === 'arr');
  assert.equal(arrItem?.kind, 'arrow');
  assert.equal(arrItem?.arrowDirection, 'right');
  assert.equal(parsed.edges.length, 2);
  assert.equal(parsed.edges[0]?.label, 'HTTPS');
  assert.equal(parsed.edges[1]?.lineType, 'bidirectional');
});

test('railroadConverter supports all 4 dialects for detection, generation, and plain-text parsing', () => {
  const base = createDefaultRailroadData('en');
  for (const syntax of [
    'railroad-beta',
    'railroad-ebnf-beta',
    'railroad-abnf-beta',
    'railroad-peg-beta',
  ] as const) {
    const code = generateRailroadCode({ ...base, syntax });
    const plain = stripGuiStateLines(code);
    assert.equal(detectMermaidDiagramType(plain), 'railroad', `detect ${syntax}`);
    const reparsed = parseRailroadCodeToGuiData(plain);
    assert.equal(reparsed.syntax, syntax, `syntax ${syntax}`);
    assert.equal(reparsed.rules.length, 2, `rules count ${syntax}`);
    assert.equal(reparsed.rules[0]?.name, 'Expr');
    assert.equal(reparsed.rules[1]?.name, 'Term');
  }
});

test('ishikawaConverter parses indented plain-text hierarchy and strips %% prefixes', () => {
  const plain = `ishikawa-beta
%% analysis note
Defect Spike
    People
        Training gap
    Machine
        Wear`;

  assert.equal(detectMermaidDiagramType(plain), 'ishikawa');
  const parsed = parseIshikawaCodeToGuiData(plain);
  assert.equal(parsed.nodes.length, 5);
  assert.equal(parsed.nodes[0]?.depth, 0);
  assert.equal(parsed.nodes[0]?.label, 'Defect Spike');
  assert.equal(parsed.nodes[1]?.depth, 1);
  assert.equal(parsed.nodes[2]?.depth, 2);
  assert.deepEqual(parsed.comments, ['analysis note']);

  const withPercent = generateIshikawaCode({
    diagramType: 'ishikawa',
    nodes: [
      { id: 'r', depth: 0, label: '%%BadHead' },
      { id: 'c', depth: 5, label: 'Deep' },
    ],
  });
  const reparsed = parseIshikawaCodeToGuiData(stripGuiStateLines(withPercent));
  assert.equal(reparsed.nodes[0]?.label, 'BadHead');
  assert.equal(reparsed.nodes[1]?.depth, 1);
});
