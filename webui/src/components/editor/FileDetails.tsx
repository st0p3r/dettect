import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Field } from '@/components/common';
import { DOMAINS, PLATFORMS, type DataSourceFile, type Domain, type System } from '@/lib/constants';
import type { AnyFile } from '@/lib/yaml';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export function PlatformChips({ domain, value, onChange }: { domain: Domain; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (p: string) => {
    if (value.includes(p)) onChange(value.filter((x) => x !== p));
    else if (p === 'all') onChange(['all']);
    else onChange([...value.filter((x) => x !== 'all'), p]);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {PLATFORMS[domain].map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => toggle(p)}
          className={cn(
            'h-7 rounded-full border px-3 text-xs font-medium transition-colors',
            value.includes(p) ? 'border-primary bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

function SystemsEditor({ doc, update }: { doc: DataSourceFile; update: (fn: (d: DataSourceFile) => void) => void }) {
  const [newName, setNewName] = useState('');

  const rename = (index: number, name: string) =>
    update((d) => {
      const old = d.systems[index].applicable_to;
      d.systems[index].applicable_to = name;
      for (const ds of d.data_sources) for (const det of ds.data_source) det.applicable_to = det.applicable_to.map((a) => (a === old ? name : a));
    });

  const remove = (index: number) =>
    update((d) => {
      const [removed] = d.systems.splice(index, 1);
      for (const ds of d.data_sources)
        for (const det of ds.data_source) {
          det.applicable_to = det.applicable_to.filter((a) => a !== removed.applicable_to);
          if (det.applicable_to.length === 0) det.applicable_to = ['all'];
        }
    });

  const add = () => {
    const name = newName.trim();
    if (!name || name === 'all' || doc.systems.some((s) => s.applicable_to === name)) return;
    update((d) => d.systems.push({ applicable_to: name, platform: [] } as System));
    setNewName('');
  };

  return (
    <div className="grid gap-3">
      {doc.systems.map((s, i) => (
        <div key={i} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[220px_1fr_auto] md:items-start">
          <Input
            defaultValue={s.applicable_to}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== s.applicable_to && v !== 'all' && !doc.systems.some((x) => x.applicable_to === v)) rename(i, v);
              else e.target.value = s.applicable_to;
            }}
            placeholder="applicable to"
          />
          <div className="grid gap-1">
            <PlatformChips domain={doc.domain} value={s.platform} onChange={(v) => update((d) => (d.systems[i].platform = v))} />
            {s.platform.length === 0 && <span className="text-xs text-destructive">Select at least one platform.</span>}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => remove(i)} disabled={doc.systems.length === 1}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New system, e.g. Windows workstations" className="max-w-xs" onKeyDown={(e) => e.key === 'Enter' && add()} />
        <Button variant="outline" onClick={add} disabled={!newName.trim()}>
          <Plus /> Add system
        </Button>
      </div>
    </div>
  );
}

/**
 * The file level properties of an administration file (name, domain, notes, platforms / systems).
 */
export function FileDetails<T extends AnyFile>({ doc, update, hasContent }: { doc: T; update: (fn: (d: T) => void) => void; hasContent: boolean }) {
  const [open, setOpen] = useState(!hasContent);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="mb-4 gap-0 py-0">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-4 select-none">
            <CardTitle className="flex items-center gap-2 text-base">
              <ChevronDown className={cn('size-4 transition-transform', !open && '-rotate-90')} />
              File details
            </CardTitle>
            <CardDescription className="pl-6">
              {'name' in doc && doc.name ? doc.name + ' · ' : ''}
              {DOMAINS.find((d) => d.value === doc.domain)?.label} ·{' '}
              {doc.file_type === 'data-source-administration' ? `${doc.systems.length} system(s)` : doc.platform.join(', ') || 'no platform'}
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="grid gap-5 border-t py-5">
            <div className="grid gap-5 md:grid-cols-3">
              {doc.file_type !== 'group-administration' && (
                <Field label="Name" help="Used as the name of the generated Navigator layers and files.">
                  <Input value={(doc as { name: string }).name ?? ''} onChange={(e) => update((d) => ((d as { name: string }).name = e.target.value))} />
                </Field>
              )}
              <Field label="ATT&CK domain" help={hasContent ? 'The domain can only be changed for an empty file.' : undefined}>
                <Select
                  value={doc.domain}
                  disabled={hasContent}
                  onValueChange={(v) =>
                    update((d) => {
                      d.domain = v as Domain;
                      if (d.file_type === 'data-source-administration') d.systems = [{ applicable_to: 'default', platform: [PLATFORMS[d.domain][0]] }];
                      else d.platform = [PLATFORMS[d.domain][0]];
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOMAINS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label} ({d.value})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="File">
                <div className="flex h-9 items-center text-sm text-muted-foreground">
                  {doc.file_type} · version {Number(doc.version).toFixed(1)}
                </div>
              </Field>
            </div>
            <Field label="Notes">
              <Textarea value={doc.notes ?? ''} onChange={(e) => update((d) => (d.notes = e.target.value))} placeholder="Free text notes about this file" rows={2} />
            </Field>
            {doc.file_type === 'data-source-administration' ? (
              <Field
                label="Systems"
                help="The types of systems in your environment and their ATT&CK platforms. Data sources are registered per system using the 'applicable to' value."
              >
                <SystemsEditor doc={doc} update={update as unknown as (fn: (d: DataSourceFile) => void) => void} />
              </Field>
            ) : (
              <Field label="Platforms" help="The ATT&CK platform(s) this file applies to. 'all' includes every platform.">
                <PlatformChips domain={doc.domain} value={doc.platform} onChange={(v) => update((d) => ((d as { platform: string[] }).platform = v))} />
              </Field>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
