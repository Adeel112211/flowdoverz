import { ChevronLeft, ChevronRight } from "lucide-react";

type AdminTablePaginationProps = {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
};

export function AdminTablePagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  loading = false,
  onPageChange,
}: AdminTablePaginationProps) {
  if (totalCount <= 0) return null;

  const pageStart = (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, totalCount);
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-400">
        Showing {pageStart.toLocaleString()}–{pageEnd.toLocaleString()} of {totalCount.toLocaleString()}
      </p>
      <div className="flex items-center justify-center gap-1">
        <button
          type="button"
          aria-label="Previous page"
          disabled={currentPage <= 1 || loading}
          onClick={() => onPageChange(currentPage - 1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((page) => (
          <button
            key={page}
            type="button"
            aria-label={`Page ${page}`}
            aria-current={page === currentPage ? "page" : undefined}
            disabled={loading}
            onClick={() => onPageChange(page)}
            className={`inline-flex h-9 min-w-9 items-center justify-center rounded-xl border px-2 text-sm font-bold tabular-nums transition-colors ${
              page === currentPage
                ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200"
                : "border-white/10 text-slate-300 hover:bg-white/5"
            } disabled:opacity-40`}
          >
            {page}
          </button>
        ))}
        <button
          type="button"
          aria-label="Next page"
          disabled={currentPage >= totalPages || loading}
          onClick={() => onPageChange(currentPage + 1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
