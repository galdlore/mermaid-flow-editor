import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FORBIDDEN_LABEL_CHARS_REGEX,
  filterForbiddenChars,
  sanitizeCssColor,
  sanitizeSafeUrl,
} from './inputSafeguard.ts';

test('filterForbiddenChars removes disallowed characters and deduplicates blocked list', () => {
  const clean = filterForbiddenChars('通常ラベル_OK', FORBIDDEN_LABEL_CHARS_REGEX);
  assert.deepEqual(clean, { cleaned: '通常ラベル_OK', blockedChars: [] });

  const filtered = filterForbiddenChars('A("x")[y]("z")', FORBIDDEN_LABEL_CHARS_REGEX);
  assert.equal(filtered.cleaned, 'Axyz');
  assert.deepEqual(filtered.blockedChars, ['(', '"', ')', '[', ']']);
});

test('sanitizeSafeUrl permits http(s), single-slash paths, and hashes while blocking unsafe schemes and protocol-relative URLs', () => {
  assert.equal(sanitizeSafeUrl(' https://example.com/docs?a=1 '), 'https://example.com/docs?a=1');
  assert.equal(sanitizeSafeUrl('http://localhost:8080/app'), 'http://localhost:8080/app');
  assert.equal(sanitizeSafeUrl('/docs/guide.md'), '/docs/guide.md');
  assert.equal(sanitizeSafeUrl('#section-1'), '#section-1');

  assert.equal(sanitizeSafeUrl('//evil.example.com/payload'), undefined);
  assert.equal(sanitizeSafeUrl('javascript:alert(1)'), undefined);
  assert.equal(sanitizeSafeUrl('data:text/html,<script>'), undefined);
  assert.equal(sanitizeSafeUrl('vbscript:msgbox'), undefined);
  assert.equal(sanitizeSafeUrl('relative-without-slash'), undefined);
  assert.equal(sanitizeSafeUrl('   '), undefined);
});

test('sanitizeCssColor validates hex and named colors only', () => {
  assert.equal(sanitizeCssColor('#eff6ff'), '#eff6ff');
  assert.equal(sanitizeCssColor(' #123 '), '#123');
  assert.equal(sanitizeCssColor('cornflowerblue'), 'cornflowerblue');

  assert.equal(sanitizeCssColor('#zz1122'), undefined);
  assert.equal(sanitizeCssColor('red; background:url(x)'), undefined);
  assert.equal(sanitizeCssColor('rgb(0,0,0)'), undefined);
});
