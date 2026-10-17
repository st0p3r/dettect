import * as React from 'react';
import { useMemo, useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface ListItem {
  key: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  search: string;
  right?: React.ReactNode;
  sort: string;
}

/**
 * Searchable list of items (data sources, techniques, groups) with selection and delete action.
 */
export function ItemList({
  items,
  selected,
  onSelect,
  onDelete,
  actions,
  noun,
  filters
}: {
  items: ListItem[];
  selected: string | null;
  onSelect: (key: string) => void;
  onDelete: (key: string) => void;
  actions?: React.ReactNode;
  noun: string;
  filters?: React.ReactNode;
}) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter((i) => !q || i.search.toLowerCase().includes(q)).sort((a, b) => a.sort.localeCompare(b.sort, undefined, { numeric: true }));
  }, [items, query]);

  return (
    <Card className="gap-3 py-4 lg:sticky lg:top-18 lg:max-h-[calc(100svh-5.5rem)]">
      <CardHeader className="gap-3 px-4">
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        <div className="relative">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${noun}s...`} className="pl-8" />
        </div>
        {filters}
        <div className="text-xs text-muted-foreground">
          Showing {shown.length} of {items.length} {noun}s
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto px-2">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-0.5">
          {shown.map((item) => (
            <div
              key={item.key}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(item.key)}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(item.key)}
              className={cn(
                'group flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-muted',
                selected === item.key && 'bg-accent text-accent-foreground hover:bg-accent'
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{item.title}</div>
                {item.subtitle && <div className="truncate text-xs text-muted-foreground">{item.subtitle}</div>}
              </div>
              {item.right}
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-7 opacity-0 group-hover:opacity-100"
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item.key);
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          {shown.length === 0 && <div className="px-2 py-6 text-center text-sm text-muted-foreground">No {noun}s found</div>}
        </div>
      </CardContent>
    </Card>
  );
}
