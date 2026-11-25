import { AnimatePresence, motion } from 'framer-motion'
import { CalendarCheck, LogIn, LogOut, Timer } from 'lucide-react'
import { useState } from 'react'
import { Button, ErrorNote, Flash, Loading, PageHeader, Panel, Pill, Stat } from '../components/hr/ui'
import { parseApiError } from '../lib/api'
import { formatTime, hr, useApi, type ClockAction } from '../lib/hr'
import { useNow } from '../lib/time'
import type { NavItem, WorkspaceTheme } from '../lib/workspaces'

const at = (date: string, time: string) => new Date(`${date}T${time}`)

/** "8:04:37" — hours:minutes:seconds, always padded. */
function elapsed(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default function CheckInPage({ item, t }: { item: NavItem; t: WorkspaceTheme }) {
  // `skew` shifts the client clock onto server time so the timer survives clock skew.
  const { data, error, loading, reload, setData } = useApi(async () => {
    const d = await hr.myAttendance()
    return { record: d.record, skew: new Date(d.server_now).getTime() - Date.now() }
  })
  const now = useNow(1000)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState({ text: '', bad: false })

  const skew = data?.skew ?? 0
  const record = data?.record ?? null
  const onShift = !!record?.clock_in && !record.clock_out
  const done = !!record?.clock_out

  const start = record?.clock_in ? at(record.date, record.clock_in) : null
  const end = record?.clock_out ? at(record.date, record.clock_out) : null
  const worked = start ? ((end?.getTime() ?? now.getTime() + skew) - start.getTime()) / 1000 : 0

  async function act(action: ClockAction) {
    setBusy(true)
    setFlash({ text: '', bad: false })
    try {
      const rec = await hr.clock(action)
      setData((d) => (d ? { ...d, record: rec } : d))
      setFlash({
        text: action === 'check-in' ? 'Clocked in — have a great shift.' : 'Clocked out — see you next time.',
        bad: false,
      })
    } catch (err) {
      setFlash({ text: parseApiError(err).message, bad: true })
      reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader t={t} icon={item.icon} title={item.label} text={item.description} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat t={t} i={0} icon={LogIn} label="Clocked in" value={formatTime(record?.clock_in ?? null)} />
        <Stat t={t} i={1} icon={LogOut} label="Clocked out" value={formatTime(record?.clock_out ?? null)} />
        <Stat t={t} i={2} icon={Timer} label="Time on shift" value={start ? elapsed(worked) : '—'} hint={onShift ? 'Still counting' : undefined} />
      </div>

      <Panel t={t} className="relative overflow-hidden">
        <div className={`pointer-events-none absolute -left-20 -bottom-28 size-72 rounded-full blur-2xl ${t.glowB}`} />
        {error ? (
          <ErrorNote t={t} message={error} onRetry={reload} />
        ) : loading && !data ? (
          <Loading t={t} rows={2} />
        ) : (
          <div className="relative flex flex-col items-center gap-4 py-8 text-center sm:py-10">
            <Pill tone={onShift ? 'green' : done ? 'blue' : 'slate'}>
              {onShift ? 'On shift now' : done ? 'Shift complete' : 'Not clocked in'}
            </Pill>

            <p className={`font-mono text-5xl font-semibold tabular-nums tracking-tight sm:text-7xl ${t.heading}`}>
              {elapsed(worked)}
            </p>
            <p className={`flex items-center gap-1.5 text-sm ${t.muted}`}>
              <CalendarCheck className="size-4" />
              {onShift
                ? `Working since ${formatTime(record!.clock_in)}`
                : done
                  ? `Today's shift: ${formatTime(record!.clock_in)} – ${formatTime(record!.clock_out)}`
                  : 'Clock in to start tracking your working time.'}
            </p>

            <Flash message={flash.text} tone={flash.bad ? 'red' : 'green'} />

            <AnimatePresence mode="wait" initial={false}>
              {!done && (
                <motion.div
                  key={onShift ? 'check-out' : 'check-in'}
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                >
                  {onShift ? (
                    <Button t={t} variant="danger" busy={busy} onClick={() => act('check-out')} className="h-12 px-10 text-sm">
                      <LogOut className="size-4" /> Employee clock out
                    </Button>
                  ) : (
                    <Button t={t} busy={busy} onClick={() => act('check-in')} className="h-12 px-10 text-sm">
                      <LogIn className="size-4" /> Employee clock in
                    </Button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </Panel>
    </div>
  )
}
