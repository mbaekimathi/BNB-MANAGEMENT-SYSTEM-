import { motion } from 'framer-motion'
import { ArrowUpRight, BadgeCheck, Construction, Mail, Phone } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Avatar } from '../components/workspace/Avatar'
import { WorkspaceLayout } from '../components/workspace/WorkspaceLayout'
import { useAuth } from '../context/AuthContext'
import type { Employee } from '../lib/api'
import { rolePath } from '../lib/roles'
import { greetingFor, useNow } from '../lib/time'
import { WORKSPACES, type NavItem, type Workspace } from '../lib/workspaces'

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
              <span className={`rounded-full px-3 py-1 ${t.chip}`}>Code {user.code}</span>
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
  const active = workspace.nav.find((n) => n.slug === sectionSlug.split('/')[0]) ?? workspace.nav[0]

  return (
    <WorkspaceLayout workspace={workspace} user={user} basePath={basePath} active={active} onLogout={logout}>
      {active.slug ? <Section workspace={workspace} item={active} /> : <Overview workspace={workspace} user={user} basePath={basePath} />}
    </WorkspaceLayout>
  )
}
