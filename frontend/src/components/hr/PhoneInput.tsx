import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { COUNTRIES, DEFAULT_COUNTRY, flagUrl, type Country } from '../../lib/countries'
import type { WorkspaceTheme } from '../../lib/workspaces'

function Flag({ c }: { c: Country }) {
  return (
    <span className="relative inline-flex w-5 shrink-0 items-center justify-center overflow-hidden rounded-[2px] text-sm leading-none">
      <span aria-hidden>{c.flag}</span>
      <img
        src={flagUrl(c.iso)}
        alt=""
        loading="lazy"
        className="absolute inset-0 size-full object-cover"
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />
    </span>
  )
}

interface Props {
  t: WorkspaceTheme
  label?: string
  error?: string
  /** Full number including the +dial prefix, e.g. "+254700000000". */
  value: string
  onChange: (value: string) => void
  required?: boolean
}

function matchCountry(value: string): Country {
  if (!value.startsWith('+')) return DEFAULT_COUNTRY
  const digits = value.slice(1).replace(/\D/g, '')
  let best: Country | null = null
  for (const c of COUNTRIES) {
    if (digits.startsWith(c.dial) && (!best || c.dial.length > best.dial.length)) best = c
  }
  return best ?? DEFAULT_COUNTRY
}

export function PhoneInput({ t, label, error, value, onChange, required }: Props) {
  const [country, setCountry] = useState<Country>(() => matchCountry(value))
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const prefix = `+${country.dial}`
  const local = value.startsWith(prefix) ? value.slice(prefix.length) : ''

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 30)
  }, [open])

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\+/, '')
    if (!q) return COUNTRIES
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.iso.toLowerCase().includes(q) || c.dial.startsWith(q))
  }, [query])

  const choose = (c: Country) => {
    setCountry(c)
    close()
    onChange(`+${c.dial}${local}`)
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      {label && <span className={`text-[11px] font-medium ${t.muted}`}>{label}</span>}
      <div
        className={`relative flex h-10 w-full min-w-0 items-stretch transition focus-within:ring-2 ${t.radius} ${t.chip} ${t.ring} ${
          error ? 'ring-1 ring-rose-500/60' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => (open ? close() : setOpen(true))}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Select country code"
          className={`flex shrink-0 items-center gap-1.5 border-r border-inherit px-2.5 text-sm ${t.muted}`}
        >
          <Flag c={country} />
          <span className="font-medium">+{country.dial}</span>
          <ChevronDown className={`size-3.5 opacity-60 transition ${open ? 'rotate-180' : ''}`} />
        </button>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required={required}
          value={local}
          placeholder="700 000 000"
          onChange={(e) => onChange(prefix + e.target.value.replace(/[^\d\s-]/g, ''))}
          className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none [color-scheme:light] dark:[color-scheme:dark]"
        />
        <AnimatePresence>
          {open && (
            <>
              <button
                type="button"
                tabIndex={-1}
                aria-label="Close country list"
                onClick={close}
                className="fixed inset-0 z-20 cursor-default"
              />
              <motion.div
                role="listbox"
                aria-label="Country code"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className={`absolute left-0 top-full z-30 mt-1 w-72 max-w-[calc(100vw-3rem)] overflow-hidden shadow-xl ${t.radius} ${t.card}`}
              >
                <div className="flex items-center gap-2 border-b border-slate-900/10 px-3 py-2 dark:border-white/10">
                  <Search className={`size-3.5 shrink-0 ${t.muted}`} />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search country or code"
                    className="w-full min-w-0 bg-transparent text-sm outline-none [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>
                <ul className="max-h-60 overflow-y-auto py-1">
                  {filtered.map((c) => (
                    <li key={c.iso}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={c.iso === country.iso}
                        onClick={() => choose(c)}
                        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition hover:bg-slate-900/5 dark:hover:bg-white/5"
                      >
                        <Flag c={c} />
                        <span className="min-w-0 flex-1 truncate">{c.name}</span>
                        <span className={`text-xs ${t.muted}`}>+{c.dial}</span>
                        {c.iso === country.iso && <Check className="size-3.5 shrink-0" />}
                      </button>
                    </li>
                  ))}
                  {!filtered.length && <li className={`px-3 py-4 text-center text-xs ${t.muted}`}>No country matches “{query}”.</li>}
                </ul>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
      {error && <span className="text-[11px] text-rose-500">{error}</span>}
    </div>
  )
}
