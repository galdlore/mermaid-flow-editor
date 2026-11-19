import type {
  SequenceArrowType,
  SequenceBlockBranchData,
  SequenceBlockStepData,
  SequenceBlockType,
  SequenceBoxData,
  SequenceDiagramData,
  SequenceMessageStepData,
  SequenceNotePlacement,
  SequenceNoteStepData,
  SequenceParticipantData,
  SequenceParticipantKind,
  SequenceStepData,
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

const MAX_SEQUENCE_BLOCK_DEPTH = 8;

const VALID_PARTICIPANT_KINDS = new Set<SequenceParticipantKind>(['participant', 'actor']);
const VALID_ARROW_TYPES = new Set<SequenceArrowType>([
  '->>',
  '-->>',
  '->',
  '-->',
  '-x',
  '--x',
  '-)',
  '--)',
  '<<->>',
  '<<-->>',
]);
const VALID_NOTE_PLACEMENTS = new Set<SequenceNotePlacement>([
  'right_of',
  'left_of',
  'over',
]);
const VALID_BLOCK_TYPES = new Set<SequenceBlockType>([
  'loop',
  'alt',
  'opt',
  'par',
  'critical',
  'break',
  'rect',
]);
const MULTI_BRANCH_BLOCK_TYPES = new Set<SequenceBlockType>(['alt', 'par', 'critical']);

const RESERVED_SEQUENCE_KEYWORDS = new Set([
  'end',
  'participant',
  'actor',
  'box',
  'note',
  'loop',
  'alt',
  'else',
  'opt',
  'par',
  'and',
  'critical',
  'option',
  'break',
  'rect',
  'autonumber',
  'activate',
  'deactivate',
  'title',
  'over',
  'left',
  'right',
  'of',
  'as',
  'create',
  'destroy',
  'link',
  'links',
  'properties',
  'details',
]);

export const SEQUENCE_ARROW_OPTIONS: ReadonlyArray<SequenceArrowType> = [
  '->>',
  '-->>',
  '->',
  '-->',
  '-x',
  '--x',
  '-)',
  '--)',
  '<<->>',
  '<<-->>',
];

export const SEQUENCE_BLOCK_TYPES: ReadonlyArray<SequenceBlockType> = [
  'alt',
  'loop',
  'opt',
  'par',
  'critical',
  'break',
  'rect',
];

export function isMultiBranchBlockType(blockType: SequenceBlockType): boolean {
  return MULTI_BRANCH_BLOCK_TYPES.has(blockType);
}

export function createDefaultSequenceData(lang: 'ja' | 'en' = 'ja'): SequenceDiagramData {
  const isJa = lang === 'ja';
  return {
    diagramType: 'sequence',
    title: '',
    autonumber: true,
    boxes: [
      {
        id: 'box_1',
        title: isJa ? 'システム内部' : 'Backend Services',
        color: '#eff6ff',
      },
    ],
    participants: [
      {
        id: 'user',
        alias: isJa ? 'ユーザー' : 'User',
        kind: 'actor',
      },
      {
        id: 'web',
        alias: isJa ? 'Webアプリ' : 'Web App',
        kind: 'participant',
        boxId: 'box_1',
      },
      {
        id: 'api',
        alias: isJa ? '認証API' : 'Auth API',
        kind: 'participant',
        boxId: 'box_1',
      },
    ],
    steps: [
      {
        id: 'step_1',
        kind: 'message',
        from: 'user',
        to: 'web',
        arrowType: '->>',
        text: isJa ? 'ログインを実行' : 'Submit login form',
        activateTarget: true,
      },
      {
        id: 'step_2',
        kind: 'message',
        from: 'web',
        to: 'api',
        arrowType: '->>',
        text: 'POST /api/login',
        activateTarget: true,
      },
      {
        id: 'step_3',
        kind: 'note',
        placement: 'right_of',
        participantId: 'api',
        text: isJa ? '資格情報を検証' : 'Verify credentials',
      },
      {
        id: 'step_4',
        kind: 'block',
        blockType: 'alt',
        label: isJa ? '認証成功' : 'Valid credentials',
        branches: [
          {
            id: 'branch_1',
            steps: [
              {
                id: 'step_5',
                kind: 'message',
                from: 'api',
                to: 'web',
                arrowType: '-->>',
                text: '200 OK (JWT)',
                deactivateSource: true,
              },
            ],
          },
          {
            id: 'branch_2',
            label: isJa ? '認証失敗' : 'Invalid credentials',
            steps: [
              {
                id: 'step_6',
                kind: 'message',
                from: 'api',
                to: 'web',
                arrowType: '--x',
                text: '401 Unauthorized',
              },
            ],
          },
        ],
      },
      {
        id: 'step_7',
        kind: 'message',
        from: 'web',
        to: 'user',
        arrowType: '-->>',
        text: isJa ? '画面を表示' : 'Render dashboard',
        deactivateSource: true,
      },
    ],
  };
}

function sanitizeSequenceId(rawId: string, fallbackPrefix = 'p'): string {
  const cleaned = rawId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!cleaned) {
    return fallbackPrefix;
  }
  const withAlphaPrefix = /^[a-zA-Z]/.test(cleaned) ? cleaned : `${fallbackPrefix}_${cleaned}`;
  if (RESERVED_SEQUENCE_KEYWORDS.has(withAlphaPrefix.toLowerCase())) {
    return `${fallbackPrefix}_${withAlphaPrefix}`;
  }
  return withAlphaPrefix;
}

function sanitizeSequenceText(raw: string): string {
  return raw
    .replace(/[\r\n]+/g, ' ')
    .replace(/;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeSequenceInlineMessageText(raw: string): string {
  return raw
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeSequenceAlias(raw: string): string {
  return raw
    .replace(/[:;\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatMessageTextForMermaid(raw: string): string {
  const cleaned = raw
    .replace(/[\r\n]+/g, ' ')
    .replace(/;/g, '#59;')
    .trim();
  return cleaned || '...';
}

function hexOrColorToCssColor(raw?: string): string | undefined {
  if (!raw) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === 'transparent') {
    return undefined;
  }
  const rgbMatch = trimmed.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)$/i
  );
  if (rgbMatch) {
    const toHex = (val: string) =>
      Math.max(0, Math.min(255, Number.parseInt(val, 10)))
        .toString(16)
        .padStart(2, '0');
    return `#${toHex(rgbMatch[1])}${toHex(rgbMatch[2])}${toHex(rgbMatch[3])}`;
  }
  return sanitizeCssColor(trimmed);
}

function formatColorForSequenceBlock(color?: string): string {
  const safe = sanitizeCssColor(color);
  if (!safe) {
    return 'rgb(239, 246, 255)';
  }
  const shortHex = safe.match(/^#([0-9a-fA-F]{3})$/);
  if (shortHex) {
    const [r, g, b] = shortHex[1].split('').map((ch) => Number.parseInt(ch + ch, 16));
    return `rgb(${r}, ${g}, ${b})`;
  }
  const fullHex = safe.match(/^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/);
  if (fullHex) {
    const r = Number.parseInt(fullHex[1].slice(0, 2), 16);
    const g = Number.parseInt(fullHex[1].slice(2, 4), 16);
    const b = Number.parseInt(fullHex[1].slice(4, 6), 16);
    return `rgb(${r}, ${g}, ${b})`;
  }
  return safe;
}

function isValidStepArray(steps: unknown, depth = 0): steps is SequenceStepData[] {
  if (depth > MAX_SEQUENCE_BLOCK_DEPTH || !Array.isArray(steps)) {
    return false;
  }
  return steps.every((item) => {
    if (!item || typeof item !== 'object') {
      return false;
    }
    const candidate = item as Partial<SequenceStepData>;
    if (typeof candidate.id !== 'string') {
      return false;
    }
    if (candidate.kind === 'message') {
      return (
        typeof candidate.from === 'string' &&
        typeof candidate.to === 'string' &&
        typeof candidate.text === 'string'
      );
    }
    if (candidate.kind === 'note') {
      return typeof candidate.participantId === 'string' && typeof candidate.text === 'string';
    }
    if (candidate.kind === 'block') {
      return (
        typeof candidate.label === 'string' &&
        Array.isArray(candidate.branches) &&
        candidate.branches.every(
          (branch) =>
            Boolean(branch) &&
            typeof branch === 'object' &&
            typeof branch.id === 'string' &&
            isValidStepArray(branch.steps, depth + 1)
        )
      );
    }
    return false;
  });
}

export function isValidSequenceData(value: unknown): value is SequenceDiagramData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<SequenceDiagramData>;
  if (candidate.diagramType !== 'sequence') {
    return false;
  }
  if (!Array.isArray(candidate.participants) || !Array.isArray(candidate.steps)) {
    return false;
  }
  const participantsValid = candidate.participants.every(
    (p) => Boolean(p) && typeof p === 'object' && typeof p.id === 'string'
  );
  if (!participantsValid) {
    return false;
  }
  return isValidStepArray(candidate.steps, 0);
}

export function normalizeSequenceData(rawData: SequenceDiagramData): SequenceDiagramData {
  const usedBoxIds = new Set<string>();
  const boxIdMap = new Map<string, string>();
  const boxes: SequenceBoxData[] = [];

  for (let i = 0; i < (rawData.boxes ?? []).length; i += 1) {
    const rawBox = rawData.boxes?.[i];
    if (!rawBox || typeof rawBox.id !== 'string') {
      continue;
    }
    const baseId = sanitizeSequenceId(rawBox.id, `box_${i + 1}`);
    const uniqueId = allocateUniqueId(baseId, usedBoxIds);
    boxIdMap.set(rawBox.id, uniqueId);
    const title = sanitizeSequenceText(typeof rawBox.title === 'string' ? rawBox.title : '') || `Group ${i + 1}`;
    const color = hexOrColorToCssColor(rawBox.color);
    boxes.push({
      id: uniqueId,
      title,
      ...(color ? { color } : {}),
    });
  }

  const validBoxIds = new Set(boxes.map((b) => b.id));
  const usedParticipantIds = new Set<string>();
  const participantIdMap = new Map<string, string>();
  const participants: SequenceParticipantData[] = [];

  for (let i = 0; i < rawData.participants.length; i += 1) {
    const rawP = rawData.participants[i];
    if (!rawP || typeof rawP.id !== 'string') {
      continue;
    }
    const baseId = sanitizeSequenceId(rawP.id, `p${i + 1}`);
    const uniqueId = allocateUniqueId(baseId, usedParticipantIds);
    participantIdMap.set(rawP.id, uniqueId);
    const kind: SequenceParticipantKind = VALID_PARTICIPANT_KINDS.has(rawP.kind)
      ? rawP.kind
      : 'participant';
    const alias =
      typeof rawP.alias === 'string' ? sanitizeSequenceAlias(rawP.alias) : '';
    const mappedBoxId = rawP.boxId ? boxIdMap.get(rawP.boxId) ?? rawP.boxId : undefined;
    const boxId = mappedBoxId && validBoxIds.has(mappedBoxId) ? mappedBoxId : undefined;

    participants.push({
      id: uniqueId,
      ...(alias ? { alias } : {}),
      kind,
      ...(boxId ? { boxId } : {}),
    });
  }

  const validParticipantIds = new Set(participants.map((p) => p.id));
  const fallbackParticipantId = participants[0]?.id ?? '';
  const usedStepIds = new Set<string>();
  const usedBranchIds = new Set<string>();

  const resolveParticipant = (rawId: string): string => {
    const mapped = participantIdMap.get(rawId) ?? sanitizeSequenceId(rawId);
    if (validParticipantIds.has(mapped)) {
      return mapped;
    }
    return fallbackParticipantId;
  };

  const normalizeStepList = (
    rawSteps: ReadonlyArray<SequenceStepData>,
    depth: number
  ): SequenceStepData[] => {
    if (depth > MAX_SEQUENCE_BLOCK_DEPTH) {
      return [];
    }
    const normalized: SequenceStepData[] = [];

    for (let i = 0; i < rawSteps.length; i += 1) {
      const step = rawSteps[i];
      if (!step || typeof step !== 'object') {
        continue;
      }
      const stepId = allocateUniqueId(
        sanitizeSequenceId(step.id || `step_${i + 1}`, 'step'),
        usedStepIds
      );

      if (step.kind === 'message') {
        if (!fallbackParticipantId) {
          continue;
        }
        const from = resolveParticipant(step.from);
        const to = resolveParticipant(step.to);
        const arrowType: SequenceArrowType = VALID_ARROW_TYPES.has(step.arrowType)
          ? step.arrowType
          : '->>';
        const text = sanitizeSequenceInlineMessageText(step.text);
        normalized.push({
          id: stepId,
          kind: 'message',
          from,
          to,
          arrowType,
          text,
          ...(step.activateTarget ? { activateTarget: true } : {}),
          ...(step.deactivateSource ? { deactivateSource: true } : {}),
        });
        continue;
      }

      if (step.kind === 'note') {
        if (!fallbackParticipantId) {
          continue;
        }
        const placement: SequenceNotePlacement = VALID_NOTE_PLACEMENTS.has(step.placement)
          ? step.placement
          : 'right_of';
        const participantId = resolveParticipant(step.participantId);
        const participantId2Raw = step.participantId2
          ? resolveParticipant(step.participantId2)
          : undefined;
        const participantId2 =
          placement === 'over' &&
          participantId2Raw &&
          participantId2Raw !== participantId
            ? participantId2Raw
            : undefined;
        const text = sanitizeSequenceInlineMessageText(step.text) || 'Note';
        normalized.push({
          id: stepId,
          kind: 'note',
          placement,
          participantId,
          ...(participantId2 ? { participantId2 } : {}),
          text,
        });
        continue;
      }

      if (step.kind === 'block') {
        if (depth >= MAX_SEQUENCE_BLOCK_DEPTH) {
          continue;
        }
        const blockType: SequenceBlockType = VALID_BLOCK_TYPES.has(step.blockType)
          ? step.blockType
          : 'loop';
        const label = sanitizeSequenceText(step.label);
        const color =
          blockType === 'rect'
            ? hexOrColorToCssColor(step.color) ?? '#eff6ff'
            : undefined;

        const rawBranches = Array.isArray(step.branches) ? step.branches : [];
        const safeRawBranches =
          rawBranches.length > 0
            ? isMultiBranchBlockType(blockType)
              ? rawBranches
              : [rawBranches[0]]
            : [{ id: `branch_${usedBranchIds.size + 1}`, steps: [] }];

        const branches: SequenceBlockBranchData[] = safeRawBranches.map((branch, idx) => {
          const branchId = allocateUniqueId(
            sanitizeSequenceId(branch.id || `branch_${idx + 1}`, 'branch'),
            usedBranchIds
          );
          const branchLabel =
            idx > 0 && typeof branch.label === 'string'
              ? sanitizeSequenceText(branch.label)
              : undefined;
          return {
            id: branchId,
            ...(branchLabel ? { label: branchLabel } : {}),
            steps: normalizeStepList(branch.steps ?? [], depth + 1),
          };
        });

        normalized.push({
          id: stepId,
          kind: 'block',
          blockType,
          label,
          ...(color ? { color } : {}),
          branches,
        });
      }
    }

    return normalized;
  };

  const steps = normalizeStepList(rawData.steps, 0);
  const title =
    typeof rawData.title === 'string' ? sanitizeSequenceText(rawData.title) : '';
  const comments = Array.isArray(rawData.comments)
    ? rawData.comments
        .filter((c): c is string => typeof c === 'string')
        .map(sanitizeSingleLineComment)
        .filter((c) => c.length > 0)
    : undefined;

  return {
    diagramType: 'sequence',
    ...(title ? { title } : {}),
    ...(rawData.autonumber ? { autonumber: true } : {}),
    ...(boxes.length > 0 ? { boxes } : {}),
    participants,
    steps,
    ...(comments && comments.length > 0 ? { comments } : {}),
  };
}

export interface SequenceStepActivationSnapshot {
  preDepths: Record<string, number>;
  postDepths: Record<string, number>;
  canDeactivateSource: boolean;
}

export interface SequenceActivationAnalysis {
  snapshotsByStepId: Record<string, SequenceStepActivationSnapshot>;
  finalDepths: Record<string, number>;
}

function cloneDepthMap(source: Record<string, number>): Record<string, number> {
  return { ...source };
}

/**
 * 各メッセージ実行前後の参加者アクティブ深度を解析し、安全に '-' を出力可能か判定する。
 */
export function analyzeSequenceActivation(
  data: SequenceDiagramData
): SequenceActivationAnalysis {
  const snapshotsByStepId: Record<string, SequenceStepActivationSnapshot> = {};

  const walk = (
    steps: ReadonlyArray<SequenceStepData>,
    currentDepths: Record<string, number>
  ): Record<string, number> => {
    let depths = cloneDepthMap(currentDepths);

    for (const step of steps) {
      if (step.kind === 'message') {
        const preDepths = cloneDepthMap(depths);
        const sourceDepth = depths[step.from] ?? 0;
        const canDeactivateSource = Boolean(step.deactivateSource && sourceDepth > 0);

        if (step.activateTarget) {
          depths[step.to] = (depths[step.to] ?? 0) + 1;
        }
        if (canDeactivateSource) {
          depths[step.from] = Math.max(0, (depths[step.from] ?? 0) - 1);
        }

        snapshotsByStepId[step.id] = {
          preDepths,
          postDepths: cloneDepthMap(depths),
          canDeactivateSource,
        };
      } else if (step.kind === 'note') {
        snapshotsByStepId[step.id] = {
          preDepths: cloneDepthMap(depths),
          postDepths: cloneDepthMap(depths),
          canDeactivateSource: false,
        };
      } else if (step.kind === 'block') {
        const entryDepths = cloneDepthMap(depths);
        let branchOutDepths = cloneDepthMap(entryDepths);

        step.branches.forEach((branch, index) => {
          const resultDepths = walk(branch.steps, cloneDepthMap(entryDepths));
          if (index === 0) {
            branchOutDepths = resultDepths;
          }
        });

        snapshotsByStepId[step.id] = {
          preDepths: entryDepths,
          postDepths: cloneDepthMap(branchOutDepths),
          canDeactivateSource: false,
        };
        depths = branchOutDepths;
      }
    }

    return depths;
  };

  const initialDepths: Record<string, number> = {};
  for (const p of data.participants) {
    initialDepths[p.id] = 0;
  }
  const finalDepths = walk(data.steps, initialDepths);
  return { snapshotsByStepId, finalDepths };
}

function getSecondaryBranchKeyword(blockType: SequenceBlockType): string {
  switch (blockType) {
    case 'par':
      return 'and';
    case 'critical':
      return 'option';
    case 'alt':
    default:
      return 'else';
  }
}

function emitSequenceSteps(
  lines: string[],
  steps: ReadonlyArray<SequenceStepData>,
  snapshots: Record<string, SequenceStepActivationSnapshot>,
  indent: string
): void {
  for (const step of steps) {
    if (step.kind === 'message') {
      const snap = snapshots[step.id];
      const usePlus = Boolean(step.activateTarget);
      const useMinus = Boolean(snap?.canDeactivateSource);
      const text = formatMessageTextForMermaid(step.text);

      if (usePlus && useMinus) {
        // Mermaidの矢印構文では '+' と '-' を同一行に同時指定できないため分離する
        lines.push(`${indent}${step.from}${step.arrowType}+${step.to}: ${text}`);
        lines.push(`${indent}deactivate ${step.from}`);
      } else if (usePlus) {
        lines.push(`${indent}${step.from}${step.arrowType}+${step.to}: ${text}`);
      } else if (useMinus) {
        lines.push(`${indent}${step.from}${step.arrowType}-${step.to}: ${text}`);
      } else {
        lines.push(`${indent}${step.from}${step.arrowType}${step.to}: ${text}`);
      }
      continue;
    }

    if (step.kind === 'note') {
      const placementKeyword =
        step.placement === 'left_of'
          ? 'left of'
          : step.placement === 'over'
            ? 'over'
            : 'right of';
      const target =
        step.placement === 'over' && step.participantId2
          ? `${step.participantId},${step.participantId2}`
          : step.participantId;
      const text = formatMessageTextForMermaid(step.text);
      lines.push(`${indent}Note ${placementKeyword} ${target}: ${text}`);
      continue;
    }

    if (step.kind === 'block') {
      const headerLabel = sanitizeSequenceText(step.label);
      if (step.blockType === 'rect') {
        lines.push(`${indent}rect ${formatColorForSequenceBlock(step.color)}`);
      } else if (headerLabel) {
        lines.push(`${indent}${step.blockType} ${headerLabel}`);
      } else {
        lines.push(`${indent}${step.blockType}`);
      }

      const branches = step.branches.length > 0 ? step.branches : [];
      branches.forEach((branch, idx) => {
        if (idx > 0) {
          const secKw = getSecondaryBranchKeyword(step.blockType);
          const secLabel = branch.label ? sanitizeSequenceText(branch.label) : '';
          lines.push(secLabel ? `${indent}${secKw} ${secLabel}` : `${indent}${secKw}`);
        }
        emitSequenceSteps(lines, branch.steps, snapshots, `${indent}  `);
      });

      lines.push(`${indent}end`);
    }
  }
}

export function generateSequenceCode(rawData: SequenceDiagramData): string {
  const data = normalizeSequenceData(rawData);
  const analysis = analyzeSequenceActivation(data);
  const lines: string[] = [];

  if (data.title) {
    lines.push('---');
    lines.push(`title: '${sanitizeYamlSingleQuoted(data.title)}'`);
    lines.push('---');
  }

  lines.push('sequenceDiagram');

  for (const comment of data.comments ?? []) {
    const clean = sanitizeSingleLineComment(comment);
    if (clean) {
      lines.push(`  %% ${clean}`);
    }
  }

  if (data.autonumber) {
    lines.push('  autonumber');
  }

  const boxMap = new Map<string, SequenceBoxData>();
  for (const box of data.boxes ?? []) {
    boxMap.set(box.id, box);
  }

  const emittedBoxIds = new Set<string>();
  const emittedParticipantIds = new Set<string>();

  const formatParticipantLine = (p: SequenceParticipantData, indent: string): string => {
    const kw = p.kind === 'actor' ? 'actor' : 'participant';
    const aliasPart = p.alias ? ` as ${sanitizeSequenceAlias(p.alias)}` : '';
    return `${indent}${kw} ${p.id}${aliasPart}`;
  };

  for (const p of data.participants) {
    if (emittedParticipantIds.has(p.id)) {
      continue;
    }

    if (p.boxId && boxMap.has(p.boxId)) {
      if (emittedBoxIds.has(p.boxId)) {
        continue;
      }
      emittedBoxIds.add(p.boxId);
      const box = boxMap.get(p.boxId)!;
      const boxHeader = box.color
        ? `  box ${box.color} ${sanitizeSequenceText(box.title)}`
        : `  box ${sanitizeSequenceText(box.title)}`;
      lines.push(boxHeader);

      for (const member of data.participants) {
        if (member.boxId === box.id && !emittedParticipantIds.has(member.id)) {
          lines.push(formatParticipantLine(member, '    '));
          emittedParticipantIds.add(member.id);
        }
      }
      lines.push('  end');
    } else {
      lines.push(formatParticipantLine(p, '  '));
      emittedParticipantIds.add(p.id);
    }
  }

  // 参加者がいない空ボックスがある場合も定義を出力しておく
  for (const box of data.boxes ?? []) {
    if (emittedBoxIds.has(box.id)) {
      continue;
    }
    const boxHeader = box.color
      ? `  box ${box.color} ${sanitizeSequenceText(box.title)}`
      : `  box ${sanitizeSequenceText(box.title)}`;
    lines.push(boxHeader);
    lines.push('  end');
  }

  emitSequenceSteps(lines, data.steps, analysis.snapshotsByStepId, '  ');
  lines.push(formatGuiStateLine(data));
  return lines.join('\n');
}

interface ActiveParserBlock {
  block: SequenceBlockStepData;
  currentBranchIndex: number;
}

const MESSAGE_LINE_REGEX =
  /^([a-zA-Z0-9_-]+?)\s*(<<-->>|<<->>|-->>|->>|-->|->|--x|-x|--\)|-\))\s*([+-])?\s*([a-zA-Z0-9_-]+)\s*:\s*(.*)$/;

export function parseSequenceCodeToGuiData(code: string): SequenceDiagramData {
  const lines = code.split(/\r?\n/);

  const restored = extractGuiStateJson(lines, isValidSequenceData);
  if (restored) {
    return normalizeSequenceData(restored);
  }

  let title = '';
  let autonumber = false;
  const boxes: SequenceBoxData[] = [];
  const participants: SequenceParticipantData[] = [];
  const participantMap = new Map<string, SequenceParticipantData>();
  const rootSteps: SequenceStepData[] = [];
  const comments: string[] = [];

  const blockStack: ActiveParserBlock[] = [];
  let activeBoxId: string | null = null;
  let inFrontmatter = false;
  let seenHeader = false;
  let stepCounter = 1;
  let branchCounter = 1;
  let boxCounter = 1;

  const ensureParticipant = (rawId: string): string => {
    const safeId = sanitizeSequenceId(rawId);
    if (!participantMap.has(safeId)) {
      const created: SequenceParticipantData = {
        id: safeId,
        kind: 'participant',
        ...(activeBoxId ? { boxId: activeBoxId } : {}),
      };
      participants.push(created);
      participantMap.set(safeId, created);
    }
    return safeId;
  };

  const getCurrentStepContainer = (): SequenceStepData[] => {
    const top = blockStack[blockStack.length - 1];
    if (!top) {
      return rootSteps;
    }
    return top.block.branches[top.currentBranchIndex].steps;
  };

  const findLastMessageStep = (): SequenceMessageStepData | null => {
    const container = getCurrentStepContainer();
    const prev = container[container.length - 1];
    return prev?.kind === 'message' ? prev : null;
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
      if (/^sequenceDiagram\b/i.test(trimmed)) {
        seenHeader = true;
      }
      continue;
    }

    if (/^title\s+(.+)$/i.test(trimmed)) {
      const m = trimmed.match(/^title\s+(.+)$/i);
      if (m?.[1]) {
        title = m[1].trim();
      }
      continue;
    }

    if (/^autonumber\b/i.test(trimmed)) {
      autonumber = true;
      continue;
    }

    const boxMatch = trimmed.match(/^box(?:\s+(.*))?$/i);
    if (boxMatch) {
      const rest = (boxMatch[1] ?? '').trim();
      let color: string | undefined;
      let boxTitle = rest;
      const colorTokenMatch = rest.match(
        /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-zA-Z]+)\s+(.*)$/
      );
      if (colorTokenMatch) {
        const candidateColor = hexOrColorToCssColor(colorTokenMatch[1]);
        if (candidateColor || colorTokenMatch[1].toLowerCase() === 'transparent') {
          color = candidateColor;
          boxTitle = colorTokenMatch[2].trim();
        }
      }
      const boxId = `box_${boxCounter++}`;
      boxes.push({
        id: boxId,
        title: boxTitle || `Group ${boxes.length + 1}`,
        ...(color ? { color } : {}),
      });
      activeBoxId = boxId;
      continue;
    }

    if (/^end\b/i.test(trimmed)) {
      if (blockStack.length > 0) {
        blockStack.pop();
      } else if (activeBoxId) {
        activeBoxId = null;
      }
      continue;
    }

    const participantMatch = trimmed.match(
      /^(?:create\s+)?(participant|actor)\s+([a-zA-Z0-9_-]+)(?:\s+as\s+(.+))?$/i
    );
    if (participantMatch) {
      const kind: SequenceParticipantKind =
        participantMatch[1].toLowerCase() === 'actor' ? 'actor' : 'participant';
      const id = sanitizeSequenceId(participantMatch[2]);
      const alias = participantMatch[3]?.trim();
      const existing = participantMap.get(id);
      if (existing) {
        existing.kind = kind;
        if (alias) existing.alias = alias;
        if (activeBoxId) existing.boxId = activeBoxId;
      } else {
        const created: SequenceParticipantData = {
          id,
          kind,
          ...(alias ? { alias } : {}),
          ...(activeBoxId ? { boxId: activeBoxId } : {}),
        };
        participants.push(created);
        participantMap.set(id, created);
      }
      continue;
    }

    const activateMatch = trimmed.match(/^activate\s+([a-zA-Z0-9_-]+)$/i);
    if (activateMatch) {
      const targetId = ensureParticipant(activateMatch[1]);
      const lastMsg = findLastMessageStep();
      if (lastMsg && lastMsg.to === targetId && !lastMsg.activateTarget) {
        lastMsg.activateTarget = true;
      }
      continue;
    }

    const deactivateMatch = trimmed.match(/^deactivate\s+([a-zA-Z0-9_-]+)$/i);
    if (deactivateMatch) {
      const targetId = ensureParticipant(deactivateMatch[1]);
      const lastMsg = findLastMessageStep();
      if (lastMsg && lastMsg.from === targetId && !lastMsg.deactivateSource) {
        lastMsg.deactivateSource = true;
      }
      continue;
    }

    const blockOpenMatch = trimmed.match(
      /^(loop|alt|opt|par|critical|break|rect)(?:\s+(.*))?$/i
    );
    if (blockOpenMatch && blockStack.length < MAX_SEQUENCE_BLOCK_DEPTH) {
      const blockType = blockOpenMatch[1].toLowerCase() as SequenceBlockType;
      const arg = (blockOpenMatch[2] ?? '').trim();
      const color =
        blockType === 'rect' ? hexOrColorToCssColor(arg) ?? '#eff6ff' : undefined;
      const label = blockType === 'rect' ? '' : arg;

      const block: SequenceBlockStepData = {
        id: `step_${stepCounter++}`,
        kind: 'block',
        blockType,
        label,
        ...(color ? { color } : {}),
        branches: [{ id: `branch_${branchCounter++}`, steps: [] }],
      };
      getCurrentStepContainer().push(block);
      blockStack.push({ block, currentBranchIndex: 0 });
      continue;
    }

    const branchMatch = trimmed.match(/^(else|and|option)(?:\s+(.*))?$/i);
    if (branchMatch && blockStack.length > 0) {
      const top = blockStack[blockStack.length - 1];
      const nextBranch: SequenceBlockBranchData = {
        id: `branch_${branchCounter++}`,
        ...(branchMatch[2]?.trim() ? { label: branchMatch[2].trim() } : {}),
        steps: [],
      };
      top.block.branches.push(nextBranch);
      top.currentBranchIndex = top.block.branches.length - 1;
      continue;
    }

    const noteMatch = trimmed.match(
      /^note\s+(left of|right of|over)\s+([^:]+):\s*(.*)$/i
    );
    if (noteMatch) {
      const placementRaw = noteMatch[1].toLowerCase();
      const placement: SequenceNotePlacement =
        placementRaw === 'left of'
          ? 'left_of'
          : placementRaw === 'over'
            ? 'over'
            : 'right_of';
      const targetParts = noteMatch[2]
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (targetParts.length > 0) {
        const participantId = ensureParticipant(targetParts[0]);
        const participantId2 =
          placement === 'over' && targetParts[1]
            ? ensureParticipant(targetParts[1])
            : undefined;
        getCurrentStepContainer().push({
          id: `step_${stepCounter++}`,
          kind: 'note',
          placement,
          participantId,
          ...(participantId2 && participantId2 !== participantId
            ? { participantId2 }
            : {}),
          text: noteMatch[3].trim().replace(/#59;/g, ';') || 'Note',
        });
      }
      continue;
    }

    const msgMatch = trimmed.match(MESSAGE_LINE_REGEX);
    if (msgMatch) {
      const from = ensureParticipant(msgMatch[1]);
      const arrowType = msgMatch[2] as SequenceArrowType;
      const actMod = msgMatch[3] ?? '';
      const to = ensureParticipant(msgMatch[4]);
      const text = msgMatch[5].trim().replace(/#59;/g, ';');

      getCurrentStepContainer().push({
        id: `step_${stepCounter++}`,
        kind: 'message',
        from,
        to,
        arrowType: VALID_ARROW_TYPES.has(arrowType) ? arrowType : '->>',
        text,
        ...(actMod === '+' ? { activateTarget: true } : {}),
        ...(actMod === '-' ? { deactivateSource: true } : {}),
      });
    }
  }

  return normalizeSequenceData({
    diagramType: 'sequence',
    ...(title ? { title } : {}),
    ...(autonumber ? { autonumber: true } : {}),
    ...(boxes.length > 0 ? { boxes } : {}),
    participants,
    steps: rootSteps,
    ...(comments.length > 0 ? { comments } : {}),
  });
}

// --- ツリー操作用の純粋ヘルパー（Canvas / Inspector共通利用） ---

export interface SequenceStepLocation {
  step: SequenceStepData;
  parentBlockId: string | null;
  parentBranchId: string | null;
  index: number;
  siblingCount: number;
}

export function collectSequenceStepIds(steps: ReadonlyArray<SequenceStepData>): Set<string> {
  const ids = new Set<string>();
  const walk = (list: ReadonlyArray<SequenceStepData>): void => {
    for (const step of list) {
      ids.add(step.id);
      if (step.kind === 'block') {
        for (const branch of step.branches) {
          walk(branch.steps);
        }
      }
    }
  };
  walk(steps);
  return ids;
}

export function collectSequenceBranchIds(steps: ReadonlyArray<SequenceStepData>): Set<string> {
  const ids = new Set<string>();
  const walk = (list: ReadonlyArray<SequenceStepData>): void => {
    for (const step of list) {
      if (step.kind === 'block') {
        for (const branch of step.branches) {
          ids.add(branch.id);
          walk(branch.steps);
        }
      }
    }
  };
  walk(steps);
  return ids;
}

export function createUniqueSequenceStepId(steps: ReadonlyArray<SequenceStepData>): string {
  const existing = collectSequenceStepIds(steps);
  let num = existing.size + 1;
  while (existing.has(`step_${num}`)) {
    num += 1;
  }
  return `step_${num}`;
}

export function createUniqueSequenceBranchId(steps: ReadonlyArray<SequenceStepData>): string {
  const existing = collectSequenceBranchIds(steps);
  let num = existing.size + 1;
  while (existing.has(`branch_${num}`)) {
    num += 1;
  }
  return `branch_${num}`;
}

export function findSequenceStepLocation(
  steps: ReadonlyArray<SequenceStepData>,
  targetStepId: string | null,
  parentBlockId: string | null = null,
  parentBranchId: string | null = null
): SequenceStepLocation | null {
  if (!targetStepId) {
    return null;
  }
  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    if (step.id === targetStepId) {
      return {
        step,
        parentBlockId,
        parentBranchId,
        index: i,
        siblingCount: steps.length,
      };
    }
    if (step.kind === 'block') {
      for (const branch of step.branches) {
        const found = findSequenceStepLocation(
          branch.steps,
          targetStepId,
          step.id,
          branch.id
        );
        if (found) {
          return found;
        }
      }
    }
  }
  return null;
}

export function updateSequenceStepById(
  steps: ReadonlyArray<SequenceStepData>,
  targetStepId: string,
  updater: (step: SequenceStepData) => SequenceStepData
): SequenceStepData[] {
  return steps.map((step) => {
    if (step.id === targetStepId) {
      return updater(step);
    }
    if (step.kind === 'block') {
      return {
        ...step,
        branches: step.branches.map((branch) => ({
          ...branch,
          steps: updateSequenceStepById(branch.steps, targetStepId, updater),
        })),
      };
    }
    return step;
  });
}

export function deleteSequenceStepById(
  steps: ReadonlyArray<SequenceStepData>,
  targetStepId: string
): SequenceStepData[] {
  const result: SequenceStepData[] = [];
  for (const step of steps) {
    if (step.id === targetStepId) {
      continue;
    }
    if (step.kind === 'block') {
      result.push({
        ...step,
        branches: step.branches.map((branch) => ({
          ...branch,
          steps: deleteSequenceStepById(branch.steps, targetStepId),
        })),
      });
    } else {
      result.push(step);
    }
  }
  return result;
}

export function moveSequenceStepById(
  steps: ReadonlyArray<SequenceStepData>,
  targetStepId: string,
  delta: -1 | 1
): SequenceStepData[] {
  const idx = steps.findIndex((s) => s.id === targetStepId);
  if (idx >= 0) {
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= steps.length) {
      return [...steps];
    }
    const copy = [...steps];
    const [moved] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, moved);
    return copy;
  }

  return steps.map((step) => {
    if (step.kind === 'block') {
      return {
        ...step,
        branches: step.branches.map((branch) => ({
          ...branch,
          steps: moveSequenceStepById(branch.steps, targetStepId, delta),
        })),
      };
    }
    return step;
  });
}

export function appendStepToBranch(
  steps: ReadonlyArray<SequenceStepData>,
  newStep: SequenceStepData,
  targetBranchId?: string | null
): SequenceStepData[] {
  if (!targetBranchId) {
    return [...steps, newStep];
  }
  return steps.map((step) => {
    if (step.kind === 'block') {
      return {
        ...step,
        branches: step.branches.map((branch) =>
          branch.id === targetBranchId
            ? { ...branch, steps: [...branch.steps, newStep] }
            : { ...branch, steps: appendStepToBranch(branch.steps, newStep, targetBranchId) }
        ),
      };
    }
    return step;
  });
}

/**
 * 指定ステップの直後（同じ階層・同じブランチ内）へ新しいステップを挿入する。見つからない場合は末尾に追加。
 */
export function insertSequenceStepAfter(
  steps: ReadonlyArray<SequenceStepData>,
  afterStepId: string | null,
  newStep: SequenceStepData
): SequenceStepData[] {
  if (!afterStepId) {
    return [...steps, newStep];
  }

  let inserted = false;
  const walk = (list: ReadonlyArray<SequenceStepData>): SequenceStepData[] => {
    const idx = list.findIndex((s) => s.id === afterStepId);
    if (idx >= 0) {
      inserted = true;
      const copy = [...list];
      copy.splice(idx + 1, 0, newStep);
      return copy;
    }

    return list.map((step) => {
      if (inserted || step.kind !== 'block') {
        return step;
      }
      return {
        ...step,
        branches: step.branches.map((branch) => ({
          ...branch,
          steps: walk(branch.steps),
        })),
      };
    });
  };

  const result = walk(steps);
  return inserted ? result : [...steps, newStep];
}

