(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require('./genres.js') : root.WritingGenres);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WritingStore = api;
})(typeof globalThis === "object" ? globalThis : this, function (genreData) {
  "use strict";

  const PRIMARY_KEY = "writing-desk-v1";
  const RECOVERY_KEY = "writing-desk-v1-recovery";
  const MAX_TEXT_LENGTH = 20 * 1024 * 1024;
  const MAX_DEPTH = 128;
  const MAX_NODES = 250000;
  const TRASH_KINDS = new Set(["chapter", "source", "note", "idea", "saved", "outline", "version", "task", "project", "character"]);
  const MAX_CHARACTERS = 1000;
  const CHARACTER_FIELDS = new Set(["id", "name", "role", "appearance", "traits", "habits", "beliefs", "goals", "fears", "relationships", "backstory", "arc", "notes"]);
  const GENRES = Object.fromEntries(Object.entries(genreData.library).map(([type,genres])=>[type,new Set(Object.keys(genres))]));

  function fail(message) {
    throw new TypeError("Invalid writing data: " + message);
  }

  function isRecord(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  // Validate values before JSON.stringify so accessors and custom objects cannot
  // run code as a side effect of saving.
  function assertJsonValue(value, label, state, depth) {
    state.nodes += 1;
    if (state.nodes > MAX_NODES) fail(label + " contains too many values");
    if (depth > MAX_DEPTH) fail(label + " is nested too deeply");

    if (value === null || typeof value === "string" || typeof value === "boolean") return;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) fail(label + " contains a non-finite number");
      return;
    }
    if (typeof value !== "object") fail(label + " contains a non-JSON value");

    if (state.seen.has(value)) fail(label + " contains a cycle");
    state.seen.add(value);

    if (Array.isArray(value)) {
      const keys = Reflect.ownKeys(value);
      if (keys.some((key) => key !== "length" && (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key)))) {
        fail(label + " contains an array with extra properties");
      }
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) fail(label + " contains a sparse or accessor array");
        assertJsonValue(descriptor.value, label, state, depth + 1);
      }
      state.seen.delete(value);
      return;
    }

    if (!isRecord(value)) fail(label + " contains a non-plain object");
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key !== "string")) fail(label + " contains a symbol key");
    if (ownKeys.some((key) => !Object.prototype.propertyIsEnumerable.call(value, key))) fail(label + " contains a hidden property");
    for (const key of Object.keys(value)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") fail(label + " contains a forbidden property name");
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) fail(label + " contains an accessor or hidden property");
      assertJsonValue(descriptor.value, label, state, depth + 1);
    }
    state.seen.delete(value);
  }

  function requireRecord(value, label) {
    if (!isRecord(value)) fail(label + " must be an object");
  }

  function requireString(value, label) {
    if (typeof value !== "string") fail(label + " must be a string");
  }

  function requireId(value, label) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(value)) {
      fail(label + " must be a 1 to 200 character ID using letters, numbers, underscores, or hyphens");
    }
  }

  function validateChapter(chapter, label, chapterIds) {
    requireRecord(chapter, label);
    requireId(chapter.id, label + ".id");
    validateAlignment(chapter, label);
    for (const field of ["title", "text", "note", "summary", "task", "status"]) requireString(chapter[field], label + "." + field);
    validateFormatting(chapter, label);
    if ("assistantDraft" in chapter) validateAssistantDraft(chapter.assistantDraft, label + ".assistantDraft");
    if ("uiDrafts" in chapter) {
      requireRecord(chapter.uiDrafts, label + ".uiDrafts");
      if (Object.keys(chapter.uiDrafts).some(key => key !== "revision")) fail(label + ".uiDrafts has an unsupported field");
      if ("revision" in chapter.uiDrafts) validateRevisionDraft(chapter.uiDrafts.revision, label + ".uiDrafts.revision");
    }
    for (const field of ["idea", "saved", "planOutline"]) {
      if (field in chapter) requireString(chapter[field], label + "." + field);
    }
    const roles = new Set(["opening", "development", "turning", "application", "closing"]);
    if ("roles" in chapter) {
      requireRecord(chapter.roles, label + ".roles");
      for (const [type, role] of Object.entries(chapter.roles)) {
        if (!Object.prototype.hasOwnProperty.call(GENRES, type) || !roles.has(role)) fail(label + ".roles contains an unsupported role");
      }
    }
    for (const field of ["guidePicks", "addedGuides"]) {
      if (field in chapter) validateBooleanMap(chapter[field], label + "." + field);
    }
    if (chapterIds) {
      if (chapterIds.has(chapter.id)) fail("chapter ids must be unique");
      chapterIds.add(chapter.id);
    }
  }

  function validateAssistantDraft(draft, label) {
    requireRecord(draft, label);
    if (Object.keys(draft).some(key => !["model", "goal", "brief", "text", "suggestion"].includes(key))) fail(label + " has an unsupported field");
    if (!["deepseek-flash", "deepseek-v4-pro"].includes(draft.model)) fail(label + ".model is unsupported");
    if (!["brainstorm", "outline", "continue", "rewrite", "feedback"].includes(draft.goal)) fail(label + ".goal is unsupported");
    for (const [field, limit] of [["brief", 2000], ["text", 10000]]) {
      requireString(draft[field], label + "." + field);
      if (draft[field].length > limit || draft[field].includes("\u0000")) fail(label + "." + field + " is too long or invalid");
    }
    if (draft.suggestion !== null) {
      requireRecord(draft.suggestion, label + ".suggestion");
      if (Object.keys(draft.suggestion).some(key => !["text", "truncated"].includes(key))) fail(label + ".suggestion has an unsupported field");
      requireString(draft.suggestion.text, label + ".suggestion.text");
      if (draft.suggestion.text.length > 24000 || draft.suggestion.text.includes("\u0000")) fail(label + ".suggestion.text is too long or invalid");
      if (typeof draft.suggestion.truncated !== "boolean") fail(label + ".suggestion.truncated must be a boolean");
    }
  }

  function validateRevisionDraft(draft, label) {
    requireRecord(draft, label);
    if (Object.keys(draft).some(key => !["find", "replacement", "scope", "caseSensitive", "wholeWord", "previewRequested"].includes(key))) fail(label + " has an unsupported field");
    for (const field of ["find", "replacement"]) {
      requireString(draft[field], label + "." + field);
      if (draft[field].length > 100000) fail(label + "." + field + " is too long");
    }
    if (!["chapter", "project"].includes(draft.scope)) fail(label + ".scope is unsupported");
    for (const field of ["caseSensitive", "wholeWord", "previewRequested"]) if (typeof draft[field] !== "boolean") fail(label + "." + field + " must be a boolean");
  }

  function validateSource(source, label, sourceIds) {
    requireRecord(source, label);
    requireId(source.id, label + ".id");
    requireString(source.title, label + ".title");
    if (sourceIds) {
      if (sourceIds.has(source.id)) fail("source ids must be unique within a project");
      sourceIds.add(source.id);
    }
    for (const field of ["author", "locator", "url", "quotation", "notes"]) {
      if (field in source) requireString(source[field], label + "." + field);
    }
  }

  function validateCharacter(character, label, characterIds) {
    requireRecord(character, label);
    if (Object.keys(character).some((field) => !CHARACTER_FIELDS.has(field))) fail(label + " has an unsupported field");
    requireId(character.id, label + ".id");
    requireString(character.name, label + ".name");
    if (!character.name.trim() || character.name.length > 200) fail(label + ".name must be nonempty and at most 200 characters");
    requireString(character.role, label + ".role");
    if (character.role.length > 400) fail(label + ".role is too long");
    for (const field of ["appearance", "traits", "habits", "beliefs", "goals", "fears", "relationships", "backstory", "arc", "notes"]) {
      requireString(character[field], label + "." + field);
      if (character[field].length > 20000) fail(label + "." + field + " is too long");
    }
    if (characterIds) {
      if (characterIds.has(character.id)) fail("character ids must be unique within a project");
      characterIds.add(character.id);
    }
  }

  function validateBooleanMap(value, label) {
    requireRecord(value, label);
    function visit(record, path, depth) {
      if (depth > 12) fail(path + " is nested too deeply");
      for (const [key, entry] of Object.entries(record)) {
        if (typeof entry === "boolean") continue;
        if (isRecord(entry)) visit(entry, path + "." + key, depth + 1);
        else fail(path + "." + key + " must contain booleans or nested objects");
      }
    }
    visit(value, label, 0);
  }

  function validateGenres(genres, label) {
    if (genres === undefined) return;
    requireRecord(genres, label);
    for (const [type, value] of Object.entries(genres)) {
      if (!Object.prototype.hasOwnProperty.call(GENRES, type) || !GENRES[type].has(value)) {
        fail(label + " contains an unsupported genre");
      }
    }
  }

  function validateProject(project, label, projectDepth, projectIds, chapterIds) {
    if (projectDepth > 8) fail(label + " has nested trashed projects that are too deep");
    requireRecord(project, label);
    requireId(project.id, label + ".id");
    requireString(project.title, label + ".title");
    if (!Object.prototype.hasOwnProperty.call(GENRES,project.type)) fail(label + ".type is unsupported");
    if ("writingProfile" in project) {
      const profile=project.writingProfile;requireRecord(profile,label+".writingProfile");
      if(Object.keys(profile).some(key=>!["tone","style","audience","pov","englishVariant","instructions"].includes(key))) fail(label+".writingProfile has an unsupported field");
      for(const [key,choices] of [["tone",["plain","warm","reflective","formal","playful"]],["pov",["first","second","third"]],["englishVariant",["american","british"]]]) if(key in profile&&!choices.includes(profile[key]))fail(label+".writingProfile."+key+" is unsupported");
      for(const [key,limit] of [["style",400],["audience",400],["instructions",2000]]) if(key in profile&&(typeof profile[key]!=="string"||profile[key].length>limit))fail(label+".writingProfile."+key+" is too long or invalid");
    }
    if (projectIds) {
      if (projectIds.has(project.id)) fail("project ids must be unique");
      projectIds.add(project.id);
    }

    if (!Array.isArray(project.chapters) || project.chapters.length < 1) fail(label + ".chapters must contain at least one chapter");
    for (let chapterIndex = 0; chapterIndex < project.chapters.length; chapterIndex += 1) {
      validateChapter(project.chapters[chapterIndex], label + ".chapters[" + chapterIndex + "]", chapterIds);
    }

    if (!Array.isArray(project.sources)) fail(label + ".sources must be an array");
    const sourceIds = new Set();
    project.sources.forEach((source, index) => validateSource(source, label + ".sources[" + index + "]", sourceIds));
    const characterIds = new Set();
    if ("characters" in project) {
      if (!Array.isArray(project.characters) || project.characters.length > MAX_CHARACTERS) fail(label + ".characters must contain at most 1000 character profiles");
      project.characters.forEach((character, index) => validateCharacter(character, label + ".characters[" + index + "]", characterIds));
    }
    if (!Array.isArray(project.trash)) fail(label + ".trash must be an array");
    project.trash.forEach((item, index) => validateTrashItem(item, label + ".trash[" + index + "]", false, projectDepth, projectIds, characterIds));
    if (!Array.isArray(project.history)) fail(label + ".history must be an array");
    project.history.forEach((item, index) => validateHistoryItem(item, label + ".history[" + index + "]"));
    validateGenres(project.genres, label + ".genres");
    if ("selected" in project) requireId(project.selected, label + ".selected");
  }

  function validateTrashItem(item, label, topLevel, projectDepth, projectIds, characterIds) {
    requireRecord(item, label);
    requireId(item.id, label + ".id");
    requireString(item.kind, label + ".kind");
    if (!TRASH_KINDS.has(item.kind)) fail(label + ".kind is unsupported");
    if (topLevel && item.kind !== "project") fail(label + ".kind must be project in trashProjects");
    if (!topLevel && item.kind === "project") fail(label + ".kind cannot be project in project trash");
    requireString(item.label, label + ".label");
    requireString(item.deletedAt, label + ".deletedAt");
    if (!("item" in item)) fail(label + ".item is required");
    if ("chapterId" in item) requireId(item.chapterId, label + ".chapterId");
    if (item.kind === "project") {
      if (!topLevel) fail(label + ".kind cannot be project in project trash");
      validateProject(item.item, label + ".item", projectDepth + 1, projectIds, null);
    } else if (topLevel) {
      fail(label + ".kind must be project in trashProjects");
    } else if (item.kind === "chapter") {
      validateChapter(item.item, label + ".item", null);
    } else if (item.kind === "source") {
      validateSource(item.item, label + ".item", null);
    } else if (item.kind === "version") {
      validateHistoryItem(item.item, label + ".item");
    } else if (item.kind === "character") {
      validateCharacter(item.item, label + ".item", characterIds);
    } else if (typeof item.item !== "string") {
      fail(label + ".item must be a string for " + item.kind + " trash");
    }
  }

  function validateHistoryItem(item, label) {
    requireRecord(item, label);
    validateAlignment(item, label);
    requireId(item.id, label + ".id");
    requireId(item.chapterId, label + ".chapterId");
    for (const field of ["at", "title", "text", "note", "planOutline"]) requireString(item[field], label + "." + field);
    validateFormatting(item, label);
  }

  function validateFormatting(item, label) {
    if ("lineSpacing" in item && ![1.4, 1.7, 2].includes(item.lineSpacing)) fail(label + ".lineSpacing must be 1.4, 1.7, or 2");
    if (!("formats" in item)) return;
    if (!Array.isArray(item.formats) || item.formats.length > 20000) fail(label + ".formats must contain at most 20000 spans");
    const splitSurrogate = index => index > 0 && index < item.text.length && /[\uD800-\uDBFF]/.test(item.text[index-1]) && /[\uDC00-\uDFFF]/.test(item.text[index]);
    item.formats.forEach((span, index) => {
      const path = label + ".formats[" + index + "]";
      requireRecord(span, path);
      if (Object.keys(span).some(key => !["start", "end", "bold", "italic"].includes(key))) fail(path + " has an unsupported field");
      if (!Number.isInteger(span.start) || !Number.isInteger(span.end) || span.start < 0 || span.end > item.text.length || span.end <= span.start || splitSurrogate(span.start) || splitSurrogate(span.end)) fail(path + " must use valid text boundaries");
      for (const key of ["bold", "italic"]) if (key in span && span[key] !== true) fail(path + "." + key + " must be true when present");
      if (!span.bold && !span.italic) fail(path + " must be bold or italic");
    });
    // Imports may contain overlapping spans. Bound the resulting canonical runs too.
    const events = item.formats.flatMap(span => [{at:span.start, bold:span.bold?1:0, italic:span.italic?1:0}, {at:span.end, bold:span.bold?-1:0, italic:span.italic?-1:0}]).sort((a,b)=>a.at-b.at);
    let bold=0, italic=0, previous=0, previousEnd=-1, previousStyle=0, count=0, index=0;
    while(index<events.length) {
      const at=events[index].at, style=(bold>0?1:0)+(italic>0?2:0);
      if(at>previous && style) { if(previousEnd!==previous || previousStyle!==style) count++; previousEnd=at; previousStyle=style; }
      while(index<events.length && events[index].at===at) { bold+=events[index].bold; italic+=events[index].italic; index++; }
      previous=at;
    }
    if(count>20000) fail(label + ".formats creates too many separate formatted selections");
  }

  function validateAlignment(item, label) {
    if ("alignment" in item && !["left", "right", "justify"].includes(item.alignment)) {
      fail(label + ".alignment must be left, right, or justify");
    }
  }

  function validate(data) {
    requireRecord(data, "root");
    const state = { nodes: 0, seen: new WeakSet() };
    assertJsonValue(data, "root", state, 0);

    if (data.version !== 1) fail("version must be 1");
    if (!Array.isArray(data.projects) || data.projects.length < 1) fail("projects must contain at least one project");
    requireId(data.activeProject, "activeProject");
    requireRecord(data.preferences, "preferences");
    const preferenceEnums = {
      theme: new Set(["light", "dark", "glass"]),
      font: new Set(["chalkboard", "serif", "sans", "georgia", "palatino", "garamond", "times", "courier", "trebuchet", "verdana"]),
      typing: new Set(["off", "suggest", "auto"]),
      contextTab: new Set(["guide", "ideas", "notes"]),
    };
    for (const [field, values] of Object.entries(preferenceEnums)) {
      if (field in data.preferences && !values.has(data.preferences[field])) fail("preferences." + field + " is unsupported");
    }
    for (const field of ["solidGlass", "context", "hintsVisible"]) {
      if (field in data.preferences && typeof data.preferences[field] !== "boolean") fail("preferences." + field + " must be a boolean");
    }
    if ("prose" in data.preferences && ![16, 18, 20, 22].includes(data.preferences.prose)) fail("preferences.prose must be 16, 18, 20, or 22");

    if ("personalDictionary" in data.preferences) {
      const words = data.preferences.personalDictionary;
      if (!Array.isArray(words) || words.length > 5000 || words.some(word => typeof word !== "string" || !word.trim() || word.length > 100 || /[\r\n\u0000-\u001f]/.test(word))) fail("preferences.personalDictionary must contain at most 5000 single-line words of up to 100 characters");
    }
    if ("dictionaryTrash" in data.preferences) {
      const removed = data.preferences.dictionaryTrash;
      if (!Array.isArray(removed) || removed.length > 5000 || removed.some(item => !item || typeof item !== "object" || Array.isArray(item) || typeof item.word !== "string" || !item.word.trim() || item.word.length > 100 || /[\r\n\u0000-\u001f]/.test(item.word) || typeof item.deletedAt !== "string" || !item.deletedAt || item.deletedAt.length > 100)) fail("preferences.dictionaryTrash must contain at most 5000 removed words with deletion dates");
    }
    if ("palette" in data.preferences) {
      const palette=data.preferences.palette;requireRecord(palette,"preferences.palette");
      if(typeof palette.enabled!=="boolean" || !["solid","gradient"].includes(palette.mode) || !Array.isArray(palette.hues) || palette.hues.length!==3 || palette.hues.some(value=>typeof value!=="number"||value<0||value>360)) fail("preferences.palette has invalid colors");
      for(const [key,min,max] of [["saturation",0,65],["lightness",15,95],["angle",0,360]]) if(typeof palette[key]!=="number"||palette[key]<min||palette[key]>max) fail("preferences.palette."+key+" is outside its allowed range");
    }

    const projectIds = new Set();
    const chapterIds = new Set();
    for (let projectIndex = 0; projectIndex < data.projects.length; projectIndex += 1) {
      const label = "projects[" + projectIndex + "]";
      validateProject(data.projects[projectIndex], label, 0, projectIds, chapterIds);
    }

    if (!projectIds.has(data.activeProject)) fail("activeProject must identify an existing project");
    if ("trashProjects" in data) {
      if (!Array.isArray(data.trashProjects)) fail("trashProjects must be an array");
      data.trashProjects.forEach((item, index) => validateTrashItem(item, "trashProjects[" + index + "]", true, 0, projectIds));
    }
    return true;
  }

  function serialize(data) {
    validate(data);
    let text;
    try {
      text = JSON.stringify(data);
    } catch (error) {
      throw new TypeError("Could not serialize writing data: " + error.message);
    }
    if (typeof text !== "string" || text.length > MAX_TEXT_LENGTH) {
      throw new RangeError("Writing data exceeds the 20 MB storage limit");
    }
    return text;
  }

  function parse(text) {
    if (typeof text !== "string") throw new TypeError("Stored writing data must be text");
    if (text.length > MAX_TEXT_LENGTH) throw new RangeError("Stored writing data exceeds the 20 MB limit");
    let data;
    try {
      data = JSON.parse(text);
    } catch (error) {
      throw new SyntaxError("Stored writing data is not valid JSON: " + error.message);
    }
    validate(data);
    for (const project of data.projects) if (!("characters" in project)) project.characters = [];
    if (Array.isArray(data.trashProjects)) {
      for (const deleted of data.trashProjects) if (deleted && deleted.kind === "project" && deleted.item && !("characters" in deleted.item)) deleted.item.characters = [];
    }
    return data;
  }

  function defaultStorage() {
    if (typeof globalThis === "undefined" || !globalThis.localStorage) {
      throw new Error("Browser localStorage is unavailable");
    }
    return globalThis.localStorage;
  }

  function createStore(storage) {
    function backend() {
      const value = storage || defaultStorage();
      if (!value || typeof value.getItem !== "function" || typeof value.setItem !== "function") {
        throw new TypeError("Storage must provide getItem and setItem methods");
      }
      return value;
    }

    function load() {
      const store = backend();
      const primary = store.getItem(PRIMARY_KEY);
      if (primary === null) {
        const recovery = store.getItem(RECOVERY_KEY);
        if (recovery === null) return null;
        try {
          return parse(recovery);
        } catch (recoveryError) {
          throw new Error("Writing data is corrupt and its recovery copy is invalid", { cause: recoveryError });
        }
      }
      try {
        return parse(primary);
      } catch (primaryError) {
        const recovery = store.getItem(RECOVERY_KEY);
        if (recovery !== null) {
          try {
            return parse(recovery);
          } catch (recoveryError) {
            throw new Error("Writing data is corrupt and its recovery copy is invalid", { cause: recoveryError });
          }
        }
        throw new Error("Writing data is corrupt and no valid recovery copy is available", { cause: primaryError });
      }
    }

    function save(data) {
      const text = serialize(data);
      const store = backend();
      const previous = store.getItem(PRIMARY_KEY);
      if (previous !== null) {
        let previousIsValid = false;
        try {
          parse(previous);
          previousIsValid = true;
        } catch (_) {
          // Invalid primary data must never replace a known recovery copy.
        }
        if (previousIsValid) store.setItem(RECOVERY_KEY, previous);
      }
      store.setItem(PRIMARY_KEY, text);
      return true;
    }

    return { load, save };
  }

  const defaultStore = createStore(null);
  return {
    primaryKey: PRIMARY_KEY,
    recoveryKey: RECOVERY_KEY,
    maxTextLength: MAX_TEXT_LENGTH,
    validate,
    serialize,
    parse,
    load: defaultStore.load,
    save: defaultStore.save,
    createStore,
  };
});
