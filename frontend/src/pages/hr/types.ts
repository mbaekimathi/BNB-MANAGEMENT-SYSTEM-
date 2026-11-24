import type { Employee } from '../../lib/api'
import type { WorkspaceTheme } from '../../lib/workspaces'

export interface HrPageProps {
  t: WorkspaceTheme
  me: Employee
  /** URL of the HR section, e.g. `/it-support/hr`. */
  base: string
}
