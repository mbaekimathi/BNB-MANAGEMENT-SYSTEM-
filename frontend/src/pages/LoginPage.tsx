import { motion } from 'framer-motion'
import { LockKeyhole } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Alert } from '../components/Alert'
import { AuthLayout } from '../components/AuthLayout'
import { CodeInput } from '../components/CodeInput'
import { Field } from '../components/Field'
import { greetingFor, useNow } from '../lib/time'
import { SubmitButton } from '../components/SubmitButton'
import { useAuth } from '../context/AuthContext'
import { parseApiError, type FieldErrors } from '../lib/api'
import { rolePath } from '../lib/roles'

const item = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.15 + i * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } }),
}

export default function LoginPage() {
  const { login } = useAuth()
  const now = useNow(60_000)
  const navigate = useNavigate()
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice

  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState<FieldErrors>({})

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const errs: FieldErrors = {}
    if (!/^\d{6}$/.test(code)) errs.code = 'Enter your 6-digit code.'
    if (!password) errs.password = 'Enter your password.'
    setFields(errs)
    setError('')
    if (Object.keys(errs).length) return

    setLoading(true)
    try {
      const user = await login(code, password, remember)
      navigate(rolePath(user.role), { replace: true })
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
        <motion.p custom={0} variants={item} className="text-sm font-medium text-gold-500 dark:text-gold-300">
          {greetingFor(now)}
        </motion.p>
        <motion.h2 custom={1} variants={item} className="mt-2 font-display text-3xl font-medium tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          Welcome back
        </motion.h2>
        <motion.p custom={2} variants={item} className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Enter your 6-digit code and password to open your workspace.
        </motion.p>

        <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
          <motion.div custom={3} variants={item} className="space-y-4">
            <Alert message={notice && !error ? notice : undefined} tone="success" />
            <Alert message={error} />
          </motion.div>
          <motion.div custom={4} variants={item}>
            <CodeInput label="Your 6-digit code" value={code} onChange={setCode} error={fields.code} autoFocus />
          </motion.div>
          <motion.div custom={5} variants={item}>
            <Field
              label="Password"
              icon={LockKeyhole}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fields.password}
            />
          </motion.div>

          <motion.div custom={6} variants={item} className="flex items-center justify-between pt-1 text-sm">
            <label className="flex cursor-pointer select-none items-center gap-2.5 text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="size-4 cursor-pointer appearance-none rounded-[5px] border border-slate-300 bg-slate-900/5 transition checked:border-gold-400 checked:bg-gold-400 checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22 fill=%22%230b1020%22><path d=%22M6.2 11.3 2.9 8l1.1-1.1 2.2 2.2 5.8-5.8L13.1 4.4z%22/></svg>')] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/50 dark:border-white/20 dark:bg-white/5"
              />
              Keep me signed in
            </label>
            <span className="text-slate-500 dark:text-slate-400" title="Ask your manager or an administrator to reset your password.">
              Forgot password?
            </span>
          </motion.div>

          <motion.div custom={7} variants={item} className="pt-2">
            <SubmitButton loading={loading}>Sign in</SubmitButton>
          </motion.div>
        </form>

        <motion.div custom={8} variants={item} className="mt-8 flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          <span className="h-px flex-1 bg-slate-300/70 dark:bg-white/10" /> New to the team? <span className="h-px flex-1 bg-slate-300/70 dark:bg-white/10" />
        </motion.div>
        <motion.div custom={9} variants={item} className="mt-5">
          <Link
            to="/signup"
            className="flex h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-medium text-slate-900 transition hover:border-gold-500/50 hover:bg-gold-400/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:hover:border-gold-300/40 dark:hover:bg-white/[0.06]"
          >
            Create an employee account
          </Link>
        </motion.div>
      </motion.div>
    </AuthLayout>
  )
}
