import { AnimatePresence, motion } from 'framer-motion'
import {
  AlarmClock, BedDouble, Building2, CalendarClock, CheckCircle2, ClipboardList, Contact, MapPin,
  Paperclip, Plus, RefreshCw, Search, Trash2, UserCheck, X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Button, Empty, ErrorNote, Flash, Input, Loading, PageHeader, Panel, Pill, Select, Stat, Textarea,
  type Tone,
} from '../components/hr/ui'
import { parseApiError, type Employee, type FieldErrors } from '../lib/api'
import {
  bnb, TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES,
  type Room, type StaffChoice, type Ticket, type TicketCategory, type TicketEdit, type TicketPriority, type TicketStatus,
} from '../lib/bnb'
import { formatDate, formatMoney, todayISO, useApi } from '../lib/hr'
import type { NavItem, WorkspaceTheme } from '../lib/workspaces'

const PRIORITY_TONE: Record<TicketPriority, Tone> = {
  low: 'slate', medium: 'blue', high: 'amber', urgent: 'red',
}

const DONE: TicketStatus[] = ['resolved', 'closed']
/** Statuses that ask for extra details in a popup before they apply. */
const FORM_STATUSES: TicketStatus[] = ['assigned', 'in_progress', 'on_hold', 'resolved', 'closed', 'reopened']
const STATUS_ICON: Record<TicketStatus, LucideIcon> = {
  open: ClipboardList, assigned: UserCheck, in_progress: RefreshCw,
  on_hold: AlarmClock, resolved: CheckCircle2, closed: CheckCircle2, reopened: RefreshCw,
}
const MAX_FILES = 10
const MAX_FILE_BYTES = 10 * 1024 * 1024
const FILE_ACCEPT = 'image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt'
const IMG_RE = /\.(png|jpe?g|gif|webp|avif)$/i

const fmtDT = (iso: string) =>
  new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

interface FormState {
  title: string
  description: string
  category: TicketCategory
  priority: TicketPriority
  room: string
  location: string
  assign_to: string
}

const EMPTY_FORM: FormState = {
  title: '', description: '', category: 'maintenance', priority: 'medium', room: '', location: '', assign_to: '',
}

export default function TicketsPage({ item, t, me, view = 'list' }: { item: NavItem; t: WorkspaceTheme; me: Employee; view?: 'list' | 'register' }) {
  const rooms = useApi(bnb.rooms)
  const staff = useApi(bnb.ticketStaff)
  const { data, error, loading, reload, setData } = useApi(() => bnb.tickets({ limit: 500 }))
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [flash, setFlash] = useState({ text: '', bad: false })
  const [busyId, setBusyId] = useState(0)
  const [pending, setPending] = useState<{ tk: Ticket; status: TicketStatus } | null>(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  /** Register ticket is a dialog over this list — the /register URL opens it, closing returns here. */
  const listPath = pathname.replace(/\/register$/, '')

  const tickets = data ?? []
  const openCount = tickets.filter((k) => ['open', 'assigned', 'reopened'].includes(k.status)).length
  const working = tickets.filter((k) => k.status === 'in_progress').length
  const urgent = tickets.filter((k) => ['high', 'urgent'].includes(k.priority) && !DONE.includes(k.status)).length
  const done = tickets.filter((k) => DONE.includes(k.status)).length

  const match = (k: Ticket) =>
    !q || `${k.number} ${k.title} ${k.description} ${k.location} ${k.room_name} ${k.guest_name} ${k.reporter_name} ${k.reported_by_name} ${k.assigned_to_name} ${k.assignee_name}`
      .toLowerCase().includes(q.toLowerCase())
  const list = tickets.filter((k) => (!statusFilter || k.status === statusFilter) && match(k))

  const th = `px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider ${t.muted}`

  function onTicketSaved(ticket: Ticket) {
    setData((l) => [ticket, ...(l ?? [])])
    setFlash({ text: `${ticket.number} registered — “${ticket.title}”.`, bad: false })
    navigate(listPath)
  }

  /** Pick a status — detail-collecting ones open the popup first, the rest apply directly. */
  function requestStatus(tk: Ticket, status: TicketStatus) {
    if (status === tk.status) return
    if (FORM_STATUSES.includes(status)) setPending({ tk, status })
    else void applyStatus(tk, { status })
  }

  async function applyStatus(tk: Ticket, patch: TicketEdit) {
    setBusyId(tk.id)
    setFlash({ text: '', bad: false })
    try {
      const next = await bnb.updateTicket(tk.id, patch)
      onStatusSaved(next)
    } catch (err) {
      setFlash({ text: parseApiError(err).message, bad: true })
    } finally {
      setBusyId(0)
    }
  }

  function onStatusSaved(next: Ticket) {
    setData((l) => l?.map((x) => (x.id === next.id ? next : x)) ?? null)
    setFlash({ text: `${next.number} is now ${next.status_label.toLowerCase()}.`, bad: false })
    setPending(null)
  }

  if (!me.branch) {
    return (
      <div className="space-y-5">
        <PageHeader t={t} icon={item.icon} title={item.label} text={item.description} />
        <Panel t={t}>
          <Empty
            t={t}
            icon={Building2}
            title="No branch allocated yet"
            text="Your account isn't assigned to a BnB branch, so there are no tickets to show. Ask your manager or IT support to allocate you."
          />
        </Panel>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader t={t} icon={item.icon} title={item.label} text={item.description} />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat t={t} i={0} icon={item.icon} label="Open & reopened" value={data ? openCount : '—'} />
        <Stat t={t} i={1} icon={RefreshCw} label="In progress" value={data ? working : '—'} />
        <Stat t={t} i={2} icon={AlarmClock} label="Urgent & high" value={data ? urgent : '—'} />
        <Stat t={t} i={3} icon={CheckCircle2} label="Resolved & closed" value={data ? done : '—'} />
      </div>

      <Flash message={flash.text} tone={flash.bad ? 'red' : 'green'} />

      <AnimatePresence>
        {view === 'register' && (
          <RegisterTicketDialog
            t={t}
            me={me}
            rooms={rooms.data ?? []}
            staff={staff.data ?? []}
            onClose={() => navigate(listPath)}
            onSaved={onTicketSaved}
          />
        )}
        {pending && (
          <StatusDialog
            key={`${pending.tk.id}-${pending.status}`}
            t={t}
            tk={pending.tk}
            status={pending.status}
            staff={staff.data ?? []}
            onClose={() => setPending(null)}
            onSaved={onStatusSaved}
          />
        )}
      </AnimatePresence>

      <Panel
        t={t}
        title="Branch tickets"
        actions={
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold tabular-nums ${t.radius} ${t.chip}`}>
            <span className="size-1.5 rounded-full bg-sky-500" /> {list.length}
          </span>
        }
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative sm:max-w-xs sm:flex-1">
            <Search className={`pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 ${t.muted}`} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search number, title, guest or location"
              className={`h-10 w-full bg-transparent pl-9 pr-3 text-sm outline-none focus:ring-2 ${t.radius} ${t.chip} ${t.ring}`}
            />
          </div>
          <div className="w-full sm:w-44">
            <Select t={t} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {TICKET_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </div>
          <Button t={t} variant="ghost" onClick={reload} className="sm:ml-auto">
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button t={t} onClick={() => navigate(`${listPath}/register`)}>
            <ClipboardList className="size-3.5" /> Register ticket
          </Button>
        </div>

        {error ? (
          <ErrorNote t={t} message={error} onRetry={reload} />
        ) : loading && !data ? (
          <Loading t={t} />
        ) : !list.length ? (
          <Empty
            t={t}
            icon={item.icon}
            title={tickets.length ? 'No tickets match your filters' : 'No tickets yet'}
            text={tickets.length ? 'Try a different search or status filter.' : 'Use Register ticket to log one — it will appear here with an auto-generated number.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="rtable w-full min-w-[80rem] table-fixed border-collapse">
              <thead>
                <tr className={`border-b ${t.sidebarDivider}`}>
                  <th className={th}>Ticket</th>
                  <th className={`w-32 ${th}`}>Category</th>
                  <th className={`w-28 ${th}`}>Priority</th>
                  <th className={`w-44 ${th}`}>Location</th>
                  <th className={`w-44 ${th}`}>Assigned to</th>
                  <th className={`w-52 ${th}`}>Reported</th>
                  <th className={`w-52 ${th}`}>Dates</th>
                  <th className={`w-24 ${th}`}>Files</th>
                  <th className={`w-40 ${th}`}>Status</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {list.map((tk, i) => (
                    <TicketRow key={tk.id} t={t} tk={tk} i={i} busy={busyId === tk.id} onStatus={(s) => requestStatus(tk, s)} />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}

/** Register-ticket form as a popup over the list — opened from the sidebar link or the Register ticket button. */
function RegisterTicketDialog({ t, me, rooms, staff, onClose, onSaved }: {
  t: WorkspaceTheme
  me: Employee
  rooms: Room[]
  staff: StaffChoice[]
  onClose: () => void
  onSaved: (tk: Ticket) => void
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [files, setFiles] = useState<File[]>([])
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }))

  function addFiles(picked: FileList | null) {
    if (!picked) return
    const next = [...files]
    for (const f of picked) {
      if (f.size > MAX_FILE_BYTES) {
        setMessage(`${f.name} is over 10 MB.`)
        continue
      }
      if (next.length >= MAX_FILES) {
        setMessage(`A ticket can have at most ${MAX_FILES} attachments.`)
        break
      }
      next.push(f)
    }
    setFiles(next)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setErrors({})
    setMessage('')
    try {
      const ticket = await bnb.registerTicket({
        title: form.title,
        description: form.description || undefined,
        category: form.category,
        priority: form.priority,
        room: form.room ? Number(form.room) : null,
        location: form.location || undefined,
        source: 'reception',
        assigned_to: form.assign_to ? Number(form.assign_to) : undefined,
      }, files)
      onSaved(ticket)
    } catch (err) {
      const p = parseApiError(err)
      setErrors(p.fields)
      setMessage(p.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
      <motion.form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label="Register a ticket"
        initial={{ scale: 0.94, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className={`relative my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden shadow-2xl ${t.radius} ${t.root}`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-900/10 px-5 py-4 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid size-10 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
              <ClipboardList className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className={`truncate text-base ${t.heading}`}>Register a ticket</h3>
              <p className={`text-xs ${t.muted}`}>Log a maintenance, housekeeping or guest ticket.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`grid size-9 shrink-0 place-items-center ${t.radius} ${t.iconButton}`}>
            <X className="size-4" />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-5">
          <Input t={t} label="Title" required placeholder="e.g. Leaking tap in room 204" value={form.title} onChange={(e) => set('title', e.target.value)} error={errors.title} />
          <Textarea t={t} label="Description" placeholder="What happened, where exactly, and anything the team should know." value={form.description} onChange={(e) => set('description', e.target.value)} error={errors.description} />
          <div className="grid grid-cols-2 gap-3">
            <Select t={t} label="Category" value={form.category} onChange={(e) => set('category', e.target.value)} error={errors.category}>
              {TICKET_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
            <Select t={t} label="Priority" value={form.priority} onChange={(e) => set('priority', e.target.value)} error={errors.priority}>
              {TICKET_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select t={t} label="Room (optional)" value={form.room} onChange={(e) => set('room', e.target.value)} error={errors.room}>
              <option value="">— Not a room —</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
            <Input t={t} label="Or common area" placeholder="Lobby, pool, parking…" value={form.location} onChange={(e) => set('location', e.target.value)} error={errors.location} />
          </div>
          <Select t={t} label="Allocate to (optional)" value={form.assign_to} onChange={(e) => set('assign_to', e.target.value)} error={errors.assigned_to}>
            <option value="">— Leave unassigned —</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.role}</option>)}
          </Select>
          {!staff.length && <p className={`-mt-1 text-[11px] ${t.muted}`}>No active employees registered at your branch yet.</p>}

          <input ref={fileRef} type="file" multiple accept={FILE_ACCEPT} className="hidden" onChange={(e) => addFiles(e.target.files)} />
          <div className="flex flex-col gap-2">
            <Button t={t} variant="ghost" onClick={() => fileRef.current?.click()}>
              <Paperclip className="size-3.5" /> Attach photos, videos or documents
            </Button>
            {errors.new_files && <p className="text-[11px] text-rose-500">{errors.new_files}</p>}
            {files.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className={`inline-flex max-w-full items-center gap-1.5 px-2 py-1 text-[11px] ${t.radius} ${t.chip}`}>
                    <Paperclip className="size-3 shrink-0" />
                    <span className="truncate">{f.name}</span>
                    <button type="button" onClick={() => setFiles((l) => l.filter((_, j) => j !== i))} className={t.muted} aria-label={`Remove ${f.name}`}>
                      <X className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <footer className="space-y-3 border-t border-slate-900/10 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/10">
          <Flash message={message} tone="red" />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <p className={`mr-auto text-[11px] ${t.muted}`}>Logged by {me.full_name} · ticket number is generated automatically</p>
            <Button t={t} variant="ghost" onClick={onClose}>Cancel</Button>
            <Button t={t} type="submit" busy={busy}>Register ticket</Button>
          </div>
        </footer>
      </motion.form>
    </motion.div>
  )
}

interface DetailForm {
  /** Who does the work — a staff member's id as a string, 'contractor', or ''. */
  assign_to: string
  assignee_name: string
  supplier_phone: string
  started_on: string
  hold_reason: string
  held_on: string
  items: { name: string; price: string }[]
  labour_cost: string
  payment_ref: string
  reopen_reason: string
  reopened_on: string
}

/** Popup that collects the details each status needs before the change is saved. */
function StatusDialog({ t, tk, status, staff, onClose, onSaved }: {
  t: WorkspaceTheme
  tk: Ticket
  status: TicketStatus
  staff: StaffChoice[]
  onClose: () => void
  onSaved: (tk: Ticket) => void
}) {
  const [form, setForm] = useState<DetailForm>(() => ({
    assign_to: tk.assigned_to ? String(tk.assigned_to) : tk.assignee_name || tk.supplier_name ? 'contractor' : '',
    assignee_name: tk.assignee_name || tk.supplier_name,
    supplier_phone: tk.supplier_phone,
    started_on: tk.started_on ?? todayISO(),
    hold_reason: tk.hold_reason,
    held_on: tk.held_on ?? todayISO(),
    items: tk.items.map((i) => ({ name: i.name, price: i.price })),
    labour_cost: tk.labour_cost ?? '',
    payment_ref: tk.payment_ref,
    reopen_reason: tk.reopen_reason,
    reopened_on: tk.reopened_on ?? todayISO(),
  }))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const label = TICKET_STATUSES.find((s) => s.value === status)?.label ?? status
  const Icon = STATUS_ICON[status]
  const set = (k: keyof DetailForm, v: string | { name: string; price: string }[]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const itemsTotal = form.items.reduce((n, i) => n + (Number(i.price) || 0), 0)
  const grandTotal = itemsTotal + (Number(form.labour_cost) || 0)

  function buildPatch(): TicketEdit | null {
    const errs: FieldErrors = {}
    const p: TicketEdit = { status }
    if (status === 'assigned') {
      if (!form.assign_to) {
        errs.assigned_to = 'Pick an employee or a contractor.'
      } else if (form.assign_to === 'contractor') {
        if (!form.assignee_name.trim()) errs.assignee_name = 'Who is supplying or doing the work?'
        if (!form.supplier_phone.trim()) errs.supplier_phone = 'Give the contractor phone number.'
        p.assigned_to = null
        p.assignee_name = form.assignee_name.trim()
        p.supplier_name = ''
        p.supplier_phone = form.supplier_phone.trim()
      } else {
        p.assigned_to = Number(form.assign_to)
        p.assignee_name = ''
        p.supplier_name = ''
        p.supplier_phone = ''
      }
    } else if (status === 'in_progress') {
      if (!form.started_on) errs.started_on = 'Pick the start date.'
      p.started_on = form.started_on
    } else if (status === 'on_hold') {
      if (!form.hold_reason.trim()) errs.hold_reason = 'Why is the ticket on hold?'
      if (!form.held_on) errs.held_on = 'Pick a date.'
      p.hold_reason = form.hold_reason.trim()
      p.held_on = form.held_on
    } else if (status === 'resolved') {
      const items = form.items.filter((i) => i.name.trim() || i.price.trim())
      if (items.some((i) => !i.name.trim() || !(Number(i.price) >= 0))) errs.items = 'Give every item a name and a price.'
      if (form.labour_cost === '' || Number(form.labour_cost) < 0) errs.labour_cost = 'Enter the labour cost (0 if none).'
      p.items = items.map((i) => ({ name: i.name.trim(), price: i.price }))
      p.labour_cost = form.labour_cost
    } else if (status === 'closed') {
      if (!form.payment_ref.trim()) errs.payment_ref = 'Enter the payment reference.'
      p.payment_ref = form.payment_ref.trim()
    } else if (status === 'reopened') {
      if (!form.reopen_reason.trim()) errs.reopen_reason = 'Why is the ticket reopened?'
      if (!form.reopened_on) errs.reopened_on = 'Pick a date.'
      p.reopen_reason = form.reopen_reason.trim()
      p.reopened_on = form.reopened_on
    }
    setErrors(errs)
    return Object.keys(errs).length ? null : p
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    const patch = buildPatch()
    if (!patch) return
    setBusy(true)
    setMessage('')
    try {
      onSaved(await bnb.updateTicket(tk.id, patch))
    } catch (err) {
      setMessage(parseApiError(err).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
      <motion.form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label={`Mark ticket as ${label}`}
        initial={{ scale: 0.94, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className={`relative my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden shadow-2xl ${t.radius} ${t.root}`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-900/10 px-5 py-4 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid size-10 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className={`truncate text-base ${t.heading}`}>Mark as {label}</h3>
              <p className={`truncate text-xs ${t.muted}`}>{tk.number} · {tk.title}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`grid size-9 shrink-0 place-items-center ${t.radius} ${t.iconButton}`}>
            <X className="size-4" />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-5">
          {status === 'assigned' && (
            <>
              <Select t={t} label="Allocate to" value={form.assign_to} onChange={(e) => set('assign_to', e.target.value)} error={errors.assigned_to}>
                <option value="">— Pick who does the work —</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.role}</option>)}
                <option value="contractor">External contractor / supplier</option>
              </Select>
              {!staff.length && <p className={`-mt-1 text-[11px] ${t.muted}`}>No active employees registered at your branch yet — pick a contractor instead.</p>}
              {form.assign_to === 'contractor' && (
                <>
                  <Input t={t} label="Contractor / supplier name" required placeholder="e.g. FixIt Plumbers Ltd" value={form.assignee_name} onChange={(e) => set('assignee_name', e.target.value)} error={errors.assignee_name} />
                  <Input t={t} label="Contractor phone" required type="tel" placeholder="e.g. 0712 345 678" value={form.supplier_phone} onChange={(e) => set('supplier_phone', e.target.value)} error={errors.supplier_phone} />
                </>
              )}
            </>
          )}

          {status === 'in_progress' && (
            <Input t={t} label="Start date" required type="date" max={todayISO()} value={form.started_on} onChange={(e) => set('started_on', e.target.value)} error={errors.started_on} />
          )}

          {status === 'on_hold' && (
            <>
              <Textarea t={t} label="Reason for hold" required placeholder="e.g. Waiting for a replacement part." value={form.hold_reason} onChange={(e) => set('hold_reason', e.target.value)} error={errors.hold_reason} />
              <Input t={t} label="On hold since" required type="date" max={todayISO()} value={form.held_on} onChange={(e) => set('held_on', e.target.value)} error={errors.held_on} />
            </>
          )}

          {status === 'resolved' && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Items used</p>
                <Button t={t} variant="ghost" onClick={() => set('items', [...form.items, { name: '', price: '' }])}>
                  <Plus className="size-3.5" /> Add item
                </Button>
              </div>
              {form.items.map((it, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex-1">
                    <Input t={t} placeholder="Item name" value={it.name} onChange={(e) => set('items', form.items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  </div>
                  <div className="w-32">
                    <Input t={t} placeholder="Price" type="number" min="0" step="0.01" inputMode="decimal" value={it.price} onChange={(e) => set('items', form.items.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
                  </div>
                  <button type="button" onClick={() => set('items', form.items.filter((_, j) => j !== i))} aria-label="Remove item" className={`mt-2.5 grid size-9 shrink-0 place-items-center ${t.radius} ${t.iconButton}`}>
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              {errors.items && <p className="text-[11px] text-rose-500">{errors.items}</p>}
              <Input t={t} label="Labour cost (KES)" required type="number" min="0" step="0.01" inputMode="decimal" value={form.labour_cost} onChange={(e) => set('labour_cost', e.target.value)} error={errors.labour_cost} />
              <div className={`flex items-center justify-between px-4 py-3 text-sm ${t.radius} ${t.chip}`}>
                <span className={t.muted}>Items {formatMoney(itemsTotal)} + labour {formatMoney(Number(form.labour_cost) || 0)}</span>
                <span className="font-semibold">Total {formatMoney(grandTotal)}</span>
              </div>
            </>
          )}

          {status === 'closed' && (
            <Input t={t} label="Payment reference" required placeholder="e.g. M-Pesa code or receipt number" value={form.payment_ref} onChange={(e) => set('payment_ref', e.target.value)} error={errors.payment_ref} />
          )}

          {status === 'reopened' && (
            <>
              <Textarea t={t} label="Reason for reopening" required placeholder="e.g. The same fault came back." value={form.reopen_reason} onChange={(e) => set('reopen_reason', e.target.value)} error={errors.reopen_reason} />
              <Input t={t} label="Date reopened" required type="date" max={todayISO()} value={form.reopened_on} onChange={(e) => set('reopened_on', e.target.value)} error={errors.reopened_on} />
            </>
          )}
        </div>

        <footer className="space-y-3 border-t border-slate-900/10 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/10">
          <Flash message={message} tone="red" />
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button t={t} variant="ghost" onClick={onClose}>Cancel</Button>
            <Button t={t} type="submit" busy={busy}>Mark {label}</Button>
          </div>
        </footer>
      </motion.form>
    </motion.div>
  )
}

function TicketRow({ t, tk, i, busy, onStatus }: { t: WorkspaceTheme; tk: Ticket; i: number; busy: boolean; onStatus: (s: TicketStatus) => void }) {
  const place = tk.room_name || tk.location || 'Property'
  const overdue = tk.due && !DONE.includes(tk.status) && tk.due < todayISO()
  const details = [
    tk.hold_reason ? `On hold: ${tk.hold_reason}` : '',
    tk.items.length || tk.labour_cost ? `Cost ${formatMoney(Number(tk.items_total) + Number(tk.labour_cost ?? 0))}` : '',
    tk.payment_ref ? `Paid: ${tk.payment_ref}` : '',
    tk.reopen_reason ? `Reopened: ${tk.reopen_reason}` : '',
  ].filter(Boolean)
  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: Math.min(i, 10) * 0.03, duration: 0.25 }}
      className={`border-b transition-colors last:border-b-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] ${t.sidebarDivider}`}
    >
      <td className="max-w-0 px-3 py-3 align-top">
        <p className={`font-mono text-xs font-semibold ${t.muted}`}>{tk.number}</p>
        <p className="mt-0.5 truncate text-sm font-semibold" title={tk.title}>{tk.title}</p>
        {tk.description && <p className={`mt-0.5 truncate text-xs ${t.muted}`} title={tk.description}>{tk.description}</p>}
        {details.length > 0 && (
          <p className={`mt-1 truncate text-[11px] ${t.muted}`} title={details.join(' · ')}>{details.join(' · ')}</p>
        )}
      </td>
      <td className="px-3 py-3 align-top"><Pill tone="slate">{tk.category_label}</Pill></td>
      <td className="px-3 py-3 align-top"><Pill tone={PRIORITY_TONE[tk.priority]}>{tk.priority_label}</Pill></td>
      <td className="px-3 py-3 align-top text-xs">
        <p className="flex items-center gap-1.5 font-medium">
          {tk.room_name ? <BedDouble className="size-3.5 shrink-0" /> : <MapPin className="size-3.5 shrink-0" />}
          <span className="truncate">{place}</span>
        </p>
        {tk.guest_name && <p className={`mt-1 truncate ${t.muted}`}><Contact className="mr-1 inline size-3" />{tk.guest_name}</p>}
      </td>
      <td className="px-3 py-3 align-top text-xs">
        <span className="inline-flex items-center gap-1"><UserCheck className="size-3.5 shrink-0" /> {tk.assigned_to_name || tk.assignee_name || 'Unassigned'}</span>
        {tk.supplier_name && <p className={`mt-1 truncate ${t.muted}`} title={`${tk.supplier_name} ${tk.supplier_phone}`}>Supplier: {tk.supplier_name}{tk.supplier_phone ? ` · ${tk.supplier_phone}` : ''}</p>}
      </td>
      <td className={`px-3 py-3 align-top text-xs ${t.muted}`}>
        {tk.reporter_name || tk.reported_by_name || '—'} · {tk.source_label}
      </td>
      <td className="px-3 py-3 align-top text-xs">
        <p className={overdue ? 'font-semibold text-rose-500' : ''}>
          <CalendarClock className="mr-1 inline size-3.5" />
          {tk.due ? `Due ${formatDate(tk.due)}` : 'No due date'}{overdue ? ' — overdue' : ''}
        </p>
        <p className={`mt-0.5 ${t.muted}`}>Opened {fmtDT(tk.created_at)}</p>
        {tk.started_on && <p className={`mt-0.5 ${t.muted}`}>Started {formatDate(tk.started_on)}</p>}
        {tk.status === 'on_hold' && tk.held_on && <p className={`mt-0.5 ${t.muted}`}>Held {formatDate(tk.held_on)}</p>}
        {tk.reopened_on && <p className={`mt-0.5 ${t.muted}`}>Reopened {formatDate(tk.reopened_on)}</p>}
        {tk.resolved_at && <p className={`mt-0.5 ${t.muted}`}>Resolved {fmtDT(tk.resolved_at)}</p>}
      </td>
      <td className="px-3 py-3 align-top">
        {tk.attachments.length ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {tk.attachments.map((a) =>
              IMG_RE.test(a.url) ? (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer" title={a.name}>
                  <img src={a.url} alt={a.name} className={`size-8 object-cover ${t.radius}`} />
                </a>
              ) : (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer" title={a.name} className={`grid size-8 place-items-center ${t.radius} ${t.chip}`}>
                  <Paperclip className="size-3.5" />
                </a>
              ),
            )}
          </div>
        ) : (
          <span className={`text-xs ${t.muted}`}>—</span>
        )}
      </td>
      <td className="px-3 py-3 align-top">
        <Select t={t} value={tk.status} disabled={busy} onChange={(e) => onStatus(e.target.value as TicketStatus)} aria-label="Ticket status">
          {TICKET_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </Select>
      </td>
    </motion.tr>
  )
}
