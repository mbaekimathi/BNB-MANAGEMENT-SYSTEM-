import { BedDouble, TrendingUp, Users, Wallet } from 'lucide-react'
import { useMemo } from 'react'
import { Empty, ErrorNote, Loading, Panel, Pill, Stat } from '../../components/hr/ui'
import { bnb, clientKey, type Booking } from '../../lib/bnb'
import { formatDate, formatMoney, useApi } from '../../lib/hr'
import {
  GUEST_HUES, GRID, MATURITY_TONE, RangePanel, SheetBoundary, SheetFrame, SheetHead, SOFT, TD, TH, TXT,
  downloadCsv, esc, fmtD, initials, sum, useRange,
} from './reportTools'
import type { AccountPageProps } from './types'

const digits = (v: string) => v.replace(/\D/g, '')

export default function ClientReport(props: AccountPageProps) {
  return (
    <SheetBoundary t={props.t}>
      <ClientReportBody {...props} />
    </SheetBoundary>
  )
}

function ClientReportBody({ t, me }: AccountPageProps) {
  const bookings = useApi(() => bnb.bookings({ limit: 500 }))
  const referrals = useApi(() => bnb.referrals({ limit: 500 }))
  const { fromD, toD, setFromD, setToD, inRange, overlaps } = useRange()

  const report = useMemo(() => {
    const live = (bookings.data ?? []).filter((b) => b.status !== 'cancelled')
    const refs = referrals.data ?? []
    /** Gift vouchers a client earned as the referrer — matched by phone, then name. */
    const earnedBy = (c: { name: string; phone: string }) => {
      const ph = digits(c.phone)
      return refs.filter((r) =>
        (ph && digits(r.referrer_phone) === ph) || r.referrer_name.trim().toLowerCase() === c.name.trim().toLowerCase())
    }
    const groups = new Map<string, { name: string; phone: string; email: string; bookings: Booking[] }>()
    for (const b of live) {
      const key = clientKey(b)
      const g = groups.get(key) ?? { name: b.guest_name, phone: b.guest_phone, email: b.guest_email, bookings: [] }
      g.bookings.push(b)
      groups.set(key, g)
    }
    const rows = [...groups.entries()]
      .map(([key, c]) => {
        const stays = c.bookings.filter((b) => overlaps(b.start, b.end))
        const creditV = c.bookings.flatMap((b) => (b.vouchers ?? []).filter((v) => inRange(v.created_at)))
        const packs = c.bookings.flatMap((b) => (b.packages ?? []).filter((p) => inRange(p.created_at)))
        const earned = earnedBy(c)
        const paid = sum(stays.map((b) => Number(b.deposit ?? 0))) +
          sum(c.bookings.flatMap((b) => (b.payments ?? []).filter((p) => inRange(p.created_at)).map((p) => Number(p.amount))))
        return {
          key,
          name: c.name,
          phone: c.phone,
          email: c.email,
          stays: stays.length,
          nights: sum(stays.map((b) => b.nights)),
          billed: sum(stays.map((b) => Number(b.bill))),
          paid,
          earned,
          creditV,
          packs,
        }
      })
      .sort((a, b) => b.billed - a.billed)
    return {
      rows,
      billed: sum(rows.map((r) => r.billed)),
      paid: sum(rows.map((r) => r.paid)),
      vouchers: sum(rows.map((r) => r.earned.length + r.creditV.length)),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings.data, referrals.data, fromD, toD])

  const ready = Boolean(bookings.data && referrals.data)
  const error = bookings.error || referrals.error
  const loading = (bookings.loading || referrals.loading) && !ready

  function buildCsv() {
    const lines: string[] = []
    lines.push(`Client summary report,${esc(fromD)} to ${esc(toD)}`)
    lines.push('No,Client,Phone,Email,Stays,Nights,Billed,Paid,Balance,Gift vouchers earned,Credit vouchers,Extra packages')
    report.rows.forEach((r, i) => {
      lines.push([
        i + 1, r.name, r.phone, r.email, r.stays, r.nights, r.billed.toFixed(2), r.paid.toFixed(2), (r.billed - r.paid).toFixed(2),
        r.earned.map((v) => v.voucher_code).join(' '),
        r.creditV.map((v) => `${v.code} (${v.amount})`).join(' '),
        r.packs.map((p) => `${p.name} (${p.amount})`).join(' '),
      ].map(esc).join(','))
    })
    lines.push(['Total', '', '', '', report.rows.reduce((s, r) => s + r.stays, 0), report.rows.reduce((s, r) => s + r.nights, 0),
      report.billed.toFixed(2), report.paid.toFixed(2), (report.billed - report.paid).toFixed(2), '', '', ''].map(esc).join(','))
    downloadCsv(`client-report-${fromD}-to-${toD}.csv`, lines)
  }

  return (
    <>
      <RangePanel t={t} fromD={fromD} toD={toD} setFromD={setFromD} setToD={setToD} onCsv={buildCsv} ready={ready} title="Client summary report" me={me} />

      {error ? (
        <Panel t={t}><ErrorNote t={t} message={error} onRetry={() => { bookings.reload(); referrals.reload() }} /></Panel>
      ) : loading ? (
        <Panel t={t}><Loading t={t} /></Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat t={t} i={0} icon={Users} label="Clients" value={report.rows.length} hint="with bookings in period" />
            <Stat t={t} i={1} icon={BedDouble} label="Stays" value={report.rows.reduce((s, r) => s + r.stays, 0)} hint={`${report.rows.reduce((s, r) => s + r.nights, 0)} nights`} />
            <Stat t={t} i={2} icon={TrendingUp} label="Billed" value={formatMoney(report.billed)} />
            <Stat t={t} i={3} icon={Wallet} label="Collected" value={formatMoney(report.paid)} hint={`${report.vouchers} vouchers linked`} />
          </div>

          <SheetFrame t={t}>
            <SheetHead
              icon={Users}
              title="Client summary report"
              sub={`${formatDate(fromD)} — ${formatDate(toD)} · referral gift vouchers · credit vouchers · extra packages`}
              right={<span className="text-[11px] text-white/70">Date: <span className="font-semibold text-white">{formatDate(toD)}</span></span>}
            />
            {!report.rows.length ? (
              <div className="p-5"><Empty t={t} icon={Users} title="No clients in this period" text="Clients with bookings overlapping the selected dates appear here." /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[60rem] border-collapse text-left text-[11px]">
                  <thead>
                    <tr className="bg-slate-100/90 dark:bg-white/[0.06]">
                      <th className={`${TH} w-8 text-center ${t.muted}`}>#</th>
                      <th className={`${TH} ${t.muted}`}>Client</th>
                      <th className={`${TH} text-right ${t.muted}`}>Stays</th>
                      <th className={`${TH} text-right ${t.muted}`}>Nights</th>
                      <th className={`${TH} text-right ${TXT.teal}`}>Billed</th>
                      <th className={`${TH} text-right ${TXT.emerald}`}>Paid</th>
                      <th className={`${TH} text-right ${TXT.rose}`}>Balance</th>
                      <th className={`${TH} ${TXT.fuchsia}`}>Referral vouchers</th>
                      <th className={`${TH} ${TXT.teal}`}>Credit vouchers</th>
                      <th className={`${TH} ${TXT.amber}`}>Extra packages</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((r, i) => (
                      <tr key={r.key} className="align-top odd:bg-slate-50/70 hover:bg-sky-500/[0.04] dark:odd:bg-white/[0.02] dark:hover:bg-white/[0.04]">
                        <td className={`${TD} text-center font-semibold ${t.muted}`}>{i + 1}</td>
                        <td className={TD}>
                          <span className="flex items-center gap-2">
                            <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold ${SOFT[GUEST_HUES[i % GUEST_HUES.length]]}`}>
                              {initials(r.name)}
                            </span>
                            <span>
                              <span className="block text-xs font-medium">{r.name}</span>
                              <span className={t.muted}>{r.phone || r.email || '—'}</span>
                            </span>
                          </span>
                        </td>
                        <td className={`${TD} text-right`}>{r.stays}</td>
                        <td className={`${TD} text-right`}>{r.nights}</td>
                        <td className={`${TD} text-right font-semibold ${TXT.teal}`}>{formatMoney(r.billed)}</td>
                        <td className={`${TD} text-right font-semibold ${TXT.emerald}`}>{formatMoney(r.paid)}</td>
                        <td className={`${TD} text-right font-semibold ${TXT.rose}`}>{formatMoney(r.billed - r.paid)}</td>
                        <td className={TD}>
                          {r.earned.length ? r.earned.map((v) => (
                            <span key={v.id} className="mb-0.5 flex items-center gap-1.5 whitespace-nowrap">
                              <span className={`font-mono font-semibold ${TXT.fuchsia}`}>{v.voucher_code}</span>
                              <Pill tone={v.redeemed_at ? 'green' : MATURITY_TONE[v.maturity] ?? 'slate'}>{v.redeemed_at ? 'Redeemed' : v.maturity_label}</Pill>
                            </span>
                          )) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className={TD}>
                          {r.creditV.length ? r.creditV.map((v) => (
                            <span key={v.id} className="block whitespace-nowrap">
                              <span className={`font-mono font-semibold ${TXT.teal}`}>{v.code}</span>
                              <span className={t.muted}> {formatMoney(v.amount)}{v.redeemed_at ? ' · used' : ''}</span>
                            </span>
                          )) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className={TD}>
                          {r.packs.length ? r.packs.map((p) => (
                            <span key={p.id} className="block whitespace-nowrap">
                              <span className={`font-medium ${TXT.amber}`}>{p.name}</span>
                              <span className={t.muted}> {formatMoney(p.amount)} · {fmtD(p.created_at)}</span>
                            </span>
                          )) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-800 text-xs font-bold text-white dark:bg-slate-900">
                      <td className={`border-r ${GRID} px-2 py-2.5`} colSpan={2}>Total — {report.rows.length} {report.rows.length === 1 ? 'client' : 'clients'}</td>
                      <td className={`border-r ${GRID} px-2 py-2.5 text-right`}>{report.rows.reduce((s, r) => s + r.stays, 0)}</td>
                      <td className={`border-r ${GRID} px-2 py-2.5 text-right`}>{report.rows.reduce((s, r) => s + r.nights, 0)}</td>
                      <td className={`border-r ${GRID} px-2 py-2.5 text-right ${TXT.teal}`}>{formatMoney(report.billed)}</td>
                      <td className={`border-r ${GRID} px-2 py-2.5 text-right ${TXT.emerald}`}>{formatMoney(report.paid)}</td>
                      <td className={`border-r ${GRID} px-2 py-2.5 text-right ${TXT.rose}`}>{formatMoney(report.billed - report.paid)}</td>
                      <td className="px-2 py-2.5" colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </SheetFrame>
        </>
      )}
    </>
  )
}
