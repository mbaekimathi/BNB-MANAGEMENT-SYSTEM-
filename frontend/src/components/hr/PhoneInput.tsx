import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Phone, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { COUNTRIES, DEFAULT_COUNTRY, dialCountry, flagUrl, subscriberLength, type Country } from '../../lib/countries'
import type { WorkspaceTheme } from '../../lib/workspaces'

export function Flag({ c }: { c: Country }) {
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
  return dialCountry(value) ?? DEFAULT_COUNTRY
}

/** Canonical "+dial<subscriber>" for free-typed input. A long enough entry that opens
 *  with a real dial code is kept under that code — a wrongly-input "254…" under +254
 *  folds to "+254…", "1 555…" lands under +1. Anything else is a local number for the
 *  picked country: the trunk 0 drops ("0795…" → "+254 795…"). */
function canonValue(fallbackDial: string, raw: string): string {
  const digits = raw.replace(/\D/g, '')
  let best = ''
  for (const c of COUNTRIES) if (digits.startsWith(c.dial) && c.dial.length > best.length) best = c.dial
  // 10+ digits is longer than any local subscriber — safe to read as international.
  const intl = !!best && digits.length >= 10 && digits.length - best.length >= 6
  const d = (intl ? digits.slice(best.length) : digits).replace(/^0+/, '')
  return d ? `+${intl ? best : fallbackDial}${d}` : ''
}

export function PhoneInput({ t, label, error, value, onChange, required }: Props) {
  const [country, setCountry] = useState<Country>(() => matchCountry(value))
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const prefix = `+${country.dial}`
  const local = value.startsWith(prefix) ? value.slice(prefix.length) : value.startsWith('+') ? '' : value

  // Cap the subscriber at the country's correct length — extra digits can't be
  // typed. A leading trunk 0 doesn't count ("0700…" still types, then the blur
  // canonicaliser folds it into the subscriber).
  const emit = (raw: string) => {
    const max = subscriberLength(country)
    let out = '', n = 0, leading = true
    for (const ch of raw) {
      if (/\d/.test(ch)) {
        if (leading && ch === '0') { out += ch; continue }
        leading = false
        if (++n > max) continue
      }
      out += ch
    }
    onChange(out.replace(/\D/g, '') ? `${prefix}${out}` : '')
  }

  // The flag follows the value's +dial code — an autofilled +256 number shows Uganda.
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    const c = matchCountry(value)
    if (c.iso !== country.iso) setCountry(c)
  }

  // The stored value is always international: a bare local number (e.g. autofilled
  // from an old booking) is filed under the selected code.
  useEffect(() => {
    if (!value || value.startsWith('+')) return
    const next = canonValue(country.dial, value)
    if (next !== value) onChange(next)
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps -- resync on value changes only

  // Once typing is done, rewrite a wrongly-input entry in canonical +dial<subscriber>
  // form — "0795…" or "254…" under +254 both land as "+254795…".
  const done = () => {
    const next = canonValue(country.dial, local)
    if (next !== value) onChange(next)
  }

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
    onChange(canonValue(c.dial, local))
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      {label && <span className={`text-[11px] font-medium ${t.muted}`}>{label}</span>}
      <div
        className={`relative flex w-full min-w-0 flex-col transition focus-within:ring-2 sm:h-10 sm:flex-row sm:items-stretch ${t.radius} ${t.chip} ${t.ring} ${
          error ? 'ring-1 ring-rose-500/60' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => (open ? close() : setOpen(true))}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Select country code"
          className={`flex h-10 shrink-0 items-center gap-1.5 border-b border-inherit px-2.5 text-sm max-sm:bg-black/[0.04] max-sm:dark:bg-white/[0.04] sm:h-auto sm:border-b-0 sm:border-r ${t.muted}`}
        >
          <Flag c={country} />
          <span className="font-medium">+{country.dial}</span>
          <span className="min-w-0 flex-1 truncate text-left text-xs opacity-70 sm:hidden">{country.name}</span>
          <ChevronDown className={`size-3.5 opacity-60 transition ${open ? 'rotate-180' : ''} ml-auto sm:ml-0`} />
        </button>
        <div className="flex h-10 min-w-0 flex-1 items-stretch sm:h-auto">
          <span className={`grid w-8 shrink-0 place-items-center sm:hidden ${t.muted}`}>
            <Phone className="size-4" />
          </span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            required={required}
            value={local}
            placeholder="700 000 000"
            onChange={(e) => emit(e.target.value.replace(/[^\d\s-]/g, ''))}
            onBlur={done}
            className="min-w-0 flex-1 bg-transparent pr-3 text-sm outline-none sm:px-3 [color-scheme:light] dark:[color-scheme:dark]"
          />
        </div>
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
