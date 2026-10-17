import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HelpTip } from '@/components/common';

/**
 * Edit custom key-value pairs of a YAML object, i.e. all keys that are not part of the default schema.
 */
export function KeyValueEditor({ item, defaultKeys, onChange }: { item: Record<string, unknown>; defaultKeys: string[]; onChange: (item: Record<string, unknown>) => void }) {
  const [newKey, setNewKey] = useState('');
  const custom = Object.keys(item).filter((k) => !defaultKeys.includes(k));

  const setValue = (key: string, raw: string) => {
    let value: unknown = raw;
    if (raw === 'true' || raw === 'false') value = raw === 'true';
    else if (raw.trim() !== '' && !isNaN(Number(raw))) value = Number(raw);
    onChange({ ...item, [key]: value });
  };
  const remove = (key: string) => {
    const copy = { ...item };
    delete copy[key];
    onChange(copy);
  };
  const add = () => {
    const k = newKey.trim();
    if (!k || k in item) return;
    onChange({ ...item, [k]: '' });
    setNewKey('');
  };

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        Custom key-value pairs
        <HelpTip>Add your own properties to this object. DeTT&CT keeps them and they can be used in EQL searches.</HelpTip>
      </div>
      {custom.map((k) => (
        <div key={k} className="flex items-center gap-2">
          <Input value={k} disabled className="w-48 font-mono text-xs" />
          <Input
            value={typeof item[k] === 'object' && item[k] !== null ? JSON.stringify(item[k]) : String(item[k] ?? '')}
            onChange={(e) => setValue(k, e.target.value)}
            disabled={typeof item[k] === 'object' && item[k] !== null}
            className="flex-1"
          />
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(k)}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="new key" className="w-48 font-mono text-xs" onKeyDown={(e) => e.key === 'Enter' && add()} />
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={!newKey.trim()}>
          <Plus /> Add key
        </Button>
      </div>
    </div>
  );
}
