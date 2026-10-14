 // The editor retains its native textarea and existing storage/formatting model.
 let studioReady=false,studioGlow=null,studioFontLabel=null;
 let studioPanel='notes',studioChapters=window.innerWidth>900,studioTools=window.innerWidth>1100;
 function studioMenu(id,label){const el=document.createElement('details');el.id=id;el.className='w-menu';el.innerHTML='<summary>'+label+'</summary><div class="w-menu-panel"></div>';return el;}
 function initializeStudio(){
  const header=root.querySelector('.w-top'),brand=header.querySelector('.w-brand');
  const projectMenu=studioMenu('w-project-menu','Project'),workspaceMenu=studioMenu('w-workspace-menu','Workspace: Studio'),appearanceMenu=studioMenu('w-appearance-menu','Appearance');
  const projectPanel=projectMenu.lastElementChild,appearancePanel=appearanceMenu.lastElementChild;
  for(const id of ['w-project','w-new-project','w-rename-project','w-type','w-import','w-backup','w-folder-backups','w-delete-project']){
   const el=root.querySelector('#'+id);projectPanel.append(el.matches('select')?el.closest('label'):el);
  }
  projectPanel.insertAdjacentHTML('beforeend','<button type="button" data-view="export">Export manuscript</button><button type="button" data-view="trash">Trash</button>');
  for(const id of ['w-theme','w-colors','w-transparency-control']){const el=root.querySelector('#'+id);appearancePanel.append(el.matches('select')?el.closest('label'):el);}
  const theme=appearancePanel.querySelector('#w-theme');theme.insertAdjacentHTML('afterbegin','<option value="mint">Mint charcoal</option>');
  appearancePanel.insertAdjacentHTML('beforeend','<label class="w-check"><input type="checkbox" id="w-typing-glow"><span>Typing glow</span></label><p class="w-secondary">A mint glow fades after each letter. Animation is off when your device requests reduced motion.</p><div id="w-font-home"></div>');
  studioFontLabel=root.querySelector('#w-font').closest('label');appearancePanel.querySelector('#w-font-home').append(studioFontLabel);
  const groups=[['Write',['write','reading']],['Plan',['plan','characters','research']],['Review',['revise','assistant']],['Help',['help']]];
  workspaceMenu.lastElementChild.innerHTML=groups.map(([title,views])=>'<section class="w-menu-group"><h3>'+title+'</h3>'+views.map(view=>'<button type="button" data-view="'+view+'">'+navigationViews[view]+'</button>').join('')+'</section>').join('');
  const actions=document.createElement('div');actions.className='w-top-actions';
  actions.append(root.querySelector('#w-save-status'),root.querySelector('#w-focus'));
  actions.insertAdjacentHTML('beforeend','<button type="button" id="w-studio-chapters" aria-controls="w-chapters-sidebar">Chapters</button><button type="button" id="w-studio-tools" aria-controls="w-context">Chapter tools</button>');
  header.replaceChildren(brand,projectMenu,workspaceMenu,appearanceMenu,actions);
  root.querySelector('.w-tree').id='w-chapters-sidebar';
  root.querySelector('.w-nav').hidden=true;root.querySelector('.w-projectbar').hidden=true;root.querySelector('.w-folderbar').hidden=true;
  root.querySelector('.w-footer').append(root.querySelector('#w-folder-status'));
  studioPanel=state.contextTab==='guide'&&!state.hintsVisible?'notes':state.contextTab;
  studioReady=true;
 }
 function prepareStudioRender(){
  if(!studioReady)return;
  studioGlow?.destroy();studioGlow=null;
  root.querySelector('#w-font-home').append(studioFontLabel);
  // Existing chapter tools still render and save through their original handlers.
  state.contextTab=['notes','ideas','guide'].includes(studioPanel)?studioPanel:'notes';
  if(studioPanel==='guide')state.hintsVisible=true;
 }
 function studioAppearance(){
  root.classList.toggle('w-mint',state.theme==='mint');document.getElementById('w-dialog').classList.toggle('w-mint',state.theme==='mint');
  root.style.colorScheme=['dark','mint'].includes(state.theme)?'dark':'light';
  document.getElementById('w-dialog').style.colorScheme=root.style.colorScheme;
 }
 function studioVisibility(){
  const writing=state.view==='write';
  root.classList.toggle('w-writing-view',writing);
  root.classList.toggle('w-chapters-hidden',!studioChapters||state.focus);
  root.classList.toggle('w-tools-hidden',!studioTools||state.focus||!writing);
  root.querySelector('.w-tree').hidden=!studioChapters||state.focus;
  context.hidden=!studioTools||state.focus||!writing;
  root.querySelector('#w-studio-chapters').setAttribute('aria-expanded',String(studioChapters&&!state.focus));
  root.querySelector('#w-studio-tools').setAttribute('aria-expanded',String(studioTools&&!state.focus&&writing));
  root.querySelector('#w-studio-tools').hidden=!writing;
  // Supersede the previous breakpoint-specific navigation with one shared header.
  root.classList.remove('w-no-context','w-mobile-settings-hidden');
  root.querySelector('.w-mobile-nav')?.setAttribute('hidden','');
 }
 function enrichStudio(){
  if(!studioReady)return;
  root.querySelector('#w-project-menu>summary').textContent=project().title;
  root.querySelector('#w-workspace-menu>summary').textContent='Workspace: '+navigationViews[state.view];
  root.querySelector('#w-typing-glow').checked=state.typingGlow!==false;
  root.querySelectorAll('.w-menu [data-view]').forEach(el=>el.setAttribute('aria-current',el.dataset.view===state.view?'page':'false'));
  root.querySelector('#w-font-home').hidden=state.view==='write';
  const navigation=root.querySelector('#w-navigation-tools');if(navigation)root.querySelector('.w-footer').append(navigation);
  studioVisibility();studioAppearance();
  if(state.view!=='write')return;
  const draft=main.querySelector('#w-draft'),toolbar=main.querySelector('.w-writing-toolbar'),settings=main.querySelector('.w-metadata');
  settings.append(main.querySelector('#w-delete-chapter'));
  main.querySelector('#w-toggle-context')?.remove();main.querySelector('#w-toggle-hints')?.remove();
  const tools=studioMenu('w-writing-tools','Writing tools');tools.classList.add('w-writing-tools');
  for(const el of [main.querySelector('.w-typing-settings'),main.querySelector('#w-dictionary'),main.querySelector('#w-thesaurus'),main.querySelector('.w-shortcuts')])if(el)tools.lastElementChild.append(el);
  const size=main.querySelector('#w-prose').closest('label'),alignment=main.querySelector('#w-alignment').closest('label'),spacing=main.querySelector('#w-spacing').closest('label');
  toolbar.replaceChildren(main.querySelector('#w-editor-undo'),main.querySelector('#w-editor-redo'),studioFontLabel,size,main.querySelector('#w-bold'),main.querySelector('#w-italic'),alignment,spacing,tools);
  const status=main.querySelector('#w-formatting-status');status.textContent='';
  const outline=main.querySelector('.w-outline');
  // Only one copy of each editable field exists, so existing input handlers and IDs remain valid.
  context.querySelector('.w-board-tabs')?.remove();
  if(studioPanel==='outline'){
   context.replaceChildren(outline);outline.open=true;
  }else if(studioPanel==='assistant'){
   context.innerHTML=assistantView();outline?.remove();
  }else outline?.remove();
  context.insertAdjacentHTML('afterbegin','<div class="w-panel-heading"><label for="w-panel-choice">Chapter tools<select id="w-panel-choice"><option value="notes">Chapter notes</option><option value="outline">Outline</option><option value="guide">Hints</option><option value="ideas">Ideas &amp; saved passages</option><option value="assistant">Assistant</option></select></label><button type="button" id="w-close-tools" aria-label="Close chapter tools">×</button></div>');
  context.querySelector('#w-panel-choice').value=studioPanel;
  // Place all toolbar controls directly against the draft. Help/status follows it.
  draft.before(toolbar);draft.after(status);
  for(const id of ['w-new-project','w-ai-generate','w-download'])root.querySelector('#'+id)?.classList.add('w-primary');
  const typing=main.querySelector('.w-typing-tools');status.after(typing);
  main.querySelector('.w-sequence')?.remove();
  studioGlow=globalThis.WritingGlow?.attach(draft,state.typingGlow!==false);
  if(studioPanel==='assistant')updateAssistantStatus(assistantClient.state);
  fitText();
 }
 function closeStudioMenus(except=null){root.querySelectorAll('details.w-menu[open]').forEach(menu=>{if(menu!==except)menu.open=false;});}
 function captureStudioSelection(){
  if(state.view!=='write'||studioPanel!=='assistant')return;
  const draft=root.querySelector('#w-draft');if(!draft)return;
  const c=selected(),work=assistantWorkspace();
  work.selection=draft.selectionEnd>draft.selectionStart?{projectId:project().id,chapterId:c.id,start:draft.selectionStart,end:draft.selectionEnd,text:c.text,formatFingerprint:WritingRevision.formatFingerprint(c),contextFingerprint:assistantContextFingerprint()}:null;
  const button=root.querySelector('#w-ai-use-selection');if(button)button.disabled=!work.selection;
 }
 root.addEventListener('select',event=>{if(event.target.id==='w-draft')captureStudioSelection();},true);
 root.addEventListener('input',event=>{if(event.target.id==='w-draft')queueMicrotask(()=>{studioGlow?.refresh();captureStudioSelection();});});
 root.addEventListener('click',event=>{if(event.target.closest('#w-ai-use-selection'))captureStudioSelection();},true);
 root.addEventListener('toggle',event=>{
  const menu=event.target;if(!menu.matches?.('details.w-menu'))return;
  menu.querySelector('summary').setAttribute('aria-expanded',String(menu.open));
  if(menu.open)closeStudioMenus(menu);
 },true);
 document.addEventListener('pointerdown',event=>{if(!event.target.closest('.w-menu'))closeStudioMenus();});
 document.addEventListener('focusin',event=>{if(!event.target.closest('.w-menu'))closeStudioMenus();});
 root.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
   const menu=event.target.closest('details.w-menu[open]');if(menu){event.preventDefault();event.stopPropagation();menu.open=false;menu.querySelector('summary').focus();}
  }
 });
 root.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.id==='w-studio-chapters'){studioChapters=!studioChapters;studioVisibility();if(studioChapters)root.querySelector('#w-search').focus();}
  else if(button.id==='w-studio-tools'||button.id==='w-close-tools'){studioTools=button.id==='w-close-tools'?false:!studioTools;studioVisibility();fitText();(studioTools?root.querySelector('#w-panel-choice'):root.querySelector('#w-studio-tools')).focus();}
  if(button.closest('.w-menu')&&(button.dataset.view||['w-new-project','w-rename-project','w-delete-project','w-import','w-backup','w-folder-backups','w-colors','w-dictionary','w-thesaurus'].includes(button.id))){
   const summary=button.closest('.w-menu').querySelector('summary');closeStudioMenus();queueMicrotask(()=>{if(document.activeElement===button||document.activeElement===document.body)summary.focus();});
  }
  if(button.id==='w-save-guide'){const before=selected().planOutline;setTimeout(()=>{if(selected().planOutline!==before){studioPanel='outline';studioTools=true;render();context.querySelector('#w-outline')?.focus();}});}
 });
 root.addEventListener('change',event=>{
  if(event.target.id==='w-panel-choice'){
   const range=selectionForDraft();if(event.target.value==='assistant'&&range&&range.end>range.start){const work=assistantWorkspace(),c=selected();work.selection={projectId:project().id,chapterId:c.id,start:range.start,end:range.end,text:c.text,formatFingerprint:WritingRevision.formatFingerprint(c),contextFingerprint:assistantContextFingerprint()};}
   studioPanel=event.target.value;render();context.querySelector('#w-panel-choice').focus();
  }else if(event.target.id==='w-typing-glow'){state.typingGlow=event.target.checked;studioGlow?.setEnabled(state.typingGlow);scheduleSave();}
  queueMicrotask(()=>{studioAppearance();studioGlow?.refresh();});
 });

