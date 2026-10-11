import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { SolanaNetwork } from '../../core/shared'
import { OPERATOR_REFRESH_MS, OperatorRejection } from './constants'
import { fetchOperatorReport } from './fetch'
import type { OperatorReport } from './types'
import { useOperatorDashboard } from './useOperatorDashboard'

vi.mock('./fetch', () => ({ fetchOperatorReport: vi.fn() }))

const report = (owner: string): OperatorReport => ({
  owner,
  configs: [],
  positions: [],
  readAt: '2026-10-06T00:00:00.000Z',
})

afterEach(() => {
  vi.mocked(fetchOperatorReport).mockReset()
  vi.useRealTimers()
})

describe('useOperatorDashboard', () => {
  it('reads a wallet on request and again every refresh period', async () => {
    vi.useFakeTimers()
    vi.mocked(fetchOperatorReport).mockResolvedValue({
      ok: true,
      report: report('Wallet'),
    })
    const scope = effectScope()
    const dashboard = scope.run(() => useOperatorDashboard())
    if (!dashboard) throw new Error('scope did not run')

    await dashboard.watch('Wallet', SolanaNetwork.Mainnet)
    expect(dashboard.report.value).toEqual(report('Wallet'))
    expect(dashboard.reading.value).toBe(false)

    await vi.advanceTimersByTimeAsync(OPERATOR_REFRESH_MS)
    expect(fetchOperatorReport).toHaveBeenCalledTimes(2)

    scope.stop()
    await vi.advanceTimersByTimeAsync(OPERATOR_REFRESH_MS)
    expect(fetchOperatorReport).toHaveBeenCalledTimes(2)
  })

  it('keeps the last figures when a later read fails, and says why', async () => {
    vi.mocked(fetchOperatorReport)
      .mockResolvedValueOnce({ ok: true, report: report('Wallet') })
      .mockResolvedValueOnce({
        ok: false,
        rejection: OperatorRejection.NetworkError,
        detail: 'timeout',
      })
    const scope = effectScope()
    const dashboard = scope.run(() => useOperatorDashboard())
    if (!dashboard) throw new Error('scope did not run')

    await dashboard.watch('Wallet', SolanaNetwork.Mainnet)
    await dashboard.refresh()

    expect(dashboard.report.value).toEqual(report('Wallet'))
    expect(dashboard.problem.value).toEqual({
      ok: false,
      rejection: OperatorRejection.NetworkError,
      detail: 'timeout',
    })
    scope.stop()
  })

  it('drops an answer still on its way for the previous wallet', async () => {
    let answerFirst: (
      value: Awaited<ReturnType<typeof fetchOperatorReport>>,
    ) => void = () => undefined
    vi.mocked(fetchOperatorReport)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            answerFirst = resolve
          }),
      )
      .mockResolvedValueOnce({ ok: true, report: report('Second') })
    const scope = effectScope()
    const dashboard = scope.run(() => useOperatorDashboard())
    if (!dashboard) throw new Error('scope did not run')

    const first = dashboard.watch('First', SolanaNetwork.Mainnet)
    await dashboard.watch('Second', SolanaNetwork.Mainnet)
    answerFirst({ ok: true, report: report('First') })
    await first

    expect(dashboard.report.value).toEqual(report('Second'))
    scope.stop()
  })
})
