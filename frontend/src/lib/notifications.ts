import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { bnb, clientKey, type Booking } from './bnb'
import { useApi } from './hr'
import { useNow } from './time'

/** A reminder lands this long before a stay's checkout time. */
export const WARN_BEFORE_MS = 30 * 60_000
const DAY_MS = 86_400_000

export const sameDay = (iso: string, now: number) => {
  const a = new Date(iso), b = new Date(now)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/** Countdown to a checkout deadline: red once it passes, amber inside the warning window. */
export function departCountdown(end: string, now: number): { text: string; tone: 'amber' | 'red' | 'slate' } {
  const ms = new Date(end).getTime() - now
  if (ms <= 0) return { text: 'Due now', tone: 'red' }
  const mins = Math.ceil(ms / 60_000)
  if (mins < 60) return { text: `${mins} min left`, tone: 'amber' }
  const h = Math.floor(mins / 60), m = mins % 60
  return { text: m ? `${h}h ${m}m left` : `${h}h left`, tone: 'slate' }
}

/** One shared AudioContext for every chime. Browsers only let audio run after
 *  a user gesture, so the first click or keypress anywhere resumes it — alerts
 *  landing after that can ring even when nobody is looking at the tab. */
let audioCtx: AudioContext | null = null
let audioArmed = false

function armAudio() {
  if (audioArmed) return
  audioArmed = true
  const unlock = () => {
    try {
      audioCtx ??= new AudioContext()
      void audioCtx.resume()
    } catch {
      // No audio support — notices still land visually.
    }
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

/** A single bell note — a sine ping with an exponential decay tail. */
function ping(ctx: AudioContext, freq: number, t0: number, dur: number, vol: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.frequency.value = freq
  gain.gain.setValueAtTime(vol, t0)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.start(t0)
  osc.stop(t0 + dur)
}

/** Two-tone "ding-dong" per ring — `times` repeats it with a pause between.
 *  Skipped silently while autoplay is still blocked (no interaction yet); once
 *  the desk has clicked anywhere, `resume` resolves and the chime plays. */
export function chime(times = 1) {
  try {
    armAudio()
    audioCtx ??= new AudioContext()
    const ctx = audioCtx
    void ctx.resume().then(() => {
      for (let i = 0; i < times; i++) {
        const t0 = ctx.currentTime + i * 0.9
        ping(ctx, 880, t0, 0.35, 0.09) // A5 — the ding
        ping(ctx, 659.25, t0 + 0.22, 0.55, 0.08) // E5 — the softer dong
      }
    })
  } catch {
    // Audio is a nicety — the notice still lands without it.
  }
}

/** One entry in the desk's notification log — a checkout reminder or due alert,
 *  snapshotted when it fires so it still renders after the booking closes. */
export interface DeskNotice {
  /** `${bookingId}|${end}|${stage}` — the dedupe key; a notice can't repeat
   *  unless the stay's deadline itself moves. */
  key: string
  stage: 'warn' | 'due'
  bookingId: number
  guest: string
  room: string
  phone: string
  /** Client rollup key — builds the guest-portal link. */
  client: string
  /** The stay's checkout deadline (ISO). */
  end: string
  firedAt: number
  read: boolean
}

/** localStorage key of the notice log — survives reloads; entries older than a
 *  week are pruned on load so the list can't grow forever. */
const NOTICES_KEY = 'hs-desk-notices'
const KEEP_MS = 7 * DAY_MS
const MAX_NOTICES = 100

const loadNotices = (): DeskNotice[] => {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(NOTICES_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    const cutoff = Date.now() - KEEP_MS
    return raw.filter(
      (n): n is DeskNotice =>
        !!n && typeof n === 'object' && typeof (n as DeskNotice).key === 'string' && (n as DeskNotice).firedAt > cutoff,
    )
  } catch {
    return []
  }
}

const saveNotices = (list: DeskNotice[]) => {
  try {
    localStorage.setItem(NOTICES_KEY, JSON.stringify(list))
  } catch {
    // Storage unavailable (private mode etc.) — the in-memory copy still works.
  }
}

let notices: DeskNotice[] | null = null
const listeners = new Set<() => void>()

const getNotices = () => (notices ??= loadNotices())
const emit = () => {
  saveNotices(getNotices())
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

const hasNotice = (key: string) => getNotices().some((n) => n.key === key)

function pushNotices(fresh: DeskNotice[]) {
  const have = new Set(getNotices().map((n) => n.key))
  const add = fresh.filter((n) => !have.has(n.key))
  if (!add.length) return
  notices = [...add, ...getNotices()].slice(0, MAX_NOTICES)
  emit()
}

/** Everything the desk has seen flips to read — the bell's count clears. */
export function markAllNoticesRead() {
  const list = getNotices()
  if (!list.some((n) => !n.read)) return
  notices = list.map((n) => (n.read ? n : { ...n, read: true }))
  emit()
}

/** Live view of the desk's notice log — newest first — plus its unread count. */
export function useDeskNotices() {
  const list = useSyncExternalStore(subscribe, getNotices)
  const unread = useMemo(() => list.reduce((n, x) => n + (x.read ? 0 : 1), 0), [list])
  return { notices: list, unread }
}

/** Front-desk checkout notifications — runs wherever the receptionist's bell
 *  is mounted. At 30 minutes to a stay's end an amber reminder logs; when the
 *  deadline hits a red alert logs. Each fires once — the log itself dedupes,
 *  so a reload can't raise the same notice twice. */
export function useCheckoutNoticeWatcher(enabled = true) {
  const bookings = useApi(
    () => (enabled ? bnb.bookings({ status: 'occupied' }) : Promise.resolve<Booking[]>([])),
    [enabled],
  )
  const now = useNow(15_000).getTime()
  const fired = useRef(new Set<string>())

  // Keep the booking list fresh — new check-ins and check-outs land within a minute.
  useEffect(() => {
    if (!enabled) return
    const t = setInterval(bookings.reload, 60_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    const fresh: DeskNotice[] = []
    for (const b of bookings.data ?? []) {
      const ms = new Date(b.end).getTime() - now
      const stage: DeskNotice['stage'] | null = ms <= 0 ? 'due' : ms <= WARN_BEFORE_MS ? 'warn' : null
      if (!stage || (stage === 'due' && !sameDay(b.end, now))) continue
      const key = `${b.id}|${b.end}|${stage}`
      if (fired.current.has(key) || hasNotice(key)) continue
      fired.current.add(key)
      fresh.push({
        key,
        stage,
        bookingId: b.id,
        guest: b.guest_name,
        room: b.room_name ?? '',
        phone: b.guest_phone,
        client: clientKey(b),
        end: b.end,
        firedAt: now,
        read: false,
      })
    }
    if (fresh.length) {
      chime(fresh.some((n) => n.stage === 'due') ? 2 : 1)
      pushNotices(fresh)
    }
  }, [now, bookings.data, enabled])
}
