import { useEffect, useState } from 'react';
import { api } from './api';
import type { Domain } from './constants';

export interface AttackTechnique {
  technique_id: string;
  technique_name: string;
  platforms: string[];
  tactics?: string[];
  data_sources?: string[];
}

export interface AttackSoftware {
  software_id: string;
  software_name: string;
  platforms: string[];
}

export interface AttackTactic {
  id: string;
  shortname: string;
  name: string;
}

export interface AttackData {
  domain: Domain;
  attack_version?: string;
  /** where the data comes from: the configured ATT&CK source, or the list built into the web interface */
  source: 'local' | 'online' | 'builtin';
  techniques: AttackTechnique[];
  tactics: AttackTactic[];
  software: AttackSoftware[];
  data_sources: string[];
  data_source_platforms: Record<string, string[]>;
  dettect_data_source_platforms: Record<string, string[]>;
}

const SHORT: Record<Domain, 'enterprise' | 'ics' | 'mobile'> = { 'enterprise-attack': 'enterprise', 'ics-attack': 'ics', 'mobile-attack': 'mobile' };
const KEY: Record<Domain, string> = { 'enterprise-attack': 'Enterprise', 'ics-attack': 'ICS', 'mobile-attack': 'Mobile' };

/**
 * The ATT&CK lists that are built into the web interface. Only used when the ATT&CK data can't be loaded from the
 * server (e.g. no internet access and no downloaded ATT&CK data).
 */
async function builtin(domain: Domain): Promise<AttackData> {
  const [techniques, software, dataSources, dettectDataSources, platforms] = await Promise.all([
    import('@/data/techniques.json'),
    import('@/data/software.json'),
    import('@/data/data_sources.json'),
    import('@/data/dettect_data_sources.json'),
    import('@/data/data_source_platforms.json')
  ]);
  const key = KEY[domain];
  const dsp = platforms.default as Record<string, Record<string, string[]>>;
  return {
    domain,
    source: 'builtin',
    techniques: (techniques.default as Record<string, AttackTechnique[]>)['ATT&CK-' + key] ?? [],
    tactics: [],
    software: (software.default as Record<string, AttackSoftware[]>)['ATT&CK-' + key] ?? [],
    data_sources: [...((dataSources.default as Record<string, string[]>)['ATT&CK-' + key] ?? []), ...(domain === 'enterprise-attack' ? (dettectDataSources.default as string[]) : [])],
    data_source_platforms: dsp['ATT&CK-' + key] ?? {},
    dettect_data_source_platforms: dsp['DeTT&CT-' + key] ?? {}
  };
}

const cache = new Map<Domain, Promise<AttackData>>();

export function loadAttackData(domain: Domain): Promise<AttackData> {
  let promise = cache.get(domain);
  if (!promise) {
    promise = api
      .editorData(SHORT[domain])
      .then((d) => d as AttackData)
      .catch(() => builtin(domain));
    cache.set(domain, promise);
    // retry the server next time when it failed (e.g. after downloading the ATT&CK data)
    promise.then((d) => d.source === 'builtin' && cache.delete(domain));
  }
  return promise;
}

/** Forget the loaded ATT&CK data, e.g. after the ATT&CK source was changed in the settings. */
export function resetAttackData() {
  cache.clear();
}

/**
 * The ATT&CK data of a domain, loaded from the configured ATT&CK source (with the built-in list as fallback).
 */
export function useAttackData(domain: Domain | undefined) {
  const [data, setData] = useState<AttackData | null>(null);
  useEffect(() => {
    if (!domain) return;
    let active = true;
    loadAttackData(domain).then((d) => active && setData(d));
    return () => {
      active = false;
    };
  }, [domain]);
  return data && data.domain === domain ? data : null;
}

export function techniqueMap(data: AttackData | null) {
  return new Map((data?.techniques ?? []).map((t) => [t.technique_id, t]));
}

/**
 * All ATT&CK (and DeTT&CT) data sources that apply to the given platforms.
 */
export function getDataSources(data: AttackData | null, platforms: string[]): string[] {
  if (!data) return [];
  const anyPlatform = platforms.includes('all') || platforms.length === 0;
  const result = new Set<string>();
  for (const [platform, sources] of Object.entries(data.data_source_platforms)) {
    if (anyPlatform || platforms.includes(platform)) sources.forEach((s) => result.add(s));
  }
  if (anyPlatform) data.data_sources.forEach((s) => result.add(s));
  // DeTT&CT data sources are only available for Enterprise ATT&CK
  if (data.domain === 'enterprise-attack') {
    for (const [platform, sources] of Object.entries(data.dettect_data_source_platforms)) {
      if (anyPlatform || platforms.includes(platform)) sources.forEach((s) => result.add(s));
    }
  }
  return Array.from(result).sort();
}

export function attackSourceLabel(data: AttackData | null) {
  if (!data) return 'loading ATT&CK data...';
  if (data.source === 'builtin') return 'built-in ATT&CK list (ATT&CK data could not be loaded)';
  return `ATT&CK v${data.attack_version} · ${data.source === 'local' ? 'local data' : "MITRE's TAXII server"}`;
}
