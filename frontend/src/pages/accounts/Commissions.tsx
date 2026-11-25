import { Award, CheckCircle2, Gift, Hourglass, Users } from 'lucide-react'
import { Empty, ErrorNote, Loading, Panel, Pill, Stat, type Tone } from '../../components/hr/ui'
import { bnb, type ReferralMaturity } from '../../lib/bnb'
import { formatDate, formatMoney, useApi } from '../../lib/hr'
import type { AccountPageProps } from './types'

const MATURITY_TONE: Record<ReferralMaturity, Tone> = { partial: 'amber', matured: 'blue', void: 'red' }

const fmtDT = (iso: string) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Commissions({ t }: AccountPageProps) {
  const { data, error, loading, reload } = useApi(() => bnb.referrals({ limit: 500 }))

  const rows = data ?? []
  const totals = {
    partial: rows.filter((r) => r.maturity === 'partial').length,
    matured: rows.filter((r) => r.maturity === 'matured').length,
    redeemed: rows.filter((r) => r.redeemed_at).length,
    paid: rows.reduce((s, r) => s + Number(r.paid), 0),
  }

  const thCls = `px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider ${t.muted}`

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat t={t} i={0} icon={Gift} label="Gift vouchers" value={data ? rows.length : '—'} />
        <Stat t={t} i={1} icon={Hourglass} label="Maturing" value={data ? totals.partial : '—'} hint="client booked, awaiting payment" />
        <Stat t={t} i={2} icon={Award} label="Matured" value={data ? totals.matured : '—'} hint="client paid — ready to redeem" />
        <Stat t={t} i={3} icon={CheckCircle2} label="Gifts redeemed" value={data ? totals.redeemed : '—'} />
      </div>

      <Panel t={t} title="Commissions & gifts — generated automatically">
        {error ? (
          <ErrorNote t={t} message={error} onRetry={reload} />
        ) : loading ? (
          <Loading t={t} />
        ) : !rows.length ? (
          <Empty
            t={t}
            icon={Users}
            title="No commissions or gifts yet"
            text="When a new client names a referrer, a gift voucher is generated here automatically — it matures once the client pays."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-xs">
              <thead>
                <tr>
                  <th className={thCls}>Voucher</th>
                  <th className={thCls}>Earned by (referrer)</th>
                  <th className={thCls}>Referred client</th>
                  <th className={thCls}>Created</th>
                  <th className={`${thCls} text-right`}>Client paid</th>
                  <th className={thCls}>Maturity</th>
                  <th className={`${thCls} text-right`}>Gift status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-900/5 dark:border-white/5">
                    <td className="px-3 py-2.5 font-mono font-medium">{r.voucher_code}</td>
                    <td className="px-3 py-2.5">
                      <span className="block text-sm font-medium">{r.referrer_name}</span>
                      <span className={t.muted}>{r.referrer_phone}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="block">{r.guest_name}</span>
                      <span className={t.muted}>{r.room_name ?? '—'} · {r.booking_status_label}</span>
                    </td>
                    <td className={`px-3 py-2.5 ${t.muted}`}>{formatDate(r.created_at)}</td>
                    <td className="px-3 py-2.5 text-right font-medium">{formatMoney(r.paid)}</td>
                    <td className="px-3 py-2.5"><Pill tone={MATURITY_TONE[r.maturity]}>{r.maturity_label}</Pill></td>
                    <td className="px-3 py-2.5 text-right">
                      {r.redeemed_at ? (
                        <span className="block">
                          <Pill tone="green">Redeemed</Pill>
                          <span className={`mt-1 block ${t.muted}`}>{fmtDT(r.redeemed_at)}</span>
                        </span>
                      ) : (
                        <Pill tone="slate">Not redeemed</Pill>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > 0 && (
          <p className={`mt-3 text-[11px] ${t.muted}`}>
            Vouchers are generated from the Referrals register — redeem them from the Referrals page once they mature.
          </p>
        )}
      </Panel>
    </>
  )
}
