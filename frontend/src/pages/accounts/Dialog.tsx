import { motion } from 'framer-motion'
import { Lock, X, type LucideIcon } from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import { Button, Flash } from '../../components/hr/ui'
import type { WorkspaceTheme } from '../../lib/workspaces'

/** Shared dialog shell (same look as the ticket popup). */
export function Dialog({ t, title, text, icon: Icon, onClose, onSubmit, children, footer }: {
  t: WorkspaceTheme
  title: string
  text: string
  icon: LucideIcon
  onClose: () => void
  onSubmit: (e: FormEvent) => void
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <motion.div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
      <motion.form
        onSubmit={onSubmit}
        role="dialog" aria-modal="true" aria-label={title}
        initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className={`relative my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden shadow-2xl ${t.radius} ${t.root}`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-900/10 px-5 py-4 dark:border-white/10">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid size-10 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <h3 className={`truncate text-base ${t.heading}`}>{title}</h3>
              <p className={`text-xs ${t.muted}`}>{text}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={`grid size-9 shrink-0 place-items-center ${t.radius} ${t.iconButton}`}>
            <X className="size-4" />
          </button>
        </header>
        {children}
        {footer}
      </motion.form>
    </motion.div>
  )
}

/** Shown when a register link is hit but this user can't register — either the
 *  till is closed (nobody holds a session) or another receptionist's session is
 *  open (`owner`), which puts this user in view-only mode. */
export function TillGateDialog({ t, onClose, owner }: { t: WorkspaceTheme; onClose: () => void; owner?: string | null }) {
  return (
    <Dialog t={t}
      title={owner ? 'View only' : 'Till closed'}
      text={owner ? `${owner} has the till open` : 'Records are tied to a till session'}
      icon={Lock}
      onClose={onClose} onSubmit={(e) => { e.preventDefault(); onClose() }}
      footer={
        <footer className="border-t border-slate-900/10 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/10">
          <div className="flex items-center justify-end">
            <Button t={t} type="submit">Got it</Button>
          </div>
        </footer>
      }>
      <p className={`px-5 py-5 text-sm ${t.muted}`}>
        {owner
          ? `${owner} opened the till — you can look around but can't change anything until they close it.`
          : 'Open the till on the Counter page first — once a session is open you can register here, and the record is filed under that session.'}
      </p>
    </Dialog>
  )
}

export function DialogFooter({ t, message, onClose, busy, submitLabel }: {
  t: WorkspaceTheme
  message: string
  onClose: () => void
  busy: boolean
  submitLabel: string
}) {
  return (
    <footer className="space-y-3 border-t border-slate-900/10 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-white/10">
      <Flash message={message} tone="red" />
      <div className="flex items-center justify-end gap-2">
        <Button t={t} variant="ghost" onClick={onClose}>Cancel</Button>
        <Button t={t} type="submit" busy={busy}>{submitLabel}</Button>
      </div>
    </footer>
  )
}
