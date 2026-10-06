import { NavLink } from 'react-router';
import type { ReactNode } from 'react';
import { PlanIcon, ProgressIcon, SettingsIcon, TodayIcon } from './icons';

const tabs: { to: string; label: string; icon: ReactNode }[] = [
  { to: '/', label: 'Today', icon: <TodayIcon size={22} /> },
  { to: '/plan', label: 'Plan', icon: <PlanIcon size={22} /> },
  { to: '/progress', label: 'Progress', icon: <ProgressIcon size={22} /> },
  { to: '/settings', label: 'Settings', icon: <SettingsIcon size={22} /> },
];

export default function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/90 backdrop-blur-lg"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-lg px-2">
        {tabs.map((t) => (
          <li key={t.to} className="flex-1">
            <NavLink
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                `group flex flex-col items-center gap-0.5 pt-2 pb-2.5 text-[11px] font-semibold ${isActive ? 'text-accent' : 'text-muted'}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${isActive ? 'bg-accent-soft' : ''}`}>
                    {t.icon}
                  </span>
                  {t.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
