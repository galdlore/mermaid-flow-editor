export type GitGraphOrientation = 'LR' | 'TB' | 'BT';

export type GitGraphCommitType = 'NORMAL' | 'REVERSE' | 'HIGHLIGHT';

export type GitGraphOperationKind =
  | 'commit'
  | 'branch'
  | 'checkout'
  | 'merge'
  | 'cherry-pick';

export interface GitGraphOperationData {
  id: string;
  kind: GitGraphOperationKind;
  commitId?: string;
  tag?: string;
  commitType?: GitGraphCommitType;
  branchName?: string;
  order?: number;
  parent?: string;
}

export interface GitGraphDiagramData {
  diagramType: 'gitGraph';
  title?: string;
  orientation: GitGraphOrientation;
  mainBranchName?: string;
  showBranches?: boolean;
  showCommitLabel?: boolean;
  rotateCommitLabel?: boolean;
  operations: GitGraphOperationData[];
  comments?: string[];
}
