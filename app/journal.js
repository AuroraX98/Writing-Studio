(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WritingJournal = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const isJournal = project => project?.type === 'journaling';
  function validCreatedAt(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
  }
  function createdLabel(entry, locales, options = {}) {
    if (!validCreatedAt(entry?.createdAt)) return 'Creation date unavailable';
    return 'Created ' + new Intl.DateTimeFormat(locales, {dateStyle:'medium',timeStyle:'short',...options}).format(new Date(entry.createdAt));
  }
  return { isJournal, validCreatedAt, createdLabel };
});
