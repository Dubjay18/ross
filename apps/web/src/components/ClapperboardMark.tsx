interface ClapperboardMarkProps {
  size?: number;
  className?: string;
}

/**
 * Original authored brand mark (not traced from any reference) — a simple
 * clapperboard icon whose top bar "claps" shut once on mount and again on
 * hover. Pure CSS keyframe animation, disabled under reduced motion.
 */
export function ClapperboardMark({ size = 28, className = "" }: ClapperboardMarkProps) {
  return (
    <svg
      className={`clapper-mark ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 48 34"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <pattern id="clapper-stripes" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <rect width="3.5" height="7" fill="currentColor" />
        </pattern>
      </defs>
      <rect x="2" y="12" width="44" height="20" rx="2" stroke="currentColor" strokeWidth="2" />
      <rect x="4.5" y="14.5" width="39" height="15" rx="1" fill="url(#clapper-stripes)" opacity="0.3" />
      <g className="clapper-top">
        <rect x="2" y="2" width="44" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
        <rect x="4" y="4" width="40" height="6" fill="url(#clapper-stripes)" opacity="0.7" />
      </g>
    </svg>
  );
}
