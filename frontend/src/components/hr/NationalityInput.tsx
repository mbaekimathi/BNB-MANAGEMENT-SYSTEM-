import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Globe } from 'lucide-react'
import { useMemo, useState } from 'react'
import { GUEST_ID_TYPES, type GuestIdType } from '../../lib/bnb'
import { COUNTRIES, type Country } from '../../lib/countries'
import type { WorkspaceTheme } from '../../lib/workspaces'
import { Flag } from './PhoneInput'

interface Props {
  t: WorkspaceTheme
  label?: string
  error?: string
  /** The stored nationality — usually a country name, free text still allowed. */
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

/** Country-name filtering shared by both nationality fields. */
function useCountryFilter(value: string) {
  const q = value.trim().toLowerCase()
  const matched = COUNTRIES.find((c) => c.name.toLowerCase() === q)
  const filtered = useMemo(() => {
    if (!q || matched) return COUNTRIES
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.iso.toLowerCase() === q)
  }, [q, matched])
  return { matched, filtered }
}

/** The flag-list dropdown both nationality fields pop open. */
function CountryMenu({ t, open, filtered, matched, typed, onChoose, onClose }: {
  t: WorkspaceTheme
  open: boolean
  filtered: Country[]
  matched: Country | undefined
  typed: string
  onChoose: (name: string) => void
  onClose: () => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close nationality list"
            onClick={onClose}
            className="fixed inset-0 z-20 cursor-default"
          />
          <motion.div
            role="listbox"
            aria-label="Nationality"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className={`absolute left-0 top-full z-30 mt-1 max-h-60 w-full min-w-56 overflow-y-auto shadow-xl ${t.radius} ${t.card}`}
          >
            <ul className="py-1">
              {filtered.map((c) => (
                <li key={c.iso}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={c === matched}
                    onClick={() => onChoose(c.name)}
                    className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition hover:bg-slate-900/5 dark:hover:bg-white/5"
                  >
                    <Flag c={c} />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    {c === matched && <Check className="size-3.5 shrink-0" />}
                  </button>
                </li>
              ))}
              {!filtered.length && <li className={`px-3 py-4 text-center text-xs ${t.muted}`}>No country matches “{typed}”.</li>}
            </ul>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/** Nationality with a flag picker: typing filters the country list and the flag
 *  on the left follows an exact country-name match (a globe stands in for free
 *  text like "Kenyan"). Picking a row stores the country name. */
export function NationalityInput({ t, label, error, value, onChange, placeholder = 'e.g. Kenya' }: Props) {
  const [open, setOpen] = useState(false)
  const { matched, filtered } = useCountryFilter(value)

  const choose = (name: string) => {
    onChange(name)
    setOpen(false)
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
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Pick nationality from list"
          className={`flex shrink-0 items-center gap-1.5 border-r border-inherit px-2.5 text-sm ${t.muted}`}
        >
          {matched ? <Flag c={matched} /> : <Globe className="size-4 opacity-70" />}
          <ChevronDown className={`size-3.5 opacity-60 transition ${open ? 'rotate-180' : ''}`} />
        </button>
        <input
          type="text"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none [color-scheme:light] dark:[color-scheme:dark]"
        />
        <CountryMenu t={t} open={open} filtered={filtered} matched={matched} typed={value.trim()} onChoose={choose} onClose={() => setOpen(false)} />
      </div>
      {error && <span className="text-[11px] text-rose-500">{error}</span>}
    </div>
  )
}

interface NatIdProps {
  t: WorkspaceTheme
  label?: string
  error?: string
  nationality: string
  onNationality: (value: string) => void
  idType: GuestIdType | ''
  onIdType: (value: GuestIdType | '') => void
  idNumber: string
  onIdNumber: (value: string) => void
  /** Extra empty document-type option for editors that allow no ID on file. */
  emptyTypeLabel?: string
}

/** Nationality + ID document + number combined in one space: flag picker and
 *  country text on the left, document type then its number on the right. */
export function NatIdInput({ t, label = 'Nationality & ID', error, nationality, onNationality, idType, onIdType, idNumber, onIdNumber, emptyTypeLabel }: NatIdProps) {
  const [open, setOpen] = useState(false)
  const { matched, filtered } = useCountryFilter(nationality)

  const choose = (name: string) => {
    onNationality(name)
    setOpen(false)
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      {label && <span className={`text-[11px] font-medium ${t.muted}`}>{label}</span>}
      <div
        className={`relative flex w-full min-w-0 flex-col transition focus-within:ring-2 sm:h-10 sm:flex-row sm:items-stretch ${t.radius} ${t.chip} ${t.ring} ${
          error ? 'ring-1 ring-rose-500/60' : ''
        }`}
      >
        <div className="flex h-10 min-w-0 flex-1 items-stretch">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label="Pick nationality from list"
            className={`flex shrink-0 items-center gap-1.5 border-r border-inherit px-2.5 text-sm ${t.muted}`}
          >
            {matched ? <Flag c={matched} /> : <Globe className="size-4 opacity-70" />}
            <ChevronDown className={`size-3.5 opacity-60 transition ${open ? 'rotate-180' : ''}`} />
          </button>
          <input
            type="text"
            autoComplete="off"
            value={nationality}
            placeholder="Nationality"
            aria-label="Nationality"
            onFocus={() => setOpen(true)}
            onChange={(e) => onNationality(e.target.value)}
            className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none [color-scheme:light] dark:[color-scheme:dark]"
          />
        </div>
        <div className="flex h-10 min-w-0 items-stretch border-t border-inherit max-sm:bg-black/[0.04] max-sm:dark:bg-white/[0.04] sm:border-l sm:border-t-0">
          <select
            value={idType}
            onChange={(e) => onIdType(e.target.value as GuestIdType | '')}
            aria-label="ID document type"
            className="shrink-0 bg-transparent px-2 text-sm outline-none [&>option]:bg-white [&>option]:text-slate-900 dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100"
          >
            {emptyTypeLabel !== undefined && <option value="">{emptyTypeLabel}</option>}
            {GUEST_ID_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input
            type="text"
            autoComplete="off"
            value={idNumber}
            placeholder="Number"
            aria-label="ID document number"
            onChange={(e) => onIdNumber(e.target.value)}
            className="min-w-0 flex-1 border-l border-inherit bg-transparent px-3 text-sm outline-none sm:w-32 sm:flex-none"
          />
        </div>
        <CountryMenu t={t} open={open} filtered={filtered} matched={matched} typed={nationality.trim()} onChoose={choose} onClose={() => setOpen(false)} />
      </div>
      {error && <span className="text-[11px] text-rose-500">{error}</span>}
    </div>
  )
}
