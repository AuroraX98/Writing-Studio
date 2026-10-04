"""An explicitly enabled, separate local credential file. Never make secret backups."""
import json
import os
from pathlib import Path
import secrets
import stat
import threading

MAX_FILE_BYTES = 4096
_MISSING = object()


class KeyFileError(Exception):
    pass


class SecretKeyFile:
    def __init__(self, path):
        # Do not resolve a final symlink into a readable secret file.
        self.path = Path(path).expanduser().absolute()
        self.settings_path = self.path.parent / 'deepseek-key-settings.json'
        self._lock = threading.RLock()
        self._read_enabled = False
        self._error = None
        if self.path == self.settings_path:
            self._error = 'Choose a key filename other than the reserved settings filename.'
            return
        try:
            settings = self._read_json(self.settings_path, missing=_MISSING)
            if settings is not _MISSING:
                if not isinstance(settings, dict) or set(settings) != {'readEnabled'} or type(settings['readEnabled']) is not bool:
                    raise KeyFileError('The key-file settings are invalid. File reading stays disabled.')
                self._read_enabled = settings['readEnabled']
        except KeyFileError:
            self._error = 'The key-file settings could not be read safely. File reading stays disabled.'

    @property
    def read_enabled(self):
        with self._lock:
            return self._read_enabled

    def _check_path(self, path, missing=False):
        try:
            info = path.lstat()
        except FileNotFoundError:
            if missing:
                return None
            raise KeyFileError('The saved key file was not found. Create a template or disable file reading.') from None
        except OSError:
            raise KeyFileError('The key file could not be accessed. Check its permissions.') from None
        if not stat.S_ISREG(info.st_mode) or stat.S_ISLNK(info.st_mode):
            raise KeyFileError('Key files and settings must be regular files, never symbolic links.')
        if info.st_size > MAX_FILE_BYTES:
            raise KeyFileError('The key file or settings exceed the 4 KB limit.')
        return info

    def _read_json(self, path, missing=False):
        if self._check_path(path, missing=missing is not False) is None:
            return missing
        descriptor = None
        try:
            flags = os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_NONBLOCK', 0)
            descriptor = os.open(path, flags)
            info = os.fstat(descriptor)
            current = path.lstat()
            if not stat.S_ISREG(info.st_mode) or stat.S_ISLNK(current.st_mode) or (current.st_dev, current.st_ino) != (info.st_dev, info.st_ino) or info.st_size > MAX_FILE_BYTES:
                raise KeyFileError('The key file could not be read safely.')
            with os.fdopen(descriptor, 'rb') as stream:
                descriptor = None
                raw = stream.read(MAX_FILE_BYTES + 1)
            if len(raw) > MAX_FILE_BYTES:
                raise KeyFileError('The key file or settings exceed the 4 KB limit.')
            def pairs(items):
                value = {}
                for key, item in items:
                    if key in value:
                        raise ValueError('Duplicate key')
                    value[key] = item
                return value
            return json.loads(raw.decode('utf-8'), object_pairs_hook=pairs)
        except KeyFileError:
            raise
        except (OSError, ValueError, UnicodeError, RecursionError):
            raise KeyFileError('The key file or settings are unreadable or invalid JSON.') from None
        finally:
            if descriptor is not None:
                os.close(descriptor)

    def _atomic_write(self, path, value, create_only=False):
        self._check_path(path, missing=True)
        temporary = None
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            temporary = path.parent / ('.deepseek-key-' + secrets.token_hex(12) + '.tmp')
            encoded = (json.dumps(value, ensure_ascii=True, indent=2) + '\n').encode('utf-8')
            descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(descriptor, 'wb') as stream:
                if os.name != 'nt':
                    os.fchmod(stream.fileno(), 0o600)
                stream.write(encoded)
                stream.flush()
                os.fsync(stream.fileno())
            # Validate again immediately before replacing; never replace a link.
            self._check_path(path, missing=True)
            if create_only:
                # Atomic no-overwrite publication on POSIX and Windows.
                os.link(temporary, path)
                temporary.unlink()
                temporary = None
            else:
                os.replace(temporary, path)
                temporary = None
            if os.name != 'nt':
                descriptor = os.open(path.parent, os.O_RDONLY)
                try:
                    os.fsync(descriptor)
                finally:
                    os.close(descriptor)
        except KeyFileError:
            raise
        except OSError:
            raise KeyFileError('The key file or settings could not be saved. Check folder permissions.') from None
        finally:
            if temporary is not None:
                try:
                    temporary.unlink()
                except FileNotFoundError:
                    pass

    def status(self):
        with self._lock:
            try:
                exists = self._check_path(self.path, missing=True) is not None
                error = self._error
            except KeyFileError as failure:
                exists = os.path.lexists(self.path)
                error = str(failure)
            return {'path': str(self.path), 'exists': exists, 'readEnabled': self._read_enabled, 'error': error}

    def create_empty(self):
        with self._lock:
            try:
                if self.path == self.settings_path:
                    raise KeyFileError('Choose a key filename other than the reserved settings filename.')
                if self._check_path(self.path, missing=True) is not None:
                    value = self._read_json(self.path)
                    if value != {'apiKey': ''}:
                        raise KeyFileError('The existing key file is not an empty template. It was left unchanged.')
                    self._error = None
                    return False
                self._atomic_write(self.path, {'apiKey': ''}, create_only=True)
                self._error = None
                return True
            except KeyFileError as failure:
                self._error = str(failure)
                raise

    def set_enabled(self, enabled):
        if type(enabled) is not bool:
            raise KeyFileError('Choose whether key-file reading is enabled.')
        with self._lock:
            try:
                if self.path == self.settings_path:
                    raise KeyFileError('Choose a key filename other than the reserved settings filename.')
                # A failed opt-out must still disable reading in this process.
                if not enabled:
                    self._read_enabled = False
                self._atomic_write(self.settings_path, {'readEnabled': enabled})
                self._read_enabled = enabled
                self._error = None
            except KeyFileError as failure:
                self._read_enabled = False
                self._error = 'The read setting could not be saved. File reading is disabled for this session; the previous setting may remain on disk.'
                raise KeyFileError(self._error) from None

    def load_key(self):
        with self._lock:
            if not self._read_enabled:
                raise KeyFileError('Enable key-file reading before loading the saved key.')
            try:
                value = self._read_json(self.path)
                if not isinstance(value, dict) or set(value) != {'apiKey'} or not isinstance(value['apiKey'], str):
                    raise KeyFileError('Use a JSON key file containing only the apiKey text field.')
                key = value['apiKey'].strip()
                if key:
                    from ai_proxy import key_from_value, AssistantError
                    try:
                        key = key_from_value({'key': key})
                    except AssistantError:
                        raise KeyFileError('The saved API key is invalid. Edit the key file or clear it.') from None
                self._error = None
                return key or None
            except KeyFileError as failure:
                self._error = str(failure)
                raise

    def clear_saved_key(self):
        with self._lock:
            # Persist the opt-out before modifying the key so a failed clear
            # cannot silently reattach it in this process.
            self.set_enabled(False)
            try:
                self._atomic_write(self.path, {'apiKey': ''})
                if self._read_json(self.path) != {'apiKey': ''}:
                    raise KeyFileError('The saved key could not be confirmed empty. File reading stays disabled.')
                self._error = None
            except KeyFileError as failure:
                self._error = str(failure)
                raise
