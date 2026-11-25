import { Building2 } from 'lucide-react'
import type { ComponentType } from 'react'
import { Empty, PageHeader, Panel } from '../components/hr/ui'
import type { Employee } from '../lib/api'
import type { NavItem, WorkspaceTheme } from '../lib/workspaces'
import ClientReport from './accounts/ClientReport'
import MoneyFlowReport from './accounts/MoneyFlowReport'
import PackageReport from './accounts/PackageReport'
import ReferralReport from './accounts/ReferralReport'
import Report from './accounts/Report'
import RoomReport from './accounts/RoomReport'
import type { AccountPageProps } from './accounts/types'

/** Reports section pages — one per sidebar link. '' is the money flow report. */
const PAGES: Record<string, ComponentType<AccountPageProps>> = {
  '': MoneyFlowReport,
  cash: Report,
  rooms: RoomReport,
  clients: ClientReport,
  referrals: ReferralReport,
  packages: PackageReport,
}

export default function ReportsPage({ item, t, me }: { item: NavItem; t: WorkspaceTheme; me: Employee }) {
  const Page = PAGES[item.slug] ?? Report
  return (
    <div className="space-y-5">
      <PageHeader t={t} icon={item.icon} title={item.label} text={item.description} />
      {!me.branch ? (
        <Panel t={t}>
          <Empty
            t={t}
            icon={Building2}
            title="No branch allocated yet"
            text="Your account isn't assigned to a BnB branch, so there are no reports to show. Ask your manager or IT support to allocate you."
          />
        </Panel>
      ) : (
        <div data-report-root className="space-y-5">
          <Page t={t} me={me} />
        </div>
      )}
    </div>
  )
}
