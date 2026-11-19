import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptSecretWithPassphrase,
  encodeBase64Utf8,
  encryptSecretWithPassphrase,
  isWebCryptoAvailable,
  parseEncryptedEnvelope,
} from './secretCrypto.ts';

test('Web Crypto API is available and round-trips UTF-8 secrets with AES-256-GCM', async () => {
  assert.equal(isWebCryptoAvailable(), true);

  const secretPayload = JSON.stringify({
    username: 'user-日本語',
    password: 'app-token-パスワード-123!',
    bearerToken: '',
  });
  const passphrase = 'master-passphrase-鍵';

  const env1 = await encryptSecretWithPassphrase(secretPayload, passphrase);
  const env2 = await encryptSecretWithPassphrase(secretPayload, passphrase);

  assert.equal(env1.version, 1);
  assert.equal(env1.alg, 'PBKDF2-AES-GCM');
  assert.notEqual(env1.salt, env2.salt);
  assert.notEqual(env1.iv, env2.iv);
  assert.notEqual(env1.ciphertext, env2.ciphertext);

  const parsed = parseEncryptedEnvelope(JSON.stringify(env1));
  assert.ok(parsed);
  const decrypted = await decryptSecretWithPassphrase(parsed, passphrase);
  assert.equal(decrypted, secretPayload);

  await assert.rejects(() => decryptSecretWithPassphrase(parsed, 'wrong-passphrase'));
});

test('encodeBase64Utf8 encodes ASCII and Japanese strings properly', () => {
  const ascii = encodeBase64Utf8('alice:secret');
  assert.equal(Buffer.from(ascii, 'base64').toString('utf-8'), 'alice:secret');

  const utf8 = encodeBase64Utf8('ユーザー:秘密鍵');
  assert.equal(Buffer.from(utf8, 'base64').toString('utf-8'), 'ユーザー:秘密鍵');
});

test('parseEncryptedEnvelope rejects malformed inputs', () => {
  assert.equal(parseEncryptedEnvelope(null), null);
  assert.equal(parseEncryptedEnvelope('not-json'), null);
  assert.equal(parseEncryptedEnvelope(JSON.stringify({ version: 2 })), null);
  assert.equal(
    parseEncryptedEnvelope(
      JSON.stringify({
        version: 1,
        alg: 'PBKDF2-AES-GCM',
        iterations: 100,
        salt: 'a',
        iv: 'b',
        ciphertext: 'c',
      })
    ),
    null
  );
});
