 let freshWorkspace=false,folderHold=true,folderConnected=false,folderFiles=[],folderLoading=false,replacePreview=null,pendingFolderSave=false;
 const editHistory=new Map();let draftSelection=null,typingInput=false,thesaurusSelection=null,thesaurusChoices=[];
 const folderBackups=WritingLocalBackup.createClient({onStatus:updateFolderStatus,onConflict:updateFolderStatus});
 function updateFolderStatus(status){
  if(status.available&&!folderConnected){folderConnected=true;if(status.lastBackup)folderHold=true;}
  const el=root.querySelector('#w-folder-status');if(!el)return;
  const date=status.lastBackup?new Date(status.lastBackup).toLocaleString():'';
  el.textContent=status.conflict?'Folder backup paused · another window saved changes':status.error?'Folder backup needs attention · '+status.error:status.available?(folderHold?'Folder copy differs · open Folder backups to choose a workspace':date?'Folder backup · '+date:'Folder backup ready · waiting for an edit'):'Folder backups need the local launcher';
  el.classList.toggle('w-error',!!status.error||!!status.conflict);
  if(state.view==='backups')renderFolderDetails();
 }
 async function connectFolderBackups(){
  const status=await folderBackups.connect();
  if(status.available&&status.lastBackup){try{const saved=WritingStore.parse(await folderBackups.read('latest.json'));folderHold=WritingStore.serialize(saved)!==WritingStore.serialize(data);}catch(_){folderHold=true;}}
  else folderHold=false;
  updateFolderStatus(folderBackups.state);if(!folderHold&&pendingFolderSave)queueFolderBackup();
 }
 function queueFolderBackup(){pendingFolderSave=true;try{if(!folderHold&&!blocked&&folderBackups.state.available){pendingFolderSave=false;folderBackups.queue(WritingStore.serialize(data)).catch(()=>{});}}catch(_){/* Browser save reports validation failures. */}}
 function addBackupCopies(imported){
  if(blockReason==='concurrent')throw new Error('Another window changed this workspace. Download your current backup, then reload before importing.');
  const words=[...new Set([...(data.preferences.personalDictionary||[]),...(imported.preferences.personalDictionary||[])])];
  const removed=[...new Map([...(data.preferences.dictionaryTrash||[]),...(imported.preferences.dictionaryTrash||[])].map(item=>[JSON.stringify([item.word,item.deletedAt]),clone(item)])).values()];
  if(words.length>5000||removed.length>5000)throw new Error('This import would exceed the dictionary limit. Keep the backup file and reduce the dictionary before importing.');
  const first=data.projects.length;
  for(const original of imported.projects){const copy=clone(original);remapProject(copy);copy.title+=' (imported)';data.projects.push(copy);}
  for(const item of imported.trashProjects||[]){const copy=clone(item);copy.id=uid();remapProject(copy.item);data.trashProjects.push(copy);}
  data.preferences.personalDictionary=words;data.preferences.dictionaryTrash=removed;
  blocked=false;blockReason=null;freshWorkspace=false;folderHold=false;data.activeProject=data.projects[first].id;activateProject();
 }
 function backupsView(){return `<h2>Folder backups</h2><p class="w-secondary">The local launcher keeps complete project copies on this computer. Browser autosave and folder backups have separate status indicators.</p><div id="w-folder-details"></div><hr><button id="w-backup-view">Download a portable backup</button><p class="w-secondary">Keep another copy on a different drive for protection against a lost or damaged computer.</p>`;}
 function renderFolderDetails(){
  const el=main.querySelector('#w-folder-details');if(!el)return;const s=folderBackups.state;
  el.innerHTML=!s.available?'<p>Open the app using the Mac or Windows launcher to enable automatic folder backups. The standalone HTML edition supports downloaded backups.</p>':`<p><strong>Backup folder</strong></p><p class="w-path">${escape(s.folder||'')}</p><p>${s.lastBackup?'Last successful backup: '+escape(new Date(s.lastBackup).toLocaleString()):'No folder backup yet.'}</p>${s.error?`<p role="alert" class="w-error">${escape(s.error)}</p>`:''}${folderHold?'<p>The saved folder copy differs from this browser’s workspace. Import it as separate project copies, or choose to back up the workspace currently open here.</p><button data-read-backup="latest.json">Import latest backup</button><button id="w-folder-fresh">Use this workspace</button>':'<button id="w-folder-now">Back up now</button>'}${s.conflict?'<button id="w-folder-reconnect">Reconnect to folder backups</button>':''}<button id="w-folder-refresh">Refresh backup list</button><h3>Recover a copy</h3><p class="w-secondary">Imports add separate project copies. The listed older copies remain in the folder.</p>${folderLoading?'<p>Loading copies…</p>':folderFiles.map(file=>`<div class="w-backup-item"><span>${escape(file.name)}<br><span class="w-secondary">${escape(file.date?new Date(file.date).toLocaleString():'')}</span></span><button data-read-backup="${escape(file.name)}">Import this copy</button></div>`).join('')||'<p>No copies listed yet.</p>'}`;
 }
 async function loadFolderFiles(){folderLoading=true;renderFolderDetails();try{folderFiles=await folderBackups.list();}catch(error){saveStatus('Could not list folder backups: '+error.message,true);}finally{folderLoading=false;renderFolderDetails();}}
 async function recoverFolder(name){try{const imported=WritingStore.parse(await folderBackups.read(name));confirmAction('Import folder backup?','Projects will be added as separate copies. Your current work stays available.',()=>addBackupCopies(imported),'Import backup');}catch(error){saveStatus('Could not recover this copy: '+error.message,true);}}
 function isPersonalWord(word){return (data?.preferences.personalDictionary||[]).some(item=>item.toLocaleLowerCase()===word.toLocaleLowerCase());}
 function dictionaryFields(){return `<p class="w-secondary">These words are protected from the app’s typing corrections. Browser spelling underlines use the browser’s own dictionary.</p>${field('word','Word or name')}<div id="w-dictionary-list">${(data.preferences.personalDictionary||[]).map(word=>`<div class="w-backup-item"><span>${escape(word)}</span><button type="button" data-remove-word="${escape(word)}">Remove</button></div>`).join('')||'<p>No personal words yet.</p>'}</div><details><summary>Removed words</summary>${(data.preferences.dictionaryTrash||[]).map((item,i)=>`<div class="w-backup-item"><span>${escape(item.word)}</span><button type="button" data-restore-word="${i}">Restore</button></div>`).join('')||'<p>No removed words.</p>'}</details>`;}
 function openDictionary(){showDialog('Personal dictionary',dictionaryFields(),v=>{if(!v.word)return;if(v.word.length>100||/[\s\u0000-\u001f]/.test(v.word))throw new Error('Use a single word or name, up to 100 characters.');const list=data.preferences.personalDictionary||[];if(list.length>=5000)throw new Error('The personal dictionary is full. Remove a word first.');if(!isPersonalWord(v.word))list.push(v.word);data.preferences.personalDictionary=list;},'Add word');}
 function openThesaurus(){
  const c=selected(),range=selectionForDraft();thesaurusSelection=null;thesaurusChoices=[];
  let query='';if(range&&range.end>range.start){const original=c.text.slice(range.start,range.end);query=original.trim();if(query&&query.length<=120){const start=range.start+original.indexOf(query);thesaurusSelection={chapterId:c.id,start,end:start+query.length,text:c.text,formats:JSON.stringify(c.formats||[])};}}
  showDialog('Offline thesaurus',`<p class="w-secondary">English synonyms, grouped by meaning. Choose wording that fits your sentence; a synonym may need a different tense or grammar.</p>${field('lookup','Word or phrase',query)}<button type="button" id="w-thesaurus-search">Look up</button><p class="w-secondary">${thesaurusSelection?'Choose an alternative to replace your selected words.':'Select words in the draft before opening the thesaurus to enable replacements.'}</p><div id="w-thesaurus-results" role="region" aria-label="Thesaurus results" aria-live="polite"></div><details class="w-thesaurus-credit"><summary>Dictionary source and license</summary><p>Based on WordNet 3.0. Copyright 2006 by Princeton University. All rights reserved.</p><pre>${escape(WritingThesaurus.license||'The complete WordNet license is included in the app download.')}</pre></details>`,()=>{},'Close');
  if(query)lookupThesaurus();
 }
 function lookupThesaurus(){
  const input=document.querySelector('#w-dialog [name="lookup"]'),panel=document.getElementById('w-thesaurus-results');if(!input||!panel)return;thesaurusChoices=[];
  const query=input.value.trim();if(!query||query.length>120){panel.textContent='Enter a word or short phrase, up to 120 characters.';return;}
  const found=WritingThesaurus.lookup(query);if(!found.senses.length){panel.textContent='No entry in the bundled English thesaurus. Try a base form or another word.';return;}
  panel.innerHTML=`<p>${found.matchedForms.length?'Entries for '+escape(found.matchedForms.join(', ')):escape(query)}${found.limited?' · Showing '+found.senses.length+' of '+found.total+' meanings':''}</p>`+found.senses.map(sense=>`<section class="w-thesaurus-sense"><h3>${escape(sense.partOfSpeech)}</h3><p>${escape(sense.definition)}</p><div class="w-synonyms">${sense.words.map(word=>{const index=thesaurusChoices.push(word)-1;return `<button type="button" data-thesaurus-choice="${index}" ${thesaurusSelection?'':'disabled'} title="Replace selected words with ${escape(word)}">${escape(word)}</button>`;}).join('')||'<span class="w-secondary">No alternative words for this meaning.</span>'}</div></section>`).join('');
 }
 function replaceThesaurus(index){
  const chosen=thesaurusChoices[index],range=thesaurusSelection,c=selected();if(!chosen||!range)return;
  try{if(blocked||c.id!==range.chapterId||c.text!==range.text||JSON.stringify(c.formats||[])!==range.formats)throw new Error('The draft changed. Close the thesaurus and select the words again.');
   let replacement=chosen,original=c.text.slice(range.start,range.end);if(original===original.toLocaleUpperCase())replacement=chosen.toLocaleUpperCase();else if(/^[A-Z][a-z]/.test(original))replacement=chosen[0].toLocaleUpperCase()+chosen.slice(1);
   const edited=WritingTextTools.edit(c.text,c.formats,range.start,range.end,replacement);recordEditorUndo();c.text=edited.text;c.formats=edited.formats;lastCorrection=null;typingSuggestions=[];
   document.getElementById('w-dialog').close();render();const draft=root.querySelector('#w-draft');draft.focus();draft.setSelectionRange(range.start,range.start+replacement.length);scheduleSave();
  }catch(error){const notice=document.getElementById('w-dialog-error');notice.textContent=error.message;notice.hidden=false;}
 }
 document.getElementById('w-dialog').addEventListener('click',e=>{const b=e.target.closest('button');if(b?.id==='w-thesaurus-search')lookupThesaurus();else if(b?.dataset.thesaurusChoice!==undefined)replaceThesaurus(Number(b.dataset.thesaurusChoice));});
 document.getElementById('w-dialog').addEventListener('keydown',e=>{if(e.target.name==='lookup'&&e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();lookupThesaurus();}});
 document.getElementById('w-dialog').addEventListener('click',e=>{
  const b=e.target.closest('[data-remove-word],[data-restore-word]');if(!b)return;
  const dictionaryError=message=>{const el=document.getElementById('w-dialog-error');el.textContent=message;el.hidden=false;};
  if(b.dataset.removeWord){data.preferences.dictionaryTrash??=[];if(data.preferences.dictionaryTrash.length>=5000){dictionaryError('Removed words are full. Restore a word before removing another.');return;}data.preferences.dictionaryTrash.unshift({word:b.dataset.removeWord,deletedAt:new Date().toISOString()});data.preferences.personalDictionary=(data.preferences.personalDictionary||[]).filter(word=>word!==b.dataset.removeWord);}
  else{const index=Number(b.dataset.restoreWord),item=data.preferences.dictionaryTrash?.[index];if(!item)return;if((data.preferences.personalDictionary||[]).length>=5000&&!isPersonalWord(item.word)){dictionaryError('Remove a word before restoring another.');return;}data.preferences.personalDictionary??=[];if(!isPersonalWord(item.word))data.preferences.personalDictionary.push(item.word);data.preferences.dictionaryTrash.splice(index,1);}
  document.getElementById('w-dialog-fields').innerHTML=dictionaryFields()+'<p id="w-dialog-error" role="alert" hidden></p>';scheduleSave();
 });
 function chapterUndo(){const id=selected().id;if(!editHistory.has(id))editHistory.set(id,{undo:[],redo:[],at:0,kind:''});return editHistory.get(id);}
 function draftState(){const c=selected(),el=root.querySelector('#w-draft');return {text:c.text,formats:clone(c.formats||[]),start:el?.selectionStart||0,end:el?.selectionEnd||0};}
 function recordEditorUndo(kind='command'){
  const h=chapterUndo(),now=Date.now(),group=['insertText','deleteContentBackward','deleteContentForward'].includes(kind)&&h.kind===kind&&now-h.at<800;
  if(!group){h.undo.push(draftState());while(h.undo.length>1&&(h.undo.length>40||h.undo.reduce((total,item)=>total+item.text.length+item.formats.length*64,0)>8*1024*1024))h.undo.shift();}h.redo=[];h.at=now;h.kind=kind;
 }
 function editorUndo(redo=false){
  const h=chapterUndo(),from=redo?h.redo:h.undo,to=redo?h.undo:h.redo;if(!from.length)return;
  to.push(draftState());const previous=from.pop(),c=selected();c.text=previous.text;c.formats=clone(previous.formats);h.kind='';lastCorrection=null;typingSuggestions=[];
  const draft=root.querySelector('#w-draft');if(draft){draft.value=c.text;draft.focus();draft.setSelectionRange(previous.start,previous.end);}count();fitText();updateTyping();updateFormattedPreview();scheduleSave();
 }
 function setDraftText(text){const c=selected();if(c.text!==text){try{c.formats=WritingTextTools.rebase(c.text,text,c.formats);c.text=text;}catch(error){const draft=root.querySelector('#w-draft');if(draft)draft.value=c.text;saveStatus('Edit could not be applied: '+error.message,true);}}updateFormattedPreview();}
 function selectionForDraft(){const draft=root.querySelector('#w-draft');if(!draft)return null;if(document.activeElement===draft||!draftSelection||draftSelection.chapterId!==selected().id)return {start:draft.selectionStart,end:draft.selectionEnd};return draftSelection;}
 function formatSelection(attribute){
  const draft=root.querySelector('#w-draft'),range=selectionForDraft(),notice=root.querySelector('#w-formatting-status');if(!draft||!range)return;
  if(range.start===range.end){if(notice)notice.textContent='Select words in the draft first, then choose Bold or Italic.';draft.focus();return;}
  recordEditorUndo();const c=selected();try{c.formats=WritingTextTools.toggle(c.text,c.formats,range.start,range.end,attribute);}catch(error){if(notice)notice.textContent=error.message;return;}draft.focus();draft.setSelectionRange(range.start,range.end);updateFormattedPreview();scheduleSave();if(notice)notice.textContent='Formatting updated in the preview and exports.';
 }
 function updateFormattedPreview(){
  const preview=root.querySelector('#w-formatted-preview');if(!preview||!selected())return;const c=selected();preview.innerHTML=c.text?WritingTextTools.html(c.text,c.formats):'<span class="w-secondary">Your formatted chapter will appear here.</span>';preview.style.textAlign=c.alignment||'left';preview.style.lineHeight=c.lineSpacing||1.7;
 }
 function writingControls(){
  draftSelection=null;
  const c=selected(),draft=main.querySelector('#w-draft');
  main.querySelector('.w-editor-actions').insertAdjacentHTML('beforeend',`<label class="w-alignment-control" for="w-spacing">Line spacing<select id="w-spacing">${[1.4,1.7,2].map(value=>`<option value="${value}" ${(c.lineSpacing||1.7)===value?'selected':''}>${value===1.4?'Compact':value===1.7?'Comfortable':'Double'}</option>`).join('')}</select></label>`);
  draft.style.lineHeight=c.lineSpacing||1.7;
  draft.insertAdjacentHTML('beforebegin','<div class="w-writing-toolbar" role="group" aria-label="Writing controls"><button id="w-bold" title="Bold selected words (Ctrl/Cmd+B)"><strong>Bold</strong></button><button id="w-italic" title="Italic selected words (Ctrl/Cmd+I)"><em>Italic</em></button><button id="w-editor-undo">Undo</button><button id="w-editor-redo">Redo</button><button id="w-dictionary">Personal dictionary</button><button id="w-thesaurus">Thesaurus</button><details class="w-shortcuts"><summary>Keyboard shortcuts</summary><p>Ctrl/Cmd+B: bold selection<br>Ctrl/Cmd+I: italic selection<br>Ctrl/Cmd+Z: undo draft edit<br>Ctrl/Cmd+Shift+Z: redo<br>Ctrl/Cmd+S: save<br>Ctrl/Cmd+Shift+F: find and replace<br>Ctrl/Cmd+Shift+R: read manuscript</p></details></div><p id="w-formatting-status" class="w-secondary" role="status">Select words to format them. The preview shows how they will look in Word, PDF, Markdown, and reading copies.</p>');
  draft.insertAdjacentHTML('afterend','<details class="w-format-preview"><summary>Formatted chapter preview</summary><div id="w-formatted-preview" class="w-reading-text"></div></details>');updateFormattedPreview();
 }
 function findReplacePanel(){return `<details class="w-find-panel" open><summary>Find and replace</summary><div class="w-find-grid"><label>Find<input id="w-find-text" type="text" placeholder="Word or phrase"></label><label>Replace with<input id="w-replace-text" type="text" placeholder="Replacement (can be empty)"></label><label>Look in<select id="w-replace-scope"><option value="chapter">This chapter</option><option value="project">Whole manuscript</option></select></label><label class="w-check"><input id="w-match-case" type="checkbox"><span>Match case</span></label><label class="w-check"><input id="w-whole-word" type="checkbox"><span>Whole words</span></label></div><button id="w-preview-replace">Preview replacements</button><div id="w-replace-preview" role="region" aria-label="Replacement preview"></div></details>`;}
 function previewReplace(){
  const el=id=>root.querySelector('#'+id),panel=el('w-replace-preview');replacePreview=null;
  try{replacePreview=WritingRevision.preview(project(),el('w-find-text').value,el('w-replace-text').value,{caseSensitive:el('w-match-case').checked,wholeWord:el('w-whole-word').checked,scope:el('w-replace-scope').value,chapterId:selected().id});
   panel.innerHTML=`<p role="status">${replacePreview.total} matches in ${replacePreview.chapters.length} chapters. Applying saves a version of every changed chapter first.</p>${replacePreview.chapters.slice(0,20).map(c=>`<details class="w-replace-chapter"><summary>${escape(c.title)} · ${c.matches.length} matches</summary>${c.matches.slice(0,20).map(m=>`<p class="w-replace-example">${escape(c.before.slice(Math.max(0,m.start-40),m.start))}<del>${escape(m.original)}</del><ins>${escape(m.replacement)||'(delete)'}</ins>${escape(c.before.slice(m.end,m.end+40))}</p>`).join('')}${c.matches.length>20?'<p>Showing the first 20 matches in this chapter.</p>':''}</details>`).join('')}${replacePreview.chapters.length>20?'<p>Showing the first 20 chapters.</p>':''}${replacePreview.total?'<button id="w-apply-replace">Apply previewed replacements</button>':''}`;
  }catch(error){panel.textContent=error.message;}
 }
 function applyReplace(){
  if(!replacePreview)return;const preview=replacePreview;
  try{WritingRevision.apply(project(),preview);}catch(error){root.querySelector('#w-replace-preview').textContent=error.message;replacePreview=null;return;}
  confirmAction('Apply replacements?',`${preview.total} matches were previewed. Each changed chapter will be saved as a version before applying.`,()=>{
   const result=WritingRevision.apply(project(),preview);for(const id of result.changedChapterIds)snapshot(chapters.find(c=>c.id===id),'Before find and replace');
   for(const replacement of result.chapters){const index=chapters.findIndex(c=>c.id===replacement.id);chapters[index]=replacement;editHistory.delete(replacement.id);}replacePreview=null;
  },'Apply replacements');
 }
 function compareVersion(id){
  const version=project().history.find(item=>item.id===id);if(!version)return;const comparison=WritingRevision.diff(version.text,selected().text),display=WritingRevision.displayDiff(comparison),panel=root.querySelector('#w-version-comparison');
  panel.innerHTML=`<h3>Saved version → current draft</h3><p class="w-secondary">${escape(new Date(version.at).toLocaleString())}. Removed lines are rose; added lines are mint. ${comparison.approximate?'Large changed sections are shown as complete removed/added blocks.':''}</p><div class="w-diff-legend"><span>− Removed</span><span>+ Added</span></div><div class="w-diff">${display.rows.map(row=>`<div class="w-diff-${row.kind}"><span aria-label="${row.kind}">${{same:' ',added:'+',removed:'−',omitted:'…'}[row.kind]}</span><pre>${escape(row.text)}${row.truncated?'\n[Display shortened; full text remains in the saved version.]':''}</pre></div>`).join('')}</div><p class="w-secondary">${display.omittedRows?display.omittedRows+' rows omitted from this view. ':''}${display.omittedChanges?display.omittedChanges+' changed rows omitted; narrow your comparison or inspect the saved wording. ':''}${display.truncatedText?display.truncatedText+' long rows shortened. ':''}Comparison shows wording. Saved versions also retain formatting, spacing, and alignment.</p>`;
 }
 function readingView(){const p=project();return `<h2>${escape(p.title)}</h2><p class="w-secondary">Whole manuscript · ${chapters.reduce((n,c)=>n+words(c.text),0)} words</p><details class="w-reading-toc"><summary>Jump to a chapter</summary>${chapters.map(c=>`<a href="#w-read-${c.id}">${escape(c.title)}</a>`).join('')}</details>${chapters.map((c,i)=>`<section id="w-read-${c.id}" class="w-reading-chapter"><div class="w-row"><div><p class="w-chapter-number">Chapter ${String(i+1).padStart(2,'0')}</p><h3>${escape(c.title)}</h3></div><button data-edit-reading="${c.id}">Edit chapter</button></div><div class="w-reading-text" style="text-align:${['left','right','justify'].includes(c.alignment)?c.alignment:'left'};line-height:${[1.4,1.7,2].includes(c.lineSpacing)?c.lineSpacing:1.7}">${WritingTextTools.html(c.text,c.formats)||'<span class="w-secondary">This chapter is empty.</span>'}</div></section>`).join('')}`;}
 root.addEventListener('mousedown',e=>{if(e.target.closest('#w-bold,#w-italic'))e.preventDefault();});
 root.addEventListener('select',e=>{if(e.target.id==='w-draft')draftSelection={chapterId:selected().id,start:e.target.selectionStart,end:e.target.selectionEnd};},true);
 root.addEventListener('beforeinput',e=>{if(e.target.id!=='w-draft')return;if(e.inputType==='historyUndo'||e.inputType==='historyRedo'){e.preventDefault();editorUndo(e.inputType==='historyRedo');return;}recordEditorUndo(e.inputType);});
 root.addEventListener('keydown',e=>{
  if(!(e.ctrlKey||e.metaKey)||e.altKey||e.isComposing)return;const key=e.key.toLowerCase();
  if(e.shiftKey&&key==='f'){e.preventDefault();e.stopImmediatePropagation();state.view='revise';render();root.querySelector('#w-find-text').focus();}
  else if(e.shiftKey&&key==='r'){e.preventDefault();e.stopImmediatePropagation();state.view='reading';render();}
  else if(key==='s'){e.preventDefault();e.stopImmediatePropagation();flushSave();}
  else if(e.target.id==='w-draft'&&['b','i','z','y'].includes(key)){e.preventDefault();e.stopImmediatePropagation();if(key==='b'||key==='i')formatSelection(key==='b'?'bold':'italic');else editorUndo(key==='y'||e.shiftKey);}
 },true);
 root.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.id==='w-bold'||b.id==='w-italic')formatSelection(b.id==='w-bold'?'bold':'italic');
  else if(b.id==='w-editor-undo'||b.id==='w-editor-redo')editorUndo(b.id==='w-editor-redo');
  else if(b.id==='w-toggle-hints'||b.id==='w-show-hints'){state.hintsVisible=b.id==='w-show-hints'||!state.hintsVisible;state.context=true;state.contextTab='guide';render();scheduleSave();}
  else if(b.id==='w-dictionary')openDictionary();
  else if(b.id==='w-thesaurus')openThesaurus();
  else if(b.id==='w-preview-replace')previewReplace();
  else if(b.id==='w-apply-replace')applyReplace();
  else if(b.dataset.compareVersion)compareVersion(b.dataset.compareVersion);
  else if(b.dataset.editReading){state.selected=b.dataset.editReading;state.view='write';render();scheduleSave();}
  else if(b.id==='w-folder-backups'){state.view='backups';render();loadFolderFiles();}
  else if(b.id==='w-folder-refresh')loadFolderFiles();
  else if(b.id==='w-folder-reconnect')connectFolderBackups().then(loadFolderFiles);
  else if(b.dataset.readBackup)recoverFolder(b.dataset.readBackup);
  else if(b.id==='w-folder-fresh')confirmAction('Use this workspace for folder backups?','The older copies stay in the backup folder. This browser’s projects will become the latest workspace copy.',()=>{freshWorkspace=false;folderHold=false;},'Use this workspace');
  else if(b.id==='w-folder-now'){syncData();folderBackups.backupNow(WritingStore.serialize(data)).then(loadFolderFiles).catch(error=>saveStatus('Folder backup failed: '+error.message,true));}
 });
 root.addEventListener('change',e=>{if(e.target.id==='w-spacing'){selected().lineSpacing=Number(e.target.value);root.querySelector('#w-draft').style.lineHeight=e.target.value;updateFormattedPreview();fitText();scheduleSave();}else if(e.target.id==='w-alignment')updateFormattedPreview();});
 root.addEventListener('input',e=>{if(['w-find-text','w-replace-text'].includes(e.target.id)){replacePreview=null;const panel=root.querySelector('#w-replace-preview');if(panel)panel.textContent='Preview again after changing the search or replacement.';}});
 root.addEventListener('change',e=>{if(['w-replace-scope','w-match-case','w-whole-word'].includes(e.target.id)){replacePreview=null;const panel=root.querySelector('#w-replace-preview');if(panel)panel.textContent='Preview again after changing the search options.';}});
