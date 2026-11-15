export const FORBIDDEN_LABEL_CHARS_REGEX = /["()[\]{}|<>\\;]/g;
export const FORBIDDEN_GANTT_LABEL_CHARS_REGEX = /[:#;"()[\]{}|<>\\]/g;
export const FORBIDDEN_KANBAN_LABEL_CHARS_REGEX = /["'()[\]{}|<>\\;@]/g;
export const FORBIDDEN_KANBAN_META_CHARS_REGEX = /["'{}\\]/g;
export const FORBIDDEN_PIE_LABEL_CHARS_REGEX = /["\r\n]/g;
export const FORBIDDEN_XYCHART_TEXT_CHARS_REGEX = /["\r\n]/g;
export const FORBIDDEN_ARCHITECTURE_TITLE_CHARS_REGEX = /[\[\]\r\n"]/g;
export const FORBIDDEN_ARCHITECTURE_ICON_CHARS_REGEX = /[^a-zA-Z0-9_:-]/g;
export const FORBIDDEN_MINDMAP_LABEL_CHARS_REGEX = /[()[\]{}"`\r\n]/g;
export const FORBIDDEN_MINDMAP_ICON_CHARS_REGEX = /[)\r\n]/g;
export const FORBIDDEN_MINDMAP_CLASS_CHARS_REGEX = /[^a-zA-Z0-9_ -]/g;
export const FORBIDDEN_QUADRANT_TEXT_CHARS_REGEX = /["\r\n]/g;
export const FORBIDDEN_QUADRANT_CLASS_CHARS_REGEX = /[^a-zA-Z0-9]/g;
export const FORBIDDEN_SEQUENCE_TEXT_CHARS_REGEX = /[;\r\n]/g;
export const FORBIDDEN_SEQUENCE_ALIAS_CHARS_REGEX = /[:;\r\n]/g;
export const FORBIDDEN_SEQUENCE_ID_CHARS_REGEX = /[^a-zA-Z0-9_-]/g;
export const FORBIDDEN_ER_ENTITY_ID_CHARS_REGEX = /[^a-zA-Z0-9_-]/g;
export const FORBIDDEN_ER_QUOTED_TEXT_CHARS_REGEX = /["\r\n]/g;
export const FORBIDDEN_ER_ATTR_TYPE_CHARS_REGEX = /[\s"{};\r\n]/g;
export const FORBIDDEN_ER_ATTR_NAME_CHARS_REGEX = /[\s"{},;\r\n]/g;
export const FORBIDDEN_CLASS_ID_CHARS_REGEX = /[^a-zA-Z0-9_-]/g;
export const FORBIDDEN_CLASS_GENERIC_CHARS_REGEX = /[;{}\r\n~"`<>]/g;
export const FORBIDDEN_CLASS_QUOTED_TEXT_CHARS_REGEX = /["\r\n;]/g;
export const FORBIDDEN_CLASS_MEMBER_CHARS_REGEX = /[;{}\r\n]/g;
export const FORBIDDEN_STATE_ID_CHARS_REGEX = /[^a-zA-Z0-9_-]/g;
export const FORBIDDEN_STATE_LABEL_CHARS_REGEX = /["\r\n]/g;
export const FORBIDDEN_STATE_TEXT_CHARS_REGEX = /[;\r\n]/g;
export const FORBIDDEN_C4_ID_CHARS_REGEX = /[^a-zA-Z0-9_-]/g;
export const FORBIDDEN_C4_QUOTED_TEXT_CHARS_REGEX = /["\r\n]/g;
export const FORBIDDEN_C4_TITLE_CHARS_REGEX = /[#;\r\n]/g;
export const FORBIDDEN_URL_CHARS_REGEX = /["\s]/g;
export const FORBIDDEN_CLASS_NAME_CHARS_REGEX = /[^a-zA-Z0-9_-]/g;

export interface SafeguardFilterResult {
  cleaned: string;
  blockedChars: string[];
}

/**
 * 入力文字列から禁止文字を除去し、検出された禁止文字の一覧を返す。
 */
export function filterForbiddenChars(
  rawValue: string,
  forbiddenRegex: RegExp
): SafeguardFilterResult {
  const flags = forbiddenRegex.flags.includes('g')
    ? forbiddenRegex.flags
    : `${forbiddenRegex.flags}g`;
  const globalRegex = new RegExp(forbiddenRegex.source, flags);
  const matches = rawValue.match(globalRegex);

  if (!matches || matches.length === 0) {
    return { cleaned: rawValue, blockedChars: [] };
  }

  return {
    cleaned: rawValue.replace(globalRegex, ''),
    blockedChars: Array.from(new Set(matches)),
  };
}

/**
 * URLスキームをホワイトリスト検証し、安全な http(s) または相対パス・フラグメントのみ許可する。
 */
export function sanitizeSafeUrl(raw?: string): string | undefined {
  if (!raw) {
    return undefined;
  }
  const cleaned = raw.trim().replace(/["\s\r\n<>\\]/g, '');
  if (!cleaned) {
    return undefined;
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(cleaned)) {
    return /^https?:\/\//i.test(cleaned) ? cleaned : undefined;
  }

  if (cleaned.startsWith('/') || cleaned.startsWith('#')) {
    return cleaned;
  }

  return undefined;
}

/**
 * CSS色指定として安全な16進カラーコードまたは色名のみを許可する。
 */
export function sanitizeCssColor(raw?: string): string | undefined {
  if (!raw) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed) || /^[a-zA-Z]{3,20}$/.test(trimmed)) {
    return trimmed;
  }
  return undefined;
}
