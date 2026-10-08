import { formatTime } from '../lib/dates';
import { isSwapped } from '../lib/daylog';
import type { DayLog, SlotConfig } from '../lib/types';
import { CheckIcon } from './icons';
import { MacroLine, SlotIcon } from './ui';

/** One meal slot as a slim row: tap the row for details, tap the circle to tick it off. */
export default function MealRow({
  slot,
  log,
  onOpen,
  onToggleEaten,
}: {
  slot: SlotConfig;
  log: DayLog;
  onOpen: () => void;
  onToggleEaten: () => void;
}) {
  const entry = log.slots[slot.id];
  const school = log.dayType === 'school';
  const eaten = entry.status === 'eaten';
  const skipped = entry.status === 'skipped';
  const label = school ? slot.label : slot.homeLabel;
  const time = formatTime(school ? slot.schoolTime : slot.homeTime);

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`${label}: ${entry.meal?.name ?? 'no meal'}. Open details`}>
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors ${
            eaten ? 'bg-accent-soft text-accent' : 'bg-track text-muted'
          } ${skipped ? 'opacity-40' : ''}`}
        >
          <SlotIcon slot={slot.id} />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
            {time} · {label}
            {isSwapped(log, slot.id) && <span className="rounded-md bg-track px-1.5 py-px text-[10px] font-semibold">Swapped</span>}
          </span>
          <span className={`block truncate font-semibold ${skipped ? 'text-muted line-through decoration-muted/40' : ''}`}>
            {entry.meal?.name ?? 'Choose a meal'}
          </span>
          {skipped ? (
            <span className="text-sm text-muted">Skipped</span>
          ) : entry.meal ? (
            <MacroLine m={entry.meal} />
          ) : null}
        </span>
      </button>

      {!skipped && entry.meal && (
        <button
          onClick={onToggleEaten}
          aria-pressed={eaten}
          aria-label={eaten ? `Undo ${label}` : `Mark ${label} as eaten`}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90 ${
            eaten ? 'border-accent bg-accent text-accent-ink' : 'border-line text-transparent hover:text-muted/40'
          }`}
        >
          <CheckIcon size={20} />
        </button>
      )}
    </li>
  );
}
