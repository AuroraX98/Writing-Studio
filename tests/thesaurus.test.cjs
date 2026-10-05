const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const thesaurus=require('../app/thesaurus.js');
const data=require('../app/vendor/wordnet-data.js');

test('offline corpus keeps full WordNet coverage, provenance and exact license',()=>{
 assert.equal(Object.keys(data.index).length,147306);
 assert.equal(data.senses.length,117659);
 assert.equal(thesaurus.version,'3.0');
 assert.equal(thesaurus.license,fs.readFileSync(path.join(__dirname,'../app/vendor/WordNet-LICENSE.txt'),'utf8'));
 assert.match(thesaurus.license,/Princeton University/);
 for(const field of ['database','exceptions','license'])assert.match(data.source[field],/^https:\/\/wordnetcode\.princeton\.edu\/3\.0\//);
 for(const field of ['databaseSha256','exceptionsSha256','licenseSha256'])assert.match(data.source[field],/^[a-f0-9]{64}$/);
});

test('all indexed sense references and part-of-speech values are internally valid',()=>{
 for(const [lemma,ids] of Object.entries(data.index)){
  assert.ok(lemma.length>0);
  assert.equal(new Set(ids).size,ids.length,lemma+' contains duplicate senses');
  for(const id of ids)assert.ok(Number.isInteger(id)&&id>=0&&id<data.senses.length,lemma+' has an invalid sense');
 }
 for(const [pos,definition,words] of data.senses){assert.ok(['n','v','a','r'].includes(pos));assert.equal(typeof definition,'string');assert.ok(definition.length);assert.ok(words.length);}
});

test('quiet alternatives stay grouped by exact meaning and part of speech',()=>{
 const result=thesaurus.lookup('quiet');assert.equal(result.lemma,'quiet');assert.equal(result.total,13);assert.equal(result.limited,false);
 assert.deepEqual(result.senses[0],{partOfSpeech:'noun',definition:'a period of calm weather',words:['lull']});
 const softened=result.senses.find(sense=>sense.definition==='in a softened tone');assert.equal(softened.partOfSpeech,'adjective');assert.deepEqual(softened.words,['hushed','muted','subdued']);
 assert.ok(result.senses.some(sense=>sense.definition==='the absence of sound'&&sense.words.includes('silence')));
 assert.ok(result.senses.every(sense=>!sense.words.includes('quiet')));
});

test('bright distinguishes intelligence and color without inventing related words',()=>{
 const result=thesaurus.lookup(' BRIGHT ');assert.equal(result.query,'BRIGHT');assert.equal(result.lemma,'bright');
 assert.deepEqual(result.senses.find(sense=>sense.definition==='having striking color').words,['brilliant','vivid']);
 assert.deepEqual(result.senses.find(sense=>sense.definition==='characterized by quickness and ease in learning').words,['smart']);
 assert.ok(result.senses.some(sense=>sense.words.length===0),'Definitions with no direct alternatives should remain available');
 assert.ok(result.senses.every(sense=>!sense.words.includes('happy')),'A related idea must not be fabricated as a synonym');
});

test('official exception lists recognize irregular nouns and verbs',()=>{
 const went=thesaurus.lookup('went');assert.equal(went.lemma,'go');assert.deepEqual(went.matchedForms,['go']);assert.ok(went.senses.some(sense=>sense.words.includes('travel')));assert.ok(went.senses.every(sense=>sense.partOfSpeech==='verb'));
 const children=thesaurus.lookup('children');assert.equal(children.lemma,'child');assert.ok(children.senses.some(sense=>sense.words.includes('kid')));assert.ok(children.senses.every(sense=>sense.partOfSpeech==='noun'));
 assert.ok(thesaurus.lookup('mice').matchedForms.includes('mouse'));
 assert.ok(thesaurus.lookup('running').matchedForms.includes('run'));
});

test('multiword lookup handles spaces, underscores, case, and final-word morphology',()=>{
 const plain=thesaurus.lookup('writing desk'),variant=thesaurus.lookup('  WRITING__DESK  '),plural=thesaurus.lookup('writing desks');
 assert.equal(plain.lemma,'writing desk');assert.equal(plain.total,2);assert.deepEqual(variant.senses,plain.senses);assert.deepEqual(plural.senses,plain.senses);
 assert.ok(thesaurus.lookup('New York').senses.some(sense=>sense.words.includes('New York City')));
 assert.ok(thesaurus.lookup('turn a blind eye').senses.some(sense=>sense.definition==='refuse to acknowledge'));
});

test('absent, oversized, non-string and injection queries return safe empty results',()=>{
 for(const query of ['qxzvvunknownword','__proto__','toString','<script>alert(1)</script>','quiet\u0000','x'.repeat(121),'','   ',null,undefined,42,{toString(){throw Error('Must not coerce objects');}}]){
  const result=thesaurus.lookup(query);assert.equal(result.lemma,null);assert.deepEqual(result.senses,[]);assert.deepEqual(result.matchedForms,[]);assert.equal(result.total,0);assert.equal(result.limited,false);
 }
 assert.equal(Object.prototype.polluted,undefined);
 // Constructor is an actual WordNet noun; own-property checks preserve its legitimate meaning.
 assert.ok(thesaurus.lookup('constructor').senses.some(sense=>sense.words.includes('builder')));
 assert.equal(thesaurus.lookup('prototype').lemma,'prototype');
 assert.ok(thesaurus.lookup('prototype').senses.length>0);
});

test('lookups return independent result arrays rather than exposing the corpus',()=>{
 const first=thesaurus.lookup('quiet');first.senses[0].words.push('invented');first.senses[0].definition='Changed';first.matchedForms.push('fake');
 const fresh=thesaurus.lookup('quiet');assert.equal(fresh.senses[0].definition,'a period of calm weather');assert.deepEqual(fresh.senses[0].words,['lull']);assert.deepEqual(fresh.matchedForms,['quiet']);
});

test('browser UMD lookup stays synchronous and announces any result truncation',()=>{
 const fake={version:'test',license:'test',source:{},senses:Array.from({length:100},(_,i)=>['n','Meaning '+i,'example|alternative '+i]),index:{example:Array.from({length:100},(_,i)=>i)},exceptions:{n:{},v:{},a:{},r:{}}};
 const context=vm.createContext({WritingWordNetData:fake,fetch(){throw Error('Offline lookup must not fetch');}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/thesaurus.js'),'utf8'),context);
 const result=context.WritingThesaurus.lookup('example');assert.equal(result.total,100);assert.equal(result.senses.length,80);assert.equal(result.limited,true);assert.equal(result.senses[0].words[0],'alternative 0');assert.equal(result instanceof Promise,false);
});

test('missing-letter suggestions use real bundled words and preserve ambiguity',()=>{
 assert.deepEqual(thesaurus.missingLetterSuggestions('bdy'),{words:['body'],total:1,limited:false});
 assert.deepEqual(thesaurus.missingLetterSuggestions('KNW'),{words:['knew','know'],total:2,limited:false});
 assert.deepEqual(thesaurus.missingLetterSuggestions('bll').words,['ball','bell','bill','boll','bull']);
 // Inserting m on either side of the existing m produces the same candidate.
 assert.deepEqual(thesaurus.missingLetterSuggestions('comittee'),{words:['committee'],total:1,limited:false});
 const changed=thesaurus.missingLetterSuggestions('bdy');changed.words.push('invented');
 assert.deepEqual(thesaurus.missingLetterSuggestions('bdy').words,['body']);
});

test('recognized words, common function words, and real inflections need no correction',()=>{
 for(const word of ['now','read','the','you','that','my','hers','whomever','bodies','walks','children','went','running']){
  assert.deepEqual(thesaurus.missingLetterSuggestions(word),{words:[],total:0,limited:false},word);
 }
 assert.deepEqual(thesaurus.missingLetterSuggestions('bodis').words,['bodies']);
 assert.deepEqual(thesaurus.missingLetterSuggestions('chldren').words,['children']);
 assert.deepEqual(thesaurus.missingLetterSuggestions('runnng').words,['running']);
});

test('missing-letter inputs reject malformed values and enforce length bounds',()=>{
 for(const input of ['', 'ab','b dy',' bdy','bdy ','body\n','b-dy','b_dy','b2y','bød','<bdy>','bdy\u0000','q'.repeat(33),null,undefined,42,[],{toString(){throw Error('Do not coerce input');}}]){
  assert.deepEqual(thesaurus.missingLetterSuggestions(input),{words:[],total:0,limited:false});
 }
 assert.equal(thesaurus.spellingWordCount,82378);
 assert.match(thesaurus.spellingCoverage,/Excludes phrases and punctuation/);
 assert.match(thesaurus.spellingCoverage,/not a complete English dictionary/);
});

test('offline browser suggestions cap choices, count unique matches, and avoid corpus scans',()=>{
 let scans=0;
 const index=Object.fromEntries(Array.from({length:26},(_,i)=>[String.fromCharCode(97+i)+'zzz',[0]]));
 index['x'.repeat(33)]=[0];
 const fake={index:new Proxy(index,{ownKeys(target){scans++;return Reflect.ownKeys(target);}}),senses:[['n','A test word','unused']],exceptions:{n:{},v:{},a:{},r:{}}};
 const context=vm.createContext({WritingWordNetData:fake,fetch(){throw Error('Spelling suggestions must stay offline');}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/thesaurus.js'),'utf8'),context);
 const api=context.WritingThesaurus,initialScans=scans,result=api.missingLetterSuggestions('zzz');
 assert.deepEqual(Array.from(result.words),['azzz','bzzz','czzz','dzzz','ezzz','fzzz','gzzz','hzzz']);
 assert.equal(result.total,26);assert.equal(result.limited,true);assert.equal(result instanceof Promise,false);
 assert.deepEqual(Array.from(api.missingLetterSuggestions('x'.repeat(32)).words),['x'.repeat(33)]);
 assert.equal(api.missingLetterSuggestions('x'.repeat(33)).total,0);
 assert.equal(scans,initialScans,'The vocabulary must be indexed once, not scanned for each input');
});

test('regular inflections require a matching part of speech in the local index',()=>{
 function spellingFor(pos){
  const fake={index:{fly:[0]},senses:[[pos,'A test meaning','fly']],exceptions:{n:{},v:{},a:{},r:{}}};
  const context=vm.createContext({WritingWordNetData:fake});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/thesaurus.js'),'utf8'),context);
  return context.WritingThesaurus;
 }
 assert.equal(spellingFor('n').missingLetterSuggestions('flyng').total,0,'A noun cannot validate an -ing verb candidate');
 assert.deepEqual(Array.from(spellingFor('v').missingLetterSuggestions('flyng').words),['flying']);
});
