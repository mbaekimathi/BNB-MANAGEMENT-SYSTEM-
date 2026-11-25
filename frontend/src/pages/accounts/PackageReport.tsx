import { PackageSearch, ReceiptText, ShoppingBag, Tags, TrendingUp } from 'lucide-react'
import { useMemo } from 'react'
import { Empty, ErrorNote, Loading, Panel, Stat } from '../../components/hr/ui'
import { bnb } from '../../lib/bnb'
import { formatDate, formatMoney, useApi } from '../../lib/hr'
import {
  GRID, RangePanel, SheetBoundary, SheetFrame, SheetHead, TD, TH, TXT,
  downloadCsv, esc, fmtDT, sum, useRange,
} from './reportTools'
import type { AccountPageProps } from './types'

const CAT_HUE: Record<string, keyof typeof TXT> = { food: 'amber', travel: 'sky', tourist: 'violet', safe_storage: 'teal', other: 'slate' }

export default function PackageReport(props: AccountPageProps) {
  return (
    <SheetBoundary t={props.t}>
      <PackageReportBody {...props} />
    </SheetBoundary>
  )
}

function PackageReportBody({ t, me }: AccountPageProps) {
  const bookings = useApi(() => bnb.bookings({ limit: 500 }))
  const catalogue = useApi(bnb.packages)
  const { fromD, toD, setFromD, setToD, inRange } = useRange()

  const report = useMemo(() => {
    const live = (bookings.data ?? []).filter((b) => b.status !== 'cancelled')
    const byId = new Map((catalogue.data ?? []).map((p) => [p.id, p]))
    /** Every package sold in the period, with its booking for context. */
    const sales = live
      .flatMap((b) => (b.packages ?? []).filter((p) => inRange(p.created_at)).map((p) => ({ b, p })))
      .sort((a, b) => b.p.created_at.localeCompare(a.p.created_at))
    /** Rollup per catalogue item (falls back to the snapshot name once deleted). */
    const agg = new Map<string, { name: string; category: string; qty: number; total: number }>()
    for (const { p } of sales) {
      const cat = p.package ? (byId.get(p.package)?.category_label ?? '—') : '—'
      const k = `${cat}|${p.name}`
      const a = agg.get(k) ?? { name: p.name, category: cat, qty: 0, total: 0 }
      a.qty += 1
      a.total += Number(p.amount)
      agg.set(k, a)
    }
    return {
      sales,
      items: [...agg.values()].sort((a, b) => b.total - a.total),
      total: sum(sales.map(({ p }) => Number(p.amount))),
      catalogueCount: (catalogue.data ?? []).filter((p) => p.status === 'active').length,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings.data, catalogue.data, fromD, toD])

  const ready = Boolean(bookings.data && catalogue.data)
  const error = bookings.error || catalogue.error
  const loading = (bookings.loading || catalogue.loading) && !ready

  function buildCsv() {
    const lines: string[] = []
    lines.push(`Extra packages report,${esc(fromD)} to ${esc(toD)}`)
    lines.push('BY PACKAGE')
    lines.push('No,Package,Category,Times sold,Total billed')
    report.items.forEach((a, i) => lines.push([i + 1, a.name, a.category, a.qty, a.total.toFixed(2)].map(esc).join(',')))
    lines.push(['Total', '', '', report.sales.length, report.total.toFixed(2)].map(esc).join(','))
    lines.push('')
    lines.push('SALES LOG')
    lines.push('No,Date,Package,Amount,Guest,Room,Booking status')
    report.sales.forEach(({ b, p }, i) =>
      lines.push([i + 1, p.created_at, p.name, p.amount, `${p.payer} — ${b.guest_name}`, b.room_name ?? '', b.status_label].map(esc).join(',')))
    downloadCsv(`package-report-${fromD}-to-${toD}.csv`, lines)
  }

  return (
    <>
      <RangePanel t={t} fromD={fromD} toD={toD} setFromD={setFromD} setToD={setToD} onCsv={buildCsv} ready={ready} title="Extra packages report" me={me} />

      {error ? (
        <Panel t={t}><ErrorNote t={t} message={error} onRetry={() => { bookings.reload(); catalogue.reload() }} /></Panel>
      ) : loading ? (
        <Panel t={t}><Loading t={t} /></Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat t={t} i={0} icon={ShoppingBag} label="Packages sold" value={report.sales.length} hint={`${report.items.length} different items`} />
            <Stat t={t} i={1} icon={TrendingUp} label="Package revenue" value={formatMoney(report.total)} />
            <Stat t={t} i={2} icon={Tags} label="Catalogue" value={report.catalogueCount} hint="active packages" />
            <Stat t={t} i={3} icon={ReceiptText} label="Avg per sale" value={formatMoney(report.sales.length ? report.total / report.sales.length : 0)} />
          </div>

          <SheetFrame t={t}>
            <SheetHead
              icon={PackageSearch}
              title="Extra packages report"
              sub={`${formatDate(fromD)} — ${formatDate(toD)} · spa, food, travel and other add-ons sold with stays`}
              right={<span className="text-[11px] text-white/70">Date: <span className="font-semibold text-white">{formatDate(toD)}</span></span>}
            />
            {!report.sales.length ? (
              <div className="p-5"><Empty t={t} icon={PackageSearch} title="No package sales in this period" text="Extra packages sold on bookings appear here." /></div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[40rem] border-collapse text-left text-[11px]">
                    <thead>
                      <tr className="bg-slate-100/90 dark:bg-white/[0.06]">
                        <th className={`${TH} w-8 text-center ${t.muted}`}>#</th>
                        <th className={`${TH} ${t.muted}`}>Package</th>
                        <th className={`${TH} ${t.muted}`}>Category</th>
                        <th className={`${TH} text-right ${t.muted}`}>Times sold</th>
                        <th className={`${TH} text-right ${TXT.amber}`}>Total billed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.items.map((a, i) => (
                        <tr key={`${a.category}-${a.name}`} className="odd:bg-slate-50/70 dark:odd:bg-white/[0.02]">
                          <td className={`${TD} text-center font-semibold ${t.muted}`}>{i + 1}</td>
                          <td className={`${TD} text-xs font-semibold`}>{a.name}</td>
                          <td className={`${TD} font-medium ${TXT[(CAT_HUE[a.category.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_')] ?? 'slate')]}`}>{a.category}</td>
                          <td className={`${TD} text-right`}>{a.qty}</td>
                          <td className={`${TD} text-right font-semibold ${TXT.amber}`}>{formatMoney(a.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-800 text-xs font-bold text-white dark:bg-slate-900">
                        <td className={`border-r ${GRID} px-2 py-2.5`} colSpan={3}>Total</td>
                        <td className={`border-r ${GRID} px-2 py-2.5 text-right`}>{report.sales.length}</td>
                        <td className={`px-2 py-2.5 text-right ${TXT.amber}`}>{formatMoney(report.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Sales log — each sale with its guest and room */}
                <p className={`border-t ${GRID} ${TXT.amber} bg-amber-500/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider`}>Sales log</p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[48rem] border-collapse text-left text-[11px]">
                    <thead>
                      <tr className="bg-slate-100/90 dark:bg-white/[0.06]">
                        <th className={`${TH} w-8 text-center ${t.muted}`}>#</th>
                        <th className={`${TH} ${t.muted}`}>Date</th>
                        <th className={`${TH} ${t.muted}`}>Package</th>
                        <th className={`${TH} ${t.muted}`}>Sold to</th>
                        <th className={`${TH} ${t.muted}`}>Guest</th>
                        <th className={`${TH} ${t.muted}`}>Room</th>
                        <th className={`${TH} text-right ${TXT.emerald}`}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.sales.map(({ b, p }, i) => (
                        <tr key={p.id} className="odd:bg-slate-50/70 dark:odd:bg-white/[0.02]">
                          <td className={`${TD} text-center font-semibold ${t.muted}`}>{i + 1}</td>
                          <td className={`${TD} whitespace-nowrap ${t.muted}`}>{fmtDT(p.created_at)}</td>
                          <td className={`${TD} text-xs font-semibold`}>{p.name}</td>
                          <td className={`${TD} font-medium`}>{p.payer}</td>
                          <td className={TD}>{b.guest_name}</td>
                          <td className={`${TD} font-medium`}>{b.room_name ?? '—'}</td>
                          <td className={`${TD} text-right font-semibold ${TXT.emerald}`}>{formatMoney(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </SheetFrame>
        </>
      )}
    </>
  )
}
