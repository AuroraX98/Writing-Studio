const test = require("node:test");
const assert = require("node:assert/strict");
const WritingStore = require("../app/storage.js");

function sample(overrides = {}) {
  return {
    version: 1,
    projects: [{
      id: "project-1",
      title: "First draft",
      type: "memoir",
      characters: [],
      chapters: [{
        id: "chapter-1",
        title: "The beginning",
        text: "Draft text",
        note: "A note",
        summary: "What happens",
        task: "Revise opening",
        status: "draft",
        idea: "A possible scene",
        saved: "A useful line",
        planOutline: "1. Arrive",
        roles: { fiction: "opening", nonfiction: "development", memoir: "closing" },
        guidePicks: { "memoir:chronological:opening": { "0": true, "1": false } },
        addedGuides: { "memoir:chronological:opening": true },
      }],
      sources: [{ id: "source-1", title: "Notebook", details: { page: 2 } }],
      trash: [{ id: "trash-1", kind: "idea", label: "Old idea", deletedAt: "2026-10-01", item: "Maybe later" }],
      history: [{ id: "history-1", chapterId: "chapter-1", at: "2026-10-01T10:00:00Z", title: "The beginning", text: "Earlier text", note: "Earlier note", planOutline: "Earlier plan" }],
      genres: { fiction: "novel", nonfiction: "reflective", memoir: "chronological" },
    }],
    activeProject: "project-1",
    preferences: { theme: "glass", font: "chalkboard", typing: "auto", context: true, solidGlass: false, prose: 18, nested: [true, 3, null] },
    ...overrides,
  };
}

function character(id = "character-1", overrides = {}) {
  return {
    id,
    name: "Mara Vale",
    role: "Neighbor and reluctant guide",
    appearance: "Silver braid, weathered coat",
    traits: "Patient, observant",
    habits: "Counts doorways when anxious",
    beliefs: "People can change when they are listened to",
    goals: "Keep her family home",
    fears: "Being forgotten by the town",
    relationships: "Protective of her younger brother",
    backstory: "Returned to town after years away",
    arc: "Learns to ask for help",
    notes: "First appears at the ferry landing",
    ...overrides,
  };
}

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    values,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

test("alignment survives backups and rejects invalid chapter or version values", () => {
  const data = sample();
  data.projects[0].chapters[0].alignment = "justify";
  data.projects[0].history[0].alignment = "right";
  assert.deepEqual(WritingStore.parse(WritingStore.serialize(data)), data);
  data.projects[0].chapters[0].alignment = "center<script>";
  assert.throws(() => WritingStore.serialize(data), /alignment/);
  data.projects[0].chapters[0].alignment = "left";
  data.projects[0].history[0].alignment = null;
  assert.throws(() => WritingStore.serialize(data), /alignment/);
});

test("save and load round-trip validated JSON through primary storage", () => {
  const storage = memoryStorage();
  const store = WritingStore.createStore(storage);
  const data = sample();

  assert.equal(store.save(data), true);
  assert.deepEqual(store.load(), data);
  assert.equal(storage.values.get(WritingStore.primaryKey), JSON.stringify(data));
  assert.equal(storage.values.has(WritingStore.recoveryKey), false);
});

test("load recovers a corrupt primary from the previous valid copy", () => {
  const previous = sample();
  const storage = memoryStorage({
    [WritingStore.primaryKey]: "{broken",
    [WritingStore.recoveryKey]: JSON.stringify(previous),
  });

  assert.deepEqual(WritingStore.createStore(storage).load(), previous);
  assert.equal(storage.values.get(WritingStore.primaryKey), "{broken");
});

test("saving preserves a valid primary as recovery and skips corrupt primary", () => {
  const oldData = sample();
  const newData = sample({ activeProject: "project-1", preferences: { theme: "dark" } });
  const storage = memoryStorage({ [WritingStore.primaryKey]: JSON.stringify(oldData) });
  const store = WritingStore.createStore(storage);

  store.save(newData);
  assert.equal(storage.values.get(WritingStore.recoveryKey), JSON.stringify(oldData));
  assert.deepEqual(store.load(), newData);

  const knownRecovery = "known recovery text";
  const corruptStorage = memoryStorage({
    [WritingStore.primaryKey]: "invalid primary",
    [WritingStore.recoveryKey]: knownRecovery,
  });
  WritingStore.createStore(corruptStorage).save(newData);
  assert.equal(corruptStorage.values.get(WritingStore.recoveryKey), knownRecovery);
  assert.deepEqual(WritingStore.createStore(corruptStorage).load(), newData);
});

test("empty storage returns null, while corrupt data without recovery throws", () => {
  assert.equal(WritingStore.createStore(memoryStorage()).load(), null);
  const storage = memoryStorage({ [WritingStore.primaryKey]: "{broken" });
  assert.throws(() => WritingStore.createStore(storage).load(), /corrupt and no valid recovery copy/);
});

test("a valid recovery copy loads when the primary key is missing", () => {
  const previous = sample();
  const storage = memoryStorage({ [WritingStore.recoveryKey]: JSON.stringify(previous) });
  assert.deepEqual(WritingStore.createStore(storage).load(), previous);
});

test("storage write failures surface to the caller", () => {
  const storage = memoryStorage();
  const store = WritingStore.createStore({
    getItem: storage.getItem,
    setItem() { throw new Error("quota exceeded"); },
  });

  assert.throws(() => store.save(sample()), /quota exceeded/);
});

test("a failed primary write leaves the previous valid recovery copy available", () => {
  const previous = sample();
  const primary = JSON.stringify(previous);
  const values = new Map([[WritingStore.primaryKey, primary]]);
  const store = WritingStore.createStore({
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      if (key === WritingStore.primaryKey) throw new Error("primary write failed");
      values.set(key, String(value));
    },
  });

  assert.throws(() => store.save(sample({ preferences: { theme: "dark" } })), /primary write failed/);
  assert.equal(values.get(WritingStore.recoveryKey), primary);
  assert.deepEqual(WritingStore.createStore({
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
  }).load(), previous);
});

test("invalid imports and duplicate identifiers are rejected", () => {
  assert.throws(() => WritingStore.parse(JSON.stringify({ ...sample(), version: 2 })), /version must be 1/);

  const duplicateProject = sample();
  duplicateProject.projects.push({ ...duplicateProject.projects[0] });
  assert.throws(() => WritingStore.validate(duplicateProject), /project ids must be unique/);

  const duplicateChapter = sample();
  duplicateChapter.projects[0].chapters.push({ ...duplicateChapter.projects[0].chapters[0] });
  assert.throws(() => WritingStore.validate(duplicateChapter), /chapter ids must be unique/);

  const invalidChapter = sample();
  invalidChapter.projects[0].chapters[0].text = 12;
  assert.throws(() => WritingStore.serialize(invalidChapter), /text must be a string/);

  const invalidPreferences = sample({ preferences: { theme: "calm" } });
  assert.throws(() => WritingStore.validate(invalidPreferences), /preferences.theme is unsupported/);

  const invalidGenre = sample();
  invalidGenre.projects[0].genres.memoir = "mystery";
  assert.throws(() => WritingStore.validate(invalidGenre), /unsupported genre/);

  const unsafeId = sample();
  unsafeId.projects[0].chapters[0].id = "chapter one";
  assert.throws(() => WritingStore.validate(unsafeId), /chapter.*\.id must be a 1 to 200 character ID/);

  const invalidRole = sample();
  invalidRole.projects[0].chapters[0].roles.memoir = "epilogue";
  assert.throws(() => WritingStore.validate(invalidRole), /unsupported role/);

  const invalidGuidePick = sample();
  invalidGuidePick.projects[0].chapters[0].guidePicks["memoir:chronological:opening"]["0"] = "yes";
  assert.throws(() => WritingStore.validate(invalidGuidePick), /must contain booleans/);
});

test("trash payloads and research sources follow their typed shapes", () => {
  const invalidIdea = sample();
  invalidIdea.projects[0].trash[0].item = { text: "Maybe later" };
  assert.throws(() => WritingStore.validate(invalidIdea), /item must be a string for idea trash/);

  const taskTrash = sample();
  taskTrash.projects[0].trash[0].kind = "task";
  assert.equal(WritingStore.validate(taskTrash), true);

  const invalidVersion = sample();
  invalidVersion.projects[0].trash[0] = { id: "v1", kind: "version", label: "Version", deletedAt: "today", item: { id: "h1" } };
  assert.throws(() => WritingStore.validate(invalidVersion), /chapterId must be a 1 to 200 character ID/);

  const invalidSource = sample();
  invalidSource.projects[0].sources[0].author = 7;
  assert.throws(() => WritingStore.validate(invalidSource), /sources\[0\]\.author must be a string/);

  const duplicateSource = sample();
  duplicateSource.projects[0].sources.push({ ...duplicateSource.projects[0].sources[0] });
  assert.throws(() => WritingStore.validate(duplicateSource), /source ids must be unique/);
});

test("trashed projects are validated as projects, and unsafe property names are rejected", () => {
  const data = sample({ trashProjects: [{
    id: "trash-project-1",
    kind: "project",
    label: "Deleted project",
    deletedAt: "2026-10-01",
    item: { ...sample().projects[0], id: "project-2" },
  }] });
  assert.equal(WritingStore.validate(data), true);

  const unsafe = JSON.parse('{"version":1,"projects":[],"activeProject":null,"preferences":{},"__proto__":{"polluted":true}}');
  assert.throws(() => WritingStore.validate(unsafe), /forbidden property name/);
});

test("serialization rejects values that are not plain JSON data", () => {
  const withGetter = sample();
  Object.defineProperty(withGetter.preferences, "trigger", {
    enumerable: true,
    get() { throw new Error("getter ran"); },
  });

  assert.throws(() => WritingStore.serialize(withGetter), /accessor or hidden property/);
  assert.throws(() => WritingStore.serialize(sample({ preferences: { bad: new Date() } })), /non-plain object/);
});

test('formatting, dictionary and line spacing round-trip safely in chapters and versions',()=>{
  const data=sample();data.projects[0].chapters[0].formats=[{start:0,end:5,bold:true,italic:true}];data.projects[0].chapters[0].lineSpacing=2;
  data.projects[0].history[0].formats=[{start:0,end:7,italic:true}];data.projects[0].history[0].lineSpacing=1.4;data.preferences.personalDictionary=['Aurelia','Bashar'];
  assert.deepEqual(WritingStore.parse(WritingStore.serialize(data)),data);
  for(const invalid of [{start:-1,end:3,bold:true},{start:0,end:99,bold:true},{start:3,end:3,bold:true},{start:0,end:3,bold:'yes'},{start:0,end:3},{start:0,end:3,bold:true,style:'color:red'}]){
    const bad=structuredClone(data);bad.projects[0].chapters[0].formats=[invalid];assert.throws(()=>WritingStore.serialize(bad),/formats/);
  }
  const unicode=structuredClone(data);unicode.projects[0].chapters[0].text='a😀b';unicode.projects[0].chapters[0].formats=[{start:2,end:3,bold:true}];assert.throws(()=>WritingStore.serialize(unicode),/boundaries/);
  const history=structuredClone(data);history.projects[0].history[0].formats=[{start:0,end:99,bold:true}];assert.throws(()=>WritingStore.serialize(history),/formats/);
  for(const invalid of [0,1.5,'2','2; color:red']){const bad=structuredClone(data);bad.projects[0].chapters[0].lineSpacing=invalid;assert.throws(()=>WritingStore.serialize(bad),/lineSpacing/);}
  for(const invalid of [[''],['a\nb'],['x'.repeat(101)],Array(5001).fill('word'),[42]]){const bad=structuredClone(data);bad.preferences.personalDictionary=invalid;assert.throws(()=>WritingStore.serialize(bad),/personalDictionary/);}
});
test('import rejects overlapping formatting that expands beyond the canonical span budget',()=>{const data=sample(),chapter=data.projects[0].chapters[0];chapter.text='a'.repeat(40004);chapter.formats=[{start:0,end:40004,italic:true},...Array.from({length:10001},(_,i)=>({start:i*4,end:i*4+2,bold:true}))];assert.throws(()=>WritingStore.serialize(data),/too many separate formatted selections/);});
test('removed personal words survive backups and malformed removed words are rejected',()=>{
  const data=sample();data.preferences.dictionaryTrash=[{word:'Aurelia',deletedAt:'2026-10-03T20:00:00Z'}];
  assert.deepEqual(WritingStore.parse(WritingStore.serialize(data)),data);
  for(const invalid of [null,{},[{word:'',deletedAt:'today'}],[{word:'a\nb',deletedAt:'today'}],[{word:'Name'}],[{word:'Name',deletedAt:42}],Array(5001).fill({word:'Name',deletedAt:'today'})]){const bad=structuredClone(data);bad.preferences.dictionaryTrash=invalid;assert.throws(()=>WritingStore.serialize(bad),/dictionaryTrash/);}
});

test('font choices and optional chapter hints survive a backup',()=>{for(const font of ['chalkboard','serif','sans','georgia','palatino','garamond','times','courier','trebuchet','verdana']){const data=sample();data.preferences.font=font;data.preferences.hintsVisible=false;assert.deepEqual(WritingStore.parse(WritingStore.serialize(data)),data);}const bad=sample();bad.preferences.hintsVisible='yes';assert.throws(()=>WritingStore.serialize(bad),/hintsVisible/);});

test('custom palettes round-trip and reject invalid slider data',()=>{const data=sample();data.preferences.palette={enabled:true,mode:'gradient',hues:[145,25,340],saturation:35,lightness:90,angle:135};assert.deepEqual(WritingStore.parse(WritingStore.serialize(data)),data);for(const change of [{enabled:'yes'},{mode:'url(bad)'},{hues:[1,2]},{hues:[-1,25,340]},{saturation:66},{lightness:0},{angle:'135'}]){const bad=structuredClone(data);Object.assign(bad.preferences.palette,change);assert.throws(()=>WritingStore.serialize(bad),/palette/);}});

test('expanded project types and chapter roles round-trip with every genre',()=>{const catalog=require('../app/genres.js');for(const type of catalog.types)for(const genre of Object.keys(catalog.library[type.id])){const data=sample();data.projects[0].type=type.id;data.projects[0].genres={[type.id]:genre};data.projects[0].chapters[0].roles={[type.id]:'development'};assert.deepEqual(WritingStore.parse(WritingStore.serialize(data)),data);}});
test('writing profiles survive backups without accepting credential fields',()=>{const data=sample();data.projects[0].writingProfile={tone:'warm',style:'Conversational',audience:'General readers',pov:'first',englishVariant:'american',instructions:'Preserve my voice.'};assert.deepEqual(WritingStore.parse(WritingStore.serialize(data)),data);for(const change of [{tone:'strange'},{pov:'automatic'},{apiKey:'not-a-real-key'},{style:'x'.repeat(401)},{instructions:'x'.repeat(2001)}]){const bad=structuredClone(data);Object.assign(bad.projects[0].writingProfile,change);assert.throws(()=>WritingStore.serialize(bad),/writingProfile/);}});

test("legacy projects without character lists load with an empty list",()=>{
  const data=sample();delete data.projects[0].characters;
  const restored=WritingStore.parse(JSON.stringify(data));
  assert.deepEqual(restored.projects[0].characters,[]);
  const deleted={...sample().projects[0],id:"deleted-legacy-project"};delete deleted.characters;
  const withDeleted=sample({trashProjects:[{id:"trash-project",kind:"project",label:"Old draft",deletedAt:"2026-10-03",item:deleted}]});
  assert.deepEqual(WritingStore.parse(JSON.stringify(withDeleted)).trashProjects[0].item.characters,[]);
});

test("active and trashed character profiles round-trip in active and deleted projects",()=>{
  const data=sample();
  data.projects[0].characters=[character("active-1")];
  data.projects[0].trash.push({id:"trash-character-entry",kind:"character",label:"Former cast member",deletedAt:"2026-10-03",item:character("deleted-1")});
  const deletedProject={...sample().projects[0],id:"deleted-project",characters:[character("deleted-project-person")]};
  deletedProject.trash=[{id:"deleted-project-trash-character",kind:"character",label:"Removed profile",deletedAt:"2026-10-03",item:character("deleted-project-person-2")}];
  data.trashProjects=[{id:"trash-project-entry",kind:"project",label:"Deleted project",deletedAt:"2026-10-03",item:deletedProject}];
  assert.deepEqual(WritingStore.parse(WritingStore.serialize(data)),data);
});

test("character profiles require the known fields and bounded strings",()=>{
  const invalidType=sample();invalidType.projects[0].characters={};
  assert.throws(()=>WritingStore.serialize(invalidType),/characters must contain at most 1000/);
  const missing=sample();missing.projects[0].characters=[character("missing",{beliefs:null})];
  assert.throws(()=>WritingStore.serialize(missing),/characters\[0\]\.beliefs must be a string/);
  const unknown=sample();unknown.projects[0].characters=[character("extra",{secret:"x"})];
  assert.throws(()=>WritingStore.serialize(unknown),/unsupported field/);
  for(const [field,value] of [["name","  "],["name","x".repeat(201)],["role","x".repeat(401)],["appearance","x".repeat(20001)],["notes",42]]){
    const bad=sample();bad.projects[0].characters=[character("bounded",{[field]:value})];
    assert.throws(()=>WritingStore.serialize(bad),/name must be nonempty|role is too long|appearance is too long|notes must be a string/);
  }
});

test("active and trashed character IDs cannot collide within a project",()=>{
  const duplicateActive=sample();duplicateActive.projects[0].characters=[character("same"),character("same")];
  assert.throws(()=>WritingStore.validate(duplicateActive),/character ids must be unique/);
  const activeAndTrash=sample();activeAndTrash.projects[0].characters=[character("same")];activeAndTrash.projects[0].trash.push({id:"trash-char",kind:"character",label:"Removed",deletedAt:"today",item:character("same")});
  assert.throws(()=>WritingStore.validate(activeAndTrash),/character ids must be unique/);
  const duplicateTrash=sample();duplicateTrash.projects[0].trash.push({id:"trash-char-a",kind:"character",label:"Removed A",deletedAt:"today",item:character("same")},{id:"trash-char-b",kind:"character",label:"Removed B",deletedAt:"today",item:character("same")});
  assert.throws(()=>WritingStore.validate(duplicateTrash),/character ids must be unique/);
});

test("character list limit is 1000 and character trash requires a typed profile",()=>{
  const tooMany=sample();tooMany.projects[0].characters=Array.from({length:1001},(_,index)=>character("person-"+index));
  assert.throws(()=>WritingStore.validate(tooMany),/characters must contain at most 1000/);
  const malformedTrash=sample();malformedTrash.projects[0].trash.push({id:"trash-character",kind:"character",label:"Bad profile",deletedAt:"today",item:{id:"missing-fields"}});
  assert.throws(()=>WritingStore.validate(malformedTrash),/name must be a string/);
});

test("Assistant and revision drafts survive local save, backup, import and chapter Trash", () => {
  const data = sample(), chapter = data.projects[0].chapters[0];
  chapter.assistantDraft = {model:'deepseek-v4-pro',goal:'feedback',brief:'Keep my voice.',text:'A passage',suggestion:{text:'A reviewed suggestion',truncated:false}};
  chapter.uiDrafts = {revision:{find:'passage',replacement:'scene',scope:'project',caseSensitive:true,wholeWord:false,previewRequested:true}};
  const storage = memoryStorage(), store = WritingStore.createStore(storage);
  store.save(data);
  assert.deepEqual(store.load().projects[0].chapters[0].assistantDraft, chapter.assistantDraft);
  assert.deepEqual(WritingStore.parse(WritingStore.serialize(data)).projects[0].chapters[0].uiDrafts, chapter.uiDrafts);
  data.projects[0].trash.push({id:'deleted-chapter',kind:'chapter',label:chapter.title,deletedAt:'2026-10-03',item:structuredClone(chapter)});
  assert.deepEqual(WritingStore.parse(WritingStore.serialize(data)).projects[0].trash.at(-1).item.assistantDraft, chapter.assistantDraft);
});

test("Assistant drafts reject secrets, runtime targets, unsupported choices and oversized fields", () => {
  const draft = {model:'deepseek-flash',goal:'brainstorm',brief:'A request',text:'An excerpt',suggestion:{text:'A suggestion',truncated:false}};
  const invalid = [
    {...draft,apiKey:'secret'}, {...draft,connected:true}, {...draft,model:'arbitrary'}, {...draft,goal:'delete'},
    {...draft,brief:'x'.repeat(2001)}, {...draft,text:'x'.repeat(10001)}, {...draft,text:'a\0b'},
    {...draft,suggestion:{...draft.suggestion,target:{text:'Old manuscript'}}},
    {...draft,suggestion:{...draft.suggestion,text:'x'.repeat(24001)}},
    {...draft,suggestion:{...draft.suggestion,truncated:'false'}},
  ];
  for (const candidate of invalid) {
    const data = sample(); data.projects[0].chapters[0].assistantDraft = candidate;
    assert.throws(() => WritingStore.serialize(data), /assistantDraft/);
  }
});

test("revision drafts reject snapshots, invalid options and oversized search context", () => {
  const revision = {find:'word',replacement:'term',scope:'chapter',caseSensitive:false,wholeWord:true,previewRequested:false};
  for (const candidate of [{...revision,snapshot:'manuscript'}, {...revision,scope:'global'}, {...revision,wholeWord:1}, {...revision,find:'x'.repeat(100001)}]) {
    const data = sample(); data.projects[0].chapters[0].uiDrafts = {revision:candidate};
    assert.throws(() => WritingStore.serialize(data), /uiDrafts.revision/);
  }
});
