import { Link } from 'react-router-dom'

export function Brand({ className = '' }: { className?: string }) {
  return (
    <Link to="/login" className={`group inline-flex items-center gap-3 ${className}`}>
      <span className="relative grid size-10 place-items-center rounded-xl bg-gradient-to-br from-gold-300 to-gold-500 shadow-lg shadow-gold-500/30 transition-transform duration-300 group-hover:rotate-6">
        <svg viewBox="0 0 24 24" className="size-5 text-ink-950" fill="currentColor" aria-hidden>
          <path d="M3 11.2 12 3l9 8.2V20a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1z" />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block font-display text-xl font-semibold tracking-tight text-white">Haven Stays</span>
        <span className="block text-[11px] font-medium uppercase tracking-[0.28em] text-gold-300/80">BnB Suite</span>
      </span>
    </Link>
  )
}
