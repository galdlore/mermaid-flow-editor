export interface EncryptedSecretEnvelope {
  version: 1;
  alg: 'PBKDF2-AES-GCM';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

const PBKDF2_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function getSubtleCrypto(): SubtleCrypto | null {
  if (typeof globalThis.crypto === 'undefined' || typeof globalThis.crypto.subtle === 'undefined') {
    return null;
  }
  return globalThis.crypto.subtle;
}

/** Web Crypto API (crypto.subtle) が利用可能かを判定する */
export function isWebCryptoAvailable(): boolean {
  return getSubtleCrypto() !== null;
}

function toExactUint8Array(source: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(new ArrayBuffer(source.byteLength));
  copy.set(source);
  return copy;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(base64, 'base64');
    return toExactUint8Array(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
  }
  const binary = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/** UTF-8文字列をBase64へ変換する（Basic認証ヘッダの非ASCII対応用） */
export function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return bytesToBase64(bytes);
}

async function deriveAesGcmKey(
  subtle: SubtleCrypto,
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
  usage: KeyUsage[]
): Promise<CryptoKey> {
  const passphraseBytes = toExactUint8Array(new TextEncoder().encode(passphrase));
  const baseKey = await subtle.importKey('raw', passphraseBytes, 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    usage
  );
}

/** パスフレーズで平文文字列を AES-256-GCM (PBKDF2-SHA256) 暗号化する */
export async function encryptSecretWithPassphrase(
  plaintext: string,
  passphrase: string
): Promise<EncryptedSecretEnvelope> {
  const subtle = getSubtleCrypto();
  if (!subtle) {
    throw new Error('Web Crypto API is unavailable in this environment.');
  }
  if (!passphrase) {
    throw new Error('Passphrase is required.');
  }

  const salt = globalThis.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(SALT_BYTES)));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(IV_BYTES)));
  const key = await deriveAesGcmKey(subtle, passphrase, salt, PBKDF2_ITERATIONS, ['encrypt']);
  const plainBytes = toExactUint8Array(new TextEncoder().encode(plaintext));
  const encryptedBuffer = await subtle.encrypt({ name: 'AES-GCM', iv }, key, plainBytes);

  return {
    version: 1,
    alg: 'PBKDF2-AES-GCM',
    iterations: PBKDF2_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encryptedBuffer)),
  };
}

/** パスフレーズで暗号化エンベロープを復号し平文を返す */
export async function decryptSecretWithPassphrase(
  envelope: EncryptedSecretEnvelope,
  passphrase: string
): Promise<string> {
  const subtle = getSubtleCrypto();
  if (!subtle) {
    throw new Error('Web Crypto API is unavailable in this environment.');
  }
  if (!passphrase) {
    throw new Error('Passphrase is required.');
  }
  if (
    envelope.version !== 1 ||
    envelope.alg !== 'PBKDF2-AES-GCM' ||
    !Number.isFinite(envelope.iterations) ||
    envelope.iterations < 10_000
  ) {
    throw new Error('Unsupported encrypted credential format.');
  }

  const salt = base64ToBytes(envelope.salt);
  const iv = base64ToBytes(envelope.iv);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  const key = await deriveAesGcmKey(subtle, passphrase, salt, envelope.iterations, ['decrypt']);
  const decryptedBuffer = await subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(decryptedBuffer);
}

/** JSON文字列から暗号化エンベロープを安全に検証・パースする */
export function parseEncryptedEnvelope(raw: string | null): EncryptedSecretEnvelope | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<EncryptedSecretEnvelope>;
    if (
      parsed &&
      parsed.version === 1 &&
      parsed.alg === 'PBKDF2-AES-GCM' &&
      typeof parsed.iterations === 'number' &&
      Number.isFinite(parsed.iterations) &&
      parsed.iterations >= 10_000 &&
      typeof parsed.salt === 'string' &&
      parsed.salt.length > 0 &&
      typeof parsed.iv === 'string' &&
      parsed.iv.length > 0 &&
      typeof parsed.ciphertext === 'string' &&
      parsed.ciphertext.length > 0
    ) {
      return {
        version: 1,
        alg: 'PBKDF2-AES-GCM',
        iterations: parsed.iterations,
        salt: parsed.salt,
        iv: parsed.iv,
        ciphertext: parsed.ciphertext,
      };
    }
    return null;
  } catch {
    return null;
  }
}
