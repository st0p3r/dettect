from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INPUT_DIR = ROOT / 'input'
OUTPUT_DIR = ROOT / 'output'
CACHE_DIR = ROOT / 'cache'
STIX_DIR = ROOT / 'stix-data'
SETTINGS_FILE = ROOT / 'settings.json'
WEBUI_DIST = ROOT / 'webui' / 'dist'


def prepare_folders():
    for d in (INPUT_DIR, OUTPUT_DIR, CACHE_DIR):
        d.mkdir(exist_ok=True)
