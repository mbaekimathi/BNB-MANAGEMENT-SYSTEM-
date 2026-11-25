import { Award, CheckCircle2, Gift, Hourglass, TrendingUp } from 'lucide-react'
import { useMemo } from 'react'
import { Empty, ErrorNote, Loading, Panel, Pill, Stat } from '../../components/hr/ui'
import { bnb } from '../../lib/bnb'
import { formatDate, formatMoney, useApi } from '../../lib/hr'
import {
  GUEST_HUES, GRID, MATURITY_TONE, RangePanel, SheetBoundary, SheetFrame, SheetHead, SOFT, TD, TH, TXT,
  downloadCsv, esc, fmtDT, initials, sum, useRange,
} from './reportTools'
import type { AccountPageProps } from './types'

export default function ReferralReport(props: AccountPageProps) {
  return (
    <SheetBoundary t={props.t}>
      <ReferralReportBody {...props} />
    </SheetBoundary>
  )
}

function ReferralReportBody({ t, me }: AccountPageProps) {
  const referrals = useApi(() => bnb.referrals({ limit: 500 }))
  const { fromD, toD, setFromD, setToD, inRange } = useRange()

  const report = useMemo(() => {
    const rows = (referrals.data ?? [])
      .filter((r) => inRange(r.created_at))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
    return {
      rows,
      partial: rows.filter((r) => r.maturity === 'partial').length,
      matured: rows.filter((r) => r.maturity === 'matured').length,
      redeemed: rows.filter((r) => r.redeemed_at).length,
      void: rows.filter((r) => r.maturity === 'void').length,
      paid: sum(rows.map((r) => Number(r.paid))),
      billed: sum(rows.map((r) => Number(r.billed))),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referrals.data, fromD, toD])

  const ready = Boolean(referrals.data)
  const loading = referrals.loading && !ready

  function buildCsv() {
    const lines: string[] = []
    lines.push(`Referral summary report,${esc(fromD)} to ${esc(toD)}`)
    lines.push('No,Voucher,Referrer,Referrer phone,Referred client,Client phone,Room,Booking status,Created,Client paid,Client billed,Maturity,Redeemed at,Redeemed by')
    report.rows.forEach((r, i) => {
      lines.push([
        i + 1, r.voucher_code, r.referrer_name, r.referrer_phone, r.guest_name, r.guest_phone,
        r.room_name ?? '', r.booking_status_label, r.created_at, r.paid, r.billed,
        r.maturity_label, r.redeemed_at ?? '', r.redeemed_by_name ?? '',
      ].map(esc).join(','))
    })
    lines.push(['Total', '', '', '', '', '', '', '', '', report.paid.toFixed(2), report.billed.toFixed(2), '', '', ''].map(esc).join(','))
    downloadCsv(`referral-report-${fromD}-to-${toD}.csv`, lines)
  }

  return (
    <>
      <RangePanel t={t} fromD={fromD} toD={toD} setFromD={setFromD} setToD={setToD} onCsv={buildCsv} ready={ready} title="Referral summary report" me={me} />

      {referrals.error ? (
        <Panel t={t}><ErrorNote t={t} message={referrals.error} onRetry={referrals.reload} /></Panel>
      ) : loading ? (
        <Panel t={t}><Loading t={t} /></Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Stat t={t} i={0} icon={Gift} label="Vouchers issued" value={report.rows.length} />
            <Stat t={t} i={1} icon={Hourglass} label="Maturing" value={report.partial} hint="client booked, awaiting payment" />
            <Stat t={t} i={2} icon={Award} label="Matured" value={report.matured} hint="ready to redeem" />
            <Stat t={t} i={3} icon={CheckCircle2} label="Redeemed" value={report.redeemed} />
            <Stat t={t} i={4} icon={TrendingUp} label="Client spend" value={formatMoney(report.paid)} hint={`${formatMoney(report.billed)} billed`} />
          </div>

          <SheetFrame t={t}>
            <SheetHead
              icon={Gift}
              title="Referral summary report"
              sub={`${formatDate(fromD)} — ${formatDate(toD)} · gift vouchers generated when a new client names a referrer`}
              right={<span className="text-[11px] text-white/70">Date: <span className="font-semibold text-white">{formatDate(toD)}</span></span>}
            />
            {!report.rows.length ? (
              <div className="p-5"><Empty t={t} icon={Gift} title="No referrals in this period" text="Gift vouchers created in the selected dates appear here." /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[56rem] border-collapse text-left text-[11px]">
                  <thead>
                    <tr className="bg-slate-100/90 dark:bg-white/[0.06]">
                      <th className={`${TH} w-8 text-center ${t.muted}`}>#</th>
                      <th className={`${TH} ${TXT.fuchsia}`}>Voucher</th>
                      <th className={`${TH} ${t.muted}`}>Earned by (referrer)</th>
                      <th className={`${TH} ${t.muted}`}>Referred client</th>
                      <th className={`${TH} ${t.muted}`}>Room</th>
                      <th className={`${TH} ${t.muted}`}>Created</th>
                      <th className={`${TH} text-right ${TXT.teal}`}>Client billed</th>
                      <th className={`${TH} text-right ${TXT.emerald}`}>Client paid</th>
                      <th className={`${TH} ${t.muted}`}>Maturity</th>
                      <th className={`${TH} ${t.muted}`}>Redeemed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((r, i) => (
                      <tr key={r.id} className="odd:bg-slate-50/70 hover:bg-fuchsia-500/[0.04] dark:odd:bg-white/[0.02] dark:hover:bg-white/[0.04]">
                        <td className={`${TD} text-center font-semibold ${t.muted}`}>{i + 1}</td>
                        <td className={`${TD} font-mono font-semibold ${TXT.fuchsia}`}>{r.voucher_code}</td>
                        <td className={TD}>
                          <span className="flex items-center gap-2">
                            <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold ${SOFT[GUEST_HUES[i % GUEST_HUES.length]]}`}>
                              {initials(r.referrer_name)}
                            </span>
                            <span>
                              <span className="block text-xs font-medium">{r.referrer_name}</span>
                              <span className={t.muted}>{r.referrer_phone}</span>
                            </span>
                          </span>
                        </td>
                        <td className={TD}>
                          <span className="block font-medium">{r.guest_name}</span>
                          <span className={t.muted}>{r.booking_status_label}</span>
                        </td>
                        <td className={`${TD} font-medium`}>{r.room_name ?? '—'}</td>
                        <td className={`${TD} whitespace-nowrap ${t.muted}`}>{fmtDT(r.created_at)}</td>
                        <td className={`${TD} text-right font-medium ${TXT.teal}`}>{formatMoney(r.billed)}</td>
                        <td className={`${TD} text-right font-semibold ${TXT.emerald}`}>{formatMoney(r.paid)}</td>
                        <td className={TD}><Pill tone={MATURITY_TONE[r.maturity] ?? 'slate'}>{r.maturity_label}</Pill></td>
                        <td className={`${TD} whitespace-nowrap`}>
                          {r.redeemed_at ? (
                            <>
                              <span className={`block font-medium ${TXT.emerald}`}>{fmtDT(r.redeemed_at)}</span>
                              <span className={t.muted}>{r.redeemed_by_name ?? ''}</span>
                            </>
                          ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-800 text-xs font-bold text-white dark:bg-slate-900">
                      <td className={`border-r ${GRID} px-2 py-2.5`} colSpan={7}>Total — {report.rows.length} {report.rows.length === 1 ? 'voucher' : 'vouchers'}</td>
                      <td className={`border-r ${GRID} px-2 py-2.5 text-right ${TXT.teal}`}>{formatMoney(report.billed)}</td>
                      <td className={`border-r ${GRID} px-2 py-2.5 text-right ${TXT.emerald}`}>{formatMoney(report.paid)}</td>
                      <td className="px-2 py-2.5" colSpan={2}></td>
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
