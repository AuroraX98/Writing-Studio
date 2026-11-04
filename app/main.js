
(() => {
 const root=document.getElementById('writer-hybrid');
 let chapters=[];
 const state={view:'write',selected:'opening',focus:false,context:true,prose:18,format:'Markdown',type:'nonfiction',theme:'mint',font:'georgia',typingGlow:true,contextTab:'guide',solidGlass:false,typing:'auto',genres:{fiction:'novel',nonfiction:'reflective',memoir:'chronological'}};
 const commonTypos={bdy:'body',knw:'know',i:'I',whta:'what',thta:'that',liek:'like',teh:'the',adn:'and',recieve:'receive',becuase:'because',becasue:'because',definately:'definitely',seperate:'separate',writting:'writing',occured:'occurred',tommorow:'tomorrow',thier:'their',coudl:'could',woudl:'would',shoudl:'should',wiht:'with',hte:'the'};
 const spacingWords=new Set(('a about after again all also am an and another any are around as at back be because been before being book books both but by can cannot chapter chapters come could day did do does done down each end even every few find first for from get give go good had has have he her here him his how i idea if in input into is it its just keep know last later life like little look made make may me more most much my new next no not now of off on one only or other our out over own part people place put question read right said same see she should small so some something story take than that the their them then there these they thing think this those through time to too try two up us use very want was way we well were what when where which who will with word words work world would write writer writing year you your receive separate definitely tomorrow occurred').split(' '));
 let typingSuggestions=[],lastCorrection=null;
 // Original, optional planning prompts. These are patterns to adapt, not chapter requirements.
 const library={
  fiction:{
   novel:{name:'General / literary',items:[['Point of view & setting','Whose experience are we following? Where and when are we?'],['Desire','What does this character want, fear, or try to understand here?'],['Friction','What resists that desire: another person, an inner conflict, or a circumstance?'],['Change','What action, discovery, or realization leaves the situation different?'],['Forward connection','What consequence, image, or question carries into the next chapter?']],map:[['Arrival','Establish a person, a situation, and something unresolved.'],['Disruption','Introduce a change that makes the old situation harder to maintain.'],['Development','Explore attempts, relationships, and growing consequences.'],['Reconsideration','Deepen or challenge what the character believes or wants.'],['Decisive movement','Bring a central tension to a meaningful choice or confrontation.'],['Aftermath','Show what has changed and what remains open.']]},
   mystery:{name:'Mystery',items:[['Investigative question','What is the investigator trying to find out in this chapter?'],['Information','Is there a clue, witness account, discovery, or absence worth noticing? A clue is not required in every chapter.'],['Obstacle or suspicion','What prevents progress, creates doubt, or makes an interpretation uncertain?'],['Changed understanding','What does the investigator now believe, and what might still be mistaken?'],['Next lead or consequence','What follows from this chapter: another lead, a setback, or a personal cost?']],map:[['Unanswered event','Introduce the central mystery and someone who needs an answer.'],['Initial inquiry','Establish possible explanations and the investigation.'],['Complications','Develop evidence, resistance, and competing interpretations.'],['Reassessment','Let discoveries change the direction of the inquiry.'],['Solution tested','Connect the evidence and test the explanation through action.'],['Consequences','Resolve the main question and show its human impact.']]},
   thriller:{name:'Thriller / suspense',items:[['Threat','What danger exists, and who is affected?'],['Immediate goal','What must someone accomplish or prevent? Is time a factor?'],['Resistance','What blocks action or makes a choice risky?'],['Shift in pressure','Does danger rise, briefly ease, or become clearer? Vary the intensity.'],['Consequence','What new cost, uncertainty, or urgent decision follows?']],map:[['Danger emerges','Give the reader a reason to worry and a person to follow.'],['Response','Show attempts to understand, escape, or stop the threat.'],['Escalation','Increase the costs and complicate the available choices.'],['Setback or reversal','Change what the protagonist knows or can do.'],['Confrontation','Resolve the central danger through consequential action.'],['Fallout','Show survival, loss, and what the outcome changes.']]},
   romance:{name:'Romance',items:[['Relationship movement','How does this chapter move the central relationship closer, further apart, or into new territory?'],['Individual wants','What does each person want beyond the relationship?'],['Connection or tension','What interaction makes attraction, incompatibility, or trust tangible?'],['Risk & choice','What might someone reveal, protect, misunderstand, or choose?'],['Emotional consequence','How does the interaction affect the next meeting or decision?']],map:[['Two lives','Establish the central people and their individual circumstances.'],['Encounter','Create a reason their lives become connected.'],['Growing connection','Develop attraction, trust, and meaningful differences.'],['Relationship difficulty','Bring obstacles and conflicting needs into sharper focus.'],['Choice & repair','Show choices that make a lasting relationship possible.'],['Optimistic resolution','Resolve the central love story with an emotionally satisfying, hopeful ending.']]},
   fantasy:{name:'Fantasy',items:[['Character goal','What does someone want in this scene or chapter?'],['Relevant world detail','Which custom, place, creature, or magical condition affects the action?'],['Limits & costs','What can this person or magic do, and what consequence matters here?'],['Conflict or discovery','What encounter changes the character or their understanding?'],['Result','What decision, cost, or discovery carries the story onward?']],map:[['Life in this world','Introduce a character and world through lived action.'],['New demand','Create a disturbance, invitation, or conflict.'],['Exploration','Develop relationships and reveal the world as it matters.'],['Limits exposed','Show the costs and complications of the path taken.'],['Decisive choice','Bring character and world conflicts together.'],['Changed world','Show consequences for the character and their surroundings.']]},
   scifi:{name:'Science fiction',items:[['Human goal','What does a person or other viewpoint character want here?'],['Speculative condition','What technology, environment, or social possibility affects that goal?'],['Constraint','What limitation, tradeoff, or consequence makes the premise matter?'],['Encounter or decision','How does someone act when faced with this condition?'],['Implication','What has changed for the character, community, or larger question?']],map:[['Ordinary life here','Make the speculative setting concrete through a character.'],['Premise in motion','Introduce a change or problem created by the speculative condition.'],['Exploration','Show attempts and their personal or social effects.'],['Complications','Test assumptions and reveal limits or unforeseen costs.'],['Consequential choice','Resolve the central conflict through an earned decision.'],['Implications','Show the resulting life or society and any remaining questions.']]}
  },
  nonfiction:{
   informative:{name:'Informative / explanatory',items:[['Reader question','What should the reader understand by the end of this chapter?'],['Explanation','Define the key idea and develop it in a logical order.'],['Support','What source, data, reasoning, or documented example supports it?'],['Nuance','What limit, disagreement, or exception changes how it should be understood?'],['Takeaway & bridge','What is the useful takeaway, and why does the next topic follow?']],map:[['Scope','Introduce the main question, audience, and boundaries.'],['Foundations','Explain the terms and background the reader needs.'],['Core topics','Develop connected ideas in a useful order.'],['Complexities','Examine examples, competing explanations, and limitations.'],['Synthesis','Connect the findings into a clearer understanding.'],['Closing','Answer the main question within the evidence available.']]},
   selfhelp:{name:'Self-help / personal growth',items:[['Recognizable difficulty','What real situation or reader concern makes this chapter relevant?'],['Useful idea','What perspective or skill might help, and why?'],['Example & support','Show an example and explain the basis for the advice.'],['Practice','Offer an optional exercise with clear, manageable steps.'],['Limits & reflection','What may vary by person? How can the reader reflect on an attempt?']],map:[['Reader concern','Describe the difficulty and realistic aim of the book.'],['Understanding','Explain useful concepts and relevant context.'],['Core approaches','Introduce practices with examples and reasons.'],['Obstacles','Address setbacks, limitations, and adaptations.'],['Integration','Help the reader connect practices to everyday life.'],['Next steps','Offer a flexible way to continue and review progress.']]},
   reflective:{name:'Reflective / spiritual',items:[['Lived moment','Start with an experience, observation, or question worth exploring.'],['Meaning & inquiry','What did you think or believe then? What did you notice when you looked closer?'],['Perspective & sources','Distinguish your experience, interpretation, faith, and any source teaching.'],['Example or contemplation','Develop the idea through a concrete example, image, or careful reflection.'],['Invitation & transition','Offer an optional question or practice; connect to what follows without forcing a conclusion.']],map:[['Opening question','Introduce a lived experience and the question it raises.'],['Looking closer','Explore what you noticed, thought, or believed.'],['Developing understanding','Connect experiences and ideas while retaining their distinctions.'],['Complications','Make room for doubt, exceptions, and unresolved questions.'],['Living with it','Show attempts to apply or contemplate the understanding.'],['Return & continuation','Revisit the opening question from your present perspective.']]},
   practical:{name:'Practical guide / how-to',items:[['Outcome & starting point','What should the reader be able to do? What must they already have or know?'],['Steps','Give actions in an order the reader can follow.'],['Worked example','Demonstrate the process with concrete inputs and a result.'],['Troubleshooting','What commonly goes wrong, and what can the reader try?'],['Completion check','How can the reader check the result and prepare for the next step?']],map:[['Goal & scope','Explain what the guide helps the reader do.'],['Preparation','Cover prerequisites, materials, and relevant precautions.'],['Basic process','Teach the core actions in a workable sequence.'],['Practice & variations','Show examples and adapt the method to different cases.'],['Troubleshooting','Address difficulties and ways to assess results.'],['Independent use','Provide a useful reference and next steps.']]},
   history:{name:'History / biography',items:[['Time, place & context','Orient the reader to the period, setting, and people.'],['Event or decision','What happened, and who acted?'],['Sources','Which records support the account? Where do sources disagree or fall short?'],['Interpretation','Explain causes or significance while marking uncertainty and perspective.'],['Consequence & link','What followed, and how does this connect to the larger account?']],map:[['Subject & scope','Define the person, period, or question being explored.'],['Background','Establish the conditions needed to understand the account.'],['Key developments','Follow events or themes using traceable sources.'],['Turning points','Explore decisions, pressures, and contested interpretations.'],['Consequences','Show later effects and different perspectives.'],['Assessment','Consider significance and the limits of what can be known.']]}
  },
  memoir:{
   chronological:{name:'Chronological memoir',items:[['Time & place','Where are we in your life, and what does the reader need to know?'],['Lived scene','Show a specific event through action, detail, and your experience.'],['Want or difficulty','What did you want, fear, or struggle with at that time?'],['Then & now','Where useful, reflect on what you understood then and what you see now.'],['Change & connection','What shifted? What consequence connects this period to the next?']],map:[['Opening lens','Introduce the central experience or question.'],['Earlier context','Establish relevant background without covering every year.'],['Developing events','Follow selected experiences in time order.'],['Significant shifts','Explore moments that changed your direction or understanding.'],['Consequences','Show what followed and how you responded.'],['Present perspective','Return to the central theme from where you are now.']]},
   thematic:{name:'Thematic memoir',items:[['Chapter theme','What question or recurring experience unites this chapter?'],['Selected moments','Choose scenes from your life that develop this theme.'],['Orientation','Make changes of time, place, and age clear.'],['Reflection','What do these moments reveal together, without forcing a lesson?'],['Connection','How does this theme deepen or complicate the next one?']],map:[['Central thread','Establish the question connecting the selected experiences.'],['First theme','Explore one aspect through concrete scenes.'],['Related themes','Add perspectives that deepen the central thread.'],['Tension','Place conflicting experiences or meanings in conversation.'],['Connections','Show what emerges across the themes.'],['Return','Revisit the central question with greater depth.']]},
   braided:{name:'Braided memoir',items:[['Active strand','Which period, relationship, or line of inquiry are we following now?'],['Concrete moment','Anchor this strand in an event or observation.'],['Time & transition','Help the reader recognize movement to another strand.'],['Resonance','How does this strand echo, challenge, or illuminate another?'],['Developing meaning','What emerges as the strands come together or remain in tension?']],map:[['Introduce strands','Establish the connected times, experiences, or questions.'],['Develop each strand','Give each line enough scene and context to stand on its own.'],['Alternate deliberately','Move between strands through clear transitions.'],['Deepen connections','Let parallels and differences accumulate.'],['Bring into relation','Draw the strands closer where their connection matters.'],['Closing perspective','Show what their relationship reveals, including what stays unresolved.']]}
  }
 };
 const roleNames={opening:'Opening',development:'Development',turning:'Turning point',application:'Action / application',closing:'Closing'};
 const rolePrompts={
  fiction:{opening:'Orient us to a character and situation. What unsettles it or draws us onward?',development:'Develop the conflict or relationship. What changes rather than repeats?',turning:'What discovery, choice, or reversal changes the direction of the story?',application:'What does the character do now, and what follows from that action?',closing:'What central tension resolves? What aftermath or deliberate uncertainty remains?'},
  nonfiction:{opening:'Establish the reader question, its relevance, and the scope of your discussion.',development:'Develop one connected idea with the explanation and support it needs.',turning:'What complication, exception, or new perspective changes the reader’s understanding?',application:'Show how the idea works in a concrete case or optional practice.',closing:'Bring the main points together. What can the reader reasonably take away?'},
  memoir:{opening:'Anchor us in a lived moment and the thread this memoir will follow.',development:'Develop an experience or relationship that adds depth to the central thread.',turning:'What event or realization changed your direction or understanding?',application:'Show how you responded or lived with what had happened.',closing:'Reflect from your present perspective. What has changed, and what remains open?'}
 };
 function rememberChoices(){scheduleSave();}
 const main=root.querySelector('#w-main');
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const selected=()=>chapters.find(c=>c.id===state.selected);
 const words=s=>s.trim()?s.trim().split(/\s+/u).length:0;
 function matchCase(original,replacement){return original.length>1&&original===original.toUpperCase()?replacement.toUpperCase():/^[A-Z]/.test(original)?replacement[0].toUpperCase()+replacement.slice(1):replacement;}
 function updateTyping(message=''){
  const status=root.querySelector('#w-typing-status'),actions=root.querySelector('#w-typing-actions');if(!status||!actions)return;
  status.textContent=message||({off:'Typing help is off.',suggest:'English typing help · spelling, sentence capitals, and spacing suggestions.',auto:'English typing help · common typos, sentence capitals, and “Ca n” corrected; other spacing changes suggested.'}[state.typing]);
  status.hidden=!message;const summary=root.querySelector('.w-typing-settings summary');if(summary)summary.textContent='Typing help · '+({off:'Off',suggest:'Suggestions',auto:'Autocorrect'}[state.typing]);
  actions.innerHTML=typingSuggestions.map((s,i)=>`<button type="button" data-typing-choice="${i}">Use “${escape(s.replacement)}”</button>`).join('')+(lastCorrection?'<button type="button" id="w-undo-correction">Undo correction</button>':'');
 }
 function applyTypingCorrection(s){
  const draft=root.querySelector('#w-draft');if(!draft||!s||draft.value!==s.before)return;
  const beforeFormats=clone(selected().formats||[]);if(!typingInput)recordEditorUndo();
  const before=draft.value,caret=draft.selectionStart;draft.setRangeText(s.replacement,s.start,s.end,'preserve');
  const adjusted=caret+s.replacement.length-(s.end-s.start);draft.focus();draft.setSelectionRange(adjusted,adjusted);
  lastCorrection={before,after:draft.value,caret,beforeFormats};typingSuggestions=[];setDraftText(draft.value);count();fitText();
  updateTyping(`Corrected “${before.slice(s.start,s.end)}” to “${s.replacement}”.`);
 }
 function undoTypingCorrection(){
  const draft=root.querySelector('#w-draft');if(!draft||!lastCorrection||draft.value!==lastCorrection.after)return;recordEditorUndo();
  draft.value=lastCorrection.before;draft.focus();draft.setSelectionRange(lastCorrection.caret,lastCorrection.caret);selected().text=draft.value;selected().formats=clone(lastCorrection.beforeFormats||[]);updateFormattedPreview();lastCorrection=null;typingSuggestions=[];count();fitText();updateTyping('Correction undone.');
 }
 function sentenceStartsBefore(text,start){
  const prefix=text.slice(Math.max(0,start-200),start);
  const boundary=/([.!?])(["'”’)\]}]*)(\s+)(["'“‘(\[{]*)$/.exec(prefix);
  if(!boundary)return false;
  const preceding=prefix.slice(0,boundary.index),token=/([^\s()[\]{}"“”]+)$/.exec(preceding)?.[1]||'';
  if(/(?:https?:\/\/|www\.|@)/i.test(token)||/\.[A-Za-z]{2,}$/.test(token)&&! /^(?:e\.g|i\.e|a\.m|p\.m)$/i.test(token))return false;
  if(boundary[1]==='.'){
   if(/[.\d]$/.test(preceding)||/^(?:[A-Za-z]\.)*[A-Z]$/.test(token))return false;
   if(/^(?:mr|mrs|ms|dr|prof|sr|jr|st|vs|etc|approx|dept|inc|no|nos|p|pp|fig|figs|vol|vols|ch|ed|eds|rev|hon|capt|lt|col|gen|e\.g|i\.e|a\.m|p\.m)$/i.test(token))return false;
  }
  return true;
 }
 function checkTypedWord(e){
  typingSuggestions=[];lastCorrection=null;
  if(state.typing==='off'||e.isComposing||!['insertText','insertLineBreak'].includes(e.inputType)||!(e.inputType==='insertLineBreak'||/^[\s.,!?;:"'”’)\]}]$/.test(e.data||''))){updateTyping();return;}
  const draft=e.target,caret=draft.selectionStart;if(caret!==draft.selectionEnd)return;
  const before=draft.value,prefix=before.slice(Math.max(0,caret-120),caret),offset=caret-prefix.length;
  const pair=/(?:^|\s)([A-Za-z]+) ([A-Za-z]+)([\s.,!?;:]+)$/.exec(prefix);
  if(pair){
   const left=pair[1],right=pair[2],a=left.toLowerCase(),b=right.toLowerCase(),start=offset+pair.index+pair[0].length-left.length-right.length-pair[3].length-1,end=caret-pair[3].length;
   const make=replacement=>{replacement=matchCase(left,replacement);if(sentenceStartsBefore(before,start))replacement=replacement[0].toUpperCase()+replacement.slice(1);return {before,start,end,replacement};};
   if(isPersonalWord(left)||isPersonalWord(right)){updateTyping();return;}
   if(a==='ca'&&b==='n'){
    const s=make('can');if(state.typing==='auto'){applyTypingCorrection(s);return;}typingSuggestions=[s];
   }else if(/^[a-z]+$/.test(right)&&/^(?:[a-z]+|[A-Z][a-z]+)$/.test(left)&&!(spacingWords.has(a)&&spacingWords.has(b))){
    const options=new Set();if(spacingWords.has(a+b))options.add(a+b);
    for(let n=1;n<=2;n++){
     if(b.length>n&&spacingWords.has(a+b.slice(0,n))&&spacingWords.has(b.slice(n)))options.add(a+b.slice(0,n)+' '+b.slice(n));
     if(a.length>n&&spacingWords.has(a.slice(0,-n))&&spacingWords.has(a.slice(-n)+b))options.add(a.slice(0,-n)+' '+a.slice(-n)+b);
    }
    typingSuggestions=[...options].map(make);
   }
  }
  if(typingSuggestions.length){updateTyping('Possible spacing change. Choose the wording you intended.');return;}
  const word=/(?:^|[\s"'“‘(\[{])([A-Za-z]+(?:['’\-][A-Za-z]+)*)([\s.,!?;:"'”’)\]}]+)$/.exec(prefix);
  if(word&&!isPersonalWord(word[1])){
   const end=caret-word[2].length,start=end-word[1].length;
   let replacement=commonTypos[word[1].toLowerCase()]?matchCase(word[1],commonTypos[word[1].toLowerCase()]):word[1];
   if(sentenceStartsBefore(before,start))replacement=replacement[0].toUpperCase()+replacement.slice(1);
   if(!commonTypos[word[1].toLowerCase()]&&!spacingWords.has(word[1].toLowerCase())){
    const missing=globalThis.WritingThesaurus?.missingLetterSuggestions?.(word[1]);
    if(missing?.words?.length){
     typingSuggestions=missing.words.map(candidate=>{let replacement=matchCase(word[1],candidate);if(sentenceStartsBefore(before,start))replacement=replacement[0].toUpperCase()+replacement.slice(1);return {before,start,end,replacement};});
     updateTyping('Possible missing letter. Choose the word you intended.'+(missing.limited?' Showing '+missing.words.length+' of '+missing.total+' choices.':''));return;
    }
   }
   if(replacement===word[1]){updateTyping();return;}
   const s={before,start,end,replacement};
   if(state.typing==='auto')applyTypingCorrection(s);else{typingSuggestions=[s];updateTyping('Possible spelling or capitalization change. Choose the wording you intended.');}
  }else updateTyping();
 }
 const genre=()=>library[state.type][state.genres[state.type]];
 const chapterRole=c=>c.roles?.[state.type]??({opening:'opening',question:'development',practice:'application'}[c.id]||'development');
 function appearance(){root.style.colorScheme=state.theme==='dark'?'dark':'light';root.classList.toggle('w-glass',state.theme==='glass');root.classList.toggle('w-solid-glass',state.solidGlass);root.querySelector('#w-transparency-control').hidden=state.theme!=='glass';root.querySelector('#w-solid').checked=state.solidGlass;root.querySelector('#w-theme').value=state.theme;root.querySelector('#w-font').value=state.font;root.style.setProperty('--w-draft-font',{chalkboard:'"Chalkboard SE","Chalkboard","Segoe Print","Comic Sans MS",cursive',serif:'Georgia,serif',sans:'system-ui,sans-serif',caveat:'"Studio Caveat",cursive',georgia:'Georgia,serif',palatino:'Palatino,"Palatino Linotype","Book Antiqua",serif',garamond:'Garamond,Baskerville,Georgia,serif',times:'"Times New Roman",Times,serif',courier:'"Courier New",Courier,monospace',trebuchet:'"Trebuchet MS",Arial,sans-serif',verdana:'Verdana,Geneva,sans-serif'}[state.font]);onPaletteAppearance();studioAppearance();}
 function fitText(){root.querySelectorAll('textarea').forEach(WritingLayout.fit);}
 function count(){root.querySelector('#w-wordcount').textContent=`${words(selected().text)} ${entryWord()} words · ${chapters.reduce((n,c)=>n+words(c.text),0)} manuscript words`;}
 function tree(){
  const q=root.querySelector('#w-search').value.toLocaleLowerCase().trim();
  const excerpt=value=>{const lower=value.toLocaleLowerCase(),at=lower.indexOf(q);if(at<0)return null;const start=Math.max(0,at-48),end=Math.min(value.length,at+q.length+72);return (start?'…':'')+value.slice(start,end).replace(/\s+/g,' ')+(end<value.length?'…':'');};
  const matches=chapters.map(c=>{if(!q)return {chapter:c,where:'',excerpt:''};for(const [key,label] of [['title','Title'],['note','Chapter notes'],['text','Draft']]){const found=excerpt(c[key]||'');if(found!==null)return {chapter:c,where:label,excerpt:found};}return null;}).filter(Boolean);
  const status=root.querySelector('#w-search-status'),clear=root.querySelector('#w-clear-search');
  status.textContent=q?`${matches.length} matching ${matches.length===1?entryWord():entryWord(true)} of ${chapters.length}.`:`${chapters.length} ${chapters.length===1?entryWord():entryWord(true)}.`;
  clear.hidden=!q;
  root.querySelector('#w-chapters').innerHTML=matches.length?matches.map(({chapter:c,where,excerpt:match})=>{
   const meta=[state.type==='journaling'?'':c.status,q?where+': “'+match+'”':''].filter(Boolean).join(' · ');
   return `<button type="button" class="w-chapter" data-chapter="${c.id}" aria-pressed="${c.id===state.selected}">${escape(c.title)}${meta?'<span>'+escape(meta)+'</span>':''}</button>`;
  }).join(''):'<div class="w-search-empty"><p role="status">No entries or chapters match this search.</p><p class="w-secondary">Try a shorter phrase or use Clear search to browse every chapter.</p></div>';
 }
 function render(){
  prepareStudioRender();
  root.classList.toggle('w-characters-mode',state.view==='characters');
  const c=selected();
  typingSuggestions=[];lastCorrection=null;
  appearance();root.querySelector('#w-type').value=state.type;
  root.classList.toggle('w-focus',state.focus);root.style.setProperty('--w-prose',state.prose+'px');
  root.querySelector('#w-focus').setAttribute('aria-pressed',state.focus);root.querySelector('#w-focus').textContent=state.focus?'Exit focus':'Focus mode';
  root.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===state.view));
  tree();count();
  if(state.view==='write'){
   main.innerHTML=`<div class="w-row"><p class="w-chapter-number">Chapter ${String(chapters.indexOf(c)+1).padStart(2,'0')}</p><span class="w-secondary">${escape(c.status)}</span></div><h2>${escape(c.title)}</h2><section class="w-typing-tools" aria-label="Typing help"><label for="w-typing">Typing help</label><select id="w-typing"><option value="off" ${state.typing==='off'?'selected':''}>Off</option><option value="suggest" ${state.typing==='suggest'?'selected':''}>Suggestions</option><option value="auto" ${state.typing==='auto'?'selected':''}>Autocorrect</option></select><p class="w-secondary">English corrections run when you finish a word with a space, punctuation, or Enter. Includes common typos, standalone I, and sentence capitals after . ? !. Missing-letter guesses appear as choices for you to review. Personal dictionary words are protected.</p><p class="w-secondary" id="w-typing-status" role="status"></p><div id="w-typing-actions"></div></section><textarea id="w-draft" aria-label="Chapter draft" placeholder="Begin writing here…" lang="en" spellcheck="${state.typing!=='off'}" autocorrect="off" autocapitalize="off">${escape(c.text)}</textarea><section class="w-sequence"><h3>Your chapter sequence</h3><div class="w-sequence-grid">${chapters.map((x,i)=>`<button type="button" data-chapter="${x.id}" aria-pressed="${x.id===c.id}"><span class="w-secondary">${String(i+1).padStart(2,'0')} · ${x.status}</span><span>${escape(x.title)}</span></button>`).join('')}</div></section>`;
   updateTyping();
  }else if(state.view==='research'){
   main.innerHTML=researchView();
  }else if(state.view==='characters'){
   main.innerHTML=charactersView();
  }else if(state.view==='reading'){
   main.innerHTML=readingView();
  }else if(state.view==='backups'){
   main.innerHTML=backupsView();renderFolderDetails();
  }else if(state.view==='trash'){
   main.innerHTML=trashView();
  }else if(state.view==='help'){
   main.innerHTML=helpView();
  }else{
   main.innerHTML=exportView();
  }
  enrichView();fitText();enrichNavigation();enrichStudio();
 }
 function exportDetail(){}
// Inject inside the main app closure after `library`, `roleNames`, and
// `rolePrompts` are declared. Keep user-visible type and genre controls backed
// by the same module as project and storage validation.
Object.assign(library, WritingGenres.mergeIntoLibrary(library));
Object.assign(roleNames, WritingGenres.roleNames);
Object.assign(rolePrompts, WritingGenres.mergeRolePrompts(rolePrompts));

function initializeGenreChoices(genres) {
  return WritingGenres.initializeGenreChoices(genres);
}

function normalizeProjectType(typeId) {
  return WritingGenres.types.some(({ id }) => id === typeId) ? typeId : "nonfiction";
}

function projectTypeOptions(selectedType) {
  return WritingGenres.projectTypeOptions(selectedType);
}

function projectTypeLabel(typeId) {
  return WritingGenres.projectTypeLabel(typeId);
}

function projectTypeNote(typeId) {
  return WritingGenres.types.find(({ id }) => id === typeId)?.note || "Choose a project type.";
}

function genreLabel(typeId) {
  return WritingGenres.genreLabel(typeId);
}

function genreOptions(typeId, selectedGenre) {
  return WritingGenres.genreOptions(typeId, selectedGenre);
}

state.type = normalizeProjectType(state.type);
state.genres = initializeGenreChoices(state.genres);

root.addEventListener('change',event=>{if(event.target.id==='w-project-genre'){state.genres[state.type]=event.target.value;render();scheduleSave();}});
document.getElementById('w-dialog').addEventListener('change',event=>{if(event.target.id==='w-new-type'){const type=event.target.value;document.getElementById('w-new-genre').innerHTML=genreOptions(type,WritingGenres.defaults[type]);document.getElementById('w-new-type-note').textContent=projectTypeNote(type);}});
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
   main.querySelector('.w-chapter-number').textContent=journal?'Journal entry':'Chapter '+String(chapters.indexOf(selected())+1).padStart(2,'0');
   const title=main.querySelector('#w-title');title.setAttribute('aria-label',word+' title');title.placeholder=journal?'Give this entry a title':'Chapter title';
   main.querySelector('h2').insertAdjacentHTML('afterend',createdMarkup(selected()));
   main.querySelector('#w-draft').setAttribute('aria-label',word+' draft');
   main.querySelector('#w-draft').placeholder=journal?'What is on your mind?':'Begin writing here…';
   main.querySelector('.w-chapter-number').nextElementSibling.hidden=journal;
   main.querySelector('#w-delete-chapter').textContent='Delete '+entryWord();
  }
 }
 const uid=()=>globalThis.crypto?.randomUUID?.()||'id-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
 const clone=x=>JSON.parse(JSON.stringify(x));
 const blankChapter=(title=isJournal()?'Untitled entry':'Untitled chapter')=>({id:uid(),title,createdAt:new Date().toISOString(),status:'Outlined',summary:'',text:'',note:'',task:'',idea:'',saved:'',planOutline:'',alignment:'left'});
 const blankProject=(title='My manuscript',type='nonfiction')=>({id:uid(),title,type,chapters:[blankChapter(type==='journaling'?'Untitled entry':'Chapter one')],sources:[],characters:[],trash:[],history:[],genres:initializeGenreChoices()});
 let data,saveTimer,blocked=false,dirty=false,dialogAction=null,dialogOptions={},dialogReturn=null,blockReason=null;
 const project=()=>data.projects.find(p=>p.id===data.activeProject);
 function saveStatus(message,error=false){const el=root.querySelector('#w-save-status');el.textContent=message;el.classList.toggle('w-error',error);el.hidden=!error;el.setAttribute('aria-live',error?'assertive':'off');}
 function initialize(){
  try{data=WritingStore.load();}catch(error){blocked=true;blockReason='corrupt';saveStatus('Saved data could not be read: '+(error.cause?.message||error.message)+'. Import a backup to recover.',true);}
  if(!data){freshWorkspace=true;const p=blankProject();data={version:1,projects:[p],activeProject:p.id,preferences:{},trashProjects:[]};}
  data.trashProjects??=[];
  for(const key of ['theme','font','typing','solidGlass','prose','typingGlow'])if(key in data.preferences)state[key]=data.preferences[key];state.focus=false;
  if(!data.projects.some(p=>p.id===data.activeProject))data.activeProject=data.projects[0].id;
  activateProject();
  if(!blocked)saveStatus('Ready · edits save locally');
 }
 function activateProject(){const p=project();p.characters??=[];chapters=p.chapters;state.type=p.type;state.genres=initializeGenreChoices(p.genres);state.selected=p.selected&&chapters.some(c=>c.id===p.selected)?p.selected:chapters[0].id;state.view='write';}
 function syncData(){const p=project();p.type=state.type;p.genres={...state.genres};p.selected=state.selected;data.preferences={...data.preferences,studioChapters:studioReady?studioChapters:(data.preferences.studioChapters??studioChapters),theme:state.theme,typingGlow:state.typingGlow!==false,font:state.font,typing:state.typing,solidGlass:state.solidGlass,palette:WritingPalette.normalize(state.palette),prose:state.prose,personalDictionary:data.preferences.personalDictionary||[],dictionaryTrash:data.preferences.dictionaryTrash||[]};}
 function flushSave(){clearTimeout(saveTimer);if(!dirty)return !blocked;if(blocked){saveStatus('Saving paused. Download a backup or reopen the app.',true);return false;}syncData();try{WritingStore.save(data);dirty=false;queueFolderBackup();saveStatus('Saved locally · '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));return true;}catch(error){queueFolderBackup();saveStatus('Save failed · download a backup to keep your work',true);return false;}}
 function scheduleSave(){dirty=true;if(blocked){saveStatus('Saving paused · download a backup',true);return;}if(!root.querySelector('#w-save-status').classList.contains('w-error'))saveStatus('Saving…');clearTimeout(saveTimer);saveTimer=setTimeout(flushSave,500);}
 function toTrash(kind,item,label,chapterId){project().trash.unshift({id:uid(),kind,item:clone(item),label,...(chapterId?{chapterId}:{}),position:kind==='chapter'?chapters.findIndex(c=>c.id===item.id):null,deletedAt:new Date().toISOString()});}
 function field(name,label,value='',multiline=false){return `<label>${escape(label)}${multiline?`<textarea name="${name}" rows="4">${escape(value)}</textarea>`:`<input name="${name}" value="${escape(value)}" ${name==='title'?'required':''} maxlength="${name==='title'?200:20000}">`}</label>`;}
 function showDialog(title,fields,action,button,options={}){dialogOptions=options;const active=document.activeElement,menu=active?.closest('.w-menu');dialogReturn=menu?.querySelector('summary')||active;button??=({'New project':'Create project','Add chapter':'Add chapter','Rename project':'Rename project','Add research / element':'Add record','Edit record':'Save record','Import text as chapter':'Import chapter'})[title]||'Save changes';dialogAction=action;document.getElementById('w-dialog-title').textContent=title;document.getElementById('w-dialog-fields').innerHTML=fields+'<p id="w-dialog-error" role="alert" hidden></p>';document.getElementById('w-dialog-save').textContent=button;document.getElementById('w-dialog').showModal();}
 function confirmAction(title,message,action,button='Move to Trash'){showDialog(title,`<p>${escape(message)}</p>`,()=>action(),button);}
 const sourceFields=s=>'<section class="w-dialog-section" aria-label="Source details"><h3>Source details</h3>'+field('title','Title',s.title)+field('author','Author / creator',s.author)+field('locator','Page, date, or location',s.locator)+field('url','Source URL (saved as a reference)',s.url)+'</section><section class="w-dialog-section" aria-label="Quoted passage"><h3>Quoted passage</h3>'+field('quotation','Exact quotation',s.quotation,true)+'</section><section class="w-dialog-section" aria-label="Your notes"><h3>Your notes</h3>'+field('notes','Your own notes',s.notes,true)+'</section>';
 function researchView(){return `<div class="w-row"><h2>Research &amp; elements</h2><button id="w-add-source">Add record</button></div><p class="w-secondary">Keep sources, people, places, and ideas here. URLs are references; save excerpts for offline use.</p><div class="w-list">${project().sources.length?project().sources.map(s=>`<section class="w-plancard"><h3>${escape(s.title)}</h3><p>${escape(s.author||'')}</p><p class="w-secondary">${escape(s.locator||'')}${s.url?'<br>'+escape(s.url):''}</p>${s.quotation?`<section class="w-record-section" aria-label="Exact quotation"><h4>Exact quotation</h4><blockquote>${escape(s.quotation).replace(/\n/g,'<br>')}</blockquote></section>`:''}${s.notes?`<section class="w-record-section" aria-label="Your own notes"><h4>Your own notes</h4><p>${escape(s.notes).replace(/\n/g,'<br>')}</p></section>`:''}<div class="w-row w-record-actions"><button data-edit-source="${s.id}">Edit record</button><button data-delete-source="${s.id}">Delete</button></div></section>`).join(''):'<p>No records yet. Add a source or an element you want to keep nearby.</p>'}</div>`;}
 function trashView(){return `<h2>Trash</h2><p class="w-secondary">Restore deleted items here. Permanent deletion cannot be undone.</p><div class="w-list">${project().trash.map(t=>`<section class="w-plancard"><strong>${escape(t.label)}</strong><p class="w-secondary">${escape(t.kind)} · ${escape(new Date(t.deletedAt).toLocaleString())}</p><button data-restore-trash="${t.id}">Restore</button><button data-purge-trash="${t.id}">Delete permanently</button></section>`).join('')||'<p>This project’s Trash is empty.</p>'}${data.trashProjects.map(t=>`<section class="w-plancard"><strong>Project: ${escape(t.item.title)}</strong><p class="w-secondary">Deleted ${escape(new Date(t.deletedAt).toLocaleString())}</p><button data-restore-project="${t.id}">Restore project</button><button data-purge-project="${t.id}">Delete permanently</button></section>`).join('')}</div>`;}
 function exportView(){return `<h2>Export your manuscript</h2><p class="w-secondary">Chapter headings and draft text, in the order below. Private notes and research stay in the project backup.</p><section class="w-section" aria-label="Manuscript export"><h3>Manuscript download</h3><label for="w-format">Output format<select id="w-format">${['PDF','Markdown','TXT','DOCX','Reading HTML'].map(x=>`<option value="${x}" ${state.format===x?'selected':''}>${({'PDF':'PDF — share or print','Markdown':'Markdown — text markup','TXT':'Plain text — text only','DOCX':'Word (.docx) — continue editing','Reading HTML':'Reading HTML — read in a browser'})[x]}</option>`).join('')}</select></label><ol>${chapters.map(x=>`<li>${escape(x.title)} · ${words(x.text)} words</li>`).join('')}</ol><button id="w-download">Download manuscript</button><button id="w-print">Print / save as PDF</button><p id="w-export-status" role="status" class="w-secondary"></p><p class="w-secondary">Word, PDF, and Reading HTML preserve chapter alignment. TXT and Markdown contain plain text. PDF uses a book serif font with page numbers. For characters outside that font, use Print / save as PDF.</p></section><section class="w-section" aria-label="Complete project backup"><h3>Complete project backup</h3><p class="w-secondary">Includes all projects, character profiles, notes, research, Trash, and saved versions. Keep a copy in a folder or on another drive.</p><button id="w-backup-view">Download full backup</button></section>`;}
 function enrichView(){
  root.querySelector('#w-type').innerHTML=projectTypeOptions(state.type);
  root.querySelector('#w-project').innerHTML=data.projects.map(p=>`<option value="${p.id}" ${p.id===data.activeProject?'selected':''}>${escape(p.title)}</option>`).join('');
  if(state.view==='write'){
   const h=main.querySelector('h2');h.innerHTML=`<input id="w-title" aria-label="Chapter title" value="${escape(selected().title)}">`;
   h.insertAdjacentHTML('afterend',`<div class="w-row w-editor-actions"><label>Text size<select id="w-prose">${[16,18,20,22].map(n=>`<option ${state.prose===n?'selected':''}>${n}</option>`).join('')}</select></label><button id="w-delete-chapter">Delete chapter</button></div>`);
   const chapterAlignment=['left','right','justify'].includes(selected().alignment)?selected().alignment:'left';
   main.querySelector('.w-editor-actions').insertAdjacentHTML('beforeend',`<label class="w-alignment-control" for="w-alignment">Draft alignment<select id="w-alignment">${['left','right','justify'].map(value=>`<option value="${value}" ${chapterAlignment===value?'selected':''}>${{left:'Left',right:'Right',justify:'Justified'}[value]}</option>`).join('')}</select></label>`);
   main.querySelector('#w-draft').style.textAlign=chapterAlignment;writingControls();
   const typing=main.querySelector('.w-typing-tools'),status=typing.querySelector('#w-typing-status'),actions=typing.querySelector('#w-typing-actions');
   const modeLabel={off:'Off',suggest:'Suggestions',auto:'Autocorrect'}[state.typing];
   const settings=document.createElement('details');settings.className='w-typing-settings';settings.innerHTML='<summary>Typing help · '+modeLabel+'</summary>';
   while(typing.firstChild){const child=typing.firstChild;if(child===status||child===actions){child.remove();}else settings.append(child);}
   typing.append(settings,status,actions);status.hidden=!lastCorrection&&!typingSuggestions.length;
  }
 }
 function backup(){syncData();const text=WritingStore.serialize(data);WritingExport.download(text,'writing-studio-backup-'+new Date().toISOString().slice(0,10)+'.json','application/json');saveStatus('Backup downloaded · keep it somewhere safe');}
 function remapProject(p){const ids=new Map();p.id=uid();for(const c of p.chapters){ids.set(c.id,uid());c.id=ids.get(c.id);}for(const t of p.trash){t.id=uid();if(t.kind==='chapter'){const old=t.item.id;if(!ids.has(old))ids.set(old,uid());t.item.id=ids.get(old);}}for(const t of p.trash){if(t.chapterId)t.chapterId=ids.get(t.chapterId)||t.chapterId;if(t.kind==='version'){t.item.id=uid();t.item.chapterId=ids.get(t.item.chapterId)||t.item.chapterId;}}for(const h of p.history){h.id=uid();h.chapterId=ids.get(h.chapterId)||h.chapterId;}for(const s of p.sources)s.id=uid();for(const c of p.characters||[])c.id=uid();for(const t of p.trash)if(t.kind==='character')t.item.id=uid();p.selected=ids.get(p.selected)||p.chapters[0].id;}
 function restoreItem(id){const p=project(),i=p.trash.findIndex(t=>t.id===id),t=p.trash[i];if(!t)return;if(t.kind==='chapter'){p.chapters.splice(Number.isInteger(t.position)?Math.max(0,Math.min(t.position,p.chapters.length)):p.chapters.length,0,t.item);state.selected=t.item.id;}else if(t.kind==='source')p.sources.push(t.item);else if(t.kind==='character'){p.characters??=[];if(p.characters.length>=1000){saveStatus('Move a character to Trash before restoring another profile.',true);return;}if(p.characters.some(c=>c.id===t.item.id)){saveStatus('This character is already present. The Trash copy has been kept.',true);return;}p.characters.push(t.item);characterChoices.set(p.id,t.item.id);characterQueries.set(p.id,'');}else if(t.kind==='version'){p.history.unshift(t.item);if(chapters.some(c=>c.id===t.item.chapterId))state.selected=t.item.chapterId;}else{let c=chapters.find(c=>c.id===t.chapterId);if(!c){c=blankChapter('Recovered notes');chapters.push(c);}const key={outline:'planOutline',note:'note',idea:'idea',saved:'saved',task:'task'}[t.kind];if(key)c[key]=(c[key]?c[key]+'\n\n':'')+t.item;state.selected=c.id;}p.trash.splice(i,1);if(t.kind==='chapter')navigationTrigger={id:'restore-chapter',draft:true};state.view=t.kind==='source'?'research':t.kind==='character'?'characters':'write';render();scheduleSave();navigationNotice('Restored '+t.label+'.');}
 document.getElementById('w-form').addEventListener('submit',e=>{e.preventDefault();const form=new FormData(e.target),values=Object.fromEntries(form.entries());Object.keys(values).forEach(k=>values[k]=values[k].trim());try{dialogAction?.(values);document.getElementById('w-dialog').close();if(dialogOptions.render!==false){render();scheduleSave();}}catch(error){saveStatus(error.message,true);const notice=document.getElementById('w-dialog-error');if(notice){notice.hidden=false;notice.textContent=error.message;}}});
 document.getElementById('w-dialog-cancel').addEventListener('click',()=>document.getElementById('w-dialog').close());
 root.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  const c=selected(),p=project();
  if(b.id==='w-add-chapter')showDialog('Add '+entryWord(),field('title',entryHeading()+' title'),v=>{const c=blankChapter(v.title);chapters.push(c);state.selected=c.id;state.view='write';},'Add '+entryWord());
  else if(b.id==='w-delete-chapter')confirmAction('Delete '+entryWord()+'?',`“${c.title}” and its notes will move to Trash.`,()=>{toTrash('chapter',c,c.title);const i=chapters.indexOf(c);chapters.splice(i,1);if(!chapters.length)chapters.push(blankChapter());state.selected=chapters[Math.min(i,chapters.length-1)].id;});
  else if(b.dataset.deleteField){const key=b.dataset.deleteField,kind=key==='planOutline'?'outline':key;if(c[key])confirmAction('Delete '+kind+'?', 'This item will move to Trash.',()=>{toTrash(kind,c[key],c.title+' · '+kind,c.id);c[key]='';if(key==='planOutline')c.addedGuides={};});}
  else if(b.id==='w-new-project')showDialog('New project',field('title','Project title')+`<label>Project type<select name="type" id="w-new-type">${projectTypeOptions('nonfiction')}</select></label><label>Genre / approach<select name="genre" id="w-new-genre">${genreOptions('nonfiction',WritingGenres.defaults.nonfiction)}</select></label><p class="w-secondary" id="w-new-type-note">${escape(projectTypeNote('nonfiction'))}</p>`,v=>{syncData();if(!library[v.type]?.[v.genre])throw new Error('Choose a supported genre.');const p=blankProject(v.title,v.type);p.genres[v.type]=v.genre;data.projects.push(p);data.activeProject=p.id;activateProject();});
  else if(b.id==='w-rename-project')showDialog('Rename project',field('title','Project title',p.title),v=>p.title=v.title);
  else if(b.id==='w-delete-project')confirmAction('Delete project?',`“${p.title}” and all its contents will move to Trash.`,()=>{syncData();data.trashProjects.unshift({id:uid(),kind:'project',label:p.title,item:clone(p),deletedAt:new Date().toISOString()});data.projects=data.projects.filter(x=>x.id!==p.id);if(!data.projects.length)data.projects.push(blankProject());data.activeProject=data.projects[0].id;activateProject();state.view='trash';});
  else if(b.id==='w-backup'||b.id==='w-backup-view')backup();
  else if(b.id==='w-import')root.querySelector('#w-import-file').click();
  else if(b.id==='w-add-source')showDialog('Add research / element',sourceFields({}),v=>p.sources.push({id:uid(),...v}));
  else if(b.dataset.editSource){const s=p.sources.find(s=>s.id===b.dataset.editSource);showDialog('Edit record',sourceFields(s),v=>Object.assign(s,v));}
  else if(b.dataset.deleteSource){const s=p.sources.find(s=>s.id===b.dataset.deleteSource);confirmAction('Delete record?',`“${s.title}” will move to Trash.`,()=>{toTrash('source',s,s.title);p.sources=p.sources.filter(x=>x.id!==s.id);});}
  else if(b.dataset.restoreTrash)restoreItem(b.dataset.restoreTrash);
  else if(b.dataset.purgeTrash)confirmAction('Delete permanently?','This item cannot be restored afterward. Download a backup first if you want to keep a copy.',()=>p.trash=p.trash.filter(t=>t.id!==b.dataset.purgeTrash),'Delete permanently');
  else if(b.dataset.restoreProject){const i=data.trashProjects.findIndex(t=>t.id===b.dataset.restoreProject),t=data.trashProjects[i];data.projects.push(t.item);data.trashProjects.splice(i,1);data.activeProject=t.item.id;activateProject();render();}
  else if(b.dataset.purgeProject)confirmAction('Delete project permanently?','The project and all its contents will be removed from this workspace.',()=>data.trashProjects=data.trashProjects.filter(t=>t.id!==b.dataset.purgeProject),'Delete permanently');
  else if(b.id==='w-download'){
   const name=p.title.replace(/[\\/:*?"<>|]/g,'-')||'manuscript',format=state.format;
   if(format==='PDF'){try{WritingExport.download(WritingPDF.pdf(p),name+'.pdf','application/pdf');root.querySelector('#w-export-status').textContent='PDF download started.';}catch(error){const notice=root.querySelector('#w-export-status');notice.textContent=error.message;notice.classList.add('w-error');}}
   else if(format==='DOCX')WritingExport.download(WritingExport.docx(p),name+'.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document');
   else if(format==='Reading HTML')WritingExport.download(WritingExport.html(p),name+'.html','text/html');
   else if(format==='TXT'||format==='Plain text')WritingExport.download(WritingExport.text(p),name+'.txt','text/plain');
   else WritingExport.download(WritingExport.markdown(p),name+'.md','text/markdown');
  }else if(b.id==='w-print'){const win=window.open('','_blank');if(win){win.document.open();win.document.write(WritingExport.html(p));win.document.close();win.focus();win.print();}else saveStatus('Allow the reading window to print, or download Reading HTML.',true);}
  if(!['w-import','w-backup','w-backup-view','w-print','w-download'].includes(b.id))scheduleSave();
 });
 root.addEventListener('input',e=>{const el=e.target;if(el.id==='w-title'){selected().title=el.value;tree();}if(!['w-search','w-import-file'].includes(el.id))scheduleSave();});
 root.addEventListener('change',e=>{
  const el=e.target;
  if(el.id==='w-project'){syncData();data.activeProject=el.value;activateProject();render();}
  else if(el.id==='w-alignment'){selected().alignment=el.value;root.querySelector('#w-draft').style.textAlign=el.value;}
  else if(el.id==='w-prose'){state.prose=Number(el.value);root.style.setProperty('--w-prose',state.prose+'px');fitText();}
  else if(el.id==='w-format'){state.format=el.value;const notice=root.querySelector('#w-export-status');if(notice){notice.textContent='';notice.classList.remove('w-error');}}
  if(!['w-import-file'].includes(el.id))scheduleSave();
 });
 root.querySelector('#w-import-file').addEventListener('change',async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  if(file.size>20*1024*1024){saveStatus('Import is too large (maximum 20 MB).',true);return;}
  try{const content=await file.text();if(file.name.toLowerCase().endsWith('.json')){
   const imported=WritingStore.parse(content);
   confirmAction('Import project backup?','Projects will be added as separate copies. Your current projects will remain available.',()=>{
    addBackupCopies(imported);
   },'Import backup');
  }else{showDialog('Import text as chapter',field('title','Chapter title',file.name.replace(/\.[^.]+$/,'')),v=>{const c=blankChapter(v.title);c.text=content;chapters.push(c);state.selected=c.id;state.view='write';});}
  }catch(error){saveStatus('Import failed: '+error.message,true);}
 });
 root.addEventListener('keydown',e=>{if(e.target.id==='w-draft'&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z')scheduleSave();});
 window.addEventListener('pagehide',flushSave);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)flushSave();});
 window.addEventListener('beforeunload',e=>{if(dirty&&!flushSave()){e.preventDefault();e.returnValue='';}});
 window.addEventListener('storage',e=>{if(e.key==='writing-desk-v1'){blocked=true;blockReason='concurrent';saveStatus('Another window changed this workspace. Download a backup, then reload.',true);}});
 let freshWorkspace=false,folderHold=true,folderConnected=false,folderFiles=[],folderLoading=false,pendingFolderSave=false;
 const editHistory=new Map();let draftSelection=null,typingInput=false,thesaurusSelection=null,thesaurusChoices=[];
 const folderBackups=WritingLocalBackup.createClient({onStatus:updateFolderStatus,onConflict:updateFolderStatus});
 function updateFolderStatus(status){
  if(status.available&&!folderConnected){folderConnected=true;if(status.lastBackup)folderHold=true;}
  const el=root.querySelector('#w-folder-status');if(!el)return;
  const date=status.lastBackup?new Date(status.lastBackup).toLocaleString():'';
  el.textContent=status.conflict?'Folder backup paused · another window saved changes':status.error&&status.available?'Folder backup needs attention · '+status.error:status.available?(folderHold?'Folder copy differs · open Folder backups to choose a workspace':date?'Folder backup · '+date:'Folder backup ready · waiting for an edit'):'Automatic folder backups need the desktop launcher · Use Project → Back up projects here';
  el.classList.toggle('w-error',!!(status.error&&status.available)||!!status.conflict);el.hidden=!(status.error&&status.available||status.conflict||(status.available&&folderHold));el.setAttribute('aria-live',el.hidden?'off':'polite');
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
 function backupsView(){return `<h2>Folder backups</h2><p class="w-secondary">The local launcher keeps complete project copies on this computer. Browser autosave and folder backups have separate status indicators.</p><div id="w-folder-details"></div><section class="w-section" aria-label="Portable backup"><h3>Portable backup</h3><button id="w-backup-view">Download a portable backup</button><p class="w-secondary">Keep another copy on a different drive for protection against a lost or damaged computer.</p></section>`;}
 function renderFolderDetails(){
  const el=main.querySelector('#w-folder-details');if(!el)return;const s=folderBackups.state;
  el.innerHTML=!s.available?'<section class="w-section" aria-label="Folder backup status"><h3>Folder backup status</h3><p>Open the app using the Mac or Windows launcher to enable automatic folder backups. The standalone HTML edition supports downloaded backups.</p></section>':`<section class="w-section" aria-label="Folder backup status"><h3>Backup folder</h3><p class="w-path">${escape(s.folder||'')}</p><p>${s.lastBackup?'Last successful backup: '+escape(new Date(s.lastBackup).toLocaleString()):'No folder backup yet.'}</p>${s.error?`<p role="alert" class="w-error">${escape(s.error)}</p>`:''}${folderHold?'<p>The saved folder copy differs from this browser’s workspace. Import it as separate project copies, or choose to back up the workspace currently open here.</p><button data-read-backup="latest.json">Import latest backup</button><button id="w-folder-fresh">Use this workspace</button>':'<button id="w-folder-now">Back up now</button>'}${s.conflict?'<button id="w-folder-reconnect">Reconnect to folder backups</button>':''}<button id="w-folder-refresh">Refresh backup list</button></section><section class="w-section" aria-label="Recover a backup copy"><h3>Recover a copy</h3><p class="w-secondary">Imports add separate project copies. The listed older copies remain in the folder.</p>${folderLoading?'<p>Loading copies…</p>':folderFiles.map(file=>`<div class="w-backup-item"><span>${escape(file.name)}<br><span class="w-secondary">${escape(file.date?new Date(file.date).toLocaleString():'')}</span></span><button data-read-backup="${escape(file.name)}">Import this copy</button></div>`).join('')||'<p>No copies listed yet.</p>'}</section>`;
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
  if(typeof studioGlow!=='undefined')studioGlow?.refresh();
  updateFormattingState();
 }
 function writingControls(){
  draftSelection=null;
  const c=selected(),draft=main.querySelector('#w-draft');
  main.querySelector('.w-editor-actions').insertAdjacentHTML('beforeend',`<label class="w-alignment-control" for="w-spacing">Line spacing<select id="w-spacing">${[1.4,1.7,2].map(value=>`<option value="${value}" ${(c.lineSpacing||1.7)===value?'selected':''}>${value===1.4?'Compact':value===1.7?'Comfortable':'Double'}</option>`).join('')}</select></label>`);
  draft.style.lineHeight=c.lineSpacing||1.7;
  draft.insertAdjacentHTML('beforebegin','<div class="w-writing-toolbar" role="group" aria-label="Writing controls"><button id="w-bold" title="Bold selected words (Ctrl/Cmd+B)"><strong>Bold</strong></button><button id="w-italic" title="Italic selected words (Ctrl/Cmd+I)"><em>Italic</em></button><button id="w-editor-undo">Undo</button><button id="w-editor-redo">Redo</button><button id="w-dictionary">Personal dictionary</button><button id="w-thesaurus">Thesaurus</button><details class="w-shortcuts"><summary>Keyboard shortcuts</summary><p>Ctrl/Cmd+B: bold selection<br>Ctrl/Cmd+I: italic selection<br>Ctrl/Cmd+Z: undo draft edit<br>Ctrl/Cmd+Shift+Z: redo<br>Ctrl/Cmd+S: save<br>Ctrl/Cmd+Shift+R: read manuscript</p></details></div><p id="w-formatting-status" class="w-secondary" role="status">Select words to format them. The preview shows how they will look in Word, PDF, Markdown, and reading copies.</p>');
  updateFormattedPreview();
 }
 function readingView(){const p=project();return `<h2>${escape(p.title)}</h2><p class="w-secondary">Whole manuscript · ${chapters.reduce((n,c)=>n+words(c.text),0)} words</p><details class="w-reading-toc"><summary>Jump to ${entryWord()}</summary>${chapters.map(c=>`<a href="#w-read-${c.id}">${escape(c.title)}</a>`).join('')}</details>${chapters.map((c,i)=>`<section id="w-read-${c.id}" class="w-reading-chapter"><div class="w-row"><div><p class="w-chapter-number">${isJournal()?'Journal entry':'Chapter '+String(i+1).padStart(2,'0')}</p><h3>${escape(c.title)}</h3>${createdMarkup(c)}</div><button data-edit-reading="${c.id}">Edit ${entryWord()}</button></div><div class="w-reading-text" style="text-align:${['left','right','justify'].includes(c.alignment)?c.alignment:'left'};line-height:${[1.4,1.7,2].includes(c.lineSpacing)?c.lineSpacing:1.7}">${WritingTextTools.html(c.text,c.formats)||'<span class="w-secondary">This chapter is empty.</span>'}</div></section>`).join('')}`;}
 root.addEventListener('mousedown',e=>{if(e.target.closest('#w-bold,#w-italic'))e.preventDefault();});
 root.addEventListener('select',e=>{if(e.target.id==='w-draft'){draftSelection={chapterId:selected().id,start:e.target.selectionStart,end:e.target.selectionEnd};updateFormattingState();}},true);
 root.addEventListener('beforeinput',e=>{if(e.target.id!=='w-draft')return;if(e.inputType==='historyUndo'||e.inputType==='historyRedo'){e.preventDefault();editorUndo(e.inputType==='historyRedo');return;}recordEditorUndo(e.inputType);});
 root.addEventListener('keydown',e=>{
  if(!(e.ctrlKey||e.metaKey)||e.altKey||e.isComposing)return;const key=e.key.toLowerCase();
  if(e.shiftKey&&key==='r'){e.preventDefault();e.stopImmediatePropagation();state.view='reading';render();}
  else if(key==='s'){e.preventDefault();e.stopImmediatePropagation();flushSave();}
  else if(e.target.id==='w-draft'&&['b','i','z','y'].includes(key)){e.preventDefault();e.stopImmediatePropagation();if(key==='b'||key==='i')formatSelection(key==='b'?'bold':'italic');else editorUndo(key==='y'||e.shiftKey);}
 },true);
 root.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.id==='w-bold'||b.id==='w-italic')formatSelection(b.id==='w-bold'?'bold':'italic');
  else if(b.id==='w-editor-undo'||b.id==='w-editor-redo')editorUndo(b.id==='w-editor-redo');
  else if(b.id==='w-dictionary')openDictionary();
  else if(b.id==='w-thesaurus')openThesaurus();
  else if(b.dataset.editReading){state.selected=b.dataset.editReading;state.view='write';render();scheduleSave();}
  else if(b.id==='w-folder-backups'){state.view='backups';render();loadFolderFiles();}
  else if(b.id==='w-folder-refresh')loadFolderFiles();
  else if(b.id==='w-folder-reconnect')connectFolderBackups().then(loadFolderFiles);
  else if(b.dataset.readBackup)recoverFolder(b.dataset.readBackup);
  else if(b.id==='w-folder-fresh')confirmAction('Use this workspace for folder backups?','The older copies stay in the backup folder. This browser’s projects will become the latest workspace copy.',()=>{freshWorkspace=false;folderHold=false;},'Use this workspace');
  else if(b.id==='w-folder-now'){syncData();folderBackups.backupNow(WritingStore.serialize(data)).then(loadFolderFiles).catch(error=>saveStatus('Folder backup failed: '+error.message,true));}
 });
 root.addEventListener('change',e=>{if(e.target.id==='w-spacing'){selected().lineSpacing=Number(e.target.value);root.querySelector('#w-draft').style.lineHeight=e.target.value;updateFormattedPreview();fitText();scheduleSave();}else if(e.target.id==='w-alignment')updateFormattedPreview();});
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
 function cancelPalette(){if(!paletteTransaction)return;state.palette=paletteTransaction.before;palettePreview=null;paletteTransaction=null;onPaletteAppearance();studioAppearance();}
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
 const characterFields=[['name','Character name'],['role','Role in the story'],['appearance','Appearance'],['traits','Character traits'],['habits','Habits and mannerisms'],['beliefs','Beliefs and values'],['goals','Goals and motivations'],['fears','Fears and inner conflicts'],['relationships','Relationships'],['backstory','Background and history'],['arc','Growth and character arc'],['notes','Other details']];
 const characterChoices=new Map(),characterQueries=new Map();
 function characterList(){return project().characters||[];}
 function selectedCharacter(){const list=characterList();let current=list.find(c=>c.id===characterChoices.get(project().id));if(!current&&list.length){current=list[0];characterChoices.set(project().id,current.id);}return current;}
 function characterMatches(){const query=(characterQueries.get(project().id)||'').trim().toLocaleLowerCase();return characterList().filter(c=>!query||characterFields.some(([key])=>(c[key]||'').toLocaleLowerCase().includes(query)));}
 function characterButtons(){const current=selectedCharacter(),matches=characterMatches();return matches.length?matches.map(c=>`<button type="button" class="w-character-choice" data-select-character="${c.id}" aria-pressed="${c.id===current?.id}"><strong>${escape(c.name)}</strong><span class="w-secondary">${escape(c.role||'Character profile')}</span></button>`).join(''):(characterQueries.get(project().id)||'').trim()?'<p class="w-secondary" role="status">No matching characters.</p><button type="button" id="w-clear-character-search">Clear search</button>':'';}
 function characterEditor(c){
  if(!c)return '<div class="w-character-empty"><h3>Get to know your characters</h3><p>Keep their appearance, habits, beliefs, and history together. Add a character to begin.</p></div>';
  const editorField=key=>{const label=characterFields.find(([id])=>id===key)[1],short=key==='name'||key==='role',limit=key==='name'?200:key==='role'?400:20000;return `<label for="w-character-${key}">${label}${short?`<input id="w-character-${key}" data-character-field="${key}" maxlength="${limit}" value="${escape(c[key])}" ${key==='name'?'required':''}>`:`<textarea id="w-character-${key}" data-character-field="${key}" maxlength="${limit}" rows="3" placeholder="Add what matters for this character…">${escape(c[key])}</textarea>`}</label>`;};
  const group=(title,keys,open=false)=>`<details class="w-character-group" ${open?'open':''}><summary>${title}</summary>${keys.map(editorField).join('')}</details>`;
  return `<div class="w-row"><h3 id="w-character-heading">${escape(c.name)}</h3><button type="button" id="w-delete-character">Delete character</button></div><p id="w-character-error" role="alert" hidden></p>${editorField('name')}${editorField('role')}${group('Appearance and personality',['appearance','traits','habits','beliefs'],true)}${group('Motivations and growth',['goals','fears','arc'])}${group('History and connections',['relationships','backstory'])}${group('Other details',['notes'])}`;
 }
 function charactersView(){const current=selectedCharacter();return `<div class="w-row"><h2>Characters</h2><button type="button" id="w-add-character">Add character</button></div><p class="w-secondary">Profiles for ${escape(project().title)}. Changes autosave; full project backups include these profiles. They stay outside manuscript exports.</p><label for="w-character-search">Find a character<input type="search" id="w-character-search" placeholder="Search names, roles, or any detail" value="${escape(characterQueries.get(project().id)||'')}"></label><p id="w-character-count" class="w-secondary">${characterList().length} ${characterList().length===1?'character':'characters'}</p><div class="w-characters-layout"><div id="w-character-list" role="group" aria-label="Character profiles">${characterButtons()}</div><section class="w-character-editor" aria-label="Selected character profile">${characterEditor(current)}</section></div>`;}
 function updateCharacterList(){const list=root.querySelector('#w-character-list');if(list)list.innerHTML=characterButtons();}
 root.addEventListener('click',e=>{
  const button=e.target.closest('button');if(!button)return;
  if(button.id==='w-clear-character-search'){characterQueries.set(project().id,'');root.querySelector('#w-character-search').value='';updateCharacterList();root.querySelector('#w-character-search').focus();}
  else if(button.id==='w-add-character'){
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
 function helpView(){
  return `<h2>Help and getting started</h2><p class="w-secondary">A quick guide to starting, saving, and keeping your work.</p>
   <section class="w-section" aria-label="Local mode"><h3>Local mode — no account needed</h3><p>Writing Studio opens directly on your computer. You do not need ChatGPT, a ChatGPT account, or a Writing Studio account. Writing, autosave, character profiles, the thesaurus, and manuscript exports work offline.</p><p>Extract the download and open the Mac or Windows launcher. With no launcher or Python, open Writing Studio.html in your browser and download project backups regularly. The launcher adds automatic folder backups. Keep the same browser and app address to return to your saved workspace.</p><p class="w-secondary">Opening an external research link also needs internet access.</p></section>
   <section class="w-section" aria-label="Optional first writing session"><h3>Optional first writing session</h3><ol><li>Create or choose a project, then open Studio.</li><li>Choose Journaling for dated entries, or another project type for chapters. Give the entry or chapter a working title and start drafting. You can change the title later.</li><li>Your work autosaves silently in this browser as you edit. Project → Save details shows its status. A save failure appears above the workspace with a recovery action.</li></ol><div class="w-row"><button type="button" data-view="write">Open Studio</button></div></section>
   <section class="w-section" aria-label="Backups and recovery"><h3>Backups and recovery</h3><p>Autosave keeps the current workspace in this browser. Folder backups provide another local copy when you use the launcher. You can also download a portable project backup and import a backup as separate project copies.</p><p class="w-secondary">A manuscript export contains chapter text. A full project backup also contains notes, research, character profiles, Trash, and saved versions.</p><button type="button" data-view="backups">Open Folder backups</button><button type="button" data-view="export">Open Export</button></section>
   <section class="w-section" aria-label="Manuscript exports"><h3>Manuscript exports</h3><p>Choose an output format in Export, review the chapter list, then choose Download manuscript. Use Print / save as PDF when you want the browser's print controls.</p><button type="button" data-view="export">Choose an export format</button></section>
   <section class="w-section" aria-label="Keyboard shortcuts"><h3>Keyboard shortcuts</h3><ul><li>Ctrl/Cmd+B: bold selected draft text</li><li>Ctrl/Cmd+I: italic selected draft text</li><li>Ctrl/Cmd+Z: undo a draft edit; Ctrl/Cmd+Shift+Z: redo</li><li>Ctrl/Cmd+S: save now</li><li>Ctrl/Cmd+Shift+R: open Read manuscript</li></ul><p class="w-secondary">Ctrl means Control on Windows and Linux; Cmd means Command on Mac.</p></section>
  `;
 }
 root.addEventListener('click',e=>{
  const button=e.target.closest('button');if(!button)return;
  if(button.id==='w-clear-search'){
   const search=root.querySelector('#w-search');if(search){search.value='';tree();search.focus();}
  }else if(button.dataset.view==='backups'){
   queueMicrotask(()=>{if(state.view==='backups')loadFolderFiles();});
  }
 });
 const navigationViews={write:'Studio',research:'Research',export:'Export',characters:'Characters',reading:'Read manuscript',trash:'Trash',backups:'Folder backups',help:'Help'};
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
  const chapter=p?.chapters.find(item=>item.id===query.get('chapter')),requestedView=query.get('view');
  const retired=['plan','revise','assistant'].includes(requestedView),view=retired?'write':requestedView;
  if(!p||!chapter||!Object.hasOwn(navigationViews,view)){navigationNotice('This saved location is unavailable. Choose a project or chapter from the workspace.');return false;}
  if(p.id!==data.activeProject){syncData();data.activeProject=p.id;activateProject();}
  state.selected=chapter.id;state.view=view;
  if(retired)history.replaceState(history.state,'',navigationURL(navigationRoute()));
  return true;
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
  const button=event.target.closest('button,a');if(!button)return;captureNavigation();navigationTrigger={id:button.id,draft:!!button.dataset.editReading||button.id==='w-jump-draft'||button.id==='w-skip-draft'};
  if(button.id==='w-skip-workspace'||button.id==='w-skip-draft'){event.preventDefault();event.stopImmediatePropagation();if(button.id==='w-skip-draft'&&state.view!=='write'){state.view='write';render();}else focusWorkspace(button.id==='w-skip-draft');}
  else if(button.id==='w-jump-draft'){event.stopImmediatePropagation();state.view='write';render();focusWorkspace(true);}
  else if(button.id==='w-mobile-settings'){event.stopImmediatePropagation();mobileSettings=!mobileSettings;root.classList.toggle('w-mobile-settings-hidden',!mobileSettings);button.setAttribute('aria-expanded',String(mobileSettings));}
  else if(button.id==='w-nav-back'){event.stopImmediatePropagation();history.back();}
  else if(button.id==='w-nav-forward'){event.stopImmediatePropagation();history.forward();}
  else if(button.id==='w-copy-location'){event.stopImmediatePropagation();navigator.clipboard?.writeText(location.href).then(()=>navigationNotice('Location link copied. Open it in this browser and workspace.'),()=>navigationNotice('Copy this location from the browser address bar.'));}
 },true);
 root.addEventListener('change',event=>{captureNavigation();navigationTrigger={id:event.target.id};if(event.target.id==='w-mobile-view'){event.stopImmediatePropagation();state.view=event.target.value;render();scheduleSave();if(state.view==='backups')loadFolderFiles();}},true);
 root.addEventListener('input',event=>{if(event.target.id==='w-title'){main.querySelector('h2')?.setAttribute('aria-label',event.target.value||'Untitled chapter');document.title=project().title+' · '+event.target.value+' · Writing Studio';}});
 document.getElementById('w-dialog').addEventListener('close',()=>{requestAnimationFrame(()=>{const target=dialogReturn?.isConnected&&dialogReturn.getClientRects().length?dialogReturn:root.querySelector('#w-draft')||main;target.focus({preventScroll:true});});});
 window.addEventListener('popstate',event=>{captureNavigation();navigationApplying=true;navigationTrigger={id:'history'};navigationIndex=Number.isInteger(event.state?.writingStudioIndex)?event.state.writingStudioIndex:0;if(applyNavigationURL()){render();scheduleSave();}navigationApplying=false;});
 window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#studio?')&&location.hash!==navigationURL(navigationRoute())){captureNavigation();navigationApplying=true;navigationTrigger={id:'location-link'};if(applyNavigationURL()){render();scheduleSave();}navigationApplying=false;}});

 window.addEventListener('scroll',()=>{if(navigationCurrent&&window.scrollY>=main.getBoundingClientRect().top+window.scrollY-20)navigationWorkspacePositions.set(navigationKey(navigationCurrent),window.scrollY);},{passive:true});
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
  const deleteGroup=document.createElement('div');deleteGroup.className='w-tools-delete';
  deleteGroup.append(main.querySelector('#w-delete-chapter'));tools.lastElementChild.append(deleteGroup);
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

 root.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.typingChoice!==undefined){applyTypingCorrection(typingSuggestions[Number(b.dataset.typingChoice)]);}
  else if(b.id==='w-undo-correction'){undoTypingCorrection();}
  else if(b.dataset.view){state.view=b.dataset.view;render();}
  else if(b.id==='w-focus'){state.focus=!state.focus;render();}
  else if(b.dataset.chapter){state.selected=b.dataset.chapter;render();}
 });
 root.addEventListener('input',e=>{if(e.target.id==='w-search')tree();else if(e.target.id==='w-draft'){typingInput=true;try{checkTypedWord(e);}finally{typingInput=false;}setDraftText(e.target.value);count();fitText();}});
 root.addEventListener('keydown',e=>{if(e.target.id==='w-draft'&&lastCorrection&&(e.metaKey||e.ctrlKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'){e.preventDefault();undoTypingCorrection();}});
 root.addEventListener('change',e=>{if(e.target.id==='w-typing'){state.typing=e.target.value;typingSuggestions=[];lastCorrection=null;root.querySelector('#w-draft').spellcheck=state.typing!=='off';updateTyping();}else if(e.target.id==='w-theme'){state.theme=e.target.value;appearance();}else if(e.target.id==='w-solid'){state.solidGlass=e.target.checked;appearance();}else if(e.target.id==='w-font'){state.font=e.target.value;appearance();fitText();}else if(e.target.id==='w-type'){state.type=e.target.value;render();}else if(e.target.id==='w-format'){state.format=e.target.value;exportDetail();}if(['w-typing','w-theme','w-solid','w-font','w-type','w-genre'].includes(e.target.id))rememberChoices();});
 initialize();
 initializePalette();
 initializeNavigation();
 initializeStudio();
 render();
 connectFolderBackups();
 let previousWidth=0;new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(width!==previousWidth){previousWidth=width;fitText();}}).observe(root);

})();
