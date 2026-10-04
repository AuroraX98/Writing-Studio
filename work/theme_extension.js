 let palettePreview=null,paletteTransaction=null;
 function applyPaletteTo(element,painting,isDialog=false){
  if(!element)return;element.classList.toggle('w-custom-colors',painting.enabled);
  for(const key of WritingPalette.STYLE_KEYS){if(isDialog&&key==='background')continue;if(painting.enabled&&key in painting.styles)element.style.setProperty(key,painting.styles[key]);else element.style.removeProperty(key);}
 }
 function onPaletteAppearance(){
  if(!globalThis.WritingPalette)return;const painting=WritingPalette.paint(palettePreview||state.palette,state.theme);
  applyPaletteTo(root,painting);applyPaletteTo(document.getElementById('w-dialog'),painting,true);
 }
 function initializePalette(){
  state.palette=WritingPalette.normalize(data.preferences.palette);
  const theme=root.querySelector('#w-theme'),label=theme?.closest('label');
  if(label&&!root.querySelector('#w-colors'))label.insertAdjacentHTML('afterend','<button type="button" id="w-colors" aria-haspopup="dialog">Colors</button>');
  onPaletteAppearance();
 }
 function paletteSlider(name,label,value,minimum,maximum,unit=''){
  return `<label class="w-palette-slider" for="w-palette-${name}"><span>${label}<output id="w-palette-${name}-value" for="w-palette-${name}">${value}${unit}</output></span><input id="w-palette-${name}" name="${name}" type="range" min="${minimum}" max="${maximum}" step="1" value="${value}" ${name.startsWith('hue')?'class="w-hue-slider"':''}></label>`;
 }
 function paletteFields(value){
  return `<div class="w-palette-controls"><label class="w-palette-enable"><input id="w-palette-enabled" type="checkbox" name="enabled" ${value.enabled?'checked':''}><span>Use custom colors</span></label><fieldset id="w-palette-options" ${value.enabled?'':'disabled'}><label>Color style<select id="w-palette-mode" name="mode"><option value="solid" ${value.mode==='solid'?'selected':''}>Solid color</option><option value="gradient" ${value.mode==='gradient'?'selected':''}>Soft gradient</option></select></label>${paletteSlider('hue1','First color',value.hues[0],0,360,'°')}<div data-palette-gradient ${value.mode==='solid'?'hidden':''}>${paletteSlider('hue2','Second color',value.hues[1],0,360,'°')}${paletteSlider('hue3','Third color',value.hues[2],0,360,'°')}${paletteSlider('angle','Gradient direction',value.angle,0,360,'°')}</div>${paletteSlider('saturation','Color intensity',value.saturation,0,65,'%')}${paletteSlider('lightness','Background brightness',value.lightness,15,95,'%')}</fieldset><div id="w-palette-swatch" class="w-palette-swatch" role="img" aria-label="Background color preview"></div><p class="w-palette-note">The background previews as you move the sliders. Writing panels stay readable in your selected light or dark theme.</p><button type="button" id="w-palette-reset">Restore original colors</button></div>`;
 }
 function updatePaletteControls(){
  const dialog=document.getElementById('w-dialog'),fields=dialog.querySelector('.w-palette-controls');if(!fields||!palettePreview)return;
  fields.querySelector('#w-palette-options').disabled=!palettePreview.enabled;fields.querySelector('[data-palette-gradient]').hidden=palettePreview.mode==='solid';
  const painting=WritingPalette.paint(palettePreview,state.theme),swatch=fields.querySelector('#w-palette-swatch');
  swatch.style.background=painting.enabled?painting.styles.background:state.theme==='dark'?'#1d1e20':state.theme==='light'?'#e8e8e8':'linear-gradient(135deg,#e7f2ec,#f8eee4,#f3e5eb)';
  onPaletteAppearance();
 }
 function openPalette(){
  paletteTransaction={before:WritingPalette.normalize(state.palette)};palettePreview=WritingPalette.normalize(state.palette);
  showDialog('Your studio colors',paletteFields(palettePreview),()=>{
   state.palette=WritingPalette.normalize(palettePreview);data.preferences.palette=clone(state.palette);palettePreview=null;paletteTransaction=null;onPaletteAppearance();
  },'Save colors');updatePaletteControls();
 }
 function cancelPalette(){if(!paletteTransaction)return;state.palette=paletteTransaction.before;palettePreview=null;paletteTransaction=null;onPaletteAppearance();}
 root.addEventListener('click',event=>{if(event.target.closest('#w-colors'))openPalette();});
 document.getElementById('w-dialog').addEventListener('input',event=>{
  if(!paletteTransaction||!event.target.id.startsWith('w-palette-'))return;const input=event.target,key=input.id.slice('w-palette-'.length);
  if(key==='enabled')palettePreview.enabled=input.checked;else if(key==='mode')palettePreview.mode=input.value;else if(/^hue[123]$/.test(key))palettePreview.hues[Number(key.slice(-1))-1]=Number(input.value);else if(['saturation','lightness','angle'].includes(key))palettePreview[key]=Number(input.value);
  palettePreview=WritingPalette.normalize(palettePreview);const output=document.getElementById(input.id+'-value');if(output)output.textContent=input.value+(['saturation','lightness'].includes(key)?'%':'°');updatePaletteControls();
 });
 document.getElementById('w-dialog').addEventListener('click',event=>{
  if(!paletteTransaction||!event.target.closest('#w-palette-reset'))return;palettePreview=WritingPalette.normalize(null);
  document.querySelector('#w-dialog-fields .w-palette-controls').outerHTML=paletteFields(palettePreview);updatePaletteControls();
 });
 document.getElementById('w-dialog').addEventListener('cancel',cancelPalette);
 document.getElementById('w-dialog').addEventListener('close',cancelPalette);
