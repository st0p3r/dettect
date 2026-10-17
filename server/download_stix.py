"""
Downloads the MITRE ATT&CK STIX data (enterprise, ics and mobile) to a local folder, so DeTT&CT can be used
offline or without access to MITRE's TAXII server.
Usage: python -m server.download_stix <target_folder>
"""
import os
import sys
import urllib.request

BASE_URL = 'https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/'
FILES = ['index.json', 'enterprise-attack/enterprise-attack.json', 'ics-attack/ics-attack.json',
         'mobile-attack/mobile-attack.json']


def download(target):
    for f in FILES:
        dest = os.path.join(target, f)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        print('Downloading %s ...' % (BASE_URL + f))
        tmp = dest + '.part'
        with urllib.request.urlopen(BASE_URL + f, timeout=120) as response, open(tmp, 'wb') as out:
            size = 0
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)
                size += len(chunk)
        os.replace(tmp, dest)
        print('  done (%.1f MB)' % (size / 1024 / 1024))
    print('ATT&CK STIX data is stored in: ' + target)


if __name__ == '__main__':
    try:
        download(sys.argv[1])
    except Exception as e:  # pylint: disable=broad-except
        print('[!] Download failed: %s' % e)
        sys.exit(1)
