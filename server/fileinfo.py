import re

REGEX_FILE_TYPE = re.compile(r'^file_type:\s*[\'"]?([\w-]+)', re.MULTILINE)
REGEX_NAME = re.compile(r'^name:\s*[\'"]?(.*?)[\'"]?\s*$', re.MULTILINE)
REGEX_VERSION = re.compile(r'^version:\s*([\d.]+)', re.MULTILINE)
REGEX_DOMAIN = re.compile(r'^domain:\s*([\w-]+)', re.MULTILINE)


def file_info(path):
    st = path.stat()
    item = {'name': path.name, 'size': st.st_size, 'modified': st.st_mtime, 'ext': path.suffix.lower().lstrip('.')}
    if item['ext'] in ('yaml', 'yml'):
        try:
            with open(path, encoding='utf-8', errors='replace') as f:
                head = f.read(4096)
            for key, regex in (('file_type', REGEX_FILE_TYPE), ('title', REGEX_NAME), ('version', REGEX_VERSION),
                               ('domain', REGEX_DOMAIN)):
                m = regex.search(head)
                if m:
                    item[key] = m.group(1)
        except OSError:
            pass
    elif item['ext'] == 'json':
        item['file_type'] = 'navigator-layer'
    elif item['ext'] == 'xlsx':
        item['file_type'] = 'excel'
    elif item['ext'] == 'html':
        item['file_type'] = 'graph'
    return item
