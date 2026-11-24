import { AnimatePresence } from 'framer-motion'
import { AlarmClock, BedDouble, Building2, CalendarClock, Clock, Globe, IdCard, Loader2, LogOut, Mail, MessageSquare, Phone, RefreshCw, Search, Users, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, Empty, ErrorNote, Flash, Loading, PageHeader, Panel, Pill, Row, Stat, type Tone } from '../components/hr/ui'
import { parseApiError, type Employee } from '../lib/api'
import { bnb, type Booking } from '../lib/bnb'
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
  const { data, error, loading, reload, setData } = useApi(bnb.bookings)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(0)
  const [flash, setFlash] = useState({ text: '', bad: false })
  const now = useNow(30_000).getTime()

  const inHouse = useMemo(
    () => (data ?? []).filter((b) => b.status === 'occupied').sort((a, b) => a.end.localeCompare(b.end)),
    [data],
  )
  const match = (b: Booking) => !q || `${b.guest_name} ${b.room_name} ${b.guest_phone} ${b.guest_email} ${b.guest_id_number} ${(b.companions ?? []).map((c) => `${c.name} ${c.id_number} ${c.phone} ${c.email}`).join(' ')}`.toLowerCase().includes(q.toLowerCase())
  const list = inHouse.filter(match)
  const leavingToday = inHouse.filter((b) => sameDay(b.end, now)).length
  const overdue = inHouse.filter((b) => new Date(b.end).getTime() < now).length

  async function checkout(b: Booking) {
    setBusy(b.id)
    setFlash({ text: '', bad: false })
    try {
      const next = await bnb.checkoutBooking(b.id)
      setData((l) => l?.map((x) => (x.id === b.id ? next : x)) ?? null)
      setFlash({ text: `${b.guest_name} checked out of ${b.room_name}.`, bad: false })
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

          <Flash message={flash.text} tone={flash.bad ? 'red' : 'green'} />

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
                <ul className="grid gap-2 xl:grid-cols-2">
                  <AnimatePresence initial={false}>
                    {list.map((b, i) => (
                      <GuestCard key={b.id} t={t} b={b} i={i} now={now} busy={busy === b.id} onCheckout={() => void checkout(b)} />
                    ))}
                  </AnimatePresence>
                </ul>
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

/** In-house guest card: initials, meta, live stay progress and checkout countdown. */
function GuestCard({ t, b, i, now, busy, onCheckout }: { t: WorkspaceTheme; b: Booking; i: number; now: number; busy: boolean; onCheckout: () => void }) {
  const left = timeLeft(b.end, now)
  const isOverdue = left.tone === 'red'
  const pct = stayProgress(b, now)
  return (
    <Row t={t} i={i}>
      <div className="flex min-w-0 flex-1 gap-3">
        <span className={`grid size-11 shrink-0 place-items-center text-sm font-bold ${t.radius} ${t.iconBox}`}>
          {initials(b.guest_name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="truncate text-sm font-semibold">{b.guest_name}</p>
            <span className={`truncate text-xs ${t.muted}`}>· {b.room_name}</span>
          </div>
          <p className={`truncate text-xs ${t.muted}`}>
            <Phone className="mr-1 inline size-3" />{b.guest_phone}
            <span className="mx-1.5">·</span>
            <Users className="mr-1 inline size-3" />{b.guests} {b.guests === 1 ? 'guest' : 'guests'}
            {(b.companions?.length ?? 0) > 0 && <span className="mx-1.5">·</span>}
            {(b.companions?.length ?? 0) > 0 && <>with {b.companions.map((c) => (c.room_name ? `${c.name} · ${c.room_name}` : c.name)).join(', ')}</>}
            {b.deposit ? <span className="mx-1.5">·</span> : ''}
            {b.deposit ? <><Wallet className="mr-1 inline size-3" />deposit {formatMoney(b.deposit)}</> : ''}
          </p>
          <p className={`truncate text-xs ${t.muted}`}>
            <CalendarClock className="mr-1 inline size-3" />{fmtD(b.start)} → {fmtD(b.end)} · {b.nights} {b.nights === 1 ? 'night' : 'nights'}
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
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10">
              <div
                className={`h-full rounded-full transition-[width] duration-1000 ${isOverdue ? 'bg-rose-500' : t.brandMark}`}
                style={{ width: `${isOverdue ? 100 : pct}%` }}
              />
            </div>
            <span className={`shrink-0 text-[10px] tabular-nums ${isOverdue ? 'font-semibold text-rose-500' : t.muted}`}>
              {isOverdue ? 'overdue' : `${Math.round(pct)}% of stay`}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <Pill tone={left.tone}><Clock className="mr-1 inline size-3" />{left.text}</Pill>
        <div className="flex items-center gap-2">
          {busy && <Loader2 className="size-4 animate-spin" />}
          <Button t={t} variant="ghost" busy={busy} onClick={onCheckout}>
            <LogOut className="size-3.5" /> Check out
          </Button>
        </div>
      </div>
    </Row>
  )
}
