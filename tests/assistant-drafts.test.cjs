const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const WritingAssistant = require('../app/assistant.js');

function harness(saved) {
  const chapter = {id:'chapter-1',title:'Opening',text:'Original draft',formats:[],assistantDraft:saved};
  const p = {id:'project-1',title:'Book',type:'fiction',chapters:[chapter],writingProfile:WritingAssistant.normalizeProfile()};
  const events = {}, elements = {}, clientState = {available:true,connected:false,busy:false,settingsBusy:false};
  const client = {state:clientState,initialize(){}, generate(){throw Error('No provider calls allowed');}};
  const ctx = vm.createContext({
    WritingAssistant:{...WritingAssistant,createClient:()=>client},
    WritingRevision:{formatFingerprint:()=>'same'}, data:{projects:[p]}, root:{querySelector:selector=>elements[selector]||null,addEventListener:(name,callback)=>events[name]=callback},
    project:()=>p, selected:()=>p.chapters[0], state:{type:'fiction',genres:{fiction:'novel'},view:'assistant'}, blocked:false,
    scheduleSave:()=>ctx.saves++, saves:0, selectionForDraft:()=>null, genre:()=>({name:'Novel'}), projectTypeLabel:()=> 'Fiction',escape:String,
    render(){}, fitText(){}, confirmAction:(_title,_message,action)=>action(),
  });
  vm.runInContext(fs.readFileSync(require.resolve('../work/assistant_extension.js'),'utf8')+'\nthis.api={assistantWorkspace,saveAssistantDraft,assistantView,assistantPrerequisite,applyAssistant,generateAssistant,assistantWorkspaces};',ctx);
  return {ctx,p,chapter,events,elements,client};
}
const copy = value => JSON.parse(JSON.stringify(value));

test('Assistant inputs persist per chapter with only writing fields, and restore suggestions for review', () => {
  const h = harness();
  h.events.input({target:{id:'w-ai-brief',value:'Keep my voice'}});
  h.events.input({target:{id:'w-ai-text',value:'Selected excerpt'}});
  h.events.change({target:{id:'w-ai-goal',value:'rewrite'}});
  const work = h.ctx.api.assistantWorkspace();
  work.result = {text:'Editable result',truncated:false,target:{text:'Original draft'},selection:{start:0,end:8}};
  h.events.input({target:{id:'w-ai-result',value:'Edited result'}});
  assert.deepEqual(copy(h.chapter.assistantDraft),{model:'deepseek-flash',goal:'rewrite',brief:'Keep my voice',text:'Selected excerpt',suggestion:{text:'Edited result',truncated:false}});
  const restored = harness(copy(h.chapter.assistantDraft));
  assert.equal(restored.ctx.api.assistantWorkspace().result.restored,true);
  restored.ctx.api.applyAssistant('append');
  assert.equal(restored.chapter.text,'Original draft');
  assert.match(restored.ctx.api.assistantView(),/Restored suggestion:/);
  assert.match(restored.ctx.api.assistantView(),/id="w-ai-append" disabled/);
});

test('Imported chapter data replaces cached Assistant draft instead of resurrecting old values', () => {
  const h = harness(); h.events.input({target:{id:'w-ai-brief',value:'Old brief'}});
  h.p.chapters[0] = {...h.chapter,assistantDraft:{model:'deepseek-flash',goal:'feedback',brief:'Imported brief',text:'',suggestion:null}};
  assert.equal(h.ctx.api.assistantWorkspace().brief,'Imported brief');
});

test('Clear saved assistant draft resets only this chapter and discards late successful responses', async () => {
  const h = harness(); h.events.input({target:{id:'w-ai-brief',value:'Explain this'}});
  let finish;
  h.client.generate = ()=>new Promise(resolve=>finish=resolve);
  const pending = h.ctx.api.generateAssistant();
  await h.events.click({target:{closest:()=>({id:'w-ai-clear-draft'})}});
  assert.equal(h.chapter.assistantDraft,undefined);
  finish({text:'Late response',truncated:false});
  await pending;
  assert.equal(h.chapter.assistantDraft,undefined);
  assert.equal(h.ctx.api.assistantWorkspace().brief,'');
});

test('Generate explains key and instruction prerequisites, and settings opens directly', async () => {
  const h = harness();
  assert.match(h.ctx.api.assistantPrerequisite(h.client.state),/Attach a DeepSeek key/);
  h.client.state.connected = true;
  assert.match(h.ctx.api.assistantPrerequisite(h.client.state),/Enter an instruction/);
  h.events.input({target:{id:'w-ai-brief',value:'Review this'}});
  assert.match(h.ctx.api.assistantPrerequisite(h.client.state),/^Ready\./);
  const summary = {focus(){this.focused=true;}};
  h.elements['#w-ai-settings'] = {open:false,querySelector:()=>summary,scrollIntoView(){}};
  await h.events.click({target:{closest:()=>({id:'w-ai-open-settings'})}});
  assert.equal(h.elements['#w-ai-settings'].open,true);
  assert.equal(summary.focused,true);
});
