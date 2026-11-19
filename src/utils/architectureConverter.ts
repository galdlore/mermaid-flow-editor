import type {
  ArchitectureAlignDirection,
  ArchitectureAlignHintData,
  ArchitectureDiagramData,
  ArchitectureDirection,
  ArchitectureEdgeData,
  ArchitectureGroupData,
  ArchitectureNodeData,
} from '../types/editor';
import {
  GUI_STATE_PREFIX,
  allocateUniqueId,
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
} from './mermaidEnvelope.ts';

const VALID_DIRS = new Set<ArchitectureDirection>(['L', 'R', 'T', 'B']);

const OPPOSITE_DIR: Record<ArchitectureDirection, ArchitectureDirection> = {
  L: 'R',
  R: 'L',
  T: 'B',
  B: 'T',
};

export function createDefaultArchitectureData(
  lang: 'ja' | 'en' = 'ja'
): ArchitectureDiagramData {
  const isJa = lang === 'ja';
  return {
    diagramType: 'architecture',
    title: isJa ? 'Webシステム構成図' : 'Web Service Architecture',
    groups: [
      {
        id: 'api_group',
        icon: 'cloud',
        title: isJa ? 'クラウド基盤' : 'Cloud Platform',
      },
    ],
    nodes: [
      {
        id: 'client',
        type: 'service',
        icon: 'internet',
        title: isJa ? 'ユーザー端末' : 'Client',
      },
      {
        id: 'web',
        type: 'service',
        icon: 'server',
        title: isJa ? 'Webサーバー' : 'Web Server',
        groupId: 'api_group',
      },
      {
        id: 'db',
        type: 'service',
        icon: 'database',
        title: isJa ? 'データベース' : 'Database',
        groupId: 'api_group',
      },
      {
        id: 'storage',
        type: 'service',
        icon: 'disk',
        title: isJa ? 'ストレージ' : 'Object Storage',
        groupId: 'api_group',
      },
    ],
    edges: [
      {
        id: 'edge_1',
        lhsId: 'client',
        lhsDir: 'R',
        rhsId: 'web',
        rhsDir: 'L',
        rhsInto: true,
        title: 'HTTPS',
      },
      {
        id: 'edge_2',
        lhsId: 'web',
        lhsDir: 'R',
        rhsId: 'db',
        rhsDir: 'L',
        rhsInto: true,
        title: 'SQL',
      },
      {
        id: 'edge_3',
        lhsId: 'web',
        lhsDir: 'B',
        rhsId: 'storage',
        rhsDir: 'T',
        rhsInto: true,
        title: 'Store',
      },
    ],
  };
}

export function isValidArchitectureData(
  value: unknown
): value is ArchitectureDiagramData {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<ArchitectureDiagramData>;
  if (
    candidate.diagramType !== 'architecture' ||
    !Array.isArray(candidate.groups) ||
    !Array.isArray(candidate.nodes) ||
    !Array.isArray(candidate.edges)
  ) {
    return false;
  }
  return (
    candidate.groups.every(
      (g) => Boolean(g) && typeof g.id === 'string' && typeof g.title === 'string'
    ) &&
    candidate.nodes.every(
      (n) =>
        Boolean(n) &&
        typeof n.id === 'string' &&
        (n.type === 'service' || n.type === 'junction')
    ) &&
    candidate.edges.every(
      (e) =>
        Boolean(e) &&
        typeof e.id === 'string' &&
        typeof e.lhsId === 'string' &&
        typeof e.rhsId === 'string' &&
        VALID_DIRS.has(e.lhsDir) &&
        VALID_DIRS.has(e.rhsDir)
    )
  );
}

function sanitizeArchId(raw: string, fallbackPrefix: string): string {
  // Architecture ID rule: /[\w](-[\w]*|\w)*/
  const cleaned = raw
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/^[-_]+/, '')
    .replace(/-+$/, '');
  if (!cleaned) {
    return fallbackPrefix;
  }
  return /^[a-zA-Z0-9_]/.test(cleaned) ? cleaned : `${fallbackPrefix}_${cleaned}`;
}

function sanitizeArchTitle(raw: string, fallback: string): string {
  const cleaned = raw
    .replace(/[\[\]\r\n"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

function sanitizeArchIcon(raw?: string): string | undefined {
  if (!raw) {
    return undefined;
  }
  const cleaned = raw.replace(/[^a-zA-Z0-9_:-]/g, '').trim();
  if (!cleaned || cleaned === 'none') {
    return undefined;
  }
  return cleaned;
}

function sortGroupsParentFirst(
  groups: ArchitectureGroupData[]
): ArchitectureGroupData[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const result: ArchitectureGroupData[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (group: ArchitectureGroupData): void => {
    if (visited.has(group.id)) {
      return;
    }
    if (visiting.has(group.id)) {
      // Break cycle
      return;
    }
    visiting.add(group.id);
    if (group.parentId && group.parentId !== group.id) {
      const parent = byId.get(group.parentId);
      if (parent && !visiting.has(parent.id)) {
        visit(parent);
      }
    }
    visiting.delete(group.id);
    visited.add(group.id);
    const parentKept =
      group.parentId && visited.has(group.parentId)
        ? group.parentId
        : undefined;
    result.push({
      id: group.id,
      title: group.title,
      ...(group.icon ? { icon: group.icon } : {}),
      ...(parentKept ? { parentId: parentKept } : {}),
    });
  };

  for (const group of groups) {
    visit(group);
  }
  return result;
}

function normalizeArchitectureData(
  data: ArchitectureDiagramData
): ArchitectureDiagramData {
  const usedIds = new Set<string>();
  const idMap = new Map<string, string>();

  const rawGroups: ArchitectureGroupData[] = data.groups.map((g, idx) => {
    const base = sanitizeArchId(g.id, `grp_${idx + 1}`);
    const unique = allocateUniqueId(base, usedIds);
    idMap.set(g.id, unique);
    return {
      id: unique,
      title: sanitizeArchTitle(g.title, unique),
      icon: sanitizeArchIcon(g.icon),
      parentId: g.parentId,
    };
  });

  const mappedGroups = rawGroups.map((g) => ({
    ...g,
    parentId: g.parentId ? idMap.get(g.parentId) : undefined,
  }));
  const groups = sortGroupsParentFirst(mappedGroups);
  const validGroupIds = new Set(groups.map((g) => g.id));

  const nodes: ArchitectureNodeData[] = data.nodes.map((n, idx) => {
    const base = sanitizeArchId(
      n.id,
      n.type === 'junction' ? `junc_${idx + 1}` : `svc_${idx + 1}`
    );
    const unique = allocateUniqueId(base, usedIds);
    idMap.set(n.id, unique);

    const mappedGroup = n.groupId ? idMap.get(n.groupId) : undefined;
    const validGroup =
      mappedGroup && validGroupIds.has(mappedGroup) ? mappedGroup : undefined;

    if (n.type === 'junction') {
      return {
        id: unique,
        type: 'junction',
        ...(validGroup ? { groupId: validGroup } : {}),
      };
    }

    const icon = sanitizeArchIcon(n.icon);
    const title = sanitizeArchTitle(n.title ?? '', unique);
    return {
      id: unique,
      type: 'service',
      title,
      ...(icon ? { icon } : {}),
      ...(validGroup ? { groupId: validGroup } : {}),
    };
  });

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const edges: ArchitectureEdgeData[] = [];
  data.edges.forEach((e, idx) => {
    const lhsId = idMap.get(e.lhsId) ?? e.lhsId;
    const rhsId = idMap.get(e.rhsId) ?? e.rhsId;
    const lhsNode = nodeMap.get(lhsId);
    const rhsNode = nodeMap.get(rhsId);
    if (!lhsNode || !rhsNode || lhsId === rhsId) {
      return;
    }

    const lhsDir: ArchitectureDirection = VALID_DIRS.has(e.lhsDir)
      ? e.lhsDir
      : 'R';
    let rhsDir: ArchitectureDirection = VALID_DIRS.has(e.rhsDir)
      ? e.rhsDir
      : OPPOSITE_DIR[lhsDir];
    if (lhsDir === rhsDir) {
      rhsDir = OPPOSITE_DIR[lhsDir];
    }

    const sameGroup =
      Boolean(lhsNode.groupId) && lhsNode.groupId === rhsNode.groupId;
    const lhsGroup = !sameGroup && Boolean(e.lhsGroup);
    const rhsGroup = !sameGroup && Boolean(e.rhsGroup);
    const title = e.title
      ? e.title.replace(/[\[\]\r\n]/g, ' ').replace(/\s+/g, ' ').trim()
      : '';

    edges.push({
      id: e.id || `edge_${idx + 1}`,
      lhsId,
      lhsDir,
      ...(e.lhsInto ? { lhsInto: true } : {}),
      ...(lhsGroup ? { lhsGroup: true } : {}),
      rhsId,
      rhsDir,
      ...(e.rhsInto ? { rhsInto: true } : {}),
      ...(rhsGroup ? { rhsGroup: true } : {}),
      ...(title ? { title } : {}),
    });
  });

  const alignments: ArchitectureAlignHintData[] = [];
  if (Array.isArray(data.alignments)) {
    data.alignments.forEach((hint, idx) => {
      if (!hint || !Array.isArray(hint.members)) {
        return;
      }
      const members = Array.from(
        new Set(
          hint.members
            .filter((m): m is string => typeof m === 'string')
            .map((m) => idMap.get(m) ?? m)
            .filter((m) => nodeMap.has(m))
        )
      );
      if (members.length >= 2) {
        alignments.push({
          id: hint.id || `align_${idx + 1}`,
          direction: hint.direction === 'column' ? 'column' : 'row',
          members,
        });
      }
    });
  }

  const title = data.title
    ? data.title.replace(/[\r\n]/g, ' ').replace(/\s+/g, ' ').trim()
    : '';
  const padding =
    typeof data.padding === 'number' &&
    Number.isFinite(data.padding) &&
    data.padding >= 10 &&
    data.padding <= 120
      ? Math.round(data.padding)
      : undefined;
  const iconSize =
    typeof data.iconSize === 'number' &&
    Number.isFinite(data.iconSize) &&
    data.iconSize >= 32 &&
    data.iconSize <= 160
      ? Math.round(data.iconSize)
      : undefined;
  const nodeSeparation =
    typeof data.nodeSeparation === 'number' &&
    Number.isFinite(data.nodeSeparation) &&
    data.nodeSeparation >= 20 &&
    data.nodeSeparation <= 240
      ? Math.round(data.nodeSeparation)
      : undefined;
  const comments = Array.isArray(data.comments)
    ? data.comments
        .filter((line): line is string => typeof line === 'string')
        .map(sanitizeSingleLineComment)
        .filter((line) => line.length > 0)
    : undefined;

  return {
    diagramType: 'architecture',
    ...(title ? { title } : {}),
    groups,
    nodes,
    edges,
    ...(alignments.length > 0 ? { alignments } : {}),
    ...(padding !== undefined ? { padding } : {}),
    ...(iconSize !== undefined ? { iconSize } : {}),
    ...(nodeSeparation !== undefined ? { nodeSeparation } : {}),
    ...(comments && comments.length > 0 ? { comments } : {}),
  };
}

export function generateArchitectureCode(
  data: ArchitectureDiagramData
): string {
  const normalized = normalizeArchitectureData(data);
  const lines: string[] = [];

  const configEntries: string[] = [];
  if (normalized.padding !== undefined && normalized.padding !== 40) {
    configEntries.push(`    padding: ${normalized.padding}`);
  }
  if (normalized.iconSize !== undefined && normalized.iconSize !== 80) {
    configEntries.push(`    iconSize: ${normalized.iconSize}`);
  }
  if (
    normalized.nodeSeparation !== undefined &&
    normalized.nodeSeparation !== 75
  ) {
    configEntries.push(`    nodeSeparation: ${normalized.nodeSeparation}`);
  }

  if (configEntries.length > 0) {
    lines.push('---');
    lines.push('config:');
    lines.push('  architecture:');
    lines.push(...configEntries);
    lines.push('---');
  }

  lines.push('architecture-beta');

  if (normalized.title) {
    lines.push(`  title ${normalized.title}`);
  }

  if (normalized.comments && normalized.comments.length > 0) {
    for (const comment of normalized.comments) {
      lines.push(`  %% ${comment}`);
    }
  }

  for (const group of normalized.groups) {
    const iconPart = group.icon ? `(${group.icon})` : '';
    const inPart = group.parentId ? ` in ${group.parentId}` : '';
    lines.push(`  group ${group.id}${iconPart}[${group.title}]${inPart}`);
  }

  for (const node of normalized.nodes) {
    const inPart = node.groupId ? ` in ${node.groupId}` : '';
    if (node.type === 'junction') {
      lines.push(`  junction ${node.id}${inPart}`);
    } else {
      const iconPart = node.icon ? `(${node.icon})` : '';
      lines.push(
        `  service ${node.id}${iconPart}[${node.title ?? node.id}]${inPart}`
      );
    }
  }

  for (const edge of normalized.edges) {
    const lhsGroup = edge.lhsGroup ? '{group}' : '';
    const rhsGroup = edge.rhsGroup ? '{group}' : '';
    const lhsArrow = edge.lhsInto ? '<' : '';
    const rhsArrow = edge.rhsInto ? '>' : '';
    const connector = edge.title
      ? `${lhsArrow}-[${edge.title}]-${rhsArrow}`
      : `${lhsArrow}--${rhsArrow}`;
    lines.push(
      `  ${edge.lhsId}${lhsGroup}:${edge.lhsDir} ${connector} ${edge.rhsDir}:${edge.rhsId}${rhsGroup}`
    );
  }

  if (normalized.alignments) {
    for (const hint of normalized.alignments) {
      lines.push(`  align ${hint.direction} ${hint.members.join(' ')}`);
    }
  }

  lines.push(formatGuiStateLine(normalized));
  return lines.join('\n');
}

function stripTitleBrackets(raw: string): string {
  let inner = raw.trim().replace(/^\[|\]$/g, '').trim();
  if (
    (inner.startsWith('"') && inner.endsWith('"')) ||
    (inner.startsWith("'") && inner.endsWith("'"))
  ) {
    inner = inner.slice(1, -1);
  }
  return inner.trim();
}

export function parseArchitectureCodeToGuiData(
  code: string
): ArchitectureDiagramData {
  const lines = code.split(/\r?\n/);

  const restored = extractGuiStateJson(lines, isValidArchitectureData);
  if (restored) {
    return normalizeArchitectureData(restored);
  }

  let title: string | undefined;
  let padding: number | undefined;
  let iconSize: number | undefined;
  let nodeSeparation: number | undefined;
  const groups: ArchitectureGroupData[] = [];
  const nodes: ArchitectureNodeData[] = [];
  const edges: ArchitectureEdgeData[] = [];
  const alignments: ArchitectureAlignHintData[] = [];
  const comments: string[] = [];

  let i = 0;
  if (lines[0]?.trim() === '---') {
    i = 1;
    let inArchConfig = false;
    while (i < lines.length && lines[i].trim() !== '---') {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();
      if (/^architecture\s*:/i.test(trimmed)) {
        inArchConfig = true;
      } else if (inArchConfig && /^padding\s*:/i.test(trimmed)) {
        const n = Number(trimmed.slice(trimmed.indexOf(':') + 1).trim());
        if (Number.isFinite(n)) padding = n;
      } else if (inArchConfig && /^iconSize\s*:/i.test(trimmed)) {
        const n = Number(trimmed.slice(trimmed.indexOf(':') + 1).trim());
        if (Number.isFinite(n)) iconSize = n;
      } else if (inArchConfig && /^nodeSeparation\s*:/i.test(trimmed)) {
        const n = Number(trimmed.slice(trimmed.indexOf(':') + 1).trim());
        if (Number.isFinite(n)) nodeSeparation = n;
      } else if (inArchConfig && rawLine.length > 0 && !/^\s/.test(rawLine)) {
        inArchConfig = false;
      }
      i++;
    }
    if (i < lines.length && lines[i].trim() === '---') {
      i++;
    }
  }

  let foundHeader = false;
  for (; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed.startsWith('%%{')) {
      const initMatch = trimmed.match(/^%%\{init\s*:\s*([\s\S]*?)\}%%$/);
      if (initMatch) {
        try {
          const parsedInit = JSON.parse(initMatch[1]) as {
            architecture?: {
              padding?: unknown;
              iconSize?: unknown;
              nodeSeparation?: unknown;
            };
          };
          if (typeof parsedInit.architecture?.padding === 'number') {
            padding = parsedInit.architecture.padding;
          }
          if (typeof parsedInit.architecture?.iconSize === 'number') {
            iconSize = parsedInit.architecture.iconSize;
          }
          if (typeof parsedInit.architecture?.nodeSeparation === 'number') {
            nodeSeparation = parsedInit.architecture.nodeSeparation;
          }
        } catch {
          // Ignore malformed init directive
        }
      }
      continue;
    }

    if (trimmed.startsWith('%%')) {
      if (!trimmed.startsWith(GUI_STATE_PREFIX)) {
        const commentBody = trimmed.replace(/^%%+\s?/, '').trim();
        if (commentBody) {
          comments.push(commentBody);
        }
      }
      continue;
    }

    if (!foundHeader) {
      if (/^architecture(?:-beta)?\b/i.test(trimmed)) {
        foundHeader = true;
      }
      continue;
    }

    const titleMatch = trimmed.match(/^title\s+(.+)$/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      continue;
    }

    if (/^accTitle\s*:/i.test(trimmed) || /^accDescr\s*[:{]/i.test(trimmed)) {
      continue;
    }

    // group <id>(<icon>)?[<title>]( in <parent>)?
    const groupMatch = trimmed.match(
      /^group\s+([a-zA-Z0-9_-]+)(?:\(([^)]+)\))?(\[[^\]]*\])?(?:\s+in\s+([a-zA-Z0-9_-]+))?$/
    );
    if (groupMatch) {
      const id = groupMatch[1];
      const icon = groupMatch[2]?.trim() || undefined;
      const groupTitle = groupMatch[3] ? stripTitleBrackets(groupMatch[3]) : id;
      const parentId = groupMatch[4]?.trim() || undefined;
      groups.push({ id, title: groupTitle, icon, parentId });
      continue;
    }

    // service <id>(<icon>)?[<title>]( in <groupId>)?
    const serviceMatch = trimmed.match(
      /^service\s+([a-zA-Z0-9_-]+)(?:\(([^)]+)\))?(\[[^\]]*\])?(?:\s+in\s+([a-zA-Z0-9_-]+))?$/
    );
    if (serviceMatch) {
      const id = serviceMatch[1];
      const rawIcon = serviceMatch[2]?.trim().replace(/^["']|["']$/g, '');
      const svcTitle = serviceMatch[3]
        ? stripTitleBrackets(serviceMatch[3])
        : id;
      const groupId = serviceMatch[4]?.trim() || undefined;
      nodes.push({
        id,
        type: 'service',
        icon: rawIcon || undefined,
        title: svcTitle,
        groupId,
      });
      continue;
    }

    // junction <id>( in <groupId>)?
    const junctionMatch = trimmed.match(
      /^junction\s+([a-zA-Z0-9_-]+)(?:\s+in\s+([a-zA-Z0-9_-]+))?$/
    );
    if (junctionMatch) {
      nodes.push({
        id: junctionMatch[1],
        type: 'junction',
        groupId: junctionMatch[2]?.trim() || undefined,
      });
      continue;
    }

    // align (row|column) id1 id2 ...
    const alignMatch = trimmed.match(/^align\s+(row|column)\s+(.+)$/);
    if (alignMatch) {
      const members = alignMatch[2]
        .trim()
        .split(/\s+/)
        .filter((token) => /^[a-zA-Z0-9_-]+$/.test(token));
      if (members.length >= 2) {
        alignments.push({
          id: `align_${alignments.length + 1}`,
          direction: alignMatch[1] as ArchitectureAlignDirection,
          members,
        });
      }
      continue;
    }

    // edge: lhsId({group})?:L|R|T|B (<?--?>|<?-\[label\]-?>) L|R|T|B:rhsId({group})?
    const edgeMatch = trimmed.match(
      /^([a-zA-Z0-9_-]+)(\{group\})?:([LRTB])\s*(<?)-(?:\[([^\]]*)\])?-(>?)\s*([LRTB]):([a-zA-Z0-9_-]+)(\{group\})?$/
    );
    if (edgeMatch) {
      edges.push({
        id: `edge_${edges.length + 1}`,
        lhsId: edgeMatch[1],
        lhsGroup: Boolean(edgeMatch[2]),
        lhsDir: edgeMatch[3] as ArchitectureDirection,
        lhsInto: edgeMatch[4] === '<',
        title: edgeMatch[5]?.trim() || undefined,
        rhsInto: edgeMatch[6] === '>',
        rhsDir: edgeMatch[7] as ArchitectureDirection,
        rhsId: edgeMatch[8],
        rhsGroup: Boolean(edgeMatch[9]),
      });
    }
  }

  return normalizeArchitectureData({
    diagramType: 'architecture',
    ...(title ? { title } : {}),
    groups,
    nodes,
    edges,
    ...(alignments.length > 0 ? { alignments } : {}),
    ...(padding !== undefined ? { padding } : {}),
    ...(iconSize !== undefined ? { iconSize } : {}),
    ...(nodeSeparation !== undefined ? { nodeSeparation } : {}),
    ...(comments.length > 0 ? { comments } : {}),
  });
}
