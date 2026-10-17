import { useMemo, useState } from 'react';
import { AlertTriangle, Swords } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Field, HelpTip, PageHeader } from '@/components/common';
import { TagInput, type TagOption } from '@/components/TagInput';
import { CommonOptionsEditor, RunLayout, commonArgs, defaultCommon, useFileParam } from '@/components/run/RunCommon';
import { useAsync } from '@/hooks/use-async';
import { api } from '@/lib/api';
import { PLATFORMS, type Domain } from '@/lib/constants';

type OverlayType = 'group' | 'campaign' | 'visibility' | 'detection';

export function GroupRunPage() {
  const [fileParam] = useFileParam();
  const [groups, setGroups] = useState<string[]>(fileParam ? ['input/' + fileParam] : []);
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [domain, setDomain] = useState<string>('');
  const [overlayType, setOverlayType] = useState<OverlayType>('group');
  const [overlay, setOverlay] = useState<string[]>([]);
  const [software, setSoftware] = useState<'none' | 'software' | 'include'>('none');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [searchVis, setSearchVis] = useState('');
  const [searchDet, setSearchDet] = useState('');
  const [allScores, setAllScores] = useState(false);
  const [countDetections, setCountDetections] = useState(false);
  const [common, setCommon] = useState(defaultCommon());

  const files = useAsync(() => api.files('input'), []);
  const attackGroups = useAsync(() => api.attack('groups'), []);
  const attackCampaigns = useAsync(() => api.attack('campaigns'), []);

  const groupFiles: TagOption[] = (files.data ?? []).filter((f) => f.file_type === 'group-administration').map((f) => ({ value: 'input/' + f.name, label: f.name, hint: 'my file' }));
  const techniqueFiles: TagOption[] = (files.data ?? []).filter((f) => f.file_type === 'technique-administration').map((f) => ({ value: 'input/' + f.name, label: f.name, hint: 'my file' }));
  const groupOptions: TagOption[] = useMemo(
    () => [...groupFiles, ...(attackGroups.data ?? []).map((g) => ({ value: g.name, label: `${g.id} ${g.name}`, hint: g.aliases?.slice(0, 2).join(', ') }))],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files.data, attackGroups.data]
  );
  const campaignOptions: TagOption[] = useMemo(() => (attackCampaigns.data ?? []).map((c) => ({ value: c.name, label: `${c.id} ${c.name}` })), [attackCampaigns.data]);
  const overlayOptions = overlayType === 'group' ? groupOptions : overlayType === 'campaign' ? campaignOptions : techniqueFiles;
  const platformOptions = PLATFORMS[(domain ? domain + '-attack' : 'enterprise-attack') as Domain].filter((p) => p !== 'all');

  const args = ['g'];
  groups.forEach((g) => args.push('-g', g));
  campaigns.forEach((c) => args.push('-c', c));
  if (domain) args.push('-d', domain);
  overlay.forEach((o) => args.push('-o', o));
  if (overlay.length && overlayType !== 'group') args.push('-t', overlayType);
  if (software === 'software') args.push('--software');
  if (software === 'include') args.push('--include-software');
  platforms.forEach((p) => args.push('-p', p));
  if (searchVis.trim()) args.push('-sv', searchVis.trim());
  if (searchDet.trim()) args.push('-sd', searchDet.trim());
  if (allScores) args.push('--all-scores');
  if (countDetections) args.push('-cd');
  args.push(...commonArgs(common));

  const coverageOverlay = overlayType === 'visibility' || overlayType === 'detection';

  return (
    <>
      <PageHeader
        title="Threat groups"
        icon={Swords}
        description="Create heat maps of threat actor groups and campaigns (from ATT&CK or your own group files), compare them with each other, or compare them with your visibility and detection coverage."
      />
      {attackGroups.error && (
        <Alert variant="warning" className="mb-4">
          <AlertTriangle />
          <AlertDescription>Could not load the ATT&CK groups for suggestions ({attackGroups.error.message}). You can still type group names, IDs or aliases.</AlertDescription>
        </Alert>
      )}
      <RunLayout title="Options" args={args} jobTitle={`Groups: ${groups.join(', ') || campaigns.join(', ') || 'all'}`} canRun={!coverageOverlay || overlay.length > 0} runLabel="Generate heat map">
        <Field label="Groups" help="ATT&CK groups (ID, name or alias) or your own group YAML file(s). When no group or campaign is given, all groups are used.">
          <TagInput value={groups} onChange={setGroups} options={groupOptions} addLabel="Add group" placeholder="Search groups or type an ID / alias..." />
        </Field>
        <Field label="Campaigns" help="ATT&CK campaigns (ID or name). Complements the groups.">
          <TagInput value={campaigns} onChange={setCampaigns} options={campaignOptions} addLabel="Add campaign" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ATT&CK domain" help="Ignored when a domain is specified in a group YAML file.">
            <Select value={domain || '__default__'} onValueChange={(v) => setDomain(v === '__default__' ? '' : v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">Default (enterprise)</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
                <SelectItem value="ics">ICS</SelectItem>
                <SelectItem value="mobile">Mobile</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Platforms" help="Default: all platforms.">
            <TagInput value={platforms} onChange={setPlatforms} options={platformOptions} allowCustom={false} addLabel="Add platform" />
          </Field>
        </div>
        <div className="grid gap-3 rounded-lg border p-4">
          <Field label="Overlay" help="Compare the groups above with other groups, campaigns, or with your visibility / detection coverage from a technique file.">
            <ToggleGroup
              type="single"
              value={overlayType}
              onValueChange={(v) => {
                if (!v) return;
                setOverlayType(v as OverlayType);
                setOverlay([]);
              }}
            >
              <ToggleGroupItem value="group">Groups</ToggleGroupItem>
              <ToggleGroupItem value="campaign">Campaigns</ToggleGroupItem>
              <ToggleGroupItem value="visibility">Visibility</ToggleGroupItem>
              <ToggleGroupItem value="detection">Detection</ToggleGroupItem>
            </ToggleGroup>
          </Field>
          <TagInput
            value={overlay}
            onChange={(v) => setOverlay(coverageOverlay ? v.slice(-1) : v)}
            options={overlayOptions}
            allowCustom={!coverageOverlay}
            addLabel={coverageOverlay ? 'Select technique file' : `Add ${overlayType}`}
          />
          {coverageOverlay && overlay.length === 0 && <p className="text-xs text-muted-foreground">Select the technique administration file with your {overlayType} scores.</p>}
          {coverageOverlay && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="EQL search on visibility">
                <Input value={searchVis} onChange={(e) => setSearchVis(e.target.value)} placeholder="techniques where visibility.score_logbook.score >= 2" className="font-mono text-xs" />
              </Field>
              <Field label="EQL search on detection">
                <Input value={searchDet} onChange={(e) => setSearchDet(e.target.value)} placeholder="techniques where detection.score_logbook.score >= 2" className="font-mono text-xs" />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={allScores} onCheckedChange={setAllScores} /> Search all scores in the score logbook
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={countDetections} onCheckedChange={setCountDetections} /> Count detections
              </label>
            </div>
          )}
        </div>
        <Field label="Software" help="Techniques supported by the software used by the groups/campaigns can be added to the heat map.">
          <ToggleGroup type="single" value={software} onValueChange={(v) => v && setSoftware(v as typeof software)}>
            <ToggleGroupItem value="none">Ignore software</ToggleGroupItem>
            <ToggleGroupItem value="software">Add (don't count in scores)</ToggleGroupItem>
            <ToggleGroupItem value="include">Include in scores</ToggleGroupItem>
          </ToggleGroup>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            Software techniques <HelpTip>'Add' marks techniques that software supports without influencing scores. 'Include' adds them to the scores.</HelpTip>
          </span>
        </Field>
        <CommonOptionsEditor value={common} onChange={setCommon} />
      </RunLayout>
    </>
  );
}
