import { AnimatePresence, motion } from 'framer-motion'
import {
  Ban, Building2, CircleCheck, Eye, EyeOff, ListChecks, Loader2, Mail, Pencil, Phone, Plus,
  Search, Trash2, UserCheck, Users, UserX, X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Empty, ErrorNote, Flash, Input, Loading, PageHeader, Panel, Person, Pill, Select, Stat } from '../components/hr/ui'
import { parseApiError, type Employee, type FieldErrors, type Role } from '../lib/api'
import { formatDate, hr, todayISO, useApi, STATUS_TONE, type EmployeeEdit, type MemberSignup } from '../lib/hr'
import { shrinkPhoto } from '../lib/image'
import { AssignTaskDialog, TasksPanel, type AssignState, type TaskQuery } from './TeamTasks'
import { BRANCH_ROLES, ROLE_LABELS } from '../lib/roles'
import type { NavItem, WorkspaceTheme } from '../lib/workspaces'

/** Staff roles a branch manager can give out (not branch_manager — HR assigns those). */
const TEAM_ROLES = BRANCH_ROLES.filter((r) => r !== 'branch_manager')
const EDIT_FIELDS = ['first_name', 'last_name', 'email', 'phone', 'code', 'role', 'status'] as const
const STATUSES = [
  ['active', 'Active'],
  ['pending', 'Pending activation'],
  ['suspended', 'Suspended'],
] as const

const blankSignup: MemberSignup = {
  first_name: '', last_name: '', email: '', phone: '', code: '',
  role: 'branch_employee', password: '', confirm_password: '',
}

const isPin = (pw: string) => /^\d{6}$/.test(pw)

export default function TeamShiftsPage({ item, t, me, view = 'list' }: { item: NavItem; t: WorkspaceTheme; me: Employee; view?: 'list' | 'register' | 'tasks' }) {
  const { data, error, loading, reload, setData } = useApi(() => hr.team({ sort: 'name' }))
  const typeApi = useApi(hr.taskTypes)
  const [taskQuery, setTaskQuery] = useState<TaskQuery>({ date: todayISO(), status: '' })
  const taskApi = useApi(
    () => hr.tasks({ ...(taskQuery.date ? { date: taskQuery.date } : {}), ...(taskQuery.status ? { status: taskQuery.status } : {}) }),
    [taskQuery],
  )
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [busy, setBusy] = useState(0)
  const [flash, setFlash] = useState({ text: '', bad: false })
  const [taskFlash, setTaskFlash] = useState({ text: '', bad: false })
  const [editing, setEditing] = useState<Employee | null>(null)
  const [deleting, setDeleting] = useState<Employee | null>(null)
  const [assign, setAssign] = useState<AssignState | null>(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  /** Register is a dialog over this list — the /register URL opens it, closing returns here. */
  const listPath = pathname.replace(/\/register$/, '')

  const team = useMemo(
    () =>
      (data ?? []).filter(
        (u) =>
          (!statusFilter || u.status === statusFilter) &&
          (!roleFilter || u.role === roleFilter) &&
          (!q || `${u.full_name} ${u.code} ${u.email} ${u.phone}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [data, q, statusFilter, roleFilter],
  )
  const count = (s: Employee['status']) => data?.filter((u) => u.status === s).length ?? '—'
  const th = `px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider ${t.muted}`

  async function toggle(u: Employee) {
    setBusy(u.id)
    setFlash({ text: '', bad: false })
    try {
      const next = u.status === 'active' ? await hr.suspendMember(u.id) : await hr.activateMember(u.id)
      setData((list) => list?.map((x) => (x.id === u.id ? next : x)) ?? null)
      setFlash({ text: `${next.full_name} is now ${next.status_label.toLowerCase()}.`, bad: false })
    } catch (e) {
      setFlash({ text: parseApiError(e).message, bad: true })
    } finally {
      setBusy(0)
    }
  }

  const manageable = (u: Employee) => u.id !== me.id && u.role !== 'branch_manager'

  return (
    <div className="space-y-5">
      <PageHeader
        t={t}
        icon={item.icon}
        title={item.label}
        text={item.description}
        actions={
          me.branch && view !== 'tasks' ? (
            <Button t={t} onClick={() => navigate(`${listPath}/register`)}>
              <Plus className="size-3.5" /> Register employee
            </Button>
          ) : undefined
        }
      />

      {!me.branch ? (
        <Panel t={t}>
          <Empty
            t={t}
            icon={Building2}
            title="No branch allocated yet"
            text="Your account isn't assigned to a BnB branch, so there's no team to manage. Ask IT support to allocate you from HR → Branch allocation."
          />
        </Panel>
      ) : view === 'tasks' ? (
        <TasksPanel
          t={t}
          types={typeApi}
          tasks={taskApi}
          query={taskQuery}
          onQuery={setTaskQuery}
          onAssign={setAssign}
          flash={taskFlash}
          onFlash={(text, bad = false) => setTaskFlash({ text, bad })}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Stat t={t} i={0} icon={Users} label="Team members" value={data?.length ?? '—'} />
            <Stat t={t} i={1} icon={CircleCheck} label="Active" value={count('active')} />
            <Stat t={t} i={2} icon={UserCheck} label="Pending activation" value={count('pending')} />
            <Stat t={t} i={3} icon={UserX} label="Suspended" value={count('suspended')} />
          </div>

          <Panel t={t} title={`Staff at ${me.branch_name ?? 'your branch'}`}>
            <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_11rem_11rem]">
              <div className="relative">
                <Search className={`pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 ${t.muted}`} />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search name, code, email or phone"
                  className={`h-10 w-full bg-transparent pl-9 pr-3 text-sm outline-none focus:ring-2 ${t.radius} ${t.chip} ${t.ring}`}
                />
              </div>
              <Select t={t} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status">
                <option value="">All statuses</option>
                {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
              <Select t={t} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Role">
                <option value="">All roles</option>
                {BRANCH_ROLES.map((v) => <option key={v} value={v}>{ROLE_LABELS[v]}</option>)}
              </Select>
            </div>
            <div className="mb-3"><Flash message={flash.text} tone={flash.bad ? 'red' : 'green'} /></div>
            {error ? (
              <ErrorNote t={t} message={error} onRetry={reload} />
            ) : loading && !data ? (
              <Loading t={t} />
            ) : !team.length ? (
              <Empty
                t={t}
                icon={Users}
                title={data?.length ? 'No one matches your filters' : 'No staff at this branch yet'}
                text={data?.length ? 'Try a different search or filter.' : 'Use the Register employee button to add your first team member.'}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[46rem] table-fixed border-collapse">
                  <thead>
                    <tr className={`border-b ${t.sidebarDivider}`}>
                      <th className={th}>Employee</th>
                      <th className={`w-56 ${th}`}>Contact</th>
                      <th className={`w-28 ${th}`}>Joined</th>
                      <th className={`w-28 ${th}`}>Status</th>
                      <th className={`w-36 ${th} text-right`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {team.map((u, i) => (
                        <motion.tr
                          key={u.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: Math.min(i, 10) * 0.03, duration: 0.25 }}
                          className={`border-b transition-colors last:border-b-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] ${t.sidebarDivider} ${u.status === 'suspended' ? 'opacity-55' : ''}`}
                        >
                          <td className="max-w-0 px-3 py-3 align-middle">
                            <Person t={t} user={u} sub={u.id === me.id ? `${u.code} · ${u.role_label} · you` : undefined} />
                          </td>
                          <td className={`px-3 py-3 align-middle text-xs ${t.muted}`}>
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <span className="inline-flex min-w-0 items-center gap-1.5"><Mail className="size-3.5 shrink-0" /><span className="truncate">{u.email}</span></span>
                              <span className="inline-flex items-center gap-1.5"><Phone className="size-3.5 shrink-0" />{u.phone}</span>
                            </div>
                          </td>
                          <td className={`whitespace-nowrap px-3 py-3 align-middle text-xs ${t.muted}`}>{formatDate(u.created_at)}</td>
                          <td className="px-3 py-3 align-middle"><Pill tone={STATUS_TONE[u.status]}>{u.status_label}</Pill></td>
                          <td className="px-3 py-3 align-middle">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button" aria-label={`Assign a task to ${u.full_name}`} title="Assign a task"
                                onClick={() => setAssign({ employee: u })}
                                className={`grid size-8 place-items-center ${t.radius} ${t.muted} hover:text-sky-500`}
                              >
                                <ListChecks className="size-4" />
                              </button>
                              <button
                                type="button" aria-label={`Edit ${u.full_name}`} title="Edit"
                                onClick={() => setEditing(u)}
                                className={`grid size-8 place-items-center ${t.radius} ${t.muted} hover:text-sky-500`}
                              >
                                <Pencil className="size-4" />
                              </button>
                              {manageable(u) && (
                                <>
                                  <button
                                    type="button"
                                    aria-label={`${u.status === 'active' ? 'Suspend' : 'Activate'} ${u.full_name}`}
                                    title={u.status === 'active' ? 'Suspend' : 'Activate'}
                                    disabled={busy === u.id}
                                    onClick={() => void toggle(u)}
                                    className={`grid size-8 place-items-center ${t.radius} ${t.muted} disabled:opacity-40 ${u.status === 'active' ? 'hover:text-rose-500' : 'hover:text-emerald-500'}`}
                                  >
                                    {busy === u.id ? <Loader2 className="size-4 animate-spin" /> : u.status === 'active' ? <Ban className="size-4" /> : <CircleCheck className="size-4" />}
                                  </button>
                                  <button
                                    type="button" aria-label={`Delete ${u.full_name}`} title="Delete"
                                    onClick={() => setDeleting(u)}
                                    className={`grid size-8 place-items-center ${t.radius} ${t.muted} hover:text-rose-500`}
                                  >
                                    <Trash2 className="size-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}

      <MemberEditor
        t={t}
        employee={editing}
        onClose={() => setEditing(null)}
        onSaved={(next) => {
          setData((list) => list?.map((x) => (x.id === next.id ? next : x)) ?? null)
          setEditing(null)
          setFlash({ text: `${next.full_name}'s details were saved.`, bad: false })
        }}
      />
      <RegisterMember
        t={t}
        open={view === 'register'}
        onClose={() => navigate(listPath)}
        onSaved={(u) => {
          setData((list) => [...(list ?? []), u].sort((a, b) => a.full_name.localeCompare(b.full_name)))
          navigate(listPath)
          setFlash({ text: `${u.full_name} is registered and can sign in with code ${u.code}.`, bad: false })
        }}
      />
      <AssignTaskDialog
        t={t}
        state={assign}
        types={typeApi.data ?? []}
        team={data ?? []}
        onClose={() => setAssign(null)}
        onSaved={(a, created) => {
          const visible = (!taskQuery.date || taskQuery.date === a.date) && (!taskQuery.status || taskQuery.status === a.status)
          taskApi.setData((l) => (created ? (visible ? [a, ...(l ?? [])] : l) : l?.map((x) => (x.id === a.id ? a : x)) ?? null))
          typeApi.reload()
          setAssign(null)
          setTaskFlash({ text: created ? `${a.task_type.name} was assigned to ${a.employee.full_name}.` : 'The task was updated.', bad: false })
        }}
      />
      <ConfirmDelete
        t={t}
        employee={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={(u) => {
          setData((list) => list?.filter((x) => x.id !== u.id) ?? null)
          setFlash({ text: `${u.full_name} was removed from the system.`, bad: false })
        }}
      />
    </div>
  )
}

/** Slide-over editor for a team member — names, contact, sign-in code, role, status, password, photo. */
function MemberEditor({ employee, ...rest }: { t: WorkspaceTheme; employee: Employee | null; onClose: () => void; onSaved: (u: Employee) => void }) {
  return (
    <AnimatePresence>
      {employee && <EditorPanel key={employee.id} employee={employee} {...rest} />}
    </AnimatePresence>
  )
}

function EditorPanel({ t, employee: u, onClose, onSaved }: { t: WorkspaceTheme; employee: Employee; onClose: () => void; onSaved: (u: Employee) => void }) {
  const [form, setForm] = useState(() => Object.fromEntries(EDIT_FIELDS.map((f) => [f, u[f]])) as Record<(typeof EDIT_FIELDS)[number], string>)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [photo, setPhoto] = useState<File | null | undefined>(undefined)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  /** HR keeps control of a branch manager's role and status — even the manager's own. */
  const roleLocked = u.role === 'branch_manager'
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : photo === null ? null : u.photo), [photo, u.photo])
  const initials = `${form.first_name[0] ?? ''}${form.last_name[0] ?? ''}`.toUpperCase()

  useEffect(() => {
    if (!photo || !preview) return
    return () => URL.revokeObjectURL(preview)
  }, [photo, preview])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

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
    if (password && password !== confirm) return setErrors({ confirm_password: 'Passwords do not match.' })
    const changes: EmployeeEdit = {}
    for (const f of EDIT_FIELDS) if (form[f] !== u[f]) Object.assign(changes, { [f]: form[f].trim() })
    if (password) changes.new_password = password
    if (!Object.keys(changes).length && photo === undefined) return onClose()
    setSaving(true)
    setErrors({})
    setMessage('')
    try {
      onSaved(await hr.updateMember(u.id, changes, photo))
    } catch (err) {
      const { message, fields } = parseApiError(err)
      setErrors(fields)
      setMessage(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div className="fixed inset-0 z-[60] flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
      <motion.form
        onSubmit={save}
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${u.full_name}`}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        className={`relative flex h-full w-full max-w-lg flex-col shadow-2xl ${t.root}`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-900/10 px-5 py-4 dark:border-white/10">
          <div className="min-w-0">
            <h3 className={`truncate text-base ${t.heading}`}>Edit {u.full_name}</h3>
            <p className={`text-xs ${t.muted}`}>Joined {new Date(u.created_at).toLocaleDateString()} · {u.status_label}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`grid size-9 place-items-center ${t.radius} ${t.iconButton}`}>
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section className="flex items-center gap-4">
            <span className={`relative grid size-20 shrink-0 place-items-center overflow-hidden ring-2 ${t.radius} ${t.ring}`}>
              {preview ? (
                <img src={preview} alt="" className="size-full object-cover" />
              ) : (
                <span className="grid size-full place-items-center bg-gradient-to-br from-slate-400 to-slate-600 text-lg font-semibold text-white">{initials}</span>
              )}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button t={t} variant="ghost" onClick={() => fileRef.current?.click()}>Add / change picture</Button>
              {preview && <Button t={t} variant="danger" onClick={() => setPhoto(null)}>Remove</Button>}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = '' }} />
              {errors.photo && <p className="w-full text-[11px] text-rose-500">{errors.photo}</p>}
            </div>
          </section>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>Personal details</legend>
            <Input t={t} label="First name" value={form.first_name} onChange={set('first_name')} error={errors.first_name} required />
            <Input t={t} label="Last name" value={form.last_name} onChange={set('last_name')} error={errors.last_name} required />
            <Input t={t} label="Personal email" type="email" value={form.email} onChange={set('email')} error={errors.email} required />
            <Input t={t} label="Phone number" type="tel" value={form.phone} onChange={set('phone')} error={errors.phone} required />
          </fieldset>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>Work access</legend>
            <Input
              t={t} label="6-digit sign-in code" inputMode="numeric" maxLength={6} pattern="\d{6}" value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.replace(/\D/g, '').slice(0, 6) }))} error={errors.code} required
            />
            <Select t={t} label="Role" value={form.role} onChange={set('role')} error={errors.role} disabled={roleLocked}>
              {roleLocked && <option value="branch_manager">{ROLE_LABELS.branch_manager}</option>}
              {TEAM_ROLES.map((v) => <option key={v} value={v}>{ROLE_LABELS[v]}</option>)}
            </Select>
            <Select t={t} label="Status" value={form.status} onChange={set('status')} error={errors.status} disabled={roleLocked}>
              {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
            {roleLocked && <p className={`self-end pb-2 text-[11px] ${t.muted}`}>Only HR can change a branch manager's role or status.</p>}
          </fieldset>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>Reset password</legend>
            <Input t={t} label="New password" type={showPw ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.new_password} placeholder="Leave blank to keep" />
            <Input t={t} label="Confirm new password" type={showPw ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm_password} />
            <button type="button" onClick={() => setShowPw((s) => !s)} className={`inline-flex items-center gap-1.5 text-xs sm:col-span-2 ${t.muted}`}>
              {showPw ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}{showPw ? 'Hide passwords' : 'Show passwords'}
            </button>
            <p className={`text-[11px] sm:col-span-2 ${t.muted}`}>A 6-digit number (not the same as the sign-in code) or 8+ characters.</p>
          </fieldset>
        </div>

        <footer className="space-y-3 border-t border-slate-900/10 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/10">
          <Flash message={message} tone="red" />
          <div className="flex justify-end gap-2">
            <Button t={t} variant="ghost" onClick={onClose}>Cancel</Button>
            <Button t={t} type="submit" busy={saving}>Save changes</Button>
          </div>
        </footer>
      </motion.form>
    </motion.div>
  )
}

/** Register a staff member directly at the manager's branch — they can sign in right away. */
function RegisterMember({ open, ...rest }: { t: WorkspaceTheme; open: boolean; onClose: () => void; onSaved: (u: Employee) => void }) {
  return (
    <AnimatePresence>
      {open && <RegisterDialog {...rest} />}
    </AnimatePresence>
  )
}

function RegisterDialog({ t, onClose, onSaved }: { t: WorkspaceTheme; onClose: () => void; onSaved: (u: Employee) => void }) {
  const [form, setForm] = useState<MemberSignup>(blankSignup)
  const [photo, setPhoto] = useState<File | null>(null)
  const [showPw, setShowPw] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo])

  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = (k: keyof MemberSignup) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

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

  function validate(): FieldErrors {
    const errs: FieldErrors = {}
    if (!form.first_name.trim()) errs.first_name = 'Required'
    if (!form.last_name.trim()) errs.last_name = 'Required'
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errs.email = 'Enter a valid email address.'
    if (!/^\+?[\d\s-]{9,20}$/.test(form.phone.trim())) errs.phone = 'Enter a valid phone number.'
    if (!/^\d{6}$/.test(form.code)) errs.code = 'Choose a 6-digit code — the employee uses it to sign in.'
    if (isPin(form.password)) {
      if (form.password === form.code) errs.password = "The 6-digit password can't be the same as the sign-in code."
    } else if (form.password.length < 8) errs.password = 'Use a 6-digit number or at least 8 characters.'
    if (form.confirm_password !== form.password) errs.confirm_password = 'Passwords do not match.'
    return errs
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    setMessage('')
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      onSaved(await hr.registerMember({ ...form, email: form.email.trim(), phone: form.phone.trim() }, photo))
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
        aria-label="Register employee"
        noValidate
        initial={{ scale: 0.94, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className={`relative my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden shadow-2xl ${t.radius} ${t.root}`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-900/10 px-5 py-4 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid size-10 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
              <UserCheck className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className={`truncate text-base ${t.heading}`}>Register employee</h3>
              <p className={`text-xs ${t.muted}`}>They join your branch and can sign in right away.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`grid size-9 shrink-0 place-items-center ${t.radius} ${t.iconButton}`}>
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section className="flex items-center gap-4">
            <span className={`relative grid size-20 shrink-0 place-items-center overflow-hidden ring-2 ${t.radius} ${t.ring}`}>
              {preview ? (
                <img src={preview} alt="" className="size-full object-cover" />
              ) : (
                <span className="grid size-full place-items-center bg-gradient-to-br from-slate-400 to-slate-600 text-lg font-semibold text-white">
                  {`${form.first_name[0] ?? ''}${form.last_name[0] ?? ''}`.toUpperCase() || '?'}
                </span>
              )}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button t={t} variant="ghost" onClick={() => fileRef.current?.click()}>{preview ? 'Change picture' : 'Add picture'}</Button>
              {preview && <Button t={t} variant="danger" onClick={() => setPhoto(null)}>Remove</Button>}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = '' }} />
              {errors.photo && <p className="w-full text-[11px] text-rose-500">{errors.photo}</p>}
            </div>
          </section>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>Personal details</legend>
            <Input t={t} label="First name" autoComplete="off" value={form.first_name} onChange={set('first_name')} error={errors.first_name} required />
            <Input t={t} label="Last name" autoComplete="off" value={form.last_name} onChange={set('last_name')} error={errors.last_name} required />
            <Input t={t} label="Personal email" type="email" autoComplete="off" value={form.email} onChange={set('email')} error={errors.email} required />
            <Input t={t} label="Phone number" type="tel" autoComplete="off" value={form.phone} onChange={set('phone')} error={errors.phone} required />
          </fieldset>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>Work access</legend>
            <Input
              t={t} label="6-digit sign-in code" inputMode="numeric" maxLength={6} pattern="\d{6}" value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.replace(/\D/g, '').slice(0, 6) }))} error={errors.code} required
            />
            <Select t={t} label="Role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))} error={errors.role}>
              {TEAM_ROLES.map((v) => <option key={v} value={v}>{ROLE_LABELS[v]}</option>)}
            </Select>
          </fieldset>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>Password</legend>
            <Input t={t} label="Password" type={showPw ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} required />
            <Input t={t} label="Confirm password" type={showPw ? 'text' : 'password'} autoComplete="new-password" value={form.confirm_password} onChange={set('confirm_password')} error={errors.confirm_password} required />
            <button type="button" onClick={() => setShowPw((s) => !s)} className={`inline-flex items-center gap-1.5 text-xs sm:col-span-2 ${t.muted}`}>
              {showPw ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}{showPw ? 'Hide passwords' : 'Show passwords'}
            </button>
            <p className={`text-[11px] sm:col-span-2 ${t.muted}`}>A 6-digit number (not the same as the sign-in code) or 8+ characters.</p>
          </fieldset>
        </div>

        <footer className="space-y-3 border-t border-slate-900/10 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/10">
          <Flash message={message} tone="red" />
          <div className="flex justify-end gap-2">
            <Button t={t} variant="ghost" onClick={onClose}>Cancel</Button>
            <Button t={t} type="submit" busy={saving}>Register employee</Button>
          </div>
        </footer>
      </motion.form>
    </motion.div>
  )
}

function ConfirmDelete({ t, employee, onClose, onDeleted }: { t: WorkspaceTheme; employee: Employee | null; onClose: () => void; onDeleted: (u: Employee) => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function remove() {
    if (!employee) return
    setBusy(true)
    setErr('')
    try {
      await hr.deleteMember(employee.id)
      onDeleted(employee)
      onClose()
    } catch (e) {
      setErr(parseApiError(e).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      {employee && (
        <motion.div
          key={employee.id}
          className="fixed inset-0 z-[60] grid place-items-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
          <motion.div
            role="alertdialog" aria-modal="true" aria-label={`Delete ${employee.full_name}`}
            initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            className={`relative w-full max-w-sm p-5 shadow-2xl ${t.radius} ${t.root}`}
          >
            <span className={`grid size-10 place-items-center ${t.radius} bg-rose-500/10 text-rose-500`}>
              <Trash2 className="size-5" />
            </span>
            <h3 className={`mt-3 text-base ${t.heading}`}>Delete {employee.full_name}?</h3>
            <p className={`mt-1 text-xs ${t.muted}`}>
              This permanently removes their account, photo and attendance history. If they may come back, suspend them instead.
            </p>
            <div className="mt-3"><Flash message={err} tone="red" /></div>
            <div className="mt-4 flex justify-end gap-2">
              <Button t={t} variant="ghost" onClick={onClose}>Cancel</Button>
              <Button t={t} variant="danger" busy={busy} onClick={() => void remove()}>Delete employee</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
