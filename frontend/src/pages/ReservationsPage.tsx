import { AnimatePresence, motion } from 'framer-motion'
import { AlarmClock, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, Ban, BedDouble, Building2, CalendarCheck, CalendarClock, Check, ChevronDown, Clock, CreditCard, Gift, Hourglass, Lock, LogIn, Minus, Package, Phone, Plus, Receipt, RefreshCw, Search, Sparkles, Users, Wallet, X, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState, type FocusEvent, type FormEvent, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Empty, ErrorNote, Flash, Input, LinkButton, Loading, PageHeader, Panel, Pill, Select, Stat, type Tone } from '../components/hr/ui'
import { EmailInput } from '../components/hr/EmailInput'
import { NatIdInput } from '../components/hr/NationalityInput'
import { PhoneInput } from '../components/hr/PhoneInput'
import { PayState } from './GuestsInHousePage'
import { clientPath } from '../lib/roles'
import { parseApiError, type Employee, type FieldErrors } from '../lib/api'
import { bnb, clientKey, dayRestHours, PAYMENT_METHODS, stayLength, type Booking, type BookingStatus, type ExtraPackage, type GuestIdType, type PaymentMethod, type Room } from '../lib/bnb'
import { localDigits, phoneComplete } from '../lib/countries'
import { formatMoney, useApi } from '../lib/hr'
import { useNow } from '../lib/time'
import type { NavItem, WorkspaceTheme } from '../lib/workspaces'

const STATUS_TONE: Record<BookingStatus, Tone> = { reserved: 'amber', occupied: 'blue', completed: 'slate', cancelled: 'red' }

const fmtDT = (iso: string) =>
  new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const fmtD = (iso: string) => new Date(iso).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })

/** `datetime-local` value for a Date, in the browser's timezone. */
const localDT = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

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

/** Countdown to a reservation's scheduled check-in. */
function arriveIn(start: string, now: number): { text: string; tone: Tone } {
  const u = splitLeft(start, now)
  if (!u) return { text: 'Arriving now', tone: 'amber' }
  return { text: `in ${unitText(u)}`, tone: 'slate' }
}

/** Countdown until a live day rest ends and the room frees up. */
function leftIn(end: string, now: number): { text: string; tone: Tone } {
  const u = splitLeft(end, now)
  if (!u) return { text: 'Time up', tone: 'red' }
  return { text: `${unitText(u)} left`, tone: u.unit === 'min' || u.unit === 'hour' ? 'amber' : 'slate' }
}

export default function ReservationsPage({ item, t, me }: { item: NavItem; t: WorkspaceTheme; me: Employee }) {
  // Two small slices instead of the whole bookings table: upcoming arrivals,
  // plus the last few completed/cancelled for the history strip.
  const { data, error, loading, reload, setData } = useApi(async () => {
    const [upcoming, done] = await Promise.all([
      bnb.bookings({ status: 'reserved' }),
      bnb.bookings({ status: 'completed,cancelled', limit: 10 }),
    ])
    return [...upcoming, ...done]
  })
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(0)
  const [flash, setFlash] = useState({ text: '', bad: false })
  const now = useNow(30_000).getTime()

  const upcoming = useMemo(
    () => (data ?? []).filter((b) => b.status === 'reserved').sort((a, b) => a.start.localeCompare(b.start)),
    [data],
  )
  const history = useMemo(
    () => (data ?? []).filter((b) => b.status === 'completed' || b.status === 'cancelled').slice(0, 10),
    [data],
  )
  const arrivingToday = useMemo(
    () => upcoming.filter((b) => sameDay(b.start, now) || new Date(b.start).getTime() < now).length,
    [upcoming, now],
  )
  const arrivingWeek = useMemo(
    () => upcoming.filter((b) => new Date(b.start).getTime() - now < 7 * 86400000).length,
    [upcoming, now],
  )
  const match = (b: Booking) => !q || `${b.guest_name} ${b.room_name} ${b.guest_phone} ${(b.companions ?? []).map((c) => c.name).join(' ')}`.toLowerCase().includes(q.toLowerCase())
  const upcomingList = upcoming.filter(match)
  const th = `px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider ${t.muted}`
  /** A booking's client-portal URL — the guest cell on every row links there. */
  const portal = (b: Booking) => `${clientPath(me.role)}/${encodeURIComponent(clientKey(b))}`

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
      <PageHeader
        t={t}
        icon={item.icon}
        title={item.label}
        text={item.description}
        actions={<LiveBadge t={t} />}
      />

      {!me.branch ? (
        <Panel t={t}>
          <Empty
            t={t}
            icon={Building2}
            title="No branch allocated yet"
            text="Your account isn't assigned to a BnB branch, so there are no bookings to manage. Ask your manager or IT support to allocate you."
          />
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Stat t={t} i={0} icon={CalendarCheck} label="Reservations" value={data ? upcoming.length : '—'} />
            <Stat t={t} i={1} icon={Clock} label="Arriving today" value={data ? arrivingToday : '—'} />
            <Stat t={t} i={2} icon={CalendarClock} label="Arriving this week" value={data ? arrivingWeek : '—'} />
            <Stat t={t} i={3} icon={Users} label="Guests expected" value={data ? upcoming.reduce((n, b) => n + b.guests, 0) : '—'} />
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
            <Panel t={t} title="Upcoming arrivals" actions={<BoardCount t={t} n={upcomingList.length} dot="bg-amber-500" />}>
              {!upcomingList.length ? (
                <Empty
                  t={t}
                  icon={CalendarCheck}
                  title={upcoming.length ? 'No reservations match your search' : 'No upcoming reservations'}
                  text={upcoming.length ? 'Try a different search.' : 'Reserved guests appear here as their move-in time approaches. Checked-in guests live on Guests in house.'}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[60rem] table-fixed border-collapse">
                    <thead>
                      <tr className={`border-b ${t.sidebarDivider}`}>
                        <th className={th}>Guest</th>
                        <th className={`w-44 ${th}`}>Room</th>
                        <th className={`w-56 ${th}`}>Stay</th>
                        <th className={`w-32 ${th}`}>Arrival</th>
                        <th className={`w-52 ${th} text-right`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence initial={false}>
                        {upcomingList.map((b, i) => (
                          <ReserveRow
                            key={b.id} t={t} b={b} i={i} now={now} busy={busy === b.id} to={portal(b)}
                            onCheckin={() => void act(b, bnb.checkinBooking, `${b.guest_name} checked into ${b.room_name}.`)}
                            onCancel={() => void act(b, bnb.cancelBooking, `${b.guest_name}'s reservation was cancelled.`)}
                          />
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}

          {history.length > 0 && (
            <Panel t={t} title="Recent history">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[52rem] table-fixed border-collapse">
                  <thead>
                    <tr className={`border-b ${t.sidebarDivider}`}>
                      <th className={th}>Guest</th>
                      <th className={`w-44 ${th}`}>Room</th>
                      <th className={`w-64 ${th}`}>Stay</th>
                      <th className={`w-28 ${th}`}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {history.filter(match).map((b, i) => (
                        <HistoryRow key={b.id} t={t} b={b} i={i} to={portal(b)} />
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      )}

    </div>
  )
}

/** Sidebar page for registering a client — the form lives in the page, not a dialog. */
export function RegisterClientPage({ item, t, me, back, mode = 'reserve', doneLabel = 'Back to reservations' }: { item: NavItem; t: WorkspaceTheme; me: Employee; back: string; mode?: RegisterMode; doneLabel?: string }) {
  // Newest 500 covers every live booking plus plenty of client-directory history.
  const { data, reload } = useApi(() => bnb.bookings({ limit: 500 }))
  const rooms = useApi(bnb.rooms)
  // The branch's extra packages — only active ones can be sold at registration.
  const pkgs = useApi(bnb.packages)
  /** Check-ins/day rests — and any money collected — need the counter till open.
   *  While another receptionist's session runs, this desk is view-only. */
  const tills = useApi(() => bnb.tills({ open: '1' }))
  const navigate = useNavigate()
  const live = useMemo(() => (data ?? []).filter((b) => b.status === 'reserved' || b.status === 'occupied'), [data])
  const clients = useMemo(() => clientDirectory(data ?? []), [data])
  const open = (tills.data ?? []).find((s) => s.status === 'open')
  const mine = !!open && (me.role !== 'branch_receptionist' || open.opened_by === me.id)

  return (
    <div className="space-y-5">
      <PageHeader t={t} icon={item.icon} title={item.label} text={item.description} />
      {!me.branch ? (
        <Panel t={t}>
          <Empty
            t={t}
            icon={Building2}
            title="No branch allocated yet"
            text="Your account isn't assigned to a BnB branch, so you can't register clients. Ask your manager or IT support to allocate you."
          />
        </Panel>
      ) : mode !== 'reserve' && tills.loading ? (
        <Panel t={t}><Loading t={t} /></Panel>
      ) : mode !== 'reserve' && tills.error ? (
        <Panel t={t}><ErrorNote t={t} message={tills.error} onRetry={tills.reload} /></Panel>
      ) : (
        <RegisterForm t={t} rooms={rooms.data ?? []} bookings={live} clients={clients} packages={(pkgs.data ?? []).filter((x) => x.status === 'active')}
          onDone={() => navigate(back)} initialMode={mode} doneLabel={doneLabel} reloadBookings={reload}
          tillOpen={!!open} tillMine={mine} tillOwner={open?.opened_by_name} />
      )}
    </div>
  )
}

/** Sidebar page listing day-rest clients — live sessions first, then recent ones. */
export function DayRestPage({ item, t, me }: { item: NavItem; t: WorkspaceTheme; me: Employee }) {
  // Live sessions plus the newest few finished ones — not the whole bookings table.
  const { data, error, loading, reload, setData } = useApi(async () => {
    const [live, done] = await Promise.all([
      bnb.bookings({ kind: 'day_rest', status: 'occupied' }),
      bnb.bookings({ kind: 'day_rest', status: 'reserved,completed,cancelled', limit: 10 }),
    ])
    return [...live, ...done]
  })
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(0)
  const [flash, setFlash] = useState({ text: '', bad: false })
  const now = useNow(30_000).getTime()

  const rests = useMemo(() => (data ?? []).filter((b) => b.kind === 'day_rest'), [data])
  const live = useMemo(() => rests.filter((b) => b.status === 'occupied').sort((a, b) => a.end.localeCompare(b.end)), [rests])
  const history = useMemo(() => rests.filter((b) => b.status !== 'occupied').slice(0, 10), [rests])
  const today = useMemo(() => rests.filter((b) => sameDay(b.start, now)).length, [rests, now])
  const overdue = useMemo(() => live.filter((b) => new Date(b.end).getTime() < now).length, [live, now])
  const match = (b: Booking) => !q || `${b.guest_name} ${b.room_name} ${b.guest_phone} ${(b.companions ?? []).map((c) => c.name).join(' ')}`.toLowerCase().includes(q.toLowerCase())
  const list = live.filter(match)
  const th = `px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider ${t.muted}`
  /** A booking's client-portal URL — the guest cell on every row links there. */
  const portal = (b: Booking) => `${clientPath(me.role)}/${encodeURIComponent(clientKey(b))}`

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

      {!me.branch ? (
        <Panel t={t}>
          <Empty
            t={t}
            icon={Building2}
            title="No branch allocated yet"
            text="Your account isn't assigned to a BnB branch, so there are no day rests to show. Ask your manager or IT support to allocate you."
          />
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Stat t={t} i={0} icon={Hourglass} label="Resting now" value={data ? live.length : '—'} />
            <Stat t={t} i={1} icon={Users} label="Guests resting" value={data ? live.reduce((n, b) => n + b.guests, 0) : '—'} />
            <Stat t={t} i={2} icon={CalendarCheck} label="Day rests today" value={data ? today : '—'} />
            <Stat t={t} i={3} icon={AlarmClock} label="Overdue" value={data ? overdue : '—'} />
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
            <Panel t={t} title="Resting now" actions={<BoardCount t={t} n={list.length} dot="bg-emerald-500" />}>
              {!list.length ? (
                <Empty
                  t={t}
                  icon={Hourglass}
                  title={live.length ? 'No day rests match your search' : 'No day rests in session'}
                  text={live.length ? 'Try a different search.' : 'Clients booked in for a few hours from Register client → Day rest appear here with a live countdown.'}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[68rem] table-fixed border-collapse">
                    <thead>
                      <tr className={`border-b ${t.sidebarDivider}`}>
                        <th className={th}>Guest</th>
                        <th className={`w-44 ${th}`}>Room</th>
                        <th className={`w-56 ${th}`}>Session</th>
                        <th className={`w-40 ${th}`}>Payment</th>
                        <th className={`w-32 ${th}`}>Time left</th>
                        <th className={`w-52 ${th} text-right`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence initial={false}>
                        {list.map((b, i) => (
                          <DayRestRow
                            key={b.id} t={t} b={b} i={i} now={now} busy={busy === b.id} to={portal(b)}
                            onCancel={() => void act(b, bnb.cancelBooking, `${b.guest_name}'s day rest was cancelled.`)}
                          />
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}

          {history.length > 0 && (
            <Panel t={t} title="Recent day rests">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[60rem] table-fixed border-collapse">
                  <thead>
                    <tr className={`border-b ${t.sidebarDivider}`}>
                      <th className={th}>Guest</th>
                      <th className={`w-44 ${th}`}>Room</th>
                      <th className={`w-64 ${th}`}>Session</th>
                      <th className={`w-36 ${th}`}>Payment</th>
                      <th className={`w-28 ${th}`}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {history.filter(match).map((b, i) => (
                        <HistoryRow key={b.id} t={t} b={b} i={i} to={portal(b)} />
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
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

/** Initials avatar for a guest. */
function Avatar({ t, name }: { t: WorkspaceTheme; name: string }) {
  return (
    <span className={`grid size-11 shrink-0 place-items-center text-sm font-bold ${t.radius} ${t.iconBox}`}>
      {initials(name)}
    </span>
  )
}

/** Recent-history list row: guest, room, stay dates and final status. */
function HistoryRow({ t, b, i, to }: { t: WorkspaceTheme; b: Booking; i: number; to: string }) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: Math.min(i, 10) * 0.03, duration: 0.25 }}
      className={`border-b transition-colors last:border-b-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] ${t.sidebarDivider}`}
    >
      <td className="max-w-0 px-3 py-3 align-top">
        <Link to={to} title={`Open ${b.guest_name}'s portal`} className="group flex min-w-0 items-center gap-3">
          <Avatar t={t} name={b.guest_name} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold group-hover:underline">{b.guest_name}</p>
            {b.guest_phone && <p className={`truncate text-xs ${t.muted}`}><Phone className="mr-1 inline size-3" />{b.guest_phone}</p>}
          </div>
        </Link>
      </td>
      <td className="px-3 py-3 align-top text-xs">
        <p className="flex items-center gap-1.5 font-medium">
          <BedDouble className="size-3.5 shrink-0" /><span className="truncate">{b.room_name}</span>
        </p>
        <p className={`mt-1 ${t.muted}`}>
          <Users className="mr-1 inline size-3" />{b.guests} {b.guests === 1 ? 'guest' : 'guests'}
          {b.deposit ? ` · deposit ${formatMoney(b.deposit)}` : ''}
        </p>
      </td>
      <td className={`px-3 py-3 align-top text-xs ${t.muted}`}>
        {fmtDT(b.start)} → {fmtDT(b.end)} · {stayLength(b)}
      </td>
      <td className="px-3 py-3 align-top"><PayState t={t} b={b} /></td>
      <td className="px-3 py-3 align-top"><Pill tone={STATUS_TONE[b.status]}>{b.status_label}</Pill></td>
    </motion.tr>
  )
}

/** Upcoming reservation list row: initials, meta and a countdown to check-in. */
function ReserveRow({ t, b, i, busy, now, to, onCheckin, onCancel }: { t: WorkspaceTheme; b: Booking; i: number; busy: boolean; now: number; to: string; onCheckin: () => void; onCancel: () => void }) {
  const due = arriveIn(b.start, now)
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
          <Avatar t={t} name={b.guest_name} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold group-hover:underline">{b.guest_name}</p>
            <p className={`truncate text-xs ${t.muted}`}>
              {b.guest_phone && <><Phone className="mr-1 inline size-3" />{b.guest_phone}</>}
              {b.guest_phone && b.deposit ? <span className="mx-1.5">·</span> : ''}
              {b.deposit ? <><Wallet className="mr-1 inline size-3" />deposit {formatMoney(b.deposit)}</> : ''}
            </p>
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
      <td className={`px-3 py-3 align-top text-xs ${t.muted}`}>
        <CalendarClock className="mr-1 inline size-3" />{fmtD(b.start)} → {fmtD(b.end)} · {stayLength(b)}
      </td>
      <td className="px-3 py-3 align-top">
        <Pill tone={due.tone}><CalendarCheck className="mr-1 inline size-3" />{due.text}</Pill>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex items-center justify-end gap-2">
          <Button t={t} busy={busy} onClick={onCheckin}>
            <LogIn className="size-3.5" /> Check in
          </Button>
          <Button t={t} variant="danger" disabled={busy} onClick={onCancel}>
            <Ban className="size-3.5" /> Cancel
          </Button>
        </div>
      </td>
    </motion.tr>
  )
}

/** Live day-rest list row: guest, room, the session window and a countdown to when the room frees. */
function DayRestRow({ t, b, i, busy, now, to, onCancel }: { t: WorkspaceTheme; b: Booking; i: number; busy: boolean; now: number; to: string; onCancel: () => void }) {
  const left = leftIn(b.end, now)
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
          <Avatar t={t} name={b.guest_name} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold group-hover:underline">{b.guest_name}</p>
            <p className={`truncate text-xs ${t.muted}`}>
              {b.guest_phone && <><Phone className="mr-1 inline size-3" />{b.guest_phone}</>}
              {b.guest_phone && b.deposit ? <span className="mx-1.5">·</span> : ''}
              {b.deposit ? <><Wallet className="mr-1 inline size-3" />deposit {formatMoney(b.deposit)}</> : ''}
            </p>
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
      <td className={`px-3 py-3 align-top text-xs ${t.muted}`}>
        <Hourglass className="mr-1 inline size-3" />{fmtDT(b.start)} → {fmtDT(b.end)} · {dayRestHours(b)} {dayRestHours(b) === 1 ? 'hour' : 'hours'}
      </td>
      <td className="px-3 py-3 align-top"><PayState t={t} b={b} /></td>
      <td className="px-3 py-3 align-top">
        <Pill tone={left.tone}><Clock className="mr-1 inline size-3" />{left.text}</Pill>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex items-center justify-end gap-2">
          <LinkButton t={t} to={to} title={`Open ${b.guest_name}'s portal — check out happens there`}>
            <ArrowUpRight className="size-3.5" /> Open portal
          </LinkButton>
          <Button t={t} variant="danger" disabled={busy} onClick={onCancel}>
            <Ban className="size-3.5" /> Cancel
          </Button>
        </div>
      </td>
    </motion.tr>
  )
}

const blank = {
  guest_name: '', guest_phone: '', guest_email: '',
  guest_id_type: 'national_id' as GuestIdType, guest_id_number: '',
  guest_nationality: 'Kenya', guest_notes: '',
  ref_name: '', ref_phone: '',
  guests: '1', room: '',
  start: localDT(new Date()), days: '2', hours: '3',
}

/** A known client distilled from past bookings — powers the live phone/name suggestions. */
interface GuestRef {
  name: string; phone: string; email: string
  id_type: GuestIdType | ''; id_number: string; nationality: string; notes: string
}

const digits = (v: string) => v.replace(/\D/g, '')
/** The last 9 digits — identifies a local number across +254 and 07 formats alike. */
const tail9 = (v: string) => digits(v).slice(-9)

/** Known clients keyed by phone. Bookings arrive newest-first, so the freshest
 *  details win while older stays fill any gaps (email, ID, nationality…). */
function clientDirectory(bookings: Booking[]): GuestRef[] {
  const map = new Map<string, GuestRef>()
  const add = (g: GuestRef) => {
    const key = tail9(g.phone)
    if (key.length < 9 || !g.name.trim()) return
    const prev = map.get(key)
    map.set(key, prev ? {
      name: prev.name || g.name, phone: prev.phone || g.phone, email: prev.email || g.email,
      id_type: prev.id_type || g.id_type, id_number: prev.id_number || g.id_number,
      nationality: prev.nationality || g.nationality, notes: prev.notes || g.notes,
    } : g)
  }
  for (const b of bookings) {
    add({
      name: b.guest_name, phone: b.guest_phone, email: b.guest_email,
      id_type: b.guest_id_type, id_number: b.guest_id_number,
      nationality: b.guest_nationality, notes: b.guest_notes,
    })
    for (const c of b.companions ?? []) {
      add({
        name: c.name, phone: c.phone, email: c.email,
        id_type: c.id_type, id_number: c.id_number, nationality: c.nationality, notes: c.notes,
      })
    }
  }
  return [...map.values()]
}

/** Dropdown of matching registered clients under a phone or name field — pick one to autofill. */
function SuggestList({ t, items, onPick }: { t: WorkspaceTheme; items: GuestRef[]; onPick: (g: GuestRef) => void }) {
  if (!items.length) return null
  return (
    <div className={`absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden shadow-xl ${t.radius} ${t.card}`}>
      <p className={`border-b px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${t.muted} ${t.sidebarDivider}`}>Registered clients</p>
      <ul className="max-h-56 overflow-y-auto py-1">
        {items.map((g, i) => (
          <li key={`${g.phone}-${i}`}>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(g)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-slate-900/5 dark:hover:bg-white/5"
            >
              <span className={`grid size-7 shrink-0 place-items-center text-[10px] font-bold ${t.radius} ${t.iconBox}`}>{initials(g.name)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{g.name}</span>
                <span className={`block truncate text-xs ${t.muted}`}>{g.phone}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Extra people on the booking — one of these per guest past the first. `type` is only a
 *  filter for the room dropdown; every guest needs their own room, so `room` must be
 *  picked; `ownDates` off means they keep the booking's check-in and length of stay. */
type Companion = {
  name: string; phone: string; email: string
  id_type: GuestIdType; id_number: string; nationality: string; notes: string
  type: string; room: string
  ownDates: boolean; start: string; days: string
  more: boolean
}
const emptyCompanion = (): Companion => ({
  name: '', phone: '', email: '', id_type: 'national_id', id_number: '', nationality: 'Kenya',
  notes: '', type: '', room: '', ownDates: false, start: localDT(new Date()), days: '',
  more: false,
})

/** One payment row's editable fields on the payment card — an untouched field
 *  falls back to the room-holder's full charge paid in cash. */
type PayEdit = { amount?: string; method?: PaymentMethod | ''; reference?: string; paid_at?: string }

/** Wizard card transition — the card flips around its vertical axis, the direction
 *  following the navigation (next tips it left, back tips it right). */
const cardVars = {
  enter: (d: number) => ({ opacity: 0, rotateY: 70 * d, scale: 0.95, transformPerspective: 1200 }),
  center: { opacity: 1, rotateY: 0, scale: 1, transformPerspective: 1200 },
  exit: (d: number) => ({ opacity: 0, rotateY: -70 * d, scale: 0.95, transformPerspective: 1200 }),
}

/** −/+ counter for numeric fields like guests and nights. */
function Stepper({ t, label, value, min = 1, max, onChange, error, suffix }: {
  t: WorkspaceTheme; label: string; value: number; min?: number; max?: number
  onChange: (v: number) => void; error?: string; suffix?: string
}) {
  const btn = 'grid w-10 shrink-0 place-items-center transition hover:bg-black/5 disabled:opacity-35 dark:hover:bg-white/10'
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className={`text-[11px] font-medium ${t.muted}`}>{label}</span>
      <div className={`flex h-10 items-stretch ${t.radius} ${t.chip} ${error ? 'ring-1 ring-rose-500/60' : ''}`}>
        <button type="button" aria-label="Decrease" className={btn} disabled={value <= min} onClick={() => onChange(value - 1)}>
          <Minus className="size-3.5" />
        </button>
        <span className="grid min-w-0 flex-1 place-items-center text-sm font-semibold tabular-nums">
          {value}{suffix ? ` ${suffix}` : ''}
        </span>
        <button type="button" aria-label="Increase" className={btn} disabled={max != null && value >= max} onClick={() => onChange(value + 1)}>
          <Plus className="size-3.5" />
        </button>
      </div>
      {error && <span className="text-[11px] text-rose-500">{error}</span>}
    </div>
  )
}

/** Multi-line field matching the shared `Input` styling, for notes and requests. */
function Area({ t, label, error, ...props }: { t: WorkspaceTheme; label?: string; error?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      {label && <span className={`text-[11px] font-medium ${t.muted}`}>{label}</span>}
      <textarea className={`min-h-20 w-full min-w-0 bg-transparent px-3 py-2 text-sm outline-none transition focus:ring-2 ${t.radius} ${t.chip} ${t.ring} ${error ? 'ring-1 ring-rose-500/60' : ''}`} {...props} />
      {error && <span className="text-[11px] text-rose-500">{error}</span>}
    </label>
  )
}

export type RegisterMode = 'reserve' | 'stay' | 'dayrest'

function RegisterForm({ t, rooms, bookings, clients, packages, onDone, initialMode = 'reserve', doneLabel = 'Back to reservations', reloadBookings, tillOpen = true, tillMine = true, tillOwner }: { t: WorkspaceTheme; rooms: Room[]; bookings: Booking[]; clients: GuestRef[]; packages: ExtraPackage[]; onDone: () => void; initialMode?: RegisterMode; doneLabel?: string; reloadBookings?: () => void; tillOpen?: boolean; tillMine?: boolean; tillOwner?: string | null }) {
  const [mode, setMode] = useState<RegisterMode>(initialMode)
  const [form, setForm] = useState(() => ({ ...blank, start: localDT(new Date()) }))
  const [more, setMore] = useState(false)
  const [roomType, setRoomType] = useState('')
  // Live search inside the room picker — reset whenever the popup changes guest.
  const [roomQ, setRoomQ] = useState('')
  const [companions, setCompanions] = useState<Companion[]>([])
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  // Which guest's room/dates popup is open — -1 = the main guest, n = companion n.
  const [editing, setEditing] = useState<number | null>(null)
  // Which suggestion list is open: 'p'/'n' main guest, 'rp'/'rn' referrer, 'cp<i>'/'cn<i>' companions.
  const [suggest, setSuggest] = useState<string | null>(null)
  // The referral panel auto-opens once the phone shows a brand-new client.
  const [refOpen, setRefOpen] = useState(false)
  // The wizard's current card and the direction it's travelling for the flip.
  const [card, setCard] = useState(0)
  const [dir, setDir] = useState(1)
  // Card 3 — the money. A reservation records an optional deposit; check-ins and
  // day rests collect the full bill, one payment row per room-holder. `payEdits`
  // holds only what the receptionist touched — the rest default to the charge.
  const [depositAmt, setDepositAmt] = useState('')
  // The tax invoice / eTIMS code the bill was rung up under — optional record.
  const [taxRef, setTaxRef] = useState('')
  const [taxOpen, setTaxOpen] = useState(false)
  const [payEdits, setPayEdits] = useState<Partial<Record<number, PayEdit>>>({})
  // Extra packages picked per room-holder — `picked[gi]` lists catalogue ids;
  // the same party-position key payments use (0 = main guest). `pkgOpen` holds
  // which guest's package picker is unfolded on the bill.
  const [picked, setPicked] = useState<Record<number, number[]>>({})
  const [pkgOpen, setPkgOpen] = useState<Record<number, boolean>>({})

  useEffect(() => {
    setRoomQ('')
    if (editing === null) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setEditing(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing])

  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setUpper = (k: keyof typeof blank) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value.toUpperCase() }))
  const put = (k: keyof typeof blank, v: string) => setForm((f) => ({ ...f, [k]: v }))
  /** Drop one field's error — used the moment the user fixes the field (e.g. picks a room). */
  const clearErr = (k: string) =>
    setErrors((prev) => {
      if (!(k in prev)) return prev
      const { [k]: _drop, ...rest } = prev
      return rest
    })

  // The party size drives how many extra-guest cards exist — guests-1 companions.
  const setGuests = (v: number) => {
    put('guests', String(v))
    setCompanions((cs) => {
      const need = Math.max(0, Math.min(30, v) - 1)
      return cs.length >= need ? cs.slice(0, need) : [...cs, ...Array.from({ length: need - cs.length }, emptyCompanion)]
    })
  }
  const setC = <K extends keyof Companion>(i: number, k: K, v: Companion[K]) =>
    setCompanions((cs) => cs.map((c, j) => (j === i ? { ...c, [k]: v } : c)))

  // Live client matching — as they type, matching registered clients show under the field.
  const phoneSug = (v: string) => {
    const q = localDigits(v)
    return q.length >= 4 ? clients.filter((c) => localDigits(c.phone).startsWith(q)).slice(0, 6) : []
  }
  const nameSug = (v: string) => {
    const q = v.trim().toLowerCase()
    return q.length >= 2 ? clients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6) : []
  }
  const blurSuggest = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setSuggest(null)
  }

  const phoneDone = phoneComplete(form.guest_phone)
  const known = phoneDone && clients.some((c) => tail9(c.phone) === tail9(form.guest_phone))
  const refMatch = phoneComplete(form.ref_phone) ? clients.find((c) => tail9(c.phone) === tail9(form.ref_phone)) : undefined
  // One referral per booking — offered when any member of the party is a new client.
  const partyNew = companions.some((c) => phoneComplete(c.phone) && !clients.some((x) => tail9(x.phone) === tail9(c.phone)))
  const offerRef = !known || partyNew
  // The referral panel stays hidden — it only opens when the receptionist asks for it.
  const showRef = refOpen || !!(form.ref_name.trim() || digits(form.ref_phone))

  const pickGuest = (g: GuestRef) => {
    setForm((f) => ({
      ...f, guest_name: g.name.toUpperCase(), guest_phone: g.phone,
      guest_email: g.email || f.guest_email,
      guest_id_type: (g.id_type || f.guest_id_type) as GuestIdType,
      guest_id_number: g.id_number || f.guest_id_number,
      guest_nationality: g.nationality || f.guest_nationality,
      guest_notes: g.notes || f.guest_notes,
    }))
    setSuggest(null)
  }
  const pickCompanion = (i: number, g: GuestRef) => {
    setCompanions((cs) => cs.map((c, j) => j === i ? {
      ...c, name: g.name.toUpperCase(), phone: g.phone,
      email: g.email || c.email,
      id_type: (g.id_type || c.id_type) as GuestIdType,
      id_number: g.id_number || c.id_number,
      nationality: g.nationality || c.nationality,
      notes: g.notes || c.notes,
    } : c))
    setSuggest(null)
  }
  const pickReferrer = (g: GuestRef) => {
    setForm((f) => ({ ...f, ref_name: g.name.toUpperCase(), ref_phone: g.phone }))
    setSuggest(null)
  }

  // A complete phone number that names exactly one registered client fills the
  // rest of their details itself — several matches stay in the suggestion list
  // for the receptionist to pick. The guard stops a re-fill loop and lets the
  // receptionist edit the name afterwards.
  useEffect(() => {
    if (!phoneDone) return
    const m = clients.filter((c) => tail9(c.phone) === tail9(form.guest_phone))
    if (m.length === 1 && form.guest_name !== m[0].name.toUpperCase()) pickGuest(m[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the phone value; pickGuest is stable
  }, [form.guest_phone, clients])

  useEffect(() => {
    companions.forEach((c, i) => {
      if (!phoneComplete(c.phone)) return
      const m = clients.filter((x) => tail9(x.phone) === tail9(c.phone))
      if (m.length === 1 && c.name !== m[0].name.toUpperCase()) pickCompanion(i, m[0])
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settles after one pass thanks to the guard
  }, [companions, clients])

  const guests = Math.min(30, Math.max(1, parseInt(form.guests, 10) || 1))
  const dayRest = mode === 'dayrest'
  // Day rests run on the clock — hours, not nights — so the duration unit follows the mode.
  const unitMs = dayRest ? 3_600_000 : 86_400_000
  const days = Math.max(1, parseInt(form.days, 10) || 1)
  const hours = Math.min(12, Math.max(1, parseInt(form.hours, 10) || 1))
  const span = dayRest ? hours : days
  const start = form.start ? new Date(form.start) : null
  const end = start ? new Date(start.getTime() + span * unitMs) : null
  const chosen = rooms.find((r) => r.id === Number(form.room))

  // A companion's effective stay — their own dates when set, else the booking's.
  // In a day rest, `c.days` holds hours — the same unit the booking runs on.
  const cDates = (c: Companion) => {
    const s = c.ownDates && c.start ? new Date(c.start) : start
    const d = c.ownDates ? Math.max(1, parseInt(c.days, 10) || span) : span
    return { s, e: s ? new Date(s.getTime() + d * unitMs) : null, d }
  }

  // Room ids blocked by live bookings over a period — a room can't be booked
  // over a live booking. The map keeps the strongest blocker per room
  // ('occupied' beats 'reserved') so the picker can order and label them.
  const blockersFor = (s: Date | null, e: Date | null) => {
    const taken = new Map<number, BookingStatus>()
    if (s && e) {
      for (const b of bookings) {
        if (new Date(b.start) < e && new Date(b.end) > s) {
          if (b.status === 'occupied' || taken.get(b.room) !== 'occupied') taken.set(b.room, b.status)
        }
      }
    }
    return taken
  }
  const busyFor = (s: Date | null, e: Date | null) => new Set(blockersFor(s, e).keys())
  const busyRooms = useMemo(
    () => busyFor(start, end),
    [bookings, form.start, days, hours], // eslint-disable-line react-hooks/exhaustive-deps -- start/end derive from form.start+span
  )

  const usable = (r: Room) => r.status === 'active' && !busyRooms.has(r.id)
  // The main room also can't be a room a companion already holds.
  const usableMain = (r: Room) => usable(r) && !companions.some((c) => Number(c.room) === r.id)

  // Room categories present at this branch — the picker filters by these.
  const roomTypes = useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of rooms) if (!seen.has(r.room_type)) seen.set(r.room_type, r.type_label)
    return [...seen.entries()].map(([value, label]) => ({ value, label }))
  }, [rooms])

  /** A room's charge for `d` nights — a day rest bills its flat rate whatever
   *  the hours (the room's day-rest rate when set, the nightly rate otherwise). */
  const charge = (r: Room, d: number) => (dayRest ? Number(r.day_rest_price ?? r.price) : Number(r.price) * d)

  // Every room-holder is their own client with their own bill — the payment card
  // collects one row per held room. Party position: 0 = main guest, n = companion n-1.
  const payers = [
    ...(chosen ? [{ gi: 0, name: form.guest_name.trim(), room: chosen, s: start, e: end, d: span }] : []),
    ...companions.flatMap((c, i) => {
      const room = rooms.find((r) => r.id === Number(c.room))
      if (!room) return []
      const { s, e, d } = cDates(c)
      return [{ gi: i + 1, name: c.name.trim(), room, s, e, d }]
    }),
  ]
  // Packages bill on top of the room — each picker toggles a catalogue package
  // for that room-holder and the selection lands in their own charge.
  const pkgById = useMemo(() => new Map(packages.map((x) => [x.id, x])), [packages])
  const pkgPicks = (gi: number) =>
    (picked[gi] ?? []).map((id) => pkgById.get(id)).filter((x): x is ExtraPackage => !!x)
  const pkgTotal = (gi: number) => pkgPicks(gi).reduce((n, x) => n + Number(x.amount), 0)
  const togglePkg = (gi: number, id: number) =>
    setPicked((m) => {
      const cur = m[gi] ?? []
      return { ...m, [gi]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] }
    })
  /** A room-holder's full charge — their room plus their picked packages. */
  const dueFor = (p: { gi: number; room: Room; d: number }) => charge(p.room, p.d) + pkgTotal(p.gi)
  const billTotal = payers.reduce((n, p) => n + dueFor(p), 0)

  // The payment clock — 'now' refreshed once a minute for untouched time-paid fields.
  const payNow = useNow(60_000)
  /** A payment row's live value — untouched fields default to the full charge,
   *  but the method stays unset until the receptionist picks one. */
  const payRow = (gi: number, due: number) => {
    const e = payEdits[gi] ?? {}
    return {
      amount: e.amount ?? (due > 0 ? String(due) : ''), method: e.method ?? '', reference: e.reference ?? '',
      // Time paid defaults to now (ticking until the receptionist overrides it).
      paid_at: e.paid_at ?? localDT(new Date(payNow.getTime())),
    }
  }
  /** Cash moves no paper trail; card/mobile/bank payments do — their transaction
   *  code is compulsory. 'other' keeps it optional. */
  const needsRef = (m: PaymentMethod | '') => m === 'mpesa' || m === 'visa' || m === 'bank'
  const setPay = <K extends keyof PayEdit>(gi: number, k: K, v: PayEdit[K]) =>
    setPayEdits((m) => ({ ...m, [gi]: { ...(m[gi] ?? {}), [k]: v } }))

  // Check-ins and day rests can take any amount — a part-payment leaves the rest
  // as a balance, an overpayment stays as credit. A row is only wrong when money
  // is named without a usable method (or code), or the amount isn't a number.
  const payRowOk = (gi: number, due: number) => {
    const r = payRow(gi, due)
    const amt = r.amount.trim()
    if (!amt) return true
    if (!(Number(amt) > 0)) return false
    if (!r.method) return false
    if (needsRef(r.method) && !r.reference.trim()) return false
    return true
  }
  const payOk = payers.every((p) => payRowOk(p.gi, dueFor(p)))

  // Extra guest details stay open once anything is filled or rejected — the
  // Kenya default alone doesn't count as filled.
  const extras = !!(form.guest_email || form.guest_id_number || form.guest_notes || (form.guest_nationality && form.guest_nationality !== 'Kenya'))
  const extraErrors = !!(errors.guest_email || errors.guest_id_number || errors.guest_nationality || errors.guest_notes)
  const showMore = more || extras || extraErrors

  // The tax panel unfolds on demand — or springs open on its own once it
  // holds a code or carries an error, like the guest-extras section.
  const showTax = taxOpen || !!taxRef.trim() || !!errors.tax_reference

  const missing = [
    !form.guest_name.trim() && 'name',
    !chosen && 'room',
    companions.some((c) => !c.name.trim()) && 'each guest\'s name',
    companions.some((c) => !c.room) && 'each guest\'s room',
    mode !== 'reserve' && !payOk && 'the payment details',
  ].filter(Boolean)

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!start || !end) { go(2); return setErrors({ start: 'Pick the move-in date and time.' }) }
    if (!chosen) { go(2); return setErrors({ room: 'Choose a room to continue.' }) }
    if (!usable(chosen)) { go(2); return setErrors({ room: `${chosen.name} isn't free for that period — pick another.` }) }
    const roomless = companions.findIndex((c) => !c.room)
    if (roomless >= 0) { go(2); return setErrors({ [`c${roomless}room`]: 'Allocate them a room — each guest needs a different room.' }) }
    if (modeLocked) {
      return setMessage(foreign
        ? `${tillOwner ?? 'Another receptionist'} has the till open — you're in view-only mode until they close it.`
        : 'The till is closed — open it on the Counter page before registering a client or collecting money.')
    }
    const unnamed = companions.findIndex((c) => !c.name.trim())
    if (unnamed >= 0) { go(1); return setErrors({ [`c${unnamed}name`]: 'Their name is required.' }) }
    if (!cardOk(3)) { go(3); return }
    setSaving(true)
    setErrors({})
    setMessage('')
    try {
      await bnb.registerBooking({
        room: Number(form.room),
        guest_name: form.guest_name,
        guest_phone: form.guest_phone.trim(),
        guest_email: form.guest_email.trim(),
        guest_id_type: form.guest_id_number.trim() ? form.guest_id_type : '',
        guest_id_number: form.guest_id_number.trim(),
        guest_nationality: form.guest_nationality.trim(),
        guest_notes: form.guest_notes.trim(),
        companions: companions.map((c) => {
          const own = c.room && c.ownDates && c.start ? cDates(c) : null
          return {
            name: c.name.trim(),
            phone: c.phone.trim(),
            email: c.email.trim(),
            id_type: (c.id_number.trim() ? c.id_type : '') as GuestIdType | '',
            id_number: c.id_number.trim(),
            nationality: c.nationality.trim(),
            notes: c.notes.trim(),
            room: c.room ? Number(c.room) : null,
            start: own?.s ? own.s.toISOString() : null,
            end: own?.e ? own.e.toISOString() : null,
          }
        }),
        referrer_name: form.ref_name.trim(),
        referrer_phone: form.ref_phone.trim(),
        // Package picks travel with the booking — the same party-position key
        // payments use, so each package lands on the right guest's bill.
        packages: Object.entries(picked).flatMap(([gi, ids]) =>
          ids.map((id) => ({ guest: Number(gi), package: id }))),
        guests,
        kind: mode === 'reserve' ? 'reservation' : dayRest ? 'day_rest' : 'stay',
        start: start.toISOString(),
        end: end.toISOString(),
        tax_reference: taxRef.trim(),
        // Reservations hold a deposit; check-ins and day rests send the collected
        // payments — one per room-holder so each guest's own bill is settled.
        ...(mode === 'reserve'
          ? { deposit: tillOpen && depositAmt.trim() ? Number(depositAmt) : null }
          : {
              payments: payers
                .map((p) => {
                  const r = payRow(p.gi, dueFor(p))
                  return {
                    guest: p.gi, amount: Number(r.amount), method: r.method as PaymentMethod, reference: r.reference.trim(),
                    paid_at: r.paid_at ? new Date(r.paid_at).toISOString() : null,
                  }
                })
                .filter((p) => p.amount > 0),
            }),
      })
      onDone()
    } catch (err) {
      const { message, fields } = parseApiError(err)
      setErrors(fields)
      setMessage(message)
      // Field errors can land on an earlier card — jump to it so they're visible.
      if (Object.keys(fields).length) go(errorCard(fields))
      // A room-clash error means the availability list was stale — refetch it.
      reloadBookings?.()
    } finally {
      setSaving(false)
    }
  }

  /** Another receptionist's till means view-only — no registrations at all.
   *  Check-ins and day rests additionally need this user's own open till. */
  const foreign = tillOpen && !tillMine
  const modeLocked = foreign || (mode !== 'reserve' && !tillOpen)

  const modeCard = (m: 'reserve' | 'stay' | 'dayrest', icon: LucideIcon, title: string, text: string) => {
    const Icon = icon
    const sel = mode === m
    const locked = foreign || (m !== 'reserve' && !tillOpen)
    return (
      <button
        type="button" role="radio" aria-checked={sel} onClick={() => { setMode(m); go(1) }} disabled={locked}
        className={`flex items-center gap-3 p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-55 ${t.radius} ${sel ? t.navActive : `${t.chip} ${t.cardHover}`}`}
      >
        <span className={`grid size-10 shrink-0 place-items-center ${t.radius} ${sel ? 'bg-white/15' : t.iconBox}`}>
          {locked ? <Lock className="size-5" /> : <Icon className="size-5" />}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{title}</span>
          <span className={`block truncate text-[11px] ${sel ? 'opacity-75' : t.muted}`}>{locked ? (foreign ? 'View only' : 'Till closed') : text}</span>
        </span>
        {sel && (
          <motion.span initial={{ scale: 0.4, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }} className="ml-auto shrink-0">
            <Check className="size-4" />
          </motion.span>
        )}
      </button>
    )
  }

  /** The collapsed face of an optional section — a dashed 'add' tile so it reads
   *  as a tappable row rather than static text. `amber` matches the referral
   *  panel it opens; `open` (extras only) swaps the plus for a rotating chevron. */
  const addTile = (label: string, hint: string, Icon: LucideIcon, onClick: () => void, opts: { open?: boolean; amber?: boolean } = {}) => {
    const { open = false, amber = false } = opts
    const tone = amber
      ? 'border-amber-500/40 bg-amber-500/[0.05] hover:border-amber-500/70 hover:bg-amber-500/10 dark:border-amber-400/30 dark:bg-amber-400/[0.05] dark:hover:border-amber-400/60'
      : `${t.chip} ${t.cardHover}`
    const iconBox = amber ? 'bg-amber-500/15 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300' : t.iconBox
    const pill = amber ? 'bg-amber-500/15 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300' : `${t.chip} ${t.muted}`
    return (
      <button
        type="button" onClick={onClick} aria-expanded={open}
        className={`flex w-full items-center gap-2.5 border border-dashed px-3 py-2.5 text-left transition ${t.radius} ${tone}`}
      >
        <span className={`grid size-7 shrink-0 place-items-center rounded-md ${iconBox}`}><Icon className="size-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold">{label}</span>
          <span className={`block text-[10px] font-medium leading-snug ${amber ? 'text-amber-600/70 dark:text-amber-300/60' : t.muted}`}>{hint}</span>
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${pill}`}>Optional</span>
        {open
          ? <ChevronDown className={`size-4 shrink-0 rotate-180 transition ${amber ? 'text-amber-500 dark:text-amber-300' : t.muted}`} />
          : <Plus className={`size-4 shrink-0 ${amber ? 'text-amber-500 dark:text-amber-300' : t.muted}`} />}
      </button>
    )
  }

  const dFmt = (d: Date) => d.toLocaleDateString([], { day: 'numeric', month: 'short' })
  const tFmt = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  /** The stay-strip's "dates → dates · length" line — times and hours for a day rest. */
  const spanText = (s: Date | null, e: Date | null, d: number) =>
    !s || !e ? 'Dates not set yet'
    : dayRest ? `${tFmt(s)} → ${tFmt(e)} · ${d} ${d === 1 ? 'hour' : 'hours'}`
    : `${dFmt(s)} → ${dFmt(e)} · ${d} ${d === 1 ? 'night' : 'nights'}`

  /** Photo-card room grid shared by the main guest's popup and each extra guest's.
   *  `note` adds a tail to the status line ("main room", "shared with guest 3").
   *  `blockers` maps room id → the live booking holding it over the picked window,
   *  so the grid can sort free → reserved → occupied → out of service. */
  const roomGrid = (type: string, setType: (v: string) => void, sel: string, ok: (r: Room) => boolean, pick: (id: string) => void, blockers: Map<number, BookingStatus>, note?: (r: Room) => string) => {
    const q = roomQ.trim().toLowerCase()
    const rank = (r: Room) => {
      if (ok(r)) return 0
      if (r.status !== 'active') return 3
      return blockers.get(r.id) === 'reserved' ? 1 : 2
    }
    const list = (type ? rooms.filter((r) => r.room_type === type) : [...rooms])
      .filter((r) => !q || `${r.name} ${r.type_label}`.toLowerCase().includes(q))
      .sort((a, b) => rank(a) - rank(b))
    const blockedLabel = (r: Room) => {
      if (r.status !== 'active') return r.status_label
      const st = blockers.get(r.id)
      return st === 'reserved' ? 'Reserved for that period' : st === 'occupied' ? 'Occupied for that period' : 'Booked for that period'
    }
    return (
      <div className="flex min-w-0 flex-col gap-2">
        <div className="relative">
          <Search className={`pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 ${t.muted}`} />
          <input
            value={roomQ}
            onChange={(e) => setRoomQ(e.target.value)}
            placeholder="Search rooms…"
            className={`h-9 w-full bg-transparent pl-9 pr-3 text-sm outline-none focus:ring-2 ${t.radius} ${t.chip} ${t.ring}`}
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Room type">
          {[{ value: '', label: 'All types' }, ...roomTypes].map((o) => (
            <button
              key={o.value} type="button" role="radio" aria-checked={type === o.value}
              onClick={() => setType(o.value)}
              className={`h-8 px-3 text-xs font-semibold transition ${t.radius} ${type === o.value ? t.navActive : t.chip}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {!list.length ? (
          <p className={`px-3 py-2.5 text-xs ${t.radius} ${t.chip}`}>{q ? 'No rooms match your search.' : 'No rooms in this category.'}</p>
        ) : (
          <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2" role="radiogroup" aria-label="Room">
            {list.map((r) => {
              const free = ok(r)
              const selR = sel === String(r.id)
              const extra = note?.(r)
              return (
                <motion.button
                  layout
                  key={r.id} type="button" role="radio" aria-checked={selR} disabled={!free && !selR}
                  onClick={() => pick(String(r.id))}
                  whileHover={free ? { scale: 1.015 } : undefined} whileTap={free ? { scale: 0.98 } : undefined}
                  className={`flex items-center gap-3 p-2.5 text-left transition disabled:cursor-not-allowed ${t.radius} ${
                    selR ? t.navActive : free ? `${t.chip} ${t.cardHover}` : `${t.chip} opacity-50`
                  }`}
                >
                  <span className={`grid size-12 shrink-0 place-items-center overflow-hidden ${t.radius} ${selR ? 'bg-white/15' : t.iconBox}`}>
                    {r.photo ? <img src={r.photo} alt="" loading="lazy" className="size-full object-cover" /> : <BedDouble className="size-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{r.name}</span>
                    <span className={`block truncate text-[11px] ${selR ? 'opacity-75' : t.muted}`}>
                      {r.type_label} · {formatMoney(dayRest ? (r.day_rest_price ?? r.price) : r.price)}{dayRest ? ' flat' : '/night'} · sleeps {r.capacity}
                    </span>
                    <span className={`mt-0.5 block truncate text-[10px] font-medium uppercase tracking-wide ${
                      free ? (selR ? 'opacity-80' : 'text-emerald-600 dark:text-emerald-400') : 'opacity-60'
                    }`}>
                      {free ? `Available${extra ? ` · ${extra}` : ''}` : extra || blockedLabel(r)}
                    </span>
                  </span>
                  {selR && (
                    <motion.span initial={{ scale: 0.4, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }} className="shrink-0">
                      <Check className="size-4" />
                    </motion.span>
                  )}
                </motion.button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  /** The room strip for one guest on the allocation card — opens the allocate popup. */
  const stayRow = (k: number) => {
    const main = k < 0
    const c = main ? undefined : companions[k]
    const room = main ? chosen : rooms.find((r) => r.id === Number(c?.room))
    const { s, e, d } = main ? { s: start, e: end, d: span } : cDates(c!)
    const err = main ? errors.room : errors[`c${k}room`]
    return (
      <>
        <button
          type="button" onClick={() => setEditing(k)}
          className={`flex w-full items-center gap-3 border-t px-3 py-2.5 text-left transition hover:brightness-[0.98] dark:hover:brightness-110 ${t.sidebarDivider}`}
        >
          <span className={`relative grid size-8 shrink-0 place-items-center ${t.radius} ${
            room ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
          }`}>
            <BedDouble className="size-4" />
            {!room && (
              <span className="absolute -right-0.5 -top-0.5 flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-amber-500" />
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-xs ${room ? 'font-semibold' : 'font-semibold text-amber-600 dark:text-amber-400'}`}>
              {room ? `${room.name} · ${room.type_label}` : 'Pick their room'}
            </span>
            <span className={`block truncate text-[10px] ${t.muted}`}>
              {spanText(s, e, d)}
            </span>
          </span>
          <span className={`flex shrink-0 items-center gap-1 text-[11px] font-semibold ${room ? t.muted : 'text-amber-600 dark:text-amber-400'}`}>
            <CalendarClock className="size-3.5" />{room ? 'Change' : 'Allocate'}
          </span>
        </button>
        {err && <p className={`border-t px-3 py-1.5 text-[11px] text-rose-500 ${t.sidebarDivider}`}>{err}</p>}
        {main && !errors.room && chosen && !usable(chosen) && (
          <p className={`border-t px-3 py-1.5 text-[11px] text-rose-500 ${t.sidebarDivider}`}>{chosen.name} isn't free for that period — pick another room.</p>
        )}
      </>
    )
  }

  /** Per-guest popup: allocate or change their room and dates. `editing` -1 = main guest. */
  const stayDialog = () => {
    if (editing === null) return null
    const main = editing < 0
    const c = main ? undefined : companions[editing]
    if (!main && !c) return null
    const cStay = c ? cDates(c) : null
    const cBusy = cStay ? busyFor(cStay.s, cStay.e) : new Set<number>()
    // Which bookings hold each room over this guest's window — drives the
    // free → reserved → occupied → out-of-service ordering in the picker.
    const blockers = main ? blockersFor(start, end) : cStay ? blockersFor(cStay.s, cStay.e) : new Map<number, BookingStatus>()
    // A companion's room must be free for their dates, and not already picked
    // by the main guest or another companion — each room-holder is a separate client.
    const cOk = (r: Room) =>
      r.status === 'active' && !cBusy.has(r.id) && r.id !== chosen?.id &&
      !companions.some((o, x) => x !== editing && Number(o.room) === r.id)
    const title = main ? `Guest 1 · ${form.guest_name.trim() || 'main contact'}` : `Guest ${editing + 2} · ${c!.name.trim() || 'extra guest'}`
    return (
      <motion.div
        className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <button type="button" aria-label="Close" onClick={() => setEditing(null)} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
        <motion.div
          role="dialog" aria-modal="true" aria-label={title}
          initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
          transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          className={`relative my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden shadow-2xl ${t.radius} ${t.root}`}
        >
          <header className="flex items-center justify-between gap-3 border-b border-slate-900/10 px-5 py-4 dark:border-white/10">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`grid size-10 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
                <CalendarClock className="size-5" />
              </span>
              <div className="min-w-0">
                <h3 className={`truncate text-base ${t.heading}`}>{title}</h3>
                <p className={`text-xs ${t.muted}`}>{main ? 'Pick their room for the stay.' : 'Their room and when they stay.'}</p>
              </div>
            </div>
            <button type="button" onClick={() => setEditing(null)} aria-label="Close" className={`grid size-9 shrink-0 place-items-center ${t.radius} ${t.iconButton}`}>
              <X className="size-4" />
            </button>
          </header>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {main ? (
              <section>
                <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>Room</legend>
                {roomGrid(roomType, setRoomType, form.room, usableMain, (id) => { put('room', id); clearErr('room') }, blockers, (r) => {
                  const j = companions.findIndex((c) => Number(c.room) === r.id)
                  return j >= 0 ? `Guest ${j + 2}'s pick` : ''
                })}
                {errors.room && <span className="mt-1 block text-[11px] text-rose-500">{errors.room}</span>}
              </section>
            ) : (
              <>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className={`text-[11px] font-medium ${t.muted}`}>Their dates</span>
                  <div className={`grid grid-cols-2 gap-1 p-1 ${t.radius} ${t.chip}`} role="radiogroup" aria-label="Guest dates">
                    {([false, true] as const).map((v) => (
                      <button
                        key={String(v)} type="button" role="radio" aria-checked={c!.ownDates === v} disabled={!c!.room}
                        onClick={() => {
                          setC(editing, 'ownDates', v)
                          if (v) { if (!c!.start) setC(editing, 'start', form.start); if (!c!.days) setC(editing, 'days', dayRest ? form.hours : form.days) }
                        }}
                        className={`flex h-8 items-center justify-center gap-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${t.radius} ${c!.ownDates === v ? t.navActive : 'opacity-70 hover:opacity-100'}`}
                      >
                        {v ? 'Own dates' : "Same as guest 1"}
                      </button>
                    ))}
                  </div>
                  {!c!.room && <span className={`text-[11px] ${t.muted}`}>Allocate them a room below — each guest needs a different room. They follow guest 1's dates unless you set their own.</span>}
                </div>
                {c!.ownDates && c!.room && cStay && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input t={t} label="Check-in — date & time" type="datetime-local" value={c!.start} onChange={(e) => setC(editing, 'start', e.target.value)} />
                      <Stepper
                        t={t} label={dayRest ? 'Hours to occupy' : 'Length of stay'}
                        value={Math.max(1, parseInt(c!.days, 10) || span)} min={1} max={dayRest ? 12 : 365}
                        onChange={(v) => setC(editing, 'days', String(v))}
                        suffix={Math.max(1, parseInt(c!.days, 10) || span) === 1 ? (dayRest ? 'hour' : 'day') : (dayRest ? 'hours' : 'days')}
                      />
                    </div>
                    {cStay.e && (
                      <div className={`flex items-center gap-2 px-3 py-2 text-xs ${t.radius} ${t.chip}`}>
                        <Clock className={`size-3.5 shrink-0 ${t.muted}`} />
                        <span>{dayRest ? 'Room frees at' : 'Checks out'} <b>{cStay.e.toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</b></span>
                      </div>
                    )}
                  </>
                )}
                <section>
                  <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>Their room</legend>
                  <div className="flex min-w-0 flex-col gap-2">
                    {roomGrid(
                      c!.type, (v) => setC(editing, 'type', v), c!.room, cOk, (id) => { setC(editing, 'room', id); clearErr(`c${editing}room`) }, blockers,
                      (r) => r.id === chosen?.id ? 'Main room' : (() => { const j = companions.findIndex((o, x) => x !== editing && Number(o.room) === r.id); return j >= 0 ? `Guest ${j + 2}'s pick` : '' })(),
                    )}
                  </div>
                </section>
              </>
            )}
          </div>

          <footer className="flex justify-end gap-2 border-t border-slate-900/10 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/10">
            <Button t={t} onClick={() => setEditing(null)}>Done</Button>
          </footer>
        </motion.div>
      </motion.div>
    )
  }

  /** Card 0 — pick what this booking is. */
  const typeCard = (
    <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Booking type">
      {modeCard('reserve', CalendarCheck, 'Reserve a room', 'Hold it for a future date')}
      {modeCard('stay', BedDouble, 'Check in now', 'Guest takes the room today')}
      {modeCard('dayrest', Hourglass, 'Day rest', 'A few hours in the room')}
    </div>
  )

  /** Card 1 — the main guest's contact details under the party-size stepper. */
  const mainGuestCard = (
    <>
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Stepper t={t} label="People in the party" value={guests} min={1} max={30} onChange={setGuests} error={errors.guests} suffix={guests === 1 ? 'guest' : 'guests'} />
      </div>
      <div className={`overflow-hidden ${t.radius} ${t.chip}`}>
        <div className="grid gap-4 p-3 sm:grid-cols-2">
            <div className="relative" onFocus={() => setSuggest('p')} onBlur={blurSuggest}>
              <PhoneInput t={t} label="Phone number (optional)" value={form.guest_phone} onChange={(v) => { put('guest_phone', v); clearErr('guest_phone') }} error={errors.guest_phone} />
              {suggest === 'p' && <SuggestList t={t} items={phoneSug(form.guest_phone)} onPick={pickGuest} />}
            </div>
            <div className="relative" onFocus={() => setSuggest('n')} onBlur={blurSuggest}>
              <Input t={t} label="Full name" value={form.guest_name} onChange={setUpper('guest_name')} error={errors.guest_name} placeholder="e.g. JANE MWANGI" autoComplete="off" required />
              {suggest === 'n' && <SuggestList t={t} items={nameSug(form.guest_name)} onPick={pickGuest} />}
            </div>
            {phoneDone && (
              <p className={`flex items-center gap-1.5 text-[11px] font-semibold sm:col-span-2 ${known ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {known ? <><BadgeCheck className="size-3.5" /> Registered client — details auto-filled</> : <><Sparkles className="size-3.5" /> New client — first booking at this branch</>}
              </p>
            )}
            {offerRef && (
              <div className="sm:col-span-2">
                {!showRef ? addTile('Add who referred them', 'They earn a gift voucher once this client pays', Gift, () => setRefOpen(true), { amber: true }) : (
                  <div className={`relative border border-dashed border-amber-500/40 bg-amber-500/[0.05] p-3 pt-5 dark:border-amber-400/25 dark:bg-amber-400/[0.05] ${t.radius}`}>
                    <span className="absolute -top-2.5 left-3 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm dark:bg-amber-400 dark:text-amber-950">
                      <Gift className="size-2.5" /> Referral
                    </span>
                    <p className="mb-3 flex items-center gap-2 text-xs font-semibold">
                      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-amber-500/15 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300">
                        <Gift className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block">Who referred them?</span>
                        <span className={`block text-[10px] font-medium leading-snug ${t.muted}`}>Not the guest — they earn a gift voucher once this client pays</span>
                      </span>
                      <button
                        type="button" aria-label="Remove referral"
                        onClick={() => { setRefOpen(false); put('ref_name', ''); put('ref_phone', ''); clearErr('referrer_name'); clearErr('referrer_phone') }}
                        className={`ml-auto grid size-7 shrink-0 place-items-center self-start ${t.radius} ${t.iconButton}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="relative" onFocus={() => setSuggest('rp')} onBlur={blurSuggest}>
                        <PhoneInput t={t} label="Referrer's phone" value={form.ref_phone} onChange={(v) => { put('ref_phone', v); clearErr('referrer_phone') }} error={errors.referrer_phone} />
                        {suggest === 'rp' && <SuggestList t={t} items={phoneSug(form.ref_phone)} onPick={pickReferrer} />}
                      </div>
                      <div className="relative" onFocus={() => setSuggest('rn')} onBlur={blurSuggest}>
                        <Input t={t} label="Referrer's name" value={form.ref_name} onChange={setUpper('ref_name')} error={errors.referrer_name} placeholder="e.g. JANE MWANGI" autoComplete="off" />
                        {suggest === 'rn' && <SuggestList t={t} items={nameSug(form.ref_name)} onPick={pickReferrer} />}
                      </div>
                    </div>
                    {refMatch && (
                      <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <BadgeCheck className="size-3.5" /> Registered client · {refMatch.name}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="sm:col-span-2">
              {addTile(showMore ? 'Hide extra details' : 'Add more details', 'ID, email, nationality & special requests', BadgeCheck, () => setMore((m) => !m), { open: showMore })}
              <AnimatePresence initial={false}>
                {showMore && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className={`mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2 ${t.sidebarDivider}`}>
                      <EmailInput t={t} label="Email address" value={form.guest_email} onChange={(v) => { put('guest_email', v); clearErr('guest_email') }} error={errors.guest_email} />
                      <div className="sm:col-span-2">
                        <NatIdInput
                          t={t}
                          nationality={form.guest_nationality} onNationality={(v) => { put('guest_nationality', v); clearErr('guest_nationality') }}
                          idType={form.guest_id_type} onIdType={(v) => put('guest_id_type', v)}
                          idNumber={form.guest_id_number} onIdNumber={(v) => { put('guest_id_number', v); clearErr('guest_id_number') }}
                          error={errors.guest_nationality || errors.guest_id_number}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Area t={t} label="Notes & special requests" value={form.guest_notes} onChange={set('guest_notes')} error={errors.guest_notes} placeholder="Allergies, late arrival, extra bed…" maxLength={500} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
        </div>
      </div>
    </>
  )

  /** One section per extra guest on card 1, same contact & extras shape as the main guest. */
  const companionCard = (i: number): ReactNode => {
    const c = companions[i]
    if (!c) return null
    const cMore = c.more || !!(c.email || c.id_number || c.notes || (c.nationality && c.nationality !== 'Kenya'))
    const cMatch = phoneComplete(c.phone) ? clients.find((x) => tail9(x.phone) === tail9(c.phone)) : undefined
    return (
      <div className={`overflow-hidden ${t.radius} ${t.chip}`}>
        <div className="grid gap-4 p-3 sm:grid-cols-2">
          <div className="relative" onFocus={() => setSuggest(`cp${i}`)} onBlur={blurSuggest}>
            <PhoneInput t={t} label="Phone number (optional)" value={c.phone} onChange={(v) => { setC(i, 'phone', v); clearErr(`c${i}phone`) }} error={errors[`c${i}phone`]} />
            {suggest === `cp${i}` && <SuggestList t={t} items={phoneSug(c.phone)} onPick={(g) => pickCompanion(i, g)} />}
          </div>
          <div className="relative" onFocus={() => setSuggest(`cn${i}`)} onBlur={blurSuggest}>
            <Input t={t} label="Full name" value={c.name} onChange={(e) => setC(i, 'name', e.target.value.toUpperCase())} error={errors[`c${i}name`]} placeholder="e.g. JOHN MWANGI" autoComplete="off" required />
            {suggest === `cn${i}` && <SuggestList t={t} items={nameSug(c.name)} onPick={(g) => pickCompanion(i, g)} />}
          </div>
          {phoneComplete(c.phone) && (
            <p className={`flex items-center gap-1.5 text-[11px] font-semibold sm:col-span-2 ${cMatch ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {cMatch ? <><BadgeCheck className="size-3.5" /> Registered client{cMatch.name ? ` · ${cMatch.name}` : ''} — details auto-filled</> : <><Sparkles className="size-3.5" /> New client — first booking at this branch</>}
            </p>
          )}
          <div className="sm:col-span-2">
            {addTile(cMore ? 'Hide extra details' : 'Add more details', 'ID, email, nationality & special requests', BadgeCheck, () => setC(i, 'more', !cMore), { open: cMore })}
            <AnimatePresence initial={false}>
              {cMore && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className={`mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2 ${t.sidebarDivider}`}>
                    <EmailInput t={t} label="Email address" value={c.email} onChange={(v) => { setC(i, 'email', v); clearErr(`c${i}email`) }} error={errors[`c${i}email`]} />
                    <div className="sm:col-span-2">
                      <NatIdInput
                        t={t}
                        nationality={c.nationality} onNationality={(v) => { setC(i, 'nationality', v); clearErr(`c${i}nationality`) }}
                        idType={c.id_type} onIdType={(v) => setC(i, 'id_type', v || 'national_id')}
                        idNumber={c.id_number} onIdNumber={(v) => setC(i, 'id_number', v)}
                        error={errors[`c${i}nationality`]}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Area t={t} label="Notes & special requests" value={c.notes} onChange={(e) => setC(i, 'notes', e.target.value)} placeholder="Allergies, late arrival, extra bed…" maxLength={500} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    )
  }

  /** Card 2 — the booking's check-in and length up top, then one room-allocation
   *  row per guest. Extra guests follow guest 1's dates by default; their popup
   *  can still give them their own. Every guest needs a different room. */
  const roomsCard = (
    <div className="space-y-4">
      <p className={`text-xs ${t.muted}`}>
        Allocate each guest a different room — every room-holder becomes their own client, with their own bill
        and payments. Two guests can't share the same room. Every guest follows these dates unless you give them their own.
      </p>
      <div className={`grid gap-4 p-3 sm:grid-cols-2 ${t.radius} ${t.chip}`}>
        <Input
          t={t} label={mode === 'reserve' ? 'Moving in — date & time' : 'Check-in — date & time'}
          type="datetime-local" value={form.start} onChange={(e) => { set('start')(e); clearErr('start') }} error={errors.start} required
        />
        {dayRest ? (
          <Stepper t={t} label="Hours to occupy" value={hours} min={1} max={12} onChange={(v) => { put('hours', String(v)); clearErr('hours') }} error={errors.hours} suffix={hours === 1 ? 'hour' : 'hours'} />
        ) : (
          <Stepper t={t} label="Length of stay" value={days} min={1} max={365} onChange={(v) => { put('days', String(v)); clearErr('days') }} error={errors.days} suffix={days === 1 ? 'day' : 'days'} />
        )}
        <div className={`flex items-center gap-2 px-3 py-2 text-xs sm:col-span-2 ${t.radius} ${t.chip}`}>
          <Clock className={`size-3.5 shrink-0 ${t.muted}`} />
          {end ? (
            <span>{mode === 'reserve' ? 'Reserved until' : dayRest ? 'Room frees at' : 'Checks out'} <b>{end.toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</b> · {span} {span === 1 ? (dayRest ? 'hour' : 'day') : (dayRest ? 'hours' : 'days')}</span>
          ) : (
            <span className={t.muted}>Pick the {mode === 'reserve' ? 'move-in' : 'check-in'} date to see the end time.</span>
          )}
        </div>
        {errors.end && <p className="text-[11px] text-rose-500 sm:col-span-2">{errors.end}</p>}
      </div>
      {[{ k: -1, n: 1, name: form.guest_name.trim() }, ...companions.map((c, j) => ({ k: j, n: j + 2, name: c.name.trim() }))].map((g) => (
        <div key={g.k}>
          <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold">
            <span className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${t.iconBox}`}>{g.n}</span>
            <span className="truncate">Guest {g.n}{g.name ? ` · ${g.name}` : ''}</span>
          </p>
          <div className={`overflow-hidden ${t.radius} ${t.chip}`}>{stayRow(g.k)}</div>
        </div>
      ))}
    </div>
  )

  /** Card 3 — the money. The bill lists every room-holder's charge; a reservation
   *  records an optional deposit (only while a till is open), while check-ins and
   *  day rests collect the full amount — one payment row per room-holder. */
  const payCard = (
    <div className="space-y-4">
      <p className={`text-xs ${t.muted}`}>
        {mode === 'reserve'
          ? 'The bill falls due when the guest arrives — take a deposit now to hold the room.'
          : 'Collect the full amount before handing over the room — each room-holder settles their own charge.'}
      </p>
      <div className={`overflow-hidden ${t.radius} ${t.chip}`}>
        <p className={`flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider ${t.muted}`}>
          <Receipt className="size-3.5" /> The bill
        </p>
        {payers.map((p) => (
          <div key={p.gi}>
            <div className={`flex items-center gap-3 border-t px-3 py-2.5 ${t.sidebarDivider}`}>
              <span className={`grid size-8 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
                <BedDouble className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">
                  Guest {p.gi + 1}{p.name ? ` · ${p.name}` : ''}
                </span>
                <span className={`block truncate text-[10px] ${t.muted}`}>
                  {p.room.name} · {spanText(p.s, p.e, p.d)}
                </span>
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums">{formatMoney(charge(p.room, p.d))}</span>
            </div>
            {pkgPicks(p.gi).map((x) => (
              <div key={x.id} className={`flex items-center gap-3 border-t px-3 py-2 ${t.sidebarDivider}`}>
                <span className={`grid size-8 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
                  <Package className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">+ {x.name}</span>
                  <span className={`block truncate text-[10px] ${t.muted}`}>{x.category_label} · extra package</span>
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums">{formatMoney(x.amount)}</span>
                <button
                  type="button" aria-label={`Remove ${x.name}`} onClick={() => togglePkg(p.gi, x.id)}
                  className={`grid size-6 shrink-0 place-items-center ${t.radius} ${t.iconButton}`}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            {packages.some((x) => !(picked[p.gi] ?? []).includes(x.id)) && (
              <div className={`border-t px-3 py-2.5 ${t.sidebarDivider}`}>
                {addTile(
                  pkgOpen[p.gi] ? 'Hide package picker' : 'Add a package',
                  `Optional extras on Guest ${p.gi + 1}'s bill`,
                  Package,
                  () => setPkgOpen((m) => ({ ...m, [p.gi]: !m[p.gi] })),
                  { open: !!pkgOpen[p.gi] },
                )}
                <AnimatePresence initial={false}>
                  {pkgOpen[p.gi] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-3">
                        <Select
                          t={t} label={`Extra packages for Guest ${p.gi + 1}`} value=""
                          onChange={(e) => { const id = Number(e.target.value); if (id) togglePkg(p.gi, id) }}
                        >
                          <option value="">Pick a package to add</option>
                          {packages.filter((x) => !(picked[p.gi] ?? []).includes(x.id)).map((x) => (
                            <option key={x.id} value={x.id}>{x.name} · {x.category_label} — {formatMoney(x.amount)}</option>
                          ))}
                        </Select>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        ))}
        <p className={`flex items-center justify-between border-t px-3 py-2.5 text-xs font-bold ${t.sidebarDivider}`}>
          Total <span className="tabular-nums">{formatMoney(billTotal)}</span>
        </p>
      </div>
      <section>
        {addTile(
          showTax ? 'Hide tax reference' : 'Add a tax reference',
          'Invoice / KRA eTIMS code — saved on the booking for the records',
          Receipt,
          () => setTaxOpen((o) => !o),
          { open: showTax },
        )}
        <AnimatePresence initial={false}>
          {showTax && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className={`mt-3 p-3 ${t.radius} ${t.chip}`}>
                <Input
                  t={t} label="Tax reference" maxLength={64} autoComplete="off"
                  value={taxRef} onChange={(e) => { setTaxRef(e.target.value.toUpperCase()); clearErr('tax_reference') }}
                  error={errors.tax_reference} placeholder="Invoice / KRA eTIMS code"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
      {mode === 'reserve' ? (
        <section>
          <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>Deposit</legend>
          {tillOpen ? (
            <div className={`grid gap-4 p-3 sm:grid-cols-2 ${t.radius} ${t.chip}`}>
              <Input
                t={t} label="Deposit received (optional)" type="number" min={0} step="0.01"
                value={depositAmt} onChange={(e) => { setDepositAmt(e.target.value); clearErr('deposit') }}
                error={errors.deposit} placeholder="0.00"
              />
              <p className={`self-end pb-2 text-[11px] ${t.muted}`}>
                Held against the reservation — counts toward the bill when the guest pays.
              </p>
            </div>
          ) : (
            <p className={`flex items-center gap-2 px-3 py-2.5 text-xs ${t.radius} ${t.chip}`}>
              <Lock className={`size-3.5 shrink-0 ${t.muted}`} />
              The till is closed — the room can be reserved without a deposit. Open it on the Counter page to collect one.
            </p>
          )}
        </section>
      ) : (
        <section>
          <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>
            <CreditCard className="mr-1 inline size-3.5" /> {dayRest ? 'Payment — collect what the guest pays now' : 'Payment — collect on check-in'}
          </legend>
          <div className="space-y-3">
            {payers.map((p) => {
              const due = dueFor(p)
              const row = payRow(p.gi, due)
              const paid = Number(row.amount) || 0
              const bal = due - paid
              return (
                <div key={p.gi} className={`overflow-hidden ${t.radius} ${t.chip}`}>
                  <p className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold`}>
                    <span className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${t.iconBox}`}>{p.gi + 1}</span>
                    <span className="min-w-0 truncate">
                      Guest {p.gi + 1}{p.name ? ` · ${p.name}` : ''} — {p.room.name}
                    </span>
                    <span className="ml-auto shrink-0 tabular-nums">
                      due {formatMoney(due)}
                      {paid > 0 && bal > 0 && <span className="text-amber-600 dark:text-amber-400"> · balance {formatMoney(bal)}</span>}
                      {paid > 0 && bal < 0 && <span className="text-emerald-600 dark:text-emerald-400"> · overpaid {formatMoney(-bal)}</span>}
                    </span>
                  </p>
                  <div className={`grid gap-4 border-t p-3 sm:grid-cols-2 ${t.sidebarDivider}`}>
                    <Select
                      t={t} label="Method" value={row.method}
                      onChange={(e) => {
                        const m = e.target.value as PaymentMethod | ''
                        setPay(p.gi, 'method', m)
                        clearErr(`p${p.gi}method`)
                        // Switching to cash drops the reference — cash leaves no code.
                        if (m === 'cash') { setPay(p.gi, 'reference', ''); clearErr(`p${p.gi}reference`) }
                      }}
                      error={errors[`p${p.gi}method`]}
                    >
                      <option value="" disabled>Pick a method</option>
                      {PAYMENT_METHODS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                    <Input
                      t={t} label="Amount received" type="number" min={0} step="0.01"
                      value={row.amount} onChange={(e) => { setPay(p.gi, 'amount', e.target.value); clearErr(`p${p.gi}amount`) }}
                      error={errors[`p${p.gi}amount`]}
                    />
                    {row.method !== '' && row.method !== 'cash' && (
                      <Input
                        t={t} label={needsRef(row.method) ? 'Reference' : 'Reference (optional)'} required={needsRef(row.method)}
                        value={row.reference}
                        onChange={(e) => { setPay(p.gi, 'reference', e.target.value.toUpperCase()); clearErr(`p${p.gi}reference`) }}
                        error={errors[`p${p.gi}reference`]} placeholder="Transaction / M-Pesa code" autoComplete="off"
                      />
                    )}
                    <Input
                      t={t} label="Time paid" type="datetime-local"
                      value={row.paid_at}
                      onChange={(e) => { setPay(p.gi, 'paid_at', e.target.value); clearErr(`p${p.gi}paid_at`) }}
                      error={errors[`p${p.gi}paid_at`]}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          {errors.payments && <p className="mt-2 text-[11px] text-rose-500">{errors.payments}</p>}
        </section>
      )}
    </div>
  )

  // Card 0 picks the booking type — selecting one is the step itself and moves
  // straight on. Card 1 collects every guest's details — raising the party
  // size grows another guest section right on the card. Card 2 allocates each
  // guest a room, and card 3 takes the money before the wizard closes.
  const lastCard = 3
  const cur = Math.min(card, lastCard)
  const cardTitle = (i: number) =>
    i === 0 ? 'Booking type' : i === 1 ? 'Guest details' : i === 2 ? 'Rooms & dates' : mode === 'reserve' ? 'Deposit' : 'Payment'
  const cardBody = (i: number): ReactNode =>
    i === 0 ? typeCard : i === 1 ? (
      <div className="space-y-5">
        {mainGuestCard}
        <AnimatePresence initial={false}>
          {companions.map((_, j) => (
            <motion.div
              key={j}
              initial={{ opacity: 0, height: 0, y: -8 }} animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -8 }} transition={{ duration: 0.25, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold">
                <span className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${t.iconBox}`}>{j + 2}</span>
                Guest {j + 2}
              </p>
              {companionCard(j)}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    ) : i === 2 ? roomsCard : payCard
  /** Does an error key live on card `i`? Clears that card's stale errors before re-validating. */
  const cardField = (i: number, k: string) =>
    i === 0
      ? /^(branch|kind|status)$/.test(k)
      : i === 1
        ? /^(guest_|guests$|referrer_|companions$)/.test(k) || /^c\d+(name|phone|email)$/.test(k)
        : i === 2
          ? /^(room|start|end|days|hours|companions$)/.test(k) || /^c\d+room$/.test(k)
          : /^(deposit|payments?|packages|detail|tax_reference)$/.test(k) || /^p\d+(amount|method|reference|paid_at)$/.test(k)

  /** Per-card gate — Next only advances when the current card passes its checks. */
  const cardOk = (i: number) => {
    const errs: FieldErrors = {}
    const emailOk = (v: string) => !v.trim() || /^\S+@\S+\.\S+$/.test(v.trim())
    if (i === 1) {
      if (!form.guest_name.trim()) errs.guest_name = "The guest's name is required."
      if (digits(form.guest_phone) && !phoneDone) errs.guest_phone = 'Enter a valid phone number.'
      if (!emailOk(form.guest_email)) errs.guest_email = 'Enter a valid email address.'
      companions.forEach((c, j) => {
        if (!c.name.trim()) errs[`c${j}name`] = 'Their name is required.'
        if (c.phone.trim() && !phoneComplete(c.phone)) errs[`c${j}phone`] = 'Enter a valid phone number.'
        if (!emailOk(c.email)) errs[`c${j}email`] = 'Enter a valid email address.'
      })
      // A referral needs both halves — and the referrer can't be the guest themself.
      if (form.ref_name.trim() || digits(form.ref_phone)) {
        if (!form.ref_name.trim()) errs.referrer_name = "Give the referrer's name too."
        if (!digits(form.ref_phone)) errs.referrer_phone = "Give the referrer's phone number too."
        else if (!phoneComplete(form.ref_phone)) errs.referrer_phone = 'Enter a valid phone number.'
        else if (tail9(form.ref_phone) === tail9(form.guest_phone)) errs.referrer_phone = "The referrer can't be the guest themself."
      }
    } else if (i === 2) {
      if (!start || !end) errs.start = `Pick the ${mode === 'reserve' ? 'move-in' : 'check-in'} date and time.`
      if (!chosen) errs.room = 'Choose a room to continue.'
      else if (!usable(chosen)) errs.room = `${chosen.name} isn't free for that period — pick another.`
      companions.forEach((c, j) => {
        const r = c.room ? rooms.find((x) => x.id === Number(c.room)) : undefined
        if (!r) { errs[`c${j}room`] = 'Allocate them a room — each guest needs a different room.'; return }
        const { s, e } = cDates(c)
        const other = companions.findIndex((o, x) => x !== j && Number(o.room) === r.id)
        if (r.status !== 'active' || (s && e && busyFor(s, e).has(r.id))) errs[`c${j}room`] = `${r.name} isn't free for that period — pick another.`
        else if (chosen && r.id === chosen.id) errs[`c${j}room`] = `${r.name} is the main room — pick a different one.`
        else if (other >= 0) errs[`c${j}room`] = `Guest ${other + 2} already has ${r.name} — each guest needs their own room.`
      })
    } else if (i === 3) {
      if (mode === 'reserve') {
        if (depositAmt.trim() && !(Number(depositAmt) > 0)) errs.deposit = 'Enter a valid deposit amount.'
      } else {
        // Check-ins and day rests take whatever the guest pays — part-payment
        // leaves a balance, overpayment becomes credit. Only bad rows block:
        // a money amount without a method (or a required transaction code).
        for (const p of payers) {
          const due = dueFor(p)
          const row = payRow(p.gi, due)
          const amt = row.amount.trim()
          if (!amt) continue
          if (!(Number(amt) > 0)) {
            errs[`p${p.gi}amount`] = 'Enter a valid amount.'
            continue
          }
          if (!row.method) errs[`p${p.gi}method`] = 'Pick the payment method.'
          else if (needsRef(row.method) && !row.reference.trim()) errs[`p${p.gi}reference`] = 'Add the transaction code.'
        }
      }
    }
    setErrors((prev) => ({ ...Object.fromEntries(Object.entries(prev).filter(([k]) => !cardField(i, k))), ...errs }))
    return !Object.keys(errs).length
  }

  const go = (i: number) => {
    const n = Math.max(0, Math.min(lastCard, i))
    if (n > cur && !cardOk(cur)) return
    setDir(n > cur ? 1 : -1)
    setCard(n)
    // Fresh availability for the allocation card — rooms booked or freed by a
    // checkout elsewhere since the page loaded show their true state.
    if (n === 2) reloadBookings?.()
  }

  /** Which card owns a backend field error — used to jump to it after a failed submit. */
  const errorCard = (f: FieldErrors) =>
    ['branch', 'kind', 'status'].some((k) => f[k]) ? 0
      : ['guest_name', 'guest_phone', 'guest_email', 'guest_id_type', 'guest_id_number',
        'guest_nationality', 'guest_notes', 'guests', 'referrer_name', 'referrer_phone'].some((k) => f[k]) ? 1
        : ['room', 'start', 'end', 'days', 'hours', 'companions'].some((k) => f[k]) ? 2
          : lastCard

  // Live coverage — the share of required fields already filled: the contact's
  // name, a room, and every extra guest's name and room.
  const covered = [
    !!form.guest_name.trim(),
    !!chosen,
    ...companions.map((c) => !!c.name.trim()),
    ...companions.map((c) => !!c.room),
    ...(mode === 'reserve' ? [] : [payOk]),
  ]
  const pct = Math.round((covered.filter(Boolean).length / covered.length) * 100)

  // A locked mode (landed here via a direct link while the till is closed) shows
  // the mode picker with its lock states plus a notice — the wizard stays hidden.
  if (modeLocked) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Panel t={t}>{typeCard}</Panel>
        <Panel t={t}>
          <Empty
            t={t}
            icon={Lock}
            title={foreign ? 'View only' : 'Till closed'}
            text={foreign
              ? `${tillOwner ?? 'Another receptionist'} has the till open — you can look around but can't register clients or collect money until they close it.`
              : 'Checking a client in needs an open till — open it on the Counter page under Accounts, then come back. Reservations can still be taken.'}
          />
        </Panel>
      </div>
    )
  }

  return (
    <form
      onSubmit={save}
      onKeyDown={(e) => {
        // Enter inside a text input never submits the wizard — it turns the card
        // on earlier steps and does nothing on the last one or inside the room
        // popup. The only way through is the last card's button.
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
          e.preventDefault()
          if (cur < lastCard && editing === null) go(cur + 1)
        }
      }}
      className="mx-auto w-full max-w-3xl"
    >
      <div className="mb-4 flex items-center gap-3 px-1">
        <span className={`shrink-0 text-[11px] font-semibold ${t.muted}`}>{cur + 1} / {lastCard + 1}</span>
        <div className={`h-1.5 min-w-0 flex-1 overflow-hidden rounded-full ${t.chip}`}>
          <motion.div
            className="h-full rounded-full bg-emerald-500"
            initial={false} animate={{ width: `${pct}%` }} transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
        <span className={`shrink-0 text-sm font-bold tabular-nums ${t.heading}`}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={pct} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={{ duration: 0.15 }} className="inline-block">
              {pct}%
            </motion.span>
          </AnimatePresence>
        </span>
      </div>

      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div
          key={cur} custom={dir} variants={cardVars}
          initial="enter" animate="center" exit="exit"
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <Panel t={t}>
            <div className="mb-4 flex items-center gap-3">
              <span className={`grid size-7 shrink-0 place-items-center text-xs font-bold ${t.radius} ${t.iconBox}`}>{cur + 1}</span>
              <h3 className={`text-sm ${t.heading}`}>{cardTitle(cur)}</h3>
            </div>
            {cardBody(cur)}
          </Panel>
        </motion.div>
      </AnimatePresence>

      <div className="mt-4 flex items-center gap-2">
        {cur === 0 ? (
          <Button t={t} variant="ghost" onClick={onDone}>{doneLabel}</Button>
        ) : (
          <Button t={t} variant="ghost" onClick={() => go(cur - 1)}><ArrowLeft className="size-3.5" /> Back</Button>
        )}
        <span className="ml-auto flex items-center gap-3">
          {cur === lastCard && missing.length > 0 && (
            <span className={`text-[11px] ${t.muted}`}>Still needed: {missing.join(', ')}</span>
          )}
          {cur < lastCard ? (
            <Button t={t} onClick={() => go(cur + 1)}>Next <ArrowRight className="size-3.5" /></Button>
          ) : (
            <Button t={t} type="submit" busy={saving}>
              {mode === 'reserve' ? <><CalendarCheck className="size-4" /> Reserve room</> : dayRest ? <><Hourglass className="size-4" /> Book day rest</> : <><LogIn className="size-4" /> Check in guest</>}
            </Button>
          )}
        </span>
      </div>
      {errors.companions && <p className="mt-2 text-[11px] text-rose-500">{errors.companions}</p>}
      <div className="mt-3"><Flash message={message} tone="red" /></div>
      <AnimatePresence>{stayDialog()}</AnimatePresence>
    </form>
  )
}
