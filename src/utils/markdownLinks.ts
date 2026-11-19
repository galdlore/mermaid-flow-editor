import { isSupportedDroppedFileName } from './documentTabs.ts';
import {
  isSameOriginAsEndpoint,
  normalizeRemoteRelativePath,
  splitRemoteRelativePath,
  type RemoteSaveSettings,
} from './remoteStorage.ts';

export type MarkdownLinkTarget =
  | { kind: 'anchor'; hash: string }
  | { kind: 'remote-path'; remotePath: string; fragment?: string }
  | { kind: 'remote-url'; url: string; fileName: string; fragment?: string }
  | { kind: 'relative-file'; relativeHref: string; fileName: string; fragment?: string }
  | { kind: 'external'; url: string }
  | { kind: 'unsupported' };

export interface ClassifyMarkdownLinkOptions {
  remoteSettings?: Pick<RemoteSaveSettings, 'enabled' | 'protocol' | 'endpointUrl'>;
  currentRemotePath?: string | null;
  currentRemoteUrl?: string | null;
  currentLocalFilePath?: string | null;
  isElectron?: boolean;
  baseOrigin?: string;
  embedHostOrigin?: string | null;
}

const EXPLICIT_SCHEME_REGEX = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
const WINDOWS_DRIVE_REGEX = /^[a-zA-Z]:/;

function safeDecodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function extractHrefParts(rawHref: string): { pathWithoutQuery: string; fragment?: string } {
  const trimmed = rawHref.trim();
  const hashIndex = trimmed.indexOf('#');
  const beforeHash = hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed;
  const fragment = hashIndex >= 0 ? trimmed.slice(hashIndex) : undefined;
  const queryIndex = beforeHash.indexOf('?');
  const pathWithoutQuery = queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash;
  return { pathWithoutQuery, fragment };
}

function encodeLinkSpecialChar(ch: string): string {
  if (ch === '(') {
    return '%28';
  }
  if (ch === ')') {
    return '%29';
  }
  return encodeURIComponent(ch);
}

/** 対象のファイル名がアプリ内で開けるMarkdown/テキスト形式かを判定する */
export function isSupportedMarkdownLinkFileName(fileName: string): boolean {
  return isSupportedDroppedFileName(fileName);
}

/** 表示ラベル用のデフォルト名として末尾のMarkdown拡張子を取り除く */
export function stripMarkdownExtension(fileName: string): string {
  const trimmed = fileName.trim();
  const match = /\.(md|markdown|txt)$/i.exec(trimmed);
  if (match && trimmed.length > match[0].length) {
    return trimmed.slice(0, trimmed.length - match[0].length);
  }
  return trimmed;
}

/** WebDAVのパス文字列から /remote.php/dav/ と /dav/ を同一視した正規化セグメント配列を返す */
export function normalizeWebdavPathnameSegments(pathname: string): string[] {
  const { pathWithoutQuery } = extractHrefParts(pathname);
  const decoded = pathWithoutQuery
    .split('/')
    .filter((seg) => seg.length > 0)
    .map(safeDecodeSegment);

  if (
    decoded.length >= 2 &&
    decoded[0].toLowerCase() === 'remote.php' &&
    decoded[1].toLowerCase() === 'dav'
  ) {
    return decoded.slice(1);
  }
  return decoded;
}

/** クラウド保存先の現在ファイルパスを基準に、相対パスまたはSpaceルート基準パスを解決する */
export function resolveRelativeRemotePath(
  baseRemotePath: string | null | undefined,
  relativeHref: string
): string | null {
  const { pathWithoutQuery } = extractHrefParts(relativeHref);
  if (!pathWithoutQuery) {
    return null;
  }
  if (
    pathWithoutQuery.startsWith('//') ||
    pathWithoutQuery.startsWith('\\\\') ||
    WINDOWS_DRIVE_REGEX.test(pathWithoutQuery) ||
    EXPLICIT_SCHEME_REGEX.test(pathWithoutQuery)
  ) {
    return null;
  }

  const stack: string[] = pathWithoutQuery.startsWith('/')
    ? []
    : splitRemoteRelativePath(baseRemotePath || '')
        .folderSubPath.split('/')
        .filter(Boolean);

  for (const rawSegment of pathWithoutQuery.split('/')) {
    const decoded = safeDecodeSegment(rawSegment).trim();
    if (!decoded || decoded === '.') {
      continue;
    }
    if (decoded === '..') {
      if (stack.length > 0) {
        stack.pop();
      }
      continue;
    }
    if (decoded.includes('\0') || decoded.includes('/') || decoded.includes('\\')) {
      return null;
    }
    stack.push(decoded);
  }

  return stack.length > 0 ? stack.join('/') : null;
}

/** 別Space等のWebDAV URLを基準に、Spaceルートを越えない範囲で相対リンク先URLを解決する */
export function resolveRelativeRemoteUrl(
  baseRemoteUrl: string,
  relativeHref: string
): string | null {
  const { pathWithoutQuery } = extractHrefParts(relativeHref);
  if (!pathWithoutQuery) {
    return null;
  }
  if (
    pathWithoutQuery.startsWith('//') ||
    pathWithoutQuery.startsWith('\\\\') ||
    WINDOWS_DRIVE_REGEX.test(pathWithoutQuery) ||
    EXPLICIT_SCHEME_REGEX.test(pathWithoutQuery)
  ) {
    return null;
  }

  const cleanBase = baseRemoteUrl.trim();
  let originPrefix = '';
  let rawBasePathname = '';
  if (/^https?:\/\//i.test(cleanBase)) {
    try {
      const parsed = new URL(cleanBase);
      originPrefix = parsed.origin;
      rawBasePathname = parsed.pathname;
    } catch {
      return null;
    }
  } else if (cleanBase.startsWith('/') && !cleanBase.startsWith('//')) {
    rawBasePathname = extractHrefParts(cleanBase).pathWithoutQuery;
  } else {
    return null;
  }

  const rawBaseSegments = rawBasePathname.split('/').filter((seg) => seg.length > 0);
  const decodedBaseSegments = rawBaseSegments.map(safeDecodeSegment);
  const davIdx = decodedBaseSegments.findIndex((seg) => seg.toLowerCase() === 'dav');

  let prefixLen = 0;
  if (davIdx >= 0) {
    const nextSeg = decodedBaseSegments[davIdx + 1]?.toLowerCase();
    if ((nextSeg === 'spaces' || nextSeg === 'files') && rawBaseSegments.length > davIdx + 2) {
      prefixLen = davIdx + 3;
    } else {
      prefixLen = davIdx + 1;
    }
  }

  const prefixRawSegments = rawBaseSegments.slice(0, prefixLen);
  const dirSegmentsInsidePrefix =
    !rawBasePathname.endsWith('/') && decodedBaseSegments.length > prefixLen
      ? decodedBaseSegments.slice(prefixLen, -1)
      : decodedBaseSegments.slice(prefixLen);

  const stack: string[] = pathWithoutQuery.startsWith('/') ? [] : [...dirSegmentsInsidePrefix];

  for (const rawSegment of pathWithoutQuery.split('/')) {
    const decoded = safeDecodeSegment(rawSegment).trim();
    if (!decoded || decoded === '.') {
      continue;
    }
    if (decoded === '..') {
      if (stack.length > 0) {
        stack.pop();
      }
      continue;
    }
    if (decoded.includes('\0') || decoded.includes('/') || decoded.includes('\\')) {
      return null;
    }
    stack.push(decoded);
  }

  if (stack.length === 0) {
    return null;
  }

  const encodedPathSegments = [...prefixRawSegments, ...stack.map(encodeURIComponent)];
  return `${originPrefix}/${encodedPathSegments.join('/')}`;
}

/** 現在のクラウドファイルパスから対象クラウドファイルへの相対Markdownパスを計算する */
export function computeRelativeMarkdownPath(
  fromRemotePath: string | null | undefined,
  toRemotePath: string
): string {
  const targetNorm = normalizeRemoteRelativePath(toRemotePath);
  if (!targetNorm) {
    return '';
  }
  const fromDir = splitRemoteRelativePath(fromRemotePath || '').folderSubPath;
  const fromSegments = fromDir ? fromDir.split('/').filter(Boolean) : [];
  const toSegments = targetNorm.split('/').filter(Boolean);

  let commonCount = 0;
  const maxCommon = Math.min(fromSegments.length, Math.max(0, toSegments.length - 1));
  while (commonCount < maxCommon && fromSegments[commonCount] === toSegments[commonCount]) {
    commonCount += 1;
  }

  const upCount = fromSegments.length - commonCount;
  const remaining = toSegments.slice(commonCount);

  if (upCount === 0) {
    return `./${remaining.join('/')}`;
  }
  return `${'../'.repeat(upCount)}${remaining.join('/')}`;
}

/** Markdownリンクラベル内の角かっこや改行を安全な形式へエスケープする */
export function escapeMarkdownLinkLabel(label: string): string {
  return label
    .replace(/[\r\n]+/g, ' ')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

/** Markdownリンク先URL/パスをCommonMark互換のリンク先文字列へ整形する */
export function formatMarkdownLinkDestination(
  rawHref: string,
  isPreEncodedUrl = /^(?:https?:\/\/|\/(?:remote\.php\/)?dav\/)/i.test(rawHref.trim())
): string {
  const trimmed = rawHref.trim();
  if (!trimmed) {
    return '';
  }
  if (isPreEncodedUrl) {
    return trimmed.replace(/[\s()<>"]/g, encodeLinkSpecialChar);
  }
  return trimmed.replace(/[%#?[\]\\\s()<>"]/g, encodeLinkSpecialChar);
}

/** ラベルとリンク先からMarkdownのインラインリンク記法 [label](href) を生成する */
export function buildMarkdownLink(
  label: string,
  href: string,
  isPreEncodedUrl = /^(?:https?:\/\/|\/(?:remote\.php\/)?dav\/)/i.test(href.trim())
): string {
  const safeLabel = escapeMarkdownLinkLabel(label.trim() || href.trim());
  const safeHref = formatMarkdownLinkDestination(href, isPreEncodedUrl);
  return `[${safeLabel}](${safeHref})`;
}

function getEndpointPathname(endpointUrl: string): string {
  const clean = endpointUrl.trim();
  if (clean.startsWith('/')) {
    return extractHrefParts(clean).pathWithoutQuery;
  }
  try {
    return new URL(clean).pathname;
  } catch {
    return '';
  }
}

function tryMatchEndpointRemotePath(
  linkPathname: string,
  endpointUrl: string
): string | null {
  const endpointPathname = getEndpointPathname(endpointUrl);
  const endpointSegs = normalizeWebdavPathnameSegments(endpointPathname);
  const linkSegs = normalizeWebdavPathnameSegments(linkPathname);

  if (
    endpointSegs.length === 0 ||
    linkSegs.length <= endpointSegs.length ||
    !endpointSegs.every((seg, index) => linkSegs[index] === seg)
  ) {
    return null;
  }

  const remaining = linkSegs.slice(endpointSegs.length);
  const lastSeg = remaining[remaining.length - 1] ?? '';
  if (!isSupportedMarkdownLinkFileName(lastSeg)) {
    return null;
  }
  return remaining.join('/');
}

function tryExtractDavRemoteUrlTarget(
  pathname: string,
  targetUrl: string,
  fragment?: string
): MarkdownLinkTarget | null {
  const linkSegs = normalizeWebdavPathnameSegments(pathname);
  const lastSeg = linkSegs[linkSegs.length - 1] ?? '';
  if (
    linkSegs[0]?.toLowerCase() === 'dav' &&
    linkSegs.length >= 3 &&
    isSupportedMarkdownLinkFileName(lastSeg)
  ) {
    return {
      kind: 'remote-url',
      url: targetUrl,
      fileName: lastSeg,
      ...(fragment ? { fragment } : {}),
    };
  }
  return null;
}

/** Markdownリンクのクリック先を解析し、アプリ内で開く対象か外部リンクかを判定する */
export function classifyMarkdownLink(
  rawHref: string,
  options: ClassifyMarkdownLinkOptions = {}
): MarkdownLinkTarget {
  const trimmed = rawHref.trim();
  if (!trimmed) {
    return { kind: 'unsupported' };
  }
  if (trimmed.startsWith('#')) {
    return { kind: 'anchor', hash: trimmed };
  }
  if (trimmed.startsWith('//') || trimmed.startsWith('\\\\') || WINDOWS_DRIVE_REGEX.test(trimmed)) {
    return { kind: 'unsupported' };
  }

  const { pathWithoutQuery, fragment } = extractHrefParts(trimmed);
  const endpointUrl = options.remoteSettings?.endpointUrl?.trim() ?? '';
  const webdavEnabled = Boolean(
    options.remoteSettings?.enabled &&
      options.remoteSettings.protocol === 'webdav' &&
      endpointUrl.length > 0
  );

  if (EXPLICIT_SCHEME_REGEX.test(trimmed)) {
    if (!/^https?:\/\//i.test(trimmed)) {
      return { kind: 'unsupported' };
    }
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return { kind: 'unsupported' };
    }

    const cleanUrl = `${parsed.origin}${parsed.pathname}`;
    if (webdavEnabled && isSameOriginAsEndpoint(cleanUrl, endpointUrl, options.baseOrigin)) {
      const matchedRemotePath = tryMatchEndpointRemotePath(parsed.pathname, endpointUrl);
      if (matchedRemotePath) {
        return {
          kind: 'remote-path',
          remotePath: matchedRemotePath,
          ...(fragment ? { fragment } : {}),
        };
      }

      const davTarget = tryExtractDavRemoteUrlTarget(parsed.pathname, cleanUrl, fragment);
      if (davTarget) {
        return davTarget;
      }
    }

    if (options.embedHostOrigin && parsed.origin === options.embedHostOrigin) {
      const davTarget = tryExtractDavRemoteUrlTarget(parsed.pathname, cleanUrl, fragment);
      if (davTarget) {
        return davTarget;
      }
    }

    return { kind: 'external', url: trimmed };
  }

  if (pathWithoutQuery.startsWith('/')) {
    if (webdavEnabled) {
      const matchedRemotePath = tryMatchEndpointRemotePath(pathWithoutQuery, endpointUrl);
      if (matchedRemotePath) {
        return {
          kind: 'remote-path',
          remotePath: matchedRemotePath,
          ...(fragment ? { fragment } : {}),
        };
      }

      if (endpointUrl.startsWith('/')) {
        const davTarget = tryExtractDavRemoteUrlTarget(
          pathWithoutQuery,
          pathWithoutQuery,
          fragment
        );
        if (davTarget) {
          return davTarget;
        }
      }
    } else if (options.embedHostOrigin) {
      const davTarget = tryExtractDavRemoteUrlTarget(
        pathWithoutQuery,
        pathWithoutQuery,
        fragment
      );
      if (davTarget) {
        return davTarget;
      }
    }
  }

  const rawSegments = pathWithoutQuery.split('/');
  const lastRawSegment = rawSegments[rawSegments.length - 1] ?? '';
  const decodedFileName = safeDecodeSegment(lastRawSegment).trim();
  if (
    !decodedFileName ||
    decodedFileName === '.' ||
    decodedFileName === '..' ||
    !isSupportedMarkdownLinkFileName(decodedFileName)
  ) {
    return { kind: 'unsupported' };
  }

  if (options.isElectron && options.currentLocalFilePath && !pathWithoutQuery.startsWith('/')) {
    return {
      kind: 'relative-file',
      relativeHref: pathWithoutQuery,
      fileName: decodedFileName,
      ...(fragment ? { fragment } : {}),
    };
  }

  if (options.currentRemotePath) {
    const resolved = resolveRelativeRemotePath(options.currentRemotePath, pathWithoutQuery);
    if (resolved) {
      return {
        kind: 'remote-path',
        remotePath: resolved,
        ...(fragment ? { fragment } : {}),
      };
    }
  }

  if (options.currentRemoteUrl) {
    const resolvedUrl = resolveRelativeRemoteUrl(options.currentRemoteUrl, pathWithoutQuery);
    if (resolvedUrl) {
      return {
        kind: 'remote-url',
        url: resolvedUrl,
        fileName: decodedFileName,
        ...(fragment ? { fragment } : {}),
      };
    }
  }

  if (webdavEnabled) {
    const resolved = resolveRelativeRemotePath('', pathWithoutQuery);
    if (resolved) {
      return {
        kind: 'remote-path',
        remotePath: resolved,
        ...(fragment ? { fragment } : {}),
      };
    }
  }

  return {
    kind: 'relative-file',
    relativeHref: pathWithoutQuery,
    fileName: decodedFileName,
    ...(fragment ? { fragment } : {}),
  };
}
