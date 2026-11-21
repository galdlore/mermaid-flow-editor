import type {
  GitGraphCommitType,
  GitGraphDiagramData,
  GitGraphOperationData,
  GitGraphOperationKind,
  GitGraphOrientation,
} from '../types/editor';
import {
  allocateUniqueId,
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
  unquoteYamlString,
} from './mermaidEnvelope.ts';

const VALID_ORIENTATIONS = new Set<GitGraphOrientation>(['LR', 'TB', 'BT']);
const VALID_COMMIT_TYPES = new Set<GitGraphCommitType>([
  'NORMAL',
  'REVERSE',
  'HIGHLIGHT',
]);
const VALID_OP_KINDS = new Set<GitGraphOperationKind>([
  'commit',
  'branch',
  'checkout',
  'merge',
  'cherry-pick',
]);

export interface GitGraphStepState {
  opId: string;
  activeBranch: string;
  targetBranch?: string;
  knownBranches: string[];
  knownCommitIds: string[];
  warning?: string;
}

export interface GitGraphSimulationResult {
  steps: GitGraphStepState[];
  allBranches: string[];
  allCommitIds: string[];
}

export function createDefaultGitGraphData(
  lang: 'ja' | 'en' = 'ja'
): GitGraphDiagramData {
  const isJa = lang === 'ja';
  return {
    diagramType: 'gitGraph',
    title: isJa ? 'リリース開発フロー' : 'Release Git Flow',
    orientation: 'LR',
    mainBranchName: 'main',
    showBranches: true,
    showCommitLabel: true,
    rotateCommitLabel: true,
    operations: [
      {
        id: 'git_1',
        kind: 'commit',
        commitId: isJa ? '初期構築' : 'init',
        commitType: 'NORMAL',
      },
      {
        id: 'git_2',
        kind: 'branch',
        branchName: 'feature',
      },
      {
        id: 'git_3',
        kind: 'commit',
        commitId: isJa ? '新機能A' : 'feat-a',
        commitType: 'HIGHLIGHT',
      },
      {
        id: 'git_4',
        kind: 'checkout',
        branchName: 'main',
      },
      {
        id: 'git_5',
        kind: 'commit',
        commitId: isJa ? 'バグ修正' : 'hotfix',
        commitType: 'NORMAL',
      },
      {
        id: 'git_6',
        kind: 'merge',
        branchName: 'feature',
        commitId: isJa ? '統合' : 'merge-feat',
        tag: 'v1.0',
      },
    ],
  };
}

export function isValidGitGraphData(
  value: unknown
): value is GitGraphDiagramData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Partial<GitGraphDiagramData>;
  if (obj.diagramType !== 'gitGraph' || !Array.isArray(obj.operations)) {
    return false;
  }
  return obj.operations.every(
    (op) =>
      Boolean(op) &&
      typeof op === 'object' &&
      typeof op.id === 'string' &&
      typeof op.kind === 'string' &&
      VALID_OP_KINDS.has(op.kind)
  );
}

function sanitizeQuotedText(raw?: string): string | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const cleaned = raw.replace(/["\r\n]/g, '').trim();
  return cleaned || undefined;
}

export function sanitizeGitGraphBranchName(raw?: string): string {
  if (typeof raw !== 'string') {
    return 'feature';
  }
  const cleaned = raw.replace(/["'\r\n\s]/g, '').trim();
  return cleaned || 'feature';
}

function formatGitBranchRef(name: string): string {
  if (/^[A-Za-z0-9_][A-Za-z0-9_./-]*$/.test(name)) {
    return name;
  }
  return `"${name.replace(/"/g, '')}"`;
}

export function normalizeGitGraphData(
  data: GitGraphDiagramData
): GitGraphDiagramData {
  const orientation: GitGraphOrientation = VALID_ORIENTATIONS.has(
    data.orientation
  )
    ? data.orientation
    : 'LR';
  const mainBranchName = sanitizeGitGraphBranchName(
    data.mainBranchName ?? 'main'
  );
  const title =
    typeof data.title === 'string'
      ? sanitizeSingleLineComment(data.title)
      : undefined;

  const usedIds = new Set<string>();
  const operations: GitGraphOperationData[] = [];

  for (let i = 0; i < data.operations.length; i++) {
    const raw = data.operations[i];
    const baseId =
      raw.id && /^[a-zA-Z0-9_-]+$/.test(raw.id) ? raw.id : `git_${i + 1}`;
    const id = allocateUniqueId(baseId, usedIds);
    const kind: GitGraphOperationKind = VALID_OP_KINDS.has(raw.kind)
      ? raw.kind
      : 'commit';
    const commitId = sanitizeQuotedText(raw.commitId);
    const tag = sanitizeQuotedText(raw.tag);
    const commitType: GitGraphCommitType | undefined =
      raw.commitType && VALID_COMMIT_TYPES.has(raw.commitType)
        ? raw.commitType
        : undefined;
    const branchName =
      kind === 'branch' || kind === 'checkout' || kind === 'merge'
        ? sanitizeGitGraphBranchName(raw.branchName ?? 'feature')
        : undefined;
    const order =
      kind === 'branch' &&
      typeof raw.order === 'number' &&
      Number.isFinite(raw.order)
        ? Math.max(0, Math.round(raw.order))
        : undefined;
    const parent =
      kind === 'cherry-pick' ? sanitizeQuotedText(raw.parent) : undefined;

    operations.push({
      id,
      kind,
      ...(commitId ? { commitId } : {}),
      ...(tag ? { tag } : {}),
      ...(commitType && commitType !== 'NORMAL' ? { commitType } : {}),
      ...(branchName ? { branchName } : {}),
      ...(order !== undefined ? { order } : {}),
      ...(parent ? { parent } : {}),
    });
  }

  const comments = Array.isArray(data.comments)
    ? data.comments
        .filter((c): c is string => typeof c === 'string')
        .map(sanitizeSingleLineComment)
        .filter((c) => c.length > 0)
    : undefined;

  return {
    diagramType: 'gitGraph',
    ...(title ? { title } : {}),
    orientation,
    mainBranchName,
    showBranches: data.showBranches !== false,
    showCommitLabel: data.showCommitLabel !== false,
    rotateCommitLabel: data.rotateCommitLabel !== false,
    operations,
    ...(comments && comments.length > 0 ? { comments } : {}),
  };
}

/**
 * GitGraph操作列を順番に追跡し、各ステップの現在ブランチ・既存ブランチ・既存コミットIDを計算する。
 */
export function simulateGitGraphState(
  data: GitGraphDiagramData
): GitGraphSimulationResult {
  const mainBranch = sanitizeGitGraphBranchName(data.mainBranchName ?? 'main');
  let activeBranch = mainBranch;
  const branchHead = new Map<string, string | null>([[mainBranch, null]]);
  const commitIds: string[] = [];
  const commitIdSet = new Set<string>();
  const steps: GitGraphStepState[] = [];
  let seq = 0;

  for (const op of data.operations) {
    let warning: string | undefined;
    if (op.kind === 'commit') {
      const cid = op.commitId?.trim() || `${seq}-${op.id}`;
      seq++;
      branchHead.set(activeBranch, cid);
      if (!commitIdSet.has(cid)) {
        commitIdSet.add(cid);
        commitIds.push(cid);
      }
    } else if (op.kind === 'branch') {
      const target = sanitizeGitGraphBranchName(op.branchName);
      if (branchHead.has(target)) {
        warning = 'duplicate-branch';
      } else {
        branchHead.set(target, branchHead.get(activeBranch) ?? null);
        activeBranch = target;
      }
    } else if (op.kind === 'checkout') {
      const target = sanitizeGitGraphBranchName(op.branchName);
      if (!branchHead.has(target)) {
        warning = 'unknown-branch';
      } else {
        activeBranch = target;
      }
    } else if (op.kind === 'merge') {
      const target = sanitizeGitGraphBranchName(op.branchName);
      if (target === activeBranch) {
        warning = 'self-merge';
      } else if (!branchHead.has(target)) {
        warning = 'unknown-branch';
      } else if (!branchHead.get(activeBranch) || !branchHead.get(target)) {
        warning = 'empty-branch-merge';
      } else {
        const cid = op.commitId?.trim() || `${seq}-merge`;
        seq++;
        branchHead.set(activeBranch, cid);
        if (!commitIdSet.has(cid)) {
          commitIdSet.add(cid);
          commitIds.push(cid);
        }
      }
    } else if (op.kind === 'cherry-pick') {
      const sourceId = op.commitId?.trim();
      if (!sourceId || !commitIdSet.has(sourceId)) {
        warning = 'unknown-commit';
      } else {
        const cid = `${seq}-cp-${sourceId}`;
        seq++;
        branchHead.set(activeBranch, cid);
        if (!commitIdSet.has(cid)) {
          commitIdSet.add(cid);
          commitIds.push(cid);
        }
      }
    }

    steps.push({
      opId: op.id,
      activeBranch,
      targetBranch: op.branchName,
      knownBranches: Array.from(branchHead.keys()),
      knownCommitIds: [...commitIds],
      ...(warning ? { warning } : {}),
    });
  }

  return {
    steps,
    allBranches: Array.from(branchHead.keys()),
    allCommitIds: commitIds,
  };
}

export function generateGitGraphCode(rawData: GitGraphDiagramData): string {
  const data = normalizeGitGraphData(rawData);
  const lines: string[] = [];

  const gitConfig: Record<string, unknown> = {};
  if (data.mainBranchName && data.mainBranchName !== 'main') {
    gitConfig.mainBranchName = data.mainBranchName;
  }
  if (data.showBranches === false) {
    gitConfig.showBranches = false;
  }
  if (data.showCommitLabel === false) {
    gitConfig.showCommitLabel = false;
  }
  if (data.rotateCommitLabel === false) {
    gitConfig.rotateCommitLabel = false;
  }
  if (Object.keys(gitConfig).length > 0) {
    lines.push(`%%{init: ${JSON.stringify({ gitGraph: gitConfig })}}%%`);
  }

  lines.push(
    data.orientation === 'LR' ? 'gitGraph' : `gitGraph ${data.orientation}:`
  );

  if (data.title && data.title.trim()) {
    lines.push(`  title ${data.title.trim()}`);
  }

  for (const comment of data.comments ?? []) {
    const clean = sanitizeSingleLineComment(comment);
    if (clean) {
      lines.push(`  %% ${clean}`);
    }
  }

  for (const op of data.operations) {
    if (op.kind === 'commit') {
      const parts = ['  commit'];
      if (op.commitId) {
        parts.push(`id: "${op.commitId}"`);
      }
      if (op.commitType && op.commitType !== 'NORMAL') {
        parts.push(`type: ${op.commitType}`);
      }
      if (op.tag) {
        parts.push(`tag: "${op.tag}"`);
      }
      lines.push(parts.join(' '));
    } else if (op.kind === 'branch') {
      const name = formatGitBranchRef(op.branchName ?? 'feature');
      const parts = [`  branch ${name}`];
      if (op.order !== undefined) {
        parts.push(`order: ${op.order}`);
      }
      lines.push(parts.join(' '));
    } else if (op.kind === 'checkout') {
      const name = formatGitBranchRef(op.branchName ?? 'main');
      lines.push(`  checkout ${name}`);
    } else if (op.kind === 'merge') {
      const name = formatGitBranchRef(op.branchName ?? 'feature');
      const parts = [`  merge ${name}`];
      if (op.commitId) {
        parts.push(`id: "${op.commitId}"`);
      }
      if (op.commitType && op.commitType !== 'NORMAL') {
        parts.push(`type: ${op.commitType}`);
      }
      if (op.tag) {
        parts.push(`tag: "${op.tag}"`);
      }
      lines.push(parts.join(' '));
    } else if (op.kind === 'cherry-pick') {
      const cid = op.commitId || 'c1';
      const parts = [`  cherry-pick id: "${cid}"`];
      if (op.parent) {
        parts.push(`parent: "${op.parent}"`);
      }
      if (op.tag) {
        parts.push(`tag: "${op.tag}"`);
      }
      lines.push(parts.join(' '));
    }
  }

  lines.push(formatGuiStateLine(data));
  return lines.join('\n');
}

function extractQuotedAttr(line: string, key: string): string | undefined {
  const re = new RegExp(`\\b${key}\\s*:\\s*(?:"([^"]*)"|'([^']*)')`, 'i');
  const match = re.exec(line);
  if (!match) {
    return undefined;
  }
  const val = (match[1] ?? match[2] ?? '').trim();
  return val || undefined;
}

function extractCommitTypeAttr(line: string): GitGraphCommitType | undefined {
  const match = /\btype\s*:\s*(NORMAL|REVERSE|HIGHLIGHT)\b/i.exec(line);
  if (!match) {
    return undefined;
  }
  return match[1].toUpperCase() as GitGraphCommitType;
}

export function parseGitGraphCodeToGuiData(code: string): GitGraphDiagramData {
  const lines = code.split(/\r?\n/);
  const fromGuiState = extractGuiStateJson(lines, isValidGitGraphData);
  if (fromGuiState) {
    return normalizeGitGraphData(fromGuiState);
  }

  let title: string | undefined;
  let orientation: GitGraphOrientation = 'LR';
  let mainBranchName = 'main';
  let showBranches = true;
  let showCommitLabel = true;
  let rotateCommitLabel = true;
  const operations: GitGraphOperationData[] = [];
  const comments: string[] = [];

  let inFrontmatter = false;
  let opSeq = 1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      continue;
    }
    if (i === 0 && trimmed === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (trimmed === '---') {
        inFrontmatter = false;
        continue;
      }
      const fmTitle = /^title\s*:\s*(.+)$/i.exec(trimmed);
      if (fmTitle) {
        title = unquoteYamlString(fmTitle[1]);
      }
      continue;
    }

    const initMatch = /^%%\{\s*init\s*:\s*([\s\S]+?)\s*\}%%$/i.exec(trimmed);
    if (initMatch) {
      try {
        const parsed = JSON.parse(initMatch[1]) as {
          gitGraph?: {
            mainBranchName?: unknown;
            showBranches?: unknown;
            showCommitLabel?: unknown;
            rotateCommitLabel?: unknown;
          };
        };
        const gg = parsed.gitGraph;
        if (gg && typeof gg === 'object') {
          if (typeof gg.mainBranchName === 'string' && gg.mainBranchName.trim()) {
            mainBranchName = sanitizeGitGraphBranchName(gg.mainBranchName);
          }
          if (typeof gg.showBranches === 'boolean') {
            showBranches = gg.showBranches;
          }
          if (typeof gg.showCommitLabel === 'boolean') {
            showCommitLabel = gg.showCommitLabel;
          }
          if (typeof gg.rotateCommitLabel === 'boolean') {
            rotateCommitLabel = gg.rotateCommitLabel;
          }
        }
      } catch {
        // initパース失敗時は無視
      }
      continue;
    }

    if (trimmed.startsWith('%%')) {
      const comment = trimmed.slice(2).trim();
      if (comment && !comment.startsWith('@gui-state:')) {
        comments.push(comment);
      }
      continue;
    }

    const headerMatch = /^gitGraph(?:\s+(LR|TB|BT))?\s*:?$/i.exec(trimmed);
    if (headerMatch) {
      if (headerMatch[1]) {
        orientation = headerMatch[1].toUpperCase() as GitGraphOrientation;
      }
      continue;
    }

    const titleMatch = /^title\s+(.+)$/i.exec(trimmed);
    if (titleMatch) {
      title = titleMatch[1].trim();
      continue;
    }

    if (/^accTitle\b|^accDescr\b/i.test(trimmed)) {
      continue;
    }

    if (/^commit\b/i.test(trimmed)) {
      operations.push({
        id: `git_${opSeq++}`,
        kind: 'commit',
        commitId: extractQuotedAttr(trimmed, 'id'),
        tag: extractQuotedAttr(trimmed, 'tag'),
        commitType: extractCommitTypeAttr(trimmed),
      });
      continue;
    }

    const branchMatch = /^branch\s+("[^"]+"|'[^']+'|\S+)(.*)$/i.exec(trimmed);
    if (branchMatch) {
      const orderMatch = /\border\s*:\s*(\d+)\b/i.exec(branchMatch[2]);
      operations.push({
        id: `git_${opSeq++}`,
        kind: 'branch',
        branchName: sanitizeGitGraphBranchName(
          unquoteYamlString(branchMatch[1])
        ),
        ...(orderMatch ? { order: Number.parseInt(orderMatch[1], 10) } : {}),
      });
      continue;
    }

    const checkoutMatch = /^(?:checkout|switch)\s+("[^"]+"|'[^']+'|\S+)/i.exec(
      trimmed
    );
    if (checkoutMatch) {
      operations.push({
        id: `git_${opSeq++}`,
        kind: 'checkout',
        branchName: sanitizeGitGraphBranchName(
          unquoteYamlString(checkoutMatch[1])
        ),
      });
      continue;
    }

    const mergeMatch = /^merge\s+("[^"]+"|'[^']+'|\S+)(.*)$/i.exec(trimmed);
    if (mergeMatch) {
      operations.push({
        id: `git_${opSeq++}`,
        kind: 'merge',
        branchName: sanitizeGitGraphBranchName(unquoteYamlString(mergeMatch[1])),
        commitId: extractQuotedAttr(mergeMatch[2], 'id'),
        tag: extractQuotedAttr(mergeMatch[2], 'tag'),
        commitType: extractCommitTypeAttr(mergeMatch[2]),
      });
      continue;
    }

    if (/^cherry-pick\b/i.test(trimmed)) {
      operations.push({
        id: `git_${opSeq++}`,
        kind: 'cherry-pick',
        commitId: extractQuotedAttr(trimmed, 'id'),
        parent: extractQuotedAttr(trimmed, 'parent'),
        tag: extractQuotedAttr(trimmed, 'tag'),
      });
    }
  }

  return normalizeGitGraphData({
    diagramType: 'gitGraph',
    ...(title ? { title } : {}),
    orientation,
    mainBranchName,
    showBranches,
    showCommitLabel,
    rotateCommitLabel,
    operations,
    ...(comments.length > 0 ? { comments } : {}),
  });
}
