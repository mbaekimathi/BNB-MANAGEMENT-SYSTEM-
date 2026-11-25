import { AnimatePresence, motion } from 'framer-motion'
import {
  BedDouble, CalendarCheck, ChevronDown, Construction, CreditCard, Receipt,
  Search, Undo2, UtensilsCrossed, Wallet, type LucideIcon,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Empty, ErrorNote, Loading, Panel, Pill, Stat, type Tone } from '../../components/hr/ui'
import { bnb, stayLength, type Booking, type BookingStatus, type Room, type RoomAccountRow } from '../../lib/bnb'
import { formatMoney, useApi } from '../../lib/hr'
import type { WorkspaceTheme } from '../../lib/workspaces'
import type { AccountPageProps } from './types'

const fmtD = (iso: string) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' })
const fmtDT = (iso: string) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const STATUS_TONE: Record<BookingStatus, Tone> = { reserved: 'amber', occupied: 'blue', completed: 'slate', cancelled: 'red' }

const charge = (b: Booking) => Number(b.bill)
const paidIn = (b: Booking) => Number(b.deposit ?? 0) + b.payments.reduce((s, p) => s + Number(p.amount), 0)

type TabKey = 'revenue' | 'deposits' | 'advance' | 'extra' | 'fnb' | 'refunds'

/** The six income categories — auto-filled ones read from bookings, the rest are placeholders. */
const TABS: { key: TabKey; label: string; icon: LucideIcon; soon?: boolean }[] = [
  { key: 'revenue', label: 'Room revenue', icon: BedDouble },
  { key: 'deposits', label: 'Deposits', icon: CalendarCheck },
  { key: 'advance', label: 'Advance payments', icon: CreditCard },
  { key: 'extra', label: 'Extra charges', icon: Receipt, soon: true },
  { key: 'fnb', label: 'Food & beverage sales', icon: UtensilsCrossed, soon: true },
  { key: 'refunds', label: 'Refunds & discounts', icon: Undo2 },
]

export default function IncomeRecords({ t }: AccountPageProps) {
  const rooms = useApi(bnb.rooms)
  const accounts = useApi(bnb.roomAccounts)
  const bookings = useApi(() => bnb.bookings({ limit: 500 }))
  const [tab, setTab] = useState<TabKey>('revenue')

  const live = useMemo(() => (bookings.data ?? []).filter((b) => b.status !== 'cancelled'), [bookings.data])
  const cancelled = useMemo(() => (bookings.data ?? []).filter((b) => b.status === 'cancelled'), [bookings.data])

  const totals = useMemo(
    () => ({
      billed: live.reduce((s, b) => s + charge(b), 0),
      deposits: live.reduce((s, b) => s + Number(b.deposit ?? 0), 0),
      advance: bookings.data?.flatMap((b) => b.payments).reduce((s, p) => s + Number(p.amount), 0) ?? 0,
      refunds:
        cancelled.reduce((s, b) => s + paidIn(b), 0) +
        live.reduce((s, b) => s + Math.max(0, -Number(b.balance)), 0),
    }),
    [live, cancelled, bookings.data],
  )

  const loading = (rooms.loading || accounts.loading || bookings.loading) && !bookings.data
  const error = rooms.error || accounts.error || bookings.error

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat t={t} i={0} icon={Wallet} label="Room revenue" value={bookings.data ? formatMoney(totals.billed) : '—'} hint="billed across live bookings" />
        <Stat t={t} i={1} icon={CalendarCheck} label="Deposits held" value={bookings.data ? formatMoney(totals.deposits) : '—'} />
        <Stat t={t} i={2} icon={CreditCard} label="Advance payments" value={bookings.data ? formatMoney(totals.advance) : '—'} hint="received on top of deposits" />
        <Stat t={t} i={3} icon={Undo2} label="Refunds due" value={bookings.data ? formatMoney(totals.refunds) : '—'} />
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            type="button"
            onClick={() => setTab(tb.key)}
            aria-pressed={tab === tb.key}
            className={`inline-flex h-9 items-center gap-2 px-3.5 text-xs font-semibold transition ${t.radius} ${
              tab === tb.key ? `${t.brandMark}` : `${t.chip} hover:brightness-95 dark:hover:brightness-125`
            }`}
          >
            <tb.icon className="size-3.5" />
            {tb.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
              tb.soon
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
            }`}>
              {tb.soon ? 'Soon' : 'Auto'}
            </span>
          </button>
        ))}
      </div>

      {error ? (
        <Panel t={t}>
          <ErrorNote t={t} message={error} onRetry={() => { rooms.reload(); accounts.reload(); bookings.reload() }} />
        </Panel>
      ) : loading ? (
        <Panel t={t}><Loading t={t} /></Panel>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            {tab === 'revenue' && <RoomRevenue t={t} rooms={rooms.data ?? []} accounts={accounts.data ?? []} />}
            {tab === 'deposits' && <Deposits t={t} bookings={live} />}
            {tab === 'advance' && <AdvancePayments t={t} bookings={bookings.data ?? []} />}
            {tab === 'extra' && (
              <Panel t={t}>
                <Empty
                  t={t}
                  icon={Construction}
                  title="Extra charges — coming soon"
                  text="Charges for laundry, late check-out, damages and other extras will be recorded here."
                />
              </Panel>
            )}
            {tab === 'fnb' && (
              <Panel t={t}>
                <Empty
                  t={t}
                  icon={Construction}
                  title="Food & beverage sales — coming soon"
                  text="Restaurant, bar and room-service sales will be recorded here."
                />
              </Panel>
            )}
            {tab === 'refunds' && <Refunds t={t} cancelled={cancelled} live={live} />}
          </motion.div>
        </AnimatePresence>
      )}
    </>
  )
}

const th = (t: WorkspaceTheme) => `px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider ${t.muted}`

/* ---------------- Room revenue — per-room expandable ledger ---------------- */

function RoomRevenue({ t, rooms, accounts }: { t: WorkspaceTheme; rooms: Room[]; accounts: RoomAccountRow[] }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Set<number>>(new Set())
  /** Per-room booking lists, fetched lazily the first time a room is expanded. */
  const [details, setDetails] = useState<Record<number, Booking[]>>({})
  const pending = useRef(new Set<number>())

  const rows = useMemo(() => {
    const acc = new Map(accounts.map((a) => [a.room, a]))
    return rooms
      .map((room) => ({ room, acc: acc.get(room.id) }))
      .sort((a, b) => a.room.name.localeCompare(b.room.name, undefined, { numeric: true }))
  }, [rooms, accounts])
  const list = rows.filter(({ room }) => !q || `${room.name} ${room.type_label}`.toLowerCase().includes(q.toLowerCase()))

  const toggle = (id: number) => {
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
    if (details[id] || pending.current.has(id)) return
    pending.current.add(id)
    bnb.bookings({ room: id, limit: 500 })
      .then((bs) => setDetails((d) => ({ ...d, [id]: bs })))
      .catch(() => setDetails((d) => ({ ...d, [id]: [] })))
      .finally(() => pending.current.delete(id))
  }

  return (
    <Panel t={t} title="Room revenue">
      <div className="relative mb-4 sm:max-w-xs">
        <Search className={`pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 ${t.muted}`} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search room or guest"
          className={`h-10 w-full bg-transparent pl-9 pr-3 text-sm outline-none focus:ring-2 ${t.radius} ${t.chip} ${t.ring}`}
        />
      </div>

      {!list.length ? (
        <Empty
          t={t}
          icon={BedDouble}
          title={rows.length ? 'No rooms match your search' : 'No rooms yet'}
          text={rows.length ? 'Try a different search.' : 'The branch manager can register rooms from Room management.'}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-left text-xs">
            <thead>
              <tr>
                <th className={th(t)}>Room</th>
                <th className={th(t)}>Type</th>
                <th className={`${th(t)} text-right`}>Rate / night</th>
                <th className={`${th(t)} text-right`}>Nights booked</th>
                <th className={`${th(t)} text-right`}>Deposits</th>
                <th className={`${th(t)} text-right`}>Billed</th>
                <th className={`${th(t)} text-right`}><span className="sr-only">Details</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <RoomAccount key={r.room.id} t={t} r={r} open={open.has(r.room.id)} bookings={details[r.room.id]} onToggle={() => toggle(r.room.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

type RoomRow = { room: Room; acc?: RoomAccountRow }

const ROOM_COLS = 7

function RoomAccount({ t, r, open, bookings, onToggle }: { t: WorkspaceTheme; r: RoomRow; open: boolean; bookings?: Booking[]; onToggle: () => void }) {
  const { room, acc } = r
  const nights = acc?.nights ?? 0
  const billed = Number(acc?.billed ?? 0)
  const deposits = Number(acc?.deposits ?? 0)
  return (
    <>
      <tr
        onClick={onToggle}
        aria-expanded={open}
        className="cursor-pointer border-t border-slate-900/5 transition hover:bg-slate-900/[0.03] dark:border-white/5 dark:hover:bg-white/[0.03]"
      >
        <td className="px-3 py-2.5">
          <span className="flex items-center gap-2.5">
            {room.photo ? (
              <img src={room.photo} alt="" loading="lazy" className="size-8 shrink-0 rounded-md object-cover" />
            ) : (
              <span className={`grid size-8 shrink-0 place-items-center rounded-md ${t.iconBox}`}>
                <BedDouble className="size-4" />
              </span>
            )}
            <span className="truncate text-sm font-medium">{room.name}</span>
          </span>
        </td>
        <td className={`px-3 py-2.5 ${t.muted}`}>{room.type_label}</td>
        <td className="px-3 py-2.5 text-right">{formatMoney(room.price)}</td>
        <td className="px-3 py-2.5 text-right">{acc?.bookings ? `${nights} ${nights === 1 ? 'night' : 'nights'}` : '—'}</td>
        <td className="px-3 py-2.5 text-right">{deposits ? formatMoney(deposits) : '—'}</td>
        <td className="px-3 py-2.5 text-right font-medium">{formatMoney(billed)}</td>
        <td className="px-3 py-2.5 text-right">
          <ChevronDown className={`inline size-4 transition-transform ${t.muted} ${open ? 'rotate-180' : ''}`} />
        </td>
      </tr>
      <AnimatePresence initial={false}>
        {open && (
          <tr className="bg-slate-900/[0.02] dark:bg-white/[0.02]">
            <td colSpan={ROOM_COLS} className="px-3 py-2">
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                {!bookings ? (
                  <Loading t={t} />
                ) : !bookings.length ? (
                  <p className={`py-2 text-xs ${t.muted}`}>No bookings or payments recorded for this room yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                  <table className="w-full min-w-[34rem] text-left text-xs">
                    <thead>
                      <tr className={t.muted}>
                        <th className="py-1.5 pr-3 font-medium">Guest</th>
                        <th className="py-1.5 pr-3 font-medium">Period</th>
                        <th className="py-1.5 pr-3 text-right font-medium">Length</th>
                        <th className="py-1.5 pr-3 text-right font-medium">Deposit</th>
                        <th className="py-1.5 pr-3 text-right font-medium">Charge</th>
                        <th className="py-1.5 text-right font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((b) => (
                        <tr key={b.id} className="border-t border-slate-900/5 dark:border-white/5">
                          <td className="py-2 pr-3">
                            <span className="block font-medium">{b.guest_name}</span>
                            <span className={t.muted}>{b.guest_phone}</span>
                          </td>
                          <td className={`py-2 pr-3 ${t.muted}`}>{fmtD(b.start)} → {fmtD(b.end)}</td>
                          <td className="py-2 pr-3 text-right font-medium">{stayLength(b)}</td>
                          <td className="py-2 pr-3 text-right">{b.deposit ? formatMoney(b.deposit) : '—'}</td>
                          <td className="py-2 pr-3 text-right font-medium">{formatMoney(charge(b))}</td>
                          <td className="py-2 text-right"><Pill tone={STATUS_TONE[b.status]}>{b.status_label}</Pill></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  )
}

/* ---------------- Deposits — bookings holding a deposit ---------------- */

function Deposits({ t, bookings }: { t: WorkspaceTheme; bookings: Booking[] }) {
  const rows = bookings.filter((b) => Number(b.deposit ?? 0) > 0)
  return (
    <Panel t={t} title="Deposits held">
      {!rows.length ? (
        <Empty t={t} icon={CalendarCheck} title="No deposits yet" text="Deposits taken on reservations and stays appear here automatically." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[38rem] text-left text-xs">
            <thead>
              <tr>
                <th className={th(t)}>Guest</th>
                <th className={th(t)}>Room</th>
                <th className={th(t)}>Period</th>
                <th className={`${th(t)} text-right`}>Deposit</th>
                <th className={`${th(t)} text-right`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-t border-slate-900/5 dark:border-white/5">
                  <td className="px-3 py-2.5">
                    <span className="block text-sm font-medium">{b.guest_name}</span>
                    <span className={t.muted}>{b.guest_phone}</span>
                  </td>
                  <td className="px-3 py-2.5">{b.room_name}</td>
                  <td className={`px-3 py-2.5 ${t.muted}`}>{fmtD(b.start)} → {fmtD(b.end)}</td>
                  <td className="px-3 py-2.5 text-right font-medium">{formatMoney(b.deposit ?? 0)}</td>
                  <td className="px-3 py-2.5 text-right"><Pill tone={STATUS_TONE[b.status]}>{b.status_label}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

/* ---------------- Advance payments — every payment row recorded on a booking ---------------- */

function AdvancePayments({ t, bookings }: { t: WorkspaceTheme; bookings: Booking[] }) {
  const rows = bookings
    .flatMap((b) => b.payments.map((p) => ({ b, p })))
    .sort((a, z) => z.p.created_at.localeCompare(a.p.created_at))
  return (
    <Panel t={t} title="Advance payments received">
      {!rows.length ? (
        <Empty t={t} icon={CreditCard} title="No payments yet" text="Payments recorded on bookings appear here automatically." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-xs">
            <thead>
              <tr>
                <th className={th(t)}>Received</th>
                <th className={th(t)}>Payer</th>
                <th className={th(t)}>Booking</th>
                <th className={th(t)}>Method</th>
                <th className={th(t)}>Receipt / reference</th>
                <th className={`${th(t)} text-right`}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ b, p }) => (
                <tr key={p.id} className="border-t border-slate-900/5 dark:border-white/5">
                  <td className={`px-3 py-2.5 ${t.muted}`}>{fmtDT(p.created_at)}</td>
                  <td className="px-3 py-2.5 font-medium">{p.payer}</td>
                  <td className="px-3 py-2.5">
                    <span className="block">{b.guest_name}</span>
                    <span className={t.muted}>{b.room_name} · {fmtD(b.start)} → {fmtD(b.end)}</span>
                  </td>
                  <td className="px-3 py-2.5">{p.method_label}</td>
                  <td className={`px-3 py-2.5 ${t.muted}`}>
                    <span className="font-mono">{p.receipt_number}</span>{p.reference ? ` · ${p.reference}` : ''}
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium">{formatMoney(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

/* ---------------- Refunds & discounts — money owed back to guests ---------------- */

function Refunds({ t, cancelled, live }: { t: WorkspaceTheme; cancelled: Booking[]; live: Booking[] }) {
  const rows = [
    ...cancelled
      .filter((b) => paidIn(b) > 0)
      .map((b) => ({ b, reason: 'Booking cancelled — money received', due: paidIn(b) })),
    ...live
      .filter((b) => Number(b.balance) < 0)
      .map((b) => ({ b, reason: 'Guest overpaid their bill', due: -Number(b.balance) })),
  ]
  return (
    <Panel t={t} title="Refunds & discounts given">
      {!rows.length ? (
        <Empty
          t={t}
          icon={Undo2}
          title="No refunds due"
          text="Cancelled bookings that collected money, and guests who overpaid, appear here automatically."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-xs">
            <thead>
              <tr>
                <th className={th(t)}>Guest</th>
                <th className={th(t)}>Room</th>
                <th className={th(t)}>Reason</th>
                <th className={`${th(t)} text-right`}>Paid in</th>
                <th className={`${th(t)} text-right`}>Refund due</th>
                <th className={`${th(t)} text-right`}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ b, reason, due }) => (
                <tr key={`${b.id}-${reason}`} className="border-t border-slate-900/5 dark:border-white/5">
                  <td className="px-3 py-2.5">
                    <span className="block text-sm font-medium">{b.guest_name}</span>
                    <span className={t.muted}>{b.guest_phone}</span>
                  </td>
                  <td className="px-3 py-2.5">{b.room_name}</td>
                  <td className={`px-3 py-2.5 ${t.muted}`}>{reason}</td>
                  <td className="px-3 py-2.5 text-right">{formatMoney(paidIn(b))}</td>
                  <td className="px-3 py-2.5 text-right font-medium">{formatMoney(due)}</td>
                  <td className="px-3 py-2.5 text-right"><Pill tone={STATUS_TONE[b.status]}>{b.status_label}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > 0 && (
        <p className={`mt-3 text-[11px] ${t.muted}`}>
          Refund amounts are worked out from booking payments automatically.
        </p>
      )}
    </Panel>
  )
}
