<template>
  <section class="branding-section">
    <h3 class="branding-section__title">
      {{ t('components.deployPanel.branding.title') }}
    </h3>
    <p class="branding-section__hint">
      {{ t('components.deployPanel.branding.intro') }}
    </p>

    <p
      v-if="configAddress"
      class="branding-section__hint"
    >
      <a
        :href="launchPagePath(configAddress, network)"
        target="_blank"
        rel="noopener"
        class="branding-section__link"
      >{{ t('components.deployPanel.branding.launchPage') }}</a>
    </p>

    <p
      v-if="!connected"
      class="branding-section__hint"
    >
      {{ t('components.deployPanel.branding.connectFirst') }}
    </p>
    <p
      v-else-if="published === undefined"
      class="branding-section__hint"
    >
      {{ t('components.deployPanel.branding.reading') }}
    </p>
    <p
      v-else-if="published"
      class="branding-section__hint"
    >
      {{ t('components.deployPanel.branding.published', { name: published.name }) }}
    </p>
    <template v-else>
      <div class="branding-section__fields">
        <label class="branding-section__field">
          <span class="branding-section__label">{{ t('components.deployPanel.branding.name') }}</span>
          <input
            v-model="branding.name"
            class="branding-section__control"
            type="text"
            :maxlength="BRANDING_NAME_LIMIT"
            :disabled="busy"
          />
        </label>
        <label class="branding-section__field">
          <span class="branding-section__label">{{ t('components.deployPanel.branding.website') }}</span>
          <input
            v-model="branding.website"
            class="branding-section__control"
            type="url"
            :maxlength="BRANDING_URL_LIMIT"
            :disabled="busy"
          />
        </label>
        <label class="branding-section__field">
          <span class="branding-section__label">{{ t('components.deployPanel.branding.logo') }}</span>
          <input
            v-model="branding.logo"
            class="branding-section__control"
            type="url"
            :maxlength="BRANDING_URL_LIMIT"
            :disabled="busy"
          />
        </label>
      </div>
      <p
        v-if="rejection && branding.name.length > 0"
        class="branding-section__error"
        role="alert"
      >
        {{ t(`components.deployPanel.branding.rejections.${rejection}`) }}
      </p>
      <p class="branding-section__hint">
        {{ t('components.deployPanel.branding.once') }}
      </p>
      <button
        v-if="step !== DeployStep.Ready && step !== DeployStep.Signing"
        type="button"
        class="branding-section__control branding-section__button"
        :disabled="!prepareAllowed || step === DeployStep.Preparing"
        @click="prepare"
      >
        {{ step === DeployStep.Preparing ? t('common.signing.preparing') : t('components.deployPanel.branding.prepare') }}
      </button>
      <button
        v-else
        type="button"
        class="branding-section__control branding-section__button"
        :disabled="step === DeployStep.Signing"
        @click="signAndSend"
      >
        {{ step === DeployStep.Signing ? t('common.signing.signing') : t('common.signing.sign') }}
      </button>
    </template>

    <p
      v-if="signature"
      class="branding-section__hint"
    >
      <a
        :href="explorerTransactionUrl(signature, network)"
        target="_blank"
        rel="noopener noreferrer"
        class="branding-section__link"
      >{{ t('common.signing.viewTransaction') }}</a>
    </p>
    <p
      v-if="error"
      class="branding-section__error"
      role="alert"
    >
      {{ error }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { toRefs, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { explorerTransactionUrl } from '../../core/config-deploy'
import { BRANDING_NAME_LIMIT, BRANDING_URL_LIMIT } from '../../core/partner-branding'
import { DeployStep } from '../../features/deployment'
import { launchPagePath } from '../../features/launch-page'
import { usePartnerBranding } from '../../features/partner-branding'
import type { BrandingSectionProps } from './types'

const props = defineProps<BrandingSectionProps>()
/** The panel's network and wallet must not change while branding is prepared or signed. */
const emit = defineEmits<{ busy: [busy: boolean] }>()
const { t } = useI18n()
const { network, connected, mainnetAcknowledged } = toRefs(props)

const { published, branding, rejection, step, busy, error, signature, prepareAllowed, prepare, signAndSend } =
  usePartnerBranding({ network, connected, mainnetAcknowledged }, props.initialBranding)

watch(busy, (value) => emit('busy', value))
</script>

<style lang="scss">
@use '../../styles/mixins';

.branding-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-top: var(--space-4);
  border-top: var(--border-width-1) solid var(--color-border);
}

.branding-section__title {
  margin: 0;
  font-size: var(--font-size-3);
}

.branding-section__hint,
.branding-section__label {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.branding-section__error {
  margin: 0;
  font-size: var(--font-size-2);
  color: var(--color-loss);
  overflow-wrap: anywhere;
}

.branding-section__fields {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.branding-section__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.branding-section__control {
  @include mixins.control;
}

.branding-section__button {
  align-self: flex-start;
  @include mixins.clickable;
}

.branding-section__link {
  color: var(--color-gain);
}
</style>
