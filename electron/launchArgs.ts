import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SUPPORTED_MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.txt']);

export interface ExtractLaunchFileOptions {
  isPackaged?: boolean;
  isDefaultApp?: boolean;
  workingDirectory?: string;
  platform?: NodeJS.Platform;
}

/** コマンドライン引数から対応拡張子のMarkdownファイルパスを抽出して正規化する */
export function extractMarkdownFilePathsFromArgv(
  argv: readonly string[],
  options?: ExtractLaunchFileOptions
): string[] {
  const startIndex = !options?.isPackaged && options?.isDefaultApp ? 2 : 1;
  const platform = options?.platform ?? process.platform;
  const results: string[] = [];
  const seen = new Set<string>();
  let afterDoubleDash = false;

  for (const rawArg of argv.slice(startIndex)) {
    if (typeof rawArg !== 'string') {
      continue;
    }
    let candidate = rawArg.trim();
    if (!candidate) {
      continue;
    }
    if (!afterDoubleDash && candidate === '--') {
      afterDoubleDash = true;
      continue;
    }
    if (!afterDoubleDash && candidate.startsWith('-')) {
      continue;
    }

    if (candidate.length >= 2 && candidate.startsWith('"') && candidate.endsWith('"')) {
      candidate = candidate.slice(1, -1).trim();
      if (!candidate) {
        continue;
      }
    }

    if (candidate.toLowerCase().startsWith('file://')) {
      try {
        candidate = fileURLToPath(candidate);
      } catch {
        continue;
      }
    }

    const ext = path.extname(candidate).toLowerCase();
    if (!SUPPORTED_MARKDOWN_EXTENSIONS.has(ext)) {
      continue;
    }

    const resolved = options?.workingDirectory
      ? path.resolve(options.workingDirectory, candidate)
      : path.resolve(candidate);
    const dedupeKey = platform === 'win32' ? resolved.toLowerCase() : resolved;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    results.push(resolved);
  }

  return results;
}
