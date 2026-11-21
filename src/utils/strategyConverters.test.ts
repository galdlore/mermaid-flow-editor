import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampJourneyScore,
  createDefaultJourneyData,
  generateJourneyCode,
  parseJourneyCodeToGuiData,
} from './journeyConverter.ts';
import {
  addTreemapChildNode,
  createDefaultTreemapData,
  generateTreemapCode,
  indentTreemapNode,
  normalizeTreemapNodes,
  parseTreemapCodeToGuiData,
} from './treemapConverter.ts';
import {
  createDefaultVennData,
  generateVennCode,
  normalizeVennData,
  parseVennCodeToGuiData,
} from './vennConverter.ts';
import {
  clampWardleyCoord,
  createDefaultWardleyData,
  generateWardleyCode,
  parseWardleyCodeToGuiData,
} from './wardleyConverter.ts';
import {
  createDefaultCynefinData,
  generateCynefinCode,
  parseCynefinCodeToGuiData,
} from './cynefinConverter.ts';

test('journeyConverter round-trips @gui-state and plain text while clamping scores to 1..5', () => {
  const def = createDefaultJourneyData('ja');
  const code = generateJourneyCode(def);
  const parsedGui = parseJourneyCodeToGuiData(code);
  assert.equal(parsedGui.tasks.length, def.tasks.length);
  assert.equal(parsedGui.sections.length, def.sections.length);

  assert.equal(clampJourneyScore(9), 5);
  assert.equal(clampJourneyScore(-2), 1);

  const plain = parseJourneyCodeToGuiData(`journey
  title Checkout Flow
  Browse: 5: Customer
  section Pay
    Enter Card: 2: Customer, Stripe
`);
  assert.equal(plain.title, 'Checkout Flow');
  assert.equal(plain.sections.length, 1);
  assert.equal(plain.tasks.length, 2);
  assert.deepEqual(plain.tasks[1].actors, ['Customer', 'Stripe']);
});

test('treemapConverter promotes parents with children to section and emits ::: without spaces', () => {
  const def = createDefaultTreemapData('en');
  const code = generateTreemapCode(def);
  assert.ok(code.includes('"SaaS": 45:::highlight'));
  assert.ok(!code.includes('45 :::highlight'));

  const parsedGui = parseTreemapCodeToGuiData(code);
  assert.equal(parsedGui.nodes.length, def.nodes.length);

  // Leaf parent must promote to section when child added or indented
  const leafList = normalizeTreemapNodes([
    { id: 'a', depth: 0, kind: 'leaf', label: 'A', value: 10 },
    { id: 'b', depth: 0, kind: 'leaf', label: 'B', value: 20 },
  ]);
  const indented = indentTreemapNode(leafList, 1);
  assert.equal(indented[0].kind, 'section');
  assert.equal(indented[0].value, undefined);

  const { nodes: added } = addTreemapChildNode(leafList, 0, 'leaf', 'Sub', 15);
  assert.equal(added[0].kind, 'section');

  const plain = parseTreemapCodeToGuiData(`treemap-beta
  title Budget
  "Engineering"
    "Cloud": 60:::infra
    "Tooling": 40
  classDef infra fill:#dcfce7,stroke:#16a34a
`);
  assert.equal(plain.title, 'Budget');
  assert.equal(plain.nodes[1].className, 'infra');
  assert.equal(plain.classDefs?.length, 1);
});

test('vennConverter emits all set declarations before union and prunes dangling unions', () => {
  const def = createDefaultVennData('ja');
  const code = generateVennCode(def);
  const firstSetIdx = code.indexOf('  set ');
  const firstUnionIdx = code.indexOf('  union ');
  assert.ok(firstSetIdx > 0 && firstUnionIdx > firstSetIdx);

  const normalized = normalizeVennData({
    ...def,
    unions: [
      ...def.unions,
      { id: 'bad', sets: ['Frontend', 'MissingSet'], size: 3 },
    ],
  });
  assert.equal(normalized.unions.length, def.unions.length);

  const plain = parseVennCodeToGuiData(`venn-beta
  title Overlap
  set A["Alpha"]:20
    text a1["Item 1"]
  set B["Beta"]:15
  union A, B["Both"]:5
    text ab1["Shared"]
  style A fill:#dbeafe, stroke:#2563eb
`);
  assert.equal(plain.sets.length, 2);
  assert.equal(plain.unions.length, 1);
  assert.equal(plain.texts.length, 2);
  assert.equal(plain.sets[0].fill, '#dbeafe');
});

test('wardleyConverter formats coords as two-decimal numbers and supports all link arrows', () => {
  const def = createDefaultWardleyData('en');
  const code = generateWardleyCode(def);
  assert.ok(/\[0\.94, 0\.45\]/.test(code));
  assert.equal(clampWardleyCoord(50), 0.5);

  const parsedGui = parseWardleyCodeToGuiData(code);
  assert.equal(parsedGui.components.length, def.components.length);
  assert.equal(parsedGui.links.length, def.links.length);

  const plain = parseWardleyCodeToGuiData(`wardley-beta
  title Map
  anchor "Customer" [0.95, 0.50]
  component "API" [0.60, 0.40] (build) inertia
  component "Storage" [0.20, 0.85] (market)
  "Customer" -> "API"
  "API" -.-> "Storage"; S3 calls
  evolve "API" 0.80
`);
  assert.equal(plain.anchors[0].name, 'Customer');
  assert.equal(plain.components[0].inertia, true);
  assert.equal(plain.components[0].evolveTo, 0.8);
  assert.equal(plain.links[1].style, 'dotted');
  assert.equal(plain.links[1].label, 'S3 calls');
});

test('cynefinConverter omits self-loops in generated code while preserving valid transitions', () => {
  const def = createDefaultCynefinData('en');
  const withSelfLoop = {
    ...def,
    transitions: [
      ...def.transitions,
      { id: 'self', from: 'complex' as const, to: 'complex' as const, label: 'ignored' },
    ],
  };
  const code = generateCynefinCode(withSelfLoop);
  assert.ok(!code.includes('complex --> complex'));

  const plain = parseCynefinCodeToGuiData(`cynefin-beta
  title Triage
  complex
    "Explore"
  clear
    "Runbook"
  complex --> clear: "Codify"
`);
  assert.equal(plain.items.length, 2);
  assert.equal(plain.transitions.length, 1);
  assert.equal(plain.transitions[0].label, 'Codify');
});
