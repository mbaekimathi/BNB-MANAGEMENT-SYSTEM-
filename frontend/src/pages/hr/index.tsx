import type { ComponentType } from 'react'
import { PageHeader } from '../../components/hr/ui'
import type { NavItem } from '../../lib/workspaces'
import Attendance from './Attendance'
import BranchAllocation from './BranchAllocation'
import HrOverview from './HrOverview'
import Leave from './Leave'
import Payroll from './Payroll'
import { EmployeeRecords, PendingActivation, RoleAssignment } from './People'
import type { HrPageProps } from './types'

const PAGES: Record<string, ComponentType<HrPageProps>> = {
  '': HrOverview,
  'employee-records': EmployeeRecords,
  activations: PendingActivation,
  'role-assignment': RoleAssignment,
  'branch-allocation': BranchAllocation,
  attendance: Attendance,
  leave: Leave,
  payroll: Payroll,
}

export function HrPage({ item, ...props }: HrPageProps & { item: NavItem }) {
  const Page = PAGES[item.slug]
  return (
    <div className="space-y-5">
      <PageHeader t={props.t} icon={item.icon} title={item.label} text={item.description} />
      <Page {...props} />
    </div>
  )
}
