import { describe, expect, it } from 'vitest'
import en from '@dbc-config-lab/core/locales/en.json'
import { RealLaunchesRejection } from '@dbc-config-lab/core/features/real-launches'
import type {
  RealLaunches,
  RealLaunchesState,
} from '@dbc-config-lab/core/features/real-launches'
import { renderComponent } from '../../testing'
import RealLaunchesSummary from './RealLaunchesSummary.vue'

const LAUNCHES: RealLaunches = {
  totalPools: 40,
  sampledPools: 40,
  completedShare: 0.25,
  migratedShare: 0.2,
  neverTradedShare: 0.5,
  tractionShare: 0.4,
  medianRaised: 3,
  meanRaised: 12,
  meanCurveFees: 0.5,
  medianCurveFees: 0.2,
  p75CurveFees: 0.6,
  medianSecondsToComplete: 640.4,
}

const render = (state: RealLaunchesState): Promise<string> =>
  renderComponent(RealLaunchesSummary, { state })

const read = (launches: Partial<RealLaunches> = {}): RealLaunchesState => ({
  loading: false,
  result: { ok: true, launches: { ...LAUNCHES, ...launches } },
})

describe('RealLaunchesSummary', () => {
  it('says the pools are being read', async () => {
    expect(await render({ loading: true })).toContain(
      en.components.realLaunchesSummary.loading,
    )
  })

  it('says why the pools could not be read, with no figures', async () => {
    const html = await render({
      loading: false,
      result: { ok: false, rejection: RealLaunchesRejection.NoPools },
    })
    expect(html).toContain(
      en.components.realLaunchesSummary.rejections['no-pools'],
    )
    expect(html).not.toContain(en.components.realLaunchesSummary.completed)
  })

  it('states how every pool went, the time to complete in whole seconds', async () => {
    const html = await render(read())
    expect(html).toContain('All 40 pools launched with this config:')
    expect(html).toContain('25%')
    expect(html).toContain('640s')
  })

  it('says when the figures come from a sample of the pools', async () => {
    expect(
      await render(read({ totalPools: 900, sampledPools: 500 })),
    ).toContain(
      '500 of the 900 pools launched with this config, spread evenly:',
    )
  })

  it('says the time is not available when the config counts slots', async () => {
    expect(await render(read({ medianSecondsToComplete: null }))).toContain(
      en.components.realLaunchesSummary.timeUnknown,
    )
  })
})
