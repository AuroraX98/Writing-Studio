(function (root, factory) {
  const textTools = typeof module === 'object' && module.exports ? require('./text-tools.js') : root.WritingTextTools;
  const api = factory(textTools);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WritingRevision = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (textTools) {
  'use strict';
  const MAX_MATCHES = 10000;
  const MAX_DIFF_CELLS = 250000;
  const MAX_DIFF_LINES = 50000;
  const MAX_DIFF_ROWS = 10000;
  const asText = value => String(value == null ? '' : value);
  const wordCharacter = character => !!character && /[\p{L}\p{M}\p{N}_]/u.test(character);
  function beforeCharacter(text, at) {
    if (!at) return '';
    let start = at - 1;
    if (start && /[\uDC00-\uDFFF]/.test(text[start]) && /[\uD800-\uDBFF]/.test(text[start - 1])) start--;
    return text.slice(start, at);
  }
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
    return value;
  }
  function formatFingerprint(chapter) {
    return JSON.stringify(canonical({ formats: chapter.formats || [], alignment: chapter.alignment || 'left', lineSpacing: chapter.lineSpacing || 1.7 }));
  }
  function optionsOf(options) {
    const result = { caseSensitive: !!(options && options.caseSensitive), wholeWord: !!(options && options.wholeWord), scope: options && options.scope || 'project' };
    if (!['project', 'chapter'].includes(result.scope)) throw new Error('Choose a chapter or the whole manuscript.');
    if (result.scope === 'chapter') result.chapterId = asText(options && options.chapterId);
    return result;
  }
  function preview(project, query, replacement, options) {
    query = asText(query); replacement = asText(replacement); options = optionsOf(options);
    if (!query.length) throw new Error('Enter some text to find.');
    const allChapters = project && Array.isArray(project.chapters) ? project.chapters : [];
    const selected = options.scope === 'chapter' ? allChapters.filter(chapter => chapter.id === options.chapterId) : allChapters;
    if (options.scope === 'chapter' && !selected.length) throw new Error('That chapter is no longer available.');
    const literal = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expression = new RegExp(literal, options.caseSensitive ? 'gu' : 'giu');
    let total = 0;
    const chapters = [];
    for (const chapter of selected) {
      const before = asText(chapter.text), matches = [];
      expression.lastIndex = 0;
      let match;
      while ((match = expression.exec(before))) {
        const start = match.index, end = start + match[0].length;
        if (options.wholeWord && (wordCharacter(beforeCharacter(before, start)) || wordCharacter(String.fromCodePoint(before.codePointAt(end) || 0)))) continue;
        if (++total > MAX_MATCHES) throw new Error('More than ' + MAX_MATCHES + ' matches. Narrow your search before replacing.');
        matches.push({ start, end, original: match[0], replacement });
      }
      if (!matches.length) continue;
      let position = 0;
      const pieces = [];
      for (const match of matches) { pieces.push(before.slice(position, match.start), replacement); position = match.end; }
      pieces.push(before.slice(position));
      chapters.push({ id: chapter.id, title: asText(chapter.title), before, after: pieces.join(''), matches, formatFingerprint: formatFingerprint(chapter) });
    }
    return { projectId: project && project.id, query, replacement, options, total, chapters };
  }
  // Project many replacements in one pass. Original runs supply exactly the
  // same whole-selection style inheritance as WritingTextTools.edit.
  function projectFormats(chapter, matches) {
    if (!textTools) throw new Error('Formatting tools are unavailable. Reload the app before replacing.');
    const runs = textTools.runs(asText(chapter.text), chapter.formats || []);
    const spans = [];
    let runIndex = 0, oldPosition = 0, newPosition = 0;
    function addSpan(length, bold, italic) {
      if (length && (bold || italic)) {
        const span = { start: newPosition, end: newPosition + length };
        if (bold) span.bold = true;
        if (italic) span.italic = true;
        const previous = spans[spans.length - 1];
        if (previous && previous.end === span.start && !!previous.bold === !!bold && !!previous.italic === !!italic) previous.end = span.end;
        else spans.push(span);
      }
      newPosition += length;
    }
    function advance(end, copying) {
      let bold = true, italic = true, touched = false;
      while (oldPosition < end) {
        const run = runs[runIndex];
        if (!run) break;
        const until = Math.min(end, run.end), length = until - oldPosition;
        if (copying) addSpan(length, run.bold, run.italic);
        else { bold = bold && run.bold; italic = italic && run.italic; touched = true; }
        oldPosition = until;
        if (oldPosition >= run.end) runIndex++;
      }
      return { bold: touched && bold, italic: touched && italic };
    }
    for (const match of matches) {
      advance(match.start, true);
      const inherited = advance(match.end, false);
      addSpan(match.replacement.length, inherited.bold, inherited.italic);
    }
    advance(asText(chapter.text).length, true);
    return spans;
  }
  function apply(project, candidate) {
    if (!candidate || candidate.projectId !== (project && project.id) || !Array.isArray(candidate.chapters)) throw new Error('This preview belongs to a different manuscript.');
    const current = preview(project, candidate.query, candidate.replacement, candidate.options);
    if (JSON.stringify(current) !== JSON.stringify(candidate)) throw new Error('The manuscript changed after this preview. Preview replacements again.');
    const chapters = [], changedChapterIds = [];
    let replacements = 0;
    for (const proposed of current.chapters) {
      if (proposed.after === proposed.before) continue;
      const original = project.chapters.find(chapter => chapter.id === proposed.id);
      chapters.push({ ...original, text: proposed.after, formats: projectFormats(original, proposed.matches) });
      changedChapterIds.push(proposed.id);
      replacements += proposed.matches.length;
    }
    return { changedChapterIds, replacements, chapters };
  }
  function linesOf(text) { return text.match(/[^\n]*\n|[^\n]+$/g) || []; }
  function diff(before, after) {
    before = asText(before); after = asText(after);
    if (before === after) return { rows: before ? [{ kind: 'same', text: before }] : [], approximate: false };
    const previous = linesOf(before), next = linesOf(after);
    if (previous.length + next.length > MAX_DIFF_LINES) return { rows: [{ kind: 'removed', text: before }, { kind: 'added', text: after }].filter(row => row.text), approximate: true };
    let prefix = 0, suffix = 0;
    while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) prefix++;
    while (suffix < previous.length - prefix && suffix < next.length - prefix && previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix++;
    const oldMiddle = previous.slice(prefix, previous.length - suffix), newMiddle = next.slice(prefix, next.length - suffix);
    const rows = [];
    for (let index = 0; index < prefix; index++) rows.push({ kind: 'same', text: previous[index] });
    const width = newMiddle.length + 1, height = oldMiddle.length + 1;
    let approximate = false;
    if (width * height > MAX_DIFF_CELLS) {
      approximate = true;
      if (oldMiddle.length) rows.push({ kind: 'removed', text: oldMiddle.join('') });
      if (newMiddle.length) rows.push({ kind: 'added', text: newMiddle.join('') });
    } else {
      const lengths = new Uint32Array(width * height);
      for (let oldIndex = oldMiddle.length - 1; oldIndex >= 0; oldIndex--) for (let newIndex = newMiddle.length - 1; newIndex >= 0; newIndex--) {
        lengths[oldIndex * width + newIndex] = oldMiddle[oldIndex] === newMiddle[newIndex] ? 1 + lengths[(oldIndex + 1) * width + newIndex + 1] : Math.max(lengths[(oldIndex + 1) * width + newIndex], lengths[oldIndex * width + newIndex + 1]);
      }
      let oldIndex = 0, newIndex = 0;
      while (oldIndex < oldMiddle.length || newIndex < newMiddle.length) {
        if (oldIndex < oldMiddle.length && newIndex < newMiddle.length && oldMiddle[oldIndex] === newMiddle[newIndex]) rows.push({ kind: 'same', text: oldMiddle[oldIndex++] }), newIndex++;
        else if (oldIndex < oldMiddle.length && (newIndex >= newMiddle.length || lengths[(oldIndex + 1) * width + newIndex] >= lengths[oldIndex * width + newIndex + 1])) rows.push({ kind: 'removed', text: oldMiddle[oldIndex++] });
        else rows.push({ kind: 'added', text: newMiddle[newIndex++] });
      }
    }
    for (let index = previous.length - suffix; index < previous.length; index++) rows.push({ kind: 'same', text: previous[index] });
    if (rows.length > MAX_DIFF_ROWS) {
      const compact = [];
      for (const row of rows) {
        const last = compact[compact.length - 1];
        if (last && last.kind === row.kind) last.text += row.text;
        else compact.push({ ...row });
      }
      if (compact.length > MAX_DIFF_ROWS) return { rows: [{ kind: 'removed', text: before }, { kind: 'added', text: after }].filter(row => row.text), approximate: true };
      return { rows: compact, approximate };
    }
    return { rows, approximate };
  }
  function displayDiff(comparison, options) {
    options = options || {};
    const bounded = (value, fallback, min, max) => Number.isFinite(value) ? Math.max(min, Math.min(max, Math.trunc(value))) : fallback;
    const context = bounded(options.context, 2, 0, 20), maxRows = bounded(options.maxRows, 1000, 1, MAX_DIFF_ROWS), maxChars = bounded(options.maxChars, 6000, 1, 100000);
    const source = comparison && Array.isArray(comparison.rows) ? comparison.rows : [];
    const changes = [];
    for (let index = 0; index < source.length; index++) if (source[index].kind === 'added' || source[index].kind === 'removed') changes.push(index);
    function withContext(amount) {
      const wanted = new Set();
      if (!changes.length) for (let index = 0; index < Math.min(source.length, Math.max(1, amount * 2 + 1)); index++) wanted.add(index);
      else for (const index of changes) for (let nearby = Math.max(0, index - amount); nearby <= Math.min(source.length - 1, index + amount); nearby++) wanted.add(nearby);
      const items = [], indices = [...wanted].sort((a, b) => a - b);
      let previous = -1;
      for (const index of indices) {
        if (index > previous + 1) items.push({ kind: 'omitted', text: '… ' + (index - previous - 1) + ' unchanged rows omitted …', count: index - previous - 1 });
        items.push({ ...source[index], sourceIndex: index });
        previous = index;
      }
      if (previous < source.length - 1) items.push({ kind: 'omitted', text: '… ' + (source.length - previous - 1) + ' unchanged rows omitted …', count: source.length - previous - 1 });
      return items;
    }
    let rows = withContext(context);
    if (rows.length > maxRows) rows = withContext(0);
    if (rows.length > maxRows) {
      // Change rows take priority over context and omission markers. The
      // metadata reports every omitted change if even those exceed the cap.
      rows = changes.length ? changes.slice(0, maxRows).map(index => ({ ...source[index], sourceIndex: index })) : rows.slice(0, maxRows);
    }
    let shownRows = 0, shownChanges = 0, truncatedText = 0;
    rows = rows.map(row => {
      const copy = { ...row };
      if (row.kind !== 'omitted') {
        shownRows++;
        if (row.kind === 'added' || row.kind === 'removed') shownChanges++;
        if (asText(row.text).length > maxChars) { copy.text = asText(row.text).slice(0, maxChars); copy.truncated = true; copy.originalLength = asText(row.text).length; truncatedText++; }
      }
      delete copy.sourceIndex;
      return copy;
    });
    return { rows, omittedRows: source.length - shownRows, omittedChanges: changes.length - shownChanges, truncatedText };
  }
  return { MAX_MATCHES, MAX_DIFF_CELLS, MAX_DIFF_LINES, MAX_DIFF_ROWS, preview, apply, diff, displayDiff, formatFingerprint };
});
