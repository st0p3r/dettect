export type Domain = 'enterprise-attack' | 'ics-attack' | 'mobile-attack';

export const DOMAINS: { value: Domain; label: string; short: 'enterprise' | 'ics' | 'mobile' }[] = [
  { value: 'enterprise-attack', label: 'Enterprise', short: 'enterprise' },
  { value: 'ics-attack', label: 'ICS', short: 'ics' },
  { value: 'mobile-attack', label: 'Mobile', short: 'mobile' }
];

export const FILE_TYPES = {
  'data-source-administration': { label: 'Data sources', version: 1.1, route: '/editor/data-sources' },
  'technique-administration': { label: 'Techniques', version: 1.2, route: '/editor/techniques' },
  'group-administration': { label: 'Groups', version: 1.0, route: '/editor/groups' }
} as const;

export type FileType = keyof typeof FILE_TYPES;

export const PLATFORMS: Record<Domain, string[]> = {
  'enterprise-attack': ['all', 'PRE', 'Windows', 'macOS', 'Linux', 'Office Suite', 'Identity Provider', 'SaaS', 'IaaS', 'Network Devices', 'Containers', 'ESXi'],
  'ics-attack': ['None'],
  'mobile-attack': ['all', 'Android', 'iOS']
};

export const DATA_QUALITY_DIMENSIONS = [
  { key: 'device_completeness', label: 'Device completeness' },
  { key: 'data_field_completeness', label: 'Data field completeness' },
  { key: 'timeliness', label: 'Timeliness' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'retention', label: 'Retention' }
] as const;

export const DATA_QUALITY_SCORES: Record<number, string> = { 0: 'None', 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very good', 5: 'Excellent' };
export const DETECTION_SCORES: Record<number, string> = { [-1]: 'None', 0: 'Forensics / context', 1: 'Basic', 2: 'Fair', 3: 'Good', 4: 'Very good', 5: 'Excellent' };
export const VISIBILITY_SCORES: Record<number, string> = { 0: 'None', 1: 'Minimal', 2: 'Medium', 3: 'Good', 4: 'Excellent' };

export interface DataQuality {
  device_completeness: number;
  data_field_completeness: number;
  timeliness: number;
  consistency: number;
  retention: number;
}

export interface DataSourceDetail {
  applicable_to: string[];
  date_registered: string | null;
  date_connected: string | null;
  products: string[];
  available_for_data_analytics: boolean;
  comment: string;
  data_quality: DataQuality;
  [key: string]: unknown;
}

export interface DataSource {
  data_source_name: string;
  data_source: DataSourceDetail[];
  [key: string]: unknown;
}

export interface System {
  applicable_to: string;
  platform: string[];
}

export interface DataSourceFile {
  version: number;
  file_type: 'data-source-administration';
  name: string;
  domain: Domain;
  notes?: string;
  systems: System[];
  data_sources: DataSource[];
  [key: string]: unknown;
}

export interface ScoreEntry {
  date: string | null;
  score: number;
  comment: string;
  auto_generated?: boolean;
  [key: string]: unknown;
}

export interface ScoreObject {
  applicable_to: string[];
  location?: string[];
  comment: string;
  score_logbook: ScoreEntry[];
  [key: string]: unknown;
}

export interface Technique {
  technique_id: string;
  technique_name: string;
  detection: ScoreObject[];
  visibility: ScoreObject[];
  [key: string]: unknown;
}

export interface TechniqueFile {
  version: number;
  file_type: 'technique-administration';
  name: string;
  domain: Domain;
  notes?: string;
  platform: string[];
  techniques: Technique[];
  [key: string]: unknown;
}

export interface Group {
  group_name: string;
  campaign: string;
  technique_id: string[];
  software_id: string[];
  enabled: boolean;
  [key: string]: unknown;
}

export interface GroupFile {
  version: number;
  file_type: 'group-administration';
  domain: Domain;
  notes?: string;
  platform: string[];
  groups: Group[];
  [key: string]: unknown;
}

export const emptyDataQuality = (): DataQuality => ({ device_completeness: 0, data_field_completeness: 0, timeliness: 0, consistency: 0, retention: 0 });

export const newDataSourceDetail = (applicableTo: string[] = ['all']): DataSourceDetail => ({
  applicable_to: applicableTo,
  date_registered: null,
  date_connected: null,
  products: [],
  available_for_data_analytics: false,
  comment: '',
  data_quality: emptyDataQuality()
});

export const newDataSource = (name: string): DataSource => ({ data_source_name: name, data_source: [newDataSourceDetail()] });

export const newDetection = (applicableTo: string[] = ['all']): ScoreObject => ({
  applicable_to: applicableTo,
  location: [],
  comment: '',
  score_logbook: [{ date: null, score: -1, comment: '' }]
});

export const newVisibility = (applicableTo: string[] = ['all']): ScoreObject => ({
  applicable_to: applicableTo,
  comment: '',
  score_logbook: [{ date: null, score: 0, comment: '', auto_generated: false }]
});

export const newTechnique = (id: string, name: string): Technique => ({
  technique_id: id,
  technique_name: name,
  detection: [newDetection()],
  visibility: [newVisibility()]
});

export const newGroup = (name: string, campaign = ''): Group => ({ group_name: name, campaign, technique_id: [], software_id: [], enabled: true });

export const NEW_FILES = {
  'data-source-administration': (): DataSourceFile => ({
    version: 1.1,
    file_type: 'data-source-administration',
    name: 'example',
    domain: 'enterprise-attack',
    systems: [{ applicable_to: 'default', platform: ['all'] }],
    data_sources: []
  }),
  'technique-administration': (): TechniqueFile => ({
    version: 1.2,
    file_type: 'technique-administration',
    name: 'example',
    domain: 'enterprise-attack',
    platform: ['all'],
    techniques: []
  }),
  'group-administration': (): GroupFile => ({
    version: 1.0,
    file_type: 'group-administration',
    domain: 'enterprise-attack',
    platform: ['all'],
    groups: []
  })
};
