import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, ArrowRight, Database, Eye, FolderOpen, Gauge, ListChecks, Radar, ShieldCheck, Sparkles, Swords, Users } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/common';
import { JobStatusBadge } from '@/components/JobPanel';
import { useAsync } from '@/hooks/use-async';
import { api } from '@/lib/api';
import { formatTime } from '@/lib/utils';

const STEPS = [
  {
    icon: Database,
    title: 'Administer your data sources',
    text: 'Register which data sources you have and score their data quality.',
    edit: '/editor/data-sources',
    run: '/run/data-sources'
  },
  {
    icon: Eye,
    title: 'Score your visibility',
    text: 'Generate visibility scores per technique from your data sources and refine them.',
    edit: '/editor/techniques',
    run: '/run/visibility'
  },
  {
    icon: ShieldCheck,
    title: 'Score your detections',
    text: 'Record where and how well you detect each technique.',
    edit: '/editor/techniques',
    run: '/run/detection'
  },
  {
    icon: Swords,
    title: 'Compare with threat actors',
    text: 'Map threat actor groups and campaigns, and overlay them with your coverage.',
    edit: '/editor/groups',
    run: '/run/groups'
  }
];

export function DashboardPage() {
  const navigate = useNavigate();
  const info = useAsync(() => api.info(), []);
  const settings = useAsync(() => api.settings(), []);
  const files = useAsync(() => api.files('input'), []);
  const output = useAsync(() => api.files('output'), []);
  const jobs = useAsync(() => api.jobs(), []);

  const count = (type: string) => files.data?.filter((f) => f.file_type === type).length ?? 0;

  const importSamples = async () => {
    try {
      for (const name of info.data?.sample_files ?? []) {
        await api.fileAction('sample', name, 'import-sample').catch(() => null);
      }
      toast.success('The sample files were added to your files');
      files.reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const usingOnline = settings.data?.stix_source === 'online';

  return (
    <>
      <PageHeader
        title="Dashboard"
        icon={Radar}
        description="Score and compare data source quality, visibility, detection and threat actor behaviour using MITRE ATT&CK — everything from this web interface."
      />

      {usingOnline && info.data && (
        <Alert variant="warning" className="mb-6">
          <AlertTriangle />
          <AlertTitle>ATT&CK data is loaded from MITRE's TAXII server</AlertTitle>
          <AlertDescription>
            <p>
              This requires internet access to attack-taxii.mitre.org. To work offline or behind a restrictive firewall, download the ATT&CK data once and use it locally.
            </p>
            <Button size="sm" variant="outline" className="mt-2" asChild>
              <Link to="/settings">Open settings</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Data source files', value: count('data-source-administration'), icon: Database, to: '/editor/data-sources' },
          { label: 'Technique files', value: count('technique-administration'), icon: ListChecks, to: '/editor/techniques' },
          { label: 'Group files', value: count('group-administration'), icon: Users, to: '/editor/groups' },
          { label: 'Output files', value: output.data?.length ?? 0, icon: FolderOpen, to: '/files?tab=output' }
        ].map((s) => (
          <Link key={s.label} to={s.to}>
            <Card className="gap-2 transition-colors hover:border-primary/40">
              <CardHeader>
                <CardDescription>{s.label}</CardDescription>
                <CardAction>
                  <s.icon className="size-4 text-muted-foreground" />
                </CardAction>
              </CardHeader>
              <CardContent>{files.loading ? <Skeleton className="h-8 w-12" /> : <div className="text-3xl font-semibold tabular-nums">{s.value}</div>}</CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {files.data && files.data.length === 0 && (
        <Card className="mt-6 border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" /> Get started
            </CardTitle>
            <CardDescription>
              You don't have any administration files yet. Start with the sample files to explore DeTT&CT, upload your own files, or create new ones in the editors.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={importSamples}>Add sample files</Button>
            <Button variant="outline" onClick={() => navigate('/files')}>
              Upload files
            </Button>
            <Button variant="outline" onClick={() => navigate('/editor/data-sources?new=1')}>
              New data source file
            </Button>
          </CardContent>
        </Card>
      )}

      {count('technique-administration') > 0 && (
        <Link to="/coverage" className="mt-6 block">
          <Card className="flex-row items-center gap-4 px-5 transition-colors hover:border-primary/40">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Gauge className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium">Coverage dashboard</div>
              <div className="text-sm text-muted-foreground">Visibility and detection coverage per tactic, progress over time and quick wins.</div>
            </div>
            <ArrowRight className="size-4 text-muted-foreground" />
          </Card>
        </Link>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Workflow</CardTitle>
            <CardDescription>The typical steps when using DeTT&CT.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {STEPS.map((s, i) => (
              <div key={s.title} className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">
                    <s.icon className="size-4.5" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      <span className="text-muted-foreground">{i + 1}.</span> {s.title}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">{s.text}</div>
                  </div>
                </div>
                <div className="mt-auto flex gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link to={s.edit}>Edit</Link>
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link to={s.run}>
                      Analyze <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent jobs</CardTitle>
            <CardAction>
              <Button size="sm" variant="ghost" asChild>
                <Link to="/jobs">All jobs</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-2">
            {jobs.data?.length === 0 && <p className="text-sm text-muted-foreground">No jobs have been run yet.</p>}
            {jobs.data?.slice(0, 6).map((j) => (
              <Link key={j.id} to={`/jobs/${j.id}`} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 hover:bg-muted/50">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{j.title}</div>
                  <div className="text-xs text-muted-foreground">{formatTime(j.created)}</div>
                </div>
                <JobStatusBadge status={j.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {info.data && (
        <div className="mt-6 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">DeTT&CT {info.data.version}</Badge>
          <Badge variant="outline">ATT&CK v{info.data.attack_version}</Badge>
          <Badge variant="outline">Navigator layer {info.data.layer_version}</Badge>
          <Badge variant="outline">ATT&CK data: {usingOnline ? 'online (TAXII)' : 'local'}</Badge>
        </div>
      )}
    </>
  );
}
