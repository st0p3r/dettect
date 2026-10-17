import * as React from 'react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronDown, Loader2, Play } from 'lucide-react';
import yaml from 'js-yaml';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Field, HelpTip } from '@/components/common';
import { JobPanel } from '@/components/JobPanel';
import { useAsync } from '@/hooks/use-async';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Terminal } from 'lucide-react';

export interface CommonOptions {
  outputFilename: string;
  layerName: string;
  forceOverwrite: boolean;
  health: boolean;
  layerSettings: Record<string, string>;
}

export const defaultCommon = (): CommonOptions => ({ outputFilename: '', layerName: '', forceOverwrite: false, health: false, layerSettings: {} });

export function commonArgs(o: CommonOptions, { layer = true, output = true } = {}) {
  const args: string[] = [];
  if (output && o.outputFilename.trim()) args.push('-of', o.outputFilename.trim());
  if (output && o.forceOverwrite) args.push('--force-overwrite');
  if (layer && o.layerName.trim()) args.push('-ln', o.layerName.trim());
  if (layer) for (const [k, v] of Object.entries(o.layerSettings)) if (v) args.push('--layer-settings', `${k}=${v}`);
  if (o.health) args.push('--health');
  return args;
}

/**
 * Check box styled as a selectable card, used for choosing the outputs to generate.
 */
export function OutputOption({ checked, onChange, title, description, icon: Icon, disabled }: { checked: boolean; onChange: (v: boolean) => void; title: string; description: string; icon: React.ElementType; disabled?: boolean }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40',
        checked && 'border-primary/60 bg-primary/5',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} disabled={disabled} className="mt-0.5" />
      <div className="grid gap-0.5">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </label>
  );
}

export function CommonOptionsEditor({ value, onChange, layer = true, output = true }: { value: CommonOptions; onChange: (v: CommonOptions) => void; layer?: boolean; output?: boolean }) {
  const [open, setOpen] = useState(false);
  const info = useAsync(() => api.info(), []);
  const set = (patch: Partial<CommonOptions>) => onChange({ ...value, ...patch });
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button type="button" className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ChevronDown className={cn('size-4 transition-transform', !open && '-rotate-90')} /> Advanced options
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 grid gap-4">
        {output && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Output filename" help="Optional. By default DeTT&CT generates a filename. Files are written to the Output folder.">
              <Input value={value.outputFilename} onChange={(e) => set({ outputFilename: e.target.value })} placeholder="automatic" />
            </Field>
            {layer && (
              <Field label="Layer name" help="Optional name of the ATT&CK Navigator layer.">
                <Input value={value.layerName} onChange={(e) => set({ layerName: e.target.value })} placeholder="automatic" />
              </Field>
            )}
          </div>
        )}
        {layer && info.data && (
          <div className="grid gap-2">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              Navigator layer settings <HelpTip>Settings that are written into the generated ATT&CK Navigator layer file.</HelpTip>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(info.data.layer_settings).map(([k, options]) => (
                <div key={k} className="grid gap-1">
                  <span className="text-xs text-muted-foreground">{k}</span>
                  <Select value={value.layerSettings[k] ?? '__default__'} onValueChange={(v) => set({ layerSettings: { ...value.layerSettings, [k]: v === '__default__' ? '' : v } })}>
                    <SelectTrigger size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default__">Default</SelectItem>
                      {options.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {output && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={value.forceOverwrite} onCheckedChange={(v) => set({ forceOverwrite: v })} /> Overwrite existing output files
            </label>
          )}
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={value.health} onCheckedChange={(v) => set({ health: v })} /> Show detailed health check errors
          </label>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Two column layout: options form on the left, the live job output on the right.
 */
export function RunLayout({
  title,
  description,
  children,
  args,
  canRun,
  runLabel = 'Run',
  jobTitle,
  hint
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  args: string[];
  canRun: boolean;
  runLabel?: string;
  jobTitle: string;
  hint?: React.ReactNode;
}) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const run = async () => {
    setStarting(true);
    try {
      const job = await api.runJob(jobTitle, args);
      setJobId(job.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="grid gap-6">
          {children}
          <div className="flex flex-wrap items-center gap-3 border-t pt-5">
            <Button onClick={run} disabled={!canRun || starting} size="lg">
              {starting ? <Loader2 className="animate-spin" /> : <Play />} {runLabel}
            </Button>
            {hint && <span className="text-sm text-muted-foreground">{hint}</span>}
          </div>
          <div className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
            <Terminal className="mt-0.5 size-3.5 shrink-0" />
            <span className="break-all">python dettect.py {args.map((a) => (/[\s'"]/.test(a) ? `'${a}'` : a)).join(' ')}</span>
          </div>
        </CardContent>
      </Card>
      <div className="min-w-0">
        {jobId ? (
          <JobPanel jobId={jobId} />
        ) : (
          <div className="flex h-full min-h-60 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            <Terminal className="mb-3 size-8 opacity-40" />
            Choose the options and press <span className="font-medium text-foreground">{runLabel}</span>. The output and the generated files appear here.
            <Link to="/jobs" className="mt-2 text-primary hover:underline">
              Previous jobs
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/** The selected file from the ?file= query parameter */
export function useFileParam() {
  const [params] = useSearchParams();
  return useState(params.get('file') ?? '');
}

/**
 * Read some values from a YAML file in "My files" (e.g. the systems, platforms or applicable to values).
 */
export function useYamlFile(name: string) {
  const [doc, setDoc] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    if (!name) return setDoc(null);
    api
      .readFile('input', name)
      .then((c) => setDoc(yaml.load(c) as Record<string, unknown>))
      .catch(() => setDoc(null));
  }, [name]);
  return doc;
}
