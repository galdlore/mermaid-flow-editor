import type {
  ErAttributeData,
  ErAttributeKey,
  ErCardinality,
  ErDiagramData,
  ErDiagramDirection,
  ErEntityData,
  ErRelationshipData,
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

const VALID_DIRECTIONS = new Set<ErDiagramDirection>(['TB', 'BT', 'LR', 'RL']);
const VALID_CARDINALITIES = new Set<ErCardinality>([
  'zero_or_one',
  'exactly_one',
  'zero_or_more',
  'one_or_more',
]);
const KEY_ORDER: ReadonlyArray<ErAttributeKey> = ['PK', 'FK', 'UK'];
const VALID_ATTR_KEYS = new Set<ErAttributeKey>(KEY_ORDER);

const RESERVED_ER_KEYWORDS = new Set([
  'erdiagram',
  'direction',
  'title',
  'classdef',
  'class',
  'style',
  'linkstyle',
  'end',
  'one',
  'zero',
  'many',
  'only',
  'to',
  'or',
  'more',
  'optionally',
]);

export const ER_DIRECTION_OPTIONS: ReadonlyArray<ErDiagramDirection> = ['TB', 'LR', 'BT', 'RL'];

export const ER_CARDINALITY_OPTIONS: ReadonlyArray<ErCardinality> = [
  'exactly_one',
  'zero_or_one',
  'one_or_more',
  'zero_or_more',
];

export const ER_ATTR_TYPE_SUGGESTIONS: ReadonlyArray<string> = [
  'int',
  'bigint',
  'string',
  'varchar(255)',
  'text',
  'boolean',
  'datetime',
  'decimal(10,2)',
  'uuid',
];

const LEFT_CARDINALITY_SYMBOLS: Record<ErCardinality, string> = {
  zero_or_one: '|o',
  exactly_one: '||',
  zero_or_more: '}o',
  one_or_more: '}|',
};

const RIGHT_CARDINALITY_SYMBOLS: Record<ErCardinality, string> = {
  zero_or_one: 'o|',
  exactly_one: '||',
  zero_or_more: 'o{',
  one_or_more: '|{',
};

const PARSE_CARDINALITY_TOKENS: Record<string, ErCardinality> = {
  '|o': 'zero_or_one',
  'o|': 'zero_or_one',
  '||': 'exactly_one',
  '}o': 'zero_or_more',
  'o{': 'zero_or_more',
  '}|': 'one_or_more',
  '|{': 'one_or_more',
};

export function formatErCardinalityPairSymbol(
  fromCard: ErCardinality,
  toCard: ErCardinality,
  identifying: boolean
): string {
  const link = identifying ? '--' : '..';
  return `${LEFT_CARDINALITY_SYMBOLS[fromCard]}${link}${RIGHT_CARDINALITY_SYMBOLS[toCard]}`;
}

export function createDefaultErData(lang: 'ja' | 'en' = 'ja'): ErDiagramData {
  if (lang === 'en') {
    return {
      diagramType: 'er',
      title: 'Order Management Schema',
      direction: 'TB',
      entities: [
        {
          id: 'CUSTOMER',
          alias: 'Customer',
          attributes: [
            { id: 'attr_1', type: 'int', name: 'id', keys: ['PK'], comment: 'Customer ID' },
            { id: 'attr_2', type: 'varchar(120)', name: 'email', keys: ['UK'], comment: 'Email address' },
            { id: 'attr_3', type: 'string', name: 'name', comment: 'Customer name' },
          ],
        },
        {
          id: 'ORDER',
          alias: 'Order',
          attributes: [
            { id: 'attr_4', type: 'int', name: 'id', keys: ['PK'], comment: 'Order ID' },
            { id: 'attr_5', type: 'int', name: 'customer_id', keys: ['FK'], comment: 'Customer ref' },
            { id: 'attr_6', type: 'datetime', name: 'ordered_at', comment: 'Order timestamp' },
          ],
        },
        {
          id: 'ORDER_ITEM',
          alias: 'Order Item',
          attributes: [
            { id: 'attr_7', type: 'int', name: 'id', keys: ['PK'] },
            { id: 'attr_8', type: 'int', name: 'order_id', keys: ['FK'] },
            { id: 'attr_9', type: 'int', name: 'quantity' },
          ],
        },
      ],
      relationships: [
        {
          id: 'rel_1',
          from: 'CUSTOMER',
          to: 'ORDER',
          fromCardinality: 'exactly_one',
          toCardinality: 'zero_or_more',
          identifying: true,
          label: 'places',
        },
        {
          id: 'rel_2',
          from: 'ORDER',
          to: 'ORDER_ITEM',
          fromCardinality: 'exactly_one',
          toCardinality: 'one_or_more',
          identifying: true,
          label: 'contains',
        },
      ],
    };
  }

  return {
    diagramType: 'er',
    title: '受注管理スキーマ',
    direction: 'TB',
    entities: [
      {
        id: 'CUSTOMER',
        alias: '顧客',
        attributes: [
          { id: 'attr_1', type: 'int', name: 'id', keys: ['PK'], comment: '顧客ID' },
          { id: 'attr_2', type: 'varchar(120)', name: 'email', keys: ['UK'], comment: 'メールアドレス' },
          { id: 'attr_3', type: 'string', name: 'name', comment: '顧客名' },
        ],
      },
      {
        id: 'ORDER',
        alias: '注文',
        attributes: [
          { id: 'attr_4', type: 'int', name: 'id', keys: ['PK'], comment: '注文ID' },
          { id: 'attr_5', type: 'int', name: 'customer_id', keys: ['FK'], comment: '顧客参照' },
          { id: 'attr_6', type: 'datetime', name: 'ordered_at', comment: '注文日時' },
        ],
      },
      {
        id: 'ORDER_ITEM',
        alias: '受注明細',
        attributes: [
          { id: 'attr_7', type: 'int', name: 'id', keys: ['PK'] },
          { id: 'attr_8', type: 'int', name: 'order_id', keys: ['FK'] },
          { id: 'attr_9', type: 'int', name: 'quantity', comment: '数量' },
        ],
      },
    ],
    relationships: [
      {
        id: 'rel_1',
        from: 'CUSTOMER',
        to: 'ORDER',
        fromCardinality: 'exactly_one',
        toCardinality: 'zero_or_more',
        identifying: true,
        label: '注文する',
      },
      {
        id: 'rel_2',
        from: 'ORDER',
        to: 'ORDER_ITEM',
        fromCardinality: 'exactly_one',
        toCardinality: 'one_or_more',
        identifying: true,
        label: '明細を持つ',
      },
    ],
  };
}

export function sanitizeErEntityId(rawId: string, fallbackPrefix = 'ENTITY'): string {
  const cleaned = rawId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!cleaned) {
    return fallbackPrefix;
  }
  const withAlpha = /^[a-zA-Z]/.test(cleaned) ? cleaned : `${fallbackPrefix}_${cleaned}`;
  if (RESERVED_ER_KEYWORDS.has(withAlpha.toLowerCase())) {
    return `${withAlpha}_TBL`;
  }
  return withAlpha;
}

function sanitizeErQuotedText(raw: string): string {
  return raw
    .replace(/[\r\n]+/g, ' ')
    .replace(/"/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeErAttrType(raw: string): string {
  const cleaned = raw.replace(/[\s"{};\r\n]/g, '').trim();
  return cleaned || 'string';
}

function sanitizeErAttrName(raw: string, fallback: string): string {
  const cleaned = raw.replace(/[\s"{},;\r\n]/g, '').trim();
  return cleaned || fallback;
}

function normalizeAttrKeys(rawKeys: unknown): ErAttributeKey[] | undefined {
  if (!Array.isArray(rawKeys)) {
    return undefined;
  }
  const present = new Set<ErAttributeKey>();
  for (const item of rawKeys) {
    if (typeof item !== 'string') continue;
    const upper = item.trim().toUpperCase() as ErAttributeKey;
    if (VALID_ATTR_KEYS.has(upper)) {
      present.add(upper);
    }
  }
  if (present.size === 0) {
    return undefined;
  }
  return KEY_ORDER.filter((k) => present.has(k));
}

export function isValidErData(value: unknown): value is ErDiagramData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Partial<ErDiagramData>;
  return (
    obj.diagramType === 'er' &&
    Array.isArray(obj.entities) &&
    Array.isArray(obj.relationships)
  );
}

export function normalizeErData(rawData: ErDiagramData): ErDiagramData {
  const usedEntityIds = new Set<string>();
  const entityIdMap = new Map<string, string>();
  const usedAttrIds = new Set<string>();
  const entities: ErEntityData[] = [];

  for (let i = 0; i < rawData.entities.length; i += 1) {
    const rawEnt = rawData.entities[i];
    if (!rawEnt || typeof rawEnt.id !== 'string') {
      continue;
    }
    const baseId = sanitizeErEntityId(rawEnt.id, `ENTITY_${i + 1}`);
    const uniqueId = allocateUniqueId(baseId, usedEntityIds);
    entityIdMap.set(rawEnt.id, uniqueId);

    const alias =
      typeof rawEnt.alias === 'string' ? sanitizeErQuotedText(rawEnt.alias) : '';
    const color = sanitizeCssColor(rawEnt.color);

    const attributes: ErAttributeData[] = [];
    const rawAttrs = Array.isArray(rawEnt.attributes) ? rawEnt.attributes : [];
    for (let j = 0; j < rawAttrs.length; j += 1) {
      const rawAttr = rawAttrs[j];
      if (!rawAttr || typeof rawAttr !== 'object') {
        continue;
      }
      const attrBaseId =
        typeof rawAttr.id === 'string' && rawAttr.id.trim()
          ? rawAttr.id.replace(/[^a-zA-Z0-9_-]/g, '_')
          : `attr_${usedAttrIds.size + 1}`;
      const attrId = allocateUniqueId(attrBaseId, usedAttrIds);
      const type = sanitizeErAttrType(typeof rawAttr.type === 'string' ? rawAttr.type : 'string');
      const name = sanitizeErAttrName(
        typeof rawAttr.name === 'string' ? rawAttr.name : '',
        `col_${j + 1}`
      );
      const keys = normalizeAttrKeys(rawAttr.keys);
      const comment =
        typeof rawAttr.comment === 'string' ? sanitizeErQuotedText(rawAttr.comment) : '';

      attributes.push({
        id: attrId,
        type,
        name,
        ...(keys ? { keys } : {}),
        ...(comment ? { comment } : {}),
      });
    }

    entities.push({
      id: uniqueId,
      ...(alias ? { alias } : {}),
      ...(color ? { color } : {}),
      attributes,
    });
  }

  const validEntityIds = new Set(entities.map((e) => e.id));
  const usedRelIds = new Set<string>();
  const relationships: ErRelationshipData[] = [];

  for (let i = 0; i < rawData.relationships.length; i += 1) {
    const rawRel = rawData.relationships[i];
    if (!rawRel || typeof rawRel.from !== 'string' || typeof rawRel.to !== 'string') {
      continue;
    }
    const from = entityIdMap.get(rawRel.from) ?? sanitizeErEntityId(rawRel.from);
    const to = entityIdMap.get(rawRel.to) ?? sanitizeErEntityId(rawRel.to);
    if (!validEntityIds.has(from) || !validEntityIds.has(to)) {
      continue;
    }

    const relBaseId =
      typeof rawRel.id === 'string' && rawRel.id.trim()
        ? rawRel.id.replace(/[^a-zA-Z0-9_-]/g, '_')
        : `rel_${usedRelIds.size + 1}`;
    const id = allocateUniqueId(relBaseId, usedRelIds);
    const fromCardinality: ErCardinality = VALID_CARDINALITIES.has(rawRel.fromCardinality)
      ? rawRel.fromCardinality
      : 'exactly_one';
    const toCardinality: ErCardinality = VALID_CARDINALITIES.has(rawRel.toCardinality)
      ? rawRel.toCardinality
      : 'zero_or_more';
    const identifying = typeof rawRel.identifying === 'boolean' ? rawRel.identifying : true;
    const label = typeof rawRel.label === 'string' ? sanitizeErQuotedText(rawRel.label) : '';

    relationships.push({
      id,
      from,
      to,
      fromCardinality,
      toCardinality,
      identifying,
      label,
    });
  }

  const title =
    typeof rawData.title === 'string' ? sanitizeErQuotedText(rawData.title) : '';
  const direction: ErDiagramDirection | undefined =
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
    diagramType: 'er',
    ...(title ? { title } : {}),
    direction,
    entities,
    relationships,
    ...(comments && comments.length > 0 ? { comments } : {}),
  };
}

export function generateErCode(rawData: ErDiagramData): string {
  const data = normalizeErData(rawData);
  const lines: string[] = [];

  if (data.title) {
    lines.push('---');
    lines.push(`title: '${sanitizeYamlSingleQuoted(data.title)}'`);
    lines.push('---');
  }

  lines.push('erDiagram');

  for (const comment of data.comments ?? []) {
    const clean = sanitizeSingleLineComment(comment);
    if (clean) {
      lines.push(`  %% ${clean}`);
    }
  }

  if (data.direction && data.direction !== 'TB') {
    lines.push(`  direction ${data.direction}`);
  }

  // エンティティ色が指定されている場合のみ classDef を生成して共有する
  const colorToClassName = new Map<string, string>();
  for (const ent of data.entities) {
    if (ent.color && !colorToClassName.has(ent.color)) {
      const className = `er_color_${colorToClassName.size + 1}`;
      colorToClassName.set(ent.color, className);
      lines.push(`  classDef ${className} fill:${ent.color},stroke:#64748b,color:#0f172a`);
    }
  }

  for (const ent of data.entities) {
    const aliasPart = ent.alias ? `["${sanitizeErQuotedText(ent.alias)}"]` : '';
    const classPart =
      ent.color && colorToClassName.has(ent.color)
        ? `:::${colorToClassName.get(ent.color)}`
        : '';
    const header = `  ${ent.id}${aliasPart}${classPart}`;

    if (ent.attributes.length === 0) {
      lines.push(header);
      continue;
    }

    lines.push(`${header} {`);
    for (const attr of ent.attributes) {
      const parts = [attr.type, attr.name];
      if (attr.keys && attr.keys.length > 0) {
        parts.push(attr.keys.join(','));
      }
      if (attr.comment) {
        parts.push(`"${sanitizeErQuotedText(attr.comment)}"`);
      }
      lines.push(`    ${parts.join(' ')}`);
    }
    lines.push('  }');
  }

  for (const rel of data.relationships) {
    const symbol = formatErCardinalityPairSymbol(
      rel.fromCardinality,
      rel.toCardinality,
      rel.identifying
    );
    // Mermaid v11のerDiagramでは空ラベル時に裸のコロンだと構文エラーになるため常にクォートする
    const safeLabel = rel.label ? `"${sanitizeErQuotedText(rel.label)}"` : '""';
    lines.push(`  ${rel.from} ${symbol} ${rel.to} : ${safeLabel}`);
  }

  lines.push(formatGuiStateLine(data));
  return lines.join('\n');
}

function unquoteErText(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseAttributeLine(
  line: string,
  nextAttrId: () => string
): ErAttributeData | null {
  const match = line.match(
    /^([^\s"{};]+)\s+([^\s"{},;]+)(?:\s+([A-Za-z,\s]+?))?(?:\s+"([^"]*)")?\s*$/
  );
  if (!match) {
    return null;
  }

  const type = sanitizeErAttrType(match[1]);
  const name = sanitizeErAttrName(match[2], 'col');
  const rawKeyStr = match[3]?.trim() ?? '';
  const keys = rawKeyStr
    ? normalizeAttrKeys(rawKeyStr.split(/[\s,]+/))
    : undefined;
  const comment = match[4] !== undefined ? sanitizeErQuotedText(match[4]) : '';

  return {
    id: nextAttrId(),
    type,
    name,
    ...(keys ? { keys } : {}),
    ...(comment ? { comment } : {}),
  };
}

const RELATIONSHIP_LINE_REGEX =
  /^([a-zA-Z0-9_-]+?)\s*(\|o|o\||\|\||\}o|o\{|\}\||\|\{)\s*(--|\.\.)\s*(\|o|o\||\|\||\}o|o\{|\}\||\|\{)\s*([a-zA-Z0-9_-]+)\s*:\s*(.*)$/;

const ENTITY_BLOCK_HEADER_REGEX =
  /^([a-zA-Z0-9_-]+)(?:\["([^"]*)"\])?(?::::([a-zA-Z0-9_-]+))?\s*(?:\{(.*)\})?\s*$/;

export function parseErCodeToGuiData(code: string): ErDiagramData {
  const lines = code.split(/\r?\n/);

  const restored = extractGuiStateJson(lines, isValidErData);
  if (restored) {
    return normalizeErData(restored);
  }

  let title = '';
  let direction: ErDiagramDirection = 'TB';
  const entities: ErEntityData[] = [];
  const entityMap = new Map<string, ErEntityData>();
  const relationships: ErRelationshipData[] = [];
  const comments: string[] = [];
  const classColors = new Map<string, string>();
  const entityClassMap = new Map<string, string>();

  let inFrontmatter = false;
  let seenHeader = false;
  let activeEntity: ErEntityData | null = null;
  let attrCounter = 1;
  let relCounter = 1;

  const nextAttrId = () => `attr_${attrCounter++}`;

  const ensureEntity = (rawId: string): ErEntityData => {
    const safeId = sanitizeErEntityId(rawId);
    let existing = entityMap.get(safeId);
    if (!existing) {
      existing = { id: safeId, attributes: [] };
      entities.push(existing);
      entityMap.set(safeId, existing);
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
      if (/^erDiagram\b/i.test(trimmed)) {
        seenHeader = true;
      }
      continue;
    }

    if (activeEntity) {
      if (trimmed === '}') {
        activeEntity = null;
        continue;
      }
      if (trimmed.endsWith('}')) {
        const inner = trimmed.slice(0, -1).trim();
        if (inner) {
          const attr = parseAttributeLine(inner, nextAttrId);
          if (attr) {
            activeEntity.attributes.push(attr);
          }
        }
        activeEntity = null;
        continue;
      }
      const attr = parseAttributeLine(trimmed, nextAttrId);
      if (attr) {
        activeEntity.attributes.push(attr);
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
      direction = dirMatch[1].toUpperCase() as ErDiagramDirection;
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

    const relMatch = trimmed.match(RELATIONSHIP_LINE_REGEX);
    if (relMatch) {
      const fromEnt = ensureEntity(relMatch[1]);
      const leftCard = PARSE_CARDINALITY_TOKENS[relMatch[2]] ?? 'exactly_one';
      const identifying = relMatch[3] === '--';
      const rightCard = PARSE_CARDINALITY_TOKENS[relMatch[4]] ?? 'zero_or_more';
      const toEnt = ensureEntity(relMatch[5]);
      const label = unquoteErText(relMatch[6]);

      relationships.push({
        id: `rel_${relCounter++}`,
        from: fromEnt.id,
        to: toEnt.id,
        fromCardinality: leftCard,
        toCardinality: rightCard,
        identifying,
        label,
      });
      continue;
    }

    // 複数行エンティティブロックの開始: ENTITY["alias"]:::cls {
    if (trimmed.endsWith('{')) {
      const headerPart = trimmed.slice(0, -1).trim();
      const headMatch = headerPart.match(
        /^([a-zA-Z0-9_-]+)(?:\["([^"]*)"\])?(?::::([a-zA-Z0-9_-]+))?$/
      );
      if (headMatch) {
        const ent = ensureEntity(headMatch[1]);
        if (headMatch[2] !== undefined) {
          ent.alias = sanitizeErQuotedText(headMatch[2]);
        }
        if (headMatch[3]) {
          entityClassMap.set(ent.id, headMatch[3]);
        }
        activeEntity = ent;
      }
      continue;
    }

    // 1行ブロックまたは属性なしエンティティ: ENTITY["alias"]:::cls [{ int id PK }]
    const entityMatch = trimmed.match(ENTITY_BLOCK_HEADER_REGEX);
    if (entityMatch && !RESERVED_ER_KEYWORDS.has(entityMatch[1].toLowerCase())) {
      const ent = ensureEntity(entityMatch[1]);
      if (entityMatch[2] !== undefined) {
        ent.alias = sanitizeErQuotedText(entityMatch[2]);
      }
      if (entityMatch[3]) {
        entityClassMap.set(ent.id, entityMatch[3]);
      }
      if (entityMatch[4]?.trim()) {
        const attr = parseAttributeLine(entityMatch[4].trim(), nextAttrId);
        if (attr) {
          ent.attributes.push(attr);
        }
      }
    }
  }

  for (const ent of entities) {
    const className = entityClassMap.get(ent.id);
    if (className && classColors.has(className)) {
      ent.color = classColors.get(className);
    }
  }

  return normalizeErData({
    diagramType: 'er',
    ...(title ? { title } : {}),
    direction,
    entities,
    relationships,
    ...(comments.length > 0 ? { comments } : {}),
  });
}

export function createUniqueErEntityId(entities: ReadonlyArray<ErEntityData>): string {
  const used = new Set(entities.map((e) => e.id));
  let idx = entities.length + 1;
  while (used.has(`ENTITY_${idx}`)) {
    idx += 1;
  }
  return `ENTITY_${idx}`;
}

export function createUniqueErAttributeId(entities: ReadonlyArray<ErEntityData>): string {
  const used = new Set<string>();
  for (const ent of entities) {
    for (const attr of ent.attributes) {
      used.add(attr.id);
    }
  }
  let idx = used.size + 1;
  while (used.has(`attr_${idx}`)) {
    idx += 1;
  }
  return `attr_${idx}`;
}

export function createUniqueErRelationshipId(
  relationships: ReadonlyArray<ErRelationshipData>
): string {
  const used = new Set(relationships.map((r) => r.id));
  let idx = relationships.length + 1;
  while (used.has(`rel_${idx}`)) {
    idx += 1;
  }
  return `rel_${idx}`;
}
