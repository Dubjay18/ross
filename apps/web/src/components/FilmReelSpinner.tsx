interface FilmReelSpinnerProps {
  size?: number;
  className?: string;
}

/** Original authored loading indicator shaped like a film reel, replacing a generic ring spinner. */
export function FilmReelSpinner({ size = 16, className = "" }: FilmReelSpinnerProps) {
  const holes = [
    [18.5, 12],
    [14.0, 18.18],
    [6.74, 15.82],
    [6.74, 8.18],
    [14.0, 5.82],
  ];

  return (
    <svg
      className={`film-reel-spinner ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" opacity="0.4" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" opacity="0.6" />
      {holes.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="1.6" fill="currentColor" opacity="0.6" />
      ))}
    </svg>
  );
}
