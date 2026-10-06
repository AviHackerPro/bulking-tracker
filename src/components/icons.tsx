// Small line icons (24×24, currentColor). Kept in one place so the look stays consistent.

import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, strokeWidth = 2, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

export const CheckIcon = (p: IconProps) => <Icon strokeWidth={2.75} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Icon>;
export const PlusIcon = (p: IconProps) => <Icon strokeWidth={2.5} {...p}><path d="M12 5v14M5 12h14" /></Icon>;
export const XIcon = (p: IconProps) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>;
export const ChevronLeft = (p: IconProps) => <Icon strokeWidth={2.25} {...p}><path d="M15 6l-6 6 6 6" /></Icon>;
export const ChevronRight = (p: IconProps) => <Icon strokeWidth={2.25} {...p}><path d="M9 6l6 6-6 6" /></Icon>;
export const ChevronDown = (p: IconProps) => <Icon strokeWidth={2.25} {...p}><path d="M6 9l6 6 6-6" /></Icon>;
export const SwapIcon = (p: IconProps) => <Icon {...p}><path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" /></Icon>;
export const SkipIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></Icon>;
export const UndoIcon = (p: IconProps) => <Icon {...p}><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 010 11H11" /></Icon>;
export const TrashIcon = (p: IconProps) => <Icon {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" /></Icon>;
export const SparkIcon = (p: IconProps) => <Icon {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" /></Icon>;

// Bottom navigation
export const TodayIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Icon>;
export const PlanIcon = (p: IconProps) => <Icon {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8.5 3v4M15.5 3v4" /></Icon>;
export const ProgressIcon = (p: IconProps) => <Icon {...p}><path d="M4 19l5.5-6.5 4 3L20 7" /><path d="M15 7h5v5" /></Icon>;
export const SettingsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </Icon>
);
export const DumbbellIcon = (p: IconProps) => <Icon {...p}><path d="M6.5 8v8M3.5 10v4M17.5 8v8M20.5 10v4M6.5 12h11" /></Icon>;
export const ScaleIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <path d="M8.5 9.5a5 5 0 017 0M12 9.5l1.2-1.7" />
  </Icon>
);
