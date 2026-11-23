import { motion } from 'framer-motion'
import { BadgeCheck, LogOut, Mail, Phone } from 'lucide-react'
import { AnimatedBackdrop } from '../components/AnimatedBackdrop'
import { Brand } from '../components/Brand'
import { LiveClock } from '../components/LiveClock'
import { useAuth } from '../context/AuthContext'
import { greetingFor, useNow } from '../lib/time'

/** Landing page for each role. Each role's own modules will be added here. */
export default function RolePage() {
  const { user, logout } = useAuth()
  const now = useNow(60_000)
  if (!user) return null
  const initials = `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase()

  return (
    <div className="min-h-screen">
      <AnimatedBackdrop />
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-6 sm:px-8">
        <Brand />
        <button
          onClick={logout}
          className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-white/25 hover:text-white"
        >
          <LogOut className="size-4" /> <span className="hidden sm:inline">Sign out</span>
        </button>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-6 sm:px-8">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="glass flex flex-col gap-6 rounded-3xl p-6 sm:flex-row sm:items-center sm:p-8"
        >
          <div className="relative size-24 shrink-0 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-gold-300 to-gold-500">
            {user.photo ? (
              <img src={user.photo} alt={user.full_name} className="size-full object-cover" />
            ) : (
              <span className="grid size-full place-items-center text-2xl font-semibold text-ink-950">{initials}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <LiveClock />
            <h1 className="mt-3 font-display text-3xl font-medium text-white sm:text-4xl">
              {greetingFor(now)}, <span className="text-gradient-gold">{user.first_name}</span>
            </h1>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-300/30 bg-gold-300/10 px-3 py-1 font-medium text-gold-200">
                <BadgeCheck className="size-3.5" /> {user.role_label}
              </span>
              <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">Code {user.code}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-slate-300">
                <Mail className="size-3.5" /> {user.email}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-slate-300">
                <Phone className="size-3.5" /> {user.phone}
              </span>
            </div>
          </div>
        </motion.section>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-8 text-center text-sm text-slate-500">
          Your {user.role_label} tools will appear here.
        </motion.p>
      </main>
    </div>
  )
}
