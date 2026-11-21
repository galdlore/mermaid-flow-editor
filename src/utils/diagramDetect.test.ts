import test from 'node:test';
import assert from 'node:assert/strict';
import type { MermaidDiagramType } from '../types/editor.ts';
import { detectMermaidDiagramType } from './diagramDetect.ts';

test('detectMermaidDiagramType identifies all 31 plain-text diagram headers including frontmatter and comment skipping', () => {
  const plainCases: Array<{ code: string; expected: MermaidDiagramType }> = [
    { code: 'flowchart TD\n  A --> B', expected: 'flowchart' },
    { code: 'graph LR\n  A --> B', expected: 'flowchart' },
    { code: 'swimlane-beta\n  lane A', expected: 'swimlane' },
    { code: 'treeView-beta\n  "root"', expected: 'treeView' },
    { code: 'gantt\n  title Plan', expected: 'gantt' },
    { code: 'kanban\n  col1[Todo]', expected: 'kanban' },
    { code: 'pie\n  "A" : 10', expected: 'pie' },
    { code: 'xychart-beta\n  x-axis [a, b]', expected: 'xychart' },
    { code: 'architecture-beta\n  service api[API]', expected: 'architecture' },
    { code: 'mindmap\n  root((Root))', expected: 'mindmap' },
    { code: 'quadrantChart\n  x-axis Low --> High', expected: 'quadrantChart' },
    { code: 'sequenceDiagram\n  A->>B: Hi', expected: 'sequence' },
    { code: 'erDiagram\n  USER ||--o{ ORDER : places', expected: 'er' },
    { code: 'classDiagram\n  class User', expected: 'class' },
    { code: 'stateDiagram-v2\n  [*] --> Idle', expected: 'state' },
    { code: 'C4Context\n  Person(u, "User")', expected: 'c4' },
    { code: 'gitGraph\n  commit', expected: 'gitGraph' },
    { code: 'timeline\n  2026 : Launch', expected: 'timeline' },
    { code: 'block-beta\n  a["A"]', expected: 'block' },
    { code: 'railroad-beta\n  rule: "x"', expected: 'railroad' },
    { code: 'railroad-ebnf-beta\n  rule = "x";', expected: 'railroad' },
    { code: 'railroad-abnf-beta\n  rule = "x"', expected: 'railroad' },
    { code: 'railroad-peg-beta\n  rule <- "x"', expected: 'railroad' },
    { code: 'ishikawa-beta\n  Problem', expected: 'ishikawa' },
    { code: 'journey\n  section S\n    Task: 5: Me', expected: 'journey' },
    { code: 'treemap-beta\n  "Root"', expected: 'treemap' },
    { code: 'treemap\n  "Root": 10', expected: 'treemap' },
    { code: 'venn-beta\n  set A:10', expected: 'venn' },
    { code: 'wardley-beta\n  anchor "U" [0.90, 0.50]', expected: 'wardley' },
    { code: 'cynefin-beta\n  complex\n    "Experiment"', expected: 'cynefin' },
    { code: 'requirementDiagram\n  requirement R1 {\n    id: "1"\n  }', expected: 'requirement' },
    { code: 'requirement\n  requirement R1 {\n    id: "1"\n  }', expected: 'requirement' },
    { code: 'packet-beta\n  0-7: "Header"', expected: 'packet' },
    { code: 'packet\n  0-7: "Header"', expected: 'packet' },
    { code: 'eventmodeling\n  tf 01 ui User.Form', expected: 'eventmodeling' },
    { code: 'sankey-beta\n  A,B,10', expected: 'sankey' },
    { code: 'sankey\n  A,B,10', expected: 'sankey' },
    { code: 'radar-beta\n  axis a["A"], b["B"], c["C"]', expected: 'radar' },
    { code: 'info\n  showInfo', expected: 'info' },
  ];

  for (const { code, expected } of plainCases) {
    assert.equal(detectMermaidDiagramType(code), expected, `plain: ${code}`);
    const wrapped = `---\ntitle: Sample\n---\n%% comment\n\n${code}`;
    assert.equal(detectMermaidDiagramType(wrapped), expected, `frontmatter: ${expected}`);
  }
});

test('detectMermaidDiagramType identifies @gui-state envelopes and falls back cleanly on malformed JSON', () => {
  const guiCases: Array<{ json: Record<string, unknown>; expected: MermaidDiagramType }> = [
    { json: { diagramType: 'treeView', nodes: [] }, expected: 'treeView' },
    { json: { diagramType: 'gantt', tasks: [] }, expected: 'gantt' },
    { json: { diagramType: 'kanban', columns: [] }, expected: 'kanban' },
    { json: { diagramType: 'pie', slices: [] }, expected: 'pie' },
    { json: { diagramType: 'xychart', series: [] }, expected: 'xychart' },
    { json: { diagramType: 'architecture', nodes: [] }, expected: 'architecture' },
    { json: { diagramType: 'mindmap', nodes: [] }, expected: 'mindmap' },
    { json: { diagramType: 'quadrantChart', points: [] }, expected: 'quadrantChart' },
    { json: { diagramType: 'sequence', participants: [], steps: [] }, expected: 'sequence' },
    { json: { diagramType: 'er', entities: [], relationships: [] }, expected: 'er' },
    { json: { diagramType: 'class', classes: [], relations: [] }, expected: 'class' },
    { json: { diagramType: 'state', states: [], transitions: [] }, expected: 'state' },
    { json: { diagramType: 'c4', elements: [], boundaries: [], relations: [] }, expected: 'c4' },
    { json: { diagramType: 'gitGraph', operations: [] }, expected: 'gitGraph' },
    { json: { diagramType: 'timeline', periods: [] }, expected: 'timeline' },
    { json: { diagramType: 'block', items: [] }, expected: 'block' },
    { json: { diagramType: 'railroad', rules: [] }, expected: 'railroad' },
    { json: { diagramType: 'ishikawa', nodes: [] }, expected: 'ishikawa' },
    { json: { diagramType: 'journey', tasks: [] }, expected: 'journey' },
    { json: { diagramType: 'treemap', nodes: [] }, expected: 'treemap' },
    { json: { diagramType: 'venn', sets: [] }, expected: 'venn' },
    { json: { diagramType: 'wardley', components: [] }, expected: 'wardley' },
    { json: { diagramType: 'cynefin', items: [] }, expected: 'cynefin' },
    { json: { diagramType: 'requirement', requirements: [], elements: [], relations: [] }, expected: 'requirement' },
    { json: { diagramType: 'packet', blocks: [] }, expected: 'packet' },
    { json: { diagramType: 'eventmodeling', frames: [] }, expected: 'eventmodeling' },
    { json: { diagramType: 'sankey', links: [] }, expected: 'sankey' },
    { json: { diagramType: 'radar', axes: [], curves: [] }, expected: 'radar' },
    { json: { diagramType: 'info', showInfo: true }, expected: 'info' },
    { json: { diagramType: 'swimlane', nodes: [], edges: [] }, expected: 'swimlane' },
  ];

  for (const { json, expected } of guiCases) {
    const code = `flowchart TD\n%% @gui-state: ${JSON.stringify(json)}`;
    assert.equal(detectMermaidDiagramType(code), expected, `gui-state: ${expected}`);
  }

  assert.equal(
    detectMermaidDiagramType('%% @gui-state: {not-valid-json}\nkanban\n  col1[A]'),
    'kanban'
  );
  assert.equal(detectMermaidDiagramType('unknownDiagram\n  foo'), 'flowchart');
  assert.equal(detectMermaidDiagramType(''), 'flowchart');
});
