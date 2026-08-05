export default function Loading() {
  return (
    <div className="flex h-[60vh] w-full flex-1 items-center justify-center animate-in fade-in duration-500">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-500/30 border-t-cyan-500 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
    </div>
  );
}
