import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateRequirementCode,
  parseRequirementCodeToGuiData,
  REQUIREMENT_KIND_OPTIONS,
} from './requirementConverter.ts';
import {
  computePacketBitRanges,
  generatePacketCode,
  parsePacketCodeToGuiData,
} from './packetConverter.ts';
import {
  generateEventModelingCode,
  parseEventModelingCodeToGuiData,
} from './eventModelingConverter.ts';
import {
  generateSankeyCode,
  parseSankeyCodeToGuiData,
} from './sankeyConverter.ts';
import {
  generateRadarCode,
  parseRadarCodeToGuiData,
} from './radarConverter.ts';
import {
  generateInfoCode,
  parseInfoCodeToGuiData,
} from './infoConverter.ts';
import { GUI_STATE_PREFIX } from './mermaidEnvelope.ts';

function stripGuiState(code: string): string {
  return code
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith(GUI_STATE_PREFIX))
    .join('\n');
}

test('requirementConverter supports reverse arrows, frontmatter titles, and all requirement kinds', () => {
  const plain = `---
title: 'Spec Map'
---
requirementDiagram
  direction RL
  performanceRequirement "Latency SLA" {
    id: "REQ-9"
    text: "Respond under 100ms"
    risk: high
    verifymethod: demonstration
  }
  element "API Server" {
    type: "Service"
    docref: "docs/api.md"
  }
  "Latency SLA" <- verifies - "API Server"`;

  const parsed = parseRequirementCodeToGuiData(plain);
  assert.equal(parsed.title, 'Spec Map');
  assert.equal(parsed.direction, 'RL');
  assert.equal(parsed.requirements[0]?.kind, 'performanceRequirement');
  assert.equal(parsed.requirements[0]?.reqId, 'REQ-9');
  assert.equal(parsed.relations[0]?.sourceId, parsed.elements[0]?.id);
  assert.equal(parsed.relations[0]?.targetId, parsed.requirements[0]?.id);
  assert.equal(parsed.relations[0]?.type, 'verifies');

  const roundTripped = parseRequirementCodeToGuiData(
    stripGuiState(
      generateRequirementCode({
        ...parsed,
        requirements: REQUIREMENT_KIND_OPTIONS.map((kind, idx) => ({
          id: `r_${idx}`,
          name: `Req ${idx}`,
          kind,
          reqId: `REQ-${idx}`,
          text: `Detail ${idx}`,
          risk: 'medium',
          verifyMethod: 'analysis',
        })),
        relations: [],
      })
    )
  );
  assert.equal(roundTripped.requirements.length, 6);
  assert.deepEqual(
    roundTripped.requirements.map((r) => r.kind),
    [...REQUIREMENT_KIND_OPTIONS]
  );
});

test('packetConverter computes contiguous bit ranges, +N relative syntax, and packet config frontmatter', () => {
  const plain = `---
config:
  packet:
    bitsPerRow: 16
    showBits: false
---
packet-beta
  title Custom Packet
  0: "SYN"
  +15: "Options"`;

  const parsed = parsePacketCodeToGuiData(plain);
  assert.equal(parsed.bitsPerRow, 16);
  assert.equal(parsed.showBits, false);
  assert.equal(parsed.title, 'Custom Packet');
  assert.deepEqual(
    parsed.blocks.map((b) => b.bits),
    [1, 15]
  );

  const generated = generatePacketCode(parsed);
  assert.match(generated, /0: "SYN"/);
  assert.match(generated, /1-15: "Options"/);
  assert.match(generated, /bitsPerRow: 16/);
  assert.match(generated, /showBits: false/);

  const ranges = computePacketBitRanges(parsed.blocks);
  assert.equal(ranges[0]?.startBit, 0);
  assert.equal(ranges[0]?.endBit, 0);
  assert.equal(ranges[1]?.startBit, 1);
  assert.equal(ranges[1]?.endBit, 15);
});

test('eventModelingConverter enforces col-0 closing braces and sanitizes inline/ref payloads', () => {
  const code = generateEventModelingCode({
    diagramType: 'eventmodeling',
    title: 'Sample Event Flow',
    frames: [
      {
        id: 'f1',
        frameKind: 'tf',
        frameNumber: '01',
        entityType: 'ui',
        namespace: 'Web 1',
        entityName: 'Sign Up',
        sourceFrames: ['01', '999'],
        inlineDataType: 'text',
        inlineData: 'User {Clicks} "Now"',
      },
      {
        id: 'f2',
        frameKind: 'rf',
        frameNumber: '02',
        entityType: 'evt',
        entityName: 'SignedUp',
        sourceFrames: ['01'],
        dataRef: 'SignupData',
      },
    ],
    dataEntities: [
      {
        id: 'd1',
        name: 'SignupData',
        dataType: 'json',
        body: '{\n  "ok": true\n}',
      },
    ],
    notes: [
      { id: 'n1', frameNumber: '02', body: 'Check payload' },
      { id: 'n_dangling', frameNumber: '999', body: 'Should drop' },
    ],
  });

  assert.match(code, /^---/m);
  assert.match(code, /\n}\n/);
  assert.ok(!code.includes('->> 999'));
  assert.ok(!code.includes('Should drop'));

  const reparsed = parseEventModelingCodeToGuiData(stripGuiState(code));
  assert.equal(reparsed.title, 'Sample Event Flow');
  assert.equal(reparsed.frames.length, 2);
  assert.equal(reparsed.frames[0]?.namespace, 'Web1');
  assert.equal(reparsed.frames[0]?.entityName, 'SignUp');
  assert.equal(reparsed.frames[1]?.frameKind, 'rf');
  assert.deepEqual(reparsed.frames[1]?.sourceFrames, ['01']);
  assert.equal(reparsed.dataEntities.length, 1);
  assert.equal(reparsed.notes?.length, 1);
});

test('sankeyConverter enforces printable ASCII, quotes CSV commas, and omits self-loops', () => {
  const code = generateSankeyCode({
    diagramType: 'sankey',
    links: [
      { id: 's1', source: 'Sales, Direct', target: 'Marketing', value: 25.5 },
      { id: 's2', source: '日本語のみ', target: 'Ops', value: 10 },
      { id: 's3', source: 'Same', target: 'Same', value: 5 },
    ],
  });

  assert.match(code, /"Sales, Direct",Marketing,25\.5/);
  assert.match(code, /Source2,Ops,10/);
  assert.ok(!code.includes('Same,Same'));

  const reparsed = parseSankeyCodeToGuiData(stripGuiState(code));
  assert.equal(reparsed.links.length, 2);
  assert.equal(reparsed.links[0]?.source, 'Sales, Direct');
  assert.equal(reparsed.links[0]?.value, 25.5);
});

test('radarConverter parses positional/keyed multiline curves and clamps negative values', () => {
  const plain = `radar-beta
  title Skill Chart
  axis a["Design"], b["Build"], c["Test"]
  curve s1["Team A"]{
    a: 80,
    b: 90,
    c: 70
  }
  showLegend false, ticks 6, min 10, max 100, graticule circle`;

  const parsed = parseRadarCodeToGuiData(plain);
  assert.equal(parsed.title, 'Skill Chart');
  assert.equal(parsed.axes.length, 3);
  assert.deepEqual(parsed.curves[0]?.values, [80, 90, 70]);
  assert.equal(parsed.showLegend, false);
  assert.equal(parsed.ticks, 6);
  assert.equal(parsed.min, 10);
  assert.equal(parsed.max, 100);
  assert.equal(parsed.graticule, 'circle');

  const clampedCode = generateRadarCode({
    ...parsed,
    min: -5,
    max: -1,
    curves: [{ id: 'c1', label: 'Series', values: [-10, 50, 120] }],
  });
  assert.match(clampedCode, /min 0/);
  assert.ok(!clampedCode.includes('max -1'));
  assert.match(clampedCode, /\{0, 50, 120\}/);
});

test('infoConverter emits showInfo before metadata and restores omitted showInfo', () => {
  const withShow = generateInfoCode({
    diagramType: 'info',
    showInfo: true,
    title: 'Runtime Info',
    accTitle: 'Acc T',
    accDescr: 'Acc D',
  });
  assert.ok(
    withShow.indexOf('showInfo') < withShow.indexOf('title Runtime Info')
  );

  const withoutShow = parseInfoCodeToGuiData(
    `info\n  title Minimal Info\n  accTitle: Meta`
  );
  assert.equal(withoutShow.showInfo, false);
  assert.equal(withoutShow.title, 'Minimal Info');
  assert.equal(withoutShow.accTitle, 'Meta');
});
