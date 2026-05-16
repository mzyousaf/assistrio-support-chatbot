export function LeadsLoadingSkeleton() {
  return (
    <div className="w-full overflow-x-auto [-webkit-overflow-scrolling:touch]" aria-busy aria-label="Loading leads">
      <div className="w-full min-w-[72rem]">
        <div className="flex border-b border-slate-200 bg-slate-50/80 py-2.5 pl-4 pr-2 sm:pl-5 sm:pr-3">
          <div className="h-4 w-28 max-w-[22%] shrink-0 animate-pulse rounded-md bg-slate-200/75" />
          <div className="mx-3 h-4 w-20 shrink-0 animate-pulse rounded-md bg-slate-200/75" />
          <div className="mx-3 h-4 w-24 shrink-0 animate-pulse rounded-md bg-slate-200/75" />
          <div className="h-4 min-w-0 flex-1 animate-pulse rounded-md bg-slate-200/75" />
          <div className="mx-3 h-4 w-20 shrink-0 animate-pulse rounded-md bg-slate-200/75" />
          <div className="ml-auto h-4 w-36 shrink-0 animate-pulse rounded-md bg-slate-200/75" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-2 border-b border-slate-100 py-2.5 pl-4 pr-2 sm:pl-5 sm:pr-3"
          >
            <div
              className="h-4 w-32 max-w-[22%] shrink-0 animate-pulse rounded-md bg-slate-100"
              style={{ animationDelay: `${i * 35}ms` }}
            />
            <div
              className="h-5 w-20 shrink-0 animate-pulse rounded-md bg-slate-100"
              style={{ animationDelay: `${i * 35}ms` }}
            />
            <div
              className="h-4 w-24 shrink-0 animate-pulse rounded-md bg-slate-100"
              style={{ animationDelay: `${i * 35}ms` }}
            />
            <div
              className="h-4 min-w-0 flex-1 animate-pulse rounded-md bg-slate-100/90"
              style={{ animationDelay: `${i * 35}ms` }}
            />
            <div
              className="h-5 w-24 shrink-0 animate-pulse rounded-md bg-slate-100"
              style={{ animationDelay: `${i * 35}ms` }}
            />
            <div
              className="ml-auto h-8 w-40 shrink-0 animate-pulse rounded-md bg-slate-100/80"
              style={{ animationDelay: `${i * 35}ms` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
