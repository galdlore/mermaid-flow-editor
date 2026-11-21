import type { Language } from '../locales/types.ts';
import type {
  RequirementDiagramData,
  RequirementDirection,
  RequirementElementData,
  RequirementKind,
  RequirementNodeData,
  RequirementRelationData,
  RequirementRelationType,
  RequirementRisk,
  RequirementVerifyMethod,
} from '../types/editor.ts';
import {
  allocateUniqueId,
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
  sanitizeYamlSingleQuoted,
  unquoteYamlString,
} from './mermaidEnvelope.ts';

export const REQUIREMENT_KIND_OPTIONS: ReadonlyArray<RequirementKind> = [
  'requirement',
  'functionalRequirement',
  'interfaceRequirement',
  'performanceRequirement',
  'physicalRequirement',
  'designConstraint',
];

export const REQUIREMENT_RISK_OPTIONS: ReadonlyArray<RequirementRisk> = [
  'low',
  'medium',
  'high',
];

export const REQUIREMENT_VERIFY_OPTIONS: ReadonlyArray<RequirementVerifyMethod> = [
  'analysis',
  'demonstration',
  'inspection',
  'test',
];

export const REQUIREMENT_RELATION_OPTIONS: ReadonlyArray<RequirementRelationType> = [
  'contains',
  'copies',
  'derives',
  'satisfies',
  'verifies',
  'refines',
  'traces',
];

export const REQUIREMENT_DIRECTION_OPTIONS: ReadonlyArray<RequirementDirection> = [
  'TB',
  'BT',
  'LR',
  'RL',
];

const KIND_SET = new Set<string>(REQUIREMENT_KIND_OPTIONS);
const RISK_SET = new Set<string>(REQUIREMENT_RISK_OPTIONS);
const VERIFY_SET = new Set<string>(REQUIREMENT_VERIFY_OPTIONS);
const RELATION_SET = new Set<string>(REQUIREMENT_RELATION_OPTIONS);
const DIRECTION_SET = new Set<string>(REQUIREMENT_DIRECTION_OPTIONS);

function sanitizeReqQuotedText(raw: string, fallback: string): string {
  const cleaned = raw.replace(/["\r\n]/g, '').trim();
  return cleaned || fallback;
}

function unquoteReqScalar(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function createDefaultRequirementData(
  lang: Language = 'ja'
): RequirementDiagramData {
  if (lang === 'en') {
    return {
      diagramType: 'requirement',
      direction: 'LR',
      requirements: [
        {
          id: 'req1',
          name: 'User Authentication',
          kind: 'functionalRequirement',
          reqId: 'REQ-1',
          text: 'Users must sign in using MFA',
          risk: 'high',
          verifyMethod: 'test',
        },
        {
          id: 'req2',
          name: 'Audit Logging',
          kind: 'interfaceRequirement',
          reqId: 'REQ-2',
          text: 'Record all sign-in successes and failures',
          risk: 'medium',
          verifyMethod: 'inspection',
        },
      ],
      elements: [
        {
          id: 'el1',
          name: 'Auth Service',
          type: 'Microservice',
          docref: 'docs/auth.md',
        },
      ],
      relations: [
        { id: 'rrel1', sourceId: 'el1', targetId: 'req1', type: 'satisfies' },
        { id: 'rrel2', sourceId: 'req1', targetId: 'req2', type: 'derives' },
      ],
    };
  }
  return {
    diagramType: 'requirement',
    direction: 'LR',
    requirements: [
      {
        id: 'req1',
        name: 'ユーザー認証要件',
        kind: 'functionalRequirement',
        reqId: 'REQ-1',
        text: 'MFAで安全にログインできること',
        risk: 'high',
        verifyMethod: 'test',
      },
      {
        id: 'req2',
        name: '監査ログ記録',
        kind: 'interfaceRequirement',
        reqId: 'REQ-2',
        text: '認証の成功と失敗を記録すること',
        risk: 'medium',
        verifyMethod: 'inspection',
      },
    ],
    elements: [
      {
        id: 'el1',
        name: '認証サービス',
        type: 'Microservice',
        docref: 'docs/auth.md',
      },
    ],
    relations: [
      { id: 'rrel1', sourceId: 'el1', targetId: 'req1', type: 'satisfies' },
      { id: 'rrel2', sourceId: 'req1', targetId: 'req2', type: 'derives' },
    ],
  };
}

function isRequirementGuiData(val: unknown): val is RequirementDiagramData {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  return (
    obj.diagramType === 'requirement' &&
    Array.isArray(obj.requirements) &&
    Array.isArray(obj.elements) &&
    Array.isArray(obj.relations)
  );
}

function allocateUniqueDisplayName(
  desired: string,
  usedNames: Set<string>,
  fallback: string
): string {
  const base = sanitizeReqQuotedText(desired, fallback);
  if (!usedNames.has(base)) {
    usedNames.add(base);
    return base;
  }
  let suffix = 2;
  while (usedNames.has(`${base} (${suffix})`)) {
    suffix++;
  }
  const unique = `${base} (${suffix})`;
  usedNames.add(unique);
  return unique;
}

export function generateRequirementCode(data: RequirementDiagramData): string {
  const lines: string[] = [];
  const trimmedTitle = data.title ? data.title.replace(/[\r\n]+/g, ' ').trim() : '';
  if (trimmedTitle) {
    lines.push('---');
    lines.push(`title: '${sanitizeYamlSingleQuoted(trimmedTitle)}'`);
    lines.push('---');
  }

  lines.push('requirementDiagram');

  const safeComments = (data.comments ?? [])
    .map((c) => sanitizeSingleLineComment(c))
    .filter(Boolean);
  for (const comment of safeComments) {
    lines.push(`  %% ${comment}`);
  }

  const direction: RequirementDirection =
    data.direction && DIRECTION_SET.has(data.direction) ? data.direction : 'TB';
  if (data.direction && DIRECTION_SET.has(data.direction)) {
    lines.push(`  direction ${direction}`);
  }

  const usedNames = new Set<string>();
  const emittedNameById = new Map<string, string>();

  const normRequirements: RequirementNodeData[] = [];
  for (let i = 0; i < data.requirements.length; i++) {
    const req = data.requirements[i];
    const kind: RequirementKind = KIND_SET.has(req.kind) ? req.kind : 'requirement';
    const risk: RequirementRisk = RISK_SET.has(req.risk) ? req.risk : 'low';
    const verifyMethod: RequirementVerifyMethod = VERIFY_SET.has(req.verifyMethod)
      ? req.verifyMethod
      : 'analysis';
    const name = allocateUniqueDisplayName(req.name, usedNames, `Req ${i + 1}`);
    const reqId = sanitizeReqQuotedText(req.reqId, `REQ-${i + 1}`);
    const text = sanitizeReqQuotedText(req.text, name);
    emittedNameById.set(req.id, name);
    normRequirements.push({ ...req, name, kind, reqId, text, risk, verifyMethod });

    lines.push(`  ${kind} "${name}" {`);
    lines.push(`    id: "${reqId}"`);
    lines.push(`    text: "${text}"`);
    lines.push(`    risk: ${risk}`);
    lines.push(`    verifymethod: ${verifyMethod}`);
    lines.push('  }');
  }

  const normElements: RequirementElementData[] = [];
  for (let i = 0; i < data.elements.length; i++) {
    const el = data.elements[i];
    const name = allocateUniqueDisplayName(el.name, usedNames, `Element ${i + 1}`);
    const type = sanitizeReqQuotedText(el.type, 'System');
    const docref = sanitizeReqQuotedText(el.docref, 'none');
    emittedNameById.set(el.id, name);
    normElements.push({ ...el, name, type, docref });

    lines.push(`  element "${name}" {`);
    lines.push(`    type: "${type}"`);
    lines.push(`    docref: "${docref}"`);
    lines.push('  }');
  }

  const normRelations: RequirementRelationData[] = [];
  for (const rel of data.relations) {
    if (rel.sourceId === rel.targetId) continue;
    const srcName = emittedNameById.get(rel.sourceId);
    const dstName = emittedNameById.get(rel.targetId);
    if (!srcName || !dstName) continue;
    const type: RequirementRelationType = RELATION_SET.has(rel.type)
      ? rel.type
      : 'satisfies';
    normRelations.push({ ...rel, type });
    lines.push(`  "${srcName}" - ${type} -> "${dstName}"`);
  }

  const guiState: RequirementDiagramData = {
    diagramType: 'requirement',
    title: trimmedTitle || undefined,
    direction: data.direction && DIRECTION_SET.has(data.direction) ? data.direction : undefined,
    requirements: normRequirements,
    elements: normElements,
    relations: normRelations,
    comments: safeComments.length > 0 ? safeComments : undefined,
  };
  lines.push(formatGuiStateLine(guiState));
  return lines.join('\n');
}

export function parseRequirementCodeToGuiData(code: string): RequirementDiagramData {
  const lines = code.split(/\r?\n/);
  const guiState = extractGuiStateJson<RequirementDiagramData>(
    lines,
    isRequirementGuiData
  );
  if (guiState) {
    return {
      diagramType: 'requirement',
      title: typeof guiState.title === 'string' && guiState.title.trim() ? guiState.title.trim() : undefined,
      direction:
        typeof guiState.direction === 'string' && DIRECTION_SET.has(guiState.direction)
          ? guiState.direction
          : undefined,
      requirements: guiState.requirements.map((req, idx) => ({
        id: String(req.id || `req_${idx + 1}`),
        name: sanitizeReqQuotedText(String(req.name ?? ''), `Req ${idx + 1}`),
        kind: KIND_SET.has(req.kind) ? req.kind : 'requirement',
        reqId: sanitizeReqQuotedText(String(req.reqId ?? ''), `REQ-${idx + 1}`),
        text: sanitizeReqQuotedText(String(req.text ?? ''), `Requirement ${idx + 1}`),
        risk: RISK_SET.has(req.risk) ? req.risk : 'low',
        verifyMethod: VERIFY_SET.has(req.verifyMethod) ? req.verifyMethod : 'analysis',
      })),
      elements: guiState.elements.map((el, idx) => ({
        id: String(el.id || `el_${idx + 1}`),
        name: sanitizeReqQuotedText(String(el.name ?? ''), `Element ${idx + 1}`),
        type: sanitizeReqQuotedText(String(el.type ?? ''), 'System'),
        docref: sanitizeReqQuotedText(String(el.docref ?? ''), 'none'),
      })),
      relations: guiState.relations
        .filter(
          (r) =>
            typeof r.sourceId === 'string' &&
            typeof r.targetId === 'string' &&
            r.sourceId !== r.targetId
        )
        .map((r, idx) => ({
          id: String(r.id || `rrel_${idx + 1}`),
          sourceId: r.sourceId,
          targetId: r.targetId,
          type: RELATION_SET.has(r.type) ? r.type : 'satisfies',
        })),
      comments: Array.isArray(guiState.comments)
        ? guiState.comments.filter((c): c is string => typeof c === 'string')
        : undefined,
    };
  }

  let title: string | undefined;
  let direction: RequirementDirection | undefined;
  const comments: string[] = [];
  const requirements: RequirementNodeData[] = [];
  const elements: RequirementElementData[] = [];
  const relations: RequirementRelationData[] = [];
  const usedIds = new Set<string>();
  const idByName = new Map<string, string>();

  let inFrontmatter = false;
  let blockMode: 'none' | 'req' | 'el' = 'none';
  let currentReq: RequirementNodeData | null = null;
  let currentEl: RequirementElementData | null = null;

  const ensureNodeId = (rawName: string): string => {
    const cleanName = sanitizeReqQuotedText(unquoteReqScalar(rawName), 'Element');
    const existing = idByName.get(cleanName);
    if (existing) return existing;
    const id = allocateUniqueId(`el_${elements.length + 1}`, usedIds);
    elements.push({ id, name: cleanName, type: 'System', docref: 'none' });
    idByName.set(cleanName, id);
    return id;
  };

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (i === 0 && trimmed === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (trimmed === '---') {
        inFrontmatter = false;
      } else {
        const tm = trimmed.match(/^title\s*:\s*(.+)$/i);
        if (tm) {
          title = unquoteYamlString(tm[1]);
        }
      }
      continue;
    }
    if (!trimmed) continue;
    if (trimmed.startsWith('%%')) {
      const c = sanitizeSingleLineComment(trimmed.slice(2));
      if (c && !c.startsWith('@gui-state:')) comments.push(c);
      continue;
    }
    if (/^requirementDiagram\b/i.test(trimmed) || /^requirement\s*$/i.test(trimmed)) {
      continue;
    }

    if (blockMode === 'req' && currentReq) {
      if (trimmed === '}') {
        requirements.push(currentReq);
        currentReq = null;
        blockMode = 'none';
        continue;
      }
      const idM = trimmed.match(/^id\s*:\s*(.+)$/i);
      if (idM) {
        currentReq.reqId = sanitizeReqQuotedText(unquoteReqScalar(idM[1]), currentReq.reqId);
        continue;
      }
      const textM = trimmed.match(/^text\s*:\s*(.+)$/i);
      if (textM) {
        currentReq.text = sanitizeReqQuotedText(unquoteReqScalar(textM[1]), currentReq.text);
        continue;
      }
      const riskM = trimmed.match(/^risk\s*:\s*(\w+)/i);
      if (riskM) {
        const cand = riskM[1].toLowerCase();
        if (RISK_SET.has(cand)) currentReq.risk = cand as RequirementRisk;
        continue;
      }
      const verM = trimmed.match(/^verifymethod\s*:\s*(\w+)/i);
      if (verM) {
        const cand = verM[1].toLowerCase();
        if (VERIFY_SET.has(cand)) currentReq.verifyMethod = cand as RequirementVerifyMethod;
        continue;
      }
      continue;
    }

    if (blockMode === 'el' && currentEl) {
      if (trimmed === '}') {
        elements.push(currentEl);
        currentEl = null;
        blockMode = 'none';
        continue;
      }
      const typeM = trimmed.match(/^type\s*:\s*(.+)$/i);
      if (typeM) {
        currentEl.type = sanitizeReqQuotedText(unquoteReqScalar(typeM[1]), currentEl.type);
        continue;
      }
      const docM = trimmed.match(/^docref\s*:\s*(.+)$/i);
      if (docM) {
        currentEl.docref = sanitizeReqQuotedText(unquoteReqScalar(docM[1]), currentEl.docref);
        continue;
      }
      continue;
    }

    const dirM = trimmed.match(/^direction\s+(TB|BT|LR|RL)\b/i);
    if (dirM) {
      direction = dirM[1].toUpperCase() as RequirementDirection;
      continue;
    }

    const reqStart = trimmed.match(
      /^(requirement|functionalRequirement|interfaceRequirement|performanceRequirement|physicalRequirement|designConstraint)\s+("(?:[^"]*)"|[^\s{]+)\s*(?::::\S+\s*)?\{$/i
    );
    if (reqStart) {
      const kindMatch = REQUIREMENT_KIND_OPTIONS.find(
        (k) => k.toLowerCase() === reqStart[1].toLowerCase()
      );
      const kind = kindMatch ?? 'requirement';
      const name = sanitizeReqQuotedText(
        unquoteReqScalar(reqStart[2]),
        `Req ${requirements.length + 1}`
      );
      const id = allocateUniqueId(`req_${requirements.length + 1}`, usedIds);
      idByName.set(name, id);
      currentReq = {
        id,
        name,
        kind,
        reqId: `REQ-${requirements.length + 1}`,
        text: name,
        risk: 'low',
        verifyMethod: 'analysis',
      };
      blockMode = 'req';
      continue;
    }

    const elStart = trimmed.match(
      /^element\s+("(?:[^"]*)"|[^\s{]+)\s*(?::::\S+\s*)?\{$/i
    );
    if (elStart) {
      const name = sanitizeReqQuotedText(
        unquoteReqScalar(elStart[1]),
        `Element ${elements.length + 1}`
      );
      const id = allocateUniqueId(`el_${elements.length + 1}`, usedIds);
      idByName.set(name, id);
      currentEl = { id, name, type: 'System', docref: 'none' };
      blockMode = 'el';
      continue;
    }

    const fwdRel = trimmed.match(
      /^("(?:[^"]+)"|[^\s<-]+)\s*-\s*(contains|copies|derives|satisfies|verifies|refines|traces)\s*->\s*("(?:[^"]+)"|[^\s-]+)$/i
    );
    if (fwdRel) {
      const srcId = ensureNodeId(fwdRel[1]);
      const dstId = ensureNodeId(fwdRel[3]);
      if (srcId !== dstId) {
        const relType = fwdRel[2].toLowerCase() as RequirementRelationType;
        relations.push({
          id: allocateUniqueId(`rrel_${relations.length + 1}`, usedIds),
          sourceId: srcId,
          targetId: dstId,
          type: RELATION_SET.has(relType) ? relType : 'satisfies',
        });
      }
      continue;
    }

    const revRel = trimmed.match(
      /^("(?:[^"]+)"|[^\s<-]+)\s*<-\s*(contains|copies|derives|satisfies|verifies|refines|traces)\s*-\s*("(?:[^"]+)"|[^\s-]+)$/i
    );
    if (revRel) {
      const targetId = ensureNodeId(revRel[1]);
      const sourceId = ensureNodeId(revRel[3]);
      if (sourceId !== targetId) {
        const relType = revRel[2].toLowerCase() as RequirementRelationType;
        relations.push({
          id: allocateUniqueId(`rrel_${relations.length + 1}`, usedIds),
          sourceId,
          targetId,
          type: RELATION_SET.has(relType) ? relType : 'satisfies',
        });
      }
    }
  }

  return {
    diagramType: 'requirement',
    title,
    direction,
    requirements,
    elements,
    relations,
    comments: comments.length > 0 ? comments : undefined,
  };
}
