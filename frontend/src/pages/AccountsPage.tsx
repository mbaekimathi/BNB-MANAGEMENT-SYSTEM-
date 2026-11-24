import { AnimatePresence, motion } from 'framer-motion'
import { BedDouble, Building2, CalendarCheck, ChevronDown, Moon, Search, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Empty, ErrorNote, Loading, PageHeader, Panel, Pill, Stat, type Tone } from '../components/hr/ui'
import type { Employee } from '../lib/api'
import { bnb, type Booking, type BookingStatus, type Room } from '../lib/bnb'
import { formatMoney, useApi } from '../lib/hr'
import type { NavItem, WorkspaceTheme } from '../lib/workspaces'

const fmtD = (iso: string) => new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' })
const STATUS_TONE: Record<BookingStatus, Tone> = { reserved: 'amber', occupied: 'blue', completed: 'slate', cancelled: 'red' }

/** Bookings that carry money — cancelled ones collected nothing. */
const PAYS = (b: Booking) => b.status !== 'cancelled'
const charge = (b: Booking, price: string) => b.nights * Number(price)

export default function AccountsPage({ item, t, me }: { item: NavItem; t: WorkspaceTheme; me: Employee }) {
  const rooms = useApi(bnb.rooms)
  const bookings = useApi(bnb.bookings)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Set<number>>(new Set())

  const rows = useMemo(() => {
    const byRoom = new Map<number, Booking[]>()
    for (const b of (bookings.data ?? []).filter(PAYS)) {
      const l = byRoom.get(b.room) ?? []
      l.push(b)
      byRoom.set(b.room, l)
    }
    return (rooms.data ?? [])
      .map((room) => {
        const list = (byRoom.get(room.id) ?? []).sort((a, b) => b.start.localeCompare(a.start))
        return {
          room, list,
          nights: list.reduce((n, b) => n + b.nights, 0),
          billed: list.reduce((n, b) => n + charge(b, room.price), 0),
          deposits: list.reduce((n, b) => n + Number(b.deposit ?? 0), 0),
        }
      })
      .sort((a, b) => a.room.name.localeCompare(b.room.name, undefined, { numeric: true }))
  }, [rooms.data, bookings.data])

  const totals = useMemo(
    () => rows.reduce((a, r) => ({ nights: a.nights + r.nights, billed: a.billed + r.billed, deposits: a.deposits + r.deposits }), { nights: 0, billed: 0, deposits: 0 }),
    [rows],
  )
  const list = rows.filter(({ room, list: bl }) => !q || `${room.name} ${room.type_label} ${bl.map((b) => b.guest_name).join(' ')}`.toLowerCase().includes(q.toLowerCase()))

  const toggle = (id: number) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const loading = (rooms.loading || bookings.loading) && !rooms.data
  const error = rooms.error || bookings.error

  return (
    <div className="space-y-5">
      <PageHeader t={t} icon={item.icon} title={item.label} text={item.description} />

      {!me.branch ? (
        <Panel t={t}>
          <Empty
            t={t}
            icon={Building2}
            title="No branch allocated yet"
            text="Your account isn't assigned to a BnB branch, so there are no accounts to show. Ask your manager or IT support to allocate you."
          />
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat t={t} i={0} icon={Wallet} label="Total billed" value={bookings.data ? formatMoney(totals.billed) : '—'} />
            <Stat t={t} i={1} icon={CalendarCheck} label="Deposits held" value={bookings.data ? formatMoney(totals.deposits) : '—'} />
            <Stat t={t} i={2} icon={Moon} label="Nights booked" value={bookings.data ? totals.nights : '—'} />
          </div>

          <Panel t={t} title="Room accounts">
            <div className="relative mb-4 sm:max-w-xs">
              <Search className={`pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 ${t.muted}`} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search room or guest"
                className={`h-10 w-full bg-transparent pl-9 pr-3 text-sm outline-none focus:ring-2 ${t.radius} ${t.chip} ${t.ring}`}
              />
            </div>

            {error ? (
              <ErrorNote t={t} message={error} onRetry={() => { rooms.reload(); bookings.reload() }} />
            ) : loading ? (
              <Loading t={t} />
            ) : !list.length ? (
              <Empty
                t={t}
                icon={BedDouble}
                title={rows.length ? 'No rooms match your search' : 'No rooms yet'}
                text={rows.length ? 'Try a different search.' : 'The branch manager can register rooms from Room management.'}
              />
            ) : (
              <ul className="space-y-2">
                {list.map((r, i) => (
                  <RoomAccount key={r.room.id} t={t} r={r} i={i} open={open.has(r.room.id)} onToggle={() => toggle(r.room.id)} />
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  )
}

type RoomRow = { room: Room; list: Booking[]; nights: number; billed: number; deposits: number }

function RoomAccount({ t, r, i, open, onToggle }: { t: WorkspaceTheme; r: RoomRow; i: number; open: boolean; onToggle: () => void }) {
  const { room, list, nights, billed, deposits } = r
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
      className={`overflow-hidden ${t.radius} ${t.card}`}
    >
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 p-3 text-left">
        {room.photo ? (
          <img src={room.photo} alt="" loading="lazy" className={`size-11 shrink-0 object-cover ${t.radius}`} />
        ) : (
          <span className={`grid size-11 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
            <BedDouble className="size-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{room.name} <span className={`font-normal ${t.muted}`}>· {room.type_label} · {formatMoney(room.price)}/night</span></p>
          <p className={`truncate text-xs ${t.muted}`}>
            {list.length ? `${nights} ${nights === 1 ? 'night' : 'nights'} booked · billed ${formatMoney(billed)}${deposits ? ` · deposits ${formatMoney(deposits)}` : ''}` : 'No payments yet'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden text-right sm:block">
            <span className="block text-sm font-semibold">{formatMoney(billed)}</span>
            <span className={`block text-[11px] ${t.muted}`}>{nights} {nights === 1 ? 'night' : 'nights'}</span>
          </span>
          <ChevronDown className={`size-4 transition-transform ${t.muted} ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <div className="border-t border-slate-900/10 px-3 py-2 dark:border-white/10">
              {!list.length ? (
                <p className={`py-2 text-xs ${t.muted}`}>No bookings or payments recorded for this room yet.</p>
              ) : (
                <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-left text-xs">
                  <thead>
                    <tr className={t.muted}>
                      <th className="py-1.5 pr-3 font-medium">Guest</th>
                      <th className="py-1.5 pr-3 font-medium">Period</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Days</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Deposit</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Charge</th>
                      <th className="py-1.5 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((b) => (
                      <tr key={b.id} className="border-t border-slate-900/5 dark:border-white/5">
                        <td className="py-2 pr-3">
                          <span className="block font-medium">{b.guest_name}</span>
                          <span className={t.muted}>{b.guest_phone}</span>
                        </td>
                        <td className={`py-2 pr-3 ${t.muted}`}>{fmtD(b.start)} → {fmtD(b.end)}</td>
                        <td className="py-2 pr-3 text-right font-medium">{b.nights}</td>
                        <td className="py-2 pr-3 text-right">{b.deposit ? formatMoney(b.deposit) : '—'}</td>
                        <td className="py-2 pr-3 text-right font-medium">{formatMoney(charge(b, room.price))}</td>
                        <td className="py-2 text-right"><Pill tone={STATUS_TONE[b.status]}>{b.status_label}</Pill></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  )
}
