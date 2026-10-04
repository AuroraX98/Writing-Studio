#!/usr/bin/env python3
"""Serve Writing Studio and save private backups on this computer only."""
import argparse
import hashlib
import json
import os
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
import secrets
import sys
import threading
import time
from urllib.parse import parse_qs, urlsplit
import urllib.request
import webbrowser
from ai_proxy import DeepSeekSession, AssistantError, key_from_value, MAX_BODY as MAX_AI_BODY
from key_file import SecretKeyFile, KeyFileError

APP = Path(__file__).resolve().parent / 'app'
MAX_DATA_BYTES = 20 * 1024 * 1024
MAX_BODY_BYTES = 48 * 1024 * 1024
SNAPSHOT_RE = re.compile(r'^snapshot-\d{8}T\d{12}Z-[a-f0-9]{8}\.json$')


def default_backup_dir():
    if sys.platform == 'win32':
        base = Path(os.environ.get('LOCALAPPDATA', str(Path.home() / 'AppData' / 'Local')))
        canonical, legacy = base / 'Writing Studio' / 'Backups', base / 'Writing Desk' / 'Backups'
    elif sys.platform == 'darwin':
        base = Path.home() / 'Library' / 'Application Support'
        canonical, legacy = base / 'Writing Studio' / 'Backups', base / 'Writing Desk' / 'Backups'
    else:
        base = Path.home() / '.local' / 'share'
        canonical, legacy = base / 'writing-studio' / 'backups', base / 'writing-desk' / 'backups'
    # Keep existing recovery files where they are after the app is renamed.
    return legacy if not canonical.exists() and legacy.is_dir() else canonical


def iso_date(timestamp):
    return datetime.fromtimestamp(timestamp, timezone.utc).isoformat().replace('+00:00', 'Z')


def parse_json(data):
    def reject_constant(_):
        raise ValueError('Non-finite numbers are not valid JSON.')
    return json.loads(data, parse_constant=reject_constant)


def validate_backup(data):
    if not isinstance(data, str) or len(data.encode('utf-8')) > MAX_DATA_BYTES:
        raise ValueError('The backup must be text smaller than 20 MB.')
    try:
        value = parse_json(data)
    except (ValueError, RecursionError) as error:
        raise ValueError('The backup is not valid JSON.') from error
    if not isinstance(value, dict) or type(value.get('version')) is not int or value['version'] != 1:
        raise ValueError('The backup must use Writing Studio version 1.')
    projects = value.get('projects')
    if not isinstance(projects, list) or not projects:
        raise ValueError('The backup must contain at least one project.')
    seen = set()
    for project in projects:
        if not isinstance(project, dict) or not all(isinstance(project.get(k), str) for k in ('id', 'title')):
            raise ValueError('Every project must have an ID and title.')
        if not project['id'] or project['id'] in seen:
            raise ValueError('Project IDs must be present and unique.')
        seen.add(project['id'])
        chapters = project.get('chapters')
        if not isinstance(chapters, list):
            raise ValueError('Every project must have chapters.')
        chapter_ids = set()
        for chapter in chapters:
            if not isinstance(chapter, dict) or not all(isinstance(chapter.get(k), str) for k in ('id', 'title', 'text')):
                raise ValueError('Every chapter must have an ID, title and text.')
            if not chapter['id'] or chapter['id'] in chapter_ids:
                raise ValueError('Chapter IDs must be present and unique within a project.')
            chapter_ids.add(chapter['id'])
    return data.encode('utf-8')


class BackupConflict(Exception):
    pass


class BackupStore:
    """Atomic latest/previous copies and bounded dated recovery snapshots."""
    def __init__(self, folder, clock=time.time):
        self.folder = Path(folder).expanduser().resolve()
        self.clock = clock
        self.lock = threading.Lock()
        self.error = None
        try:
            self.folder.mkdir(parents=True, exist_ok=True, mode=0o700)
        except OSError:
            self.error = 'The backup folder could not be opened. Check its permissions.'
        snapshots = self._snapshots() if not self.error else []
        self.last_snapshot = max((p.stat().st_mtime for p in snapshots), default=0)

    def _snapshots(self):
        return sorted((p for p in self.folder.glob('snapshot-*.json') if SNAPSHOT_RE.fullmatch(p.name) and not p.is_symlink()), key=lambda p: p.name)

    def _latest_bytes(self):
        latest = self.folder / 'latest.json'
        if latest.is_symlink():
            raise OSError('The latest backup cannot be a symbolic link.')
        try:
            return latest.read_bytes()
        except FileNotFoundError:
            return None

    def _revision(self):
        data = self._latest_bytes()
        return hashlib.sha256(data).hexdigest() if data is not None else 'empty'

    def status(self):
        with self.lock:
            latest = self.folder / 'latest.json'
            try:
                revision = self._revision() if not self.error else 'empty'
                date = iso_date(latest.stat().st_mtime) if latest.exists() and not self.error else None
                error = self.error
            except OSError:
                revision, date = 'empty', None
                error = 'The latest backup could not be read. Check the backup folder.'
            return {'available': not bool(error), 'folder': str(self.folder), 'lastBackup': date, 'revision': revision, 'error': error}

    def _atomic_write(self, name, data):
        temporary = self.folder / ('.writing-studio-' + secrets.token_hex(12) + '.tmp')
        try:
            with open(temporary, 'xb') as stream:
                os.chmod(temporary, 0o600)
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, self.folder / name)
            # Synchronize the directory entry on systems that support it.
            if os.name != 'nt':
                fd = os.open(self.folder, os.O_RDONLY)
                try:
                    os.fsync(fd)
                finally:
                    os.close(fd)
        finally:
            try:
                temporary.unlink()
            except FileNotFoundError:
                pass

    def save(self, raw, expected_revision, force=False):
        data = validate_backup(raw)
        with self.lock:
            if self.error:
                raise OSError(self.error)
            revision = self._revision()
            if expected_revision != revision:
                raise BackupConflict('Another window saved a newer folder backup. Reload the app before saving again; your browser copy is still available.')
            old = self._latest_bytes()
            now = self.clock()
            changed = data != old
            if not changed and not force:
                return {'revision': revision, 'lastBackup': iso_date((self.folder / 'latest.json').stat().st_mtime), 'unchanged': True}
            if changed and old is not None:
                # Keep the previous bytes only when they are a valid Writing Studio backup.
                try:
                    validate_backup(old.decode('utf-8'))
                except (ValueError, UnicodeError):
                    pass
                else:
                    self._atomic_write('previous.json', old)
            if changed or force:
                self._atomic_write('latest.json', data)
            if force or not self.last_snapshot or now - self.last_snapshot >= 300:
                stamp = datetime.fromtimestamp(now, timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
                name = 'snapshot-' + stamp + '-' + secrets.token_hex(4) + '.json'
                self._atomic_write(name, data)
                self.last_snapshot = now
                snapshots = self._snapshots()
                for expired in snapshots[:-50]:
                    expired.unlink()
            return {'revision': hashlib.sha256(data).hexdigest(), 'lastBackup': iso_date((self.folder / 'latest.json').stat().st_mtime), 'unchanged': False}

    def list(self):
        with self.lock:
            paths = [self.folder / name for name in ('latest.json', 'previous.json')] + self._snapshots()
            items = [{'name': p.name, 'date': iso_date(p.stat().st_mtime), 'kind': 'snapshot' if SNAPSHOT_RE.fullmatch(p.name) else p.stem}
                     for p in paths if p.is_file() and not p.is_symlink()]
            return sorted(items, key=lambda item: (item['date'], item['name']), reverse=True)

    def read(self, name):
        if name not in ('latest.json', 'previous.json') and not SNAPSHOT_RE.fullmatch(name):
            raise ValueError('Choose an existing Writing Studio backup.')
        with self.lock:
            path = self.folder / name
            if path.is_symlink():
                raise ValueError('Symbolic links are not backup files.')
            data = path.read_bytes()
            validate_backup(data.decode('utf-8'))
            return data


class WritingServer(ThreadingHTTPServer):
    daemon_threads = True
    def __init__(self, address, folder, key_file=None):
        folder_path = Path(folder).expanduser().resolve()
        key_path = Path(key_file if key_file is not None else folder_path.parent / 'deepseek-key.json').expanduser().absolute()
        served = APP.resolve()
        for private_path in (key_path, key_path.parent / 'deepseek-key-settings.json'):
            for candidate in (private_path, private_path.resolve()):
                try:
                    candidate.relative_to(served)
                except ValueError:
                    pass
                else:
                    raise ValueError('Keep the key file and its settings outside the app folder served to the browser.')
                if candidate.parent.resolve() == folder_path and (candidate.name in ('latest.json', 'previous.json') or SNAPSHOT_RE.fullmatch(candidate.name)):
                    raise ValueError('The key file cannot replace a Writing Studio recovery backup.')
        self.backups = BackupStore(folder)
        self.assistant = DeepSeekSession()
        self.key_file = SecretKeyFile(key_path)
        try:
            with self.assistant.control():
                self.refresh_assistant_key()
        except AssistantError:
            pass  # A missing/invalid credential never prevents local writing.
        self.token = secrets.token_urlsafe(32)
        super().__init__(address, partial(WritingHandler, directory=str(APP)))
        self.origin = 'http://127.0.0.1:' + str(self.server_port)
        self.host = '127.0.0.1:' + str(self.server_port)

    def server_close(self):
        self.assistant.disconnect()
        super().server_close()

    def assistant_status(self):
        with self.assistant.control():
            return dict(self.assistant.status(), keyFile=self.key_file.status())

    def refresh_assistant_key(self):
        """Called while holding session control, including before each generate."""
        if self.key_file.read_enabled:
            try:
                self.assistant.replace_key(self.key_file.load_key())
            except KeyFileError as error:
                self.assistant.disconnect()
                raise AssistantError(str(error), 400) from None

    def assistant_action(self, route, value):
        with self.assistant.control():
            try:
                if route == '/__ai/connect':
                    key_from_value(value)
                    if self.assistant.status()['busy']:
                        raise AssistantError('Wait for the current request before reconnecting.', 409)
                    self.key_file.set_enabled(False)
                    self.assistant.connect(value)
                elif route == '/__ai/disconnect':
                    if value != {}:
                        raise AssistantError('The disconnect request is invalid.')
                    self.assistant.disconnect()
                    self.key_file.set_enabled(False)
                elif route == '/__ai/key-file/create':
                    if value != {}:
                        raise AssistantError('The key-file request is invalid.')
                    created = self.key_file.create_empty()
                    if self.key_file.read_enabled:
                        self.refresh_assistant_key()
                    return dict(self.assistant_status(), created=created)
                elif route == '/__ai/key-file/settings':
                    if not isinstance(value, dict) or set(value) != {'readEnabled'} or type(value['readEnabled']) is not bool:
                        raise AssistantError('Choose whether key-file reading is enabled.')
                    self.key_file.set_enabled(value['readEnabled'])
                    if value['readEnabled']:
                        self.refresh_assistant_key()
                    else:
                        self.assistant.disconnect()
                elif route == '/__ai/key-file/reload':
                    if value != {}:
                        raise AssistantError('The key-file request is invalid.')
                    if not self.key_file.read_enabled:
                        raise AssistantError('Enable key-file reading before loading the saved key.', 409)
                    self.refresh_assistant_key()
                elif route == '/__ai/key-file/clear':
                    if value != {}:
                        raise AssistantError('The key-file request is invalid.')
                    self.assistant.disconnect()
                    self.key_file.clear_saved_key()
                else:
                    raise AssistantError('Assistant action not found.', 404)
                return self.assistant_status()
            except KeyFileError as error:
                self.assistant.disconnect()
                raise AssistantError(str(error), 503) from None


class WritingHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass  # Manuscripts, paths and request payloads never enter server logs.

    def list_directory(self, _):
        self.send_error(404)
        return None

    def _reply(self, status, value):
        payload = json.dumps(value, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(payload)

    def _allowed(self, token=False, mutation=False):
        hosts = self.headers.get_all('Host', [])
        if hosts != [self.server.host]:
            self._reply(403, {'error': 'Writing Studio accepts only its local browser address.'})
            return False
        origin = self.headers.get('Origin')
        if (origin is not None and origin != self.server.origin) or (mutation and origin != self.server.origin):
            self._reply(403, {'error': 'This request must come from the Writing Studio window.'})
            return False
        if self.headers.get('Sec-Fetch-Site') not in (None, 'same-origin', 'none'):
            self._reply(403, {'error': 'This request must come from the Writing Studio window.'})
            return False
        if token and not secrets.compare_digest(self.headers.get('X-Writing-Token', ''), self.server.token):
            self._reply(403, {'error': 'The local backup session has expired. Reopen Writing Studio.'})
            return False
        return True

    def do_HEAD(self):
        if self._allowed() and not self._static_secret():
            super().do_HEAD()

    def _static_secret(self):
        requested = Path(self.translate_path(self.path))
        for private_path in (self.server.key_file.path, self.server.key_file.settings_path):
            try:
                same = requested.resolve() == private_path.resolve() or (requested.exists() and private_path.exists() and requested.samefile(private_path))
            except OSError:
                same = False
            if same:
                self.send_error(404)
                return True
        return False

    def do_GET(self):
        route = urlsplit(self.path)
        if not self._allowed(token=(route.path.startswith('/__backup/') and route.path != '/__backup/config') or route.path.startswith('/__ai/')):
            return
        try:
            if route.path == '/__ai/status':
                self._reply(200, self.server.assistant_status())
            elif route.path.startswith('/__ai/'):
                self._reply(404, {'error': 'Assistant action not found.'})
            elif route.path == '/__backup/config':
                self._reply(200, dict(self.server.backups.status(), token=self.server.token, app='Writing Studio', backupProtocol=1))
            elif route.path == '/__backup/list':
                self._reply(200, {'snapshots': self.server.backups.list()})
            elif route.path == '/__backup/read':
                names = parse_qs(route.query).get('name', [])
                if len(names) != 1:
                    raise ValueError('Choose one backup to restore.')
                data = self.server.backups.read(names[0])
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Disposition', 'attachment; filename="' + names[0] + '"')
                self.send_header('Content-Length', str(len(data)))
                self.send_header('Cache-Control', 'no-store')
                self.send_header('X-Content-Type-Options', 'nosniff')
                self.end_headers()
                self.wfile.write(data)
            elif route.path.startswith('/__backup/'):
                self._reply(404, {'error': 'Backup action not found.'})
            else:
                if not self._static_secret():
                    super().do_GET()
        except FileNotFoundError:
            self._reply(404, {'error': 'That backup is no longer available.'})
        except (ValueError, UnicodeError):
            self._reply(400, {'error': 'That file is not a valid Writing Studio backup.'})
        except OSError:
            self._reply(503, {'error': 'The backup folder could not be read. Check its permissions.'})

    def do_POST(self):
        if not self._allowed(token=True, mutation=True):
            return
        if urlsplit(self.path).path.startswith('/__ai/'):
            self._assistant_post()
            return
        if urlsplit(self.path).path != '/__backup/save':
            self._reply(404, {'error': 'Backup action not found.'})
            return
        try:
            if self.headers.get('Transfer-Encoding'):
                raise ValueError('A fixed request size is required.')
            lengths = self.headers.get_all('Content-Length', [])
            if len(lengths) != 1 or not lengths[0].isdigit():
                raise ValueError('A valid request size is required.')
            length = int(lengths[0])
            if not 0 < length <= MAX_BODY_BYTES:
                self._reply(413, {'error': 'This backup exceeds the 20 MB writing limit.'})
                return
            if self.headers.get_content_type() != 'application/json':
                raise ValueError('A JSON backup is required.')
            self.connection.settimeout(15)
            body = self.rfile.read(length)
            if len(body) != length:
                raise ValueError('The backup request was incomplete.')
            value = parse_json(body.decode('utf-8'))
            if not isinstance(value, dict) or type(value.get('force', False)) is not bool:
                raise ValueError('The backup request is invalid.')
            result = self.server.backups.save(value.get('data'), self.headers.get('X-Writing-Revision'), value.get('force', False))
            self._reply(200, result)
        except BackupConflict as error:
            self._reply(409, {'error': str(error), 'conflict': True})
        except (ValueError, UnicodeError, RecursionError, TimeoutError) as error:
            self._reply(400, {'error': str(error) if isinstance(error, ValueError) else 'The backup request could not be read.'})
        except OSError:
            self._reply(503, {'error': 'The folder backup could not be saved. Your browser copy is still available.'})

    def _assistant_post(self):
        route = urlsplit(self.path).path
        if route not in ('/__ai/connect', '/__ai/disconnect', '/__ai/generate', '/__ai/key-file/create', '/__ai/key-file/settings', '/__ai/key-file/reload', '/__ai/key-file/clear'):
            self._reply(404, {'error': 'Assistant action not found.'})
            return
        try:
            lengths = self.headers.get_all('Content-Length', [])
            if self.headers.get('Transfer-Encoding') or len(lengths) != 1 or not lengths[0].isdigit():
                raise AssistantError('A fixed JSON request size is required.')
            length = int(lengths[0])
            if not 0 < length <= MAX_AI_BODY:
                raise AssistantError('The assistant request is too large.', 413)
            if self.headers.get_content_type() != 'application/json':
                raise AssistantError('A JSON assistant request is required.')
            self.connection.settimeout(15)
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise AssistantError('The assistant request was incomplete.')
            value = parse_json(raw.decode('utf-8'))
            if route == '/__ai/generate':
                result = self.server.assistant.generate(value, prepare=self.server.refresh_assistant_key)
            else:
                result = self.server.assistant_action(route, value)
            self._reply(200, result)
        except AssistantError as error:
            self._reply(error.status, dict(self.server.assistant_status(), error=str(error)))
        except (ValueError, UnicodeError, RecursionError, TimeoutError, OSError):
            self._reply(400, {'error': 'The assistant request could not be read.'})


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--no-browser', action='store_true')
    parser.add_argument('--port', type=int, default=8766)
    parser.add_argument('--backup-dir', type=Path, default=default_backup_dir())
    parser.add_argument('--key-file', type=Path, default=None, help='Optional JSON key file; defaults to deepseek-key.json beside the backup folder.')
    args = parser.parse_args(argv)
    if not 1 <= args.port <= 65535:
        parser.error('The port must be between 1 and 65535.')
    url = 'http://127.0.0.1:' + str(args.port) + '/'
    try:
        server = WritingServer(('127.0.0.1', args.port), args.backup_dir, key_file=args.key_file)
    except ValueError as error:
        parser.error(str(error))
    except OSError as error:
        try:
            with urllib.request.urlopen(url + '__backup/config', timeout=2) as response:
                config = json.loads(response.read(16384))
            if config.get('app') not in ('Writing Studio', 'Writing Desk') or config.get('backupProtocol') != 1:
                raise RuntimeError('This address is already used by another app.')
            if Path(config.get('folder', '')).resolve() != args.backup_dir.expanduser().resolve():
                raise RuntimeError('Another Writing Studio window uses a different backup folder. Close it or choose another port.')
            if args.key_file is not None:
                local_status = urllib.request.Request(url + '__ai/status', headers={'X-Writing-Token': config.get('token', '')})
                with urllib.request.urlopen(local_status, timeout=2) as response:
                    current = json.loads(response.read(16384))
                if Path(current.get('keyFile', {}).get('path', '')).resolve() != args.key_file.expanduser().resolve():
                    raise RuntimeError('Another Writing Studio window uses a different key file. Close it or choose another port.')
            if not args.no_browser:
                webbrowser.open(url)
            print('Writing Studio is already running at ' + url)
            return 0
        except Exception:
            print('Could not start Writing Studio. Close the app already using port ' + str(args.port) + ', or run launch.py --port 8767.')
            return 1
    print('Writing Studio is running at ' + url)
    print('Folder backups: ' + str(server.backups.folder))
    print('Keep this window open while writing. Close it or press Control-C when finished.')
    if not args.no_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
