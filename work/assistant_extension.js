 const assistantWorkspaces=new Map();let assistantCurrentKey='',assistantInitialized=false;
 const assistantClient=WritingAssistant.createClient({onStatus:updateAssistantStatus});
 const assistantStylePresets=['Clear and concrete','Conversational','Lyrical','Literary','Academic','Direct'];
 function assistantWorkspace(){
  const key=project().id+':'+selected().id;assistantCurrentKey=key;
  const chapter=selected(),cached=assistantWorkspaces.get(key);
  if(!cached||cached.chapter!==chapter){const saved=chapter.assistantDraft;assistantWorkspaces.set(key,{model:saved?.model||'deepseek-flash',goal:saved?.goal||'brainstorm',brief:saved?.brief||'',text:saved?.text||'',selection:null,result:saved?.suggestion?{...saved.suggestion,restored:true}:null,error:'',chapter});}
  return assistantWorkspaces.get(key);
 }
 function saveAssistantDraft(work=assistantWorkspace()){
  // Persist only editable writing. Keys, session state, selections and target fingerprints remain in memory.
  work.chapter.assistantDraft={model:work.model,goal:work.goal,brief:work.brief,text:work.text,suggestion:work.result?{text:work.result.text.slice(0,24000).replace(/[\uD800-\uDBFF]$/,''),truncated:!!work.result.truncated||work.result.text.length>24000}:null};scheduleSave();
 }
 function assistantPrerequisite(status){
  if(blocked)return 'Recover or reopen the workspace before using the assistant.';
  if(!status.available)return status.error||'Checking the local launcher. Use the Mac or Windows launcher for the assistant.';
  if(status.busy)return 'Wait for the current suggestion to finish.';
  if(status.settingsBusy)return 'Wait for the key settings to finish updating.';
  if(!status.connected)return 'Attach a DeepSeek key in Assistant settings to enable Generate.';
  const work=assistantWorkspace();try{WritingAssistant.buildRequest({model:work.model,goal:work.goal,brief:work.brief,text:work.text,profile:project().writingProfile,projectType:state.type,genre:genre().name});}catch(error){return error.message;}
  return 'Ready. Generate sends the writing profile, instruction and text preview to DeepSeek.';
 }
 function assistantNotice(message,error=false){const el=root.querySelector('#w-ai-status');if(el){el.textContent=message;el.classList.toggle('w-error',error);}}
 function assistantKeyFileFields(){return `<section class="w-ai-keyfile w-section" aria-label="Saved API key file"><h3>Saved API key file</h3><p class="w-secondary">Optional: keep your DeepSeek key in a file on this computer. This file stores the key as plain text. It stays outside project backups and app downloads.</p><p id="w-ai-keyfile-path" class="w-path"></p><p id="w-ai-keyfile-status" role="status"></p><label class="w-check"><input type="checkbox" id="w-ai-keyfile-enable"><span>Allow Writing Studio to read this key file</span></label><p class="w-secondary">This permission is remembered on this computer. When enabled, the launcher reads the key at startup and before each generation. Saving an empty key in the file stops future requests.</p><div class="w-row"><button type="button" id="w-ai-keyfile-create">Create empty key file</button><button type="button" id="w-ai-keyfile-reload">Reload saved key</button><button type="button" id="w-ai-keyfile-clear">Remove saved key</button></div><details><summary>How to fill or remove the key</summary><p>Click Create empty key file, then open the displayed file in a text editor. Put your key between the quotation marks after apiKey and save the file.</p><pre>{ "apiKey": "YOUR_DEEPSEEK_KEY" }</pre><p>Enable the read permission, or click Reload saved key if it is already enabled. To remove it manually, change the file to:</p><pre>{ "apiKey": "" }</pre><p>Remove saved key empties the file, turns off automatic reading, and forgets the current session key. Disconnect turns off file reading and forgets the session key while keeping the file.</p></details></section>`;}
 function updateAssistantKeyFile(status){
  const checkbox=root.querySelector('#w-ai-keyfile-enable');if(!checkbox)return;
  const file=status.keyFile,path=root.querySelector('#w-ai-keyfile-path'),notice=root.querySelector('#w-ai-keyfile-status');
  path.textContent=file?'Key file: '+file.path:'Use the updated local launcher to manage a saved key file.';
  checkbox.checked=!!file?.readEnabled;checkbox.disabled=!status.available||!file||status.busy||status.settingsBusy;
  notice.textContent=file?.error||(file?(file.exists?'Key file exists. ':'Key file has not been created. ')+(file.readEnabled?'Automatic reading is allowed.':'Automatic reading is off.'):'');notice.classList.toggle('w-error',!!file?.error);
  for(const id of ['create','reload','clear']){const button=root.querySelector('#w-ai-keyfile-'+id);button.disabled=!status.available||!file||status.settingsBusy||status.busy&&id!=='clear'||id==='reload'&&!file.readEnabled;}
 }
 function updateAssistantStatus(status){
  const el=root.querySelector('#w-ai-connection-status');if(el)el.textContent=status.available?(status.connected?'Key attached for this launcher session. Generate is the only action that contacts DeepSeek.':'Attach your key for this launcher session.'):status.error||'Checking the local launcher…';
  const generate=root.querySelector('#w-ai-generate');if(generate){generate.disabled=!status.available||!status.connected||status.busy||status.settingsBusy||blocked;try{const work=assistantWorkspace();WritingAssistant.buildRequest({model:work.model,goal:work.goal,brief:work.brief,text:work.text,profile:project().writingProfile,projectType:state.type,genre:genre().name});}catch(_){generate.disabled=true;}generate.textContent=status.busy?'Generating…':'Generate suggestion';}
  for(const id of ['w-ai-connect','w-ai-reconnect']){const button=root.querySelector('#'+id);if(button)button.disabled=status.busy||status.settingsBusy||!status.available&&id==='w-ai-connect';}
  const disconnect=root.querySelector('#w-ai-disconnect');if(disconnect)disconnect.disabled=!status.available||!status.connected||status.settingsBusy;
  const reason=root.querySelector('#w-ai-prerequisite');if(reason)reason.textContent=assistantPrerequisite(status);
  updateAssistantKeyFile(status);
 }
 function assistantView(){
  const work=assistantWorkspace(),c=selected(),profile=WritingAssistant.normalizeProfile(project().writingProfile);
  const range=selectionForDraft();if(range&&range.end>range.start)work.selection={projectId:project().id,chapterId:c.id,start:range.start,end:range.end,text:c.text,formatFingerprint:WritingRevision.formatFingerprint(c)};
  const choice=(values,current,labels={})=>values.map(value=>`<option value="${escape(value)}" ${value===current?'selected':''}>${escape(labels[value]||value)}</option>`).join('');
  return `<h2>Writing assistant</h2><p class="w-secondary">Optional DeepSeek support. Your writing stays local until you choose Generate. DeepSeek receives the writing profile, project type, genre, instruction, and text preview below. Requests use your DeepSeek account and may incur charges.</p><details id="w-ai-settings" class="w-plancard"><summary>Assistant settings</summary><p id="w-ai-connection-status" role="status">Checking the local launcher…</p><label for="w-ai-key">DeepSeek API key<input id="w-ai-key" type="password" autocomplete="new-password" autocapitalize="off" spellcheck="false" placeholder="Paste your key for this session"></label><div class="w-row"><button id="w-ai-connect">Attach key</button><button id="w-ai-disconnect">Disconnect and forget key</button><button id="w-ai-reconnect">Check local connection</button></div><p class="w-secondary">A key attached here stays in memory and is excluded from projects and backups. Attaching it turns off automatic key-file reading. Closing the launcher forgets this session key. Attaching a key makes no provider request and does not verify account credit.</p>${assistantKeyFileFields()}</details><details class="w-plancard"><summary>Project writing profile</summary><p class="w-secondary">Saved with ${escape(project().title)} and included in every assistant request for this project.</p><div class="w-assistant-grid"><label>Tone<select id="w-ai-tone">${choice(WritingAssistant.TONES,profile.tone)}</select></label><label>Point of view<select id="w-ai-pov">${choice(WritingAssistant.POVS,profile.pov,{first:'First person',second:'Second person',third:'Third person'})}</select></label><label>English variant<select id="w-ai-variant">${choice(WritingAssistant.VARIANTS,profile.englishVariant,{american:'American English',british:'British English'})}</select></label><label>Style preset<select id="w-ai-style-preset"><option value="">Custom / describe below</option>${choice(assistantStylePresets,profile.style)}</select></label></div><label>Style description<input id="w-ai-style" maxlength="400" value="${escape(profile.style)}" placeholder="For example: warm, lyrical, concrete"></label><label>Intended audience<input id="w-ai-audience" maxlength="400" value="${escape(profile.audience)}" placeholder="Who are you writing for?"></label><label>Writing preferences<textarea id="w-ai-instructions" maxlength="2000" placeholder="Words to avoid, what to preserve, or other preferences">${escape(profile.instructions)}</textarea></label></details><section class="w-section" aria-label="Writing request"><h3>Writing request</h3><div class="w-assistant-grid"><label>Writing goal<select id="w-ai-goal">${choice(WritingAssistant.GOALS,work.goal,{brainstorm:'Brainstorm ideas',outline:'Create an outline',continue:'Suggest a continuation',rewrite:'Rewrite an excerpt',feedback:'Give feedback'})}</select></label><label>DeepSeek model<select id="w-ai-model">${choice(WritingAssistant.MODELS,work.model,{'deepseek-flash':'Flash','deepseek-v4-pro':'V4 Pro'})}</select></label></div><p class="w-secondary">Current context: ${escape(projectTypeLabel(state.type))} · ${escape(genre().name)} · ${escape(c.title)}. Chapter title is shown here for orientation; it is excluded from the request.</p><p class="w-secondary">Your instruction, text preview, chosen goal/model and editable suggestion are saved with this chapter, including in full backups.</p><button id="w-ai-clear-draft" type="button">Clear saved assistant draft</button><label>Your instruction<textarea id="w-ai-brief" maxlength="2000" placeholder="What would help with this passage?">${escape(work.brief)}</textarea></label></section><section class="w-section" aria-label="Text to send"><h3>Text preview</h3><div class="w-row"><button id="w-ai-use-selection" ${work.selection?'':'disabled'}>Use selected words</button><button id="w-ai-use-chapter">Use chapter excerpt</button><button id="w-ai-clear-text">Clear text preview</button></div><label>Text to send<textarea id="w-ai-text" maxlength="10000" placeholder="Include text explicitly or paste an excerpt">${escape(work.text)}</textarea></label><p class="w-secondary">Nothing is included automatically. Chapter excerpts include at most the first 10,000 characters; review and edit them before generating. Total request limit: 12,000 characters including instructions and profile.</p><p id="w-ai-prerequisite" role="status" class="w-secondary"></p><div class="w-row"><button id="w-ai-generate" aria-describedby="w-ai-prerequisite">Generate suggestion</button><button type="button" id="w-ai-open-settings" aria-controls="w-ai-settings">Open Assistant settings</button></div><p id="w-ai-status" role="status" class="w-secondary">${escape(work.error||'Suggestions stay here until you explicitly insert them or save them as a note.')}</p></section>${work.result?`<section class="w-assistant-result w-section" aria-label="Editable suggestion"><h3>Editable suggestion</h3>${work.result.restored?'<p class="w-secondary">Restored suggestion: review and copy this text here. Generate a new suggestion to insert it, because the original draft target cannot be verified after reload or import.</p>':''}${work.result.truncated?'<p class="w-secondary">The model reached the output limit. This suggestion may end mid-sentence.</p>':''}<textarea id="w-ai-result" maxlength="24000" aria-label="Editable assistant suggestion">${escape(work.result.text)}</textarea><div class="w-row"><button id="w-ai-save-note" ${work.result.restored?'disabled':''}>Save as chapter note</button><button id="w-ai-insert-selection" ${work.result.selection&&!work.result.restored?'':'disabled'}>Replace selected words</button><button id="w-ai-append" ${work.result.restored?'disabled':''}>Append to chapter</button></div><p class="w-secondary">Insertion preserves a version of your draft first. Changes to the draft after generation require a new suggestion.</p></section>`:''}`;
 }
 function enrichAssistant(){if(state.view==='assistant'){updateAssistantStatus(assistantClient.state);fitText();}}
 function initializeAssistant(){
  if(assistantInitialized)return;assistantInitialized=true;
  const nav=root.querySelector('.w-nav');if(nav&&!nav.querySelector('[data-view="assistant"]'))nav.insertAdjacentHTML('beforeend','<button type="button" data-view="assistant">Assistant</button>');
  // This only discovers the local session; it never calls the provider.
  assistantClient.initialize();
 }
 function saveAssistantProfile(){
  const value=id=>root.querySelector('#'+id)?.value||'';
  try{project().writingProfile=WritingAssistant.normalizeProfile({tone:value('w-ai-tone'),style:value('w-ai-style'),audience:value('w-ai-audience'),pov:value('w-ai-pov'),englishVariant:value('w-ai-variant'),instructions:value('w-ai-instructions')});scheduleSave();updateAssistantStatus(assistantClient.state);}
  catch(error){assistantNotice(error.message,true);}
 }
 function assistantContextFingerprint(){return WritingAssistant.contextFingerprint({projectType:state.type,genreId:state.genres[state.type],genre:genre().name,profile:project().writingProfile});}
 function freshAssistantTarget(target){
  const c=selected(),current={projectId:project().id,chapterId:c.id,text:c.text,formatFingerprint:WritingRevision.formatFingerprint(c),contextFingerprint:assistantContextFingerprint()};if(blocked||!WritingAssistant.isCurrentTarget(target,current))throw new Error(target?.contextFingerprint?'The draft, writing profile, project type, or genre changed. Generate a new suggestion before inserting or saving it.':'The selected words changed. Return to the draft and select them again.');
  return c;
 }
 async function generateAssistant(){
  const work=assistantWorkspace(),key=assistantCurrentKey,c=selected();if(blocked){assistantNotice('Recover or reopen the workspace before using the assistant.',true);return;}
  const target={projectId:project().id,chapterId:c.id,text:c.text,formatFingerprint:WritingRevision.formatFingerprint(c),contextFingerprint:assistantContextFingerprint()};
  const selection=work.selection&&work.selection.text===c.text&&work.selection.formatFingerprint===target.formatFingerprint?{...work.selection}:null;
  work.error='';assistantNotice('Sending this preview to DeepSeek…');
  try{const result=await assistantClient.generate({model:work.model,goal:work.goal,brief:work.brief,text:work.text,profile:WritingAssistant.normalizeProfile(project().writingProfile),projectType:state.type,genre:genre().name});
   // A cleared draft or imported workspace must not be repopulated by an old response.
   if(assistantWorkspaces.get(key)!==work||!data.projects.some(p=>p.chapters.includes(work.chapter)))return;
   work.result={...result,target,selection};saveAssistantDraft(work);if(assistantCurrentKey===key&&state.view==='assistant'){render();assistantNotice('Suggestion ready. Review it before adding it to your writing.');}
  }catch(error){work.error=error.message;if(assistantCurrentKey===key&&state.view==='assistant')assistantNotice(error.message,true);}
 }
 function applyAssistant(action){
  const work=assistantWorkspace(),result=work.result;if(!result)return;
  try{if(result.restored)throw new Error('Generate a new suggestion before inserting restored text. You can review and copy it here.');const c=freshAssistantTarget(result.target),text=result.text;if(!text.trim())throw new Error('The suggestion is empty.');if([...text].length>WritingAssistant.MAX_OUTPUT)throw new Error('The suggestion is too long. Shorten it before inserting.');
   if(action==='note'){snapshot(c,'Before assistant note');c.note=(c.note?c.note+'\n\n':'')+text;work.result=null;saveAssistantDraft(work);render();assistantNotice('Suggestion saved as a chapter note.');scheduleSave();return;}
   const range=action==='selection'?result.selection:{start:c.text.length,end:c.text.length};if(!range)throw new Error('Select words in the draft before generating a replacement.');
   const replacement=action==='append'&&c.text? '\n\n'+text:text,edited=WritingTextTools.edit(c.text,c.formats,range.start,range.end,replacement);
   snapshot(c,'Before assistant insertion');recordEditorUndo();c.text=edited.text;c.formats=edited.formats;lastCorrection=null;typingSuggestions=[];work.result=null;saveAssistantDraft(work);state.view='write';render();
   const draft=root.querySelector('#w-draft');draft.focus();draft.setSelectionRange(range.start,range.start+replacement.length);scheduleSave();
  }catch(error){assistantNotice(error.message,true);}
 }
 root.addEventListener('click',async e=>{
  const button=e.target.closest('button');if(!button)return;
  if(button.id==='w-ai-connect'){const input=root.querySelector('#w-ai-key'),key=input.value;input.value='';try{await assistantClient.connect(key);assistantNotice('Key attached for this launcher session. It will be verified when you Generate.');}catch(error){assistantNotice(error.message,true);}}
  else if(button.id==='w-ai-disconnect'){try{await assistantClient.disconnect();const input=root.querySelector('#w-ai-key');if(input)input.value='';assistantNotice('Key forgotten. Any unfinished response will be discarded; already sent requests may still be billed.');}catch(error){assistantNotice(error.message,true);}}
  else if(button.id==='w-ai-reconnect')await assistantClient.initialize();
  else if(button.id==='w-ai-keyfile-create'||button.id==='w-ai-keyfile-reload'||button.id==='w-ai-keyfile-clear'){
   const action=button.id.split('-').pop();
   try{await assistantClient.keyFileAction(action);assistantNotice({create:'Empty key file ready. Open the displayed path and enter your key.',reload:'Saved key reloaded locally. No request has been sent to DeepSeek.',clear:'Saved key removed. The file is empty, automatic reading is off, and the session key is forgotten.'}[action]);}catch(error){assistantNotice(error.message,true);}
  }
  else if(button.id==='w-ai-open-settings'){const settings=root.querySelector('#w-ai-settings');settings.open=true;settings.querySelector('summary').focus();settings.scrollIntoView({block:'nearest'});}
  else if(button.id==='w-ai-clear-draft'){const chapter=selected();confirmAction('Clear saved assistant draft','Clear this chapter’s saved Assistant instruction, text preview, selected goal/model and suggestion?',()=>{assistantWorkspaces.delete(project().id+':'+chapter.id);delete chapter.assistantDraft;},'Clear draft');}
  else if(button.id==='w-ai-generate')generateAssistant();
  else if(button.id==='w-ai-use-selection'){const work=assistantWorkspace();try{const c=freshAssistantTarget(work.selection);const text=c.text.slice(work.selection.start,work.selection.end);if([...text].length>10000)throw new Error('Selection exceeds 10,000 characters. Choose a shorter excerpt.');work.text=text;saveAssistantDraft(work);render();}catch(error){assistantNotice(error.message,true);}}
  else if(button.id==='w-ai-use-chapter'){const work=assistantWorkspace();work.text=selected().text.slice(0,10000);saveAssistantDraft(work);render();assistantNotice('Chapter excerpt included. Review the text preview before Generate.');}
  else if(button.id==='w-ai-clear-text'){const work=assistantWorkspace();work.text='';saveAssistantDraft(work);render();}
  else if(button.id==='w-ai-save-note')applyAssistant('note');
  else if(button.id==='w-ai-insert-selection')applyAssistant('selection');
  else if(button.id==='w-ai-append')applyAssistant('append');
 });
 root.addEventListener('input',e=>{
  if(['w-ai-style','w-ai-audience','w-ai-instructions'].includes(e.target.id))saveAssistantProfile();
  else if(['w-ai-brief','w-ai-text','w-ai-result'].includes(e.target.id)){const work=assistantWorkspace();if(e.target.id==='w-ai-result'&&work.result)work.result.text=e.target.value;else work[e.target.id==='w-ai-brief'?'brief':'text']=e.target.value;saveAssistantDraft(work);updateAssistantStatus(assistantClient.state);}
 });
 root.addEventListener('change',e=>{
  if(e.target.id==='w-ai-keyfile-enable'){const enabled=e.target.checked;assistantClient.keyFileAction('settings',enabled).then(()=>assistantNotice(enabled?'Automatic key-file reading allowed on this computer.':'Automatic key-file reading is off.')).catch(error=>assistantNotice(error.message,true));}
  else if(e.target.id==='w-ai-style-preset'){if(e.target.value)root.querySelector('#w-ai-style').value=e.target.value;saveAssistantProfile();}
  else if(['w-ai-tone','w-ai-pov','w-ai-variant'].includes(e.target.id))saveAssistantProfile();
  else if(['w-ai-goal','w-ai-model'].includes(e.target.id)){const work=assistantWorkspace();work[e.target.id==='w-ai-goal'?'goal':'model']=e.target.value;saveAssistantDraft(work);updateAssistantStatus(assistantClient.state);}
 });
