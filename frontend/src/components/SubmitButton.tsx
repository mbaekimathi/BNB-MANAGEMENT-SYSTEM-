import { motion } from 'framer-motion'
import { ArrowRight, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

export function SubmitButton({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <motion.button
      type="submit"
      disabled={loading}
      whileHover={{ scale: loading ? 1 : 1.01 }}
      whileTap={{ scale: loading ? 1 : 0.98 }}
      className="group relative flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500 font-semibold text-ink-950 shadow-xl shadow-gold-500/25 transition-shadow hover:shadow-gold-500/40 disabled:cursor-wait disabled:opacity-80"
    >
      <span className="absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.45)_50%,transparent_75%)] bg-[length:200%_100%] opacity-0 transition-opacity group-hover:opacity-100" />
      <span className="relative flex items-center gap-2">
        {loading ? <Loader2 className="size-5 animate-spin" /> : children}
        {!loading && <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />}
      </span>
    </motion.button>
  )
}
