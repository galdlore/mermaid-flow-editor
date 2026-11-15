export const GUI_STATE_PREFIX = '%% @gui-state:';

/**
 * Mermaidコード内の %% @gui-state: 行を検索し、型検証に合格したJSONオブジェクトを返す。
 */
export function extractGuiStateJson<T>(
  lines: ReadonlyArray<string>,
  validator: (val: unknown) => val is T
): T | null {
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(GUI_STATE_PREFIX)) {
      continue;
    }
    const jsonPart = trimmed.slice(GUI_STATE_PREFIX.length).trim();
    try {
      const parsed: unknown = JSON.parse(jsonPart);
      if (validator(parsed)) {
        return parsed;
      }
    } catch {
      // JSON解析失敗時は次の行またはテキストパーサーへフォールバックする
    }
  }
  return null;
}

/**
 * GUI状態をシリアライズした %% @gui-state: コメント行を生成する。
 */
export function formatGuiStateLine(data: unknown): string {
  return `${GUI_STATE_PREFIX} ${JSON.stringify(data)}`;
}

/**
 * 1行コメント文字列から改行を除去してトリムする。
 */
export function sanitizeSingleLineComment(raw: string): string {
  return raw.replace(/[\r\n]+/g, ' ').trim();
}

/**
 * YAMLのシングルクォート文字列向けに改行を除去し、シングルクォートをエスケープする。
 */
export function sanitizeYamlSingleQuoted(raw: string): string {
  return raw.replace(/\r?\n/g, ' ').replace(/'/g, "''").trim();
}

/**
 * YAMLやフロントマターのクォート付きスカラー文字列から外側のクォートを除去する。
 */
export function unquoteYamlString(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed;
}

/**
 * 使用済みID集合と重複しない一意なIDを割り当てて登録する。
 */
export function allocateUniqueId(baseId: string, usedIds: Set<string>): string {
  let uniqueId = baseId;
  let suffix = 2;
  while (usedIds.has(uniqueId)) {
    uniqueId = `${baseId}_${suffix++}`;
  }
  usedIds.add(uniqueId);
  return uniqueId;
}
