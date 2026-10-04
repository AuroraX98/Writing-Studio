(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WritingLocalBackup = api;
})(typeof globalThis === 'object' ? globalThis : this, function (root) {
  'use strict';

  function createClient(options) {
    options = options || {};
    const state = {available: false, folder: '', lastBackup: null, error: null, conflict: false, revision: null};
    let token = '', connecting = null, connected = false, chain = Promise.resolve(), lastSent = null;
    const copy = () => Object.assign({}, state);
    function notify(patch) {
      Object.assign(state, patch);
      if (typeof options.onStatus === 'function') options.onStatus(copy());
      return copy();
    }
    function error(message) {
      const failure = new Error(message);
      notify({error: message});
      return failure;
    }
    async function request(path, init) {
      if (!root.fetch) throw new Error('Folder backups need a current browser. Use Back up projects to save a copy.');
      const controller = typeof root.AbortController === 'function' ? new root.AbortController() : null;
      const timer = controller ? root.setTimeout(() => controller.abort(), 20000) : null;
      try {
        const response = await root.fetch('/__backup/' + path, Object.assign({cache: 'no-store', credentials: 'same-origin', signal: controller ? controller.signal : undefined}, init));
        if (!response.ok) {
          let info = {};
          try { info = await response.json(); } catch (_) { /* Use the generic message below. */ }
          const failure = new Error(info.error || 'The folder backup could not be completed. Your browser copy is still available.');
          if (response.status === 409) {
            failure.conflict = true;
            notify({conflict: true, error: failure.message});
            if (typeof options.onConflict === 'function') options.onConflict(copy());
          }
          throw failure;
        }
        return response;
      } finally {
        if (timer !== null) root.clearTimeout(timer);
      }
    }
    async function connect() {
      if (connecting) return connecting;
      connecting = (async function () {
        const local = root.location;
        if (!local || local.protocol !== 'http:' || local.hostname !== '127.0.0.1') {
          connected = false;
          return notify({available: false, error: 'Launch Writing Studio with its Mac or Windows launcher for automatic folder backups. Back up projects still works here.'});
        }
        try {
          const response = await request('config');
          const config = await response.json();
          if (!['Writing Desk','Writing Studio'].includes(config.app) || config.backupProtocol !== 1 || typeof config.token !== 'string' || typeof config.revision !== 'string') {
            throw new Error('Restart Writing Studio with the updated launcher to enable folder backups.');
          }
          token = config.token;
          connected = true;
          lastSent = null;
          return notify({available: !!config.available, folder: config.folder || '', lastBackup: config.lastBackup || null,
            revision: config.revision, error: config.error || null, conflict: false});
        } catch (failure) {
          connected = false;
          return notify({available: false, error: failure.message || 'Folder backups are unavailable. Keep the launcher window open and use Back up projects.'});
        }
      })();
      try { return await connecting; } finally { connecting = null; }
    }
    async function ready(allowConflict) {
      if (connecting) await connecting;
      if (!connected || !state.available) throw error(state.error || 'Launch Writing Studio to enable folder backups.');
      if (state.conflict && !allowConflict) throw error('A newer folder backup exists. Reload Writing Studio or import that backup before saving again. Your browser copy is still available.');
    }
    async function save(serialized, force) {
      await ready();
      if (typeof serialized !== 'string') throw error('The backup must contain Writing Studio JSON text.');
      if (serialized === lastSent && !force) return copy();
      try {
        const response = await request('save', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Writing-Token': token, 'X-Writing-Revision': state.revision},
          body: JSON.stringify({data: serialized, force: !!force})});
        const result = await response.json();
        if (typeof result.revision !== 'string') throw new Error('The folder backup response was incomplete.');
        lastSent = serialized;
        return notify({revision: result.revision, lastBackup: result.lastBackup || state.lastBackup, error: null});
      } catch (failure) {
        if (!failure.conflict) notify({error: failure.message || 'The folder backup could not be saved. Your browser copy is still available.'});
        throw failure;
      }
    }
    function enqueue(job, silent) {
      const operation = chain.then(job);
      chain = operation.catch(() => undefined);
      return silent ? operation.catch(() => copy()) : operation;
    }
    return {
      state,
      connect,
      queue(serialized) { return enqueue(() => save(serialized, false), true); },
      backupNow(serialized) { return enqueue(() => save(serialized, true), false); },
      async list() {
        await ready(true);
        try {
          const response = await request('list', {headers: {'X-Writing-Token': token}});
          const value = await response.json();
          if (!Array.isArray(value.snapshots)) throw new Error('The backup list was incomplete.');
          return value.snapshots;
        } catch (failure) { throw error(failure.message); }
      },
      async read(name) {
        // Reading remains available after a conflict so the user can recover the newer copy.
        if (connecting) await connecting;
        if (!connected || !state.available) throw error(state.error || 'Launch Writing Studio to read folder backups.');
        try {
          const response = await request('read?name=' + encodeURIComponent(name), {headers: {'X-Writing-Token': token}});
          return await response.text();
        } catch (failure) { throw error(failure.message); }
      }
    };
  }
  return {createClient};
});
