import type {
  StateDiagramData,
  StateDiagramDirection,
  StateKind,
  StateNodeData,
  StateNoteData,
  StateNotePosition,
  StateTransitionData,
} from '../types/editor';
import { sanitizeCssColor } from './inputSafeguard';
import {
  GUI_STATE_PREFIX,
  allocateUniqueId,
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
  sanitizeYamlSingleQuoted,
  unquoteYamlString,
} from './mermaidEnvelope';

export const START_END_STATE_ID = '[*]';

const VALID_DIRECTIONS = new Set<StateDiagramDirection>(['TB', 'BT', 'LR', 'RL']);
const VALID_KINDS = new Set<StateKind>([
  'normal',
  'composite',
  'choice',
  'fork',
  'join',
]);
const VALID_NOTE_POSITIONS = new Set<StateNotePosition>(['left of', 'right of']);

const RESERVED_STATE_KEYWORDS = new Set([
  'statediagram',
  'statediagram-v2',
  'state',
  'note',
  'direction',
  'title',
  'end',
  'as',
  'of',
  'left',
  'right',
  'classdef',
  'class',
  'style',
  'link',
  'callback',
  'click',
  'acctitle',
  'accdescr',
]);

export const STATE_DIRECTION_OPTIONS: ReadonlyArray<StateDiagramDirection> = [
  'TB',
  'LR',
  'BT',
  'RL',
];

export const STATE_KIND_OPTIONS: ReadonlyArray<StateKind> = [
  'normal',
  'composite',
  'choice',
  'fork',
  'join',
];

export const STATE_NOTE_POSITION_OPTIONS: ReadonlyArray<StateNotePosition> = [
  'right of',
  'left of',
];

export function createDefaultStateData(
  lang: 'ja' | 'en' = 'ja'
): StateDiagramData {
  if (lang === 'en') {
    return {
      diagramType: 'state',
      title: 'Order Processing Lifecycle',
      direction: 'TB',
      states: [
        {
          id: 'Draft',
          label: 'Draft',
          description: 'Editing order items',
          kind: 'normal',
        },
        {
          id: 'ValidateCheck',
          label: 'Validation',
          kind: 'choice',
        },
        {
          id: 'Processing',
          label: 'Processing',
          kind: 'composite',
          subDirection: 'LR',
        },
        {
          id: 'Validating',
          label: 'Validating',
          kind: 'normal',
          parentId: 'Processing',
        },
        {
          id: 'Charging',
          label: 'Charging',
          kind: 'normal',
          parentId: 'Processing',
          color: '#dbeafe',
        },
        {
          id: 'Completed',
          label: 'Completed',
          kind: 'normal',
          color: '#dcfce7',
        },
        {
          id: 'Rejected',
          label: 'Rejected',
          kind: 'normal',
          color: '#fee2e2',
        },
      ],
      transitions: [
        { id: 't_1', from: START_END_STATE_ID, to: 'Draft' },
        { id: 't_2', from: 'Draft', to: 'ValidateCheck', label: 'submit()' },
        {
          id: 't_3',
          from: 'ValidateCheck',
          to: 'Processing',
          label: '[items > 0]',
        },
        { id: 't_4', from: 'ValidateCheck', to: 'Rejected', label: '[empty]' },
        {
          id: 't_5',
          from: START_END_STATE_ID,
          to: 'Validating',
          scopeId: 'Processing',
        },
        {
          id: 't_6',
          from: 'Validating',
          to: 'Charging',
          label: 'ok',
          scopeId: 'Processing',
        },
        {
          id: 't_7',
          from: 'Charging',
          to: START_END_STATE_ID,
          scopeId: 'Processing',
        },
        { id: 't_8', from: 'Processing', to: 'Completed', label: 'paid' },
        { id: 't_9', from: 'Completed', to: START_END_STATE_ID },
        { id: 't_10', from: 'Rejected', to: START_END_STATE_ID },
      ],
      notes: [
        {
          id: 'n_1',
          targetStateId: 'Processing',
          position: 'right of',
          text: 'Retries automatically on timeout',
        },
      ],
    };
  }

  return {
    diagramType: 'state',
    title: '注文処理ライフサイクル',
    direction: 'TB',
    states: [
      {
        id: 'Draft',
        label: '下書き',
        description: '注文内容を入力中',
        kind: 'normal',
      },
      {
        id: 'ValidateCheck',
        label: '入力検証',
        kind: 'choice',
      },
      {
        id: 'Processing',
        label: '決済処理中',
        kind: 'composite',
        subDirection: 'LR',
      },
      {
        id: 'Validating',
        label: '在庫確認',
        kind: 'normal',
        parentId: 'Processing',
      },
      {
        id: 'Charging',
        label: '請求実行',
        kind: 'normal',
        parentId: 'Processing',
        color: '#dbeafe',
      },
      {
        id: 'Completed',
        label: '完了',
        kind: 'normal',
        color: '#dcfce7',
      },
      {
        id: 'Rejected',
        label: '却下',
        kind: 'normal',
        color: '#fee2e2',
      },
    ],
    transitions: [
      { id: 't_1', from: START_END_STATE_ID, to: 'Draft' },
      { id: 't_2', from: 'Draft', to: 'ValidateCheck', label: '確定する' },
      {
        id: 't_3',
        from: 'ValidateCheck',
        to: 'Processing',
        label: '[入力OK]',
      },
      { id: 't_4', from: 'ValidateCheck', to: 'Rejected', label: '[不備あり]' },
      {
        id: 't_5',
        from: START_END_STATE_ID,
        to: 'Validating',
        scopeId: 'Processing',
      },
      {
        id: 't_6',
        from: 'Validating',
        to: 'Charging',
        label: '引当成功',
        scopeId: 'Processing',
      },
      {
        id: 't_7',
        from: 'Charging',
        to: START_END_STATE_ID,
        scopeId: 'Processing',
      },
      { id: 't_8', from: 'Processing', to: 'Completed', label: '決済完了' },
      { id: 't_9', from: 'Completed', to: START_END_STATE_ID },
      { id: 't_10', from: 'Rejected', to: START_END_STATE_ID },
    ],
    notes: [
      {
        id: 'n_1',
        targetStateId: 'Processing',
        position: 'right of',
        text: 'タイムアウト時は自動リトライを行う',
      },
    ],
  };
}

export function sanitizeStateId(raw: string): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!cleaned) {
    return 'State';
  }
  const prefixed = /^[a-zA-Z_]/.test(cleaned) ? cleaned : `s_${cleaned}`;
  return RESERVED_STATE_KEYWORDS.has(prefixed.toLowerCase())
    ? `${prefixed}_state`
    : prefixed;
}

function sanitizeStateLabel(raw: string): string {
  return raw.replace(/["\r\n]/g, '').trim();
}

function sanitizeStateText(raw: string): string {
  return raw.replace(/[;\r\n]/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

export function createUniqueStateId(
  states: ReadonlyArray<StateNodeData>,
  preferred = 'State'
): string {
  const used = new Set(states.map((s) => s.id));
  const base = sanitizeStateId(preferred);
  if (!used.has(base)) {
    return base;
  }
  let idx = states.length + 1;
  while (used.has(`${base}${idx}`)) {
    idx++;
  }
  return `${base}${idx}`;
}

export function createUniqueStateTransitionId(
  transitions: ReadonlyArray<StateTransitionData>
): string {
  const used = new Set(transitions.map((t) => t.id));
  let idx = transitions.length + 1;
  while (used.has(`t_${idx}`)) {
    idx++;
  }
  return `t_${idx}`;
}

export function createUniqueStateNoteId(
  notes: ReadonlyArray<StateNoteData>
): string {
  const used = new Set(notes.map((n) => n.id));
  let idx = notes.length + 1;
  while (used.has(`n_${idx}`)) {
    idx++;
  }
  return `n_${idx}`;
}

/**
 * 状態IDを指定して子孫状態（ネストした複合状態の配下含む）の集合を返す。
 */
export function collectStateDescendantIds(
  rootId: string,
  states: ReadonlyArray<StateNodeData>
): Set<string> {
  const descendants = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const s of states) {
      if (s.parentId === current && !descendants.has(s.id) && s.id !== rootId) {
        descendants.add(s.id);
        queue.push(s.id);
      }
    }
  }
  return descendants;
}

export function isValidStateData(val: unknown): val is StateDiagramData {
  if (!val || typeof val !== 'object') {
    return false;
  }
  const obj = val as Record<string, unknown>;
  if (obj.diagramType !== 'state') {
    return false;
  }
  if (!Array.isArray(obj.states) || !Array.isArray(obj.transitions)) {
    return false;
  }
  for (const s of obj.states) {
    if (!s || typeof s !== 'object' || typeof (s as StateNodeData).id !== 'string') {
      return false;
    }
  }
  for (const t of obj.transitions) {
    if (
      !t ||
      typeof t !== 'object' ||
      typeof (t as StateTransitionData).from !== 'string' ||
      typeof (t as StateTransitionData).to !== 'string'
    ) {
      return false;
    }
  }
  return true;
}

function hasParentCycle(
  stateId: string,
  parentId: string | undefined,
  parentLookup: Map<string, string | undefined>
): boolean {
  const visited = new Set<string>([stateId]);
  let cursor = parentId;
  while (cursor) {
    if (visited.has(cursor)) {
      return true;
    }
    visited.add(cursor);
    cursor = parentLookup.get(cursor);
  }
  return false;
}

export function normalizeStateData(raw: StateDiagramData): StateDiagramData {
  const direction: StateDiagramDirection =
    raw.direction && VALID_DIRECTIONS.has(raw.direction) ? raw.direction : 'TB';
  const title = raw.title ? sanitizeYamlSingleQuoted(raw.title) : undefined;

  const usedStateIds = new Set<string>();
  const stateIdMap = new Map<string, string>();
  const states: StateNodeData[] = [];

  for (let i = 0; i < raw.states.length; i++) {
    const item = raw.states[i];
    const baseId = sanitizeStateId(item.id || `State${i + 1}`);
    const uniqueId = allocateUniqueId(baseId, usedStateIds);
    if (!stateIdMap.has(item.id)) {
      stateIdMap.set(item.id, uniqueId);
    }

    const kind: StateKind = VALID_KINDS.has(item.kind) ? item.kind : 'normal';
    const label = item.label ? sanitizeStateLabel(item.label) : undefined;
    const description =
      kind === 'normal' && item.description
        ? sanitizeStateText(item.description)
        : undefined;
    const subDirection =
      kind === 'composite' &&
      item.subDirection &&
      VALID_DIRECTIONS.has(item.subDirection)
        ? item.subDirection
        : undefined;
    const color = sanitizeCssColor(item.color);

    states.push({
      id: uniqueId,
      ...(label ? { label } : {}),
      ...(description ? { description } : {}),
      kind,
      ...(item.parentId ? { parentId: item.parentId } : {}),
      ...(subDirection ? { subDirection } : {}),
      ...(color ? { color } : {}),
    });
  }

  const stateById = new Map(states.map((s) => [s.id, s]));
  const rawParentLookup = new Map<string, string | undefined>();
  for (const s of states) {
    const mappedParent = s.parentId ? stateIdMap.get(s.parentId) : undefined;
    const parentNode = mappedParent ? stateById.get(mappedParent) : undefined;
    const validParent =
      parentNode && parentNode.kind === 'composite' && parentNode.id !== s.id
        ? parentNode.id
        : undefined;
    rawParentLookup.set(s.id, validParent);
  }

  for (const s of states) {
    const candidate = rawParentLookup.get(s.id);
    if (candidate && !hasParentCycle(s.id, candidate, rawParentLookup)) {
      s.parentId = candidate;
    } else {
      rawParentLookup.set(s.id, undefined);
      delete s.parentId;
    }
  }

  const resolveEndpoint = (rawEp: string): string | null => {
    const trimmed = rawEp.trim();
    if (trimmed === START_END_STATE_ID) {
      return START_END_STATE_ID;
    }
    return stateIdMap.get(trimmed) ?? null;
  };

  const usedTransitionIds = new Set<string>();
  const transitions: StateTransitionData[] = [];
  for (let i = 0; i < raw.transitions.length; i++) {
    const item = raw.transitions[i];
    const from = resolveEndpoint(item.from);
    const to = resolveEndpoint(item.to);
    if (!from || !to) {
      continue;
    }
    const mappedScope = item.scopeId ? stateIdMap.get(item.scopeId) : undefined;
    const scopeNode = mappedScope ? stateById.get(mappedScope) : undefined;
    const scopeId =
      scopeNode && scopeNode.kind === 'composite' ? scopeNode.id : undefined;
    const label = item.label ? sanitizeStateText(item.label) : undefined;
    const baseTid = item.id?.trim() ? item.id.trim() : `t_${i + 1}`;
    const tid = allocateUniqueId(baseTid, usedTransitionIds);
    transitions.push({
      id: tid,
      from,
      to,
      ...(label ? { label } : {}),
      ...(scopeId ? { scopeId } : {}),
    });
  }

  const usedNoteIds = new Set<string>();
  const notes: StateNoteData[] = [];
  for (let i = 0; i < (raw.notes ?? []).length; i++) {
    const item = raw.notes![i];
    const target = stateIdMap.get(item.targetStateId);
    if (!target) {
      continue;
    }
    const text = sanitizeStateText(item.text || '');
    if (!text) {
      continue;
    }
    const position: StateNotePosition = VALID_NOTE_POSITIONS.has(item.position)
      ? item.position
      : 'right of';
    const baseNid = item.id?.trim() ? item.id.trim() : `n_${i + 1}`;
    const nid = allocateUniqueId(baseNid, usedNoteIds);
    notes.push({
      id: nid,
      targetStateId: target,
      position,
      text,
    });
  }

  const comments = (raw.comments ?? [])
    .map(sanitizeSingleLineComment)
    .filter((c) => c.length > 0 && !c.startsWith('@gui-state:'));

  return {
    diagramType: 'state',
    ...(title ? { title } : {}),
    direction,
    states,
    transitions,
    ...(notes.length > 0 ? { notes } : {}),
    ...(comments.length > 0 ? { comments } : {}),
  };
}

function resolveTransitionScope(
  tr: StateTransitionData,
  stateMap: Map<string, StateNodeData>
): string | undefined {
  if (tr.scopeId) {
    const scopeNode = stateMap.get(tr.scopeId);
    if (scopeNode && scopeNode.kind === 'composite') {
      return tr.scopeId;
    }
  }
  const fromNode = tr.from !== START_END_STATE_ID ? stateMap.get(tr.from) : undefined;
  const toNode = tr.to !== START_END_STATE_ID ? stateMap.get(tr.to) : undefined;
  if (fromNode && toNode && fromNode.parentId && fromNode.parentId === toNode.parentId) {
    return fromNode.parentId;
  }
  return undefined;
}

export function generateStateCode(data: StateDiagramData): string {
  const normalized = normalizeStateData(data);
  const lines: string[] = [];

  if (normalized.title) {
    lines.push('---');
    lines.push(`title: '${normalized.title}'`);
    lines.push('---');
  }

  lines.push('stateDiagram-v2');
  if (normalized.direction) {
    lines.push(`  direction ${normalized.direction}`);
  }

  const stateMap = new Map(normalized.states.map((s) => [s.id, s]));

  const colorToClassName = new Map<string, string>();
  const colorAssignments: Array<{ id: string; cls: string }> = [];
  for (const st of normalized.states) {
    if (!st.color) {
      continue;
    }
    let cls = colorToClassName.get(st.color);
    if (!cls) {
      cls = `stColor_${colorToClassName.size + 1}`;
      colorToClassName.set(st.color, cls);
      lines.push(`  classDef ${cls} fill:${st.color},stroke:#475569,color:#0f172a`);
    }
    colorAssignments.push({ id: st.id, cls });
  }

  const emitScope = (scopeId: string | undefined, indent: string): void => {
    const scopedStates = normalized.states.filter(
      (s) => (s.parentId ?? undefined) === scopeId
    );
    let hasCompositeChild = false;
    for (const st of scopedStates) {
      if (st.kind === 'composite') {
        hasCompositeChild = true;
        const header =
          st.label && st.label !== st.id
            ? `state "${st.label}" as ${st.id} {`
            : `state ${st.id} {`;
        lines.push(`${indent}${header}`);
        if (st.subDirection) {
          lines.push(`${indent}  direction ${st.subDirection}`);
        }
        emitScope(st.id, `${indent}  `);
        lines.push(`${indent}}`);
      } else if (st.kind === 'choice' || st.kind === 'fork' || st.kind === 'join') {
        lines.push(`${indent}state ${st.id} <<${st.kind}>>`);
      } else {
        if (st.label && st.label !== st.id) {
          lines.push(`${indent}state "${st.label}" as ${st.id}`);
        } else if (!st.description) {
          lines.push(`${indent}state ${st.id}`);
        }
        if (st.description) {
          lines.push(`${indent}${st.id} : ${st.description}`);
        }
      }
    }

    const scopedTransitions = normalized.transitions.filter(
      (tr) => resolveTransitionScope(tr, stateMap) === scopeId
    );
    for (const tr of scopedTransitions) {
      const labelPart = tr.label ? ` : ${tr.label}` : '';
      lines.push(`${indent}${tr.from} --> ${tr.to}${labelPart}`);
    }

    if (scopeId !== undefined && scopedTransitions.length === 0 && !hasCompositeChild) {
      lines.push(`${indent}${START_END_STATE_ID}`);
    }
  };

  emitScope(undefined, '  ');

  for (const note of normalized.notes ?? []) {
    lines.push(`  note ${note.position} ${note.targetStateId} : ${note.text}`);
  }

  for (const { id, cls } of colorAssignments) {
    lines.push(`  class ${id} ${cls}`);
  }

  for (const comment of normalized.comments ?? []) {
    lines.push(`%% ${comment}`);
  }

  lines.push(formatGuiStateLine(normalized));
  return lines.join('\n');
}

function extractFillColorFromClassDef(styleSpec: string): string | undefined {
  const fillMatch = styleSpec.match(/fill\s*:\s*([^,\s]+)/i);
  if (!fillMatch) {
    return undefined;
  }
  return sanitizeCssColor(fillMatch[1]);
}

export function parseStateCodeToGuiData(code: string): StateDiagramData {
  const lines = code.split(/\r?\n/);

  const guiState = extractGuiStateJson(lines, isValidStateData);
  if (guiState) {
    return normalizeStateData(guiState);
  }

  let title: string | undefined;
  let direction: StateDiagramDirection = 'TB';
  const states: StateNodeData[] = [];
  const stateMap = new Map<string, StateNodeData>();
  const transitions: StateTransitionData[] = [];
  const notes: StateNoteData[] = [];
  const comments: string[] = [];
  const classDefColors = new Map<string, string>();
  const pendingClassAssignments: Array<{ ids: string[]; cls: string }> = [];

  const ensureState = (
    rawId: string,
    parentId?: string,
    inlineClass?: string
  ): StateNodeData => {
    const id = sanitizeStateId(rawId);
    let existing = stateMap.get(id);
    if (!existing) {
      existing = {
        id,
        kind: 'normal',
        ...(parentId ? { parentId } : {}),
      };
      stateMap.set(id, existing);
      states.push(existing);
    } else if (parentId && !existing.parentId) {
      existing.parentId = parentId;
    }
    if (inlineClass) {
      pendingClassAssignments.push({ ids: [id], cls: inlineClass });
    }
    return existing;
  };

  const compositeStack: string[] = [];
  let inFrontmatter = false;
  let pendingNote: {
    targetRaw: string;
    position: StateNotePosition;
    lines: string[];
  } | null = null;

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
        continue;
      }
      const titleMatch = trimmed.match(/^title\s*:\s*(.+)$/i);
      if (titleMatch) {
        title = unquoteYamlString(titleMatch[1]);
      }
      continue;
    }

    if (!trimmed) {
      continue;
    }
    if (trimmed.startsWith('%%')) {
      const commentBody = trimmed.slice(2).trim();
      if (commentBody && !commentBody.startsWith('@gui-state:')) {
        comments.push(commentBody);
      }
      continue;
    }

    if (pendingNote) {
      if (/^end\s+note\b/i.test(trimmed)) {
        const target = ensureState(pendingNote.targetRaw);
        const joinedText = sanitizeStateText(pendingNote.lines.join(' '));
        if (joinedText) {
          notes.push({
            id: `n_${notes.length + 1}`,
            targetStateId: target.id,
            position: pendingNote.position,
            text: joinedText,
          });
        }
        pendingNote = null;
      } else {
        pendingNote.lines.push(trimmed);
      }
      continue;
    }

    if (/^stateDiagram(?:-v2)?\b/i.test(trimmed)) {
      continue;
    }

    if (trimmed === '}') {
      compositeStack.pop();
      continue;
    }

    if (trimmed === '--') {
      continue;
    }

    const currentScope =
      compositeStack.length > 0
        ? compositeStack[compositeStack.length - 1]
        : undefined;

    const dirMatch = trimmed.match(/^direction\s+(TB|BT|LR|RL)\b/i);
    if (dirMatch) {
      const parsedDir = dirMatch[1].toUpperCase() as StateDiagramDirection;
      if (currentScope) {
        const comp = stateMap.get(currentScope);
        if (comp) {
          comp.subDirection = parsedDir;
        }
      } else {
        direction = parsedDir;
      }
      continue;
    }

    const classDefMatch = trimmed.match(/^classDef\s+([a-zA-Z0-9_-]+)\s+(.+)$/i);
    if (classDefMatch) {
      const fill = extractFillColorFromClassDef(classDefMatch[2]);
      if (fill) {
        classDefColors.set(classDefMatch[1], fill);
      }
      continue;
    }

    const classAssignMatch = trimmed.match(
      /^class\s+([a-zA-Z0-9_,\s-]+?)\s+([a-zA-Z0-9_-]+)$/i
    );
    if (classAssignMatch) {
      const ids = classAssignMatch[1]
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => ensureState(part).id);
      pendingClassAssignments.push({ ids, cls: classAssignMatch[2] });
      continue;
    }

    const singleNoteMatch = trimmed.match(
      /^note\s+(left|right)\s+of\s+([a-zA-Z0-9_-]+)\s*:\s*(.+)$/i
    );
    if (singleNoteMatch) {
      const position: StateNotePosition =
        singleNoteMatch[1].toLowerCase() === 'left' ? 'left of' : 'right of';
      const target = ensureState(singleNoteMatch[2]);
      const text = sanitizeStateText(singleNoteMatch[3]);
      if (text) {
        notes.push({
          id: `n_${notes.length + 1}`,
          targetStateId: target.id,
          position,
          text,
        });
      }
      continue;
    }

    const blockNoteMatch = trimmed.match(
      /^note\s+(left|right)\s+of\s+([a-zA-Z0-9_-]+)\s*$/i
    );
    if (blockNoteMatch) {
      pendingNote = {
        position:
          blockNoteMatch[1].toLowerCase() === 'left' ? 'left of' : 'right of',
        targetRaw: blockNoteMatch[2],
        lines: [],
      };
      continue;
    }

    const compAliasMatch = trimmed.match(
      /^state\s+"([^"]*)"\s+as\s+([a-zA-Z0-9_-]+)(?:\s*:::\s*([a-zA-Z0-9_-]+))?\s*\{$/i
    );
    if (compAliasMatch) {
      const comp = ensureState(
        compAliasMatch[2],
        currentScope,
        compAliasMatch[3]
      );
      comp.kind = 'composite';
      if (compAliasMatch[1].trim()) {
        comp.label = sanitizeStateLabel(compAliasMatch[1]);
      }
      compositeStack.push(comp.id);
      continue;
    }

    const compDirectMatch = trimmed.match(
      /^state\s+([a-zA-Z0-9_-]+)(?:\s*:::\s*([a-zA-Z0-9_-]+))?\s*\{$/i
    );
    if (compDirectMatch) {
      const comp = ensureState(
        compDirectMatch[1],
        currentScope,
        compDirectMatch[2]
      );
      comp.kind = 'composite';
      compositeStack.push(comp.id);
      continue;
    }

    const stereoMatch = trimmed.match(
      /^state\s+(?:"([^"]*)"\s+as\s+)?([a-zA-Z0-9_-]+)\s+<<(choice|fork|join)>>(?:\s*:::\s*([a-zA-Z0-9_-]+))?$/i
    );
    if (stereoMatch) {
      const node = ensureState(stereoMatch[2], currentScope, stereoMatch[4]);
      node.kind = stereoMatch[3].toLowerCase() as StateKind;
      if (stereoMatch[1]?.trim()) {
        node.label = sanitizeStateLabel(stereoMatch[1]);
      }
      continue;
    }

    const aliasMatch = trimmed.match(
      /^state\s+"([^"]*)"\s+as\s+([a-zA-Z0-9_-]+)(?:\s*:::\s*([a-zA-Z0-9_-]+))?$/i
    );
    if (aliasMatch) {
      const node = ensureState(aliasMatch[2], currentScope, aliasMatch[3]);
      if (aliasMatch[1].trim()) {
        node.label = sanitizeStateLabel(aliasMatch[1]);
      }
      continue;
    }

    const bareStateMatch = trimmed.match(
      /^state\s+([a-zA-Z0-9_-]+)(?:\s*:::\s*([a-zA-Z0-9_-]+))?$/i
    );
    if (bareStateMatch) {
      ensureState(bareStateMatch[1], currentScope, bareStateMatch[2]);
      continue;
    }

    const transMatch = trimmed.match(
      /^(\[\*\]|[a-zA-Z0-9_-]+)(?::::([a-zA-Z0-9_-]+))?\s*-->\s*(\[\*\]|[a-zA-Z0-9_-]+)(?::::([a-zA-Z0-9_-]+))?(?:\s*:\s*(.*))?$/
    );
    if (transMatch) {
      const rawFrom = transMatch[1];
      const fromCls = transMatch[2];
      const rawTo = transMatch[3];
      const toCls = transMatch[4];
      const label = transMatch[5] ? sanitizeStateText(transMatch[5]) : undefined;

      const from =
        rawFrom === START_END_STATE_ID
          ? START_END_STATE_ID
          : ensureState(rawFrom, currentScope, fromCls).id;
      const to =
        rawTo === START_END_STATE_ID
          ? START_END_STATE_ID
          : ensureState(rawTo, currentScope, toCls).id;

      transitions.push({
        id: `t_${transitions.length + 1}`,
        from,
        to,
        ...(label ? { label } : {}),
        ...(currentScope ? { scopeId: currentScope } : {}),
      });
      continue;
    }

    const descMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.+)$/);
    if (descMatch) {
      const node = ensureState(descMatch[1], currentScope);
      const desc = sanitizeStateText(descMatch[2]);
      if (desc) {
        node.description = desc;
      }
    }
  }

  for (const assignment of pendingClassAssignments) {
    const color = classDefColors.get(assignment.cls);
    if (!color) {
      continue;
    }
    for (const id of assignment.ids) {
      const st = stateMap.get(id);
      if (st) {
        st.color = color;
      }
    }
  }

  return normalizeStateData({
    diagramType: 'state',
    ...(title ? { title } : {}),
    direction,
    states,
    transitions,
    ...(notes.length > 0 ? { notes } : {}),
    ...(comments.length > 0 ? { comments } : {}),
  });
}
