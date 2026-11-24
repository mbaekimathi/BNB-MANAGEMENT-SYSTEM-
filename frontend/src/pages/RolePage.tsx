import { motion } from 'framer-motion'
import { ArrowUpRight, BadgeCheck, Building2, Construction, Hash, Mail, MapPin, Phone } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Avatar } from '../components/workspace/Avatar'
import { WorkspaceLayout } from '../components/workspace/WorkspaceLayout'
import { useAuth } from '../context/AuthContext'
import type { Employee } from '../lib/api'
import { isBranchRole, rolePath } from '../lib/roles'
import { greetingFor, useNow } from '../lib/time'
import { PROFILE_ITEM, WORKSPACES, type NavItem, type Workspace, type WorkspaceTheme } from '../lib/workspaces'
import { BNB_PAGE_SLUGS } from '../lib/bnb'
import { HR_PAGE_SLUGS } from '../lib/hr'
import { BnbPage } from './bnb'
import AccountsPage from './AccountsPage'
import CheckInPage from './CheckInPage'
import GuestsInHousePage from './GuestsInHousePage'
import ReservationsPage, { RegisterClientPage } from './ReservationsPage'
import RoomAvailabilityPage from './RoomAvailabilityPage'
import RoomManagementPage from './RoomManagementPage'
import { HrPage } from './hr'

function Overview({ workspace, user, basePath }: { workspace: Workspace; user: Employee; basePath: string }) {
  const t = workspace.theme
  const now = useNow(60_000)
  const modules = workspace.nav.slice(1)
  return (
    <div className="space-y-6">
      <section className={`relative overflow-hidden p-5 sm:p-7 ${t.radius} ${t.card}`}>
        <div className={`pointer-events-none absolute -right-20 -top-24 size-72 rounded-full blur-2xl ${t.glowA}`} />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar user={user} className={`size-20 sm:size-24 ${t.radius}`} ring={t.ring} />
          <div className="min-w-0 flex-1">
            <p className={`text-sm ${t.muted}`}>{workspace.nav[0].description}</p>
            <h2 className={`mt-1 text-2xl sm:text-3xl lg:text-4xl ${t.heading}`}>
              {greetingFor(now)}, <span className={t.accentText}>{user.first_name}</span>
            </h2>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${t.badge}`}>
                <BadgeCheck className="size-3.5" /> {user.role_label}
              </span>
              <span className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-3 py-1 ${t.chip}`}>
                <Mail className="size-3.5 shrink-0" /> <span className="truncate">{user.email}</span>
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${t.chip}`}>
                <Phone className="size-3.5" /> {user.phone}
              </span>
            </div>
          </div>
        </div>
      </section>

      {isBranchRole(user.role) && <BranchPortal t={t} user={user} />}

      <section>
        <h3 className={`mb-3 text-base ${t.heading}`}>Your tools</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map((item, i) => (
            <motion.div
              key={item.slug}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.4 }}
            >
              <Link
                to={`${basePath}/${item.slug}`}
                className={`group flex h-full flex-col gap-4 p-5 transition-all duration-300 ${t.radius} ${t.card} ${t.cardHover}`}
              >
                <div className="flex items-start justify-between">
                  <span className={`grid size-11 place-items-center ${t.radius} ${t.iconBox}`}>
                    <item.icon className="size-5" />
                  </span>
                  <ArrowUpRight className={`size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 ${t.muted}`} />
                </div>
                <div>
                  <p className={`text-base ${t.heading}`}>{item.label}</p>
                  <p className={`mt-1 text-sm ${t.muted}`}>{item.description}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  )
}

/** Shown on a branch worker's landing page — the BnB branch they were allocated to. */
function BranchPortal({ t, user }: { t: WorkspaceTheme; user: Employee }) {
  const b = user.branch_detail
  if (!b) {
    return (
      <section className={`flex flex-col items-center gap-3 p-6 text-center ${t.radius} ${t.card}`}>
        <span className={`grid size-12 place-items-center ${t.radius} ${t.iconBox}`}>
          <Building2 className="size-6" />
        </span>
        <p className={`text-base ${t.heading}`}>No branch allocated yet</p>
        <p className={`max-w-md text-sm ${t.muted}`}>
          Your account is active, but you haven't been assigned to a BnB branch. Your manager or IT support can allocate you from HR → Branch allocation.
        </p>
      </section>
    )
  }
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.4 }}
      className={`relative overflow-hidden p-5 sm:p-6 ${t.radius} ${t.card}`}
    >
      <div className={`pointer-events-none absolute -left-16 -bottom-24 size-64 rounded-full blur-2xl ${t.glowB}`} />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className={`relative grid size-16 shrink-0 place-items-center overflow-hidden ring-2 sm:size-20 ${t.radius} ${t.ring} ${t.iconBox}`}>
          {b.photo ? <img src={b.photo} alt={b.name} className="size-full object-cover" /> : <Building2 className="size-8" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-medium uppercase tracking-wider ${t.muted}`}>Your branch portal</p>
          <h3 className={`mt-0.5 text-xl sm:text-2xl ${t.heading}`}>{b.name}</h3>
          <p className={`mt-1 flex items-center gap-1.5 text-sm ${t.muted}`}>
            <MapPin className="size-3.5 shrink-0" /> {b.location}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs sm:justify-end">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${t.badge}`}>
            <Hash className="size-3.5" /> Code {b.code}
          </span>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${t.chip}`}>
            <Phone className="size-3.5" /> {b.phone}
          </span>
          <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 ${t.chip}`}>
            <Mail className="size-3.5 shrink-0" /> <span className="truncate">{b.email}</span>
          </span>
        </div>
      </div>
    </motion.section>
  )
}

function ModuleOverview({ workspace, module, basePath }: { workspace: Workspace; module: NavItem; basePath: string }) {
  const t = workspace.theme
  const pages = (module.children ?? []).slice(1)
  return (
    <div className="space-y-6">
      <section className={`relative overflow-hidden p-5 sm:p-7 ${t.radius} ${t.card}`}>
        <div className={`pointer-events-none absolute -right-20 -top-24 size-72 rounded-full blur-2xl ${t.glowA}`} />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className={`grid size-16 shrink-0 place-items-center ${t.radius} ${t.iconBox}`}>
            <module.icon className="size-7" />
          </span>
          <div className="min-w-0">
            <h2 className={`text-2xl sm:text-3xl ${t.heading}`}>{module.label}</h2>
            <p className={`mt-1 text-sm ${t.muted}`}>{module.children?.[0]?.description ?? module.description}</p>
          </div>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {pages.map((item, i) => (
          <motion.div key={item.slug} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05, duration: 0.4 }}>
            <Link
              to={`${basePath}/${module.slug}/${item.slug}`}
              className={`group flex h-full flex-col gap-4 p-5 transition-all duration-300 ${t.radius} ${t.card} ${t.cardHover}`}
            >
              <div className="flex items-start justify-between">
                <span className={`grid size-11 place-items-center ${t.radius} ${t.iconBox}`}>
                  <item.icon className="size-5" />
                </span>
                <ArrowUpRight className={`size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 ${t.muted}`} />
              </div>
              <div>
                <p className={`text-base ${t.heading}`}>{item.label}</p>
                <p className={`mt-1 text-sm ${t.muted}`}>{item.description}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function Section({ workspace, item }: { workspace: Workspace; item: NavItem }) {
  const t = workspace.theme
  return (
    <section className={`flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center ${t.radius} ${t.card}`}>
      <span className={`grid size-16 place-items-center ${t.radius} ${t.iconBox}`}>
        <item.icon className="size-7" />
      </span>
      <h2 className={`text-2xl ${t.heading}`}>{item.label}</h2>
      <p className={`max-w-md text-sm ${t.muted}`}>{item.description}</p>
      <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${t.badge}`}>
        <Construction className="size-3.5" /> Being built
      </span>
    </section>
  )
}

export default function RolePage() {
  const { user, logout } = useAuth()
  const { '*': sectionSlug = '' } = useParams()
  if (!user) return null
  const workspace = WORKSPACES[user.role]
  const basePath = rolePath(user.role)
  const [section, subSlug = ''] = sectionSlug.split('/')
  const top =
    section === PROFILE_ITEM.slug
      ? PROFILE_ITEM
      : [...workspace.nav, ...(workspace.accountNav ?? [])].find((n) => n.slug === section) ?? workspace.nav[0]
  const module = top.children?.length ? top : undefined
  const active = module ? module.children!.find((c) => c.slug === subSlug) ?? module.children![0] : top

  let content
  if (module?.slug === 'hr' && HR_PAGE_SLUGS.includes(active.slug))
    content = <HrPage key={active.slug} item={active} t={workspace.theme} me={user} base={`${basePath}/hr`} />
  else if (module?.slug === 'bnb' && BNB_PAGE_SLUGS.includes(active.slug))
    content = <BnbPage key={active.slug} item={active} t={workspace.theme} me={user} base={`${basePath}/bnb`} />
  else if (active.slug === 'check-in') content = <CheckInPage item={active} t={workspace.theme} />
  else if (active.slug === 'room-management') content = <RoomManagementPage item={active} t={workspace.theme} me={user} />
  else if (active.slug === 'reservations' || active.slug === 'branch-bookings') content = <ReservationsPage item={active} t={workspace.theme} me={user} />
  else if (active.slug === 'register-client') content = <RegisterClientPage item={active} t={workspace.theme} me={user} back={`${basePath}/reservations`} />
  else if (active.slug === 'guests-in-house') content = <GuestsInHousePage item={active} t={workspace.theme} me={user} />
  else if (active.slug === 'room-availability') content = <RoomAvailabilityPage item={active} t={workspace.theme} me={user} />
  else if (active.slug === 'accounts') content = <AccountsPage item={active} t={workspace.theme} me={user} />
  else if (module) content = active.slug ? <Section workspace={workspace} item={active} /> : <ModuleOverview workspace={workspace} module={module} basePath={basePath} />
  else content = active.slug ? <Section workspace={workspace} item={active} /> : <Overview workspace={workspace} user={user} basePath={basePath} />

  return (
    <WorkspaceLayout workspace={workspace} user={user} basePath={basePath} active={active} module={module} onLogout={logout}>
      {content}
    </WorkspaceLayout>
  )
}
