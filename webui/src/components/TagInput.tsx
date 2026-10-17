import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface TagOption {
  value: string;
  label?: string;
  hint?: string;
}

interface TagInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  options?: (string | TagOption)[];
  placeholder?: string;
  allowCustom?: boolean;
  /** transform/validate a new value; return null to reject it */
  normalize?: (value: string) => string | null;
  isInvalid?: (value: string) => string | null;
  addLabel?: string;
  className?: string;
  /** value that can not be combined with other values (e.g. 'all') */
  exclusive?: string;
}

/**
 * A list editor showing values as removable badges, with a searchable popover to add values.
 */
export function TagInput({ value, onChange, options = [], placeholder = 'Search or type a value...', allowCustom = true, normalize, isInvalid, addLabel = 'Add', className, exclusive }: TagInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const opts = useMemo(() => options.map((o) => (typeof o === 'string' ? { value: o } : o)), [options]);
  const labelOf = useMemo(() => new Map(opts.map((o) => [o.value, o.label ?? o.value])), [opts]);
  const available = opts.filter((o) => !value.includes(o.value));

  const add = (v: string) => {
    const n = normalize ? normalize(v.trim()) : v.trim();
    if (!n || value.includes(n)) return;
    if (exclusive && n === exclusive) onChange([n]);
    else onChange([...value.filter((x) => x !== exclusive), n]);
    setSearch('');
  };

  const custom = search.trim();
  const showCustom = allowCustom && custom && !value.includes(custom) && !opts.some((o) => o.value.toLowerCase() === custom.toLowerCase());

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {value.map((v) => {
        const problem = isInvalid?.(v);
        return (
          <Badge key={v} variant={problem ? 'destructive' : 'secondary'} className="h-7 gap-1 pr-1 pl-2 text-[13px] font-normal" title={problem ?? labelOf.get(v)}>
            <span className="max-w-[320px] truncate">{labelOf.get(v) ?? v}</span>
            <button type="button" className="rounded-sm p-0.5 opacity-60 hover:bg-foreground/10 hover:opacity-100" onClick={() => onChange(value.filter((x) => x !== v))}>
              <X className="size-3" />
            </button>
          </Badge>
        );
      })}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-7 border-dashed text-xs">
            <Plus className="size-3.5" /> {addLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandInput placeholder={placeholder} value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>{allowCustom ? 'Type a value and press Enter.' : 'No results.'}</CommandEmpty>
              {showCustom && (
                <CommandGroup>
                  <CommandItem value={'__custom__' + custom} onSelect={() => add(custom)}>
                    <Plus /> Add “{custom}”
                  </CommandItem>
                </CommandGroup>
              )}
              {available.length > 0 && (
                <CommandGroup>
                  {available.slice(0, 400).map((o) => (
                    <CommandItem key={o.value} value={(o.label ?? o.value) + ' ' + o.value} onSelect={() => add(o.value)}>
                      <span className="truncate">{o.label ?? o.value}</span>
                      {o.hint && <span className="ml-auto text-xs text-muted-foreground">{o.hint}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
