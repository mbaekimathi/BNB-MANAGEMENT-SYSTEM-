import { AnimatePresence, motion } from 'framer-motion'
import { Award, BadgeCheck, BedDouble, Building2, CalendarClock, Check, Gift, Hourglass, Phone, RefreshCw, Search, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Button, Empty, ErrorNote, Flash, Loading, PageHeader, Panel, Pill, Stat, type Tone } from '../components/hr/ui'
import { parseApiError, type Employee } from '../lib/api'
import { bnb, type Referral, type ReferralMaturity } from '../lib/bnb'
import { formatDate, formatMoney, useApi } from '../lib/hr'
import type { NavItem, WorkspaceTheme } from '../lib/workspaces'

const MATURITY_TONE: Record<ReferralMaturity, Tone> = { partial: 'amber', matured: 'green', void: 'red' }

const fmtDT = (iso: string) =>
  new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

/** Referral pipeline: who sent a new client, whether the reward matured, and voucher redemption. */
export default function ReferralsPage({ item, t, me }: { item: NavItem; t: WorkspaceTheme; me: Employee }) {
  const { data, error, loading, reload, setData } = useApi(() => bnb.referrals({ limit: 500 }))
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(0)
  const [flash, setFlash] = useState({ text: '', bad: false })

  const match = (r: Referral) =>
    !q || `${r.referrer_name} ${r.referrer_phone} ${r.guest_name} ${r.guest_phone} ${r.voucher_code}`.toLowerCase().includes(q.toLowerCase())
  const list = (data ?? []).filter(match)
  const th = `px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider ${t.muted}`

  const matured = (data ?? []).filter((r) => r.maturity === 'matured').length
  const partial = (data ?? []).filter((r) => r.maturity === 'partial').length
  const redeemed = (data ?? []).filter((r) => r.redeemed_at).length

  async function redeem(r: Referral) {
    setBusy(r.id)
    setFlash({ text: '', bad: false })
    try {
      const next = await bnb.redeemReferral(r.id)
      setData((l) => l?.map((x) => (x.id === r.id ? next : x)) ?? null)
      setFlash({ text: `${next.voucher_code} redeemed — hand ${next.referrer_name} their gift voucher.`, bad: false })
    } catch (err) {
      setFlash({ text: parseApiError(err).message, bad: true })
    } finally {
      setBusy(0)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        t={t}
        icon={item.icon}
        title={item.label}
        text={item.description}
        actions={
          <Button t={t} variant="ghost" onClick={reload}>
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        }
      />

      {!me.branch ? (
        <Panel t={t}>
          <Empty
            t={t}
            icon={Building2}
            title="No branch allocated yet"
            text="Your account isn't assigned to a BnB branch, so there are no referrals to show. Ask your manager or IT support to allocate you."
          />
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Stat t={t} i={0} icon={UserPlus} label="Referrals" value={data ? data.length : '—'} />
            <Stat t={t} i={1} icon={BadgeCheck} label="Matured" value={data ? matured : '—'} hint="client paid — voucher ready" />
            <Stat t={t} i={2} icon={Hourglass} label="Part matured" value={data ? partial : '—'} hint="reserved, awaiting payment" />
            <Stat t={t} i={3} icon={Gift} label="Vouchers redeemed" value={data ? redeemed : '—'} />
          </div>

          <div className="relative sm:max-w-xs">
            <Search className={`pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 ${t.muted}`} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search referrer, client or voucher"
              className={`h-10 w-full bg-transparent pl-9 pr-3 text-sm outline-none focus:ring-2 ${t.radius} ${t.chip} ${t.ring}`}
            />
          </div>

          <Flash message={flash.text} tone={flash.bad ? 'red' : 'green'} />

          {error ? (
            <ErrorNote t={t} message={error} onRetry={reload} />
          ) : loading && !data ? (
            <Panel t={t}><Loading t={t} /></Panel>
          ) : (
            <Panel t={t} title="Referrals" actions={<Pill tone="blue">{list.length}</Pill>}>
              {!list.length ? (
                <Empty
                  t={t}
                  icon={Gift}
                  title={data?.length ? 'No referrals match your search' : 'No referrals yet'}
                  text={data?.length ? 'Try a different search.' : 'When a new client names who sent them on Register client, the referral and its gift voucher appear here.'}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="rtable w-full min-w-[62rem] table-fixed border-collapse">
                    <thead>
                      <tr className={`border-b ${t.sidebarDivider}`}>
                        <th className={`w-[24%] ${th}`}>Referrer</th>
                        <th className={`w-[24%] ${th}`}>New client</th>
                        <th className={`w-[13%] ${th}`}>Maturity</th>
                        <th className={`w-[15%] ${th}`}>Voucher</th>
                        <th className={`w-[14%] ${th}`}>Paid</th>
                        <th className={`${th} text-right`}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence initial={false}>
                        {list.map((r, i) => (
                          <ReferralRow key={r.id} t={t} r={r} i={i} busy={busy === r.id} onRedeem={() => void redeem(r)} />
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}
        </>
      )}
    </div>
  )
}

/** One referral row — referrer, the client they sent, maturity and voucher redemption. */
function ReferralRow({ t, r, i, busy, onRedeem }: { t: WorkspaceTheme; r: Referral; i: number; busy: boolean; onRedeem: () => void }) {
  const canRedeem = r.maturity === 'matured' && !r.redeemed_at
  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: Math.min(i, 10) * 0.03, duration: 0.25 }}
      className={`border-b transition-colors last:border-b-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] ${t.sidebarDivider}`}
    >
      <td className="max-w-0 px-3 py-3 align-top">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`grid size-9 shrink-0 place-items-center text-xs font-bold ${t.radius} ${t.iconBox}`}>
            {initials(r.referrer_name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{r.referrer_name}</p>
            <p className={`truncate text-xs ${t.muted}`}><Phone className="mr-1 inline size-3" />{r.referrer_phone}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 align-top text-xs">
        <p className="truncate text-sm font-semibold">{r.guest_name}</p>
        <p className={`mt-0.5 truncate ${t.muted}`}>
          <BedDouble className="mr-1 inline size-3" />{r.room_name ?? 'Room'} · {r.booking_status_label}
        </p>
      </td>
      <td className="px-3 py-3 align-top">
        <Pill tone={MATURITY_TONE[r.maturity]}>{r.maturity_label}</Pill>
      </td>
      <td className="px-3 py-3 align-top text-xs">
        <p className="font-semibold tabular-nums">{r.voucher_code}</p>
        {r.redeemed_at ? (
          <p className={`mt-0.5 ${t.muted}`}>
            <Check className="mr-1 inline size-3" />Redeemed {formatDate(r.redeemed_at)}
            {r.redeemed_by_name ? ` · ${r.redeemed_by_name}` : ''}
          </p>
        ) : (
          <p className={`mt-0.5 ${t.muted}`}>Not redeemed</p>
        )}
      </td>
      <td className="px-3 py-3 align-top text-xs">
        <p className="font-medium">{formatMoney(r.paid)}</p>
        <p className={`mt-0.5 ${t.muted}`}>of {formatMoney(r.billed)} billed</p>
        <p className={`mt-0.5 ${t.muted}`}><CalendarClock className="mr-1 inline size-3" />{fmtDT(r.created_at)}</p>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex items-center justify-end gap-2">
          {r.redeemed_at ? (
            <Pill tone="blue"><Award className="mr-1 inline size-3" />Redeemed</Pill>
          ) : (
            <Button t={t} busy={busy} disabled={!canRedeem} onClick={onRedeem}>
              <Gift className="size-3.5" /> Redeem voucher
            </Button>
          )}
        </div>
        {r.maturity !== 'matured' && !r.redeemed_at && (
          <p className={`mt-1.5 text-right text-[10px] ${t.muted}`}>
            {r.maturity === 'void' ? 'Booking cancelled — no voucher' : 'Redeems once the client pays'}
          </p>
        )}
      </td>
    </motion.tr>
  )
}
