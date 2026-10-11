import { computed, ref, shallowRef } from 'vue'
import { loadLaunchpads } from './load'
import type { LaunchpadRecord } from './types'

/**
 * The launchpad snapshot for a collapsible panel: loaded the first time the panel opens
 * (it is large), then kept. Bind `onToggle` to the panel's `<details>`.
 */
export const useLaunchpadSnapshot = () => {
  const open = ref(false)
  const records = shallowRef<LaunchpadRecord[] | null>(null)
  /** The date the snapshot was read from chain; empty until loaded. */
  const takenAt = computed(() => records.value?.[0]?.takenAt ?? '')

  const onToggle = (event: Event): void => {
    if (!(event.target instanceof HTMLDetailsElement)) return
    open.value = event.target.open
    if (open.value && !records.value) {
      void loadLaunchpads().then((loaded) => {
        records.value = loaded
      })
    }
  }

  return { open, records, takenAt, onToggle }
}
