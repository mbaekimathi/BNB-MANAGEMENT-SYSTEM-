import type { ComponentType } from 'react'
import { PageHeader } from '../../components/hr/ui'
import type { NavItem } from '../../lib/workspaces'
import BnbOverview from './BnbOverview'
import type { BnbPageProps } from './types'

const PAGES: Record<string, ComponentType<BnbPageProps>> = {
  '': BnbOverview,
}

export function BnbPage({ item, ...props }: BnbPageProps & { item: NavItem }) {
  const Page = PAGES[item.slug] ?? BnbOverview
  return (
    <div className="space-y-5">
      <PageHeader t={props.t} icon={item.icon} title={item.label} text={item.description} />
      <Page {...props} />
    </div>
  )
}
