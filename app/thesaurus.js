(function(root,factory){const data=typeof module==='object'&&module.exports?require('./vendor/wordnet-data.js'):root.WritingWordNetData;const api=factory(data);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.WritingThesaurus=api;})(typeof globalThis==='object'?globalThis:this,function(data){
 'use strict';
 const LIMIT=80;
 const names={n:'noun',v:'verb',a:'adjective',r:'adverb'};
 const substitutions={n:[['s',''],['ses','s'],['xes','x'],['zes','z'],['ches','ch'],['shes','sh'],['men','man'],['ies','y']],v:[['s',''],['ies','y'],['es','e'],['es',''],['ed','e'],['ed',''],['ing','e'],['ing','']],a:[['er',''],['est',''],['er','e'],['est','e']],r:[]};
 const own=(object,key)=>!!object&&Object.prototype.hasOwnProperty.call(object,key);
 const key=word=>word.trim().toLowerCase().replace(/[’‘]/g,"'").replace(/[\s_]+/g,'_');
 const display=word=>word.replace(/_/g,' ');
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
 return {lookup,LIMIT,version:data&&data.version,source:data&&data.source,license:data&&data.license};
});
