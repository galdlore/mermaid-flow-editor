import type {
  SequenceArrowType,
  SequenceBlockBranchData,
  SequenceBlockStepData,
  SequenceBlockType,
  SequenceBoxData,
  SequenceDiagramData,
  SequenceMessageStepData,
  SequenceNotePlacement,
  SequenceParticipantData,
  SequenceParticipantKind,
  SequenceStepData,
} from '../../types/editor';
import {
  GUI_STATE_PREFIX,
  extractGuiStateJson,
  unquoteYamlString,
} from '../mermaidEnvelope.ts';
import {
  MAX_SEQUENCE_BLOCK_DEPTH,
  VALID_ARROW_TYPES,
  hexOrColorToCssColor,
  isValidSequenceData,
  normalizeSequenceData,
  sanitizeSequenceId,
} from './shared.ts';

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
