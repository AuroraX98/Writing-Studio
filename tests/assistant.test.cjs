const test = require('node:test');
const assert = require('node:assert/strict');
const Assistant = require('../app/assistant.js');

const request = overrides => ({ model: 'deepseek-flash', goal: 'rewrite', brief: 'Make this clearer without changing its meaning.', text: 'A small fictional sample.', profile: { tone: 'warm', style: 'Lyrical', audience: 'Adult readers', pov: 'first', englishVariant: 'british', instructions: 'Keep the uncertainty.' }, projectType: 'memoir', genre: 'Thematic memoir', ...overrides });

test('profile and request explicitly include only the author-approved context and excerpt', () => {
  const payload = Assistant.buildRequest(request({ title: 'Excluded book title', chapters: [{ text: 'Excluded chapter' }], key: 'EXCLUDED_SECRET' }));
  assert.deepEqual(Object.keys(payload).sort(), ['brief', 'genre', 'goal', 'model', 'profile', 'projectType', 'text']);
  const messages = Assistant.messagesFor(payload);
  assert.match(messages[1].content, /Lyrical/);
  assert.match(messages[1].content, /Thematic memoir/);
  assert.match(messages[1].content, /A small fictional sample/);
  assert.doesNotMatch(JSON.stringify(messages), /Excluded|EXCLUDED_SECRET/);
  assert.equal(Assistant.buildRequest(request({ text: '' })).text, '');
  for (const projectType of ['fiction', 'nonfiction', 'memoir', 'poetry', 'screenplay', 'essays', 'academic']) assert.equal(Assistant.buildRequest(request({ projectType })).projectType, projectType);
});

test('prompt limits, model selection, profile enums and unknown profile secrets reject', () => {
  assert.throws(() => Assistant.buildRequest(request({ model: 'deepseek-chat' })), /supported model/);
  assert.throws(() => Assistant.buildRequest(request({ brief: ' ' })), /Enter an instruction/);
  assert.throws(() => Assistant.buildRequest(request({ text: 'a'.repeat(10001) })), /excerpt/);
  assert.throws(() => Assistant.buildRequest(request({ text: 'a'.repeat(10000), brief: 'b'.repeat(2000) })), /12,000/);
  assert.throws(() => Assistant.normalizeProfile({ tone: 'unsupported' }), /supported/);
  assert.throws(() => Assistant.normalizeProfile({ key: 'NOT_ALLOWED' }), /invalid/);
  assert.deepEqual(Assistant.normalizeProfile(), Assistant.DEFAULT_PROFILE);
  assert.equal(Assistant.buildRequest(request({ text: '🙂'.repeat(3000) })).text.length, 6000);
});

test('suggestion targets reject changes in profile, genre, type, draft or formatting', () => {
  const context = { projectType: 'memoir', genreId: 'thematic', genre: 'Thematic', profile: request().profile };
  const target = { projectId: 'p', chapterId: 'c', text: 'Original words.', formatFingerprint: 'format-1', contextFingerprint: Assistant.contextFingerprint(context) };
  assert.equal(Assistant.isCurrentTarget(target, { ...target }), true);
  for (const changed of [{ ...context, profile: { ...context.profile, tone: 'formal' } }, { ...context, profile: { ...context.profile, instructions: 'Keep a different voice.' } }, { ...context, genreId: 'braided' }, { ...context, genre: 'Braided memoir' }, { ...context, projectType: 'fiction' }]) {
    assert.equal(Assistant.isCurrentTarget(target, { ...target, contextFingerprint: Assistant.contextFingerprint(changed) }), false);
  }
  for (const changed of [{ projectId: 'another' }, { chapterId: 'another' }, { text: 'Edited words.' }, { formatFingerprint: 'format-2' }]) assert.equal(Assistant.isCurrentTarget(target, { ...target, ...changed }), false);
  const reordered = { instructions: context.profile.instructions, englishVariant: context.profile.englishVariant, pov: context.profile.pov, audience: context.profile.audience, style: context.profile.style, tone: context.profile.tone };
  assert.equal(Assistant.contextFingerprint({ ...context, profile: reordered }), target.contextFingerprint);
  assert.equal(Assistant.isCurrentTarget({ ...target, contextFingerprint: undefined }, { ...target, contextFingerprint: 'different' }), true, 'source selections only need draft identity, not generation preferences');
});

function fakeClient(overrides = {}) {
  const calls = [], statuses = [];
  let attached = false;
  const fetch = async (url, init) => {
    calls.push({ url, init });
    let body;
    if (url === '/__backup/config') body = { app: 'Writing Studio', backupProtocol: 1, token: 'LOCAL_SESSION_ONLY' };
    else if (url === '/__ai/status') body = { assistantProtocol: 1, connected: attached, busy: false };
    else if (url === '/__ai/connect') { attached = true; body = { connected: true, busy: false }; }
    else if (url === '/__ai/disconnect') { attached = false; body = { connected: false, busy: false }; }
    else if (url === '/__ai/generate') body = { text: '<script>raw text stays text</script>', model: 'deepseek-flash', truncated: false };
    else throw new Error('Unexpected route');
    return { ok: true, json: async () => body };
  };
  return { calls, statuses, client: Assistant.createClient({ location: { protocol: 'http:', hostname: '127.0.0.1' }, fetch, onStatus: status => statuses.push(status), ...overrides }) };
}

test('initialization and key attachment call only local endpoints and keep key out of state/generation', async () => {
  const { client, calls } = fakeClient();
  await client.initialize();
  assert.deepEqual(calls.map(call => call.url), ['/__backup/config', '/__ai/status']);
  await client.connect('sk-FICTIONAL-TEST-KEY-ONLY');
  assert.equal(calls.length, 3);
  assert.doesNotMatch(JSON.stringify(client.state), /FICTIONAL|LOCAL_SESSION/);
  assert.equal(calls[1].init.headers['X-Writing-Token'], 'LOCAL_SESSION_ONLY');
  const suggestion = await client.generate(request());
  assert.equal(suggestion.text, '<script>raw text stays text</script>');
  const generate = calls[3];
  assert.equal(generate.url, '/__ai/generate');
  assert.doesNotMatch(generate.init.body, /FICTIONAL-TEST-KEY/);
  assert.equal(client.state.busy, false);
  await client.disconnect();
  assert.equal(calls[4].init.body, '{}');
  await assert.rejects(client.generate(request()), /Connect your/);
});

test('standalone and non-loopback locations never fetch or attach keys', async () => {
  for (const location of [{ protocol: 'file:', hostname: '' }, { protocol: 'https:', hostname: 'example.org' }]) {
    const { client, calls } = fakeClient({ location });
    await client.initialize();
    assert.equal(client.state.available, false);
    assert.equal(calls.length, 0);
    await assert.rejects(client.connect('sk-FICTIONAL-TEST-KEY-ONLY'), /local launcher/);
    assert.equal(calls.length, 0);
  }
});

test('generation errors release the busy state and never insert anything', async () => {
  const calls = [];
  const fixture = fakeClient({ fetch: async (url, init) => {
    calls.push(url);
    const body = url === '/__backup/config' ? { app: 'Writing Studio', backupProtocol: 1, token: 't' } : url === '/__ai/status' ? { assistantProtocol: 1, connected: true } : { error: 'Provider unavailable.' };
    return { ok: url !== '/__ai/generate', json: async () => body };
  } });
  await fixture.client.initialize();
  await assert.rejects(fixture.client.generate(request()), /Provider unavailable/);
  assert.equal(fixture.client.state.busy, false);
  assert.equal(calls.filter(url => url === '/__ai/generate').length, 1);
});

test('request timeout is surfaced and timers are cleaned up', async () => {
  let cleanup = 0;
  const { client } = fakeClient({ setTimeout: callback => { callback(); return 1; }, clearTimeout: () => cleanup++, fetch: async (_url, init) => {
    if (init.signal && init.signal.aborted) { const failure = new Error('aborted'); failure.name = 'AbortError'; throw failure; }
    throw new Error('Expected aborted signal');
  } });
  await client.initialize();
  assert.equal(client.state.available, false);
  assert.equal(cleanup, 1);
});

function savedKeyFixture() {
  const calls = [];
  let connected = true, providerBusy = false, failFile = false, filePending = null, providerPending = null;
  const file = { path: '/fictional/private/deepseek-key.json', exists: false, readEnabled: false, error: null };
  const status = () => ({ assistantProtocol: 1, connected, busy: providerBusy, keyFile: { ...file } });
  const reply = body => ({ ok: true, json: async () => body });
  const fetch = async (url, init) => {
    calls.push({ url, init });
    if (url === '/__backup/config') return reply({ app: 'Writing Studio', backupProtocol: 1, token: 'local-test-token' });
    if (url === '/__ai/status') return reply(status());
    if (url === '/__ai/disconnect') { connected = false; file.readEnabled = false; return reply(status()); }
    if (url === '/__ai/generate') { providerBusy = true; return new Promise(resolve => { providerPending = () => { providerBusy = false; resolve(reply({ model: 'deepseek-flash', text: 'Delayed fictional suggestion.' })); }; }); }
    if (url.startsWith('/__ai/key-file/')) {
      if (failFile) { connected = false; file.error = 'The file could not be saved.'; return { ok: false, json: async () => ({ ...status(), error: file.error }) }; }
      const action = url.split('/').pop();
      if (action === 'clear') { connected = false; file.readEnabled = false; file.exists = true; }
      else if (action === 'create') file.exists = true;
      else if (action === 'settings') { file.readEnabled = JSON.parse(init.body).readEnabled; connected = file.readEnabled; }
      if (filePending) return new Promise(resolve => { const notify = filePending; filePending = () => resolve(reply(status())); notify(); });
      return reply(status());
    }
    throw new Error('Unexpected local route');
  };
  const client = Assistant.createClient({ fetch, location: { protocol: 'http:', hostname: '127.0.0.1' } });
  return { client, calls, file, failFile: () => { failFile = true; }, pauseFile: () => { filePending = () => {}; }, finishFile: () => filePending(), finishProvider: () => providerPending() };
}

test('saved-key client sends exact local protocol bodies and never includes secret content', async () => {
  const { client, calls } = savedKeyFixture();
  await client.initialize();
  for (const [action, value] of [['create'], ['settings', true], ['reload'], ['clear']]) await client.keyFileAction(action, value);
  const actions = calls.filter(call => call.url.startsWith('/__ai/key-file/'));
  assert.deepEqual(actions.map(call => [call.url, JSON.parse(call.init.body)]), [['/__ai/key-file/create', {}], ['/__ai/key-file/settings', { readEnabled: true }], ['/__ai/key-file/reload', {}], ['/__ai/key-file/clear', {}]]);
  assert.ok(actions.every(call => call.init.headers['X-Writing-Token'] === 'local-test-token'));
  assert.equal(client.state.keyFile.readEnabled, false);
  assert.equal(client.state.connected, false);
  assert.equal(client.state.settingsBusy, false);
  assert.doesNotMatch(JSON.stringify(actions), /apiKey|https:\/\/api\.deepseek/);
  await assert.rejects(client.keyFileAction('settings', 'false'), /whether to allow/);
  await assert.rejects(client.keyFileAction('unsupported'), /supported key file action/);
});

test('failed saved-key operations refresh local metadata and do not falsely claim success', async () => {
  const fixture = savedKeyFixture();
  await fixture.client.initialize();
  fixture.failFile();
  await assert.rejects(fixture.client.keyFileAction('clear'), /could not be saved/);
  assert.equal(fixture.client.state.connected, false);
  assert.equal(fixture.client.state.keyFile.error, 'The file could not be saved.');
  assert.equal(fixture.client.state.settingsBusy, false);
  assert.deepEqual(fixture.calls.slice(-2).map(call => call.url), ['/__backup/config', '/__ai/status']);
  assert.equal(fixture.calls.filter(call => call.url === '/__ai/generate').length, 0);
});

test('a pending file operation blocks overlapping file actions and generation', async () => {
  const fixture = savedKeyFixture();
  await fixture.client.initialize();
  fixture.pauseFile();
  const pending = fixture.client.keyFileAction('create');
  assert.equal(fixture.client.state.settingsBusy, true);
  await assert.rejects(fixture.client.keyFileAction('reload'), /Wait for/);
  await assert.rejects(fixture.client.generate(request()), /Wait for/);
  fixture.finishFile();
  await pending;
  assert.equal(fixture.client.state.settingsBusy, false);
  assert.equal(fixture.calls.filter(call => call.url.startsWith('/__ai/key-file/')).length, 1);
});

test('disconnect or clearing a saved key discards a late successful provider response', async () => {
  for (const action of ['disconnect', 'clear']) {
    const fixture = savedKeyFixture();
    await fixture.client.initialize();
    const pending = fixture.client.generate(request());
    const rejected = assert.rejects(pending, /unfinished response was discarded/);
    assert.equal(fixture.client.state.busy, true);
    if (action === 'disconnect') await fixture.client.disconnect();
    else await fixture.client.keyFileAction('clear');
    fixture.finishProvider();
    await rejected;
    assert.equal(fixture.client.state.connected, false);
    assert.equal(fixture.client.state.busy, false);
    assert.equal(fixture.calls.filter(call => call.url === '/__ai/generate').length, 1);
  }
});
