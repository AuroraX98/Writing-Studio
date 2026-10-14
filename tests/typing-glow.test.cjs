const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function fixture() {
  class Node extends EventTarget {
    constructor() { super(); this.style = {}; this.children = []; this.value = ''; this.clientWidth = 600; this.clientHeight = 315; this.offsetLeft = this.offsetTop = this.clientLeft = this.clientTop = this.scrollLeft = this.scrollTop = 0; }
    append(...children) { this.children.push(...children); children.forEach(child => child.parentNode = this); }
    before(node) { this.parentNode.append(node); }
    replaceChildren(...children) { this.children = []; this.append(...children); }
    replaceWith(node) { this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.parentNode.append(node); }
    setAttribute() {}
  }
  let time = 0, nextTimer = 0;
  const timers = new Map();
  const motion = new EventTarget(); motion.matches = false;
  const win = new EventTarget();
  Object.assign(win, { performance: { now: () => time }, matchMedia: () => motion, getComputedStyle: () => ({}), ResizeObserver: class { observe() {} disconnect() {} }, MutationObserver: class { observe() {} disconnect() {} }, requestAnimationFrame: () => 1, cancelAnimationFrame() {}, setTimeout(fn, delay) { timers.set(++nextTimer, { fn, at: time + delay }); return nextTimer; }, clearTimeout(id) { timers.delete(id); } });
  const doc = { defaultView: win, createElement: () => new Node(), createTextNode: text => ({ textContent: text }), fonts: new EventTarget() };
  const textarea = new Node(); textarea.ownerDocument = doc; new Node().append(textarea);
  const context = { Intl }; vm.createContext(context); vm.runInContext(fs.readFileSync(path.join(__dirname, '../app/typing-glow.js'), 'utf8'), context);
  const controller = context.WritingGlow.attach(textarea);
  const viewport = textarea.parentNode.children[1], mirror = viewport.children[0];
  return { textarea, controller, motion, viewport, mirror,
    spans: () => mirror.children.filter(child => child.className === 'w-glow-letter'),
    input(value, inputType = 'insertText', isComposing = false) { textarea.value = value; const event = new Event('input'); Object.assign(event, { inputType, isComposing }); textarea.dispatchEvent(event); },
    advance(ms) { time += ms; [...timers.values()].filter(timer => timer.at <= time).forEach(timer => timer.fn()); }
  };
}

test('letters keep independent lifetimes, rebase after edits, and never alter draft text', () => {
  const f = fixture(); f.input('a'); f.advance(500); f.input('ab');
  assert.deepEqual(f.spans().map(node => node.style.animationDelay), ['-500ms', '0ms']);
  f.input('b', 'deleteContentBackward'); assert.deepEqual(f.spans().map(node => node.textContent), ['b']);
  f.input('paste b', 'insertFromPaste'); assert.deepEqual(f.spans().map(node => node.textContent), ['b']);
  assert.equal(f.textarea.value, 'paste b');
  f.advance(1500); assert.equal(f.viewport.hidden, true); f.controller.destroy();
});

test('emoji and combining marks are single glowing graphemes; paste and undo do not create glows', () => {
  const f = fixture(); f.input('👩🏽‍💻'); assert.equal(f.spans().length, 1);
  f.controller.clear(); f.input('e\u0301', 'insertText'); assert.equal(f.spans().length, 1);
  f.controller.clear(); f.input('pasted text', 'insertFromPaste'); assert.equal(f.spans().length, 0);
  f.input('undo result', 'historyUndo'); assert.equal(f.spans().length, 0); f.controller.destroy();
});

test('composition waits for completion, reduced motion and preference disable decoration', () => {
  const f = fixture(); f.textarea.dispatchEvent(new Event('compositionstart'));
  f.input('漢', 'insertCompositionText', true); assert.equal(f.spans().length, 0);
  f.textarea.dispatchEvent(new Event('compositionend')); assert.equal(f.spans().length, 1);
  f.motion.matches = true; f.motion.dispatchEvent(new Event('change')); assert.equal(f.viewport.hidden, true);
  f.input('漢字'); assert.equal(f.spans().length, 0);
  f.motion.matches = false; f.controller.setEnabled(false); f.input('漢字a'); assert.equal(f.spans().length, 0);
  f.controller.setEnabled(true); f.input('漢字ab'); assert.equal(f.spans().length, 1);
  f.textarea.value = 'another chapter'; f.controller.refresh(); assert.equal(f.spans().length, 0); f.controller.destroy();
});

test('native selection locates a newly typed repeated letter in the middle of a word', () => {
  const f = fixture(); f.input('aaaa', 'insertFromPaste');
  f.textarea.selectionStart = f.textarea.selectionEnd = 2;
  f.textarea.dispatchEvent(new Event('beforeinput')); f.input('aaaaa');
  assert.equal(f.mirror.children[0].textContent, 'aa');
  assert.equal(f.spans()[0].textContent, 'a'); f.controller.destroy();
});
