// Run with WRITING_STUDIO_QA_MODULES pointing at a node_modules directory that
// contains playwright and axe-core. Use a dedicated launcher/backup directory.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require(path.join(process.env.WRITING_STUDIO_QA_MODULES,'playwright'));
const axe=require(path.join(process.env.WRITING_STUDIO_QA_MODULES,'axe-core'));
const out=process.env.WRITING_STUDIO_QA_OUTPUT||path.join(__dirname,'../work/browser-check');
const url=process.env.WRITING_STUDIO_QA_URL||'http://127.0.0.1:8874';
const evidence=[];let browser;
const note=(name,details)=>{evidence.push({name,details});process.stdout.write('PASS '+name+'\n');};
(async()=>{
 await fs.mkdir(out,{recursive:true});
 browser=await chromium.launch({executablePath:process.env.WRITING_STUDIO_QA_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/Los_Angeles',acceptDownloads:true});
 const page=await ctx.newPage();page.setDefaultTimeout(6000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const saved=()=>page.waitForFunction(()=>document.querySelector('#w-save-status').textContent.startsWith('Saved'));
 const go=async(view)=>{const project=['export','backups','trash'].includes(view);await page.locator(project?'#w-project-menu>summary':'#w-workspace-menu>summary').click();await page.locator(view==='backups'?'#w-folder-backups':(project?'#w-project-menu':'#w-workspace-menu')+' [data-view='+view+']').click();};
 await page.goto(url);
 await page.locator('#w-project-menu>summary').click();await page.locator('#w-new-project').click();await page.keyboard.press('Escape');
 await page.waitForFunction(()=>document.activeElement===document.querySelector('#w-project-menu>summary'));
 note('Project dialog Escape restores visible focus',true);
 await page.locator('#w-project-menu>summary').click();await page.locator('#w-new-project').click();await page.locator('#w-dialog-cancel').click();
 await page.waitForFunction(()=>document.activeElement===document.querySelector('#w-project-menu>summary'));
 note('Project dialog Cancel restores visible focus',true);
 await page.locator('#w-project-menu>summary').click();await page.locator('#w-new-project').click();
 await page.locator('dialog input[name=title]').fill('QA journal');await page.locator('#w-new-type').selectOption('journaling');await page.locator('#w-dialog-save').click();
 assert.equal(await page.locator('#w-title').inputValue(),'Untitled entry');
 await page.locator('#w-title').fill('A quiet morning');await page.locator('#w-draft').fill('The harbor was quiet. A small boat crossed the water.');await saved();
 // Simulate an existing workspace from the version that offered the tools panel.
 await page.evaluate(()=>{const key='writing-desk-v1',data=JSON.parse(localStorage.getItem(key)),p=data.projects.find(p=>p.id===data.activeProject),c=p.chapters.find(c=>c.id===p.selected)||p.chapters[0];Object.assign(c,{note:'PRIVATE QA JOURNAL NOTE',planOutline:'LEGACY OUTLINE',idea:'LEGACY IDEA',saved:'LEGACY PASSAGE',task:'LEGACY REVISION TASK',review:{0:true},uiDrafts:{revision:{find:'harbor',replacement:'shore',scope:'chapter',caseSensitive:false,wholeWord:false,previewRequested:false}}});Object.assign(data.preferences,{studioTools:true,studioPanel:'outline',context:true});localStorage.setItem(key,JSON.stringify(data));});
 const created=await page.locator('.w-entry-created time').getAttribute('datetime');assert.ok(Number.isFinite(Date.parse(created)));
 await page.reload();assert.equal(await page.locator('#w-title').inputValue(),'A quiet morning');assert.equal(await page.locator('.w-entry-created time').getAttribute('datetime'),created);
 assert.equal(await page.locator('#w-context,#w-studio-tools,#w-panel-choice').count(),0);assert.equal(await page.locator('#w-save-status').isVisible(),false);
 note('Journal title and original timestamp persist; routine save is hidden',{created});
 await page.locator('#w-studio-chapters').click();await saved();await page.reload();assert.equal(await page.locator('#w-chapters-sidebar').isHidden(),true);await page.locator('#w-studio-chapters').click();
 for(const type of ['journaling','fiction','nonfiction','memoir','poetry','screenplay','essays','academic']){await page.locator('#w-project-menu>summary').click();await page.locator('#w-type').selectOption(type);await page.keyboard.press('Escape');assert.equal(await page.locator('#w-context,#w-studio-tools,#w-panel-choice,#w-note,#w-outline,#w-idea,#w-saved').count(),0);assert.equal(await page.locator('#w-draft').inputValue(),'The harbor was quiet. A small boat crossed the water.');}
 await page.locator('#w-project-menu>summary').click();await page.locator('#w-type').selectOption('journaling');await page.keyboard.press('Escape');
 note('Tools panel is absent in every project type; chapter list visibility persists',true);
 // Retired routes preserve the chosen project/chapter and resolve to Studio.
 const currentRoute=new URL(page.url());
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  for(const view of ['plan','revise','assistant']){
   const query=new URLSearchParams(currentRoute.hash.slice(8));query.set('view',view);
   await page.goto(url+'/#studio?'+query.toString());
   await page.waitForFunction(()=>new URLSearchParams(location.hash.slice(8)).get('view')==='write');
   assert.equal(await page.locator('#w-title').inputValue(),'A quiet morning');
   assert.equal(await page.locator('#w-draft').inputValue(),'The harbor was quiet. A small boat crossed the water.');
   assert.equal(await page.locator('[data-view=plan],[data-view=revise],[data-view=assistant],.w-board-grid,.w-assistant-grid').count(),0);
   await page.reload();assert.equal(await page.locator('#w-draft').isVisible(),true);
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('#w-draft').press('Control+Shift+F');
 assert.equal(await page.locator('#w-find-text').count(),0);
 await go('help');assert.doesNotMatch(await page.locator('#w-main').innerText(),/Chapter board|Entry board|Open Revise|Assistant|DeepSeek|Find and replace/);
 await go('write');
 note('Retired board, Revise and Assistant links safely return to Studio on desktop and mobile',true);

 await page.locator('#w-draft').evaluate(e=>{e.focus();e.setSelectionRange(0,10);e.dispatchEvent(new Event('select',{bubbles:true}));});
 await page.locator('#w-bold').click();assert.equal(await page.locator('#w-bold').getAttribute('aria-pressed'),'true');
 await page.locator('#w-open-preview').click();assert.equal(await page.locator('dialog strong').innerText(),'The harbor');await page.locator('#w-dialog-save').click();
 await page.locator('#w-draft').evaluate(e=>{e.focus();e.setSelectionRange(0,e.value.length);e.dispatchEvent(new Event('select',{bubbles:true}));});
 assert.equal(await page.locator('#w-bold').getAttribute('aria-pressed'),'mixed');
 note('Formatting exposes selected and mixed states; Preview matches',true);
 await page.locator('#w-search').fill('harbor');assert.match(await page.locator('#w-search-status').innerText(),/1 matching entry/);await page.locator('#w-search').fill('no such phrase here');assert.match(await page.locator('#w-chapters').innerText(),/No entries/);await page.locator('#w-clear-search').click();
 await go('reading');assert.match(await page.locator('#w-main').innerText(),/Created/);await page.goBack();assert.ok(await page.locator('#w-draft').isVisible());
 note('Journal search, reading timestamp and browser Back',true);
 await page.setViewportSize({width:390,height:844});await page.reload();await page.evaluate(()=>scrollTo(0,0));
 const initial={header:await page.locator('.w-top').boundingBox(),draft:await page.locator('#w-draft').boundingBox()};
 await page.screenshot({path:path.join(out,'journal-mobile.png')});
 const longText=Array.from({length:100},(_,i)=>'Moment '+i+'. I walked to the harbor and stopped beside the gate. The morning was quiet, and the water reflected the pale sky. I wanted to remember the feeling.').join('\n\n');
 await page.locator('#w-draft').fill(longText);await page.locator('#w-draft').focus();await page.keyboard.press('Control+End');await page.keyboard.type(' I am here');await saved();
 const start=await page.evaluate(()=>scrollY);const positions=[];
 for(const letter of ' writing quietly'){await page.keyboard.type(letter);positions.push(await page.evaluate(()=>scrollY));}
 await saved();const final=await page.evaluate(()=>scrollY);
 assert.ok(positions.every(y=>Math.abs(y-start)<=1));assert.ok(Math.abs(final-start)<=1);
 const bars=await page.locator('.w-top,.w-writing-toolbar').evaluateAll(es=>es.map(e=>({top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom})));
 assert.ok(bars.every(r=>r.top>=0&&r.bottom<844));assert.equal(await page.locator('#w-save-status').isVisible(),false);
 note('Long-entry typing and autosave do not move the viewport',{initial,scroll:start,positions,afterSave:final,bars});
 await page.screenshot({path:path.join(out,'long-entry-mobile.png')});
 const selection=await page.locator('#w-draft').evaluate(e=>[e.selectionStart,e.selectionEnd]);
 await page.locator('#w-studio-chapters').click();assert.equal(await page.locator('#w-chapters-sidebar').getAttribute('role'),'dialog');assert.equal(await page.locator('#w-main').getAttribute('inert'),'');await page.keyboard.press('Escape');
 assert.equal(await page.locator('#w-chapters-sidebar').isHidden(),true);assert.deepEqual(await page.locator('#w-draft').evaluate(e=>[e.selectionStart,e.selectionEnd]),selection);assert.equal(await page.evaluate(()=>scrollY),start);
 note('Mobile drawer returns focus, caret and scroll',true);
 await page.locator('#w-draft').fill('The harbor was quiet. A small boat crossed the water.');await page.setViewportSize({width:1440,height:1000});await page.reload();
 await page.locator('#w-add-chapter').click();assert.match(await page.locator('dialog h2').innerText(),/Add entry/);await page.locator('dialog input[name=title]').fill('An evening thought');await page.locator('#w-dialog-save').click();await page.locator('#w-draft').fill('A later reflection.');
 await page.locator('#w-writing-tools>summary').click();await page.locator('#w-delete-chapter').click();await page.locator('#w-dialog-save').click();await go('trash');await page.locator('[data-restore-trash]').click();assert.equal(await page.locator('#w-title').inputValue(),'An evening thought');assert.equal(await page.locator('#w-draft').inputValue(),'A later reflection.');
 note('Entry creation, deletion and restoration preserve writing',true);
 await go('export');const exports=[];
 for(const format of ['PDF','Markdown','TXT','DOCX','Reading HTML']){await page.locator('#w-format').selectOption(format);const pending=page.waitForEvent('download');await page.locator('#w-download').click();const download=await pending;await download.saveAs(path.join(out,download.suggestedFilename()));exports.push(download.suggestedFilename());}
 const pending=page.waitForEvent('download');await page.locator('#w-backup-view').click();const download=await pending;await download.saveAs(path.join(out,'backup.json'));
 const backup=JSON.parse(await fs.readFile(path.join(out,'backup.json'),'utf8'));assert.ok(backup.projects.some(p=>p.chapters.some(c=>c.note==='PRIVATE QA JOURNAL NOTE'&&c.planOutline==='LEGACY OUTLINE'&&c.idea==='LEGACY IDEA'&&c.saved==='LEGACY PASSAGE'&&c.task==='LEGACY REVISION TASK'&&c.review[0]===true&&c.uiDrafts.revision.find==='harbor')));
 note('All manuscript formats and full backup download',{exports});
 const scans=[],reflow=[];await page.addScriptTag({content:axe.source});
 for(const view of ['write','characters','research','reading','help','export','backups','trash']){
  await go(view);const result=await page.evaluate(async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));scans.push({view,violations:result.violations.map(x=>({id:x.id,nodes:x.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});
 }
 for(const width of [390,320]){await page.setViewportSize({width,height:844});for(const view of ['write','characters','research','reading','help','export','backups','trash']){await go(view);const actual=await page.evaluate(()=>document.documentElement.scrollWidth);reflow.push({width,view,actual});assert.ok(actual<=width+1,view+' overflow at '+width);}}
 await fs.writeFile(path.join(out,'axe-results.json'),JSON.stringify(scans,null,2));await fs.writeFile(path.join(out,'reflow-results.json'),JSON.stringify(reflow,null,2));
 assert.deepEqual(scans.filter(x=>x.violations.length),[]);note('8 screens pass automatic accessibility scan and 320/390px reflow',{screens:8,widths:[320,390]});
 await go('write');await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#w-draft').focus();await page.keyboard.type(' Still.');assert.equal(await page.locator('.w-glow-letter').count(),0);await page.emulateMedia({reducedMotion:'no-preference'});note('Reduced motion disables typing glow',true);
 // An old workspace has no creation date. Import must retain that uncertainty.
 await page.locator('#w-import-file').setInputFiles(path.join(__dirname,'backup-fixture.json'));await page.locator('#w-dialog-save').click();await page.locator('#w-project-menu>summary').click();await page.locator('#w-type').selectOption('journaling');await page.keyboard.press('Escape');assert.match(await page.locator('.w-entry-created').innerText(),/unavailable/);note('Imported older writing retains unknown creation dates',true);
 const second=await ctx.newPage();await second.goto(page.url());await second.locator('#w-draft').fill('Newer text in another tab.');await page.waitForFunction(()=>document.querySelector('#w-save-status').textContent.includes('Another window'));assert.equal(await page.locator('#w-save-status').isVisible(),true);await second.close();note('Concurrent editing visibly pauses saving',true);
 const bad=await browser.newContext();await bad.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='writing-desk-v1')throw new DOMException('QA quota','QuotaExceededError');return original.call(this,k,v);};});
 const badPage=await bad.newPage();await badPage.goto(url);await badPage.locator('#w-draft').fill('Do not lose this unsaved writing.');await badPage.waitForFunction(()=>document.querySelector('#w-save-status').textContent.includes('Save failed'));assert.equal(await badPage.locator('#w-save-status').isVisible(),true);assert.equal(await badPage.locator('#w-draft').inputValue(),'Do not lose this unsaved writing.');assert.equal(await badPage.locator('#w-rescue-backup').isVisible(),true);await bad.close();note('Silent autosave still exposes failures and a recovery action',true);
 assert.deepEqual(errors,[]);note('No unhandled browser JavaScript errors',true);
 await fs.writeFile(path.join(out,'results.json'),JSON.stringify({browser:await browser.version(),evidence,errors},null,2));
 await browser.close();process.stdout.write('All '+evidence.length+' browser checks passed.\n');
})().catch(async error=>{await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'partial-results.json'),JSON.stringify({evidence,error:String(error.stack)},null,2));if(browser)await browser.close();console.error(error);process.exitCode=1;});
