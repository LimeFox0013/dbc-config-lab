<template>
  <header class="launchpad-identity">
    <img
      v-if="logo && !logoFailed"
      :src="logo"
      alt=""
      class="launchpad-identity__logo"
      referrerpolicy="no-referrer"
      @error="logoFailed = true"
    />
    <div class="launchpad-identity__body">
      <h1 class="launchpad-identity__title">
        {{ name || t('components.launchpadIdentity.unbranded', { address: shortAddress(config.feeClaimer) }) }}
      </h1>
      <p
        v-if="name"
        class="launchpad-identity__hint"
      >
        {{ t('components.launchpadIdentity.unverified') }}
        <a
          v-if="website"
          :href="website"
          target="_blank"
          rel="noopener noreferrer nofollow"
          class="launchpad-identity__link"
        >{{ brandingHost(website) }}</a>
      </p>
      <p
        v-else
        class="launchpad-identity__hint"
      >
        {{ t('components.launchpadIdentity.noBranding') }}
      </p>
      <dl class="launchpad-identity__terms">
        <dt>{{ t('components.launchpadIdentity.feeWallet') }}</dt>
        <dd class="launchpad-identity__value">
          <a
            :href="explorerAddressUrl(config.feeClaimer, config.network)"
            target="_blank"
            rel="noopener noreferrer"
            class="launchpad-identity__link launchpad-identity__link--plain"
          >{{ config.feeClaimer }}</a>
        </dd>
        <template v-if="royalty">
          <dt>{{ t('components.launchpadIdentity.royalty') }}</dt>
          <dd class="launchpad-identity__value">
            {{
              t('components.launchpadIdentity.royaltyValue', {
                operator: royalty.deployerPercent,
                operatorAddress: royalty.deployer,
                author: royalty.authorPercent,
                authorAddress: royalty.author,
              })
            }}
          </dd>
        </template>
        <dt>{{ t('components.launchpadIdentity.config') }}</dt>
        <dd class="launchpad-identity__value">
          <a
            :href="explorerAddressUrl(config.configAddress, config.network)"
            target="_blank"
            rel="noopener noreferrer"
            class="launchpad-identity__link launchpad-identity__link--plain"
          >{{ config.configAddress }}</a>
        </dd>
        <dt>{{ t('components.launchpadIdentity.network') }}</dt>
        <dd class="launchpad-identity__value">
          {{ config.network }}
        </dd>
      </dl>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { explorerAddressUrl } from '../../core/config-deploy'
import { brandingHost, displayBrandingName, safeBrandingUrl } from '../../core/partner-branding'
import { shortAddress } from '../../core/shared'
import type { LaunchpadIdentityProps } from './types'

const props = defineProps<LaunchpadIdentityProps>()
const { t } = useI18n()

/** A logo that does not load is left out rather than shown broken. */
const logoFailed = ref(false)
const name = computed(() => (props.branding ? displayBrandingName(props.branding.name) : ''))
const logo = computed(() => (props.branding ? safeBrandingUrl(props.branding.logo) : null))
const website = computed(() => (props.branding ? safeBrandingUrl(props.branding.website) : null))
</script>

<style lang="scss">
@use '../../styles/mixins';

.launchpad-identity {
  display: flex;
  gap: var(--space-4);
  align-items: flex-start;
}

.launchpad-identity__logo {
  width: var(--logo-size);
  height: var(--logo-size);
  border-radius: var(--radius-2);
  object-fit: cover;
}

.launchpad-identity__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.launchpad-identity__title {
  margin: 0;
  font-size: var(--font-size-5);
  overflow-wrap: anywhere;
}

.launchpad-identity__hint {
  margin: var(--space-1) 0 0;
  font-size: var(--font-size-2);
  color: var(--color-muted-foreground);
}

.launchpad-identity__link {
  margin-left: var(--space-2);
  color: var(--color-gain);
  overflow-wrap: anywhere;
}

.launchpad-identity__link--plain {
  margin-left: 0;
}

.launchpad-identity__terms {
  @include mixins.term-list;
}

.launchpad-identity__value {
  font-family: var(--font-family-mono);
  overflow-wrap: anywhere;
}
</style>
