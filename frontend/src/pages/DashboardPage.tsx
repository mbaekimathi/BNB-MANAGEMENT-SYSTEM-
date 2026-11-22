import { motion } from 'framer-motion'
import { LogOut } from 'lucide-react'
import { AnimatedBackdrop } from '../components/AnimatedBackdrop'
import { Brand } from '../components/Brand'
import { LiveClock } from '../components/LiveClock'
import { greetingFor, useNow } from '../lib/time'
import { useAuth } from '../context/AuthContext'

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const now = useNow(60_000)
  if (!user) return null
  return (
    <div className="min-h-screen">
      <AnimatedBackdrop />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Brand />
        <button
          onClick={logout}
          className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-white/25 hover:text-white"
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-8">
          <LiveClock />
          <h1 className="mt-6 font-display text-4xl font-medium text-white">
            {greetingFor(now)}, <span className="text-gradient-gold">{user.first_name || user.email}</span>
          </h1>
          <p className="mt-3 text-slate-400">
            Signed in as {user.role_label} · {user.employee_id}
          </p>
          <p className="mt-8 text-sm text-slate-500">The dashboard modules will appear here.</p>
        </motion.div>
      </main>
    </div>
  )
}
