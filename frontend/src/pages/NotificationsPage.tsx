import { AnimatePresence, motion } from 'framer-motion'
import { AlarmClock, ArrowUpRight, BedDouble, BellOff, BellRing, CheckCheck, Clock, LogOut, Phone } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Empty, Flash, LinkButton, PageHeader, Panel, Pill } from '../components/hr/ui'
import { parseApiError, type Employee } from '../lib/api'
import { bnb, clientKey, type Booking } from '../lib/bnb'
import { useApi } from '../lib/hr'
import { departCountdown, fmtTime, markAllNoticesRead, sameDay, useDeskNotices, type DeskNotice } from '../lib/notifications'
import { clientPath } from '../lib/roles'
import { useNow } from '../lib/time'
import type { NavItem, WorkspaceTheme } from '../lib/workspaces'

/** When a notice fired — a clock time today, date + time for older ones. */
const fmtFiredAt = (firedAt: number, now: number) => {
  const iso = new Date(firedAt).toISOString()
  return sameDay(iso, now)
    ? fmtTime(iso)
    : `${new Date(firedAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${fmtTime(iso)}`
}

/** One compact notice card — a single line: icon, guest, room, type, time,
 *  then the check-out / portal actions. Live rows join the booking for the
 *  countdown; once the guest leaves the row settles into a resolved state. */
function NoticeRow({ t, me, notice: n, live, now, wasUnread, i, busy, onCheckOut }: {
  t: WorkspaceTheme
  me: Employee
  notice: DeskNotice
  live: Map<number, Booking>
  now: number
  wasUnread: boolean
  i: number
  busy: boolean
  onCheckOut: (b: Booking) => void
}) {
  const b = live.get(n.bookingId)
  const end = b?.end ?? n.end
  const ms = new Date(end).getTime() - now
  const overdue = !!b && ms <= 0
  const mins = Math.max(0, Math.ceil(ms / 60_000))
  const left = b ? departCountdown(end, now) : null
  const portal = `${clientPath(me.role)}/${encodeURIComponent(b ? clientKey(b) : n.client)}`

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ delay: Math.min(i, 10) * 0.03, duration: 0.25 }}
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 ${t.radius} ${t.chip}`}
    >
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-lg ${
          b
            ? overdue
              ? 'bg-rose-500/12 text-rose-600 dark:text-rose-300'
              : 'bg-amber-500/12 text-amber-600 dark:text-amber-300'
            : 'bg-slate-500/12 text-slate-600 dark:text-slate-300'
        }`}
      >
        {b ? (overdue ? <AlarmClock className="size-4" /> : <BellRing className="size-4" />) : <CheckCheck className="size-4" />}
      </span>

      <Link to={portal} title={`Open ${n.guest}'s portal`} className="group min-w-0 flex-1 basis-48">
        <p className="truncate text-sm font-semibold group-hover:underline">
          {n.guest}
          {n.phone && (
            <span className={`ml-2 text-xs font-normal ${t.muted}`}>
              <Phone className="mr-0.5 inline size-3" />{n.phone}
            </span>
          )}
        </p>
        <p className={`truncate text-[11px] ${b ? (overdue ? 'text-rose-500' : 'text-amber-600 dark:text-amber-300') : t.muted}`}>
          {b
            ? overdue
              ? `Was due at ${fmtTime(end)} — please check the guest out`
              : `Checks out in ${mins} min — due ${fmtTime(end)}`
            : 'No longer in house'}
        </p>
      </Link>

      <span className={`flex w-28 shrink-0 items-center gap-1 truncate text-xs font-medium`}>
        <BedDouble className="size-3.5 shrink-0" />{b?.room_name ?? n.room}
      </span>

      <span className="flex shrink-0 items-center gap-1.5">
        <Pill tone={b ? (overdue ? 'red' : 'amber') : 'slate'}>
          {b ? (overdue ? 'Checkout due' : 'Reminder') : 'Checked out'}
        </Pill>
        {wasUnread && <Pill tone="blue">New</Pill>}
      </span>

      <span className={`shrink-0 text-[11px] tabular-nums ${t.muted}`}>
        <Clock className="mr-0.5 inline size-3" />{fmtFiredAt(n.firedAt, now)}
      </span>

      {left && <Pill tone={left.tone}>{left.text}</Pill>}

      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        {b && (
          <Button t={t} busy={busy} onClick={() => onCheckOut(b)} className="h-8 px-2.5" title={`Check ${n.guest} out of ${b.room_name}`}>
            <LogOut className="size-3.5" /> Check out
          </Button>
        )}
        <LinkButton t={t} to={portal} className="h-8 px-2.5" title={`Open ${n.guest}'s portal`}>
          <ArrowUpRight className="size-3.5" /> Portal
        </LinkButton>
        {!b && <Pill tone="slate">Resolved</Pill>}
      </span>
    </motion.li>
  )
}

/** The desk's notification centre — checkout reminders and due alerts. Opening
 *  the page marks everything read, so the bell's badge clears itself; notices
 *  arriving while it's open are read on arrival too. */
export default function NotificationsPage({ item, t, me }: { item: NavItem; t: WorkspaceTheme; me: Employee }) {
  const { notices } = useDeskNotices()
  const bookings = useApi(() => bnb.bookings({ status: 'occupied' }))
  const now = useNow(30_000).getTime()
  const [busy, setBusy] = useState(0)
  const [flash, setFlash] = useState({ text: '', bad: false })

  // Keep live status fresh — a check-out done elsewhere flips the row to resolved.
  useEffect(() => {
    const t = setInterval(bookings.reload, 60_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  /** Keys unread when the page opened — they keep a "New" tag so the
   *  receptionist can still tell what just landed. */
  const [fresh] = useState(() => new Set(notices.filter((n) => !n.read).map((n) => n.key)))

  useEffect(() => markAllNoticesRead(), [notices])

  const live = useMemo(() => new Map((bookings.data ?? []).map((b) => [b.id, b])), [bookings.data])

  /** Check a guest straight off a live notice — same call the check-out board uses. */
  async function checkOut(b: Booking) {
    setBusy(b.id)
    setFlash({ text: '', bad: false })
    try {
      const next = await bnb.checkoutBooking(b.id)
      bookings.setData((l) => l?.map((x) => (x.id === b.id ? next : x)) ?? null)
      setFlash({ text: `${b.guest_name} checked out — ${b.room_name} is free.`, bad: false })
    } catch (err) {
      setFlash({ text: parseApiError(err).message, bad: true })
    } finally {
      setBusy(0)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        t={t}
        icon={item.icon}
        title={item.label}
        text="Checkout reminders and due alerts — opening this page marks them all as read."
      />

      <Flash message={flash.text} tone={flash.bad ? 'red' : 'green'} />

      <Panel
        t={t}
        actions={
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold tabular-nums ${t.radius} ${t.chip}`}>
            <span className="size-1.5 rounded-full bg-sky-500" />
            {notices.length}
          </span>
        }
      >
        {!notices.length ? (
          <Empty
            t={t}
            icon={BellOff}
            title="No notifications"
            text="Checkout reminders and due alerts will land here as guests approach their checkout time."
          />
        ) : (
          <ul className="space-y-1.5">
            <AnimatePresence initial={false}>
              {notices.map((n, i) => (
                <NoticeRow
                  key={n.key} t={t} me={me} notice={n} live={live} now={now}
                  wasUnread={fresh.has(n.key)} i={i} busy={busy === n.bookingId}
                  onCheckOut={(b) => void checkOut(b)}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Panel>
    </div>
  )
}
