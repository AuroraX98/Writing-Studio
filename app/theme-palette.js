(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WritingPalette = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const DEFAULTS = Object.freeze({enabled: false, mode: 'gradient', hues: Object.freeze([145, 25, 340]), saturation: 35, lightness: 90, angle: 135});
  const STYLE_KEYS = Object.freeze(['background', '--w-bg', '--w-paper', '--w-panel', '--w-text', '--w-ink', '--w-muted', '--w-line', '--w-selected', '--w-accent', '--w-edge', '--w-shadow', '--w-error']);
  function bounded(value, fallback, minimum, maximum) {
    return typeof value === 'number' && Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;
  }
  function normalize(value) {
    value = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const hues = Array.isArray(value.hues) && value.hues.length === 3 ? value.hues : DEFAULTS.hues;
    return {enabled: value.enabled === true, mode: value.mode === 'solid' ? 'solid' : 'gradient',
      hues: hues.map((hue, index) => bounded(hue, DEFAULTS.hues[index], 0, 360)),
      saturation: bounded(value.saturation, DEFAULTS.saturation, 0, 65),
      lightness: bounded(value.lightness, DEFAULTS.lightness, 15, 95), angle: bounded(value.angle, DEFAULTS.angle, 0, 360)};
  }
  function rgb(hue, saturation, lightness) {
    const h = ((hue % 360) + 360) % 360 / 60, s = saturation / 100, l = lightness / 100;
    const chroma = (1 - Math.abs(2 * l - 1)) * s, secondary = chroma * (1 - Math.abs(h % 2 - 1)), offset = l - chroma / 2;
    const values = h < 1 ? [chroma, secondary, 0] : h < 2 ? [secondary, chroma, 0] : h < 3 ? [0, chroma, secondary] : h < 4 ? [0, secondary, chroma] : h < 5 ? [secondary, 0, chroma] : [chroma, 0, secondary];
    return values.map(value => Math.round((value + offset) * 255));
  }
  function color(values, alpha) { return alpha === undefined ? 'rgb(' + values.join(',') + ')' : 'rgba(' + values.join(',') + ',' + alpha + ')'; }
  function luminance(values) {
    const linear = values.map(value => { const channel = value / 255; return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4); });
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  }
  function contrast(first, second) {
    const one = luminance(first), two = luminance(second);
    return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
  }
  function blend(foreground, background, alpha) { return foreground.map((value, index) => value * alpha + background[index] * (1 - alpha)); }
  function paint(value, theme) {
    const palette = normalize(value);
    if (!palette.enabled) return {enabled: false, palette, styles: {}};
    const dark = theme === 'dark', hue = palette.hues[0], saturation = Math.min(palette.saturation * 0.3, 16);
    const backgrounds = palette.hues.map(item => rgb(item, palette.saturation, palette.lightness));
    const paper = rgb(hue, saturation, dark ? 17 : 96), selected = rgb(hue, saturation, dark ? 27 : 86);
    const ink = rgb(hue, 8, dark ? 96 : 13), muted = rgb(hue, 8, dark ? 80 : 31), accent = rgb(hue, Math.min(palette.saturation, 28), dark ? 85 : 25);
    const line = rgb(hue, 10, dark ? 53 : 48), error = dark ? [255, 184, 200] : [126, 24, 54];
    const background = palette.mode === 'solid' ? color(backgrounds[0]) : 'linear-gradient(' + palette.angle + 'deg,' + backgrounds.map((item, index) => color(item) + ' ' + (index * 50) + '%').join(',') + ')';
    const styles = {background, '--w-bg': color(backgrounds[0]), '--w-paper': color(paper), '--w-panel': color(paper, 0.96),
      '--w-text': color(ink), '--w-ink': color(ink), '--w-muted': color(muted), '--w-line': color(line), '--w-selected': color(selected),
      '--w-accent': color(accent), '--w-edge': color(dark ? [255,255,255] : [255,255,255], dark ? 0.14 : 0.75),
      '--w-shadow': 'rgba(0,0,0,' + (dark ? 0.36 : 0.12) + ')', '--w-error': color(error)};
    // Panels shelter text from every possible background. Black/white bounds also
    // cover intermediate colors between gradient stops, including saturated hues.
    const surfaces = [paper, selected, blend(paper, [0,0,0], 0.96), blend(paper, [255,255,255], 0.96)];
    const minimumContrast = Math.min(...[ink, muted, accent].flatMap(foreground => surfaces.map(surface => contrast(foreground, surface))));
    return {enabled: true, palette, styles, colors: {backgrounds, paper, selected, ink, muted, accent, line, error}, minimumContrast};
  }
  return {DEFAULTS, STYLE_KEYS, normalize, paint, rgb, contrast, blend};
});
