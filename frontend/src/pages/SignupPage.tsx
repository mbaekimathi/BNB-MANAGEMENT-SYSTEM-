import { motion } from 'framer-motion'
import { BedDouble, Briefcase, Calculator, ChevronDown, LockKeyhole, Mail, Phone, User, Wrench, Sparkles } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert } from '../components/Alert'
import { AuthLayout } from '../components/AuthLayout'
import { Field } from '../components/Field'
import { SubmitButton } from '../components/SubmitButton'
import { useAuth } from '../context/AuthContext'
import { parseApiError, type FieldErrors, type SignupPayload } from '../lib/api'

const ROLES: { value: SignupPayload['role']; label: string; icon: typeof User }[] = [
  { value: 'receptionist', label: 'Front Desk', icon: BedDouble },
  { value: 'housekeeping', label: 'Housekeeping', icon: Sparkles },
  { value: 'maintenance', label: 'Maintenance', icon: Wrench },
  { value: 'accountant', label: 'Accounts', icon: Calculator },
  { value: 'manager', label: 'Manager', icon: Briefcase },
]

const empty: SignupPayload = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  role: 'receptionist',
  password: '',
  confirm_password: '',
}

function passwordScore(pw: string) {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return Math.min(score, 4)
}

const strength = [
  { label: 'Too short', color: 'bg-rose-400' },
  { label: 'Weak', color: 'bg-rose-400' },
  { label: 'Fair', color: 'bg-amber-400' },
  { label: 'Good', color: 'bg-lime-400' },
  { label: 'Strong', color: 'bg-emerald-400' },
]

export default function SignupPage() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState<SignupPayload>(empty)
  const [fields, setFields] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const score = useMemo(() => passwordScore(form.password), [form.password])

  const set = (key: keyof SignupPayload) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (fields[key]) setFields((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function validate(): FieldErrors {
    const errs: FieldErrors = {}
    if (!form.first_name.trim()) errs.first_name = 'Required'
    if (!form.last_name.trim()) errs.last_name = 'Required'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Enter a valid email address.'
    if (form.phone && !/^\+?[\d\s-]{7,20}$/.test(form.phone)) errs.phone = 'Enter a valid phone number.'
    if (form.password.length < 8) errs.password = 'Use at least 8 characters.'
    if (form.confirm_password !== form.password) errs.confirm_password = 'Passwords do not match.'
    return errs
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const errs = validate()
    setFields(errs)
    setError('')
    if (Object.keys(errs).length) return
    setLoading(true)
    try {
      const res = await signup({ ...form, email: form.email.trim(), phone: form.phone.trim() })
      navigate('/login', {
        replace: true,
        state: { notice: `${res.message} Your employee ID is ${res.user.employee_id}.` },
      })
    } catch (err) {
      const parsed = parseApiError(err)
      setError(parsed.message)
      setFields(parsed.fields)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        <p className="text-sm font-medium text-gold-300">Join the team</p>
        <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-white sm:text-4xl">Create your account</h2>
        <p className="mt-2 text-sm text-slate-400">A manager will approve your account before you can sign in.</p>

        <form onSubmit={onSubmit} noValidate className="mt-7 space-y-4">
          <Alert message={error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" icon={User} autoComplete="given-name" value={form.first_name} onChange={set('first_name')} error={fields.first_name} />
            <Field label="Last name" icon={User} autoComplete="family-name" value={form.last_name} onChange={set('last_name')} error={fields.last_name} />
          </div>
          <Field label="Work email" icon={Mail} type="email" autoComplete="email" value={form.email} onChange={set('email')} error={fields.email} />
          <Field label="Phone (optional)" icon={Phone} type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} error={fields.phone} />

          <fieldset>
            <legend className="mb-2 flex items-center gap-1.5 pl-1 text-xs font-medium uppercase tracking-wider text-slate-400">
              <ChevronDown className="size-3.5" /> Your department
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ROLES.map((r) => {
                const active = form.role === r.value
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, role: r.value }))}
                    aria-pressed={active}
                    className={`relative flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                      active ? 'border-gold-400/70 text-white' : 'border-white/10 text-slate-300 hover:border-white/25 hover:bg-white/[0.04]'
                    }`}
                  >
                    {active && (
                      <motion.span layoutId="role-pill" className="absolute inset-0 rounded-xl bg-gold-400/10" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
                    )}
                    <r.icon className={`relative size-4 ${active ? 'text-gold-300' : 'text-slate-500'}`} />
                    <span className="relative">{r.label}</span>
                  </button>
                )
              })}
            </div>
            {fields.role && <p className="pl-2 pt-1.5 text-xs text-rose-300">{fields.role}</p>}
          </fieldset>

          <div>
            <Field label="Password" icon={LockKeyhole} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} error={fields.password} />
            {form.password && (
              <div className="mt-2 flex items-center gap-3 px-1">
                <div className="flex flex-1 gap-1.5">
                  {[0, 1, 2, 3].map((i) => (
                    <motion.span
                      key={i}
                      className={`h-1 flex-1 rounded-full ${i < score ? strength[score].color : 'bg-white/10'}`}
                      initial={false}
                      animate={{ opacity: i < score ? 1 : 0.6 }}
                    />
                  ))}
                </div>
                <span className="w-16 text-right text-[11px] text-slate-400">{strength[score].label}</span>
              </div>
            )}
          </div>
          <Field
            label="Confirm password"
            icon={LockKeyhole}
            type="password"
            autoComplete="new-password"
            value={form.confirm_password}
            onChange={set('confirm_password')}
            error={fields.confirm_password}
          />

          <div className="pt-2">
            <SubmitButton loading={loading}>Create account</SubmitButton>
          </div>
        </form>

        <p className="mt-7 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-gold-300 transition hover:text-gold-200">
            Sign in
          </Link>
        </p>
      </motion.div>
    </AuthLayout>
  )
}
