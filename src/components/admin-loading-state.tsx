export function AdminLoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] w-full flex-1 flex-col items-center justify-center gap-4 md:min-h-0">
      <div className="h-16 w-16 animate-spin rounded-full border-4 border-cyan-500/20 border-t-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
      <span className="text-sm font-bold tracking-widest text-cyan-400 uppercase animate-pulse">
        {label}
      </span>
    </div>
  );
}
