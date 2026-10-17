import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const COLORS: Record<number, string> = {
  [-1]: 'data-[on=true]:bg-muted-foreground data-[on=true]:text-background',
  0: 'data-[on=true]:bg-slate-500 data-[on=true]:text-white',
  1: 'data-[on=true]:bg-amber-500 data-[on=true]:text-white',
  2: 'data-[on=true]:bg-yellow-500 data-[on=true]:text-white',
  3: 'data-[on=true]:bg-lime-500 data-[on=true]:text-white',
  4: 'data-[on=true]:bg-green-600 data-[on=true]:text-white',
  5: 'data-[on=true]:bg-emerald-700 data-[on=true]:text-white'
};

/**
 * Pick a score from a fixed scale; each score has a descriptive label shown in a tooltip and below the buttons.
 */
export function ScorePicker({ value, onChange, scores, size = 'default', showLabel = true }: { value: number; onChange: (v: number) => void; scores: Record<number, string>; size?: 'sm' | 'default'; showLabel?: boolean }) {
  const keys = Object.keys(scores)
    .map(Number)
    .sort((a, b) => a - b);
  return (
    <div className="grid gap-1.5">
      <div className="inline-flex w-fit overflow-hidden rounded-md border shadow-xs">
        {keys.map((k) => (
          <Tooltip key={k}>
            <TooltipTrigger asChild>
              <button
                type="button"
                data-on={value === k}
                onClick={() => onChange(k)}
                className={cn(
                  'border-r font-medium tabular-nums transition-colors last:border-r-0 hover:bg-muted',
                  size === 'sm' ? 'h-7 min-w-7 px-1.5 text-xs' : 'h-8 min-w-9 px-2 text-sm',
                  COLORS[k]
                )}
              >
                {k}
              </button>
            </TooltipTrigger>
            <TooltipContent>{scores[k]}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      {showLabel && <div className="text-xs text-muted-foreground">{scores[value] ?? 'Unknown score'}</div>}
    </div>
  );
}
