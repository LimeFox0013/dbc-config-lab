import { describe, expect, it } from 'vitest'
import en from '@dbc-config-lab/core/locales/en.json'
import type { PartnerBranding } from '@dbc-config-lab/core/core/partner-branding'
import { shortAddress } from '@dbc-config-lab/core/core/shared'
import {
  FAKE_ADDRESS,
  onChainConfigFixture,
  renderComponent,
} from '../../testing'
import LaunchpadIdentity from './LaunchpadIdentity.vue'

const BRANDING: PartnerBranding = {
  name: 'Moon Pad',
  website: 'https://moonpad.example',
  logo: 'https://moonpad.example/logo.png',
}

const render = (branding: PartnerBranding | null): Promise<string> =>
  renderComponent(LaunchpadIdentity, {
    config: onChainConfigFixture(),
    branding,
    royalty: null,
  })

describe('LaunchpadIdentity', () => {
  it('shows a published name, logo and website, marked as unverified', async () => {
    const html = await render(BRANDING)
    expect(html).toContain('Moon Pad')
    expect(html).toContain(en.components.launchpadIdentity.unverified)
    expect(html).toContain('moonpad.example</a>')
    expect(html).toContain('src="https://moonpad.example/logo.png"')
  })

  it('names an unbranded launchpad by its fee wallet', async () => {
    const html = await render(null)
    expect(html).toContain(`Launchpad ${shortAddress(FAKE_ADDRESS)}`)
    expect(html).toContain(en.components.launchpadIdentity.noBranding)
    expect(html).not.toContain('<img')
  })

  it('never links or loads a website or logo that is not https', async () => {
    const html = await render({
      ...BRANDING,
      website: 'javascript:alert(1)',
      logo: 'http://moonpad.example/logo.png',
    })
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('<img')
  })
})
