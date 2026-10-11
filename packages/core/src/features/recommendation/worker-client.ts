import { plainCopy } from '../../core/shared'
import { recommend } from './utils'
import type {
  PendingRecommendation,
  Recommendation,
  RecommendRequest,
  RecommendResponse,
} from './types'

/**
 * Runs recommendations off the main thread so a long search never freezes the page.
 * Falls back to running in place where workers are unavailable. Each call gets an id;
 * the caller decides which answer is current.
 */
export const createRecommender = () => {
  const worker =
    typeof Worker === 'undefined'
      ? null
      : new Worker(
          new URL('../../workers/recommend.worker.ts', import.meta.url),
          { type: 'module' },
        )
  const pending = new Map<number, PendingRecommendation>()
  let nextId = 0

  worker?.addEventListener(
    'message',
    (event: MessageEvent<RecommendResponse>) => {
      const response = event.data
      const waiting = pending.get(response.id)
      if (!waiting) return
      pending.delete(response.id)
      if (response.ok) waiting.resolve(response.recommendation)
      else waiting.reject(new Error(response.reason))
    },
  )

  const run = (
    request: Omit<RecommendRequest, 'id'>,
  ): Promise<Recommendation | null> => {
    if (!worker)
      return Promise.resolve(
        recommend(
          request.base,
          request.objective,
          request.scenario,
          request.options,
        ),
      )
    const id = nextId++
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      // Callers often hold reactive proxies, which cannot cross to a worker; the request
      // is plain data, so a plain copy is exact.
      const message: RecommendRequest = { ...plainCopy(request), id }
      worker.postMessage(message)
    })
  }

  const dispose = (): void => {
    worker?.terminate()
    pending.clear()
  }

  return { run, dispose }
}
