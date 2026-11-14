import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const CHROME_DIST_DIR = path.join(ROOT_DIR, 'dist-chrome');
const EXTENSION_OUT_DIR = path.join(ROOT_DIR, 'dist-extension');

function createCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC32_TABLE = createCrc32Table();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC32_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createPngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, 'ascii');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);

  const crcInput = Buffer.concat([typeBuffer, data]);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(crcInput), 0);

  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function generateIconPng(size: number): Buffer {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);

  const cornerRadius = Math.max(2, Math.round(size * 0.18));
  const boxPadding = Math.max(2, Math.round(size * 0.22));
  const midY = Math.floor(size / 2);

  for (let y = 0; y < size; y += 1) {
    const rowOffset = y * stride;
    raw[rowOffset] = 0;

    for (let x = 0; x < size; x += 1) {
      const px = rowOffset + 1 + x * 4;

      // 角丸の青背景 (#2563eb) と外側の透明領域
      const dx = Math.max(cornerRadius - x, 0, x - (size - 1 - cornerRadius));
      const dy = Math.max(cornerRadius - y, 0, y - (size - 1 - cornerRadius));
      const insideRoundedRect = dx * dx + dy * dy <= cornerRadius * cornerRadius;

      if (!insideRoundedRect) {
        raw[px] = 0;
        raw[px + 1] = 0;
        raw[px + 2] = 0;
        raw[px + 3] = 0;
        continue;
      }

      // 中央に白いフローノード風の2ブロックと接続線を配置する
      const inLeftNode =
        x >= boxPadding &&
        x <= Math.floor(size * 0.44) &&
        y >= boxPadding &&
        y <= Math.floor(size * 0.45);
      const inRightNode =
        x >= Math.ceil(size * 0.56) &&
        x <= size - 1 - boxPadding &&
        y >= Math.ceil(size * 0.55) &&
        y <= size - 1 - boxPadding;
      const inConnector =
        Math.abs(y - midY) <= Math.max(0, Math.floor(size * 0.04)) &&
        x >= Math.floor(size * 0.34) &&
        x <= Math.ceil(size * 0.66);

      if (inLeftNode || inRightNode || inConnector) {
        raw[px] = 255;
        raw[px + 1] = 255;
        raw[px + 2] = 255;
        raw[px + 3] = 255;
      } else {
        raw[px] = 37;
        raw[px + 1] = 99;
        raw[px + 2] = 235;
        raw[px + 3] = 255;
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = createPngChunk('IHDR', ihdr);
  const idatChunk = createPngChunk('IDAT', deflateSync(raw));
  const iendChunk = createPngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function buildExtension(): void {
  if (!existsSync(DIST_DIR)) {
    throw new Error('distディレクトリが見つかりません。先にvite buildを実行してください。');
  }

  const backgroundJsPath = path.join(CHROME_DIST_DIR, 'background.js');
  if (!existsSync(backgroundJsPath)) {
    throw new Error('dist-chrome/background.jsが見つかりません。先にcompile:chromeを実行してください。');
  }

  if (existsSync(EXTENSION_OUT_DIR)) {
    rmSync(EXTENSION_OUT_DIR, { recursive: true, force: true });
  }

  cpSync(DIST_DIR, EXTENSION_OUT_DIR, { recursive: true });
  cpSync(backgroundJsPath, path.join(EXTENSION_OUT_DIR, 'background.js'));

  const iconsDir = path.join(EXTENSION_OUT_DIR, 'icons');
  mkdirSync(iconsDir, { recursive: true });

  for (const size of [16, 48, 128]) {
    writeFileSync(path.join(iconsDir, `icon${size}.png`), generateIconPng(size));
  }

  const locales: Record<'ja' | 'en', Record<string, { message: string }>> = {
    ja: {
      extName: { message: 'Mermaid Flow Editor' },
      extDescription: { message: 'MarkdownとMermaid図をGUIで作成・編集できるエディタ' },
      actionTitle: { message: 'Mermaid Flow Editor を開く' },
    },
    en: {
      extName: { message: 'Mermaid Flow Editor' },
      extDescription: {
        message: 'A visual Markdown editor with a GUI builder for Mermaid flowcharts',
      },
      actionTitle: { message: 'Open Mermaid Flow Editor' },
    },
  };

  for (const [locale, messages] of Object.entries(locales)) {
    const localeDir = path.join(EXTENSION_OUT_DIR, '_locales', locale);
    mkdirSync(localeDir, { recursive: true });
    writeFileSync(
      path.join(localeDir, 'messages.json'),
      `${JSON.stringify(messages, null, 2)}\n`,
      'utf-8'
    );
  }

  const manifest = {
    manifest_version: 3,
    name: '__MSG_extName__',
    version: '0.1.0',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    action: {
      default_title: '__MSG_actionTitle__',
      default_icon: {
        '16': 'icons/icon16.png',
        '48': 'icons/icon48.png',
        '128': 'icons/icon128.png',
      },
    },
    icons: {
      '16': 'icons/icon16.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
    background: {
      service_worker: 'background.js',
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self';",
    },
  };

  writeFileSync(
    path.join(EXTENSION_OUT_DIR, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf-8'
  );

  console.log(`Chrome拡張機能パッケージを生成しました: ${EXTENSION_OUT_DIR}`);
}

buildExtension();
