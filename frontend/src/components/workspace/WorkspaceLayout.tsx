import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Calculator, ChevronDown, LayoutDashboard, Lock, LogIn, LogOut, Menu, MoreHorizontal, Plus, Timer, UserCircle, X, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { ThemeToggle } from '../ThemeToggle'
import { parseApiError, type Employee } from '../../lib/api'
import { bnb } from '../../lib/bnb'
import { hr, useApi, type ClockAction } from '../../lib/hr'
import { useNow } from '../../lib/time'
import { PROFILE_ITEM, type NavItem, type Workspace } from '../../lib/workspaces'
import { Avatar } from './Avatar'

/** An in-page section the sidebar links to by anchor — the client portal's
 *  sections replace the nav links while a portal is open. */
export interface SidebarAnchor {
  id: string
  label: string
  icon: LucideIcon
}

interface Props {
  workspace: Workspace
  user: Employee
  basePath: string
  active: NavItem
  /** Set when inside a section that has its own sub-pages. */
  module?: NavItem
  /** Set on account pages (profile, settings) outside the workspace nav. */
  account?: boolean
  /** Set on a module's sub-pages — the sidebar then shows only the back
   *  link, since nav links live on the module's landing page. */
  hideLinks?: boolean
  /** Anchor links into the page's own sections — they take over the sidebar's
   *  link list when set (client portal sections). */
  anchors?: SidebarAnchor[]
  onLogout: () => void
  children: ReactNode
}

const YEAR = new Date().getFullYear()

const href = (basePath: string, item: NavItem) => (item.slug ? `${basePath}/${item.slug}` : basePath)

function BrandMark({ workspace, basePath, compact }: { workspace: Workspace; basePath: string; compact?: boolean }) {
  const t = workspace.theme
  return (
    <Link to={basePath} className="group flex items-center gap-3">
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:rotate-6 ${t.brandMark}`}>
        <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
          <path d="M3 11.2 12 3l9 8.2V20a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1z" />
        </svg>
      </span>
      <span className={`leading-tight ${compact ? 'md:max-lg:hidden' : ''}`}>
        <span className={`block text-lg font-semibold tracking-tight ${t.brandText}`}>Haven Stays</span>
        <span className={`block text-[10px] font-medium uppercase tracking-[0.25em] ${t.brandSub}`}>{t.name}</span>
      </span>
    </Link>
  )
}

function NavLinks({ workspace, items, basePath, active, rail, onNavigate }: {
  workspace: Workspace
  items: NavItem[]
  basePath: string
  active: NavItem
  rail?: boolean
  onNavigate?: () => void
}) {
  const t = workspace.theme
  return (
    <nav className="flex flex-col gap-1.5">
      {items.map((item, i) => {
        const isActive = item.slug === active.slug
        return (
          <motion.div
            key={`${basePath}/${item.slug}`}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 + i * 0.04, duration: 0.35 }}
          >
            <Link
              to={href(basePath, item)}
              onClick={onNavigate}
              aria-current={isActive ? 'page' : undefined}
              className={`group relative flex items-center gap-3 px-3 py-2.5 text-sm transition-all duration-200 ${t.radius} ${
                rail ? 'md:max-lg:justify-center md:max-lg:px-0' : ''
              } ${isActive ? t.navActive : t.navIdle}`}
            >
              <item.icon className="size-[18px] shrink-0" />
              <span className={rail ? 'md:max-lg:hidden' : ''}>{item.label}</span>
              {rail && (
                <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 font-sans text-xs font-medium text-white shadow-xl md:max-lg:group-hover:block">
                  {item.label}
                </span>
              )}
            </Link>
          </motion.div>
        )
      })}
    </nav>
  )
}

/** In-page section links for the sidebar — hash navigations through the
 *  router, so the page can open them as sheets. Same styling and entrance
 *  animation as the nav links. */
function AnchorLinks({ items, t, rail, onNavigate }: {
  items: SidebarAnchor[]
  t: Workspace['theme']
  rail?: boolean
  onNavigate?: () => void
}) {
  return (
    <nav className="flex flex-col gap-1.5">
      {items.map((a, i) => (
        <motion.div
          key={a.id}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 + i * 0.04, duration: 0.35 }}
        >
          <Link
            to={`#${a.id}`}
            onClick={onNavigate}
            className={`group relative flex items-center gap-3 px-3 py-2.5 text-sm transition-all duration-200 ${t.radius} ${
              rail ? 'md:max-lg:justify-center md:max-lg:px-0' : ''
            } ${t.navIdle}`}
          >
            <a.icon className="size-[18px] shrink-0" />
            <span className={rail ? 'md:max-lg:hidden' : ''}>{a.label}</span>
            {rail && (
              <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 font-sans text-xs font-medium text-white shadow-xl md:max-lg:group-hover:block">
                {a.label}
              </span>
            )}
          </Link>
        </motion.div>
      ))}
    </nav>
  )
}

function SideNav({ workspace, user, basePath, active, module, account, hideLinks, anchors, rail, onNavigate }: {
  workspace: Workspace
  user: Employee
  basePath: string
  active: NavItem
  module?: NavItem
  account?: boolean
  hideLinks?: boolean
  anchors?: SidebarAnchor[]
  rail?: boolean
  onNavigate?: () => void
}) {
  const t = workspace.theme
  const items = module?.children ?? (account ? [PROFILE_ITEM, ...(workspace.accountNav ?? [])] : workspace.nav)
  const base = module ? `${basePath}/${module.slug}` : basePath
  return (
    <>
      {(module || account) && (
        <Link
          to={hideLinks && module ? base : basePath}
          onClick={onNavigate}
          aria-label={hideLinks && module ? `Back to ${module.label}` : 'Back to dashboard'}
          className={`group relative mb-4 flex items-center gap-2 px-3 py-2 text-xs font-medium transition ${t.radius} ${t.navIdle} ${
            rail ? 'md:max-lg:justify-center md:max-lg:px-0' : ''
          }`}
        >
          <ArrowLeft className="size-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
          <span className={rail ? 'md:max-lg:hidden' : ''}>{hideLinks && module ? `Back to ${module.label}` : 'Back to dashboard'}</span>
        </Link>
      )}
      <p className={`mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] ${rail ? 'md:max-lg:hidden' : ''} ${t.sidebarMuted}`}>
        {module?.label ?? (account ? active.label : user.role_label)}
      </p>
      {hideLinks ? (
        anchors?.length ? (
          <AnchorLinks items={anchors} t={t} rail={rail} onNavigate={onNavigate} />
        ) : active.register && (
          <Link
            to={{ search: '?register' }}
            onClick={onNavigate}
            aria-label={active.register}
            className={`group relative flex items-center gap-3 px-3 py-2.5 text-sm transition-all duration-200 ${t.radius} ${
              rail ? 'md:max-lg:justify-center md:max-lg:px-0' : ''
            } ${t.navActive}`}
          >
            <Plus className="size-[18px] shrink-0" />
            <span className={rail ? 'md:max-lg:hidden' : ''}>{active.register}</span>
            {rail && (
              <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 font-sans text-xs font-medium text-white shadow-xl md:max-lg:group-hover:block">
                {active.register}
              </span>
            )}
          </Link>
        )
      ) : (
        <NavLinks workspace={workspace} items={items} basePath={base} active={active} rail={rail} onNavigate={onNavigate} />
      )}
    </>
  )
}

function SidebarUser({ workspace, user, basePath, active, rail, onNavigate, onLogout }: {
  workspace: Workspace
  user: Employee
  basePath: string
  active: NavItem
  rail?: boolean
  onNavigate?: () => void
  onLogout: () => void
}) {
  const t = workspace.theme
  const links = workspace.accountNav
  const row = `group relative flex w-full items-center gap-3 px-3 py-2.5 text-sm transition-all duration-200 ${t.radius} ${
    rail ? 'md:max-lg:justify-center md:max-lg:px-0' : ''
  }`
  const tip = (label: string) =>
    rail && (
      <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 font-sans text-xs font-medium text-white shadow-xl md:max-lg:group-hover:block">
        {label}
      </span>
    )
  return (
    <div className={`border-t pt-4 ${t.sidebarDivider}`}>
      <div className={`flex items-center gap-3 ${rail ? 'md:max-lg:flex-col' : ''}`}>
        <Avatar user={user} className="size-10 rounded-full" ring={t.ring} />
        <div className={`min-w-0 flex-1 ${rail ? 'md:max-lg:hidden' : ''}`}>
          <p className="truncate text-sm font-medium capitalize">{user.first_name}</p>
          <p className={`truncate text-xs ${t.sidebarMuted}`}>{user.role_label}</p>
        </div>
      </div>
      <nav className="mt-3 flex flex-col gap-1">
        {links?.map((item) => {
          const isActive = item.slug === active.slug
          return (
            <Link
              key={item.slug}
              to={href(basePath, item)}
              onClick={onNavigate}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              className={`${row} ${isActive ? t.navActive : t.navIdle}`}
            >
              <item.icon className="size-[18px] shrink-0" />
              <span className={rail ? 'md:max-lg:hidden' : ''}>{item.label}</span>
              {tip(item.label)}
            </Link>
          )
        })}
        <button
          type="button"
          onClick={() => {
            onNavigate?.()
            void onLogout()
          }}
          className={`${row} ${t.navIdle} hover:!text-rose-500`}
        >
          <LogOut className="size-[18px] shrink-0" />
          <span className={rail ? 'md:max-lg:hidden' : ''}>Sign out</span>
          {tip('Sign out')}
        </button>
      </nav>
    </div>
  )
}

function UserMenu({ workspace, user, basePath, onLogout }: {
  workspace: Workspace
  user: Employee
  basePath: string
  onLogout: () => void
}) {
  const t = workspace.theme
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const item = `flex w-full items-center gap-3 px-3 py-2.5 text-sm ${t.radius}`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-3 rounded-2xl p-1 pr-1.5 transition ${t.iconButton}`}
      >
        <span className="hidden text-right lg:block">
          <span className="block text-sm font-medium leading-tight">{user.full_name}</span>
          <span className={`block text-xs ${t.muted}`}>{user.email}</span>
        </span>
        <Avatar user={user} className="size-10 rounded-full" ring={t.ring} />
        <ChevronDown className={`size-4 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${t.muted}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className={`absolute right-0 top-full z-50 mt-2 w-64 origin-top-right overflow-hidden p-1.5 ${t.radius} ${t.card} shadow-xl shadow-black/10 dark:shadow-black/40`}
          >
            <div className="px-3 py-2.5">
              <p className="truncate text-sm font-medium">{user.full_name}</p>
              <p className={`truncate text-xs ${t.muted}`}>{user.email}</p>
              <span className={`mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${t.badge}`}>
                {user.role_label}
              </span>
            </div>
            <div className={`my-1 border-t ${t.sidebarDivider}`} />
            <Link role="menuitem" to={`${basePath}/profile`} onClick={() => setOpen(false)} className={`${item} ${t.navIdle}`}>
              <UserCircle className="size-[18px] shrink-0" /> My profile
            </Link>
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false)
                void onLogout()
              }}
              className={`${item} ${t.navIdle} hover:!text-rose-500`}
            >
              <LogOut className="size-[18px] shrink-0" /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Till gate for receptionists — no open session prompts them to open one ("clock
 *  in"); a session held by a colleague puts the desk into view-only. The owner
 *  sees nothing and works normally. Rendered above the page content. */
function TillGate({ workspace, user, basePath }: { workspace: Workspace; user: Employee; basePath: string }) {
  const t = workspace.theme
  const gated = user.role === 'branch_receptionist' && !!user.branch
  const { data } = useApi(() => (gated ? bnb.tills({ open: '1' }) : Promise.resolve(null)), [gated])
  const [dismissed, setDismissed] = useState(false)
  if (!gated || !data) return null
  const open = data.find((s) => s.status === 'open')
  if (open?.opened_by === user.id) return null

  if (open) {
    return (
      <div className={`mb-5 flex items-center gap-3 px-4 py-3 text-sm ${t.radius} ${t.chip}`}>
        <Lock className="size-4 shrink-0" />
        <p className="min-w-0 flex-1">
          <b>View only</b> — {open.opened_by_name ?? 'Another receptionist'} has the till open. You can look around, but nothing can be changed until they close it.
        </p>
      </div>
    )
  }
  if (dismissed) return null

  return (
    <motion.div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button type="button" aria-label="Dismiss" onClick={() => setDismissed(true)} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
      <motion.div
        role="dialog" aria-modal="true" aria-label="Open the till"
        initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className={`relative my-auto w-full max-w-md overflow-hidden shadow-2xl ${t.radius} ${t.root}`}
      >
        <div className="flex items-center gap-3 px-5 py-4">
          <span className={`grid size-10 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
            <Calculator className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className={`text-base ${t.heading}`}>Open the till to start your shift</h3>
            <p className={`text-xs ${t.muted}`}>No session is open at {user.branch_name ?? 'your branch'} yet</p>
          </div>
        </div>
        <p className={`px-5 text-sm ${t.muted}`}>
          Opening the till puts the day's money under your session — check-ins, expenses, stock and drawings stay locked until someone opens it.
        </p>
        <div className="flex items-center justify-end gap-2 px-5 py-4">
          <button type="button" onClick={() => setDismissed(true)} className={`px-4 py-2 text-sm font-medium ${t.radius} ${t.navIdle}`}>Not now</button>
          <Link to={`${basePath}/accounts/counter?open`} className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold ${t.radius} ${t.navActive}`}>
            <Calculator className="size-4" /> Open the till
          </Link>
        </div>
      </motion.div>
    </motion.div>
  )
}

const SESSION_MS = 6 * 3_600_000 // prompt after 6 clocked-in hours
const GRACE_MS = 5 * 60_000 // unanswered prompt → system clock-out

/** Blocking overlay card for the attendance/session gates — there is no
 *  backdrop dismiss: the only way out is one of the given actions. */
function GateModal({ t, icon, title, sub, children, actions }: {
  t: Workspace['theme']
  icon: ReactNode
  title: string
  sub?: string
  children?: ReactNode
  actions: ReactNode
}) {
  return (
    <motion.div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
      <motion.div
        role="dialog" aria-modal="true" aria-label={title}
        initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className={`relative my-auto w-full max-w-md overflow-hidden shadow-2xl ${t.radius} ${t.root}`}
      >
        <div className="flex items-center gap-3 px-5 py-4">
          <span className={`grid size-10 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>{icon}</span>
          <div className="min-w-0">
            <h3 className={`text-base ${t.heading}`}>{title}</h3>
            {sub ? <p className={`text-xs ${t.muted}`}>{sub}</p> : null}
          </div>
        </div>
        {children ? <p className={`px-5 text-sm ${t.muted}`}>{children}</p> : null}
        <div className="flex items-center justify-end gap-2 px-5 py-4">{actions}</div>
      </motion.div>
    </motion.div>
  )
}

/** Everyone except receptionists (whose till open is their clock-in) must clock
 *  in before using the system. Six hours into the shift a "still working?"
 *  prompt appears; if it goes unanswered for 5 minutes the system clocks them
 *  out — flagged `system_clock_out` so it's distinct from a normal clock-out. */
function AttendanceGate({ workspace, user, onLogout }: { workspace: Workspace; user: Employee; onLogout: () => void }) {
  const t = workspace.theme
  const gated = user.role !== 'branch_receptionist'
  const [skew, setSkew] = useState(0)
  const { data, error, reload, setData } = useApi(async () => {
    if (!gated) return null
    const d = await hr.myAttendance()
    setSkew(new Date(d.server_now).getTime() - Date.now())
    return d
  }, [gated])
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState('')
  const [confirmedAt, setConfirmedAt] = useState<number | null>(null)
  const checkedOut = useRef(false)
  const now = useNow(1_000).getTime() + skew

  const record = data?.record ?? null
  const inAt = record?.clock_in ? new Date(`${record.date}T${record.clock_in}`).getTime() : null
  const onShift = inAt !== null && !record?.clock_out
  const anchor = confirmedAt ?? inAt ?? 0
  const deadline = anchor + SESSION_MS + GRACE_MS
  const due = onShift && now - anchor >= SESSION_MS

  useEffect(() => {
    if (!due || now < deadline || checkedOut.current) return
    checkedOut.current = true
    hr.clock('system-check-out')
      .then((rec) => setData((d) => (d ? { ...d, record: rec } : d)))
      .catch(() => reload())
  }, [due, now, deadline, setData, reload])

  const act = async (action: ClockAction) => {
    setBusy(true)
    setFlash('')
    try {
      const rec = await hr.clock(action)
      setData((d) => (d ? { ...d, record: rec } : d))
    } catch (e) {
      setFlash(parseApiError(e).message)
      reload()
    } finally {
      setBusy(false)
    }
  }

  if (!gated) return null
  if (!data) {
    if (!error) return null
    return (
      <GateModal
        t={t} icon={<LogIn className="size-5" />} title="Clock in to access" sub="Couldn't load your attendance"
        actions={
          <>
            <button type="button" onClick={onLogout} className={`px-4 py-2 text-sm font-medium ${t.radius} ${t.navIdle}`}>Sign out</button>
            <button type="button" onClick={reload} className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold ${t.radius} ${t.navActive}`}>Try again</button>
          </>
        }
      >
        {error}
      </GateModal>
    )
  }

  if (record?.clock_out) {
    return (
      <GateModal
        t={t} icon={<LogOut className="size-5" />} title="Shift complete" sub={`Clocked out at ${record.clock_out.slice(0, 5)}`}
        actions={
          <button type="button" onClick={onLogout} className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold ${t.radius} ${t.navActive}`}>
            <LogOut className="size-4" /> Sign out
          </button>
        }
      >
        {record.system_clock_out
          ? 'The system ended your shift — the still-working check went unanswered. Sign back in tomorrow to clock in again.'
          : "You've clocked out for today. Sign back in tomorrow to clock in again."}
      </GateModal>
    )
  }

  if (!onShift) {
    return (
      <GateModal
        t={t} icon={<LogIn className="size-5" />} title="Clock in to start your shift" sub={`Signed in as ${user.first_name}`}
        actions={
          <>
            <button type="button" onClick={onLogout} className={`px-4 py-2 text-sm font-medium ${t.radius} ${t.navIdle}`}>Sign out</button>
            <button type="button" disabled={busy} onClick={() => act('check-in')} className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold ${t.radius} ${t.navActive} disabled:opacity-60`}>
              <LogIn className="size-4" /> {busy ? 'Clocking in…' : 'Clock in'}
            </button>
          </>
        }
      >
        Clock in to access the system — your working time is tracked from now until you clock out.{flash ? <span className="mt-1 block text-red-500">{flash}</span> : null}
      </GateModal>
    )
  }

  if (due) {
    const left = Math.max(0, deadline - now)
    const mm = String(Math.floor(left / 60_000))
    const ss = String(Math.floor((left % 60_000) / 1000)).padStart(2, '0')
    return (
      <GateModal
        t={t} icon={<Timer className="size-5" />} title="Still working?" sub={`Clocked in for over 6 hours — auto clock-out in ${mm}:${ss}`}
        actions={
          <button type="button" onClick={() => setConfirmedAt(now)} className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold ${t.radius} ${t.navActive}`}>
            <Timer className="size-4" /> I'm still working
          </button>
        }
      >
        Confirm you're still on shift or the system will clock you out in <b className={t.heading}>{mm}:{ss}</b>.
      </GateModal>
    )
  }

  return null
}

function HeaderClock({ className }: { className: string }) {
  const now = useNow()
  return (
    <div className={`hidden items-center gap-2 text-sm sm:flex ${className}`}>
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
      </span>
      <span className="font-medium tabular-nums">
        {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
      <span className="hidden lg:inline">· {now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</span>
    </div>
  )
}

export function WorkspaceLayout({ workspace, user, basePath, active, module, account, hideLinks, anchors, onLogout, children }: Props) {
  const t = workspace.theme
  const { resolved } = useTheme()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const bottomItems = (module?.children ?? (account ? [PROFILE_ITEM, ...(workspace.accountNav ?? [])] : workspace.nav)).slice(0, 4)
  const navBase = module ? `${basePath}/${module.slug}` : basePath
  /** The role's landing page is the dashboard itself — no link back to it there. */
  const isLanding = !module && !account && active.slug === ''

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false)
    window.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [drawerOpen])

  return (
    <div className={`relative min-h-dvh ${t.root}`} style={{ colorScheme: resolved }}>
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className={`absolute -right-[10%] -top-[20%] size-[55vmax] animate-aurora rounded-full blur-3xl ${t.glowA}`} />
        <div className={`absolute -bottom-[25%] -left-[10%] size-[55vmax] animate-aurora rounded-full blur-3xl [animation-delay:-8s] ${t.glowB}`} />
        {t.pattern && <div className={`absolute inset-0 ${t.pattern}`} />}
      </div>

      {/* Sidebar: icon rail on tablets, full width on desktops */}
      <motion.aside
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed z-30 hidden w-20 flex-col gap-8 px-3 py-5 md:flex lg:w-64 lg:px-4 ${t.sidebarFrame} ${t.sidebar}`}
      >
        <div className="md:max-lg:flex md:max-lg:justify-center">
          <BrandMark workspace={workspace} basePath={basePath} compact />
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-visible">
          <SideNav workspace={workspace} user={user} basePath={basePath} active={active} module={module} account={account} hideLinks={hideLinks} anchors={anchors} rail />
        </div>
        <SidebarUser workspace={workspace} user={user} basePath={basePath} active={active} rail onLogout={onLogout} />
      </motion.aside>

      {/* Mobile slide-out menu */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
            />
            <motion.aside
              key="drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className={`fixed inset-y-0 left-0 z-50 flex w-[82%] max-w-xs flex-col gap-8 px-4 py-5 md:hidden ${t.sidebar} !rounded-none !rounded-r-3xl`}
            >
              <div className="flex items-center justify-between">
                <BrandMark workspace={workspace} basePath={basePath} />
                <button onClick={() => setDrawerOpen(false)} aria-label="Close menu" className={`grid size-9 place-items-center rounded-lg ${t.navIdle}`}>
                  <X className="size-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <SideNav workspace={workspace} user={user} basePath={basePath} active={active} module={module} account={account} hideLinks={hideLinks} anchors={anchors} onNavigate={() => setDrawerOpen(false)} />
              </div>
              <SidebarUser workspace={workspace} user={user} basePath={basePath} active={active} onNavigate={() => setDrawerOpen(false)} onLogout={onLogout} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className={`relative flex min-h-dvh flex-col ${t.contentOffset}`}>
        <header className={`sticky top-0 z-20 ${t.header}`}>
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className={`grid size-10 place-items-center rounded-xl transition md:hidden ${t.iconButton}`}
            >
              <Menu className="size-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-[11px] font-medium uppercase tracking-[0.18em] ${t.accentText}`}>
                {module ? `${user.role_label} · ${module.label}` : account ? `${user.role_label} · ${active.label}` : user.role_label}
              </p>
              <h1 className={`truncate text-lg leading-tight sm:text-xl ${t.heading}`}>{active.label}</h1>
            </div>
            {!isLanding && (
              <Link
                to={basePath}
                aria-label="Back to dashboard"
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${t.iconButton}`}
              >
                <LayoutDashboard className="size-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
            )}
            <HeaderClock className={t.muted} />
            <ThemeToggle className={t.iconButton} />
            <UserMenu workspace={workspace} user={user} basePath={basePath} onLogout={onLogout} />
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-10 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <TillGate workspace={workspace} user={user} basePath={basePath} />
            <AttendanceGate workspace={workspace} user={user} onLogout={onLogout} />
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${module?.slug ?? ''}/${active.slug}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto w-full max-w-7xl"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className={`mb-24 md:mb-0 ${t.footer}`}>
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs sm:flex-row sm:px-6 lg:px-8">
            <p>© {YEAR} Haven Stays · {user.role_label} workspace</p>
            <p className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-emerald-500" /> Signed in as <span className="capitalize">{user.first_name}</span>
            </p>
          </div>
        </footer>
      </div>

      {/* Mobile bottom bar */}
      <nav className={`fixed inset-x-0 bottom-0 z-30 md:hidden ${t.bottomNav}`}>
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
          {bottomItems.map((item) => {
            const isActive = item.slug === active.slug
            return (
              <Link
                key={item.slug}
                to={href(navBase, item)}
                className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 py-1 text-[10px] font-medium transition ${isActive ? t.bottomActive : t.bottomIdle}`}
              >
                {isActive && (
                  <motion.span layoutId="bottom-pill" className="absolute -top-2 h-0.5 w-8 rounded-full bg-current" />
                )}
                <item.icon className="size-5" />
                <span className="max-w-full truncate">{item.short ?? item.label}</span>
              </Link>
            )
          })}
          <button
            onClick={() => setDrawerOpen(true)}
            className={`flex min-w-0 flex-1 flex-col items-center gap-1 py-1 text-[10px] font-medium ${t.bottomIdle}`}
          >
            <MoreHorizontal className="size-5" />
            More
          </button>
        </div>
      </nav>
    </div>
  )
}
