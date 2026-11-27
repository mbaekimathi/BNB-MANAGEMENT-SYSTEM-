import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft, ArrowLeftRight, ArrowUpRight, Ban, Banknote, BedDouble, Building2, CalendarClock,
  CalendarMinus, CalendarPlus, Check, ChevronDown, Contact, Ellipsis, Globe, History, IdCard,
  LogOut, Mail, MessageSquare, Minus, Moon, Package, PackagePlus, Pencil, Phone, Plus, Printer, Receipt,
  RefreshCw, Search, Ticket, TrendingDown, TrendingUp, Users, Wallet, X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Button, Empty, ErrorNote, Flash, Input, Loading, PageHeader, Panel, Pill, Select, Stat, Textarea, type Tone } from '../components/hr/ui'
import { EmailInput } from '../components/hr/EmailInput'
import { NatIdInput } from '../components/hr/NationalityInput'
import { PhoneInput } from '../components/hr/PhoneInput'
import { parseApiError, type Employee } from '../lib/api'
import {
  GUEST_ID_TYPES, PAYMENT_METHODS, bnb, stayLength,
  type AddPackageResult, type Booking, type BookingStatus, type CancelSettle, type ClientProfileResult,
  type ClientRow, type ExtraPackage, type GuestIdType, type PaymentMethod, type PayResult,
  type Room, type RoomChangeOption, type RoomChangeResult, type Voucher,
} from '../lib/bnb'
import { phoneComplete } from '../lib/countries'
import { formatDate, formatMoney, thisMonth, todayISO, useApi } from '../lib/hr'
import { depositPayment, printPaymentReceipt, receiptPayment, type ReceiptPayment } from './receiptDoc'
import { useNow } from '../lib/time'
import type { NavItem, WorkspaceTheme } from '../lib/workspaces'

const STATUS_TONE: Record<BookingStatus, Tone> = { reserved: 'amber', occupied: 'blue', completed: 'slate', cancelled: 'red' }

const fmtD = (iso: string) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' })
const fmtDT = (iso: string) =>
  new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
/** `datetime-local` value for a Date, in the browser's timezone. */
const localDT = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

const idLabel = (t: GuestIdType | '') => GUEST_ID_TYPES.find((x) => x.value === t)?.label ?? 'ID'

interface Txn {
  id: string
  date: string
  kind: string
  detail: string
  ref: string
  payer: string
  amount: number
  /** The receipt's source — a reprint renders the booking plus this transaction. */
  src?: { b: Booking; p: ReceiptPayment }
}

/** Stay-type filters living as sidebar links under the manager's Guest
 *  history. Client keys always carry an id:/ph:/em:/nm: prefix, so these
 *  slugs can never collide with a portal URL. */
const GUEST_FILTERS = ['reservations', 'in-house', 'day-rest'] as const
type GuestFilter = (typeof GUEST_FILTERS)[number]

const GUEST_FILTER_EMPTY: Record<GuestFilter, [title: string, text: string]> = {
  reservations: ['No upcoming reservations', 'Clients with a booking waiting for check-in will appear here.'],
  'in-house': ['Nobody is in house', 'Clients checked in at the branch will appear here.'],
  'day-rest': ['No day-rest guests', 'Clients who booked a day rest will appear here.'],
}

type RangeMode = 'all' | 'day' | 'period' | 'month' | 'year'

const RANGE_MODES: { value: RangeMode; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'day', label: 'Day' },
  { value: 'period', label: 'Period' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]

const d0 = (iso: string) => new Date(`${iso}T00:00`).getTime()

export default function ClientsPage({ item, t, me, base }: { item: NavItem; t: WorkspaceTheme; me: Employee; base: string }) {
  const rooms = useApi(bnb.rooms)
  const [q, setQ] = useState('')
  const [mode, setMode] = useState<RangeMode>('all')
  const [day, setDay] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')
  const nav = useNavigate()
  const { '*': rest = '' } = useParams()
  const section = base.split('/').pop() ?? 'clients'
  const rawKey = rest.startsWith(`${section}/`) ? rest.slice(section.length + 1) : ''
  const filter: GuestFilter | '' = (GUEST_FILTERS as readonly string[]).includes(rawKey) ? (rawKey as GuestFilter) : ''
  const selKey = filter ? '' : rawKey
  const curYear = useNow(60_000).getFullYear()

  /** Switching modes pre-fills sensible defaults so the filter applies right away. */
  const pick = (m: RangeMode) => {
    setMode(m)
    if (m === 'day' && !day) setDay(todayISO())
    if (m === 'month' && !month) setMonth(thisMonth())
    if (m === 'year' && !year) setYear(String(curYear))
  }

  // The server's bill counts every booked room and any extra packages sold —
  // the local n × rate shortcut misses both.
  const charge = (b: Booking) => Number(b.bill)

  /** [start, end) in ms for the picked filter, or null for All time / incomplete input. */
  const range = useMemo<[number, number] | null>(() => {
    if (mode === 'day' && day) return [d0(day), d0(day) + 86400000]
    if (mode === 'period' && from && to) return [Math.min(d0(from), d0(to)), Math.max(d0(from), d0(to)) + 86400000]
    if (mode === 'month' && month) {
      const s = d0(`${month}-01`)
      const d = new Date(s)
      return [s, new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()]
    }
    if (mode === 'year' && year) return [new Date(Number(year), 0, 1).getTime(), new Date(Number(year) + 1, 0, 1).getTime()]
    return null
  }, [mode, day, from, to, month, year])

  /** The server returns clients already grouped + ranged — the table never
   *  loads the booking ledger, whatever its size. */
  const params = range ? { from: new Date(range[0]).toISOString(), to: new Date(range[1]).toISOString() } : {}
  const { data, error, loading, reload } = useApi(() => bnb.clientRollup(params), [params.from, params.to])

  const clients = data?.clients ?? []
  const selected = clients.find((c) => c.key === selKey)
  const ranged = clients.filter((c) => c.in_range)
  const years = useMemo(() => (data?.years.length ? data.years : [curYear]), [data, curYear])

  const scoped = ranged.filter((c) =>
    filter === 'reservations' ? c.has_reservation : filter === 'in-house' ? c.in_house : filter === 'day-rest' ? c.has_day_rest : true,
  )
  const match = (c: ClientRow) =>
    !q || `${c.name} ${c.phone} ${c.email} ${c.id_number} ${c.nationality}`.toLowerCase().includes(q.toLowerCase())
  const list = scoped.filter(match)
  const th = `px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider ${t.muted}`
  const thc = `px-3 py-2.5 text-center text-[11px] font-medium uppercase tracking-wider ${t.muted}`

  if (!me.branch) {
    return (
      <div className="space-y-5">
        <PageHeader t={t} icon={item.icon} title={item.label} text={item.description} />
        <Panel t={t}>
          <Empty
            t={t}
            icon={Building2}
            title="No branch allocated yet"
            text="Your account isn't assigned to a BnB branch, so there are no clients to show. Ask your manager or IT support to allocate you."
          />
        </Panel>
      </div>
    )
  }

  if (selKey) {
    return (
      <div className="space-y-5">
        {!selected ? (
          <Panel t={t}>
            {loading ? (
              <Loading t={t} />
            ) : (
              <Empty
                t={t}
                icon={Contact}
                title="Client not found"
                text="This client link doesn't match anyone who has booked at this branch."
              />
            )}
            <div className="mt-2 flex justify-center">
              <Link to={base}>
                <Button t={t} variant="ghost"><ArrowLeft className="size-3.5" /> All clients</Button>
              </Link>
            </div>
          </Panel>
        ) : (
          <ClientPortal t={t} c={selected} base={base} charge={charge} th={th} rooms={rooms.data ?? []} me={me} onChanged={reload} />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        t={t}
        icon={item.icon}
        title={item.label}
        text={item.description}
        actions={
          <Button t={t} variant="ghost" onClick={() => { reload(); rooms.reload() }}>
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat t={t} i={0} icon={Contact} label="Clients" value={data ? scoped.length : '—'} />
        <Stat t={t} i={1} icon={Users} label="Repeat clients" value={data ? scoped.filter((c) => c.stays > 1).length : '—'} />
        <Stat t={t} i={2} icon={BedDouble} label="In house now" value={data ? scoped.filter((c) => c.in_house).length : '—'} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className={`pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 ${t.muted}`} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, phone, email or ID"
            className={`h-10 w-full bg-transparent pl-9 pr-3 text-sm outline-none focus:ring-2 ${t.radius} ${t.chip} ${t.ring}`}
          />
        </div>
        <div className="flex flex-wrap items-end gap-2 lg:ml-auto">
          <div className="w-32">
            <Select t={t} label="Visits" value={mode} onChange={(e) => pick(e.target.value as RangeMode)}>
              {RANGE_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </Select>
          </div>
          {mode === 'day' && (
            <div className="w-40">
              <Input t={t} label="Day" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            </div>
          )}
          {mode === 'period' && (
            <>
              <div className="w-40">
                <Input t={t} label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="w-40">
                <Input t={t} label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </>
          )}
          {mode === 'month' && (
            <div className="w-40">
              <Input t={t} label="Month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
          )}
          {mode === 'year' && (
            <div className="w-28">
              <Select t={t} label="Year" value={year} onChange={(e) => setYear(e.target.value)}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </Select>
            </div>
          )}
        </div>
      </div>

      {error || rooms.error ? (
        <ErrorNote t={t} message={error || rooms.error} onRetry={() => { reload(); rooms.reload() }} />
      ) : loading && !data ? (
        <Panel t={t}><Loading t={t} /></Panel>
      ) : (
        <Panel t={t} title={filter ? item.label : 'Clients'} actions={<Pill tone="blue">{list.length}</Pill>}>
          {!list.length ? (
            <Empty
              t={t}
              icon={Contact}
              title={
                scoped.length
                  ? 'No clients match your search'
                  : filter
                    ? GUEST_FILTER_EMPTY[filter][0]
                    : clients.length
                      ? 'No visits in this period'
                      : 'No clients yet'
              }
              text={
                scoped.length
                  ? 'Try a different search.'
                  : filter
                    ? GUEST_FILTER_EMPTY[filter][1]
                    : clients.length
                      ? 'Pick a different range or switch back to All time.'
                      : 'Guests registered from Reservations or Register client will appear here.'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="rtable w-full min-w-[40rem] table-fixed border-collapse">
                <thead>
                  <tr className={`border-b ${t.sidebarDivider}`}>
                    <th className={`w-[30%] ${th}`}>Client</th>
                    <th className={`w-[26%] ${th}`}>Contact</th>
                    <th className={`w-[18%] ${th}`}>ID</th>
                    <th className={`w-16 ${thc}`}>Visits</th>
                    <th className={th}>Last visit</th>
                    <th className={`w-10 ${th}`}><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((c, i) => (
                    <motion.tr
                      key={c.key}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 10) * 0.03, duration: 0.25 }}
                      onClick={() => nav(`${base}/${encodeURIComponent(c.key)}`)}
                      className={`cursor-pointer border-b transition-colors last:border-b-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] ${t.sidebarDivider}`}
                    >
                      <td className="max-w-0 px-3 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={`grid size-9 shrink-0 place-items-center text-xs font-bold ${t.radius} ${t.iconBox}`}>
                            {initials(c.name)}
                          </span>
                          <div className="min-w-0">
                            <Link
                              to={`${base}/${encodeURIComponent(c.key)}`}
                              onClick={(e) => e.stopPropagation()}
                              className="block truncate text-sm font-semibold hover:underline"
                            >
                              {c.name}
                            </Link>
                            {(c.in_house || c.stays > 1 || c.suspended) && (
                              <p className="mt-1 flex gap-1">
                                {c.in_house && <Pill tone="blue">In house</Pill>}
                                {c.suspended && <Pill tone="red">Suspended</Pill>}
                                {!c.in_house && c.stays > 1 && <Pill tone="green">Repeat</Pill>}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top text-xs">
                        <p><Phone className="mr-1 inline size-3" />{c.phone || '—'}</p>
                        {c.email && <p className={`mt-0.5 break-all ${t.muted}`}><Mail className="mr-1 inline size-3" />{c.email}</p>}
                      </td>
                      <td className={`px-3 py-3 align-top text-xs ${t.muted}`}>
                        {c.id_number ? `${idLabel(c.id_type)} ${c.id_number}` : '—'}
                      </td>
                      <td className="px-3 py-3 align-top text-center">
                        <span className="text-sm font-semibold tabular-nums">{c.visits}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 align-top text-xs font-medium">{formatDate(c.last_visit)}</td>
                      <td className="px-3 py-3 align-top"><ArrowUpRight className={`size-4 ${t.muted}`} /></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </div>
  )
}

/** A client's portal: full profile, money ledger and every stay at this branch.
 *  The row comes from the rollup; the booking ledger loads only for this client.
 *  This is the only place a guest can be checked out — the boards link here. */
function ClientPortal({ t, c, base, charge, th, rooms, me, onChanged }: { t: WorkspaceTheme; c: ClientRow; base: string; charge: (b: Booking) => number; th: string; rooms: Room[]; me: Employee; onChanged?: () => void }) {
  const { data: bookings, loading, setData } = useApi(() => bnb.bookings({ client: c.key, limit: 500 }), [c.key])
  const [busy, setBusy] = useState(0)
  const [moving, setMoving] = useState<{ b: Booking; dir?: 'up' | 'down' } | null>(null)
  const [paying, setPaying] = useState<Booking | null>(null)
  const [billing, setBilling] = useState<Booking | null>(null)
  const [adding, setAdding] = useState<Booking | null>(null)
  const [cancelling, setCancelling] = useState<Booking | null>(null)
  const [pkgMenu, setPkgMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [suspending, setSuspending] = useState(false)
  const [acting, setActing] = useState(false)
  const [flash, setFlash] = useState({ text: '', bad: false })
  const nav = useNavigate()
  const location = useLocation()
  /** The sidebar's #cp-* links open each section as a sheet — the hash is the
   *  state, so those URLs stay deep-linkable. Transactions and stay history
   *  open page-wide; current package, profile and vouchers open as popups. */
  const sheet =
    location.hash === '#cp-current' ? 'current'
    : location.hash === '#cp-profile' ? 'profile'
    : location.hash === '#cp-vouchers' ? 'vouchers'
    : location.hash === '#cp-transactions' ? 'transactions'
    : location.hash === '#cp-history' ? 'history'
    : null
  const closeSheet = () => nav(location.pathname, { replace: true })
  const now = useNow(30_000).getTime()
  const txns = useMemo(() => {
    const out: Txn[] = []
    for (const b of bookings ?? []) {
      const where = `Booking #${b.id} · ${b.room_name ?? 'Room'}`
      if (b.deposit) out.push({ id: `d${b.id}`, date: b.created_at, kind: 'Deposit', detail: where, ref: '', payer: b.guest_name, amount: Number(b.deposit), src: { b, p: depositPayment(b) } })
      for (const p of b.payments ?? []) {
        // Only real money gets a receipt — pay-later markers carry no amount.
        out.push({ id: `p${p.id}`, date: p.paid_at ?? p.created_at, kind: p.method_label, detail: where, ref: [p.receipt_number, p.reference].filter(Boolean).join(' · '), payer: p.payer, amount: Number(p.amount), src: Number(p.amount) > 0 ? { b, p: receiptPayment(p) } : undefined })
      }
    }
    return out.sort((a, b) => b.date.localeCompare(a.date))
  }, [bookings])

  // Live totals come from the booking ledger — the rollup row `c` only refreshes
  // when the directory reloads, so the portal reads its own numbers.
  const live = useMemo(() => {
    const out = { billed: Number(c.billed), paid: Number(c.paid) }
    if (bookings) {
      out.billed = out.paid = 0
      for (const b of bookings) {
        if (b.status === 'cancelled') continue
        out.billed += Number(b.bill)
        out.paid += Number(b.paid)
      }
    }
    return { ...out, balance: out.billed - out.paid }
  }, [bookings, c.billed, c.paid])

  // The stay the guest is on right now — occupied first, else the soonest reservation.
  const current = useMemo(() => {
    const active = (bookings ?? []).filter((b) => b.status === 'occupied' || b.status === 'reserved')
    return active.find((b) => b.status === 'occupied') ?? [...active].sort((a, b) => a.start.localeCompare(b.start))[0] ?? null
  }, [bookings])
  const nightsLeft = current && current.kind !== 'day_rest'
    ? Math.max(0, Math.ceil((new Date(current.end).getTime() - Math.max(now, new Date(current.start).getTime())) / DAY))
    : 0

  // Credit vouchers across all of the client's bookings — issued by room changes.
  const vouchers = useMemo(() =>
    (bookings ?? [])
      .flatMap((b) => (b.vouchers ?? []).map((v) => ({ ...v, booking: b.id, room: b.room_name ?? 'Room' })))
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [bookings])

  async function checkout(b: Booking) {
    setBusy(b.id)
    setFlash({ text: '', bad: false })
    try {
      const next = await bnb.checkoutBooking(b.id)
      setData((l) => l?.map((x) => (x.id === b.id ? next : x)) ?? null)
      setFlash({ text: `${b.guest_name} checked out of ${b.room_name}.`, bad: false })
      onChanged?.()
    } catch (err) {
      setFlash({ text: parseApiError(err).message, bad: true })
    } finally {
      setBusy(0)
    }
  }

  /** Lift a suspension — the client can book again straight away. */
  async function reinstate() {
    setActing(true)
    setFlash({ text: '', bad: false })
    try {
      await bnb.updateClient(c.key, { status: 'active' })
      setFlash({ text: `${c.name} reinstated — they can make bookings again.`, bad: false })
      onChanged?.()
    } catch (err) {
      setFlash({ text: parseApiError(err).message, bad: true })
    } finally {
      setActing(false)
    }
  }

  const navLink = `flex items-center gap-2 whitespace-nowrap px-3 py-2 text-xs font-semibold transition ${t.radius} ${t.navIdle}`

  return (
    <>
      <div>
        <Link to={base} className={`inline-flex items-center gap-1.5 text-xs font-medium ${t.muted} hover:underline`}>
          <ArrowLeft className="size-3.5" /> All clients
        </Link>
      </div>

      <Flash message={flash.text} tone={flash.bad ? 'red' : 'green'} />

      <div>
        {/* Portal sections — the workspace sidebar carries them on wide
            screens; this is the scrollable strip for mobile. */}
        <aside className="mb-4 lg:hidden">
          <nav aria-label="Client sections" className={`flex gap-1 overflow-x-auto p-1.5 ${t.radius} ${t.card}`}>
            {current && <Link to="#cp-current" className={navLink}><BedDouble className="size-4 shrink-0" /> Current package</Link>}
            <Link to="#cp-profile" className={navLink}><Contact className="size-4 shrink-0" /> Profile</Link>
            <Link to="#cp-vouchers" className={navLink}><Ticket className="size-4 shrink-0" /> Vouchers{vouchers.length ? ` (${vouchers.length})` : ''}</Link>
            <Link to="#cp-transactions" className={navLink}><Wallet className="size-4 shrink-0" /> Transactions</Link>
            <Link to="#cp-history" className={navLink}><History className="size-4 shrink-0" /> Stay history</Link>
          </nav>
        </aside>

        <div className="min-w-0 space-y-5">
      {/* One card for the client: identity and contacts, then the stay
          they're on as a clickable strip (opens the package options). The
          strip's Balance column says "Settled", so no settled pill — and
          "Current package" already says they're in house. Account actions
          (edit, suspend) live in the profile sheet. */}
      <section id="cp-profile" className={`relative scroll-mt-24 overflow-hidden p-5 sm:p-6 ${t.radius} ${t.card}`}>
        <div className={`pointer-events-none absolute -right-20 -top-24 size-72 rounded-full blur-2xl ${t.glowA}`} />
        <ProfileHead t={t} c={c} live={live} current={current} />

        {current && (
          <CurrentStrip
            t={t} b={current} nightsLeft={nightsLeft} busy={busy === current.id} id="cp-current"
            onPackage={() => setPkgMenu(true)}
            onEditBill={() => setBilling(current)}
            onMove={() => setMoving({ b: current })}
            onAdd={() => setAdding(current)}
            onPay={() => setPaying(current)}
            onCheckout={() => void checkout(current)}
            onCancel={() => setCancelling(current)}
          />
        )}
        <ProfileMeta t={t} c={c} />
      </section>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat t={t} i={0} icon={BedDouble} label="Stays" value={c.stays} hint={`${c.nights} ${c.nights === 1 ? 'night' : 'nights'} total`} />
        <Stat t={t} i={1} icon={Moon} label="Last visit" value={fmtD(c.last_visit)} />
        <Stat t={t} i={2} icon={Wallet} label="Total paid" value={formatMoney(live.paid)} hint={`billed ${formatMoney(live.billed)}`} />
        <Stat t={t} i={3} icon={Receipt} label="Balance" value={formatMoney(Math.max(0, live.balance))} hint={live.balance > 0 ? 'still due' : 'fully settled'} />
      </div>

      <div id="cp-vouchers" className="scroll-mt-24">
      <Panel t={t} title="Vouchers" actions={<Pill tone="amber">{vouchers.length}</Pill>}>
        <VouchersBody t={t} vouchers={vouchers} loading={loading && !bookings} th={th} />
      </Panel>
      </div>

      <div id="cp-transactions" className="scroll-mt-24">
      <Panel t={t} title="Transactions" actions={<Pill tone="blue">{txns.length}</Pill>}>
        <TxnsBody t={t} txns={txns} loading={loading && !bookings} th={th} />
      </Panel>
      </div>

      <div id="cp-history" className="scroll-mt-24">
      <Panel t={t} title="Stay history" actions={<Pill tone="blue">{bookings?.length ?? c.bookings}</Pill>}>
        <HistoryBody
          t={t} bookings={bookings} loading={loading && !bookings} th={th} charge={charge} busy={busy}
          onEditBill={setBilling}
          onMove={(b) => setMoving({ b })}
          onAdd={setAdding}
          onPay={setPaying}
          onCheckout={checkout}
          onCancel={setCancelling}
        />
      </Panel>
      </div>
        </div>
      </div>

      <AnimatePresence>
        {sheet === 'current' && (
          <PortalSheet
            t={t} icon={BedDouble} onClose={closeSheet}
            title={current ? `${current.status === 'occupied' ? 'Current package' : 'Next stay'} · ${current.room_name}` : 'Current package'}
            sub={c.name}
          >
            {current ? (
              <CurrentStrip
                t={t} b={current} nightsLeft={nightsLeft} busy={busy === current.id}
                onPackage={() => { closeSheet(); setPkgMenu(true) }}
                onEditBill={() => setBilling(current)}
                onMove={() => setMoving({ b: current })}
                onAdd={() => setAdding(current)}
                onPay={() => setPaying(current)}
                onCheckout={() => void checkout(current)}
                onCancel={() => setCancelling(current)}
              />
            ) : (
              <Empty t={t} icon={BedDouble} title="No stay on the books" text="This client has no occupied or upcoming booking at the branch." />
            )}
          </PortalSheet>
        )}
        {sheet === 'profile' && (
          <PortalSheet t={t} icon={Contact} title={c.name} sub={`Client since ${formatDate(c.since)}`} onClose={closeSheet}>
            <ProfileHead t={t} c={c} live={live} current={current} />
            <ProfileMeta t={t} c={c} />
            <div className="relative mt-5 flex flex-wrap gap-2">
              <Button t={t} variant="ghost" onClick={() => setEditing(true)}>
                <Pencil className="size-3.5" /> Edit details
              </Button>
              {c.suspended ? (
                <Button t={t} variant="ghost" busy={acting} onClick={() => void reinstate()}>
                  <Check className="size-3.5" /> Reinstate account
                </Button>
              ) : (
                <Button t={t} variant="danger" onClick={() => setSuspending(true)}>
                  <Ban className="size-3.5" /> Suspend account
                </Button>
              )}
            </div>
          </PortalSheet>
        )}
        {sheet === 'vouchers' && (
          <PortalSheet t={t} icon={Ticket} title="Vouchers" sub={`${c.name} · ${vouchers.length} issued`} onClose={closeSheet}>
            <VouchersBody t={t} vouchers={vouchers} loading={loading && !bookings} th={th} />
          </PortalSheet>
        )}
        {sheet === 'transactions' && (
          <PortalSheet t={t} icon={Wallet} title="Transactions" sub={`${c.name} · ${txns.length} records`} wide onClose={closeSheet}>
            <TxnsBody t={t} txns={txns} loading={loading && !bookings} th={th} />
          </PortalSheet>
        )}
        {sheet === 'history' && (
          <PortalSheet t={t} icon={History} title="Stay history" sub={`${c.name} · ${bookings?.length ?? c.bookings} bookings`} wide onClose={closeSheet}>
            <HistoryBody
              t={t} bookings={bookings} loading={loading && !bookings} th={th} charge={charge} busy={busy}
              onEditBill={setBilling}
              onMove={(b) => setMoving({ b })}
              onAdd={setAdding}
              onPay={setPaying}
              onCheckout={checkout}
              onCancel={setCancelling}
            />
          </PortalSheet>
        )}
        {pkgMenu && current && (
          <PackageMenu
            t={t} b={current}
            onClose={() => setPkgMenu(false)}
            onUpgrade={() => { setPkgMenu(false); setMoving({ b: current, dir: 'up' }) }}
            onDowngrade={() => { setPkgMenu(false); setMoving({ b: current, dir: 'down' }) }}
            onCancel={() => { setPkgMenu(false); setCancelling(current) }}
          />
        )}
        {moving && (
          <ChangeRoom
            t={t} b={moving.b} dir={moving.dir} rooms={rooms}
            onClose={() => setMoving(null)}
            onDone={(next, applied) => {
              setData((l) => l?.map((x) => (x.id === next.id ? next : x)) ?? null)
              setMoving(null)
              setFlash({ text: moveText(next, applied), bad: false })
              onChanged?.()
            }}
          />
        )}
        {cancelling && (
          <CancelStay
            t={t} b={cancelling} me={me}
            onClose={() => setCancelling(null)}
            onDone={(next, settle, amount) => {
              setData((l) => l?.map((x) => (x.id === next.id ? next : x)) ?? null)
              setCancelling(null)
              setFlash({ text: cancelText(cancelling, settle, amount, next), bad: false })
              onChanged?.()
            }}
          />
        )}
        {paying && (
          <PayStay
            t={t} b={paying} rooms={rooms} me={me}
            onClose={() => setPaying(null)}
            onDone={(next, applied) => {
              setData((l) => l?.map((x) => (x.id === next.id ? next : x)) ?? null)
              setPaying(null)
              setFlash({ text: payText(paying, applied, next), bad: false })
              onChanged?.()
            }}
          />
        )}
        {billing && (
          <EditBill
            t={t} b={billing} rooms={rooms}
            onClose={() => setBilling(null)}
            onDone={(next) => {
              setData((l) => l?.map((x) => (x.id === next.id ? next : x)) ?? null)
              setBilling(null)
              setFlash({ text: `${next.guest_name}'s bill updated — now ${formatMoney(next.bill)}.`, bad: false })
              onChanged?.()
            }}
          />
        )}
        {adding && (
          <AddPackage
            t={t} b={adding} me={me}
            onClose={() => setAdding(null)}
            onDone={(next, applied) => {
              setData((l) => l?.map((x) => (x.id === next.id ? next : x)) ?? null)
              setAdding(null)
              setFlash({ text: pkgText(adding, applied), bad: false })
              onChanged?.()
            }}
          />
        )}
        {editing && (
          <EditClient
            t={t} c={c}
            onClose={() => setEditing(false)}
            onDone={(r) => {
              setEditing(false)
              setFlash({ text: `${c.name}'s profile updated.`, bad: false })
              onChanged?.()
              // Profile edits can move the client to a different rollup key.
              if (r.key !== c.key) nav(`${base}/${encodeURIComponent(r.key)}`)
            }}
          />
        )}
        {suspending && (
          <SuspendClient
            t={t} c={c}
            onClose={() => setSuspending(false)}
            onDone={() => {
              setSuspending(false)
              setFlash({ text: `${c.name} suspended — new bookings are blocked.`, bad: false })
              onChanged?.()
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}

/** A portal section opened as a sheet — the sidebar's #cp-* links land here.
 *  `wide` gives the long tables (transactions, stay history) page room. */
function PortalSheet({ t, icon: Icon, title, sub, wide, onClose, children }: {
  t: WorkspaceTheme
  icon: LucideIcon
  title: string
  sub?: string
  wide?: boolean
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <motion.div
      className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
      <motion.div
        role="dialog" aria-modal="true" aria-label={title}
        initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 8 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className={`relative my-auto flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden shadow-2xl ${wide ? 'max-w-6xl' : 'max-w-2xl'} ${t.radius} ${t.root}`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-900/10 px-5 py-4 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid size-10 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className={`truncate text-base ${t.heading}`}>{title}</h3>
              {sub && <p className={`truncate text-xs ${t.muted}`}>{sub}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`grid size-9 shrink-0 place-items-center ${t.radius} ${t.iconButton}`}>
            <X className="size-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </motion.div>
    </motion.div>
  )
}

/** The client's identity block — name, account pills, since. Shows on the
 *  portal card and inside the profile sheet. */
function ProfileHead({ t, c, live, current }: {
  t: WorkspaceTheme
  c: ClientRow
  live: { billed: number; paid: number; balance: number }
  current: Booking | null
}) {
  return (
    <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
      <span className={`grid size-16 shrink-0 place-items-center text-lg font-bold sm:size-20 ${t.radius} ${t.iconBox}`}>
        {initials(c.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-[11px] font-medium uppercase tracking-wider ${t.muted}`}>Client portal</p>
        <h2 className={`mt-0.5 text-xl sm:text-2xl ${t.heading}`}>{c.name}</h2>
        <p className={`mt-1 text-sm ${t.muted}`}>Client since {formatDate(c.since)}</p>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {c.suspended && <Pill tone="red">Suspended</Pill>}
        {live.balance > 0 && <Pill tone="amber">Live balance {formatMoney(live.balance)}</Pill>}
        {c.in_house && current?.status !== 'occupied' && <Pill tone="blue">In house now</Pill>}
        {c.stays > 1 && <Pill tone="green">Repeat client · {c.stays} stays</Pill>}
      </div>
    </div>
  )
}

/** Contact chips, notes and suspension details — the profile's quieter
 *  metadata, shown on the card and in the profile sheet. */
function ProfileMeta({ t, c }: { t: WorkspaceTheme; c: ClientRow }) {
  return (
    <>
      <div className="relative mt-4 flex flex-wrap gap-2 text-xs">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${t.chip}`}>
          <Phone className="size-3.5" /> {c.phone || 'No phone'}
        </span>
        {c.email && (
          <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 ${t.chip}`}>
            <Mail className="size-3.5 shrink-0" /> <span className="truncate">{c.email}</span>
          </span>
        )}
        {c.id_number && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${t.chip}`}>
            <IdCard className="size-3.5" /> {idLabel(c.id_type)} {c.id_number}
          </span>
        )}
        {c.nationality && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${t.chip}`}>
            <Globe className="size-3.5" /> {c.nationality}
          </span>
        )}
      </div>
      {c.notes && (
        <p className={`relative mt-3 flex items-start gap-1.5 text-xs ${t.muted}`}>
          <MessageSquare className="mt-0.5 size-3.5 shrink-0" /> {c.notes}
        </p>
      )}
      {c.suspended && c.suspend_reason && (
        <p className="relative mt-3 flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-300">
          <Ban className="mt-0.5 size-3.5 shrink-0" /> Suspended — {c.suspend_reason}
        </p>
      )}
    </>
  )
}

/** The current/next stay as a clickable money strip — its click opens the
 *  package options popup. Lives on the profile card and in its own sheet. */
function CurrentStrip({ t, b, nightsLeft, busy, id, onPackage, onEditBill, onMove, onAdd, onPay, onCheckout, onCancel }: {
  t: WorkspaceTheme
  b: Booking
  nightsLeft: number
  busy: boolean
  id?: string
  onPackage: () => void
  onEditBill: () => void
  onMove: () => void
  onAdd: () => void
  onPay: () => void
  onCheckout: () => void
  onCancel: () => void
}) {
  return (
    <div
      id={id}
      onClick={onPackage}
      title="Select for package options — upgrade, downgrade or cancel"
      className={`relative mt-5 flex scroll-mt-24 cursor-pointer flex-col gap-4 border p-4 transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03] lg:flex-row lg:items-center ${t.radius} ${t.sidebarDivider}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className={`grid size-11 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
          <BedDouble className="size-5" />
        </span>
        <div className="min-w-0">
          <p className={`text-[11px] font-medium uppercase tracking-wider ${t.muted}`}>
            {b.status === 'occupied' ? 'Current package' : 'Next stay'} · {b.kind_label}
          </p>
          <h3 className={`truncate text-lg ${t.heading}`}>{b.room_name}</h3>
          <p className={`mt-0.5 text-xs ${t.muted}`}>
            <CalendarClock className="mr-1 inline size-3" />
            {fmtD(b.start)} → {fmtD(b.end)} · {stayLength(b)}
            {b.status === 'occupied' && b.kind !== 'day_rest' && ` · ${nightsLeft} ${nightsLeft === 1 ? 'night' : 'nights'} left`}
          </p>
          {(b.packages ?? []).length > 0 && (
            <p className="mt-1.5 flex flex-wrap gap-1">
              {b.packages.map((x) => (
                <Pill key={x.id} tone="slate"><Package className="mr-1 inline size-3" />{x.name}</Pill>
              ))}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="text-xs">
          <p className={t.muted}>Billed</p>
          <p className="mt-0.5 flex items-center gap-1 text-base font-semibold tabular-nums">
            {formatMoney(b.bill)}
            <button
              type="button" onClick={(e) => { e.stopPropagation(); onEditBill() }}
              title="Edit the billing price" aria-label="Edit the billing price"
              className={`grid size-5 place-items-center ${t.radius} ${t.iconButton}`}
            >
              <Pencil className="size-3" />
            </button>
          </p>
        </div>
        <div className="text-xs">
          <p className={t.muted}>Paid</p>
          <p className="mt-0.5 text-base font-semibold tabular-nums">{formatMoney(b.paid)}</p>
        </div>
        <div className="text-xs">
          <p className={t.muted}>Balance</p>
          <p className={`mt-0.5 text-base font-bold tabular-nums ${Number(b.balance) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {Number(b.balance) > 0 ? formatMoney(b.balance) : 'Settled'}
          </p>
        </div>
        {/* The strip's click opens the package popup — the actions menu
            mustn't trigger it. */}
        <div onClick={(e) => e.stopPropagation()}>
          <StayActions
            t={t} b={b} busy={busy}
            onMove={onMove} onAdd={onAdd} onPay={onPay} onCheckout={onCheckout} onCancel={onCancel}
          />
        </div>
      </div>
    </div>
  )
}

/** The client's credit vouchers — the same table fills the panel on the
 *  portal page and the vouchers sheet. */
function VouchersBody({ t, vouchers, loading, th }: {
  t: WorkspaceTheme
  vouchers: (Voucher & { booking: number; room: string })[]
  loading: boolean
  th: string
}) {
  if (loading) return <Loading t={t} />
  if (!vouchers.length)
    return <Empty t={t} icon={Ticket} title="No vouchers yet" text="Credit vouchers this client earns from room changes and downgrades appear here — they never expire." />
  return (
    <div className="overflow-x-auto">
      <table className="rtable w-full min-w-[36rem] border-collapse">
        <thead>
          <tr className={`border-b ${t.sidebarDivider}`}>
            <th className={th}>Code</th>
            <th className={th}>Issued</th>
            <th className={th}>From</th>
            <th className={th}>Status</th>
            <th className={`${th} text-right`}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {vouchers.map((v) => (
            <tr key={v.id} className={`border-b last:border-b-0 ${t.sidebarDivider}`}>
              <td className="px-3 py-2.5 text-xs font-semibold"><Ticket className="mr-1 inline size-3" />{v.code}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-xs">{fmtDT(v.created_at)}</td>
              <td className={`px-3 py-2.5 text-xs ${t.muted}`}>Booking #{v.booking} · {v.room}</td>
              <td className="px-3 py-2.5 text-xs">
                {v.redeemed_at ? <Pill tone="slate">Redeemed {fmtD(v.redeemed_at)}</Pill> : <Pill tone="green">Active</Pill>}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold">{formatMoney(v.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** The client's money ledger — deposits and payments across their bookings.
 *  The same table fills the panel and the transactions sheet. */
function TxnsBody({ t, txns, loading, th }: {
  t: WorkspaceTheme
  txns: Txn[]
  loading: boolean
  th: string
}) {
  if (loading) return <Loading t={t} />
  if (!txns.length)
    return <Empty t={t} icon={Wallet} title="No transactions yet" text="Deposits and payments recorded on this client's bookings will appear here." />
  return (
    <div className="overflow-x-auto">
      <table className="rtable w-full min-w-[46rem] border-collapse">
        <thead>
          <tr className={`border-b ${t.sidebarDivider}`}>
            <th className={th}>Date</th>
            <th className={th}>Type</th>
            <th className={th}>For</th>
            <th className={th}>Reference</th>
            <th className={th}>Paid by</th>
            <th className={`${th} text-right`}>Amount</th>
            <th className={`w-10 ${th}`}><span className="sr-only">Receipt</span></th>
          </tr>
        </thead>
        <tbody>
          {txns.map((x) => {
            const src = x.src
            return (
            <tr key={x.id} className={`border-b last:border-b-0 ${t.sidebarDivider}`}>
              <td className="whitespace-nowrap px-3 py-2.5 text-xs">{fmtDT(x.date)}</td>
              <td className="px-3 py-2.5 text-xs"><Pill tone={x.kind === 'Deposit' ? 'amber' : 'green'}>{x.kind}</Pill></td>
              <td className={`px-3 py-2.5 text-xs ${t.muted}`}>{x.detail}</td>
              <td className={`px-3 py-2.5 text-xs ${t.muted}`}>{x.ref || '—'}</td>
              <td className="px-3 py-2.5 text-xs">{x.payer}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold">{formatMoney(x.amount)}</td>
              <td className="px-1 py-2 text-right">
                {src && (
                  <button
                    type="button" onClick={() => void printPaymentReceipt(src.b, src.p, { reprint: true })}
                    title="Reprint receipt" aria-label={`Reprint the receipt for ${formatMoney(x.amount)}`}
                    className={`inline-grid size-7 place-items-center ${t.radius} ${t.iconButton}`}
                  >
                    <Printer className="size-3.5" />
                  </button>
                )}
              </td>
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Every booking the client has made at the branch, with per-stay actions.
 *  The same table fills the panel and the stay-history sheet. */
function HistoryBody({ t, bookings, loading, th, charge, busy, onEditBill, onMove, onAdd, onPay, onCheckout, onCancel }: {
  t: WorkspaceTheme
  bookings: Booking[] | null
  loading: boolean
  th: string
  charge: (b: Booking) => number
  busy: number
  onEditBill: (b: Booking) => void
  onMove: (b: Booking) => void
  onAdd: (b: Booking) => void
  onPay: (b: Booking) => void
  onCheckout: (b: Booking) => void
  onCancel: (b: Booking) => void
}) {
  if (loading) return <Loading t={t} />
  return (
    <div className="overflow-x-auto">
      <table className="rtable w-full min-w-[60rem] border-collapse">
        <thead>
          <tr className={`border-b ${t.sidebarDivider}`}>
            <th className={th}>Room</th>
            <th className={th}>Period</th>
            <th className={th}>Party</th>
            <th className={`${th} text-right`}>Billed</th>
            <th className={`${th} text-right`}>Paid</th>
            <th className={`${th} text-right`}>Status</th>
            <th className={`w-40 ${th} text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(bookings ?? []).map((b) => {
            const paid = Number(b.deposit ?? 0) + (b.payments ?? []).reduce((n, p) => n + Number(p.amount), 0)
            return (
              <tr key={b.id} className={`border-b align-top last:border-b-0 ${t.sidebarDivider}`}>
                <td className="px-3 py-3 text-xs">
                  <p className="flex items-center gap-1.5 font-medium"><BedDouble className="size-3.5 shrink-0" />{b.room_name}</p>
                  <p className={`mt-0.5 ${t.muted}`}>{b.kind_label}</p>
                  {(b.packages ?? []).map((x) => (
                    <p key={x.id} className={`mt-0.5 ${t.muted}`} title={`${x.payer} · ${formatMoney(x.amount)}`}>
                      <Package className="mr-1 inline size-3" />{x.name} — {x.payer}
                    </p>
                  ))}
                </td>
                <td className="px-3 py-3 text-xs">
                  <p><CalendarClock className="mr-1 inline size-3" />{fmtD(b.start)} → {fmtD(b.end)}</p>
                  <p className={`mt-0.5 ${t.muted}`}>{stayLength(b)}</p>
                </td>
                <td className="px-3 py-3 text-xs">
                  <p><Users className="mr-1 inline size-3" />{b.guests} {b.guests === 1 ? 'guest' : 'guests'}</p>
                  {(b.companions?.length ?? 0) > 0 && (
                    <p className={`mt-0.5 ${t.muted}`} title={b.companions.map((x) => x.name).join(', ')}>
                      with {b.companions.map((x) => x.name).join(', ')}
                    </p>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right text-xs font-medium">
                  {b.status === 'cancelled' ? '—' : (
                    <span className="inline-flex items-center justify-end gap-1">
                      {formatMoney(charge(b))}
                      <button
                        type="button" onClick={() => onEditBill(b)}
                        title={`Edit booking #${b.id}'s billing price`} aria-label={`Edit booking #${b.id}'s billing price`}
                        className={`grid size-5 place-items-center ${t.radius} ${t.iconButton}`}
                      >
                        <Pencil className="size-3" />
                      </button>
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right text-xs font-medium">{paid ? formatMoney(paid) : '—'}</td>
                <td className="px-3 py-3 text-right">
                  <Pill tone={STATUS_TONE[b.status]}>{b.status_label}</Pill>
                  {(b.vouchers ?? []).map((v) => (
                    <p key={v.id} className="mt-1 flex justify-end"><Pill tone="amber"><Ticket className="mr-1 inline size-3" />{v.code}</Pill></p>
                  ))}
                </td>
                <td className="px-3 py-3 text-right">
                  <StayActions
                    t={t} b={b} busy={busy === b.id}
                    onMove={() => onMove(b)}
                    onAdd={() => onAdd(b)}
                    onPay={() => onPay(b)}
                    onCheckout={() => void onCheckout(b)}
                    onCancel={() => onCancel(b)}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** The portal's edit-details modal — every field fans out to the client's
 *  bookings on save, and the rollup key can move (e.g. a new phone number). */
function EditClient({ t, c, onClose, onDone }: {
  t: WorkspaceTheme
  c: ClientRow
  onClose: () => void
  onDone: (r: ClientProfileResult) => void
}) {
  const [name, setName] = useState(c.name)
  const [phone, setPhone] = useState(c.phone)
  const [email, setEmail] = useState(c.email)
  const [idType, setIdType] = useState<GuestIdType | ''>(c.id_type)
  const [idNumber, setIdNumber] = useState(c.id_number)
  const [nationality, setNationality] = useState(c.nationality || 'Kenya')
  const [notes, setNotes] = useState(c.notes)
  const [err, setErr] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const ok = !!name.trim() && phoneComplete(phone)

  async function confirm() {
    if (!ok) return
    setBusy(true)
    setErr('')
    try {
      const r = await bnb.updateClient(c.key, {
        guest_name: name.trim(),
        guest_phone: phone,
        guest_email: email.trim(),
        guest_id_type: idType,
        guest_id_number: idNumber.trim(),
        guest_nationality: nationality.trim(),
        guest_notes: notes.trim(),
      })
      onDone(r)
    } catch (e) {
      const p = parseApiError(e)
      setErr(p.message)
      setFields(p.fields)
      setBusy(false)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
      <motion.div
        role="dialog" aria-modal="true" aria-label={`Edit ${c.name}`}
        initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className={`relative my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden shadow-2xl ${t.radius} ${t.root}`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-900/10 px-5 py-4 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid size-10 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
              <Pencil className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className={`truncate text-base ${t.heading}`}>Edit details</h3>
              <p className={`text-xs ${t.muted}`}>{c.name} — updates all their bookings</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`grid size-9 shrink-0 place-items-center ${t.radius} ${t.iconButton}`}>
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input t={t} label="Full name" required value={name} onChange={(e) => setName(e.target.value.toUpperCase())} error={fields.guest_name} autoComplete="off" />
            <PhoneInput t={t} label="Phone" required value={phone} onChange={setPhone} error={fields.guest_phone} />
            <EmailInput t={t} label="Email" value={email} onChange={setEmail} error={fields.guest_email} />
            <div className="sm:col-span-2">
              <NatIdInput
                t={t}
                nationality={nationality} onNationality={setNationality}
                idType={idType} onIdType={setIdType}
                idNumber={idNumber} onIdNumber={setIdNumber}
                emptyTypeLabel="No ID on file"
                error={fields.guest_nationality || fields.guest_id_number}
              />
            </div>
            <div className="sm:col-span-2">
              <Textarea t={t} label="Notes & special requests" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          {err && <p className={`px-3 py-2.5 text-xs text-rose-500 ${t.radius} ${t.chip}`}>{err}</p>}
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-900/10 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/10">
          <Button t={t} variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button t={t} busy={busy} disabled={!ok} onClick={() => void confirm()}>
            <Check className="size-4" /> Save details
          </Button>
        </footer>
      </motion.div>
    </motion.div>
  )
}

/** Suspend a client — they keep their history but can't make new bookings at
 *  this branch until reinstated. */
function SuspendClient({ t, c, onClose, onDone }: {
  t: WorkspaceTheme
  c: ClientRow
  onClose: () => void
  onDone: () => void
}) {
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  async function confirm() {
    setBusy(true)
    setErr('')
    try {
      await bnb.updateClient(c.key, { status: 'suspended', reason: reason.trim() })
      onDone()
    } catch (e) {
      setErr(parseApiError(e).message)
      setBusy(false)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
      <motion.div
        role="dialog" aria-modal="true" aria-label={`Suspend ${c.name}`}
        initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className={`relative my-auto flex w-full max-w-md flex-col overflow-hidden shadow-2xl ${t.radius} ${t.root}`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-900/10 px-5 py-4 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid size-10 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
              <Ban className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className={`truncate text-base ${t.heading}`}>Suspend account</h3>
              <p className={`text-xs ${t.muted}`}>{c.name}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`grid size-9 shrink-0 place-items-center ${t.radius} ${t.iconButton}`}>
            <X className="size-4" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-5">
          <p className={`px-3 py-2.5 text-xs ${t.radius} ${t.chip}`}>
            {c.name} won't be able to make new bookings at this branch while suspended. Their stays, transactions and vouchers stay on record, and you can reinstate them any time.
          </p>
          <Input t={t} label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. damaged property, repeated no-shows" autoComplete="off" />
          {err && <p className={`px-3 py-2.5 text-xs text-rose-500 ${t.radius} ${t.chip}`}>{err}</p>}
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-900/10 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/10">
          <Button t={t} variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button t={t} variant="danger" busy={busy} onClick={() => void confirm()}>
            <Ban className="size-4" /> Suspend account
          </Button>
        </footer>
      </motion.div>
    </motion.div>
  )
}

/** Success flash for an added package — notes whether the money was collected. */
const pkgText = (b: Booking, a: AddPackageResult['applied']) =>
  a.paid
    ? `Added ${a.name} and collected ${formatMoney(a.paid)} on ${b.guest_name}'s booking.`
    : `Added ${a.name} (${formatMoney(a.amount)}) to ${b.guest_name}'s bill.`

/** A stay's action links collapsed into one dropdown — room change, extra
 *  packages, payment and checkout. `position: fixed` so the menu isn't clipped
 *  by the table's horizontal scroll container. */
function StayActions({ t, b, busy, onMove, onAdd, onPay, onCheckout, onCancel }: {
  t: WorkspaceTheme
  b: Booking
  busy: boolean
  onMove: () => void
  onAdd: () => void
  onPay: () => void
  onCheckout: () => void
  onCancel: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const box = useRef<HTMLSpanElement>(null)
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  const toggle = () => {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    }
    setOpen((o) => !o)
  }

  // Day rests bill by the hour — the nightly-rate change math doesn't apply.
  const active = b.status === 'occupied' || b.status === 'reserved'
  const item = `flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs font-semibold transition ${t.radius} ${t.navIdle}`
  const go = (fn: () => void) => () => { setOpen(false); fn() }
  return (
    <span ref={box} className="inline-flex">
      <button
        type="button" ref={ref} onClick={toggle} aria-haspopup="menu" aria-expanded={open}
        className={`inline-flex h-9 items-center justify-center gap-1.5 px-3.5 text-xs font-semibold transition ${t.radius} ${t.chip} hover:brightness-95 dark:hover:brightness-125`}
      >
        <Ellipsis className="size-3.5" /> Actions <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            style={{ top: pos.top, right: pos.right }}
            className={`fixed z-[70] w-44 origin-top-right overflow-hidden p-1 ${t.radius} ${t.card} shadow-xl shadow-black/10 dark:shadow-black/40`}
          >
            {active && b.kind !== 'day_rest' && (
              <button type="button" role="menuitem" onClick={go(onMove)} className={item}>
                <ArrowLeftRight className="size-3.5" /> Change room
              </button>
            )}
            {active && (
              <button type="button" role="menuitem" onClick={go(onAdd)} className={item}>
                <PackagePlus className="size-3.5" /> Add package
              </button>
            )}
            {active && (
              <button type="button" role="menuitem" onClick={go(onPay)} className={item}>
                <Banknote className="size-3.5" /> Pay
              </button>
            )}
            {b.status === 'occupied' && (
              <button type="button" role="menuitem" disabled={busy} onClick={go(onCheckout)} className={`${item} disabled:opacity-50`}>
                <LogOut className="size-3.5" /> {busy ? 'Checking out…' : 'Check out'}
              </button>
            )}
            {active && (
              <button type="button" role="menuitem" onClick={go(onCancel)} className={`${item} hover:!text-rose-500`}>
                <Ban className="size-3.5" /> Cancel booking
              </button>
            )}
            {!active && (
              <p className={`px-3 py-2.5 text-xs ${t.muted}`}>Stay {b.status_label.toLowerCase()} — nothing to do.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  )
}

/** Success flash for a confirmed room change — reads the server's applied summary. */
const moveText = (b: Booking, a: RoomChangeResult['applied']) => {
  const head = `${b.guest_name} moved to ${b.room_name}`
  if (a.refund) return `${head} — refunded ${formatMoney(a.refund)}.`
  if (a.voucher_code) return `${head} — voucher ${a.voucher_code} (${formatMoney(a.voucher_amount ?? 0)}) issued.`
  if (a.extra_nights) return `${head} — ${a.extra_nights} extra ${a.extra_nights === 1 ? 'night' : 'nights'}, out ${fmtDT(b.end)}.`
  if (a.topup) return `${head} — collected ${formatMoney(a.topup)}.`
  if (a.kept_nights) return `${head} — now checks out ${fmtDT(b.end)}.`
  return `${head}.`
}

const DAY = 86_400_000

/** Success flash for a cancelled booking — how the collected money was settled. */
const cancelText = (b: Booking, settle: CancelSettle, amount: number, next: Booking) => {
  const head = `${b.guest_name}'s ${b.kind_label.toLowerCase()} was cancelled`
  if (settle === 'refund') return `${head} — ${formatMoney(amount)} withdrawn from the till.`
  if (settle === 'voucher') {
    const code = next.vouchers[0]?.code
    return `${head} — voucher ${code ?? ''} (${formatMoney(amount)}) issued for a future stay.`
  }
  return amount > 0 ? `${head} — ${formatMoney(amount)} paid stays on record as a refund due.` : `${head}.`
}

/** The popup that opens when the receptionist selects the current package —
 *  upgrade, downgrade or cancel; each route then settles the price difference
 *  a different way (money in or out, nights added or given back, or a
 *  redeemable voucher). */
function PackageMenu({ t, b, onClose, onUpgrade, onDowngrade, onCancel }: {
  t: WorkspaceTheme
  b: Booking
  onClose: () => void
  onUpgrade: () => void
  onDowngrade: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Day rests bill by the hour — the nightly-rate change math doesn't apply.
  const off = b.kind === 'day_rest' ? 'Day rests bill by the hour — the room can\'t be swapped.' : undefined
  const opts: { icon: LucideIcon; title: string; detail: string; fn: () => void; off?: string; danger?: boolean }[] = [
    { icon: TrendingUp, title: 'Upgrade', detail: 'Move to a pricier room — collect the difference (top up), or give back nights to cover it.', fn: onUpgrade, off },
    { icon: TrendingDown, title: 'Downgrade', detail: 'Move to a cheaper room — refund the difference, add free nights, or issue a voucher the guest redeems later.', fn: onDowngrade, off },
    { icon: Ban, title: 'Cancel package', detail: 'End this booking — withdraw the paid balance, turn it into a redeemable voucher, or keep it on record.', fn: onCancel, danger: true },
  ]

  return (
    <motion.div
      className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
      <motion.div
        role="dialog" aria-modal="true" aria-label={`Package options for ${b.guest_name}`}
        initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className={`relative my-auto w-full max-w-md overflow-hidden shadow-2xl ${t.radius} ${t.root}`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-900/10 px-5 py-4 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid size-10 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
              <Package className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className={`truncate text-base ${t.heading}`}>Package options</h3>
              <p className={`text-xs ${t.muted}`}>{b.guest_name} · {b.room_name} · {b.kind_label}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`grid size-9 shrink-0 place-items-center ${t.radius} ${t.iconButton}`}>
            <X className="size-4" />
          </button>
        </header>

        <div className="space-y-2 px-5 py-5">
          {opts.map((o) => (
            <button
              key={o.title} type="button" disabled={!!o.off} title={o.off} onClick={o.fn}
              className={`flex w-full items-start gap-3 p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${t.radius} ${t.chip} ${t.cardHover}`}
            >
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${o.danger ? 'bg-rose-500/12 text-rose-600 dark:text-rose-300' : t.iconBox}`}>
                <o.icon className="size-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-semibold ${o.danger ? 'text-rose-600 dark:text-rose-300' : ''}`}>{o.title}</span>
                <span className={`mt-0.5 block text-xs ${t.muted}`}>{o.off || o.detail}</span>
              </span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}

/** Cancelling a live stay — the receptionist picks what happens to money the
 *  guest already paid: withdraw it as a refund through a till channel, turn
 *  it into a redeemable voucher, or keep it on record as a refund due. */
function CancelStay({ t, b, me, onClose, onDone }: {
  t: WorkspaceTheme
  b: Booking
  me: Employee
  onClose: () => void
  onDone: (next: Booking, settle: CancelSettle, amount: number) => void
}) {
  const tills = useApi(() => bnb.tills({ open: '1' }))
  const paid = Number(b.paid)
  const [settle, setSettle] = useState<CancelSettle>('refund')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [ref, setRef] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  // Refunds leave through the open till — same gate collecting money has.
  const open = (tills.data ?? []).find((s) => s.status === 'open')
  const mine = !!open && (me.role !== 'branch_receptionist' || open.opened_by === me.id)
  const tillBlock = tills.loading && !tills.data ? ''
    : !open ? 'The till is closed — open it on the Counter page before handing money out.'
    : !mine ? `${open.opened_by_name ?? 'Another receptionist'} has the till open — only they can hand money out.` : ''

  const opts: { id: CancelSettle; icon: LucideIcon; title: string; detail: string; off?: string }[] = [
    { id: 'refund', icon: Banknote, title: 'Withdraw the balance', detail: `Hand ${formatMoney(paid)} back to the guest now — pick the channel below.`, off: tillBlock || undefined },
    { id: 'voucher', icon: Ticket, title: 'Take a voucher', detail: `Issue a ${formatMoney(paid)} voucher — the guest redeems it on a future stay. It never expires.` },
    { id: 'keep', icon: Receipt, title: 'Keep it on record', detail: 'Cancel without returning money — the paid amount stays listed as a refund due in accounts.' },
  ]

  async function confirm() {
    if (settle === 'refund' && tillBlock) return
    setBusy(true)
    setErr('')
    try {
      const next = await bnb.cancelBooking(
        b.id,
        paid > 0
          ? { settle, method: settle === 'refund' ? method : undefined, reference: ref.trim() || undefined }
          : {},
      )
      onDone(next, settle, paid)
    } catch (e) {
      setErr(parseApiError(e).message)
      setBusy(false)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
      <motion.div
        role="dialog" aria-modal="true" aria-label={`Cancel ${b.guest_name}'s booking`}
        initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className={`relative my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden shadow-2xl ${t.radius} ${t.root}`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-900/10 px-5 py-4 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-rose-500/12 text-rose-600 dark:text-rose-300">
              <Ban className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className={`truncate text-base ${t.heading}`}>Cancel package</h3>
              <p className={`text-xs ${t.muted}`}>{b.guest_name} · booking #{b.id}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`grid size-9 shrink-0 place-items-center ${t.radius} ${t.iconButton}`}>
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-xs ${t.radius} ${t.chip}`}>
            <span className="font-semibold">{b.room_name}</span>
            <span className={t.muted}>{fmtD(b.start)} → {fmtD(b.end)}</span>
            <span className={t.muted}>{stayLength(b)}</span>
            <span className={t.muted}>paid {formatMoney(paid)}</span>
          </div>

          {paid > 0 ? (
            <>
              <section>
                <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>Settle the paid balance</legend>
                <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Settle the paid balance">
                  {opts.map((o) => {
                    const sel = settle === o.id
                    return (
                      <button
                        key={o.id} type="button" role="radio" aria-checked={sel}
                        disabled={!!o.off} title={o.off}
                        onClick={() => setSettle(o.id)}
                        className={`flex flex-col gap-1.5 p-3 text-left transition disabled:cursor-not-allowed ${t.radius} ${
                          sel ? t.navActive : o.off ? `${t.chip} opacity-50` : `${t.chip} ${t.cardHover}`
                        }`}
                      >
                        <span className="flex items-center gap-1.5 text-xs font-semibold"><o.icon className="size-3.5" /> {o.title}</span>
                        <span className={`text-[11px] ${sel ? 'opacity-80' : t.muted}`}>{o.off || o.detail}</span>
                      </button>
                    )
                  })}
                </div>
              </section>

              {settle === 'refund' && !tillBlock && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select t={t} label="Refund through" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                    {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </Select>
                  <Input t={t} label="Reference (optional)" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Receipt or transaction ref" />
                </div>
              )}
            </>
          ) : (
            <p className={`px-3 py-2.5 text-xs ${t.radius} ${t.chip}`}>
              Nothing was collected on this booking — cancelling just frees the room for its period.
            </p>
          )}
          {err && <p className={`px-3 py-2.5 text-xs text-rose-500 ${t.radius} ${t.chip}`}>{err}</p>}
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-900/10 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/10">
          <Button t={t} variant="ghost" onClick={onClose} disabled={busy}>Keep booking</Button>
          <Button t={t} variant="danger" busy={busy} disabled={settle === 'refund' && !!tillBlock && paid > 0} onClick={() => void confirm()}>
            <Ban className="size-4" /> Cancel package
          </Button>
        </footer>
      </motion.div>
    </motion.div>
  )
}

/** The portal's change-room flow — pick a free room, see the credit/cost
 *  difference on the unused nights, settle it, confirm. Money options ask for
 *  the channel they move through; the server re-quotes and applies atomically. */
function ChangeRoom({ t, b, rooms, dir: dir0, onClose, onDone }: {
  t: WorkspaceTheme
  b: Booking
  rooms: Room[]
  /** 'up' starts the picker on pricier rooms (upgrade), 'down' on cheaper
   *  ones (downgrade) — the package popup launches it with a direction,
   *  and the receptionist can still switch it inside the dialog. */
  dir?: 'up' | 'down'
  onClose: () => void
  onDone: (next: Booking, applied: RoomChangeResult['applied']) => void
}) {
  const live = useApi(() => bnb.bookings({ active: '1', limit: 500 }))
  const [dir, setDir] = useState<'up' | 'down' | undefined>(dir0)
  const [room, setRoom] = useState<Room | null>(null)
  const [roomQ, setRoomQ] = useState('')
  const [option, setOption] = useState<RoomChangeOption | ''>('')
  const [keep, setKeep] = useState(1)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [ref, setRef] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const now = useNow(30_000).getTime()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const startMs = new Date(b.start).getTime()
  const endMs = new Date(b.end).getTime()
  const nightsLeft = now <= startMs ? b.nights : Math.max(0, Math.ceil((endMs - now) / DAY))
  const changeFrom = Math.max(now, startMs)
  const oldRate = Number(rooms.find((r) => r.id === b.room)?.price ?? 0)

  /** Rooms another live booking holds over a window starting at the change. */
  const busyRooms = (end: number) =>
    new Set((live.data ?? [])
      .filter((x) => x.id !== b.id && new Date(x.start).getTime() < end && new Date(x.end).getTime() > changeFrom)
      .map((x) => x.room))
  const blocked = busyRooms(endMs)
  const companions = new Set((b.companions ?? []).map((c) => c.room).filter((r): r is number => r != null))
  const freeNow = (r: Room) => r.status === 'active' && r.id !== b.room && !blocked.has(r.id) && !companions.has(r.id)
  const fits = (r: Room) => !dir || (dir === 'up' ? Number(r.price) > oldRate : Number(r.price) < oldRate)
  const sorted = useMemo(
    () => rooms.filter(fits).sort((x, y) => Number(freeNow(y)) - Number(freeNow(x)) || Number(x.price) - Number(y.price) || x.name.localeCompare(y.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rooms, live.data, changeFrom, endMs, dir],
  )
  const q = roomQ.trim().toLowerCase()
  const shown = sorted.filter((r) => !q || `${r.name} ${r.type_label}`.toLowerCase().includes(q))

  const newRate = room ? Number(room.price) : 0
  const credit = nightsLeft * oldRate
  const cost = nightsLeft * newRate
  const diff = credit - cost
  const affordable = newRate ? Math.floor(credit / newRate) : 0
  const top = keep * newRate - credit
  const needsMethod = option === 'refund' || option === 'topup' || (option === 'split' && top > 0)

  type Opt = { id: RoomChangeOption; icon: LucideIcon; title: string; detail: string; off?: string }
  const left = (a: number) => (a > 0 ? ` Leftover ${formatMoney(a)} stays as credit.` : '')
  const options: Opt[] = !room || nightsLeft < 1 ? []
    : diff === 0 ? [
        { id: 'switch', icon: ArrowLeftRight, title: 'Switch rooms', detail: `Same nightly rate — nothing to settle. Still out ${fmtDT(b.end)}.` },
      ]
    : diff > 0 ? (() => {
        const extra = Math.floor(diff / newRate)
        const extendedEnd = endMs + extra * DAY
        return [
          { id: 'refund', icon: Banknote, title: 'Refund the balance', detail: `Hand ${formatMoney(diff)} back to the guest — pick the channel below.` },
          { id: 'extend', icon: CalendarPlus, title: 'Extend the stay',
            detail: `The balance buys ${extra} extra ${extra === 1 ? 'night' : 'nights'} — checks out ${fmtDT(new Date(extendedEnd).toISOString())}.${left(diff - extra * newRate)}`,
            off: extra < 1
              ? `The balance can't buy one night in ${room.name} — refund it or take a voucher.`
              : busyRooms(extendedEnd).has(room.id) ? `${room.name} is booked during the extra nights.` : undefined },
          { id: 'voucher', icon: Ticket, title: 'Take a voucher', detail: `Issue a ${formatMoney(diff)} voucher — the guest spends it on a future stay. It never expires.` },
        ]
      })()
    : [
        { id: 'topup', icon: Wallet, title: 'Top up the shortfall', detail: `Collect ${formatMoney(-diff)} to keep all ${nightsLeft} nights — still out ${fmtDT(b.end)}.` },
        { id: 'shorten', icon: CalendarMinus, title: 'Shorten the stay',
          detail: `The credit covers ${affordable} of ${nightsLeft} nights — checks out ${fmtDT(new Date(endMs - (nightsLeft - affordable) * DAY).toISOString())}.${left(credit - affordable * newRate)}`,
          off: affordable < 1 ? `The credit doesn't cover one night in ${room.name} — pick another room.` : undefined },
        { id: 'split', icon: CalendarClock, title: 'Shorten & top up', detail: 'Keep some nights, pay for the rest — set the split below.' },
      ]

  const pickRoom = (r: Room) => {
    setRoom(r)
    setOption('')
    setErr('')
    setKeep(Math.max(1, Math.min(nightsLeft, Math.floor(credit / Number(r.price)) + 1)))
  }

  /** Switching direction re-filters the list — a picked room may no longer
   *  fit, so the selection (and its settlement) resets. */
  const pickDir = (d?: 'up' | 'down') => {
    if (d === dir) return
    setDir(d)
    setRoom(null)
    setOption('')
    setErr('')
  }

  async function confirm() {
    if (!room || !option) return
    setBusy(true)
    setErr('')
    try {
      const r = await bnb.changeRoom(b.id, {
        room: room.id,
        option,
        nights: option === 'split' ? keep : undefined,
        method: needsMethod ? method : undefined,
        reference: ref.trim() || undefined,
      })
      onDone(r.booking, r.applied)
    } catch (e) {
      setErr(parseApiError(e).message)
      setBusy(false)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
      <motion.div
        role="dialog" aria-modal="true" aria-label={`${dir === 'up' ? 'Upgrade' : dir === 'down' ? 'Downgrade' : 'Change'} room for ${b.guest_name}`}
        initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className={`relative my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden shadow-2xl ${t.radius} ${t.root}`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-900/10 px-5 py-4 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid size-10 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
              {dir === 'up' ? <TrendingUp className="size-5" /> : dir === 'down' ? <TrendingDown className="size-5" /> : <ArrowLeftRight className="size-5" />}
            </span>
            <div className="min-w-0">
              <h3 className={`truncate text-base ${t.heading}`}>{dir === 'up' ? 'Upgrade room' : dir === 'down' ? 'Downgrade room' : 'Change room'}</h3>
              <p className={`text-xs ${t.muted}`}>{b.guest_name} · booking #{b.id}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`grid size-9 shrink-0 place-items-center ${t.radius} ${t.iconButton}`}>
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* The stay as it stands — nights already slept don't reprice. */}
          <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-xs ${t.radius} ${t.chip}`}>
            <span className="font-semibold">{b.room_name}</span>
            <span className={t.muted}>{fmtD(b.start)} → {fmtD(b.end)}</span>
            <span className={t.muted}>{nightsLeft} of {b.nights} {b.nights === 1 ? 'night' : 'nights'} left</span>
            <span className={t.muted}>{formatMoney(oldRate)}/night</span>
          </div>

          {nightsLeft < 1 ? (
            <Empty t={t} icon={CalendarClock} title="Stay ended" text="This booking has no unused nights left to move." />
          ) : (
            <>
              <section>
                <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>
                  {dir === 'up' ? 'Pricier rooms' : dir === 'down' ? 'Cheaper rooms' : 'New room'}
                </legend>
                <div className="mb-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Move direction">
                  {([
                    { id: undefined, icon: ArrowLeftRight, label: 'All rooms' },
                    { id: 'up', icon: TrendingUp, label: 'Upgrade' },
                    { id: 'down', icon: TrendingDown, label: 'Downgrade' },
                  ] as { id?: 'up' | 'down'; icon: LucideIcon; label: string }[]).map((d) => (
                    <button
                      key={d.label} type="button" role="radio" aria-checked={dir === d.id}
                      onClick={() => pickDir(d.id)}
                      className={`flex h-8 items-center gap-1.5 px-3 text-xs font-semibold transition ${t.radius} ${dir === d.id ? t.navActive : t.chip}`}
                    >
                      <d.icon className="size-3.5" /> {d.label}
                    </button>
                  ))}
                </div>
                <div className="relative mb-2">
                  <Search className={`pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 ${t.muted}`} />
                  <input
                    value={roomQ}
                    onChange={(e) => setRoomQ(e.target.value)}
                    placeholder="Search rooms…"
                    className={`h-9 w-full bg-transparent pl-9 pr-3 text-sm outline-none focus:ring-2 ${t.radius} ${t.chip} ${t.ring}`}
                  />
                </div>
                {live.loading && !live.data ? (
                  <Loading t={t} rows={2} />
                ) : !sorted.length ? (
                  <Empty t={t} icon={BedDouble}
                    title={dir === 'up' ? 'No pricier rooms' : dir === 'down' ? 'No cheaper rooms' : 'No other rooms'}
                    text={dir ? 'Pick All rooms above for a like-for-like swap.' : 'There is no other room in this branch to move into.'} />
                ) : !shown.length ? (
                  <p className={`px-3 py-2.5 text-xs ${t.radius} ${t.chip}`}>No rooms match your search.</p>
                ) : (
                  <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2" role="radiogroup" aria-label="New room">
                    {shown.map((r) => {
                      const free = freeNow(r)
                      const sel = room?.id === r.id
                      const status = r.id === b.room ? 'Current room'
                        : companions.has(r.id) ? 'Held by a guest on this booking'
                        : r.status !== 'active' ? r.status_label
                        : blocked.has(r.id) ? 'Booked for that period'
                        : 'Available'
                      return (
                        <button
                          key={r.id} type="button" role="radio" aria-checked={sel}
                          disabled={!free && !sel}
                          onClick={() => pickRoom(r)}
                          className={`flex items-center gap-3 p-2.5 text-left transition disabled:cursor-not-allowed ${t.radius} ${
                            sel ? t.navActive : free ? `${t.chip} ${t.cardHover}` : `${t.chip} opacity-50`
                          }`}
                        >
                          <span className={`grid size-12 shrink-0 place-items-center overflow-hidden ${t.radius} ${sel ? 'bg-white/15' : t.iconBox}`}>
                            {r.photo ? <img src={r.photo} alt="" loading="lazy" className="size-full object-cover" /> : <BedDouble className="size-5" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{r.name}</span>
                            <span className={`block truncate text-[11px] ${sel ? 'opacity-75' : t.muted}`}>
                              {r.type_label} · {formatMoney(r.price)}/night · sleeps {r.capacity}
                            </span>
                            <span className={`mt-0.5 block truncate text-[10px] font-medium uppercase tracking-wide ${
                              free ? (sel ? 'opacity-80' : 'text-emerald-600 dark:text-emerald-400') : 'opacity-60'
                            }`}>
                              {status}
                            </span>
                          </span>
                          {sel && <Check className="size-4 shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </section>

              {room && (
                <>
                  {/* The quote — the server re-runs the same math before applying. */}
                  <div className={`grid gap-1 px-3 py-2.5 text-xs ${t.radius} ${t.chip}`}>
                    <p className="flex justify-between"><span className={t.muted}>Remaining credit · {nightsLeft} {nightsLeft === 1 ? 'night' : 'nights'} × {formatMoney(oldRate)}</span><b>{formatMoney(credit)}</b></p>
                    <p className="flex justify-between"><span className={t.muted}>New room cost · {nightsLeft} × {formatMoney(newRate)}</span><b>{formatMoney(cost)}</b></p>
                    <p className="flex justify-between"><span className="font-medium">Difference</span>
                      <b className={diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : diff < 0 ? 'text-amber-600 dark:text-amber-400' : ''}>
                        {diff === 0 ? 'Even — nothing to settle' : diff > 0 ? `${formatMoney(diff)} back to the guest` : `${formatMoney(-diff)} to collect`}
                      </b>
                    </p>
                  </div>

                  <section>
                    <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>
                      {diff === 0 ? 'Confirm the move' : 'Settle the difference'}
                    </legend>
                    <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Settle the difference">
                      {options.map((o) => {
                        const sel = option === o.id
                        return (
                          <button
                            key={o.id} type="button" role="radio" aria-checked={sel}
                            disabled={!!o.off} title={o.off}
                            onClick={() => setOption(o.id)}
                            className={`flex flex-col gap-1.5 p-3 text-left transition disabled:cursor-not-allowed ${t.radius} ${
                              sel ? t.navActive : o.off ? `${t.chip} opacity-50` : `${t.chip} ${t.cardHover}`
                            }`}
                          >
                            <span className="flex items-center gap-1.5 text-xs font-semibold"><o.icon className="size-3.5" /> {o.title}</span>
                            <span className={`text-[11px] ${sel ? 'opacity-80' : t.muted}`}>{o.off || o.detail}</span>
                          </button>
                        )
                      })}
                    </div>
                  </section>

                  {option === 'split' && (
                    <div className={`flex flex-wrap items-center gap-3 px-3 py-2.5 text-xs ${t.radius} ${t.chip}`}>
                      <span className={t.muted}>Nights to keep in {room.name}</span>
                      <div className="flex items-center gap-1">
                        <button type="button" aria-label="Fewer nights" disabled={keep <= 1} onClick={() => setKeep((k) => Math.max(1, k - 1))}
                          className={`grid size-7 place-items-center disabled:opacity-40 ${t.radius} ${t.iconButton}`}><Minus className="size-3.5" /></button>
                        <span className="min-w-14 text-center text-sm font-semibold tabular-nums">{keep} {keep === 1 ? 'night' : 'nights'}</span>
                        <button type="button" aria-label="More nights" disabled={keep >= nightsLeft} onClick={() => setKeep((k) => Math.min(nightsLeft, k + 1))}
                          className={`grid size-7 place-items-center disabled:opacity-40 ${t.radius} ${t.iconButton}`}><Plus className="size-3.5" /></button>
                      </div>
                      <span className={t.muted}>
                        Checks out {fmtDT(new Date(endMs - (nightsLeft - keep) * DAY).toISOString())}
                        {' · '}{top > 0 ? `top up ${formatMoney(top)}` : `leftover ${formatMoney(-top)} stays as credit`}
                      </span>
                    </div>
                  )}

                  {needsMethod && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Select t={t} label={option === 'refund' ? 'Refund through' : 'Paid via'} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                        {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </Select>
                      <Input t={t} label="Reference (optional)" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Receipt or transaction ref" />
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {err && <p className={`px-3 py-2.5 text-xs text-rose-500 ${t.radius} ${t.chip}`}>{err}</p>}
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-900/10 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/10">
          <Button t={t} variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button t={t} busy={busy} disabled={!room || !option} onClick={() => void confirm()}>
            <Check className="size-4" /> Confirm change
          </Button>
        </footer>
      </motion.div>
    </motion.div>
  )
}

/** Success flash for a recorded payment — mentions the nights when the stay stretched. */
const payText = (b: Booking, a: PayResult['applied'], next: Booking) =>
  a.extra_nights
    ? `Collected ${formatMoney(a.amount)} — ${b.guest_name} stays ${a.extra_nights} extra ${a.extra_nights === 1 ? 'night' : 'nights'}, out ${fmtDT(next.end)}.`
    : `Collected ${formatMoney(a.amount)} on ${b.guest_name}'s booking.`

/** A top-up on a live stay — record a payment, and optionally buy extra nights
 *  on the same room at its nightly rate. Money needs the counter till open and,
 *  for a receptionist, it must be their own session. */
function PayStay({ t, b, rooms, me, onClose, onDone }: {
  t: WorkspaceTheme
  b: Booking
  rooms: Room[]
  me: Employee
  onClose: () => void
  onDone: (next: Booking, applied: PayResult['applied']) => void
}) {
  const tills = useApi(() => bnb.tills({ open: '1' }))
  const live = useApi(() => bnb.bookings({ active: '1', limit: 500 }))
  const [extra, setExtra] = useState(0)
  const [amount, setAmount] = useState('')
  const [dirty, setDirty] = useState(false)
  const [method, setMethod] = useState<PaymentMethod | ''>('')
  const [ref, setRef] = useState('')
  const [paidAt, setPaidAt] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const now = useNow(30_000).getTime()
  // Time paid defaults to now (ticking until the receptionist overrides it).
  const shownPaidAt = paidAt || localDT(new Date(now))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const open = (tills.data ?? []).find((s) => s.status === 'open')
  const mine = !!open && (me.role !== 'branch_receptionist' || open.opened_by === me.id)
  const tillBlock = tills.loading && !tills.data ? ''
    : !open ? 'The till is closed — open it on the Counter page before collecting money.'
    : !mine ? `${open.opened_by_name ?? 'Another receptionist'} has the till open — only they can collect.` : ''

  const endMs = new Date(b.end).getTime()
  const rate = Number(rooms.find((r) => r.id === b.room)?.price ?? 0)
  const due = Math.max(0, Number(b.bill) - Number(b.paid))
  const extCost = extra * rate
  const newEndMs = endMs + extra * DAY
  // Another live booking on the same room blocks the extension window.
  const extClash = extra > 0 && (live.data ?? []).some(
    (x) => x.id !== b.id && x.room === b.room && new Date(x.start).getTime() < newEndMs && new Date(x.end).getTime() > endMs,
  )
  const extShort = extra > 0 && newEndMs <= now

  // Prefills — the extension cost when extending, else the balance still due — until typed over.
  const shown = dirty ? amount : (extra ? String(extCost) : due > 0 ? String(due) : '')
  const needsRef = (m: PaymentMethod | '') => m === 'mpesa' || m === 'visa' || m === 'bank'
  const ok = Number(shown) > 0 && !!method && (!needsRef(method) || !!ref.trim()) && !extClash && !extShort && !tillBlock

  async function confirm() {
    if (!ok || !method) return
    setBusy(true)
    setErr('')
    try {
      const r = await bnb.payBooking(b.id, {
        amount: Number(shown),
        method,
        reference: method === 'cash' ? undefined : ref.trim() || undefined,
        paid_at: new Date(shownPaidAt).toISOString(),
        extend_nights: extra > 0 ? extra : undefined,
      })
      // The paid receipt prints straight away — the same copy the
      // transactions list can reprint later.
      try {
        const p = (r.booking.payments ?? []).find((x) => x.receipt_number === r.applied.receipt)
        if (p) await printPaymentReceipt(r.booking, receiptPayment(p))
      } catch { /* Printing is best-effort — the payment is already recorded. */ }
      onDone(r.booking, r.applied)
    } catch (e) {
      setErr(parseApiError(e).message)
      setBusy(false)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
      <motion.div
        role="dialog" aria-modal="true" aria-label={`Pay for ${b.guest_name}`}
        initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className={`relative my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden shadow-2xl ${t.radius} ${t.root}`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-900/10 px-5 py-4 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid size-10 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
              <Banknote className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className={`truncate text-base ${t.heading}`}>Pay / top up</h3>
              <p className={`text-xs ${t.muted}`}>{b.guest_name} · booking #{b.id}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`grid size-9 shrink-0 place-items-center ${t.radius} ${t.iconButton}`}>
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* The stay and where the money stands. */}
          <div className={`grid gap-1 px-3 py-2.5 text-xs ${t.radius} ${t.chip}`}>
            <p className="flex justify-between"><span className={t.muted}>{b.room_name} · {fmtD(b.start)} → {fmtD(b.end)}</span><span className={t.muted}>{formatMoney(rate)}/night</span></p>
            <p className="flex justify-between"><span className={t.muted}>Billed</span><b>{formatMoney(b.bill)}</b></p>
            <p className="flex justify-between"><span className={t.muted}>Paid so far</span><b>{formatMoney(b.paid)}</b></p>
            <p className="flex justify-between"><span className="font-medium">Balance due</span>
              <b className={due > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                {due > 0 ? formatMoney(due) : 'Settled'}
              </b>
            </p>
          </div>

          {b.kind !== 'day_rest' && (
            <section>
              <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>Extend the stay</legend>
              <div className={`flex flex-wrap items-center gap-3 px-3 py-2.5 text-xs ${t.radius} ${t.chip}`}>
                <div className="flex items-center gap-1">
                  <button type="button" aria-label="Fewer nights" disabled={extra <= 0} onClick={() => setExtra((n) => Math.max(0, n - 1))}
                    className={`grid size-7 place-items-center disabled:opacity-40 ${t.radius} ${t.iconButton}`}><Minus className="size-3.5" /></button>
                  <span className="min-w-20 text-center text-sm font-semibold tabular-nums">
                    {extra ? `${extra} extra ${extra === 1 ? 'night' : 'nights'}` : 'No extension'}
                  </span>
                  <button type="button" aria-label="More nights" disabled={extra >= 365} onClick={() => setExtra((n) => Math.min(365, n + 1))}
                    className={`grid size-7 place-items-center disabled:opacity-40 ${t.radius} ${t.iconButton}`}><Plus className="size-3.5" /></button>
                </div>
                {extra > 0 && (
                  <span className={t.muted}>
                    New checkout {fmtDT(new Date(newEndMs).toISOString())} · {formatMoney(extCost)}
                  </span>
                )}
              </div>
              {extClash && <p className="mt-1.5 px-1 text-[11px] text-rose-500">{b.room_name} is booked after the current checkout — can't stretch into those nights.</p>}
              {extShort && <p className="mt-1.5 px-1 text-[11px] text-rose-500">That wouldn't reach tonight — add more nights or check the guest out.</p>}
            </section>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              t={t} label="Method" value={method} required
              onChange={(e) => {
                const m = e.target.value as PaymentMethod | ''
                setMethod(m)
                if (m === 'cash') setRef('')
              }}
            >
              <option value="" disabled>Pick a method</option>
              {PAYMENT_METHODS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
            <Input
              t={t} label="Amount received" type="number" min={0} step="0.01" required
              value={shown} onChange={(e) => { setAmount(e.target.value); setDirty(true) }}
            />
          </div>
          {method !== '' && method !== 'cash' && (
            <Input
              t={t} label={needsRef(method) ? 'Reference' : 'Reference (optional)'} required={needsRef(method)}
              value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())}
              placeholder="Transaction / M-Pesa code" autoComplete="off"
            />
          )}
          <Input
            t={t} label="Time paid" type="datetime-local"
            value={shownPaidAt} onChange={(e) => setPaidAt(e.target.value)}
          />

          {tillBlock && <p className={`px-3 py-2.5 text-xs ${t.radius} ${t.chip}`}>{tillBlock}</p>}
          {err && <p className={`px-3 py-2.5 text-xs text-rose-500 ${t.radius} ${t.chip}`}>{err}</p>}
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-900/10 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/10">
          <Button t={t} variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button t={t} busy={busy} disabled={!ok} onClick={() => void confirm()}>
            <Banknote className="size-4" /> Record payment
          </Button>
        </footer>
      </motion.div>
    </motion.div>
  )
}

/** Sell an extra package on a live stay — pick from the branch catalogue, say
 *  who it's for, and collect the price on the spot (or leave it on the bill).
 *  Collecting needs the counter till open and, for a receptionist, their own
 *  session — same rule as a top-up. */
function AddPackage({ t, b, me, onClose, onDone }: {
  t: WorkspaceTheme
  b: Booking
  me: Employee
  onClose: () => void
  onDone: (next: Booking, applied: AddPackageResult['applied']) => void
}) {
  const tills = useApi(() => bnb.tills({ open: '1' }))
  const catalogue = useApi(bnb.packages)
  const [pkg, setPkg] = useState<ExtraPackage | null>(null)
  const [guest, setGuest] = useState(0)
  const [payNow, setPayNow] = useState(true)
  const [method, setMethod] = useState<PaymentMethod | ''>('')
  const [ref, setRef] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const open = (tills.data ?? []).find((s) => s.status === 'open')
  const mine = !!open && (me.role !== 'branch_receptionist' || open.opened_by === me.id)
  const tillBlock = tills.loading && !tills.data ? ''
    : !open ? 'The till is closed — open it on the Counter page before collecting money.'
    : !mine ? `${open.opened_by_name ?? 'Another receptionist'} has the till open — only they can collect.` : ''

  const sellable = (catalogue.data ?? []).filter((p) => p.status === 'active')
  const party = [b.guest_name, ...(b.companions ?? []).map((c) => c.name)]
  const needsRef = (m: PaymentMethod | '') => m === 'mpesa' || m === 'visa' || m === 'bank'
  const ok = !!pkg && (!payNow || (!!method && (!needsRef(method) || !!ref.trim()) && !tillBlock))

  async function confirm() {
    if (!pkg || !ok) return
    setBusy(true)
    setErr('')
    try {
      const r = await bnb.addPackage(b.id, {
        package: pkg.id,
        guest,
        method: payNow ? (method as PaymentMethod) : undefined,
        reference: payNow && method !== 'cash' ? ref.trim() || undefined : undefined,
      })
      // Money collected on the spot gets its receipt printed, like a top-up.
      try {
        const p = (r.booking.payments ?? []).find((x) => x.receipt_number === r.applied.receipt)
        if (p) await printPaymentReceipt(r.booking, receiptPayment(p))
      } catch { /* Printing is best-effort — the sale is already recorded. */ }
      onDone(r.booking, r.applied)
    } catch (e) {
      setErr(parseApiError(e).message)
      setBusy(false)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
      <motion.div
        role="dialog" aria-modal="true" aria-label={`Add a package for ${b.guest_name}`}
        initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className={`relative my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden shadow-2xl ${t.radius} ${t.root}`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-900/10 px-5 py-4 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid size-10 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
              <PackagePlus className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className={`truncate text-base ${t.heading}`}>Add package</h3>
              <p className={`text-xs ${t.muted}`}>{b.guest_name} · booking #{b.id}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`grid size-9 shrink-0 place-items-center ${t.radius} ${t.iconButton}`}>
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* The stay the package lands on. */}
          <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5 text-xs ${t.radius} ${t.chip}`}>
            <span className="font-semibold">{b.room_name}</span>
            <span className={t.muted}>{fmtD(b.start)} → {fmtD(b.end)}</span>
            <span className={t.muted}>{stayLength(b)}</span>
          </div>

          <section>
            <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>Package</legend>
            {catalogue.loading && !catalogue.data ? (
              <Loading t={t} rows={2} />
            ) : !sellable.length ? (
              <Empty t={t} icon={Package} title="No packages on sale" text="The branch catalogue is empty — the manager registers packages under Extra packages." />
            ) : (
              <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2" role="radiogroup" aria-label="Package">
                {sellable.map((p) => {
                  const sel = pkg?.id === p.id
                  return (
                    <button
                      key={p.id} type="button" role="radio" aria-checked={sel}
                      onClick={() => setPkg(p)}
                      className={`flex items-center gap-3 p-2.5 text-left transition ${t.radius} ${
                        sel ? t.navActive : `${t.chip} ${t.cardHover}`
                      }`}
                    >
                      <span className={`grid size-11 shrink-0 place-items-center overflow-hidden ${t.radius} ${sel ? 'bg-white/15' : t.iconBox}`}>
                        {p.image ? <img src={p.image} alt="" loading="lazy" className="size-full object-cover" /> : <Package className="size-5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{p.name}</span>
                        <span className={`block truncate text-[11px] ${sel ? 'opacity-75' : t.muted}`}>
                          {p.category_label} · {formatMoney(p.amount)}
                        </span>
                      </span>
                      {sel && <Check className="size-4 shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            {party.length > 1 && (
              <Select t={t} label="For" value={guest} onChange={(e) => setGuest(Number(e.target.value))}>
                {party.map((name, i) => <option key={i} value={i}>{name}{i === 0 ? ' — main guest' : ''}</option>)}
              </Select>
            )}
            <label className={`flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-xs font-semibold ${t.radius} ${t.chip} ${party.length > 1 ? '' : 'sm:col-span-2'}`}>
              <input type="checkbox" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} className="size-4 shrink-0 accent-sky-600" />
              Collect {pkg ? formatMoney(pkg.amount) : 'payment'} now
              {!payNow && <span className={`font-normal ${t.muted}`}>— stays on the bill</span>}
            </label>
          </div>

          {payNow && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                t={t} label="Method" value={method} required
                onChange={(e) => {
                  const m = e.target.value as PaymentMethod | ''
                  setMethod(m)
                  if (m === 'cash') setRef('')
                }}
              >
                <option value="" disabled>Pick a method</option>
                {PAYMENT_METHODS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
              {method !== '' && method !== 'cash' && (
                <Input
                  t={t} label={needsRef(method) ? 'Reference' : 'Reference (optional)'} required={needsRef(method)}
                  value={ref} onChange={(e) => setRef(e.target.value)}
                  placeholder="Transaction / M-Pesa code" autoComplete="off"
                />
              )}
            </div>
          )}

          {payNow && tillBlock && <p className={`px-3 py-2.5 text-xs ${t.radius} ${t.chip}`}>{tillBlock}</p>}
          {err && <p className={`px-3 py-2.5 text-xs text-rose-500 ${t.radius} ${t.chip}`}>{err}</p>}
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-900/10 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/10">
          <Button t={t} variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button t={t} busy={busy} disabled={!ok} onClick={() => void confirm()}>
            <PackagePlus className="size-4" /> {payNow && pkg ? `Add & collect ${formatMoney(pkg.amount)}` : 'Add to bill'}
          </Button>
        </footer>
      </motion.div>
    </motion.div>
  )
}

/** Re-price a booking — the pen beside a Billed figure opens this. The typed
 *  total rewrites the room's agreed rate (nightly for a stay, the flat house
 *  charge for a day rest); extras already on the bill stay on top. Landing the
 *  total on the room's listed price clears the override instead of pinning it. */
function EditBill({ t, b, rooms, onClose, onDone }: {
  t: WorkspaceTheme
  b: Booking
  rooms: Room[]
  onClose: () => void
  onDone: (next: Booking) => void
}) {
  const dayRest = b.kind === 'day_rest'
  const days = dayRest ? 1 : b.nights
  const room = rooms.find((r) => r.id === b.room)
  const listed = room ? Number(dayRest ? (room.day_rest_price ?? room.price) : room.price) : null
  // The bill is rooms + extras — extras are extra packages (snapshot when sold)
  // plus any companion rooms. When the main room's effective rate is known the
  // extras are exact; without it the packages sum is the floor.
  const effRate = b.rate != null ? Number(b.rate) : listed
  const extras = effRate != null
    ? Number(b.bill) - effRate * days
    : (b.packages ?? []).reduce((n, p) => n + Number(p.amount), 0)
  const [total, setTotal] = useState(String(Number(b.bill)))
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const target = total.trim() === '' ? NaN : Number(total)
  // The rate the total implies — the server keeps two decimals on the rate, so
  // odd totals can land the bill a cent off what was typed; the preview says so.
  const rawRate = (target - extras) / days
  const rate = Number.isFinite(rawRate) ? Math.round(rawRate * 100) / 100 : NaN
  const valid = Number.isFinite(target) && target >= 0 && rawRate >= 0
  const nextBill = valid ? rate * days + extras : NaN
  const ok = valid && Math.abs(nextBill - Number(b.bill)) > 0.005

  async function confirm() {
    if (!ok) return
    setBusy(true)
    setErr('')
    try {
      const next = await bnb.updateBooking(b.id, { rate: listed != null && rate === listed ? null : rate })
      onDone(next)
    } catch (e) {
      setErr(parseApiError(e).message)
      setBusy(false)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
      <motion.div
        role="dialog" aria-modal="true" aria-label={`Edit the billing price for ${b.guest_name}`}
        initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className={`relative my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden shadow-2xl ${t.radius} ${t.root}`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-900/10 px-5 py-4 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid size-10 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
              <Pencil className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className={`truncate text-base ${t.heading}`}>Edit billing</h3>
              <p className={`text-xs ${t.muted}`}>{b.guest_name} · booking #{b.id}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`grid size-9 shrink-0 place-items-center ${t.radius} ${t.iconButton}`}>
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* The stay and where the money stands. */}
          <div className={`grid gap-1 px-3 py-2.5 text-xs ${t.radius} ${t.chip}`}>
            <p className="flex justify-between"><span className={t.muted}>{b.room_name} · {fmtD(b.start)} → {fmtD(b.end)}</span><span className={t.muted}>{stayLength(b)}</span></p>
            <p className="flex justify-between"><span className={t.muted}>Billed now</span><b>{formatMoney(b.bill)}</b></p>
            <p className="flex justify-between"><span className={t.muted}>Paid so far</span><b>{formatMoney(b.paid)}</b></p>
          </div>

          <Input
            t={t} label="New billing total" type="number" min={0} step="0.01" required
            value={total} onChange={(e) => { setTotal(e.target.value); setErr('') }}
          />

          {valid ? (
            <div className={`grid gap-1 px-3 py-2.5 text-xs ${t.radius} ${t.chip}`}>
              <p className="flex justify-between">
                <span className={t.muted}>
                  {dayRest ? `House charge ${formatMoney(rate)}` : `${days} ${days === 1 ? 'night' : 'nights'} × ${formatMoney(rate)}`}
                  {extras > 0 ? ` + extras ${formatMoney(extras)}` : ''}
                </span>
                <b>{formatMoney(nextBill)}</b>
              </p>
              {listed != null && rate !== listed && (
                <p className={t.muted}>{b.room_name} lists at {formatMoney(listed)}{dayRest ? '' : ' / night'} — a total of {formatMoney(listed * days + extras)} reverts to it.</p>
              )}
            </div>
          ) : (
            <p className={`px-3 py-2.5 text-xs text-rose-500 ${t.radius} ${t.chip}`}>
              {Number.isFinite(target) && target < extras
                ? `The bill can't go below the extras already on it (${formatMoney(extras)}).`
                : 'Enter the new billing total.'}
            </p>
          )}
          {err && <p className={`px-3 py-2.5 text-xs text-rose-500 ${t.radius} ${t.chip}`}>{err}</p>}
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-900/10 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/10">
          <Button t={t} variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button t={t} busy={busy} disabled={!ok} onClick={() => void confirm()}>
            <Check className="size-4" /> Save billing
          </Button>
        </footer>
      </motion.div>
    </motion.div>
  )
}
