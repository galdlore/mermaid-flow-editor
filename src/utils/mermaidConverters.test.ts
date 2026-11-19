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

test('all 15 Mermaid diagram converters round-trip defaults with and without @gui-state', () => {
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
});

test('detectMermaidDiagramType recognizes swimlane-beta header without @gui-state', () => {
  assert.equal(detectMermaidDiagramType('swimlane-beta\n  lane A'), 'swimlane');
});
