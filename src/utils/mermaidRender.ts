import mermaid from 'mermaid';

let initialized = false;

/** Mermaidの初期化をアプリ全体で一度だけ行う */
export function ensureMermaidInitialized(): void {
  if (initialized) {
    return;
  }
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
  });
  initialized = true;
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
  ensureMermaidInitialized();

  try {
    const result = await mermaid.render(renderId, code);
    return { svg: result.svg, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Mermaidの描画に失敗しました。';
    return { svg: '', error: message };
  } finally {
    cleanupMermaidTempElements(renderId);
  }
}
