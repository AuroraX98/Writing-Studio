 const navigationViews={write:'Studio',plan:'Chapter board',research:'Research',revise:'Revise',export:'Export',characters:'Characters',reading:'Read manuscript',trash:'Trash',assistant:'Assistant',backups:'Folder backups',help:'Help'};
 const navigationContexts=new Map(),navigationWorkspacePositions=new Map();let navigationCurrent=null,navigationReady=false,navigationApplying=false,navigationIndex=0,navigationMax=0,navigationTrigger=null,mobileSettings=false;
 function navigationRoute(){return {project:project().id,chapter:selected().id,view:state.view};}
 function navigationKey(route){return route.project+':'+route.chapter+':'+route.view;}
 function navigationURL(route){return '#studio?'+new URLSearchParams(route).toString();}
 function captureNavigation(){
  if(!navigationCurrent)return;
  const active=document.activeElement,key=navigationKey(navigationCurrent),workspaceTop=main.getBoundingClientRect().top+window.scrollY;
  if(window.scrollY>=workspaceTop-20)navigationWorkspacePositions.set(key,window.scrollY);
  const position=window.scrollY<workspaceTop-20?(navigationWorkspacePositions.get(key)??window.scrollY):window.scrollY;
  navigationContexts.set(navigationKey(navigationCurrent),{scroll:position,search:root.querySelector('#w-search').value,details:[...main.querySelectorAll('details')].map((el,i)=>({key:el.querySelector('summary')?.textContent||String(i),open:el.open})),focus:active?.id||'',selection:active?.id==='w-draft'?{start:active.selectionStart,end:active.selectionEnd}:null});
 }
 function focusWorkspace(draft=false){const el=draft?root.querySelector('#w-draft'):main.querySelector('h2')||main; if(!el)return;if(!el.matches('input,textarea,button,select,a'))el.setAttribute('tabindex','-1');el.focus({preventScroll:true});const bar=root.querySelector('.w-mobile-nav');el.style.scrollMarginTop=bar&&getComputedStyle(bar).display!=='none'?(bar.getBoundingClientRect().height+12)+'px':'';el.scrollIntoView({block:'start',behavior:'auto'});}
 function navigationNotice(message){const el=root.querySelector('#w-navigation-status');if(el)el.textContent=message;}
 function applyNavigationURL(){
  if(!location.hash.startsWith('#studio?'))return false;
  const query=new URLSearchParams(location.hash.slice(8)),p=data.projects.find(item=>item.id===query.get('project'));
  const chapter=p?.chapters.find(item=>item.id===query.get('chapter')),view=query.get('view');
  if(!p||!chapter||!Object.hasOwn(navigationViews,view)){navigationNotice('This saved location is unavailable. Choose a project or chapter from the workspace.');return false;}
  if(p.id!==data.activeProject){syncData();data.activeProject=p.id;activateProject();}
  state.selected=chapter.id;state.view=view;return true;
 }
 function initializeNavigation(){
  navigationApplying=true;applyNavigationURL();navigationApplying=false;
  navigationIndex=Number.isInteger(history.state?.writingStudioIndex)?history.state.writingStudioIndex:0;navigationMax=navigationIndex;
  const route=navigationRoute();history.replaceState({...history.state,writingStudioIndex:navigationIndex},'',navigationURL(route));navigationReady=true;
 }
 function enrichNavigation(){
  const route=navigationRoute(),changed=!navigationCurrent||navigationKey(route)!==navigationKey(navigationCurrent),previous=navigationCurrent;
  if(!root.querySelector('#w-navigation-tools')){
   root.querySelector('.w-nav').insertAdjacentHTML('afterend','<div id="w-navigation-tools" class="w-navigation-tools" aria-label="Workspace navigation"><button type="button" id="w-nav-back">Back</button><button type="button" id="w-nav-forward">Forward</button><button type="button" id="w-copy-location">Copy location link</button><span id="w-location"></span><span id="w-navigation-status" role="status"></span></div>');
   root.insertAdjacentHTML('afterbegin','<a class="w-skip-link" href="#w-main" id="w-skip-workspace">Skip to workspace</a><a class="w-skip-link" href="#w-draft" id="w-skip-draft">Skip to draft</a><div class="w-mobile-nav"><strong id="w-mobile-project"></strong><button type="button" id="w-mobile-settings">Project &amp; appearance</button><label for="w-mobile-view">Workspace<select id="w-mobile-view"></select></label><button type="button" id="w-jump-draft">Write</button><span id="w-mobile-save" role="status"></span></div>');
   const copySaveStatus=()=>{root.querySelector('#w-mobile-save').textContent=root.querySelector('#w-save-status').textContent;};copySaveStatus();new MutationObserver(copySaveStatus).observe(root.querySelector('#w-save-status'),{childList:true,subtree:true,characterData:true});
   const nav=root.querySelector('.w-nav');for(const view of ['backups','help'])if(!nav.querySelector('[data-view="'+view+'"]'))nav.insertAdjacentHTML('beforeend','<button type="button" data-view="'+view+'">'+navigationViews[view]+'</button>');
  }
  document.title=project().title+' · '+(state.view==='write'?selected().title:navigationViews[state.view])+' · Writing Studio';
  const h=main.querySelector('h2');if(h){h.setAttribute('tabindex','-1');if(state.view==='write')h.setAttribute('aria-label',selected().title||'Untitled chapter');}
  main.setAttribute('aria-label',navigationViews[state.view]+' · '+project().title);root.querySelector('#w-location').textContent=navigationViews[state.view]+' · '+project().title;
  root.querySelector('#w-mobile-project').textContent='Writing Studio · '+project().title;
  const mobile=root.querySelector('#w-mobile-view');mobile.innerHTML=Object.entries(navigationViews).map(([id,label])=>'<option value="'+id+'" '+(id===state.view?'selected':'')+'>'+label+'</option>').join('');
  root.querySelectorAll('[data-view]').forEach(b=>{b.setAttribute('aria-pressed',b.dataset.view===state.view);if(b.closest('.w-nav'))b.setAttribute('aria-current',b.dataset.view===state.view?'page':'false');});
  root.classList.toggle('w-mobile-settings-hidden',!mobileSettings);root.querySelector('#w-mobile-settings').setAttribute('aria-expanded',String(mobileSettings));
  if(changed&&navigationReady&&!navigationApplying&&previous){navigationIndex++;navigationMax=navigationIndex;history.pushState({writingStudioIndex:navigationIndex},'',navigationURL(route));}
  else if(navigationReady&&!navigationApplying)history.replaceState({...history.state,writingStudioIndex:navigationIndex},'',navigationURL(route));
  root.querySelector('#w-nav-back').disabled=navigationIndex<=0;root.querySelector('#w-nav-forward').disabled=navigationIndex>=navigationMax;
  if(changed){
   const saved=navigationContexts.get(navigationKey(route));root.querySelector('#w-search').value=saved?.search||'';tree();
   if(saved)for(const el of main.querySelectorAll('details')){const item=saved.details.find(x=>x.key===el.querySelector('summary')?.textContent);if(item)el.open=item.open;}
   const draftTarget=navigationTrigger?.draft||['w-jump-draft','w-skip-draft'].includes(navigationTrigger?.id);
   const shouldFocus=!!previous&&(navigationApplying||navigationTrigger);
   if(shouldFocus){if(saved&&!draftTarget){window.scrollTo(0,saved.scroll);const field=saved.focus&&root.querySelector('#'+CSS.escape(saved.focus));if(field&&main.contains(field)){field.focus({preventScroll:true});if(saved.selection&&field.id==='w-draft')field.setSelectionRange(saved.selection.start,saved.selection.end);}else {main.setAttribute('tabindex','-1');main.focus({preventScroll:true});}}else focusWorkspace(draftTarget||state.view==='write'&&navigationTrigger?.draft);}
  }else if(navigationTrigger&&document.activeElement===document.body){const replacement=navigationTrigger.id&&document.getElementById(navigationTrigger.id);if(replacement)replacement.focus({preventScroll:true});else focusWorkspace(false);}
  navigationCurrent=route;navigationTrigger=null;
 }
 root.addEventListener('click',event=>{
  const button=event.target.closest('button,a');if(!button)return;captureNavigation();navigationTrigger={id:button.id,draft:!!button.dataset.open||!!button.dataset.editReading||button.id==='w-jump-draft'||button.id==='w-skip-draft'};
  if(button.id==='w-skip-workspace'||button.id==='w-skip-draft'){event.preventDefault();event.stopImmediatePropagation();if(button.id==='w-skip-draft'&&state.view!=='write'){state.view='write';render();}else focusWorkspace(button.id==='w-skip-draft');}
  else if(button.id==='w-jump-draft'){event.stopImmediatePropagation();state.view='write';render();focusWorkspace(true);}
  else if(button.id==='w-mobile-settings'){event.stopImmediatePropagation();mobileSettings=!mobileSettings;root.classList.toggle('w-mobile-settings-hidden',!mobileSettings);button.setAttribute('aria-expanded',String(mobileSettings));}
  else if(button.id==='w-nav-back'){event.stopImmediatePropagation();history.back();}
  else if(button.id==='w-nav-forward'){event.stopImmediatePropagation();history.forward();}
  else if(button.id==='w-copy-location'){event.stopImmediatePropagation();navigator.clipboard?.writeText(location.href).then(()=>navigationNotice('Location link copied. Open it in this browser and workspace.'),()=>navigationNotice('Copy this location from the browser address bar.'));}
 },true);
 root.addEventListener('change',event=>{captureNavigation();navigationTrigger={id:event.target.id};if(event.target.id==='w-mobile-view'){event.stopImmediatePropagation();state.view=event.target.value;render();scheduleSave();if(state.view==='backups')loadFolderFiles();}},true);
 root.addEventListener('input',event=>{if(event.target.id==='w-title'){main.querySelector('h2')?.setAttribute('aria-label',event.target.value||'Untitled chapter');document.title=project().title+' · '+event.target.value+' · Writing Studio';}});
 document.getElementById('w-dialog').addEventListener('close',()=>{if(document.activeElement===document.body)focusWorkspace(state.view==='write');});
 window.addEventListener('popstate',event=>{captureNavigation();navigationApplying=true;navigationTrigger={id:'history'};navigationIndex=Number.isInteger(event.state?.writingStudioIndex)?event.state.writingStudioIndex:0;if(applyNavigationURL()){render();scheduleSave();}navigationApplying=false;});
 window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#studio?')&&location.hash!==navigationURL(navigationRoute())){captureNavigation();navigationApplying=true;navigationTrigger={id:'location-link'};if(applyNavigationURL()){render();scheduleSave();}navigationApplying=false;}});

 window.addEventListener('scroll',()=>{if(navigationCurrent&&window.scrollY>=main.getBoundingClientRect().top+window.scrollY-20)navigationWorkspacePositions.set(navigationKey(navigationCurrent),window.scrollY);},{passive:true});
