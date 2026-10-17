import * as React from 'react';
import { CircleHelp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FILE_TYPES } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function PageHeader({ title, description, icon: Icon, actions }: { title: string; description?: React.ReactNode; icon?: React.ElementType; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
        )}
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function HelpTip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className={cn('inline-flex text-muted-foreground hover:text-foreground', className)} tabIndex={-1}>
          <CircleHelp className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
}

export function Field({
  label,
  help,
  description,
  children,
  className,
  htmlFor
}: {
  label: React.ReactNode;
  help?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn('grid gap-2', className)}>
      <div className="flex items-center gap-1.5">
        <Label htmlFor={htmlFor}>{label}</Label>
        {help && <HelpTip>{help}</HelpTip>}
      </div>
      {children}
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, children }: { icon: React.ElementType; title: string; description?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <h3 className="font-medium">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  'navigator-layer': 'Navigator layer',
  excel: 'Excel',
  graph: 'Graph'
};

export function FileTypeBadge({ type }: { type?: string }) {
  if (!type) return <Badge variant="outline">File</Badge>;
  const label = type in FILE_TYPES ? FILE_TYPES[type as keyof typeof FILE_TYPES].label : TYPE_LABELS[type] ?? type;
  const variant = type in FILE_TYPES ? 'secondary' : 'outline';
  return <Badge variant={variant}>{label}</Badge>;
}

export function SwitchRow({ label, help, description, children }: { label: React.ReactNode; help?: React.ReactNode; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/40">
      <div className="grid gap-1">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          {label}
          {help && <HelpTip>{help}</HelpTip>}
        </div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
      {children}
    </label>
  );
}
