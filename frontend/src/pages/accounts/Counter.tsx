import axios from 'axios'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowDownToLine, ArrowUpFromLine, Calculator, ChevronDown,
  CreditCard, DoorClosed, DoorOpen, Lock, Scale, Smartphone, Wallet,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Empty, ErrorNote, Flash, Input, Loading, Panel, Pill, Stat, Textarea } from '../../components/hr/ui'
import { parseApiError, type Employee, type FieldErrors } from '../../lib/api'
import { bnb, DRAWING_LABEL, type DrawingMethod, type TillSession } from '../../lib/bnb'
import { formatMoney, useApi } from '../../lib/hr'
import type { WorkspaceTheme } from '../../lib/workspaces'
import { Dialog, DialogFooter } from './Dialog'
import type { AccountPageProps } from './types'

const fmtDT = (iso: string) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const fmtT = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })



export default function Counter({ t, me }: AccountPageProps) {
  const { data, error, loading, reload } = useApi(() => bnb.tills())
  const [dialog, setDialog] = useState<'' | 'open' | 'drawing' | 'close'>('')
  const [params, setParams] = useSearchParams()
  const [flash, setFlash] = useState({ text: '', bad: false })
  const [open, setOpen] = useState<Set<number>>(new Set())

  const sessions = data ?? []
  const current = sessions.find((s) => s.status === 'open')
  const history = sessions.filter((s) => s.status === 'closed')

  /** Pick a dialog — always drops the ?open param so it can't retrigger. */
  const pick = (d: typeof dialog) => {
    setDialog(d)
    if (params.has('open')) setParams({}, { replace: true })
  }

  // ?open in the URL (e.g. the "open the till" gate link) pops the dialog once
  // sessions have loaded — but not when a till is already open.
  const effDialog = dialog || (data && !current && params.has('open') ? 'open' as const : '' as const)

  const toggle = (id: number) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  /** After any till action, reload so the server recomputes the report numbers. */
  function saved(message: string) {
    pick('')
    setFlash({ text: message, bad: false })
    reload()
  }

  return (
    <>
      {/* Till status + actions */}
      <Panel t={t} actions={
        <div className="flex flex-wrap gap-2">
          {!current && (
            <Button t={t} onClick={() => pick('open')} disabled={!data}>
              <DoorOpen className="size-3.5" /> Open till
            </Button>
          )}
          {current && (
            <>
              <Button t={t} variant="ghost" onClick={() => pick('drawing')}>
                <ArrowDownToLine className="size-3.5" /> Register drawing
              </Button>
              <Button t={t} variant="danger" onClick={() => pick('close')}>
                <DoorClosed className="size-3.5" /> Close till
              </Button>
            </>
          )}
        </div>
      }>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`grid size-11 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
            {current ? <DoorOpen className="size-5" /> : <Lock className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            {current ? (
              <>
                <p className={`text-sm font-semibold`}>Till open — since {fmtDT(current.opened_at)}</p>
                <p className={`text-xs ${t.muted}`}>
                  Opened by {current.opened_by_name ?? 'staff'}{current.note ? ` · “${current.note}”` : ''}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold">Till closed</p>
                <p className={`text-xs ${t.muted}`}>Open the till to start taking cash at the counter.</p>
              </>
            )}
          </div>
          <Flash message={flash.text} tone={flash.bad ? 'red' : 'green'} />
        </div>
      </Panel>

      {error ? (
        <Panel t={t}><ErrorNote t={t} message={error} onRetry={reload} /></Panel>
      ) : loading ? (
        <Panel t={t}><Loading t={t} /></Panel>
      ) : (
        <>
          {current && (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat t={t} i={0} icon={Wallet} label="Opening cash" value={formatMoney(current.opening_float)} />
                <Stat t={t} i={1} icon={ArrowUpFromLine} label="Cash received" value={formatMoney(current.cash_in)} hint={`${current.cash_in_count} cash ${current.cash_in_count === 1 ? 'payment' : 'payments'}`} />
                <Stat t={t} i={2} icon={ArrowDownToLine} label="Drawings out" value={formatMoney(current.drawings_total)} hint={`${current.drawings.length} ${current.drawings.length === 1 ? 'drawing' : 'drawings'}`} />
                <Stat t={t} i={3} icon={Scale} label="Expected in drawer" value={formatMoney(current.expected)} />
              </div>
              <TillReport t={t} s={current} title="Current till breakdown" />
            </>
          )}

          <Panel t={t} title="Till history">
            {!history.length ? (
              <Empty
                t={t}
                icon={Calculator}
                title="No till sessions yet"
                text="Every open-and-close of the counter till is listed here with its full report."
              />
            ) : (
              <ul className="space-y-2">
                {history.map((s, i) => (
                  <HistoryRow key={s.id} t={t} s={s} i={i} open={open.has(s.id)} onToggle={() => toggle(s.id)} />
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}

      <AnimatePresence>
        {effDialog === 'open' && <OpenTillDialog t={t} me={me} onClose={() => pick('')} onSaved={saved} />}
        {effDialog === 'drawing' && current && <DrawingDialog t={t} session={current} onClose={() => pick('')} onSaved={saved} />}
        {effDialog === 'close' && current && <CloseTillDialog t={t} session={current} onClose={() => pick('')} onSaved={saved} />}
      </AnimatePresence>
    </>
  )
}

/* ---------------- A session's full report, broken down line by line ---------------- */

function TillReport({ t, s, title }: { t: WorkspaceTheme; s: TillSession; title?: string }) {
  const overShort = s.over_short === null ? null : Number(s.over_short)
  const overShortMpesa = s.over_short_mpesa === null ? null : Number(s.over_short_mpesa)
  const overShortCard = s.over_short_card === null ? null : Number(s.over_short_card)
  const row = 'flex items-center justify-between gap-3 px-3 py-2.5 text-sm'
  const icon = `size-4 shrink-0 ${t.accentText}`
  const osPill = (v: number | null) =>
    v === null ? null : (
      <Pill tone={v === 0 ? 'green' : v > 0 ? 'blue' : 'red'}>
        {v === 0 ? 'Balanced' : v > 0 ? `${formatMoney(v)} over` : `${formatMoney(-v)} short`}
      </Pill>
    )
  return (
    <Panel t={t} title={title}>
      <div className="overflow-x-auto">
        <div className={`min-w-[24rem] divide-y divide-slate-900/5 dark:divide-white/5`}>
          <div className={row}>
            <span className="flex items-center gap-2">
              <Wallet className={icon} /> Opening cash
              <span className={`text-xs ${t.muted}`}>— {s.opened_by_name ?? 'staff'}, {fmtDT(s.opened_at)}</span>
            </span>
            <span className="font-medium">{formatMoney(s.opening_float)}</span>
          </div>
          <div className={row}>
            <span className="flex items-center gap-2">
              <Smartphone className={icon} /> Opening M-Pesa
            </span>
            <span className="font-medium">{formatMoney(s.opening_mpesa)}</span>
          </div>
          <div className={row}>
            <span className="flex items-center gap-2">
              <CreditCard className={icon} /> Opening credit card
            </span>
            <span className="font-medium">{formatMoney(s.opening_card)}</span>
          </div>
          <div className={row}>
            <span className="flex items-center gap-2">
              <ArrowUpFromLine className={icon} /> Cash received
              <span className={`text-xs ${t.muted}`}>— {s.cash_in_count} cash {s.cash_in_count === 1 ? 'payment' : 'payments'} on bookings</span>
            </span>
            <span className="font-medium text-emerald-600 dark:text-emerald-300">+{formatMoney(s.cash_in)}</span>
          </div>
          <div className={row}>
            <span className="flex items-center gap-2">
              <ArrowUpFromLine className={icon} /> M-Pesa received
              <span className={`text-xs ${t.muted}`}>— {s.mpesa_in_count} {s.mpesa_in_count === 1 ? 'payment' : 'payments'} on bookings</span>
            </span>
            <span className="font-medium text-emerald-600 dark:text-emerald-300">+{formatMoney(s.mpesa_in)}</span>
          </div>
          <div className={row}>
            <span className="flex items-center gap-2">
              <ArrowUpFromLine className={icon} /> Card received
              <span className={`text-xs ${t.muted}`}>— {s.card_in_count} {s.card_in_count === 1 ? 'payment' : 'payments'} on bookings</span>
            </span>
            <span className="font-medium text-emerald-600 dark:text-emerald-300">+{formatMoney(s.card_in)}</span>
          </div>
          <div className={row}>
            <span className="flex items-center gap-2">
              <ArrowDownToLine className={icon} /> Drawings out
              <span className={`text-xs ${t.muted}`}>
                — {s.drawings.length} {s.drawings.length === 1 ? 'drawing' : 'drawings'}
                {' · '}cash {formatMoney(s.drawings_cash)} · M-Pesa {formatMoney(s.drawings_mpesa)} · card {formatMoney(s.drawings_card)}
              </span>
            </span>
            <span className="font-medium text-rose-600 dark:text-rose-300">−{formatMoney(s.drawings_total)}</span>
          </div>
          {s.drawings.map((d) => (
            <div key={d.id} className={`${row} pl-9 text-xs ${t.muted}`}>
              <span className="min-w-0 truncate">
                {fmtT(d.created_at)} · {DRAWING_LABEL[d.method]} · {d.reason || 'Drawing'}{d.given_to ? ` — ${d.given_to}` : ''}{d.created_by_name ? ` (${d.created_by_name})` : ''}
              </span>
              <span className="shrink-0">−{formatMoney(d.amount)}</span>
            </div>
          ))}
          <div className={`${row} font-semibold`}>
            <span className="flex items-center gap-2">
              <Scale className={icon} /> Expected in drawer
            </span>
            <span>{formatMoney(s.expected)}</span>
          </div>
          <div className={`${row} font-semibold`}>
            <span className="flex items-center gap-2">
              <Smartphone className={icon} /> Expected M-Pesa
            </span>
            <span>{formatMoney(s.expected_mpesa)}</span>
          </div>
          <div className={`${row} font-semibold`}>
            <span className="flex items-center gap-2">
              <CreditCard className={icon} /> Expected card
            </span>
            <span>{formatMoney(s.expected_card)}</span>
          </div>
          {s.closed_at && (
            <>
              <div className={row}>
                <span className="flex items-center gap-2">
                  <Lock className={icon} /> Counted cash
                  <span className={`text-xs ${t.muted}`}>— {s.closed_by_name ?? 'staff'}, {fmtDT(s.closed_at)}</span>
                </span>
                <span className="flex items-center gap-2 font-medium">
                  {formatMoney(s.closing_count ?? 0)}{osPill(overShort)}
                </span>
              </div>
              <div className={row}>
                <span className="flex items-center gap-2">
                  <Smartphone className={icon} /> Counted M-Pesa
                </span>
                <span className="flex items-center gap-2 font-medium">
                  {s.closing_mpesa === null ? '—' : formatMoney(s.closing_mpesa)}{osPill(overShortMpesa)}
                </span>
              </div>
              <div className={row}>
                <span className="flex items-center gap-2">
                  <CreditCard className={icon} /> Counted card
                </span>
                <span className="flex items-center gap-2 font-medium">
                  {s.closing_card === null ? '—' : formatMoney(s.closing_card)}{osPill(overShortCard)}
                </span>
              </div>
            </>
          )}
          {s.closing_note && (
            <p className={`px-3 py-2 text-xs ${t.muted}`}>Closing note — “{s.closing_note}”</p>
          )}
        </div>
      </div>
    </Panel>
  )
}

/* ---------------- Past sessions — expandable rows, each with its report ---------------- */

function HistoryRow({ t, s, i, open, onToggle }: { t: WorkspaceTheme; s: TillSession; i: number; open: boolean; onToggle: () => void }) {
  const overShort = s.over_short === null ? null : Number(s.over_short)
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
      className={`overflow-hidden ${t.radius} ${t.card}`}
    >
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 p-3 text-left">
        <span className={`grid size-11 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
          <Calculator className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {fmtDT(s.opened_at)} <span className={`font-normal ${t.muted}`}>→ {s.closed_at ? fmtDT(s.closed_at) : '—'}</span>
          </p>
          <p className={`truncate text-xs ${t.muted}`}>
            float {formatMoney(s.opening_float)} · mpesa {formatMoney(s.opening_mpesa)} · card {formatMoney(s.opening_card)} · cash in {formatMoney(s.cash_in)} · out {formatMoney(s.drawings_total)}
            {s.closed_by_name ? ` · closed by ${s.closed_by_name}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {overShort !== null && (
            <Pill tone={overShort === 0 ? 'green' : overShort > 0 ? 'blue' : 'red'}>
              {overShort === 0 ? 'Balanced' : overShort > 0 ? 'Over' : 'Short'}
            </Pill>
          )}
          <ChevronDown className={`size-4 transition-transform ${t.muted} ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <div className="border-t border-slate-900/10 pb-3 dark:border-white/10">
              <TillReport t={t} s={s} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  )
}

/* ---------------- The three popups ---------------- */

function OpenTillDialog({ t, me, onClose, onSaved }: { t: WorkspaceTheme; me: Employee; onClose: () => void; onSaved: (msg: string) => void }) {
  const [cash, setCash] = useState('')
  const [mpesa, setMpesa] = useState('')
  const [card, setCard] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    setMessage('')
    try {
      await bnb.openTill({
        opening_float: Number(cash) || 0,
        opening_mpesa: Number(mpesa) || 0,
        opening_card: Number(card) || 0,
        note: note.trim(),
      })
      onSaved(`Till opened by ${me.first_name} — cash ${formatMoney(Number(cash) || 0)} · M-Pesa ${formatMoney(Number(mpesa) || 0)} · card ${formatMoney(Number(card) || 0)}.`)
    } catch (err) {
      const p = parseApiError(err)
      setErrors(p.fields)
      setMessage(p.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog t={t} title="Open till" text="Start the counter session with the opening balances on hand." icon={DoorOpen} onClose={onClose} onSubmit={submit}
      footer={<DialogFooter t={t} message={message} onClose={onClose} busy={busy} submitLabel="Open till" />}>
      <div className="flex flex-col gap-3 overflow-y-auto px-5 py-5">
        <p className={`text-xs font-semibold uppercase tracking-wide ${t.muted}`}>Opening balances</p>
        <Input t={t} label="Cash" type="number" min="0" step="0.01" required autoFocus
          placeholder="Cash in the drawer to start with"
          value={cash} onChange={(e) => setCash(e.target.value)} error={errors.opening_float} />
        <Input t={t} label="M-Pesa" type="number" min="0" step="0.01"
          placeholder="M-Pesa balance to start with"
          value={mpesa} onChange={(e) => setMpesa(e.target.value)} error={errors.opening_mpesa} />
        <Input t={t} label="Credit card" type="number" min="0" step="0.01"
          placeholder="Card balance to start with"
          value={card} onChange={(e) => setCard(e.target.value)} error={errors.opening_card} />
        <Textarea t={t} label="Note (optional)" placeholder="Anything the next shift should know."
          value={note} onChange={(e) => setNote(e.target.value)} error={errors.note} />
      </div>
    </Dialog>
  )
}

export function DrawingDialog({ t, session, onClose, onSaved }: { t: WorkspaceTheme; session: TillSession; onClose: () => void; onSaved: (msg: string) => void }) {
  const [cash, setCash] = useState('')
  const [mpesa, setMpesa] = useState('')
  const [card, setCard] = useState('')
  const [reason, setReason] = useState('')
  const [givenTo, setGivenTo] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  /** One drawing entry per channel that has an amount — sent as a batch. */
  const entries = ([
    ['cash', cash],
    ['mpesa', mpesa],
    ['visa', card],
  ] as [DrawingMethod, string][])
    .filter(([, v]) => v.trim() !== '')
    .map(([method, v]) => ({ method, amount: Number(v) }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErrors({})
    if (!entries.length) {
      setMessage('Enter an amount for at least one channel.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const saved = await bnb.registerDrawings(session.id, entries.map((en) => ({
        ...en,
        reason: reason.trim(),
        given_to: givenTo.trim(),
      })))
      const summary = saved.map((d) => `${DRAWING_LABEL[d.method]} ${formatMoney(d.amount)}`).join(' · ')
      onSaved(`${saved.length === 1 ? 'Drawing' : 'Drawings'} registered — ${summary}${givenTo.trim() ? ` — ${givenTo.trim()}` : ''}.`)
    } catch (err) {
      if (axios.isAxiosError(err) && Array.isArray(err.response?.data)) {
        // Batch errors come back as a list — one object per submitted entry,
        // so each maps back to its channel's field.
        const fields: FieldErrors = {}
        err.response.data.forEach((item, i) => {
          const first = item && typeof item === 'object' ? Object.values(item)[0] : null
          if (entries[i] && first) fields[entries[i].method] = String(Array.isArray(first) ? first[0] : first)
        })
        setErrors(fields)
        setMessage('Please fix the highlighted fields.')
      } else {
        const p = parseApiError(err)
        setErrors(p.fields)
        setMessage(p.message)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog t={t} title="Register drawing" text="Record money taken out of the till — the report updates automatically." icon={ArrowDownToLine} onClose={onClose} onSubmit={submit}
      footer={<DialogFooter t={t} message={message} onClose={onClose} busy={busy} submitLabel="Register drawing" />}>
      <div className="flex flex-col gap-3 overflow-y-auto px-5 py-5">
        <p className={`text-xs font-semibold uppercase tracking-wide ${t.muted}`}>Amount drawn per channel</p>
        <Input t={t} label="Cash" type="number" min="0.01" step="0.01" autoFocus
          placeholder="Drawn from the drawer"
          value={cash} onChange={(e) => setCash(e.target.value)} error={errors.cash} />
        <Input t={t} label="M-Pesa" type="number" min="0.01" step="0.01"
          placeholder="Drawn from the M-Pesa line"
          value={mpesa} onChange={(e) => setMpesa(e.target.value)} error={errors.mpesa} />
        <Input t={t} label="Visa card" type="number" min="0.01" step="0.01"
          placeholder="Drawn from the card account"
          value={card} onChange={(e) => setCard(e.target.value)} error={errors.visa} />
        <Input t={t} label="Reason" placeholder="e.g. Change for a guest, banking drop"
          value={reason} onChange={(e) => setReason(e.target.value)} error={errors.reason} />
        <Input t={t} label="Given to" placeholder="Who received the money"
          value={givenTo} onChange={(e) => setGivenTo(e.target.value)} error={errors.given_to} />
      </div>
    </Dialog>
  )
}

function CloseTillDialog({ t, session, onClose, onSaved }: { t: WorkspaceTheme; session: TillSession; onClose: () => void; onSaved: (msg: string) => void }) {
  const [cash, setCash] = useState('')
  const [mpesa, setMpesa] = useState('')
  const [card, setCard] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  /** Per-channel count state, each compared against its expected total. */
  const channels = [
    { label: 'Cash', value: cash, expected: Number(session.expected) },
    { label: 'M-Pesa', value: mpesa, expected: Number(session.expected_mpesa) },
    { label: 'Visa', value: card, expected: Number(session.expected_card) },
  ]
  const diffs = channels
    .filter((c) => c.value !== '')
    .map((c) => ({ label: c.label, diff: Number(c.value) - c.expected }))
  const balanced = diffs.length > 0 && diffs.every((d) => d.diff === 0)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    setMessage('')
    try {
      await bnb.closeTill(session.id, {
        closing_count: Number(cash),
        closing_mpesa: mpesa === '' ? null : Number(mpesa),
        closing_card: card === '' ? null : Number(card),
        closing_note: note.trim(),
      })
      onSaved('Till closed — the session report is saved in the history below.')
    } catch (err) {
      const p = parseApiError(err)
      setErrors(p.fields)
      setMessage(p.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog t={t} title="Close till" text="Count each channel — the report compares every count against what it should hold." icon={DoorClosed} onClose={onClose} onSubmit={submit}
      footer={<DialogFooter t={t} message={message} onClose={onClose} busy={busy} submitLabel="Close till" />}>
      <div className="flex flex-col gap-3 overflow-y-auto px-5 py-5">
        <div className={`space-y-1 px-3 py-2.5 text-sm ${t.radius} ${t.chip}`}>
          <div className="flex items-center justify-between gap-3">
            <span className={t.muted}>Expected — cash</span>
            <span className="font-semibold">{formatMoney(session.expected)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className={t.muted}>Expected — M-Pesa</span>
            <span className="font-semibold">{formatMoney(session.expected_mpesa)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className={t.muted}>Expected — Visa card</span>
            <span className="font-semibold">{formatMoney(session.expected_card)}</span>
          </div>
        </div>
        <Input t={t} label="Cash counted" type="number" min="0" step="0.01" required autoFocus
          placeholder="Cash counted in the drawer"
          value={cash} onChange={(e) => setCash(e.target.value)} error={errors.closing_count} />
        <Input t={t} label="M-Pesa counted" type="number" min="0" step="0.01"
          placeholder="M-Pesa balance at close"
          value={mpesa} onChange={(e) => setMpesa(e.target.value)} error={errors.closing_mpesa} />
        <Input t={t} label="Visa card counted" type="number" min="0" step="0.01"
          placeholder="Card balance at close"
          value={card} onChange={(e) => setCard(e.target.value)} error={errors.closing_card} />
        {diffs.length > 0 && (
          <p className={`text-xs ${balanced ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
            {balanced
              ? 'Balanced — every count matches its expected total.'
              : diffs.map((d) => d.diff === 0
                  ? `${d.label} balanced`
                  : `${d.label} ${formatMoney(Math.abs(d.diff))} ${d.diff > 0 ? 'over' : 'short'}`).join(' · ')}
          </p>
        )}
        <Textarea t={t} label="Closing note (optional)" placeholder="Handover notes for the next shift."
          value={note} onChange={(e) => setNote(e.target.value)} error={errors.closing_note} />
      </div>
    </Dialog>
  )
}
