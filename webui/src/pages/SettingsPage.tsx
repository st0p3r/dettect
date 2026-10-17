import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CloudDownload, Globe, HardDrive, Save, Settings, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Field, PageHeader, SwitchRow } from '@/components/common';
import { JobPanel } from '@/components/JobPanel';
import { useAsync } from '@/hooks/use-async';
import { api, type Settings as SettingsType } from '@/lib/api';
import { cn } from '@/lib/utils';

export function SettingsPage() {
  const info = useAsync(() => api.info(), []);
  const saved = useAsync(() => api.settings(), []);
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [downloadJob, setDownloadJob] = useState<string | null>(null);

  useEffect(() => {
    if (saved.data) setSettings(saved.data);
  }, [saved.data]);

  const save = async (s = settings) => {
    if (!s) return;
    if (s.stix_source === 'local' && !s.local_stix_path.trim()) return toast.error('Enter the path to the local STIX data.');
    try {
      saved.setData(await api.saveSettings(s));
      toast.success('Settings saved');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (!settings || !info.data) return null;
  const dirty = JSON.stringify(settings) !== JSON.stringify(saved.data);

  return (
    <>
      <PageHeader
        title="Settings"
        icon={Settings}
        description="Configure where DeTT&CT loads the MITRE ATT&CK data from."
        actions={
          <Button onClick={() => save()} disabled={!dirty}>
            <Save /> Save settings
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>ATT&CK data source</CardTitle>
            <CardDescription>DeTT&CT needs the MITRE ATT&CK data (techniques, groups, software, data sources) for every analysis.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { value: 'online', icon: Globe, title: "MITRE's TAXII server", text: 'Downloads the data from attack-taxii.mitre.org (needs internet). Cached for 30 days.' },
                { value: 'local', icon: HardDrive, title: 'Local STIX data', text: 'Uses STIX files on this machine. Works offline and with a fixed ATT&CK version.' }
              ].map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setSettings({ ...settings, stix_source: o.value as SettingsType['stix_source'] })}
                  className={cn('grid gap-1 rounded-lg border p-4 text-left transition-colors hover:bg-muted/40', settings.stix_source === o.value && 'border-primary bg-primary/5 ring-1 ring-primary')}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <o.icon className="size-4" /> {o.title}
                  </div>
                  <div className="text-xs text-muted-foreground">{o.text}</div>
                </button>
              ))}
            </div>
            {settings.stix_source === 'local' && (
              <Field label="Path to the local STIX data" description="A folder containing enterprise-attack, ics-attack and mobile-attack sub folders (the structure of the mitre-attack/attack-stix-data repository).">
                <div className="flex gap-2">
                  <Input value={settings.local_stix_path} onChange={(e) => setSettings({ ...settings, local_stix_path: e.target.value })} placeholder="/path/to/attack-stix-data" className="font-mono text-sm" />
                  {info.data.stix_downloaded && (
                    <Button variant="outline" onClick={() => setSettings({ ...settings, local_stix_path: info.data!.stix_dir })}>
                      Use downloaded data
                    </Button>
                  )}
                </div>
              </Field>
            )}
            <SwitchRow label="Ignore TLS verification errors" description="Only use this when a proxy intercepts TLS traffic and the TAXII server can't be verified.">
              <Switch checked={settings.ignore_verify_tls} onCheckedChange={(v) => setSettings({ ...settings, ignore_verify_tls: v })} />
            </SwitchRow>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Download ATT&CK data
              {info.data.stix_downloaded ? <Badge variant="success">downloaded</Badge> : <Badge variant="outline">not downloaded</Badge>}
            </CardTitle>
            <CardDescription>
              Download the latest ATT&CK STIX data from GitHub (mitre-attack/attack-stix-data, about 65 MB) into the <span className="font-mono">{info.data.stix_dir}</span> folder, so DeTT&CT can work offline.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div>
              <Button
                onClick={async () => {
                  const job = await api.downloadStix();
                  setDownloadJob(job.id);
                }}
              >
                <CloudDownload /> {info.data.stix_downloaded ? 'Download again (update)' : 'Download ATT&CK data'}
              </Button>
            </div>
            {downloadJob && (
              <JobPanel
                jobId={downloadJob}
                onFinished={async (job) => {
                  info.reload();
                  if (job.status === 'finished') {
                    const s = { ...settings, stix_source: 'local' as const, local_stix_path: info.data!.stix_dir };
                    setSettings(s);
                    await save(s);
                    await api.clearCache();
                  }
                }}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cache</CardTitle>
            <CardDescription>ATT&CK data from the TAXII server is cached for 30 days. Clear the cache to load the newest data.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={async () => {
                const r = await api.clearCache();
                toast.success(`${r.removed} cache file(s) removed`);
                info.reload();
              }}
            >
              <Trash2 /> Clear cache
            </Button>
            <span className="text-sm text-muted-foreground">{info.data.cache_files} file(s) in cache</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {[
              ['DeTT&CT version', info.data.version],
              ['ATT&CK version', info.data.attack_version],
              ['ATT&CK Navigator version', info.data.navigator_version],
              ['Navigator layer format', info.data.layer_version],
              ...Object.entries(info.data.file_versions).map(([k, v]) => [k + ' version', v.toFixed(1)])
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b pb-2 last:border-0">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-mono">{v}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
