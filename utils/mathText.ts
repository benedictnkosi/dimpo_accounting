/**
 * Math normalization ported from Next.js markdown-content.tsx.
 * Always normalize a COPY for display — never mutate stored answer/option strings used for grading.
 */

const RED_BLANK = String.raw`\textcolor{red}{?}`;

export type MathRenderMode = 'inline' | 'rich' | 'expression';

export interface NormalizedMath {
  /** Content ready for KaTeX auto-render ($ / $$ delimiters). */
  katexSource: string;
  /** Plain-text fallback if KaTeX cannot render. */
  plainFallback: string;
  /** Whether KaTeX rendering is warranted. */
  needsKatex: boolean;
}

/**
 * True when the whole string is a short math expression like `x^2` or `a_n`
 * (no prose), so it can be safely wrapped for KaTeX.
 */
function isBareSuperscriptMath(text: string): boolean {
  return /^[A-Za-z0-9]+([\^_][A-Za-z0-9]+)+$/.test(text.trim());
}

/**
 * Practice-step blanks are stored as `[\ ?\ ]` or `\ ?\` inside a larger
 * expression. Turn them into a red ? before any delimiter normalization so we
 * don't treat the brackets as a whole math block.
 */
function highlightMathBlanks(text: string): string {
  return (
    text
      // [\ ?\ ], [ ? ], [\?]
      .replace(/\[\s*\\?\s*\?\s*\\?\s*\]/g, RED_BLANK)
      // \ ?\ (escaped spaces around ?)
      .replace(/\\ \?\\ ?/g, RED_BLANK)
  );
}

/** Strip already-delimited math so we can detect leftover bare LaTeX. */
function withoutDelimitedMath(text: string): string {
  return text.replace(/\$\$[\s\S]*?\$\$/g, '').replace(/\$[^$]*\$/g, '');
}

/**
 * True when the string is mostly natural-language prose. Whole-string `$...$`
 * wrapping would force KaTeX `white-space: nowrap` and clip question text.
 */
function isMostlyProse(text: string): boolean {
  const stripped = withoutDelimitedMath(text)
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[{}^_]/g, ' ');
  const words = stripped.split(/\s+/).filter((w) => /[A-Za-z]{2,}/.test(w));
  return words.length >= 3;
}

/**
 * Exam questions are often stored with leading indentation. Markdown treats
 * 4+ space indents as `<pre>` code blocks, which don't wrap and get clipped.
 */
export function dedentMarkdown(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, '');
  const lines = normalized.split('\n');
  const indents = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.match(/^[ \t]*/)?.[0].length ?? 0);
  const minIndent = indents.length > 0 ? Math.min(...indents) : 0;
  if (minIndent === 0) return normalized;
  return lines.map((line) => (line.trim().length === 0 ? '' : line.slice(minIndent))).join('\n');
}

function findBalancedBraceEnd(s: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return openIdx;
}

/** End index (exclusive) of `\cmd{...}{...}` starting at `i` (`s[i] === '\\'`). */
function consumeLatexCommand(s: string, i: number): number {
  let j = i + 1;
  while (j < s.length && /[a-zA-Z]/.test(s[j]!)) j++;
  if (s[j] === '*') j++;
  while (j < s.length && s[j] === '{') {
    j = findBalancedBraceEnd(s, j) + 1;
  }
  return j;
}

/** Geometry labels / short math identifiers (DC, ADC, x, n_1). */
function isMathIdentifier(word: string): boolean {
  return (
    /^[A-Z]{1,4}$/.test(word) ||
    /^[a-z]$/.test(word) ||
    /^[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9]+$/.test(word) ||
    /^[a-z]\d+$/.test(word)
  );
}

function tryConsumeMathAtomFromLeft(
  s: string,
  end: number
): { start: number; end: number } | null {
  if (end <= 0) return null;

  if (s[end - 1] === '}') {
    let depth = 0;
    for (let j = end - 1; j >= 0; j--) {
      if (s[j] === '}') depth++;
      else if (s[j] === '{') {
        depth--;
        if (depth === 0) return { start: j, end };
      }
    }
    return null;
  }

  if (/[=+\-*/<>^_|]/.test(s[end - 1]!)) {
    if (s[end - 1] === '|' && end >= 2 && s[end - 2] === '|') {
      return { start: end - 2, end };
    }
    return { start: end - 1, end };
  }

  if (/\d/.test(s[end - 1]!)) {
    let j = end - 1;
    while (j >= 0 && /\d/.test(s[j]!)) j--;
    return { start: j + 1, end };
  }

  if (/[A-Za-z]/.test(s[end - 1]!)) {
    let j = end - 1;
    while (j >= 0 && /[A-Za-z0-9]/.test(s[j]!)) j--;
    if (j >= 0 && s[j] === '_') {
      j--;
      while (j >= 0 && /[A-Za-z0-9]/.test(s[j]!)) j--;
    }
    const word = s.slice(j + 1, end);
    if (isMathIdentifier(word)) return { start: j + 1, end };
    return null;
  }

  return null;
}

function tryConsumeMathAtomFromRight(
  s: string,
  start: number
): { start: number; end: number } | null {
  if (start >= s.length) return null;

  if (s[start] === '\\') {
    const end = consumeLatexCommand(s, start);
    if (end > start + 1) return { start, end };
    return null;
  }

  if (s[start] === '{') {
    return { start, end: findBalancedBraceEnd(s, start) + 1 };
  }

  if (s[start] === '|' && s[start + 1] === '|') {
    return { start, end: start + 2 };
  }

  if (/[=+\-*/<>^_|]/.test(s[start]!)) {
    return { start, end: start + 1 };
  }

  if (/\d/.test(s[start]!)) {
    let j = start;
    while (j < s.length && /\d/.test(s[j]!)) j++;
    return { start, end: j };
  }

  if (/[A-Za-z]/.test(s[start]!)) {
    let j = start;
    while (j < s.length && /[A-Za-z0-9]/.test(s[j]!)) j++;
    if (s[j] === '_') {
      j++;
      while (j < s.length && /[A-Za-z0-9]/.test(s[j]!)) j++;
    }
    const word = s.slice(start, j);
    if (isMathIdentifier(word)) return { start, end: j };
    return null;
  }

  return null;
}

function expandMathIsland(
  s: string,
  cmdStart: number,
  cmdEnd: number
): { start: number; end: number } {
  let start = cmdStart;
  let end = cmdEnd;

  while (true) {
    let j = start;
    while (j > 0 && s[j - 1] === ' ') j--;
    const atom = tryConsumeMathAtomFromLeft(s, j === start ? start : j);
    if (!atom) break;
    start = atom.start;
  }

  while (true) {
    let j = end;
    while (j < s.length && s[j] === ' ') j++;
    const atom = tryConsumeMathAtomFromRight(s, j === end ? end : j);
    if (!atom) break;
    end = atom.end;
  }

  return { start, end };
}

/**
 * Wrap bare LaTeX islands inside a prose segment with `$...$` so KaTeX
 * can render them without turning the whole sentence into a nowrap block.
 */
function wrapBareMathInSegment(segment: string): string {
  if (!/\\[a-zA-Z]+/.test(segment) && !/\|\|/.test(segment)) return segment;

  const islands: { start: number; end: number }[] = [];

  for (let i = 0; i < segment.length; i++) {
    if (segment[i] === '\\' && /[a-zA-Z]/.test(segment[i + 1] ?? '')) {
      const cmdEnd = consumeLatexCommand(segment, i);
      islands.push(expandMathIsland(segment, i, cmdEnd));
      i = cmdEnd - 1;
    }
  }

  // Geometry parallels stored as plain `FO || BD` (no LaTeX command).
  const parallelRe = /\b([A-Z]{1,4})\s*\|\|\s*([A-Z]{1,4})\b/g;
  let parallelMatch: RegExpExecArray | null;
  while ((parallelMatch = parallelRe.exec(segment)) !== null) {
    islands.push({
      start: parallelMatch.index,
      end: parallelMatch.index + parallelMatch[0].length,
    });
  }

  if (islands.length === 0) return segment;

  islands.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const island of islands) {
    const last = merged[merged.length - 1];
    if (last && island.start <= last.end + 1) {
      last.end = Math.max(last.end, island.end);
    } else {
      merged.push({ ...island });
    }
  }

  let out = '';
  let cursor = 0;
  for (const island of merged) {
    out += segment.slice(cursor, island.start);
    const body = segment
      .slice(island.start, island.end)
      .replace(/\|\|/g, '\\parallel')
      .trim();
    out += `$${body}$`;
    cursor = island.end;
  }
  out += segment.slice(cursor);
  return out;
}

/**
 * In prose (question/context), wrap each bare math island instead of the whole
 * string. Already-delimited `$...$` / `$$...$$` regions are left untouched.
 */
function wrapInlineBareMath(text: string): string {
  if (!/\\[a-zA-Z]+/.test(withoutDelimitedMath(text)) && !/\|\|/.test(text)) {
    return text;
  }

  const parts: string[] = [];
  const delimRe = /(\$\$[\s\S]*?\$\$|\$[^$]*\$)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = delimRe.exec(text)) !== null) {
    parts.push(wrapBareMathInSegment(text.slice(last, match.index)));
    parts.push(match[0]);
    last = match.index + match[0].length;
  }
  parts.push(wrapBareMathInSegment(text.slice(last)));
  return parts.join('');
}

/**
 * Practice steps store raw LaTeX without `$` delimiters (e.g.
 * `b = \frac{[\ ?\ ]}{x}`, `x^2`). AI explanations may wrap math in
 * `\[ ... \]`, `\( ... \)`, or bare `[ ... ]`. Normalize to `$`-delimited
 * math so KaTeX can render it.
 *
 * Ported verbatim from Next.js markdown-content.tsx.
 */
export function normalizeMath(text: string): string {
  let result = highlightMathBlanks(text)
    // \[ ... \] -> $$ ... $$ (display math)
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => `\n$$${m.trim()}$$\n`)
    // \( ... \) -> $ ... $ (inline math)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, m) => `$${m.trim()}$`)
    // bare [ ... ] that contains a LaTeX command (full formula, not a blank)
    .replace(/\[\s*([^[\]]*\\[^[\]]*?)\s*\]/g, (_, m) => `\n$$${m.trim()}$$\n`);

  const hasBareLatex = /\\[a-zA-Z]+/.test(withoutDelimitedMath(result));

  // Expression-only fields (options, practice steps): wrap the whole string.
  // Prose like "The period is given by ?" must NOT be whole-wrapped.
  if (hasBareLatex && !isMostlyProse(result)) {
    const unwrapped = result
      .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
      .replace(/\$([^$]*)\$/g, '$1');
    return `$${unwrapped.trim()}$`;
  }

  // Prose (question/context): wrap each math island so sentences still wrap.
  if (hasBareLatex || /\|\|/.test(result)) {
    result = wrapInlineBareMath(result);
  }

  // Bare superscript/subscript options like x^2.
  if (isBareSuperscriptMath(result)) {
    return `$${result.trim()}$`;
  }

  return result;
}

function toPlainFallback(input: string): string {
  return input
    .replace(/\\textcolor\{[^}]*\}\{([^}]*)\}/g, '$1')
    .replace(/\$\$/g, '')
    .replace(/\$/g, '')
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^{}]+)\}/g, '√($1)')
    .replace(/\\triangle/g, '△')
    .replace(/\\parallel/g, '∥')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\pi/g, 'π')
    .replace(/\\theta/g, 'θ')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\circ/g, '°')
    .replace(/\\degree/g, '°')
    .replace(/\\text\{([^{}]*)\}/g, '$1')
    .replace(/\\mathrm\{([^{}]*)\}/g, '$1')
    .replace(/\\mathbf\{([^{}]*)\}/g, '$1')
    .replace(/\\left/g, '')
    .replace(/\\right/g, '')
    .replace(/\\,/g, ' ')
    .replace(/\\;/g, ' ')
    .replace(/\\ /g, ' ')
    .replace(/\\([a-zA-Z]+)/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Full pipeline used by MathText. Returns KaTeX-ready source with $ / $$ delimiters.
 * `mode` only affects soft line-break handling for UI surfaces — wrapping rules
 * come from normalizeMath (same as Next.js).
 */
export function normalizeForKatex(input: string, mode: MathRenderMode = 'inline'): NormalizedMath {
  if (!input) {
    return { katexSource: '', plainFallback: '', needsKatex: false };
  }

  let text = normalizeMath(dedentMarkdown(input));

  // Inline / expression UI: collapse odd newlines into soft breaks (Next MathText).
  if (mode !== 'rich') {
    text = text.replace(/\n+/g, '  \n');
  } else {
    text = text.replace(/\n{3,}/g, '\n\n');
  }

  const needsKatex =
    /\$\$|\$[^$]|\\[a-zA-Z]+|\\textcolor/.test(text) || mode === 'expression';

  return {
    katexSource: text,
    plainFallback: toPlainFallback(text),
    needsKatex,
  };
}

/** @deprecated Prefer normalizeForKatex + MathText. Kept for plain fallbacks. */
export function normalizeMathContent(input: string): string {
  return normalizeForKatex(input, 'inline').plainFallback;
}
