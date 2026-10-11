import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { feeScheduleOf } from '@dbc-config-lab/core/core/launch-simulator'
import {
  LaunchPageStatus,
  networkFromQuery,
  useLaunchPage,
} from '@dbc-config-lab/core/features/launch-page'
import { NETWORK_QUERY_KEY } from '@dbc-config-lab/core/router/constants'

/**
 * The config a launch or report page is addressed to (`/:config?network=`), read from
 * chain; `ready` once it has loaded, with its fee schedule when it has one.
 */
export const useRoutedLaunchPage = () => {
  const route = useRoute()
  const network = computed(() =>
    networkFromQuery(route.query[NETWORK_QUERY_KEY]),
  )
  const configAddress = computed(() => String(route.params['config'] ?? ''))
  const { state } = useLaunchPage(network, configAddress)

  const ready = computed(() =>
    state.value.status === LaunchPageStatus.Ready ? state.value : null,
  )
  const schedule = computed(() =>
    ready.value ? feeScheduleOf(ready.value.config.parameters) : null,
  )

  return { network, state, ready, schedule }
}
