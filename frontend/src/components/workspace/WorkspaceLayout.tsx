import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ChevronDown, LogOut, Menu, MoreHorizontal, UserCircle, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { ThemeToggle } from '../ThemeToggle'
import type { Employee } from '../../lib/api'
import { useNow } from '../../lib/time'
import type { NavItem, Workspace } from '../../lib/workspaces'
import { Avatar } from './Avatar'

interface Props {
  workspace: Workspace
  user: Employee
  basePath: string
  active: NavItem
  /** Set when inside a section that has its own sub-pages. */
  module?: NavItem
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

function SideNav({ workspace, user, basePath, active, module, rail, onNavigate }: {
  workspace: Workspace
  user: Employee
  basePath: string
  active: NavItem
  module?: NavItem
  rail?: boolean
  onNavigate?: () => void
}) {
  const t = workspace.theme
  const items = module?.children ?? workspace.nav
  const base = module ? `${basePath}/${module.slug}` : basePath
  return (
    <>
      {module && (
        <Link
          to={basePath}
          onClick={onNavigate}
          aria-label="Back to dashboard"
          className={`group relative mb-4 flex items-center gap-2 px-3 py-2 text-xs font-medium transition ${t.radius} ${t.navIdle} ${
            rail ? 'md:max-lg:justify-center md:max-lg:px-0' : ''
          }`}
        >
          <ArrowLeft className="size-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
          <span className={rail ? 'md:max-lg:hidden' : ''}>Back to dashboard</span>
        </Link>
      )}
      <p className={`mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] ${rail ? 'md:max-lg:hidden' : ''} ${t.sidebarMuted}`}>
        {module?.label ?? user.role_label}
      </p>
      <NavLinks workspace={workspace} items={items} basePath={base} active={active} rail={rail} onNavigate={onNavigate} />
    </>
  )
}

function SidebarUser({ workspace, user, basePath, active, rail, onNavigate }: {
  workspace: Workspace
  user: Employee
  basePath: string
  active: NavItem
  rail?: boolean
  onNavigate?: () => void
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
      {links && (
        <nav className="mt-3 flex flex-col gap-1">
          {links.map((item) => {
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
        </nav>
      )}
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

export function WorkspaceLayout({ workspace, user, basePath, active, module, onLogout, children }: Props) {
  const t = workspace.theme
  const { resolved } = useTheme()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const bottomItems = (module?.children ?? workspace.nav).slice(0, 4)
  const navBase = module ? `${basePath}/${module.slug}` : basePath

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
          <SideNav workspace={workspace} user={user} basePath={basePath} active={active} module={module} rail />
        </div>
        <SidebarUser workspace={workspace} user={user} basePath={basePath} active={active} rail />
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
                <SideNav workspace={workspace} user={user} basePath={basePath} active={active} module={module} onNavigate={() => setDrawerOpen(false)} />
              </div>
              <SidebarUser workspace={workspace} user={user} basePath={basePath} active={active} onNavigate={() => setDrawerOpen(false)} />
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
              <p className={`truncate text-[11px] font-medium uppercase tracking-[0.18em] ${t.accentText}`}>{module ? `${user.role_label} · ${module.label}` : user.role_label}</p>
              <h1 className={`truncate text-lg leading-tight sm:text-xl ${t.heading}`}>{active.label}</h1>
            </div>
            <HeaderClock className={t.muted} />
            <ThemeToggle className={t.iconButton} />
            <UserMenu workspace={workspace} user={user} basePath={basePath} onLogout={onLogout} />
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-10 lg:px-8">
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
