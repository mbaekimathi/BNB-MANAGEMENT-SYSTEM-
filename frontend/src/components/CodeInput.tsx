import { AnimatePresence, motion } from 'framer-motion'
import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'

interface CodeInputProps {
  value: string
  onChange: (value: string) => void
  label: string
  error?: string
  autoFocus?: boolean
  length?: number
}

/** Six separate digit boxes that behave like one field (typing, backspace, arrows and paste all work). */
export function CodeInput({ value, onChange, label, error, autoFocus, length = 6 }: CodeInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const digits = Array.from({ length }, (_, i) => value[i] ?? '')

  const focus = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus()

  function setDigit(i: number, d: string) {
    const next = digits.slice()
    next[i] = d
    onChange(next.join('').slice(0, length))
  }

  function onInput(i: number, raw: string) {
    const clean = raw.replace(/\D/g, '')
    if (!clean) return
    if (clean.length > 1) {
      const merged = (value.slice(0, i) + clean).slice(0, length)
      onChange(merged)
      focus(merged.length)
      return
    }
    setDigit(i, clean)
    focus(i + 1)
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[i]) setDigit(i, '')
      else if (i > 0) {
        setDigit(i - 1, '')
        focus(i - 1)
      }
    } else if (e.key === 'ArrowLeft') focus(i - 1)
    else if (e.key === 'ArrowRight') focus(i + 1)
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    e.preventDefault()
    onChange(pasted)
    focus(pasted.length)
  }

  return (
    <div>
      <p className="mb-2 pl-1 text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <div className="flex justify-between gap-2 sm:gap-2.5" role="group" aria-label={label}>
        {digits.map((d, i) => (
          <motion.input
            key={i}
            ref={(el) => {
              refs.current[i] = el
            }}
            value={d}
            onChange={(e) => onInput(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onPaste={onPaste}
            onFocus={(e) => e.target.select()}
            inputMode="numeric"
            autoComplete={i === 0 ? 'username' : 'off'}
            autoFocus={autoFocus && i === 0}
            maxLength={length}
            aria-label={`Digit ${i + 1}`}
            aria-invalid={Boolean(error)}
            animate={d ? { scale: [1, 1.08, 1] } : { scale: 1 }}
            transition={{ duration: 0.2 }}
            className={`h-14 w-full min-w-0 rounded-2xl border bg-white/[0.03] text-center text-xl font-semibold tabular-nums text-white outline-none transition-all duration-200 focus:bg-white/[0.06] focus:shadow-[0_0_0_4px_rgba(233,185,100,0.12)] sm:h-16 sm:text-2xl ${
              error
                ? 'border-rose-400/60'
                : d
                  ? 'border-gold-400/50 focus:border-gold-400/80'
                  : 'border-white/10 hover:border-white/20 focus:border-gold-400/70'
            }`}
          />
        ))}
      </div>
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden pl-2 pt-1.5 text-xs text-rose-300"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
