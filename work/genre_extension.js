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
