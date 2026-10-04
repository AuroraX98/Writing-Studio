"""Mocked optional-assistant tests. Never contact an external provider."""
import http.client
import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import ai_proxy
import launch

KEY = 'sk-FICTIONAL-TEST-KEY-ONLY'


def request(**overrides):
    value = {'model': 'deepseek-flash', 'goal': 'rewrite', 'brief': 'Make this clearer.', 'text': 'Fictional draft sample.',
             'profile': dict(ai_proxy.DEFAULT_PROFILE, tone='warm', style='Lyrical', audience='Adults'), 'projectType': 'memoir', 'genre': 'Thematic'}
    return dict(value, **overrides)


def response(text='A clearer fictional suggestion.'):
    return {'choices': [{'message': {'content': text}, 'finish_reason': 'stop'}]}


class SessionTests(unittest.TestCase):
    def test_key_attach_status_disconnect_and_generate_only_calls_transport(self):
        calls = []
        session = ai_proxy.DeepSeekSession(lambda key, payload: calls.append((key, payload)) or response())
        self.assertFalse(session.status()['connected'])
        session.connect({'key': KEY})
        self.assertEqual(calls, [])
        self.assertNotIn(KEY, json.dumps(session.status()))
        result = session.generate(request())
        self.assertEqual(result['text'], 'A clearer fictional suggestion.')
        key, payload = calls[0]
        self.assertEqual(key, KEY)
        self.assertEqual(payload['thinking'], {'type': 'disabled'})
        self.assertEqual(payload['max_tokens'], 2048)
        self.assertFalse(payload['stream'])
        self.assertNotIn(KEY, json.dumps(payload))
        self.assertIn('Lyrical', payload['messages'][1]['content'])
        session.disconnect()
        self.assertIsNone(session._key)
        with self.assertRaisesRegex(ai_proxy.AssistantError, 'Connect your'):
            session.generate(request())
        self.assertFalse(ai_proxy.DeepSeekSession().status()['connected'])

    def test_invalid_payload_model_key_profile_limits_and_provider_echo_reject(self):
        session = ai_proxy.DeepSeekSession(lambda *_: response(KEY))
        for key in ('short', KEY + '\r\nInjected: true', '<script>invalid</script>'):
            with self.assertRaises(ai_proxy.AssistantError):
                session.connect({'key': key})
        session.connect({'key': KEY})
        for value in (request(model='deepseek-chat'), request(text='a' * 10001), request(brief=' '), request(url='https://evil.example'), request(profile={'key': KEY}), request(text='a' * 10000, brief='b' * 2000)):
            with self.assertRaises(ai_proxy.AssistantError):
                session.generate(value)
        with self.assertRaisesRegex(ai_proxy.AssistantError, 'safely'):
            session.generate(request())
        self.assertFalse(session.status()['busy'])
        for project_type in ('fiction', 'nonfiction', 'memoir', 'poetry', 'screenplay', 'essays', 'academic'):
            ai_proxy.messages_for(request(projectType=project_type))

    def test_malformed_and_empty_provider_output_and_unexpected_errors_are_sanitized(self):
        for result in (None, {}, {'choices': []}, response(''), response('x' * (ai_proxy.MAX_OUTPUT + 1))):
            session = ai_proxy.DeepSeekSession(lambda *_: result)
            session.connect({'key': KEY})
            with self.assertRaisesRegex(ai_proxy.AssistantError, 'no usable suggestion'):
                session.generate(request())
            self.assertFalse(session.status()['busy'])
        def fail(*_):
            raise RuntimeError(KEY + ' Fictional draft sample.')
        session = ai_proxy.DeepSeekSession(fail)
        session.connect({'key': KEY})
        with self.assertRaises(ai_proxy.AssistantError) as failure:
            session.generate(request())
        self.assertNotIn(KEY, str(failure.exception))
        self.assertNotIn('Fictional draft sample.', str(failure.exception))

    def test_disconnect_during_generation_discards_result_and_blocks_parallel_calls(self):
        started, finish = threading.Event(), threading.Event()
        errors = []
        def transport(*_):
            started.set()
            finish.wait(3)
            return response()
        session = ai_proxy.DeepSeekSession(transport)
        session.connect({'key': KEY})
        def generate():
            try:
                session.generate(request())
            except ai_proxy.AssistantError as error:
                errors.append(str(error))
        worker = threading.Thread(target=generate)
        worker.start()
        self.assertTrue(started.wait(1))
        with self.assertRaisesRegex(ai_proxy.AssistantError, 'already running'):
            session.generate(request())
        session.disconnect()
        finish.set()
        worker.join(3)
        self.assertEqual(errors, ['The assistant was disconnected. This response was discarded.'])
        self.assertFalse(session.status()['connected'])
        self.assertFalse(session.status()['busy'])


class TransportTests(unittest.TestCase):
    def test_fixed_https_destination_timeout_bounded_response_and_no_redirects(self):
        calls = []
        class FakeResponse:
            def __enter__(self):
                return self
            def __exit__(self, *_):
                pass
            def read(self, count):
                calls.append(count)
                return json.dumps(response()).encode()
        class FakeOpener:
            def open(self, outgoing, timeout):
                self.request = outgoing
                self.timeout = timeout
                return FakeResponse()
        opener = FakeOpener()
        with patch.object(ai_proxy, 'build_opener', return_value=opener) as build:
            self.assertEqual(ai_proxy.send_deepseek(KEY, {'model': 'deepseek-flash'}), response())
        self.assertEqual(opener.request.full_url, 'https://api.deepseek.com/chat/completions')
        self.assertEqual(opener.timeout, 90)
        self.assertEqual(calls, [ai_proxy.MAX_RESPONSE + 1])
        self.assertIsInstance(build.call_args[0][0], ai_proxy.NoRedirect)
        self.assertIsNone(ai_proxy.NoRedirect().redirect_request(None, None, None, None, None, None))

    def test_provider_error_bodies_and_network_exception_text_never_reach_browser(self):
        for failure in (HTTPError(ai_proxy.ENDPOINT, 401, KEY, {}, None), HTTPError(ai_proxy.ENDPOINT, 402, KEY, {}, None), HTTPError(ai_proxy.ENDPOINT, 429, KEY, {}, None), HTTPError(ai_proxy.ENDPOINT, 302, KEY, {}, None), URLError(KEY)):
            opener = unittest.mock.Mock()
            opener.open.side_effect = failure
            with patch.object(ai_proxy, 'build_opener', return_value=opener):
                with self.assertRaises(ai_proxy.AssistantError) as raised:
                    ai_proxy.send_deepseek(KEY, request())
            self.assertNotIn(KEY, str(raised.exception))


class ServerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.calls = []
        self.server = launch.WritingServer(('127.0.0.1', 0), self.temp.name, key_file=Path(self.temp.name) / 'keys' / 'deepseek-key.json')
        self.server.assistant = ai_proxy.DeepSeekSession(lambda key, payload: self.calls.append((key, payload)) or response())
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(2)
        self.temp.cleanup()
    def call(self, route, body=None, headers=None, method=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=3)
        outgoing = {'Host': self.server.host, 'Origin': self.server.origin, 'Sec-Fetch-Site': 'same-origin', 'X-Writing-Token': self.server.token}
        outgoing.update(headers or {})
        for key in tuple(outgoing):
            if outgoing[key] is None:
                del outgoing[key]
        encoded = json.dumps(body).encode() if body is not None else None
        if encoded is not None:
            outgoing['Content-Type'] = 'application/json'
        connection.request(method or ('POST' if body is not None else 'GET'), route, body=encoded, headers=outgoing)
        reply = connection.getresponse()
        status, value, response_headers = reply.status, json.loads(reply.read()), dict(reply.getheaders())
        connection.close()
        return status, value, response_headers
    def test_attach_generate_disconnect_round_trip_without_key_on_disk_or_status(self):
        self.assertEqual(self.call('/__ai/connect', {'key': KEY})[0], 200)
        self.assertEqual(self.calls, [])
        status, value, headers = self.call('/__ai/status')
        self.assertEqual(status, 200)
        self.assertNotIn(KEY, json.dumps(value))
        self.assertEqual(headers['Cache-Control'], 'no-store')
        self.assertNotIn('Access-Control-Allow-Origin', headers)
        self.assertEqual(self.call('/__ai/generate', request())[1]['text'], 'A clearer fictional suggestion.')
        self.assertEqual(len(self.calls), 1)
        self.assertFalse(self.server.key_file.path.exists())
        for path in Path(self.temp.name).rglob('*'):
            if path.is_file():
                self.assertNotIn(KEY, path.read_text())
        self.assertEqual(self.call('/__ai/disconnect', {})[1]['connected'], False)
    def test_wrong_host_origin_fetch_site_token_and_missing_post_origin_reject(self):
        for headers in ({'Host': 'evil.example'}, {'Origin': 'https://evil.example'}, {'Sec-Fetch-Site': 'cross-site'}, {'X-Writing-Token': 'wrong'}, {'X-Writing-Token': None}, {'Origin': None}):
            self.assertEqual(self.call('/__ai/connect', {'key': KEY}, headers)[0], 403)
        self.assertEqual(self.call('/__ai/status', headers={'X-Writing-Token': None})[0], 403)
        self.assertEqual(self.calls, [])
    def test_unknown_routes_and_arbitrary_destination_reject(self):
        self.call('/__ai/connect', {'key': KEY})
        self.assertEqual(self.call('/__ai/generate', request(url='http://example.invalid'))[0], 400)
        self.assertEqual(self.call('/__ai/unknown', {})[0], 404)
        self.assertEqual(self.call('/__ai/unknown')[0], 404)
        self.assertEqual(self.calls, [])


if __name__ == '__main__':
    unittest.main()
