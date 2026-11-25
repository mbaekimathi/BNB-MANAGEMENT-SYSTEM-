import type { Employee } from '../../lib/api'
import type { WorkspaceTheme } from '../../lib/workspaces'

/** Props every Accounts sub-page gets — the workspace theme and the signed-in user (branch already checked). */
export interface AccountPageProps {
  t: WorkspaceTheme
  me: Employee
}
