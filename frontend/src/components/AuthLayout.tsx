import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { AnimatedBackdrop } from './AnimatedBackdrop'
import { Brand } from './Brand'
import { LiveClock } from './LiveClock'
import { Showcase } from './Showcase'

const YEAR = new Date().getFullYear()

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-full">
      <AnimatedBackdrop />
      <div className="mx-auto grid min-h-screen max-w-[1440px] lg:grid-cols-[1.1fr_1fr]">
        <aside className="relative hidden border-r border-white/5 lg:block">
          <div className="sticky top-0 h-screen">
            <div className="absolute left-10 top-10 z-10 xl:left-14">
              <Brand />
            </div>
            <div className="h-full pt-16">
              <Showcase />
            </div>
          </div>
        </aside>

        <main className="flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:px-14">
          <header className="flex items-center justify-between lg:hidden">
            <Brand />
          </header>
          <div className="mt-4 lg:hidden">
            <LiveClock />
          </div>
          <div className="flex flex-1 items-center justify-center py-10">
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="glass w-full max-w-[460px] rounded-[28px] p-6 sm:p-9"
            >
              {children}
            </motion.div>
          </div>
          <footer className="text-center text-xs text-slate-500">
            © {YEAR} Haven Stays · Secure employee access
          </footer>
        </main>
      </div>
    </div>
  )
}
