import techniques from '@/data/techniques.json';
import software from '@/data/software.json';
import dataSources from '@/data/data_sources.json';
import dettectDataSources from '@/data/dettect_data_sources.json';
import dataSourcePlatforms from '@/data/data_source_platforms.json';
import type { Domain } from './constants';

export interface AttackTechnique {
  technique_id: string;
  technique_name: string;
  platforms: string[];
}

export interface AttackSoftware {
  software_id: string;
  software_name: string;
  platforms: string[];
}

const KEY: Record<Domain, string> = { 'enterprise-attack': 'Enterprise', 'ics-attack': 'ICS', 'mobile-attack': 'Mobile' };

export function getTechniques(domain: Domain): AttackTechnique[] {
  return (techniques as Record<string, AttackTechnique[]>)['ATT&CK-' + KEY[domain]] ?? [];
}

export function getSoftware(domain: Domain): AttackSoftware[] {
  return (software as Record<string, AttackSoftware[]>)['ATT&CK-' + KEY[domain]] ?? [];
}

export function techniqueMap(domain: Domain) {
  return new Map(getTechniques(domain).map((t) => [t.technique_id, t]));
}

/**
 * All ATT&CK (and DeTT&CT) data sources that apply to the given platforms.
 */
export function getDataSources(domain: Domain, platforms: string[]): string[] {
  const all = (dataSources as Record<string, string[]>)['ATT&CK-' + KEY[domain]] ?? [];
  const perPlatformAttack = (dataSourcePlatforms as Record<string, Record<string, string[]>>)['ATT&CK-' + KEY[domain]] ?? {};
  const perPlatformDettect = (dataSourcePlatforms as Record<string, Record<string, string[]>>)['DeTT&CT-' + KEY[domain]] ?? {};
  const result = new Set<string>();
  const anyPlatform = platforms.includes('all') || platforms.length === 0;
  for (const ds of all) {
    if (anyPlatform || platforms.some((p) => perPlatformAttack[p]?.includes(ds))) result.add(ds);
  }
  // DeTT&CT data sources are only available for Enterprise ATT&CK
  if (domain === 'enterprise-attack') {
    for (const ds of dettectDataSources as string[]) {
      if (anyPlatform || platforms.some((p) => perPlatformDettect[p]?.includes(ds))) result.add(ds);
    }
  }
  return Array.from(result).sort();
}
