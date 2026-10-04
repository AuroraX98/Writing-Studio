const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../app/main.js'), 'utf8');

function functionBlock(name, nextName) {
  const start = source.indexOf(` function ${name}(`);
  const end = source.indexOf(`\n function ${nextName}(`, start);
  assert.notEqual(start, -1, `missing ${name} in app/main.js`);
  assert.notEqual(end, -1, `missing ${nextName} after ${name} in app/main.js`);
  return source.slice(start, end);
}

const correctionFunctions = functionBlock('applyTypingCorrection', 'checkTypedWord');
const checkStart = source.indexOf(' function checkTypedWord(');
const checkEnd = source.indexOf('\n const genre=', checkStart);
assert.notEqual(checkStart, -1, 'missing checkTypedWord in app/main.js');
assert.notEqual(checkEnd, -1, 'missing code after checkTypedWord in app/main.js');
const checkFunction = source.slice(checkStart, checkEnd);
const spacingWordsSource = source.match(/const spacingWords=new Set\(\('([^']+)'\)/)?.[1];
assert.ok(spacingWordsSource, 'missing spacing word list in app/main.js');

function makeHarness({ mode = 'auto', personalWords = [] } = {}) {
  const context = vm.createContext({});
  vm.runInContext(`
    const state = { typing: ${JSON.stringify(mode)} };
    const data = { preferences: { personalDictionary: ${JSON.stringify(personalWords)} } };
    const chapter = { text: '', formats: [] };
    let typingSuggestions = [];
    let lastCorrection = null;
    let typingInput = true;
    let undoRecords = 0;
    let caret = 0;
    let value = '';
    const messages = [];
    const draft = {
      get value() { return value; },
      set value(next) { value = next; },
      get selectionStart() { return caret; },
      get selectionEnd() { return caret; },
      setRangeText(replacement, start, end) {
        value = value.slice(0, start) + replacement + value.slice(end);
        caret = start + replacement.length;
      },
      focus() {},
      setSelectionRange(start) { caret = start; }
    };
    const root = { querySelector(selector) { return selector === '#w-draft' ? draft : null; } };
    const selected = () => chapter;
    const clone = value => JSON.parse(JSON.stringify(value));
    const matchCase = (original, replacement) => original.length > 1 && original === original.toUpperCase()
      ? replacement.toUpperCase()
      : /^[A-Z]/.test(original) ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;
    const isPersonalWord = word => data.preferences.personalDictionary.some(item => item.toLocaleLowerCase() === word.toLocaleLowerCase());
    const updateTyping = message => { if (message) messages.push(message); };
    const setDraftText = text => { chapter.text = text; };
    const count = () => {};
    const fitText = () => {};
    const updateFormattedPreview = () => {};
    const recordEditorUndo = () => { undoRecords++; };
    const commonTypos = ${source.match(/const commonTypos=(\{[^\n]+\});/)?.[1]};
    const spacingWords = new Set(${JSON.stringify(spacingWordsSource.split(' '))});
    ${correctionFunctions}
    ${checkFunction}
    globalThis.api = {
      checkTypedWord,
      applyTypingCorrection,
      undoTypingCorrection,
      draft,
      messages,
      get text() { return value; },
      get caret() { return caret; },
      get suggestions() { return typingSuggestions.map(item => item.replacement); },
      get undoRecords() { return undoRecords; },
      setInput(text) { value = text; caret = text.length; chapter.text = text; },
      input({ inputType = 'insertText', data = ' ', isComposing = false } = {}) {
        checkTypedWord({ target: draft, inputType, data, isComposing });
        chapter.text = draft.value;
      }
    };
  `, context);
  return context.api;
}

test('common transposition autocorrects after typed space or punctuation and preserves case', () => {
  for (const [text, delimiter, expected] of [
    ['whta ', ' ', 'what '],
    ['whta,', ',', 'what,'],
    ['liek ', ' ', 'like '],
    ['Whta ', ' ', 'What '],
    ['WHTA!', '!', 'WHAT!'],
    ['thta.', '.', 'that.']
  ]) {
    const app = makeHarness();
    app.setInput(text);
    app.input({ data: delimiter });
    assert.equal(app.text, expected, `${text} should become ${expected}`);
  }
  const enter = makeHarness();
  enter.setInput('liek\n');
  enter.input({ inputType: 'insertLineBreak', data: null });
  assert.equal(enter.text, 'like\n');
});

test('becasue autocorrects after space, punctuation, or Enter and preserves capitalization', () => {
  for (const [text, event, expected] of [
    ['I stayed becasue ', { data: ' ' }, 'I stayed because '],
    ['becasue,', { data: ',' }, 'because,'],
    ['becasue.', { data: '.' }, 'because.'],
    ['becasue\n', { inputType: 'insertLineBreak', data: null }, 'because\n'],
    ['Becasue ', { data: ' ' }, 'Because '],
    ['BECASUE!', { data: '!' }, 'BECAUSE!']
  ]) {
    const app = makeHarness();
    app.setInput(text);
    app.input(event);
    assert.equal(app.text, expected, `${JSON.stringify(text)} should become ${JSON.stringify(expected)}`);
    assert.equal(app.caret, expected.length, 'caret should remain after the typed delimiter');
  }
});

test('standalone lowercase i becomes I after space, punctuation, or Enter', () => {
  for (const [text, event, expected] of [
    ['i ', { data: ' ' }, 'I '],
    ['Today i ', { data: ' ' }, 'Today I '],
    ['i,', { data: ',' }, 'I,'],
    ['i.', { data: '.' }, 'I.'],
    ['i\n', { inputType: 'insertLineBreak', data: null }, 'I\n']
  ]) {
    const app = makeHarness();
    app.setInput(text);
    app.input(event);
    assert.equal(app.text, expected, `${JSON.stringify(text)} should become ${JSON.stringify(expected)}`);
    assert.equal(app.caret, expected.length, 'caret should remain after the typed delimiter');
    assert.equal(app.messages.length, 1, 'a real capitalization change should report a correction');
  }
});

test('words containing i and already uppercase I do not trigger a correction', () => {
  for (const mode of ['auto', 'suggest']) {
    for (const text of ['inside ', 'this ', 'idea ', 'I ', 'Today I ']) {
      const app = makeHarness({ mode });
      app.setInput(text);
      app.input({ data: ' ' });
      assert.equal(app.text, text);
      assert.equal(app.suggestions.join(','), '');
      assert.equal(app.messages.length, 0, `${text} should not report a correction in ${mode} mode`);
      app.undoTypingCorrection();
      assert.equal(app.undoRecords, 0, 'unchanged text should not create a correction to undo');
    }
  }
});

test('Undo restores lowercase i and its original caret', () => {
  const app = makeHarness();
  app.setInput('Today i ');
  app.input({ data: ' ' });
  assert.equal(app.text, 'Today I ');
  app.undoTypingCorrection();
  assert.equal(app.text, 'Today i ');
  assert.equal(app.caret, 8);
  assert.equal(app.undoRecords, 1);
});

test('lowercase i follows Suggestions and Off typing modes', () => {
  const suggestions = makeHarness({ mode: 'suggest' });
  suggestions.setInput('i ');
  suggestions.input({ data: ' ' });
  assert.equal(suggestions.text, 'i ');
  assert.equal(suggestions.suggestions.join(','), 'I');

  const off = makeHarness({ mode: 'off' });
  off.setInput('i ');
  off.input({ data: ' ' });
  assert.equal(off.text, 'i ');
  assert.equal(off.suggestions.join(','), '');
  assert.equal(off.messages.length, 0);
});

test('personal dictionary can protect lowercase i from capitalization', () => {
  for (const mode of ['auto', 'suggest']) {
    for (const word of ['i', 'I']) {
      const app = makeHarness({ mode, personalWords: [word] });
      app.setInput('i ');
      app.input({ data: ' ' });
      assert.equal(app.text, 'i ');
      assert.equal(app.suggestions.join(','), '');
      assert.equal(app.messages.length, 0);
    }
  }
});

test('immediate Undo restores the typo and original caret after autocorrection', () => {
  const app = makeHarness();
  app.setInput('whta ');
  app.input({ data: ' ' });
  assert.equal(app.text, 'what ');
  app.undoTypingCorrection();
  assert.equal(app.text, 'whta ');
  assert.equal(app.caret, 5);
  assert.equal(app.undoRecords, 1);
});

test('personal dictionary protects a writer word from autocorrection', () => {
  const app = makeHarness({ personalWords: ['whta'] });
  app.setInput('whta ');
  app.input({ data: ' ' });
  assert.equal(app.text, 'whta ');
  assert.equal(app.suggestions.join(','), '');
});

test('Suggestions and Off modes leave text untouched; Suggestions offers the correction', () => {
  const suggestions = makeHarness({ mode: 'suggest' });
  suggestions.setInput('whta ');
  suggestions.input({ data: ' ' });
  assert.equal(suggestions.text, 'whta ');
  assert.equal(suggestions.suggestions.join(','), 'what');

  const off = makeHarness({ mode: 'off' });
  off.setInput('whta ');
  off.input({ data: ' ' });
  assert.equal(off.text, 'whta ');
  assert.equal(off.suggestions.join(','), '');
});

test('pasted and actively composed text are never autocorrected', () => {
  for (const event of [
    { inputType: 'insertFromPaste', data: null, isComposing: false },
    { inputType: 'insertText', data: ' ', isComposing: true }
  ]) {
    const app = makeHarness();
    app.setInput('whta ');
    app.input(event);
    assert.equal(app.text, 'whta ');
    assert.equal(app.suggestions.join(','), '');
  }
});

test('the explicit Ca n correction runs, while general spacing stays suggestion-only', () => {
  const explicit = makeHarness();
  explicit.setInput('Ca n ');
  explicit.input({ data: ' ' });
  assert.equal(explicit.text, 'Can ');

  const boundary = makeHarness();
  boundary.setInput('ca nyou ');
  boundary.input({ data: ' ' });
  assert.equal(boundary.text, 'ca nyou ');
  assert.equal(boundary.suggestions.join(','), 'can you');

  const joined = makeHarness();
  joined.setInput('canyou ');
  joined.input({ data: ' ' });
  assert.equal(joined.text, 'canyou ');
  assert.equal(joined.suggestions.join(','), '');
});
