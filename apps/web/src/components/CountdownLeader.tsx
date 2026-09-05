/**
 * Original authored "film leader" countdown loop — the classic academy
 * countdown circle (3-2-1, radial sweep) used as a section-transition motif.
 * It's the site's one looping ambient animation, standing in for the "gif"
 * moment without shipping an actual raster asset. Reduced motion freezes it
 * on a single static frame via CSS (see .leader-digit / .leader-sweep rules).
 */
export function CountdownLeader({ size = 56 }: { size?: number }) {
  return (
    <div className="leader" style={{ width: size, height: size }} aria-hidden="true">
      <svg className="leader-ring" viewBox="0 0 100 100" width={size} height={size} fill="none">
        <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="2" opacity="0.5" />
        <line x1="50" y1="4" x2="50" y2="18" stroke="currentColor" strokeWidth="2" opacity="0.5" />
        <line x1="50" y1="82" x2="50" y2="96" stroke="currentColor" strokeWidth="2" opacity="0.5" />
        <line x1="4" y1="50" x2="18" y2="50" stroke="currentColor" strokeWidth="2" opacity="0.5" />
        <line x1="82" y1="50" x2="96" y2="50" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      </svg>
      <span className="leader-sweep" />
      <span className="leader-digits">
        <span className="leader-digit">3</span>
        <span className="leader-digit">2</span>
        <span className="leader-digit">1</span>
      </span>
    </div>
  );
}
