import { ArrowDownToLine, ArrowLeftRight, Banknote, Scale, TrendingUp, Wallet } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Empty, ErrorNote, Loading, Panel, Pill, Stat, type Tone } from '../../components/hr/ui'
import { bnb, DRAWING_LABEL, type PaymentMethod } from '../../lib/bnb'
import { formatDate, formatMoney, useApi } from '../../lib/hr'
import {
  BAND, CH_HUE, GRID, RangePanel, SheetBoundary, TD, TH, TXT,
  downloadCsv, esc, fmtDT, money, sum, useRange, type Hue,
} from './reportTools'
import type { AccountPageProps } from './types'

const PAY_TONE: Record<string, Tone> = { paid: 'green', pending: 'amber' }
const OUT_HUE: Record<string, Hue> = { Expense: 'rose', Stock: 'violet', Drawing: 'indigo' }

/** One labelled box in the summary grid below the channel table. */
function Box({ hue, label, children }: { hue: Hue; label: ReactNode; children: ReactNode }) {
  return (
    <div>
      <p className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider ${BAND[hue]} ${TXT[hue]}`}>{label}</p>
      <div className="divide-y divide-slate-900/5 dark:divide-white/5">{children}</div>
    </div>
  )
}

/** A label ↔ value row inside a Box. */
function Field({ label, value, strong, hint }: { label: ReactNode; value: ReactNode; strong?: boolean; hint?: string }) {
  return (
    <div className="flex items-stretch justify-between gap-2 pl-4 text-xs">
      <span className={`py-1.5 ${strong ? 'font-semibold' : ''}`}>{label}</span>
      <span className={`grid min-w-[5.5rem] place-items-center border-l px-2 py-1.5 text-right font-mono font-semibold ${GRID} ${hint ?? ''}`}>{value}</span>
    </div>
  )
}

export default function MoneyFlowReport(props: AccountPageProps) {
  return (
    <SheetBoundary t={props.t}>
      <MoneyFlowBody {...props} />
    </SheetBoundary>
  )
}

function MoneyFlowBody({ t, me }: AccountPageProps) {
  const bookings = useApi(() => bnb.bookings({ limit: 500 }))
  const expenses = useApi(bnb.expenses)
  const purchases = useApi(bnb.purchases)
  const tills = useApi(bnb.tills)
  const referrals = useApi(() => bnb.referrals({ limit: 500 }))
  const { fromD, toD, setFromD, setToD, from, to, inRange, overlaps } = useRange()

  const report = useMemo(() => {
    const live = (bookings.data ?? []).filter((b) => b.status !== 'cancelled')
    const stays = live.filter((b) => overlaps(b.start, b.end))
    /** Guest receipts inside the period — the actual money coming in. */
    const payments = live.flatMap((b) => (b.payments ?? []).map((p) => ({ b, p }))).filter(({ p }) => inRange(p.created_at))
      .sort((a, b) => a.p.created_at.localeCompare(b.p.created_at))
    const by = (...ms: PaymentMethod[]) => sum(payments.filter(({ p }) => ms.includes(p.method)).map(({ p }) => Number(p.amount)))
    /** Branch spending inside the period. */
    const exp = (expenses.data ?? []).filter((e) => inRange(e.created_at))
    const pur = (purchases.data ?? []).filter((p) => inRange(p.created_at))
    /** Money pulled out of the till mid-session, per channel. */
    const sessions = (tills.data ?? [])
      .filter((s) => new Date(s.opened_at) <= to && new Date(s.closed_at ?? s.opened_at) >= from)
      .sort((a, b) => a.opened_at.localeCompare(b.opened_at))
    const drawings = sessions.flatMap((s) => s.drawings.map((d) => ({ s, d }))).filter(({ d }) => inRange(d.created_at))
    /** Unified money-out ledger — expenses, stock buys and till drawings, oldest first. */
    const out = [
      ...exp.map((e) => ({
        id: `e${e.id}`, at: e.created_at, kind: 'Expense',
        detail: `${e.category_label} — ${e.name}`, payee: e.supplier_name || '—',
        status: e.payment_status_label, tone: PAY_TONE[e.payment_status] ?? 'slate' as Tone,
        amount: Number(e.amount), counted: e.payment_status === 'paid',
      })),
      ...pur.map((p) => ({
        id: `p${p.id}`, at: p.created_at, kind: 'Stock',
        detail: `${p.item} ×${p.quantity}`, payee: p.supplier_name || '—',
        status: p.payment_status_label, tone: PAY_TONE[p.payment_status] ?? 'slate' as Tone,
        amount: Number(p.total), counted: p.payment_status === 'paid',
      })),
      ...drawings.map(({ d }) => ({
        id: `d${d.id}`, at: d.created_at, kind: 'Drawing',
        detail: d.reason || 'Till drawing', payee: d.given_to || '—',
        status: DRAWING_LABEL[d.method], tone: 'blue' as Tone,
        amount: Number(d.amount), counted: true,
      })),
    ].sort((a, b) => a.at.localeCompare(b.at))
    return {
      stays,
      payments,
      deposits: sum(stays.map((b) => Number(b.deposit ?? 0))),
      cashIn: by('cash'),
      mpesaIn: by('mpesa'),
      visaIn: by('visa'),
      otherIn: by('bank', 'other'),
      /** Extra packages billed inside the period — part of guest payments. */
      shop: live.flatMap((b) => (b.packages ?? []).filter((pk) => inRange(pk.created_at))),
      exp,
      expPaid: sum(exp.filter((e) => e.payment_status === 'paid').map((e) => Number(e.amount))),
      expPending: sum(exp.filter((e) => e.payment_status === 'pending').map((e) => Number(e.amount))),
      pur,
      purPaid: sum(pur.filter((p) => p.payment_status === 'paid').map((p) => Number(p.total))),
      purPending: sum(pur.filter((p) => p.payment_status === 'pending').map((p) => Number(p.total))),
      sessions,
      drawings,
      drawCash: sum(drawings.filter(({ d }) => d.method === 'cash').map(({ d }) => Number(d.amount))),
      drawMpesa: sum(drawings.filter(({ d }) => d.method === 'mpesa').map(({ d }) => Number(d.amount))),
      drawCard: sum(drawings.filter(({ d }) => d.method === 'visa').map(({ d }) => Number(d.amount))),
      out,
      /** Billed but not yet collected on stays overlapping the period. */
      owed: sum(stays.map((b) => Math.max(0, Number(b.balance)))),
      /** Credit vouchers issued by room changes inside the period. */
      credits: sum(live.flatMap((b) => (b.vouchers ?? []).filter((v) => inRange(v.created_at))).map((v) => Number(v.amount))),
      /** Referral gift vouchers redeemed inside the period. */
      gifts: (referrals.data ?? []).filter((r) => r.redeemed_at && inRange(r.redeemed_at)),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings.data, expenses.data, purchases.data, tills.data, referrals.data, fromD, toD])

  /** Spending has no recorded channel — like the shift report, it's paid out of the cash drawer. */
  const spending = report.expPaid + report.purPaid
  const channels = [
    { label: 'Cash', hue: CH_HUE.cash, in: report.cashIn, out: report.drawCash + spending },
    { label: 'M-Pesa', hue: CH_HUE.mpesa, in: report.mpesaIn, out: report.drawMpesa },
    { label: 'Visa card', hue: CH_HUE.visa, in: report.visaIn, out: report.drawCard },
    { label: 'Bank & other', hue: CH_HUE.other, in: report.otherIn, out: 0 },
  ]
  const totalIn = report.payments.reduce((s, { p }) => s + Number(p.amount), 0) + report.deposits
  const totalOut = spending + report.drawCash + report.drawMpesa + report.drawCard
  const net = totalIn - totalOut
  const committed = report.expPending + report.purPending + report.owed
  const branchName = report.stays[0]?.branch_name ?? report.sessions[0]?.branch_name ?? report.exp[0]?.branch_name ?? 'Branch'
  const ready = Boolean(bookings.data && expenses.data && purchases.data && tills.data && referrals.data)
  const error = bookings.error || expenses.error || purchases.error || tills.error || referrals.error
  const loading = (bookings.loading || expenses.loading || purchases.loading || tills.loading || referrals.loading) && !ready

  function buildCsv() {
    const lines: string[] = []
    lines.push(`General money flow report,${esc(fromD)} to ${esc(toD)}`)
    lines.push('')
    lines.push('MONEY MOVEMENT BY CHANNEL')
    lines.push('Channel,Money in,Money out,Net flow')
    channels.forEach((c) => lines.push([c.label, c.in.toFixed(2), c.out.toFixed(2), (c.in - c.out).toFixed(2)].map(esc).join(',')))
    lines.push(['Total', totalIn.toFixed(2), totalOut.toFixed(2), net.toFixed(2)].map(esc).join(','))
    lines.push('')
    lines.push('MONEY IN')
    lines.push('Date,Guest,Room,Receipt#,Method,Amount')
    report.payments.forEach(({ b, p }) => lines.push([p.created_at, b.guest_name, b.room_name ?? '', p.receipt_number, p.method_label, p.amount].map(esc).join(',')))
    lines.push(`Booking deposits (unallocated),${report.deposits.toFixed(2)}`)
    lines.push('')
    lines.push('MONEY OUT')
    lines.push('Date,Type,Detail,Paid to,Status,Amount')
    report.out.forEach((r) => lines.push([r.at, r.kind, r.detail, r.payee, r.status, r.amount.toFixed(2)].map(esc).join(',')))
    lines.push('')
    lines.push('COMMITMENTS & CREDITS')
    lines.push(`Pending expenses,${report.expPending.toFixed(2)}`)
    lines.push(`Pending stock purchases,${report.purPending.toFixed(2)}`)
    lines.push(`Outstanding guest balances,${report.owed.toFixed(2)}`)
    lines.push(`Credit vouchers issued,${report.credits.toFixed(2)}`)
    lines.push(`Gift vouchers redeemed,${report.gifts.length}`)

    downloadCsv(`money-flow-report-${fromD}-to-${toD}.csv`, lines)
  }

  return (
    <>
      <RangePanel t={t} fromD={fromD} toD={toD} setFromD={setFromD} setToD={setToD} onCsv={buildCsv} ready={ready} title="General money flow report" me={me} />

      {error ? (
        <Panel t={t}><ErrorNote t={t} message={error} onRetry={() => { bookings.reload(); expenses.reload(); purchases.reload(); tills.reload(); referrals.reload() }} /></Panel>
      ) : loading ? (
        <Panel t={t}><Loading t={t} /></Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat t={t} i={0} icon={TrendingUp} label="Money in" value={formatMoney(totalIn)} hint={`${report.payments.length} guest payments + deposits`} />
            <Stat t={t} i={1} icon={ArrowDownToLine} label="Money out" value={formatMoney(totalOut)} hint="expenses, stock & drawings" />
            <Stat t={t} i={2} icon={Scale} label="Net flow" value={formatMoney(net)} hint={net < 0 ? 'more went out than came in' : undefined} />
            <Stat t={t} i={3} icon={Wallet} label="Still committed" value={formatMoney(committed)} hint="pending spend + guest balances" />
          </div>

          <section data-report-sheet className={`overflow-hidden ${t.radius} ${t.card}`}>
            <div data-sheet-head className="flex flex-wrap items-center justify-between gap-3 bg-slate-800 px-4 py-3.5 text-white sm:px-5 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-white/10">
                  <ArrowLeftRight className="size-5" />
                </span>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider sm:text-base">General money flow report</h2>
                  <p className="text-[11px] text-white/60">{branchName} · {formatDate(fromD)} — {formatDate(toD)}</p>
                </div>
              </div>
              <span className="text-[11px] text-white/80">Date: <span className="font-semibold text-white">{formatDate(toD)}</span></span>
            </div>

            {/* ---- Money movement by channel ---- */}
            <p className={`border-b px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider ${GRID} ${BAND.sky} ${TXT.sky}`}>Money movement by channel</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-left text-[11px]">
                <thead>
                  <tr className="bg-slate-100/90 dark:bg-white/[0.06]">
                    <th className={`${TH} ${t.muted}`}>Channel</th>
                    <th className={`${TH} text-right ${TXT.emerald}`}>Money in</th>
                    <th className={`${TH} text-right ${TXT.rose}`}>Money out</th>
                    <th className={`${TH} text-right ${t.muted}`}>Net flow</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.map((c) => (
                    <tr key={c.label} className="odd:bg-slate-50/70 hover:bg-sky-500/[0.04] dark:odd:bg-white/[0.02] dark:hover:bg-white/[0.04]">
                      <td className={`${TD} text-xs font-semibold ${TXT[c.hue]}`}>{c.label}</td>
                      <td className={`${TD} text-right`}>{money(c.in, 'emerald')}</td>
                      <td className={`${TD} text-right`}>{money(c.out, 'rose')}</td>
                      <td className={`${TD} text-right font-semibold`}>{c.in - c.out ? formatMoney(c.in - c.out) : <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-800 text-xs font-bold text-white dark:bg-slate-900">
                    <td className={`border-r ${GRID} px-2 py-2.5`}>Total</td>
                    <td className={`border-r ${GRID} px-2 py-2.5 text-right ${TXT.emerald}`}>{formatMoney(totalIn)}</td>
                    <td className={`border-r ${GRID} px-2 py-2.5 text-right ${TXT.rose}`}>{formatMoney(totalOut)}</td>
                    <td className="px-2 py-2.5 text-right">{formatMoney(net)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ---- Summary boxes — two columns on wider screens ---- */}
            <div className="grid sm:grid-cols-2">
              <div className={`border-b ${GRID} sm:border-r`}>
                <Box hue="emerald" label="Money in">
                  <Field label={`Guest payments (${report.payments.length})`} value={formatMoney(totalIn - report.deposits)} strong hint={TXT.emerald} />
                  <Field label="Cash" value={formatMoney(report.cashIn)} hint={TXT[CH_HUE.cash]} />
                  <Field label="M-Pesa" value={formatMoney(report.mpesaIn)} hint={TXT[CH_HUE.mpesa]} />
                  <Field label="Visa card" value={formatMoney(report.visaIn)} hint={TXT[CH_HUE.visa]} />
                  <Field label="Bank & other" value={formatMoney(report.otherIn)} hint={TXT[CH_HUE.other]} />
                  <Field label="Booking deposits" value={formatMoney(report.deposits)} />
                  <Field label={`Extra packages billed (${report.shop.length})`} value={formatMoney(sum(report.shop.map((pk) => Number(pk.amount))))} hint={TXT.teal} />
                </Box>
              </div>
              <div className={`border-b ${GRID}`}>
                <Box hue="rose" label="Money out">
                  <Field label={`Expenses paid (${report.exp.filter((e) => e.payment_status === 'paid').length})`} value={formatMoney(report.expPaid)} hint={TXT.rose} />
                  <Field label={`Stock purchases paid (${report.pur.filter((p) => p.payment_status === 'paid').length})`} value={formatMoney(report.purPaid)} hint={TXT.rose} />
                  <Field label={`Till drawings (${report.drawings.length})`} value={formatMoney(report.drawCash + report.drawMpesa + report.drawCard)} hint={TXT.rose} />
                  <Field label="— cash drawings" value={formatMoney(report.drawCash)} hint={TXT[CH_HUE.cash]} />
                  <Field label="— M-Pesa drawings" value={formatMoney(report.drawMpesa)} hint={TXT[CH_HUE.mpesa]} />
                  <Field label="— card drawings" value={formatMoney(report.drawCard)} hint={TXT[CH_HUE.visa]} />
                  <Field label="Total out" value={formatMoney(totalOut)} strong />
                </Box>
              </div>
              <div className={`border-b ${GRID} sm:border-r`}>
                <Box hue="amber" label="Commitments &amp; credits">
                  <Field label="Pending expenses" value={formatMoney(report.expPending)} hint={TXT.amber} />
                  <Field label="Pending stock purchases" value={formatMoney(report.purPending)} hint={TXT.amber} />
                  <Field label="Outstanding guest balances" value={formatMoney(report.owed)} hint={TXT.rose} />
                  <Field label="Credit vouchers issued" value={formatMoney(report.credits)} hint={TXT.teal} />
                  <Field label="Gift vouchers redeemed" value={`${report.gifts.length} ${report.gifts.length === 1 ? 'voucher' : 'vouchers'}`} hint={TXT.fuchsia} />
                </Box>
              </div>
              <div className={`border-b ${GRID}`}>
                <Box hue="indigo" label="Net position for the period">
                  <Field label="Money in" value={formatMoney(totalIn)} hint={TXT.emerald} />
                  <Field label="Money out" value={formatMoney(totalOut)} hint={TXT.rose} />
                  <Field label="Net flow" value={formatMoney(net)} strong hint={net < 0 ? TXT.rose : TXT.emerald} />
                  <Field label="Stays in period" value={report.stays.length} />
                </Box>
              </div>
            </div>

            {/* ---- Money out ledger ---- */}
            <p className={`border-b px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider ${GRID} ${BAND.rose} ${TXT.rose}`}>Money out — expenses, stock &amp; drawings</p>
            {!report.out.length ? (
              <div className="p-5">
                <Empty t={t} icon={Banknote} title="Nothing went out in this period" text="Paid expenses, stock purchases and till drawings in the selected dates appear here." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[44rem] border-collapse text-left text-[11px]">
                  <thead>
                    <tr className="bg-slate-100/90 dark:bg-white/[0.06]">
                      <th className={`${TH} w-8 text-center ${t.muted}`}>#</th>
                      <th className={`${TH} ${t.muted}`}>Date</th>
                      <th className={`${TH} ${t.muted}`}>Type</th>
                      <th className={`${TH} ${t.muted}`}>Details</th>
                      <th className={`${TH} ${t.muted}`}>Paid to</th>
                      <th className={`${TH} ${t.muted}`}>Status</th>
                      <th className={`${TH} text-right ${TXT.rose}`}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.out.map((r, i) => (
                      <tr key={r.id} className={`odd:bg-slate-50/70 hover:bg-sky-500/[0.04] dark:odd:bg-white/[0.02] dark:hover:bg-white/[0.04] ${r.counted ? '' : 'opacity-60'}`}>
                        <td className={`${TD} text-center font-semibold ${t.muted}`}>{i + 1}</td>
                        <td className={`${TD} whitespace-nowrap ${t.muted}`}>{fmtDT(r.at)}</td>
                        <td className={`${TD} font-semibold ${TXT[OUT_HUE[r.kind] ?? 'slate']}`}>{r.kind}</td>
                        <td className={`${TD} font-medium`}>{r.detail}</td>
                        <td className={TD}>{r.payee}</td>
                        <td className={TD}><Pill tone={r.tone}>{r.status}</Pill></td>
                        <td className={`${TD} text-right font-semibold ${TXT.rose}`}>{formatMoney(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-800 text-xs font-bold text-white dark:bg-slate-900">
                      <td className={`border-r ${GRID} px-2 py-2.5`} colSpan={6}>Total money out</td>
                      <td className={`px-2 py-2.5 text-right ${TXT.rose}`}>{formatMoney(totalOut)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  )
}
