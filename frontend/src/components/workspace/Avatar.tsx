import type { Employee } from '../../lib/api'

export function Avatar({ user, className = '', ring = '' }: { user: Employee; className?: string; ring?: string }) {
  const initials = `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase()
  return (
    <span className={`relative inline-grid shrink-0 place-items-center overflow-hidden ring-2 ${ring} ${className}`}>
      {user.photo ? (
        <img src={user.photo} alt={user.full_name} className="size-full object-cover" />
      ) : (
        <span className="grid size-full place-items-center bg-gradient-to-br from-slate-400 to-slate-600 text-sm font-semibold text-white">
          {initials}
        </span>
      )}
    </span>
  )
}
