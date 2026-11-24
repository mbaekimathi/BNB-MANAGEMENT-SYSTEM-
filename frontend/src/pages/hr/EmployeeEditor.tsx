import { AnimatePresence, motion } from 'framer-motion'
import { Camera, Eye, EyeOff, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Button, Flash, Input, Select } from '../../components/hr/ui'
import { parseApiError, type Employee, type FieldErrors, type Role } from '../../lib/api'
import { hr, type EmployeeEdit } from '../../lib/hr'
import { shrinkPhoto } from '../../lib/image'
import { ROLE_LABELS } from '../../lib/roles'
import type { WorkspaceTheme } from '../../lib/workspaces'

const ROLES = Object.entries(ROLE_LABELS) as [Role, string][]
const STATUSES = [
  ['active', 'Active'],
  ['pending', 'Pending activation'],
  ['suspended', 'Suspended'],
] as const
const FIELDS = ['first_name', 'last_name', 'email', 'phone', 'code', 'role', 'status'] as const

interface Props {
  t: WorkspaceTheme
  me: Employee
  employee: Employee | null
  onClose: () => void
  onSaved: (u: Employee) => void
}

export function EmployeeEditor({ employee, ...rest }: Props) {
  return (
    <AnimatePresence>
      {employee && <EditorPanel key={employee.id} employee={employee} {...rest} />}
    </AnimatePresence>
  )
}

function EditorPanel({ t, me, employee: u, onClose, onSaved }: Props & { employee: Employee }) {
  const [form, setForm] = useState(() => Object.fromEntries(FIELDS.map((f) => [f, u[f]])) as Record<(typeof FIELDS)[number], string>)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [photo, setPhoto] = useState<File | null | undefined>(undefined)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const self = u.id === me.id
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
    for (const f of FIELDS) if (form[f] !== u[f]) Object.assign(changes, { [f]: form[f].trim() })
    if (password) changes.new_password = password
    if (!Object.keys(changes).length && photo === undefined) return onClose()
    setSaving(true)
    setErrors({})
    setMessage('')
    try {
      onSaved(await hr.updateEmployee(u.id, changes, photo))
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
              <Button t={t} variant="ghost" onClick={() => fileRef.current?.click()}><Camera className="size-3.5" />{preview ? 'Change picture' : 'Add picture'}</Button>
              {preview && <Button t={t} variant="danger" onClick={() => setPhoto(null)}><Trash2 className="size-3.5" />Remove</Button>}
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
            <Select t={t} label="Role" value={form.role} onChange={set('role')} error={errors.role} disabled={self}>
              {ROLES.filter(([r]) => r !== 'admin' || me.role === 'admin' || u.role === 'admin').map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
            <Select t={t} label="Status" value={form.status} onChange={set('status')} error={errors.status} disabled={self}>
              {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
            {self && <p className={`self-end pb-2 text-[11px] ${t.muted}`}>You can't change your own role or status.</p>}
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
