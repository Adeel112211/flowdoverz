import { ReactNode } from "react";

export type AdminTableColumn<T> = {
  key: string;
  header: string;
  className?: string;
  headerClassName?: string;
  hideOnMobile?: boolean;
  render: (row: T) => ReactNode;
  mobileLabel?: string;
};

type AdminDataTableProps<T> = {
  title: string;
  count: number;
  columns: AdminTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  emptyState: ReactNode;
  renderMobileActions?: (row: T) => ReactNode;
};

export function AdminDataTable<T>({
  title,
  count,
  columns,
  data,
  rowKey,
  emptyState,
  renderMobileActions,
}: AdminDataTableProps<T>) {
  const mobileColumns = columns.filter((col) => !col.hideOnMobile);

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 max-w-full pb-0 w-full">
      <h2 className="mb-4 text-lg sm:text-xl md:text-2xl font-black text-white flex-none break-words">
        {title} ({count})
      </h2>

      {data.length === 0 ? (
        <div className="flex-1 border-t border-white/10 bg-[#0F172A]/40 backdrop-blur-xl px-0 py-16 sm:px-4">
          {emptyState}
        </div>
      ) : (
        <>
          {/* Card list — used below xl so tables never force page horizontal scroll */}
          <div className="xl:hidden flex flex-col gap-3 pb-4 w-full max-w-full min-w-0">
            {data.map((row) => (
              <article
                key={rowKey(row)}
                className="rounded-xl border border-white/10 bg-[#0F172A]/80 p-4 shadow-lg backdrop-blur-xl w-full max-w-full min-w-0 overflow-hidden"
              >
                <dl className="space-y-3">
                  {mobileColumns.map((col) => (
                    <div key={col.key} className="min-w-0">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {col.mobileLabel || col.header}
                      </dt>
                      <dd className="mt-1 text-sm text-slate-200 break-words">{col.render(row)}</dd>
                    </div>
                  ))}
                </dl>
                {renderMobileActions && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                    {renderMobileActions(row)}
                  </div>
                )}
              </article>
            ))}
          </div>

          {/* Desktop table — scrolls internally, header stays sticky */}
          <div className="hidden xl:flex flex-col flex-1 min-h-0 w-full max-w-full min-w-0 border-t border-white/10 bg-[#0F172A]/40 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="overflow-y-auto flex-1 min-h-0">
              <table className="w-full table-auto text-left text-sm text-slate-300">
                <thead className="sticky top-0 z-10 bg-[#0F172A] text-xs md:text-sm uppercase tracking-widest text-cyan-400 border-b border-cyan-500/20">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        className={`px-4 py-4 font-black whitespace-nowrap ${col.headerClassName || ""}`}
                      >
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {data.map((row) => (
                    <tr key={rowKey(row)} className="hover:bg-white/[0.04] transition-colors">
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-4 py-4 align-top break-words ${col.className || ""}`}
                        >
                          {col.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
