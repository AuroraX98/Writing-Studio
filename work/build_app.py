from pathlib import Path
import os
import hashlib
os.chdir(Path(__file__).resolve().parent.parent)
src=Path('app/mockup-source.html').read_text(encoding='utf-8')
markup, rest=src.split('<style>',1)
css, rest=rest.split('</style>',1)
js=rest.split('<script>',1)[1].split('</script>',1)[0]
markup=markup.replace('Professional writing workspace concept','Writing Studio').replace('Writing Desk','Writing Studio').replace('>Wd.</span>', '>Ws.</span>').replace('<span class="w-secondary">Editorial × Creative Studio</span>', '')
markup=markup.replace('<option value="sans">Sans serif</option>','<option value="sans">Sans serif</option><option value="georgia">Georgia</option><option value="palatino">Palatino</option><option value="garamond">Garamond</option><option value="times">Times New Roman</option><option value="courier">Courier New</option><option value="trebuchet">Trebuchet</option><option value="verdana">Verdana</option>')
markup=markup.replace('Manuscript font<select','Manuscript font<select title="Draft and in-app reading font; manuscript downloads use book serif"')
markup=markup.replace('<h3>Manuscript</h3>','<div class="w-row"><h3>Manuscript</h3><button id="w-add-chapter" aria-label="Add chapter">＋</button></div>')
markup=markup.replace('<nav class="w-nav"','<section class="w-projectbar"><label for="w-project">Project<select id="w-project"></select></label><button id="w-new-project">New project</button><button id="w-rename-project">Rename</button><button id="w-delete-project">Delete project</button><button id="w-backup">Back up projects</button><button id="w-import">Import</button><span id="w-save-status" role="status" aria-live="polite">Opening…</span><input type="file" id="w-import-file" accept=".json,.txt,.md" hidden></section><nav class="w-nav"')
markup=markup.replace('</section><nav class="w-nav"','</section><div class="w-folderbar"><span id="w-folder-status" role="status" aria-live="polite">Folder backups…</span><button id="w-folder-backups">Folder backups</button></div><nav class="w-nav"')
markup=markup.replace('</nav>', '<button type="button" data-view="characters">Characters</button><button type="button" data-view="reading">Read manuscript</button><button type="button" data-view="trash">Trash</button></nav>',1)
markup=markup.replace('<span>Design mockup · sample project · edits reset on reload</span>','<span>Local mode · No ChatGPT account needed</span>')
markup+='\n<dialog id="w-dialog" aria-labelledby="w-dialog-title"><form id="w-form"><h2 id="w-dialog-title"></h2><div id="w-dialog-fields"></div><div class="w-row"><button type="button" id="w-dialog-cancel">Cancel</button><button type="submit" id="w-dialog-save">Save</button></div></form></dialog>\n'
# Start a blank real project, retaining all bundled guidance and typing help.
a=js.index(' const chapters=[');b=js.index(' const state=',a)
js=js[:a]+" let chapters=[];\n"+js[b:]
a=js.index(' function restoreChoices(');b=js.index(' const main=',a)
js=js[:a]+" function rememberChoices(){scheduleSave();}\n"+js[b:]
js=js.replace("format:'DOCX'","format:'Markdown'")
js=js.replace('aria-label="Chapter draft" lang="en"','aria-label="Chapter draft" placeholder="Begin writing here…" lang="en"')
js=js.replace("  actions.innerHTML=typingSuggestions.map","  status.hidden=!message;const summary=root.querySelector('.w-typing-settings summary');if(summary)summary.textContent='Typing help · '+({off:'Off',suggest:'Suggestions',auto:'Autocorrect'}[state.typing]);\n  actions.innerHTML=typingSuggestions.map")
js=js.replace('English demo · spelling and spacing suggestions.','English · spelling and spacing suggestions.').replace('English demo · common typos','English · common typos')
js=js.replace("`${escape(c.status)} · sample draft`", "`${escape(c.status)}`")
js=js.replace('${escape(c.status)} · sample draft','${escape(c.status)}')
js=js.replace(" render();\n let previousWidth", " initialize();\n render();\n let previousWidth")
js=js.replace(" if(globalThis.Tweak){const tweak=new Tweak({container:root,onChange:render});tweak.addToggle(state,'context',{label:'Show chapter context'});tweak.addSlider(state,'prose',{label:'Draft text size',min:16,max:22,unit:'px'});}", '')
js=js.replace("  fitText();\n }\n function exportDetail()", "  enrichView();fitText();\n }\n function exportDetail()")
a=js.index(' function exportDetail()');b=js.index(" root.addEventListener('click'",a)
js=js[:a]+" function exportDetail(){}\n"+js[b:]
# Replace illustrative views with functioning views.
a=js.index("  }else if(state.view==='research'){");b=js.index("  enrichView();",a)
js=js[:a]+'''  }else if(state.view==='research'){
   main.innerHTML=researchView();
  }else if(state.view==='characters'){
   main.innerHTML=charactersView();
  }else if(state.view==='revise'){
   main.innerHTML=revisionView(c);
  }else if(state.view==='assistant'){
   main.innerHTML=assistantView();
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
'''+js[b:]
js=js.replace('${Object.entries(library[state.type]).map(([id,g])=>`<option value="${id}" ${state.genres[state.type]===id?\'selected\':\'\'}>${escape(g.name)}</option>`).join(\'\')}','${genreOptions(state.type,state.genres[state.type])}')
# Textarea borders add to the measured height; retain auto-fit without a tiny scrollbar.
js=js.replace("el.style.height=el.scrollHeight+'px'","el.style.height=(el.scrollHeight+el.offsetHeight-el.clientHeight)+'px'")
# Initial data, reliable persistence and new interactions inserted before event handlers.
pos=js.index(" root.addEventListener('click'")
js=js[:pos]+''.join(Path(path).read_text(encoding='utf-8') for path in ['work/genre_extension.js','work/app_extension.js','work/app_advanced.js','work/theme_extension.js','work/characters_extension.js','work/assistant_extension.js','work/help_extension.js','work/navigation_extension.js'])+js[pos:]

js=js.replace('selected().text=draft.value','setDraftText(draft.value)').replace('selected().text=e.target.value','setDraftText(e.target.value)')
js=js.replace("const before=draft.value,caret=draft.selectionStart;draft.setRangeText","const beforeFormats=clone(selected().formats||[]);if(!typingInput)recordEditorUndo();\n  const before=draft.value,caret=draft.selectionStart;draft.setRangeText")
js=js.replace("lastCorrection={before,after:draft.value,caret}","lastCorrection={before,after:draft.value,caret,beforeFormats}")
a=js.index(' function undoTypingCorrection()');b=js.index(' function checkTypedWord(',a)
undo=js[a:b].replace("const draft=root.querySelector('#w-draft');if(!draft||!lastCorrection||draft.value!==lastCorrection.after)return;","const draft=root.querySelector('#w-draft');if(!draft||!lastCorrection||draft.value!==lastCorrection.after)return;recordEditorUndo();").replace('setDraftText(draft.value)', 'selected().text=draft.value;selected().formats=clone(lastCorrection.beforeFormats||[]);updateFormattedPreview()')
js=js[:a]+undo+js[b:]
js=js.replace('checkTypedWord(e);setDraftText', 'typingInput=true;try{checkTypedWord(e);}finally{typingInput=false;}setDraftText')
js=js.replace("if(a==='ca'&&b==='n'){","if(isPersonalWord(left)||isPersonalWord(right)){updateTyping();return;}\n   if(a==='ca'&&b==='n'){")
assert js.count("  if(word){") == 1, "Expected one completed-word correction guard"
js=js.replace("  if(word){", "  if(word&&!isPersonalWord(word[1])){")
js=js.replace("context:true,prose:18","context:true,hintsVisible:false,prose:18")
js=js.replace("context.innerHTML=guide(c);","context.innerHTML=state.hintsVisible?guide(c):'<section class=\"w-guide\"><p class=\"w-secondary\">Chapter hints are tucked away.</p><button type=\"button\" id=\"w-show-hints\">Show chapter hints</button></section>';")
js=js.replace(' initialize();\n render();',' initialize();\n initializePalette();\n initializeNavigation();\n initializeAssistant();\n render();\n connectFolderBackups();')
js=js.replace('\"Chalkboard SE\",\"Chalkboard\",cursive','\"Chalkboard SE\",\"Chalkboard\",\"Segoe Print\",\"Comic Sans MS\",cursive')
js=js.replace("sans:'system-ui,sans-serif'",'sans:\'system-ui,sans-serif\',georgia:\'Georgia,serif\',palatino:\'Palatino,"Palatino Linotype","Book Antiqua",serif\',garamond:\'Garamond,Baskerville,Georgia,serif\',times:\'"Times New Roman",Times,serif\',courier:\'"Courier New",Courier,monospace\',trebuchet:\'"Trebuchet MS",Arial,sans-serif\',verdana:\'Verdana,Geneva,sans-serif\'')
js=js.replace('enrichView();fitText();','enrichView();enrichAssistant();fitText();enrichNavigation();')
js=js.replace("root.classList.toggle('w-board-mode',state.view==='plan');", "root.classList.toggle('w-board-mode',state.view==='plan');root.classList.toggle('w-characters-mode',state.view==='characters');")
js=js.replace("[state.font]);}","[state.font]);onPaletteAppearance();}")
Path('app/styles.css').write_text(css+'\n'+Path('work/app_extra.css').read_text(encoding='utf-8'), encoding='utf-8')
Path('app/main.js').write_text(js, encoding='utf-8')
Path('app/index.html').write_text('''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>Writing Studio</title><link rel="icon" href="data:,"><link rel="stylesheet" href="styles.css"></head><body>'''+markup+'''<script src="vendor/wordnet-data.js"></script><script src="thesaurus.js"></script><script src="theme-palette.js"></script><script src="genres.js"></script><script src="assistant.js"></script><script src="text-tools.js"></script><script src="storage.js"></script><script src="revision.js"></script><script src="local-backup.js"></script><script src="export.js"></script><script src="vendor/pdf-font.js"></script><script src="pdf.js"></script><script src="main.js"></script></body></html>''', encoding='utf-8')
# Keep the portable single-file edition in step with the app build.
portable=Path('app/index.html').read_text(encoding='utf-8').replace('<link rel="stylesheet" href="styles.css">','<style>'+Path('app/styles.css').read_text(encoding='utf-8')+'</style>')
for asset in ['vendor/wordnet-data.js','thesaurus.js','theme-palette.js','genres.js','assistant.js','text-tools.js','storage.js','revision.js','local-backup.js','export.js','vendor/pdf-font.js','pdf.js','main.js']:
    portable=portable.replace('<script src="'+asset+'"></script>','<script>'+Path('app',asset).read_text(encoding='utf-8').replace('</script','<\\/script')+'</script>')
before,closing,after=portable.rpartition('</body>')
portable=before+'<script type="text/plain" id="writing-studio-font-license">'+Path('app/vendor/DejaVu-LICENSE.txt').read_text(encoding='utf-8').replace('</script','<\\/script')+'</script>'+closing+after
Path('Writing Studio.html').write_text(portable, encoding='utf-8')
# Content fingerprints keep every browser on matching scripts after an update.
index=Path('app/index.html').read_text(encoding='utf-8')
for asset in ['styles.css','vendor/wordnet-data.js','thesaurus.js','theme-palette.js','genres.js','assistant.js','text-tools.js','storage.js','revision.js','local-backup.js','export.js','vendor/pdf-font.js','pdf.js','main.js']:
    fingerprint=hashlib.sha256(Path('app',asset).read_bytes()).hexdigest()[:12]
    index=index.replace('"'+asset+'"', '"'+asset+'?v='+fingerprint+'"')
Path('app/index.html').write_text(index, encoding='utf-8')
