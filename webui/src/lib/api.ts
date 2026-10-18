export type Dir = 'input' | 'output';

export interface FileInfo {
  name: string;
  size: number;
  modified: number;
  ext: string;
  file_type?: string;
  title?: string;
  version?: string;
  domain?: string;
}

export interface JobFile {
  dir: Dir;
  name: string;
  new: boolean;
  file_type?: string;
}

export interface Job {
  id: string;
  title: string;
  argv: string[];
  command: string;
  status: 'queued' | 'running' | 'finished' | 'failed' | 'cancelled';
  exit_code: number | null;
  created: number;
  started: number | null;
  ended: number | null;
  files: JobFile[];
  output?: string;
}

export interface Info {
  version: string;
  attack_version: string;
  navigator_version: string;
  layer_version: string;
  file_versions: Record<string, number>;
  platforms: Record<'enterprise' | 'ics' | 'mobile', string[]>;
  layer_settings: Record<string, string[]>;
  stix_dir: string;
  stix_downloaded: boolean;
  cache_files: number;
  sample_files: string[];
}

export interface Settings {
  stix_source: 'online' | 'local';
  local_stix_path: string;
  ignore_verify_tls: boolean;
}

export interface AttackGroup {
  id: string;
  name: string;
  aliases?: string[];
  domains: string[];
}

export interface CoverageSummary {
  covered: number;
  percentage: number;
  distribution: Record<string, number>;
}

export interface CoverageTechnique {
  technique_id: string;
  technique_name: string;
  tactics: string[];
  visibility: number;
  detection: number;
}

export interface Coverage {
  file: string;
  name: string;
  domain: string;
  platforms: string[];
  attack_version: string;
  attack_source: string;
  include_subtechniques: boolean;
  scope: number;
  administrated: number;
  administrated_in_scope: number;
  unknown_techniques: string[];
  visibility: CoverageSummary;
  detection: CoverageSummary;
  tactics: { id: string; shortname: string; name: string; total: number; visibility: number; detection: number }[];
  trend: { month: string; visibility: number; detection: number }[];
  undated_scores: number;
  quick_wins: CoverageTechnique[];
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = body.detail || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const type = res.headers.get('content-type') || '';
  return (type.includes('application/json') ? res.json() : res.text()) as Promise<T>;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

export const fileUrl = (dir: Dir, name: string, download = false) =>
  `/api/files/${dir}/${encodeURIComponent(name)}${download ? '?download=true' : ''}`;

export const api = {
  info: () => request<Info>('/api/info'),
  settings: () => request<Settings>('/api/settings'),
  saveSettings: (s: Settings) => request<Settings>('/api/settings', json('PUT', s)),
  clearCache: () => request<{ removed: number }>('/api/cache/clear', { method: 'POST' }),
  downloadStix: () => request<Job>('/api/stix/download', { method: 'POST' }),

  files: (dir: Dir) => request<FileInfo[]>(`/api/files/${dir}`),
  readFile: async (dir: Dir, name: string) => {
    const res = await fetch(fileUrl(dir, name));
    if (!res.ok) throw new Error(`Could not read '${name}'`);
    return res.text();
  },
  writeFile: (dir: Dir, name: string, content: string, overwrite = true) =>
    request<FileInfo>(`/api/files/${dir}/${encodeURIComponent(name)}?overwrite=${overwrite}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: content
    }),
  upload: (dir: Dir, files: FileList | File[]) => {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('files', f));
    return request<FileInfo[]>(`/api/files/${dir}`, { method: 'POST', body: fd });
  },
  deleteFile: (dir: Dir, name: string) => request(`/api/files/${dir}/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  fileAction: (dir: Dir | 'sample', name: string, action: 'rename' | 'copy' | 'copy-to-input' | 'import-sample', target = '') =>
    request<FileInfo>(`/api/files/${dir}/${encodeURIComponent(name)}/action`, json('POST', { action, target })),

  jobs: () => request<Job[]>('/api/jobs'),
  job: (id: string) => request<Job>(`/api/jobs/${id}`),
  runJob: (title: string, args: string[]) => request<Job>('/api/jobs', json('POST', { title, args })),
  jobInput: (id: string, text: string) => request(`/api/jobs/${id}/input`, json('POST', { text })),
  cancelJob: (id: string) => request<Job>(`/api/jobs/${id}/cancel`, { method: 'POST' }),
  clearJobs: () => request('/api/jobs', { method: 'DELETE' }),

  attack: (kind: 'groups' | 'campaigns') => request<AttackGroup[]>(`/api/attack/${kind}`),
  editorData: (domain: 'enterprise' | 'ics' | 'mobile') => request<unknown>(`/api/attack/editor-data/${domain}`),
  coverage: (name: string, subtechniques = true) => request<Coverage>(`/api/coverage/${encodeURIComponent(name)}?subtechniques=${subtechniques}`)
};
