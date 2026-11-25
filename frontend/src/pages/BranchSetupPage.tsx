import { AnimatePresence, motion } from 'framer-motion'
import {
  Ban, Building2, Camera, Check, CircleAlert, CircleCheck, Eye, EyeOff, Loader2, Mail, MapPin, Pencil, Phone, Plus, Trash2, UserCheck, UserPlus, Users, UserX, X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { PhoneInput } from '../components/hr/PhoneInput'
import { Button, Empty, ErrorNote, Flash, Input, Loading, PageHeader, Person, Pill, Row, Select, Stat } from '../components/hr/ui'
import { parseApiError, type Employee, type FieldErrors } from '../lib/api'
import { bnb, type Branch } from '../lib/bnb'
import { formatDate, hr, STATUS_TONE, useApi } from '../lib/hr'
import { shrinkPhoto } from '../lib/image'
import type { NavItem, WorkspaceTheme } from '../lib/workspaces'
import { RegisterBranch } from './bnb/RegisterBranch'
import { EmployeeEditor } from './hr/EmployeeEditor'

const blankManager = { first_name: '', last_name: '', email: '', phone: '', code: '', password: '', confirm_password: '' }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
type CheckStatus = 'idle' | 'checking' | 'available' | 'taken'

/** Availability hint under a sign-in field — spinner while checking, then a green/red verdict. */
function CheckHint({ t, status, free, used }: { t: WorkspaceTheme; status: CheckStatus; free: string; used: string }) {
  if (status === 'idle') return null
  return (
    <p
      className={`mt-1 flex items-center gap-1 text-[11px] ${
        status === 'available' ? 'text-emerald-600 dark:text-emerald-400' : status === 'taken' ? 'text-rose-500' : t.muted
      }`}
      role="status"
    >
      {status === 'checking' && <Loader2 className="size-3 animate-spin" />}
      {status === 'available' && <Check className="size-3" />}
      {status === 'taken' && <CircleAlert className="size-3" />}
      {status === 'checking' ? 'Checking…' : status === 'available' ? free : used}
    </p>
  )
}

/** Admin → Branch setup: register branches and hand each one its manager logins. */
export default function BranchSetupPage({ item, t, me }: { item: NavItem; t: WorkspaceTheme; me: Employee }) {
  const branches = useApi(bnb.branches)
  const staff = useApi(() => hr.employees({ sort: 'name' }))
  const [registering, setRegistering] = useState(false)
  const [editing, setEditing] = useState<Branch | null>(null)
  const [deleting, setDeleting] = useState<Branch | null>(null)
  const [managerFor, setManagerFor] = useState<Branch | null>(null)
  const [editUser, setEditUser] = useState<Employee | null>(null)
  const [busy, setBusy] = useState(0)
  const [flash, setFlash] = useState({ text: '', bad: false })

  const managers = useMemo(() => (staff.data ?? []).filter((u) => u.role === 'branch_manager'), [staff.data])
  const managersOf = (branchId: number) => managers.filter((u) => u.branch === branchId)
  const unmanned = (branches.data ?? []).filter((b) => !managersOf(b.id).length)

  const upsertUser = (u: Employee) =>
    staff.setData((l) => (l?.some((x) => x.id === u.id) ? l.map((x) => (x.id === u.id ? u : x)) : [...(l ?? []), u]))

  async function toggleStatus(b: Branch) {
    setBusy(b.id)
    setFlash({ text: '', bad: false })
    try {
      const next = await bnb.updateBranch(b.id, { status: b.status === 'suspended' ? 'active' : 'suspended' })
      branches.setData((l) => l?.map((x) => (x.id === b.id ? next : x)) ?? null)
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
        actions={
          <Button t={t} onClick={() => { setEditing(null); setRegistering(true) }}>
            <Plus className="size-3.5" /> Register branch
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat t={t} i={0} icon={Building2} label="Registered branches" value={branches.data?.length ?? '—'} />
        <Stat t={t} i={1} icon={Users} label="Branch managers" value={staff.data ? managers.length : '—'} />
        <Stat t={t} i={2} icon={UserX} label="Branches without a manager" value={branches.data && staff.data ? unmanned.length : '—'} />
      </div>

      <div className="mb-1"><Flash message={flash.text} tone={flash.bad ? 'red' : 'green'} /></div>

      {branches.error || staff.error ? (
        <ErrorNote t={t} message={branches.error || staff.error} onRetry={() => { branches.reload(); staff.reload() }} />
      ) : (branches.loading && !branches.data) || (staff.loading && !staff.data) ? (
        <Loading t={t} />
      ) : !branches.data?.length ? (
        <section className={`${t.radius} ${t.card}`}>
          <Empty t={t} icon={Building2} title="No branches registered yet" text="Register your first BnB branch, then create a manager login for it." />
        </section>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-2">
          {branches.data.map((b) => (
            <BranchCard
              key={b.id}
              t={t}
              branch={b}
              managers={managersOf(b.id)}
              busy={busy === b.id}
              onEdit={() => { setEditing(b); setRegistering(true) }}
              onToggle={() => void toggleStatus(b)}
              onDelete={() => setDeleting(b)}
              onAddManager={() => setManagerFor(b)}
              onEditManager={setEditUser}
            />
          ))}
        </div>
      )}

      <RegisterBranch
        t={t}
        open={registering}
        editing={editing}
        onClose={() => { setRegistering(false); setEditing(null) }}
        onSaved={(b) => {
          branches.setData((l) => (editing ? (l?.map((x) => (x.id === b.id ? b : x)) ?? null) : [b, ...(l ?? [])]))
          setRegistering(false)
          setEditing(null)
          setFlash({ text: editing ? `${b.name} was updated.` : `${b.name} was registered — now add its manager login.`, bad: false })
        }}
      />
      <ManagerDialog
        t={t}
        branch={managerFor}
        staff={staff.data ?? []}
        onClose={() => setManagerFor(null)}
        onSaved={(u) => {
          upsertUser(u)
          setManagerFor(null)
          setFlash({ text: `${u.full_name} can now sign in as ${managerFor?.name}'s manager with code ${u.code}.`, bad: false })
        }}
      />
      <EmployeeEditor t={t} me={me} employee={editUser} onClose={() => setEditUser(null)} onSaved={upsertUser} />
      <ConfirmDelete
        t={t}
        branch={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={(id) => {
          branches.setData((l) => l?.filter((x) => x.id !== id) ?? null)
          setDeleting(null)
        }}
      />
    </div>
  )
}

interface CardProps {
  t: WorkspaceTheme
  branch: Branch
  managers: Employee[]
  busy: boolean
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
  onAddManager: () => void
  onEditManager: (u: Employee) => void
}

/** One branch card — its details, quick actions, and the manager logins under it. */
function BranchCard({ t, branch: b, managers, busy, onEdit, onToggle, onDelete, onAddManager, onEditManager }: CardProps) {
  const suspended = b.status === 'suspended'
  return (
    <motion.section layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className={`p-4 sm:p-5 ${t.radius} ${t.card}`}>
      <div className={`flex items-start gap-3 ${suspended ? 'opacity-55' : ''}`}>
        <span className={`relative grid size-12 shrink-0 place-items-center overflow-hidden ${t.radius} ${t.iconBox}`}>
          {b.photo ? <img src={b.photo} alt="" className="size-full object-cover" /> : <Building2 className="size-6" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`truncate text-base ${t.heading}`}>{b.name}</p>
            {suspended ? <Pill tone="red">Suspended</Pill> : <Pill tone="blue">Code {b.code}</Pill>}
          </div>
          <p className={`mt-0.5 truncate text-xs ${t.muted}`}>
            <MapPin className="mr-1 inline size-3" />{b.location}
            <span className="mx-1.5">·</span>opened {formatDate(b.created_at)}
          </p>
          <p className={`truncate text-xs ${t.muted}`}>
            <Mail className="mr-1 inline size-3" />{b.email}
            <span className="mx-1.5">·</span>
            <Phone className="mr-1 inline size-3" />{b.phone}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" aria-label={`Edit ${b.name}`} title="Edit branch" onClick={onEdit} className={`grid size-8 place-items-center ${t.radius} ${t.muted} hover:text-sky-500`}>
            <Pencil className="size-4" />
          </button>
          <button
            type="button" aria-label={`${suspended ? 'Reactivate' : 'Suspend'} ${b.name}`} title={suspended ? 'Reactivate' : 'Suspend'}
            disabled={busy} onClick={onToggle} className={`grid size-8 place-items-center ${t.radius} ${t.muted} hover:text-amber-500 disabled:opacity-40`}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : suspended ? <CircleCheck className="size-4" /> : <Ban className="size-4" />}
          </button>
          <button type="button" aria-label={`Delete ${b.name}`} title="Delete" onClick={onDelete} className={`grid size-8 place-items-center ${t.radius} ${t.muted} hover:text-rose-500`}>
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <div className={`mt-4 border-t pt-4 ${t.sidebarDivider}`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className={`text-xs font-semibold uppercase tracking-wider ${t.muted}`}>Branch {managers.length === 1 ? 'manager' : 'managers'}</p>
          <Button t={t} variant="ghost" onClick={onAddManager}>
            <UserPlus className="size-3.5" /> Add manager
          </Button>
        </div>
        {!managers.length ? (
          <div className={`flex items-center gap-3 p-3 text-xs ${t.radius} ${t.chip}`}>
            <UserX className="size-4 shrink-0" />
            <span className={t.muted}>No manager login yet — add one so this branch can be run.</span>
          </div>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {managers.map((u, i) => (
                <Row key={u.id} t={t} i={i}>
                  <div className="min-w-0 flex-1">
                    <Person t={t} user={u} sub={`Code ${u.code} · ${u.email}`} />
                  </div>
                  <Pill tone={STATUS_TONE[u.status]}>{u.status_label}</Pill>
                  <button
                    type="button" aria-label={`Edit ${u.full_name}`} title="Edit login" onClick={() => onEditManager(u)}
                    className={`grid size-8 shrink-0 place-items-center ${t.radius} ${t.muted} hover:text-sky-500`}
                  >
                    <Pencil className="size-4" />
                  </button>
                </Row>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </motion.section>
  )
}

interface ManagerDialogProps {
  t: WorkspaceTheme
  branch: Branch | null
  staff: Employee[]
  onClose: () => void
  onSaved: (u: Employee) => void
}

/** Assign a manager login to a branch — either create a fresh account from the
 *  manager's details, or promote an existing staff member onto the branch. */
function ManagerDialog({ t, branch, ...rest }: ManagerDialogProps) {
  return (
    <AnimatePresence>
      {branch && <ManagerForm key={branch.id} t={t} branch={branch} {...rest} />}
    </AnimatePresence>
  )
}

function ManagerForm({ t, branch, staff, onClose, onSaved }: ManagerDialogProps & { branch: Branch }) {
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [form, setForm] = useState(blankManager)
  const [pick, setPick] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [showPw, setShowPw] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [codeStatus, setCodeStatus] = useState<CheckStatus>('idle')
  const [emailStatus, setEmailStatus] = useState<CheckStatus>('idle')
  const codeSeq = useRef(0)
  const emailSeq = useRef(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo])
  const initials = `${form.first_name[0] ?? ''}${form.last_name[0] ?? ''}`.toUpperCase()

  // Anyone not already managing this branch can be promoted onto it.
  const candidates = staff.filter((u) => !(u.role === 'branch_manager' && u.branch === branch.id))

  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Live availability lookups — debounced like the branch code check.
  useEffect(() => {
    const seq = ++codeSeq.current
    const timer = setTimeout(() => {
      if (form.code.length !== 6) return setCodeStatus('idle')
      setCodeStatus('checking')
      hr.checkEmployeeCode(form.code)
        .then((r) => codeSeq.current === seq && setCodeStatus(r.available ? 'available' : 'taken'))
        .catch(() => codeSeq.current === seq && setCodeStatus('idle'))
    }, 300)
    return () => clearTimeout(timer)
  }, [form.code])

  useEffect(() => {
    const seq = ++emailSeq.current
    const timer = setTimeout(() => {
      if (!EMAIL_RE.test(form.email)) return setEmailStatus('idle')
      setEmailStatus('checking')
      hr.checkEmployeeEmail(form.email)
        .then((r) => emailSeq.current === seq && setEmailStatus(r.available ? 'available' : 'taken'))
        .catch(() => emailSeq.current === seq && setEmailStatus('idle'))
    }, 300)
    return () => clearTimeout(timer)
  }, [form.email])

  const set = (k: keyof typeof blankManager) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function pickPhoto(f: File | undefined) {
    if (!f) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return setErrors((e) => ({ ...e, photo: 'Use a JPG, PNG or WebP picture.' }))
    try {
      setPhoto(await shrinkPhoto(f))
      setErrors((e) => ({ ...e, photo: '' }))
    } catch {
      setErrors((e) => ({ ...e, photo: "This picture couldn't be read. Try another one." }))
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (mode === 'new' && form.password !== form.confirm_password) return setErrors({ confirm_password: 'Passwords do not match.' })
    if (mode === 'new' && codeStatus === 'taken') return setErrors({ code: 'This code is already used by another employee. Pick a different one.' })
    if (mode === 'new' && emailStatus === 'taken') return setErrors({ email: 'Another employee already uses this email.' })
    if (mode === 'existing' && !pick) return setErrors({ pick: 'Choose who manages this branch.' })
    setSaving(true)
    setErrors({})
    setMessage('')
    try {
      const user =
        mode === 'existing'
          ? await hr.activate(Number(pick), 'branch_manager', branch.id)
          : await hr.createEmployee({ ...form, role: 'branch_manager', branch: branch.id }, photo)
      onSaved(user)
    } catch (err) {
      const { message, fields } = parseApiError(err)
      setErrors(fields)
      setMessage(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
      <motion.form
        onSubmit={save}
        role="dialog"
        aria-modal="true"
        aria-label={`Add a manager to ${branch.name}`}
        initial={{ scale: 0.94, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className={`relative my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden shadow-2xl ${t.radius} ${t.root}`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-900/10 px-5 py-4 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid size-10 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
              <UserCheck className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className={`truncate text-base ${t.heading}`}>Add a manager — {branch.name}</h3>
              <p className={`text-xs ${t.muted}`}>Fill in the manager's details to create their sign-in, or pick a staff member.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`grid size-9 shrink-0 place-items-center ${t.radius} ${t.iconButton}`}>
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <div className={`inline-flex gap-1 p-1 ${t.radius} ${t.chip}`}>
            {(['new', 'existing'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setErrors({}); setMessage('') }}
                className={`h-8 px-3 text-xs font-semibold transition ${t.radius} ${mode === m ? `${t.brandMark} shadow` : t.muted}`}
              >
                {m === 'new' ? 'New login' : 'Existing staff'}
              </button>
            ))}
          </div>

          {mode === 'existing' ? (
            <fieldset className="grid gap-3">
              <legend className={`mb-1 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>Promote a staff member</legend>
              <Select t={t} label="Staff member" value={pick} onChange={(e) => setPick(e.target.value)} error={errors.pick} required>
                <option value="">Choose…</option>
                {candidates.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name} — {u.role_label}{u.status !== 'active' ? ` (${u.status_label.toLowerCase()})` : ''}</option>
                ))}
              </Select>
              <p className={`text-[11px] ${t.muted}`}>
                Their role becomes Branch manager at {branch.name} and the account is activated — they sign in with the code on their account.
              </p>
            </fieldset>
          ) : (
            <>
              <section className="flex items-center gap-4">
                <span className={`relative grid size-20 shrink-0 place-items-center overflow-hidden ring-2 ${t.radius} ${t.ring}`}>
                  {preview ? (
                    <img src={preview} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center bg-gradient-to-br from-slate-400 to-slate-600 text-lg font-semibold text-white">{initials || <UserCheck className="size-7" />}</span>
                  )}
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button t={t} variant="ghost" onClick={() => fileRef.current?.click()}><Camera className="size-3.5" />{preview ? 'Change picture' : 'Add picture (optional)'}</Button>
                  {preview && <Button t={t} variant="danger" onClick={() => setPhoto(null)}><Trash2 className="size-3.5" />Remove</Button>}
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = '' }} />
                  {errors.photo && <p className="w-full text-[11px] text-rose-500">{errors.photo}</p>}
                </div>
              </section>

              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>Manager details</legend>
                <Input t={t} label="First name" value={form.first_name} onChange={set('first_name')} error={errors.first_name} required />
                <Input t={t} label="Last name" value={form.last_name} onChange={set('last_name')} error={errors.last_name} required />
                <div>
                  <Input t={t} label="Personal email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value.toLowerCase() }))} error={errors.email} required />
                  {!errors.email && <CheckHint t={t} status={emailStatus} free="This email is available." used="Another employee already uses this email." />}
                </div>
                <PhoneInput t={t} label="Phone number" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} error={errors.phone} required />
              </fieldset>

              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>Sign-in</legend>
                <div>
                  <Input
                    t={t} label="6-digit code login" inputMode="numeric" maxLength={6} pattern="\d{6}" value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.replace(/\D/g, '').slice(0, 6) }))} error={errors.code} required
                  />
                  {!errors.code && <CheckHint t={t} status={codeStatus} free="This code is available." used="This code is already used by another employee." />}
                </div>
                <span className="hidden sm:block" />
                <Input t={t} label="Login password" type={showPw ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} required />
                <Input t={t} label="Confirm password" type={showPw ? 'text' : 'password'} autoComplete="new-password" value={form.confirm_password} onChange={set('confirm_password')} error={errors.confirm_password} required />
                <button type="button" onClick={() => setShowPw((s) => !s)} className={`inline-flex items-center gap-1.5 text-xs sm:col-span-2 ${t.muted}`}>
                  {showPw ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}{showPw ? 'Hide passwords' : 'Show passwords'}
                </button>
                <p className={`text-[11px] sm:col-span-2 ${t.muted}`}>
                  The account starts active — the manager signs in straight away with this code and password. A 6-digit number (not the same as the code) or 8+ characters.
                </p>
              </fieldset>
            </>
          )}
        </div>

        <footer className="space-y-3 border-t border-slate-900/10 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/10">
          <Flash message={message} tone="red" />
          <div className="flex justify-end gap-2">
            <Button t={t} variant="ghost" onClick={onClose}>Cancel</Button>
            <Button t={t} type="submit" busy={saving}>{mode === 'new' ? 'Create manager login' : 'Assign manager'}</Button>
          </div>
        </footer>
      </motion.form>
    </motion.div>
  )
}

function ConfirmDelete({ t, branch, onClose, onDeleted }: { t: WorkspaceTheme; branch: Branch | null; onClose: () => void; onDeleted: (id: number) => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function remove() {
    if (!branch) return
    setBusy(true)
    setErr('')
    try {
      await bnb.deleteBranch(branch.id)
      onDeleted(branch.id)
    } catch (e) {
      setErr(parseApiError(e).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      {branch && (
        <motion.div key={branch.id} className="fixed inset-0 z-[60] grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
          <motion.div
            role="alertdialog" aria-modal="true" aria-label={`Delete ${branch.name}`}
            initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            className={`relative w-full max-w-sm p-5 shadow-2xl ${t.radius} ${t.root}`}
          >
            <span className={`grid size-10 place-items-center ${t.radius} bg-rose-500/10 text-rose-500`}>
              <Trash2 className="size-5" />
            </span>
            <h3 className={`mt-3 text-base ${t.heading}`}>Delete {branch.name}?</h3>
            <p className={`mt-1 text-xs ${t.muted}`}>
              This permanently removes the branch, its sign-in code {branch.code} and its photo. Staff assigned to it keep their accounts.
            </p>
            <div className="mt-3"><Flash message={err} tone="red" /></div>
            <div className="mt-4 flex justify-end gap-2">
              <Button t={t} variant="ghost" onClick={onClose}>Cancel</Button>
              <Button t={t} variant="danger" busy={busy} onClick={() => void remove()}>Delete branch</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
