"""Local development harness with a fictional provider; never shipped as an app mode.

Example: python3 tests/mock_ai_server.py --port 8773 --backup-dir /tmp/studio-ai-check
Any syntactically valid fictional key attaches without a provider request.
"""
import argparse
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from launch import WritingServer
from ai_proxy import DeepSeekSession


def fake_provider(_key, payload):
    text = 'Mock suggestion for testing only. A calm opening invites the reader into a specific moment.'
    return {'choices': [{'message': {'content': text}, 'finish_reason': 'stop'}]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8773)
    parser.add_argument('--backup-dir', type=Path, required=True)
    parser.add_argument('--key-file', type=Path, default=None)
    args = parser.parse_args()
    server = WritingServer(('127.0.0.1', args.port), args.backup_dir, key_file=args.key_file if args.key_file is not None else args.backup_dir / 'test-keys' / 'deepseek-key.json')
    server.assistant._transport = fake_provider
    print('Fictional local assistant test server: ' + server.origin, flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
