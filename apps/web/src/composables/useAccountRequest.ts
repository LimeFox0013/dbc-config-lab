import { ref, shallowRef } from 'vue'
import type { Ref } from 'vue'
import type {
  ApiFailure,
  ApiResult,
} from '@dbc-config-lab/core/features/account'

/**
 * One account section's calls to the service: `working` while a change is sent, and the
 * service's last refusal in `failure`, shown in its own words.
 */
export const useAccountRequest = () => {
  const working = ref(false)
  const failure = shallowRef<ApiFailure | null>(null)

  /** Sends one change; a refusal is kept in `failure`. */
  const send = async <T>(
    request: () => Promise<ApiResult<T>>,
  ): Promise<ApiResult<T>> => {
    working.value = true
    failure.value = null
    const result = await request()
    working.value = false
    if (!result.ok) failure.value = result.failure
    return result
  }

  /** Keeps what a read returned, or its refusal. */
  const keep = <T>(result: ApiResult<T>, into: Ref<T>): void => {
    if (result.ok) into.value = result.value
    else failure.value = result.failure
  }

  return { working, failure, send, keep }
}
