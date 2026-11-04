 function isJournal(){return state.type==='journaling';}
 function entryWord(plural=false){return isJournal()?(plural?'entries':'entry'):(plural?'chapters':'chapter');}
 function entryHeading(plural=false){const word=entryWord(plural);return word[0].toUpperCase()+word.slice(1);}
 function createdMarkup(c){return isJournal()?`<p class="w-entry-created">${WritingJournal.validCreatedAt(c.createdAt)?`<time datetime="${escape(c.createdAt)}">${escape(WritingJournal.createdLabel(c))}</time>`:'Creation date unavailable for this existing entry.'}</p>`:'';}
 function revisionChecklist(){
  if(isJournal())return ['Does this entry say what I wanted to express?','Is there a feeling, detail, or question I want to keep?','Would a title help me find this entry again?'];
  if(state.type==='fiction')return ['Show the scene through concrete details.','Check what changes for the characters.','Check the connection to the previous chapter.'];
  return ['Show a concrete experience before explaining it.','Check the connection to the previous chapter.','Check source locators and quotation accuracy.'];
 }
 function enrichJournal(){
  const journal=isJournal(),word=entryHeading(),plural=entryHeading(true);
  root.querySelector('#w-add-chapter').setAttribute('aria-label','Add '+entryWord());
  root.querySelector('.w-tree h3').textContent=journal?'Journal':'Manuscript';
  root.querySelector('#w-studio-chapters').textContent=plural;
  root.querySelector('#w-studio-tools').textContent=word+' tools';
  root.querySelector('#w-search').labels[0].firstChild.textContent=journal?'Find in the journal':'Find in the manuscript';
  root.querySelector('#w-search').placeholder='Search '+entryWord()+' titles, notes, and draft text';
  root.querySelector('#w-search-help').textContent=`Search ${entryWord()} titles, notes, and draft text. Sources, characters, and outlines are not included.`;
  for(const view of ['plan','reading'])root.querySelectorAll('.w-menu [data-view="'+view+'"]').forEach(el=>el.textContent=navigationViews[view]);
  root.querySelector('.w-tree>p')?.replaceChildren(journal?'Your entries, notes, and reflections in one place.':'One project. Connected chapters, notes, sources, and revision tasks.');
  if(journal&&state.view==='plan'){
   main.querySelector('h2').textContent='Your journal entries.';
   main.querySelectorAll('.w-chapter-number').forEach(el=>el.textContent=el.textContent.replace(/Chapter/i,'Entry'));
  }
  if(state.view==='write'){
   main.querySelector('.w-chapter-number').textContent=journal?'Journal entry':'Chapter '+String(chapters.indexOf(selected())+1).padStart(2,'0');
   const title=main.querySelector('#w-title');title.setAttribute('aria-label',word+' title');title.placeholder=journal?'Give this entry a title':'Chapter title';
   main.querySelector('h2').insertAdjacentHTML('afterend',createdMarkup(selected()));
   main.querySelector('#w-draft').setAttribute('aria-label',word+' draft');
   main.querySelector('#w-draft').placeholder=journal?'What is on your mind?':'Begin writing here…';
   main.querySelector('.w-format-preview>summary').textContent='Formatted '+entryWord()+' preview';
   main.querySelector('.w-chapter-number').nextElementSibling.hidden=journal;
   main.querySelector('.w-metadata>summary').textContent=word+' settings';
   main.querySelector('#w-delete-chapter').textContent='Delete '+entryWord();
   const note=context.querySelector('.w-context-section h3');if(note)note.textContent=word+' notes';
   context.querySelector('label[for="w-panel-choice"]').firstChild.textContent=word+' tools';
   context.querySelector('#w-panel-choice option[value=notes]').textContent=word+' notes';
   context.querySelector('#w-close-tools').setAttribute('aria-label','Close '+entryWord()+' tools');
   if(journal){
    main.querySelector('#w-status').closest('label').firstChild.textContent='Entry status';
    main.querySelector('#w-summary').setAttribute('aria-label','Entry summary');
    main.querySelector('#w-summary').closest('label').firstChild.textContent='Entry summary';
    context.querySelector('#w-note')?.setAttribute('aria-label','Entry notes');
    context.querySelector('.w-guide h3')?.replaceChildren('Journal prompts');
   }
  }
 }
