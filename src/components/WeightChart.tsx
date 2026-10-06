import { addDays, format } from 'date-fns';
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fromDateStr, toDateStr } from '../lib/dates';
import { targetWeightOn, type WeekStat } from '../lib/progress';
import type { WeighIn } from '../lib/types';

interface Props {
  weighIns: WeighIn[];
  weeks: WeekStat[];
  plan: { startDate: string; startWeightKg: number; weeklyRateKg: number; goalWeightKg: number };
  today: string;
}

interface Row {
  x: number; // ms timestamp of a local date
  weight?: number;
  avg?: number;
  target?: number;
}

const COLORS = {
  weight: 'var(--color-muted)',
  avg: 'var(--color-chart-avg)',
  target: 'var(--color-chart-target)',
};

const ts = (date: string) => fromDateStr(date).getTime();

export default function WeightChart({ weighIns, weeks, plan, today }: Props) {
  // X range: start → a week past the latest of today / last weigh-in (at least 4 weeks wide).
  const lastDate = [today, ...weighIns.map((w) => w.date)].sort().at(-1)!;
  const endCandidate = toDateStr(addDays(fromDateStr(lastDate), 7));
  const minEnd = toDateStr(addDays(fromDateStr(plan.startDate), 28));
  const endDate = endCandidate > minEnd ? endCandidate : minEnd;

  // Merge all series into rows keyed by date.
  const rows = new Map<number, Row>();
  const put = (date: string, patch: Partial<Row>) => {
    const x = ts(date);
    rows.set(x, { ...(rows.get(x) ?? { x }), ...patch });
  };
  for (const w of weighIns) if (w.date >= plan.startDate) put(w.date, { weight: w.weightKg });
  // Weekly average plotted mid-week (Thursday).
  for (const wk of weeks) if (wk.average !== null) put(toDateStr(addDays(fromDateStr(wk.weekStart), 3)), { avg: round2(wk.average) });
  put(plan.startDate, {});
  put(endDate, {});
  // The target line has a value on every row, so the tooltip can always show it.
  const data = [...rows.values()]
    .sort((a, b) => a.x - b.x)
    .map((r) => ({ ...r, target: round2(targetWeightOn(toDateStr(new Date(r.x)), plan)) }));

  // Y range: whole kg around everything shown.
  const ys = data.flatMap((r) => [r.weight, r.avg, r.target].filter((n): n is number => n !== undefined));
  const lo = Math.floor(Math.min(...ys) - 0.3);
  const hi = Math.ceil(Math.max(...ys) + 0.3);
  const step = hi - lo <= 3 ? 0.5 : hi - lo <= 8 ? 1 : 2;
  const yTicks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) yTicks.push(Math.round(v * 10) / 10);

  const x0 = ts(plan.startDate);
  const x1 = ts(endDate);
  const xTicks = Array.from({ length: 4 }, (_, i) => Math.round(x0 + ((x1 - x0) * i) / 3));

  return (
    <div>
      <Legend />
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" strokeWidth={1} />
            <XAxis
              dataKey="x"
              type="number"
              domain={[x0, x1]}
              ticks={xTicks}
              tickFormatter={(x: number) => format(new Date(x), 'd MMM')}
              tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
              axisLine={{ stroke: 'var(--color-line)' }}
              tickLine={false}
            />
            <YAxis
              domain={[lo, hi]}
              ticks={yTicks}
              tickFormatter={(v: number) => (step < 1 ? v.toFixed(1) : String(v))}
              tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: 'var(--color-muted)', strokeWidth: 1 }}
              isAnimationActive={false}
            />
            <Line
              dataKey="target"
              stroke={COLORS.target}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              dataKey="avg"
              stroke={COLORS.avg}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={{ r: 4, fill: COLORS.avg, stroke: 'var(--color-card)', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: COLORS.avg, stroke: 'var(--color-card)', strokeWidth: 2 }}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              dataKey="weight"
              stroke="none"
              dot={{ r: 3.5, fill: COLORS.weight, stroke: 'var(--color-card)', strokeWidth: 2 }}
              activeDot={{ r: 5.5, fill: COLORS.weight, stroke: 'var(--color-card)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function Legend() {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Chart legend">
      <li className="flex items-center gap-1.5">
        <svg width="10" height="10" aria-hidden><circle cx="5" cy="5" r="4" fill={COLORS.weight} /></svg>
        Weigh-ins
      </li>
      <li className="flex items-center gap-1.5">
        <svg width="18" height="10" aria-hidden>
          <line x1="1" y1="5" x2="17" y2="5" stroke={COLORS.avg} strokeWidth="2" strokeLinecap="round" />
          <circle cx="9" cy="5" r="3" fill={COLORS.avg} />
        </svg>
        Weekly average
      </li>
      <li className="flex items-center gap-1.5">
        <svg width="18" height="10" aria-hidden>
          <line x1="1" y1="5" x2="17" y2="5" stroke={COLORS.target} strokeWidth="2" strokeDasharray="5 3" />
        </svg>
        Target (+0.275 kg/week)
      </li>
    </ul>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: Row }[];
}

function ChartTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const lines: [string, number | undefined, string, number][] = [
    ['Weigh-in', row.weight, COLORS.weight, 1],
    ['Week average', row.avg, COLORS.avg, 2],
    ['Target', row.target, COLORS.target, 2],
  ];
  return (
    <div className="rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-ink">{format(new Date(row.x), 'EEE d MMM')}</p>
      {lines
        .filter(([, v]) => v !== undefined)
        .map(([label, v, color, dp]) => (
          <p key={label} className="flex items-center gap-1.5 text-muted">
            <svg width="8" height="8" aria-hidden><circle cx="4" cy="4" r="4" fill={color} /></svg>
            {label}: <span className="font-semibold tabular-nums text-ink">{v!.toFixed(dp)} kg</span>
          </p>
        ))}
    </div>
  );
}
