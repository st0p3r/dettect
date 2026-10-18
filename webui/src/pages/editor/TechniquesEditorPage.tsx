import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronDown, ExternalLink, History, ListChecks, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState, Field, HelpTip } from '@/components/common';
import { ScorePicker } from '@/components/ScorePicker';
import { TagInput } from '@/components/TagInput';
import { KeyValueEditor } from '@/components/KeyValueEditor';
import { EditorShell } from '@/components/editor/EditorShell';
import { FileDetails } from '@/components/editor/FileDetails';
import { ItemList } from '@/components/editor/ItemList';
import { AddItemPopover } from '@/components/editor/AddItemPopover';
import { useAdminFile } from '@/hooks/use-admin-file';
import { attackSourceLabel, useAttackData } from '@/lib/attack';
import { DETECTION_SCORES, VISIBILITY_SCORES, newDetection, newTechnique, newVisibility, type ScoreEntry, type ScoreObject, type Technique, type TechniqueFile } from '@/lib/constants';
import { cn, today } from '@/lib/utils';

type Kind = 'detection' | 'visibility';

function latestEntry(logbook: ScoreEntry[]): ScoreEntry | undefined {
  return [...logbook].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')).at(-1);
}

export function latestScore(objs: ScoreObject[], kind: Kind) {
  const scores = objs.map((o) => latestEntry(o.score_logbook)?.score ?? (kind === 'detection' ? -1 : 0));
  return scores.length ? Math.max(...scores) : kind === 'detection' ? -1 : 0;
}

const SCORE_BG: Record<number, string> = {
  [-1]: 'bg-muted text-muted-foreground',
  0: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
  1: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  2: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300',
  3: 'bg-lime-500/15 text-lime-700 dark:text-lime-300',
  4: 'bg-green-600/15 text-green-700 dark:text-green-300',
  5: 'bg-emerald-700/15 text-emerald-700 dark:text-emerald-300'
};

function ScoreChip({ label, score }: { label: string; score: number }) {
  return <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums', SCORE_BG[score])}>{label + (score === -1 ? '–' : score)}</span>;
}

function ScoreLogbook({ obj, kind, onChange }: { obj: ScoreObject; kind: Kind; onChange: (fn: (o: ScoreObject) => void) => void }) {
  const scores = kind === 'detection' ? DETECTION_SCORES : VISIBILITY_SCORES;
  return (
    <div className="grid gap-2">
      {obj.score_logbook.map((s, i) => (
        <div key={i} className="grid items-start gap-2 rounded-md border bg-muted/20 p-2.5 md:grid-cols-[150px_auto_1fr_auto_auto]">
          <Input type="date" value={s.date ?? ''} onChange={(e) => onChange((o) => (o.score_logbook[i].date = e.target.value || null))} className="h-8" />
          <Select
            value={String(s.score)}
            onValueChange={(v) =>
              onChange((o) => {
                o.score_logbook[i].score = Number(v);
                if (kind === 'visibility') o.score_logbook[i].auto_generated = false;
              })
            }
          >
            <SelectTrigger size="sm" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(scores)
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {k} – {v}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Input value={s.comment ?? ''} placeholder="comment" onChange={(e) => onChange((o) => (o.score_logbook[i].comment = e.target.value))} className="h-8" />
          {kind === 'visibility' ? (
            <label className="flex h-8 items-center gap-2 text-xs text-muted-foreground" title="The score was derived automatically from the number of available data sources">
              <Switch checked={!!s.auto_generated} onCheckedChange={(v) => onChange((o) => (o.score_logbook[i].auto_generated = v))} />
              auto
            </label>
          ) : (
            <span />
          )}
          <Button variant="ghost" size="icon-sm" disabled={obj.score_logbook.length === 1} onClick={() => onChange((o) => o.score_logbook.splice(i, 1))}>
            <Trash2 />
          </Button>
        </div>
      ))}
    </div>
  );
}

function ScoreObjectCard({
  obj,
  kind,
  suggestions,
  others,
  onChange,
  onDelete,
  defaultOpen
}: {
  obj: ScoreObject;
  kind: Kind;
  suggestions: string[];
  others: string[];
  onChange: (fn: (o: ScoreObject) => void) => void;
  onDelete: () => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [showLog, setShowLog] = useState(false);
  const scores = kind === 'detection' ? DETECTION_SCORES : VISIBILITY_SCORES;
  const latest = latestEntry(obj.score_logbook);

  const setCurrent = (score: number) =>
    onChange((o) => {
      const entry = latestEntry(o.score_logbook)!;
      entry.score = score;
      if (!entry.date) entry.date = today();
      if (kind === 'visibility') entry.auto_generated = false;
    });

  const addEntry = () =>
    onChange((o) => {
      o.score_logbook.push({ date: today(), score: latest?.score ?? (kind === 'detection' ? -1 : 0), comment: '', ...(kind === 'visibility' ? { auto_generated: false } : {}) });
    });

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <CollapsibleTrigger asChild>
            <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium">
              <ChevronDown className={cn('size-4 shrink-0 transition-transform', !open && '-rotate-90')} />
              <span className="truncate">{obj.applicable_to.join(', ') || <em className="text-muted-foreground">no applicable to</em>}</span>
            </button>
          </CollapsibleTrigger>
          <ScoreChip label="" score={latest?.score ?? -1} />
          <Button variant="ghost" size="icon-sm" onClick={onDelete}>
            <Trash2 />
          </Button>
        </div>
        <CollapsibleContent>
          <div className="grid gap-5 border-t p-4">
            <Field
              label="Applicable to"
              help={`The type(s) of systems this ${kind} score applies to. 'all' applies to every system${kind === 'visibility' ? ' and cannot be combined with other values' : ''}.`}
            >
              <TagInput
                value={obj.applicable_to}
                onChange={(v) => onChange((o) => (o.applicable_to = v))}
                options={suggestions}
                exclusive={kind === 'visibility' ? 'all' : undefined}
                isInvalid={(v) => (others.includes(v) ? `'${v}' is also used in another ${kind} object of this technique.` : null)}
              />
            </Field>
            {kind === 'detection' && (
              <Field label="Location" help="Where the detection lives, e.g. a rule name or the SIEM/EDR. Prefix with 'EDR: ' etc. to group detections when counting.">
                <TagInput value={obj.location ?? []} onChange={(v) => onChange((o) => (o.location = v))} addLabel="Add location" placeholder="e.g. EDR: Rule 1" />
              </Field>
            )}
            <Field label="Comment">
              <Textarea value={obj.comment ?? ''} onChange={(e) => onChange((o) => (o.comment = e.target.value))} rows={2} />
            </Field>
            <div className="grid gap-2">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                Current score
                <span className="font-normal text-muted-foreground">· {latest?.date ?? 'no date yet'}</span>
                <HelpTip>Changing the current score updates the most recent entry of the score logbook. Add a new entry to keep track of changes over time.</HelpTip>
              </div>
              <ScorePicker value={latest?.score ?? -1} scores={scores} onChange={setCurrent} />
            </div>
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowLog((s) => !s)}>
                  <History /> Score logbook ({obj.score_logbook.length})
                </Button>
                <Button variant="ghost" size="sm" onClick={addEntry}>
                  <Plus /> New score entry
                </Button>
              </div>
              {showLog && <ScoreLogbook obj={obj} kind={kind} onChange={onChange} />}
            </div>
            <KeyValueEditor
              item={obj}
              defaultKeys={Object.keys(kind === 'detection' ? newDetection() : newVisibility())}
              onChange={(item) =>
                onChange((o) => {
                  for (const k of Object.keys(o)) if (!(k in item)) delete o[k];
                  Object.assign(o, item);
                })
              }
            />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function ScoreSection({ technique, kind, suggestions, onUpdate }: { technique: Technique; kind: Kind; suggestions: string[]; onUpdate: (fn: (t: Technique) => void) => void }) {
  const objs = technique[kind];
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <h3 className="font-medium capitalize">{kind}</h3>
        <HelpTip>
          {kind === 'detection'
            ? 'Detection scores: -1 none, 0 forensics/context, 1 basic … 5 excellent. Score per type of system using applicable to.'
            : 'Visibility scores: 0 none, 1 minimal … 4 excellent. Can be generated from your data sources using the data source mapping.'}
        </HelpTip>
      </div>
      {objs.map((o, i) => (
        <ScoreObjectCard
          key={technique.technique_id + kind + i}
          obj={o}
          kind={kind}
          suggestions={suggestions}
          others={objs.filter((_, j) => j !== i).flatMap((x) => x.applicable_to)}
          defaultOpen={objs.length === 1}
          onChange={(fn) => onUpdate((t) => fn(t[kind][i]))}
          onDelete={() => onUpdate((t) => t[kind].splice(i, 1))}
        />
      ))}
      <div>
        <Button variant="outline" size="sm" onClick={() => onUpdate((t) => t[kind].push(kind === 'detection' ? newDetection([]) : newVisibility([])))}>
          <Plus /> Add {kind} score for other system(s)
        </Button>
      </div>
    </div>
  );
}

export function TechniquesEditorPage() {
  const state = useAdminFile<TechniqueFile>('technique-administration');
  const { doc, update } = state;
  const [params] = useSearchParams();
  const [selected, setSelected] = useState<string | null>(() => params.get('technique'));

  const attack = useAttackData(doc?.domain);
  const attackTechniques = useMemo(() => attack?.techniques ?? [], [attack]);
  const attackMap = useMemo(() => new Map(attackTechniques.map((t) => [t.technique_id, t])), [attackTechniques]);
  const ids = new Set(doc?.techniques.map((t) => t.technique_id));
  const current = doc?.techniques.find((t) => t.technique_id === selected) ?? null;

  const applicableTo = useMemo(() => {
    const set = new Set<string>(['all']);
    doc?.techniques.forEach((t) => [...t.detection, ...t.visibility].forEach((o) => o.applicable_to.forEach((a) => set.add(a))));
    return Array.from(set).sort();
  }, [doc?.techniques]);

  const platformMatch = (platforms: string[]) => !doc || doc.platform.includes('all') || platforms.some((p) => doc.platform.includes(p));

  const add = (id: string) => {
    if (ids.has(id)) return setSelected(id);
    update((d) => d.techniques.push(newTechnique(id, attackMap.get(id)?.technique_name ?? '')));
    setSelected(id);
  };

  const remove = (id: string) => {
    const index = doc!.techniques.findIndex((t) => t.technique_id === id);
    const removed = doc!.techniques[index];
    update((d) => d.techniques.splice(index, 1));
    if (selected === id) setSelected(null);
    toast(`${id} removed`, { action: { label: 'Undo', onClick: () => update((d) => d.techniques.splice(index, 0, removed)) } });
  };

  return (
    <EditorShell
      fileType="technique-administration"
      state={state}
      icon={ListChecks}
      runRoute="/run/visibility"
      description="Administer visibility and detection scores per ATT&CK technique, including the history of every score."
    >
      {doc && (
        <>
          <FileDetails doc={doc} update={update} hasContent={doc.techniques.length > 0} />
          <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
            <ItemList
              noun="technique"
              filters={<p className="text-xs text-muted-foreground">Suggestions: {attackSourceLabel(attack)}</p>}
              selected={selected}
              onSelect={setSelected}
              onDelete={remove}
              actions={
                <AddItemPopover
                  label="Add technique"
                  placeholder="Search ATT&CK techniques..."
                  suggestions={attackTechniques
                    .filter((t) => !ids.has(t.technique_id) && platformMatch(t.platforms))
                    .map((t) => ({ value: t.technique_id, label: `${t.technique_id} ${t.technique_name}` }))}
                  validateCustom={(v) => (/^t\d{4}(\.\d{3})?$/i.test(v) ? v.toUpperCase() : null)}
                  onAdd={add}
                />
              }
              items={doc.techniques.map((t) => ({
                key: t.technique_id,
                title: (
                  <>
                    <span className="font-mono text-xs text-muted-foreground">{t.technique_id}</span> {t.technique_name}
                  </>
                ),
                search: t.technique_id + ' ' + t.technique_name,
                sort: t.technique_id,
                right: (
                  <div className="flex gap-1">
                    <ScoreChip label="V" score={latestScore(t.visibility, 'visibility')} />
                    <ScoreChip label="D" score={latestScore(t.detection, 'detection')} />
                  </div>
                )
              }))}
            />
            <div className="min-w-0">
              {current ? (
                <Card className="gap-5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <span className="font-mono text-muted-foreground">{current.technique_id}</span>
                      {current.technique_name || attackMap.get(current.technique_id)?.technique_name}
                    </CardTitle>
                    <CardDescription className="flex flex-wrap items-center gap-2">
                      {!attackMap.has(current.technique_id) && <Badge variant="warning">unknown technique ID for this domain</Badge>}
                      {attackMap.get(current.technique_id)?.platforms.map((p) => (
                        <Badge key={p} variant="outline">
                          {p}
                        </Badge>
                      ))}
                      <a
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        href={`https://attack.mitre.org/techniques/${current.technique_id.replace('.', '/')}/`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        ATT&CK <ExternalLink className="size-3" />
                      </a>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-8">
                    {(['detection', 'visibility'] as const).map((kind) => (
                      <ScoreSection
                        key={kind}
                        technique={current}
                        kind={kind}
                        suggestions={applicableTo}
                        onUpdate={(fn) =>
                          update((d) => {
                            const t = d.techniques.find((x) => x.technique_id === current.technique_id);
                            if (t) fn(t);
                          })
                        }
                      />
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <EmptyState icon={ListChecks} title="Select a technique" description="Select a technique in the list to edit its detection and visibility scores, or add a new technique." />
              )}
            </div>
          </div>
        </>
      )}
    </EditorShell>
  );
}
