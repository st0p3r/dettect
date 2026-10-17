"""
Runs DeTT&CT CLI operations as background jobs, so every CLI feature (including the interactive questions) can be
used from the web UI. Each job runs 'dettect.py' in a subprocess; its output is streamed to the browser and the
browser can answer questions by writing to the process' stdin.
"""
import asyncio
import os
import sys
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path

from server.fileinfo import file_info
from server.paths import ROOT, INPUT_DIR, OUTPUT_DIR

MAX_JOBS_KEPT = 100


def _snapshot(directory: Path):
    """
    Return a dict with the name and (mtime, size) of every file in a directory.
    """
    result = {}
    if directory.is_dir():
        for p in directory.iterdir():
            if p.is_file():
                st = p.stat()
                result[p.name] = (st.st_mtime_ns, st.st_size)
    return result


@dataclass
class Job:
    id: str
    title: str
    argv: list
    status: str = 'queued'  # queued, running, finished, failed, cancelled
    exit_code: int = None
    output: str = ''
    created: float = field(default_factory=time.time)
    started: float = None
    ended: float = None
    files: list = field(default_factory=list)
    process: asyncio.subprocess.Process = None
    changed: asyncio.Event = field(default_factory=asyncio.Event)

    def to_dict(self, include_output=True):
        d = {
            'id': self.id,
            'title': self.title,
            'argv': self.argv,
            'command': ' '.join(_quote(a) for a in self.argv),
            'status': self.status,
            'exit_code': self.exit_code,
            'created': self.created,
            'started': self.started,
            'ended': self.ended,
            'files': self.files,
        }
        if include_output:
            d['output'] = self.output
        return d

    def notify(self):
        self.changed.set()
        self.changed = asyncio.Event()


def _quote(arg):
    if arg == '' or any(c in arg for c in ' \'"&|;<>()$`\\'):
        return "'" + arg.replace("'", "'\\''") + "'"
    return arg


class JobManager:

    def __init__(self):
        self.jobs = {}
        # DeTT&CT writes to shared 'output' and 'cache' folders, so jobs are executed one at a time.
        self._lock = asyncio.Lock()

    def list(self):
        return sorted(self.jobs.values(), key=lambda j: j.created, reverse=True)

    def get(self, job_id):
        return self.jobs.get(job_id)

    def create(self, title, argv):
        """
        Create and schedule a job.
        :param title: human readable title of the job
        :param argv: arguments for the Python interpreter, e.g. ['dettect.py', 'ds', '-fd', 'input/file.yaml', '-l']
        """
        job = Job(id=uuid.uuid4().hex[:12], title=title, argv=list(argv))
        self.jobs[job.id] = job
        self._cleanup()
        asyncio.get_running_loop().create_task(self._run(job))
        return job

    def _cleanup(self):
        if len(self.jobs) > MAX_JOBS_KEPT:
            finished = [j for j in self.list() if j.status not in ('queued', 'running')]
            for j in finished[MAX_JOBS_KEPT // 2:]:
                del self.jobs[j.id]

    async def _run(self, job: Job):
        async with self._lock:
            if job.status == 'cancelled':
                return
            before_in, before_out = _snapshot(INPUT_DIR), _snapshot(OUTPUT_DIR)
            env = dict(os.environ, PYTHONUNBUFFERED='1', PYTHONIOENCODING='utf-8', DeTTECT_WEB_UI='1')
            job.status = 'running'
            job.started = time.time()
            job.notify()
            try:
                job.process = await asyncio.create_subprocess_exec(
                    sys.executable, '-u', *job.argv, cwd=str(ROOT), env=env,
                    stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT)
                while True:
                    chunk = await job.process.stdout.read(4096)
                    if not chunk:
                        break
                    job.output += chunk.decode('utf-8', errors='replace')
                    job.notify()
                job.exit_code = await job.process.wait()
                if job.status != 'cancelled':
                    job.status = 'finished' if job.exit_code == 0 else 'failed'
            except Exception as e:  # pylint: disable=broad-except
                job.output += '\n[!] Could not run the job: %s\n' % e
                job.status = 'failed'
            finally:
                job.ended = time.time()
                job.files = self._changed_files(before_in, before_out)
                job.process = None
                job.notify()

    @staticmethod
    def _changed_files(before_in, before_out):
        files = []
        for directory, before in (('input', before_in), ('output', before_out)):
            path = INPUT_DIR if directory == 'input' else OUTPUT_DIR
            for name, stat in sorted(_snapshot(path).items()):
                if before.get(name) != stat:
                    info = file_info(path / name)
                    files.append({'dir': directory, 'name': name, 'new': name not in before,
                                  'file_type': info.get('file_type')})
        return files

    async def send_input(self, job: Job, text: str):
        if job.process is None or job.process.stdin is None:
            return False
        job.process.stdin.write((text + '\n').encode('utf-8'))
        await job.process.stdin.drain()
        job.output += text + '\n'
        job.notify()
        return True

    def cancel(self, job: Job):
        if job.status == 'queued':
            job.status = 'cancelled'
            job.notify()
        elif job.process is not None:
            job.status = 'cancelled'
            job.process.kill()
