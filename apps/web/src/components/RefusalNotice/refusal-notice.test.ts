import { describe, expect, it } from 'vitest'
import en from '@dbc-config-lab/core/locales/en.json'
import type { ApiFailure } from '@dbc-config-lab/core/features/account'
import { renderComponent } from '../../testing'
import RefusalNotice from './RefusalNotice.vue'

const render = (failure: ApiFailure | null): Promise<string> =>
  renderComponent(RefusalNotice, { failure })

describe('RefusalNotice', () => {
  it('shows nothing while the service has refused nothing', async () => {
    expect(await render(null)).not.toContain('role="alert"')
  })

  it('shows a refusal in the service’s own words', async () => {
    const html = await render({ status: 400, message: 'Not on this plan.' })
    expect(html).toContain('role="alert"')
    expect(html).toContain('Not on this plan.')
  })

  it('says the service could not be reached when it gave no words', async () => {
    expect(await render({ status: 0, message: null })).toContain(
      en.components.refusalNotice.unreachable,
    )
  })
})
