"""Private key-file lifecycle checks with temporary fictional credentials only."""
import http.client
import io
import json
import os
from pathlib import Path
import stat
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
from contextlib import redirect_stdout

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from ai_proxy import AssistantError
from key_file import SecretKeyFile, KeyFileError
import launch

KEY = 'sk-FICTIONAL-FILE-KEY-ONLY'
MANUAL_KEY = 'sk-FICTIONAL-MANUAL-KEY-ONLY'


def request():
    return {'model': 'deepseek-flash', 'goal': 'brainstorm', 'brief': 'Suggest one opening.', 'text': '', 'profile': {}, 'projectType': 'fiction', 'genre': 'Literary'}


class KeyFileTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'private' / 'deepseek-key.json'
        self.store = SecretKeyFile(self.path)
    def tearDown(self):
        self.temp.cleanup()
    def populated(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps({'apiKey': KEY}))
    def test_default_opt_out_does_not_read_existing_key_or_return_its_content(self):
        self.populated()
        original = SecretKeyFile._read_json
        reads = []
        def tracked(store, path, **options):
            reads.append(path.name)
            return original(store, path, **options)
        with patch.object(SecretKeyFile, '_read_json', tracked):
            store = SecretKeyFile(self.path)
            self.assertEqual(reads, ['deepseek-key-settings.json'])
            self.assertTrue(store.status()['exists'])
            with self.assertRaisesRegex(KeyFileError, 'Enable'):
                store.load_key()
            self.assertEqual(reads, ['deepseek-key-settings.json'])
        self.assertFalse(store.read_enabled)
        self.assertNotIn(KEY, json.dumps(store.status()))
    def test_create_template_is_private_atomic_and_idempotent_for_valid_empty_file(self):
        self.assertTrue(self.store.create_empty())
        self.assertEqual(json.loads(self.path.read_text()), {'apiKey': ''})
        self.assertFalse(self.store.create_empty())
        self.assertFalse(self.store.settings_path.exists())
        if os.name != 'nt':
            self.assertEqual(stat.S_IMODE(self.path.stat().st_mode), 0o600)
        self.assertEqual([p.name for p in self.path.parent.iterdir()], ['deepseek-key.json'])
    def test_create_never_overwrites_populated_or_invalid_existing_file(self):
        self.path.parent.mkdir(parents=True)
        for raw in (json.dumps({'apiKey': KEY}), 'not JSON', 'null', '{"apiKey":"","extra":true}', '{"apiKey":42}'):
            self.path.write_text(raw)
            with self.assertRaises(KeyFileError):
                self.store.create_empty()
            self.assertEqual(self.path.read_text(), raw)
            self.assertNotIn(KEY, json.dumps(self.store.status()))
    def test_enable_reload_startup_disable_and_manual_empty_or_removal(self):
        self.populated()
        self.store.set_enabled(True)
        self.assertEqual(self.store.load_key(), KEY)
        self.assertEqual(json.loads(self.store.settings_path.read_text()), {'readEnabled': True})
        restarted = SecretKeyFile(self.path)
        self.assertTrue(restarted.read_enabled)
        self.assertEqual(restarted.load_key(), KEY)
        self.path.write_text('{"apiKey":""}')
        self.assertIsNone(restarted.load_key())
        self.path.unlink()
        with self.assertRaisesRegex(KeyFileError, 'not found'):
            restarted.load_key()
        restarted.set_enabled(False)
        self.assertFalse(SecretKeyFile(self.path).read_enabled)
    def test_clear_preserves_template_disables_reading_and_makes_no_secret_copies(self):
        self.populated()
        self.store.set_enabled(True)
        self.store.clear_saved_key()
        self.assertEqual(json.loads(self.path.read_text()), {'apiKey': ''})
        self.assertFalse(self.store.read_enabled)
        self.assertFalse(SecretKeyFile(self.path).read_enabled)
        self.assertEqual(sorted(p.name for p in self.path.parent.iterdir()), ['deepseek-key-settings.json', 'deepseek-key.json'])
        self.assertNotIn(KEY, ''.join(p.read_text() for p in self.path.parent.iterdir()))
        if os.name != 'nt':
            self.assertEqual(stat.S_IMODE(self.store.settings_path.stat().st_mode), 0o600)
    def test_invalid_duplicate_oversized_and_nonregular_files_are_rejected(self):
        self.path.parent.mkdir(parents=True)
        self.store.set_enabled(True)
        for raw in ('null', '{"apiKey":null}', '{"apiKey":"short"}', '{"apiKey":"","apiKey":"another"}', 'x' * 4097):
            self.path.write_text(raw)
            with self.assertRaises(KeyFileError):
                self.store.load_key()
        self.path.unlink()
        self.path.mkdir()
        with self.assertRaisesRegex(KeyFileError, 'regular files'):
            self.store.load_key()
        self.assertTrue(self.store.status()['error'])
    def test_malformed_settings_and_symlinks_fail_closed(self):
        self.populated()
        for raw in ('null', '{"readEnabled":"true"}', '{"readEnabled":true,"readEnabled":false}', 'x' * 4097):
            self.store.settings_path.write_text(raw)
            invalid = SecretKeyFile(self.path)
            self.assertFalse(invalid.read_enabled)
            self.assertTrue(invalid.status()['error'])
        if os.name != 'nt':
            self.store.settings_path.unlink()
            self.store.settings_path.symlink_to(self.path)
            self.assertFalse(SecretKeyFile(self.path).read_enabled)
            self.store.settings_path.unlink()
            outside = self.path.parent / 'outside.json'
            outside.write_text(json.dumps({'apiKey': KEY}))
            self.path.unlink()
            self.path.symlink_to(outside)
            self.store.set_enabled(True)
            with self.assertRaises(KeyFileError):
                self.store.load_key()
            with self.assertRaises(KeyFileError):
                self.store.clear_saved_key()
            self.assertEqual(json.loads(outside.read_text()), {'apiKey': KEY})
            self.assertFalse(self.store.read_enabled)
    def test_atomic_clear_failure_does_not_claim_or_destroy_saved_key(self):
        self.populated()
        self.store.set_enabled(True)
        replace = os.replace
        def fail_key(source, target):
            if Path(target) == self.path:
                raise OSError('simulated disk failure')
            return replace(source, target)
        with patch('key_file.os.replace', side_effect=fail_key):
            with self.assertRaises(KeyFileError):
                self.store.clear_saved_key()
        self.assertEqual(json.loads(self.path.read_text()), {'apiKey': KEY})
        self.assertFalse(self.store.read_enabled)
        self.assertFalse(json.loads(self.store.settings_path.read_text())['readEnabled'])
        self.assertFalse(list(self.path.parent.glob('*.tmp')))
        self.assertNotIn(KEY, json.dumps(self.store.status()))
    def test_failed_opt_out_disables_current_process_and_reports_persistence_failure(self):
        self.populated()
        self.store.set_enabled(True)
        with patch.object(self.store, '_atomic_write', side_effect=KeyFileError('permission failure')):
            with self.assertRaisesRegex(KeyFileError, 'previous setting may remain'):
                self.store.set_enabled(False)
        self.assertFalse(self.store.read_enabled)
        self.assertTrue(json.loads(self.store.settings_path.read_text())['readEnabled'])
    def test_reserved_settings_filename_cannot_become_a_key_file(self):
        reserved = SecretKeyFile(self.path.parent / 'deepseek-key-settings.json')
        with self.assertRaises(KeyFileError):
            reserved.create_empty()
        self.assertFalse(reserved.read_enabled)
    def test_existing_launcher_cannot_silently_ignore_explicit_different_key_file(self):
        backup = Path(self.temp.name) / 'backups'
        config = {'app': 'Writing Studio', 'backupProtocol': 1, 'folder': str(backup.resolve()), 'token': 'local-test-token'}
        for matching, expected in ((True, 0), (False, 1)):
            current = {'keyFile': {'path': str(self.path if matching else self.path.parent / 'another-key.json')}}
            replies = [io.BytesIO(json.dumps(config).encode()), io.BytesIO(json.dumps(current).encode())]
            with patch.object(launch, 'WritingServer', side_effect=OSError('Port is occupied')), patch.object(launch.urllib.request, 'urlopen', side_effect=replies) as opened, redirect_stdout(io.StringIO()):
                code = launch.main(['--no-browser', '--backup-dir', str(backup), '--key-file', str(self.path)])
            self.assertEqual(code, expected)
            self.assertEqual(opened.call_args_list[1][0][0].get_header('X-writing-token'), 'local-test-token')


class KeyServerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'private' / 'deepseek-key.json'
        self.backups = Path(self.temp.name) / 'backups'
        self.calls = []
        self.server = launch.WritingServer(('127.0.0.1', 0), self.backups, key_file=self.path)
        self.server.assistant._transport = self.provider
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
    def provider(self, key, payload):
        self.calls.append((key, payload))
        return {'choices': [{'message': {'content': 'A fictional test suggestion.'}, 'finish_reason': 'stop'}]}
    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(2)
        self.temp.cleanup()
    def call(self, route, value=None, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=3)
        outgoing = {'Host': self.server.host, 'Origin': self.server.origin, 'Sec-Fetch-Site': 'same-origin', 'X-Writing-Token': self.server.token}
        outgoing.update(headers or {})
        raw = json.dumps(value).encode() if value is not None else None
        if raw is not None:
            outgoing['Content-Type'] = 'application/json'
        connection.request('POST' if value is not None else 'GET', route, body=raw, headers=outgoing)
        reply = connection.getresponse()
        status, raw_reply = reply.status, reply.read()
        connection.close()
        self.assertNotIn(KEY.encode(), raw_reply)
        self.assertNotIn(MANUAL_KEY.encode(), raw_reply)
        return status, json.loads(raw_reply)
    def populate(self):
        self.assertEqual(self.call('/__ai/key-file/create', {})[0], 200)
        self.path.write_text(json.dumps({'apiKey': KEY}))
    def test_opt_in_startup_restore_and_shutdown_does_not_revoke_saved_permission(self):
        self.populate()
        self.assertFalse(self.call('/__ai/status')[1]['connected'])
        status, result = self.call('/__ai/key-file/settings', {'readEnabled': True})
        self.assertEqual(status, 200)
        self.assertTrue(result['connected'])
        self.assertTrue(result['keyFile']['readEnabled'])
        self.assertEqual(self.calls, [])
        self.server.assistant.disconnect()  # Memory-only shutdown behavior.
        second = launch.WritingServer(('127.0.0.1', 0), self.backups, key_file=self.path)
        try:
            self.assertTrue(second.assistant_status()['connected'])
            second.server_close()
            self.assertTrue(json.loads(self.server.key_file.settings_path.read_text())['readEnabled'])
        finally:
            second.server_close()
    def test_manual_connect_disables_file_reading_and_disconnect_keeps_saved_file(self):
        self.populate()
        self.call('/__ai/key-file/settings', {'readEnabled': True})
        status, result = self.call('/__ai/connect', {'key': MANUAL_KEY})
        self.assertEqual(status, 200)
        self.assertFalse(result['keyFile']['readEnabled'])
        self.assertEqual(self.call('/__ai/generate', request())[0], 200)
        self.assertEqual(self.calls[0][0], MANUAL_KEY)
        self.assertEqual(json.loads(self.path.read_text()), {'apiKey': KEY})
        self.call('/__ai/disconnect', {})
        self.assertFalse(self.call('/__ai/status')[1]['connected'])
        self.assertFalse(json.loads(self.server.key_file.settings_path.read_text())['readEnabled'])
        self.assertEqual(json.loads(self.path.read_text()), {'apiKey': KEY})
    def test_empty_or_deleted_file_is_detected_before_generate_without_provider_call(self):
        self.populate()
        self.call('/__ai/key-file/settings', {'readEnabled': True})
        self.path.write_text('{"apiKey":""}')
        status, result = self.call('/__ai/generate', request())
        self.assertEqual(status, 409)
        self.assertFalse(result['connected'])
        self.assertEqual(self.calls, [])
        self.path.write_text(json.dumps({'apiKey': KEY}))
        self.assertEqual(self.call('/__ai/key-file/reload', {})[0], 200)
        self.path.unlink()
        status, result = self.call('/__ai/generate', request())
        self.assertEqual(status, 400)
        self.assertFalse(result['connected'])
        self.assertFalse(result['keyFile']['exists'])
        self.assertEqual(self.calls, [])
    def test_create_existing_empty_file_refreshes_attached_saved_key(self):
        self.populate()
        self.call('/__ai/key-file/settings', {'readEnabled': True})
        self.path.write_text('{"apiKey":""}')
        status, result = self.call('/__ai/key-file/create', {})
        self.assertEqual(status, 200)
        self.assertFalse(result['created'])
        self.assertFalse(result['connected'])
        self.assertTrue(result['keyFile']['readEnabled'])
        self.assertEqual(self.call('/__ai/generate', request())[0], 409)
        self.assertEqual(self.calls, [])
    def test_clear_forgets_key_and_failed_clear_is_not_reported_successfully(self):
        self.populate()
        self.call('/__ai/key-file/settings', {'readEnabled': True})
        status, result = self.call('/__ai/key-file/clear', {})
        self.assertEqual(status, 200)
        self.assertFalse(result['connected'])
        self.assertFalse(result['keyFile']['readEnabled'])
        self.assertEqual(json.loads(self.path.read_text()), {'apiKey': ''})
        self.path.write_text(json.dumps({'apiKey': KEY}))
        self.call('/__ai/key-file/settings', {'readEnabled': True})
        with patch.object(self.server.key_file, '_atomic_write', side_effect=KeyFileError('The file could not be saved.')):
            status, result = self.call('/__ai/key-file/clear', {})
        self.assertEqual(status, 503)
        self.assertFalse(result['connected'])
        self.assertIn('error', result)
        self.assertEqual(json.loads(self.path.read_text()), {'apiKey': KEY})
    def test_key_file_actions_require_auth_and_valid_settings_payload(self):
        for route, value in [('/__ai/key-file/create', {}), ('/__ai/key-file/settings', {'readEnabled': True}), ('/__ai/key-file/reload', {}), ('/__ai/key-file/clear', {})]:
            self.assertEqual(self.call(route, value, {'X-Writing-Token': 'wrong'})[0], 403)
            self.assertEqual(self.call(route, value, {'Origin': 'https://example.invalid'})[0], 403)
        self.assertEqual(self.call('/__ai/key-file/settings', {'readEnabled': 'true'})[0], 400)
        self.assertEqual(self.call('/__ai/key-file/create', {'apiKey': KEY})[0], 400)
        self.assertEqual(self.call('/__ai/key-file/reload', {})[0], 409)
        self.assertFalse(self.path.exists())
    def test_create_populated_file_fails_and_static_alias_cannot_serve_private_key(self):
        self.populate()
        self.assertEqual(self.call('/__ai/key-file/create', {})[0], 503)
        self.assertEqual(json.loads(self.path.read_text()), {'apiKey': KEY})
        served = Path(self.temp.name) / 'served'
        served.mkdir()
        alias = served / 'key-alias.json'
        if os.name == 'nt':
            os.link(self.path, alias)
        else:
            alias.symlink_to(self.path)
        with patch.object(launch, 'APP', served):
            static = launch.WritingServer(('127.0.0.1', 0), self.backups, key_file=self.path)
        worker = threading.Thread(target=static.serve_forever, daemon=True)
        worker.start()
        try:
            connection = http.client.HTTPConnection('127.0.0.1', static.server_port, timeout=3)
            connection.request('GET', '/key-alias.json', headers={'Host': static.host})
            reply = connection.getresponse()
            self.assertEqual(reply.status, 404)
            self.assertNotIn(KEY.encode(), reply.read())
            connection.close()
        finally:
            static.shutdown()
            static.server_close()
            worker.join(2)
    def test_constructor_rejects_key_file_in_served_folder_before_file_operations(self):
        served = Path(self.temp.name) / 'served'
        served.mkdir()
        backup_path = Path(self.temp.name) / 'not-created-backups'
        with patch.object(launch, 'APP', served):
            with self.assertRaisesRegex(ValueError, 'outside the app folder'):
                launch.WritingServer(('127.0.0.1', 0), backup_path, key_file=served / 'deepseek-key.json')
        self.assertFalse(backup_path.exists())
        self.assertEqual(list(served.iterdir()), [])
        for name in ('latest.json', 'previous.json', 'snapshot-20261001T120000000000Z-abcd1234.json'):
            with self.assertRaisesRegex(ValueError, 'recovery backup'):
                launch.WritingServer(('127.0.0.1', 0), self.backups, key_file=self.backups / name)
    def test_clear_during_generation_discards_response_without_duplicate_provider_calls(self):
        self.populate()
        self.call('/__ai/key-file/settings', {'readEnabled': True})
        started, finished = threading.Event(), threading.Event()
        results = []
        def delayed(key, payload):
            self.calls.append((key, payload))
            started.set()
            finished.wait(3)
            return {'choices': [{'message': {'content': 'Delayed fake result.'}, 'finish_reason': 'stop'}]}
        self.server.assistant._transport = delayed
        thread = threading.Thread(target=lambda: results.append(self.call('/__ai/generate', request())))
        thread.start()
        self.assertTrue(started.wait(1))
        self.assertEqual(self.call('/__ai/key-file/clear', {})[0], 200)
        finished.set()
        thread.join(3)
        self.assertEqual(results[0][0], 409)
        self.assertFalse(results[0][1]['connected'])
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(json.loads(self.path.read_text()), {'apiKey': ''})


if __name__ == '__main__':
    unittest.main()
