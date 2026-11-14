// Ícones SVG próprios (traço), sem biblioteca externa.

const PATHS = {
  home: ["M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"],
  book: ["M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z", "M5 19.5A1.5 1.5 0 0 0 6.5 21H19", "M9 7h6"],
  award: ["M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12z", "M8.5 14 7 22l5-3 5 3-1.5-8"],
  calendar: ["M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "M3 10h18", "M8 2v4", "M16 2v4"],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7v5l3 2"],
  sun: [
    "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    "M12 2v2",
    "M12 20v2",
    "m4.9 4.9 1.4 1.4",
    "m17.7 17.7 1.4 1.4",
    "M2 12h2",
    "M20 12h2",
    "m4.9 19.1 1.4-1.4",
    "m17.7 6.3 1.4-1.4",
  ],
  moon: ["M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"],
  monitor: ["M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z", "M8 21h8", "M12 17v4"],
  logout: ["M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3", "m10 17-5-5 5-5", "M5 12h11"],
  refresh: ["M20 11a8 8 0 1 0-2.3 5.7", "M20 4v7h-7"],
  flame: ["M12 2c1 3.5 5 5.6 5 10.5a5 5 0 0 1-10 0c0-2.3 1-3.9 2.4-5.2.2 1.7.9 2.7 2 3.1-.1-3 .1-5.6.6-8.4z"],
  shield: ["M12 3 20 6v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z", "m8.5 12 2.5 2.5 4.5-5"],
  chart: ["M4 20V4", "M4 20h16", "m7 15 4-5 3 3 5-6"],
  arrowRight: ["M5 12h14", "m13 6 6 6-6 6"],
  arrowLeft: ["M19 12H5", "m11 6-6 6 6 6"],
  alert: ["M12 3 2 20h20z", "M12 10v4", "M12 17h.01"],
  camera: [
    "M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z",
    "M12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  ],
  link: ["M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1", "M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"],
  file: ["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z", "M14 3v5h5", "M9 13h6", "M9 17h6"],
  pause: ["M9 5v14", "M15 5v14"],
  play: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "m10 8.5 5 3.5-5 3.5z"],
  flask: ["M9 3h6", "M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3", "M7 15h10"],
  external: ["M14 4h6v6", "M20 4 11 13", "M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"],
  list: ["M9 6h11", "M9 12h11", "M9 18h11", "M4 6h.01", "M4 12h.01", "M4 18h.01"],
  user: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 21a8 8 0 0 1 16 0"],
  check: ["m5 12.5 4.5 4.5L19 7.5"],
  close: ["M6 6l12 12", "M18 6 6 18"],
  plus: ["M12 5v14", "M5 12h14"],
  edit: ["M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z", "m13.5 6.5 4 4"],
  trash: ["M4 7h16", "M10 11v6", "M14 11v6", "M6 7l1 13h10l1-13", "M9 7V4h6v3"],
  chevronUp: ["m6 15 6-6 6 6"],
  chevronDown: ["m6 9 6 6 6-6"],
  layers: ["m12 3 9 5-9 5-9-5z", "m3 13 9 5 9-5"],
  lock: ["M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z", "M8 11V7a4 4 0 0 1 8 0v4"],
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" fill="#F97316" />
      <path d="M7 10.2c2.9-1.4 5.9-1.4 8.6 0v12.6c-2.7-1.4-5.7-1.4-8.6 0z" fill="#0B0B0F" />
      <path d="M25 10.2c-2.9-1.4-5.9-1.4-8.6 0v12.6c2.7-1.4 5.7-1.4 8.6 0z" fill="#FFFFFF" />
    </svg>
  );
}
