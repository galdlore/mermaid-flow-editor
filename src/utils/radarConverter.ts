import type { Language } from '../locales/types.ts';
import type {
  RadarAxisData,
  RadarCurveData,
  RadarDiagramData,
  RadarGraticule,
} from '../types/editor.ts';
import {
  allocateUniqueId,
  extractGuiStateJson,
  formatGuiStateLine,
  sanitizeSingleLineComment,
} from './mermaidEnvelope.ts';

function sanitizeRadarText(raw: string, fallback: string): string {
  const cleaned = raw.replace(/["\\\r\n]/g, '').trim();
  return cleaned || fallback;
}

export function sanitizeRadarId(raw: string, fallback: string): string {
  const cleaned = raw
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .replace(/^[-]+|[-]+$/g, '');
  if (!cleaned) return fallback;
  return /^[\w]([-\w]*\w)?$/.test(cleaned) ? cleaned : fallback;
}

function clampNonNegative(num: unknown, fallback = 0): number {
  const v = typeof num === 'number' && Number.isFinite(num) ? num : Number(num);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.round(v * 100) / 100);
}

export function createDefaultRadarData(lang: Language = 'ja'): RadarDiagramData {
  if (lang === 'en') {
    return {
      diagramType: 'radar',
      title: 'Team Skill Evaluation',
      axes: [
        { id: 'design', label: 'Design' },
        { id: 'impl', label: 'Implementation' },
        { id: 'test', label: 'Testing' },
        { id: 'ops', label: 'Operations' },
        { id: 'docs', label: 'Documentation' },
      ],
      curves: [
        { id: 'teamA', label: 'Team Alpha', values: [85, 90, 75, 80, 70] },
        { id: 'teamB', label: 'Team Beta', values: [70, 78, 88, 72, 85] },
      ],
      showLegend: true,
      ticks: 5,
      min: 0,
      max: 100,
      graticule: 'polygon',
    };
  }
  return {
    diagramType: 'radar',
    title: 'チーム技術スキル評価',
    axes: [
      { id: 'design', label: '設計' },
      { id: 'impl', label: '実装' },
      { id: 'test', label: 'テスト' },
      { id: 'ops', label: '運用' },
      { id: 'docs', label: '文書化' },
    ],
    curves: [
      { id: 'teamA', label: 'チームA', values: [85, 90, 75, 80, 70] },
      { id: 'teamB', label: 'チームB', values: [70, 78, 88, 72, 85] },
    ],
    showLegend: true,
    ticks: 5,
    min: 0,
    max: 100,
    graticule: 'polygon',
  };
}

function isRadarGuiData(val: unknown): val is RadarDiagramData {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  return (
    obj.diagramType === 'radar' &&
    Array.isArray(obj.axes) &&
    Array.isArray(obj.curves)
  );
}

export function generateRadarCode(data: RadarDiagramData): string {
  const lines: string[] = ['radar-beta'];

  const safeComments = (data.comments ?? [])
    .map((c) => sanitizeSingleLineComment(c))
    .filter(Boolean);
  for (const comment of safeComments) {
    lines.push(`  %% ${comment}`);
  }

  const trimmedTitle = data.title ? sanitizeSingleLineComment(data.title) : '';
  if (trimmedTitle) {
    lines.push(`  title ${trimmedTitle}`);
  }

  const usedAxisIds = new Set<string>();
  const normAxes: RadarAxisData[] = data.axes.map((a, idx) => {
    const base = sanitizeRadarId(a.id, `axis${idx + 1}`);
    const id = allocateUniqueId(base, usedAxisIds);
    const label = sanitizeRadarText(a.label, id);
    return { id, label };
  });

  if (normAxes.length > 0) {
    const axisList = normAxes.map((a) => `${a.id}["${a.label}"]`).join(', ');
    lines.push(`  axis ${axisList}`);
  }

  const usedCurveIds = new Set<string>();
  const normCurves: RadarCurveData[] = data.curves.map((c, idx) => {
    const base = sanitizeRadarId(c.id, `curve${idx + 1}`);
    const id = allocateUniqueId(base, usedCurveIds);
    const label = sanitizeRadarText(c.label, id);
    const values = normAxes.map((_, aIdx) =>
      clampNonNegative(c.values[aIdx] ?? 0, 0)
    );
    return { id, label, values };
  });

  if (normAxes.length > 0) {
    for (const curve of normCurves) {
      lines.push(`  curve ${curve.id}["${curve.label}"]{${curve.values.join(', ')}}`);
    }
  }

  const showLegend = data.showLegend !== false;
  const ticks = Math.min(32, Math.max(1, Math.round(data.ticks || 5)));
  const minVal = clampNonNegative(data.min, 0);
  const maxVal =
    typeof data.max === 'number' && Number.isFinite(data.max) && data.max > minVal
      ? clampNonNegative(data.max, minVal + 1)
      : undefined;
  const graticule: RadarGraticule =
    data.graticule === 'polygon' ? 'polygon' : 'circle';

  lines.push(`  showLegend ${showLegend}`);
  lines.push(`  ticks ${ticks}`);
  lines.push(`  min ${minVal}`);
  if (maxVal !== undefined) {
    lines.push(`  max ${maxVal}`);
  }
  lines.push(`  graticule ${graticule}`);

  const guiState: RadarDiagramData = {
    diagramType: 'radar',
    title: trimmedTitle || undefined,
    axes: normAxes,
    curves: normCurves,
    showLegend,
    ticks,
    min: minVal,
    max: maxVal,
    graticule,
    comments: safeComments.length > 0 ? safeComments : undefined,
  };
  lines.push(formatGuiStateLine(guiState));
  return lines.join('\n');
}

export function parseRadarCodeToGuiData(code: string): RadarDiagramData {
  const lines = code.split(/\r?\n/);
  const guiState = extractGuiStateJson<RadarDiagramData>(lines, isRadarGuiData);
  if (guiState) {
    const axes = guiState.axes.map((a, idx) => {
      const id = sanitizeRadarId(String(a.id ?? ''), `axis${idx + 1}`);
      return {
        id,
        label: sanitizeRadarText(String(a.label ?? ''), id),
      };
    });
    const minVal = clampNonNegative(guiState.min, 0);
    const maxVal =
      typeof guiState.max === 'number' && Number.isFinite(guiState.max) && guiState.max > minVal
        ? clampNonNegative(guiState.max, minVal + 1)
        : undefined;
    return {
      diagramType: 'radar',
      title: typeof guiState.title === 'string' && guiState.title.trim() ? guiState.title.trim() : undefined,
      axes,
      curves: guiState.curves.map((c, idx) => {
        const id = sanitizeRadarId(String(c.id ?? ''), `curve${idx + 1}`);
        return {
          id,
          label: sanitizeRadarText(String(c.label ?? ''), id),
          values: axes.map((_, aIdx) => clampNonNegative(c.values?.[aIdx] ?? 0, 0)),
        };
      }),
      showLegend: guiState.showLegend !== false,
      ticks:
        typeof guiState.ticks === 'number' && Number.isFinite(guiState.ticks)
          ? Math.min(32, Math.max(1, Math.round(guiState.ticks)))
          : 5,
      min: minVal,
      max: maxVal,
      graticule: guiState.graticule === 'polygon' ? 'polygon' : 'circle',
      comments: Array.isArray(guiState.comments)
        ? guiState.comments.filter((c): c is string => typeof c === 'string')
        : undefined,
    };
  }

  let title: string | undefined;
  const comments: string[] = [];
  const axes: RadarAxisData[] = [];
  const rawCurves: Array<{ id: string; label: string; body: string }> = [];
  let showLegend = true;
  let ticks = 5;
  let minVal = 0;
  let maxVal: number | undefined;
  let graticule: RadarGraticule = 'circle';

  let inFrontmatter = false;
  let pendingCurve: { id: string; label: string; chunks: string[] } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (i === 0 && trimmed === '---') {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (trimmed === '---') inFrontmatter = false;
      continue;
    }

    if (pendingCurve) {
      const closeIdx = trimmed.indexOf('}');
      if (closeIdx >= 0) {
        pendingCurve.chunks.push(trimmed.slice(0, closeIdx));
        rawCurves.push({
          id: pendingCurve.id,
          label: pendingCurve.label,
          body: pendingCurve.chunks.join(','),
        });
        pendingCurve = null;
      } else {
        pendingCurve.chunks.push(trimmed);
      }
      continue;
    }

    if (!trimmed) continue;
    if (trimmed.startsWith('%%')) {
      const c = sanitizeSingleLineComment(trimmed.slice(2));
      if (c && !c.startsWith('@gui-state:')) comments.push(c);
      continue;
    }
    if (/^radar-beta\b:?/i.test(trimmed)) continue;

    const titleM = trimmed.match(/^title\s+(.+)$/i);
    if (titleM) {
      title = sanitizeSingleLineComment(titleM[1]);
      continue;
    }

    if (/^axis\s+/i.test(trimmed)) {
      const axisRest = trimmed.replace(/^axis\s+/i, '');
      const axisToken = /([\w-]+)(?:\s*\[\s*(?:"([^"]*)"|'([^']*)')\s*\])?/g;
      let am: RegExpExecArray | null;
      while ((am = axisToken.exec(axisRest)) !== null) {
        const id = sanitizeRadarId(am[1], `axis${axes.length + 1}`);
        const label = sanitizeRadarText(am[2] ?? am[3] ?? id, id);
        axes.push({ id, label });
      }
      continue;
    }

    const curveStart = trimmed.match(
      /^curve\s+([\w-]+)(?:\s*\[\s*(?:"([^"]*)"|'([^']*)')\s*\])?\s*\{(.*)$/i
    );
    if (curveStart) {
      const id = sanitizeRadarId(curveStart[1], `curve${rawCurves.length + 1}`);
      const label = sanitizeRadarText(curveStart[2] ?? curveStart[3] ?? id, id);
      const afterBrace = curveStart[4];
      const closeIdx = afterBrace.indexOf('}');
      if (closeIdx >= 0) {
        rawCurves.push({ id, label, body: afterBrace.slice(0, closeIdx) });
      } else {
        pendingCurve = { id, label, chunks: [afterBrace] };
      }
      continue;
    }

    const optTokens = trimmed.split(',');
    for (const opt of optTokens) {
      const t = opt.trim();
      const sl = t.match(/^showLegend\s+(true|false)/i);
      if (sl) showLegend = sl[1].toLowerCase() === 'true';
      const tk = t.match(/^ticks\s+(\d+)/i);
      if (tk) ticks = Math.min(32, Math.max(1, Number.parseInt(tk[1], 10)));
      const mn = t.match(/^min\s+([0-9]+(?:\.[0-9]+)?)/i);
      if (mn) minVal = clampNonNegative(Number.parseFloat(mn[1]), 0);
      const mx = t.match(/^max\s+([0-9]+(?:\.[0-9]+)?)/i);
      if (mx) maxVal = clampNonNegative(Number.parseFloat(mx[1]), 0);
      const gr = t.match(/^graticule\s+(circle|polygon)/i);
      if (gr) graticule = gr[1].toLowerCase() as RadarGraticule;
    }
  }

  const curves: RadarCurveData[] = rawCurves.map((rc) => {
    const entries = rc.body
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const hasKeyed = entries.some((e) => e.includes(':'));
    if (hasKeyed) {
      const valByAxis = new Map<string, number>();
      for (const entry of entries) {
        const kv = entry.match(/^([\w-]+)\s*:\s*([0-9]+(?:\.[0-9]+)?)$/);
        if (kv) {
          valByAxis.set(kv[1], clampNonNegative(Number.parseFloat(kv[2]), 0));
        }
      }
      return {
        id: rc.id,
        label: rc.label,
        values: axes.map((a) => valByAxis.get(a.id) ?? 0),
      };
    }
    const nums = entries.map((e) => clampNonNegative(Number.parseFloat(e), 0));
    return {
      id: rc.id,
      label: rc.label,
      values: axes.map((_, idx) => nums[idx] ?? 0),
    };
  });

  return {
    diagramType: 'radar',
    title,
    axes,
    curves,
    showLegend,
    ticks,
    min: minVal,
    max: maxVal !== undefined && maxVal > minVal ? maxVal : undefined,
    graticule,
    comments: comments.length > 0 ? comments : undefined,
  };
}
