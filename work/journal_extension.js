 function isJournal(){return state.type==='journaling';}
 function entryWord(plural=false){return isJournal()?(plural?'entries':'entry'):(plural?'chapters':'chapter');}
 function entryHeading(plural=false){const word=entryWord(plural);return word[0].toUpperCase()+word.slice(1);}
 function createdMarkup(c){return isJournal()?`<p class="w-entry-created">${WritingJournal.validCreatedAt(c.createdAt)?`<time datetime="${escape(c.createdAt)}">${escape(WritingJournal.createdLabel(c))}</time>`:'Creation date unavailable for this existing entry.'}</p>`:'';}
 function enrichJournal(){
  const journal=isJournal(),word=entryHeading(),plural=entryHeading(true);
  root.querySelector('#w-add-chapter').setAttribute('aria-label','Add '+entryWord());
  root.querySelector('.w-tree h3').textContent=journal?'Journal':'Manuscript';
  root.querySelector('#w-studio-chapters').textContent=plural;
  root.querySelector('#w-search').labels[0].firstChild.textContent=journal?'Find in the journal':'Find in the manuscript';
  root.querySelector('#w-search').placeholder='Search '+entryWord()+' titles, notes, and draft text';
  root.querySelector('#w-search-help').textContent=`Search ${entryWord()} titles, notes, and draft text. Sources, characters, and outlines are not included.`;
  for(const view of ['reading'])root.querySelectorAll('.w-menu [data-view="'+view+'"]').forEach(el=>el.textContent=navigationViews[view]);
  if(state.view==='write'){
   const title=main.querySelector('#w-title');title.setAttribute('aria-label',word+' title');title.placeholder=journal?'Give this entry a title':'Chapter title';
   main.querySelector('h2').insertAdjacentHTML('afterend',createdMarkup(selected()));
   main.querySelector('#w-draft').setAttribute('aria-label',word+' draft');
   main.querySelector('#w-draft').placeholder=journal?'What is on your mind?':'Begin writing here…';
   main.querySelector('#w-delete-chapter').textContent='Delete '+entryWord();
  }
 }
