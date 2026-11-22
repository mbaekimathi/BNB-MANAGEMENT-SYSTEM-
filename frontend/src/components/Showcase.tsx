import { AnimatePresence, motion } from 'framer-motion'
import { BedDouble, CalendarCheck2, ShieldCheck, Sparkles, Users, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { LiveClock } from './LiveClock'

const highlights = [
  { icon: CalendarCheck2, title: 'Reservations & calendar', text: 'Every booking, check-in and check-out on one live calendar.' },
  { icon: Sparkles, title: 'Housekeeping', text: 'Room status updates the moment a room is cleaned and ready.' },
  { icon: Wallet, title: 'Payments', text: 'Deposits, balances and receipts tracked for every stay.' },
  { icon: Users, title: 'Your whole team', text: 'Front desk, housekeeping, maintenance and managers — each with the right access.' },
]

const rooms = [
  { name: 'Garden Suite', state: 'Occupied', tone: 'bg-gold-400' },
  { name: 'Ocean View', state: 'Ready', tone: 'bg-emerald-400' },
  { name: 'Loft 2B', state: 'Cleaning', tone: 'bg-sky-400' },
]

export function Showcase() {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % highlights.length), 4500)
    return () => clearInterval(t)
  }, [])
  const current = highlights[index]

  return (
    <div className="relative flex h-full flex-col justify-between gap-10 p-10 xl:p-14">
      <LiveClock />

      <div className="relative">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold-300/20 bg-gold-300/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-gold-200"
        >
          <ShieldCheck className="size-3.5" /> Employee portal
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-xl font-display text-5xl font-medium leading-[1.05] tracking-tight text-white xl:text-6xl"
        >
          Every stay, <span className="italic text-gradient-gold">beautifully</span> run.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7 }}
          className="mt-5 max-w-md text-base leading-relaxed text-slate-400"
        >
          The command centre for your BnB — bookings, rooms, guests and team, all in one place.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative mt-10 max-w-md"
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="glass rounded-3xl p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-medium text-white">
                <BedDouble className="size-4 text-gold-300" /> Room board
              </span>
              <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">Live</span>
            </div>
            <ul className="space-y-2.5">
              {rooms.map((r, i) => (
                <motion.li
                  key={r.name}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + i * 0.12 }}
                  className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm"
                >
                  <span className="text-slate-200">{r.name}</span>
                  <span className="flex items-center gap-2 text-xs text-slate-400">
                    <span className={`size-1.5 rounded-full ${r.tone}`} /> {r.state}
                  </span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            className="glass absolute -right-6 -top-8 hidden rounded-2xl px-4 py-3 xl:block"
          >
            <p className="text-[11px] uppercase tracking-wider text-slate-400">Next check-in</p>
            <p className="mt-0.5 text-sm font-medium text-white">2:00 PM · Garden Suite</p>
          </motion.div>
        </motion.div>
      </div>

      <div className="min-h-[88px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.45 }}
            className="flex max-w-md items-start gap-4"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5">
              <current.icon className="size-5 text-gold-300" />
            </span>
            <div>
              <p className="font-medium text-white">{current.title}</p>
              <p className="mt-1 text-sm text-slate-400">{current.text}</p>
            </div>
          </motion.div>
        </AnimatePresence>
        <div className="mt-5 flex gap-2">
          {highlights.map((h, i) => (
            <button
              key={h.title}
              onClick={() => setIndex(i)}
              aria-label={h.title}
              className={`h-1 rounded-full transition-all duration-500 ${i === index ? 'w-8 bg-gold-300' : 'w-3 bg-white/20 hover:bg-white/40'}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
