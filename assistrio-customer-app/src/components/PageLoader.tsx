type Props = {
  title?: string;
};

export function PageLoader({ title = 'Loading…' }: Props) {
  return (
    <div
      className="flex min-h-svh flex-col items-center justify-center"
      style={{ background: 'var(--bg-app)' }}
      role="status"
      aria-live="polite"
    >
      <div className="relative flex items-center justify-center" style={{ width: 40, height: 40 }}>
        {/* Radiating waves */}
        <span className="page-loader-wave absolute inset-0 rounded-full" style={{ animationDelay: '0s' }} />
        <span className="page-loader-wave absolute inset-0 rounded-full" style={{ animationDelay: '0.55s' }} />
        <span className="page-loader-wave absolute inset-0 rounded-full" style={{ animationDelay: '1.1s' }} />
        <span className="page-loader-wave absolute inset-0 rounded-full" style={{ animationDelay: '1.65s' }} />

        {/* Donut track */}
        <span className="absolute inset-0 rounded-full border-[3px] border-teal-100" />

        {/* Spinning arc */}
        <span className="page-loader-spin absolute inset-0 rounded-full border-[3px] border-transparent border-t-teal-500 border-r-teal-500" />
      </div>

      <p className="page-loader-text mt-6 text-sm font-medium">
        {title}
      </p>
    </div>
  );
}

export function InlineLoader({ title = 'Loading…' }: Props) {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center py-0"
      role="status"
      aria-live="polite"
    >
      <div className="relative flex items-center justify-center" style={{ width: 32, height: 32 }}>
        <span className="page-loader-wave absolute inset-0 rounded-full" style={{ animationDelay: '0s' }} />
        <span className="page-loader-wave absolute inset-0 rounded-full" style={{ animationDelay: '0.55s' }} />
        <span className="page-loader-wave absolute inset-0 rounded-full" style={{ animationDelay: '1.1s' }} />
        <span className="page-loader-wave absolute inset-0 rounded-full" style={{ animationDelay: '1.65s' }} />

        <span className="absolute inset-0 rounded-full border-[2.5px] border-teal-100" />
        <span className="page-loader-spin absolute inset-0 rounded-full border-[2.5px] border-transparent border-t-teal-500 border-r-teal-500" />
      </div>

      <p className="page-loader-text mt-5 text-[0.8125rem] font-medium">
        {title}
      </p>
    </div>
  );
}
