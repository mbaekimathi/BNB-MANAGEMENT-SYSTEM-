import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Inbox, Loader2, type LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import type { Employee } from '../../lib/api'
import type { EmployeeBrief } from '../../lib/hr'
import type { WorkspaceTheme } from '../../lib/workspaces'
import { Avatar } from '../workspace/Avatar'

type T = { t: WorkspaceTheme }

export function PageHeader({ t, icon: Icon, title, text, actions }: T & { icon: LucideIcon; title: string; text: string; actions?: ReactNode }) {
  return (
    <section className={`relative overflow-hidden p-5 sm:p-6 ${t.radius} ${t.card}`}>
      <div className={`pointer-events-none absolute -right-20 -top-24 size-72 rounded-full blur-2xl ${t.glowA}`} />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className={`grid size-14 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
          <Icon className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={`text-xl sm:text-2xl ${t.heading}`}>{title}</h2>
          <p className={`mt-1 text-sm ${t.muted}`}>{text}</p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </section>
  )
}

export function Panel({ t, title, actions, children, className = '' }: T & { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`p-4 sm:p-5 ${t.radius} ${t.card} ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h3 className={`text-sm ${t.heading}`}>{title}</h3>}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

export function Stat({ t, icon: Icon, label, value, hint, i = 0 }: T & { icon: LucideIcon; label: string; value: ReactNode; hint?: string; i?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * i, duration: 0.35 }}
      className={`stat-card flex items-center gap-4 p-4 ${t.radius} ${t.card}`}
    >
      <span className={`grid size-11 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className={`text-xs ${t.muted}`}>{label}</p>
        <p className={`text-xl sm:text-2xl ${t.heading}`}>{value}</p>
        {hint && <p className={`truncate text-[11px] ${t.muted}`}>{hint}</p>}
      </div>
    </motion.div>
  )
}

const TONES: Record<Tone, string> = {
  green: 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300',
  amber: 'bg-amber-500/12 text-amber-700 ring-amber-500/30 dark:text-amber-300',
  red: 'bg-rose-500/12 text-rose-700 ring-rose-500/30 dark:text-rose-300',
  slate: 'bg-slate-500/12 text-slate-600 ring-slate-500/30 dark:text-slate-300',
  blue: 'bg-sky-500/12 text-sky-700 ring-sky-500/30 dark:text-sky-300',
}
export type Tone = 'green' | 'amber' | 'red' | 'slate' | 'blue'

export function Pill({ tone = 'slate', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONES[tone]}`}>{children}</span>
}

export function Button({ t, variant = 'primary', busy, children, className = '', ...props }: T & ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger'; busy?: boolean }) {
  const look =
    variant === 'primary'
      ? `${t.brandMark} hover:brightness-110`
      : variant === 'danger'
        ? 'text-rose-600 ring-1 ring-inset ring-rose-500/40 hover:bg-rose-500/10 dark:text-rose-300'
        : `${t.chip} hover:brightness-95 dark:hover:brightness-125`
  return (
    <button
      type="button"
      disabled={busy || props.disabled}
      className={`inline-flex h-9 items-center justify-center gap-1.5 px-3.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${t.radius} ${look} ${className}`}
      {...props}
    >
      {busy && <Loader2 className="size-3.5 animate-spin" />}
      {children}
    </button>
  )
}

/** A router Link styled like the ghost Button — for actions that navigate. */
export function LinkButton({ t, children, className = '', ...props }: T & LinkProps & { children: ReactNode }) {
  return (
    <Link
      className={`inline-flex h-9 items-center justify-center gap-1.5 px-3.5 text-xs font-semibold transition hover:brightness-95 dark:hover:brightness-125 ${t.radius} ${t.chip} ${className}`}
      {...props}
    >
      {children}
    </Link>
  )
}

const control = (t: WorkspaceTheme) =>
  `h-10 w-full min-w-0 bg-transparent px-3 text-sm outline-none transition focus:ring-2 ${t.radius} ${t.chip} ${t.ring}`

export function Input({ t, label, error, ...props }: T & InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      {label && <span className={`text-[11px] font-medium ${t.muted}`}>{label}</span>}
      <input className={`${control(t)} ${error ? 'ring-1 ring-rose-500/60' : ''} [color-scheme:light] dark:[color-scheme:dark]`} {...props} />
      {error && <span className="text-[11px] text-rose-500">{error}</span>}
    </label>
  )
}

export function Textarea({ t, label, error, ...props }: T & TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      {label && <span className={`text-[11px] font-medium ${t.muted}`}>{label}</span>}
      <textarea className={`min-h-20 w-full min-w-0 bg-transparent px-3 py-2 text-sm outline-none transition focus:ring-2 ${t.radius} ${t.chip} ${t.ring} ${error ? 'ring-1 ring-rose-500/60' : ''}`} {...props} />
      {error && <span className="text-[11px] text-rose-500">{error}</span>}
    </label>
  )
}

export function Select({ t, label, error, children, ...props }: T & SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      {label && <span className={`text-[11px] font-medium ${t.muted}`}>{label}</span>}
      <select className={`${control(t)} ${error ? 'ring-1 ring-rose-500/60' : ''} [&>option]:bg-white [&>option]:text-slate-900 dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100`} {...props}>
        {children}
      </select>
      {error && <span className="text-[11px] text-rose-500">{error}</span>}
    </label>
  )
}

export function Loading({ t, rows = 4 }: T & { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`relative h-14 overflow-hidden ${t.radius} ${t.chip} opacity-70`}>
          <div
            className="absolute inset-0 animate-shimmer bg-[linear-gradient(100deg,transparent_25%,rgba(255,255,255,0.55)_50%,transparent_75%)] bg-[length:220%_100%] dark:bg-[linear-gradient(100deg,transparent_25%,rgba(255,255,255,0.09)_50%,transparent_75%)]"
            style={{ animationDelay: `${i * 140}ms` }}
          />
        </div>
      ))}
    </div>
  )
}

export function ErrorNote({ message, onRetry, t }: T & { message: string; onRetry?: () => void }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 p-4 text-sm text-rose-600 ring-1 ring-inset ring-rose-500/30 dark:text-rose-300 ${t.radius}`}>
      <AlertTriangle className="size-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && <Button t={t} variant="ghost" onClick={onRetry}>Try again</Button>}
    </div>
  )
}

export function Empty({ t, icon: Icon = Inbox, title, text }: T & { icon?: LucideIcon; title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <span className={`grid size-12 place-items-center ${t.radius} ${t.iconBox}`}>
        <Icon className="size-5" />
      </span>
      <p className={`text-sm ${t.heading}`}>{title}</p>
      {text && <p className={`max-w-sm text-xs ${t.muted}`}>{text}</p>}
    </div>
  )
}

export function Flash({ message, tone = 'green' }: { message: string; tone?: Tone }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={`rounded-lg px-3 py-2 text-xs ring-1 ring-inset ${TONES[tone]}`}
          role="status"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  )
}

export function Person({ t, user, sub }: T & { user: Employee | EmployeeBrief; sub?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar user={user as Employee} className={`size-10 ${t.radius}`} ring={t.ring} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{user.full_name}</p>
        <p className={`truncate text-xs ${t.muted}`}>{sub ?? `${user.code} · ${user.role_label}`}</p>
      </div>
    </div>
  )
}

export function Row({ t, children, i = 0 }: T & { children: ReactNode; i?: number }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ delay: Math.min(i, 10) * 0.03, duration: 0.25 }}
      className={`flex flex-col gap-3 p-3 sm:flex-row sm:items-center ${t.radius} ${t.chip}`}
    >
      {children}
    </motion.li>
  )
}
