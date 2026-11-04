(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WritingLayout = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const properties = ['fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','wordSpacing','textIndent','textTransform','textAlign','tabSize','paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','borderStyle','boxSizing','whiteSpace','overflowWrap','wordBreak'];
  let measure;
  function fit(textarea) {
    if (!textarea.isConnected || !textarea.getClientRects().length) return;
    const width = textarea.getBoundingClientRect().width;
    if (!width) return;
    const doc = textarea.ownerDocument, style = doc.defaultView.getComputedStyle(textarea);
    if (!measure || measure.ownerDocument !== doc) {
      measure = doc.createElement('textarea');
      measure.tabIndex = -1;
      measure.setAttribute('aria-hidden', 'true');
      measure.setAttribute('data-writing-measure', '');
      doc.body.append(measure);
    }
    measure.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none;height:0;min-height:0;max-height:none;overflow:hidden;resize:none;';
    for (const property of properties) measure.style[property] = style[property];
    measure.style.boxSizing = 'border-box';
    measure.style.width = width + 'px';
    measure.wrap = textarea.wrap;
    measure.value = textarea.value || textarea.placeholder || ' ';
    const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    const minimum = parseFloat(style.minHeight) || 0;
    const height = Math.max(minimum, Math.ceil(measure.scrollHeight + border));
    // Never collapse the visible editor to measure it: that clamps page scroll
    // on every keystroke, particularly near the bottom of a long mobile draft.
    if (Math.abs(textarea.getBoundingClientRect().height - height) > 0.5) textarea.style.height = height + 'px';
  }
  return { fit };
});
