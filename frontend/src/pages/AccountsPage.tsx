import { Building2 } from 'lucide-react'
import type { ComponentType } from 'react'
import { Empty, PageHeader, Panel } from '../components/hr/ui'
import type { Employee } from '../lib/api'
import type { NavItem, WorkspaceTheme } from '../lib/workspaces'
import Commissions from './accounts/Commissions'
import Counter from './accounts/Counter'
import Drawings from './accounts/Drawings'
import Expenses from './accounts/Expenses'
import IncomeRecords from './accounts/IncomeRecords'
import StockPurchases from './accounts/StockPurchases'
import type { AccountPageProps } from './accounts/types'

/** Accounts section pages — one per sidebar link. '' is Income records. */
const PAGES: Record<string, ComponentType<AccountPageProps>> = {
  '': IncomeRecords,
  expenses: Expenses,
  stock: StockPurchases,
  counter: Counter,
  drawings: Drawings,
  commissions: Commissions,
}

export default function AccountsPage({ item, t, me }: { item: NavItem; t: WorkspaceTheme; me: Employee }) {
  const Page = PAGES[item.slug] ?? IncomeRecords
  return (
    <div className="space-y-5">
      <PageHeader t={t} icon={item.icon} title={item.label} text={item.description} />
      {!me.branch ? (
        <Panel t={t}>
          <Empty
            t={t}
            icon={Building2}
            title="No branch allocated yet"
            text="Your account isn't assigned to a BnB branch, so there are no accounts to show. Ask your manager or IT support to allocate you."
          />
        </Panel>
      ) : (
        <Page t={t} me={me} />
      )}
    </div>
  )
}
