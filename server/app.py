"""
DeTT&CT web server: serves the web UI and exposes a REST API for managing the YAML administration files, running all
DeTT&CT operations (as jobs) and reading output files.
"""
import asyncio
import json
import mimetypes
import os
import re
import shutil
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile, Request
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from server import attack_data as attack_store
from server.fileinfo import file_info as _file_info
from server.jobs import JobManager
from server.paths import ROOT, INPUT_DIR, OUTPUT_DIR, CACHE_DIR, STIX_DIR, SETTINGS_FILE, WEBUI_DIST, prepare_folders

sys.path.insert(0, str(ROOT))
import constants  # noqa: E402  pylint: disable=wrong-import-position

DIRS = {'input': INPUT_DIR, 'output': OUTPUT_DIR}
MODES = {'datasource', 'ds', 'visibility', 'v', 'detection', 'd', 'group', 'g', 'generic', 'ge'}
DEFAULT_SETTINGS = {'stix_source': 'online', 'local_stix_path': '', 'ignore_verify_tls': False}

@asynccontextmanager
async def _lifespan(_app):
    prepare_folders()
    yield


app = FastAPI(title='DeTT&CT', lifespan=_lifespan, docs_url='/api/docs', openapi_url='/api/openapi.json')
jobs = JobManager()
_attack_cache = {}

# The ATT&CK Navigator (hosted on GitHub pages) loads layer files from this server via '#layerURL=...'. This only works
# when the browser is allowed to share the response with the Navigator: cross-origin (CORS) and from a public website
# to localhost (Private Network Access). Only GET requests for output files from the Navigator's origin are allowed.
NAVIGATOR_ORIGIN = 'https://mitre-attack.github.io'


@app.middleware('http')
async def _navigator_cors(request: Request, call_next):
    navigator = request.headers.get('origin') == NAVIGATOR_ORIGIN and request.url.path.startswith('/api/files/output/')
    if navigator and request.method == 'OPTIONS':
        response = PlainTextResponse('', status_code=204)
        response.headers['Access-Control-Allow-Methods'] = 'GET'
        response.headers['Access-Control-Allow-Headers'] = request.headers.get('access-control-request-headers', '*')
        response.headers['Access-Control-Max-Age'] = '600'
    else:
        response = await call_next(request)
    if navigator:
        response.headers['Access-Control-Allow-Origin'] = NAVIGATOR_ORIGIN
        response.headers['Access-Control-Allow-Private-Network'] = 'true'
        response.headers['Vary'] = 'Origin'
    return response


# ---------------------------------------------------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------------------------------------------------
def load_settings():
    settings = dict(DEFAULT_SETTINGS)
    if SETTINGS_FILE.exists():
        try:
            settings.update(json.loads(SETTINGS_FILE.read_text()))
        except ValueError:
            pass
    return settings


def settings_argv():
    """
    The CLI arguments that follow from the settings and need to be added to every DeTT&CT job.
    """
    settings = load_settings()
    argv = []
    if settings['stix_source'] == 'local' and settings['local_stix_path']:
        argv += ['--local-stix-path', settings['local_stix_path']]
    if settings['ignore_verify_tls']:
        argv.append('--ignore-verify-tls')
    return argv


class Settings(BaseModel):
    stix_source: str = 'online'
    local_stix_path: str = ''
    ignore_verify_tls: bool = False


@app.get('/api/settings')
def get_settings():
    return load_settings()


@app.put('/api/settings')
def put_settings(settings: Settings):
    if settings.stix_source not in ('online', 'local'):
        raise HTTPException(400, 'Invalid STIX source')
    SETTINGS_FILE.write_text(json.dumps(settings.model_dump(), indent=2))
    _attack_cache.clear()
    attack_store.clear_memory_cache()
    return load_settings()


@app.get('/api/info')
def info():
    stix_ok = all((STIX_DIR / d / (d + '.json')).exists() for d in ('enterprise-attack', 'ics-attack', 'mobile-attack'))
    cache_files = [p for p in CACHE_DIR.iterdir() if p.is_file()] if CACHE_DIR.is_dir() else []
    return {
        'version': constants.VERSION,
        'attack_version': constants.ATTACK_VERSION,
        'navigator_version': constants.ATTACK_NAVIGATOR_VERSION,
        'layer_version': constants.ATTACK_LAYER_VERSION,
        'file_versions': {
            constants.FILE_TYPE_DATA_SOURCE_ADMINISTRATION: constants.FILE_TYPE_DATA_SOURCE_ADMINISTRATION_VERSION,
            constants.FILE_TYPE_TECHNIQUE_ADMINISTRATION: constants.FILE_TYPE_TECHNIQUE_ADMINISTRATION_VERSION,
            constants.FILE_TYPE_GROUP_ADMINISTRATION: constants.FILE_TYPE_GROUP_ADMINISTRATION_VERSION,
        },
        'platforms': {
            'enterprise': list(constants.PLATFORMS_ENTERPRISE.values()),
            'ics': list(constants.PLATFORMS_ICS.values()),
            'mobile': list(constants.PLATFORMS_MOBILE.values()),
        },
        'layer_settings': constants.LAYER_SETTINGS,
        'stix_dir': str(STIX_DIR.relative_to(ROOT)),
        'stix_downloaded': stix_ok,
        'cache_files': len(cache_files),
        'sample_files': sorted(p.name for p in (ROOT / 'sample-data').glob('*.yaml')),
    }


@app.post('/api/cache/clear')
def clear_cache():
    count = 0
    if CACHE_DIR.is_dir():
        for p in CACHE_DIR.iterdir():
            if p.is_file():
                p.unlink()
                count += 1
    _attack_cache.clear()
    attack_store.clear_memory_cache()
    return {'removed': count}


@app.post('/api/stix/download')
async def download_stix():
    job = jobs.create('Download ATT&CK STIX data', ['-m', 'server.download_stix', str(STIX_DIR.relative_to(ROOT))])
    return job.to_dict()


# ---------------------------------------------------------------------------------------------------------------------
# Files
# ---------------------------------------------------------------------------------------------------------------------
def _safe_name(name):
    name = os.path.basename(name.replace('\\', '/')).strip()
    if not name or name in ('.', '..') or name.startswith('.'):
        raise HTTPException(400, 'Invalid filename')
    return name


def _dir(directory):
    if directory not in DIRS:
        raise HTTPException(404, 'Unknown directory')
    return DIRS[directory]


@app.get('/api/files/{directory}')
def list_files(directory: str):
    d = _dir(directory)
    d.mkdir(exist_ok=True)
    files = [_file_info(p) for p in d.iterdir() if p.is_file() and not p.name.startswith('.')]
    return sorted(files, key=lambda f: f['modified'], reverse=True)


@app.get('/api/files/{directory}/{name}')
def get_file(directory: str, name: str, download: bool = False):
    path = _dir(directory) / _safe_name(name)
    if not path.is_file():
        raise HTTPException(404, 'File not found')
    media_type = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
    if path.suffix.lower() in ('.yaml', '.yml'):
        media_type = 'text/plain; charset=utf-8'
    if download:
        return FileResponse(path, media_type=media_type, filename=path.name)
    return FileResponse(path, media_type=media_type)


@app.put('/api/files/{directory}/{name}')
async def put_file(directory: str, name: str, request: Request, overwrite: bool = True):
    path = _dir(directory) / _safe_name(name)
    if path.exists() and not overwrite:
        raise HTTPException(409, 'File already exists')
    content = await request.body()
    path.write_bytes(content)
    return _file_info(path)


@app.post('/api/files/{directory}')
async def upload_files(directory: str, files: list[UploadFile]):
    d = _dir(directory)
    result = []
    for f in files:
        path = d / _safe_name(f.filename)
        with open(path, 'wb') as out:
            shutil.copyfileobj(f.file, out)
        result.append(_file_info(path))
    return result


@app.delete('/api/files/{directory}/{name}')
def delete_file(directory: str, name: str):
    path = _dir(directory) / _safe_name(name)
    if not path.is_file():
        raise HTTPException(404, 'File not found')
    path.unlink()
    return {'deleted': name}


class FileAction(BaseModel):
    action: str  # rename, copy, copy-to-input, import-sample
    target: str = ''


@app.post('/api/files/{directory}/{name}/action')
def file_action(directory: str, name: str, body: FileAction):
    if body.action == 'import-sample':
        src = ROOT / 'sample-data' / _safe_name(name)
        dst_dir = INPUT_DIR
    else:
        src = _dir(directory) / _safe_name(name)
        dst_dir = INPUT_DIR if body.action == 'copy-to-input' else _dir(directory)
    if not src.is_file():
        raise HTTPException(404, 'File not found')
    dst = dst_dir / _safe_name(body.target or src.name)
    if dst.exists() and dst != src:
        raise HTTPException(409, "A file named '%s' already exists" % dst.name)
    if body.action == 'rename':
        src.rename(dst)
    elif body.action in ('copy', 'copy-to-input', 'import-sample'):
        shutil.copy2(src, dst)
    else:
        raise HTTPException(400, 'Unknown action')
    return _file_info(dst)


# ---------------------------------------------------------------------------------------------------------------------
# Jobs
# ---------------------------------------------------------------------------------------------------------------------
class JobRequest(BaseModel):
    title: str = ''
    args: list[str]


@app.get('/api/jobs')
def list_jobs():
    return [j.to_dict(include_output=False) for j in jobs.list()]


@app.post('/api/jobs')
async def create_job(body: JobRequest):
    if not body.args or body.args[0] not in MODES:
        raise HTTPException(400, 'Invalid mode')
    if any('\x00' in a for a in body.args):
        raise HTTPException(400, 'Invalid argument')
    job = jobs.create(body.title or body.args[0], ['dettect.py'] + body.args + settings_argv())
    return job.to_dict()


def _job(job_id):
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(404, 'Job not found')
    return job


@app.get('/api/jobs/{job_id}')
def get_job(job_id: str):
    return _job(job_id).to_dict()


@app.get('/api/jobs/{job_id}/stream')
async def stream_job(job_id: str, request: Request):
    """
    Server-sent events with the job's output and state changes.
    """
    job = _job(job_id)

    async def events():
        sent = 0
        last_status = None
        while True:
            changed = job.changed
            if len(job.output) > sent:
                yield 'event: output\ndata: %s\n\n' % json.dumps(job.output[sent:])
                sent = len(job.output)
            if job.status != last_status:
                last_status = job.status
                yield 'event: status\ndata: %s\n\n' % json.dumps(job.to_dict(include_output=False))
            if job.status not in ('queued', 'running'):
                yield 'event: end\ndata: {}\n\n'
                return
            if await request.is_disconnected():
                return
            try:
                await asyncio.wait_for(changed.wait(), timeout=15)
            except asyncio.TimeoutError:
                yield ': keep-alive\n\n'

    return StreamingResponse(events(), media_type='text/event-stream',
                             headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})


class JobInput(BaseModel):
    text: str


@app.post('/api/jobs/{job_id}/input')
async def job_input(job_id: str, body: JobInput):
    if not await jobs.send_input(_job(job_id), body.text):
        raise HTTPException(409, 'The job is not running')
    return {'ok': True}


@app.post('/api/jobs/{job_id}/cancel')
def cancel_job(job_id: str):
    job = _job(job_id)
    jobs.cancel(job)
    return job.to_dict(include_output=False)


@app.delete('/api/jobs')
def clear_jobs():
    for j in list(jobs.list()):
        if j.status not in ('queued', 'running'):
            del jobs.jobs[j.id]
    return {'ok': True}


# ---------------------------------------------------------------------------------------------------------------------
# ATT&CK data (used for suggestions in the UI)
# ---------------------------------------------------------------------------------------------------------------------
def _load_attack(kind):
    import generic  # pylint: disable=import-outside-toplevel
    settings = load_settings()
    generic.local_stix_path = settings['local_stix_path'] if settings['stix_source'] == 'local' and \
        settings['local_stix_path'] else None
    generic.verify_tls = not settings['ignore_verify_tls']
    cwd = os.getcwd()
    os.chdir(ROOT)
    try:
        if kind == 'groups':
            data = generic.load_attack_data(constants.DATA_TYPE_STIX_ALL_GROUPS)
            result = []
            for g in data:
                result.append({'id': generic.get_attack_id(g), 'name': g.get('name', ''),
                               'aliases': [a for a in g.get('aliases', []) if a != g.get('name')],
                               'domains': g.get('x_mitre_domains', [])})
        else:
            data = generic.load_attack_data(constants.DATA_TYPE_STIX_ALL_CAMPAIGNS)
            result = [{'id': generic.get_attack_id(c), 'name': c.get('name', ''),
                       'domains': c.get('x_mitre_domains', [])} for c in data]
        return sorted(result, key=lambda x: x['id'] or '')
    finally:
        os.chdir(cwd)


@app.get('/api/attack/editor-data/{domain}')
async def attack_editor_data(domain: str):
    """
    Techniques, tactics, software and data sources of a domain ('enterprise', 'ics' or 'mobile') from the configured
    ATT&CK source.
    """
    if domain not in attack_store.DOMAINS:
        raise HTTPException(404, 'Unknown domain')
    try:
        return await asyncio.to_thread(attack_store.get_attack_data, domain, load_settings())
    except (SystemExit, Exception) as e:  # pylint: disable=broad-except
        raise HTTPException(503, 'Could not load the ATT&CK data. Check the ATT&CK data source in the settings. '
                                 '(%s)' % (e.__class__.__name__ if isinstance(e, SystemExit) else e))


@app.get('/api/coverage/{name}')
async def coverage(name: str, subtechniques: bool = True):
    """
    Coverage statistics (visibility and detection) of a technique administration file in "My files".
    """
    path = INPUT_DIR / _safe_name(name)
    if not path.is_file():
        raise HTTPException(404, 'File not found')
    if _file_info(path).get('file_type') != 'technique-administration':
        raise HTTPException(400, 'Not a technique administration file')
    try:
        return await asyncio.to_thread(attack_store.compute_coverage, str(path), load_settings(), subtechniques)
    except (SystemExit, Exception) as e:  # pylint: disable=broad-except
        raise HTTPException(503, 'Could not calculate the coverage: %s' % (
            e.__class__.__name__ if isinstance(e, SystemExit) else e))


@app.get('/api/attack/{kind}')
async def attack_data(kind: str):
    if kind not in ('groups', 'campaigns'):
        raise HTTPException(404, 'Unknown ATT&CK data type')
    if kind not in _attack_cache:
        try:
            _attack_cache[kind] = await asyncio.to_thread(_load_attack, kind)
        except (SystemExit, Exception) as e:  # pylint: disable=broad-except
            raise HTTPException(503, 'Could not load the ATT&CK data. Check the ATT&CK data source in the settings. '
                                     '(%s)' % (e.__class__.__name__ if isinstance(e, SystemExit) else e))
    return _attack_cache[kind]


# ---------------------------------------------------------------------------------------------------------------------
# Web UI
# ---------------------------------------------------------------------------------------------------------------------
@app.get('/api/{rest:path}')
def api_not_found(rest: str):
    raise HTTPException(404, 'Not found')


if (WEBUI_DIST / 'assets').is_dir():
    app.mount('/assets', StaticFiles(directory=WEBUI_DIST / 'assets'), name='assets')


@app.get('/{rest:path}')
def spa(rest: str):
    candidate = (WEBUI_DIST / rest).resolve()
    if rest and candidate.is_file() and WEBUI_DIST.resolve() in candidate.parents:
        return FileResponse(candidate)
    index = WEBUI_DIST / 'index.html'
    if index.is_file():
        return FileResponse(index)
    return PlainTextResponse('The web UI is not built yet. Run: cd webui && npm install && npm run build', 503)


def run(host='127.0.0.1', port=8080, open_browser=True):
    import uvicorn  # pylint: disable=import-outside-toplevel
    prepare_folders()
    url = 'http://%s:%d/' % ('localhost' if host in ('127.0.0.1', '0.0.0.0') else host, port)
    print('DeTT&CT web UI started at: ' + url)
    if open_browser and not os.getenv('DeTTECT_DOCKER_CONTAINER'):
        import webbrowser  # pylint: disable=import-outside-toplevel
        import threading  # pylint: disable=import-outside-toplevel
        threading.Timer(1.0, lambda: webbrowser.open_new_tab(url)).start()
    uvicorn.run(app, host=host, port=port, log_level='warning')


if __name__ == '__main__':
    run()
