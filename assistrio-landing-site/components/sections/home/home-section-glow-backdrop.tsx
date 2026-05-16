/**
 * Shared teal radial stack for homepage “glow” bands.
 * Parent must be `relative overflow-hidden`. Place this first; put content in a sibling with `relative z-10`.
 */
export function HomeSectionGlowBackdrop() {
  return (
    <>
      <div className="absolute inset-0 bg-[var(--background)]" aria-hidden />
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute inset-x-0 top-0 h-[min(48vh,26rem)] bg-[radial-gradient(ellipse_82%_88%_at_50%_0%,rgba(13,148,136,0.09),transparent_72%)]" />
        <div className="absolute inset-x-0 bottom-0 h-[min(38%,14rem)] bg-[radial-gradient(ellipse_95%_100%_at_50%_100%,rgba(13,148,136,0.045),transparent_74%)]" />
        <div className="absolute -bottom-20 left-1/2 h-60 w-[min(95%,52rem)] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(13,148,136,0.065),transparent_68%)] blur-3xl" />
      </div>
    </>
  );
}
