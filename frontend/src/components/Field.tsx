import { AnimatePresence, motion } from 'framer-motion'
import { Eye, EyeOff, type LucideIcon } from 'lucide-react'
import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  icon: LucideIcon
  error?: string
  trailing?: ReactNode
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, icon: Icon, error, type = 'text', trailing, className = '', ...props },
  ref,
) {
  const id = useId()
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className={className}>
      <div
        className={`group relative flex items-center rounded-2xl border bg-slate-900/[0.03] transition-all duration-300 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(233,185,100,0.18)] dark:bg-white/[0.03] dark:focus-within:bg-white/[0.06] dark:focus-within:shadow-[0_0_0_4px_rgba(233,185,100,0.12)] ${
          error ? 'border-rose-400/60' : 'border-slate-300 hover:border-slate-400 focus-within:border-gold-400/70 dark:border-white/10 dark:hover:border-white/20'
        }`}
      >
        <Icon className="ml-4 size-[18px] shrink-0 text-slate-400 transition-colors group-focus-within:text-gold-500 dark:group-focus-within:text-gold-300" aria-hidden />
        <input
          ref={ref}
          id={id}
          type={isPassword && show ? 'text' : type}
          placeholder=" "
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="peer h-14 w-full bg-transparent px-3 pt-4 text-[15px] text-slate-900 outline-none placeholder:text-transparent dark:text-white"
          {...props}
        />
        <label
          htmlFor={id}
          className="pointer-events-none absolute left-11 top-1/2 -translate-y-1/2 px-1 text-[15px] text-slate-500 transition-all duration-200 peer-focus:top-3.5 peer-focus:text-[11px] peer-focus:tracking-wide peer-focus:text-gold-500 peer-[:not(:placeholder-shown)]:top-3.5 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:tracking-wide dark:text-slate-400 dark:peer-focus:text-gold-300"
        >
          {label}
        </label>
        {isPassword ? (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="mr-3 grid size-9 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-900 dark:hover:bg-white/5 dark:hover:text-white"
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        ) : (
          trailing
        )}
      </div>
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            id={`${id}-error`}
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            className="overflow-hidden pl-2 pt-1.5 text-xs text-rose-500 dark:text-rose-300"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
})
