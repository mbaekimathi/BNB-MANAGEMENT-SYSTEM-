import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { BedDouble, ConciergeBell, KeyRound, Luggage, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

const LINES = [
  'Fluffing the pillows…',
  'Warming up the welcome…',
  'Finding the good towels…',
  'Charging your suite key…',
  'Bribing the Wi-Fi…',
  'Polishing the doorknobs…',
  'Convincing the lift to hurry…',
]

const FLOATERS = [
  { Icon: KeyRound, x: -78, y: -46, delay: 0 },
  { Icon: BedDouble, x: 84, y: -30, delay: 0.9 },
  { Icon: Luggage, x: -66, y: 52, delay: 1.7 },
  { Icon: Sparkles, x: 74, y: 58, delay: 2.4 },
]

/** Full-screen "preparing your stay" loader — 3D suite key, concierge bell, witty progress. */
export function PageLoader({ label = 'Haven Stays' }: { label?: string }) {
  const reduce = useReducedMotion()
  const [i, setI] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % LINES.length), 1900)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f5f2ec] dark:bg-ink-950"
    >
      {/* ambient glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 size-[46vmax] -translate-x-1/2 -translate-y-1/2 animate-aurora rounded-full bg-[radial-gradient(circle_at_center,rgba(233,185,100,0.22),transparent_60%)] blur-3xl dark:bg-[radial-gradient(circle_at_center,rgba(233,185,100,0.16),transparent_60%)]" />
        <div className="absolute bottom-[-10%] right-[8%] size-[34vmax] animate-aurora rounded-full bg-[radial-gradient(circle_at_center,rgba(56,97,251,0.10),transparent_60%)] blur-3xl [animation-delay:-7s]" />
        <div className="grid-pattern absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_72%)]" />
      </div>

      <div className="relative flex flex-col items-center gap-7 px-6">
        {/* ── 3D stage ─────────────────────────────── */}
        <div className="relative [perspective:1100px]">
          {/* tilted orbit ring */}
          <motion.div
            aria-hidden
            className="absolute -inset-9 rounded-full border border-dashed border-gold-500/40 dark:border-gold-300/25"
            style={{ rotateX: 68 }}
            animate={reduce ? undefined : { rotateZ: 360 }}
            transition={{ repeat: Infinity, duration: 14, ease: 'linear' }}
          >
            <span className="absolute left-1/2 top-0 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-400 shadow-[0_0_10px_2px_rgba(233,185,100,0.8)]" />
            <span className="absolute bottom-0 left-1/2 size-1 -translate-x-1/2 translate-y-1/2 rounded-full bg-gold-300/80" />
          </motion.div>

          {/* halo */}
          <motion.div
            aria-hidden
            className="absolute inset-0 -z-10 scale-150 rounded-full bg-[radial-gradient(circle_at_center,rgba(233,185,100,0.35),transparent_65%)] blur-2xl"
            animate={reduce ? undefined : { opacity: [0.5, 0.9, 0.5], scale: [1.35, 1.55, 1.35] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          />

          {/* wandering prop icons */}
          {FLOATERS.map(({ Icon, x, y, delay }) => (
            <motion.span
              key={x}
              aria-hidden
              className="absolute left-1/2 top-1/2 text-gold-500/70 dark:text-gold-300/60"
              style={{ x, y }}
              animate={
                reduce
                  ? undefined
                  : { y: [y, y - 12, y], rotate: [0, 10, -8, 0], opacity: [0.35, 0.85, 0.35] }
              }
              transition={{ repeat: Infinity, duration: 3.4, delay, ease: 'easeInOut' }}
            >
              <Icon className="size-5" />
            </motion.span>
          ))}

          {/* floating + flipping key card */}
          <motion.div
            animate={reduce ? undefined : { y: [0, -10, 0], rotateZ: [0, -1.5, 1.5, 0] }}
            transition={{ repeat: Infinity, duration: 3.6, ease: 'easeInOut' }}
          >
            <motion.div
              className="relative h-24 w-40 [transform-style:preserve-3d]"
              animate={reduce ? undefined : { rotateY: [0, 0, 180, 180, 360] }}
              transition={{ repeat: Infinity, duration: 4.6, times: [0, 0.32, 0.5, 0.82, 1], ease: 'easeInOut' }}
            >
              {/* front — gold key card */}
              <div className="absolute inset-0 flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-gold-200 via-gold-400 to-gold-500 p-3 text-ink-950 shadow-2xl shadow-gold-500/40 [backface-visibility:hidden]">
                <div className="flex items-center justify-between">
                  <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
                    <path d="M3 11.2 12 3l9 8.2V20a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1z" />
                  </svg>
                  <span className="text-[9px] font-bold uppercase tracking-[0.3em]">Suite key</span>
                </div>
                <div className="flex items-end justify-between">
                  <span className="grid size-7 grid-cols-3 gap-px rounded-md bg-ink-950/85 p-1">
                    {Array.from({ length: 6 }).map((_, n) => (
                      <span key={n} className="rounded-[1px] bg-gold-300/90" />
                    ))}
                  </span>
                  <span className="font-display text-sm font-semibold italic">Haven</span>
                </div>
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.55)_45%,transparent_60%)] bg-[length:220%_100%] animate-shimmer" />
              </div>

              {/* back — dark side with mag stripe */}
              <div className="absolute inset-0 flex flex-col overflow-hidden rounded-2xl bg-ink-900 shadow-2xl shadow-black/40 ring-1 ring-white/10 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <div className="mt-3 h-4 w-full bg-gradient-to-r from-ink-700 via-ink-800 to-ink-700" />
                <div className="flex flex-1 items-center justify-between px-3">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.28em] text-gold-300/90">
                    Tap to unlock
                  </span>
                  <KeyRound className="size-4 text-gold-400" />
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* floor shadow */}
          <motion.div
            aria-hidden
            className="absolute -bottom-12 left-1/2 h-3 w-28 -translate-x-1/2 rounded-full bg-ink-950/25 blur-md dark:bg-black/50"
            animate={reduce ? undefined : { scaleX: [1, 0.78, 1], opacity: [0.5, 0.28, 0.5] }}
            transition={{ repeat: Infinity, duration: 3.6, ease: 'easeInOut' }}
          />
        </div>

        {/* ── brand ────────────────────────────────── */}
        <div className="mt-8 text-center">
          <p className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{label}</p>
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.34em] text-gold-500 dark:text-gold-300/80">
            BnB Suite
          </p>
        </div>

        {/* ── concierge bell + witty line ──────────── */}
        <div className="flex h-6 items-center gap-2.5">
          <motion.span
            key={`bell-${i}`}
            className="text-gold-500 dark:text-gold-300"
            animate={reduce ? undefined : { rotate: [0, -22, 14, -7, 0], scale: [1, 1.2, 1] }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          >
            <ConciergeBell className="size-4" />
          </motion.span>
          <AnimatePresence mode="wait">
            <motion.p
              key={i}
              initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
              transition={{ duration: 0.3 }}
              className="w-52 text-center text-sm text-slate-500 dark:text-slate-400"
            >
              {LINES[i]}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* ── progress sweep ───────────────────────── */}
        <div className="h-1 w-56 overflow-hidden rounded-full bg-slate-900/10 dark:bg-white/10">
          <motion.div
            className="h-full w-1/3 rounded-full bg-gradient-to-r from-gold-300 via-gold-400 to-gold-500"
            animate={{ x: ['-110%', '320%'] }}
            transition={{ repeat: Infinity, duration: 1.35, ease: 'easeInOut' }}
          />
        </div>
      </div>

      <p className="absolute bottom-5 text-[10px] uppercase tracking-[0.3em] text-slate-400/80 dark:text-slate-600">
        Front desk is on it
      </p>
    </div>
  )
}
