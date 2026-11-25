import { AnimatePresence, motion } from 'framer-motion'
import {
  Ban, CalendarCheck, CircleCheck, ClipboardList, ListChecks, Loader2, Pencil,
  Play, Plus, Trash2, X,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Button, Empty, ErrorNote, Flash, Input, Loading, Panel, Person, Pill, Row, Select } from '../components/hr/ui'
import { parseApiError, type Employee, type FieldErrors } from '../lib/api'
import { formatDate, formatTime, hr, STATUS_TONE, todayISO, useApi, type TaskAssignment, type TaskStatus, type TaskStatusAction, type TaskType } from '../lib/hr'
import type { WorkspaceTheme } from '../lib/workspaces'

type Api<T> = ReturnType<typeof useApi<T>>

export interface AssignState {
  /** Set when editing an existing assignment. */
  task?: TaskAssignment
  /** Pre-picked employee — e.g. the assign button on a staff row. */
  employee?: Employee
}

export interface TaskQuery {
  date: string
  status: string
}

const TASK_STATUSES: [TaskStatus, string][] = [
  ['pending', 'Pending'],
  ['in_progress', 'In progress'],
  ['done', 'Done'],
  ['cancelled', 'Cancelled'],
]

/** The task-type register and the assignments board, shown under the staff table. */
export function TasksPanel({ t, types, tasks, query, onQuery, onAssign, flash, onFlash }: {
  t: WorkspaceTheme
  types: Api<TaskType[]>
  tasks: Api<TaskAssignment[]>
  query: TaskQuery
  onQuery: (q: TaskQuery) => void
  onAssign: (s: AssignState) => void
  flash: { text: string; bad: boolean }
  onFlash: (text: string, bad?: boolean) => void
}) {
  const [typeEdit, setTypeEdit] = useState<TaskType | 'new' | null>(null)
  const [busy, setBusy] = useState(0)

  async function transition(a: TaskAssignment, action: TaskStatusAction) {
    setBusy(a.id)
    onFlash('')
    try {
      const next = await hr.setTaskStatus(a.id, action)
      tasks.setData((l) => l?.map((x) => (x.id === a.id ? next : x)) ?? null)
      types.reload()
      onFlash(`${a.task_type.name} for ${a.employee.full_name} is now ${next.status_label.toLowerCase()}.`)
    } catch (e) {
      onFlash(parseApiError(e).message, true)
    } finally {
      setBusy(0)
    }
  }

  async function removeTask(a: TaskAssignment) {
    setBusy(a.id)
    onFlash('')
    try {
      await hr.deleteTask(a.id)
      tasks.setData((l) => l?.filter((x) => x.id !== a.id) ?? null)
      types.reload()
      onFlash(`The ${a.task_type.name.toLowerCase()} task for ${a.employee.full_name} was removed.`)
    } catch (e) {
      onFlash(parseApiError(e).message, true)
    } finally {
      setBusy(0)
    }
  }

  async function removeType(tt: TaskType) {
    setBusy(tt.id)
    onFlash('')
    try {
      await hr.deleteTaskType(tt.id)
      types.setData((l) => l?.filter((x) => x.id !== tt.id) ?? null)
      onFlash(`Task type "${tt.name}" was removed.`)
    } catch (e) {
      onFlash(parseApiError(e).message, true)
    } finally {
      setBusy(0)
    }
  }

  const iconBtn = `${t.radius} grid size-8 place-items-center ${t.muted} disabled:opacity-40`

  return (
    <>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel
          t={t}
          title="Task assignments"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-36">
                <Input t={t} type="date" aria-label="Day" value={query.date} onChange={(e) => onQuery({ ...query, date: e.target.value })} />
              </div>
              <div className="w-32">
                <Select t={t} value={query.status} onChange={(e) => onQuery({ ...query, status: e.target.value })} aria-label="Status">
                  <option value="">All statuses</option>
                  {TASK_STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </div>
              <Button t={t} variant="ghost" onClick={() => onQuery({ ...query, date: query.date ? '' : todayISO() })}>
                {query.date ? 'All dates' : 'Today'}
              </Button>
              <Button t={t} onClick={() => onAssign({})}>
                <Plus className="size-3.5" /> Assign task
              </Button>
            </div>
          }
        >
          <div className="mb-3"><Flash message={flash.text} tone={flash.bad ? 'red' : 'green'} /></div>
          {tasks.error ? (
            <ErrorNote t={t} message={tasks.error} onRetry={tasks.reload} />
          ) : tasks.loading && !tasks.data ? (
            <Loading t={t} />
          ) : !tasks.data?.length ? (
            <Empty
              t={t}
              icon={CalendarCheck}
              title={query.date ? 'Nothing assigned for this day' : 'No tasks assigned yet'}
              text={types.data?.length ? 'Use the Assign task button to hand work to the team.' : 'Register a task type first — the kinds of work your team does.'}
            />
          ) : (
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {tasks.data.map((a, i) => (
                  <Row key={a.id} t={t} i={i}>
                    <div className="min-w-0 flex-1"><Person t={t} user={a.employee} /></div>
                    <div className="min-w-0 sm:w-44">
                      <p className="truncate text-sm font-medium">{a.task_type.name}</p>
                      {a.note && <p className={`truncate text-xs ${t.muted}`}>{a.note}</p>}
                    </div>
                    <div className={`text-xs sm:w-32 ${t.muted}`}>
                      <p>{formatDate(a.date)}</p>
                      {(a.start || a.end) && <p>{formatTime(a.start)} – {formatTime(a.end)}</p>}
                    </div>
                    <div className="flex items-center justify-between gap-2 sm:justify-end">
                      <Pill tone={STATUS_TONE[a.status]}>{a.status_label}</Pill>
                      <div className="flex items-center gap-1">
                        {a.status === 'pending' && (
                          <>
                            <button
                              type="button" aria-label="Start task" title="Start" disabled={busy === a.id}
                              onClick={() => void transition(a, 'start')}
                              className={`${iconBtn} hover:text-sky-500`}
                            >
                              {busy === a.id ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                            </button>
                            <button
                              type="button" aria-label="Edit task" title="Edit"
                              onClick={() => onAssign({ task: a })}
                              className={`${iconBtn} hover:text-sky-500`}
                            >
                              <Pencil className="size-4" />
                            </button>
                          </>
                        )}
                        {a.status === 'in_progress' && (
                          <button
                            type="button" aria-label="Mark task done" title="Mark done" disabled={busy === a.id}
                            onClick={() => void transition(a, 'complete')}
                            className={`${iconBtn} hover:text-emerald-500`}
                          >
                            {busy === a.id ? <Loader2 className="size-4 animate-spin" /> : <CircleCheck className="size-4" />}
                          </button>
                        )}
                        {(a.status === 'pending' || a.status === 'in_progress') && (
                          <button
                            type="button" aria-label="Cancel task" title="Cancel" disabled={busy === a.id}
                            onClick={() => void transition(a, 'cancel')}
                            className={`${iconBtn} hover:text-amber-500`}
                          >
                            <Ban className="size-4" />
                          </button>
                        )}
                        <button
                          type="button" aria-label="Delete task" title="Delete" disabled={busy === a.id}
                          onClick={() => void removeTask(a)}
                          className={`${iconBtn} hover:text-rose-500`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </div>
                  </Row>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </Panel>

        <Panel
          t={t}
          title="Task types"
          className="h-fit"
          actions={
            <Button t={t} variant="ghost" onClick={() => setTypeEdit('new')}>
              <Plus className="size-3.5" /> New type
            </Button>
          }
        >
          {types.error ? (
            <ErrorNote t={t} message={types.error} onRetry={types.reload} />
          ) : types.loading && !types.data ? (
            <Loading t={t} rows={3} />
          ) : !types.data?.length ? (
            <Empty
              t={t}
              icon={ListChecks}
              title="No task types yet"
              text='Register the kinds of work your team does — "Room cleaning", "Pool duty" — then assign them to staff.'
            />
          ) : (
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {types.data.map((tt, i) => (
                  <Row key={tt.id} t={t} i={i}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{tt.name}</p>
                      {tt.description && <p className={`truncate text-xs ${t.muted}`}>{tt.description}</p>}
                    </div>
                    {tt.open_count > 0 && <Pill tone="blue">{tt.open_count} open</Pill>}
                    <div className="flex items-center gap-1 sm:justify-end">
                      <button
                        type="button" aria-label={`Edit ${tt.name}`} title="Edit"
                        onClick={() => setTypeEdit(tt)}
                        className={`${iconBtn} hover:text-sky-500`}
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button" aria-label={`Delete ${tt.name}`} title="Delete" disabled={busy === tt.id}
                        onClick={() => void removeType(tt)}
                        className={`${iconBtn} hover:text-rose-500`}
                      >
                        {busy === tt.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      </button>
                    </div>
                  </Row>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </Panel>
      </div>

      <AnimatePresence>
        {typeEdit && (
          <TaskTypeDialog
            key={typeEdit === 'new' ? 'new' : typeEdit.id}
            t={t}
            type={typeEdit === 'new' ? null : typeEdit}
            onClose={() => setTypeEdit(null)}
            onSaved={(tt, created) => {
              types.setData((l) =>
                (created ? [...(l ?? []), tt] : (l ?? []).map((x) => (x.id === tt.id ? tt : x))).sort((a, b) => a.name.localeCompare(b.name)),
              )
              setTypeEdit(null)
              onFlash(created ? `Task type "${tt.name}" was registered.` : `Task type "${tt.name}" was updated.`)
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}

/** Small dialog to register or rename a task type. */
function TaskTypeDialog({ t, type, onClose, onSaved }: {
  t: WorkspaceTheme
  type: TaskType | null
  onClose: () => void
  onSaved: (tt: TaskType, created: boolean) => void
}) {
  const [name, setName] = useState(type?.name ?? '')
  const [description, setDescription] = useState(type?.description ?? '')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function save(e: FormEvent) {
    e.preventDefault()
    const errs: FieldErrors = {}
    if (!name.trim()) errs.name = 'Required'
    setErrors(errs)
    setMessage('')
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      const data = { name: name.trim(), description: description.trim() }
      onSaved(type ? await hr.updateTaskType(type.id, data) : await hr.addTaskType(data), !type)
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
        aria-label={type ? `Edit ${type.name}` : 'New task type'}
        noValidate
        initial={{ scale: 0.94, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className={`relative w-full max-w-md shadow-2xl ${t.radius} ${t.root}`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-900/10 px-5 py-4 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid size-10 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
              <ListChecks className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className={`truncate text-base ${t.heading}`}>{type ? `Edit ${type.name}` : 'New task type'}</h3>
              <p className={`text-xs ${t.muted}`}>A kind of work you hand out — e.g. "Room cleaning".</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`grid size-9 shrink-0 place-items-center ${t.radius} ${t.iconButton}`}>
            <X className="size-4" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-5">
          <Input t={t} label="Task type name" autoComplete="off" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} required />
          <Input t={t} label="Description (optional)" autoComplete="off" maxLength={255} value={description} onChange={(e) => setDescription(e.target.value)} error={errors.description} placeholder="What this task covers" />
        </div>

        <footer className="space-y-3 border-t border-slate-900/10 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/10">
          <Flash message={message} tone="red" />
          <div className="flex justify-end gap-2">
            <Button t={t} variant="ghost" onClick={onClose}>Cancel</Button>
            <Button t={t} type="submit" busy={saving}>{type ? 'Save changes' : 'Register task type'}</Button>
          </div>
        </footer>
      </motion.form>
    </motion.div>
  )
}

/** Assign a task type to an employee for a shift day — also edits existing assignments. */
export function AssignTaskDialog({ t, state, types, team, onClose, onSaved }: {
  t: WorkspaceTheme
  state: AssignState | null
  types: TaskType[]
  team: Employee[]
  onClose: () => void
  onSaved: (a: TaskAssignment, created: boolean) => void
}) {
  return (
    <AnimatePresence>
      {state && <AssignTaskForm key={state.task?.id ?? state.employee?.id ?? 'new'} t={t} state={state} types={types} team={team} onClose={onClose} onSaved={onSaved} />}
    </AnimatePresence>
  )
}

function AssignTaskForm({ t, state, types, team, onClose, onSaved }: {
  t: WorkspaceTheme
  state: AssignState
  types: TaskType[]
  team: Employee[]
  onClose: () => void
  onSaved: (a: TaskAssignment, created: boolean) => void
}) {
  const editing = state.task
  const [form, setForm] = useState({
    employee_id: editing ? String(editing.employee.id) : state.employee ? String(state.employee.id) : '',
    task_type_id: editing ? String(editing.task_type.id) : '',
    date: editing?.date ?? todayISO(),
    start: editing?.start ?? '',
    end: editing?.end ?? '',
    note: editing?.note ?? '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  /** Active staff can take tasks; keep the current pick listed even if suspended. */
  const pickedId = Number(form.employee_id)
  const picked = team.find((u) => u.id === pickedId)
  const eligible = team.filter((u) => u.status === 'active')
  const employeeOptions = picked && !eligible.includes(picked) ? [picked, ...eligible] : eligible

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save(e: FormEvent) {
    e.preventDefault()
    const errs: FieldErrors = {}
    if (!form.employee_id) errs.employee_id = 'Choose an employee.'
    if (!form.task_type_id) errs.task_type_id = 'Choose a task type.'
    if (!form.date) errs.date = 'Pick the shift day.'
    if (form.start && form.end && form.end < form.start) errs.end = "The end time can't be before the start time."
    setErrors(errs)
    setMessage('')
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      const data = {
        employee_id: pickedId,
        task_type_id: Number(form.task_type_id),
        date: form.date,
        start: form.start || null,
        end: form.end || null,
        note: form.note.trim(),
      }
      onSaved(editing ? await hr.updateTask(editing.id, data) : await hr.addTask(data), !editing)
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
        aria-label={editing ? 'Edit task' : 'Assign a task'}
        noValidate
        initial={{ scale: 0.94, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className={`relative w-full max-w-md shadow-2xl ${t.radius} ${t.root}`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-900/10 px-5 py-4 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid size-10 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
              <ClipboardList className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className={`truncate text-base ${t.heading}`}>{editing ? 'Edit task' : 'Assign a task'}</h3>
              <p className={`text-xs ${t.muted}`}>{editing ? 'Update who does this work and when.' : 'Hand a piece of work to a team member.'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`grid size-9 shrink-0 place-items-center ${t.radius} ${t.iconButton}`}>
            <X className="size-4" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-5">
          <Select t={t} label="Employee" value={form.employee_id} onChange={set('employee_id')} error={errors.employee_id ?? errors.employee} required>
            <option value="">Choose…</option>
            {employeeOptions.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.code})</option>)}
            {editing && !employeeOptions.some((u) => u.id === editing.employee.id) && (
              <option value={editing.employee.id}>{editing.employee.full_name} ({editing.employee.code})</option>
            )}
          </Select>
          <Select t={t} label="Task type" value={form.task_type_id} onChange={set('task_type_id')} error={errors.task_type_id ?? errors.task_type} required>
            <option value="">Choose…</option>
            {types.map((tt) => <option key={tt.id} value={tt.id}>{tt.name}</option>)}
            {editing && !types.some((tt) => tt.id === editing.task_type.id) && (
              <option value={editing.task_type.id}>{editing.task_type.name}</option>
            )}
          </Select>
          {!types.length && <Flash message="Register a task type first — use the New type button on the Task types panel." tone="amber" />}
          <Input t={t} label="Shift day" type="date" value={form.date} onChange={set('date')} error={errors.date} required />
          <div className="grid grid-cols-2 gap-3">
            <Input t={t} label="Start time (optional)" type="time" value={form.start} onChange={set('start')} error={errors.start} />
            <Input t={t} label="End time (optional)" type="time" value={form.end} onChange={set('end')} error={errors.end} />
          </div>
          <Input t={t} label="Note (optional)" autoComplete="off" maxLength={255} value={form.note} onChange={set('note')} error={errors.note} placeholder="Anything they should know" />
        </div>

        <footer className="space-y-3 border-t border-slate-900/10 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/10">
          <Flash message={message} tone="red" />
          <div className="flex justify-end gap-2">
            <Button t={t} variant="ghost" onClick={onClose}>Cancel</Button>
            <Button t={t} type="submit" busy={saving} disabled={!types.length}>{editing ? 'Save changes' : 'Assign task'}</Button>
          </div>
        </footer>
      </motion.form>
    </motion.div>
  )
}
