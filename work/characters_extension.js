 const characterFields=[['name','Character name'],['role','Role in the story'],['appearance','Appearance'],['traits','Character traits'],['habits','Habits and mannerisms'],['beliefs','Beliefs and values'],['goals','Goals and motivations'],['fears','Fears and inner conflicts'],['relationships','Relationships'],['backstory','Background and history'],['arc','Growth and character arc'],['notes','Other details']];
 const characterChoices=new Map(),characterQueries=new Map();
 function characterList(){return project().characters||[];}
 function selectedCharacter(){const list=characterList();let current=list.find(c=>c.id===characterChoices.get(project().id));if(!current&&list.length){current=list[0];characterChoices.set(project().id,current.id);}return current;}
 function characterMatches(){const query=(characterQueries.get(project().id)||'').trim().toLocaleLowerCase();return characterList().filter(c=>!query||characterFields.some(([key])=>(c[key]||'').toLocaleLowerCase().includes(query)));}
 function characterButtons(){const current=selectedCharacter(),matches=characterMatches();return matches.length?matches.map(c=>`<button type="button" class="w-character-choice" data-select-character="${c.id}" aria-pressed="${c.id===current?.id}"><strong>${escape(c.name)}</strong><span class="w-secondary">${escape(c.role||'Character profile')}</span></button>`).join(''):'<p class="w-secondary" role="status">No matching characters.</p>';}
 function characterEditor(c){
  if(!c)return '<div class="w-character-empty"><h3>Get to know your characters</h3><p>Keep their appearance, habits, beliefs, and history together. Add a character to begin.</p></div>';
  const editorField=key=>{const label=characterFields.find(([id])=>id===key)[1],short=key==='name'||key==='role',limit=key==='name'?200:key==='role'?400:20000;return `<label for="w-character-${key}">${label}${short?`<input id="w-character-${key}" data-character-field="${key}" maxlength="${limit}" value="${escape(c[key])}" ${key==='name'?'required':''}>`:`<textarea id="w-character-${key}" data-character-field="${key}" maxlength="${limit}" rows="3" placeholder="Add what matters for this character…">${escape(c[key])}</textarea>`}</label>`;};
  const group=(title,keys,open=false)=>`<details class="w-character-group" ${open?'open':''}><summary>${title}</summary>${keys.map(editorField).join('')}</details>`;
  return `<div class="w-row"><h3 id="w-character-heading">${escape(c.name)}</h3><button type="button" id="w-delete-character">Delete character</button></div><p id="w-character-error" role="alert" hidden></p>${editorField('name')}${editorField('role')}${group('Appearance and personality',['appearance','traits','habits','beliefs'],true)}${group('Motivations and growth',['goals','fears','arc'])}${group('History and connections',['relationships','backstory'])}${group('Other details',['notes'])}`;
 }
 function charactersView(){const current=selectedCharacter();return `<div class="w-row"><h2>Characters</h2><button type="button" id="w-add-character">Add character</button></div><p class="w-secondary">Profiles for ${escape(project().title)}. Changes autosave; full project backups include these profiles. They stay outside manuscript exports and are not included in assistant requests automatically.</p><label for="w-character-search">Find a character<input type="search" id="w-character-search" placeholder="Search names, roles, or any detail" value="${escape(characterQueries.get(project().id)||'')}"></label><p id="w-character-count" class="w-secondary">${characterList().length} ${characterList().length===1?'character':'characters'}</p><div class="w-characters-layout"><div id="w-character-list" aria-label="Character profiles">${characterButtons()}</div><section class="w-character-editor" aria-label="Selected character profile">${characterEditor(current)}</section></div>`;}
 function updateCharacterList(){const list=root.querySelector('#w-character-list');if(list)list.innerHTML=characterButtons();}
 root.addEventListener('click',e=>{
  const button=e.target.closest('button');if(!button)return;
  if(button.id==='w-add-character'){
   if(blocked){saveStatus('Recover or reopen the workspace before adding a character.',true);return;}
   if(characterList().length>=1000){saveStatus('This project has 1,000 characters. Move a profile to Trash before adding another.',true);return;}
   const projectId=project().id;
   showDialog('Add character',field('title','Character name')+'<label>Role in the story<input name="role" maxlength="400" placeholder="For example: protagonist, mentor, or friend"></label>',values=>{if(project().id!==projectId)throw new Error('Reopen this project before adding the character.');if(!values.title)throw new Error('Enter a character name.');const c=Object.fromEntries(characterFields.map(([key])=>[key,'']));Object.assign(c,{id:uid(),name:values.title,role:values.role});project().characters??=[];project().characters.push(c);characterChoices.set(projectId,c.id);characterQueries.set(projectId,'');state.view='characters';});
  }else if(button.dataset.selectCharacter){characterChoices.set(project().id,button.dataset.selectCharacter);render();}
  else if(button.id==='w-delete-character'){
   if(blocked){saveStatus('Recover or reopen the workspace before deleting a character.',true);return;}
   const c=selectedCharacter(),projectId=project().id;if(!c)return;
   confirmAction('Delete character?',`“${c.name}” and all profile details will move to Trash.`,()=>{if(project().id!==projectId)throw new Error('Reopen this project before deleting the character.');toTrash('character',c,c.name);project().characters=characterList().filter(record=>record.id!==c.id);characterChoices.delete(projectId);});
  }
 });
 root.addEventListener('input',e=>{
  if(e.target.id==='w-character-search'){characterQueries.set(project().id,e.target.value);updateCharacterList();return;}
  const key=e.target.dataset.characterField;if(!key||!characterFields.some(([id])=>id===key))return;
  const c=selectedCharacter();if(!c)return;
  const error=root.querySelector('#w-character-error');
  if(blocked){error.hidden=false;error.textContent='Saving is paused. Recover or reopen the workspace before editing characters.';return;}
  if(key==='name'&&!e.target.value.trim()){error.hidden=false;error.textContent='Enter a name. The previous name is kept until you do.';return;}
  error.hidden=true;c[key]=e.target.value;
  if(key==='name')root.querySelector('#w-character-heading').textContent=c.name;
  updateCharacterList();scheduleSave();
 });
