import type { RemoteRequestMethod } from '../types/editor.ts';
import {
  decryptSecretWithPassphrase,
  encodeBase64Utf8,
  encryptSecretWithPassphrase,
  parseEncryptedEnvelope,
} from './secretCrypto.ts';
import {
  isElectronEnv,
  readLocalStorage,
  removeLocalStorage,
  writeLocalStorage,
} from './storage.ts';

export type RemoteProtocol = 'webdav' | 'custom-http';
export type RemoteAuthType = 'none' | 'basic' | 'bearer';
export type RemoteCustomMethod = 'PUT' | 'POST';
export type RemotePayloadFormat = 'raw' | 'json';
export type SecretPersistenceMode = 'memory' | 'encrypted';

export interface RemoteSaveSettings {
  enabled: boolean;
  protocol: RemoteProtocol;
  endpointUrl: string;
  authType: RemoteAuthType;
  customMethod: RemoteCustomMethod;
  payloadFormat: RemotePayloadFormat;
  syncWithLocalSave: boolean;
  secretPersistence: SecretPersistenceMode;
}

export interface RemoteCredentials {
  username: string;
  password: string;
  bearerToken: string;
}

export interface RemoteRequestResult {
  ok: boolean;
  status: number;
  statusText: string;
  targetUrl: string;
  bodyText?: string;
  error?: string;
  isCorsOrNetworkError?: boolean;
  permissionDenied?: boolean;
}

export interface RemoteDirectoryEntry {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  size: number | null;
  lastModified: string | null;
}

export interface RemoteListResult extends RemoteRequestResult {
  folderSubPath: string;
  entries: RemoteDirectoryEntry[];
}

export interface RemoteReadResult extends RemoteRequestResult {
  remotePath: string;
  fileName: string;
  content?: string;
}

export type EndpointValidationError =
  | 'empty'
  | 'invalid-protocol'
  | 'relative-not-allowed'
  | 'invalid-url';

export const REMOTE_SETTINGS_STORAGE_KEY = 'mermaid-flow-editor:remote-settings-v1';
export const REMOTE_SECRET_STORAGE_KEY = 'mermaid-flow-editor:remote-secret-v1';

interface ChromePermissionsApi {
  contains: (details: { origins: string[] }) => Promise<boolean>;
  request: (details: { origins: string[] }) => Promise<boolean>;
}

export function createDefaultRemoteSettings(): RemoteSaveSettings {
  return {
    enabled: false,
    protocol: 'webdav',
    endpointUrl: '',
    authType: 'basic',
    customMethod: 'PUT',
    payloadFormat: 'raw',
    syncWithLocalSave: false,
    secretPersistence: 'memory',
  };
}

export function createEmptyRemoteCredentials(): RemoteCredentials {
  return {
    username: '',
    password: '',
    bearerToken: '',
  };
}

export function hasAnyCredentials(creds: RemoteCredentials, authType: RemoteAuthType): boolean {
  if (authType === 'none') {
    return true;
  }
  if (authType === 'bearer') {
    return creds.bearerToken.trim().length > 0;
  }
  return creds.username.trim().length > 0 || creds.password.length > 0;
}

/** localStorageからリモート保存の非機密設定を読み込む */
export function loadRemoteSettings(
  storageKey = REMOTE_SETTINGS_STORAGE_KEY
): RemoteSaveSettings {
  const defaults = createDefaultRemoteSettings();
  const raw = readLocalStorage(storageKey);
  if (!raw) {
    return defaults;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<RemoteSaveSettings>;
    return {
      enabled: Boolean(parsed.enabled),
      protocol: parsed.protocol === 'custom-http' ? 'custom-http' : 'webdav',
      endpointUrl: typeof parsed.endpointUrl === 'string' ? parsed.endpointUrl : '',
      authType:
        parsed.authType === 'none' || parsed.authType === 'bearer' ? parsed.authType : 'basic',
      customMethod: parsed.customMethod === 'POST' ? 'POST' : 'PUT',
      payloadFormat: parsed.payloadFormat === 'json' ? 'json' : 'raw',
      syncWithLocalSave: Boolean(parsed.syncWithLocalSave),
      secretPersistence: parsed.secretPersistence === 'encrypted' ? 'encrypted' : 'memory',
    };
  } catch {
    return defaults;
  }
}

/** localStorageへリモート保存の非機密設定を保存する（認証情報本体は含めない） */
export function saveRemoteSettings(
  settings: RemoteSaveSettings,
  storageKey = REMOTE_SETTINGS_STORAGE_KEY
): void {
  const sanitized: RemoteSaveSettings = {
    enabled: Boolean(settings.enabled),
    protocol: settings.protocol,
    endpointUrl: settings.endpointUrl.trim(),
    authType: settings.authType,
    customMethod: settings.customMethod,
    payloadFormat: settings.payloadFormat,
    syncWithLocalSave: Boolean(settings.syncWithLocalSave),
    secretPersistence: settings.secretPersistence,
  };
  writeLocalStorage(storageKey, JSON.stringify(sanitized));
}

/** localStorageに暗号化済み認証情報が保存されているかを返す */
export function hasEncryptedCredentials(storageKey = REMOTE_SECRET_STORAGE_KEY): boolean {
  return parseEncryptedEnvelope(readLocalStorage(storageKey)) !== null;
}

/** 認証情報をパスフレーズでAES-256-GCM暗号化してlocalStorageへ保存する */
export async function saveEncryptedCredentials(
  creds: RemoteCredentials,
  passphrase: string,
  storageKey = REMOTE_SECRET_STORAGE_KEY
): Promise<void> {
  const payload = JSON.stringify({
    username: creds.username,
    password: creds.password,
    bearerToken: creds.bearerToken,
  });
  const envelope = await encryptSecretWithPassphrase(payload, passphrase);
  writeLocalStorage(storageKey, JSON.stringify(envelope));
}

/** localStorageの暗号化済み認証情報をパスフレーズで復号する */
export async function unlockEncryptedCredentials(
  passphrase: string,
  storageKey = REMOTE_SECRET_STORAGE_KEY
): Promise<RemoteCredentials> {
  const envelope = parseEncryptedEnvelope(readLocalStorage(storageKey));
  if (!envelope) {
    throw new Error('Encrypted credentials not found.');
  }
  const plainJson = await decryptSecretWithPassphrase(envelope, passphrase);
  const parsed = JSON.parse(plainJson) as Partial<RemoteCredentials>;
  return {
    username: typeof parsed.username === 'string' ? parsed.username : '',
    password: typeof parsed.password === 'string' ? parsed.password : '',
    bearerToken: typeof parsed.bearerToken === 'string' ? parsed.bearerToken : '',
  };
}

/** 保存済みの暗号化認証情報を削除する */
export function clearEncryptedCredentials(storageKey = REMOTE_SECRET_STORAGE_KEY): void {
  removeLocalStorage(storageKey);
}

/** 保存先エンドポイントURLを検証する */
export function validateRemoteEndpointUrl(
  rawUrl: string,
  allowRelative: boolean
): EndpointValidationError | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return 'empty';
  }
  if (trimmed.startsWith('/')) {
    if (!allowRelative) {
      return 'relative-not-allowed';
    }
    if (trimmed.startsWith('//')) {
      return 'invalid-url';
    }
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return 'invalid-protocol';
    }
    return null;
  } catch {
    return 'invalid-url';
  }
}

/** リモートの相対パスを安全なPOSIX形式（..・先頭/末尾スラッシュなし）へ正規化する */
export function normalizeRemoteRelativePath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed) {
    return '';
  }
  if (/^[a-zA-Z]:/.test(trimmed) || trimmed.includes('\\')) {
    const parts = trimmed.split(/[\\/]/);
    const base = (parts[parts.length - 1] ?? '').trim();
    return base === '.' || base === '..' ? '' : base;
  }
  return trimmed
    .split('/')
    .map((seg) => seg.trim())
    .filter((seg) => seg !== '' && seg !== '.' && seg !== '..')
    .join('/');
}

/** リモート相対パスを親フォルダパスとファイル名に分割する */
export function splitRemoteRelativePath(rawPath: string): {
  folderSubPath: string;
  fileName: string;
} {
  const normalized = normalizeRemoteRelativePath(rawPath);
  if (!normalized) {
    return { folderSubPath: '', fileName: '' };
  }
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash < 0) {
    return { folderSubPath: '', fileName: normalized };
  }
  return {
    folderSubPath: normalized.slice(0, lastSlash),
    fileName: normalized.slice(lastSlash + 1),
  };
}

/** 現在のフォルダ相対パスと入力パスを結合して正規化する */
export function joinRemoteRelativePath(folderSubPath: string, childPath: string): string {
  const trimmed = childPath.trim();
  if (!trimmed) {
    return normalizeRemoteRelativePath(folderSubPath);
  }
  if (trimmed.startsWith('/')) {
    return normalizeRemoteRelativePath(trimmed);
  }
  const base = normalizeRemoteRelativePath(folderSubPath);
  const child = normalizeRemoteRelativePath(trimmed);
  if (!base) {
    return child;
  }
  if (!child) {
    return base;
  }
  return `${base}/${child}`;
}

function encodePathSegments(relativePath: string): string {
  if (!relativePath) {
    return '';
  }
  return relativePath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

/** ベースURLとフォルダ相対パスから末尾スラッシュ付きのWebDAVフォルダURLを組み立てる */
export function buildRemoteFolderUrl(endpointUrl: string, folderSubPath = ''): string {
  const cleanBase = endpointUrl.trim().replace(/\/+$/, '');
  const normSub = normalizeRemoteRelativePath(folderSubPath);
  if (!normSub) {
    return `${cleanBase}/`;
  }
  return `${cleanBase}/${encodePathSegments(normSub)}/`;
}

/** プロトコルとファイル名（またはサブフォルダ付き相対パス）から送信先URLを組み立てる */
export function buildRemoteTargetUrl(
  settings: Pick<RemoteSaveSettings, 'protocol' | 'endpointUrl'>,
  fileOrRelativePath: string
): string {
  const baseUrl = settings.endpointUrl.trim();
  const normalized = normalizeRemoteRelativePath(fileOrRelativePath) || 'document.md';

  if (baseUrl.includes('{filename}')) {
    const { fileName } = splitRemoteRelativePath(normalized);
    return baseUrl.replaceAll('{filename}', encodeURIComponent(fileName || 'document.md'));
  }

  if (settings.protocol === 'webdav') {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    return `${cleanBase}/${encodePathSegments(normalized)}`;
  }

  return baseUrl;
}

/** 認証種別に応じたAuthorizationヘッダを生成する */
export function buildAuthHeaders(
  authType: RemoteAuthType,
  creds: RemoteCredentials
): Record<string, string> {
  if (authType === 'basic') {
    const token = encodeBase64Utf8(`${creds.username}:${creds.password}`);
    return { Authorization: `Basic ${token}` };
  }
  if (authType === 'bearer' && creds.bearerToken.trim()) {
    return { Authorization: `Bearer ${creds.bearerToken.trim()}` };
  }
  return {};
}

function getChromePermissionsApi(): ChromePermissionsApi | null {
  const globalChrome = (globalThis as { chrome?: { permissions?: ChromePermissionsApi } }).chrome;
  if (
    globalChrome?.permissions &&
    typeof globalChrome.permissions.contains === 'function' &&
    typeof globalChrome.permissions.request === 'function'
  ) {
    return globalChrome.permissions;
  }
  return null;
}

/** Chrome拡張環境で外部オリジンへのアクセス権限を確認・要求する */
export async function ensureExtensionOriginPermission(targetUrl: string): Promise<boolean> {
  if (targetUrl.startsWith('/')) {
    return true;
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return false;
  }

  if (typeof window !== 'undefined' && window.location?.origin === parsed.origin) {
    return true;
  }

  const permissions = getChromePermissionsApi();
  if (!permissions) {
    return true;
  }

  const originPattern = `${parsed.origin}/*`;
  const alreadyGranted = await permissions.contains({ origins: [originPattern] });
  if (alreadyGranted) {
    return true;
  }
  return Boolean(await permissions.request({ origins: [originPattern] }));
}

const MAX_REMOTE_RESPONSE_BYTES = 10 * 1024 * 1024;

const PROPFIND_REQUEST_XML = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<d:propfind xmlns:d="DAV:">',
  '  <d:prop>',
  '    <d:resourcetype />',
  '    <d:getcontentlength />',
  '    <d:getlastmodified />',
  '  </d:prop>',
  '</d:propfind>',
].join('\n');

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _m;
    })
    .replace(/&#(\d+);/g, (_m, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _m;
    })
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function safeDecodeUriSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function extractNormalizedPathSegments(urlOrPath: string): string[] {
  const trimmed = urlOrPath.trim();
  if (!trimmed) {
    return [];
  }
  let pathname = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      pathname = new URL(trimmed).pathname;
    } catch {
      pathname = trimmed.replace(/^https?:\/\/[^/]+/i, '');
    }
  }
  const cleanPath = pathname.split(/[?#]/)[0] ?? '';
  return cleanPath
    .split('/')
    .filter((seg) => seg.length > 0)
    .map(safeDecodeUriSegment);
}

function extractXmlTagInner(fragment: string, localName: string): string | null {
  const regex = new RegExp(
    `<(?:[A-Za-z0-9_-]+:)?${localName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_-]+:)?${localName}>`,
    'i'
  );
  const match = fragment.match(regex);
  return match ? match[1] : null;
}

/** WebDAVのPROPFINDレスポンスXMLからフォルダおよびファイル一覧を抽出する */
export function parseWebdavPropfindXml(
  xmlText: string,
  requestFolderUrl: string,
  currentSubPath = ''
): RemoteDirectoryEntry[] {
  const requestSegments = extractNormalizedPathSegments(requestFolderUrl);
  const requestNormalized = requestSegments.join('/');
  const normSub = normalizeRemoteRelativePath(currentSubPath);

  const responseRegex =
    /<(?:[A-Za-z0-9_-]+:)?response(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?response>/gi;
  const propstatRegex =
    /<(?:[A-Za-z0-9_-]+:)?propstat(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?propstat>/gi;

  interface ParsedResponseItem {
    hrefSegments: string[];
    isDirectory: boolean;
    size: number | null;
    lastModified: string | null;
  }

  const rawItems: ParsedResponseItem[] = [];

  for (const responseMatch of xmlText.matchAll(responseRegex)) {
    const respBlock = responseMatch[1];
    const rawHrefInner = extractXmlTagInner(respBlock, 'href');
    if (!rawHrefInner) {
      continue;
    }
    const hrefText = decodeXmlEntities(rawHrefInner.trim());
    const hrefSegments = extractNormalizedPathSegments(hrefText);

    let okScope = respBlock;
    for (const propstatMatch of respBlock.matchAll(propstatRegex)) {
      const propstatBlock = propstatMatch[1];
      const statusInner = extractXmlTagInner(propstatBlock, 'status') ?? '';
      if (/\b200\b/.test(statusInner)) {
        okScope = propstatBlock;
        break;
      }
    }

    const resourceTypeInner = extractXmlTagInner(okScope, 'resourcetype') ?? '';
    const isDirectory = /<(?:[A-Za-z0-9_-]+:)?collection(?:\s[^>]*)?\/?>/i.test(
      resourceTypeInner
    );

    const lengthRaw =
      extractXmlTagInner(okScope, 'getcontentlength') ??
      extractXmlTagInner(respBlock, 'getcontentlength');
    const parsedSize =
      !isDirectory && lengthRaw !== null && /^\d+$/.test(lengthRaw.trim())
        ? Number.parseInt(lengthRaw.trim(), 10)
        : null;

    const lastModifiedRaw =
      extractXmlTagInner(okScope, 'getlastmodified') ??
      extractXmlTagInner(respBlock, 'getlastmodified');
    const lastModified = lastModifiedRaw ? decodeXmlEntities(lastModifiedRaw.trim()) || null : null;

    rawItems.push({
      hrefSegments,
      isDirectory,
      size: parsedSize,
      lastModified,
    });
  }

  let baseSegments = requestSegments;
  const hasExactRequestMatch = rawItems.some(
    (item) => item.hrefSegments.join('/') === requestNormalized
  );

  if (!hasExactRequestMatch && rawItems.length > 0) {
    const dirCandidates = rawItems
      .filter((item) => item.isDirectory)
      .sort((a, b) => a.hrefSegments.length - b.hrefSegments.length);
    const shortestDir = dirCandidates[0];
    if (
      shortestDir &&
      rawItems.every(
        (item) =>
          item.hrefSegments.length >= shortestDir.hrefSegments.length &&
          shortestDir.hrefSegments.every((seg, idx) => item.hrefSegments[idx] === seg)
      ) &&
      (rawItems.length >= 2 ||
        (shortestDir.hrefSegments.length > 0 &&
          requestSegments.length > 0 &&
          shortestDir.hrefSegments[shortestDir.hrefSegments.length - 1] ===
            requestSegments[requestSegments.length - 1]))
    ) {
      baseSegments = shortestDir.hrefSegments;
    }
  }

  const baseNormalized = baseSegments.join('/');
  const entries: RemoteDirectoryEntry[] = [];
  const seenKeys = new Set<string>();

  for (const item of rawItems) {
    if (item.hrefSegments.length === 0) {
      continue;
    }
    if (item.hrefSegments.join('/') === baseNormalized) {
      continue;
    }

    const isUnderBase =
      item.hrefSegments.length >= baseSegments.length &&
      baseSegments.every((seg, idx) => item.hrefSegments[idx] === seg);
    if (isUnderBase && item.hrefSegments.length !== baseSegments.length + 1) {
      continue;
    }

    const entryName = item.hrefSegments[item.hrefSegments.length - 1];
    if (!entryName || entryName === '.' || entryName === '..') {
      continue;
    }

    const relativePath = joinRemoteRelativePath(normSub, entryName);
    const dedupKey = `${item.isDirectory ? 'd' : 'f'}:${relativePath}`;
    if (seenKeys.has(dedupKey)) {
      continue;
    }
    seenKeys.add(dedupKey);

    entries.push({
      name: entryName,
      relativePath,
      isDirectory: item.isDirectory,
      size: item.size,
      lastModified: item.lastModified,
    });
  }

  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  return entries;
}

async function executeRemoteRequest(
  targetUrl: string,
  method: RemoteRequestMethod,
  headers: Record<string, string>,
  body?: string,
  readResponseBody = false
): Promise<RemoteRequestResult> {
  if (isElectronEnv() && window.electronAPI?.remoteRequest) {
    const res = await window.electronAPI.remoteRequest({
      url: targetUrl,
      method,
      headers,
      body,
      readResponseBody,
    });
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      targetUrl,
      bodyText: res.bodyText,
      error: res.error,
      isCorsOrNetworkError: !res.ok && res.status === 0,
    };
  }

  const permitted = await ensureExtensionOriginPermission(targetUrl);
  if (!permitted) {
    return {
      ok: false,
      status: 0,
      statusText: 'Permission Denied',
      targetUrl,
      permissionDenied: true,
      error: 'Host permission denied.',
    };
  }

  try {
    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
    });

    let bodyText: string | undefined;
    if (readResponseBody && response.ok) {
      const contentLength = Number(response.headers.get('content-length') ?? '0');
      if (Number.isFinite(contentLength) && contentLength > MAX_REMOTE_RESPONSE_BYTES) {
        return {
          ok: false,
          status: 413,
          statusText: 'Payload Too Large',
          targetUrl,
          error: 'File size exceeds 10MB limit.',
        };
      }
      const buf = await response.arrayBuffer();
      if (buf.byteLength > MAX_REMOTE_RESPONSE_BYTES) {
        return {
          ok: false,
          status: 413,
          statusText: 'Payload Too Large',
          targetUrl,
          error: 'File size exceeds 10MB limit.',
        };
      }
      bodyText = new TextDecoder('utf-8').decode(buf);
    }

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      targetUrl,
      bodyText,
      error: response.ok ? undefined : `HTTP ${response.status} ${response.statusText}`.trim(),
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      statusText: 'Network Error',
      targetUrl,
      isCorsOrNetworkError: true,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

/** Markdown本文をリモート保存先（WebDAV/OpenCloudまたはHTTP API）へアップロードする */
export async function saveMarkdownToRemote(
  settings: RemoteSaveSettings,
  creds: RemoteCredentials,
  fileOrRelativePath: string,
  content: string
): Promise<RemoteRequestResult> {
  const normPath = normalizeRemoteRelativePath(fileOrRelativePath) || 'document.md';
  const { fileName } = splitRemoteRelativePath(normPath);
  const safeName = fileName || 'document.md';
  const targetUrl = buildRemoteTargetUrl(settings, normPath);
  const authHeaders = buildAuthHeaders(settings.authType, creds);

  if (settings.protocol === 'webdav') {
    return executeRemoteRequest(
      targetUrl,
      'PUT',
      {
        ...authHeaders,
        'Content-Type': 'text/markdown; charset=utf-8',
      },
      content
    );
  }

  const isJson = settings.payloadFormat === 'json';
  const body = isJson ? JSON.stringify({ fileName: safeName, content }) : content;
  return executeRemoteRequest(
    targetUrl,
    settings.customMethod,
    {
      ...authHeaders,
      'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/markdown; charset=utf-8',
    },
    body
  );
}

/** WebDAVフォルダ配下のファイル・サブフォルダ一覧を取得する */
export async function listRemoteWebdavDirectory(
  settings: RemoteSaveSettings,
  creds: RemoteCredentials,
  folderSubPath = ''
): Promise<RemoteListResult> {
  const normSub = normalizeRemoteRelativePath(folderSubPath);
  const targetUrl = buildRemoteFolderUrl(settings.endpointUrl, normSub);
  const authHeaders = buildAuthHeaders(settings.authType, creds);

  const res = await executeRemoteRequest(
    targetUrl,
    'PROPFIND',
    {
      ...authHeaders,
      Depth: '1',
      'Content-Type': 'application/xml; charset=utf-8',
    },
    PROPFIND_REQUEST_XML,
    true
  );

  if (!res.ok) {
    return {
      ...res,
      folderSubPath: normSub,
      entries: [],
    };
  }

  return {
    ...res,
    folderSubPath: normSub,
    entries: parseWebdavPropfindXml(res.bodyText ?? '', targetUrl, normSub),
  };
}

/** 設定されたエンドポイントと同じオリジン（または同一オリジン相対パス）かを判定する */
export function isSameOriginAsEndpoint(
  targetUrl: string,
  endpointUrl: string,
  baseOrigin?: string
): boolean {
  const cleanTarget = targetUrl.trim();
  const cleanEndpoint = endpointUrl.trim();
  if (!cleanTarget || !cleanEndpoint) {
    return false;
  }
  if (cleanTarget.startsWith('//') || cleanEndpoint.startsWith('//')) {
    return false;
  }

  const effectiveBaseOrigin =
    baseOrigin ?? (typeof window !== 'undefined' ? window.location?.origin : undefined);

  if (cleanEndpoint.startsWith('/')) {
    if (cleanTarget.startsWith('/')) {
      return true;
    }
    try {
      const parsedTarget = new URL(cleanTarget);
      if (parsedTarget.protocol !== 'https:' && parsedTarget.protocol !== 'http:') {
        return false;
      }
      return Boolean(effectiveBaseOrigin) && parsedTarget.origin === effectiveBaseOrigin;
    } catch {
      return false;
    }
  }

  let parsedEndpoint: URL;
  try {
    parsedEndpoint = new URL(cleanEndpoint);
  } catch {
    return false;
  }
  if (parsedEndpoint.protocol !== 'https:' && parsedEndpoint.protocol !== 'http:') {
    return false;
  }

  if (cleanTarget.startsWith('/')) {
    return Boolean(effectiveBaseOrigin) && effectiveBaseOrigin === parsedEndpoint.origin;
  }

  try {
    const parsedTarget = new URL(cleanTarget);
    if (parsedTarget.protocol !== 'https:' && parsedTarget.protocol !== 'http:') {
      return false;
    }
    return parsedTarget.origin === parsedEndpoint.origin;
  } catch {
    return false;
  }
}

function stripUrlQueryAndHash(rawUrl: string): string {
  return (rawUrl.trim().split(/[?#]/)[0] ?? '').trim();
}

function extractFileNameFromCleanUrl(cleanUrl: string): string {
  const withoutTrailing = cleanUrl.replace(/\/+$/, '');
  const lastSlash = withoutTrailing.lastIndexOf('/');
  const rawSeg = lastSlash >= 0 ? withoutTrailing.slice(lastSlash + 1) : withoutTrailing;
  return (rawSeg ? safeDecodeUriSegment(rawSeg) : '') || 'document.md';
}

/** 設定されたエンドポイントと同一オリジンのWebDAVフルURLからMarkdown/テキストファイルを読み込む */
export async function loadMarkdownFromRemoteUrl(
  settings: RemoteSaveSettings,
  creds: RemoteCredentials,
  targetUrl: string,
  baseOrigin?: string
): Promise<RemoteReadResult> {
  const cleanUrl = stripUrlQueryAndHash(targetUrl);
  const fileName = extractFileNameFromCleanUrl(cleanUrl);
  if (!cleanUrl || !isSameOriginAsEndpoint(cleanUrl, settings.endpointUrl, baseOrigin)) {
    return {
      ok: false,
      status: 0,
      statusText: 'Forbidden',
      targetUrl: cleanUrl,
      remotePath: '',
      fileName,
      error: 'Target URL origin does not match configured cloud endpoint.',
    };
  }

  const authHeaders = buildAuthHeaders(settings.authType, creds);
  const res = await executeRemoteRequest(cleanUrl, 'GET', authHeaders, undefined, true);
  return {
    ...res,
    remotePath: '',
    fileName,
    content: res.ok ? (res.bodyText ?? '') : undefined,
  };
}

/** 設定されたエンドポイントと同一オリジンのWebDAVフルURLへMarkdownを書き込む */
export async function saveMarkdownToRemoteUrl(
  settings: RemoteSaveSettings,
  creds: RemoteCredentials,
  targetUrl: string,
  content: string,
  baseOrigin?: string
): Promise<RemoteRequestResult> {
  const cleanUrl = stripUrlQueryAndHash(targetUrl);
  if (!cleanUrl || !isSameOriginAsEndpoint(cleanUrl, settings.endpointUrl, baseOrigin)) {
    return {
      ok: false,
      status: 0,
      statusText: 'Forbidden',
      targetUrl: cleanUrl,
      error: 'Target URL origin does not match configured cloud endpoint.',
    };
  }

  const authHeaders = buildAuthHeaders(settings.authType, creds);
  return executeRemoteRequest(
    cleanUrl,
    'PUT',
    {
      ...authHeaders,
      'Content-Type': 'text/markdown; charset=utf-8',
    },
    content
  );
}

/** リモート保存先からMarkdown/テキストファイルを読み込む */
export async function loadMarkdownFromRemote(
  settings: RemoteSaveSettings,
  creds: RemoteCredentials,
  remotePath: string
): Promise<RemoteReadResult> {
  const normPath = normalizeRemoteRelativePath(remotePath);
  const { fileName } = splitRemoteRelativePath(normPath);
  const targetUrl = buildRemoteTargetUrl(settings, normPath);
  const authHeaders = buildAuthHeaders(settings.authType, creds);

  const res = await executeRemoteRequest(targetUrl, 'GET', authHeaders, undefined, true);
  return {
    ...res,
    remotePath: normPath,
    fileName: fileName || 'document.md',
    content: res.ok ? (res.bodyText ?? '') : undefined,
  };
}

/** WebDAVフォルダを作成する (MKCOL) */
export async function createRemoteWebdavFolder(
  settings: RemoteSaveSettings,
  creds: RemoteCredentials,
  folderSubPath: string
): Promise<RemoteRequestResult> {
  const normSub = normalizeRemoteRelativePath(folderSubPath);
  const targetUrl = buildRemoteFolderUrl(settings.endpointUrl, normSub);
  const authHeaders = buildAuthHeaders(settings.authType, creds);
  return executeRemoteRequest(targetUrl, 'MKCOL', authHeaders);
}

/** 設定されたエンドポイントへの接続と認証の疎通テストを実行する */
export async function testRemoteConnection(
  settings: RemoteSaveSettings,
  creds: RemoteCredentials
): Promise<RemoteRequestResult> {
  const baseClean = settings.endpointUrl.trim().replaceAll('{filename}', 'connection-test.md');
  const authHeaders = buildAuthHeaders(settings.authType, creds);

  if (settings.protocol === 'webdav') {
    const folderUrl = buildRemoteFolderUrl(baseClean, '');
    const propfindRes = await executeRemoteRequest(
      folderUrl,
      'PROPFIND',
      {
        ...authHeaders,
        Depth: '0',
        'Content-Type': 'application/xml; charset=utf-8',
      },
      PROPFIND_REQUEST_XML,
      false
    );
    if (propfindRes.status === 405) {
      return executeRemoteRequest(folderUrl, 'OPTIONS', authHeaders);
    }
    return propfindRes;
  }

  const optionsRes = await executeRemoteRequest(baseClean, 'OPTIONS', authHeaders);
  if (optionsRes.status === 405) {
    return executeRemoteRequest(baseClean, 'HEAD', authHeaders);
  }
  return optionsRes;
}
