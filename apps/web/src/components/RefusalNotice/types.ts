import type { ApiFailure } from '@dbc-config-lab/core/features/account'

export interface RefusalNoticeProps {
  /** Nothing is shown while this is null. */
  failure: ApiFailure | null
}
