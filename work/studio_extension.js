 // The editor retains its native textarea and existing storage/formatting model.
 let studioReady=false,studioGlow=null,studioFontLabel=null;
 let studioChapters=window.innerWidth>900;
 let studioDrawer=null,studioDraftReturn=null;
 const narrowStudio=()=>window.matchMedia('(max-width:900px)').matches;
 function studioMenu(id,label){const el=document.createElement('details');el.id=id;el.className='w-menu';el.innerHTML='<summary>'+label+'</summary><div class="w-menu-panel"></div>';return el;}
 function initializeStudio(){
  const header=root.querySelector('.w-top'),brand=header.querySelector('.w-brand');
  const projectMenu=studioMenu('w-project-menu','Project'),workspaceMenu=studioMenu('w-workspace-menu','Workspace: Studio'),appearanceMenu=studioMenu('w-appearance-menu','Appearance');
  const projectPanel=projectMenu.lastElementChild,appearancePanel=appearanceMenu.lastElementChild;
  for(const id of ['w-project','w-new-project','w-rename-project','w-type','w-import','w-backup','w-folder-backups','w-delete-project']){
   const el=root.querySelector('#'+id);projectPanel.append(el.matches('select')?el.closest('label'):el);
  }
  projectPanel.querySelector('#w-type').closest('label').insertAdjacentHTML('afterend','<label id="w-project-genre-label" for="w-project-genre"></label>');
  projectPanel.insertAdjacentHTML('beforeend','<button type="button" data-view="export">Export manuscript</button><button type="button" data-view="trash">Trash</button>');
  projectPanel.insertAdjacentHTML('beforeend','<button type="button" id="w-save-details">Save details</button>');
  for(const id of ['w-theme','w-colors','w-transparency-control']){const el=root.querySelector('#'+id);appearancePanel.append(el.matches('select')?el.closest('label'):el);}
  const theme=appearancePanel.querySelector('#w-theme');theme.insertAdjacentHTML('afterbegin','<option value="mint">Mint charcoal</option>');
  appearancePanel.insertAdjacentHTML('beforeend','<label class="w-check"><input type="checkbox" id="w-typing-glow"><span>Typing glow</span></label><p class="w-secondary">A mint glow fades after each letter. Animation is off when your device requests reduced motion.</p><div id="w-font-home"></div>');
  studioFontLabel=root.querySelector('#w-font').closest('label');appearancePanel.querySelector('#w-font-home').append(studioFontLabel);
  const groups=[['Write',['write','reading']],['Plan',['characters','research']],['Help',['help']]];
  workspaceMenu.lastElementChild.innerHTML=groups.map(([title,views])=>'<section class="w-menu-group"><h3>'+title+'</h3>'+views.map(view=>'<button type="button" data-view="'+view+'">'+navigationViews[view]+'</button>').join('')+'</section>').join('');
  const actions=document.createElement('div');actions.className='w-top-actions';
  actions.append(root.querySelector('#w-focus'));
  actions.insertAdjacentHTML('beforeend','<button type="button" id="w-studio-chapters" aria-controls="w-chapters-sidebar">Chapters</button>');
  header.replaceChildren(brand,projectMenu,workspaceMenu,appearanceMenu,actions);
  const notices=document.createElement('div');notices.className='w-save-notices';
  notices.append(root.querySelector('#w-save-status'),root.querySelector('#w-folder-status'));
  notices.insertAdjacentHTML('beforeend','<button type="button" id="w-rescue-backup">Download a backup</button>');
  header.after(notices);
  root.querySelector('.w-tree').id='w-chapters-sidebar';
  root.querySelector('.w-nav').hidden=true;root.querySelector('.w-projectbar').hidden=true;root.querySelector('.w-folderbar').hidden=true;
  studioChapters=data.preferences.studioChapters??studioChapters;
  root.querySelector('.w-tree').insertAdjacentHTML('afterbegin','<button type="button" id="w-close-chapters" class="w-drawer-close" aria-label="Close chapter list">Close</button>');
  root.insertAdjacentHTML('beforeend','<div class="w-drawer-backdrop" hidden></div>');
  const measureHeader=()=>root.style.setProperty('--w-header-height',Math.ceil(header.getBoundingClientRect().height)+'px');
  new ResizeObserver(measureHeader).observe(header);measureHeader();
  window.matchMedia('(max-width:900px)').addEventListener('change',()=>{studioDrawer=null;studioVisibility();fitText();});
  studioReady=true;
 }
 function prepareStudioRender(){
  if(!studioReady)return;
  navigationViews.reading=isJournal()?'Read journal':'Read manuscript';
  studioGlow?.destroy();studioGlow=null;
  root.querySelector('#w-font-home').append(studioFontLabel);
 }
 function studioAppearance(){
  root.classList.toggle('w-mint',state.theme==='mint');document.getElementById('w-dialog').classList.toggle('w-mint',state.theme==='mint');
  root.style.colorScheme=['dark','mint'].includes(state.theme)?'dark':'light';
  document.getElementById('w-dialog').style.colorScheme=root.style.colorScheme;
 }
 function studioVisibility(){
  const writing=state.view==='write';
  const narrow=narrowStudio(),showChapters=!state.focus&&(narrow?studioDrawer==='chapters':studioChapters);
  root.classList.toggle('w-writing-view',writing);
  root.classList.toggle('w-chapters-hidden',!showChapters);
  root.querySelector('.w-tree').hidden=!showChapters;
  root.querySelector('#w-studio-chapters').setAttribute('aria-expanded',String(showChapters));
  const drawerOpen=narrow&&showChapters;
  root.classList.toggle('w-drawer-open',drawerOpen);
  root.querySelector('.w-drawer-backdrop').hidden=!drawerOpen;
  for(const el of [root.querySelector('.w-top'),main,root.querySelector('.w-footer')])el.inert=drawerOpen;
  for(const [el,open,label] of [[root.querySelector('.w-tree'),showChapters,entryHeading(true)]]){
   if(narrow&&open){el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label',label);}
   else{el.removeAttribute('role');el.removeAttribute('aria-modal');}
  }
  // Supersede the previous breakpoint-specific navigation with one shared header.
  root.classList.remove('w-no-context','w-mobile-settings-hidden');
  root.querySelector('.w-mobile-nav')?.setAttribute('hidden','');
 }
 function enrichStudio(){
  if(!studioReady)return;
  root.querySelector('#w-project-menu>summary').textContent=project().title;
  root.querySelector('#w-project-genre-label').innerHTML=`${genreLabel(state.type)}<select id="w-project-genre">${genreOptions(state.type,state.genres[state.type])}</select>`;
  root.querySelector('#w-workspace-menu>summary').textContent='Workspace: '+navigationViews[state.view];
  root.querySelector('#w-typing-glow').checked=state.typingGlow!==false;
  root.querySelectorAll('.w-menu [data-view]').forEach(el=>el.setAttribute('aria-current',el.dataset.view===state.view?'page':'false'));
  root.querySelector('#w-font-home').hidden=state.view==='write';
  const navigation=root.querySelector('#w-navigation-tools');if(navigation)root.querySelector('.w-footer').append(navigation);
  studioVisibility();studioAppearance();
  if(state.view!=='write'){enrichJournal();return;}
  const draft=main.querySelector('#w-draft'),toolbar=main.querySelector('.w-writing-toolbar');
  const tools=studioMenu('w-writing-tools','Writing tools');tools.classList.add('w-writing-tools');
  for(const el of [main.querySelector('.w-typing-settings'),main.querySelector('#w-dictionary'),main.querySelector('#w-thesaurus'),main.querySelector('.w-shortcuts')])if(el)tools.lastElementChild.append(el);
  tools.lastElementChild.append(main.querySelector('#w-delete-chapter'));
  const size=main.querySelector('#w-prose').closest('label'),alignment=main.querySelector('#w-alignment').closest('label'),spacing=main.querySelector('#w-spacing').closest('label');
  const format=studioMenu('w-format-menu','Format');
  format.lastElementChild.append(studioFontLabel,size,alignment,spacing);
  format.lastElementChild.insertAdjacentHTML('beforeend','<p class="w-secondary">Select words for Bold or Italic. Formatting appears in Preview and exports; the typing area stays plain text.</p>');
  toolbar.replaceChildren(main.querySelector('#w-editor-undo'),main.querySelector('#w-editor-redo'),main.querySelector('#w-bold'),main.querySelector('#w-italic'),format,tools);
  toolbar.insertAdjacentHTML('beforeend','<button type="button" id="w-open-preview">Preview</button>');
  const status=main.querySelector('#w-formatting-status');status.textContent='';status.classList.add('w-visually-hidden');
  // Place all toolbar controls directly against the draft. Help/status follows it.
  draft.before(toolbar);draft.after(status);
  for(const id of ['w-new-project','w-download'])root.querySelector('#'+id)?.classList.add('w-primary');
  const typing=main.querySelector('.w-typing-tools');status.after(typing);
  main.querySelector('.w-sequence')?.remove();
  studioGlow=globalThis.WritingGlow?.attach(draft,state.typingGlow!==false);
  enrichJournal();updateFormattingState();
  fitText();
 }
 function updateFormattingState(){
  const draft=main.querySelector('#w-draft');if(!draft)return;
  const range=selectionForDraft(),c=selected();
  const runs=range&&range.end>range.start?WritingTextTools.runs(c.text,c.formats).filter(run=>run.end>range.start&&run.start<range.end):[];
  for(const key of ['bold','italic']){
   const button=main.querySelector('#w-'+key);if(!button)continue;
   const enabled=runs.filter(run=>run[key]).length;
   button.setAttribute('aria-pressed',!enabled?'false':enabled===runs.length?'true':'mixed');
  }
 }
 function openStudioDrawer(){
  const draft=root.querySelector('#w-draft');studioDraftReturn=draft?{id:selected().id,start:draft.selectionStart,end:draft.selectionEnd,x:scrollX,y:scrollY}:null;
  studioDrawer='chapters';studioVisibility();fitText();
  root.querySelector('#w-search')?.focus({preventScroll:true});
 }
 function closeStudioDrawer(returnToDraft=true){
  studioDrawer=null;studioVisibility();
  const draft=root.querySelector('#w-draft'),saved=studioDraftReturn;studioDraftReturn=null;
  if(returnToDraft&&draft&&saved?.id===selected().id){draft.focus({preventScroll:true});draft.setSelectionRange(saved.start,saved.end);window.scrollTo(saved.x,saved.y);}
  else if(returnToDraft)root.querySelector('#w-studio-chapters').focus({preventScroll:true});
 }
 root.addEventListener('input',event=>{if(event.target.id==='w-draft')queueMicrotask(()=>studioGlow?.refresh());});
 function closeStudioMenus(except=null){root.querySelectorAll('details.w-menu[open]').forEach(menu=>{if(menu!==except)menu.open=false;});}
 root.addEventListener('toggle',event=>{
  const menu=event.target;if(!menu.matches?.('details.w-menu'))return;
  menu.querySelector('summary').setAttribute('aria-expanded',String(menu.open));
  if(menu.open)closeStudioMenus(menu);
 },true);
 document.addEventListener('pointerdown',event=>{if(!event.target.closest('.w-menu'))closeStudioMenus();});
 document.addEventListener('focusin',event=>{if(!event.target.closest('.w-menu'))closeStudioMenus();});
 root.addEventListener('keydown',event=>{
  if(studioDrawer&&narrowStudio()){
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeStudioDrawer();return;}
   if(event.key==='Tab'){
    const panel=root.querySelector('.w-tree');
    const focusable=[...panel.querySelectorAll('button,input,textarea,select,a,summary')].filter(el=>!el.disabled&&el.getClientRects().length);
    const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
   }
  }
  if(event.key==='Escape'){
   const menu=event.target.closest('details.w-menu[open]');if(menu){event.preventDefault();event.stopPropagation();menu.open=false;menu.querySelector('summary').focus();}
  }
 });
 root.addEventListener('click',event=>{
  if(event.target.matches('.w-drawer-backdrop')){closeStudioDrawer();return;}
  const button=event.target.closest('button');if(!button)return;
  if(button.id==='w-studio-chapters'){if(narrowStudio())openStudioDrawer();else{studioChapters=!studioChapters;studioVisibility();if(studioChapters)root.querySelector('#w-search').focus();}scheduleSave();}
  else if(button.id==='w-close-chapters')closeStudioDrawer();
  else if(button.dataset.chapter&&studioDrawer){closeStudioDrawer(false);root.querySelector('#w-draft')?.focus({preventScroll:true});}
  else if(button.id==='w-rescue-backup')backup();
  else if(button.id==='w-save-details'){showDialog('Save details','<p>Changes autosave in the background after a short pause. Ordinary saving never changes your writing layout.</p><p>'+escape(root.querySelector('#w-save-status').textContent)+'</p><p>'+escape(root.querySelector('#w-folder-status').textContent)+'</p>',()=>{},'Close',{render:false});}
  else if(button.id==='w-open-preview'){showDialog('Formatted preview',`<div class="w-reading-text" style="text-align:${selected().alignment||'left'};line-height:${selected().lineSpacing||1.7}">${WritingTextTools.html(selected().text,selected().formats)||'Start writing to see a preview.'}</div>`,()=>{},'Back to writing',{render:false});}
  if(button.closest('.w-menu')&&(button.dataset.view||['w-save-details','w-new-project','w-rename-project','w-delete-project','w-delete-chapter','w-import','w-backup','w-folder-backups','w-colors','w-dictionary','w-thesaurus'].includes(button.id))){
   const summary=button.closest('.w-menu').querySelector('summary');closeStudioMenus();queueMicrotask(()=>{if(document.activeElement===button||document.activeElement===document.body)summary.focus();});
  }
 });
 root.addEventListener('change',event=>{
  if(event.target.id==='w-typing-glow'){state.typingGlow=event.target.checked;studioGlow?.setEnabled(state.typingGlow);scheduleSave();}
  queueMicrotask(()=>{studioAppearance();studioGlow?.refresh();});
 });

