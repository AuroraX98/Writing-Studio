#!/usr/bin/env python3
"""Build checked, curated Writing Studio downloads. Nothing is uploaded."""
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import stat
import zipfile
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
RUNTIME = [
    'app/index.html', 'app/styles.css', 'app/main.js', 'app/storage.js',
    'app/text-tools.js', 'app/revision.js', 'app/local-backup.js', 'app/theme-palette.js', 'app/genres.js',
    'app/export.js', 'app/pdf.js', 'app/vendor/pdf-font.js',
    'app/vendor/DejaVu-LICENSE.txt', 'app/thesaurus.js', 'app/assistant.js',
    'app/vendor/wordnet-data.js', 'app/vendor/WordNet-LICENSE.txt',
]
COMMON = ['launch.py', 'ai_proxy.py', 'key_file.py', 'deepseek-key.example.json', 'KEY_FILE_SETUP.md', 'Writing Studio.html', 'README.md', 'VERSION', 'docs/character-profiles.png', 'docs/assistant-sections.png'] + RUNTIME
SOURCE = [
    '.gitignore', 'Open Writing Studio.command', 'Open Writing Studio.bat',
    'app/mockup-source.html', 'work/build_app.py', 'work/app_extension.js',
    'work/app_advanced.js', 'work/app_extra.css', 'work/package_release.py',
    'work/theme_extension.js', 'tests/theme-palette.test.cjs',
    'work/genre_extension.js', 'tests/genres.test.cjs',
    'work/assistant_extension.js', 'tests/assistant.test.cjs', 'tests/assistant-drafts.test.cjs',
    'work/help_extension.js', 'work/navigation_extension.js', 'tests/revision-ui.test.cjs',
    'work/characters_extension.js',
    'tests/test_ai_proxy.py', 'tests/mock_ai_server.py', 'tests/test_key_file.py',
    'work/build_thesaurus.py', 'tests/thesaurus.test.cjs',
    'tests/backup-fixture.json', 'tests/storage.test.cjs', 'tests/export.test.cjs',
    'tests/pdf.test.cjs', 'tests/revision.test.cjs', 'tests/text-tools.test.cjs',
    'tests/local-backup.test.cjs', 'tests/test_local_backup.py',
]


def start_here(platform, version):
    introduction = 'Writing Studio ' + version + '\r\n\r\nExtract this entire ZIP into a folder before opening the app.\r\n\r\n'
    if platform == 'windows':
        launch = ('WINDOWS\r\nDouble-click Open Writing Studio.bat. Python 3.8 or newer must be installed\r\n'
                  'for the launcher and automatic folder backups. Keep the launcher window\r\n'
                  'open while writing. The app opens at http://127.0.0.1:8766/.\r\n\r\n'
                  'Without Python, double-click Writing Studio.html and use Back up projects\r\n'
                  'to download JSON copies. Use the same browser and keep the HTML file in\r\n'
                  'the same location. File-based browser storage varies by browser.\r\n\r\n'
                  'Windows launch logic has been checked, but this beta has not yet been\r\n'
                  'tested on an actual Windows computer.\r\n')
    elif platform == 'mac':
        launch = ('MAC\r\nDouble-click Open Writing Studio.command. Python 3.8 or newer must be\r\n'
                  'installed for the launcher and automatic folder backups. Keep the\r\n'
                  'launcher window open while writing. The app opens at\r\n'
                  'http://127.0.0.1:8766/.\r\n\r\n'
                  'Without Python, open Writing Studio.html and use Back up projects to\r\n'
                  'download JSON copies. Use the same browser and keep the HTML file in\r\n'
                  'the same location. File-based browser storage varies by browser.\r\n')
    else:
        launch = ('SOURCE\r\nRead README.md for the source build, checks, and release packaging.\r\n'
                  'Runtime files and build inputs are both included. Core writing works\r\n'
                  'offline; the DeepSeek assistant is optional. A source license has not yet been selected.\r\n'
                  'The bundled font and WordNet data keep their separate licenses.\r\n'
                  'Repository: https://github.com/AuroraX98/Writing-Studio\r\n'
                  'Downloads: https://github.com/AuroraX98/Writing-Studio/tree/main/downloads\r\n')
    return (introduction + launch + '\r\nKeep a JSON backup on another drive before updates.\r\n'
            'Read README.md for storage, recovery, formatting, and known limitations.\r\n'
            'Downloads: https://github.com/AuroraX98/Writing-Studio/tree/main/downloads\r\n'
            'Windows: https://github.com/AuroraX98/Writing-Studio/raw/refs/heads/main/downloads/Writing-Studio-' + version + '-windows.zip\r\n'
            'Mac: https://github.com/AuroraX98/Writing-Studio/raw/refs/heads/main/downloads/Writing-Studio-' + version + '-mac.zip\r\n'
            'Source: https://github.com/AuroraX98/Writing-Studio/raw/refs/heads/main/downloads/Writing-Studio-' + version + '-source.zip\r\n'
            'For optional saved DeepSeek keys, read KEY_FILE_SETUP.md. The example\r\n'
            'key file is blank; keep your private copy outside the app folder.\r\n').encode('utf-8')


def checked_bytes(relative):
    path = ROOT / relative
    if not path.is_file() or path.is_symlink():
        raise RuntimeError('Missing or symbolic-link package input: ' + relative)
    data = path.read_bytes()
    if relative == 'deepseek-key.example.json':
        if json.loads(data.decode('utf-8'), object_pairs_hook=lambda pairs: pairs) != [('apiKey', '')]:
            raise RuntimeError('The distributed key example must contain only an empty apiKey.')
    if relative.endswith('.bat'):
        data = data.replace(b'\r\n', b'\n').replace(b'\n', b'\r\n')
    private_patterns = [
        re.compile((b'/' + b'Users' + b'/') + rb'[^\s"\'<>]+'),
        re.compile(rb'[A-Za-z]:\\' + b'Users' + rb'\\[^\s"\'<>]+'),
    ]
    if str(ROOT).encode() in data or any(pattern.search(data) for pattern in private_patterns):
        raise RuntimeError('A machine-specific private path was found in: ' + relative)
    return data


class RuntimeReferences(HTMLParser):
    def __init__(self):
        super().__init__()
        self.references = []
    def handle_starttag(self, tag, attributes):
        fields = dict(attributes)
        if tag == 'script' and fields.get('src'):
            self.references.append(fields['src'])
        elif tag == 'link' and fields.get('rel') == 'stylesheet':
            self.references.append(fields['href'])


def check_runtime_assets(entries):
    parser = RuntimeReferences()
    parser.feed(entries['app/index.html'].decode('utf-8'))
    for reference in parser.references:
        parsed = urlsplit(reference)
        if parsed.scheme or parsed.netloc or parsed.path.startswith('/') or '..' in Path(parsed.path).parts:
            raise RuntimeError('A runtime asset must be a bundled relative file: ' + reference)
        if 'app/' + parsed.path not in entries:
            raise RuntimeError('A referenced runtime asset is missing from the package: ' + reference)


def write_archive(destination, entries):
    with zipfile.ZipFile(destination, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for relative, data in entries.items():
            info = zipfile.ZipInfo('Writing Studio/' + relative)
            info.date_time = (2026, 10, 3, 0, 0, 0)
            info.create_system = 3
            info.compress_type = zipfile.ZIP_DEFLATED
            mode = 0o755 if relative == 'Open Writing Studio.command' else 0o644
            info.external_attr = (stat.S_IFREG | mode) << 16
            archive.writestr(info, data)
    with zipfile.ZipFile(destination) as archive:
        bad = archive.testzip()
        if bad:
            raise RuntimeError('Archive integrity failed for: ' + bad)
        expected = {'Writing Studio/' + relative for relative in entries}
        if set(archive.namelist()) != expected:
            raise RuntimeError('Archive file inventory does not match the curated inputs.')
        for relative, data in entries.items():
            if archive.read('Writing Studio/' + relative) != data:
                raise RuntimeError('Archive content changed for: ' + relative)
        if 'Open Writing Studio.command' in entries:
            mode = archive.getinfo('Writing Studio/Open Writing Studio.command').external_attr >> 16
            if not mode & stat.S_IXUSR:
                raise RuntimeError('The Mac launcher executable bit was not preserved.')
        if 'Open Writing Studio.bat' in entries:
            bat = archive.read('Writing Studio/Open Writing Studio.bat')
            if b'\n' in bat.replace(b'\r\n', b''):
                raise RuntimeError('The Windows launcher does not use CRLF line endings.')
    return {'file': destination.name, 'bytes': destination.stat().st_size,
            'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
            'files': sorted(entries)}


def main():
    version = (ROOT / 'VERSION').read_text().strip()
    if not re.fullmatch(r'\d+\.\d+(?:\.\d+)?(?:-[a-z0-9.-]+)?', version):
        raise RuntimeError('VERSION is not a safe release version.')
    releases = ROOT / 'releases'
    releases.mkdir(exist_ok=True)
    packages = {'windows': COMMON + ['Open Writing Studio.bat'],
                'mac': COMMON + ['Open Writing Studio.command'],
                'source': COMMON + SOURCE}
    manifest = {'version': version, 'published': False, 'windowsNativeSmokeTest': False, 'archives': []}
    for platform, inputs in packages.items():
        entries = {relative: checked_bytes(relative) for relative in inputs}
        entries['START_HERE.txt'] = start_here(platform, version)
        check_runtime_assets(entries)
        destination = releases / ('Writing-Studio-' + version + '-' + platform + '.zip')
        record = write_archive(destination, entries)
        record['platform'] = platform
        manifest['archives'].append(record)
        print(record['file'] + ': ' + str(len(entries)) + ' files; integrity and curated contents checked.')
    (releases / 'release-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return manifest


if __name__ == '__main__':
    main()
