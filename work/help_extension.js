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
