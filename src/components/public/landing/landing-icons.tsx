/**
 * Inline stroke icons for the home page. Plain SVG, no icon library: the page
 * is a Server Component and this keeps the emotion style blocks of
 * `@mui/icons-material` out of the HTML.
 */

export type LandingIconName =
  | 'check'
  | 'arrow'
  | 'play'
  | 'calendar'
  | 'list'
  | 'clock'
  | 'tag'
  | 'pin'
  | 'chat'
  | 'scissors'
  | 'plus'
  | 'nail'
  | 'fork'
  | 'court'
  | 'tennis'
  | 'dumbbell'
  | 'room'
  | 'buffet'
  | 'car'
  | 'paw'
  | 'person'
  | 'menu';

const PATHS: Record<LandingIconName, string> = {
  check: 'M5 12l5 5L20 7',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  play: 'M8 5l12 7-12 7z',
  calendar: 'M3 5h18v16H3zM8 3v4M16 3v4M3 10h18',
  list: 'M4 6h16M4 12h10M4 18h7',
  clock: 'M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  tag: 'M3 7h18v10H3zM7 12h.01',
  pin: 'M12 21s-7-5-7-11a7 7 0 0114 0c0 6-7 11-7 11zM14.5 10a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z',
  chat: 'M21 15a4 4 0 01-4 4H8l-5 3V7a4 4 0 014-4h10a4 4 0 014 4z',
  scissors: 'M9 6a3 3 0 11-6 0 3 3 0 016 0zM9 18a3 3 0 11-6 0 3 3 0 016 0zM20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12',
  plus: 'M12 5v14M5 12h14M3 3h18v18H3z',
  nail: 'M8 3v8a4 4 0 008 0V3M6 21h12',
  fork: 'M7 3v18M4 3v5a3 3 0 006 0V3M16 3c-2 0-3 3-3 7h3v11',
  court: 'M3 4h18v16H3zM12 4v16M3 12h18',
  tennis: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0zM5 7c4 2 4 8 0 10M19 7c-4 2-4 8 0 10',
  dumbbell: 'M3 12h18M6 8v8M18 8v8M9 6v12M15 6v12',
  room: 'M3 4h18v14H3zM8 22h8M12 18v4',
  buffet: 'M4 18h16M6 18a6 6 0 0112 0M12 9V7',
  car: 'M3 13l2-5h14l2 5v5H3zM7 18v2M17 18v2M7.5 14.5h.01M16.5 14.5h.01',
  paw: 'M7 10a2 2 0 110-4 2 2 0 010 4zM17 10a2 2 0 110-4 2 2 0 010 4zM12 7a2 2 0 110-4 2 2 0 010 4zM12 11c-4 0-6 3-6 6a3 3 0 006 0 3 3 0 006 0c0-3-2-6-6-6z',
  person: 'M16 8a4 4 0 11-8 0 4 4 0 018 0zM4 21a8 8 0 0116 0',
  menu: 'M4 7h16M4 12h16M4 17h16',
};

/**
 * One icon.
 * @param name - Which glyph.
 * @param size - Width and height in px (default 20).
 * @param strokeWidth - Stroke in px (default 1.9).
 */
export function LandingIcon({
  name,
  size = 20,
  strokeWidth = 1.9,
  className,
}: {
  name: LandingIconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const filled = name === 'play';
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
