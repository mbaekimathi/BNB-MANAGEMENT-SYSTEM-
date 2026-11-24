import type { Employee } from '../../lib/api'
import type { WorkspaceTheme } from '../../lib/workspaces'

export interface BnbPageProps {
  t: WorkspaceTheme
  me: Employee
  /** URL of the BnB section, e.g. `/it-support/bnb`. */
  base: string
}
