import type { Language } from '../locales/types.ts';
import type {
  EventModelingDataEntity,
  EventModelingDataType,
  EventModelingDiagramData,
  EventModelingEntityType,
  EventModelingFrameData,
  EventModelingFrameKind,
  EventModelingNoteData,
} from '../types/editor.ts';
import {
  allocateUniqueId,
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
  sanitizeYamlSingleQuoted,
  unquoteYamlString,
} from './mermaidEnvelope.ts';

export const EVENTMODELING_ENTITY_TYPE_OPTIONS: ReadonlyArray<EventModelingEntityType> = [
  'ui',
  'cmd',
  'rmo',
  'evt',
  'pcr',
];

export const EVENTMODELING_DATA_TYPE_OPTIONS: ReadonlyArray<EventModelingDataType> = [
  'json',
  'jsobj',
  'figma',
  'salt',
  'uri',
  'md',
  'html',
  'text',
];

const DATA_TYPE_SET = new Set<string>(EVENTMODELING_DATA_TYPE_OPTIONS);

function normalizeEntityType(raw: string): EventModelingEntityType {
  switch (raw.toLowerCase()) {
    case 'ui':
      return 'ui';
    case 'cmd':
    case 'command':
      return 'cmd';
    case 'rmo':
    case 'readmodel':
      return 'rmo';
    case 'evt':
    case 'event':
      return 'evt';
    case 'pcr':
    case 'processor':
      return 'pcr';
    default:
      return 'evt';
  }
}

export function sanitizeEventModelingId(raw: string, fallback: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_]/g, '');
  if (!cleaned) return fallback;
  return /^\d/.test(cleaned) ? `E_${cleaned}` : cleaned;
}

export function formatEventModelingFrameNumber(
  raw: string,
  indexFallback: number
): string {
  const digits = raw.replace(/[^0-9]/g, '').slice(0, 3);
  if (digits) return digits;
  const num = (indexFallback + 1) % 1000;
  return num < 10 ? `0${num}` : String(num);
}

function sanitizeInlinePayload(raw: string): string {
  return raw.replace(/["{}\r\n]/g, '').trim();
}

function indentBlockLines(rawBody: string): string[] {
  const lines = rawBody.replace(/\r\n/g, '\n').split('\n');
  const trimmedNonEmpty = lines.some((l) => l.trim().length > 0);
  if (!trimmedNonEmpty) return ['  '];
  return lines.map((l) => (l.length === 0 ? '  ' : l.startsWith('  ') ? l : `  ${l}`));
}

export function createDefaultEventModelingData(
  lang: Language = 'ja'
): EventModelingDiagramData {
  if (lang === 'en') {
    return {
      diagramType: 'eventmodeling',
      title: 'Order Workflow',
      frames: [
        {
          id: 'em1',
          frameKind: 'tf',
          frameNumber: '01',
          entityType: 'ui',
          namespace: 'Customer',
          entityName: 'OrderForm',
          sourceFrames: [],
          inlineData: 'Checkout Form',
        },
        {
          id: 'em2',
          frameKind: 'tf',
          frameNumber: '02',
          entityType: 'cmd',
          namespace: 'Order',
          entityName: 'PlaceOrder',
          sourceFrames: ['01'],
          dataRef: 'OrderPayload',
        },
        {
          id: 'em3',
          frameKind: 'tf',
          frameNumber: '03',
          entityType: 'evt',
          namespace: 'Order',
          entityName: 'OrderPlaced',
          sourceFrames: ['02'],
          inlineData: 'status: placed',
        },
        {
          id: 'em4',
          frameKind: 'tf',
          frameNumber: '04',
          entityType: 'rmo',
          namespace: 'Order',
          entityName: 'OrderSummary',
          sourceFrames: ['03'],
        },
        {
          id: 'em5',
          frameKind: 'tf',
          frameNumber: '05',
          entityType: 'pcr',
          namespace: 'Billing',
          entityName: 'InvoiceJob',
          sourceFrames: ['03'],
        },
      ],
      dataEntities: [
        {
          id: 'emd1',
          name: 'OrderPayload',
          dataType: 'json',
          body: '{\n  "orderId": "101"\n}',
        },
      ],
      notes: [
        {
          id: 'emn1',
          frameNumber: '03',
          body: 'Emit OrderPlaced event after validation',
        },
      ],
    };
  }
  return {
    diagramType: 'eventmodeling',
    title: '注文処理イベントモデル',
    frames: [
      {
        id: 'em1',
        frameKind: 'tf',
        frameNumber: '01',
        entityType: 'ui',
        namespace: 'Customer',
        entityName: 'OrderForm',
        sourceFrames: [],
        inlineData: '注文画面入力',
      },
      {
        id: 'em2',
        frameKind: 'tf',
        frameNumber: '02',
        entityType: 'cmd',
        namespace: 'Order',
        entityName: 'PlaceOrder',
        sourceFrames: ['01'],
        dataRef: 'OrderPayload',
      },
      {
        id: 'em3',
        frameKind: 'tf',
        frameNumber: '03',
        entityType: 'evt',
        namespace: 'Order',
        entityName: 'OrderPlaced',
        sourceFrames: ['02'],
        inlineData: '確定ステータス',
      },
      {
        id: 'em4',
        frameKind: 'tf',
        frameNumber: '04',
        entityType: 'rmo',
        namespace: 'Order',
        entityName: 'OrderSummary',
        sourceFrames: ['03'],
      },
      {
        id: 'em5',
        frameKind: 'tf',
        frameNumber: '05',
        entityType: 'pcr',
        namespace: 'Billing',
        entityName: 'InvoiceJob',
        sourceFrames: ['03'],
      },
    ],
    dataEntities: [
      {
        id: 'emd1',
        name: 'OrderPayload',
        dataType: 'json',
        body: '{\n  "orderId": "101"\n}',
      },
    ],
    notes: [
      {
        id: 'emn1',
        frameNumber: '03',
        body: '検証後に注文確定イベントを発行',
      },
    ],
  };
}

function isEventModelingGuiData(val: unknown): val is EventModelingDiagramData {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  return obj.diagramType === 'eventmodeling' && Array.isArray(obj.frames);
}

export function generateEventModelingCode(
  data: EventModelingDiagramData
): string {
  const lines: string[] = [];
  const trimmedTitle = data.title ? data.title.replace(/[\r\n]+/g, ' ').trim() : '';
  if (trimmedTitle) {
    lines.push('---');
    lines.push(`title: '${sanitizeYamlSingleQuoted(trimmedTitle)}'`);
    lines.push('---');
  }

  lines.push('eventmodeling');

  const safeComments = (data.comments ?? [])
    .map((c) => sanitizeSingleLineComment(c))
    .filter(Boolean);
  for (const comment of safeComments) {
    lines.push(`  %% ${comment}`);
  }

  const usedDataNames = new Set<string>();
  const normDataEntities: EventModelingDataEntity[] = [];
  for (let i = 0; i < data.dataEntities.length; i++) {
    const entity = data.dataEntities[i];
    const baseName = sanitizeEventModelingId(entity.name, `Data${i + 1}`);
    const name = allocateUniqueId(baseName, usedDataNames);
    const dataType =
      entity.dataType && DATA_TYPE_SET.has(entity.dataType)
        ? entity.dataType
        : undefined;
    const body = entity.body ?? '';
    normDataEntities.push({ ...entity, name, dataType, body });
    const typePart = dataType ? ` \`${dataType}\`` : '';
    lines.push(`  data ${name}${typePart} {`);
    for (const bodyLine of indentBlockLines(body)) {
      lines.push(bodyLine);
    }
    lines.push('}');
  }

  const usedFrameNums = new Set<string>();
  const assignedFrameNums: string[] = [];
  for (let i = 0; i < data.frames.length; i++) {
    let candidate = formatEventModelingFrameNumber(data.frames[i].frameNumber, i);
    let seq = i + 1;
    while (usedFrameNums.has(candidate)) {
      candidate = formatEventModelingFrameNumber('', seq++);
    }
    usedFrameNums.add(candidate);
    assignedFrameNums.push(candidate);
  }

  const normFrames: EventModelingFrameData[] = [];
  for (let i = 0; i < data.frames.length; i++) {
    const f = data.frames[i];
    const frameNumber = assignedFrameNums[i];
    const frameKind: EventModelingFrameKind = f.frameKind === 'rf' ? 'rf' : 'tf';
    const entityType = normalizeEntityType(f.entityType);
    const namespace = f.namespace?.trim()
      ? sanitizeEventModelingId(f.namespace, '')
      : undefined;
    const entityName = sanitizeEventModelingId(f.entityName, `Entity${i + 1}`);
    const qualifiedName = namespace ? `${namespace}.${entityName}` : entityName;
    const sourceFrames = Array.from(
      new Set(
        (f.sourceFrames ?? []).filter(
          (src) => src !== frameNumber && usedFrameNums.has(src)
        )
      )
    );
    const dataRef =
      f.dataRef && usedDataNames.has(f.dataRef) ? f.dataRef : undefined;
    const inlineDataType =
      f.inlineDataType && DATA_TYPE_SET.has(f.inlineDataType)
        ? f.inlineDataType
        : undefined;
    const inlineData = f.inlineData ? sanitizeInlinePayload(f.inlineData) : undefined;

    normFrames.push({
      ...f,
      frameKind,
      frameNumber,
      entityType,
      namespace: namespace || undefined,
      entityName,
      sourceFrames,
      dataRef,
      inlineDataType: inlineData ? inlineDataType : undefined,
      inlineData: inlineData || undefined,
    });

    let stmt = `  ${frameKind} ${frameNumber} ${entityType} ${qualifiedName}`;
    for (const src of sourceFrames) {
      stmt += ` ->> ${src}`;
    }
    if (dataRef) {
      stmt += ` [[${dataRef}]]`;
    }
    if (inlineData) {
      stmt += inlineDataType ? ` \`${inlineDataType}\` "${inlineData}"` : ` "${inlineData}"`;
    }
    lines.push(stmt);
  }

  const normNotes: EventModelingNoteData[] = [];
  for (const note of data.notes ?? []) {
    if (!usedFrameNums.has(note.frameNumber)) continue;
    const body = note.body ?? '';
    normNotes.push({ ...note, body });
    lines.push(`  note ${note.frameNumber} {`);
    for (const bodyLine of indentBlockLines(body)) {
      lines.push(bodyLine);
    }
    lines.push('}');
  }

  const guiState: EventModelingDiagramData = {
    diagramType: 'eventmodeling',
    title: trimmedTitle || undefined,
    frames: normFrames,
    dataEntities: normDataEntities,
    notes: normNotes.length > 0 ? normNotes : undefined,
    comments: safeComments.length > 0 ? safeComments : undefined,
  };
  lines.push(formatGuiStateLine(guiState));
  return lines.join('\n');
}

export function parseEventModelingCodeToGuiData(
  code: string
): EventModelingDiagramData {
  const lines = code.split(/\r?\n/);
  const guiState = extractGuiStateJson<EventModelingDiagramData>(
    lines,
    isEventModelingGuiData
  );
  if (guiState) {
    return {
      diagramType: 'eventmodeling',
      title: typeof guiState.title === 'string' && guiState.title.trim() ? guiState.title.trim() : undefined,
      frames: guiState.frames.map((f, idx) => ({
        id: String(f.id || `em_${idx + 1}`),
        frameKind: f.frameKind === 'rf' ? 'rf' : 'tf',
        frameNumber: formatEventModelingFrameNumber(String(f.frameNumber ?? ''), idx),
        entityType: normalizeEntityType(String(f.entityType ?? 'evt')),
        namespace:
          typeof f.namespace === 'string' && f.namespace.trim()
            ? sanitizeEventModelingId(f.namespace, '')
            : undefined,
        entityName: sanitizeEventModelingId(String(f.entityName ?? ''), `Entity${idx + 1}`),
        sourceFrames: Array.isArray(f.sourceFrames)
          ? f.sourceFrames.map((s) => String(s)).filter((s) => /^\d{1,3}$/.test(s))
          : [],
        dataRef:
          typeof f.dataRef === 'string' && f.dataRef.trim() ? f.dataRef.trim() : undefined,
        inlineDataType:
          typeof f.inlineDataType === 'string' && DATA_TYPE_SET.has(f.inlineDataType)
            ? f.inlineDataType
            : undefined,
        inlineData:
          typeof f.inlineData === 'string' && f.inlineData.trim()
            ? sanitizeInlinePayload(f.inlineData)
            : undefined,
      })),
      dataEntities: Array.isArray(guiState.dataEntities)
        ? guiState.dataEntities.map((d, idx) => ({
            id: String(d.id || `emd_${idx + 1}`),
            name: sanitizeEventModelingId(String(d.name ?? ''), `Data${idx + 1}`),
            dataType:
              typeof d.dataType === 'string' && DATA_TYPE_SET.has(d.dataType)
                ? d.dataType
                : undefined,
            body: typeof d.body === 'string' ? d.body : '',
          }))
        : [],
      notes: Array.isArray(guiState.notes)
        ? guiState.notes.map((n, idx) => ({
            id: String(n.id || `emn_${idx + 1}`),
            frameNumber: String(n.frameNumber ?? '01'),
            body: typeof n.body === 'string' ? n.body : '',
          }))
        : undefined,
      comments: Array.isArray(guiState.comments)
        ? guiState.comments.filter((c): c is string => typeof c === 'string')
        : undefined,
    };
  }

  let title: string | undefined;
  const comments: string[] = [];
  const frames: EventModelingFrameData[] = [];
  const dataEntities: EventModelingDataEntity[] = [];
  const notes: EventModelingNoteData[] = [];
  const usedIds = new Set<string>();

  let inFrontmatter = false;
  let blockKind: 'none' | 'data' | 'note' = 'none';
  let blockHeader: { name: string; dataType?: EventModelingDataType } = { name: '' };
  let blockBodyLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (i === 0 && trimmed === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (trimmed === '---') {
        inFrontmatter = false;
      } else {
        const tm = trimmed.match(/^title\s*:\s*(.+)$/i);
        if (tm) title = unquoteYamlString(tm[1]);
      }
      continue;
    }

    if (blockKind !== 'none') {
      if (rawLine === '}' || rawLine.startsWith('}')) {
        const body = blockBodyLines.map((l) => l.replace(/^ {2}/, '')).join('\n').trimEnd();
        if (blockKind === 'data') {
          dataEntities.push({
            id: allocateUniqueId(`emd_${dataEntities.length + 1}`, usedIds),
            name: blockHeader.name,
            dataType: blockHeader.dataType,
            body,
          });
        } else {
          notes.push({
            id: allocateUniqueId(`emn_${notes.length + 1}`, usedIds),
            frameNumber: blockHeader.name,
            body,
          });
        }
        blockKind = 'none';
        blockBodyLines = [];
      } else {
        blockBodyLines.push(rawLine);
      }
      continue;
    }

    if (!trimmed) continue;
    if (trimmed.startsWith('%%')) {
      const c = sanitizeSingleLineComment(trimmed.slice(2));
      if (c && !c.startsWith('@gui-state:')) comments.push(c);
      continue;
    }
    if (/^eventmodeling\b/i.test(trimmed)) continue;

    const dataStart = trimmed.match(
      /^data\s+([_a-zA-Z][\w]*)(?:\s+`([a-z]+)`\s*)?\s*\{$/i
    );
    if (dataStart) {
      blockKind = 'data';
      const dt = dataStart[2]?.toLowerCase();
      blockHeader = {
        name: sanitizeEventModelingId(dataStart[1], `Data${dataEntities.length + 1}`),
        dataType: dt && DATA_TYPE_SET.has(dt) ? (dt as EventModelingDataType) : undefined,
      };
      blockBodyLines = [];
      continue;
    }

    const noteStart = trimmed.match(/^note\s+(\d{1,3})\s*\{$/i);
    if (noteStart) {
      blockKind = 'note';
      blockHeader = { name: noteStart[1] };
      blockBodyLines = [];
      continue;
    }

    const frameM = trimmed.match(
      /^(tf|timeframe|rf|resetframe)\s+(\d{1,3})\s+(ui|cmd|command|evt|event|rmo|readmodel|pcr|processor)\s+([_a-zA-Z][\w.]*)(.*)$/i
    );
    if (frameM) {
      const frameKind: EventModelingFrameKind = frameM[1].toLowerCase().startsWith('r')
        ? 'rf'
        : 'tf';
      const frameNumber = frameM[2];
      const entityType = normalizeEntityType(frameM[3]);
      const qname = frameM[4];
      const parts = qname.split('.');
      const namespace =
        parts.length > 1
          ? sanitizeEventModelingId(parts.slice(0, -1).join('_'), '')
          : undefined;
      const entityName = sanitizeEventModelingId(
        parts[parts.length - 1],
        `Entity${frames.length + 1}`
      );
      let rest = frameM[5] ?? '';

      const sourceFrames: string[] = [];
      const refRegex = /->>\s*(\d{1,3})/g;
      let rm: RegExpExecArray | null;
      while ((rm = refRegex.exec(rest)) !== null) {
        sourceFrames.push(rm[1]);
      }
      rest = rest.replace(/->>\s*\d{1,3}/g, ' ').trim();

      let dataRef: string | undefined;
      const drM = rest.match(/\[\[\s*([_a-zA-Z][\w]*)\s*\]\]/);
      if (drM) {
        dataRef = drM[1];
        rest = rest.replace(drM[0], '').trim();
      }

      let inlineDataType: EventModelingDataType | undefined;
      const itM = rest.match(/^`([a-z]+)`\s*/i);
      if (itM) {
        const dt = itM[1].toLowerCase();
        if (DATA_TYPE_SET.has(dt)) inlineDataType = dt as EventModelingDataType;
        rest = rest.slice(itM[0].length).trim();
      }

      let inlineData: string | undefined;
      const inM = rest.match(/^(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/);
      if (inM) {
        inlineData = sanitizeInlinePayload(inM[1] ?? inM[2] ?? inM[3] ?? '');
      }

      frames.push({
        id: allocateUniqueId(`em_${frames.length + 1}`, usedIds),
        frameKind,
        frameNumber,
        entityType,
        namespace: namespace || undefined,
        entityName,
        sourceFrames,
        dataRef,
        inlineDataType: inlineData ? inlineDataType : undefined,
        inlineData: inlineData || undefined,
      });
    }
  }

  return {
    diagramType: 'eventmodeling',
    title,
    frames,
    dataEntities,
    notes: notes.length > 0 ? notes : undefined,
    comments: comments.length > 0 ? comments : undefined,
  };
}
