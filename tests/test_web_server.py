import asyncio
import unittest

from fastapi import HTTPException

from server.app import JobRequest, _safe_name, create_job
from server.fileinfo import file_info
from server.paths import ROOT


class WebServerTest(unittest.TestCase):
    def test_file_names_can_not_escape_the_folder(self):
        self.assertEqual(_safe_name('../../etc/passwd'), 'passwd')
        self.assertEqual(_safe_name('..\\secret.yaml'), 'secret.yaml')
        for name in ('', '..', '.hidden', '../'):
            with self.assertRaises(HTTPException):
                _safe_name(name)

    def test_jobs_only_accept_dettect_modes(self):
        for args in ([], ['editor'], ['-m', 'http.server'], ['--version']):
            with self.assertRaises(HTTPException):
                asyncio.run(create_job(JobRequest(args=args)))

    def test_file_type_detection(self):
        info = file_info(ROOT / 'sample-data' / 'techniques-administration-endpoints.yaml')
        self.assertEqual(info['file_type'], 'technique-administration')
        self.assertEqual(info['version'], '1.2')


if __name__ == '__main__':
    unittest.main()
