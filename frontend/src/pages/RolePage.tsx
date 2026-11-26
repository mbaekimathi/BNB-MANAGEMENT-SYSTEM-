import { AnimatePresence, motion } from 'framer-motion'
import { AlarmClock, ArrowUpRight, BadgeCheck, Ban, BedDouble, BellRing, Building2, CalendarCheck, Clock, Construction, Contact, Hash, History, Hourglass, Mail, MapPin, Minus, Phone, Ticket, TrendingDown, TrendingUp, Users, Wallet, X, type LucideIcon } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Empty, LinkButton, Loading, Panel, Pill, type Tone } from '../components/hr/ui'
import { Avatar } from '../components/workspace/Avatar'
import { WorkspaceLayout } from '../components/workspace/WorkspaceLayout'
import { useAuth } from '../context/AuthContext'
import type { Employee } from '../lib/api'
import { clientPath, isBranchRole, rolePath } from '../lib/roles'
import { greetingFor, useNow } from '../lib/time'
import { PROFILE_ITEM, THEMES, WORKSPACES, type NavItem, type Workspace, type WorkspaceTheme } from '../lib/workspaces'
import { BNB_PAGE_SLUGS, bnb, clientKey, type Booking } from '../lib/bnb'
import { HR_PAGE_SLUGS, useApi } from '../lib/hr'
import type { RegisterMode } from './ReservationsPage'

// Each workspace page is its own chunk — the first paint only downloads the
// layout plus the page being opened, not every page in the app.
const AccountsPage = lazy(() => import('./AccountsPage'))
const BranchSettingsPage = lazy(() => import('./BranchSettingsPage'))
const BranchSetupPage = lazy(() => import('./BranchSetupPage'))
const CheckInPage = lazy(() => import('./CheckInPage'))
const ClientsPage = lazy(() => import('./ClientsPage'))
const ExtraPackagesPage = lazy(() => import('./ExtraPackagesPage'))
const GuestsInHousePage = lazy(() => import('./GuestsInHousePage'))
const AllTransactionsPage = lazy(() => import('./GuestsInHousePage').then((m) => ({ default: m.AllTransactionsPage })))
const ReferralsPage = lazy(() => import('./ReferralsPage'))
const ReservationsPage = lazy(() => import('./ReservationsPage'))
const DayRestPage = lazy(() => import('./ReservationsPage').then((m) => ({ default: m.DayRestPage })))
const RegisterClientPage = lazy(() => import('./ReservationsPage').then((m) => ({ default: m.RegisterClientPage })))
const ReportsPage = lazy(() => import('./ReportsPage'))
const RoomAvailabilityPage = lazy(() => import('./RoomAvailabilityPage'))
const RoomManagementPage = lazy(() => import('./RoomManagementPage'))
const TeamShiftsPage = lazy(() => import('./TeamShiftsPage'))
const TicketsPage = lazy(() => import('./TicketsPage'))
const BnbPage = lazy(() => import('./bnb').then((m) => ({ default: m.BnbPage })))
const HrPage = lazy(() => import('./hr').then((m) => ({ default: m.HrPage })))

/** Register-client sidebar children → the form mode they open with. */
const REGISTER_MODES: Record<string, RegisterMode> = { '': 'reserve', 'check-in': 'stay', 'day-rest': 'dayrest' }

/** Where the register form returns to after a booking, per mode. */
const REGISTER_DONE: Record<RegisterMode, [dest: string, label: string]> = {
  reserve: ['guests-in-house', 'Back to guests in house'],
  stay: ['guests-in-house', 'Back to guests in house'],
  dayrest: ['guests-in-house', 'Back to guests in house'],
}

/** Old report URLs under /accounts → the new Reports section. */
const MOVED_REPORTS: Record<string, string> = {
  report: 'cash',
  'room-report': 'rooms',
  'client-report': 'clients',
  'referral-report': 'referrals',
  'package-report': 'packages',
}

/** A client portal's own sections — the sidebar swaps its nav links for these
 *  anchors while a portal is open (ids match the sections in ClientsPage). */
const CLIENT_PORTAL_LINKS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'cp-current', label: 'Current package', icon: BedDouble },
  { id: 'cp-profile', label: 'Profile', icon: Contact },
  { id: 'cp-vouchers', label: 'Vouchers', icon: Ticket },
  { id: 'cp-transactions', label: 'Transactions', icon: Wallet },
  { id: 'cp-history', label: 'Stay history', icon: History },
]

function Overview({ workspace, user, basePath }: { workspace: Workspace; user: Employee; basePath: string }) {
  const t = workspace.theme
  const now = useNow(60_000)
  const modules = workspace.nav.slice(1)
  return (
    <div className="space-y-6">
      <section className={`relative overflow-hidden p-5 sm:p-7 ${t.radius} ${t.card}`}>
        <div className={`pointer-events-none absolute -right-20 -top-24 size-72 rounded-full blur-2xl ${t.glowA}`} />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center">
          <div className="flex min-w-0 flex-1 flex-col gap-5 sm:flex-row sm:items-center">
            <Avatar user={user} className={`size-20 sm:size-24 ${t.radius}`} ring={t.ring} />
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${t.muted}`}>{workspace.nav[0].description}</p>
              <h2 className={`mt-1 text-2xl sm:text-3xl lg:text-4xl ${t.heading}`}>
                {greetingFor(now)}, <span className={t.accentText}>{user.first_name}</span>
              </h2>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${t.badge}`}>
                  <BadgeCheck className="size-3.5" /> {user.role_label}
                </span>
                <span className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-3 py-1 ${t.chip}`}>
                  <Mail className="size-3.5 shrink-0" /> <span className="truncate">{user.email}</span>
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${t.chip}`}>
                  <Phone className="size-3.5" /> {user.phone}
                </span>
              </div>
            </div>
          </div>
          {isBranchRole(user.role) && user.branch_detail && <BranchSummary t={t} user={user} />}
        </div>
        {user.role === 'branch_receptionist' && <FrontDeskRoomStats t={t} basePath={basePath} />}
      </section>

      {isBranchRole(user.role) && !user.branch_detail && <NoBranchNotice t={t} />}

      {user.role === 'branch_receptionist' && <DeparturesToday t={t} me={user} basePath={basePath} />}

      {user.role === 'branch_receptionist' && <ClientTrends t={t} basePath={basePath} />}

      {user.role === 'branch_manager' && (
        <ClientTrends t={t} basePath={basePath} links={['guest-history', 'branch-bookings', 'branch-bookings']} />
      )}

      {user.role !== 'branch_receptionist' && <section>
        <h3 className={`mb-3 text-base ${t.heading}`}>Your tools</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map((item, i) => (
            <motion.div
              key={item.slug}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.4 }}
            >
              <Link
                to={`${basePath}/${item.slug}`}
                className={`group flex h-full flex-col gap-4 p-5 transition-all duration-300 ${t.radius} ${t.card} ${t.cardHover}`}
              >
                <div className="flex items-start justify-between">
                  <span className={`grid size-11 place-items-center ${t.radius} ${t.iconBox}`}>
                    <item.icon className="size-5" />
                  </span>
                  <ArrowUpRight className={`size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 ${t.muted}`} />
                </div>
                <div>
                  <p className={`text-base ${t.heading}`}>{item.label}</p>
                  <p className={`mt-1 text-sm ${t.muted}`}>{item.description}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>}
    </div>
  )
}

const TREND_DAYS = 14
const DAY_MS = 86_400_000

/** Live bookings plus the last fortnight — one request shared by every
 *  front-desk widget via the API's in-flight dedupe. */
function recentBookings() {
  const from = new Date()
  from.setHours(0, 0, 0, 0)
  from.setDate(from.getDate() - (TREND_DAYS - 1))
  return bnb.bookings({ end_from: from.toISOString() })
}

interface TrendPoint {
  label: string
  value: number
}

interface TrendSeries {
  inHouse: TrendPoint[]
  dayRest: TrendPoint[]
  reservations: TrendPoint[]
}

/** Daily counts over the last two weeks, one series per client category:
 *  in-house guests (stays covering each day), day-rest sessions, and reservations made. */
function buildTrends(bookings: Booking[]): TrendSeries {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const live = bookings.filter((b) => b.status !== 'cancelled')
  const days: { label: string; t0: number; t1: number }[] = []
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const t0 = startOfToday.getTime() - i * DAY_MS
    days.push({ t0, t1: t0 + DAY_MS, label: new Date(t0).toLocaleDateString([], { day: 'numeric', month: 'short' }) })
  }
  const within = (iso: string, t0: number, t1: number) => {
    const t = new Date(iso).getTime()
    return t >= t0 && t < t1
  }
  return {
    inHouse: days.map(({ label, t0, t1 }) => ({
      label,
      value: live.filter(
        (b) => b.kind !== 'day_rest' && b.status !== 'reserved' && new Date(b.start).getTime() < t1 && new Date(b.end).getTime() > t0,
      ).length,
    })),
    dayRest: days.map(({ label, t0, t1 }) => ({
      label,
      value: live.filter((b) => b.kind === 'day_rest' && within(b.start, t0, t1)).length,
    })),
    reservations: days.map(({ label, t0, t1 }) => ({
      label,
      value: live.filter((b) => b.kind === 'reservation' && within(b.created_at, t0, t1)).length,
    })),
  }
}

/** Change chip comparing this week's total against the previous week. */
function DeltaBadge({ diff }: { diff: number }) {
  if (!diff)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/12 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
        <Minus className="size-3" /> level
      </span>
    )
  const up = diff > 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        up ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300' : 'bg-rose-500/12 text-rose-600 dark:text-rose-300'
      }`}
    >
      <Icon className="size-3" /> {up ? '+' : ''}
      {diff} vs prior week
    </span>
  )
}

/** Smoothed SVG area chart for one trend series, with hover dots per day. */
function TrendChart({ points, stroke, id }: { points: TrendPoint[]; stroke: string; id: string }) {
  const max = Math.max(1, ...points.map((p) => p.value))
  const n = points.length
  const px = (i: number) => 2 + (i / (n - 1)) * 96
  const py = (v: number) => 92 - (v / max) * 82
  const pts = points.map((p, i) => [px(i), py(p.value)] as const)
  let line = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 1; i < n; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    const mx = ((x0 + x1) / 2).toFixed(2)
    line += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`
  }
  const area = `${line} L${pts[n - 1][0]},100 L${pts[0][0]},100 Z`
  return (
    <div className="relative h-24">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.3} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {points.map((p, i) => (
        <span
          key={i}
          title={`${p.label}: ${p.value}`}
          className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${px(i)}%`, top: `${py(p.value)}%`, backgroundColor: stroke }}
        />
      ))}
    </div>
  )
}

/** Front-desk client trends — a chart card per client category for the last two weeks.
 *  `links` are the section slugs each card opens — in-house, day rest, reservations. */
function ClientTrends({ t, basePath, links = ['guests-in-house/in-house', 'guests-in-house/day-rest', 'guests-in-house/reservations'] }: { t: WorkspaceTheme; basePath: string; links?: [string, string, string] }) {
  const bookings = useApi(recentBookings)
  const series = useMemo(() => buildTrends(bookings.data ?? []), [bookings.data])

  const cards: { label: string; hint: string; icon: LucideIcon; to: string; points: TrendPoint[]; stroke: string; look: string }[] = [
    {
      label: 'Guests in house',
      hint: 'stays covering each day',
      icon: Users,
      to: `${basePath}/${links[0]}`,
      points: series.inHouse,
      stroke: '#0ea5e9',
      look: 'bg-sky-500/12 text-sky-600 dark:text-sky-300',
    },
    {
      label: 'Day rest',
      hint: 'sessions each day',
      icon: Hourglass,
      to: `${basePath}/${links[1]}`,
      points: series.dayRest,
      stroke: '#8b5cf6',
      look: 'bg-violet-500/12 text-violet-600 dark:text-violet-300',
    },
    {
      label: 'Reservations',
      hint: 'booked each day',
      icon: CalendarCheck,
      to: `${basePath}/${links[2]}`,
      points: series.reservations,
      stroke: '#f59e0b',
      look: 'bg-amber-500/12 text-amber-600 dark:text-amber-300',
    },
  ]

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className={`text-base ${t.heading}`}>Client trends</h3>
          <p className={`mt-0.5 text-xs ${t.muted}`}>Daily client activity over the last {TREND_DAYS} days.</p>
        </div>
        {!bookings.data && <span className={`text-xs ${t.muted}`}>{bookings.error || 'Loading…'}</span>}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card, i) => {
          const total = card.points.reduce((n, p) => n + p.value, 0)
          const diff = card.points.slice(7).reduce((n, p) => n + p.value, 0) - card.points.slice(0, 7).reduce((n, p) => n + p.value, 0)
          return (
            <motion.div key={card.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05, duration: 0.4 }}>
              <Link
                to={card.to}
                className={`group flex h-full flex-col gap-4 p-5 transition-all duration-300 ${t.radius} ${t.card} ${t.cardHover}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${card.look}`}>
                      <card.icon className="size-4.5" />
                    </span>
                    <div className="min-w-0">
                      <p className={`truncate text-sm ${t.heading}`}>{card.label}</p>
                      <p className={`truncate text-[11px] ${t.muted}`}>{card.hint}</p>
                    </div>
                  </div>
                  <DeltaBadge diff={diff} />
                </div>
                <div className="flex items-end justify-between gap-2">
                  <p className={`text-3xl leading-none ${t.heading}`}>{bookings.data ? total : '—'}</p>
                  <p className={`text-[11px] ${t.muted}`}>last {TREND_DAYS} days</p>
                </div>
                <TrendChart points={card.points} stroke={card.stroke} id={`trend-fill-${i}`} />
                <div className={`flex justify-between text-[10px] ${t.muted}`}>
                  <span>{card.points[0]?.label}</span>
                  <span>{card.points[Math.floor(TREND_DAYS / 2)]?.label}</span>
                  <span>Today</span>
                </div>
              </Link>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}

/** Live room counts in the front desk hero — an occupied booking wins, then suspended rooms, then pending reservations. */
function FrontDeskRoomStats({ t, basePath }: { t: WorkspaceTheme; basePath: string }) {
  const rooms = useApi(bnb.rooms)
  const bookings = useApi(recentBookings)

  const counts = useMemo(() => {
    const live = (bookings.data ?? []).filter((b) => b.status === 'occupied' || b.status === 'reserved')
    const occupied = new Set(live.filter((b) => b.status === 'occupied').map((b) => b.room))
    const reserved = new Set(live.filter((b) => b.status === 'reserved').map((b) => b.room))
    const c = { available: 0, reserved: 0, occupied: 0, suspended: 0 }
    for (const r of rooms.data ?? []) {
      if (occupied.has(r.id)) c.occupied += 1
      else if (r.status !== 'active') c.suspended += 1
      else if (reserved.has(r.id)) c.reserved += 1
      else c.available += 1
    }
    return c
  }, [rooms.data, bookings.data])

  const ready = Boolean(rooms.data && bookings.data)
  const cards = [
    { label: 'Available', icon: BedDouble, value: counts.available, look: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300' },
    { label: 'Reserved', icon: CalendarCheck, value: counts.reserved, look: 'bg-amber-500/12 text-amber-600 dark:text-amber-300' },
    { label: 'Occupied', icon: Users, value: counts.occupied, look: 'bg-sky-500/12 text-sky-600 dark:text-sky-300' },
    { label: 'Suspended', icon: Ban, value: counts.suspended, look: 'bg-rose-500/12 text-rose-600 dark:text-rose-300' },
  ]

  return (
    <div className="relative mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <Link
          key={card.label}
          to={`${basePath}/room-availability`}
          className={`group flex items-center gap-3 px-4 py-3 transition ${t.radius} ${t.chip} ${t.cardHover}`}
        >
          <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${card.look}`}>
            <card.icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className={`text-xl leading-tight sm:text-2xl ${t.heading}`}>{ready ? card.value : '—'}</p>
            <p className={`truncate text-[11px] font-medium uppercase tracking-wider ${t.muted}`}>{card.label}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}

/** Popup fires this long before a stay's checkout time. */
const WARN_BEFORE_MS = 30 * 60_000

const sameDay = (iso: string, now: number) => {
  const a = new Date(iso), b = new Date(now)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/** Countdown to a checkout deadline: red once it passes, amber inside the warning window. */
function departCountdown(end: string, now: number): { text: string; tone: Tone } {
  const ms = new Date(end).getTime() - now
  if (ms <= 0) return { text: 'Due now', tone: 'red' }
  const mins = Math.ceil(ms / 60_000)
  if (mins < 60) return { text: `${mins} min left`, tone: 'amber' }
  const h = Math.floor(mins / 60), m = mins % 60
  return { text: m ? `${h}h ${m}m left` : `${h}h left`, tone: 'slate' }
}

/** Occupied stays ending today, soonest checkout first. */
const departuresToday = (bookings: Booking[], now: number) =>
  bookings.filter((b) => b.status === 'occupied' && sameDay(b.end, now)).sort((a, b) => a.end.localeCompare(b.end))

/** Short beep through the Web Audio API — ignored silently where autoplay is blocked. */
function chime(times = 1) {
  try {
    const ctx = new AudioContext()
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      const t0 = ctx.currentTime + i * 0.3
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.06, t0)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22)
      osc.start(t0)
      osc.stop(t0 + 0.22)
    }
    window.setTimeout(() => void ctx.close(), times * 300 + 500)
  } catch {
    // Audio is a nicety — the visual popup still shows without it.
  }
}

/** Receptionist landing section — every occupied stay ending today, with a live
 *  countdown and a shortcut into the guest's portal (where check-out happens).
 *  Sits on the same shared bookings fetch as the room stats and trends, so it
 *  adds no extra request. */
function DeparturesToday({ t, me, basePath }: { t: WorkspaceTheme; me: Employee; basePath: string }) {
  const now = useNow(15_000).getTime()
  const bookings = useApi(recentBookings)

  const list = useMemo(() => departuresToday(bookings.data ?? [], now), [bookings.data, now])

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className={`text-base ${t.heading}`}>Checking out today</h3>
          <p className={`mt-0.5 text-xs ${t.muted}`}>
            Guests whose stay ends today — a reminder pops up 30 minutes before and again when the time is due.
          </p>
        </div>
        <Link to={`${basePath}/guests-in-house/in-house`} className={`inline-flex items-center gap-1 text-xs font-semibold hover:underline ${t.accentText}`}>
          Guests in house <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
      <Panel t={t} className="mt-3" actions={
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold tabular-nums ${t.radius} ${t.chip}`}>
          <span className="size-1.5 rounded-full bg-amber-500" />
          {bookings.data ? list.length : '—'}
        </span>
      }>
        {!bookings.data && !bookings.error ? (
          <Loading t={t} rows={2} />
        ) : bookings.error ? (
          <p className={`py-6 text-center text-xs ${t.muted}`}>{bookings.error}</p>
        ) : !list.length ? (
          <Empty
            t={t}
            icon={CalendarCheck}
            title="No departures today"
            text="Nobody staying tonight is due to leave today. This list fills in as checkout day arrives."
          />
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {list.map((b, i) => {
                const left = departCountdown(b.end, now)
                const due = left.tone === 'red'
                return (
                  <motion.li
                    key={b.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ delay: Math.min(i, 10) * 0.03, duration: 0.25 }}
                    className={`flex flex-col gap-3 p-3 sm:flex-row sm:items-center ${t.radius} ${t.chip}`}
                  >
                    <Link
                      to={`${clientPath(me.role)}/${encodeURIComponent(clientKey(b))}`}
                      title={`Open ${b.guest_name}'s portal`}
                      className="group flex min-w-0 flex-1 items-center gap-3"
                    >
                      <span className={`grid size-10 shrink-0 place-items-center text-xs font-bold ${t.radius} ${t.iconBox}`}>
                        {initials(b.guest_name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold group-hover:underline">{b.guest_name}</p>
                        <p className={`truncate text-xs ${t.muted}`}>
                          <BedDouble className="mr-1 inline size-3" />{b.room_name}
                          {b.guest_phone && <><span className="mx-1.5">·</span><Phone className="mr-1 inline size-3" />{b.guest_phone}</>}
                        </p>
                      </div>
                    </Link>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Pill tone="slate"><Clock className="mr-1 inline size-3" />{fmtTime(b.end)}</Pill>
                      <Pill tone={left.tone}>
                        {due ? <AlarmClock className="mr-1 inline size-3" /> : <Hourglass className="mr-1 inline size-3" />}
                        {left.text}
                      </Pill>
                      <LinkButton
                        t={t}
                        to={`${clientPath(me.role)}/${encodeURIComponent(clientKey(b))}`}
                        title={`Open ${b.guest_name}'s portal — check out happens there`}
                      >
                        <ArrowUpRight className="size-3.5" /> Open portal
                      </LinkButton>
                    </div>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
        )}
      </Panel>
    </section>
  )
}

interface CheckoutAlert {
  /** `${bookingId}:${stage}` — also the key in `fired`, so it can't repeat. */
  key: string
  stage: 'warn' | 'due'
  booking: Booking
  mins: number
}

/** Front-desk checkout pop-ups — mounted for the receptionist on every page of
 *  their workspace. At 30 minutes to a stay's end an amber heads-up appears
 *  (self-dismissing); when the deadline hits, a red alert stays up until the
 *  receptionist closes it. */
function CheckoutAlerts({ t }: { t: WorkspaceTheme }) {
  const bookings = useApi(recentBookings)
  const now = useNow(15_000).getTime()
  const [alerts, setAlerts] = useState<CheckoutAlert[]>([])
  const fired = useRef(new Set<string>())

  // Keep the booking list fresh — new check-ins and check-outs land within a minute.
  useEffect(() => {
    const t = setInterval(bookings.reload, 60_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const live = (bookings.data ?? []).filter((b) => b.status === 'occupied')
    const liveIds = new Set(live.map((b) => b.id))
    const fresh: CheckoutAlert[] = []
    for (const b of live) {
      const ms = new Date(b.end).getTime() - now
      if (ms <= 0 && sameDay(b.end, now) && !fired.current.has(`${b.id}:due`)) {
        fired.current.add(`${b.id}:due`)
        fresh.push({ key: `${b.id}:due`, stage: 'due', booking: b, mins: 0 })
      } else if (ms > 0 && ms <= WARN_BEFORE_MS && !fired.current.has(`${b.id}:warn`)) {
        fired.current.add(`${b.id}:warn`)
        fresh.push({ key: `${b.id}:warn`, stage: 'warn', booking: b, mins: Math.max(1, Math.ceil(ms / 60_000)) })
      }
    }
    if (fresh.length) chime(fresh.some((a) => a.stage === 'due') ? 2 : 1)
    // Drop pop-ups for stays checked out elsewhere since the last refresh.
    setAlerts((l) => [...l.filter((a) => liveIds.has(a.booking.id)), ...fresh])
  }, [now, bookings.data])

  const dismiss = (key: string) => setAlerts((l) => l.filter((a) => a.key !== key))

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      <AnimatePresence initial={false}>
        {alerts.map((a) => (
          <CheckoutToast key={a.key} t={t} alert={a} onClose={() => dismiss(a.key)} />
        ))}
      </AnimatePresence>
    </div>
  )
}

/** One checkout pop-up card — amber reminder before the deadline, red at/after it. */
function CheckoutToast({ t, alert, onClose }: { t: WorkspaceTheme; alert: CheckoutAlert; onClose: () => void }) {
  const due = alert.stage === 'due'
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  // The reminder clears itself; the due alert stays until dismissed.
  useEffect(() => {
    if (due) return
    const timer = setTimeout(() => closeRef.current(), 20_000)
    return () => clearTimeout(timer)
  }, [due])

  return (
    <motion.div
      layout
      role="alert"
      initial={{ opacity: 0, x: 40, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.96 }}
      className={`pointer-events-auto flex items-start gap-3 p-4 shadow-xl ring-1 ${t.radius} ${t.root} ${due ? 'ring-rose-500/40' : 'ring-amber-500/40'}`}
    >
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${due ? 'bg-rose-500/12 text-rose-600 dark:text-rose-300' : 'bg-amber-500/12 text-amber-600 dark:text-amber-300'}`}>
        {due ? <AlarmClock className="size-5" /> : <BellRing className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${t.heading}`}>{due ? 'Checkout time due' : 'Checkout reminder'}</p>
        <p className={`mt-0.5 truncate text-xs font-medium`}>{alert.booking.guest_name} · {alert.booking.room_name}</p>
        <p className={`mt-0.5 text-xs ${due ? 'text-rose-500' : 'text-amber-600 dark:text-amber-300'}`}>
          {due
            ? `Was due at ${fmtTime(alert.booking.end)} — please check the guest out.`
            : `Has to check out in ${alert.mins} min — due at ${fmtTime(alert.booking.end)}.`}
        </p>
      </div>
      <button type="button" onClick={onClose} aria-label="Dismiss" className={`grid size-8 shrink-0 place-items-center ${t.radius} ${t.iconButton}`}>
        <X className="size-4" />
      </button>
    </motion.div>
  )
}

/** Compact branch details on the right of the workspace hero — the BnB branch they were allocated to. */
function BranchSummary({ t, user }: { t: WorkspaceTheme; user: Employee }) {
  const b = user.branch_detail
  if (!b) return null
  return (
    <div className={`flex shrink-0 items-center gap-4 border-t pt-5 xl:w-80 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0 ${t.sidebarDivider}`}>
      <span className={`relative grid size-14 shrink-0 place-items-center overflow-hidden ring-2 ${t.radius} ${t.ring} ${t.iconBox}`}>
        {b.photo ? <img src={b.photo} alt={b.name} className="size-full object-cover" /> : <Building2 className="size-7" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-[11px] font-medium uppercase tracking-wider ${t.muted}`}>Your branch</p>
        <h3 className={`mt-0.5 truncate text-lg ${t.heading}`}>{b.name}</h3>
        <p className={`mt-0.5 flex items-center gap-1.5 text-xs ${t.muted}`}>
          <MapPin className="size-3.5 shrink-0" /> <span className="truncate">{b.location}</span>
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px]">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 ${t.badge}`}>
            <Hash className="size-3" /> {b.code}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 ${t.chip}`}>
            <Phone className="size-3" /> {b.phone}
          </span>
          <span className={`inline-flex max-w-full items-center gap-1 truncate rounded-full px-2.5 py-0.5 ${t.chip}`}>
            <Mail className="size-3 shrink-0" /> <span className="truncate">{b.email}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

/** Shown on a branch worker's landing page when they haven't been allocated a BnB branch yet. */
function NoBranchNotice({ t }: { t: WorkspaceTheme }) {
  return (
    <section className={`flex flex-col items-center gap-3 p-6 text-center ${t.radius} ${t.card}`}>
      <span className={`grid size-12 place-items-center ${t.radius} ${t.iconBox}`}>
        <Building2 className="size-6" />
      </span>
      <p className={`text-base ${t.heading}`}>No branch allocated yet</p>
      <p className={`max-w-md text-sm ${t.muted}`}>
        Your account is active, but you haven't been assigned to a BnB branch. Your manager or IT support can allocate you from HR → Branch allocation.
      </p>
    </section>
  )
}

function ModuleOverview({ workspace, module, basePath }: { workspace: Workspace; module: NavItem; basePath: string }) {
  const t = workspace.theme
  const pages = (module.children ?? []).slice(1)
  return (
    <div className="space-y-6">
      <section className={`relative overflow-hidden p-5 sm:p-7 ${t.radius} ${t.card}`}>
        <div className={`pointer-events-none absolute -right-20 -top-24 size-72 rounded-full blur-2xl ${t.glowA}`} />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className={`grid size-16 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
            <module.icon className="size-7" />
          </span>
          <div className="min-w-0">
            <h2 className={`text-2xl sm:text-3xl ${t.heading}`}>{module.label}</h2>
            <p className={`mt-1 text-sm ${t.muted}`}>{module.children?.[0]?.description ?? module.description}</p>
          </div>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {pages.map((item, i) => (
          <motion.div key={item.slug} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05, duration: 0.4 }}>
            <Link
              to={`${basePath}/${module.slug}/${item.slug}`}
              className={`group flex h-full flex-col gap-4 p-5 transition-all duration-300 ${t.radius} ${t.card} ${t.cardHover}`}
            >
              <div className="flex items-start justify-between">
                <span className={`grid size-11 place-items-center ${t.radius} ${t.iconBox}`}>
                  <item.icon className="size-5" />
                </span>
                <ArrowUpRight className={`size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 ${t.muted}`} />
              </div>
              <div>
                <p className={`text-base ${t.heading}`}>{item.label}</p>
                <p className={`mt-1 text-sm ${t.muted}`}>{item.description}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function Section({ workspace, item }: { workspace: Workspace; item: NavItem }) {
  const t = workspace.theme
  return (
    <section className={`flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center ${t.radius} ${t.card}`}>
      <span className={`grid size-16 place-items-center ${t.radius} ${t.iconBox}`}>
        <item.icon className="size-7" />
      </span>
      <h2 className={`text-2xl ${t.heading}`}>{item.label}</h2>
      <p className={`max-w-md text-sm ${t.muted}`}>{item.description}</p>
      <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${t.badge}`}>
        <Construction className="size-3.5" /> Being built
      </span>
    </section>
  )
}

export default function RolePage() {
  const { user, logout } = useAuth()
  const { '*': sectionSlug = '' } = useParams()
  if (!user) return null
  const configured = WORKSPACES[user.role]
  /** A branch may pick a different theme per role (Branch settings → Company theme). */
  const workspace =
    user.branch_detail?.theme && THEMES[user.branch_detail.theme]
      ? { ...configured, theme: THEMES[user.branch_detail.theme] }
      : configured
  const basePath = rolePath(user.role)
  const [section, subSlug = ''] = sectionSlug.split('/')
  const top =
    section === PROFILE_ITEM.slug
      ? PROFILE_ITEM
      : [...workspace.nav, ...(workspace.accountNav ?? [])].find((n) => n.slug === section) ?? workspace.nav[0]
  const module = top.children?.length ? top : undefined
  const active = module ? module.children!.find((c) => c.slug === subSlug) ?? module.children![0] : top
  /** A client portal (…/clients/<key>, …/guest-history/<key>) is a destination
   *  of its own — the sidebar shows the portal's section anchors. Client keys
   *  are the only sub-slugs carrying a prefix (id:, ph:, em:, nm:). */
  const portal =
    !!module &&
    (module.slug === 'clients' || module.slug === 'guest-history') &&
    /^[a-z]+:/.test(subSlug)
  /** Account pages (profile, settings) sit outside the workspace nav — swap the sidebar links. */
  const account = !module && (top === PROFILE_ITEM || (workspace.accountNav ?? []).includes(top))
  /** Receptionist and manager sections are modules whose sidebar shows links unique to that page. */
  const recep = user.role === 'branch_receptionist' ? module : undefined
  const mgr = user.role === 'branch_manager' ? module : undefined
  const registerMode = REGISTER_MODES[active.slug] ?? 'reserve'

  /** Reservations and day rest moved under Guests in house — forward old URLs. */
  if (user.role === 'branch_receptionist' && (section === 'reservations' || section === 'day-rest'))
    return <Navigate to={`${basePath}/guests-in-house/${section}`} replace />

  /** Reports moved out of Accounts into their own section — forward old URLs. */
  if (user.role === 'branch_receptionist' && section === 'accounts' && subSlug in MOVED_REPORTS)
    return <Navigate to={`${basePath}/reports${MOVED_REPORTS[subSlug] ? `/${MOVED_REPORTS[subSlug]}` : ''}`} replace />

  let content
  if (module?.slug === 'hr' && HR_PAGE_SLUGS.includes(active.slug))
    content = <HrPage key={active.slug} item={active} t={workspace.theme} me={user} base={`${basePath}/hr`} />
  else if (module?.slug === 'bnb' && BNB_PAGE_SLUGS.includes(active.slug))
    content = <BnbPage key={active.slug} item={active} t={workspace.theme} me={user} base={`${basePath}/bnb`} />
  else if (module?.slug === 'check-in') content = <CheckInPage item={active} t={workspace.theme} />
  else if (recep?.slug === 'register-client') {
    const [dest, doneLabel] = REGISTER_DONE[registerMode]
    content = <RegisterClientPage key={active.slug} item={active} t={workspace.theme} me={user} mode={registerMode} back={`${basePath}/${dest}`} doneLabel={doneLabel} />
  } else if (recep?.slug === 'guests-in-house')
    content =
      active.slug === 'reservations' ? (
        <ReservationsPage item={active} t={workspace.theme} me={user} />
      ) : active.slug === 'day-rest' ? (
        <DayRestPage item={active} t={workspace.theme} me={user} />
      ) : active.slug === 'in-house' ? (
        <GuestsInHousePage item={active} t={workspace.theme} me={user} />
      ) : (
        <AllTransactionsPage item={active} t={workspace.theme} me={user} />
      )
  else if (recep?.slug === 'clients') content = <ClientsPage item={active} t={workspace.theme} me={user} base={`${basePath}/clients`} />
  else if (recep?.slug === 'referrals' || mgr?.slug === 'referrals') content = <ReferralsPage item={active} t={workspace.theme} me={user} />
  else if (mgr?.slug === 'guest-history') content = <ClientsPage item={active} t={workspace.theme} me={user} base={`${basePath}/guest-history`} />
  else if (recep?.slug === 'tickets' || mgr?.slug === 'tickets')
    content = <TicketsPage item={active} t={workspace.theme} me={user} view={active.slug === 'register' ? 'register' : 'list'} />
  else if (recep?.slug === 'room-availability') content = <RoomAvailabilityPage item={active} t={workspace.theme} me={user} />
  /** Receptionists don't clock in — the till page is their shift start/end. */
  else if (recep?.slug === 'till') content = <AccountsPage item={{ ...active, slug: 'counter' }} t={workspace.theme} me={user} />
  else if (recep?.slug === 'accounts') content = <AccountsPage item={active} t={workspace.theme} me={user} />
  else if (recep?.slug === 'reports') content = <ReportsPage item={active} t={workspace.theme} me={user} />
  else if (mgr?.slug === 'room-management')
    content = <RoomManagementPage item={active} t={workspace.theme} me={user} view={active.slug === 'register' ? 'register' : 'list'} />
  else if (mgr?.slug === 'extra-packages')
    content = <ExtraPackagesPage item={active} t={workspace.theme} me={user} view={active.slug === 'register' ? 'register' : 'list'} />
  else if (mgr?.slug === 'branch-settings' || (user.role === 'branch_manager' && active.slug === 'branch-settings'))
    content = <BranchSettingsPage item={active} t={workspace.theme} />
  else if (mgr?.slug === 'team-shifts')
    content = (
      <TeamShiftsPage
        item={active}
        t={workspace.theme}
        me={user}
        view={active.slug === 'register' ? 'register' : active.slug === 'tasks' ? 'tasks' : active.slug === 'pending-approval' ? 'pending' : 'list'}
      />
    )
  else if (mgr?.slug === 'branch-bookings')
    content =
      active.slug === 'new' ? (
        <RegisterClientPage item={active} t={workspace.theme} me={user} mode="reserve" back={`${basePath}/branch-bookings`} />
      ) : (
        <ReservationsPage item={active} t={workspace.theme} me={user} />
      )
  else if (user.role === 'admin' && module?.slug === 'branch-setup')
    content = <BranchSetupPage item={active} t={workspace.theme} me={user} />
  else if (module)
    content = active.slug
      ? <Section workspace={workspace} item={active} />
      : module.children && module.children.length > 1
        ? <ModuleOverview workspace={workspace} module={module} basePath={basePath} />
        : <Section workspace={workspace} item={module} />
  else content = active.slug ? <Section workspace={workspace} item={active} /> : <Overview workspace={workspace} user={user} basePath={basePath} />

  return (
    <WorkspaceLayout
      workspace={workspace} user={user} basePath={basePath}
      active={active} module={module} account={account}
      /** The main nav lives on the dashboard and module links on the module's
       *  landing page — inside a sub-page the sidebar shows only a back link.
       *  A client portal swaps in its own section anchors; reports keeps its
       *  link list visible on sub-pages — it's a switcher, not a
       *  single-purpose sub-page. Guest history's stay-type links are the
       *  same. */
      anchors={portal ? CLIENT_PORTAL_LINKS : undefined}
      hideLinks={
        !!module && !!subSlug &&
        (portal ||
          (module.slug === 'guest-history'
            ? !module.children!.some((c) => c.slug === subSlug)
            : module.slug !== 'reports'))
      }
      onLogout={logout}
    >
      <Suspense fallback={<div className="grid min-h-[40vh] place-items-center"><Loading t={workspace.theme} /></div>}>
        {content}
      </Suspense>
      {user.role === 'branch_receptionist' && <CheckoutAlerts t={workspace.theme} />}
    </WorkspaceLayout>
  )
}
