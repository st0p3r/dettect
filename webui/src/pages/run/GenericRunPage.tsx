import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Field, PageHeader } from '@/components/common';
import { TagInput } from '@/components/TagInput';
import { RunLayout } from '@/components/run/RunCommon';
import { PLATFORMS, type Domain } from '@/lib/constants';

type Action = 'datasources' | 'mitigations' | 'platforms' | 'updates';

const ACTIONS: Record<Action, { label: string; description: string }> = {
  datasources: { label: 'Data source statistics', description: 'A sorted count of how many ATT&CK techniques are covered by each data source.' },
  mitigations: { label: 'Mitigation statistics', description: 'A sorted count of how many ATT&CK techniques are covered by each mitigation.' },
  platforms: { label: 'List platforms', description: 'The ATT&CK platforms that can be used for a domain.' },
  updates: { label: 'ATT&CK updates', description: 'A list of when techniques, groups or software were created or last modified in ATT&CK.' }
};

export function GenericRunPage() {
  const [action, setAction] = useState<Action>('datasources');
  const [domain, setDomain] = useState<'enterprise' | 'ics' | 'mobile'>('enterprise');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [updates, setUpdates] = useState<'techniques' | 'groups' | 'software'>('techniques');
  const [sort, setSort] = useState<'modified' | 'created'>('modified');

  const args = ['ge'];
  if (action === 'datasources') {
    args.push('-ds', domain);
    platforms.forEach((p) => args.push('-p', p));
  } else if (action === 'mitigations') args.push('-m', domain);
  else if (action === 'platforms') args.push('--list-platforms', domain);
  else args.push('-u', updates, '--sort', sort);

  return (
    <>
      <PageHeader title="ATT&CK statistics" icon={BarChart3} description="General statistics and information about MITRE ATT&CK." />
      <RunLayout title={ACTIONS[action].label} description={ACTIONS[action].description} args={args} jobTitle={ACTIONS[action].label} canRun runLabel="Show">
        <Field label="What do you want to see?">
          <ToggleGroup type="single" value={action} onValueChange={(v) => v && setAction(v as Action)}>
            {Object.entries(ACTIONS).map(([k, a]) => (
              <ToggleGroupItem key={k} value={k}>
                {a.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
        {action !== 'updates' && (
          <Field label="ATT&CK domain">
            <Select
              value={domain}
              onValueChange={(v) => {
                setDomain(v as typeof domain);
                setPlatforms([]);
              }}
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enterprise">Enterprise</SelectItem>
                <SelectItem value="ics">ICS</SelectItem>
                <SelectItem value="mobile">Mobile</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}
        {action === 'datasources' && (
          <Field label="Platforms" help="Only include data sources for these platforms (default: all).">
            <TagInput value={platforms} onChange={setPlatforms} options={PLATFORMS[(domain + '-attack') as Domain].filter((p) => p !== 'all')} allowCustom={false} addLabel="Add platform" />
          </Field>
        )}
        {action === 'updates' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <Select value={updates} onValueChange={(v) => setUpdates(v as typeof updates)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="techniques">Techniques</SelectItem>
                  <SelectItem value="groups">Groups</SelectItem>
                  <SelectItem value="software">Software</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Sort on">
              <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="modified">Modified date</SelectItem>
                  <SelectItem value="created">Creation date</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}
      </RunLayout>
    </>
  );
}
