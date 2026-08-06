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
  headerActions?: ReactNode;
};

export function AdminDataTable<T>({
  title,
  count,
  columns,
  data,
  rowKey,
  emptyState,
  renderMobileActions,
  headerActions,
}: AdminDataTableProps<T>) {
  const mobileColumns = columns.filter((col) => !col.hideOnMobile);

  return (
    <div className="flex flex-1 flex-col min-h-0 min-w-0 max-w-full pb-0 w-full">
      <div className="mb-3 flex flex-none flex-col gap-3 sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h2 className="m-0 break-words text-base font-black text-white sm:text-xl md:text-2xl">
          {title} ({count})
        </h2>
        {headerActions && (
          <div className="w-full flex-none sm:w-auto">{headerActions}</div>
        )}
      </div>

      {data.length === 0 ? (
        <div className="flex-1 border-t border-white/10 bg-[#0F172A]/40 px-3 py-12 backdrop-blur-xl sm:px-4 sm:py-16">
          {emptyState}
        </div>
      ) : (
        <>
          {/* Card list — used below xl so tables never force page horizontal scroll */}
          <div className="flex w-full max-w-full min-w-0 flex-col gap-3 pb-4 xl:hidden">
            {data.map((row) => (
              <article
                key={rowKey(row)}
                className="w-full max-w-full min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#0F172A]/80 p-3 shadow-lg backdrop-blur-xl sm:p-4"
              >
                <dl className="space-y-2.5 sm:space-y-3">
                  {mobileColumns.map((col) => (
                    <div key={col.key} className="min-w-0">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {col.mobileLabel || col.header}
                      </dt>
                      <dd className="mt-1 overflow-x-auto text-sm text-slate-200 [-ms-overflow-style:none] [scrollbar-width:none] max-md:[&_span]:max-w-none max-md:[&_span]:whitespace-normal max-md:[&_span]:break-words [&::-webkit-scrollbar]:hidden">
                        {col.render(row)}
                      </dd>
                    </div>
                  ))}
                </dl>
                {renderMobileActions && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3 sm:mt-4 sm:pt-4 md:flex-nowrap md:overflow-x-auto">
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
