import type {
  ClassDiagramData,
  ClassDiagramDirection,
  ClassMemberClassifier,
  ClassMemberData,
  ClassMemberKind,
  ClassMemberVisibility,
  ClassNodeData,
  ClassNoteData,
  ClassRelationData,
  ClassRelationType,
} from '../../types/editor';
import { sanitizeCssColor } from '../inputSafeguard.ts';
import { allocateUniqueId, sanitizeSingleLineComment } from '../mermaidEnvelope.ts';

export const VALID_DIRECTIONS = new Set<ClassDiagramDirection>(['TB', 'BT', 'LR', 'RL']);
const VALID_VISIBILITIES = new Set<ClassMemberVisibility>(['+', '-', '#', '~', '']);
const VALID_CLASSIFIERS = new Set<ClassMemberClassifier>(['none', 'static', 'abstract']);
const VALID_MEMBER_KINDS = new Set<ClassMemberKind>(['field', 'method']);
export const VALID_RELATION_TYPES = new Set<ClassRelationType>([
  '--|>',
  '..|>',
  '*--',
  'o--',
  '-->',
  '..>',
  '--',
  '..',
]);

export const RESERVED_CLASS_KEYWORDS = new Set([
  'classdiagram',
  'classdiagram-v2',
  'class',
  'namespace',
  'direction',
  'title',
  'note',
  'for',
  'end',
  'classdef',
  'style',
  'link',
  'callback',
  'click',
  'cssclass',
]);

export const CLASS_DIRECTION_OPTIONS: ReadonlyArray<ClassDiagramDirection> = [
  'TB',
  'LR',
  'BT',
  'RL',
];

export const CLASS_VISIBILITY_OPTIONS: ReadonlyArray<ClassMemberVisibility> = [
  '+',
  '-',
  '#',
  '~',
  '',
];

export const CLASS_RELATION_OPTIONS: ReadonlyArray<ClassRelationType> = [
  '--|>',
  '..|>',
  '*--',
  'o--',
  '-->',
  '..>',
  '--',
  '..',
];

export const CLASS_STEREOTYPE_SUGGESTIONS: ReadonlyArray<string> = [
  '',
  'interface',
  'abstract',
  'service',
  'enumeration',
];

export function createDefaultClassData(lang: 'ja' | 'en' = 'ja'): ClassDiagramData {
  if (lang === 'en') {
    return {
      diagramType: 'class',
      title: 'Domain Object Model',
      direction: 'TB',
      classes: [
        {
          id: 'IAuthService',
          label: 'Auth Service',
          stereotype: 'interface',
          members: [
            {
              id: 'm_1',
              kind: 'method',
              visibility: '+',
              name: 'authenticate',
              params: 'email: string, password: string',
              type: 'bool',
            },
          ],
        },
        {
          id: 'User',
          label: 'User',
          namespace: 'Domain',
          members: [
            { id: 'm_2', kind: 'field', visibility: '+', name: 'id', type: 'int' },
            { id: 'm_3', kind: 'field', visibility: '-', name: 'email', type: 'string' },
            {
              id: 'm_4',
              kind: 'method',
              visibility: '+',
              name: 'getDisplayName',
              params: '',
              type: 'string',
            },
          ],
        },
        {
          id: 'Order',
          label: 'Order',
          namespace: 'Domain',
          members: [
            { id: 'm_5', kind: 'field', visibility: '+', name: 'id', type: 'int' },
            { id: 'm_6', kind: 'field', visibility: '-', name: 'total', type: 'decimal' },
            {
              id: 'm_7',
              kind: 'method',
              visibility: '+',
              name: 'confirm',
              params: '',
              type: 'void',
            },
          ],
        },
      ],
      relations: [
        {
          id: 'rel_1',
          from: 'User',
          to: 'IAuthService',
          relationType: '..|>',
          label: 'implements',
        },
        {
          id: 'rel_2',
          from: 'User',
          to: 'Order',
          relationType: '-->',
          fromCardinality: '1',
          toCardinality: '0..*',
          label: 'places',
        },
      ],
      notes: [
        {
          id: 'note_1',
          targetClassId: 'Order',
          text: 'Aggregate root',
        },
      ],
    };
  }

  return {
    diagramType: 'class',
    title: 'ドメインクラス構成',
    direction: 'TB',
    classes: [
      {
        id: 'IAuthService',
        label: '認証サービス',
        stereotype: 'interface',
        members: [
          {
            id: 'm_1',
            kind: 'method',
            visibility: '+',
            name: 'authenticate',
            params: 'email: string, password: string',
            type: 'bool',
          },
        ],
      },
      {
        id: 'User',
        label: '利用者',
        namespace: 'Domain',
        members: [
          { id: 'm_2', kind: 'field', visibility: '+', name: 'id', type: 'int' },
          { id: 'm_3', kind: 'field', visibility: '-', name: 'email', type: 'string' },
          {
            id: 'm_4',
            kind: 'method',
            visibility: '+',
            name: 'getDisplayName',
            params: '',
            type: 'string',
          },
        ],
      },
      {
        id: 'Order',
        label: '注文',
        namespace: 'Domain',
        members: [
          { id: 'm_5', kind: 'field', visibility: '+', name: 'id', type: 'int' },
          { id: 'm_6', kind: 'field', visibility: '-', name: 'total', type: 'decimal' },
          {
            id: 'm_7',
            kind: 'method',
            visibility: '+',
            name: 'confirm',
            params: '',
            type: 'void',
          },
        ],
      },
    ],
    relations: [
      {
        id: 'rel_1',
        from: 'User',
        to: 'IAuthService',
        relationType: '..|>',
        label: '実装する',
      },
      {
        id: 'rel_2',
        from: 'User',
        to: 'Order',
        relationType: '-->',
        fromCardinality: '1',
        toCardinality: '0..*',
        label: '注文する',
      },
    ],
    notes: [
      {
        id: 'note_1',
        targetClassId: 'Order',
        text: '集約ルート',
      },
    ],
  };
}

export function sanitizeClassId(rawId: string, fallbackPrefix = 'Class'): string {
  const cleaned = rawId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!cleaned) {
    return fallbackPrefix;
  }
  const withAlpha = /^[a-zA-Z]/.test(cleaned) ? cleaned : `${fallbackPrefix}_${cleaned}`;
  if (RESERVED_CLASS_KEYWORDS.has(withAlpha.toLowerCase())) {
    return `${withAlpha}Type`;
  }
  return withAlpha;
}

export function sanitizeClassQuotedText(raw: string): string {
  return raw
    .replace(/[\r\n]+/g, ' ')
    .replace(/;/g, ' ')
    .replace(/"/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeClassMemberText(raw: string): string {
  return raw
    .replace(/[;{}\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeClassGeneric(raw: string): string {
  return raw
    .replace(/[;{}\r\n~"`<>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeNamespace(raw: string): string | undefined {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_.-]/g, '_');
  return cleaned || undefined;
}

export function formatClassMemberSignature(member: ClassMemberData): string {
  const vis = member.visibility ?? '';
  const suffix =
    member.classifier === 'static'
      ? '$'
      : member.classifier === 'abstract'
        ? '*'
        : '';

  if (member.kind === 'method') {
    const params = member.params ? member.params : '';
    const ret = member.type ? ` ${member.type}` : '';
    return `${vis}${member.name}(${params})${suffix}${ret}`;
  }

  const typePrefix = member.type ? `${member.type} ` : '';
  return `${vis}${typePrefix}${member.name}${member.classifier === 'static' ? '$' : ''}`;
}

export function isValidClassData(value: unknown): value is ClassDiagramData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Partial<ClassDiagramData>;
  return (
    obj.diagramType === 'class' &&
    Array.isArray(obj.classes) &&
    Array.isArray(obj.relations)
  );
}

export function normalizeClassData(rawData: ClassDiagramData): ClassDiagramData {
  const usedClassIds = new Set<string>();
  const classIdMap = new Map<string, string>();
  const usedMemberIds = new Set<string>();
  const classes: ClassNodeData[] = [];

  for (let i = 0; i < rawData.classes.length; i += 1) {
    const rawCls = rawData.classes[i];
    if (!rawCls || typeof rawCls.id !== 'string') {
      continue;
    }
    const baseId = sanitizeClassId(rawCls.id, `Class_${i + 1}`);
    const uniqueId = allocateUniqueId(baseId, usedClassIds);
    if (!classIdMap.has(rawCls.id)) {
      classIdMap.set(rawCls.id, uniqueId);
    }

    const label =
      typeof rawCls.label === 'string' ? sanitizeClassQuotedText(rawCls.label) : '';
    const generic =
      typeof rawCls.generic === 'string' ? sanitizeClassGeneric(rawCls.generic) : '';
    const stereotype =
      typeof rawCls.stereotype === 'string'
        ? sanitizeClassQuotedText(rawCls.stereotype.replace(/[<>]/g, ''))
        : '';
    const namespace =
      typeof rawCls.namespace === 'string'
        ? sanitizeNamespace(rawCls.namespace)
        : undefined;
    const color = sanitizeCssColor(rawCls.color);

    const members: ClassMemberData[] = [];
    const rawMembers = Array.isArray(rawCls.members) ? rawCls.members : [];
    for (let j = 0; j < rawMembers.length; j += 1) {
      const rawMem = rawMembers[j];
      if (!rawMem || typeof rawMem !== 'object') {
        continue;
      }
      const memBaseId =
        typeof rawMem.id === 'string' && rawMem.id.trim()
          ? rawMem.id.replace(/[^a-zA-Z0-9_-]/g, '_')
          : `m_${usedMemberIds.size + 1}`;
      const memId = allocateUniqueId(memBaseId, usedMemberIds);
      const kind: ClassMemberKind = VALID_MEMBER_KINDS.has(rawMem.kind)
        ? rawMem.kind
        : 'field';
      const visibility: ClassMemberVisibility = VALID_VISIBILITIES.has(rawMem.visibility)
        ? rawMem.visibility
        : '+';
      const name =
        typeof rawMem.name === 'string'
          ? sanitizeClassMemberText(rawMem.name).replace(/[()]/g, '') || `member_${j + 1}`
          : `member_${j + 1}`;
      const type =
        typeof rawMem.type === 'string' ? sanitizeClassMemberText(rawMem.type) : '';
      const params =
        kind === 'method' && typeof rawMem.params === 'string'
          ? sanitizeClassMemberText(rawMem.params).replace(/[()]/g, '')
          : '';
      const classifier: ClassMemberClassifier | undefined =
        rawMem.classifier &&
        VALID_CLASSIFIERS.has(rawMem.classifier) &&
        rawMem.classifier !== 'none'
          ? rawMem.classifier
          : undefined;

      members.push({
        id: memId,
        kind,
        visibility,
        name,
        ...(type ? { type } : {}),
        ...(kind === 'method' && params ? { params } : {}),
        ...(classifier ? { classifier } : {}),
      });
    }

    classes.push({
      id: uniqueId,
      ...(label ? { label } : {}),
      ...(generic ? { generic } : {}),
      ...(stereotype ? { stereotype } : {}),
      ...(namespace ? { namespace } : {}),
      ...(color ? { color } : {}),
      members,
    });
  }

  const validClassIds = new Set(classes.map((c) => c.id));
  const usedRelIds = new Set<string>();
  const relations: ClassRelationData[] = [];

  for (let i = 0; i < rawData.relations.length; i += 1) {
    const rawRel = rawData.relations[i];
    if (!rawRel || typeof rawRel.from !== 'string' || typeof rawRel.to !== 'string') {
      continue;
    }
    const from = classIdMap.get(rawRel.from) ?? sanitizeClassId(rawRel.from);
    const to = classIdMap.get(rawRel.to) ?? sanitizeClassId(rawRel.to);
    if (!validClassIds.has(from) || !validClassIds.has(to)) {
      continue;
    }

    const relBaseId =
      typeof rawRel.id === 'string' && rawRel.id.trim()
        ? rawRel.id.replace(/[^a-zA-Z0-9_-]/g, '_')
        : `rel_${usedRelIds.size + 1}`;
    const id = allocateUniqueId(relBaseId, usedRelIds);
    const relationType: ClassRelationType = VALID_RELATION_TYPES.has(rawRel.relationType)
      ? rawRel.relationType
      : '-->';
    const fromCardinality =
      typeof rawRel.fromCardinality === 'string'
        ? sanitizeClassQuotedText(rawRel.fromCardinality)
        : '';
    const toCardinality =
      typeof rawRel.toCardinality === 'string'
        ? sanitizeClassQuotedText(rawRel.toCardinality)
        : '';
    const label =
      typeof rawRel.label === 'string' ? sanitizeClassMemberText(rawRel.label) : '';

    relations.push({
      id,
      from,
      to,
      relationType,
      ...(fromCardinality ? { fromCardinality } : {}),
      ...(toCardinality ? { toCardinality } : {}),
      ...(label ? { label } : {}),
    });
  }

  const usedNoteIds = new Set<string>();
  const notes: ClassNoteData[] = [];
  for (let i = 0; i < (rawData.notes ?? []).length; i += 1) {
    const rawNote = rawData.notes?.[i];
    if (!rawNote || typeof rawNote !== 'object') {
      continue;
    }
    const text =
      typeof rawNote.text === 'string' ? sanitizeClassQuotedText(rawNote.text) : '';
    if (!text) {
      continue;
    }
    const noteBaseId =
      typeof rawNote.id === 'string' && rawNote.id.trim()
        ? rawNote.id.replace(/[^a-zA-Z0-9_-]/g, '_')
        : `note_${usedNoteIds.size + 1}`;
    const id = allocateUniqueId(noteBaseId, usedNoteIds);
    let targetClassId: string | undefined;
    if (typeof rawNote.targetClassId === 'string' && rawNote.targetClassId.trim()) {
      const mapped =
        classIdMap.get(rawNote.targetClassId) ?? sanitizeClassId(rawNote.targetClassId);
      if (validClassIds.has(mapped)) {
        targetClassId = mapped;
      }
    }
    notes.push({
      id,
      ...(targetClassId ? { targetClassId } : {}),
      text,
    });
  }

  const title =
    typeof rawData.title === 'string' ? sanitizeClassQuotedText(rawData.title) : '';
  const direction: ClassDiagramDirection =
    rawData.direction && VALID_DIRECTIONS.has(rawData.direction)
      ? rawData.direction
      : 'TB';
  const comments = Array.isArray(rawData.comments)
    ? rawData.comments
        .filter((c): c is string => typeof c === 'string')
        .map(sanitizeSingleLineComment)
        .filter((c) => c.length > 0)
    : undefined;

  return {
    diagramType: 'class',
    ...(title ? { title } : {}),
    direction,
    classes,
    relations,
    ...(notes.length > 0 ? { notes } : {}),
    ...(comments && comments.length > 0 ? { comments } : {}),
  };
}

export function createUniqueClassId(classes: ReadonlyArray<ClassNodeData>): string {
  const used = new Set(classes.map((c) => c.id));
  let idx = classes.length + 1;
  while (used.has(`Class_${idx}`)) {
    idx += 1;
  }
  return `Class_${idx}`;
}

export function createUniqueClassMemberId(classes: ReadonlyArray<ClassNodeData>): string {
  const used = new Set<string>();
  for (const cls of classes) {
    for (const m of cls.members) {
      used.add(m.id);
    }
  }
  let idx = used.size + 1;
  while (used.has(`m_${idx}`)) {
    idx += 1;
  }
  return `m_${idx}`;
}

export function createUniqueClassRelationId(
  relations: ReadonlyArray<ClassRelationData>
): string {
  const used = new Set(relations.map((r) => r.id));
  let idx = relations.length + 1;
  while (used.has(`rel_${idx}`)) {
    idx += 1;
  }
  return `rel_${idx}`;
}

export function createUniqueClassNoteId(notes: ReadonlyArray<ClassNoteData>): string {
  const used = new Set(notes.map((n) => n.id));
  let idx = notes.length + 1;
  while (used.has(`note_${idx}`)) {
    idx += 1;
  }
  return `note_${idx}`;
}
