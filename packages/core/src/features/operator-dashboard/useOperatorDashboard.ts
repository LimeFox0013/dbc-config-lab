import { onScopeDispose, ref, shallowRef } from 'vue'
import { connectionFor } from '../../core/config-deploy'
import type { SolanaNetwork } from '../../core/shared'
import { OPERATOR_REFRESH_MS } from './constants'
import { fetchOperatorReport } from './fetch'
import type { OperatorReport, OperatorResult } from './types'

type Problem = Extract<OperatorResult, { ok: false }>

/**
 * A fee wallet's dashboard, read on request and again every minute while it is watched. A
 * failed read keeps the last figures and reports why; a new lookup drops any answer still
 * on its way for the previous one.
 */
export const useOperatorDashboard = () => {
  const report = shallowRef<OperatorReport | null>(null)
  const problem = shallowRef<Problem | null>(null)
  const reading = ref(false)
  let watched: { address: string; network: SolanaNetwork } | null = null
  let lookup = 0
  let timer: ReturnType<typeof setInterval> | null = null

  const read = async (): Promise<void> => {
    if (!watched) return
    const current = lookup
    const { address, network } = watched
    reading.value = true
    const result = await fetchOperatorReport(
      connectionFor(network),
      network,
      address,
    )
    if (current !== lookup) return
    reading.value = false
    if (result.ok) {
      report.value = result.report
      problem.value = null
    } else problem.value = result
  }

  const stop = (): void => {
    if (timer) clearInterval(timer)
    timer = null
  }

  const watch = async (
    address: string,
    network: SolanaNetwork,
  ): Promise<void> => {
    stop()
    lookup += 1
    watched = { address, network }
    report.value = null
    problem.value = null
    timer = setInterval(() => void read(), OPERATOR_REFRESH_MS)
    await read()
  }

  onScopeDispose(stop)

  return { report, problem, reading, watch, refresh: read, stop }
}
