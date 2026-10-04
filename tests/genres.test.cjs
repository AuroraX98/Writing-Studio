const test = require("node:test");
const assert = require("node:assert/strict");
const WritingGenres = require("../app/genres.js");

const legacyIds = {
  fiction: ["novel", "mystery", "thriller", "romance", "fantasy", "scifi"],
  nonfiction: ["informative", "selfhelp", "reflective", "practical", "history"],
  memoir: ["chronological", "thematic", "braided"],
};

test("catalog retains legacy genres and includes the requested project types", () => {
  const typeIds = WritingGenres.types.map(({ id }) => id);
  assert.deepEqual(typeIds, ["fiction", "nonfiction", "memoir", "poetry", "screenplay", "essays", "academic"]);
  for (const [type, ids] of Object.entries(legacyIds)) {
    for (const id of ids) assert.ok(WritingGenres.library[type][id], `${type}.${id} remains available`);
  }
  for (const id of ["sciencefiction", "horror", "historical", "adventure", "literary", "youngadult", "children"])
    assert.ok(WritingGenres.library.fiction[id], `fiction.${id} is available`);
  for (const id of ["business", "popularscience", "travel", "creative"])
    assert.ok(WritingGenres.library.nonfiction[id], `nonfiction.${id} is available`);
  for (const id of ["comingofage", "travel"])
    assert.ok(WritingGenres.library.memoir[id], `memoir.${id} is available`);
});

test("every genre has five useful prompts and six distinct book movements", () => {
  const signatures = new Set();
  for (const [type, genres] of Object.entries(WritingGenres.library)) {
    for (const [id, genre] of Object.entries(genres)) {
      assert.equal(genre.items.length, 5, `${type}.${id} has five ingredients`);
      assert.equal(genre.map.length, 6, `${type}.${id} has six movements`);
      assert.ok(genre.items.every(([title, prompt]) => title.trim() && prompt.trim()), `${type}.${id} prompts are filled in`);
      assert.ok(genre.map.every(([title, prompt]) => title.trim() && prompt.trim()), `${type}.${id} movements are filled in`);
      assert.equal(new Set(genre.items.map(([title]) => title)).size, 5, `${type}.${id} ingredient titles differ`);
      assert.equal(new Set(genre.map.map(([title]) => title)).size, 6, `${type}.${id} movement titles differ`);
      const signature = JSON.stringify([genre.items, genre.map]);
      assert.ok(!signatures.has(signature), `${type}.${id} has its own guidance`);
      signatures.add(signature);
    }
  }
});

test("each project type has all five chapter roles", () => {
  const roleIds = Object.keys(WritingGenres.roleNames);
  assert.deepEqual(roleIds, ["opening", "development", "turning", "application", "closing"]);
  for (const { id } of WritingGenres.types) {
    assert.deepEqual(Object.keys(WritingGenres.rolePrompts[id]).sort(), [...roleIds].sort(), `${id} has role guidance`);
    for (const prompt of Object.values(WritingGenres.rolePrompts[id])) assert.ok(prompt.trim());
  }
});

test("merge keeps app legacy copy while adding expanded catalogs", () => {
  const original = { fiction: { novel: { name: "Preserved", items: [], map: [] }, extra: { name: "Custom" } }, nonfiction: {} };
  const merged = WritingGenres.mergeIntoLibrary(original);
  assert.equal(merged.fiction.novel, original.fiction.novel);
  assert.equal(merged.fiction.extra, original.fiction.extra);
  assert.ok(merged.fiction.horror);
  assert.ok(merged.poetry.lyric);
  assert.ok(merged.academic.researcharticle);
});

test("genre choices initialize to valid per-type defaults and repair unknown selections", () => {
  const genres = WritingGenres.initializeGenreChoices({ fiction: "horror", poetry: "lyric", unknown: "kept" });
  assert.equal(genres.fiction, "horror");
  assert.equal(genres.poetry, "lyric");
  assert.equal(genres.nonfiction, "reflective");
  assert.equal(genres.academic, "researcharticle");
  assert.equal(genres.unknown, "kept");
  assert.equal(WritingGenres.initializeGenreChoices({ fiction: "missing" }).fiction, "novel");
});

test("type and genre option helpers expose labels, notes, and current selections", () => {
  assert.match(WritingGenres.projectTypeOptions("poetry"), /value="poetry" selected>Poetry/);
  assert.match(WritingGenres.genreOptions("fiction", "horror"), /value="horror" selected>Horror/);
  const legacyScifiOptions = WritingGenres.genreOptions("fiction", "scifi");
  assert.match(legacyScifiOptions, /value="sciencefiction" selected>Science fiction/);
  assert.doesNotMatch(legacyScifiOptions, /value="scifi"/);
  assert.equal(WritingGenres.projectTypeLabel("academic"), "Academic");
  assert.equal(WritingGenres.genreLabel("memoir"), "Memoir structure");
  assert.equal(WritingGenres.genreLabel("poetry"), "Genre / approach");
  assert.ok(WritingGenres.types.every(({ note }) => note));
});
