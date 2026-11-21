type MermaidApi = (typeof import('mermaid'))['default'];

let mermaidPromise: Promise<MermaidApi> | null = null;
const MAX_RENDER_CACHE_ENTRIES = 64;
const renderCache = new Map<string, { svg: string; error: string | null }>();

/** テストやリセット向けにMermaid描画キャッシュを消去する */
export function clearMermaidRenderCache(): void {
  renderCache.clear();
}

const DANGEROUS_SVG_TAGS = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'applet',
  'meta',
  'link',
]);

function isSafeSvgHref(rawHref: string): boolean {
  const trimmed = rawHref.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed.startsWith('#')) {
    return true;
  }
  return /^https?:\/\//i.test(trimmed);
}

/** 描画済みSVGからスクリプト要素・イベントハンドラ属性・危険なURLスキームを除去する */
export function sanitizeRenderedSvg(rawSvg: string): string {
  if (!rawSvg || typeof DOMParser === 'undefined') {
    return '';
  }

  const parser = new DOMParser();
  let doc = parser.parseFromString(rawSvg, 'image/svg+xml');
  let svgEl: Element | null = doc.querySelector('svg');

  if (doc.querySelector('parsererror') || !svgEl) {
    doc = parser.parseFromString(rawSvg, 'text/html');
    svgEl = doc.querySelector('svg');
  }

  if (!svgEl) {
    return '';
  }

  const allElements = [svgEl, ...Array.from(svgEl.querySelectorAll('*'))];
  for (const el of allElements) {
    const tagName = el.localName?.toLowerCase() ?? el.tagName.toLowerCase();
    if (DANGEROUS_SVG_TAGS.has(tagName)) {
      el.remove();
      continue;
    }

    for (const attr of Array.from(el.attributes)) {
      const attrName = attr.name.toLowerCase();
      if (attrName.startsWith('on')) {
        el.removeAttribute(attr.name);
        continue;
      }

      if (attrName === 'href' || attrName === 'xlink:href') {
        if (!isSafeSvgHref(attr.value)) {
          el.removeAttribute(attr.name);
        }
      }
    }
  }

  return svgEl.outerHTML || new XMLSerializer().serializeToString(svgEl);
}

/** Mermaidの遅延読み込みと初期化をアプリ全体で一度だけ行う */
export async function ensureMermaidInitialized(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid')
      .then((mod) => {
        const api = mod.default;
        api.initialize({
          startOnLoad: false,
          theme: 'default',
          securityLevel: 'strict',
        });
        return api;
      })
      .catch((err) => {
        mermaidPromise = null;
        throw err;
      });
  }
  return mermaidPromise;
}

/** 描画エラー時などにbody直下へ残る一時DOM要素を除去する */
function cleanupMermaidTempElements(renderId: string): void {
  const container = document.getElementById(`d${renderId}`);
  if (container && container.parentElement === document.body) {
    container.remove();
  }

  const svgElement = document.getElementById(renderId);
  if (svgElement && svgElement.parentElement === document.body) {
    svgElement.remove();
  }
}

/** Mermaid構文をSVG文字列へ変換し、失敗時はエラーメッセージとDOM掃除を行う */
export async function renderMermaidSvg(
  renderId: string,
  code: string
): Promise<{ svg: string; error: string | null }> {
  const cached = renderCache.get(code);
  if (cached) {
    renderCache.delete(code);
    renderCache.set(code, cached);
    return cached;
  }

  try {
    const mermaid = await ensureMermaidInitialized();
    const result = await mermaid.render(renderId, code);
    const sanitized = { svg: sanitizeRenderedSvg(result.svg), error: null };
    if (sanitized.svg) {
      if (renderCache.size >= MAX_RENDER_CACHE_ENTRIES) {
        const oldestKey = renderCache.keys().next().value;
        if (typeof oldestKey === 'string') {
          renderCache.delete(oldestKey);
        }
      }
      renderCache.set(code, sanitized);
    }
    return sanitized;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Mermaidの描画に失敗しました。';
    return { svg: '', error: message };
  } finally {
    cleanupMermaidTempElements(renderId);
  }
}
