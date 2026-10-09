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

// Actions & status
export const SparkleIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    <path d="M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z" />
  </Icon>
);
export const BarcodeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7V5a1 1 0 011-1h2M17 4h2a1 1 0 011 1v2M20 17v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2" />
    <path d="M8 8v8M11 8v8M14 8v8M17 8v8" />
  </Icon>
);
export const CameraIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8.5a2 2 0 012-2h1.5l1.5-2h6l1.5 2H18a2 2 0 012 2V17a2 2 0 01-2 2H6a2 2 0 01-2-2z" />
    <circle cx="12" cy="12.5" r="3.5" />
  </Icon>
);
export const ImageIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
    <circle cx="9" cy="10" r="1.5" />
    <path d="M20.5 16l-5-5-8.5 8.5" />
  </Icon>
);
export const NoteIcon = (p: IconProps) => <Icon {...p}><path d="M5 5h14v10l-4 4H5z" /><path d="M15 19v-4h4M8 9h8M8 12.5h5" /></Icon>;
export const SchoolIcon = (p: IconProps) => <Icon {...p}><path d="M3 9l9-4.5L21 9l-9 4.5z" /><path d="M7 11v5c1.5 1.5 3 2 5 2s3.5-.5 5-2v-5M21 9v5" /></Icon>;
export const HomeIcon = (p: IconProps) => <Icon {...p}><path d="M4 10.5L12 4l8 6.5V19a1 1 0 01-1 1h-4.5v-5.5h-5V20H5a1 1 0 01-1-1z" /></Icon>;
export const TargetIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></Icon>;
export const TrophyIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 4h8v5a4 4 0 01-8 0z" />
    <path d="M8 6H5v1.5A3.5 3.5 0 008.5 11M16 6h3v1.5a3.5 3.5 0 01-3.5 3.5M12 13v4M8.5 20h7M10 17h4v3h-4z" />
  </Icon>
);
