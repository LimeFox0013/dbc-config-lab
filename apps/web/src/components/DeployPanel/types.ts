import type { DeployTarget } from '../../features/deployment'

export interface DeployPanelProps {
  targets: DeployTarget[]
  /** Selected at first; a config from someone else's link should never be the default. */
  initialTargetId: DeployTarget['id']
}
