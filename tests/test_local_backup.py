"""Local backup integrity and server boundary checks; no user files are used."""
import http.client
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('writing_launch', Path(__file__).resolve().parents[1] / 'launch.py')
launch = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(launch)


def sample(text='A private draft — café.'):
    return json.dumps({'version': 1, 'projects': [{'id': 'p', 'title': 'Example', 'chapters': [{'id': 'c', 'title': 'Chapter', 'text': text}],
        'history': [{'text': 'Earlier version'}], 'trash': [{'kind': 'note', 'item': 'Private note'}]}], 'preferences': {'theme': 'glass'}}, ensure_ascii=False)


class BackupStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.now = 1700000000
        self.store = launch.BackupStore(self.temp.name, clock=lambda: self.now)
    def tearDown(self):
        self.temp.cleanup()
    def save(self, text, force=False):
        return self.store.save(sample(text), self.store.status()['revision'], force)
    def test_round_trip_previous_and_unicode(self):
        self.save('First — café.')
        self.save('Second — Γειά.')
        self.assertEqual(self.store.read('latest.json').decode(), sample('Second — Γειά.'))
        self.assertEqual(self.store.read('previous.json').decode(), sample('First — café.'))
        self.assertEqual(len([x for x in self.store.list() if x['kind'] == 'snapshot']), 1)
    def test_snapshot_interval_forced_and_retention(self):
        self.save('1')
        self.now += 299
        self.save('2')
        self.assertEqual(len(self.store._snapshots()), 1)
        self.now += 1
        self.save('3')
        self.assertEqual(len(self.store._snapshots()), 2)
        for index in range(55):
            self.now += 1
            self.save(str(index), True)
        self.assertEqual(len(self.store._snapshots()), 50)
        self.assertEqual(json.loads(self.store.read(self.store._snapshots()[-1].name))['projects'][0]['chapters'][0]['text'], '54')
    def test_unchanged_save_is_skipped_and_force_keeps_previous(self):
        self.save('1')
        self.save('2')
        previous = self.store.read('previous.json')
        self.assertTrue(self.save('2')['unchanged'])
        self.now += 1
        self.assertFalse(self.save('2', True)['unchanged'])
        self.assertEqual(self.store.read('previous.json'), previous)
    def test_stale_writer_does_not_replace_newer_copy(self):
        revision = self.store.status()['revision']
        self.save('newer')
        with self.assertRaises(launch.BackupConflict):
            self.store.save(sample('stale'), revision)
        self.assertEqual(self.store.read('latest.json').decode(), sample('newer'))
    def test_atomic_write_failure_leaves_latest_intact(self):
        self.save('safe')
        actual_replace = launch.os.replace
        def fail_latest(source, target):
            if Path(target).name == 'latest.json':
                raise OSError('Disk is full')
            return actual_replace(source, target)
        with patch.object(launch.os, 'replace', side_effect=fail_latest):
            with self.assertRaises(OSError):
                self.save('new')
        self.assertEqual(self.store.read('latest.json').decode(), sample('safe'))
        self.assertFalse(list(Path(self.temp.name).glob('*.tmp')))
    def test_invalid_data_does_not_modify_files(self):
        self.save('safe')
        before = self.store.read('latest.json')
        for value in ('not JSON', '{"version":2,"projects":[]}', '{"version":true,"projects":[]}',
                      '{"version":1,"projects":[{"id":"p","title":"x","chapters":[{}]}]}',
                      '{"version":1,"projects":[],"value":NaN}'):
            with self.assertRaises(ValueError):
                self.store.save(value, self.store.status()['revision'])
        self.assertEqual(self.store.read('latest.json'), before)
    def test_arbitrary_paths_and_symlinks_are_rejected(self):
        self.save('safe')
        for name in ('../latest.json', '/etc/passwd', 'other.json', 'latest.json/../latest.json'):
            with self.assertRaises(ValueError):
                self.store.read(name)
        outside = Path(self.temp.name) / 'outside.json'
        outside.write_text(sample('outside'))
        linked = Path(self.temp.name) / 'previous.json'
        linked.symlink_to(outside)
        with self.assertRaises(ValueError):
            self.store.read('previous.json')
    def test_restarted_store_keeps_revision_and_recent_snapshot(self):
        self.save('saved before closing')
        revision = self.store.status()['revision']
        restarted = launch.BackupStore(self.temp.name)
        self.assertEqual(restarted.status()['revision'], revision)
        self.assertIsNotNone(restarted.status()['lastBackup'])
        restarted.save(sample('saved after reopening'), revision)
        self.assertEqual(len(restarted._snapshots()), 1)
    def test_per_user_windows_mac_and_linux_folder_locations(self):
        fake_home = Path(self.temp.name) / 'home'
        with patch.object(launch.Path, 'home', return_value=fake_home):
            with patch.object(launch.sys, 'platform', 'win32'), patch.dict(launch.os.environ, {'LOCALAPPDATA': str(fake_home / 'local')}):
                self.assertEqual(launch.default_backup_dir(), fake_home / 'local/Writing Studio/Backups')
            with patch.object(launch.sys, 'platform', 'darwin'):
                self.assertEqual(launch.default_backup_dir(), fake_home / 'Library/Application Support/Writing Studio/Backups')
            with patch.object(launch.sys, 'platform', 'linux'):
                self.assertEqual(launch.default_backup_dir(), fake_home / '.local/share/writing-studio/backups')
    def test_renamed_app_reuses_legacy_backup_folder_without_moving_it(self):
        fake_home = Path(self.temp.name) / 'home'
        examples = [('win32', fake_home / 'local/Writing Desk/Backups', fake_home / 'local/Writing Studio/Backups'),
                    ('darwin', fake_home / 'Library/Application Support/Writing Desk/Backups', fake_home / 'Library/Application Support/Writing Studio/Backups'),
                    ('linux', fake_home / '.local/share/writing-desk/backups', fake_home / '.local/share/writing-studio/backups')]
        for platform, legacy, canonical in examples:
            legacy.mkdir(parents=True)
            original = legacy / 'latest.json'
            original.write_text(sample('Legacy recovery copy'))
            with patch.object(launch.Path, 'home', return_value=fake_home), patch.object(launch.sys, 'platform', platform), patch.dict(launch.os.environ, {'LOCALAPPDATA': str(fake_home / 'local')}):
                self.assertEqual(launch.default_backup_dir(), legacy)
                self.assertEqual(original.read_text(), sample('Legacy recovery copy'))
                self.assertFalse(canonical.exists())
                canonical.mkdir(parents=True)
                self.assertEqual(launch.default_backup_dir(), canonical)
                self.assertTrue(original.exists())
    def test_unwritable_folder_is_reported_without_preventing_app_launch(self):
        with patch.object(launch.Path, 'mkdir', side_effect=PermissionError('denied')):
            unavailable = launch.BackupStore(Path(self.temp.name) / 'blocked')
        self.assertFalse(unavailable.status()['available'])
        self.assertIn('permissions', unavailable.status()['error'])
    def test_previous_valid_backup_survives_invalid_latest(self):
        self.save('first')
        self.save('second')
        (Path(self.temp.name) / 'latest.json').write_text('corrupt')
        self.save('third')
        self.assertEqual(self.store.read('previous.json').decode(), sample('first'))


class BackupHTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.server = launch.WritingServer(('127.0.0.1', 0), cls.temp.name, key_file=Path(cls.temp.name) / 'keys' / 'deepseek-key.json')
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.temp.cleanup()
    def request(self, method, path, payload=None, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=3)
        connection.request(method, path, body=payload, headers=headers or {})
        response = connection.getresponse()
        body = response.read()
        result = (response.status, dict(response.getheaders()), body)
        connection.close()
        return result
    def auth(self):
        return {'Origin': self.server.origin, 'X-Writing-Token': self.server.token, 'Content-Type': 'application/json',
                'X-Writing-Revision': self.server.backups.status()['revision']}
    def post(self, value, headers=None):
        return self.request('POST', '/__backup/save', json.dumps(value), self.auth() if headers is None else headers)
    def test_config_and_end_to_end_download(self):
        status, headers, body = self.request('GET', '/__backup/config')
        config = json.loads(body)
        self.assertEqual(status, 200)
        self.assertEqual(config['app'], 'Writing Studio')
        self.assertEqual(headers['Cache-Control'], 'no-store')
        self.assertNotIn('Access-Control-Allow-Origin', headers)
        self.assertEqual(self.post({'data': sample(), 'force': True})[0], 200)
        status, _, body = self.request('GET', '/__backup/list', headers={'X-Writing-Token': config['token']})
        self.assertEqual(status, 200)
        self.assertIn('latest.json', [item['name'] for item in json.loads(body)['snapshots']])
        status, headers, body = self.request('GET', '/__backup/read?name=latest.json', headers={'X-Writing-Token': config['token']})
        self.assertEqual(status, 200)
        self.assertEqual(body.decode(), sample())
        self.assertIn('attachment', headers['Content-Disposition'])
    def test_foreign_host_origin_and_fetch_site_rejected(self):
        for headers in ({'Host': 'evil.example'}, {'Origin': 'https://evil.example'}, {'Sec-Fetch-Site': 'cross-site'}):
            self.assertEqual(self.request('GET', '/__backup/config', headers=headers)[0], 403)
        headers = self.auth()
        headers.pop('Origin')
        self.assertEqual(self.post({'data': sample()}, headers)[0], 403)
        headers['Origin'] = 'null'
        self.assertEqual(self.post({'data': sample()}, headers)[0], 403)
    def test_missing_csrf_and_invalid_inputs_rejected(self):
        headers = self.auth()
        headers['X-Writing-Token'] = 'wrong'
        self.assertEqual(self.post({'data': sample()}, headers)[0], 403)
        self.assertEqual(self.request('GET', '/__backup/list')[0], 403)
        self.assertEqual(self.post({'data': sample(), 'force': 'yes'})[0], 400)
        self.assertEqual(self.post({'data': '{"version":1,"projects":[]}'})[0], 400)
        headers = self.auth()
        headers['Content-Length'] = str(launch.MAX_BODY_BYTES + 1)
        self.assertEqual(self.request('POST', '/__backup/save', '{}', headers)[0], 413)
    def test_conditional_revision_conflict_and_traversal(self):
        headers = self.auth()
        self.assertEqual(self.post({'data': sample('one')}, headers)[0], 200)
        self.assertEqual(self.post({'data': sample('two')}, headers)[0], 409)
        self.assertEqual(self.request('GET', '/__backup/read?name=..%2Flatest.json', headers={'X-Writing-Token': self.server.token})[0], 400)
        self.assertEqual(self.request('GET', '/__backup/read?name=missing.json', headers={'X-Writing-Token': self.server.token})[0], 400)


if __name__ == '__main__':
    unittest.main()
