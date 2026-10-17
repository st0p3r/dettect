import * as React from 'react';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface Suggestion {
  value: string;
  label: string;
  hint?: string;
}

/**
 * Button with a searchable popover to pick a new item from a list of suggestions, or to add a custom value.
 */
export function AddItemPopover({
  label,
  suggestions,
  onAdd,
  allowCustom = true,
  validateCustom,
  placeholder,
  trigger
}: {
  label: string;
  suggestions: Suggestion[];
  onAdd: (value: string) => void;
  allowCustom?: boolean;
  validateCustom?: (value: string) => string | null;
  placeholder?: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const custom = search.trim();
  const customValue = custom && validateCustom ? validateCustom(custom) : custom;
  const showCustom = allowCustom && customValue && !suggestions.some((s) => s.value.toLowerCase() === customValue.toLowerCase());

  const pick = (v: string) => {
    onAdd(v);
    setSearch('');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus /> {label}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder ?? 'Search...'} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{allowCustom ? 'No suggestions. Type a valid value to add it.' : 'No results.'}</CommandEmpty>
            {showCustom && (
              <CommandGroup heading="Custom">
                <CommandItem value={'__custom__' + custom} onSelect={() => pick(customValue!)}>
                  <Plus /> Add “{customValue}”
                </CommandItem>
              </CommandGroup>
            )}
            {suggestions.length > 0 && (
              <CommandGroup heading="Suggestions">
                {suggestions.slice(0, 500).map((s) => (
                  <CommandItem key={s.value} value={s.label + ' ' + s.value} onSelect={() => pick(s.value)}>
                    <span className="truncate">{s.label}</span>
                    {s.hint && <span className="ml-auto shrink-0 text-xs text-muted-foreground">{s.hint}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
