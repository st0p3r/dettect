import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Gauge, Info, Lightbulb } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { EmptyState, HelpTip, PageHeader } from '@/components/common';
import { FilePicker } from '@/components/FilePicker';
import { Legend, Meter, ScoreColumns, TacticBars, TrendChart } from '@/components/charts';
import { useAsync } from '@/hooks/use-async';
import { api, type Coverage } from '@/lib/api';
import { DETECTION_SCORES, VISIBILITY_SCORES } from '@/lib/constants';

function StatTile({ label, value, sub, help, children }: { label: string; value: string; sub?: string; help?: string; children?: React.ReactNode }) {
  return (
    <Card className="gap-2">
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          {label}
          {help && <HelpTip>{help}</HelpTip>}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums">{value}</span>
          {sub && <span className="text-sm text-muted-foreground tabular-nums">{sub}</span>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

const pct = (n: number, total: number) => (total ? `${Math.round((100 * n) / total)}%` : '0%');

function CoverageView({ data, file }: { data: Coverage; file: string }) {
  const [tacticView, setTacticView] = useState<'chart' | 'table'>('chart');
  const [showAllWins, setShowAllWins] = useState(false);
  const tacticsInScope = data.tactics.filter((t) => t.total > 0);
  const wins = showAllWins ? data.quick_wins : data.quick_wins.slice(0, 10);
  const editorLink = (id: string) => `/editor/techniques?file=${encodeURIComponent(file)}&technique=${encodeURIComponent(id)}`;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{data.name || data.file}</Badge>
        <Badge variant="outline">{data.domain}</Badge>
        <Badge variant="outline">platforms: {data.platforms.join(', ')}</Badge>
        <Badge variant="outline">
          ATT&CK v{data.attack_version} · {data.attack_source === 'local' ? 'local data' : 'TAXII server'}
        </Badge>
      </div>

      {data.unknown_techniques.length > 0 && (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertTitle>{data.unknown_techniques.length} technique(s) in the file are not in this ATT&CK version</AlertTitle>
          <AlertDescription>
            {data.unknown_techniques.slice(0, 15).join(', ')}
            {data.unknown_techniques.length > 15 && ' ...'} — they may be revoked or deprecated. They are not counted below.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Visibility coverage"
          value={`${data.visibility.percentage}%`}
          sub={`${data.visibility.covered} / ${data.scope}`}
          help="Techniques in scope with a visibility score of 1 or higher."
        >
          <Meter value={data.visibility.percentage} series="visibility" />
        </StatTile>
        <StatTile
          label="Detection coverage"
          value={`${data.detection.percentage}%`}
          sub={`${data.detection.covered} / ${data.scope}`}
          help="Techniques in scope with a detection score of 1 or higher. Score 0 (forensics / context only) is not counted as a detection."
        >
          <Meter value={data.detection.percentage} series="detection" />
        </StatTile>
        <StatTile
          label="Techniques in scope"
          value={String(data.scope)}
          sub={`${data.administrated_in_scope} in file`}
          help={`ATT&CK ${data.include_subtechniques ? 'techniques and sub-techniques' : 'techniques (without sub-techniques)'} for the platforms of the file.`}
        />
        <StatTile label="Quick wins" value={String(data.quick_wins.length)} help="Techniques with a visibility score of 2 or higher but no detection: the data is there, a detection rule is missing." />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coverage per tactic</CardTitle>
          <CardDescription>Percentage of the techniques in scope with visibility (score ≥ 1) and detection (score ≥ 1).</CardDescription>
          <CardAction>
            <ToggleGroup type="single" value={tacticView} onValueChange={(v) => v && setTacticView(v as typeof tacticView)}>
              <ToggleGroupItem value="chart">Chart</ToggleGroupItem>
              <ToggleGroupItem value="table">Table</ToggleGroupItem>
            </ToggleGroup>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4">
          {tacticView === 'chart' ? (
            <>
              <Legend series={['visibility', 'detection']} />
              <TacticBars rows={tacticsInScope} />
            </>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tactic</TableHead>
                  <TableHead className="text-right">Techniques</TableHead>
                  <TableHead className="text-right">Visibility</TableHead>
                  <TableHead className="text-right">Detection</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tacticsInScope.map((t) => (
                  <TableRow key={t.shortname}>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">{t.id}</span> {t.name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{t.total}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.visibility} <span className="text-muted-foreground">({pct(t.visibility, t.total)})</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.detection} <span className="text-muted-foreground">({pct(t.detection, t.total)})</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Visibility scores</CardTitle>
            <CardDescription>Number of techniques in scope per visibility score (0 = none, 4 = excellent).</CardDescription>
          </CardHeader>
          <CardContent>
            <ScoreColumns
              series="visibility"
              entries={Object.entries(VISIBILITY_SCORES).map(([k, label]) => ({ score: Number(k), label, count: data.visibility.distribution[k] ?? 0 }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Detection scores</CardTitle>
            <CardDescription>Number of techniques in scope per detection score (-1 = none, 5 = excellent).</CardDescription>
          </CardHeader>
          <CardContent>
            <ScoreColumns
              series="detection"
              entries={Object.entries(DETECTION_SCORES)
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([k, label]) => ({ score: Number(k), label, count: data.detection.distribution[k] ?? 0 }))}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Progress over time</CardTitle>
          <CardDescription>Techniques with visibility or detection at the end of each month, based on the dates in the score logbooks.</CardDescription>
          {data.trend.length > 0 && (
            <CardAction>
              <Legend series={['visibility', 'detection']} kind="line" />
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="grid gap-3">
          {data.trend.length > 0 ? <TrendChart points={data.trend} /> : <p className="text-sm text-muted-foreground">The score logbooks don't contain any dates yet.</p>}
          {data.undated_scores > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="size-3.5" /> {data.undated_scores} score(s) without a date are not included in this graph.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="size-4" /> Quick wins
          </CardTitle>
          <CardDescription>Techniques with good visibility (score ≥ 2) but without a detection, sorted by visibility.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 px-0">
          {data.quick_wins.length === 0 ? (
            <p className="px-5 text-sm text-muted-foreground">No quick wins: every technique with good visibility has a detection.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Technique</TableHead>
                  <TableHead className="hidden md:table-cell">Tactics</TableHead>
                  <TableHead className="text-right">Visibility</TableHead>
                  <TableHead className="w-0 pr-5" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {wins.map((t) => (
                  <TableRow key={t.technique_id}>
                    <TableCell className="pl-5">
                      <span className="font-mono text-xs text-muted-foreground">{t.technique_id}</span> {t.technique_name}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                      {t.tactics.map((s) => data.tactics.find((x) => x.shortname === s)?.name ?? s).join(', ')}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.visibility} <span className="text-xs text-muted-foreground">{VISIBILITY_SCORES[t.visibility]}</span>
                    </TableCell>
                    <TableCell className="pr-5">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={editorLink(t.technique_id)}>
                          Edit <ArrowRight />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {data.quick_wins.length > 10 && (
            <div className="px-5">
              <Button variant="outline" size="sm" onClick={() => setShowAllWins((s) => !s)}>
                {showAllWins ? 'Show fewer' : `Show all ${data.quick_wins.length}`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function CoveragePage() {
  const [params, setParams] = useSearchParams();
  const files = useAsync(() => api.files('input'), []);
  const [file, setFile] = useState(params.get('file') ?? '');
  const [subtechniques, setSubtechniques] = useState(params.get('sub') !== '0');
  const [data, setData] = useState<Coverage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // default to the first technique file
  useEffect(() => {
    if (!file && files.data) {
      const first = files.data.find((f) => f.file_type === 'technique-administration');
      if (first) setFile(first.name);
    }
  }, [file, files.data]);

  useEffect(() => {
    if (!file) return;
    setParams({ file, ...(subtechniques ? {} : { sub: '0' }) }, { replace: true });
    let active = true;
    setLoading(true);
    api
      .coverage(file, subtechniques)
      .then((d) => {
        if (!active) return;
        setData(d);
        setError(null);
      })
      .catch((e) => active && setError((e as Error).message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [file, subtechniques, setParams]);

  const hasFiles = files.data?.some((f) => f.file_type === 'technique-administration');

  return (
    <>
      <PageHeader title="Coverage" icon={Gauge} description="How much of ATT&CK your visibility and detection cover, per tactic and over time, based on a technique administration file." />
      {files.data && !hasFiles ? (
        <EmptyState icon={Gauge} title="No technique file yet" description="Create a technique administration file first, for example from your data sources.">
          <Button asChild>
            <Link to="/run/data-sources">Generate from data sources</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/files?tab=samples">Use a sample file</Link>
          </Button>
        </EmptyState>
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="w-full sm:max-w-md">
              <FilePicker fileType="technique-administration" value={file} onChange={(name) => setFile(name)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={subtechniques} onCheckedChange={setSubtechniques} /> Include sub-techniques
            </label>
          </div>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle />
              <AlertTitle>Could not calculate the coverage</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!data && loading && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          )}
          {data && (
            <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
              <CoverageView data={data} file={file} />
            </div>
          )}
        </>
      )}
    </>
  );
}
