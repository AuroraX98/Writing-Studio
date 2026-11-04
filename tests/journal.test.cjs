const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Store=require('../app/storage.js');
const Journal=require('../app/journal.js');
const Export=require('../app/export.js');
const Pdf=require('../app/pdf.js');
const fixture=()=>{const data=JSON.parse(fs.readFileSync(require.resolve('./backup-fixture.json'),'utf8'));for(const p of data.projects)p.characters??=[];return data;};

test('older backups remain readable without inventing creation dates',()=>{
 const data=fixture();
 for(const p of data.projects)for(const c of p.chapters)delete c.createdAt;
 const restored=Store.parse(Store.serialize(data));
 assert.deepEqual(restored.projects,data.projects);
 assert.equal(Journal.createdLabel(restored.projects[0].chapters[0]),'Creation date unavailable');
});
test('journal timestamps and panel choices survive full backup round trips',()=>{
 const data=fixture(),p=data.projects[0],c=p.chapters[0];
 p.type='journaling';p.genres={journaling:'journaling'};c.title='A title of my own';c.createdAt='2026-11-03T16:25:30.000Z';
 Object.assign(data.preferences,{studioPanel:'outline',studioChapters:false,studioTools:false});
 const restored=Store.parse(Store.serialize(data));
 assert.deepEqual(restored,data);assert.equal(Journal.isJournal(p),true);
 assert.match(Journal.createdLabel(c,'en-US',{timeZone:'America/Los_Angeles'}),/Nov 3, 2026, 8:25 AM/);
});
test('invalid creation dates and malformed panel preferences are rejected',()=>{
 for(const createdAt of ['yesterday','2026-02-30T16:25:30.000Z',123,null]){
  const data=fixture();data.projects[0].chapters[0].createdAt=createdAt;
  assert.throws(()=>Store.serialize(data),/createdAt/);assert.equal(Journal.validCreatedAt(createdAt),false);
 }
 const data=fixture();data.preferences.studioTools='false';assert.throws(()=>Store.serialize(data),/studioTools/);
 delete data.preferences.studioTools;data.preferences.studioPanel='missing';assert.throws(()=>Store.serialize(data),/studioPanel/);
});
test('journal exports include title, creation date and writing, excluding private notes',()=>{
 const p={title:'My journal',type:'journaling',chapters:[{title:'A quiet morning',createdAt:'2026-11-03T16:25:30.000Z',text:'The harbor was still.',note:'PRIVATE JOURNAL NOTE',formats:[]}]};
 for(const exportText of [Export.text(p),Export.markdown(p),Export.html(p)]){
  assert.match(exportText,/A quiet morning/);assert.match(exportText,/Created/);assert.match(exportText,/2026/);assert.match(exportText,/The harbor was still/);assert.doesNotMatch(exportText,/PRIVATE JOURNAL NOTE/);
 }
 assert.ok(Export.docx(p).byteLength>100);assert.ok(Pdf.pdf(p).byteLength>100);
 const book={...p,type:'fiction'};assert.doesNotMatch(Export.text(book),/Created/);
});
