const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../app/local-backup.js'), 'utf8');

function clientEnvironment(fetch, location = {protocol: 'http:', hostname: '127.0.0.1'}) {
  const context = {module: {exports: {}}, fetch, location, setTimeout, clearTimeout, AbortController};
  vm.runInNewContext(source, context);
  return context.module.exports;
}
const response = (value, status = 200) => ({ok: status >= 200 && status < 300, status, json: async () => value,
  text: async () => typeof value === 'string' ? value : JSON.stringify(value)});
const config = () => response({available: true, folder: '/temporary/backups', lastBackup: null, revision: 'empty', token: 'test-token', app: 'Writing Desk', backupProtocol: 1});

(async () => {
  let calls = 0;
  const standalone = clientEnvironment(async () => { calls += 1; }, {protocol: 'file:', hostname: ''}).createClient();
  assert.equal((await standalone.connect()).available, false);
  assert.equal(calls, 0, 'A portable file must never attempt local or external networking');
  assert.match(standalone.state.error, /launcher/);

  const sent = [];
  let releaseConnect;
  const connecting = new Promise(resolve => { releaseConnect = resolve; });
  let revision = 'empty';
  const statuses = [];
  const client = clientEnvironment(async (url, init) => {
    if (url.endsWith('/config')) { await connecting; return config(); }
    assert.equal(init.headers['X-Writing-Revision'], revision, 'Each serialized write must use the previous response revision');
    assert.equal(init.headers['X-Writing-Token'], 'test-token');
    const body = JSON.parse(init.body);
    sent.push(body);
    revision = 'revision-' + sent.length;
    return response({revision, lastBackup: '2026-10-03T00:00:00Z'});
  }).createClient({onStatus: value => statuses.push(value)});
  const connection = client.connect();
  const first = client.queue('one');
  const second = client.queue('two');
  releaseConnect();
  await connection;
  await Promise.all([first, second]);
  assert.deepEqual(sent.map(item => item.data), ['one', 'two']);
  await client.queue('two');
  assert.equal(sent.length, 2, 'Unchanged automatic writes should be skipped');
  await client.backupNow('two');
  assert.equal(sent.length, 3, 'A forced backup should create a recovery snapshot even when text is unchanged');
  assert.equal(sent[2].force, true);
  assert.equal(statuses[0].revision, 'empty', 'Status callbacks must receive snapshots instead of the mutable state');

  let conflicts = 0, attempted = 0;
  const conflict = clientEnvironment(async (url) => {
    if (url.endsWith('/config')) return config();
    if (url.endsWith('/list')) return response({snapshots: [{name: 'latest.json', date: '2026-10-03T00:00:00Z', kind: 'latest'}]});
    if (url.includes('/read?')) return response('{"version":1}');
    attempted += 1;
    return response({error: 'Another window saved a newer backup.', conflict: true}, 409);
  }).createClient({onConflict: state => { conflicts += 1; assert.equal(state.conflict, true); }});
  await conflict.connect();
  assert.equal((await conflict.queue('draft')).conflict, true);
  await conflict.queue('new draft');
  await assert.rejects(conflict.backupNow('force'), /newer folder backup/);
  assert.equal(attempted, 1, 'A conflict must stop later writes without silently refreshing the revision');
  assert.equal(conflicts, 1);
  assert.equal((await conflict.list())[0].name, 'latest.json', 'Recovery listing remains accessible after a conflict');
  assert.equal(await conflict.read('latest.json'), '{"version":1}');

  let failure = true;
  const resilient = clientEnvironment(async url => {
    if (url.endsWith('/config')) return config();
    if (failure) { failure = false; throw new Error('Disk connection unavailable'); }
    return response({revision: 'saved', lastBackup: '2026-10-03T00:00:00Z'});
  }).createClient();
  await resilient.connect();
  assert.match((await resilient.queue('a')).error, /unavailable/);
  assert.equal((await resilient.queue('b')).error, null, 'A failed write must not permanently break the serialized queue');
  console.log('Local backup client checks passed: file mode, pending connection, request ordering, unchanged/forced saves, conflict recovery and retryable failures.');
})().catch(error => { console.error(error); process.exitCode = 1; });
