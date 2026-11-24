import { motion } from 'framer-motion'
import { BedDouble, Building2, CalendarCheck, Clock, Search, Users, Wrench } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Empty, ErrorNote, Loading, PageHeader, Panel, Pill, Stat, type Tone } from '../components/hr/ui'
import type { Employee } from '../lib/api'
import { bnb, type Booking, type Room } from '../lib/bnb'
import { formatMoney, useApi } from '../lib/hr'
import type { NavItem, WorkspaceTheme } from '../lib/workspaces'

const fmtDT = (iso: string) =>
  new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

type State = 'free' | 'occupied' | 'reserved' | 'unavailable'

const STATE_TONE: Record<State, Tone> = { free: 'green', occupied: 'blue', reserved: 'amber', unavailable: 'red' }
const STATE_LABEL: Record<State, string> = { free: 'Free', occupied: 'Occupied', reserved: 'Reserved', unavailable: 'Unavailable' }
const FILTERS: { value: State | 'all'; label: string }[] = [
  { value: 'all', label: 'All rooms' },
  { value: 'free', label: 'Free' },
  { value: 'occupied', label: 'Occupied' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'unavailable', label: 'Unavailable' },
]

/** A room's live state right now — occupied beats a pending reservation. */
function stateOf(room: Room, occupied: Booking | undefined, next: Booking | undefined): State {
  if (occupied) return 'occupied'
  if (room.status !== 'active') return 'unavailable'
  if (next) return 'reserved'
  return 'free'
}

export default function RoomAvailabilityPage({ item, t, me }: { item: NavItem; t: WorkspaceTheme; me: Employee }) {
  const rooms = useApi(bnb.rooms)
  const bookings = useApi(bnb.bookings)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<State | 'all'>('all')

  const live = useMemo(() => (bookings.data ?? []).filter((b) => b.status === 'occupied' || b.status === 'reserved'), [bookings.data])
  const occupiedBy = useMemo(() => new Map(live.filter((b) => b.status === 'occupied').map((b) => [b.room, b])), [live])
  const nextBy = useMemo(() => {
    const m = new Map<number, Booking>()
    for (const b of live.filter((x) => x.status === 'reserved').sort((a, b2) => a.start.localeCompare(b2.start)))
      if (!m.has(b.room)) m.set(b.room, b)
    return m
  }, [live])

  const rows = useMemo(
    () =>
      (rooms.data ?? []).map((r) => {
        const occ = occupiedBy.get(r.id)
        const next = nextBy.get(r.id)
        return { room: r, occ, next, state: stateOf(r, occ, next) }
      }),
    [rooms.data, occupiedBy, nextBy],
  )
  const count = (s: State) => rows.filter((r) => r.state === s).length
  const list = rows.filter(
    ({ room, occ, next, state }) =>
      (filter === 'all' || state === filter) &&
      (!q || `${room.name} ${room.type_label} ${occ?.guest_name ?? ''} ${next?.guest_name ?? ''}`.toLowerCase().includes(q.toLowerCase())),
  )

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
            text="Your account isn't assigned to a BnB branch, so there are no rooms to show. Ask your manager or IT support to allocate you."
          />
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat t={t} i={0} icon={BedDouble} label="Free now" value={rooms.data ? count('free') : '—'} />
            <Stat t={t} i={1} icon={Users} label="Occupied" value={rooms.data ? count('occupied') : '—'} />
            <Stat t={t} i={2} icon={CalendarCheck} label="Reserved" value={rooms.data ? count('reserved') : '—'} />
            <Stat t={t} i={3} icon={Wrench} label="Unavailable" value={rooms.data ? count('unavailable') : '—'} />
          </div>

          <Panel t={t} title="Rooms">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative sm:max-w-xs sm:flex-1">
                <Search className={`pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 ${t.muted}`} />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search room or guest"
                  className={`h-10 w-full bg-transparent pl-9 pr-3 text-sm outline-none focus:ring-2 ${t.radius} ${t.chip} ${t.ring}`}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFilter(f.value)}
                    aria-pressed={filter === f.value}
                    className={`h-8 px-3 text-xs font-semibold transition ${t.radius} ${filter === f.value ? t.navActive : t.chip}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {error ? (
              <ErrorNote t={t} message={error} onRetry={() => { rooms.reload(); bookings.reload() }} />
            ) : loading ? (
              <Loading t={t} />
            ) : !list.length ? (
              <Empty
                t={t}
                icon={BedDouble}
                title={rows.length ? 'No rooms match' : 'No rooms yet'}
                text={rows.length ? 'Try a different search or filter.' : 'The branch manager can register rooms from Room management.'}
              />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.map(({ room, occ, next, state }, i) => (
                  <RoomCard key={room.id} t={t} room={room} occ={occ} next={next} state={state} i={i} />
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  )
}

function RoomCard({ t, room, occ, next, state, i }: { t: WorkspaceTheme; room: Room; occ?: Booking; next?: Booking; state: State; i: number }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
      className={`flex items-center gap-3 p-3 ${t.radius} ${t.card} ${t.cardHover}`}
    >
      {room.photo ? (
        <img src={room.photo} alt="" loading="lazy" className={`size-14 shrink-0 object-cover ${t.radius}`} />
      ) : (
        <span className={`grid size-14 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
          <BedDouble className="size-6" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold">{room.name}</p>
          <Pill tone={STATE_TONE[state]}>{state === 'unavailable' ? room.status_label : STATE_LABEL[state]}</Pill>
        </div>
        <p className={`truncate text-xs ${t.muted}`}>
          {room.type_label} · {room.capacity} {room.capacity === 1 ? 'guest' : 'guests'} · {formatMoney(room.price)}/night
        </p>
        <p className={`truncate text-xs ${state === 'free' ? t.muted : ''}`}>
          {occ && <><Clock className="mr-1 inline size-3" />{occ.guest_name} — out {fmtDT(occ.end)}</>}
          {!occ && next && <><CalendarCheck className="mr-1 inline size-3" />{next.guest_name} — in {fmtDT(next.start)}</>}
          {!occ && !next && room.status !== 'active' && <><Wrench className="mr-1 inline size-3" />{room.status_reason || room.status_label}</>}
          {!occ && !next && room.status === 'active' && 'Ready for the next guest'}
        </p>
      </div>
    </motion.li>
  )
}
