import type {
  ClassDiagramData,
  ClassDiagramDirection,
  ClassMemberClassifier,
  ClassMemberData,
  ClassMemberVisibility,
  ClassNodeData,
  ClassNoteData,
  ClassRelationData,
  ClassRelationType,
} from '../../types/editor';
import { sanitizeCssColor } from '../inputSafeguard.ts';
import {
  GUI_STATE_PREFIX,
  extractGuiStateJson,
  unquoteYamlString,
} from '../mermaidEnvelope.ts';
import {
  RESERVED_CLASS_KEYWORDS,
  VALID_RELATION_TYPES,
  isValidClassData,
  normalizeClassData,
  sanitizeClassGeneric,
  sanitizeClassId,
  sanitizeClassMemberText,
  sanitizeClassQuotedText,
  sanitizeNamespace,
} from './shared.ts';

function parseClassMemberLine(
  rawLine: string,
  nextMemberId: () => string
): ClassMemberData | null {
  const trimmed = rawLine.trim();
  if (!trimmed || trimmed.startsWith('<<')) {
    return null;
  }

  let rest = trimmed;
  let visibility: ClassMemberVisibility = '';
  const firstCh = rest[0];
  if (firstCh === '+' || firstCh === '-' || firstCh === '#' || firstCh === '~') {
    visibility = firstCh;
    rest = rest.slice(1).trim();
  }

  const methodMatch = rest.match(/^([^\s(]+)\s*\(([^)]*)\)\s*([*$])?(?:\s+(.*))?$/);
  if (methodMatch) {
    const name = sanitizeClassMemberText(methodMatch[1]);
    const params = sanitizeClassMemberText(methodMatch[2]);
    const mod = methodMatch[3];
    const classifier: ClassMemberClassifier | undefined =
      mod === '$' ? 'static' : mod === '*' ? 'abstract' : undefined;
    const type = methodMatch[4] ? sanitizeClassMemberText(methodMatch[4]) : '';

    return {
      id: nextMemberId(),
      kind: 'method',
      visibility,
      name: name || 'method',
      ...(type ? { type } : {}),
      ...(params ? { params } : {}),
      ...(classifier ? { classifier } : {}),
    };
  }

  let classifier: ClassMemberClassifier | undefined;
  if (rest.endsWith('$')) {
    classifier = 'static';
    rest = rest.slice(0, -1).trim();
  } else if (rest.endsWith('*')) {
    classifier = 'abstract';
    rest = rest.slice(0, -1).trim();
  }

  const colonIdx = rest.indexOf(':');
  if (colonIdx > 0) {
    const name = sanitizeClassMemberText(rest.slice(0, colonIdx));
    const type = sanitizeClassMemberText(rest.slice(colonIdx + 1));
    return {
      id: nextMemberId(),
      kind: 'field',
      visibility,
      name: name || 'field',
      ...(type ? { type } : {}),
      ...(classifier ? { classifier } : {}),
    };
  }

  const tokens = rest.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    const name = sanitizeClassMemberText(tokens[tokens.length - 1]);
    const type = sanitizeClassMemberText(tokens.slice(0, -1).join(' '));
    return {
      id: nextMemberId(),
      kind: 'field',
      visibility,
      name: name || 'field',
      ...(type ? { type } : {}),
      ...(classifier ? { classifier } : {}),
    };
  }

  if (tokens.length === 1) {
    return {
      id: nextMemberId(),
      kind: 'field',
      visibility,
      name: sanitizeClassMemberText(tokens[0]) || 'field',
      ...(classifier ? { classifier } : {}),
    };
  }

  return null;
}

const RELATION_REVERSED_MAP: Record<string, ClassRelationType> = {
  '<|--': '--|>',
  '<|..': '..|>',
  '--*': '*--',
  '--o': 'o--',
  '<--': '-->',
  '<..': '..>',
};

const CLASS_RELATION_REGEX =
  /^([a-zA-Z0-9_-]+?)(?:~([^~]+)~)?\s*(?:"([^"]*)")?\s*(<\|--|--\|>|<\|\.\.|\.\.\|>|\*--|--\*|o--|--o|-->|<--|\.\.>|\<\.\.|--|\.\.)\s*(?:"([^"]*)")?\s*([a-zA-Z0-9_-]+)(?:~([^~]+)~)?(?:\s*:\s*(.*))?$/;

const CLASS_HEADER_REGEX =
  /^class\s+([a-zA-Z0-9_-]+)(?:~([^~]+)~)?(?:\["([^"]*)"\])?(?::::([a-zA-Z0-9_-]+))?\s*(\{)?\s*$/;

export function parseClassCodeToGuiData(code: string): ClassDiagramData {
  const lines = code.split(/\r?\n/);

  const restored = extractGuiStateJson(lines, isValidClassData);
  if (restored) {
    return normalizeClassData(restored);
  }

  let title = '';
  let direction: ClassDiagramDirection = 'TB';
  const classes: ClassNodeData[] = [];
  const classMap = new Map<string, ClassNodeData>();
  const relations: ClassRelationData[] = [];
  const notes: ClassNoteData[] = [];
  const comments: string[] = [];
  const classColors = new Map<string, string>();
  const nodeStyleClassMap = new Map<string, string>();

  let inFrontmatter = false;
  let seenHeader = false;
  let currentNamespace: string | null = null;
  let activeClass: ClassNodeData | null = null;
  let memberCounter = 1;
  let relCounter = 1;
  let noteCounter = 1;

  const nextMemberId = () => `m_${memberCounter++}`;

  const ensureClass = (rawId: string, generic?: string): ClassNodeData => {
    const safeId = sanitizeClassId(rawId);
    let existing = classMap.get(safeId);
    if (!existing) {
      existing = {
        id: safeId,
        ...(generic ? { generic: sanitizeClassGeneric(generic) } : {}),
        ...(currentNamespace ? { namespace: currentNamespace } : {}),
        members: [],
      };
      classes.push(existing);
      classMap.set(safeId, existing);
    } else {
      if (generic && !existing.generic) {
        existing.generic = sanitizeClassGeneric(generic);
      }
      if (currentNamespace && !existing.namespace) {
        existing.namespace = currentNamespace;
      }
    }
    return existing;
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
      if (/^classDiagram(?:-v2)?\b/i.test(trimmed)) {
        seenHeader = true;
      }
      continue;
    }

    if (activeClass) {
      if (trimmed === '}') {
        activeClass = null;
        continue;
      }
      const stereoMatch = trimmed.match(/^<<\s*([^>]+?)\s*>>$/);
      if (stereoMatch) {
        activeClass.stereotype = sanitizeClassQuotedText(stereoMatch[1]);
        continue;
      }
      const member = parseClassMemberLine(trimmed, nextMemberId);
      if (member) {
        activeClass.members.push(member);
      }
      continue;
    }

    if (trimmed === '}') {
      if (currentNamespace) {
        currentNamespace = null;
      }
      continue;
    }

    if (/^title\s+(.+)$/i.test(trimmed)) {
      const m = trimmed.match(/^title\s+(.+)$/i);
      if (m?.[1]) {
        title = unquoteYamlString(m[1]);
      }
      continue;
    }

    const dirMatch = trimmed.match(/^direction\s+(TB|BT|LR|RL)\b/i);
    if (dirMatch) {
      direction = dirMatch[1].toUpperCase() as ClassDiagramDirection;
      continue;
    }

    const nsMatch = trimmed.match(/^namespace\s+([a-zA-Z0-9_.-]+)\s*\{$/);
    if (nsMatch) {
      currentNamespace = sanitizeNamespace(nsMatch[1]) ?? null;
      continue;
    }

    const classDefMatch = trimmed.match(/^classDef\s+([a-zA-Z0-9_-]+)\s+(.+)$/i);
    if (classDefMatch) {
      const fillMatch = classDefMatch[2].match(/fill:\s*([^,\s]+)/i);
      const color = fillMatch ? sanitizeCssColor(fillMatch[1]) : undefined;
      if (color) {
        classColors.set(classDefMatch[1], color);
      }
      continue;
    }

    const cssClassMatch = trimmed.match(/^cssClass\s+"([^"]+)"\s+([a-zA-Z0-9_-]+)$/i);
    if (cssClassMatch) {
      for (const rawTarget of cssClassMatch[1].split(',')) {
        const cleanTarget = sanitizeClassId(rawTarget);
        if (cleanTarget) {
          nodeStyleClassMap.set(cleanTarget, cssClassMatch[2]);
        }
      }
      continue;
    }

    const noteForMatch = trimmed.match(/^note\s+for\s+([a-zA-Z0-9_-]+)\s+"([^"]*)"$/i);
    if (noteForMatch) {
      const cls = ensureClass(noteForMatch[1]);
      notes.push({
        id: `note_${noteCounter++}`,
        targetClassId: cls.id,
        text: sanitizeClassQuotedText(noteForMatch[2]),
      });
      continue;
    }

    const generalNoteMatch = trimmed.match(/^note\s+"([^"]*)"$/i);
    if (generalNoteMatch) {
      notes.push({
        id: `note_${noteCounter++}`,
        text: sanitizeClassQuotedText(generalNoteMatch[1]),
      });
      continue;
    }

    const classMatch = trimmed.match(CLASS_HEADER_REGEX);
    if (classMatch) {
      const cls = ensureClass(classMatch[1], classMatch[2]);
      if (classMatch[3] !== undefined) {
        cls.label = sanitizeClassQuotedText(classMatch[3]);
      }
      if (classMatch[4]) {
        nodeStyleClassMap.set(cls.id, classMatch[4]);
      }
      if (classMatch[5] === '{') {
        activeClass = cls;
      }
      continue;
    }

    const bareClsStyleMatch = trimmed.match(/^class\s+([a-zA-Z0-9_-]+)\s+([a-zA-Z0-9_-]+)$/);
    if (bareClsStyleMatch) {
      const cls = ensureClass(bareClsStyleMatch[1]);
      nodeStyleClassMap.set(cls.id, bareClsStyleMatch[2]);
      continue;
    }

    const relMatch = trimmed.match(CLASS_RELATION_REGEX);
    if (relMatch) {
      const clsA = ensureClass(relMatch[1], relMatch[2]);
      const cardA = relMatch[3] ? sanitizeClassQuotedText(relMatch[3]) : undefined;
      const op = relMatch[4];
      const cardB = relMatch[5] ? sanitizeClassQuotedText(relMatch[5]) : undefined;
      const clsB = ensureClass(relMatch[6], relMatch[7]);
      const label = relMatch[8] ? sanitizeClassMemberText(relMatch[8]) : undefined;

      const reversed = RELATION_REVERSED_MAP[op];
      if (reversed) {
        relations.push({
          id: `rel_${relCounter++}`,
          from: clsB.id,
          to: clsA.id,
          relationType: reversed,
          ...(cardB ? { fromCardinality: cardB } : {}),
          ...(cardA ? { toCardinality: cardA } : {}),
          ...(label ? { label } : {}),
        });
      } else {
        const relType: ClassRelationType = VALID_RELATION_TYPES.has(op as ClassRelationType)
          ? (op as ClassRelationType)
          : '-->';
        relations.push({
          id: `rel_${relCounter++}`,
          from: clsA.id,
          to: clsB.id,
          relationType: relType,
          ...(cardA ? { fromCardinality: cardA } : {}),
          ...(cardB ? { toCardinality: cardB } : {}),
          ...(label ? { label } : {}),
        });
      }
      continue;
    }

    // 単一行メンバー定義: User : +int id または User : <<interface>>
    const inlineMemberMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.+)$/);
    if (inlineMemberMatch && !RESERVED_CLASS_KEYWORDS.has(inlineMemberMatch[1].toLowerCase())) {
      const cls = ensureClass(inlineMemberMatch[1]);
      const rhs = inlineMemberMatch[2].trim();
      const stereoMatch = rhs.match(/^<<\s*([^>]+?)\s*>>$/);
      if (stereoMatch) {
        cls.stereotype = sanitizeClassQuotedText(stereoMatch[1]);
      } else {
        const member = parseClassMemberLine(rhs, nextMemberId);
        if (member) {
          cls.members.push(member);
        }
      }
    }
  }

  for (const cls of classes) {
    const styleName = nodeStyleClassMap.get(cls.id);
    if (styleName && classColors.has(styleName)) {
      cls.color = classColors.get(styleName);
    }
  }

  return normalizeClassData({
    diagramType: 'class',
    ...(title ? { title } : {}),
    direction,
    classes,
    relations,
    ...(notes.length > 0 ? { notes } : {}),
    ...(comments.length > 0 ? { comments } : {}),
  });
}
