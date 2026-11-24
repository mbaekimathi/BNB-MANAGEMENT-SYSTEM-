import { AnimatePresence, motion } from 'framer-motion'
import { Ban, Banknote, BedDouble, Building2, CalendarCheck, CalendarClock, Check, ChevronDown, Clock, CreditCard, Globe, IdCard, Loader2, LogIn, LogOut, Mail, MessageSquare, Minus, Moon, Phone, Plus, RefreshCw, Search, User, Users, Wallet, X, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Empty, ErrorNote, Flash, Input, Loading, PageHeader, Panel, Pill, Row, Select, Stat, type Tone } from '../components/hr/ui'
import { PhoneInput } from '../components/hr/PhoneInput'
import { parseApiError, type Employee, type FieldErrors } from '../lib/api'
import { bnb, GUEST_ID_TYPES, PAYMENT_METHODS, type Booking, type BookingStatus, type GuestIdType, type PaymentMethod, type Room } from '../lib/bnb'
import { COUNTRIES } from '../lib/countries'
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

export default function ReservationsPage({ item, t, me }: { item: NavItem; t: WorkspaceTheme; me: Employee }) {
  const { data, error, loading, reload, setData } = useApi(bnb.bookings)
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
                <ul className="grid gap-2 xl:grid-cols-2">
                  <AnimatePresence initial={false}>
                    {upcomingList.map((b, i) => (
                      <ReserveRow
                        key={b.id} t={t} b={b} i={i} now={now} busy={busy === b.id}
                        onCheckin={() => void act(b, bnb.checkinBooking, `${b.guest_name} checked into ${b.room_name}.`)}
                        onCancel={() => void act(b, bnb.cancelBooking, `${b.guest_name}'s reservation was cancelled.`)}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </Panel>
          )}

          {history.length > 0 && (
            <Panel t={t} title="Recent history">
              <ul className="space-y-2">
                {history.filter(match).map((b, i) => (
                  <Row key={b.id} t={t} i={i}>
                    <GuestLine t={t} b={b} />
                    <Pill tone={STATUS_TONE[b.status]}>{b.status_label}</Pill>
                  </Row>
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}

    </div>
  )
}

/** Sidebar page for registering a client — the form lives in the page, not a dialog. */
export function RegisterClientPage({ item, t, me, back }: { item: NavItem; t: WorkspaceTheme; me: Employee; back: string }) {
  const { data } = useApi(bnb.bookings)
  const rooms = useApi(bnb.rooms)
  const navigate = useNavigate()
  const live = useMemo(() => (data ?? []).filter((b) => b.status === 'reserved' || b.status === 'occupied'), [data])

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
      ) : (
        <RegisterForm t={t} rooms={rooms.data ?? []} bookings={live} onDone={() => navigate(back)} />
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

function GuestLine({ t, b }: { t: WorkspaceTheme; b: Booking }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Avatar t={t} name={b.guest_name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{b.guest_name} · {b.room_name}</p>
        <p className={`truncate text-xs ${t.muted}`}>
          {fmtDT(b.start)} → {fmtDT(b.end)} · {b.nights} {b.nights === 1 ? 'night' : 'nights'}
        </p>
      </div>
      <div className={`hidden min-w-0 text-xs sm:block sm:w-44 ${t.muted}`}>
        <p className="truncate"><Phone className="mr-1 inline size-3" />{b.guest_phone}</p>
        <p className="truncate"><Users className="mr-1 inline size-3" />{b.guests} {b.guests === 1 ? 'guest' : 'guests'}{b.deposit ? ` · deposit ${formatMoney(b.deposit)}` : ''}</p>
      </div>
    </div>
  )
}

/** Upcoming reservation: initials, meta and a countdown to check-in. */
function ReserveRow({ t, b, i, busy, now, onCheckin, onCancel }: { t: WorkspaceTheme; b: Booking; i: number; busy: boolean; now: number; onCheckin: () => void; onCancel: () => void }) {
  const due = arriveIn(b.start, now)
  return (
    <Row t={t} i={i}>
      <div className="flex min-w-0 flex-1 gap-3">
        <Avatar t={t} name={b.guest_name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="truncate text-sm font-semibold">{b.guest_name}</p>
            <span className={`truncate text-xs ${t.muted}`}>· {b.room_name}</span>
          </div>
          <p className={`truncate text-xs ${t.muted}`}>
            <Phone className="mr-1 inline size-3" />{b.guest_phone}
            <span className="mx-1.5">·</span>
            <Users className="mr-1 inline size-3" />{b.guests} {b.guests === 1 ? 'guest' : 'guests'}
            {b.deposit ? <span className="mx-1.5">·</span> : ''}
            {b.deposit ? <><Wallet className="mr-1 inline size-3" />deposit {formatMoney(b.deposit)}</> : ''}
          </p>
          <p className={`truncate text-xs ${t.muted}`}>
            <CalendarClock className="mr-1 inline size-3" />{fmtD(b.start)} → {fmtD(b.end)} · {b.nights} {b.nights === 1 ? 'night' : 'nights'}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <Pill tone={due.tone}><CalendarCheck className="mr-1 inline size-3" />{due.text}</Pill>
        <div className="flex items-center gap-2">
          {busy && <Loader2 className="size-4 animate-spin" />}
          <Button t={t} busy={busy} onClick={onCheckin}>
            <LogIn className="size-3.5" /> Check in
          </Button>
          <Button t={t} variant="danger" disabled={busy} onClick={onCancel}>
            <Ban className="size-3.5" /> Cancel
          </Button>
        </div>
      </div>
    </Row>
  )
}

const blank = {
  guest_name: '', guest_phone: '', guest_email: '',
  guest_id_type: 'national_id' as GuestIdType, guest_id_number: '',
  guest_nationality: '', guest_notes: '',
  guests: '1', room: '',
  start: localDT(new Date()), days: '2',
  depositMode: 'no' as 'no' | 'yes', deposit: '',
}

/** Extra people on the booking — one of these per guest past the first. `type` is only a
 *  filter for the room dropdown; `room` empty means the guest shares the main room;
 *  `ownDates` off means they keep the booking's check-in and length of stay. */
type Companion = {
  name: string; phone: string; email: string
  id_type: GuestIdType; id_number: string; nationality: string; notes: string
  type: string; room: string
  ownDates: boolean; start: string; days: string
  more: boolean
}
const emptyCompanion = (): Companion => ({
  name: '', phone: '', email: '', id_type: 'national_id', id_number: '', nationality: '',
  notes: '', type: '', room: '', ownDates: false, start: localDT(new Date()), days: '',
  more: false,
})

/** One payment row — `guest` is the party position: '0' = main guest, 'n' = companion n-1. */
type PayRow = { guest: string; amount: string; method: PaymentMethod; reference: string }
const emptyPayment = (): PayRow => ({ guest: '0', amount: '', method: 'mpesa', reference: '' })

/** Numbered form section — the steps make the form read top-to-bottom. */
function Step({ t, n, title, text, children }: { t: WorkspaceTheme; n: number; title: string; text?: string; children: ReactNode }) {
  return (
    <Panel t={t}>
      <div className="mb-4 flex items-center gap-3">
        <span className={`grid size-7 shrink-0 place-items-center text-xs font-bold ${t.radius} ${t.iconBox}`}>{n}</span>
        <div className="min-w-0">
          <h3 className={`text-sm ${t.heading}`}>{title}</h3>
          {text && <p className={`mt-0.5 text-[11px] ${t.muted}`}>{text}</p>}
        </div>
      </div>
      {children}
    </Panel>
  )
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

function RegisterForm({ t, rooms, bookings, onDone }: { t: WorkspaceTheme; rooms: Room[]; bookings: Booking[]; onDone: () => void }) {
  const [mode, setMode] = useState<'reserve' | 'stay'>('reserve')
  const [form, setForm] = useState(() => ({ ...blank, start: localDT(new Date()) }))
  const [more, setMore] = useState(false)
  const [roomType, setRoomType] = useState('')
  const [companions, setCompanions] = useState<Companion[]>([])
  const [payments, setPayments] = useState<PayRow[]>([])
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  // Which guest's room/dates popup is open — -1 = the main guest, n = companion n.
  const [editing, setEditing] = useState<number | null>(null)

  useEffect(() => {
    if (editing === null) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setEditing(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing])

  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const put = (k: keyof typeof blank, v: string) => setForm((f) => ({ ...f, [k]: v }))

  // The party size drives how many extra-guest cards exist — guests-1 companions.
  const setGuests = (v: number) => {
    put('guests', String(v))
    setCompanions((cs) => {
      const need = Math.max(0, Math.min(30, v) - 1)
      return cs.length >= need ? cs.slice(0, need) : [...cs, ...Array.from({ length: need - cs.length }, emptyCompanion)]
    })
    setPayments((ps) => ps.filter((p) => Number(p.guest) < v))
  }
  const setC = <K extends keyof Companion>(i: number, k: K, v: Companion[K]) =>
    setCompanions((cs) => cs.map((c, j) => (j === i ? { ...c, [k]: v } : c)))
  const setP = (i: number, k: keyof PayRow, v: string) =>
    setPayments((ps) => ps.map((p, j) => (j === i ? { ...p, [k]: v } : p)))

  const guests = Math.min(30, Math.max(1, parseInt(form.guests, 10) || 1))
  const days = Math.max(1, parseInt(form.days, 10) || 1)
  const start = form.start ? new Date(form.start) : null
  const end = start ? new Date(start.getTime() + days * 86400000) : null
  const chosen = rooms.find((r) => r.id === Number(form.room))
  // Every room picked across the party bills per night — main room + companions' own rooms,
  // deduped since two companions can share one extra room.
  const pickedRooms = useMemo(() => {
    const list: Room[] = []
    for (const r of [chosen, ...companions.map((c) => rooms.find((r) => r.id === Number(c.room)))]) {
      if (r && !list.some((x) => x.id === r.id)) list.push(r)
    }
    return list
  }, [chosen, companions, rooms])

  // One grand total: each distinct room × its nights — companions with own dates bill
  // for their own length of stay (a shared room bills for the longest stay on it).
  const total = useMemo(() => {
    if (!pickedRooms.length) return null
    const perRoom = new Map<number, number>()
    if (chosen) perRoom.set(chosen.id, days)
    for (const c of companions) {
      const r = rooms.find((x) => x.id === Number(c.room))
      if (r) perRoom.set(r.id, Math.max(perRoom.get(r.id) ?? 0, cDates(c).d))
    }
    let sum = 0
    for (const [id, d] of perRoom) {
      const r = rooms.find((x) => x.id === id)
      if (r) sum += Number(r.price) * d
    }
    return sum
  }, [pickedRooms, chosen, companions, rooms, days]) // eslint-disable-line react-hooks/exhaustive-deps -- cDates derives from companions/days

  const paidTotal = payments.reduce((n, p) => n + (Number(p.amount) || 0), 0)

  // Quick fill: one payment row per guest, splitting the estimated total evenly.
  const splitEvenly = () => {
    if (total == null) return
    const cents = Math.round(total * 100)
    const base = Math.floor(cents / guests)
    setPayments(Array.from({ length: guests }, (_, i) => ({
      ...emptyPayment(),
      guest: String(i),
      amount: ((i === guests - 1 ? cents - base * (guests - 1) : base) / 100).toFixed(2),
    })))
  }

  // Room ids blocked by live bookings over a period — a room can't be booked over a live booking.
  const busyFor = (s: Date | null, e: Date | null) => {
    const taken = new Set<number>()
    if (s && e) {
      for (const b of bookings) {
        if (new Date(b.start) < e && new Date(b.end) > s) taken.add(b.room)
      }
    }
    return taken
  }
  const busyRooms = useMemo(
    () => busyFor(start, end),
    [bookings, form.start, days], // eslint-disable-line react-hooks/exhaustive-deps -- start/end derive from form.start+days
  )

  // A companion's effective stay — their own dates when set, else the booking's.
  const cDates = (c: Companion) => {
    const s = c.ownDates && c.start ? new Date(c.start) : start
    const d = c.ownDates ? Math.max(1, parseInt(c.days, 10) || days) : days
    return { s, e: s ? new Date(s.getTime() + d * 86400000) : null, d }
  }

  const usable = (r: Room) => r.status === 'active' && !busyRooms.has(r.id)

  // Room categories present at this branch — the picker filters by these.
  const roomTypes = useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of rooms) if (!seen.has(r.room_type)) seen.set(r.room_type, r.type_label)
    return [...seen.entries()].map(([value, label]) => ({ value, label }))
  }, [rooms])

  // Extra guest details stay open once anything is filled or rejected.
  const extras = !!(form.guest_email || form.guest_id_number || form.guest_nationality || form.guest_notes)
  const extraErrors = !!(errors.guest_email || errors.guest_id_number || errors.guest_nationality || errors.guest_notes)
  const showMore = more || extras || extraErrors

  const missing = [
    !form.guest_name.trim() && 'name',
    !form.guest_phone.trim() && 'phone',
    !chosen && 'room',
    companions.some((c) => !c.name.trim()) && 'each guest\'s name',
  ].filter(Boolean)

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!start || !end) return setErrors({ start: 'Pick the move-in date and time.' })
    if (!chosen) return setErrors({ room: 'Choose a room to continue.' })
    if (!usable(chosen)) return setErrors({ room: `${chosen.name} isn't free for that period — pick another.` })
    if (mode === 'reserve' && form.depositMode === 'yes' && !(Number(form.deposit) > 0)) {
      return setErrors({ deposit: 'Enter the deposit amount, or choose No deposit.' })
    }
    const unnamed = companions.findIndex((c) => !c.name.trim())
    if (unnamed >= 0) return setErrors({ companions: `Guest ${unnamed + 2} needs a name — every guest's details are collected.` })
    if (payments.some((p) => !(Number(p.amount) > 0))) {
      return setErrors({ payments: 'Enter an amount for each payment, or remove the empty rows.' })
    }
    setSaving(true)
    setErrors({})
    setMessage('')
    try {
      await bnb.registerBooking({
        room: Number(form.room),
        guest_name: form.guest_name,
        guest_phone: form.guest_phone,
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
        payments: payments.filter((p) => Number(p.amount) > 0).map((p) => ({
          guest: Number(p.guest),
          amount: Number(p.amount),
          method: p.method,
          reference: p.reference.trim(),
        })),
        guests,
        kind: mode === 'reserve' ? 'reservation' : 'stay',
        start: start.toISOString(),
        end: end.toISOString(),
        deposit: mode === 'reserve' && form.depositMode === 'yes' ? Number(form.deposit) : null,
      })
      onDone()
    } catch (err) {
      const { message, fields } = parseApiError(err)
      setErrors(fields)
      setMessage(message)
    } finally {
      setSaving(false)
    }
  }

  const modeCard = (m: 'reserve' | 'stay', icon: LucideIcon, title: string, text: string) => {
    const Icon = icon
    const sel = mode === m
    return (
      <button
        type="button" role="radio" aria-checked={sel} onClick={() => setMode(m)}
        className={`flex items-center gap-3 p-3 text-left transition ${t.radius} ${sel ? t.navActive : `${t.chip} ${t.cardHover}`}`}
      >
        <span className={`grid size-10 shrink-0 place-items-center ${t.radius} ${sel ? 'bg-white/15' : t.iconBox}`}>
          <Icon className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{title}</span>
          <span className={`block truncate text-[11px] ${sel ? 'opacity-75' : t.muted}`}>{text}</span>
        </span>
        {sel && <Check className="ml-auto size-4 shrink-0" />}
      </button>
    )
  }

  const line = (icon: LucideIcon, label: string, value: ReactNode) => {
    const Icon = icon
    return (
      <div className="flex items-baseline justify-between gap-4">
        <dt className={`flex shrink-0 items-center gap-1.5 text-xs ${t.muted}`}>
          <Icon className="size-3.5" />{label}
        </dt>
        <dd className="truncate text-right text-sm font-medium">{value}</dd>
      </div>
    )
  }

  const dFmt = (d: Date) => d.toLocaleDateString([], { day: 'numeric', month: 'short' })

  /** Photo-card room grid shared by the main guest's popup and each extra guest's.
   *  `note` adds a tail to the status line ("main room", "shared with guest 3"). */
  const roomGrid = (type: string, setType: (v: string) => void, sel: string, ok: (r: Room) => boolean, pick: (id: string) => void, note?: (r: Room) => string) => {
    const list = type ? rooms.filter((r) => r.room_type === type) : rooms
    return (
      <div className="flex min-w-0 flex-col gap-2">
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
          <p className={`px-3 py-2.5 text-xs ${t.radius} ${t.chip}`}>No rooms in this category.</p>
        ) : (
          <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2" role="radiogroup" aria-label="Room">
            {list.map((r) => {
              const free = ok(r)
              const selR = sel === String(r.id)
              const extra = note?.(r)
              return (
                <button
                  key={r.id} type="button" role="radio" aria-checked={selR} disabled={!free && !selR}
                  onClick={() => pick(String(r.id))}
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
                      {r.type_label} · {formatMoney(r.price)}/night · sleeps {r.capacity}
                    </span>
                    <span className={`mt-0.5 block truncate text-[10px] font-medium uppercase tracking-wide ${
                      free ? (selR ? 'opacity-80' : 'text-emerald-600 dark:text-emerald-400') : 'opacity-60'
                    }`}>
                      {free ? `Available${extra ? ` · ${extra}` : ''}` : extra ?? (r.status !== 'active' ? r.status_label : 'Booked for that period')}
                    </span>
                  </span>
                  {selR && <Check className="size-4 shrink-0" />}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  /** The room & dates strip at the foot of a guest's card — opens the allocate popup. */
  const stayRow = (k: number) => {
    const main = k < 0
    const c = main ? undefined : companions[k]
    const room = main ? chosen : rooms.find((r) => r.id === Number(c?.room))
    const { s, e, d } = main ? { s: start, e: end, d: days } : cDates(c!)
    const err = main ? errors.start || errors.days || errors.room : undefined
    return (
      <>
        <button
          type="button" onClick={() => setEditing(k)}
          className={`flex w-full items-center gap-3 border-t px-3 py-2.5 text-left transition hover:brightness-[0.98] dark:hover:brightness-110 ${t.sidebarDivider}`}
        >
          <span className={`grid size-8 shrink-0 place-items-center ${t.radius} ${room ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : t.iconBox}`}>
            <BedDouble className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-xs ${room ? 'font-semibold' : `font-medium ${t.muted}`}`}>
              {room ? `${room.name} · ${room.type_label}` : main ? 'Pick their room & dates' : `Shares ${chosen ? chosen.name : 'the main room'}`}
            </span>
            <span className={`block truncate text-[10px] ${t.muted}`}>
              {s && e ? `${dFmt(s)} → ${dFmt(e)} · ${d} ${d === 1 ? 'night' : 'nights'}` : 'Dates not set yet'}
            </span>
          </span>
          <span className={`flex shrink-0 items-center gap-1 text-[11px] font-semibold ${t.muted}`}>
            <CalendarClock className="size-3.5" />{room || !main ? 'Change' : 'Allocate'}
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
    const cOk = (r: Room) => r.status === 'active' && !cBusy.has(r.id) && r.id !== chosen?.id
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
                <p className={`text-xs ${t.muted}`}>{main ? 'The booking dates and the main room.' : 'Their room and when they stay.'}</p>
              </div>
            </div>
            <button type="button" onClick={() => setEditing(null)} aria-label="Close" className={`grid size-9 shrink-0 place-items-center ${t.radius} ${t.iconButton}`}>
              <X className="size-4" />
            </button>
          </header>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {main ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    t={t} label={mode === 'reserve' ? 'Moving in — date & time' : 'Check-in — date & time'}
                    type="datetime-local" value={form.start} onChange={set('start')} error={errors.start} required
                  />
                  <Stepper t={t} label="Length of stay" value={days} min={1} max={365} onChange={(v) => put('days', String(v))} error={errors.days} suffix={days === 1 ? 'night' : 'nights'} />
                </div>
                <div className={`flex items-center gap-2 px-3 py-2 text-xs ${t.radius} ${t.chip}`}>
                  <Clock className={`size-3.5 shrink-0 ${t.muted}`} />
                  {end ? (
                    <span>{mode === 'reserve' ? 'Reserved until' : 'Checks out'} <b>{end.toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</b> · {days} {days === 1 ? 'night' : 'nights'}</span>
                  ) : (
                    <span className={t.muted}>Pick the {mode === 'reserve' ? 'move-in' : 'check-in'} date to see the end date.</span>
                  )}
                </div>
                <section>
                  <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>Room</legend>
                  {roomGrid(roomType, setRoomType, form.room, usable, (id) => put('room', id))}
                  {errors.room && <span className="mt-1 block text-[11px] text-rose-500">{errors.room}</span>}
                </section>
              </>
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
                          if (v) { if (!c!.start) setC(editing, 'start', form.start); if (!c!.days) setC(editing, 'days', form.days) }
                        }}
                        className={`flex h-8 items-center justify-center gap-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${t.radius} ${c!.ownDates === v ? t.navActive : 'opacity-70 hover:opacity-100'}`}
                      >
                        {v ? 'Own dates' : 'Same as booking'}
                      </button>
                    ))}
                  </div>
                  {!c!.room && <span className={`text-[11px] ${t.muted}`}>They follow the booking dates while sharing the main room — pick a room below for own dates.</span>}
                </div>
                {c!.ownDates && c!.room && cStay && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input t={t} label="Check-in — date & time" type="datetime-local" value={c!.start} onChange={(e) => setC(editing, 'start', e.target.value)} />
                      <Stepper t={t} label="Length of stay" value={Math.max(1, parseInt(c!.days, 10) || days)} min={1} max={365} onChange={(v) => setC(editing, 'days', String(v))} suffix={Math.max(1, parseInt(c!.days, 10) || days) === 1 ? 'night' : 'nights'} />
                    </div>
                    {cStay.e && (
                      <div className={`flex items-center gap-2 px-3 py-2 text-xs ${t.radius} ${t.chip}`}>
                        <Clock className={`size-3.5 shrink-0 ${t.muted}`} />
                        <span>Checks out <b>{cStay.e.toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</b></span>
                      </div>
                    )}
                  </>
                )}
                <section>
                  <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>Their room</legend>
                  <div className="flex min-w-0 flex-col gap-2">
                    <button
                      type="button" role="radio" aria-checked={!c!.room}
                      onClick={() => { setC(editing, 'room', ''); setC(editing, 'ownDates', false) }}
                      className={`flex items-center gap-3 p-2.5 text-left transition ${t.radius} ${!c!.room ? t.navActive : `${t.chip} ${t.cardHover}`}`}
                    >
                      <span className={`grid size-12 shrink-0 place-items-center ${t.radius} ${!c!.room ? 'bg-white/15' : t.iconBox}`}>
                        <Users className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">Shares the main room{chosen ? ` · ${chosen.name}` : ''}</span>
                        <span className={`block truncate text-[11px] ${!c!.room ? 'opacity-75' : t.muted}`}>Follows the booking dates — nothing extra to pay</span>
                      </span>
                      {!c!.room && <Check className="size-4 shrink-0" />}
                    </button>
                    {roomGrid(
                      c!.type, (v) => setC(editing, 'type', v), c!.room, cOk, (id) => setC(editing, 'room', id),
                      (r) => r.id === chosen?.id ? 'Main room' : (() => { const j = companions.findIndex((o, x) => x !== editing && Number(o.room) === r.id); return j >= 0 ? `Shared with guest ${j + 2}` : '' })(),
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

  return (
    <form onSubmit={save} className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-5">
        <Step t={t} n={1} title="What are you doing?" text={mode === 'reserve' ? 'The room is held for the client\'s period.' : 'The room is marked occupied right away.'}>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Booking type">
            {modeCard('reserve', CalendarCheck, 'Reserve a room', 'Hold it for a future date')}
            {modeCard('stay', BedDouble, 'Check in now', 'Guest takes the room today')}
          </div>
        </Step>

        <Step t={t} n={2} title="Who's staying, when & where?" text="Add every person — each guest gets their own details, room and dates.">
          <div className="grid items-end gap-4 sm:grid-cols-2">
            <Stepper t={t} label="People in the party" value={guests} min={1} max={30} onChange={setGuests} error={errors.guests} suffix={guests === 1 ? 'guest' : 'guests'} />
            <p className={`hidden pb-2 text-[11px] leading-snug sm:block ${t.muted}`}>Every guest gets their own details — and a room &amp; dates strip at the foot of their card.</p>
          </div>

          <div className={`mt-4 overflow-hidden ${t.radius} ${t.chip}`}>
            <div className="grid gap-4 p-3 sm:grid-cols-2">
              <p className="flex items-center gap-2 text-xs font-semibold sm:col-span-2">
                <span className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${t.iconBox}`}>1</span>
                Guest 1 · main contact
              </p>
            <Input t={t} label="Full name" value={form.guest_name} onChange={set('guest_name')} error={errors.guest_name} placeholder="e.g. Jane Mwangi" autoComplete="off" required />
            <PhoneInput t={t} label="Phone number" value={form.guest_phone} onChange={(v) => put('guest_phone', v)} error={errors.guest_phone} required />
            <div className="sm:col-span-2">
              <button
                type="button" onClick={() => setMore((m) => !m)} aria-expanded={showMore}
                className={`flex items-center gap-1.5 text-xs font-semibold ${t.muted} transition hover:text-inherit`}
              >
                <ChevronDown className={`size-3.5 transition ${showMore ? 'rotate-180' : ''}`} />
                {showMore ? 'Hide extra details' : 'Add ID, email, nationality & requests'}
              </button>
              <AnimatePresence initial={false}>
                {showMore && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className={`mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2 ${t.sidebarDivider}`}>
                      <Input t={t} label="Email address" type="email" value={form.guest_email} onChange={set('guest_email')} error={errors.guest_email} placeholder="guest@example.com" autoComplete="off" />
                      <div>
                        <Input t={t} label="Nationality" list="guest-nationalities" value={form.guest_nationality} onChange={set('guest_nationality')} error={errors.guest_nationality} placeholder="e.g. Kenyan" autoComplete="off" />
                        <datalist id="guest-nationalities">
                          {COUNTRIES.map((c) => <option key={c.iso} value={c.name} />)}
                        </datalist>
                      </div>
                      <Select t={t} label="ID document" value={form.guest_id_type} onChange={(e) => put('guest_id_type', e.target.value)}>
                        {GUEST_ID_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </Select>
                      <Input t={t} label="ID / passport number" value={form.guest_id_number} onChange={set('guest_id_number')} error={errors.guest_id_number} placeholder="Document number" autoComplete="off" />
                      <div className="sm:col-span-2">
                        <Area t={t} label="Notes & special requests" value={form.guest_notes} onChange={set('guest_notes')} error={errors.guest_notes} placeholder="Allergies, late arrival, extra bed…" maxLength={500} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            </div>
            {stayRow(-1)}
          </div>

          {companions.map((c, i) => {
            const cMore = c.more || !!(c.email || c.nationality || c.id_number || c.notes)
            return (
              <div key={i} className={`mt-2 overflow-hidden ${t.radius} ${t.chip}`}>
                <div className="grid gap-4 p-3 sm:grid-cols-2">
                  <p className="flex items-center gap-2 text-xs font-semibold sm:col-span-2">
                    <span className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${t.iconBox}`}>{i + 2}</span>
                    Guest {i + 2}
                  </p>
                  <Input t={t} label="Full name" value={c.name} onChange={(e) => setC(i, 'name', e.target.value)} placeholder="e.g. John Mwangi" autoComplete="off" required />
                  <PhoneInput t={t} label="Phone number" value={c.phone} onChange={(v) => setC(i, 'phone', v)} />
                  <div className="sm:col-span-2">
                    <button
                      type="button" onClick={() => setC(i, 'more', !cMore)} aria-expanded={cMore}
                      className={`flex items-center gap-1.5 text-xs font-semibold ${t.muted} transition hover:text-inherit`}
                    >
                      <ChevronDown className={`size-3.5 transition ${cMore ? 'rotate-180' : ''}`} />
                      {cMore ? 'Hide extra details' : 'Add ID, email, nationality & requests'}
                    </button>
                    <AnimatePresence initial={false}>
                      {cMore && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className={`mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2 ${t.sidebarDivider}`}>
                            <Input t={t} label="Email address" type="email" value={c.email} onChange={(e) => setC(i, 'email', e.target.value)} placeholder="guest@example.com" autoComplete="off" />
                            <Input t={t} label="Nationality" list="guest-nationalities" value={c.nationality} onChange={(e) => setC(i, 'nationality', e.target.value)} placeholder="e.g. Kenyan" autoComplete="off" />
                            <Select t={t} label="ID document" value={c.id_type} onChange={(e) => setC(i, 'id_type', e.target.value as GuestIdType)}>
                              {GUEST_ID_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </Select>
                            <Input t={t} label="ID / passport number" value={c.id_number} onChange={(e) => setC(i, 'id_number', e.target.value)} placeholder="Document number" autoComplete="off" />
                            <div className="sm:col-span-2">
                              <Area t={t} label="Notes & special requests" value={c.notes} onChange={(e) => setC(i, 'notes', e.target.value)} placeholder="Allergies, late arrival, extra bed…" maxLength={500} />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                {stayRow(i)}
              </div>
            )
          })}
          {errors.companions && <p className="mt-2 text-[11px] text-rose-500">{errors.companions}</p>}
        </Step>

        <Step t={t} n={3} title={mode === 'reserve' ? 'Deposit & payments' : 'Payments'} text="Optional — record money received now: who paid, how much and how.">
          {mode === 'reserve' && (
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1">
                <span className={`text-[11px] font-medium ${t.muted}`}>Deposit taken?</span>
                <div className={`grid grid-cols-2 gap-1 p-1 ${t.radius} ${t.chip}`} role="radiogroup" aria-label="Deposit taken">
                  {(['no', 'yes'] as const).map((v) => (
                    <button
                      key={v} type="button" role="radio" aria-checked={form.depositMode === v}
                      onClick={() => put('depositMode', v)}
                      className={`flex h-8 items-center justify-center gap-1.5 text-xs font-semibold transition ${t.radius} ${form.depositMode === v ? t.navActive : 'opacity-70 hover:opacity-100'}`}
                    >
                      {v === 'no' ? 'No deposit' : 'Deposit paid'}
                    </button>
                  ))}
                </div>
              </div>
              {form.depositMode === 'yes' && (
                <Input
                  t={t} label="Deposit amount (KES)" type="number" inputMode="decimal" min={0} step="0.01"
                  value={form.deposit} onChange={set('deposit')} error={errors.deposit} required autoFocus
                />
              )}
            </div>
          )}

          <div className="space-y-2">
            {payments.map((p, i) => (
              <div key={i} className={`grid items-end gap-3 p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,9rem)_7rem_8rem_1fr_auto] ${t.radius} ${t.chip}`}>
                <Select t={t} label="Paid by" value={p.guest} onChange={(e) => setP(i, 'guest', e.target.value)}>
                  <option value="0">Guest 1{form.guest_name.trim() ? ` · ${form.guest_name.trim()}` : ''}</option>
                  {companions.map((c, j) => (
                    <option key={j} value={j + 1}>Guest {j + 2}{c.name.trim() ? ` · ${c.name.trim()}` : ''}</option>
                  ))}
                </Select>
                <Input t={t} label="Amount (KES)" type="number" inputMode="decimal" min={0} step="0.01" value={p.amount} onChange={(e) => setP(i, 'amount', e.target.value)} />
                <Select t={t} label="Method" value={p.method} onChange={(e) => setP(i, 'method', e.target.value)}>
                  {PAYMENT_METHODS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
                <Input t={t} label="Reference" value={p.reference} onChange={(e) => setP(i, 'reference', e.target.value)} placeholder="M-Pesa code, receipt…" autoComplete="off" />
                <button
                  type="button" aria-label="Remove payment" onClick={() => setPayments((ps) => ps.filter((_, j) => j !== i))}
                  className={`grid size-10 place-items-center self-end transition hover:brightness-95 dark:hover:brightness-125 ${t.radius} ${t.chip} ${t.muted}`}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <Button t={t} variant="ghost" onClick={() => setPayments((ps) => [...ps, emptyPayment()])}>
                <Plus className="size-3.5" /> Add a payment
              </Button>
              {total != null && guests > 1 && (
                <Button t={t} variant="ghost" onClick={splitEvenly}>Split evenly × {guests}</Button>
              )}
              {paidTotal > 0 && (
                <span className={`ml-auto text-xs ${t.muted}`}>
                  Recorded <b>{formatMoney(paidTotal)}</b>
                  {total != null ? ` · balance ${formatMoney(Math.max(0, total - paidTotal))}` : ''}
                </span>
              )}
            </div>
          </div>
          {errors.payments && <p className="mt-2 text-[11px] text-rose-500">{errors.payments}</p>}
        </Step>
      </div>

      <Panel t={t} title="Booking summary" className="lg:sticky lg:top-24">
        <dl className="space-y-2.5">
          {line(mode === 'reserve' ? CalendarCheck : BedDouble, 'Type', mode === 'reserve' ? 'Reservation' : 'Check-in')}
          {line(User, 'Guest', form.guest_name || '—')}
          {line(Phone, 'Phone', form.guest_phone || '—')}
          {form.guest_email.trim() && line(Mail, 'Email', form.guest_email)}
          {form.guest_id_number.trim() && line(IdCard, 'ID', `${GUEST_ID_TYPES.find((o) => o.value === form.guest_id_type)?.label ?? 'ID'} · ${form.guest_id_number}`)}
          {form.guest_nationality.trim() && line(Globe, 'Nationality', form.guest_nationality)}
          {form.guest_notes.trim() && line(MessageSquare, 'Notes', form.guest_notes)}
          {line(Users, 'Guests', guests)}
          {line(BedDouble, 'Room', chosen ? `${chosen.name} · ${chosen.type_label}` : '—')}
          {line(LogIn, mode === 'reserve' ? 'Moving in' : 'Check-in', start ? fmtDT(start.toISOString()) : '—')}
          {line(LogOut, 'Checks out', end ? fmtDT(end.toISOString()) : '—')}
          {line(Moon, 'Nights', days)}
          {line(Banknote, 'Rate / night', pickedRooms.length ? formatMoney(pickedRooms.reduce((n, r) => n + Number(r.price), 0)) : '—')}
          {mode === 'reserve' && form.depositMode === 'yes' && line(Wallet, 'Deposit', form.deposit ? formatMoney(form.deposit) : '—')}
          {paidTotal > 0 && line(CreditCard, 'Paid', `${formatMoney(paidTotal)} · ${payments.filter((p) => Number(p.amount) > 0).length} ${payments.filter((p) => Number(p.amount) > 0).length === 1 ? 'payment' : 'payments'}`)}
          {paidTotal > 0 && total != null && line(Banknote, 'Balance', formatMoney(Math.max(0, total - paidTotal)))}
        </dl>
        {pickedRooms.length > 0 && (
          <div className={`mt-3 space-y-1.5 border-t pt-3 ${t.sidebarDivider}`}>
            {pickedRooms.map((r) => {
              const occupants = [
                r.id === chosen?.id ? form.guest_name.trim() || 'Guest 1' : null,
                ...companions.map((c, j) =>
                  (r.id === chosen?.id ? !c.room : Number(c.room) === r.id) ? c.name.trim() || `Guest ${j + 2}` : null
                ),
              ].filter(Boolean)
              return (
                <p key={r.id} className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="shrink-0 font-semibold">{r.name}</span>
                  <span className={`truncate ${t.muted}`}>{occupants.join(', ')}</span>
                </p>
              )
            })}
          </div>
        )}
        <div className={`mt-4 flex items-baseline justify-between gap-4 px-3 py-3 ${t.radius} ${t.chip}`}>
          <span className="text-xs font-semibold">Estimated total</span>
          <span className={`text-lg ${t.heading}`}>{total != null ? formatMoney(total) : '—'}</span>
        </div>
        <div className="mt-3"><Flash message={message} tone="red" /></div>
        <div className="mt-4 flex flex-col gap-2">
          <Button t={t} type="submit" busy={saving} className="h-11 w-full text-sm">
            {mode === 'reserve' ? <><CalendarCheck className="size-4" /> Reserve room</> : <><LogIn className="size-4" /> Check in guest</>}
          </Button>
          <Button t={t} variant="ghost" onClick={onDone} className="w-full">Back to reservations</Button>
        </div>
        {missing.length > 0 && (
          <p className={`mt-3 text-[11px] ${t.muted}`}>Still needed: {missing.join(', ')}</p>
        )}
      </Panel>
      <AnimatePresence>{stayDialog()}</AnimatePresence>
    </form>
  )
}
