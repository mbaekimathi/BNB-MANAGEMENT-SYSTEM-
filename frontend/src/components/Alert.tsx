import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

export function Alert({ message, tone = 'error' }: { message?: string; tone?: 'error' | 'success' }) {
  const Icon = tone === 'error' ? AlertCircle : CheckCircle2
  return (
    <AnimatePresence mode="wait">
      {message && (
        <motion.div
          key={message}
          role={tone === 'error' ? 'alert' : 'status'}
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1, x: tone === 'error' ? [0, -6, 6, -3, 3, 0] : 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4 }}
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
            tone === 'error'
              ? 'border-rose-400/30 bg-rose-500/10 text-rose-700 dark:text-rose-100'
              : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-100'
          }`}
        >
          <Icon className="mt-0.5 size-4 shrink-0" />
          <span>{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
