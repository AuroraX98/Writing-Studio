const assert = require('node:assert/strict');
const test = require('node:test');
const Palette = require('../app/theme-palette.js');

test('custom colors remain disabled until explicitly chosen', () => {
  const first = Palette.normalize();
  assert.deepEqual(first, {enabled:false, mode:'gradient', hues:[145,25,340], saturation:35, lightness:90, angle:135});
  assert.deepEqual(Palette.paint(first, 'glass').styles, {});
  first.hues[0] = 0;
  assert.equal(Palette.normalize().hues[0], 145, 'Defaults and other projects must not share a mutable hue array');
});

test('invalid imported values cannot produce unsafe or unbounded styles', () => {
  const palette = Palette.normalize({enabled:'yes', mode:'url(https://example.invalid)', hues:[-10,Infinity,'url(x)'], saturation:1000,lightness:0,angle:-40});
  assert.deepEqual(palette, {enabled:false,mode:'gradient',hues:[0,25,340],saturation:65,lightness:15,angle:0});
  for (const malformed of [null, [], 'red', 9, {hues:[1,2]}, {hues:[1,2,3,4]}]) {
    assert.equal(Palette.normalize(malformed).hues.length, 3);
  }
  const painted = Palette.paint({enabled:true,mode:'injected',hues:['red;display:none',2,NaN],saturation:NaN,lightness:Infinity,angle:'url(x)'},'glass');
  for (const value of Object.values(painted.styles)) assert.doesNotMatch(value, /url\(|;|NaN|Infinity|undefined/);
});

test('solid mode uses one hue while gradients preserve three ordered stops and direction', () => {
  const value = {enabled:true,mode:'gradient',hues:[145,25,340],saturation:35,lightness:90,angle:225};
  assert.match(Palette.paint(value,'light').styles.background,/^linear-gradient\(225deg,rgb\([\d,]+\) 0%,rgb\([\d,]+\) 50%,rgb\([\d,]+\) 100%\)$/);
  assert.equal(Palette.paint({...value,mode:'solid'},'light').styles.background,'rgb('+Palette.rgb(145,35,90).join(',')+')');
});

test('writing surfaces retain readable text at all allowed background extremes', () => {
  for (const theme of ['dark','light','glass']) for (const hue of [0,30,60,90,120,180,240,300,360]) for (const saturation of [0,35,65]) for (const lightness of [15,40,65,95]) {
    const painted = Palette.paint({enabled:true,hues:[hue,(hue+75)%360,(hue+210)%360],saturation,lightness},theme);
    assert.ok(painted.minimumContrast>=4.5, `${theme} ${hue} ${saturation} ${lightness}: ${painted.minimumContrast}`);
    const {paper,ink,muted,accent,error,backgrounds} = painted.colors;
    for (const background of backgrounds) for (const foreground of [ink,muted,accent]) {
      assert.ok(Palette.contrast(foreground,Palette.blend(paper,background,.96))>=4.5);
    }
    assert.ok(Palette.contrast(error,paper)>=4.5,'Error messages must remain readable');
  }
});

test('light and dark themes adapt reading surfaces while preserving chosen background', () => {
  const value = {...Palette.normalize(),enabled:true};
  const light = Palette.paint(value,'light'),dark = Palette.paint(value,'dark');
  assert.equal(light.styles.background,dark.styles.background);
  assert.notEqual(light.styles['--w-paper'],dark.styles['--w-paper']);
  assert.notEqual(light.styles['--w-text'],dark.styles['--w-text']);
  assert.ok(Palette.contrast(light.colors.ink,light.colors.paper)>10);
  assert.ok(Palette.contrast(dark.colors.ink,dark.colors.paper)>10);
});
