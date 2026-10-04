const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const WritingRevision = require('../app/revision.js');

function fixture(savedProject) {
  const first = { id: 'first', title: 'One', text: 'A red rose.', formats: [], alignment: 'left', lineSpacing: 1.7 };
  const second = { id: 'second', title: 'Two', text: 'A red leaf.', formats: [], alignment: 'left', lineSpacing: 1.7 };
  let manuscript = savedProject || { id: 'book', chapters: [first, second], history: [] };
  let chapterId = manuscript.chapters[0].id;
  let saves = 0, confirmation = null;
  const listeners = {}, panel = { innerHTML: '', textContent: '' };
  const fields = {
    'w-find-text': { value: 'red' }, 'w-replace-text': { value: 'blue' },
    'w-replace-scope': { value: 'project' }, 'w-match-case': { checked: true },
    'w-whole-word': { checked: true }, 'w-replace-preview': panel
  };
  const root = {
    querySelector: selector => fields[selector.slice(1)],
    addEventListener: (type, handler) => (listeners[type] ||= []).push(handler)
  };
  const context = vm.createContext({
    root, document: { getElementById: () => ({ addEventListener() {} }) },
    WritingLocalBackup: { createClient: () => ({ state: {} }) }, WritingRevision,
    project: () => manuscript, selected: () => manuscript.chapters.find(c => c.id === chapterId),
    scheduleSave: () => saves++, escape: text => String(text).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    confirmAction: (_title, _message, action) => { confirmation = action; }, snapshot() {},
    chapters: manuscript.chapters
  });
  vm.runInContext(fs.readFileSync(require.resolve('../work/app_advanced.js'), 'utf8') + '\nglobalThis.ui = {revisionDraft, findReplacePanel, previewReplace, applyReplace, currentReplacementPreview};', context);
  return {
    ui: context.ui, fields, panel, manuscript, get saves() { return saves; },
    select: id => { chapterId = id; },
    switchProject: p => { manuscript = p; context.chapters = p.chapters; chapterId = p.chapters[0].id; },
    event: (type, id) => listeners[type].forEach(handler => handler({ target: { id } })),
    confirm: () => confirmation()
  };
}

test('find/replace fields and options survive rerender and reloaded chapter data', () => {
  const app = fixture();
  app.event('input', 'w-find-text');
  const expected = { find: 'red', replacement: 'blue', scope: 'project', caseSensitive: true, wholeWord: true, previewRequested: false };
  assert.deepEqual(JSON.parse(JSON.stringify(app.ui.revisionDraft())), expected);
  assert.ok(app.saves > 0);
  const html = app.ui.findReplacePanel();
  assert.match(html, /value="red"/);
  assert.match(html, /value="blue"/);
  assert.match(html, /value="project" selected/);
  assert.match(html, /id="w-match-case" type="checkbox" checked/);
  assert.match(html, /id="w-whole-word" type="checkbox" checked/);
  const reloaded = fixture(JSON.parse(JSON.stringify(app.manuscript)));
  assert.deepEqual(JSON.parse(JSON.stringify(reloaded.ui.revisionDraft())), expected);
});

test('search settings are isolated per chapter and per project', () => {
  const app = fixture();
  app.event('input', 'w-find-text');
  app.select('second');
  assert.equal(app.ui.revisionDraft().find, '');
  app.fields['w-find-text'].value = 'leaf';
  app.fields['w-replace-scope'].value = 'chapter';
  app.event('change', 'w-replace-scope');
  app.select('first');
  assert.equal(app.ui.revisionDraft().find, 'red');
  app.switchProject({ id: 'other', chapters: [{ id: 'first', title: 'Other', text: 'red' }] });
  assert.equal(app.ui.revisionDraft().find, '');
});

test('a preview remains usable on return only while its manuscript is unchanged', () => {
  const app = fixture();
  app.ui.previewReplace();
  assert.match(app.ui.findReplacePanel(), /Apply previewed replacements/);
  app.select('second');
  assert.doesNotMatch(app.ui.findReplacePanel(), /Apply previewed replacements/);
  app.select('first');
  assert.match(app.ui.findReplacePanel(), /Apply previewed replacements/);
  app.manuscript.chapters[1].text = 'A red and red leaf.';
  assert.doesNotMatch(app.ui.findReplacePanel(), /Apply previewed replacements/);
  assert.equal(app.ui.currentReplacementPreview(), null);
  app.ui.applyReplace();
  assert.match(app.panel.textContent, /Preview replacements again/);
});

test('reload restores search settings but requires a new preview', () => {
  const app = fixture();
  app.ui.previewReplace();
  const reloaded = fixture(JSON.parse(JSON.stringify(app.manuscript)));
  const html = reloaded.ui.findReplacePanel();
  assert.match(html, /value="red"/);
  assert.match(html, /Preview again/);
  assert.doesNotMatch(html, /Apply previewed replacements/);
});

test('search option changes invalidate the old preview and confirmation rechecks edits', () => {
  const app = fixture();
  app.ui.previewReplace();
  app.fields['w-whole-word'].checked = false;
  app.event('change', 'w-whole-word');
  assert.equal(app.ui.currentReplacementPreview(), null);
  app.ui.previewReplace();
  app.ui.applyReplace();
  app.manuscript.chapters[0].text = 'Now a red rose.';
  assert.throws(() => app.confirm(), /manuscript changed/);
  assert.equal(app.manuscript.chapters[0].text, 'Now a red rose.');
});

test('confirmed replacements preserve draft settings and clear the old preview', () => {
  const app = fixture();
  app.ui.previewReplace();
  app.ui.applyReplace();
  app.confirm();
  assert.equal(app.manuscript.chapters[0].text, 'A blue rose.');
  assert.equal(app.ui.revisionDraft().find, 'red');
  assert.equal(app.ui.revisionDraft().previewRequested, false);
  assert.doesNotMatch(app.ui.findReplacePanel(), /Apply previewed replacements/);
});
