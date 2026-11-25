import { AnimatePresence, motion } from 'framer-motion'
import { Ban, Building2, CircleCheck, ImagePlus, Loader2, Package, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Empty, ErrorNote, Flash, Input, Loading, PageHeader, Panel, Pill, Select, Stat, Textarea, type Tone } from '../components/hr/ui'
import { parseApiError, type Employee, type FieldErrors } from '../lib/api'
import { bnb, PACKAGE_CATEGORIES, type ExtraPackage, type PackageCategory, type PackageEdit, type PackageStatus } from '../lib/bnb'
import { formatMoney, useApi } from '../lib/hr'
import { shrinkPhoto } from '../lib/image'
import type { NavItem, WorkspaceTheme } from '../lib/workspaces'

const PKG_TONE: Record<PackageStatus, Tone> = { active: 'green', suspended: 'red' }
const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const blank = { category: 'other' as PackageCategory, name: '', amount: '', description: '' }

export default function ExtraPackagesPage({ item, t, me, view = 'list' }: { item: NavItem; t: WorkspaceTheme; me: Employee; view?: 'list' | 'register' }) {
  const { data, error, loading, reload, setData } = useApi(bnb.packages)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<ExtraPackage | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<ExtraPackage | null>(null)
  const [suspending, setSuspending] = useState<ExtraPackage | null>(null)
  const [busy, setBusy] = useState(0)
  const [flash, setFlash] = useState({ text: '', bad: false })
  const navigate = useNavigate()
  const { pathname } = useLocation()

  /** Register is a dialog over this list — the /register URL opens it, closing returns here. */
  const listPath = pathname.replace(/\/register$/, '')
  const editingPkg = view === 'register' ? null : editing

  const packages = useMemo(
    () => (data ?? []).filter((p) => !q || `${p.name} ${p.category_label}`.toLowerCase().includes(q.toLowerCase())),
    [data, q],
  )
  const active = data?.filter((p) => p.status === 'active').length ?? 0
  const suspended = data?.filter((p) => p.status === 'suspended').length ?? 0

  async function toggleStatus(p: ExtraPackage) {
    if (p.status !== 'suspended') return setSuspending(p)
    setBusy(p.id)
    setFlash({ text: '', bad: false })
    try {
      const next = await bnb.updatePackage(p.id, { status: 'active' })
      setData((l) => l?.map((x) => (x.id === p.id ? next : x)) ?? null)
      setFlash({ text: `${next.name} is now active.`, bad: false })
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
          me.branch ? (
            <Button t={t} onClick={() => { setEditing(null); navigate(`${listPath}/register`) }}>
              <Plus className="size-3.5" /> Register package
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
            text="Your account isn't assigned to a BnB branch, so there are no packages to manage. Ask your manager or IT support to allocate you from HR → Branch allocation."
          />
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
            <Stat t={t} i={0} icon={Package} label="Packages" value={data?.length ?? '—'} />
            <Stat t={t} i={1} icon={CircleCheck} label="Active" value={data ? active : '—'} />
            <Stat t={t} i={2} icon={Ban} label="Suspended" value={data ? suspended : '—'} />
          </div>

          <Panel t={t} title={`Packages at ${me.branch_name ?? 'your branch'}`}>
            <div className="relative mb-4 sm:max-w-xs">
              <Search className={`pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 ${t.muted}`} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name or category"
                className={`h-10 w-full bg-transparent pl-9 pr-3 text-sm outline-none focus:ring-2 ${t.radius} ${t.chip} ${t.ring}`}
              />
            </div>
            <div className="mb-3"><Flash message={flash.text} tone={flash.bad ? 'red' : 'green'} /></div>
            {error ? (
              <ErrorNote t={t} message={error} onRetry={reload} />
            ) : loading && !data ? (
              <Loading t={t} />
            ) : !packages.length ? (
              <Empty
                t={t}
                icon={Package}
                title={data?.length ? 'No packages match your search' : 'No packages registered yet'}
                text={data?.length ? 'Try a different search.' : 'Use the Register package button to add your first package.'}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence initial={false}>
                  {packages.map((p, i) => (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ delay: Math.min(i, 10) * 0.03, duration: 0.25 }}
                    >
                      <article className={`flex h-full flex-col overflow-hidden transition-all duration-300 ${t.radius} ${t.card} ${t.cardHover} ${p.status === 'suspended' ? 'opacity-60' : ''}`}>
                        <div className={`relative h-36 overflow-hidden ${t.iconBox}`}>
                          {p.image ? (
                            <img src={p.image} alt={p.name} className="size-full object-cover" />
                          ) : (
                            <span className="grid size-full place-items-center"><Package className="size-10 opacity-50" /></span>
                          )}
                          <span className="absolute left-3 top-3"><Pill tone={PKG_TONE[p.status]}>{p.status_label}</Pill></span>
                          <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
                            {formatMoney(p.amount)}
                          </span>
                        </div>
                        <div className="flex flex-1 flex-col gap-2 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-semibold">{p.name}</p>
                            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${t.chip}`}>{p.category_label}</span>
                          </div>
                          <p className={`line-clamp-2 min-h-8 flex-1 text-xs ${t.muted}`}>{p.description || 'No description.'}</p>
                          <div className={`flex items-center justify-end gap-1 border-t pt-2 ${t.sidebarDivider}`}>
                            <button
                              type="button" aria-label={`Edit ${p.name}`} title="Edit"
                              onClick={() => { setEditing(p); setFormOpen(true) }}
                              className={`grid size-8 place-items-center ${t.radius} ${t.muted} hover:text-sky-500`}
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={`${p.status === 'suspended' ? 'Activate' : 'Suspend'} ${p.name}`}
                              title={p.status === 'suspended' ? 'Activate' : 'Suspend'}
                              disabled={busy === p.id} onClick={() => void toggleStatus(p)}
                              className={`grid size-8 place-items-center ${t.radius} ${t.muted} disabled:opacity-40 ${p.status === 'suspended' ? 'hover:text-emerald-500' : 'hover:text-amber-500'}`}
                            >
                              {busy === p.id ? <Loader2 className="size-4 animate-spin" /> : p.status === 'suspended' ? <CircleCheck className="size-4" /> : <Ban className="size-4" />}
                            </button>
                            <button
                              type="button" aria-label={`Delete ${p.name}`} title="Delete"
                              onClick={() => setDeleting(p)}
                              className={`grid size-8 place-items-center ${t.radius} ${t.muted} hover:text-rose-500`}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </div>
                      </article>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </Panel>
        </>
      )}

      <PackageForm
        t={t}
        open={formOpen || view === 'register'}
        editing={editingPkg}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
          if (view === 'register') navigate(listPath)
        }}
        onSaved={(p) => {
          setData((l) => (editingPkg ? (l?.map((x) => (x.id === p.id ? p : x)) ?? null) : [...(l ?? []), p].sort((a, b) => a.name.localeCompare(b.name))))
          setFormOpen(false)
          setEditing(null)
          if (view === 'register') navigate(listPath)
          setFlash({ text: editingPkg ? `${p.name} was updated.` : `${p.name} was registered.`, bad: false })
        }}
      />
      <ConfirmDelete t={t} pkg={deleting} onClose={() => setDeleting(null)} onDeleted={(id) => setData((l) => l?.filter((x) => x.id !== id) ?? null)} />
      <ConfirmSuspend
        t={t}
        pkg={suspending}
        onClose={() => setSuspending(null)}
        onSaved={(p) => {
          setData((l) => l?.map((x) => (x.id === p.id ? p : x)) ?? null)
          setFlash({ text: `${p.name} was suspended.`, bad: false })
        }}
      />
    </div>
  )
}

function PackageForm({ t, open, editing, onClose, onSaved }: {
  t: WorkspaceTheme
  open: boolean
  editing: ExtraPackage | null
  onClose: () => void
  onSaved: (p: ExtraPackage) => void
}) {
  return (
    <AnimatePresence>
      {open && <PackageFormDialog key={editing?.id ?? 'new'} t={t} editing={editing} onClose={onClose} onSaved={onSaved} />}
    </AnimatePresence>
  )
}

function PackageFormDialog({ t, editing, onClose, onSaved }: { t: WorkspaceTheme; editing: ExtraPackage | null; onClose: () => void; onSaved: (p: ExtraPackage) => void }) {
  const [form, setForm] = useState(() =>
    editing
      ? { category: editing.category, name: editing.name, amount: editing.amount, description: editing.description, status: editing.status }
      : { ...blank, status: 'active' as PackageStatus },
  )
  const [file, setFile] = useState<File | null>(null)
  const [imageRemoved, setImageRemoved] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const shown = preview ?? (imageRemoved ? null : editing?.image ?? null)

  async function pick(f: File | undefined) {
    if (!f) return
    if (!IMG_TYPES.includes(f.type)) return setErrors((e) => ({ ...e, image: 'Use a JPG, PNG or WebP picture.' }))
    try {
      setFile(await shrinkPhoto(f))
      setImageRemoved(false)
      setErrors((e) => ({ ...e, image: '' }))
    } catch {
      setErrors((e) => ({ ...e, image: "This picture couldn't be read. Try another one." }))
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    setMessage('')
    try {
      if (editing) {
        const changes: PackageEdit = {}
        if (form.category !== editing.category) changes.category = form.category
        if (form.name !== editing.name) changes.name = form.name
        if (Number(form.amount) !== Number(editing.amount)) changes.amount = form.amount
        if (form.description !== editing.description) changes.description = form.description
        if (form.status !== editing.status) changes.status = form.status
        // `file` replaces the picture, `imageRemoved` clears it — undefined keeps it.
        const image = file ?? (imageRemoved ? null : undefined)
        if (!Object.keys(changes).length && image === undefined) return onClose()
        onSaved(await bnb.updatePackage(editing.id, changes, image))
      } else {
        onSaved(await bnb.registerPackage(
          { category: form.category, name: form.name, amount: form.amount, description: form.description },
          file,
        ))
      }
    } catch (err) {
      const { message, fields } = parseApiError(err)
      setErrors(fields)
      setMessage(message)
    } finally {
      setSaving(false)
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
        onSubmit={save}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? 'Edit package' : 'Register package'}
        initial={{ scale: 0.94, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className={`relative my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden shadow-2xl ${t.radius} ${t.root}`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-900/10 px-5 py-4 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid size-10 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
              <Package className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className={`truncate text-base ${t.heading}`}>{editing ? `Edit ${editing.name}` : 'Register package'}</h3>
              <p className={`text-xs ${t.muted}`}>{editing ? 'Update the package details, price or status.' : 'Add an extra package guests can buy on top of their stay.'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`grid size-9 shrink-0 place-items-center ${t.radius} ${t.iconButton}`}>
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section>
            <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>Package image</legend>
            <div className="flex items-center gap-3">
              <div className={`relative size-20 shrink-0 overflow-hidden ${t.radius} ${t.iconBox}`}>
                {shown ? <img src={shown} alt="" className="size-full object-cover" /> : <span className="grid size-full place-items-center"><ImagePlus className="size-6 opacity-50" /></span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-2">
                  <Button t={t} type="button" variant="ghost" onClick={() => fileRef.current?.click()}>
                    <ImagePlus className="size-3.5" /> {shown ? 'Change image' : 'Upload image'}
                  </Button>
                  {shown && (
                    <Button
                      t={t} type="button" variant="ghost"
                      onClick={() => { setFile(null); setImageRemoved(true) }}
                    >
                      <Trash2 className="size-3.5" /> Remove
                    </Button>
                  )}
                </div>
                <p className={`text-[11px] ${t.muted}`}>JPG, PNG or WebP — shown on the package card.</p>
              </div>
            </div>
            <input ref={fileRef} type="file" accept={IMG_TYPES.join(',')} hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
            {errors.image && <p className="mt-1.5 text-[11px] text-rose-500">{errors.image}</p>}
          </section>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>Package details</legend>
            <Select t={t} label="Category" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as PackageCategory }))} error={errors.category}>
              {PACKAGE_CATEGORIES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Input t={t} label="Package name" placeholder="e.g. Airport pickup" value={form.name} onChange={set('name')} error={errors.name} required maxLength={120} />
            <Input t={t} label="Amount (KES)" type="number" inputMode="decimal" min={0} step="0.01" placeholder="e.g. 2500" value={form.amount} onChange={set('amount')} error={errors.amount} required />
            <div className="sm:col-span-2">
              <Textarea
                t={t} label="Description (optional)" rows={3} placeholder="What's included, how it works, when it's available…"
                value={form.description} onChange={set('description')} error={errors.description}
              />
            </div>
          </fieldset>

          {editing && (
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>Package status</legend>
              <Select t={t} label="Status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as PackageStatus }))} error={errors.status}>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </Select>
            </fieldset>
          )}
        </div>

        <footer className="space-y-3 border-t border-slate-900/10 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/10">
          <Flash message={message} tone="red" />
          <div className="flex justify-end gap-2">
            <Button t={t} variant="ghost" onClick={onClose}>Cancel</Button>
            <Button t={t} type="submit" busy={saving}>{editing ? 'Save changes' : 'Register package'}</Button>
          </div>
        </footer>
      </motion.form>
    </motion.div>
  )
}

function ConfirmSuspend(props: { t: WorkspaceTheme; pkg: ExtraPackage | null; onClose: () => void; onSaved: (p: ExtraPackage) => void }) {
  return (
    <AnimatePresence>
      {props.pkg && <SuspendDialog key={props.pkg.id} {...props} pkg={props.pkg} />}
    </AnimatePresence>
  )
}

function SuspendDialog({ t, pkg, onClose, onSaved }: { t: WorkspaceTheme; pkg: ExtraPackage; onClose: () => void; onSaved: (p: ExtraPackage) => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function suspend() {
    setBusy(true)
    setErr('')
    try {
      onSaved(await bnb.updatePackage(pkg.id, { status: 'suspended' }))
      onClose()
    } catch (e) {
      setErr(parseApiError(e).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[60] grid place-items-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
      <motion.div
        role="alertdialog" aria-modal="true" aria-label={`Suspend ${pkg.name}`}
        initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className={`relative w-full max-w-sm p-5 shadow-2xl ${t.radius} ${t.root}`}
      >
        <span className={`grid size-10 place-items-center ${t.radius} bg-amber-500/10 text-amber-500`}>
          <Ban className="size-5" />
        </span>
        <h3 className={`mt-3 text-base ${t.heading}`}>Suspend {pkg.name}?</h3>
        <p className={`mt-1 text-xs ${t.muted}`}>
          A suspended package stays on record but can't be offered to guests until it's activated again.
        </p>
        <div className="mt-3"><Flash message={err} tone="red" /></div>
        <div className="mt-4 flex justify-end gap-2">
          <Button t={t} variant="ghost" onClick={onClose}>Cancel</Button>
          <Button t={t} variant="danger" busy={busy} onClick={() => void suspend()}>Suspend package</Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function ConfirmDelete({ t, pkg, onClose, onDeleted }: { t: WorkspaceTheme; pkg: ExtraPackage | null; onClose: () => void; onDeleted: (id: number) => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function remove() {
    if (!pkg) return
    setBusy(true)
    setErr('')
    try {
      await bnb.deletePackage(pkg.id)
      onDeleted(pkg.id)
      onClose()
    } catch (e) {
      setErr(parseApiError(e).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      {pkg && (
        <motion.div
          key={pkg.id}
          className="fixed inset-0 z-[60] grid place-items-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
          <motion.div
            role="alertdialog" aria-modal="true" aria-label={`Delete ${pkg.name}`}
            initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            className={`relative w-full max-w-sm p-5 shadow-2xl ${t.radius} ${t.root}`}
          >
            <span className={`grid size-10 place-items-center ${t.radius} bg-rose-500/10 text-rose-500`}>
              <Trash2 className="size-5" />
            </span>
            <h3 className={`mt-3 text-base ${t.heading}`}>Delete {pkg.name}?</h3>
            <p className={`mt-1 text-xs ${t.muted}`}>
              This permanently removes the package and its image. If you may offer it again later, suspend it instead.
            </p>
            <div className="mt-3"><Flash message={err} tone="red" /></div>
            <div className="mt-4 flex justify-end gap-2">
              <Button t={t} variant="ghost" onClick={onClose}>Cancel</Button>
              <Button t={t} variant="danger" busy={busy} onClick={() => void remove()}>Delete package</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
