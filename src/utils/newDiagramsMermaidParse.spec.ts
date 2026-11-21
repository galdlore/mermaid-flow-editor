import { describe, expect, it } from 'vitest';
import mermaid from 'mermaid';
import {
  createDefaultGitGraphData,
  generateGitGraphCode,
} from './gitGraphConverter';
import {
  createDefaultTimelineData,
  generateTimelineCode,
} from './timelineConverter';
import {
  BLOCK_EDGE_LINE_TYPES,
  BLOCK_SHAPE_OPTIONS,
  createDefaultBlockData,
  generateBlockCode,
} from './blockConverter';
import {
  RAILROAD_SYNTAX_OPTIONS,
  createDefaultRailroadData,
  generateRailroadCode,
} from './railroadConverter';
import {
  createDefaultIshikawaData,
  generateIshikawaCode,
} from './ishikawaConverter';
import {
  createDefaultJourneyData,
  generateJourneyCode,
} from './journeyConverter';
import {
  createDefaultTreemapData,
  generateTreemapCode,
} from './treemapConverter';
import {
  createDefaultVennData,
  generateVennCode,
} from './vennConverter';
import {
  WARDLEY_LINK_STYLE_OPTIONS,
  WARDLEY_STRATEGY_OPTIONS,
  createDefaultWardleyData,
  generateWardleyCode,
} from './wardleyConverter';
import {
  createDefaultCynefinData,
  generateCynefinCode,
} from './cynefinConverter';
import {
  REQUIREMENT_KIND_OPTIONS,
  REQUIREMENT_RELATION_OPTIONS,
  createDefaultRequirementData,
  generateRequirementCode,
} from './requirementConverter';
import {
  createDefaultPacketData,
  generatePacketCode,
} from './packetConverter';
import {
  createDefaultEventModelingData,
  generateEventModelingCode,
} from './eventModelingConverter';
import {
  createDefaultSankeyData,
  generateSankeyCode,
} from './sankeyConverter';
import {
  createDefaultRadarData,
  generateRadarCode,
} from './radarConverter';
import {
  createDefaultInfoData,
  generateInfoCode,
} from './infoConverter';
import { GUI_STATE_PREFIX } from './mermaidEnvelope';

function stripGuiState(code: string): string {
  return code
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith(GUI_STATE_PREFIX))
    .join('\n');
}

describe('Mermaid v11 real parser verification for 5 new diagram types', () => {
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });

  it('parses gitGraph defaults (ja/en, with/without @gui-state, LR/TB/BT, init config)', async () => {
    for (const lang of ['ja', 'en'] as const) {
      const data = createDefaultGitGraphData(lang);
      const code = generateGitGraphCode(data);
      await expect(mermaid.parse(code)).resolves.toBeTruthy();
      await expect(mermaid.parse(stripGuiState(code))).resolves.toBeTruthy();
    }

    const baseEn = createDefaultGitGraphData('en');
    const tbCode = generateGitGraphCode({
      ...baseEn,
      orientation: 'TB',
      mainBranchName: 'trunk',
      showBranches: false,
      operations: baseEn.operations.map((op) =>
        op.kind === 'checkout' && op.branchName === 'main'
          ? { ...op, branchName: 'trunk' }
          : op
      ),
    });
    await expect(mermaid.parse(tbCode)).resolves.toBeTruthy();
  });

  it('parses timeline defaults (ja/en, LR/TD, with/without @gui-state)', async () => {
    for (const lang of ['ja', 'en'] as const) {
      const data = createDefaultTimelineData(lang);
      const code = generateTimelineCode(data);
      await expect(mermaid.parse(code)).resolves.toBeTruthy();
      await expect(mermaid.parse(stripGuiState(code))).resolves.toBeTruthy();
    }

    const tdCode = generateTimelineCode({
      ...createDefaultTimelineData('en'),
      direction: 'TD',
    });
    await expect(mermaid.parse(tdCode)).resolves.toBeTruthy();
  });

  it('parses block-beta defaults, all 14 shapes, and all 5 edge types (labeled and unlabeled)', async () => {
    for (const lang of ['ja', 'en'] as const) {
      const data = createDefaultBlockData(lang);
      const code = generateBlockCode(data);
      await expect(mermaid.parse(code)).resolves.toBeTruthy();
      await expect(mermaid.parse(stripGuiState(code))).resolves.toBeTruthy();
    }

    const shapeItems = BLOCK_SHAPE_OPTIONS.map((shape, idx) => ({
      id: `n_${idx}`,
      kind: 'node' as const,
      label: `Shape ${shape}`,
      shape,
      span: 1,
    }));
    const edgeList = BLOCK_EDGE_LINE_TYPES.flatMap((lineType, idx) => [
      {
        id: `e_u_${idx}`,
        from: shapeItems[idx].id,
        to: shapeItems[idx + 1].id,
        lineType,
      },
      {
        id: `e_l_${idx}`,
        from: shapeItems[idx + 1].id,
        to: shapeItems[idx + 2].id,
        lineType,
        label: `lbl_${lineType}`,
      },
    ]);
    const matrixCode = generateBlockCode({
      diagramType: 'block',
      columns: 4,
      items: shapeItems,
      edges: edgeList,
    });
    await expect(mermaid.parse(matrixCode)).resolves.toBeTruthy();
  });

  it('parses railroad defaults across all 4 syntax dialects', async () => {
    for (const lang of ['ja', 'en'] as const) {
      const base = createDefaultRailroadData(lang);
      for (const syntax of RAILROAD_SYNTAX_OPTIONS) {
        const code = generateRailroadCode({ ...base, syntax });
        await expect(mermaid.parse(code)).resolves.toBeTruthy();
        await expect(mermaid.parse(stripGuiState(code))).resolves.toBeTruthy();
      }
    }
  });

  it('parses ishikawa-beta defaults (ja/en, with/without @gui-state)', async () => {
    for (const lang of ['ja', 'en'] as const) {
      const data = createDefaultIshikawaData(lang);
      const code = generateIshikawaCode(data);
      await expect(mermaid.parse(code)).resolves.toBeTruthy();
      await expect(mermaid.parse(stripGuiState(code))).resolves.toBeTruthy();
    }
  });

  it('parses journey defaults and score/actor variations (ja/en, with/without @gui-state)', async () => {
    for (const lang of ['ja', 'en'] as const) {
      const data = createDefaultJourneyData(lang);
      const code = generateJourneyCode(data);
      await expect(mermaid.parse(code)).resolves.toBeTruthy();
      await expect(mermaid.parse(stripGuiState(code))).resolves.toBeTruthy();
    }
  });

  it('parses treemap-beta defaults, nested sections, leaves, and :::classDef', async () => {
    for (const lang of ['ja', 'en'] as const) {
      const data = createDefaultTreemapData(lang);
      const code = generateTreemapCode(data);
      await expect(mermaid.parse(code)).resolves.toBeTruthy();
      await expect(mermaid.parse(stripGuiState(code))).resolves.toBeTruthy();
    }
  });

  it('parses venn-beta defaults, set ordering, unions, text items, and style directives', async () => {
    for (const lang of ['ja', 'en'] as const) {
      const data = createDefaultVennData(lang);
      const code = generateVennCode(data);
      await expect(mermaid.parse(code)).resolves.toBeTruthy();
      await expect(mermaid.parse(stripGuiState(code))).resolves.toBeTruthy();
    }
  });

  it('parses wardley-beta defaults, all strategies, all link styles, inertia, evolve, and notes', async () => {
    for (const lang of ['ja', 'en'] as const) {
      const data = createDefaultWardleyData(lang);
      const code = generateWardleyCode(data);
      await expect(mermaid.parse(code)).resolves.toBeTruthy();
      await expect(mermaid.parse(stripGuiState(code))).resolves.toBeTruthy();
    }

    const baseEn = createDefaultWardleyData('en');
    const linksMatrix = WARDLEY_LINK_STYLE_OPTIONS.map((style, idx) => ({
      id: `lm_${idx}`,
      from: baseEn.components[idx % baseEn.components.length].id,
      to: baseEn.components[(idx + 1) % baseEn.components.length].id,
      style,
      label: idx % 2 === 0 ? `Flow ${style}` : undefined,
    }));
    const fullCode = generateWardleyCode({
      ...baseEn,
      components: WARDLEY_STRATEGY_OPTIONS.map((strategy, idx) => ({
        id: `c_${idx}`,
        name: `Comp ${idx}`,
        visibility: 0.2 + idx * 0.2,
        evolution: 0.15 + idx * 0.2,
        strategy,
        inertia: idx % 2 === 0,
        evolveTo: idx === 0 ? 0.85 : undefined,
      })),
      links: linksMatrix.map((l, idx) => ({
        ...l,
        from: `c_${idx % 4}`,
        to: `c_${(idx + 1) % 4}`,
      })),
    });
    await expect(mermaid.parse(fullCode)).resolves.toBeTruthy();
  });

  it('parses cynefin-beta defaults and multi-domain transitions', async () => {
    for (const lang of ['ja', 'en'] as const) {
      const data = createDefaultCynefinData(lang);
      const code = generateCynefinCode(data);
      await expect(mermaid.parse(code)).resolves.toBeTruthy();
      await expect(mermaid.parse(stripGuiState(code))).resolves.toBeTruthy();
    }
  });

  it('parses requirementDiagram defaults, all kinds, relations, directions, and frontmatter titles', async () => {
    for (const lang of ['ja', 'en'] as const) {
      const data = createDefaultRequirementData(lang);
      const code = generateRequirementCode(data);
      await expect(mermaid.parse(code)).resolves.toBeTruthy();
      await expect(mermaid.parse(stripGuiState(code))).resolves.toBeTruthy();
    }

    const reqs = REQUIREMENT_KIND_OPTIONS.map((kind, idx) => ({
      id: `rk_${idx}`,
      name: `Req Item ${idx}`,
      kind,
      reqId: `REQ-${idx}`,
      text: `Requirement description ${idx}`,
      risk: (['low', 'medium', 'high'] as const)[idx % 3],
      verifyMethod: (['analysis', 'demonstration', 'inspection', 'test'] as const)[idx % 4],
    }));
    const fullReqCode = generateRequirementCode({
      diagramType: 'requirement',
      title: '要件マトリクス',
      direction: 'RL',
      requirements: reqs,
      elements: [{ id: 'el_main', name: 'Main Service', type: 'API', docref: 'spec.md' }],
      relations: REQUIREMENT_RELATION_OPTIONS.map((relType, idx) => ({
        id: `rel_${idx}`,
        sourceId: idx === 0 ? 'el_main' : reqs[idx % reqs.length].id,
        targetId: reqs[(idx + 1) % reqs.length].id,
        type: relType,
      })),
    });
    await expect(mermaid.parse(fullReqCode)).resolves.toBeTruthy();
  });

  it('parses packet-beta defaults, single-bit fields, Japanese labels, and frontmatter config', async () => {
    for (const lang of ['ja', 'en'] as const) {
      const data = createDefaultPacketData(lang);
      const code = generatePacketCode(data);
      await expect(mermaid.parse(code)).resolves.toBeTruthy();
      await expect(mermaid.parse(stripGuiState(code))).resolves.toBeTruthy();
    }

    const customCode = generatePacketCode({
      diagramType: 'packet',
      title: '16ビット構成ヘッダ',
      bitsPerRow: 16,
      showBits: false,
      blocks: [
        { id: 'b1', bits: 1, label: 'SYN' },
        { id: 'b2', bits: 15, label: '日本語フィールド' },
      ],
    });
    await expect(mermaid.parse(customCode)).resolves.toBeTruthy();
  });

  it('parses eventmodeling defaults, reset frames, data entities, and col-0 notes', async () => {
    for (const lang of ['ja', 'en'] as const) {
      const data = createDefaultEventModelingData(lang);
      const code = generateEventModelingCode(data);
      await expect(mermaid.parse(code)).resolves.toBeTruthy();
      await expect(mermaid.parse(stripGuiState(code))).resolves.toBeTruthy();
    }

    const rfCode = generateEventModelingCode({
      diagramType: 'eventmodeling',
      title: 'リセットフロー確認',
      frames: [
        {
          id: 'f1',
          frameKind: 'tf',
          frameNumber: '01',
          entityType: 'ui',
          namespace: 'Web',
          entityName: 'InputPage',
          sourceFrames: [],
          inlineDataType: 'text',
          inlineData: '入力画面',
        },
        {
          id: 'f2',
          frameKind: 'rf',
          frameNumber: '02',
          entityType: 'rmo',
          namespace: 'Web',
          entityName: 'SummaryView',
          sourceFrames: ['01'],
          dataRef: 'ViewState',
        },
      ],
      dataEntities: [
        { id: 'd1', name: 'ViewState', dataType: 'json', body: '{\n  "ready": true\n}' },
      ],
      notes: [{ id: 'n1', frameNumber: '02', body: 'リセットビュー補足メモ' }],
    });
    await expect(mermaid.parse(rfCode)).resolves.toBeTruthy();
  });

  it('parses sankey-beta defaults, comma-quoted ASCII fields, comments, and frontmatter', async () => {
    for (const lang of ['ja', 'en'] as const) {
      const data = createDefaultSankeyData(lang);
      const code = generateSankeyCode(data);
      await expect(mermaid.parse(code)).resolves.toBeTruthy();
      await expect(mermaid.parse(stripGuiState(code))).resolves.toBeTruthy();
    }

    const commaCode = generateSankeyCode({
      diagramType: 'sankey',
      title: 'CSV Quote Check',
      links: [
        { id: 'l1', source: 'Sales, Direct', target: 'Engineering', value: 12.5 },
        { id: 'l2', source: 'Engineering', target: 'Cloud Ops', value: 7.5 },
      ],
      comments: ['Quoted CSV field test'],
    });
    await expect(mermaid.parse(commaCode)).resolves.toBeTruthy();
  });

  it('parses radar-beta defaults, circle and polygon graticules, and custom bounds', async () => {
    for (const lang of ['ja', 'en'] as const) {
      const data = createDefaultRadarData(lang);
      const code = generateRadarCode(data);
      await expect(mermaid.parse(code)).resolves.toBeTruthy();
      await expect(mermaid.parse(stripGuiState(code))).resolves.toBeTruthy();
    }

    const circleCode = generateRadarCode({
      diagramType: 'radar',
      title: '円形グリッド確認',
      axes: [
        { id: 'speed', label: '速度' },
        { id: 'quality', label: '品質' },
        { id: 'cost', label: 'コスト' },
      ],
      curves: [{ id: 'c1', label: '計画値', values: [40, 80, 60] }],
      showLegend: false,
      ticks: 4,
      min: 0,
      max: 100,
      graticule: 'circle',
    });
    await expect(mermaid.parse(circleCode)).resolves.toBeTruthy();
  });

  it('parses info diagram with showInfo true/false and metadata directives', async () => {
    for (const lang of ['ja', 'en'] as const) {
      const data = createDefaultInfoData(lang);
      const code = generateInfoCode(data);
      await expect(mermaid.parse(code)).resolves.toBeTruthy();
      await expect(mermaid.parse(stripGuiState(code))).resolves.toBeTruthy();
    }

    const noShowCode = generateInfoCode({
      diagramType: 'info',
      showInfo: false,
      title: 'Minimal Info',
      accTitle: 'Version Card',
      accDescr: 'Displays version without showInfo',
    });
    await expect(mermaid.parse(noShowCode)).resolves.toBeTruthy();
    await expect(mermaid.parse(stripGuiState(noShowCode))).resolves.toBeTruthy();
  });
});
