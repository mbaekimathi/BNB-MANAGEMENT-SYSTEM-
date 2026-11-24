import { AnimatePresence, motion } from 'framer-motion'
import { Ban, BedDouble, Building2, CircleCheck, ImagePlus, Loader2, Pencil, Plus, Search, Star, Trash2, Users, Wrench, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Button, Empty, ErrorNote, Flash, Input, Loading, PageHeader, Panel, Pill, Row, Select, Stat, type Tone } from '../components/hr/ui'
import { parseApiError, type Employee, type FieldErrors } from '../lib/api'
import { bnb, ROOM_TYPES, SUSPEND_REASONS, type Room, type RoomEdit, type RoomPhoto, type RoomStatus, type RoomType } from '../lib/bnb'
import { formatMoney, useApi } from '../lib/hr'
import { shrinkPhoto } from '../lib/image'
import type { NavItem, WorkspaceTheme } from '../lib/workspaces'

const ROOM_TONE: Record<RoomStatus, Tone> = { active: 'green', maintenance: 'amber', suspended: 'red' }
const MAX_PHOTOS = 8

const blank = { name: '', room_type: 'double' as RoomType, capacity: '2', price: '', description: '' }

export default function RoomManagementPage({ item, t, me }: { item: NavItem; t: WorkspaceTheme; me: Employee }) {
  const { data, error, loading, reload, setData } = useApi(bnb.rooms)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Room | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<Room | null>(null)
  const [suspending, setSuspending] = useState<Room | null>(null)
  const [busy, setBusy] = useState(0)
  const [flash, setFlash] = useState({ text: '', bad: false })

  const rooms = useMemo(
    () => (data ?? []).filter((r) => !q || `${r.name} ${r.type_label}`.toLowerCase().includes(q.toLowerCase())),
    [data, q],
  )
  const active = data?.filter((r) => r.status === 'active').length ?? 0
  const maintenance = data?.filter((r) => r.status === 'maintenance').length ?? 0
  const suspended = data?.filter((r) => r.status === 'suspended').length ?? 0

  async function toggleStatus(r: Room) {
    if (r.status !== 'suspended') return setSuspending(r)
    setBusy(r.id)
    setFlash({ text: '', bad: false })
    try {
      const next = await bnb.updateRoom(r.id, { status: 'active' })
      setData((l) => l?.map((x) => (x.id === r.id ? next : x)) ?? null)
      setFlash({ text: `${next.name} is now ${next.status_label.toLowerCase()}.`, bad: false })
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
            <Button t={t} onClick={() => { setEditing(null); setFormOpen(true) }}>
              <Plus className="size-3.5" /> Register room
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
            text="Your account isn't assigned to a BnB branch, so there are no rooms to manage. Ask your manager or IT support to allocate you from HR → Branch allocation."
          />
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Stat t={t} i={0} icon={BedDouble} label="Rooms" value={data?.length ?? '—'} />
            <Stat t={t} i={1} icon={CircleCheck} label="Active" value={data ? active : '—'} />
            <Stat t={t} i={2} icon={Wrench} label="Under maintenance" value={data ? maintenance : '—'} />
            <Stat t={t} i={3} icon={Ban} label="Suspended" value={data ? suspended : '—'} />
          </div>

          <Panel t={t} title={`Rooms at ${me.branch_name ?? 'your branch'}`}>
            <div className="relative mb-4 sm:max-w-xs">
              <Search className={`pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 ${t.muted}`} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name or type"
                className={`h-10 w-full bg-transparent pl-9 pr-3 text-sm outline-none focus:ring-2 ${t.radius} ${t.chip} ${t.ring}`}
              />
            </div>
            <div className="mb-3"><Flash message={flash.text} tone={flash.bad ? 'red' : 'green'} /></div>
            {error ? (
              <ErrorNote t={t} message={error} onRetry={reload} />
            ) : loading && !data ? (
              <Loading t={t} />
            ) : !rooms.length ? (
              <Empty
                t={t}
                icon={BedDouble}
                title={data?.length ? 'No rooms match your search' : 'No rooms registered yet'}
                text={data?.length ? 'Try a different search.' : 'Use the Register room button to add your first room.'}
              />
            ) : (
              <ul className="space-y-2">
                <AnimatePresence initial={false}>
                  {rooms.map((r, i) => (
                    <Row key={r.id} t={t} i={i}>
                      <div className={`flex min-w-0 flex-1 items-center gap-3 ${r.status === 'suspended' ? 'opacity-55' : ''}`}>
                        <span className={`relative grid size-11 shrink-0 place-items-center overflow-hidden ${t.radius} ${t.iconBox}`}>
                          {r.photo ? <img src={r.photo} alt="" className="size-full object-cover" /> : <BedDouble className="size-5" />}
                          {r.photos.length > 1 && (
                            <span className="absolute bottom-0.5 right-0.5 rounded-full bg-black/65 px-1.5 py-px text-[9px] font-semibold leading-tight text-white">
                              {r.photos.length}
                            </span>
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{r.name}</p>
                          <p className={`truncate text-xs ${t.muted}`}>
                            {r.type_label} · <Users className="mr-0.5 inline size-3" />{r.capacity} {r.capacity === 1 ? 'guest' : 'guests'}
                          </p>
                          {r.status_reason && r.status !== 'active' && (
                            <p className={`truncate text-[11px] ${r.status === 'suspended' ? 'text-rose-500' : 'text-amber-600 dark:text-amber-300'}`}>
                              {r.status_reason}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className={`min-w-0 text-xs sm:w-40 ${t.muted}`}>
                        <p className="truncate font-medium text-inherit">{formatMoney(r.price)}<span className={t.muted}> / night</span></p>
                        {r.description && <p className="truncate">{r.description}</p>}
                      </div>
                      <div className="flex items-center justify-between gap-2 sm:justify-end">
                        <Pill tone={ROOM_TONE[r.status]}>{r.status_label}</Pill>
                        <div className="flex items-center gap-1">
                          <button
                            type="button" aria-label={`Edit ${r.name}`} title="Edit"
                            onClick={() => { setEditing(r); setFormOpen(true) }}
                            className={`grid size-8 place-items-center ${t.radius} ${t.muted} hover:text-sky-500`}
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={`${r.status === 'suspended' ? 'Activate' : 'Suspend'} ${r.name}`}
                            title={r.status === 'suspended' ? 'Activate' : 'Suspend'}
                            disabled={busy === r.id} onClick={() => void toggleStatus(r)}
                            className={`grid size-8 place-items-center ${t.radius} ${t.muted} disabled:opacity-40 ${r.status === 'suspended' ? 'hover:text-emerald-500' : 'hover:text-amber-500'}`}
                          >
                            {busy === r.id ? <Loader2 className="size-4 animate-spin" /> : r.status === 'suspended' ? <CircleCheck className="size-4" /> : <Ban className="size-4" />}
                          </button>
                          <button
                            type="button" aria-label={`Delete ${r.name}`} title="Delete"
                            onClick={() => setDeleting(r)}
                            className={`grid size-8 place-items-center ${t.radius} ${t.muted} hover:text-rose-500`}
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
        </>
      )}

      <RoomForm
        t={t}
        open={formOpen}
        editing={editing}
        onClose={() => { setFormOpen(false); setEditing(null) }}
        onSaved={(r) => {
          setData((l) => (editing ? (l?.map((x) => (x.id === r.id ? r : x)) ?? null) : [...(l ?? []), r].sort((a, b) => a.name.localeCompare(b.name))))
          setFormOpen(false)
          setEditing(null)
          setFlash({ text: editing ? `${r.name} was updated.` : `${r.name} was registered.`, bad: false })
        }}
      />
      <ConfirmDelete t={t} room={deleting} onClose={() => setDeleting(null)} onDeleted={(id) => setData((l) => l?.filter((x) => x.id !== id) ?? null)} />
      <SuspendRoom
        t={t}
        room={suspending}
        onClose={() => setSuspending(null)}
        onSaved={(r) => {
          setData((l) => l?.map((x) => (x.id === r.id ? r : x)) ?? null)
          setFlash({ text: `${r.name} was suspended.`, bad: false })
        }}
      />
    </div>
  )
}

function RoomForm({ t, open, editing, onClose, onSaved }: {
  t: WorkspaceTheme
  open: boolean
  editing: Room | null
  onClose: () => void
  onSaved: (r: Room) => void
}) {
  return (
    <AnimatePresence>
      {open && <RoomFormDialog key={editing?.id ?? 'new'} t={t} editing={editing} onClose={onClose} onSaved={onSaved} />}
    </AnimatePresence>
  )
}

interface ImgItem {
  key: string
  photo?: RoomPhoto
  file?: File
  url: string
}

function RoomFormDialog({ t, editing, onClose, onSaved }: { t: WorkspaceTheme; editing: Room | null; onClose: () => void; onSaved: (r: Room) => void }) {
  const [form, setForm] = useState(() =>
    editing
      ? { name: editing.name, room_type: editing.room_type, capacity: String(editing.capacity), price: editing.price, description: editing.description, status: editing.status, status_reason: editing.status_reason }
      : { ...blank, status: 'active' as RoomStatus, status_reason: '' },
  )
  const [images, setImages] = useState<ImgItem[]>(() =>
    (editing?.photos ?? []).map((p) => ({ key: `e${p.id}`, photo: p, url: p.thumb })),
  )
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const seq = useRef(0)
  const objectUrls = useRef(new Set<string>())

  useEffect(() => {
    const urls = objectUrls.current
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function pickPhotos(list: FileList | null) {
    if (!list) return
    for (const f of [...list].slice(0, Math.max(0, MAX_PHOTOS - images.length))) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
        setErrors((e) => ({ ...e, new_photos: 'Use JPG, PNG or WebP pictures.' }))
        continue
      }
      try {
        const file = await shrinkPhoto(f)
        const url = URL.createObjectURL(file)
        objectUrls.current.add(url)
        setImages((imgs) => [...imgs, { key: `n${seq.current++}`, file, url }])
        setErrors((e) => ({ ...e, new_photos: '' }))
      } catch {
        setErrors((e) => ({ ...e, new_photos: "A picture couldn't be read. Try another one." }))
      }
    }
  }

  function dropImage(key: string) {
    setImages((imgs) => {
      const it = imgs.find((x) => x.key === key)
      if (it?.file) {
        URL.revokeObjectURL(it.url)
        objectUrls.current.delete(it.url)
      }
      return imgs.filter((x) => x.key !== key)
    })
  }

  function makeMain(key: string) {
    setImages((imgs) => {
      const it = imgs.find((x) => x.key === key)
      return it ? [it, ...imgs.filter((x) => x.key !== key)] : imgs
    })
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    setMessage('')
    try {
      if (editing) {
        const changes: RoomEdit = {}
        if (form.name !== editing.name) changes.name = form.name
        if (form.room_type !== editing.room_type) changes.room_type = form.room_type
        if (Number(form.capacity) !== editing.capacity) changes.capacity = Number(form.capacity)
        if (Number(form.price) !== Number(editing.price)) changes.price = form.price
        if (form.description !== editing.description) changes.description = form.description
        if (form.status !== editing.status) changes.status = form.status
        if (form.status_reason !== editing.status_reason) changes.status_reason = form.status_reason

        const kept = new Set(images.filter((i) => i.photo).map((i) => i.photo!.id))
        const removeIds = editing.photos.filter((p) => !kept.has(p.id)).map((p) => p.id)
        const newPhotos = images.filter((i) => i.file).map((i) => i.file!)
        const first = images[0]
        const mainToken = first?.photo ? `e:${first.photo.id}` : first?.file ? `n:${newPhotos.indexOf(first.file)}` : undefined
        const orderSig = images.map((i) => (i.photo ? `e${i.photo.id}` : `n${i.file!.name}`)).join(',')
        const photosChanged = orderSig !== editing.photos.map((p) => `e${p.id}`).join(',')

        if (!Object.keys(changes).length && !photosChanged) return onClose()
        onSaved(await bnb.updateRoom(editing.id, changes, { newPhotos, removeIds, mainToken }))
      } else {
        onSaved(await bnb.registerRoom(
          { name: form.name, room_type: form.room_type, capacity: Number(form.capacity), price: form.price, description: form.description },
          images.map((i) => i.file!).filter(Boolean),
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
        aria-label={editing ? 'Edit room' : 'Register room'}
        initial={{ scale: 0.94, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className={`relative my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden shadow-2xl ${t.radius} ${t.root}`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-900/10 px-5 py-4 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid size-10 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
              <BedDouble className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className={`truncate text-base ${t.heading}`}>{editing ? `Edit ${editing.name}` : 'Register room'}</h3>
              <p className={`text-xs ${t.muted}`}>{editing ? 'Update the room details, price or status.' : 'Add a new room to your branch.'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`grid size-9 shrink-0 place-items-center ${t.radius} ${t.iconButton}`}>
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section>
            <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>Room pictures</legend>
            <div className="flex flex-wrap gap-2.5">
              {images.map((img, i) => (
                <div key={img.key} className={`relative size-20 overflow-hidden ring-2 ${t.radius} ${i === 0 ? t.ring : 'ring-transparent'}`}>
                  <img src={img.url} alt="" className="size-full object-cover" />
                  {i === 0 && (
                    <span className="absolute left-1 top-1 rounded-full bg-black/65 px-1.5 py-px text-[9px] font-semibold tracking-wide text-white">MAIN</span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/70 to-transparent p-1">
                    {i !== 0 && (
                      <button
                        type="button" title="Make main" aria-label={`Make picture ${i + 1} the main image`}
                        onClick={() => makeMain(img.key)}
                        className="grid size-6 place-items-center rounded-full bg-black/50 text-white transition hover:bg-black/80"
                      >
                        <Star className="size-3.5" />
                      </button>
                    )}
                    <button
                      type="button" title="Remove" aria-label={`Remove picture ${i + 1}`}
                      onClick={() => dropImage(img.key)}
                      className="grid size-6 place-items-center rounded-full bg-black/50 text-white transition hover:bg-rose-500/80"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {images.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className={`flex size-20 flex-col items-center justify-center gap-1 border-2 border-dashed text-[10px] transition ${t.radius} ${t.chip} hover:brightness-95 dark:hover:brightness-125`}
                >
                  <ImagePlus className="size-5" />
                  Add photos
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { void pickPhotos(e.target.files); e.target.value = '' }} />
            {errors.new_photos && <p className="mt-1.5 text-[11px] text-rose-500">{errors.new_photos}</p>}
            <p className={`mt-1.5 text-[11px] ${t.muted}`}>
              Up to {MAX_PHOTOS} pictures — the first one is the main image. Use the star to make another picture the main.
            </p>
          </section>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>Room details</legend>
            <Input t={t} label="Room name or number" placeholder="e.g. Room 101" value={form.name} onChange={set('name')} error={errors.name} required />
            <Select t={t} label="Room type" value={form.room_type} onChange={(e) => setForm((f) => ({ ...f, room_type: e.target.value as RoomType }))} error={errors.room_type}>
              {ROOM_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Input t={t} label="Guest capacity" type="number" inputMode="numeric" min={1} max={30} value={form.capacity} onChange={set('capacity')} error={errors.capacity} required />
            <Input t={t} label="Nightly rate (KES)" type="number" inputMode="decimal" min={0} step="0.01" placeholder="e.g. 4500" value={form.price} onChange={set('price')} error={errors.price} required />
            <label className="flex min-w-0 flex-col gap-1 sm:col-span-2">
              <span className={`text-[11px] font-medium ${t.muted}`}>Description (optional)</span>
              <textarea
                value={form.description}
                onChange={set('description')}
                rows={2}
                placeholder="Amenities, view, bed setup…"
                className={`min-h-16 w-full bg-transparent px-3 py-2 text-sm outline-none transition focus:ring-2 ${t.radius} ${t.chip} ${t.ring}`}
              />
              {errors.description && <span className="text-[11px] text-rose-500">{errors.description}</span>}
            </label>
          </fieldset>

          {editing && (
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>Room status</legend>
              <Select t={t} label="Status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as RoomStatus }))} error={errors.status}>
                <option value="active">Active</option>
                <option value="maintenance">Under maintenance</option>
                <option value="suspended">Suspended</option>
              </Select>
              {form.status !== 'active' && (
                <Input
                  t={t} label="Reason" value={form.status_reason} onChange={set('status_reason')}
                  maxLength={255} placeholder="Why is this room not available?" error={errors.status_reason}
                />
              )}
            </fieldset>
          )}
        </div>

        <footer className="space-y-3 border-t border-slate-900/10 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/10">
          <Flash message={message} tone="red" />
          <div className="flex justify-end gap-2">
            <Button t={t} variant="ghost" onClick={onClose}>Cancel</Button>
            <Button t={t} type="submit" busy={saving}>{editing ? 'Save changes' : 'Register room'}</Button>
          </div>
        </footer>
      </motion.form>
    </motion.div>
  )
}

const CUSTOM_REASON = '__custom'

function SuspendRoom(props: { t: WorkspaceTheme; room: Room | null; onClose: () => void; onSaved: (r: Room) => void }) {
  return (
    <AnimatePresence>
      {props.room && <SuspendDialog key={props.room.id} {...props} room={props.room} />}
    </AnimatePresence>
  )
}

function SuspendDialog({ t, room, onClose, onSaved }: { t: WorkspaceTheme; room: Room; onClose: () => void; onSaved: (r: Room) => void }) {
  const [choice, setChoice] = useState(SUSPEND_REASONS[0])
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function suspend() {
    const reason = choice === CUSTOM_REASON ? custom.trim() : choice
    if (!reason) return setErr('Type the reason for suspending this room.')
    setBusy(true)
    setErr('')
    try {
      onSaved(await bnb.updateRoom(room.id, { status: 'suspended', status_reason: reason }))
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
        role="alertdialog" aria-modal="true" aria-label={`Suspend ${room.name}`}
        initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className={`relative w-full max-w-sm p-5 shadow-2xl ${t.radius} ${t.root}`}
      >
        <span className={`grid size-10 place-items-center ${t.radius} bg-amber-500/10 text-amber-500`}>
          <Ban className="size-5" />
        </span>
        <h3 className={`mt-3 text-base ${t.heading}`}>Suspend {room.name}?</h3>
        <p className={`mt-1 text-xs ${t.muted}`}>
          A suspended room can't be booked until it's activated again. Pick a reason so the team knows why.
        </p>
        <div className="mt-4 space-y-3">
          <Select t={t} label="Reason" value={choice} onChange={(e) => setChoice(e.target.value)}>
            {SUSPEND_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            <option value={CUSTOM_REASON}>Other — type your own</option>
          </Select>
          {choice === CUSTOM_REASON && (
            <Input
              t={t} label="Custom reason" value={custom} autoFocus maxLength={255}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="e.g. Waiting for spare parts"
            />
          )}
          <Flash message={err} tone="red" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button t={t} variant="ghost" onClick={onClose}>Cancel</Button>
          <Button t={t} variant="danger" busy={busy} onClick={() => void suspend()}>Suspend room</Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function ConfirmDelete({ t, room, onClose, onDeleted }: { t: WorkspaceTheme; room: Room | null; onClose: () => void; onDeleted: (id: number) => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function remove() {
    if (!room) return
    setBusy(true)
    setErr('')
    try {
      await bnb.deleteRoom(room.id)
      onDeleted(room.id)
      onClose()
    } catch (e) {
      setErr(parseApiError(e).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      {room && (
        <motion.div
          key={room.id}
          className="fixed inset-0 z-[60] grid place-items-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
          <motion.div
            role="alertdialog" aria-modal="true" aria-label={`Delete ${room.name}`}
            initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            className={`relative w-full max-w-sm p-5 shadow-2xl ${t.radius} ${t.root}`}
          >
            <span className={`grid size-10 place-items-center ${t.radius} bg-rose-500/10 text-rose-500`}>
              <Trash2 className="size-5" />
            </span>
            <h3 className={`mt-3 text-base ${t.heading}`}>Delete {room.name}?</h3>
            <p className={`mt-1 text-xs ${t.muted}`}>
              This permanently removes the room and its picture. If the room has bookings you want to keep, suspend it instead.
            </p>
            <div className="mt-3"><Flash message={err} tone="red" /></div>
            <div className="mt-4 flex justify-end gap-2">
              <Button t={t} variant="ghost" onClick={onClose}>Cancel</Button>
              <Button t={t} variant="danger" busy={busy} onClick={() => void remove()}>Delete room</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
