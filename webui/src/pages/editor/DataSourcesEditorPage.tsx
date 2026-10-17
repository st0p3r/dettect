import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, ChevronDown, Database, ListPlus, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, Field, HelpTip } from '@/components/common';
import { ScorePicker } from '@/components/ScorePicker';
import { TagInput } from '@/components/TagInput';
import { KeyValueEditor } from '@/components/KeyValueEditor';
import { EditorShell } from '@/components/editor/EditorShell';
import { FileDetails } from '@/components/editor/FileDetails';
import { ItemList } from '@/components/editor/ItemList';
import { AddItemPopover } from '@/components/editor/AddItemPopover';
import { useAdminFile } from '@/hooks/use-admin-file';
import { getDataSources } from '@/lib/attack';
import {
  DATA_QUALITY_DIMENSIONS,
  DATA_QUALITY_SCORES,
  newDataSource,
  newDataSourceDetail,
  type DataQuality,
  type DataSource,
  type DataSourceDetail,
  type DataSourceFile
} from '@/lib/constants';
import { cn } from '@/lib/utils';

const DETAIL_KEYS = Object.keys(newDataSourceDetail());

function dqEnabled(d: DataSourceDetail) {
  return Object.values(d.data_quality).some((v) => v > 0);
}

function dqAverage(d: DataSourceDetail) {
  const v = Object.values(d.data_quality);
  return v.reduce((a, b) => a + b, 0) / v.length;
}

function DetailCard({
  detail,
  index,
  systems,
  otherApplicableTo,
  onChange,
  onDelete,
  defaultOpen
}: {
  detail: DataSourceDetail;
  index: number;
  systems: string[];
  otherApplicableTo: string[];
  onChange: (fn: (d: DataSourceDetail) => void) => void;
  onDelete: () => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const prevQuality = useRef<DataQuality | null>(null);
  const enabled = dqEnabled(detail);

  const toggleEnabled = () =>
    onChange((d) => {
      if (enabled) {
        prevQuality.current = { ...d.data_quality };
        for (const k of Object.keys(d.data_quality)) d.data_quality[k as keyof DataQuality] = 0;
      } else if (prevQuality.current) {
        d.data_quality = { ...prevQuality.current };
      } else {
        for (const k of Object.keys(d.data_quality)) d.data_quality[k as keyof DataQuality] = 1;
      }
    });

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <CollapsibleTrigger asChild>
            <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium">
              <ChevronDown className={cn('size-4 shrink-0 transition-transform', !open && '-rotate-90')} />
              <span className="truncate">{detail.applicable_to.join(', ') || <em className="text-muted-foreground">no applicable to</em>}</span>
            </button>
          </CollapsibleTrigger>
          <Badge variant={enabled ? 'success' : 'outline'}>{enabled ? `quality ${dqAverage(detail).toFixed(1)}` : 'disabled'}</Badge>
          <Button variant="ghost" size="icon-sm" onClick={onDelete} title="Remove">
            <Trash2 />
          </Button>
        </div>
        <CollapsibleContent>
          <div className="grid gap-5 border-t p-4">
            <Field label="Applicable to" help="The type(s) of systems this registration applies to, as defined in the file details. 'all' applies to every system and can't be combined.">
              <TagInput
                value={detail.applicable_to}
                onChange={(v) => onChange((d) => (d.applicable_to = v))}
                options={['all', ...systems]}
                allowCustom={false}
                exclusive="all"
                isInvalid={(v) =>
                  v !== 'all' && !systems.includes(v)
                    ? `'${v}' is not defined as a system in the file details and will be ignored.`
                    : otherApplicableTo.includes(v)
                      ? `'${v}' is also used in another registration of this data source.`
                      : null
                }
              />
              {detail.applicable_to.length === 0 && <p className="text-xs text-destructive">Add at least one applicable to value.</p>}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date registered" help="The date this data source was registered in this file.">
                <Input type="date" value={detail.date_registered ?? ''} onChange={(e) => onChange((d) => (d.date_registered = e.target.value || null))} />
              </Field>
              <Field label="Date connected" help="The date the data source was connected to your SIEM / data lake. Used for the graph with data sources over time.">
                <Input type="date" value={detail.date_connected ?? ''} onChange={(e) => onChange((d) => (d.date_connected = e.target.value || null))} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  Data source enabled
                  <HelpTip>Disabling sets all data quality scores to 0. Enabling restores the previous scores (or sets them to 1).</HelpTip>
                </span>
                <Switch checked={enabled} onCheckedChange={toggleEnabled} />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  Available for data analytics
                  <HelpTip>The data is available in a central place (e.g. SIEM) where it can be used for analytics and detection.</HelpTip>
                </span>
                <Switch checked={detail.available_for_data_analytics} onCheckedChange={(v) => onChange((d) => (d.available_for_data_analytics = v))} />
              </label>
            </div>
            <Field label="Products" help="The products / tools that provide this data, e.g. Sysmon or an EDR.">
              <TagInput value={detail.products} onChange={(v) => onChange((d) => (d.products = v))} addLabel="Add product" placeholder="Type a product name..." />
            </Field>
            <Field label="Comment">
              <Textarea value={detail.comment ?? ''} onChange={(e) => onChange((d) => (d.comment = e.target.value))} rows={3} />
            </Field>
            <div className="grid gap-3">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                Data quality
                <HelpTip>
                  Score each dimension from 0 (none) to 5 (excellent). Device completeness: coverage of all devices. Data field completeness: required fields are present.
                  Timeliness: data arrives in time. Consistency: fields follow a standard. Retention: data is kept long enough.
                </HelpTip>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {DATA_QUALITY_DIMENSIONS.map((dim) => (
                  <div key={dim.key} className="grid gap-1.5">
                    <div className="text-xs font-medium text-muted-foreground">{dim.label}</div>
                    <ScorePicker size="sm" value={detail.data_quality[dim.key]} scores={DATA_QUALITY_SCORES} onChange={(v) => onChange((d) => (d.data_quality[dim.key] = v))} />
                  </div>
                ))}
              </div>
            </div>
            <KeyValueEditor
              item={detail}
              defaultKeys={DETAIL_KEYS}
              onChange={(item) =>
                onChange((d) => {
                  for (const k of Object.keys(d)) if (!(k in item)) delete d[k];
                  Object.assign(d, item);
                })
              }
            />
          </div>
        </CollapsibleContent>
      </div>
      <span className="sr-only">{index}</span>
    </Collapsible>
  );
}

function DataSourceDetailView({
  ds,
  doc,
  suggestions,
  onUpdate,
  onRename
}: {
  ds: DataSource;
  doc: DataSourceFile;
  suggestions: string[];
  onUpdate: (fn: (ds: DataSource) => void) => void;
  onRename: (name: string) => void;
}) {
  const systems = doc.systems.map((s) => s.applicable_to);
  const otherNames = doc.data_sources.map((d) => d.data_source_name).filter((n) => n !== ds.data_source_name);
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">{ds.data_source_name}</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2">
          {ds.data_source_name.includes('[DeTT&CT data source]') && <Badge variant="secondary">DeTT&CT data source</Badge>}
          {!suggestions.includes(ds.data_source_name) && !ds.data_source_name.includes('[DeTT&CT') && (
            <Badge variant="warning">
              <AlertTriangle /> not a known ATT&CK data source for the selected platforms
            </Badge>
          )}
          <AddItemPopover
            label="Rename"
            trigger={
              <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                Change data source
              </Button>
            }
            suggestions={suggestions.filter((s) => !otherNames.includes(s)).map((s) => ({ value: s, label: s }))}
            onAdd={(v) => (otherNames.includes(v) ? toast.error(`'${v}' already exists in this file`) : onRename(v))}
          />
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="text-sm font-medium">Registrations per system</div>
        {ds.data_source.map((d, i) => (
          <DetailCard
            key={i + ':' + ds.data_source_name}
            detail={d}
            index={i}
            systems={systems}
            otherApplicableTo={ds.data_source.filter((_, j) => j !== i).flatMap((x) => x.applicable_to)}
            defaultOpen={ds.data_source.length === 1}
            onChange={(fn) => onUpdate((x) => fn(x.data_source[i]))}
            onDelete={() => onUpdate((x) => x.data_source.splice(i, 1))}
          />
        ))}
        <div>
          <Button variant="outline" size="sm" onClick={() => onUpdate((x) => x.data_source.push(newDataSourceDetail([])))}>
            <Plus /> Add registration for other system(s)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function DataSourcesEditorPage() {
  const state = useAdminFile<DataSourceFile>('data-source-administration');
  const { doc, update } = state;
  const [selected, setSelected] = useState<string | null>(null);

  const platforms = useMemo(() => Array.from(new Set(doc?.systems.flatMap((s) => s.platform) ?? [])), [doc?.systems]);
  const suggestions = useMemo(() => (doc ? getDataSources(doc.domain, platforms) : []), [doc?.domain, platforms]);
  const names = new Set(doc?.data_sources.map((d) => d.data_source_name));
  const current = doc?.data_sources.find((d) => d.data_source_name === selected) ?? null;

  const add = (name: string) => {
    if (names.has(name)) {
      setSelected(name);
      return;
    }
    update((d) => d.data_sources.push(newDataSource(name)));
    setSelected(name);
  };

  const addAll = () => {
    const missing = suggestions.filter((s) => !names.has(s));
    if (!missing.length) return toast.info('All data sources for the selected platforms are already in the file.');
    update((d) => missing.forEach((m) => d.data_sources.push(newDataSource(m))));
    toast.success(`${missing.length} data sources added`);
  };

  const remove = (name: string) => {
    const index = doc!.data_sources.findIndex((d) => d.data_source_name === name);
    const removed = doc!.data_sources[index];
    update((d) => d.data_sources.splice(index, 1));
    if (selected === name) setSelected(null);
    toast(`'${name}' removed`, { action: { label: 'Undo', onClick: () => update((d) => d.data_sources.splice(index, 0, removed)) } });
  };

  return (
    <EditorShell
      fileType="data-source-administration"
      state={state}
      icon={Database}
      runRoute="/run/data-sources"
      description="Administer which data sources are available per type of system, and score their data quality."
    >
      {doc && (
        <>
          <FileDetails doc={doc} update={update} hasContent={doc.data_sources.length > 0} />
          <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
            <ItemList
              noun="data source"
              selected={selected}
              onSelect={setSelected}
              onDelete={remove}
              actions={
                <>
                  <AddItemPopover
                    label="Add data source"
                    placeholder="Search ATT&CK data sources..."
                    suggestions={suggestions.filter((s) => !names.has(s)).map((s) => ({ value: s, label: s }))}
                    onAdd={add}
                  />
                  <Button size="sm" variant="outline" onClick={addAll} title="Add all data sources that apply to the platforms of your systems">
                    <ListPlus /> Add all
                  </Button>
                </>
              }
              items={doc.data_sources.map((ds) => {
                const enabled = ds.data_source.some(dqEnabled);
                return {
                  key: ds.data_source_name,
                  title: ds.data_source_name,
                  subtitle: ds.data_source.map((d) => d.applicable_to.join(', ')).join(' | '),
                  search: ds.data_source_name + ' ' + ds.data_source.map((d) => d.applicable_to.join(' ') + ' ' + d.products.join(' ')).join(' '),
                  sort: ds.data_source_name,
                  right: <span className={cn('size-2 shrink-0 rounded-full', enabled ? 'bg-success' : 'bg-muted-foreground/30')} title={enabled ? 'enabled' : 'disabled'} />
                };
              })}
            />
            <div className="min-w-0">
              {current ? (
                <DataSourceDetailView
                  ds={current}
                  doc={doc}
                  suggestions={suggestions}
                  onUpdate={(fn) =>
                    update((d) => {
                      const x = d.data_sources.find((y) => y.data_source_name === current.data_source_name);
                      if (x) fn(x);
                    })
                  }
                  onRename={(name) => {
                    update((d) => {
                      const x = d.data_sources.find((y) => y.data_source_name === current.data_source_name);
                      if (x) x.data_source_name = name;
                    });
                    setSelected(name);
                  }}
                />
              ) : (
                <EmptyState icon={Database} title="Select a data source" description="Select a data source in the list to edit it, or add a new data source." />
              )}
            </div>
          </div>
        </>
      )}
    </EditorShell>
  );
}
