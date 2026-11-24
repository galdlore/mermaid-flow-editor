import type {
  C4BoundaryData,
  C4BoundaryKind,
  C4DiagramData,
  C4DiagramSubtype,
  C4ElementData,
  C4ElementKind,
  C4ElementVariant,
  C4RelationData,
  C4RelationType,
} from '../../types/editor';
import { sanitizeCssColor } from '../inputSafeguard.ts';
import { allocateUniqueId, sanitizeSingleLineComment } from '../mermaidEnvelope.ts';
import {
  VALID_BOUNDARY_KINDS,
  VALID_ELEMENT_KINDS,
  VALID_ELEMENT_VARIANTS,
  VALID_RELATION_TYPES,
  VALID_SUBTYPES,
  clampGridCount,
  sanitizeC4Id,
  sanitizeC4QuotedText,
  sanitizeC4Title,
} from './defaults.ts';

export function isValidC4Data(val: unknown): val is C4DiagramData {
  if (!val || typeof val !== 'object') {
    return false;
  }
  const obj = val as Record<string, unknown>;
  if (obj.diagramType !== 'c4') {
    return false;
  }
  if (
    !Array.isArray(obj.elements) ||
    !Array.isArray(obj.boundaries) ||
    !Array.isArray(obj.relations)
  ) {
    return false;
  }
  const elementsOk = obj.elements.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      typeof (item as { id?: unknown }).id === 'string' &&
      typeof (item as { label?: unknown }).label === 'string'
  );
  const boundariesOk = obj.boundaries.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      typeof (item as { id?: unknown }).id === 'string' &&
      typeof (item as { label?: unknown }).label === 'string'
  );
  const relationsOk = obj.relations.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      typeof (item as { from?: unknown }).from === 'string' &&
      typeof (item as { to?: unknown }).to === 'string'
  );
  return elementsOk && boundariesOk && relationsOk;
}

export function normalizeC4Data(data: C4DiagramData): C4DiagramData {
  const subtype: C4DiagramSubtype = VALID_SUBTYPES.has(data.subtype)
    ? data.subtype
    : 'C4Context';

  const usedAliasIds = new Set<string>();
  const boundaryIdMap = new Map<string, string>();
  const normalizedBoundaries: C4BoundaryData[] = [];

  for (const b of data.boundaries) {
    const rawId = b.id.trim();
    const id = allocateUniqueId(sanitizeC4Id(rawId || 'boundary'), usedAliasIds);
    if (rawId && !boundaryIdMap.has(rawId)) {
      boundaryIdMap.set(rawId, id);
    }
    const kind: C4BoundaryKind = VALID_BOUNDARY_KINDS.has(b.kind)
      ? b.kind
      : 'system';
    const label = sanitizeC4QuotedText(b.label) || id;
    const boundaryType = b.boundaryType
      ? sanitizeC4QuotedText(b.boundaryType)
      : undefined;
    const descr = b.descr ? sanitizeC4QuotedText(b.descr) : undefined;
    const parentBoundaryId = b.parentBoundaryId?.trim() || undefined;

    normalizedBoundaries.push({
      id,
      kind,
      label,
      ...(boundaryType ? { boundaryType } : {}),
      ...(descr ? { descr } : {}),
      ...(parentBoundaryId ? { parentBoundaryId } : {}),
    });
  }

  // 親境界のIDを再マップし、存在しない親や自己・循環参照を断つ
  const validBoundaryIds = new Set(normalizedBoundaries.map((b) => b.id));
  const rawParentMap = new Map<string, string | undefined>();
  for (const b of normalizedBoundaries) {
    const mapped = b.parentBoundaryId
      ? boundaryIdMap.get(b.parentBoundaryId) ?? sanitizeC4Id(b.parentBoundaryId)
      : undefined;
    const safeParent =
      mapped && mapped !== b.id && validBoundaryIds.has(mapped)
        ? mapped
        : undefined;
    rawParentMap.set(b.id, safeParent);
  }

  for (const b of normalizedBoundaries) {
    let curr = rawParentMap.get(b.id);
    const seen = new Set<string>([b.id]);
    let hasCycle = false;
    while (curr) {
      if (seen.has(curr)) {
        hasCycle = true;
        break;
      }
      seen.add(curr);
      curr = rawParentMap.get(curr);
    }
    if (hasCycle) {
      rawParentMap.set(b.id, undefined);
      b.parentBoundaryId = undefined;
    } else {
      b.parentBoundaryId = rawParentMap.get(b.id);
    }
  }

  const elementIdMap = new Map<string, string>();
  const normalizedElements: C4ElementData[] = [];

  for (const el of data.elements) {
    const rawId = el.id.trim();
    const id = allocateUniqueId(sanitizeC4Id(rawId || 'element'), usedAliasIds);
    if (rawId && !elementIdMap.has(rawId)) {
      elementIdMap.set(rawId, id);
    }
    const kind: C4ElementKind = VALID_ELEMENT_KINDS.has(el.kind)
      ? el.kind
      : 'system';
    const variant: C4ElementVariant | undefined =
      kind !== 'person' && el.variant && VALID_ELEMENT_VARIANTS.has(el.variant)
        ? el.variant
        : undefined;
    const external = Boolean(el.external);
    const label = sanitizeC4QuotedText(el.label) || id;
    const techn =
      (kind === 'container' || kind === 'component') && el.techn
        ? sanitizeC4QuotedText(el.techn)
        : undefined;
    const descr = el.descr ? sanitizeC4QuotedText(el.descr) : undefined;
    const mappedBoundary = el.boundaryId
      ? boundaryIdMap.get(el.boundaryId.trim()) ?? sanitizeC4Id(el.boundaryId)
      : undefined;
    const boundaryId =
      mappedBoundary && validBoundaryIds.has(mappedBoundary)
        ? mappedBoundary
        : undefined;
    const bgColor = sanitizeCssColor(el.bgColor);
    const fontColor = sanitizeCssColor(el.fontColor);
    const borderColor = sanitizeCssColor(el.borderColor);

    normalizedElements.push({
      id,
      kind,
      ...(variant && variant !== 'standard' ? { variant } : {}),
      ...(external ? { external: true } : {}),
      label,
      ...(techn ? { techn } : {}),
      ...(descr ? { descr } : {}),
      ...(boundaryId ? { boundaryId } : {}),
      ...(bgColor ? { bgColor } : {}),
      ...(fontColor ? { fontColor } : {}),
      ...(borderColor ? { borderColor } : {}),
    });
  }

  const validElementIds = new Set(normalizedElements.map((e) => e.id));
  const usedRelIds = new Set<string>();
  const normalizedRelations: C4RelationData[] = [];

  for (const r of data.relations) {
    const from = elementIdMap.get(r.from.trim()) ?? sanitizeC4Id(r.from);
    const to = elementIdMap.get(r.to.trim()) ?? sanitizeC4Id(r.to);
    if (!validElementIds.has(from) || !validElementIds.has(to)) {
      continue;
    }
    const id = allocateUniqueId(
      sanitizeC4Id(r.id || 'rel'),
      usedRelIds
    );
    const relType: C4RelationType = VALID_RELATION_TYPES.has(r.relType)
      ? r.relType
      : 'Rel';
    const index =
      relType === 'RelIndex' && r.index
        ? sanitizeC4QuotedText(r.index)
        : undefined;
    const label = sanitizeC4QuotedText(r.label) || 'Uses';
    const techn = r.techn ? sanitizeC4QuotedText(r.techn) : undefined;
    const descr = r.descr ? sanitizeC4QuotedText(r.descr) : undefined;
    const lineColor = sanitizeCssColor(r.lineColor);
    const textColor = sanitizeCssColor(r.textColor);

    normalizedRelations.push({
      id,
      relType,
      ...(index ? { index } : {}),
      from,
      to,
      label,
      ...(techn ? { techn } : {}),
      ...(descr ? { descr } : {}),
      ...(lineColor ? { lineColor } : {}),
      ...(textColor ? { textColor } : {}),
    });
  }

  const title = data.title ? sanitizeC4Title(data.title) : undefined;
  const shapeInRow = clampGridCount(data.shapeInRow);
  const boundaryInRow = clampGridCount(data.boundaryInRow);
  const comments = (data.comments ?? [])
    .map(sanitizeSingleLineComment)
    .filter((line) => line.length > 0 && !/^@gui-state\s*:/i.test(line));

  return {
    diagramType: 'c4',
    subtype,
    ...(title ? { title } : {}),
    ...(shapeInRow ? { shapeInRow } : {}),
    ...(boundaryInRow ? { boundaryInRow } : {}),
    elements: normalizedElements,
    boundaries: normalizedBoundaries,
    relations: normalizedRelations,
    ...(comments.length > 0 ? { comments } : {}),
  };
}
