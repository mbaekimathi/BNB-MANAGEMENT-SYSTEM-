import { motion } from 'framer-motion'
import { Clock3, LockKeyhole, Mail, Phone, User } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alert } from '../components/Alert'
import { AuthLayout } from '../components/AuthLayout'
import { CodeInput } from '../components/CodeInput'
import { Field } from '../components/Field'
import { PhotoUpload } from '../components/PhotoUpload'
import { SubmitButton } from '../components/SubmitButton'
import { useAuth } from '../context/AuthContext'
import { parseApiError, type FieldErrors, type SignupPayload } from '../lib/api'

const empty: SignupPayload = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  code: '',
  password: '',
  confirm_password: '',
  photo: null,
}

const isPin = (pw: string) => /^\d{6}$/.test(pw)

function passwordScore(pw: string) {
  if (isPin(pw)) return 2
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

const section = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.1 + i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } }),
}

export default function SignupPage() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState<SignupPayload>(empty)
  const [fields, setFields] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const score = useMemo(() => passwordScore(form.password), [form.password])

  function update<K extends keyof SignupPayload>(key: K, value: SignupPayload[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    if (fields[key])
      setFields((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
  }
  const text = (key: keyof SignupPayload) => (e: { target: { value: string } }) => update(key, e.target.value)

  function validate(): FieldErrors {
    const errs: FieldErrors = {}
    if (!form.first_name.trim()) errs.first_name = 'Required'
    if (!form.last_name.trim()) errs.last_name = 'Required'
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errs.email = 'Enter a valid email address.'
    if (!/^\+?[\d\s-]{9,20}$/.test(form.phone.trim())) errs.phone = 'Enter a valid phone number.'
    if (!/^\d{6}$/.test(form.code)) errs.code = 'Choose a 6-digit code. You will use it to sign in.'
    if (isPin(form.password)) {
      if (form.password === form.code) errs.password = "Your 6-digit password can't be the same as your sign-in code."
    } else if (form.password.length < 8) errs.password = 'Use a 6-digit number or at least 8 characters.'
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
        state: { notice: `${res.message} Your sign-in code is ${res.user.code}.` },
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
      <motion.div initial="hidden" animate="show">
        <motion.p custom={0} variants={section} className="text-sm font-medium text-gold-500 dark:text-gold-300">
          Join the team
        </motion.p>
        <motion.h2 custom={1} variants={section} className="mt-2 font-display text-3xl font-medium tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          Create your account
        </motion.h2>
        <motion.p custom={2} variants={section} className="mt-3 flex items-start gap-2 rounded-xl bg-slate-900/[0.04] px-3 py-2 text-xs text-slate-600 dark:bg-white/[0.03] dark:text-slate-400">
          <Clock3 className="mt-0.5 size-3.5 shrink-0 text-gold-500 dark:text-gold-300" />
          New accounts join as Branch Employee and stay pending activation until a manager approves them.
        </motion.p>

        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
          <Alert message={error} />
          <motion.div custom={3} variants={section}>
            <PhotoUpload
              file={form.photo}
              onChange={(f) => update('photo', f)}
              error={fields.photo}
              onError={(m) => setFields((prev) => ({ ...prev, photo: m }))}
            />
          </motion.div>
          <motion.div custom={4} variants={section} className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" icon={User} autoComplete="given-name" value={form.first_name} onChange={text('first_name')} error={fields.first_name} />
            <Field label="Last name" icon={User} autoComplete="family-name" value={form.last_name} onChange={text('last_name')} error={fields.last_name} />
          </motion.div>
          <motion.div custom={5} variants={section} className="space-y-4">
            <Field label="Personal email" icon={Mail} type="email" autoComplete="email" value={form.email} onChange={text('email')} error={fields.email} />
            <Field label="Phone number" icon={Phone} type="tel" autoComplete="tel" value={form.phone} onChange={text('phone')} error={fields.phone} />
          </motion.div>
          <motion.div custom={6} variants={section}>
            <CodeInput label="Choose your 6-digit sign-in code" value={form.code} onChange={(v) => update('code', v)} error={fields.code} />
          </motion.div>
          <motion.div custom={7} variants={section} className="space-y-4">
            <div>
              <Field label="Password" icon={LockKeyhole} type="password" autoComplete="new-password" value={form.password} onChange={text('password')} error={fields.password} />
              {!form.password && !fields.password && (
                <p className="px-1 pt-1.5 text-[11px] text-slate-400 dark:text-slate-500">Use a 6-digit number or at least 8 characters.</p>
              )}
              {form.password && (
                <div className="mt-2 flex items-center gap-3 px-1">
                  <div className="flex flex-1 gap-1.5">
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < score ? strength[score].color : 'bg-slate-200 dark:bg-white/10'}`} />
                    ))}
                  </div>
                  <span className="w-20 text-right text-[11px] text-slate-500 dark:text-slate-400">{isPin(form.password) ? '6-digit PIN' : strength[score].label}</span>
                </div>
              )}
            </div>
            <Field
              label="Confirm password"
              icon={LockKeyhole}
              type="password"
              autoComplete="new-password"
              value={form.confirm_password}
              onChange={text('confirm_password')}
              error={fields.confirm_password}
            />
          </motion.div>

          <motion.div custom={8} variants={section} className="pt-2">
            <SubmitButton loading={loading}>Create account</SubmitButton>
          </motion.div>
        </form>

        <p className="mt-7 text-center text-sm text-slate-500 dark:text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-gold-500 transition hover:text-gold-400 dark:text-gold-300 dark:hover:text-gold-200">
            Sign in
          </Link>
        </p>
      </motion.div>
    </AuthLayout>
  )
}
