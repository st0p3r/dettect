import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Plus, Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { EmptyState, Field } from '@/components/common';
import { TagInput } from '@/components/TagInput';
import { KeyValueEditor } from '@/components/KeyValueEditor';
import { EditorShell } from '@/components/editor/EditorShell';
import { FileDetails } from '@/components/editor/FileDetails';
import { ItemList } from '@/components/editor/ItemList';
import { useAdminFile } from '@/hooks/use-admin-file';
import { getSoftware, getTechniques } from '@/lib/attack';
import { newGroup, type GroupFile } from '@/lib/constants';

const GROUP_KEYS = Object.keys(newGroup(''));

export function GroupsEditorPage() {
  const state = useAdminFile<GroupFile>('group-administration');
  const { doc, update } = state;
  const [selected, setSelected] = useState<number | null>(null);

  const platformMatch = (platforms: string[]) => !doc || doc.platform.includes('all') || platforms.some((p) => doc.platform.includes(p));
  const techniqueOptions = useMemo(
    () => (doc ? getTechniques(doc.domain).filter((t) => platformMatch(t.platforms)).map((t) => ({ value: t.technique_id, label: `${t.technique_id} ${t.technique_name}` })) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc?.domain, doc?.platform]
  );
  const softwareOptions = useMemo(
    () => (doc ? getSoftware(doc.domain).filter((s) => platformMatch(s.platforms)).map((s) => ({ value: s.software_id, label: `${s.software_id} ${s.software_name}` })) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc?.domain, doc?.platform]
  );

  const current = selected !== null ? doc?.groups[selected] : undefined;
  const duplicate =
    current && doc!.groups.filter((g) => g.group_name.toLowerCase() === current.group_name.toLowerCase() && g.campaign.toLowerCase() === current.campaign.toLowerCase()).length > 1;

  const add = () => {
    update((d) => d.groups.push(newGroup('New group', '')));
    setSelected(doc!.groups.length);
  };

  const remove = (key: string) => {
    const index = Number(key);
    const removed = doc!.groups[index];
    update((d) => d.groups.splice(index, 1));
    setSelected(null);
    toast(`'${removed.group_name}' removed`, { action: { label: 'Undo', onClick: () => update((d) => d.groups.splice(index, 0, removed)) } });
  };

  const set = (fn: (g: GroupFile['groups'][number]) => void) => update((d) => fn(d.groups[selected!]));

  return (
    <EditorShell
      fileType="group-administration"
      state={state}
      icon={Users}
      runRoute="/run/groups"
      description="Administer your own threat actor groups, campaigns or red team scenarios as a list of ATT&CK techniques and software."
    >
      {doc && (
        <>
          <FileDetails doc={doc} update={update} hasContent={doc.groups.length > 0} />
          <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
            <ItemList
              noun="group"
              selected={selected === null ? null : String(selected)}
              onSelect={(k) => setSelected(Number(k))}
              onDelete={remove}
              actions={
                <Button size="sm" onClick={add}>
                  <Plus /> Add group
                </Button>
              }
              items={doc.groups.map((g, i) => ({
                key: String(i),
                title: g.group_name,
                subtitle: (g.campaign ? g.campaign + ' · ' : '') + `${g.technique_id.length} techniques, ${g.software_id.length} software`,
                search: g.group_name + ' ' + g.campaign,
                sort: g.group_name + ' ' + g.campaign,
                right: <Badge variant={g.enabled ? 'success' : 'outline'}>{g.enabled ? 'enabled' : 'disabled'}</Badge>
              }))}
            />
            <div className="min-w-0">
              {current ? (
                <Card className="gap-5">
                  <CardHeader>
                    <CardTitle className="text-lg">{current.group_name || 'Unnamed group'}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-5">
                    <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                      <Field label="Group name">
                        <Input value={current.group_name} onChange={(e) => set((g) => (g.group_name = e.target.value))} />
                      </Field>
                      <Field label="Campaign" help="Optional. The combination of group name and campaign must be unique.">
                        <Input value={current.campaign} onChange={(e) => set((g) => (g.campaign = e.target.value))} />
                      </Field>
                      <label className="flex h-9 items-center gap-2 text-sm font-medium">
                        <Switch checked={current.enabled} onCheckedChange={(v) => set((g) => (g.enabled = v))} /> Enabled
                      </label>
                    </div>
                    {duplicate && (
                      <Alert variant="warning">
                        <AlertTriangle />
                        <AlertDescription>The combination of group name and campaign should be unique.</AlertDescription>
                      </Alert>
                    )}
                    <Field label={`Techniques (${current.technique_id.length})`} help="The ATT&CK techniques used by this group / campaign.">
                      <TagInput
                        value={current.technique_id}
                        onChange={(v) => set((g) => (g.technique_id = v))}
                        options={techniqueOptions}
                        addLabel="Add technique"
                        normalize={(v) => (/^t\d{4}(\.\d{3})?$/i.test(v) ? v.toUpperCase() : null)}
                        isInvalid={(v) => (techniqueOptions.some((o) => o.value === v) ? null : 'Unknown technique for the selected domain/platforms')}
                      />
                      {current.technique_id.length === 0 && <p className="text-xs text-destructive">A group should contain at least one technique.</p>}
                    </Field>
                    <Field label={`Software (${current.software_id.length})`} help="The ATT&CK software used. Its techniques can be added to the heat map with the software options in the threat group analysis.">
                      <TagInput
                        value={current.software_id}
                        onChange={(v) => set((g) => (g.software_id = v))}
                        options={softwareOptions}
                        addLabel="Add software"
                        normalize={(v) => (/^s\d{4}$/i.test(v) ? v.toUpperCase() : null)}
                      />
                    </Field>
                    <KeyValueEditor
                      item={current}
                      defaultKeys={GROUP_KEYS}
                      onChange={(item) =>
                        set((g) => {
                          for (const k of Object.keys(g)) if (!(k in item)) delete g[k];
                          Object.assign(g, item);
                        })
                      }
                    />
                  </CardContent>
                </Card>
              ) : (
                <EmptyState icon={Users} title="Select a group" description="Select a group in the list to edit it, or add a new group." />
              )}
            </div>
          </div>
        </>
      )}
    </EditorShell>
  );
}
