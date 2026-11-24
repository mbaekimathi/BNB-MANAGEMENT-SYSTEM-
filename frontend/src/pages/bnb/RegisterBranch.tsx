import { AnimatePresence, motion } from 'framer-motion'
import { Building2, Camera, Check, CircleAlert, Eye, EyeOff, Loader2, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { PhoneInput } from '../../components/hr/PhoneInput'
import { Button, Flash, Input } from '../../components/hr/ui'
import { parseApiError, type FieldErrors } from '../../lib/api'
import { bnb, type Branch, type BranchEdit } from '../../lib/bnb'
import { shrinkPhoto } from '../../lib/image'
import type { WorkspaceTheme } from '../../lib/workspaces'

const blank = { name: '', phone: '', email: '', location: '', code: '', password: '', confirm_password: '' }

interface Props {
  t: WorkspaceTheme
  open: boolean
  /** When set, the dialog edits this branch instead of registering a new one. */
  editing?: Branch | null
  onClose: () => void
  onSaved: (b: Branch) => void
}

export function RegisterBranch({ open, editing, ...rest }: Props) {
  return (
    <AnimatePresence>
      {open && <RegisterDialog key={editing?.id ?? 'new'} editing={editing} {...rest} />}
    </AnimatePresence>
  )
}

function RegisterDialog({ t, editing, onClose, onSaved }: Omit<Props, 'open'>) {
  const [form, setForm] = useState(() =>
    editing
      ? { name: editing.name, phone: editing.phone, email: editing.email, location: editing.location, code: editing.code, password: '', confirm_password: '' }
      : blank,
  )
  const [photo, setPhoto] = useState<File | null | undefined>(undefined)
  const [showPw, setShowPw] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [codeStatus, setCodeStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const codeSeq = useRef(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : photo === null ? null : (editing?.photo ?? null)), [photo, editing])

  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Live availability lookup against the branches table only — employee codes live in a separate table.
  useEffect(() => {
    const seq = ++codeSeq.current
    const timer = setTimeout(() => {
      if (form.code.length !== 6 || (editing && form.code === editing.code)) return setCodeStatus('idle')
      setCodeStatus('checking')
      bnb
        .checkBranchCode(form.code)
        .then((r) => codeSeq.current === seq && setCodeStatus(r.available ? 'available' : 'taken'))
        .catch(() => codeSeq.current === seq && setCodeStatus('idle'))
    }, 300)
    return () => clearTimeout(timer)
  }, [form.code, editing])

  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setUpper = (k: keyof typeof blank) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value.toUpperCase() }))

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
    if (form.password !== form.confirm_password) return setErrors({ confirm_password: 'Passwords do not match.' })
    if (codeStatus === 'taken') return setErrors({ code: 'This code is already used by another branch. Pick a different one.' })
    setSaving(true)
    setErrors({})
    setMessage('')
    try {
      if (editing) {
        const changes: BranchEdit = {}
        for (const k of ['name', 'phone', 'email', 'location', 'code'] as const) if (form[k] !== editing[k]) changes[k] = form[k]
        if (form.password) {
          changes.password = form.password
          changes.confirm_password = form.confirm_password
        }
        if (!Object.keys(changes).length && photo === undefined) return onClose()
        onSaved(await bnb.updateBranch(editing.id, changes, photo))
      } else {
        onSaved(await bnb.registerBranch(form, photo ?? null))
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
        aria-label={editing ? 'Edit branch' : 'Register branch'}
        initial={{ scale: 0.94, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className={`relative my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden shadow-2xl ${t.radius} ${t.root}`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-900/10 px-5 py-4 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid size-10 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
              <Building2 className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className={`truncate text-base ${t.heading}`}>{editing ? `Edit ${editing.name}` : 'Register branch'}</h3>
              <p className={`text-xs ${t.muted}`}>{editing ? 'Update branch details, sign-in code or password.' : 'Add a new BnB branch with its own sign-in code.'}</p>
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
                <span className="grid size-full place-items-center bg-gradient-to-br from-slate-400 to-slate-600 text-white"><Building2 className="size-7" /></span>
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
            <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>Branch details</legend>
            <Input t={t} label="Branch name" value={form.name} onChange={setUpper('name')} error={errors.name} required />
            <PhoneInput t={t} label="Branch phone number" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} error={errors.phone} required />
            <Input t={t} label="Branch email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value.toLowerCase() }))} error={errors.email} required />
            <Input t={t} label="Branch location" value={form.location} onChange={setUpper('location')} error={errors.location} required />
          </fieldset>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className={`mb-2 text-xs font-semibold uppercase tracking-wider ${t.muted}`}>Branch sign-in</legend>
            <div>
              <Input
                t={t} label="6-digit code login" inputMode="numeric" maxLength={6} pattern="\d{6}" value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.replace(/\D/g, '').slice(0, 6) }))} error={errors.code} required
              />
              {codeStatus !== 'idle' && !errors.code && (
                <p
                  className={`mt-1 flex items-center gap-1 text-[11px] ${
                    codeStatus === 'available' ? 'text-emerald-600 dark:text-emerald-400' : codeStatus === 'taken' ? 'text-rose-500' : t.muted
                  }`}
                  role="status"
                >
                  {codeStatus === 'checking' && <Loader2 className="size-3 animate-spin" />}
                  {codeStatus === 'available' && <Check className="size-3" />}
                  {codeStatus === 'taken' && <CircleAlert className="size-3" />}
                  {codeStatus === 'checking'
                    ? 'Checking code…'
                    : codeStatus === 'available'
                      ? 'This code is available.'
                      : 'This code is already used by another branch.'}
                </p>
              )}
            </div>
            <span className="hidden sm:block" />
            <Input t={t} label={editing ? 'New password' : 'Login password'} type={showPw ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} required={!editing} placeholder={editing ? 'Leave blank to keep' : undefined} />
            <Input t={t} label={editing ? 'Confirm new password' : 'Confirm password'} type={showPw ? 'text' : 'password'} autoComplete="new-password" value={form.confirm_password} onChange={set('confirm_password')} error={errors.confirm_password} required={!editing && !!form.password} />
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
            <Button t={t} type="submit" busy={saving}>{editing ? 'Save changes' : 'Register branch'}</Button>
          </div>
        </footer>
      </motion.form>
    </motion.div>
  )
}
