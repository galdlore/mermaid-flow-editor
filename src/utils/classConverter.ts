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
} from '../types/editor';
import { sanitizeCssColor } from './inputSafeguard.ts';
import {
  GUI_STATE_PREFIX,
  allocateUniqueId,
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
  sanitizeYamlSingleQuoted,
  unquoteYamlString,
} from './mermaidEnvelope.ts';

const VALID_DIRECTIONS = new Set<ClassDiagramDirection>(['TB', 'BT', 'LR', 'RL']);
const VALID_VISIBILITIES = new Set<ClassMemberVisibility>(['+', '-', '#', '~', '']);
const VALID_CLASSIFIERS = new Set<ClassMemberClassifier>(['none', 'static', 'abstract']);
const VALID_MEMBER_KINDS = new Set<ClassMemberKind>(['field', 'method']);
const VALID_RELATION_TYPES = new Set<ClassRelationType>([
  '--|>',
  '..|>',
  '*--',
  'o--',
  '-->',
  '..>',
  '--',
  '..',
]);

const RESERVED_CLASS_KEYWORDS = new Set([
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

function sanitizeClassQuotedText(raw: string): string {
  return raw
    .replace(/[\r\n]+/g, ' ')
    .replace(/;/g, ' ')
    .replace(/"/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeClassMemberText(raw: string): string {
  return raw
    .replace(/[;{}\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeClassGeneric(raw: string): string {
  return raw
    .replace(/[;{}\r\n~"`<>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeNamespace(raw: string): string | undefined {
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

function emitClassDeclaration(
  lines: string[],
  cls: ClassNodeData,
  colorClassMap: Map<string, string>,
  indent: string
): void {
  const genericPart = cls.generic ? `~${cls.generic}~` : '';
  const labelPart = cls.label ? `["${sanitizeClassQuotedText(cls.label)}"]` : '';
  const classStylePart =
    cls.color && colorClassMap.has(cls.color)
      ? `:::${colorClassMap.get(cls.color)}`
      : '';
  const header = `${indent}class ${cls.id}${genericPart}${labelPart}${classStylePart}`;

  if (!cls.stereotype && cls.members.length === 0) {
    lines.push(header);
    return;
  }

  lines.push(`${header} {`);
  if (cls.stereotype) {
    lines.push(`${indent}  <<${cls.stereotype}>>`);
  }
  for (const member of cls.members) {
    lines.push(`${indent}  ${formatClassMemberSignature(member)}`);
  }
  lines.push(`${indent}}`);
}

export function generateClassCode(rawData: ClassDiagramData): string {
  const data = normalizeClassData(rawData);
  const lines: string[] = [];

  if (data.title) {
    lines.push('---');
    lines.push(`title: '${sanitizeYamlSingleQuoted(data.title)}'`);
    lines.push('---');
  }

  lines.push('classDiagram');

  for (const comment of data.comments ?? []) {
    const clean = sanitizeSingleLineComment(comment);
    if (clean) {
      lines.push(`  %% ${clean}`);
    }
  }

  if (data.direction && data.direction !== 'TB') {
    lines.push(`  direction ${data.direction}`);
  }

  const colorToClassName = new Map<string, string>();
  for (const cls of data.classes) {
    if (cls.color && !colorToClassName.has(cls.color)) {
      const className = `cls_color_${colorToClassName.size + 1}`;
      colorToClassName.set(cls.color, className);
      lines.push(`  classDef ${className} fill:${cls.color},stroke:#64748b,color:#0f172a`);
    }
  }

  const emittedNamespaces = new Set<string>();
  for (const cls of data.classes) {
    if (cls.namespace) {
      if (emittedNamespaces.has(cls.namespace)) {
        continue;
      }
      emittedNamespaces.add(cls.namespace);
      lines.push(`  namespace ${cls.namespace} {`);
      for (const nsMember of data.classes) {
        if (nsMember.namespace === cls.namespace) {
          emitClassDeclaration(lines, nsMember, colorToClassName, '    ');
        }
      }
      lines.push('  }');
    } else {
      emitClassDeclaration(lines, cls, colorToClassName, '  ');
    }
  }

  for (const note of data.notes ?? []) {
    const text = `"${sanitizeClassQuotedText(note.text)}"`;
    if (note.targetClassId) {
      lines.push(`  note for ${note.targetClassId} ${text}`);
    } else {
      lines.push(`  note ${text}`);
    }
  }

  for (const rel of data.relations) {
    const parts = [rel.from];
    if (rel.fromCardinality) {
      parts.push(`"${sanitizeClassQuotedText(rel.fromCardinality)}"`);
    }
    parts.push(rel.relationType);
    if (rel.toCardinality) {
      parts.push(`"${sanitizeClassQuotedText(rel.toCardinality)}"`);
    }
    parts.push(rel.to);
    const labelPart = rel.label ? ` : ${sanitizeClassMemberText(rel.label)}` : '';
    lines.push(`  ${parts.join(' ')}${labelPart}`);
  }

  lines.push(formatGuiStateLine(data));
  return lines.join('\n');
}

function parseClassMemberLine(
  rawLine: string,
  nextMemberId: () => string
): ClassMemberData | null {
  const trimmed = rawLine.trim();
  if (!trimmed || trimmed.startsWith('<<')) {
    return null;
  }

  let rest = trimmed;
  let visibility: ClassMemberVisibility = '';
  const firstCh = rest[0];
  if (firstCh === '+' || firstCh === '-' || firstCh === '#' || firstCh === '~') {
    visibility = firstCh;
    rest = rest.slice(1).trim();
  }

  const methodMatch = rest.match(/^([^\s(]+)\s*\(([^)]*)\)\s*([*$])?(?:\s+(.*))?$/);
  if (methodMatch) {
    const name = sanitizeClassMemberText(methodMatch[1]);
    const params = sanitizeClassMemberText(methodMatch[2]);
    const mod = methodMatch[3];
    const classifier: ClassMemberClassifier | undefined =
      mod === '$' ? 'static' : mod === '*' ? 'abstract' : undefined;
    const type = methodMatch[4] ? sanitizeClassMemberText(methodMatch[4]) : '';

    return {
      id: nextMemberId(),
      kind: 'method',
      visibility,
      name: name || 'method',
      ...(type ? { type } : {}),
      ...(params ? { params } : {}),
      ...(classifier ? { classifier } : {}),
    };
  }

  let classifier: ClassMemberClassifier | undefined;
  if (rest.endsWith('$')) {
    classifier = 'static';
    rest = rest.slice(0, -1).trim();
  } else if (rest.endsWith('*')) {
    classifier = 'abstract';
    rest = rest.slice(0, -1).trim();
  }

  const colonIdx = rest.indexOf(':');
  if (colonIdx > 0) {
    const name = sanitizeClassMemberText(rest.slice(0, colonIdx));
    const type = sanitizeClassMemberText(rest.slice(colonIdx + 1));
    return {
      id: nextMemberId(),
      kind: 'field',
      visibility,
      name: name || 'field',
      ...(type ? { type } : {}),
      ...(classifier ? { classifier } : {}),
    };
  }

  const tokens = rest.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    const name = sanitizeClassMemberText(tokens[tokens.length - 1]);
    const type = sanitizeClassMemberText(tokens.slice(0, -1).join(' '));
    return {
      id: nextMemberId(),
      kind: 'field',
      visibility,
      name: name || 'field',
      ...(type ? { type } : {}),
      ...(classifier ? { classifier } : {}),
    };
  }

  if (tokens.length === 1) {
    return {
      id: nextMemberId(),
      kind: 'field',
      visibility,
      name: sanitizeClassMemberText(tokens[0]) || 'field',
      ...(classifier ? { classifier } : {}),
    };
  }

  return null;
}

const RELATION_REVERSED_MAP: Record<string, ClassRelationType> = {
  '<|--': '--|>',
  '<|..': '..|>',
  '--*': '*--',
  '--o': 'o--',
  '<--': '-->',
  '<..': '..>',
};

const CLASS_RELATION_REGEX =
  /^([a-zA-Z0-9_-]+?)(?:~([^~]+)~)?\s*(?:"([^"]*)")?\s*(<\|--|--\|>|<\|\.\.|\.\.\|>|\*--|--\*|o--|--o|-->|<--|\.\.>|\<\.\.|--|\.\.)\s*(?:"([^"]*)")?\s*([a-zA-Z0-9_-]+)(?:~([^~]+)~)?(?:\s*:\s*(.*))?$/;

const CLASS_HEADER_REGEX =
  /^class\s+([a-zA-Z0-9_-]+)(?:~([^~]+)~)?(?:\["([^"]*)"\])?(?::::([a-zA-Z0-9_-]+))?\s*(\{)?\s*$/;

export function parseClassCodeToGuiData(code: string): ClassDiagramData {
  const lines = code.split(/\r?\n/);

  const restored = extractGuiStateJson(lines, isValidClassData);
  if (restored) {
    return normalizeClassData(restored);
  }

  let title = '';
  let direction: ClassDiagramDirection = 'TB';
  const classes: ClassNodeData[] = [];
  const classMap = new Map<string, ClassNodeData>();
  const relations: ClassRelationData[] = [];
  const notes: ClassNoteData[] = [];
  const comments: string[] = [];
  const classColors = new Map<string, string>();
  const nodeStyleClassMap = new Map<string, string>();

  let inFrontmatter = false;
  let seenHeader = false;
  let currentNamespace: string | null = null;
  let activeClass: ClassNodeData | null = null;
  let memberCounter = 1;
  let relCounter = 1;
  let noteCounter = 1;

  const nextMemberId = () => `m_${memberCounter++}`;

  const ensureClass = (rawId: string, generic?: string): ClassNodeData => {
    const safeId = sanitizeClassId(rawId);
    let existing = classMap.get(safeId);
    if (!existing) {
      existing = {
        id: safeId,
        ...(generic ? { generic: sanitizeClassGeneric(generic) } : {}),
        ...(currentNamespace ? { namespace: currentNamespace } : {}),
        members: [],
      };
      classes.push(existing);
      classMap.set(safeId, existing);
    } else {
      if (generic && !existing.generic) {
        existing.generic = sanitizeClassGeneric(generic);
      }
      if (currentNamespace && !existing.namespace) {
        existing.namespace = currentNamespace;
      }
    }
    return existing;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();

    if (i === 0 && trimmed === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (trimmed === '---') {
        inFrontmatter = false;
        continue;
      }
      const titleMatch = trimmed.match(/^title:\s*(.+)$/);
      if (titleMatch) {
        title = unquoteYamlString(titleMatch[1]);
      }
      continue;
    }

    if (trimmed.startsWith('%%')) {
      if (!trimmed.startsWith(GUI_STATE_PREFIX)) {
        const body = trimmed.slice(2).trim();
        if (body && !body.startsWith('{')) {
          comments.push(body);
        }
      }
      continue;
    }

    if (!trimmed) {
      continue;
    }

    if (!seenHeader) {
      if (/^classDiagram(?:-v2)?\b/i.test(trimmed)) {
        seenHeader = true;
      }
      continue;
    }

    if (activeClass) {
      if (trimmed === '}') {
        activeClass = null;
        continue;
      }
      const stereoMatch = trimmed.match(/^<<\s*([^>]+?)\s*>>$/);
      if (stereoMatch) {
        activeClass.stereotype = sanitizeClassQuotedText(stereoMatch[1]);
        continue;
      }
      const member = parseClassMemberLine(trimmed, nextMemberId);
      if (member) {
        activeClass.members.push(member);
      }
      continue;
    }

    if (trimmed === '}') {
      if (currentNamespace) {
        currentNamespace = null;
      }
      continue;
    }

    if (/^title\s+(.+)$/i.test(trimmed)) {
      const m = trimmed.match(/^title\s+(.+)$/i);
      if (m?.[1]) {
        title = unquoteYamlString(m[1]);
      }
      continue;
    }

    const dirMatch = trimmed.match(/^direction\s+(TB|BT|LR|RL)\b/i);
    if (dirMatch) {
      direction = dirMatch[1].toUpperCase() as ClassDiagramDirection;
      continue;
    }

    const nsMatch = trimmed.match(/^namespace\s+([a-zA-Z0-9_.-]+)\s*\{$/);
    if (nsMatch) {
      currentNamespace = sanitizeNamespace(nsMatch[1]) ?? null;
      continue;
    }

    const classDefMatch = trimmed.match(/^classDef\s+([a-zA-Z0-9_-]+)\s+(.+)$/i);
    if (classDefMatch) {
      const fillMatch = classDefMatch[2].match(/fill:\s*([^,\s]+)/i);
      const color = fillMatch ? sanitizeCssColor(fillMatch[1]) : undefined;
      if (color) {
        classColors.set(classDefMatch[1], color);
      }
      continue;
    }

    const cssClassMatch = trimmed.match(/^cssClass\s+"([^"]+)"\s+([a-zA-Z0-9_-]+)$/i);
    if (cssClassMatch) {
      for (const rawTarget of cssClassMatch[1].split(',')) {
        const cleanTarget = sanitizeClassId(rawTarget);
        if (cleanTarget) {
          nodeStyleClassMap.set(cleanTarget, cssClassMatch[2]);
        }
      }
      continue;
    }

    const noteForMatch = trimmed.match(/^note\s+for\s+([a-zA-Z0-9_-]+)\s+"([^"]*)"$/i);
    if (noteForMatch) {
      const cls = ensureClass(noteForMatch[1]);
      notes.push({
        id: `note_${noteCounter++}`,
        targetClassId: cls.id,
        text: sanitizeClassQuotedText(noteForMatch[2]),
      });
      continue;
    }

    const generalNoteMatch = trimmed.match(/^note\s+"([^"]*)"$/i);
    if (generalNoteMatch) {
      notes.push({
        id: `note_${noteCounter++}`,
        text: sanitizeClassQuotedText(generalNoteMatch[1]),
      });
      continue;
    }

    const classMatch = trimmed.match(CLASS_HEADER_REGEX);
    if (classMatch) {
      const cls = ensureClass(classMatch[1], classMatch[2]);
      if (classMatch[3] !== undefined) {
        cls.label = sanitizeClassQuotedText(classMatch[3]);
      }
      if (classMatch[4]) {
        nodeStyleClassMap.set(cls.id, classMatch[4]);
      }
      if (classMatch[5] === '{') {
        activeClass = cls;
      }
      continue;
    }

    const bareClsStyleMatch = trimmed.match(/^class\s+([a-zA-Z0-9_-]+)\s+([a-zA-Z0-9_-]+)$/);
    if (bareClsStyleMatch) {
      const cls = ensureClass(bareClsStyleMatch[1]);
      nodeStyleClassMap.set(cls.id, bareClsStyleMatch[2]);
      continue;
    }

    const relMatch = trimmed.match(CLASS_RELATION_REGEX);
    if (relMatch) {
      const clsA = ensureClass(relMatch[1], relMatch[2]);
      const cardA = relMatch[3] ? sanitizeClassQuotedText(relMatch[3]) : undefined;
      const op = relMatch[4];
      const cardB = relMatch[5] ? sanitizeClassQuotedText(relMatch[5]) : undefined;
      const clsB = ensureClass(relMatch[6], relMatch[7]);
      const label = relMatch[8] ? sanitizeClassMemberText(relMatch[8]) : undefined;

      const reversed = RELATION_REVERSED_MAP[op];
      if (reversed) {
        relations.push({
          id: `rel_${relCounter++}`,
          from: clsB.id,
          to: clsA.id,
          relationType: reversed,
          ...(cardB ? { fromCardinality: cardB } : {}),
          ...(cardA ? { toCardinality: cardA } : {}),
          ...(label ? { label } : {}),
        });
      } else {
        const relType: ClassRelationType = VALID_RELATION_TYPES.has(op as ClassRelationType)
          ? (op as ClassRelationType)
          : '-->';
        relations.push({
          id: `rel_${relCounter++}`,
          from: clsA.id,
          to: clsB.id,
          relationType: relType,
          ...(cardA ? { fromCardinality: cardA } : {}),
          ...(cardB ? { toCardinality: cardB } : {}),
          ...(label ? { label } : {}),
        });
      }
      continue;
    }

    // 単一行メンバー定義: User : +int id または User : <<interface>>
    const inlineMemberMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.+)$/);
    if (inlineMemberMatch && !RESERVED_CLASS_KEYWORDS.has(inlineMemberMatch[1].toLowerCase())) {
      const cls = ensureClass(inlineMemberMatch[1]);
      const rhs = inlineMemberMatch[2].trim();
      const stereoMatch = rhs.match(/^<<\s*([^>]+?)\s*>>$/);
      if (stereoMatch) {
        cls.stereotype = sanitizeClassQuotedText(stereoMatch[1]);
      } else {
        const member = parseClassMemberLine(rhs, nextMemberId);
        if (member) {
          cls.members.push(member);
        }
      }
    }
  }

  for (const cls of classes) {
    const styleName = nodeStyleClassMap.get(cls.id);
    if (styleName && classColors.has(styleName)) {
      cls.color = classColors.get(styleName);
    }
  }

  return normalizeClassData({
    diagramType: 'class',
    ...(title ? { title } : {}),
    direction,
    classes,
    relations,
    ...(notes.length > 0 ? { notes } : {}),
    ...(comments.length > 0 ? { comments } : {}),
  });
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
