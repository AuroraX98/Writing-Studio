const test = require('node:test');
const assert = require('node:assert/strict');
const Revision = require('../app/revision.js');
const Text = require('../app/text-tools.js');

const book = text => ({ id: 'book', chapters: [{ id: 'first', title: 'Opening', text }, { id: 'second', title: 'Closing', text: 'Other words.' }] });
const reconstruct = (comparison, side) => comparison.rows.filter(row => row.kind === 'same' || row.kind === side).map(row => row.text).join('');

test('literal query and replacement preserve metacharacters and dollar substitution text', () => {
  const project = book('a+b a.b a+b $&');
  const result = Revision.preview(project, 'a+b', '$& $1 $$');
  assert.equal(result.total, 2);
  assert.equal(result.chapters[0].after, '$& $1 $$ a.b $& $1 $$ $&');
  const changed = Revision.apply(project, result);
  assert.equal(changed.chapters[0].text, result.chapters[0].after);
  assert.equal(project.chapters[0].text, 'a+b a.b a+b $&');
});

test('case and whole-word checks support accented, combining, Cyrillic and astral letters', () => {
  const project = book('José JOSÉ Josélito José2 _José José\u0301. Жук жук Жуки. 𐐀José José𐐀');
  const result = Revision.preview(project, 'José', 'René', { wholeWord: true });
  assert.equal(result.total, 2);
  assert.equal(result.chapters[0].after, 'René René Josélito José2 _José José\u0301. Жук жук Жуки. 𐐀José José𐐀');
  assert.equal(Revision.preview(project, 'José', 'René', { wholeWord: true, caseSensitive: true }).total, 1);
  assert.equal(Revision.preview(project, 'жук', 'кот', { wholeWord: true }).total, 2);
});

test('matches are nonoverlapping and chapter scope does not affect other drafts', () => {
  const project = book('aaaa');
  project.chapters[1].text = 'aaaa';
  const result = Revision.preview(project, 'aa', 'b', { scope: 'chapter', chapterId: 'first' });
  assert.deepEqual(result.chapters[0].matches.map(match => [match.start, match.end]), [[0, 2], [2, 4]]);
  assert.deepEqual(Revision.apply(project, result).changedChapterIds, ['first']);
  assert.equal(result.chapters[0].after, 'bb');
  assert.throws(() => Revision.preview(project, '', 'x'), /Enter some text/);
  assert.throws(() => Revision.preview(project, 'a', 'x', { scope: 'chapter', chapterId: 'missing' }), /no longer available/);
  assert.throws(() => Revision.preview(project, 'a', 'x', { scope: 'invalid' }), /Choose a chapter/);
});

test('too many matches reject the full operation instead of replacing an unseen subset', () => {
  assert.throws(() => Revision.preview(book('a'.repeat(Revision.MAX_MATCHES + 1)), 'a', 'b'), /Narrow your search/);
});

test('a stale later chapter or changed formatting rejects atomically without mutations', () => {
  const project = book('old text');
  project.chapters[1].text = 'old text too';
  const candidate = Revision.preview(project, 'old', 'new');
  project.chapters[1].text += '!';
  const snapshot = JSON.stringify(project);
  assert.throws(() => Revision.apply(project, candidate), /changed after this preview/);
  assert.equal(JSON.stringify(project), snapshot);
  project.chapters[1].text = 'old text too';
  project.chapters[0].formats = [{ start: 0, end: 3, bold: true }];
  assert.throws(() => Revision.apply(project, candidate), /changed after this preview/);
  delete project.chapters[0].formats;
  project.chapters[0].alignment = 'right';
  assert.throws(() => Revision.apply(project, candidate), /changed after this preview/);
  delete project.chapters[0].alignment;
  project.chapters[0].lineSpacing = 2;
  assert.throws(() => Revision.apply(project, candidate), /changed after this preview/);
});

test('different projects, tampered previews, chapter removal and new matching chapters reject', () => {
  const project = book('old');
  const candidate = Revision.preview(project, 'old', 'new');
  assert.throws(() => Revision.apply({ ...project, id: 'another' }, candidate), /different manuscript/);
  assert.throws(() => Revision.apply(project, { ...candidate, chapters: [{ ...candidate.chapters[0], after: 'unreviewed' }] }), /changed after this preview/);
  project.chapters.push({ id: 'third', text: 'old' });
  assert.throws(() => Revision.apply(project, candidate), /changed after this preview/);
  project.chapters = [];
  assert.throws(() => Revision.apply(project, candidate), /changed after this preview/);
});

test('unchanged replacements do not create changed chapter projections', () => {
  const project = book('same');
  const result = Revision.apply(project, Revision.preview(project, 'same', 'same'));
  assert.deepEqual(result, { changedChapterIds: [], replacements: 0, chapters: [] });
});

test('replacement styles agree with sequential text edits for mixed overlapping formatting', () => {
  for (const replacement of ['longer word', 'x', '', '$&']) {
    const project = book('one word two word word end');
    project.chapters[0].formats = [{ start: 0, end: 12, bold: true }, { start: 7, end: 22, italic: true }];
    const candidate = Revision.preview(project, 'word', replacement);
    let expected = { text: project.chapters[0].text, formats: project.chapters[0].formats };
    for (const match of [...candidate.chapters[0].matches].reverse()) expected = Text.edit(expected.text, expected.formats, match.start, match.end, replacement);
    const projected = Revision.apply(project, candidate).chapters[0];
    assert.equal(projected.text, expected.text);
    assert.deepEqual(projected.formats, expected.formats);
  }
});

test('bulk replacement preserves every formatted span in bounded time', () => {
  const project = book('old '.repeat(10000));
  project.chapters[0].formats = [{ start: 0, end: project.chapters[0].text.length, italic: true }];
  const start = performance.now();
  const candidate = Revision.preview(project, 'old', 'newer');
  const result = Revision.apply(project, candidate);
  assert.equal(result.replacements, 10000);
  assert.equal(result.chapters[0].text, 'newer '.repeat(10000));
  assert.deepEqual(result.chapters[0].formats, [{ start: 0, end: 60000, italic: true }]);
  assert.ok(performance.now() - start < 5000, '10,000 replacements complete in under five seconds');
});

test('line diff reconstructs both exact originals, including CRLF and missing trailing newline', () => {
  for (const [before, after] of [['', 'new'], ['old', ''], ['same\nold\nend', 'same\nnew\nend'], ['a\r\nb\r\n', 'a\r\nc'], ['one\n', 'one'], ['<script>x</script>', '<img src=x onerror=x>'], ['a\nb\na\nb\n', 'b\na\nb\na\n']]) {
    const comparison = Revision.diff(before, after);
    assert.equal(reconstruct(comparison, 'removed'), before);
    assert.equal(reconstruct(comparison, 'added'), after);
    assert.equal(comparison.approximate, false);
  }
});

test('long-book differences use bounded comparison while retaining all text', () => {
  const before = 'chapter\n' + Array.from({ length: 4000 }, (_, index) => `old ${index}\n`).join('') + 'ending\n';
  const after = 'chapter\n' + Array.from({ length: 4000 }, (_, index) => `new ${index}\n`).join('') + 'ending\n';
  const start = performance.now();
  const comparison = Revision.diff(before, after);
  assert.equal(comparison.approximate, true);
  assert.equal(reconstruct(comparison, 'removed'), before);
  assert.equal(reconstruct(comparison, 'added'), after);
  assert.ok(performance.now() - start < 5000);
  const manyLines = Revision.diff('a\n'.repeat(60000), 'b\n'.repeat(60000));
  assert.equal(manyLines.approximate, true);
  assert.equal(manyLines.rows.length, 2);
});

test('display comparison shows changes after a long unchanged opening and preserves full diff', () => {
  const comparison = Revision.diff('same\n'.repeat(1200) + 'old\n', 'same\n'.repeat(1200) + 'new\n');
  const original = JSON.stringify(comparison);
  const display = Revision.displayDiff(comparison);
  assert.deepEqual(display.rows.filter(row => row.kind === 'removed' || row.kind === 'added').map(row => row.text), ['old\n', 'new\n']);
  assert.equal(display.omittedChanges, 0);
  assert.equal(display.omittedRows, 1198);
  assert.equal(display.rows[0].kind, 'omitted');
  assert.equal(display.rows[0].count, 1198);
  assert.equal(JSON.stringify(comparison), original);
});

test('display limits favor all change rows before context and report every skipped change', () => {
  const comparison = { rows: Array.from({ length: 30 }, (_, index) => ({ kind: index % 3 === 1 ? 'added' : 'same', text: `row ${index}\n` })) };
  const allChanges = Revision.displayDiff(comparison, { maxRows: 10 });
  assert.equal(allChanges.rows.length, 10);
  assert.ok(allChanges.rows.every(row => row.kind === 'added'));
  assert.equal(allChanges.omittedChanges, 0);
  assert.equal(allChanges.omittedRows, 20);
  const limited = Revision.displayDiff(comparison, { maxRows: 4 });
  assert.equal(limited.rows.length, 4);
  assert.equal(limited.omittedChanges, 6);
  assert.equal(limited.omittedRows, 26);
});

test('display marks shortened row text and gives consistent empty/unchanged results', () => {
  const comparison = Revision.diff('a'.repeat(7000), 'b'.repeat(8000));
  const display = Revision.displayDiff(comparison, { maxChars: 6000 });
  assert.equal(display.truncatedText, 2);
  assert.ok(display.rows.every(row => row.text.length === 6000 && row.truncated));
  assert.deepEqual(display.rows.map(row => row.originalLength), [7000, 8000]);
  assert.equal(comparison.rows[0].text.length, 7000);
  assert.deepEqual(Revision.displayDiff(Revision.diff('', '')), { rows: [], omittedRows: 0, omittedChanges: 0, truncatedText: 0 });
  assert.equal(Revision.displayDiff(Revision.diff('same', 'same')).rows[0].kind, 'same');
});

test('format fingerprints use the app default comfortable spacing', () => {
  assert.equal(Revision.formatFingerprint({}), Revision.formatFingerprint({ alignment: 'left', formats: [], lineSpacing: 1.7 }));
});
