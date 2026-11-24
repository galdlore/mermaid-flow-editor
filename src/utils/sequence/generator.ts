import type {
  SequenceBlockType,
  SequenceBoxData,
  SequenceDiagramData,
  SequenceParticipantData,
  SequenceStepData,
} from '../../types/editor';
import {
  formatGuiStateLine,
  sanitizeSingleLineComment,
  sanitizeYamlSingleQuoted,
} from '../mermaidEnvelope.ts';
import {
  formatColorForSequenceBlock,
  formatMessageTextForMermaid,
  normalizeSequenceData,
  sanitizeSequenceAlias,
  sanitizeSequenceText,
} from './shared.ts';
import {
  analyzeSequenceActivation,
  type SequenceStepActivationSnapshot,
} from './steps.ts';

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
