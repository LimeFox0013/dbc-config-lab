<template>
  <section class="deploy-panel">
    <h2 class="deploy-panel__title">
      {{ t('components.deployPanel.title') }}
    </h2>

    <div class="deploy-panel__row">
      <label class="deploy-panel__field">
        <span class="deploy-panel__label">{{ t('components.deployPanel.preset') }}</span>
        <select
          v-model="targetId"
          class="deploy-panel__select"
          :disabled="busy || launchBusy || claimBusy || brandingBusy"
        >
          <option
            v-for="option in targets"
            :key="option.id"
            :value="option.id"
          >
            {{ option.name }}
          </option>
        </select>
      </label>
    </div>

    <WalletBar
      v-model:network="network"
      v-model:acknowledged="mainnetAcknowledged"
      :wallets="wallets"
      :connected="connected"
      :acknowledgement="WalletAcknowledgement.Deploy"
      :disabled="busy || launchBusy || claimBusy || brandingBusy"
      @connect="connect"
    />

    <p
      v-if="connectError"
      class="deploy-panel__error"
      role="alert"
    >
      {{ connectError }}
    </p>

    <ConfigDeploy
      :target="target"
      :network="network"
      :connected="connected"
      :mainnet-acknowledged="mainnetAcknowledged"
      @busy="busy = $event"
      @deployed="deployedConfigAddress = $event"
    />

    <PoolLaunch
      :network="network"
      :connected="connected"
      :mainnet-acknowledged="mainnetAcknowledged"
      :initial-config-address="deployedConfigAddress"
      @busy="launchBusy = $event"
    />
    <BrandingSection
      :network="network"
      :connected="connected"
      :mainnet-acknowledged="mainnetAcknowledged"
      :config-address="deployedConfigAddress"
      @busy="brandingBusy = $event"
    />
    <EarningsSection
      :network="network"
      :connected="connected"
      :mainnet-acknowledged="mainnetAcknowledged"
      @busy="claimBusy = $event"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DeployTarget } from '../../features/deployment'
import { useWalletSession } from '../../features/wallet'
import type { DeployWallet } from '../../features/wallet'
import { BrandingSection } from '../BrandingSection'
import { ConfigDeploy } from '../ConfigDeploy'
import { EarningsSection } from '../EarningsSection'
import { PoolLaunch } from '../PoolLaunch'
import { WalletAcknowledgement, WalletBar } from '../WalletBar'
import type { DeployPanelProps } from './types'

const props = defineProps<DeployPanelProps>()
const { t } = useI18n()

const targetId = ref<DeployTarget['id']>(props.initialTargetId)
const target = computed<DeployTarget>(() => {
  const found = props.targets.find((candidate) => candidate.id === targetId.value)
  if (!found) throw new Error(`Unknown config ${targetId.value}`)
  return found
})

const { network, mainnetAcknowledged, wallets, connected, connect: connectWallet } = useWalletSession()
const connectError = ref<string | null>(null)
const connect = async (wallet: DeployWallet): Promise<void> => {
  connectError.value = await connectWallet(wallet)
}

/** A config deploy is being prepared or signed on the panel's network and wallet. */
const busy = ref(false)
/** A token launch is being prepared or signed on the panel's network and wallet. */
const launchBusy = ref(false)
/** A fee claim is being prepared or signed on the panel's network and wallet. */
const claimBusy = ref(false)
/** Branding is being prepared or signed on the panel's network and wallet. */
const brandingBusy = ref(false)

/** The last config deployed here, offered as the one to launch a token on. */
const deployedConfigAddress = ref('')
// A config exists on the network it was deployed to; on another it would be offered in vain.
watch(network, () => {
  deployedConfigAddress.value = ''
})
</script>

<style lang="scss">
@use '../../styles/mixins';

.deploy-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  @include mixins.surface;
}

.deploy-panel__title {
  margin: 0;
  font-size: var(--font-size-3);
}

.deploy-panel__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  align-items: center;
}

.deploy-panel__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.deploy-panel__label {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.deploy-panel__select {
  @include mixins.control;
}

.deploy-panel__error {
  margin: 0;
  color: var(--color-loss);
  font-size: var(--font-size-2);
  overflow-wrap: anywhere;
}
</style>
