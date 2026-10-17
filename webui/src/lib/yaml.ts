import yaml from 'js-yaml';
import {
  DOMAINS,
  FILE_TYPES,
  PLATFORMS,
  emptyDataQuality,
  newDetection,
  newVisibility,
  type DataSourceFile,
  type Domain,
  type FileType,
  type GroupFile,
  type ScoreObject,
  type TechniqueFile
} from './constants';

export type AnyFile = DataSourceFile | TechniqueFile | GroupFile;

export interface ParseResult<T> {
  doc: T;
  warnings: string[];
}

function toDateString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== 'number' || isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function fixPlatforms(platforms: unknown, domain: Domain, warnings: string[]): string[] {
  let list: unknown[] = platforms == null ? [] : Array.isArray(platforms) ? platforms : [platforms];
  const valid = PLATFORMS[domain];
  const result: string[] = [];
  for (const p of list) {
    const match = valid.find((v) => v.toLowerCase() === String(p).toLowerCase());
    if (match) result.push(match);
    else warnings.push(`Invalid platform '${p}' was removed.`);
  }
  return result;
}

function fixScoreObjects(items: unknown, kind: 'detection' | 'visibility', techniqueId: string, warnings: string[]): ScoreObject[] {
  const list = (items == null ? [kind === 'detection' ? newDetection() : newVisibility()] : Array.isArray(items) ? items : [items]) as ScoreObject[];
  const seen = new Set<string>();
  for (const obj of list) {
    if (!Array.isArray(obj.applicable_to)) obj.applicable_to = obj.applicable_to == null ? ['all'] : [String(obj.applicable_to)];
    if (kind === 'detection') obj.location = (Array.isArray(obj.location) ? obj.location : []).filter((l) => l !== '' && l != null);
    if (obj.comment == null) obj.comment = '';
    if (!Array.isArray(obj.score_logbook) || obj.score_logbook.length === 0) {
      obj.score_logbook = kind === 'detection' ? newDetection().score_logbook : newVisibility().score_logbook;
    }
    for (const s of obj.score_logbook) {
      s.date = toDateString(s.date);
      s.score = kind === 'detection' ? clamp(s.score, -1, 5, -1) : clamp(s.score, 0, 4, 0);
      if (s.comment == null) s.comment = '';
      if (kind === 'visibility' && typeof s.auto_generated !== 'boolean') s.auto_generated = false;
    }
    for (const a of obj.applicable_to) {
      if (seen.has(a)) warnings.push(`Duplicate applicable_to value '${a}' in the ${kind} of ${techniqueId}.`);
      seen.add(a);
    }
  }
  return list;
}

function fixDomain(doc: { domain?: string }, warnings: string[]): Domain {
  if (doc.domain == null) return 'enterprise-attack';
  if (!DOMAINS.some((d) => d.value === doc.domain)) {
    warnings.push(`Invalid domain '${doc.domain}', it was set to enterprise-attack.`);
    return 'enterprise-attack';
  }
  return doc.domain as Domain;
}

export function detectFileType(content: string): FileType | null {
  const m = content.match(/^file_type:\s*['"]?([\w-]+)/m);
  return m && m[1] in FILE_TYPES ? (m[1] as FileType) : null;
}

/**
 * Parse a YAML administration file and repair missing or invalid values, the same way as DeTT&CT expects them.
 */
export function parseAdministration(content: string, expected: FileType): ParseResult<AnyFile> {
  const raw = yaml.load(content) as Record<string, unknown>;
  if (!raw || typeof raw !== 'object') throw new Error('The file is not a valid YAML file.');
  if (raw.file_type !== expected) {
    throw new Error(`This is not a ${FILE_TYPES[expected].label.toLowerCase()} administration file (file_type: ${raw.file_type ?? 'missing'}).`);
  }
  const version = FILE_TYPES[expected].version;
  if (Number(raw.version) !== version) {
    throw new Error(
      `The file has version ${raw.version} but version ${version} is required. Run a health check or any analysis on the file to let DeTT&CT upgrade it.`
    );
  }
  const warnings: string[] = [];
  const domain = fixDomain(raw as { domain?: string }, warnings);
  raw.domain = domain;

  if (expected === 'data-source-administration') {
    const doc = raw as unknown as DataSourceFile;
    if (!Array.isArray(doc.systems)) doc.systems = [{ applicable_to: 'default', platform: ['all'] }];
    doc.systems.forEach((s, i) => {
      if (s.applicable_to == null) s.applicable_to = 'empty' + i;
      s.applicable_to = String(s.applicable_to);
      s.platform = fixPlatforms(s.platform, domain, warnings);
    });
    if (!Array.isArray(doc.data_sources)) doc.data_sources = [];
    const names = new Set<string>();
    for (const ds of doc.data_sources) {
      if (names.has(ds.data_source_name)) warnings.push(`Duplicate data source '${ds.data_source_name}'.`);
      names.add(ds.data_source_name);
      if (!Array.isArray(ds.data_source)) ds.data_source = ds.data_source ? [ds.data_source] : [];
      for (const d of ds.data_source) {
        if (!Array.isArray(d.applicable_to)) d.applicable_to = d.applicable_to == null ? ['all'] : [String(d.applicable_to)];
        if (!Array.isArray(d.products)) d.products = d.products ? [String(d.products)] : [];
        if (typeof d.available_for_data_analytics !== 'boolean') d.available_for_data_analytics = false;
        if (d.comment == null) d.comment = '';
        d.date_registered = toDateString(d.date_registered);
        d.date_connected = toDateString(d.date_connected);
        const dq = d.data_quality ?? emptyDataQuality();
        d.data_quality = {
          device_completeness: clamp(dq.device_completeness, 0, 5, 0),
          data_field_completeness: clamp(dq.data_field_completeness, 0, 5, 0),
          timeliness: clamp(dq.timeliness, 0, 5, 0),
          consistency: clamp(dq.consistency, 0, 5, 0),
          retention: clamp(dq.retention, 0, 5, 0)
        };
      }
    }
    return { doc, warnings };
  }

  if (expected === 'technique-administration') {
    const doc = raw as unknown as TechniqueFile;
    doc.platform = fixPlatforms(doc.platform, domain, warnings);
    if (!Array.isArray(doc.techniques)) doc.techniques = [];
    for (const t of doc.techniques) {
      t.technique_id = String(t.technique_id ?? '').toUpperCase();
      if (t.technique_name == null) t.technique_name = '';
      t.detection = fixScoreObjects(t.detection, 'detection', t.technique_id, warnings);
      t.visibility = fixScoreObjects(t.visibility, 'visibility', t.technique_id, warnings);
    }
    return { doc, warnings };
  }

  const doc = raw as unknown as GroupFile;
  doc.platform = fixPlatforms(doc.platform, domain, warnings);
  if (!Array.isArray(doc.groups)) doc.groups = [];
  for (const g of doc.groups) {
    if (g.group_name == null) g.group_name = 'empty';
    if (g.campaign == null) g.campaign = '';
    g.group_name = String(g.group_name);
    g.campaign = String(g.campaign);
    if (typeof g.enabled !== 'boolean') g.enabled = false;
    const tids = Array.isArray(g.technique_id) ? g.technique_id : [];
    g.technique_id = tids.map((t) => String(t).toUpperCase()).filter((t) => /^T\d{4}(\.\d{3})?$/.test(t));
    if (g.technique_id.length !== tids.length) warnings.push(`Invalid technique IDs were removed from group '${g.group_name}'.`);
    const sids = Array.isArray(g.software_id) ? g.software_id : [];
    g.software_id = sids.map((s) => String(s).toUpperCase()).filter((s) => /^S\d{4}$/.test(s));
  }
  return { doc, warnings };
}

function dateOrNull(value: string | null | undefined) {
  return value ? new Date(value + 'T00:00:00.000Z') : null;
}

/**
 * Serialize an administration file to YAML (dates are written as real YAML timestamps).
 */
export function serializeAdministration(source: AnyFile): string {
  const doc = structuredClone(source) as AnyFile;
  if (doc.file_type === 'data-source-administration') {
    doc.data_sources = doc.data_sources.filter((ds) => ds.data_source_name.trim() !== '');
    for (const ds of doc.data_sources) {
      for (const d of ds.data_source) {
        (d as Record<string, unknown>).date_registered = dateOrNull(d.date_registered);
        (d as Record<string, unknown>).date_connected = dateOrNull(d.date_connected);
      }
    }
  } else if (doc.file_type === 'technique-administration') {
    doc.techniques = doc.techniques.filter((t) => t.technique_id.trim() !== '');
    for (const t of doc.techniques) {
      for (const obj of [...t.detection, ...t.visibility]) {
        // remove empty score entries (without a date) when there is more than one
        if (obj.score_logbook.length > 1) obj.score_logbook = obj.score_logbook.filter((s) => s.date);
        for (const s of obj.score_logbook) (s as Record<string, unknown>).date = dateOrNull(s.date);
      }
    }
  } else {
    doc.groups = doc.groups.filter((g) => g.group_name.trim() !== '');
  }
  if (doc.notes === '') delete doc.notes;
  return yaml.dump(doc, { lineWidth: 2000, noRefs: true });
}

export function validateAdministration(doc: AnyFile): string[] {
  const errors: string[] = [];
  if (doc.file_type !== 'data-source-administration' && doc.platform.length === 0) errors.push('Select at least one platform.');
  if (doc.file_type === 'data-source-administration' && doc.systems.length === 0) errors.push('Add at least one system.');
  return errors;
}
