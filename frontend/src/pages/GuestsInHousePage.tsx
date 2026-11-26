import { AnimatePresence, motion } from 'framer-motion'
import { AlarmClock, ArrowUpRight, Ban, BedDouble, Building2, CalendarCheck, CalendarClock, Clock, Globe, Hourglass, IdCard, LogIn, LogOut, Mail, MessageSquare, Phone, Receipt, RefreshCw, Search, Users, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Empty, ErrorNote, Flash, LinkButton, Loading, PageHeader, Panel, Pill, Stat, type Tone } from '../components/hr/ui'
import { parseApiError, type Employee } from '../lib/api'
import { bnb, clientKey, stayLength, type Booking } from '../lib/bnb'
import { clientPath, rolePath } from '../lib/roles'
import { formatMoney, useApi } from '../lib/hr'
import { useNow } from '../lib/time'
import type { NavItem, WorkspaceTheme } from '../lib/workspaces'

const fmtD = (iso: string) => new Date(iso).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })

const sameDay = (iso: string, now: number) => {
  const a = new Date(iso), b = new Date(now)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

/** Remaining time as {n, unit}: months > weeks > days > hours > minutes. null when `iso` is past. */
function splitLeft(iso: string, now: number) {
  const ms = new Date(iso).getTime() - now
  if (ms <= 0) return null
  const mins = Math.ceil(ms / 60000)
  if (mins < 60) return { n: mins, unit: 'min' as const }
  const hours = Math.floor(mins / 60)
  if (hours < 24) return { n: hours, unit: 'hour' as const }
  const days = Math.floor(hours / 24)
  if (days < 7) return { n: days, unit: 'day' as const }
  if (days < 30) return { n: Math.max(1, Math.floor(days / 7)), unit: 'week' as const }
  return { n: Math.floor(days / 30), unit: 'month' as const }
}

const unitText = (u: { n: number; unit: string }) => `${u.n} ${u.unit}${u.n === 1 || u.unit === 'min' ? '' : 's'}`

/** Countdown to a guest's scheduled checkout. */
function timeLeft(end: string, now: number): { text: string; tone: Tone } {
  const u = splitLeft(end, now)
  if (!u) return { text: 'Checkout overdue', tone: 'red' }
  return { text: `${unitText(u)} left`, tone: u.unit === 'min' || u.unit === 'hour' ? 'amber' : 'slate' }
}

/** 0–100 elapsed share of a stay, for the progress bar. */
const stayProgress = (b: Booking, now: number) => {
  const s = new Date(b.start).getTime(), e = new Date(b.end).getTime()
  if (e <= s) return 100
  return Math.min(100, Math.max(0, ((now - s) / (e - s)) * 100))
}

export default function GuestsInHousePage({ item, t, me }: { item: NavItem; t: WorkspaceTheme; me: Employee }) {
  const { data, error, loading, reload } = useApi(() => bnb.bookings({ status: 'occupied' }))
  const [q, setQ] = useState('')
  const now = useNow(30_000).getTime()

  const inHouse = useMemo(
    () => (data ?? []).filter((b) => b.status === 'occupied').sort((a, b) => a.end.localeCompare(b.end)),
    [data],
  )
  const match = (b: Booking) => !q || `${b.guest_name} ${b.room_name} ${b.guest_phone} ${b.guest_email} ${b.guest_id_number} ${(b.companions ?? []).map((c) => `${c.name} ${c.id_number} ${c.phone} ${c.email}`).join(' ')}`.toLowerCase().includes(q.toLowerCase())
  const list = inHouse.filter(match)
  const leavingToday = inHouse.filter((b) => sameDay(b.end, now)).length
  const overdue = inHouse.filter((b) => new Date(b.end).getTime() < now).length
  const th = `px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider ${t.muted}`

  const base = rolePath(me.role)

  return (
    <div className="space-y-5">
      <PageHeader t={t} icon={item.icon} title={item.label} text={item.description} actions={<LiveBadge t={t} />} />

      <BoardLinks t={t} base={base} active="in-house" />

      {!me.branch ? (
        <Panel t={t}>
          <Empty
            t={t}
            icon={Building2}
            title="No branch allocated yet"
            text="Your account isn't assigned to a BnB branch, so there are no guests to show. Ask your manager or IT support to allocate you."
          />
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Stat t={t} i={0} icon={Users} label="Guests in house" value={data ? inHouse.reduce((n, b) => n + b.guests, 0) : '—'} />
            <Stat t={t} i={1} icon={BedDouble} label="Occupied rooms" value={data ? inHouse.length : '—'} />
            <Stat t={t} i={2} icon={LogOut} label="Checking out today" value={data ? leavingToday : '—'} />
            <Stat t={t} i={3} icon={AlarmClock} label="Overdue checkouts" value={data ? overdue : '—'} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative sm:max-w-xs sm:flex-1">
              <Search className={`pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 ${t.muted}`} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search guest, room or phone"
                className={`h-10 w-full bg-transparent pl-9 pr-3 text-sm outline-none focus:ring-2 ${t.radius} ${t.chip} ${t.ring}`}
              />
            </div>
            <Button t={t} variant="ghost" onClick={reload} className="sm:ml-auto">
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          {error ? (
            <ErrorNote t={t} message={error} onRetry={reload} />
          ) : loading && !data ? (
            <Panel t={t}><Loading t={t} /></Panel>
          ) : (
            <Panel t={t} title="In house now" actions={<BoardCount t={t} n={list.length} dot="bg-sky-500" />}>
              {!list.length ? (
                <Empty
                  t={t}
                  icon={Users}
                  title={inHouse.length ? 'No guests match your search' : 'Nobody is checked in'}
                  text={inHouse.length ? 'Try a different search.' : 'Guests checked in from Reservations will appear here with a live countdown to checkout.'}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[68rem] table-fixed border-collapse">
                    <thead>
                      <tr className={`border-b ${t.sidebarDivider}`}>
                        <th className={th}>Guest</th>
                        <th className={`w-44 ${th}`}>Room</th>
                        <th className={`w-56 ${th}`}>Stay</th>
                        <th className={`w-40 ${th}`}>Payment</th>
                        <th className={`w-36 ${th}`}>Checkout</th>
                        <th className={`w-32 ${th} text-right`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence initial={false}>
                        {list.map((b, i) => (
                          <GuestRow
                            key={b.id} t={t} b={b} i={i} now={now}
                            to={`${clientPath(me.role)}/${encodeURIComponent(clientKey(b))}`}
                          />
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

/** Pulsing LIVE clock shown in the page header. */
function LiveBadge({ t }: { t: WorkspaceTheme }) {
  const now = useNow()
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold ${t.radius} ${t.chip}`}>
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
      </span>
      <span className="tabular-nums">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
    </span>
  )
}

/** Coloured dot + count shown in a board panel's header. */
function BoardCount({ t, n, dot }: { t: WorkspaceTheme; n: number; dot: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold tabular-nums ${t.radius} ${t.chip}`}>
      <span className={`size-1.5 rounded-full ${dot}`} />
      {n}
    </span>
  )
}

/** Payment state for a booking row — Paid / Partial / Not paid, plus the balance owed. */
export function PayState({ t, b }: { t: WorkspaceTheme; b: Booking }) {
  const balance = Math.max(0, Number(b.balance))
  const state: { tone: Tone; text: string } = balance <= 0
    ? { tone: 'green', text: 'Paid' }
    : Number(b.paid) > 0
      ? { tone: 'amber', text: 'Partial' }
      : { tone: 'red', text: 'Not paid' }
  return (
    <div className="flex flex-col items-start gap-1">
      <Pill tone={state.tone}><Wallet className="mr-1 inline size-3" />{state.text}</Pill>
      {balance > 0 && <span className={`text-[11px] font-semibold tabular-nums ${t.muted}`}>Balance {formatMoney(balance)}</span>}
    </div>
  )
}

/** In-house guest list row: initials, meta, live stay progress and checkout countdown. */
function GuestRow({ t, b, i, now, to }: { t: WorkspaceTheme; b: Booking; i: number; now: number; to: string }) {
  const left = timeLeft(b.end, now)
  const isOverdue = left.tone === 'red'
  const pct = stayProgress(b, now)
  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: Math.min(i, 10) * 0.03, duration: 0.25 }}
      className={`border-b transition-colors last:border-b-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] ${t.sidebarDivider}`}
    >
      <td className="max-w-0 px-3 py-3 align-top">
        <Link to={to} title={`Open ${b.guest_name}'s portal`} className="group flex min-w-0 gap-3">
          <span className={`grid size-10 shrink-0 place-items-center text-xs font-bold ${t.radius} ${t.iconBox}`}>
            {initials(b.guest_name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold group-hover:underline">{b.guest_name}</p>
            <p className={`truncate text-xs ${t.muted}`}>
              {b.guest_phone && <><Phone className="mr-1 inline size-3" />{b.guest_phone}</>}
              {b.guest_phone && b.deposit ? <span className="mx-1.5">·</span> : ''}
              {b.deposit ? <><Wallet className="mr-1 inline size-3" />deposit {formatMoney(b.deposit)}</> : ''}
            </p>
            {(b.guest_id_number || b.guest_email || b.guest_nationality) && (
              <p className={`truncate text-xs ${t.muted}`}>
                {b.guest_id_number ? <><IdCard className="mr-1 inline size-3" />{b.guest_id_type_label ?? 'ID'} {b.guest_id_number}</> : ''}
                {b.guest_id_number && (b.guest_email || b.guest_nationality) ? <span className="mx-1.5">·</span> : ''}
                {b.guest_email ? <><Mail className="mr-1 inline size-3" />{b.guest_email}</> : ''}
                {b.guest_email && b.guest_nationality ? <span className="mx-1.5">·</span> : ''}
                {b.guest_nationality ? <><Globe className="mr-1 inline size-3" />{b.guest_nationality}</> : ''}
              </p>
            )}
            {b.guest_notes && (
              <p className={`truncate text-xs ${t.muted}`} title={b.guest_notes}>
                <MessageSquare className="mr-1 inline size-3" />{b.guest_notes}
              </p>
            )}
          </div>
        </Link>
      </td>
      <td className="px-3 py-3 align-top text-xs">
        <p className="flex items-center gap-1.5 font-medium">
          <BedDouble className="size-3.5 shrink-0" /><span className="truncate">{b.room_name}</span>
        </p>
        <p className={`mt-1 ${t.muted}`}>
          <Users className="mr-1 inline size-3" />{b.guests} {b.guests === 1 ? 'guest' : 'guests'}
        </p>
        {(b.companions?.length ?? 0) > 0 && (
          <p className={`truncate ${t.muted}`} title={b.companions.map((c) => c.name).join(', ')}>
            with {b.companions.map((c) => (c.room_name ? `${c.name} · ${c.room_name}` : c.name)).join(', ')}
          </p>
        )}
      </td>
      <td className="px-3 py-3 align-top text-xs">
        <p><CalendarClock className="mr-1 inline size-3" />{fmtD(b.start)} → {fmtD(b.end)}</p>
        <p className={`mt-0.5 ${t.muted}`}>{stayLength(b)}</p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10">
            <div
              className={`h-full rounded-full transition-[width] duration-1000 ${isOverdue ? 'bg-rose-500' : t.brandMark}`}
              style={{ width: `${isOverdue ? 100 : pct}%` }}
            />
          </div>
          <span className={`shrink-0 text-[10px] tabular-nums ${isOverdue ? 'font-semibold text-rose-500' : t.muted}`}>
            {isOverdue ? 'overdue' : `${Math.round(pct)}%`}
          </span>
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <PayState t={t} b={b} />
      </td>
      <td className="px-3 py-3 align-top">
        <Pill tone={left.tone}><Clock className="mr-1 inline size-3" />{left.text}</Pill>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex items-center justify-end">
          <LinkButton t={t} to={to} title={`Open ${b.guest_name}'s portal — check out happens there`}>
            <ArrowUpRight className="size-3.5" /> Open portal
          </LinkButton>
        </div>
      </td>
    </motion.tr>
  )
}

const TXN_TONE: Record<string, Tone> = { 'In house': 'blue', Reserved: 'amber', 'Day rest': 'green' }

/** Board label for a live transaction — in-house stays, reservations, day rests. */
const txnType = (b: Booking) => (b.kind === 'day_rest' ? 'Day rest' : b.status === 'reserved' ? 'Reserved' : 'In house')

/** When the booking next needs attention: arrival for reservations, checkout for stays. */
function txnTiming(b: Booking, now: number): { text: string; tone: Tone } {
  const u = splitLeft(b.status === 'reserved' ? b.start : b.end, now)
  if (!u)
    return b.status === 'reserved' ? { text: 'Arriving now', tone: 'amber' } : { text: 'Due now', tone: 'red' }
  return {
    text: b.status === 'reserved' ? `in ${unitText(u)}` : `${unitText(u)} left`,
    tone: u.unit === 'min' || u.unit === 'hour' ? 'amber' : 'slate',
  }
}

/** Links between the guest boards — all transactions, in house, reservations and day rest. */
export function BoardLinks({ t, base, active }: { t: WorkspaceTheme; base: string; active: string }) {
  const links = [
    { slug: '', label: 'All transactions', icon: Receipt },
    { slug: 'in-house', label: 'In house', icon: Users },
    { slug: 'check-out', label: 'Check out', icon: LogOut },
    { slug: 'reservations', label: 'Reservations', icon: CalendarCheck },
    { slug: 'day-rest', label: 'Day rest', icon: Hourglass },
  ]
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <Link
          key={l.slug}
          to={l.slug ? `${base}/guests-in-house/${l.slug}` : `${base}/guests-in-house`}
          aria-current={l.slug === active ? 'page' : undefined}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold transition hover:opacity-80 ${t.radius} ${l.slug === active ? t.badge : t.chip}`}
        >
          <l.icon className="size-3.5" /> {l.label}
        </Link>
      ))}
    </div>
  )
}

/** Every live guest transaction at the branch in one board — in-house stays,
 *  upcoming reservations and day rests, each with its next action. */
export function AllTransactionsPage({ item, t, me }: { item: NavItem; t: WorkspaceTheme; me: Employee }) {
  const { data, error, loading, reload, setData } = useApi(() => bnb.bookings({ limit: 500 }))
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(0)
  const [flash, setFlash] = useState({ text: '', bad: false })
  const now = useNow(30_000).getTime()
  const base = rolePath(me.role)

  const txns = useMemo(() => {
    const rank = (b: Booking) => ({ 'In house': 0, Reserved: 1, 'Day rest': 2 })[txnType(b)]
    return (data ?? [])
      .filter((b) => b.status === 'occupied' || b.status === 'reserved')
      .sort((a, b) => rank(a) - rank(b) || a.end.localeCompare(b.end))
  }, [data])
  const match = (b: Booking) => !q || `${b.guest_name} ${b.room_name} ${b.guest_phone} ${b.guest_email} ${b.guest_id_number} ${(b.companions ?? []).map((c) => `${c.name} ${c.id_number} ${c.phone} ${c.email}`).join(' ')}`.toLowerCase().includes(q.toLowerCase())
  const list = txns.filter(match)
  const count = (label: string) => txns.filter((b) => txnType(b) === label).length
  const th = `px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider ${t.muted}`

  async function act(b: Booking, fn: (id: number) => Promise<Booking>, done: string) {
    setBusy(b.id)
    setFlash({ text: '', bad: false })
    try {
      const next = await fn(b.id)
      setData((l) => l?.map((x) => (x.id === b.id ? next : x)) ?? null)
      setFlash({ text: done, bad: false })
    } catch (err) {
      setFlash({ text: parseApiError(err).message, bad: true })
    } finally {
      setBusy(0)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader t={t} icon={item.icon} title={item.label} text={item.description} actions={<LiveBadge t={t} />} />

      <BoardLinks t={t} base={base} active="" />

      {!me.branch ? (
        <Panel t={t}>
          <Empty
            t={t}
            icon={Building2}
            title="No branch allocated yet"
            text="Your account isn't assigned to a BnB branch, so there are no transactions to show. Ask your manager or IT support to allocate you."
          />
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Stat t={t} i={0} icon={Users} label="In house" value={data ? count('In house') : '—'} />
            <Stat t={t} i={1} icon={CalendarCheck} label="Reserved" value={data ? count('Reserved') : '—'} />
            <Stat t={t} i={2} icon={Hourglass} label="Day rest" value={data ? count('Day rest') : '—'} />
            <Stat t={t} i={3} icon={Receipt} label="Transactions" value={data ? txns.length : '—'} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative sm:max-w-xs sm:flex-1">
              <Search className={`pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 ${t.muted}`} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search guest, room or phone"
                className={`h-10 w-full bg-transparent pl-9 pr-3 text-sm outline-none focus:ring-2 ${t.radius} ${t.chip} ${t.ring}`}
              />
            </div>
            <Button t={t} variant="ghost" onClick={reload} className="sm:ml-auto">
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          <Flash message={flash.text} tone={flash.bad ? 'red' : 'green'} />

          {error ? (
            <ErrorNote t={t} message={error} onRetry={reload} />
          ) : loading && !data ? (
            <Panel t={t}><Loading t={t} /></Panel>
          ) : (
            <Panel t={t} title="All transactions" actions={<BoardCount t={t} n={list.length} dot="bg-sky-500" />}>
              {!list.length ? (
                <Empty
                  t={t}
                  icon={Receipt}
                  title={txns.length ? 'No transactions match your search' : 'No live transactions'}
                  text={txns.length ? 'Try a different search.' : 'In-house guests, upcoming reservations and live day rests appear here.'}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[74rem] table-fixed border-collapse">
                    <thead>
                      <tr className={`border-b ${t.sidebarDivider}`}>
                        <th className={th}>Guest</th>
                        <th className={`w-44 ${th}`}>Room</th>
                        <th className={`w-28 ${th}`}>Type</th>
                        <th className={`w-56 ${th}`}>Window</th>
                        <th className={`w-40 ${th}`}>Payment</th>
                        <th className={`w-32 ${th}`}>Timing</th>
                        <th className={`w-56 ${th} text-right`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence initial={false}>
                        {list.map((b, i) => (
                          <TxnRow
                            key={b.id} t={t} b={b} i={i} now={now} busy={busy === b.id}
                            to={`${clientPath(me.role)}/${encodeURIComponent(clientKey(b))}`}
                            onCheckin={() => void act(b, bnb.checkinBooking, `${b.guest_name} checked into ${b.room_name}.`)}
                            onCancel={() => void act(b, bnb.cancelBooking, `${b.guest_name}'s booking was cancelled.`)}
                          />
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

/** All-transactions row: guest, room, board type, stay window, payment and next action. */
function TxnRow({ t, b, i, now, busy, to, onCheckin, onCancel }: { t: WorkspaceTheme; b: Booking; i: number; now: number; busy: boolean; to: string; onCheckin: () => void; onCancel: () => void }) {
  const type = txnType(b)
  const when = txnTiming(b, now)
  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: Math.min(i, 10) * 0.03, duration: 0.25 }}
      className={`border-b transition-colors last:border-b-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] ${t.sidebarDivider}`}
    >
      <td className="max-w-0 px-3 py-3 align-top">
        <Link to={to} title={`Open ${b.guest_name}'s portal`} className="group flex min-w-0 gap-3">
          <span className={`grid size-10 shrink-0 place-items-center text-xs font-bold ${t.radius} ${t.iconBox}`}>
            {initials(b.guest_name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold group-hover:underline">{b.guest_name}</p>
            {b.guest_phone && (
              <p className={`truncate text-xs ${t.muted}`}>
                <Phone className="mr-1 inline size-3" />{b.guest_phone}
              </p>
            )}
          </div>
        </Link>
      </td>
      <td className="px-3 py-3 align-top text-xs">
        <p className="flex items-center gap-1.5 font-medium">
          <BedDouble className="size-3.5 shrink-0" /><span className="truncate">{b.room_name}</span>
        </p>
        <p className={`mt-1 ${t.muted}`}>
          <Users className="mr-1 inline size-3" />{b.guests} {b.guests === 1 ? 'guest' : 'guests'}
        </p>
      </td>
      <td className="px-3 py-3 align-top">
        <Pill tone={TXN_TONE[type]}>{type}</Pill>
      </td>
      <td className="px-3 py-3 align-top text-xs">
        <p><CalendarClock className="mr-1 inline size-3" />{fmtD(b.start)} → {fmtD(b.end)}</p>
        <p className={`mt-0.5 ${t.muted}`}>{stayLength(b)}</p>
      </td>
      <td className="px-3 py-3 align-top">
        <PayState t={t} b={b} />
      </td>
      <td className="px-3 py-3 align-top">
        <Pill tone={when.tone}><Clock className="mr-1 inline size-3" />{when.text}</Pill>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex items-center justify-end gap-2">
          {b.status === 'reserved' ? (
            <>
              <Button t={t} busy={busy} onClick={onCheckin}>
                <LogIn className="size-3.5" /> Check in
              </Button>
              <Button t={t} variant="danger" disabled={busy} onClick={onCancel}>
                <Ban className="size-3.5" /> Cancel
              </Button>
            </>
          ) : (
            <LinkButton t={t} to={to} title={`Open ${b.guest_name}'s portal — check out happens there`}>
              <ArrowUpRight className="size-3.5" /> Open portal
            </LinkButton>
          )}
        </div>
      </td>
    </motion.tr>
  )
}

/** Occupied stays whose checkout falls today — or is already past — so the
 *  desk can tick them off and release the rooms in one go. */
export function CheckOutsPage({ item, t, me }: { item: NavItem; t: WorkspaceTheme; me: Employee }) {
  const { data, error, loading, reload, setData } = useApi(() => bnb.bookings({ status: 'occupied' }))
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState({ text: '', bad: false })
  const now = useNow(30_000).getTime()
  const base = rolePath(me.role)

  const due = useMemo(
    () =>
      (data ?? [])
        .filter((b) => b.status === 'occupied' && (sameDay(b.end, now) || new Date(b.end).getTime() < now))
        .sort((a, b) => a.end.localeCompare(b.end)),
    [data, now],
  )
  const match = (b: Booking) => !q || `${b.guest_name} ${b.room_name} ${b.guest_phone} ${b.guest_email} ${b.guest_id_number} ${(b.companions ?? []).map((c) => `${c.name} ${c.id_number} ${c.phone} ${c.email}`).join(' ')}`.toLowerCase().includes(q.toLowerCase())
  const list = due.filter(match)
  const chosen = list.filter((b) => picked.has(b.id))
  const allPicked = list.length > 0 && chosen.length === list.length
  const overdue = due.filter((b) => new Date(b.end).getTime() < now).length
  const unpaid = due.filter((b) => Number(b.balance) > 0).length
  const th = `px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider ${t.muted}`

  function toggle(id: number) {
    setPicked((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setPicked((s) => {
      const next = new Set(s)
      if (allPicked) list.forEach((b) => next.delete(b.id))
      else list.forEach((b) => next.add(b.id))
      return next
    })
  }

  /** Check out every ticked stay, one call each — a failure stops nothing else. */
  async function checkOut() {
    if (!chosen.length || busy) return
    setBusy(true)
    setFlash({ text: '', bad: false })
    const done: Booking[] = []
    const failed: string[] = []
    for (const b of chosen) {
      try {
        done.push(await bnb.checkoutBooking(b.id))
      } catch (err) {
        failed.push(`${b.guest_name}: ${parseApiError(err).message}`)
      }
    }
    if (done.length) setData((l) => l?.map((x) => done.find((d) => d.id === x.id) ?? x) ?? null)
    setPicked((s) => {
      const next = new Set(s)
      done.forEach((d) => next.delete(d.id))
      return next
    })
    setFlash({
      text: [
        done.length
          ? `${done.length} ${done.length === 1 ? 'guest' : 'guests'} checked out — ${done.map((d) => d.room_name).join(', ')} ${done.length === 1 ? 'is' : 'are'} free.`
          : '',
        ...failed,
      ]
        .filter(Boolean)
        .join(' '),
      bad: !!failed.length,
    })
    setBusy(false)
  }

  return (
    <div className="space-y-5">
      <PageHeader t={t} icon={item.icon} title={item.label} text={item.description} actions={<LiveBadge t={t} />} />

      <BoardLinks t={t} base={base} active="check-out" />

      {!me.branch ? (
        <Panel t={t}>
          <Empty
            t={t}
            icon={Building2}
            title="No branch allocated yet"
            text="Your account isn't assigned to a BnB branch, so there are no checkouts to show. Ask your manager or IT support to allocate you."
          />
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Stat t={t} i={0} icon={LogOut} label="Due out today" value={data ? due.length : '—'} />
            <Stat t={t} i={1} icon={AlarmClock} label="Overdue checkouts" value={data ? overdue : '—'} />
            <Stat t={t} i={2} icon={Wallet} label="Unpaid balances" value={data ? unpaid : '—'} />
            <Stat t={t} i={3} icon={Users} label="Selected" value={chosen.length} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative sm:max-w-xs sm:flex-1">
              <Search className={`pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 ${t.muted}`} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search guest, room or phone"
                className={`h-10 w-full bg-transparent pl-9 pr-3 text-sm outline-none focus:ring-2 ${t.radius} ${t.chip} ${t.ring}`}
              />
            </div>
            <Button t={t} variant="ghost" onClick={reload} className="sm:ml-auto">
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          <Flash message={flash.text} tone={flash.bad ? 'red' : 'green'} />

          {error ? (
            <ErrorNote t={t} message={error} onRetry={reload} />
          ) : loading && !data ? (
            <Panel t={t}><Loading t={t} /></Panel>
          ) : (
            <Panel t={t} title="Ready to check out" actions={<BoardCount t={t} n={list.length} dot="bg-sky-500" />}>
              {!list.length ? (
                <Empty
                  t={t}
                  icon={LogOut}
                  title={due.length ? 'No departures match your search' : 'Nobody is due out today'}
                  text={due.length ? 'Try a different search.' : 'Guests whose stay ends today — or is already overdue — appear here for a quick batch check out.'}
                />
              ) : (
                <>
                  <div className={`flex flex-wrap items-center gap-3 border-b px-3 py-3 ${t.sidebarDivider}`}>
                    <span className={`text-xs font-semibold ${t.muted}`}>
                      {chosen.length ? `${chosen.length} of ${list.length} selected` : 'Tick the guests leaving now'}
                    </span>
                    {unpaid > 0 && <span className={`text-[11px] ${t.muted}`}>· {unpaid} still {unpaid === 1 ? 'owes' : 'owe'} a balance</span>}
                    <div className="ml-auto flex items-center gap-2">
                      {chosen.length > 0 && (
                        <Button t={t} variant="ghost" disabled={busy} onClick={() => setPicked(new Set())}>
                          Clear
                        </Button>
                      )}
                      <Button t={t} busy={busy} disabled={!chosen.length} onClick={() => void checkOut()}>
                        <LogOut className="size-3.5" /> Check out{chosen.length ? ` ${chosen.length}` : ''}
                      </Button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[70rem] table-fixed border-collapse">
                      <thead>
                        <tr className={`border-b ${t.sidebarDivider}`}>
                          <th className={`w-12 ${th}`}>
                            <input
                              type="checkbox"
                              checked={allPicked}
                              onChange={toggleAll}
                              aria-label="Select all guests due out"
                              className="size-4 cursor-pointer align-middle accent-sky-500"
                            />
                          </th>
                          <th className={th}>Guest</th>
                          <th className={`w-44 ${th}`}>Room</th>
                          <th className={`w-52 ${th}`}>Stay</th>
                          <th className={`w-40 ${th}`}>Payment</th>
                          <th className={`w-36 ${th}`}>Checkout</th>
                          <th className={`w-32 ${th} text-right`}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        <AnimatePresence initial={false}>
                          {list.map((b, i) => (
                            <DepartureRow
                              key={b.id} t={t} b={b} i={i} now={now}
                              checked={picked.has(b.id)} disabled={busy}
                              onToggle={() => toggle(b.id)}
                              to={`${clientPath(me.role)}/${encodeURIComponent(clientKey(b))}`}
                            />
                          ))}
                        </AnimatePresence>
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Panel>
          )}
        </>
      )}
    </div>
  )
}

/** A departure row with a select box — same guest/room/stay/payment cells as
 *  the in-house board, so checking out many at once feels familiar. */
function DepartureRow({ t, b, i, now, checked, disabled, onToggle, to }: {
  t: WorkspaceTheme
  b: Booking
  i: number
  now: number
  checked: boolean
  disabled: boolean
  onToggle: () => void
  to: string
}) {
  const left = timeLeft(b.end, now)
  const isOverdue = left.tone === 'red'
  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: Math.min(i, 10) * 0.03, duration: 0.25 }}
      className={`border-b transition-colors last:border-b-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] ${t.sidebarDivider} ${checked ? 'bg-sky-500/[0.06] dark:bg-sky-400/[0.06]' : ''}`}
    >
      <td className="px-3 py-3 align-top">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onToggle}
          aria-label={`Select ${b.guest_name} for check out`}
          className="mt-3 size-4 cursor-pointer accent-sky-500 disabled:cursor-not-allowed"
        />
      </td>
      <td className="max-w-0 px-3 py-3 align-top">
        <Link to={to} title={`Open ${b.guest_name}'s portal`} className="group flex min-w-0 gap-3">
          <span className={`grid size-10 shrink-0 place-items-center text-xs font-bold ${t.radius} ${t.iconBox}`}>
            {initials(b.guest_name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold group-hover:underline">{b.guest_name}</p>
            <p className={`truncate text-xs ${t.muted}`}>
              {b.guest_phone && <><Phone className="mr-1 inline size-3" />{b.guest_phone}</>}
              {b.guest_phone && b.guest_id_number ? <span className="mx-1.5">·</span> : ''}
              {b.guest_id_number ? <><IdCard className="mr-1 inline size-3" />{b.guest_id_type_label ?? 'ID'} {b.guest_id_number}</> : ''}
            </p>
            {b.guest_notes && (
              <p className={`truncate text-xs ${t.muted}`} title={b.guest_notes}>
                <MessageSquare className="mr-1 inline size-3" />{b.guest_notes}
              </p>
            )}
          </div>
        </Link>
      </td>
      <td className="px-3 py-3 align-top text-xs">
        <p className="flex items-center gap-1.5 font-medium">
          <BedDouble className="size-3.5 shrink-0" /><span className="truncate">{b.room_name}</span>
        </p>
        <p className={`mt-1 ${t.muted}`}>
          <Users className="mr-1 inline size-3" />{b.guests} {b.guests === 1 ? 'guest' : 'guests'}
        </p>
      </td>
      <td className="px-3 py-3 align-top text-xs">
        <p><CalendarClock className="mr-1 inline size-3" />{fmtD(b.start)} → {fmtD(b.end)}</p>
        <p className={`mt-0.5 ${t.muted}`}>{stayLength(b)}</p>
        <p className={`mt-0.5 font-medium ${isOverdue ? 'text-rose-500' : ''}`}>
          <Clock className="mr-1 inline size-3" />{new Date(b.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </td>
      <td className="px-3 py-3 align-top">
        <PayState t={t} b={b} />
      </td>
      <td className="px-3 py-3 align-top">
        <Pill tone={left.tone}><Clock className="mr-1 inline size-3" />{left.text}</Pill>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex items-center justify-end">
          <LinkButton t={t} to={to} title={`Open ${b.guest_name}'s portal`}>
            <ArrowUpRight className="size-3.5" /> Open portal
          </LinkButton>
        </div>
      </td>
    </motion.tr>
  )
}
