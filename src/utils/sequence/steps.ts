import type { SequenceDiagramData, SequenceStepData } from '../../types/editor';

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
