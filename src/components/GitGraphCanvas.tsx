import { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  GitBranch,
  GitCommitHorizontal,
  GitMerge,
  GitPullRequest,
  Navigation,
  Tag,
  Trash2,
} from 'lucide-react';
import { useI18n } from '../i18n';
import type {
  GitGraphDiagramData,
  GitGraphOperationData,
  GitGraphOperationKind,
} from '../types/editor';
import { simulateGitGraphState } from '../utils/gitGraphConverter';

export interface GitGraphCanvasProps {
  gitData: GitGraphDiagramData;
  selectedOperationId: string | null;
  onChange: (next: GitGraphDiagramData) => void;
  onSelectOperation: (opId: string | null) => void;
}

const BRANCH_COLORS = [
  '#2563eb',
  '#16a34a',
  '#9333ea',
  '#d97706',
  '#db2777',
  '#0891b2',
];

function nextOperationId(ops: GitGraphOperationData[]): string {
  const used = new Set(ops.map((o) => o.id));
  let num = ops.length + 1;
  while (used.has(`git_${num}`)) {
    num++;
  }
  return `git_${num}`;
}

export default function GitGraphCanvas({
  gitData,
  selectedOperationId,
  onChange,
  onSelectOperation,
}: GitGraphCanvasProps) {
  const { t } = useI18n();
  const gg = t.inspector.gitGraph;

  const sim = useMemo(() => simulateGitGraphState(gitData), [gitData]);
  const branchColorMap = useMemo(() => {
    const map = new Map<string, string>();
    sim.allBranches.forEach((b, idx) => {
      map.set(b, BRANCH_COLORS[idx % BRANCH_COLORS.length]);
    });
    return map;
  }, [sim.allBranches]);

  const handleAddOp = (kind: GitGraphOperationKind): void => {
    const id = nextOperationId(gitData.operations);
    const lastStep = sim.steps[sim.steps.length - 1];
    const currentBranch =
      lastStep?.activeBranch ?? gitData.mainBranchName ?? 'main';
    const knownBranches = lastStep?.knownBranches ?? [currentBranch];
    const otherBranch =
      knownBranches.find((b) => b !== currentBranch) ??
      gitData.mainBranchName ??
      'main';
    const branchCount = gitData.operations.filter(
      (o) => o.kind === 'branch'
    ).length;
    const commitCount = gitData.operations.filter(
      (o) => o.kind === 'commit'
    ).length;

    let newOp: GitGraphOperationData;
    switch (kind) {
      case 'branch':
        newOp = {
          id,
          kind: 'branch',
          branchName: gg.defaultBranchName(branchCount + 1),
        };
        break;
      case 'checkout':
        newOp = {
          id,
          kind: 'checkout',
          branchName: otherBranch,
        };
        break;
      case 'merge':
        newOp = {
          id,
          kind: 'merge',
          branchName: otherBranch,
        };
        break;
      case 'cherry-pick':
        newOp = {
          id,
          kind: 'cherry-pick',
          commitId: sim.allCommitIds[0] ?? gg.defaultCommitId(1),
        };
        break;
      case 'commit':
      default:
        newOp = {
          id,
          kind: 'commit',
          commitId: gg.defaultCommitId(commitCount + 1),
          commitType: 'NORMAL',
        };
        break;
    }

    onChange({
      ...gitData,
      operations: [...gitData.operations, newOp],
    });
    onSelectOperation(id);
  };

  const handleMoveOp = (index: number, delta: -1 | 1): void => {
    const target = index + delta;
    if (target < 0 || target >= gitData.operations.length) {
      return;
    }
    const next = [...gitData.operations];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    onChange({ ...gitData, operations: next });
  };

  const handleDeleteOp = (id: string, index: number): void => {
    const next = gitData.operations.filter((o) => o.id !== id);
    onChange({ ...gitData, operations: next });
    if (selectedOperationId === id) {
      onSelectOperation(next[Math.min(index, next.length - 1)]?.id ?? null);
    }
  };

  const renderOpIcon = (kind: GitGraphOperationKind) => {
    switch (kind) {
      case 'branch':
        return <GitBranch size={14} />;
      case 'checkout':
        return <Navigation size={14} />;
      case 'merge':
        return <GitMerge size={14} />;
      case 'cherry-pick':
        return <GitPullRequest size={14} />;
      case 'commit':
      default:
        return <GitCommitHorizontal size={14} />;
    }
  };

  return (
    <div className="gitgraph-canvas">
      <div className="gitgraph-toolbar">
        <button
          type="button"
          className="btn-secondary btn-xs"
          onClick={() => handleAddOp('commit')}
        >
          <GitCommitHorizontal size={13} />
          <span>{gg.addCommitBtn}</span>
        </button>
        <button
          type="button"
          className="btn-secondary btn-xs"
          onClick={() => handleAddOp('branch')}
        >
          <GitBranch size={13} />
          <span>{gg.addBranchBtn}</span>
        </button>
        <button
          type="button"
          className="btn-secondary btn-xs"
          onClick={() => handleAddOp('checkout')}
        >
          <Navigation size={13} />
          <span>{gg.addCheckoutBtn}</span>
        </button>
        <button
          type="button"
          className="btn-secondary btn-xs"
          onClick={() => handleAddOp('merge')}
        >
          <GitMerge size={13} />
          <span>{gg.addMergeBtn}</span>
        </button>
        <button
          type="button"
          className="btn-secondary btn-xs"
          onClick={() => handleAddOp('cherry-pick')}
        >
          <GitPullRequest size={13} />
          <span>{gg.addCherryPickBtn}</span>
        </button>
      </div>

      <div className="gitgraph-branch-strip">
        {sim.allBranches.map((b) => (
          <span
            key={b}
            className="gitgraph-branch-legend-pill"
            style={{
              borderColor: branchColorMap.get(b) ?? '#2563eb',
              color: branchColorMap.get(b) ?? '#2563eb',
            }}
          >
            <GitBranch size={11} />
            <span>{b}</span>
          </span>
        ))}
      </div>

      <div className="gitgraph-canvas-scroll">
        {gitData.title && (
          <div className="gitgraph-title-banner">{gitData.title}</div>
        )}

        {gitData.operations.length === 0 ? (
          <div className="gitgraph-empty-state">{gg.emptyOperations}</div>
        ) : (
          <div className="gitgraph-ops-list">
            {gitData.operations.map((op, index) => {
              const step = sim.steps[index];
              const isSelected = op.id === selectedOperationId;
              const activeColor =
                branchColorMap.get(step?.activeBranch ?? 'main') ?? '#2563eb';
              const targetColor = op.branchName
                ? branchColorMap.get(op.branchName) ?? '#64748b'
                : activeColor;

              return (
                <div
                  key={op.id}
                  className={`gitgraph-op-row ${isSelected ? 'is-selected' : ''} ${
                    step?.warning ? 'has-warning' : ''
                  }`}
                  onClick={() => onSelectOperation(op.id)}
                >
                  <div
                    className="gitgraph-op-lane-bar"
                    style={{ backgroundColor: activeColor }}
                    aria-hidden="true"
                  />
                  <span className="gitgraph-op-step-num">#{index + 1}</span>
                  <span
                    className={`gitgraph-op-kind-pill is-${op.kind}`}
                    title={gg.operationKinds[op.kind]}
                  >
                    {renderOpIcon(op.kind)}
                    <span>{op.kind}</span>
                  </span>

                  <div className="gitgraph-op-summary">
                    {(op.kind === 'branch' ||
                      op.kind === 'checkout' ||
                      op.kind === 'merge') &&
                      op.branchName && (
                        <span
                          className="gitgraph-target-branch-pill"
                          style={{
                            borderColor: targetColor,
                            color: targetColor,
                          }}
                        >
                          {op.branchName}
                        </span>
                      )}

                    {op.commitId && (
                      <span className="gitgraph-commit-id-pill">
                        {op.commitId}
                      </span>
                    )}

                    {op.commitType && op.commitType !== 'NORMAL' && (
                      <span
                        className={`gitgraph-ctype-pill is-${op.commitType.toLowerCase()}`}
                      >
                        {op.commitType}
                      </span>
                    )}

                    {op.tag && (
                      <span className="gitgraph-tag-pill">
                        <Tag size={10} />
                        <span>{op.tag}</span>
                      </span>
                    )}

                    {step?.warning && (
                      <span
                        className="gitgraph-warning-pill"
                        title={
                          gg.warnings[
                            step.warning as keyof typeof gg.warnings
                          ] ?? step.warning
                        }
                      >
                        <AlertTriangle size={12} />
                      </span>
                    )}
                  </div>

                  <span
                    className="gitgraph-active-branch-chip"
                    style={{ color: activeColor }}
                  >
                    {gg.activeBranchBadge(step?.activeBranch ?? 'main')}
                  </span>

                  <div
                    className="gitgraph-op-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="treeview-action-btn"
                      title={gg.moveUpTitle}
                      disabled={index === 0}
                      onClick={() => handleMoveOp(index, -1)}
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      className="treeview-action-btn"
                      title={gg.moveDownTitle}
                      disabled={index === gitData.operations.length - 1}
                      onClick={() => handleMoveOp(index, 1)}
                    >
                      <ArrowDown size={12} />
                    </button>
                    <button
                      type="button"
                      className="treeview-action-btn is-danger"
                      title={gg.deleteOperationBtn}
                      onClick={() => handleDeleteOp(op.id, index)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
