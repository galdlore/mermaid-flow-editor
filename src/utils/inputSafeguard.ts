export const FORBIDDEN_LABEL_CHARS_REGEX = /["()[\]{}|<>\\;]/g;
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
