export function LeadDetailDrawerSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100/95" style={{ animationDelay: `${i * 45}ms` }} />
      ))}
    </div>
  );
}
