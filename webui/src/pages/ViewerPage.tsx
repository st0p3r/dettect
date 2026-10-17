import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PageHeader } from '@/components/common';
import { FileActions } from '@/components/JobPanel';
import { useAsync } from '@/hooks/use-async';
import { api, fileUrl, type Dir } from '@/lib/api';
import { techniqueMap } from '@/lib/attack';
import { detectFileType } from '@/lib/yaml';
import type { Domain } from '@/lib/constants';

interface LayerTechnique {
  techniqueID: string;
  color?: string;
  score?: number;
  comment?: string;
  enabled?: boolean;
  metadata?: { name?: string; value?: string; divider?: boolean }[];
}

interface Layer {
  name: string;
  domain: Domain;
  description?: string;
  techniques: LayerTechnique[];
  legendItems?: { label: string; color: string }[];
  filters?: { platforms?: string[] };
}

function LayerView({ layer }: { layer: Layer }) {
  const [query, setQuery] = useState('');
  const names = useMemo(() => techniqueMap(layer.domain ?? 'enterprise-attack'), [layer.domain]);
  const techniques = useMemo(() => {
    const merged = new Map<string, LayerTechnique[]>();
    for (const t of layer.techniques) {
      if (!t.color && t.score === undefined) continue;
      merged.set(t.techniqueID, [...(merged.get(t.techniqueID) ?? []), t]);
    }
    return Array.from(merged.entries()).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  }, [layer]);
  const q = query.toLowerCase();
  const shown = techniques.filter(([id]) => !q || id.toLowerCase().includes(q) || names.get(id)?.technique_name.toLowerCase().includes(q));
  const legendCounts = new Map<string, number>();
  for (const [, items] of techniques) {
    const c = items[0].color?.toLowerCase();
    if (c) legendCounts.set(c, (legendCounts.get(c) ?? 0) + 1);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{layer.domain}</Badge>
        {layer.filters?.platforms?.map((p) => (
          <Badge key={p} variant="secondary">
            {p}
          </Badge>
        ))}
        <Badge variant="outline">{techniques.length} techniques with a score</Badge>
      </div>
      {layer.legendItems && layer.legendItems.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {layer.legendItems.map((l) => (
            <div key={l.label} className="flex items-center gap-2 text-xs">
              <span className="size-3.5 rounded-sm border" style={{ background: l.color }} />
              {l.label}
              <span className="text-muted-foreground">({legendCounts.get(l.color.toLowerCase()) ?? 0})</span>
            </div>
          ))}
        </div>
      )}
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter techniques..." className="max-w-xs" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-1.5">
        {shown.map(([id, items]) => {
          const t = items[0];
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <div className="flex h-14 cursor-default flex-col justify-center rounded-md border px-2 text-xs" style={{ background: t.color, color: t.color ? contrast(t.color) : undefined }}>
                  <div className="font-mono font-semibold">{id}</div>
                  <div className="truncate opacity-90">{names.get(id)?.technique_name ?? ''}</div>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-md text-left">
                <div className="mb-1 font-semibold">
                  {id} {names.get(id)?.technique_name}
                </div>
                {items.map((it, i) => (
                  <div key={i} className="mb-1">
                    {it.score !== undefined && <div>Score: {it.score}</div>}
                    {it.comment && <div>{it.comment}</div>}
                    {it.metadata
                      ?.filter((m) => m.name)
                      .map((m, j) => (
                        <div key={j}>
                          <span className="opacity-70">{m.name}:</span> {m.value}
                        </div>
                      ))}
                  </div>
                ))}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

function contrast(hex: string) {
  const h = hex.replace('#', '');
  if (h.length < 6) return undefined;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#111' : '#fff';
}

export function ViewerPage() {
  const { dir, name } = useParams() as { dir: Dir; name: string };
  const ext = name.split('.').pop()?.toLowerCase();
  const content = useAsync(() => (ext === 'html' ? Promise.resolve('') : api.readFile(dir, name)), [dir, name]);
  const layer = useMemo(() => {
    if (ext !== 'json' || !content.data) return null;
    try {
      const j = JSON.parse(content.data);
      return Array.isArray(j.techniques) ? (j as Layer) : null;
    } catch {
      return null;
    }
  }, [content.data, ext]);
  const fileType = ext === 'yaml' || ext === 'yml' ? detectFileType(content.data ?? '') ?? undefined : ext === 'json' ? 'navigator-layer' : undefined;

  return (
    <>
      <PageHeader
        title={name}
        icon={FileText}
        description={dir === 'input' ? 'My files' : 'Output'}
        actions={
          <>
            <Button variant="ghost" asChild>
              <Link to={`/files?tab=${dir}`}>
                <ArrowLeft /> Files
              </Link>
            </Button>
            <FileActions file={{ dir, name }} fileType={fileType} />
          </>
        }
      />
      {content.loading && <Skeleton className="h-96" />}
      {content.error && <p className="text-destructive">{content.error.message}</p>}
      {ext === 'html' && <iframe src={fileUrl(dir, name)} className="h-[75vh] w-full rounded-xl border bg-white" title={name} />}
      {layer && (
        <Tabs defaultValue="heatmap">
          <TabsList>
            <TabsTrigger value="heatmap">Heat map</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>
          <TabsContent value="heatmap">
            <Card>
              <CardHeader>
                <CardTitle>{layer.name}</CardTitle>
                <CardDescription>
                  A quick preview of the layer. Open it in the ATT&CK Navigator for the full matrix view. If the Navigator can't load the layer, allow
                  access to the local network when your browser asks, or download the file and use “Open Existing Layer → Upload from local” in the
                  Navigator.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LayerView layer={layer} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="json">
            <pre className="max-h-[75vh] overflow-auto rounded-xl border bg-muted/30 p-4 font-mono text-xs">{JSON.stringify(JSON.parse(content.data!), null, 2)}</pre>
          </TabsContent>
        </Tabs>
      )}
      {!layer && ext !== 'html' && content.data !== undefined && (
        <pre className="max-h-[75vh] overflow-auto rounded-xl border bg-muted/30 p-4 font-mono text-xs leading-relaxed">{content.data}</pre>
      )}
    </>
  );
}
