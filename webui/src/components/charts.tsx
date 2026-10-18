import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export const SERIES = {
  visibility: { label: 'Visibility', color: 'var(--series-1)' },
  detection: { label: 'Detection', color: 'var(--series-2)' }
} as const;

type SeriesKey = keyof typeof SERIES;

export function Legend({ series, kind = 'rect' }: { series: SeriesKey[]; kind?: 'rect' | 'line' }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      {series.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          {kind === 'rect' ? (
            <span className="size-2.5 rounded-[2px]" style={{ background: SERIES[s].color }} />
          ) : (
            <span className="h-0.5 w-3.5 rounded-full" style={{ background: SERIES[s].color }} />
          )}
          {SERIES[s].label}
        </span>
      ))}
    </div>
  );
}

/** A small tooltip that follows the pointer within a relatively positioned container. */
function useTooltip<T>() {
  const [tip, setTip] = useState<{ x: number; y: number; data: T } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const show = (e: React.PointerEvent | React.FocusEvent, data: T) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const target = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = 'clientX' in e ? e.clientX : target.left + target.width / 2;
    const y = 'clientY' in e ? e.clientY : target.top;
    setTip({ x: x - box.left, y: y - box.top, data });
  };
  return { tip, ref, show, hide: () => setTip(null) };
}

function TooltipBox({ x, y, children, containerWidth }: { x: number; y: number; children: React.ReactNode; containerWidth: number }) {
  const flip = x > containerWidth - 200;
  return (
    <div
      className="pointer-events-none absolute z-10 min-w-36 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
      style={{ left: flip ? undefined : x + 12, right: flip ? containerWidth - x + 12 : undefined, top: Math.max(0, y - 12) }}
    >
      {children}
    </div>
  );
}

function TooltipRow({ series, value }: { series: SeriesKey; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-0.5 w-3 rounded-full" style={{ background: SERIES[series].color }} />
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground">{SERIES[series].label}</span>
    </div>
  );
}

const pct = (n: number, total: number) => (total ? Math.round((100 * n) / total) : 0);

/**
 * Horizontal grouped bars: per tactic the percentage of techniques with visibility and with detection.
 */
export function TacticBars({ rows }: { rows: { name: string; total: number; visibility: number; detection: number }[] }) {
  const { tip, ref, show, hide } = useTooltip<(typeof rows)[number]>();
  const shown = rows.filter((r) => r.total > 0);
  return (
    <div ref={ref} className="relative grid gap-3" onPointerLeave={hide}>
      {shown.map((r) => (
        <div
          key={r.name}
          tabIndex={0}
          className="group grid grid-cols-[minmax(0,9.5rem)_1fr] items-center gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:grid-cols-[minmax(0,11rem)_1fr]"
          onPointerMove={(e) => show(e, r)}
          onFocus={(e) => show(e, r)}
          onBlur={hide}
        >
          <div className="truncate text-right text-xs text-muted-foreground" title={r.name}>
            {r.name}
          </div>
          <div className="grid gap-0.5 rounded-sm group-hover:bg-muted/50">
            {(['visibility', 'detection'] as const).map((k) => {
              const p = pct(r[k], r.total);
              return (
                <div key={k} className="flex h-3.5 items-center gap-2">
                  <div className="h-full rounded-r-[4px] transition-[width]" style={{ width: `calc(${p}% * 0.88)`, minWidth: r[k] ? 2 : 0, background: SERIES[k].color }} />
                  <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{p}%</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {shown.length === 0 && <p className="text-sm text-muted-foreground">No techniques in scope.</p>}
      {tip && (
        <TooltipBox x={tip.x} y={tip.y} containerWidth={ref.current?.clientWidth ?? 0}>
          <div className="mb-1 font-medium">{tip.data.name}</div>
          <TooltipRow series="visibility" value={`${tip.data.visibility} / ${tip.data.total} (${pct(tip.data.visibility, tip.data.total)}%)`} />
          <TooltipRow series="detection" value={`${tip.data.detection} / ${tip.data.total} (${pct(tip.data.detection, tip.data.total)}%)`} />
        </TooltipBox>
      )}
    </div>
  );
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

function niceMax(v: number) {
  if (v <= 5) return 5;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= v) return m * mag;
  return 10 * mag;
}

const formatMonth = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

/**
 * Line chart with the number of techniques with visibility and detection per month, with a crosshair tooltip.
 */
export function TrendChart({ points }: { points: { month: string; visibility: number; detection: number }[] }) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const height = 240;
  const m = { top: 12, right: 44, bottom: 28, left: 40 };
  const w = Math.max(100, width - m.left - m.right);
  const h = height - m.top - m.bottom;
  const max = niceMax(Math.max(1, ...points.map((p) => Math.max(p.visibility, p.detection))));
  const x = (i: number) => m.left + (points.length <= 1 ? w / 2 : (i / (points.length - 1)) * w);
  const y = (v: number) => m.top + h - (v / max) * h;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(t * max));
  const xTickEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(w / 90))));
  const path = (k: SeriesKey) => points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join('');
  const last = points.length - 1;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - box.left) / box.width;
    setHover(Math.min(last, Math.max(0, Math.round(rel * last))));
  };

  return (
    <div ref={ref} className="relative w-full">
      <svg width={width} height={height} role="img" aria-label="Techniques with visibility and detection over time">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={m.left + w} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
              {t}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          (i % xTickEvery === 0 && last - i >= xTickEvery) || i === last ? (
            <text key={p.month} x={x(i)} y={height - 8} textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'} className="fill-muted-foreground text-[11px]">
              {formatMonth(p.month)}
            </text>
          ) : null
        )}
        {(['visibility', 'detection'] as const).map((k) => (
          <g key={k}>
            <path d={path(k)} fill="none" stroke={SERIES[k].color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {points.length > 0 && (
              <>
                <circle cx={x(last)} cy={y(points[last][k])} r={4} fill={SERIES[k].color} stroke="var(--card)" strokeWidth={2} />
                <text x={x(last) + 8} y={y(points[last][k])} dy="0.32em" className="fill-foreground text-[11px] font-medium tabular-nums">
                  {points[last][k]}
                </text>
              </>
            )}
          </g>
        ))}
        {hover !== null && points[hover] && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={m.top} y2={m.top + h} stroke="var(--muted-foreground)" strokeWidth={1} opacity={0.5} />
            {(['visibility', 'detection'] as const).map((k) => (
              <circle key={k} cx={x(hover)} cy={y(points[hover][k])} r={4} fill={SERIES[k].color} stroke="var(--card)" strokeWidth={2} />
            ))}
          </g>
        )}
        <rect x={m.left} y={m.top} width={w} height={h} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {hover !== null && points[hover] && (
        <TooltipBox x={x(hover)} y={m.top + 8} containerWidth={width}>
          <div className="mb-1 font-medium">{formatMonth(points[hover].month)}</div>
          <TooltipRow series="visibility" value={String(points[hover].visibility)} />
          <TooltipRow series="detection" value={String(points[hover].detection)} />
        </TooltipBox>
      )}
    </div>
  );
}

/**
 * Columns with the number of techniques per score.
 */
export function ScoreColumns({ series, entries }: { series: SeriesKey; entries: { score: number; label: string; count: number }[] }) {
  const { tip, ref, show, hide } = useTooltip<(typeof entries)[number]>();
  const max = Math.max(1, ...entries.map((e) => e.count));
  return (
    <div ref={ref} className="relative" onPointerLeave={hide}>
      <div className="flex h-36 items-end gap-0.5">
        {entries.map((e) => (
          <div
            key={e.score}
            tabIndex={0}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-sm outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50"
            onPointerMove={(ev) => show(ev, e)}
            onFocus={(ev) => show(ev, e)}
            onBlur={hide}
          >
            <span className="text-[11px] text-muted-foreground tabular-nums">{e.count}</span>
            <div className="w-full max-w-6 rounded-t-[4px]" style={{ height: `${(e.count / max) * 75}%`, minHeight: e.count ? 2 : 0, background: SERIES[series].color }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-0.5 border-t pt-1.5">
        {entries.map((e) => (
          <div key={e.score} className="min-w-0 flex-1 text-center text-[11px] text-muted-foreground tabular-nums">
            {e.score}
          </div>
        ))}
      </div>
      {tip && (
        <TooltipBox x={tip.x} y={tip.y} containerWidth={ref.current?.clientWidth ?? 0}>
          <div className="font-semibold tabular-nums">{tip.data.count} techniques</div>
          <div className="text-muted-foreground">
            score {tip.data.score} · {tip.data.label}
          </div>
        </TooltipBox>
      )}
    </div>
  );
}

export function Meter({ value, series, className }: { value: number; series: SeriesKey; className?: string }) {
  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full', className)}
      style={{ background: `color-mix(in oklab, ${SERIES[series].color} 18%, transparent)` }}
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, value)}%`, background: SERIES[series].color }} />
    </div>
  );
}
