<template>
  <main class="compare-view">
    <header class="compare-view__header">
      <h1 class="compare-view__title">
        {{ t('views.compare.title') }}
      </h1>
      <p class="compare-view__subtitle">
        {{ t('views.compare.subtitle') }}
      </p>
    </header>
    <ReplayCheck />
    <p
      v-if="sharedNotice"
      class="compare-view__notice"
      role="alert"
    >
      {{ sharedNotice }}
    </p>
    <ScenarioControls v-model="scenario" />
    <RecommenderPanel
      :scenario="scenario"
      @use="addUserPreset"
    />
    <ConfigEditor
      :presets="presets"
      @add="addUserPreset"
    />
    <OnChainLoader @load="addOnChain" />
    <ComparisonTable :rows="rows" />
    <PriceChart :rows="rows" />
    <DeployPanel :presets="presets" />
    <p class="compare-view__caveat">
      {{ t('views.compare.caveat') }}
    </p>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ComparisonTable } from '../components/ComparisonTable'
import { ConfigEditor } from '../components/ConfigEditor'
import { DeployPanel } from '../components/DeployPanel'
import { OnChainLoader } from '../components/OnChainLoader'
import { PriceChart } from '../components/PriceChart'
import { RecommenderPanel } from '../components/RecommenderPanel'
import { ReplayCheck } from '../components/ReplayCheck'
import { ScenarioControls } from '../components/ScenarioControls'
import { LAUNCH_PRESETS } from '../core/launch-config'
import type { LaunchPreset } from '../core/launch-config'
import { DEFAULT_SCENARIO } from '../core/sniper-scenario'
import type { ScenarioSpec } from '../core/sniper-scenario'
import { ActivationType } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { SLOT_DURATION_MS } from '../core/launch-simulator'
import { compareConfigs, presetEntry } from '../features/comparison'
import type { ComparisonEntry } from '../features/comparison'
import type { OnChainConfig } from '../features/onchain-config'
import { decodeSharedConfig, sharedFromHash } from '../features/config-sharing'
import { ADDRESS_EDGE, SHARED_PRESET_ID } from './constants'

const { t } = useI18n()
const scenario = ref<ScenarioSpec>(DEFAULT_SCENARIO)
/** Configs the user made (a recommendation, an edit); a new one replaces an older one with the same id. */
const userPresets = ref<LaunchPreset[]>([])
const addUserPreset = (preset: LaunchPreset): void => {
  userPresets.value = [preset, ...userPresets.value.filter((p) => p.id !== preset.id)]
}
const presets = computed(() => [...userPresets.value, ...LAUNCH_PRESETS])

/** A config opened from a shared link joins the comparison; a refused link says why. */
const sharedNotice = ref<string | null>(null)
const openShared = (): void => {
  const encoded = sharedFromHash(window.location.hash)
  if (!encoded) return
  const result = decodeSharedConfig(encoded)
  if (!result.ok) {
    sharedNotice.value = t(`views.compare.sharedRejected.${result.rejection}`, { detail: result.detail ?? '' })
    return
  }
  addUserPreset({
    id: SHARED_PRESET_ID,
    name: t('views.compare.sharedName', { name: result.shared.name ?? t('views.compare.sharedDefaultName') }),
    intent: t('views.compare.sharedIntent'),
    config: result.shared.config,
  })
}
openShared()
/** Configs read from chain: compared and simulated, never edited or redeployed. */
const onChain = ref<OnChainConfig[]>([])
const onChainId = (loaded: OnChainConfig): string => `on-chain:${loaded.network}:${loaded.configAddress}`
const addOnChain = (loaded: OnChainConfig): void => {
  onChain.value = [loaded, ...onChain.value.filter((c) => onChainId(c) !== onChainId(loaded))]
}

const shortAddress = (address: string): string => `${address.slice(0, ADDRESS_EDGE)}…${address.slice(-ADDRESS_EDGE)}`

const onChainEntry = (loaded: OnChainConfig): ComparisonEntry => ({
  id: onChainId(loaded),
  name: t('views.compare.onChainName', { address: shortAddress(loaded.configAddress), network: loaded.network }),
  intent: [
    t('views.compare.onChainIntent'),
    ...(loaded.poolAddress ? [t('views.compare.onChainFromPool', { pool: shortAddress(loaded.poolAddress) })] : []),
    ...(loaded.parameters.activationType === ActivationType.Slot ?
        [t('views.compare.onChainSlots', { ms: SLOT_DURATION_MS })] :
        []),
  ].join(' '),
  compiled: { ok: true, parameters: loaded.parameters },
})

const entries = computed(() => [...presets.value.map(presetEntry), ...onChain.value.map(onChainEntry)])
const rows = computed(() => compareConfigs(entries.value, scenario.value))
</script>

<style lang="scss">
.compare-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--space-8) var(--space-4);
}

.compare-view__title {
  margin: 0;
  font-size: var(--font-size-5);
}

.compare-view__subtitle {
  margin: var(--space-2) 0 0;
  color: var(--color-muted-foreground);
}

.compare-view__notice {
  margin: 0;
  padding: var(--space-3);
  border: var(--border-width-1) solid var(--color-loss);
  border-radius: var(--radius-2);
  color: var(--color-loss);
  font-size: var(--font-size-2);
}

.compare-view__caveat {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}
</style>
