import type {
  SequenceArrowType,
  SequenceBlockBranchData,
  SequenceBlockType,
  SequenceBoxData,
  SequenceDiagramData,
  SequenceNotePlacement,
  SequenceParticipantData,
  SequenceParticipantKind,
  SequenceStepData,
} from '../../types/editor';
import { sanitizeCssColor } from '../inputSafeguard.ts';
import {
  allocateUniqueId,
  sanitizeSingleLineComment,
} from '../mermaidEnvelope.ts';

export const MAX_SEQUENCE_BLOCK_DEPTH = 8;

const VALID_PARTICIPANT_KINDS = new Set<SequenceParticipantKind>(['participant', 'actor']);
export const VALID_ARROW_TYPES = new Set<SequenceArrowType>([
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

export function sanitizeSequenceId(rawId: string, fallbackPrefix = 'p'): string {
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

export function sanitizeSequenceText(raw: string): string {
  return raw
    .replace(/[\r\n]+/g, ' ')
    .replace(/;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeSequenceInlineMessageText(raw: string): string {
  return raw
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeSequenceAlias(raw: string): string {
  return raw
    .replace(/[:;\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatMessageTextForMermaid(raw: string): string {
  const cleaned = raw
    .replace(/[\r\n]+/g, ' ')
    .replace(/;/g, '#59;')
    .trim();
  return cleaned || '...';
}

export function hexOrColorToCssColor(raw?: string): string | undefined {
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

export function formatColorForSequenceBlock(color?: string): string {
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
