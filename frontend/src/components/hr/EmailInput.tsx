import { AnimatePresence, motion } from 'framer-motion'
import { AtSign, Check, ChevronDown, Cloud, Mail, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import type { WorkspaceTheme } from '../../lib/workspaces'

interface Provider {
  domain: string
  name: string
  cls: string
  letter?: string
  icon?: LucideIcon
}

const PROVIDERS: Provider[] = [
  { domain: 'gmail.com', name: 'Gmail', letter: 'M', cls: 'bg-[#ea4335]' },
  { domain: 'yahoo.com', name: 'Yahoo', letter: 'Y!', cls: 'bg-[#6001d2]' },
  { domain: 'outlook.com', name: 'Outlook', letter: 'O', cls: 'bg-[#0078d4]' },
  { domain: 'icloud.com', name: 'iCloud', icon: Cloud, cls: 'bg-sky-500' },
]

/** New locals land on Gmail — the common case takes zero extra clicks, and the
 *  chip always shows which domain will be used. */
const DEFAULT_DOMAIN = PROVIDERS[0].domain

const providerFor = (domain: string) => PROVIDERS.find((p) => p.domain === domain.toLowerCase())

function Mark({ p }: { p: Provider }) {
  return (
    <span className={`grid size-5 shrink-0 place-items-center rounded text-[10px] font-bold leading-none text-white ${p.cls}`}>
      {p.icon ? <p.icon className="size-3.5" /> : p.letter}
    </span>
  )
}

/** `value` split at the first "@": the collapsed field shows only `local`, the
 *  domain lives on the provider chip. */
const splitEmail = (value: string) => {
  const at = value.indexOf('@')
  return at < 0
    ? { local: value, domain: '' }
    : { local: value.slice(0, at), domain: value.slice(at + 1) }
}

interface Props {
  t: WorkspaceTheme
  label?: string
  error?: string
  /** Full address ("name@domain"); the field itself only ever shows the name part. */
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
}

export function EmailInput({ t, label, error, value, onChange, placeholder = 'username', required }: Props) {
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  // The domain outlives an empty field: pick Yahoo, then type — "name" becomes
  // "name@yahoo.com". A domain typed into the field itself always wins.
  const [picked, setPicked] = useState('')
  const { local, domain } = splitEmail(value)
  const eff = domain.toLowerCase() || picked || DEFAULT_DOMAIN
  const known = providerFor(eff)
  const current: Provider = known ?? { domain: eff, name: eff, icon: Mail, cls: 'bg-slate-500 dark:bg-slate-600' }

  /** While the field is focused it behaves like a normal email box so a domain
   *  can be typed through. Completing a known provider's domain ("…@gmail.com")
   *  snaps it off at once; anything left leaves on blur — the "@…" clears and
   *  only the credentials stay, with the domain parked on the chip. */
  const shown = focused ? value : local

  const emit = (l: string, d: string) => {
    const clean = l.trim()
    onChange(clean ? (d ? `${clean}@${d}` : clean) : '')
  }

  const typed = (raw: string) => {
    const s = splitEmail(raw)
    const p = s.domain ? providerFor(s.domain.trim().toLowerCase()) : undefined
    if (p) {
      setPicked('')
      emit(s.local, p.domain)
    } else {
      onChange(raw)
    }
  }

  const choose = (p: Provider) => {
    setPicked(p.domain)
    emit(local, p.domain)
    setOpen(false)
  }

  const blur = () => {
    setFocused(false)
    // Fold a dangling "@" or a fully-typed custom domain into the stored value —
    // and a bare "name" takes the chip's domain so what it shows is what's saved.
    const s = splitEmail(value)
    const d = s.domain.trim().toLowerCase()
    emit(s.local, d || eff)
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      {label && <span className={`text-[11px] font-medium ${t.muted}`}>{label}</span>}
      <div
        className={`relative flex h-10 w-full min-w-0 items-stretch transition focus-within:ring-2 ${t.radius} ${t.chip} ${t.ring} ${
          error ? 'ring-1 ring-rose-500/60' : ''
        }`}
      >
        <span className={`grid w-8 shrink-0 place-items-center ${t.muted}`}>
          <AtSign className="size-4" />
        </span>
        <input
          type="text"
          inputMode="email"
          autoComplete="off"
          required={required}
          value={shown}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={blur}
          onChange={(e) => typed(e.target.value)}
          className="min-w-0 flex-1 bg-transparent pr-3 text-sm outline-none [color-scheme:light] dark:[color-scheme:dark]"
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Select email provider"
          className={`flex shrink-0 items-center gap-1.5 border-l border-inherit px-2.5 text-sm ${t.muted}`}
        >
          <Mark p={current} />
          <span className="font-medium">@{eff}</span>
          <ChevronDown className={`size-3.5 opacity-60 transition ${open ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence>
          {open && (
            <>
              <button
                type="button"
                tabIndex={-1}
                aria-label="Close provider list"
                onClick={() => setOpen(false)}
                className="fixed inset-0 z-20 cursor-default"
              />
              <motion.div
                role="listbox"
                aria-label="Email provider"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className={`absolute right-0 top-full z-30 mt-1 w-64 max-w-[calc(100vw-3rem)] overflow-hidden shadow-xl ${t.radius} ${t.card}`}
              >
                <ul className="max-h-60 overflow-y-auto py-1">
                  {!known && domain.trim() && (
                    <li>
                      <button
                        type="button"
                        role="option"
                        aria-selected
                        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition hover:bg-slate-900/5 dark:hover:bg-white/5"
                      >
                        <Mark p={current} />
                        <span className="min-w-0 flex-1 truncate">@{domain.trim()}</span>
                        <Check className="size-3.5 shrink-0" />
                      </button>
                    </li>
                  )}
                  {PROVIDERS.map((p) => (
                    <li key={p.domain}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={p.domain === eff}
                        onClick={() => choose(p)}
                        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition hover:bg-slate-900/5 dark:hover:bg-white/5"
                      >
                        <Mark p={p} />
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        <span className={`text-xs ${t.muted}`}>@{p.domain}</span>
                        {p.domain === eff && <Check className="size-3.5 shrink-0" />}
                      </button>
                    </li>
                  ))}
                </ul>
                <p className={`border-t border-slate-900/10 px-3 py-2 text-[10px] dark:border-white/10 ${t.muted}`}>
                  Another provider? Type it as name@domain.com
                </p>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
      {error && <span className="text-[11px] text-rose-500">{error}</span>}
    </div>
  )
}
