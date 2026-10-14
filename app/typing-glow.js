/* Decorative only: the textarea remains the sole editable/saved text. */
(function (global) {
  'use strict';
  const DURATION = 1500;
  const instances = new WeakMap();
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  const metrics = ['fontFamily','fontSize','fontWeight','fontStyle','fontStretch','fontVariant','fontFeatureSettings','fontVariationSettings','fontKerning','lineHeight','letterSpacing','wordSpacing','textAlign','textIndent','textTransform','textRendering','wordBreak','lineBreak','direction','tabSize','paddingTop','paddingRight','paddingBottom','paddingLeft'];

  function change(before, after) {
    let start = 0, endBefore = before.length, endAfter = after.length;
    while (start < endBefore && start < endAfter && before[start] === after[start]) start++;
    while (endBefore > start && endAfter > start && before[endBefore - 1] === after[endAfter - 1]) { endBefore--; endAfter--; }
    return { start, endBefore, endAfter, delta: endAfter - endBefore };
  }
  function rebase(items, edit) {
    return items.flatMap(item => item.end <= edit.start ? [item] : item.start >= edit.endBefore ? [{ ...item, start: item.start + edit.delta, end: item.end + edit.delta }] : []);
  }
  function attach(textarea, enabled = true) {
    if (instances.has(textarea)) { const current = instances.get(textarea); current.setEnabled(enabled); return current; }
    const doc = textarea.ownerDocument;
    const win = doc.defaultView;
    const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
    const wrapper = doc.createElement('div'); wrapper.className = 'w-glow-wrap';
    const viewport = doc.createElement('div'); viewport.className = 'w-glow-viewport'; viewport.setAttribute('aria-hidden', 'true');
    const mirror = doc.createElement('div'); mirror.className = 'w-glow-mirror'; viewport.append(mirror);
    textarea.before(wrapper); wrapper.append(textarea, viewport);
    let previous = textarea.value, active = [], timer = 0, frame = 0, composing = false, compositionBefore = '', destroyed = false, pending = null;
    const now = () => win.performance.now();
    const allowed = () => enabled && !motion.matches;
    function sync() {
      if (destroyed) return;
      const style = win.getComputedStyle(textarea);
      metrics.forEach(key => { mirror.style[key] = style[key]; });
      mirror.style.whiteSpace = textarea.wrap === 'off' ? 'pre' : 'pre-wrap';
      mirror.style.overflowWrap = textarea.wrap === 'off' ? 'normal' : 'break-word';
      // clientWidth excludes the native scrollbar; offset positions include margins.
      viewport.style.left = (textarea.offsetLeft + textarea.clientLeft) + 'px';
      viewport.style.top = (textarea.offsetTop + textarea.clientTop) + 'px';
      viewport.style.width = textarea.clientWidth + 'px';
      viewport.style.height = textarea.clientHeight + 'px';
      mirror.style.width = textarea.clientWidth + 'px';
      mirror.style.transform = `translate(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px)`;
    }
    function scheduleSync() {
      if (!frame && !destroyed) frame = win.requestAnimationFrame(() => { frame = 0; sync(); });
    }
    function render() {
      win.clearTimeout(timer);
      const time = now(); active = allowed() ? active.filter(item => time - item.born < DURATION) : [];
      mirror.replaceChildren();
      if (!active.length) { viewport.hidden = true; return; }
      viewport.hidden = false;
      let cursor = 0;
      active.sort((a,b) => a.start - b.start).forEach(item => {
        mirror.append(doc.createTextNode(previous.slice(cursor, item.start)));
        const span = doc.createElement('span'); span.className = 'w-glow-letter';
        span.textContent = previous.slice(item.start, item.end);
        span.style.animationDelay = -(time - item.born) + 'ms';
        mirror.append(span); cursor = item.end;
      });
      mirror.append(doc.createTextNode(previous.slice(cursor) + '\u200b'));
      sync(); scheduleSync();
      timer = win.setTimeout(render, Math.max(1, Math.min(...active.map(item => DURATION - (time - item.born)))));
    }
    function addLetters(value, start, end) {
      const born = now();
      // Segment the whole value so combining marks and ZWJ emoji glow as one glyph.
      const segments = segmenter ? segmenter.segment(value) : Array.from(value).map((segment, i, all) => ({ segment, index: all.slice(0,i).join('').length }));
      for (const entry of segments) {
        if (entry.index >= end) break;
        if (entry.index + entry.segment.length > start && !/^\s+$/.test(entry.segment)) {
          active = active.filter(item => item.end <= entry.index || item.start >= entry.index + entry.segment.length);
          active.push({ start: entry.index, end: entry.index + entry.segment.length, born });
        }
      }
    }
    function beforeInput() { pending = { value: textarea.value, start: textarea.selectionStart, end: textarea.selectionEnd }; }
    function input(event) {
      const value = textarea.value;
      let edit = change(previous, value);
      // A text-only diff cannot locate edits among repeated letters. Prefer the
      // native selection captured before input whenever it explains the change.
      if (pending && pending.value === previous && Number.isInteger(pending.start)) {
        const delta = value.length - previous.length;
        let start = pending.start, endBefore = pending.end;
        if (start === endBefore && delta < 0) {
          start = Math.min(start, textarea.selectionStart);
          endBefore = start - delta;
        }
        const endAfter = endBefore + delta;
        if (endAfter >= start && value.slice(0,start) === previous.slice(0,start) && value.slice(endAfter) === previous.slice(endBefore)) edit = { start, endBefore, endAfter, delta };
      }
      pending = null;
      active = rebase(active, edit);
      if (allowed() && !composing && !event.isComposing && ['insertText','insertCompositionText','insertFromComposition'].includes(event.inputType)) addLetters(value, edit.start, edit.endAfter);
      previous = value; render();
    }
    function compositionStart() { composing = true; compositionBefore = textarea.value; }
    function compositionEnd() {
      composing = false;
      const edit = change(compositionBefore, textarea.value);
      // Some browsers deliver the final input after compositionend, some before.
      active = rebase(active, change(previous, textarea.value)); previous = textarea.value;
      if (allowed()) addLetters(previous, edit.start, edit.endAfter);
      render();
    }
    function clear() { active = []; previous = textarea.value; render(); }
    const resize = new win.ResizeObserver(scheduleSync); resize.observe(textarea);
    const attributes = new win.MutationObserver(scheduleSync);
    for (let element = textarea; element; element = element.parentElement) attributes.observe(element, { attributes: true, attributeFilter: ['class','style','dir','wrap'] });
    textarea.addEventListener('beforeinput', beforeInput);
    textarea.addEventListener('input', input);
    textarea.addEventListener('compositionstart', compositionStart);
    textarea.addEventListener('compositionend', compositionEnd);
    textarea.addEventListener('scroll', scheduleSync, { passive: true });
    motion.addEventListener('change', clear);
    win.addEventListener('resize', scheduleSync);
    doc.fonts?.addEventListener('loadingdone', scheduleSync);
    const controller = {
      setEnabled(value) { enabled = !!value; if (!enabled) clear(); },
      refresh() { if (previous !== textarea.value) clear(); scheduleSync(); },
      clear,
      destroy() {
        if (destroyed) return; destroyed = true;
        win.clearTimeout(timer); win.cancelAnimationFrame(frame); resize.disconnect(); attributes.disconnect();
        textarea.removeEventListener('beforeinput', beforeInput); textarea.removeEventListener('input', input); textarea.removeEventListener('compositionstart', compositionStart); textarea.removeEventListener('compositionend', compositionEnd); textarea.removeEventListener('scroll', scheduleSync);
        motion.removeEventListener('change', clear); win.removeEventListener('resize', scheduleSync); doc.fonts?.removeEventListener('loadingdone', scheduleSync);
        if (wrapper.parentNode) wrapper.replaceWith(textarea);
        instances.delete(textarea);
      }
    };
    instances.set(textarea, controller); viewport.hidden = true; sync();
    return controller;
  }
  global.WritingGlow = { attach };
})(typeof globalThis === 'object' ? globalThis : this);
