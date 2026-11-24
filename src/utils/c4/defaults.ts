import type {
  C4BoundaryData,
  C4BoundaryKind,
  C4DiagramData,
  C4DiagramSubtype,
  C4ElementData,
  C4ElementKind,
  C4ElementVariant,
  C4RelationData,
  C4RelationType,
} from '../../types/editor';

export const VALID_SUBTYPES = new Set<C4DiagramSubtype>([
  'C4Context',
  'C4Container',
  'C4Component',
  'C4Dynamic',
  'C4Deployment',
]);

export const VALID_ELEMENT_KINDS = new Set<C4ElementKind>([
  'person',
  'system',
  'container',
  'component',
]);

export const VALID_ELEMENT_VARIANTS = new Set<C4ElementVariant>([
  'standard',
  'db',
  'queue',
]);

export const VALID_BOUNDARY_KINDS = new Set<C4BoundaryKind>([
  'enterprise',
  'system',
  'container',
  'boundary',
  'node',
]);

export const VALID_RELATION_TYPES = new Set<C4RelationType>([
  'Rel',
  'BiRel',
  'Rel_Up',
  'Rel_Down',
  'Rel_Left',
  'Rel_Right',
  'Rel_Back',
  'RelIndex',
]);

const RESERVED_C4_KEYWORDS = new Set([
  'global',
  'title',
  'direction',
  'c4context',
  'c4container',
  'c4component',
  'c4dynamic',
  'c4deployment',
  'person',
  'person_ext',
  'system',
  'system_ext',
  'systemdb',
  'systemdb_ext',
  'systemqueue',
  'systemqueue_ext',
  'container',
  'container_ext',
  'containerdb',
  'containerdb_ext',
  'containerqueue',
  'containerqueue_ext',
  'component',
  'component_ext',
  'componentdb',
  'componentdb_ext',
  'componentqueue',
  'componentqueue_ext',
  'boundary',
  'enterprise_boundary',
  'system_boundary',
  'container_boundary',
  'deployment_node',
  'node',
  'node_l',
  'node_r',
  'rel',
  'birel',
  'rel_u',
  'rel_up',
  'rel_d',
  'rel_down',
  'rel_l',
  'rel_left',
  'rel_r',
  'rel_right',
  'rel_back',
  'rel_b',
  'relindex',
  'updateelementstyle',
  'updaterelstyle',
  'updatelayoutconfig',
]);

export const C4_SUBTYPE_OPTIONS: ReadonlyArray<C4DiagramSubtype> = [
  'C4Context',
  'C4Container',
  'C4Component',
  'C4Dynamic',
  'C4Deployment',
];

export const C4_ELEMENT_KIND_OPTIONS: ReadonlyArray<C4ElementKind> = [
  'person',
  'system',
  'container',
  'component',
];

export const C4_ELEMENT_VARIANT_OPTIONS: ReadonlyArray<C4ElementVariant> = [
  'standard',
  'db',
  'queue',
];

export const C4_BOUNDARY_KIND_OPTIONS: ReadonlyArray<C4BoundaryKind> = [
  'enterprise',
  'system',
  'container',
  'boundary',
  'node',
];

export const C4_RELATION_TYPE_OPTIONS: ReadonlyArray<C4RelationType> = [
  'Rel',
  'BiRel',
  'Rel_Up',
  'Rel_Down',
  'Rel_Left',
  'Rel_Right',
  'Rel_Back',
  'RelIndex',
];

export function createDefaultC4Data(lang: 'ja' | 'en' = 'ja'): C4DiagramData {
  if (lang === 'en') {
    return {
      diagramType: 'c4',
      subtype: 'C4Context',
      title: 'System Context Diagram for Banking Platform',
      shapeInRow: 3,
      boundaryInRow: 1,
      elements: [
        {
          id: 'customer',
          kind: 'person',
          label: 'Banking Customer',
          descr: 'A personal banking customer accessing online services',
        },
        {
          id: 'webApp',
          kind: 'system',
          label: 'Internet Banking System',
          descr: 'Allows customers to view balances and make transfers',
          boundaryId: 'enterpriseCore',
        },
        {
          id: 'ledgerDb',
          kind: 'system',
          variant: 'db',
          label: 'Core Ledger DB',
          descr: 'Stores customer accounts and transaction history',
          boundaryId: 'enterpriseCore',
        },
        {
          id: 'mailSystem',
          kind: 'system',
          external: true,
          label: 'E-mail System',
          descr: 'External SMTP delivery service',
        },
      ],
      boundaries: [
        {
          id: 'enterpriseCore',
          kind: 'enterprise',
          label: 'Bank Enterprise',
        },
      ],
      relations: [
        {
          id: 'rel_1',
          relType: 'Rel',
          from: 'customer',
          to: 'webApp',
          label: 'Uses',
          techn: 'HTTPS',
        },
        {
          id: 'rel_2',
          relType: 'Rel',
          from: 'webApp',
          to: 'ledgerDb',
          label: 'Reads and writes',
          techn: 'SQL / TLS',
        },
        {
          id: 'rel_3',
          relType: 'Rel',
          from: 'webApp',
          to: 'mailSystem',
          label: 'Sends alerts via',
          techn: 'SMTP',
        },
        {
          id: 'rel_4',
          relType: 'Rel_Back',
          from: 'customer',
          to: 'mailSystem',
          label: 'Sends notifications to',
        },
      ],
    };
  }

  return {
    diagramType: 'c4',
    subtype: 'C4Context',
    title: 'インターネットバンキング システムコンテキスト図',
    shapeInRow: 3,
    boundaryInRow: 1,
    elements: [
      {
        id: 'customer',
        kind: 'person',
        label: '個人顧客',
        descr: 'オンライン口座機能を利用する銀行の顧客',
      },
      {
        id: 'webApp',
        kind: 'system',
        label: 'インターネットバンキング',
        descr: '残高照会や振込手続きを提供する中核システム',
        boundaryId: 'enterpriseCore',
      },
      {
        id: 'ledgerDb',
        kind: 'system',
        variant: 'db',
        label: '勘定系データベース',
        descr: '口座残高と取引履歴を永続化する',
        boundaryId: 'enterpriseCore',
      },
      {
        id: 'mailSystem',
        kind: 'system',
        external: true,
        label: '外部メール配信基盤',
        descr: '通知メールを送信する外部サービス',
      },
    ],
    boundaries: [
      {
        id: 'enterpriseCore',
        kind: 'enterprise',
        label: '自社グループ基盤',
      },
    ],
    relations: [
      {
        id: 'rel_1',
        relType: 'Rel',
        from: 'customer',
        to: 'webApp',
        label: '操作する',
        techn: 'HTTPS',
      },
      {
        id: 'rel_2',
        relType: 'Rel',
        from: 'webApp',
        to: 'ledgerDb',
        label: '参照・更新する',
        techn: 'SQL / TLS',
      },
      {
        id: 'rel_3',
        relType: 'Rel',
        from: 'webApp',
        to: 'mailSystem',
        label: '通知を依頼する',
        techn: 'SMTP',
      },
      {
        id: 'rel_4',
        relType: 'Rel_Back',
        from: 'customer',
        to: 'mailSystem',
        label: '通知メールを受信',
      },
    ],
  };
}

export function sanitizeC4Id(raw: string): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!cleaned) {
    return 'item';
  }
  const prefixed = /^[a-zA-Z_]/.test(cleaned) ? cleaned : `c4_${cleaned}`;
  return RESERVED_C4_KEYWORDS.has(prefixed.toLowerCase())
    ? `${prefixed}_item`
    : prefixed;
}

export function sanitizeC4QuotedText(raw: string): string {
  return raw.replace(/["\r\n]/g, '').trim();
}

export function sanitizeC4Title(raw: string): string {
  return raw.replace(/[#;\r\n]/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

export function clampGridCount(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return undefined;
  }
  const intVal = Math.round(raw);
  if (intVal < 1) return undefined;
  return Math.min(10, Math.max(1, intVal));
}

export function createUniqueC4ElementId(
  elements: ReadonlyArray<C4ElementData>,
  boundaries: ReadonlyArray<C4BoundaryData>,
  preferred = 'element'
): string {
  const used = new Set<string>([
    ...elements.map((e) => e.id),
    ...boundaries.map((b) => b.id),
  ]);
  const base = sanitizeC4Id(preferred);
  if (!used.has(base)) {
    return base;
  }
  let idx = elements.length + 1;
  while (used.has(`${base}_${idx}`)) {
    idx++;
  }
  return `${base}_${idx}`;
}

export function createUniqueC4BoundaryId(
  elements: ReadonlyArray<C4ElementData>,
  boundaries: ReadonlyArray<C4BoundaryData>,
  preferred = 'boundary'
): string {
  const used = new Set<string>([
    ...elements.map((e) => e.id),
    ...boundaries.map((b) => b.id),
  ]);
  const base = sanitizeC4Id(preferred);
  if (!used.has(base)) {
    return base;
  }
  let idx = boundaries.length + 1;
  while (used.has(`${base}_${idx}`)) {
    idx++;
  }
  return `${base}_${idx}`;
}

export function createUniqueC4RelationId(
  relations: ReadonlyArray<C4RelationData>
): string {
  const used = new Set(relations.map((r) => r.id));
  let idx = relations.length + 1;
  while (used.has(`rel_${idx}`)) {
    idx++;
  }
  return `rel_${idx}`;
}

/**
 * 境界IDを指定して配下の子孫境界ID集合を返す（循環防止用）。
 */
export function collectC4BoundaryDescendantIds(
  rootId: string,
  boundaries: ReadonlyArray<C4BoundaryData>
): Set<string> {
  const descendants = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const b of boundaries) {
      if (
        b.parentBoundaryId === current &&
        !descendants.has(b.id) &&
        b.id !== rootId
      ) {
        descendants.add(b.id);
        queue.push(b.id);
      }
    }
  }
  return descendants;
}

export function resolveC4ElementMacroName(el: C4ElementData): string {
  const extSuffix = el.external ? '_Ext' : '';
  if (el.kind === 'person') {
    return `Person${extSuffix}`;
  }
  const variantSuffix =
    el.variant === 'db' ? 'Db' : el.variant === 'queue' ? 'Queue' : '';
  const prefix =
    el.kind === 'system'
      ? 'System'
      : el.kind === 'container'
        ? 'Container'
        : 'Component';
  return `${prefix}${variantSuffix}${extSuffix}`;
}

export function resolveC4BoundaryMacroName(kind: C4BoundaryKind): string {
  switch (kind) {
    case 'enterprise':
      return 'Enterprise_Boundary';
    case 'system':
      return 'System_Boundary';
    case 'container':
      return 'Container_Boundary';
    case 'node':
      return 'Deployment_Node';
    default:
      return 'Boundary';
  }
}
