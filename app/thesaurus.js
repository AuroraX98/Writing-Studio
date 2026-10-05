(function(root,factory){const data=typeof module==='object'&&module.exports?require('./vendor/wordnet-data.js'):root.WritingWordNetData;const api=factory(data);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.WritingThesaurus=api;})(typeof globalThis==='object'?globalThis:this,function(data){
 'use strict';
 const LIMIT=80;
 const SPELLING_LIMIT=8;
 const names={n:'noun',v:'verb',a:'adjective',r:'adverb'};
 const substitutions={n:[['s',''],['ses','s'],['xes','x'],['zes','z'],['ches','ch'],['shes','sh'],['men','man'],['ies','y']],v:[['s',''],['ies','y'],['es','e'],['es',''],['ed','e'],['ed',''],['ing','e'],['ing','']],a:[['er',''],['est',''],['er','e'],['est','e']],r:[]};
 const own=(object,key)=>!!object&&Object.prototype.hasOwnProperty.call(object,key);
 const key=word=>word.trim().toLowerCase().replace(/[’‘]/g,"'").replace(/[\s_]+/g,'_');
 const display=word=>word.replace(/_/g,' ');
 // WordNet focuses on meaning-bearing words. These common function words also
 // belong in spelling checks, even when WordNet has no sense entry for them.
 const functionWords='a an the and or but nor so yet if then else because although though unless until while whether as than that this these those each every either neither both all any some no none another other such what whatever which whichever who whoever whom whomever whose how when whenever where wherever why i me my mine myself we us our ours ourselves you your yours yourself yourselves he him his himself she her hers herself it its itself they them their theirs themselves one oneself be am is are was were been being have has had having do does did doing can could may might must shall should will would ought to of in on at by for from with without about above across after against along among around before behind below beneath beside between beyond despite down during except inside into near off onto out outside over past per since through throughout toward towards under underneath up upon via within'.split(' ');
 const spellingWords=new Set();
 if(data){
  // Build once at load time; a keystroke only probes the set and WordNet index.
  for(const word of Object.keys(data.index))if(/^[a-z]+$/.test(word))spellingWords.add(word);
  for(const pos of ['n','v','a','r'])for(const word of Object.keys(data.exceptions[pos]))if(/^[a-z]+$/.test(word))spellingWords.add(word);
  for(const word of functionWords)spellingWords.add(word);
 }
 const spellingWordCount=spellingWords.size;
 const spellingCoverage='Unique lowercase ASCII single-word entries from bundled WordNet, its exception forms, and common function words. Excludes phrases and punctuation; regular inflections are recognized but not added to the count. This is not a complete English dictionary.';
 function hasSpellingWord(word){
  if(spellingWords.has(word))return true;
  for(const pos of ['n','v','a','r'])for(const [suffix,replacement] of substitutions[pos]){
   if(!word.endsWith(suffix)||word.length<=suffix.length)continue;
   const base=word.slice(0,-suffix.length)+replacement;
   if(own(data.index,base)&&data.index[base].some(id=>data.senses[id][0]===pos))return true;
  }
  return false;
 }
 function missingLetterSuggestions(input){
  const empty={words:[],total:0,limited:false};
  if(!data||typeof input!=='string'||input.length<3||input.length>32||/[^a-z]/i.test(input))return empty;
  const word=input.toLowerCase();
  // A valid word can also be one letter away from another word, such as now/know.
  if(hasSpellingWord(word))return empty;
  const matches=new Set(),checked=new Set();
  for(let position=0;position<=word.length;position++)for(let code=97;code<=122;code++){
   const candidate=word.slice(0,position)+String.fromCharCode(code)+word.slice(position);
   if(checked.has(candidate))continue;
   checked.add(candidate);
   if(hasSpellingWord(candidate))matches.add(candidate);
  }
  const words=[...matches].sort();
  return {words:words.slice(0,SPELLING_LIMIT),total:words.length,limited:words.length>SPELLING_LIMIT};
 }
 function lookup(input){
  const query=typeof input==='string'?input.trim():'';
  const result={query,lemma:null,matchedForms:[],senses:[],total:0,limited:false};
  if(!data||!query||query.length>120||/[\u0000-\u001f<>]/.test(query))return result;
  const normalized=key(query),forms=new Map(),ids=new Set();
  function add(form,pos){if(!own(data.index,form))return;const matches=data.index[form].filter(id=>!pos||data.senses[id][0]===pos);if(!matches.length)return;if(!forms.has(form))forms.set(form,new Set());for(const id of matches){forms.get(form).add(id);ids.add(id);}}
  add(normalized);
  for(const pos of ['n','v','a','r']){
   if(own(data.exceptions[pos],normalized))for(const base of data.exceptions[pos][normalized])add(base,pos);
   else for(const [suffix,replacement] of substitutions[pos])if(normalized.endsWith(suffix)&&normalized.length>suffix.length)add(normalized.slice(0,-suffix.length)+replacement,pos);
   // WordNet compound forms can inflect their final word, e.g. “writing desks”.
   const separator=normalized.lastIndexOf('_');if(separator>0){const tail=normalized.slice(separator+1),prefix=normalized.slice(0,separator+1);if(own(data.exceptions[pos],tail))for(const base of data.exceptions[pos][tail])add(prefix+base,pos);for(const [suffix,replacement] of substitutions[pos])if(tail.endsWith(suffix)&&tail.length>suffix.length)add(prefix+tail.slice(0,-suffix.length)+replacement,pos);}
  }
  result.matchedForms=[...forms.keys()].map(display);result.lemma=result.matchedForms[0]||null;result.total=ids.size;result.limited=result.total>LIMIT;
  const excluded=new Set([normalized,...forms.keys()]);
  // Exact matches retain WordNet's own per-part-of-speech sense order. No related
  // terms, hypernyms, or antonyms are presented as interchangeable synonyms.
  for(const id of [...ids].slice(0,LIMIT)){const [pos,definition,members]=data.senses[id];result.senses.push({partOfSpeech:names[pos],definition,words:members.split('|').filter(word=>!excluded.has(key(word)))});}
  return result;
 }
 return {lookup,LIMIT,missingLetterSuggestions,SPELLING_LIMIT,spellingWordCount,spellingCoverage,version:data&&data.version,source:data&&data.source,license:data&&data.license};
});
