import { describe, expect, it } from 'vitest'
import en from '@dbc-config-lab/core/locales/en.json'
import { useOneTimeSecret } from '@dbc-config-lab/core/features/account'
import { renderComponent } from '../../testing'
import OneTimeSecret from './OneTimeSecret.vue'

const SECRET = 'lab_9f3a7c1e5b2d4f6a8c0e'

/** Renders the component as the page would for the holder's current secret. */
const render = (secret: string | null): Promise<string> =>
  renderComponent(OneTimeSecret, { secret, title: 'New key “ci”' })

describe('OneTimeSecret', () => {
  it('shows a disclosed secret in full, with a way to copy it and a warning it will not return', async () => {
    const holder = useOneTimeSecret()
    holder.reveal(SECRET)
    const html = await render(holder.secret.value)
    expect(html).toContain(SECRET)
    expect(html).toContain(en.components.oneTimeSecret.copy)
    expect(html).toContain(en.components.oneTimeSecret.notice)
    expect(html).toContain(en.components.oneTimeSecret.dismiss)
  })

  it('is gone once dismissed', async () => {
    const holder = useOneTimeSecret()
    holder.reveal(SECRET)
    holder.dismiss()
    const html = await render(holder.secret.value)
    expect(html).not.toContain(SECRET)
    expect(html).not.toContain(en.components.oneTimeSecret.copy)
  })

  it('is not shown on a fresh load of the page — the secret was never kept', async () => {
    const reloaded = useOneTimeSecret()
    expect(await render(reloaded.secret.value)).not.toContain(SECRET)
  })
})
