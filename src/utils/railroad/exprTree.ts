import type { RailroadExprNode } from '../../types/editor';
import { createRailroadExprId, createRailroadExprNode } from './shared.ts';

export function findRailroadExprNode(
  root: RailroadExprNode,
  targetId: string
): RailroadExprNode | null {
  if (root.id === targetId) {
    return root;
  }
  for (const child of root.children ?? []) {
    const found = findRailroadExprNode(child, targetId);
    if (found) {
      return found;
    }
  }
  return null;
}

export function updateRailroadExprNode(
  root: RailroadExprNode,
  targetId: string,
  updater: (node: RailroadExprNode) => RailroadExprNode
): RailroadExprNode {
  if (root.id === targetId) {
    return updater(root);
  }
  if (!root.children) {
    return root;
  }
  let changed = false;
  const nextChildren = root.children.map((child) => {
    const next = updateRailroadExprNode(child, targetId, updater);
    if (next !== child) {
      changed = true;
    }
    return next;
  });
  return changed ? { ...root, children: nextChildren } : root;
}

export function appendRailroadExprChild(
  root: RailroadExprNode,
  parentId: string,
  child: RailroadExprNode
): RailroadExprNode {
  return updateRailroadExprNode(root, parentId, (node) => {
    if (node.kind === 'sequence' || node.kind === 'choice') {
      return { ...node, children: [...(node.children ?? []), child] };
    }
    if (
      node.kind === 'optional' ||
      node.kind === 'oneOrMore' ||
      node.kind === 'zeroOrMore'
    ) {
      const existing = node.children?.[0];
      if (!existing) {
        return { ...node, children: [child] };
      }
      const seqNode: RailroadExprNode =
        existing.kind === 'sequence'
          ? { ...existing, children: [...(existing.children ?? []), child] }
          : createRailroadExprNode('sequence', undefined, [existing, child]);
      return { ...node, children: [seqNode] };
    }
    return createRailroadExprNode('sequence', undefined, [node, child]);
  });
}

export function wrapRailroadExprNode(
  root: RailroadExprNode,
  targetId: string,
  wrapperKind: 'sequence' | 'choice' | 'optional' | 'oneOrMore' | 'zeroOrMore'
): { root: RailroadExprNode; wrapperId: string } {
  const wrapperId = createRailroadExprId();
  const nextRoot = updateRailroadExprNode(root, targetId, (node) => {
    if (wrapperKind === 'sequence' || wrapperKind === 'choice') {
      return {
        id: wrapperId,
        kind: wrapperKind,
        children: [
          node,
          createRailroadExprNode(
            'terminal',
            wrapperKind === 'choice' ? 'alt' : 'next'
          ),
        ],
      };
    }
    return {
      id: wrapperId,
      kind: wrapperKind,
      children: [node],
    };
  });
  return { root: nextRoot, wrapperId };
}

export function moveRailroadExprChild(
  root: RailroadExprNode,
  targetId: string,
  delta: -1 | 1
): RailroadExprNode {
  if (!root.children) {
    return root;
  }
  const idx = root.children.findIndex((c) => c.id === targetId);
  if (idx !== -1) {
    const swapIdx = idx + delta;
    if (swapIdx < 0 || swapIdx >= root.children.length) {
      return root;
    }
    const next = [...root.children];
    const [moved] = next.splice(idx, 1);
    next.splice(swapIdx, 0, moved);
    return { ...root, children: next };
  }
  return {
    ...root,
    children: root.children.map((c) => moveRailroadExprChild(c, targetId, delta)),
  };
}

export function deleteRailroadExprNode(
  root: RailroadExprNode,
  targetId: string
): RailroadExprNode {
  if (root.id === targetId) {
    // Root wrapper can be unwrapped to its first child if composite
    if (root.children && root.children.length > 0) {
      return root.children[0];
    }
    return root;
  }
  if (!root.children) {
    return root;
  }
  const idx = root.children.findIndex((c) => c.id === targetId);
  if (idx !== -1) {
    const target = root.children[idx];
    // If target is a unary wrapper with a child inside sequence/choice, replace with its child
    if (
      (target.kind === 'optional' ||
        target.kind === 'oneOrMore' ||
        target.kind === 'zeroOrMore') &&
      target.children &&
      target.children.length === 1 &&
      root.children.length <= 1
    ) {
      return { ...root, children: [target.children[0]] };
    }
    if (root.children.length <= 1) {
      return root;
    }
    return {
      ...root,
      children: root.children.filter((c) => c.id !== targetId),
    };
  }
  return {
    ...root,
    children: root.children.map((c) => deleteRailroadExprNode(c, targetId)),
  };
}
