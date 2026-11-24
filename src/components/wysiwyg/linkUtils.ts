import type { MarkType } from '@milkdown/kit/prose/model';
import { TextSelection, type EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';

export interface LinkMarkRange {
  from: number;
  to: number;
  href: string;
  text: string;
}

export type LinkHrefValidationResult =
  | { ok: true; href: string }
  | { ok: false; reason: 'empty' | 'unsafe' };

const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/;
const URI_SCHEME_REGEX = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
const SAFE_EXTERNAL_SCHEME_REGEX = /^(?:https?|mailto):/i;
const PASTEABLE_URL_REGEX = /^(?:https?:\/\/[^\s<>]+|mailto:[^\s<>]+)$/i;

/**
 * Validates and trims a link href from user input or clipboard paste.
 * Allows http(s), mailto, hash fragments, and relative or root-relative Markdown paths.
 */
export function validateLinkHrefInput(rawHref: string): LinkHrefValidationResult {
  const trimmed = rawHref.trim();
  if (!trimmed) {
    return { ok: false, reason: 'empty' };
  }
  if (CONTROL_CHARS_REGEX.test(trimmed) || trimmed.startsWith('//')) {
    return { ok: false, reason: 'unsafe' };
  }
  if (URI_SCHEME_REGEX.test(trimmed) && !SAFE_EXTERNAL_SCHEME_REGEX.test(trimmed)) {
    return { ok: false, reason: 'unsafe' };
  }
  return { ok: true, href: trimmed };
}

/**
 * Extracts a safe single-line http(s) or mailto URL for paste-to-link conversion.
 */
export function extractPasteableUrl(rawText: string): string | null {
  const trimmed = rawText.trim();
  if (!PASTEABLE_URL_REGEX.test(trimmed)) {
    return null;
  }
  const validated = validateLinkHrefInput(trimmed);
  return validated.ok ? validated.href : null;
}

/**
 * Finds the full contiguous inline range sharing the same link href around `pos`.
 */
export function findLinkMarkRangeAtPos(
  state: EditorState,
  linkMarkType: MarkType,
  pos: number,
  includeBoundary = true
): LinkMarkRange | null {
  const clampedPos = Math.max(0, Math.min(pos, state.doc.content.size));
  const $pos = state.doc.resolve(clampedPos);
  const parent = $pos.parent;
  if (!parent.isTextblock) {
    return null;
  }

  const blockStart = $pos.start();
  const children: Array<{
    from: number;
    to: number;
    href: string | null;
  }> = [];

  let cursor = blockStart;
  for (let i = 0; i < parent.childCount; i += 1) {
    const child = parent.child(i);
    const childFrom = cursor;
    const childTo = cursor + child.nodeSize;
    cursor = childTo;
    const mark = child.isInline ? linkMarkType.isInSet(child.marks) : null;
    children.push({
      from: childFrom,
      to: childTo,
      href: mark && typeof mark.attrs?.href === 'string' ? mark.attrs.href : null,
    });
  }

  let matchIndex = children.findIndex(
    (entry) =>
      entry.href !== null && entry.from < clampedPos && clampedPos < entry.to
  );

  if (matchIndex < 0 && includeBoundary) {
    matchIndex = children.findIndex(
      (entry) =>
        entry.href !== null && entry.from <= clampedPos && clampedPos <= entry.to
    );
  }

  if (matchIndex < 0) {
    return null;
  }

  const targetHref = children[matchIndex].href;
  if (targetHref === null) {
    return null;
  }

  let startIdx = matchIndex;
  while (startIdx > 0 && children[startIdx - 1].href === targetHref) {
    startIdx -= 1;
  }
  let endIdx = matchIndex;
  while (
    endIdx + 1 < children.length &&
    children[endIdx + 1].href === targetHref
  ) {
    endIdx += 1;
  }

  const from = children[startIdx].from;
  const to = children[endIdx].to;
  return {
    from,
    to,
    href: targetHref,
    text: state.doc.textBetween(from, to, ''),
  };
}

/**
 * Resolves the link mark range overlapping or enclosing the current selection.
 */
export function findLinkMarkRangeInSelection(
  state: EditorState,
  linkMarkType: MarkType
): LinkMarkRange | null {
  const { selection } = state;
  if (selection.empty) {
    return findLinkMarkRangeAtPos(state, linkMarkType, selection.from, true);
  }

  const probeEnd =
    selection.from < selection.to
      ? Math.min(selection.to, selection.from + 1)
      : selection.from;

  return (
    findLinkMarkRangeAtPos(state, linkMarkType, selection.from, true) ??
    findLinkMarkRangeAtPos(state, linkMarkType, probeEnd, true) ??
    findLinkMarkRangeAtPos(state, linkMarkType, selection.to, true)
  );
}

/**
 * Resolves viewport-relative anchor coordinates just below an inline element or text pos.
 */
export function resolveAnchorCoords(
  view: EditorView,
  pos: number,
  mountEl: HTMLElement | null,
  anchorEl?: HTMLElement | null
): { anchorTop: number; anchorLeft: number } {
  if (anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0 || rect.top > 0 || rect.left > 0) {
      return {
        anchorTop: rect.bottom + 6,
        anchorLeft: rect.left,
      };
    }
  }

  try {
    const safePos = Math.max(0, Math.min(pos, view.state.doc.content.size));
    const coords = view.coordsAtPos(safePos);
    if (coords.bottom > 0 || coords.left > 0) {
      return {
        anchorTop: coords.bottom + 6,
        anchorLeft: coords.left,
      };
    }
  } catch {
    // フォールバック座標を使用する
  }

  const fallbackRect = mountEl?.getBoundingClientRect();
  return {
    anchorTop: (fallbackRect?.top ?? 80) + 28,
    anchorLeft: (fallbackRect?.left ?? 20) + 52,
  };
}

/**
 * Applies or updates a link mark and display label over a range while preserving other inline marks.
 */
export function applyLinkRangeUpdate(
  view: EditorView,
  linkMarkType: MarkType,
  range: { from: number; to: number },
  label: string,
  href: string
): void {
  const docSize = view.state.doc.content.size;
  const safeFrom = Math.max(0, Math.min(range.from, docSize));
  const safeTo = Math.max(safeFrom, Math.min(range.to, docSize));
  const finalLabel = label.trim() || href;

  const $from = view.state.doc.resolve(safeFrom);
  const existingMarks =
    $from.marksAcross(view.state.doc.resolve(Math.min(safeTo, docSize))) ??
    $from.marks();
  const preservedMarks = existingMarks.filter(
    (mark) => mark.type !== linkMarkType
  );
  const linkMark = linkMarkType.create({ href });
  const textNode = view.state.schema.text(finalLabel, [
    ...preservedMarks,
    linkMark,
  ]);

  const tr = view.state.tr.replaceWith(safeFrom, safeTo, textNode);
  const caretPos = Math.min(
    safeFrom + textNode.nodeSize,
    tr.doc.content.size
  );
  tr.setSelection(TextSelection.create(tr.doc, caretPos));
  tr.removeStoredMark(linkMarkType);
  view.dispatch(tr.scrollIntoView());
}

/**
 * Strips the link mark from a range while preserving its display text and formatting.
 */
export function removeLinkMarkInRange(
  view: EditorView,
  linkMarkType: MarkType,
  range: { from: number; to: number }
): void {
  const docSize = view.state.doc.content.size;
  const safeFrom = Math.max(0, Math.min(range.from, docSize));
  const safeTo = Math.max(safeFrom, Math.min(range.to, docSize));
  const tr = view.state.tr
    .removeMark(safeFrom, safeTo, linkMarkType)
    .removeStoredMark(linkMarkType);
  view.dispatch(tr);
}
