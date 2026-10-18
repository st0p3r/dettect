"""
ATT&CK data for the web interface (suggestions in the editors and the coverage dashboard).

The data is read from the same ATT&CK source as the analyses (MITRE's TAXII server or the local STIX data, depending on
the settings), so the editors always match the ATT&CK version that DeTT&CT uses. Building it takes a while, so the
result is cached in memory and in the 'cache' folder until the ATT&CK source changes.
"""
import datetime
import json
import os
import threading
import time

from server.paths import CACHE_DIR, ROOT

CACHE_VERSION = 1
DOMAINS = {'enterprise': 'enterprise-attack', 'ics': 'ics-attack', 'mobile': 'mobile-attack'}
_memory_cache = {}
_lock = threading.Lock()


def _signature(settings):
    """
    Identifies the ATT&CK source: the cached data is rebuilt when this changes.
    """
    if settings['stix_source'] == 'local' and settings['local_stix_path']:
        path = settings['local_stix_path']
        if not os.path.isabs(path):
            path = os.path.join(ROOT, path)
        mtimes = []
        for d in DOMAINS.values():
            f = os.path.join(path, d, d + '.json')
            mtimes.append(os.path.getmtime(f) if os.path.exists(f) else 0)
        return 'local:%s:%s' % (os.path.abspath(path), ','.join('%d' % m for m in mtimes))
    return 'online'


def _client(settings):
    import generic  # pylint: disable=import-outside-toplevel
    from attack_taxii_client import attack_client  # pylint: disable=import-outside-toplevel
    if settings['stix_source'] == 'local' and settings['local_stix_path']:
        path = settings['local_stix_path']
        return attack_client(local_path=path if os.path.isabs(path) else os.path.join(ROOT, path))
    generic.verify_tls = not settings['ignore_verify_tls']
    return attack_client(verify=not settings['ignore_verify_tls'])


def _attack_id(obj):
    for ref in obj.get('external_references', []):
        if ref.get('source_name') in ('mitre-attack', 'mitre-mobile-attack', 'mitre-ics-attack'):
            return ref.get('external_id')
    return None


def _build(domain, settings):
    import generic  # pylint: disable=import-outside-toplevel
    from stix2 import Filter  # pylint: disable=import-outside-toplevel
    from constants import (DATA_SOURCES_ENTERPRISE, DATA_SOURCES_ICS, DATA_SOURCES_MOBILE,  # pylint: disable=import-outside-toplevel
                           DETTECT_DATA_SOURCES_PLATFORMS_ENTERPRISE, DETTECT_DATA_SOURCES_PLATFORMS_ICS,
                           DETTECT_DATA_SOURCES_PLATFORMS_MOBILE, ATTACK_VERSION)

    mitre = _client(settings)
    source = {'enterprise': mitre.enterprise_source, 'ics': mitre.ics_source, 'mobile': mitre.mobile_source}[domain]
    stix_techniques = {'enterprise': mitre.get_enterprise_techniques, 'ics': mitre.get_ics_techniques,
                       'mobile': mitre.get_mobile_techniques}[domain]()

    techniques = []
    for t in generic._convert_stix_techniques_to_dict(mitre, stix_techniques):  # pylint: disable=protected-access
        techniques.append({
            'technique_id': t['technique_id'],
            'technique_name': t['name'],
            'platforms': sorted(t.get('x_mitre_platforms', [])),
            'tactics': generic.get_tactics(t),
            'data_sources': sorted(set(t.get('data_components', [])) | set(t.get('dettect_data_sources', []))),
        })
    techniques.sort(key=lambda x: x['technique_id'])

    # tactics in the order of the ATT&CK matrix
    tactics_by_id = {t['id']: t for t in mitre.remove_revoked_deprecated(source.query(Filter('type', '=', 'x-mitre-tactic')))}
    tactics = []
    for matrix in source.query(Filter('type', '=', 'x-mitre-matrix')):
        for ref in matrix.get('tactic_refs', []):
            tactic = tactics_by_id.get(ref)
            if tactic and not any(x['shortname'] == tactic['x_mitre_shortname'] for x in tactics):
                tactics.append({'id': _attack_id(tactic), 'shortname': tactic['x_mitre_shortname'], 'name': tactic['name']})

    software = []
    domain_name = DOMAINS[domain]
    for s in mitre.get_software():
        if domain_name in s.get('x_mitre_domains', [domain_name]):
            software.append({'software_id': _attack_id(s), 'software_name': s['name'],
                             'platforms': sorted(s.get('x_mitre_platforms', []))})
    software.sort(key=lambda x: x['software_id'] or '')

    # the data sources per platform are the same as used by DeTT&CT for the analyses
    attack_ds = {'enterprise': DATA_SOURCES_ENTERPRISE, 'ics': DATA_SOURCES_ICS, 'mobile': DATA_SOURCES_MOBILE}[domain]
    dettect_ds = {'enterprise': DETTECT_DATA_SOURCES_PLATFORMS_ENTERPRISE, 'ics': DETTECT_DATA_SOURCES_PLATFORMS_ICS,
                  'mobile': DETTECT_DATA_SOURCES_PLATFORMS_MOBILE}[domain]
    all_ds = sorted({ds for values in attack_ds.values() for ds in values})

    return {
        'domain': domain_name,
        'attack_version': ATTACK_VERSION,
        'source': 'local' if settings['stix_source'] == 'local' and settings['local_stix_path'] else 'online',
        'created': time.time(),
        'techniques': techniques,
        'tactics': tactics,
        'software': software,
        'data_sources': all_ds,
        'data_source_platforms': attack_ds,
        'dettect_data_source_platforms': dettect_ds,
    }


def get_attack_data(domain, settings):
    """
    Get the ATT&CK data for a domain ('enterprise', 'ics' or 'mobile'), from the cache when possible.
    """
    if domain not in DOMAINS:
        raise ValueError('Unknown domain')
    signature = _signature(settings)
    key = (domain, signature)
    with _lock:
        if key in _memory_cache:
            return _memory_cache[key]
        cache_file = CACHE_DIR / ('webui-attack-%s.json' % domain)
        if cache_file.exists():
            try:
                cached = json.loads(cache_file.read_text())
                fresh = signature != 'online' or time.time() - cached['data']['created'] < 60 * 60 * 24 * 30
                if cached.get('version') == CACHE_VERSION and cached.get('signature') == signature and fresh:
                    _memory_cache[key] = cached['data']
                    return cached['data']
            except (ValueError, KeyError):
                pass
        data = _build(domain, settings)
        CACHE_DIR.mkdir(exist_ok=True)
        cache_file.write_text(json.dumps({'version': CACHE_VERSION, 'signature': signature, 'data': data}))
        _memory_cache[key] = data
        return data


def clear_memory_cache():
    with _lock:
        _memory_cache.clear()


# ---------------------------------------------------------------------------------------------------------------------
# Coverage
# ---------------------------------------------------------------------------------------------------------------------
def _to_date(value):
    if isinstance(value, datetime.datetime):
        return value.date()
    if isinstance(value, datetime.date):
        return value
    if isinstance(value, str) and value:
        try:
            return datetime.date.fromisoformat(value[:10])
        except ValueError:
            return None
    return None


def _score_history(score_object):
    """
    The score logbook of a visibility/detection object as a list of (date, score), oldest first. Entries without a
    date are put first (so a dated entry is always more recent).
    """
    entries = score_object.get('score_logbook') or []
    if isinstance(entries, dict):
        entries = [entries]
    history = []
    for e in entries:
        if isinstance(e, dict) and isinstance(e.get('score'), (int, float)):
            history.append((_to_date(e.get('date')), e['score']))
    history.sort(key=lambda x: (x[0] is not None, x[0] or datetime.date.min))
    return history


def _score_at(histories, default, at=None):
    """
    The highest score of a technique over all its visibility/detection objects. With 'at', only scores with a date
    on or before that date count.
    """
    best = default
    for history in histories:
        current = None
        for date, score in history:
            if at is None or (date is not None and date <= at):
                current = score
        if current is not None:
            best = max(best, current)
    return best


def _months(start, end):
    months = []
    y, m = start.year, start.month
    while (y, m) <= (end.year, end.month):
        months.append((y, m))
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return months


def _month_end(y, m):
    nxt = datetime.date(y + 1, 1, 1) if m == 12 else datetime.date(y, m + 1, 1)
    return nxt - datetime.timedelta(days=1)


def compute_coverage(technique_file, settings, include_subtechniques=True):
    """
    Coverage statistics of a technique administration file compared with ATT&CK.
    """
    from generic import init_yaml  # pylint: disable=import-outside-toplevel

    with open(technique_file, 'r') as f:
        content = init_yaml().load(f)

    domain_name = content.get('domain') or 'enterprise-attack'
    domain = next(k for k, v in DOMAINS.items() if v == domain_name)
    attack = get_attack_data(domain, settings)

    platforms = content.get('platform') or ['all']
    if isinstance(platforms, str):
        platforms = [platforms]
    platforms_lower = {p.lower() for p in platforms}
    # ATT&CK ICS has no platforms in DeTT&CT (the only value is 'None'), so all ICS techniques are in scope
    all_platforms = domain == 'ics' or 'all' in platforms_lower

    scope = [t for t in attack['techniques']
             if (include_subtechniques or '.' not in t['technique_id'])
             and (all_platforms or any(p.lower() in platforms_lower for p in t['platforms']))]
    scope_ids = {t['technique_id'] for t in scope}
    attack_ids = {t['technique_id'] for t in attack['techniques']}

    administrated = {}
    for t in content.get('techniques') or []:
        tid = str(t.get('technique_id', '')).upper()
        entry = administrated.setdefault(tid, {'visibility': [], 'detection': []})
        for kind in ('visibility', 'detection'):
            objs = t.get(kind) or []
            if isinstance(objs, dict):
                objs = [objs]
            entry[kind].extend(_score_history(o) for o in objs if isinstance(o, dict))

    rows = []
    for t in scope:
        a = administrated.get(t['technique_id'], {'visibility': [], 'detection': []})
        rows.append({
            'technique_id': t['technique_id'],
            'technique_name': t['technique_name'],
            'tactics': t['tactics'],
            'data_sources': t['data_sources'],
            'visibility': _score_at(a['visibility'], 0),
            'detection': _score_at(a['detection'], -1),
            'histories': a,
        })

    def summary(kind, threshold, levels):
        dist = {str(level): 0 for level in levels}
        for r in rows:
            dist[str(int(r[kind]))] = dist.get(str(int(r[kind])), 0) + 1
        covered = sum(1 for r in rows if r[kind] >= threshold)
        return {'covered': covered, 'percentage': round(100 * covered / len(rows), 1) if rows else 0,
                'distribution': dist}

    tactics = []
    for tactic in attack['tactics']:
        in_tactic = [r for r in rows if tactic['shortname'] in r['tactics']]
        tactics.append({
            'id': tactic['id'], 'shortname': tactic['shortname'], 'name': tactic['name'], 'total': len(in_tactic),
            'visibility': sum(1 for r in in_tactic if r['visibility'] >= 1),
            'detection': sum(1 for r in in_tactic if r['detection'] >= 1),
        })

    # trend per month, based on the dates in the score logbooks
    dates = [d for r in rows for kind in ('visibility', 'detection') for h in r['histories'][kind] for d, _ in h if d]
    trend = []
    if dates:
        today = datetime.date.today()
        for y, m in _months(min(dates), max(max(dates), today)):
            end = _month_end(y, m)
            trend.append({
                'month': '%04d-%02d' % (y, m),
                'visibility': sum(1 for r in rows if _score_at(r['histories']['visibility'], 0, end) >= 1),
                'detection': sum(1 for r in rows if _score_at(r['histories']['detection'], -1, end) >= 1),
            })
    undated = sum(1 for r in rows for kind in ('visibility', 'detection') for h in r['histories'][kind]
                  for d, s in h if d is None and s > (0 if kind == 'visibility' else -1))

    quick_wins = sorted((r for r in rows if r['visibility'] >= 2 and r['detection'] < 1),
                        key=lambda r: (-r['visibility'], r['technique_id']))

    return {
        'file': os.path.basename(technique_file),
        'name': content.get('name', ''),
        'domain': domain_name,
        'platforms': platforms,
        'attack_version': attack['attack_version'],
        'attack_source': attack['source'],
        'include_subtechniques': include_subtechniques,
        'scope': len(rows),
        'administrated': len(administrated),
        'administrated_in_scope': len(scope_ids & set(administrated)),
        'unknown_techniques': sorted(set(administrated) - attack_ids),
        'visibility': summary('visibility', 1, range(0, 5)),
        'detection': summary('detection', 1, range(-1, 6)),
        'tactics': tactics,
        'trend': trend,
        'undated_scores': undated,
        'quick_wins': [{k: r[k] for k in ('technique_id', 'technique_name', 'tactics', 'visibility', 'detection')}
                       for r in quick_wins],
    }
