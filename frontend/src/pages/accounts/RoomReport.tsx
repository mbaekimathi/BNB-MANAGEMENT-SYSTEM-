import { BedDouble, CalendarCheck, DoorOpen, TrendingUp, Wallet } from 'lucide-react'
import { useMemo } from 'react'
import { Empty, ErrorNote, Loading, Panel, Pill, Stat, type Tone } from '../../components/hr/ui'
import { bnb, type PaymentMethod } from '../../lib/bnb'
import { formatDate, formatMoney, useApi } from '../../lib/hr'
import {
  CH_HUE, GRID, RangePanel, SheetBoundary, SheetFrame, SheetHead, TD, TH, TXT,
  downloadCsv, esc, money, sum, useRange,
} from './reportTools'
import type { AccountPageProps } from './types'

const ROOM_TONE: Record<string, Tone> = { active: 'green', maintenance: 'amber', suspended: 'red' }

export default function RoomReport(props: AccountPageProps) {
  return (
    <SheetBoundary t={props.t}>
      <RoomReportBody {...props} />
    </SheetBoundary>
  )
}

function RoomReportBody({ t, me }: AccountPageProps) {
  const bookings = useApi(() => bnb.bookings({ limit: 500 }))
  const rooms = useApi(bnb.rooms)
  const { fromD, toD, setFromD, setToD, inRange, overlaps } = useRange()

  const report = useMemo(() => {
    const live = (bookings.data ?? []).filter((b) => b.status !== 'cancelled')
    const rows = (rooms.data ?? [])
      .map((room) => {
        const stays = live.filter((b) => b.room === room.id && overlaps(b.start, b.end))
        const pays = stays.flatMap((b) => (b.payments ?? []).filter((p) => inRange(p.created_at)))
        const by = (...ms: PaymentMethod[]) => sum(pays.filter((p) => ms.includes(p.method)).map((p) => Number(p.amount)))
        const billed = sum(stays.map((b) => Number(b.bill)))
        const paid = sum(stays.map((b) => Number(b.deposit ?? 0))) + sum(pays.map((p) => Number(p.amount)))
        return {
          room,
          stays: stays.length,
          nights: sum(stays.map((b) => b.nights)),
          billed,
          cash: by('cash'),
          mpesa: by('mpesa'),
          visa: by('visa'),
          other: by('bank', 'other'),
          paid,
          balance: billed - paid,
        }
      })
      .sort((a, b) => a.room.name.localeCompare(b.room.name, undefined, { numeric: true }))
    return {
      rows,
      occupied: rows.filter((r) => r.stays > 0).length,
      nights: sum(rows.map((r) => r.nights)),
      billed: sum(rows.map((r) => r.billed)),
      paid: sum(rows.map((r) => r.paid)),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings.data, rooms.data, fromD, toD])

  const ready = Boolean(bookings.data && rooms.data)
  const error = bookings.error || rooms.error
  const loading = (bookings.loading || rooms.loading) && !ready

  function buildCsv() {
    const lines: string[] = []
    lines.push(`Room summary report,${esc(fromD)} to ${esc(toD)}`)
    lines.push('No,Room,Type,Status,Stays,Nights,Billed,Cash,M-Pesa,Visa,Other,Paid,Balance')
    report.rows.forEach((r, i) => {
      lines.push([
        i + 1, r.room.name, r.room.type_label, r.room.status_label, r.stays, r.nights,
        r.billed.toFixed(2), r.cash.toFixed(2), r.mpesa.toFixed(2), r.visa.toFixed(2), r.other.toFixed(2),
        r.paid.toFixed(2), r.balance.toFixed(2),
      ].map(esc).join(','))
    })
    lines.push(['Total', '', '', '', report.rows.reduce((s, r) => s + r.stays, 0), report.nights,
      report.billed.toFixed(2), sum(report.rows.map((r) => r.cash)).toFixed(2), sum(report.rows.map((r) => r.mpesa)).toFixed(2),
      sum(report.rows.map((r) => r.visa)).toFixed(2), sum(report.rows.map((r) => r.other)).toFixed(2),
      report.paid.toFixed(2), (report.billed - report.paid).toFixed(2)].map(esc).join(','))
    downloadCsv(`room-report-${fromD}-to-${toD}.csv`, lines)
  }

  return (
    <>
      <RangePanel t={t} fromD={fromD} toD={toD} setFromD={setFromD} setToD={setToD} onCsv={buildCsv} ready={ready} title="Room summary report" me={me} />

      {error ? (
        <Panel t={t}><ErrorNote t={t} message={error} onRetry={() => { bookings.reload(); rooms.reload() }} /></Panel>
      ) : loading ? (
        <Panel t={t}><Loading t={t} /></Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat t={t} i={0} icon={BedDouble} label="Rooms" value={report.rows.length} hint={`${report.occupied} occupied in period`} />
            <Stat t={t} i={1} icon={CalendarCheck} label="Nights sold" value={report.nights} />
            <Stat t={t} i={2} icon={TrendingUp} label="Billed" value={formatMoney(report.billed)} />
            <Stat t={t} i={3} icon={Wallet} label="Collected" value={formatMoney(report.paid)} hint={`${formatMoney(report.billed - report.paid)} outstanding`} />
          </div>

          <SheetFrame t={t}>
            <SheetHead
              icon={BedDouble}
              title="Room summary report"
              sub={`${formatDate(fromD)} — ${formatDate(toD)}`}
              right={<span className="text-[11px] text-white/70">Date: <span className="font-semibold text-white">{formatDate(toD)}</span></span>}
            />
            {!report.rows.length ? (
              <div className="p-5"><Empty t={t} icon={DoorOpen} title="No rooms registered" text="Rooms appear here once the manager registers them." /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="rtable w-full min-w-[56rem] border-collapse text-left text-[11px]">
                  <thead>
                    <tr className="bg-slate-100/90 dark:bg-white/[0.06]">
                      <th className={`${TH} w-8 text-center ${t.muted}`}>#</th>
                      <th className={`${TH} ${t.muted}`}>Room</th>
                      <th className={`${TH} ${t.muted}`}>Type</th>
                      <th className={`${TH} ${t.muted}`}>Status</th>
                      <th className={`${TH} text-right ${t.muted}`}>Stays</th>
                      <th className={`${TH} text-right ${t.muted}`}>Nights</th>
                      <th className={`${TH} text-right ${TXT.teal}`}>Billed</th>
                      <th className={`${TH} text-right ${TXT[CH_HUE.cash]}`}>Cash</th>
                      <th className={`${TH} text-right ${TXT[CH_HUE.mpesa]}`}>M-Pesa</th>
                      <th className={`${TH} text-right ${TXT[CH_HUE.visa]}`}>Visa</th>
                      <th className={`${TH} text-right ${TXT[CH_HUE.other]}`}>Other</th>
                      <th className={`${TH} text-right ${TXT.emerald}`}>Paid</th>
                      <th className={`${TH} text-right ${TXT.rose}`}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((r, i) => (
                      <tr key={r.room.id} className="odd:bg-slate-50/70 hover:bg-sky-500/[0.04] dark:odd:bg-white/[0.02] dark:hover:bg-white/[0.04]">
                        <td className={`${TD} text-center font-semibold ${t.muted}`}>{i + 1}</td>
                        <td className={`${TD} text-xs font-semibold`}>{r.room.name}</td>
                        <td className={`${TD} font-medium`}>{r.room.type_label}</td>
                        <td className={TD}><Pill tone={ROOM_TONE[r.room.status] ?? 'slate'}>{r.room.status_label}</Pill></td>
                        <td className={`${TD} text-right`}>{r.stays || <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                        <td className={`${TD} text-right`}>{r.nights || <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                        <td className={`${TD} text-right`}>{money(r.billed, 'teal')}</td>
                        <td className={`${TD} text-right`}>{money(r.cash, CH_HUE.cash)}</td>
                        <td className={`${TD} text-right`}>{money(r.mpesa, CH_HUE.mpesa)}</td>
                        <td className={`${TD} text-right`}>{money(r.visa, CH_HUE.visa)}</td>
                        <td className={`${TD} text-right`}>{money(r.other, CH_HUE.other)}</td>
                        <td className={`${TD} text-right`}>{money(r.paid, 'emerald')}</td>
                        <td className={`${TD} text-right`}>{r.balance > 0 ? <span className={`font-semibold ${TXT.rose}`}>{formatMoney(r.balance)}</span> : <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-800 text-xs font-bold text-white dark:bg-slate-900">
                      <td className={`border-r ${GRID} px-2 py-2.5`} colSpan={4}>Total</td>
                      <td className={`border-r ${GRID} px-2 py-2.5 text-right`}>{report.rows.reduce((s, r) => s + r.stays, 0)}</td>
                      <td className={`border-r ${GRID} px-2 py-2.5 text-right`}>{report.nights}</td>
                      <td className={`border-r ${GRID} px-2 py-2.5 text-right ${TXT.teal}`}>{formatMoney(report.billed)}</td>
                      <td className={`border-r ${GRID} px-2 py-2.5 text-right ${TXT[CH_HUE.cash]}`}>{formatMoney(sum(report.rows.map((r) => r.cash)))}</td>
                      <td className={`border-r ${GRID} px-2 py-2.5 text-right ${TXT[CH_HUE.mpesa]}`}>{formatMoney(sum(report.rows.map((r) => r.mpesa)))}</td>
                      <td className={`border-r ${GRID} px-2 py-2.5 text-right ${TXT[CH_HUE.visa]}`}>{formatMoney(sum(report.rows.map((r) => r.visa)))}</td>
                      <td className={`border-r ${GRID} px-2 py-2.5 text-right ${TXT[CH_HUE.other]}`}>{formatMoney(sum(report.rows.map((r) => r.other)))}</td>
                      <td className={`border-r ${GRID} px-2 py-2.5 text-right ${TXT.emerald}`}>{formatMoney(report.paid)}</td>
                      <td className={`px-2 py-2.5 text-right ${TXT.rose}`}>{formatMoney(report.billed - report.paid)}</td>
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
