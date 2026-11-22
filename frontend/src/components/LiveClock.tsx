import { useNow } from '../lib/time'

export function LiveClock() {
  const now = useNow()
  return (
    <div className="flex items-center gap-3 text-sm text-slate-300">
      <span className="relative flex size-2.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
      </span>
      <span className="font-medium tabular-nums text-white">
        {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
      <span className="text-slate-500">·</span>
      <span>{now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</span>
    </div>
  )
}
